import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { DEMO, makeTestApp, type TestApp } from './helpers'
import { createBook, createPeriod } from '../src/modules/accounting/setup'
import { postBusinessEvent } from '../src/modules/accounting/posting'
import { prepaidMonth, prepaidMonthAmount } from '../src/modules/finance/prepaid-expenses'
import { migrateDown, migrateUp } from '../src/db/migrator'

const M = (n: number) => (BigInt(n)*1_000_000n).toString()
const actor = { userId:'USR-010',role:'super-admin' as const,name:'TEST_ONLY',email:'test@example.invalid',sessionId:'TEST_ONLY',partyId:null,vendorId:null }
async function bank(t: TestApp) {
  await t.db.query(`insert into bank_accounts (id,code,bank_name,holder_name,account_number,opening_status,opening_balance_minor,opening_date,
    opening_submitted_by,opening_submitted_at,opening_verified_by,opening_verified_at,created_by)
    values ('BA-PREPAID','PREPAID','Synthetic','TEST_ONLY','123456','verified',$1,'2026-01-01','USR-001',now(),'USR-010',now(),'USR-010')`, [M(100)])
}
async function policy(t: TestApp, bookId: string, kind: string, effective = '2026-08-01') {
  await t.db.query(`insert into accounting_policies(id,book_id,source_kind,version,effective_from,principal_agent,recognition,tax_treatment,validation_status,settings,rationale,created_by)
    values ($1,$2,$3,1,$4,'not-applicable','TEST_ONLY','TEST_ONLY_EXCLUDED','test-only',$5::text::jsonb,'TEST_ONLY fixture; no production policy','USR-010')`,
    [`APL-${kind}`,bookId,kind,effective,JSON.stringify(kind === 'prepaid_opex' ? { method:'equal-months' } : {})])
}
const payload = (ref: string, extras: Record<string, unknown> = {}) => ({ bankAccountId:'BA-PREPAID',amountMinor:M(9),effectiveDate:'2026-08-01',
  description:'TEST_ONLY office rent',evidenceRef:ref,startMonth:'2026-08',months:3,method:'equal-months',...extras })
async function balance(t: TestApp, role: string) {
  return (await t.db.query<{ n:string }>(`select coalesce(sum(l.debit_minor-l.credit_minor),0) as n from accounting_journal_lines l
    join accounting_journals j on j.id=l.journal_id and j.status='posted' join accounting_accounts a on a.book_id=l.book_id and a.code=l.account_code
    where a.control_role=$1`, [role]))[0]!.n
}

describe('company prepaid expense, existing cash only', () => {
  let t:TestApp, finance:string, owner:string, admin:string, prepaidId:string, transactionId:string, august:string
  const call = (method:string,path:string,body?:unknown,key:string = crypto.randomUUID(),cookie = finance) => t.call(method,`/api/v1${path}`,{ cookie,body,headers:{ 'idempotency-key':key } })
  const post = async (path:string,body:unknown,key?:string) => { const r = await call('POST',path,body,key);expect(r.status,r.text).toBeLessThan(300);return r.json.data }
  beforeAll(async () => {
    t = await makeTestApp();finance = await t.login(DEMO.finance);owner = await t.login(DEMO.superAdmin);admin = await t.login(DEMO.admin)
    await bank(t)
    const b = await t.db.transaction(tx => createBook(tx,actor,{ name:'TEST_ONLY prepaid',purpose:'rehearsal',cutoverDate:'2026-08-01',timezone:'Asia/Jakarta' },'req_fixture','test'))
    for (const m of ['08','09','10']) {
      const p = await t.db.transaction(tx => createPeriod(tx,actor,{ startsOn:`2026-${m}-01`,endsOn:`2026-${m}-${m === '09' ? '30' : '31'}`,reason:'TEST_ONLY window' },'req_period'))
      if (m === '08') august = p.id
    }
    await policy(t,b.id,'prepaid_opex');await policy(t,b.id,'opening')
    await t.db.transaction(tx => postBusinessEvent(tx,actor,{ sourceType:'test_opening',sourceId:'TEST_ONLY',sourceVersion:'1',kind:'opening',effectiveDate:'2026-08-01',
      snapshot:{ amountMinor:M(100) },policyKind:'opening',description:'TEST_ONLY bank opening',
      lines:[{ accountCode:'1100',bankAccountId:'BA-PREPAID',debitMinor:M(100),creditMinor:'0' },{ accountCode:'3100',debitMinor:'0',creditMinor:M(100) }] },'req_opening'))
    await t.db.query("update accounting_books set mode='active',entity_type='TEST_ONLY',accounting_standard='TEST_ONLY',opening_validated=true")
  },60000)
  afterAll(async () => { await t?.cleanup() })

  test('equal months use exact integers with remainder only in the last month', () => {
    expect([0,1,2].map(i => prepaidMonthAmount(1001n,3,i))).toEqual([333n,333n,335n])
    expect(prepaidMonth('2026-12-01',1)).toBe('2027-01')
    expect(prepaidMonthAmount(1001n,3,3)).toBe(0n)
  })
  test('one payment creates a prepaid asset, not expense; completed months missing are visible in P&L and close', async () => {
    const p = await post('/finance/prepaid-expenses',payload('TEST-RENT-01'),'prepaid-rent-1')
    prepaidId = p.id;transactionId = p.transactionId
    expect((await post('/finance/prepaid-expenses',payload('TEST-RENT-01'),'prepaid-rent-1')).transactionId).toBe(transactionId)
    expect((await call('POST','/finance/prepaid-expenses',payload('TEST-RENT-01'))).status).toBe(409)
    expect(await balance(t,'cash')).toBe(M(91));expect(await balance(t,'prepaid-office')).toBe(M(9));expect(await balance(t,'office-expense')).toBe('0')
    const pl = (await call('GET','/accounting/reports/profit-loss?from=2026-08-01&to=2026-08-31')).json.data
    expect(pl.reasons.some((r:{code:string}) => r.code === 'PREPAID_AMORTIZATION_MISSING')).toBe(true);expect(pl.netProfitMinor).toBeNull()
    const review = (await call('GET',`/accounting/periods/${august}/review`)).json.data
    expect(review.checks.find((c:{code:string}) => c.code === 'PREPAID_OPEX').status).toBe('blocker')
    const cash = (await t.db.query('select count(*) as n from financial_transactions'))[0]!.n
    const month = await post('/finance/prepaid-amortization-runs',{ throughPeriod:'2026-08' },'amort-aug')
    expect(month.booked).toEqual([{ prepaidExpenseId:prepaidId,period:'2026-08',amountMinor:M(3) }])
    expect((await post('/finance/prepaid-amortization-runs',{ throughPeriod:'2026-08' },'amort-aug')).booked.length).toBe(1)
    expect((await post('/finance/prepaid-amortization-runs',{ throughPeriod:'2026-08' })).booked.length).toBe(0)
    expect((await t.db.query('select count(*) as n from financial_transactions'))[0]!.n).toBe(cash)
    expect(await balance(t,'cash')).toBe(M(91));expect(await balance(t,'prepaid-office')).toBe(M(6));expect(await balance(t,'office-expense')).toBe(M(3))
    const after = (await call('GET','/accounting/reports/profit-loss?from=2026-08-01&to=2026-08-31')).json.data
    expect(after.profitBeforeTaxMinor).toBe('-'+M(3));expect(after.reasons.some((r:{code:string}) => r.code === 'PREPAID_AMORTIZATION_MISSING')).toBe(false)
    expect((await call('GET',`/accounting/periods/${august}/review`)).json.data.checks.find((c:{code:string}) => c.code === 'PREPAID_OPEX').status).toBe('ok')
  })
  test('month identity survives two workers; cash reconciles, reversed unamortized payment stops the schedule', async () => {
    const workers = await Promise.all([call('POST','/finance/prepaid-amortization-runs',{ throughPeriod:'2026-09' }),call('POST','/finance/prepaid-amortization-runs',{ throughPeriod:'2026-09' })])
    expect(workers.map(r => r.status)).toEqual([200,200]);expect(workers.reduce((n,r) => n+r.json.data.booked.length,0)).toBe(1)
    expect(await balance(t,'office-expense')).toBe(M(6));expect(await balance(t,'prepaid-office')).toBe(M(3))
    expect((await call('POST',`/finance/transactions/${transactionId}/reverse`,{ reason:'TEST_ONLY recognised months' })).status).toBe(422)
    const other = await post('/finance/prepaid-expenses',payload('TEST-NEXT',{ effectiveDate:'2026-10-01',startMonth:'2026-11',amountMinor:M(2),months:2 }))
    await post(`/finance/transactions/${other.transactionId}/reverse`,{ reason:'TEST_ONLY wrong schedule before recognition' })
    const view = (await call('GET','/finance/prepaid-expenses?asOf=2026-10-21&limit=1')).json.data
    expect(view.items.length).toBe(1);expect(view.pagination.nextCursor).toBeTruthy()
    const next = (await call('GET',`/finance/prepaid-expenses?asOf=2026-10-21&limit=1&cursor=${view.pagination.nextCursor}`)).json.data
    expect(next.items[0]).toMatchObject({ id:other.id,status:'reversed',remainingMinor:'0' })
    const [book] = await t.db.query<{ n:string }>(`select a.opening_balance_minor+coalesce(sum(case when t.direction='in' then t.amount_minor else -t.amount_minor end),0) as n
      from bank_accounts a left join financial_transactions t on t.bank_account_id=a.id where a.id='BA-PREPAID' group by a.id`)
    expect(await balance(t,'cash')).toBe(book!.n)
    expect((await call('GET','/accounting/reports/balance-sheet?asOf=2026-10-21')).json.data.balanced).toBe(true)
  })
  test('direct SQL cannot alter a schedule, over-amortize, omit posting, or reverse already recognized cost', async () => {
    await expect(t.db.query('update prepaid_expenses set months=1 where id=$1',[prepaidId])).rejects.toThrow()
    await expect(t.db.query('delete from prepaid_expense_amortizations where prepaid_expense_id=$1',[prepaidId])).rejects.toThrow()
    await expect(t.db.transaction(tx => tx.query("insert into prepaid_expense_amortizations values ($1,'2026-10',$2,'USR-010',now())",[prepaidId,M(4)]))).rejects.toThrow('exact monthly schedule')
    await expect(t.db.transaction(tx => tx.query("insert into prepaid_expense_amortizations values ($1,'2026-10',$2,'USR-010',now())",[prepaidId,M(3)]))).rejects.toThrow('Mandatory prepaid amortization')
    await expect(t.db.transaction(async tx => {
      await tx.query("update accounting_books set mode='off'")
      await tx.query(`insert into financial_transactions(bank_account_id,direction,amount_minor,currency,kind,effective_date,reversal_of_id,reversal_reason,created_by)
        values ('BA-PREPAID','in',$1,'IDR','prepaid_opex','2026-10-01',$2,'TEST_ONLY invalid cash reversal','USR-010')`,[M(9),transactionId])
    })).rejects.toThrow('Amortized prepayment cannot be reversed')
    await expect(t.db.transaction(async tx => {
      await tx.query("update accounting_books set mode='off'")
      await tx.query(`insert into financial_transactions(bank_account_id,direction,amount_minor,currency,kind,effective_date,created_by)
        values ('BA-PREPAID','out',10,'IDR','prepaid_opex','2026-10-01','USR-010')`)
    })).rejects.toThrow('Prepaid office payment schedule missing')
  })
  test('unknown policy and closed periods roll back the source, cash, schedule and idempotency together', async () => {
    await t.db.query("update accounting_periods set status='closed' where id=$1",[august])
    expect((await call('POST','/finance/prepaid-expenses',payload('TEST-CLOSED'))).status).toBe(422)
    expect((await t.db.query("select 1 from prepaid_expenses where evidence_ref='TEST-CLOSED'")).length).toBe(0)
    await t.db.query("update accounting_periods set status='open' where id=$1",[august])
    await t.db.query(`insert into accounting_policies(id,book_id,source_kind,version,effective_from,principal_agent,recognition,tax_treatment,rationale,created_by)
      select 'APL-undecided',id,'prepaid_opex',2,'2026-09-01','unknown','unknown','unknown','TEST_ONLY undecided policy','USR-010' from accounting_books`)
    const before = (await t.db.query('select count(*) as n from financial_transactions'))[0]!.n
    expect((await call('POST','/finance/prepaid-expenses',payload('TEST-UNKNOWN',{ effectiveDate:'2026-09-01',startMonth:'2026-09' }),'unknown-retry')).status).toBe(422)
    expect((await t.db.query('select count(*) as n from financial_transactions'))[0]!.n).toBe(before)
    expect((await t.db.query("select 1 from prepaid_expenses where evidence_ref='TEST-UNKNOWN'")).length).toBe(0)
    await t.db.query(`insert into accounting_policies(id,book_id,source_kind,version,effective_from,principal_agent,recognition,tax_treatment,validation_status,settings,rationale,created_by)
      select 'APL-resolved',book_id,source_kind,3,'2026-09-01',principal_agent,recognition,tax_treatment,validation_status,settings,'TEST_ONLY resolved fixture',created_by
      from accounting_policies where id='APL-prepaid_opex'`)
    expect((await call('POST','/finance/prepaid-expenses',payload('TEST-UNKNOWN',{effectiveDate:'2026-09-01',startMonth:'2026-09'}),'unknown-retry')).status).toBe(201)
  })
  test('authorization precedes invalid bodies; validation and missing-source endpoints are explicit', async () => {
    expect((await t.call('POST','/api/v1/finance/prepaid-expenses',{ body:{} })).status).toBe(401)
    for (const path of ['/finance/prepaid-expenses','/finance/prepaid-amortization-runs']) {
      expect((await call('POST',path,{},'admin-denied',admin)).status).toBe(403)
    }
    expect((await call('GET','/finance/prepaid-expenses',undefined,'admin-read',admin)).status).toBe(403)
    expect((await call('POST','/finance/prepaid-expenses',payload('TEST-INVALID',{ effectiveDate:'2026-08-02' }))).status).toBe(400)
    expect((await call('POST','/finance/prepaid-expenses',payload('TEST-INVALID',{ method:'unknown' }))).status).toBe(400)
    expect((await call('POST','/finance/prepaid-expenses',payload('TEST-INVALID',{ bankAccountId:'BA-MISSING' }))).status).toBe(400)
    expect((await call('GET','/finance/transactions/MISSING')).status).toBe(404)
    expect((await call('POST','/finance/prepaid-amortization-runs',{ throughPeriod:'2099-01' })).status).toBe(400)
    expect((await t.call('POST','/api/v1/finance/prepaid-expenses',{cookie:owner,body:payload('TEST-CSRF'),headers:{'idempotency-key':'csrf','origin':'https://attacker.invalid'}})).status).toBe(403)
  })
})

describe('prepaid expenses before cutover', () => {
  test('opening includes only unconsumed office benefit; later recognition is a delta with no cash replay', async () => {
    const t = await makeTestApp()
    try {
      const finance = await t.login(DEMO.finance), owner = await t.login(DEMO.superAdmin)
      const post = async (path:string,body:unknown,cookie=finance) => {
        const r = await t.call('POST',`/api/v1${path}`,{cookie,body,headers:{'idempotency-key':crypto.randomUUID()}})
        expect(r.status,r.text).toBeLessThan(300);return r.json.data
      }
      await bank(t)
      const p = await post('/finance/prepaid-expenses',payload('TEST-PRE-CUTOVER'))
      await expect(migrateDown(t.db,{to:52})).rejects.toThrow('Prepaid or posted financial evidence exists')
      // Down steps commit individually: a newer empty migration may roll back before 0053 refuses.
      // Resume migrations in this isolated fixture before exercising the current API schema.
      await migrateUp(t.db)
      const b = await t.db.transaction(tx => createBook(tx,actor,{name:'TEST_ONLY prepaid opening',purpose:'rehearsal',cutoverDate:'2026-09-01',timezone:'Asia/Jakarta'},'req_opening','test'))
      await t.db.transaction(tx => createPeriod(tx,actor,{startsOn:'2026-09-01',endsOn:'2026-10-31',reason:'TEST_ONLY window'},'req_period'))
      await policy(t,b.id,'opening','2026-09-01');await policy(t,b.id,'prepaid_opex','2026-09-01')
      const preview = () => t.call('GET','/api/v1/accounting/opening-plan',{cookie:finance}).then(r => r.json.data)
      expect((await preview()).exceptions.some((e:{code:string}) => e.code === 'PREPAID_AMORTIZATION_MISSING')).toBe(true)
      await post('/finance/prepaid-amortization-runs',{throughPeriod:'2026-08'})
      const plan = await post('/accounting/opening-plan/preview',{decisions:{equity:{capitalMinor:M(100)}}},owner)
      expect(plan.exceptions).toEqual([])
      expect(plan.items.find((i:{sourceType:string}) => i.sourceType === 'prepaid_expense')).toMatchObject({sourceId:p.id,role:'prepaid-office',amountMinor:M(6)})
      await post('/accounting/opening-plan/confirm',{planHash:plan.planHash,decisions:{equity:{capitalMinor:M(100)}},reason:'TEST_ONLY reconciled source and service months'},owner)
      await t.db.query("update accounting_books set mode='active',entity_type='TEST_ONLY',accounting_standard='TEST_ONLY'")
      const before = (await t.db.query('select count(*) as n from financial_transactions'))[0]!.n
      await post('/finance/prepaid-amortization-runs',{throughPeriod:'2026-09'})
      expect(await balance(t,'prepaid-office')).toBe(M(3));expect(await balance(t,'office-expense')).toBe(M(3));expect(await balance(t,'cash')).toBe(M(91))
      expect((await t.db.query('select count(*) as n from financial_transactions'))[0]!.n).toBe(before)
    } finally { await t.cleanup() }
  },60000)
  test('shadow unknown is visible; completing fixture policy and retry never creates another cash payment', async () => {
    const t = await makeTestApp()
    try {
      const finance = await t.login(DEMO.finance), owner = await t.login(DEMO.superAdmin)
      await bank(t)
      const b = await t.db.transaction(tx => createBook(tx,actor,{name:'TEST_ONLY pending',purpose:'rehearsal',cutoverDate:'2026-08-01',timezone:'Asia/Jakarta'},'req_shadow','test'))
      await t.db.transaction(tx => createPeriod(tx,actor,{startsOn:'2026-08-01',endsOn:'2026-10-31',reason:'TEST_ONLY window'},'req_period'))
      const post = (path:string,body:unknown,cookie=finance) => t.call('POST',`/api/v1${path}`,{cookie,body,headers:{'idempotency-key':crypto.randomUUID()}})
      expect((await post('/finance/prepaid-expenses',payload('TEST-SHADOW'))).json.data.accountingStatus).toBe('pending')
      expect((await post('/finance/prepaid-amortization-runs',{throughPeriod:'2026-08'})).status).toBe(200)
      await policy(t,b.id,'prepaid_opex')
      const events = await t.db.query<{id:string}>('select id from accounting_events order by id')
      for (const e of events) { expect((await post(`/accounting/exceptions/${e.id}/retry`,{},owner)).json.data.status).toBe('posted') }
      expect((await t.db.query('select count(*) as n from financial_transactions'))[0]!.n).toBe('1')
      expect(await balance(t,'prepaid-office')).toBe(M(6));expect(await balance(t,'office-expense')).toBe(M(3))
    } finally { await t.cleanup() }
  },60000)
})
