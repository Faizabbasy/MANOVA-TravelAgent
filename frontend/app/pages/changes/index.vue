<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Search, Plus, FileWarning, Ban, RefreshCcw, Siren } from 'lucide-vue-next'
import {
  PROJECTS, getProjectById, getUserById,
  CHANGE_REQUESTS, CANCELLATION_RECORDS, REFUND_REQUESTS, INCIDENTS,
  createChangeRequest, createIncident, createRefundRequest,
  getCancellationRecordsByProject
} from '~/data'
import {
  CHANGE_REQUEST_SOURCES, CHANGE_REQUEST_STATUSES, REFUND_REQUEST_STATUSES, REFUND_CREDIT_STATUSES,
  INCIDENT_SEVERITIES, INCIDENT_STATUSES, findStatusOption
} from '~/constants/status'
import { formatCurrencyIdr } from '~/utils/format'
import type { ChangeRequestSource, AffectedEntityRef, IncidentSeverity } from '~/types/change-incident'
import type { BookingDomain } from '~/types/booking-orchestration'

/**
 * Changes & Incidents — cross-project list (Section 19, D-076). Fully additive di atas Section 13-18 dan
 * `ActivityEntry` (Section 14 lama) — lihat `app/types/change-incident.ts`/`app/data/index.ts` untuk detail
 * arsitektur. Pola halaman mengikuti `/bookings` (list+filter+stat) dan `/procurement` (query-param tab).
 */

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Changes & Incidents' })

const route = useRoute()
const router = useRouter()
const { currentUser } = useCurrentUser()
const { canView, canManage } = usePermissions()
const { showToast } = useToast()
const canManageChanges = computed(() => canManage('changes'))

type ChangesTab = 'change-requests' | 'cancellations' | 'refunds' | 'incidents'
const activeTab = computed<ChangesTab>({
  get: () => {
    const tab = route.query.tab as string
    return (['change-requests', 'cancellations', 'refunds', 'incidents'].includes(tab) ? tab : 'change-requests') as ChangesTab
  },
  set: value => router.replace({ query: { ...route.query, tab: value } })
})

const openChangeRequestCount = computed(() => CHANGE_REQUESTS.filter(item => item.status === 'submitted' || item.status === 'under-review').length)
const activeCancellationCount = computed(() => CANCELLATION_RECORDS.length)
const openRefundCount = computed(() => REFUND_REQUESTS.filter(item => item.status === 'requested' || item.status === 'under-review').length)
const openIncidentCount = computed(() => INCIDENTS.filter(item => item.status !== 'resolved' && item.status !== 'closed').length)

/* --- Change Requests --- */
const crSearch = ref('')
const crSourceFilter = ref<'all' | ChangeRequestSource>('all')
const crStatusFilter = ref('all')
const crRows = computed(() => {
  let result = CHANGE_REQUESTS.map(item => ({ item, project: getProjectById(item.projectId) }))
  if (crSourceFilter.value !== 'all') { result = result.filter(row => row.item.source === crSourceFilter.value) }
  if (crStatusFilter.value !== 'all') { result = result.filter(row => row.item.status === crStatusFilter.value) }
  if (crSearch.value.trim()) {
    const q = crSearch.value.toLowerCase()
    result = result.filter(row => row.item.beforeSummary.toLowerCase().includes(q) || row.item.afterSummary.toLowerCase().includes(q) || (row.project?.name ?? '').toLowerCase().includes(q) || row.item.id.toLowerCase().includes(q))
  }
  return result.sort((a, b) => b.item.submittedAt.localeCompare(a.item.submittedAt))
})

/* --- Cancellations --- */
const cnxSearch = ref('')
const cnxDomainFilter = ref<'all' | BookingDomain>('all')
const cnxRows = computed(() => {
  let result = CANCELLATION_RECORDS.map(item => ({ item, project: getProjectById(item.projectId) }))
  if (cnxDomainFilter.value !== 'all') { result = result.filter(row => row.item.bookingType === cnxDomainFilter.value) }
  if (cnxSearch.value.trim()) {
    const q = cnxSearch.value.toLowerCase()
    result = result.filter(row => row.item.bookingId.toLowerCase().includes(q) || row.item.reason.toLowerCase().includes(q) || (row.project?.name ?? '').toLowerCase().includes(q))
  }
  return result.sort((a, b) => b.item.cancelledAt.localeCompare(a.item.cancelledAt))
})

/* --- Refunds --- */
const refSearch = ref('')
const refStatusFilter = ref('all')
const refRows = computed(() => {
  let result = REFUND_REQUESTS.map(item => ({ item, project: getProjectById(item.projectId) }))
  if (refStatusFilter.value !== 'all') { result = result.filter(row => row.item.status === refStatusFilter.value) }
  if (refSearch.value.trim()) {
    const q = refSearch.value.toLowerCase()
    result = result.filter(row => row.item.id.toLowerCase().includes(q) || (row.project?.name ?? '').toLowerCase().includes(q))
  }
  return result.sort((a, b) => b.item.requestedAt.localeCompare(a.item.requestedAt))
})

/* --- Incidents --- */
const incSearch = ref('')
const incSeverityFilter = ref<'all' | IncidentSeverity>('all')
const incStatusFilter = ref('all')
const incRows = computed(() => {
  let result = INCIDENTS.map(item => ({ item, project: getProjectById(item.projectId) }))
  if (incSeverityFilter.value !== 'all') { result = result.filter(row => row.item.severity === incSeverityFilter.value) }
  if (incStatusFilter.value !== 'all') { result = result.filter(row => row.item.status === incStatusFilter.value) }
  if (incSearch.value.trim()) {
    const q = incSearch.value.toLowerCase()
    result = result.filter(row => row.item.title.toLowerCase().includes(q) || (row.project?.name ?? '').toLowerCase().includes(q))
  }
  return result.sort((a, b) => b.item.id.localeCompare(a.item.id))
})

/* Buat Change Request */
const isCreateChangeOpen = ref(false)
const newChangeProjectId = ref('')
const newChangeSource = ref<ChangeRequestSource>('internal')
const newChangeBefore = ref('')
const newChangeAfter = ref('')
const newChangeOperationalImpact = ref('')
const newChangeCommercialImpact = ref<number | null>(null)
const newChangeTimelineImpact = ref('')

function resetChangeForm () {
  newChangeProjectId.value = ''
  newChangeSource.value = 'internal'
  newChangeBefore.value = ''
  newChangeAfter.value = ''
  newChangeOperationalImpact.value = ''
  newChangeCommercialImpact.value = null
  newChangeTimelineImpact.value = ''
}

function submitCreateChange () {
  if (!newChangeProjectId.value || !newChangeBefore.value.trim() || !newChangeAfter.value.trim()) { return }
  const affectedEntities: AffectedEntityRef[] = [{ entityType: 'project', entityId: newChangeProjectId.value }]
  const request = createChangeRequest({
    projectId: newChangeProjectId.value,
    source: newChangeSource.value,
    requestedBy: currentUser.value.id,
    affectedEntities,
    beforeSummary: newChangeBefore.value.trim(),
    afterSummary: newChangeAfter.value.trim(),
    operationalImpact: newChangeOperationalImpact.value.trim() || undefined,
    commercialImpactIdr: newChangeCommercialImpact.value ?? undefined,
    timelineImpactNote: newChangeTimelineImpact.value.trim() || undefined
  })
  resetChangeForm()
  isCreateChangeOpen.value = false
  showToast('Change Request Dibuat', `${request.id} tercatat berstatus "Diajukan".`, 'success')
  navigateTo(`/changes/${request.id}`)
}

/* Catat Incident */
const isCreateIncidentOpen = ref(false)
const newIncidentProjectId = ref('')
const newIncidentTitle = ref('')
const newIncidentDescription = ref('')
const newIncidentSeverity = ref<IncidentSeverity>('medium')

function resetIncidentForm () {
  newIncidentProjectId.value = ''
  newIncidentTitle.value = ''
  newIncidentDescription.value = ''
  newIncidentSeverity.value = 'medium'
}

function submitCreateIncident () {
  if (!newIncidentProjectId.value || !newIncidentTitle.value.trim() || !newIncidentDescription.value.trim()) { return }
  const incident = createIncident({
    projectId: newIncidentProjectId.value,
    title: newIncidentTitle.value.trim(),
    description: newIncidentDescription.value.trim(),
    severity: newIncidentSeverity.value,
    ownerId: currentUser.value.id
  })
  resetIncidentForm()
  isCreateIncidentOpen.value = false
  showToast('Incident Dicatat', `${incident.id} tercatat berstatus "Open".`, 'success')
  navigateTo(`/changes/incidents/${incident.id}`)
}

/* Ajukan Refund */
const isCreateRefundOpen = ref(false)
const newRefundProjectId = ref('')
const newRefundCancellationId = ref('')
const newRefundType = ref<'partial' | 'full'>('partial')
const newRefundAmount = ref<number | null>(null)
const projectCancellations = computed(() => (newRefundProjectId.value ? getCancellationRecordsByProject(newRefundProjectId.value) : []))

function resetRefundForm () {
  newRefundProjectId.value = ''
  newRefundCancellationId.value = ''
  newRefundType.value = 'partial'
  newRefundAmount.value = null
}

function submitCreateRefund () {
  if (!newRefundProjectId.value || !newRefundAmount.value) { return }
  const refund = createRefundRequest({
    projectId: newRefundProjectId.value,
    cancellationId: newRefundCancellationId.value || undefined,
    type: newRefundType.value,
    amountIdr: newRefundAmount.value,
    requestedBy: currentUser.value.id
  })
  resetRefundForm()
  isCreateRefundOpen.value = false
  showToast('Refund Request Diajukan', `${refund.id} tercatat berstatus "Diajukan".`, 'success')
  navigateTo(`/changes/refunds/${refund.id}`)
}
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Changes & Incidents"
      description="Change Request (Client/Internal/Supplier), Cancellation dan penalty, Refund Request, dan Incident — exception management lintas project."
      :breadcrumb="[{ label: 'Changes & Incidents' }]"
    >
      <template v-if="canManageChanges" #actions>
        <div class="flex flex-wrap items-center gap-2">
          <Dialog v-model:open="isCreateChangeOpen">
            <DialogTrigger as-child>
              <Button size="sm" variant="outline">
                <Plus class="h-4 w-4 mr-1.5" />Change Request
              </Button>
            </DialogTrigger>
            <DialogScrollContent class="max-w-lg">
              <DialogHeader>
                <DialogTitle>Buat Change Request Baru</DialogTitle>
                <DialogDescription>Akan tercatat sekaligus sebagai entri Activity & Changes pada project terkait.</DialogDescription>
              </DialogHeader>
              <div class="space-y-4 py-2">
                <div class="grid grid-cols-2 gap-3">
                  <div class="space-y-1.5">
                    <Label for="cr-project">Project</Label>
                    <select id="cr-project" v-model="newChangeProjectId" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                      <option value="" disabled>
                        Pilih project
                      </option>
                      <option v-for="project in PROJECTS" :key="project.id" :value="project.id">
                        {{ project.name }}
                      </option>
                    </select>
                  </div>
                  <div class="space-y-1.5">
                    <Label for="cr-source">Sumber</Label>
                    <select id="cr-source" v-model="newChangeSource" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                      <option v-for="option in CHANGE_REQUEST_SOURCES" :key="option.value" :value="option.value">
                        {{ option.label }}
                      </option>
                    </select>
                  </div>
                </div>
                <div class="space-y-1.5">
                  <Label for="cr-before">Sebelum</Label>
                  <Input id="cr-before" v-model="newChangeBefore" placeholder="mis. Kamar Deluxe 18 pax" />
                </div>
                <div class="space-y-1.5">
                  <Label for="cr-after">Sesudah</Label>
                  <Input id="cr-after" v-model="newChangeAfter" placeholder="mis. Upgrade ke Suite 18 pax" />
                </div>
                <div class="space-y-1.5">
                  <Label for="cr-operational">Dampak Operasional (opsional)</Label>
                  <Input id="cr-operational" v-model="newChangeOperationalImpact" placeholder="mis. Rooming list perlu disusun ulang" />
                </div>
                <div class="grid grid-cols-2 gap-3">
                  <div class="space-y-1.5">
                    <Label for="cr-commercial">Dampak Komersial (Rp, opsional)</Label>
                    <CurrencyInput id="cr-commercial" v-model="newChangeCommercialImpact" />
                  </div>
                  <div class="space-y-1.5">
                    <Label for="cr-timeline">Dampak Timeline (opsional)</Label>
                    <Input id="cr-timeline" v-model="newChangeTimelineImpact" placeholder="mis. Mundur 3 hari" />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" @click="isCreateChangeOpen = false">
                  Batal
                </Button>
                <Button :disabled="!newChangeProjectId || !newChangeBefore.trim() || !newChangeAfter.trim()" @click="submitCreateChange">
                  Simpan
                </Button>
              </DialogFooter>
            </DialogScrollContent>
          </Dialog>

          <Dialog v-model:open="isCreateRefundOpen">
            <DialogTrigger as-child>
              <Button size="sm" variant="outline">
                <Plus class="h-4 w-4 mr-1.5" />Refund
              </Button>
            </DialogTrigger>
            <DialogContent class="max-w-md">
              <DialogHeader>
                <DialogTitle>Ajukan Refund Request</DialogTitle>
                <DialogDescription>Self-contained mock — tidak mengubah Invoice/Payment (forward dependency Section 20).</DialogDescription>
              </DialogHeader>
              <div class="space-y-4 py-2">
                <div class="space-y-1.5">
                  <Label for="ref-project">Project</Label>
                  <select id="ref-project" v-model="newRefundProjectId" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                    <option value="" disabled>
                      Pilih project
                    </option>
                    <option v-for="project in PROJECTS" :key="project.id" :value="project.id">
                      {{ project.name }}
                    </option>
                  </select>
                </div>
                <div class="space-y-1.5">
                  <Label for="ref-cancellation">Cancellation Terkait (opsional)</Label>
                  <select id="ref-cancellation" v-model="newRefundCancellationId" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                    <option value="">
                      Tidak terkait cancellation tertentu
                    </option>
                    <option v-for="cnx in projectCancellations" :key="cnx.id" :value="cnx.id">
                      {{ cnx.id }} — {{ cnx.bookingType }} {{ cnx.bookingId }}
                    </option>
                  </select>
                </div>
                <div class="grid grid-cols-2 gap-3">
                  <div class="space-y-1.5">
                    <Label for="ref-type">Tipe</Label>
                    <select id="ref-type" v-model="newRefundType" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                      <option value="partial">
                        Partial
                      </option>
                      <option value="full">
                        Full
                      </option>
                    </select>
                  </div>
                  <div class="space-y-1.5">
                    <Label for="ref-amount">Jumlah (Rp)</Label>
                    <CurrencyInput id="ref-amount" v-model="newRefundAmount" />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" @click="isCreateRefundOpen = false">
                  Batal
                </Button>
                <Button :disabled="!newRefundProjectId || !newRefundAmount" @click="submitCreateRefund">
                  Kirim
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog v-model:open="isCreateIncidentOpen">
            <DialogTrigger as-child>
              <Button size="sm">
                <Plus class="h-4 w-4 mr-1.5" />Incident
              </Button>
            </DialogTrigger>
            <DialogContent class="max-w-md">
              <DialogHeader>
                <DialogTitle>Catat Incident Baru</DialogTitle>
                <DialogDescription>Insiden dapat project-level atau ditautkan ke booking tertentu dari halaman detail.</DialogDescription>
              </DialogHeader>
              <div class="space-y-4 py-2">
                <div class="space-y-1.5">
                  <Label for="inc-project">Project</Label>
                  <select id="inc-project" v-model="newIncidentProjectId" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                    <option value="" disabled>
                      Pilih project
                    </option>
                    <option v-for="project in PROJECTS" :key="project.id" :value="project.id">
                      {{ project.name }}
                    </option>
                  </select>
                </div>
                <div class="space-y-1.5">
                  <Label for="inc-title">Judul</Label>
                  <Input id="inc-title" v-model="newIncidentTitle" placeholder="mis. Kendaraan mogok" />
                </div>
                <div class="space-y-1.5">
                  <Label for="inc-description">Deskripsi</Label>
                  <textarea id="inc-description" v-model="newIncidentDescription" rows="3" class="w-full px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
                <div class="space-y-1.5">
                  <Label for="inc-severity">Severity</Label>
                  <select id="inc-severity" v-model="newIncidentSeverity" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                    <option v-for="option in INCIDENT_SEVERITIES" :key="option.value" :value="option.value">
                      {{ option.label }}
                    </option>
                  </select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" @click="isCreateIncidentOpen = false">
                  Batal
                </Button>
                <Button :disabled="!newIncidentProjectId || !newIncidentTitle.trim() || !newIncidentDescription.trim()" @click="submitCreateIncident">
                  Simpan
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </template>
    </PageHeader>

    <RoleAccessState v-if="!canView('changes')" module-label="modul Changes & Incidents" />

    <template v-else>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Change Request Terbuka" :value="String(openChangeRequestCount)" :icon="FileWarning" icon-color="warning" />
        <StatsCard title="Total Cancellation" :value="String(activeCancellationCount)" :icon="Ban" />
        <StatsCard title="Refund Terbuka" :value="String(openRefundCount)" :icon="RefreshCcw" icon-color="warning" />
        <StatsCard title="Incident Terbuka" :value="String(openIncidentCount)" :icon="Siren" icon-color="destructive" />
      </div>

      <Tabs v-model="activeTab">
        <TabsList>
          <TabsTrigger value="change-requests">
            Change Requests
          </TabsTrigger>
          <TabsTrigger value="cancellations">
            Cancellations
          </TabsTrigger>
          <TabsTrigger value="refunds">
            Refunds
          </TabsTrigger>
          <TabsTrigger value="incidents">
            Incidents
          </TabsTrigger>
        </TabsList>

        <TabsContent value="change-requests">
          <div class="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
            <div class="relative flex-1 max-w-sm w-full">
              <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input v-model="crSearch" placeholder="Cari ringkasan atau project..." class="pl-9" />
            </div>
            <select v-model="crSourceFilter" class="appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
              <option value="all">
                Semua Sumber
              </option>
              <option v-for="option in CHANGE_REQUEST_SOURCES" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
            <select v-model="crStatusFilter" class="appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
              <option value="all">
                Semua Status
              </option>
              <option v-for="option in CHANGE_REQUEST_STATUSES" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </div>
          <SectionCard>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Change Request</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Sumber</TableHead>
                  <TableHead>Before → After</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="row in crRows" :key="row.item.id" class="cursor-pointer hover:bg-muted/50" @click="navigateTo(`/changes/${row.item.id}`)">
                  <TableCell class="font-medium text-foreground">
                    {{ row.item.id }}
                  </TableCell>
                  <TableCell class="text-muted-foreground">
                    {{ row.project?.name ?? row.item.projectId }}
                  </TableCell>
                  <TableCell><StatusBadge :label="findStatusOption(CHANGE_REQUEST_SOURCES, row.item.source).label" :tone="findStatusOption(CHANGE_REQUEST_SOURCES, row.item.source).tone" /></TableCell>
                  <TableCell class="text-muted-foreground max-w-[320px] truncate">
                    {{ row.item.beforeSummary }} → {{ row.item.afterSummary }}
                  </TableCell>
                  <TableCell><StatusBadge :label="findStatusOption(CHANGE_REQUEST_STATUSES, row.item.status).label" :tone="findStatusOption(CHANGE_REQUEST_STATUSES, row.item.status).tone" /></TableCell>
                </TableRow>
                <TableEmpty v-if="crRows.length === 0" :colspan="5">
                  {{ crSearch || crSourceFilter !== 'all' || crStatusFilter !== 'all' ? 'Tidak ada Change Request yang cocok dengan filter.' : 'Belum ada Change Request.' }}
                </TableEmpty>
              </TableBody>
            </Table>
          </SectionCard>
        </TabsContent>

        <TabsContent value="cancellations">
          <div class="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
            <div class="relative flex-1 max-w-sm w-full">
              <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input v-model="cnxSearch" placeholder="Cari booking ID, alasan, atau project..." class="pl-9" />
            </div>
            <select v-model="cnxDomainFilter" class="appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
              <option value="all">
                Semua Domain
              </option>
              <option value="flight">
                Flight
              </option>
              <option value="hotel">
                Hotel
              </option>
              <option value="transport">
                Transport
              </option>
              <option value="mice">
                MICE
              </option>
            </select>
          </div>
          <SectionCard description="Cancellation dibuat otomatis dari halaman detail booking (Ticketing/Accommodation/Transportation/MICE) saat status berpindah ke cancelled/no-show/refunded.">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cancellation</TableHead>
                  <TableHead>Booking</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Alasan</TableHead>
                  <TableHead>Penalty</TableHead>
                  <TableHead>Refund Eligible</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="row in cnxRows" :key="row.item.id" class="cursor-pointer hover:bg-muted/50" @click="navigateTo(`/changes/cancellations/${row.item.id}`)">
                  <TableCell class="font-medium text-foreground">
                    {{ row.item.id }}
                  </TableCell>
                  <TableCell class="text-muted-foreground">
                    {{ row.item.bookingType }} {{ row.item.bookingId }}
                  </TableCell>
                  <TableCell class="text-muted-foreground">
                    {{ row.project?.name ?? row.item.projectId }}
                  </TableCell>
                  <TableCell class="text-muted-foreground max-w-[260px] truncate">
                    {{ row.item.reason }}
                  </TableCell>
                  <TableCell class="text-muted-foreground">
                    {{ row.item.penaltyIdr !== undefined ? formatCurrencyIdr(row.item.penaltyIdr) : 'Tidak ada' }}
                  </TableCell>
                  <TableCell><StatusBadge :label="row.item.refundEligible ? 'Eligible' : 'Tidak Eligible'" :tone="row.item.refundEligible ? 'success' : 'neutral'" /></TableCell>
                </TableRow>
                <TableEmpty v-if="cnxRows.length === 0" :colspan="6">
                  {{ cnxSearch || cnxDomainFilter !== 'all' ? 'Tidak ada Cancellation yang cocok dengan filter.' : 'Belum ada Cancellation tercatat.' }}
                </TableEmpty>
              </TableBody>
            </Table>
          </SectionCard>
        </TabsContent>

        <TabsContent value="refunds">
          <div class="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
            <div class="relative flex-1 max-w-sm w-full">
              <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input v-model="refSearch" placeholder="Cari ID refund atau project..." class="pl-9" />
            </div>
            <select v-model="refStatusFilter" class="appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
              <option value="all">
                Semua Status
              </option>
              <option v-for="option in REFUND_REQUEST_STATUSES" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </div>
          <SectionCard>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Refund</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Tipe</TableHead>
                  <TableHead>Jumlah</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Credit Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="row in refRows" :key="row.item.id" class="cursor-pointer hover:bg-muted/50" @click="navigateTo(`/changes/refunds/${row.item.id}`)">
                  <TableCell class="font-medium text-foreground">
                    {{ row.item.id }}
                  </TableCell>
                  <TableCell class="text-muted-foreground">
                    {{ row.project?.name ?? row.item.projectId }}
                  </TableCell>
                  <TableCell class="text-muted-foreground capitalize">
                    {{ row.item.type }}
                  </TableCell>
                  <TableCell class="text-foreground">
                    {{ formatCurrencyIdr(row.item.amountIdr) }}
                  </TableCell>
                  <TableCell><StatusBadge :label="findStatusOption(REFUND_REQUEST_STATUSES, row.item.status).label" :tone="findStatusOption(REFUND_REQUEST_STATUSES, row.item.status).tone" /></TableCell>
                  <TableCell><StatusBadge :label="findStatusOption(REFUND_CREDIT_STATUSES, row.item.creditStatus).label" :tone="findStatusOption(REFUND_CREDIT_STATUSES, row.item.creditStatus).tone" /></TableCell>
                </TableRow>
                <TableEmpty v-if="refRows.length === 0" :colspan="6">
                  {{ refSearch || refStatusFilter !== 'all' ? 'Tidak ada Refund Request yang cocok dengan filter.' : 'Belum ada Refund Request.' }}
                </TableEmpty>
              </TableBody>
            </Table>
          </SectionCard>
        </TabsContent>

        <TabsContent value="incidents">
          <div class="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
            <div class="relative flex-1 max-w-sm w-full">
              <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input v-model="incSearch" placeholder="Cari judul atau project..." class="pl-9" />
            </div>
            <select v-model="incSeverityFilter" class="appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
              <option value="all">
                Semua Severity
              </option>
              <option v-for="option in INCIDENT_SEVERITIES" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
            <select v-model="incStatusFilter" class="appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
              <option value="all">
                Semua Status
              </option>
              <option v-for="option in INCIDENT_STATUSES" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </div>
          <SectionCard>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Incident</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Booking Terkait</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="row in incRows" :key="row.item.id" class="cursor-pointer hover:bg-muted/50" @click="navigateTo(`/changes/incidents/${row.item.id}`)">
                  <TableCell class="min-w-[200px]">
                    <p class="font-medium text-foreground">
                      {{ row.item.id }}
                    </p>
                    <p class="text-xs text-muted-foreground truncate max-w-[220px]">
                      {{ row.item.title }}
                    </p>
                  </TableCell>
                  <TableCell class="text-muted-foreground">
                    {{ row.project?.name ?? row.item.projectId }}
                  </TableCell>
                  <TableCell class="text-muted-foreground">
                    {{ row.item.bookingId ? `${row.item.bookingType} ${row.item.bookingId}` : 'Project-level' }}
                  </TableCell>
                  <TableCell class="text-muted-foreground">
                    {{ getUserById(row.item.ownerId)?.name ?? row.item.ownerId }}
                  </TableCell>
                  <TableCell><StatusBadge :label="findStatusOption(INCIDENT_SEVERITIES, row.item.severity).label" :tone="findStatusOption(INCIDENT_SEVERITIES, row.item.severity).tone" /></TableCell>
                  <TableCell><StatusBadge :label="findStatusOption(INCIDENT_STATUSES, row.item.status).label" :tone="findStatusOption(INCIDENT_STATUSES, row.item.status).tone" /></TableCell>
                </TableRow>
                <TableEmpty v-if="incRows.length === 0" :colspan="6">
                  {{ incSearch || incSeverityFilter !== 'all' || incStatusFilter !== 'all' ? 'Tidak ada Incident yang cocok dengan filter.' : 'Belum ada Incident tercatat.' }}
                </TableEmpty>
              </TableBody>
            </Table>
          </SectionCard>
        </TabsContent>
      </Tabs>
    </template>
  </div>
</template>
