<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { FileX, Wallet, Users, Truck, Search, UserPlus, Upload, Pencil, Trash2, Printer, AlertTriangle, Plus, CheckCircle2, MapPin, CalendarRange } from 'lucide-vue-next'
import {
  getProjectById, getPartyById, getUserById, getVendorById, getLeadById, getQuotationByLead,
  getFlightBookingsByService, getHotelBookingsByService, getTransportBookingsByService, getMiceEventsByService,
  getProjectServices, getItineraryItems, updateServiceStatus, updateItineraryItem, createItineraryItem, removeItineraryItem,
  getQuotationsForService, acceptVendorQuotation, rejectVendorQuotation, recordVendorPaymentDirect,
  getServiceOrderByService, getSupplierInvoicesByServiceOrder,
  getTravelerGroups, getTravelers, getRoomAssignments,
  createTraveler, updateTraveler, removeTraveler, createTravelerGroup,
  toggleTravelerVerification, getTravelerReadiness, previewTravelerImportMock, commitTravelerImport,
  getInvoicesByProject, getPaymentsByInvoice, getProjectOutstandingIdr, getCommittedVendorCostIdr,
  getCreditNotesByProject, getDebitNotesByProject, getSupplierInvoicesByProject, evaluateFinanceClosureGate, closeProjectFinance,
  evaluateProjectClosureGate, closeProject, getProjectClosureSummary,
  getTasksByProject, getDocumentsByProject, getActivitiesByProject, getRisksByProject,
  createChangeEntry, approveChangeEntry, rejectChangeEntry,
  getProjectOrderStatus, acceptProjectHandover, returnProjectHandover, markProjectReady,
  getProjectStatusTransitions, updateProjectStatus, updateProjectClosureChecklist,
  addProjectTeamMember, removeProjectTeamMember,
  createProjectTask, updateProjectTask, createProjectRisk, updateProjectRiskStatus,
  toggleTaskBlocked, getServiceReadinessMatrix, getDepartureReadiness, getProjectAttentionQueue,
  getShiftNotes, createShiftNote,
  getBookingTimeline,
  getServiceOrdersByProject, getRfqsByProject,
  getChangeRequestsByProject, getCancellationRecordsByProject, getRefundRequestsByProject, getIncidentsByProject,
  getDocumentsForProject, MESSAGE_RECORDS, sendMessage, getUnifiedActivityTimeline,
  USERS,
  getClientReservations, getProjectSeatsFilled, getProjectSeatsAvailable, getSalesOrdersByProject, getLeadsLinkedToGroupProject, updateSalesOrderStatus
} from '~/data'
import type { TravelerImportPreviewRow } from '~/data'
import type { SalesOrder } from '~/types/sales-order'
import {
  getProjectOrderStepViews, advanceProjectOrder, getProjectMilestones,
  setMilestoneActualDate, updateMilestonePlannedDate, getProjectOrderStep
} from '~/data/project-order-workflow'
import { getProjectActualCostIdr, getJournalEntriesByProject, getLedgerAccount, getProjectExpenses, createProjectExpense, PROJECT_EXPENSE_CATEGORIES } from '~/data/finance-ext'
import { serviceCapabilityKey } from '~/constants/capabilities'
import {
  PROJECT_STATUSES, PROJECT_ORDER_STATUSES, SERVICE_STATUSES, SERVICE_TYPES,
  INVOICE_STATUSES, INVOICE_TYPES, TASK_STATUSES, ROOM_TYPES, VENDOR_QUOTATION_STATUSES,
  CHANGE_CATEGORIES, CHANGE_APPROVAL_STATUSES, RISK_SEVERITIES, RISK_STATUSES, BOOKING_PAYMENT_GATE_STATUSES, SERVICE_ORDER_STATUSES, RFQ_STATUSES, findStatusOption,
  CHANGE_REQUEST_SOURCES, CHANGE_REQUEST_STATUSES, REFUND_REQUEST_STATUSES, REFUND_CREDIT_STATUSES, INCIDENT_SEVERITIES, INCIDENT_STATUSES,
  CREDIT_NOTE_STATUSES, DEBIT_NOTE_STATUSES, SUPPLIER_INVOICE_MATCH_STATUSES, SUPPLIER_INVOICE_STATUSES,
  DOCUMENT_ACCESS_LEVELS, MESSAGE_CHANNELS, MESSAGE_DELIVERY_STATUSES, SALES_ORDER_STATUSES
} from '~/constants/status'
import { formatCurrencyIdr, formatDateRange, formatDate, formatDayLabel, formatTravelerCount, maskDocumentNumber } from '~/utils/format'
import { isProjectNeedingAttention, isUpcomingDeparture, isTravelerDocumentMissing, isInvoiceOverdue, invoiceAgingDays, isDocumentExpired, isDocumentExpiringSoon, DEMO_REFERENCE_DATE } from '~/utils/attention'
import type { ProjectDetailTab, Traveler, ServiceTypeKey, ServiceStatus, ProjectStatus, ProjectClosureChecklist, ItineraryItem, ProjectService } from '~/types/project'
import type { ChangeCategory, ProjectRiskSeverity, ProjectTask, ShiftPeriod } from '~/types/activity'
import type { Invoice } from '~/types/finance'
import type { ProjectExpenseCategoryKey } from '~/types/finance-ext'
import type { MessageChannel } from '~/types/document-comms'
import type { StatusBreakdownItem } from '~/components/shared/StatusBreakdownList.vue'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const route = useRoute()
const router = useRouter()
const { canView, canApprove, canManage, canViewFinancials, can } = usePermissions()
const { currentRole, currentUser } = useCurrentUser()
const { showToast } = useToast()

/**
 * Pengecualian sempit (Section 11), pola yang sama dengan `canManageParty` di CRM (Section 07): akses
 * modul `project` generik juga akan meloloskan Management karena rank `APPROVE` > `MANAGE`, padahal
 * Management hanya berwenang atas "perubahan besar/cancel project", bukan CRUD rutin traveler.
 *
 * Sejak Revisi 9-Modul gerbang ini memakai capability, bukan daftar role literal — supaya role custom yang
 * dibuat admin dari Admin > Roles juga bisa diberi wewenang ini.
 */
const canManageTravelers = computed(() => can('project-order.manage-travelers'))

/**
 * Role behavior tab Itinerary & Services (Section 12). Pemegang `manage-operations` (dulu PM/Operations/
 * Super Admin) mengelola SELURUH sub-section; selain itu dicek per tipe service lewat capability
 * `project-order.manage-service.*` — pengganti `SERVICE_TYPE_ROLE_MAP` lama yang memetakan ServiceTypeKey
 * ke role literal `ticketing`/`accommodation`/`transportation`/`mice` (role-role tsb kini lebur ke
 * `operations`, jadi peta literalnya sudah tidak mungkin cocok).
 */
function canManageServiceType (type: ServiceTypeKey) {
  if (can('project-order.manage-operations')) { return true }
  return can(serviceCapabilityKey(type))
}

/**
 * Penyederhanaan 7-Role/Menu — memaksa derivasi step/milestone dihitung ulang setelah mutasi. Data layer
 * mock ini memutasi objek `reactive` di tempat, tapi selector turunan (`getProjectOrderStepViews`,
 * `getProjectMilestones`, dst.) mengembalikan array/objek BARU hasil derivasi yang tidak selalu ikut
 * ter-track Vue — menaikkan key adalah cara paling sederhana dan pasti benar (pola sama dengan
 * `refreshKey` di halaman lama sebelum digabung ke sini).
 */
const refreshKey = ref(0)
function refreshStep () { refreshKey.value += 1 }

const project = computed(() => {
  void refreshKey.value
  return getProjectById(String(route.params.id))
})

useHead({ title: computed(() => project.value ? project.value.name : 'Project Tidak Ditemukan') })

const activeTab = computed<ProjectDetailTab>({
  get: () => (route.query.tab as ProjectDetailTab) || 'overview',
  set: value => router.replace({ query: { ...route.query, tab: value } })
})

/** Group Trip B2C (`project.isGroupTrip`) pakai 8 tab yang berbeda dari Project B2B biasa — sebagian besar
 * reuse tab value yang sama (cuma label beda: travelers→Participants, tasks→Operations, finance→Financial),
 * 3 tab benar-benar baru (bookings/reservations/payments). Vendors/Documents/Activity & Changes sengaja
 * tidak tampil untuk Group Trip (di luar 8 tab yang diminta). */
const TABS = computed<{ value: ProjectDetailTab; label: string }[]>(() => (project.value?.isGroupTrip
  ? [
      { value: 'overview', label: 'Overview' },
      { value: 'bookings', label: 'Bookings' },
      { value: 'travelers', label: 'Participants' },
      { value: 'itinerary-services', label: 'Itinerary & Services' },
      { value: 'reservations', label: 'Reservations' },
      { value: 'payments', label: 'Payments' },
      { value: 'tasks', label: 'Operations' },
      { value: 'finance', label: 'Financial' }
    ]
  : [
      { value: 'overview', label: 'Overview' },
      { value: 'itinerary-services', label: 'Itinerary & Services' },
      { value: 'travelers', label: 'Travelers' },
      { value: 'vendors', label: 'Vendors' },
      { value: 'finance', label: 'Finance' },
      { value: 'tasks', label: 'Tasks' },
      { value: 'documents', label: 'Documents' },
      { value: 'activity-changes', label: 'Activity & Changes' }
    ]))

/**
 * Tab "Bookings" (Group Trip) — 5 bucket sesuai flow DP-gated (`qualifyGroupTripLead`/`updateSalesOrderStatus`,
 * `app/data/index.ts`): Linked/Qualified Leads (superset — termasuk Waitlist/Follow-up), Awaiting DP
 * (SalesOrder `draft`), Confirmed Bookings (SalesOrder bukan `draft`/`cancelled`), Confirmed Participants
 * (Traveler — BARU ada setelah DP), Available Seats.
 */
function orderRow (order: SalesOrder) {
  return {
    order,
    party: getPartyById(order.customerId),
    statusOption: findStatusOption(SALES_ORDER_STATUSES, order.status)
  }
}
const linkedLeads = computed(() => (project.value ? getLeadsLinkedToGroupProject(project.value.id) : []))
const projectOrders = computed(() => (project.value ? getSalesOrdersByProject(project.value.id) : []))
const awaitingDpRows = computed(() => projectOrders.value.filter(order => order.status === 'draft').map(orderRow))
const confirmedBookingRows = computed(() => projectOrders.value.filter(order => order.status !== 'draft' && order.status !== 'cancelled').map(orderRow))
const waitlistLeads = computed(() => linkedLeads.value.filter(lead => lead.b2cQualificationResult === 'waitlist'))
const confirmedParticipants = computed(() => (project.value ? getTravelers(project.value.id) : []))

function confirmDp (orderId: string) {
  const order = updateSalesOrderStatus(orderId, 'paid')
  if (order) { showToast('DP Dikonfirmasi', `${order.id} sekarang Confirmed, participant otomatis dibuat.`, 'success') }
}

const groupTripReservations = computed(() => (project.value ? getClientReservations(project.value.id) : []))

/**
 * Order Status Stepper (Penyederhanaan 7-Role/Menu, dulu halaman terpisah `/project-orders/[id]`) —
 * visualisasi progres 6 step (revisi.md #12 "project order mengikuti alur, ada tahap-tahapannya 6 step")
 * ditempatkan di puncak tab Overview. Aksi "Advance" di sini MENEGAKKAN gate step (`evaluateProjectOrderStepGate`
 * via `advanceProjectOrder`) — berbeda dari tombol transisi status ad-hoc di SectionCard "Handover & Project
 * Status" di bawah (`updateProjectStatus` langsung) yang TIDAK menegakkan gate 6-step; keduanya sengaja
 * dipertahankan berdampingan (bukan regresi baru — sudah begitu sejak sebelum penggabungan halaman ini)
 * karena "Handover & Project Status" juga menangani transisi lateral (On Hold/Cancelled) yang di luar
 * cakupan linear stepper.
 */
const stepViews = computed(() => {
  void refreshKey.value
  return getProjectOrderStepViews(project.value?.id ?? '')
})
const currentStepView = computed(() => stepViews.value.find(view => view.state === 'current' || view.state === 'blocked'))
const canAdvanceStep = computed(() => can('project-order.advance-step'))
const selectedStepKey = ref<string | undefined>()

function onAdvanceStep () {
  if (!project.value) { return }
  const result = advanceProjectOrder(project.value.id, currentUser.value.id)
  refreshStep()
  if (result.success) {
    showToast('Berhasil', `Project Order lanjut dari step "${currentStepView.value?.def.label ?? ''}".`, 'success')
  } else {
    showToast('Belum dapat dilanjutkan', result.blockers[0] ?? 'Syarat step ini belum terpenuhi.', 'error')
  }
}

/** Milestone Timeline Tracking (dulu halaman terpisah) — planned vs actual date per milestone, TIDAK tumpang tindih dengan "Milestone / Task Summary" (StatusBreakdownList status Task, sumber data berbeda). */
const milestones = computed(() => {
  void refreshKey.value
  return getProjectMilestones(project.value?.id ?? '')
})
/** Tanggal rencana dikunci begitu Project Order lewat tahap Drafting. */
const plannedDatesLocked = computed(() => (project.value ? getProjectOrderStep(project.value) !== 'drafting' : true))

function onMarkMilestoneActual (milestoneId: string) {
  setMilestoneActualDate(milestoneId, DEMO_REFERENCE_DATE)
  refreshStep()
  showToast('Milestone diperbarui', `Tanggal realisasi diisi ${formatDate(DEMO_REFERENCE_DATE)}.`, 'success')
}

function onUpdateMilestonePlanned (payload: { milestoneId: string; plannedDate: string }) {
  updateMilestonePlannedDate(payload.milestoneId, payload.plannedDate)
  refreshStep()
}

const party = computed(() => project.value ? getPartyById(project.value.partyId) : undefined)
const owner = computed(() => project.value ? getUserById(project.value.ownerId) : undefined)
const team = computed(() => project.value
  ? project.value.teamUserIds.map(id => getUserById(id)).filter((user): user is NonNullable<typeof user> => Boolean(user))
  : [])

/**
 * Project Order dan Handover (Section 09 — roadmap Section 00–24 baru). Narrow role exception, pola sama
 * `canManageTravelers` di atas — hanya PM/Super Admin yang mengelola handover/status/team/closure checklist
 * (bukan `canManage('project')` generik, agar Management yang punya `APPROVE` tidak ikut lolos untuk aksi
 * operasional harian yang bukan wewenangnya).
 */
const canManageProjectOrder = computed(() => can('project-order.accept-handover'))

const sourceLead = computed(() => project.value?.leadId ? getLeadById(project.value.leadId) : undefined)
const accountExecutive = computed(() => sourceLead.value ? getUserById(sourceLead.value.handedOverTo ?? sourceLead.value.ownerId) : undefined)
const sourceQuotation = computed(() => sourceLead.value ? getQuotationByLead(sourceLead.value.id) : undefined)
const orderStatus = computed(() => project.value ? getProjectOrderStatus(project.value) : undefined)

const isReturnHandoverDialogOpen = ref(false)
const returnHandoverReason = ref('')

function submitAcceptHandover () {
  if (!project.value) { return }
  const result = acceptProjectHandover(project.value.id, currentUser.value.id)
  if (!result) {
    showToast('Accept Handover Gagal', 'Project Order tidak lagi berstatus Handover Pending.', 'error')
    return
  }
  showToast('Handover Diterima', 'Project Order memasuki tahap Planning.', 'success')
}

function submitReturnHandover () {
  if (!project.value || !returnHandoverReason.value.trim()) { return }
  const result = returnProjectHandover(project.value.id, returnHandoverReason.value.trim(), currentUser.value.id)
  if (!result) {
    showToast('Return Handover Gagal', 'Project Order tidak lagi berstatus Handover Pending.', 'error')
    return
  }
  returnHandoverReason.value = ''
  isReturnHandoverDialogOpen.value = false
  showToast('Handover Dikembalikan', 'Alasan tercatat di Activity — AE perlu menindaklanjuti.', 'warning')
}

function submitMarkReady () {
  if (!project.value) { return }
  const result = markProjectReady(project.value.id)
  if (!result) {
    showToast('Gagal', 'Project Order tidak lagi berstatus Confirmed.', 'error')
    return
  }
  showToast('Project Order Ready', 'Ditandai siap keberangkatan.', 'success')
}

/* Status transitions — guard peta transisi + reason wajib untuk On Hold/Cancelled (Wajib "Transition guards dan visible reason"). */
const nextStatusOptions = computed(() => project.value ? getProjectStatusTransitions(project.value.status) : [])
const isStatusDialogOpen = ref(false)
const pendingStatus = ref<ProjectStatus | null>(null)
const statusReason = ref('')
const statusReasonRequired = computed(() => pendingStatus.value === 'on-hold' || pendingStatus.value === 'cancelled')

function openStatusDialog (status: ProjectStatus) {
  pendingStatus.value = status
  statusReason.value = ''
  isStatusDialogOpen.value = true
}

function submitStatusTransition () {
  if (!project.value || !pendingStatus.value) { return }
  if (statusReasonRequired.value && !statusReason.value.trim()) { return }
  const result = updateProjectStatus(project.value.id, pendingStatus.value, currentUser.value.id, statusReason.value.trim() || undefined)
  if (!result) {
    showToast('Transisi Gagal', 'Status tidak lagi memungkinkan transisi ini.', 'error')
    return
  }
  isStatusDialogOpen.value = false
  showToast('Status Diperbarui', `Project Order kini berstatus "${findStatusOption(PROJECT_STATUSES, pendingStatus.value).label}".`, 'success')
  pendingStatus.value = null
}

/* Team assignment */
const isTeamDialogOpen = ref(false)
const teamMemberToAdd = ref('')
const teamOptions = computed(() => USERS.filter(user => !project.value?.teamUserIds.includes(user.id) && user.id !== project.value?.ownerId))

function submitAddTeamMember () {
  if (!project.value || !teamMemberToAdd.value) { return }
  addProjectTeamMember(project.value.id, teamMemberToAdd.value)
  teamMemberToAdd.value = ''
  isTeamDialogOpen.value = false
}

function submitRemoveTeamMember (userId: string) {
  if (!project.value) { return }
  removeProjectTeamMember(project.value.id, userId)
}

/* Closure checklist shell */
const CLOSURE_CHECKLIST_ITEMS: { key: keyof ProjectClosureChecklist; label: string }[] = [
  { key: 'financeSettled', label: 'Finance diselesaikan (invoice lunas, tidak ada outstanding)' },
  { key: 'documentsArchived', label: 'Dokumen diarsipkan' },
  { key: 'feedbackCollected', label: 'Feedback client dikumpulkan' },
  { key: 'assetsReturned', label: 'Aset/perlengkapan dikembalikan' }
]

function toggleClosureItem (key: 'financeSettled' | 'documentsArchived' | 'feedbackCollected' | 'assetsReturned', value: boolean) {
  if (!project.value) { return }
  updateProjectClosureChecklist(project.value.id, { [key]: value })
}

/**
 * "Project Closed" (Section 24 — final section). Pola sama Close Finance (Section 20): gate advisory
 * (`evaluateProjectClosureGate`) ditampilkan sebelum aksi, blocker list bila belum siap. Role gate
 * "Management/PM" (Wajib literal) — pola narrow-role-exception sama `canManageProjectOrder` di atas,
 * ditambah `management` (bukan hanya PM/Super Admin, karena Wajib eksplisit menyebut Management).
 */
const canCloseProject = computed(() => can('project-order.close'))
const projectClosureGate = computed(() => project.value ? evaluateProjectClosureGate(project.value.id) : { ready: false, blockers: [] })
const isProjectAlreadyClosed = computed(() => !!project.value?.closedAt)
const projectClosureSummary = computed(() => project.value ? getProjectClosureSummary(project.value.id) : undefined)
const closeProjectFinalNote = ref('')
const closeProjectClientFeedback = ref('')
const closedByName = computed(() => project.value?.closedBy ? (getUserById(project.value.closedBy)?.name ?? project.value.closedBy) : '')

function submitCloseProject () {
  if (!project.value) { return }
  const result = closeProject(project.value.id, currentUser.value.id, closeProjectFinalNote.value, closeProjectClientFeedback.value)
  if (result.success) {
    showToast('Project Ditutup', `Project ${project.value.name} berhasil ditutup (Closed).`, 'success')
    closeProjectFinalNote.value = ''
    closeProjectClientFeedback.value = ''
  } else {
    showToast('Belum Bisa Ditutup', result.blockers[0] ?? 'Final note wajib diisi.', 'error')
  }
}

/* Risks */
const risks = computed(() => project.value ? getRisksByProject(project.value.id) : [])
const isRiskDialogOpen = ref(false)
const riskTitle = ref('')
const riskDescription = ref('')
const riskSeverity = ref<ProjectRiskSeverity>('medium')

function submitRisk () {
  if (!project.value || !riskTitle.value.trim()) { return }
  createProjectRisk({
    projectId: project.value.id,
    title: riskTitle.value.trim(),
    description: riskDescription.value.trim() || undefined,
    severity: riskSeverity.value,
    raisedBy: currentUser.value.id
  })
  riskTitle.value = ''
  riskDescription.value = ''
  riskSeverity.value = 'medium'
  isRiskDialogOpen.value = false
  showToast('Risk Dicatat', 'Risk baru ditambahkan ke Project Order ini.', 'success')
}

function cycleRiskStatus (riskId: string, currentStatus: 'open' | 'mitigated' | 'closed') {
  const next = currentStatus === 'open' ? 'mitigated' : currentStatus === 'mitigated' ? 'closed' : 'open'
  updateProjectRiskStatus(riskId, next)
}

/* Tasks / Milestones / Dependencies */
const isTaskDialogOpen = ref(false)
const editingTaskId = ref<string | null>(null)
const taskTitle = ref('')
const taskDueAt = ref('')
const taskIsMilestone = ref(false)
const taskDependsOn = ref('')
const taskAssignedTo = ref('')

function openCreateTask () {
  editingTaskId.value = null
  taskTitle.value = ''
  taskDueAt.value = ''
  taskIsMilestone.value = false
  taskDependsOn.value = ''
  taskAssignedTo.value = ''
  isTaskDialogOpen.value = true
}

function submitTask () {
  if (!project.value || !taskTitle.value.trim()) { return }
  const payload = {
    title: taskTitle.value.trim(),
    dueAt: taskDueAt.value || undefined,
    isMilestone: taskIsMilestone.value || undefined,
    dependsOnTaskId: taskDependsOn.value || undefined,
    assignedTo: taskAssignedTo.value || undefined
  }
  if (editingTaskId.value) {
    updateProjectTask(editingTaskId.value, payload)
    showToast('Task Diperbarui', `"${payload.title}" berhasil disimpan.`)
  } else {
    createProjectTask({ projectId: project.value.id, ...payload })
    showToast('Task Ditambahkan', `"${payload.title}" berhasil ditambahkan.`)
  }
  isTaskDialogOpen.value = false
}

function taskTitleById (taskId?: string) {
  if (!taskId) { return undefined }
  return tasks.value.find(t => t.id === taskId)?.title
}

function handleTaskStatusChange (taskId: string, event: Event) {
  const newStatus = (event.target as HTMLSelectElement).value as 'not-started' | 'in-progress' | 'pending-confirmation' | 'done' | 'overdue'
  updateProjectTask(taskId, { status: newStatus })
}

const services = computed(() => project.value ? getProjectServices(project.value.id) : [])
const itineraryItems = computed(() => project.value ? getItineraryItems(project.value.id) : [])

/** Daily itinerary dikelompokkan per tanggal (pola list/divide-y existing, bukan komponen calendar baru). */
const itineraryByDate = computed(() => {
  const map = new Map<string, typeof itineraryItems.value>()
  for (const item of itineraryItems.value) {
    if (!map.has(item.date)) { map.set(item.date, []) }
    map.get(item.date)!.push(item)
  }
  return [...map.entries()].map(([date, items]) => ({ date, items }))
})

/**
 * Conditional service sections (D-039) — hanya tipe dalam `project.serviceScope` yang ditampilkan, PLUS
 * `additional` bila ada baris service bertipe itu (data-driven, bukan bagian klasifikasi "4 kombinasi tipe
 * project" resmi — lihat komentar `ServiceTypeKey` di `app/types/project.ts`).
 */
const visibleServiceTypes = computed(() => {
  if (!project.value) { return [] }
  const scopeTypes = SERVICE_TYPES.filter(type => project.value!.serviceScope.includes(type.value))
  const additionalType = SERVICE_TYPES.find(type => type.value === 'additional')
  const hasAdditional = services.value.some(service => service.type === 'additional')
  return additionalType && hasAdditional ? [...scopeTypes, additionalType] : scopeTypes
})

function servicesByType (type: ServiceTypeKey) {
  return services.value.filter(service => service.type === type)
}

/** Booking asli yang ter-link ke ProjectService ini, kalau ada (docs/superpowers/specs/2026-08-05-project-service-booking-sync-design.md). */
function linkedBookingRef (service: { id: string; type: ServiceTypeKey }): { path: string } | undefined {
  const lookups: Partial<Record<ServiceTypeKey, () => { id: string } | undefined>> = {
    flight: () => getFlightBookingsByService(service.id)[0],
    hotel: () => getHotelBookingsByService(service.id)[0],
    transportation: () => getTransportBookingsByService(service.id)[0],
    mice: () => getMiceEventsByService(service.id)[0]
  }
  const booking = lookups[service.type]?.()
  return booking ? { path: `${BOOKING_MODULE_PATH[service.type]}/${booking.id}` } : undefined
}

/**
 * Booking Timeline (Section 18, D-075) — MENGGANTIKAN 4 blok ringkasan terpisah Flight/Hotel/Transport/MICE
 * (Section 13-16 lama) dengan SATU list terunifikasi, terskop project ini, pola sama `getBookingTimeline()`
 * yang dipakai `/bookings` (cross-project) — informasi identik (referensi/status/deadline/voucher/exception/
 * dependency/payment-gate), hanya pre-filtered. Pengelolaan lifecycle detail TETAP di modul masing-masing
 * (`/ticketing`, `/accommodation`, `/transportation`, `/mice`), aksi payment gate/percobaan TETAP di `/bookings`.
 */
const projectBookingTimeline = computed(() => project.value ? getBookingTimeline(project.value.id) : [])
const BOOKING_DOMAIN_LABEL_MAP: Record<string, string> = { flight: 'Flight', hotel: 'Hotel', transport: 'Transport', mice: 'MICE' }
const BOOKING_DOMAIN_TONE_MAP: Record<string, string> = { flight: 'info', hotel: 'purple', transport: 'warning', mice: 'primary' }
/** Path modul create-booking (Section 13-16) per tipe layanan — dipakai tombol "Buat Booking" quick-create per sub-section. */
const BOOKING_MODULE_PATH: Partial<Record<ServiceTypeKey, string>> = {
  flight: '/ticketing', hotel: '/accommodation', transportation: '/transportation', mice: '/mice'
}
/**
 * Section key modul Service Operations (Penyederhanaan 7-Role/Menu) — `/ticketing`, `/accommodation`,
 * `/transportation`, `/mice` melebur jadi 4 section bertumpuk `/services#anchor` (bukan tab).
 * `BOOKING_MODULE_PATH` di atas TETAP dipakai apa adanya untuk link DETAIL booking (`/ticketing/${id}`,
 * tidak berubah); mapping di bawah ini khusus untuk tombol "Buat Booking" quick-create yang menuju
 * LIST/create form.
 */
const SERVICE_TAB_KEY: Partial<Record<ServiceTypeKey, string>> = {
  flight: 'ticketing', hotel: 'accommodation', transportation: 'transportation', mice: 'mice'
}
/** Procurement summary (Section 17 baru) — Service Order dan RFQ terhubung ke project ini, ringkasan saja, pengelolaan lengkap di modul /procurement. */
const projectServiceOrders = computed(() => project.value ? getServiceOrdersByProject(project.value.id) : [])
const projectRfqs = computed(() => project.value ? getRfqsByProject(project.value.id) : [])

function serviceReadinessLabel (type: ServiceTypeKey) {
  const list = servicesByType(type)
  const ready = list.filter(service => ['confirmed', 'completed'].includes(service.status)).length
  return `${ready} dari ${list.length} layanan siap (Confirmed/Completed)`
}

const changedServicesCount = computed(() => services.value.filter(service => service.status === 'changed').length)

function handleServiceStatusChange (serviceId: string, event: Event) {
  const newStatus = (event.target as HTMLSelectElement).value as ServiceStatus
  const service = updateServiceStatus(serviceId, newStatus)
  if (!service) { return }
  showToast('Status Layanan Diperbarui', `"${service.label}" kini berstatus "${findStatusOption(SERVICE_STATUSES, newStatus).label}".`)
}

/**
 * Section 12 baru (roadmap Section 00–24) — "operational command center". Narrow role exception yang sama
 * dengan komentar `SERVICE_TYPE_ROLE_MAP` di atas: PM/Operations/Super Admin mengelola SELURUH sub-section
 * operasional umum (readiness gate bersifat advisory/read-only untuk semua yang `canView('project')`,
 * hanya aksi tulis — toggle internal-only, shift notes — yang digerbangi).
 */
const canManageOperations = computed(() => can('project-order.manage-operations'))

/** "Service readiness matrix" dan "Departure readiness gates" — derivasi murni, lihat `app/data/index.ts`. */
const serviceReadinessMatrix = computed(() => project.value ? getServiceReadinessMatrix(project.value.id) : [])
const departureReadiness = computed(() => project.value ? getDepartureReadiness(project.value.id) : undefined)

/** "Attention/exception queue" — item diklik untuk lompat ke tab terkait. */
const attentionQueue = computed(() => project.value ? getProjectAttentionQueue(project.value.id) : [])
function goToAttentionTab (tab: ProjectDetailTab) {
  activeTab.value = tab
}

/** "Calendar/timeline views" — toggle tampilan itinerary, data sama persis (bukan komponen calendar baru). */
const itineraryViewMode = ref<'list' | 'timeline'>('list')

/** "Internal vs client-shared itinerary" — toggle tunggal per item, hanya `canManageOperations`. */
function toggleItineraryVisibility (item: { id: string; visibleToClient?: boolean }) {
  const makeInternal = item.visibleToClient !== false
  updateItineraryItem(item.id, { visibleToClient: !makeInternal })
  showToast(
    makeInternal ? 'Ditandai Internal Only' : 'Ditandai Terlihat Client',
    makeInternal ? 'Item ini kini disembunyikan dari Client Portal.' : 'Item ini kini terlihat oleh Client.',
    'info'
  )
}

/** Daily itinerary — create/edit form (docs/superpowers/specs/2026-08-05-daily-itinerary-crud-design.md). */
const isItineraryFormOpen = ref(false)
const editingItineraryItemId = ref<string | undefined>()
const itineraryForm = ref({
  date: '', time: '', title: '', description: '', location: '',
  serviceType: '' as ServiceTypeKey | '', groupId: '', timezone: '', visibleToClient: true
})

function openCreateItineraryItem () {
  editingItineraryItemId.value = undefined
  itineraryForm.value = { date: '', time: '', title: '', description: '', location: '', serviceType: '', groupId: '', timezone: '', visibleToClient: true }
  isItineraryFormOpen.value = true
}

function openEditItineraryItem (item: ItineraryItem) {
  editingItineraryItemId.value = item.id
  itineraryForm.value = {
    date: item.date,
    time: item.time ?? '',
    title: item.title,
    description: item.description ?? '',
    location: item.location ?? '',
    serviceType: item.serviceType ?? '',
    groupId: item.groupId ?? '',
    timezone: item.timezone ?? '',
    visibleToClient: item.visibleToClient !== false
  }
  isItineraryFormOpen.value = true
}

function submitItineraryForm () {
  if (!project.value || !itineraryForm.value.date.trim() || !itineraryForm.value.title.trim()) {
    showToast('Data Belum Lengkap', 'Tanggal dan Judul wajib diisi.', 'error')
    return
  }
  const payload = {
    date: itineraryForm.value.date,
    time: itineraryForm.value.time.trim() || undefined,
    title: itineraryForm.value.title.trim(),
    description: itineraryForm.value.description.trim() || undefined,
    location: itineraryForm.value.location.trim() || undefined,
    serviceType: itineraryForm.value.serviceType || undefined,
    groupId: itineraryForm.value.groupId || undefined,
    timezone: itineraryForm.value.timezone.trim() || undefined,
    visibleToClient: itineraryForm.value.visibleToClient
  }
  if (editingItineraryItemId.value) {
    updateItineraryItem(editingItineraryItemId.value, payload)
  } else {
    createItineraryItem({ projectId: project.value.id, ...payload })
  }
  isItineraryFormOpen.value = false
  showToast('Itinerary Disimpan', 'Perubahan berhasil disimpan.', 'success')
}

const pendingDeleteItineraryItem = ref<ItineraryItem | undefined>()
function confirmDeleteItineraryItem () {
  if (!pendingDeleteItineraryItem.value) { return }
  removeItineraryItem(pendingDeleteItineraryItem.value.id)
  pendingDeleteItineraryItem.value = undefined
  showToast('Item Dihapus', 'Item itinerary berhasil dihapus.', 'success')
}

/** "On-trip updates dan shift notes mock" */
const shiftNotes = computed(() => project.value ? getShiftNotes(project.value.id) : [])
const isShiftNoteDialogOpen = ref(false)
const shiftNoteShift = ref<ShiftPeriod>('pagi')
const shiftNoteText = ref('')

function submitShiftNote () {
  if (!project.value || !shiftNoteText.value.trim()) { return }
  createShiftNote({ projectId: project.value.id, authorId: currentUser.value.id, shift: shiftNoteShift.value, note: shiftNoteText.value.trim() })
  shiftNoteText.value = ''
  shiftNoteShift.value = 'pagi'
  isShiftNoteDialogOpen.value = false
  showToast('Shift Note Dicatat', 'Catatan serah-terima shift berhasil ditambahkan.', 'success')
}

/** "Blocker" (Tasks) — dialog untuk memblokir (wajib alasan); buka blokir langsung tanpa dialog (tidak butuh alasan). */
const isBlockDialogOpen = ref(false)
const blockingTask = ref<ProjectTask | null>(null)
const blockReason = ref('')

function openBlockDialog (task: ProjectTask) {
  blockingTask.value = task
  blockReason.value = ''
  isBlockDialogOpen.value = true
}

function submitBlockTask () {
  if (!blockingTask.value || !blockReason.value.trim()) { return }
  toggleTaskBlocked(blockingTask.value.id, blockReason.value.trim())
  isBlockDialogOpen.value = false
  showToast('Task Diblokir', `"${blockingTask.value.title}" ditandai diblokir.`, 'warning')
}

function unblockTask (task: ProjectTask) {
  toggleTaskBlocked(task.id)
  showToast('Blokir Dibuka', `"${task.title}" tidak lagi diblokir.`, 'info')
}

const groups = computed(() => project.value ? getTravelerGroups(project.value.id) : [])
const travelers = computed(() => project.value ? getTravelers(project.value.id) : [])
const invoices = computed(() => project.value ? getInvoicesByProject(project.value.id) : [])

/**
 * Role-based financial visibility (Section 15, hard rule "User tanpa finance access tidak melihat nilai
 * sensitif") — mengikuti `docs/mockup-data-scenarios.md` bagian 5 secara harfiah, seluruhnya reuse
 * `usePermissions()` existing tanpa mekanisme role-check baru:
 * - `canViewFinancials` (Super Admin/Management/Finance/PM/Viewer, `ROLE_MODULE_ACCESS.finance` VIEW+)
 *   menggerbangi breakdown Budget/Actual/Committed/Variance/invoice+payment penuh (Tier 1).
 * - Role di luar itu (Sales, Operations, Ticketing, Accommodation, Transportation, MICE — seluruhnya
 *   `finance: NONE`) hanya melihat nilai Quotation dan Outstanding ringkas (Tier 0).
 * - Margin dikecualikan khusus untuk Project Manager (docs bagian 5.1: "PM terbatas budget vs actual",
 *   tidak termasuk Margin) — satu-satunya pengecualian sempit tambahan yang dibutuhkan.
 */
const canViewMargin = computed(() => canViewFinancials.value && can('project-order.view-margin'))
const projectOutstandingIdr = computed(() => project.value ? getProjectOutstandingIdr(project.value.id) : 0)
const committedVendorCostIdr = computed(() => project.value ? getCommittedVendorCostIdr(project.value.id) : 0)
/**
 * Fase 3.2 (Poros Project Order + Jurnal Finance, Penyederhanaan 7-Role/Menu) — `project.actualCostIdr`
 * adalah field statis yang tidak pernah diperbarui mutator apa pun (selalu `0` untuk project baru, lihat
 * `createProject`). Diganti selector turunan `getProjectActualCostIdr()` (Σ SupplierInvoice di luar
 * rejected + Σ Opex ber-project), sumber yang persis sama dengan jurnal — sehingga Actual Cost di sini dan
 * total akun 5100/6100 di Buku Besar tidak mungkin berbeda.
 */
const actualCostIdr = computed(() => (project.value ? getProjectActualCostIdr(project.value.id) : 0))
const marginIdr = computed(() => project.value ? project.value.quotationAmountIdr - actualCostIdr.value : 0)
const varianceIdr = computed(() => project.value ? project.value.budgetIdr - actualCostIdr.value : 0)

/** Section 20 — Credit/Debit Note, AP summary (Supplier Invoice), dan financial closure gate untuk project ini. */
const canManageFinance = computed(() => canManage('finance'))
const projectCreditNotes = computed(() => project.value ? getCreditNotesByProject(project.value.id) : [])
const projectDebitNotes = computed(() => project.value ? getDebitNotesByProject(project.value.id) : [])
const projectSupplierInvoices = computed(() => project.value ? getSupplierInvoicesByProject(project.value.id) : [])
/** Fase 3.1 — section "Jurnal" tab Finance, reuse `getJournalEntriesByProject()` (sumber sama dengan Buku Besar `/finance/ledger`). */
const projectJournalEntries = computed(() => (project.value ? getJournalEntriesByProject(project.value.id) : []))
const financeClosureGate = computed(() => project.value ? evaluateFinanceClosureGate(project.value.id) : { ready: false, blockers: [] })
const isFinanceAlreadySettled = computed(() => !!project.value?.closureChecklist?.financeSettled)

function submitCloseFinance () {
  if (!project.value) { return }
  const result = closeProjectFinance(project.value.id, currentUser.value.id)
  if (result.success) { showToast('Finance Ditutup', `Finance project ${project.value.name} berhasil ditutup.`, 'success') } else { showToast('Belum Bisa Ditutup', `${result.blockers.length} blocker masih terbuka — lihat daftar di atas.`, 'error') }
}

/** Pengeluaran Project (ad-hoc, langsung tercatat) — lihat `ProjectExpense`, `app/types/finance-ext.ts`. */
const projectExpenses = computed(() => (project.value ? getProjectExpenses(project.value.id) : []))
const isExpenseDialogOpen = ref(false)
const expenseCategory = ref<ProjectExpenseCategoryKey | ''>('')
const expenseDescription = ref('')
const expenseAmountIdr = ref<number | null>(null)
const expenseIncurredAt = ref('')

function openCreateExpense () {
  expenseCategory.value = ''
  expenseDescription.value = ''
  expenseAmountIdr.value = null
  expenseIncurredAt.value = DEMO_REFERENCE_DATE
  isExpenseDialogOpen.value = true
}

function submitExpense () {
  if (!project.value || !expenseCategory.value || !expenseDescription.value.trim() || !expenseAmountIdr.value || !expenseIncurredAt.value) { return }
  const expense = createProjectExpense({
    projectId: project.value.id,
    category: expenseCategory.value,
    description: expenseDescription.value.trim(),
    amountIdr: expenseAmountIdr.value,
    incurredAt: expenseIncurredAt.value,
    recordedBy: currentUser.value.id
  })
  if (!expense) { return }
  isExpenseDialogOpen.value = false
  showToast('Pengeluaran Dicatat', `${expense.description} — ${formatCurrencyIdr(expense.amountIdr)} berhasil ditambahkan ke Actual Cost.`, 'success')
}

function invoiceAgingLabel (invoice: Invoice) {
  if (invoice.status === 'paid') { return 'Lunas' }
  if (invoice.status === 'void') { return 'Void' }
  const days = invoiceAgingDays(invoice)
  if (days < 0) { return `${Math.abs(days)} hari overdue` }
  if (days === 0) { return 'Jatuh tempo hari ini' }
  return `Jatuh tempo dalam ${days} hari`
}

function paymentsForInvoice (invoiceId: string) {
  return getPaymentsByInvoice(invoiceId)
}
const tasks = computed(() => project.value ? getTasksByProject(project.value.id) : [])
const documents = computed(() => project.value ? getDocumentsByProject(project.value.id) : [])
/** Section 21 (D-078) — union `Document` baru + `ProjectDocument` legacy di atas, dipakai tab "Documents" yang diperkaya (category/version/expiry/access level). `documents` legacy TETAP dipakai apa adanya untuk widget Overview "recentDocuments" (tidak diubah). */
const unifiedDocuments = computed(() => project.value ? getDocumentsForProject(project.value.id) : [])
/** Section 21 (D-078) — Communication (internal notes/client messages/supplier messages) untuk project ini, agregasi lewat `projectId` (bukan hanya entityType 'project' sempit — pesan tertaut sub-entity seperti booking/incident yang punya `projectId` sama tetap relevan). */
const projectMessages = computed(() => project.value ? MESSAGE_RECORDS.filter(item => item.projectId === project.value!.id).slice().sort((a, b) => b.sentAt.localeCompare(a.sentAt)) : [])
/** Section 21 (D-078) — unified activity timeline internal-view (Wajib "Unified activity timeline dengan filtering akses"). */
const unifiedTimeline = computed(() => project.value ? getUnifiedActivityTimeline('project', project.value.id, 'internal') : [])
const activities = computed(() => project.value ? getActivitiesByProject(project.value.id) : [])
const changesOnly = ref(false)
/** "Changes only" ditampilkan sebagai timeline kronologis (ascending) — "All" tetap urutan natural existing. */
const visibleActivities = computed(() => {
  if (!changesOnly.value) { return activities.value }
  return [...activities.value].filter(a => a.isChange).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
})

/**
 * Project Changes (Section 14) — log change (PM/Operations/role sub-domain yang bisa mengajukan perubahan
 * di sub-section masing-masing) vs approve/reject (Management/Super Admin, docs bagian 5.1 "Approve").
 */
const canLogChange = computed(() => can('project-order.log-change'))
const canApproveChanges = computed(() => canApprove('project'))

const isChangeDialogOpen = ref(false)
const changeCategory = ref<ChangeCategory>('other')
const changeReason = ref('')
const changeBefore = ref('')
const changeAfter = ref('')
const changeImpact = ref('')

function resetChangeForm () {
  changeCategory.value = 'other'
  changeReason.value = ''
  changeBefore.value = ''
  changeAfter.value = ''
  changeImpact.value = ''
}

function submitChangeEntry () {
  if (!project.value || !changeReason.value.trim()) { return }
  createChangeEntry({
    projectId: project.value.id,
    category: changeCategory.value,
    reason: changeReason.value.trim(),
    requestedBy: currentUser.value.id,
    beforeValue: changeBefore.value.trim() || undefined,
    afterValue: changeAfter.value.trim() || undefined,
    impactNote: changeImpact.value.trim() || undefined
  })
  resetChangeForm()
  isChangeDialogOpen.value = false
  showToast('Perubahan Dicatat', 'Change baru dicatat, menunggu approval Management/Super Admin.')
}

/** Communication (Section 21, D-078) — compose pesan baru (internal note/client/supplier message) untuk project ini. */
const isMessageDialogOpen = ref(false)
const messageChannel = ref<MessageChannel>('internal-note')
const messageBody = ref('')

function resetMessageForm () {
  messageChannel.value = 'internal-note'
  messageBody.value = ''
}

function submitMessage () {
  if (!project.value || !messageBody.value.trim()) { return }
  const message = sendMessage({
    entityType: 'project',
    entityId: project.value.id,
    projectId: project.value.id,
    channel: messageChannel.value,
    senderId: currentUser.value.id,
    body: messageBody.value.trim(),
    deliveryChannel: messageChannel.value === 'internal-note' ? undefined : 'email'
  })
  resetMessageForm()
  isMessageDialogOpen.value = false
  showToast('Pesan Terkirim', `Status: ${findStatusOption(MESSAGE_DELIVERY_STATUSES, message.deliveryStatus).label} (simulasi, bukan email/WA nyata).`)
}

function handleApproveChange (entryId: string) {
  const entry = approveChangeEntry(entryId, currentUser.value.id)
  if (!entry) { return }
  showToast('Perubahan Disetujui', `Change ${entry.id} disetujui.`)
}

function handleRejectChange (entryId: string) {
  const entry = rejectChangeEntry(entryId, currentUser.value.id)
  if (!entry) { return }
  showToast('Perubahan Ditolak', `Change ${entry.id} ditolak.`, 'info')
}

/**
 * Changes, Cancellation, Refund dan Incident (Section 19, D-076) — surgical addition ke tab "Activity &
 * Changes" existing (Section 14 lama, di atas TIDAK diubah). Struktur Cancellation/Refund/Incident tampil
 * SEBAGAI TAMBAHAN, bukan pengganti list `ActivityEntry`. Aksi (approve/reject/status transition) tetap
 * dilakukan di halaman detail masing-masing (`/changes/**`) — di sini murni ringkasan + link.
 */
const projectChangeRequests = computed(() => (project.value ? getChangeRequestsByProject(project.value.id) : []))
const projectCancellations = computed(() => (project.value ? getCancellationRecordsByProject(project.value.id) : []))
const projectRefunds = computed(() => (project.value ? getRefundRequestsByProject(project.value.id) : []))
const projectIncidents = computed(() => (project.value ? getIncidentsByProject(project.value.id) : []))

/**
 * Vendor assignment + comparison (Section 13) — quotation dibaca dari `VENDOR_QUOTATIONS` (Section 13),
 * gerbang Accept/Reject reuse `canManageServiceType` (Section 12), bukan mekanisme role-check baru.
 */
function quotationsForService (serviceId: string) {
  return getQuotationsForService(serviceId)
}

function handleAcceptQuotation (quotationId: string) {
  const quotation = acceptVendorQuotation(quotationId)
  if (!quotation) { return }
  const vendor = getVendorById(quotation.vendorId)
  showToast('Quotation Diterima', `${vendor?.name ?? quotation.vendorId} ditugaskan untuk layanan ini.`)
}

function handleRejectQuotation (quotationId: string) {
  const quotation = rejectVendorQuotation(quotationId)
  if (!quotation) { return }
  showToast('Quotation Ditolak', 'Quotation vendor ditandai ditolak.', 'info')
}

/** "Catat Sudah Dibayar ke Vendor" — jalur cepat internal, lihat `recordVendorPaymentDirect` (`app/data/index.ts`).
 * Tombol disembunyikan begitu sudah ada Supplier Invoice `paid` untuk layanan ini, supaya tidak dobel bayar. */
function isVendorAlreadyPaid (service: ProjectService) {
  if (!service.vendorId) { return false }
  const serviceOrder = getServiceOrderByService(service.id)
  if (!serviceOrder) { return false }
  return getSupplierInvoicesByServiceOrder(serviceOrder.id).some(invoice => invoice.status === 'paid')
}

const isVendorPaymentDialogOpen = ref(false)
const vendorPaymentService = ref<ProjectService | null>(null)
const vendorPaymentAmountIdr = ref<number | null>(null)
const vendorPaymentNote = ref('')

function openRecordVendorPayment (service: ProjectService) {
  vendorPaymentService.value = service
  const acceptedQuotation = quotationsForService(service.id).find(quotation => quotation.status === 'accepted')
  vendorPaymentAmountIdr.value = acceptedQuotation?.amountIdr ?? null
  vendorPaymentNote.value = ''
  isVendorPaymentDialogOpen.value = true
}

function submitVendorPayment () {
  const service = vendorPaymentService.value
  if (!service || !service.vendorId || !vendorPaymentAmountIdr.value) { return }
  const invoice = recordVendorPaymentDirect({
    serviceId: service.id,
    vendorId: service.vendorId,
    amountIdr: vendorPaymentAmountIdr.value,
    note: vendorPaymentNote.value.trim() || undefined
  }, currentUser.value.id)
  if (!invoice) { return }
  isVendorPaymentDialogOpen.value = false
  showToast('Pembayaran Vendor Dicatat', `${formatCurrencyIdr(invoice.amountIdr)} untuk "${service.label}" langsung ditambahkan ke Actual Cost.`, 'success')
}

const needsAttention = computed(() => project.value
  ? isProjectNeedingAttention(project.value, { invoices: invoices.value, tasks: tasks.value, activities: activities.value })
  : false)

/** Ringkasan Overview (Section 10) — breakdown/preview dari data tab lain, bukan detail penuh (hard rule: jangan
 * kerjakan seluruh detail traveler/operations/vendor/finance di sini, tab masing-masing tetap sumber lengkapnya). */
const serviceStatusSummary = computed<StatusBreakdownItem[]>(() => {
  const byStatus = new Map<string, number>()
  for (const service of services.value) { byStatus.set(service.status, (byStatus.get(service.status) ?? 0) + 1) }
  return SERVICE_STATUSES
    .filter(status => byStatus.has(status.value))
    .sort((a, b) => a.order - b.order)
    .map(status => ({ key: status.value, label: status.label, tone: status.tone, count: byStatus.get(status.value)! }))
})

const taskStatusSummary = computed<StatusBreakdownItem[]>(() => {
  const byStatus = new Map<string, number>()
  for (const task of tasks.value) { byStatus.set(task.status, (byStatus.get(task.status) ?? 0) + 1) }
  return TASK_STATUSES
    .filter(status => byStatus.has(status.value))
    .sort((a, b) => a.order - b.order)
    .map(status => ({ key: status.value, label: status.label, tone: status.tone, count: byStatus.get(status.value)! }))
})

const recentDocuments = computed(() => [...documents.value].sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt)).slice(0, 3))
const recentActivityPreview = computed(() => [...activities.value].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 3))

function goToActivityTab () {
  activeTab.value = 'activity-changes'
}

/* Travelers tab (Section 11 lama + Section 11 baru "Traveler dan Travel Documents") — filter/search/CRUD state. */

const roomAssignments = computed(() => project.value ? getRoomAssignments(project.value.id) : [])
/** "Readiness indicator" (Section 11 baru) — DIRIVASI, lihat `getTravelerReadiness` (`app/data/index.ts`). */
const travelerReadiness = computed(() => project.value ? getTravelerReadiness(project.value.id) : undefined)

function travelerNameById (id: string) {
  return travelers.value.find(t => t.id === id)?.name ?? id
}

function groupNameById (groupId?: string) {
  if (!groupId) { return '—' }
  return groups.value.find(g => g.id === groupId)?.name ?? groupId
}

function travelerDocumentMissing (traveler: Traveler) {
  return isTravelerDocumentMissing(traveler, project.value?.travelStartDate)
}

/**
 * "Sensitive values masked sesuai role" (Section 11 baru, Wajib) — hanya `canManageTravelers` (PM/Super
 * Admin) yang melihat nomor dokumen penuh; role lain (Management, Finance, Sales, AE, sub-domain
 * Ticketing/Accommodation/Transportation/MICE, dst.) melihat versi masked (`maskDocumentNumber`).
 */
function passportSummary (traveler: Traveler) {
  if (!traveler.passportNumber || !traveler.passportExpiryDate) { return 'Belum diisi' }
  const number = canManageTravelers.value ? traveler.passportNumber : maskDocumentNumber(traveler.passportNumber)
  return `${number} · ${formatDate(traveler.passportExpiryDate)}`
}

function idNumberSummary (traveler: Traveler) {
  if (!traveler.idNumber) { return '—' }
  return canManageTravelers.value ? traveler.idNumber : maskDocumentNumber(traveler.idNumber)
}

function visaSummary (traveler: Traveler) {
  if (!traveler.visaNumber) { return '—' }
  const number = canManageTravelers.value ? traveler.visaNumber : maskDocumentNumber(traveler.visaNumber)
  return traveler.visaExpiryDate ? `${number} · ${formatDate(traveler.visaExpiryDate)}` : number
}

function companionSummary (traveler: Traveler) {
  if (!traveler.companionOfTravelerId) { return null }
  return `Mendampingi: ${travelerNameById(traveler.companionOfTravelerId)}`
}

const travelerSearch = ref('')
const travelerGroupFilter = ref('all')
const missingDocsOnly = ref(false)

const filteredTravelers = computed(() => {
  let result = travelers.value
  if (travelerGroupFilter.value === 'ungrouped') { result = result.filter(t => !t.groupId) } else if (travelerGroupFilter.value !== 'all') { result = result.filter(t => t.groupId === travelerGroupFilter.value) }
  if (missingDocsOnly.value) { result = result.filter(travelerDocumentMissing) }
  if (travelerSearch.value.trim()) {
    const q = travelerSearch.value.toLowerCase()
    result = result.filter(t => t.name.toLowerCase().includes(q))
  }
  return result
})

const isTravelerDialogOpen = ref(false)
const editingTravelerId = ref<string | null>(null)
const formName = ref('')
const formGroupId = ref('')
const formPassportNumber = ref('')
const formPassportExpiryDate = ref('')
const formIdNumber = ref('')
const formVisaNumber = ref('')
const formVisaExpiryDate = ref('')
const formEmergencyContactName = ref('')
const formEmergencyContactPhone = ref('')
const formDietaryRestrictions = ref('')
const formAccessibilityNeeds = ref('')
const formSpecialRequest = ref('')
const formCompanionOfTravelerId = ref('')

/** Opsi dropdown "Companion of" — kecualikan traveler yang sedang diedit sendiri (tidak boleh mendampingi diri sendiri). */
const companionOptions = computed(() => travelers.value.filter(t => t.id !== editingTravelerId.value))

/** Bikin Traveler Group baru langsung dari dialog Tambah/Edit Traveler — sebelumnya cuma bisa dari seed data. */
const isCreateGroupOpen = ref(false)
const newGroupName = ref('')

function submitCreateGroup () {
  if (!project.value || !newGroupName.value.trim()) { return }
  const group = createTravelerGroup({ projectId: project.value.id, name: newGroupName.value.trim() })
  formGroupId.value = group.id
  newGroupName.value = ''
  isCreateGroupOpen.value = false
  showToast('Group Dibuat', `Group "${group.name}" berhasil dibuat dan dipilih.`, 'success')
}

function resetTravelerForm () {
  formName.value = ''
  formGroupId.value = ''
  formPassportNumber.value = ''
  formPassportExpiryDate.value = ''
  formIdNumber.value = ''
  formVisaNumber.value = ''
  formVisaExpiryDate.value = ''
  formEmergencyContactName.value = ''
  formEmergencyContactPhone.value = ''
  formDietaryRestrictions.value = ''
  formAccessibilityNeeds.value = ''
  formSpecialRequest.value = ''
  formCompanionOfTravelerId.value = ''
}

function openCreateTraveler () {
  editingTravelerId.value = null
  resetTravelerForm()
  isTravelerDialogOpen.value = true
}

function openEditTraveler (traveler: Traveler) {
  editingTravelerId.value = traveler.id
  formName.value = traveler.name
  formGroupId.value = traveler.groupId ?? ''
  formPassportNumber.value = traveler.passportNumber ?? ''
  formPassportExpiryDate.value = traveler.passportExpiryDate ?? ''
  formIdNumber.value = traveler.idNumber ?? ''
  formVisaNumber.value = traveler.visaNumber ?? ''
  formVisaExpiryDate.value = traveler.visaExpiryDate ?? ''
  formEmergencyContactName.value = traveler.emergencyContactName ?? ''
  formEmergencyContactPhone.value = traveler.emergencyContactPhone ?? ''
  formDietaryRestrictions.value = traveler.dietaryRestrictions ?? ''
  formAccessibilityNeeds.value = traveler.accessibilityNeeds ?? ''
  formSpecialRequest.value = traveler.specialRequest ?? ''
  formCompanionOfTravelerId.value = traveler.companionOfTravelerId ?? ''
  isTravelerDialogOpen.value = true
}

function submitTraveler () {
  if (!project.value || !formName.value.trim()) { return }
  const payload = {
    groupId: formGroupId.value || undefined,
    name: formName.value.trim(),
    passportNumber: formPassportNumber.value.trim() || undefined,
    passportExpiryDate: formPassportExpiryDate.value || undefined,
    idNumber: formIdNumber.value.trim() || undefined,
    visaNumber: formVisaNumber.value.trim() || undefined,
    visaExpiryDate: formVisaExpiryDate.value || undefined,
    emergencyContactName: formEmergencyContactName.value.trim() || undefined,
    emergencyContactPhone: formEmergencyContactPhone.value.trim() || undefined,
    dietaryRestrictions: formDietaryRestrictions.value.trim() || undefined,
    accessibilityNeeds: formAccessibilityNeeds.value.trim() || undefined,
    specialRequest: formSpecialRequest.value.trim() || undefined,
    companionOfTravelerId: formCompanionOfTravelerId.value || undefined
  }
  if (editingTravelerId.value) {
    updateTraveler(editingTravelerId.value, payload)
    showToast('Traveler Diperbarui', `${payload.name} berhasil diperbarui.`)
  } else {
    createTraveler({ projectId: project.value.id, ...payload })
    showToast('Traveler Ditambahkan', `${payload.name} berhasil ditambahkan ke project.`)
  }
  isTravelerDialogOpen.value = false
}

const travelerToDelete = ref<Traveler | null>(null)

function executeDeleteTraveler () {
  if (!travelerToDelete.value) { return }
  const name = travelerToDelete.value.name
  removeTraveler(travelerToDelete.value.id)
  showToast('Traveler Dihapus', `${name} dihapus dari daftar traveler.`, 'info')
  travelerToDelete.value = null
}

/** "Internal verification" (Section 11 baru) — toggle tunggal, hanya `canManageTravelers`. */
function toggleVerification (traveler: Traveler) {
  toggleTravelerVerification(traveler.id, currentUser.value.id)
  showToast(
    traveler.documentsVerifiedAt ? 'Verifikasi Dibatalkan' : 'Dokumen Terverifikasi',
    `${traveler.name} ditandai ${traveler.documentsVerifiedAt ? 'belum diverifikasi' : 'sudah diverifikasi'}.`,
    'info'
  )
}

/** "Bulk import preview dan error report mock" (Section 11 baru) — menggantikan `importTravelersMock` lama (CI-041), lihat `app/data/index.ts`. */
const isImportPreviewOpen = ref(false)
const importPreviewRows = ref<TravelerImportPreviewRow[]>([])
const importCommitted = ref(false)
const importCommittedCount = ref(0)

const importValidCount = computed(() => importPreviewRows.value.filter(row => row.errors.length === 0).length)
const importErrorCount = computed(() => importPreviewRows.value.filter(row => row.errors.length > 0).length)

function openImportPreview () {
  if (!project.value) { return }
  importPreviewRows.value = previewTravelerImportMock(project.value.id, 5)
  importCommitted.value = false
  importCommittedCount.value = 0
  isImportPreviewOpen.value = true
}

function confirmImport () {
  if (!project.value) { return }
  const created = commitTravelerImport(project.value.id, importPreviewRows.value)
  importCommittedCount.value = created.length
  importCommitted.value = true
  showToast(
    'Import (Mock) Selesai',
    `${created.length} baris berhasil diimpor, ${importErrorCount.value} baris gagal (lihat error report) — lengkapi data dokumennya secara manual. Ini simulasi, bukan import file sungguhan.`,
    importErrorCount.value > 0 ? 'warning' : 'success'
  )
}

const summaryMetadata = computed(() => {
  if (!project.value) { return [] }
  return [
    { label: 'Client', value: party.value?.name ?? '—' },
    { label: 'Destinasi', value: project.value.destination },
    { label: 'Tanggal Perjalanan', value: formatDateRange(project.value.travelStartDate, project.value.travelEndDate) },
    { label: 'Project Owner (PM)', value: owner.value?.name ?? '—' },
    { label: 'Account Executive', value: accountExecutive.value?.name ?? '—' },
    { label: 'Status Internal', value: findStatusOption(PROJECT_STATUSES, project.value.status).label },
    { label: 'Jumlah Traveler', value: formatTravelerCount(project.value.travelerCount) },
    { label: 'Budget', value: formatCurrencyIdr(project.value.budgetIdr) },
    { label: 'Actual Cost', value: formatCurrencyIdr(actualCostIdr.value) },
    { label: 'Nilai Quotation', value: formatCurrencyIdr(project.value.quotationAmountIdr) }
  ]
})
</script>

<template>
  <div class="space-y-6">
    <template v-if="!project">
      <PageHeader title="Project Tidak Ditemukan" :breadcrumb="[{ label: 'Project', to: '/project-orders' }, { label: 'Not Found' }]" />
      <SectionCard>
        <EmptyState
          :icon="FileX"
          title="Project tidak ditemukan"
          :description="`Project dengan ID '${route.params.id}' tidak ada di data demo saat ini.`"
        >
          <Button @click="router.push('/project-orders')">
            Kembali ke Daftar Project
          </Button>
        </EmptyState>
      </SectionCard>
    </template>

    <RoleAccessState v-else-if="!canView('project')" module-label="modul Operations & Scheduling" />

    <template v-else>
      <Breadcrumb :items="[{ label: 'Project', to: '/project-orders' }, { label: project.name }]" />

      <ProjectBoardingPassHero
        :project="project"
        :client-name="party?.name ?? '—'"
        :pm-name="owner?.name ?? '—'"
        :ae-name="accountExecutive?.name ?? '—'"
        :order-status="orderStatus"
        :needs-attention="needsAttention"
        :upcoming-departure="isUpcomingDeparture(project)"
      />

      <SectionCard title="Detail Perjalanan">
        <DetailMetadataList :items="summaryMetadata" />
        <div class="mt-4 pt-4 border-t border-border">
          <p class="text-xs font-medium text-muted-foreground mb-2">
            Peta Lokasi
          </p>
          <DestinationMap :geo="project.destinationGeo" :destination-text="project.destination" show-route />
        </div>
      </SectionCard>

      <Tabs v-model="activeTab">
        <TabsList>
          <TabsTrigger v-for="tab in TABS" :key="tab.value" :value="tab.value">
            {{ tab.label }}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div class="space-y-6">
            <SectionCard v-if="project.isGroupTrip" title="Kapasitas Group Trip">
              <div class="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <StatsCard title="Seat Terisi" :value="`${getProjectSeatsFilled(project.id)} / ${project.travelerCount}`" :icon="Users" />
                <StatsCard title="Destinasi" :value="project.destination" :icon="MapPin" />
                <StatsCard title="Jadwal" :value="formatDateRange(project.travelStartDate, project.travelEndDate)" :icon="CalendarRange" />
              </div>
            </SectionCard>

            <!-- Order Status Stepper (Penyederhanaan 7-Role/Menu, dulu halaman terpisah /project-orders/[id]) -->
            <SectionCard title="Order Status — 6 Step">
              <ProjectOrderStepper
                :steps="stepViews"
                :selected-step-key="selectedStepKey"
                @select="value => selectedStepKey = selectedStepKey === value ? undefined : value"
              />

              <div v-if="selectedStepKey" class="mt-4 pt-4 border-t border-border">
                <template v-for="view in stepViews.filter(item => item.def.key === selectedStepKey)" :key="view.def.key">
                  <p class="text-sm font-medium text-foreground">
                    Step {{ view.def.index }} — {{ view.def.label }}
                  </p>
                  <p class="text-xs text-muted-foreground mt-0.5 mb-2">
                    {{ view.def.description }}
                  </p>
                  <ProjectOrderGateList
                    :blockers="view.gate.blockers"
                    :title="view.state === 'completed' ? 'Catatan step ini' : 'Belum dapat dilanjutkan'"
                    ready-message="Seluruh syarat step ini terpenuhi."
                  />
                </template>
              </div>

              <div v-if="canAdvanceStep && currentStepView" class="mt-4 pt-4 border-t border-border flex justify-end">
                <Button size="sm" :disabled="!currentStepView.gate.ready" @click="onAdvanceStep">
                  Advance: {{ currentStepView.def.label }} →
                </Button>
              </div>
            </SectionCard>

            <ProjectOrderTimelineTracking
              :project-id="project.id"
              :milestones="milestones"
              :can-manage="canManageOperations"
              :planned-dates-locked="plannedDatesLocked"
              @mark-actual="onMarkMilestoneActual"
              @update-planned="onUpdateMilestonePlanned"
            />

            <SectionCard title="Ringkasan Layanan">
              <div class="flex flex-wrap gap-2 mb-4">
                <StatusBadge
                  v-for="type in SERVICE_TYPES.filter(t => project.serviceScope.includes(t.value))"
                  :key="type.value"
                  :label="type.label"
                  :tone="type.tone"
                />
              </div>
              <p class="text-sm text-muted-foreground mb-4">
                Project ini berasal dari lead
                <NuxtLink v-if="project.leadId" :to="`/crm/leads/${project.leadId}`" class="text-primary hover:underline">
                  {{ project.leadId }}
                </NuxtLink><span v-else>—</span>,
                quotation approved <span class="text-foreground font-medium">{{ sourceQuotation ? formatCurrencyIdr(sourceQuotation.amountIdr) : '—' }}</span>.
              </p>
              <div class="flex items-center justify-between gap-2 mb-2">
                <p class="text-xs font-medium text-muted-foreground">
                  Tim Project
                </p>
                <Dialog v-if="canManageProjectOrder" v-model:open="isTeamDialogOpen">
                  <DialogTrigger as-child>
                    <Button size="sm" variant="ghost">
                      + Tambah Anggota
                    </Button>
                  </DialogTrigger>
                  <DialogContent class="max-w-sm">
                    <DialogHeader>
                      <DialogTitle>Tambah Anggota Tim</DialogTitle>
                      <DialogDescription>Anggota baru akan ditambahkan ke `teamUserIds` project ini.</DialogDescription>
                    </DialogHeader>
                    <div class="space-y-1.5 py-2">
                      <Label for="team-member">User</Label>
                      <select id="team-member" v-model="teamMemberToAdd" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                        <option value="" disabled>
                          Pilih user
                        </option>
                        <option v-for="user in teamOptions" :key="user.id" :value="user.id">
                          {{ user.name }} ({{ user.role }})
                        </option>
                      </select>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" @click="isTeamDialogOpen = false">
                        Batal
                      </Button>
                      <Button :disabled="!teamMemberToAdd" @click="submitAddTeamMember">
                        Tambah
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
              <div class="flex flex-wrap gap-2">
                <StatusBadge :label="`PM: ${owner?.name ?? '—'}`" tone="primary" />
                <StatusBadge :label="`AE: ${accountExecutive?.name ?? '—'}`" tone="info" />
                <span v-for="member in team" :key="member.id" class="inline-flex items-center gap-1 rounded-full border border-input px-2.5 py-0.5 text-xs text-foreground">
                  {{ member.name }} <span class="text-muted-foreground">({{ member.role }})</span>
                  <button v-if="canManageProjectOrder" type="button" class="ml-1 text-muted-foreground hover:text-destructive" @click="submitRemoveTeamMember(member.id)">×</button>
                </span>
              </div>
            </SectionCard>

            <SectionCard title="Handover &amp; Project Status" description="AE-to-PM handover dan transisi status Project Order.">
              <div class="flex items-center gap-2 mb-4">
                <StatusBadge v-if="orderStatus" :label="findStatusOption(PROJECT_ORDER_STATUSES, orderStatus).label" :tone="findStatusOption(PROJECT_ORDER_STATUSES, orderStatus).tone" />
              </div>

              <template v-if="orderStatus === 'handover-pending'">
                <p class="text-sm text-foreground mb-3">
                  Project Order ini menunggu diterima oleh Project Manager sebelum planning dapat dimulai. Seluruh data komersial (quotation, budget) sudah tersedia penuh.
                </p>
                <p v-if="project.handoverReturnReason" class="text-sm text-warning mb-3">
                  Sebelumnya dikembalikan dengan alasan: "{{ project.handoverReturnReason }}"
                </p>
                <div v-if="canManageProjectOrder" class="flex flex-wrap gap-2">
                  <Button size="sm" @click="submitAcceptHandover">
                    Accept Handover
                  </Button>
                  <Dialog v-model:open="isReturnHandoverDialogOpen">
                    <DialogTrigger as-child>
                      <Button size="sm" variant="outline">
                        Return Handover
                      </Button>
                    </DialogTrigger>
                    <DialogContent class="max-w-md">
                      <DialogHeader>
                        <DialogTitle>Return Handover</DialogTitle>
                        <DialogDescription>Project Order dikembalikan ke AE dengan alasan — status tetap Handover Pending.</DialogDescription>
                      </DialogHeader>
                      <div class="space-y-1.5 py-2">
                        <Label for="return-reason">Alasan</Label>
                        <Input id="return-reason" v-model="returnHandoverReason" placeholder="mis. Data traveler awal belum lengkap" />
                      </div>
                      <DialogFooter>
                        <Button variant="outline" @click="isReturnHandoverDialogOpen = false">
                          Batal
                        </Button>
                        <Button variant="destructive" :disabled="!returnHandoverReason.trim()" @click="submitReturnHandover">
                          Return Handover
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </template>
              <template v-else>
                <p v-if="project.handoverAcceptedAt" class="text-xs text-muted-foreground mb-3">
                  Handover diterima {{ getUserById(project.handoverAcceptedBy ?? '')?.name ?? '—' }} pada {{ formatDate(project.handoverAcceptedAt) }}.
                </p>
                <div v-if="canManageProjectOrder" class="flex flex-wrap gap-2">
                  <Button v-if="orderStatus === 'confirmed'" size="sm" variant="outline" @click="submitMarkReady">
                    Tandai Ready
                  </Button>
                  <Button
                    v-for="nextStatus in nextStatusOptions"
                    :key="nextStatus"
                    size="sm"
                    :variant="['on-hold', 'cancelled'].includes(nextStatus) ? 'destructive' : 'outline'"
                    @click="openStatusDialog(nextStatus)"
                  >
                    {{ findStatusOption(PROJECT_STATUSES, nextStatus).label }}
                  </Button>
                </div>
              </template>

              <Dialog v-model:open="isStatusDialogOpen">
                <DialogContent class="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Ubah Status ke "{{ pendingStatus ? findStatusOption(PROJECT_STATUSES, pendingStatus).label : '' }}"</DialogTitle>
                    <DialogDescription v-if="statusReasonRequired">
                      Alasan wajib diisi dan akan tercatat di Activity (visible ke seluruh tim).
                    </DialogDescription>
                  </DialogHeader>
                  <div v-if="statusReasonRequired" class="space-y-1.5 py-2">
                    <Label for="status-reason">Alasan</Label>
                    <Input id="status-reason" v-model="statusReason" placeholder="mis. Client meminta penundaan sementara" />
                  </div>
                  <DialogFooter>
                    <Button variant="outline" @click="isStatusDialogOpen = false">
                      Batal
                    </Button>
                    <Button :disabled="statusReasonRequired && !statusReason.trim()" @click="submitStatusTransition">
                      Konfirmasi
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </SectionCard>

            <SectionCard title="Risks">
              <template v-if="canManageProjectOrder" #actions>
                <Dialog v-model:open="isRiskDialogOpen">
                  <DialogTrigger as-child>
                    <Button size="sm" variant="outline">
                      + Catat Risk
                    </Button>
                  </DialogTrigger>
                  <DialogContent class="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Catat Risk Baru</DialogTitle>
                    </DialogHeader>
                    <div class="space-y-4 py-2">
                      <div class="space-y-1.5">
                        <Label for="risk-title">Judul</Label><Input id="risk-title" v-model="riskTitle" />
                      </div>
                      <div class="space-y-1.5">
                        <Label for="risk-desc">Deskripsi</Label><textarea id="risk-desc" v-model="riskDescription" rows="2" class="w-full px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
                      </div>
                      <div class="space-y-1.5">
                        <Label for="risk-severity">Severity</Label>
                        <select id="risk-severity" v-model="riskSeverity" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                          <option v-for="sev in RISK_SEVERITIES" :key="sev.value" :value="sev.value">
                            {{ sev.label }}
                          </option>
                        </select>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" @click="isRiskDialogOpen = false">
                        Batal
                      </Button>
                      <Button :disabled="!riskTitle.trim()" @click="submitRisk">
                        Simpan
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </template>
              <ul v-if="risks.length" class="divide-y divide-border">
                <li v-for="risk in risks" :key="risk.id" class="py-3">
                  <div class="flex items-center justify-between gap-3">
                    <p class="text-sm font-medium text-foreground">
                      {{ risk.title }}
                    </p>
                    <div class="flex items-center gap-2 shrink-0">
                      <StatusBadge :label="findStatusOption(RISK_SEVERITIES, risk.severity).label" :tone="findStatusOption(RISK_SEVERITIES, risk.severity).tone" />
                      <button
                        type="button"
                        class="disabled:cursor-not-allowed"
                        :disabled="!canManageProjectOrder"
                        @click="canManageProjectOrder && cycleRiskStatus(risk.id, risk.status)"
                      >
                        <StatusBadge :label="findStatusOption(RISK_STATUSES, risk.status).label" :tone="findStatusOption(RISK_STATUSES, risk.status).tone" />
                      </button>
                    </div>
                  </div>
                  <p v-if="risk.description" class="text-xs text-muted-foreground mt-1">
                    {{ risk.description }}
                  </p>
                </li>
              </ul>
              <EmptyState v-else title="Belum ada risk tercatat" />
            </SectionCard>

            <SectionCard title="Closure Checklist" description="Shell — akan digerbangi penuh ke transisi Closed pada section akhir.">
              <ul class="space-y-2">
                <li v-for="item in CLOSURE_CHECKLIST_ITEMS" :key="item.key" class="flex items-center gap-2">
                  <Checkbox
                    :model-value="project.closureChecklist?.[item.key] ?? false"
                    :disabled="item.key === 'financeSettled' ? true : !canManageProjectOrder"
                    @update:model-value="(value) => item.key !== 'financeSettled' && toggleClosureItem(item.key, Boolean(value))"
                  />
                  <span class="text-sm text-foreground">{{ item.label }}</span>
                  <span v-if="item.key === 'financeSettled'" class="text-xs text-muted-foreground">(dikelola lewat aksi &quot;Close Finance&quot; di tab Finance, Section 20)</span>
                </li>
              </ul>
            </SectionCard>

            <SectionCard title="Project Closure" description="Gate final sebelum Project Order berstatus Closed — services completed, finance finalized, unresolved issues handled, documents complete.">
              <template v-if="isProjectAlreadyClosed">
                <p class="text-sm text-success flex items-center gap-1.5 mb-3">
                  <CheckCircle2 class="h-4 w-4" />Project ini sudah Closed{{ project.closedAt ? ` pada ${formatDate(project.closedAt)}` : '' }}{{ closedByName ? ` oleh ${closedByName}` : '' }}.
                </p>
                <p v-if="project.closureChecklist?.finalNote" class="text-sm text-foreground mb-1">
                  <span class="text-muted-foreground">Final note:</span> {{ project.closureChecklist.finalNote }}
                </p>
                <p v-if="project.closureChecklist?.clientFeedback" class="text-sm text-foreground mb-3">
                  <span class="text-muted-foreground">Client feedback:</span> {{ project.closureChecklist.clientFeedback }}
                </p>
                <div v-if="projectClosureSummary" class="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-border">
                  <div>
                    <p class="text-xs text-muted-foreground">
                      Total Services
                    </p><p class="text-sm font-semibold text-foreground">
                      {{ projectClosureSummary.totalServices }}
                    </p>
                  </div>
                  <div>
                    <p class="text-xs text-muted-foreground">
                      Total Booking
                    </p><p class="text-sm font-semibold text-foreground">
                      {{ projectClosureSummary.totalBookings }}
                    </p>
                  </div>
                  <div>
                    <p class="text-xs text-muted-foreground">
                      Total Invoiced
                    </p><p class="text-sm font-semibold text-foreground">
                      {{ formatCurrencyIdr(projectClosureSummary.totalInvoicedIdr) }}
                    </p>
                  </div>
                  <div>
                    <p class="text-xs text-muted-foreground">
                      Total Paid
                    </p><p class="text-sm font-semibold text-foreground">
                      {{ formatCurrencyIdr(projectClosureSummary.totalPaidIdr) }}
                    </p>
                  </div>
                  <div>
                    <p class="text-xs text-muted-foreground">
                      Incident Resolved
                    </p><p class="text-sm font-semibold text-foreground">
                      {{ projectClosureSummary.incidentsResolved }}/{{ projectClosureSummary.incidentsTotal }}
                    </p>
                  </div>
                  <div>
                    <p class="text-xs text-muted-foreground">
                      Change Request Implemented
                    </p><p class="text-sm font-semibold text-foreground">
                      {{ projectClosureSummary.changeRequestsImplemented }}/{{ projectClosureSummary.changeRequestsTotal }}
                    </p>
                  </div>
                </div>
              </template>
              <template v-else>
                <template v-if="projectClosureGate.ready">
                  <p class="text-sm text-success mb-3 flex items-center gap-1.5">
                    <CheckCircle2 class="h-4 w-4" />Tidak ada blocker — siap ditutup (Closed).
                  </p>
                </template>
                <template v-else>
                  <p class="text-sm text-muted-foreground mb-2">
                    Blocker yang harus diselesaikan sebelum Project dapat ditutup:
                  </p>
                  <ul class="list-disc list-inside text-sm text-destructive mb-3">
                    <li v-for="(blocker, index) in projectClosureGate.blockers" :key="index">
                      {{ blocker }}
                    </li>
                  </ul>
                </template>
                <template v-if="canCloseProject">
                  <div class="space-y-2 max-w-xl">
                    <div class="space-y-1">
                      <Label for="close-project-final-note">Final Note <span class="text-destructive">*</span></Label>
                      <textarea id="close-project-final-note" v-model="closeProjectFinalNote" rows="2" class="w-full px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring" placeholder="Ringkasan penutupan project (wajib)" />
                    </div>
                    <div class="space-y-1">
                      <Label for="close-project-client-feedback">Client Feedback (opsional)</Label>
                      <textarea id="close-project-client-feedback" v-model="closeProjectClientFeedback" rows="2" class="w-full px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring" placeholder="Feedback dari client, bila ada" />
                    </div>
                    <Button size="sm" :disabled="!projectClosureGate.ready || !closeProjectFinalNote.trim()" @click="submitCloseProject">
                      Close Project
                    </Button>
                  </div>
                </template>
                <p v-else class="text-xs text-muted-foreground">
                  Hanya Management/Project Manager/Super Admin yang dapat menutup project.
                </p>
              </template>
            </SectionCard>

            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <SectionCard title="Service Summary">
                <StatusBreakdownList :items="serviceStatusSummary" empty-label="Belum ada layanan tercatat" />
              </SectionCard>

              <SectionCard title="Milestone / Task Summary">
                <StatusBreakdownList :items="taskStatusSummary" empty-label="Belum ada task tercatat" />
              </SectionCard>

              <SectionCard title="Document Summary" :description="`${documents.length} dokumen tersimpan`">
                <ul v-if="recentDocuments.length" class="divide-y divide-border">
                  <li v-for="document in recentDocuments" :key="document.id" class="py-2 flex items-center justify-between gap-3">
                    <span class="text-sm text-foreground truncate">{{ document.name }}</span>
                    <span class="text-xs text-muted-foreground shrink-0">{{ formatDate(document.uploadedAt) }}</span>
                  </li>
                </ul>
                <EmptyState v-else title="Belum ada dokumen diunggah" />
              </SectionCard>

              <SectionCard title="Recent Activity">
                <template #actions>
                  <Button v-if="activities.length > 0" size="sm" variant="outline" @click="goToActivityTab">
                    Lihat Semua
                  </Button>
                </template>
                <ul v-if="recentActivityPreview.length" class="divide-y divide-border">
                  <li v-for="entry in recentActivityPreview" :key="entry.id" class="py-2">
                    <p class="text-sm text-foreground">
                      {{ entry.message }}
                    </p>
                    <p class="text-xs text-muted-foreground">
                      {{ formatDate(entry.createdAt) }}
                    </p>
                  </li>
                </ul>
                <EmptyState v-else title="Belum ada aktivitas tercatat" />
              </SectionCard>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="itinerary-services">
          <div class="space-y-6">
            <!-- Departure Readiness Gate (Section 12 baru) -->
            <SectionCard v-if="departureReadiness" title="Departure Readiness Gate" description="Ringkasan kesiapan lintas-domain sebelum keberangkatan — advisory, tidak memblokir transisi status." accent :tone="departureReadiness.isReady ? 'success' : 'warning'">
              <template #actions>
                <NuxtLink :to="`/project-orders/${project.id}/run-sheet-preview`" target="_blank">
                  <Button size="sm" variant="outline">
                    <Printer class="h-4 w-4 mr-1.5" />Run Sheet / Export Preview
                  </Button>
                </NuxtLink>
              </template>
              <div class="flex items-center gap-3 mb-4">
                <StatusBadge :label="departureReadiness.isReady ? 'Ready to Depart' : 'Belum Siap'" :tone="departureReadiness.isReady ? 'success' : 'warning'" />
                <p class="text-sm text-muted-foreground">
                  <template v-if="departureReadiness.daysUntilDeparture >= 0">
                    H-{{ departureReadiness.daysUntilDeparture }} menuju keberangkatan
                  </template>
                  <template v-else>
                    Keberangkatan sudah lewat {{ Math.abs(departureReadiness.daysUntilDeparture) }} hari lalu
                  </template>
                </p>
              </div>
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                <div class="rounded-lg border border-border p-3">
                  <p class="text-xs text-muted-foreground">
                    Dokumen Traveler
                  </p>
                  <p class="text-lg font-semibold text-foreground">
                    {{ departureReadiness.travelerReadinessPercent }}%
                  </p>
                </div>
                <div class="rounded-lg border border-border p-3">
                  <p class="text-xs text-muted-foreground">
                    Layanan Confirmed
                  </p>
                  <p class="text-lg font-semibold text-foreground">
                    {{ departureReadiness.servicesConfirmedPercent }}%
                  </p>
                </div>
                <div class="rounded-lg border border-border p-3">
                  <p class="text-xs text-muted-foreground">
                    Task Diblokir
                  </p>
                  <p class="text-lg font-semibold text-foreground">
                    {{ departureReadiness.blockedTasksCount }}
                  </p>
                </div>
                <div class="rounded-lg border border-border p-3">
                  <p class="text-xs text-muted-foreground">
                    Risk Terbuka
                  </p>
                  <p class="text-lg font-semibold text-foreground">
                    {{ departureReadiness.openRisksCount }}
                  </p>
                </div>
              </div>
              <div v-if="departureReadiness.blockingReasons.length > 0" class="text-xs text-muted-foreground">
                <p class="font-semibold uppercase tracking-wide mb-1">
                  Belum Terpenuhi
                </p>
                <ul class="list-disc list-inside space-y-0.5">
                  <li v-for="(reason, index) in departureReadiness.blockingReasons" :key="index">
                    {{ reason }}
                  </li>
                </ul>
              </div>
            </SectionCard>

            <!-- Attention / Exception Queue (Section 12 baru) -->
            <SectionCard v-if="attentionQueue.length > 0" title="Attention / Exception Queue" description="Item lintas-domain yang butuh perhatian — klik untuk lompat ke tab terkait." accent tone="destructive">
              <ul class="divide-y divide-border">
                <li v-for="(item, index) in attentionQueue" :key="index" class="py-2">
                  <button type="button" class="flex items-center gap-2 text-left w-full hover:text-primary" @click="goToAttentionTab(item.tab)">
                    <AlertTriangle class="h-4 w-4 shrink-0" :class="item.severity === 'high' ? 'text-destructive' : 'text-amber-500'" />
                    <span class="text-sm text-foreground">{{ item.message }}</span>
                  </button>
                </li>
              </ul>
            </SectionCard>

            <SectionCard
              v-if="project.characteristic === 'high-change' && changedServicesCount > 0"
              title="Penanda Perubahan"
              description="Project ini adalah High-Change Project."
              accent
              tone="warning"
            >
              <p class="text-sm text-foreground mb-3">
                {{ changedServicesCount }} layanan mengalami perubahan setelah dikonfirmasi. Tinjau riwayat lengkap di tab Activity & Changes.
              </p>
              <Button size="sm" variant="outline" @click="goToActivityTab">
                Lihat Activity & Changes
              </Button>
            </SectionCard>

            <!-- Service Readiness Matrix (Section 12 baru) -->
            <SectionCard v-if="serviceReadinessMatrix.length > 0" title="Service Readiness Matrix" description="Agregat kesiapan layanan per tipe.">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipe Layanan</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Confirmed/Completed</TableHead>
                    <TableHead>% Siap</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow v-for="row in serviceReadinessMatrix" :key="row.type">
                    <TableCell><StatusBadge :label="findStatusOption(SERVICE_TYPES, row.type).label" :tone="findStatusOption(SERVICE_TYPES, row.type).tone" /></TableCell>
                    <TableCell class="text-muted-foreground">
                      {{ row.total }}
                    </TableCell>
                    <TableCell class="text-muted-foreground">
                      {{ row.confirmedCount }}
                    </TableCell>
                    <TableCell class="text-foreground font-medium">
                      {{ row.percent }}%
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </SectionCard>

            <SectionCard title="Lokasi Tujuan" :description="project.destination">
              <DestinationMap :geo="project.destinationGeo" :destination-text="project.destination" show-route />
            </SectionCard>

            <SectionCard title="Daily Itinerary" description="Jadwal harian perjalanan (timezone lokal ditampilkan berdampingan jam).">
              <template #actions>
                <div class="flex items-center gap-2">
                  <div class="flex items-center gap-1">
                    <button type="button" class="px-3 py-1.5 text-xs rounded-lg border" :class="itineraryViewMode === 'list' ? 'border-primary/40 bg-primary/5 text-primary' : 'border-border text-muted-foreground'" @click="itineraryViewMode = 'list'">
                      List
                    </button>
                    <button type="button" class="px-3 py-1.5 text-xs rounded-lg border" :class="itineraryViewMode === 'timeline' ? 'border-primary/40 bg-primary/5 text-primary' : 'border-border text-muted-foreground'" @click="itineraryViewMode = 'timeline'">
                      Timeline
                    </button>
                  </div>
                  <Button v-if="canManageOperations" size="sm" variant="outline" @click="openCreateItineraryItem">
                    <Plus class="h-3.5 w-3.5 mr-1" />Tambah Item
                  </Button>
                  <NuxtLink :to="`/project-orders/${project.id}/run-sheet-preview`" target="_blank">
                    <Button size="sm" variant="outline">
                      <Printer class="h-4 w-4 mr-1.5" />Print / Export Preview
                    </Button>
                  </NuxtLink>
                </div>
              </template>
              <div v-if="itineraryByDate.length" class="space-y-4">
                <div v-for="day in itineraryByDate" :key="day.date" :class="itineraryViewMode === 'timeline' ? 'relative pl-4 border-l-2 border-border' : ''">
                  <p class="text-xs font-medium text-muted-foreground mb-2">
                    {{ formatDayLabel(day.date) }}
                  </p>
                  <ul class="divide-y divide-border">
                    <li v-for="item in day.items" :key="item.id" class="py-2 flex items-start gap-3" :class="itineraryViewMode === 'timeline' ? 'relative before:absolute before:-left-[21px] before:top-3 before:h-2.5 before:w-2.5 before:rounded-full before:bg-primary' : ''">
                      <span class="text-xs text-muted-foreground w-24 shrink-0">{{ item.time ?? '—' }}<template v-if="item.timezone"> ({{ item.timezone }})</template></span>
                      <div class="min-w-0 flex-1">
                        <p class="text-sm text-foreground">
                          {{ item.title }}
                        </p>
                        <p v-if="item.description" class="text-xs text-muted-foreground">
                          {{ item.description }}
                        </p>
                        <p v-if="item.groupId" class="text-xs text-muted-foreground">
                          Group: {{ groupNameById(item.groupId) }}
                        </p>
                      </div>
                      <StatusBadge v-if="item.visibleToClient === false" label="Internal Only" tone="neutral" />
                      <StatusBadge
                        v-if="item.serviceType"
                        :label="findStatusOption(SERVICE_TYPES, item.serviceType).label"
                        :tone="findStatusOption(SERVICE_TYPES, item.serviceType).tone"
                      />
                      <button v-if="canManageOperations" type="button" class="text-xs text-primary hover:underline shrink-0" @click="toggleItineraryVisibility(item)">
                        {{ item.visibleToClient === false ? 'Tampilkan ke Client' : 'Jadikan Internal' }}
                      </button>
                      <button v-if="canManageOperations" type="button" class="text-xs text-primary hover:underline shrink-0" @click="openEditItineraryItem(item)">
                        Edit
                      </button>
                      <button v-if="canManageOperations" type="button" class="text-xs text-destructive hover:underline shrink-0" @click="pendingDeleteItineraryItem = item">
                        Hapus
                      </button>
                    </li>
                  </ul>
                </div>
              </div>
              <EmptyState v-else title="Belum ada itinerary tercatat" />
            </SectionCard>

            <!-- Daily itinerary — create/edit form (docs/superpowers/specs/2026-08-05-daily-itinerary-crud-design.md) -->
            <Dialog v-model:open="isItineraryFormOpen">
              <DialogContent class="max-w-md">
                <DialogHeader>
                  <DialogTitle>{{ editingItineraryItemId ? 'Edit Item Itinerary' : 'Tambah Item Itinerary' }}</DialogTitle>
                </DialogHeader>
                <div class="space-y-4 py-2">
                  <div class="grid grid-cols-2 gap-3">
                    <div class="space-y-1.5">
                      <Label for="itin-date">Tanggal</Label><Input id="itin-date" v-model="itineraryForm.date" type="date" />
                    </div>
                    <div class="space-y-1.5">
                      <Label for="itin-time">Jam</Label><Input id="itin-time" v-model="itineraryForm.time" type="time" />
                    </div>
                  </div>
                  <div class="space-y-1.5">
                    <Label for="itin-title">Judul</Label><Input id="itin-title" v-model="itineraryForm.title" placeholder="mis. Keberangkatan Jakarta → Manila" />
                  </div>
                  <div class="space-y-1.5">
                    <Label for="itin-description">Deskripsi</Label>
                    <textarea id="itin-description" v-model="itineraryForm.description" rows="2" class="w-full px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
                  </div>
                  <div class="space-y-1.5">
                    <Label for="itin-location">Lokasi</Label><Input id="itin-location" v-model="itineraryForm.location" placeholder="mis. Lobi Hotel, pukul 08:00" />
                  </div>
                  <div class="grid grid-cols-2 gap-3">
                    <div class="space-y-1.5">
                      <Label for="itin-service-type">Jenis Layanan</Label>
                      <select id="itin-service-type" v-model="itineraryForm.serviceType" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                        <option value="">
                          Tidak ada
                        </option>
                        <option v-for="type in SERVICE_TYPES" :key="type.value" :value="type.value">
                          {{ type.label }}
                        </option>
                      </select>
                    </div>
                    <div class="space-y-1.5">
                      <Label for="itin-group">Group Traveler</Label>
                      <select id="itin-group" v-model="itineraryForm.groupId" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                        <option value="">
                          Tidak ada
                        </option>
                        <option v-for="grp in groups" :key="grp.id" :value="grp.id">
                          {{ grp.name }}
                        </option>
                      </select>
                    </div>
                  </div>
                  <div class="space-y-1.5">
                    <Label for="itin-timezone">Timezone</Label><Input id="itin-timezone" v-model="itineraryForm.timezone" placeholder="mis. Asia/Jakarta" />
                  </div>
                  <label class="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                    <Checkbox v-model="itineraryForm.visibleToClient" />
                    Tampilkan ke Client
                  </label>
                </div>
                <DialogFooter>
                  <Button variant="outline" @click="isItineraryFormOpen = false">
                    Batal
                  </Button>
                  <Button :disabled="!itineraryForm.date.trim() || !itineraryForm.title.trim()" @click="submitItineraryForm">
                    Simpan
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog :open="!!pendingDeleteItineraryItem" @update:open="value => { if (!value) pendingDeleteItineraryItem = undefined }">
              <DialogContent class="max-w-md">
                <DialogHeader>
                  <DialogTitle>Hapus Item Itinerary</DialogTitle>
                  <DialogDescription>
                    Item "{{ pendingDeleteItineraryItem?.title }}" akan dihapus dari itinerary project ini. Tindakan ini tidak dapat dibatalkan.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" @click="pendingDeleteItineraryItem = undefined">
                    Batal
                  </Button>
                  <Button variant="destructive" @click="confirmDeleteItineraryItem">
                    Hapus
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <SectionCard
              v-for="type in visibleServiceTypes"
              :key="type.value"
              :title="type.label"
              :description="serviceReadinessLabel(type.value)"
            >
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Detail</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Booking Reference</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead v-if="canManageServiceType(type.value)">
                      Update Status
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow v-for="service in servicesByType(type.value)" :key="service.id">
                    <TableCell class="text-foreground">
                      {{ service.label }}
                    </TableCell>
                    <TableCell class="text-muted-foreground">
                      {{ service.vendorId ? getVendorById(service.vendorId)?.name : '—' }}
                    </TableCell>
                    <TableCell class="font-ticket-mono text-muted-foreground">
                      {{ service.bookingReference ?? '—' }}
                    </TableCell>
                    <TableCell>
                      <div class="flex items-center gap-2">
                        <StatusBadge
                          :label="findStatusOption(SERVICE_STATUSES, service.status).label"
                          :tone="findStatusOption(SERVICE_STATUSES, service.status).tone"
                        />
                        <StatusBadge v-if="service.status === 'changed'" label="Perlu Ditinjau" tone="destructive" />
                      </div>
                    </TableCell>
                    <TableCell v-if="canManageServiceType(type.value)">
                      <NuxtLink v-if="linkedBookingRef(service)" :to="linkedBookingRef(service)?.path ?? ''" class="text-xs text-primary hover:underline">
                        Lihat Booking →
                      </NuxtLink>
                      <select
                        v-else
                        :value="service.status"
                        class="appearance-none px-2 py-1.5 text-xs rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer"
                        @change="handleServiceStatusChange(service.id, $event)"
                      >
                        <option v-for="option in SERVICE_STATUSES" :key="option.value" :value="option.value">
                          {{ option.label }}
                        </option>
                      </select>
                    </TableCell>
                  </TableRow>
                  <TableEmpty v-if="servicesByType(type.value).length === 0" :colspan="canManageServiceType(type.value) ? 5 : 4">
                    Belum ada layanan tercatat.
                  </TableEmpty>
                </TableBody>
              </Table>

              <!-- "Buat Booking" quick-create (Section 13-16) — daftar booking sendiri kini terkonsolidasi di SectionCard "Booking Timeline" (Section 18) di bawah, bukan diulang per tipe layanan di sini. -->
              <div v-if="SERVICE_TAB_KEY[type.value] && canManageServiceType(type.value)" class="mt-4 pt-4 border-t border-border flex justify-end">
                <NuxtLink :to="`/services?projectId=${project.id}&create=1#${SERVICE_TAB_KEY[type.value]}`">
                  <Button size="sm" variant="outline">
                    <Plus class="h-4 w-4 mr-1.5" />Buat {{ type.label }} Booking
                  </Button>
                </NuxtLink>
              </div>
            </SectionCard>

            <EmptyState v-if="visibleServiceTypes.length === 0" :icon="Truck" title="Belum ada layanan tercatat untuk project ini" />

            <!--
              Booking Timeline (Section 18, D-075) — SATU list terunifikasi lintas Flight/Hotel/Transport/MICE
              MENGGANTIKAN 4 blok ringkasan terpisah lama (Section 13-16, lihat CI-048). Informasi identik
              dengan `/bookings` (booking reference/status internal-supplier-client/deadline/voucher/exception/
              dependency/payment-gate), hanya pre-filtered ke project ini. Aksi Mark Payment Cleared/Catat
              Percobaan TETAP di `/bookings` (bukan di sini) — tab ini murni ringkasan+link, konsisten pola
              ringkasan Procurement di bawah.
            -->
            <SectionCard v-if="projectBookingTimeline.length" title="Booking Timeline" description="Konsolidasi Flight/Hotel/Transport/MICE booking untuk project ini — satu sumber kebenaran seluruh service (Section 18).">
              <template #actions>
                <NuxtLink :to="`/bookings?projectId=${project.id}`">
                  <Button size="sm" variant="outline">
                    Buka Booking Center
                  </Button>
                </NuxtLink>
              </template>
              <ul class="divide-y divide-border">
                <li v-for="entry in projectBookingTimeline" :key="`${entry.bookingType}-${entry.bookingId}`" class="py-3">
                  <div class="flex flex-wrap items-center justify-between gap-2">
                    <div class="min-w-0">
                      <div class="flex items-center gap-1.5">
                        <StatusBadge :label="BOOKING_DOMAIN_LABEL_MAP[entry.bookingType]" :tone="BOOKING_DOMAIN_TONE_MAP[entry.bookingType]" />
                        <NuxtLink :to="entry.detailHref" class="font-ticket-mono text-sm font-medium text-foreground hover:text-primary hover:underline">
                          {{ entry.bookingId }}
                        </NuxtLink>
                        <span class="text-xs text-muted-foreground">{{ entry.label }}</span>
                      </div>
                      <p class="font-ticket-mono text-xs text-muted-foreground mt-0.5">
                        Ref: {{ entry.reference ?? 'Belum terbit' }} · {{ entry.travelerCount }} pax
                        <template v-if="entry.deadlineDate">
                          · Deadline: {{ formatDate(entry.deadlineDate) }}
                        </template>
                      </p>
                    </div>
                    <div class="flex items-center gap-2">
                      <StatusBadge :label="entry.internalStatus" :tone="entry.internalStatusTone" />
                      <StatusBadge :label="findStatusOption(BOOKING_PAYMENT_GATE_STATUSES, entry.paymentGateStatus).label" :tone="findStatusOption(BOOKING_PAYMENT_GATE_STATUSES, entry.paymentGateStatus).tone" />
                      <NuxtLink v-if="entry.voucherHref" :to="entry.voucherHref" target="_blank">
                        <Button size="sm" variant="ghost">
                          Voucher
                        </Button>
                      </NuxtLink>
                    </div>
                  </div>
                  <ul v-if="entry.exceptions.length" class="mt-1.5 space-y-0.5">
                    <li v-for="(exception, index) in entry.exceptions" :key="index" class="text-xs text-destructive">
                      {{ exception }}
                    </li>
                  </ul>
                </li>
              </ul>
            </SectionCard>

            <!-- Procurement summary (Section 17 baru) — ringkasan RFQ dan Service Order, pengelolaan lengkap di modul /procurement. -->
            <SectionCard v-if="projectRfqs.length || projectServiceOrders.length" title="Procurement — RFQ dan Service Order" description="Ringkasan sourcing formal dan Service Order untuk project ini.">
              <template #actions>
                <NuxtLink to="/procurement">
                  <Button size="sm" variant="outline">
                    Buka Procurement
                  </Button>
                </NuxtLink>
              </template>
              <div v-if="projectRfqs.length" class="mb-4">
                <p class="text-xs font-medium text-muted-foreground mb-2">
                  RFQ
                </p>
                <ul class="divide-y divide-border">
                  <li v-for="rfq in projectRfqs" :key="rfq.id" class="py-2 flex items-center justify-between gap-2">
                    <NuxtLink :to="`/procurement/rfq/${rfq.id}`" class="text-sm font-medium text-foreground hover:text-primary hover:underline">
                      {{ rfq.title }}
                    </NuxtLink>
                    <StatusBadge :label="findStatusOption(RFQ_STATUSES, rfq.status).label" :tone="findStatusOption(RFQ_STATUSES, rfq.status).tone" />
                  </li>
                </ul>
              </div>
              <div v-if="projectServiceOrders.length">
                <p class="text-xs font-medium text-muted-foreground mb-2">
                  Service Orders
                </p>
                <ul class="divide-y divide-border">
                  <li v-for="so in projectServiceOrders" :key="so.id" class="py-2 flex items-center justify-between gap-2">
                    <NuxtLink :to="`/procurement/service-orders/${so.id}`" class="text-sm font-medium text-foreground hover:text-primary hover:underline">
                      {{ so.id }} — {{ getVendorById(so.vendorId)?.name ?? so.vendorId }}
                    </NuxtLink>
                    <StatusBadge :label="findStatusOption(SERVICE_ORDER_STATUSES, so.status).label" :tone="findStatusOption(SERVICE_ORDER_STATUSES, so.status).tone" />
                  </li>
                </ul>
              </div>
            </SectionCard>

            <SectionCard title="Operational Tasks" :description="`${tasks.length} task tercatat untuk project ini`">
              <template v-if="tasks.length" #actions>
                <Button size="sm" variant="outline" @click="activeTab = 'tasks'">
                  Lihat Semua Task
                </Button>
              </template>
              <ul v-if="tasks.length" class="divide-y divide-border">
                <li v-for="task in tasks.slice(0, 5)" :key="task.id" class="py-2 flex items-center justify-between gap-3">
                  <span class="text-sm text-foreground">{{ task.title }}</span>
                  <StatusBadge
                    :label="findStatusOption(TASK_STATUSES, task.status).label"
                    :tone="findStatusOption(TASK_STATUSES, task.status).tone"
                  />
                </li>
              </ul>
              <EmptyState v-else title="Belum ada task tercatat" />
            </SectionCard>

            <!-- On-Trip Updates / Shift Notes (Section 12 baru) -->
            <SectionCard title="On-Trip Updates / Shift Notes" description="Catatan serah-terima operasional selama trip berlangsung (mock).">
              <template v-if="canManageOperations" #actions>
                <Dialog v-model:open="isShiftNoteDialogOpen">
                  <DialogTrigger as-child>
                    <Button size="sm" variant="outline">
                      + Catat Shift Note
                    </Button>
                  </DialogTrigger>
                  <DialogContent class="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Catat Shift Note Baru</DialogTitle>
                      <DialogDescription>Catatan serah-terima antar staf lapangan — mock, bukan sistem shift roster sungguhan.</DialogDescription>
                    </DialogHeader>
                    <div class="space-y-4 py-2">
                      <div class="space-y-1.5">
                        <Label for="shift-period">Shift</Label>
                        <select id="shift-period" v-model="shiftNoteShift" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                          <option value="pagi">
                            Pagi
                          </option>
                          <option value="siang">
                            Siang
                          </option>
                          <option value="malam">
                            Malam
                          </option>
                        </select>
                      </div>
                      <div class="space-y-1.5">
                        <Label for="shift-note">Catatan</Label>
                        <textarea id="shift-note" v-model="shiftNoteText" rows="3" class="w-full px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring" placeholder="mis. Seluruh peserta sudah check-in, tidak ada kendala." />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" @click="isShiftNoteDialogOpen = false">
                        Batal
                      </Button>
                      <Button :disabled="!shiftNoteText.trim()" @click="submitShiftNote">
                        Simpan
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </template>
              <ul v-if="shiftNotes.length" class="divide-y divide-border">
                <li v-for="note in shiftNotes" :key="note.id" class="py-3">
                  <div class="flex items-center gap-2">
                    <StatusBadge :label="note.shift === 'pagi' ? 'Pagi' : note.shift === 'siang' ? 'Siang' : 'Malam'" tone="info" />
                    <span class="text-xs text-muted-foreground">{{ getUserById(note.authorId)?.name ?? note.authorId }} · {{ formatDate(note.createdAt) }}</span>
                  </div>
                  <p class="text-sm text-foreground mt-1">
                    {{ note.note }}
                  </p>
                </li>
              </ul>
              <EmptyState v-else title="Belum ada shift note tercatat" />
            </SectionCard>
          </div>
        </TabsContent>

        <TabsContent v-if="project.isGroupTrip" value="bookings">
          <div class="space-y-6">
            <div class="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <StatsCard title="Linked Leads" :value="String(linkedLeads.length)" :icon="Users" />
              <StatsCard title="Awaiting DP" :value="String(awaitingDpRows.length)" :icon="Users" icon-color="warning" />
              <StatsCard title="Confirmed Bookings" :value="String(confirmedBookingRows.length)" :icon="CheckCircle2" icon-color="primary" />
              <StatsCard title="Confirmed Participants" :value="String(confirmedParticipants.length)" :icon="CheckCircle2" icon-color="success" />
              <StatsCard title="Available Seats" :value="String(getProjectSeatsAvailable(project.id))" :icon="Users" />
            </div>

            <SectionCard title="Awaiting DP" description="Lead sudah Qualified, quota sudah ditahan — belum ada Participant sampai DP dikonfirmasi." :accent="awaitingDpRows.length > 0" tone="warning">
              <Table v-if="awaitingDpRows.length">
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Pax</TableHead>
                    <TableHead>Harga</TableHead>
                    <TableHead>Tanggal Booking</TableHead>
                    <TableHead class="text-right">
                      Aksi
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow v-for="row in awaitingDpRows" :key="row.order.id">
                    <TableCell class="text-sm font-medium text-foreground">
                      {{ row.party?.name ?? '—' }}
                    </TableCell>
                    <TableCell class="text-sm text-muted-foreground">
                      {{ row.order.travelerCount }}
                    </TableCell>
                    <TableCell class="text-sm text-foreground">
                      {{ formatCurrencyIdr(row.order.priceIdr) }}
                    </TableCell>
                    <TableCell class="text-sm text-muted-foreground">
                      {{ formatDate(row.order.createdAt) }}
                    </TableCell>
                    <TableCell class="text-right">
                      <Button size="sm" @click="confirmDp(row.order.id)">
                        Konfirmasi DP
                      </Button>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
              <EmptyState v-else title="Belum ada booking Awaiting DP" />
            </SectionCard>

            <SectionCard title="Confirmed Bookings">
              <Table v-if="confirmedBookingRows.length">
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Pax</TableHead>
                    <TableHead>Harga</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow v-for="row in confirmedBookingRows" :key="row.order.id">
                    <TableCell class="text-sm font-medium text-foreground">
                      {{ row.party?.name ?? '—' }}
                    </TableCell>
                    <TableCell class="text-sm text-muted-foreground">
                      {{ row.order.travelerCount }}
                    </TableCell>
                    <TableCell class="text-sm text-foreground">
                      {{ formatCurrencyIdr(row.order.priceIdr) }}
                    </TableCell>
                    <TableCell>
                      <StatusBadge :label="row.statusOption.label" :tone="row.statusOption.tone" />
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
              <EmptyState v-else title="Belum ada Confirmed Booking" />
            </SectionCard>

            <SectionCard title="Waitlist" description="Lead yang minta pax lebih banyak dari seat tersisa saat qualification.">
              <ul v-if="waitlistLeads.length" class="divide-y divide-border">
                <li v-for="lead in waitlistLeads" :key="lead.id" class="py-2.5 flex items-center justify-between gap-3">
                  <NuxtLink :to="`/crm/leads/${lead.id}`" class="text-sm font-medium text-foreground hover:underline">
                    {{ lead.name }}
                  </NuxtLink>
                  <span class="text-xs text-muted-foreground">
                    {{ (lead.b2cAdultCount ?? 0) + (lead.b2cChildCount ?? 0) + (lead.b2cInfantCount ?? 0) }} pax diminta
                  </span>
                </li>
              </ul>
              <EmptyState v-else title="Tidak ada Lead di Waitlist" />
            </SectionCard>
          </div>
        </TabsContent>

        <TabsContent v-if="project.isGroupTrip" value="reservations">
          <SectionCard title="Reservations" description="Booking flight/hotel/transport/dll untuk trip ini.">
            <ul v-if="groupTripReservations.length" class="divide-y divide-border">
              <li v-for="reservation in groupTripReservations" :key="`${reservation.bookingType}-${reservation.bookingId}`" class="py-3 flex items-center justify-between gap-3">
                <div class="min-w-0">
                  <p class="text-sm font-medium text-foreground truncate">
                    {{ reservation.label }}
                  </p>
                  <p class="text-xs text-muted-foreground">
                    {{ reservation.category }}<template v-if="reservation.reference"> · <span class="font-ticket-mono">{{ reservation.reference }}</span></template>
                  </p>
                </div>
                <span class="text-xs text-muted-foreground shrink-0">{{ reservation.clientVisibleStatus }}</span>
              </li>
            </ul>
            <EmptyState v-else title="Belum ada reservation tercatat" />
          </SectionCard>
        </TabsContent>

        <TabsContent v-if="project.isGroupTrip" value="payments">
          <SectionCard title="Payments" description="Riwayat pembayaran dari seluruh invoice project ini.">
            <div v-if="invoices.some(invoice => paymentsForInvoice(invoice.id).length)" class="space-y-4">
              <template v-for="invoice in invoices" :key="invoice.id">
                <div v-if="paymentsForInvoice(invoice.id).length">
                  <p class="text-xs font-medium text-muted-foreground mb-2">
                    {{ invoice.label }}
                  </p>
                  <ul class="divide-y divide-border">
                    <li v-for="payment in paymentsForInvoice(invoice.id)" :key="payment.id" class="py-2 flex items-center justify-between gap-3">
                      <span class="text-sm text-foreground">{{ formatCurrencyIdr(payment.amountIdr) }}<span v-if="payment.method" class="text-xs text-muted-foreground"> ({{ payment.method }})</span></span>
                      <span class="text-xs text-muted-foreground">{{ formatDate(payment.receivedAt) }}</span>
                    </li>
                  </ul>
                </div>
              </template>
            </div>
            <EmptyState v-else title="Belum ada payment tercatat" />
          </SectionCard>
        </TabsContent>

        <TabsContent value="travelers">
          <div class="space-y-6">
            <SectionCard
              title="Travelers"
              :description="`${travelers.length} dari ${formatTravelerCount(project.travelerCount)} tercatat detail profilnya`"
            >
              <template #actions>
                <div class="flex items-center gap-2">
                  <NuxtLink :to="`/project-orders/${project.id}/manifest-preview`" target="_blank">
                    <Button size="sm" variant="outline">
                      <Printer class="h-4 w-4 mr-1.5" />Manifest / Export Preview
                    </Button>
                  </NuxtLink>
                  <template v-if="canManageTravelers">
                    <Button size="sm" variant="outline" @click="openImportPreview">
                      <Upload class="h-4 w-4 mr-1.5" />Import (Mock)
                    </Button>
                    <Dialog v-model:open="isTravelerDialogOpen">
                      <DialogTrigger as-child>
                        <Button size="sm" @click="openCreateTraveler">
                          <UserPlus class="h-4 w-4 mr-1.5" />Tambah Traveler
                        </Button>
                      </DialogTrigger>
                      <DialogScrollContent class="max-w-lg">
                        <DialogHeader>
                          <DialogTitle>{{ editingTravelerId ? 'Edit Traveler' : 'Tambah Traveler Baru' }}</DialogTitle>
                          <DialogDescription>Profil traveler untuk project {{ project.name }}.</DialogDescription>
                        </DialogHeader>
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
                          <div class="space-y-1.5 sm:col-span-2">
                            <Label for="traveler-name">Nama</Label>
                            <Input id="traveler-name" v-model="formName" placeholder="Nama lengkap traveler" />
                          </div>
                          <div class="space-y-1.5">
                            <div class="flex items-center justify-between">
                              <Label for="traveler-group">Group (opsional)</Label>
                              <button type="button" class="text-xs text-primary hover:underline" @click="isCreateGroupOpen = true">
                                + Group Baru
                              </button>
                            </div>
                            <select
                              id="traveler-group"
                              v-model="formGroupId"
                              class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer"
                            >
                              <option value="">
                                Tanpa Group
                              </option>
                              <option v-for="group in groups" :key="group.id" :value="group.id">
                                {{ group.name }}
                              </option>
                            </select>
                          </div>
                          <div class="space-y-1.5">
                            <Label for="traveler-companion">Mendampingi Traveler Lain (opsional)</Label>
                            <select
                              id="traveler-companion"
                              v-model="formCompanionOfTravelerId"
                              class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer"
                            >
                              <option value="">
                                Bukan companion
                              </option>
                              <option v-for="candidate in companionOptions" :key="candidate.id" :value="candidate.id">
                                {{ candidate.name }}
                              </option>
                            </select>
                          </div>
                          <div class="space-y-1.5">
                            <Label for="traveler-passport-number">Nomor Paspor (opsional)</Label>
                            <Input id="traveler-passport-number" v-model="formPassportNumber" placeholder="mis. B1234567" />
                          </div>
                          <div class="space-y-1.5">
                            <Label for="traveler-passport-expiry">Tanggal Kedaluwarsa Paspor (opsional)</Label>
                            <Input id="traveler-passport-expiry" v-model="formPassportExpiryDate" type="date" />
                          </div>
                          <div class="space-y-1.5">
                            <Label for="traveler-id-number">Nomor ID/KTP (opsional)</Label>
                            <Input id="traveler-id-number" v-model="formIdNumber" placeholder="mis. 3271xxxxxxxxxxxx" />
                          </div>
                          <div class="space-y-1.5">
                            <Label for="traveler-visa-number">Nomor Visa (opsional)</Label>
                            <Input id="traveler-visa-number" v-model="formVisaNumber" placeholder="mis. V9876543" />
                          </div>
                          <div class="space-y-1.5">
                            <Label for="traveler-visa-expiry">Tanggal Kedaluwarsa Visa (opsional)</Label>
                            <Input id="traveler-visa-expiry" v-model="formVisaExpiryDate" type="date" />
                          </div>
                          <div class="space-y-1.5">
                            <Label for="traveler-emergency-name">Nama Kontak Darurat (opsional)</Label>
                            <Input id="traveler-emergency-name" v-model="formEmergencyContactName" placeholder="Nama kontak darurat" />
                          </div>
                          <div class="space-y-1.5">
                            <Label for="traveler-emergency-phone">Telepon Kontak Darurat (opsional)</Label>
                            <Input id="traveler-emergency-phone" v-model="formEmergencyContactPhone" placeholder="08xx-xxxx-xxxx" />
                          </div>
                          <div class="space-y-1.5">
                            <Label for="traveler-dietary">Dietary Restriction (opsional)</Label>
                            <Input id="traveler-dietary" v-model="formDietaryRestrictions" placeholder="mis. Vegetarian, tanpa seafood" />
                          </div>
                          <div class="space-y-1.5">
                            <Label for="traveler-accessibility">Accessibility Needs (opsional)</Label>
                            <Input id="traveler-accessibility" v-model="formAccessibilityNeeds" placeholder="mis. Kursi roda, pendamping naik tangga" />
                          </div>
                          <div class="space-y-1.5 sm:col-span-2">
                            <Label for="traveler-special-request">Special Request Lainnya (opsional)</Label>
                            <Input id="traveler-special-request" v-model="formSpecialRequest" placeholder="mis. Kamar berdekatan dengan rekan tim" />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" @click="isTravelerDialogOpen = false">
                            Batal
                          </Button>
                          <Button :disabled="!formName.trim()" @click="submitTraveler">
                            Simpan
                          </Button>
                        </DialogFooter>
                      </DialogScrollContent>
                    </Dialog>
                  </template>
                </div>
              </template>

              <!-- Readiness indicator (Section 11 baru) -->
              <div v-if="travelerReadiness && travelerReadiness.total > 0" class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <div class="rounded-lg border border-border p-3">
                  <p class="text-xs text-muted-foreground">
                    Dokumen Lengkap
                  </p>
                  <p class="text-lg font-semibold text-foreground">
                    {{ travelerReadiness.documentsCompleteCount }}/{{ travelerReadiness.total }}
                  </p>
                </div>
                <div class="rounded-lg border border-border p-3">
                  <p class="text-xs text-muted-foreground">
                    Terverifikasi
                  </p>
                  <p class="text-lg font-semibold text-foreground">
                    {{ travelerReadiness.verifiedCount }}/{{ travelerReadiness.total }}
                  </p>
                </div>
                <div class="rounded-lg border border-border p-3">
                  <p class="text-xs text-muted-foreground">
                    Rooming Ditugaskan
                  </p>
                  <p class="text-lg font-semibold text-foreground">
                    {{ travelerReadiness.roomingAssignedCount }}/{{ travelerReadiness.total }}
                  </p>
                </div>
                <div class="rounded-lg border border-border p-3">
                  <p class="text-xs text-muted-foreground">
                    Readiness
                  </p>
                  <p class="text-lg font-semibold text-foreground">
                    {{ travelerReadiness.readinessPercent }}%
                  </p>
                </div>
              </div>

              <div v-if="groups.length" class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                <div v-for="group in groups" :key="group.id" class="p-4 rounded-lg border border-border">
                  <p class="text-sm font-medium text-foreground">
                    {{ group.name }}
                  </p>
                  <p class="text-xs text-muted-foreground">
                    {{ formatTravelerCount(group.paxCount) }}
                  </p>
                  <p v-if="group.roomingNote" class="text-xs text-muted-foreground mt-1">
                    {{ group.roomingNote }}
                  </p>
                </div>
              </div>

              <div v-if="roomAssignments.length" class="mb-4">
                <p class="text-xs font-medium text-muted-foreground mb-2">
                  Rooming List (Contoh Penugasan Kamar)
                </p>
                <ul class="space-y-1">
                  <li v-for="room in roomAssignments" :key="room.id" class="text-sm text-foreground">
                    {{ room.roomLabel }}
                    <StatusBadge :label="findStatusOption(ROOM_TYPES, room.roomType).label" :tone="findStatusOption(ROOM_TYPES, room.roomType).tone" />
                    — <span class="text-muted-foreground">{{ room.travelerIds.map(id => travelerNameById(id)).join(', ') }}</span>
                  </li>
                </ul>
              </div>

              <div v-if="travelers.length" class="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
                <div class="relative flex-1 max-w-sm">
                  <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input v-model="travelerSearch" placeholder="Cari nama traveler..." class="pl-9" />
                </div>
                <select
                  v-model="travelerGroupFilter"
                  class="appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer"
                >
                  <option value="all">
                    Semua Group
                  </option>
                  <option value="ungrouped">
                    Tanpa Group
                  </option>
                  <option v-for="group in groups" :key="group.id" :value="group.id">
                    {{ group.name }}
                  </option>
                </select>
                <label class="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                  <Checkbox v-model="missingDocsOnly" />
                  Hanya dokumen belum lengkap
                </label>
              </div>

              <Table v-if="travelers.length">
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama</TableHead>
                    <TableHead>Group</TableHead>
                    <TableHead>Dokumen (Paspor / ID / Visa)</TableHead>
                    <TableHead>Kontak Darurat</TableHead>
                    <TableHead>Catatan</TableHead>
                    <TableHead>Status Dokumen</TableHead>
                    <TableHead>Verifikasi</TableHead>
                    <TableHead v-if="canManageTravelers">
                      Aksi
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow v-for="traveler in filteredTravelers" :key="traveler.id">
                    <TableCell class="font-medium text-foreground">
                      {{ traveler.name }}
                      <p v-if="companionSummary(traveler)" class="text-xs font-normal text-muted-foreground">
                        {{ companionSummary(traveler) }}
                      </p>
                    </TableCell>
                    <TableCell class="text-muted-foreground">
                      {{ groupNameById(traveler.groupId) }}
                    </TableCell>
                    <TableCell class="font-ticket-mono text-muted-foreground text-xs">
                      <p>Paspor: {{ passportSummary(traveler) }}</p>
                      <p>ID: {{ idNumberSummary(traveler) }}</p>
                      <p>Visa: {{ visaSummary(traveler) }}</p>
                    </TableCell>
                    <TableCell class="text-muted-foreground">
                      <template v-if="traveler.emergencyContactName">
                        {{ traveler.emergencyContactName }}<template v-if="traveler.emergencyContactPhone">
                          · {{ traveler.emergencyContactPhone }}
                        </template>
                      </template>
                      <template v-else>
                        —
                      </template>
                    </TableCell>
                    <TableCell class="text-muted-foreground text-xs">
                      <p v-if="traveler.dietaryRestrictions">
                        Dietary: {{ traveler.dietaryRestrictions }}
                      </p>
                      <p v-if="traveler.accessibilityNeeds">
                        Accessibility: {{ traveler.accessibilityNeeds }}
                      </p>
                      <p v-if="traveler.specialRequest">
                        Lainnya: {{ traveler.specialRequest }}
                      </p>
                      <p v-if="!traveler.dietaryRestrictions && !traveler.accessibilityNeeds && !traveler.specialRequest">
                        —
                      </p>
                    </TableCell>
                    <TableCell>
                      <StatusBadge v-if="travelerDocumentMissing(traveler)" label="Dokumen Belum Lengkap" tone="destructive" />
                      <StatusBadge v-else label="Dokumen Lengkap" tone="success" />
                    </TableCell>
                    <TableCell>
                      <button
                        v-if="canManageTravelers"
                        type="button"
                        class="inline-flex"
                        @click="toggleVerification(traveler)"
                      >
                        <StatusBadge v-if="traveler.documentsVerifiedAt" label="Terverifikasi" tone="success" />
                        <StatusBadge v-else label="Belum Diverifikasi" tone="neutral" />
                      </button>
                      <template v-else>
                        <StatusBadge v-if="traveler.documentsVerifiedAt" label="Terverifikasi" tone="success" />
                        <StatusBadge v-else label="Belum Diverifikasi" tone="neutral" />
                      </template>
                    </TableCell>
                    <TableCell v-if="canManageTravelers">
                      <div class="flex items-center gap-1">
                        <Button size="icon" variant="ghost" @click="openEditTraveler(traveler)">
                          <Pencil class="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" @click="travelerToDelete = traveler">
                          <Trash2 class="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  <TableEmpty v-if="travelers.length > 0 && filteredTravelers.length === 0" :colspan="canManageTravelers ? 8 : 7">
                    Tidak ada traveler yang cocok dengan filter saat ini.
                  </TableEmpty>
                </TableBody>
              </Table>

              <EmptyState v-if="travelers.length === 0" :icon="Users" title="Belum ada traveler tercatat" description="Tambahkan traveler secara manual atau gunakan Import (Mock) untuk mensimulasikan hasil import." />
              <p v-if="!canManageTravelers && travelers.length > 0" class="mt-3 text-xs text-muted-foreground">
                Nomor dokumen (paspor/ID/visa) ditampilkan tersamar untuk role ini — hanya Project Manager dan Super Admin yang melihat nomor penuh.
              </p>
            </SectionCard>
          </div>

          <Dialog :open="!!travelerToDelete" @update:open="value => { if (!value) travelerToDelete = null }">
            <DialogContent class="max-w-md">
              <DialogHeader>
                <DialogTitle>Hapus Traveler</DialogTitle>
                <DialogDescription>
                  Traveler "{{ travelerToDelete?.name }}" akan dihapus dari daftar project ini. Tindakan ini tidak dapat dibatalkan.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" @click="travelerToDelete = null">
                  Batal
                </Button>
                <Button variant="destructive" @click="executeDeleteTraveler">
                  Hapus
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <!-- Traveler Group baru — dipicu tombol "+ Group Baru" di dialog Tambah/Edit Traveler. -->
          <Dialog v-model:open="isCreateGroupOpen">
            <DialogContent class="max-w-sm">
              <DialogHeader>
                <DialogTitle>Group Baru</DialogTitle>
              </DialogHeader>
              <div class="space-y-1.5 py-2">
                <Label for="new-group-name">Nama Group</Label>
                <Input id="new-group-name" v-model="newGroupName" placeholder="mis. Group Management" />
              </div>
              <DialogFooter>
                <Button variant="outline" @click="isCreateGroupOpen = false">
                  Batal
                </Button>
                <Button :disabled="!newGroupName.trim()" @click="submitCreateGroup">
                  Simpan
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <!-- Bulk import preview + error report mock (Section 11 baru) -->
          <Dialog v-model:open="isImportPreviewOpen">
            <DialogScrollContent class="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Import Traveler (Mock) — Preview</DialogTitle>
                <DialogDescription>Simulasi hasil parsing file (bukan file sungguhan) — tinjau baris di bawah sebelum mengimpor. Baris dengan error akan dilewati.</DialogDescription>
              </DialogHeader>
              <div class="py-2">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nama</TableHead>
                      <TableHead>Nomor Paspor</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow v-for="(row, index) in importPreviewRows" :key="index">
                      <TableCell :class="row.name.trim() ? 'text-foreground' : 'text-muted-foreground italic'">
                        {{ row.name.trim() || '(kosong)' }}
                      </TableCell>
                      <TableCell class="text-muted-foreground">
                        {{ row.passportNumber ?? '—' }}
                      </TableCell>
                      <TableCell>
                        <StatusBadge v-if="row.errors.length === 0" label="Valid" tone="success" />
                        <div v-else class="space-y-0.5">
                          <StatusBadge label="Error" tone="destructive" />
                          <p v-for="(error, errIndex) in row.errors" :key="errIndex" class="text-xs text-destructive">
                            {{ error }}
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
                <p class="mt-3 text-sm text-muted-foreground">
                  {{ importValidCount }} baris valid, {{ importErrorCount }} baris error (error report — baris ini tidak akan diimpor).
                </p>
                <p v-if="importCommitted" class="mt-2 text-sm font-medium text-foreground">
                  {{ importCommittedCount }} traveler berhasil diimpor — lengkapi data dokumennya secara manual.
                </p>
              </div>
              <DialogFooter>
                <Button variant="outline" @click="isImportPreviewOpen = false">
                  {{ importCommitted ? 'Tutup' : 'Batal' }}
                </Button>
                <Button v-if="!importCommitted" :disabled="importValidCount === 0" @click="confirmImport">
                  Import Baris Valid ({{ importValidCount }})
                </Button>
              </DialogFooter>
            </DialogScrollContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="vendors">
          <SectionCard title="Vendors" description="Vendor yang ditugaskan dan perbandingan quotation untuk tiap layanan project ini.">
            <div v-if="services.length" class="space-y-4">
              <div v-for="service in services" :key="service.id" class="p-4 rounded-lg border border-border">
                <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div class="min-w-0">
                    <p class="text-sm font-medium text-foreground">
                      {{ service.label }}
                    </p>
                    <div class="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                      <StatusBadge :label="findStatusOption(SERVICE_TYPES, service.type).label" :tone="findStatusOption(SERVICE_TYPES, service.type).tone" />
                      <span>·</span>
                      <span>Vendor:</span>
                      <NuxtLink v-if="service.vendorId" :to="`/vendors/${service.vendorId}`" class="text-primary hover:underline">
                        {{ getVendorById(service.vendorId)?.name }}
                      </NuxtLink>
                      <span v-else>Belum ditugaskan</span>
                    </div>
                  </div>
                  <div class="flex items-center gap-2 shrink-0">
                    <StatusBadge v-if="isVendorAlreadyPaid(service)" label="Vendor Sudah Dibayar" tone="success" />
                    <Button v-else-if="service.vendorId && canManageServiceType(service.type)" size="sm" variant="outline" @click="openRecordVendorPayment(service)">
                      Catat Sudah Dibayar
                    </Button>
                    <StatusBadge
                      :label="findStatusOption(SERVICE_STATUSES, service.status).label"
                      :tone="findStatusOption(SERVICE_STATUSES, service.status).tone"
                    />
                  </div>
                </div>

                <template v-if="quotationsForService(service.id).length">
                  <p class="text-xs font-medium text-muted-foreground mb-2">
                    Perbandingan Quotation
                  </p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Vendor</TableHead>
                        <TableHead>Nilai</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead v-if="canManageServiceType(service.type)">
                          Aksi
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow v-for="quotation in quotationsForService(service.id)" :key="quotation.id">
                        <TableCell class="text-foreground">
                          {{ getVendorById(quotation.vendorId)?.name ?? quotation.vendorId }}
                        </TableCell>
                        <TableCell>{{ formatCurrencyIdr(quotation.amountIdr) }}</TableCell>
                        <TableCell>
                          <StatusBadge
                            :label="findStatusOption(VENDOR_QUOTATION_STATUSES, quotation.status).label"
                            :tone="findStatusOption(VENDOR_QUOTATION_STATUSES, quotation.status).tone"
                          />
                        </TableCell>
                        <TableCell v-if="canManageServiceType(service.type)">
                          <div v-if="quotation.status === 'submitted'" class="flex items-center gap-1">
                            <Button size="sm" variant="outline" @click="handleAcceptQuotation(quotation.id)">
                              Terima
                            </Button>
                            <Button size="sm" variant="ghost" @click="handleRejectQuotation(quotation.id)">
                              Tolak
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </template>
                <p v-else class="text-xs text-muted-foreground">
                  Belum ada quotation untuk layanan ini.
                </p>
              </div>
            </div>
            <EmptyState v-else :icon="Truck" title="Belum ada layanan tercatat untuk project ini" />
          </SectionCard>

          <Dialog v-model:open="isVendorPaymentDialogOpen">
            <DialogContent class="max-w-md">
              <DialogHeader>
                <DialogTitle>Catat Sudah Dibayar ke Vendor</DialogTitle>
                <DialogDescription>
                  Untuk layanan "{{ vendorPaymentService?.label }}" — {{ vendorPaymentService?.vendorId ? getVendorById(vendorPaymentService.vendorId)?.name : '' }}. Langsung tercatat lunas dan masuk Actual Cost, tanpa lewat pengajuan invoice mandiri vendor.
                </DialogDescription>
              </DialogHeader>
              <div class="space-y-4 py-2">
                <div class="space-y-1.5">
                  <Label for="vendor-payment-amount">Nominal Dibayar (Rp)</Label>
                  <CurrencyInput id="vendor-payment-amount" v-model="vendorPaymentAmountIdr" placeholder="mis. 8500000" />
                </div>
                <div class="space-y-1.5">
                  <Label for="vendor-payment-note">Catatan (opsional)</Label>
                  <Input id="vendor-payment-note" v-model="vendorPaymentNote" placeholder="mis. Dibayar transfer langsung oleh Ops" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" @click="isVendorPaymentDialogOpen = false">
                  Batal
                </Button>
                <Button :disabled="!vendorPaymentAmountIdr" @click="submitVendorPayment">
                  Simpan
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="finance">
          <div class="space-y-6">
            <template v-if="canViewFinancials">
              <SectionCard title="Finance">
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                  <StatsCard title="Budget" :value="formatCurrencyIdr(project.budgetIdr)" :icon="Wallet" />
                  <StatsCard title="Actual Cost" :value="formatCurrencyIdr(actualCostIdr)" :icon="Wallet" :icon-color="actualCostIdr > project.budgetIdr ? 'destructive' : 'success'" />
                  <StatsCard title="Variance" :value="formatCurrencyIdr(varianceIdr)" :icon="Wallet" :icon-color="varianceIdr >= 0 ? 'success' : 'destructive'" />
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <StatsCard title="Nilai Quotation" :value="formatCurrencyIdr(project.quotationAmountIdr)" :icon="Wallet" icon-color="primary" />
                  <StatsCard title="Committed Vendor Cost" :value="formatCurrencyIdr(committedVendorCostIdr)" :icon="Wallet" icon-color="warning" />
                  <StatsCard v-if="canViewMargin" title="Margin" :value="formatCurrencyIdr(marginIdr)" :icon="Wallet" :icon-color="marginIdr >= 0 ? 'success' : 'destructive'" />
                </div>
              </SectionCard>

              <SectionCard title="Pengeluaran Project" description="Pengeluaran ad-hoc (transport, konsumsi, perlengkapan, dll) yang langsung tercatat dan ikut Actual Cost — tanpa approval berlapis.">
                <template v-if="canManageFinance" #actions>
                  <Button size="sm" variant="outline" @click="openCreateExpense">
                    + Catat Pengeluaran
                  </Button>
                </template>
                <Table v-if="projectExpenses.length">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tanggal</TableHead>
                      <TableHead>Kategori</TableHead>
                      <TableHead>Keterangan</TableHead>
                      <TableHead>Nominal</TableHead>
                      <TableHead>Dicatat Oleh</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow v-for="expense in projectExpenses" :key="expense.id">
                      <TableCell class="text-muted-foreground">
                        {{ formatDate(expense.incurredAt) }}
                      </TableCell>
                      <TableCell><StatusBadge :label="findStatusOption(PROJECT_EXPENSE_CATEGORIES, expense.category).label" :tone="findStatusOption(PROJECT_EXPENSE_CATEGORIES, expense.category).tone" /></TableCell>
                      <TableCell class="text-foreground">
                        <span class="font-ticket-mono text-xs text-muted-foreground mr-1.5">{{ expense.id }}</span>{{ expense.description }}
                      </TableCell>
                      <TableCell class="text-foreground font-medium">
                        {{ formatCurrencyIdr(expense.amountIdr) }}
                      </TableCell>
                      <TableCell class="text-muted-foreground">
                        {{ getUserById(expense.recordedBy)?.name ?? expense.recordedBy }}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
                <EmptyState v-else :icon="Wallet" title="Belum ada pengeluaran project tercatat" />
              </SectionCard>

              <SectionCard title="Invoice" :description="`Outstanding: ${formatCurrencyIdr(projectOutstandingIdr)}`" :accent="projectOutstandingIdr > 0" tone="warning">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice</TableHead>
                      <TableHead>Tipe</TableHead>
                      <TableHead>Jumlah</TableHead>
                      <TableHead>Jatuh Tempo</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Aging</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow v-for="invoice in invoices" :key="invoice.id">
                      <TableCell class="text-foreground">
                        {{ invoice.label }}
                      </TableCell>
                      <TableCell>
                        <div class="flex flex-col gap-1">
                          <StatusBadge :label="findStatusOption(INVOICE_TYPES, invoice.invoiceType).label" :tone="findStatusOption(INVOICE_TYPES, invoice.invoiceType).tone" />
                          <span v-if="invoice.currency !== 'IDR'" class="text-xs text-muted-foreground">{{ invoice.currency }}</span>
                        </div>
                      </TableCell>
                      <TableCell>{{ formatCurrencyIdr(invoice.amountIdr) }}</TableCell>
                      <TableCell class="text-muted-foreground">
                        {{ formatDate(invoice.dueAt) }}
                      </TableCell>
                      <TableCell>
                        <StatusBadge
                          :label="findStatusOption(INVOICE_STATUSES, invoice.status).label"
                          :tone="findStatusOption(INVOICE_STATUSES, invoice.status).tone"
                        />
                      </TableCell>
                      <TableCell :class="isInvoiceOverdue(invoice) ? 'text-destructive' : 'text-muted-foreground'">
                        {{ invoiceAgingLabel(invoice) }}
                      </TableCell>
                    </TableRow>
                    <TableEmpty v-if="invoices.length === 0" :colspan="6">
                      Belum ada invoice.
                    </TableEmpty>
                  </TableBody>
                </Table>
                <p class="text-xs text-muted-foreground mt-3">
                  Kelola pembuatan invoice, payment, void, dan Credit Note lengkap dari <NuxtLink to="/finance/invoices" class="text-primary hover:underline">
                    Finance &gt; Invoices
                  </NuxtLink>.
                </p>
              </SectionCard>

              <SectionCard title="Riwayat Pembayaran">
                <div v-if="invoices.some(invoice => paymentsForInvoice(invoice.id).length)" class="space-y-4">
                  <template v-for="invoice in invoices" :key="invoice.id">
                    <div v-if="paymentsForInvoice(invoice.id).length">
                      <p class="text-xs font-medium text-muted-foreground mb-2">
                        {{ invoice.label }}
                      </p>
                      <ul class="divide-y divide-border">
                        <li v-for="payment in paymentsForInvoice(invoice.id)" :key="payment.id" class="py-2 flex items-center justify-between gap-3">
                          <span class="text-sm text-foreground">{{ formatCurrencyIdr(payment.amountIdr) }}<span v-if="payment.method" class="text-xs text-muted-foreground"> ({{ payment.method }})</span></span>
                          <span class="text-xs text-muted-foreground">{{ formatDate(payment.receivedAt) }}</span>
                        </li>
                      </ul>
                    </div>
                  </template>
                </div>
                <EmptyState v-else title="Belum ada payment tercatat" />
              </SectionCard>

              <SectionCard title="Credit / Debit Notes" description="Kelola dari Finance &gt; Credit/Debit Notes.">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p class="text-xs font-medium text-muted-foreground mb-2">
                      Credit Notes
                    </p>
                    <ul v-if="projectCreditNotes.length" class="divide-y divide-border">
                      <li v-for="note in projectCreditNotes" :key="note.id" class="py-2">
                        <div class="flex items-center justify-between gap-2">
                          <span class="text-sm text-foreground"><span class="font-ticket-mono font-medium">{{ note.id }}</span> — {{ formatCurrencyIdr(note.amountIdr) }}</span>
                          <StatusBadge :label="findStatusOption(CREDIT_NOTE_STATUSES, note.status).label" :tone="findStatusOption(CREDIT_NOTE_STATUSES, note.status).tone" />
                        </div>
                        <p class="text-xs text-muted-foreground mt-0.5">
                          {{ note.reason }}
                        </p>
                      </li>
                    </ul>
                    <p v-else class="text-xs text-muted-foreground">
                      Belum ada Credit Note.
                    </p>
                  </div>
                  <div>
                    <p class="text-xs font-medium text-muted-foreground mb-2">
                      Debit Notes
                    </p>
                    <ul v-if="projectDebitNotes.length" class="divide-y divide-border">
                      <li v-for="note in projectDebitNotes" :key="note.id" class="py-2">
                        <div class="flex items-center justify-between gap-2">
                          <span class="text-sm text-foreground"><span class="font-ticket-mono font-medium">{{ note.id }}</span> — {{ formatCurrencyIdr(note.amountIdr) }}</span>
                          <StatusBadge :label="findStatusOption(DEBIT_NOTE_STATUSES, note.status).label" :tone="findStatusOption(DEBIT_NOTE_STATUSES, note.status).tone" />
                        </div>
                        <p class="text-xs text-muted-foreground mt-0.5">
                          {{ note.reason }}
                        </p>
                      </li>
                    </ul>
                    <p v-else class="text-xs text-muted-foreground">
                      Belum ada Debit Note.
                    </p>
                  </div>
                </div>
              </SectionCard>

              <SectionCard title="AP Summary (Supplier Invoice)" description="Reconciliation lengkap di Finance &gt; Reconciliation.">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Supplier Invoice</TableHead>
                      <TableHead>Vendor</TableHead>
                      <TableHead>Jumlah</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Match Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow v-for="supplierInvoice in projectSupplierInvoices" :key="supplierInvoice.id">
                      <TableCell class="font-ticket-mono text-foreground">
                        {{ supplierInvoice.id }}
                      </TableCell>
                      <TableCell class="text-muted-foreground">
                        {{ getVendorById(supplierInvoice.vendorId)?.name ?? supplierInvoice.vendorId }}
                      </TableCell>
                      <TableCell>{{ formatCurrencyIdr(supplierInvoice.amountIdr) }}</TableCell>
                      <TableCell><StatusBadge :label="findStatusOption(SUPPLIER_INVOICE_STATUSES, supplierInvoice.status).label" :tone="findStatusOption(SUPPLIER_INVOICE_STATUSES, supplierInvoice.status).tone" /></TableCell>
                      <TableCell>
                        <StatusBadge v-if="supplierInvoice.matchStatus" :label="findStatusOption(SUPPLIER_INVOICE_MATCH_STATUSES, supplierInvoice.matchStatus).label" :tone="findStatusOption(SUPPLIER_INVOICE_MATCH_STATUSES, supplierInvoice.matchStatus).tone" />
                        <span v-else class="text-xs text-muted-foreground">Belum ditriase</span>
                      </TableCell>
                    </TableRow>
                    <TableEmpty v-if="projectSupplierInvoices.length === 0" :colspan="5">
                      Belum ada Supplier Invoice untuk project ini.
                    </TableEmpty>
                  </TableBody>
                </Table>
              </SectionCard>

              <SectionCard title="Jurnal" description="Entri jurnal project ini — diturunkan langsung dari invoice, payment, supplier invoice, credit note, dan opex di atas. Reuse tabel yang sama dengan Finance &gt; Buku Besar.">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tanggal</TableHead>
                      <TableHead>Keterangan</TableHead>
                      <TableHead>Akun</TableHead>
                      <TableHead class="text-right">
                        Debit
                      </TableHead>
                      <TableHead class="text-right">
                        Kredit
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <template v-for="entry in projectJournalEntries" :key="entry.id">
                      <TableRow v-for="(line, index) in entry.lines" :key="`${entry.id}-${index}`">
                        <TableCell class="text-sm text-muted-foreground">
                          {{ index === 0 ? formatDate(entry.date) : '' }}
                        </TableCell>
                        <TableCell class="text-sm text-foreground">
                          {{ index === 0 ? entry.description : '' }}
                        </TableCell>
                        <TableCell class="text-sm">
                          <span class="font-ticket-mono text-muted-foreground">{{ line.accountCode }}</span>
                          <span class="text-foreground ml-1.5">{{ getLedgerAccount(line.accountCode)?.name }}</span>
                        </TableCell>
                        <TableCell class="text-right text-sm" :class="line.debitIdr ? 'text-foreground' : 'text-muted-foreground'">
                          {{ line.debitIdr ? formatCurrencyIdr(line.debitIdr) : '—' }}
                        </TableCell>
                        <TableCell class="text-right text-sm" :class="line.creditIdr ? 'text-foreground' : 'text-muted-foreground'">
                          {{ line.creditIdr ? formatCurrencyIdr(line.creditIdr) : '—' }}
                        </TableCell>
                      </TableRow>
                    </template>
                    <TableEmpty v-if="projectJournalEntries.length === 0" :colspan="5">
                      Belum ada entri jurnal untuk project ini.
                    </TableEmpty>
                  </TableBody>
                </Table>
                <p class="text-xs text-muted-foreground mt-3">
                  Lihat seluruh jurnal company (lintas project) di <NuxtLink to="/finance/ledger" class="text-primary hover:underline">
                    Finance &gt; Buku Besar
                  </NuxtLink>.
                </p>
              </SectionCard>

              <SectionCard title="Close Finance" description="Financial closure gate — mengisi Closure Checklist &quot;Finance diselesaikan&quot;.">
                <template v-if="isFinanceAlreadySettled">
                  <p class="text-sm text-success flex items-center gap-1.5">
                    <CheckCircle2 class="h-4 w-4" />Finance project ini sudah ditutup.
                  </p>
                </template>
                <template v-else>
                  <template v-if="financeClosureGate.ready">
                    <p class="text-sm text-success mb-3 flex items-center gap-1.5">
                      <CheckCircle2 class="h-4 w-4" />Tidak ada blocker — siap Close Finance.
                    </p>
                  </template>
                  <template v-else>
                    <p class="text-sm text-muted-foreground mb-2">
                      Blocker yang harus diselesaikan sebelum Close Finance:
                    </p>
                    <ul class="list-disc list-inside text-sm text-destructive mb-3">
                      <li v-for="(blocker, index) in financeClosureGate.blockers" :key="index">
                        {{ blocker }}
                      </li>
                    </ul>
                  </template>
                  <Button v-if="canManageFinance" size="sm" :disabled="!financeClosureGate.ready" @click="submitCloseFinance">
                    Close Finance
                  </Button>
                </template>
              </SectionCard>
            </template>

            <template v-else>
              <SectionCard title="Finance">
                <p class="text-xs text-muted-foreground mb-4">
                  Ringkasan terbatas — detail Budget, Actual Cost, Committed Vendor Cost, dan Margin hanya terlihat oleh role dengan akses modul Finance.
                </p>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <StatsCard title="Nilai Quotation" :value="formatCurrencyIdr(project.quotationAmountIdr)" :icon="Wallet" icon-color="primary" />
                  <StatsCard title="Outstanding" :value="formatCurrencyIdr(projectOutstandingIdr)" :icon="Wallet" icon-color="warning" />
                </div>
              </SectionCard>
            </template>
          </div>

          <Dialog v-model:open="isExpenseDialogOpen">
            <DialogContent class="max-w-md">
              <DialogHeader>
                <DialogTitle>Catat Pengeluaran</DialogTitle>
                <DialogDescription>Langsung tercatat dan ikut Actual Cost project — tanpa alur approval.</DialogDescription>
              </DialogHeader>
              <div class="space-y-4 py-2">
                <div class="space-y-1.5">
                  <Label for="expense-category">Kategori</Label>
                  <select id="expense-category" v-model="expenseCategory" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                    <option value="" disabled>
                      Pilih kategori
                    </option>
                    <option v-for="option in PROJECT_EXPENSE_CATEGORIES" :key="option.value" :value="option.value">
                      {{ option.label }}
                    </option>
                  </select>
                </div>
                <div class="space-y-1.5">
                  <Label for="expense-description">Keterangan</Label>
                  <Input id="expense-description" v-model="expenseDescription" placeholder="mis. Taksi bandara ke hotel untuk rombongan" />
                </div>
                <div class="grid grid-cols-2 gap-3">
                  <div class="space-y-1.5">
                    <Label for="expense-amount">Nominal (Rp)</Label>
                    <CurrencyInput id="expense-amount" v-model="expenseAmountIdr" placeholder="mis. 500000" />
                  </div>
                  <div class="space-y-1.5">
                    <Label for="expense-date">Tanggal</Label>
                    <Input id="expense-date" v-model="expenseIncurredAt" type="date" />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" @click="isExpenseDialogOpen = false">
                  Batal
                </Button>
                <Button :disabled="!expenseCategory || !expenseDescription.trim() || !expenseAmountIdr || !expenseIncurredAt" @click="submitExpense">
                  Simpan
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="tasks">
          <SectionCard title="Tasks &amp; Milestones">
            <template v-if="canManageProjectOrder" #actions>
              <Button size="sm" variant="outline" @click="openCreateTask">
                + Tambah Task
              </Button>
            </template>
            <ul class="divide-y divide-border">
              <li v-for="task in tasks" :key="task.id" class="py-3">
                <div class="flex items-center justify-between gap-3">
                  <div class="min-w-0 flex items-center gap-2">
                    <span v-if="task.isMilestone" class="shrink-0 text-[10px] font-semibold uppercase tracking-wide rounded-full bg-primary/10 text-primary px-2 py-0.5">Milestone</span>
                    <span class="text-sm text-foreground truncate">{{ task.title }}</span>
                    <StatusBadge v-if="task.isBlocked" label="Blocked" tone="destructive" />
                  </div>
                  <div class="flex items-center gap-2 shrink-0">
                    <template v-if="canManageProjectOrder">
                      <Button v-if="task.isBlocked" size="sm" variant="ghost" @click="unblockTask(task)">
                        Buka Blokir
                      </Button>
                      <Button v-else size="sm" variant="ghost" @click="openBlockDialog(task)">
                        Blokir
                      </Button>
                    </template>
                    <select
                      :value="task.status"
                      :disabled="!canManageProjectOrder"
                      class="appearance-none px-2 py-1 text-xs rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer disabled:cursor-not-allowed"
                      @change="handleTaskStatusChange(task.id, $event)"
                    >
                      <option v-for="status in TASK_STATUSES" :key="status.value" :value="status.value">
                        {{ status.label }}
                      </option>
                    </select>
                  </div>
                </div>
                <p class="text-xs text-muted-foreground mt-1">
                  <template v-if="task.dueAt">
                    Due {{ formatDate(task.dueAt) }}<template v-if="task.assignedTo || task.dependsOnTaskId">
                      ·
                    </template>
                  </template>
                  <template v-if="task.assignedTo">
                    {{ getUserById(task.assignedTo)?.name ?? task.assignedTo }}<template v-if="task.dependsOnTaskId">
                      ·
                    </template>
                  </template>
                  <template v-if="task.dependsOnTaskId">
                    Depends on: {{ taskTitleById(task.dependsOnTaskId) ?? task.dependsOnTaskId }}
                  </template>
                </p>
                <p v-if="task.isBlocked" class="text-xs text-destructive mt-1">
                  Blocked: {{ task.blockedReason }}
                </p>
              </li>
            </ul>
            <EmptyState v-if="tasks.length === 0" title="Belum ada task tercatat" />
          </SectionCard>

          <Dialog v-model:open="isBlockDialogOpen">
            <DialogContent class="max-w-md">
              <DialogHeader>
                <DialogTitle>Blokir Task</DialogTitle>
                <DialogDescription>"{{ blockingTask?.title }}" akan ditandai diblokir sampai dibuka kembali secara manual.</DialogDescription>
              </DialogHeader>
              <div class="space-y-1.5 py-2">
                <Label for="block-reason">Alasan</Label>
                <Input id="block-reason" v-model="blockReason" placeholder="mis. Menunggu konfirmasi vendor" />
              </div>
              <DialogFooter>
                <Button variant="outline" @click="isBlockDialogOpen = false">
                  Batal
                </Button>
                <Button variant="destructive" :disabled="!blockReason.trim()" @click="submitBlockTask">
                  Blokir
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog v-model:open="isTaskDialogOpen">
            <DialogContent class="max-w-md">
              <DialogHeader>
                <DialogTitle>Tambah Task</DialogTitle>
              </DialogHeader>
              <div class="space-y-4 py-2">
                <div class="space-y-1.5">
                  <Label for="task-title">Judul</Label><Input id="task-title" v-model="taskTitle" />
                </div>
                <div class="space-y-1.5">
                  <Label for="task-due">Jatuh Tempo</Label><Input id="task-due" v-model="taskDueAt" type="date" />
                </div>
                <div class="space-y-1.5">
                  <Label for="task-assignee">Assignee</Label>
                  <select id="task-assignee" v-model="taskAssignedTo" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                    <option value="">
                      Tidak ditugaskan
                    </option>
                    <option v-if="owner" :value="owner.id">
                      {{ owner.name }}
                    </option>
                    <option v-for="member in team" :key="member.id" :value="member.id">
                      {{ member.name }}
                    </option>
                  </select>
                </div>
                <div class="space-y-1.5">
                  <Label for="task-depends">Depends On</Label>
                  <select id="task-depends" v-model="taskDependsOn" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                    <option value="">
                      Tidak ada
                    </option>
                    <option v-for="t in tasks" :key="t.id" :value="t.id">
                      {{ t.title }}
                    </option>
                  </select>
                </div>
                <label class="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                  <Checkbox v-model="taskIsMilestone" />
                  Tandai sebagai Milestone
                </label>
              </div>
              <DialogFooter>
                <Button variant="outline" @click="isTaskDialogOpen = false">
                  Batal
                </Button>
                <Button :disabled="!taskTitle.trim()" @click="submitTask">
                  Simpan
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="documents">
          <SectionCard title="Documents" description="Category/version/expiry/access level (Section 21, D-078) — menggabungkan dokumen lama (legacy, tanpa category) dengan dokumen baru. Kelola dokumen lintas-project di modul Documents & Communication.">
            <template #actions>
              <NuxtLink to="/documents">
                <Button size="sm" variant="outline">
                  Buka Documents & Communication
                </Button>
              </NuxtLink>
            </template>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Document</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Access Level</TableHead>
                  <TableHead>Expiry</TableHead>
                  <TableHead>Source</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="document in unifiedDocuments" :key="document.id">
                  <TableCell class="font-medium text-foreground max-w-[240px] truncate">
                    {{ document.name }}
                  </TableCell>
                  <TableCell class="text-muted-foreground">
                    {{ document.category }}
                  </TableCell>
                  <TableCell class="font-ticket-mono text-muted-foreground">
                    v{{ document.version }}
                  </TableCell>
                  <TableCell><StatusBadge :label="findStatusOption(DOCUMENT_ACCESS_LEVELS, document.accessLevel).label" :tone="findStatusOption(DOCUMENT_ACCESS_LEVELS, document.accessLevel).tone" /></TableCell>
                  <TableCell>
                    <template v-if="document.expiresAt">
                      <StatusBadge
                        :label="isDocumentExpired(document.expiresAt) ? `Expired ${formatDate(document.expiresAt)}` : isDocumentExpiringSoon(document.expiresAt) ? `Segera: ${formatDate(document.expiresAt)}` : formatDate(document.expiresAt)"
                        :tone="isDocumentExpired(document.expiresAt) ? 'destructive' : isDocumentExpiringSoon(document.expiresAt) ? 'warning' : 'neutral'"
                      />
                    </template>
                    <span v-else class="text-xs text-muted-foreground">Tidak ada</span>
                  </TableCell>
                  <TableCell>
                    <NuxtLink v-if="document.sourceType === 'generated' && document.previewRoute" :to="document.previewRoute" target="_blank" class="text-xs text-primary hover:underline">
                      Preview
                    </NuxtLink>
                    <span v-else class="text-xs text-muted-foreground">{{ document.category === 'Legacy' ? 'Legacy' : 'Uploaded' }}</span>
                  </TableCell>
                </TableRow>
                <TableEmpty v-if="unifiedDocuments.length === 0" :colspan="6">
                  Belum ada dokumen diunggah
                </TableEmpty>
              </TableBody>
            </Table>
          </SectionCard>
        </TabsContent>

        <TabsContent value="activity-changes">
          <SectionCard title="Activity & Changes">
            <template v-if="canLogChange" #actions>
              <Dialog v-model:open="isChangeDialogOpen">
                <DialogTrigger as-child>
                  <Button size="sm" variant="outline">
                    Catat Perubahan
                  </Button>
                </DialogTrigger>
                <DialogContent class="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Catat Perubahan Baru</DialogTitle>
                    <DialogDescription>Change akan tercatat berstatus "Menunggu Approval" — mock, bukan approval sungguhan.</DialogDescription>
                  </DialogHeader>
                  <div class="space-y-4 py-2">
                    <div class="space-y-1.5">
                      <Label for="change-category">Kategori Dampak</Label>
                      <select
                        id="change-category"
                        v-model="changeCategory"
                        class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer"
                      >
                        <option v-for="category in CHANGE_CATEGORIES" :key="category.value" :value="category.value">
                          {{ category.label }}
                        </option>
                      </select>
                    </div>
                    <div class="space-y-1.5">
                      <Label for="change-reason">Alasan / Deskripsi Perubahan</Label>
                      <Input id="change-reason" v-model="changeReason" placeholder="mis. Permintaan upgrade kamar dari klien" />
                    </div>
                    <div class="grid grid-cols-2 gap-3">
                      <div class="space-y-1.5">
                        <Label for="change-before">Sebelum (opsional)</Label>
                        <Input id="change-before" v-model="changeBefore" placeholder="mis. Deluxe" />
                      </div>
                      <div class="space-y-1.5">
                        <Label for="change-after">Sesudah (opsional)</Label>
                        <Input id="change-after" v-model="changeAfter" placeholder="mis. Suite" />
                      </div>
                    </div>
                    <div class="space-y-1.5">
                      <Label for="change-impact">Dampak (opsional)</Label>
                      <Input id="change-impact" v-model="changeImpact" placeholder="mis. Actual cost meningkat ~Rp10.000.000" />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" @click="isChangeDialogOpen = false">
                      Batal
                    </Button>
                    <Button :disabled="!changeReason.trim()" @click="submitChangeEntry">
                      Simpan
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </template>

            <div class="flex items-center gap-2 mb-4">
              <button
                :class="['px-3 py-1.5 text-xs rounded-lg border', !changesOnly ? 'border-primary/40 bg-primary/5 text-primary' : 'border-border text-muted-foreground']"
                @click="changesOnly = false"
              >
                All
              </button>
              <button
                :class="['px-3 py-1.5 text-xs rounded-lg border', changesOnly ? 'border-primary/40 bg-primary/5 text-primary' : 'border-border text-muted-foreground']"
                @click="changesOnly = true"
              >
                Changes only
              </button>
            </div>
            <ul class="divide-y divide-border">
              <li
                v-for="entry in visibleActivities"
                :key="entry.id"
                :class="['py-3 flex items-start justify-between gap-3', entry.isChange ? 'border-l-2 pl-3 -ml-3' : '', entry.approvalStatus === 'pending' ? 'border-warning' : entry.approvalStatus === 'approved' ? 'border-success' : entry.approvalStatus === 'rejected' ? 'border-destructive' : entry.isChange ? 'border-border' : '']"
              >
                <div class="min-w-0">
                  <div v-if="entry.category || entry.approvalStatus" class="flex items-center gap-1.5 flex-wrap mb-1">
                    <StatusBadge v-if="entry.category" :label="findStatusOption(CHANGE_CATEGORIES, entry.category).label" :tone="findStatusOption(CHANGE_CATEGORIES, entry.category).tone" />
                    <StatusBadge v-if="entry.approvalStatus" :label="findStatusOption(CHANGE_APPROVAL_STATUSES, entry.approvalStatus).label" :tone="findStatusOption(CHANGE_APPROVAL_STATUSES, entry.approvalStatus).tone" />
                  </div>
                  <p class="text-sm text-foreground">
                    {{ entry.message }}
                  </p>
                  <p v-if="entry.beforeValue || entry.afterValue" class="text-xs text-muted-foreground mt-0.5">
                    <template v-if="entry.beforeValue">
                      Sebelum: {{ entry.beforeValue }}
                    </template><template v-if="entry.beforeValue && entry.afterValue">
                      →
                    </template><template v-if="entry.afterValue">
                      Sesudah: {{ entry.afterValue }}
                    </template>
                  </p>
                  <p v-if="entry.requestedBy" class="text-xs text-muted-foreground">
                    Diajukan oleh: {{ getUserById(entry.requestedBy)?.name ?? entry.requestedBy }}
                  </p>
                  <p v-if="entry.impactNote" class="text-xs text-muted-foreground">
                    Dampak: {{ entry.impactNote }}
                  </p>
                  <p class="text-xs text-muted-foreground mt-0.5">
                    {{ formatDate(entry.createdAt) }}
                  </p>
                </div>
                <div class="flex flex-col items-end gap-1.5 shrink-0">
                  <StatusBadge v-if="entry.isChange && !entry.approvalStatus" :label="entry.reviewed ? 'Change (Reviewed)' : 'Change (Belum Direview)'" :tone="entry.reviewed ? 'info' : 'warning'" />
                  <AttentionIndicator v-if="entry.approvalStatus === 'pending'" severity="medium" label="Menunggu Approval" />
                  <div v-if="entry.approvalStatus === 'pending' && canApproveChanges" class="flex items-center gap-1">
                    <Button size="sm" variant="outline" @click="handleApproveChange(entry.id)">
                      Setujui
                    </Button>
                    <Button size="sm" variant="ghost" @click="handleRejectChange(entry.id)">
                      Tolak
                    </Button>
                  </div>
                </div>
              </li>
            </ul>
            <EmptyState v-if="visibleActivities.length === 0" title="Belum ada aktivitas tercatat" />
          </SectionCard>

          <SectionCard title="Communication" description="Internal notes, client messages, dan supplier messages untuk project ini (Section 21, D-078). Delivery status Email/WhatsApp simulasi mock — tanpa klaim integrasi nyata.">
            <template #actions>
              <Dialog v-model:open="isMessageDialogOpen">
                <DialogTrigger as-child>
                  <Button size="sm" variant="outline">
                    Kirim Pesan
                  </Button>
                </DialogTrigger>
                <DialogContent class="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Kirim Pesan Baru</DialogTitle>
                    <DialogDescription>Internal note hanya terlihat internal — client/supplier message akan tampil pada Client/Supplier Portal terkait.</DialogDescription>
                  </DialogHeader>
                  <div class="space-y-4 py-2">
                    <div class="space-y-1.5">
                      <Label for="msg-channel-project">Channel</Label>
                      <select id="msg-channel-project" v-model="messageChannel" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                        <option v-for="option in MESSAGE_CHANNELS" :key="option.value" :value="option.value">
                          {{ option.label }}
                        </option>
                      </select>
                    </div>
                    <div class="space-y-1.5">
                      <Label for="msg-body-project">Pesan</Label>
                      <textarea id="msg-body-project" v-model="messageBody" rows="3" class="w-full px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" @click="isMessageDialogOpen = false">
                      Batal
                    </Button>
                    <Button :disabled="!messageBody.trim()" @click="submitMessage">
                      Kirim
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </template>
            <ul v-if="projectMessages.length" class="divide-y divide-border">
              <li v-for="message in projectMessages" :key="message.id" class="py-3">
                <div class="flex items-center gap-1.5 mb-1">
                  <StatusBadge :label="findStatusOption(MESSAGE_CHANNELS, message.channel).label" :tone="findStatusOption(MESSAGE_CHANNELS, message.channel).tone" />
                  <StatusBadge :label="findStatusOption(MESSAGE_DELIVERY_STATUSES, message.deliveryStatus).label" :tone="findStatusOption(MESSAGE_DELIVERY_STATUSES, message.deliveryStatus).tone" />
                  <span class="text-xs text-muted-foreground">{{ getUserById(message.senderId)?.name ?? message.senderId }} · {{ formatDate(message.sentAt) }}</span>
                </div>
                <p class="text-sm text-foreground">
                  {{ message.body }}
                </p>
              </li>
            </ul>
            <EmptyState v-else title="Belum ada pesan tercatat" />
          </SectionCard>

          <SectionCard title="Unified Activity Timeline (Internal View)" description="Menggabungkan Activity/Change, System Event, Document (upload/generate), dan Message satu entity secara kronologis (Section 21, D-078). Tampilan internal-view — versi client/supplier-safe memfilter entri internalOnly.">
            <ul v-if="unifiedTimeline.length" class="divide-y divide-border">
              <li v-for="entry in unifiedTimeline" :key="`${entry.kind}-${entry.id}`" class="py-2.5 flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <div class="flex items-center gap-1.5 mb-0.5">
                    <StatusBadge :label="entry.label" :tone="entry.internalOnly ? 'neutral' : 'info'" />
                    <span v-if="entry.internalOnly" class="text-[10px] uppercase tracking-wide text-muted-foreground">Internal Only</span>
                  </div>
                  <p class="text-sm text-foreground truncate max-w-[560px]">
                    {{ entry.detail }}
                  </p>
                </div>
                <span class="text-xs text-muted-foreground shrink-0">{{ formatDate(entry.at) }}</span>
              </li>
            </ul>
            <EmptyState v-else title="Belum ada entri timeline" />
          </SectionCard>

          <SectionCard title="Change Requests" description="Change Request terstruktur (before/after, dampak, approval) — Section 19, D-076. Lihat modul Changes & Incidents untuk daftar lengkap lintas project.">
            <template #actions>
              <NuxtLink to="/changes">
                <Button size="sm" variant="outline">
                  Buka Changes & Incidents
                </Button>
              </NuxtLink>
            </template>
            <ul v-if="projectChangeRequests.length" class="divide-y divide-border">
              <li v-for="item in projectChangeRequests" :key="item.id" class="py-3">
                <NuxtLink :to="`/changes/${item.id}`" class="flex items-center justify-between gap-3 group">
                  <div class="min-w-0">
                    <div class="flex items-center gap-1.5 mb-1">
                      <StatusBadge :label="findStatusOption(CHANGE_REQUEST_SOURCES, item.source).label" :tone="findStatusOption(CHANGE_REQUEST_SOURCES, item.source).tone" />
                      <span class="font-ticket-mono text-sm font-medium text-foreground group-hover:underline">{{ item.id }}</span>
                    </div>
                    <p class="text-xs text-muted-foreground truncate">
                      {{ item.beforeSummary }} → {{ item.afterSummary }}
                    </p>
                  </div>
                  <StatusBadge :label="findStatusOption(CHANGE_REQUEST_STATUSES, item.status).label" :tone="findStatusOption(CHANGE_REQUEST_STATUSES, item.status).tone" />
                </NuxtLink>
              </li>
            </ul>
            <EmptyState v-else title="Belum ada Change Request terstruktur" />
          </SectionCard>

          <SectionCard title="Cancellations" description="Penalty-tracking seragam lintas Flight/Hotel/Transport/MICE — dibuat otomatis saat booking dibatalkan.">
            <ul v-if="projectCancellations.length" class="divide-y divide-border">
              <li v-for="item in projectCancellations" :key="item.id" class="py-3">
                <NuxtLink :to="`/changes/cancellations/${item.id}`" class="flex items-center justify-between gap-3 group">
                  <div class="min-w-0">
                    <p class="font-ticket-mono text-sm font-medium text-foreground group-hover:underline">
                      {{ item.id }} — {{ item.bookingType }} {{ item.bookingId }}
                    </p>
                    <p class="text-xs text-muted-foreground truncate">
                      {{ item.reason }}
                    </p>
                  </div>
                  <div class="text-right shrink-0">
                    <p class="text-xs text-muted-foreground">
                      {{ item.penaltyIdr !== undefined ? formatCurrencyIdr(item.penaltyIdr) : 'Tidak ada penalty' }}
                    </p>
                    <StatusBadge :label="item.refundEligible ? 'Refund Eligible' : 'Tidak Eligible'" :tone="item.refundEligible ? 'success' : 'neutral'" />
                  </div>
                </NuxtLink>
              </li>
            </ul>
            <EmptyState v-else title="Belum ada Cancellation tercatat" />
          </SectionCard>

          <SectionCard title="Refund Requests">
            <ul v-if="projectRefunds.length" class="divide-y divide-border">
              <li v-for="item in projectRefunds" :key="item.id" class="py-3">
                <NuxtLink :to="`/changes/refunds/${item.id}`" class="flex items-center justify-between gap-3 group">
                  <div class="min-w-0">
                    <p class="font-ticket-mono text-sm font-medium text-foreground group-hover:underline">
                      {{ item.id }} ({{ item.type === 'full' ? 'Full' : 'Partial' }})
                    </p>
                    <p class="text-xs text-muted-foreground">
                      {{ formatCurrencyIdr(item.amountIdr) }} · Credit: {{ findStatusOption(REFUND_CREDIT_STATUSES, item.creditStatus).label }}
                    </p>
                  </div>
                  <StatusBadge :label="findStatusOption(REFUND_REQUEST_STATUSES, item.status).label" :tone="findStatusOption(REFUND_REQUEST_STATUSES, item.status).tone" />
                </NuxtLink>
              </li>
            </ul>
            <EmptyState v-else title="Belum ada Refund Request" />
          </SectionCard>

          <SectionCard title="Incidents">
            <ul v-if="projectIncidents.length" class="divide-y divide-border">
              <li v-for="item in projectIncidents" :key="item.id" class="py-3">
                <NuxtLink :to="`/changes/incidents/${item.id}`" class="flex items-center justify-between gap-3 group">
                  <div class="min-w-0">
                    <div class="flex items-center gap-1.5 mb-1">
                      <StatusBadge :label="findStatusOption(INCIDENT_SEVERITIES, item.severity).label" :tone="findStatusOption(INCIDENT_SEVERITIES, item.severity).tone" />
                      <span class="text-sm font-medium text-foreground group-hover:underline">{{ item.title }}</span>
                    </div>
                    <p class="text-xs text-muted-foreground">
                      {{ item.bookingId ? `${item.bookingType} ${item.bookingId}` : 'Project-level' }}
                    </p>
                  </div>
                  <StatusBadge :label="findStatusOption(INCIDENT_STATUSES, item.status).label" :tone="findStatusOption(INCIDENT_STATUSES, item.status).tone" />
                </NuxtLink>
              </li>
            </ul>
            <EmptyState v-else title="Belum ada Incident tercatat" />
          </SectionCard>
        </TabsContent>
      </Tabs>
    </template>
  </div>
</template>
