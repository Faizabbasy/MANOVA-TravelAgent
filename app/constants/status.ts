import type { StatusOption } from '~/types/common'
import type { OpportunityStage, QuotationApprovalStatus, OpportunityWorkflowStatus } from '~/types/opportunity'
import type { ProjectStatus, ProjectCharacteristic, ServiceStatus, ServiceTypeKey, RoomType } from '~/types/project'
import type { InvoiceStatus } from '~/types/finance'
import type { PartyActivityType } from '~/types/party'
import type { VendorQuotationStatus } from '~/types/vendor'
import type { ChangeCategory, ChangeApprovalStatus } from '~/types/activity'
import type { LeadSource, LeadStage, LeadServiceCategory, LeadUrgency } from '~/types/lead'

/**
 * Source of truth untuk seluruh status/enum MANOVA (Prompt 5-G, menggeneralisasi D-038).
 * Setiap status punya value/label/tone(badge)/order — jangan hardcode label status di halaman manapun.
 */

export const OPPORTUNITY_STAGES: StatusOption<OpportunityStage>[] = [
  { value: 'draft', label: 'Draft', tone: 'neutral', order: 1 },
  { value: 'qualification', label: 'Qualification', tone: 'info', order: 2 },
  { value: 'requirement-gathering', label: 'Requirement Gathering', tone: 'info', order: 3 },
  { value: 'proposal', label: 'Proposal / Quotation', tone: 'primary', order: 4 },
  { value: 'negotiation', label: 'Negotiation', tone: 'primary', order: 5 },
  { value: 'won-requested', label: 'Pending Management Approval', tone: 'warning', order: 6 },
  { value: 'won', label: 'Won', tone: 'success', order: 7 },
  { value: 'lost', label: 'Lost', tone: 'destructive', order: 8 },
  { value: 'on-hold', label: 'On Hold', tone: 'warning', order: 9 },
]

export const PROJECT_STATUSES: StatusOption<ProjectStatus>[] = [
  { value: 'draft', label: 'Draft', tone: 'neutral', order: 1 },
  { value: 'planning', label: 'Planning', tone: 'info', order: 2 },
  { value: 'confirmed', label: 'Confirmed', tone: 'primary', order: 3 },
  { value: 'in-progress', label: 'In Progress', tone: 'warning', order: 4 },
  { value: 'ongoing-trip', label: 'Ongoing Trip', tone: 'purple', order: 5 },
  { value: 'completed', label: 'Completed', tone: 'success', order: 6 },
  { value: 'on-hold', label: 'On Hold', tone: 'warning', order: 7 },
  { value: 'cancelled', label: 'Cancelled', tone: 'destructive', order: 8 },
]

export const PROJECT_CHARACTERISTICS: StatusOption<ProjectCharacteristic>[] = [
  { value: 'normal', label: 'Normal Project', tone: 'success', order: 1 },
  { value: 'high-change', label: 'High-Change Project', tone: 'warning', order: 2 },
  { value: 'complex', label: 'Complex Project', tone: 'purple', order: 3 },
]

export const SERVICE_STATUSES: StatusOption<ServiceStatus>[] = [
  { value: 'not-started', label: 'Not Started', tone: 'neutral', order: 1 },
  { value: 'sourcing', label: 'Sourcing', tone: 'info', order: 2 },
  { value: 'quoted', label: 'Quoted', tone: 'info', order: 3 },
  { value: 'pending-confirmation', label: 'Pending Confirmation', tone: 'warning', order: 4 },
  { value: 'confirmed', label: 'Confirmed', tone: 'success', order: 5 },
  { value: 'changed', label: 'Changed', tone: 'warning', order: 6 },
  { value: 'completed', label: 'Completed', tone: 'success', order: 7 },
  { value: 'cancelled', label: 'Cancelled', tone: 'destructive', order: 8 },
]

export const SERVICE_TYPES: StatusOption<ServiceTypeKey>[] = [
  { value: 'flight', label: 'Flight', tone: 'info', order: 1 },
  { value: 'hotel', label: 'Hotel', tone: 'purple', order: 2 },
  { value: 'transportation', label: 'Transportation', tone: 'warning', order: 3 },
  { value: 'mice', label: 'MICE', tone: 'primary', order: 4 },
  { value: 'additional', label: 'Additional Service', tone: 'neutral', order: 5 },
]

/** Jenis kamar rooming list (Section 11) — dipakai tab "Travelers" Project Detail. */
export const ROOM_TYPES: StatusOption<RoomType>[] = [
  { value: 'single', label: 'Single', tone: 'neutral', order: 1 },
  { value: 'twin', label: 'Twin', tone: 'info', order: 2 },
  { value: 'suite', label: 'Suite', tone: 'purple', order: 3 },
]

/** Vendor Quotation status (Section 13) — dipakai tab "Quotations" Vendor Detail dan tab "Vendors" Project Detail. */
export const VENDOR_QUOTATION_STATUSES: StatusOption<VendorQuotationStatus>[] = [
  { value: 'submitted', label: 'Diajukan', tone: 'info', order: 1 },
  { value: 'accepted', label: 'Diterima', tone: 'success', order: 2 },
  { value: 'rejected', label: 'Ditolak', tone: 'destructive', order: 3 },
]

/** Kategori dampak Change entry (Section 14) — dipakai tab "Activity & Changes" Project Detail. */
export const CHANGE_CATEGORIES: StatusOption<ChangeCategory>[] = [
  { value: 'traveler', label: 'Traveler', tone: 'info', order: 1 },
  { value: 'itinerary', label: 'Itinerary', tone: 'primary', order: 2 },
  { value: 'service', label: 'Service', tone: 'purple', order: 3 },
  { value: 'vendor', label: 'Vendor', tone: 'warning', order: 4 },
  { value: 'budget', label: 'Budget', tone: 'destructive', order: 5 },
  { value: 'other', label: 'Lainnya', tone: 'neutral', order: 6 },
]

/** Status approval mock Change entry (Section 14) — terpisah dari flag `reviewed` (LOCKED sejak Section 06). */
export const CHANGE_APPROVAL_STATUSES: StatusOption<ChangeApprovalStatus>[] = [
  { value: 'pending', label: 'Menunggu Approval', tone: 'warning', order: 1 },
  { value: 'approved', label: 'Disetujui', tone: 'success', order: 2 },
  { value: 'rejected', label: 'Ditolak', tone: 'destructive', order: 3 },
]

/** Kategori Activity level-Party (Section 07) — dipakai tab "Activities" Party Detail. */
export const PARTY_ACTIVITY_TYPES: StatusOption<PartyActivityType>[] = [
  { value: 'call', label: 'Telepon', tone: 'info', order: 1 },
  { value: 'meeting', label: 'Meeting', tone: 'primary', order: 2 },
  { value: 'email', label: 'Email', tone: 'neutral', order: 3 },
  { value: 'note', label: 'Catatan', tone: 'neutral', order: 4 },
  { value: 'follow-up', label: 'Follow-up', tone: 'warning', order: 5 },
]

export const INVOICE_STATUSES: StatusOption<InvoiceStatus>[] = [
  { value: 'unpaid', label: 'Belum Dibayar', tone: 'warning', order: 1 },
  { value: 'partially-paid', label: 'Dibayar Sebagian', tone: 'info', order: 2 },
  { value: 'paid', label: 'Lunas', tone: 'success', order: 3 },
]

export const ATTENTION_SEVERITIES: StatusOption<'low' | 'medium' | 'high'>[] = [
  { value: 'low', label: 'Rendah', tone: 'info', order: 1 },
  { value: 'medium', label: 'Sedang', tone: 'warning', order: 2 },
  { value: 'high', label: 'Tinggi', tone: 'destructive', order: 3 },
]

export const TASK_STATUSES: StatusOption<'not-started' | 'in-progress' | 'pending-confirmation' | 'done' | 'overdue'>[] = [
  { value: 'not-started', label: 'Not Started', tone: 'neutral', order: 1 },
  { value: 'in-progress', label: 'In Progress', tone: 'info', order: 2 },
  { value: 'pending-confirmation', label: 'Pending Confirmation', tone: 'warning', order: 3 },
  { value: 'done', label: 'Done', tone: 'success', order: 4 },
  { value: 'overdue', label: 'Overdue', tone: 'destructive', order: 5 },
]

/** Lead source (Prompt 19 — Change Request) — dipakai `/customer-journey/leads`, Lead Source Recap, Activity Center. */
export const LEAD_SOURCES: StatusOption<LeadSource>[] = [
  { value: 'website', label: 'Website', tone: 'info', order: 1 },
  { value: 'instagram', label: 'Instagram', tone: 'purple', order: 2 },
  { value: 'tiktok', label: 'TikTok', tone: 'neutral', order: 3 },
  { value: 'whatsapp', label: 'WhatsApp', tone: 'success', order: 4 },
  { value: 'referral', label: 'Referral', tone: 'primary', order: 5 },
  { value: 'event', label: 'Event', tone: 'warning', order: 6 },
  { value: 'email', label: 'Email', tone: 'info', order: 7 },
  { value: 'sales-outreach', label: 'Sales Outreach', tone: 'primary', order: 8 },
  { value: 'other', label: 'Lainnya', tone: 'neutral', order: 9 },
]

/** Lead stage (Prompt 19) — dipakai Table/Kanban/Inbox view `/customer-journey/leads`. */
export const LEAD_STAGES: StatusOption<LeadStage>[] = [
  { value: 'new', label: 'New', tone: 'neutral', order: 1 },
  { value: 'contacted', label: 'Contacted', tone: 'info', order: 2 },
  { value: 'qualified', label: 'Qualified', tone: 'success', order: 3 },
  { value: 'unqualified', label: 'Unqualified', tone: 'destructive', order: 4 },
]

/** Quotation Commercial Approval (Prompt 19) — dipakai Opportunity Detail (AE submit, Management approve/reject). */
export const QUOTATION_APPROVAL_STATUSES: StatusOption<QuotationApprovalStatus>[] = [
  { value: 'draft', label: 'Draft', tone: 'neutral', order: 1 },
  { value: 'submitted', label: 'Menunggu Approval', tone: 'warning', order: 2 },
  { value: 'approved', label: 'Disetujui', tone: 'success', order: 3 },
  { value: 'rejected', label: 'Ditolak', tone: 'destructive', order: 4 },
]

/** Jenis kebutuhan Lead (Prompt 20 — Change Request) — dipakai form Qualification `/customer-journey/leads`. */
export const LEAD_SERVICE_CATEGORIES: StatusOption<LeadServiceCategory>[] = [
  { value: 'corporate-travel', label: 'Corporate Travel', tone: 'primary', order: 1 },
  { value: 'group-travel', label: 'Group Travel', tone: 'info', order: 2 },
  { value: 'individual-travel', label: 'Individual Travel', tone: 'neutral', order: 3 },
  { value: 'mice-event', label: 'MICE / Event', tone: 'purple', order: 4 },
]

/** Tingkat urgensi Lead (Prompt 20, field opsional form Qualification). */
export const LEAD_URGENCY_LEVELS: StatusOption<LeadUrgency>[] = [
  { value: 'low', label: 'Rendah', tone: 'info', order: 1 },
  { value: 'medium', label: 'Sedang', tone: 'warning', order: 2 },
  { value: 'high', label: 'Tinggi', tone: 'destructive', order: 3 },
]

/**
 * Status workflow Opportunity AE-facing (Prompt 20-10/14) — DIRIVASI lewat `getOpportunityWorkflowStatus`
 * (`app/data/index.ts`), bukan `OpportunityStage` mentah. Label literal sesuai Prompt 20-14 (Bahasa Inggris,
 * berbeda dari konvensi label Indonesia pada status lain — instruksi eksplisit user), dipakai sebagai
 * "indikator stage yang jelas" utama di Opportunity Detail, menggantikan label lama yang membingungkan.
 */
export const OPPORTUNITY_WORKFLOW_STATUSES: StatusOption<OpportunityWorkflowStatus>[] = [
  { value: 'pending-requirement', label: 'Pending Requirement', tone: 'warning', order: 1 },
  { value: 'ready-for-quotation', label: 'Ready for Quotation', tone: 'info', order: 2 },
  { value: 'quotation-draft', label: 'Quotation Draft', tone: 'neutral', order: 3 },
  { value: 'pending-management-approval', label: 'Pending Management Approval', tone: 'warning', order: 4 },
  { value: 'approved', label: 'Approved', tone: 'primary', order: 5 },
  { value: 'won', label: 'Won', tone: 'success', order: 6 },
  { value: 'lost', label: 'Lost', tone: 'destructive', order: 7 },
]

export function findStatusOption<T extends string>(list: StatusOption<T>[], value: T): StatusOption<T> {
  const found = list.find(option => option.value === value)
  if (found) return found
  return { value, label: value, tone: 'neutral', order: 0 }
}
