import { PARTIES, CONTACTS, PARTY_ACTIVITIES } from './parties'
import { USERS } from './users'
import { OPPORTUNITIES, QUOTATIONS } from './opportunities'
import { VENDORS, VENDOR_CONTACTS, VENDOR_QUOTATIONS, VENDOR_ACTIVITIES, VENDOR_PRODUCTS, VENDOR_DOCUMENTS } from './vendors'
import { PROJECTS, PROJECT_SERVICES, TRAVELER_GROUPS, TRAVELERS, ROOM_ASSIGNMENTS, ITINERARY_ITEMS } from './projects'
import { INVOICES, PAYMENTS } from './finance'
import { ACTIVITIES, DOCUMENTS, TASKS, PROJECT_RISKS, SHIFT_NOTES, SYSTEM_EVENTS } from './activity'
import { LEADS, LEAD_ACTIVITIES } from './leads'
import { PRODUCT_TEMPLATES, COST_SHEETS } from './products'
import { FLIGHT_BOOKINGS } from './ticketing'
import { HOTEL_BOOKINGS } from './accommodation'
import { TRANSPORT_BOOKINGS } from './transportation'
import { MICE_EVENTS } from './mice'
import { RFQS, RFQ_INVITATIONS, RFQ_RESPONSES, RFQ_CLARIFICATIONS, SERVICE_ORDERS, SERVICE_ORDER_AMENDMENTS, SUPPLIER_INVOICES } from './procurement'
import { isProjectNeedingAttention, isTaskUpcoming, isFollowUpUpcoming, isTravelerDocumentMissing, isInvoiceOverdue, DEMO_REFERENCE_DATE } from '~/utils/attention'
import { formatCurrencyIdr, daysUntil } from '~/utils/format'
import { SERVICE_STATUSES, SERVICE_TYPES, findStatusOption } from '~/constants/status'
import type { Project, ServiceTypeKey, ServiceStatus, Traveler, ProjectOrderStatus, ProjectClosureChecklist, ProjectDetailTab, ItineraryItem } from '~/types/project'
import type { Party, ContactPerson, PartyActivity, PartyActivityType } from '~/types/party'
import type { Opportunity, OpportunityStage, Quotation, OpportunityWorkflowStatus } from '~/types/opportunity'
import type { Vendor, VendorContact, VendorQuotation, VendorProduct, VendorDocument } from '~/types/vendor'
import type { ActivityEntry, ChangeCategory, ProjectTask, ProjectRisk, ProjectRiskSeverity, ShiftNote, ShiftPeriod } from '~/types/activity'
import type { Lead, LeadActivity } from '~/types/lead'
import type { ProductTemplate, ProductTemplateStatus, ProductServiceAlternative, CostSheet, CostSheetLineItem } from '~/types/product'
import type { FlightBooking, FlightBookingStatus, FlightOption, FlightSegment } from '~/types/ticketing'
import type { HotelBooking, HotelBookingStatus, HotelOption } from '~/types/accommodation'
import type { TransportBooking, TransportBookingStatus, TransportOption, TransportLeg } from '~/types/transportation'
import type { MiceEvent, MiceEventStatus, MiceApprovalStatus } from '~/types/mice'
import type { RFQ, RFQStatus, RFQLineItem, RFQInvitation, RFQResponse, RFQResponseLineItem, RFQClarificationMessage, ServiceOrder, ServiceOrderStatus, ServiceOrderLineItem, ServiceOrderAmendment, SupplierInvoice, SupplierInvoiceStatus } from '~/types/procurement'

export {
  USERS,
  PARTIES, CONTACTS, PARTY_ACTIVITIES,
  OPPORTUNITIES, QUOTATIONS,
  VENDORS, VENDOR_CONTACTS, VENDOR_QUOTATIONS, VENDOR_ACTIVITIES, VENDOR_PRODUCTS, VENDOR_DOCUMENTS,
  PROJECTS, PROJECT_SERVICES, TRAVELER_GROUPS, TRAVELERS, ROOM_ASSIGNMENTS, ITINERARY_ITEMS,
  INVOICES, PAYMENTS,
  ACTIVITIES, DOCUMENTS, TASKS, PROJECT_RISKS, SHIFT_NOTES, SYSTEM_EVENTS,
  LEADS, LEAD_ACTIVITIES,
  PRODUCT_TEMPLATES, COST_SHEETS,
  FLIGHT_BOOKINGS,
  HOTEL_BOOKINGS,
  TRANSPORT_BOOKINGS,
  MICE_EVENTS,
  RFQS, RFQ_INVITATIONS, RFQ_RESPONSES, RFQ_CLARIFICATIONS, SERVICE_ORDERS, SERVICE_ORDER_AMENDMENTS, SUPPLIER_INVOICES,
}

/** Helper selector sederhana (Prompt 5-H) — hindari query ad-hoc berulang di tiap halaman. */

export const getUserById = (id: string) => USERS.find(user => user.id === id)
export const getPartyById = (id: string) => PARTIES.find(party => party.id === id)
export const getContactsByParty = (partyId: string) => CONTACTS.filter(contact => contact.partyId === partyId)
export const getOpportunitiesByParty = (partyId: string) => OPPORTUNITIES.filter(opp => opp.partyId === partyId)
export const getOpportunityById = (id: string) => OPPORTUNITIES.find(opp => opp.id === id)
export const getProjectsByParty = (partyId: string) => PROJECTS.filter(project => project.partyId === partyId)
export const getQuotationByOpportunity = (opportunityId: string) => QUOTATIONS.find(quotation => quotation.opportunityId === opportunityId)
/** Management Approval Queue (Section 06) — quotation menunggu Commercial Approval, lintas seluruh Opportunity. */
export const getQuotationsPendingApproval = () => QUOTATIONS.filter(quotation => quotation.approvalStatus === 'submitted')
/** Management Approval Queue (Section 06) — Opportunity yang quotation-nya sudah approved tapi Client Confirmation (Section 05, AE-facing) belum dicatat; visibilitas Management, bukan aksi (client confirmation tetap tanggung jawab AE). */
export const getOpportunitiesPendingClientConfirmation = () => OPPORTUNITIES.filter((opp) => {
  if (opp.clientConfirmedAt || !['negotiation', 'on-hold'].includes(opp.stage)) return false
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
export function updateItineraryItem(id: string, patch: Partial<Pick<ItineraryItem, 'visibleToClient' | 'timezone'>>): ItineraryItem | undefined {
  const item = ITINERARY_ITEMS.find(i => i.id === id)
  if (!item) return undefined
  Object.assign(item, patch)
  return item
}
export const getTravelerGroups = (projectId: string) => TRAVELER_GROUPS.filter(group => group.projectId === projectId)
export const getTravelers = (projectId: string) => TRAVELERS.filter(traveler => traveler.projectId === projectId)
export const getTravelersByGroup = (groupId: string) => TRAVELERS.filter(traveler => traveler.groupId === groupId)
export const getRoomAssignments = (projectId: string) => ROOM_ASSIGNMENTS.filter(room => room.projectId === projectId)
/** "Room block, occupancy, rooming list" (Section 14, Wajib) — reuse `RoomAssignment`/`TravelerGroup` (Section 11) lewat `groupId`, bukan dataset paralel baru. */
export const getHotelRoomingList = (projectId: string, groupId?: string) => {
  if (!groupId) return []
  return getRoomAssignments(projectId).filter(room => room.groupId === groupId)
}

/** Missing document indicator (Section 11) — dievaluasi terhadap tanggal keberangkatan project ybs. */
export function getTravelersMissingDocuments(projectId: string) {
  const project = getProjectById(projectId)
  return getTravelers(projectId).filter(traveler => isTravelerDocumentMissing(traveler, project?.travelStartDate))
}

export const getInvoicesByProject = (projectId: string) => INVOICES.filter(invoice => invoice.projectId === projectId)
export const getPaymentsByInvoice = (invoiceId: string) => PAYMENTS.filter(payment => payment.invoiceId === invoiceId)

/** Project Finance (Section 15) — sisa tagihan satu invoice (amount dikurangi payment yang sudah diterima). */
export function getInvoiceOutstandingIdr(invoiceId: string): number {
  const invoice = INVOICES.find(item => item.id === invoiceId)
  if (!invoice) return 0
  const paid = getPaymentsByInvoice(invoiceId).reduce((sum, payment) => sum + payment.amountIdr, 0)
  return Math.max(invoice.amountIdr - paid, 0)
}

/** Total outstanding satu project — dipakai tampilan "ringkas" (Sales/role tanpa akses modul Finance) dan Finance tab penuh. */
export function getProjectOutstandingIdr(projectId: string): number {
  return getInvoicesByProject(projectId)
    .filter(invoice => invoice.status !== 'paid')
    .reduce((sum, invoice) => sum + getInvoiceOutstandingIdr(invoice.id), 0)
}

/** Committed vendor cost (Section 15) — total quotation vendor yang sudah `accepted` (Section 13), bukan data paralel dari `PROJECT_SERVICES`/`VENDOR_QUOTATIONS`. */
export function getCommittedVendorCostIdr(projectId: string): number {
  return VENDOR_QUOTATIONS
    .filter(quotation => quotation.projectId === projectId && quotation.status === 'accepted')
    .reduce((sum, quotation) => sum + quotation.amountIdr, 0)
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
export function getProjectOrderStatus(project: Project): ProjectOrderStatus {
  if (project.status === 'cancelled') return 'cancelled'
  if (project.status === 'on-hold') return 'on-hold'
  if (project.status === 'completed') return project.closedAt ? 'closed' : 'completed'
  if (project.status === 'draft') return project.handoverAcceptedAt ? 'planning' : 'handover-pending'
  if (project.status === 'planning') return 'planning'
  if (project.status === 'confirmed') return project.readyAt ? 'ready' : 'confirmed'
  if (project.status === 'in-progress' || project.status === 'ongoing-trip') return 'in-progress'
  return 'created'
}

/**
 * "PM Accept/Return Handover dengan reason" (Wajib) — dipanggil hanya dari UI yang sudah memfilter role PM
 * (`project-manager`)/Super Admin. Guard: hanya dari `status === 'draft'` dan belum pernah di-accept.
 * Acceptance section ("PM dapat menerima handover dan memulai planning TANPA KEHILANGAN DATA KOMERSIAL")
 * terpenuhi otomatis — `quotationAmountIdr`/`budgetIdr`/`sourceQuotationId` sudah terisi penuh sejak
 * `approveOpportunityWon` (Section 05/06), mutator ini TIDAK menyentuhnya sama sekali.
 */
export function acceptProjectHandover(projectId: string, pmId: string): Project | undefined {
  const project = getProjectById(projectId)
  if (!project || project.status !== 'draft' || project.handoverAcceptedAt) return undefined
  project.handoverAcceptedAt = DEMO_REFERENCE_DATE
  project.handoverAcceptedBy = pmId
  const pm = getUserById(pmId)
  ACTIVITIES.push({
    id: nextSequentialId('ACT-', ACTIVITIES),
    projectId, message: `Handover diterima oleh ${pm?.name ?? pmId} — Project Order memasuki tahap Planning.`,
    isChange: false, reviewed: true, createdAt: DEMO_REFERENCE_DATE,
  })
  return project
}

/** Return Handover — TIDAK mengubah `project.status` (tetap Handover Pending), murni mencatat alasan yang harus ditindaklanjuti AE/Sales (mock, D-006). */
export function returnProjectHandover(projectId: string, reason: string, actorId: string): Project | undefined {
  const project = getProjectById(projectId)
  if (!project || project.status !== 'draft' || project.handoverAcceptedAt || !reason.trim()) return undefined
  project.handoverReturnedAt = DEMO_REFERENCE_DATE
  project.handoverReturnReason = reason
  const actor = getUserById(actorId)
  ACTIVITIES.push({
    id: nextSequentialId('ACT-', ACTIVITIES),
    projectId, message: `Handover dikembalikan oleh ${actor?.name ?? actorId}. Alasan: ${reason}`,
    isChange: false, reviewed: true, createdAt: DEMO_REFERENCE_DATE,
  })
  return project
}

/** PM menandai Project Order siap keberangkatan — hanya dari status `confirmed`. */
export function markProjectReady(projectId: string): Project | undefined {
  const project = getProjectById(projectId)
  if (!project || project.status !== 'confirmed' || project.readyAt) return undefined
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
  cancelled: [],
}

export function getProjectStatusTransitions(currentStatus: Project['status']): Project['status'][] {
  return PROJECT_STATUS_TRANSITIONS[currentStatus] ?? []
}

export function updateProjectStatus(projectId: string, newStatus: Project['status'], actorId: string, reason?: string): Project | undefined {
  const project = getProjectById(projectId)
  if (!project) return undefined
  if (!getProjectStatusTransitions(project.status).includes(newStatus)) return undefined
  const requiresReason = newStatus === 'on-hold' || newStatus === 'cancelled'
  if (requiresReason && !reason?.trim()) return undefined
  const fromLabel = project.status
  project.status = newStatus
  const actor = getUserById(actorId)
  ACTIVITIES.push({
    id: nextSequentialId('ACT-', ACTIVITIES),
    projectId,
    message: `Status Project Order diubah dari "${fromLabel}" menjadi "${newStatus}" oleh ${actor?.name ?? actorId}.${reason ? ` Alasan: ${reason}` : ''}`,
    isChange: false, reviewed: true, createdAt: DEMO_REFERENCE_DATE,
  })
  return project
}

/** Closure checklist SHELL (Wajib "Closure checklist shell untuk dipenuhi section akhir") — toggle murni, tidak menggerbangi transisi status apa pun (disengaja, lihat `ProjectClosureChecklist`). */
export function updateProjectClosureChecklist(projectId: string, patch: Partial<ProjectClosureChecklist>): Project | undefined {
  const project = getProjectById(projectId)
  if (!project) return undefined
  project.closureChecklist = {
    financeSettled: false, documentsArchived: false, feedbackCollected: false, assetsReturned: false,
    ...project.closureChecklist,
    ...patch,
  }
  return project
}

/** Team assignment (Wajib "Team assignment dan role responsibilities") — `teamUserIds` sudah ada sejak Foundation, sebelumnya tidak ada mutator untuk mengelolanya. */
export function addProjectTeamMember(projectId: string, userId: string): Project | undefined {
  const project = getProjectById(projectId)
  if (!project || project.teamUserIds.includes(userId)) return undefined
  project.teamUserIds.push(userId)
  return project
}

export function removeProjectTeamMember(projectId: string, userId: string): Project | undefined {
  const project = getProjectById(projectId)
  if (!project) return undefined
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

export function createProjectTask(input: CreateProjectTaskInput): ProjectTask {
  const task: ProjectTask = { id: nextSequentialId('TSK-', TASKS), status: 'not-started', ...input }
  TASKS.push(task)
  return task
}

export function updateProjectTask(taskId: string, patch: Partial<Omit<ProjectTask, 'id' | 'projectId'>>): ProjectTask | undefined {
  const task = TASKS.find(item => item.id === taskId)
  if (!task) return undefined
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

export function createProjectRisk(input: CreateProjectRiskInput): ProjectRisk {
  const risk: ProjectRisk = { id: nextSequentialId('RSK-', PROJECT_RISKS), status: 'open', createdAt: DEMO_REFERENCE_DATE, ...input }
  PROJECT_RISKS.push(risk)
  return risk
}

export function updateProjectRiskStatus(riskId: string, status: ProjectRisk['status']): ProjectRisk | undefined {
  const risk = PROJECT_RISKS.find(item => item.id === riskId)
  if (!risk) return undefined
  risk.status = status
  return risk
}

/** Tab "Documents" Customer Detail (Prompt 19) — union dokumen lintas seluruh Project Order milik satu Company, reuse `getDocumentsByProject`, bukan entitas `PartyDocument` paralel. */
export function getDocumentsByParty(partyId: string) {
  return getProjectsByParty(partyId).flatMap(project => getDocumentsByProject(project.id))
}

/** Opportunity/Project Order milik satu Account Executive (Prompt 19) — dipakai filter "milik saya" dan Customer Journey Dashboard. */
export const getOpportunitiesByOwner = (ownerId: string) => OPPORTUNITIES.filter(opp => opp.ownerId === ownerId)
export function getProjectsByAccountExecutive(accountExecutiveId: string) {
  const ownedOpportunityIds = new Set(getOpportunitiesByOwner(accountExecutiveId).map(opp => opp.id))
  return PROJECTS.filter(project => project.opportunityId && ownedOpportunityIds.has(project.opportunityId))
}
/** Company (Party) yang di-owning oleh satu Account Executive (Section 07) — dipakai scoping "portfolio saya" di Customer Journey Dashboard/Customers list, pelengkap `getOpportunitiesByOwner`/`getProjectsByAccountExecutive` yang sudah ada. */
export const getPartiesByAccountOwner = (accountExecutiveId: string) => PARTIES.filter(party => party.accountOwnerId === accountExecutiveId)

/** Project yang butuh perhatian, dengan konteks invoice/task/activity masing-masing sudah dihitung. */
export function getProjectsNeedingAttention() {
  return PROJECTS.filter(project =>
    isProjectNeedingAttention(project, {
      invoices: getInvoicesByProject(project.id),
      tasks: getTasksByProject(project.id),
      activities: getActivitiesByProject(project.id),
    }),
  )
}

export function getOutstandingInvoices() {
  return INVOICES.filter(invoice => invoice.status !== 'paid')
}

/** Selector tambahan Section 06 (Dashboard) — dipakai widget role-aware ("milik sendiri", service readiness, dll). */

export const getProjectsByOwner = (ownerId: string) => PROJECTS.filter(project => project.ownerId === ownerId)

export function getServicesForProjects(projectIds: string[], type?: ServiceTypeKey) {
  return PROJECT_SERVICES.filter(service =>
    projectIds.includes(service.projectId) && (!type || service.type === type),
  )
}

export function getUpcomingTasks(projectIds?: string[]) {
  return TASKS
    .filter(task => isTaskUpcoming(task) && (!projectIds || projectIds.includes(task.projectId)))
    .sort((a, b) => (a.dueAt ?? '').localeCompare(b.dueAt ?? ''))
}

export function getRecentChanges(projectIds?: string[], limit = 5) {
  return ACTIVITIES
    .filter(activity => activity.isChange && (!projectIds || projectIds.includes(activity.projectId)))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit)
}

/** Selector dan create-mock Section 07 (CRM Party). */

export function getPartyActivities(partyId: string) {
  return PARTY_ACTIVITIES
    .filter(activity => activity.partyId === partyId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

/** Activity/follow-up milik satu Opportunity spesifik (Section 08) — subset dari `getPartyActivities`. */
export function getPartyActivitiesByOpportunity(opportunityId: string) {
  return PARTY_ACTIVITIES
    .filter(activity => activity.opportunityId === opportunityId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

/** Widget Dashboard Sales "Follow-up Mendatang" — deferred di Section 06, diisi Section 07. */
export function getUpcomingFollowUps(ownerId?: string) {
  return PARTY_ACTIVITIES
    .filter(activity => isFollowUpUpcoming(activity) && (!ownerId || activity.ownerId === ownerId))
    .sort((a, b) => (a.dueAt ?? '').localeCompare(b.dueAt ?? ''))
}

/** Generate ID berurutan 3-digit dari prefix (mis. `PTY-` → `PTY-005`) — dipakai seluruh create-mock di bawah. */
function nextSequentialId(prefix: string, list: { id: string }[]): string {
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
export function createParty(input: { name: string; industry?: string }): Party {
  const party: Party = {
    id: nextSequentialId('PTY-', PARTIES),
    name: input.name,
    lifecycleStatus: 'prospect',
    industry: input.industry,
    createdAt: DEMO_REFERENCE_DATE,
  }
  PARTIES.push(party)
  return party
}

export function createContact(input: { partyId: string; name: string; title: string; email?: string; phone?: string }): ContactPerson {
  const contact: ContactPerson = { id: nextSequentialId('CP-', CONTACTS), ...input }
  CONTACTS.push(contact)
  return contact
}

export function createPartyActivity(input: { partyId: string; opportunityId?: string; type: PartyActivityType; message: string; ownerId: string; dueAt?: string }): PartyActivity {
  const activity: PartyActivity = { id: nextSequentialId('PACT-', PARTY_ACTIVITIES), createdAt: DEMO_REFERENCE_DATE, ...input }
  PARTY_ACTIVITIES.push(activity)
  return activity
}

/**
 * Mutasi dan create-mock Section 08 (Opportunity dan Quotation) — melanjutkan pola Section 07.
 * Transisi stage TIDAK memvalidasi ulang state diagram di sini (validasi ada di UI — tombol yang
 * ditampilkan sudah dibatasi sesuai stage aktif); helper ini murni mutasi + bookkeeping timestamp.
 */
export function advanceOpportunityStage(opportunityId: string, nextStage: OpportunityStage, extra?: { lostReason?: string }): Opportunity | undefined {
  const opportunity = getOpportunityById(opportunityId)
  if (!opportunity) return undefined
  opportunity.stage = nextStage
  if (nextStage === 'lost') {
    opportunity.decidedAt = DEMO_REFERENCE_DATE
    opportunity.lostReason = extra?.lostReason
  }
  return opportunity
}

export function createQuotation(opportunityId: string, amountIdr: number): Quotation {
  const quotation: Quotation = {
    id: nextSequentialId('QUO-', QUOTATIONS),
    opportunityId,
    amountIdr,
    createdAt: DEMO_REFERENCE_DATE,
    accepted: false,
    version: 1,
  }
  QUOTATIONS.push(quotation)
  const opportunity = getOpportunityById(opportunityId)
  if (opportunity) opportunity.quotationId = quotation.id
  return quotation
}

export function reviseQuotation(quotationId: string, newAmountIdr: number): Quotation | undefined {
  const quotation = QUOTATIONS.find(q => q.id === quotationId)
  if (!quotation) return undefined
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

export function updateQuotationDetails(quotationId: string, patch: QuotationDetailInput): Quotation | undefined {
  const quotation = QUOTATIONS.find(q => q.id === quotationId)
  if (!quotation) return undefined
  if (quotation.approvalStatus === 'submitted' || quotation.approvalStatus === 'approved') return undefined
  Object.assign(quotation, patch)
  return quotation
}

/**
 * "Duplicate" (Section 05) — berbeda dari `reviseQuotation`/"Create New Version" (yang mengosongkan nilai
 * baru untuk diisi ulang): `duplicateQuotationVersion` menyalin SELURUH field quotation saat ini (amount,
 * discount, tax, markup, service breakdown, dst.) sebagai versi baru, `approvalStatus` direset ke draft —
 * titik awal AE mengedit dari salinan persis, bukan dari kosong.
 */
export function duplicateQuotationVersion(quotationId: string): Quotation | undefined {
  const quotation = QUOTATIONS.find(q => q.id === quotationId)
  if (!quotation) return undefined
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
export function sendQuotationToClient(quotationId: string): Quotation | undefined {
  const quotation = QUOTATIONS.find(q => q.id === quotationId)
  if (!quotation) return undefined
  quotation.sentToClientAt = DEMO_REFERENCE_DATE
  return quotation
}

/**
 * "Withdraw" (Section 05) — AE menarik kembali quotation yang sudah `submitted` (sebelum Management
 * sempat approve/reject), kembali ke `draft` agar bisa diedit ulang. Guard: hanya dari status `submitted`.
 */
export function withdrawQuotationSubmission(quotationId: string): Quotation | undefined {
  const quotation = QUOTATIONS.find(q => q.id === quotationId)
  if (!quotation || quotation.approvalStatus !== 'submitted') return undefined
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
export function submitQuotationForApproval(quotationId: string): Quotation | undefined {
  const quotation = QUOTATIONS.find(q => q.id === quotationId)
  if (!quotation) return undefined
  quotation.approvalStatus = 'submitted'
  const opportunity = getOpportunityById(quotation.opportunityId)
  if (opportunity) {
    createPartyActivity({
      partyId: opportunity.partyId,
      opportunityId: opportunity.id,
      type: 'note',
      message: `Quotation ${quotation.id} (${formatCurrencyIdr(quotation.amountIdr)}) diajukan untuk commercial approval.`,
      ownerId: opportunity.ownerId,
    })
  }
  return quotation
}

export function approveQuotation(quotationId: string, approverId: string, note?: string): Quotation | undefined {
  const quotation = QUOTATIONS.find(q => q.id === quotationId)
  if (!quotation || quotation.approvalStatus !== 'submitted') return undefined
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
      ownerId: approverId,
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
export function rejectQuotation(quotationId: string, approverId: string, note: string): Quotation | undefined {
  const quotation = QUOTATIONS.find(q => q.id === quotationId)
  if (!quotation || quotation.approvalStatus !== 'submitted') return undefined
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
      ownerId: approverId,
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
export function getOpportunityMissingRequirements(opportunityId: string): string[] {
  const opportunity = getOpportunityById(opportunityId)
  if (!opportunity) return ['Opportunity tidak ditemukan']
  const missing: string[] = []
  if (!opportunity.destination) missing.push('Destinasi')
  if (!opportunity.travelStartDate || !opportunity.travelEndDate) missing.push('Tanggal perjalanan perkiraan')
  if (!opportunity.travelerEstimate) missing.push('Estimasi jumlah traveler')
  if (!getQuotationByOpportunity(opportunityId)) missing.push('Quotation')
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
export function getOpportunityRequirementGate(opportunityId: string): string[] {
  const opportunity = getOpportunityById(opportunityId)
  if (!opportunity) return ['Opportunity tidak ditemukan']
  const missing: string[] = []
  if (!opportunity.destination) missing.push('Destinasi belum diisi')
  if (!opportunity.travelStartDate || !opportunity.travelEndDate) missing.push('Periode perjalanan belum diisi')
  if (!opportunity.travelerEstimate) missing.push('Estimasi traveler belum diisi')
  if (!opportunity.serviceScope || opportunity.serviceScope.length === 0) missing.push('Service scope belum dipilih')
  if (!opportunity.requirementNotes) missing.push('Ringkasan kebutuhan (requirement summary) belum diisi')
  if (!opportunity.contactName) missing.push('Contact person belum diisi')
  if (!opportunity.estimatedValueIdr) missing.push('Estimasi nilai (quotation value) belum diisi')
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

export function updateOpportunityRequirement(opportunityId: string, patch: OpportunityRequirementInput): Opportunity | undefined {
  const opportunity = getOpportunityById(opportunityId)
  if (!opportunity) return undefined
  Object.assign(opportunity, patch)
  return opportunity
}

/**
 * Client Confirmation (Section 05) — dicatat AE setelah quotation `approved`, gerbang TAMBAHAN sebelum
 * "Mark as Won" (lihat `Opportunity.clientConfirmedAt`, `app/types/opportunity.ts`). Mock — bukan integrasi
 * email/WA nyata (D-006); hanya mencatat bahwa AE sudah menerima konfirmasi lewat kanal apa pun.
 */
export function recordClientConfirmation(opportunityId: string, actorId: string, note?: string): Opportunity | undefined {
  const opportunity = getOpportunityById(opportunityId)
  if (!opportunity) return undefined
  opportunity.clientConfirmedAt = DEMO_REFERENCE_DATE
  opportunity.clientConfirmationNote = note
  createPartyActivity({
    partyId: opportunity.partyId,
    opportunityId: opportunity.id,
    type: 'note',
    message: `Client confirmation dicatat.${note ? ` Catatan: ${note}` : ''}`,
    ownerId: actorId,
  })
  return opportunity
}

/**
 * Status workflow AE-facing (Prompt 20-10/14) — lihat `OpportunityWorkflowStatus` (`app/types/opportunity.ts`)
 * untuk rasional lengkap. DIRIVASI, bukan field tersimpan — tidak merestrukturisasi `OpportunityStage` (D-049).
 */
export function getOpportunityWorkflowStatus(opportunityId: string): OpportunityWorkflowStatus | undefined {
  const opportunity = getOpportunityById(opportunityId)
  if (!opportunity) return undefined
  if (opportunity.stage === 'won') return 'won'
  if (opportunity.stage === 'lost') return 'lost'

  const quotation = getQuotationByOpportunity(opportunityId)
  if (!quotation) {
    return getOpportunityRequirementGate(opportunityId).length > 0 ? 'pending-requirement' : 'ready-for-quotation'
  }
  const approvalStatus = quotation.approvalStatus ?? 'draft'
  if (approvalStatus === 'submitted') return 'pending-management-approval'
  if (approvalStatus === 'approved') return 'approved'
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
export function approveOpportunityWon(opportunityId: string, approverId: string): Project | undefined {
  const opportunity = getOpportunityById(opportunityId)
  if (!opportunity || opportunity.stage !== 'won-requested') return undefined
  if (opportunity.projectId) return getProjectById(opportunity.projectId)
  if (getOpportunityMissingRequirements(opportunityId).length > 0) return undefined

  const quotation = getQuotationByOpportunity(opportunityId)!
  if (quotation.approvalStatus !== 'approved' || !opportunity.clientConfirmedAt) return undefined
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
    actualCostIdr: 0,
  }
  PROJECTS.push(project)

  opportunity.stage = 'won'
  opportunity.decidedAt = DEMO_REFERENCE_DATE
  opportunity.wonApprovedBy = approverId
  opportunity.projectId = project.id

  if (party) {
    if (party.lifecycleStatus === 'prospect') party.lifecycleStatus = 'client'
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
    createdAt: DEMO_REFERENCE_DATE,
  })

  return project
}

/** Reject — kembali ke Negotiation dengan catatan (docs bagian 2.1: "WonRequested → Negotiation: ditolak, kembali dengan catatan"). */
export function rejectOpportunityWon(opportunityId: string, note: string): Opportunity | undefined {
  const opportunity = getOpportunityById(opportunityId)
  if (!opportunity || opportunity.stage !== 'won-requested') return undefined
  opportunity.stage = 'negotiation'
  createPartyActivity({
    partyId: opportunity.partyId,
    opportunityId: opportunity.id,
    type: 'note',
    message: `Approval Won ditolak, kembali ke Negotiation. Catatan: ${note}`,
    ownerId: opportunity.ownerId,
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

export function createTraveler(input: CreateTravelerInput): Traveler {
  const traveler: Traveler = { id: nextSequentialId('TRV-', TRAVELERS), ...input }
  TRAVELERS.push(traveler)
  return traveler
}

export function updateTraveler(id: string, patch: Partial<Omit<Traveler, 'id' | 'projectId'>>): Traveler | undefined {
  const traveler = TRAVELERS.find(item => item.id === id)
  if (!traveler) return undefined
  Object.assign(traveler, patch)
  return traveler
}

export function removeTraveler(id: string): boolean {
  const index = TRAVELERS.findIndex(item => item.id === id)
  if (index === -1) return false
  TRAVELERS.splice(index, 1)
  for (const room of ROOM_ASSIGNMENTS) {
    const roomIndex = room.travelerIds.indexOf(id)
    if (roomIndex !== -1) room.travelerIds.splice(roomIndex, 1)
  }
  return true
}

/**
 * "Internal verification" (Section 11 baru, Wajib) — tindakan manusia (staf internal mengonfirmasi dokumen
 * sudah diperiksa), TERPISAH dari `isTravelerDocumentMissing` (computed kelengkapan field). Toggle tunggal
 * (verify jika belum, unverify jika sudah) — pola cycle sederhana sama seperti `updateProjectRiskStatus`.
 */
export function toggleTravelerVerification(travelerId: string, actorId: string): Traveler | undefined {
  const traveler = TRAVELERS.find(item => item.id === travelerId)
  if (!traveler) return undefined
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

export function getTravelerReadiness(projectId: string): TravelerReadinessSummary {
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
export function previewTravelerImportMock(projectId: string, count = 5): TravelerImportPreviewRow[] {
  const existing = getTravelers(projectId)
  const rows: TravelerImportPreviewRow[] = []
  for (let i = 1; i <= count; i++) {
    const isEmptyNameRow = i === 2 && count >= 2
    const duplicateCandidate = i === 4 && count >= 4 ? existing[0] : undefined
    const row: TravelerImportPreviewRow = {
      name: isEmptyNameRow ? '' : `Peserta Import ${existing.length + i}`,
      passportNumber: duplicateCandidate?.passportNumber,
    }
    const errors: string[] = []
    if (!row.name.trim()) errors.push('Nama kosong — wajib diisi')
    if (row.passportNumber && existing.some(traveler => traveler.passportNumber === row.passportNumber)) {
      errors.push(`Nomor paspor duplikat dengan traveler existing (${duplicateCandidate?.name})`)
    }
    rows.push({ ...row, errors })
  }
  return rows
}

/** Membuat traveler hanya dari baris yang lolos validasi (`errors.length === 0`) — baris error dilewati (tidak dibuat), tetap tampil di error report UI sampai dialog ditutup. */
export function commitTravelerImport(projectId: string, rows: TravelerImportPreviewRow[]): Traveler[] {
  const created: Traveler[] = []
  for (const row of rows) {
    if (row.errors.length > 0) continue
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
export function updateServiceStatus(serviceId: string, newStatus: ServiceStatus) {
  const service = PROJECT_SERVICES.find(item => item.id === serviceId)
  if (!service) return undefined
  const previousStatus = service.status
  service.status = newStatus
  if (newStatus === 'changed' && previousStatus !== 'changed') {
    ACTIVITIES.push({
      id: nextSequentialId('ACT-', ACTIVITIES),
      projectId: service.projectId,
      message: `Layanan "${service.label}" ditandai berubah (status: ${findStatusOption(SERVICE_STATUSES, newStatus).label}) — perlu ditinjau.`,
      isChange: true,
      reviewed: false,
      createdAt: DEMO_REFERENCE_DATE,
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
export function toggleTaskBlocked(taskId: string, reason?: string): ProjectTask | undefined {
  const task = TASKS.find(item => item.id === taskId)
  if (!task) return undefined
  if (task.isBlocked) {
    task.isBlocked = false
    task.blockedReason = undefined
  } else {
    if (!reason?.trim()) return undefined
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

export function getServiceReadinessMatrix(projectId: string): ServiceReadinessRow[] {
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

export function getDepartureReadiness(projectId: string): DepartureReadinessSummary | undefined {
  const project = getProjectById(projectId)
  if (!project) return undefined

  const travelerReadiness = getTravelerReadiness(projectId)
  const serviceMatrix = getServiceReadinessMatrix(projectId)
  const totalServices = serviceMatrix.reduce((sum, row) => sum + row.total, 0)
  const confirmedServices = serviceMatrix.reduce((sum, row) => sum + row.confirmedCount, 0)
  const servicesConfirmedPercent = totalServices === 0 ? 0 : Math.round((confirmedServices / totalServices) * 100)
  const blockedTasksCount = getTasksByProject(projectId).filter(task => task.isBlocked).length
  const openRisksCount = getRisksByProject(projectId).filter(risk => risk.status === 'open').length
  const outstandingInvoiceCount = getInvoicesByProject(projectId).filter(invoice => invoice.status !== 'paid').length

  const blockingReasons: string[] = []
  if (travelerReadiness.total > 0 && travelerReadiness.documentsCompleteCount < travelerReadiness.total) {
    blockingReasons.push(`${travelerReadiness.total - travelerReadiness.documentsCompleteCount} traveler dokumen belum lengkap`)
  }
  if (totalServices > 0 && confirmedServices < totalServices) {
    blockingReasons.push(`${totalServices - confirmedServices} layanan belum Confirmed/Completed`)
  }
  if (blockedTasksCount > 0) blockingReasons.push(`${blockedTasksCount} task diblokir`)
  if (openRisksCount > 0) blockingReasons.push(`${openRisksCount} risk masih Open`)
  if (outstandingInvoiceCount > 0) blockingReasons.push(`${outstandingInvoiceCount} invoice belum lunas`)

  return {
    daysUntilDeparture: daysUntil(project.travelStartDate, DEMO_REFERENCE_DATE),
    travelerReadinessPercent: travelerReadiness.readinessPercent,
    servicesConfirmedPercent,
    blockedTasksCount,
    openRisksCount,
    outstandingInvoiceCount,
    isReady: blockingReasons.length === 0,
    blockingReasons,
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

export function getProjectAttentionQueue(projectId: string): AttentionQueueItem[] {
  const items: AttentionQueueItem[] = []
  for (const task of getTasksByProject(projectId)) {
    if (task.isBlocked) items.push({ severity: 'high', message: `Task "${task.title}" diblokir: ${task.blockedReason ?? 'alasan belum dicatat'}`, tab: 'tasks' })
    else if (task.status === 'overdue') items.push({ severity: 'medium', message: `Task "${task.title}" telah melewati jatuh tempo`, tab: 'tasks' })
  }
  for (const service of getProjectServices(projectId)) {
    if (service.status === 'changed') items.push({ severity: 'medium', message: `Layanan "${service.label}" berubah, perlu ditinjau`, tab: 'itinerary-services' })
  }
  for (const risk of getRisksByProject(projectId)) {
    if (risk.status === 'open') items.push({ severity: risk.severity === 'high' ? 'high' : 'medium', message: `Risk terbuka: ${risk.title}`, tab: 'overview' })
  }
  const missingDocs = getTravelersMissingDocuments(projectId)
  if (missingDocs.length > 0) items.push({ severity: 'medium', message: `${missingDocs.length} traveler dokumennya belum lengkap`, tab: 'travelers' })
  for (const invoice of getInvoicesByProject(projectId)) {
    if (isInvoiceOverdue(invoice)) items.push({ severity: 'high', message: `Invoice ${invoice.id} telah jatuh tempo`, tab: 'finance' })
  }
  return items
}

/** "On-trip updates dan shift notes mock" (Section 12 baru, Wajib) — log operasional ringkas, lihat `ShiftNote` (`app/types/activity.ts`). Create-only (mock log, tidak ada edit/hapus — konsisten pola append-only catatan operasional). */
export const getShiftNotes = (projectId: string) => SHIFT_NOTES
  .filter(note => note.projectId === projectId)
  .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

export function createShiftNote(input: { projectId: string; authorId: string; shift: ShiftPeriod; note: string }): ShiftNote {
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
export function getFlightBookingMarginIdr(booking: FlightBooking): number | undefined {
  if (booking.netCostIdr === undefined || booking.sellPriceIdr === undefined) return undefined
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

export function createFlightBooking(input: CreateFlightBookingInput): FlightBooking {
  const booking: FlightBooking = {
    id: nextSequentialId('FLT-', FLIGHT_BOOKINGS),
    status: 'requested',
    options: [],
    segments: input.segments ?? [],
    travelerIds: input.travelerIds ?? [],
    createdAt: DEMO_REFERENCE_DATE,
    ...input,
  }
  FLIGHT_BOOKINGS.push(booking)
  return booking
}

/** Guard: `refunded` bersifat terminal (lifecycle selesai) — field lain tidak boleh diedit lagi setelahnya, pola sama `CostSheet.status === 'final'` (D-067). */
export type FlightBookingInput = Partial<Omit<FlightBooking, 'id' | 'projectId' | 'createdAt'>>

export function updateFlightBooking(id: string, patch: FlightBookingInput): FlightBooking | undefined {
  const booking = getFlightBookingById(id)
  if (!booking || booking.status === 'refunded') return undefined
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
  refunded: [],
}

export function getFlightBookingStatusTransitions(current: FlightBookingStatus): FlightBookingStatus[] {
  return FLIGHT_BOOKING_TRANSITIONS[current] ?? []
}

/** Reason wajib untuk `cancelled`/`refunded` (dampak besar — pola sama `updateProjectStatus`, D-066), dicatat sebagai `ActivityEntry` pada project terkait untuk jejak historis. */
export function updateFlightBookingStatus(bookingId: string, newStatus: FlightBookingStatus, actorId: string, reason?: string): FlightBooking | undefined {
  const booking = getFlightBookingById(bookingId)
  if (!booking) return undefined
  if (!getFlightBookingStatusTransitions(booking.status).includes(newStatus)) return undefined
  const requiresReason = newStatus === 'cancelled' || newStatus === 'refunded'
  if (requiresReason && !reason?.trim()) return undefined

  const fromLabel = booking.status
  booking.status = newStatus
  booking.updatedAt = DEMO_REFERENCE_DATE
  if (reason) booking.statusReason = reason.trim()

  const actor = getUserById(actorId)
  ACTIVITIES.push({
    id: nextSequentialId('ACT-', ACTIVITIES),
    projectId: booking.projectId,
    message: `Flight Booking ${booking.id}${booking.pnr ? ` (PNR ${booking.pnr})` : ''} status diubah dari "${fromLabel}" menjadi "${newStatus}" oleh ${actor?.name ?? actorId}.${reason ? ` Alasan: ${reason}` : ''}`,
    isChange: false, reviewed: true, createdAt: DEMO_REFERENCE_DATE,
  })
  return booking
}

/** Toggle single-select opsi (bandingkan lalu pilih satu) — guard `refunded` sama seperti `updateFlightBooking`. */
export function selectFlightOption(bookingId: string, optionIndex: number): FlightBooking | undefined {
  const booking = getFlightBookingById(bookingId)
  if (!booking || booking.status === 'refunded' || !booking.options[optionIndex]) return undefined
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
export function getHotelBookingMarginIdr(booking: HotelBooking): number | undefined {
  if (booking.netCostIdr === undefined || booking.sellPriceIdr === undefined) return undefined
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

export function createHotelBooking(input: CreateHotelBookingInput): HotelBooking {
  const booking: HotelBooking = {
    id: nextSequentialId('HTL-', HOTEL_BOOKINGS),
    status: 'requested',
    options: [],
    travelerIds: input.travelerIds ?? [],
    createdAt: DEMO_REFERENCE_DATE,
    ...input,
  }
  HOTEL_BOOKINGS.push(booking)
  return booking
}

/** Guard: `completed`/`cancelled`/`no-show` bersifat terminal — field lain tidak boleh diedit lagi setelahnya, pola sama `FlightBooking.status === 'refunded'` (D-070). */
export type HotelBookingInput = Partial<Omit<HotelBooking, 'id' | 'projectId' | 'createdAt'>>
const HOTEL_BOOKING_TERMINAL_STATUSES: HotelBookingStatus[] = ['completed', 'cancelled', 'no-show']

export function updateHotelBooking(id: string, patch: HotelBookingInput): HotelBooking | undefined {
  const booking = getHotelBookingById(id)
  if (!booking || HOTEL_BOOKING_TERMINAL_STATUSES.includes(booking.status)) return undefined
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
  'no-show': [],
}

export function getHotelBookingStatusTransitions(current: HotelBookingStatus): HotelBookingStatus[] {
  return HOTEL_BOOKING_TRANSITIONS[current] ?? []
}

/** Reason wajib untuk `cancelled`/`no-show` (dampak besar — pola sama `updateFlightBookingStatus`, D-070), dicatat sebagai `ActivityEntry` pada project terkait untuk jejak historis. */
export function updateHotelBookingStatus(bookingId: string, newStatus: HotelBookingStatus, actorId: string, reason?: string): HotelBooking | undefined {
  const booking = getHotelBookingById(bookingId)
  if (!booking) return undefined
  if (!getHotelBookingStatusTransitions(booking.status).includes(newStatus)) return undefined
  const requiresReason = newStatus === 'cancelled' || newStatus === 'no-show'
  if (requiresReason && !reason?.trim()) return undefined

  const fromLabel = booking.status
  booking.status = newStatus
  booking.updatedAt = DEMO_REFERENCE_DATE
  if (reason) booking.statusReason = reason.trim()

  const actor = getUserById(actorId)
  ACTIVITIES.push({
    id: nextSequentialId('ACT-', ACTIVITIES),
    projectId: booking.projectId,
    message: `Hotel Booking ${booking.id}${booking.confirmationNumber ? ` (konfirmasi ${booking.confirmationNumber})` : ''} status diubah dari "${fromLabel}" menjadi "${newStatus}" oleh ${actor?.name ?? actorId}.${reason ? ` Alasan: ${reason}` : ''}`,
    isChange: false, reviewed: true, createdAt: DEMO_REFERENCE_DATE,
  })
  return booking
}

/** Toggle single-select opsi (bandingkan lalu pilih satu) — guard terminal sama seperti `updateHotelBooking`. */
export function selectHotelOption(bookingId: string, optionIndex: number): HotelBooking | undefined {
  const booking = getHotelBookingById(bookingId)
  if (!booking || HOTEL_BOOKING_TERMINAL_STATUSES.includes(booking.status) || !booking.options[optionIndex]) return undefined
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
export function getTransportBookingMarginIdr(booking: TransportBooking): number | undefined {
  if (booking.netCostIdr === undefined || booking.sellPriceIdr === undefined) return undefined
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

export function createTransportBooking(input: CreateTransportBookingInput): TransportBooking {
  const booking: TransportBooking = {
    id: nextSequentialId('TRN-', TRANSPORT_BOOKINGS),
    status: 'requested',
    options: [],
    legs: input.legs ?? [],
    travelerIds: input.travelerIds ?? [],
    createdAt: DEMO_REFERENCE_DATE,
    ...input,
  }
  TRANSPORT_BOOKINGS.push(booking)
  return booking
}

/** Guard: `completed`/`cancelled`/`no-show` bersifat terminal — field lain tidak boleh diedit lagi setelahnya, pola sama `HotelBooking`/`FlightBooking` (D-070/D-071). */
export type TransportBookingInput = Partial<Omit<TransportBooking, 'id' | 'projectId' | 'createdAt'>>
const TRANSPORT_BOOKING_TERMINAL_STATUSES: TransportBookingStatus[] = ['completed', 'cancelled', 'no-show']

export function updateTransportBooking(id: string, patch: TransportBookingInput): TransportBooking | undefined {
  const booking = getTransportBookingById(id)
  if (!booking || TRANSPORT_BOOKING_TERMINAL_STATUSES.includes(booking.status)) return undefined
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
  'no-show': [],
}

export function getTransportBookingStatusTransitions(current: TransportBookingStatus): TransportBookingStatus[] {
  return TRANSPORT_BOOKING_TRANSITIONS[current] ?? []
}

/** Reason wajib untuk `cancelled`/`no-show` (dampak besar — pola sama `updateHotelBookingStatus`, D-071), dicatat sebagai `ActivityEntry` pada project terkait untuk jejak historis. */
export function updateTransportBookingStatus(bookingId: string, newStatus: TransportBookingStatus, actorId: string, reason?: string): TransportBooking | undefined {
  const booking = getTransportBookingById(bookingId)
  if (!booking) return undefined
  if (!getTransportBookingStatusTransitions(booking.status).includes(newStatus)) return undefined
  const requiresReason = newStatus === 'cancelled' || newStatus === 'no-show'
  if (requiresReason && !reason?.trim()) return undefined

  const fromLabel = booking.status
  booking.status = newStatus
  booking.updatedAt = DEMO_REFERENCE_DATE
  if (reason) booking.statusReason = reason.trim()

  const actor = getUserById(actorId)
  ACTIVITIES.push({
    id: nextSequentialId('ACT-', ACTIVITIES),
    projectId: booking.projectId,
    message: `Transport Booking ${booking.id}${booking.assignedVehiclePlateNumber ? ` (unit ${booking.assignedVehiclePlateNumber})` : ''} status diubah dari "${fromLabel}" menjadi "${newStatus}" oleh ${actor?.name ?? actorId}.${reason ? ` Alasan: ${reason}` : ''}`,
    isChange: false, reviewed: true, createdAt: DEMO_REFERENCE_DATE,
  })
  return booking
}

/** Toggle single-select opsi (bandingkan lalu pilih satu) — guard terminal sama seperti `updateTransportBooking`. */
export function selectTransportOption(bookingId: string, optionIndex: number): TransportBooking | undefined {
  const booking = getTransportBookingById(bookingId)
  if (!booking || TRANSPORT_BOOKING_TERMINAL_STATUSES.includes(booking.status) || !booking.options[optionIndex]) return undefined
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
export function getMiceBoqTotals(event: MiceEvent): { netCostIdr?: number, sellPriceIdr?: number, marginIdr?: number } {
  const withNetCost = event.boqItems.filter(item => item.netCostIdr !== undefined)
  const withSellPrice = event.boqItems.filter(item => item.sellPriceIdr !== undefined)
  const netCostIdr = withNetCost.length ? withNetCost.reduce((sum, item) => sum + (item.netCostIdr ?? 0), 0) : undefined
  const sellPriceIdr = withSellPrice.length ? withSellPrice.reduce((sum, item) => sum + (item.sellPriceIdr ?? 0), 0) : undefined
  const marginIdr = netCostIdr !== undefined && sellPriceIdr !== undefined ? sellPriceIdr - netCostIdr : undefined
  return { netCostIdr, sellPriceIdr, marginIdr }
}

/** "Capacity and schedule conflicts" (Wajib) — derivasi murni (ADVISORY, tidak memblokir transisi status manapun, pola sama Departure Readiness Gate D-069): deteksi sesi tumpang tindih di room yang sama, dan kapasitas sesi vs total peserta yang diharapkan. */
export function getMiceScheduleConflicts(event: MiceEvent): string[] {
  const conflicts: string[] = []
  const totalExpected = event.participantCategories.reduce((sum, category) => sum + category.expectedCount, 0)

  event.sessions.forEach((session, index) => {
    if (totalExpected > session.capacity) {
      conflicts.push(`"${session.sessionTitle}" — kapasitas ruangan (${session.capacity} pax) lebih kecil dari total peserta yang diharapkan (${totalExpected} pax).`)
    }
    for (let other = index + 1; other < event.sessions.length; other++) {
      const b = event.sessions[other]
      if (session.roomName !== b.roomName) continue
      const overlap = session.startAt < b.endAt && b.startAt < session.endAt
      if (overlap) conflicts.push(`"${session.sessionTitle}" dan "${b.sessionTitle}" terjadwal tumpang tindih di room yang sama (${session.roomName}).`)
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

export function createMiceEvent(input: CreateMiceEventInput): MiceEvent {
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
    ...input,
  }
  MICE_EVENTS.push(event)
  return event
}

/** Guard: `completed`/`cancelled` bersifat terminal — field lain tidak boleh diedit lagi setelahnya, pola sama section 13-15 (D-070/D-071/D-072). */
export type MiceEventInput = Partial<Omit<MiceEvent, 'id' | 'projectId' | 'createdAt'>>
const MICE_EVENT_TERMINAL_STATUSES: MiceEventStatus[] = ['completed', 'cancelled']

export function updateMiceEvent(id: string, patch: MiceEventInput): MiceEvent | undefined {
  const event = getMiceEventById(id)
  if (!event || MICE_EVENT_TERMINAL_STATUSES.includes(event.status)) return undefined
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
  cancelled: [],
}

export function getMiceEventStatusTransitions(current: MiceEventStatus): MiceEventStatus[] {
  return MICE_EVENT_TRANSITIONS[current] ?? []
}

/** Reason wajib untuk `cancelled` (dampak besar — pola sama section lain), dicatat sebagai `ActivityEntry` pada project terkait untuk jejak historis. */
export function updateMiceEventStatus(eventId: string, newStatus: MiceEventStatus, actorId: string, reason?: string): MiceEvent | undefined {
  const event = getMiceEventById(eventId)
  if (!event) return undefined
  if (!getMiceEventStatusTransitions(event.status).includes(newStatus)) return undefined
  const requiresReason = newStatus === 'cancelled'
  if (requiresReason && !reason?.trim()) return undefined

  const fromLabel = event.status
  event.status = newStatus
  event.updatedAt = DEMO_REFERENCE_DATE
  if (reason) event.statusReason = reason.trim()

  const actor = getUserById(actorId)
  ACTIVITIES.push({
    id: nextSequentialId('ACT-', ACTIVITIES),
    projectId: event.projectId,
    message: `MICE Event ${event.id} status diubah dari "${fromLabel}" menjadi "${newStatus}" oleh ${actor?.name ?? actorId}.${reason ? ` Alasan: ${reason}` : ''}`,
    isChange: false, reviewed: true, createdAt: DEMO_REFERENCE_DATE,
  })
  return event
}

/** "Client approval states" (Wajib) — peta transisi terpisah dari `MiceEventStatus` (pola sama `QuotationApprovalStatus`, D-049); `rejected` dapat direvisi-dan-diajukan-ulang (`submitted`), `approved` bersifat stabil (perubahan lanjutan lewat "Change order", bukan re-approval). */
const MICE_APPROVAL_TRANSITIONS: Record<MiceApprovalStatus, MiceApprovalStatus[]> = {
  draft: ['submitted'],
  submitted: ['approved', 'rejected'],
  approved: [],
  rejected: ['submitted'],
}

export function getMiceApprovalTransitions(current: MiceApprovalStatus): MiceApprovalStatus[] {
  return MICE_APPROVAL_TRANSITIONS[current] ?? []
}

/** Catatan wajib untuk `rejected` (alasan penolakan client). */
export function updateMiceClientApproval(eventId: string, newStatus: MiceApprovalStatus, actorId: string, note?: string): MiceEvent | undefined {
  const event = getMiceEventById(eventId)
  if (!event) return undefined
  if (!getMiceApprovalTransitions(event.clientApprovalStatus).includes(newStatus)) return undefined
  if (newStatus === 'rejected' && !note?.trim()) return undefined

  event.clientApprovalStatus = newStatus
  event.updatedAt = DEMO_REFERENCE_DATE

  const actor = getUserById(actorId)
  ACTIVITIES.push({
    id: nextSequentialId('ACT-', ACTIVITIES),
    projectId: event.projectId,
    message: `MICE Event ${event.id} — Client Approval diubah menjadi "${newStatus}" oleh ${actor?.name ?? actorId}.${note ? ` Catatan: ${note}` : ''}`,
    isChange: false, reviewed: true, createdAt: DEMO_REFERENCE_DATE,
  })
  return event
}

/** Toggle langsung item checklist (setup/teardown/rehearsal/permit) tanpa perlu dialog Edit — guard terminal sama seperti `updateMiceEvent`. */
export function toggleMiceChecklistItem(eventId: string, index: number): MiceEvent | undefined {
  const event = getMiceEventById(eventId)
  if (!event || MICE_EVENT_TERMINAL_STATUSES.includes(event.status) || !event.checklist[index]) return undefined
  event.checklist[index].isDone = !event.checklist[index].isDone
  event.updatedAt = DEMO_REFERENCE_DATE
  return event
}

/** Toggle langsung status deliverable (Wajib) tanpa perlu dialog Edit — guard terminal sama seperti `updateMiceEvent`. */
export function toggleMiceDeliverable(eventId: string, index: number): MiceEvent | undefined {
  const event = getMiceEventById(eventId)
  if (!event || MICE_EVENT_TERMINAL_STATUSES.includes(event.status) || !event.deliverables[index]) return undefined
  event.deliverables[index].isDelivered = !event.deliverables[index].isDelivered
  event.updatedAt = DEMO_REFERENCE_DATE
  return event
}

/**
 * Vendor Management (Section 13 lama/Prompt 13 — penomoran berbeda dari "Section 13 — Ticketing" roadmap
 * baru di atas, lihat `docs/mockup-implementation-state.md` bagian 0 soal skema penomoran ganda) —
 * create-mock master data vendor, melanjutkan pola `reactive()`
 * Section 07-12. `canManage('vendor')` sudah presisi (`ROLE_MODULE_ACCESS.vendor` = `ADMIN` Super Admin,
 * `VIEW` seluruh role lain — tidak ada rank `APPROVE` yang membocorkan akses seperti CRM/Project, jadi
 * TIDAK perlu pengecualian sempit tambahan seperti `canManageParty`/`canManageTravelers`).
 */
export function createVendor(input: { name: string; serviceType: ServiceTypeKey; contactName: string; contactPhone?: string; category?: string }): Vendor {
  const vendor: Vendor = { id: nextSequentialId('VND-', VENDORS), status: 'active', ...input }
  VENDORS.push(vendor)
  return vendor
}

/** `category`/`status`/`documents` (Section 17, aditif) — edit master data vendor, dipakai Vendor Detail. */
export function updateVendor(id: string, patch: Partial<Pick<Vendor, 'name' | 'category' | 'status' | 'contactName' | 'contactPhone'>>): Vendor | undefined {
  const vendor = getVendorById(id)
  if (!vendor) return undefined
  Object.assign(vendor, patch)
  return vendor
}

export function createVendorDocument(input: { vendorId: string; name: string; type: string }): VendorDocument {
  const document: VendorDocument = { id: nextSequentialId('VDOC-', VENDOR_DOCUMENTS), uploadedAt: DEMO_REFERENCE_DATE, ...input }
  VENDOR_DOCUMENTS.push(document)
  return document
}

export function createVendorContact(input: { vendorId: string; name: string; title: string; email?: string; phone?: string }): VendorContact {
  const contact: VendorContact = { id: nextSequentialId('VCT-', VENDOR_CONTACTS), ...input }
  VENDOR_CONTACTS.push(contact)
  return contact
}

/** Submit quotation baru (mock) — status awal selalu `submitted`, keputusan Accept/Reject terjadi di tab "Vendors" Project Detail. */
export function submitVendorQuotation(input: { vendorId: string; projectId: string; serviceId?: string; serviceType: ServiceTypeKey; amountIdr: number; notes?: string }): VendorQuotation {
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
export function acceptVendorQuotation(quotationId: string): VendorQuotation | undefined {
  const quotation = VENDOR_QUOTATIONS.find(item => item.id === quotationId)
  if (!quotation) return undefined
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
    createdAt: DEMO_REFERENCE_DATE,
  })

  return quotation
}

export function rejectVendorQuotation(quotationId: string): VendorQuotation | undefined {
  const quotation = VENDOR_QUOTATIONS.find(item => item.id === quotationId)
  if (!quotation) return undefined
  quotation.status = 'rejected'
  VENDOR_ACTIVITIES.push({
    id: nextSequentialId('VACT-', VENDOR_ACTIVITIES),
    vendorId: quotation.vendorId,
    message: `Quotation ${findStatusOption(SERVICE_TYPES, quotation.serviceType).label} untuk project ${quotation.projectId} ditolak.`,
    createdAt: DEMO_REFERENCE_DATE,
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

export function createChangeEntry(input: CreateChangeEntryInput): ActivityEntry {
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
    approvalStatus: 'pending',
  }
  ACTIVITIES.push(entry)
  return entry
}

/** Approve/Reject dipanggil hanya dari UI yang sudah memfilter `canApprove('project')` (Management/Super Admin, docs bagian 5.1 "Approve"). */
export function approveChangeEntry(entryId: string, approverId: string): ActivityEntry | undefined {
  const entry = ACTIVITIES.find(item => item.id === entryId)
  if (!entry || entry.approvalStatus !== 'pending') return undefined
  entry.approvalStatus = 'approved'
  entry.reviewed = true
  entry.approvedBy = approverId
  return entry
}

export function rejectChangeEntry(entryId: string, approverId: string): ActivityEntry | undefined {
  const entry = ACTIVITIES.find(item => item.id === entryId)
  if (!entry || entry.approvalStatus !== 'pending') return undefined
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
export function getLeadActivities(leadId: string) {
  return LEAD_ACTIVITIES.filter(activity => activity.leadId === leadId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}
export function getLeadFollowUps(leadId: string) {
  return getLeadActivities(leadId).filter(activity => Boolean(activity.dueAt))
}

export function createLead(input: { name: string; companyName?: string; source: Lead['source']; ownerId: string; phone?: string; email?: string }): Lead {
  const lead: Lead = {
    id: nextSequentialId('LED-', LEADS),
    stage: 'new',
    createdAt: DEMO_REFERENCE_DATE,
    lastUpdatedAt: DEMO_REFERENCE_DATE,
    archived: false,
    ...input,
  }
  LEADS.push(lead)
  return lead
}

export function createLeadActivity(input: { leadId: string; type: PartyActivityType; message: string; ownerId: string; dueAt?: string }): LeadActivity {
  const activity: LeadActivity = { id: nextSequentialId('LACT-', LEAD_ACTIVITIES), createdAt: DEMO_REFERENCE_DATE, ...input }
  LEAD_ACTIVITIES.push(activity)
  const lead = getLeadById(input.leadId)
  if (lead) lead.lastUpdatedAt = DEMO_REFERENCE_DATE
  return activity
}

export function archiveLead(leadId: string): Lead | undefined {
  const lead = getLeadById(leadId)
  if (!lead) return undefined
  lead.archived = true
  lead.lastUpdatedAt = DEMO_REFERENCE_DATE
  return lead
}

/** "Reopen" (Section 04) — kebalikan `archiveLead`, tidak mengubah `stage`/data qualification apa pun. */
export function reopenLead(leadId: string): Lead | undefined {
  const lead = getLeadById(leadId)
  if (!lead) return undefined
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

export function updateLeadContact(leadId: string, patch: LeadContactInput): Lead | undefined {
  const lead = getLeadById(leadId)
  if (!lead) return undefined
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
export function getLeadDuplicateCandidates(input: { phone?: string; email?: string; excludeLeadId?: string }): Lead[] {
  const phoneNorm = input.phone?.trim()
  const emailNorm = input.email?.trim().toLowerCase()
  if (!phoneNorm && !emailNorm) return []
  return LEADS.filter(lead =>
    lead.id !== input.excludeLeadId
    && !lead.archived
    && ((Boolean(phoneNorm) && lead.phone?.trim() === phoneNorm) || (Boolean(emailNorm) && (lead.email ?? '').trim().toLowerCase() === emailNorm)),
  )
}

/**
 * "Merge suggestion" (Section 04) — TIDAK menggabungkan field data (di luar scope, kompleksitas tinggi
 * untuk mockup), melainkan pola realistis: Sales meninjau kandidat duplikat lalu meng-archive lead
 * duplikat dengan catatan referensi ke lead canonical yang dipertahankan — kedua lead tetap ada sebagai
 * histori (mengikuti hard rule "jangan menghapus data"), hanya status `archived` yang berubah.
 */
export function mergeLeadAsDuplicate(duplicateLeadId: string, canonicalLeadId: string, actorId: string): Lead | undefined {
  if (duplicateLeadId === canonicalLeadId) return undefined
  const duplicate = getLeadById(duplicateLeadId)
  const canonical = getLeadById(canonicalLeadId)
  if (!duplicate || !canonical || duplicate.archived) return undefined
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

export function updateLeadQualification(leadId: string, patch: LeadQualificationInput): Lead | undefined {
  const lead = getLeadById(leadId)
  if (!lead) return undefined
  Object.assign(lead, patch)
  lead.lastUpdatedAt = DEMO_REFERENCE_DATE
  return lead
}

/**
 * Field wajib (Prompt 20-4/5) sebelum Lead dapat di-qualify — dicek tombol "Qualify & Create Opportunity"
 * (disabled + warning list bila belum lengkap), mengikuti pola `getOpportunityMissingRequirements` (Section 09).
 */
export function getLeadMissingQualification(leadId: string): string[] {
  const lead = getLeadById(leadId)
  if (!lead) return ['Lead tidak ditemukan']
  const missing: string[] = []
  if (!lead.serviceCategory) missing.push('Jenis kebutuhan')
  if (!lead.destination) missing.push('Destinasi belum diisi')
  if (!lead.travelStartDate || !lead.travelEndDate) missing.push('Periode perjalanan belum diisi')
  if (!lead.travelerEstimate) missing.push('Estimasi traveler belum diisi')
  if (!lead.serviceScope || lead.serviceScope.length === 0) missing.push('Service scope belum dipilih')
  if (!lead.handedOverTo) missing.push('Account Executive belum dipilih')
  if (!lead.requirementSummary) missing.push('Ringkasan kebutuhan belum diisi')
  return missing
}

/** "Mark as Unqualified" (Prompt 20-4) — terminal untuk mockup ini, tidak membuat Party/Opportunity. */
export function markLeadUnqualified(leadId: string, note?: string): Lead | undefined {
  const lead = getLeadById(leadId)
  if (!lead) return undefined
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
export function qualifyLeadAndCreateOpportunity(leadId: string): Opportunity | undefined {
  const lead = getLeadById(leadId)
  if (!lead || lead.opportunityId || getLeadMissingQualification(leadId).length > 0) return undefined
  const accountExecutiveId = lead.handedOverTo!

  let party = lead.companyName ? PARTIES.find(p => p.name.toLowerCase() === lead.companyName!.toLowerCase()) : undefined
  if (!party) {
    party = {
      id: nextSequentialId('PTY-', PARTIES),
      name: lead.companyName || lead.name,
      lifecycleStatus: 'prospect',
      createdAt: DEMO_REFERENCE_DATE,
      accountOwnerId: accountExecutiveId,
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
    expectedCloseDate: lead.expectedCloseDate,
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
    ownerId: accountExecutiveId,
  })

  return opportunity
}

/** Vendor Product catalog (Prompt 19 — area Supplier/External Partners). */
export const getVendorProducts = (vendorId: string) => VENDOR_PRODUCTS.filter(product => product.vendorId === vendorId)

export function createVendorProduct(input: { vendorId: string; name: string; category: ServiceTypeKey; description?: string; priceIdr?: number }): VendorProduct {
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
export function getCostSheetBreakdown(costSheet: CostSheet): CostSheetBreakdown {
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

export function createProductTemplate(input: CreateProductTemplateInput): ProductTemplate {
  const product: ProductTemplate = {
    id: nextSequentialId('PRD-', PRODUCT_TEMPLATES),
    status: 'draft',
    serviceAlternatives: [],
    createdAt: DEMO_REFERENCE_DATE,
    ...input,
  }
  PRODUCT_TEMPLATES.push(product)
  return product
}

export type ProductTemplateInput = Partial<Omit<CreateProductTemplateInput, 'createdBy'>>

export function updateProductTemplate(id: string, patch: ProductTemplateInput): ProductTemplate | undefined {
  const product = getProductTemplateById(id)
  if (!product) return undefined
  Object.assign(product, patch)
  product.updatedAt = DEMO_REFERENCE_DATE
  return product
}

const PRODUCT_TEMPLATE_STATUS_TRANSITIONS: Record<ProductTemplateStatus, ProductTemplateStatus[]> = {
  draft: ['active', 'archived'],
  active: ['archived'],
  archived: [],
}

export function getProductTemplateStatusTransitions(current: ProductTemplateStatus): ProductTemplateStatus[] {
  return PRODUCT_TEMPLATE_STATUS_TRANSITIONS[current] ?? []
}

export function updateProductTemplateStatus(id: string, newStatus: ProductTemplateStatus): ProductTemplate | undefined {
  const product = getProductTemplateById(id)
  if (!product) return undefined
  if (!getProductTemplateStatusTransitions(product.status).includes(newStatus)) return undefined
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
export function createCostSheet(input: CreateCostSheetInput): CostSheet {
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
    lineItems: seededLineItems,
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
export function updateCostSheet(id: string, patch: CostSheetInput): CostSheet | undefined {
  const costSheet = getCostSheetById(id)
  if (!costSheet || costSheet.status === 'final') return undefined
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
export function duplicateCostSheetVersion(id: string): CostSheet | undefined {
  const costSheet = getCostSheetById(id)
  if (!costSheet) return undefined
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
export function applyCostSheetToQuotation(costSheetId: string, actorId: string): Quotation | undefined {
  const costSheet = getCostSheetById(costSheetId)
  if (!costSheet || costSheet.appliedToQuotationId || !costSheet.opportunityId) return undefined
  const opportunity = getOpportunityById(costSheet.opportunityId)
  if (!opportunity) return undefined

  const breakdown = getCostSheetBreakdown(costSheet)
  const serviceBreakdown = costSheet.lineItems.map(item => ({
    service: item.service,
    description: item.description,
    amountIdr: item.costPerPaxIdr * costSheet.travelerCount,
  }))

  let quotation = getQuotationByOpportunity(opportunity.id)
  if (quotation) {
    if (quotation.approvalStatus === 'submitted' || quotation.approvalStatus === 'approved') return undefined
    Object.assign(quotation, {
      amountIdr: breakdown.totalSellIdr,
      estimatedCostIdr: breakdown.costWithContingencyIdr,
      estimatedMarginIdr: breakdown.marginIdr,
      currency: costSheet.currency,
      serviceBreakdown,
    })
  } else {
    quotation = createQuotation(opportunity.id, breakdown.totalSellIdr)
    Object.assign(quotation, {
      estimatedCostIdr: breakdown.costWithContingencyIdr,
      estimatedMarginIdr: breakdown.marginIdr,
      currency: costSheet.currency,
      serviceBreakdown,
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
    ownerId: actorId,
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
export function getRfqsForVendor(vendorId: string): RFQ[] {
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

export function createRfq(input: CreateRfqInput): RFQ {
  const rfq: RFQ = { id: nextSequentialId('RFQ-', RFQS), status: 'draft', createdAt: DEMO_REFERENCE_DATE, ...input }
  RFQS.push(rfq)
  return rfq
}

const RFQ_TERMINAL_STATUSES: RFQStatus[] = ['closed']

export type RfqInput = Partial<Pick<RFQ, 'title' | 'lineItems' | 'dueAt' | 'notes'>>
export function updateRfq(id: string, patch: RfqInput): RFQ | undefined {
  const rfq = getRfqById(id)
  if (!rfq || RFQ_TERMINAL_STATUSES.includes(rfq.status)) return undefined
  Object.assign(rfq, patch)
  rfq.updatedAt = DEMO_REFERENCE_DATE
  return rfq
}

/** "Sent" (Wajib) — kirim RFQ ke vendor terpilih, membuat `RFQInvitation` per vendor. Hanya dari `draft`. */
export function sendRfqToVendors(rfqId: string, vendorIds: string[]): RFQ | undefined {
  const rfq = getRfqById(rfqId)
  if (!rfq || rfq.status !== 'draft' || vendorIds.length === 0) return undefined
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
export function submitRfqResponse(input: SubmitRfqResponseInput): RFQResponse | undefined {
  const rfq = getRfqById(input.rfqId)
  if (!rfq || RFQ_TERMINAL_STATUSES.includes(rfq.status)) return undefined
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
  if (invitation) invitation.status = 'responded'
  if (rfq.status === 'sent') rfq.status = 'responses-in'
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
  closed: [],
}
export function getRfqStatusTransitions(current: RFQStatus): RFQStatus[] {
  return RFQ_MANUAL_TRANSITIONS[current] ?? []
}

export function moveRfqStatus(rfqId: string, newStatus: RFQStatus): RFQ | undefined {
  const rfq = getRfqById(rfqId)
  if (!rfq || !getRfqStatusTransitions(rfq.status).includes(newStatus)) return undefined
  rfq.status = newStatus
  rfq.updatedAt = DEMO_REFERENCE_DATE
  return rfq
}

/** "Clarification thread per vendor" (Wajib) — dua arah; pesan dari `procurement` menjaga RFQ tetap/berpindah ke status `clarification` bila sebelumnya `responses-in`/`comparison`. */
export function addRfqClarificationMessage(input: { rfqId: string; vendorId: string; from: 'procurement' | 'supplier'; message: string }): RFQClarificationMessage | undefined {
  const rfq = getRfqById(input.rfqId)
  if (!rfq || RFQ_TERMINAL_STATUSES.includes(rfq.status) || !input.message.trim()) return undefined
  const entry: RFQClarificationMessage = { id: nextSequentialId('RFQCLR-', RFQ_CLARIFICATIONS), createdAt: DEMO_REFERENCE_DATE, ...input, message: input.message.trim() }
  RFQ_CLARIFICATIONS.push(entry)
  if (input.from === 'procurement' && (rfq.status === 'comparison' || rfq.status === 'responses-in')) rfq.status = 'clarification'
  rfq.updatedAt = DEMO_REFERENCE_DATE
  return entry
}

/**
 * "Formal Select action" (Wajib) — vendor pemenang RFQ: response terpilih ditandai `selected`, response
 * lain untuk RFQ yang sama otomatis `rejected` (satu vendor per RFQ, pola sama `acceptVendorQuotation`
 * Section 13), `RFQ.selectedVendorId` diisi, status → `selected`. Dicatat sebagai `ActivityEntry` pada
 * project terkait bila `projectId` ada.
 */
export function selectRfqVendor(rfqId: string, vendorId: string, actorId: string): RFQ | undefined {
  const rfq = getRfqById(rfqId)
  if (!rfq || !['responses-in', 'comparison', 'clarification'].includes(rfq.status)) return undefined
  const winningResponse = getRfqResponseByVendor(rfqId, vendorId)
  if (!winningResponse) return undefined

  RFQ_RESPONSES.forEach((resp) => {
    if (resp.rfqId !== rfqId) return
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
      isChange: false, reviewed: true, createdAt: DEMO_REFERENCE_DATE,
    })
  }
  return rfq
}

export function closeRfq(rfqId: string): RFQ | undefined {
  const rfq = getRfqById(rfqId)
  if (!rfq || rfq.status !== 'selected') return undefined
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
export function createServiceOrder(input: CreateServiceOrderInput): ServiceOrder {
  const serviceOrder: ServiceOrder = { id: nextSequentialId('SO-', SERVICE_ORDERS), status: 'draft', createdAt: DEMO_REFERENCE_DATE, ...input }
  SERVICE_ORDERS.push(serviceOrder)
  return serviceOrder
}

/** Guard: `fulfilled`/`cancelled` bersifat terminal — pola sama section 13-16 (D-070/D-071/D-072/D-073). */
const SERVICE_ORDER_TERMINAL_STATUSES: ServiceOrderStatus[] = ['fulfilled', 'cancelled']
export type ServiceOrderInput = Partial<Pick<ServiceOrder, 'lineItems' | 'netCostIdr' | 'sellPriceIdr'>>
export function updateServiceOrder(id: string, patch: ServiceOrderInput): ServiceOrder | undefined {
  const so = getServiceOrderById(id)
  if (!so || SERVICE_ORDER_TERMINAL_STATUSES.includes(so.status)) return undefined
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
  cancelled: [],
}
export function getServiceOrderStatusTransitions(current: ServiceOrderStatus): ServiceOrderStatus[] {
  return SERVICE_ORDER_TRANSITIONS[current] ?? []
}

/**
 * "Acknowledgment dan fulfillment status" (Wajib) — dipanggil dari `/procurement/service-orders/[id]`
 * (internal, seluruh transisi) MAUPUN `/supplier/service-orders/[id]` (self-service, hanya `acknowledged`
 * dan `fulfilled` yang relevan untuk supplier — UI membatasi tombol yang ditampilkan). Reason wajib untuk
 * `cancelled` (dampak besar, pola sama section 13-16). Dicatat sebagai `ActivityEntry` bila `projectId` ada.
 */
export function updateServiceOrderStatus(id: string, newStatus: ServiceOrderStatus, actorId: string, reason?: string): ServiceOrder | undefined {
  const so = getServiceOrderById(id)
  if (!so) return undefined
  if (!getServiceOrderStatusTransitions(so.status).includes(newStatus)) return undefined
  if (newStatus === 'cancelled' && !reason?.trim()) return undefined

  const fromLabel = so.status
  so.status = newStatus
  so.updatedAt = DEMO_REFERENCE_DATE
  if (newStatus === 'acknowledged') so.acknowledgedAt = DEMO_REFERENCE_DATE
  if (newStatus === 'fulfilled') so.fulfilledAt = DEMO_REFERENCE_DATE
  if (reason) so.statusReason = reason.trim()

  if (so.projectId) {
    const actor = getUserById(actorId)
    const vendor = getVendorById(so.vendorId)
    ACTIVITIES.push({
      id: nextSequentialId('ACT-', ACTIVITIES),
      projectId: so.projectId,
      message: `Service Order ${so.id} (${vendor?.name ?? so.vendorId}) status diubah dari "${fromLabel}" menjadi "${newStatus}" oleh ${actor?.name ?? actorId}.${reason ? ` Alasan: ${reason}` : ''}`,
      isChange: false, reviewed: true, createdAt: DEMO_REFERENCE_DATE,
    })
  }
  return so
}

/** "Amendment" (Wajib) — riwayat perubahan Service Order, append-only (`ServiceOrderAmendment`). Hanya dari `acknowledged`/`amended` (sudah diakui supplier terlebih dulu). */
export function amendServiceOrder(id: string, reason: string, actorId: string, patch?: ServiceOrderInput): ServiceOrder | undefined {
  const so = getServiceOrderById(id)
  if (!so || !['acknowledged', 'amended'].includes(so.status) || !reason.trim()) return undefined
  if (patch) Object.assign(so, patch)
  so.status = 'amended'
  so.updatedAt = DEMO_REFERENCE_DATE
  SERVICE_ORDER_AMENDMENTS.push({ id: nextSequentialId('SOA-', SERVICE_ORDER_AMENDMENTS), serviceOrderId: id, reason: reason.trim(), changedAt: DEMO_REFERENCE_DATE, changedBy: actorId })

  if (so.projectId) {
    const actor = getUserById(actorId)
    ACTIVITIES.push({
      id: nextSequentialId('ACT-', ACTIVITIES),
      projectId: so.projectId,
      message: `Service Order ${so.id} diamandemen oleh ${actor?.name ?? actorId}. Alasan: ${reason.trim()}`,
      isChange: true, reviewed: false, createdAt: DEMO_REFERENCE_DATE,
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

export function submitSupplierInvoice(input: { serviceOrderId: string; vendorId: string; amountIdr: number; note?: string }): SupplierInvoice | undefined {
  const so = getServiceOrderById(input.serviceOrderId)
  if (!so || so.status !== 'fulfilled' || so.vendorId !== input.vendorId || input.amountIdr <= 0) return undefined
  const invoice: SupplierInvoice = { id: nextSequentialId('SINV-', SUPPLIER_INVOICES), status: 'submitted', submittedAt: DEMO_REFERENCE_DATE, ...input }
  SUPPLIER_INVOICES.push(invoice)
  return invoice
}

/** Review internal (`procurement`/`finance`) — `approved`/`rejected` bersifat terminal, `reviewNote` wajib untuk `rejected`. */
export function reviewSupplierInvoice(id: string, newStatus: SupplierInvoiceStatus, actorId: string, reviewNote?: string): SupplierInvoice | undefined {
  const invoice = SUPPLIER_INVOICES.find(inv => inv.id === id)
  if (!invoice || invoice.status === 'approved' || invoice.status === 'rejected') return undefined
  if (newStatus === 'rejected' && !reviewNote?.trim()) return undefined
  invoice.status = newStatus
  invoice.reviewedAt = DEMO_REFERENCE_DATE
  invoice.reviewedBy = actorId
  if (reviewNote) invoice.reviewNote = reviewNote.trim()
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

export function getVendorProcurementPerformance(vendorId: string): VendorProcurementPerformance {
  const invitations = RFQ_INVITATIONS.filter(inv => inv.vendorId === vendorId)
  const responses = RFQ_RESPONSES.filter(resp => resp.vendorId === vendorId)
  const wins = responses.filter(resp => resp.status === 'selected')

  const responseDurations = responses
    .map((resp) => {
      const invitation = invitations.find(inv => inv.rfqId === resp.rfqId)
      if (!invitation) return undefined
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
    quotationHistory: [...responses].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)),
  }
}

/** Seluruh vendor yang punya aktivitas RFQ atau Service Order — dipakai `/procurement/performance`. */
export function getVendorsWithProcurementActivity(): Vendor[] {
  const ids = new Set<string>([
    ...RFQ_INVITATIONS.map(inv => inv.vendorId),
    ...SERVICE_ORDERS.map(so => so.vendorId),
  ])
  return VENDORS.filter(vendor => ids.has(vendor.id))
}
