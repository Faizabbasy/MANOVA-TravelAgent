import { afterAll,beforeAll,describe,expect,test } from 'bun:test'
import { DEMO,makeTestApp,type TestApp } from './helpers'
import { createBook,createPeriod } from '../src/modules/accounting/setup'
import { postBusinessEvent } from '../src/modules/accounting/posting'

/**
 * "Cek bulanan" on a SHADOW rehearsal book (pending allowed, never production): blockers stop closing, a pending source
 * is resolved by retry after the policy is completed (no second cash), and a closed month refuses new postings.
 */
const M = (n:number) => (BigInt(n) * 1_000_000n).toString()

describe('monthly review, pending retry and period close',() => {
  let t:TestApp,owner:string,finance:string,admin:string,september:string
  const actor = { userId:'USR-010',role:'super-admin' as const,name:'TEST_ONLY',email:'test@example.invalid',sessionId:'TEST_ONLY',partyId:null,vendorId:null }
  const call = (cookie:string,method:'POST'|'GET',path:string,body?:unknown,key:string = crypto.randomUUID()) => t.call(method,`/api/v1${path}`,{ cookie,body,headers:{ 'idempotency-key':key } })
  const review = async () => (await call(finance,'GET',`/accounting/periods/${september}/review`)).json.data
  const status = (r:{ checks:{ code:string;status:string }[] },code:string) => r.checks.find(c => c.code === code)?.status

  beforeAll(async () => {
    t = await makeTestApp();owner = await t.login(DEMO.superAdmin);finance = await t.login(DEMO.finance);admin = await t.login(DEMO.admin)
    const book = await t.db.transaction(tx => createBook(tx,actor,{ name:'TEST_ONLY close',purpose:'rehearsal',cutoverDate:'2026-09-01',timezone:'Asia/Jakarta' },'req_fixture_setup','test'))
    september = (await t.db.transaction(tx => createPeriod(tx,actor,{ startsOn:'2026-09-01',endsOn:'2026-09-30',reason:'TEST_ONLY September' },'req_p9'))).id
    await t.db.transaction(tx => createPeriod(tx,actor,{ startsOn:'2026-10-01',endsOn:'2026-12-31',reason:'TEST_ONLY rest' },'req_p10'))
    for (const [kind,settings] of [['manual_cash',{ classifications:{ office:'office-expense' } }],['asset',{}]] as const) {
      await t.db.query(`insert into accounting_policies (id,book_id,source_kind,version,effective_from,principal_agent,recognition,tax_treatment,validation_status,settings,rationale,created_by)
        values ($1,$2,$3,1,'2026-09-01','not-applicable','TEST_ONLY','TEST_ONLY_EXCLUDED','test-only',$4::text::jsonb,'TEST_ONLY fixture',$5)`,[`APL-${kind}`,book.id,kind,JSON.stringify(settings),actor.userId])
    }
    await t.db.query(`insert into bank_accounts (id,code,bank_name,holder_name,account_number,opening_status,opening_balance_minor,opening_date,opening_submitted_by,opening_submitted_at,opening_verified_by,opening_verified_at,created_by)
      values ('BA-TEST','TESTBANK','Synthetic','TEST_ONLY','123456','verified',$1,'2026-09-01','USR-001',now(),'USR-010',now(),'USR-010')`,[M(100)])
    await t.db.transaction(tx => postBusinessEvent(tx,actor,{ sourceType:'test_opening',sourceId:'TEST_ONLY_OPENING',sourceVersion:'1',kind:'opening',effectiveDate:'2026-09-01',
      snapshot:{ amountMinor:M(100),testOnly:true },policyKind:'manual_cash',description:'TEST_ONLY opening',
      lines:[{ accountCode:'1100',bankAccountId:'BA-TEST',debitMinor:M(100),creditMinor:'0' },{ accountCode:'3100',debitMinor:'0',creditMinor:M(100) }] },'req_test_opening'))
    await t.db.query("update accounting_books set opening_validated=true")
  },60000)
  afterAll(async () => { await t?.cleanup() })

  test('blockers explain what to fix: pending source, cash mismatch and missing depreciation',async () => {
    const res = await call(finance,'POST','/finance/transactions',{ bankAccountId:'BA-TEST',kind:'expense',category:'marketing',amountMinor:M(2),effectiveDate:'2026-09-10',memo:'TEST_ONLY iklan' })
    expect(res.status, res.text).toBeLessThan(300)
    await call(finance,'POST','/finance/assets/AST-002/purchase',{ bankAccountId:'BA-TEST',costMinor:M(6),acquiredOn:'2026-09-15',usefulLifeMonths:6 })
    const r = await review()
    expect(status(r,'SOURCES_POSTED')).toBe('blocker');expect(status(r,'CASH_MATCH')).toBe('blocker');expect(status(r,'DEPRECIATION')).toBe('blocker')
    expect(status(r,'TRIAL_BALANCE')).toBe('ok');expect(r.readyToClose).toBe(false)
    expect(r.checks.find((c:{ code:string }) => c.code === 'DEPRECIATION').action.to).toBe('/finance/funding')
    const close = await call(finance,'POST',`/accounting/periods/${september}/close`,{ version:r.period.version,reason:'TEST_ONLY close attempt',confirm:true })
    expect(close.status).toBe(422);expect(close.json.error.details.blockers).toEqual(expect.arrayContaining(['SOURCES_POSTED','DEPRECIATION']))
  })
  test('retry after the policy is completed posts the SAME cash once; depreciation clears the last blocker; close locks the month',async () => {
    await t.db.query(`insert into accounting_policies (id,book_id,source_kind,version,effective_from,principal_agent,recognition,tax_treatment,validation_status,settings,rationale,created_by)
      select 'APL-manual-v2',id,'manual_cash',2,'2026-09-01','not-applicable','TEST_ONLY','TEST_ONLY_EXCLUDED','test-only','{"classifications":{"office":"office-expense","marketing":"office-expense"}}'::jsonb,'TEST_ONLY marketing mapped','USR-010' from accounting_books`)
    const exceptions = (await call(finance,'GET','/accounting/exceptions')).json.data
    expect(exceptions.length).toBe(1)
    expect((await call(finance,'POST',`/accounting/exceptions/${exceptions[0].eventId}/retry`)).status).toBe(403)
    const cashBefore = (await t.db.query('select count(*) as n from financial_transactions'))[0]!.n
    const retried = await call(owner,'POST',`/accounting/exceptions/${exceptions[0].eventId}/retry`)
    expect(retried.status, retried.text).toBe(200);expect(retried.json.data.status).toBe('posted')
    expect((await t.db.query('select count(*) as n from financial_transactions'))[0]!.n).toBe(cashBefore)
    expect((await call(owner,'POST',`/accounting/exceptions/${exceptions[0].eventId}/retry`)).status).toBe(404)
    await call(finance,'POST','/finance/depreciation-runs',{ throughPeriod:'2026-09' })
    const r = await review()
    expect(status(r,'SOURCES_POSTED')).toBe('ok');expect(status(r,'CASH_MATCH')).toBe('ok');expect(status(r,'DEPRECIATION')).toBe('ok')
    expect(r.readyToClose).toBe(true)
    expect((await call(admin,'POST',`/accounting/periods/${september}/close`,{ version:r.period.version,reason:'TEST_ONLY admin',confirm:true })).status).toBe(403)
    expect((await call(finance,'POST',`/accounting/periods/${september}/close`,{ version:r.period.version,reason:'TEST_ONLY',confirm:false })).status).toBe(400)
    expect((await call(finance,'POST',`/accounting/periods/${september}/close`,{ version:r.period.version + 5,reason:'TEST_ONLY stale',confirm:true })).status).toBe(409)
    const closed = await call(finance,'POST',`/accounting/periods/${september}/close`,{ version:r.period.version,reason:'TEST_ONLY September checked',confirm:true })
    expect(closed.status, closed.text).toBe(200);expect(closed.json.data.status).toBe('closed')
    const late = await call(finance,'POST','/finance/transactions',{ bankAccountId:'BA-TEST',kind:'expense',category:'office',amountMinor:'1',effectiveDate:'2026-09-20' })
    expect(late.status).toBe(422);expect(late.json.error.code).toBe('ACCOUNTING_PERIOD_LOCKED')
    expect((await t.db.query("select id from financial_transactions where effective_date='2026-09-20'")).length).toBe(0)
    const october = await call(finance,'POST','/finance/transactions',{ bankAccountId:'BA-TEST',kind:'expense',category:'office',amountMinor:'1',effectiveDate:'2026-10-02' })
    expect(october.status).toBeLessThan(300)
  })
})
