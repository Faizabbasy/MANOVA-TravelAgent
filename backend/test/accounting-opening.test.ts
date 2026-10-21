import { afterAll,beforeAll,describe,expect,test } from 'bun:test'
import { DEMO,makeTestApp,type TestApp } from './helpers'
import { createBook,createPeriod } from '../src/modules/accounting/setup'

/**
 * A15 opening rehearsal: Finance ran BEFORE the book existed; the opening is derived from those facts (no cash replay),
 * decisions are explicit per item, and later settlements of pre-cutover sources post as deltas. TEST_ONLY data.
 */
const M = (n:number) => (BigInt(n) * 1_000_000n).toString()

describe('opening balances at cutover',() => {
  let t:TestApp,finance:string,owner:string,advance:string,invoice:string,vinv:string
  const actor = { userId:'USR-010',role:'super-admin' as const,name:'TEST_ONLY',email:'test@example.invalid',sessionId:'TEST_ONLY',partyId:null,vendorId:null }
  const call = (cookie:string,method:'POST'|'GET',path:string,body?:unknown,key:string = crypto.randomUUID()) => t.call(method,`/api/v1${path}`,{ cookie,body,headers:{ 'idempotency-key':key } })
  const post = async (path:string,body:unknown,cookie = finance) => { const r = await call(cookie,'POST',path,body);expect(r.status, r.text).toBeLessThan(300);return r.json.data }
  const bal = async (code:string) => (await t.db.query<{ b:string }>(`select coalesce(sum(l.debit_minor-l.credit_minor),0) as b from accounting_journal_lines l
    join accounting_journals j on j.id=l.journal_id and j.status='posted' where l.account_code=$1`,[code]))[0]!.b

  beforeAll(async () => {
    t = await makeTestApp();finance = await t.login(DEMO.finance);owner = await t.login(DEMO.superAdmin)
    await t.db.query(`insert into bank_accounts (id,code,bank_name,holder_name,account_number,opening_status,opening_balance_minor,opening_date,opening_submitted_by,opening_submitted_at,opening_verified_by,opening_verified_at,created_by)
      values ('BA-TEST','TESTBANK','Synthetic','TEST_ONLY','123456','verified',$1,'2026-08-01','USR-001',now(),'USR-010',now(),'USR-010')`,[M(100)])
    // August, no accounting book yet: ordinary Finance work.
    invoice = (await post('/finance/customer-invoices',{ projectId:'PRJ-101',invoiceType:'dp',dueDate:'2026-09-30',lines:[{ description:'TEST_ONLY paket',amountMinor:M(100) }] })).id
    await post(`/finance/customer-invoices/${invoice}/issue`,{ issueDate:'2026-08-05' })
    await post('/finance/receipts',{ bankAccountId:'BA-TEST',partyId:'PTY-001',projectId:'PRJ-101',amountMinor:M(30),effectiveDate:'2026-08-06',allocations:[{ invoiceId:invoice,amountMinor:M(30) }] })
    advance = (await post('/finance/receipts',{ bankAccountId:'BA-TEST',partyId:'PTY-001',projectId:'PRJ-101',amountMinor:M(10),effectiveDate:'2026-08-07' })).transactionId
    vinv = (await post('/finance/vendor-invoices',{ vendorId:'VND-001',projectId:'PRJ-101',vendorInvoiceNumber:'TEST-OPEN-1',invoiceDate:'2026-08-08',dueDate:'2026-09-30',totalMinor:M(40) })).id
    await post(`/finance/vendor-invoices/${vinv}/review`,{ action:'approve' })
    await post('/finance/vendor-payments',{ bankAccountId:'BA-TEST',vendorId:'VND-001',projectId:'PRJ-101',amountMinor:M(15),effectiveDate:'2026-08-08',allocations:[{ vendorInvoiceId:vinv,amountMinor:M(15) }] })
    await post('/finance/vendor-payments',{ bankAccountId:'BA-TEST',vendorId:'VND-002',amountMinor:M(5),effectiveDate:'2026-08-09' })
    await post('/finance/transactions',{ bankAccountId:'BA-TEST',kind:'expense',category:'office',amountMinor:M(2),effectiveDate:'2026-08-10' })
    // The rehearsal book starts on 1 September.
    const book = await t.db.transaction(tx => createBook(tx,actor,{ name:'TEST_ONLY opening',purpose:'rehearsal',cutoverDate:'2026-09-01',timezone:'Asia/Jakarta' },'req_fixture_setup','test'))
    await t.db.transaction(tx => createPeriod(tx,actor,{ startsOn:'2026-09-01',endsOn:'2026-12-31',reason:'TEST_ONLY window' },'req_period'))
    const recognition:Record<string,string> = { customer_billing:'fulfillment',fulfillment:'fulfillment' }
    for (const kind of ['opening','customer_allocation','vendor_allocation','fulfillment','customer_billing','manual_cash']) {
      await t.db.query(`insert into accounting_policies (id,book_id,source_kind,version,effective_from,principal_agent,recognition,tax_treatment,validation_status,settings,rationale,created_by)
        values ($1,$2,$3,1,'2026-09-01','principal',$4,'TEST_ONLY_EXCLUDED','test-only','{}'::jsonb,'TEST_ONLY fixture, not a real opening policy',$5)`,[`APL-${kind}`,book.id,kind,recognition[kind] ?? 'TEST_ONLY',actor.userId])
    }
  },60000)
  afterAll(async () => { await t?.cleanup() })

  test('preview derives every position from Finance as of cutover, writes nothing and balances to visible clearing',async () => {
    const journals = (await t.db.query('select count(*) as n from accounting_journals'))[0]!.n
    const p = (await call(finance,'GET','/accounting/opening-plan')).json.data
    const amount = (role:string) => p.items.filter((i:{ role:string }) => i.role === role).reduce((s:bigint,i:{ amountMinor:string }) => s + BigInt(i.amountMinor),0n).toString()
    expect(amount('cash')).toBe(M(118));expect(amount('receivable')).toBe(M(70));expect(amount('customer-advance')).toBe(M(10))
    expect(amount('payable')).toBe(M(25));expect(amount('supplier-advance')).toBe(M(5));expect(amount('opening-clearing')).toBe(M(158))
    expect(p.undecided.length).toBe(2);expect(p.canConfirm).toBe(true)
    expect((await t.db.query('select count(*) as n from accounting_journals'))[0]!.n).toBe(journals)
    expect((await call(finance,'POST','/accounting/opening-plan/preview',{ decisions:{} })).status).toBe(403)
  })
  test('confirm refuses a stale plan; decisions zero the clearing; GL cash = cash book; book becomes validated once',async () => {
    const decisions = { invoices:{ [invoice]:'unearned' },vendorInvoices:{ [vinv]:'prepaid' },equity:{ capitalMinor:M(100) } }
    const p = (await post('/accounting/opening-plan/preview',{ decisions },owner))
    expect(p.items.find((i:{ role:string }) => i.role === 'opening-clearing')).toBeUndefined()
    expect(p.items.find((i:{ role:string }) => i.role === 'retained-earnings')).toMatchObject({ side:'debit',amountMinor:M(2) })
    expect((await call(owner,'POST','/accounting/opening-plan/confirm',{ planHash:'0'.repeat(64),decisions,reason:'TEST_ONLY rekening koran 31 Agustus' })).status).toBe(409)
    const ok = await post('/accounting/opening-plan/confirm',{ planHash:p.planHash,decisions,reason:'TEST_ONLY rekening koran 31 Agustus' },owner)
    expect(ok.validated).toBe(true)
    expect(await bal('1100')).toBe(M(118));expect(await bal('1110')).toBe(M(70));expect(await bal('2130')).toBe('-'+M(100));expect(await bal('1130')).toBe(M(40))
    expect(await bal('3190')).toBe('0')
    expect((await t.db.query<{ v:boolean }>('select opening_validated as v from accounting_books'))[0]!.v).toBe(true)
    expect((await call(owner,'POST','/accounting/opening-plan/confirm',{ planHash:p.planHash,decisions,reason:'TEST_ONLY again' })).status).toBe(409)
    const [period] = await t.db.query<{ id:string }>("select id from accounting_periods where starts_on='2026-09-01'")
    const review = (await call(finance,'GET',`/accounting/periods/${period!.id}/review`)).json.data
    expect(review.checks.find((c:{ code:string }) => c.code === 'CASH_MATCH').status).toBe('ok')
  })
  test('after cutover a pre-cutover advance settles the pre-cutover invoice as a delta; delivery earns the deferred revenue',async () => {
    await post(`/finance/receipts/${advance}/allocations`,{ allocations:[{ invoiceId:invoice,amountMinor:M(10) }] })
    expect(await bal('2120')).toBe('0');expect(await bal('1110')).toBe(M(60))
    expect((await call(finance,'GET','/accounting/exceptions')).json.data.length).toBe(0)
    await post('/finance/fulfillments',{ side:'customer',projectId:'PRJ-101',amountMinor:M(100),fulfilledOn:'2026-10-01',evidence:'TEST_ONLY delivered after cutover' })
    expect(await bal('2130')).toBe('0');expect(await bal('4100')).toBe('-'+M(100))
    const tb = (await call(finance,'GET','/accounting/trial-balance?asOf=2026-12-31')).json.data
    expect(tb.balanced).toBe(true)
  })
})
