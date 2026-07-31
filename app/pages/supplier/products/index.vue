<script setup lang="ts">
import { ref, computed } from 'vue'
import { Plus } from 'lucide-vue-next'
import { getVendorById, getVendorProducts, createVendorProduct } from '~/data'
import { SERVICE_TYPES, findStatusOption } from '~/constants/status'
import { formatCurrencyIdr } from '~/utils/format'
import type { ServiceTypeKey } from '~/types/project'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Produk/Layanan Saya' })

const { canView, canManage, vendorScopeId } = usePermissions()
const canManageOwn = computed(() => canManage('supplier-portal'))

const vendor = computed(() => (vendorScopeId.value ? getVendorById(vendorScopeId.value) : undefined))
const products = computed(() => (vendorScopeId.value ? getVendorProducts(vendorScopeId.value) : []))

const isCreateOpen = ref(false)
const newName = ref('')
const newCategory = ref<ServiceTypeKey>('hotel')
const newDescription = ref('')
const newPrice = ref<number | null>(null)

function resetForm() {
  newName.value = ''
  newCategory.value = 'hotel'
  newDescription.value = ''
  newPrice.value = null
}

function submitCreate() {
  if (!vendorScopeId.value || !newName.value.trim()) return
  createVendorProduct({
    vendorId: vendorScopeId.value,
    name: newName.value.trim(),
    category: newCategory.value,
    description: newDescription.value.trim() || undefined,
    priceIdr: newPrice.value ?? undefined,
  })
  resetForm()
  isCreateOpen.value = false
}
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Produk/Layanan Saya"
      :description="vendor ? `Katalog produk/layanan milik ${vendor.name}.` : 'Katalog produk/layanan.'"
      :breadcrumb="[{ label: 'Supplier Portal', to: '/supplier' }, { label: 'Products' }]"
    >
      <template v-if="canManageOwn" #actions>
        <Dialog v-model:open="isCreateOpen">
          <DialogTrigger as-child>
            <Button><Plus class="h-4 w-4 mr-1.5" />Tambah Produk</Button>
          </DialogTrigger>
          <DialogContent class="max-w-md">
            <DialogHeader>
              <DialogTitle>Tambah Produk/Layanan Baru</DialogTitle>
              <DialogDescription>Produk baru akan tampil di katalog Vendor Detail internal MANOVA.</DialogDescription>
            </DialogHeader>
            <div class="space-y-4 py-2">
              <div class="space-y-1.5">
                <Label for="product-name">Nama Produk/Layanan</Label>
                <Input id="product-name" v-model="newName" placeholder="mis. Paket Kamar Deluxe" />
              </div>
              <div class="space-y-1.5">
                <Label for="product-category">Kategori</Label>
                <select id="product-category" v-model="newCategory" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                  <option v-for="type in SERVICE_TYPES" :key="type.value" :value="type.value">{{ type.label }}</option>
                </select>
              </div>
              <div class="space-y-1.5">
                <Label for="product-description">Deskripsi (opsional)</Label>
                <Input id="product-description" v-model="newDescription" placeholder="Deskripsi singkat produk/layanan" />
              </div>
              <div class="space-y-1.5">
                <Label for="product-price">Harga per Unit (Rp, opsional)</Label>
                <Input id="product-price" v-model.number="newPrice" type="number" placeholder="mis. 1200000" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" @click="isCreateOpen = false">Batal</Button>
              <Button :disabled="!newName.trim()" @click="submitCreate">Simpan</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </template>
    </PageHeader>

    <RoleAccessState v-if="!canView('supplier-portal') || !vendor" module-label="Supplier Portal" />

    <template v-else>
      <SectionCard>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama Produk/Layanan</TableHead>
              <TableHead>Kategori</TableHead>
              <TableHead>Deskripsi</TableHead>
              <TableHead>Harga</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="product in products" :key="product.id">
              <TableCell class="font-medium text-foreground">{{ product.name }}</TableCell>
              <TableCell><StatusBadge :label="findStatusOption(SERVICE_TYPES, product.category).label" :tone="findStatusOption(SERVICE_TYPES, product.category).tone" /></TableCell>
              <TableCell class="text-muted-foreground">{{ product.description ?? '—' }}</TableCell>
              <TableCell>{{ product.priceIdr ? formatCurrencyIdr(product.priceIdr) : '—' }}</TableCell>
            </TableRow>
            <TableEmpty v-if="products.length === 0" :colspan="4">Belum ada produk/layanan.</TableEmpty>
          </TableBody>
        </Table>
      </SectionCard>
    </template>
  </div>
</template>
