<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Search, FolderKanban, AlertTriangle, CheckCircle2, Clock, Plus, Users, MapPin } from 'lucide-vue-next'
import { cn } from '~/lib/utils'
import {
  PROJECTS, PARTIES, getPartyById, getUserById, getProjectOrderStatus,
  createProject, getTravelers, getSalesOrderById, getProjectSeatsFilled,
  ensureProjectServiceForBudget, updateProjectServiceBudget
} from '~/data'
import {
  PROJECT_ORDER_STEPS,
  getProjectOrderStep,
  evaluateProjectOrderStepGate,
  getProjectMilestoneSummary
} from '~/data/project-order-workflow'
import { PROJECT_ORDER_STATUSES, PROJECT_STATUSES, PROJECT_SEGMENTS, PROJECT_BUSINESS_TYPES, SERVICE_TYPES, findStatusOption } from '~/constants/status'
import { formatCurrencyIdr, formatDateRange } from '~/utils/format'
import type { ProjectOrderStepKey } from '~/types/project-order'
import type { Project, ProjectSegment, ProjectBusinessType, ServiceTypeKey } from '~/types/project'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Project' })

const { canView, canViewFinancials, canManage } = usePermissions()
const { showToast } = useToast()

/**
 * Daftar kanonik Project Order (Revisi 9-Modul) — menggantikan dua daftar paralel yang sebelumnya membaca
 * `PROJECTS` yang sama (`/projects` dan `/customer-journey/project-orders`). Setiap baris menampilkan step
 * aktif pada alur 6 step beserta indikator apakah step tersebut sedang tertahan gerbangnya.
 */
const hasAccess = computed(() => canView('operations'))
const canManageOrders = computed(() => canManage('operations'))

/**
 * Klasifikasi "Leisure" (dulu "Project Orders") vs "Business" (dulu "Sales Order"), masing-masing beranak
 * FIT/GIT — Business beranak sekali lagi Corporate/Government/Association sebelum FIT/GIT. `isGroupTrip`
 * TIDAK berubah maknanya (GIT = `true`, FIT = `false`/kosong) — `segment`/`businessType` (`Project`,
 * `app/types/project.ts`) adalah sumbu klasifikasi terpisah, independen dari FIT/GIT.
 */
const activeSegment = ref<ProjectSegment>('leisure')
const leisureDivision = ref<'fit' | 'git'>('fit')
const businessDivision = ref<ProjectBusinessType>('corporate')
const businessFitGit = ref<'fit' | 'git'>('fit')
const FIT_GIT_OPTIONS = [
  { value: 'fit' as const, label: 'FIT' },
  { value: 'git' as const, label: 'GIT' }
]

/** Tabel mana yang tampil — tabel FIT (6-step order workflow, tidak berubah) atau tabel GIT (seats/revenue,
 * tidak berubah), terlepas dari Leisure/Business/Corporate/Government/Association yang sedang aktif. */
const isGitView = computed(() =>
  activeSegment.value === 'leisure' ? leisureDivision.value === 'git' : businessFitGit.value === 'git')

/** Filter bersama `rows` (FIT) dan `groupTripRows` (GIT) — `wantGit` dikunci per pemanggil (bukan `isGitView`),
 * supaya kedua computed tetap terhitung independen dari view yang lagi aktif dan cuma salah satu yang dirender. */
function matchesActiveDivision (project: Project, wantGit: boolean): boolean {
  if (Boolean(project.isGroupTrip) !== wantGit) { return false }
  if (project.segment !== activeSegment.value) { return false }
  if (activeSegment.value === 'business' && project.businessType !== businessDivision.value) { return false }
  return true
}

/** Tab "Project B2C" — dulu list `SalesOrder` mentah + tombol "Buat Sales Order" berdiri sendiri. Sejak
 * Group Trip ada (`createProject` dengan `isGroupTrip: true` + `joinLeadToGroupProject`), itulah cara B2C
 * sebenarnya sekarang — jadi list di sini diganti Project ber-`isGroupTrip`, bukan `SALES_ORDERS` lagi.
 * Tidak ada tombol "Buat" di tab ini — Group Trip dibuat lewat tombol "Buat Project" di tab Leisure/Business
 * (centang "Group Trip"). Difilter ke Leisure/Business/Corporate/Government/Association yang sedang aktif. */
const groupTripRows = computed(() => PROJECTS.filter(project => matchesActiveDivision(project, true)).map((project) => {
  const bookings = getTravelers(project.id)
    .filter(traveler => traveler.salesOrderId)
    .map(traveler => getSalesOrderById(traveler.salesOrderId!))
    .filter((order): order is NonNullable<typeof order> => Boolean(order))
  return {
    project,
    seatsFilled: getProjectSeatsFilled(project.id),
    pricePerPaxIdr: project.travelerCount > 0 ? Math.round(project.quotationAmountIdr / project.travelerCount) : 0,
    revenueIdr: bookings.reduce((sum, order) => sum + order.priceIdr, 0)
  }
}))

const salesOrderSearch = ref('')
const filteredGroupTripRows = computed(() => {
  if (!salesOrderSearch.value.trim()) { return groupTripRows.value }
  const query = salesOrderSearch.value.toLowerCase()
  return groupTripRows.value.filter(row =>
    row.project.destination.toLowerCase().includes(query) ||
    row.project.name.toLowerCase().includes(query))
})

const salesOrdersSummary = computed(() => ({
  total: groupTripRows.value.length,
  seatsFilled: groupTripRows.value.reduce((sum, row) => sum + row.seatsFilled, 0),
  revenueIdr: groupTripRows.value.reduce((sum, row) => sum + row.revenueIdr, 0),
  completed: groupTripRows.value.filter(row => row.project.status === 'completed' || Boolean(row.project.closedAt)).length
}))

/** Buat Project untuk customer yang sudah ada (bukan lewat Lead → Won) — hanya Party berstatus 'client'
 * yang boleh dipilih (customer yang benar-benar sudah pernah Won), konsisten `createProject`. */
const clientParties = computed(() => PARTIES.filter(party => party.lifecycleStatus === 'client'))

const isCreateProjectOpen = ref(false)
const newProjectIsGroupTrip = ref(false)
const newProjectSegment = ref<ProjectSegment>('leisure')
const newProjectBusinessType = ref<ProjectBusinessType>('corporate')
const newProjectPartyId = ref('')
const newProjectName = ref('')
const newProjectDestination = ref('')
const newProjectStartDate = ref('')
const newProjectEndDate = ref('')
const newProjectTravelerCount = ref<number | null>(null)
const newProjectServiceScope = ref<ServiceTypeKey[]>([])
const newProjectAmountIdr = ref<number | null>(null)
/** Budget per layanan langsung di form "Buat Project" — muncul begitu chip Service Scope dicentang, opsional,
 * memakai mesin yang sama dengan "Edit Budget" tab Finance (`ensureProjectServiceForBudget`/
 * `updateProjectServiceBudget`, `app/data/index.ts`) supaya tidak perlu bolak-balik ke halaman lain. */
const newProjectServiceBudgets = ref<Partial<Record<ServiceTypeKey, number | null>>>({})

function toggleNewProjectServiceScope (type: ServiceTypeKey) {
  const index = newProjectServiceScope.value.indexOf(type)
  if (index === -1) { newProjectServiceScope.value.push(type) } else { newProjectServiceScope.value.splice(index, 1) }
}

/** Prefill Segment/BusinessType/Group Trip dari konteks navigasi yang sedang dibuka — supaya "Buat Project"
 * lewat mis. tab Business > Government > GIT langsung sesuai tanpa harus diisi ulang manual. */
watch(isCreateProjectOpen, (open) => {
  if (!open) { return }
  newProjectSegment.value = activeSegment.value
  newProjectBusinessType.value = activeSegment.value === 'business' ? businessDivision.value : 'corporate'
  newProjectIsGroupTrip.value = isGitView.value
})

function resetCreateProjectForm () {
  newProjectIsGroupTrip.value = false
  newProjectSegment.value = 'leisure'
  newProjectBusinessType.value = 'corporate'
  newProjectPartyId.value = ''
  newProjectName.value = ''
  newProjectDestination.value = ''
  newProjectStartDate.value = ''
  newProjectEndDate.value = ''
  newProjectTravelerCount.value = null
  newProjectServiceScope.value = []
  newProjectAmountIdr.value = null
  newProjectServiceBudgets.value = {}
}

const isNewProjectFormValid = computed(() => Boolean(
  (newProjectIsGroupTrip.value || newProjectPartyId.value) &&
  newProjectName.value.trim() &&
  newProjectDestination.value.trim() &&
  newProjectStartDate.value &&
  newProjectEndDate.value &&
  newProjectTravelerCount.value &&
  newProjectServiceScope.value.length &&
  newProjectAmountIdr.value
))

const newProjectServiceBudgetsTotal = computed(() =>
  newProjectServiceScope.value.reduce((sum, type) => sum + (newProjectServiceBudgets.value[type] ?? 0), 0)
)

function submitCreateProject () {
  if (!isNewProjectFormValid.value) { return }
  const project = createProject({
    isGroupTrip: newProjectIsGroupTrip.value,
    partyId: newProjectIsGroupTrip.value ? undefined : newProjectPartyId.value,
    segment: newProjectSegment.value,
    businessType: newProjectSegment.value === 'business' ? newProjectBusinessType.value : undefined,
    name: newProjectName.value.trim(),
    destination: newProjectDestination.value.trim(),
    travelStartDate: newProjectStartDate.value,
    travelEndDate: newProjectEndDate.value,
    travelerCount: newProjectTravelerCount.value!,
    serviceScope: newProjectServiceScope.value,
    quotationAmountIdr: newProjectAmountIdr.value!
  })
  if (!project) { showToast('Gagal Membuat Project', 'Periksa kembali tanggal dan data yang diisi.', 'error'); return }
  for (const type of newProjectServiceScope.value) {
    const amount = newProjectServiceBudgets.value[type]
    if (!amount) { continue }
    const label = findStatusOption(SERVICE_TYPES, type).label
    const service = ensureProjectServiceForBudget(project.id, type, label)
    updateProjectServiceBudget(service.id, amount)
  }
  resetCreateProjectForm()
  isCreateProjectOpen.value = false
  showToast('Project Dibuat', `${project.id} tercatat berstatus "Draft".`, 'success')
}

const searchQuery = ref('')
const stepFilter = ref<'all' | ProjectOrderStepKey>('all')

const rows = computed(() => PROJECTS.filter(project => matchesActiveDivision(project, false)).map((project) => {
  const stepKey = getProjectOrderStep(project)
  const step = PROJECT_ORDER_STEPS.find(item => item.key === stepKey)!
  const gate = evaluateProjectOrderStepGate(project.id, stepKey)
  const milestones = getProjectMilestoneSummary(project.id)

  return {
    project,
    party: getPartyById(project.partyId),
    owner: getUserById(project.ownerId),
    orderStatus: findStatusOption(PROJECT_ORDER_STATUSES, getProjectOrderStatus(project)),
    step,
    gate,
    milestones,
    needsAttention: !gate.ready || milestones.delayed > 0
  }
}))

const filteredRows = computed(() => {
  let result = rows.value
  if (stepFilter.value !== 'all') { result = result.filter(row => row.step.key === stepFilter.value) }
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(row =>
      row.project.name.toLowerCase().includes(query) ||
      row.project.id.toLowerCase().includes(query) ||
      (row.party?.name ?? '').toLowerCase().includes(query))
  }
  return result
})

const stats = computed(() => ({
  total: rows.value.length,
  blocked: rows.value.filter(row => !row.gate.ready).length,
  delayed: rows.value.filter(row => row.milestones.delayed > 0).length,
  closed: rows.value.filter(row => Boolean(row.project.closedAt)).length
}))

/** Distribusi per step untuk chip filter — sekaligus menunjukkan di mana pekerjaan menumpuk. */
const stepCounts = computed(() => PROJECT_ORDER_STEPS.map(step => ({
  step,
  count: rows.value.filter(row => row.step.key === step.key).length
})))
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Project"
      description="Seluruh project order MANOVA dalam alur 6 step: Drafting → Confirmed → Start → Departure → On Progress → Done."
      :breadcrumb="[{ label: 'Operations & Scheduling' }, { label: 'Project' }]"
    />

    <div v-if="hasAccess" class="space-y-2">
      <div class="flex flex-wrap gap-2">
        <button
          v-for="seg in PROJECT_SEGMENTS"
          :key="seg.value"
          type="button"
          :class="cn(
            'px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors',
            activeSegment === seg.value ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground'
          )"
          @click="activeSegment = seg.value"
        >
          {{ seg.label }}
        </button>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <template v-if="activeSegment === 'leisure'">
          <button
            v-for="div in FIT_GIT_OPTIONS"
            :key="div.value"
            type="button"
            :class="cn(
              'px-3 py-1 text-xs font-medium rounded-md border transition-colors',
              leisureDivision === div.value ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground'
            )"
            @click="leisureDivision = div.value"
          >
            {{ div.label }}
          </button>
        </template>
        <template v-else>
          <button
            v-for="div in PROJECT_BUSINESS_TYPES"
            :key="div.value"
            type="button"
            :class="cn(
              'px-3 py-1 text-xs font-medium rounded-md border transition-colors',
              businessDivision === div.value ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground'
            )"
            @click="businessDivision = div.value"
          >
            {{ div.label }}
          </button>
          <div class="ml-1 flex items-center gap-0.5 rounded-lg bg-muted p-0.5">
            <button
              v-for="fg in FIT_GIT_OPTIONS"
              :key="fg.value"
              type="button"
              :class="cn(
                'rounded-md px-2.5 py-1 text-xs font-medium transition-all',
                businessFitGit === fg.value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              )"
              @click="businessFitGit = fg.value"
            >
              {{ fg.label }}
            </button>
          </div>
        </template>
      </div>
    </div>

    <RoleAccessState v-if="!hasAccess" module-label="modul Operations & Scheduling" />

    <template v-else-if="!isGitView">
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Total Project" :value="String(stats.total)" :icon="FolderKanban" />
        <StatsCard title="Step Tertahan" :value="String(stats.blocked)" :icon="AlertTriangle" :icon-color="stats.blocked ? 'destructive' : 'success'" />
        <StatsCard title="Ada Milestone Telat" :value="String(stats.delayed)" :icon="Clock" :icon-color="stats.delayed ? 'warning' : 'success'" />
        <StatsCard title="Selesai & Ditutup" :value="String(stats.closed)" :icon="CheckCircle2" icon-color="success" />
      </div>

      <div class="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-3">
        <div class="relative flex-1 max-w-sm w-full">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input v-model="searchQuery" placeholder="Cari nomor, nama, atau customer..." class="pl-9" />
        </div>
        <Sheet v-if="canManageOrders" v-model:open="isCreateProjectOpen">
          <SheetTrigger as-child>
            <Button size="sm" class="ml-auto">
              <Plus class="h-4 w-4 mr-1.5" />Buat Project
            </Button>
          </SheetTrigger>
          <SheetContent side="right" class="w-full sm:max-w-md overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Buat Project Baru</SheetTitle>
              <SheetDescription>Untuk customer yang sudah ada — tanpa lewat Lead, status awal "Draft".</SheetDescription>
            </SheetHeader>
            <div class="space-y-4 py-4">
              <div class="grid grid-cols-2 gap-3">
                <div class="space-y-1.5">
                  <Label for="prj-segment">Segment</Label>
                  <select
                    id="prj-segment"
                    v-model="newProjectSegment"
                    class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer"
                  >
                    <option v-for="seg in PROJECT_SEGMENTS" :key="seg.value" :value="seg.value">
                      {{ seg.label }}
                    </option>
                  </select>
                </div>
                <div v-if="newProjectSegment === 'business'" class="space-y-1.5">
                  <Label for="prj-business-type">Divisi Business</Label>
                  <select
                    id="prj-business-type"
                    v-model="newProjectBusinessType"
                    class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer"
                  >
                    <option v-for="type in PROJECT_BUSINESS_TYPES" :key="type.value" :value="type.value">
                      {{ type.label }}
                    </option>
                  </select>
                </div>
              </div>

              <label class="flex items-start gap-2 text-sm text-foreground cursor-pointer rounded-lg border border-input px-3 py-2.5">
                <Checkbox v-model="newProjectIsGroupTrip" class="mt-0.5" />
                <span>
                  <span class="block font-medium">Group Trip (GIT) — banyak traveler individual</span>
                  <span class="block text-xs text-muted-foreground">Project dibuat tanpa customer dulu — tiap Lead yang gabung belakangan jadi Customer sendiri-sendiri. Kosongkan untuk FIT.</span>
                </span>
              </label>

              <div v-if="!newProjectIsGroupTrip" class="space-y-1.5">
                <Label for="prj-customer">Customer</Label>
                <select
                  id="prj-customer"
                  v-model="newProjectPartyId"
                  class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer"
                >
                  <option value="" disabled>
                    Pilih customer
                  </option>
                  <option v-for="party in clientParties" :key="party.id" :value="party.id">
                    {{ party.name }}
                  </option>
                </select>
                <p v-if="!clientParties.length" class="text-xs text-muted-foreground">
                  Belum ada customer berstatus Client. Menangkan Lead terlebih dahulu.
                </p>
              </div>
              <p v-else class="text-xs text-muted-foreground">
                Customer diisi otomatis per-traveler saat Lead bergabung ke Group Trip ini (lewat Qualify Lead individual-travel).
              </p>

              <div class="space-y-1.5">
                <Label for="prj-name">Nama Project</Label>
                <Input id="prj-name" v-model="newProjectName" placeholder="mis. Jakarta Business Trip Q1 2027" />
              </div>
              <div class="space-y-1.5">
                <Label for="prj-destination">Destinasi</Label>
                <Input id="prj-destination" v-model="newProjectDestination" placeholder="mis. Bali" />
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div class="space-y-1.5">
                  <Label for="prj-start">Tanggal Berangkat</Label>
                  <Input id="prj-start" v-model="newProjectStartDate" type="date" />
                </div>
                <div class="space-y-1.5">
                  <Label for="prj-end">Tanggal Pulang</Label>
                  <Input id="prj-end" v-model="newProjectEndDate" type="date" />
                </div>
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div class="space-y-1.5">
                  <Label for="prj-travelers">Jumlah Traveler</Label>
                  <Input id="prj-travelers" v-model.number="newProjectTravelerCount" type="number" min="1" />
                </div>
                <div class="space-y-1.5">
                  <Label for="prj-amount">Nilai Kontrak (Rp)</Label>
                  <CurrencyInput id="prj-amount" v-model="newProjectAmountIdr" />
                </div>
              </div>
              <div class="space-y-1.5">
                <Label>Service Scope</Label>
                <div class="flex flex-wrap gap-2">
                  <button
                    v-for="type in SERVICE_TYPES"
                    :key="type.value"
                    type="button"
                    class="rounded-full border px-3 py-1 text-xs transition-colors"
                    :class="newProjectServiceScope.includes(type.value) ? 'border-primary bg-primary/10 text-primary' : 'border-input text-muted-foreground'"
                    @click="toggleNewProjectServiceScope(type.value)"
                  >
                    {{ type.value === 'additional' ? 'Other' : type.label }}
                  </button>
                </div>
              </div>
              <div v-if="newProjectServiceScope.length" class="space-y-3">
                <Label>Budget per Layanan (opsional)</Label>
                <div v-for="type in SERVICE_TYPES.filter(t => newProjectServiceScope.includes(t.value))" :key="type.value" class="space-y-1.5">
                  <Label :for="`prj-budget-${type.value}`" class="text-xs text-muted-foreground">
                    {{ type.value === 'additional' ? 'Other' : type.label }}
                  </Label>
                  <CurrencyInput :id="`prj-budget-${type.value}`" v-model="newProjectServiceBudgets[type.value]" placeholder="mis. 100000000" />
                </div>
                <p v-if="newProjectAmountIdr" class="text-xs text-muted-foreground">
                  Nilai Kontrak: <span class="font-medium text-foreground">{{ formatCurrencyIdr(newProjectAmountIdr) }}</span>
                  · Sudah Dialokasikan: <span class="font-medium text-foreground">{{ formatCurrencyIdr(newProjectServiceBudgetsTotal) }}</span>
                </p>
              </div>
            </div>
            <SheetFooter class="flex-row justify-end gap-2">
              <Button variant="outline" @click="resetCreateProjectForm(); isCreateProjectOpen = false">
                Batal
              </Button>
              <Button :disabled="!isNewProjectFormValid" @click="submitCreateProject">
                Simpan
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>

      <div class="flex flex-wrap gap-2">
        <button
          type="button"
          :class="cn(
            'px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors',
            stepFilter === 'all' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground'
          )"
          @click="stepFilter = 'all'"
        >
          Semua ({{ rows.length }})
        </button>
        <button
          v-for="entry in stepCounts"
          :key="entry.step.key"
          type="button"
          :class="cn(
            'px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors',
            stepFilter === entry.step.key ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground'
          )"
          @click="stepFilter = entry.step.key"
        >
          {{ entry.step.index }}. {{ entry.step.label }} ({{ entry.count }})
        </button>
      </div>

      <SectionCard>
        <Table v-if="filteredRows.length">
          <TableHeader>
            <TableRow>
              <TableHead>Project</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Kondisi</TableHead>
              <TableHead>Jadwal</TableHead>
              <TableHead>Milestone</TableHead>
              <TableHead v-if="canViewFinancials" class="text-right">
                Nilai Kontrak
              </TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow
              v-for="row in filteredRows"
              :key="row.project.id"
              class="cursor-pointer"
              @click="$router.push(`/project-orders/${row.project.id}`)"
            >
              <TableCell>
                <p class="text-sm font-medium text-foreground">
                  {{ row.project.name }}
                </p>
                <p class="text-xs text-muted-foreground font-mono">
                  {{ row.project.id }} · {{ row.owner?.name ?? '—' }}
                </p>
              </TableCell>
              <TableCell>
                <p class="text-sm text-foreground">
                  {{ row.party?.name ?? '—' }}
                </p>
              </TableCell>
              <TableCell>
                <p v-if="!row.gate.ready" class="text-xs text-destructive line-clamp-1" :title="row.gate.blockers.join(' ')">
                  {{ row.gate.blockers.length }} syarat belum terpenuhi
                </p>
                <span v-else class="text-xs text-muted-foreground">—</span>
              </TableCell>
              <TableCell class="text-sm text-muted-foreground">
                {{ formatDateRange(row.project.travelStartDate, row.project.travelEndDate) }}
              </TableCell>
              <TableCell>
                <span class="text-sm text-foreground">{{ row.milestones.completed }}/{{ row.milestones.total }}</span>
                <p v-if="row.milestones.delayed" class="text-xs text-destructive">
                  {{ row.milestones.delayed }} telat
                </p>
              </TableCell>
              <TableCell v-if="canViewFinancials" class="text-right text-sm font-medium text-foreground">
                {{ formatCurrencyIdr(row.project.quotationAmountIdr) }}
              </TableCell>
              <TableCell>
                <StatusBadge :label="row.orderStatus.label" :tone="row.orderStatus.tone" />
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>

        <EmptyState
          v-else
          :icon="FolderKanban"
          title="Tidak ada Project yang cocok"
          description="Ubah kata kunci atau lepas filter yang aktif."
        />
      </SectionCard>
    </template>

    <template v-else-if="isGitView">
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Total Project B2C" :value="String(salesOrdersSummary.total)" :icon="Users" />
        <StatsCard title="Total Seat Terisi" :value="String(salesOrdersSummary.seatsFilled)" :icon="CheckCircle2" icon-color="primary" />
        <StatsCard title="Total Revenue" :value="formatCurrencyIdr(salesOrdersSummary.revenueIdr)" :icon="CheckCircle2" icon-color="success" />
        <StatsCard title="Selesai" :value="String(salesOrdersSummary.completed)" :icon="CheckCircle2" icon-color="success" />
      </div>

      <div class="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-3 mt-4">
        <div class="relative flex-1 max-w-sm w-full">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input v-model="salesOrderSearch" placeholder="Cari nama project atau destinasi..." class="pl-9" />
        </div>
        <p class="text-xs text-muted-foreground ml-auto">
          Group Trip baru dibuat dari tab "FIT" (di divisi yang sama) — tombol "Buat Project", centang "Group Trip (GIT)".
        </p>
      </div>

      <SectionCard class="mt-4">
        <Table v-if="filteredGroupTripRows.length">
          <TableHeader>
            <TableRow>
              <TableHead>Project</TableHead>
              <TableHead>Tanggal</TableHead>
              <TableHead>Seats</TableHead>
              <TableHead class="text-right">
                Price/pax
              </TableHead>
              <TableHead class="text-right">
                Revenue
              </TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow
              v-for="row in filteredGroupTripRows"
              :key="row.project.id"
              class="cursor-pointer"
              @click="$router.push(`/project-orders/${row.project.id}`)"
            >
              <TableCell>
                <div class="flex items-center gap-3">
                  <div class="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary/10 text-primary">
                    <img v-if="row.project.photoUrl" :src="row.project.photoUrl" alt="" class="h-full w-full object-cover">
                    <MapPin v-else class="h-4 w-4" />
                  </div>
                  <div class="min-w-0">
                    <p class="text-sm font-medium text-foreground">
                      {{ row.project.name }}
                    </p>
                    <p class="text-xs text-muted-foreground">
                      {{ row.project.destination }}
                    </p>
                  </div>
                </div>
              </TableCell>
              <TableCell class="text-sm text-muted-foreground">
                {{ formatDateRange(row.project.travelStartDate, row.project.travelEndDate) }}
              </TableCell>
              <TableCell class="text-sm text-muted-foreground">
                {{ row.seatsFilled }} / {{ row.project.travelerCount }}
              </TableCell>
              <TableCell class="text-right text-sm text-muted-foreground">
                {{ formatCurrencyIdr(row.pricePerPaxIdr) }}
              </TableCell>
              <TableCell class="text-right text-sm font-medium text-foreground">
                {{ formatCurrencyIdr(row.revenueIdr) }}
              </TableCell>
              <TableCell>
                <StatusBadge :label="findStatusOption(PROJECT_STATUSES, row.project.status).label" :tone="findStatusOption(PROJECT_STATUSES, row.project.status).tone" />
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>

        <EmptyState
          v-else
          :icon="Users"
          title="Belum ada Project GIT di divisi ini"
          description="Buat Group Trip dulu dari tab FIT di divisi yang sama (tombol Buat Project, centang Group Trip)."
        />
      </SectionCard>
    </template>
  </div>
</template>
