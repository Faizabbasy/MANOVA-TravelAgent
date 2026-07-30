import { daysUntil } from './format'
import type { Project, Traveler } from '~/types/project'
import type { Invoice } from '~/types/finance'
import type { ProjectTask } from '~/types/activity'
import type { PartyActivity } from '~/types/party'

/**
 * Tanggal acuan "hari ini" untuk seluruh skenario demo (konsisten dengan docs/mockup-data-scenarios.md).
 * Sengaja fixed (bukan `new Date()`) agar demo tidak berubah kondisinya seiring waktu nyata berjalan — lihat D-040.
 */
export const DEMO_REFERENCE_DATE = '2026-07-29'

/** Attention threshold default (D-040) — asumsi aman untuk mockup, bukan angka final bisnis (lihat Q9). */
export const UPCOMING_DEPARTURE_WINDOW_DAYS = 30

/** Jendela "task mendatang" untuk widget dashboard Project Manager (Section 06) — horizon lebih pendek dari keberangkatan. */
export const UPCOMING_TASK_WINDOW_DAYS = 14

/** Jendela "follow-up mendatang" untuk widget dashboard Sales (Section 07). */
export const UPCOMING_FOLLOWUP_WINDOW_DAYS = 14

/** Minimum sisa masa berlaku paspor pada tanggal keberangkatan (Section 11) — aturan umum imigrasi, aturan mockup. */
export const PASSPORT_EXPIRY_WARNING_DAYS = 180

export function isBudgetOverrun(project: Project): boolean {
  return project.actualCostIdr > project.budgetIdr
}

export function isUpcomingDeparture(project: Project, referenceIso = DEMO_REFERENCE_DATE): boolean {
  const days = daysUntil(project.travelStartDate, referenceIso)
  return days >= 0 && days <= UPCOMING_DEPARTURE_WINDOW_DAYS
}

export function isInvoiceOverdue(invoice: Invoice, referenceIso = DEMO_REFERENCE_DATE): boolean {
  return invoice.status !== 'paid' && daysUntil(invoice.dueAt, referenceIso) < 0
}

export function isTaskOverdue(task: ProjectTask): boolean {
  return task.status === 'overdue'
}

export function isTaskUpcoming(task: ProjectTask, referenceIso = DEMO_REFERENCE_DATE): boolean {
  if (!task.dueAt || task.status === 'done' || task.status === 'overdue') return false
  const days = daysUntil(task.dueAt, referenceIso)
  return days >= 0 && days <= UPCOMING_TASK_WINDOW_DAYS
}

export function isFollowUpUpcoming(activity: PartyActivity, referenceIso = DEMO_REFERENCE_DATE): boolean {
  if (!activity.dueAt) return false
  const days = daysUntil(activity.dueAt, referenceIso)
  return days >= 0 && days <= UPCOMING_FOLLOWUP_WINDOW_DAYS
}

/** Missing document indicator (Section 11) — belum ada nomor/tanggal expiry, atau paspor tidak cukup berlaku saat keberangkatan. */
export function isTravelerDocumentMissing(traveler: Traveler, travelStartDate?: string): boolean {
  if (!traveler.passportNumber || !traveler.passportExpiryDate) return true
  if (travelStartDate) {
    const validityRemainingAtTravel = daysUntil(traveler.passportExpiryDate, travelStartDate)
    if (validityRemainingAtTravel < PASSPORT_EXPIRY_WARNING_DAYS) return true
  }
  return false
}

export function hasUnreviewedChange(activities: { isChange: boolean; reviewed: boolean }[]): boolean {
  return activities.some(activity => activity.isChange && !activity.reviewed)
}

export interface ProjectAttentionContext {
  invoices: Invoice[]
  tasks: ProjectTask[]
  activities: { isChange: boolean; reviewed: boolean }[]
}

/** Menentukan apakah sebuah project butuh perhatian (docs/route-and-role-matrix.md bagian 3.3). */
export function isProjectNeedingAttention(project: Project, context: ProjectAttentionContext): boolean {
  if (project.status === 'on-hold') return true
  if (isBudgetOverrun(project)) return true
  if (context.invoices.some(invoice => isInvoiceOverdue(invoice))) return true
  if (context.tasks.some(isTaskOverdue)) return true
  if (hasUnreviewedChange(context.activities)) return true
  return false
}
