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
  getAssetQuantityInUse,
  returnAsset,
  completeMaintenance,
  addAsset,
  updateAsset
} from '~/data/inventory'
import { getUserById, getProjectById } from '~/data'
import { findStatusOption } from '~/constants/status'
import { formatCurrencyIdr, formatDate } from '~/utils/format'
import { DEMO_REFERENCE_DATE } from '~/utils/attention'
import type { Asset, AssetCategoryKey } from '~/types/inventory'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Inventory' })

const { canView, can } = usePermissions()
const { showToast } = useToast()

const hasAccess = computed(() => canView('inventory'))
const canManage = computed(() => can('inventory.manage-asset'))

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

/** Selisih hari dari tanggal acuan demo — dipakai badge "X hari terlambat" di card "Butuh Perhatian Segera". */
function overdueDays (isoDate: string): number {
  return Math.round((new Date(DEMO_REFERENCE_DATE).getTime() - new Date(isoDate).getTime()) / 86400000)
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

function submitAssetForm () {
  if (!isAssetFormValid.value) { return }
  const payload = {
    name: assetForm.value.name.trim(),
    category: assetForm.value.category,
    brand: assetForm.value.brand.trim() || undefined,
    serialNumber: assetForm.value.serialNumber.trim() || undefined,
    location: assetForm.value.location.trim(),
    purchasedAt: assetForm.value.purchasedAt,
    purchasePriceIdr: assetForm.value.purchasePriceIdr ? Number(assetForm.value.purchasePriceIdr) : undefined,
    quantity: Number(assetForm.value.quantity) || 1,
    condition: assetForm.value.condition,
    status: assetForm.value.status,
    note: assetForm.value.note.trim() || undefined
  }

  if (assetFormMode.value === 'edit' && editingAssetId.value) {
    updateAsset(editingAssetId.value, payload)
    refreshKey.value += 1
    isAssetFormOpen.value = false
    showToast('Perubahan disimpan', `"${payload.name}" diperbarui.`, 'success')
    return
  }

  addAsset(payload)
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

function submitReturn () {
  if (!returnTargetId.value) { return }
  returnAsset(returnTargetId.value, returnCondition.value)
  refreshKey.value += 1
  returnTargetId.value = undefined
  showToast('Aset dikembalikan', 'Status aset diperbarui sesuai kondisi saat kembali.', 'success')
}

function onCompleteMaintenance (maintenanceId: string) {
  completeMaintenance(maintenanceId)
  refreshKey.value += 1
  showToast('Maintenance selesai', 'Aset kembali berstatus tersedia.', 'success')
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
        <Button size="sm" @click="openCreate">
          <Plus class="h-4 w-4 mr-1.5" />
          Tambah Aset
        </Button>
      </template>
    </PageHeader>

    <RoleAccessState v-if="!hasAccess" module-label="modul Inventory" />

    <template v-else>
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
              <div class="relative w-48 shrink-0 sm:w-64">
                <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input v-model="searchQuery" placeholder="Cari nama, kode, atau merek..." class="pl-9" />
              </div>
            </template>

            <div v-if="filteredAssets.length" class="overflow-x-auto border-t border-border">
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
                  <TableRow v-for="asset in filteredAssets" :key="asset.id">
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
                  <TableRow v-for="schedule in allMaintenance" :key="schedule.id">
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
          </SectionCard>
        </TabsContent>

        <TabsContent value="checkouts" class="pt-4">
          <SectionCard compact :content-class="activeCheckouts.length ? 'p-0' : ''" titleClass="text-sm font-bold normal-case tracking-normal text-foreground" title="Peminjaman" description="Peminjaman yang belum kembali. Aset yang tertaut project menahan penutupan project tersebut sampai dikembalikan.">
            <div v-if="activeCheckouts.length" class="overflow-x-auto border-t border-border">
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
                  <TableRow v-for="checkout in activeCheckouts" :key="checkout.id">
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
            <EmptyState v-else :icon="PackageCheck" title="Semua aset sudah kembali" />
          </SectionCard>
        </TabsContent>

        <TabsContent value="utilization" class="pt-4">
          <SectionCard compact titleClass="text-sm font-bold normal-case tracking-normal text-foreground" title="Utilisasi" description="Berapa lama tiap aset benar-benar terpakai dalam 90 hari terakhir — dasar keputusan menambah atau melepas aset.">
            <ul class="divide-y divide-border">
              <li v-for="row in utilization" :key="row.assetId" class="flex items-center gap-3 py-2">
                <span class="w-40 shrink-0 truncate text-sm text-foreground sm:w-56" :title="row.assetName">{{ row.assetName }}</span>
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

      <Dialog v-model:open="isAssetFormOpen">
        <DialogContent class="max-w-md">
          <DialogHeader>
            <DialogTitle>{{ assetFormMode === 'edit' ? 'Edit Aset' : 'Tambah Aset Baru' }}</DialogTitle>
            <DialogDescription>
              {{ assetFormMode === 'edit' ? 'Perbarui detail aset. Kode aset tidak berubah.' : 'Aset baru langsung masuk ke daftar aset milik MANOVA.' }}
            </DialogDescription>
          </DialogHeader>

          <div class="space-y-3">
            <div class="space-y-1.5">
              <Label>Nama Aset</Label>
              <Input v-model="assetForm.name" placeholder="mis. Sony A7 IV Body" />
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div class="space-y-1.5">
                <Label>Kategori</Label>
                <select v-model="assetForm.category" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
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
            <div class="grid grid-cols-2 gap-3">
              <div class="space-y-1.5">
                <Label>Brand (opsional)</Label>
                <Input v-model="assetForm.brand" placeholder="mis. Sony" />
              </div>
              <div class="space-y-1.5">
                <Label>Serial Number (opsional)</Label>
                <Input v-model="assetForm.serialNumber" placeholder="mis. SN-A7IV-88213" />
              </div>
            </div>
            <div class="grid grid-cols-2 gap-3">
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
            <div class="grid grid-cols-2 gap-3">
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
                  <option v-for="status in ASSET_STATUSES" :key="status.value" :value="status.value">
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

          <DialogFooter>
            <Button variant="outline" @click="isAssetFormOpen = false">
              Batal
            </Button>
            <Button :disabled="!isAssetFormValid" @click="submitAssetForm">
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog :open="Boolean(detailAsset)" @update:open="value => { if (!value) detailAssetId = undefined }">
        <DialogContent v-if="detailAsset" class="max-w-md">
          <DialogHeader>
            <DialogTitle>{{ detailAsset.name }}</DialogTitle>
            <DialogDescription>
              {{ detailAsset.code }}<template v-if="detailAsset.serialNumber"> · {{ detailAsset.serialNumber }}</template>
            </DialogDescription>
          </DialogHeader>

          <div class="space-y-3 text-sm">
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

          <DialogFooter>
            <Button variant="outline" @click="detailAssetId = undefined">
              Tutup
            </Button>
            <Button v-if="canManage" @click="openEdit(detailAsset); detailAssetId = undefined">
              <Pencil class="h-3.5 w-3.5 mr-1" />
              Edit Aset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog :open="Boolean(returnTargetId)" @update:open="value => { if (!value) returnTargetId = undefined }">
        <DialogContent class="max-w-sm">
          <DialogHeader>
            <DialogTitle>Kembalikan Aset</DialogTitle>
            <DialogDescription>
              Catat kondisi aset saat kembali. Aset yang rusak otomatis masuk antrean maintenance, bukan
              langsung tersedia kembali.
            </DialogDescription>
          </DialogHeader>

          <div class="space-y-1.5">
            <Label>Kondisi saat Kembali</Label>
            <select v-model="returnCondition" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
              <option v-for="condition in ASSET_CONDITIONS" :key="condition.value" :value="condition.value">
                {{ condition.label }}
              </option>
            </select>
          </div>

          <DialogFooter>
            <Button variant="outline" @click="returnTargetId = undefined">
              Batal
            </Button>
            <Button @click="submitReturn">
              Konfirmasi Pengembalian
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </template>
  </div>
</template>
