<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { FileX, Plus } from 'lucide-vue-next'
import {
  getProjectById, getPartyById, getOpportunityById, getUserById,
  getClientVisibleItineraryItems, getTravelers, createTraveler, updateTraveler,
  getDocumentsByProject, getInvoicesByProject, getPaymentsByInvoice,
  createChangeRequest, getChangeRequestsByProject, getIncidentsByProject,
  getCommodityRequirementsByProject, createCommodityRequirement, updateCommodityRequirement, deleteCommodityRequirement,
  isCommodityRequirementEditable, isCommodityRequirementDeletable,
  getServiceReadinessMatrix, getClientReservations, getActivitiesByProject, getProjectClosureSummary,
  getLatestItineraryVersion, getClientDocumentsByProject, getClientDocumentCategory
} from '~/data'
import {
  PROJECT_STATUSES, SERVICE_TYPES, CHANGE_CATEGORIES, INVOICE_STATUSES, INVOICE_TYPES,
  CHANGE_REQUEST_STATUSES, INCIDENT_STATUSES, COMMODITY_REQUIREMENT_STATUSES,
  RESERVATION_CATEGORIES, ITINERARY_VERSION_STATUSES, CLIENT_DOCUMENT_CATEGORIES,
  findStatusOption
} from '~/constants/status'
import { formatCurrencyIdr, formatDate, formatDateRange, formatDayLabel } from '~/utils/format'
import { isTravelerDocumentMissing, isInvoiceOverdue, invoiceAgingDays } from '~/utils/attention'
import type { Traveler, ServiceTypeKey } from '~/types/project'
import type { ChangeCategory } from '~/types/activity'
import type { CommodityRequirement } from '~/types/requirement'
import type { StatusBreakdownItem } from '~/components/shared/StatusBreakdownList.vue'

/**
 * Client-facing Project Order detail (Section 08). Sanitized — TIDAK PERNAH merender
 * `budgetIdr`/`actualCostIdr` (Project) atau data vendor/cost internal apa pun. Tab "Finance" hanya
 * menampilkan Invoice/Payment (sell-side, apa yang benar-benar ditagih ke client), bukan budget/margin.
 * Isolasi: project harus milik `clientScopeId` (company) user login.
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const route = useRoute()
const router = useRouter()
const { canView, clientScopeId } = usePermissions()
const { currentUser } = useCurrentUser()
const { showToast } = useToast()

const project = computed(() => getProjectById(String(route.params.id)))
const isOwnCompany = computed(() => Boolean(project.value && clientScopeId.value && project.value.partyId === clientScopeId.value))
useHead({ title: computed(() => project.value ? project.value.name : 'Tidak Ditemukan') })

const party = computed(() => (project.value ? getPartyById(project.value.partyId) : undefined))
const accountExecutive = computed(() => {
  const opportunity = project.value?.opportunityId ? getOpportunityById(project.value.opportunityId) : undefined
  return opportunity ? getUserById(opportunity.ownerId) : undefined
})
const projectManager = computed(() => (project.value ? getUserById(project.value.ownerId) : undefined))

const activeTab = computed({
  get: () => (route.query.tab as string) || 'overview',
  set: value => router.replace({ query: { ...route.query, tab: value } })
})
/**
 * 12 tab Project Workspace (Repair Phase Section 4 — Core Project, Master Prompt bagian G.6) + 1 tab
 * tambahan "Kebutuhan Komoditas" (Phase Client–Vendor Commodity, di luar 12 daftar Master Prompt, aditif).
 * `value` DIPERTAHANKAN untuk 7 tab lama (travelers/finance/changes tetap value lama meski label berubah
 * jadi Participants/Billing/Change Requests) — deep link existing (`?tab=travelers`/`finance`/`changes` dari
 * Dashboard Section 2 dan Action Required) TIDAK boleh rusak. 6 tab baru: Timeline/Services/Reservations
 * (README singkat + link ke halaman penuh `/client/reservations`)/Issues (dipisah dari "Changes & Incidents"
 * lama)/Activities/Closing — seluruhnya READ-ONLY summary (Wajib "tab milik section lain boleh menampilkan
 * summary terhubung, bukan implementasi ulang" — Documents/Billing sudah penuh sejak Section 08, Change
 * Requests/Issues tetap read-only sampai section "Execution & Changes").
 */
const TABS = [
  { value: 'overview', label: 'Overview' },
  { value: 'timeline', label: 'Timeline' },
  { value: 'services', label: 'Services' },
  { value: 'travelers', label: 'Participants' },
  { value: 'itinerary', label: 'Itinerary' },
  { value: 'reservations', label: 'Reservations' },
  { value: 'documents', label: 'Documents' },
  { value: 'finance', label: 'Billing' },
  { value: 'changes', label: 'Change Requests' },
  { value: 'issues', label: 'Issues' },
  { value: 'activities', label: 'Activities' },
  { value: 'closing', label: 'Closing' },
  { value: 'commodity', label: 'Kebutuhan Komoditas' }
]

const serviceScopeOptions = computed(() => SERVICE_TYPES.filter(type => project.value?.serviceScope.includes(type.value)))
/** "Internal vs client-shared itinerary" (Section 12 baru) — hanya item `visibleToClient !== false` yang boleh tampil di Client Portal. */
const itineraryItems = computed(() => (project.value ? getClientVisibleItineraryItems(project.value.id) : []))
const travelers = computed(() => (project.value ? getTravelers(project.value.id) : []))
const documents = computed(() => (project.value ? getDocumentsByProject(project.value.id) : []))
/** Repair Phase Section 5 (Execution & Changes) — dokumen client-visible kaya (kategori/versi/preview), MENDAMPINGI `documents` (legacy `ProjectDocument`, TIDAK diubah/dihapus) di tab "Documents" di bawah. */
const richDocuments = computed(() => (project.value ? getClientDocumentsByProject(project.value.id) : []))
const invoices = computed(() => (project.value ? getInvoicesByProject(project.value.id) : []))
/**
 * Change Request + Incident sanitized view (Section 19, D-076) — hanya status + before/after summary untuk
 * Change Request (TIDAK PERNAH `operationalImpact`/`commercialImpactIdr`/`financialImpactNote`, internal-only
 * bahkan untuk request milik Client sendiri), dan hanya status + resolution note untuk Incident (TIDAK PERNAH
 * `severity`/`escalatedTo`/`communicationLog`, internal-only mutlak) — pola sanitasi sama Sections 13-16
 * (client hanya melihat `sellPriceIdr`, tidak pernah `netCostIdr`).
 */
const projectChangeRequests = computed(() => (project.value ? getChangeRequestsByProject(project.value.id) : []))
const projectIncidents = computed(() => (project.value ? getIncidentsByProject(project.value.id) : []))

/**
 * Timeline (Repair Phase Section 4, tab baru) — milestone project derivasi murni dari field `Project`
 * existing (`handoverAcceptedAt`/`travelStartDate`/`travelEndDate`/`readyAt`/`closedAt`), BUKAN entitas
 * baru. `budgetIdr`/`actualCostIdr`/handover internal lain TETAP tidak pernah dirender (sanitasi sama).
 */
const projectMilestones = computed(() => {
  if (!project.value) { return [] }
  const items: { id: string; message: string; createdAt: string }[] = []
  if (project.value.handoverAcceptedAt) { items.push({ id: 'handover', message: 'Project Order dikonfirmasi tim kami', createdAt: project.value.handoverAcceptedAt }) }
  items.push({ id: 'start', message: `Keberangkatan — ${project.value.destination}`, createdAt: project.value.travelStartDate })
  items.push({ id: 'end', message: 'Kepulangan', createdAt: project.value.travelEndDate })
  if (project.value.readyAt) { items.push({ id: 'ready', message: 'Project ditandai siap berangkat (Ready)', createdAt: project.value.readyAt }) }
  if (project.value.closedAt) { items.push({ id: 'closed', message: 'Project ditutup (Closed)', createdAt: project.value.closedAt }) }
  return items.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
})

/** Services (Repair Phase Section 4, tab baru) — reuse `getServiceReadinessMatrix` (Section 12), murni derivasi dari `PROJECT_SERVICES`, TIDAK ada cost/vendor internal. */
const serviceReadinessItems = computed<StatusBreakdownItem[]>(() => {
  if (!project.value) { return [] }
  return getServiceReadinessMatrix(project.value.id).map(row => ({
    key: row.type,
    label: findStatusOption(SERVICE_TYPES, row.type).label,
    tone: row.percent === 100 ? 'success' : 'warning',
    count: row.confirmedCount,
    secondaryLabel: `${row.confirmedCount}/${row.total} confirmed`
  }))
})

/** Reservations (Repair Phase Section 4, Wajib) — reuse `getClientReservations` (derivasi `getBookingTimeline`, sanitized), TIDAK ada dataset booking paralel. */
const reservations = computed(() => (project.value ? getClientReservations(project.value.id) : []))
const latestItineraryVersion = computed(() => (project.value ? getLatestItineraryVersion(project.value.id) : undefined))

/** Activities (Repair Phase Section 4, tab baru) — reuse `ACTIVITIES`/`getActivitiesByProject` (log audit satu-satunya, sama sumber dengan Dashboard "Recent Activity" Section 2). */
const projectActivities = computed(() => (project.value ? getActivitiesByProject(project.value.id) : []))

/** Closing (Repair Phase Section 4, tab baru) — reuse `getProjectClosureSummary` (Section 09/24, read-only aggregate), TIDAK ada mekanisme closure baru dari sisi Client (di luar scope section ini). */
const closureSummary = computed(() => (project.value ? getProjectClosureSummary(project.value.id) : undefined))

/**
 * Commodity Requirement (Phase 3 — Client–Vendor Commodity). Kebutuhan komoditas milik Client dalam
 * project ini — TERPISAH dari Commodity Product (Phase 2, milik Vendor). Ownership sudah terjamin lewat
 * `isOwnCompany` (project) di atas; requirement selalu dibuat dengan `projectId` + `clientPartyId`
 * (`clientScopeId`) project yang sama, tidak ada jalur untuk membuat requirement di project lain.
 */
const requirements = computed(() => (project.value ? getCommodityRequirementsByProject(project.value.id) : []))

const isRequirementDialogOpen = ref(false)
const editingRequirement = ref<CommodityRequirement | null>(null)
const reqCategory = ref<ServiceTypeKey>('hotel')
const reqTitle = ref('')
const reqQuantity = ref<number | null>(null)
const reqNotes = ref('')
// Category-specific fields (Phase 0 Section 5 — "Category-specific fields")
const reqFlightOrigin = ref('')
const reqFlightDestination = ref('')
const reqFlightDepartureDate = ref('')
const reqHotelCheckIn = ref('')
const reqHotelCheckOut = ref('')
const reqHotelRoomCount = ref<number | null>(null)
const reqTransportVehicleType = ref('')
const reqTransportServiceDate = ref('')
const reqTransportRoute = ref('')
const reqMiceEventType = ref('')
const reqMiceParticipantCount = ref<number | null>(null)
const reqMiceEventDate = ref('')

function resetRequirementForm () {
  reqCategory.value = 'hotel'
  reqTitle.value = ''
  reqQuantity.value = null
  reqNotes.value = ''
  reqFlightOrigin.value = ''
  reqFlightDestination.value = ''
  reqFlightDepartureDate.value = ''
  reqHotelCheckIn.value = ''
  reqHotelCheckOut.value = ''
  reqHotelRoomCount.value = null
  reqTransportVehicleType.value = ''
  reqTransportServiceDate.value = ''
  reqTransportRoute.value = ''
  reqMiceEventType.value = ''
  reqMiceParticipantCount.value = null
  reqMiceEventDate.value = ''
}

function buildRequirementDetail (): CommodityRequirement['detail'] {
  switch (reqCategory.value) {
    case 'flight':
      return { category: 'flight', origin: reqFlightOrigin.value.trim() || undefined, destination: reqFlightDestination.value.trim() || undefined, departureDate: reqFlightDepartureDate.value || undefined }
    case 'hotel':
      return { category: 'hotel', checkInDate: reqHotelCheckIn.value || undefined, checkOutDate: reqHotelCheckOut.value || undefined, roomCount: reqHotelRoomCount.value ?? undefined }
    case 'transportation':
      return { category: 'transportation', vehicleType: reqTransportVehicleType.value.trim() || undefined, serviceDate: reqTransportServiceDate.value || undefined, route: reqTransportRoute.value.trim() || undefined }
    case 'mice':
      return { category: 'mice', eventType: reqMiceEventType.value.trim() || undefined, participantCount: reqMiceParticipantCount.value ?? undefined, eventDate: reqMiceEventDate.value || undefined }
    default:
      return { category: 'additional' }
  }
}

/** Prefill category-specific fields dari requirement existing saat membuka dialog Edit (Section 12 checklist: "Edit tidak prefill" adalah masalah yang harus dihindari). */
function prefillRequirementDetail (detail: CommodityRequirement['detail']) {
  if (!detail) { return }
  if (detail.category === 'flight') {
    reqFlightOrigin.value = detail.origin ?? ''
    reqFlightDestination.value = detail.destination ?? ''
    reqFlightDepartureDate.value = detail.departureDate ?? ''
  } else if (detail.category === 'hotel') {
    reqHotelCheckIn.value = detail.checkInDate ?? ''
    reqHotelCheckOut.value = detail.checkOutDate ?? ''
    reqHotelRoomCount.value = detail.roomCount ?? null
  } else if (detail.category === 'transportation') {
    reqTransportVehicleType.value = detail.vehicleType ?? ''
    reqTransportServiceDate.value = detail.serviceDate ?? ''
    reqTransportRoute.value = detail.route ?? ''
  } else if (detail.category === 'mice') {
    reqMiceEventType.value = detail.eventType ?? ''
    reqMiceParticipantCount.value = detail.participantCount ?? null
    reqMiceEventDate.value = detail.eventDate ?? ''
  }
}

function openCreateRequirement () {
  resetRequirementForm()
  editingRequirement.value = null
  isRequirementDialogOpen.value = true
}

function openEditRequirement (requirement: CommodityRequirement) {
  if (!isCommodityRequirementEditable(requirement.status)) { return }
  resetRequirementForm()
  editingRequirement.value = requirement
  reqCategory.value = requirement.category
  reqTitle.value = requirement.title
  reqQuantity.value = requirement.quantity
  reqNotes.value = requirement.notes ?? ''
  prefillRequirementDetail(requirement.detail)
  isRequirementDialogOpen.value = true
}

function submitRequirement () {
  if (!project.value || !clientScopeId.value || !reqTitle.value.trim() || !reqQuantity.value) { return }
  if (editingRequirement.value) {
    updateCommodityRequirement(editingRequirement.value.id, {
      title: reqTitle.value.trim(),
      quantity: reqQuantity.value,
      notes: reqNotes.value.trim() || undefined,
      detail: buildRequirementDetail()
    })
    showToast('Kebutuhan Diperbarui', `"${reqTitle.value.trim()}" berhasil diperbarui.`, 'success')
  } else {
    createCommodityRequirement({
      projectId: project.value.id,
      clientPartyId: clientScopeId.value,
      category: reqCategory.value,
      title: reqTitle.value.trim(),
      quantity: reqQuantity.value,
      notes: reqNotes.value.trim() || undefined,
      detail: buildRequirementDetail()
    })
    showToast('Kebutuhan Ditambahkan', `"${reqTitle.value.trim()}" berhasil ditambahkan.`, 'success')
  }
  isRequirementDialogOpen.value = false
}

const viewingRequirement = ref<CommodityRequirement | null>(null)

const confirmDeleteRequirement = ref<CommodityRequirement | null>(null)
function requestDeleteRequirement (requirement: CommodityRequirement) {
  if (!isCommodityRequirementDeletable(requirement.status)) { return }
  confirmDeleteRequirement.value = requirement
}
function cancelDeleteRequirement () {
  confirmDeleteRequirement.value = null
}
function confirmDeleteRequirementNow () {
  const requirement = confirmDeleteRequirement.value
  if (!requirement) { return }
  if (deleteCommodityRequirement(requirement.id)) {
    showToast('Kebutuhan Dihapus', `"${requirement.title}" berhasil dihapus.`, 'success')
  }
  confirmDeleteRequirement.value = null
}

/**
 * Travelers — Wajib "Traveler/participant submission" (Section 08) + "Client self-submission" (Section 11
 * baru, roadmap Section 00–24), reuse mutator `createTraveler`/`updateTraveler` apa adanya. Field
 * `companionOfTravelerId`/`documentsVerifiedAt` (internal verification) SENGAJA tidak ada di form ini —
 * verifikasi adalah tindakan staf internal (lihat `app/pages/projects/[id]/index.vue`), bukan sesuatu yang
 * disubmit Client sendiri.
 */
const isTravelerDialogOpen = ref(false)
const editingTraveler = ref<Traveler | null>(null)
const travelerName = ref('')
const travelerPassportNumber = ref('')
const travelerPassportExpiry = ref('')
const travelerIdNumber = ref('')
const travelerVisaNumber = ref('')
const travelerVisaExpiry = ref('')
const travelerEmergencyName = ref('')
const travelerEmergencyPhone = ref('')
const travelerDietary = ref('')
const travelerAccessibility = ref('')
const travelerSpecialRequest = ref('')

function openTravelerDialog (traveler: Traveler | null) {
  editingTraveler.value = traveler
  travelerName.value = traveler?.name ?? ''
  travelerPassportNumber.value = traveler?.passportNumber ?? ''
  travelerPassportExpiry.value = traveler?.passportExpiryDate ?? ''
  travelerIdNumber.value = traveler?.idNumber ?? ''
  travelerVisaNumber.value = traveler?.visaNumber ?? ''
  travelerVisaExpiry.value = traveler?.visaExpiryDate ?? ''
  travelerEmergencyName.value = traveler?.emergencyContactName ?? ''
  travelerEmergencyPhone.value = traveler?.emergencyContactPhone ?? ''
  travelerDietary.value = traveler?.dietaryRestrictions ?? ''
  travelerAccessibility.value = traveler?.accessibilityNeeds ?? ''
  travelerSpecialRequest.value = traveler?.specialRequest ?? ''
  isTravelerDialogOpen.value = true
}

function submitTraveler () {
  if (!project.value || !travelerName.value.trim()) { return }
  const patch = {
    name: travelerName.value.trim(),
    passportNumber: travelerPassportNumber.value.trim() || undefined,
    passportExpiryDate: travelerPassportExpiry.value || undefined,
    idNumber: travelerIdNumber.value.trim() || undefined,
    visaNumber: travelerVisaNumber.value.trim() || undefined,
    visaExpiryDate: travelerVisaExpiry.value || undefined,
    emergencyContactName: travelerEmergencyName.value.trim() || undefined,
    emergencyContactPhone: travelerEmergencyPhone.value.trim() || undefined,
    dietaryRestrictions: travelerDietary.value.trim() || undefined,
    accessibilityNeeds: travelerAccessibility.value.trim() || undefined,
    specialRequest: travelerSpecialRequest.value.trim() || undefined
  }
  if (editingTraveler.value) {
    updateTraveler(editingTraveler.value.id, patch)
    showToast('Traveler Diperbarui', `Data ${patch.name} berhasil disimpan.`, 'success')
  } else {
    createTraveler({ projectId: project.value.id, ...patch })
    showToast('Traveler Ditambahkan', `${patch.name} berhasil ditambahkan.`, 'success')
  }
  isTravelerDialogOpen.value = false
}

/**
 * Change Request (Section 19, D-076) — reuse `createChangeRequest` (yang otomatis memanggil `createChangeEntry`
 * Section 14 lama agar audit trail internal tetap satu sumber kebenaran), kategori dibatasi ke yang relevan
 * bagi client (bukan `vendor`/`budget`, internal-only).
 */
const CLIENT_CHANGE_CATEGORIES: ChangeCategory[] = ['traveler', 'itinerary', 'service', 'other']
const isChangeDialogOpen = ref(false)
const changeCategory = ref<ChangeCategory>('other')
const changeReason = ref('')

function submitChangeRequest () {
  if (!project.value || !changeReason.value.trim()) { return }
  const request = createChangeRequest({
    projectId: project.value.id,
    source: 'client',
    requestedBy: currentUser.value.id,
    affectedEntities: [{ entityType: 'project', entityId: project.value.id }],
    beforeSummary: 'Kondisi saat ini',
    afterSummary: changeReason.value.trim(),
    category: changeCategory.value
  })
  changeReason.value = ''
  changeCategory.value = 'other'
  isChangeDialogOpen.value = false
  showToast('Permintaan Perubahan Terkirim', `${request.id} — tim kami akan meninjau permintaan Anda.`, 'success')
}
</script>

<template>
  <div class="space-y-6">
    <template v-if="!project || !isOwnCompany">
      <PageHeader title="Tidak Ditemukan" :breadcrumb="[{ label: 'Client Portal', to: '/client' }, { label: 'Tidak Ditemukan' }]" />
      <SectionCard>
        <EmptyState :icon="FileX" title="Project Order tidak ditemukan" description="Project Order ini tidak ada atau bukan milik company Anda.">
          <Button @click="router.push('/client')">
            Kembali ke Client Portal
          </Button>
        </EmptyState>
      </SectionCard>
    </template>

    <RoleAccessState v-else-if="!canView('client-portal')" module-label="Client Portal" />

    <template v-else>
      <PageHeader :title="project.name" :breadcrumb="[{ label: 'Client Portal', to: '/client' }, { label: project.name }]">
        <template #actions>
          <StatusBadge :label="findStatusOption(PROJECT_STATUSES, project.status).label" :tone="findStatusOption(PROJECT_STATUSES, project.status).tone" />
        </template>
      </PageHeader>

      <Tabs v-model="activeTab">
        <TabsList>
          <TabsTrigger v-for="tab in TABS" :key="tab.value" :value="tab.value">
            {{ tab.label }}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <SectionCard>
            <DetailMetadataList
              :items="[
                { label: 'Company', value: party?.name ?? '—' },
                { label: 'Destinasi', value: project.destination },
                { label: 'Tanggal', value: formatDateRange(project.travelStartDate, project.travelEndDate) },
                { label: 'Jumlah Traveler', value: `${project.travelerCount} pax` },
                { label: 'Total Paket', value: formatCurrencyIdr(project.quotationAmountIdr) },
              ]"
            />
            <div v-if="serviceScopeOptions.length" class="mt-4 pt-4 border-t border-border">
              <p class="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Layanan
              </p>
              <div class="flex flex-wrap gap-2">
                <StatusBadge v-for="type in serviceScopeOptions" :key="type.value" :label="type.label" :tone="type.tone" />
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Support — Tim Kami">
            <DetailMetadataList
              :items="[
                { label: 'Account Executive', value: accountExecutive?.name ?? 'Belum ditugaskan' },
                { label: 'Project Manager', value: projectManager?.name ?? 'Belum ditugaskan' },
              ]"
            />
            <div class="mt-3 flex flex-wrap gap-3">
              <a v-if="accountExecutive" :href="`mailto:${accountExecutive.email}`" class="text-sm text-primary hover:underline">{{ accountExecutive.email }} (AE)</a>
              <a v-if="projectManager" :href="`mailto:${projectManager.email}`" class="text-sm text-primary hover:underline">{{ projectManager.email }} (PM)</a>
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="timeline">
          <SectionCard title="Timeline" description="Milestone utama Project Order Anda.">
            <ActivityTimeline :items="projectMilestones" empty-label="Belum ada milestone tercatat" />
          </SectionCard>
        </TabsContent>

        <TabsContent value="services">
          <SectionCard title="Services" description="Kesiapan layanan per jenis (jumlah service yang sudah confirmed dari total yang diajukan).">
            <StatusBreakdownList :items="serviceReadinessItems" empty-label="Belum ada service tercatat" />
          </SectionCard>
        </TabsContent>

        <TabsContent value="itinerary">
          <SectionCard title="Shared Itinerary">
            <template #actions>
              <StatusBadge v-if="latestItineraryVersion" :label="findStatusOption(ITINERARY_VERSION_STATUSES, latestItineraryVersion.status).label" :tone="findStatusOption(ITINERARY_VERSION_STATUSES, latestItineraryVersion.status).tone" />
            </template>
            <ul v-if="itineraryItems.length" class="divide-y divide-border">
              <li v-for="item in itineraryItems" :key="item.id" class="py-3">
                <p class="text-xs text-muted-foreground">
                  {{ formatDayLabel(item.date) }}<template v-if="item.time">
                    · {{ item.time }}
                  </template>
                </p>
                <p class="text-sm font-medium text-foreground">
                  {{ item.title }}
                </p>
                <p v-if="item.description" class="text-xs text-muted-foreground">
                  {{ item.description }}
                </p>
              </li>
            </ul>
            <EmptyState v-else title="Itinerary belum tersedia" description="Itinerary akan tampil di sini setelah tim kami menyusunnya." />
            <div class="mt-4 pt-4 border-t border-border">
              <NuxtLink :to="`/client/itineraries/${project.id}`" class="text-sm text-primary hover:underline">
                Kelola versi, bandingkan, komentar, dan approval →
              </NuxtLink>
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="reservations">
          <SectionCard title="Reservations" description="Status reservasi Flight/Hotel/Transportation/MICE untuk Project Order Anda — Client hanya dapat melihat status, perubahan diajukan lewat Change Request.">
            <ul v-if="reservations.length" class="divide-y divide-border">
              <li v-for="reservation in reservations" :key="`${reservation.bookingType}-${reservation.bookingId}`" class="py-3">
                <div class="flex items-center justify-between gap-3">
                  <div class="min-w-0">
                    <p class="text-sm font-medium text-foreground truncate">
                      {{ reservation.label }}
                    </p>
                    <p class="text-xs text-muted-foreground truncate">
                      {{ findStatusOption(RESERVATION_CATEGORIES, reservation.category).label }}
                      <template v-if="reservation.reference">
                        · Ref. {{ reservation.reference }}
                      </template>
                      <template v-if="reservation.startDate">
                        · {{ formatDate(reservation.startDate) }}
                      </template>
                    </p>
                  </div>
                  <StatusBadge :label="reservation.clientVisibleStatus" tone="info" />
                </div>
                <NuxtLink :to="`/client/reservations/${reservation.bookingType}/${reservation.bookingId}/preview`" class="text-xs text-primary hover:underline">
                  Lihat konfirmasi/tiket →
                </NuxtLink>
              </li>
            </ul>
            <EmptyState v-else title="Belum ada reservasi tercatat" description="Reservasi akan tampil di sini setelah tim kami memproses booking Anda." />
          </SectionCard>
        </TabsContent>

        <TabsContent value="travelers">
          <SectionCard title="Traveler / Participant">
            <template #actions>
              <Button size="sm" variant="outline" @click="openTravelerDialog(null)">
                <Plus class="h-4 w-4 mr-1.5" />Tambah Traveler
              </Button>
            </template>
            <div class="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama</TableHead>
                    <TableHead>Paspor</TableHead>
                    <TableHead>Visa</TableHead>
                    <TableHead>Kontak Darurat</TableHead>
                    <TableHead>Catatan</TableHead>
                    <TableHead>Status Dokumen</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow v-for="traveler in travelers" :key="traveler.id">
                    <TableCell class="font-medium text-foreground">
                      {{ traveler.name }}
                    </TableCell>
                    <TableCell class="text-muted-foreground">
                      {{ traveler.passportNumber || '—' }}<template v-if="traveler.passportExpiryDate">
                        (exp. {{ formatDate(traveler.passportExpiryDate) }})
                      </template>
                    </TableCell>
                    <TableCell class="text-muted-foreground">
                      {{ traveler.visaNumber || '—' }}<template v-if="traveler.visaExpiryDate">
                        (exp. {{ formatDate(traveler.visaExpiryDate) }})
                      </template>
                    </TableCell>
                    <TableCell class="text-muted-foreground">
                      {{ traveler.emergencyContactName || '—' }}
                    </TableCell>
                    <TableCell class="text-muted-foreground text-xs">
                      {{ [traveler.dietaryRestrictions, traveler.accessibilityNeeds, traveler.specialRequest].filter(Boolean).join(' · ') || '—' }}
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        :label="isTravelerDocumentMissing(traveler, project.travelStartDate) ? 'Dokumen Belum Lengkap' : 'Dokumen Lengkap'"
                        :tone="isTravelerDocumentMissing(traveler, project.travelStartDate) ? 'warning' : 'success'"
                      />
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" @click="openTravelerDialog(traveler)">
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                  <TableEmpty v-if="travelers.length === 0" :colspan="7">
                    Belum ada traveler tercatat. Tambahkan data traveler Anda.
                  </TableEmpty>
                </TableBody>
              </Table>
            </div>
            <div class="mt-4 pt-4 border-t border-border">
              <NuxtLink to="/client/participants" class="text-sm text-primary hover:underline">
                Kelola VIP, rooming, replace, dan bulk action lintas project →
              </NuxtLink>
            </div>
          </SectionCard>

          <Dialog v-model:open="isTravelerDialogOpen">
            <DialogScrollContent class="max-w-lg">
              <DialogHeader>
                <DialogTitle>{{ editingTraveler ? 'Edit Traveler' : 'Tambah Traveler' }}</DialogTitle>
                <DialogDescription>Lengkapi data traveler untuk keperluan dokumen perjalanan.</DialogDescription>
              </DialogHeader>
              <div class="space-y-4 py-2">
                <div class="space-y-1.5">
                  <Label for="trv-name">Nama Lengkap</Label><Input id="trv-name" v-model="travelerName" />
                </div>
                <div class="grid grid-cols-2 gap-4">
                  <div class="space-y-1.5">
                    <Label for="trv-passport">Nomor Paspor</Label><Input id="trv-passport" v-model="travelerPassportNumber" />
                  </div>
                  <div class="space-y-1.5">
                    <Label for="trv-passport-exp">Masa Berlaku Paspor</Label><Input id="trv-passport-exp" v-model="travelerPassportExpiry" type="date" />
                  </div>
                  <div class="space-y-1.5">
                    <Label for="trv-id-number">Nomor ID/KTP (opsional)</Label><Input id="trv-id-number" v-model="travelerIdNumber" />
                  </div>
                  <div class="space-y-1.5">
                    <Label for="trv-visa">Nomor Visa (opsional)</Label><Input id="trv-visa" v-model="travelerVisaNumber" />
                  </div>
                  <div class="space-y-1.5">
                    <Label for="trv-visa-exp">Masa Berlaku Visa (opsional)</Label><Input id="trv-visa-exp" v-model="travelerVisaExpiry" type="date" />
                  </div>
                </div>
                <div class="space-y-1.5">
                  <Label for="trv-emergency-name">Nama Kontak Darurat</Label><Input id="trv-emergency-name" v-model="travelerEmergencyName" />
                </div>
                <div class="space-y-1.5">
                  <Label for="trv-emergency-phone">Telepon Kontak Darurat</Label><Input id="trv-emergency-phone" v-model="travelerEmergencyPhone" />
                </div>
                <div class="space-y-1.5">
                  <Label for="trv-dietary">Dietary Restriction (opsional)</Label><Input id="trv-dietary" v-model="travelerDietary" placeholder="mis. Vegetarian, tanpa seafood" />
                </div>
                <div class="space-y-1.5">
                  <Label for="trv-accessibility">Accessibility Needs (opsional)</Label><Input id="trv-accessibility" v-model="travelerAccessibility" placeholder="mis. Kursi roda" />
                </div>
                <div class="space-y-1.5">
                  <Label for="trv-special">Permintaan Khusus Lainnya</Label><Input id="trv-special" v-model="travelerSpecialRequest" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" @click="isTravelerDialogOpen = false">
                  Batal
                </Button>
                <Button :disabled="!travelerName.trim()" @click="submitTraveler">
                  Simpan
                </Button>
              </DialogFooter>
            </DialogScrollContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="documents">
          <SectionCard title="Documents">
            <template #actions>
              <NuxtLink :to="`/client/documents?project=${project.id}`" class="text-xs text-primary hover:underline">
                Buka Documents lengkap →
              </NuxtLink>
            </template>
            <ul v-if="richDocuments.length" class="divide-y divide-border">
              <li v-for="document in richDocuments" :key="document.id" class="py-3 flex items-center justify-between gap-3">
                <div class="min-w-0">
                  <p class="text-sm text-foreground truncate">
                    {{ document.name }} <span class="text-xs text-muted-foreground">v{{ document.version }}</span>
                  </p>
                  <p class="text-xs text-muted-foreground">
                    {{ findStatusOption(CLIENT_DOCUMENT_CATEGORIES, getClientDocumentCategory(document)).label }}
                    <template v-if="document.expiresAt">
                      · Kedaluwarsa {{ formatDate(document.expiresAt) }}
                    </template>
                  </p>
                </div>
                <NuxtLink v-if="document.sourceType === 'generated' && document.previewRoute" :to="document.previewRoute" target="_blank" class="text-xs text-primary hover:underline shrink-0">
                  Preview →
                </NuxtLink>
              </li>
            </ul>
            <EmptyState v-else title="Belum ada dokumen dibagikan" description="Dokumen seperti tiket, voucher hotel, atau itinerary PDF akan tampil di sini setelah dibagikan tim kami." />
            <div v-if="documents.length" class="mt-4 pt-4 border-t border-border">
              <p class="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                Dokumen Lama
              </p>
              <ul class="divide-y divide-border">
                <li v-for="document in documents" :key="document.id" class="py-2 flex items-center justify-between gap-3">
                  <span class="text-sm text-foreground truncate">{{ document.name }}</span>
                  <span class="text-xs text-muted-foreground shrink-0">{{ formatDate(document.uploadedAt) }}</span>
                </li>
              </ul>
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="finance">
          <SectionCard title="Invoice" description="Menampilkan status DP/termin dan currency invoice — nilai selalu dalam Rupiah (currency asing hanya penanda referensi, sudah dikonversi).">
            <template #actions>
              <NuxtLink :to="`/client/billing`" class="text-xs text-primary hover:underline">
                Buka Finance & Billing lengkap →
              </NuxtLink>
            </template>
            <div class="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Tipe</TableHead>
                    <TableHead>Jumlah</TableHead>
                    <TableHead>Jatuh Tempo</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow v-for="invoice in invoices" :key="invoice.id">
                    <TableCell class="font-medium text-foreground">
                      {{ invoice.label }}
                    </TableCell>
                    <TableCell>
                      <div class="flex flex-col gap-1">
                        <StatusBadge :label="findStatusOption(INVOICE_TYPES, invoice.invoiceType).label" :tone="findStatusOption(INVOICE_TYPES, invoice.invoiceType).tone" />
                        <span v-if="invoice.currency !== 'IDR'" class="text-xs text-muted-foreground">{{ invoice.currency }}</span>
                      </div>
                    </TableCell>
                    <TableCell>{{ formatCurrencyIdr(invoice.amountIdr) }}</TableCell>
                    <TableCell :class="isInvoiceOverdue(invoice) ? 'text-destructive' : 'text-muted-foreground'">
                      {{ formatDate(invoice.dueAt) }}<template v-if="isInvoiceOverdue(invoice)">
                        ({{ invoiceAgingDays(invoice) * -1 }} hari overdue)
                      </template>
                    </TableCell>
                    <TableCell><StatusBadge :label="findStatusOption(INVOICE_STATUSES, invoice.status).label" :tone="findStatusOption(INVOICE_STATUSES, invoice.status).tone" /></TableCell>
                  </TableRow>
                  <TableEmpty v-if="invoices.length === 0" :colspan="5">
                    Belum ada invoice untuk Project Order ini.
                  </TableEmpty>
                </TableBody>
              </Table>
            </div>
          </SectionCard>

          <SectionCard v-for="invoice in invoices.filter(inv => getPaymentsByInvoice(inv.id).length > 0)" :key="invoice.id" :title="`Riwayat Pembayaran — ${invoice.label}`">
            <ul class="divide-y divide-border">
              <li v-for="payment in getPaymentsByInvoice(invoice.id)" :key="payment.id" class="py-2 flex items-center justify-between gap-3">
                <span class="text-sm text-foreground">{{ formatCurrencyIdr(payment.amountIdr) }}</span>
                <span class="text-xs text-muted-foreground">{{ formatDate(payment.receivedAt) }}</span>
              </li>
            </ul>
          </SectionCard>
        </TabsContent>

        <TabsContent value="changes">
          <SectionCard title="Change Request">
            <template #actions>
              <div class="flex items-center gap-3">
                <NuxtLink to="/client/change-requests" class="text-xs text-primary hover:underline">
                  Kelola lengkap →
                </NuxtLink>
                <Dialog v-model:open="isChangeDialogOpen">
                  <DialogTrigger as-child>
                    <Button size="sm" variant="outline">
                      <Plus class="h-4 w-4 mr-1.5" />Ajukan Perubahan
                    </Button>
                  </DialogTrigger>
                  <DialogContent class="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Ajukan Permintaan Perubahan</DialogTitle>
                      <DialogDescription>Sampaikan perubahan yang Anda butuhkan untuk Project Order ini.</DialogDescription>
                    </DialogHeader>
                    <div class="space-y-4 py-2">
                      <div class="space-y-1.5">
                        <Label for="change-category">Kategori</Label>
                        <select id="change-category" v-model="changeCategory" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                          <option v-for="cat in CHANGE_CATEGORIES.filter(c => CLIENT_CHANGE_CATEGORIES.includes(c.value))" :key="cat.value" :value="cat.value">
                            {{ cat.label }}
                          </option>
                        </select>
                      </div>
                      <div class="space-y-1.5">
                        <Label for="change-reason">Detail Permintaan</Label>
                        <textarea id="change-reason" v-model="changeReason" rows="3" class="w-full px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring" placeholder="mis. Jumlah peserta bertambah menjadi 25 orang" />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" @click="isChangeDialogOpen = false">
                        Batal
                      </Button>
                      <Button :disabled="!changeReason.trim()" @click="submitChangeRequest">
                        Kirim
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </template>
            <ul v-if="projectChangeRequests.length" class="divide-y divide-border">
              <li v-for="item in projectChangeRequests" :key="item.id" class="py-3">
                <div class="flex items-center justify-between gap-3">
                  <p class="text-sm font-medium text-foreground">
                    {{ item.afterSummary }}
                  </p>
                  <StatusBadge :label="findStatusOption(CHANGE_REQUEST_STATUSES, item.status).label" :tone="findStatusOption(CHANGE_REQUEST_STATUSES, item.status).tone" />
                </div>
                <p class="text-sm text-muted-foreground">
                  Sebelum: {{ item.beforeSummary }}
                </p>
                <p class="text-xs text-muted-foreground mt-1">
                  {{ formatDate(item.submittedAt) }}
                </p>
              </li>
            </ul>
            <EmptyState v-else title="Belum ada permintaan perubahan" description="Ajukan perubahan bila ada detail Project Order yang perlu disesuaikan." />
          </SectionCard>
        </TabsContent>

        <TabsContent value="issues">
          <SectionCard title="Issues" description="Status dan resolusi insiden operasional yang berkaitan dengan Project Order Anda.">
            <ul v-if="projectIncidents.length" class="divide-y divide-border">
              <li v-for="item in projectIncidents" :key="item.id" class="py-3">
                <div class="flex items-center justify-between gap-3">
                  <p class="text-sm font-medium text-foreground">
                    {{ item.title }}
                  </p>
                  <StatusBadge :label="findStatusOption(INCIDENT_STATUSES, item.status).label" :tone="findStatusOption(INCIDENT_STATUSES, item.status).tone" />
                </div>
                <p v-if="item.resolutionNote" class="text-sm text-muted-foreground mt-1">
                  Resolusi: {{ item.resolutionNote }}
                </p>
                <p v-else class="text-sm text-muted-foreground mt-1">
                  Sedang ditangani oleh tim kami.
                </p>
              </li>
            </ul>
            <EmptyState v-else title="Tidak ada Issue tercatat" description="Belum ada insiden operasional yang berkaitan dengan Project Order ini." />
          </SectionCard>
        </TabsContent>

        <TabsContent value="activities">
          <SectionCard title="Activities" description="Riwayat aktivitas Project Order Anda.">
            <ActivityTimeline
              :items="projectActivities.map(activity => ({ id: activity.id, message: activity.message, createdAt: activity.createdAt }))"
              empty-label="Belum ada aktivitas tercatat"
            />
          </SectionCard>
        </TabsContent>

        <TabsContent value="closing">
          <SectionCard title="Closing" description="Ringkasan penutupan Project Order Anda.">
            <template v-if="project.closedAt">
              <StatusBadge label="Project Closed" tone="success" />
              <p class="text-xs text-muted-foreground mt-2">
                Ditutup pada {{ formatDate(project.closedAt) }}
              </p>
              <p v-if="project.closureChecklist?.finalNote" class="text-sm text-foreground mt-3">
                {{ project.closureChecklist.finalNote }}
              </p>
            </template>
            <EmptyState v-else title="Project belum ditutup" description="Ringkasan berikut adalah status berjalan, bukan hasil final." />
            <div v-if="closureSummary" class="mt-4 pt-4 border-t border-border">
              <DetailMetadataList
                :items="[
                  { label: 'Total Layanan', value: String(closureSummary.totalServices) },
                  { label: 'Total Booking', value: String(closureSummary.totalBookings) },
                  { label: 'Total Invoiced', value: formatCurrencyIdr(closureSummary.totalInvoicedIdr) },
                  { label: 'Total Paid', value: formatCurrencyIdr(closureSummary.totalPaidIdr) },
                  { label: 'Issues Selesai', value: `${closureSummary.incidentsResolved}/${closureSummary.incidentsTotal}` },
                  { label: 'Change Request Diimplementasikan', value: `${closureSummary.changeRequestsImplemented}/${closureSummary.changeRequestsTotal}` },
                ]"
              />
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="commodity">
          <SectionCard title="Kebutuhan Komoditas" description="Kebutuhan komoditas yang Anda ajukan untuk project ini — terpisah dari katalog komoditas milik Vendor.">
            <template #actions>
              <Button size="sm" variant="outline" @click="openCreateRequirement">
                <Plus class="h-4 w-4 mr-1.5" />Tambah Kebutuhan
              </Button>
            </template>
            <div class="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Judul</TableHead>
                    <TableHead>Kategori</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow v-for="requirement in requirements" :key="requirement.id">
                    <TableCell class="font-medium text-foreground">
                      {{ requirement.title }}
                    </TableCell>
                    <TableCell>
                      <StatusBadge :label="findStatusOption(SERVICE_TYPES, requirement.category).label" :tone="findStatusOption(SERVICE_TYPES, requirement.category).tone" />
                    </TableCell>
                    <TableCell class="text-muted-foreground">
                      {{ requirement.quantity }}
                    </TableCell>
                    <TableCell>
                      <StatusBadge :label="findStatusOption(COMMODITY_REQUIREMENT_STATUSES, requirement.status).label" :tone="findStatusOption(COMMODITY_REQUIREMENT_STATUSES, requirement.status).tone" />
                    </TableCell>
                    <TableCell>
                      <div class="flex items-center gap-2">
                        <Button size="sm" variant="ghost" @click="viewingRequirement = requirement">
                          Detail
                        </Button>
                        <Button
                          v-if="['open', 'matching', 'selection-in-progress'].includes(requirement.status)"
                          size="sm"
                          @click="router.push(`/client/catalog/${requirement.id}`)"
                        >
                          Cari Komoditas
                        </Button>
                        <Button v-if="isCommodityRequirementEditable(requirement.status)" size="sm" variant="outline" @click="openEditRequirement(requirement)">
                          Edit
                        </Button>
                        <Button v-if="isCommodityRequirementDeletable(requirement.status)" size="sm" variant="destructive" @click="requestDeleteRequirement(requirement)">
                          Hapus
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  <TableEmpty v-if="requirements.length === 0" :colspan="5">
                    Belum ada kebutuhan komoditas. Klik "Tambah Kebutuhan" untuk mengajukan.
                  </TableEmpty>
                </TableBody>
              </Table>
            </div>
          </SectionCard>

          <!-- ── Create/Edit Requirement Dialog ────────────────────────── -->
          <Dialog v-model:open="isRequirementDialogOpen">
            <DialogScrollContent class="max-w-lg">
              <DialogHeader>
                <DialogTitle>{{ editingRequirement ? 'Edit Kebutuhan Komoditas' : 'Tambah Kebutuhan Komoditas' }}</DialogTitle>
                <DialogDescription>Kebutuhan ini akan dicocokkan dengan komoditas yang tersedia dari Vendor.</DialogDescription>
              </DialogHeader>
              <div class="space-y-4 py-2">
                <div class="space-y-1.5">
                  <Label for="req-title">Judul Kebutuhan</Label>
                  <Input id="req-title" v-model="reqTitle" placeholder="mis. Kamar untuk 20 peserta" />
                </div>
                <div class="grid grid-cols-2 gap-4">
                  <div class="space-y-1.5">
                    <Label for="req-category">Kategori</Label>
                    <select id="req-category" v-model="reqCategory" :disabled="!!editingRequirement" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed">
                      <option v-for="type in SERVICE_TYPES" :key="type.value" :value="type.value">
                        {{ type.label }}
                      </option>
                    </select>
                  </div>
                  <div class="space-y-1.5">
                    <Label for="req-quantity">Jumlah</Label>
                    <Input id="req-quantity" v-model.number="reqQuantity" type="number" placeholder="mis. 10" />
                  </div>
                </div>

                <!-- Category-specific fields -->
                <div v-if="reqCategory === 'flight'" class="grid grid-cols-2 gap-4">
                  <div class="space-y-1.5">
                    <Label for="req-flight-origin">Asal</Label><Input id="req-flight-origin" v-model="reqFlightOrigin" />
                  </div>
                  <div class="space-y-1.5">
                    <Label for="req-flight-destination">Tujuan</Label><Input id="req-flight-destination" v-model="reqFlightDestination" />
                  </div>
                  <div class="space-y-1.5 col-span-2">
                    <Label for="req-flight-date">Tanggal Keberangkatan</Label><Input id="req-flight-date" v-model="reqFlightDepartureDate" type="date" />
                  </div>
                </div>
                <div v-else-if="reqCategory === 'hotel'" class="grid grid-cols-2 gap-4">
                  <div class="space-y-1.5">
                    <Label for="req-hotel-checkin">Check-in</Label><Input id="req-hotel-checkin" v-model="reqHotelCheckIn" type="date" />
                  </div>
                  <div class="space-y-1.5">
                    <Label for="req-hotel-checkout">Check-out</Label><Input id="req-hotel-checkout" v-model="reqHotelCheckOut" type="date" />
                  </div>
                  <div class="space-y-1.5 col-span-2">
                    <Label for="req-hotel-rooms">Jumlah Kamar</Label><Input id="req-hotel-rooms" v-model.number="reqHotelRoomCount" type="number" />
                  </div>
                </div>
                <div v-else-if="reqCategory === 'transportation'" class="grid grid-cols-2 gap-4">
                  <div class="space-y-1.5">
                    <Label for="req-transport-vehicle">Jenis Kendaraan</Label><Input id="req-transport-vehicle" v-model="reqTransportVehicleType" />
                  </div>
                  <div class="space-y-1.5">
                    <Label for="req-transport-date">Tanggal Layanan</Label><Input id="req-transport-date" v-model="reqTransportServiceDate" type="date" />
                  </div>
                  <div class="space-y-1.5 col-span-2">
                    <Label for="req-transport-route">Rute</Label><Input id="req-transport-route" v-model="reqTransportRoute" placeholder="mis. Bandara - Hotel" />
                  </div>
                </div>
                <div v-else-if="reqCategory === 'mice'" class="grid grid-cols-2 gap-4">
                  <div class="space-y-1.5">
                    <Label for="req-mice-type">Jenis Event</Label><Input id="req-mice-type" v-model="reqMiceEventType" placeholder="mis. Annual Meeting" />
                  </div>
                  <div class="space-y-1.5">
                    <Label for="req-mice-participants">Jumlah Peserta</Label><Input id="req-mice-participants" v-model.number="reqMiceParticipantCount" type="number" />
                  </div>
                  <div class="space-y-1.5 col-span-2">
                    <Label for="req-mice-date">Tanggal Event</Label><Input id="req-mice-date" v-model="reqMiceEventDate" type="date" />
                  </div>
                </div>

                <div class="space-y-1.5">
                  <Label for="req-notes">Catatan (opsional)</Label>
                  <textarea id="req-notes" v-model="reqNotes" rows="3" class="w-full px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" @click="isRequirementDialogOpen = false">
                  Batal
                </Button>
                <Button :disabled="!reqTitle.trim() || !reqQuantity" @click="submitRequirement">
                  Simpan
                </Button>
              </DialogFooter>
            </DialogScrollContent>
          </Dialog>

          <!-- ── Requirement Detail Dialog (read-only) ─────────────────── -->
          <Dialog :open="viewingRequirement !== null" @update:open="val => { if (!val) viewingRequirement = null }">
            <DialogContent v-if="viewingRequirement" class="max-w-md">
              <DialogHeader>
                <DialogTitle>{{ viewingRequirement.title }}</DialogTitle>
              </DialogHeader>
              <DetailMetadataList
                :items="[
                  { label: 'Kategori', value: findStatusOption(SERVICE_TYPES, viewingRequirement.category).label },
                  { label: 'Jumlah', value: String(viewingRequirement.quantity) },
                  { label: 'Status', value: findStatusOption(COMMODITY_REQUIREMENT_STATUSES, viewingRequirement.status).label },
                  { label: 'Catatan', value: viewingRequirement.notes ?? '—' },
                  { label: 'Dibuat', value: formatDate(viewingRequirement.createdAt) },
                ]"
              />
            </DialogContent>
          </Dialog>

          <!-- ── Delete Confirmation Dialog ─────────────────────────────── -->
          <Dialog :open="confirmDeleteRequirement !== null" @update:open="val => { if (!val) cancelDeleteRequirement() }">
            <DialogContent v-if="confirmDeleteRequirement" class="max-w-sm">
              <DialogHeader>
                <DialogTitle>Hapus kebutuhan komoditas?</DialogTitle>
                <DialogDescription>
                  "{{ confirmDeleteRequirement.title }}" akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" @click="cancelDeleteRequirement">
                  Batal
                </Button>
                <Button variant="destructive" @click="confirmDeleteRequirementNow">
                  Hapus
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>
      </Tabs>
    </template>
  </div>
</template>
