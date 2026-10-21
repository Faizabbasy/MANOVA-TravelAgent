import { afterAll,beforeAll,describe,expect,test } from 'bun:test'
import { DEMO,makeTestApp,type TestApp } from './helpers'
import { createBook,createPeriod } from '../src/modules/accounting/setup'
import { postBusinessEvent } from '../src/modules/accounting/posting'
import { depreciationFor } from '../src/modules/finance/funding'

/** Owner accounting F6 / A07 on an isolated TEST_ONLY book. Owner-fund treatment is an explicit fixture choice, not the user's entity profile. */
const M = (n:number) => (BigInt(n) * 1_000_000n).toString()

describe('assets, loans and owner funds',() => {
  let t:TestApp,cookie:string,admin:string,loanId:string
  const actor = { userId:'USR-010',role:'super-admin' as const,name:'TEST_ONLY',email:'test@example.invalid',sessionId:'TEST_ONLY',partyId:null,vendorId:null }
  const call = (method:'POST'|'GET',path:string,body?:unknown,key:string = crypto.randomUUID()) => t.call(method,`/api/v1${path}`,{ cookie,body,headers:{ 'idempotency-key':key } })
  const post = async (path:string,body:unknown,key?:string) => {
    const res = await call('POST',path,body,key)
    expect(res.status, res.text).toBeLessThan(300)
    return res.json.data
  }
  const bal = async (code:string) => (await t.db.query<{ b:string }>(`select coalesce(sum(l.debit_minor-l.credit_minor),0) as b
    from accounting_journal_lines l join accounting_journals j on j.id=l.journal_id and j.status='posted' where l.account_code=$1`,[code]))[0]!.b
  const profit = async () => (await t.db.query<{ p:string }>(`select coalesce(-sum(l.debit_minor-l.credit_minor),0) as p from accounting_journal_lines l
    join accounting_journals j on j.id=l.journal_id and j.status='posted' join accounting_accounts a on a.book_id=l.book_id and a.code=l.account_code
    where a.account_type in ('revenue','expense')`))[0]!.p

  beforeAll(async () => {
    t = await makeTestApp();cookie = await t.login(DEMO.finance);admin = await t.login(DEMO.admin)
    const book = await t.db.transaction(tx => createBook(tx,actor,{ name:'TEST_ONLY funding',purpose:'rehearsal',cutoverDate:'2026-08-01',timezone:'Asia/Jakarta' },'req_fixture_setup','test'))
    await t.db.transaction(tx => createPeriod(tx,actor,{ startsOn:'2026-08-01',endsOn:'2027-12-31',reason:'TEST_ONLY window' },'req_period'))
    for (const [kind,settings] of [['manual_cash',{}],['asset',{}],['loan',{}],['owner_funds',{ contributionRole:'capital',withdrawalRole:'owner-funds' }]] as const) {
      await t.db.query(`insert into accounting_policies (id,book_id,source_kind,version,effective_from,principal_agent,recognition,tax_treatment,validation_status,settings,rationale,created_by)
        values ($1,$2,$3,1,'2026-08-01','not-applicable','TEST_ONLY','TEST_ONLY_EXCLUDED','test-only',$4::text::jsonb,'TEST_ONLY fixture, no real entity profile',$5)`,
      [`APL-${kind}`,book.id,kind,JSON.stringify(settings),actor.userId])
    }
    await t.db.query(`insert into bank_accounts (id,code,bank_name,holder_name,account_number,opening_status,opening_balance_minor,opening_date,opening_submitted_by,opening_submitted_at,opening_verified_by,opening_verified_at,created_by)
      values ('BA-TEST','TESTBANK','Synthetic','TEST_ONLY','123456','verified',$1,'2026-08-01','USR-001',now(),'USR-010',now(),'USR-010')`,[M(100)])
    await t.db.transaction(tx => postBusinessEvent(tx,actor,{ sourceType:'test_opening',sourceId:'TEST_ONLY_OPENING',sourceVersion:'1',kind:'opening',effectiveDate:'2026-08-01',
      snapshot:{ amountMinor:M(100),testOnly:true },policyKind:'manual_cash',description:'TEST_ONLY opening',
      lines:[{ accountCode:'1100',bankAccountId:'BA-TEST',debitMinor:M(100),creditMinor:'0' },{ accountCode:'3100',debitMinor:'0',creditMinor:M(100) }] },'req_test_opening'))
    await t.db.query("update accounting_books set mode='active',entity_type='TEST_ONLY',accounting_standard='TEST_ONLY',opening_validated=true")
  },60000)
  afterAll(async () => { await t?.cleanup() })

  test('straight-line schedule is exact in minor units and sums to cost − residual',() => {
    let total = 0n
    for (let i = 0; i < 7; i++) total += depreciationFor(1000n,1n,7,i)
    expect(total).toBe(999n);expect(depreciationFor(1000n,1n,7,0)).toBe(142n);expect(depreciationFor(1000n,1n,7,6)).toBe(147n)
    expect(depreciationFor(1000n,0n,7,7)).toBe(0n)
  })
  test('A07: buying an asset for 12 is not an expense; depreciation books each asset-month once, retries add nothing',async () => {
    const bought = await post('/finance/assets/AST-001/purchase',{ bankAccountId:'BA-TEST',costMinor:M(12),acquiredOn:'2026-08-05',usefulLifeMonths:12 })
    expect(await bal('1200')).toBe(M(12));expect(await bal('1100')).toBe(M(88));expect(await profit()).toBe('0')
    expect((await call('POST','/finance/assets/AST-001/purchase',{ bankAccountId:'BA-TEST',costMinor:M(12),acquiredOn:'2026-08-05',usefulLifeMonths:12 })).status).toBe(422)
    const run = await post('/finance/depreciation-runs',{ throughPeriod:'2026-09' },'dep-run-sep')
    expect(run.booked.length).toBe(2)
    expect(await bal('6140')).toBe(M(2));expect(await bal('1210')).toBe('-'+M(2))
    expect((await post('/finance/depreciation-runs',{ throughPeriod:'2026-09' },'dep-run-sep')).booked.length).toBe(2)
    expect((await post('/finance/depreciation-runs',{ throughPeriod:'2026-09' })).booked.length).toBe(0)
    expect(await bal('6140')).toBe(M(2))
    expect((await call('POST','/finance/depreciation-runs',{ throughPeriod:'2099-01' })).status).toBe(400)
    expect((await call('POST',`/finance/transactions/${bought.transactionId}/reverse`,{ reason:'TEST_ONLY should be refused' })).status).toBe(422)
    await expect(t.db.transaction(tx => tx.query("insert into asset_depreciations (asset_id,period,amount_minor,created_by) values ('AST-001','2026-10',1,'USR-010')"))).rejects.toThrow('depreciation posting missing')
    const overview = (await call('GET','/finance/funding')).json.data
    expect(overview.assets[0]).toMatchObject({ assetId:'AST-001',accumulatedMinor:M(2),bookValueMinor:M(10) })
  })
  test('A07: loan 50 is not revenue; instalment principal 5 + interest 1 = cash −6, loan −5, expense 1',async () => {
    const before = BigInt(await profit())
    const loan = await post('/finance/loans',{ lender:'TEST_ONLY Bank',principalMinor:M(50),receivedOn:'2026-09-01',terms:'TEST_ONLY 10 bulan, bunga tetap',bankAccountId:'BA-TEST' })
    loanId = loan.id
    expect(await bal('2190')).toBe('-'+M(50));expect(BigInt(await profit())).toBe(before)
    const cashBefore = BigInt(await bal('1100'))
    const r = await post(`/finance/loans/${loanId}/repayments`,{ bankAccountId:'BA-TEST',principalMinor:M(5),interestMinor:M(1),effectiveDate:'2026-10-01' })
    expect(r.outstandingMinor).toBe(M(45))
    expect(BigInt(await bal('1100'))).toBe(cashBefore - BigInt(M(6)));expect(await bal('2190')).toBe('-'+M(45));expect(await bal('6150')).toBe(M(1))
    expect(BigInt(await profit())).toBe(before - BigInt(M(1)))
    expect((await call('POST',`/finance/loans/${loanId}/repayments`,{ bankAccountId:'BA-TEST',principalMinor:M(46),interestMinor:'0',effectiveDate:'2026-10-02' })).status).toBe(400)
    expect((await call('POST',`/finance/transactions/${loan.transactionId}/reverse`,{ reason:'TEST_ONLY has repayments' })).status).toBe(422)
    const rev = await call('POST',`/finance/transactions/${r.transactionId}/reverse`,{ reason:'TEST_ONLY wrong account' })
    expect(rev.status, rev.text).toBe(201)
    expect(await bal('2190')).toBe('-'+M(50));expect(await bal('6150')).toBe('0')
  })
  test('A07: owner contribution is equity per profile, withdrawal is not an expense; unknown treatment rolls back',async () => {
    const before = BigInt(await profit())
    await post('/finance/owner-funds/contributions',{ bankAccountId:'BA-TEST',amountMinor:M(20),effectiveDate:'2026-10-05' })
    await post('/finance/owner-funds/withdrawals',{ bankAccountId:'BA-TEST',amountMinor:M(3),effectiveDate:'2026-10-06' })
    expect(await bal('3100')).toBe('-'+M(120));expect(await bal('3120')).toBe(M(3));expect(BigInt(await profit())).toBe(before)
    await t.db.query(`insert into accounting_policies (id,book_id,source_kind,version,effective_from,principal_agent,recognition,tax_treatment,rationale,created_by)
      select 'APL-owner-v2',id,'owner_funds',2,'2026-10-07','unknown','unknown','unknown','TEST_ONLY undecided entity form','USR-010' from accounting_books`)
    const res = await call('POST','/finance/owner-funds/contributions',{ bankAccountId:'BA-TEST',amountMinor:M(1),effectiveDate:'2026-10-08' })
    expect(res.status).toBe(422)
    expect((await t.db.query("select id from financial_transactions where kind='owner_contribution' and effective_date='2026-10-08'")).length).toBe(0)
    const bs = (await call('GET','/accounting/reports/balance-sheet?asOf=2026-12-31')).json.data
    expect(bs.balanced).toBe(true)
    expect((await t.call('GET','/api/v1/finance/funding',{ cookie:admin })).status).toBe(403)
    expect((await t.call('POST','/api/v1/finance/loans',{ cookie:admin,body:{},headers:{ 'idempotency-key':'admin-loan' } })).status).toBe(403)
  })
})
