<script setup lang="ts">
import { computed, ref } from 'vue'
import { ShoppingCart, Plus } from 'lucide-vue-next'
import {
  PURCHASE_CATEGORIES,
  PURCHASE_STATUSES,
  getPurchaseEntries,
  getPurchaseTotalIdr,
  createPurchaseEntry,
  updatePurchaseStatus
} from '~/data/finance-ext'
import { findStatusOption } from '~/constants/status'
import { formatCurrencyIdr, formatDate } from '~/utils/format'
import { DEMO_REFERENCE_DATE } from '~/utils/attention'
import type { PurchaseCategoryKey, PurchaseEntry, PurchaseStatus } from '~/types/finance-ext'

/**
 * Section "Purchases" — Menu Finance & ACC > Hutang & Opex, di samping Payables/AP Aging dan Opex.
 * Pembelian barang/jasa non-vendor-service perusahaan (office supplies, software subscription, peralatan),
 * dibedakan dari Opex (biaya operasional periodik) dan Payables/SupplierInvoice (tagihan vendor formal
 * lewat Service Order untuk layanan project) — lihat komentar `PurchaseEntry` di `app/types/finance-ext.ts`.
 */

const { canView, canManage } = usePermissions()
const { currentUser } = useCurrentUser()
const { showToast } = useToast()

const hasAccess = computed(() => canView('finance-acc'))
const canManagePurchases = computed(() => canManage('finance'))

const refreshKey = ref(0)
const entries = computed(() => {
  void refreshKey.value
  return getPurchaseEntries()
})

const totalReceivedOrPaidIdr = computed(() => {
  void refreshKey.value
  return getPurchaseTotalIdr()
})

const pendingCount = computed(() => entries.value.filter(entry => entry.status === 'requested' || entry.status === 'ordered').length)

const isCreateOpen = ref(false)
const form = ref({
  purchaseDate: DEMO_REFERENCE_DATE,
  category: 'office-supplies' as PurchaseCategoryKey,
  description: '',
  amountIdr: null as number | null,
  vendorName: ''
})

function openCreate () {
  form.value = {
    purchaseDate: DEMO_REFERENCE_DATE,
    category: 'office-supplies',
    description: '',
    amountIdr: null,
    vendorName: ''
  }
  isCreateOpen.value = true
}

const isFormValid = computed(() => Boolean(form.value.description.trim() && form.value.amountIdr && form.value.amountIdr > 0))

function submitCreate () {
  if (!isFormValid.value) { return }
  createPurchaseEntry({
    purchaseDate: form.value.purchaseDate,
    category: form.value.category,
    description: form.value.description.trim(),
    amountIdr: Number(form.value.amountIdr),
    vendorName: form.value.vendorName.trim() || undefined,
    createdBy: currentUser.value.id
  })
  refreshKey.value += 1
  isCreateOpen.value = false
  showToast('Purchase ditambahkan', 'Entri masuk sebagai "Diajukan".', 'success')
}

function setStatus (entry: PurchaseEntry, status: PurchaseStatus) {
  updatePurchaseStatus(entry.id, status)
  refreshKey.value += 1
  showToast('Status diperbarui', `"${entry.description}" kini ${findStatusOption(PURCHASE_STATUSES, status).label}.`, 'success')
}

function nextStatus (status: PurchaseStatus): PurchaseStatus | null {
  if (status === 'requested') { return 'ordered' }
  if (status === 'ordered') { return 'received' }
  if (status === 'received') { return 'paid' }
  return null
}
</script>

<template>
  <div class="space-y-6">
    <RoleAccessState v-if="!hasAccess" module-label="modul Finance & ACC" />

    <template v-else>
      <div class="flex flex-wrap items-center gap-3">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1">
          <StatsCard title="Total Purchases (Diterima/Dibayar)" :value="formatCurrencyIdr(totalReceivedOrPaidIdr)" :icon="ShoppingCart" icon-color="primary" />
          <StatsCard title="Menunggu Diproses" :value="String(pendingCount)" :icon="ShoppingCart" :icon-color="pendingCount ? 'warning' : 'success'" />
        </div>

        <Sheet v-if="canManagePurchases" v-model:open="isCreateOpen">
          <SheetTrigger as-child>
            <!-- Mobile — floating popup button (fixed di atas bottom nav); desktop tombol inline biasa, tidak diubah. -->
            <Button class="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 z-30 h-12 gap-2 rounded-full pl-4 pr-5 text-sm font-semibold shadow-lg shadow-black/25 md:static md:bottom-auto md:right-auto md:z-auto md:h-9 md:gap-1.5 md:rounded-md md:pl-3 md:pr-3 md:text-sm md:font-medium md:shadow-none" @click="openCreate">
              <Plus class="h-4 w-4" />
              Tambah Purchase
            </Button>
          </SheetTrigger>
          <SheetContent side="right" class="w-full sm:max-w-md overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Purchase Baru</SheetTitle>
              <SheetDescription>Pembelian barang/jasa non-vendor-service (bukan biaya operasional periodik atau tagihan vendor project).</SheetDescription>
            </SheetHeader>
            <div class="space-y-4 py-4">
              <div class="space-y-1.5">
                <Label for="pur-date">Tanggal</Label>
                <Input id="pur-date" v-model="form.purchaseDate" type="date" />
              </div>
              <div class="space-y-1.5">
                <Label for="pur-category">Kategori</Label>
                <select id="pur-category" v-model="form.category" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                  <option v-for="category in PURCHASE_CATEGORIES" :key="category.value" :value="category.value">
                    {{ category.label }}
                  </option>
                </select>
              </div>
              <div class="space-y-1.5">
                <Label for="pur-description">Deskripsi</Label>
                <Input id="pur-description" v-model="form.description" placeholder="mis. Lisensi software akuntansi" />
              </div>
              <div class="space-y-1.5">
                <Label for="pur-amount">Jumlah (IDR)</Label>
                <CurrencyInput id="pur-amount" v-model="form.amountIdr" placeholder="0" />
              </div>
              <div class="space-y-1.5">
                <Label for="pur-vendor">Vendor / Toko (opsional)</Label>
                <Input id="pur-vendor" v-model="form.vendorName" placeholder="Nama vendor/toko" />
              </div>
            </div>
            <SheetFooter class="flex-row justify-end gap-2">
              <Button variant="outline" @click="isCreateOpen = false">
                Batal
              </Button>
              <Button :disabled="!isFormValid" @click="submitCreate">
                Simpan
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>

      <SectionCard title="Daftar Purchases">
        <ResponsiveDataView v-if="entries.length" :items="entries" :get-key="entry => entry.id">
          <template #desktop="{ items }">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Deskripsi</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead>Tanggal</TableHead>
                  <TableHead class="text-right">
                    Jumlah
                  </TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead v-if="canManagePurchases" class="text-right">
                    Aksi
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="entry in items" :key="entry.id">
                  <TableCell>
                    <p class="text-sm font-medium text-foreground">
                      {{ entry.description }}
                    </p>
                    <p v-if="entry.vendorName" class="text-xs text-muted-foreground">
                      {{ entry.vendorName }}
                    </p>
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      :label="findStatusOption(PURCHASE_CATEGORIES, entry.category).label"
                      :tone="findStatusOption(PURCHASE_CATEGORIES, entry.category).tone"
                    />
                  </TableCell>
                  <TableCell class="text-sm text-muted-foreground">
                    {{ formatDate(entry.purchaseDate) }}
                  </TableCell>
                  <TableCell class="text-right text-sm font-medium text-foreground">
                    {{ formatCurrencyIdr(entry.amountIdr) }}
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      :label="findStatusOption(PURCHASE_STATUSES, entry.status).label"
                      :tone="findStatusOption(PURCHASE_STATUSES, entry.status).tone"
                    />
                  </TableCell>
                  <TableCell v-if="canManagePurchases" class="text-right">
                    <Button
                      v-if="nextStatus(entry.status)"
                      variant="outline"
                      size="sm"
                      @click="setStatus(entry, nextStatus(entry.status) as PurchaseStatus)"
                    >
                      Tandai {{ findStatusOption(PURCHASE_STATUSES, nextStatus(entry.status) as PurchaseStatus).label }}
                    </Button>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </template>

          <template #mobile-card="{ item: entry }">
            <div class="rounded-xl border border-border bg-card p-4">
              <div class="flex items-start justify-between gap-2">
                <div class="min-w-0">
                  <p class="text-sm font-medium text-foreground truncate">
                    {{ entry.description }}
                  </p>
                  <p v-if="entry.vendorName" class="text-xs text-muted-foreground">
                    {{ entry.vendorName }}
                  </p>
                </div>
                <StatusBadge
                  :label="findStatusOption(PURCHASE_STATUSES, entry.status).label"
                  :tone="findStatusOption(PURCHASE_STATUSES, entry.status).tone"
                />
              </div>
              <div class="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p class="text-muted-foreground">
                    Kategori
                  </p>
                  <p class="text-foreground">
                    {{ findStatusOption(PURCHASE_CATEGORIES, entry.category).label }}
                  </p>
                </div>
                <div>
                  <p class="text-muted-foreground">
                    Tanggal
                  </p>
                  <p class="text-foreground">
                    {{ formatDate(entry.purchaseDate) }}
                  </p>
                </div>
                <div>
                  <p class="text-muted-foreground">
                    Jumlah
                  </p>
                  <p class="text-foreground font-medium">
                    {{ formatCurrencyIdr(entry.amountIdr) }}
                  </p>
                </div>
              </div>
              <Button
                v-if="canManagePurchases && nextStatus(entry.status)"
                variant="outline"
                size="sm"
                class="mt-3 w-full"
                @click="setStatus(entry, nextStatus(entry.status) as PurchaseStatus)"
              >
                Tandai {{ findStatusOption(PURCHASE_STATUSES, nextStatus(entry.status) as PurchaseStatus).label }}
              </Button>
            </div>
          </template>
        </ResponsiveDataView>

        <EmptyState v-else :icon="ShoppingCart" title="Belum ada purchase" />
      </SectionCard>
    </template>
  </div>
</template>
