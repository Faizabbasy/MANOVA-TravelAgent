<script setup lang="ts">
import { computed, ref } from 'vue'
import { Search, FolderKanban, AlertTriangle, CheckCircle2, Clock, Plus, Users } from 'lucide-vue-next'
import { cn } from '~/lib/utils'
import {
  PROJECTS, getPartyById, getUserById, getProjectOrderStatus,
  SALES_ORDERS, getSalesOrdersSummary, createSalesOrder
} from '~/data'
import {
  PROJECT_ORDER_STEPS,
  getProjectOrderStep,
  evaluateProjectOrderStepGate,
  getProjectMilestoneSummary
} from '~/data/project-order-workflow'
import { PROJECT_ORDER_STATUSES, PROJECT_CHARACTERISTICS, SALES_ORDER_STATUSES, findStatusOption } from '~/constants/status'
import { formatCurrencyIdr, formatDateRange } from '~/utils/format'
import type { ProjectOrderStepKey } from '~/types/project-order'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Project' })

const { canView, canViewFinancials, canManage } = usePermissions()
const { currentUser } = useCurrentUser()
const { showToast } = useToast()

/**
 * Daftar kanonik Project Order (Revisi 9-Modul) — menggantikan dua daftar paralel yang sebelumnya membaca
 * `PROJECTS` yang sama (`/projects` dan `/customer-journey/project-orders`). Setiap baris menampilkan step
 * aktif pada alur 6 step beserta indikator apakah step tersebut sedang tertahan gerbangnya.
 */
const hasAccess = computed(() => canView('operations'))
const canManageOrders = computed(() => canManage('operations'))

/** Pill-tab: Project Orders (B2B, tabel yang sudah ada, tidak berubah) vs Sales Orders (B2C individual, baru). */
const activeOrderTab = ref<'project-orders' | 'sales-orders'>('project-orders')

const salesOrderRows = computed(() => SALES_ORDERS.map(order => ({
  order,
  customer: getPartyById(order.customerId)
})))

const salesOrderSearch = ref('')
const filteredSalesOrderRows = computed(() => {
  if (!salesOrderSearch.value.trim()) { return salesOrderRows.value }
  const query = salesOrderSearch.value.toLowerCase()
  return salesOrderRows.value.filter(row =>
    row.order.destination.toLowerCase().includes(query) ||
    (row.customer?.name ?? '').toLowerCase().includes(query))
})

const salesOrdersSummary = computed(() => getSalesOrdersSummary())

/* Buat Sales Order */
const isCreateSalesOrderOpen = ref(false)
const newCustomerName = ref('')
const newDestination = ref('')
const newTravelStartDate = ref('')
const newTravelEndDate = ref('')
const newTravelerCount = ref<number | null>(null)
const newPriceIdr = ref<number | null>(null)
const newNote = ref('')

function resetSalesOrderForm () {
  newCustomerName.value = ''
  newDestination.value = ''
  newTravelStartDate.value = ''
  newTravelEndDate.value = ''
  newTravelerCount.value = null
  newPriceIdr.value = null
  newNote.value = ''
}

function submitSalesOrder () {
  if (!newCustomerName.value.trim() || !newDestination.value.trim() || !newTravelStartDate.value || !newTravelEndDate.value || !newTravelerCount.value || !newPriceIdr.value) { return }
  const order = createSalesOrder({
    customerName: newCustomerName.value.trim(),
    destination: newDestination.value.trim(),
    travelStartDate: newTravelStartDate.value,
    travelEndDate: newTravelEndDate.value,
    travelerCount: newTravelerCount.value,
    priceIdr: newPriceIdr.value,
    note: newNote.value.trim() || undefined
  })
  if (!order) { showToast('Gagal Membuat Sales Order', 'Periksa kembali tanggal, jumlah traveler, dan harga.', 'error'); return }
  resetSalesOrderForm()
  isCreateSalesOrderOpen.value = false
  showToast('Sales Order Dibuat', `${order.id} tercatat berstatus "Draft".`, 'success')
}

const searchQuery = ref('')
const stepFilter = ref<'all' | ProjectOrderStepKey>('all')
const attentionOnly = ref(false)
const mineOnly = ref(false)

const rows = computed(() => PROJECTS.map((project) => {
  const stepKey = getProjectOrderStep(project)
  const step = PROJECT_ORDER_STEPS.find(item => item.key === stepKey)!
  const gate = evaluateProjectOrderStepGate(project.id, stepKey)
  const milestones = getProjectMilestoneSummary(project.id)

  return {
    project,
    party: getPartyById(project.partyId),
    owner: getUserById(project.ownerId),
    orderStatus: findStatusOption(PROJECT_ORDER_STATUSES, getProjectOrderStatus(project)),
    characteristic: findStatusOption(PROJECT_CHARACTERISTICS, project.characteristic),
    step,
    gate,
    milestones,
    needsAttention: !gate.ready || milestones.delayed > 0
  }
}))

const filteredRows = computed(() => {
  let result = rows.value
  if (stepFilter.value !== 'all') { result = result.filter(row => row.step.key === stepFilter.value) }
  if (attentionOnly.value) { result = result.filter(row => row.needsAttention) }
  if (mineOnly.value) { result = result.filter(row => row.project.ownerId === currentUser.value.id) }
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

    <div v-if="hasAccess" class="flex flex-wrap gap-2">
      <button
        type="button"
        :class="cn(
          'px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors',
          activeOrderTab === 'project-orders' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground'
        )"
        @click="activeOrderTab = 'project-orders'"
      >
        Project Orders
      </button>
      <button
        type="button"
        :class="cn(
          'px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors',
          activeOrderTab === 'sales-orders' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground'
        )"
        @click="activeOrderTab = 'sales-orders'"
      >
        Sales Orders
      </button>
    </div>

    <RoleAccessState v-if="!hasAccess" module-label="modul Operations & Scheduling" />

    <template v-else-if="activeOrderTab === 'project-orders'">
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
        <label class="flex items-center gap-2 text-sm text-foreground cursor-pointer">
          <Checkbox v-model="attentionOnly" />
          Hanya yang butuh perhatian
        </label>
        <label class="flex items-center gap-2 text-sm text-foreground cursor-pointer">
          <Checkbox v-model="mineOnly" />
          Hanya milik saya
        </label>
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
              <TableHead>Step Aktif</TableHead>
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
                <StatusBadge :label="row.characteristic.label" :tone="row.characteristic.tone" />
              </TableCell>
              <TableCell>
                <div class="flex items-center gap-1.5">
                  <span
                    :class="cn(
                      'h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0',
                      row.gate.ready ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'
                    )"
                  >
                    {{ row.step.index }}
                  </span>
                  <span class="text-sm text-foreground">{{ row.step.label }}</span>
                </div>
                <p v-if="!row.gate.ready" class="text-xs text-destructive mt-0.5 line-clamp-1" :title="row.gate.blockers.join(' ')">
                  {{ row.gate.blockers.length }} syarat belum terpenuhi
                </p>
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

    <template v-else-if="activeOrderTab === 'sales-orders'">
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Total Sales Order" :value="String(salesOrdersSummary.total)" :icon="Users" />
        <StatsCard title="Draft" :value="String(salesOrdersSummary.draft)" :icon="Clock" />
        <StatsCard title="Dibayar" :value="String(salesOrdersSummary.paid)" :icon="CheckCircle2" icon-color="primary" />
        <StatsCard title="Selesai" :value="String(salesOrdersSummary.done)" :icon="CheckCircle2" icon-color="success" />
      </div>

      <div class="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-3 mt-4">
        <div class="relative flex-1 max-w-sm w-full">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input v-model="salesOrderSearch" placeholder="Cari customer atau destinasi..." class="pl-9" />
        </div>
        <Dialog v-if="canManageOrders" v-model:open="isCreateSalesOrderOpen">
          <DialogTrigger as-child>
            <Button size="sm" class="ml-auto">
              <Plus class="h-4 w-4 mr-1.5" />Buat Sales Order
            </Button>
          </DialogTrigger>
          <DialogContent class="max-w-md">
            <DialogHeader>
              <DialogTitle>Buat Sales Order Baru</DialogTitle>
              <DialogDescription>Booking individual (B2C) — customer baru otomatis dibuat, status awal "Draft".</DialogDescription>
            </DialogHeader>
            <div class="space-y-4 py-2">
              <div class="space-y-1.5">
                <Label for="so-customer">Nama Customer</Label>
                <Input id="so-customer" v-model="newCustomerName" placeholder="mis. Budi Santoso" />
              </div>
              <div class="space-y-1.5">
                <Label for="so-destination">Destinasi</Label>
                <Input id="so-destination" v-model="newDestination" placeholder="mis. Bali" />
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div class="space-y-1.5">
                  <Label for="so-start">Tanggal Berangkat</Label>
                  <Input id="so-start" v-model="newTravelStartDate" type="date" />
                </div>
                <div class="space-y-1.5">
                  <Label for="so-end">Tanggal Pulang</Label>
                  <Input id="so-end" v-model="newTravelEndDate" type="date" />
                </div>
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div class="space-y-1.5">
                  <Label for="so-travelers">Jumlah Traveler</Label>
                  <Input id="so-travelers" v-model.number="newTravelerCount" type="number" min="1" />
                </div>
                <div class="space-y-1.5">
                  <Label for="so-price">Harga (Rp)</Label>
                  <CurrencyInput id="so-price" v-model="newPriceIdr" />
                </div>
              </div>
              <div class="space-y-1.5">
                <Label for="so-note">Catatan (opsional)</Label>
                <Input id="so-note" v-model="newNote" placeholder="Catatan tambahan" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" @click="resetSalesOrderForm(); isCreateSalesOrderOpen = false">
                Batal
              </Button>
              <Button :disabled="!newCustomerName.trim() || !newDestination.trim() || !newTravelStartDate || !newTravelEndDate || !newTravelerCount || !newPriceIdr" @click="submitSalesOrder">
                Simpan
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <SectionCard class="mt-4">
        <Table v-if="filteredSalesOrderRows.length">
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead>Destinasi</TableHead>
              <TableHead>Tanggal</TableHead>
              <TableHead>Traveler</TableHead>
              <TableHead class="text-right">
                Harga
              </TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow
              v-for="row in filteredSalesOrderRows"
              :key="row.order.id"
              class="cursor-pointer"
              @click="$router.push(`/sales-orders/${row.order.id}`)"
            >
              <TableCell class="text-sm font-medium text-foreground">
                {{ row.customer?.name ?? '—' }}
              </TableCell>
              <TableCell class="text-sm text-foreground">
                {{ row.order.destination }}
              </TableCell>
              <TableCell class="text-sm text-muted-foreground">
                {{ formatDateRange(row.order.travelStartDate, row.order.travelEndDate) }}
              </TableCell>
              <TableCell class="text-sm text-muted-foreground">
                {{ row.order.travelerCount }}
              </TableCell>
              <TableCell class="text-right text-sm font-medium text-foreground">
                {{ formatCurrencyIdr(row.order.priceIdr) }}
              </TableCell>
              <TableCell>
                <StatusBadge :label="findStatusOption(SALES_ORDER_STATUSES, row.order.status).label" :tone="findStatusOption(SALES_ORDER_STATUSES, row.order.status).tone" />
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>

        <EmptyState
          v-else
          :icon="Users"
          title="Belum ada Sales Order"
          description="Ubah kata kunci atau buat Sales Order baru."
        />
      </SectionCard>
    </template>
  </div>
</template>
