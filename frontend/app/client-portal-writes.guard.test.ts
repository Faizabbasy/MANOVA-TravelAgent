import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * S12b-1 / S12d: these client and vendor portal screens write through the server — the local mutators must not come back. The rest of the
 * portal (travel requests, approvals… — S12c) still writes locally and is excluded
 * from `no-local-sales.test.ts` as a whole.
 */
const FILES = [
  'components/client/ParticipantsListPanel.vue',
  'pages/client/participants/[id]/index.vue',
  'pages/client/project-orders/[id]/index.vue',
  'components/client/DocumentsListPanel.vue',
  'pages/client/messages/[projectId]/index.vue',
  'pages/client/company-profile/index.vue',
  'components/client/DashboardOverviewPanel.vue',
  'pages/client/billing/invoices/[id]/index.vue',
  // S12d: the vendor portal's product catalogue.
  'components/supplier/MyProductsPanel.vue',
  // S12b-2: change requests and the quotation response.
  'components/client/ChangeRequestsListPanel.vue',
  'pages/client/change-requests/[id]/index.vue',
  'pages/client/quotations/[id]/index.vue',
  // S12c-1: payment proofs, invoice viewed and sensitive profile changes.
  'pages/client/billing/index.vue',
  // S12c-2: support tickets and trip feedback.
  'components/client/SupportListPanel.vue',
  'pages/client/support/[id]/index.vue',
  'pages/client/feedback/[projectId]/index.vue',
  // S12c-5: comments, attachment names and change-request drafts.
  'pages/client/itineraries/[id]/index.vue',
  // S12c-3: travel requests and approvals.
  'components/client/TravelRequestForm.vue',
  'pages/client/travel-requests/[id]/index.vue',
  'pages/client/approvals/[id]/index.vue',
  // S12c-4: itinerary versions and trip announcements.
  'pages/client/trip-center/[projectId]/index.vue'
]
const FORBIDDEN = [
  'createTraveler(', 'updateTraveler(', 'cancelTraveler(', 'replaceTraveler(', 'commitTravelerImport(', 'setTravelerVip(',
  'createRoomAssignment(', 'setRoomAssignmentTravelers(',
  'createClientDocument(', 'replaceClientDocument(', 'createCompanyDocument(', 'sendMessage(', 'markProjectMessagesRead(',
  'updateCompanyProfile(', 'createContact(', 'updateContact(', 'deleteContact(', 'raiseInvoiceDispute(',
  'createVendorProduct(',
  'createChangeRequest(', 'submitChangeRequestDraft(', 'approveChangeRequestImpact(', 'rejectChangeRequestImpact(', 'cancelChangeRequest(',
  'runChangeRequestMockReview(', 'requestQuotationRevision(', 'createPartyActivity(',
  'submitPaymentProof(', 'runPaymentVerificationMock(', 'markInvoiceViewed(', 'submitSensitiveCompanyProfileChange(', 'runCompanyProfileVerificationMock(',
  'createSupportTicket(', 'replySupportTicket(', 'confirmSupportTicketResolution(', 'reopenSupportTicket(', 'rateSupportTicketResolution(',
  'saveFeedbackDraft(', 'submitFeedback(',
  'addChangeRequestComment(', 'addChangeRequestAttachmentMock(', 'addQuotationComment(', 'addQuotationAttachment(', 'addDocumentComment(',
  'saveChangeRequestDraft(', 'deleteChangeRequestDraft(', 'addItineraryComment(',
  'createTravelRequest(', 'updateTravelRequestDraft(', 'duplicateTravelRequest(', 'cancelTravelRequest(', 'submitTravelRequest(',
  'respondToTravelRequestClarification(', 'addTravelRequestAttachment(', 'approveClientApproval(', 'rejectClientApproval(', 'requestClientApprovalRevision(',
  'approveItineraryVersion(', 'requestItineraryRevision(', 'confirmTripAnnouncement('
]
const read = (file: string) => readFileSync(join(__dirname, file), 'utf8')
const used = (source: string, name: string) => new RegExp(`(?<![.\\w])${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(source)

describe('client portal writes go to the server (S12b-1)', () => {
  it('ignores the server versions', () => {
    expect(used('await clientCancelTraveler(api, p, id, r)', 'cancelTraveler(')).toBe(false)
    expect(used('cancelTraveler(id, reason)', 'cancelTraveler(')).toBe(true)
  })

  it.each(FILES)('%s', (file) => {
    const source = read(file)
    expect(FORBIDDEN.filter(name => used(source, name))).toEqual([])
  })
})

describe('the vendor portal never shows MANOVA selling prices (S12d review)', () => {
  it('pages/supplier/service-orders/[id]/index.vue', () => {
    const source = read('pages/supplier/service-orders/[id]/index.vue')
    expect(source.includes('sellPriceIdr')).toBe(false)
  })
})

describe('the client support screens follow staff changes (S12c-2 review)', () => {
  it.each(['components/client/SupportListPanel.vue', 'pages/client/support/[id]/index.vue'])('%s reloads tickets from the server when opened', (file) => {
    expect(read(file)).toMatch(/useClientSupportSync\(\)[\s\S]*load\(true\)/)
  })
})
