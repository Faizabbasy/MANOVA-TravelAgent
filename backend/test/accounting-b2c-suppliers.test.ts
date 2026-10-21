import {afterAll,beforeAll,describe,expect,test} from 'bun:test'
import {DEMO,makeTestApp,type TestApp} from './helpers'
import {createBook,createPeriod} from '../src/modules/accounting/setup'
import {postBusinessEvent} from '../src/modules/accounting/posting'
const M=(n:number)=>(BigInt(n)*1000000n).toString()
const actor={userId:'USR-010',role:'super-admin' as const,name:'TEST_ONLY',email:'test@example.invalid',sessionId:'TEST_ONLY',partyId:null,vendorId:null}
describe('native B2C supplier sources and accounting contribution',()=>{
  let t:TestApp,finance:string,admin:string,projects:string,invoiceA:string
  const call=(method:string,path:string,body?:unknown,cookie=finance,key:string=crypto.randomUUID())=>t.call(method,`/api/v1${path}`,{cookie,body,headers:{'idempotency-key':key}})
  const post=async(path:string,body:unknown,key?:string)=>{const r=await call('POST',path,body,finance,key);expect(r.status,r.text).toBeLessThan(300);return r.json.data}
  const bal=async(role:string,order:string|null=null)=>(await t.db.query<{n:string}>(`select coalesce(sum(l.debit_minor-l.credit_minor),0) as n from accounting_journal_lines l
    join accounting_journals j on j.id=l.journal_id and j.status='posted' join accounting_accounts a on a.book_id=l.book_id and a.code=l.account_code
    where a.control_role=$1 and l.sales_order_id is not distinct from $2`,[role,order]))[0]!.n
  const fulfill=(order:string,n:number)=>post('/finance/fulfillments',{side:'supplier',salesOrderId:order,vendorId:'VND-001',amountMinor:M(n),fulfilledOn:'2026-09-30',basis:'estimate',isFinal:true,evidence:'TEST_ONLY supplier delivery'})
  const invoice=async(order:string|undefined,n:number,number:string)=>{
    const i=await post('/finance/vendor-invoices',{vendorId:'VND-001',salesOrderId:order,vendorInvoiceNumber:number,invoiceDate:'2026-10-01',dueDate:'2026-10-28',totalMinor:M(n)})
    await post(`/finance/vendor-invoices/${i.id}/review`,{action:'approve'});return i.id
  }
  beforeAll(async()=>{
    t=await makeTestApp();finance=await t.login(DEMO.finance);admin=await t.login(DEMO.admin)
    projects=(await t.db.query('select count(*) as n from projects'))[0]!.n as string
    for(const id of ['SLO-TEST-A','SLO-TEST-B','SLO-TEST-C']) await t.db.query(`insert into sales_order_refs(id,party_id,price_minor,traveler_count,destination,travel_start_date,travel_end_date)
      values ($1,'PTY-001',100000000,1,'TEST_ONLY','2026-10-01','2026-10-02')`,[id])
    await t.db.query(`insert into bank_accounts(id,code,bank_name,holder_name,account_number,opening_status,opening_balance_minor,opening_date,opening_submitted_by,opening_submitted_at,opening_verified_by,opening_verified_at,created_by)
      values ('BA-B2C','B2C','Synthetic','TEST_ONLY','123456','verified',100000000,'2026-09-01','USR-001',now(),'USR-010',now(),'USR-010')`)
    const b=await t.db.transaction(tx=>createBook(tx,actor,{name:'TEST_ONLY B2C supplier',purpose:'rehearsal',cutoverDate:'2026-09-01',timezone:'Asia/Jakarta'},'req_setup','test'))
    await t.db.transaction(tx=>createPeriod(tx,actor,{startsOn:'2026-09-01',endsOn:'2026-11-30',reason:'TEST_ONLY window'},'req_period'))
    for(const kind of ['opening','customer_billing','fulfillment','supplier_fulfillment','vendor_billing','vendor_payment','vendor_allocation','supplier_claim']) {
      const settings=kind==='customer_billing'?{billingRight:'unconditional'}:kind==='vendor_billing'?{invoiceTreatment:'prepaid'}:{}
      const recognition=['customer_billing','fulfillment'].includes(kind)?'fulfillment':['supplier_fulfillment','vendor_billing'].includes(kind)?'supplier-fulfillment':'TEST_ONLY'
      await t.db.query(`insert into accounting_policies(id,book_id,source_kind,version,effective_from,principal_agent,recognition,tax_treatment,validation_status,settings,rationale,created_by)
        values ($1,$2,$3,1,'2026-09-01','principal',$4,'TEST_ONLY_EXCLUDED','test-only',$5::text::jsonb,'TEST_ONLY no production policy','USR-010')`,[`APL-${kind}`,b.id,kind,recognition,JSON.stringify(settings)])
    }
    await t.db.transaction(tx=>postBusinessEvent(tx,actor,{sourceType:'test_opening',sourceId:'TEST_ONLY',sourceVersion:'1',kind:'opening',effectiveDate:'2026-09-01',snapshot:{amount:M(100)},policyKind:'opening',description:'TEST_ONLY opening',lines:[{accountCode:'1100',bankAccountId:'BA-B2C',debitMinor:M(100),creditMinor:'0'},{accountCode:'3100',debitMinor:'0',creditMinor:M(100)}]},'req_opening'))
    await t.db.query("update accounting_books set mode='active',entity_type='TEST_ONLY',accounting_standard='TEST_ONLY',opening_validated=true")
  },60000)
  afterAll(async()=>{await t?.cleanup()})
  test('two orders sharing a vendor never consume each other’s accrual; invoice actual and payment do not double cost',async()=>{
    await fulfill('SLO-TEST-A',60);await fulfill('SLO-TEST-B',20)
    invoiceA=await invoice('SLO-TEST-A',70,'TEST-A-70')
    expect(await bal('direct-cost','SLO-TEST-A')).toBe(M(70));expect(await bal('accrued-cost','SLO-TEST-A')).toBe('0')
    expect(await bal('direct-cost','SLO-TEST-B')).toBe(M(20));expect(await bal('accrued-cost','SLO-TEST-B')).toBe('-'+M(20))
    const i=await post('/finance/customer-invoices',{salesOrderId:'SLO-TEST-A',invoiceType:'dp',dueDate:'2026-10-28',lines:[{description:'TEST_ONLY retail contract',amountMinor:M(100)}]})
    await post(`/finance/customer-invoices/${i.id}/issue`,{issueDate:'2026-09-01'})
    await post('/finance/fulfillments',{side:'customer',salesOrderId:'SLO-TEST-A',amountMinor:M(100),fulfilledOn:'2026-10-02',evidence:'TEST_ONLY contract delivered'})
    const payment={bankAccountId:'BA-B2C',vendorId:'VND-001',amountMinor:M(70),effectiveDate:'2026-10-02',allocations:[{vendorInvoiceId:invoiceA,amountMinor:M(70)}]}
    const p=await post('/finance/vendor-payments',payment,'test-b2c-payment')
    expect((await post('/finance/vendor-payments',payment,'test-b2c-payment')).transactionId).toBe(p.transactionId)
    expect(await bal('cash')).toBe(M(30));expect(await bal('payable','SLO-TEST-A')).toBe('0');expect(await bal('direct-cost','SLO-TEST-A')).toBe(M(70))
    const summary=(await call('GET','/accounting/orders/SLO-TEST-A/summary')).json.data
    expect(summary.figures).toMatchObject({revenueMinor:M(100),directCostMinor:M(70),contributionMinor:M(30),payableMinor:'0'})
    const listed=await call('GET','/finance/payables?view=all&salesOrderId=SLO-TEST-A')
    expect(listed.json.data.map((i:{id:string})=>i.id)).toEqual([invoiceA])
    expect((await t.db.query('select count(*) as n from projects'))[0]!.n).toBe(projects)
    expect((await t.db.query('select count(*) as n from financial_transactions'))[0]!.n).toBe('1')
  })
  test('lower actual and supplier recovery affect only their order; cash reversal preserves the claim and order dimensions',async()=>{
    await invoice('SLO-TEST-B',18,'TEST-B-18')
    expect(await bal('direct-cost','SLO-TEST-B')).toBe(M(18));expect(await bal('accrued-cost','SLO-TEST-B')).toBe('0')
    const c=await post('/finance/supplier-claims',{salesOrderId:'SLO-TEST-A',vendorId:'VND-001',basis:'cost-recovery',amountMinor:M(4),recognizedOn:'2026-10-03',reason:'TEST_ONLY supplier compensation'})
    expect(await bal('direct-cost','SLO-TEST-A')).toBe(M(66))
    const r=await post('/finance/vendor-refunds',{claimId:c.id,bankAccountId:'BA-B2C',amountMinor:M(4),effectiveDate:'2026-10-04'})
    expect(await bal('supplier-claim','SLO-TEST-A')).toBe('0')
    await post(`/finance/transactions/${r.transactionId}/reverse`,{reason:'TEST_ONLY wrong bank receipt'})
    expect(await bal('supplier-claim','SLO-TEST-A')).toBe(M(4));expect(await bal('direct-cost','SLO-TEST-A')).toBe(M(66))
    await post(`/finance/supplier-claims/${c.id}/void`,{reason:'TEST_ONLY claim corrected'})
    expect(await bal('direct-cost','SLO-TEST-A')).toBe(M(70));expect(await bal('supplier-claim','SLO-TEST-A')).toBe('0')
    expect((await call('GET','/accounting/reports/balance-sheet?asOf=2026-10-21')).json.data.balanced).toBe(true)
  })
  test('company invoices cannot clear retail cost; invalid source combinations and unauthorized requests are rejected',async()=>{
    await fulfill('SLO-TEST-C',9);await invoice(undefined,5,'TEST-COMPANY-5')
    expect(await bal('accrued-cost','SLO-TEST-C')).toBe('-'+M(9));expect(await bal('prepaid-trip')).toBe(M(5))
    expect((await t.call('GET','/api/v1/accounting/orders/SLO-TEST-A/summary')).status).toBe(401)
    expect((await call('GET','/accounting/orders/SLO-TEST-A/summary',undefined,admin)).status).toBe(403)
    expect((await call('GET','/accounting/orders/MISSING/summary')).status).toBe(404)
    expect((await call('POST','/finance/fulfillments',{side:'supplier',salesOrderId:'SLO-TEST-A',projectId:'PRJ-101',vendorId:'VND-001',amountMinor:M(1),fulfilledOn:'2026-10-01',evidence:'TEST_ONLY invalid scope'})).status).toBe(400)
    await expect(t.db.query('update vendor_invoices set sales_order_id=$2 where id=$1',[invoiceA,'SLO-TEST-B'])).rejects.toThrow()
    await expect(t.db.query(`insert into service_fulfillments(id,side,project_id,sales_order_id,vendor_id,amount_minor,fulfilled_on,evidence,created_by)
      values ('SFL-SQL-BAD','supplier','PRJ-101','SLO-TEST-A','VND-001',1,'2026-10-01','TEST_ONLY invalid','USR-010')`)).rejects.toThrow()
  })
})
