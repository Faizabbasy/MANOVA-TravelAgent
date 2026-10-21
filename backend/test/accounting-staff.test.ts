import { afterAll,beforeAll,describe,expect,test } from 'bun:test'
import { DEMO,makeTestApp,type TestApp } from './helpers'
import { createBook,createPeriod } from '../src/modules/accounting/setup'
import { postBusinessEvent } from '../src/modules/accounting/posting'

/**
 * Owner accounting F5 on an isolated TEST_ONLY book: kasbon (A06) and payroll settled through real cash (A02 part).
 * Fixture policies map categories explicitly; no real company payroll/tax policy is implied.
 */
const M = (n:number) => (BigInt(n) * 1_000_000n).toString()

describe('staff funds and payroll accounting',() => {
  let t:TestApp,cookie:string,admin:string,employee:string,employee2:string
  const actor = { userId:'USR-010',role:'super-admin' as const,name:'TEST_ONLY',email:'test@example.invalid',sessionId:'TEST_ONLY',partyId:null,vendorId:null }
  const call = async (method:'POST'|'GET'|'PATCH',path:string,body?:unknown,key = crypto.randomUUID()) =>
    t.call(method,`/api/v1${path}`,{ cookie,body,headers:{ 'idempotency-key':key } })
  const post = async (path:string,body:unknown) => {
    const res = await call('POST',path,body)
    expect(res.status, res.text).toBeLessThan(300)
    return res.json.data
  }
  const bal = async (code:string,employeeId?:string) => (await t.db.query<{ b:string }>(`select coalesce(sum(l.debit_minor-l.credit_minor),0) as b
    from accounting_journal_lines l join accounting_journals j on j.id=l.journal_id and j.status='posted' where l.account_code=$1 and ($2::text is null or l.employee_id=$2)`,
  [code,employeeId ?? null]))[0]!.b

  beforeAll(async () => {
    t = await makeTestApp();cookie = await t.login(DEMO.finance);admin = await t.login(DEMO.admin)
    const book = await t.db.transaction(tx => createBook(tx,actor,{ name:'TEST_ONLY staff',purpose:'rehearsal',cutoverDate:'2026-09-01',timezone:'Asia/Jakarta' },'req_fixture_setup','test'))
    await t.db.transaction(tx => createPeriod(tx,actor,{ startsOn:'2026-09-01',endsOn:'2027-12-31',reason:'TEST_ONLY window' },'req_period'))
    const settings:Record<string,unknown> = { manual_cash:{ classifications:{ office:'office-expense' } },employee_advance:{ classifications:{ office:'office-expense',marketing:'office-expense' } } }
    for (const kind of ['manual_cash','employee_advance','payroll']) {
      await t.db.query(`insert into accounting_policies (id,book_id,source_kind,version,effective_from,principal_agent,recognition,tax_treatment,validation_status,settings,rationale,created_by)
        values ($1,$2,$3,1,'2026-09-01','not-applicable','TEST_ONLY','TEST_ONLY_EXCLUDED','test-only',$4::text::jsonb,'TEST_ONLY fixture, no real company or tax policy',$5)`,
      [`APL-${kind}`,book.id,kind,JSON.stringify(settings[kind] ?? {}),actor.userId])
    }
    await t.db.query(`insert into bank_accounts (id,code,bank_name,holder_name,account_number,opening_status,opening_balance_minor,opening_date,opening_submitted_by,opening_submitted_at,opening_verified_by,opening_verified_at,created_by)
      values ('BA-TEST','TESTBANK','Synthetic','TEST_ONLY','123456','verified',$1,'2026-09-01','USR-001',now(),'USR-010',now(),'USR-010')`,[M(500)])
    await t.db.transaction(tx => postBusinessEvent(tx,actor,{ sourceType:'test_opening',sourceId:'TEST_ONLY_OPENING',sourceVersion:'1',kind:'opening',effectiveDate:'2026-09-01',
      snapshot:{ amountMinor:M(500),testOnly:true },policyKind:'manual_cash',description:'TEST_ONLY opening',
      lines:[{ accountCode:'1100',bankAccountId:'BA-TEST',debitMinor:M(500),creditMinor:'0' },{ accountCode:'3100',debitMinor:'0',creditMinor:M(500) }] },'req_test_opening'))
    await t.db.query("update accounting_books set mode='active',entity_type='TEST_ONLY',accounting_standard='TEST_ONLY',opening_validated=true")
    const staff = await t.db.query<{ id:string }>("select id from employees where status='active' order by id limit 2")
    employee = staff[0]!.id;employee2 = staff[1]!.id
  },60000)
  afterAll(async () => { await t?.cleanup() })

  test('A06: kasbon 5 is not expense; evidence 4 becomes cost; returning 1 closes it; the same receipt cannot be claimed twice',async () => {
    const cash = { bankAccountId:'BA-TEST',employeeId:employee,projectId:'PRJ-101' }
    const given = await post('/finance/staff-funds/advances',{ ...cash,amountMinor:M(5),effectiveDate:'2026-10-01' })
    expect(given.netMinor).toBe(M(5))
    expect(await bal('1100')).toBe(M(495));expect(await bal('1140',employee)).toBe(M(5));expect(await bal('5100')).toBe('0')
    const claim = await post('/finance/expense-claims',{ employeeId:employee,projectId:'PRJ-101',category:'trip',amountMinor:M(4),spentOn:'2026-10-03',evidenceRef:'NOTA-TEST-001',description:'TEST_ONLY makan rombongan' })
    expect(claim.accountingStatus).toBe('posted');expect(claim.netMinor).toBe(M(1))
    expect(await bal('5100')).toBe(M(4));expect(await bal('1140',employee)).toBe(M(1))
    const dup = await call('POST','/finance/expense-claims',{ employeeId:employee2,category:'office',amountMinor:M(1),spentOn:'2026-10-03',evidenceRef:' nota-test-001 ',description:'TEST_ONLY same receipt' })
    expect(dup.status).toBe(409)
    expect((await call('POST','/finance/staff-funds/returns',{ ...cash,amountMinor:M(2),effectiveDate:'2026-10-04' })).status).toBe(400)
    await post('/finance/staff-funds/returns',{ ...cash,amountMinor:M(1),effectiveDate:'2026-10-04' })
    expect(await bal('1140',employee)).toBe('0');expect(await bal('1100')).toBe(M(496))
    expect((await call('POST',`/finance/transactions/${given.transactionId}/reverse`,{ reason:'TEST_ONLY should be refused' })).status).toBe(422)
    const funds = (await call('GET',`/finance/staff-funds?employeeId=${employee}`)).json.data
    expect(funds.employees[0]).toMatchObject({ heldMinor:'0',owedToEmployeeMinor:'0' })
    expect(funds.movements.length).toBe(3)
  })
  test('A06 variation: spending 6 from kasbon 5 owes reimbursement 1, paid exactly once; void reverses the cost only',async () => {
    const cash = { bankAccountId:'BA-TEST',employeeId:employee2 }
    await post('/finance/staff-funds/advances',{ ...cash,amountMinor:M(5),effectiveDate:'2026-10-05' })
    const claim = await post('/finance/expense-claims',{ employeeId:employee2,category:'office',amountMinor:M(6),spentOn:'2026-10-06',evidenceRef:'NOTA-TEST-002',description:'TEST_ONLY printer toner' })
    expect(claim.netMinor).toBe('-'+M(1))
    expect(await bal('6100')).toBe(M(6));expect(await bal('1140',employee2)).toBe('0');expect(await bal('2165',employee2)).toBe('-'+M(1))
    await post('/finance/staff-funds/reimbursements',{ ...cash,amountMinor:M(1),effectiveDate:'2026-10-07' })
    expect(await bal('2165',employee2)).toBe('0')
    expect((await call('POST','/finance/staff-funds/reimbursements',{ ...cash,amountMinor:'1',effectiveDate:'2026-10-07' })).status).toBe(400)
    await post(`/finance/expense-claims/${claim.id}/void`,{ reason:'TEST_ONLY wrong receipt' })
    expect(await bal('6100')).toBe('0')
    const funds = (await call('GET',`/finance/staff-funds?employeeId=${employee2}`)).json.data
    expect(funds.employees[0].heldMinor).toBe(M(6))
  })
  test('payroll: approval books expense and payable; pay posts cash once; legacy pay without bank is refused; reversal reopens it',async () => {
    const run = (await post('/payroll-runs',{ period:'2026-10' }))
    const lines = (await call('GET','/payroll-lines')).json.data.filter((l:{ payrollRunId:string }) => l.payrollRunId === run.id)
    const gross = lines.reduce((s:bigint,l:{ baseSalaryMinor:string;allowanceMinor:string }) => s + BigInt(l.baseSalaryMinor) + BigInt(l.allowanceMinor),0n)
    expect(gross > 0n).toBe(true)
    expect((await call('POST',`/payroll-runs/${run.id}/pay`,{ bankAccountId:'BA-TEST',effectiveDate:'2026-10-20' })).status).toBe(422)
    const approved = await call('POST',`/payroll-runs/${run.id}/approve`,{})
    expect(approved.status).toBe(200)
    expect(await bal('6110')).toBe(gross.toString());expect(await bal('2160')).toBe((-gross).toString())
    expect((await call('POST',`/payroll-runs/${run.id}/pay`,{})).status).toBe(400)
    const bankBefore = BigInt(await bal('1100'))
    const key = crypto.randomUUID()
    const paid = await call('POST',`/payroll-runs/${run.id}/pay`,{ bankAccountId:'BA-TEST',effectiveDate:'2026-10-20' },key)
    expect(paid.status, paid.text).toBe(200);expect(paid.json.data.status).toBe('paid')
    expect((await call('POST',`/payroll-runs/${run.id}/pay`,{ bankAccountId:'BA-TEST',effectiveDate:'2026-10-20' },key)).json.data.status).toBe('paid')
    expect(await bal('2160')).toBe('0');expect(await bal('6110')).toBe(gross.toString())
    expect(BigInt(await bal('1100'))).toBe(bankBefore - gross)
    expect((await call('POST',`/payroll-runs/${run.id}/pay`,{ bankAccountId:'BA-TEST',effectiveDate:'2026-10-20' })).status).toBe(422)
    const [payment] = await t.db.query<{ id:string }>("select id from financial_transactions where payroll_run_id=$1 and reversal_of_id is null",[run.id])
    const rev = await call('POST',`/finance/transactions/${payment!.id}/reverse`,{ reason:'TEST_ONLY wrong account' })
    expect(rev.status, rev.text).toBe(201)
    expect((await t.db.query<{ status:string }>('select status from payroll_runs where id=$1',[run.id]))[0]!.status).toBe('approved')
    expect(await bal('2160')).toBe((-gross).toString());expect(BigInt(await bal('1100'))).toBe(bankBefore)
    await expect(t.db.transaction(tx => tx.query("update payroll_runs set status='paid',paid_on='2026-10-21' where id=$1",[run.id]))).rejects.toThrow('payroll payment')
    expect((await call('POST',`/payroll-runs/${run.id}/pay`,{ bankAccountId:'BA-TEST',effectiveDate:'2026-10-21' })).status).toBe(200)
    expect((await t.call('POST',`/api/v1/payroll-runs/${run.id}/pay`,{ cookie:admin,body:{ bankAccountId:'BA-TEST',effectiveDate:'2026-10-21' },headers:{ 'idempotency-key':'admin-pay' } })).status).toBe(403)
  })
  test('payroll deductions without a mapped treatment are never booked as zero: approval rolls back',async () => {
    const run = await post('/payroll-runs',{ period:'2026-11' })
    const [line] = (await call('GET','/payroll-lines')).json.data.filter((l:{ payrollRunId:string }) => l.payrollRunId === run.id)
    expect((await call('PATCH',`/payroll-lines/${line.id}`,{ deductionMinor:'100000' })).status).toBe(200)
    const res = await call('POST',`/payroll-runs/${run.id}/approve`,{})
    expect(res.status).toBe(422);expect(res.json.error.code).toBe('ACCOUNTING_POLICY_REQUIRED')
    expect((await t.db.query<{ status:string }>('select status from payroll_runs where id=$1',[run.id]))[0]!.status).toBe('draft')
  })
  test('A02 part: office cash expense and payroll reach company profit once; legacy demo paid run stays untouched',async () => {
    await post('/finance/transactions',{ bankAccountId:'BA-TEST',kind:'expense',category:'office',amountMinor:M(5),effectiveDate:'2026-10-10',memo:'TEST_ONLY sewa' })
    const pl = (await call('GET','/accounting/reports/profit-loss?from=2026-10-01&to=2026-10-31')).json.data
    const operating = BigInt(pl.operatingExpense.totalMinor)
    expect(operating).toBe(BigInt(await bal('6100')) + BigInt(await bal('6110')))
    expect(BigInt(pl.profitBeforeTaxMinor)).toBe(-(operating + BigInt(pl.directCost.totalMinor)))
    expect((await t.db.query<{ status:string }>("select status from payroll_runs where id='PRN-2026-06'"))[0]!.status).toBe('paid')
    expect((await t.call('GET','/api/v1/finance/staff-funds',{ cookie:admin })).status).toBe(403)
    expect((await t.call('POST','/api/v1/finance/staff-funds/advances',{ cookie:admin,body:{},headers:{ 'idempotency-key':'admin-advance' } })).status).toBe(403)
  })
})
