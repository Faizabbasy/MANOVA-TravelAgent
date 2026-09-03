<script setup lang="ts">
import { ref, computed, nextTick, watch, type Component } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { FileX, Wallet, Users, User, Truck, Search, UserPlus, Upload, Pencil, Trash2, Printer, AlertTriangle, Plus, CheckCircle2, MapPin, CalendarRange, CreditCard, FileText, PieChart, Eye, EyeOff, LayoutGrid, List, Download, MessageSquare, FileClock, Settings2, ImagePlus, Plane, Hotel, Bus, PartyPopper, Package, Gauge, Clock, ChevronRight, ChevronLeft, ListChecks, CircleDashed, Check, MoreVertical, FolderOpen, Kanban, GanttChartSquare, MoreHorizontal, Calculator, Info } from 'lucide-vue-next'
import {
  getProjectById, getPartyById, getContactsByParty, getUserById, getVendorById, getLeadById,
  getFlightBookingsByService, getHotelBookingsByService, getTransportBookingsByService, getMiceEventsByService,
  getProjectServices, getItineraryItems, updateServiceStatus, updateProjectServiceBudget, ensureProjectServiceForBudget, updateItineraryItem, createItineraryItem, removeItineraryItem,
  getQuotationsForService, acceptVendorQuotation, rejectVendorQuotation, recordVendorPaymentDirect, assignServiceVendor,
  getServiceOrderByService, getSupplierInvoicesByServiceOrder,
  getTravelerGroups, getTravelers, getRoomAssignments,
  createTraveler, updateTraveler, removeTraveler, createTravelerGroup,
  toggleTravelerVerification, getTravelerReadiness, previewTravelerImportMock, commitTravelerImport,
  getInvoicesByProject, getPaymentsByInvoice, getProjectOutstandingIdr, getProjectCollectedIdr, getInvoiceOutstandingIdr,
  getInvoiceMilestoneOutstandingIdr, getInvoiceMilestoneStatus, createInvoice, recordPayment,
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
  getDocumentsForProject, createDocument, MESSAGE_RECORDS, sendMessage, getUnifiedActivityTimeline, updateProjectPhoto,
  USERS,
  getClientReservations, getProjectSeatsFilled, getProjectSeatsAvailable, getSalesOrdersByProject, getLeadsLinkedToGroupProject,
  confirmGroupTripDp, getSalesOrderOutstandingIdr,
  VENDORS, createFlightBooking, createHotelBooking, createTransportBooking, createMiceEvent, setServiceVendor,
  acceptProjectHandover, returnProjectHandover, setBookingPaymentGateStatus, updateProjectFieldContacts, updateProjectSchedule,
  paySupplierInvoice
} from '~/data'
import type { TravelerImportPreviewRow, AttentionQueueItem } from '~/data'
import type { SalesOrder } from '~/types/sales-order'
import type { BookingTimelineEntry } from '~/types/booking-orchestration'
import {
  getProjectOrderStepViews, advanceProjectOrder, getProjectMilestones,
  setMilestoneActualDate, updateMilestonePlannedDate, updateMilestoneNote, getProjectOrderStep
} from '~/data/project-order-workflow'
import { getProjectActualCostIdr, getProjectExpenses, createProjectExpense, PROJECT_EXPENSE_CATEGORIES, getServiceTypeSpendBreakdown } from '~/data/finance-ext'
import { getEmployeeByUserId } from '~/data/hr'
import { serviceCapabilityKey } from '~/constants/capabilities'
import { INVOICE_MILESTONE_TEMPLATES } from '~/constants/invoice-milestones'
import {
  PROJECT_STATUSES, SERVICE_STATUSES, SERVICE_TYPES,
  INVOICE_STATUSES, INVOICE_TYPES, TASK_STATUSES, ROOM_TYPES, VENDOR_QUOTATION_STATUSES,
  CHANGE_CATEGORIES, CHANGE_APPROVAL_STATUSES, BOOKING_PAYMENT_GATE_STATUSES, SERVICE_ORDER_STATUSES, RFQ_STATUSES, findStatusOption,
  CHANGE_REQUEST_SOURCES, CHANGE_REQUEST_STATUSES, REFUND_REQUEST_STATUSES, REFUND_CREDIT_STATUSES, INCIDENT_SEVERITIES, INCIDENT_STATUSES,
  CREDIT_NOTE_STATUSES, DEBIT_NOTE_STATUSES, SUPPLIER_INVOICE_MATCH_STATUSES, SUPPLIER_INVOICE_STATUSES,
  DOCUMENT_ACCESS_LEVELS, MESSAGE_CHANNELS, MESSAGE_DELIVERY_STATUSES, SALES_ORDER_STATUSES
} from '~/constants/status'
import { formatCurrencyIdr, formatDateRange, formatDate, formatDayLabel, formatDayBadge, formatTravelerCount, maskDocumentNumber, daysUntil } from '~/utils/format'
import { isProjectNeedingAttention, isUpcomingDeparture, isTravelerDocumentMissing, isInvoiceOverdue, isInvoiceDueSoon, isDocumentExpired, isDocumentExpiringSoon, DEMO_REFERENCE_DATE, MINIMUM_DP_PERCENT, isDpBalanceOverdue, isTaskUpcoming } from '~/utils/attention'
import type { ProjectDetailTab, Traveler, ServiceTypeKey, ServiceStatus, ItineraryItem, ProjectService } from '~/types/project'
import type { ChangeCategory, ProjectTask, ShiftPeriod } from '~/types/activity'
import type { Invoice, InvoiceMilestone, InvoiceType } from '~/types/finance'
import type { ProjectExpenseCategoryKey } from '~/types/finance-ext'
import type { MessageChannel, Document as AppDocument } from '~/types/document-comms'
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

/** Buka detail Lead asal Project sebagai overlay (Sheet), bukan navigasi ke halaman terpisah. */
const isLeadDetailSheetOpen = ref(false)

/** Inisial 2 huruf untuk avatar Tim Project (card "Ringkasan Layanan") — nama kosong/undefined dikembalikan "—" bukan string kosong (Avatar tetap terisi visual). */
function initials (name?: string): string {
  if (!name?.trim()) { return '—' }
  return name.trim().slice(0, 2).toUpperCase()
}

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

/** Kapasitas seat (Bookings tab, Group Trip) — dipisah dari 4 tahap funnel DP-gated karena maknanya beda: bukan tahap proses, tapi kapasitas/inventory yang habis dipakai tahap terakhir (Confirmed Participants). */
const seatsFilledCount = computed(() => (project.value ? getProjectSeatsFilled(project.value.id) : 0))
const seatsAvailableCount = computed(() => (project.value ? getProjectSeatsAvailable(project.value.id) : 0))
const seatsTotalCount = computed(() => seatsFilledCount.value + seatsAvailableCount.value)
const seatsFilledPercent = computed(() => (seatsTotalCount.value > 0 ? Math.round((seatsFilledCount.value / seatsTotalCount.value) * 100) : 0))

/**
 * Booking Funnel (tab Bookings, Group Trip) — 4 tahap ini SECARA HARFIAH sequential (komentar `orderRow`
 * di atas: "5 bucket sesuai flow DP-gated ... Linked/Qualified Leads (superset) → Awaiting DP (SalesOrder
 * draft) → Confirmed Bookings (bukan draft/cancelled) → Confirmed Participants (BARU ada setelah DP)"),
 * jadi digambar sebagai pipeline bersambung (bukan 5 stat tile lepas) — bar bawah tiap tahap menunjukkan
 * persentase relatif terhadap Linked Leads (tahap awal), memvisualisasikan drop-off funnel yang sesungguhnya.
 */
const BOOKING_FUNNEL_TONE_CLASSES: Record<string, { iconBg: string; icon: string; bar: string }> = {
  primary: { iconBg: 'bg-primary/10', icon: 'text-primary', bar: 'bg-primary' },
  warning: { iconBg: 'bg-warning/10', icon: 'text-warning', bar: 'bg-warning' },
  success: { iconBg: 'bg-success/10', icon: 'text-success', bar: 'bg-success' }
}
const bookingFunnelStages = computed(() => {
  const stages = [
    { key: 'leads', label: 'Linked Leads', icon: Users, tone: 'primary', count: linkedLeads.value.length },
    { key: 'awaiting-dp', label: 'Awaiting DP', icon: Wallet, tone: 'warning', count: awaitingDpRows.value.length },
    { key: 'confirmed-bookings', label: 'Confirmed Bookings', icon: CheckCircle2, tone: 'primary', count: confirmedBookingRows.value.length },
    { key: 'confirmed-participants', label: 'Confirmed Participants', icon: UserPlus, tone: 'success', count: confirmedParticipants.value.length }
  ]
  const baseline = stages[0].count || 1
  return stages.map(stage => ({
    ...stage,
    percentOfLeads: Math.min(100, Math.round((stage.count / baseline) * 100)),
    toneClasses: BOOKING_FUNNEL_TONE_CLASSES[stage.tone]
  }))
})

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

/**
 * AE-to-PM Handover accept — sebelumnya `acceptProjectHandover` (`app/data/index.ts`) tidak punya tombol
 * di halaman mana pun sejak Project Workspace lama digabung ke sini, sehingga project baru hasil "Mark as
 * Won" (selalu `handoverAcceptedAt` kosong) tidak bisa maju dari step Drafting sama sekali. Reuse gate
 * `canManageProjectOrder` yang sudah ada (PM/Super Admin, `project-order.accept-handover`).
 */
const canAcceptHandover = computed(() => Boolean(project.value && !project.value.handoverAcceptedAt && canManageProjectOrder.value))

function onAcceptHandover () {
  if (!project.value) { return }
  const updated = acceptProjectHandover(project.value.id, currentUser.value.id)
  refreshStep()
  if (updated) {
    showToast('Handover Diterima', 'Project Order sekarang bisa dilanjutkan ke tahap Drafting.', 'success')
  } else {
    showToast('Gagal', 'Handover tidak dapat diterima dari status project saat ini.', 'error')
  }
}

/**
 * Kontak Lapangan (tour leader/emergency contact/meeting point) — field ini sudah dipakai gate step
 * "Start" (`field-contacts`) dan Client Trip Center, tapi sebelumnya tidak ada form isinya sama sekali.
 * Reuse gate `canManageProjectOrder` (PM/Super Admin), sama seperti handover/team di atas.
 */
const isFieldContactsDialogOpen = ref(false)
const editTourLeaderName = ref('')
const editTourLeaderPhone = ref('')
const editEmergencyContactName = ref('')
const editEmergencyContactPhone = ref('')
const editMeetingPoint = ref('')

function openFieldContactsDialog () {
  if (!project.value) { return }
  editTourLeaderName.value = project.value.tourLeaderName ?? ''
  editTourLeaderPhone.value = project.value.tourLeaderPhone ?? ''
  editEmergencyContactName.value = project.value.emergencyContactName ?? ''
  editEmergencyContactPhone.value = project.value.emergencyContactPhone ?? ''
  editMeetingPoint.value = project.value.meetingPoint ?? ''
  isFieldContactsDialogOpen.value = true
}

/**
 * Edit Destinasi & Jadwal — sebelumnya tidak ada form buat ini sama sekali. Terutama dibutuhkan karena
 * gate step "Departure"/"On Progress" membandingkan tanggal travel terhadap `DEMO_REFERENCE_DATE`
 * (29 Juli 2026, bukan tanggal hari ini sungguhan) — Project baru dengan tanggal travel setelah itu akan
 * selalu terlihat "keberangkatan masih N hari lagi" walau tanggalnya sudah lewat di dunia nyata.
 */
const isScheduleDialogOpen = ref(false)
const editDestination = ref('')
const editTravelStartDate = ref('')
const editTravelEndDate = ref('')

function openScheduleDialog () {
  if (!project.value) { return }
  editDestination.value = project.value.destination
  editTravelStartDate.value = project.value.travelStartDate
  editTravelEndDate.value = project.value.travelEndDate
  isScheduleDialogOpen.value = true
}

function submitSchedule () {
  if (!project.value || !editTravelStartDate.value || !editTravelEndDate.value) { return }
  updateProjectSchedule(project.value.id, {
    destination: editDestination.value,
    travelStartDate: editTravelStartDate.value,
    travelEndDate: editTravelEndDate.value
  })
  refreshStep()
  isScheduleDialogOpen.value = false
  showToast('Jadwal Diperbarui', 'Destinasi dan tanggal travel berhasil disimpan.', 'success')
}

function submitFieldContacts () {
  if (!project.value) { return }
  updateProjectFieldContacts(project.value.id, {
    tourLeaderName: editTourLeaderName.value,
    tourLeaderPhone: editTourLeaderPhone.value,
    emergencyContactName: editEmergencyContactName.value,
    emergencyContactPhone: editEmergencyContactPhone.value,
    meetingPoint: editMeetingPoint.value
  })
  refreshStep()
  isFieldContactsDialogOpen.value = false
  showToast('Kontak Lapangan Disimpan', 'Tour leader dan kontak darurat berhasil diperbarui.', 'success')
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

function onUpdateMilestoneNote (payload: { milestoneId: string; note: string }) {
  updateMilestoneNote(payload.milestoneId, payload.note)
  refreshStep()
  showToast('Catatan Disimpan', 'Catatan milestone berhasil diperbarui.', 'success')
}

const party = computed(() => project.value ? getPartyById(project.value.partyId) : undefined)
/** PIC (contact person) sisi client — kontak pertama yang tercatat untuk Party ini (`CONTACTS`, `app/data/parties.ts`), ditampilkan di header project untuk memudahkan koordinasi cepat lewat WhatsApp. */
const clientPic = computed(() => (party.value ? getContactsByParty(party.value.id)[0] : undefined))
const owner = computed(() => project.value ? getUserById(project.value.ownerId) : undefined)
/** Divisi/department Owner/PIC (card "Ringkasan Layanan") — dari `Employee.department` via `Employee.userId`, bukan field baru di `User`. Kosong bila owner belum punya record HR bertaut. */
const ownerEmployee = computed(() => (owner.value ? getEmployeeByUserId(owner.value.id) : undefined))
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

function serviceLabelById (serviceId: string) {
  return services.value.find(service => service.id === serviceId)?.label ?? serviceId
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
/** "Mark Payment Cleared" langsung dari card ini (sebelumnya cuma bisa dari `/bookings`) — supaya PM/Ops tidak perlu pindah halaman buat aksi yang sering dipakai. Gate sama seperti di `/bookings` (`BookingTimelinePanel.vue`): `canManage('bookings')`. */
const canManageBookings = computed(() => canManage('bookings'))
function markBookingPaymentCleared (entry: BookingTimelineEntry) {
  setBookingPaymentGateStatus(entry.orchestrationId, 'cleared', currentUser.value.id)
  refreshStep()
  showToast('Payment Gate Diperbarui', `${BOOKING_DOMAIN_LABEL_MAP[entry.bookingType]} Booking ${entry.bookingId} kini "Lunas".`, 'success')
}

/** "Bayar" langsung dari card Supplier Invoice (AP Summary) — sebelumnya harus pindah ke Finance > Payables. */
function onPaySupplierInvoice (invoiceId: string) {
  paySupplierInvoice(invoiceId, currentUser.value.id)
  refreshStep()
  showToast('Supplier Invoice Dibayar', 'Invoice ditandai lunas dan masuk ke Actual Cost.', 'success')
}
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

/**
 * "Buat Booking" quick-create — dulu navigate keluar ke `/services?...&create=1#anchor` (per komponen panel
 * `TicketingListPanel.vue`/`AccommodationListPanel.vue`/dst), sekarang langsung jadi Sheet lokal di project
 * detail supaya user tidak pindah halaman. Satu Sheet reusable untuk 4 tipe (bukan 4 Sheet terpisah) —
 * field spesifik tipe (Ticketing Deadline/Check-in-out/Venue Name) dirender kondisional dari `bookingSheetType`.
 * Tidak ada dropdown Project (selalu `project.value.id`, sama seperti Sheet "Catat Pengeluaran"/"Buat Invoice"
 * di halaman ini) dan tidak ada dialog konfirmasi "duplicate booking" (tombol ini per tipe layanan, bukan per
 * baris `ProjectService` spesifik — sama seperti perilaku tombol lama, bukan regresi).
 */
type BookableServiceType = 'flight' | 'hotel' | 'transportation' | 'mice'
const BOOKING_SHEET_TITLE: Record<BookableServiceType, string> = {
  flight: 'Flight Booking Baru', hotel: 'Hotel Booking Baru', transportation: 'Transport Booking Baru', mice: 'MICE Event Baru'
}
const BOOKING_SHEET_DESCRIPTION: Record<BookableServiceType, string> = {
  flight: 'Dibuat sebagai status "Requested" — lengkapi options/segments/traveler assignment di halaman detail.',
  hotel: 'Dibuat sebagai status "Requested" — lengkapi options/rooming list/traveler assignment di halaman detail.',
  transportation: 'Dibuat sebagai status "Requested" — lengkapi options/legs/traveler assignment di halaman detail.',
  mice: 'Dibuat sebagai status "Planning" — lengkapi sessions/BOQ/staffing/checklist di halaman detail.'
}
/** VENDORS pakai `serviceType` string mentah ('flight'/'hotel'/'transportation'/'mice'), sudah sama persis dengan `BookableServiceType` — tidak perlu mapping tambahan. */
const isBookingSheetOpen = ref(false)
const bookingSheetType = ref<BookableServiceType>('flight')
const bookingVendorId = ref('')
const bookingTicketingDeadline = ref('')
const bookingCheckInDate = ref('')
const bookingCheckOutDate = ref('')
const bookingVenueName = ref('')

const bookingVendorOptions = computed(() => VENDORS.filter(vendor => vendor.serviceType === bookingSheetType.value && (vendor.status ?? 'active') === 'active'))

function openCreateBooking (type: ServiceTypeKey) {
  bookingSheetType.value = type as BookableServiceType
  bookingVendorId.value = ''
  bookingTicketingDeadline.value = ''
  bookingCheckInDate.value = ''
  bookingCheckOutDate.value = ''
  bookingVenueName.value = ''
  isBookingSheetOpen.value = true
}

function submitCreateBooking () {
  if (!project.value) { return }
  const projectId = project.value.id
  let bookingId: string
  let serviceId: string | undefined
  if (bookingSheetType.value === 'flight') {
    const booking = createFlightBooking({ projectId, ticketingDeadline: bookingTicketingDeadline.value || undefined })
    bookingId = booking.id
    serviceId = booking.serviceId
  } else if (bookingSheetType.value === 'hotel') {
    const booking = createHotelBooking({ projectId, checkInDate: bookingCheckInDate.value || undefined, checkOutDate: bookingCheckOutDate.value || undefined })
    bookingId = booking.id
    serviceId = booking.serviceId
  } else if (bookingSheetType.value === 'transportation') {
    const booking = createTransportBooking({ projectId })
    bookingId = booking.id
    serviceId = booking.serviceId
  } else {
    const event = createMiceEvent({ projectId, venueName: bookingVenueName.value || undefined })
    bookingId = event.id
    serviceId = event.serviceId
  }
  if (serviceId && bookingVendorId.value) { setServiceVendor(serviceId, bookingVendorId.value) }
  isBookingSheetOpen.value = false
  showToast(`${BOOKING_SHEET_TITLE[bookingSheetType.value].replace(' Baru', '')} Dibuat`, `${bookingId} tercatat — lihat "Lihat Booking" di baris layanan untuk lengkapi detail.`, 'success')
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

/** Palet avatar anggota tim non-PM/AE (card "Ringkasan Layanan") — dirotasi per index murni supaya baris tim
 * mudah dipindai sekilas, bukan penanda peran/status. PM (primary) dan AE (chart-5) tetap warna tetap di luar palet ini. */
const TEAM_AVATAR_TONE = ['bg-chart-1/15 text-chart-1', 'bg-chart-2/15 text-chart-2', 'bg-chart-3/15 text-chart-3', 'bg-chart-4/15 text-chart-4']

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
/** Warna fill solid (bukan tint /10) — dipakai progress bar "Pengeluaran per Layanan" supaya tiap tipe
 * layanan punya warna bar yang senada dengan warna icon-nya sendiri. */
const TONE_BAR_BG: Record<BadgeTone, string> = {
  neutral: 'bg-muted-foreground',
  primary: 'bg-primary',
  success: 'bg-success',
  warning: 'bg-warning',
  destructive: 'bg-destructive',
  info: 'bg-chart-5',
  purple: 'bg-chart-4'
}
/** Ring status "Ringkasan Budget Project" — 3 state (success/destructive/primary), lihat `allocationRingTone`. */
const ALLOCATION_RING_CLASS: Record<'success' | 'destructive' | 'primary', string> = {
  success: 'border-success/30 bg-success/10 text-success',
  destructive: 'border-destructive/30 bg-destructive/10 text-destructive',
  primary: 'border-primary/30 bg-primary/10 text-primary'
}
/** Class teks polos per tone — dipisah dari `ALLOCATION_RING_CLASS` (bukan interpolasi string `text-${tone}`
 * di template) supaya class Tailwind-nya tetap literal dan pasti ke-scan JIT. */
const ALLOCATION_TEXT_CLASS: Record<'success' | 'destructive' | 'primary', string> = {
  success: 'text-success',
  destructive: 'text-destructive',
  primary: 'text-primary'
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
  contract: 'purple',
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

/** Checklist ringkas card "Ringkasan Layanan" — seluruhnya angka nyata (jumlah layanan, traveler, destinasi, confirmed), bukan field per-booking (rute/kelas/kursi) yang tidak ada di level agregat `serviceScope`. */
const cakupanLayananChecklist = computed(() => project.value
  ? [
      { label: 'Total Layanan', value: `${services.value.length}x` },
      { label: 'Traveler', value: `${project.value.travelerCount} Orang` },
      { label: 'Destinasi', value: project.value.destination },
      { label: 'Siap Berangkat', value: `${serviceConfirmedTotals.value.confirmed}/${serviceConfirmedTotals.value.total}` }
    ]
  : [])

/** "Attention/exception queue" — item diklik untuk lompat ke tab terkait. */
const attentionQueue = computed(() => project.value ? getProjectAttentionQueue(project.value.id) : [])
function goToAttentionTab (tab: ProjectDetailTab) {
  activeTab.value = tab
}

/** "Lihat Semua" card "Action Required" (Overview) — pindah ke tab Itinerary & Services DAN scroll langsung ke card "Attention / Exception Queue" (pola scroll sama seperti `taskBoardRef`), supaya user tidak perlu cari-cari sendiri di tab tujuan. */
const attentionQueueSidebarRef = ref<HTMLElement | null>(null)
function goToAttentionQueue () {
  activeTab.value = 'itinerary-services'
  nextTick(() => attentionQueueSidebarRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
}
/** Sidebar kanan tab Itinerary & Services (card "Attention / Exception Queue") — kalau tidak ada isinya sama sekali, kolom utama melebar penuh (bukan menyisakan 1/3 kosong di layar lebar). */
const hasAttentionSidebarContent = computed(() => attentionQueue.value.length > 0 || (project.value?.characteristic === 'high-change' && changedServicesCount.value > 0))

/** Warna dot severity kartu "Action Required" (Overview) — sama persis tone `ATTENTION_SEVERITIES` (`~/constants/status`) dipakai `AttentionIndicator`. */
const ATTENTION_DOT_CLASS: Record<AttentionQueueItem['severity'], string> = {
  low: 'bg-chart-5', medium: 'bg-warning', high: 'bg-destructive'
}

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

/**
 * "Pengeluaran per Layanan" (Financial Snapshot, tab Finance) — breakdown budget/actual per tipe layanan,
 * reuse `visibleServiceTypes`/`servicesByType` yang sudah ada (tab Itinerary & Services) untuk grouping,
 * bukan selector baru. Angka budget/actual dari `getServiceTypeSpendBreakdown` (`app/data/finance-ext.ts`).
 */
const serviceTypeSpendRows = computed(() => {
  if (!project.value) { return [] }
  const breakdown = getServiceTypeSpendBreakdown(project.value.id)
  return visibleServiceTypes.value.map((type) => {
    const row = breakdown.find(item => item.type === type.value)
    const budgetIdr = row?.budgetIdr ?? 0
    const actualIdr = row?.actualIdr ?? 0
    return {
      type: type.value,
      label: type.label,
      budgetIdr,
      actualIdr,
      hasBudget: budgetIdr > 0,
      percent: budgetIdr > 0 ? Math.min(100, Math.round((actualIdr / budgetIdr) * 100)) : 0,
      remainingIdr: budgetIdr - actualIdr
    }
  })
})

/** Ringkasan alokasi budget project ke seluruh layanan — "Total budget project" vs "sudah dialokasikan" (sum
 * budget seluruh baris `serviceTypeSpendRows`) vs sisa yang belum dipecah ke layanan mana pun. */
const serviceBudgetAllocationSummary = computed(() => {
  const totalIdr = project.value?.budgetIdr ?? 0
  const allocatedIdr = serviceTypeSpendRows.value.reduce((sum, row) => sum + row.budgetIdr, 0)
  return { totalIdr, allocatedIdr, unallocatedIdr: totalIdr - allocatedIdr }
})
/** % dialokasikan dari total budget project — bisa >100 kalau over-alokasi, dipakai teks "Tingkat Alokasi"
 * (bar visual sendiri diclamp ke 100 lewat `Math.min` di template, angka teksnya TIDAK diclamp supaya
 * over-alokasi tetap kelihatan jelas berapa persen). */
const serviceBudgetAllocationPercent = computed(() => {
  const { totalIdr, allocatedIdr } = serviceBudgetAllocationSummary.value
  return totalIdr > 0 ? Math.round((allocatedIdr / totalIdr) * 100) : 0
})
/** Tone kartu "Ringkasan Budget Project" — destructive kalau over-alokasi, success kalau pas 100%, primary
 * kalau masih sebagian (belum ada tone "warning" di sini karena "belum full" bukan kondisi bermasalah). */
const allocationRingTone = computed<'success' | 'destructive' | 'primary'>(() => {
  if (serviceBudgetAllocationSummary.value.unallocatedIdr < 0) { return 'destructive' }
  if (serviceBudgetAllocationSummary.value.totalIdr > 0 && serviceBudgetAllocationSummary.value.unallocatedIdr === 0) { return 'success' }
  return 'primary'
})
const ALLOCATION_RING_ICON = { success: Check, destructive: AlertTriangle, primary: PieChart } as const
const ALLOCATION_STATUS_LABEL = { success: 'Fully allocated', destructive: 'Over-alokasi', primary: 'Sebagian dialokasikan' } as const

/** Edit alokasi budget per layanan — Sheet berisi seluruh baris `ProjectService` dari satu tipe (bisa lebih dari 1, mis. 2 hotel), satu `CurrencyInput` per baris, pola sama Sheet "Catat Pengeluaran". */
const isServiceBudgetDialogOpen = ref(false)
const serviceBudgetTypeLabel = ref('')
const serviceBudgetForm = ref<Record<string, number | null>>({})
function openEditServiceBudget (type: ServiceTypeKey, label: string) {
  if (!project.value) { return }
  // Belum ada booking untuk tipe ini sama sekali (kondisi normal tepat setelah project dibuat) — bikin baris
  // placeholder dulu supaya budget bisa dialokasikan di awal, sebelum booking pertama masuk.
  if (!servicesByType(type).length) { ensureProjectServiceForBudget(project.value.id, type, label) }
  serviceBudgetTypeLabel.value = label
  const form: Record<string, number | null> = {}
  for (const service of servicesByType(type)) { form[service.id] = service.budgetIdr ?? null }
  serviceBudgetForm.value = form
  isServiceBudgetDialogOpen.value = true
}
function submitServiceBudget () {
  for (const [serviceId, budgetIdr] of Object.entries(serviceBudgetForm.value)) {
    updateProjectServiceBudget(serviceId, budgetIdr ?? 0)
  }
  isServiceBudgetDialogOpen.value = false
  showToast('Budget Layanan Disimpan', `Alokasi budget ${serviceBudgetTypeLabel.value} berhasil diperbarui.`, 'success')
}

function submitCloseFinance () {
  if (!project.value) { return }
  const result = closeProjectFinance(project.value.id, currentUser.value.id)
  if (result.success) { showToast('Finance Ditutup', `Finance project ${project.value.name} berhasil ditutup.`, 'success') } else { showToast('Belum Bisa Ditutup', `${result.blockers.length} blocker masih terbuka — lihat daftar di atas.`, 'error') }
}

/** Pengeluaran Project (ad-hoc, langsung tercatat) — lihat `ProjectExpense`, `app/types/finance-ext.ts`. */
const projectExpenses = computed(() => (project.value ? getProjectExpenses(project.value.id) : []))
const projectExpensesTotalIdr = computed(() => projectExpenses.value.reduce((sum, expense) => sum + expense.amountIdr, 0))
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

function paymentsForInvoice (invoiceId: string) {
  return getPaymentsByInvoice(invoiceId)
}

/**
 * "+ Buat Invoice" (tab Finance, `ProjectInvoicesPanel`) — invoice langsung dari Project Detail, tanpa perlu
 * pindah ke modul Finance. Opsional bertermin (`milestones`) lewat template preset (`INVOICE_MILESTONE_TEMPLATES`)
 * yang tetap bisa diedit/ditambah/dihapus baris sebelum simpan — total persen wajib 100% (divalidasi juga di
 * `createInvoice`, `app/data/index.ts`, sebagai garis pertahanan kedua).
 */
const isCreateInvoiceOpen = ref(false)
const createInvoiceAmountIdr = ref<number | null>(null)
const createInvoiceLabel = ref('')
const createInvoiceType = ref<InvoiceType>('progress')
const createInvoiceDueAt = ref('')
const createInvoiceNotes = ref('')
const createInvoiceTemplateKey = ref('')
const createInvoiceMilestones = ref<{ label: string, percent: number }[]>([])

const createInvoiceMilestonesTotalPercent = computed(() => createInvoiceMilestones.value.reduce((sum, milestone) => sum + (Number(milestone.percent) || 0), 0))
const createInvoiceMilestonesValid = computed(() => createInvoiceMilestones.value.length === 0 || Math.abs(createInvoiceMilestonesTotalPercent.value - 100) < 0.01)

function openCreateInvoice () {
  if (!project.value) { return }
  createInvoiceAmountIdr.value = Math.max(project.value.quotationAmountIdr - invoiceIssuedIdr.value, 0)
  createInvoiceLabel.value = `Invoice ${project.value.name}`
  createInvoiceType.value = 'progress'
  createInvoiceDueAt.value = ''
  createInvoiceNotes.value = ''
  createInvoiceTemplateKey.value = ''
  createInvoiceMilestones.value = []
  isCreateInvoiceOpen.value = true
}

function applyInvoiceMilestoneTemplate (key: string) {
  createInvoiceTemplateKey.value = key
  const template = INVOICE_MILESTONE_TEMPLATES.find(item => item.key === key)
  createInvoiceMilestones.value = template ? template.milestones.map(milestone => ({ ...milestone })) : []
}

function addInvoiceMilestoneRow () {
  createInvoiceMilestones.value.push({ label: '', percent: 0 })
}

function removeInvoiceMilestoneRow (index: number) {
  createInvoiceMilestones.value.splice(index, 1)
}

function submitCreateInvoice () {
  if (!project.value || !createInvoiceLabel.value.trim() || !createInvoiceAmountIdr.value || !createInvoiceDueAt.value || !createInvoiceMilestonesValid.value) { return }
  const invoice = createInvoice({
    projectId: project.value.id,
    label: createInvoiceLabel.value.trim(),
    amountIdr: createInvoiceAmountIdr.value,
    currency: 'IDR',
    invoiceType: createInvoiceType.value,
    dueAt: createInvoiceDueAt.value,
    notes: createInvoiceNotes.value.trim() || undefined,
    milestones: createInvoiceMilestones.value.length > 0
      ? createInvoiceMilestones.value.map(milestone => ({ label: milestone.label, percent: Number(milestone.percent) || 0 }))
      : undefined
  })
  if (!invoice) {
    showToast('Gagal Membuat Invoice', 'Periksa kembali label, jumlah, jatuh tempo, dan total persen milestone (harus 100%).', 'error')
    return
  }
  isCreateInvoiceOpen.value = false
  showToast('Invoice Dibuat', `${invoice.id} tercatat berstatus "Belum Dibayar".`, 'success')
}

/** "Record Payment" (tab Finance, `ProjectInvoicesPanel`) — dibuka dari kartu invoice, opsional menargetkan satu milestone spesifik (invoice bertermin). */
const isRecordPaymentOpen = ref(false)
const recordPaymentInvoice = ref<Invoice | null>(null)
const recordPaymentMilestoneId = ref('')
const recordPaymentAmountIdr = ref<number | null>(null)
const recordPaymentPayFull = ref(false)
const recordPaymentMethod = ref('bank-transfer')
const recordPaymentDate = ref('')
const recordPaymentReference = ref('')

const recordPaymentOutstandingIdr = computed(() => {
  if (!recordPaymentInvoice.value) { return 0 }
  return recordPaymentMilestoneId.value
    ? getInvoiceMilestoneOutstandingIdr(recordPaymentInvoice.value.id, recordPaymentMilestoneId.value)
    : getInvoiceOutstandingIdr(recordPaymentInvoice.value.id)
})

function openRecordPayment (invoice: Invoice, milestone?: InvoiceMilestone) {
  recordPaymentInvoice.value = invoice
  const firstUnpaidMilestone = invoice.milestones?.find(item => getInvoiceMilestoneOutstandingIdr(invoice.id, item.id) > 0)
  recordPaymentMilestoneId.value = milestone?.id ?? firstUnpaidMilestone?.id ?? ''
  recordPaymentPayFull.value = false
  recordPaymentAmountIdr.value = null
  recordPaymentMethod.value = 'bank-transfer'
  recordPaymentDate.value = DEMO_REFERENCE_DATE
  recordPaymentReference.value = ''
  isRecordPaymentOpen.value = true
}

watch([recordPaymentPayFull, recordPaymentMilestoneId], () => {
  if (recordPaymentPayFull.value) { recordPaymentAmountIdr.value = recordPaymentOutstandingIdr.value }
})

function submitRecordPayment () {
  if (!recordPaymentInvoice.value || !recordPaymentAmountIdr.value || recordPaymentAmountIdr.value <= 0 || !recordPaymentDate.value) { return }
  const payment = recordPayment({
    invoiceId: recordPaymentInvoice.value.id,
    amountIdr: recordPaymentAmountIdr.value,
    recordedBy: currentUser.value.id,
    method: recordPaymentMethod.value || undefined,
    milestoneId: recordPaymentMilestoneId.value || undefined,
    reference: recordPaymentReference.value.trim() || undefined,
    receivedAt: recordPaymentDate.value
  })
  isRecordPaymentOpen.value = false
  if (payment) {
    showToast('Payment Dicatat', `${payment.id} sebesar ${formatCurrencyIdr(payment.amountIdr)} tercatat.`, 'success')
  } else {
    showToast('Gagal Mencatat Payment', 'Invoice/milestone tidak eligible menerima payment (sudah lunas/void) atau jumlah tidak valid.', 'error')
  }
}
const tasks = computed(() => project.value ? getTasksByProject(project.value.id) : [])
/** Stat ringkas tab Overview — 'done' adalah key status task yang sudah completed (`TASK_STATUSES`). */
const tasksDoneCount = computed(() => tasks.value.filter(task => task.status === 'done').length)

/** "Task Overview" (tab Tasks) — 4 tile ringkasan (To Do/In Progress/Waiting/Done), murni derivasi dari `tasks`; `overdue` sendiri tetap terwakili sebagai kolom kelima di Kanban board, tidak jadi tile ringkasan terpisah. */
const TASK_OVERVIEW_TILE_DEFS = [
  { key: 'not-started', label: 'To Do', subtitle: 'Belum dikerjakan', icon: List, tone: 'primary' },
  { key: 'in-progress', label: 'In Progress', subtitle: 'Sedang dikerjakan', icon: CircleDashed, tone: 'info' },
  { key: 'pending-confirmation', label: 'Waiting / On Hold', subtitle: 'Menunggu / Ditunda', icon: Clock, tone: 'warning' },
  { key: 'done', label: 'Done', subtitle: 'Selesai', icon: CheckCircle2, tone: 'success' }
] as const
const TASK_TILE_TONE_CLASSES: Record<string, { iconBg: string; icon: string; badge: string; bar: string; solid: string; bgSoft: string; border: string }> = {
  primary: { iconBg: 'bg-primary/10', icon: 'text-primary', badge: 'bg-primary/10 text-primary', bar: 'bg-primary', solid: 'bg-primary text-primary-foreground', bgSoft: 'bg-primary/[0.06]', border: 'border-primary/20' },
  info: { iconBg: 'bg-chart-5/10', icon: 'text-chart-5', badge: 'bg-chart-5/10 text-chart-5', bar: 'bg-chart-5', solid: 'bg-chart-5 text-white', bgSoft: 'bg-chart-5/[0.06]', border: 'border-chart-5/20' },
  warning: { iconBg: 'bg-warning/10', icon: 'text-warning', badge: 'bg-warning/10 text-warning', bar: 'bg-warning', solid: 'bg-warning text-warning-foreground', bgSoft: 'bg-warning/[0.06]', border: 'border-warning/20' },
  success: { iconBg: 'bg-success/10', icon: 'text-success', badge: 'bg-success/10 text-success', bar: 'bg-success', solid: 'bg-success text-success-foreground', bgSoft: 'bg-success/[0.06]', border: 'border-success/20' },
  destructive: { iconBg: 'bg-destructive/10', icon: 'text-destructive', badge: 'bg-destructive/10 text-destructive', bar: 'bg-destructive', solid: 'bg-destructive text-destructive-foreground', bgSoft: 'bg-destructive/[0.06]', border: 'border-destructive/20' }
}
/** Icon per kolom Kanban (Tasks Kanban Board) — mencakup seluruh 5 `TASK_STATUSES` (4 tile di atas + Overdue, yang di tab ini murni jadi kolom kelima, bukan tile ringkasan tersendiri). */
const TASK_COLUMN_ICON: Record<string, Component> = {
  'not-started': List,
  'in-progress': CircleDashed,
  'pending-confirmation': Clock,
  done: CheckCircle2,
  overdue: AlertTriangle
}
const TASK_COLUMN_TONE: Record<string, string> = {
  'not-started': 'primary',
  'in-progress': 'info',
  'pending-confirmation': 'warning',
  done: 'success',
  overdue: 'destructive'
}
const taskOverviewTiles = computed(() => TASK_OVERVIEW_TILE_DEFS.map((def) => {
  const count = tasks.value.filter(task => task.status === def.key).length
  const percent = tasks.value.length > 0 ? Math.round((count / tasks.value.length) * 100) : 0
  return { ...def, count, percent, toneClasses: TASK_TILE_TONE_CLASSES[def.tone] }
}))
/** "Task Due Soon" — reuse `isTaskUpcoming` (window H+14, sudah ada untuk widget dashboard PM), diurutkan due date terdekat dulu. */
const tasksDueSoon = computed(() => tasks.value
  .filter(task => isTaskUpcoming(task))
  .sort((a, b) => (a.dueAt ?? '').localeCompare(b.dueAt ?? '')))
/** Dot merah untuk task due soon yang sangat mepet (H-3) — hijau/oranye tetap dianggap "cukup waktu", pola sama urgency tiering di komponen lain (bukan threshold baru). */
function isTaskDueVerySoon (task: ProjectTask): boolean {
  return !!task.dueAt && daysUntil(task.dueAt, DEMO_REFERENCE_DATE) <= 3
}

function handleTaskColumnMenu (status: { label: string }) {
  showToast('Menu (Mock)', `Aksi kolom "${status.label}" — kelola urutan/warna kolom lengkap di modul Tasks.`, 'info')
}

/** "Tasks Kanban Board" — SELALU tampil di bawah "Task Overview" (bukan lagi progressive disclosure). Klik
 * tile status di atas, atau dropdown Filter di header board, menyaring kolom yang ditampilkan; klik tile yang
 * sama dua kali (atau "Lihat Semua") mengembalikan ke 5 kolom penuh. */
const taskBoardStatusFilter = ref<string | null>(null)
const taskBoardRef = ref<HTMLElement | null>(null)
function toggleTaskStatusTile (statusKey: string) {
  taskBoardStatusFilter.value = taskBoardStatusFilter.value === statusKey ? null : statusKey
  nextTick(() => taskBoardRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
}
function showAllTasks () {
  taskBoardStatusFilter.value = null
  nextTick(() => taskBoardRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
}
const visibleTaskStatuses = computed(() => taskBoardStatusFilter.value
  ? TASK_STATUSES.filter(status => status.value === taskBoardStatusFilter.value)
  : TASK_STATUSES)

/** Badge tone/label untuk "Task Progress Timeline" — pola sama `STATUS_META` di `ProjectOrderTimelineTracking.vue` (tidak diimpor karena komponen itu terikat ke tabel/gantt, bukan stepper horizontal). */
const TASK_TIMELINE_STATUS_META: Record<string, { label: string; tone: BadgeTone }> = {
  'not-started': { label: 'Belum Mulai', tone: 'neutral' },
  'in-progress': { label: 'Berjalan', tone: 'info' },
  completed: { label: 'Selesai', tone: 'success' },
  delayed: { label: 'Terlambat', tone: 'destructive' },
  cancelled: { label: 'Dibatalkan', tone: 'neutral' }
}
/** Section 21 (D-078) — union `Document` baru + `ProjectDocument` legacy, dipakai tab "Documents" yang diperkaya (category/version/expiry/access level). */
const unifiedDocuments = computed(() => project.value ? getDocumentsForProject(project.value.id) : [])
/** Toggle List/Grid ala Google Drive untuk tab Documents — preferensi tampilan saja, tidak memengaruhi data. */
const documentsViewMode = ref<'list' | 'grid'>('grid')
function handleDownloadDocument (document: { name: string }) {
  showToast('Download (Mock)', `${document.name} — simulasi unduhan, tidak ada file nyata (D-006).`, 'info')
}
function handleDocumentMenu (document: { name: string }) {
  showToast('Menu (Mock)', `Aksi lain untuk "${document.name}" — kelola versi/hapus lengkap di Documents & Communication.`, 'info')
}

/** Search + filter (kategori/access level/expiry) untuk tab Documents — murni client-side derivasi dari `unifiedDocuments`, tidak ada selector baru di data layer. */
const documentSearchQuery = ref('')
const documentCategoryFilter = ref('all')
const documentAccessLevelFilter = ref('all')
const documentExpiryFilter = ref<'all' | 'none' | 'expiring-soon' | 'expired'>('all')
const documentCategoryOptions = computed(() => [...new Set(unifiedDocuments.value.map(document => document.category))].sort())
const filteredDocuments = computed(() => unifiedDocuments.value.filter((document) => {
  if (documentSearchQuery.value.trim() && !document.name.toLowerCase().includes(documentSearchQuery.value.trim().toLowerCase())) { return false }
  if (documentCategoryFilter.value !== 'all' && document.category !== documentCategoryFilter.value) { return false }
  if (documentAccessLevelFilter.value !== 'all' && document.accessLevel !== documentAccessLevelFilter.value) { return false }
  if (documentExpiryFilter.value === 'none' && document.expiresAt) { return false }
  if (documentExpiryFilter.value === 'expiring-soon' && !(document.expiresAt && isDocumentExpiringSoon(document.expiresAt))) { return false }
  if (documentExpiryFilter.value === 'expired' && !(document.expiresAt && isDocumentExpired(document.expiresAt))) { return false }
  return true
}))
/** Pagination (5/halaman, pola "Menampilkan X-Y dari Z") — reset ke halaman 1 setiap kali search/filter berubah. */
const DOCUMENTS_PAGE_SIZE = 5
const documentsCurrentPage = ref(1)
watch([documentSearchQuery, documentCategoryFilter, documentAccessLevelFilter, documentExpiryFilter], () => { documentsCurrentPage.value = 1 })
const documentsTotalPages = computed(() => Math.max(1, Math.ceil(filteredDocuments.value.length / DOCUMENTS_PAGE_SIZE)))
const paginatedDocuments = computed(() => {
  const start = (documentsCurrentPage.value - 1) * DOCUMENTS_PAGE_SIZE
  return filteredDocuments.value.slice(start, start + DOCUMENTS_PAGE_SIZE)
})
function documentUploaderName (document: AppDocument) {
  return document.uploadedBy ? (getUserById(document.uploadedBy)?.name ?? document.uploadedBy) : '—'
}
function documentUploadedDate (document: AppDocument) {
  const isoDate = document.uploadedAt ?? document.generatedAt
  return isoDate ? formatDate(isoDate) : '—'
}

/** "+ Upload Document" — pola sama Sheet create lain di halaman ini (task/expense/shift note), reuse `createDocument` (`app/data/index.ts`) yang sudah ada, bukan mutator baru. */
const isDocumentUploadDialogOpen = ref(false)
const documentUploadForm = ref({ name: '', category: '', accessLevel: 'internal' as AppDocument['accessLevel'], expiresAt: '' })
function openUploadDocument () {
  documentUploadForm.value = { name: '', category: '', accessLevel: 'internal', expiresAt: '' }
  isDocumentUploadDialogOpen.value = true
}
function submitUploadDocument () {
  if (!project.value || !documentUploadForm.value.name.trim() || !documentUploadForm.value.category.trim()) { return }
  createDocument({
    entityType: 'project',
    entityId: project.value.id,
    projectId: project.value.id,
    name: documentUploadForm.value.name.trim(),
    category: documentUploadForm.value.category.trim(),
    accessLevel: documentUploadForm.value.accessLevel,
    expiresAt: documentUploadForm.value.expiresAt || undefined,
    uploadedBy: currentUser.value.id
  })
  isDocumentUploadDialogOpen.value = false
  refreshStep()
  showToast('Dokumen Diunggah', `${documentUploadForm.value.name} berhasil ditambahkan (mock, bukan file storage nyata).`, 'success')
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

/**
 * Tugaskan Vendor langsung dari tab Vendors project ini — sebelumnya vendor cuma bisa ditugaskan lewat
 * form Edit booking (tanpa nominal, invoice yang otomatis dibuat jadi Rp 0) atau lewat halaman Vendor
 * Detail terpisah (submit quotation) + balik lagi ke sini buat Terima. Dialog ini gabungin dua-duanya jadi
 * satu langkah: kalau nominal diisi, submit quotation lalu langsung diterima (`acceptVendorQuotation` yang
 * juga men-set service Confirmed) — invoice otomatis kebuat dengan nominal yang benar sejak awal. Kalau
 * nominal dikosongkan, cuma assign vendor (`setServiceVendor`) tanpa mengubah status service.
 */
const isAssignVendorDialogOpen = ref(false)
const assignVendorService = ref<ProjectService | null>(null)
const assignVendorId = ref('')
const assignVendorAmountIdr = ref<number | null>(null)

const assignVendorOptions = computed(() => (
  assignVendorService.value
    ? VENDORS.filter(vendor => vendor.serviceType === assignVendorService.value!.type && (vendor.status ?? 'active') === 'active')
    : []
))

function openAssignVendorDialog (service: ProjectService) {
  assignVendorService.value = service
  assignVendorId.value = ''
  assignVendorAmountIdr.value = null
  isAssignVendorDialogOpen.value = true
}

function submitAssignVendor () {
  const service = assignVendorService.value
  if (!service || !assignVendorId.value) { return }
  const vendorName = getVendorById(assignVendorId.value)?.name ?? assignVendorId.value

  assignServiceVendor(service.id, assignVendorId.value, assignVendorAmountIdr.value ?? undefined)

  if (assignVendorAmountIdr.value && assignVendorAmountIdr.value > 0) {
    showToast('Vendor Ditugaskan', `${vendorName} ditugaskan untuk "${service.label}" — layanan langsung Confirmed dan Supplier Invoice terbentuk senilai ${formatCurrencyIdr(assignVendorAmountIdr.value)}.`, 'success')
  } else {
    showToast('Vendor Ditugaskan', `${vendorName} ditugaskan untuk "${service.label}".`, 'success')
  }
  refreshStep()
  isAssignVendorDialogOpen.value = false
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

/** Scroll ke card "Riwayat Aktivitas" (pola sama `taskBoardRef`/`attentionQueueSidebarRef`) — dipanggil dari tombol "Lihat Semua" (card "Aktivitas Terbaru") dan "Lihat Activity & Changes" (card "Attention / Exception Queue"), supaya posisi scroll ikut lompat ke section-nya, bukan cuma pindah tab lalu diam di posisi scroll lama. */
const activityHistoryRef = ref<HTMLElement | null>(null)
function goToActivityTab () {
  activeTab.value = 'activity-changes'
  nextTick(() => activityHistoryRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
}

/* Travelers tab (Section 11 lama + Section 11 baru "Traveler dan Travel Documents") — filter/search/CRUD state. */

const roomAssignments = computed(() => project.value ? getRoomAssignments(project.value.id) : [])
/** "Readiness indicator" (Section 11 baru) — DIRIVASI, lihat `getTravelerReadiness` (`app/data/index.ts`). */
const travelerReadiness = computed(() => project.value ? getTravelerReadiness(project.value.id) : undefined)
/** 3 metrik checklist (Dokumen/Verifikasi/Rooming) untuk stat tile tab Travelers — dipetakan dari `travelerReadiness` sekali di sini, bukan dihitung ulang per card di template. */
const travelerReadinessSteps = computed(() => {
  const readiness = travelerReadiness.value
  if (!readiness || readiness.total <= 0) { return [] }
  return [
    { key: 'documents', label: 'Dokumen Lengkap', icon: FileText, tone: 'primary' as const, count: readiness.documentsCompleteCount },
    { key: 'verified', label: 'Terverifikasi', icon: CheckCircle2, tone: 'success' as const, count: readiness.verifiedCount },
    { key: 'rooming', label: 'Rooming Ditugaskan', icon: Users, tone: 'purple' as const, count: readiness.roomingAssignedCount }
  ]
})

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
                class="group relative flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-primary/10 text-primary ring-1 ring-border"
                @click="openPhotoPicker"
              >
                <img v-if="project.photoUrl" :src="project.photoUrl" alt="" class="h-full w-full object-cover">
                <MapPin v-else class="h-9 w-9" />
                <span class="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                  <ImagePlus class="h-6 w-6 text-white" />
                </span>
              </button>
            </template>
            <div v-else class="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <MapPin class="h-6 w-6" />
            </div>
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <h1 class="truncate text-lg font-semibold text-foreground">
                  {{ project.name }}
                </h1>
                <StatusBadge :label="findStatusOption(PROJECT_STATUSES, project.status).label" :tone="findStatusOption(PROJECT_STATUSES, project.status).tone" />
                <StatusBadge v-if="needsAttention" label="Perlu Perhatian" tone="warning" />
              </div>
              <p class="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                {{ project.destination }} · {{ formatDateRange(project.travelStartDate, project.travelEndDate) }}
                <button v-if="canManageProjectOrder" type="button" title="Edit destinasi & jadwal" class="text-muted-foreground hover:text-primary" @click="openScheduleDialog">
                  <Pencil class="h-3 w-3" />
                </button>
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
          <Button v-if="canAcceptHandover" size="sm" variant="outline" class="shrink-0" @click="onAcceptHandover">
            Terima Handover
          </Button>
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

      <Dialog v-model:open="isScheduleDialogOpen">
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Destinasi & Jadwal</DialogTitle>
            <DialogDescription>
              Tanggal travel dipakai gate step "Departure"/"On Progress" — dibandingkan terhadap tanggal acuan demo ({{ formatDate(DEMO_REFERENCE_DATE) }}), bukan tanggal hari ini sungguhan.
            </DialogDescription>
          </DialogHeader>
          <div class="space-y-4 py-2">
            <div class="space-y-1.5">
              <Label for="edit-destination">Destinasi</Label>
              <Input id="edit-destination" v-model="editDestination" placeholder="mis. Kuala Lumpur, Malaysia" />
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div class="space-y-1.5">
                <Label for="edit-travel-start">Tanggal Berangkat</Label>
                <Input id="edit-travel-start" v-model="editTravelStartDate" type="date" />
              </div>
              <div class="space-y-1.5">
                <Label for="edit-travel-end">Tanggal Pulang</Label>
                <Input id="edit-travel-end" v-model="editTravelEndDate" type="date" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" @click="isScheduleDialogOpen = false">
              Batal
            </Button>
            <Button @click="submitSchedule">
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Tabs v-model="activeTab">
        <TabsList>
          <TabsTrigger v-for="tab in TABS" :key="tab.value" :value="tab.value">
            {{ tab.label }}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div class="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:items-start">
            <div class="space-y-4 lg:col-span-2">
              <SectionCard v-if="project.isGroupTrip" compact titleClass="text-sm font-bold normal-case tracking-normal text-foreground" title="Kapasitas Group Trip">
                <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <StatsCard title="Seat Terisi" :value="`${getProjectSeatsFilled(project.id)} / ${project.travelerCount}`" :icon="Users" />
                  <StatsCard title="Destinasi" :value="project.destination" :icon="MapPin" />
                  <StatsCard title="Jadwal" :value="formatDateRange(project.travelStartDate, project.travelEndDate)" :icon="CalendarRange" />
                </div>
              </SectionCard>

              <!-- Stat ringkas (padat, angka besar + label kecil) — teaser, detail lengkap tetap di card di bawahnya. -->
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
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

              <!-- Kontak Lapangan (tour leader/emergency contact/meeting point) — sebelumnya cuma bisa diisi lewat fixture data, dibutuhkan gate step "Start" (field-contacts) dan Client Trip Center. -->
              <SectionCard compact titleClass="text-sm font-bold normal-case tracking-normal text-foreground" title="Kontak Lapangan">
                <template v-if="canManageProjectOrder" #actions>
                  <Button size="sm" variant="outline" @click="openFieldContactsDialog">
                    <Pencil class="h-3.5 w-3.5 mr-1.5" />Edit
                  </Button>
                </template>
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                  <div>
                    <p class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      Tour Leader
                    </p>
                    <p class="mt-0.5 font-medium text-foreground">
                      {{ project.tourLeaderName ?? 'Belum ditugaskan' }}
                    </p>
                    <p v-if="project.tourLeaderPhone" class="text-xs text-muted-foreground">
                      {{ project.tourLeaderPhone }}
                    </p>
                  </div>
                  <div>
                    <p class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      Kontak Darurat
                    </p>
                    <p class="mt-0.5 font-medium text-foreground">
                      {{ project.emergencyContactName ?? 'Belum diisi' }}
                    </p>
                    <p v-if="project.emergencyContactPhone" class="text-xs text-muted-foreground">
                      {{ project.emergencyContactPhone }}
                    </p>
                  </div>
                  <div>
                    <p class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      Meeting Point
                    </p>
                    <p class="mt-0.5 font-medium text-foreground">
                      {{ project.meetingPoint ?? 'Belum diisi' }}
                    </p>
                  </div>
                </div>
              </SectionCard>

              <Dialog v-model:open="isFieldContactsDialogOpen">
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Edit Kontak Lapangan</DialogTitle>
                    <DialogDescription>Tour leader dan kontak darurat 24 jam untuk project ini — dibutuhkan sebelum status bisa maju ke step "Start".</DialogDescription>
                  </DialogHeader>
                  <div class="space-y-4 py-2">
                    <div class="grid grid-cols-2 gap-3">
                      <div class="space-y-1.5">
                        <Label for="edit-tour-leader-name">Nama Tour Leader</Label>
                        <Input id="edit-tour-leader-name" v-model="editTourLeaderName" placeholder="mis. Arif Setiawan" />
                      </div>
                      <div class="space-y-1.5">
                        <Label for="edit-tour-leader-phone">No. HP Tour Leader</Label>
                        <Input id="edit-tour-leader-phone" v-model="editTourLeaderPhone" placeholder="mis. 0812-7000-1001" />
                      </div>
                    </div>
                    <div class="grid grid-cols-2 gap-3">
                      <div class="space-y-1.5">
                        <Label for="edit-emergency-name">Nama Kontak Darurat</Label>
                        <Input id="edit-emergency-name" v-model="editEmergencyContactName" placeholder="mis. Manova 24/7 Operations" />
                      </div>
                      <div class="space-y-1.5">
                        <Label for="edit-emergency-phone">No. HP Kontak Darurat</Label>
                        <Input id="edit-emergency-phone" v-model="editEmergencyContactPhone" placeholder="mis. +62 21 5000 1188" />
                      </div>
                    </div>
                    <div class="space-y-1.5">
                      <Label for="edit-meeting-point">Meeting Point</Label>
                      <Input id="edit-meeting-point" v-model="editMeetingPoint" placeholder="mis. Terminal 3 Bandara Soekarno-Hatta" />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" @click="isFieldContactsDialogOpen = false">
                      Batal
                    </Button>
                    <Button @click="submitFieldContacts">
                      Simpan
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <!-- Ringkasan Komersial — separuh lebar (bukan edge-to-edge), ditaruh di bawah 4 stat card di atas. Kolom di-stretch (bukan items-start lagi) supaya "Action Required" saat kosong ikut setinggi Ringkasan Komersial, bukan terlihat terpotong pendek sendirian. -->
              <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <ProjectCommercialHero
                  v-if="canViewFinancials"
                  :quotation-amount-idr="project.quotationAmountIdr"
                  :invoice-issued-idr="invoiceIssuedIdr"
                  :paid-idr="collectedIdr"
                  :outstanding-idr="projectOutstandingIdr"
                  :next-payment="nextPaymentForHero"
                  :has-any-invoice="invoices.length > 0"
                />
                <div v-else class="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                  titleClass="text-sm font-bold normal-case tracking-normal text-foreground"
                  title="Action Required"
                  :description="`${attentionQueue.length} item butuh perhatian`"
                >
                  <div class="space-y-1">
                    <button
                      v-for="(item, index) in attentionQueue.slice(0, 4)"
                      :key="index"
                      type="button"
                      class="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-muted/60"
                      @click="goToAttentionTab(item.tab)"
                    >
                      <span class="h-1.5 w-1.5 shrink-0 rounded-full" :class="ATTENTION_DOT_CLASS[item.severity]" />
                      <span class="min-w-0 flex-1 truncate text-xs text-foreground">{{ item.message }}</span>
                      <ChevronRight class="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    </button>
                  </div>
                  <Button size="sm" variant="outline" class="mt-2 w-full" @click="goToAttentionQueue">
                    Lihat Semua ({{ attentionQueue.length }})
                  </Button>
                </SectionCard>
                <SectionCard
                  v-else
                  compact
                  titleClass="text-sm font-bold normal-case tracking-normal text-foreground"
                  title="Action Required"
                  description="Tidak ada item yang butuh perhatian saat ini."
                  class="flex h-full flex-col"
                  content-class="flex flex-1 flex-col items-center justify-center text-center"
                >
                  <div class="flex h-10 w-10 items-center justify-center rounded-full bg-success/10">
                    <CheckCircle2 class="h-5 w-5 text-success" />
                  </div>
                  <p class="mt-2 text-sm font-semibold text-foreground">
                    Semua beres — tidak ada item mendesak.
                  </p>
                </SectionCard>
              </div>

            </div>

            <!-- Sidebar kanan Overview — Cakupan Layanan/Nilai Project/Tim Project ditumpuk vertikal sebagai 3 card terpisah (dulu satu card dibagi 3 kolom horizontal), supaya sejajar dengan pola sidebar kanan tab Itinerary & Services. -->
            <div class="space-y-4">
              <SectionCard compact titleClass="text-sm font-bold normal-case tracking-normal text-foreground" title="Cakupan Layanan">
                <div class="flex flex-wrap gap-1.5">
                  <StatusBadge
                    :label="findStatusOption(PROJECT_STATUSES, project.status).label"
                    :tone="findStatusOption(PROJECT_STATUSES, project.status).tone"
                    dot
                    size="md"
                  />
                  <StatusBadge
                    v-if="departureReadiness"
                    :label="departureReadiness.isReady ? 'Ready to Depart' : 'Belum Siap'"
                    :tone="departureReadiness.isReady ? 'success' : 'warning'"
                    dot
                    size="md"
                  />
                </div>

                <div class="mt-2.5 flex flex-wrap gap-1.5">
                  <div
                    v-for="type in SERVICE_TYPES.filter(t => project.serviceScope.includes(t.value))"
                    :key="type.value"
                    class="inline-flex items-center gap-1.5 rounded-full py-1 pl-1 pr-2.5"
                    :class="TONE_ICON_BG[type.tone]"
                  >
                    <span class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-card">
                      <component :is="SERVICE_TYPE_ICON[type.value]" class="h-3 w-3" />
                    </span>
                    <span class="text-xs font-medium">{{ type.label }}</span>
                  </div>
                </div>

                <ul class="mt-2.5 space-y-1.5 border-t border-border pt-2.5">
                  <li v-for="row in cakupanLayananChecklist" :key="row.label" class="flex items-center justify-between gap-3 text-sm">
                    <span class="flex items-center gap-2 text-muted-foreground">
                      <CheckCircle2 class="h-3.5 w-3.5 shrink-0 text-primary" />{{ row.label }}
                    </span>
                    <span class="font-medium text-foreground">{{ row.value }}</span>
                  </li>
                </ul>
              </SectionCard>

              <SectionCard compact titleClass="text-sm font-bold normal-case tracking-normal text-foreground" title="Nilai Project">
                <p class="text-2xl font-bold tabular-nums text-foreground">
                  {{ formatCurrencyIdr(project.quotationAmountIdr) }}
                </p>
                <button
                  v-if="project.leadId"
                  type="button"
                  class="mt-1.5 inline-flex items-center gap-1 rounded-md border border-primary/25 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary transition-colors hover:bg-primary/20"
                  @click="isLeadDetailSheetOpen = true"
                >
                  Dari {{ project.leadId }}
                </button>

                <div class="mt-3 flex items-start gap-2.5 border-t border-dashed border-border pt-3">
                  <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-success/10 text-success">
                    <User class="h-4 w-4" />
                  </div>
                  <div class="min-w-0">
                    <p class="text-[11px] font-semibold uppercase tracking-wide text-success">
                      Owner / PIC
                    </p>
                    <p class="truncate text-sm font-semibold text-foreground">
                      {{ owner?.name ?? '—' }}
                    </p>
                    <p v-if="ownerEmployee?.department" class="text-xs text-muted-foreground">
                      {{ ownerEmployee.department }}
                    </p>
                  </div>
                </div>
              </SectionCard>

              <SectionCard compact titleClass="text-sm font-bold normal-case tracking-normal text-foreground" title="Tim Project">
                <template v-if="canManageProjectOrder" #actions>
                  <Sheet v-model:open="isTeamDialogOpen">
                    <SheetTrigger as-child>
                      <button type="button" class="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/20">
                        <Plus class="h-3 w-3" />Tambah
                      </button>
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
                </template>

                <div class="space-y-2">
                  <div class="flex items-center gap-2.5">
                    <Avatar class="h-9 w-9 shrink-0">
                      <AvatarFallback class="bg-primary/15 text-xs font-semibold text-primary">
                        {{ initials(owner?.name) }}
                      </AvatarFallback>
                    </Avatar>
                    <p class="min-w-0 truncate text-sm">
                      <span class="font-medium text-foreground">{{ owner?.name ?? '—' }}</span> <span class="text-muted-foreground">· PM</span>
                    </p>
                  </div>
                  <div class="flex items-center gap-2.5">
                    <Avatar class="h-9 w-9 shrink-0">
                      <AvatarFallback class="bg-chart-5/15 text-xs font-semibold text-chart-5">
                        {{ initials(accountExecutive?.name) }}
                      </AvatarFallback>
                    </Avatar>
                    <p class="min-w-0 truncate text-sm">
                      <span class="font-medium text-foreground">{{ accountExecutive?.name ?? '—' }}</span> <span class="text-muted-foreground">· AE</span>
                    </p>
                  </div>
                </div>

                <!-- `team` panjangnya tidak dibatasi (bisa nambah anggota tanpa batas) — dibungkus scroll dengan tinggi tetap supaya card ini tidak ikut memanjang mengikuti jumlah anggota, PM/AE di atas tetap selalu terlihat. -->
                <div
                  v-if="team.length"
                  class="-mr-1 mt-2 max-h-[152px] space-y-2 overflow-y-auto border-t border-border pr-1 pt-2"
                >
                  <div v-for="(member, index) in team" :key="member.id" class="group flex items-center gap-2.5">
                    <Avatar class="h-9 w-9 shrink-0">
                      <AvatarFallback class="text-xs font-semibold" :class="TEAM_AVATAR_TONE[index % TEAM_AVATAR_TONE.length]">
                        {{ initials(member.name) }}
                      </AvatarFallback>
                    </Avatar>
                    <p class="min-w-0 flex-1 truncate text-sm">
                      <span class="font-medium text-foreground">{{ member.name }}</span> <span class="text-muted-foreground">· {{ member.role }}</span>
                    </p>
                    <button
                      v-if="canManageProjectOrder"
                      type="button"
                      class="shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                      title="Hapus dari tim"
                      @click="submitRemoveTeamMember(member.id)"
                    >
                      ×
                    </button>
                  </div>
                </div>
              </SectionCard>
            </div>
          </div>

          <!-- Peta Lokasi (dipindah dari header — header sekarang identitas murni) + Kesiapan Layanan (breakdown bar, versi ringkas dari tabel "Service Readiness Matrix" tab Itinerary & Services). Full-width di luar grid 3-kolom (pola sama Timeline Tracking) — di dalam kolom kiri 2/3 baris ini jatuh jauh di bawah sidebar kanan yang jauh lebih pendek, menyisakan area kosong di sebelah kanannya. -->
          <div class="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
            <SectionCard compact titleClass="text-sm font-bold normal-case tracking-normal text-foreground" title="Peta Lokasi" :class="serviceReadinessMatrix.length === 0 ? 'lg:col-span-2' : ''">
              <DestinationMap :geo="project.destinationGeo" :destination-text="project.destination" show-route />
            </SectionCard>

            <SectionCard v-if="serviceReadinessMatrix.length > 0" compact titleClass="text-sm font-bold normal-case tracking-normal text-foreground" title="Kesiapan Layanan" description="Agregat Confirmed/Completed per tipe layanan.">
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
            class="mt-4"
            :project-id="project.id"
            :milestones="milestones"
            :can-manage="canManageOperations"
            :planned-dates-locked="plannedDatesLocked"
            @mark-actual="onMarkMilestoneActual"
            @update-planned="onUpdateMilestonePlanned"
            @update-note="onUpdateMilestoneNote"
          />
        </TabsContent>

        <TabsContent value="itinerary-services">
          <div class="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:items-start">
            <div class="space-y-4 lg:col-span-2">
              <!-- Departure Readiness Gate (Section 12 baru) -->
              <SectionCard
                v-if="departureReadiness"
                compact
                titleClass="text-sm font-bold normal-case tracking-normal text-foreground"
                title="Departure Readiness Gate"
                description="Ringkasan kesiapan lintas-domain sebelum keberangkatan — advisory, tidak memblokir transisi status."
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

              <!-- Progress Readiness (donut, dibesarkan biar isi card padat tanpa duplikasi angka yang sudah ada di 4 StatsCard "Departure Readiness Gate" di atas) + Alasan Belum Siap & Countdown Keberangkatan (satu card, dipisah divider — bukan diduplikasi). items-start supaya card yang lebih pendek tidak di-stretch mengikuti tinggi sibling-nya. -->
              <div v-if="departureReadiness" class="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:items-start">
                <SectionCard compact titleClass="text-sm font-bold normal-case tracking-normal text-foreground" title="Progress Readiness" content-class="flex flex-col items-center py-2 text-center">
                  <div class="relative flex h-40 w-40 shrink-0 items-center justify-center">
                    <svg viewBox="0 0 80 80" class="h-40 w-40 -rotate-90">
                      <circle
                        cx="40"
                        cy="40"
                        r="34"
                        fill="none"
                        stroke="hsl(var(--muted))"
                        stroke-width="7"
                      />
                      <circle
                        cx="40"
                        cy="40"
                        r="34"
                        fill="none"
                        stroke="hsl(var(--primary))"
                        stroke-width="7"
                        stroke-linecap="round"
                        class="transition-[stroke-dashoffset] duration-700 ease-out"
                        :stroke-dasharray="2 * Math.PI * 34"
                        :stroke-dashoffset="2 * Math.PI * 34 * (1 - overallReadinessPercent / 100)"
                      />
                    </svg>
                    <div class="absolute flex flex-col items-center">
                      <span class="text-3xl font-bold leading-none tabular-nums text-foreground">{{ overallReadinessPercent }}%</span>
                      <span class="mt-1 text-xs text-muted-foreground">Siap Berangkat</span>
                    </div>
                  </div>

                  <div class="mt-4 flex items-center gap-4 text-xs">
                    <span class="flex items-center gap-1.5">
                      <span class="h-2 w-2 shrink-0 rounded-full bg-primary" />
                      <span class="text-foreground">{{ overallReadinessPercent }}% Siap</span>
                    </span>
                    <span class="flex items-center gap-1.5">
                      <span class="h-2 w-2 shrink-0 rounded-full bg-muted" />
                      <span class="text-muted-foreground">{{ 100 - overallReadinessPercent }}% Belum Lengkap</span>
                    </span>
                  </div>
                </SectionCard>

                <SectionCard compact titleClass="text-sm font-bold normal-case tracking-normal text-foreground" title="Alasan Belum Siap">
                  <ul v-if="departureReadiness.blockingReasons.length > 0" class="space-y-2">
                    <li v-for="(reason, index) in departureReadiness.blockingReasons" :key="index" class="flex items-start gap-2 text-xs text-foreground">
                      <AlertTriangle class="h-3.5 w-3.5 shrink-0 mt-0.5 text-warning" />
                      {{ reason }}
                    </li>
                  </ul>
                  <p v-else class="flex items-center gap-1.5 text-sm text-success">
                    <CheckCircle2 class="h-4 w-4" />Tidak ada blocker — siap berangkat.
                  </p>

                  <div class="mt-4 border-t border-border pt-4">
                    <div class="flex items-center justify-between gap-2">
                      <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Countdown Keberangkatan
                      </p>
                      <CalendarRange class="h-4 w-4 text-muted-foreground" />
                    </div>
                    <p class="mt-1.5 text-3xl font-bold leading-none text-foreground tabular-nums">
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
                  </div>
                </SectionCard>
              </div>

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

              <!--
              Card per tipe layanan + Booking Timeline dalam SATU grid responsif: kalau totalnya genap (mis.
              1 layanan + Booking Timeline = 2 card), keduanya berdampingan setengah lebar — tidak ada card
              sepi konten yang dipaksa full-width sendirian. Kalau totalnya ganjil (mis. 2 layanan + Booking
              Timeline = 3 card, kasus Abu Dhabi yang datanya banyak), card TERAKHIR (Booking Timeline, sering
              paling panjang datanya) otomatis full-width sendiri lewat `lg:[&>*:last-child:nth-child(odd)]`
              — supaya tabel banyak-baris tidak terjepit setengah lebar. Tinggi card di-stretch SAMA (default
              grid stretch) supaya sepasang card tetap imbang meski jumlah baris beda — card tipe layanan
              jadi flex column penuh tinggi (`class`+`content-class`) dan tombol "Buat Booking" ditempel ke
              dasar via `mt-auto`, bukan menyisakan celah kosong mengambang di tengah.
            -->
              <div v-if="visibleServiceTypes.length || projectBookingTimeline.length" class="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:[&>*:last-child:nth-child(odd)]:col-span-2">
                <SectionCard
                  v-for="type in visibleServiceTypes"
                  :key="type.value"
                  compact
                  class="flex h-full flex-col"
                  content-class="flex flex-1 flex-col"
                  titleClass="text-sm font-bold normal-case tracking-normal text-foreground"
                  :title="type.label"
                  :description="serviceReadinessLabel(type.value)"
                >
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

                  <!-- "Buat Booking" quick-create (Section 13-16) — Sheet lokal (bukan navigate ke /services lagi), lihat `openCreateBooking`. mt-auto (bukan mt-4) supaya menempel ke dasar card walau card ini di-stretch lebih tinggi dari kontennya sendiri (equal-height dengan sibling Flight/Hotel). -->
                  <div v-if="SERVICE_TAB_KEY[type.value] && canManageServiceType(type.value)" class="mt-auto flex justify-end border-t border-border pt-4">
                    <Button size="sm" variant="outline" @click="openCreateBooking(type.value)">
                      <Plus class="h-4 w-4 mr-1.5" />Buat {{ type.label }} Booking
                    </Button>
                  </div>
                </SectionCard>

                <!--
                Booking Timeline (Section 18, D-075) — SATU list terunifikasi lintas Flight/Hotel/Transport/MICE
                MENGGANTIKAN 4 blok ringkasan terpisah lama (Section 13-16, lihat CI-048). Informasi identik
                dengan `/bookings` (booking reference/status internal-supplier-client/deadline/voucher/exception/
                dependency/payment-gate), hanya pre-filtered ke project ini. "Mark Payment Cleared" bisa
                langsung dari sini (bukan cuma `/bookings`) supaya PM/Ops tidak perlu pindah halaman untuk
                aksi yang sering dipakai — "Buka Booking Center" tetap ada untuk Catat Percobaan/exception
                lain yang belum dipindah ke sini.
              -->
                <SectionCard
                  v-if="projectBookingTimeline.length"
                  content-class="p-0"
                  titleClass="text-sm font-bold normal-case tracking-normal text-foreground"
                  title="Booking Timeline"
                  description="Konsolidasi Flight/Hotel/Transport/MICE booking untuk project ini — satu sumber kebenaran seluruh service (Section 18)."
                >
                  <template #actions>
                    <NuxtLink :to="`/bookings?projectId=${project.id}`">
                      <Button size="sm" variant="outline" class="rounded-full">
                        Buka Booking Center
                      </Button>
                    </NuxtLink>
                  </template>
                  <div class="overflow-x-auto border-t border-border">
                    <Table class="w-auto">
                      <TableHeader>
                        <TableRow class="bg-muted/40 hover:bg-muted/40">
                          <TableHead class="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Booking
                          </TableHead>
                          <TableHead class="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Reference
                          </TableHead>
                          <TableHead class="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Internal
                          </TableHead>
                          <TableHead class="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Payment
                          </TableHead>
                          <TableHead class="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Action
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow v-for="entry in projectBookingTimeline" :key="`${entry.bookingType}-${entry.bookingId}`">
                          <TableCell class="max-w-[260px] px-4 py-4">
                            <div class="flex items-center gap-2">
                              <StatusBadge size="md" :label="BOOKING_DOMAIN_LABEL_MAP[entry.bookingType]" :tone="BOOKING_DOMAIN_TONE_MAP[entry.bookingType]" />
                              <NuxtLink :to="entry.detailHref" class="text-sm font-bold text-foreground hover:text-primary hover:underline">
                                {{ entry.bookingId }}
                              </NuxtLink>
                            </div>
                            <p class="mt-1 truncate text-sm text-muted-foreground" :title="entry.label">
                              {{ entry.label }}
                            </p>
                            <p v-if="entry.exceptions.length" class="mt-1 truncate text-xs text-destructive" :title="entry.exceptions.join(' · ')">
                              {{ entry.exceptions[0] }}<template v-if="entry.exceptions.length > 1">
                                +{{ entry.exceptions.length - 1 }} lagi
                              </template>
                            </p>
                          </TableCell>
                          <TableCell class="px-4 py-4 text-sm text-muted-foreground">
                            {{ entry.reference ?? 'Belum terbit' }}
                            <br>
                            {{ entry.travelerCount }} pax<template v-if="entry.deadlineDate">
                              · {{ formatDate(entry.deadlineDate) }}
                            </template>
                          </TableCell>
                          <TableCell class="px-4 py-4">
                            <StatusBadge size="md" :label="entry.internalStatus" :tone="entry.internalStatusTone" />
                          </TableCell>
                          <TableCell class="px-4 py-4">
                            <StatusBadge size="md" :label="findStatusOption(BOOKING_PAYMENT_GATE_STATUSES, entry.paymentGateStatus).label" :tone="findStatusOption(BOOKING_PAYMENT_GATE_STATUSES, entry.paymentGateStatus).tone" />
                            <div v-if="canManageBookings && entry.paymentGateStatus === 'pending'" class="mt-1">
                              <Button size="sm" variant="outline" @click="markBookingPaymentCleared(entry)">
                                Mark Payment Cleared
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell class="px-4 py-4 text-right">
                            <NuxtLink v-if="entry.voucherHref" :to="entry.voucherHref" target="_blank" class="inline-flex items-center gap-1 text-sm font-medium text-foreground hover:text-primary">
                              Voucher<ChevronRight class="h-3.5 w-3.5" />
                            </NuxtLink>
                            <span v-else class="text-sm text-muted-foreground">—</span>
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </SectionCard>
              </div>

              <!-- "Buat Booking" quick-create — Sheet reusable satu instance untuk Flight/Hotel/Transport/MICE, dibuka via `openCreateBooking(type)` dari tombol di masing-masing card di atas. -->
              <Sheet v-model:open="isBookingSheetOpen">
                <SheetContent side="right" class="w-full sm:max-w-md overflow-y-auto">
                  <SheetHeader>
                    <SheetTitle>{{ BOOKING_SHEET_TITLE[bookingSheetType] }}</SheetTitle>
                    <SheetDescription>{{ BOOKING_SHEET_DESCRIPTION[bookingSheetType] }}</SheetDescription>
                  </SheetHeader>
                  <div class="space-y-4 py-2">
                    <div class="space-y-1.5">
                      <Label for="booking-vendor">Vendor (opsional)</Label>
                      <select id="booking-vendor" v-model="bookingVendorId" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                        <option value="">
                          Belum ditentukan
                        </option>
                        <option v-for="vendor in bookingVendorOptions" :key="vendor.id" :value="vendor.id">
                          {{ vendor.name }}
                        </option>
                      </select>
                    </div>

                    <div v-if="bookingSheetType === 'flight'" class="space-y-1.5">
                      <Label for="booking-ticketing-deadline">Ticketing Deadline (opsional)</Label>
                      <Input id="booking-ticketing-deadline" v-model="bookingTicketingDeadline" type="date" />
                    </div>

                    <div v-if="bookingSheetType === 'hotel'" class="grid grid-cols-2 gap-3">
                      <div class="space-y-1.5">
                        <Label for="booking-checkin">Check-in (opsional)</Label>
                        <Input id="booking-checkin" v-model="bookingCheckInDate" type="date" />
                      </div>
                      <div class="space-y-1.5">
                        <Label for="booking-checkout">Check-out (opsional)</Label>
                        <Input id="booking-checkout" v-model="bookingCheckOutDate" type="date" />
                      </div>
                    </div>

                    <div v-if="bookingSheetType === 'mice'" class="space-y-1.5">
                      <Label for="booking-venue">Venue Name (opsional)</Label>
                      <Input id="booking-venue" v-model="bookingVenueName" placeholder="mis. Ballroom Hotel XYZ" />
                    </div>
                  </div>
                  <SheetFooter class="mt-6 flex-row justify-end gap-2">
                    <Button variant="outline" @click="isBookingSheetOpen = false">
                      Batal
                    </Button>
                    <Button @click="submitCreateBooking">
                      Simpan
                    </Button>
                  </SheetFooter>
                </SheetContent>
              </Sheet>

              <EmptyState v-if="!visibleServiceTypes.length && !projectBookingTimeline.length" :icon="Truck" title="Belum ada layanan tercatat untuk project ini" />

              <!-- Procurement + Operational Tasks + Shift Notes dalam SATU grid responsif — pola sama grid layanan+Booking Timeline di atas: total genap → berdampingan setengah lebar, total ganjil → card terakhir (biasanya Shift Notes) otomatis full-width sendiri, tidak ada card sepi konten yang kepaksa full-width sendirian. -->
              <div class="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:[&>*:last-child:nth-child(odd)]:col-span-2">
                <SectionCard
                  v-if="projectRfqs.length || projectServiceOrders.length"
                  compact
                  titleClass="text-sm font-bold normal-case tracking-normal text-foreground"
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

                <!-- Operational Tasks — di-hide sementara atas permintaan (belum dihapus, tinggal balikin v-if kalau mau tampil lagi). -->
                <SectionCard
                  v-if="false"
                  compact
                  titleClass="text-sm font-bold normal-case tracking-normal text-foreground"
                  title="Operational Tasks"
                  :description="`${tasks.length} task tercatat untuk project ini`"
                >
                  <template v-if="tasks.length" #actions>
                    <Button size="sm" variant="outline" @click="activeTab = 'tasks'">
                      Lihat Semua Task
                    </Button>
                  </template>
                  <ul v-if="tasks.length" class="divide-y divide-border">
                    <li v-for="task in tasks.slice(0, 5)" :key="task.id" class="flex flex-wrap items-center justify-between gap-2 py-2">
                      <div class="min-w-0 flex-1">
                        <p class="truncate text-sm font-medium text-foreground">
                          {{ task.title }}
                        </p>
                        <p class="text-xs text-muted-foreground">
                          {{ task.assignedTo ? getUserById(task.assignedTo)?.name ?? task.assignedTo : 'Belum ditugaskan' }}
                          <template v-if="task.dueAt">
                            · Deadline {{ formatDate(task.dueAt) }}
                          </template>
                        </p>
                      </div>
                      <StatusBadge
                        :label="findStatusOption(TASK_STATUSES, task.status).label"
                        :tone="findStatusOption(TASK_STATUSES, task.status).tone"
                      />
                    </li>
                  </ul>
                  <EmptyState v-else title="Belum ada task tercatat" />
                </SectionCard>

                <!-- On-Trip Updates / Shift Notes (Section 12 baru) -->
                <SectionCard compact titleClass="text-sm font-bold normal-case tracking-normal text-foreground" title="On-Trip Updates / Shift Notes" description="Catatan serah-terima operasional selama trip berlangsung (mock).">
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
                  <EmptyState v-else size="compact" title="Belum ada shift note tercatat" />
                </SectionCard>
              </div>
            </div>

            <!-- Sidebar kanan (Section 12 baru) — Daily Itinerary dipindah ke sini (dari main flow), Tim Project dan Aktivitas Terbaru reuse data yang sudah dihitung di tab Overview, bukan selector baru. Attention / Exception Queue ditumpuk di bawah Aktivitas Terbaru (bukan main flow) supaya nempel di sisi kanan dan sejajar vertikal tepat di bawahnya. -->
            <div class="space-y-4 lg:col-span-1 lg:sticky lg:top-6">
              <SectionCard compact titleClass="text-sm font-bold normal-case tracking-normal text-foreground" title="Daily Itinerary" description="Jadwal harian perjalanan (timezone lokal ditampilkan berdampingan jam).">
                <div v-if="itineraryByDate.length" class="space-y-4">
                  <div v-for="day in itineraryByDate" :key="day.date" class="flex gap-3">
                    <div class="flex shrink-0 flex-col items-center">
                      <div class="flex h-10 w-10 flex-col items-center justify-center rounded-lg border border-primary/30 bg-primary/5 text-primary">
                        <span class="text-xs font-bold leading-none">{{ formatDayBadge(day.date).day }}</span>
                        <span class="text-[9px] font-medium uppercase leading-none mt-0.5">{{ formatDayBadge(day.date).month }}</span>
                      </div>
                    </div>
                    <div class="min-w-0 flex-1 pb-1">
                      <p class="text-xs font-medium text-muted-foreground mb-2">
                        {{ formatDayLabel(day.date) }}
                      </p>
                      <ul class="space-y-2.5">
                        <li v-for="item in day.items" :key="item.id" class="flex items-start justify-between gap-2">
                          <div class="min-w-0 flex-1">
                            <p class="text-xs text-muted-foreground">
                              {{ item.time ?? '—' }}<template v-if="item.timezone">
                                ({{ item.timezone }})
                              </template>
                            </p>
                            <p class="text-sm text-foreground truncate">
                              {{ item.title }}
                            </p>
                            <p v-if="item.groupId" class="text-xs text-muted-foreground">
                              Group: {{ groupNameById(item.groupId) }}
                            </p>
                          </div>
                          <div class="flex shrink-0 flex-col items-end gap-1">
                            <StatusBadge v-if="item.visibleToClient === false" label="Internal Only" tone="neutral" />
                            <StatusBadge
                              v-if="item.serviceType"
                              :label="findStatusOption(SERVICE_TYPES, item.serviceType).label"
                              :tone="findStatusOption(SERVICE_TYPES, item.serviceType).tone"
                            />
                            <div v-if="canManageOperations" class="flex items-center gap-1">
                              <button
                                type="button"
                                class="flex h-6 w-6 items-center justify-center rounded-md border transition-colors"
                                :class="item.visibleToClient === false ? 'border-chart-5/30 bg-chart-5/10 text-chart-5 hover:bg-chart-5/20' : 'border-warning/30 bg-warning/10 text-warning hover:bg-warning/20'"
                                :title="item.visibleToClient === false ? 'Tampilkan ke Client' : 'Jadikan Internal'"
                                @click="toggleItineraryVisibility(item)"
                              >
                                <component :is="item.visibleToClient === false ? Eye : EyeOff" class="h-3 w-3" />
                              </button>
                              <button
                                type="button"
                                class="flex h-6 w-6 items-center justify-center rounded-md border border-primary/25 bg-primary/10 text-primary transition-colors hover:bg-primary/20"
                                title="Edit"
                                @click="openEditItineraryItem(item)"
                              >
                                <Pencil class="h-3 w-3" />
                              </button>
                              <button
                                type="button"
                                class="flex h-6 w-6 items-center justify-center rounded-md border border-destructive/25 bg-destructive/10 text-destructive transition-colors hover:bg-destructive/20"
                                title="Hapus"
                                @click="pendingDeleteItineraryItem = item"
                              >
                                <Trash2 class="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
                <EmptyState v-else size="compact" title="Belum ada itinerary tercatat" />
                <Button v-if="canManageOperations" variant="outline" class="mt-4 w-full" @click="openCreateItineraryItem">
                  <Plus class="h-3.5 w-3.5 mr-1.5" />Tambah Itinerary
                </Button>
              </SectionCard>

              <SectionCard compact titleClass="text-sm font-bold normal-case tracking-normal text-foreground" title="Tim Project">
                <template v-if="canManageProjectOrder" #actions>
                  <button type="button" class="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/20" @click="isTeamDialogOpen = true">
                    <Plus class="h-3 w-3" />Tambah
                  </button>
                </template>
                <div class="space-y-3">
                  <div class="flex items-center gap-2.5">
                    <Avatar class="h-9 w-9 shrink-0">
                      <AvatarFallback class="bg-primary/15 text-xs font-semibold text-primary">
                        {{ initials(owner?.name) }}
                      </AvatarFallback>
                    </Avatar>
                    <p class="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                      {{ owner?.name ?? '—' }}
                    </p>
                    <StatusBadge label="PM" tone="primary" />
                  </div>
                  <div class="flex items-center gap-2.5">
                    <Avatar class="h-9 w-9 shrink-0">
                      <AvatarFallback class="bg-chart-5/15 text-xs font-semibold text-chart-5">
                        {{ initials(accountExecutive?.name) }}
                      </AvatarFallback>
                    </Avatar>
                    <p class="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                      {{ accountExecutive?.name ?? '—' }}
                    </p>
                    <StatusBadge label="AE" tone="info" />
                  </div>
                  <div v-for="member in team" :key="member.id" class="group flex items-center gap-2.5">
                    <Avatar class="h-9 w-9 shrink-0">
                      <AvatarFallback class="bg-muted text-xs font-semibold text-muted-foreground">
                        {{ initials(member.name) }}
                      </AvatarFallback>
                    </Avatar>
                    <p class="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                      {{ member.name }}
                    </p>
                    <StatusBadge :label="member.role" tone="neutral" />
                    <button
                      v-if="canManageProjectOrder"
                      type="button"
                      class="shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                      title="Hapus dari tim"
                      @click="submitRemoveTeamMember(member.id)"
                    >
                      ×
                    </button>
                  </div>
                </div>
              </SectionCard>

              <SectionCard compact titleClass="text-sm font-bold normal-case tracking-normal text-foreground" title="Aktivitas Terbaru">
                <template v-if="!project.isGroupTrip && historyEntries.length" #actions>
                  <Button size="sm" variant="ghost" @click="goToActivityTab">
                    Lihat Semua
                  </Button>
                </template>
                <ul v-if="historyEntries.length" class="divide-y divide-border">
                  <li v-for="item in historyEntries.slice(0, 5)" :key="item.id" class="py-2.5">
                    <p class="text-sm text-foreground line-clamp-2">
                      {{ item.activity?.message ?? item.message?.body ?? item.timelineEntry?.detail }}
                    </p>
                    <p class="mt-0.5 text-xs text-muted-foreground">
                      {{ formatDate(item.at) }}
                    </p>
                  </li>
                </ul>
                <EmptyState v-else size="compact" title="Belum ada aktivitas tercatat" />
              </SectionCard>

              <!-- Attention / Exception Queue (Section 12 baru) — ditumpuk tepat di bawah "Aktivitas Terbaru" di sidebar kanan yang sama (bukan sidebar terpisah), sejajar vertikal persis di bawahnya sesuai permintaan. "Penanda Perubahan" digabung sebagai baris terakhir kartu yang sama supaya tingginya selalu mengikuti konten sendiri. Dibungkus div ref (bukan ref langsung di SectionCard, komponen bukan elemen DOM native) supaya "Lihat Semua" di card Action Required (Overview) bisa scroll ke sini. -->
              <div v-if="hasAttentionSidebarContent" ref="attentionQueueSidebarRef">
                <SectionCard
                  compact
                  titleClass="text-sm font-bold normal-case tracking-normal text-foreground"
                  title="Attention / Exception Queue"
                  description="Item lintas-domain yang butuh perhatian."
                  accent
                  tone="destructive"
                >
                  <div v-if="attentionQueue.length > 0" class="space-y-1">
                    <button
                      v-for="(item, index) in attentionQueue"
                      :key="index"
                      type="button"
                      class="flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-muted/60"
                      @click="goToAttentionTab(item.tab)"
                    >
                      <AlertTriangle class="mt-0.5 h-3.5 w-3.5 shrink-0" :class="item.severity === 'high' ? 'text-destructive' : 'text-warning'" />
                      <span class="min-w-0 flex-1 text-xs text-foreground">{{ item.message }}</span>
                    </button>
                  </div>

                  <div
                    v-if="project.characteristic === 'high-change' && changedServicesCount > 0"
                    class="space-y-2 pt-2.5"
                    :class="attentionQueue.length > 0 ? 'mt-2.5 border-t border-border' : ''"
                  >
                    <p class="text-xs text-foreground">
                      <span class="font-medium text-warning">High-Change Project</span> · {{ changedServicesCount }} layanan berubah setelah dikonfirmasi.
                    </p>
                    <Button size="sm" variant="outline" class="w-full" @click="goToActivityTab">
                      Lihat Activity & Changes
                    </Button>
                  </div>
                </SectionCard>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent v-if="project.isGroupTrip" value="bookings">
          <div class="space-y-4">
            <!--
              Booking Funnel (signature element) — 4 tahap DP-gated digambar sebagai satu pipeline bersambung
              (bukan 5 stat tile lepas): bar bawah tiap tahap = persentase relatif terhadap Linked Leads,
              memvisualisasikan drop-off funnel sesungguhnya. Available Seats dipisah ke gauge donut di kanan
              karena maknanya beda (kapasitas/inventory, bukan tahap proses) — lihat komentar `bookingFunnelStages`.
            -->
            <div class="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
                <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Booking Funnel
                </p>
                <p class="text-[11px] text-muted-foreground">
                  Lead tertaut → DP → Confirmed → Participant
                </p>
              </div>
              <div class="flex flex-col gap-4 lg:flex-row lg:items-stretch">
                <div class="flex flex-1 items-stretch">
                  <template v-for="(stage, index) in bookingFunnelStages" :key="stage.key">
                    <div class="min-w-0 flex-1 px-2 first:pl-0">
                      <div class="flex items-center gap-2.5">
                        <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full" :class="stage.toneClasses.iconBg">
                          <component :is="stage.icon" class="h-4 w-4" :class="stage.toneClasses.icon" />
                        </div>
                        <div class="min-w-0">
                          <p class="text-xl font-bold leading-none text-foreground tabular-nums">
                            {{ stage.count }}
                          </p>
                          <p class="mt-1 truncate text-[11px] text-muted-foreground">
                            {{ stage.label }}
                          </p>
                        </div>
                      </div>
                      <div class="mt-2.5 h-1 w-full overflow-hidden rounded-full bg-muted">
                        <div class="h-full rounded-full transition-all" :class="stage.toneClasses.bar" :style="{ width: `${stage.percentOfLeads}%` }" />
                      </div>
                    </div>
                    <div v-if="index < bookingFunnelStages.length - 1" class="flex shrink-0 items-center text-border">
                      <ChevronRight class="h-4 w-4" />
                    </div>
                  </template>
                </div>

                <div class="flex shrink-0 items-center gap-3 border-t border-border pt-4 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
                  <svg viewBox="0 0 64 64" class="h-14 w-14 shrink-0 -rotate-90">
                    <circle
                      cx="32"
                      cy="32"
                      r="26"
                      fill="none"
                      stroke="hsl(var(--muted))"
                      stroke-width="7"
                    />
                    <circle
                      cx="32"
                      cy="32"
                      r="26"
                      fill="none"
                      stroke="hsl(var(--primary))"
                      stroke-width="7"
                      stroke-linecap="round"
                      :stroke-dasharray="2 * Math.PI * 26"
                      :stroke-dashoffset="2 * Math.PI * 26 * (1 - seatsFilledPercent / 100)"
                    />
                  </svg>
                  <div class="min-w-0">
                    <p class="text-xl font-bold leading-none text-foreground tabular-nums">
                      {{ seatsAvailableCount }}
                    </p>
                    <p class="mt-1 text-[11px] text-muted-foreground">
                      Available Seats
                    </p>
                    <p class="mt-0.5 text-[11px] text-muted-foreground">
                      {{ seatsFilledCount }}/{{ seatsTotalCount }} terisi
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <SectionCard compact title="Awaiting DP" description="Lead sudah Qualified, quota sudah ditahan — belum ada Participant sampai DP dikonfirmasi." :accent="awaitingDpRows.length > 0" tone="warning">
                <ul v-if="awaitingDpRows.length" class="divide-y divide-border">
                  <li v-for="row in awaitingDpRows" :key="row.order.id" class="flex flex-wrap items-center gap-3 rounded-r-md border-l-2 border-warning/50 py-2 pl-3 transition-colors hover:bg-muted/20">
                    <div class="min-w-0 flex-1">
                      <p class="truncate text-sm font-medium text-foreground">
                        {{ row.party?.name ?? '—' }}
                      </p>
                      <p class="text-xs text-muted-foreground">
                        {{ row.order.travelerCount }} pax · Booked {{ formatDate(row.order.createdAt) }}
                      </p>
                    </div>
                    <span class="shrink-0 text-sm tabular-nums text-foreground">{{ formatCurrencyIdr(row.order.priceIdr) }}</span>
                    <Button size="sm" class="shrink-0" @click="openConfirmDp(row.order)">
                      Konfirmasi DP
                    </Button>
                  </li>
                </ul>
                <EmptyState v-else title="Belum ada booking Awaiting DP" />
              </SectionCard>

              <SectionCard compact title="Confirmed Bookings">
                <ul v-if="confirmedBookingRows.length" class="divide-y divide-border">
                  <li v-for="row in confirmedBookingRows" :key="row.order.id" class="flex flex-wrap items-center gap-3 rounded-r-md border-l-2 py-2 pl-3 transition-colors hover:bg-muted/20" :class="TONE_BORDER_L[row.statusOption.tone]">
                    <div class="min-w-0 flex-1">
                      <p class="truncate text-sm font-medium text-foreground">
                        {{ row.party?.name ?? '—' }}
                      </p>
                      <p class="text-xs text-muted-foreground">
                        {{ row.order.travelerCount }} pax
                      </p>
                    </div>
                    <span class="shrink-0 text-sm tabular-nums text-foreground">{{ formatCurrencyIdr(row.order.priceIdr) }}</span>
                    <StatusBadge
                      v-if="getSalesOrderOutstandingIdr(row.order.id) > 0"
                      class="shrink-0"
                      :label="`${formatCurrencyIdr(getSalesOrderOutstandingIdr(row.order.id))} belum lunas`"
                      :tone="isDpBalanceOverdue(project, getSalesOrderOutstandingIdr(row.order.id)) ? 'destructive' : 'warning'"
                    />
                    <StatusBadge v-else label="Lunas" tone="success" class="shrink-0" />
                    <StatusBadge :label="row.statusOption.label" :tone="row.statusOption.tone" class="shrink-0" />
                  </li>
                </ul>
                <EmptyState v-else title="Belum ada Confirmed Booking" />
              </SectionCard>
            </div>

            <SectionCard compact title="Waitlist" description="Lead yang minta pax lebih banyak dari seat tersisa saat qualification.">
              <ul v-if="waitlistLeads.length" class="divide-y divide-border">
                <li v-for="lead in waitlistLeads" :key="lead.id" class="flex items-center justify-between gap-3 rounded-r-md border-l-2 border-muted-foreground/20 py-2 pl-3 transition-colors hover:bg-muted/20">
                  <NuxtLink :to="`/crm/leads/${lead.id}`" class="truncate text-sm font-medium text-foreground hover:underline">
                    {{ lead.name }}
                  </NuxtLink>
                  <span class="shrink-0 text-xs text-muted-foreground">
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
          <div class="space-y-4">
            <SectionCard
              compact
              titleClass="text-sm font-bold normal-case tracking-normal text-foreground"
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

              <!-- Readiness indicator (Section 11 baru) — flat stat tile per metrik (icon badge + label sebaris, angka besar, caption kecil), TANPA sparkline/progress bar. Dibungkus satu background bersama supaya terbaca sebagai satu grup, bukan 4 card lepas. -->
              <div v-if="travelerReadinessSteps.length" class="mb-4 rounded-xl border border-border bg-muted/20 p-3">
                <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div v-for="step in travelerReadinessSteps" :key="step.key" class="rounded-lg border border-border bg-card p-3.5">
                    <div class="flex items-center gap-2.5">
                      <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" :class="TONE_ICON_BG[step.tone]">
                        <component :is="step.icon" class="h-4 w-4" />
                      </div>
                      <p class="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {{ step.label }}
                      </p>
                    </div>
                    <p class="mt-2.5 text-2xl font-bold leading-none tabular-nums text-foreground">
                      {{ step.count }}
                    </p>
                    <p class="mt-1 text-xs text-muted-foreground">
                      dari {{ travelerReadiness?.total }} traveler
                    </p>
                  </div>
                  <div class="rounded-lg border border-border bg-card p-3.5">
                    <div class="flex items-center gap-2.5">
                      <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" :class="TONE_ICON_BG[serviceReadinessTone(travelerReadiness?.readinessPercent ?? 0)]">
                        <Gauge class="h-4 w-4" />
                      </div>
                      <p class="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Readiness
                      </p>
                    </div>
                    <p class="mt-2.5 text-2xl font-bold leading-none tabular-nums text-foreground">
                      {{ travelerReadiness?.readinessPercent ?? 0 }}%
                    </p>
                    <p class="mt-1 text-xs text-muted-foreground">
                      kesiapan keseluruhan
                    </p>
                  </div>
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

              <div v-if="travelers.length" class="flex flex-col sm:flex-row sm:items-center gap-3 mb-4 rounded-xl border border-border bg-muted/20 p-3">
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

              <Table v-if="travelers.length" class="rounded-xl border border-border">
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
          <SectionCard compact titleClass="text-sm font-bold normal-case tracking-normal text-foreground" title="Vendors" description="Vendor yang ditugaskan dan perbandingan quotation untuk tiap layanan project ini.">
            <div v-if="services.length" class="space-y-3">
              <div
                v-for="row in vendorServiceRows"
                :key="row.service.id"
                class="rounded-lg border border-border p-3.5"
              >
                <div class="flex flex-wrap items-start justify-between gap-3">
                  <div class="flex min-w-0 items-start gap-2.5">
                    <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
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
                    <Button v-else-if="!row.service.vendorId && canManageServiceType(row.service.type)" size="sm" variant="outline" @click="openAssignVendorDialog(row.service)">
                      Tugaskan Vendor
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

          <Dialog v-model:open="isAssignVendorDialogOpen">
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Tugaskan Vendor</DialogTitle>
                <DialogDescription>
                  Layanan "{{ assignVendorService?.label }}". Isi nominal supaya layanan langsung Confirmed dan Supplier Invoice terbentuk dengan nilai yang benar — kosongkan kalau cuma mau menugaskan vendor dulu tanpa nominal.
                </DialogDescription>
              </DialogHeader>
              <div class="space-y-4 py-2">
                <div class="space-y-1.5">
                  <Label for="assign-vendor-id">Vendor</Label>
                  <select id="assign-vendor-id" v-model="assignVendorId" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                    <option value="">
                      Pilih vendor
                    </option>
                    <option v-for="vendor in assignVendorOptions" :key="vendor.id" :value="vendor.id">
                      {{ vendor.name }}
                    </option>
                  </select>
                </div>
                <div class="space-y-1.5">
                  <Label for="assign-vendor-amount">Nominal Quotation (Rp, opsional)</Label>
                  <CurrencyInput id="assign-vendor-amount" v-model="assignVendorAmountIdr" placeholder="mis. 8500000" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" @click="isAssignVendorDialogOpen = false">
                  Batal
                </Button>
                <Button :disabled="!assignVendorId" @click="submitAssignVendor">
                  Simpan
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

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
              <div class="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
                <div class="min-w-0 space-y-4">
                  <div>
                    <p class="mb-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Financial Snapshot
                    </p>
                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <StatsCard
                        title="Project Value"
                        :value="formatCurrencyIdr(project.quotationAmountIdr)"
                        :subtitle="`Terkumpul ${formatCurrencyIdr(collectedIdr)} dari client${quotationGapIdr > 0 ? ' · Kurang ' + formatCurrencyIdr(quotationGapIdr) : ' · Lunas'}`"
                        :progress-percent="quotationCollectionPercent"
                        :icon="FileText"
                        :icon-color="quotationGapIdr > 0 ? 'warning' : 'success'"
                      />
                      <StatsCard
                        title="Actual Cost"
                        :value="formatCurrencyIdr(actualCostIdr)"
                        subtitle="Biaya aktual saat ini"
                        :progress-percent="project.budgetIdr > 0 ? (actualCostIdr / project.budgetIdr) * 100 : 0"
                        :icon="CreditCard"
                        :icon-color="actualCostIdr > project.budgetIdr ? 'destructive' : 'success'"
                      />
                      <StatsCard
                        v-if="canViewMargin"
                        title="Project Margin"
                        :value="formatCurrencyIdr(marginIdr)"
                        subtitle="Perkiraan margin proyek"
                        :progress-percent="project.quotationAmountIdr > 0 ? (marginIdr / project.quotationAmountIdr) * 100 : 0"
                        :icon="PieChart"
                        :icon-color="marginIdr >= 0 ? 'success' : 'destructive'"
                      />
                    </div>
                  </div>

                  <SectionCard v-if="serviceTypeSpendRows.length" compact titleClass="text-sm font-bold normal-case tracking-normal text-foreground" title="Pengeluaran per Layanan" description="Alokasi budget dan actual cost per tipe layanan — dipecah dari Project Value/Actual Cost di atas.">
                    <div class="space-y-3">
                      <!-- Ringkasan Budget Project -->
                      <div class="rounded-xl border border-border bg-card p-4">
                        <div class="flex items-center gap-2.5">
                          <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                            <Calculator class="h-4 w-4" />
                          </div>
                          <p class="text-xs font-semibold uppercase tracking-wide text-foreground">
                            Ringkasan Budget Project
                          </p>
                        </div>

                        <div class="mt-3 flex flex-wrap items-center gap-x-8 gap-y-3">
                          <div>
                            <p class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                              Total Budget Project
                            </p>
                            <p class="mt-1 text-xl font-bold leading-tight text-foreground">
                              {{ formatCurrencyIdr(serviceBudgetAllocationSummary.totalIdr) }}
                            </p>
                            <p class="mt-0.5 text-xs text-muted-foreground">
                              Total budget
                            </p>
                          </div>
                          <div>
                            <p class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                              Sudah Dialokasikan
                            </p>
                            <p class="mt-1 text-xl font-bold leading-tight text-success">
                              {{ formatCurrencyIdr(serviceBudgetAllocationSummary.allocatedIdr) }}
                            </p>
                            <p class="mt-0.5 flex items-center gap-1 text-xs text-success">
                              <CheckCircle2 class="h-3 w-3 shrink-0" />{{ serviceBudgetAllocationPercent }}% dari total budget
                            </p>
                          </div>
                          <div>
                            <p class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                              Belum Dialokasikan
                            </p>
                            <p class="mt-1 text-xl font-bold leading-tight text-foreground">
                              {{ formatCurrencyIdr(Math.max(0, serviceBudgetAllocationSummary.unallocatedIdr)) }}
                            </p>
                            <p class="mt-0.5 text-xs text-muted-foreground">
                              {{ Math.max(0, 100 - serviceBudgetAllocationPercent) }}% dari total budget
                            </p>
                          </div>
                          <div>
                            <p class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                              Tingkat Alokasi
                            </p>
                            <p class="mt-1 text-xl font-bold leading-tight" :class="ALLOCATION_TEXT_CLASS[allocationRingTone]">
                              {{ serviceBudgetAllocationPercent }}%
                            </p>
                            <p class="mt-0.5 text-xs" :class="ALLOCATION_TEXT_CLASS[allocationRingTone]">
                              {{ ALLOCATION_STATUS_LABEL[allocationRingTone] }}
                            </p>
                          </div>

                          <div class="ml-auto flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-4" :class="ALLOCATION_RING_CLASS[allocationRingTone]">
                            <component :is="ALLOCATION_RING_ICON[allocationRingTone]" class="h-5 w-5" />
                          </div>
                        </div>

                        <div class="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
                          <div class="h-full rounded-full transition-all" :class="TONE_BAR_BG[allocationRingTone]" :style="{ width: `${Math.min(100, serviceBudgetAllocationPercent)}%` }" />
                        </div>
                        <div class="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                          <span class="flex items-center gap-1.5">
                            <span class="h-2 w-2 shrink-0 rounded-full bg-success" />
                            Teralokasikan: <span class="font-medium text-foreground">{{ formatCurrencyIdr(serviceBudgetAllocationSummary.allocatedIdr) }}</span>
                          </span>
                          <span class="flex items-center gap-1.5">
                            <span class="h-2 w-2 shrink-0 rounded-full border border-muted-foreground/40" />
                            {{ serviceBudgetAllocationSummary.unallocatedIdr < 0 ? 'Over' : 'Sisa' }}: <span class="font-medium text-foreground">{{ formatCurrencyIdr(Math.abs(serviceBudgetAllocationSummary.unallocatedIdr)) }}</span>
                          </span>
                        </div>
                      </div>

                      <!-- Baris per layanan -->
                      <div class="space-y-2">
                        <div v-for="row in serviceTypeSpendRows" :key="row.type" class="flex flex-col gap-3 rounded-lg border border-border p-3 sm:flex-row sm:items-center">
                          <div class="flex min-w-0 items-center gap-2.5 sm:w-52 sm:shrink-0">
                            <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full" :class="TONE_ICON_BG[findStatusOption(SERVICE_TYPES, row.type).tone]">
                              <component :is="SERVICE_TYPE_ICON[row.type]" class="h-4 w-4" />
                            </div>
                            <div class="min-w-0">
                              <p class="text-sm font-semibold text-foreground">
                                {{ row.label }}
                              </p>
                              <p class="text-xs text-muted-foreground">
                                Budget: <span class="font-medium text-foreground">{{ row.hasBudget ? formatCurrencyIdr(row.budgetIdr) : 'Belum dialokasikan' }}</span>
                              </p>
                              <p class="text-xs text-muted-foreground">
                                Actual: <span class="font-medium text-foreground">{{ formatCurrencyIdr(row.actualIdr) }}</span>
                              </p>
                            </div>
                          </div>

                          <div v-if="row.hasBudget" class="min-w-0 flex-1">
                            <p class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                              Alokasi
                            </p>
                            <p class="mt-0.5 text-xl font-bold leading-tight text-foreground">
                              {{ row.percent }}%
                            </p>
                            <div class="mt-1.5 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-muted">
                              <div
                                class="h-full rounded-full transition-all"
                                :class="row.remainingIdr < 0 ? 'bg-destructive' : TONE_BAR_BG[findStatusOption(SERVICE_TYPES, row.type).tone]"
                                :style="{ width: `${row.percent}%` }"
                              />
                            </div>
                            <p class="mt-1 text-xs text-muted-foreground">
                              {{ formatCurrencyIdr(row.actualIdr) }} dari {{ formatCurrencyIdr(row.budgetIdr) }}
                            </p>
                          </div>
                          <p v-else class="flex-1 text-xs text-muted-foreground">
                            Belum ada alokasi budget untuk layanan ini.
                          </p>

                          <div class="flex shrink-0 items-center gap-3">
                            <div v-if="row.hasBudget">
                              <p class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                                {{ row.remainingIdr < 0 ? 'Over Budget' : 'Sisa Alokasi' }}
                              </p>
                              <span class="mt-0.5 inline-block rounded-full px-2.5 py-1 text-sm font-semibold" :class="row.remainingIdr < 0 ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success'">
                                {{ formatCurrencyIdr(Math.abs(row.remainingIdr)) }}
                              </span>
                            </div>
                            <Button v-if="canManageFinance" size="sm" variant="outline" @click="openEditServiceBudget(row.type, row.label)">
                              Edit Budget
                            </Button>
                            <ChevronRight class="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                          </div>
                        </div>
                      </div>

                      <p class="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                        <Info class="mt-0.5 h-3 w-3 shrink-0" />
                        Total actual di sini bisa berbeda dari "Actual Cost" di atas — Actual Cost project juga menghitung pengeluaran ad-hoc/Opex yang tidak terhubung ke layanan spesifik.
                      </p>
                    </div>
                  </SectionCard>
                </div>

                <div class="space-y-4">
                  <!-- Spacer transparan — samain classes-nya persis sama label "Financial Snapshot" (bukan pixel tebakan) supaya kartu ini rata sejajar sama baris StatsCard di kolom kiri. -->
                  <p class="mb-3 hidden text-[11px] font-semibold uppercase tracking-wide text-transparent select-none xl:block" aria-hidden="true">
                    .
                  </p>
                  <SectionCard compact titleClass="text-sm font-bold normal-case tracking-normal text-foreground" title="Close Finance" description="Financial closure gate — menandai project ini &quot;Finance diselesaikan&quot; sebelum Project Closure.">
                    <p v-if="isFinanceAlreadySettled" class="mb-3 flex items-center gap-1.5 text-sm text-success">
                      <CheckCircle2 class="h-4 w-4 shrink-0" />Finance project ini sudah ditutup.
                    </p>

                    <div class="flex flex-col items-center gap-2 text-center">
                      <div class="relative flex h-24 w-24 shrink-0 items-center justify-center">
                        <svg viewBox="0 0 96 96" class="h-24 w-24 -rotate-90">
                          <circle
                            cx="48"
                            cy="48"
                            r="40"
                            fill="none"
                            stroke="hsl(var(--muted))"
                            stroke-width="9"
                          />
                          <circle
                            cx="48"
                            cy="48"
                            r="40"
                            fill="none"
                            :stroke="quotationGapIdr <= 0 ? 'hsl(var(--success))' : 'hsl(var(--primary))'"
                            stroke-width="9"
                            stroke-linecap="round"
                            class="transition-all duration-500"
                            :stroke-dasharray="2 * Math.PI * 40"
                            :stroke-dashoffset="2 * Math.PI * 40 * (1 - quotationCollectionPercent / 100)"
                          />
                        </svg>
                        <div class="absolute inset-0 flex flex-col items-center justify-center">
                          <CheckCircle2 v-if="quotationGapIdr <= 0" class="h-8 w-8 text-success" />
                          <p v-else class="text-xl font-bold leading-none text-primary">
                            {{ quotationCollectionPercent }}%
                          </p>
                        </div>
                      </div>
                      <p class="text-xs text-muted-foreground">
                        Sudah dibayar
                      </p>
                      <span class="inline-block rounded-full px-2.5 py-0.5 text-[11px] font-medium" :class="quotationGapIdr <= 0 ? 'bg-success/10 text-success' : 'bg-primary/10 text-primary'">
                        Client Payment
                      </span>
                    </div>

                    <p class="mt-4 text-xl font-bold leading-tight text-foreground">
                      {{ formatCurrencyIdr(collectedIdr) }}
                    </p>
                    <p class="text-xs text-muted-foreground">
                      dari {{ formatCurrencyIdr(project.quotationAmountIdr) }}
                    </p>
                    <div class="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div class="h-full rounded-full transition-all" :class="quotationGapIdr <= 0 ? 'bg-success' : 'bg-primary'" :style="{ width: `${quotationCollectionPercent}%` }" />
                    </div>

                    <div class="mt-4 space-y-3 border-t border-border pt-3">
                      <div class="flex items-center justify-between gap-2">
                        <p class="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span class="h-2 w-2 shrink-0 rounded-full" :class="quotationGapIdr <= 0 ? 'bg-success' : 'bg-primary'" />Sudah Dibayar
                        </p>
                        <div class="text-right">
                          <p class="text-sm font-semibold text-foreground">
                            {{ formatCurrencyIdr(collectedIdr) }}
                          </p>
                          <p class="text-[11px] text-muted-foreground">
                            {{ quotationCollectionPercent }}% dari total
                          </p>
                        </div>
                      </div>
                      <div class="flex items-center justify-between gap-2">
                        <p class="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span class="h-2 w-2 shrink-0 rounded-full border border-muted-foreground/40" />Sisa Tagihan
                        </p>
                        <div class="text-right">
                          <p class="text-sm font-semibold text-foreground">
                            {{ formatCurrencyIdr(quotationGapIdr) }}
                          </p>
                          <p class="text-[11px] text-muted-foreground">
                            {{ 100 - quotationCollectionPercent }}% dari total
                          </p>
                        </div>
                      </div>
                      <div class="flex items-center justify-between gap-2">
                        <p class="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span class="h-2 w-2 shrink-0 rounded-full bg-border" />Total Kontrak
                        </p>
                        <div class="text-right">
                          <p class="text-sm font-semibold text-foreground">
                            {{ formatCurrencyIdr(project.quotationAmountIdr) }}
                          </p>
                          <p class="text-[11px] text-muted-foreground">
                            100%
                          </p>
                        </div>
                      </div>
                    </div>
                  </SectionCard>

                  <div v-if="!isFinanceAlreadySettled" class="rounded-xl border p-4" :class="financeClosureGate.ready ? 'border-success/30 bg-success/5' : 'border-destructive/30 bg-destructive/5'">
                    <template v-if="financeClosureGate.ready">
                      <p class="flex items-center gap-1.5 text-sm font-medium text-success">
                        <CheckCircle2 class="h-4 w-4 shrink-0" />Tidak ada blocker — siap Close Finance.
                      </p>
                    </template>
                    <template v-else>
                      <div class="flex items-center justify-between gap-2">
                        <p class="text-xs font-medium text-destructive">
                          Blocker sebelum Close Finance
                        </p>
                        <span class="shrink-0 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">
                          0 / {{ financeClosureGate.blockers.length }} selesai
                        </span>
                      </div>
                      <ul class="mt-2 list-disc list-inside space-y-1 text-xs text-destructive">
                        <li v-for="(blocker, index) in financeClosureGate.blockers" :key="index">
                          {{ blocker }}
                        </li>
                      </ul>
                    </template>
                    <Button v-if="canManageFinance" size="sm" class="mt-3 w-full" :disabled="!financeClosureGate.ready" @click="submitCloseFinance">
                      Close Finance
                    </Button>
                  </div>
                </div>
              </div>

              <div class="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
                <ProjectInvoicesPanel
                  :invoices="invoices"
                  :can-manage-finance="canManageFinance"
                  @create-invoice="openCreateInvoice"
                  @record-payment="openRecordPayment"
                  @download-pdf="(invoice) => showToast('PDF (Mock)', `${invoice.id} — simulasi unduhan PDF, tidak ada file nyata (D-006).`, 'info')"
                />

                <!-- Rincian Harga + Credit/Debit Notes ditumpuk satu kolom (bukan grid 2 kolom terpisah) supaya mengisi tinggi kolom kanan sejajar dengan Invoice & Pembayaran yang biasanya lebih tinggi, tidak menyisakan space kosong di bawah Rincian Harga. -->
                <div class="space-y-4">
                  <ProjectPricingBreakdownCard
                    :quotation-amount-idr="project.quotationAmountIdr"
                    :invoice-issued-idr="invoiceIssuedIdr"
                    :collected-idr="collectedIdr"
                    :outstanding-idr="projectOutstandingIdr"
                  />

                  <SectionCard compact titleClass="text-sm font-bold normal-case tracking-normal text-foreground" title="Credit / Debit Notes" description="Kelola dari Finance &gt; Credit/Debit Notes.">
                    <template #actions>
                      <NuxtLink to="/finance/invoices#notes">
                        <Button size="sm">
                          <Plus class="h-3.5 w-3.5 mr-1" />Add Note
                        </Button>
                      </NuxtLink>
                    </template>
                    <div class="space-y-3">
                      <div>
                        <p class="text-xs font-medium text-muted-foreground mb-1.5">
                          Credit Notes
                        </p>
                        <ul v-if="projectCreditNotes.length" class="divide-y divide-border">
                          <li v-for="note in projectCreditNotes" :key="note.id" class="py-1.5">
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
                      <div class="border-t border-border pt-3">
                        <p class="text-xs font-medium text-muted-foreground mb-1.5">
                          Debit Notes
                        </p>
                        <ul v-if="projectDebitNotes.length" class="divide-y divide-border">
                          <li v-for="note in projectDebitNotes" :key="note.id" class="py-1.5">
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
              </div>

              <SectionCard compact titleClass="text-sm font-bold normal-case tracking-normal text-foreground" title="Supplier Invoice (AP Summary)" description="Reconciliation lengkap di Finance &gt; Reconciliation.">
                <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Supplier Invoice</TableHead>
                        <TableHead>Vendor</TableHead>
                        <TableHead>Jumlah</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Match Status</TableHead>
                        <TableHead class="text-right">Aksi</TableHead>
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
                        <TableCell class="text-right">
                          <Button v-if="canManageFinance && supplierInvoice.status === 'approved'" size="sm" variant="outline" @click="onPaySupplierInvoice(supplierInvoice.id)">
                            Bayar
                          </Button>
                        </TableCell>
                      </TableRow>
                      <TableEmpty v-if="projectSupplierInvoices.length === 0" :colspan="6">
                        <EmptyState
                          :icon="FileText"
                          title="Belum ada Supplier Invoice untuk project ini."
                          description="Invoice dari vendor akan muncul di sini untuk proses reconciliation."
                        />
                      </TableEmpty>
                    </TableBody>
                  </Table>
              </SectionCard>

              <SectionCard compact titleClass="text-sm font-bold normal-case tracking-normal text-foreground" title="Pengeluaran Project" description="Pengeluaran ad-hoc (transport, konsumsi, perlengkapan, dll) yang langsung tercatat dan ikut Actual Cost — tanpa approval berlapis.">
                <template v-if="canManageFinance" #actions>
                  <Button size="sm" variant="outline" @click="openCreateExpense">
                    + Catat Pengeluaran
                  </Button>
                </template>
                <ul v-if="projectExpenses.length" class="divide-y divide-border">
                  <li v-for="expense in projectExpenses" :key="expense.id" class="flex items-center justify-between gap-3 py-2.5">
                    <div class="min-w-0 flex-1">
                      <div class="flex items-center gap-2">
                        <StatusBadge :label="findStatusOption(PROJECT_EXPENSE_CATEGORIES, expense.category).label" :tone="findStatusOption(PROJECT_EXPENSE_CATEGORIES, expense.category).tone" />
                        <span class="text-xs text-muted-foreground">{{ formatDate(expense.incurredAt) }}</span>
                      </div>
                      <p class="mt-0.5 truncate text-sm text-foreground">
                        <span class="font-ticket-mono text-xs text-muted-foreground">{{ expense.id }}</span> {{ expense.description }}
                      </p>
                      <p class="text-xs text-muted-foreground">
                        Dicatat oleh {{ getUserById(expense.recordedBy)?.name ?? expense.recordedBy }}
                      </p>
                    </div>
                    <span class="shrink-0 text-sm font-semibold tabular-nums text-foreground">{{ formatCurrencyIdr(expense.amountIdr) }}</span>
                  </li>
                </ul>
                <div v-if="projectExpenses.length" class="mt-3 flex items-center justify-end gap-3 border-t border-border pt-3">
                  <span class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Total Actual Expense</span>
                  <span class="text-sm font-semibold tabular-nums text-success">{{ formatCurrencyIdr(projectExpensesTotalIdr) }}</span>
                </div>
                <EmptyState v-else :icon="Wallet" title="Belum ada pengeluaran project tercatat" />
              </SectionCard>
            </template>

            <template v-else>
              <SectionCard compact titleClass="text-sm font-bold normal-case tracking-normal text-foreground" title="Finance">
                <p class="text-xs text-muted-foreground mb-4">
                  Ringkasan terbatas — detail Budget, Actual Cost, Committed Vendor Cost, dan Margin hanya terlihat oleh role dengan akses modul Finance.
                </p>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

          <Sheet v-model:open="isServiceBudgetDialogOpen">
            <SheetContent side="right" class="w-full sm:max-w-lg overflow-y-auto">
              <SheetHeader>
                <SheetTitle>Edit Budget {{ serviceBudgetTypeLabel }}</SheetTitle>
                <SheetDescription>Alokasi budget per baris layanan — dijumlahkan sebagai budget tipe ini di "Pengeluaran per Layanan".</SheetDescription>
              </SheetHeader>
              <div class="space-y-4 py-2">
                <div v-for="(_, serviceId) in serviceBudgetForm" :key="serviceId" class="space-y-1.5">
                  <Label :for="`svc-budget-${serviceId}`">{{ serviceLabelById(serviceId) }}</Label>
                  <CurrencyInput :id="`svc-budget-${serviceId}`" v-model="serviceBudgetForm[serviceId]" placeholder="mis. 10000000" />
                </div>
              </div>
              <SheetFooter class="mt-6 flex-row justify-end gap-2">
                <Button variant="outline" @click="isServiceBudgetDialogOpen = false">
                  Batal
                </Button>
                <Button @click="submitServiceBudget">
                  Simpan
                </Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>

          <Sheet v-model:open="isCreateInvoiceOpen">
            <SheetContent side="right" class="w-full sm:max-w-lg overflow-y-auto">
              <SheetHeader>
                <SheetTitle>Buat Invoice</SheetTitle>
                <SheetDescription>Terbitkan invoice langsung untuk project ini — bisa dipecah per termin (DP/Termin/Final) atau satu invoice penuh.</SheetDescription>
              </SheetHeader>
              <div class="space-y-4 py-2">
                <div class="space-y-1.5">
                  <Label for="inv-label">Label Invoice</Label>
                  <Input id="inv-label" v-model="createInvoiceLabel" placeholder="mis. Invoice Tour Bali 5D4N" />
                </div>
                <div class="grid grid-cols-2 gap-3">
                  <div class="space-y-1.5">
                    <Label for="inv-amount">Nilai Invoice (Rp)</Label>
                    <CurrencyInput id="inv-amount" v-model="createInvoiceAmountIdr" placeholder="mis. 95000000" />
                    <p class="text-[11px] text-muted-foreground">
                      Default sisa nilai kontrak yang belum ditagih.
                    </p>
                  </div>
                  <div class="space-y-1.5">
                    <Label for="inv-due">Jatuh Tempo</Label>
                    <Input id="inv-due" v-model="createInvoiceDueAt" type="date" />
                  </div>
                </div>
                <div class="space-y-1.5">
                  <Label for="inv-type">Tipe Invoice</Label>
                  <select id="inv-type" v-model="createInvoiceType" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                    <option v-for="option in INVOICE_TYPES" :key="option.value" :value="option.value">
                      {{ option.label }}
                    </option>
                  </select>
                </div>

                <div class="space-y-1.5 border-t border-border pt-4">
                  <Label for="inv-template">Template Milestone (opsional)</Label>
                  <select id="inv-template" :value="createInvoiceTemplateKey" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer" @change="applyInvoiceMilestoneTemplate(($event.target as HTMLSelectElement).value)">
                    <option value="">
                      Tanpa milestone (satu invoice utuh)
                    </option>
                    <option v-for="template in INVOICE_MILESTONE_TEMPLATES" :key="template.key" :value="template.key">
                      {{ template.label }}
                    </option>
                  </select>
                  <p class="text-[11px] text-muted-foreground">
                    Bisa diedit/ditambah/dihapus di bawah — total wajib 100%.
                  </p>
                </div>

                <div v-if="createInvoiceMilestones.length" class="space-y-2">
                  <div v-for="(milestone, index) in createInvoiceMilestones" :key="index" class="flex items-center gap-2">
                    <Input v-model="milestone.label" placeholder="mis. Termin 1" class="flex-1" />
                    <div class="relative w-24 shrink-0">
                      <input v-model.number="milestone.percent" type="number" min="0" max="100" class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 pr-6 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                      <span class="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                    </div>
                    <span class="w-28 shrink-0 truncate text-right text-xs text-muted-foreground">
                      {{ formatCurrencyIdr(Math.round((createInvoiceAmountIdr ?? 0) * (milestone.percent || 0) / 100)) }}
                    </span>
                    <button type="button" class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-destructive" @click="removeInvoiceMilestoneRow(index)">
                      <Trash2 class="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div class="flex items-center justify-between">
                    <button type="button" class="text-xs font-medium text-primary hover:underline" @click="addInvoiceMilestoneRow">
                      + Tambah Milestone
                    </button>
                    <span class="text-xs font-semibold" :class="createInvoiceMilestonesValid ? 'text-success' : 'text-destructive'">
                      Total: {{ createInvoiceMilestonesTotalPercent }}%
                    </span>
                  </div>
                </div>
                <button v-else type="button" class="text-xs font-medium text-primary hover:underline" @click="addInvoiceMilestoneRow">
                  + Tambah Milestone
                </button>

                <div class="space-y-1.5 border-t border-border pt-4">
                  <Label for="inv-notes">Catatan (opsional)</Label>
                  <textarea id="inv-notes" v-model="createInvoiceNotes" rows="2" class="w-full px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring" placeholder="mis. Rujukan kontrak/PO" />
                </div>
              </div>
              <SheetFooter class="mt-6 flex-row justify-end gap-2">
                <Button variant="outline" @click="isCreateInvoiceOpen = false">
                  Batal
                </Button>
                <Button :disabled="!createInvoiceLabel.trim() || !createInvoiceAmountIdr || !createInvoiceDueAt || !createInvoiceMilestonesValid" @click="submitCreateInvoice">
                  Buat Invoice
                </Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>

          <Sheet v-model:open="isRecordPaymentOpen">
            <SheetContent side="right" class="w-full sm:max-w-lg overflow-y-auto">
              <SheetHeader>
                <SheetTitle>Record Payment</SheetTitle>
                <SheetDescription>Catat pembayaran untuk invoice {{ recordPaymentInvoice?.id }} — mock ledger update, bukan payment gateway nyata.</SheetDescription>
              </SheetHeader>
              <div class="space-y-4 py-2">
                <div class="rounded-lg border border-border bg-muted/40 p-3">
                  <div class="flex items-center justify-between">
                    <span class="text-xs text-muted-foreground">Outstanding Balance</span>
                    <span class="text-sm font-semibold tabular-nums text-foreground">{{ formatCurrencyIdr(recordPaymentOutstandingIdr) }}</span>
                  </div>
                </div>

                <div v-if="recordPaymentInvoice?.milestones?.length" class="space-y-1.5">
                  <Label for="pay-milestone">Milestone</Label>
                  <select id="pay-milestone" v-model="recordPaymentMilestoneId" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                    <option v-for="milestone in recordPaymentInvoice.milestones" :key="milestone.id" :value="milestone.id" :disabled="getInvoiceMilestoneOutstandingIdr(recordPaymentInvoice.id, milestone.id) <= 0">
                      {{ milestone.label }} — {{ formatCurrencyIdr(milestone.amountIdr) }}
                    </option>
                  </select>
                  <p class="text-[11px] text-muted-foreground">
                    Outstanding milestone ini: {{ formatCurrencyIdr(recordPaymentOutstandingIdr) }}
                  </p>
                </div>

                <div class="space-y-1.5">
                  <Label for="pay-amount">Amount (IDR)</Label>
                  <CurrencyInput id="pay-amount" v-model="recordPaymentAmountIdr" :disabled="recordPaymentPayFull" placeholder="Rp 0" />
                </div>
                <label class="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                  <Checkbox v-model="recordPaymentPayFull" />
                  Bayar penuh sisa outstanding ({{ formatCurrencyIdr(recordPaymentOutstandingIdr) }})
                </label>

                <div class="space-y-1.5">
                  <Label for="pay-method">Payment Method</Label>
                  <select id="pay-method" v-model="recordPaymentMethod" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                    <option value="bank-transfer">
                      Bank Transfer
                    </option>
                    <option value="credit-card">
                      Credit Card
                    </option>
                    <option value="cash">
                      Cash
                    </option>
                  </select>
                </div>
                <div class="space-y-1.5">
                  <Label for="pay-date">Payment Date</Label>
                  <Input id="pay-date" v-model="recordPaymentDate" type="date" />
                </div>
                <div class="space-y-1.5">
                  <Label for="pay-reference">Reference/Notes (opsional)</Label>
                  <textarea id="pay-reference" v-model="recordPaymentReference" rows="2" class="w-full px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring" placeholder="mis. Transfer ID, nomor kuitansi, atau catatan lain" />
                </div>
              </div>
              <SheetFooter class="mt-6 flex-row justify-end gap-2">
                <Button variant="outline" @click="isRecordPaymentOpen = false">
                  Batal
                </Button>
                <Button :disabled="!recordPaymentAmountIdr || recordPaymentAmountIdr <= 0 || !recordPaymentDate" @click="submitRecordPayment">
                  Record Payment
                </Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        </TabsContent>

        <TabsContent value="tasks">
          <div class="space-y-6">
            <!-- Task Overview — ringkasan status task (klik salah satu tile untuk membuka papan Kanban terfilter di bawah). -->
            <div class="rounded-xl border border-border bg-card p-4 shadow-sm">
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div class="flex items-center gap-2.5">
                  <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <ListChecks class="h-4 w-4" />
                  </div>
                  <div>
                    <p class="text-xs font-bold uppercase tracking-wide text-foreground">
                      Task Overview
                    </p>
                    <p class="text-xs text-muted-foreground">
                      Progress tugas project secara keseluruhan
                    </p>
                  </div>
                </div>
                <div class="flex items-center gap-1.5">
                  <Button v-if="canManageProjectOrder" size="sm" variant="outline" @click="openCreateTask">
                    <Plus class="h-3.5 w-3.5 mr-1" />Tambah Task
                  </Button>
                  <Button v-if="tasks.length" size="sm" class="border-primary/25 bg-primary/10 text-primary hover:bg-primary/20" variant="outline" @click="showAllTasks">
                    <ListChecks class="h-3.5 w-3.5 mr-1.5" />Lihat Semua<ChevronRight class="h-3.5 w-3.5 ml-1" />
                  </Button>
                </div>
              </div>

              <div v-if="tasks.length" class="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <button
                  v-for="tile in taskOverviewTiles"
                  :key="tile.key"
                  type="button"
                  class="rounded-lg border p-3 text-left transition-colors hover:border-primary/30 hover:bg-muted/20"
                  :class="taskBoardStatusFilter === tile.key ? 'border-primary/40 bg-primary/5' : 'border-border'"
                  @click="toggleTaskStatusTile(tile.key)"
                >
                  <div class="flex items-center gap-2">
                    <div class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full" :class="tile.toneClasses.iconBg">
                      <component :is="tile.icon" class="h-3.5 w-3.5" :class="tile.toneClasses.icon" />
                    </div>
                    <span class="truncate text-xs font-medium text-foreground">{{ tile.label }}</span>
                  </div>
                  <div class="mt-2 flex items-end justify-between gap-2">
                    <p class="text-lg font-bold leading-none text-foreground tabular-nums">
                      {{ tile.count }}
                    </p>
                    <span class="rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums" :class="tile.toneClasses.badge">{{ tile.percent }}%</span>
                  </div>
                  <p class="mt-0.5 text-[11px] text-muted-foreground">
                    {{ tile.subtitle }}
                  </p>
                  <div class="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-muted">
                    <div class="h-full rounded-full transition-all" :class="tile.toneClasses.bar" :style="{ width: `${tile.percent}%` }" />
                  </div>
                </button>

                <div class="rounded-lg border border-border p-3">
                  <div class="flex items-center justify-between gap-2">
                    <p class="text-xs font-medium text-foreground">
                      Task Due Soon
                    </p>
                    <span v-if="tasksDueSoon.length" class="shrink-0 rounded-full bg-destructive/10 px-1.5 py-0.5 text-[10px] font-semibold text-destructive">{{ tasksDueSoon.length }}</span>
                  </div>
                  <ul v-if="tasksDueSoon.length" class="mt-2 space-y-2">
                    <li v-for="task in tasksDueSoon.slice(0, 2)" :key="task.id" class="flex items-start gap-2">
                      <span class="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" :class="isTaskDueVerySoon(task) ? 'bg-destructive' : 'bg-warning'" />
                      <div class="min-w-0">
                        <p class="truncate text-[11px] font-medium text-foreground">
                          {{ task.title }}
                        </p>
                        <p class="text-[10px] text-muted-foreground">
                          Jatuh tempo: <span :class="isTaskDueVerySoon(task) ? 'text-destructive font-medium' : 'text-warning font-medium'">{{ formatDate(task.dueAt) }}</span>
                        </p>
                      </div>
                    </li>
                  </ul>
                  <p v-else class="mt-2 text-[11px] text-muted-foreground">
                    Tidak ada task jatuh tempo dalam waktu dekat.
                  </p>
                </div>
              </div>
              <EmptyState v-else title="Belum ada task tercatat" />
            </div>

            <!-- Task Progress Timeline — dipisah di atas Kanban board (bukan lagi toggle), milestone project ini (`getProjectMilestones`), digambar horizontal ala Order Status Stepper (Overview). -->
            <div v-if="milestones.length" class="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div class="flex items-center gap-3">
                  <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <GanttChartSquare class="h-5 w-5" />
                  </div>
                  <div>
                    <p class="text-sm font-bold uppercase tracking-wide text-foreground">
                      Task Progress Timeline
                    </p>
                    <p class="mt-0.5 text-xs text-muted-foreground">
                      Periode: {{ formatDateRange(project.travelStartDate, project.travelEndDate) }}
                    </p>
                  </div>
                </div>
              </div>
              <div class="overflow-x-auto no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden pb-1">
                <ol class="flex min-w-[640px] items-start">
                  <li v-for="(milestone, index) in milestones" :key="milestone.id" class="flex flex-1 items-start last:flex-none">
                    <div class="flex w-[150px] shrink-0 flex-col items-center gap-2 px-1">
                      <span
                        class="flex h-9 w-9 items-center justify-center rounded-full border-2 text-xs font-semibold shadow-sm"
                        :class="milestone.status === 'completed' ? 'border-primary bg-primary text-primary-foreground' : milestone.status === 'delayed' ? 'border-destructive bg-destructive text-destructive-foreground' : milestone.status === 'in-progress' ? 'border-primary bg-primary/15 text-primary' : 'border-border bg-muted text-muted-foreground'"
                      >
                        <Check v-if="milestone.status === 'completed'" class="h-4 w-4" />
                        <AlertTriangle v-else-if="milestone.status === 'delayed'" class="h-4 w-4" />
                        <span
                          v-else-if="milestone.status === 'in-progress'"
                          class="h-4 w-4 rounded-full"
                          style="background: conic-gradient(hsl(var(--primary)) 0deg 180deg, transparent 180deg 360deg)"
                        />
                        <template v-else>{{ index + 1 }}</template>
                      </span>
                      <div class="flex flex-col items-center gap-1 text-center">
                        <span class="text-xs font-medium text-foreground">{{ milestone.name }}</span>
                        <span class="text-[11px] text-muted-foreground">
                          {{ milestone.actualDate ? formatDate(milestone.actualDate) : (milestone.status === 'in-progress' ? `Start: ${formatDate(milestone.plannedDate)}` : `Due: ${formatDate(milestone.plannedDate)}`) }}
                        </span>
                        <StatusBadge :label="TASK_TIMELINE_STATUS_META[milestone.status].label" :tone="TASK_TIMELINE_STATUS_META[milestone.status].tone" />
                      </div>
                    </div>
                    <span
                      v-if="index < milestones.length - 1"
                      class="mt-[16px] h-[3px] flex-1 rounded-full"
                      :class="milestone.status === 'completed' ? 'bg-primary' : 'bg-border'"
                    />
                  </li>
                </ol>
              </div>
            </div>

            <!-- Tasks Kanban Board — kolom diberi tint warna lembut per status (bukan cuma header) supaya halaman terasa lebih hidup, kartu task TETAP putih polos di atasnya supaya tidak "nabrak" dengan tint kolom. -->
            <div ref="taskBoardRef" class="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div class="flex items-center gap-3">
                  <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Kanban class="h-5 w-5" />
                  </div>
                  <div>
                    <p class="text-sm font-bold uppercase tracking-wide text-foreground">
                      Tasks Kanban Board
                    </p>
                    <p class="mt-0.5 text-xs text-muted-foreground">
                      Kelola dan pantau progress task dengan mudah.
                    </p>
                  </div>
                </div>
                <div class="flex flex-wrap items-center gap-2">
                  <select
                    :value="taskBoardStatusFilter ?? ''"
                    class="appearance-none rounded-lg border border-input bg-card py-1.5 pl-3 pr-8 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer"
                    @change="taskBoardStatusFilter = ($event.target as HTMLSelectElement).value || null"
                  >
                    <option value="">
                      Semua Status
                    </option>
                    <option v-for="option in TASK_STATUSES" :key="option.value" :value="option.value">
                      {{ option.label }}
                    </option>
                  </select>
                  <Button v-if="taskBoardStatusFilter" size="sm" variant="ghost" @click="showAllTasks">
                    Reset Filter
                  </Button>
                </div>
              </div>

              <div class="flex gap-4 overflow-x-auto pb-1">
                <div
                  v-for="status in visibleTaskStatuses"
                  :key="status.value"
                  class="w-72 shrink-0"
                >
                  <div class="mb-2 flex items-center justify-between gap-2 px-0.5">
                    <div class="flex items-center gap-2">
                      <span class="rounded-full px-2.5 py-1 text-xs font-semibold shadow-sm" :class="TASK_TILE_TONE_CLASSES[TASK_COLUMN_TONE[status.value]].solid">{{ status.label }}</span>
                      <span class="text-sm font-semibold text-foreground">{{ tasks.filter(t => t.status === status.value).length }}</span>
                    </div>
                    <div class="flex items-center gap-0.5">
                      <button type="button" class="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground" title="Menu Kolom" @click="handleTaskColumnMenu(status)">
                        <MoreHorizontal class="h-3.5 w-3.5" />
                      </button>
                      <button v-if="canManageProjectOrder" type="button" class="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground" title="Tambah Task" @click="openCreateTask">
                        <Plus class="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <div class="space-y-2 rounded-xl bg-muted/40 p-2.5 min-h-[560px]">
                    <div
                      v-for="task in tasks.filter(t => t.status === status.value)"
                      :key="task.id"
                      class="rounded-lg border border-border bg-card p-3 shadow-sm"
                    >
                      <div class="flex items-start justify-between gap-2">
                        <div class="min-w-0 w-full flex items-start gap-1.5 flex-wrap">
                          <span v-if="task.isMilestone" class="shrink-0 rounded-full border border-primary/30 bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">Milestone</span>
                          <span class="min-w-0 flex-1 text-sm font-medium text-foreground break-words [overflow-wrap:anywhere]">{{ task.title }}</span>
                        </div>
                      </div>
                      <StatusBadge v-if="task.isBlocked" label="Blocked" tone="destructive" class="mt-1.5" />
                      <p class="text-xs text-muted-foreground mt-1.5">
                        <template v-if="task.dueAt">
                          Due {{ formatDate(task.dueAt) }}<template v-if="task.dependsOnTaskId">
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
                        <div class="flex min-w-0 items-center gap-1.5">
                          <Avatar v-if="task.assignedTo" class="h-5 w-5 shrink-0" :title="getUserById(task.assignedTo)?.name ?? task.assignedTo">
                            <AvatarFallback class="bg-primary/15 text-[9px] font-semibold text-primary">
                              {{ initials(getUserById(task.assignedTo)?.name) }}
                            </AvatarFallback>
                          </Avatar>
                          <template v-if="canManageProjectOrder">
                            <Button v-if="task.isBlocked" size="xs" variant="ghost" @click="unblockTask(task)">
                              Buka Blokir
                            </Button>
                            <Button v-else size="xs" variant="ghost" @click="openBlockDialog(task)">
                              Blokir
                            </Button>
                          </template>
                        </div>
                        <select
                          :value="task.status"
                          :disabled="!canManageProjectOrder"
                          class="shrink-0 appearance-none px-2 py-1 text-xs rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer disabled:cursor-not-allowed"
                          @change="handleTaskStatusChange(task.id, $event)"
                        >
                          <option v-for="option in TASK_STATUSES" :key="option.value" :value="option.value">
                            {{ option.label }}
                          </option>
                        </select>
                      </div>
                    </div>

                    <div v-if="tasks.filter(t => t.status === status.value).length === 0" class="flex flex-col items-center gap-2 rounded-lg border border-dashed py-6 text-center" :class="TASK_TILE_TONE_CLASSES[TASK_COLUMN_TONE[status.value]].border">
                      <div class="flex h-9 w-9 items-center justify-center rounded-full bg-card shadow-sm">
                        <component :is="TASK_COLUMN_ICON[status.value]" class="h-4 w-4" :class="TASK_TILE_TONE_CLASSES[TASK_COLUMN_TONE[status.value]].icon" />
                      </div>
                      <p class="px-2 text-xs text-muted-foreground">
                        Belum ada task pada tahap ini
                      </p>
                    </div>

                    <Button v-if="canManageProjectOrder" size="sm" variant="ghost" class="w-full justify-center text-muted-foreground hover:bg-card" @click="openCreateTask">
                      <Plus class="h-3.5 w-3.5 mr-1" />Tambah Task
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>

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
                  <Label for="task-title">Judul</Label><Input id="task-title" v-model="taskTitle" maxlength="120" />
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
          <SectionCard compact titleClass="text-sm font-bold normal-case tracking-normal text-foreground" title="Documents" description="Kelola dan akses semua dokumen project secara terstruktur.">
            <template #actions>
              <div class="flex flex-wrap items-center gap-2">
                <div class="inline-flex items-center rounded-lg border border-input bg-muted/40 p-0.5">
                  <button
                    type="button"
                    class="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-200"
                    :class="documentsViewMode === 'list' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'"
                    @click="documentsViewMode = 'list'"
                  >
                    <List class="h-3.5 w-3.5" />List
                  </button>
                  <button
                    type="button"
                    class="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-200"
                    :class="documentsViewMode === 'grid' ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/30' : 'text-muted-foreground hover:text-foreground'"
                    @click="documentsViewMode = 'grid'"
                  >
                    <LayoutGrid class="h-3.5 w-3.5" />Grid
                  </button>
                </div>
                <Button v-if="canManageOperations" size="sm" @click="openUploadDocument">
                  <Plus class="h-3.5 w-3.5 mr-1.5" />Upload Document
                </Button>
                <NuxtLink to="/documents">
                  <Button size="sm" variant="outline">
                    <FolderOpen class="h-3.5 w-3.5 mr-1.5" />Buka Documents & Communication
                  </Button>
                </NuxtLink>
              </div>
            </template>

            <div class="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-muted/20 p-3">
              <div class="relative min-w-[200px] flex-1">
                <Search class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input v-model="documentSearchQuery" placeholder="Cari dokumen..." class="pl-9" />
              </div>
              <Select v-model="documentCategoryFilter">
                <SelectTrigger class="w-full sm:w-44">
                  <SelectValue placeholder="Semua Kategori" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    Semua Kategori
                  </SelectItem>
                  <SelectItem v-for="category in documentCategoryOptions" :key="category" :value="category">
                    {{ category }}
                  </SelectItem>
                </SelectContent>
              </Select>
              <Select v-model="documentAccessLevelFilter">
                <SelectTrigger class="w-full sm:w-44">
                  <SelectValue placeholder="Semua Access Level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    Semua Access Level
                  </SelectItem>
                  <SelectItem v-for="level in DOCUMENT_ACCESS_LEVELS" :key="level.value" :value="level.value">
                    {{ level.label }}
                  </SelectItem>
                </SelectContent>
              </Select>
              <Select v-model="documentExpiryFilter">
                <SelectTrigger class="w-full sm:w-40">
                  <SelectValue placeholder="Semua Expiry" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    Semua Expiry
                  </SelectItem>
                  <SelectItem value="none">
                    Tidak Ada
                  </SelectItem>
                  <SelectItem value="expiring-soon">
                    Segera Expired
                  </SelectItem>
                  <SelectItem value="expired">
                    Sudah Expired
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div class="min-h-[420px]">
              <Transition name="docs-view" mode="out-in">
                <Table v-if="documentsViewMode === 'list'" key="list">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Dokumen</TableHead>
                      <TableHead>Kategori</TableHead>
                      <TableHead>Access Level</TableHead>
                      <TableHead>Expired / Expiry</TableHead>
                      <TableHead>Upload Oleh</TableHead>
                      <TableHead class="text-right">
                        Aksi
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow v-for="document in paginatedDocuments" :key="document.id">
                      <TableCell class="max-w-[300px]">
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
                      <TableCell><StatusBadge :label="document.category" :tone="documentCategoryTone(document.category)" /></TableCell>
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
                        <p class="text-xs text-foreground">
                          {{ documentUploaderName(document) }}
                        </p>
                        <p class="text-xs text-muted-foreground">
                          {{ documentUploadedDate(document) }}
                        </p>
                      </TableCell>
                      <TableCell class="text-right">
                        <div class="flex items-center justify-end gap-2">
                          <button type="button" class="inline-flex items-center gap-1 text-xs text-primary hover:underline" @click="handleDownloadDocument(document)">
                            <Download class="h-3 w-3" />Download
                          </button>
                          <button type="button" class="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground" title="Lainnya" @click="handleDocumentMenu(document)">
                            <MoreVertical class="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                    <TableEmpty v-if="paginatedDocuments.length === 0" :colspan="6">
                      <EmptyState
                        :icon="FileText"
                        :title="unifiedDocuments.length === 0 ? 'Belum ada dokumen diunggah' : 'Tidak ada dokumen sesuai filter'"
                      />
                    </TableEmpty>
                  </TableBody>
                </Table>

                <div v-else-if="paginatedDocuments.length" key="grid" class="grid content-start grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  <div
                    v-for="document in paginatedDocuments"
                    :key="document.id"
                    class="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-gradient-to-b from-card to-muted/20 p-3.5 transition-all duration-300 hover:-translate-y-1 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10"
                  >
                    <span class="absolute inset-x-0 top-0 h-0.5 origin-left scale-x-0 bg-gradient-to-r from-primary to-primary/30 transition-transform duration-300 group-hover:scale-x-100" />
                    <div class="mb-3 flex items-start justify-between">
                      <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset ring-border/60" :class="TONE_ICON_BG[documentCategoryTone(document.category)]">
                        <FileText class="h-4.5 w-4.5" />
                      </div>
                      <button type="button" class="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100" title="Lainnya" @click="handleDocumentMenu(document)">
                        <MoreVertical class="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <p class="truncate text-sm font-semibold leading-tight text-foreground" :title="document.name">
                      {{ document.name }}
                    </p>
                    <p class="mt-1 truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      {{ document.category }} · v{{ document.version }}
                    </p>
                    <div class="mt-2.5 flex flex-wrap items-center gap-1.5">
                      <StatusBadge :label="findStatusOption(DOCUMENT_ACCESS_LEVELS, document.accessLevel).label" :tone="findStatusOption(DOCUMENT_ACCESS_LEVELS, document.accessLevel).tone" />
                      <StatusBadge
                        v-if="document.expiresAt"
                        :label="isDocumentExpired(document.expiresAt) ? `Expired ${formatDate(document.expiresAt)}` : isDocumentExpiringSoon(document.expiresAt) ? `Segera: ${formatDate(document.expiresAt)}` : formatDate(document.expiresAt)"
                        :tone="isDocumentExpired(document.expiresAt) ? 'destructive' : isDocumentExpiringSoon(document.expiresAt) ? 'warning' : 'neutral'"
                      />
                    </div>
                    <div class="mt-3 flex items-center justify-between gap-2 border-t border-border/70 pt-2.5">
                      <div class="min-w-0">
                        <p class="truncate text-xs text-foreground">
                          {{ documentUploaderName(document) }}
                        </p>
                        <p class="truncate text-[11px] text-muted-foreground">
                          {{ documentUploadedDate(document) }}
                        </p>
                      </div>
                      <div class="flex shrink-0 items-center gap-1">
                        <NuxtLink v-if="document.sourceType === 'generated' && document.previewRoute" :to="document.previewRoute" target="_blank" class="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-primary" title="Preview">
                          <Eye class="h-3.5 w-3.5" />
                        </NuxtLink>
                        <button type="button" class="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-primary" title="Download" @click="handleDownloadDocument(document)">
                          <Download class="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                <EmptyState
                  v-else
                  key="empty"
                  :title="unifiedDocuments.length === 0 ? 'Belum ada dokumen diunggah' : 'Tidak ada dokumen sesuai filter'"
                />
              </Transition>
            </div>

            <div v-if="filteredDocuments.length" class="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
              <p class="text-xs text-muted-foreground">
                Menampilkan {{ (documentsCurrentPage - 1) * DOCUMENTS_PAGE_SIZE + 1 }} - {{ Math.min(documentsCurrentPage * DOCUMENTS_PAGE_SIZE, filteredDocuments.length) }} dari {{ filteredDocuments.length }} dokumen
              </p>
              <div v-if="documentsTotalPages > 1" class="flex items-center gap-1">
                <button
                  type="button"
                  class="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-40"
                  :disabled="documentsCurrentPage === 1"
                  @click="documentsCurrentPage = Math.max(1, documentsCurrentPage - 1)"
                >
                  <ChevronLeft class="h-3.5 w-3.5" />
                </button>
                <button
                  v-for="page in documentsTotalPages"
                  :key="page"
                  type="button"
                  class="flex h-7 min-w-7 items-center justify-center rounded-md border px-2 text-xs font-medium transition-colors"
                  :class="page === documentsCurrentPage ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:bg-muted'"
                  @click="documentsCurrentPage = page"
                >
                  {{ page }}
                </button>
                <button
                  type="button"
                  class="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-40"
                  :disabled="documentsCurrentPage === documentsTotalPages"
                  @click="documentsCurrentPage = Math.min(documentsTotalPages, documentsCurrentPage + 1)"
                >
                  <ChevronRight class="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </SectionCard>

          <Sheet v-model:open="isDocumentUploadDialogOpen">
            <SheetContent side="right" class="w-full sm:max-w-lg overflow-y-auto">
              <SheetHeader>
                <SheetTitle>Upload Document</SheetTitle>
                <SheetDescription>Mock — metadata saja, tidak ada file storage nyata (D-006).</SheetDescription>
              </SheetHeader>
              <div class="space-y-4 py-2">
                <div class="space-y-1.5">
                  <Label for="doc-name">Nama Dokumen</Label>
                  <Input id="doc-name" v-model="documentUploadForm.name" placeholder="mis. Kontrak Kerjasama PRJ-101.pdf" />
                </div>
                <div class="space-y-1.5">
                  <Label for="doc-category">Kategori</Label>
                  <Input id="doc-category" v-model="documentUploadForm.category" placeholder="mis. Contract, Finance, Quotation" list="doc-category-options" />
                  <datalist id="doc-category-options">
                    <option v-for="category in documentCategoryOptions" :key="category" :value="category" />
                  </datalist>
                </div>
                <div class="space-y-1.5">
                  <Label for="doc-access">Access Level</Label>
                  <select id="doc-access" v-model="documentUploadForm.accessLevel" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                    <option v-for="level in DOCUMENT_ACCESS_LEVELS" :key="level.value" :value="level.value">
                      {{ level.label }}
                    </option>
                  </select>
                </div>
                <div class="space-y-1.5">
                  <Label for="doc-expiry">Expiry (opsional)</Label>
                  <Input id="doc-expiry" v-model="documentUploadForm.expiresAt" type="date" />
                </div>
              </div>
              <SheetFooter class="mt-6 flex-row justify-end gap-2">
                <Button variant="outline" @click="isDocumentUploadDialogOpen = false">
                  Batal
                </Button>
                <Button :disabled="!documentUploadForm.name.trim() || !documentUploadForm.category.trim()" @click="submitUploadDocument">
                  Upload
                </Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        </TabsContent>

        <TabsContent value="activity-changes">
          <div ref="activityHistoryRef" class="space-y-4">
            <SectionCard compact titleClass="text-sm font-bold normal-case tracking-normal text-foreground" title="Riwayat Aktivitas" description="Riwayat kronologis perubahan, komunikasi, dan event sistem untuk project ini — Activity/Change, Message, System Event, dan Document dalam satu list (Section 21, D-078).">
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
                  class="py-3 flex items-start gap-3"
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

            <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <SectionCard compact titleClass="text-sm font-bold normal-case tracking-normal text-foreground" title="Change Requests" description="Change Request terstruktur (before/after, dampak, approval) — Section 19, D-076. Lihat modul Changes & Incidents untuk daftar lengkap lintas project.">
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

              <SectionCard compact titleClass="text-sm font-bold normal-case tracking-normal text-foreground" title="Cancellations" description="Penalty-tracking seragam lintas Flight/Hotel/Transport/MICE — dibuat otomatis saat booking dibatalkan.">
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

            <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <SectionCard compact titleClass="text-sm font-bold normal-case tracking-normal text-foreground" title="Refund Requests">
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

              <SectionCard compact titleClass="text-sm font-bold normal-case tracking-normal text-foreground" title="Incidents">
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

    <LeadDetailSheet v-if="project" v-model:open="isLeadDetailSheetOpen" :lead-id="project.leadId ?? null" />
  </div>
</template>

<style scoped>
/* Toggle List/Grid tab Documents — cross-fade + slide halus alih-alih snap instan antar 2 struktur DOM berbeda (Table vs grid card). */
.docs-view-enter-active {
  transition: opacity 0.28s cubic-bezier(0.22, 1, 0.36, 1), transform 0.28s cubic-bezier(0.22, 1, 0.36, 1);
}
.docs-view-leave-active {
  transition: opacity 0.16s ease, transform 0.16s ease;
}
.docs-view-enter-from {
  opacity: 0;
  transform: translateY(6px) scale(0.99);
}
.docs-view-leave-to {
  opacity: 0;
  transform: translateY(-4px) scale(0.99);
}

@media (prefers-reduced-motion: reduce) {
  .docs-view-enter-active,
  .docs-view-leave-active {
    transition: none;
  }
  .docs-view-enter-from,
  .docs-view-leave-to {
    transform: none;
  }
}
</style>
