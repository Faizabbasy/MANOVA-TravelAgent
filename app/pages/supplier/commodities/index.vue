<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Plus, Package } from 'lucide-vue-next'
import {
  getVendorById, getCommodityProductsByVendor, getCommodityVariantsByProduct, getAvailabilitySlotsByCommodity,
  getAvailableQuantity, createCommodityProduct
} from '~/data'
import { SERVICE_TYPES, COMMODITY_PRODUCT_STATUSES, findStatusOption } from '~/constants/status'
import { formatCurrencyIdr } from '~/utils/format'
import type { ServiceTypeKey } from '~/types/project'
import type { CommodityProductStatus } from '~/types/commodity'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Komoditas Saya' })

const { canView, canManage, vendorScopeId } = usePermissions()
const canManageOwn = computed(() => canManage('supplier-portal'))
const { showToast } = useToast()

const vendor = computed(() => (vendorScopeId.value ? getVendorById(vendorScopeId.value) : undefined))

const searchQuery = ref('')
const statusFilter = ref<'all' | CommodityProductStatus>('all')

const rows = computed(() => {
  if (!vendorScopeId.value) { return [] }
  let list = getCommodityProductsByVendor(vendorScopeId.value)

  if (statusFilter.value !== 'all') {
    list = list.filter(product => product.status === statusFilter.value)
  }
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    list = list.filter(product => product.name.toLowerCase().includes(q))
  }

  return list.map((product) => {
    const variantCount = getCommodityVariantsByProduct(product.id).length
    const totalAvailable = getAvailabilitySlotsByCommodity(product.id).reduce((sum, slot) => sum + getAvailableQuantity(slot), 0)
    return { product, variantCount, totalAvailable }
  })
})

// ── Create Commodity ──────────────────────────────────────────────────────
const isCreateOpen = ref(false)
const newName = ref('')
const newCategory = ref<ServiceTypeKey>('hotel')
const newDescription = ref('')
const newSellPrice = ref<number | null>(null)
const newCostPrice = ref<number | null>(null)

function resetCreateForm () {
  newName.value = ''
  newCategory.value = 'hotel'
  newDescription.value = ''
  newSellPrice.value = null
  newCostPrice.value = null
}

/** Reset form saat dialog ditutup lewat cara apapun (Batal, Escape, klik overlay) — Phase 6 regression fix, mencegah draft yang dibatalkan muncul lagi pre-filled saat dialog dibuka ulang. */
watch(isCreateOpen, (open) => { if (!open) { resetCreateForm() } })

function submitCreate () {
  if (!vendorScopeId.value || !newName.value.trim() || !newSellPrice.value) { return }
  const product = createCommodityProduct({
    vendorId: vendorScopeId.value,
    name: newName.value.trim(),
    category: newCategory.value,
    description: newDescription.value.trim() || undefined,
    sellPriceIdr: newSellPrice.value,
    costPriceIdr: newCostPrice.value ?? undefined
  })
  resetCreateForm()
  isCreateOpen.value = false
  showToast('Komoditas Dibuat', `"${product.name}" berhasil dibuat sebagai draft.`, 'success')
  navigateTo(`/supplier/commodities/${product.id}`)
}
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Komoditas Saya"
      :description="vendor ? `Katalog Commodity Product milik ${vendor.name}.` : 'Katalog Commodity Product.'"
      :breadcrumb="[{ label: 'Supplier Portal', to: '/supplier' }, { label: 'Komoditas Saya' }]"
    >
      <template v-if="canManageOwn" #actions>
        <Dialog v-model:open="isCreateOpen">
          <DialogTrigger as-child>
            <Button><Plus class="h-4 w-4 mr-1.5" />Buat Komoditas</Button>
          </DialogTrigger>
          <DialogContent class="max-w-md">
            <DialogHeader>
              <DialogTitle>Buat Commodity Product Baru</DialogTitle>
              <DialogDescription>Komoditas baru dibuat sebagai Draft — publikasikan setelah availability diatur.</DialogDescription>
            </DialogHeader>
            <div class="space-y-4 py-2">
              <div class="space-y-1.5">
                <Label for="commodity-name">Nama Komoditas</Label>
                <Input id="commodity-name" v-model="newName" placeholder="mis. Kamar Deluxe Bali Resort" />
              </div>
              <div class="space-y-1.5">
                <Label for="commodity-category">Kategori</Label>
                <select id="commodity-category" v-model="newCategory" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                  <option v-for="type in SERVICE_TYPES" :key="type.value" :value="type.value">
                    {{ type.label }}
                  </option>
                </select>
              </div>
              <div class="space-y-1.5">
                <Label for="commodity-description">Deskripsi (opsional)</Label>
                <Input id="commodity-description" v-model="newDescription" placeholder="Deskripsi singkat komoditas" />
              </div>
              <div class="space-y-1.5">
                <Label for="commodity-sell-price">Harga Jual ke Client (Rp)</Label>
                <Input id="commodity-sell-price" v-model.number="newSellPrice" type="number" placeholder="mis. 1200000" />
              </div>
              <div class="space-y-1.5">
                <Label for="commodity-cost-price">Harga Pokok Internal (Rp, opsional)</Label>
                <Input id="commodity-cost-price" v-model.number="newCostPrice" type="number" placeholder="mis. 900000" />
                <p class="text-xs text-muted-foreground">
                  Tidak pernah ditampilkan ke Client — hanya untuk referensi Anda sendiri.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" @click="isCreateOpen = false">
                Batal
              </Button>
              <Button :disabled="!newName.trim() || !newSellPrice" @click="submitCreate">
                Simpan
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </template>
    </PageHeader>

    <RoleAccessState v-if="!canView('supplier-portal') || !vendor" module-label="Supplier Portal" />

    <template v-else>
      <div class="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div class="relative flex-1 max-w-sm w-full">
          <Package class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input v-model="searchQuery" placeholder="Cari nama komoditas..." class="pl-9" />
        </div>
        <select
          v-model="statusFilter"
          class="appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer"
        >
          <option value="all">
            Semua Status
          </option>
          <option v-for="status in COMMODITY_PRODUCT_STATUSES" :key="status.value" :value="status.value">
            {{ status.label }}
          </option>
        </select>
      </div>

      <SectionCard>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama Komoditas</TableHead>
              <TableHead>Kategori</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Harga Jual</TableHead>
              <TableHead>Variant</TableHead>
              <TableHead>Availability</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow
              v-for="row in rows"
              :key="row.product.id"
              class="cursor-pointer hover:bg-muted/50"
              @click="navigateTo(`/supplier/commodities/${row.product.id}`)"
            >
              <TableCell class="font-medium text-foreground">
                {{ row.product.name }}
              </TableCell>
              <TableCell>
                <StatusBadge :label="findStatusOption(SERVICE_TYPES, row.product.category).label" :tone="findStatusOption(SERVICE_TYPES, row.product.category).tone" />
              </TableCell>
              <TableCell>
                <StatusBadge :label="findStatusOption(COMMODITY_PRODUCT_STATUSES, row.product.status).label" :tone="findStatusOption(COMMODITY_PRODUCT_STATUSES, row.product.status).tone" />
              </TableCell>
              <TableCell class="text-foreground">
                {{ formatCurrencyIdr(row.product.sellPriceIdr) }}
              </TableCell>
              <TableCell class="text-muted-foreground">
                {{ row.variantCount }}
              </TableCell>
              <TableCell class="text-muted-foreground">
                {{ row.totalAvailable }}
              </TableCell>
            </TableRow>
            <TableEmpty v-if="rows.length === 0" :colspan="6">
              {{ searchQuery || statusFilter !== 'all' ? 'Tidak ada komoditas yang cocok dengan filter.' : 'Belum ada komoditas. Klik "Buat Komoditas" untuk memulai.' }}
            </TableEmpty>
          </TableBody>
        </Table>
      </SectionCard>
    </template>
  </div>
</template>
