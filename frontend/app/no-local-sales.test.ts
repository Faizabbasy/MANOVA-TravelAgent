import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

/** Leads, their activities and client quotations live on the server (S6a): screens never call the local mutators. */
const FORBIDDEN = [
  'createLead(', 'updateLeadContact(', 'updateLeadQualification(', 'archiveLead(', 'reopenLead(', 'markLeadUnqualified(', 'mergeLeadAsDuplicate(',
  'createLeadActivity(', 'qualifyLeadForQuotation(', 'ensureCustomerForLead(', 'createQuotation(', 'reviseQuotation(', 'duplicateQuotationVersion(',
  'updateQuotationDetails(', 'submitQuotationForApproval(', 'withdrawQuotationSubmission(', 'approveQuotation(', 'rejectQuotation(', 'sendQuotationToClient(', 'applyCostSheetToQuotation(',
  // S6b: sales orders, their status and Group Trip seats live on the server.
  'createSalesOrder(', 'updateSalesOrderStatus(', 'qualifyLeadAndCreateSalesOrder(', 'qualifyGroupTripLead(',
  // S7a: participants (travelers, groups, rooming) live on the server.
  'createTraveler(', 'updateTraveler(', 'removeTraveler(', 'toggleTravelerVerification(', 'setTravelerVip(', 'cancelTraveler(', 'replaceTraveler(',
  'createTravelerGroup(', 'createRoomAssignment(', 'setRoomAssignmentTravelers(', 'removeRoomAssignment(', 'commitTravelerImport(', 'markGroupTripOrderPaid(',
  // S7b: the daily itinerary lives on the server.
  'createItineraryItem(', 'updateItineraryItem(', 'removeItineraryItem(',
  // S7c: project tasks and milestones live on the server.
  'createProjectTask(', 'updateProjectTask(', 'toggleTaskBlocked(', 'createProjectMilestone(', 'setMilestoneActualDate(', 'updateMilestonePlannedDate(',
  'updateMilestoneNote(', 'applyMilestoneTemplate(', 'addMilestoneDeliverable(', 'toggleMilestoneDeliverable(', 'removeMilestoneDeliverable(',
  'updateMilestoneBudget(', 'seedDefaultProjectMilestones(',
  // S7d: hand-logged project changes and their decisions live on the server.
  'createChangeEntry(', 'approveChangeEntry(', 'rejectChangeEntry(',
  // S8: change requests (internal flow), incidents and no-show/refunded cancellations live on the server.
  'createChangeRequest(', 'approveChangeRequest(', 'rejectChangeRequest(', 'markChangeRequestUnderReview(', 'markChangeRequestImplemented(',
  'createIncident(', 'updateIncidentStatus(', 'escalateIncident(', 'appendIncidentCommunication(', 'resolveIncident(', 'createCancellationRecord(',
  // S9: document metadata and messages live on the server.
  'createDocument(', 'sendMessage(',
  // S9b: notifications are created and read on the server.
  'markNotificationRead(', 'markAllNotificationsRead(', 'removeNotification(', 'pushNotification(',
  // S10a: user status and role change on the server (Super Admin only).
  'suspendUser(', 'reactivateUser(', 'assignUserRole(',
  // S10b: master data and the organization profile change on the server.
  'createMasterDataRecord(', 'updateMasterDataRecord(', 'deactivateMasterDataRecord(', 'reactivateMasterDataRecord(', 'updateOrganizationProfile(',
  // S11a: assets, maintenance and checkouts change on the server.
  'addAsset(', 'updateAsset(', 'returnAsset(', 'completeMaintenance(',
  // S11b: marketing content changes on the server.
  'createContentScheduleItem(', 'updateContentScheduleStatus(', 'createContentDevelopmentItem(', 'updateContentDevelopmentStage('
]
const ROOTS = ['pages', 'components', 'composables', 'layouts']
/**
 * Screens that still write locally — shrink, never grow:
 * - the public Lead Intake form (no login, `layout: false`): an anonymous endpoint needs its own design (S6a);
 * - the client portal (hidden, ADR-006): participant edits stay local until the portal comes back (S7a).
 */
const KNOWN_PUBLIC = [/^pages\/lead-intake\//, /^pages\/client\//, /^components\/client\//]
const appDir = __dirname
const used = (source: string, name: string) => new RegExp(`(?<![.\\w])${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(source)

function sources (dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) { return sources(path) }
    return /\.(vue|ts)$/.test(name) && !name.endsWith('.test.ts') ? [path] : []
  })
}

describe('no local sales mutators in screens (leads & quotations come from the server)', () => {
  const files = ROOTS.flatMap(root => sources(join(appDir, root))).map(file => ({ name: relative(appDir, file).replace(/\\/g, '/'), file }))
    .filter(({ name }) => !KNOWN_PUBLIC.some(pattern => pattern.test(name)))

  it('ignores server calls with the same name', () => {
    expect(used('await api.sales.createQuotation(id, body)', 'createQuotation(')).toBe(false)
    expect(used('createQuotationOnServer(api, id, x)', 'createQuotation(')).toBe(false)
    expect(used('createQuotation(id, 5)', 'createQuotation(')).toBe(true)
  })

  it.each(files.map(({ name, file }) => [name, file]))('%s', (_name, file) => {
    expect(FORBIDDEN.filter(name => used(readFileSync(file, 'utf8'), name))).toEqual([])
  })
})

/**
 * Print pages open in a new tab without the dashboard layout, so nothing loads server data for them: each page loads
 * the server-owned data it prints itself, or it prints the bundled demo fixtures (S7b review).
 */
const PRINT_PAGES: Record<string, string[]> = {
  'pages/project-orders/[id]/run-sheet-preview.vue': ['useProjectsSync', 'useVendorsSync', 'useBookingsSync', 'useTravelersSync', 'useItinerarySync'],
  'pages/project-orders/[id]/manifest-preview.vue': ['useProjectsSync', 'useCustomersSync', 'useTravelersSync']
}

describe('print pages load the server data they print', () => {
  it.each(Object.entries(PRINT_PAGES))('%s', (page, syncs) => {
    const source = readFileSync(join(appDir, page), 'utf8')
    expect(syncs.filter(sync => !new RegExp(`${sync}\(\)`).test(source))).toEqual([])
    expect(source).toMatch(/onMounted\(/)
  })
})

/** S9b review: the bell's panel only mounts while the popover is open, so the header badge must count from the data. */
describe('the header unread badge counts notifications without the panel being open', () => {
  it('TopHeader reads getUnreadNotificationCount, not the panel ref', () => {
    const source = readFileSync(join(appDir, 'components/layout/TopHeader.vue'), 'utf8')
    expect(source.includes('getUnreadNotificationCount(')).toBe(true)
    expect(source.includes('notificationPanelRef.value?.unreadCount')).toBe(false)
  })
})

/** S11b review: SectionCard rendered its `#actions` slot only inside a header shown for a title, so add buttons vanished. */
describe('a SectionCard shows its actions without a title', () => {
  it('the header renders when the card has actions; the title only when there is one', () => {
    const source = readFileSync(join(appDir, 'components/shared/SectionCard.vue'), 'utf8')
    expect(source).toMatch(/<CardHeader v-if="title \|\| \$slots\.header \|\| \$slots\.actions"/)
    expect(source).toMatch(/<CardTitle v-if="title"/)
  })

  it('the marketing content cards carry a title', () => {
    const source = readFileSync(join(appDir, 'pages/marketing/index.vue'), 'utf8')
    expect(source).toContain('title="Jadwal Konten"')
    expect(source).toContain('title="Pengembangan Konten"')
  })
})
