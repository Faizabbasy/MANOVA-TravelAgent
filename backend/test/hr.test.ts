import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { DEMO, makeTestApp, type TestApp } from './helpers'

/**
 * S11c: human resources. Admin manages employees' non-money data (`hr.manage-employee`); salaries, payroll,
 * commissions and incentives belong to Finance and the Super Admin (`hr.manage-payroll`), and Admin never receives
 * the amounts. superAdmin = USR-010, admin = USR-002, finance = USR-008, client = USR-021.
 */

let t: TestApp
const c: Record<string, string> = {}
beforeAll(async () => {
  t = await makeTestApp({ config: { portalLogin: true } })
  for (const [k, email] of Object.entries(DEMO)) c[k] = await t.login(email)
}, 30_000)
afterAll(() => t.cleanup())

let keySeq = 0
const call = (method: string, path: string, who: string, body?: unknown, key = true) =>
  t.call(method, `/api/v1${path}`, { cookie: c[who], body, headers: key && method === 'POST' ? { 'idempotency-key': `hr-test-${++keySeq}-key` } : {} })
type Employee = {
  id: string; userId: string | null; name: string; position: string; department: string; employmentType: string; status: string
  joinedOn: string; phone: string | null; email: string | null; baseSalaryMinor: string | null; commissionRatePercent: number | null
}
const person = (over: Record<string, unknown> = {}) => ({
  name: 'Karyawan Uji', position: 'Staff', department: 'Operations', employmentType: 'full-time', status: 'active', joinedOn: '2026-01-05', ...over
})
const newEmployee = async (over: Record<string, unknown> = {}) => (await call('POST', '/employees', 'admin', person(over))).json.data as Employee

describe('employees', () => {
  test('Admin adds an employee without pay; pay in the body is Finance-only (403); finance cannot add; validation', async () => {
    const res = await call('POST', '/employees', 'admin', person({ phone: '0812-0000-0001' }))
    expect(res.status).toBe(201)
    const e = res.json.data as Employee
    expect(e).toMatchObject({ name: 'Karyawan Uji', employmentType: 'full-time', baseSalaryMinor: null, commissionRatePercent: null })
    expect(e.id).toMatch(/^EMP-\d+$/)
    expect((await call('POST', '/employees', 'admin', person({ baseSalaryMinor: '9000000' }))).status).toBe(403)
    expect((await call('POST', '/employees', 'finance', person())).status).toBe(403)
    expect((await call('POST', '/employees', 'admin', person(), false)).status).toBe(400)
    expect((await call('POST', '/employees', 'admin', person({ employmentType: 'intern' }))).status).toBe(400)
    expect((await call('POST', '/employees', 'admin', person({ name: ' ' }))).status).toBe(400)
    expect((await call('POST', '/employees', 'admin', person({ userId: 'USR-021' }))).status).toBe(422) // a portal user
    const linked = await call('POST', '/employees', 'admin', person({ userId: 'USR-003' }))
    expect(linked.json.data.userId).toBe('USR-003')
    expect((await call('POST', '/employees', 'admin', person({ userId: 'USR-003' }))).status).toBe(422) // already linked
  })

  test('Admin never receives pay; Finance and the Super Admin do; portals cannot read; anonymous 401', async () => {
    const e = await newEmployee()
    expect((await call('PATCH', `/employees/${e.id}`, 'finance', { baseSalaryMinor: '12000000', commissionRatePercent: 2.5 })).status).toBe(200)
    const asAdmin = ((await call('GET', '/employees', 'admin')).json.data as Employee[]).find(x => x.id === e.id)!
    expect([asAdmin.baseSalaryMinor, asAdmin.commissionRatePercent]).toEqual([null, null])
    const asFinance = ((await call('GET', '/employees', 'finance')).json.data as Employee[]).find(x => x.id === e.id)!
    expect([asFinance.baseSalaryMinor, asFinance.commissionRatePercent]).toEqual(['12000000', 2.5])
    const asSuper = ((await call('GET', '/employees', 'superAdmin')).json.data as Employee[]).find(x => x.id === e.id)!
    expect(asSuper.baseSalaryMinor).toBe('12000000')
    expect((await call('GET', '/employees', 'client')).status).toBe(403)
    expect((await t.call('GET', '/api/v1/employees')).status).toBe(401)
  })

  test('Admin edits non-pay fields only; Finance edits pay only; the Super Admin both', async () => {
    const e = await newEmployee()
    const upd = await call('PATCH', `/employees/${e.id}`, 'admin', { position: 'Senior Staff', status: 'on-leave' })
    expect(upd.status).toBe(200)
    expect(upd.json.data).toMatchObject({ position: 'Senior Staff', status: 'on-leave', baseSalaryMinor: null })
    expect((await call('PATCH', `/employees/${e.id}`, 'admin', { baseSalaryMinor: '1' })).status).toBe(403)
    expect((await call('PATCH', `/employees/${e.id}`, 'finance', { position: 'X' })).status).toBe(403)
    expect((await call('PATCH', `/employees/${e.id}`, 'finance', { baseSalaryMinor: 9000000 })).status).toBe(400) // a string
    expect((await call('PATCH', `/employees/${e.id}`, 'finance', { commissionRatePercent: 150 })).status).toBe(400)
    const both = await call('PATCH', `/employees/${e.id}`, 'superAdmin', { position: 'Lead', baseSalaryMinor: '15000000', commissionRatePercent: null })
    expect(both.json.data).toMatchObject({ position: 'Lead', baseSalaryMinor: '15000000', commissionRatePercent: null })
    expect((await call('PATCH', '/employees/EMP-999', 'admin', { position: 'X' })).status).toBe(404)
  })

  test('pay changes are audited as Finance actions, hidden from Admin in the Activity Center', async () => {
    const e = await newEmployee()
    await call('PATCH', `/employees/${e.id}`, 'finance', { baseSalaryMinor: '7000000' })
    const [audit] = await t.db.query<{ after: { baseSalaryMinor: string } }>(
      "select after from audit_events where action = 'finance.employee_compensation.changed' and entity_id = $1", [e.id])
    expect(audit!.after.baseSalaryMinor).toBe('7000000')
    const events = (await call('GET', '/audit/events', 'admin')).json.data as { type: string }[]
    expect(events.some(x => x.type.startsWith('finance.employee'))).toBe(false)
    expect(events.some(x => x.type === 'employee.created')).toBe(true)
  })
})

describe('attendance and performance reviews', () => {
  test('internal roles read; portals 403', async () => {
    for (const path of ['/attendance', '/performance-reviews']) {
      expect((await call('GET', path, 'admin')).status).toBe(200)
      expect((await call('GET', path, 'finance')).status).toBe(200)
      expect((await call('GET', path, 'client')).status).toBe(403)
    }
  })
})

type Run = { id: string; period: string; status: string; approvedBy: string | null; approvedOn: string | null; paidOn: string | null }
type Line = { id: string; payrollRunId: string; employeeId: string; baseSalaryMinor: string; allowanceMinor: string; deductionMinor: string; note: string | null }
type Commission = { id: string; employeeId: string; projectId: string; period: string; baseAmountMinor: string; ratePercent: number; amountMinor: string; status: string; source: string; note: string | null }

describe('payroll', () => {
  test('only Finance and the Super Admin see or run payroll; a run is draft → approved → paid; lines change only in draft', async () => {
    const e = await newEmployee({ name: 'Penerima Gaji' })
    await call('PATCH', `/employees/${e.id}`, 'finance', { baseSalaryMinor: '10000000' })
    for (const path of ['/payroll-runs', '/payroll-lines', '/hr/commissions']) {
      expect((await call('GET', path, 'admin')).status).toBe(403)
      expect((await call('GET', path, 'finance')).status).toBe(200)
    }
    expect((await call('POST', '/payroll-runs', 'admin', { period: '2031-01' })).status).toBe(403)
    expect((await call('POST', '/payroll-runs', 'finance', { period: '2031-13' })).status).toBe(400)
    const res = await call('POST', '/payroll-runs', 'finance', { period: '2031-01' })
    expect(res.status).toBe(201)
    const run = res.json.data as Run
    expect(run).toMatchObject({ id: 'PRN-2031-01', period: '2031-01', status: 'draft', approvedBy: null })
    expect((await call('POST', '/payroll-runs', 'finance', { period: '2031-01' })).status).toBe(422) // one run per period
    const line = ((await call('GET', '/payroll-lines', 'finance')).json.data as Line[]).find(l => l.payrollRunId === run.id && l.employeeId === e.id)!
    expect(line).toMatchObject({ baseSalaryMinor: '10000000', allowanceMinor: '0', deductionMinor: '0' })

    const upd = await call('PATCH', `/payroll-lines/${line.id}`, 'finance', { allowanceMinor: '1200000', deductionMinor: '500000', note: 'Lembur' })
    expect(upd.json.data).toMatchObject({ allowanceMinor: '1200000', deductionMinor: '500000', note: 'Lembur' })
    expect((await call('PATCH', `/payroll-lines/${line.id}`, 'admin', { allowanceMinor: '1' })).status).toBe(403)
    expect((await call('PATCH', `/payroll-lines/${line.id}`, 'finance', { allowanceMinor: -1 })).status).toBe(400)

    expect((await call('POST', `/payroll-runs/${run.id}/pay`, 'finance')).status).toBe(422) // not approved yet
    const approved = await call('POST', `/payroll-runs/${run.id}/approve`, 'finance')
    expect(approved.json.data).toMatchObject({ status: 'approved', approvedBy: 'USR-008' })
    expect((await call('PATCH', `/payroll-lines/${line.id}`, 'finance', { allowanceMinor: '1' })).status).toBe(422)
    expect((await call('POST', `/payroll-runs/${run.id}/approve`, 'finance')).status).toBe(422)
    expect((await call('POST', `/payroll-runs/${run.id}/pay`, 'admin')).status).toBe(403)
    const paid = await call('POST', `/payroll-runs/${run.id}/pay`, 'finance')
    expect(paid.json.data.status).toBe('paid')
    expect(paid.json.data.paidOn).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    const actions = (await t.db.query<{ action: string }>("select action from audit_events where entity_id = $1 order by id", [run.id])).map(r => r.action)
    expect(actions).toEqual(['finance.payroll.created', 'finance.payroll.approved', 'finance.payroll.paid'])
  })
})

describe('commissions and incentives', () => {
  test('commissions are derived from the projects an employee owns; incentives are Finance entries', async () => {
    const [project] = await t.db.query<{ id: string; contract: string }>(
      "select id, contract_value_minor::text as contract from projects where owner_user_id = 'USR-002' and contract_value_minor is not null order by id limit 1")
    const e = await newEmployee({ name: 'Doni', userId: 'USR-002' })
    await call('PATCH', `/employees/${e.id}`, 'finance', { commissionRatePercent: 1.5 })
    const list = (await call('GET', '/hr/commissions', 'finance')).json.data as Commission[]
    const derived = list.find(x => x.id === `COM-${project!.id}-${e.id}`)!
    expect(derived).toMatchObject({ employeeId: e.id, projectId: project!.id, baseAmountMinor: project!.contract, ratePercent: 1.5, source: 'derived' })
    expect(derived.amountMinor).toBe(String(Math.round(Number(project!.contract) * 1.5 / 100)))

    const body = { employeeId: e.id, projectId: 'PRJ-101', period: '2031-02', amountMinor: '2500000', note: 'Bonus closing' }
    expect((await call('POST', '/incentives', 'admin', body)).status).toBe(403)
    expect((await call('POST', '/incentives', 'finance', { ...body, amountMinor: '0' })).status).toBe(400)
    expect((await call('POST', '/incentives', 'finance', { ...body, period: '2031' })).status).toBe(400)
    expect((await call('POST', '/incentives', 'finance', { ...body, employeeId: 'EMP-999' })).status).toBe(422)
    const res = await call('POST', '/incentives', 'finance', body)
    expect(res.status).toBe(201)
    expect(res.json.data).toMatchObject({ employeeId: e.id, amountMinor: '2500000', status: 'approved', source: 'manual', note: 'Bonus closing' })
    expect(res.json.data.id).toMatch(/^INS-\d+$/)
    expect((await t.db.query("select 1 from audit_events where action = 'finance.incentive.created'")).length).toBe(1)
  })
})
