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
