import {afterAll,beforeAll,describe,expect,test} from 'bun:test'
import {DEMO,makeTestApp,type TestApp} from './helpers'
import {createBook,createPeriod} from '../src/modules/accounting/setup'
import {postCashSource} from '../src/modules/accounting/cash-source'
import {migrateDown} from '../src/db/migrator'
const actor={userId:'USR-010',role:'super-admin' as const,name:'TEST_ONLY',email:'test@example.invalid',sessionId:'TEST_ONLY',partyId:null,vendorId:null}
describe('pending cash correction and late allocation derive exact existing-source reversals',()=>{
  let t:TestApp,owner:string,finance:string
  const call=(method:string,path:string,body?:unknown,cookie=owner,key:string=crypto.randomUUID())=>t.call(method,`/api/v1${path}`,{cookie,body,headers:{'idempotency-key':key}})
  const post=async(path:string,body:unknown,cookie=owner)=>{const r=await call('POST',path,body,cookie);expect(r.status,r.text).toBeLessThan(300);return r.json.data}
  const policy=async(sourceKind:string,settings:unknown={},principalAgent='not-applicable',recognition='source-confirmed')=>{
    const p=await post('/accounting/policies',{sourceKind,effectiveFrom:'2026-09-01',principalAgent,recognition,taxTreatment:'TEST_ONLY_EXCLUDED',settings,rationale:'TEST_ONLY source correction fixture'})
    return post(`/accounting/policies/${p.id}/rehearse`,{confirm:true,reason:'TEST_ONLY original source checked'})
  }
  const event=async(id:string,kind:string)=>(await t.db.query<{id:string;fingerprint:string}>("select id,fingerprint from accounting_events where source_id=$1 and event_kind=$2 and source_version='1'",[id,kind]))[0]!
  const net=async(role:string)=>(await t.db.query<{n:string}>(`select coalesce(sum(l.debit_minor-l.credit_minor),0) as n from accounting_journal_lines l join accounting_journals j on j.id=l.journal_id and j.status='posted'
    join accounting_accounts a on a.book_id=l.book_id and a.code=l.account_code where a.control_role=$1`,[role]))[0]!.n
  beforeAll(async()=>{
    t=await makeTestApp();owner=await t.login(DEMO.superAdmin);finance=await t.login(DEMO.finance)
    await t.db.transaction(tx=>createBook(tx,actor,{name:'TEST_ONLY pending reversals',purpose:'rehearsal',cutoverDate:'2026-09-01',timezone:'Asia/Jakarta'},'req_setup','test'))
    await t.db.transaction(tx=>createPeriod(tx,actor,{startsOn:'2026-09-01',endsOn:'2026-12-31',reason:'TEST_ONLY correction window'},'req_period'))
    await t.db.query(`insert into bank_accounts(id,code,bank_name,holder_name,account_number,opening_status,opening_balance_minor,opening_date,opening_submitted_by,opening_submitted_at,opening_verified_by,opening_verified_at,created_by)
      values('BA-PENDING','PENDING','Synthetic','TEST_ONLY','123456','verified',100000000,'2026-09-01','USR-001',now(),'USR-010',now(),'USR-010')`)
  },60000)
  afterAll(async()=>{await t?.cleanup()})
  test('an unposted expense reversed before policy completion resolves without repeating cash or fabricating a journal',async()=>{
    const cash=await post('/finance/transactions',{bankAccountId:'BA-PENDING',kind:'expense',category:'office',amountMinor:'1000000',effectiveDate:'2026-09-05'},finance)
    const reversal=await post(`/finance/transactions/${cash.transactionId}/reverse`,{reason:'TEST_ONLY corrected before policy'},finance)
    const p=await event(cash.transactionId,'cash_posted'),r=await event(reversal.reversalId,'cash_reversal')
    expect((await post(`/accounting/exceptions/${r.id}/retry`,{})).status).toBe('pending')
    await expect(t.db.query("update accounting_posting_registry set status='superseded',reason_code='DERIVED_REVERSALS_POSTED' where event_id=$1",[r.id])).rejects.toThrow('every exact source compensation')
    await policy('manual_cash',{classifications:{office:'office-expense'}})
    expect((await post(`/accounting/exceptions/${p.id}/retry`,{})).status).toBe('posted')
    expect((await t.db.query('select status from accounting_posting_registry where event_id=$1',[r.id]))[0]!.status).toBe('superseded')
    expect((await t.db.query('select fingerprint from accounting_events where id=$1',[r.id]))[0]!.fingerprint).toBe(r.fingerprint)
    expect((await t.db.query('select count(*) as n from financial_transactions'))[0]!.n).toBe('2')
    expect(await net('office-expense')).toBe('0');expect(await net('cash')).toBe('0')
    const status=(await call('GET',`/accounting/sources/financial_transaction/${reversal.reversalId}`)).json.data
    expect(status.status).toBe('posted');expect(status.journals).toHaveLength(1)
    expect((await call('GET','/accounting/exceptions')).json.data).toHaveLength(0)
    await expect(t.db.query("update accounting_posting_registry set status='pending' where event_id=$1",[r.id])).rejects.toThrow('immutable')
    await expect(migrateDown(t.db,{to:61})).rejects.toThrow('Resolved cash reversal evidence')
  })
  test('an allocation resolved after its receipt was already reversed gains its own exact reversal automatically',async()=>{
    const i=await post('/finance/customer-invoices',{projectId:'PRJ-101',invoiceType:'dp',dueDate:'2026-11-01',lines:[{description:'TEST_ONLY late allocation',amountMinor:'10000000'}]},finance)
    await post(`/finance/customer-invoices/${i.id}/issue`,{issueDate:'2026-09-05'},finance)
    const receipt=await post('/finance/receipts',{bankAccountId:'BA-PENDING',partyId:'PTY-001',projectId:'PRJ-101',amountMinor:'7000000',effectiveDate:'2026-09-06',allocations:[{invoiceId:i.id,amountMinor:'7000000'}]},finance)
    const reversal=await post(`/finance/transactions/${receipt.transactionId}/reverse`,{reason:'TEST_ONLY receipt corrected while pending'},finance)
    const parent=await event(receipt.transactionId,'cash_posted'),marker=await event(reversal.reversalId,'cash_reversal')
    const [allocation]=await t.db.query<{id:string}>(`select e.id from accounting_events e join payment_allocations a on a.id::text=e.source_id where e.source_type='payment_allocation' and a.transaction_id=$1`,[receipt.transactionId])
    await policy('customer_billing',{billingRight:'unconditional'},'principal','fulfillment');await policy('customer_receipt');await policy('customer_allocation')
    await post(`/accounting/exceptions/${(await event(i.id,'invoice_recognized')).id}/retry`,{})
    await post(`/accounting/exceptions/${parent.id}/retry`,{})
    expect((await t.db.query('select status from accounting_posting_registry where event_id=$1',[marker.id]))[0]!.status).toBe('superseded')
    expect((await t.db.query('select status from accounting_posting_registry where event_id=$1',[allocation!.id]))[0]!.status).toBe('pending')
    await post(`/accounting/exceptions/${allocation!.id}/retry`,{})
    expect(await net('cash')).toBe('0');expect(await net('customer-advance')).toBe('0');expect(await net('receivable')).toBe('10000000')
    const [balance]=await t.db.query('select paid_minor from v_customer_invoice_balances where invoice_id=$1',[i.id])
    expect(balance!.paid_minor).toBe('0')
    expect((await t.db.query('select count(*) as n from financial_transactions'))[0]!.n).toBe('4')
    const before=(await t.db.query('select count(*) as n from accounting_journals'))[0]!.n
    await t.db.transaction(tx=>postCashSource(tx,actor,reversal.reversalId,'req_same_reversal_again'))
    expect((await t.db.query('select count(*) as n from accounting_journals'))[0]!.n).toBe(before)
    expect((await call('GET','/accounting/exceptions')).json.data).toHaveLength(0)
    const status=(await call('GET',`/accounting/sources/financial_transaction/${reversal.reversalId}`)).json.data
    expect(status.status).toBe('posted');expect(status.journals).toHaveLength(2)
  })
})
