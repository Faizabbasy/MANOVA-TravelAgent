import type { ID } from './common'

/**
 * Human Resource Management (Revisi 9-Modul, modul 6) — data karyawan, absensi & payroll, komisi &
 * insentif, performance dan productivity tracking.
 *
 * `Employee.userId` menautkan ke `User` yang sudah ada, sehingga komisi bisa diturunkan dari kepemilikan
 * Opportunity/Project tanpa menduplikasi identitas orang di dua tempat.
 */

export type EmploymentType = 'full-time' | 'contract' | 'freelance'
export type EmployeeStatus = 'active' | 'on-leave' | 'resigned'

export interface Employee {
  id: ID
  /** Menaut ke `User.id` bila karyawan ini punya akun sistem. */
  userId?: ID
  name: string
  position: string
  department: string
  employmentType: EmploymentType
  status: EmployeeStatus
  joinedAt: string
  baseSalaryIdr: number
  phone?: string
  email?: string
  /** Persentase komisi dari nilai project yang ia menangkan/tangani. */
  commissionRatePercent?: number
}

export type AttendanceStatus = 'present' | 'remote' | 'leave' | 'sick' | 'absent'

export interface AttendanceRecord {
  id: ID
  employeeId: ID
  date: string
  status: AttendanceStatus
  checkInAt?: string
  checkOutAt?: string
  note?: string
}

export type PayrollRunStatus = 'draft' | 'approved' | 'paid'

export interface PayrollRun {
  id: ID
  /** `YYYY-MM`. */
  period: string
  status: PayrollRunStatus
  approvedBy?: ID
  approvedAt?: string
  paidAt?: string
}

export interface PayrollLine {
  id: ID
  payrollRunId: ID
  employeeId: ID
  baseSalaryIdr: number
  allowanceIdr: number
  commissionIdr: number
  deductionIdr: number
  note?: string
}

export interface CommissionRecord {
  id: ID
  employeeId: ID
  projectId: ID
  /** `YYYY-MM` — periode payroll tempat komisi ini dibayarkan. */
  period: string
  baseAmountIdr: number
  ratePercent: number
  amountIdr: number
  status: 'accrued' | 'approved' | 'paid'
  note?: string
  /** Kosong/'derived' = komisi otomatis dari Project.ownerId (default). 'manual' = insentif yang ditambahkan langsung oleh HR. */
  source?: 'derived' | 'manual'
}

export interface PerformanceReview {
  id: ID
  employeeId: ID
  /** mis. "2026-H1". */
  period: string
  reviewerId: ID
  /** Skala 1–5. */
  deliveryScore: number
  qualityScore: number
  collaborationScore: number
  initiativeScore: number
  overallScore: number
  strengths?: string
  improvements?: string
  reviewedAt: string
}

/** Ringkasan produktivitas — DITURUNKAN dari project/task, bukan angka yang diketik terpisah. */
export interface ProductivitySummary {
  employeeId: ID
  employeeName: string
  position: string
  projectsOwned: number
  projectsCompleted: number
  tasksAssigned: number
  tasksCompleted: number
  taskCompletionPercent: number
  revenueHandledIdr: number
  attendanceRatePercent: number
}
