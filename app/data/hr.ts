import { reactive } from 'vue'
import type {
  Employee,
  AttendanceRecord,
  PayrollRun,
  PayrollLine,
  CommissionRecord,
  PerformanceReview,
  ProductivitySummary
} from '~/types/hr'
import type { StatusOption } from '~/types/common'
import { PROJECTS } from './projects'
import { TASKS } from './activity'
import { DEMO_REFERENCE_DATE } from '~/utils/attention'

/**
 * Human Resource Management (Revisi 9-Modul, modul 6). Domain baru — sebelumnya tidak ada representasi
 * karyawan sama sekali di codebase ini, hanya `User` (identitas login).
 *
 * `Employee.userId` menautkan keduanya, sehingga produktivitas dan komisi dapat DITURUNKAN dari project
 * dan task yang benar-benar ia pegang, bukan angka yang diisi manual.
 */

export const EMPLOYMENT_TYPES: StatusOption<Employee['employmentType']>[] = [
  { value: 'full-time', label: 'Tetap', tone: 'primary', order: 1 },
  { value: 'contract', label: 'Kontrak', tone: 'info', order: 2 },
  { value: 'freelance', label: 'Freelance', tone: 'neutral', order: 3 }
]

export const EMPLOYEE_STATUSES: StatusOption<Employee['status']>[] = [
  { value: 'active', label: 'Aktif', tone: 'success', order: 1 },
  { value: 'on-leave', label: 'Cuti', tone: 'warning', order: 2 },
  { value: 'resigned', label: 'Keluar', tone: 'neutral', order: 3 }
]

export const ATTENDANCE_STATUSES: StatusOption<AttendanceRecord['status']>[] = [
  { value: 'present', label: 'Hadir', tone: 'success', order: 1 },
  { value: 'remote', label: 'Remote', tone: 'info', order: 2 },
  { value: 'leave', label: 'Cuti', tone: 'warning', order: 3 },
  { value: 'sick', label: 'Sakit', tone: 'warning', order: 4 },
  { value: 'absent', label: 'Alpa', tone: 'destructive', order: 5 }
]

export const PAYROLL_RUN_STATUSES: StatusOption<PayrollRun['status']>[] = [
  { value: 'draft', label: 'Draft', tone: 'neutral', order: 1 },
  { value: 'approved', label: 'Disetujui', tone: 'primary', order: 2 },
  { value: 'paid', label: 'Dibayar', tone: 'success', order: 3 }
]

export const COMMISSION_STATUSES: StatusOption<CommissionRecord['status']>[] = [
  { value: 'accrued', label: 'Terakru', tone: 'neutral', order: 1 },
  { value: 'approved', label: 'Disetujui', tone: 'primary', order: 2 },
  { value: 'paid', label: 'Dibayar', tone: 'success', order: 3 }
]

export const EMPLOYEES: Employee[] = reactive([
  { id: 'EMP-001', userId: 'USR-001', name: 'Rani Kusuma', position: 'Sales Executive', department: 'Sales', employmentType: 'full-time', status: 'active', joinedAt: '2023-03-01', baseSalaryIdr: 9_500_000, commissionRatePercent: 2, phone: '0812-1111-2201', email: 'rani.kusuma@manova.id' },
  { id: 'EMP-002', userId: 'USR-014', name: 'Galih Ramadhan', position: 'Account Executive', department: 'Sales', employmentType: 'full-time', status: 'active', joinedAt: '2022-08-15', baseSalaryIdr: 12_000_000, commissionRatePercent: 2.5, phone: '0812-1111-2202', email: 'galih.ramadhan@manova.id' },
  { id: 'EMP-003', userId: 'USR-002', name: 'Doni Saputra', position: 'Project Manager', department: 'Operations', employmentType: 'full-time', status: 'active', joinedAt: '2021-06-01', baseSalaryIdr: 15_000_000, commissionRatePercent: 1.5, phone: '0812-1111-2203', email: 'doni.saputra@manova.id' },
  { id: 'EMP-004', userId: 'USR-013', name: 'Fitri Handayani', position: 'Project Manager', department: 'Operations', employmentType: 'full-time', status: 'active', joinedAt: '2022-01-10', baseSalaryIdr: 14_000_000, commissionRatePercent: 1.5, phone: '0812-1111-2204', email: 'fitri.handayani@manova.id' },
  { id: 'EMP-005', userId: 'USR-009', name: 'Fajar Nugroho', position: 'Operations Coordinator', department: 'Operations', employmentType: 'full-time', status: 'active', joinedAt: '2023-01-09', baseSalaryIdr: 10_500_000, phone: '0812-1111-2205', email: 'fajar.nugroho@manova.id' },
  { id: 'EMP-006', userId: 'USR-004', name: 'Andi Pratama', position: 'Ticketing Specialist', department: 'Operations', employmentType: 'full-time', status: 'active', joinedAt: '2023-05-02', baseSalaryIdr: 8_500_000, phone: '0812-1111-2206', email: 'andi.pratama@manova.id' },
  { id: 'EMP-007', userId: 'USR-005', name: 'Maya Putri', position: 'Accommodation Specialist', department: 'Operations', employmentType: 'full-time', status: 'on-leave', joinedAt: '2023-07-17', baseSalaryIdr: 8_500_000, phone: '0812-1111-2207', email: 'maya.putri@manova.id' },
  { id: 'EMP-008', userId: 'USR-007', name: 'Lina Marlina', position: 'MICE Coordinator', department: 'Operations', employmentType: 'full-time', status: 'active', joinedAt: '2022-11-21', baseSalaryIdr: 11_000_000, phone: '0812-1111-2208', email: 'lina.marlina@manova.id' },
  { id: 'EMP-009', userId: 'USR-008', name: 'Budi Santoso', position: 'Finance Manager', department: 'Finance', employmentType: 'full-time', status: 'active', joinedAt: '2021-02-15', baseSalaryIdr: 16_000_000, phone: '0812-1111-2209', email: 'budi.santoso@manova.id' },
  { id: 'EMP-010', userId: 'USR-018', name: 'Wulan Kartika', position: 'Procurement Officer', department: 'Vendor & Partner', employmentType: 'full-time', status: 'active', joinedAt: '2023-09-04', baseSalaryIdr: 9_000_000, phone: '0812-1111-2210', email: 'wulan.kartika@manova.id' },
  { id: 'EMP-011', userId: 'USR-025', name: 'Citra Ayu Lestari', position: 'Marketing Specialist', department: 'Marketing', employmentType: 'contract', status: 'active', joinedAt: '2024-02-01', baseSalaryIdr: 8_000_000, phone: '0812-1111-2211', email: 'citra.lestari@manova.id' },
  { id: 'EMP-012', userId: 'USR-023', name: 'Bayu Aditama', position: 'HR Generalist', department: 'HR', employmentType: 'full-time', status: 'active', joinedAt: '2023-04-03', baseSalaryIdr: 9_800_000, phone: '0812-1111-2212', email: 'bayu.aditama@manova.id' },
  { id: 'EMP-013', name: 'Yusuf Maulana', position: 'Tour Leader', department: 'Operations', employmentType: 'freelance', status: 'active', joinedAt: '2024-06-10', baseSalaryIdr: 0, phone: '0812-1111-2213' },
  { id: 'EMP-014', name: 'Sinta Rahmawati', position: 'Tour Leader', department: 'Operations', employmentType: 'freelance', status: 'active', joinedAt: '2024-08-20', baseSalaryIdr: 0, phone: '0812-1111-2214' }
])

/**
 * Absensi bulan berjalan untuk enam karyawan pertama. Sengaja memuat cuti, sakit, dan satu alpa agar
 * rekap kehadiran punya variasi nyata, bukan 100% hadir yang tidak informatif.
 */
function buildAttendanceSeed (): AttendanceRecord[] {
  const records: AttendanceRecord[] = []
  const employees = EMPLOYEES.slice(0, 8)
  /** 20 hari kerja Juli 2026 (Senin–Jumat). */
  const workdays = [
    '2026-07-01', '2026-07-02', '2026-07-03', '2026-07-06', '2026-07-07',
    '2026-07-08', '2026-07-09', '2026-07-10', '2026-07-13', '2026-07-14',
    '2026-07-15', '2026-07-16', '2026-07-17', '2026-07-20', '2026-07-21',
    '2026-07-22', '2026-07-23', '2026-07-24', '2026-07-27', '2026-07-28'
  ]

  const exceptions: Record<string, Record<string, AttendanceRecord['status']>> = {
    'EMP-007': { '2026-07-20': 'leave', '2026-07-21': 'leave', '2026-07-22': 'leave', '2026-07-23': 'leave', '2026-07-24': 'leave', '2026-07-27': 'leave', '2026-07-28': 'leave' },
    'EMP-006': { '2026-07-09': 'sick', '2026-07-10': 'sick' },
    'EMP-005': { '2026-07-16': 'remote', '2026-07-17': 'remote', '2026-07-02': 'absent' },
    'EMP-011': { '2026-07-07': 'remote', '2026-07-14': 'remote', '2026-07-21': 'remote' }
  }

  for (const employee of employees) {
    for (const date of workdays) {
      const status = exceptions[employee.id]?.[date] ?? 'present'
      records.push({
        id: `ATT-${employee.id}-${date}`,
        employeeId: employee.id,
        date,
        status,
        checkInAt: status === 'present' || status === 'remote' ? '08:45' : undefined,
        checkOutAt: status === 'present' || status === 'remote' ? '17:30' : undefined
      })
    }
  }
  return records
}

export const ATTENDANCE_RECORDS: AttendanceRecord[] = reactive(buildAttendanceSeed())

export const PAYROLL_RUNS: PayrollRun[] = reactive([
  { id: 'PRN-2026-06', period: '2026-06', status: 'paid', approvedBy: 'USR-003', approvedAt: '2026-06-24', paidAt: '2026-06-25' },
  { id: 'PRN-2026-07', period: '2026-07', status: 'approved', approvedBy: 'USR-003', approvedAt: '2026-07-24' }
])

function buildPayrollLines (): PayrollLine[] {
  const lines: PayrollLine[] = []
  for (const run of PAYROLL_RUNS) {
    for (const employee of EMPLOYEES.filter(item => item.status !== 'resigned' && item.baseSalaryIdr > 0)) {
      lines.push({
        id: `PRL-${run.id}-${employee.id}`,
        payrollRunId: run.id,
        employeeId: employee.id,
        baseSalaryIdr: employee.baseSalaryIdr,
        /** Tunjangan transport & makan, disederhanakan sebagai persentase tetap dari gaji pokok. */
        allowanceIdr: Math.round(employee.baseSalaryIdr * 0.12),
        commissionIdr: 0,
        deductionIdr: Math.round(employee.baseSalaryIdr * 0.05)
      })
    }
  }
  return lines
}

export const PAYROLL_LINES: PayrollLine[] = reactive(buildPayrollLines())

/**
 * Komisi DITURUNKAN dari project yang benar-benar dipegang karyawan (`Project.ownerId`) dan nilai
 * kontraknya, bukan angka yang diketik manual — konsisten dengan prinsip derivasi di seluruh codebase ini.
 */
function buildCommissions (): CommissionRecord[] {
  const records: CommissionRecord[] = []
  for (const project of PROJECTS) {
    const employee = EMPLOYEES.find(item => item.userId === project.ownerId)
    if (!employee?.commissionRatePercent) { continue }
    const amountIdr = Math.round((project.quotationAmountIdr * employee.commissionRatePercent) / 100)
    records.push({
      id: `COM-${project.id}-${employee.id}`,
      employeeId: employee.id,
      projectId: project.id,
      period: project.travelStartDate.slice(0, 7),
      baseAmountIdr: project.quotationAmountIdr,
      ratePercent: employee.commissionRatePercent,
      amountIdr,
      status: project.closedAt ? 'paid' : project.status === 'completed' ? 'approved' : 'accrued'
    })
  }
  return records
}

export const COMMISSION_RECORDS: CommissionRecord[] = reactive(buildCommissions())

export const PERFORMANCE_REVIEWS: PerformanceReview[] = reactive([
  { id: 'PRV-001', employeeId: 'EMP-002', period: '2026-H1', reviewerId: 'USR-003', deliveryScore: 5, qualityScore: 4, collaborationScore: 5, initiativeScore: 4, overallScore: 4.5, strengths: 'Konsisten menutup deal korporat besar dan menjaga hubungan klien.', improvements: 'Dokumentasi handover ke Operations bisa lebih rinci.', reviewedAt: '2026-07-05' },
  { id: 'PRV-002', employeeId: 'EMP-003', period: '2026-H1', reviewerId: 'USR-003', deliveryScore: 4, qualityScore: 5, collaborationScore: 4, initiativeScore: 4, overallScore: 4.25, strengths: 'Eksekusi project rapi, jarang meleset dari jadwal.', improvements: 'Delegasi ke koordinator perlu ditingkatkan agar tidak jadi bottleneck.', reviewedAt: '2026-07-06' },
  { id: 'PRV-003', employeeId: 'EMP-005', period: '2026-H1', reviewerId: 'USR-002', deliveryScore: 3, qualityScore: 4, collaborationScore: 4, initiativeScore: 3, overallScore: 3.5, strengths: 'Detail dan teliti pada koordinasi lapangan.', improvements: 'Respons terhadap perubahan mendadak perlu lebih cepat.', reviewedAt: '2026-07-08' },
  { id: 'PRV-004', employeeId: 'EMP-008', period: '2026-H1', reviewerId: 'USR-003', deliveryScore: 5, qualityScore: 4, collaborationScore: 5, initiativeScore: 5, overallScore: 4.75, strengths: 'Menangani MICE kompleks dengan koordinasi vendor yang sangat baik.', improvements: 'Estimasi biaya awal kadang terlalu optimistis.', reviewedAt: '2026-07-09' },
  { id: 'PRV-005', employeeId: 'EMP-001', period: '2026-H1', reviewerId: 'USR-014', deliveryScore: 4, qualityScore: 3, collaborationScore: 4, initiativeScore: 4, overallScore: 3.75, strengths: 'Aktif mencari lead baru dari berbagai kanal.', improvements: 'Kualifikasi lead perlu lebih ketat agar konversi naik.', reviewedAt: '2026-07-10' }
])

/* ------------------------------------------------------------------ *
 * Selector
 * ------------------------------------------------------------------ */

export function getEmployeeById (employeeId: string): Employee | undefined {
  return EMPLOYEES.find(employee => employee.id === employeeId)
}

export function getEmployeeByUserId (userId: string): Employee | undefined {
  return EMPLOYEES.find(employee => employee.userId === userId)
}

export function addEmployee (input: Omit<Employee, 'id'>): Employee {
  const employee: Employee = {
    ...input,
    id: `EMP-${String(EMPLOYEES.length + 1).padStart(3, '0')}`
  }
  EMPLOYEES.push(employee)
  return employee
}

export function updateEmployee (employeeId: string, updates: Partial<Omit<Employee, 'id'>>): Employee | undefined {
  const employee = getEmployeeById(employeeId)
  if (!employee) { return undefined }
  Object.assign(employee, updates)
  return employee
}

export function getAttendanceByEmployee (employeeId: string, period?: string): AttendanceRecord[] {
  return ATTENDANCE_RECORDS
    .filter(record => record.employeeId === employeeId && (!period || record.date.startsWith(period)))
    .sort((a, b) => a.date.localeCompare(b.date))
}

export interface AttendanceSummary {
  total: number
  present: number
  remote: number
  leave: number
  sick: number
  absent: number
  ratePercent: number
}

export function getAttendanceSummary (employeeId: string, period?: string): AttendanceSummary {
  const records = getAttendanceByEmployee(employeeId, period)
  const count = (status: AttendanceRecord['status']) => records.filter(record => record.status === status).length
  const present = count('present')
  const remote = count('remote')
  return {
    total: records.length,
    present,
    remote,
    leave: count('leave'),
    sick: count('sick'),
    absent: count('absent'),
    /** Hadir dan remote sama-sama dihitung bekerja; cuti/sakit/alpa tidak. */
    ratePercent: records.length ? Math.round(((present + remote) / records.length) * 100) : 0
  }
}

export function getAttendancePeriods (): string[] {
  return [...new Set(ATTENDANCE_RECORDS.map(record => record.date.slice(0, 7)))].sort().reverse()
}

export function getPayrollLines (payrollRunId: string): PayrollLine[] {
  return PAYROLL_LINES.filter(line => line.payrollRunId === payrollRunId)
}

export function getCommissionsByPeriod (period: string): CommissionRecord[] {
  return COMMISSION_RECORDS.filter(record => record.period === period)
}

export function getCommissionsByEmployee (employeeId: string): CommissionRecord[] {
  return COMMISSION_RECORDS.filter(record => record.employeeId === employeeId)
}

/**
 * Insentif manual — pelengkap Komisi (yang derived dari `Project.ownerId`, lihat `buildCommissions`).
 * Nilai Kontrak diambil dari `Project.quotationAmountIdr` project yang dipilih (sama seperti Komisi
 * otomatis) dan Tarif dihitung balik dari nominal insentif yang diinput, bukan diketik manual.
 * Langsung berstatus 'approved' karena tidak ada UI progres status accrued->approved untuk CommissionRecord
 * di codebase ini; supaya konsisten masuk hitungan Take Home Pay di `getPayrollBreakdown`.
 */
export function addIncentive (input: { projectId: string; employeeId: string; period: string; amountIdr: number; note?: string }): CommissionRecord {
  const baseAmountIdr = PROJECTS.find(project => project.id === input.projectId)?.quotationAmountIdr ?? 0
  const record: CommissionRecord = {
    id: `COM-INC-${String(COMMISSION_RECORDS.length + 1).padStart(3, '0')}`,
    employeeId: input.employeeId,
    projectId: input.projectId,
    period: input.period,
    baseAmountIdr,
    ratePercent: baseAmountIdr > 0 ? Math.round((input.amountIdr / baseAmountIdr) * 10000) / 100 : 0,
    amountIdr: input.amountIdr,
    status: 'approved',
    note: input.note,
    source: 'manual'
  }
  COMMISSION_RECORDS.push(record)
  return record
}

export interface PayrollLineComputed extends PayrollLine {
  employee?: Employee
  netIdr: number
}

/** Baris payroll + komisi periode berjalan; net = pokok + tunjangan + komisi − potongan. */
export function getPayrollBreakdown (payrollRunId: string): PayrollLineComputed[] {
  const run = PAYROLL_RUNS.find(item => item.id === payrollRunId)
  return getPayrollLines(payrollRunId).map((line) => {
    const commissionIdr = run
      ? getCommissionsByPeriod(run.period)
          .filter(record => record.employeeId === line.employeeId && record.status !== 'accrued')
          .reduce((sum, record) => sum + record.amountIdr, 0)
      : 0
    return {
      ...line,
      commissionIdr,
      employee: getEmployeeById(line.employeeId),
      netIdr: line.baseSalaryIdr + line.allowanceIdr + commissionIdr - line.deductionIdr
    }
  })
}

export function getPayrollTotalIdr (payrollRunId: string): number {
  return getPayrollBreakdown(payrollRunId).reduce((sum, line) => sum + line.netIdr, 0)
}

export function updatePayrollLine (lineId: string, updates: Partial<Pick<PayrollLine, 'baseSalaryIdr' | 'allowanceIdr' | 'deductionIdr'>>): PayrollLine | undefined {
  const line = PAYROLL_LINES.find(item => item.id === lineId)
  if (!line) { return undefined }
  Object.assign(line, updates)
  return line
}

export function updatePayrollRunStatus (payrollRunId: string, status: PayrollRun['status'], actorId: string): PayrollRun | undefined {
  const run = PAYROLL_RUNS.find(item => item.id === payrollRunId)
  if (!run) { return undefined }
  run.status = status
  if (status === 'approved') {
    run.approvedBy = actorId
    run.approvedAt = DEMO_REFERENCE_DATE
  }
  if (status === 'paid') { run.paidAt = DEMO_REFERENCE_DATE }
  return run
}

export function getPerformanceReviews (employeeId?: string): PerformanceReview[] {
  const list = employeeId ? PERFORMANCE_REVIEWS.filter(review => review.employeeId === employeeId) : PERFORMANCE_REVIEWS
  return [...list].sort((a, b) => b.reviewedAt.localeCompare(a.reviewedAt))
}

/**
 * Produktivitas — SELURUHNYA derivasi dari project dan task yang benar-benar dipegang karyawan, plus
 * rekap absensi. Tidak ada angka produktivitas yang disimpan terpisah dan bisa basi.
 */
export function getProductivitySummary (period?: string): ProductivitySummary[] {
  return EMPLOYEES
    .filter(employee => employee.status !== 'resigned')
    .map((employee) => {
      const owned = employee.userId ? PROJECTS.filter(project => project.ownerId === employee.userId) : []
      const tasks = employee.userId ? TASKS.filter(task => task.assignedTo === employee.userId) : []
      const tasksCompleted = tasks.filter(task => task.status === 'done').length

      return {
        employeeId: employee.id,
        employeeName: employee.name,
        position: employee.position,
        projectsOwned: owned.length,
        projectsCompleted: owned.filter(project => project.status === 'completed').length,
        tasksAssigned: tasks.length,
        tasksCompleted,
        taskCompletionPercent: tasks.length ? Math.round((tasksCompleted / tasks.length) * 100) : 0,
        revenueHandledIdr: owned.reduce((sum, project) => sum + project.quotationAmountIdr, 0),
        attendanceRatePercent: getAttendanceSummary(employee.id, period).ratePercent
      }
    })
    .sort((a, b) => b.revenueHandledIdr - a.revenueHandledIdr)
}
