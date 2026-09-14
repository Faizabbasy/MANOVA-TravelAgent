<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  getVendorById, getCommodityOrdersByVendor, getPendingSoftHoldSelectionsByVendor,
  getCommodityProductById, getCommodityVariantById, getCommodityRequirementById,
  confirmCommodityOrderFromSelection, getVendorSoldCommoditiesSummary, sweepExpiredHolds
} from '~/data'
import { COMMODITY_ORDER_STATUSES, findStatusOption } from '~/constants/status'
import { formatCurrencyIdr, formatDate } from '~/utils/format'
import type { CommodityOrderStatus } from '~/types/commodity-order'

/** Tab "Vendor Orders" — Menu Vendor Portal > Orders (Penyederhanaan 7-Role/Menu). Dulu
 * `/supplier/commodity-orders`, kini tab dalam satu menu bersama Assignments/Service Orders — logika tidak diubah. */

const { canView, vendorScopeId } = usePermissions()
const { showToast } = useToast()

/** Hold expiry sweep (Phase 6 regression fix) — tanpa ini, vendor bisa mengonfirmasi Soft Hold yang sudah kadaluarsa sebelum sempat disapu oleh halaman katalog Client (pola sama `client/catalog/[requirementId]/index.vue`). */
sweepExpiredHolds()

const vendor = computed(() => (vendorScopeId.value ? getVendorById(vendorScopeId.value) : undefined))

/** Selection Soft Hold milik komoditas vendor ini yang menunggu dikonfirmasi menjadi Order (Phase 5). */
const pendingSelections = computed(() => {
  if (!vendorScopeId.value) { return [] }
  return getPendingSoftHoldSelectionsByVendor(vendorScopeId.value).map((selection) => {
    const product = getCommodityProductById(selection.commodityProductId)
    const variant = selection.variantId ? getCommodityVariantById(selection.variantId) : undefined
    const requirement = getCommodityRequirementById(selection.requirementId)
    return { selection, product, variant, requirement }
  })
})

function confirmSelection (selectionId: string) {
  if (!vendorScopeId.value) { return }
  const order = confirmCommodityOrderFromSelection(selectionId, vendorScopeId.value)
  if (order) {
    showToast('Order Dikonfirmasi', `${order.commodityNameSnapshot} — held quantity dipindahkan menjadi booked.`, 'success')
  } else {
    showToast('Gagal Mengonfirmasi', 'Selection ini tidak lagi berstatus Soft Hold, sudah punya Order, atau komoditasnya sudah tidak lagi dijual (archived/expired/suspended).', 'error')
  }
}

// ── Vendor Orders — search & filter ───────────────────────────────────────
const searchQuery = ref('')
const statusFilter = ref<'all' | CommodityOrderStatus>('all')

/** Isolasi Vendor (Phase 5 Pastikan: "Vendor hanya melihat order commodity miliknya") — `getCommodityOrdersByVendor` sudah menyaring lewat `vendorId`. */
const orders = computed(() => {
  if (!vendorScopeId.value) { return [] }
  let list = getCommodityOrdersByVendor(vendorScopeId.value)
  if (statusFilter.value !== 'all') {
    list = list.filter(order => order.status === statusFilter.value)
  }
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    list = list.filter(order =>
      order.commodityNameSnapshot.toLowerCase().includes(q) ||
      order.id.toLowerCase().includes(q)
    )
  }
  return list.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt))
})

const soldSummary = computed(() => (vendorScopeId.value ? getVendorSoldCommoditiesSummary(vendorScopeId.value) : []))
const soldTotals = computed(() => soldSummary.value.reduce(
  (acc, row) => ({ quantity: acc.quantity + row.soldQuantity, revenue: acc.revenue + row.soldRevenueIdr }),
  { quantity: 0, revenue: 0 }
))
</script>

<template>
  <div class="space-y-6">
    <RoleAccessState v-if="!canView('supplier-portal') || !vendor" module-label="Supplier Portal" />

    <template v-else>
      <SectionCard
        v-if="pendingSelections.length"
        title="Menunggu Konfirmasi"
        description="Selection Client yang sedang Soft Hold pada komoditas Anda — konfirmasi untuk membuat Order (held quantity dipindahkan menjadi booked)."
      >
        <ResponsiveDataView :items="pendingSelections" :get-key="row => row.selection.id">
          <template #desktop="{ items }">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Komoditas</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Kebutuhan Client</TableHead>
                  <TableHead>Hold Kadaluarsa</TableHead>
                  <TableHead>Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="row in items" :key="row.selection.id">
                  <TableCell class="font-medium text-foreground">
                    {{ row.product?.name ?? row.selection.commodityProductId }}
                    <span v-if="row.variant" class="text-muted-foreground"> — {{ row.variant.name }}</span>
                  </TableCell>
                  <TableCell class="text-muted-foreground">
                    {{ row.selection.quantity }}
                  </TableCell>
                  <TableCell class="text-muted-foreground">
                    {{ row.requirement?.title ?? '—' }}
                  </TableCell>
                  <TableCell class="text-muted-foreground">
                    {{ row.selection.holdExpiresAt ? formatDate(row.selection.holdExpiresAt) : '—' }}
                  </TableCell>
                  <TableCell>
                    <Button size="sm" @click="confirmSelection(row.selection.id)">
                      Konfirmasi Order
                    </Button>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </template>

          <template #mobile-card="{ item: row }">
            <div class="rounded-xl border border-border bg-card p-4">
              <div class="flex items-start justify-between gap-2">
                <p class="font-medium text-foreground">
                  {{ row.product?.name ?? row.selection.commodityProductId }}
                  <span v-if="row.variant" class="text-muted-foreground"> — {{ row.variant.name }}</span>
                </p>
              </div>
              <div class="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p class="text-muted-foreground">
                    Qty
                  </p>
                  <p class="text-foreground">
                    {{ row.selection.quantity }}
                  </p>
                </div>
                <div>
                  <p class="text-muted-foreground">
                    Hold Kadaluarsa
                  </p>
                  <p class="text-foreground">
                    {{ row.selection.holdExpiresAt ? formatDate(row.selection.holdExpiresAt) : '—' }}
                  </p>
                </div>
                <div class="col-span-2">
                  <p class="text-muted-foreground">
                    Kebutuhan Client
                  </p>
                  <p class="text-foreground">
                    {{ row.requirement?.title ?? '—' }}
                  </p>
                </div>
              </div>
              <Button size="sm" class="mt-3 w-full" @click="confirmSelection(row.selection.id)">
                Konfirmasi Order
              </Button>
            </div>
          </template>
        </ResponsiveDataView>
      </SectionCard>

      <div class="flex flex-col sm:flex-row items-start sm:items-center gap-3 justify-between">
        <Input v-model="searchQuery" placeholder="Cari nama komoditas atau ID order..." class="max-w-sm w-full" />
        <select
          v-model="statusFilter"
          class="appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer"
        >
          <option value="all">
            Semua Status
          </option>
          <option v-for="status in COMMODITY_ORDER_STATUSES" :key="status.value" :value="status.value">
            {{ status.label }}
          </option>
        </select>
      </div>

      <SectionCard title="Orders">
        <ResponsiveDataView :items="orders" :get-key="order => order.id">
          <template #desktop="{ items }">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Komoditas</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Harga</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Dibuat</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow
                  v-for="order in items"
                  :key="order.id"
                  class="cursor-pointer hover:bg-muted/50"
                  @click="navigateTo(`/supplier/commodity-orders/${order.id}`)"
                >
                  <TableCell class="font-medium text-foreground">
                    {{ order.id }}
                  </TableCell>
                  <TableCell class="text-foreground">
                    {{ order.commodityNameSnapshot }}
                    <span v-if="order.variantNameSnapshot" class="text-muted-foreground"> — {{ order.variantNameSnapshot }}</span>
                  </TableCell>
                  <TableCell class="text-muted-foreground">
                    {{ order.quantity }}
                  </TableCell>
                  <TableCell class="text-foreground">
                    {{ formatCurrencyIdr(order.sellPriceIdrSnapshot) }}
                  </TableCell>
                  <TableCell>
                    <StatusBadge :label="findStatusOption(COMMODITY_ORDER_STATUSES, order.status).label" :tone="findStatusOption(COMMODITY_ORDER_STATUSES, order.status).tone" />
                  </TableCell>
                  <TableCell class="text-muted-foreground">
                    {{ formatDate(order.createdAt) }}
                  </TableCell>
                </TableRow>
                <TableEmpty v-if="orders.length === 0" :colspan="6">
                  {{ searchQuery || statusFilter !== 'all' ? 'Tidak ada Order yang cocok dengan filter.' : 'Belum ada Order untuk komoditas Anda.' }}
                </TableEmpty>
              </TableBody>
            </Table>
          </template>

          <template #mobile-card="{ item: order }">
            <button type="button" class="w-full text-left rounded-xl border border-border bg-card p-4" @click="navigateTo(`/supplier/commodity-orders/${order.id}`)">
              <div class="flex items-start justify-between gap-2">
                <p class="font-medium text-foreground">
                  {{ order.commodityNameSnapshot }}
                  <span v-if="order.variantNameSnapshot" class="text-muted-foreground"> — {{ order.variantNameSnapshot }}</span>
                </p>
                <StatusBadge :label="findStatusOption(COMMODITY_ORDER_STATUSES, order.status).label" :tone="findStatusOption(COMMODITY_ORDER_STATUSES, order.status).tone" />
              </div>
              <div class="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p class="text-muted-foreground">
                    ID
                  </p>
                  <p class="text-foreground">
                    {{ order.id }}
                  </p>
                </div>
                <div>
                  <p class="text-muted-foreground">
                    Qty
                  </p>
                  <p class="text-foreground">
                    {{ order.quantity }}
                  </p>
                </div>
                <div>
                  <p class="text-muted-foreground">
                    Harga
                  </p>
                  <p class="text-foreground">
                    {{ formatCurrencyIdr(order.sellPriceIdrSnapshot) }}
                  </p>
                </div>
                <div>
                  <p class="text-muted-foreground">
                    Dibuat
                  </p>
                  <p class="text-foreground">
                    {{ formatDate(order.createdAt) }}
                  </p>
                </div>
              </div>
            </button>
          </template>
        </ResponsiveDataView>
      </SectionCard>

      <SectionCard title="Sold Commodities" description="Ringkasan komoditas yang sudah terjual — Confirmed, Booked, In Service, dan Completed dihitung sold; Soft Hold belum.">
        <ResponsiveDataView :items="soldSummary" :get-key="row => row.commodityProductId">
          <template #desktop="{ items }">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Komoditas</TableHead>
                  <TableHead>Qty Terjual</TableHead>
                  <TableHead>Jumlah Order</TableHead>
                  <TableHead>Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="row in items" :key="row.commodityProductId">
                  <TableCell class="font-medium text-foreground">
                    {{ row.commodityName }}
                  </TableCell>
                  <TableCell class="text-muted-foreground">
                    {{ row.soldQuantity }}
                  </TableCell>
                  <TableCell class="text-muted-foreground">
                    {{ row.orderCount }}
                  </TableCell>
                  <TableCell class="text-foreground">
                    {{ formatCurrencyIdr(row.soldRevenueIdr) }}
                  </TableCell>
                </TableRow>
                <TableRow v-if="soldSummary.length">
                  <TableCell class="font-semibold text-foreground">
                    Total
                  </TableCell>
                  <TableCell class="font-semibold text-foreground">
                    {{ soldTotals.quantity }}
                  </TableCell>
                  <TableCell />
                  <TableCell class="font-semibold text-foreground">
                    {{ formatCurrencyIdr(soldTotals.revenue) }}
                  </TableCell>
                </TableRow>
                <TableEmpty v-if="soldSummary.length === 0" :colspan="4">
                  Belum ada komoditas terjual — konfirmasi Selection Soft Hold di atas untuk mulai menghasilkan Order yang dihitung sebagai sold.
                </TableEmpty>
              </TableBody>
            </Table>
          </template>

          <template #mobile-card="{ item: row }">
            <div class="rounded-xl border border-border bg-card p-4">
              <div class="flex items-start justify-between gap-2">
                <p class="font-medium text-foreground">
                  {{ row.commodityName }}
                </p>
              </div>
              <div class="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p class="text-muted-foreground">
                    Qty Terjual
                  </p>
                  <p class="text-foreground">
                    {{ row.soldQuantity }}
                  </p>
                </div>
                <div>
                  <p class="text-muted-foreground">
                    Jumlah Order
                  </p>
                  <p class="text-foreground">
                    {{ row.orderCount }}
                  </p>
                </div>
                <div class="col-span-2">
                  <p class="text-muted-foreground">
                    Revenue
                  </p>
                  <p class="text-foreground">
                    {{ formatCurrencyIdr(row.soldRevenueIdr) }}
                  </p>
                </div>
              </div>
            </div>
          </template>
        </ResponsiveDataView>
        <div v-if="soldSummary.length" class="mt-3 rounded-xl border border-border bg-muted/30 p-4 text-xs sm:hidden">
          <div class="flex items-center justify-between font-semibold text-foreground">
            <span>Total</span>
            <span>{{ soldTotals.quantity }} qty</span>
          </div>
          <p class="mt-1 text-right font-semibold text-foreground">
            {{ formatCurrencyIdr(soldTotals.revenue) }}
          </p>
        </div>
      </SectionCard>
    </template>
  </div>
</template>
