import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * S12b-1 / S12d: these client and vendor portal screens write through the server — the local mutators must not come back. The rest of the
 * portal (travel requests, approvals, support, feedback, payment proofs… — S12c) still writes locally and is excluded
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
  'components/supplier/MyProductsPanel.vue'
]
const FORBIDDEN = [
  'createTraveler(', 'updateTraveler(', 'cancelTraveler(', 'replaceTraveler(', 'commitTravelerImport(', 'setTravelerVip(',
  'createRoomAssignment(', 'setRoomAssignmentTravelers(',
  'createClientDocument(', 'replaceClientDocument(', 'createCompanyDocument(', 'sendMessage(', 'markProjectMessagesRead(',
  'updateCompanyProfile(', 'createContact(', 'updateContact(', 'deleteContact(', 'raiseInvoiceDispute(',
  'createVendorProduct('
]
const used = (source: string, name: string) => new RegExp(`(?<![.\\w])${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(source)

describe('client portal writes go to the server (S12b-1)', () => {
  it('ignores the server versions', () => {
    expect(used('await clientCancelTraveler(api, p, id, r)', 'cancelTraveler(')).toBe(false)
    expect(used('cancelTraveler(id, reason)', 'cancelTraveler(')).toBe(true)
  })

  it.each(FILES)('%s', (file) => {
    const source = readFileSync(join(__dirname, file), 'utf8')
    expect(FORBIDDEN.filter(name => used(source, name))).toEqual([])
  })
})
