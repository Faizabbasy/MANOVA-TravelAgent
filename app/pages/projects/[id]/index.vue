<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { FileX, Wallet, Users, Truck, Search, UserPlus, Upload, Pencil, Trash2 } from 'lucide-vue-next'
import {
  getProjectById, getPartyById, getUserById, getVendorById,
  getProjectServices, getItineraryItems, updateServiceStatus,
  getQuotationsForService, acceptVendorQuotation, rejectVendorQuotation,
  getTravelerGroups, getTravelers, getRoomAssignments,
  createTraveler, updateTraveler, removeTraveler, importTravelersMock,
  getInvoicesByProject, getTasksByProject, getDocumentsByProject, getActivitiesByProject,
  createChangeEntry, approveChangeEntry, rejectChangeEntry,
} from '~/data'
import {
  PROJECT_STATUSES, PROJECT_CHARACTERISTICS, SERVICE_STATUSES, SERVICE_TYPES,
  INVOICE_STATUSES, TASK_STATUSES, ROOM_TYPES, VENDOR_QUOTATION_STATUSES,
  CHANGE_CATEGORIES, CHANGE_APPROVAL_STATUSES, findStatusOption,
} from '~/constants/status'
import { formatCurrencyIdr, formatDateRange, formatDate, formatDayLabel, formatTravelerCount } from '~/utils/format'
import { isProjectNeedingAttention, isUpcomingDeparture, isTravelerDocumentMissing } from '~/utils/attention'
import type { ProjectDetailTab, Traveler, ServiceTypeKey, ServiceStatus } from '~/types/project'
import type { ChangeCategory } from '~/types/activity'
import type { StatusBreakdownItem } from '~/components/shared/StatusBreakdownList.vue'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const route = useRoute()
const router = useRouter()
const { canView, canApprove } = usePermissions()
const { currentRole, currentUser } = useCurrentUser()
const { showToast } = useToast()

/**
 * Pengecualian sempit (Section 11), pola yang sama dengan `canManageParty` di CRM (Section 07): akses
 * modul `project` generik (`canManage('project')`) juga akan meloloskan Management karena rank `APPROVE`
 * > `MANAGE`, padahal `docs/route-and-role-matrix.md` bagian 5 memberi Management `APPROVE` khusus untuk
 * "perubahan besar/cancel project", bukan CRUD rutin traveler. Hanya Project Manager dan Super Admin yang
 * mengelola data traveler sehari-hari.
 */
const canManageTravelers = computed(() => ['project-manager', 'super-admin'].includes(currentRole.value))

/**
 * Role behavior tab Itinerary & Services (Section 12) — mengikuti granularity `docs/route-and-role-matrix.md`
 * bagian 5 secara presisi (bukan pengecualian sempit tunggal seperti Travelers): PM/Operations/Super Admin
 * mengelola SELURUH sub-section ("koordinasi umum"), sementara Ticketing/Accommodation/Transportation/MICE
 * hanya `MANAGE` pada sub-section sesuai domainnya masing-masing. `additional` tidak punya role sub-domain
 * khusus — hanya PM/Operations/Super Admin yang mengelolanya.
 */
const SERVICE_TYPE_ROLE_MAP: Partial<Record<ServiceTypeKey, string[]>> = {
  flight: ['ticketing'],
  hotel: ['accommodation'],
  transportation: ['transportation'],
  mice: ['mice'],
}

function canManageServiceType(type: ServiceTypeKey) {
  if (['project-manager', 'operations', 'super-admin'].includes(currentRole.value)) return true
  return (SERVICE_TYPE_ROLE_MAP[type] ?? []).includes(currentRole.value)
}

const project = computed(() => getProjectById(String(route.params.id)))

useHead({ title: computed(() => project.value ? project.value.name : 'Project Tidak Ditemukan') })

const activeTab = computed<ProjectDetailTab>({
  get: () => (route.query.tab as ProjectDetailTab) || 'overview',
  set: (value) => router.replace({ query: { ...route.query, tab: value } }),
})

const TABS: { value: ProjectDetailTab; label: string }[] = [
  { value: 'overview', label: 'Overview' },
  { value: 'itinerary-services', label: 'Itinerary & Services' },
  { value: 'travelers', label: 'Travelers' },
  { value: 'vendors', label: 'Vendors' },
  { value: 'finance', label: 'Finance' },
  { value: 'tasks', label: 'Tasks' },
  { value: 'documents', label: 'Documents' },
  { value: 'activity-changes', label: 'Activity & Changes' },
]

const party = computed(() => project.value ? getPartyById(project.value.partyId) : undefined)
const owner = computed(() => project.value ? getUserById(project.value.ownerId) : undefined)
const team = computed(() => project.value
  ? project.value.teamUserIds.map(id => getUserById(id)).filter((user): user is NonNullable<typeof user> => Boolean(user))
  : [])
const services = computed(() => project.value ? getProjectServices(project.value.id) : [])
const itineraryItems = computed(() => project.value ? getItineraryItems(project.value.id) : [])

/** Daily itinerary dikelompokkan per tanggal (pola list/divide-y existing, bukan komponen calendar baru). */
const itineraryByDate = computed(() => {
  const map = new Map<string, typeof itineraryItems.value>()
  for (const item of itineraryItems.value) {
    if (!map.has(item.date)) map.set(item.date, [])
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
  if (!project.value) return []
  const scopeTypes = SERVICE_TYPES.filter(type => project.value!.serviceScope.includes(type.value))
  const additionalType = SERVICE_TYPES.find(type => type.value === 'additional')
  const hasAdditional = services.value.some(service => service.type === 'additional')
  return additionalType && hasAdditional ? [...scopeTypes, additionalType] : scopeTypes
})

function servicesByType(type: ServiceTypeKey) {
  return services.value.filter(service => service.type === type)
}

function serviceReadinessLabel(type: ServiceTypeKey) {
  const list = servicesByType(type)
  const ready = list.filter(service => ['confirmed', 'completed'].includes(service.status)).length
  return `${ready} dari ${list.length} layanan siap (Confirmed/Completed)`
}

const changedServicesCount = computed(() => services.value.filter(service => service.status === 'changed').length)

function handleServiceStatusChange(serviceId: string, event: Event) {
  const newStatus = (event.target as HTMLSelectElement).value as ServiceStatus
  const service = updateServiceStatus(serviceId, newStatus)
  if (!service) return
  showToast('Status Layanan Diperbarui', `"${service.label}" kini berstatus "${findStatusOption(SERVICE_STATUSES, newStatus).label}".`)
}

const groups = computed(() => project.value ? getTravelerGroups(project.value.id) : [])
const travelers = computed(() => project.value ? getTravelers(project.value.id) : [])
const invoices = computed(() => project.value ? getInvoicesByProject(project.value.id) : [])
const tasks = computed(() => project.value ? getTasksByProject(project.value.id) : [])
const documents = computed(() => project.value ? getDocumentsByProject(project.value.id) : [])
const activities = computed(() => project.value ? getActivitiesByProject(project.value.id) : [])
const changesOnly = ref(false)
/** "Changes only" ditampilkan sebagai timeline kronologis (ascending) — "All" tetap urutan natural existing. */
const visibleActivities = computed(() => {
  if (!changesOnly.value) return activities.value
  return [...activities.value].filter(a => a.isChange).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
})

/**
 * Project Changes (Section 14) — log change (PM/Operations/role sub-domain yang bisa mengajukan perubahan
 * di sub-section masing-masing) vs approve/reject (Management/Super Admin, docs bagian 5.1 "Approve").
 */
const canLogChange = computed(() => ['project-manager', 'operations', 'ticketing', 'accommodation', 'transportation', 'mice', 'super-admin'].includes(currentRole.value))
const canApproveChanges = computed(() => canApprove('project'))

const isChangeDialogOpen = ref(false)
const changeCategory = ref<ChangeCategory>('other')
const changeReason = ref('')
const changeBefore = ref('')
const changeAfter = ref('')
const changeImpact = ref('')

function resetChangeForm() {
  changeCategory.value = 'other'
  changeReason.value = ''
  changeBefore.value = ''
  changeAfter.value = ''
  changeImpact.value = ''
}

function submitChangeEntry() {
  if (!project.value || !changeReason.value.trim()) return
  createChangeEntry({
    projectId: project.value.id,
    category: changeCategory.value,
    reason: changeReason.value.trim(),
    requestedBy: currentUser.value.id,
    beforeValue: changeBefore.value.trim() || undefined,
    afterValue: changeAfter.value.trim() || undefined,
    impactNote: changeImpact.value.trim() || undefined,
  })
  resetChangeForm()
  isChangeDialogOpen.value = false
  showToast('Perubahan Dicatat', 'Change baru dicatat, menunggu approval Management/Super Admin.')
}

function handleApproveChange(entryId: string) {
  const entry = approveChangeEntry(entryId, currentUser.value.id)
  if (!entry) return
  showToast('Perubahan Disetujui', `Change ${entry.id} disetujui.`)
}

function handleRejectChange(entryId: string) {
  const entry = rejectChangeEntry(entryId, currentUser.value.id)
  if (!entry) return
  showToast('Perubahan Ditolak', `Change ${entry.id} ditolak.`, 'info')
}

/**
 * Vendor assignment + comparison (Section 13) — quotation dibaca dari `VENDOR_QUOTATIONS` (Section 13),
 * gerbang Accept/Reject reuse `canManageServiceType` (Section 12), bukan mekanisme role-check baru.
 */
function quotationsForService(serviceId: string) {
  return getQuotationsForService(serviceId)
}

function handleAcceptQuotation(quotationId: string) {
  const quotation = acceptVendorQuotation(quotationId)
  if (!quotation) return
  const vendor = getVendorById(quotation.vendorId)
  showToast('Quotation Diterima', `${vendor?.name ?? quotation.vendorId} ditugaskan untuk layanan ini.`)
}

function handleRejectQuotation(quotationId: string) {
  const quotation = rejectVendorQuotation(quotationId)
  if (!quotation) return
  showToast('Quotation Ditolak', 'Quotation vendor ditandai ditolak.', 'info')
}

const needsAttention = computed(() => project.value
  ? isProjectNeedingAttention(project.value, { invoices: invoices.value, tasks: tasks.value, activities: activities.value })
  : false)

/** Ringkasan Overview (Section 10) — breakdown/preview dari data tab lain, bukan detail penuh (hard rule: jangan
 * kerjakan seluruh detail traveler/operations/vendor/finance di sini, tab masing-masing tetap sumber lengkapnya). */
const serviceStatusSummary = computed<StatusBreakdownItem[]>(() => {
  const byStatus = new Map<string, number>()
  for (const service of services.value) byStatus.set(service.status, (byStatus.get(service.status) ?? 0) + 1)
  return SERVICE_STATUSES
    .filter(status => byStatus.has(status.value))
    .sort((a, b) => a.order - b.order)
    .map(status => ({ key: status.value, label: status.label, tone: status.tone, count: byStatus.get(status.value)! }))
})

const taskStatusSummary = computed<StatusBreakdownItem[]>(() => {
  const byStatus = new Map<string, number>()
  for (const task of tasks.value) byStatus.set(task.status, (byStatus.get(task.status) ?? 0) + 1)
  return TASK_STATUSES
    .filter(status => byStatus.has(status.value))
    .sort((a, b) => a.order - b.order)
    .map(status => ({ key: status.value, label: status.label, tone: status.tone, count: byStatus.get(status.value)! }))
})

const recentDocuments = computed(() => [...documents.value].sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt)).slice(0, 3))
const recentActivityPreview = computed(() => [...activities.value].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 3))

function goToActivityTab() {
  activeTab.value = 'activity-changes'
}

/* Travelers tab (Section 11) — filter/search/CRUD state. */

const roomAssignments = computed(() => project.value ? getRoomAssignments(project.value.id) : [])

function travelerNameById(id: string) {
  return travelers.value.find(t => t.id === id)?.name ?? id
}

function groupNameById(groupId?: string) {
  if (!groupId) return '—'
  return groups.value.find(g => g.id === groupId)?.name ?? groupId
}

function travelerDocumentMissing(traveler: Traveler) {
  return isTravelerDocumentMissing(traveler, project.value?.travelStartDate)
}

function passportSummary(traveler: Traveler) {
  if (!traveler.passportNumber || !traveler.passportExpiryDate) return 'Belum diisi'
  return `${traveler.passportNumber} · ${formatDate(traveler.passportExpiryDate)}`
}

const travelerSearch = ref('')
const travelerGroupFilter = ref('all')
const missingDocsOnly = ref(false)

const filteredTravelers = computed(() => {
  let result = travelers.value
  if (travelerGroupFilter.value === 'ungrouped') result = result.filter(t => !t.groupId)
  else if (travelerGroupFilter.value !== 'all') result = result.filter(t => t.groupId === travelerGroupFilter.value)
  if (missingDocsOnly.value) result = result.filter(travelerDocumentMissing)
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
const formEmergencyContactName = ref('')
const formEmergencyContactPhone = ref('')
const formSpecialRequest = ref('')

function resetTravelerForm() {
  formName.value = ''
  formGroupId.value = ''
  formPassportNumber.value = ''
  formPassportExpiryDate.value = ''
  formEmergencyContactName.value = ''
  formEmergencyContactPhone.value = ''
  formSpecialRequest.value = ''
}

function openCreateTraveler() {
  editingTravelerId.value = null
  resetTravelerForm()
  isTravelerDialogOpen.value = true
}

function openEditTraveler(traveler: Traveler) {
  editingTravelerId.value = traveler.id
  formName.value = traveler.name
  formGroupId.value = traveler.groupId ?? ''
  formPassportNumber.value = traveler.passportNumber ?? ''
  formPassportExpiryDate.value = traveler.passportExpiryDate ?? ''
  formEmergencyContactName.value = traveler.emergencyContactName ?? ''
  formEmergencyContactPhone.value = traveler.emergencyContactPhone ?? ''
  formSpecialRequest.value = traveler.specialRequest ?? ''
  isTravelerDialogOpen.value = true
}

function submitTraveler() {
  if (!project.value || !formName.value.trim()) return
  const payload = {
    groupId: formGroupId.value || undefined,
    name: formName.value.trim(),
    passportNumber: formPassportNumber.value.trim() || undefined,
    passportExpiryDate: formPassportExpiryDate.value || undefined,
    emergencyContactName: formEmergencyContactName.value.trim() || undefined,
    emergencyContactPhone: formEmergencyContactPhone.value.trim() || undefined,
    specialRequest: formSpecialRequest.value.trim() || undefined,
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

function executeDeleteTraveler() {
  if (!travelerToDelete.value) return
  const name = travelerToDelete.value.name
  removeTraveler(travelerToDelete.value.id)
  showToast('Traveler Dihapus', `${name} dihapus dari daftar traveler.`, 'info')
  travelerToDelete.value = null
}

function runImportMock() {
  if (!project.value) return
  const created = importTravelersMock(project.value.id, 3)
  showToast('Import (Mock) Selesai', `${created.length} baris traveler ditambahkan — lengkapi data dokumennya secara manual. Ini simulasi, bukan import file sungguhan.`, 'info')
}

const summaryMetadata = computed(() => {
  if (!project.value) return []
  return [
    { label: 'Client', value: party.value?.name ?? '—' },
    { label: 'Destinasi', value: project.value.destination },
    { label: 'Tanggal Perjalanan', value: formatDateRange(project.value.travelStartDate, project.value.travelEndDate) },
    { label: 'Project Owner', value: owner.value?.name ?? '—' },
    { label: 'Jumlah Traveler', value: formatTravelerCount(project.value.travelerCount) },
    { label: 'Budget', value: formatCurrencyIdr(project.value.budgetIdr) },
    { label: 'Actual Cost', value: formatCurrencyIdr(project.value.actualCostIdr) },
    { label: 'Nilai Quotation', value: formatCurrencyIdr(project.value.quotationAmountIdr) },
  ]
})
</script>

<template>
  <div class="space-y-6">
    <template v-if="!project">
      <PageHeader title="Project Tidak Ditemukan" :breadcrumb="[{ label: 'Projects', to: '/projects' }, { label: 'Not Found' }]" />
      <SectionCard>
        <EmptyState
          :icon="FileX"
          title="Project tidak ditemukan"
          :description="`Project dengan ID '${route.params.id}' tidak ada di data demo saat ini.`"
        >
          <Button @click="router.push('/projects')">Kembali ke Daftar Project</Button>
        </EmptyState>
      </SectionCard>
    </template>

    <RoleAccessState v-else-if="!canView('project')" module-label="modul Projects" />

    <template v-else>
      <PageHeader
        :title="project.name"
        :breadcrumb="[{ label: 'Projects', to: '/projects' }, { label: project.name }]"
      >
        <template #actions>
          <StatusBadge
            :label="findStatusOption(PROJECT_STATUSES, project.status).label"
            :tone="findStatusOption(PROJECT_STATUSES, project.status).tone"
          />
          <StatusBadge
            :label="findStatusOption(PROJECT_CHARACTERISTICS, project.characteristic).label"
            :tone="findStatusOption(PROJECT_CHARACTERISTICS, project.characteristic).tone"
          />
          <AttentionIndicator v-if="needsAttention" severity="high" />
          <StatusBadge v-if="isUpcomingDeparture(project)" label="Upcoming Departure" tone="info" />
        </template>
      </PageHeader>

      <SectionCard>
        <DetailMetadataList :items="summaryMetadata" />
      </SectionCard>

      <Tabs v-model="activeTab">
        <TabsList>
          <TabsTrigger v-for="tab in TABS" :key="tab.value" :value="tab.value">{{ tab.label }}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div class="space-y-6">
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
                Project ini berasal dari opportunity <NuxtLink v-if="project.opportunityId" to="/crm/opportunities" class="text-primary hover:underline">{{ project.opportunityId }}</NuxtLink><span v-else>—</span>.
              </p>
              <p class="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Tim Project</p>
              <div class="flex flex-wrap gap-2">
                <StatusBadge :label="`Owner: ${owner?.name ?? '—'}`" tone="primary" />
                <StatusBadge v-for="member in team" :key="member.id" :label="member.name" tone="neutral" />
              </div>
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
                  <Button v-if="activities.length > 0" size="sm" variant="outline" @click="goToActivityTab">Lihat Semua</Button>
                </template>
                <ul v-if="recentActivityPreview.length" class="divide-y divide-border">
                  <li v-for="entry in recentActivityPreview" :key="entry.id" class="py-2">
                    <p class="text-sm text-foreground">{{ entry.message }}</p>
                    <p class="text-xs text-muted-foreground">{{ formatDate(entry.createdAt) }}</p>
                  </li>
                </ul>
                <EmptyState v-else title="Belum ada aktivitas tercatat" />
              </SectionCard>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="itinerary-services">
          <div class="space-y-6">
            <SectionCard
              v-if="project.characteristic === 'high-change' && changedServicesCount > 0"
              title="Penanda Perubahan"
              description="Project ini adalah High-Change Project."
            >
              <p class="text-sm text-foreground mb-3">
                {{ changedServicesCount }} layanan mengalami perubahan setelah dikonfirmasi. Tinjau riwayat lengkap di tab Activity & Changes.
              </p>
              <Button size="sm" variant="outline" @click="goToActivityTab">Lihat Activity & Changes</Button>
            </SectionCard>

            <SectionCard title="Daily Itinerary" description="Jadwal harian perjalanan.">
              <div v-if="itineraryByDate.length" class="space-y-4">
                <div v-for="day in itineraryByDate" :key="day.date">
                  <p class="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{{ formatDayLabel(day.date) }}</p>
                  <ul class="divide-y divide-border">
                    <li v-for="item in day.items" :key="item.id" class="py-2 flex items-start gap-3">
                      <span class="text-xs text-muted-foreground w-14 shrink-0">{{ item.time ?? '—' }}</span>
                      <div class="min-w-0 flex-1">
                        <p class="text-sm text-foreground">{{ item.title }}</p>
                        <p v-if="item.description" class="text-xs text-muted-foreground">{{ item.description }}</p>
                        <p v-if="item.groupId" class="text-xs text-muted-foreground">Group: {{ groupNameById(item.groupId) }}</p>
                      </div>
                      <StatusBadge
                        v-if="item.serviceType"
                        :label="findStatusOption(SERVICE_TYPES, item.serviceType).label"
                        :tone="findStatusOption(SERVICE_TYPES, item.serviceType).tone"
                      />
                    </li>
                  </ul>
                </div>
              </div>
              <EmptyState v-else title="Belum ada itinerary tercatat" />
            </SectionCard>

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
                    <TableHead v-if="canManageServiceType(type.value)">Update Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow v-for="service in servicesByType(type.value)" :key="service.id">
                    <TableCell class="text-foreground">{{ service.label }}</TableCell>
                    <TableCell class="text-muted-foreground">{{ service.vendorId ? getVendorById(service.vendorId)?.name : '—' }}</TableCell>
                    <TableCell class="text-muted-foreground">{{ service.bookingReference ?? '—' }}</TableCell>
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
                      <select
                        :value="service.status"
                        class="appearance-none px-2 py-1.5 text-xs rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer"
                        @change="handleServiceStatusChange(service.id, $event)"
                      >
                        <option v-for="option in SERVICE_STATUSES" :key="option.value" :value="option.value">{{ option.label }}</option>
                      </select>
                    </TableCell>
                  </TableRow>
                  <TableEmpty v-if="servicesByType(type.value).length === 0" :colspan="canManageServiceType(type.value) ? 5 : 4">
                    Belum ada layanan tercatat.
                  </TableEmpty>
                </TableBody>
              </Table>
            </SectionCard>

            <EmptyState v-if="visibleServiceTypes.length === 0" :icon="Truck" title="Belum ada layanan tercatat untuk project ini" />

            <SectionCard title="Operational Tasks" :description="`${tasks.length} task tercatat untuk project ini`">
              <template v-if="tasks.length" #actions>
                <Button size="sm" variant="outline" @click="activeTab = 'tasks'">Lihat Semua Task</Button>
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
          </div>
        </TabsContent>

        <TabsContent value="travelers">
          <div class="space-y-6">
            <SectionCard
              title="Travelers"
              :description="`${travelers.length} dari ${formatTravelerCount(project.travelerCount)} tercatat detail profilnya`"
            >
              <template v-if="canManageTravelers" #actions>
                <div class="flex items-center gap-2">
                  <Button size="sm" variant="outline" @click="runImportMock"><Upload class="h-4 w-4 mr-1.5" />Import (Mock)</Button>
                  <Dialog v-model:open="isTravelerDialogOpen">
                    <DialogTrigger as-child>
                      <Button size="sm" @click="openCreateTraveler"><UserPlus class="h-4 w-4 mr-1.5" />Tambah Traveler</Button>
                    </DialogTrigger>
                    <DialogContent class="max-w-lg">
                      <DialogHeader>
                        <DialogTitle>{{ editingTravelerId ? 'Edit Traveler' : 'Tambah Traveler Baru' }}</DialogTitle>
                        <DialogDescription>Profil traveler untuk project {{ project.name }}.</DialogDescription>
                      </DialogHeader>
                      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
                        <div class="space-y-1.5 sm:col-span-2">
                          <Label for="traveler-name">Nama</Label>
                          <Input id="traveler-name" v-model="formName" placeholder="Nama lengkap traveler" />
                        </div>
                        <div class="space-y-1.5 sm:col-span-2">
                          <Label for="traveler-group">Group (opsional)</Label>
                          <select
                            id="traveler-group"
                            v-model="formGroupId"
                            class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer"
                          >
                            <option value="">Tanpa Group</option>
                            <option v-for="group in groups" :key="group.id" :value="group.id">{{ group.name }}</option>
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
                          <Label for="traveler-emergency-name">Nama Kontak Darurat (opsional)</Label>
                          <Input id="traveler-emergency-name" v-model="formEmergencyContactName" placeholder="Nama kontak darurat" />
                        </div>
                        <div class="space-y-1.5">
                          <Label for="traveler-emergency-phone">Telepon Kontak Darurat (opsional)</Label>
                          <Input id="traveler-emergency-phone" v-model="formEmergencyContactPhone" placeholder="08xx-xxxx-xxxx" />
                        </div>
                        <div class="space-y-1.5 sm:col-span-2">
                          <Label for="traveler-special-request">Special Request (opsional)</Label>
                          <Input id="traveler-special-request" v-model="formSpecialRequest" placeholder="mis. Kebutuhan kursi roda, menu khusus" />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" @click="isTravelerDialogOpen = false">Batal</Button>
                        <Button :disabled="!formName.trim()" @click="submitTraveler">Simpan</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </template>

              <div v-if="groups.length" class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                <div v-for="group in groups" :key="group.id" class="p-4 rounded-lg border border-border">
                  <p class="text-sm font-medium text-foreground">{{ group.name }}</p>
                  <p class="text-xs text-muted-foreground">{{ formatTravelerCount(group.paxCount) }}</p>
                  <p v-if="group.roomingNote" class="text-xs text-muted-foreground mt-1">{{ group.roomingNote }}</p>
                </div>
              </div>

              <div v-if="roomAssignments.length" class="mb-4">
                <p class="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Rooming List (Contoh Penugasan Kamar)</p>
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
                  <option value="all">Semua Group</option>
                  <option value="ungrouped">Tanpa Group</option>
                  <option v-for="group in groups" :key="group.id" :value="group.id">{{ group.name }}</option>
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
                    <TableHead>Dokumen Paspor</TableHead>
                    <TableHead>Kontak Darurat</TableHead>
                    <TableHead>Special Request</TableHead>
                    <TableHead>Status Dokumen</TableHead>
                    <TableHead v-if="canManageTravelers">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow v-for="traveler in filteredTravelers" :key="traveler.id">
                    <TableCell class="font-medium text-foreground">{{ traveler.name }}</TableCell>
                    <TableCell class="text-muted-foreground">{{ groupNameById(traveler.groupId) }}</TableCell>
                    <TableCell class="text-muted-foreground">{{ passportSummary(traveler) }}</TableCell>
                    <TableCell class="text-muted-foreground">
                      <template v-if="traveler.emergencyContactName">{{ traveler.emergencyContactName }}<template v-if="traveler.emergencyContactPhone"> · {{ traveler.emergencyContactPhone }}</template></template>
                      <template v-else>—</template>
                    </TableCell>
                    <TableCell class="text-muted-foreground">{{ traveler.specialRequest ?? '—' }}</TableCell>
                    <TableCell>
                      <StatusBadge v-if="travelerDocumentMissing(traveler)" label="Dokumen Belum Lengkap" tone="destructive" />
                      <StatusBadge v-else label="Dokumen Lengkap" tone="success" />
                    </TableCell>
                    <TableCell v-if="canManageTravelers">
                      <div class="flex items-center gap-1">
                        <Button size="icon" variant="ghost" @click="openEditTraveler(traveler)"><Pencil class="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" @click="travelerToDelete = traveler"><Trash2 class="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  <TableEmpty v-if="travelers.length > 0 && filteredTravelers.length === 0" :colspan="canManageTravelers ? 7 : 6">
                    Tidak ada traveler yang cocok dengan filter saat ini.
                  </TableEmpty>
                </TableBody>
              </Table>

              <EmptyState v-if="travelers.length === 0" :icon="Users" title="Belum ada traveler tercatat" description="Tambahkan traveler secara manual atau gunakan Import (Mock) untuk mensimulasikan hasil import." />
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
                <Button variant="outline" @click="travelerToDelete = null">Batal</Button>
                <Button variant="destructive" @click="executeDeleteTraveler">Hapus</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="vendors">
          <SectionCard title="Vendors" description="Vendor yang ditugaskan dan perbandingan quotation untuk tiap layanan project ini.">
            <div v-if="services.length" class="space-y-4">
              <div v-for="service in services" :key="service.id" class="p-4 rounded-lg border border-border">
                <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div class="min-w-0">
                    <p class="text-sm font-medium text-foreground">{{ service.label }}</p>
                    <div class="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                      <StatusBadge :label="findStatusOption(SERVICE_TYPES, service.type).label" :tone="findStatusOption(SERVICE_TYPES, service.type).tone" />
                      <span>·</span>
                      <span>Vendor:</span>
                      <NuxtLink v-if="service.vendorId" :to="`/vendors/${service.vendorId}`" class="text-primary hover:underline">{{ getVendorById(service.vendorId)?.name }}</NuxtLink>
                      <span v-else>Belum ditugaskan</span>
                    </div>
                  </div>
                  <StatusBadge
                    :label="findStatusOption(SERVICE_STATUSES, service.status).label"
                    :tone="findStatusOption(SERVICE_STATUSES, service.status).tone"
                  />
                </div>

                <template v-if="quotationsForService(service.id).length">
                  <p class="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Perbandingan Quotation</p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Vendor</TableHead>
                        <TableHead>Nilai</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead v-if="canManageServiceType(service.type)">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow v-for="quotation in quotationsForService(service.id)" :key="quotation.id">
                        <TableCell class="text-foreground">{{ getVendorById(quotation.vendorId)?.name ?? quotation.vendorId }}</TableCell>
                        <TableCell>{{ formatCurrencyIdr(quotation.amountIdr) }}</TableCell>
                        <TableCell>
                          <StatusBadge
                            :label="findStatusOption(VENDOR_QUOTATION_STATUSES, quotation.status).label"
                            :tone="findStatusOption(VENDOR_QUOTATION_STATUSES, quotation.status).tone"
                          />
                        </TableCell>
                        <TableCell v-if="canManageServiceType(service.type)">
                          <div v-if="quotation.status === 'submitted'" class="flex items-center gap-1">
                            <Button size="sm" variant="outline" @click="handleAcceptQuotation(quotation.id)">Terima</Button>
                            <Button size="sm" variant="ghost" @click="handleRejectQuotation(quotation.id)">Tolak</Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </template>
                <p v-else class="text-xs text-muted-foreground">Belum ada quotation untuk layanan ini.</p>
              </div>
            </div>
            <EmptyState v-else :icon="Truck" title="Belum ada layanan tercatat untuk project ini" />
          </SectionCard>
        </TabsContent>

        <TabsContent value="finance">
          <SectionCard title="Finance">
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <StatsCard title="Budget" :value="formatCurrencyIdr(project.budgetIdr)" :icon="Wallet" />
              <StatsCard title="Actual Cost" :value="formatCurrencyIdr(project.actualCostIdr)" :icon="Wallet" :icon-color="project.actualCostIdr > project.budgetIdr ? 'destructive' : 'success'" />
              <StatsCard title="Nilai Quotation" :value="formatCurrencyIdr(project.quotationAmountIdr)" :icon="Wallet" icon-color="primary" />
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Jumlah</TableHead>
                  <TableHead>Jatuh Tempo</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="invoice in invoices" :key="invoice.id">
                  <TableCell class="text-foreground">{{ invoice.label }}</TableCell>
                  <TableCell>{{ formatCurrencyIdr(invoice.amountIdr) }}</TableCell>
                  <TableCell class="text-muted-foreground">{{ formatDate(invoice.dueAt) }}</TableCell>
                  <TableCell>
                    <StatusBadge
                      :label="findStatusOption(INVOICE_STATUSES, invoice.status).label"
                      :tone="findStatusOption(INVOICE_STATUSES, invoice.status).tone"
                    />
                  </TableCell>
                </TableRow>
                <TableEmpty v-if="invoices.length === 0" :colspan="4">Belum ada invoice.</TableEmpty>
              </TableBody>
            </Table>
          </SectionCard>
        </TabsContent>

        <TabsContent value="tasks">
          <SectionCard title="Tasks">
            <ul class="divide-y divide-border">
              <li v-for="task in tasks" :key="task.id" class="py-3 flex items-center justify-between gap-3">
                <span class="text-sm text-foreground">{{ task.title }}</span>
                <StatusBadge
                  :label="findStatusOption(TASK_STATUSES, task.status).label"
                  :tone="findStatusOption(TASK_STATUSES, task.status).tone"
                />
              </li>
            </ul>
            <EmptyState v-if="tasks.length === 0" title="Belum ada task tercatat" />
          </SectionCard>
        </TabsContent>

        <TabsContent value="documents">
          <SectionCard title="Documents">
            <ul class="divide-y divide-border">
              <li v-for="document in documents" :key="document.id" class="py-3 flex items-center justify-between gap-3">
                <span class="text-sm text-foreground">{{ document.name }}</span>
                <span class="text-xs text-muted-foreground">{{ formatDate(document.uploadedAt) }}</span>
              </li>
            </ul>
            <EmptyState v-if="documents.length === 0" title="Belum ada dokumen diunggah" />
          </SectionCard>
        </TabsContent>

        <TabsContent value="activity-changes">
          <SectionCard title="Activity & Changes">
            <template v-if="canLogChange" #actions>
              <Dialog v-model:open="isChangeDialogOpen">
                <DialogTrigger as-child>
                  <Button size="sm" variant="outline">Catat Perubahan</Button>
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
                        <option v-for="category in CHANGE_CATEGORIES" :key="category.value" :value="category.value">{{ category.label }}</option>
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
                    <Button variant="outline" @click="isChangeDialogOpen = false">Batal</Button>
                    <Button :disabled="!changeReason.trim()" @click="submitChangeEntry">Simpan</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </template>

            <div class="flex items-center gap-2 mb-4">
              <button
                @click="changesOnly = false"
                :class="['px-3 py-1.5 text-xs rounded-lg border', !changesOnly ? 'border-primary/40 bg-primary/5 text-primary' : 'border-border text-muted-foreground']"
              >All</button>
              <button
                @click="changesOnly = true"
                :class="['px-3 py-1.5 text-xs rounded-lg border', changesOnly ? 'border-primary/40 bg-primary/5 text-primary' : 'border-border text-muted-foreground']"
              >Changes only</button>
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
                  <p class="text-sm text-foreground">{{ entry.message }}</p>
                  <p v-if="entry.beforeValue || entry.afterValue" class="text-xs text-muted-foreground mt-0.5">
                    <template v-if="entry.beforeValue">Sebelum: {{ entry.beforeValue }}</template><template v-if="entry.beforeValue && entry.afterValue"> → </template><template v-if="entry.afterValue">Sesudah: {{ entry.afterValue }}</template>
                  </p>
                  <p v-if="entry.requestedBy" class="text-xs text-muted-foreground">Diajukan oleh: {{ getUserById(entry.requestedBy)?.name ?? entry.requestedBy }}</p>
                  <p v-if="entry.impactNote" class="text-xs text-muted-foreground">Dampak: {{ entry.impactNote }}</p>
                  <p class="text-xs text-muted-foreground mt-0.5">{{ formatDate(entry.createdAt) }}</p>
                </div>
                <div class="flex flex-col items-end gap-1.5 shrink-0">
                  <StatusBadge v-if="entry.isChange && !entry.approvalStatus" :label="entry.reviewed ? 'Change (Reviewed)' : 'Change (Belum Direview)'" :tone="entry.reviewed ? 'info' : 'warning'" />
                  <AttentionIndicator v-if="entry.approvalStatus === 'pending'" severity="medium" label="Menunggu Approval" />
                  <div v-if="entry.approvalStatus === 'pending' && canApproveChanges" class="flex items-center gap-1">
                    <Button size="sm" variant="outline" @click="handleApproveChange(entry.id)">Setujui</Button>
                    <Button size="sm" variant="ghost" @click="handleRejectChange(entry.id)">Tolak</Button>
                  </div>
                </div>
              </li>
            </ul>
            <EmptyState v-if="visibleActivities.length === 0" title="Belum ada aktivitas tercatat" />
          </SectionCard>
        </TabsContent>
      </Tabs>
    </template>
  </div>
</template>
