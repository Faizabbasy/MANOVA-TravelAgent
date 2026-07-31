import { PARTIES, CONTACTS, PARTY_ACTIVITIES } from './parties'
import { USERS } from './users'
import { OPPORTUNITIES, QUOTATIONS } from './opportunities'
import { VENDORS, VENDOR_CONTACTS, VENDOR_QUOTATIONS, VENDOR_ACTIVITIES, VENDOR_PRODUCTS } from './vendors'
import { PROJECTS, PROJECT_SERVICES, TRAVELER_GROUPS, TRAVELERS, ROOM_ASSIGNMENTS, ITINERARY_ITEMS } from './projects'
import { INVOICES, PAYMENTS } from './finance'
import { ACTIVITIES, DOCUMENTS, TASKS, SYSTEM_EVENTS } from './activity'
import { LEADS, LEAD_ACTIVITIES } from './leads'
import { isProjectNeedingAttention, isTaskUpcoming, isFollowUpUpcoming, isTravelerDocumentMissing, DEMO_REFERENCE_DATE } from '~/utils/attention'
import { SERVICE_STATUSES, SERVICE_TYPES, findStatusOption } from '~/constants/status'
import type { Project, ServiceTypeKey, ServiceStatus, Traveler } from '~/types/project'
import type { Party, ContactPerson, PartyActivity, PartyActivityType } from '~/types/party'
import type { Opportunity, OpportunityStage, Quotation, OpportunityWorkflowStatus } from '~/types/opportunity'
import type { Vendor, VendorContact, VendorQuotation, VendorProduct } from '~/types/vendor'
import type { ActivityEntry, ChangeCategory } from '~/types/activity'
import type { Lead, LeadActivity } from '~/types/lead'

export {
  USERS,
  PARTIES, CONTACTS, PARTY_ACTIVITIES,
  OPPORTUNITIES, QUOTATIONS,
  VENDORS, VENDOR_CONTACTS, VENDOR_QUOTATIONS, VENDOR_ACTIVITIES, VENDOR_PRODUCTS,
  PROJECTS, PROJECT_SERVICES, TRAVELER_GROUPS, TRAVELERS, ROOM_ASSIGNMENTS, ITINERARY_ITEMS,
  INVOICES, PAYMENTS,
  ACTIVITIES, DOCUMENTS, TASKS, SYSTEM_EVENTS,
  LEADS, LEAD_ACTIVITIES,
}

/** Helper selector sederhana (Prompt 5-H) — hindari query ad-hoc berulang di tiap halaman. */

export const getUserById = (id: string) => USERS.find(user => user.id === id)
export const getPartyById = (id: string) => PARTIES.find(party => party.id === id)
export const getContactsByParty = (partyId: string) => CONTACTS.filter(contact => contact.partyId === partyId)
export const getOpportunitiesByParty = (partyId: string) => OPPORTUNITIES.filter(opp => opp.partyId === partyId)
export const getOpportunityById = (id: string) => OPPORTUNITIES.find(opp => opp.id === id)
export const getProjectsByParty = (partyId: string) => PROJECTS.filter(project => project.partyId === partyId)
export const getQuotationByOpportunity = (opportunityId: string) => QUOTATIONS.find(quotation => quotation.opportunityId === opportunityId)
export const getVendorById = (id: string) => VENDORS.find(vendor => vendor.id === id)
export const getVendorContacts = (vendorId: string) => VENDOR_CONTACTS.filter(contact => contact.vendorId === vendorId)
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
export const getTravelerGroups = (projectId: string) => TRAVELER_GROUPS.filter(group => group.projectId === projectId)
export const getTravelers = (projectId: string) => TRAVELERS.filter(traveler => traveler.projectId === projectId)
export const getTravelersByGroup = (groupId: string) => TRAVELERS.filter(traveler => traveler.groupId === groupId)
export const getRoomAssignments = (projectId: string) => ROOM_ASSIGNMENTS.filter(room => room.projectId === projectId)

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
}

export function updateQuotationDetails(quotationId: string, patch: QuotationDetailInput): Quotation | undefined {
  const quotation = QUOTATIONS.find(q => q.id === quotationId)
  if (!quotation) return undefined
  if (quotation.approvalStatus === 'submitted' || quotation.approvalStatus === 'approved') return undefined
  Object.assign(quotation, patch)
  return quotation
}

/**
 * Commercial Approval (Prompt 19 — Change Request). Terpisah dari `approveOpportunityWon`/
 * `rejectOpportunityWon` (Section 09, gerbang final "Mark as Won") — quotation harus `approved` di sini
 * dulu sebelum Opportunity boleh diajukan ke stage `won-requested` (digerbangi di UI Opportunity Detail).
 */
export function submitQuotationForApproval(quotationId: string): Quotation | undefined {
  const quotation = QUOTATIONS.find(q => q.id === quotationId)
  if (!quotation) return undefined
  quotation.approvalStatus = 'submitted'
  return quotation
}

export function approveQuotation(quotationId: string, approverId: string, note?: string): Quotation | undefined {
  const quotation = QUOTATIONS.find(q => q.id === quotationId)
  if (!quotation || quotation.approvalStatus !== 'submitted') return undefined
  quotation.approvalStatus = 'approved'
  quotation.approvedBy = approverId
  quotation.approvalNote = note
  return quotation
}

export function rejectQuotation(quotationId: string, approverId: string, note: string): Quotation | undefined {
  const quotation = QUOTATIONS.find(q => q.id === quotationId)
  if (!quotation || quotation.approvalStatus !== 'submitted') return undefined
  quotation.approvalStatus = 'rejected'
  quotation.approvedBy = approverId
  quotation.approvalNote = note
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
 * Approve Won — dipanggil hanya dari UI yang sudah memfilter role `canApprove('crm')` (Management/Super Admin).
 * Guard "duplicate prevention": jika opportunity sudah punya `projectId`, kembalikan project yang sudah ada
 * tanpa membuat duplikat. Guard stage: hanya bisa dari `won-requested`.
 */
export function approveOpportunityWon(opportunityId: string, approverId: string): Project | undefined {
  const opportunity = getOpportunityById(opportunityId)
  if (!opportunity || opportunity.stage !== 'won-requested') return undefined
  if (opportunity.projectId) return getProjectById(opportunity.projectId)
  if (getOpportunityMissingRequirements(opportunityId).length > 0) return undefined

  const quotation = getQuotationByOpportunity(opportunityId)!
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

  if (party && party.lifecycleStatus === 'prospect') party.lifecycleStatus = 'client'

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
 * Traveler and Participant (Section 11) — create/edit/remove/import mock, melanjutkan pola mutasi
 * `reactive()` Section 07-10. Tidak menyentuh `project.travelerCount` (headcount resmi skenario demo,
 * lihat catatan cakupan data di `app/data/projects.ts`) — menambah/menghapus profil traveler tidak
 * mengubah angka itu, konsisten dengan keduanya sebagai konsep terpisah (headcount vs profil tercatat).
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
 * Import mock (Section 11) — mensimulasikan hasil import file traveler, BUKAN parsing file sungguhan
 * (larangan fabrikasi integrasi nyata, D-006). Baris yang dihasilkan sengaja tanpa data dokumen/kontak
 * darurat agar langsung terlihat sebagai "belum lengkap" lewat missing-document indicator — merefleksikan
 * kondisi realistis hasil import massal yang butuh dilengkapi manual satu per satu.
 */
export function importTravelersMock(projectId: string, count = 3): Traveler[] {
  const existingCount = getTravelers(projectId).length
  const created: Traveler[] = []
  for (let i = 1; i <= count; i++) {
    created.push(createTraveler({ projectId, name: `Peserta Import ${existingCount + i}` }))
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
 * Vendor Management (Section 13) — create-mock master data vendor, melanjutkan pola `reactive()`
 * Section 07-12. `canManage('vendor')` sudah presisi (`ROLE_MODULE_ACCESS.vendor` = `ADMIN` Super Admin,
 * `VIEW` seluruh role lain — tidak ada rank `APPROVE` yang membocorkan akses seperti CRM/Project, jadi
 * TIDAK perlu pengecualian sempit tambahan seperti `canManageParty`/`canManageTravelers`).
 */
export function createVendor(input: { name: string; serviceType: ServiceTypeKey; contactName: string; contactPhone?: string }): Vendor {
  const vendor: Vendor = { id: nextSequentialId('VND-', VENDORS), ...input }
  VENDORS.push(vendor)
  return vendor
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
