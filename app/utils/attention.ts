import { daysUntil } from './format'
import type { Project, Traveler } from '~/types/project'
import type { Invoice } from '~/types/finance'
import type { ProjectTask } from '~/types/activity'
import type { Approval } from '~/types/client-approval'

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

/** Kebijakan DP Group Trip B2C (`confirmGroupTripDp`, `app/data/index.ts`) — global, berlaku sama untuk
 * semua Project B2C (bukan per-project), asumsi aman D-040 sama seperti threshold lain di file ini. */
export const MINIMUM_DP_PERCENT = 30
/** Sisa harga (di luar DP) wajib lunas selambatnya H-14 sebelum `travelStartDate`. */
export const DP_FULL_PAYMENT_DEADLINE_DAYS = 14

/** "Jatuh tempo pelunasan" — cuma tanda peringatan (badge), BUKAN pemicu auto-cancel booking (mockup,
 * keputusan eksplisit: follow-up manual oleh tim Ops). `outstandingIdr` dihitung caller lewat
 * `getSalesOrderOutstandingIdr` (`app/data/index.ts`) supaya file ini tidak bergantung ke modul data. */
export function isDpBalanceOverdue (project: Project, outstandingIdr: number, referenceIso = DEMO_REFERENCE_DATE): boolean {
  if (outstandingIdr <= 0) { return false }
  return daysUntil(project.travelStartDate, referenceIso) < DP_FULL_PAYMENT_DEADLINE_DAYS
}

/** Section 20 — `'void'` (baru, transisi terminal `voidInvoice`) dikecualikan bersama `'paid'`, invoice yang dibatalkan tidak boleh muncul sebagai overdue. */
export function isInvoiceOverdue (invoice: Invoice, referenceIso = DEMO_REFERENCE_DATE): boolean {
  return invoice.status !== 'paid' && invoice.status !== 'void' && daysUntil(invoice.dueAt, referenceIso) < 0
}

/** Aging (Section 15) — negatif berarti sudah lewat jatuh tempo sekian hari, positif berarti masih tersisa sekian hari. */
export function invoiceAgingDays (invoice: Invoice, referenceIso = DEMO_REFERENCE_DATE): number {
  return daysUntil(invoice.dueAt, referenceIso)
}

/** Jendela "invoice akan jatuh tempo" (Repair Phase Section 2 — Dashboard "Invoice near due date") — pola sama `isDocumentExpiringSoon`, TIDAK overlap dengan `isInvoiceOverdue` (belum lewat jatuh tempo). */
export const INVOICE_DUE_SOON_WINDOW_DAYS = 14

export function isInvoiceDueSoon (invoice: Invoice, referenceIso = DEMO_REFERENCE_DATE): boolean {
  if (invoice.status === 'paid' || invoice.status === 'void') { return false }
  const days = daysUntil(invoice.dueAt, referenceIso)
  return days >= 0 && days <= INVOICE_DUE_SOON_WINDOW_DAYS
}

/** "Expired" (Repair Phase Section 3 — Approval Center, Master Prompt bagian G.5) — derivasi, pola sama `isDocumentExpired`. `status` tetap `pending` sampai diputuskan; "Expired" murni tag tampilan untuk approval yang lewat `expiresAt` dan belum diputuskan. */
export function isApprovalExpired (approval: Approval, referenceIso = DEMO_REFERENCE_DATE): boolean {
  if (approval.status !== 'pending' || !approval.expiresAt) { return false }
  return daysUntil(approval.expiresAt, referenceIso) < 0
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
