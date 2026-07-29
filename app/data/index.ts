import { USERS } from './users'
import { PARTIES, CONTACTS } from './parties'
import { OPPORTUNITIES, QUOTATIONS } from './opportunities'
import { VENDORS } from './vendors'
import { PROJECTS, PROJECT_SERVICES, TRAVELER_GROUPS, TRAVELERS } from './projects'
import { INVOICES, PAYMENTS } from './finance'
import { ACTIVITIES, DOCUMENTS, TASKS } from './activity'
import { isProjectNeedingAttention, isTaskUpcoming } from '~/utils/attention'
import type { ServiceTypeKey } from '~/types/project'

export {
  USERS,
  PARTIES, CONTACTS,
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
