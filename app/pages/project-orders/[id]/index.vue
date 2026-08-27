<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { FileX, Wallet, Users, Truck, Search, UserPlus, Upload, Pencil, Trash2, Printer, AlertTriangle, Plus, CheckCircle2, MapPin, CalendarRange, CreditCard, FileText, PieChart, Eye, EyeOff, LayoutGrid, List, Download, MessageSquare, FileClock, Settings2, ImagePlus, Plane, Hotel, Bus, PartyPopper, Package } from 'lucide-vue-next'
import {
  getProjectById, getPartyById, getContactsByParty, getUserById, getVendorById, getLeadById, getQuotationByLead,
  getFlightBookingsByService, getHotelBookingsByService, getTransportBookingsByService, getMiceEventsByService,
  getProjectServices, getItineraryItems, updateServiceStatus, updateItineraryItem, createItineraryItem, removeItineraryItem,
  getQuotationsForService, acceptVendorQuotation, rejectVendorQuotation, recordVendorPaymentDirect,
  getServiceOrderByService, getSupplierInvoicesByServiceOrder,
  getTravelerGroups, getTravelers, getRoomAssignments,
  createTraveler, updateTraveler, removeTraveler, createTravelerGroup,
  toggleTravelerVerification, getTravelerReadiness, previewTravelerImportMock, commitTravelerImport,
  getInvoicesByProject, getPaymentsByInvoice, getProjectOutstandingIdr, getProjectCollectedIdr, getInvoiceOutstandingIdr,
  getCreditNotesByProject, getDebitNotesByProject, getSupplierInvoicesByProject, evaluateFinanceClosureGate, closeProjectFinance,
  getTasksByProject, getActivitiesByProject,
  createChangeEntry, approveChangeEntry, rejectChangeEntry,
  addProjectTeamMember, removeProjectTeamMember,
  createProjectTask, updateProjectTask,
  toggleTaskBlocked, getServiceReadinessMatrix, getDepartureReadiness, getProjectAttentionQueue,
  getShiftNotes, createShiftNote,
  getBookingTimeline,
  getServiceOrdersByProject, getRfqsByProject,
  getChangeRequestsByProject, getCancellationRecordsByProject, getRefundRequestsByProject, getIncidentsByProject,
  getDocumentsForProject, MESSAGE_RECORDS, sendMessage, getUnifiedActivityTimeline, updateProjectPhoto,
  USERS,
  getClientReservations, getProjectSeatsFilled, getProjectSeatsAvailable, getSalesOrdersByProject, getLeadsLinkedToGroupProject,
  confirmGroupTripDp, getSalesOrderOutstandingIdr
} from '~/data'
import type { TravelerImportPreviewRow, AttentionQueueItem } from '~/data'
import type { SalesOrder } from '~/types/sales-order'
import {
  getProjectOrderStepViews, advanceProjectOrder, getProjectMilestones,
  setMilestoneActualDate, updateMilestonePlannedDate, getProjectOrderStep
} from '~/data/project-order-workflow'
import { getProjectActualCostIdr, getProjectExpenses, createProjectExpense, PROJECT_EXPENSE_CATEGORIES } from '~/data/finance-ext'
import { serviceCapabilityKey } from '~/constants/capabilities'
import {
  PROJECT_STATUSES, SERVICE_STATUSES, SERVICE_TYPES,
  INVOICE_STATUSES, INVOICE_TYPES, TASK_STATUSES, ROOM_TYPES, VENDOR_QUOTATION_STATUSES,
  CHANGE_CATEGORIES, CHANGE_APPROVAL_STATUSES, BOOKING_PAYMENT_GATE_STATUSES, SERVICE_ORDER_STATUSES, RFQ_STATUSES, findStatusOption,
  CHANGE_REQUEST_SOURCES, CHANGE_REQUEST_STATUSES, REFUND_REQUEST_STATUSES, REFUND_CREDIT_STATUSES, INCIDENT_SEVERITIES, INCIDENT_STATUSES,
  CREDIT_NOTE_STATUSES, DEBIT_NOTE_STATUSES, SUPPLIER_INVOICE_MATCH_STATUSES, SUPPLIER_INVOICE_STATUSES,
  DOCUMENT_ACCESS_LEVELS, MESSAGE_CHANNELS, MESSAGE_DELIVERY_STATUSES, SALES_ORDER_STATUSES
} from '~/constants/status'
import { formatCurrencyIdr, formatDateRange, formatDate, formatDayLabel, formatDayBadge, formatTravelerCount, maskDocumentNumber } from '~/utils/format'
import { isProjectNeedingAttention, isUpcomingDeparture, isTravelerDocumentMissing, isInvoiceOverdue, isInvoiceDueSoon, invoiceAgingDays, isDocumentExpired, isDocumentExpiringSoon, DEMO_REFERENCE_DATE, MINIMUM_DP_PERCENT, isDpBalanceOverdue } from '~/utils/attention'
import type { ProjectDetailTab, Traveler, ServiceTypeKey, ServiceStatus, ItineraryItem, ProjectService } from '~/types/project'
import type { ChangeCategory, ProjectTask, ShiftPeriod } from '~/types/activity'
import type { Invoice } from '~/types/finance'
import type { ProjectExpenseCategoryKey } from '~/types/finance-ext'
import type { MessageChannel } from '~/types/document-comms'
import type { BadgeTone } from '~/types/common'

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

/** Foto cover Group Trip B2C (`Project.photoUrl`) — mock upload lokal (data URL), tampil di header sini dan di list "Sales Order" (`/project-orders`). Project B2B tidak menampilkan uploader ini, tetap icon polos. */
const photoInputRef = ref<HTMLInputElement | null>(null)
function openPhotoPicker () { photoInputRef.value?.click() }
function handlePhotoSelected (event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file || !project.value) { return }
  const reader = new FileReader()
  reader.onload = () => {
    if (!project.value || typeof reader.result !== 'string') { return }
    updateProjectPhoto(project.value.id, reader.result)
    refreshStep()
    showToast('Foto Trip Diperbarui', 'Foto cover tersimpan (mock, bukan file storage nyata).', 'success')
  }
  reader.readAsDataURL(file)
  ;(event.target as HTMLInputElement).value = ''
}

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
 * Tab "Bookings" (Group Trip) — 5 bucket sesuai flow DP-gated (`qualifyGroupTripLead`/`confirmGroupTripDp`,
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

/** Dialog "Konfirmasi DP" — mendukung DP sebagian, lihat `confirmGroupTripDp` (`app/data/index.ts`). */
const isConfirmDpDialogOpen = ref(false)
const confirmDpOrder = ref<SalesOrder | null>(null)
const confirmDpAmountIdr = ref<number | null>(null)
const confirmDpMinimumError = ref<string>('')

function openConfirmDp (order: SalesOrder) {
  confirmDpOrder.value = order
  confirmDpAmountIdr.value = null
  confirmDpMinimumError.value = ''
  isConfirmDpDialogOpen.value = true
}

const confirmDpMinimumIdr = computed(() => (confirmDpOrder.value ? Math.ceil(confirmDpOrder.value.priceIdr * (MINIMUM_DP_PERCENT / 100)) : 0))

function submitConfirmDp () {
  const order = confirmDpOrder.value
  if (!order || !confirmDpAmountIdr.value) { return }
  const result = confirmGroupTripDp(order.id, confirmDpAmountIdr.value, currentUser.value.id)
  if (!result) { return }
  if (result.outcome === 'below-minimum') {
    confirmDpMinimumError.value = `Minimal DP ${formatCurrencyIdr(result.minimumDpIdr)} (${MINIMUM_DP_PERCENT}% dari harga) — nominal yang diinput kurang dari itu.`
    return
  }
  isConfirmDpDialogOpen.value = false
  const outstanding = getSalesOrderOutstandingIdr(order.id)
  showToast(
    'DP Dikonfirmasi',
    `${order.id} sekarang Confirmed, participant otomatis dibuat.${outstanding > 0 ? ` Sisa tagihan ${formatCurrencyIdr(outstanding)}.` : ' Lunas.'}`,
    'success'
  )
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
/** PIC (contact person) sisi client — kontak pertama yang tercatat untuk Party ini (`CONTACTS`, `app/data/parties.ts`), ditampilkan di header project untuk memudahkan koordinasi cepat lewat WhatsApp. */
const clientPic = computed(() => (party.value ? getContactsByParty(party.value.id)[0] : undefined))
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

/** Icon per tipe layanan — dipakai card ringkas "Kesiapan Layanan" (Overview) supaya tiap baris gampang dibedakan sekilas. */
const SERVICE_TYPE_ICON: Record<ServiceTypeKey, typeof Plane> = {
  flight: Plane, hotel: Hotel, transportation: Bus, mice: PartyPopper, additional: Package
}
function serviceReadinessTone (percent: number): 'success' | 'warning' | 'destructive' {
  return percent >= 80 ? 'success' : percent >= 50 ? 'warning' : 'destructive'
}
const SERVICE_READINESS_STATUS_LABEL: Record<'success' | 'warning' | 'destructive', string> = {
  success: 'Siap', warning: 'Proses', destructive: 'Perlu Perhatian'
}

/** Icon badge tint per tipe layanan (tab Vendors) — reuse tone `SERVICE_TYPES` (Flight=info/biru, Hotel=purple, dst.) supaya konsisten dengan chip yang sudah ada, bukan warna baru. */
const TONE_ICON_BG: Record<BadgeTone, string> = {
  neutral: 'bg-muted text-muted-foreground',
  primary: 'bg-primary/10 text-primary',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  destructive: 'bg-destructive/10 text-destructive',
  info: 'bg-chart-5/10 text-chart-5',
  purple: 'bg-chart-4/10 text-chart-4'
}
/**
 * Warna icon dokumen (tab Documents) — dipetakan dari `category` (bukan access level, yang di data mock
 * mayoritas "internal" sehingga kalau dipakai bikin semua baris keliatan abu-abu monoton). Kategori yang
 * belum terdaftar eksplisit dapat tone deterministik dari hash nama-nya sendiri, supaya tetap berwarna
 * (bukan fallback abu-abu) tanpa harus mendaftar tiap kategori satu-satu.
 */
const DOCUMENT_CATEGORY_TONE_MAP: Record<string, BadgeTone> = {
  legacy: 'neutral',
  finance: 'success',
  invoice: 'success',
  contract: 'primary',
  quotation: 'primary',
  'travel-document': 'info',
  'travel document': 'info',
  itinerary: 'info',
  voucher: 'warning',
  manifest: 'warning',
  report: 'purple'
}
const DOCUMENT_CATEGORY_TONE_FALLBACK: BadgeTone[] = ['primary', 'success', 'warning', 'destructive', 'info', 'purple']
function documentCategoryTone (category: string): BadgeTone {
  const key = category.trim().toLowerCase()
  if (DOCUMENT_CATEGORY_TONE_MAP[key]) { return DOCUMENT_CATEGORY_TONE_MAP[key] }
  let hash = 0
  for (let i = 0; i < key.length; i++) { hash = (hash * 31 + key.charCodeAt(i)) >>> 0 }
  return DOCUMENT_CATEGORY_TONE_FALLBACK[hash % DOCUMENT_CATEGORY_TONE_FALLBACK.length]
}

/** Aksen border-kiri per status layanan (tab Vendors) — sekilas menunjukkan kesehatan tiap baris (Confirmed=hijau, Changed=amber, Cancelled=merah) tanpa perlu baca badge teks-nya. */
const TONE_BORDER_L: Record<BadgeTone, string> = {
  neutral: 'border-l-border',
  primary: 'border-l-primary',
  success: 'border-l-success',
  warning: 'border-l-warning',
  destructive: 'border-l-destructive',
  info: 'border-l-chart-5',
  purple: 'border-l-chart-4'
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
/** Angka mentah (bukan cuma persen) untuk caption di bawah stat card "Layanan Confirmed" — dijumlahkan dari `serviceReadinessMatrix` (sumber sama dengan `departureReadiness.servicesConfirmedPercent`, tidak ada logic baru). */
const serviceConfirmedTotals = computed(() => serviceReadinessMatrix.value.reduce((sum, row) => ({ total: sum.total + row.total, confirmed: sum.confirmed + row.confirmedCount }), { total: 0, confirmed: 0 }))
const serviceReadinessOverallPercent = computed(() => serviceConfirmedTotals.value.total > 0 ? Math.round((serviceConfirmedTotals.value.confirmed / serviceConfirmedTotals.value.total) * 100) : 0)
/** Rata-rata dua metrik readiness yang punya basis persen (dokumen traveler + layanan confirmed) — dipakai bar "kesiapan keseluruhan" di card Countdown Keberangkatan, bukan angka karangan. */
const overallReadinessPercent = computed(() => departureReadiness.value ? Math.round((departureReadiness.value.travelerReadinessPercent + departureReadiness.value.servicesConfirmedPercent) / 2) : 0)

/** "Attention/exception queue" — item diklik untuk lompat ke tab terkait. */
const attentionQueue = computed(() => project.value ? getProjectAttentionQueue(project.value.id) : [])
function goToAttentionTab (tab: ProjectDetailTab) {
  activeTab.value = tab
}

/** Warna dot severity kartu "Action Required" (Overview) — sama persis tone `ATTENTION_SEVERITIES` (`~/constants/status`) dipakai `AttentionIndicator`. */
const ATTENTION_DOT_CLASS: Record<AttentionQueueItem['severity'], string> = {
  low: 'bg-chart-5', medium: 'bg-warning', high: 'bg-destructive'
}

/** "Calendar/timeline views" — toggle tampilan itinerary, data sama persis (bukan komponen calendar baru). */
const itineraryViewMode = ref<'list' | 'timeline'>('list')
/** Collapse hari yang ditampilkan (padat by default) — "Lihat Selengkapnya" membuka sisanya, data tidak dipotong permanen. */
const itineraryDaysExpanded = ref(false)
const ITINERARY_DAYS_COLLAPSED_COUNT = 3

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
  date: '',
  time: '',
  title: '',
  description: '',
  location: '',
  serviceType: '' as ServiceTypeKey | '',
  groupId: '',
  timezone: '',
  visibleToClient: true
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
/**
 * Fase 3.2 (Poros Project Order + Jurnal Finance, Penyederhanaan 7-Role/Menu) — `project.actualCostIdr`
 * adalah field statis yang tidak pernah diperbarui mutator apa pun (selalu `0` untuk project baru, lihat
 * `createProject`). Diganti selector turunan `getProjectActualCostIdr()` (Σ SupplierInvoice di luar
 * rejected + Σ Opex ber-project), sumber yang persis sama dengan jurnal — sehingga Actual Cost di sini dan
 * total akun 5100/6100 di Buku Besar tidak mungkin berbeda.
 */
const actualCostIdr = computed(() => (project.value ? getProjectActualCostIdr(project.value.id) : 0))
const marginIdr = computed(() => project.value ? project.value.quotationAmountIdr - actualCostIdr.value : 0)
/** Stat ringkas tab Overview — sumber sama persis dengan card Budget tab Finance, dibulatkan untuk tampilan angka besar. */
const budgetUsedPercent = computed(() => project.value && project.value.budgetIdr > 0 ? Math.round((actualCostIdr.value / project.value.budgetIdr) * 100) : 0)

/** Progres pendapatan terkumpul dari client (B2B & B2C, keduanya lewat Invoice+Payment) dibanding Nilai
 * Quotation — beda dari `projectOutstandingIdr` yang cuma menghitung invoice yang sudah terbit. */
const collectedIdr = computed(() => (project.value ? getProjectCollectedIdr(project.value.id) : 0))
const quotationGapIdr = computed(() => project.value ? Math.max(project.value.quotationAmountIdr - collectedIdr.value, 0) : 0)
const quotationCollectionPercent = computed(() => project.value && project.value.quotationAmountIdr > 0 ? Math.min(100, Math.round((collectedIdr.value / project.value.quotationAmountIdr) * 100)) : 0)

/** Total invoice diterbitkan (di luar void) — dipakai ProjectCommercialHero (Overview). Pola sama getClientFinanceSummary (app/data/index.ts). */
const invoiceIssuedIdr = computed(() => invoices.value.filter(invoice => invoice.status !== 'void').reduce((sum, invoice) => sum + invoice.amountIdr, 0))

/** Invoice belum lunas berikutnya (jatuh tempo terdekat) — logic identik getClientFinanceSummary, discope per-project lewat `invoices` yang sudah ada. */
const nextUnpaidInvoice = computed(() => invoices.value
  .filter(invoice => invoice.status !== 'paid' && invoice.status !== 'void' && getInvoiceOutstandingIdr(invoice.id) > 0)
  .sort((a, b) => a.dueAt.localeCompare(b.dueAt))[0])

const nextPaymentForHero = computed(() => {
  const invoice = nextUnpaidInvoice.value
  if (!invoice) { return null }
  const tone = isInvoiceOverdue(invoice) ? 'overdue' : isInvoiceDueSoon(invoice) ? 'due-soon' : 'scheduled'
  return { invoiceLabel: invoice.label, amountIdr: getInvoiceOutstandingIdr(invoice.id), dueAt: invoice.dueAt, tone }
})

/** Section 20 — Credit/Debit Note, AP summary (Supplier Invoice), dan financial closure gate untuk project ini. */
const canManageFinance = computed(() => canManage('finance'))
const projectCreditNotes = computed(() => project.value ? getCreditNotesByProject(project.value.id) : [])
const projectDebitNotes = computed(() => project.value ? getDebitNotesByProject(project.value.id) : [])
const projectSupplierInvoices = computed(() => project.value ? getSupplierInvoicesByProject(project.value.id) : [])
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
/** Stat ringkas tab Overview — 'done' adalah key status task yang sudah completed (`TASK_STATUSES`). */
const tasksDoneCount = computed(() => tasks.value.filter(task => task.status === 'done').length)
/** Section 21 (D-078) — union `Document` baru + `ProjectDocument` legacy, dipakai tab "Documents" yang diperkaya (category/version/expiry/access level). */
const unifiedDocuments = computed(() => project.value ? getDocumentsForProject(project.value.id) : [])
/** Toggle List/Grid ala Google Drive untuk tab Documents — preferensi tampilan saja, tidak memengaruhi data. */
const documentsViewMode = ref<'list' | 'grid'>('list')
function handleDownloadDocument (document: { name: string }) {
  showToast('Download (Mock)', `${document.name} — simulasi unduhan, tidak ada file nyata (D-006).`, 'info')
}
/** Section 21 (D-078) — Communication (internal notes/client messages/supplier messages) untuk project ini, agregasi lewat `projectId` (bukan hanya entityType 'project' sempit — pesan tertaut sub-entity seperti booking/incident yang punya `projectId` sama tetap relevan). */
const projectMessages = computed(() => project.value ? MESSAGE_RECORDS.filter(item => item.projectId === project.value!.id).slice().sort((a, b) => b.sentAt.localeCompare(a.sentAt)) : [])
/** Section 21 (D-078) — unified activity timeline internal-view (Wajib "Unified activity timeline dengan filtering akses"). */
const unifiedTimeline = computed(() => project.value ? getUnifiedActivityTimeline('project', project.value.id, 'internal') : [])
const activities = computed(() => project.value ? getActivitiesByProject(project.value.id) : [])

/**
 * "Riwayat Aktivitas" — history terpadu ala list history (bukan 4 card terpisah): menggabungkan
 * `activities` (activity/change, punya approve/reject) + `projectMessages` + entri `system-event`/
 * `document` dari `unifiedTimeline` (kind `activity`/`message` di sana TIDAK diambil supaya tidak
 * duplikat dengan sumber yang lebih kaya field-nya di atas), diurutkan kronologis terbaru dulu.
 */
type HistoryKind = 'change' | 'activity' | 'message' | 'system-event' | 'document'
interface HistoryItem { id: string, at: string, kind: HistoryKind, activity?: typeof activities.value[number], message?: typeof projectMessages.value[number], timelineEntry?: typeof unifiedTimeline.value[number] }

const historyFilter = ref<'all' | 'change' | 'message' | 'system'>('all')

const historyEntries = computed<HistoryItem[]>(() => {
  const items: HistoryItem[] = []
  for (const entry of activities.value) {
    items.push({ id: `activity-${entry.id}`, at: entry.createdAt, kind: entry.isChange ? 'change' : 'activity', activity: entry })
  }
  for (const message of projectMessages.value) {
    items.push({ id: `message-${message.id}`, at: message.sentAt, kind: 'message', message })
  }
  for (const entry of unifiedTimeline.value) {
    if (entry.kind === 'system-event' || entry.kind === 'document') {
      items.push({ id: `${entry.kind}-${entry.id}`, at: entry.at, kind: entry.kind, timelineEntry: entry })
    }
  }
  return items.sort((a, b) => b.at.localeCompare(a.at))
})

const visibleHistoryEntries = computed(() => {
  if (historyFilter.value === 'all') { return historyEntries.value }
  if (historyFilter.value === 'change') { return historyEntries.value.filter(item => item.kind === 'change') }
  if (historyFilter.value === 'message') { return historyEntries.value.filter(item => item.kind === 'message') }
  return historyEntries.value.filter(item => item.kind === 'system-event' || item.kind === 'document')
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

/** Baris tab Vendors — dipre-compute (bukan panggil `quotationsForService` berulang di template) supaya template bisa membedakan tampilan ringkas (1 quotation) vs tabel perbandingan (2+ quotation) tanpa memanggil selector 4x per service. */
const vendorServiceRows = computed(() => services.value.map(service => ({
  service,
  quotations: quotationsForService(service.id)
})))

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

/** Header identitas — durasi trip (hari, inklusif) untuk angka ringkas kanan-atas header, di samping Jumlah Traveler & Nilai Quotation (yang sudah field langsung). */
const tripDurationDays = computed(() => {
  if (!project.value) { return 0 }
  const start = new Date(project.value.travelStartDate).getTime()
  const end = new Date(project.value.travelEndDate).getTime()
  return Math.round((end - start) / 86400000) + 1
})
</script>

<template>
  <div class="space-y-6">
    <template v-if="!project">
      <PageHeader title="Project Tidak Ditemukan" :breadcrumb="[{ label: 'Project', to: '/project-orders' }, { label: 'Not Found' }]" />
      <SectionCard compact>
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

      <SectionCard compact>
        <div class="flex flex-wrap items-center justify-between gap-6">
          <div class="flex min-w-0 items-start gap-3">
            <template v-if="project.isGroupTrip">
              <input ref="photoInputRef" type="file" accept="image/*" class="hidden" @change="handlePhotoSelected">
              <button
                type="button"
                title="Tambah / ganti foto trip"
                class="group relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary/10 text-primary"
                @click="openPhotoPicker"
              >
                <img v-if="project.photoUrl" :src="project.photoUrl" alt="" class="h-full w-full object-cover">
                <MapPin v-else class="h-6 w-6" />
                <span class="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                  <ImagePlus class="h-5 w-5 text-white" />
                </span>
              </button>
            </template>
            <div v-else class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <MapPin class="h-5 w-5" />
            </div>
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <h1 class="truncate text-lg font-semibold text-foreground">
                  {{ project.name }}
                </h1>
                <StatusBadge :label="findStatusOption(PROJECT_STATUSES, project.status).label" :tone="findStatusOption(PROJECT_STATUSES, project.status).tone" />
                <StatusBadge v-if="needsAttention" label="Perlu Perhatian" tone="warning" />
              </div>
              <p class="mt-1 text-xs text-muted-foreground">
                {{ project.destination }} · {{ formatDateRange(project.travelStartDate, project.travelEndDate) }}
              </p>
              <p class="mt-0.5 text-xs text-muted-foreground">
                PM: <span class="font-medium text-foreground">{{ owner?.name ?? '—' }}</span> · AE: <span class="font-medium text-foreground">{{ accountExecutive?.name ?? '—' }}</span>
              </p>

              <div v-if="party" class="mt-2.5 inline-flex flex-wrap items-center gap-x-5 gap-y-1.5 rounded-lg border border-border bg-muted/30 px-3 py-2">
                <div>
                  <p class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Nama PT
                  </p>
                  <p class="text-sm font-medium text-foreground">
                    {{ party.name }}
                  </p>
                </div>
                <div v-if="clientPic">
                  <p class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    PIC
                  </p>
                  <p class="text-sm font-medium text-foreground">
                    {{ clientPic.name }}
                  </p>
                </div>
                <div v-if="clientPic?.phone">
                  <p class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    WA
                  </p>
                  <p class="text-sm font-medium text-foreground">
                    {{ clientPic.phone }}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div class="flex shrink-0 flex-wrap items-center gap-2">
            <div class="flex items-center gap-2.5 rounded-lg bg-primary/5 py-2 pl-2.5 pr-4">
              <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Users class="h-4 w-4" />
              </div>
              <div>
                <p class="text-lg font-bold leading-none text-foreground tabular-nums">
                  {{ project.travelerCount }}
                </p>
                <p class="mt-1 whitespace-nowrap text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Traveler
                </p>
              </div>
            </div>
            <div class="flex items-center gap-2.5 rounded-lg bg-success/5 py-2 pl-2.5 pr-4">
              <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-success/10 text-success">
                <FileText class="h-4 w-4" />
              </div>
              <div>
                <p class="text-lg font-bold leading-none text-foreground tabular-nums">
                  {{ formatCurrencyIdr(project.quotationAmountIdr) }}
                </p>
                <p class="mt-1 whitespace-nowrap text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Nilai Quotation
                </p>
              </div>
            </div>
            <div class="flex items-center gap-2.5 rounded-lg bg-chart-5/5 py-2 pl-2.5 pr-4">
              <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-chart-5/10 text-chart-5">
                <CalendarRange class="h-4 w-4" />
              </div>
              <div>
                <p class="text-lg font-bold leading-none text-foreground tabular-nums">
                  {{ tripDurationDays }}
                </p>
                <p class="mt-1 whitespace-nowrap text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Hari Trip
                </p>
              </div>
            </div>
          </div>
        </div>

        <div class="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
          <NuxtLink :to="`/project-orders/${project.id}/run-sheet-preview`" target="_blank">
            <Button size="sm" variant="outline">
              <Printer class="h-3.5 w-3.5 mr-1.5" />Run Sheet / Export Preview
            </Button>
          </NuxtLink>
          <NuxtLink :to="`/project-orders/${project.id}/manifest-preview`" target="_blank">
            <Button size="sm" variant="outline">
              <Users class="h-3.5 w-3.5 mr-1.5" />Manifest Preview
            </Button>
          </NuxtLink>
        </div>
      </SectionCard>

      <SectionCard compact>
        <div class="flex flex-wrap items-start justify-between gap-4">
          <ProjectOrderStepper
            class="min-w-0 flex-1"
            :steps="stepViews"
            :selected-step-key="selectedStepKey"
            @select="value => selectedStepKey = selectedStepKey === value ? undefined : value"
          />
          <Button v-if="canAdvanceStep && currentStepView" size="sm" class="shrink-0" :disabled="!currentStepView.gate.ready" @click="onAdvanceStep">
            Advance: {{ currentStepView.def.label }} →
          </Button>
        </div>

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
      </SectionCard>

      <Tabs v-model="activeTab">
        <TabsList>
          <TabsTrigger v-for="tab in TABS" :key="tab.value" :value="tab.value">
            {{ tab.label }}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div class="space-y-6">
            <SectionCard v-if="project.isGroupTrip" compact title="Kapasitas Group Trip">
              <div class="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <StatsCard title="Seat Terisi" :value="`${getProjectSeatsFilled(project.id)} / ${project.travelerCount}`" :icon="Users" />
                <StatsCard title="Destinasi" :value="project.destination" :icon="MapPin" />
                <StatsCard title="Jadwal" :value="formatDateRange(project.travelStartDate, project.travelEndDate)" :icon="CalendarRange" />
              </div>
            </SectionCard>

            <!-- Stat ringkas (padat, angka besar + label kecil) — teaser, detail lengkap tetap di card di bawahnya. -->
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <StatsCard
                title="Budget Terpakai"
                :value="`${budgetUsedPercent}%`"
                :icon="Wallet"
                :icon-color="budgetUsedPercent > 100 ? 'destructive' : 'primary'"
                :footer-progress="{ label: `${formatCurrencyIdr(actualCostIdr)} / ${formatCurrencyIdr(project.budgetIdr)}`, percent: budgetUsedPercent }"
              />
              <StatsCard title="H- Keberangkatan" :value="departureReadiness ? String(departureReadiness.daysUntilDeparture) : '—'" :icon="CalendarRange" subtitle="Hari lagi" />
              <StatsCard
                title="Task Selesai"
                :value="`${tasksDoneCount}/${tasks.length}`"
                :icon="CheckCircle2"
                :footer-progress="tasks.length > 0 ? { label: tasksDoneCount === tasks.length ? 'Semua task selesai' : `${tasksDoneCount} dari ${tasks.length} selesai`, percent: Math.round((tasksDoneCount / tasks.length) * 100) } : undefined"
              />
              <StatsCard
                title="Risk Terbuka"
                :value="String(departureReadiness?.openRisksCount ?? 0)"
                :icon="AlertTriangle"
                :icon-color="(departureReadiness?.openRisksCount ?? 0) > 0 ? 'warning' : 'success'"
                :subtitle="(departureReadiness?.openRisksCount ?? 0) > 0 ? `${departureReadiness?.openRisksCount} risk masih terbuka` : 'Tidak ada risk terbuka'"
              />
            </div>

            <!-- Ringkasan Komersial — separuh lebar (bukan edge-to-edge), ditaruh di bawah 4 stat card di atas. -->
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ProjectCommercialHero
                v-if="canViewFinancials"
                :quotation-amount-idr="project.quotationAmountIdr"
                :invoice-issued-idr="invoiceIssuedIdr"
                :paid-idr="collectedIdr"
                :outstanding-idr="projectOutstandingIdr"
                :next-payment="nextPaymentForHero"
                :has-any-invoice="invoices.length > 0"
              />
              <div v-else class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <StatsCard
                  title="Nilai Quotation"
                  :value="formatCurrencyIdr(project.quotationAmountIdr)"
                  :subtitle="`Terkumpul ${formatCurrencyIdr(collectedIdr)} dari client${quotationGapIdr > 0 ? ' · Kurang ' + formatCurrencyIdr(quotationGapIdr) : ' · Lunas'}`"
                  :progress-percent="quotationCollectionPercent"
                  :icon="FileText"
                  :icon-color="quotationGapIdr > 0 ? 'warning' : 'success'"
                />
                <StatsCard title="Outstanding" :value="formatCurrencyIdr(projectOutstandingIdr)" :icon="Wallet" icon-color="warning" />
              </div>

              <SectionCard
                v-if="attentionQueue.length > 0"
                compact
                title="Action Required"
                :description="`${attentionQueue.length} item butuh perhatian`"
                accent
                tone="destructive"
              >
                <ul class="divide-y divide-border">
                  <li v-for="(item, index) in attentionQueue.slice(0, 4)" :key="index" class="py-1.5 first:pt-0">
                    <button type="button" class="flex w-full items-start gap-2 text-left hover:text-primary" @click="goToAttentionTab(item.tab)">
                      <span class="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" :class="ATTENTION_DOT_CLASS[item.severity]" />
                      <span class="min-w-0 flex-1 truncate text-xs text-foreground">{{ item.message }}</span>
                    </button>
                  </li>
                </ul>
                <p v-if="attentionQueue.length > 4" class="mt-1 text-[11px] text-muted-foreground">
                  +{{ attentionQueue.length - 4 }} item lainnya
                </p>
                <Button size="sm" variant="outline" class="mt-3 w-full" @click="goToAttentionTab('itinerary-services')">
                  Lihat Semua
                </Button>
              </SectionCard>
              <SectionCard v-else compact title="Action Required" description="Tidak ada item yang butuh perhatian saat ini.">
                <div class="flex items-center gap-2 text-xs text-muted-foreground">
                  <CheckCircle2 class="h-4 w-4 shrink-0 text-success" />
                  Semua beres — tidak ada item mendesak.
                </div>
              </SectionCard>
            </div>

            <!-- Peta Lokasi (dipindah dari header — header sekarang identitas murni) + Kesiapan Layanan (breakdown bar, versi ringkas dari tabel "Service Readiness Matrix" tab Itinerary & Services). -->
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <SectionCard compact title="Peta Lokasi" :class="serviceReadinessMatrix.length === 0 ? 'lg:col-span-2' : ''">
                <DestinationMap :geo="project.destinationGeo" :destination-text="project.destination" show-route />
              </SectionCard>

              <SectionCard v-if="serviceReadinessMatrix.length > 0" compact title="Kesiapan Layanan" description="Agregat Confirmed/Completed per tipe layanan.">
                <template #actions>
                  <StatusBadge
                    :label="`${SERVICE_READINESS_STATUS_LABEL[serviceReadinessTone(serviceReadinessOverallPercent)]} · ${serviceConfirmedTotals.confirmed}/${serviceConfirmedTotals.total}`"
                    :tone="serviceReadinessTone(serviceReadinessOverallPercent)"
                  />
                </template>
                <div class="divide-y divide-border">
                  <div v-for="row in serviceReadinessMatrix" :key="row.type" class="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                    <div
                      class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                      :class="{
                        'bg-success/10 text-success': serviceReadinessTone(row.percent) === 'success',
                        'bg-warning/10 text-warning': serviceReadinessTone(row.percent) === 'warning',
                        'bg-destructive/10 text-destructive': serviceReadinessTone(row.percent) === 'destructive'
                      }"
                    >
                      <component :is="SERVICE_TYPE_ICON[row.type]" class="h-4 w-4" />
                    </div>
                    <div class="min-w-0 flex-1">
                      <div class="mb-1.5 flex items-center justify-between gap-2">
                        <div class="flex items-center gap-2 min-w-0">
                          <span class="text-sm font-medium text-foreground truncate">{{ findStatusOption(SERVICE_TYPES, row.type).label }}</span>
                          <StatusBadge :label="SERVICE_READINESS_STATUS_LABEL[serviceReadinessTone(row.percent)]" :tone="serviceReadinessTone(row.percent)" />
                        </div>
                        <span class="shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">{{ row.confirmedCount }}/{{ row.total }}</span>
                      </div>
                      <div class="h-2 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          class="h-full rounded-full transition-all duration-500"
                          :class="{
                            'bg-success': serviceReadinessTone(row.percent) === 'success',
                            'bg-warning': serviceReadinessTone(row.percent) === 'warning',
                            'bg-destructive': serviceReadinessTone(row.percent) === 'destructive'
                          }"
                          :style="{ width: `${row.percent}%` }"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </SectionCard>
            </div>

            <ProjectOrderTimelineTracking
              :project-id="project.id"
              :milestones="milestones"
              :can-manage="canManageOperations"
              :planned-dates-locked="plannedDatesLocked"
              @mark-actual="onMarkMilestoneActual"
              @update-planned="onUpdateMilestonePlanned"
            />

            <SectionCard compact title="Ringkasan Layanan">
              <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div>
                  <p class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-2">
                    Cakupan Layanan
                  </p>
                  <div class="flex flex-wrap gap-2">
                    <StatusBadge
                      v-for="type in SERVICE_TYPES.filter(t => project.serviceScope.includes(t.value))"
                      :key="type.value"
                      :label="type.label"
                      :tone="type.tone"
                    />
                  </div>

                  <div class="mt-4 border-t border-border pt-4">
                    <p class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-1">
                      Asal Project
                    </p>
                    <p class="text-sm text-muted-foreground">
                      Dari lead
                      <NuxtLink v-if="project.leadId" :to="`/crm/leads/${project.leadId}`" class="text-primary hover:underline">
                        {{ project.leadId }}
                      </NuxtLink><span v-else>—</span>
                      · quotation approved <span class="font-medium text-foreground">{{ sourceQuotation ? formatCurrencyIdr(sourceQuotation.amountIdr) : '—' }}</span>
                    </p>
                  </div>
                </div>

                <div class="lg:border-l lg:border-border lg:pl-6">
                  <div class="mb-2 flex items-center justify-between gap-2">
                    <p class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      Tim Project
                    </p>
                    <Sheet v-if="canManageProjectOrder" v-model:open="isTeamDialogOpen">
                      <SheetTrigger as-child>
                        <Button size="sm" variant="ghost">
                          + Tambah Anggota
                        </Button>
                      </SheetTrigger>
                      <SheetContent side="right" class="w-full sm:max-w-lg overflow-y-auto">
                        <SheetHeader>
                          <SheetTitle>Tambah Anggota Tim</SheetTitle>
                          <SheetDescription>Anggota baru akan ditambahkan ke `teamUserIds` project ini.</SheetDescription>
                        </SheetHeader>
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
                        <SheetFooter class="mt-6 flex-row justify-end gap-2">
                          <Button variant="outline" @click="isTeamDialogOpen = false">
                            Batal
                          </Button>
                          <Button :disabled="!teamMemberToAdd" @click="submitAddTeamMember">
                            Tambah
                          </Button>
                        </SheetFooter>
                      </SheetContent>
                    </Sheet>
                  </div>
                  <div class="flex flex-wrap gap-2">
                    <StatusBadge :label="`PM: ${owner?.name ?? '—'}`" tone="primary" />
                    <StatusBadge :label="`AE: ${accountExecutive?.name ?? '—'}`" tone="info" />
                    <span v-for="member in team" :key="member.id" class="inline-flex items-center gap-1 rounded-full border border-input px-2.5 py-0.5 text-xs text-foreground">
                      {{ member.name }} <span class="text-muted-foreground">({{ member.role }})</span>
                      <button v-if="canManageProjectOrder" type="button" class="ml-1 text-muted-foreground hover:text-destructive" @click="submitRemoveTeamMember(member.id)">×</button>
                    </span>
                  </div>
                </div>
              </div>
            </SectionCard>
          </div>
        </TabsContent>

        <TabsContent value="itinerary-services">
          <div class="space-y-6">
            <!-- Departure Readiness Gate (Section 12 baru) -->
            <SectionCard
              v-if="departureReadiness"
              compact
              title="Departure Readiness Gate"
              description="Ringkasan kesiapan lintas-domain sebelum keberangkatan — advisory, tidak memblokir transisi status."
              accent
              :tone="departureReadiness.isReady ? 'success' : 'warning'"
            >
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
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatsCard
                  title="Dokumen Traveler"
                  :value="`${departureReadiness.travelerReadinessPercent}%`"
                  :icon="FileText"
                  :footer-progress="travelerReadiness && travelerReadiness.total > 0 ? { label: `${travelerReadiness.documentsCompleteCount} dari ${travelerReadiness.total} dokumen lengkap`, percent: departureReadiness.travelerReadinessPercent } : undefined"
                />
                <StatsCard
                  title="Layanan Confirmed"
                  :value="`${departureReadiness.servicesConfirmedPercent}%`"
                  :icon="CheckCircle2"
                  :footer-progress="serviceConfirmedTotals.total > 0 ? { label: `${serviceConfirmedTotals.confirmed} dari ${serviceConfirmedTotals.total} layanan dikonfirmasi`, percent: departureReadiness.servicesConfirmedPercent } : undefined"
                />
                <StatsCard
                  title="Task Diblokir"
                  :value="String(departureReadiness.blockedTasksCount)"
                  :icon="AlertTriangle"
                  :icon-color="departureReadiness.blockedTasksCount > 0 ? 'warning' : 'success'"
                  :subtitle="departureReadiness.blockedTasksCount > 0 ? `${departureReadiness.blockedTasksCount} task menunggu` : 'Tidak ada task diblokir'"
                />
                <StatsCard
                  title="Risk Terbuka"
                  :value="String(departureReadiness.openRisksCount)"
                  :icon="AlertTriangle"
                  :icon-color="departureReadiness.openRisksCount > 0 ? 'warning' : 'success'"
                  :subtitle="departureReadiness.openRisksCount > 0 ? `${departureReadiness.openRisksCount} risk masih terbuka` : 'Tidak ada risk terbuka'"
                />
              </div>
            </SectionCard>

            <!-- Progress Readiness (donut) + Alasan Belum Siap (blocking reasons — dipindah dari dalam card di atas, bukan diduplikasi) + Countdown Keberangkatan. -->
            <div v-if="departureReadiness" class="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <SectionCard compact title="Progress Readiness">
                <div class="flex items-center gap-5">
                  <svg viewBox="0 0 80 80" class="h-24 w-24 shrink-0 -rotate-90">
                    <circle
                      cx="40"
                      cy="40"
                      r="34"
                      fill="none"
                      stroke="hsl(var(--muted))"
                      stroke-width="9"
                    />
                    <circle
                      cx="40"
                      cy="40"
                      r="34"
                      fill="none"
                      stroke="hsl(var(--primary))"
                      stroke-width="9"
                      stroke-linecap="round"
                      :stroke-dasharray="2 * Math.PI * 34"
                      :stroke-dashoffset="2 * Math.PI * 34 * (1 - overallReadinessPercent / 100)"
                    />
                  </svg>
                  <div class="min-w-0">
                    <p class="text-2xl font-bold text-foreground leading-none">
                      {{ overallReadinessPercent }}%
                    </p>
                    <p class="mt-1 text-xs text-muted-foreground">
                      Siap Berangkat
                    </p>
                    <div class="mt-3 flex items-center gap-1.5 text-xs">
                      <span class="h-2 w-2 rounded-full bg-primary" /><span class="text-foreground">{{ overallReadinessPercent }}% Siap</span>
                    </div>
                    <div class="mt-1 flex items-center gap-1.5 text-xs">
                      <span class="h-2 w-2 rounded-full bg-muted" /><span class="text-muted-foreground">{{ 100 - overallReadinessPercent }}% Belum Lengkap</span>
                    </div>
                  </div>
                </div>
              </SectionCard>

              <SectionCard compact title="Alasan Belum Siap">
                <ul v-if="departureReadiness.blockingReasons.length > 0" class="space-y-2">
                  <li v-for="(reason, index) in departureReadiness.blockingReasons" :key="index" class="flex items-start gap-2 text-xs text-foreground">
                    <AlertTriangle class="h-3.5 w-3.5 shrink-0 mt-0.5 text-warning" />
                    {{ reason }}
                  </li>
                </ul>
                <p v-else class="flex items-center gap-1.5 text-sm text-success">
                  <CheckCircle2 class="h-4 w-4" />Tidak ada blocker — siap berangkat.
                </p>
              </SectionCard>

              <SectionCard compact title="Countdown Keberangkatan">
                <template #actions>
                  <CalendarRange class="h-4 w-4 text-muted-foreground" />
                </template>
                <p class="text-3xl font-bold leading-none text-foreground tabular-nums">
                  {{ Math.abs(departureReadiness.daysUntilDeparture) }}<span class="ml-1 text-sm font-medium text-muted-foreground">Hari</span>
                </p>
                <p class="mt-2 text-xs text-muted-foreground">
                  Keberangkatan: {{ formatDate(project.travelStartDate) }}
                </p>
                <div class="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div class="h-full rounded-full bg-primary transition-all" :style="{ width: `${overallReadinessPercent}%` }" />
                </div>
                <p class="mt-1.5 text-xs text-muted-foreground">
                  {{ overallReadinessPercent }}% kesiapan keseluruhan
                </p>
              </SectionCard>
            </div>

            <!-- Attention / Exception Queue (Section 12 baru) — "Penanda Perubahan" digabung sebagai baris terakhir kartu yang sama (bukan kartu sibling terpisah di grid 2 kolom) supaya tingginya selalu mengikuti konten sendiri, tidak pernah menyisakan ruang kosong akibat di-stretch menyamai kartu lain. -->
            <SectionCard
              v-if="attentionQueue.length > 0 || (project.characteristic === 'high-change' && changedServicesCount > 0)"
              compact
              title="Attention / Exception Queue"
              description="Item lintas-domain yang butuh perhatian — klik untuk lompat ke tab terkait."
              accent
              tone="destructive"
            >
              <ul v-if="attentionQueue.length > 0" class="divide-y divide-border">
                <li v-for="(item, index) in attentionQueue" :key="index" class="py-2">
                  <button type="button" class="flex items-center gap-2 text-left w-full hover:text-primary" @click="goToAttentionTab(item.tab)">
                    <AlertTriangle class="h-4 w-4 shrink-0" :class="item.severity === 'high' ? 'text-destructive' : 'text-amber-500'" />
                    <span class="text-sm text-foreground">{{ item.message }}</span>
                  </button>
                </li>
              </ul>

              <div
                v-if="project.characteristic === 'high-change' && changedServicesCount > 0"
                class="flex flex-wrap items-center justify-between gap-3 pt-2.5"
                :class="attentionQueue.length > 0 ? 'mt-2.5 border-t border-border' : ''"
              >
                <p class="min-w-0 flex-1 text-xs text-foreground">
                  <span class="font-medium text-warning">High-Change Project</span> · {{ changedServicesCount }} layanan berubah setelah dikonfirmasi.
                </p>
                <Button size="sm" variant="outline" class="shrink-0" @click="goToActivityTab">
                  Lihat Activity & Changes
                </Button>
              </div>
            </SectionCard>

            <SectionCard compact title="Daily Itinerary" description="Jadwal harian perjalanan (timezone lokal ditampilkan berdampingan jam).">
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
              <div v-if="itineraryByDate.length" class="space-y-5">
                <div v-for="day in (itineraryDaysExpanded ? itineraryByDate : itineraryByDate.slice(0, ITINERARY_DAYS_COLLAPSED_COUNT))" :key="day.date" class="flex gap-3">
                  <div class="flex shrink-0 flex-col items-center">
                    <div class="flex h-11 w-11 flex-col items-center justify-center rounded-lg border border-primary/30 bg-primary/5 text-primary">
                      <span class="text-sm font-bold leading-none">{{ formatDayBadge(day.date).day }}</span>
                      <span class="text-[10px] font-medium uppercase leading-none mt-0.5">{{ formatDayBadge(day.date).month }}</span>
                    </div>
                    <div v-if="itineraryViewMode === 'timeline'" class="mt-1 w-px flex-1 bg-border" />
                  </div>
                  <div class="min-w-0 flex-1 pb-1">
                    <p class="text-xs font-medium text-muted-foreground mb-2">
                      {{ formatDayLabel(day.date) }}
                    </p>
                    <ul class="divide-y divide-border rounded-lg border border-border">
                      <li v-for="item in day.items" :key="item.id" class="p-2.5 flex items-start gap-3">
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
                        <div v-if="canManageOperations" class="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            class="inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-md border px-2.5 text-xs font-medium transition-colors"
                            :class="item.visibleToClient === false ? 'border-chart-5/30 bg-chart-5/10 text-chart-5 hover:bg-chart-5/20' : 'border-warning/30 bg-warning/10 text-warning hover:bg-warning/20'"
                            @click="toggleItineraryVisibility(item)"
                          >
                            <component :is="item.visibleToClient === false ? Eye : EyeOff" class="h-3.5 w-3.5 shrink-0" />
                            {{ item.visibleToClient === false ? 'Tampilkan ke Client' : 'Jadikan Internal' }}
                          </button>
                          <button
                            type="button"
                            class="flex h-7 w-7 items-center justify-center rounded-md border border-primary/25 bg-primary/10 text-primary transition-colors hover:bg-primary/20"
                            title="Edit"
                            @click="openEditItineraryItem(item)"
                          >
                            <Pencil class="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            class="flex h-7 w-7 items-center justify-center rounded-md border border-destructive/25 bg-destructive/10 text-destructive transition-colors hover:bg-destructive/20"
                            title="Hapus"
                            @click="pendingDeleteItineraryItem = item"
                          >
                            <Trash2 class="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </li>
                    </ul>
                  </div>
                </div>

                <div v-if="itineraryByDate.length > ITINERARY_DAYS_COLLAPSED_COUNT" class="flex justify-center">
                  <Button size="sm" variant="ghost" @click="itineraryDaysExpanded = !itineraryDaysExpanded">
                    {{ itineraryDaysExpanded ? 'Sembunyikan' : `Lihat Selengkapnya (${itineraryByDate.length - ITINERARY_DAYS_COLLAPSED_COUNT} hari lagi)` }}
                  </Button>
                </div>
              </div>
              <EmptyState v-else title="Belum ada itinerary tercatat" />
            </SectionCard>

            <!-- Daily itinerary — create/edit form (docs/superpowers/specs/2026-08-05-daily-itinerary-crud-design.md) -->
            <Sheet v-model:open="isItineraryFormOpen">
              <SheetContent side="right" class="w-full sm:max-w-lg overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>{{ editingItineraryItemId ? 'Edit Item Itinerary' : 'Tambah Item Itinerary' }}</SheetTitle>
                </SheetHeader>
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
                <SheetFooter class="mt-6 flex-row justify-end gap-2">
                  <Button variant="outline" @click="isItineraryFormOpen = false">
                    Batal
                  </Button>
                  <Button :disabled="!itineraryForm.date.trim() || !itineraryForm.title.trim()" @click="submitItineraryForm">
                    Simpan
                  </Button>
                </SheetFooter>
              </SheetContent>
            </Sheet>

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

            <!-- Card per tipe layanan — grid tersendiri (Booking Timeline TIDAK ikut di sini lagi, lihat catatan di bawah) supaya card terakhir otomatis full-width kalau dia sendirian di barisnya (posisi ganjil dari total), tidak nyisa ruang kosong di sebelahnya. Tinggi card di-stretch SAMA (default grid stretch, bukan items-start) supaya sepasang Flight/Hotel tetap imbang meski jumlah baris beda — card jadi flex column penuh tinggi (`class`+`content-class`) dan tombol "Buat Booking" ditempel ke dasar via `mt-auto`, bukan menyisakan celah kosong mengambang di tengah. -->
            <div v-if="visibleServiceTypes.length" class="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:[&>*:last-child:nth-child(odd)]:col-span-2">
              <SectionCard
                v-for="type in visibleServiceTypes"
                :key="type.value"
                compact
                class="flex h-full flex-col"
                content-class="flex flex-1 flex-col"
              >
                <template #header>
                  <div class="flex items-center gap-2.5">
                    <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full" :class="TONE_ICON_BG[type.tone]">
                      <component :is="SERVICE_TYPE_ICON[type.value]" class="h-4 w-4" />
                    </div>
                    <div class="min-w-0">
                      <p class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {{ type.label }}
                      </p>
                      <p class="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                        {{ serviceReadinessLabel(type.value) }}
                      </p>
                    </div>
                  </div>
                </template>

                <ul v-if="servicesByType(type.value).length" class="flex-1 divide-y divide-border">
                  <li v-for="service in servicesByType(type.value)" :key="service.id" class="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <div class="min-w-0 flex-1">
                      <p class="text-sm font-medium text-foreground truncate">
                        {{ service.label }}
                      </p>
                      <p class="text-xs text-muted-foreground truncate">
                        {{ service.vendorId ? getVendorById(service.vendorId)?.name : 'Vendor belum ditugaskan' }}
                        <template v-if="service.bookingReference">
                          · <span class="font-ticket-mono">{{ service.bookingReference }}</span>
                        </template>
                      </p>
                    </div>
                    <div class="flex shrink-0 items-center gap-2">
                      <StatusBadge
                        :label="findStatusOption(SERVICE_STATUSES, service.status).label"
                        :tone="findStatusOption(SERVICE_STATUSES, service.status).tone"
                      />
                      <StatusBadge v-if="service.status === 'changed'" label="Perlu Ditinjau" tone="destructive" />
                      <template v-if="canManageServiceType(type.value)">
                        <NuxtLink
                          v-if="linkedBookingRef(service)"
                          :to="linkedBookingRef(service)?.path ?? ''"
                          class="inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-primary/25 bg-primary/10 px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
                        >
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
                      </template>
                    </div>
                  </li>
                </ul>
                <EmptyState v-else class="flex-1" title="Belum ada layanan tercatat." />

                <!-- "Buat Booking" quick-create (Section 13-16) — daftar booking sendiri kini terkonsolidasi di SectionCard "Booking Timeline" (Section 18) di bawah, bukan diulang per tipe layanan di sini. mt-auto (bukan mt-4) supaya menempel ke dasar card walau card ini di-stretch lebih tinggi dari kontennya sendiri (equal-height dengan sibling Flight/Hotel). -->
                <div v-if="SERVICE_TAB_KEY[type.value] && canManageServiceType(type.value)" class="mt-auto flex justify-end border-t border-border pt-4">
                  <NuxtLink :to="`/services?projectId=${project.id}&create=1#${SERVICE_TAB_KEY[type.value]}`">
                    <Button size="sm" variant="outline">
                      <Plus class="h-4 w-4 mr-1.5" />Buat {{ type.label }} Booking
                    </Button>
                  </NuxtLink>
                </div>
              </SectionCard>
            </div>

            <!--
              Booking Timeline (Section 18, D-075) — SATU list terunifikasi lintas Flight/Hotel/Transport/MICE
              MENGGANTIKAN 4 blok ringkasan terpisah lama (Section 13-16, lihat CI-048). Informasi identik
              dengan `/bookings` (booking reference/status internal-supplier-client/deadline/voucher/exception/
              dependency/payment-gate), hanya pre-filtered ke project ini. Aksi Mark Payment Cleared/Catat
              Percobaan TETAP di `/bookings` (bukan di sini) — tab ini murni ringkasan+link, konsisten pola
              ringkasan Procurement di bawah. SENGAJA full-width sendiri (bukan lagi digrid-2kolom bareng
              card tipe layanan) — jumlah barisnya bisa jauh lebih banyak dari card layanan manapun, kalau
              di-grid bareng maka card layanan pendek ikut di-stretch tinggi dan menyisakan ruang kosong
              raksasa di bawahnya (bug yang dilaporkan pada "Additional Service").
            -->
            <SectionCard v-if="projectBookingTimeline.length" compact title="Booking Timeline" description="Konsolidasi Flight/Hotel/Transport/MICE booking untuk project ini — satu sumber kebenaran seluruh service (Section 18).">
              <template #actions>
                <NuxtLink :to="`/bookings?projectId=${project.id}`">
                  <Button size="sm" variant="outline">
                    Buka Booking Center
                  </Button>
                </NuxtLink>
              </template>
              <div class="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Booking</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead>Internal</TableHead>
                      <TableHead>Payment</TableHead>
                      <TableHead class="text-right">
                        Action
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow v-for="entry in projectBookingTimeline" :key="`${entry.bookingType}-${entry.bookingId}`">
                      <TableCell class="max-w-[260px]">
                        <div class="flex items-center gap-1.5">
                          <StatusBadge :label="BOOKING_DOMAIN_LABEL_MAP[entry.bookingType]" :tone="BOOKING_DOMAIN_TONE_MAP[entry.bookingType]" />
                          <NuxtLink :to="entry.detailHref" class="font-ticket-mono text-sm font-medium text-foreground hover:text-primary hover:underline">
                            {{ entry.bookingId }}
                          </NuxtLink>
                        </div>
                        <p class="mt-0.5 truncate text-xs text-muted-foreground" :title="entry.label">
                          {{ entry.label }}
                        </p>
                        <p v-if="entry.exceptions.length" class="mt-0.5 truncate text-[11px] text-destructive" :title="entry.exceptions.join(' · ')">
                          {{ entry.exceptions[0] }}<template v-if="entry.exceptions.length > 1">
                            +{{ entry.exceptions.length - 1 }} lagi
                          </template>
                        </p>
                      </TableCell>
                      <TableCell class="font-ticket-mono text-xs text-muted-foreground">
                        {{ entry.reference ?? 'Belum terbit' }}
                        <br>
                        {{ entry.travelerCount }} pax<template v-if="entry.deadlineDate">
                          · {{ formatDate(entry.deadlineDate) }}
                        </template>
                      </TableCell>
                      <TableCell><StatusBadge :label="entry.internalStatus" :tone="entry.internalStatusTone" /></TableCell>
                      <TableCell><StatusBadge :label="findStatusOption(BOOKING_PAYMENT_GATE_STATUSES, entry.paymentGateStatus).label" :tone="findStatusOption(BOOKING_PAYMENT_GATE_STATUSES, entry.paymentGateStatus).tone" /></TableCell>
                      <TableCell class="text-right">
                        <NuxtLink v-if="entry.voucherHref" :to="entry.voucherHref" target="_blank">
                          <Button size="sm" variant="ghost">
                            Voucher
                          </Button>
                        </NuxtLink>
                        <span v-else class="text-xs text-muted-foreground">—</span>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </SectionCard>

            <EmptyState v-if="!visibleServiceTypes.length && !projectBookingTimeline.length" :icon="Truck" title="Belum ada layanan tercatat untuk project ini" />

            <!-- Procurement summary (Section 17 baru) — ringkasan RFQ dan Service Order, pengelolaan lengkap di modul /procurement. -->
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <SectionCard
                v-if="projectRfqs.length || projectServiceOrders.length"
                compact
                title="Procurement — RFQ dan Service Order"
                description="Ringkasan sourcing formal dan Service Order untuk project ini."
              >
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

              <SectionCard
                compact
                title="Operational Tasks"
                :description="`${tasks.length} task tercatat untuk project ini`"
                :class="!(projectRfqs.length || projectServiceOrders.length) ? 'lg:col-span-2' : ''"
              >
                <template v-if="tasks.length" #actions>
                  <Button size="sm" variant="outline" @click="activeTab = 'tasks'">
                    Lihat Semua Task
                  </Button>
                </template>
                <Table v-if="tasks.length">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Task</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>PIC</TableHead>
                      <TableHead>Deadline</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow v-for="task in tasks.slice(0, 5)" :key="task.id">
                      <TableCell class="text-sm text-foreground">
                        {{ task.title }}
                      </TableCell>
                      <TableCell>
                        <StatusBadge
                          :label="findStatusOption(TASK_STATUSES, task.status).label"
                          :tone="findStatusOption(TASK_STATUSES, task.status).tone"
                        />
                      </TableCell>
                      <TableCell class="text-sm text-muted-foreground">
                        {{ task.assignedTo ? getUserById(task.assignedTo)?.name ?? task.assignedTo : '—' }}
                      </TableCell>
                      <TableCell class="text-sm text-muted-foreground">
                        {{ task.dueAt ? formatDate(task.dueAt) : '—' }}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
                <EmptyState v-else title="Belum ada task tercatat" />
              </SectionCard>
            </div>

            <!-- On-Trip Updates / Shift Notes (Section 12 baru) -->
            <SectionCard compact title="On-Trip Updates / Shift Notes" description="Catatan serah-terima operasional selama trip berlangsung (mock).">
              <template v-if="canManageOperations" #actions>
                <Sheet v-model:open="isShiftNoteDialogOpen">
                  <SheetTrigger as-child>
                    <Button size="sm" variant="outline">
                      + Catat Shift Note
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="right" class="w-full sm:max-w-lg overflow-y-auto">
                    <SheetHeader>
                      <SheetTitle>Catat Shift Note Baru</SheetTitle>
                      <SheetDescription>Catatan serah-terima antar staf lapangan — mock, bukan sistem shift roster sungguhan.</SheetDescription>
                    </SheetHeader>
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
                    <SheetFooter class="mt-6 flex-row justify-end gap-2">
                      <Button variant="outline" @click="isShiftNoteDialogOpen = false">
                        Batal
                      </Button>
                      <Button :disabled="!shiftNoteText.trim()" @click="submitShiftNote">
                        Simpan
                      </Button>
                    </SheetFooter>
                  </SheetContent>
                </Sheet>
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

            <SectionCard compact title="Awaiting DP" description="Lead sudah Qualified, quota sudah ditahan — belum ada Participant sampai DP dikonfirmasi." :accent="awaitingDpRows.length > 0" tone="warning">
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
                      <Button size="sm" @click="openConfirmDp(row.order)">
                        Konfirmasi DP
                      </Button>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
              <EmptyState v-else title="Belum ada booking Awaiting DP" />
            </SectionCard>

            <SectionCard compact title="Confirmed Bookings">
              <Table v-if="confirmedBookingRows.length">
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Pax</TableHead>
                    <TableHead>Harga</TableHead>
                    <TableHead>Outstanding</TableHead>
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
                      <StatusBadge
                        v-if="getSalesOrderOutstandingIdr(row.order.id) > 0"
                        :label="`${formatCurrencyIdr(getSalesOrderOutstandingIdr(row.order.id))} belum lunas`"
                        :tone="isDpBalanceOverdue(project, getSalesOrderOutstandingIdr(row.order.id)) ? 'destructive' : 'warning'"
                      />
                      <StatusBadge v-else label="Lunas" tone="success" />
                    </TableCell>
                    <TableCell>
                      <StatusBadge :label="row.statusOption.label" :tone="row.statusOption.tone" />
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
              <EmptyState v-else title="Belum ada Confirmed Booking" />
            </SectionCard>

            <SectionCard compact title="Waitlist" description="Lead yang minta pax lebih banyak dari seat tersisa saat qualification.">
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

          <Dialog v-model:open="isConfirmDpDialogOpen">
            <DialogContent class="max-w-md">
              <DialogHeader>
                <DialogTitle>Konfirmasi DP</DialogTitle>
                <DialogDescription>
                  {{ confirmDpOrder?.travelerCount }} pax · Harga {{ confirmDpOrder ? formatCurrencyIdr(confirmDpOrder.priceIdr) : '—' }} · Minimal DP {{ formatCurrencyIdr(confirmDpMinimumIdr) }} ({{ MINIMUM_DP_PERCENT }}%). Boleh DP sebagian — sisanya tercatat sebagai outstanding.
                </DialogDescription>
              </DialogHeader>
              <div class="space-y-1.5 py-2">
                <Label for="confirm-dp-amount">Nominal DP Diterima (Rp)</Label>
                <CurrencyInput id="confirm-dp-amount" v-model="confirmDpAmountIdr" placeholder="mis. 4000000" />
                <p v-if="confirmDpMinimumError" class="text-xs text-destructive">
                  {{ confirmDpMinimumError }}
                </p>
              </div>
              <DialogFooter>
                <Button variant="outline" @click="isConfirmDpDialogOpen = false">
                  Batal
                </Button>
                <Button :disabled="!confirmDpAmountIdr" @click="submitConfirmDp">
                  Konfirmasi
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent v-if="project.isGroupTrip" value="reservations">
          <SectionCard compact title="Reservations" description="Booking flight/hotel/transport/dll untuk trip ini.">
            <ul v-if="groupTripReservations.length" class="divide-y divide-border">
              <li v-for="reservation in groupTripReservations" :key="`${reservation.bookingType}-${reservation.bookingId}`" class="py-3 flex items-center justify-between gap-3">
                <div class="min-w-0">
                  <p class="text-sm font-medium text-foreground truncate">
                    {{ reservation.label }}
                  </p>
                  <p class="text-xs text-muted-foreground">
                    {{ reservation.category }}<template v-if="reservation.reference">
                      · <span class="font-ticket-mono">{{ reservation.reference }}</span>
                    </template>
                  </p>
                </div>
                <span class="text-xs text-muted-foreground shrink-0">{{ reservation.clientVisibleStatus }}</span>
              </li>
            </ul>
            <EmptyState v-else title="Belum ada reservation tercatat" />
          </SectionCard>
        </TabsContent>

        <TabsContent v-if="project.isGroupTrip" value="payments">
          <SectionCard compact title="Payments" description="Riwayat pembayaran dari seluruh invoice project ini.">
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
              compact
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
                    <Sheet v-model:open="isTravelerDialogOpen">
                      <SheetTrigger as-child>
                        <Button size="sm" @click="openCreateTraveler">
                          <UserPlus class="h-4 w-4 mr-1.5" />Tambah Traveler
                        </Button>
                      </SheetTrigger>
                      <SheetContent side="right" class="w-full sm:max-w-lg overflow-y-auto">
                        <SheetHeader>
                          <SheetTitle>{{ editingTravelerId ? 'Edit Traveler' : 'Tambah Traveler Baru' }}</SheetTitle>
                          <SheetDescription>Profil traveler untuk project {{ project.name }}.</SheetDescription>
                        </SheetHeader>
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
                        <SheetFooter class="mt-6 flex-row justify-end gap-2">
                          <Button variant="outline" @click="isTravelerDialogOpen = false">
                            Batal
                          </Button>
                          <Button :disabled="!formName.trim()" @click="submitTraveler">
                            Simpan
                          </Button>
                        </SheetFooter>
                      </SheetContent>
                    </Sheet>
                  </template>
                </div>
              </template>

              <!-- Readiness indicator (Section 11 baru) -->
              <div v-if="travelerReadiness && travelerReadiness.total > 0" class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <StatsCard title="Dokumen Lengkap" :value="`${travelerReadiness.documentsCompleteCount}/${travelerReadiness.total}`" :icon="FileText" />
                <StatsCard title="Terverifikasi" :value="`${travelerReadiness.verifiedCount}/${travelerReadiness.total}`" :icon="CheckCircle2" />
                <StatsCard title="Rooming Ditugaskan" :value="`${travelerReadiness.roomingAssignedCount}/${travelerReadiness.total}`" :icon="Users" />
                <StatsCard title="Readiness" :value="`${travelerReadiness.readinessPercent}%`" :icon="CheckCircle2" :icon-color="travelerReadiness.readinessPercent >= 80 ? 'success' : travelerReadiness.readinessPercent >= 50 ? 'warning' : 'destructive'" />
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
                    <TableHead>Dokumen</TableHead>
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
                      <p v-if="traveler.groupId" class="text-xs font-normal text-muted-foreground">
                        Group: {{ groupNameById(traveler.groupId) }}
                      </p>
                      <p v-if="companionSummary(traveler)" class="text-xs font-normal text-muted-foreground">
                        {{ companionSummary(traveler) }}
                      </p>
                      <p v-if="traveler.salesOrderId && getSalesOrderOutstandingIdr(traveler.salesOrderId) > 0" class="text-xs font-normal text-warning">
                        Sisa tagihan booking: {{ formatCurrencyIdr(getSalesOrderOutstandingIdr(traveler.salesOrderId)) }} (saldo bersama per booking, bukan per-pax)
                      </p>
                    </TableCell>
                    <TableCell class="font-ticket-mono text-muted-foreground text-xs">
                      <p class="whitespace-nowrap">
                        Paspor: {{ passportSummary(traveler) }}
                      </p>
                      <p v-if="traveler.idNumber" class="whitespace-nowrap">
                        ID: {{ idNumberSummary(traveler) }}
                      </p>
                      <p v-if="traveler.visaNumber" class="whitespace-nowrap">
                        Visa: {{ visaSummary(traveler) }}
                      </p>
                    </TableCell>
                    <TableCell class="text-muted-foreground">
                      <template v-if="traveler.emergencyContactName">
                        <p class="text-foreground">
                          {{ traveler.emergencyContactName }}
                        </p>
                        <p v-if="traveler.emergencyContactPhone" class="whitespace-nowrap text-xs">
                          {{ traveler.emergencyContactPhone }}
                        </p>
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
                  <TableEmpty v-if="travelers.length > 0 && filteredTravelers.length === 0" :colspan="canManageTravelers ? 7 : 6">
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
          <Sheet v-model:open="isCreateGroupOpen">
            <SheetContent side="right" class="w-full sm:max-w-lg overflow-y-auto">
              <SheetHeader>
                <SheetTitle>Group Baru</SheetTitle>
              </SheetHeader>
              <div class="space-y-1.5 py-2">
                <Label for="new-group-name">Nama Group</Label>
                <Input id="new-group-name" v-model="newGroupName" placeholder="mis. Group Management" />
              </div>
              <SheetFooter class="mt-6 flex-row justify-end gap-2">
                <Button variant="outline" @click="isCreateGroupOpen = false">
                  Batal
                </Button>
                <Button :disabled="!newGroupName.trim()" @click="submitCreateGroup">
                  Simpan
                </Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>

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
          <SectionCard compact title="Vendors" description="Vendor yang ditugaskan dan perbandingan quotation untuk tiap layanan project ini.">
            <div v-if="services.length" class="space-y-3">
              <div
                v-for="row in vendorServiceRows"
                :key="row.service.id"
                class="rounded-lg border border-l-2 border-border p-4"
                :class="TONE_BORDER_L[findStatusOption(SERVICE_STATUSES, row.service.status).tone]"
              >
                <div class="flex flex-wrap items-start justify-between gap-3">
                  <div class="flex min-w-0 items-start gap-2.5">
                    <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full" :class="TONE_ICON_BG[findStatusOption(SERVICE_TYPES, row.service.type).tone]">
                      <component :is="SERVICE_TYPE_ICON[row.service.type]" class="h-4 w-4" />
                    </div>
                    <div class="min-w-0">
                      <p class="truncate text-sm font-medium text-foreground">
                        {{ row.service.label }}
                      </p>
                      <p class="mt-0.5 text-xs text-muted-foreground">
                        Vendor:
                        <NuxtLink v-if="row.service.vendorId" :to="`/vendors/${row.service.vendorId}`" class="text-primary hover:underline">
                          {{ getVendorById(row.service.vendorId)?.name }}
                        </NuxtLink>
                        <span v-else>Belum ditugaskan</span>
                      </p>
                    </div>
                  </div>
                  <div class="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                    <StatusBadge
                      :label="findStatusOption(SERVICE_STATUSES, row.service.status).label"
                      :tone="findStatusOption(SERVICE_STATUSES, row.service.status).tone"
                    />
                    <StatusBadge v-if="isVendorAlreadyPaid(row.service)" label="Sudah Dibayar" tone="success" />
                    <Button v-else-if="row.service.vendorId && canManageServiceType(row.service.type)" size="sm" variant="outline" @click="openRecordVendorPayment(row.service)">
                      Catat Sudah Dibayar
                    </Button>
                  </div>
                </div>

                <!-- 1 quotation = ringkas satu baris (tabel perbandingan tidak berguna kalau cuma 1 opsi); 2+ = tabel supaya benar-benar bisa dibandingkan. -->
                <template v-if="row.quotations.length > 1">
                  <p class="mb-1.5 mt-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Perbandingan Quotation ({{ row.quotations.length }})
                  </p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Vendor</TableHead>
                        <TableHead>Nilai</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead v-if="canManageServiceType(row.service.type)">
                          Aksi
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow v-for="quotation in row.quotations" :key="quotation.id">
                        <TableCell class="text-foreground">
                          {{ getVendorById(quotation.vendorId)?.name ?? quotation.vendorId }}
                        </TableCell>
                        <TableCell class="tabular-nums">
                          {{ formatCurrencyIdr(quotation.amountIdr) }}
                        </TableCell>
                        <TableCell>
                          <StatusBadge
                            :label="findStatusOption(VENDOR_QUOTATION_STATUSES, quotation.status).label"
                            :tone="findStatusOption(VENDOR_QUOTATION_STATUSES, quotation.status).tone"
                          />
                        </TableCell>
                        <TableCell v-if="canManageServiceType(row.service.type)">
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
                <div v-else-if="row.quotations.length === 1" class="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-border pt-3 text-xs">
                  <span class="text-muted-foreground">{{ getVendorById(row.quotations[0].vendorId)?.name ?? row.quotations[0].vendorId }}</span>
                  <span class="font-semibold tabular-nums text-foreground">{{ formatCurrencyIdr(row.quotations[0].amountIdr) }}</span>
                  <StatusBadge
                    :label="findStatusOption(VENDOR_QUOTATION_STATUSES, row.quotations[0].status).label"
                    :tone="findStatusOption(VENDOR_QUOTATION_STATUSES, row.quotations[0].status).tone"
                  />
                  <div v-if="row.quotations[0].status === 'submitted' && canManageServiceType(row.service.type)" class="ml-auto flex items-center gap-1">
                    <Button size="sm" variant="outline" @click="handleAcceptQuotation(row.quotations[0].id)">
                      Terima
                    </Button>
                    <Button size="sm" variant="ghost" @click="handleRejectQuotation(row.quotations[0].id)">
                      Tolak
                    </Button>
                  </div>
                </div>
                <p v-else class="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
                  Belum ada quotation untuk layanan ini.
                </p>
              </div>
            </div>
            <EmptyState v-else :icon="Truck" title="Belum ada layanan tercatat untuk project ini" />
          </SectionCard>

          <Sheet v-model:open="isVendorPaymentDialogOpen">
            <SheetContent side="right" class="w-full sm:max-w-lg overflow-y-auto">
              <SheetHeader>
                <SheetTitle>Catat Sudah Dibayar ke Vendor</SheetTitle>
                <SheetDescription>
                  Untuk layanan "{{ vendorPaymentService?.label }}" — {{ vendorPaymentService?.vendorId ? getVendorById(vendorPaymentService.vendorId)?.name : '' }}. Langsung tercatat lunas dan masuk Actual Cost, tanpa lewat pengajuan invoice mandiri vendor.
                </SheetDescription>
              </SheetHeader>
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
              <SheetFooter class="mt-6 flex-row justify-end gap-2">
                <Button variant="outline" @click="isVendorPaymentDialogOpen = false">
                  Batal
                </Button>
                <Button :disabled="!vendorPaymentAmountIdr" @click="submitVendorPayment">
                  Simpan
                </Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        </TabsContent>

        <TabsContent value="finance">
          <div class="space-y-4">
            <template v-if="canViewFinancials">
              <SectionCard compact title="Finance">
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <StatsCard
                    title="Nilai Project"
                    :value="formatCurrencyIdr(project.quotationAmountIdr)"
                    :subtitle="`Terkumpul ${formatCurrencyIdr(collectedIdr)} dari client${quotationGapIdr > 0 ? ' · Kurang ' + formatCurrencyIdr(quotationGapIdr) : ' · Lunas'}`"
                    :progress-percent="quotationCollectionPercent"
                    :icon="FileText"
                    :icon-color="quotationGapIdr > 0 ? 'warning' : 'success'"
                  />
                  <StatsCard
                    title="Total Cost"
                    :value="formatCurrencyIdr(actualCostIdr)"
                    subtitle="Biaya aktual saat ini"
                    :progress-percent="project.budgetIdr > 0 ? (actualCostIdr / project.budgetIdr) * 100 : 0"
                    :icon="CreditCard"
                    :icon-color="actualCostIdr > project.budgetIdr ? 'destructive' : 'success'"
                  />
                  <StatsCard
                    v-if="canViewMargin"
                    title="Margin"
                    :value="formatCurrencyIdr(marginIdr)"
                    subtitle="Perkiraan margin proyek"
                    :progress-percent="project.quotationAmountIdr > 0 ? (marginIdr / project.quotationAmountIdr) * 100 : 0"
                    :icon="PieChart"
                    :icon-color="marginIdr >= 0 ? 'success' : 'destructive'"
                  />
                </div>
              </SectionCard>

              <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <SectionCard compact title="Close Finance" description="Financial closure gate — menandai project ini &quot;Finance diselesaikan&quot; sebelum Project Closure.">
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

                <SectionCard compact title="Credit / Debit Notes" description="Kelola dari Finance &gt; Credit/Debit Notes.">
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
              </div>

              <SectionCard compact title="AP Summary (Supplier Invoice)" description="Reconciliation lengkap di Finance &gt; Reconciliation.">
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

              <SectionCard compact title="Pengeluaran Project" description="Pengeluaran ad-hoc (transport, konsumsi, perlengkapan, dll) yang langsung tercatat dan ikut Actual Cost — tanpa approval berlapis.">
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

              <SectionCard compact title="Invoice" :description="`Outstanding: ${formatCurrencyIdr(projectOutstandingIdr)}`" :accent="projectOutstandingIdr > 0" tone="warning">
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

              <SectionCard compact title="Riwayat Pembayaran">
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
            </template>

            <template v-else>
              <SectionCard compact title="Finance">
                <p class="text-xs text-muted-foreground mb-4">
                  Ringkasan terbatas — detail Budget, Actual Cost, Committed Vendor Cost, dan Margin hanya terlihat oleh role dengan akses modul Finance.
                </p>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <StatsCard
                    title="Nilai Quotation"
                    :value="formatCurrencyIdr(project.quotationAmountIdr)"
                    :subtitle="`Terkumpul ${formatCurrencyIdr(collectedIdr)} dari client${quotationGapIdr > 0 ? ' · Kurang ' + formatCurrencyIdr(quotationGapIdr) : ' · Lunas'}`"
                    :progress-percent="quotationCollectionPercent"
                    :icon="FileText"
                    :icon-color="quotationGapIdr > 0 ? 'warning' : 'success'"
                  />
                  <StatsCard title="Outstanding" :value="formatCurrencyIdr(projectOutstandingIdr)" :icon="Wallet" icon-color="warning" />
                </div>
              </SectionCard>
            </template>
          </div>

          <Sheet v-model:open="isExpenseDialogOpen">
            <SheetContent side="right" class="w-full sm:max-w-lg overflow-y-auto">
              <SheetHeader>
                <SheetTitle>Catat Pengeluaran</SheetTitle>
                <SheetDescription>Langsung tercatat dan ikut Actual Cost project — tanpa alur approval.</SheetDescription>
              </SheetHeader>
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
              <SheetFooter class="mt-6 flex-row justify-end gap-2">
                <Button variant="outline" @click="isExpenseDialogOpen = false">
                  Batal
                </Button>
                <Button :disabled="!expenseCategory || !expenseDescription.trim() || !expenseAmountIdr || !expenseIncurredAt" @click="submitExpense">
                  Simpan
                </Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        </TabsContent>

        <TabsContent value="tasks">
          <SectionCard compact title="Tasks &amp; Milestones">
            <template v-if="canManageProjectOrder" #actions>
              <Button size="sm" variant="outline" @click="openCreateTask">
                + Tambah Task
              </Button>
            </template>
            <div v-if="tasks.length" class="flex gap-4 overflow-x-auto pb-1">
              <div v-for="status in TASK_STATUSES" :key="status.value" class="w-72 shrink-0">
                <div class="mb-2 flex items-center justify-between px-0.5">
                  <StatusBadge :label="status.label" :tone="status.tone" dot />
                  <span class="text-xs text-muted-foreground">{{ tasks.filter(t => t.status === status.value).length }}</span>
                </div>
                <div class="space-y-2 rounded-lg bg-muted/40 p-2 min-h-[60px]">
                  <div v-for="task in tasks.filter(t => t.status === status.value)" :key="task.id" class="rounded-lg border border-border bg-card p-3 shadow-sm">
                    <div class="flex items-start justify-between gap-2">
                      <div class="min-w-0 flex items-center gap-1.5 flex-wrap">
                        <span v-if="task.isMilestone" class="shrink-0 text-[10px] font-semibold uppercase tracking-wide rounded-full bg-primary/10 text-primary px-2 py-0.5">Milestone</span>
                        <span class="text-sm text-foreground">{{ task.title }}</span>
                      </div>
                    </div>
                    <StatusBadge v-if="task.isBlocked" label="Blocked" tone="destructive" class="mt-1.5" />
                    <p class="text-xs text-muted-foreground mt-1.5">
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
                    <div class="mt-2.5 flex items-center justify-between gap-2">
                      <template v-if="canManageProjectOrder">
                        <Button v-if="task.isBlocked" size="xs" variant="ghost" @click="unblockTask(task)">
                          Buka Blokir
                        </Button>
                        <Button v-else size="xs" variant="ghost" @click="openBlockDialog(task)">
                          Blokir
                        </Button>
                      </template>
                      <select
                        :value="task.status"
                        :disabled="!canManageProjectOrder"
                        class="ml-auto appearance-none px-2 py-1 text-xs rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer disabled:cursor-not-allowed"
                        @change="handleTaskStatusChange(task.id, $event)"
                      >
                        <option v-for="option in TASK_STATUSES" :key="option.value" :value="option.value">
                          {{ option.label }}
                        </option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>
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

          <Sheet v-model:open="isTaskDialogOpen">
            <SheetContent side="right" class="w-full sm:max-w-lg overflow-y-auto">
              <SheetHeader>
                <SheetTitle>Tambah Task</SheetTitle>
              </SheetHeader>
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
              <SheetFooter class="mt-6 flex-row justify-end gap-2">
                <Button variant="outline" @click="isTaskDialogOpen = false">
                  Batal
                </Button>
                <Button :disabled="!taskTitle.trim()" @click="submitTask">
                  Simpan
                </Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        </TabsContent>

        <TabsContent value="documents">
          <SectionCard compact title="Documents" description="Category/version/expiry/access level (Section 21, D-078) — menggabungkan dokumen lama (legacy, tanpa category) dengan dokumen baru. Kelola dokumen lintas-project di modul Documents & Communication.">
            <template #actions>
              <div class="flex items-center gap-2">
                <div class="relative flex items-center rounded-lg border border-input bg-muted/40 p-0.5">
                  <span
                    class="absolute left-0.5 top-0.5 h-7 w-7 rounded-md bg-primary shadow-sm transition-transform duration-200 ease-out"
                    :class="documentsViewMode === 'grid' ? 'translate-x-7' : 'translate-x-0'"
                    aria-hidden="true"
                  />
                  <button
                    type="button"
                    title="List view"
                    class="relative z-10 flex h-7 w-7 items-center justify-center rounded-md transition-colors duration-200"
                    :class="documentsViewMode === 'list' ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground'"
                    @click="documentsViewMode = 'list'"
                  >
                    <List class="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    title="Grid view"
                    class="relative z-10 flex h-7 w-7 items-center justify-center rounded-md transition-colors duration-200"
                    :class="documentsViewMode === 'grid' ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground'"
                    @click="documentsViewMode = 'grid'"
                  >
                    <LayoutGrid class="h-4 w-4" />
                  </button>
                </div>
                <NuxtLink to="/documents">
                  <Button size="sm" variant="outline">
                    Buka Documents & Communication
                  </Button>
                </NuxtLink>
              </div>
            </template>

            <Transition name="docs-view" mode="out-in">
              <Table v-if="documentsViewMode === 'list'" key="list">
                <TableHeader>
                  <TableRow>
                    <TableHead>Document</TableHead>
                    <TableHead>Access Level</TableHead>
                    <TableHead>Expiry</TableHead>
                    <TableHead class="text-right">
                      Action
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow v-for="document in unifiedDocuments" :key="document.id">
                    <TableCell class="max-w-[360px]">
                      <div class="flex items-center gap-2.5">
                        <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full" :class="TONE_ICON_BG[documentCategoryTone(document.category)]">
                          <FileText class="h-4 w-4" />
                        </div>
                        <div class="min-w-0">
                          <p class="truncate font-medium text-foreground">
                            {{ document.name }}
                          </p>
                          <p class="truncate text-xs text-muted-foreground">
                            {{ document.category }} · v{{ document.version }}
                            <template v-if="document.sourceType === 'generated' && document.previewRoute">
                              · <NuxtLink :to="document.previewRoute" target="_blank" class="text-primary hover:underline">
                                Preview
                              </NuxtLink>
                            </template>
                          </p>
                        </div>
                      </div>
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
                    <TableCell class="text-right">
                      <button type="button" class="inline-flex items-center gap-1 text-xs text-primary hover:underline" @click="handleDownloadDocument(document)">
                        <Download class="h-3 w-3" />Download
                      </button>
                    </TableCell>
                  </TableRow>
                  <TableEmpty v-if="unifiedDocuments.length === 0" :colspan="4">
                    Belum ada dokumen diunggah
                  </TableEmpty>
                </TableBody>
              </Table>

              <div v-else-if="unifiedDocuments.length" key="grid" class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                <div
                  v-for="document in unifiedDocuments"
                  :key="document.id"
                  class="group relative flex flex-col rounded-lg border border-border p-3 transition-colors hover:border-primary/40 hover:shadow-sm"
                >
                  <div class="mb-2 flex items-start justify-between">
                    <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full" :class="TONE_ICON_BG[documentCategoryTone(document.category)]">
                      <FileText class="h-4 w-4" />
                    </div>
                    <StatusBadge :label="findStatusOption(DOCUMENT_ACCESS_LEVELS, document.accessLevel).label" :tone="findStatusOption(DOCUMENT_ACCESS_LEVELS, document.accessLevel).tone" />
                  </div>
                  <p class="truncate text-sm font-medium text-foreground" :title="document.name">
                    {{ document.name }}
                  </p>
                  <p class="mb-1 text-xs text-muted-foreground">
                    {{ document.category }} · v{{ document.version }}
                  </p>
                  <template v-if="document.expiresAt">
                    <StatusBadge
                      class="mb-2 self-start"
                      :label="isDocumentExpired(document.expiresAt) ? `Expired ${formatDate(document.expiresAt)}` : isDocumentExpiringSoon(document.expiresAt) ? `Segera: ${formatDate(document.expiresAt)}` : formatDate(document.expiresAt)"
                      :tone="isDocumentExpired(document.expiresAt) ? 'destructive' : isDocumentExpiringSoon(document.expiresAt) ? 'warning' : 'neutral'"
                    />
                  </template>
                  <div class="mt-auto flex items-center gap-3 border-t border-border pt-2">
                    <NuxtLink v-if="document.sourceType === 'generated' && document.previewRoute" :to="document.previewRoute" target="_blank" class="text-xs text-primary hover:underline">
                      Preview
                    </NuxtLink>
                    <button type="button" class="ml-auto inline-flex items-center gap-1 text-xs text-primary hover:underline" @click="handleDownloadDocument(document)">
                      <Download class="h-3 w-3" />Download
                    </button>
                  </div>
                </div>
              </div>
              <EmptyState v-else key="empty" title="Belum ada dokumen diunggah" />
            </Transition>
          </SectionCard>
        </TabsContent>

        <TabsContent value="activity-changes">
          <div class="space-y-6">
            <SectionCard compact title="Riwayat Aktivitas" description="Riwayat kronologis perubahan, komunikasi, dan event sistem untuk project ini — Activity/Change, Message, System Event, dan Document dalam satu list (Section 21, D-078).">
              <template #actions>
                <div class="flex items-center gap-2">
                  <Sheet v-if="canLogChange" v-model:open="isChangeDialogOpen">
                    <SheetTrigger as-child>
                      <Button size="sm" variant="outline">
                        Catat Perubahan
                      </Button>
                    </SheetTrigger>
                    <SheetContent side="right" class="w-full sm:max-w-lg overflow-y-auto">
                      <SheetHeader>
                        <SheetTitle>Catat Perubahan Baru</SheetTitle>
                        <SheetDescription>Change akan tercatat berstatus "Menunggu Approval" — mock, bukan approval sungguhan.</SheetDescription>
                      </SheetHeader>
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
                      <SheetFooter class="mt-6 flex-row justify-end gap-2">
                        <Button variant="outline" @click="isChangeDialogOpen = false">
                          Batal
                        </Button>
                        <Button :disabled="!changeReason.trim()" @click="submitChangeEntry">
                          Simpan
                        </Button>
                      </SheetFooter>
                    </SheetContent>
                  </Sheet>
                  <Sheet v-model:open="isMessageDialogOpen">
                    <SheetTrigger as-child>
                      <Button size="sm" variant="outline">
                        Kirim Pesan
                      </Button>
                    </SheetTrigger>
                    <SheetContent side="right" class="w-full sm:max-w-lg overflow-y-auto">
                      <SheetHeader>
                        <SheetTitle>Kirim Pesan Baru</SheetTitle>
                        <SheetDescription>Internal note hanya terlihat internal — client/supplier message akan tampil pada Client/Supplier Portal terkait.</SheetDescription>
                      </SheetHeader>
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
                      <SheetFooter class="mt-6 flex-row justify-end gap-2">
                        <Button variant="outline" @click="isMessageDialogOpen = false">
                          Batal
                        </Button>
                        <Button :disabled="!messageBody.trim()" @click="submitMessage">
                          Kirim
                        </Button>
                      </SheetFooter>
                    </SheetContent>
                  </Sheet>
                </div>
              </template>

              <div class="flex items-center gap-2 mb-4 flex-wrap">
                <button
                  :class="['px-3 py-1.5 text-xs rounded-lg border', historyFilter === 'all' ? 'border-primary/40 bg-primary/5 text-primary' : 'border-border text-muted-foreground']"
                  @click="historyFilter = 'all'"
                >
                  All
                </button>
                <button
                  :class="['px-3 py-1.5 text-xs rounded-lg border', historyFilter === 'change' ? 'border-primary/40 bg-primary/5 text-primary' : 'border-border text-muted-foreground']"
                  @click="historyFilter = 'change'"
                >
                  Perubahan
                </button>
                <button
                  :class="['px-3 py-1.5 text-xs rounded-lg border', historyFilter === 'message' ? 'border-primary/40 bg-primary/5 text-primary' : 'border-border text-muted-foreground']"
                  @click="historyFilter = 'message'"
                >
                  Pesan
                </button>
                <button
                  :class="['px-3 py-1.5 text-xs rounded-lg border', historyFilter === 'system' ? 'border-primary/40 bg-primary/5 text-primary' : 'border-border text-muted-foreground']"
                  @click="historyFilter = 'system'"
                >
                  Sistem & Dokumen
                </button>
              </div>

              <ul class="divide-y divide-border">
                <li
                  v-for="item in visibleHistoryEntries"
                  :key="item.id"
                  :class="['py-3 flex items-start gap-3', item.kind === 'change' ? 'border-l-2 pl-3 -ml-3' : '', item.activity?.approvalStatus === 'pending' ? 'border-warning' : item.activity?.approvalStatus === 'approved' ? 'border-success' : item.activity?.approvalStatus === 'rejected' ? 'border-destructive' : item.kind === 'change' ? 'border-border' : '']"
                >
                  <component
                    :is="item.kind === 'message' ? MessageSquare : item.kind === 'document' ? FileText : item.kind === 'system-event' ? Settings2 : FileClock"
                    class="h-4 w-4 text-muted-foreground shrink-0 mt-0.5"
                  />

                  <template v-if="item.activity">
                    <div class="min-w-0 flex-1">
                      <div v-if="item.activity.category || item.activity.approvalStatus" class="flex items-center gap-1.5 flex-wrap mb-1">
                        <StatusBadge v-if="item.activity.category" :label="findStatusOption(CHANGE_CATEGORIES, item.activity.category).label" :tone="findStatusOption(CHANGE_CATEGORIES, item.activity.category).tone" />
                        <StatusBadge v-if="item.activity.approvalStatus" :label="findStatusOption(CHANGE_APPROVAL_STATUSES, item.activity.approvalStatus).label" :tone="findStatusOption(CHANGE_APPROVAL_STATUSES, item.activity.approvalStatus).tone" />
                      </div>
                      <p class="text-sm text-foreground">
                        {{ item.activity.message }}
                      </p>
                      <p v-if="item.activity.beforeValue || item.activity.afterValue" class="text-xs text-muted-foreground mt-0.5">
                        <template v-if="item.activity.beforeValue">
                          Sebelum: {{ item.activity.beforeValue }}
                        </template><template v-if="item.activity.beforeValue && item.activity.afterValue">
                          →
                        </template><template v-if="item.activity.afterValue">
                          Sesudah: {{ item.activity.afterValue }}
                        </template>
                      </p>
                      <p v-if="item.activity.requestedBy" class="text-xs text-muted-foreground">
                        Diajukan oleh: {{ getUserById(item.activity.requestedBy)?.name ?? item.activity.requestedBy }}
                      </p>
                      <p v-if="item.activity.impactNote" class="text-xs text-muted-foreground">
                        Dampak: {{ item.activity.impactNote }}
                      </p>
                      <p class="text-xs text-muted-foreground mt-0.5">
                        {{ formatDate(item.activity.createdAt) }}
                      </p>
                    </div>
                    <div class="flex flex-col items-end gap-1.5 shrink-0">
                      <StatusBadge v-if="item.activity.isChange && !item.activity.approvalStatus" :label="item.activity.reviewed ? 'Change (Reviewed)' : 'Change (Belum Direview)'" :tone="item.activity.reviewed ? 'info' : 'warning'" />
                      <AttentionIndicator v-if="item.activity.approvalStatus === 'pending'" severity="medium" label="Menunggu Approval" />
                      <div v-if="item.activity.approvalStatus === 'pending' && canApproveChanges" class="flex items-center gap-1">
                        <Button size="sm" variant="outline" @click="handleApproveChange(item.activity.id)">
                          Setujui
                        </Button>
                        <Button size="sm" variant="ghost" @click="handleRejectChange(item.activity.id)">
                          Tolak
                        </Button>
                      </div>
                    </div>
                  </template>

                  <template v-else-if="item.message">
                    <div class="min-w-0 flex-1">
                      <div class="flex items-center gap-1.5 flex-wrap mb-1">
                        <StatusBadge :label="findStatusOption(MESSAGE_CHANNELS, item.message.channel).label" :tone="findStatusOption(MESSAGE_CHANNELS, item.message.channel).tone" />
                        <StatusBadge :label="findStatusOption(MESSAGE_DELIVERY_STATUSES, item.message.deliveryStatus).label" :tone="findStatusOption(MESSAGE_DELIVERY_STATUSES, item.message.deliveryStatus).tone" />
                      </div>
                      <p class="text-sm text-foreground">
                        {{ item.message.body }}
                      </p>
                      <p class="text-xs text-muted-foreground mt-0.5">
                        {{ getUserById(item.message.senderId)?.name ?? item.message.senderId }} · {{ formatDate(item.message.sentAt) }}
                      </p>
                    </div>
                  </template>

                  <template v-else-if="item.timelineEntry">
                    <div class="min-w-0 flex-1">
                      <div class="flex items-center gap-1.5 mb-0.5">
                        <StatusBadge :label="item.timelineEntry.label" :tone="item.timelineEntry.internalOnly ? 'neutral' : 'info'" />
                        <span v-if="item.timelineEntry.internalOnly" class="text-[10px] uppercase tracking-wide text-muted-foreground">Internal Only</span>
                      </div>
                      <p class="text-sm text-foreground truncate max-w-[560px]">
                        {{ item.timelineEntry.detail }}
                      </p>
                      <p class="text-xs text-muted-foreground mt-0.5">
                        {{ formatDate(item.timelineEntry.at) }}
                      </p>
                    </div>
                  </template>
                </li>
              </ul>
              <EmptyState v-if="visibleHistoryEntries.length === 0" title="Belum ada aktivitas tercatat" />
            </SectionCard>

            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <SectionCard compact title="Change Requests" description="Change Request terstruktur (before/after, dampak, approval) — Section 19, D-076. Lihat modul Changes & Incidents untuk daftar lengkap lintas project.">
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

              <SectionCard compact title="Cancellations" description="Penalty-tracking seragam lintas Flight/Hotel/Transport/MICE — dibuat otomatis saat booking dibatalkan.">
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
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <SectionCard compact title="Refund Requests">
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

              <SectionCard compact title="Incidents">
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
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </template>
  </div>
</template>

<style scoped>
/* Toggle List/Grid tab Documents — cross-fade halus alih-alih snap instan antar 2 struktur DOM berbeda (Table vs grid card). */
.docs-view-enter-active,
.docs-view-leave-active {
  transition: opacity 0.15s ease;
}
.docs-view-enter-from,
.docs-view-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .docs-view-enter-active,
  .docs-view-leave-active {
    transition: none;
  }
}
</style>
