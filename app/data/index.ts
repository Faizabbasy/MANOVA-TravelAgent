import { addDays, formatISO, parseISO } from 'date-fns'
import { PARTIES, CONTACTS, PARTY_ACTIVITIES } from './parties'
import { USERS } from './users'
import { OPPORTUNITIES, QUOTATIONS } from './opportunities'
import { VENDORS, VENDOR_CONTACTS, VENDOR_QUOTATIONS, VENDOR_ACTIVITIES, VENDOR_PRODUCTS, VENDOR_DOCUMENTS } from './vendors'
import { PROJECTS, PROJECT_SERVICES, TRAVELER_GROUPS, TRAVELERS, ROOM_ASSIGNMENTS, ITINERARY_ITEMS } from './projects'
import { INVOICES, PAYMENTS, CREDIT_NOTES, DEBIT_NOTES } from './finance'
import { ACTIVITIES, DOCUMENTS, TASKS, PROJECT_RISKS, SHIFT_NOTES, SYSTEM_EVENTS } from './activity'
import { LEADS, LEAD_ACTIVITIES } from './leads'
import { PRODUCT_TEMPLATES, COST_SHEETS } from './products'
import { FLIGHT_BOOKINGS } from './ticketing'
import { HOTEL_BOOKINGS } from './accommodation'
import { TRANSPORT_BOOKINGS } from './transportation'
import { MICE_EVENTS } from './mice'
import { RFQS, RFQ_INVITATIONS, RFQ_RESPONSES, RFQ_CLARIFICATIONS, SERVICE_ORDERS, SERVICE_ORDER_AMENDMENTS, SUPPLIER_INVOICES } from './procurement'
import { BOOKING_ORCHESTRATION_RECORDS } from './booking-orchestration'
import { CHANGE_REQUESTS, CANCELLATION_RECORDS, REFUND_REQUESTS, INCIDENTS } from './change-incident'
import { DOCUMENT_RECORDS, MESSAGE_RECORDS, NOTIFICATION_RECORDS } from './document-comms'
import { SAVED_VIEWS } from './reporting'
import { COMMODITY_PRODUCTS, COMMODITY_VARIANTS } from './commodities'
import { AVAILABILITY_SLOTS } from './availability'
import { COMMODITY_REQUIREMENTS } from './requirements'
import { COMMODITY_SELECTIONS } from './selections'
import { COMMODITY_ORDERS } from './commodity-orders'
import {
  MASTER_PROJECT_TYPES, MASTER_SERVICE_TYPES, MASTER_DESTINATIONS, MASTER_VENDOR_CATEGORIES,
  AIRPORTS, AIRLINES, MASTER_HOTELS, MASTER_CURRENCIES, TAX_RULES, PAYMENT_TERMS, CANCELLATION_RULES,
  NUMBERING_SCHEMES, DOCUMENT_TEMPLATES, READINESS_GATE_CONFIGS, ASSIGNMENT_RULES, ORGANIZATION_PROFILE
} from './master-data'
import { isProjectNeedingAttention, isTaskUpcoming, isFollowUpUpcoming, isTravelerDocumentMissing, isInvoiceOverdue, isDocumentExpired, DEMO_REFERENCE_DATE } from '~/utils/attention'
import { formatCurrencyIdr, daysUntil, formatDateTime } from '~/utils/format'
import { SERVICE_STATUSES, SERVICE_TYPES, findStatusOption, FLIGHT_BOOKING_STATUSES, HOTEL_BOOKING_STATUSES, TRANSPORT_BOOKING_STATUSES, MICE_EVENT_STATUSES, VEHICLE_TYPES } from '~/constants/status'
import type { Project, ServiceTypeKey, ServiceStatus, Traveler, ProjectOrderStatus, ProjectClosureChecklist, ProjectDetailTab, ItineraryItem } from '~/types/project'
import type { Party, ContactPerson, PartyActivity, PartyActivityType } from '~/types/party'
import type { Opportunity, OpportunityStage, Quotation, OpportunityWorkflowStatus } from '~/types/opportunity'
import type { Vendor, VendorContact, VendorQuotation, VendorProduct, VendorDocument } from '~/types/vendor'
import type { ActivityEntry, ChangeCategory, ProjectTask, ProjectRisk, ProjectRiskSeverity, ShiftNote, ShiftPeriod, SystemEvent } from '~/types/activity'
import type { Lead, LeadActivity } from '~/types/lead'
import type { ProductTemplate, ProductTemplateStatus, ProductServiceAlternative, CostSheet, CostSheetLineItem } from '~/types/product'
import type { FlightBooking, FlightBookingStatus, FlightSegment } from '~/types/ticketing'
import type { HotelBooking, HotelBookingStatus } from '~/types/accommodation'
import type { TransportBooking, TransportBookingStatus, TransportLeg } from '~/types/transportation'
import type { MiceEvent, MiceEventStatus, MiceApprovalStatus } from '~/types/mice'
import type { RFQ, RFQStatus, RFQLineItem, RFQResponse, RFQResponseLineItem, RFQClarificationMessage, ServiceOrder, ServiceOrderStatus, ServiceOrderLineItem, SupplierInvoice, SupplierInvoiceStatus, SupplierInvoiceMatchStatus } from '~/types/procurement'
import type { BookingDomain, BookingOrchestrationRecord, BookingAttempt, BookingAttemptOutcome, BookingPaymentGateStatus, BookingTimelineEntry, BookingTimelineDependencyView } from '~/types/booking-orchestration'
import type { ChangeRequest, ChangeRequestSource, ChangeRequestStatus, AffectedEntityRef, CancellationRecord, RefundRequest, RefundRequestStatus, Incident, IncidentSeverity, IncidentStatus, IncidentCommunicationEntry } from '~/types/change-incident'
import type { Invoice, InvoiceCurrency, InvoiceType, ExchangeRateSnapshot, Payment, CreditNote, DebitNote } from '~/types/finance'
import type { Document, DocumentEntityType, DocumentAccessLevel, Message, MessageChannel, Notification, NotificationType, UnifiedTimelineEntry } from '~/types/document-comms'
import type { SavedView, SavedViewPage } from '~/types/reporting'
import type { OrganizationProfile, MasterDataCategoryKey } from '~/types/master-data'
import type { User } from '~/types/user'
import type { CommodityProduct, CommodityProductStatus, CommodityVariant } from '~/types/commodity'
import type { AvailabilitySlot } from '~/types/availability'
import type { CommodityRequirement, RequirementStatus } from '~/types/requirement'
import type { CommoditySelection, SelectionStatus } from '~/types/selection'
import type { CommodityOrder, CommodityOrderStatus } from '~/types/commodity-order'

export {
  USERS,
  PARTIES, CONTACTS, PARTY_ACTIVITIES,
  OPPORTUNITIES, QUOTATIONS,
  VENDORS, VENDOR_CONTACTS, VENDOR_QUOTATIONS, VENDOR_ACTIVITIES, VENDOR_PRODUCTS, VENDOR_DOCUMENTS,
  PROJECTS, PROJECT_SERVICES, TRAVELER_GROUPS, TRAVELERS, ROOM_ASSIGNMENTS, ITINERARY_ITEMS,
  INVOICES, PAYMENTS, CREDIT_NOTES, DEBIT_NOTES,
  ACTIVITIES, DOCUMENTS, TASKS, PROJECT_RISKS, SHIFT_NOTES, SYSTEM_EVENTS,
  LEADS, LEAD_ACTIVITIES,
  PRODUCT_TEMPLATES, COST_SHEETS,
  FLIGHT_BOOKINGS,
  HOTEL_BOOKINGS,
  TRANSPORT_BOOKINGS,
  MICE_EVENTS,
  RFQS, RFQ_INVITATIONS, RFQ_RESPONSES, RFQ_CLARIFICATIONS, SERVICE_ORDERS, SERVICE_ORDER_AMENDMENTS, SUPPLIER_INVOICES,
  BOOKING_ORCHESTRATION_RECORDS,
  CHANGE_REQUESTS, CANCELLATION_RECORDS, REFUND_REQUESTS, INCIDENTS,
  DOCUMENT_RECORDS, MESSAGE_RECORDS, NOTIFICATION_RECORDS,
  SAVED_VIEWS,
  MASTER_PROJECT_TYPES, MASTER_SERVICE_TYPES, MASTER_DESTINATIONS, MASTER_VENDOR_CATEGORIES,
  AIRPORTS, AIRLINES, MASTER_HOTELS, MASTER_CURRENCIES, TAX_RULES, PAYMENT_TERMS, CANCELLATION_RULES,
  NUMBERING_SCHEMES, DOCUMENT_TEMPLATES, READINESS_GATE_CONFIGS, ASSIGNMENT_RULES, ORGANIZATION_PROFILE
}

/** Helper selector sederhana (Prompt 5-H) — hindari query ad-hoc berulang di tiap halaman. */

export const getUserById = (id: string) => USERS.find(user => user.id === id)
export const getPartyById = (id: string) => PARTIES.find(party => party.id === id)
export const getContactsByParty = (partyId: string) => CONTACTS.filter(contact => contact.partyId === partyId)
export const getOpportunitiesByParty = (partyId: string) => OPPORTUNITIES.filter(opp => opp.partyId === partyId)
export const getOpportunityById = (id: string) => OPPORTUNITIES.find(opp => opp.id === id)
export const getProjectsByParty = (partyId: string) => PROJECTS.filter(project => project.partyId === partyId)
export const getQuotationByOpportunity = (opportunityId: string) => QUOTATIONS.find(quotation => quotation.opportunityId === opportunityId)
/** Section 19 — "Additional quotation/change order" (`ChangeRequest.linkedQuotationId`), dipakai `/changes/[id]`. */
export const getQuotationById = (id: string) => QUOTATIONS.find(quotation => quotation.id === id)
/** Management Approval Queue (Section 06) — quotation menunggu Commercial Approval, lintas seluruh Opportunity. */
export const getQuotationsPendingApproval = () => QUOTATIONS.filter(quotation => quotation.approvalStatus === 'submitted')
/** Management Approval Queue (Section 06) — Opportunity yang quotation-nya sudah approved tapi Client Confirmation (Section 05, AE-facing) belum dicatat; visibilitas Management, bukan aksi (client confirmation tetap tanggung jawab AE). */
export const getOpportunitiesPendingClientConfirmation = () => OPPORTUNITIES.filter((opp) => {
  if (opp.clientConfirmedAt || !['negotiation', 'on-hold'].includes(opp.stage)) { return false }
  const quotation = getQuotationByOpportunity(opp.id)
  return quotation?.approvalStatus === 'approved'
})
export const getVendorById = (id: string) => VENDORS.find(vendor => vendor.id === id)
export const getVendorContacts = (vendorId: string) => VENDOR_CONTACTS.filter(contact => contact.vendorId === vendorId)
/** Dokumen vendor (Section 17) — tab "Documents" Vendor Detail, preview mock (D-006). */
export const getVendorDocuments = (vendorId: string) => VENDOR_DOCUMENTS.filter(doc => doc.vendorId === vendorId)
export const getVendorQuotations = (vendorId: string) => VENDOR_QUOTATIONS
  .filter(quotation => quotation.vendorId === vendorId)
  .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
export const getVendorActivities = (vendorId: string) => VENDOR_ACTIVITIES
  .filter(activity => activity.vendorId === vendorId)
  .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
/** Vendor assignment ke Project/Service (Section 13) — filter langsung `PROJECT_SERVICES` existing, bukan data paralel (hard rule). */
export const getServicesByVendor = (vendorId: string) => PROJECT_SERVICES.filter(service => service.vendorId === vendorId)
/** Comparison quotation (Section 13) — quotation lain untuk service yang sama, dipakai tab "Vendors" Project Detail. */
export const getQuotationsForService = (serviceId: string) => VENDOR_QUOTATIONS
  .filter(quotation => quotation.serviceId === serviceId)
  .sort((a, b) => a.amountIdr - b.amountIdr)

export const getProjectById = (id: string) => PROJECTS.find(project => project.id === id)
export const getProjectServices = (projectId: string) => PROJECT_SERVICES.filter(service => service.projectId === projectId)
export const getItineraryItems = (projectId: string) => ITINERARY_ITEMS
  .filter(item => item.projectId === projectId)
  .sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? '').localeCompare(b.time ?? ''))

/** "Internal vs client-shared itinerary" (Section 12 baru, Wajib) — `visibleToClient` default `true` bila kosong. */
export const getClientVisibleItineraryItems = (projectId: string) => getItineraryItems(projectId).filter(item => item.visibleToClient !== false)

/** Timezone-aware schedule (Section 12 baru) — hanya field label yang bisa diedit lewat UI, bukan CRUD penuh (Day-by-day itinerary sudah COMPLETED sejak Section 12 lama tanpa create/delete, di luar scope literal section ini). */
export function updateItineraryItem (id: string, patch: Partial<Pick<ItineraryItem, 'visibleToClient' | 'timezone'>>): ItineraryItem | undefined {
  const item = ITINERARY_ITEMS.find(i => i.id === id)
  if (!item) { return undefined }
  Object.assign(item, patch)
  return item
}
export const getTravelerGroups = (projectId: string) => TRAVELER_GROUPS.filter(group => group.projectId === projectId)
export const getTravelers = (projectId: string) => TRAVELERS.filter(traveler => traveler.projectId === projectId)
export const getTravelersByGroup = (groupId: string) => TRAVELERS.filter(traveler => traveler.groupId === groupId)
export const getRoomAssignments = (projectId: string) => ROOM_ASSIGNMENTS.filter(room => room.projectId === projectId)
/** "Room block, occupancy, rooming list" (Section 14, Wajib) — reuse `RoomAssignment`/`TravelerGroup` (Section 11) lewat `groupId`, bukan dataset paralel baru. */
export const getHotelRoomingList = (projectId: string, groupId?: string) => {
  if (!groupId) { return [] }
  return getRoomAssignments(projectId).filter(room => room.groupId === groupId)
}

/** Missing document indicator (Section 11) — dievaluasi terhadap tanggal keberangkatan project ybs. */
export function getTravelersMissingDocuments (projectId: string) {
  const project = getProjectById(projectId)
  return getTravelers(projectId).filter(traveler => isTravelerDocumentMissing(traveler, project?.travelStartDate))
}

export const getInvoicesByProject = (projectId: string) => INVOICES.filter(invoice => invoice.projectId === projectId)
export const getPaymentsByInvoice = (invoiceId: string) => PAYMENTS.filter(payment => payment.invoiceId === invoiceId)

/** Credit Note (Section 20) — daftar Credit Note satu invoice/project. `Invoice.amountIdr` TIDAK PERNAH ditulis ulang — dipakai `getInvoiceOutstandingIdr` untuk mengurangi outstanding on-the-fly. */
export const getCreditNotesByInvoice = (invoiceId: string) => CREDIT_NOTES.filter(note => note.invoiceId === invoiceId)
export function getCreditNotesByProject (projectId: string): CreditNote[] {
  const invoiceIds = new Set(getInvoicesByProject(projectId).map(invoice => invoice.id))
  return CREDIT_NOTES.filter(note => invoiceIds.has(note.invoiceId))
}
/** Debit Note (Section 20) — murni informasional (Wajib), TIDAK mempengaruhi kalkulasi outstanding mana pun. */
export const getDebitNotesByProject = (projectId: string) => DEBIT_NOTES.filter(note => note.projectId === projectId)

/**
 * Project Finance (Section 15, diperluas Section 20 — D-077) — sisa tagihan satu invoice (amount dikurangi
 * payment yang sudah diterima DAN Credit Note `issued`/`applied` milik invoice tsb). Invoice `'void'`
 * (Section 20, transisi terminal baru) selalu mengembalikan 0 — invoice yang dibatalkan tidak pernah
 * outstanding.
 */
export function getInvoiceOutstandingIdr (invoiceId: string): number {
  const invoice = INVOICES.find(item => item.id === invoiceId)
  if (!invoice) { return 0 }
  if (invoice.status === 'void') { return 0 }
  const paid = getPaymentsByInvoice(invoiceId).reduce((sum, payment) => sum + payment.amountIdr, 0)
  const credited = getCreditNotesByInvoice(invoiceId)
    .filter(note => note.status === 'issued' || note.status === 'applied')
    .reduce((sum, note) => sum + note.amountIdr, 0)
  return Math.max(invoice.amountIdr - paid - credited, 0)
}

/** Total outstanding satu project — dipakai tampilan "ringkas" (Sales/role tanpa akses modul Finance) dan Finance tab penuh. */
export function getProjectOutstandingIdr (projectId: string): number {
  return getInvoicesByProject(projectId)
    .filter(invoice => invoice.status !== 'paid')
    .reduce((sum, invoice) => sum + getInvoiceOutstandingIdr(invoice.id), 0)
}

/** Committed vendor cost (Section 15) — total quotation vendor yang sudah `accepted` (Section 13), bukan data paralel dari `PROJECT_SERVICES`/`VENDOR_QUOTATIONS`. */
export function getCommittedVendorCostIdr (projectId: string): number {
  return VENDOR_QUOTATIONS
    .filter(quotation => quotation.projectId === projectId && quotation.status === 'accepted')
    .reduce((sum, quotation) => sum + quotation.amountIdr, 0)
}

/**
 * Project Finance mutators (Section 20 — Project Finance, roadmap Section 00–24 baru, D-077). Seluruhnya
 * frontend-only/mock (D-006) — "Record Payment" murni status/ledger update, BUKAN payment gateway nyata.
 * `Invoice.amountIdr` TIDAK PERNAH ditulis ulang oleh mutator mana pun di sini — histori tetap utuh, sesuai
 * pola yang sudah dipakai sejak Section 13 (VendorQuotation) dan konsisten dengan `CreditNote`/`DebitNote`.
 */

export interface CreateInvoiceInput {
  projectId: string
  label: string
  amountIdr: number
  currency: InvoiceCurrency
  invoiceType: InvoiceType
  dueAt: string
  exchangeRateSnapshot?: ExchangeRateSnapshot
}

/** Membuat Invoice baru berstatus `unpaid`. `exchangeRateSnapshot` hanya disimpan bila `currency !== 'IDR'`. */
export function createInvoice (input: CreateInvoiceInput): Invoice | undefined {
  const project = getProjectById(input.projectId)
  if (!project || !input.label.trim() || input.amountIdr <= 0 || !input.dueAt) { return undefined }
  const invoice: Invoice = {
    id: nextSequentialId('INV-', INVOICES),
    projectId: input.projectId,
    label: input.label.trim(),
    amountIdr: input.amountIdr,
    issuedAt: DEMO_REFERENCE_DATE,
    dueAt: input.dueAt,
    status: 'unpaid',
    currency: input.currency,
    invoiceType: input.invoiceType,
    exchangeRateSnapshot: input.currency !== 'IDR' ? input.exchangeRateSnapshot : undefined
  }
  INVOICES.push(invoice)
  ACTIVITIES.push({
    id: nextSequentialId('ACT-', ACTIVITIES),
    projectId: input.projectId,
    message: `Invoice ${invoice.id} (${invoice.label}) diterbitkan senilai ${formatCurrencyIdr(invoice.amountIdr)} (${invoice.invoiceType}).`,
    isChange: false,
    reviewed: true,
    createdAt: DEMO_REFERENCE_DATE
  })
  return invoice
}

/**
 * Void Invoice — transisi terminal, alasan WAJIB (pola sama section lain, mis. `rejectChangeRequest`). Invoice
 * yang sudah `paid` atau sudah `void` DIBLOKIR (mengembalikan `undefined`) — UI wajib menampilkan pesan jelas,
 * bukan membiarkan aksi silent-fail (lihat `app/pages/finance/invoices.vue`, tombol Void disembunyikan/disabled
 * dengan penjelasan untuk invoice yang tidak eligible).
 */
export function voidInvoice (invoiceId: string, reason: string, actorId: string): Invoice | undefined {
  const invoice = INVOICES.find(item => item.id === invoiceId)
  if (!invoice || !reason.trim()) { return undefined }
  if (invoice.status === 'paid' || invoice.status === 'void') { return undefined }
  invoice.status = 'void'
  invoice.voidedAt = DEMO_REFERENCE_DATE
  invoice.voidReason = reason.trim()
  const actor = getUserById(actorId)
  ACTIVITIES.push({
    id: nextSequentialId('ACT-', ACTIVITIES),
    projectId: invoice.projectId,
    message: `Invoice ${invoice.id} dibatalkan (void) oleh ${actor?.name ?? actorId}. Alasan: ${invoice.voidReason}`,
    isChange: true,
    reviewed: false,
    createdAt: DEMO_REFERENCE_DATE
  })
  return invoice
}

export interface RecordPaymentInput {
  invoiceId: string
  amountIdr: number
  recordedBy: string
  method?: string
}

/**
 * Record Payment — mock ledger update murni (D-006, bukan payment gateway nyata). Recompute `Invoice.status`
 * lewat `getInvoiceOutstandingIdr` existing (TIDAK menduplikasi math outstanding) — `unpaid`/`partially-paid`
 * → `paid` otomatis begitu outstanding mencapai 0. Diblokir untuk invoice `paid`/`void` (tidak ada yang perlu
 * dibayar lagi) atau jumlah invalid.
 */
export function recordPayment (input: RecordPaymentInput): Payment | undefined {
  const invoice = INVOICES.find(item => item.id === input.invoiceId)
  if (!invoice || input.amountIdr <= 0) { return undefined }
  if (invoice.status === 'paid' || invoice.status === 'void') { return undefined }
  const outstandingBefore = getInvoiceOutstandingIdr(input.invoiceId)
  if (outstandingBefore <= 0) { return undefined }

  const payment: Payment = {
    id: nextSequentialId('PAY-', PAYMENTS),
    invoiceId: input.invoiceId,
    amountIdr: Math.min(input.amountIdr, outstandingBefore),
    receivedAt: DEMO_REFERENCE_DATE,
    method: input.method,
    recordedBy: input.recordedBy
  }
  PAYMENTS.push(payment)
  invoice.status = getInvoiceOutstandingIdr(input.invoiceId) <= 0 ? 'paid' : 'partially-paid'

  const actor = getUserById(input.recordedBy)
  ACTIVITIES.push({
    id: nextSequentialId('ACT-', ACTIVITIES),
    projectId: invoice.projectId,
    message: `Payment ${payment.id} sebesar ${formatCurrencyIdr(payment.amountIdr)} dicatat untuk Invoice ${invoice.id} oleh ${actor?.name ?? input.recordedBy}. Invoice kini berstatus "${invoice.status}".`,
    isChange: false,
    reviewed: true,
    createdAt: DEMO_REFERENCE_DATE
  })
  return payment
}

export interface IssueCreditNoteInput {
  invoiceId: string
  amountIdr: number
  reason: string
  refundRequestId?: string
}

/** Issue Credit Note — mengurangi outstanding invoice terkait (via `getInvoiceOutstandingIdr`) tanpa menulis ulang `Invoice.amountIdr`. Dipanggil manual dari `/finance/invoices.vue` ATAU otomatis dari `updateRefundRequestStatus` (lihat hook di bawah, D-077 menutup forward dependency D-076/Section 19). */
export function issueCreditNote (input: IssueCreditNoteInput): CreditNote | undefined {
  const invoice = INVOICES.find(item => item.id === input.invoiceId)
  if (!invoice || input.amountIdr <= 0 || !input.reason.trim()) { return undefined }
  const note: CreditNote = {
    id: nextSequentialId('CN-', CREDIT_NOTES),
    invoiceId: input.invoiceId,
    refundRequestId: input.refundRequestId,
    amountIdr: input.amountIdr,
    issuedAt: DEMO_REFERENCE_DATE,
    reason: input.reason.trim(),
    status: 'issued'
  }
  CREDIT_NOTES.push(note)
  ACTIVITIES.push({
    id: nextSequentialId('ACT-', ACTIVITIES),
    projectId: invoice.projectId,
    message: `Credit Note ${note.id} senilai ${formatCurrencyIdr(note.amountIdr)} diterbitkan untuk Invoice ${invoice.id}. Alasan: ${note.reason}`,
    isChange: false,
    reviewed: true,
    createdAt: DEMO_REFERENCE_DATE
  })
  return note
}

export interface IssueDebitNoteInput {
  projectId: string
  amountIdr: number
  reason: string
  invoiceId?: string
}

/** Issue Debit Note — murni informasional (Wajib), TIDAK mempengaruhi kalkulasi outstanding invoice mana pun. */
export function issueDebitNote (input: IssueDebitNoteInput): DebitNote | undefined {
  const project = getProjectById(input.projectId)
  if (!project || input.amountIdr <= 0 || !input.reason.trim()) { return undefined }
  const note: DebitNote = {
    id: nextSequentialId('DN-', DEBIT_NOTES),
    projectId: input.projectId,
    invoiceId: input.invoiceId,
    amountIdr: input.amountIdr,
    issuedAt: DEMO_REFERENCE_DATE,
    reason: input.reason.trim(),
    status: 'issued'
  }
  DEBIT_NOTES.push(note)
  ACTIVITIES.push({
    id: nextSequentialId('ACT-', ACTIVITIES),
    projectId: input.projectId,
    message: `Debit Note ${note.id} senilai ${formatCurrencyIdr(note.amountIdr)} diterbitkan. Alasan: ${note.reason}`,
    isChange: false,
    reviewed: true,
    createdAt: DEMO_REFERENCE_DATE
  })
  return note
}

/** AP reconciliation (Section 20) — Supplier Invoice satu project, lintas seluruh Service Order project tsb (dipakai AP summary Project Detail Finance tab dan `evaluateFinanceClosureGate`). */
export function getSupplierInvoicesByProject (projectId: string): SupplierInvoice[] {
  const serviceOrderIds = new Set(SERVICE_ORDERS.filter(so => so.projectId === projectId).map(so => so.id))
  return SUPPLIER_INVOICES.filter(invoice => serviceOrderIds.has(invoice.serviceOrderId))
}

/** Reconciliation workspace (Section 20, Wajib) — worklist Supplier Invoice yang eksplisit ditandai `unmatched`/`disputed`. Invoice tanpa `matchStatus` sama sekali (belum ditriase) TIDAK muncul di sini — konsisten field opsional aditif. */
export function getSupplierInvoiceReconciliationQueue (): SupplierInvoice[] {
  return SUPPLIER_INVOICES.filter(invoice => invoice.matchStatus === 'unmatched' || invoice.matchStatus === 'disputed')
}

/** Update match status AP (Section 20) — pola sama `reviewSupplierInvoice` (Section 17, actorId untuk audit trail `ActivityEntry` project terkait via `ServiceOrder.projectId`, `note` opsional). */
export function updateSupplierInvoiceMatchStatus (id: string, status: SupplierInvoiceMatchStatus, actorId: string, note?: string): SupplierInvoice | undefined {
  const invoice = SUPPLIER_INVOICES.find(item => item.id === id)
  if (!invoice) { return undefined }
  invoice.matchStatus = status
  const serviceOrder = getServiceOrderById(invoice.serviceOrderId)
  if (serviceOrder?.projectId) {
    const actor = getUserById(actorId)
    ACTIVITIES.push({
      id: nextSequentialId('ACT-', ACTIVITIES),
      projectId: serviceOrder.projectId,
      message: `Supplier Invoice ${invoice.id} (${getVendorById(invoice.vendorId)?.name ?? invoice.vendorId}) match status diubah menjadi "${status}" oleh ${actor?.name ?? actorId}.${note ? ` Catatan: ${note}` : ''}`,
      isChange: false,
      reviewed: true,
      createdAt: DEMO_REFERENCE_DATE
    })
  }
  return invoice
}

export interface FinanceClosureGateResult {
  ready: boolean
  blockers: string[]
}

/**
 * Financial closure gate (Section 20, Wajib) — derivasi murni (BUKAN field tersimpan yang bisa stale, pola
 * sama `getCostSheetBreakdown`/`getServiceReadinessMatrix`). `ready: true` hanya bila: (1) tidak ada Invoice
 * project ini yang outstanding > 0 (`getInvoiceOutstandingIdr`, sudah memperhitungkan Credit Note dan status
 * `void`), (2) tidak ada Refund Request project ini yang masih non-terminal
 * (`requested`/`under-review`/`approved`), (3) tidak ada Supplier Invoice/AP project ini yang `matchStatus`
 * terisi tapi bukan `matched`. Dipakai `closeProjectFinance` (gate) dan ditampilkan di `/finance` (agregat)
 * dan tab Finance Project Detail.
 */
export function evaluateFinanceClosureGate (projectId: string): FinanceClosureGateResult {
  const blockers: string[] = []

  const outstandingInvoiceCount = getInvoicesByProject(projectId).filter(invoice => getInvoiceOutstandingIdr(invoice.id) > 0).length
  if (outstandingInvoiceCount > 0) { blockers.push(`${outstandingInvoiceCount} invoice masih memiliki outstanding balance.`) }

  const nonTerminalRefundCount = getRefundRequestsByProject(projectId)
    .filter(request => request.status === 'requested' || request.status === 'under-review' || request.status === 'approved').length
  if (nonTerminalRefundCount > 0) { blockers.push(`${nonTerminalRefundCount} Refund Request belum selesai (belum processed/rejected).`) }

  const unmatchedSupplierInvoiceCount = getSupplierInvoicesByProject(projectId)
    .filter(invoice => invoice.matchStatus && invoice.matchStatus !== 'matched').length
  if (unmatchedSupplierInvoiceCount > 0) { blockers.push(`${unmatchedSupplierInvoiceCount} Supplier Invoice (AP) belum matched.`) }

  return { ready: blockers.length === 0, blockers }
}

/**
 * "Close Finance" action (Section 20, Wajib) — mengisi `ProjectClosureChecklist.financeSettled` (shell inert
 * sejak Section 09/D-066) dengan logic gate NYATA untuk pertama kalinya, MEREUSE `updateProjectClosureChecklist`
 * existing (bukan menulis ulang shape-nya). HANYA berhasil bila `evaluateFinanceClosureGate` mengembalikan
 * `ready: true` — bila tidak, mengembalikan blockers tanpa mengubah apa pun (UI wajib menampilkan daftar
 * blocker, bukan membiarkan aksi silent-fail).
 */
export function closeProjectFinance (projectId: string, actorId: string): { success: boolean; blockers: string[] } {
  const gate = evaluateFinanceClosureGate(projectId)
  if (!gate.ready) { return { success: false, blockers: gate.blockers } }
  const updated = updateProjectClosureChecklist(projectId, { financeSettled: true })
  if (!updated) { return { success: false, blockers: ['Project tidak ditemukan.'] } }
  const actor = getUserById(actorId)
  ACTIVITIES.push({
    id: nextSequentialId('ACT-', ACTIVITIES),
    projectId,
    message: `Finance ditutup (Close Finance) oleh ${actor?.name ?? actorId} — seluruh outstanding invoice, Refund Request, dan AP matching sudah selesai.`,
    isChange: false,
    reviewed: true,
    createdAt: DEMO_REFERENCE_DATE
  })
  return { success: true, blockers: [] }
}

export const getActivitiesByProject = (projectId: string) => ACTIVITIES.filter(activity => activity.projectId === projectId)
export const getDocumentsByProject = (projectId: string) => DOCUMENTS.filter(document => document.projectId === projectId)
export const getTasksByProject = (projectId: string) => TASKS.filter(task => task.projectId === projectId)
export const getRisksByProject = (projectId: string) => PROJECT_RISKS.filter(risk => risk.projectId === projectId)

/**
 * Project Order dan Handover (Section 09 — roadmap Section 00–24 baru). Lihat komentar `ProjectOrderStatus`
 * (`app/types/project.ts`) untuk rasional lengkap derivasi 10-nilai dari `Project.status` (LOCKED, D-028) +
 * field handover/ready/closure baru — TIDAK merestrukturisasi `ProjectStatus` (D-066).
 */
export function getProjectOrderStatus (project: Project): ProjectOrderStatus {
  if (project.status === 'cancelled') { return 'cancelled' }
  if (project.status === 'on-hold') { return 'on-hold' }
  if (project.status === 'completed') { return project.closedAt ? 'closed' : 'completed' }
  if (project.status === 'draft') { return project.handoverAcceptedAt ? 'planning' : 'handover-pending' }
  if (project.status === 'planning') { return 'planning' }
  if (project.status === 'confirmed') { return project.readyAt ? 'ready' : 'confirmed' }
  if (project.status === 'in-progress' || project.status === 'ongoing-trip') { return 'in-progress' }
  return 'created'
}

/**
 * "PM Accept/Return Handover dengan reason" (Wajib) — dipanggil hanya dari UI yang sudah memfilter role PM
 * (`project-manager`)/Super Admin. Guard: hanya dari `status === 'draft'` dan belum pernah di-accept.
 * Acceptance section ("PM dapat menerima handover dan memulai planning TANPA KEHILANGAN DATA KOMERSIAL")
 * terpenuhi otomatis — `quotationAmountIdr`/`budgetIdr`/`sourceQuotationId` sudah terisi penuh sejak
 * `approveOpportunityWon` (Section 05/06), mutator ini TIDAK menyentuhnya sama sekali.
 */
export function acceptProjectHandover (projectId: string, pmId: string): Project | undefined {
  const project = getProjectById(projectId)
  if (!project || project.status !== 'draft' || project.handoverAcceptedAt) { return undefined }
  project.handoverAcceptedAt = DEMO_REFERENCE_DATE
  project.handoverAcceptedBy = pmId
  const pm = getUserById(pmId)
  ACTIVITIES.push({
    id: nextSequentialId('ACT-', ACTIVITIES),
    projectId,
    message: `Handover diterima oleh ${pm?.name ?? pmId} — Project Order memasuki tahap Planning.`,
    isChange: false,
    reviewed: true,
    createdAt: DEMO_REFERENCE_DATE
  })
  return project
}

/** Return Handover — TIDAK mengubah `project.status` (tetap Handover Pending), murni mencatat alasan yang harus ditindaklanjuti AE/Sales (mock, D-006). */
export function returnProjectHandover (projectId: string, reason: string, actorId: string): Project | undefined {
  const project = getProjectById(projectId)
  if (!project || project.status !== 'draft' || project.handoverAcceptedAt || !reason.trim()) { return undefined }
  project.handoverReturnedAt = DEMO_REFERENCE_DATE
  project.handoverReturnReason = reason
  const actor = getUserById(actorId)
  ACTIVITIES.push({
    id: nextSequentialId('ACT-', ACTIVITIES),
    projectId,
    message: `Handover dikembalikan oleh ${actor?.name ?? actorId}. Alasan: ${reason}`,
    isChange: false,
    reviewed: true,
    createdAt: DEMO_REFERENCE_DATE
  })
  return project
}

/** PM menandai Project Order siap keberangkatan — hanya dari status `confirmed`. */
export function markProjectReady (projectId: string): Project | undefined {
  const project = getProjectById(projectId)
  if (!project || project.status !== 'confirmed' || project.readyAt) { return undefined }
  project.readyAt = DEMO_REFERENCE_DATE
  return project
}

/**
 * Transisi `Project.status` (Wajib "Transition guards dan visible reason") — peta transisi yang diizinkan,
 * reason WAJIB untuk On Hold/Cancelled (dampak besar, harus terlihat alasannya), opsional untuk transisi
 * maju normal. Dicatat sebagai `ActivityEntry` (bukan `isChange`, murni log status) agar "visible" sesuai
 * literal — muncul di tab Activity & Changes existing tanpa komponen histori baru.
 */
const PROJECT_STATUS_TRANSITIONS: Record<Project['status'], Project['status'][]> = {
  draft: ['planning', 'on-hold', 'cancelled'],
  planning: ['confirmed', 'on-hold', 'cancelled'],
  confirmed: ['in-progress', 'on-hold', 'cancelled'],
  'in-progress': ['completed', 'on-hold', 'cancelled'],
  'ongoing-trip': ['completed', 'on-hold', 'cancelled'],
  completed: [],
  'on-hold': ['planning', 'confirmed', 'in-progress', 'cancelled'],
  cancelled: []
}

export function getProjectStatusTransitions (currentStatus: Project['status']): Project['status'][] {
  return PROJECT_STATUS_TRANSITIONS[currentStatus] ?? []
}

export function updateProjectStatus (projectId: string, newStatus: Project['status'], actorId: string, reason?: string): Project | undefined {
  const project = getProjectById(projectId)
  if (!project) { return undefined }
  if (!getProjectStatusTransitions(project.status).includes(newStatus)) { return undefined }
  const requiresReason = newStatus === 'on-hold' || newStatus === 'cancelled'
  if (requiresReason && !reason?.trim()) { return undefined }
  const fromLabel = project.status
  project.status = newStatus
  const actor = getUserById(actorId)
  ACTIVITIES.push({
    id: nextSequentialId('ACT-', ACTIVITIES),
    projectId,
    message: `Status Project Order diubah dari "${fromLabel}" menjadi "${newStatus}" oleh ${actor?.name ?? actorId}.${reason ? ` Alasan: ${reason}` : ''}`,
    isChange: false,
    reviewed: true,
    createdAt: DEMO_REFERENCE_DATE
  })
  return project
}

/** Closure checklist SHELL (Wajib "Closure checklist shell untuk dipenuhi section akhir") — toggle murni, tidak menggerbangi transisi status apa pun (disengaja, lihat `ProjectClosureChecklist`). */
export function updateProjectClosureChecklist (projectId: string, patch: Partial<ProjectClosureChecklist>): Project | undefined {
  const project = getProjectById(projectId)
  if (!project) { return undefined }
  project.closureChecklist = {
    financeSettled: false,
    documentsArchived: false,
    feedbackCollected: false,
    assetsReturned: false,
    servicesCompleted: false,
    unresolvedIssuesHandled: false,
    documentsComplete: false,
    ...project.closureChecklist,
    ...patch
  }
  return project
}

export interface ProjectClosureGateResult {
  ready: boolean
  blockers: string[]
}

/** Booking terminal status per domain (Flight/Hotel/Transport) — reuse `BOOKING_ACTIVE_CHECK_TERMINAL` (Section 18) di bawah, dideklarasikan sebelum dipakai. MICE dicek terpisah (`MiceEventStatus` hanya 5 nilai, tidak butuh map). */

/**
 * "Project Closed" gate (Section 24 — final section, resolves `docs/frontend-workflow-map.md` langkah 23
 * dari PARTIAL). Pola SAMA `evaluateFinanceClosureGate`/`closeProjectFinance` (Section 20, D-077) —
 * derivasi murni (bukan field tersimpan yang bisa stale). SENGAJA TIDAK merestrukturisasi `ProjectStatus`
 * (8 nilai, LOCKED D-028) atau `PROJECT_STATUS_TRANSITIONS` — "Closed" TETAP dirivasi via
 * `getProjectOrderStatus()` dari `project.status === 'completed' && project.closedAt` (D-066, LOCKED).
 * `ready: true` hanya bila SEMUA: (1) `project.status === 'completed'`, (2) seluruh `ProjectService`
 * (generik, `getProjectServices`) berstatus `completed`/`cancelled`, (3) seluruh `FlightBooking`/
 * `HotelBooking`/`TransportBooking`/`MiceEvent` project ini berstatus terminal per domain (reuse
 * `BOOKING_ACTIVE_CHECK_TERMINAL`, Section 18 — TIDAK menduplikasi daftar status terminal), (4)
 * `closureChecklist.financeSettled` true (REUSE gate Section 20, TIDAK dihitung ulang di sini), (5)
 * tidak ada `Incident` project ini berstatus `open`/`investigating`/`escalated`, (6) tidak ada
 * `ChangeRequest` berstatus `submitted`/`under-review`, (7) tidak ada `Document` project ini yang sudah
 * `isDocumentExpired` (best-effort — bukan validasi "seluruh dokumen wajib ada", karena tidak ada daftar
 * dokumen wajib per project type di data model manapun; hanya menangkap dokumen yang SUDAH ada dan SUDAH
 * eksplisit kedaluwarsa).
 */
export function evaluateProjectClosureGate (projectId: string): ProjectClosureGateResult {
  const blockers: string[] = []
  const project = getProjectById(projectId)
  if (!project) { return { ready: false, blockers: ['Project tidak ditemukan.'] } }

  if (project.status !== 'completed') {
    blockers.push(`Status Project Order masih "${project.status}" — harus mencapai "completed" terlebih dahulu (lewat Close Project Order) sebelum dapat ditutup.`)
  }

  const nonTerminalServiceCount = getProjectServices(project.id)
    .filter(service => service.status !== 'completed' && service.status !== 'cancelled').length
  if (nonTerminalServiceCount > 0) { blockers.push(`${nonTerminalServiceCount} service (tab Itinerary & Services) belum berstatus completed/cancelled.`) }

  const nonTerminalFlightCount = FLIGHT_BOOKINGS.filter(b => b.projectId === project.id && !BOOKING_ACTIVE_CHECK_TERMINAL.flight.includes(b.status)).length
  const nonTerminalHotelCount = HOTEL_BOOKINGS.filter(b => b.projectId === project.id && !BOOKING_ACTIVE_CHECK_TERMINAL.hotel.includes(b.status)).length
  const nonTerminalTransportCount = TRANSPORT_BOOKINGS.filter(b => b.projectId === project.id && !BOOKING_ACTIVE_CHECK_TERMINAL.transport.includes(b.status)).length
  const nonTerminalMiceCount = MICE_EVENTS.filter(e => e.projectId === project.id && e.status !== 'completed' && e.status !== 'cancelled').length
  const nonTerminalBookingCount = nonTerminalFlightCount + nonTerminalHotelCount + nonTerminalTransportCount + nonTerminalMiceCount
  if (nonTerminalBookingCount > 0) { blockers.push(`${nonTerminalBookingCount} booking Flight/Hotel/Transport/MICE belum berstatus terminal (issued/refunded/completed/cancelled/no-show sesuai domain).`) }

  if (!project.closureChecklist?.financeSettled) { blockers.push('Finance belum diselesaikan — jalankan "Close Finance" di tab Finance (Section 20) terlebih dahulu.') }

  const openIncidentCount = getIncidentsByProject(project.id)
    .filter(incident => incident.status === 'open' || incident.status === 'investigating' || incident.status === 'escalated').length
  if (openIncidentCount > 0) { blockers.push(`${openIncidentCount} Incident project ini masih terbuka (open/investigating/escalated).`) }

  const openChangeRequestCount = getChangeRequestsByProject(project.id)
    .filter(request => request.status === 'submitted' || request.status === 'under-review').length
  if (openChangeRequestCount > 0) { blockers.push(`${openChangeRequestCount} Change Request project ini masih menunggu keputusan (submitted/under-review).`) }

  const expiredDocumentCount = getDocumentsForProject(project.id).filter(document => isDocumentExpired(document.expiresAt)).length
  if (expiredDocumentCount > 0) { blockers.push(`${expiredDocumentCount} dokumen project ini sudah kedaluwarsa (isDocumentExpired) — perbarui atau ganti sebelum menutup project.`) }

  return { ready: blockers.length === 0, blockers }
}

/**
 * "Close Project" action (Section 24, Wajib literal: "services completed, finance finalized, unresolved
 * issues handled, documents complete, client feedback/final note, closure summary"). Gerbang: HANYA
 * berhasil bila `evaluateProjectClosureGate` mengembalikan `ready: true` DAN `finalNote` diisi (Wajib
 * "client feedback/final note" — minimal salah satu narrative field terisi, `finalNote` wajib karena
 * `clientFeedback` bisa jujur kosong bila client tidak memberi feedback tertulis). Menyetel
 * `Project.closedAt`/`closedBy` (dipakai `getProjectOrderStatus()`, D-066, LOCOKED — TIDAK diubah) dan
 * mengisi 3 field derivasi baru + narrative di `closureChecklist` sebagai SNAPSHOT hasil gate saat itu
 * (bukan sumber kebenaran independen — re-run `evaluateProjectClosureGate` tetap yang dipercaya bila
 * dicek ulang). Role gate (Management/PM) diterapkan di level UI (`canCloseProject`, pola narrow-role-
 * exception sama `canManageProjectOrder`), BUKAN di sini — konsisten dengan `closeProjectFinance`/
 * `updateProjectStatus` yang juga tidak melakukan role-check sendiri di data layer.
 */
export function closeProject (projectId: string, actorId: string, finalNote: string, clientFeedback?: string): { success: boolean; blockers: string[] } {
  const project = getProjectById(projectId)
  if (!project) { return { success: false, blockers: ['Project tidak ditemukan.'] } }
  if (project.closedAt) { return { success: false, blockers: ['Project ini sudah ditutup sebelumnya.'] } }
  if (!finalNote.trim()) { return { success: false, blockers: ['Final note wajib diisi sebelum menutup project.'] } }

  const gate = evaluateProjectClosureGate(projectId)
  if (!gate.ready) { return { success: false, blockers: gate.blockers } }

  project.closedAt = DEMO_REFERENCE_DATE
  project.closedBy = actorId
  project.closureChecklist = {
    financeSettled: true,
    documentsArchived: project.closureChecklist?.documentsArchived ?? false,
    feedbackCollected: project.closureChecklist?.feedbackCollected ?? false,
    assetsReturned: project.closureChecklist?.assetsReturned ?? false,
    ...project.closureChecklist,
    servicesCompleted: true,
    unresolvedIssuesHandled: true,
    documentsComplete: true,
    finalNote: finalNote.trim(),
    clientFeedback: clientFeedback?.trim() || undefined
  }

  const actor = getUserById(actorId)
  ACTIVITIES.push({
    id: nextSequentialId('ACT-', ACTIVITIES),
    projectId,
    message: `Project Order ditutup (Close Project) oleh ${actor?.name ?? actorId}. Final note: "${finalNote.trim()}".${clientFeedback?.trim() ? ` Client feedback: "${clientFeedback.trim()}".` : ''}`,
    isChange: false,
    reviewed: true,
    createdAt: DEMO_REFERENCE_DATE
  })
  return { success: true, blockers: [] }
}

export interface ProjectClosureSummary {
  totalServices: number
  totalBookings: number
  totalInvoicedIdr: number
  totalPaidIdr: number
  incidentsTotal: number
  incidentsResolved: number
  changeRequestsTotal: number
  changeRequestsImplemented: number
}

/**
 * Closure summary (Wajib "closure summary") — SELURUH angka derivasi dari data existing (bukan fabrikasi).
 * Dipanggil setelah `closeProject` berhasil (atau kapan pun untuk pratinjau) untuk ditampilkan di UI.
 */
export function getProjectClosureSummary (projectId: string): ProjectClosureSummary {
  const totalServices = getProjectServices(projectId).length
  const totalBookings = FLIGHT_BOOKINGS.filter(b => b.projectId === projectId).length +
    HOTEL_BOOKINGS.filter(b => b.projectId === projectId).length +
    TRANSPORT_BOOKINGS.filter(b => b.projectId === projectId).length +
    MICE_EVENTS.filter(e => e.projectId === projectId).length
  const invoices = getInvoicesByProject(projectId)
  const totalInvoicedIdr = invoices.reduce((sum, invoice) => sum + invoice.amountIdr, 0)
  const totalPaidIdr = invoices.reduce((sum, invoice) => sum + getPaymentsByInvoice(invoice.id).reduce((s, p) => s + p.amountIdr, 0), 0)
  const incidents = getIncidentsByProject(projectId)
  const changeRequests = getChangeRequestsByProject(projectId)
  return {
    totalServices,
    totalBookings,
    totalInvoicedIdr,
    totalPaidIdr,
    incidentsTotal: incidents.length,
    incidentsResolved: incidents.filter(i => i.status === 'resolved' || i.status === 'closed').length,
    changeRequestsTotal: changeRequests.length,
    changeRequestsImplemented: changeRequests.filter(c => c.status === 'implemented').length
  }
}

/** Team assignment (Wajib "Team assignment dan role responsibilities") — `teamUserIds` sudah ada sejak Foundation, sebelumnya tidak ada mutator untuk mengelolanya. */
export function addProjectTeamMember (projectId: string, userId: string): Project | undefined {
  const project = getProjectById(projectId)
  if (!project || project.teamUserIds.includes(userId)) { return undefined }
  project.teamUserIds.push(userId)
  return project
}

export function removeProjectTeamMember (projectId: string, userId: string): Project | undefined {
  const project = getProjectById(projectId)
  if (!project) { return undefined }
  project.teamUserIds = project.teamUserIds.filter(id => id !== userId)
  return project
}

/** Tasks/Milestones/Dependencies (Wajib) — Tasks tab sebelumnya read-only murni, tidak ada create/edit sama sekali. */
export interface CreateProjectTaskInput {
  projectId: string
  title: string
  dueAt?: string
  isMilestone?: boolean
  dependsOnTaskId?: string
  assignedTo?: string
}

export function createProjectTask (input: CreateProjectTaskInput): ProjectTask {
  const task: ProjectTask = { id: nextSequentialId('TSK-', TASKS), status: 'not-started', ...input }
  TASKS.push(task)
  // Hook Section 21 (D-078, CI-051, hook #4a) — task assignment saat pembuatan memicu Notification type 'assignment'.
  if (task.assignedTo) { pushNotification(task.assignedTo, 'assignment', 'Anda ditugaskan pada task baru', `Task "${task.title}" ditugaskan kepada Anda.`, 'project', task.projectId) }
  return task
}

export function updateProjectTask (taskId: string, patch: Partial<Omit<ProjectTask, 'id' | 'projectId'>>): ProjectTask | undefined {
  const task = TASKS.find(item => item.id === taskId)
  if (!task) { return undefined }
  // Hook Section 21 (D-078, CI-051, hook #4b) — reassignment task memicu Notification type 'assignment' ke assignee baru. Guard mencegah notifikasi berulang saat patch tidak mengubah assignedTo.
  if (patch.assignedTo && patch.assignedTo !== task.assignedTo) {
    pushNotification(patch.assignedTo, 'assignment', 'Anda ditugaskan pada task baru', `Task "${task.title}" ditugaskan kepada Anda.`, 'project', task.projectId)
  }
  Object.assign(task, patch)
  return task
}

/** Risks (Wajib) — entitas baru, lihat rasional di `ProjectRisk` (`app/types/activity.ts`). */
export interface CreateProjectRiskInput {
  projectId: string
  title: string
  description?: string
  severity: ProjectRiskSeverity
  raisedBy: string
}

export function createProjectRisk (input: CreateProjectRiskInput): ProjectRisk {
  const risk: ProjectRisk = { id: nextSequentialId('RSK-', PROJECT_RISKS), status: 'open', createdAt: DEMO_REFERENCE_DATE, ...input }
  PROJECT_RISKS.push(risk)
  return risk
}

export function updateProjectRiskStatus (riskId: string, status: ProjectRisk['status']): ProjectRisk | undefined {
  const risk = PROJECT_RISKS.find(item => item.id === riskId)
  if (!risk) { return undefined }
  risk.status = status
  return risk
}

/** Tab "Documents" Customer Detail (Prompt 19) — union dokumen lintas seluruh Project Order milik satu Company, reuse `getDocumentsByProject`, bukan entitas `PartyDocument` paralel. */
export function getDocumentsByParty (partyId: string) {
  return getProjectsByParty(partyId).flatMap(project => getDocumentsByProject(project.id))
}

/** Opportunity/Project Order milik satu Account Executive (Prompt 19) — dipakai filter "milik saya" dan Customer Journey Dashboard. */
export const getOpportunitiesByOwner = (ownerId: string) => OPPORTUNITIES.filter(opp => opp.ownerId === ownerId)
export function getProjectsByAccountExecutive (accountExecutiveId: string) {
  const ownedOpportunityIds = new Set(getOpportunitiesByOwner(accountExecutiveId).map(opp => opp.id))
  return PROJECTS.filter(project => project.opportunityId && ownedOpportunityIds.has(project.opportunityId))
}
/** Company (Party) yang di-owning oleh satu Account Executive (Section 07) — dipakai scoping "portfolio saya" di Customer Journey Dashboard/Customers list, pelengkap `getOpportunitiesByOwner`/`getProjectsByAccountExecutive` yang sudah ada. */
export const getPartiesByAccountOwner = (accountExecutiveId: string) => PARTIES.filter(party => party.accountOwnerId === accountExecutiveId)

/** Project yang butuh perhatian, dengan konteks invoice/task/activity masing-masing sudah dihitung. */
export function getProjectsNeedingAttention () {
  return PROJECTS.filter(project =>
    isProjectNeedingAttention(project, {
      invoices: getInvoicesByProject(project.id),
      tasks: getTasksByProject(project.id),
      activities: getActivitiesByProject(project.id)
    })
  )
}

/** Section 20 — `'void'` dikecualikan bersama `'paid'` (invoice dibatalkan bukan "outstanding"). */
export function getOutstandingInvoices () {
  return INVOICES.filter(invoice => invoice.status !== 'paid' && invoice.status !== 'void')
}

/** Selector tambahan Section 06 (Dashboard) — dipakai widget role-aware ("milik sendiri", service readiness, dll). */

export const getProjectsByOwner = (ownerId: string) => PROJECTS.filter(project => project.ownerId === ownerId)

export function getServicesForProjects (projectIds: string[], type?: ServiceTypeKey) {
  return PROJECT_SERVICES.filter(service =>
    projectIds.includes(service.projectId) && (!type || service.type === type)
  )
}

export function getUpcomingTasks (projectIds?: string[]) {
  return TASKS
    .filter(task => isTaskUpcoming(task) && (!projectIds || projectIds.includes(task.projectId)))
    .sort((a, b) => (a.dueAt ?? '').localeCompare(b.dueAt ?? ''))
}

export function getRecentChanges (projectIds?: string[], limit = 5) {
  return ACTIVITIES
    .filter(activity => activity.isChange && (!projectIds || projectIds.includes(activity.projectId)))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit)
}

/** Selector dan create-mock Section 07 (CRM Party). */

export function getPartyActivities (partyId: string) {
  return PARTY_ACTIVITIES
    .filter(activity => activity.partyId === partyId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

/** Activity/follow-up milik satu Opportunity spesifik (Section 08) — subset dari `getPartyActivities`. */
export function getPartyActivitiesByOpportunity (opportunityId: string) {
  return PARTY_ACTIVITIES
    .filter(activity => activity.opportunityId === opportunityId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

/** Widget Dashboard Sales "Follow-up Mendatang" — deferred di Section 06, diisi Section 07. */
export function getUpcomingFollowUps (ownerId?: string) {
  return PARTY_ACTIVITIES
    .filter(activity => isFollowUpUpcoming(activity) && (!ownerId || activity.ownerId === ownerId))
    .sort((a, b) => (a.dueAt ?? '').localeCompare(b.dueAt ?? ''))
}

/** Generate ID berurutan 3-digit dari prefix (mis. `PTY-` → `PTY-005`) — dipakai seluruh create-mock di bawah. */
function nextSequentialId (prefix: string, list: { id: string }[]): string {
  const numbers = list
    .map(item => Number.parseInt(item.id.replace(prefix, ''), 10))
    .filter(n => !Number.isNaN(n))
  const next = (numbers.length ? Math.max(...numbers) : 0) + 1
  return `${prefix}${String(next).padStart(3, '0')}`
}

/**
 * Create-mock (Section 07) — mutasi langsung ke array `reactive` di `app/data/parties.ts`, terlihat
 * seketika di seluruh halaman yang membaca `PARTIES`/`CONTACTS`/`PARTY_ACTIVITIES` tanpa reload.
 * `createdAt` memakai `DEMO_REFERENCE_DATE` (bukan waktu perangkat nyata), konsisten dengan D-040 —
 * seluruh skenario demo memakai satu jam tetap, bukan `new Date()`.
 */
export function createParty (input: { name: string; industry?: string }): Party {
  const party: Party = {
    id: nextSequentialId('PTY-', PARTIES),
    name: input.name,
    lifecycleStatus: 'prospect',
    industry: input.industry,
    createdAt: DEMO_REFERENCE_DATE
  }
  PARTIES.push(party)
  return party
}

export function createContact (input: { partyId: string; name: string; title: string; email?: string; phone?: string }): ContactPerson {
  const contact: ContactPerson = { id: nextSequentialId('CP-', CONTACTS), ...input }
  CONTACTS.push(contact)
  return contact
}

export function createPartyActivity (input: { partyId: string; opportunityId?: string; type: PartyActivityType; message: string; ownerId: string; dueAt?: string }): PartyActivity {
  const activity: PartyActivity = { id: nextSequentialId('PACT-', PARTY_ACTIVITIES), createdAt: DEMO_REFERENCE_DATE, ...input }
  PARTY_ACTIVITIES.push(activity)
  return activity
}

/**
 * Mutasi dan create-mock Section 08 (Opportunity dan Quotation) — melanjutkan pola Section 07.
 * Transisi stage TIDAK memvalidasi ulang state diagram di sini (validasi ada di UI — tombol yang
 * ditampilkan sudah dibatasi sesuai stage aktif); helper ini murni mutasi + bookkeeping timestamp.
 */
export function advanceOpportunityStage (opportunityId: string, nextStage: OpportunityStage, extra?: { lostReason?: string }): Opportunity | undefined {
  const opportunity = getOpportunityById(opportunityId)
  if (!opportunity) { return undefined }
  opportunity.stage = nextStage
  if (nextStage === 'lost') {
    opportunity.decidedAt = DEMO_REFERENCE_DATE
    opportunity.lostReason = extra?.lostReason
  }
  return opportunity
}

export function createQuotation (opportunityId: string, amountIdr: number): Quotation {
  const quotation: Quotation = {
    id: nextSequentialId('QUO-', QUOTATIONS),
    opportunityId,
    amountIdr,
    createdAt: DEMO_REFERENCE_DATE,
    accepted: false,
    version: 1
  }
  QUOTATIONS.push(quotation)
  const opportunity = getOpportunityById(opportunityId)
  if (opportunity) { opportunity.quotationId = quotation.id }
  return quotation
}

export function reviseQuotation (quotationId: string, newAmountIdr: number): Quotation | undefined {
  const quotation = QUOTATIONS.find(q => q.id === quotationId)
  if (!quotation) { return undefined }
  quotation.supersededAmountIdr = quotation.amountIdr
  quotation.amountIdr = newAmountIdr
  quotation.version += 1
  quotation.createdAt = DEMO_REFERENCE_DATE
  quotation.approvalStatus = 'draft'
  return quotation
}

/**
 * "Edit Quotation" (Prompt 20-9/11) — melengkapi detail komersial (discount/estimated cost/estimated
 * margin/payment terms/service breakdown) SELAGI quotation masih draft, tanpa membuat versi baru (berbeda
 * dari `reviseQuotation`/"Create New Version" yang menaikkan `version` dan mereset `approvalStatus`). Guard:
 * hanya boleh diedit selama belum `submitted`/`approved` (setelah itu harus lewat revisi versi baru).
 */
export interface QuotationDetailInput {
  amountIdr?: number
  discountIdr?: number
  estimatedCostIdr?: number
  estimatedMarginIdr?: number
  paymentTerms?: string
  serviceBreakdown?: Quotation['serviceBreakdown']
  taxIdr?: number
  markupIdr?: number
  currency?: string
  validUntil?: string
  termsAndConditions?: string
  inclusions?: string
  exclusions?: string
}

export function updateQuotationDetails (quotationId: string, patch: QuotationDetailInput): Quotation | undefined {
  const quotation = QUOTATIONS.find(q => q.id === quotationId)
  if (!quotation) { return undefined }
  if (quotation.approvalStatus === 'submitted' || quotation.approvalStatus === 'approved') { return undefined }
  Object.assign(quotation, patch)
  return quotation
}

/**
 * "Duplicate" (Section 05) — berbeda dari `reviseQuotation`/"Create New Version" (yang mengosongkan nilai
 * baru untuk diisi ulang): `duplicateQuotationVersion` menyalin SELURUH field quotation saat ini (amount,
 * discount, tax, markup, service breakdown, dst.) sebagai versi baru, `approvalStatus` direset ke draft —
 * titik awal AE mengedit dari salinan persis, bukan dari kosong.
 */
export function duplicateQuotationVersion (quotationId: string): Quotation | undefined {
  const quotation = QUOTATIONS.find(q => q.id === quotationId)
  if (!quotation) { return undefined }
  quotation.supersededAmountIdr = quotation.amountIdr
  quotation.version += 1
  quotation.createdAt = DEMO_REFERENCE_DATE
  quotation.approvalStatus = 'draft'
  quotation.approvedBy = undefined
  quotation.approvalNote = undefined
  quotation.sentToClientAt = undefined
  return quotation
}

/** "Send mock ke client" (Section 05) — simulasi timestamp pengiriman, TIDAK mengirim email/WA nyata (D-006). */
export function sendQuotationToClient (quotationId: string): Quotation | undefined {
  const quotation = QUOTATIONS.find(q => q.id === quotationId)
  if (!quotation) { return undefined }
  quotation.sentToClientAt = DEMO_REFERENCE_DATE
  return quotation
}

/**
 * "Withdraw" (Section 05) — AE menarik kembali quotation yang sudah `submitted` (sebelum Management
 * sempat approve/reject), kembali ke `draft` agar bisa diedit ulang. Guard: hanya dari status `submitted`.
 */
export function withdrawQuotationSubmission (quotationId: string): Quotation | undefined {
  const quotation = QUOTATIONS.find(q => q.id === quotationId)
  if (!quotation || quotation.approvalStatus !== 'submitted') { return undefined }
  quotation.approvalStatus = 'draft'
  return quotation
}

/**
 * Commercial Approval (Prompt 19 — Change Request). Terpisah dari `approveOpportunityWon`/
 * `rejectOpportunityWon` (Section 09, gerbang final "Mark as Won") — quotation harus `approved` di sini
 * dulu sebelum Opportunity boleh diajukan ke stage `won-requested` (digerbangi di UI Opportunity Detail).
 *
 * Section 06 — ketiga mutator di bawah mencatat `PartyActivity` per keputusan (submit/approve/reject),
 * memberi jejak "notes/history" yang literal diminta Wajib Section 06 ("Approve, reject, return for
 * revision dengan notes/history") — sebelumnya hanya `approvalNote`/`approvedBy` (nilai tunggal, tertimpa
 * tiap keputusan baru) yang tersimpan, tidak ada histori. Reuse penuh tab "Activity / Follow-up" existing
 * di Opportunity Detail (Section 07/08) — tidak ada UI/komponen histori baru yang dibangun.
 */
export function submitQuotationForApproval (quotationId: string): Quotation | undefined {
  const quotation = QUOTATIONS.find(q => q.id === quotationId)
  if (!quotation) { return undefined }
  quotation.approvalStatus = 'submitted'
  const opportunity = getOpportunityById(quotation.opportunityId)
  if (opportunity) {
    createPartyActivity({
      partyId: opportunity.partyId,
      opportunityId: opportunity.id,
      type: 'note',
      message: `Quotation ${quotation.id} (${formatCurrencyIdr(quotation.amountIdr)}) diajukan untuk commercial approval.`,
      ownerId: opportunity.ownerId
    })
  }
  return quotation
}

export function approveQuotation (quotationId: string, approverId: string, note?: string): Quotation | undefined {
  const quotation = QUOTATIONS.find(q => q.id === quotationId)
  if (!quotation || quotation.approvalStatus !== 'submitted') { return undefined }
  quotation.approvalStatus = 'approved'
  quotation.approvedBy = approverId
  quotation.approvalNote = note
  const opportunity = getOpportunityById(quotation.opportunityId)
  if (opportunity) {
    createPartyActivity({
      partyId: opportunity.partyId,
      opportunityId: opportunity.id,
      type: 'note',
      message: `Quotation ${quotation.id} disetujui (Commercial Approval).${note ? ` Catatan: ${note}` : ''}`,
      ownerId: approverId
    })
  }
  return quotation
}

/**
 * "Reject" bertindak sekaligus sebagai "Return for Revision" (Section 06, D-063) — bukan status paralel
 * baru. Quotation kembali dapat direvisi AE lewat "Create New Version" (`reviseQuotation`, mereset
 * `approvalStatus` ke draft), jadi setiap reject SECARA FUNGSIONAL selalu berarti "kembalikan untuk
 * direvisi", sesuai teks bantuan UI existing ("Ditolak — revisi quotation lalu submit ulang").
 */
export function rejectQuotation (quotationId: string, approverId: string, note: string): Quotation | undefined {
  const quotation = QUOTATIONS.find(q => q.id === quotationId)
  if (!quotation || quotation.approvalStatus !== 'submitted') { return undefined }
  quotation.approvalStatus = 'rejected'
  quotation.approvedBy = approverId
  quotation.approvalNote = note
  const opportunity = getOpportunityById(quotation.opportunityId)
  if (opportunity) {
    createPartyActivity({
      partyId: opportunity.partyId,
      opportunityId: opportunity.id,
      type: 'note',
      message: `Quotation ${quotation.id} ditolak (dikembalikan untuk revisi). Catatan: ${note}`,
      ownerId: approverId
    })
  }
  return quotation
}

/**
 * Opportunity Won to Project (Section 09) — docs/route-and-role-matrix.md bagian 2.2 (checklist efek Won, LOCKED).
 */

/** PM default untuk project hasil konversi Won — belum ada alur assignment PM manual, lihat section report. */
const DEFAULT_PROJECT_OWNER_ID = 'USR-002'

/** "Requirement validation" (Section 09) — field yang wajib terisi sebelum Opportunity boleh di-Won-kan. */
export function getOpportunityMissingRequirements (opportunityId: string): string[] {
  const opportunity = getOpportunityById(opportunityId)
  if (!opportunity) { return ['Opportunity tidak ditemukan'] }
  const missing: string[] = []
  if (!opportunity.destination) { missing.push('Destinasi') }
  if (!opportunity.travelStartDate || !opportunity.travelEndDate) { missing.push('Tanggal perjalanan perkiraan') }
  if (!opportunity.travelerEstimate) { missing.push('Estimasi jumlah traveler') }
  if (!getQuotationByOpportunity(opportunityId)) { missing.push('Quotation') }
  return missing
}

/**
 * Requirement Gate SEBELUM Quotation (Prompt 20-10) — TERPISAH dari `getOpportunityMissingRequirements`
 * (gerbang final sebelum Won, yang justru mensyaratkan Quotation SUDAH ada). Dicek sebelum AE diizinkan
 * membuat Quotation pertama (`openProposalDialog`, Opportunity Detail) — daftar field literal Prompt 20-10:
 * destination, travel period, estimated traveler, service scope, requirement summary, contact person,
 * Account Executive (selalu terisi sejak Opportunity dibuat, tidak dicek ulang), estimated value.
 * Payment terms/margin-cost summary sengaja TIDAK digerbangi di sini (Prompt 20-10 menandainya "bila
 * diwajibkan"/"bila dipakai pada approval" — kondisional tanpa mekanisme konfigurasi eksplisit lain di
 * codebase, jadi diperlakukan sebagai field opsional pada Quotation, bukan blocking gate).
 */
export function getOpportunityRequirementGate (opportunityId: string): string[] {
  const opportunity = getOpportunityById(opportunityId)
  if (!opportunity) { return ['Opportunity tidak ditemukan'] }
  const missing: string[] = []
  if (!opportunity.destination) { missing.push('Destinasi belum diisi') }
  if (!opportunity.travelStartDate || !opportunity.travelEndDate) { missing.push('Periode perjalanan belum diisi') }
  if (!opportunity.travelerEstimate) { missing.push('Estimasi traveler belum diisi') }
  if (!opportunity.serviceScope || opportunity.serviceScope.length === 0) { missing.push('Service scope belum dipilih') }
  if (!opportunity.requirementNotes) { missing.push('Ringkasan kebutuhan (requirement summary) belum diisi') }
  if (!opportunity.contactName) { missing.push('Contact person belum diisi') }
  if (!opportunity.estimatedValueIdr) { missing.push('Estimasi nilai (quotation value) belum diisi') }
  return missing
}

/**
 * AE Requirement Detail (Prompt 20-8B/9) — "Edit Requirement": AE dapat mengubah/menyempurnakan field dasar
 * requirement (dibawa dari Lead qualification) DAN melengkapi `requirementDetail` (itinerary concept,
 * departure city, dst.) tanpa menghapus histori qualification (field lama tetap ada, hanya di-overwrite bila
 * diisi ulang lewat form ini).
 */
export interface OpportunityRequirementInput {
  destination?: string
  travelStartDate?: string
  travelEndDate?: string
  travelerEstimate?: number
  serviceScope?: Opportunity['serviceScope']
  requirementNotes?: string
  contactName?: string
  estimatedValueIdr?: number
  requirementDetail?: Opportunity['requirementDetail']
}

export function updateOpportunityRequirement (opportunityId: string, patch: OpportunityRequirementInput): Opportunity | undefined {
  const opportunity = getOpportunityById(opportunityId)
  if (!opportunity) { return undefined }
  Object.assign(opportunity, patch)
  return opportunity
}

/**
 * Client Confirmation (Section 05) — dicatat AE setelah quotation `approved`, gerbang TAMBAHAN sebelum
 * "Mark as Won" (lihat `Opportunity.clientConfirmedAt`, `app/types/opportunity.ts`). Mock — bukan integrasi
 * email/WA nyata (D-006); hanya mencatat bahwa AE sudah menerima konfirmasi lewat kanal apa pun.
 */
export function recordClientConfirmation (opportunityId: string, actorId: string, note?: string): Opportunity | undefined {
  const opportunity = getOpportunityById(opportunityId)
  if (!opportunity) { return undefined }
  opportunity.clientConfirmedAt = DEMO_REFERENCE_DATE
  opportunity.clientConfirmationNote = note
  createPartyActivity({
    partyId: opportunity.partyId,
    opportunityId: opportunity.id,
    type: 'note',
    message: `Client confirmation dicatat.${note ? ` Catatan: ${note}` : ''}`,
    ownerId: actorId
  })
  return opportunity
}

/**
 * Status workflow AE-facing (Prompt 20-10/14) — lihat `OpportunityWorkflowStatus` (`app/types/opportunity.ts`)
 * untuk rasional lengkap. DIRIVASI, bukan field tersimpan — tidak merestrukturisasi `OpportunityStage` (D-049).
 */
export function getOpportunityWorkflowStatus (opportunityId: string): OpportunityWorkflowStatus | undefined {
  const opportunity = getOpportunityById(opportunityId)
  if (!opportunity) { return undefined }
  if (opportunity.stage === 'won') { return 'won' }
  if (opportunity.stage === 'lost') { return 'lost' }

  const quotation = getQuotationByOpportunity(opportunityId)
  if (!quotation) {
    return getOpportunityRequirementGate(opportunityId).length > 0 ? 'pending-requirement' : 'ready-for-quotation'
  }
  const approvalStatus = quotation.approvalStatus ?? 'draft'
  if (approvalStatus === 'submitted') { return 'pending-management-approval' }
  if (approvalStatus === 'approved') { return 'approved' }
  return 'quotation-draft'
}

/**
 * Approve Won — sejak D-053 (Prompt 20) dipanggil dari "Mark as Won" oleh AE (`canManageOpportunity`),
 * BUKAN langsung oleh Management (approver dikreditkan lewat parameter `approverId`, umumnya
 * `quotation.approvedBy`). Guard "duplicate prevention": jika opportunity sudah punya `projectId`,
 * kembalikan project yang sudah ada tanpa membuat duplikat. Guard stage: hanya bisa dari `won-requested`.
 *
 * Section 06 — guard tambahan `quotation.approvalStatus === 'approved'` dan `opportunity.clientConfirmedAt`
 * DIPINDAHKAN ke level data (sebelumnya hanya dicek di UI Opportunity Detail, Section 05) — literal Wajib
 * Section 06 "Seluruh permitted dan forbidden flow dapat diuji melalui role switcher" berarti forbidden
 * flow harus benar-benar diblokir di mutator, bukan hanya disembunyikan lewat tombol disabled.
 */
export function approveOpportunityWon (opportunityId: string, approverId: string): Project | undefined {
  const opportunity = getOpportunityById(opportunityId)
  if (!opportunity || opportunity.stage !== 'won-requested') { return undefined }
  if (opportunity.projectId) { return getProjectById(opportunity.projectId) }
  if (getOpportunityMissingRequirements(opportunityId).length > 0) { return undefined }

  const quotation = getQuotationByOpportunity(opportunityId)!
  if (quotation.approvalStatus !== 'approved' || !opportunity.clientConfirmedAt) { return undefined }
  const party = getPartyById(opportunity.partyId)

  const project: Project = {
    id: nextSequentialId('PRJ-', PROJECTS),
    name: opportunity.title,
    partyId: opportunity.partyId,
    opportunityId: opportunity.id,
    sourceQuotationId: quotation.id,
    destination: opportunity.destination,
    travelStartDate: opportunity.travelStartDate!,
    travelEndDate: opportunity.travelEndDate!,
    characteristic: 'normal',
    serviceScope: opportunity.serviceScope,
    travelerCount: opportunity.travelerEstimate!,
    ownerId: DEFAULT_PROJECT_OWNER_ID,
    teamUserIds: [opportunity.ownerId],
    status: 'draft',
    quotationAmountIdr: quotation.amountIdr,
    budgetIdr: quotation.amountIdr,
    actualCostIdr: 0
  }
  PROJECTS.push(project)

  opportunity.stage = 'won'
  opportunity.decidedAt = DEMO_REFERENCE_DATE
  opportunity.wonApprovedBy = approverId
  opportunity.projectId = project.id

  if (party) {
    if (party.lifecycleStatus === 'prospect') { party.lifecycleStatus = 'client' }
    // "Account Owner AE" (Section 06 — checklist transaksi Won): tegaskan ulang AE deal ini sebagai
    // account owner company, konsisten dengan pengisian awal di `qualifyLeadAndCreateOpportunity`.
    party.accountOwnerId = opportunity.ownerId
  }

  const approver = getUserById(approverId)
  ACTIVITIES.push({
    id: `ACT-${project.id.replace('PRJ-', '')}1`,
    projectId: project.id,
    message: `Project ${project.id} dibuat dari Opportunity ${opportunity.id} (Won oleh ${approver?.name ?? approverId})`,
    isChange: false,
    reviewed: true,
    createdAt: DEMO_REFERENCE_DATE
  })

  return project
}

/** Reject — kembali ke Negotiation dengan catatan (docs bagian 2.1: "WonRequested → Negotiation: ditolak, kembali dengan catatan"). */
export function rejectOpportunityWon (opportunityId: string, note: string): Opportunity | undefined {
  const opportunity = getOpportunityById(opportunityId)
  if (!opportunity || opportunity.stage !== 'won-requested') { return undefined }
  opportunity.stage = 'negotiation'
  createPartyActivity({
    partyId: opportunity.partyId,
    opportunityId: opportunity.id,
    type: 'note',
    message: `Approval Won ditolak, kembali ke Negotiation. Catatan: ${note}`,
    ownerId: opportunity.ownerId
  })
  return opportunity
}

/**
 * Traveler and Participant (Section 11 lama) + Traveler dan Travel Documents (Section 11 baru, roadmap
 * Section 00–24) — create/edit/remove/import preview+commit/verify, melanjutkan pola mutasi `reactive()`
 * Section 07-10. Tidak menyentuh `project.travelerCount` (headcount resmi skenario demo, lihat catatan
 * cakupan data di `app/data/projects.ts`) — menambah/menghapus profil traveler tidak mengubah angka itu,
 * konsisten dengan keduanya sebagai konsep terpisah (headcount vs profil tercatat).
 */

export interface CreateTravelerInput {
  projectId: string
  groupId?: string
  name: string
  passportNumber?: string
  passportExpiryDate?: string
  emergencyContactName?: string
  emergencyContactPhone?: string
  specialRequest?: string
  /** Section 11 (roadmap Section 00–24 baru) — lihat komentar `Traveler` (`app/types/project.ts`). */
  idNumber?: string
  visaNumber?: string
  visaExpiryDate?: string
  dietaryRestrictions?: string
  accessibilityNeeds?: string
  companionOfTravelerId?: string
}

export function createTraveler (input: CreateTravelerInput): Traveler {
  const traveler: Traveler = { id: nextSequentialId('TRV-', TRAVELERS), ...input }
  TRAVELERS.push(traveler)
  return traveler
}

export function updateTraveler (id: string, patch: Partial<Omit<Traveler, 'id' | 'projectId'>>): Traveler | undefined {
  const traveler = TRAVELERS.find(item => item.id === id)
  if (!traveler) { return undefined }
  Object.assign(traveler, patch)
  return traveler
}

export function removeTraveler (id: string): boolean {
  const index = TRAVELERS.findIndex(item => item.id === id)
  if (index === -1) { return false }
  TRAVELERS.splice(index, 1)
  for (const room of ROOM_ASSIGNMENTS) {
    const roomIndex = room.travelerIds.indexOf(id)
    if (roomIndex !== -1) { room.travelerIds.splice(roomIndex, 1) }
  }
  return true
}

/**
 * "Internal verification" (Section 11 baru, Wajib) — tindakan manusia (staf internal mengonfirmasi dokumen
 * sudah diperiksa), TERPISAH dari `isTravelerDocumentMissing` (computed kelengkapan field). Toggle tunggal
 * (verify jika belum, unverify jika sudah) — pola cycle sederhana sama seperti `updateProjectRiskStatus`.
 */
export function toggleTravelerVerification (travelerId: string, actorId: string): Traveler | undefined {
  const traveler = TRAVELERS.find(item => item.id === travelerId)
  if (!traveler) { return undefined }
  if (traveler.documentsVerifiedAt) {
    traveler.documentsVerifiedAt = undefined
    traveler.documentsVerifiedBy = undefined
  } else {
    traveler.documentsVerifiedAt = DEMO_REFERENCE_DATE
    traveler.documentsVerifiedBy = actorId
  }
  return traveler
}

/**
 * "Readiness indicator" (Section 11 baru, Wajib) — DIRIVASI, bukan field tersimpan (pola sama
 * `getCostSheetBreakdown`/`getProjectOrderStatus`). Scoped ke kesiapan DATA traveler (dokumen lengkap,
 * terverifikasi, rooming ditugaskan) — berbeda dari readiness checklist/matrix agregat lintas-domain
 * (booking/payment/dst.) yang menjadi tanggung jawab Section 12 (`docs/frontend-known-issues.md` bagian 10,
 * KNOWN_GAP terpisah, tidak tumpang tindih).
 */
export interface TravelerReadinessSummary {
  total: number
  documentsCompleteCount: number
  verifiedCount: number
  roomingAssignedCount: number
  readinessPercent: number
}

export function getTravelerReadiness (projectId: string): TravelerReadinessSummary {
  const project = getProjectById(projectId)
  const list = getTravelers(projectId)
  const total = list.length
  const documentsCompleteCount = list.filter(traveler => !isTravelerDocumentMissing(traveler, project?.travelStartDate)).length
  const verifiedCount = list.filter(traveler => Boolean(traveler.documentsVerifiedAt)).length
  const assignedIds = new Set(getRoomAssignments(projectId).flatMap(room => room.travelerIds))
  const roomingAssignedCount = list.filter(traveler => assignedIds.has(traveler.id)).length
  const readinessPercent = total === 0 ? 0 : Math.round(((documentsCompleteCount + verifiedCount) / (total * 2)) * 100)
  return { total, documentsCompleteCount, verifiedCount, roomingAssignedCount, readinessPercent }
}

/** Satu baris preview hasil simulasi bulk import (Section 11 baru) — belum tersimpan ke `TRAVELERS`. */
export interface TravelerImportPreviewRow {
  name: string
  passportNumber?: string
  groupId?: string
  errors: string[]
}

/**
 * "Bulk import preview dan error report mock" (Section 11 baru, Wajib) — MENGGANTIKAN `importTravelersMock`
 * lama (Section 11 lama, langsung membuat baris tanpa tahap preview/validasi — lihat
 * `docs/mockup-change-impact-log.md` CI-041). Mensimulasikan hasil parsing file (BUKAN parsing file
 * sungguhan, D-006): sebagian baris SENGAJA mengandung error (nama kosong, nomor paspor duplikat dengan
 * traveler existing) agar "error report" punya isi nyata untuk ditampilkan sebelum commit, bukan selalu
 * all-success. Murni fungsi baca (tidak memutasi `TRAVELERS`) — commit terjadi terpisah lewat `commitTravelerImport`.
 */
export function previewTravelerImportMock (projectId: string, count = 5): TravelerImportPreviewRow[] {
  const existing = getTravelers(projectId)
  const rows: TravelerImportPreviewRow[] = []
  for (let i = 1; i <= count; i++) {
    const isEmptyNameRow = i === 2 && count >= 2
    const duplicateCandidate = i === 4 && count >= 4 ? existing[0] : undefined
    const row: TravelerImportPreviewRow = {
      name: isEmptyNameRow ? '' : `Peserta Import ${existing.length + i}`,
      passportNumber: duplicateCandidate?.passportNumber
    }
    const errors: string[] = []
    if (!row.name.trim()) { errors.push('Nama kosong — wajib diisi') }
    if (row.passportNumber && existing.some(traveler => traveler.passportNumber === row.passportNumber)) {
      errors.push(`Nomor paspor duplikat dengan traveler existing (${duplicateCandidate?.name})`)
    }
    rows.push({ ...row, errors })
  }
  return rows
}

/** Membuat traveler hanya dari baris yang lolos validasi (`errors.length === 0`) — baris error dilewati (tidak dibuat), tetap tampil di error report UI sampai dialog ditutup. */
export function commitTravelerImport (projectId: string, rows: TravelerImportPreviewRow[]): Traveler[] {
  const created: Traveler[] = []
  for (const row of rows) {
    if (row.errors.length > 0) { continue }
    created.push(createTraveler({ projectId, name: row.name.trim(), groupId: row.groupId, passportNumber: row.passportNumber }))
  }
  return created
}

/**
 * Itinerary and Operations (Section 12) — update status service, dipanggil hanya dari UI yang sudah
 * memfilter role per-tipe-layanan (`canManageServiceType`, `app/pages/projects/[id]/index.vue`).
 * Transisi ke status `changed` otomatis mencatat entri di `ACTIVITIES` (flag `isChange: true`, belum
 * direview) — sumber log yang sama dipakai tab "Activity & Changes" (Foundation) DAN dashboard/report
 * lain yang membaca `isChange`, bukan log paralel baru. Transisi ke status lain (progres lifecycle normal)
 * tidak mencatat entri — mencegah spam log untuk perubahan status yang bukan "perubahan" dalam pengertian
 * High-Change Project.
 */
export function updateServiceStatus (serviceId: string, newStatus: ServiceStatus) {
  const service = PROJECT_SERVICES.find(item => item.id === serviceId)
  if (!service) { return undefined }
  const previousStatus = service.status
  service.status = newStatus
  if (newStatus === 'changed' && previousStatus !== 'changed') {
    ACTIVITIES.push({
      id: nextSequentialId('ACT-', ACTIVITIES),
      projectId: service.projectId,
      message: `Layanan "${service.label}" ditandai berubah (status: ${findStatusOption(SERVICE_STATUSES, newStatus).label}) — perlu ditinjau.`,
      isChange: true,
      reviewed: false,
      createdAt: DEMO_REFERENCE_DATE
    })
  }
  return service
}

/**
 * "Tasks, checklist, owner, deadline, blocker, dependency" (Section 12 baru, roadmap Section 00–24, Wajib)
 * — toggle tunggal (blokir jika belum, buka blokir jika sudah), pola sama `toggleTravelerVerification`
 * (Section 11). Terpisah dari `status` (LOCKED, dipakai luas Dashboard/Reports) — task `in-progress` bisa
 * saja blocked, keduanya independen.
 */
export function toggleTaskBlocked (taskId: string, reason?: string): ProjectTask | undefined {
  const task = TASKS.find(item => item.id === taskId)
  if (!task) { return undefined }
  if (task.isBlocked) {
    task.isBlocked = false
    task.blockedReason = undefined
  } else {
    if (!reason?.trim()) { return undefined }
    task.isBlocked = true
    task.blockedReason = reason.trim()
  }
  return task
}

/** "Service readiness matrix" (Section 12 baru, Wajib) — DIRIVASI murni dari `PROJECT_SERVICES`, bukan field tersimpan. Tipe layanan diambil dari data aktual (bukan `project.serviceScope`) agar `additional` otomatis ikut bila ada baris, konsisten pola data-driven existing (`app/types/project.ts` komentar `ServiceTypeKey.additional`). */
export interface ServiceReadinessRow {
  type: ServiceTypeKey
  total: number
  confirmedCount: number
  percent: number
}

export function getServiceReadinessMatrix (projectId: string): ServiceReadinessRow[] {
  const services = getProjectServices(projectId)
  const types = Array.from(new Set(services.map(service => service.type)))
  return types.map((type) => {
    const list = services.filter(service => service.type === type)
    const confirmedCount = list.filter(service => ['confirmed', 'completed'].includes(service.status)).length
    return { type, total: list.length, confirmedCount, percent: list.length ? Math.round((confirmedCount / list.length) * 100) : 0 }
  })
}

/**
 * "Departure readiness gates" (Section 12 baru, Wajib) — DIRIVASI, mengagregasi sinyal dari section lain
 * (Traveler Section 11, Service Section 12 lama, Task/Risk Section 09, Invoice Section 15) TANPA menyalin
 * logic-nya — murni memanggil selector existing. Bersifat ADVISORY (menampilkan status, bukan memblokir
 * transisi `updateProjectStatus`) — pola sama Closure Checklist (D-066, shell tanpa gating keras), agar
 * demo tetap fleksibel tanpa perlu seluruh syarat terpenuhi untuk mencoba transisi status.
 */
export interface DepartureReadinessSummary {
  daysUntilDeparture: number
  travelerReadinessPercent: number
  servicesConfirmedPercent: number
  blockedTasksCount: number
  openRisksCount: number
  outstandingInvoiceCount: number
  isReady: boolean
  blockingReasons: string[]
}

export function getDepartureReadiness (projectId: string): DepartureReadinessSummary | undefined {
  const project = getProjectById(projectId)
  if (!project) { return undefined }

  const travelerReadiness = getTravelerReadiness(projectId)
  const serviceMatrix = getServiceReadinessMatrix(projectId)
  const totalServices = serviceMatrix.reduce((sum, row) => sum + row.total, 0)
  const confirmedServices = serviceMatrix.reduce((sum, row) => sum + row.confirmedCount, 0)
  const servicesConfirmedPercent = totalServices === 0 ? 0 : Math.round((confirmedServices / totalServices) * 100)
  const blockedTasksCount = getTasksByProject(projectId).filter(task => task.isBlocked).length
  const openRisksCount = getRisksByProject(projectId).filter(risk => risk.status === 'open').length
  const outstandingInvoiceCount = getInvoicesByProject(projectId).filter(invoice => invoice.status !== 'paid' && invoice.status !== 'void').length

  const blockingReasons: string[] = []
  if (travelerReadiness.total > 0 && travelerReadiness.documentsCompleteCount < travelerReadiness.total) {
    blockingReasons.push(`${travelerReadiness.total - travelerReadiness.documentsCompleteCount} traveler dokumen belum lengkap`)
  }
  if (totalServices > 0 && confirmedServices < totalServices) {
    blockingReasons.push(`${totalServices - confirmedServices} layanan belum Confirmed/Completed`)
  }
  if (blockedTasksCount > 0) { blockingReasons.push(`${blockedTasksCount} task diblokir`) }
  if (openRisksCount > 0) { blockingReasons.push(`${openRisksCount} risk masih Open`) }
  if (outstandingInvoiceCount > 0) { blockingReasons.push(`${outstandingInvoiceCount} invoice belum lunas`) }

  return {
    daysUntilDeparture: daysUntil(project.travelStartDate, DEMO_REFERENCE_DATE),
    travelerReadinessPercent: travelerReadiness.readinessPercent,
    servicesConfirmedPercent,
    blockedTasksCount,
    openRisksCount,
    outstandingInvoiceCount,
    isReady: blockingReasons.length === 0,
    blockingReasons
  }
}

/**
 * "Attention/exception queue" (Section 12 baru, Wajib) — agregasi item yang butuh perhatian lintas tab
 * (Task/Service/Risk/Traveler/Invoice), masing-masing dengan `tab` tujuan agar UI dapat menautkan langsung
 * (`activeTab.value = item.tab`). BUKAN log baru — seluruhnya derivasi dari data existing.
 */
export interface AttentionQueueItem {
  severity: 'low' | 'medium' | 'high'
  message: string
  tab: ProjectDetailTab
}

export function getProjectAttentionQueue (projectId: string): AttentionQueueItem[] {
  const items: AttentionQueueItem[] = []
  for (const task of getTasksByProject(projectId)) {
    if (task.isBlocked) { items.push({ severity: 'high', message: `Task "${task.title}" diblokir: ${task.blockedReason ?? 'alasan belum dicatat'}`, tab: 'tasks' }) } else if (task.status === 'overdue') { items.push({ severity: 'medium', message: `Task "${task.title}" telah melewati jatuh tempo`, tab: 'tasks' }) }
  }
  for (const service of getProjectServices(projectId)) {
    if (service.status === 'changed') { items.push({ severity: 'medium', message: `Layanan "${service.label}" berubah, perlu ditinjau`, tab: 'itinerary-services' }) }
  }
  for (const risk of getRisksByProject(projectId)) {
    if (risk.status === 'open') { items.push({ severity: risk.severity === 'high' ? 'high' : 'medium', message: `Risk terbuka: ${risk.title}`, tab: 'overview' }) }
  }
  const missingDocs = getTravelersMissingDocuments(projectId)
  if (missingDocs.length > 0) { items.push({ severity: 'medium', message: `${missingDocs.length} traveler dokumennya belum lengkap`, tab: 'travelers' }) }
  for (const invoice of getInvoicesByProject(projectId)) {
    if (isInvoiceOverdue(invoice)) { items.push({ severity: 'high', message: `Invoice ${invoice.id} telah jatuh tempo`, tab: 'finance' }) }
  }
  return items
}

/** "On-trip updates dan shift notes mock" (Section 12 baru, Wajib) — log operasional ringkas, lihat `ShiftNote` (`app/types/activity.ts`). Create-only (mock log, tidak ada edit/hapus — konsisten pola append-only catatan operasional). */
export const getShiftNotes = (projectId: string) => SHIFT_NOTES
  .filter(note => note.projectId === projectId)
  .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

export function createShiftNote (input: { projectId: string; authorId: string; shift: ShiftPeriod; note: string }): ShiftNote {
  const note: ShiftNote = { id: nextSequentialId('SFT-', SHIFT_NOTES), createdAt: DEMO_REFERENCE_DATE, ...input }
  SHIFT_NOTES.push(note)
  return note
}

/**
 * Ticketing (Section 13 — roadmap Section 00–24 baru). Lihat `FlightBooking` (`app/types/ticketing.ts`)
 * untuk rasional model. Selector/mutator di bawah melanjutkan pola `reactive()` Section 07 dst.
 */

export const getFlightBookingById = (id: string) => FLIGHT_BOOKINGS.find(booking => booking.id === id)
export const getFlightBookingsByProject = (projectId: string) => FLIGHT_BOOKINGS
  .filter(booking => booking.projectId === projectId)
  .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
export const getFlightBookingsByService = (serviceId: string) => FLIGHT_BOOKINGS.filter(booking => booking.serviceId === serviceId)

/** "Fare rules and financial impact" / "Internal net cost vs client sell price" (Wajib) — derivasi murni, `undefined` bila salah satu harga belum terisi (status `requested`/`hold`). */
export function getFlightBookingMarginIdr (booking: FlightBooking): number | undefined {
  if (booking.netCostIdr === undefined || booking.sellPriceIdr === undefined) { return undefined }
  return booking.sellPriceIdr - booking.netCostIdr
}

export interface CreateFlightBookingInput {
  projectId: string
  serviceId?: string
  segments?: FlightSegment[]
  travelerIds?: string[]
  ticketingDeadline?: string
  fareRules?: string
}

export function createFlightBooking (input: CreateFlightBookingInput): FlightBooking {
  const booking: FlightBooking = {
    id: nextSequentialId('FLT-', FLIGHT_BOOKINGS),
    status: 'requested',
    options: [],
    segments: input.segments ?? [],
    travelerIds: input.travelerIds ?? [],
    createdAt: DEMO_REFERENCE_DATE,
    ...input
  }
  FLIGHT_BOOKINGS.push(booking)
  return booking
}

/** Guard: `refunded` bersifat terminal (lifecycle selesai) — field lain tidak boleh diedit lagi setelahnya, pola sama `CostSheet.status === 'final'` (D-067). */
export type FlightBookingInput = Partial<Omit<FlightBooking, 'id' | 'projectId' | 'createdAt'>>

export function updateFlightBooking (id: string, patch: FlightBookingInput): FlightBooking | undefined {
  const booking = getFlightBookingById(id)
  if (!booking || booking.status === 'refunded') { return undefined }
  Object.assign(booking, patch)
  booking.updatedAt = DEMO_REFERENCE_DATE
  return booking
}

/** "Hold, Confirm, Issue, Reissue, Cancel, Refund state simulation" (Wajib) — peta transisi eksplisit, pola sama `PROJECT_STATUS_TRANSITIONS` (D-066). */
const FLIGHT_BOOKING_TRANSITIONS: Record<FlightBookingStatus, FlightBookingStatus[]> = {
  requested: ['hold', 'confirmed', 'cancelled'],
  hold: ['confirmed', 'cancelled'],
  confirmed: ['issued', 'cancelled'],
  issued: ['reissued', 'cancelled'],
  reissued: ['cancelled'],
  cancelled: ['refunded'],
  refunded: []
}

export function getFlightBookingStatusTransitions (current: FlightBookingStatus): FlightBookingStatus[] {
  return FLIGHT_BOOKING_TRANSITIONS[current] ?? []
}

/** Reason wajib untuk `cancelled`/`refunded` (dampak besar — pola sama `updateProjectStatus`, D-066), dicatat sebagai `ActivityEntry` pada project terkait untuk jejak historis. */
export function updateFlightBookingStatus (bookingId: string, newStatus: FlightBookingStatus, actorId: string, reason?: string): FlightBooking | undefined {
  const booking = getFlightBookingById(bookingId)
  if (!booking) { return undefined }
  if (!getFlightBookingStatusTransitions(booking.status).includes(newStatus)) { return undefined }
  const requiresReason = newStatus === 'cancelled' || newStatus === 'refunded'
  if (requiresReason && !reason?.trim()) { return undefined }

  const fromLabel = booking.status
  booking.status = newStatus
  booking.updatedAt = DEMO_REFERENCE_DATE
  if (reason) { booking.statusReason = reason.trim() }
  syncBookingPaymentGateOnStatusChange('flight', booking.id, booking.projectId, newStatus)

  const actor = getUserById(actorId)
  ACTIVITIES.push({
    id: nextSequentialId('ACT-', ACTIVITIES),
    projectId: booking.projectId,
    message: `Flight Booking ${booking.id}${booking.pnr ? ` (PNR ${booking.pnr})` : ''} status diubah dari "${fromLabel}" menjadi "${newStatus}" oleh ${actor?.name ?? actorId}.${reason ? ` Alasan: ${reason}` : ''}`,
    isChange: false,
    reviewed: true,
    createdAt: DEMO_REFERENCE_DATE
  })
  return booking
}

/** Toggle single-select opsi (bandingkan lalu pilih satu) — guard `refunded` sama seperti `updateFlightBooking`. */
export function selectFlightOption (bookingId: string, optionIndex: number): FlightBooking | undefined {
  const booking = getFlightBookingById(bookingId)
  if (!booking || booking.status === 'refunded' || !booking.options[optionIndex]) { return undefined }
  booking.options.forEach((option, index) => { option.isSelected = index === optionIndex })
  booking.updatedAt = DEMO_REFERENCE_DATE
  return booking
}

/**
 * Accommodation (Section 14 — roadmap Section 00–24 baru). Lihat `HotelBooking` (`app/types/accommodation.ts`)
 * untuk rasional model — pola arsitektur IDENTIK D-070 (Section 13/Ticketing). Selector/mutator di bawah
 * melanjutkan pola `reactive()` Section 07 dst.
 */

export const getHotelBookingById = (id: string) => HOTEL_BOOKINGS.find(booking => booking.id === id)
export const getHotelBookingsByProject = (projectId: string) => HOTEL_BOOKINGS
  .filter(booking => booking.projectId === projectId)
  .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
export const getHotelBookingsByService = (serviceId: string) => HOTEL_BOOKINGS.filter(booking => booking.serviceId === serviceId)

/** "Internal cost isolation" (Wajib) — derivasi murni, `undefined` bila salah satu harga belum terisi (status `requested`/`quoted`). */
export function getHotelBookingMarginIdr (booking: HotelBooking): number | undefined {
  if (booking.netCostIdr === undefined || booking.sellPriceIdr === undefined) { return undefined }
  return booking.sellPriceIdr - booking.netCostIdr
}

export interface CreateHotelBookingInput {
  projectId: string
  serviceId?: string
  groupId?: string
  travelerIds?: string[]
  checkInDate?: string
  checkOutDate?: string
  roomsBlocked?: number
}

export function createHotelBooking (input: CreateHotelBookingInput): HotelBooking {
  const booking: HotelBooking = {
    id: nextSequentialId('HTL-', HOTEL_BOOKINGS),
    status: 'requested',
    options: [],
    travelerIds: input.travelerIds ?? [],
    createdAt: DEMO_REFERENCE_DATE,
    ...input
  }
  HOTEL_BOOKINGS.push(booking)
  return booking
}

/** Guard: `completed`/`cancelled`/`no-show` bersifat terminal — field lain tidak boleh diedit lagi setelahnya, pola sama `FlightBooking.status === 'refunded'` (D-070). */
export type HotelBookingInput = Partial<Omit<HotelBooking, 'id' | 'projectId' | 'createdAt'>>
const HOTEL_BOOKING_TERMINAL_STATUSES: HotelBookingStatus[] = ['completed', 'cancelled', 'no-show']

export function updateHotelBooking (id: string, patch: HotelBookingInput): HotelBooking | undefined {
  const booking = getHotelBookingById(id)
  if (!booking || HOTEL_BOOKING_TERMINAL_STATUSES.includes(booking.status)) { return undefined }
  Object.assign(booking, patch)
  booking.updatedAt = DEMO_REFERENCE_DATE
  return booking
}

/** "Quote, booking, confirmation, voucher" + "Amendment, cancellation, no-show" (Wajib) — peta transisi eksplisit, pola sama `FLIGHT_BOOKING_TRANSITIONS` (D-070). */
const HOTEL_BOOKING_TRANSITIONS: Record<HotelBookingStatus, HotelBookingStatus[]> = {
  requested: ['quoted', 'cancelled'],
  quoted: ['confirmed', 'cancelled'],
  confirmed: ['amended', 'completed', 'cancelled', 'no-show'],
  amended: ['completed', 'cancelled', 'no-show'],
  completed: [],
  cancelled: [],
  'no-show': []
}

export function getHotelBookingStatusTransitions (current: HotelBookingStatus): HotelBookingStatus[] {
  return HOTEL_BOOKING_TRANSITIONS[current] ?? []
}

/** Reason wajib untuk `cancelled`/`no-show` (dampak besar — pola sama `updateFlightBookingStatus`, D-070), dicatat sebagai `ActivityEntry` pada project terkait untuk jejak historis. */
export function updateHotelBookingStatus (bookingId: string, newStatus: HotelBookingStatus, actorId: string, reason?: string): HotelBooking | undefined {
  const booking = getHotelBookingById(bookingId)
  if (!booking) { return undefined }
  if (!getHotelBookingStatusTransitions(booking.status).includes(newStatus)) { return undefined }
  const requiresReason = newStatus === 'cancelled' || newStatus === 'no-show'
  if (requiresReason && !reason?.trim()) { return undefined }

  const fromLabel = booking.status
  booking.status = newStatus
  booking.updatedAt = DEMO_REFERENCE_DATE
  if (reason) { booking.statusReason = reason.trim() }
  syncBookingPaymentGateOnStatusChange('hotel', booking.id, booking.projectId, newStatus)

  const actor = getUserById(actorId)
  ACTIVITIES.push({
    id: nextSequentialId('ACT-', ACTIVITIES),
    projectId: booking.projectId,
    message: `Hotel Booking ${booking.id}${booking.confirmationNumber ? ` (konfirmasi ${booking.confirmationNumber})` : ''} status diubah dari "${fromLabel}" menjadi "${newStatus}" oleh ${actor?.name ?? actorId}.${reason ? ` Alasan: ${reason}` : ''}`,
    isChange: false,
    reviewed: true,
    createdAt: DEMO_REFERENCE_DATE
  })
  return booking
}

/** Toggle single-select opsi (bandingkan lalu pilih satu) — guard terminal sama seperti `updateHotelBooking`. */
export function selectHotelOption (bookingId: string, optionIndex: number): HotelBooking | undefined {
  const booking = getHotelBookingById(bookingId)
  if (!booking || HOTEL_BOOKING_TERMINAL_STATUSES.includes(booking.status) || !booking.options[optionIndex]) { return undefined }
  booking.options.forEach((option, index) => { option.isSelected = index === optionIndex })
  booking.updatedAt = DEMO_REFERENCE_DATE
  return booking
}

/**
 * Transportation (Section 15 — roadmap Section 00–24 baru). Lihat `TransportBooking` (`app/types/transportation.ts`)
 * untuk rasional model — pola arsitektur IDENTIK D-070/D-071 (Section 13/Ticketing, Section 14/Accommodation).
 * Selector/mutator di bawah melanjutkan pola `reactive()` Section 07 dst.
 */

export const getTransportBookingById = (id: string) => TRANSPORT_BOOKINGS.find(booking => booking.id === id)
export const getTransportBookingsByProject = (projectId: string) => TRANSPORT_BOOKINGS
  .filter(booking => booking.projectId === projectId)
  .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
export const getTransportBookingsByService = (serviceId: string) => TRANSPORT_BOOKINGS.filter(booking => booking.serviceId === serviceId)

/** Internal cost isolation (hard rule protokol) — derivasi murni, `undefined` bila salah satu harga belum terisi (status `requested`/`quoted`). */
export function getTransportBookingMarginIdr (booking: TransportBooking): number | undefined {
  if (booking.netCostIdr === undefined || booking.sellPriceIdr === undefined) { return undefined }
  return booking.sellPriceIdr - booking.netCostIdr
}

export interface CreateTransportBookingInput {
  projectId: string
  serviceId?: string
  groupId?: string
  transferType?: TransportBooking['transferType']
  legs?: TransportLeg[]
  travelerIds?: string[]
}

export function createTransportBooking (input: CreateTransportBookingInput): TransportBooking {
  const booking: TransportBooking = {
    id: nextSequentialId('TRN-', TRANSPORT_BOOKINGS),
    status: 'requested',
    options: [],
    legs: input.legs ?? [],
    travelerIds: input.travelerIds ?? [],
    createdAt: DEMO_REFERENCE_DATE,
    ...input
  }
  TRANSPORT_BOOKINGS.push(booking)
  return booking
}

/** Guard: `completed`/`cancelled`/`no-show` bersifat terminal — field lain tidak boleh diedit lagi setelahnya, pola sama `HotelBooking`/`FlightBooking` (D-070/D-071). */
export type TransportBookingInput = Partial<Omit<TransportBooking, 'id' | 'projectId' | 'createdAt'>>
const TRANSPORT_BOOKING_TERMINAL_STATUSES: TransportBookingStatus[] = ['completed', 'cancelled', 'no-show']

export function updateTransportBooking (id: string, patch: TransportBookingInput): TransportBooking | undefined {
  const booking = getTransportBookingById(id)
  if (!booking || TRANSPORT_BOOKING_TERMINAL_STATUSES.includes(booking.status)) { return undefined }
  Object.assign(booking, patch)
  booking.updatedAt = DEMO_REFERENCE_DATE
  return booking
}

/** "Quote, assignment, confirmation, service order, driver sheet" (Wajib) — peta transisi eksplisit mengikuti urutan tahap literal, pola sama `HOTEL_BOOKING_TRANSITIONS` (D-071). */
const TRANSPORT_BOOKING_TRANSITIONS: Record<TransportBookingStatus, TransportBookingStatus[]> = {
  requested: ['quoted', 'cancelled'],
  quoted: ['assigned', 'cancelled'],
  assigned: ['confirmed', 'cancelled'],
  confirmed: ['completed', 'cancelled', 'no-show'],
  completed: [],
  cancelled: [],
  'no-show': []
}

export function getTransportBookingStatusTransitions (current: TransportBookingStatus): TransportBookingStatus[] {
  return TRANSPORT_BOOKING_TRANSITIONS[current] ?? []
}

/** Reason wajib untuk `cancelled`/`no-show` (dampak besar — pola sama `updateHotelBookingStatus`, D-071), dicatat sebagai `ActivityEntry` pada project terkait untuk jejak historis. */
export function updateTransportBookingStatus (bookingId: string, newStatus: TransportBookingStatus, actorId: string, reason?: string): TransportBooking | undefined {
  const booking = getTransportBookingById(bookingId)
  if (!booking) { return undefined }
  if (!getTransportBookingStatusTransitions(booking.status).includes(newStatus)) { return undefined }
  const requiresReason = newStatus === 'cancelled' || newStatus === 'no-show'
  if (requiresReason && !reason?.trim()) { return undefined }

  const fromLabel = booking.status
  booking.status = newStatus
  booking.updatedAt = DEMO_REFERENCE_DATE
  if (reason) { booking.statusReason = reason.trim() }
  syncBookingPaymentGateOnStatusChange('transport', booking.id, booking.projectId, newStatus)

  const actor = getUserById(actorId)
  ACTIVITIES.push({
    id: nextSequentialId('ACT-', ACTIVITIES),
    projectId: booking.projectId,
    message: `Transport Booking ${booking.id}${booking.assignedVehiclePlateNumber ? ` (unit ${booking.assignedVehiclePlateNumber})` : ''} status diubah dari "${fromLabel}" menjadi "${newStatus}" oleh ${actor?.name ?? actorId}.${reason ? ` Alasan: ${reason}` : ''}`,
    isChange: false,
    reviewed: true,
    createdAt: DEMO_REFERENCE_DATE
  })
  return booking
}

/** Toggle single-select opsi (bandingkan lalu pilih satu) — guard terminal sama seperti `updateTransportBooking`. */
export function selectTransportOption (bookingId: string, optionIndex: number): TransportBooking | undefined {
  const booking = getTransportBookingById(bookingId)
  if (!booking || TRANSPORT_BOOKING_TERMINAL_STATUSES.includes(booking.status) || !booking.options[optionIndex]) { return undefined }
  booking.options.forEach((option, index) => { option.isSelected = index === optionIndex })
  booking.updatedAt = DEMO_REFERENCE_DATE
  return booking
}

/**
 * MICE dan Event (Section 16 — roadmap Section 00–24 baru). Lihat `MiceEvent` (`app/types/mice.ts`) untuk
 * rasional model — pola arsitektur IDENTIK D-070/D-071/D-072 (Section 13/Ticketing, 14/Accommodation,
 * 15/Transportation). Selector/mutator di bawah melanjutkan pola `reactive()` Section 07 dst.
 */

export const getMiceEventById = (id: string) => MICE_EVENTS.find(event => event.id === id)
export const getMiceEventsByProject = (projectId: string) => MICE_EVENTS
  .filter(event => event.projectId === projectId)
  .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
export const getMiceEventsByService = (serviceId: string) => MICE_EVENTS.filter(event => event.serviceId === serviceId)

/** Internal cost isolation (hard rule protokol) — derivasi murni di atas `boqItems`, bukan field tersimpan yang bisa stale (pola sama `getCostSheetBreakdown`). */
export function getMiceBoqTotals (event: MiceEvent): { netCostIdr?: number, sellPriceIdr?: number, marginIdr?: number } {
  const withNetCost = event.boqItems.filter(item => item.netCostIdr !== undefined)
  const withSellPrice = event.boqItems.filter(item => item.sellPriceIdr !== undefined)
  const netCostIdr = withNetCost.length ? withNetCost.reduce((sum, item) => sum + (item.netCostIdr ?? 0), 0) : undefined
  const sellPriceIdr = withSellPrice.length ? withSellPrice.reduce((sum, item) => sum + (item.sellPriceIdr ?? 0), 0) : undefined
  const marginIdr = netCostIdr !== undefined && sellPriceIdr !== undefined ? sellPriceIdr - netCostIdr : undefined
  return { netCostIdr, sellPriceIdr, marginIdr }
}

/** "Capacity and schedule conflicts" (Wajib) — derivasi murni (ADVISORY, tidak memblokir transisi status manapun, pola sama Departure Readiness Gate D-069): deteksi sesi tumpang tindih di room yang sama, dan kapasitas sesi vs total peserta yang diharapkan. */
export function getMiceScheduleConflicts (event: MiceEvent): string[] {
  const conflicts: string[] = []
  const totalExpected = event.participantCategories.reduce((sum, category) => sum + category.expectedCount, 0)

  event.sessions.forEach((session, index) => {
    if (totalExpected > session.capacity) {
      conflicts.push(`"${session.sessionTitle}" — kapasitas ruangan (${session.capacity} pax) lebih kecil dari total peserta yang diharapkan (${totalExpected} pax).`)
    }
    for (let other = index + 1; other < event.sessions.length; other++) {
      const b = event.sessions[other]
      if (session.roomName !== b.roomName) { continue }
      const overlap = session.startAt < b.endAt && b.startAt < session.endAt
      if (overlap) { conflicts.push(`"${session.sessionTitle}" dan "${b.sessionTitle}" terjadwal tumpang tindih di room yang sama (${session.roomName}).`) }
    }
  })
  return conflicts
}

export interface CreateMiceEventInput {
  projectId: string
  serviceId?: string
  brief?: string
  venueName?: string
  venueAddress?: string
}

export function createMiceEvent (input: CreateMiceEventInput): MiceEvent {
  const event: MiceEvent = {
    id: nextSequentialId('MICE-', MICE_EVENTS),
    status: 'planning',
    clientApprovalStatus: 'draft',
    sessions: [],
    participantCategories: [],
    boqItems: [],
    staffAssignments: [],
    checklist: [],
    deliverables: [],
    createdAt: DEMO_REFERENCE_DATE,
    ...input
  }
  MICE_EVENTS.push(event)
  return event
}

/** Guard: `completed`/`cancelled` bersifat terminal — field lain tidak boleh diedit lagi setelahnya, pola sama section 13-15 (D-070/D-071/D-072). */
export type MiceEventInput = Partial<Omit<MiceEvent, 'id' | 'projectId' | 'createdAt'>>
const MICE_EVENT_TERMINAL_STATUSES: MiceEventStatus[] = ['completed', 'cancelled']

export function updateMiceEvent (id: string, patch: MiceEventInput): MiceEvent | undefined {
  const event = getMiceEventById(id)
  if (!event || MICE_EVENT_TERMINAL_STATUSES.includes(event.status)) { return undefined }
  Object.assign(event, patch)
  event.updatedAt = DEMO_REFERENCE_DATE
  return event
}

/** Acceptance "MICE role dapat mengelola event dari planning sampai post-event completion" — peta transisi eksplisit, pola sama section 13-15. */
const MICE_EVENT_TRANSITIONS: Record<MiceEventStatus, MiceEventStatus[]> = {
  planning: ['confirmed', 'cancelled'],
  confirmed: ['in-progress', 'cancelled'],
  'in-progress': ['completed', 'cancelled'],
  completed: [],
  cancelled: []
}

export function getMiceEventStatusTransitions (current: MiceEventStatus): MiceEventStatus[] {
  return MICE_EVENT_TRANSITIONS[current] ?? []
}

/** Reason wajib untuk `cancelled` (dampak besar — pola sama section lain), dicatat sebagai `ActivityEntry` pada project terkait untuk jejak historis. */
export function updateMiceEventStatus (eventId: string, newStatus: MiceEventStatus, actorId: string, reason?: string): MiceEvent | undefined {
  const event = getMiceEventById(eventId)
  if (!event) { return undefined }
  if (!getMiceEventStatusTransitions(event.status).includes(newStatus)) { return undefined }
  const requiresReason = newStatus === 'cancelled'
  if (requiresReason && !reason?.trim()) { return undefined }

  const fromLabel = event.status
  event.status = newStatus
  event.updatedAt = DEMO_REFERENCE_DATE
  if (reason) { event.statusReason = reason.trim() }
  syncBookingPaymentGateOnStatusChange('mice', event.id, event.projectId, newStatus)

  const actor = getUserById(actorId)
  ACTIVITIES.push({
    id: nextSequentialId('ACT-', ACTIVITIES),
    projectId: event.projectId,
    message: `MICE Event ${event.id} status diubah dari "${fromLabel}" menjadi "${newStatus}" oleh ${actor?.name ?? actorId}.${reason ? ` Alasan: ${reason}` : ''}`,
    isChange: false,
    reviewed: true,
    createdAt: DEMO_REFERENCE_DATE
  })
  return event
}

/** "Client approval states" (Wajib) — peta transisi terpisah dari `MiceEventStatus` (pola sama `QuotationApprovalStatus`, D-049); `rejected` dapat direvisi-dan-diajukan-ulang (`submitted`), `approved` bersifat stabil (perubahan lanjutan lewat "Change order", bukan re-approval). */
const MICE_APPROVAL_TRANSITIONS: Record<MiceApprovalStatus, MiceApprovalStatus[]> = {
  draft: ['submitted'],
  submitted: ['approved', 'rejected'],
  approved: [],
  rejected: ['submitted']
}

export function getMiceApprovalTransitions (current: MiceApprovalStatus): MiceApprovalStatus[] {
  return MICE_APPROVAL_TRANSITIONS[current] ?? []
}

/** Catatan wajib untuk `rejected` (alasan penolakan client). */
export function updateMiceClientApproval (eventId: string, newStatus: MiceApprovalStatus, actorId: string, note?: string): MiceEvent | undefined {
  const event = getMiceEventById(eventId)
  if (!event) { return undefined }
  if (!getMiceApprovalTransitions(event.clientApprovalStatus).includes(newStatus)) { return undefined }
  if (newStatus === 'rejected' && !note?.trim()) { return undefined }

  event.clientApprovalStatus = newStatus
  event.updatedAt = DEMO_REFERENCE_DATE

  const actor = getUserById(actorId)
  ACTIVITIES.push({
    id: nextSequentialId('ACT-', ACTIVITIES),
    projectId: event.projectId,
    message: `MICE Event ${event.id} — Client Approval diubah menjadi "${newStatus}" oleh ${actor?.name ?? actorId}.${note ? ` Catatan: ${note}` : ''}`,
    isChange: false,
    reviewed: true,
    createdAt: DEMO_REFERENCE_DATE
  })
  return event
}

/** Toggle langsung item checklist (setup/teardown/rehearsal/permit) tanpa perlu dialog Edit — guard terminal sama seperti `updateMiceEvent`. */
export function toggleMiceChecklistItem (eventId: string, index: number): MiceEvent | undefined {
  const event = getMiceEventById(eventId)
  if (!event || MICE_EVENT_TERMINAL_STATUSES.includes(event.status) || !event.checklist[index]) { return undefined }
  event.checklist[index].isDone = !event.checklist[index].isDone
  event.updatedAt = DEMO_REFERENCE_DATE
  return event
}

/** Toggle langsung status deliverable (Wajib) tanpa perlu dialog Edit — guard terminal sama seperti `updateMiceEvent`. */
export function toggleMiceDeliverable (eventId: string, index: number): MiceEvent | undefined {
  const event = getMiceEventById(eventId)
  if (!event || MICE_EVENT_TERMINAL_STATUSES.includes(event.status) || !event.deliverables[index]) { return undefined }
  event.deliverables[index].isDelivered = !event.deliverables[index].isDelivered
  event.updatedAt = DEMO_REFERENCE_DATE
  return event
}

/**
 * Booking dan Service Orders (Section 18 — roadmap Section 00–24 baru). Consolidation/orchestration LAYER di
 * atas Flight/Hotel/Transport/MICE booking (Section 13-16) — lihat `BookingOrchestrationRecord`/
 * `BookingTimelineEntry` (`app/types/booking-orchestration.ts`) untuk rasional model lengkap. Fully additive:
 * TIDAK ADA field ditambahkan ke `FlightBooking`/`HotelBooking`/`TransportBooking`/`MiceEvent`, dan
 * `createFlightBooking`/`createHotelBooking`/`createTransportBooking`/`createMiceEvent` (Section 13-16,
 * LOCKED) TIDAK disentuh sama sekali — record orchestration dibuat lazily lewat
 * `getOrCreateBookingOrchestrationRecord` di bawah, dipanggil dari `getBookingTimeline` (baca) dan dari titik
 * transisi status/duplicate-flag (tulis) sehingga booking baru yang dibuat lewat UI otomatis tercakup tanpa
 * perlu mengubah 4 fungsi create tsb.
 */

export const getBookingOrchestrationRecord = (bookingType: BookingDomain, bookingId: string) =>
  BOOKING_ORCHESTRATION_RECORDS.find(record => record.bookingType === bookingType && record.bookingId === bookingId)

function getOrCreateBookingOrchestrationRecord (bookingType: BookingDomain, bookingId: string, projectId: string): BookingOrchestrationRecord {
  const existing = getBookingOrchestrationRecord(bookingType, bookingId)
  if (existing) { return existing }
  const record: BookingOrchestrationRecord = {
    id: nextSequentialId('BKO-', BOOKING_ORCHESTRATION_RECORDS),
    bookingType,
    bookingId,
    projectId,
    paymentGateStatus: 'not-required',
    attemptLog: []
  }
  BOOKING_ORCHESTRATION_RECORDS.push(record)
  return record
}

function getBookingStatusValue (bookingType: BookingDomain, bookingId: string): string | undefined {
  if (bookingType === 'flight') { return getFlightBookingById(bookingId)?.status }
  if (bookingType === 'hotel') { return getHotelBookingById(bookingId)?.status }
  if (bookingType === 'transport') { return getTransportBookingById(bookingId)?.status }
  return getMiceEventById(bookingId)?.status
}

/** Status yang dianggap "confirmed-equivalent" per domain — dipakai untuk (a) menilai dependency terpenuhi, (b) memicu payment gate `pending` (poin "Confirmation and payment gates", Wajib). */
const BOOKING_CONFIRMED_STATUSES: Record<BookingDomain, string[]> = {
  flight: ['confirmed', 'issued', 'reissued'],
  hotel: ['confirmed', 'amended', 'completed'],
  transport: ['assigned', 'confirmed', 'completed'],
  mice: ['confirmed', 'in-progress', 'completed']
}
const BOOKING_COMPLETED_STATUSES: Record<BookingDomain, string[]> = {
  flight: ['issued', 'reissued'],
  hotel: ['completed'],
  transport: ['completed'],
  mice: ['completed']
}
const BOOKING_CANCELLED_STATUSES: Record<BookingDomain, string[]> = {
  flight: ['cancelled', 'refunded'],
  hotel: ['cancelled', 'no-show'],
  transport: ['cancelled', 'no-show'],
  mice: ['cancelled']
}

type BookingStatusBucket = 'processing' | 'confirmed' | 'completed' | 'cancelled'

function bookingStatusBucket (bookingType: BookingDomain, status: string): BookingStatusBucket {
  if (BOOKING_CANCELLED_STATUSES[bookingType].includes(status)) { return 'cancelled' }
  if (BOOKING_COMPLETED_STATUSES[bookingType].includes(status)) { return 'completed' }
  if (BOOKING_CONFIRMED_STATUSES[bookingType].includes(status)) { return 'confirmed' }
  return 'processing'
}

/**
 * "Internal/supplier/client-visible status mapping" (Wajib) — bucket 4-kategori yang disederhanakan dari
 * vocabulary status existing masing-masing domain (BUKAN enum baru), dipakai untuk label supplier/client;
 * `internalStatus` tetap memakai label penuh vocabulary asli (lihat `buildBookingTimelineEntry`).
 */
const BOOKING_CLIENT_STATUS_LABEL: Record<BookingStatusBucket, string> = {
  processing: 'Diproses', confirmed: 'Dikonfirmasi', completed: 'Selesai', cancelled: 'Dibatalkan'
}
const BOOKING_SUPPLIER_STATUS_LABEL: Record<BookingStatusBucket, string> = {
  processing: 'Menunggu Aksi', confirmed: 'Dalam Pengerjaan', completed: 'Terpenuhi', cancelled: 'Dibatalkan'
}

const BOOKING_DOMAIN_LABEL: Record<BookingDomain, string> = { flight: 'Flight', hotel: 'Hotel', transport: 'Transport', mice: 'MICE' }

interface BookingDescriptor {
  label: string
  reference?: string
  travelerCount: number
  startDate?: string
  deadlineDate?: string
  detailHref: string
  voucherHref?: string
  netCostIdr?: number
  sellPriceIdr?: number
  status: string
  statusLabel: string
  statusTone: string
  domainExceptions: string[]
}

function describeFlightBookingForTimeline (booking: FlightBooking): BookingDescriptor {
  const selected = booking.options.find(option => option.isSelected) ?? booking.options[0]
  const firstSegment = booking.segments[0]
  const statusOption = findStatusOption(FLIGHT_BOOKING_STATUSES, booking.status)
  return {
    label: selected ? selected.airline : (firstSegment ? `${firstSegment.origin} → ${firstSegment.destination}` : booking.id),
    reference: booking.pnr,
    travelerCount: booking.travelerIds.length,
    startDate: firstSegment?.departureAt,
    deadlineDate: booking.ticketingDeadline,
    detailHref: `/ticketing/${booking.id}`,
    voucherHref: `/ticketing/${booking.id}/eticket-preview`,
    netCostIdr: booking.netCostIdr,
    sellPriceIdr: booking.sellPriceIdr,
    status: booking.status,
    statusLabel: statusOption.label,
    statusTone: statusOption.tone,
    domainExceptions: booking.hasScheduleChange ? [`Perubahan jadwal: ${booking.scheduleChangeNote ?? 'catatan belum diisi'}`] : []
  }
}

function describeHotelBookingForTimeline (booking: HotelBooking): BookingDescriptor {
  const selected = booking.options.find(option => option.isSelected) ?? booking.options[0]
  const statusOption = findStatusOption(HOTEL_BOOKING_STATUSES, booking.status)
  return {
    label: selected ? `${selected.propertyName} — ${selected.roomType}` : booking.id,
    reference: booking.confirmationNumber,
    travelerCount: booking.travelerIds.length,
    startDate: booking.checkInDate,
    deadlineDate: booking.cancellationDeadline,
    detailHref: `/accommodation/${booking.id}`,
    voucherHref: `/accommodation/${booking.id}/voucher-preview`,
    netCostIdr: booking.netCostIdr,
    sellPriceIdr: booking.sellPriceIdr,
    status: booking.status,
    statusLabel: statusOption.label,
    statusTone: statusOption.tone,
    domainExceptions: booking.status === 'amended' ? [`Amandemen booking: ${booking.amendmentNote ?? 'catatan belum diisi'}`] : []
  }
}

function describeTransportBookingForTimeline (booking: TransportBooking): BookingDescriptor {
  const selected = booking.options.find(option => option.isSelected) ?? booking.options[0]
  const firstLeg = booking.legs[0]
  const statusOption = findStatusOption(TRANSPORT_BOOKING_STATUSES, booking.status)
  const exceptions: string[] = []
  if (booking.hasChange) { exceptions.push(`Perubahan rencana: ${booking.changeNote ?? 'catatan belum diisi'}`) }
  if (booking.hasIncident) { exceptions.push(`Insiden operasional: ${booking.incidentNote ?? 'catatan belum diisi'}`) }
  return {
    label: selected ? `${findStatusOption(VEHICLE_TYPES, selected.vehicleType).label}${booking.assignedVehiclePlateNumber ? ` — ${booking.assignedVehiclePlateNumber}` : ''}` : (firstLeg?.label ?? booking.id),
    reference: booking.assignedVehiclePlateNumber,
    travelerCount: booking.travelerIds.length,
    startDate: firstLeg?.scheduledAt,
    deadlineDate: undefined,
    detailHref: `/transportation/${booking.id}`,
    voucherHref: `/transportation/${booking.id}/service-order-preview`,
    netCostIdr: booking.netCostIdr,
    sellPriceIdr: booking.sellPriceIdr,
    status: booking.status,
    statusLabel: statusOption.label,
    statusTone: statusOption.tone,
    domainExceptions: exceptions
  }
}

function describeMiceEventForTimeline (event: MiceEvent): BookingDescriptor {
  const totalExpected = event.participantCategories.reduce((sum, category) => sum + category.expectedCount, 0)
  const firstSession = event.sessions[0]
  const statusOption = findStatusOption(MICE_EVENT_STATUSES, event.status)
  const exceptions: string[] = []
  if (event.hasChangeOrder) { exceptions.push(`Change order: ${event.changeOrderNote ?? 'catatan belum diisi'}`) }
  if (event.hasIncident) { exceptions.push(`Insiden operasional: ${event.incidentNote ?? 'catatan belum diisi'}`) }
  exceptions.push(...getMiceScheduleConflicts(event))
  const service = event.serviceId ? PROJECT_SERVICES.find(item => item.id === event.serviceId) : undefined
  return {
    label: event.venueName ?? event.id,
    reference: service?.bookingReference,
    travelerCount: totalExpected,
    startDate: firstSession?.startAt,
    deadlineDate: undefined,
    detailHref: `/mice/${event.id}`,
    voucherHref: `/mice/${event.id}/rundown-preview`,
    netCostIdr: getMiceBoqTotals(event).netCostIdr,
    sellPriceIdr: getMiceBoqTotals(event).sellPriceIdr,
    status: event.status,
    statusLabel: statusOption.label,
    statusTone: statusOption.tone,
    domainExceptions: exceptions
  }
}

function describeDependencyLabel (dep: { bookingType: BookingDomain, bookingId: string }): string {
  return `${BOOKING_DOMAIN_LABEL[dep.bookingType]} ${dep.bookingId}`
}

function buildBookingTimelineEntry (bookingType: BookingDomain, bookingId: string, projectId: string, descriptor: BookingDescriptor): BookingTimelineEntry {
  const record = getOrCreateBookingOrchestrationRecord(bookingType, bookingId, projectId)
  const project = getProjectById(projectId)
  const bucket = bookingStatusBucket(bookingType, descriptor.status)

  const dependencies: BookingTimelineDependencyView[] = (record.dependsOn ?? []).map((dep) => {
    const depStatus = getBookingStatusValue(dep.bookingType, dep.bookingId)
    const depBucket = depStatus ? bookingStatusBucket(dep.bookingType, depStatus) : undefined
    return {
      bookingType: dep.bookingType,
      bookingId: dep.bookingId,
      label: describeDependencyLabel(dep),
      isSatisfied: depBucket === 'confirmed' || depBucket === 'completed'
    }
  })

  const exceptions: string[] = [...descriptor.domainExceptions]
  for (const dep of dependencies) {
    if (!dep.isSatisfied) { exceptions.push(`Dependency belum terpenuhi: ${dep.label} (menunggu konfirmasi).`) }
  }
  const lastAttempt = record.attemptLog[record.attemptLog.length - 1]
  if (lastAttempt?.outcome === 'failed') { exceptions.push(`Percobaan booking terakhir gagal (${formatDateTime(lastAttempt.at)}) — menunggu retry/manual fallback.`) }
  if (record.flaggedDuplicate) { exceptions.push('Ditandai sebagai duplicate booking yang disengaja (dibuat dengan konfirmasi eksplisit).') }

  return {
    orchestrationId: record.id,
    bookingType,
    bookingId,
    projectId,
    projectName: project?.name ?? projectId,
    label: descriptor.label,
    reference: descriptor.reference,
    travelerCount: descriptor.travelerCount,
    startDate: descriptor.startDate,
    deadlineDate: descriptor.deadlineDate,
    internalStatus: descriptor.statusLabel,
    internalStatusTone: descriptor.statusTone,
    supplierVisibleStatus: BOOKING_SUPPLIER_STATUS_LABEL[bucket],
    clientVisibleStatus: BOOKING_CLIENT_STATUS_LABEL[bucket],
    detailHref: descriptor.detailHref,
    voucherHref: descriptor.voucherHref,
    netCostIdr: descriptor.netCostIdr,
    sellPriceIdr: descriptor.sellPriceIdr,
    dependencies,
    paymentGateStatus: record.paymentGateStatus,
    attemptLog: record.attemptLog,
    exceptions
  }
}

/** "Semua Flight/Hotel/Transport/MICE service requirement dalam satu timeline" (Wajib) — DERIVASI murni, pola sama `getServiceReadinessMatrix`/`getProjectAttentionQueue` (Section 12 baru). Tanpa `projectId` = seluruh project (dipakai `/bookings`); dengan `projectId` = terskop satu project (dipakai tab Itinerary & Services). */
export function getBookingTimeline (projectId?: string): BookingTimelineEntry[] {
  const flights = projectId ? getFlightBookingsByProject(projectId) : FLIGHT_BOOKINGS
  const hotels = projectId ? getHotelBookingsByProject(projectId) : HOTEL_BOOKINGS
  const transports = projectId ? getTransportBookingsByProject(projectId) : TRANSPORT_BOOKINGS
  const miceEvents = projectId ? getMiceEventsByProject(projectId) : MICE_EVENTS

  const entries: BookingTimelineEntry[] = [
    ...flights.map(booking => buildBookingTimelineEntry('flight', booking.id, booking.projectId, describeFlightBookingForTimeline(booking))),
    ...hotels.map(booking => buildBookingTimelineEntry('hotel', booking.id, booking.projectId, describeHotelBookingForTimeline(booking))),
    ...transports.map(booking => buildBookingTimelineEntry('transport', booking.id, booking.projectId, describeTransportBookingForTimeline(booking))),
    ...miceEvents.map(event => buildBookingTimelineEntry('mice', event.id, event.projectId, describeMiceEventForTimeline(event)))
  ]
  return entries.sort((a, b) => (b.startDate ?? '').localeCompare(a.startDate ?? ''))
}

/** "Exception list" (Wajib) — seluruh entri timeline (lintas project) dengan minimal satu exception, dipakai `/bookings/exceptions`. */
export function getBookingExceptionQueue (): BookingTimelineEntry[] {
  return getBookingTimeline().filter(entry => entry.exceptions.length > 0)
}

/** "Confirmation and payment gates" (Wajib) — aksi Operations/Finance-facing "Mark Payment Cleared" di `/bookings`. Mock murni (D-006) — TIDAK ADA payment gateway/processing nyata, TIDAK menyentuh `app/data/finance.ts`/`Invoice`/`Payment` (Section 20 baru PARTIAL, di luar scope section ini). */
export function setBookingPaymentGateStatus (orchestrationId: string, status: BookingPaymentGateStatus, actorId: string): BookingOrchestrationRecord | undefined {
  const record = BOOKING_ORCHESTRATION_RECORDS.find(item => item.id === orchestrationId)
  if (!record || record.paymentGateStatus === status) { return record }
  const previous = record.paymentGateStatus
  record.paymentGateStatus = status
  const actor = getUserById(actorId)
  ACTIVITIES.push({
    id: nextSequentialId('ACT-', ACTIVITIES),
    projectId: record.projectId,
    message: `Payment gate ${BOOKING_DOMAIN_LABEL[record.bookingType]} Booking ${record.bookingId} diubah dari "${previous}" menjadi "${status}" oleh ${actor?.name ?? actorId}.`,
    isChange: false,
    reviewed: true,
    createdAt: DEMO_REFERENCE_DATE
  })
  return record
}

/** Dipanggil dari `updateFlightBookingStatus`/`updateHotelBookingStatus`/`updateTransportBookingStatus`/`updateMiceEventStatus` — begitu booking mencapai status confirmed-equivalent, gate bergerak `not-required` → `pending` (tidak menimpa `pending`/`cleared` yang sudah ada). */
function syncBookingPaymentGateOnStatusChange (bookingType: BookingDomain, bookingId: string, projectId: string, newStatus: string) {
  if (!BOOKING_CONFIRMED_STATUSES[bookingType].includes(newStatus)) { return }
  const record = getOrCreateBookingOrchestrationRecord(bookingType, bookingId, projectId)
  if (record.paymentGateStatus === 'not-required') { record.paymentGateStatus = 'pending' }
}

/** "Failure/retry/manual fallback simulation" (Wajib) — dipanggil dari `/bookings` untuk menambah entri percobaan (mock, D-006) pada booking manapun. */
export function appendBookingAttempt (orchestrationId: string, outcome: BookingAttemptOutcome, note: string | undefined, actorId: string): BookingOrchestrationRecord | undefined {
  const record = BOOKING_ORCHESTRATION_RECORDS.find(item => item.id === orchestrationId)
  if (!record) { return undefined }
  const attempt: BookingAttempt = { id: `${record.id}-ATT-${record.attemptLog.length + 1}`, at: DEMO_REFERENCE_DATE, outcome, note: note?.trim() || undefined }
  record.attemptLog.push(attempt)
  const actor = getUserById(actorId)
  ACTIVITIES.push({
    id: nextSequentialId('ACT-', ACTIVITIES),
    projectId: record.projectId,
    message: `Percobaan booking ${BOOKING_DOMAIN_LABEL[record.bookingType]} ${record.bookingId} dicatat: "${outcome}" oleh ${actor?.name ?? actorId}.${note ? ` Catatan: ${note}` : ''}`,
    isChange: false,
    reviewed: true,
    createdAt: DEMO_REFERENCE_DATE
  })
  return record
}

/** "Duplicate booking prevention" (Wajib, hanya Flight/Hotel/Transport — MICE satu event per project, tidak relevan) — status non-terminal per domain dianggap "active"; dipanggil dari dialog create booking `/ticketing`, `/accommodation`, `/transportation` SEBELUM memanggil `createFlightBooking`/`createHotelBooking`/`createTransportBooking`. */
const BOOKING_ACTIVE_CHECK_TERMINAL: Record<'flight' | 'hotel' | 'transport', string[]> = {
  flight: ['cancelled', 'refunded'],
  hotel: ['cancelled', 'no-show'],
  transport: ['cancelled', 'no-show']
}

export function findActiveBookingConflicts (bookingType: 'flight' | 'hotel' | 'transport', projectId: string, serviceId: string): string[] {
  const terminal = BOOKING_ACTIVE_CHECK_TERMINAL[bookingType]
  if (bookingType === 'flight') { return FLIGHT_BOOKINGS.filter(b => b.projectId === projectId && b.serviceId === serviceId && !terminal.includes(b.status)).map(b => b.id) }
  if (bookingType === 'hotel') { return HOTEL_BOOKINGS.filter(b => b.projectId === projectId && b.serviceId === serviceId && !terminal.includes(b.status)).map(b => b.id) }
  return TRANSPORT_BOOKINGS.filter(b => b.projectId === projectId && b.serviceId === serviceId && !terminal.includes(b.status)).map(b => b.id)
}

/** Dipanggil SETELAH `createFlightBooking`/`createHotelBooking`/`createTransportBooking` bila user mengonfirmasi "lanjutkan sebagai duplicate yang disengaja" pada dialog peringatan `findActiveBookingConflicts`. */
export function flagBookingOrchestrationDuplicate (bookingType: BookingDomain, bookingId: string, projectId: string, actorId: string, conflictingBookingIds: string[]): BookingOrchestrationRecord {
  const record = getOrCreateBookingOrchestrationRecord(bookingType, bookingId, projectId)
  record.flaggedDuplicate = true
  const actor = getUserById(actorId)
  ACTIVITIES.push({
    id: nextSequentialId('ACT-', ACTIVITIES),
    projectId,
    message: `${BOOKING_DOMAIN_LABEL[bookingType]} Booking ${bookingId} dibuat sebagai duplicate booking yang disengaja (booking aktif lain untuk service yang sama: ${conflictingBookingIds.join(', ')}) — dikonfirmasi oleh ${actor?.name ?? actorId}.`,
    isChange: true,
    reviewed: false,
    createdAt: DEMO_REFERENCE_DATE
  })
  return record
}

/**
 * Vendor Management (Section 13 lama/Prompt 13 — penomoran berbeda dari "Section 13 — Ticketing" roadmap
 * baru di atas, lihat `docs/mockup-implementation-state.md` bagian 0 soal skema penomoran ganda) —
 * create-mock master data vendor, melanjutkan pola `reactive()`
 * Section 07-12. `canManage('vendor')` sudah presisi (`ROLE_MODULE_ACCESS.vendor` = `ADMIN` Super Admin,
 * `VIEW` seluruh role lain — tidak ada rank `APPROVE` yang membocorkan akses seperti CRM/Project, jadi
 * TIDAK perlu pengecualian sempit tambahan seperti `canManageParty`/`canManageTravelers`).
 */
export function createVendor (input: { name: string; serviceType: ServiceTypeKey; contactName: string; contactPhone?: string; category?: string }): Vendor {
  const vendor: Vendor = { id: nextSequentialId('VND-', VENDORS), status: 'active', ...input }
  VENDORS.push(vendor)
  return vendor
}

/** `category`/`status`/`documents` (Section 17, aditif) — edit master data vendor, dipakai Vendor Detail. */
export function updateVendor (id: string, patch: Partial<Pick<Vendor, 'name' | 'category' | 'status' | 'contactName' | 'contactPhone'>>): Vendor | undefined {
  const vendor = getVendorById(id)
  if (!vendor) { return undefined }
  Object.assign(vendor, patch)
  return vendor
}

export function createVendorDocument (input: { vendorId: string; name: string; type: string }): VendorDocument {
  const document: VendorDocument = { id: nextSequentialId('VDOC-', VENDOR_DOCUMENTS), uploadedAt: DEMO_REFERENCE_DATE, ...input }
  VENDOR_DOCUMENTS.push(document)
  return document
}

export function createVendorContact (input: { vendorId: string; name: string; title: string; email?: string; phone?: string }): VendorContact {
  const contact: VendorContact = { id: nextSequentialId('VCT-', VENDOR_CONTACTS), ...input }
  VENDOR_CONTACTS.push(contact)
  return contact
}

/** Submit quotation baru (mock) — status awal selalu `submitted`, keputusan Accept/Reject terjadi di tab "Vendors" Project Detail. */
export function submitVendorQuotation (input: { vendorId: string; projectId: string; serviceId?: string; serviceType: ServiceTypeKey; amountIdr: number; notes?: string }): VendorQuotation {
  const quotation: VendorQuotation = { id: nextSequentialId('VQ-', VENDOR_QUOTATIONS), status: 'submitted', submittedAt: DEMO_REFERENCE_DATE, ...input }
  VENDOR_QUOTATIONS.push(quotation)
  return quotation
}

/**
 * Accept quotation — dipanggil hanya dari UI yang sudah memfilter `canManageServiceType(quotation.serviceType)`
 * (Section 12, direuse — bukan mekanisme role-check baru). Efek berantai (LOCKED untuk konsistensi data):
 * 1) quotation lain yang masih `submitted` untuk service yang sama otomatis `rejected` (hanya satu vendor
 *    per service); 2) bila `serviceId` diketahui, `ProjectService.vendorId` diarahkan ke vendor pemenang dan
 *    status service diperbarui via `updateServiceStatus` existing (reuse, bukan mutasi langsung paralel);
 * 3) entri `VendorActivity` dicatat — mengisi "Activity/history" tanpa log terpisah.
 */
export function acceptVendorQuotation (quotationId: string): VendorQuotation | undefined {
  const quotation = VENDOR_QUOTATIONS.find(item => item.id === quotationId)
  if (!quotation) { return undefined }
  quotation.status = 'accepted'

  if (quotation.serviceId) {
    for (const competing of VENDOR_QUOTATIONS) {
      if (competing.id !== quotation.id && competing.serviceId === quotation.serviceId && competing.status === 'submitted') {
        competing.status = 'rejected'
      }
    }
    const service = PROJECT_SERVICES.find(item => item.id === quotation.serviceId)
    if (service) {
      service.vendorId = quotation.vendorId
      updateServiceStatus(service.id, 'confirmed')
    }
  }

  VENDOR_ACTIVITIES.push({
    id: nextSequentialId('VACT-', VENDOR_ACTIVITIES),
    vendorId: quotation.vendorId,
    message: `Quotation ${findStatusOption(SERVICE_TYPES, quotation.serviceType).label} untuk project ${quotation.projectId} diterima.`,
    createdAt: DEMO_REFERENCE_DATE
  })

  return quotation
}

export function rejectVendorQuotation (quotationId: string): VendorQuotation | undefined {
  const quotation = VENDOR_QUOTATIONS.find(item => item.id === quotationId)
  if (!quotation) { return undefined }
  quotation.status = 'rejected'
  VENDOR_ACTIVITIES.push({
    id: nextSequentialId('VACT-', VENDOR_ACTIVITIES),
    vendorId: quotation.vendorId,
    message: `Quotation ${findStatusOption(SERVICE_TYPES, quotation.serviceType).label} untuk project ${quotation.projectId} ditolak.`,
    createdAt: DEMO_REFERENCE_DATE
  })
  return quotation
}

/**
 * Project Changes (Section 14) — mutasi `ACTIVITIES` existing (Foundation), BUKAN entitas Change paralel,
 * sesuai `docs/mockup-information-architecture.md` bagian 4 (LOCKED: satu sumber log yang sama dengan flag
 * `isChange`). `approvalStatus` terpisah dari `reviewed` (Section 06, dipakai `hasUnreviewedChange`/
 * `isProjectNeedingAttention` — tidak disentuh) — mensimulasikan alur approval dua-langkah yang sama polanya
 * dengan Opportunity Won (Section 09) dan Vendor Quotation (Section 13): ajukan → setujui/tolak.
 */

export interface CreateChangeEntryInput {
  projectId: string
  category: ChangeCategory
  reason: string
  requestedBy: string
  beforeValue?: string
  afterValue?: string
  impactNote?: string
}

export function createChangeEntry (input: CreateChangeEntryInput): ActivityEntry {
  const entry: ActivityEntry = {
    id: nextSequentialId('CHG-', ACTIVITIES),
    projectId: input.projectId,
    message: input.reason,
    isChange: true,
    reviewed: false,
    createdAt: DEMO_REFERENCE_DATE,
    category: input.category,
    reason: input.reason,
    requestedBy: input.requestedBy,
    beforeValue: input.beforeValue,
    afterValue: input.afterValue,
    impactNote: input.impactNote,
    approvalStatus: 'pending'
  }
  ACTIVITIES.push(entry)
  return entry
}

/** Approve/Reject dipanggil hanya dari UI yang sudah memfilter `canApprove('project')` (Management/Super Admin, docs bagian 5.1 "Approve"). */
export function approveChangeEntry (entryId: string, approverId: string): ActivityEntry | undefined {
  const entry = ACTIVITIES.find(item => item.id === entryId)
  if (!entry || entry.approvalStatus !== 'pending') { return undefined }
  entry.approvalStatus = 'approved'
  entry.reviewed = true
  entry.approvedBy = approverId
  return entry
}

export function rejectChangeEntry (entryId: string, approverId: string): ActivityEntry | undefined {
  const entry = ACTIVITIES.find(item => item.id === entryId)
  if (!entry || entry.approvalStatus !== 'pending') { return undefined }
  entry.approvalStatus = 'rejected'
  entry.reviewed = true
  entry.approvedBy = approverId
  return entry
}

/**
 * Lead (Prompt 19 — Change Request) — mengikuti pola `reactive()` mutasi Section 07 dst. "Qualify & Create
 * Opportunity" TIDAK memakai istilah "Convert to Customer" (instruksi literal Prompt 19-5A) — hasil akhirnya
 * adalah `Party` (Prospect) + `Opportunity` (stage `qualification`), bukan langsung "Client"; Party baru
 * hanya `Client` setelah Opportunity-nya benar-benar Won (D-024, tidak diubah).
 */
export const getLeadById = (id: string) => LEADS.find(lead => lead.id === id)
export function getLeadActivities (leadId: string) {
  return LEAD_ACTIVITIES.filter(activity => activity.leadId === leadId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}
export function getLeadFollowUps (leadId: string) {
  return getLeadActivities(leadId).filter(activity => Boolean(activity.dueAt))
}

export function createLead (input: { name: string; companyName?: string; source: Lead['source']; ownerId: string; phone?: string; email?: string }): Lead {
  const lead: Lead = {
    id: nextSequentialId('LED-', LEADS),
    stage: 'new',
    createdAt: DEMO_REFERENCE_DATE,
    lastUpdatedAt: DEMO_REFERENCE_DATE,
    archived: false,
    ...input
  }
  LEADS.push(lead)
  return lead
}

export function createLeadActivity (input: { leadId: string; type: PartyActivityType; message: string; ownerId: string; dueAt?: string }): LeadActivity {
  const activity: LeadActivity = { id: nextSequentialId('LACT-', LEAD_ACTIVITIES), createdAt: DEMO_REFERENCE_DATE, ...input }
  LEAD_ACTIVITIES.push(activity)
  const lead = getLeadById(input.leadId)
  if (lead) { lead.lastUpdatedAt = DEMO_REFERENCE_DATE }
  return activity
}

export function archiveLead (leadId: string): Lead | undefined {
  const lead = getLeadById(leadId)
  if (!lead) { return undefined }
  lead.archived = true
  lead.lastUpdatedAt = DEMO_REFERENCE_DATE
  return lead
}

/** "Reopen" (Section 04) — kebalikan `archiveLead`, tidak mengubah `stage`/data qualification apa pun. */
export function reopenLead (leadId: string): Lead | undefined {
  const lead = getLeadById(leadId)
  if (!lead) { return undefined }
  lead.archived = false
  lead.lastUpdatedAt = DEMO_REFERENCE_DATE
  return lead
}

/** "Edit Lead" (Section 04) — field kontak dasar (dulu hanya bisa diisi sekali saat create). */
export interface LeadContactInput {
  name?: string
  companyName?: string
  source?: Lead['source']
  phone?: string
  email?: string
}

export function updateLeadContact (leadId: string, patch: LeadContactInput): Lead | undefined {
  const lead = getLeadById(leadId)
  if (!lead) { return undefined }
  Object.assign(lead, patch)
  lead.lastUpdatedAt = DEMO_REFERENCE_DATE
  return lead
}

/**
 * Duplicate suggestion (Section 03/04) — selector bersama dipakai `/lead-intake` (preview non-blocking
 * saat mengisi form publik) dan `/customer-journey/leads` (New Lead dialog + drawer Overview, "merge
 * suggestion"). Mencocokkan phone/email (trim, email case-insensitive) terhadap Lead lain yang BELUM
 * archived (Lead yang sudah archived diasumsikan sudah pernah ditangani/di-merge sebelumnya, tidak
 * ditawarkan lagi sebagai target canonical baru).
 */
export function getLeadDuplicateCandidates (input: { phone?: string; email?: string; excludeLeadId?: string }): Lead[] {
  const phoneNorm = input.phone?.trim()
  const emailNorm = input.email?.trim().toLowerCase()
  if (!phoneNorm && !emailNorm) { return [] }
  return LEADS.filter(lead =>
    lead.id !== input.excludeLeadId &&
    !lead.archived &&
    ((Boolean(phoneNorm) && lead.phone?.trim() === phoneNorm) || (Boolean(emailNorm) && (lead.email ?? '').trim().toLowerCase() === emailNorm))
  )
}

/**
 * "Merge suggestion" (Section 04) — TIDAK menggabungkan field data (di luar scope, kompleksitas tinggi
 * untuk mockup), melainkan pola realistis: Sales meninjau kandidat duplikat lalu meng-archive lead
 * duplikat dengan catatan referensi ke lead canonical yang dipertahankan — kedua lead tetap ada sebagai
 * histori (mengikuti hard rule "jangan menghapus data"), hanya status `archived` yang berubah.
 */
export function mergeLeadAsDuplicate (duplicateLeadId: string, canonicalLeadId: string, actorId: string): Lead | undefined {
  if (duplicateLeadId === canonicalLeadId) { return undefined }
  const duplicate = getLeadById(duplicateLeadId)
  const canonical = getLeadById(canonicalLeadId)
  if (!duplicate || !canonical || duplicate.archived) { return undefined }
  duplicate.archived = true
  duplicate.lastUpdatedAt = DEMO_REFERENCE_DATE
  createLeadActivity({ leadId: duplicate.id, type: 'note', message: `Ditandai sebagai duplikat, digabung ke ${canonical.id} (${canonical.name}).`, ownerId: actorId })
  createLeadActivity({ leadId: canonical.id, type: 'note', message: `Menerima merge dari lead duplikat ${duplicate.id} (${duplicate.name}).`, ownerId: actorId })
  return duplicate
}

/**
 * Qualification form field yang boleh disimpan sebagai draft (Prompt 20 — Change Request, tombol
 * "Simpan Draft") — TIDAK ada gate di sini, boleh sebagian/kosong. Gate kelengkapan ada di
 * `getLeadMissingQualification`, dicek terpisah sebelum "Qualify & Create Opportunity" diizinkan.
 */
export interface LeadQualificationInput {
  serviceCategory?: Lead['serviceCategory']
  destination?: string
  travelStartDate?: string
  travelEndDate?: string
  travelerEstimate?: number
  serviceScope?: Lead['serviceScope']
  requirementSummary?: string
  handedOverTo?: string
  budgetRange?: string
  dateFlexible?: boolean
  decisionMaker?: string
  urgency?: Lead['urgency']
  specialRequestNote?: string
  qualificationNotes?: string
  expectedCloseDate?: string
}

export function updateLeadQualification (leadId: string, patch: LeadQualificationInput): Lead | undefined {
  const lead = getLeadById(leadId)
  if (!lead) { return undefined }
  Object.assign(lead, patch)
  lead.lastUpdatedAt = DEMO_REFERENCE_DATE
  return lead
}

/**
 * Field wajib (Prompt 20-4/5) sebelum Lead dapat di-qualify — dicek tombol "Qualify & Create Opportunity"
 * (disabled + warning list bila belum lengkap), mengikuti pola `getOpportunityMissingRequirements` (Section 09).
 */
export function getLeadMissingQualification (leadId: string): string[] {
  const lead = getLeadById(leadId)
  if (!lead) { return ['Lead tidak ditemukan'] }
  const missing: string[] = []
  if (!lead.serviceCategory) { missing.push('Jenis kebutuhan') }
  if (!lead.destination) { missing.push('Destinasi belum diisi') }
  if (!lead.travelStartDate || !lead.travelEndDate) { missing.push('Periode perjalanan belum diisi') }
  if (!lead.travelerEstimate) { missing.push('Estimasi traveler belum diisi') }
  if (!lead.serviceScope || lead.serviceScope.length === 0) { missing.push('Service scope belum dipilih') }
  if (!lead.handedOverTo) { missing.push('Account Executive belum dipilih') }
  if (!lead.requirementSummary) { missing.push('Ringkasan kebutuhan belum diisi') }
  return missing
}

/** "Mark as Unqualified" (Prompt 20-4) — terminal untuk mockup ini, tidak membuat Party/Opportunity. */
export function markLeadUnqualified (leadId: string, note?: string): Lead | undefined {
  const lead = getLeadById(leadId)
  if (!lead) { return undefined }
  lead.stage = 'unqualified'
  lead.lastUpdatedAt = DEMO_REFERENCE_DATE
  if (note) {
    createLeadActivity({ leadId, type: 'note', message: `Lead ditandai Unqualified. Catatan: ${note}`, ownerId: lead.ownerId })
  }
  return lead
}

/**
 * "Qualify & Create Opportunity" — satu-satunya jalur Lead menjadi Opportunity (bukan tombol terpisah
 * "Convert to Customer"). Mencari `Party` existing dengan nama company yang sama dulu (hindari duplicate
 * company, konsisten Prompt 19-4 "repeat client: jangan membuat client baru"); bila tidak ada, buat Party
 * baru berstatus `prospect`. Opportunity baru dibuat di stage `qualification`, membawa seluruh data
 * qualification (Prompt 20-6) dari Lead. `accountExecutiveId` diambil dari `lead.handedOverTo` (diisi Sales
 * lewat form Qualification, bukan lagi ditentukan otomatis saat tombol diklik). Gate: `getLeadMissingQualification`
 * harus kosong (dicek juga di sini, bukan hanya di UI, agar mutator ini aman dipanggil dari mana pun).
 */
export function qualifyLeadAndCreateOpportunity (leadId: string): Opportunity | undefined {
  const lead = getLeadById(leadId)
  if (!lead || lead.opportunityId || getLeadMissingQualification(leadId).length > 0) { return undefined }
  const accountExecutiveId = lead.handedOverTo!

  let party = lead.companyName ? PARTIES.find(p => p.name.toLowerCase() === lead.companyName!.toLowerCase()) : undefined
  if (!party) {
    party = {
      id: nextSequentialId('PTY-', PARTIES),
      name: lead.companyName || lead.name,
      lifecycleStatus: 'prospect',
      createdAt: DEMO_REFERENCE_DATE,
      accountOwnerId: accountExecutiveId
    }
    PARTIES.push(party)
  }

  const opportunity: Opportunity = {
    id: nextSequentialId('OPP-', OPPORTUNITIES),
    partyId: party.id,
    title: `${lead.companyName || lead.name} — Opportunity Baru`,
    stage: 'qualification',
    ownerId: accountExecutiveId,
    estimatedValueIdr: 0,
    destination: lead.destination!,
    travelStartDate: lead.travelStartDate,
    travelEndDate: lead.travelEndDate,
    travelerEstimate: lead.travelerEstimate,
    serviceScope: lead.serviceScope ?? [],
    requirementNotes: lead.requirementSummary,
    createdAt: DEMO_REFERENCE_DATE,
    contactName: lead.name,
    leadId: lead.id,
    expectedCloseDate: lead.expectedCloseDate
  }
  OPPORTUNITIES.push(opportunity)

  lead.stage = 'qualified'
  lead.partyId = party.id
  lead.opportunityId = opportunity.id
  lead.lastUpdatedAt = DEMO_REFERENCE_DATE

  const accountExecutive = getUserById(accountExecutiveId)
  createLeadActivity({ leadId: lead.id, type: 'note', message: 'Lead Qualified', ownerId: accountExecutiveId })
  createLeadActivity({ leadId: lead.id, type: 'note', message: `Lead Assigned to Account Executive (${accountExecutive?.name ?? accountExecutiveId})`, ownerId: accountExecutiveId })
  createPartyActivity({
    partyId: party.id,
    opportunityId: opportunity.id,
    type: 'note',
    message: `Opportunity Created dari Lead ${lead.id}`,
    ownerId: accountExecutiveId
  })

  return opportunity
}

/** Vendor Product catalog (Prompt 19 — area Supplier/External Partners). */
export const getVendorProducts = (vendorId: string) => VENDOR_PRODUCTS.filter(product => product.vendorId === vendorId)

export function createVendorProduct (input: { vendorId: string; name: string; category: ServiceTypeKey; description?: string; priceIdr?: number }): VendorProduct {
  const product: VendorProduct = { id: nextSequentialId('VPR-', VENDOR_PRODUCTS), ...input }
  VENDOR_PRODUCTS.push(product)
  return product
}

/**
 * Product Planning dan Costing (Section 10 — roadmap Section 00–24 baru). Lihat `ProductTemplate`/
 * `CostSheet` (`app/types/product.ts`) untuk rasional model. Selector/mutator di bawah melanjutkan pola
 * `reactive()` Section 07 dst.
 */

export const getProductTemplateById = (id: string) => PRODUCT_TEMPLATES.find(product => product.id === id)
export const getCostSheetById = (id: string) => COST_SHEETS.find(sheet => sheet.id === id)
export const getCostSheetsByOpportunity = (opportunityId: string) => COST_SHEETS
  .filter(sheet => sheet.opportunityId === opportunityId)
  .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
export const getCostSheetsByProduct = (productId: string) => COST_SHEETS
  .filter(sheet => sheet.productId === productId)
  .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

export interface CostSheetBreakdown {
  baseCostIdr: number
  contingencyIdr: number
  costWithContingencyIdr: number
  markupIdr: number
  subtotalIdr: number
  taxIdr: number
  totalSellIdr: number
  marginIdr: number
}

/**
 * Kalkulasi Cost Sheet (Wajib "Cost sheet, markup, tax/fee, contingency, currency", "Traveler-based
 * costing") — DIRIVASI dari `lineItems`/`travelerCount`/`markupPercent`/`taxPercent`/`contingencyPercent`,
 * bukan field tersimpan (pola sama `getProjectOrderStatus`/`getOpportunityWorkflowStatus`), agar mengubah
 * satu komponen (mis. traveler count) otomatis konsisten di seluruh angka turunan tanpa risiko field stale.
 * Urutan: base cost → + contingency → + markup → + tax = total sell.
 */
export function getCostSheetBreakdown (costSheet: CostSheet): CostSheetBreakdown {
  const baseCostIdr = costSheet.lineItems.reduce((sum, item) => sum + item.costPerPaxIdr, 0) * costSheet.travelerCount
  const contingencyIdr = Math.round(baseCostIdr * (costSheet.contingencyPercent / 100))
  const costWithContingencyIdr = baseCostIdr + contingencyIdr
  const markupIdr = Math.round(costWithContingencyIdr * (costSheet.markupPercent / 100))
  const subtotalIdr = costWithContingencyIdr + markupIdr
  const taxIdr = Math.round(subtotalIdr * (costSheet.taxPercent / 100))
  const totalSellIdr = subtotalIdr + taxIdr
  return { baseCostIdr, contingencyIdr, costWithContingencyIdr, markupIdr, subtotalIdr, taxIdr, totalSellIdr, marginIdr: totalSellIdr - costWithContingencyIdr }
}

export interface CreateProductTemplateInput {
  name: string
  destination: string
  serviceScope: ServiceTypeKey[]
  itineraryConcept?: string
  serviceAlternatives?: ProductServiceAlternative[]
  inclusions?: string
  exclusions?: string
  assumptions?: string
  validityStart?: string
  validityEnd?: string
  basePaxCount: number
  createdBy: string
}

export function createProductTemplate (input: CreateProductTemplateInput): ProductTemplate {
  const product: ProductTemplate = {
    id: nextSequentialId('PRD-', PRODUCT_TEMPLATES),
    status: 'draft',
    serviceAlternatives: [],
    createdAt: DEMO_REFERENCE_DATE,
    ...input
  }
  PRODUCT_TEMPLATES.push(product)
  return product
}

export type ProductTemplateInput = Partial<Omit<CreateProductTemplateInput, 'createdBy'>>

export function updateProductTemplate (id: string, patch: ProductTemplateInput): ProductTemplate | undefined {
  const product = getProductTemplateById(id)
  if (!product) { return undefined }
  Object.assign(product, patch)
  product.updatedAt = DEMO_REFERENCE_DATE
  return product
}

const PRODUCT_TEMPLATE_STATUS_TRANSITIONS: Record<ProductTemplateStatus, ProductTemplateStatus[]> = {
  draft: ['active', 'archived'],
  active: ['archived'],
  archived: []
}

export function getProductTemplateStatusTransitions (current: ProductTemplateStatus): ProductTemplateStatus[] {
  return PRODUCT_TEMPLATE_STATUS_TRANSITIONS[current] ?? []
}

export function updateProductTemplateStatus (id: string, newStatus: ProductTemplateStatus): ProductTemplate | undefined {
  const product = getProductTemplateById(id)
  if (!product) { return undefined }
  if (!getProductTemplateStatusTransitions(product.status).includes(newStatus)) { return undefined }
  product.status = newStatus
  product.updatedAt = DEMO_REFERENCE_DATE
  return product
}

export interface CreateCostSheetInput {
  name: string
  productId?: string
  opportunityId?: string
  travelerCount: number
  currency?: string
  lineItems?: CostSheetLineItem[]
  markupPercent?: number
  taxPercent?: number
  contingencyPercent?: number
  inclusions?: string
  exclusions?: string
  assumptions?: string
  validityStart?: string
  validityEnd?: string
  notes?: string
  createdBy: string
}

/**
 * "Collaboration dengan AE, Operations, Finance" (Wajib) — Cost Sheet baru boleh dimulai kosong atau
 * di-seed dari alternatif yang direkomendasikan Product Template (bila `productId` diisi dan `lineItems`
 * tidak diberikan eksplisit), mempercepat Planner menyusun estimasi awal dari katalog yang sudah ada.
 */
export function createCostSheet (input: CreateCostSheetInput): CostSheet {
  const seededLineItems = input.lineItems ?? (input.productId
    ? getProductTemplateById(input.productId)?.serviceAlternatives
      .filter(alt => alt.isRecommended)
      .map((alt): CostSheetLineItem => ({ service: alt.service, description: alt.label, costPerPaxIdr: alt.costPerPaxIdr }))
    : undefined) ?? []

  const costSheet: CostSheet = {
    id: nextSequentialId('CS-', COST_SHEETS),
    currency: 'IDR',
    markupPercent: 0,
    taxPercent: 0,
    contingencyPercent: 0,
    status: 'draft',
    version: 1,
    createdAt: DEMO_REFERENCE_DATE,
    ...input,
    lineItems: seededLineItems
  }
  COST_SHEETS.push(costSheet)
  return costSheet
}

export type CostSheetInput = Partial<Omit<CreateCostSheetInput, 'createdBy'>>

/**
 * "Snapshot konsep ketika dipakai pada quotation/project" (Wajib) — begitu `appliedToQuotationId` terisi
 * (lihat `applyCostSheetToQuotation`), Cost Sheet dikunci (`status: 'final'`) dan TIDAK BOLEH diedit lagi di
 * sini — revisi lanjutan wajib lewat `duplicateCostSheetVersion` ("Duplicate as New Version"), pola sama
 * `updateQuotationDetails` yang mengunci quotation begitu `submitted`/`approved`.
 */
export function updateCostSheet (id: string, patch: CostSheetInput): CostSheet | undefined {
  const costSheet = getCostSheetById(id)
  if (!costSheet || costSheet.status === 'final') { return undefined }
  Object.assign(costSheet, patch)
  costSheet.updatedAt = DEMO_REFERENCE_DATE
  return costSheet
}

/**
 * "Scenario/version comparison" (Wajib) — menyalin Cost Sheet ini sebagai versi baru untuk direvisi lebih
 * lanjut (pola sama `duplicateQuotationVersion`, Section 05): total sell versi sebelumnya disimpan di
 * `supersededTotalSellIdr` untuk dibandingkan, status kembali `draft`, referensi `appliedToQuotationId`
 * dilepas (versi baru ini belum pernah dipakai).
 */
export function duplicateCostSheetVersion (id: string): CostSheet | undefined {
  const costSheet = getCostSheetById(id)
  if (!costSheet) { return undefined }
  const previousTotalSellIdr = getCostSheetBreakdown(costSheet).totalSellIdr
  costSheet.supersededTotalSellIdr = previousTotalSellIdr
  costSheet.version += 1
  costSheet.status = 'draft'
  costSheet.appliedToQuotationId = undefined
  costSheet.appliedAt = undefined
  costSheet.updatedAt = DEMO_REFERENCE_DATE
  return costSheet
}

/**
 * "Snapshot konsep ketika dipakai pada quotation/project" + "Internal costing tidak terlihat Client"
 * (Wajib) — mengubah hasil kalkulasi Cost Sheet menjadi nilai Quotation (dibuat baru bila Opportunity
 * belum punya Quotation, atau memperbarui Quotation draft yang sudah ada — guard sama seperti
 * `updateQuotationDetails`: tidak bisa menimpa Quotation yang sudah `submitted`/`approved`). Hanya
 * `estimatedCostIdr`/`estimatedMarginIdr`/`serviceBreakdown` yang tersalin ke Quotation (field internal
 * cost/margin TETAP hanya tampil di halaman internal — Client Portal Section 08 sudah menyaring field ini
 * sejak awal, tidak perlu perubahan tambahan). Setelah diterapkan, Cost Sheet dikunci (`final`).
 */
export function applyCostSheetToQuotation (costSheetId: string, actorId: string): Quotation | undefined {
  const costSheet = getCostSheetById(costSheetId)
  if (!costSheet || costSheet.appliedToQuotationId || !costSheet.opportunityId) { return undefined }
  const opportunity = getOpportunityById(costSheet.opportunityId)
  if (!opportunity) { return undefined }

  const breakdown = getCostSheetBreakdown(costSheet)
  const serviceBreakdown = costSheet.lineItems.map(item => ({
    service: item.service,
    description: item.description,
    amountIdr: item.costPerPaxIdr * costSheet.travelerCount
  }))

  let quotation = getQuotationByOpportunity(opportunity.id)
  if (quotation) {
    if (quotation.approvalStatus === 'submitted' || quotation.approvalStatus === 'approved') { return undefined }
    Object.assign(quotation, {
      amountIdr: breakdown.totalSellIdr,
      estimatedCostIdr: breakdown.costWithContingencyIdr,
      estimatedMarginIdr: breakdown.marginIdr,
      currency: costSheet.currency,
      serviceBreakdown
    })
  } else {
    quotation = createQuotation(opportunity.id, breakdown.totalSellIdr)
    Object.assign(quotation, {
      estimatedCostIdr: breakdown.costWithContingencyIdr,
      estimatedMarginIdr: breakdown.marginIdr,
      currency: costSheet.currency,
      serviceBreakdown
    })
  }
  quotation.costSheetId = costSheet.id

  costSheet.appliedToQuotationId = quotation.id
  costSheet.appliedAt = DEMO_REFERENCE_DATE
  costSheet.status = 'final'

  createPartyActivity({
    partyId: opportunity.partyId,
    opportunityId: opportunity.id,
    type: 'note',
    message: `Cost Sheet ${costSheet.id} (${costSheet.name}) diterapkan ke Quotation ${quotation.id} — ${formatCurrencyIdr(breakdown.totalSellIdr)}.`,
    ownerId: actorId
  })

  return quotation
}

/**
 * Procurement (Section 17 — Supplier dan Procurement, roadmap Section 00–24 baru). Lihat `RFQ`/`ServiceOrder`/
 * `SupplierInvoice` (`app/types/procurement.ts`) untuk rasional model — modul top-level BARU `/procurement`
 * MENDAMPINGI `/vendors` (master data, Section 13 lama) dan `/supplier` (self-service, Prompt 19), pola
 * arsitektur mengikuti preseden D-070/D-071/D-072/D-073 (lihat D-074, `docs/mockup-design-decisions.md`).
 * Selector/mutator di bawah melanjutkan pola `reactive()` Section 07 dst.
 */

/* RFQ */
export const getRfqById = (id: string) => RFQS.find(rfq => rfq.id === id)
export const getRfqsByProject = (projectId: string) => RFQS.filter(rfq => rfq.projectId === projectId)
export const getRfqInvitations = (rfqId: string) => RFQ_INVITATIONS.filter(inv => inv.rfqId === rfqId)
export const getRfqResponses = (rfqId: string) => RFQ_RESPONSES
  .filter(resp => resp.rfqId === rfqId)
  .sort((a, b) => a.totalAmountIdr - b.totalAmountIdr)
export const getRfqResponseByVendor = (rfqId: string, vendorId: string) => RFQ_RESPONSES.find(resp => resp.rfqId === rfqId && resp.vendorId === vendorId)
export const getRfqClarifications = (rfqId: string, vendorId?: string) => RFQ_CLARIFICATIONS
  .filter(msg => msg.rfqId === rfqId && (!vendorId || msg.vendorId === vendorId))
  .sort((a, b) => a.createdAt.localeCompare(b.createdAt))

/** Supplier Portal scope (Section 17) — RFQ yang mengundang vendor tertentu, dipakai "RFQ Inbox" `/supplier/rfq`, di-scope `vendorScopeId`. */
export function getRfqsForVendor (vendorId: string): RFQ[] {
  const invitedRfqIds = new Set(RFQ_INVITATIONS.filter(inv => inv.vendorId === vendorId).map(inv => inv.rfqId))
  return RFQS.filter(rfq => invitedRfqIds.has(rfq.id)).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export interface CreateRfqInput {
  projectId?: string
  title: string
  serviceType: ServiceTypeKey
  lineItems: RFQLineItem[]
  dueAt?: string
  notes?: string
  createdBy: string
}

export function createRfq (input: CreateRfqInput): RFQ {
  const rfq: RFQ = { id: nextSequentialId('RFQ-', RFQS), status: 'draft', createdAt: DEMO_REFERENCE_DATE, ...input }
  RFQS.push(rfq)
  return rfq
}

const RFQ_TERMINAL_STATUSES: RFQStatus[] = ['closed']

export type RfqInput = Partial<Pick<RFQ, 'title' | 'lineItems' | 'dueAt' | 'notes'>>
export function updateRfq (id: string, patch: RfqInput): RFQ | undefined {
  const rfq = getRfqById(id)
  if (!rfq || RFQ_TERMINAL_STATUSES.includes(rfq.status)) { return undefined }
  Object.assign(rfq, patch)
  rfq.updatedAt = DEMO_REFERENCE_DATE
  return rfq
}

/** "Sent" (Wajib) — kirim RFQ ke vendor terpilih, membuat `RFQInvitation` per vendor. Hanya dari `draft`. */
export function sendRfqToVendors (rfqId: string, vendorIds: string[]): RFQ | undefined {
  const rfq = getRfqById(rfqId)
  if (!rfq || rfq.status !== 'draft' || vendorIds.length === 0) { return undefined }
  vendorIds.forEach((vendorId) => {
    RFQ_INVITATIONS.push({ id: nextSequentialId('RFQINV-', RFQ_INVITATIONS), rfqId, vendorId, status: 'invited', invitedAt: DEMO_REFERENCE_DATE })
  })
  rfq.status = 'sent'
  rfq.updatedAt = DEMO_REFERENCE_DATE
  return rfq
}

/**
 * "Supplier response" (Wajib) — dipanggil dari Supplier Portal (`/supplier/rfq/[id]`, scoped `vendorScopeId`).
 * Menyimpan/menimpa respons vendor tsb (satu respons aktif per vendor per RFQ, resubmit menimpa yang lama —
 * pola sama `submitVendorQuotation` versi tunggal, bukan versioning bertingkat), menandai invitation
 * `responded`, dan memajukan status RFQ `sent` → `responses-in` (hanya sekali, respons susulan setelah RFQ
 * masuk fase `comparison`/`clarification` TIDAK memundurkan status).
 */
export interface SubmitRfqResponseInput {
  rfqId: string
  vendorId: string
  lineItems: RFQResponseLineItem[]
  notes?: string
}
export function submitRfqResponse (input: SubmitRfqResponseInput): RFQResponse | undefined {
  const rfq = getRfqById(input.rfqId)
  if (!rfq || RFQ_TERMINAL_STATUSES.includes(rfq.status)) { return undefined }
  const totalAmountIdr = input.lineItems.reduce((sum, item) => sum + item.unitPriceIdr * item.quantity, 0)
  const existing = getRfqResponseByVendor(input.rfqId, input.vendorId)
  let response: RFQResponse
  if (existing) {
    Object.assign(existing, { lineItems: input.lineItems, notes: input.notes, totalAmountIdr, submittedAt: DEMO_REFERENCE_DATE, status: 'submitted' as const })
    response = existing
  } else {
    response = { id: nextSequentialId('RFQRESP-', RFQ_RESPONSES), rfqId: input.rfqId, vendorId: input.vendorId, lineItems: input.lineItems, notes: input.notes, totalAmountIdr, status: 'submitted', submittedAt: DEMO_REFERENCE_DATE }
    RFQ_RESPONSES.push(response)
  }
  const invitation = RFQ_INVITATIONS.find(inv => inv.rfqId === input.rfqId && inv.vendorId === input.vendorId)
  if (invitation) { invitation.status = 'responded' }
  if (rfq.status === 'sent') { rfq.status = 'responses-in' }
  rfq.updatedAt = DEMO_REFERENCE_DATE
  return response
}

/** Peta transisi manual (tombol UI) — transisi `sent` → `responses-in` terjadi OTOMATIS lewat `submitRfqResponse`, bukan tombol manual. */
const RFQ_MANUAL_TRANSITIONS: Record<RFQStatus, RFQStatus[]> = {
  draft: [],
  sent: [],
  'responses-in': ['comparison'],
  comparison: ['clarification', 'selected'],
  clarification: ['comparison', 'selected'],
  selected: ['closed'],
  closed: []
}
export function getRfqStatusTransitions (current: RFQStatus): RFQStatus[] {
  return RFQ_MANUAL_TRANSITIONS[current] ?? []
}

export function moveRfqStatus (rfqId: string, newStatus: RFQStatus): RFQ | undefined {
  const rfq = getRfqById(rfqId)
  if (!rfq || !getRfqStatusTransitions(rfq.status).includes(newStatus)) { return undefined }
  rfq.status = newStatus
  rfq.updatedAt = DEMO_REFERENCE_DATE
  return rfq
}

/** "Clarification thread per vendor" (Wajib) — dua arah; pesan dari `procurement` menjaga RFQ tetap/berpindah ke status `clarification` bila sebelumnya `responses-in`/`comparison`. */
export function addRfqClarificationMessage (input: { rfqId: string; vendorId: string; from: 'procurement' | 'supplier'; message: string }): RFQClarificationMessage | undefined {
  const rfq = getRfqById(input.rfqId)
  if (!rfq || RFQ_TERMINAL_STATUSES.includes(rfq.status) || !input.message.trim()) { return undefined }
  const entry: RFQClarificationMessage = { id: nextSequentialId('RFQCLR-', RFQ_CLARIFICATIONS), createdAt: DEMO_REFERENCE_DATE, ...input, message: input.message.trim() }
  RFQ_CLARIFICATIONS.push(entry)
  if (input.from === 'procurement' && (rfq.status === 'comparison' || rfq.status === 'responses-in')) { rfq.status = 'clarification' }
  rfq.updatedAt = DEMO_REFERENCE_DATE
  return entry
}

/**
 * "Formal Select action" (Wajib) — vendor pemenang RFQ: response terpilih ditandai `selected`, response
 * lain untuk RFQ yang sama otomatis `rejected` (satu vendor per RFQ, pola sama `acceptVendorQuotation`
 * Section 13), `RFQ.selectedVendorId` diisi, status → `selected`. Dicatat sebagai `ActivityEntry` pada
 * project terkait bila `projectId` ada.
 */
export function selectRfqVendor (rfqId: string, vendorId: string, actorId: string): RFQ | undefined {
  const rfq = getRfqById(rfqId)
  if (!rfq || !['responses-in', 'comparison', 'clarification'].includes(rfq.status)) { return undefined }
  const winningResponse = getRfqResponseByVendor(rfqId, vendorId)
  if (!winningResponse) { return undefined }

  RFQ_RESPONSES.forEach((resp) => {
    if (resp.rfqId !== rfqId) { return }
    resp.status = resp.vendorId === vendorId ? 'selected' : 'rejected'
  })
  rfq.selectedVendorId = vendorId
  rfq.status = 'selected'
  rfq.updatedAt = DEMO_REFERENCE_DATE

  if (rfq.projectId) {
    const actor = getUserById(actorId)
    const vendor = getVendorById(vendorId)
    ACTIVITIES.push({
      id: nextSequentialId('ACT-', ACTIVITIES),
      projectId: rfq.projectId,
      message: `RFQ ${rfq.id} (${rfq.title}) — vendor terpilih: ${vendor?.name ?? vendorId}, diputuskan oleh ${actor?.name ?? actorId}.`,
      isChange: false,
      reviewed: true,
      createdAt: DEMO_REFERENCE_DATE
    })
  }
  return rfq
}

export function closeRfq (rfqId: string): RFQ | undefined {
  const rfq = getRfqById(rfqId)
  if (!rfq || rfq.status !== 'selected') { return undefined }
  rfq.status = 'closed'
  rfq.closedAt = DEMO_REFERENCE_DATE
  rfq.updatedAt = DEMO_REFERENCE_DATE
  return rfq
}

/* Service Order */
export const getServiceOrderById = (id: string) => SERVICE_ORDERS.find(so => so.id === id)
export const getServiceOrdersByProject = (projectId: string) => SERVICE_ORDERS.filter(so => so.projectId === projectId)
/** Supplier Portal scope (Section 17) — "Service Order inbox" `/supplier/service-orders`, di-scope `vendorScopeId`. */
export const getServiceOrdersByVendor = (vendorId: string) => SERVICE_ORDERS
  .filter(so => so.vendorId === vendorId)
  .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
export const getServiceOrdersByRfq = (rfqId: string) => SERVICE_ORDERS.filter(so => so.rfqId === rfqId)
export const getServiceOrderAmendments = (serviceOrderId: string) => SERVICE_ORDER_AMENDMENTS
  .filter(item => item.serviceOrderId === serviceOrderId)
  .sort((a, b) => b.changedAt.localeCompare(a.changedAt))

export interface CreateServiceOrderInput {
  rfqId?: string
  vendorId: string
  projectId?: string
  serviceId?: string
  lineItems: ServiceOrderLineItem[]
  netCostIdr?: number
  sellPriceIdr?: number
}
export function createServiceOrder (input: CreateServiceOrderInput): ServiceOrder {
  const serviceOrder: ServiceOrder = { id: nextSequentialId('SO-', SERVICE_ORDERS), status: 'draft', createdAt: DEMO_REFERENCE_DATE, ...input }
  SERVICE_ORDERS.push(serviceOrder)
  return serviceOrder
}

/** Guard: `fulfilled`/`cancelled` bersifat terminal — pola sama section 13-16 (D-070/D-071/D-072/D-073). */
const SERVICE_ORDER_TERMINAL_STATUSES: ServiceOrderStatus[] = ['fulfilled', 'cancelled']
export type ServiceOrderInput = Partial<Pick<ServiceOrder, 'lineItems' | 'netCostIdr' | 'sellPriceIdr'>>
export function updateServiceOrder (id: string, patch: ServiceOrderInput): ServiceOrder | undefined {
  const so = getServiceOrderById(id)
  if (!so || SERVICE_ORDER_TERMINAL_STATUSES.includes(so.status)) { return undefined }
  Object.assign(so, patch)
  so.updatedAt = DEMO_REFERENCE_DATE
  return so
}

const SERVICE_ORDER_TRANSITIONS: Record<ServiceOrderStatus, ServiceOrderStatus[]> = {
  draft: ['sent', 'cancelled'],
  sent: ['acknowledged', 'cancelled'],
  acknowledged: ['amended', 'fulfilled', 'cancelled'],
  amended: ['fulfilled', 'cancelled'],
  fulfilled: [],
  cancelled: []
}
export function getServiceOrderStatusTransitions (current: ServiceOrderStatus): ServiceOrderStatus[] {
  return SERVICE_ORDER_TRANSITIONS[current] ?? []
}

/**
 * "Acknowledgment dan fulfillment status" (Wajib) — dipanggil dari `/procurement/service-orders/[id]`
 * (internal, seluruh transisi) MAUPUN `/supplier/service-orders/[id]` (self-service, hanya `acknowledged`
 * dan `fulfilled` yang relevan untuk supplier — UI membatasi tombol yang ditampilkan). Reason wajib untuk
 * `cancelled` (dampak besar, pola sama section 13-16). Dicatat sebagai `ActivityEntry` bila `projectId` ada.
 */
export function updateServiceOrderStatus (id: string, newStatus: ServiceOrderStatus, actorId: string, reason?: string): ServiceOrder | undefined {
  const so = getServiceOrderById(id)
  if (!so) { return undefined }
  if (!getServiceOrderStatusTransitions(so.status).includes(newStatus)) { return undefined }
  if (newStatus === 'cancelled' && !reason?.trim()) { return undefined }

  const fromLabel = so.status
  so.status = newStatus
  so.updatedAt = DEMO_REFERENCE_DATE
  if (newStatus === 'acknowledged') { so.acknowledgedAt = DEMO_REFERENCE_DATE }
  if (newStatus === 'fulfilled') { so.fulfilledAt = DEMO_REFERENCE_DATE }
  if (reason) { so.statusReason = reason.trim() }

  if (so.projectId) {
    const actor = getUserById(actorId)
    const vendor = getVendorById(so.vendorId)
    ACTIVITIES.push({
      id: nextSequentialId('ACT-', ACTIVITIES),
      projectId: so.projectId,
      message: `Service Order ${so.id} (${vendor?.name ?? so.vendorId}) status diubah dari "${fromLabel}" menjadi "${newStatus}" oleh ${actor?.name ?? actorId}.${reason ? ` Alasan: ${reason}` : ''}`,
      isChange: false,
      reviewed: true,
      createdAt: DEMO_REFERENCE_DATE
    })
  }
  return so
}

/** "Amendment" (Wajib) — riwayat perubahan Service Order, append-only (`ServiceOrderAmendment`). Hanya dari `acknowledged`/`amended` (sudah diakui supplier terlebih dulu). */
export function amendServiceOrder (id: string, reason: string, actorId: string, patch?: ServiceOrderInput): ServiceOrder | undefined {
  const so = getServiceOrderById(id)
  if (!so || !['acknowledged', 'amended'].includes(so.status) || !reason.trim()) { return undefined }
  if (patch) { Object.assign(so, patch) }
  so.status = 'amended'
  so.updatedAt = DEMO_REFERENCE_DATE
  SERVICE_ORDER_AMENDMENTS.push({ id: nextSequentialId('SOA-', SERVICE_ORDER_AMENDMENTS), serviceOrderId: id, reason: reason.trim(), changedAt: DEMO_REFERENCE_DATE, changedBy: actorId })

  if (so.projectId) {
    const actor = getUserById(actorId)
    ACTIVITIES.push({
      id: nextSequentialId('ACT-', ACTIVITIES),
      projectId: so.projectId,
      message: `Service Order ${so.id} diamandemen oleh ${actor?.name ?? actorId}. Alasan: ${reason.trim()}`,
      isChange: true,
      reviewed: false,
      createdAt: DEMO_REFERENCE_DATE
    })
  }
  return so
}

/**
 * Supplier Invoice (Wajib, resolusi Q12 — `docs/mockup-open-questions.md`) — preview/mock murni, TIDAK ADA
 * payment gateway/processing nyata (larangan protokol eksplisit). Hanya dapat diajukan terhadap Service
 * Order berstatus `fulfilled` milik vendor yang sama (guard isolasi, mencegah submit invoice atas nama
 * vendor lain).
 */
export const getSupplierInvoicesByServiceOrder = (serviceOrderId: string) => SUPPLIER_INVOICES
  .filter(inv => inv.serviceOrderId === serviceOrderId)
  .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
export const getSupplierInvoicesByVendor = (vendorId: string) => SUPPLIER_INVOICES
  .filter(inv => inv.vendorId === vendorId)
  .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))

export function submitSupplierInvoice (input: { serviceOrderId: string; vendorId: string; amountIdr: number; note?: string }): SupplierInvoice | undefined {
  const so = getServiceOrderById(input.serviceOrderId)
  if (!so || so.status !== 'fulfilled' || so.vendorId !== input.vendorId || input.amountIdr <= 0) { return undefined }
  const invoice: SupplierInvoice = { id: nextSequentialId('SINV-', SUPPLIER_INVOICES), status: 'submitted', submittedAt: DEMO_REFERENCE_DATE, ...input }
  SUPPLIER_INVOICES.push(invoice)
  return invoice
}

/** Review internal (`procurement`/`finance`) — `approved`/`rejected` bersifat terminal, `reviewNote` wajib untuk `rejected`. */
export function reviewSupplierInvoice (id: string, newStatus: SupplierInvoiceStatus, actorId: string, reviewNote?: string): SupplierInvoice | undefined {
  const invoice = SUPPLIER_INVOICES.find(inv => inv.id === id)
  if (!invoice || invoice.status === 'approved' || invoice.status === 'rejected') { return undefined }
  if (newStatus === 'rejected' && !reviewNote?.trim()) { return undefined }
  invoice.status = newStatus
  invoice.reviewedAt = DEMO_REFERENCE_DATE
  invoice.reviewedBy = actorId
  if (reviewNote) { invoice.reviewNote = reviewNote.trim() }
  return invoice
}

/**
 * "Procurement performance review" (Wajib) — DERIVASI murni dari `RFQ`/`RFQInvitation`/`RFQResponse`/
 * `ServiceOrder` existing, BUKAN field tersimpan yang bisa stale (pola sama `getCostSheetBreakdown`/
 * `getMiceBoqTotals`). "On-time %" DISEDERHANAKAN sebagai rasio Service Order yang mencapai status
 * `fulfilled` terhadap seluruh Service Order milik vendor tsb — `ServiceOrder` TIDAK memiliki field
 * due-date terpisah untuk dibandingkan dengan `fulfilledAt` aktual (keputusan didokumentasikan D-074,
 * bukan gap tersembunyi/fabrikasi mesin bisnis, D-006).
 */
export interface VendorProcurementPerformance {
  vendorId: string
  rfqInvitedCount: number
  rfqRespondedCount: number
  rfqWinCount: number
  winRatePercent?: number
  avgResponseDays?: number
  serviceOrderCount: number
  fulfilledServiceOrderCount: number
  onTimeFulfillmentPercent?: number
  quotationHistory: RFQResponse[]
}

export function getVendorProcurementPerformance (vendorId: string): VendorProcurementPerformance {
  const invitations = RFQ_INVITATIONS.filter(inv => inv.vendorId === vendorId)
  const responses = RFQ_RESPONSES.filter(resp => resp.vendorId === vendorId)
  const wins = responses.filter(resp => resp.status === 'selected')

  const responseDurations = responses
    .map((resp) => {
      const invitation = invitations.find(inv => inv.rfqId === resp.rfqId)
      if (!invitation) { return undefined }
      const days = (new Date(resp.submittedAt).getTime() - new Date(invitation.invitedAt).getTime()) / (1000 * 60 * 60 * 24)
      return days >= 0 ? days : undefined
    })
    .filter((days): days is number => days !== undefined)

  const serviceOrders = SERVICE_ORDERS.filter(so => so.vendorId === vendorId)
  const fulfilled = serviceOrders.filter(so => so.status === 'fulfilled')

  return {
    vendorId,
    rfqInvitedCount: invitations.length,
    rfqRespondedCount: responses.length,
    rfqWinCount: wins.length,
    winRatePercent: responses.length ? Math.round((wins.length / responses.length) * 100) : undefined,
    avgResponseDays: responseDurations.length ? Math.round((responseDurations.reduce((sum, d) => sum + d, 0) / responseDurations.length) * 10) / 10 : undefined,
    serviceOrderCount: serviceOrders.length,
    fulfilledServiceOrderCount: fulfilled.length,
    onTimeFulfillmentPercent: serviceOrders.length ? Math.round((fulfilled.length / serviceOrders.length) * 100) : undefined,
    quotationHistory: [...responses].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
  }
}

/** Seluruh vendor yang punya aktivitas RFQ atau Service Order — dipakai `/procurement/performance`. */
export function getVendorsWithProcurementActivity (): Vendor[] {
  const ids = new Set<string>([
    ...RFQ_INVITATIONS.map(inv => inv.vendorId),
    ...SERVICE_ORDERS.map(so => so.vendorId)
  ])
  return VENDORS.filter(vendor => ids.has(vendor.id))
}

/**
 * Changes, Cancellation, Refund dan Incident (Section 19 — roadmap Section 00–24 baru, D-076). Fully
 * additive di atas `FlightBooking`/`HotelBooking`/`TransportBooking`/`MiceEvent` (Section 13-16),
 * `Invoice`/`Payment` (Foundation), dan `ActivityEntry`/`createChangeEntry`/`approveChangeEntry`/
 * `rejectChangeEntry` (Section 14 lama) — lihat `app/types/change-incident.ts` untuk rasional lengkap.
 */

export const getChangeRequestById = (id: string) => CHANGE_REQUESTS.find(item => item.id === id)
export const getChangeRequestsByProject = (projectId: string) => CHANGE_REQUESTS
  .filter(item => item.projectId === projectId)
  .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))

export interface CreateChangeRequestInput {
  projectId: string
  source: ChangeRequestSource
  requestedBy: string
  affectedEntities?: AffectedEntityRef[]
  beforeSummary: string
  afterSummary: string
  operationalImpact?: string
  commercialImpactIdr?: number
  financialImpactNote?: string
  timelineImpactNote?: string
  linkedQuotationId?: string
  /** Kategori dampak untuk `ActivityEntry` yang otomatis dibuat (Section 14 lama) — default `'other'`. */
  category?: ChangeCategory
}

/** Membuat `ChangeRequest` BARU sekaligus `ActivityEntry` (`createChangeEntry`, Section 14 lama) agar audit trail project tetap satu sumber kebenaran (D-076) — TIDAK PERNAH membuat log terpisah/kedua. */
export function createChangeRequest (input: CreateChangeRequestInput): ChangeRequest {
  const entry = createChangeEntry({
    projectId: input.projectId,
    category: input.category ?? 'other',
    reason: `${input.beforeSummary} → ${input.afterSummary}`,
    requestedBy: input.requestedBy,
    beforeValue: input.beforeSummary,
    afterValue: input.afterSummary,
    impactNote: input.operationalImpact
  })

  const request: ChangeRequest = {
    id: nextSequentialId('CR-', CHANGE_REQUESTS),
    projectId: input.projectId,
    source: input.source,
    requestedBy: input.requestedBy,
    submittedAt: DEMO_REFERENCE_DATE,
    affectedEntities: input.affectedEntities ?? [],
    beforeSummary: input.beforeSummary,
    afterSummary: input.afterSummary,
    operationalImpact: input.operationalImpact,
    commercialImpactIdr: input.commercialImpactIdr,
    financialImpactNote: input.financialImpactNote,
    timelineImpactNote: input.timelineImpactNote,
    status: 'submitted',
    linkedQuotationId: input.linkedQuotationId,
    activityEntryId: entry.id
  }
  CHANGE_REQUESTS.push(request)
  return request
}

const CHANGE_REQUEST_TRANSITIONS: Record<ChangeRequestStatus, ChangeRequestStatus[]> = {
  submitted: ['under-review', 'approved', 'rejected'],
  'under-review': ['approved', 'rejected'],
  approved: ['implemented'],
  rejected: [],
  implemented: []
}

export function getChangeRequestStatusTransitions (current: ChangeRequestStatus): ChangeRequestStatus[] {
  return CHANGE_REQUEST_TRANSITIONS[current] ?? []
}

/** Dipanggil hanya dari UI yang sudah memfilter `canApprove('project')` (Management/Super Admin — pola sama Section 14 lama `approveChangeEntry`, BUKAN rank modul `changes`). */
export function approveChangeRequest (requestId: string, approverId: string): ChangeRequest | undefined {
  const request = getChangeRequestById(requestId)
  if (!request || !getChangeRequestStatusTransitions(request.status).includes('approved')) { return undefined }
  request.status = 'approved'
  request.approvedBy = approverId
  request.approvedAt = DEMO_REFERENCE_DATE
  if (request.activityEntryId) { approveChangeEntry(request.activityEntryId, approverId) }
  // Hook Section 21 (D-078, CI-051, hook #3a) — keputusan approval memicu Notification type 'change' ke pengaju.
  pushNotification(request.requestedBy, 'change', `Change Request ${request.id} disetujui`, `${request.beforeSummary} → ${request.afterSummary} telah disetujui.`, 'change-request', request.id)
  return request
}

/** Alasan wajib (pola sama `updateFlightBookingStatus` dkk., D-070/D-071/D-072). */
export function rejectChangeRequest (requestId: string, approverId: string, reason: string): ChangeRequest | undefined {
  const request = getChangeRequestById(requestId)
  if (!request || !reason.trim() || !getChangeRequestStatusTransitions(request.status).includes('rejected')) { return undefined }
  request.status = 'rejected'
  request.approvedBy = approverId
  request.approvedAt = DEMO_REFERENCE_DATE
  request.rejectionReason = reason.trim()
  if (request.activityEntryId) { rejectChangeEntry(request.activityEntryId, approverId) }
  // Hook Section 21 (D-078, CI-051, hook #3b) — keputusan penolakan memicu Notification type 'change' ke pengaju.
  pushNotification(request.requestedBy, 'change', `Change Request ${request.id} ditolak`, `${request.beforeSummary} → ${request.afterSummary} ditolak. Alasan: ${request.rejectionReason}`, 'change-request', request.id)
  return request
}

export function markChangeRequestUnderReview (requestId: string, actorId: string): ChangeRequest | undefined {
  const request = getChangeRequestById(requestId)
  if (!request || !getChangeRequestStatusTransitions(request.status).includes('under-review')) { return undefined }
  request.status = 'under-review'
  ACTIVITIES.push({
    id: nextSequentialId('ACT-', ACTIVITIES),
    projectId: request.projectId,
    message: `Change Request ${request.id} sedang direview oleh ${getUserById(actorId)?.name ?? actorId}.`,
    isChange: false,
    reviewed: true,
    createdAt: DEMO_REFERENCE_DATE
  })
  return request
}

export function markChangeRequestImplemented (requestId: string, actorId: string): ChangeRequest | undefined {
  const request = getChangeRequestById(requestId)
  if (!request || !getChangeRequestStatusTransitions(request.status).includes('implemented')) { return undefined }
  request.status = 'implemented'
  ACTIVITIES.push({
    id: nextSequentialId('ACT-', ACTIVITIES),
    projectId: request.projectId,
    message: `Change Request ${request.id} telah diimplementasikan oleh ${getUserById(actorId)?.name ?? actorId}.`,
    isChange: false,
    reviewed: true,
    createdAt: DEMO_REFERENCE_DATE
  })
  return request
}

/**
 * `CancellationRecord` — lapisan penalty-tracking SERAGAM lintas 4 tipe booking (Wajib), dibuat ADITIF dari
 * hook UI-level di halaman detail booking masing-masing domain (`app/pages/ticketing/[id]/index.vue` dkk.)
 * begitu status berpindah ke cancel-equivalent — TIDAK mengubah guard/transition-map/reason-wajib
 * `update*BookingStatus` existing (LOCKED).
 */
export const getCancellationRecordById = (id: string) => CANCELLATION_RECORDS.find(item => item.id === id)
export const getCancellationRecordsByProject = (projectId: string) => CANCELLATION_RECORDS
  .filter(item => item.projectId === projectId)
  .sort((a, b) => b.cancelledAt.localeCompare(a.cancelledAt))
export const getCancellationRecordByBooking = (bookingType: BookingDomain, bookingId: string) => CANCELLATION_RECORDS
  .find(item => item.bookingType === bookingType && item.bookingId === bookingId)

export interface CreateCancellationRecordInput {
  projectId: string
  bookingType: BookingDomain
  bookingId: string
  reason: string
  penaltyIdr?: number
  cancelledBy: string
  refundEligible: boolean
}

export function createCancellationRecord (input: CreateCancellationRecordInput): CancellationRecord {
  const record: CancellationRecord = {
    id: nextSequentialId('CNX-', CANCELLATION_RECORDS),
    projectId: input.projectId,
    bookingType: input.bookingType,
    bookingId: input.bookingId,
    reason: input.reason,
    penaltyIdr: input.penaltyIdr,
    cancelledAt: DEMO_REFERENCE_DATE,
    cancelledBy: input.cancelledBy,
    refundEligible: input.refundEligible
  }
  CANCELLATION_RECORDS.push(record)
  const actor = getUserById(input.cancelledBy)
  ACTIVITIES.push({
    id: nextSequentialId('ACT-', ACTIVITIES),
    projectId: input.projectId,
    message: `${BOOKING_DOMAIN_LABEL[input.bookingType]} Booking ${input.bookingId} dibatalkan oleh ${actor?.name ?? input.cancelledBy}.${input.penaltyIdr ? ` Penalty: ${formatCurrencyIdr(input.penaltyIdr)}.` : ' Tidak ada penalty.'}`,
    isChange: false,
    reviewed: true,
    createdAt: DEMO_REFERENCE_DATE
  })
  return record
}

/**
 * `RefundRequest` — SENGAJA self-contained, TIDAK menyentuh `Invoice`/`Payment` (Section 20 baru masih
 * PARTIAL — `docs/frontend-known-issues.md` bagian 15, forward dependency eksplisit). `creditStatus` field
 * mock murni, BUKAN integrasi `CreditNote` nyata.
 */
export const getRefundRequestById = (id: string) => REFUND_REQUESTS.find(item => item.id === id)
export const getRefundRequestsByProject = (projectId: string) => REFUND_REQUESTS
  .filter(item => item.projectId === projectId)
  .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt))

export interface CreateRefundRequestInput {
  projectId: string
  cancellationId?: string
  invoiceId?: string
  type: 'partial' | 'full'
  amountIdr: number
  requestedBy: string
}

export function createRefundRequest (input: CreateRefundRequestInput): RefundRequest {
  const request: RefundRequest = {
    id: nextSequentialId('REF-', REFUND_REQUESTS),
    projectId: input.projectId,
    cancellationId: input.cancellationId,
    invoiceId: input.invoiceId,
    type: input.type,
    amountIdr: input.amountIdr,
    status: 'requested',
    requestedAt: DEMO_REFERENCE_DATE,
    requestedBy: input.requestedBy,
    creditStatus: 'pending'
  }
  REFUND_REQUESTS.push(request)
  const actor = getUserById(input.requestedBy)
  ACTIVITIES.push({
    id: nextSequentialId('ACT-', ACTIVITIES),
    projectId: input.projectId,
    message: `Refund Request ${request.id} (${input.type === 'full' ? 'penuh' : 'sebagian'}, ${formatCurrencyIdr(input.amountIdr)}) diajukan oleh ${actor?.name ?? input.requestedBy}.`,
    isChange: false,
    reviewed: true,
    createdAt: DEMO_REFERENCE_DATE
  })
  return request
}

const REFUND_REQUEST_TRANSITIONS: Record<RefundRequestStatus, RefundRequestStatus[]> = {
  requested: ['under-review', 'approved', 'rejected'],
  'under-review': ['approved', 'rejected'],
  approved: ['processed'],
  rejected: [],
  processed: []
}

export function getRefundRequestStatusTransitions (current: RefundRequestStatus): RefundRequestStatus[] {
  return REFUND_REQUEST_TRANSITIONS[current] ?? []
}

/**
 * Reason wajib untuk `rejected` (pola sama `ChangeRequest`/section lain). `creditStatus` otomatis mengikuti:
 * `processed` → `issued`, `rejected` → `not-applicable`.
 *
 * **Hook Section 20 (D-077, satu-satunya touch point yang diizinkan eksplisit ke fungsi Section 19 ini)** —
 * begitu status mencapai `processed` DAN `request.invoiceId` terisi, `issueCreditNote` (Section 20) turut
 * dipanggil untuk menerbitkan `CreditNote` NYATA ke Finance — menutup forward dependency eksplisit yang
 * didokumentasikan D-076/`docs/frontend-known-issues.md` bagian 15 ("RefundRequest.creditStatus MOCK
 * self-contained, belum terintegrasi ke CreditNote nyata"). Guard/transition-map/reason-wajib existing DI
 * ATAS TIDAK diubah — hook ini murni ADITIF setelah `request.status`/`creditStatus` sudah di-set.
 */
export function updateRefundRequestStatus (requestId: string, newStatus: RefundRequestStatus, actorId: string, reason?: string): RefundRequest | undefined {
  const request = getRefundRequestById(requestId)
  if (!request || !getRefundRequestStatusTransitions(request.status).includes(newStatus)) { return undefined }
  if (newStatus === 'rejected' && !reason?.trim()) { return undefined }

  const fromLabel = request.status
  request.status = newStatus
  if (newStatus === 'approved') { request.approvedBy = actorId; request.approvedAt = DEMO_REFERENCE_DATE }
  if (newStatus === 'rejected') { request.approvedBy = actorId; request.approvedAt = DEMO_REFERENCE_DATE; request.rejectionReason = reason!.trim(); request.creditStatus = 'not-applicable' }
  if (newStatus === 'processed') {
    request.creditStatus = 'issued'
    if (request.invoiceId) {
      issueCreditNote({
        invoiceId: request.invoiceId,
        amountIdr: request.amountIdr,
        reason: `Refund processed: ${request.id}`,
        refundRequestId: request.id
      })
    }
  }

  const actor = getUserById(actorId)
  ACTIVITIES.push({
    id: nextSequentialId('ACT-', ACTIVITIES),
    projectId: request.projectId,
    message: `Refund Request ${request.id} status diubah dari "${fromLabel}" menjadi "${newStatus}" oleh ${actor?.name ?? actorId}.${reason ? ` Alasan: ${reason}` : ''}`,
    isChange: false,
    reviewed: true,
    createdAt: DEMO_REFERENCE_DATE
  })
  return request
}

/**
 * `Incident` — severity/owner/escalation/communication/resolution (Wajib). Dapat berupa project-level
 * (`bookingId` kosong) atau tertaut ke satu booking spesifik lintas 4 domain.
 */
export const getIncidentById = (id: string) => INCIDENTS.find(item => item.id === id)
export const getIncidentsByProject = (projectId: string) => INCIDENTS
  .filter(item => item.projectId === projectId)
  .sort((a, b) => (b.resolvedAt ?? '9999').localeCompare(a.resolvedAt ?? '9999'))
export const getAllIncidents = () => INCIDENTS
/** Exception queue Incident (dipakai `/changes`) — belum `resolved`/`closed`. */
export const getOpenIncidentQueue = () => INCIDENTS.filter(item => item.status !== 'resolved' && item.status !== 'closed')

export interface CreateIncidentInput {
  projectId: string
  bookingType?: BookingDomain
  bookingId?: string
  title: string
  description: string
  severity: IncidentSeverity
  ownerId: string
}

export function createIncident (input: CreateIncidentInput): Incident {
  const incident: Incident = {
    id: nextSequentialId('INC-', INCIDENTS),
    projectId: input.projectId,
    bookingType: input.bookingType,
    bookingId: input.bookingId,
    title: input.title,
    description: input.description,
    severity: input.severity,
    ownerId: input.ownerId,
    status: 'open',
    communicationLog: []
  }
  INCIDENTS.push(incident)
  ACTIVITIES.push({
    id: nextSequentialId('ACT-', ACTIVITIES),
    projectId: input.projectId,
    message: `Incident ${incident.id} dicatat: "${input.title}" (severity ${input.severity}) oleh ${getUserById(input.ownerId)?.name ?? input.ownerId}.`,
    isChange: false,
    reviewed: true,
    createdAt: DEMO_REFERENCE_DATE
  })
  return incident
}

const INCIDENT_TRANSITIONS: Record<IncidentStatus, IncidentStatus[]> = {
  open: ['investigating', 'escalated', 'resolved'],
  investigating: ['escalated', 'resolved'],
  escalated: ['investigating', 'resolved'],
  resolved: ['closed'],
  closed: []
}

export function getIncidentStatusTransitions (current: IncidentStatus): IncidentStatus[] {
  return INCIDENT_TRANSITIONS[current] ?? []
}

/** Transisi status umum (bukan escalate/resolve — keduanya punya mutator sendiri karena butuh field tambahan). */
export function updateIncidentStatus (incidentId: string, newStatus: IncidentStatus, actorId: string): Incident | undefined {
  const incident = getIncidentById(incidentId)
  if (!incident || !getIncidentStatusTransitions(incident.status).includes(newStatus)) { return undefined }
  const fromLabel = incident.status
  incident.status = newStatus
  const actor = getUserById(actorId)
  ACTIVITIES.push({
    id: nextSequentialId('ACT-', ACTIVITIES),
    projectId: incident.projectId,
    message: `Incident ${incident.id} status diubah dari "${fromLabel}" menjadi "${newStatus}" oleh ${actor?.name ?? actorId}.`,
    isChange: false,
    reviewed: true,
    createdAt: DEMO_REFERENCE_DATE
  })
  return incident
}

export function escalateIncident (incidentId: string, escalatedTo: string, actorId: string, note?: string): Incident | undefined {
  const incident = getIncidentById(incidentId)
  if (!incident || !getIncidentStatusTransitions(incident.status).includes('escalated')) { return undefined }
  incident.status = 'escalated'
  incident.escalatedTo = escalatedTo
  const actor = getUserById(actorId)
  const target = getUserById(escalatedTo)
  incident.communicationLog.push({
    id: `${incident.id}-COM-${incident.communicationLog.length + 1}`,
    at: DEMO_REFERENCE_DATE,
    from: actorId,
    message: `Dieskalasi ke ${target?.name ?? escalatedTo} oleh ${actor?.name ?? actorId}.${note ? ` Catatan: ${note}` : ''}`
  })
  ACTIVITIES.push({
    id: nextSequentialId('ACT-', ACTIVITIES),
    projectId: incident.projectId,
    message: `Incident ${incident.id} dieskalasi ke ${target?.name ?? escalatedTo} oleh ${actor?.name ?? actorId}.`,
    isChange: false,
    reviewed: true,
    createdAt: DEMO_REFERENCE_DATE
  })
  // Hook Section 21 (D-078, CI-051, hook #2) — eskalasi memicu Notification type 'escalation' ke target eskalasi.
  pushNotification(escalatedTo, 'escalation', `Incident ${incident.id} dieskalasi kepada Anda`, `${incident.title} dieskalasi oleh ${actor?.name ?? actorId}.${note ? ` Catatan: ${note}` : ''}`, 'incident', incident.id)
  return incident
}

/** "Communication" (Wajib) — log narasi murni (mock, D-006), tidak mengubah `status`. */
export function appendIncidentCommunication (incidentId: string, fromUserId: string, message: string): Incident | undefined {
  const incident = getIncidentById(incidentId)
  if (!incident || !message.trim()) { return undefined }
  const entry: IncidentCommunicationEntry = { id: `${incident.id}-COM-${incident.communicationLog.length + 1}`, at: DEMO_REFERENCE_DATE, from: fromUserId, message: message.trim() }
  incident.communicationLog.push(entry)
  return incident
}

/** Resolution note wajib (pola sama alasan wajib transisi destruktif section lain). */
export function resolveIncident (incidentId: string, resolutionNote: string, actorId: string): Incident | undefined {
  const incident = getIncidentById(incidentId)
  if (!incident || !resolutionNote.trim() || !getIncidentStatusTransitions(incident.status).includes('resolved')) { return undefined }
  incident.status = 'resolved'
  incident.resolutionNote = resolutionNote.trim()
  incident.resolvedAt = DEMO_REFERENCE_DATE
  const actor = getUserById(actorId)
  ACTIVITIES.push({
    id: nextSequentialId('ACT-', ACTIVITIES),
    projectId: incident.projectId,
    message: `Incident ${incident.id} diselesaikan oleh ${actor?.name ?? actorId}. Resolusi: ${incident.resolutionNote}`,
    isChange: false,
    reviewed: true,
    createdAt: DEMO_REFERENCE_DATE
  })
  return incident
}

/**
 * Documents, Communication dan Notifications (Section 21 — roadmap Section 00–24 baru, D-078). Fully
 * additive di atas `ProjectDocument`/`getDocumentsByProject`/`getDocumentsByParty` (Section 14 lama/Prompt
 * 19, `app/types/activity.ts`) dan `VendorDocument` (Section 17, `app/types/vendor.ts`) — TIDAK satu pun
 * dari ketiganya diubah shape/perilakunya. Lihat `app/types/document-comms.ts` untuk rasional arsitektur
 * lengkap dan `docs/mockup-change-impact-log.md` CI-051 untuk daftar hook point cross-section.
 */

/* --- Documents --- */
export const getDocumentById = (id: string) => DOCUMENT_RECORDS.find(item => item.id === id)
export const getDocumentsByEntity = (entityType: DocumentEntityType, entityId: string) =>
  DOCUMENT_RECORDS.filter(item => item.entityType === entityType && item.entityId === entityId)

/**
 * Union dokumen baru (`Document`, Section 21) DENGAN dokumen lama (`ProjectDocument` via
 * `getDocumentsByProject`, Section 14 lama) untuk satu project — TIDAK menggantikan/menghapus data lama,
 * murni menggabungkan view (pola sama `getDocumentsByParty`, Prompt 19, yang juga hanya menggabungkan).
 * Dokumen legacy diberi `category: 'Legacy'`/`accessLevel: 'internal'`/`version: 1` sebagai default tampilan
 * yang wajar (field tsb tidak ada di `ProjectDocument` asli).
 */
export function getDocumentsForProject (projectId: string): Document[] {
  const newDocs = DOCUMENT_RECORDS.filter(item => item.projectId === projectId)
  const legacyDocs: Document[] = getDocumentsByProject(projectId).map(legacy => ({
    id: legacy.id,
    entityType: 'project' as DocumentEntityType,
    entityId: projectId,
    projectId,
    name: legacy.name,
    category: 'Legacy',
    version: 1,
    uploadedAt: legacy.uploadedAt,
    accessLevel: 'internal' as DocumentAccessLevel,
    sourceType: 'uploaded' as const
  }))
  return [...newDocs, ...legacyDocs].sort((a, b) => (b.uploadedAt ?? b.generatedAt ?? '').localeCompare(a.uploadedAt ?? a.generatedAt ?? ''))
}

export interface CreateDocumentInput {
  entityType: DocumentEntityType
  entityId: string
  projectId?: string
  name: string
  category: string
  accessLevel: DocumentAccessLevel
  expiresAt?: string
  uploadedBy?: string
}

/** Upload mock (Wajib "Categories, versions, expiry, access level") — `sourceType` selalu `'uploaded'` (dokumen `'generated'` HANYA dibuat lewat 9 halaman preview existing, tidak lewat form ini). */
export function createDocument (input: CreateDocumentInput): Document {
  const document: Document = {
    id: nextSequentialId('DOC-C', DOCUMENT_RECORDS),
    entityType: input.entityType,
    entityId: input.entityId,
    projectId: input.projectId,
    name: input.name,
    category: input.category,
    version: 1,
    uploadedAt: DEMO_REFERENCE_DATE,
    expiresAt: input.expiresAt,
    accessLevel: input.accessLevel,
    sourceType: 'uploaded',
    uploadedBy: input.uploadedBy
  }
  DOCUMENT_RECORDS.push(document)
  return document
}

/* --- Messages --- */
export const getMessageById = (id: string) => MESSAGE_RECORDS.find(item => item.id === id)
export const getMessagesByEntity = (entityType: DocumentEntityType, entityId: string) =>
  MESSAGE_RECORDS.filter(item => item.entityType === entityType && item.entityId === entityId)
    .sort((a, b) => a.sentAt.localeCompare(b.sentAt))

export interface SendMessageInput {
  entityType: DocumentEntityType
  entityId: string
  projectId?: string
  channel: MessageChannel
  senderId: string
  body: string
  mentions?: string[]
  deliveryChannel?: 'email' | 'whatsapp'
}

/**
 * Mengirim pesan baru (Wajib "Internal notes, client messages, supplier messages" + "Email/WhatsApp delivery
 * status simulation tanpa klaim integrasi"). Settle DETERMINISTIK ke status akhir (bukan tetap `queued` yang
 * memerlukan fake async timer, D-006) — `internal-note` selalu `sent` (tidak ada channel eksternal),
 * `client-message`/`supplier-message` selalu `delivered` via `deliveryChannel` (default `email`). Skenario
 * `failed`/`queued` didemokan lewat fixture seed (`MSG-003`/`MSG-008`), bukan dari jalur create ini — pola
 * sama preseden `Quotation.sentToClientAt` (Section 05, satu timestamp flip deterministik). Bila `mentions`
 * terisi, `pushNotification` type `mention` dikirim ke tiap user yang di-mention (hook kurasi #1, CI-051).
 */
export function sendMessage (input: SendMessageInput): Message {
  const message: Message = {
    id: nextSequentialId('MSG-', MESSAGE_RECORDS),
    entityType: input.entityType,
    entityId: input.entityId,
    projectId: input.projectId,
    channel: input.channel,
    senderId: input.senderId,
    body: input.body,
    mentions: input.mentions,
    sentAt: DEMO_REFERENCE_DATE,
    deliveryStatus: input.channel === 'internal-note' ? 'sent' : 'delivered',
    deliveryChannel: input.channel === 'internal-note' ? undefined : (input.deliveryChannel ?? 'email')
  }
  MESSAGE_RECORDS.push(message)

  const sender = getUserById(input.senderId)
  for (const mentionedUserId of input.mentions ?? []) {
    pushNotification(mentionedUserId, 'mention', `Anda disebut oleh ${sender?.name ?? input.senderId}`, message.body, input.entityType, input.entityId)
  }

  return message
}

/* --- Notifications --- */
export const getNotificationById = (id: string) => NOTIFICATION_RECORDS.find(item => item.id === id)
export const getNotificationsForUser = (userId: string) =>
  NOTIFICATION_RECORDS.filter(item => item.userId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
export const getUnreadNotificationCount = (userId: string) =>
  NOTIFICATION_RECORDS.filter(item => item.userId === userId && !item.read).length

export function markNotificationRead (id: string): Notification | undefined {
  const notification = getNotificationById(id)
  if (!notification) { return undefined }
  notification.read = true
  return notification
}

export function markAllNotificationsRead (userId: string): void {
  NOTIFICATION_RECORDS.filter(item => item.userId === userId).forEach((item) => { item.read = true })
}

export function removeNotification (id: string): void {
  const index = NOTIFICATION_RECORDS.findIndex(item => item.id === id)
  if (index !== -1) { NOTIFICATION_RECORDS.splice(index, 1) }
}

/**
 * Helper mutator pusat (Wajib "Mentions, assignments, reminders, escalation") — dipanggil HANYA dari titik
 * pemicu KURASI (bukan seluruh mutator lintas codebase, preseden D-075 "representatif, bukan menyeluruh").
 * Lihat `docs/mockup-change-impact-log.md` CI-051 untuk daftar 4 hook point yang diizinkan eksplisit di
 * section ini (`sendMessage` mentions, `escalateIncident`, `approveChangeRequest`/`rejectChangeRequest`,
 * `createProjectTask`/`updateProjectTask`).
 */
export function pushNotification (userId: string, type: NotificationType, title: string, body: string, entityType?: DocumentEntityType, entityId?: string): Notification {
  const notification: Notification = {
    id: nextSequentialId('NOT-', NOTIFICATION_RECORDS),
    userId,
    type,
    title,
    body,
    entityType,
    entityId,
    createdAt: DEMO_REFERENCE_DATE,
    read: false
  }
  NOTIFICATION_RECORDS.push(notification)
  return notification
}

/**
 * "Unified activity timeline dengan filtering akses" (Wajib) — derived view-model, pola sama
 * `getBookingTimeline` (D-075)/`getServiceReadinessMatrix` (Section 12), BUKAN entitas tersimpan. Untuk
 * `entityType === 'project'`, Document/Message diagregasi lewat `projectId` (bukan hanya `entityType:
 * 'project'` yang sempit — dokumen/pesan sub-entity seperti flight/hotel/transport/mice yang tertaut
 * `projectId` yang sama TETAP relevan untuk timeline project). Untuk entity lain, agregasi persis
 * `entityType`+`entityId`. `SystemEvent` (Prompt 19) SELALU `internalOnly: true` (log lintas-modul level
 * sistem, tidak pernah untuk konsumsi Client/Supplier). Acceptance literal "tidak bocor lintas role"
 * dipenuhi dengan memfilter `internalOnly` bila `viewerAccessLevel !== 'internal'`.
 */
export function getUnifiedActivityTimeline (entityType: DocumentEntityType, entityId: string, viewerAccessLevel: DocumentAccessLevel): UnifiedTimelineEntry[] {
  const entries: UnifiedTimelineEntry[] = []
  const isProjectScope = entityType === 'project'

  if (isProjectScope) {
    for (const activity of getActivitiesByProject(entityId)) {
      entries.push({
        id: activity.id,
        at: activity.createdAt,
        kind: 'activity',
        label: activity.isChange ? `Change${activity.category ? ` (${activity.category})` : ''}` : 'Activity',
        detail: activity.message,
        internalOnly: false
      })
    }
  }

  for (const event of SYSTEM_EVENTS.filter(item => item.entityId === entityId)) {
    entries.push({ id: event.id, at: event.createdAt, kind: 'system-event', label: event.type, detail: event.message, internalOnly: true })
  }

  const relevantDocuments = isProjectScope ? DOCUMENT_RECORDS.filter(doc => doc.projectId === entityId) : getDocumentsByEntity(entityType, entityId)
  for (const document of relevantDocuments) {
    entries.push({
      id: document.id,
      at: document.uploadedAt ?? document.generatedAt ?? '',
      kind: 'document',
      label: document.sourceType === 'generated' ? 'Dokumen Digenerate' : 'Dokumen Diunggah',
      detail: `${document.name} (${document.category})`,
      internalOnly: document.accessLevel === 'internal'
    })
  }

  const relevantMessages = isProjectScope ? MESSAGE_RECORDS.filter(msg => msg.projectId === entityId) : getMessagesByEntity(entityType, entityId)
  for (const message of relevantMessages) {
    entries.push({
      id: message.id,
      at: message.sentAt,
      kind: 'message',
      label: message.channel === 'internal-note' ? 'Internal Note' : message.channel === 'client-message' ? 'Client Message' : 'Supplier Message',
      detail: message.body,
      internalOnly: message.channel === 'internal-note'
    })
  }

  const filtered = viewerAccessLevel === 'internal' ? entries : entries.filter(entry => !entry.internalOnly)
  return filtered.sort((a, b) => a.at.localeCompare(b.at))
}

/**
 * Saved Views (Section 22 — Dashboards, Reports, Lead Recap dan Activity Center, D-079). Centralized
 * reactive mock state (BUKAN localStorage/sessionStorage — konsisten dengan seluruh fixture lain di
 * codebase). `applySavedView` HANYA mengembalikan `filters` tersimpan — pemanggil (halaman Dashboard/
 * Reports) yang bertanggung jawab menuliskannya kembali ke ref filter existing masing-masing, bukan
 * fungsi ini yang memutasi state halaman (data layer tidak boleh bergantung pada Vue ref komponen).
 */
export const getSavedViewsForUser = (userId: string, page: SavedViewPage) =>
  SAVED_VIEWS.filter(view => view.userId === userId && view.page === page).sort((a, b) => b.createdAt.localeCompare(a.createdAt))

export function createSavedView (input: { userId: string; page: SavedViewPage; label: string; filters: Record<string, string> }): SavedView {
  const view: SavedView = { id: nextSequentialId('SVW-', SAVED_VIEWS), createdAt: DEMO_REFERENCE_DATE, ...input }
  SAVED_VIEWS.push(view)
  return view
}

export function deleteSavedView (id: string): void {
  const index = SAVED_VIEWS.findIndex(view => view.id === id)
  if (index !== -1) { SAVED_VIEWS.splice(index, 1) }
}

export const applySavedView = (id: string): SavedView | undefined => SAVED_VIEWS.find(view => view.id === id)

/**
 * Section 23 — Administration, Master Data dan Audit (roadmap Section 00–24 baru, D-080). `pushSystemEvent`
 * adalah helper generik pertama yang benar-benar memutasi `SYSTEM_EVENTS` (sebelumnya didokumentasikan
 * sebagai "log statis", `app/utils/mock-reset.ts`) — pola identik `pushNotification` (Section 21) di atas.
 * Dipakai SELURUH mutator admin baru di bawah (master data create/edit/deactivate/reactivate, update
 * Organization Profile, suspend/reactivate user) — setiap aksi tulis admin non-project-scoped WAJIB
 * menghasilkan satu `SystemEvent` `module: 'administration'`, memenuhi "Audit trail search" (Wajib literal)
 * tanpa menciptakan entitas audit ketiga (menghormati D-076 "satu audit trail" untuk perubahan project-scoped
 * — `SystemEvent` sendiri sudah menjadi mekanisme terpisah sejak Prompt 19, bukan hal baru).
 */
function pushSystemEvent (type: string, message: string, entityId?: string, userId?: string): SystemEvent {
  const event: SystemEvent = { id: nextSequentialId('EVT-', SYSTEM_EVENTS), module: 'administration', type, message, entityId, userId, createdAt: DEMO_REFERENCE_DATE }
  SYSTEM_EVENTS.push(event)
  return event
}

/**
 * Master Data — registry generik (Section 23, D-080). Memetakan `MasterDataCategoryKey` ke array reactive
 * + prefix ID yang tepat, dipakai `createMasterDataRecord`/`updateMasterDataRecord`/`deactivateMasterDataRecord`/
 * `reactivateMasterDataRecord` di bawah. Opsi GENERIK (bukan 15×3 fungsi bernama-spesifik per kategori)
 * dipilih karena brief Section 23 secara eksplisit mengizinkan keduanya ("generic per-category, or
 * per-category-specific functions — your call") dan 15 kategori dengan shape berbeda-beda akan menghasilkan
 * ~45 fungsi thin-wrapper nyaris identik bila dibuat spesifik — generik lebih mudah diaudit/di-maintain
 * tanpa kehilangan type-safety di titik pemanggilan (page tetap mengimpor tipe spesifik per kategori untuk
 * form-nya masing-masing). 4 kategori pertama (`project-type`/`service-type`/`destination`/`vendor-category`)
 * adalah migrasi Section 17 lama (`MasterDataItem`, ID/label/description dipertahankan persis).
 */
type MasterDataRecordShape = { id: string; isActive: boolean } & Record<string, unknown>

const MASTER_DATA_REGISTRY: Record<MasterDataCategoryKey, { list: MasterDataRecordShape[]; prefix: string; label: string }> = {
  'project-type': { list: MASTER_PROJECT_TYPES as unknown as MasterDataRecordShape[], prefix: 'PT-', label: 'Tipe Project' },
  'service-type': { list: MASTER_SERVICE_TYPES as unknown as MasterDataRecordShape[], prefix: 'ST-', label: 'Tipe Layanan' },
  destination: { list: MASTER_DESTINATIONS as unknown as MasterDataRecordShape[], prefix: 'DST-', label: 'Destinasi' },
  'vendor-category': { list: MASTER_VENDOR_CATEGORIES as unknown as MasterDataRecordShape[], prefix: 'VC-', label: 'Kategori Vendor' },
  airport: { list: AIRPORTS as unknown as MasterDataRecordShape[], prefix: 'APT-', label: 'Airport' },
  airline: { list: AIRLINES as unknown as MasterDataRecordShape[], prefix: 'ALN-', label: 'Airline' },
  hotel: { list: MASTER_HOTELS as unknown as MasterDataRecordShape[], prefix: 'MHTL-', label: 'Hotel' },
  currency: { list: MASTER_CURRENCIES as unknown as MasterDataRecordShape[], prefix: 'CUR-', label: 'Currency' },
  'tax-rule': { list: TAX_RULES as unknown as MasterDataRecordShape[], prefix: 'TAX-', label: 'Tax Rule' },
  'payment-term': { list: PAYMENT_TERMS as unknown as MasterDataRecordShape[], prefix: 'PTM-', label: 'Payment Term' },
  'cancellation-rule': { list: CANCELLATION_RULES as unknown as MasterDataRecordShape[], prefix: 'CXR-', label: 'Cancellation Rule' },
  'numbering-scheme': { list: NUMBERING_SCHEMES as unknown as MasterDataRecordShape[], prefix: 'NUM-', label: 'Numbering Scheme' },
  'document-template': { list: DOCUMENT_TEMPLATES as unknown as MasterDataRecordShape[], prefix: 'DTPL-', label: 'Document Template' },
  'readiness-gate': { list: READINESS_GATE_CONFIGS as unknown as MasterDataRecordShape[], prefix: 'RGC-', label: 'Readiness Gate' },
  'assignment-rule': { list: ASSIGNMENT_RULES as unknown as MasterDataRecordShape[], prefix: 'ASR-', label: 'Assignment Rule' }
}

export function getMasterDataCategoryMeta (key: MasterDataCategoryKey) {
  return { label: MASTER_DATA_REGISTRY[key].label, list: MASTER_DATA_REGISTRY[key].list }
}

function masterDataRecordDisplayName (record: MasterDataRecordShape): string {
  return String(record.label ?? record.name ?? record.code ?? record.id)
}

export function createMasterDataRecord (key: MasterDataCategoryKey, input: Record<string, unknown>, actorId: string): MasterDataRecordShape {
  const entry = MASTER_DATA_REGISTRY[key]
  const record: MasterDataRecordShape = { id: nextSequentialId(entry.prefix, entry.list), isActive: true, ...input }
  entry.list.push(record)
  pushSystemEvent('master-data-created', `${entry.label} "${masterDataRecordDisplayName(record)}" ditambahkan`, record.id, actorId)
  return record
}

export function updateMasterDataRecord (key: MasterDataCategoryKey, id: string, patch: Record<string, unknown>, actorId: string): MasterDataRecordShape | undefined {
  const entry = MASTER_DATA_REGISTRY[key]
  const record = entry.list.find(item => item.id === id)
  if (!record) { return undefined }
  Object.assign(record, patch)
  pushSystemEvent('master-data-updated', `${entry.label} "${masterDataRecordDisplayName(record)}" diperbarui`, record.id, actorId)
  return record
}

export function deactivateMasterDataRecord (key: MasterDataCategoryKey, id: string, actorId: string): MasterDataRecordShape | undefined {
  const entry = MASTER_DATA_REGISTRY[key]
  const record = entry.list.find(item => item.id === id)
  if (!record) { return undefined }
  record.isActive = false
  pushSystemEvent('master-data-deactivated', `${entry.label} "${masterDataRecordDisplayName(record)}" dinonaktifkan`, record.id, actorId)
  return record
}

export function reactivateMasterDataRecord (key: MasterDataCategoryKey, id: string, actorId: string): MasterDataRecordShape | undefined {
  const entry = MASTER_DATA_REGISTRY[key]
  const record = entry.list.find(item => item.id === id)
  if (!record) { return undefined }
  record.isActive = true
  pushSystemEvent('master-data-reactivated', `${entry.label} "${masterDataRecordDisplayName(record)}" diaktifkan kembali`, record.id, actorId)
  return record
}

/**
 * "Historical snapshot warning ketika master berubah" (Wajib literal Section 23) — cek genuine SEDAPAT
 * MUNGKIN, JUJUR bila tidak feasible (kembalikan `null`, bukan angka fabrikasi — instruksi eksplisit "be
 * honest in the UI copy"). Genuine untuk 4 kategori yang punya cross-reference bersih: `currency` (exact
 * match `Invoice.currency`), `destination` (fuzzy match prefix nama kota terhadap `Project.destination`
 * bebas-teks — format tidak selalu identik persis, mis. "Abu Dhabi, UAE" vs "Abu Dhabi, Uni Emirat Arab"),
 * `project-type`/`service-type` (peta ID tetap→field typed `Project.characteristic`/`ProjectService.type`,
 * HANYA berlaku untuk 3/5 ID seed asli — record baru yang dibuat user lewat UI tidak punya sesuatu untuk
 * dipetakan, `null`). Kategori lain (`vendor-category` — `Vendor.category` bebas-teks TIDAK match label
 * secara andal, mis. "Flight Consolidator" vs "Maskapai / Airline"; `airport`/`airline`/`hotel`/`tax-rule`/
 * `payment-term`/`cancellation-rule`/`numbering-scheme`/`document-template`/`readiness-gate`/`assignment-rule`
 * — TIDAK ADA entitas existing yang menautkan ID-nya sama sekali, kategori-kategori ini genuinely baru
 * tanpa consumer) SENGAJA `null` — UI menampilkan peringatan generik, bukan angka yang mengarang.
 */
export function getMasterDataUsageCount (key: MasterDataCategoryKey, id: string): number | null {
  const entry = MASTER_DATA_REGISTRY[key]
  const record = entry.list.find(item => item.id === id)
  if (!record) { return 0 }

  if (key === 'currency') {
    return INVOICES.filter(invoice => invoice.currency === record.code).length
  }
  if (key === 'destination') {
    const city = String(record.label).split(',')[0].trim().toLowerCase()
    return PROJECTS.filter(project => project.destination.split(',')[0].trim().toLowerCase() === city).length
  }
  if (key === 'project-type') {
    const characteristicById: Record<string, string> = { 'PT-001': 'normal', 'PT-002': 'high-change', 'PT-003': 'complex' }
    const characteristic = characteristicById[id]
    return characteristic ? PROJECTS.filter(project => project.characteristic === characteristic).length : null
  }
  if (key === 'service-type') {
    const typeById: Record<string, string> = { 'ST-001': 'flight', 'ST-002': 'hotel', 'ST-003': 'transportation', 'ST-004': 'mice', 'ST-005': 'additional' }
    const serviceType = typeById[id]
    return serviceType ? PROJECT_SERVICES.filter(service => service.type === serviceType).length : null
  }
  // Kategori tanpa cross-reference bersih (lihat komentar di atas) — jujur, bukan fabrikasi.
  return null
}

/**
 * Organization Profile (Section 23, baru) — singleton, `Object.assign` in-place (pola sama `Object.assign`
 * partial-update entitas singleton lain di codebase ini, mis. `existing` di `submitRfqResponse`).
 * `updatedAt`/`updatedBy` SELALU ditulis ulang oleh mutator, tidak pernah oleh form langsung.
 */
export function updateOrganizationProfile (patch: Partial<Omit<OrganizationProfile, 'id' | 'updatedAt' | 'updatedBy'>>, actorId: string): OrganizationProfile {
  Object.assign(ORGANIZATION_PROFILE, patch, { updatedAt: DEMO_REFERENCE_DATE, updatedBy: actorId })
  pushSystemEvent('organization-profile-updated', `Profil Organisasi "${ORGANIZATION_PROFILE.displayName}" diperbarui`, ORGANIZATION_PROFILE.id, actorId)
  return ORGANIZATION_PROFILE
}

/**
 * User suspend/access review (Section 23, Wajib "Access review and suspended user state"). Alasan WAJIB
 * saat suspend (pola sama seluruh transisi destruktif lain di codebase ini, mis. `voidInvoice`/
 * `rejectChangeRequest`). `reactivateUser` mengosongkan `suspendedReason`/`suspendedAt` kembali.
 */
export function suspendUser (userId: string, reason: string, actorId: string): User | undefined {
  const user = USERS.find(item => item.id === userId)
  if (!user || !reason.trim()) { return undefined }
  user.status = 'suspended'
  user.suspendedReason = reason.trim()
  user.suspendedAt = DEMO_REFERENCE_DATE
  pushSystemEvent('user-suspended', `User ${user.name} (${user.email}) disuspend — ${reason.trim()}`, user.id, actorId)
  return user
}

export function reactivateUser (userId: string, actorId: string): User | undefined {
  const user = USERS.find(item => item.id === userId)
  if (!user) { return undefined }
  user.status = 'active'
  user.suspendedReason = undefined
  user.suspendedAt = undefined
  pushSystemEvent('user-reactivated', `User ${user.name} (${user.email}) diaktifkan kembali`, user.id, actorId)
  return user
}

/**
 * ============================================================================
 * Commodity Product / Variant / Availability / Requirement / Selection / Order
 * (Phase 1 — Client–Vendor Commodity, berdasarkan hasil audit Phase 0)
 * ============================================================================
 * Lihat `app/types/commodity.ts`, `availability.ts`, `requirement.ts`, `selection.ts`,
 * `commodity-order.ts` untuk definisi domain lengkap. Fungsi di bawah ini adalah SATU-SATUNYA titik
 * mutasi yang sah — jangan pernah memutasi array `COMMODITY_*`/`AVAILABILITY_SLOTS` langsung dari
 * komponen `.vue` (Phase 2+).
 */

// ---- Commodity Product ------------------------------------------------------

export function getCommodityProducts (): CommodityProduct[] {
  return COMMODITY_PRODUCTS
}

export function getCommodityProductById (id: string): CommodityProduct | undefined {
  return COMMODITY_PRODUCTS.find(item => item.id === id)
}

export function getCommodityProductsByVendor (vendorId: string): CommodityProduct[] {
  return COMMODITY_PRODUCTS.filter(item => item.vendorId === vendorId)
}

export function getCommodityVariantsByProduct (commodityProductId: string): CommodityVariant[] {
  return COMMODITY_VARIANTS.filter(item => item.commodityProductId === commodityProductId)
}

export function getCommodityVariantById (id: string): CommodityVariant | undefined {
  return COMMODITY_VARIANTS.find(item => item.id === id)
}

export interface CreateCommodityProductInput {
  vendorId: string
  name: string
  category: CommodityProduct['category']
  description?: string
  sellPriceIdr: number
  costPriceIdr?: number
}

export function createCommodityProduct (input: CreateCommodityProductInput): CommodityProduct {
  const product: CommodityProduct = {
    id: nextSequentialId('CMD-', COMMODITY_PRODUCTS),
    vendorId: input.vendorId,
    name: input.name,
    category: input.category,
    description: input.description,
    sellPriceIdr: input.sellPriceIdr,
    costPriceIdr: input.costPriceIdr,
    status: 'draft',
    createdAt: DEMO_REFERENCE_DATE
  }
  COMMODITY_PRODUCTS.push(product)
  return product
}

export type UpdateCommodityProductInput = Partial<Omit<CommodityProduct, 'id' | 'vendorId' | 'status' | 'createdAt'>>

export function updateCommodityProduct (id: string, patch: UpdateCommodityProductInput): CommodityProduct | undefined {
  const product = getCommodityProductById(id)
  if (!product) { return undefined }
  Object.assign(product, patch, { updatedAt: DEMO_REFERENCE_DATE })
  return product
}

export function createCommodityVariant (commodityProductId: string, name: string, sellPriceIdr?: number): CommodityVariant | undefined {
  if (!getCommodityProductById(commodityProductId)) { return undefined }
  const variant: CommodityVariant = {
    id: nextSequentialId('CMV-', COMMODITY_VARIANTS),
    commodityProductId,
    name,
    sellPriceIdr,
    createdAt: DEMO_REFERENCE_DATE
  }
  COMMODITY_VARIANTS.push(variant)
  return variant
}

export type UpdateCommodityVariantInput = Partial<Pick<CommodityVariant, 'name' | 'sellPriceIdr'>>

export function updateCommodityVariant (id: string, patch: UpdateCommodityVariantInput): CommodityVariant | undefined {
  const variant = getCommodityVariantById(id)
  if (!variant) { return undefined }
  Object.assign(variant, patch)
  return variant
}

/** Variant aman dihapus HANYA bila belum direferensikan `AvailabilitySlot`/`CommoditySelection` manapun (Phase 2, pola sama `isCommodityProductDeletable`). */
export function isCommodityVariantDeletable (id: string): boolean {
  const referenced = AVAILABILITY_SLOTS.some(slot => slot.variantId === id) ||
    COMMODITY_SELECTIONS.some(selection => selection.variantId === id)
  return !referenced
}

export function deleteCommodityVariant (id: string): boolean {
  if (!isCommodityVariantDeletable(id)) { return false }
  const index = COMMODITY_VARIANTS.findIndex(item => item.id === id)
  if (index === -1) { return false }
  COMMODITY_VARIANTS.splice(index, 1)
  return true
}

/** Draft boleh dihapus penuh HANYA bila belum pernah direferensikan `AvailabilitySlot`/`CommoditySelection` manapun (Phase 2 menegakkan ini di UI; Phase 1 menyediakan primitive-nya). */
export function isCommodityProductDeletable (id: string): boolean {
  const product = getCommodityProductById(id)
  if (!product || product.status !== 'draft') { return false }
  const referenced = AVAILABILITY_SLOTS.some(slot => slot.commodityProductId === id) ||
    COMMODITY_SELECTIONS.some(selection => selection.commodityProductId === id)
  return !referenced
}

/** Menghapus Commodity Product beserta seluruh Variant miliknya (cascade) — aman karena `isCommodityProductDeletable` sudah memastikan tidak ada Availability/Selection yang bergantung pada product ATAU variant manapun di bawahnya (dicek via `commodityProductId`, mencakup slot yang di-scope ke variant sekalipun). */
export function deleteCommodityProduct (id: string): boolean {
  if (!isCommodityProductDeletable(id)) { return false }
  const index = COMMODITY_PRODUCTS.findIndex(item => item.id === id)
  if (index === -1) { return false }
  COMMODITY_PRODUCTS.splice(index, 1)
  for (let i = COMMODITY_VARIANTS.length - 1; i >= 0; i--) {
    if (COMMODITY_VARIANTS[i].commodityProductId === id) { COMMODITY_VARIANTS.splice(i, 1) }
  }
  return true
}

/**
 * State transition — Commodity Product (Phase 0 Section 10). `available`/`limited`/`sold-out` HANYA
 * dicapai lewat `syncCommodityProductAvailabilityStatus` (derived dari Availability) — tidak ada UI yang
 * boleh memanggil `updateCommodityProductStatus` menuju ketiga status tsb secara manual.
 */
const COMMODITY_PRODUCT_STATUS_TRANSITIONS: Record<CommodityProductStatus, CommodityProductStatus[]> = {
  draft: ['published', 'archived'],
  published: ['available', 'limited', 'sold-out', 'suspended', 'expired', 'archived'],
  available: ['limited', 'sold-out', 'suspended', 'expired', 'archived'],
  limited: ['available', 'sold-out', 'suspended', 'expired', 'archived'],
  'sold-out': ['available', 'limited', 'suspended', 'expired', 'archived'],
  suspended: ['published', 'available', 'limited', 'sold-out', 'archived'],
  expired: ['archived'],
  archived: []
}

export function getCommodityProductStatusTransitions (currentStatus: CommodityProductStatus): CommodityProductStatus[] {
  return COMMODITY_PRODUCT_STATUS_TRANSITIONS[currentStatus] ?? []
}

export function updateCommodityProductStatus (id: string, newStatus: CommodityProductStatus): CommodityProduct | undefined {
  const product = getCommodityProductById(id)
  if (!product) { return undefined }
  if (!getCommodityProductStatusTransitions(product.status).includes(newStatus)) { return undefined }
  product.status = newStatus
  product.updatedAt = DEMO_REFERENCE_DATE
  return product
}

/** Threshold "limited" (Phase 1 default mock — heuristik, bukan aturan bisnis baku dari master spec). */
const COMMODITY_LIMITED_THRESHOLD = 3

/**
 * Menyelaraskan status Commodity Product dengan sisa Availability agregat (seluruh slot miliknya, lintas
 * variant) — HANYA berlaku bila status saat ini termasuk keluarga "live" (`published`/`available`/
 * `limited`/`sold-out`). `draft`/`archived`/`suspended`/`expired` TIDAK PERNAH disentuh fungsi ini.
 */
export function syncCommodityProductAvailabilityStatus (commodityProductId: string): CommodityProduct | undefined {
  const product = getCommodityProductById(commodityProductId)
  if (!product) { return undefined }
  const liveStatuses: CommodityProductStatus[] = ['published', 'available', 'limited', 'sold-out']
  if (!liveStatuses.includes(product.status)) { return product }
  const totalAvailable = getAvailabilitySlotsByCommodity(commodityProductId)
    .reduce((sum, slot) => sum + getAvailableQuantity(slot), 0)
  const nextStatus: CommodityProductStatus = totalAvailable <= 0
    ? 'sold-out'
    : totalAvailable <= COMMODITY_LIMITED_THRESHOLD ? 'limited' : 'available'
  product.status = nextStatus
  product.updatedAt = DEMO_REFERENCE_DATE
  return product
}

// ---- Availability Slot -------------------------------------------------------

/** Rumus baku Phase 0 Section 9 — SATU-SATUNYA cara membaca sisa stok, jangan pernah membaca field lain langsung. */
export function getAvailableQuantity (slot: AvailabilitySlot): number {
  return slot.totalQuantity - slot.heldQuantity - slot.bookedQuantity
}

export function getAvailabilitySlotById (id: string): AvailabilitySlot | undefined {
  return AVAILABILITY_SLOTS.find(item => item.id === id)
}

export function getAvailabilitySlotsByCommodity (commodityProductId: string): AvailabilitySlot[] {
  return AVAILABILITY_SLOTS.filter(slot => slot.commodityProductId === commodityProductId)
}

export interface CreateAvailabilitySlotInput {
  commodityProductId: string
  variantId?: string
  periodStart: string
  periodEnd: string
  totalQuantity: number
  bookingCutoff?: string
  blackoutDates?: string[]
}

export function createAvailabilitySlot (input: CreateAvailabilitySlotInput): AvailabilitySlot | undefined {
  if (!getCommodityProductById(input.commodityProductId)) { return undefined }
  if (input.totalQuantity < 0) { return undefined }
  const slot: AvailabilitySlot = {
    id: nextSequentialId('AVL-', AVAILABILITY_SLOTS),
    commodityProductId: input.commodityProductId,
    variantId: input.variantId,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    totalQuantity: input.totalQuantity,
    heldQuantity: 0,
    bookedQuantity: 0,
    bookingCutoff: input.bookingCutoff,
    blackoutDates: input.blackoutDates,
    createdAt: DEMO_REFERENCE_DATE
  }
  AVAILABILITY_SLOTS.push(slot)
  syncCommodityProductAvailabilityStatus(input.commodityProductId)
  return slot
}

/** Kapasitas tidak dapat dikurangi di bawah `bookedQuantity` yang sudah terbentuk (ditegakkan di sini, bukan hanya di UI Phase 2). */
export function updateAvailabilitySlotTotal (slotId: string, totalQuantity: number): AvailabilitySlot | undefined {
  const slot = getAvailabilitySlotById(slotId)
  if (!slot) { return undefined }
  if (totalQuantity < 0 || totalQuantity < slot.bookedQuantity) { return undefined }
  slot.totalQuantity = totalQuantity
  slot.updatedAt = DEMO_REFERENCE_DATE
  syncCommodityProductAvailabilityStatus(slot.commodityProductId)
  return slot
}

export type UpdateAvailabilitySlotDetailsInput = Partial<Pick<AvailabilitySlot, 'periodStart' | 'periodEnd' | 'bookingCutoff' | 'blackoutDates'>>

/** Update metadata periode/cutoff/blackout — TIDAK menyentuh quantity (pakai `updateAvailabilitySlotTotal`/hold-release-confirm untuk itu). */
export function updateAvailabilitySlotDetails (slotId: string, patch: UpdateAvailabilitySlotDetailsInput): AvailabilitySlot | undefined {
  const slot = getAvailabilitySlotById(slotId)
  if (!slot) { return undefined }
  Object.assign(slot, patch, { updatedAt: DEMO_REFERENCE_DATE })
  return slot
}

/** Slot aman dihapus HANYA bila tidak sedang menahan/menyimpan stok apa pun (held dan booked keduanya nol). */
export function isAvailabilitySlotDeletable (id: string): boolean {
  const slot = getAvailabilitySlotById(id)
  if (!slot) { return false }
  return slot.heldQuantity === 0 && slot.bookedQuantity === 0
}

export function deleteAvailabilitySlot (id: string): boolean {
  if (!isAvailabilitySlotDeletable(id)) { return false }
  const index = AVAILABILITY_SLOTS.findIndex(item => item.id === id)
  if (index === -1) { return false }
  const commodityProductId = AVAILABILITY_SLOTS[index].commodityProductId
  AVAILABILITY_SLOTS.splice(index, 1)
  syncCommodityProductAvailabilityStatus(commodityProductId)
  return true
}

/** Menahan stok (Soft Hold) — GAGAL (undefined) bila `qty` melebihi sisa `availableQuantity`, mencegah negative stock/overselling/quantity tidak divalidasi (Phase 0 Section 9). */
export function holdAvailabilityQuantity (slotId: string, qty: number): AvailabilitySlot | undefined {
  const slot = getAvailabilitySlotById(slotId)
  if (!slot || qty <= 0) { return undefined }
  if (getAvailableQuantity(slot) < qty) { return undefined }
  slot.heldQuantity += qty
  slot.updatedAt = DEMO_REFERENCE_DATE
  syncCommodityProductAvailabilityStatus(slot.commodityProductId)
  return slot
}

/** Melepas hold (cancel/expired) — mengembalikan stok, TIDAK PERNAH membuat `heldQuantity` negatif. */
export function releaseAvailabilityHold (slotId: string, qty: number): AvailabilitySlot | undefined {
  const slot = getAvailabilitySlotById(slotId)
  if (!slot || qty <= 0) { return undefined }
  slot.heldQuantity = Math.max(0, slot.heldQuantity - qty)
  slot.updatedAt = DEMO_REFERENCE_DATE
  syncCommodityProductAvailabilityStatus(slot.commodityProductId)
  return slot
}

/** Konfirmasi — memindahkan `qty` dari `heldQuantity` ke `bookedQuantity` (total tidak berubah, murni reklasifikasi, Phase 0 Section 1 flow "Selection dikonfirmasi"). */
export function confirmAvailabilityHold (slotId: string, qty: number): AvailabilitySlot | undefined {
  const slot = getAvailabilitySlotById(slotId)
  if (!slot || qty <= 0 || slot.heldQuantity < qty) { return undefined }
  slot.heldQuantity -= qty
  slot.bookedQuantity += qty
  slot.updatedAt = DEMO_REFERENCE_DATE
  syncCommodityProductAvailabilityStatus(slot.commodityProductId)
  return slot
}

/** Predikat murni (read-only) — mendeteksi hold yang sudah lewat `holdExpiresAt`. TIDAK melakukan mutasi/rollback stok; sweep otomatis adalah tanggung jawab Phase 4 saat katalog/selection diakses. */
export function isHoldExpired (holdExpiresAt: string | undefined, referenceIso: string = DEMO_REFERENCE_DATE): boolean {
  if (!holdExpiresAt) { return false }
  return holdExpiresAt < referenceIso
}

// ---- Commodity Requirement ----------------------------------------------------

export function getCommodityRequirements (): CommodityRequirement[] {
  return COMMODITY_REQUIREMENTS
}

export function getCommodityRequirementById (id: string): CommodityRequirement | undefined {
  return COMMODITY_REQUIREMENTS.find(item => item.id === id)
}

export function getCommodityRequirementsByProject (projectId: string): CommodityRequirement[] {
  return COMMODITY_REQUIREMENTS.filter(item => item.projectId === projectId)
}

export function getCommodityRequirementsByClient (clientPartyId: string): CommodityRequirement[] {
  return COMMODITY_REQUIREMENTS.filter(item => item.clientPartyId === clientPartyId)
}

export interface CreateCommodityRequirementInput {
  projectId: string
  clientPartyId: string
  category: CommodityRequirement['category']
  title: string
  quantity: number
  notes?: string
  detail?: CommodityRequirement['detail']
}

export function createCommodityRequirement (input: CreateCommodityRequirementInput): CommodityRequirement {
  const requirement: CommodityRequirement = {
    id: nextSequentialId('CRQ-', COMMODITY_REQUIREMENTS),
    projectId: input.projectId,
    clientPartyId: input.clientPartyId,
    category: input.category,
    title: input.title,
    quantity: input.quantity,
    notes: input.notes,
    detail: input.detail,
    status: 'draft',
    createdAt: DEMO_REFERENCE_DATE
  }
  COMMODITY_REQUIREMENTS.push(requirement)
  return requirement
}

export type UpdateCommodityRequirementInput = Partial<Pick<CommodityRequirement, 'title' | 'quantity' | 'notes' | 'detail'>>

/** Edit HANYA diperbolehkan saat status `draft` (Phase 3: "Edit draft requirement"). */
export function isCommodityRequirementEditable (status: RequirementStatus): boolean {
  return status === 'draft'
}

export function updateCommodityRequirement (id: string, patch: UpdateCommodityRequirementInput): CommodityRequirement | undefined {
  const requirement = getCommodityRequirementById(id)
  if (!requirement || !isCommodityRequirementEditable(requirement.status)) { return undefined }
  Object.assign(requirement, patch, { updatedAt: DEMO_REFERENCE_DATE })
  return requirement
}

/** Aman dihapus HANYA saat `draft`/`open` (belum masuk proses matching/selection) — Phase 3: "Delete requirement yang aman dihapus". */
export function isCommodityRequirementDeletable (status: RequirementStatus): boolean {
  return status === 'draft' || status === 'open'
}

export function deleteCommodityRequirement (id: string): boolean {
  const requirement = getCommodityRequirementById(id)
  if (!requirement || !isCommodityRequirementDeletable(requirement.status)) { return false }
  const index = COMMODITY_REQUIREMENTS.findIndex(item => item.id === id)
  if (index === -1) { return false }
  COMMODITY_REQUIREMENTS.splice(index, 1)
  return true
}

const COMMODITY_REQUIREMENT_TRANSITIONS: Record<RequirementStatus, RequirementStatus[]> = {
  draft: ['open', 'cancelled'],
  open: ['matching', 'closed', 'cancelled'],
  matching: ['selection-in-progress', 'closed', 'cancelled'],
  'selection-in-progress': ['selection-submitted', 'closed', 'cancelled'],
  'selection-submitted': ['selection-in-progress', 'fulfilled', 'closed', 'cancelled'],
  fulfilled: ['closed'],
  closed: [],
  cancelled: []
}

export function getCommodityRequirementStatusTransitions (currentStatus: RequirementStatus): RequirementStatus[] {
  return COMMODITY_REQUIREMENT_TRANSITIONS[currentStatus] ?? []
}

export function updateCommodityRequirementStatus (id: string, newStatus: RequirementStatus): CommodityRequirement | undefined {
  const requirement = getCommodityRequirementById(id)
  if (!requirement) { return undefined }
  if (!getCommodityRequirementStatusTransitions(requirement.status).includes(newStatus)) { return undefined }
  requirement.status = newStatus
  requirement.updatedAt = DEMO_REFERENCE_DATE
  return requirement
}

// ---- Commodity Selection --------------------------------------------------------

export function getCommoditySelectionsByRequirement (requirementId: string): CommoditySelection[] {
  return COMMODITY_SELECTIONS.filter(item => item.requirementId === requirementId)
}

export function getCommoditySelectionById (id: string): CommoditySelection | undefined {
  return COMMODITY_SELECTIONS.find(item => item.id === id)
}

export interface CreateCommoditySelectionInput {
  requirementId: string
  commodityProductId: string
  variantId?: string
  quantity: number
  choiceRank: CommoditySelection['choiceRank']
}

const SELECTION_TERMINAL_STATUSES: SelectionStatus[] = ['cancelled', 'rejected', 'expired', 'replaced']

/** Maksimal satu selection AKTIF (belum `cancelled`/`rejected`/`expired`/`replaced`) per rank per requirement (Phase 4: "Primary, Secondary, dan Third Choice" — bukan 1 primary + N alternative bebas). */
export function hasActiveSelectionWithRank (requirementId: string, rank: CommoditySelection['choiceRank']): boolean {
  return COMMODITY_SELECTIONS.some(item =>
    item.requirementId === requirementId && item.choiceRank === rank && !SELECTION_TERMINAL_STATUSES.includes(item.status)
  )
}

/** Mencegah "duplicate active selection yang tidak terkendali" (Phase 4) — commodity+variant yang sama tidak boleh dipilih dua kali secara aktif di bawah requirement yang sama, terlepas dari rank. */
export function hasActiveDuplicateSelection (requirementId: string, commodityProductId: string, variantId: string | undefined): boolean {
  return COMMODITY_SELECTIONS.some(item =>
    item.requirementId === requirementId &&
    item.commodityProductId === commodityProductId &&
    item.variantId === variantId &&
    !SELECTION_TERMINAL_STATUSES.includes(item.status)
  )
}

export function createCommoditySelection (input: CreateCommoditySelectionInput): CommoditySelection | undefined {
  if (input.quantity <= 0) { return undefined }
  if (hasActiveSelectionWithRank(input.requirementId, input.choiceRank)) { return undefined }
  if (hasActiveDuplicateSelection(input.requirementId, input.commodityProductId, input.variantId)) { return undefined }
  const selection: CommoditySelection = {
    id: nextSequentialId('CSL-', COMMODITY_SELECTIONS),
    requirementId: input.requirementId,
    commodityProductId: input.commodityProductId,
    variantId: input.variantId,
    quantity: input.quantity,
    choiceRank: input.choiceRank,
    status: 'draft',
    createdAt: DEMO_REFERENCE_DATE
  }
  COMMODITY_SELECTIONS.push(selection)
  return selection
}

const COMMODITY_SELECTION_TRANSITIONS: Record<SelectionStatus, SelectionStatus[]> = {
  draft: ['submitted', 'cancelled'],
  submitted: ['under-validation', 'cancelled'],
  'under-validation': ['soft-hold', 'rejected', 'cancelled'],
  'soft-hold': ['confirmed', 'expired', 'cancelled', 'replaced'],
  confirmed: ['booked', 'cancelled'],
  booked: ['completed', 'cancelled'],
  completed: [],
  expired: [],
  rejected: [],
  cancelled: [],
  replaced: []
}

export function getCommoditySelectionStatusTransitions (currentStatus: SelectionStatus): SelectionStatus[] {
  return COMMODITY_SELECTION_TRANSITIONS[currentStatus] ?? []
}

function setCommoditySelectionStatus (selection: CommoditySelection, newStatus: SelectionStatus): CommoditySelection | undefined {
  if (!getCommoditySelectionStatusTransitions(selection.status).includes(newStatus)) { return undefined }
  selection.status = newStatus
  selection.updatedAt = DEMO_REFERENCE_DATE
  return selection
}

/** Availability dicek ulang (Phase 0 Section 1: "Availability diperiksa") SEBELUM Soft Hold dibuat — gagal (undefined) bila stok tidak cukup, dan rollback status bila hold gagal ditahan. */
export function submitAndHoldCommoditySelection (selectionId: string, slotId: string, holdExpiresAt: string): CommoditySelection | undefined {
  const selection = getCommoditySelectionById(selectionId)
  if (!selection) { return undefined }
  if (!setCommoditySelectionStatus(selection, 'submitted')) { return undefined }
  if (!setCommoditySelectionStatus(selection, 'under-validation')) { return undefined }
  if (!holdAvailabilityQuantity(slotId, selection.quantity)) { return undefined }
  if (!setCommoditySelectionStatus(selection, 'soft-hold')) {
    releaseAvailabilityHold(slotId, selection.quantity)
    return undefined
  }
  selection.availabilitySlotId = slotId
  selection.holdExpiresAt = holdExpiresAt
  return selection
}

/** Soft Hold → Confirmed — held dipindah menjadi booked pada slot terkait (Phase 0 Section 1: "Selection dikonfirmasi"). */
export function confirmCommoditySelection (selectionId: string): CommoditySelection | undefined {
  const selection = getCommoditySelectionById(selectionId)
  if (!selection || !selection.availabilitySlotId) { return undefined }
  if (!confirmAvailabilityHold(selection.availabilitySlotId, selection.quantity)) { return undefined }
  return setCommoditySelectionStatus(selection, 'confirmed')
}

/** Membatalkan hold (Soft Hold → Cancelled) — mengembalikan stok yang sedang ditahan. */
export function cancelCommoditySelectionHold (selectionId: string): CommoditySelection | undefined {
  const selection = getCommoditySelectionById(selectionId)
  if (!selection) { return undefined }
  if (selection.status === 'soft-hold' && selection.availabilitySlotId) {
    releaseAvailabilityHold(selection.availabilitySlotId, selection.quantity)
  }
  return setCommoditySelectionStatus(selection, 'cancelled')
}

/** Soft Hold → Expired — dipanggil Phase 4 saat `isHoldExpired()` bernilai true; mengembalikan stok yang tertahan (mencegah "hold tidak mengembalikan stok", Phase 0 Section 9). */
export function expireCommoditySelectionHold (selectionId: string): CommoditySelection | undefined {
  const selection = getCommoditySelectionById(selectionId)
  if (!selection || selection.status !== 'soft-hold') { return undefined }
  if (selection.availabilitySlotId) {
    releaseAvailabilityHold(selection.availabilitySlotId, selection.quantity)
  }
  return setCommoditySelectionStatus(selection, 'expired')
}

/** Durasi Soft Hold mock (Phase 4 default — belum ada aturan bisnis baku dari master spec, heuristik seperti `COMMODITY_LIMITED_THRESHOLD`). */
const HOLD_DURATION_DAYS = 3

/** Menghitung tanggal kadaluarsa hold baru dari suatu tanggal acuan (default `DEMO_REFERENCE_DATE`, BUKAN `Date.now()`/`new Date()` — konsisten pola mock seluruh app). */
export function computeHoldExpiry (referenceIso: string = DEMO_REFERENCE_DATE): string {
  return formatISO(addDays(parseISO(referenceIso), HOLD_DURATION_DAYS), { representation: 'date' })
}

/**
 * Sapu hold kadaluarsa (Phase 4 — "Hold expiry") — dipanggil lazy saat katalog/selection diakses
 * (Phase 1 sengaja TIDAK mengimplementasikan sweep otomatis, hanya predikat `isHoldExpired` +
 * primitive `expireCommoditySelectionHold`). Mengembalikan daftar selection yang baru di-expire.
 */
export function sweepExpiredHolds (referenceIso: string = DEMO_REFERENCE_DATE): CommoditySelection[] {
  const expired: CommoditySelection[] = []
  for (const selection of COMMODITY_SELECTIONS) {
    if (selection.status === 'soft-hold' && isHoldExpired(selection.holdExpiresAt, referenceIso)) {
      const result = expireCommoditySelectionHold(selection.id)
      if (result) { expired.push(result) }
    }
  }
  return expired
}

// ---- Commodity Catalog & Matching (Phase 4) ------------------------------------

/** Status Commodity Product yang boleh tampil di katalog Client — "published, active, dan available" (Phase 4 Pastikan). `draft`/`archived`/`suspended`/`expired`/`sold-out` TIDAK PERNAH tampil. */
const CATALOG_VISIBLE_STATUSES: CommodityProductStatus[] = ['published', 'available', 'limited']

/** Availability agregat (lintas variant) untuk satu Commodity Product — dipakai katalog & matching, BUKAN sumber baru (murni derivasi `AvailabilitySlot`, Phase 1). */
export function getCommodityTotalAvailable (commodityProductId: string): number {
  return getAvailabilitySlotsByCommodity(commodityProductId).reduce((sum, slot) => sum + getAvailableQuantity(slot), 0)
}

/** Katalog Client (Phase 4 Pastikan: "Catalog hanya membaca published, active, client-visible, dan available commodity") — `published`-family DAN sisa availability > 0. `client-visible` dipenuhi oleh gerbang status yang sama (`published` = keputusan vendor menampilkan ke Client, Phase 2), tidak ada field visibilitas terpisah. */
export function getCatalogVisibleCommodities (): CommodityProduct[] {
  return COMMODITY_PRODUCTS.filter(product =>
    CATALOG_VISIBLE_STATUSES.includes(product.status) && getCommodityTotalAvailable(product.id) > 0
  )
}

export type CommodityMatchTier = 'exact-match' | 'near-match' | 'alternative' | 'no-match'

function getRequirementDateRange (requirement: CommodityRequirement): { start?: string, end?: string } {
  const detail = requirement.detail
  if (!detail) { return {} }
  switch (detail.category) {
    case 'hotel': return { start: detail.checkInDate, end: detail.checkOutDate }
    case 'flight': return { start: detail.departureDate, end: detail.departureDate }
    case 'transportation': return { start: detail.serviceDate, end: detail.serviceDate }
    case 'mice': return { start: detail.eventDate, end: detail.eventDate }
    default: return {}
  }
}

function slotCoversRange (slot: AvailabilitySlot, start: string | undefined, end: string | undefined): boolean {
  if (!start || !end) { return true }
  return slot.periodStart <= start && slot.periodEnd >= end
}

/**
 * Deterministic matching (Phase 4) — HANYA rule-based (kategori + kecukupan quantity + cakupan tanggal),
 * BUKAN algoritma fuzzy/ML. Klasifikasi murni fungsi dari data (Requirement + Commodity + Availability
 * saat ini) — memanggil dengan input yang sama akan selalu menghasilkan output yang sama.
 */
export function matchCommodityToRequirement (requirement: CommodityRequirement, commodity: CommodityProduct): CommodityMatchTier {
  if (commodity.category !== requirement.category) { return 'no-match' }
  if (!CATALOG_VISIBLE_STATUSES.includes(commodity.status)) { return 'no-match' }

  const { start, end } = getRequirementDateRange(requirement)
  const slots = getAvailabilitySlotsByCommodity(commodity.id)
  const coveringSlots = slots.filter(slot => slotCoversRange(slot, start, end))
  const relevantSlots = coveringSlots.length > 0 ? coveringSlots : slots
  const availableQty = relevantSlots.reduce((sum, slot) => sum + getAvailableQuantity(slot), 0)
  const dateFullyCovered = coveringSlots.length > 0 || (!start && !end)

  if (availableQty <= 0) { return 'no-match' }
  if (availableQty >= requirement.quantity && dateFullyCovered) { return 'exact-match' }
  if (availableQty >= requirement.quantity && !dateFullyCovered) { return 'near-match' }
  return 'alternative'
}

const MATCH_TIER_ORDER: Record<CommodityMatchTier, number> = { 'exact-match': 0, 'near-match': 1, alternative: 2, 'no-match': 3 }

export interface CommodityMatchResult {
  commodity: CommodityProduct
  tier: CommodityMatchTier
}

/** Hasil matching untuk satu Requirement — hanya commodity katalog-visible yang dikembalikan (tier `no-match` disaring), diurutkan Exact → Near → Alternative. Hasil kosong = "No Match" untuk requirement ini secara keseluruhan. */
export function matchCommoditiesForRequirement (requirementId: string): CommodityMatchResult[] {
  const requirement = getCommodityRequirementById(requirementId)
  if (!requirement) { return [] }
  return getCatalogVisibleCommodities()
    .map(commodity => ({ commodity, tier: matchCommodityToRequirement(requirement, commodity) }))
    .filter((result): result is CommodityMatchResult => result.tier !== 'no-match')
    .sort((a, b) => MATCH_TIER_ORDER[a.tier] - MATCH_TIER_ORDER[b.tier])
}

// ---- Commodity Order --------------------------------------------------------------

export function getCommodityOrdersByVendor (vendorId: string): CommodityOrder[] {
  return COMMODITY_ORDERS.filter(item => item.vendorId === vendorId)
}

export function getCommodityOrderById (id: string): CommodityOrder | undefined {
  return COMMODITY_ORDERS.find(item => item.id === id)
}

/** Status yang dihitung sebagai "sold" pada ringkasan Vendor (Phase 5) — Soft Hold BELUM dihitung sold. */
const COMMODITY_ORDER_SOLD_STATUSES: CommodityOrderStatus[] = ['confirmed', 'booked', 'in-service', 'completed']

export function isCommodityOrderSold (status: CommodityOrderStatus): boolean {
  return COMMODITY_ORDER_SOLD_STATUSES.includes(status)
}

/** Dibuat dari `CommoditySelection` yang sudah `confirmed` — SELALU snapshot nama+harga saat ini (Phase 0 Section 8), tidak pernah menyimpan referensi hidup ke `CommodityProduct`. */
export function createCommodityOrderFromSelection (selectionId: string, projectId: string): CommodityOrder | undefined {
  const selection = getCommoditySelectionById(selectionId)
  if (!selection || selection.status !== 'confirmed') { return undefined }
  const product = getCommodityProductById(selection.commodityProductId)
  if (!product) { return undefined }
  const variant = selection.variantId ? getCommodityVariantById(selection.variantId) : undefined
  const order: CommodityOrder = {
    id: nextSequentialId('CMO-', COMMODITY_ORDERS),
    selectionId,
    projectId,
    vendorId: product.vendorId,
    commodityProductId: product.id,
    variantId: variant?.id,
    commodityNameSnapshot: product.name,
    variantNameSnapshot: variant?.name,
    sellPriceIdrSnapshot: variant?.sellPriceIdr ?? product.sellPriceIdr,
    quantity: selection.quantity,
    status: 'confirmed',
    createdAt: DEMO_REFERENCE_DATE
  }
  COMMODITY_ORDERS.push(order)
  return order
}

const COMMODITY_ORDER_TRANSITIONS: Record<CommodityOrderStatus, CommodityOrderStatus[]> = {
  inquiry: ['selected', 'cancelled'],
  selected: ['soft-hold', 'cancelled'],
  'soft-hold': ['confirmed', 'expired', 'cancelled'],
  confirmed: ['booked', 'cancelled', 'refunded'],
  booked: ['in-service', 'cancelled', 'refunded'],
  'in-service': ['completed', 'cancelled'],
  completed: ['refunded'],
  cancelled: [],
  expired: [],
  refunded: []
}

export function getCommodityOrderStatusTransitions (currentStatus: CommodityOrderStatus): CommodityOrderStatus[] {
  return COMMODITY_ORDER_TRANSITIONS[currentStatus] ?? []
}

export function updateCommodityOrderStatus (id: string, newStatus: CommodityOrderStatus): CommodityOrder | undefined {
  const order = getCommodityOrderById(id)
  if (!order) { return undefined }
  if (!getCommodityOrderStatusTransitions(order.status).includes(newStatus)) { return undefined }
  order.status = newStatus
  order.updatedAt = DEMO_REFERENCE_DATE
  return order
}

// ---- Commodity Order — Vendor Orders & Sold Commodities (Phase 5) -----------------

/** Order untuk satu Selection (guard duplikasi — satu Selection maksimal punya satu Order, Phase 5). */
export function getCommodityOrderBySelection (selectionId: string): CommodityOrder | undefined {
  return COMMODITY_ORDERS.find(item => item.selectionId === selectionId)
}

/** Order milik Client tertentu (Phase 5) — `CommodityOrder` tidak menyimpan `clientPartyId` langsung (Order adalah snapshot vendor-facing, Phase 0 Section 8), jadi di-join lewat Selection → Requirement. Dipakai agar Client bisa melihat status Order yang sama dengan yang dilihat Vendor. */
export function getCommodityOrdersByClient (clientPartyId: string): CommodityOrder[] {
  return COMMODITY_ORDERS.filter((order) => {
    const selection = getCommoditySelectionById(order.selectionId)
    const requirement = selection ? getCommodityRequirementById(selection.requirementId) : undefined
    return requirement?.clientPartyId === clientPartyId
  })
}

/** Selection Soft Hold milik komoditas vendor ini yang BELUM punya Order — daftar "Menunggu Konfirmasi" di Vendor Orders (Phase 5). */
export function getPendingSoftHoldSelectionsByVendor (vendorId: string): CommoditySelection[] {
  const vendorCommodityIds = new Set(getCommodityProductsByVendor(vendorId).map(item => item.id))
  return COMMODITY_SELECTIONS.filter(item =>
    item.status === 'soft-hold' && vendorCommodityIds.has(item.commodityProductId) && !getCommodityOrderBySelection(item.id)
  )
}

/**
 * Vendor mengonfirmasi Selection Soft Hold menjadi Order (Phase 5 — "Sinkronisasi selection, hold,
 * confirmed order"). Reuse `confirmCommoditySelection` (Soft Hold → Confirmed, held → booked pada
 * Availability Slot) lalu `createCommodityOrderFromSelection` (snapshot Order). Menolak (undefined) bila
 * selection bukan Soft Hold, komoditasnya bukan milik `vendorId` ini, atau Order untuk selection ini sudah
 * pernah dibuat sebelumnya.
 */
/** Status Commodity Product yang masih boleh dijual lewat konfirmasi Order (Phase 6 regression fix) — `archived`/`expired`/`suspended`/`draft` berarti vendor sudah menghentikan penjualan listing ini; Soft Hold lama yang masih mengacu ke status tsb TIDAK boleh dikonfirmasi jadi Order walau selection-nya sendiri masih `soft-hold`. */
const COMMODITY_ORDER_CONFIRMABLE_PRODUCT_STATUSES: CommodityProductStatus[] = ['published', 'available', 'limited', 'sold-out']

export function confirmCommodityOrderFromSelection (selectionId: string, vendorId: string): CommodityOrder | undefined {
  const selection = getCommoditySelectionById(selectionId)
  if (!selection || selection.status !== 'soft-hold') { return undefined }
  const product = getCommodityProductById(selection.commodityProductId)
  if (!product || product.vendorId !== vendorId) { return undefined }
  if (!COMMODITY_ORDER_CONFIRMABLE_PRODUCT_STATUSES.includes(product.status)) { return undefined }
  if (getCommodityOrderBySelection(selectionId)) { return undefined }
  const requirement = getCommodityRequirementById(selection.requirementId)
  if (!requirement) { return undefined }
  if (!confirmCommoditySelection(selectionId)) { return undefined }
  return createCommodityOrderFromSelection(selectionId, requirement.projectId)
}

/**
 * Padanan status Order → status Selection (Phase 5 Pastikan: "Client melihat status yang sama secara
 * konsisten"). Order dan Selection punya state machine terpisah (Order lebih granular — `in-service` tidak
 * ada padanannya di Selection) — mapping ini HANYA menyamakan tahap yang benar-benar punya padanan 1:1.
 * `in-service`/`expired`/`refunded` sengaja tidak disentuh di sisi Selection (Selection tetap bertahan pada
 * status terakhir yang relevan bagi Client, Order tetap sumber kebenaran fulfillment vendor-facing).
 */
const ORDER_TO_SELECTION_STATUS: Partial<Record<CommodityOrderStatus, SelectionStatus>> = {
  booked: 'booked',
  completed: 'completed',
  cancelled: 'cancelled'
}

/** Memajukan status Order (Phase 5 — Order detail/status timeline) sekaligus menyinkronkan Selection terkait bila ada padanannya (lihat `ORDER_TO_SELECTION_STATUS`), agar Client (yang membaca status dari Selection, `app/pages/client/catalog`) selalu melihat status yang konsisten dengan Vendor. */
export function advanceCommodityOrderStatus (orderId: string, newStatus: CommodityOrderStatus): CommodityOrder | undefined {
  const order = updateCommodityOrderStatus(orderId, newStatus)
  if (!order) { return undefined }
  const mappedSelectionStatus = ORDER_TO_SELECTION_STATUS[newStatus]
  if (mappedSelectionStatus) {
    const selection = getCommoditySelectionById(order.selectionId)
    if (selection) { setCommoditySelectionStatus(selection, mappedSelectionStatus) }
  }
  return order
}

export interface VendorSoldCommoditySummary {
  commodityProductId: string
  commodityName: string
  soldQuantity: number
  soldRevenueIdr: number
  orderCount: number
}

/** Ringkasan "Sold Commodities" per Vendor (Phase 5) — HANYA Order dengan status `isCommodityOrderSold` (Soft Hold/Cancelled/Expired/Refunded tidak dihitung), dikelompokkan per Commodity Product, diurutkan revenue terbesar. */
export function getVendorSoldCommoditiesSummary (vendorId: string): VendorSoldCommoditySummary[] {
  const soldOrders = getCommodityOrdersByVendor(vendorId).filter(order => isCommodityOrderSold(order.status))
  const summaryByCommodity = new Map<string, VendorSoldCommoditySummary>()
  for (const order of soldOrders) {
    const revenue = order.sellPriceIdrSnapshot * order.quantity
    const existing = summaryByCommodity.get(order.commodityProductId)
    if (existing) {
      existing.soldQuantity += order.quantity
      existing.soldRevenueIdr += revenue
      existing.orderCount += 1
    } else {
      summaryByCommodity.set(order.commodityProductId, {
        commodityProductId: order.commodityProductId,
        commodityName: order.commodityNameSnapshot,
        soldQuantity: order.quantity,
        soldRevenueIdr: revenue,
        orderCount: 1
      })
    }
  }
  return Array.from(summaryByCommodity.values()).sort((a, b) => b.soldRevenueIdr - a.soldRevenueIdr)
}
