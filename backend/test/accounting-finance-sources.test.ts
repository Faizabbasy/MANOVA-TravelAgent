import { afterAll,beforeAll,describe,expect,test } from 'bun:test'
import { DEMO,makeTestApp,type TestApp } from './helpers'
import { createBook,createPeriod } from '../src/modules/accounting/setup'
import { postBusinessEvent } from '../src/modules/accounting/posting'
import { postCashSource } from '../src/modules/accounting/cash-source'
import { trialBalance } from '../src/modules/accounting/reads'

describe('accounting derives existing Finance without duplicate cash',() => {
  let t:TestApp,cookie:string,invoiceA:string,invoiceB:string,receiptB:string,vendorInvoice:string
  const actor = { userId:'USR-010',role:'super-admin' as const,name:'TEST_ONLY',email:'test@example.invalid',sessionId:'TEST_ONLY',partyId:null,vendorId:null }
  const post = async (path:string,body:unknown,key?:string) => {
    const res = await t.call('POST',`/api/v1/finance${path}`,{ cookie,body,headers:{ 'idempotency-key':key ?? crypto.randomUUID() } })
    expect(res.status, res.text).toBeLessThan(300)
    return res.json.data
  }
  const amount = async (code:string) => (await t.db.query<{ balance:string }>(`select coalesce(sum(debit_minor-credit_minor),0) as balance
    from accounting_journal_lines where account_code=$1`,[code]))[0]!.balance
  beforeAll(async () => {
    t = await makeTestApp();cookie = await t.login(DEMO.finance)
    const book = await t.db.transaction(tx => createBook(tx,actor,{ name:'TEST_ONLY A03',purpose:'rehearsal',cutoverDate:'2026-09-01',timezone:'Asia/Jakarta' },'req_fixture_setup','test'))
    await t.db.transaction(tx => createPeriod(tx,actor,{ startsOn:'2026-09-01',endsOn:'2027-12-31',reason:'TEST_ONLY fixture window' },'req_fixture_period'))
    const settings:Record<string,unknown> = { customer_billing:{ billingRight:'unconditional' },vendor_billing:{ invoiceTreatment:'prepaid' } }
    for (const kind of ['customer_billing','customer_receipt','customer_allocation','vendor_billing','vendor_payment','vendor_allocation','manual_cash']) {
      await t.db.query(`insert into accounting_policies (id,book_id,source_kind,version,effective_from,principal_agent,recognition,tax_treatment,validation_status,settings,rationale,created_by)
        values ($1,$2,$3,1,'2026-09-01','principal',$4,'TEST_ONLY_EXCLUDED','test-only',$5::text::jsonb,'TEST_ONLY no real company or tax policy',$6)`,
        [`APL-${kind}`,book.id,kind,kind === 'customer_billing' ? 'fulfillment' : kind === 'vendor_billing' ? 'supplier-fulfillment' : 'TEST_ONLY',JSON.stringify(settings[kind] ?? {}),actor.userId])
    }
    await t.db.query(`insert into bank_accounts (id,code,bank_name,holder_name,account_number,opening_status,opening_balance_minor,opening_date,opening_submitted_by,opening_submitted_at,opening_verified_by,opening_verified_at,created_by)
      values ('BA-TEST','TESTBANK','Synthetic','TEST_ONLY','123456','verified',200000000,'2026-09-01','USR-001',now(),'USR-010',now(),'USR-010')`)
    await t.db.transaction(tx => postBusinessEvent(tx,actor,{ sourceType:'test_opening',sourceId:'TEST_ONLY_OPENING',sourceVersion:'1',kind:'opening',effectiveDate:'2026-09-01',snapshot:{ amountMinor:'200000000',testOnly:true },
      policyKind:'manual_cash',description:'TEST_ONLY opening, no cash replay',lines:[{ accountCode:'1100',bankAccountId:'BA-TEST',debitMinor:'200000000',creditMinor:'0' },{ accountCode:'3100',debitMinor:'0',creditMinor:'200000000' }] },'req_test_opening'))
    await t.db.query("update accounting_books set mode='active',entity_type='TEST_ONLY',accounting_standard='TEST_ONLY',opening_validated=true")
  },60000)
  afterAll(async () => { await t?.cleanup() })

  test('invoice 100 before receipt 30: AR 70, contract liability 100, no revenue; retries reuse the same source cash',async () => {
    const inv = await post('/customer-invoices',{ projectId:'PRJ-201',invoiceType:'final',dueDate:'2026-10-31',lines:[{ description:'TEST_ONLY trip',amountMinor:'100000000' }] })
    invoiceA = inv.id
    await post(`/customer-invoices/${invoiceA}/issue`,{ issueDate:'2026-09-10' })
    expect(await amount('1110')).toBe('100000000');expect(await amount('2130')).toBe('-100000000')
    const body = { bankAccountId:'BA-TEST',partyId:'PTY-005',projectId:'PRJ-201',amountMinor:'30000000',effectiveDate:'2026-09-12',allocations:[{ invoiceId:invoiceA,amountMinor:'30000000' }] }
    const r = await post('/receipts',body,'test-receipt-same-request')
    expect((await post('/receipts',body,'test-receipt-same-request')).transactionId).toBe(r.transactionId)
    await t.db.transaction(tx => postCashSource(tx,actor,r.transactionId,'req_second_business_key'))
    expect((await t.db.query('select id from financial_transactions')).length).toBe(1)
    expect(await amount('1100')).toBe('230000000');expect(await amount('1110')).toBe('70000000')
    expect(await amount('2120')).toBe('0');expect(await amount('2130')).toBe('-100000000');expect(await amount('4100')).toBe('0')
    const status = await t.call('GET',`/api/v1/accounting/sources/financial_transaction/${r.transactionId}`,{ cookie })
    expect(status.status).toBe(200);expect(status.json.data.status).toBe('posted');expect(status.json.data.journals.length).toBe(1)
  })
  test('supplier deposit 20 and prepaid invoice 80: remaining AP 60, no duplicate cash or expense on allocation',async () => {
    const payment = await post('/vendor-payments',{ bankAccountId:'BA-TEST',vendorId:'VND-001',projectId:'PRJ-201',amountMinor:'20000000',effectiveDate:'2026-09-13' })
    expect(await amount('1120')).toBe('20000000');expect(await amount('5100')).toBe('0')
    const inv = await post('/vendor-invoices',{ vendorId:'VND-001',projectId:'PRJ-201',vendorInvoiceNumber:'TEST-ONLY-VENDOR-1',invoiceDate:'2026-09-14',dueDate:'2026-10-31',totalMinor:'80000000' })
    vendorInvoice = inv.id
    await post(`/vendor-invoices/${inv.id}/review`,{ action:'approve' })
    expect(await amount('1130')).toBe('80000000');expect(await amount('2100')).toBe('-80000000')
    await post(`/vendor-payments/${payment.transactionId}/allocations`,{ allocations:[{ vendorInvoiceId:inv.id,amountMinor:'20000000' }] })
    expect(await amount('1120')).toBe('0');expect(await amount('2100')).toBe('-60000000');expect(await amount('1100')).toBe('210000000')
    expect(await amount('5100')).toBe('0')
    expect((await t.db.query('select id from financial_transactions')).length).toBe(2)
  })
  test('receipt 30 before second invoice 100 reaches the SAME AR/liability position, never liability 130',async () => {
    const r = await post('/receipts',{ bankAccountId:'BA-TEST',partyId:'PTY-005',projectId:'PRJ-201',amountMinor:'30000000',effectiveDate:'2026-09-15' })
    receiptB = r.transactionId
    expect(await amount('2120')).toBe('-30000000')
    const inv = await post('/customer-invoices',{ projectId:'PRJ-201',invoiceType:'final',dueDate:'2026-10-31',lines:[{ description:'TEST_ONLY second equivalent trip',amountMinor:'100000000' }] })
    invoiceB = inv.id
    await post(`/customer-invoices/${inv.id}/issue`,{ issueDate:'2026-09-16' })
    await post(`/receipts/${r.transactionId}/allocations`,{ allocations:[{ invoiceId:inv.id,amountMinor:'30000000' }] })
    expect(await amount('1110')).toBe('140000000');expect(await amount('2120')).toBe('0');expect(await amount('2130')).toBe('-200000000')
    expect(await amount('4100')).toBe('0');expect(await amount('1100')).toBe('240000000')
    const [counts] = await t.db.query<{ cash:string;allocations:string }>('select (select count(*) from financial_transactions) as cash,(select count(*) from payment_allocations) as allocations')
    expect(counts).toEqual({ cash:'3',allocations:'3' })
  })
  test('reversing receipt also reverses its allocation; invoice void reverses billing once without removing cash evidence',async () => {
    await post(`/transactions/${receiptB}/reverse`,{ reason:'TEST_ONLY receipt correction' })
    expect(await amount('1100')).toBe('210000000');expect(await amount('1110')).toBe('170000000');expect(await amount('2120')).toBe('0')
    await post(`/customer-invoices/${invoiceB}/void`,{ reason:'TEST_ONLY invoice correction' })
    expect(await amount('1110')).toBe('70000000');expect(await amount('2130')).toBe('-100000000')
    expect((await t.db.query('select id from financial_transactions')).length).toBe(4)
    const tb = await trialBalance(t.db,'2027-12-31')
    expect(tb.balanced).toBe(true);expect(tb.netProfitMinor).toBeNull()
    const [cash] = await t.db.query<{ cash:string }>(`select (200000000 + coalesce(sum(case when direction='in' then amount_minor else -amount_minor end),0)) as cash from financial_transactions where bank_account_id='BA-TEST'`)
    expect(await amount('1100')).toBe(cash!.cash)
    const [ar] = await t.db.query<{ ar:string }>(`select sum(b.total_minor-b.paid_minor-b.credited_minor) as ar from v_customer_invoice_balances b
      join customer_invoices i on i.id=b.invoice_id and i.status='issued' where b.invoice_id in ($1,$2)`,[invoiceA,invoiceB])
    expect(await amount('1110')).toBe(ar!.ar)
    const [ap] = await t.db.query<{ ap:string }>('select (total_minor-paid_minor) as ap from v_vendor_invoice_balances where vendor_invoice_id=$1',[vendorInvoice])
    expect(await amount('2100')).toBe((-BigInt(ap!.ap)).toString())
  })
  test('unknown policy revision rolls back invoice issuance; credit without a refund policy and direct SQL credit cannot bypass the active book',async () => {
    const inv = await post('/customer-invoices',{ projectId:'PRJ-201',invoiceType:'other',dueDate:'2026-10-31',lines:[{ description:'Pending policy case',amountMinor:'1000' }] })
    await t.db.query(`insert into accounting_policies (id,book_id,source_kind,version,effective_from,principal_agent,recognition,tax_treatment,rationale,created_by)
      select 'APL-blocking-revision',id,'customer_billing',2,'2026-09-01','unknown','unknown','unknown','TEST_ONLY blocking revision','USR-010' from accounting_books`)
    const fail = await t.call('POST',`/api/v1/finance/customer-invoices/${inv.id}/issue`,{ cookie,body:{ issueDate:'2026-09-20' } })
    expect(fail.status).toBe(422)
    expect((await t.db.query<{ status:string }>('select status from customer_invoices where id=$1',[inv.id]))[0]!.status).toBe('draft')
    const cn = await t.call('POST','/api/v1/finance/credit-notes',{ cookie,body:{ invoiceId:invoiceA,amountMinor:'1',reason:'TEST_ONLY credit' } })
    expect(cn.status).toBe(422);expect(cn.json.error.code).toBe('ACCOUNTING_POLICY_REQUIRED')
    expect((await t.db.query('select id from credit_notes')).length).toBe(0)
    await expect(t.db.transaction(tx => tx.query(`insert into credit_notes (customer_invoice_id,amount_minor,reason,created_by) values ($1,1,'TEST_ONLY bypass','USR-010')`,[invoiceA]))).rejects.toThrow('Mandatory accounting posting missing')
    expect((await t.call('GET','/api/v1/accounting/sources/customer_invoice/not-here',{ cookie })).status).toBe(404)
    const admin = await t.login(DEMO.admin)
    expect((await t.call('GET',`/api/v1/accounting/sources/customer_invoice/${invoiceA}`,{ cookie:admin })).status).toBe(403)
  })
  test('new cash before cutover cannot bypass accounting even when the bank opening is earlier',async () => {
    await t.db.query(`insert into bank_accounts (id,code,bank_name,holder_name,account_number,opening_status,opening_balance_minor,opening_date,opening_submitted_by,opening_submitted_at,opening_verified_by,opening_verified_at,created_by)
      values ('BA-OLDER','TESTOLDER','Synthetic','TEST_ONLY','1234567','verified',1000,'2026-08-01','USR-001',now(),'USR-010',now(),'USR-010')`)
    const result = await t.call('POST','/api/v1/finance/receipts',{ cookie,headers:{ 'idempotency-key':'before-cutover-rejected' },body:{ bankAccountId:'BA-OLDER',partyId:'PTY-005',amountMinor:'10',effectiveDate:'2026-08-31' } })
    expect(result.status).toBe(422);expect(result.json.error.code).toBe('ACCOUNTING_REVIEW_REQUIRED')
    expect((await t.db.query("select id from financial_transactions where bank_account_id='BA-OLDER'")).length).toBe(0)
  })
})
