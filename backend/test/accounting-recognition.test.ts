import { afterAll,beforeAll,describe,expect,test } from 'bun:test'
import { DEMO,makeTestApp,type TestApp } from './helpers'
import { createBook,createPeriod } from '../src/modules/accounting/setup'
import { postBusinessEvent } from '../src/modules/accounting/posting'
import { trialBalance } from '../src/modules/accounting/reads'
import { todayBusinessDate } from '../src/modules/finance/common'

/**
 * Owner accounting acceptance A01/A05/A09 on an isolated TEST_ONLY book. Fixture policies are explicit test
 * choices (principal, recognition on delivery, prepaid supplier invoices) — not the user's company policy (D03/D04 unknown).
 * Amounts: 1 "juta" = 1_000_000 minor.
 */
const M = (n:number) => (BigInt(Math.round(n * 10)) * 100_000n).toString()

describe('accounting recognition, accrual, credit/refund and supplier recovery',() => {
  let t:TestApp,cookie:string,admin:string
  const actor = { userId:'USR-010',role:'super-admin' as const,name:'TEST_ONLY',email:'test@example.invalid',sessionId:'TEST_ONLY',partyId:null,vendorId:null }
  const call = async (method:'POST'|'GET',path:string,body?:unknown,expectOk = true) => {
    const res = await t.call(method,`/api/v1${path}`,{ cookie,body,headers:{ 'idempotency-key':crypto.randomUUID() } })
    if (expectOk) expect(res.status, res.text).toBeLessThan(300)
    return res
  }
  const post = async (path:string,body:unknown) => (await call('POST',`/finance${path}`,body)).json.data
  /** Debit-minus-credit of one account, optionally limited to project dimension and journal date range. */
  const bal = async (code:string,opts:{ project?:string;from?:string;to?:string } = {}) => (await t.db.query<{ b:string }>(`select coalesce(sum(l.debit_minor-l.credit_minor),0) as b
    from accounting_journal_lines l join accounting_journals j on j.id=l.journal_id and j.status='posted'
    where l.account_code=$1 and ($2::text is null or l.project_id=$2) and ($3::date is null or j.effective_date >= $3) and ($4::date is null or j.effective_date <= $4)`,
  [code,opts.project ?? null,opts.from ?? null,opts.to ?? null]))[0]!.b
  const profit = async (from?:string,to?:string) => (await t.db.query<{ p:string }>(`select coalesce(-sum(l.debit_minor-l.credit_minor),0) as p
    from accounting_journal_lines l join accounting_journals j on j.id=l.journal_id and j.status='posted'
    join accounting_accounts a on a.book_id=l.book_id and a.code=l.account_code
    where a.account_type in ('revenue','expense') and ($1::date is null or j.effective_date >= $1) and ($2::date is null or j.effective_date <= $2)`,[from ?? null,to ?? null]))[0]!.p

  beforeAll(async () => {
    t = await makeTestApp();cookie = await t.login(DEMO.finance);admin = await t.login(DEMO.admin)
    const book = await t.db.transaction(tx => createBook(tx,actor,{ name:'TEST_ONLY recognition',purpose:'rehearsal',cutoverDate:'2026-09-01',timezone:'Asia/Jakarta' },'req_fixture_setup','test'))
    await t.db.transaction(tx => createPeriod(tx,actor,{ startsOn:'2026-09-01',endsOn:'2026-09-30',reason:'TEST_ONLY September' },'req_p9'))
    await t.db.transaction(tx => createPeriod(tx,actor,{ startsOn:'2026-10-01',endsOn:'2027-12-31',reason:'TEST_ONLY October onwards' },'req_p10'))
    const recognition:Record<string,string> = { customer_billing:'fulfillment',fulfillment:'fulfillment',vendor_billing:'supplier-fulfillment',supplier_fulfillment:'supplier-fulfillment' }
    const settings:Record<string,unknown> = { customer_billing:{ billingRight:'unconditional' },vendor_billing:{ invoiceTreatment:'prepaid' } }
    for (const kind of ['customer_billing','customer_receipt','customer_allocation','vendor_billing','vendor_payment','vendor_allocation','manual_cash','fulfillment','supplier_fulfillment','refund','supplier_claim']) {
      await t.db.query(`insert into accounting_policies (id,book_id,source_kind,version,effective_from,principal_agent,recognition,tax_treatment,validation_status,settings,rationale,created_by)
        values ($1,$2,$3,1,'2026-09-01','principal',$4,'TEST_ONLY_EXCLUDED','test-only',$5::text::jsonb,'TEST_ONLY fixture, no real company or tax policy',$6)`,
      [`APL-${kind}`,book.id,kind,recognition[kind] ?? 'TEST_ONLY',JSON.stringify(settings[kind] ?? {}),actor.userId])
    }
    await t.db.query(`insert into bank_accounts (id,code,bank_name,holder_name,account_number,opening_status,opening_balance_minor,opening_date,opening_submitted_by,opening_submitted_at,opening_verified_by,opening_verified_at,created_by)
      values ('BA-TEST','TESTBANK','Synthetic','TEST_ONLY','123456','verified',$1,'2026-09-01','USR-001',now(),'USR-010',now(),'USR-010')`,[M(200)])
    await t.db.transaction(tx => postBusinessEvent(tx,actor,{ sourceType:'test_opening',sourceId:'TEST_ONLY_OPENING',sourceVersion:'1',kind:'opening',effectiveDate:'2026-09-01',
      snapshot:{ amountMinor:M(200),testOnly:true },policyKind:'manual_cash',description:'TEST_ONLY opening',
      lines:[{ accountCode:'1100',bankAccountId:'BA-TEST',debitMinor:M(200),creditMinor:'0' },{ accountCode:'3100',debitMinor:'0',creditMinor:M(200) }] },'req_test_opening'))
    await t.db.query("update accounting_books set mode='active',entity_type='TEST_ONLY',accounting_standard='TEST_ONLY',opening_validated=true")
  },60000)
  afterAll(async () => { await t?.cleanup() })

  let invoiceA01:string,depositA01:string
  test('A01 package: billing, DP and deposit before service carry no profit in September',async () => {
    const inv = await post('/customer-invoices',{ projectId:'PRJ-101',invoiceType:'final',dueDate:'2026-10-31',lines:[{ description:'TEST_ONLY paket',amountMinor:M(100) }] })
    invoiceA01 = inv.id
    await post(`/customer-invoices/${inv.id}/issue`,{ issueDate:'2026-09-10' })
    await post('/receipts',{ bankAccountId:'BA-TEST',partyId:'PTY-001',projectId:'PRJ-101',amountMinor:M(30),effectiveDate:'2026-09-12',allocations:[{ invoiceId:inv.id,amountMinor:M(30) }] })
    depositA01 = (await post('/vendor-payments',{ bankAccountId:'BA-TEST',vendorId:'VND-001',projectId:'PRJ-101',amountMinor:M(20),effectiveDate:'2026-09-13' })).transactionId
    expect(await bal('1100')).toBe(M(210));expect(await bal('1110')).toBe(M(70));expect(await bal('1120')).toBe(M(20))
    expect(await bal('2130')).toBe('-'+M(100));expect(await profit('2026-09-01','2026-09-30')).toBe('0')
  })
  test('A01 October delivery: revenue 100 from deferred billing, supplier cost 80 accrued, deposit still an advance',async () => {
    const f = await post('/fulfillments',{ side:'customer',projectId:'PRJ-101',amountMinor:M(100),fulfilledOn:'2026-10-05',evidence:'TEST_ONLY trip delivered per manifest' })
    expect(f.accountingStatus).toBe('posted')
    const s = await post('/fulfillments',{ side:'supplier',projectId:'PRJ-101',vendorId:'VND-001',amountMinor:M(80),fulfilledOn:'2026-10-05',basis:'estimate',isFinal:true,evidence:'TEST_ONLY hotel stayed, invoice pending' })
    expect(s.accountingStatus).toBe('posted')
    expect(await bal('2130')).toBe('0');expect(await bal('4100')).toBe('-'+M(100))
    expect(await bal('5100')).toBe(M(80));expect(await bal('2110')).toBe('-'+M(80));expect(await bal('1120')).toBe(M(20))
    expect(await bal('1100')).toBe(M(210))
  })
  test('A01 supplier invoice replaces the accrual without a second expense; settlements only move cash',async () => {
    const vinv = await post('/vendor-invoices',{ vendorId:'VND-001',projectId:'PRJ-101',vendorInvoiceNumber:'TEST-A01-HOTEL',invoiceDate:'2026-10-08',dueDate:'2026-10-31',totalMinor:M(80) })
    await post(`/vendor-invoices/${vinv.id}/review`,{ action:'approve' })
    expect(await bal('2110')).toBe('0');expect(await bal('2100')).toBe('-'+M(80));expect(await bal('5100')).toBe(M(80))
    await post(`/vendor-payments/${depositA01}/allocations`,{ allocations:[{ vendorInvoiceId:vinv.id,amountMinor:M(20) }] })
    expect(await bal('1120')).toBe('0');expect(await bal('2100')).toBe('-'+M(60))
    await post('/receipts',{ bankAccountId:'BA-TEST',partyId:'PTY-001',projectId:'PRJ-101',amountMinor:M(70),effectiveDate:'2026-10-10',allocations:[{ invoiceId:invoiceA01,amountMinor:M(70) }] })
    await post('/vendor-payments',{ bankAccountId:'BA-TEST',vendorId:'VND-001',projectId:'PRJ-101',amountMinor:M(60),effectiveDate:'2026-10-12',allocations:[{ vendorInvoiceId:vinv.id,amountMinor:M(60) }] })
    expect(await bal('1100')).toBe(M(220));expect(await bal('1110')).toBe('0');expect(await bal('2100')).toBe('0')
    expect(await profit('2026-09-01','2026-09-30')).toBe('0');expect(await profit('2026-10-01','2026-10-31')).toBe(M(20))
    const tb = await trialBalance(t.db,'2026-10-31')
    expect(tb.balanced).toBe(true);expect(tb.netProfitMinor).toBeNull()
  })
  test('A01 variation: supplier invoice before service is prepaid and released on receipt, same end result',async () => {
    const vinv = await post('/vendor-invoices',{ vendorId:'VND-002',projectId:'PRJ-101',vendorInvoiceNumber:'TEST-A01-BUS',invoiceDate:'2026-09-20',dueDate:'2026-10-31',totalMinor:M(8) })
    await post(`/vendor-invoices/${vinv.id}/review`,{ action:'approve' })
    expect(await bal('1130')).toBe(M(8));expect(await profit('2026-09-01','2026-09-30')).toBe('0')
    await post('/fulfillments',{ side:'supplier',projectId:'PRJ-101',vendorId:'VND-002',amountMinor:M(8),fulfilledOn:'2026-10-06',evidence:'TEST_ONLY bus service used' })
    expect(await bal('1130')).toBe('0');expect(await bal('2110')).toBe('0');expect(await bal('5100')).toBe(M(88))
  })
  test('A05: refund of recognised service 10 then paid adjusts revenue once; supplier recovery 4 adjusts cost once',async () => {
    const before = BigInt(await profit())
    const caseRes = await post('/cancellations',{ subjectType:'project',subjectId:'PRJ-101',reason:'TEST_ONLY partial goodwill refund',calculation:'manual',proposedRefundMinor:M(10) })
    expect(await profit()).toBe(before.toString())
    await post(`/refunds/${caseRes.id}/approve`,{ refundMinor:M(10),note:'TEST_ONLY approved' })
    expect(await bal('2150')).toBe('-'+M(10));expect(BigInt(await profit())).toBe(before - BigInt(M(10)))
    // Approval occurred today: a payout cannot be backdated before the obligation was approved.
    await post(`/refunds/${caseRes.id}/settlements`,{ bankAccountId:'BA-TEST',amountMinor:M(10),effectiveDate:todayBusinessDate() })
    expect(await bal('2150')).toBe('0');expect(BigInt(await profit())).toBe(before - BigInt(M(10)))
    const claim = await post('/supplier-claims',{ vendorId:'VND-001',projectId:'PRJ-101',basis:'cost-recovery',amountMinor:M(4),recognizedOn:'2026-10-15',reason:'TEST_ONLY hotel compensation' })
    expect(claim.accountingStatus).toBe('posted');expect(await bal('1150')).toBe(M(4))
    await post('/vendor-refunds',{ bankAccountId:'BA-TEST',claimId:claim.id,amountMinor:M(4),effectiveDate:'2026-10-16' })
    expect(await bal('1150')).toBe('0')
    // A01 alone: profit 20, bank 220 (the A01 variation added cost 8, no cash).
    expect(BigInt(await profit())).toBe(before - BigInt(M(10)) + BigInt(M(4)))
    expect(await bal('1100')).toBe(M(214))
    expect((await call('POST','/finance/vendor-refunds',{ bankAccountId:'BA-TEST',claimId:claim.id,amountMinor:'1',effectiveDate:'2026-10-16' },false)).status).toBe(400)
  })
  test('deposit recovery reclasses the advance, frees it again on void; reversing a funded deposit is refused',async () => {
    const dep = (await post('/vendor-payments',{ bankAccountId:'BA-TEST',vendorId:'VND-002',amountMinor:M(5),effectiveDate:'2026-10-14' })).transactionId
    const claim = await post('/supplier-claims',{ vendorId:'VND-002',basis:'deposit-recovery',sourcePaymentId:dep,amountMinor:M(5),recognizedOn:'2026-10-15',reason:'TEST_ONLY trip cancelled, deposit back' })
    expect(await bal('1120')).toBe('0');expect(await bal('1150')).toBe(M(5))
    const [u] = await t.db.query<{ u:string }>('select unallocated_minor as u from v_unallocated_payments where transaction_id=$1',[dep])
    expect(u!.u).toBe('0')
    const rev = await call('POST',`/finance/transactions/${dep}/reverse`,{ reason:'TEST_ONLY should be refused' },false)
    expect(rev.status).toBe(422)
    await post(`/supplier-claims/${claim.id}/void`,{ reason:'TEST_ONLY supplier keeps the deposit' })
    expect(await bal('1120')).toBe(M(5));expect(await bal('1150')).toBe('0')
    const [u2] = await t.db.query<{ u:string }>('select unallocated_minor as u from v_unallocated_payments where transaction_id=$1',[dep])
    expect(u2!.u).toBe(M(5))
  })
  test('A09: delivery before billing is a contract asset; invoice reclasses it; partial periods; cumulative right enforced',async () => {
    await post('/fulfillments',{ side:'customer',projectId:'PRJ-205',amountMinor:M(40),fulfilledOn:'2026-09-25',evidence:'TEST_ONLY first leg delivered' })
    expect(await bal('1180',{ project:'PRJ-205' })).toBe(M(40));expect(await bal('4100',{ project:'PRJ-205',to:'2026-09-30' })).toBe('-'+M(40))
    const inv = await post('/customer-invoices',{ projectId:'PRJ-205',invoiceType:'final',dueDate:'2026-11-30',lines:[{ description:'TEST_ONLY trip',amountMinor:M(100) }] })
    await post(`/customer-invoices/${inv.id}/issue`,{ issueDate:'2026-10-02' })
    expect(await bal('1180',{ project:'PRJ-205' })).toBe('0');expect(await bal('1110',{ project:'PRJ-205' })).toBe(M(100))
    expect(await bal('2130',{ project:'PRJ-205' })).toBe('-'+M(60));expect(await bal('4100',{ project:'PRJ-205' })).toBe('-'+M(40))
    await post('/fulfillments',{ side:'customer',projectId:'PRJ-205',amountMinor:M(60),fulfilledOn:'2026-10-09',evidence:'TEST_ONLY second leg delivered' })
    expect(await bal('4100',{ project:'PRJ-205',from:'2026-10-01' })).toBe('-'+M(60));expect(await bal('2130',{ project:'PRJ-205' })).toBe('0')
    const over = await call('POST','/finance/fulfillments',{ side:'customer',projectId:'PRJ-205',amountMinor:'1',fulfilledOn:'2026-10-09',evidence:'TEST_ONLY over-recognition' },false)
    expect(over.status).toBe(400)
    await expect(t.db.query(`insert into service_fulfillments (id,side,project_id,party_id,amount_minor,fulfilled_on,evidence,created_by)
      values ('SFL-BYPASS','customer','PRJ-205','PTY-009',1,'2026-10-09','TEST_ONLY bypass','USR-010')`)).rejects.toThrow('contractual right')
  })
  test('credit note on deferred billing reduces liability not revenue; void reverses exactly; fulfillment void reverses revenue',async () => {
    const inv = await post('/customer-invoices',{ projectId:'PRJ-102',invoiceType:'dp',dueDate:'2026-11-30',lines:[{ description:'TEST_ONLY DP',amountMinor:M(50) }] })
    await post(`/customer-invoices/${inv.id}/issue`,{ issueDate:'2026-10-03' })
    const revenueBefore = await bal('4100')
    const cn = await post('/credit-notes',{ invoiceId:inv.id,amountMinor:M(20),reason:'TEST_ONLY price correction' })
    expect(await bal('1110',{ project:'PRJ-102' })).toBe(M(30));expect(await bal('2130',{ project:'PRJ-102' })).toBe('-'+M(30));expect(await bal('4100')).toBe(revenueBefore)
    await post(`/credit-notes/${cn.id}/void`,{ reason:'TEST_ONLY credit issued in error' })
    expect(await bal('1110',{ project:'PRJ-102' })).toBe(M(50));expect(await bal('2130',{ project:'PRJ-102' })).toBe('-'+M(50))
    const f = await post('/fulfillments',{ side:'customer',projectId:'PRJ-102',amountMinor:M(10),fulfilledOn:'2026-10-04',evidence:'TEST_ONLY visa service delivered' })
    expect(await bal('4100',{ project:'PRJ-102' })).toBe('-'+M(10))
    await post(`/fulfillments/${f.id}/void`,{ reason:'TEST_ONLY recorded on wrong project' })
    expect(await bal('4100',{ project:'PRJ-102' })).toBe('0');expect(await bal('2130',{ project:'PRJ-102' })).toBe('-'+M(50))
    await expect(t.db.query("update service_fulfillments set amount_minor=1 where id=$1",[f.id])).rejects.toThrow('immutable')
  })
  test('debit note on an active book posts AR/deferral in the same transaction',async () => {
    const [origin] = await t.db.query<{ id:string }>("select id from customer_invoices where project_id='PRJ-102' and status='issued' limit 1")
    const dn = await post(`/customer-invoices/${origin!.id}/debit-notes`,{ amountMinor:M(1),reason:'TEST_ONLY extra room',dueDate:'2026-12-31' })
    const status = await call('GET',`/accounting/sources/customer_invoice/${dn.id}`)
    expect(status.json.data.status).toBe('posted')
  })
  test('A10 B2C standalone: order DP posts AR/deferral on the order (no project); delivery recognises revenue on the order',async () => {
    const dp = await post('/sales-orders/SLO-001/confirm-dp',{ bankAccountId:'BA-TEST',dpAmountMinor:M(6),effectiveDate:'2026-10-11',dueDate:'2026-10-31' })
    const order = async (code:string) => (await t.db.query<{ b:string }>(`select coalesce(sum(l.debit_minor-l.credit_minor),0) as b from accounting_journal_lines l
      join accounting_journals j on j.id=l.journal_id and j.status='posted' where l.account_code=$1 and l.sales_order_id='SLO-001'`,[code]))[0]!.b
    expect(await order('1110')).toBe(M(12.5));expect(await order('2130')).toBe('-'+M(18.5))
    expect((await t.db.query("select count(*) as n from accounting_journal_lines where sales_order_id='SLO-001' and project_id is not null"))[0]!.n).toBe('0')
    expect(dp.invoiceId).toBeTruthy()
    await post('/fulfillments',{ side:'customer',salesOrderId:'SLO-001',amountMinor:M(18.5),fulfilledOn:'2026-10-12',evidence:'TEST_ONLY Bali trip delivered' })
    expect(await order('2130')).toBe('0');expect(await order('4100')).toBe('-'+M(18.5))
  })
  test('project accounting summary: recognised result per project, statuses kept apart, Admin has no amounts',async () => {
    const s = (await call('GET','/accounting/projects/PRJ-101/summary')).json.data
    expect(s.available).toBe(true)
    expect(s.figures.recognizedRevenueMinor).toBe((-BigInt(await bal('4100',{ project:'PRJ-101' }))).toString())
    expect(s.figures.recognizedDirectCostMinor).toBe(await bal('5100',{ project:'PRJ-101' }))
    expect(BigInt(s.figures.contributionMinor)).toBe(BigInt(s.figures.recognizedRevenueMinor) - BigInt(s.figures.recognizedDirectCostMinor))
    expect(s.status).toMatchObject({ cashSettled:false })
    expect((await t.call('GET','/api/v1/accounting/projects/PRJ-101/summary',{ cookie:admin })).status).toBe(403)
    expect((await call('GET','/accounting/projects/PRJ-NOPE/summary',undefined,false)).status).toBe(404)
  })
  test('A12 reports: P&L = ledger, balance sheet balances with result once, contribution reconciles, no after-tax claim',async () => {
    const pl = (await call('GET','/accounting/reports/profit-loss?from=2026-09-01&to=2026-12-31')).json.data
    expect(pl.available).toBe(true);expect(pl.netProfitMinor).toBeNull()
    expect(pl.reasons.map((r:{ code:string }) => r.code)).toEqual(expect.arrayContaining(['REHEARSAL_ONLY','TAX_PROFILE_INCOMPLETE']))
    expect(pl.profitBeforeTaxMinor).toBe(await profit('2026-09-01','2026-12-31'))
    expect(BigInt(pl.revenue.totalMinor) - BigInt(pl.directCost.totalMinor)).toBe(BigInt(pl.grossProfitMinor))
    const sep = (await call('GET','/accounting/reports/profit-loss?from=2026-09-01&to=2026-09-30')).json.data
    expect(sep.profitBeforeTaxMinor).toBe(await profit('2026-09-01','2026-09-30'))
    const bs = (await call('GET','/accounting/reports/balance-sheet?asOf=2026-12-31')).json.data
    expect(bs.balanced).toBe(true);expect(bs.currentResultMinor).toBe(pl.profitBeforeTaxMinor)
    expect(bs.assets.lines.find((l:{ code:string }) => l.code === '1100').amountMinor).toBe(await bal('1100'))
    const pc = (await call('GET','/accounting/reports/project-contribution?from=2026-09-01&to=2026-12-31')).json.data
    expect(pc.totalMinor).toBe(pl.profitBeforeTaxMinor)
    const prj101 = pc.items.find((i:{ projectId:string }) => i.projectId === 'PRJ-101')
    expect(BigInt(prj101.revenueMinor)).toBe(-BigInt(await bal('4100',{ project:'PRJ-101' })))
    const before = (await call('GET','/accounting/reports/profit-loss?from=2026-08-01&to=2026-08-31')).json.data
    expect(before.available).toBe(false);expect(before.profitBeforeTaxMinor).toBeNull()
    expect((await call('GET','/accounting/reports/profit-loss?from=2026-10-31&to=2026-10-01',undefined,false)).status).toBe(400)
    expect((await t.call('GET','/api/v1/accounting/reports/balance-sheet?asOf=2026-12-31',{ cookie:admin })).status).toBe(403)
    expect((await t.call('GET','/api/v1/accounting/reports/balance-sheet?asOf=2026-12-31')).status).toBe(401)
  })
  test('unknown recognition policy keeps the fact out of an active book (rollback); access is scoped',async () => {
    await t.db.query(`insert into accounting_policies (id,book_id,source_kind,version,effective_from,principal_agent,recognition,tax_treatment,rationale,created_by)
      select 'APL-fulfillment-v2',id,'fulfillment',2,'2026-10-01','unknown','unknown','unknown','TEST_ONLY undecided D03/D04','USR-010' from accounting_books`)
    const res = await call('POST','/finance/fulfillments',{ side:'customer',projectId:'PRJ-102',amountMinor:M(1),fulfilledOn:'2026-10-05',evidence:'TEST_ONLY policy unknown' },false)
    expect(res.status).toBe(422);expect(res.json.error.code).toBe('ACCOUNTING_POLICY_REQUIRED')
    expect((await t.db.query("select id from service_fulfillments where project_id='PRJ-102' and status='recorded'")).length).toBe(0)
    expect((await t.call('POST','/api/v1/finance/fulfillments',{ body:{ side:'customer',projectId:'PRJ-102',amountMinor:'1',fulfilledOn:'2026-10-05',evidence:'TEST_ONLY' },headers:{ 'idempotency-key':'anon' } })).status).toBe(401)
    expect((await t.call('POST','/api/v1/finance/fulfillments',{ cookie:admin,body:{ side:'customer',projectId:'PRJ-102',amountMinor:'1',fulfilledOn:'2026-10-05',evidence:'TEST_ONLY' },headers:{ 'idempotency-key':'admin' } })).status).toBe(403)
    expect((await t.call('GET','/api/v1/finance/fulfillments?projectId=PRJ-101',{ cookie:admin })).status).toBe(403)
    expect((await call('GET','/finance/fulfillments?projectId=PRJ-NOPE',undefined,false)).status).toBe(404)
    const overview = (await call('GET','/finance/fulfillments?projectId=PRJ-101')).json.data
    expect(overview.contract.recognizedMinor).toBe(M(100));expect(overview.items.length).toBeGreaterThan(0)
  })
})
