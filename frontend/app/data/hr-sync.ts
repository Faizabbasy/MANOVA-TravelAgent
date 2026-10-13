import { ATTENDANCE_RECORDS, COMMISSION_RECORDS, EMPLOYEES, PAYROLL_LINES, PAYROLL_RUNS, PERFORMANCE_REVIEWS } from './hr'
import type { AttendanceRecord, CommissionRecord, Employee, PayrollLine, PayrollRun, PerformanceReview } from '~/types/hr'
import type {
  AttendanceDto, CommissionDto, EmployeeDto, EmployeeInput, IncentiveInput, PayrollLineDto, PayrollLineInput, PayrollRunDto, PerformanceReviewDto
} from '~/types/api'
import type { ManovaApi } from '~/lib/api/endpoints'
import { isApiError } from '~/lib/api/errors'

/**
 * Server → HR data (S11c). Employees, attendance and reviews load for every internal role; payroll runs, lines and
 * commissions only for holders of `hr.manage-payroll` (Finance, Super Admin). Without it the server sends no pay, so
 * the local payroll lists are emptied and a salary reads as 0 — the HR page hides every amount for those roles.
 * Every change goes to the server first; a refused save leaves the local data as it was.
 */

type CoreApi = Pick<ManovaApi, 'core'>
const opt = <T>(v: T | null | undefined): T | undefined => (v === null ? undefined : v)
const idr = (minor: string | null) => (minor === null ? 0 : Number(minor))
const clean = <T extends object>(o: T): T => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T

export const employeeFromServer = (d: EmployeeDto): Employee => clean({
  id: d.id,
  userId: opt(d.userId),
  name: d.name,
  position: d.position,
  department: d.department,
  employmentType: d.employmentType,
  status: d.status,
  joinedAt: d.joinedOn,
  baseSalaryIdr: idr(d.baseSalaryMinor),
  phone: opt(d.phone),
  email: opt(d.email),
  commissionRatePercent: opt(d.commissionRatePercent)
})
const attendanceFromServer = (d: AttendanceDto): AttendanceRecord => clean({
  id: d.id, employeeId: d.employeeId, date: d.date, status: d.status, checkInAt: opt(d.checkInAt), checkOutAt: opt(d.checkOutAt), note: opt(d.note)
})
const reviewFromServer = (d: PerformanceReviewDto): PerformanceReview => clean({
  id: d.id,
  employeeId: d.employeeId,
  period: d.period,
  reviewerId: d.reviewerId,
  deliveryScore: d.deliveryScore,
  qualityScore: d.qualityScore,
  collaborationScore: d.collaborationScore,
  initiativeScore: d.initiativeScore,
  overallScore: d.overallScore,
  strengths: opt(d.strengths),
  improvements: opt(d.improvements),
  reviewedAt: d.reviewedOn
})
const runFromServer = (d: PayrollRunDto): PayrollRun => clean({
  id: d.id, period: d.period, status: d.status, approvedBy: opt(d.approvedBy), approvedAt: opt(d.approvedOn), paidAt: opt(d.paidOn)
})
const lineFromServer = (d: PayrollLineDto): PayrollLine => clean({
  id: d.id,
  payrollRunId: d.payrollRunId,
  employeeId: d.employeeId,
  baseSalaryIdr: Number(d.baseSalaryMinor),
  allowanceIdr: Number(d.allowanceMinor),
  // Commissions are added per period by getPayrollBreakdown; the line itself carries none.
  commissionIdr: 0,
  deductionIdr: Number(d.deductionMinor),
  note: opt(d.note)
})
const commissionFromServer = (d: CommissionDto): CommissionRecord => clean({
  id: d.id,
  employeeId: d.employeeId,
  projectId: d.projectId,
  period: d.period,
  baseAmountIdr: Number(d.baseAmountMinor),
  ratePercent: d.ratePercent,
  amountIdr: Number(d.amountMinor),
  status: d.status,
  note: opt(d.note),
  source: d.source
})

function overwrite<T extends { id: string }> (target: T, value: T): T {
  for (const key of Object.keys(target)) { if (!(key in value)) { delete (target as Record<string, unknown>)[key] } }
  return Object.assign(target, value)
}
function replaceList<T extends { id: string }> (list: T[], rows: T[]): void {
  const next = rows.map((row) => {
    const local = list.find(item => item.id === row.id)
    return local ? overwrite(local, row) : row
  })
  list.splice(0, list.length, ...next)
}
function upsert<T extends { id: string }> (list: T[], value: T): T {
  const local = list.find(item => item.id === value.id)
  if (local) { return overwrite(local, value) }
  list.push(value)
  return list[list.length - 1]!
}

export interface HrServerData {
  employees: EmployeeDto[]
  attendance: AttendanceDto[]
  reviews: PerformanceReviewDto[]
  /** `null` for roles without `hr.manage-payroll`. */
  pay: { runs: PayrollRunDto[]; lines: PayrollLineDto[]; commissions: CommissionDto[] } | null
}

export function mergeServerHr (data: HrServerData): void {
  replaceList(EMPLOYEES, data.employees.map(employeeFromServer))
  replaceList(ATTENDANCE_RECORDS, data.attendance.map(attendanceFromServer))
  replaceList(PERFORMANCE_REVIEWS, data.reviews.map(reviewFromServer))
  // Runs are kept oldest first, as the page takes the last one as the latest period.
  replaceList(PAYROLL_RUNS, (data.pay?.runs ?? []).map(runFromServer).sort((a, b) => a.period.localeCompare(b.period)))
  replaceList(PAYROLL_LINES, (data.pay?.lines ?? []).map(lineFromServer))
  replaceList(COMMISSION_RECORDS, (data.pay?.commissions ?? []).map(commissionFromServer))
}

export async function loadServerHr (api: CoreApi, withPay: boolean): Promise<void> {
  const [employees, attendance, reviews] = await Promise.all([api.core.listEmployees(), api.core.listAttendance(), api.core.listPerformanceReviews()])
  const pay = withPay
    ? await Promise.all([api.core.listPayrollRuns(), api.core.listPayrollLines(), api.core.listCommissions()])
      .then(([runs, lines, commissions]) => ({ runs: runs.data, lines: lines.data, commissions: commissions.data }))
    : null
  mergeServerHr({ employees: employees.data, attendance: attendance.data, reviews: reviews.data, pay })
}

export async function createEmployeeOnServer (api: CoreApi, input: EmployeeInput): Promise<Employee> {
  return upsert(EMPLOYEES, employeeFromServer((await api.core.createEmployee(input)).data))
}
export async function updateEmployeeOnServer (api: CoreApi, id: string, input: EmployeeInput): Promise<Employee> {
  return upsert(EMPLOYEES, employeeFromServer((await api.core.updateEmployee(id, input)).data))
}

/** The server makes the run's lines, so runs and lines are reloaded after it. */
export async function createPayrollRunOnServer (api: CoreApi, period: string): Promise<PayrollRun> {
  const created = runFromServer((await api.core.createPayrollRun(period)).data)
  const [runs, lines] = await Promise.all([api.core.listPayrollRuns(), api.core.listPayrollLines()])
  replaceList(PAYROLL_RUNS, runs.data.map(runFromServer).sort((a, b) => a.period.localeCompare(b.period)))
  replaceList(PAYROLL_LINES, lines.data.map(lineFromServer))
  return PAYROLL_RUNS.find(r => r.id === created.id) ?? created
}
export async function approvePayrollRunOnServer (api: CoreApi, id: string): Promise<PayrollRun> {
  return upsert(PAYROLL_RUNS, runFromServer((await api.core.approvePayrollRun(id)).data))
}
export async function payPayrollRunOnServer (api: CoreApi, id: string): Promise<PayrollRun> {
  return upsert(PAYROLL_RUNS, runFromServer((await api.core.payPayrollRun(id)).data))
}
export async function updatePayrollLineOnServer (api: CoreApi, id: string, input: PayrollLineInput): Promise<PayrollLine> {
  return upsert(PAYROLL_LINES, lineFromServer((await api.core.updatePayrollLine(id, input)).data))
}
export async function createIncentiveOnServer (api: CoreApi, input: IncentiveInput): Promise<CommissionRecord> {
  return upsert(COMMISSION_RECORDS, commissionFromServer((await api.core.createIncentive(input)).data))
}

export interface HrSyncState {
  status: 'idle' | 'loading' | 'ready' | 'offline' | 'error'
  userId: string | null
  message: string | null
}

/** Loads HR data once per signed-in user (dashboard layout, "Reset Demo Data"); pay only with `hr.manage-payroll`. */
export function useHrSync () {
  const api = useApi()
  const session = useServerSession()
  const { currentUser } = useCurrentUser()
  const { can } = usePermissions()
  const state = useState<HrSyncState>('manova-hr-sync', () => ({ status: 'idle', userId: null, message: null }))

  async function load (force = false) {
    const userId = currentUser.value.id
    if (!force && state.value.userId === userId && (state.value.status === 'ready' || state.value.status === 'loading')) { return }
    state.value = { status: 'loading', userId, message: null }
    try {
      await session.ensure()
      await loadServerHr(api, can('hr.manage-payroll'))
      state.value = { status: 'ready', userId, message: null }
    } catch (error) {
      const offline = isApiError(error) && (error.status === 0 || error.status >= 500)
      state.value = { status: offline ? 'offline' : 'error', userId, message: isApiError(error) ? error.message : 'Data HR belum bisa dimuat dari server.' }
    }
  }

  return { state, load }
}
