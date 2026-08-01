import type { StatusOption } from '~/types/common'
import type { OpportunityStage, QuotationApprovalStatus, OpportunityWorkflowStatus } from '~/types/opportunity'
import type { ProjectStatus, ProjectCharacteristic, ServiceStatus, ServiceTypeKey, RoomType, ProjectOrderStatus } from '~/types/project'
import type { InvoiceStatus, InvoiceCurrency, InvoiceType, CreditNoteStatus, DebitNoteStatus } from '~/types/finance'
import type { PartyActivityType } from '~/types/party'
import type { VendorQuotationStatus, VendorStatus } from '~/types/vendor'
import type { ChangeCategory, ChangeApprovalStatus, ProjectRiskSeverity, ProjectRiskStatus } from '~/types/activity'
import type { LeadSource, LeadStage, LeadServiceCategory, LeadUrgency } from '~/types/lead'
import type { FlightBookingStatus, CabinClass } from '~/types/ticketing'
import type { HotelBookingStatus, MealPlan } from '~/types/accommodation'
import type { TransportBookingStatus, VehicleType } from '~/types/transportation'
import type { MiceEventStatus, MiceApprovalStatus, MiceBoqCategory, MiceChecklistTask } from '~/types/mice'
import type { RFQStatus, ServiceOrderStatus, SupplierInvoiceStatus, SupplierInvoiceMatchStatus } from '~/types/procurement'
import type { BookingPaymentGateStatus, BookingAttemptOutcome } from '~/types/booking-orchestration'
import type { ChangeRequestSource, ChangeRequestStatus, RefundRequestStatus, IncidentSeverity, IncidentStatus, RefundRequest } from '~/types/change-incident'
import type { DocumentAccessLevel, DocumentEntityType, MessageChannel, MessageDeliveryStatus, NotificationType } from '~/types/document-comms'

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

/** "Project Order Status" (Section 09 — roadmap Section 00–24 baru, D-066) — dirivasi, lihat `getProjectOrderStatus` (`app/data/index.ts`) dan komentar `ProjectOrderStatus` (`app/types/project.ts`). */
export const PROJECT_ORDER_STATUSES: StatusOption<ProjectOrderStatus>[] = [
  { value: 'created', label: 'Created', tone: 'neutral', order: 1 },
  { value: 'handover-pending', label: 'Handover Pending', tone: 'warning', order: 2 },
  { value: 'planning', label: 'Planning', tone: 'info', order: 3 },
  { value: 'confirmed', label: 'Confirmed', tone: 'primary', order: 4 },
  { value: 'ready', label: 'Ready', tone: 'purple', order: 5 },
  { value: 'in-progress', label: 'In Progress', tone: 'warning', order: 6 },
  { value: 'completed', label: 'Completed', tone: 'success', order: 7 },
  { value: 'closed', label: 'Closed', tone: 'success', order: 8 },
  { value: 'on-hold', label: 'On Hold', tone: 'warning', order: 9 },
  { value: 'cancelled', label: 'Cancelled', tone: 'destructive', order: 10 },
]

/** Risk severity/status (Section 09) — dipakai tab Overview Project Detail, section "Risks". */
export const RISK_SEVERITIES: StatusOption<ProjectRiskSeverity>[] = [
  { value: 'low', label: 'Low', tone: 'neutral', order: 1 },
  { value: 'medium', label: 'Medium', tone: 'warning', order: 2 },
  { value: 'high', label: 'High', tone: 'destructive', order: 3 },
]
export const RISK_STATUSES: StatusOption<ProjectRiskStatus>[] = [
  { value: 'open', label: 'Open', tone: 'warning', order: 1 },
  { value: 'mitigated', label: 'Mitigated', tone: 'info', order: 2 },
  { value: 'closed', label: 'Closed', tone: 'success', order: 3 },
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

/** Lifecycle vendor sebagai partner (Section 17, `Vendor.status` aditif) — dipakai list/detail `/vendors`. */
export const VENDOR_STATUSES: StatusOption<VendorStatus>[] = [
  { value: 'active', label: 'Aktif', tone: 'success', order: 1 },
  { value: 'pending', label: 'Pending Approval', tone: 'warning', order: 2 },
  { value: 'inactive', label: 'Nonaktif', tone: 'neutral', order: 3 },
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

/** Section 20 — `'void'` ditambahkan (transisi terminal baru, `voidInvoice`). */
export const INVOICE_STATUSES: StatusOption<InvoiceStatus>[] = [
  { value: 'unpaid', label: 'Belum Dibayar', tone: 'warning', order: 1 },
  { value: 'partially-paid', label: 'Dibayar Sebagian', tone: 'info', order: 2 },
  { value: 'paid', label: 'Lunas', tone: 'success', order: 3 },
  { value: 'void', label: 'Void', tone: 'neutral', order: 4 },
]

/** Multi-currency display (Section 20, Wajib) — dipakai `/finance/invoices`, tab Finance Project Detail. */
export const INVOICE_CURRENCIES: StatusOption<InvoiceCurrency>[] = [
  { value: 'IDR', label: 'IDR', tone: 'neutral', order: 1 },
  { value: 'USD', label: 'USD', tone: 'info', order: 2 },
  { value: 'SGD', label: 'SGD', tone: 'info', order: 3 },
  { value: 'EUR', label: 'EUR', tone: 'info', order: 4 },
]

/** Termin/tipe invoice (Section 20, Wajib "Client invoice, DP"). */
export const INVOICE_TYPES: StatusOption<InvoiceType>[] = [
  { value: 'dp', label: 'Down Payment', tone: 'primary', order: 1 },
  { value: 'progress', label: 'Termin/Progress', tone: 'info', order: 2 },
  { value: 'final', label: 'Final', tone: 'success', order: 3 },
]

/** AP reconciliation match status (Section 20, Wajib) — dipakai `/finance/reconciliation`, AP summary tab Finance Project Detail. */
export const SUPPLIER_INVOICE_MATCH_STATUSES: StatusOption<SupplierInvoiceMatchStatus>[] = [
  { value: 'matched', label: 'Matched', tone: 'success', order: 1 },
  { value: 'unmatched', label: 'Unmatched', tone: 'warning', order: 2 },
  { value: 'disputed', label: 'Disputed', tone: 'destructive', order: 3 },
]

/** Credit Note (Section 20, Wajib) — dipakai `/finance/notes`. */
export const CREDIT_NOTE_STATUSES: StatusOption<CreditNoteStatus>[] = [
  { value: 'issued', label: 'Diterbitkan', tone: 'info', order: 1 },
  { value: 'applied', label: 'Diterapkan', tone: 'success', order: 2 },
]

/** Debit Note (Section 20, Wajib) — dipakai `/finance/notes`. */
export const DEBIT_NOTE_STATUSES: StatusOption<DebitNoteStatus>[] = [
  { value: 'issued', label: 'Diterbitkan', tone: 'warning', order: 1 },
  { value: 'settled', label: 'Diselesaikan', tone: 'success', order: 2 },
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
  { value: 'client-portal', label: 'Client Portal (Repeat Request)', tone: 'success', order: 9 },
  { value: 'other', label: 'Lainnya', tone: 'neutral', order: 10 },
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

/** "Hold, Confirm, Issue, Reissue, Cancel, Refund state simulation" (Section 13, Wajib) — dipakai `/ticketing`. */
export const FLIGHT_BOOKING_STATUSES: StatusOption<FlightBookingStatus>[] = [
  { value: 'requested', label: 'Requested', tone: 'neutral', order: 1 },
  { value: 'hold', label: 'Hold', tone: 'warning', order: 2 },
  { value: 'confirmed', label: 'Confirmed', tone: 'info', order: 3 },
  { value: 'issued', label: 'Issued', tone: 'success', order: 4 },
  { value: 'reissued', label: 'Reissued', tone: 'purple', order: 5 },
  { value: 'cancelled', label: 'Cancelled', tone: 'destructive', order: 6 },
  { value: 'refunded', label: 'Refunded', tone: 'neutral', order: 7 },
]

/** Cabin class (Section 13) — dipakai perbandingan Flight Option. */
export const CABIN_CLASSES: StatusOption<CabinClass>[] = [
  { value: 'economy', label: 'Economy', tone: 'neutral', order: 1 },
  { value: 'premium-economy', label: 'Premium Economy', tone: 'info', order: 2 },
  { value: 'business', label: 'Business', tone: 'purple', order: 3 },
  { value: 'first', label: 'First', tone: 'warning', order: 4 },
]

/** "Quote, booking, confirmation, voucher" + "Amendment, cancellation, no-show" (Section 14, Wajib) — dipakai `/accommodation`. */
export const HOTEL_BOOKING_STATUSES: StatusOption<HotelBookingStatus>[] = [
  { value: 'requested', label: 'Requested', tone: 'neutral', order: 1 },
  { value: 'quoted', label: 'Quoted', tone: 'info', order: 2 },
  { value: 'confirmed', label: 'Confirmed', tone: 'success', order: 3 },
  { value: 'amended', label: 'Amended', tone: 'purple', order: 4 },
  { value: 'completed', label: 'Completed', tone: 'success', order: 5 },
  { value: 'cancelled', label: 'Cancelled', tone: 'destructive', order: 6 },
  { value: 'no-show', label: 'No-Show', tone: 'destructive', order: 7 },
]

/** Meal plan (Section 14) — dipakai perbandingan Hotel Option. */
export const MEAL_PLANS: StatusOption<MealPlan>[] = [
  { value: 'room-only', label: 'Room Only', tone: 'neutral', order: 1 },
  { value: 'breakfast', label: 'Breakfast', tone: 'info', order: 2 },
  { value: 'half-board', label: 'Half Board', tone: 'purple', order: 3 },
  { value: 'full-board', label: 'Full Board', tone: 'warning', order: 4 },
]

/** "Quote, assignment, confirmation, service order, driver sheet" + "Change, cancellation, incident, no-show" (Section 15, Wajib) — dipakai `/transportation`. */
export const TRANSPORT_BOOKING_STATUSES: StatusOption<TransportBookingStatus>[] = [
  { value: 'requested', label: 'Requested', tone: 'neutral', order: 1 },
  { value: 'quoted', label: 'Quoted', tone: 'info', order: 2 },
  { value: 'assigned', label: 'Assigned', tone: 'purple', order: 3 },
  { value: 'confirmed', label: 'Confirmed', tone: 'success', order: 4 },
  { value: 'completed', label: 'Completed', tone: 'success', order: 5 },
  { value: 'cancelled', label: 'Cancelled', tone: 'destructive', order: 6 },
  { value: 'no-show', label: 'No-Show', tone: 'destructive', order: 7 },
]

/** Vehicle type (Section 15) — dipakai perbandingan Transport Option. */
export const VEHICLE_TYPES: StatusOption<VehicleType>[] = [
  { value: 'sedan', label: 'Sedan', tone: 'neutral', order: 1 },
  { value: 'suv', label: 'SUV', tone: 'info', order: 2 },
  { value: 'van', label: 'Van', tone: 'purple', order: 3 },
  { value: 'minibus', label: 'Minibus', tone: 'warning', order: 4 },
  { value: 'bus', label: 'Bus', tone: 'primary', order: 5 },
]

/** Acceptance "MICE role dapat mengelola event dari planning sampai post-event completion" (Section 16, Wajib) — dipakai `/mice`. */
export const MICE_EVENT_STATUSES: StatusOption<MiceEventStatus>[] = [
  { value: 'planning', label: 'Planning', tone: 'neutral', order: 1 },
  { value: 'confirmed', label: 'Confirmed', tone: 'info', order: 2 },
  { value: 'in-progress', label: 'In Progress', tone: 'warning', order: 3 },
  { value: 'completed', label: 'Completed', tone: 'success', order: 4 },
  { value: 'cancelled', label: 'Cancelled', tone: 'destructive', order: 5 },
]

/** "Client approval states" (Section 16, Wajib) — terpisah dari `MiceEventStatus`, pola sama `QuotationApprovalStatus`. */
export const MICE_APPROVAL_STATUSES: StatusOption<MiceApprovalStatus>[] = [
  { value: 'draft', label: 'Draft', tone: 'neutral', order: 1 },
  { value: 'submitted', label: 'Menunggu Approval Client', tone: 'warning', order: 2 },
  { value: 'approved', label: 'Disetujui', tone: 'success', order: 3 },
  { value: 'rejected', label: 'Ditolak', tone: 'destructive', order: 4 },
]

/** "Catering, AV, staging, equipment, booths" (Section 16, Wajib) — dipakai Bill of Quantities (BOQ). */
export const MICE_BOQ_CATEGORIES: StatusOption<MiceBoqCategory>[] = [
  { value: 'catering', label: 'Catering', tone: 'info', order: 1 },
  { value: 'av', label: 'AV (Audio Visual)', tone: 'purple', order: 2 },
  { value: 'staging', label: 'Staging', tone: 'warning', order: 3 },
  { value: 'equipment', label: 'Equipment', tone: 'primary', order: 4 },
  { value: 'booth', label: 'Booth', tone: 'neutral', order: 5 },
  { value: 'other', label: 'Lainnya', tone: 'neutral', order: 6 },
]

/** "Setup/teardown/rehearsal/permit checklist" (Section 16, Wajib). */
export const MICE_CHECKLIST_TASKS: StatusOption<MiceChecklistTask>[] = [
  { value: 'permit', label: 'Permit', tone: 'warning', order: 1 },
  { value: 'setup', label: 'Setup', tone: 'info', order: 2 },
  { value: 'rehearsal', label: 'Rehearsal', tone: 'purple', order: 3 },
  { value: 'teardown', label: 'Teardown', tone: 'neutral', order: 4 },
]

/** RFQ lifecycle (Section 17, Wajib) — dipakai `/procurement/rfq/[id]` dan `/supplier/rfq`. */
export const RFQ_STATUSES: StatusOption<RFQStatus>[] = [
  { value: 'draft', label: 'Draft', tone: 'neutral', order: 1 },
  { value: 'sent', label: 'Terkirim', tone: 'info', order: 2 },
  { value: 'responses-in', label: 'Respons Masuk', tone: 'info', order: 3 },
  { value: 'comparison', label: 'Comparison', tone: 'purple', order: 4 },
  { value: 'clarification', label: 'Klarifikasi', tone: 'warning', order: 5 },
  { value: 'selected', label: 'Vendor Terpilih', tone: 'primary', order: 6 },
  { value: 'closed', label: 'Closed', tone: 'success', order: 7 },
]

/** Service Order lifecycle (Section 17, Wajib) — dipakai `/procurement/service-orders/[id]` dan `/supplier/service-orders`. */
export const SERVICE_ORDER_STATUSES: StatusOption<ServiceOrderStatus>[] = [
  { value: 'draft', label: 'Draft', tone: 'neutral', order: 1 },
  { value: 'sent', label: 'Terkirim', tone: 'info', order: 2 },
  { value: 'acknowledged', label: 'Diakui Supplier', tone: 'primary', order: 3 },
  { value: 'amended', label: 'Diamandemen', tone: 'purple', order: 4 },
  { value: 'fulfilled', label: 'Fulfilled', tone: 'success', order: 5 },
  { value: 'cancelled', label: 'Cancelled', tone: 'destructive', order: 6 },
]

/** Supplier Invoice status (Section 17, Wajib — preview/mock murni, resolusi Q12) — dipakai `/procurement` dan `/supplier/service-orders/[id]`. */
export const SUPPLIER_INVOICE_STATUSES: StatusOption<SupplierInvoiceStatus>[] = [
  { value: 'submitted', label: 'Diajukan', tone: 'info', order: 1 },
  { value: 'under-review', label: 'Sedang Direview', tone: 'warning', order: 2 },
  { value: 'approved', label: 'Disetujui', tone: 'success', order: 3 },
  { value: 'rejected', label: 'Ditolak', tone: 'destructive', order: 4 },
]

/** "Confirmation and payment gates" (Section 18, Wajib) — mock gate finansial murni (D-006), dipakai `/bookings` dan tab Itinerary & Services. */
export const BOOKING_PAYMENT_GATE_STATUSES: StatusOption<BookingPaymentGateStatus>[] = [
  { value: 'not-required', label: 'Belum Relevan', tone: 'neutral', order: 1 },
  { value: 'pending', label: 'Menunggu Pembayaran', tone: 'warning', order: 2 },
  { value: 'cleared', label: 'Lunas', tone: 'success', order: 3 },
]

/** "Failure/retry/manual fallback simulation" (Section 18, Wajib) — narasi/log murni (D-006), dipakai `/bookings`. */
export const BOOKING_ATTEMPT_OUTCOMES: StatusOption<BookingAttemptOutcome>[] = [
  { value: 'success', label: 'Berhasil', tone: 'success', order: 1 },
  { value: 'failed', label: 'Gagal', tone: 'destructive', order: 2 },
  { value: 'manual-fallback', label: 'Manual Fallback', tone: 'warning', order: 3 },
]

/** Sumber Change Request (Section 19, Wajib "Change request dari Client/Internal/Supplier") — dipakai `/changes`. */
export const CHANGE_REQUEST_SOURCES: StatusOption<ChangeRequestSource>[] = [
  { value: 'client', label: 'Client', tone: 'info', order: 1 },
  { value: 'internal', label: 'Internal', tone: 'primary', order: 2 },
  { value: 'supplier', label: 'Supplier', tone: 'warning', order: 3 },
]

/** Status lifecycle Change Request (Section 19, Wajib "Approval states") — dipakai `/changes`. */
export const CHANGE_REQUEST_STATUSES: StatusOption<ChangeRequestStatus>[] = [
  { value: 'submitted', label: 'Diajukan', tone: 'neutral', order: 1 },
  { value: 'under-review', label: 'Sedang Direview', tone: 'warning', order: 2 },
  { value: 'approved', label: 'Disetujui', tone: 'success', order: 3 },
  { value: 'rejected', label: 'Ditolak', tone: 'destructive', order: 4 },
  { value: 'implemented', label: 'Diimplementasikan', tone: 'purple', order: 5 },
]

/** Status lifecycle Refund Request (Section 19, Wajib "Refund request, approval, partial/full") — dipakai `/changes`. */
export const REFUND_REQUEST_STATUSES: StatusOption<RefundRequestStatus>[] = [
  { value: 'requested', label: 'Diajukan', tone: 'neutral', order: 1 },
  { value: 'under-review', label: 'Sedang Direview', tone: 'warning', order: 2 },
  { value: 'approved', label: 'Disetujui', tone: 'success', order: 3 },
  { value: 'rejected', label: 'Ditolak', tone: 'destructive', order: 4 },
  { value: 'processed', label: 'Diproses', tone: 'purple', order: 5 },
]

/** `RefundRequest.creditStatus` (Section 19) — field mock self-contained, BUKAN integrasi `CreditNote` nyata (forward dependency Section 20, `docs/frontend-known-issues.md` bagian 15). */
export const REFUND_CREDIT_STATUSES: StatusOption<RefundRequest['creditStatus']>[] = [
  { value: 'pending', label: 'Menunggu', tone: 'warning', order: 1 },
  { value: 'issued', label: 'Diterbitkan', tone: 'success', order: 2 },
  { value: 'not-applicable', label: 'Tidak Berlaku', tone: 'neutral', order: 3 },
]

/** Severity Incident (Section 19, Wajib) — dipakai `/changes`. */
export const INCIDENT_SEVERITIES: StatusOption<IncidentSeverity>[] = [
  { value: 'low', label: 'Rendah', tone: 'neutral', order: 1 },
  { value: 'medium', label: 'Sedang', tone: 'warning', order: 2 },
  { value: 'high', label: 'Tinggi', tone: 'destructive', order: 3 },
  { value: 'critical', label: 'Kritis', tone: 'destructive', order: 4 },
]

/** Status lifecycle Incident (Section 19, Wajib "Owner, escalation, communication, resolution") — dipakai `/changes`. */
export const INCIDENT_STATUSES: StatusOption<IncidentStatus>[] = [
  { value: 'open', label: 'Open', tone: 'neutral', order: 1 },
  { value: 'investigating', label: 'Investigating', tone: 'info', order: 2 },
  { value: 'escalated', label: 'Escalated', tone: 'destructive', order: 3 },
  { value: 'resolved', label: 'Resolved', tone: 'success', order: 4 },
  { value: 'closed', label: 'Closed', tone: 'neutral', order: 5 },
]

/** Entitas pemilik dokumen/pesan (Section 21) — dipakai `/documents` (dialog upload/compose) dan `getUnifiedActivityTimeline`. */
export const DOCUMENT_ENTITY_TYPES: StatusOption<DocumentEntityType>[] = [
  { value: 'project', label: 'Project', tone: 'neutral', order: 1 },
  { value: 'party', label: 'Party (Company)', tone: 'info', order: 2 },
  { value: 'vendor', label: 'Vendor', tone: 'warning', order: 3 },
  { value: 'traveler', label: 'Traveler', tone: 'neutral', order: 4 },
  { value: 'quotation', label: 'Quotation', tone: 'primary', order: 5 },
  { value: 'flight', label: 'Flight', tone: 'info', order: 6 },
  { value: 'hotel', label: 'Hotel', tone: 'info', order: 7 },
  { value: 'transport', label: 'Transport', tone: 'info', order: 8 },
  { value: 'mice', label: 'MICE', tone: 'info', order: 9 },
  { value: 'invoice', label: 'Invoice', tone: 'success', order: 10 },
  { value: 'change-request', label: 'Change Request', tone: 'warning', order: 11 },
  { value: 'incident', label: 'Incident', tone: 'destructive', order: 12 },
]

/** Access level dokumen/pesan (Section 21, Wajib "Internal/client/supplier visibility") — dipakai `/documents`, tab "Documents" Project Detail. */
export const DOCUMENT_ACCESS_LEVELS: StatusOption<DocumentAccessLevel>[] = [
  { value: 'internal', label: 'Internal', tone: 'neutral', order: 1 },
  { value: 'client', label: 'Client', tone: 'info', order: 2 },
  { value: 'supplier', label: 'Supplier', tone: 'warning', order: 3 },
]

/** Channel pesan (Section 21, Wajib "Internal notes, client messages, supplier messages") — dipakai `/documents`. */
export const MESSAGE_CHANNELS: StatusOption<MessageChannel>[] = [
  { value: 'internal-note', label: 'Internal Note', tone: 'neutral', order: 1 },
  { value: 'client-message', label: 'Client Message', tone: 'info', order: 2 },
  { value: 'supplier-message', label: 'Supplier Message', tone: 'warning', order: 3 },
]

/** Status delivery mock (Section 21, Wajib "Email/WhatsApp delivery status simulation tanpa klaim integrasi") — dipakai `/documents`. */
export const MESSAGE_DELIVERY_STATUSES: StatusOption<MessageDeliveryStatus>[] = [
  { value: 'queued', label: 'Antre', tone: 'neutral', order: 1 },
  { value: 'sent', label: 'Terkirim', tone: 'info', order: 2 },
  { value: 'delivered', label: 'Diterima', tone: 'success', order: 3 },
  { value: 'failed', label: 'Gagal', tone: 'destructive', order: 4 },
]

/** Tipe notifikasi in-app (Section 21, Wajib "Mentions, assignments, reminders, escalation") — dipakai `/documents` tab Notifications dan `NotificationPanel.vue`. */
export const NOTIFICATION_TYPES: StatusOption<NotificationType>[] = [
  { value: 'mention', label: 'Mention', tone: 'info', order: 1 },
  { value: 'assignment', label: 'Assignment', tone: 'info', order: 2 },
  { value: 'reminder', label: 'Reminder', tone: 'warning', order: 3 },
  { value: 'escalation', label: 'Escalation', tone: 'destructive', order: 4 },
  { value: 'change', label: 'Change', tone: 'warning', order: 5 },
  { value: 'incident', label: 'Incident', tone: 'destructive', order: 6 },
  { value: 'document', label: 'Document', tone: 'info', order: 7 },
  { value: 'message', label: 'Message', tone: 'neutral', order: 8 },
]

export function findStatusOption<T extends string>(list: StatusOption<T>[], value: T): StatusOption<T> {
  const found = list.find(option => option.value === value)
  if (found) return found
  return { value, label: value, tone: 'neutral', order: 0 }
}
