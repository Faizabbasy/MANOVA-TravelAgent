import { PARTIES, CONTACTS, PARTY_ACTIVITIES } from './parties'
import { USERS } from './users'
import { OPPORTUNITIES, QUOTATIONS } from './opportunities'
import { VENDORS } from './vendors'
import { PROJECTS, PROJECT_SERVICES, TRAVELER_GROUPS, TRAVELERS } from './projects'
import { INVOICES, PAYMENTS } from './finance'
import { ACTIVITIES, DOCUMENTS, TASKS } from './activity'
import { isProjectNeedingAttention, isTaskUpcoming, isFollowUpUpcoming, DEMO_REFERENCE_DATE } from '~/utils/attention'
import type { Project, ServiceTypeKey } from '~/types/project'
import type { Party, ContactPerson, PartyActivity, PartyActivityType } from '~/types/party'
import type { Opportunity, OpportunityStage, Quotation } from '~/types/opportunity'

export {
  USERS,
  PARTIES, CONTACTS, PARTY_ACTIVITIES,
  OPPORTUNITIES, QUOTATIONS,
  VENDORS,
  PROJECTS, PROJECT_SERVICES, TRAVELER_GROUPS, TRAVELERS,
  INVOICES, PAYMENTS,
  ACTIVITIES, DOCUMENTS, TASKS,
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

export const getProjectById = (id: string) => PROJECTS.find(project => project.id === id)
export const getProjectServices = (projectId: string) => PROJECT_SERVICES.filter(service => service.projectId === projectId)
export const getTravelerGroups = (projectId: string) => TRAVELER_GROUPS.filter(group => group.projectId === projectId)
export const getTravelers = (projectId: string) => TRAVELERS.filter(traveler => traveler.projectId === projectId)

export const getInvoicesByProject = (projectId: string) => INVOICES.filter(invoice => invoice.projectId === projectId)
export const getPaymentsByInvoice = (invoiceId: string) => PAYMENTS.filter(payment => payment.invoiceId === invoiceId)

export const getActivitiesByProject = (projectId: string) => ACTIVITIES.filter(activity => activity.projectId === projectId)
export const getDocumentsByProject = (projectId: string) => DOCUMENTS.filter(document => document.projectId === projectId)
export const getTasksByProject = (projectId: string) => TASKS.filter(task => task.projectId === projectId)

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
