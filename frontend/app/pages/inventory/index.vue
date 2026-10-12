<script setup lang="ts">
import { computed, ref } from 'vue'
import { Package, Wrench, AlertTriangle, PackageCheck, Search, Undo2, Plus, Pencil, Eye, ChevronRight } from 'lucide-vue-next'
import { cn } from '~/lib/utils'
import {
  ASSETS,
  ASSET_CATEGORIES,
  ASSET_CONDITIONS,
  ASSET_STATUSES,
  MAINTENANCE_TYPES,
  MAINTENANCE_STATUSES,
  CHECKOUT_STATUSES,
  MAINTENANCE_SCHEDULES,
  getAssetById,
  getInventorySummary,
  getOverdueMaintenance,
  getUpcomingMaintenance,
  getActiveCheckouts,
  getAssetUtilization,
  getAssetQuantityInUse
} from '~/data/inventory'
import {
  checkoutAssetOnServer, completeMaintenanceOnServer, createAssetOnServer, returnAssetOnServer, scheduleMaintenanceOnServer, updateAssetOnServer
} from '~/data/inventory-sync'
import { createSaveGate } from '~/lib/save-gate'
import { PROJECTS, getUserById, getProjectById } from '~/data'
import { findStatusOption } from '~/constants/status'
import { formatCurrencyIdr, formatDate } from '~/utils/format'
import { DEMO_REFERENCE_DATE } from '~/utils/attention'
import type { Asset, AssetCategoryKey, MaintenanceSchedule } from '~/types/inventory'
import type { AssetInput } from '~/types/api'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Inventory' })

const { canView, can } = usePermissions()
const { showToast } = useToast()

const hasAccess = computed(() => canView('inventory'))
const canManage = computed(() => can('inventory.manage-asset'))
/* S11a: assets, maintenance and checkouts live on the server; a refused save leaves the screen as it was. */
const api = useApi()
const { saving: isSaving, run: save } = createSaveGate(showToast)
const TODAY = new Date().toISOString().slice(0, 10)

const refreshKey = ref(0)
const activeTab = ref<'assets' | 'maintenance' | 'checkouts' | 'utilization'>('assets')
const searchQuery = ref('')
const categoryFilter = ref<'all' | AssetCategoryKey>('all')

const summary = computed(() => {
  void refreshKey.value
  return getInventorySummary()
})

const filteredAssets = computed(() => {
  void refreshKey.value
  let result = ASSETS as Asset[]
  if (categoryFilter.value !== 'all') { result = result.filter(asset => asset.category === categoryFilter.value) }
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(asset =>
      asset.name.toLowerCase().includes(query) ||
      asset.code.toLowerCase().includes(query) ||
      (asset.brand ?? '').toLowerCase().includes(query))
  }
  return result
})

const overdueMaintenance = computed(() => {
  void refreshKey.value
  return getOverdueMaintenance()
})
const upcomingMaintenance = computed(() => {
  void refreshKey.value
  return getUpcomingMaintenance()
})
const allMaintenance = computed(() => {
  void refreshKey.value
  return [...MAINTENANCE_SCHEDULES].sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt))
})
const activeCheckouts = computed(() => {
  void refreshKey.value
  return getActiveCheckouts()
})
const overdueCheckouts = computed(() => activeCheckouts.value.filter(checkout => checkout.status === 'overdue'))

/**
 * Selisih hari sejak tanggal jatuh tempo — badge "X hari terlambat" di card "Butuh Perhatian Segera". S11a: dihitung
 * dari hari ini, sama seperti status `overdue` dari server.
 */
function overdueDays (isoDate: string): number {
  return Math.max(1, Math.round((new Date(TODAY).getTime() - new Date(isoDate).getTime()) / 86400000))
}
const utilization = computed(() => {
  void refreshKey.value
  return getAssetUtilization()
})

const categoryCounts = computed(() => ASSET_CATEGORIES.map(category => ({
  category,
  count: ASSETS.filter(asset => asset.category === category.value).length,
  valueIdr: ASSETS.filter(asset => asset.category === category.value).reduce((sum, asset) => sum + (asset.purchasePriceIdr ?? 0), 0)
})))

/* Dialog tambah / edit aset */
const isAssetFormOpen = ref(false)
const assetFormMode = ref<'create' | 'edit'>('create')
const editingAssetId = ref<string | undefined>()
const assetForm = ref({
  name: '',
  category: 'camera' as AssetCategoryKey,
  brand: '',
  serialNumber: '',
  location: '',
  purchasedAt: DEMO_REFERENCE_DATE,
  purchasePriceIdr: null as number | null,
  quantity: 1,
  condition: 'good' as Asset['condition'],
  status: 'available' as Asset['status'],
  note: ''
})

function openCreate () {
  assetFormMode.value = 'create'
  editingAssetId.value = undefined
  assetForm.value = {
    name: '',
    category: 'camera',
    brand: '',
    serialNumber: '',
    location: '',
    purchasedAt: DEMO_REFERENCE_DATE,
    purchasePriceIdr: null,
    quantity: 1,
    condition: 'good',
    status: 'available',
    note: ''
  }
  isAssetFormOpen.value = true
}

function openEdit (asset: Asset) {
  assetFormMode.value = 'edit'
  editingAssetId.value = asset.id
  assetForm.value = {
    name: asset.name,
    category: asset.category,
    brand: asset.brand ?? '',
    serialNumber: asset.serialNumber ?? '',
    location: asset.location,
    purchasedAt: asset.purchasedAt,
    purchasePriceIdr: asset.purchasePriceIdr ?? null,
    quantity: asset.quantity,
    condition: asset.condition,
    status: asset.status,
    note: asset.note ?? ''
  }
  isAssetFormOpen.value = true
}

const isAssetFormValid = computed(() => Boolean(
  assetForm.value.name.trim() &&
  assetForm.value.location.trim() &&
  assetForm.value.quantity && assetForm.value.quantity > 0
))

async function submitAssetForm () {
  if (!isAssetFormValid.value) { return }
  const price = assetForm.value.purchasePriceIdr ? Math.round(Number(assetForm.value.purchasePriceIdr)) : 0
  const payload: AssetInput = {
    name: assetForm.value.name.trim(),
    brand: assetForm.value.brand.trim() || null,
    serialNumber: assetForm.value.serialNumber.trim() || null,
    location: assetForm.value.location.trim(),
    purchasedOn: assetForm.value.purchasedAt,
    purchasePriceMinor: price > 0 ? String(price) : null,
    quantity: Number(assetForm.value.quantity) || 1,
    condition: assetForm.value.condition,
    note: assetForm.value.note.trim() || null
  }
  // `in-use` is set only by a checkout, so the status is sent only when the user changed it to another one.
  const status = assetForm.value.status

  if (assetFormMode.value === 'edit' && editingAssetId.value) {
    const id = editingAssetId.value
    if (status !== getAssetById(id)?.status && status !== 'in-use') { payload.status = status }
    const saved = await save('Aset Gagal Disimpan', () => updateAssetOnServer(api, id, payload))
    if (!saved) { return }
    refreshKey.value += 1
    isAssetFormOpen.value = false
    showToast('Perubahan disimpan', `"${payload.name}" diperbarui.`, 'success')
    return
  }

  const created = await save('Aset Gagal Ditambahkan', () => createAssetOnServer(api, {
    ...payload, category: assetForm.value.category, status: status === 'in-use' ? 'available' : status
  }))
  if (!created) { return }
  refreshKey.value += 1
  isAssetFormOpen.value = false
  showToast('Aset ditambahkan', `"${payload.name}" masuk ke daftar aset.`, 'success')
}

/* Dialog detail aset */
const detailAssetId = ref<string | undefined>()
const detailAsset = computed(() => detailAssetId.value ? getAssetById(detailAssetId.value) : undefined)

/* Dialog pengembalian aset */
const returnTargetId = ref<string | undefined>()
const returnCondition = ref<Asset['condition']>('good')

async function submitReturn () {
  if (!returnTargetId.value) { return }
  const id = returnTargetId.value
  const done = await save('Pengembalian Gagal', () => returnAssetOnServer(api, id, returnCondition.value))
  if (!done) { return }
  refreshKey.value += 1
  returnTargetId.value = undefined
  showToast('Aset dikembalikan', 'Status aset diperbarui sesuai kondisi saat kembali.', 'success')
}

async function onCompleteMaintenance (maintenanceId: string) {
  const done = await save('Maintenance Gagal Diselesaikan', () => completeMaintenanceOnServer(api, maintenanceId))
  if (!done) { return }
  refreshKey.value += 1
  showToast('Maintenance selesai', 'Aset kembali berstatus tersedia.', 'success')
}

/* Dialog pinjamkan aset (S11a) — ke project (opsional) atau dipakai sendiri; peminjamnya user yang login. */
const isLendOpen = ref(false)
const lendForm = ref({ assetId: '', projectId: '', dueOn: TODAY, note: '' })
const lendableAssets = computed(() => ASSETS.filter(asset => asset.status === 'available'))
const openProjects = computed(() => PROJECTS.filter(project => !project.closedAt).sort((a, b) => a.id.localeCompare(b.id)))

function openLend () {
  lendForm.value = { assetId: '', projectId: '', dueOn: TODAY, note: '' }
  isLendOpen.value = true
}

async function submitLend () {
  const form = lendForm.value
  if (!form.assetId || !form.dueOn) { return }
  const done = await save('Aset Gagal Dipinjamkan', () => checkoutAssetOnServer(api, {
    assetId: form.assetId, dueOn: form.dueOn, projectId: form.projectId || undefined, note: form.note.trim() || undefined
  }))
  if (!done) { return }
  refreshKey.value += 1
  isLendOpen.value = false
  showToast('Aset dipinjamkan', 'Aset berstatus dipakai sampai dikembalikan.', 'success')
}

/* Dialog jadwalkan maintenance (S11a). */
const isMaintenanceOpen = ref(false)
const emptyMaintenanceForm = () => ({
  assetId: '', type: 'routine' as MaintenanceSchedule['type'], scheduledOn: TODAY, vendorName: '', costIdr: null as number | null, intervalDays: null as number | null, note: ''
})
const maintenanceForm = ref(emptyMaintenanceForm())

function openMaintenance () {
  maintenanceForm.value = emptyMaintenanceForm()
  isMaintenanceOpen.value = true
}

async function submitMaintenance () {
  const form = maintenanceForm.value
  if (!form.assetId || !form.scheduledOn) { return }
  const cost = form.costIdr ? Math.round(Number(form.costIdr)) : 0
  const interval = form.intervalDays ? Math.round(Number(form.intervalDays)) : 0
  const done = await save('Maintenance Gagal Dijadwalkan', () => scheduleMaintenanceOnServer(api, {
    assetId: form.assetId,
    type: form.type,
    scheduledOn: form.scheduledOn,
    vendorName: form.vendorName.trim() || undefined,
    costMinor: cost > 0 ? String(cost) : undefined,
    intervalDays: interval > 0 ? interval : undefined,
    note: form.note.trim() || undefined
  }))
  if (!done) { return }
  refreshKey.value += 1
  isMaintenanceOpen.value = false
  showToast('Maintenance dijadwalkan', 'Jadwal tercatat di tab Maintenance.', 'success')
}
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Inventory"
      description="Kamera & alat produksi, properti pendukung, dan jadwal maintenance aset milik MANOVA."
      :breadcrumb="[{ label: 'Inventory' }]"
    >
      <template v-if="canManage" #actions>
        <Button size="sm" variant="outline" @click="openMaintenance">
          <Wrench class="h-4 w-4 mr-1.5" />
          Jadwalkan Maintenance
        </Button>
        <Button size="sm" variant="outline" @click="openLend">
          <PackageCheck class="h-4 w-4 mr-1.5" />
          Pinjamkan Aset
        </Button>
        <Button size="sm" @click="openCreate">
          <Plus class="h-4 w-4 mr-1.5" />
          Tambah Aset
        </Button>
      </template>
    </PageHeader>

    <RoleAccessState v-if="!hasAccess" module-label="modul Inventory" />

    <template v-else>
      <!-- Mobile — 3 card angka pendek (Total/Tersedia/Maintenance) jadi strip horizontal ringkas; "Nilai
           Aset" (nominal rupiah panjang) tetap full-width ukuran normal supaya tidak overflow/kepotong. -->
      <div class="space-y-2 sm:hidden">
        <div class="-mx-1 grid grid-flow-col auto-cols-[minmax(110px,1fr)] gap-2 overflow-x-auto px-1 pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <StatsCard size="sm" title="Total Aset" :value="String(summary.total)" :icon="Package" icon-color="primary" />
          <StatsCard size="sm" title="Tersedia" :value="String(summary.available)" :icon="PackageCheck" icon-color="success" />
          <StatsCard size="sm" title="Maintenance Terlewat" :value="String(summary.overdueMaintenance)" :icon="Wrench" :icon-color="summary.overdueMaintenance ? 'destructive' : 'success'" />
        </div>
        <StatsCard title="Nilai Aset" :value="formatCurrencyIdr(summary.totalValueIdr)" :icon="Package" />
      </div>

      <div class="hidden sm:grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Total Aset" :value="String(summary.total)" :icon="Package" icon-color="primary" />
        <StatsCard title="Tersedia" :value="String(summary.available)" :icon="PackageCheck" icon-color="success" />
        <StatsCard title="Maintenance Terlewat" :value="String(summary.overdueMaintenance)" :icon="Wrench" :icon-color="summary.overdueMaintenance ? 'destructive' : 'success'" />
        <StatsCard title="Nilai Aset" :value="formatCurrencyIdr(summary.totalValueIdr)" :icon="Package" />
      </div>

      <SectionCard
        v-if="overdueMaintenance.length || overdueCheckouts.length"
        compact
        accent
        tone="destructive"
        class="border-destructive/30 bg-destructive/[0.04]"
      >
        <template #header>
          <div class="flex items-start gap-2.5">
            <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-destructive text-destructive-foreground">
              <AlertTriangle class="h-4 w-4" />
            </div>
            <div class="min-w-0">
              <CardTitle class="text-sm font-bold normal-case tracking-normal text-destructive">
                Butuh Perhatian Segera
              </CardTitle>
              <CardDescription class="mt-0.5 text-xs text-destructive/80">
                {{ [
                  overdueMaintenance.length ? `${overdueMaintenance.length} jadwal maintenance terlewat` : '',
                  overdueCheckouts.length ? `${overdueCheckouts.length} aset belum dikembalikan` : ''
                ].filter(Boolean).join(' · ') }}
              </CardDescription>
            </div>
          </div>
        </template>

        <ul class="divide-y divide-destructive/15">
          <li v-for="schedule in overdueMaintenance" :key="`m-${schedule.id}`">
            <button
              type="button"
              class="-mx-1.5 flex w-full items-center justify-between gap-3 rounded-md px-1.5 py-2.5 text-left transition-colors hover:bg-destructive/10"
              @click="activeTab = 'maintenance'"
            >
              <div class="flex min-w-0 items-center gap-2.5">
                <div class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                  <Wrench class="h-3.5 w-3.5" />
                </div>
                <div class="min-w-0">
                  <p class="truncate text-sm font-medium text-foreground">
                    {{ getAssetById(schedule.assetId)?.name ?? schedule.assetId }}
                  </p>
                  <p class="truncate text-xs text-muted-foreground">
                    Maintenance dijadwalkan {{ formatDate(schedule.scheduledAt) }}
                  </p>
                </div>
              </div>
              <div class="flex shrink-0 items-center gap-2">
                <span class="rounded-full bg-destructive px-2 py-0.5 text-xs font-semibold text-destructive-foreground">{{ overdueDays(schedule.scheduledAt) }} hari terlambat</span>
                <ChevronRight class="h-4 w-4 text-destructive/40" />
              </div>
            </button>
          </li>
          <li v-for="checkout in overdueCheckouts" :key="`c-${checkout.id}`">
            <button
              type="button"
              class="-mx-1.5 flex w-full items-center justify-between gap-3 rounded-md px-1.5 py-2.5 text-left transition-colors hover:bg-destructive/10"
              @click="activeTab = 'checkouts'"
            >
              <div class="flex min-w-0 items-center gap-2.5">
                <div class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                  <Undo2 class="h-3.5 w-3.5" />
                </div>
                <div class="min-w-0">
                  <p class="truncate text-sm font-medium text-foreground">
                    {{ getAssetById(checkout.assetId)?.name ?? checkout.assetId }}
                  </p>
                  <p class="truncate text-xs text-muted-foreground">
                    Dipinjam {{ getUserById(checkout.borrowedBy)?.name ?? checkout.borrowedBy }}<template v-if="checkout.projectId"> · {{ getProjectById(checkout.projectId)?.name }}</template>
                  </p>
                </div>
              </div>
              <div class="flex shrink-0 items-center gap-2">
                <span class="rounded-full bg-destructive px-2 py-0.5 text-xs font-semibold text-destructive-foreground">{{ overdueDays(checkout.dueAt) }} hari terlambat</span>
                <ChevronRight class="h-4 w-4 text-destructive/40" />
              </div>
            </button>
          </li>
        </ul>
      </SectionCard>

      <Tabs v-model="activeTab">
        <TabsList>
          <TabsTrigger value="assets">
            Daftar Aset
          </TabsTrigger>
          <TabsTrigger value="maintenance">
            Maintenance Schedule
          </TabsTrigger>
          <TabsTrigger value="checkouts">
            Peminjaman
          </TabsTrigger>
          <TabsTrigger value="utilization">
            Utilisasi
          </TabsTrigger>
        </TabsList>

        <TabsContent value="assets" class="pt-4 space-y-4">
          <div class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
            <button
              v-for="entry in categoryCounts"
              :key="entry.category.value"
              type="button"
              :class="cn(
                'rounded-lg border px-3 py-2.5 text-left transition-colors',
                categoryFilter === entry.category.value ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
              )"
              @click="categoryFilter = categoryFilter === entry.category.value ? 'all' : entry.category.value"
            >
              <p class="text-xs text-muted-foreground">
                {{ entry.category.label }}
              </p>
              <p class="mt-0.5 text-sm font-semibold tabular-nums text-foreground">
                {{ entry.count }} unit
              </p>
              <p class="text-xs tabular-nums text-muted-foreground">
                {{ formatCurrencyIdr(entry.valueIdr) }}
              </p>
            </button>
          </div>

          <SectionCard compact content-class="p-0" titleClass="text-sm font-bold normal-case tracking-normal text-foreground" title="Daftar Aset" :description="`${filteredAssets.length} dari ${ASSETS.length} aset`">
            <template #actions>
              <div class="relative w-full shrink-0 sm:w-64">
                <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input v-model="searchQuery" placeholder="Cari nama, kode, atau merek..." class="pl-9" />
              </div>
            </template>

            <ResponsiveDataView v-if="filteredAssets.length" :items="filteredAssets" :get-key="asset => asset.id">
              <template #desktop="{ items }">
                <div class="overflow-x-auto border-t border-border">
                  <Table class="w-full min-w-[780px]">
                    <TableHeader>
                      <TableRow class="bg-muted/40 hover:bg-muted/40">
                        <TableHead class="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Aset
                        </TableHead>
                        <TableHead class="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Kategori
                        </TableHead>
                        <TableHead class="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Lokasi
                        </TableHead>
                        <TableHead class="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Kondisi
                        </TableHead>
                        <TableHead class="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Stok
                        </TableHead>
                        <TableHead class="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Aksi
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow v-for="asset in items" :key="asset.id">
                        <TableCell class="px-4 py-3">
                          <p class="text-sm font-medium text-foreground">
                            {{ asset.name }}
                          </p>
                          <p class="font-mono text-xs text-muted-foreground">
                            {{ asset.code }}<template v-if="asset.serialNumber"> · {{ asset.serialNumber }}</template>
                          </p>
                          <p v-if="asset.note" class="mt-0.5 text-xs italic text-muted-foreground">
                            {{ asset.note }}
                          </p>
                        </TableCell>
                        <TableCell class="px-4 py-3">
                          <StatusBadge
                            :label="findStatusOption(ASSET_CATEGORIES, asset.category).label"
                            :tone="findStatusOption(ASSET_CATEGORIES, asset.category).tone"
                          />
                        </TableCell>
                        <TableCell class="px-4 py-3 text-sm text-muted-foreground">
                          {{ asset.location }}
                        </TableCell>
                        <TableCell class="px-4 py-3">
                          <StatusBadge
                            :label="findStatusOption(ASSET_CONDITIONS, asset.condition).label"
                            :tone="findStatusOption(ASSET_CONDITIONS, asset.condition).tone"
                          />
                        </TableCell>
                        <TableCell class="px-4 py-3">
                          <span
                            :class="cn(
                              'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold font-mono',
                              getAssetQuantityInUse(asset) === 0
                                ? 'bg-success/10 text-success'
                                : getAssetQuantityInUse(asset) >= asset.quantity
                                  ? 'bg-destructive/10 text-destructive'
                                  : 'bg-warning/10 text-warning'
                            )"
                            :title="`Dipakai ${getAssetQuantityInUse(asset)} dari stok ${asset.quantity}`"
                          >
                            {{ getAssetQuantityInUse(asset) }}/{{ asset.quantity }}
                          </span>
                        </TableCell>
                        <TableCell class="space-x-1.5 whitespace-nowrap px-4 py-3 text-right">
                          <Button variant="outline" size="sm" @click="detailAssetId = asset.id">
                            <Eye class="h-3.5 w-3.5 mr-1" />
                            Detail
                          </Button>
                          <Button v-if="canManage" variant="outline" size="sm" @click="openEdit(asset)">
                            <Pencil class="h-3.5 w-3.5 mr-1" />
                            Edit
                          </Button>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </template>

              <template #mobile-card="{ item: asset }">
                <div class="rounded-xl border border-border bg-card p-4">
                  <div class="flex items-start justify-between gap-2">
                    <div class="min-w-0">
                      <p class="text-sm font-medium text-foreground truncate">
                        {{ asset.name }}
                      </p>
                      <p class="font-mono text-xs text-muted-foreground">
                        {{ asset.code }}<template v-if="asset.serialNumber"> · {{ asset.serialNumber }}</template>
                      </p>
                    </div>
                    <StatusBadge
                      :label="findStatusOption(ASSET_CATEGORIES, asset.category).label"
                      :tone="findStatusOption(ASSET_CATEGORIES, asset.category).tone"
                    />
                  </div>
                  <div class="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p class="text-muted-foreground">
                        Lokasi
                      </p>
                      <p class="text-foreground">
                        {{ asset.location }}
                      </p>
                    </div>
                    <div>
                      <p class="text-muted-foreground">
                        Kondisi
                      </p>
                      <StatusBadge
                        :label="findStatusOption(ASSET_CONDITIONS, asset.condition).label"
                        :tone="findStatusOption(ASSET_CONDITIONS, asset.condition).tone"
                      />
                    </div>
                    <div>
                      <p class="text-muted-foreground">
                        Stok
                      </p>
                      <span
                        :class="cn(
                          'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold font-mono',
                          getAssetQuantityInUse(asset) === 0
                            ? 'bg-success/10 text-success'
                            : getAssetQuantityInUse(asset) >= asset.quantity
                              ? 'bg-destructive/10 text-destructive'
                              : 'bg-warning/10 text-warning'
                        )"
                      >
                        {{ getAssetQuantityInUse(asset) }}/{{ asset.quantity }}
                      </span>
                    </div>
                  </div>
                  <p v-if="asset.note" class="mt-2 text-xs italic text-muted-foreground">
                    {{ asset.note }}
                  </p>
                  <div class="mt-3 flex items-center gap-1.5">
                    <Button variant="outline" size="sm" @click="detailAssetId = asset.id">
                      <Eye class="h-3.5 w-3.5 mr-1" />
                      Detail
                    </Button>
                    <Button v-if="canManage" variant="outline" size="sm" @click="openEdit(asset)">
                      <Pencil class="h-3.5 w-3.5 mr-1" />
                      Edit
                    </Button>
                  </div>
                </div>
              </template>
            </ResponsiveDataView>
            <EmptyState v-else :icon="Package" title="Aset tidak ditemukan" description="Ubah kata kunci atau filter kategori." />
          </SectionCard>
        </TabsContent>

        <TabsContent value="maintenance" class="pt-4">
          <SectionCard
            compact
            content-class="p-0"
            titleClass="text-sm font-bold normal-case tracking-normal text-foreground"
            title="Maintenance Schedule"
            :description="upcomingMaintenance.length ? `${upcomingMaintenance.length} maintenance dalam 30 hari ke depan — terdekat ${getAssetById(upcomingMaintenance[0].assetId)?.name} pada ${formatDate(upcomingMaintenance[0].scheduledAt)}.` : undefined"
          >
            <ResponsiveDataView :items="allMaintenance" :get-key="schedule => schedule.id">
              <template #desktop="{ items }">
                <div class="overflow-x-auto border-t border-border">
                  <Table class="w-full min-w-[860px]">
                    <TableHeader>
                      <TableRow class="bg-muted/40 hover:bg-muted/40">
                        <TableHead class="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Aset
                        </TableHead>
                        <TableHead class="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Jenis
                        </TableHead>
                        <TableHead class="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Jadwal
                        </TableHead>
                        <TableHead class="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Vendor
                        </TableHead>
                        <TableHead class="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Biaya
                        </TableHead>
                        <TableHead class="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Status
                        </TableHead>
                        <TableHead v-if="canManage" class="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Aksi
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow v-for="schedule in items" :key="schedule.id">
                        <TableCell class="px-4 py-3">
                          <p class="text-sm font-medium text-foreground">
                            {{ getAssetById(schedule.assetId)?.name ?? schedule.assetId }}
                          </p>
                          <p v-if="schedule.note" class="text-xs text-muted-foreground">
                            {{ schedule.note }}
                          </p>
                        </TableCell>
                        <TableCell class="px-4 py-3">
                          <StatusBadge
                            :label="findStatusOption(MAINTENANCE_TYPES, schedule.type).label"
                            :tone="findStatusOption(MAINTENANCE_TYPES, schedule.type).tone"
                          />
                        </TableCell>
                        <TableCell class="px-4 py-3">
                          <p class="text-sm text-foreground">
                            {{ formatDate(schedule.scheduledAt) }}
                          </p>
                          <p v-if="schedule.intervalDays" class="text-xs text-muted-foreground">
                            berulang tiap {{ schedule.intervalDays }} hari
                          </p>
                        </TableCell>
                        <TableCell class="px-4 py-3 text-sm text-muted-foreground">
                          {{ schedule.vendorName ?? 'Internal' }}
                        </TableCell>
                        <TableCell class="px-4 py-3 text-right text-sm tabular-nums text-foreground">
                          {{ schedule.costIdr ? formatCurrencyIdr(schedule.costIdr) : '—' }}
                        </TableCell>
                        <TableCell class="px-4 py-3">
                          <StatusBadge
                            :label="findStatusOption(MAINTENANCE_STATUSES, schedule.status).label"
                            :tone="findStatusOption(MAINTENANCE_STATUSES, schedule.status).tone"
                          />
                        </TableCell>
                        <TableCell v-if="canManage" class="px-4 py-3 text-right">
                          <Button v-if="schedule.status !== 'completed'" variant="outline" size="sm" @click="onCompleteMaintenance(schedule.id)">
                            Tandai Selesai
                          </Button>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </template>

              <template #mobile-card="{ item: schedule }">
                <div class="rounded-xl border border-border bg-card p-4">
                  <div class="flex items-start justify-between gap-2">
                    <div class="min-w-0">
                      <p class="text-sm font-medium text-foreground truncate">
                        {{ getAssetById(schedule.assetId)?.name ?? schedule.assetId }}
                      </p>
                      <p v-if="schedule.note" class="text-xs text-muted-foreground">
                        {{ schedule.note }}
                      </p>
                    </div>
                    <StatusBadge
                      :label="findStatusOption(MAINTENANCE_STATUSES, schedule.status).label"
                      :tone="findStatusOption(MAINTENANCE_STATUSES, schedule.status).tone"
                    />
                  </div>
                  <div class="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p class="text-muted-foreground">
                        Jenis
                      </p>
                      <StatusBadge
                        :label="findStatusOption(MAINTENANCE_TYPES, schedule.type).label"
                        :tone="findStatusOption(MAINTENANCE_TYPES, schedule.type).tone"
                      />
                    </div>
                    <div>
                      <p class="text-muted-foreground">
                        Vendor
                      </p>
                      <p class="text-foreground">
                        {{ schedule.vendorName ?? 'Internal' }}
                      </p>
                    </div>
                    <div>
                      <p class="text-muted-foreground">
                        Jadwal
                      </p>
                      <p class="text-foreground">
                        {{ formatDate(schedule.scheduledAt) }}
                        <span v-if="schedule.intervalDays" class="block text-muted-foreground">berulang tiap {{ schedule.intervalDays }} hari</span>
                      </p>
                    </div>
                    <div>
                      <p class="text-muted-foreground">
                        Biaya
                      </p>
                      <p class="text-foreground">
                        {{ schedule.costIdr ? formatCurrencyIdr(schedule.costIdr) : '—' }}
                      </p>
                    </div>
                  </div>
                  <div v-if="canManage && schedule.status !== 'completed'" class="mt-3">
                    <Button variant="outline" size="sm" @click="onCompleteMaintenance(schedule.id)">
                      Tandai Selesai
                    </Button>
                  </div>
                </div>
              </template>
            </ResponsiveDataView>
          </SectionCard>
        </TabsContent>

        <TabsContent value="checkouts" class="pt-4">
          <SectionCard compact :content-class="activeCheckouts.length ? 'p-0' : ''" titleClass="text-sm font-bold normal-case tracking-normal text-foreground" title="Peminjaman" description="Peminjaman yang belum kembali. Aset yang tertaut project menahan penutupan project tersebut sampai dikembalikan.">
            <ResponsiveDataView v-if="activeCheckouts.length" :items="activeCheckouts" :get-key="checkout => checkout.id">
              <template #desktop="{ items }">
                <div class="overflow-x-auto border-t border-border">
                  <Table class="w-full min-w-[780px]">
                    <TableHeader>
                      <TableRow class="bg-muted/40 hover:bg-muted/40">
                        <TableHead class="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Aset
                        </TableHead>
                        <TableHead class="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Peminjam
                        </TableHead>
                        <TableHead class="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Project
                        </TableHead>
                        <TableHead class="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Dipinjam
                        </TableHead>
                        <TableHead class="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Jatuh Tempo
                        </TableHead>
                        <TableHead class="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Status
                        </TableHead>
                        <TableHead v-if="canManage" class="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Aksi
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow v-for="checkout in items" :key="checkout.id">
                        <TableCell class="px-4 py-3 text-sm font-medium text-foreground">
                          {{ getAssetById(checkout.assetId)?.name ?? checkout.assetId }}
                        </TableCell>
                        <TableCell class="px-4 py-3 text-sm text-foreground">
                          {{ getUserById(checkout.borrowedBy)?.name ?? checkout.borrowedBy }}
                        </TableCell>
                        <TableCell class="px-4 py-3">
                          <NuxtLink v-if="checkout.projectId" :to="`/project-orders/${checkout.projectId}`" class="text-sm text-primary hover:underline">
                            {{ getProjectById(checkout.projectId)?.name ?? checkout.projectId }}
                          </NuxtLink>
                          <span v-else class="text-sm text-muted-foreground">Internal</span>
                        </TableCell>
                        <TableCell class="px-4 py-3 text-sm text-muted-foreground">
                          {{ formatDate(checkout.checkedOutAt) }}
                        </TableCell>
                        <TableCell class="px-4 py-3 text-sm" :class="checkout.status === 'overdue' ? 'text-destructive font-medium' : 'text-muted-foreground'">
                          {{ formatDate(checkout.dueAt) }}
                        </TableCell>
                        <TableCell class="px-4 py-3">
                          <StatusBadge
                            :label="findStatusOption(CHECKOUT_STATUSES, checkout.status).label"
                            :tone="findStatusOption(CHECKOUT_STATUSES, checkout.status).tone"
                          />
                        </TableCell>
                        <TableCell v-if="canManage" class="px-4 py-3 text-right">
                          <Button variant="outline" size="sm" @click="returnTargetId = checkout.id">
                            <Undo2 class="h-3.5 w-3.5 mr-1" />
                            Kembalikan
                          </Button>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </template>

              <template #mobile-card="{ item: checkout }">
                <div class="rounded-xl border border-border bg-card p-4">
                  <div class="flex items-start justify-between gap-2">
                    <p class="text-sm font-medium text-foreground truncate">
                      {{ getAssetById(checkout.assetId)?.name ?? checkout.assetId }}
                    </p>
                    <StatusBadge
                      :label="findStatusOption(CHECKOUT_STATUSES, checkout.status).label"
                      :tone="findStatusOption(CHECKOUT_STATUSES, checkout.status).tone"
                    />
                  </div>
                  <div class="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p class="text-muted-foreground">
                        Peminjam
                      </p>
                      <p class="text-foreground">
                        {{ getUserById(checkout.borrowedBy)?.name ?? checkout.borrowedBy }}
                      </p>
                    </div>
                    <div>
                      <p class="text-muted-foreground">
                        Project
                      </p>
                      <NuxtLink v-if="checkout.projectId" :to="`/project-orders/${checkout.projectId}`" class="text-primary hover:underline">
                        {{ getProjectById(checkout.projectId)?.name ?? checkout.projectId }}
                      </NuxtLink>
                      <p v-else class="text-foreground">
                        Internal
                      </p>
                    </div>
                    <div>
                      <p class="text-muted-foreground">
                        Dipinjam
                      </p>
                      <p class="text-foreground">
                        {{ formatDate(checkout.checkedOutAt) }}
                      </p>
                    </div>
                    <div>
                      <p class="text-muted-foreground">
                        Jatuh Tempo
                      </p>
                      <p :class="checkout.status === 'overdue' ? 'text-destructive font-medium' : 'text-foreground'">
                        {{ formatDate(checkout.dueAt) }}
                      </p>
                    </div>
                  </div>
                  <div v-if="canManage" class="mt-3">
                    <Button variant="outline" size="sm" @click="returnTargetId = checkout.id">
                      <Undo2 class="h-3.5 w-3.5 mr-1" />
                      Kembalikan
                    </Button>
                  </div>
                </div>
              </template>
            </ResponsiveDataView>
            <EmptyState v-else :icon="PackageCheck" title="Semua aset sudah kembali" />
          </SectionCard>
        </TabsContent>

        <TabsContent value="utilization" class="pt-4">
          <SectionCard compact titleClass="text-sm font-bold normal-case tracking-normal text-foreground" title="Utilisasi" description="Berapa lama tiap aset benar-benar terpakai dalam 90 hari terakhir — dasar keputusan menambah atau melepas aset.">
            <ul class="divide-y divide-border">
              <li v-for="row in utilization" :key="row.assetId" class="flex items-center gap-3 py-2">
                <span class="w-20 shrink-0 truncate text-sm text-foreground sm:w-56" :title="row.assetName">{{ row.assetName }}</span>
                <span class="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <span
                    :class="cn('block h-full rounded-full', row.utilizationPercent >= 60 ? 'bg-success' : row.utilizationPercent >= 25 ? 'bg-warning' : 'bg-destructive')"
                    :style="{ width: `${row.utilizationPercent}%` }"
                  />
                </span>
                <span class="w-14 shrink-0 text-right text-sm font-medium tabular-nums text-foreground">{{ row.utilizationPercent }}%</span>
                <span class="hidden w-28 shrink-0 text-right text-xs tabular-nums text-muted-foreground sm:block">{{ row.checkoutCount }}× dipinjam</span>
              </li>
            </ul>
          </SectionCard>
        </TabsContent>
      </Tabs>

      <ResponsiveFormSheet
        v-model:open="isAssetFormOpen"
        :title="assetFormMode === 'edit' ? 'Edit Aset' : 'Tambah Aset Baru'"
        :description="assetFormMode === 'edit' ? 'Perbarui detail aset. Kode aset tidak berubah.' : 'Aset baru langsung masuk ke daftar aset milik MANOVA.'"
        content-class="max-w-md"
      >
          <div class="space-y-3">
            <div class="space-y-1.5">
              <Label>Nama Aset</Label>
              <Input v-model="assetForm.name" placeholder="mis. Sony A7 IV Body" />
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div class="space-y-1.5">
                <Label>Kategori</Label>
                <select v-model="assetForm.category" :disabled="assetFormMode === 'edit'" class="w-full disabled:opacity-60 appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                  <option v-for="category in ASSET_CATEGORIES" :key="category.value" :value="category.value">
                    {{ category.label }}
                  </option>
                </select>
              </div>
              <div class="space-y-1.5">
                <Label>Lokasi</Label>
                <Input v-model="assetForm.location" placeholder="mis. Gudang Jakarta" />
              </div>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div class="space-y-1.5">
                <Label>Brand (opsional)</Label>
                <Input v-model="assetForm.brand" placeholder="mis. Sony" />
              </div>
              <div class="space-y-1.5">
                <Label>Serial Number (opsional)</Label>
                <Input v-model="assetForm.serialNumber" placeholder="mis. SN-A7IV-88213" />
              </div>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div class="space-y-1.5">
                <Label>Tanggal Pembelian</Label>
                <Input v-model="assetForm.purchasedAt" type="date" />
              </div>
              <div class="space-y-1.5">
                <Label>Stok (Jumlah Unit)</Label>
                <Input v-model.number="assetForm.quantity" type="number" min="1" placeholder="1" />
              </div>
            </div>
            <div class="space-y-1.5">
              <Label>Nilai Perolehan (IDR) — Opsional</Label>
              <CurrencyInput v-model="assetForm.purchasePriceIdr" placeholder="Belum diisi" />
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div class="space-y-1.5">
                <Label>Kondisi</Label>
                <select v-model="assetForm.condition" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                  <option v-for="condition in ASSET_CONDITIONS" :key="condition.value" :value="condition.value">
                    {{ condition.label }}
                  </option>
                </select>
              </div>
              <div class="space-y-1.5">
                <Label>Status</Label>
                <select v-model="assetForm.status" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                  <option v-for="status in ASSET_STATUSES" :key="status.value" :value="status.value" :disabled="status.value === 'in-use'">
                    {{ status.label }}
                  </option>
                </select>
              </div>
            </div>
            <div class="space-y-1.5">
              <Label>Catatan (opsional)</Label>
              <Input v-model="assetForm.note" placeholder="Catatan tambahan" />
            </div>
          </div>

          <template #footer>
            <Button variant="outline" @click="isAssetFormOpen = false">
              Batal
            </Button>
            <Button :disabled="!isAssetFormValid || isSaving" @click="submitAssetForm">
              Simpan
            </Button>
          </template>
      </ResponsiveFormSheet>

      <!-- Dialog -> ResponsiveFormSheet: sheet bottom di mobile biar berasa native app, desktop tetap Dialog persis sama -->
      <ResponsiveFormSheet
        :open="Boolean(detailAsset)"
        @update:open="value => { if (!value) detailAssetId = undefined }"
        :title="detailAsset?.name ?? ''"
        :description="detailAsset ? `${detailAsset.code}${detailAsset.serialNumber ? ' · ' + detailAsset.serialNumber : ''}` : undefined"
        content-class="max-w-md"
      >
        <div v-if="detailAsset" class="space-y-3 text-sm">
            <div class="grid grid-cols-2 gap-3">
              <div>
                <p class="text-xs text-muted-foreground">
                  Kategori
                </p>
                <StatusBadge
                  class="mt-1"
                  :label="findStatusOption(ASSET_CATEGORIES, detailAsset.category).label"
                  :tone="findStatusOption(ASSET_CATEGORIES, detailAsset.category).tone"
                />
              </div>
              <div>
                <p class="text-xs text-muted-foreground">
                  Status
                </p>
                <StatusBadge
                  class="mt-1"
                  :label="findStatusOption(ASSET_STATUSES, detailAsset.status).label"
                  :tone="findStatusOption(ASSET_STATUSES, detailAsset.status).tone"
                />
              </div>
              <div>
                <p class="text-xs text-muted-foreground">
                  Brand
                </p>
                <p class="text-foreground mt-0.5">
                  {{ detailAsset.brand ?? '—' }}
                </p>
              </div>
              <div>
                <p class="text-xs text-muted-foreground">
                  Lokasi
                </p>
                <p class="text-foreground mt-0.5">
                  {{ detailAsset.location }}
                </p>
              </div>
              <div>
                <p class="text-xs text-muted-foreground">
                  Tanggal Pembelian
                </p>
                <p class="text-foreground mt-0.5">
                  {{ formatDate(detailAsset.purchasedAt) }}
                </p>
              </div>
              <div>
                <p class="text-xs text-muted-foreground">
                  Nilai Perolehan
                </p>
                <p class="text-foreground mt-0.5">
                  {{ detailAsset.purchasePriceIdr ? formatCurrencyIdr(detailAsset.purchasePriceIdr) : 'Belum diisi' }}
                </p>
              </div>
              <div>
                <p class="text-xs text-muted-foreground">
                  Kondisi
                </p>
                <StatusBadge
                  class="mt-1"
                  :label="findStatusOption(ASSET_CONDITIONS, detailAsset.condition).label"
                  :tone="findStatusOption(ASSET_CONDITIONS, detailAsset.condition).tone"
                />
              </div>
              <div>
                <p class="text-xs text-muted-foreground">
                  Stok
                </p>
                <p class="text-foreground mt-0.5 font-mono">
                  {{ getAssetQuantityInUse(detailAsset) }} dipakai dari {{ detailAsset.quantity }} unit
                </p>
              </div>
            </div>
            <div v-if="detailAsset.note">
              <p class="text-xs text-muted-foreground">
                Catatan
              </p>
              <p class="text-foreground mt-0.5">
                {{ detailAsset.note }}
              </p>
            </div>
        </div>

        <template #footer>
          <Button variant="outline" @click="detailAssetId = undefined">
            Tutup
          </Button>
          <Button v-if="detailAsset && canManage" @click="openEdit(detailAsset); detailAssetId = undefined">
            <Pencil class="h-3.5 w-3.5 mr-1" />
            Edit Aset
          </Button>
        </template>
      </ResponsiveFormSheet>

      <ResponsiveFormSheet
        :open="Boolean(returnTargetId)"
        @update:open="value => { if (!value) returnTargetId = undefined }"
        title="Kembalikan Aset"
        description="Catat kondisi aset saat kembali. Aset yang rusak otomatis masuk antrean maintenance, bukan langsung tersedia kembali."
        content-class="max-w-sm"
      >
          <div class="space-y-1.5">
            <Label>Kondisi saat Kembali</Label>
            <select v-model="returnCondition" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
              <option v-for="condition in ASSET_CONDITIONS" :key="condition.value" :value="condition.value">
                {{ condition.label }}
              </option>
            </select>
          </div>

          <template #footer>
            <Button variant="outline" @click="returnTargetId = undefined">
              Batal
            </Button>
            <Button :disabled="isSaving" @click="submitReturn">
              Konfirmasi Pengembalian
            </Button>
          </template>
      </ResponsiveFormSheet>

      <ResponsiveFormSheet
        :open="isLendOpen"
        title="Pinjamkan Aset"
        description="Aset yang dipinjam ke sebuah project harus kembali sebelum project itu bisa ditutup."
        content-class="max-w-md"
        @update:open="value => { isLendOpen = value }"
      >
        <div class="space-y-3">
          <div class="space-y-1.5">
            <Label>Aset</Label>
            <select v-model="lendForm.assetId" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
              <option value="" disabled>
                Pilih aset yang tersedia
              </option>
              <option v-for="asset in lendableAssets" :key="asset.id" :value="asset.id">
                {{ asset.code }} · {{ asset.name }}
              </option>
            </select>
          </div>
          <div class="space-y-1.5">
            <Label>Project (opsional)</Label>
            <select v-model="lendForm.projectId" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
              <option value="">
                Tanpa project
              </option>
              <option v-for="project in openProjects" :key="project.id" :value="project.id">
                {{ project.id }} · {{ project.name }}
              </option>
            </select>
          </div>
          <div class="space-y-1.5">
            <Label>Tanggal Kembali</Label>
            <Input v-model="lendForm.dueOn" type="date" :min="TODAY" />
          </div>
          <div class="space-y-1.5">
            <Label>Catatan (opsional)</Label>
            <Input v-model="lendForm.note" placeholder="mis. untuk dokumentasi event" />
          </div>
        </div>

        <template #footer>
          <Button variant="outline" @click="isLendOpen = false">
            Batal
          </Button>
          <Button :disabled="!lendForm.assetId || !lendForm.dueOn || isSaving" @click="submitLend">
            Pinjamkan
          </Button>
        </template>
      </ResponsiveFormSheet>

      <ResponsiveFormSheet
        :open="isMaintenanceOpen"
        title="Jadwalkan Maintenance"
        description="Jadwal yang lewat tanggalnya dan belum selesai otomatis tampil sebagai terlambat."
        content-class="max-w-md"
        @update:open="value => { isMaintenanceOpen = value }"
      >
        <div class="space-y-3">
          <div class="space-y-1.5">
            <Label>Aset</Label>
            <select v-model="maintenanceForm.assetId" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
              <option value="" disabled>
                Pilih aset
              </option>
              <option v-for="asset in ASSETS" :key="asset.id" :value="asset.id">
                {{ asset.code }} · {{ asset.name }}
              </option>
            </select>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div class="space-y-1.5">
              <Label>Tipe</Label>
              <select v-model="maintenanceForm.type" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                <option v-for="type in MAINTENANCE_TYPES" :key="type.value" :value="type.value">
                  {{ type.label }}
                </option>
              </select>
            </div>
            <div class="space-y-1.5">
              <Label>Tanggal</Label>
              <Input v-model="maintenanceForm.scheduledOn" type="date" />
            </div>
          </div>
          <div class="space-y-1.5">
            <Label>Vendor / Bengkel (opsional)</Label>
            <Input v-model="maintenanceForm.vendorName" placeholder="mis. Sony Service Center" />
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div class="space-y-1.5">
              <Label>Estimasi Biaya (Rp)</Label>
              <Input v-model.number="maintenanceForm.costIdr" type="number" min="0" />
            </div>
            <div class="space-y-1.5">
              <Label>Ulangi Tiap (hari)</Label>
              <Input v-model.number="maintenanceForm.intervalDays" type="number" min="1" placeholder="kosong = sekali" />
            </div>
          </div>
          <div class="space-y-1.5">
            <Label>Catatan (opsional)</Label>
            <Input v-model="maintenanceForm.note" />
          </div>
        </div>

        <template #footer>
          <Button variant="outline" @click="isMaintenanceOpen = false">
            Batal
          </Button>
          <Button :disabled="!maintenanceForm.assetId || !maintenanceForm.scheduledOn || isSaving" @click="submitMaintenance">
            Jadwalkan
          </Button>
        </template>
      </ResponsiveFormSheet>
    </template>
  </div>
</template>
