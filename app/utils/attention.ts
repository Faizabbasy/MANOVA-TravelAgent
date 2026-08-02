import { daysUntil } from './format'
import type { Project, Traveler } from '~/types/project'
import type { Invoice } from '~/types/finance'
import type { ProjectTask } from '~/types/activity'

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

/** Jendela "dokumen akan kedaluwarsa" (Section 21, Wajib "Categories, versions, expiry, access level") — asumsi aman D-040, sama pola `UPCOMING_DEPARTURE_WINDOW_DAYS`. */
export const DOCUMENT_EXPIRY_WARNING_DAYS = 30

export function isBudgetOverrun (project: Project): boolean {
  return project.actualCostIdr > project.budgetIdr
}

export function isUpcomingDeparture (project: Project, referenceIso = DEMO_REFERENCE_DATE): boolean {
  const days = daysUntil(project.travelStartDate, referenceIso)
  return days >= 0 && days <= UPCOMING_DEPARTURE_WINDOW_DAYS
}

/** Section 20 — `'void'` (baru, transisi terminal `voidInvoice`) dikecualikan bersama `'paid'`, invoice yang dibatalkan tidak boleh muncul sebagai overdue. */
export function isInvoiceOverdue (invoice: Invoice, referenceIso = DEMO_REFERENCE_DATE): boolean {
  return invoice.status !== 'paid' && invoice.status !== 'void' && daysUntil(invoice.dueAt, referenceIso) < 0
}

/** Aging (Section 15) — negatif berarti sudah lewat jatuh tempo sekian hari, positif berarti masih tersisa sekian hari. */
export function invoiceAgingDays (invoice: Invoice, referenceIso = DEMO_REFERENCE_DATE): number {
  return daysUntil(invoice.dueAt, referenceIso)
}

export function isTaskOverdue (task: ProjectTask): boolean {
  return task.status === 'overdue'
}

export function isTaskUpcoming (task: ProjectTask, referenceIso = DEMO_REFERENCE_DATE): boolean {
  if (!task.dueAt || task.status === 'done' || task.status === 'overdue') { return false }
  const days = daysUntil(task.dueAt, referenceIso)
  return days >= 0 && days <= UPCOMING_TASK_WINDOW_DAYS
}

/** Tipe parameter dipersempit ke `{ dueAt? }` (Prompt 19) — direuse untuk `LeadActivity` (shape sama, tanpa `partyId`) tanpa duplikasi logic; `PartyActivity` tetap kompatibel (structural typing). */
export function isFollowUpUpcoming (activity: { dueAt?: string }, referenceIso = DEMO_REFERENCE_DATE): boolean {
  if (!activity.dueAt) { return false }
  const days = daysUntil(activity.dueAt, referenceIso)
  return days >= 0 && days <= UPCOMING_FOLLOWUP_WINDOW_DAYS
}

/**
 * Missing document indicator (Section 11) — belum ada nomor/tanggal expiry paspor, atau paspor tidak cukup
 * berlaku saat keberangkatan. Section 11 (roadmap Section 00–24 baru) menambahkan pengecekan visa —
 * TAPI HANYA bila `visaNumber` sudah diisi (visa opsional, tidak seluruh destinasi mewajibkannya): bila
 * diisi, `visaExpiryDate` wajib ada dan tidak boleh kedaluwarsa sebelum keberangkatan. Traveler tanpa
 * `visaNumber` sama sekali TIDAK terpengaruh perubahan ini (perilaku identik seperti sebelum Section 11 baru).
 */
export function isTravelerDocumentMissing (traveler: Traveler, travelStartDate?: string): boolean {
  if (!traveler.passportNumber || !traveler.passportExpiryDate) { return true }
  if (travelStartDate) {
    const validityRemainingAtTravel = daysUntil(traveler.passportExpiryDate, travelStartDate)
    if (validityRemainingAtTravel < PASSPORT_EXPIRY_WARNING_DAYS) { return true }
  }
  if (traveler.visaNumber) {
    if (!traveler.visaExpiryDate) { return true }
    if (travelStartDate && daysUntil(traveler.visaExpiryDate, travelStartDate) < 0) { return true }
  }
  return false
}

/** Section 21 (Wajib "expiry") — dipakai `/documents` dan tab "Documents" Project Detail untuk badge status kedaluwarsa. */
export function isDocumentExpired (expiresAt: string | undefined, referenceIso = DEMO_REFERENCE_DATE): boolean {
  if (!expiresAt) { return false }
  return daysUntil(expiresAt, referenceIso) < 0
}

/** Section 21 — "akan kedaluwarsa" (belum lewat, tapi dalam jendela peringatan), TIDAK overlap dengan `isDocumentExpired`. */
export function isDocumentExpiringSoon (expiresAt: string | undefined, referenceIso = DEMO_REFERENCE_DATE): boolean {
  if (!expiresAt) { return false }
  const days = daysUntil(expiresAt, referenceIso)
  return days >= 0 && days <= DOCUMENT_EXPIRY_WARNING_DAYS
}

export function hasUnreviewedChange (activities: { isChange: boolean; reviewed: boolean }[]): boolean {
  return activities.some(activity => activity.isChange && !activity.reviewed)
}

export interface ProjectAttentionContext {
  invoices: Invoice[]
  tasks: ProjectTask[]
  activities: { isChange: boolean; reviewed: boolean }[]
}

/** Menentukan apakah sebuah project butuh perhatian (docs/route-and-role-matrix.md bagian 3.3). */
export function isProjectNeedingAttention (project: Project, context: ProjectAttentionContext): boolean {
  if (project.status === 'on-hold') { return true }
  if (isBudgetOverrun(project)) { return true }
  if (context.invoices.some(invoice => isInvoiceOverdue(invoice))) { return true }
  if (context.tasks.some(isTaskOverdue)) { return true }
  if (hasUnreviewedChange(context.activities)) { return true }
  return false
}
