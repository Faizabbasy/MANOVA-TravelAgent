<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { PackageX, Pencil, UploadCloud, EyeOff, Archive, Trash2, Plus, CalendarPlus } from 'lucide-vue-next'
import {
  getCommodityProductById, getCommodityVariantsByProduct, getAvailabilitySlotsByCommodity, getAvailableQuantity,
  updateCommodityProductStatus, isCommodityProductDeletable, deleteCommodityProduct,
  createCommodityVariant, updateCommodityVariant, deleteCommodityVariant, isCommodityVariantDeletable,
  createAvailabilitySlot, updateAvailabilitySlotTotal, deleteAvailabilitySlot, isAvailabilitySlotDeletable
} from '~/data'
import { SERVICE_TYPES, COMMODITY_PRODUCT_STATUSES, findStatusOption } from '~/constants/status'
import { formatCurrencyIdr, formatDate } from '~/utils/format'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const route = useRoute()
const router = useRouter()
const { canView, vendorScopeId } = usePermissions()
const { showToast } = useToast()

const commodity = computed(() => getCommodityProductById(String(route.params.id)))
useHead({ title: computed(() => commodity.value ? commodity.value.name : 'Komoditas Tidak Ditemukan') })

/** Vendor isolation (Phase 1/2, pola sama `supplier/service-orders/[id]/index.vue`) — hanya dapat diakses bila komoditas ini milik `vendorScopeId`. */
const isOwn = computed(() => !!commodity.value && !!vendorScopeId.value && commodity.value.vendorId === vendorScopeId.value)

const variants = computed(() => (commodity.value ? getCommodityVariantsByProduct(commodity.value.id) : []))
const slots = computed(() => (commodity.value ? getAvailabilitySlotsByCommodity(commodity.value.id) : []))
const totalAvailable = computed(() => slots.value.reduce((sum, slot) => sum + getAvailableQuantity(slot), 0))

const canDelete = computed(() => !!commodity.value && isCommodityProductDeletable(commodity.value.id))
const canPublish = computed(() => !!commodity.value && ['draft', 'suspended'].includes(commodity.value.status))
const canUnpublish = computed(() => !!commodity.value && ['published', 'available', 'limited', 'sold-out'].includes(commodity.value.status))
const canArchive = computed(() => !!commodity.value && commodity.value.status !== 'archived')
const canEdit = computed(() => !!commodity.value && commodity.value.status !== 'archived')

// ── Generic confirmation dialog (delete/archive) ──────────────────────────
const confirmDialog = ref<{ title: string, description: string, confirmLabel: string, destructive: boolean, onConfirm:() => void } | null>(null)
function openConfirm (config: typeof confirmDialog.value) {
  confirmDialog.value = config
}
function runConfirm () {
  confirmDialog.value?.onConfirm()
  confirmDialog.value = null
}

function publish () {
  if (!commodity.value) { return }
  if (updateCommodityProductStatus(commodity.value.id, 'published')) {
    showToast('Komoditas Dipublikasikan', `"${commodity.value.name}" kini tampil di katalog Client (bila availability tersedia).`, 'success')
  } else {
    showToast('Gagal Mempublikasikan', 'Status komoditas saat ini tidak dapat dipindahkan ke Published.', 'error')
  }
}

function unpublish () {
  if (!commodity.value) { return }
  if (updateCommodityProductStatus(commodity.value.id, 'suspended')) {
    showToast('Komoditas Di-unpublish', `"${commodity.value.name}" disembunyikan sementara dari katalog Client.`, 'info')
  } else {
    showToast('Gagal Unpublish', 'Status komoditas saat ini tidak dapat dipindahkan ke Suspended.', 'error')
  }
}

function requestArchive () {
  if (!commodity.value) { return }
  openConfirm({
    title: 'Arsipkan komoditas?',
    description: `"${commodity.value.name}" akan diarsipkan dan tidak lagi tampil di katalog Client. Data historis (order/selection) tetap tersimpan.`,
    confirmLabel: 'Arsipkan',
    destructive: false,
    onConfirm: () => {
      if (commodity.value && updateCommodityProductStatus(commodity.value.id, 'archived')) {
        showToast('Komoditas Diarsipkan', `"${commodity.value.name}" berhasil diarsipkan.`, 'success')
      } else {
        showToast('Gagal Mengarsipkan', 'Status komoditas saat ini tidak dapat dipindahkan ke Archived.', 'error')
      }
    }
  })
}

function requestDelete () {
  if (!commodity.value) { return }
  const name = commodity.value.name
  const id = commodity.value.id
  openConfirm({
    title: 'Hapus draft komoditas?',
    description: `"${name}" akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.`,
    confirmLabel: 'Hapus',
    destructive: true,
    onConfirm: () => {
      if (deleteCommodityProduct(id)) {
        showToast('Draft Dihapus', `"${name}" berhasil dihapus.`, 'success')
        router.push('/supplier/commodities')
      } else {
        showToast('Gagal Menghapus', 'Komoditas sudah direferensikan availability/selection, gunakan Archive.', 'error')
      }
    }
  })
}

// ── Variant management ─────────────────────────────────────────────────────
const isAddVariantOpen = ref(false)
const newVariantName = ref('')
const newVariantPrice = ref<number | null>(null)

function resetAddVariantForm () {
  newVariantName.value = ''
  newVariantPrice.value = null
}
/** Reset form saat dialog ditutup lewat cara apapun (Batal, Escape, klik overlay) — Phase 6 regression fix. */
watch(isAddVariantOpen, (open) => { if (!open) { resetAddVariantForm() } })

function submitAddVariant () {
  if (!commodity.value || !newVariantName.value.trim()) { return }
  createCommodityVariant(commodity.value.id, newVariantName.value.trim(), newVariantPrice.value ?? undefined)
  isAddVariantOpen.value = false
  showToast('Variant Ditambahkan', 'Variant baru berhasil ditambahkan.', 'success')
}

const editingVariantId = ref<string | null>(null)
const editVariantName = ref('')
const editVariantPrice = ref<number | null>(null)

function openEditVariant (variantId: string) {
  const variant = variants.value.find(item => item.id === variantId)
  if (!variant) { return }
  editingVariantId.value = variantId
  editVariantName.value = variant.name
  editVariantPrice.value = variant.sellPriceIdr ?? null
}

function submitEditVariant () {
  if (!editingVariantId.value || !editVariantName.value.trim()) { return }
  updateCommodityVariant(editingVariantId.value, { name: editVariantName.value.trim(), sellPriceIdr: editVariantPrice.value ?? undefined })
  editingVariantId.value = null
  showToast('Variant Diperbarui', 'Perubahan variant berhasil disimpan.', 'success')
}

function requestDeleteVariant (variantId: string, variantName: string) {
  if (!isCommodityVariantDeletable(variantId)) {
    showToast('Tidak Dapat Dihapus', 'Variant ini sudah direferensikan availability/selection.', 'error')
    return
  }
  openConfirm({
    title: 'Hapus variant?',
    description: `Variant "${variantName}" akan dihapus permanen.`,
    confirmLabel: 'Hapus',
    destructive: true,
    onConfirm: () => {
      if (deleteCommodityVariant(variantId)) {
        showToast('Variant Dihapus', `Variant "${variantName}" berhasil dihapus.`, 'success')
      } else {
        showToast('Gagal Menghapus', 'Variant sudah direferensikan availability/selection.', 'error')
      }
    }
  })
}

// ── Availability management ────────────────────────────────────────────────
const isAddSlotOpen = ref(false)
const newSlotVariantId = ref<string>('')
const newSlotPeriodStart = ref('')
const newSlotPeriodEnd = ref('')
const newSlotTotal = ref<number | null>(null)
const newSlotCutoff = ref('')

function resetSlotForm () {
  newSlotVariantId.value = ''
  newSlotPeriodStart.value = ''
  newSlotPeriodEnd.value = ''
  newSlotTotal.value = null
  newSlotCutoff.value = ''
}
/** Reset form saat dialog ditutup lewat cara apapun (Batal, Escape, klik overlay) — Phase 6 regression fix. */
watch(isAddSlotOpen, (open) => { if (!open) { resetSlotForm() } })

function submitAddSlot () {
  if (!commodity.value || !newSlotPeriodStart.value || !newSlotPeriodEnd.value || newSlotTotal.value === null) { return }
  const slot = createAvailabilitySlot({
    commodityProductId: commodity.value.id,
    variantId: newSlotVariantId.value || undefined,
    periodStart: newSlotPeriodStart.value,
    periodEnd: newSlotPeriodEnd.value,
    totalQuantity: newSlotTotal.value,
    bookingCutoff: newSlotCutoff.value || undefined
  })
  if (slot) {
    resetSlotForm()
    isAddSlotOpen.value = false
    showToast('Availability Ditambahkan', 'Slot availability baru berhasil dibuat.', 'success')
  }
}

const slotCapacityEdits = ref<Record<string, number>>({})

function capacityValue (slotId: string, current: number): number {
  return slotCapacityEdits.value[slotId] ?? current
}

function submitCapacityUpdate (slotId: string) {
  const value = slotCapacityEdits.value[slotId]
  if (value === undefined) { return }
  const result = updateAvailabilitySlotTotal(slotId, value)
  if (result) {
    showToast('Kapasitas Diperbarui', `Total kapasitas kini ${result.totalQuantity}.`, 'success')
    delete slotCapacityEdits.value[slotId]
  } else {
    showToast('Gagal Memperbarui', 'Kapasitas tidak boleh negatif atau kurang dari jumlah yang sudah booked.', 'error')
  }
}

function requestDeleteSlot (slotId: string) {
  if (!isAvailabilitySlotDeletable(slotId)) {
    showToast('Tidak Dapat Dihapus', 'Slot ini masih memiliki held/booked quantity.', 'error')
    return
  }
  openConfirm({
    title: 'Hapus slot availability?',
    description: 'Slot availability ini akan dihapus permanen.',
    confirmLabel: 'Hapus',
    destructive: true,
    onConfirm: () => {
      if (deleteAvailabilitySlot(slotId)) {
        showToast('Slot Dihapus', 'Slot availability berhasil dihapus.', 'success')
      } else {
        showToast('Gagal Menghapus', 'Slot ini masih memiliki held/booked quantity.', 'error')
      }
    }
  })
}

function variantName (variantId?: string): string {
  if (!variantId) { return '— (level Commodity)' }
  return variants.value.find(item => item.id === variantId)?.name ?? variantId
}
</script>

<template>
  <div class="space-y-6">
    <template v-if="!commodity || !isOwn">
      <PageHeader title="Komoditas Tidak Ditemukan" :breadcrumb="[{ label: 'Supplier Portal', to: '/supplier' }, { label: 'Komoditas Saya', to: '/supplier/commodities' }, { label: 'Not Found' }]" />
      <SectionCard>
        <EmptyState :icon="PackageX" title="Komoditas tidak ditemukan" :description="`Komoditas dengan ID '${route.params.id}' tidak ada atau bukan milik company Anda.`">
          <Button @click="router.push('/supplier/commodities')">
            Kembali ke Komoditas Saya
          </Button>
        </EmptyState>
      </SectionCard>
    </template>

    <RoleAccessState v-else-if="!canView('supplier-portal') || !vendorScopeId" module-label="Supplier Portal" />

    <template v-else>
      <PageHeader :title="commodity.name" :breadcrumb="[{ label: 'Supplier Portal', to: '/supplier' }, { label: 'Komoditas Saya', to: '/supplier/commodities' }, { label: commodity.name }]">
        <template #actions>
          <div class="flex flex-wrap items-center gap-2">
            <StatusBadge :label="findStatusOption(COMMODITY_PRODUCT_STATUSES, commodity.status).label" :tone="findStatusOption(COMMODITY_PRODUCT_STATUSES, commodity.status).tone" />
            <Button v-if="canEdit" size="sm" variant="outline" @click="router.push(`/supplier/commodities/${commodity.id}/edit`)">
              <Pencil class="h-4 w-4 mr-1.5" />Edit
            </Button>
            <Button v-if="canPublish" size="sm" @click="publish">
              <UploadCloud class="h-4 w-4 mr-1.5" />Publish
            </Button>
            <Button v-if="canUnpublish" size="sm" variant="outline" @click="unpublish">
              <EyeOff class="h-4 w-4 mr-1.5" />Unpublish
            </Button>
            <Button v-if="canArchive" size="sm" variant="outline" @click="requestArchive">
              <Archive class="h-4 w-4 mr-1.5" />Archive
            </Button>
            <Button v-if="canDelete" size="sm" variant="destructive" @click="requestDelete">
              <Trash2 class="h-4 w-4 mr-1.5" />Hapus Draft
            </Button>
          </div>
        </template>
      </PageHeader>

      <SectionCard title="Detail Komoditas">
        <DetailMetadataList
          :items="[
            { label: 'Kategori', value: findStatusOption(SERVICE_TYPES, commodity.category).label },
            { label: 'Deskripsi', value: commodity.description ?? '—' },
            { label: 'Harga Jual ke Client', value: formatCurrencyIdr(commodity.sellPriceIdr) },
            { label: 'Harga Pokok Internal', value: commodity.costPriceIdr ? formatCurrencyIdr(commodity.costPriceIdr) : '—' },
            { label: 'Total Availability Tersisa', value: String(totalAvailable) },
            { label: 'Dibuat', value: formatDate(commodity.createdAt) },
          ]"
        />
        <p class="mt-2 text-xs text-muted-foreground">
          Harga pokok internal hanya tampil di halaman ini — tidak pernah dirender pada halaman Client.
        </p>
      </SectionCard>

      <SectionCard title="Variant">
        <template v-if="canEdit" #actions>
          <Dialog v-model:open="isAddVariantOpen">
            <DialogTrigger as-child>
              <Button size="sm" variant="outline">
                <Plus class="h-4 w-4 mr-1.5" />Tambah Variant
              </Button>
            </DialogTrigger>
            <DialogContent class="max-w-sm">
              <DialogHeader>
                <DialogTitle>Tambah Variant</DialogTitle>
              </DialogHeader>
              <div class="space-y-4 py-2">
                <div class="space-y-1.5">
                  <Label for="variant-name">Nama Variant</Label>
                  <Input id="variant-name" v-model="newVariantName" placeholder="mis. King Bed" />
                </div>
                <div class="space-y-1.5">
                  <Label for="variant-price">Harga Override (Rp, opsional)</Label>
                  <CurrencyInput id="variant-price" v-model="newVariantPrice" placeholder="Kosongkan untuk pakai harga induk" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" @click="isAddVariantOpen = false">
                  Batal
                </Button>
                <Button :disabled="!newVariantName.trim()" @click="submitAddVariant">
                  Simpan
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </template>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama Variant</TableHead>
              <TableHead>Harga</TableHead>
              <TableHead>Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="variant in variants" :key="variant.id">
              <TableCell class="font-medium text-foreground">
                {{ variant.name }}
              </TableCell>
              <TableCell class="text-muted-foreground">
                {{ variant.sellPriceIdr ? formatCurrencyIdr(variant.sellPriceIdr) : `${formatCurrencyIdr(commodity.sellPriceIdr)} (induk)` }}
              </TableCell>
              <TableCell>
                <div v-if="canEdit" class="flex items-center gap-2">
                  <Button size="sm" variant="outline" @click="openEditVariant(variant.id)">
                    Edit
                  </Button>
                  <Button size="sm" variant="destructive" @click="requestDeleteVariant(variant.id, variant.name)">
                    Hapus
                  </Button>
                </div>
                <span v-else class="text-xs text-muted-foreground">—</span>
              </TableCell>
            </TableRow>
            <TableEmpty v-if="variants.length === 0" :colspan="3">
              Belum ada variant.
            </TableEmpty>
          </TableBody>
        </Table>
      </SectionCard>

      <SectionCard title="Availability" description="Kapasitas per periode. availableQuantity = totalQuantity - heldQuantity - bookedQuantity.">
        <template v-if="canEdit" #actions>
          <Dialog v-model:open="isAddSlotOpen">
            <DialogTrigger as-child>
              <Button size="sm" variant="outline">
                <CalendarPlus class="h-4 w-4 mr-1.5" />Tambah Availability
              </Button>
            </DialogTrigger>
            <DialogContent class="max-w-md">
              <DialogHeader>
                <DialogTitle>Tambah Availability Slot</DialogTitle>
              </DialogHeader>
              <div class="space-y-4 py-2">
                <div v-if="variants.length" class="space-y-1.5">
                  <Label for="slot-variant">Berlaku Untuk</Label>
                  <select id="slot-variant" v-model="newSlotVariantId" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                    <option value="">
                      Level Commodity (semua variant)
                    </option>
                    <option v-for="variant in variants" :key="variant.id" :value="variant.id">
                      {{ variant.name }}
                    </option>
                  </select>
                </div>
                <div class="grid grid-cols-2 gap-3">
                  <div class="space-y-1.5">
                    <Label for="slot-start">Periode Mulai</Label>
                    <Input id="slot-start" v-model="newSlotPeriodStart" type="date" />
                  </div>
                  <div class="space-y-1.5">
                    <Label for="slot-end">Periode Selesai</Label>
                    <Input id="slot-end" v-model="newSlotPeriodEnd" type="date" />
                  </div>
                </div>
                <div class="space-y-1.5">
                  <Label for="slot-total">Total Kapasitas</Label>
                  <Input id="slot-total" v-model.number="newSlotTotal" type="number" placeholder="mis. 10" />
                </div>
                <div class="space-y-1.5">
                  <Label for="slot-cutoff">Booking Cutoff (opsional)</Label>
                  <Input id="slot-cutoff" v-model="newSlotCutoff" type="date" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" @click="isAddSlotOpen = false">
                  Batal
                </Button>
                <Button :disabled="!newSlotPeriodStart || !newSlotPeriodEnd || newSlotTotal === null" @click="submitAddSlot">
                  Simpan
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </template>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Periode</TableHead>
              <TableHead>Berlaku Untuk</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Held</TableHead>
              <TableHead>Booked</TableHead>
              <TableHead>Available</TableHead>
              <TableHead>Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="slot in slots" :key="slot.id">
              <TableCell class="text-foreground">
                {{ formatDate(slot.periodStart) }} – {{ formatDate(slot.periodEnd) }}
              </TableCell>
              <TableCell class="text-muted-foreground">
                {{ variantName(slot.variantId) }}
              </TableCell>
              <TableCell>
                <div v-if="canEdit" class="flex items-center gap-1.5">
                  <Input
                    :model-value="capacityValue(slot.id, slot.totalQuantity)"
                    type="number"
                    class="w-20 h-8"
                    @update:model-value="val => slotCapacityEdits[slot.id] = Number(val)"
                  />
                  <Button size="sm" variant="outline" @click="submitCapacityUpdate(slot.id)">
                    Update
                  </Button>
                </div>
                <span v-else>{{ slot.totalQuantity }}</span>
              </TableCell>
              <TableCell class="text-muted-foreground">
                {{ slot.heldQuantity }}
              </TableCell>
              <TableCell class="text-muted-foreground">
                {{ slot.bookedQuantity }}
              </TableCell>
              <TableCell class="font-medium text-foreground">
                {{ getAvailableQuantity(slot) }}
              </TableCell>
              <TableCell>
                <Button v-if="canEdit" size="sm" variant="destructive" @click="requestDeleteSlot(slot.id)">
                  Hapus
                </Button>
                <span v-else class="text-xs text-muted-foreground">—</span>
              </TableCell>
            </TableRow>
            <TableEmpty v-if="slots.length === 0" :colspan="7">
              Belum ada availability. Komoditas tidak akan tampil sebagai "Available" di katalog Client sampai availability diatur.
            </TableEmpty>
          </TableBody>
        </Table>
      </SectionCard>
    </template>

    <!-- ── Edit Variant Dialog ──────────────────────────────────────────── -->
    <Dialog :open="editingVariantId !== null" @update:open="val => { if (!val) editingVariantId = null }">
      <DialogContent class="max-w-sm">
        <DialogHeader>
          <DialogTitle>Edit Variant</DialogTitle>
        </DialogHeader>
        <div class="space-y-4 py-2">
          <div class="space-y-1.5">
            <Label for="edit-variant-name">Nama Variant</Label>
            <Input id="edit-variant-name" v-model="editVariantName" />
          </div>
          <div class="space-y-1.5">
            <Label for="edit-variant-price">Harga Override (Rp, opsional)</Label>
            <CurrencyInput id="edit-variant-price" v-model="editVariantPrice" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="editingVariantId = null">
            Batal
          </Button>
          <Button :disabled="!editVariantName.trim()" @click="submitEditVariant">
            Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- ── Generic Confirmation Dialog ──────────────────────────────────── -->
    <Dialog :open="confirmDialog !== null" @update:open="val => { if (!val) confirmDialog = null }">
      <DialogContent v-if="confirmDialog" class="max-w-sm p-0 overflow-hidden gap-0">
        <div class="p-6">
          <div class="flex h-12 w-12 items-center justify-center rounded-full mb-4" :class="confirmDialog.destructive ? 'bg-destructive/10' : 'bg-warning/10'">
            <Trash2 v-if="confirmDialog.destructive" class="h-6 w-6 text-destructive" />
            <Archive v-else class="h-6 w-6 text-warning" />
          </div>
          <h3 class="text-base font-semibold text-foreground">
            {{ confirmDialog.title }}
          </h3>
          <p class="text-sm text-muted-foreground mt-1.5 leading-relaxed">
            {{ confirmDialog.description }}
          </p>
          <div class="flex items-center justify-end gap-2.5 mt-6">
            <Button variant="outline" @click="confirmDialog = null">
              Batal
            </Button>
            <Button :variant="confirmDialog.destructive ? 'destructive' : 'default'" @click="runConfirm">
              {{ confirmDialog.confirmLabel }}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>
