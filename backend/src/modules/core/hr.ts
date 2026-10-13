import { hasCapability, type Actor } from '../../auth/rbac'
import type { Queryable } from '../../db/client'
import { AppError, errors, type FieldErrors } from '../../http/errors'
import { recordAudit } from '../../shared/audit'
import { isIsoDate } from '../../shared/dates'
import { nextId } from '../../shared/ids'
import { parseAmountMinor } from '../../shared/money'

/**
 * Human resources (S11c). Admin manages employees' non-money data (`hr.manage-employee`). Salaries, payroll,
 * commissions and incentives belong to Finance and the Super Admin (`hr.manage-payroll`): other roles never receive
 * the amounts, and money actions are audited under `finance.` so the Activity Center hides them from Admin.
 */

const rule = (message: string) => new AppError(422, 'RULE_VIOLATION', message)
const str = (v: unknown) => (v === null || v === undefined ? null : String(v))
const day = (v: unknown) => (v === null || v === undefined ? null : v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10))
const num = (v: unknown) => (v === null || v === undefined ? null : Number(v))

export const seesPay = (actor: Actor) => hasCapability(actor.role, 'hr.manage-payroll')

type Input = Record<string, unknown>

/* ---------- employees ---------- */

const EMPLOYMENT_TYPES = ['full-time', 'contract', 'freelance']
const EMPLOYEE_STATUSES = ['active', 'on-leave', 'resigned']
const PROFILE_FIELDS = ['userId', 'name', 'position', 'department', 'employmentType', 'status', 'joinedOn', 'phone', 'email']
const PAY_FIELDS = ['baseSalaryMinor', 'commissionRatePercent']

export async function listEmployees(db: Queryable, actor: Actor, id?: string) {
  const pay = seesPay(actor)
  const rows = await db.query<Record<string, unknown>>(
    'select * from employees where ($1::text is null or id = $1) order by length(id), id', [id ?? null])
  return rows.map(r => ({
    id: r.id as string,
    userId: str(r.user_id),
    name: r.name as string,
    position: r.position as string,
    department: r.department as string,
    employmentType: r.employment_type as string,
    status: r.status as string,
    joinedOn: day(r.joined_on)!,
    phone: str(r.phone),
    email: str(r.email),
    baseSalaryMinor: pay ? str(r.base_salary_minor) : null,
    commissionRatePercent: pay ? num(r.commission_rate_percent) : null
  }))
}

/** Reads the sent profile fields into column values; `undefined` = not sent. */
async function readProfile(tx: Queryable, input: Input, creating: boolean, id: string | null) {
  const fe: FieldErrors = {}
  const out: Record<string, unknown> = {}
  const text = (key: string, col: string, required: boolean) => {
    const v = input[key]
    if (v === undefined) { if (required) fe[key] = ['Wajib diisi.']; return }
    if (v === null || (typeof v === 'string' && !v.trim())) { if (required) fe[key] = ['Wajib diisi.']; else out[col] = null; return }
    if (typeof v !== 'string') { fe[key] = ['Harus berupa teks.']; return }
    if (v.trim().length > 200) { fe[key] = ['Maksimal 200 karakter.']; return }
    out[col] = v.trim()
  }
  const oneOf = (key: string, col: string, values: string[]) => {
    const v = input[key]
    if (v === undefined) { if (creating) fe[key] = ['Wajib diisi.']; return }
    if (typeof v !== 'string' || !values.includes(v)) { fe[key] = [`Pilih salah satu: ${values.join(', ')}.`]; return }
    out[col] = v
  }
  text('name', 'name', creating)
  if (!creating && out.name === null) fe.name = ['Wajib diisi.']
  text('position', 'position', creating)
  if (!creating && out.position === null) fe.position = ['Wajib diisi.']
  text('department', 'department', creating)
  if (!creating && out.department === null) fe.department = ['Wajib diisi.']
  oneOf('employmentType', 'employment_type', EMPLOYMENT_TYPES)
  oneOf('status', 'status', EMPLOYEE_STATUSES)
  if (input.joinedOn !== undefined || creating) {
    const v = input.joinedOn
    if (typeof v !== 'string' || !isIsoDate(v)) fe.joinedOn = ['Tanggal harus berformat YYYY-MM-DD.']
    else out.joined_on = v
  }
  text('phone', 'phone', false)
  text('email', 'email', false)
  text('userId', 'user_id', false)
  if (Object.keys(fe).length) throw errors.validation(fe)
  if (out.user_id) {
    const [u] = await tx.query("select 1 from users where id = $1 and role not in ('client', 'vendor')", [out.user_id])
    if (!u) throw rule('User tertaut harus user internal.')
    const [taken] = await tx.query('select id from employees where user_id = $1 and ($2::text is null or id <> $2)', [out.user_id, id])
    if (taken) throw rule('User ini sudah tertaut ke karyawan lain.')
  }
  return out
}

function readPay(input: Input) {
  const fe: FieldErrors = {}
  const out: Record<string, unknown> = {}
  if (input.baseSalaryMinor !== undefined) {
    try { out.base_salary_minor = parseAmountMinor(input.baseSalaryMinor, 'baseSalaryMinor', { allowZero: true }).toString() } catch (e) {
      if (e instanceof AppError) Object.assign(fe, e.extra.fieldErrors); else throw e
    }
  }
  if (input.commissionRatePercent !== undefined) {
    const v = input.commissionRatePercent
    if (v === null) out.commission_rate_percent = null
    else if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0 || v > 100 || Math.round(v * 100) !== v * 100) fe.commissionRatePercent = ['Persen komisi 0,01–100 (maks. 2 desimal), atau kosong.']
    else out.commission_rate_percent = v
  }
  if (Object.keys(fe).length) throw errors.validation(fe)
  return out
}

/** Splits the body: profile keys need `hr.manage-employee`, pay keys `hr.manage-payroll`; anything else is 400. */
function authorize(actor: Actor, input: Input) {
  const unknown = Object.keys(input).filter(k => !PROFILE_FIELDS.includes(k) && !PAY_FIELDS.includes(k))
  if (unknown.length) throw errors.validation(Object.fromEntries(unknown.map(k => [k, ['Field ini tidak dikenal.']])))
  const touchesPay = PAY_FIELDS.some(k => k in input)
  const touchesProfile = PROFILE_FIELDS.some(k => k in input)
  if (touchesPay && !seesPay(actor)) throw errors.forbidden('Gaji dan komisi hanya diatur Finance.')
  if (touchesProfile && !hasCapability(actor.role, 'hr.manage-employee')) throw errors.forbidden('Data karyawan diatur Admin.')
  return { touchesPay, touchesProfile }
}

export async function createEmployee(tx: Queryable, actor: Actor, input: Input, requestId: string) {
  if (!hasCapability(actor.role, 'hr.manage-employee')) throw errors.forbidden()
  const { touchesPay } = authorize(actor, input)
  const profile = await readProfile(tx, input, true, null)
  const pay = touchesPay ? readPay(input) : {}
  const id = await nextId(tx, 'EMP-')
  const cols = { ...profile, ...pay }
  await tx.query(
    `insert into employees (id, ${Object.keys(cols).join(', ')}, changed_by_api_at) values ($1, ${Object.keys(cols).map((_, i) => `$${i + 2}`).join(', ')}, now())`,
    [id, ...Object.values(cols)])
  await recordAudit(tx, { action: 'employee.created', actorUserId: actor.userId, entityType: 'employee', entityId: id, requestId, after: profile })
  if (touchesPay) await recordAudit(tx, { action: 'finance.employee_compensation.changed', actorUserId: actor.userId, entityType: 'employee', entityId: id, requestId, after: payView(pay) })
  return { id }
}

const payView = (pay: Record<string, unknown>) => ({
  ...('base_salary_minor' in pay ? { baseSalaryMinor: pay.base_salary_minor } : {}),
  ...('commission_rate_percent' in pay ? { commissionRatePercent: pay.commission_rate_percent } : {})
})

export async function updateEmployee(tx: Queryable, actor: Actor, id: string, input: Input, requestId: string) {
  const [before] = await tx.query<{ base_salary_minor: string; commission_rate_percent: string | null }>(
    'select base_salary_minor, commission_rate_percent from employees where id = $1 for update', [id])
  if (!before) throw errors.notFound('Karyawan')
  const { touchesPay, touchesProfile } = authorize(actor, input)
  const profile = touchesProfile ? await readProfile(tx, input, false, id) : {}
  const pay = touchesPay ? readPay(input) : {}
  const cols = { ...profile, ...pay }
  const keys = Object.keys(cols)
  await tx.query(
    `update employees set ${keys.map((k, i) => `${k} = $${i + 2}`).join(', ')}${keys.length ? ', ' : ''}changed_by_api_at = now(), updated_at = now() where id = $1`,
    [id, ...Object.values(cols)])
  if (touchesProfile) await recordAudit(tx, { action: 'employee.updated', actorUserId: actor.userId, entityType: 'employee', entityId: id, requestId, after: profile })
  if (touchesPay) {
    await recordAudit(tx, { action: 'finance.employee_compensation.changed', actorUserId: actor.userId, entityType: 'employee', entityId: id, requestId,
      before: { baseSalaryMinor: String(before.base_salary_minor), commissionRatePercent: num(before.commission_rate_percent) }, after: payView(pay) })
  }
}

/* ---------- attendance & reviews (read-only) ---------- */

export async function listAttendance(db: Queryable) {
  const rows = await db.query<Record<string, unknown>>('select * from attendance_records order by date, employee_id')
  return rows.map(r => ({
    id: r.id as string,
    employeeId: r.employee_id as string,
    date: day(r.date)!,
    status: r.status as string,
    checkInAt: str(r.check_in_at),
    checkOutAt: str(r.check_out_at),
    note: str(r.note)
  }))
}

export async function listPerformanceReviews(db: Queryable) {
  const rows = await db.query<Record<string, unknown>>('select * from performance_reviews order by reviewed_on desc, id')
  return rows.map(r => ({
    id: r.id as string,
    employeeId: r.employee_id as string,
    period: r.period as string,
    reviewerId: r.reviewer_id as string,
    deliveryScore: num(r.delivery_score)!,
    qualityScore: num(r.quality_score)!,
    collaborationScore: num(r.collaboration_score)!,
    initiativeScore: num(r.initiative_score)!,
    overallScore: num(r.overall_score)!,
    strengths: str(r.strengths),
    improvements: str(r.improvements),
    reviewedOn: day(r.reviewed_on)!
  }))
}

/* ---------- payroll (hr.manage-payroll only) ---------- */

const PERIOD = /^[0-9]{4}-(0[1-9]|1[0-2])$/
const requirePay = (actor: Actor) => { if (!seesPay(actor)) throw errors.forbidden('Payroll, komisi dan insentif hanya untuk Finance.') }

function readMoney(input: Input, key: string, fe: FieldErrors, allowZero: boolean): string | undefined {
  if (input[key] === undefined) return undefined
  try { return parseAmountMinor(input[key], key, { allowZero }).toString() } catch (e) {
    if (e instanceof AppError) { Object.assign(fe, e.extra.fieldErrors); return undefined }
    throw e
  }
}
function unknownKeys(input: Input, allowed: string[], fe: FieldErrors) {
  for (const k of Object.keys(input)) if (!allowed.includes(k)) fe[k] = ['Field ini tidak dikenal.']
}

const runView = (r: Record<string, unknown>) => ({
  id: r.id as string,
  period: r.period as string,
  status: r.status as string,
  approvedBy: str(r.approved_by),
  approvedOn: day(r.approved_on),
  paidOn: day(r.paid_on)
})

export async function listPayrollRuns(db: Queryable, actor: Actor, id?: string) {
  requirePay(actor)
  return (await db.query<Record<string, unknown>>('select * from payroll_runs where ($1::text is null or id = $1) order by period desc', [id ?? null])).map(runView)
}

export async function listPayrollLines(db: Queryable, actor: Actor, id?: string) {
  requirePay(actor)
  const rows = await db.query<Record<string, unknown>>(
    'select * from payroll_lines where ($1::text is null or id = $1) order by payroll_run_id, employee_id', [id ?? null])
  return rows.map(r => ({
    id: r.id as string,
    payrollRunId: r.payroll_run_id as string,
    employeeId: r.employee_id as string,
    baseSalaryMinor: String(r.base_salary_minor),
    allowanceMinor: String(r.allowance_minor),
    deductionMinor: String(r.deduction_minor),
    note: str(r.note)
  }))
}

/** A draft run for the period with one line per active salaried employee (salary from the employee, nothing else yet). */
export async function createPayrollRun(tx: Queryable, actor: Actor, input: Input, requestId: string) {
  requirePay(actor)
  const fe: FieldErrors = {}
  unknownKeys(input, ['period'], fe)
  const period = typeof input.period === 'string' ? input.period.trim() : ''
  if (!PERIOD.test(period)) fe.period = ['Periode harus berformat YYYY-MM.']
  if (Object.keys(fe).length) throw errors.validation(fe)
  const id = `PRN-${period}`
  // The unique period makes two parallel creates safe: the second inserts nothing.
  const [made] = await tx.query("insert into payroll_runs (id, period, status, changed_by_api_at) values ($1, $2, 'draft', now()) on conflict (period) do nothing returning id", [id, period])
  if (!made) throw rule(`Payroll periode ${period} sudah ada.`)
  const lines = await tx.query<{ id: string }>(
    `insert into payroll_lines (id, payroll_run_id, employee_id, base_salary_minor, changed_by_api_at)
     select 'PRL-' || $1 || '-' || e.id, $1, e.id, e.base_salary_minor, now() from employees e
      where e.status <> 'resigned' and e.base_salary_minor > 0
     returning id`, [id])
  await recordAudit(tx, { action: 'finance.payroll.created', actorUserId: actor.userId, entityType: 'payroll_run', entityId: id, requestId, after: { period, lines: lines.length } })
  return { id }
}

async function lockRun(tx: Queryable, id: string) {
  const [r] = await tx.query<{ status: string }>('select status from payroll_runs where id = $1 for update', [id])
  if (!r) throw errors.notFound('Payroll')
  return r
}

export async function approvePayrollRun(tx: Queryable, actor: Actor, id: string, today: string, requestId: string) {
  requirePay(actor)
  const r = await lockRun(tx, id)
  if (r.status !== 'draft') throw rule('Hanya payroll draft yang bisa disetujui.')
  await tx.query("update payroll_runs set status = 'approved', approved_by = $2, approved_on = $3, changed_by_api_at = now(), updated_at = now() where id = $1", [id, actor.userId, today])
  await recordAudit(tx, { action: 'finance.payroll.approved', actorUserId: actor.userId, entityType: 'payroll_run', entityId: id, requestId })
}

export async function payPayrollRun(tx: Queryable, actor: Actor, id: string, today: string, requestId: string) {
  requirePay(actor)
  const r = await lockRun(tx, id)
  if (r.status !== 'approved') throw rule('Payroll harus disetujui dulu sebelum ditandai dibayar.')
  await tx.query("update payroll_runs set status = 'paid', paid_on = $2, changed_by_api_at = now(), updated_at = now() where id = $1", [id, today])
  await recordAudit(tx, { action: 'finance.payroll.paid', actorUserId: actor.userId, entityType: 'payroll_run', entityId: id, requestId })
}

export async function updatePayrollLine(tx: Queryable, actor: Actor, id: string, input: Input, requestId: string) {
  requirePay(actor)
  const fe: FieldErrors = {}
  unknownKeys(input, ['baseSalaryMinor', 'allowanceMinor', 'deductionMinor', 'note'], fe)
  const cols: Record<string, unknown> = {}
  const base = readMoney(input, 'baseSalaryMinor', fe, true)
  const allowance = readMoney(input, 'allowanceMinor', fe, true)
  const deduction = readMoney(input, 'deductionMinor', fe, true)
  if (base !== undefined) cols.base_salary_minor = base
  if (allowance !== undefined) cols.allowance_minor = allowance
  if (deduction !== undefined) cols.deduction_minor = deduction
  if (input.note !== undefined) {
    if (input.note !== null && typeof input.note !== 'string') fe.note = ['Harus berupa teks.']
    else cols.note = typeof input.note === 'string' && input.note.trim() ? input.note.trim().slice(0, 2000) : null
  }
  if (Object.keys(fe).length) throw errors.validation(fe)
  const [line] = await tx.query<{ payroll_run_id: string }>('select payroll_run_id from payroll_lines where id = $1', [id])
  if (!line) throw errors.notFound('Baris payroll')
  const run = await lockRun(tx, line.payroll_run_id)
  if (run.status !== 'draft') throw rule('Baris payroll hanya bisa diubah selama payroll masih draft.')
  const keys = Object.keys(cols)
  await tx.query(
    `update payroll_lines set ${keys.map((k, i) => `${k} = $${i + 2}`).join(', ')}${keys.length ? ', ' : ''}changed_by_api_at = now(), updated_at = now() where id = $1`,
    [id, ...Object.values(cols)])
  await recordAudit(tx, { action: 'finance.payroll_line.updated', actorUserId: actor.userId, entityType: 'payroll_line', entityId: id, requestId, after: cols })
}

/* ---------- commissions (derived) and incentives ---------- */

/**
 * Commission per project an employee owns (`projects.owner_user_id` → the linked employee with a rate): contract value ×
 * rate, in the month the trip starts; status follows the project (closed → paid, completed → approved, otherwise
 * accrued). Incentives are the manual entries, always approved.
 */
export async function listCommissions(db: Queryable, actor: Actor, incentiveId?: string) {
  requirePay(actor)
  const derived = incentiveId ? [] : await db.query<Record<string, unknown>>(
    `select p.id as project_id, e.id as employee_id, to_char(coalesce(p.travel_start_date, p.created_at::date), 'YYYY-MM') as period,
            p.contract_value_minor as base, e.commission_rate_percent as rate,
            round(p.contract_value_minor * e.commission_rate_percent / 100)::bigint as amount,
            case when p.closed_at is not null then 'paid' when p.status = 'completed' then 'approved' else 'accrued' end as status
       from projects p join employees e on e.user_id = p.owner_user_id
      where e.commission_rate_percent is not null and p.contract_value_minor is not null
      order by p.id`)
  const manual = await db.query<Record<string, unknown>>(
    `select i.*, p.contract_value_minor as base from incentives i join projects p on p.id = i.project_id
      where ($1::text is null or i.id = $1) order by i.id`, [incentiveId ?? null])
  return [
    ...derived.map(r => ({
      id: `COM-${r.project_id}-${r.employee_id}`,
      employeeId: r.employee_id as string,
      projectId: r.project_id as string,
      period: r.period as string,
      baseAmountMinor: String(r.base),
      ratePercent: Number(r.rate),
      amountMinor: String(r.amount),
      status: r.status as string,
      source: 'derived' as const,
      note: null as string | null
    })),
    ...manual.map((r) => {
      const base = r.base === null ? 0 : Number(r.base)
      return {
        id: r.id as string,
        employeeId: r.employee_id as string,
        projectId: r.project_id as string,
        period: r.period as string,
        baseAmountMinor: r.base === null ? '0' : String(r.base),
        ratePercent: base > 0 ? Math.round((Number(r.amount_minor) / base) * 10000) / 100 : 0,
        amountMinor: String(r.amount_minor),
        status: 'approved',
        source: 'manual' as const,
        note: str(r.note)
      }
    })
  ]
}

export async function createIncentive(tx: Queryable, actor: Actor, input: Input, requestId: string) {
  requirePay(actor)
  const fe: FieldErrors = {}
  unknownKeys(input, ['employeeId', 'projectId', 'period', 'amountMinor', 'note'], fe)
  const employeeId = typeof input.employeeId === 'string' ? input.employeeId.trim() : ''
  const projectId = typeof input.projectId === 'string' ? input.projectId.trim() : ''
  const period = typeof input.period === 'string' ? input.period.trim() : ''
  if (!employeeId) fe.employeeId = ['Wajib diisi.']
  if (!projectId) fe.projectId = ['Wajib diisi.']
  if (!PERIOD.test(period)) fe.period = ['Periode harus berformat YYYY-MM.']
  const amount = readMoney(input, 'amountMinor', fe, false)
  if (input.amountMinor === undefined) fe.amountMinor = ['Wajib diisi.']
  if (input.note !== undefined && input.note !== null && typeof input.note !== 'string') fe.note = ['Harus berupa teks.']
  if (Object.keys(fe).length) throw errors.validation(fe)
  const note = typeof input.note === 'string' && input.note.trim() ? input.note.trim().slice(0, 2000) : null
  if (!(await tx.query('select 1 from employees where id = $1', [employeeId])).length) throw rule('Karyawan tidak ditemukan.')
  if (!(await tx.query('select 1 from projects where id = $1', [projectId])).length) throw rule('Project tidak ditemukan.')
  const id = await nextId(tx, 'INS-')
  await tx.query('insert into incentives (id, employee_id, project_id, period, amount_minor, note, changed_by_api_at) values ($1, $2, $3, $4, $5, $6, now())',
    [id, employeeId, projectId, period, amount, note])
  await recordAudit(tx, { action: 'finance.incentive.created', actorUserId: actor.userId, entityType: 'incentive', entityId: id, requestId,
    after: { employeeId, projectId, period, amountMinor: amount } })
  return { id }
}
