<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { PackageX } from 'lucide-vue-next'
import {
  getCommodityOrderById, getProjectById, getPartyById, getCommoditySelectionById,
  getCommodityRequirementById, advanceCommodityOrderStatus, getCommodityOrderStatusTransitions,
  isCommodityOrderSold
} from '~/data'
import { COMMODITY_ORDER_STATUSES, findStatusOption } from '~/constants/status'
import { formatCurrencyIdr, formatDate } from '~/utils/format'
import type { CommodityOrderStatus } from '~/types/commodity-order'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const route = useRoute()
const router = useRouter()
const { canView, vendorScopeId } = usePermissions()
const { showToast } = useToast()

const order = computed(() => getCommodityOrderById(String(route.params.id)))
useHead({ title: computed(() => order.value ? `Order ${order.value.id}` : 'Order Tidak Ditemukan') })

/** Isolasi Vendor (Phase 5 Pastikan: "Vendor hanya melihat order commodity miliknya"). */
const isOwn = computed(() => !!order.value && !!vendorScopeId.value && order.value.vendorId === vendorScopeId.value)

const selection = computed(() => (order.value ? getCommoditySelectionById(order.value.selectionId) : undefined))
const requirement = computed(() => (selection.value ? getCommodityRequirementById(selection.value.requirementId) : undefined))
const project = computed(() => (order.value ? getProjectById(order.value.projectId) : undefined))
const client = computed(() => (requirement.value ? getPartyById(requirement.value.clientPartyId) : undefined))

const totalIdr = computed(() => (order.value ? order.value.sellPriceIdrSnapshot * order.value.quantity : 0))

/** "Status timeline" (Phase 5) — jalur utama sold: Confirmed → Booked → In Service → Completed, pola sama ServiceOrder Fulfillment Timeline (`app/pages/procurement/service-orders/[id]/index.vue`). Cancelled/Expired/Refunded ditampilkan terpisah sebagai exception, bukan bagian jalur utama. */
const TIMELINE_STEPS: CommodityOrderStatus[] = ['confirmed', 'booked', 'in-service', 'completed']
const EXCEPTION_STATUSES: CommodityOrderStatus[] = ['cancelled', 'expired', 'refunded']
const timelineIndex = computed(() => {
  if (!order.value || EXCEPTION_STATUSES.includes(order.value.status)) { return -1 }
  return TIMELINE_STEPS.indexOf(order.value.status)
})

function changeStatus (newStatus: CommodityOrderStatus) {
  if (!order.value) { return }
  const result = advanceCommodityOrderStatus(order.value.id, newStatus)
  if (result) {
    showToast('Status Order Diubah', `Order ${result.id} sekarang ${findStatusOption(COMMODITY_ORDER_STATUSES, result.status).label}.`, 'success')
  } else {
    showToast('Gagal Mengubah Status', 'Transisi status ini tidak valid dari status saat ini.', 'error')
  }
}
</script>

<template>
  <div class="space-y-6">
    <template v-if="!order || !isOwn">
      <PageHeader title="Order Tidak Ditemukan" :breadcrumb="[{ label: 'Supplier Portal', to: '/supplier' }, { label: 'Vendor Orders', to: '/supplier/commodity-orders' }, { label: 'Not Found' }]" />
      <SectionCard>
        <EmptyState :icon="PackageX" title="Order tidak ditemukan" description="Order ini tidak ada atau bukan milik company Anda.">
          <Button @click="router.push('/supplier/commodity-orders')">
            Kembali ke Vendor Orders
          </Button>
        </EmptyState>
      </SectionCard>
    </template>

    <RoleAccessState v-else-if="!canView('supplier-portal')" module-label="Supplier Portal" />

    <template v-else>
      <PageHeader
        :title="`Order ${order.id} — ${order.commodityNameSnapshot}`"
        :breadcrumb="[{ label: 'Supplier Portal', to: '/supplier' }, { label: 'Vendor Orders', to: '/supplier/commodity-orders' }, { label: order.id }]"
      >
        <template #actions>
          <div class="flex flex-wrap items-center gap-2">
            <StatusBadge :label="findStatusOption(COMMODITY_ORDER_STATUSES, order.status).label" :tone="findStatusOption(COMMODITY_ORDER_STATUSES, order.status).tone" />
            <StatusBadge v-if="isCommodityOrderSold(order.status)" label="Sold" tone="success" />
            <Button
              v-for="next in getCommodityOrderStatusTransitions(order.status)"
              :key="next"
              size="sm"
              :variant="next === 'cancelled' ? 'destructive' : 'outline'"
              @click="changeStatus(next)"
            >
              {{ findStatusOption(COMMODITY_ORDER_STATUSES, next).label }}
            </Button>
          </div>
        </template>
      </PageHeader>

      <SectionCard title="Status Timeline">
        <div v-if="EXCEPTION_STATUSES.includes(order.status)" class="text-sm text-destructive font-medium">
          Order {{ findStatusOption(COMMODITY_ORDER_STATUSES, order.status).label }} — di luar jalur sold utama.
        </div>
        <ol v-else class="flex flex-wrap items-center gap-2">
          <li v-for="(step, index) in TIMELINE_STEPS" :key="step" class="flex items-center gap-2">
            <span
              class="text-xs font-medium px-2.5 py-1 rounded-full border"
              :class="index <= timelineIndex ? 'bg-primary/10 border-primary text-primary' : 'border-border text-muted-foreground'"
            >{{ findStatusOption(COMMODITY_ORDER_STATUSES, step).label }}</span>
            <span v-if="index < TIMELINE_STEPS.length - 1" class="text-muted-foreground">→</span>
          </li>
        </ol>
      </SectionCard>

      <SectionCard>
        <DetailMetadataList
          :items="[
            { label: 'Komoditas', value: order.variantNameSnapshot ? `${order.commodityNameSnapshot} — ${order.variantNameSnapshot}` : order.commodityNameSnapshot },
            { label: 'Kuantitas', value: String(order.quantity) },
            { label: 'Harga Satuan (snapshot)', value: formatCurrencyIdr(order.sellPriceIdrSnapshot) },
            { label: 'Total', value: formatCurrencyIdr(totalIdr) },
            { label: 'Project', value: project?.name ?? order.projectId },
            { label: 'Client', value: client?.name ?? '—' },
            { label: 'Kebutuhan Client', value: requirement?.title ?? '—' },
            { label: 'Selection Asal', value: order.selectionId },
            { label: 'Dibuat', value: formatDate(order.createdAt) },
            { label: 'Diperbarui', value: order.updatedAt ? formatDate(order.updatedAt) : '—' },
          ]"
        />
      </SectionCard>
    </template>
  </div>
</template>
