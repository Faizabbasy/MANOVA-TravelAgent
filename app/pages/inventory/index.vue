<script setup lang="ts">
import { computed, ref } from 'vue'
import { Package, Wrench, AlertTriangle, PackageCheck, Search, Undo2, Plus, Pencil, Eye } from 'lucide-vue-next'
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

      <div
        v-if="summary.overdueMaintenance || summary.overdueCheckouts"
        class="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 flex gap-2"
      >
        <AlertTriangle class="h-4 w-4 text-destructive shrink-0 mt-0.5" />
        <div>
          <p class="text-sm font-medium text-foreground">
            Butuh perhatian segera
          </p>
          <p class="text-xs text-muted-foreground mt-0.5">
            <template v-if="summary.overdueMaintenance">{{ summary.overdueMaintenance }} jadwal maintenance sudah terlewat. </template>
            <template v-if="summary.overdueCheckouts">{{ summary.overdueCheckouts }} aset belum dikembalikan melewati jatuh tempo.</template>
          </p>
        </div>
      </div>

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
              <p class="text-sm font-semibold text-foreground mt-0.5">
                {{ entry.count }} unit
              </p>
              <p class="text-xs text-muted-foreground">
                {{ formatCurrencyIdr(entry.valueIdr) }}
              </p>
            </button>
          </div>

          <div class="relative max-w-sm">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input v-model="searchQuery" placeholder="Cari nama, kode, atau merek..." class="pl-9" />
          </div>

          <SectionCard>
            <Table v-if="filteredAssets.length">
              <TableHeader>
                <TableRow>
                  <TableHead>Aset</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead>Lokasi</TableHead>
                  <TableHead>Kondisi</TableHead>
                  <TableHead>Stok</TableHead>
                  <TableHead class="text-right">
                    Aksi
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="asset in filteredAssets" :key="asset.id">
                  <TableCell>
                    <p class="text-sm font-medium text-foreground">
                      {{ asset.name }}
                    </p>
                    <p class="text-xs text-muted-foreground font-mono">
                      {{ asset.code }}<template v-if="asset.serialNumber"> · {{ asset.serialNumber }}</template>
                    </p>
                    <p v-if="asset.note" class="text-xs text-muted-foreground italic mt-0.5">
                      {{ asset.note }}
                    </p>
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      :label="findStatusOption(ASSET_CATEGORIES, asset.category).label"
                      :tone="findStatusOption(ASSET_CATEGORIES, asset.category).tone"
                    />
                  </TableCell>
                  <TableCell class="text-sm text-muted-foreground">
                    {{ asset.location }}
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      :label="findStatusOption(ASSET_CONDITIONS, asset.condition).label"
                      :tone="findStatusOption(ASSET_CONDITIONS, asset.condition).tone"
                    />
                  </TableCell>
                  <TableCell>
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
                  <TableCell class="text-right space-x-1.5 whitespace-nowrap">
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
            <EmptyState v-else :icon="Package" title="Aset tidak ditemukan" description="Ubah kata kunci atau filter kategori." />
          </SectionCard>
        </TabsContent>

        <TabsContent value="maintenance" class="pt-4 space-y-4">
          <div v-if="upcomingMaintenance.length" class="rounded-lg border border-border bg-muted/30 px-4 py-3">
            <p class="text-sm font-medium text-foreground">
              {{ upcomingMaintenance.length }} maintenance dalam 30 hari ke depan
            </p>
            <p class="text-xs text-muted-foreground mt-0.5">
              Terdekat: {{ getAssetById(upcomingMaintenance[0].assetId)?.name }} pada {{ formatDate(upcomingMaintenance[0].scheduledAt) }}.
            </p>
          </div>

          <SectionCard>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Aset</TableHead>
                  <TableHead>Jenis</TableHead>
                  <TableHead>Jadwal</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead class="text-right">
                    Biaya
                  </TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead v-if="canManage" class="text-right">
                    Aksi
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="schedule in allMaintenance" :key="schedule.id">
                  <TableCell>
                    <p class="text-sm font-medium text-foreground">
                      {{ getAssetById(schedule.assetId)?.name ?? schedule.assetId }}
                    </p>
                    <p v-if="schedule.note" class="text-xs text-muted-foreground">
                      {{ schedule.note }}
                    </p>
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      :label="findStatusOption(MAINTENANCE_TYPES, schedule.type).label"
                      :tone="findStatusOption(MAINTENANCE_TYPES, schedule.type).tone"
                    />
                  </TableCell>
                  <TableCell>
                    <p class="text-sm text-foreground">
                      {{ formatDate(schedule.scheduledAt) }}
                    </p>
                    <p v-if="schedule.intervalDays" class="text-xs text-muted-foreground">
                      berulang tiap {{ schedule.intervalDays }} hari
                    </p>
                  </TableCell>
                  <TableCell class="text-sm text-muted-foreground">
                    {{ schedule.vendorName ?? 'Internal' }}
                  </TableCell>
                  <TableCell class="text-right text-sm text-foreground">
                    {{ schedule.costIdr ? formatCurrencyIdr(schedule.costIdr) : '—' }}
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      :label="findStatusOption(MAINTENANCE_STATUSES, schedule.status).label"
                      :tone="findStatusOption(MAINTENANCE_STATUSES, schedule.status).tone"
                    />
                  </TableCell>
                  <TableCell v-if="canManage" class="text-right">
                    <Button v-if="schedule.status !== 'completed'" variant="outline" size="sm" @click="onCompleteMaintenance(schedule.id)">
                      Tandai Selesai
                    </Button>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </SectionCard>
        </TabsContent>

        <TabsContent value="checkouts" class="pt-4">
          <SectionCard description="Peminjaman yang belum kembali. Aset yang tertaut project menahan penutupan project tersebut sampai dikembalikan.">
            <Table v-if="activeCheckouts.length">
              <TableHeader>
                <TableRow>
                  <TableHead>Aset</TableHead>
                  <TableHead>Peminjam</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Dipinjam</TableHead>
                  <TableHead>Jatuh Tempo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead v-if="canManage" class="text-right">
                    Aksi
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="checkout in activeCheckouts" :key="checkout.id">
                  <TableCell class="text-sm font-medium text-foreground">
                    {{ getAssetById(checkout.assetId)?.name ?? checkout.assetId }}
                  </TableCell>
                  <TableCell class="text-sm text-foreground">
                    {{ getUserById(checkout.borrowedBy)?.name ?? checkout.borrowedBy }}
                  </TableCell>
                  <TableCell>
                    <NuxtLink v-if="checkout.projectId" :to="`/project-orders/${checkout.projectId}`" class="text-sm text-primary hover:underline">
                      {{ getProjectById(checkout.projectId)?.name ?? checkout.projectId }}
                    </NuxtLink>
                    <span v-else class="text-sm text-muted-foreground">Internal</span>
                  </TableCell>
                  <TableCell class="text-sm text-muted-foreground">
                    {{ formatDate(checkout.checkedOutAt) }}
                  </TableCell>
                  <TableCell class="text-sm" :class="checkout.status === 'overdue' ? 'text-destructive font-medium' : 'text-muted-foreground'">
                    {{ formatDate(checkout.dueAt) }}
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      :label="findStatusOption(CHECKOUT_STATUSES, checkout.status).label"
                      :tone="findStatusOption(CHECKOUT_STATUSES, checkout.status).tone"
                    />
                  </TableCell>
                  <TableCell v-if="canManage" class="text-right">
                    <Button variant="outline" size="sm" @click="returnTargetId = checkout.id">
                      <Undo2 class="h-3.5 w-3.5 mr-1" />
                      Kembalikan
                    </Button>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
            <EmptyState v-else :icon="PackageCheck" title="Semua aset sudah kembali" />
          </SectionCard>
        </TabsContent>

        <TabsContent value="utilization" class="pt-4">
          <SectionCard description="Berapa lama tiap aset benar-benar terpakai dalam 90 hari terakhir — dasar keputusan menambah atau melepas aset.">
            <ul class="space-y-2.5">
              <li v-for="row in utilization" :key="row.assetId" class="flex items-center gap-3">
                <span class="w-56 shrink-0 text-sm text-foreground truncate" :title="row.assetName">{{ row.assetName }}</span>
                <span class="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                  <span
                    :class="cn('block h-full rounded-full', row.utilizationPercent >= 60 ? 'bg-success' : row.utilizationPercent >= 25 ? 'bg-warning' : 'bg-destructive')"
                    :style="{ width: `${row.utilizationPercent}%` }"
                  />
                </span>
                <span class="w-14 shrink-0 text-right text-sm font-medium text-foreground">{{ row.utilizationPercent }}%</span>
                <span class="w-28 shrink-0 text-right text-xs text-muted-foreground">{{ row.checkoutCount }}× dipinjam</span>
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
              <Input v-model.number="assetForm.purchasePriceIdr" type="number" placeholder="Belum diisi" />
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
