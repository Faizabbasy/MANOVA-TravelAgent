<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { FileX } from 'lucide-vue-next'
import { getSalesOrderById, getPartyById, getSalesOrderStatusTransitions } from '~/data'
import { changeSalesOrderStatusOnServer, reloadSalesOrder } from '~/data/sales-orders-sync'
import { reloadTravelersAfterOrderChange } from '~/data/travelers-sync'
import { isApiError } from '~/lib/api/errors'
import { SALES_ORDER_STATUSES, findStatusOption } from '~/constants/status'
import { formatCurrencyIdr, formatDateRange, formatDate } from '~/utils/format'
import type { SalesOrderStatus } from '~/types/sales-order'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const route = useRoute()
const router = useRouter()
const { canView, canManage } = usePermissions()
const { showToast } = useToast()
const hasAccess = computed(() => canView('operations'))
const canManageOrder = computed(() => canManage('operations'))

const order = computed(() => getSalesOrderById(String(route.params.id)))
const customer = computed(() => (order.value ? getPartyById(order.value.customerId) : undefined))

useHead({ title: computed(() => order.value ? `Sales Order ${order.value.id}` : 'Sales Order Tidak Ditemukan') })

const summaryMetadata = computed(() => {
  if (!order.value) { return [] }
  return [
    { label: 'Customer', value: customer.value?.name ?? '—' },
    { label: 'Telepon', value: customer.value?.phone ?? '—' },
    { label: 'Destinasi', value: order.value.destination },
    { label: 'Tanggal', value: formatDateRange(order.value.travelStartDate, order.value.travelEndDate) },
    { label: 'Jumlah Traveler', value: String(order.value.travelerCount) },
    { label: 'Harga', value: formatCurrencyIdr(order.value.priceIdr) },
    { label: 'Dibuat', value: formatDate(order.value.createdAt) },
    ...(order.value.paidOn ? [{ label: 'Paid', value: formatDate(order.value.paidOn) }] : []),
    ...(order.value.statusReason ? [{ label: 'Alasan batal', value: order.value.statusReason }] : [])
  ]
})

/**
 * Every order (Group Trip and B2C standalone) becomes paid only through the Finance DP/payment confirmation — money
 * actually received — never by hand here (owner accounting F4).
 */
const nextStatuses = computed(() => (order.value ? getSalesOrderStatusTransitions(order.value.status).filter(status => status !== 'paid') : []))
const paidViaFinance = computed(() => order.value?.status === 'draft')
const session = useServerSession()
const canConfirmDp = computed(() => order.value?.status === 'draft' && session.can('finance.post-cash'))
const confirmDpOpen = ref(false)
const dpOrder = computed(() => order.value
  ? { id: order.value.id, customerName: customer.value?.name ?? order.value.customerId, travelerCount: order.value.travelerCount, priceMinor: String(order.value.priceIdr) }
  : null)
async function onDpConfirmed () {
  if (!order.value) { return }
  try { await reloadSalesOrder(api, order.value.id) } catch { /* the next sales order sync brings it */ }
}

/* Status changes run on the server (S6b); cancelling asks for a reason. */
const api = useApi()
const isSaving = ref(false)
const isCancelOpen = ref(false)
const cancelReason = ref('')

async function advanceTo (status: SalesOrderStatus, reason?: string) {
  if (!order.value || isSaving.value) { return }
  if (status === 'cancelled' && !reason) {
    cancelReason.value = ''
    isCancelOpen.value = true
    return
  }
  isSaving.value = true
  try {
    const updated = await changeSalesOrderStatusOnServer(api, order.value.id, status, reason)
    try {
      await reloadTravelersAfterOrderChange(api, updated)
    } catch {
      // The next participant sync brings them.
    }
    isCancelOpen.value = false
    showToast('Status Diperbarui', `${updated.id} kini berstatus "${findStatusOption(SALES_ORDER_STATUSES, updated.status).label}".`, 'success')
  } catch (error) {
    showToast('Gagal Mengubah Status', isApiError(error) ? error.message : 'Server belum bisa dihubungi. Coba lagi.', 'error')
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <template v-if="!order">
      <PageHeader title="Sales Order Tidak Ditemukan" :breadcrumb="[{ label: 'Project', to: '/project-orders' }, { label: 'Not Found' }]" />
      <SectionCard>
        <EmptyState
          :icon="FileX"
          title="Sales Order tidak ditemukan"
          :description="`Sales Order dengan ID '${route.params.id}' tidak ada di data demo saat ini.`"
        >
          <Button @click="router.push('/project-orders')">
            Kembali ke Daftar
          </Button>
        </EmptyState>
      </SectionCard>
    </template>

    <RoleAccessState v-else-if="!hasAccess" module-label="modul Operations & Scheduling" />

    <template v-else>
      <PageHeader
        :title="`Sales Order ${order.id}`"
        :breadcrumb="[{ label: 'Project', to: '/project-orders' }, { label: order.id }]"
      >
        <template #actions>
          <StatusBadge :label="findStatusOption(SALES_ORDER_STATUSES, order.status).label" :tone="findStatusOption(SALES_ORDER_STATUSES, order.status).tone" />
        </template>
      </PageHeader>

      <SectionCard title="Ringkasan">
        <DetailMetadataList :items="summaryMetadata" />
        <p v-if="order.note" class="text-sm text-muted-foreground mt-4">
          {{ order.note }}
        </p>
      </SectionCard>

      <SectionCard v-if="canManageOrder && nextStatuses.length" title="Ubah Status">
        <div class="flex flex-wrap gap-2">
          <Button
            v-for="status in nextStatuses"
            :key="status"
            size="sm"
            :variant="status === 'cancelled' ? 'destructive' : 'default'"
            :disabled="isSaving"
            @click="advanceTo(status)"
          >
            {{ findStatusOption(SALES_ORDER_STATUSES, status).label }}
          </Button>
        </div>
        <p v-if="paidViaFinance" class="text-xs text-muted-foreground mt-3">
          Order menjadi Paid lewat konfirmasi DP/pembayaran di Finance, setelah uang benar-benar diterima.
        </p>
      </SectionCard>

      <SectionCard v-if="canConfirmDp" title="Pembayaran customer">
        <p class="text-sm text-muted-foreground">
          {{ order.projectId ? 'Booking Group Trip' : 'Order B2C mandiri' }} ditagih atas order ini (tanpa project tambahan). Konfirmasi DP membuat invoice dan mencatat uang masuk sekaligus.
        </p>
        <Button size="sm" class="mt-3" @click="confirmDpOpen = true">
          Konfirmasi DP
        </Button>
        <FinanceGroupTripDpDialog v-model:open="confirmDpOpen" :order="dpOrder" @confirmed="onDpConfirmed" />
      </SectionCard>

      <FinanceOrderCosts v-if="!order.projectId && session.can('finance.view-project-finance')" :sales-order-id="order.id" />
      <FinanceRefundCaseList v-if="order.projectId || !session.can('finance.view-project-finance')" :sales-order-id="order.id" />

      <ResponsiveFormSheet
        v-model:open="isCancelOpen"
        title="Batalkan Sales Order"
        description="Kursi Group Trip dibebaskan. Bila sudah ditagih, kasus pembatalan Finance dibuat dari invoice dan pembayaran yang sama; refund menunggu persetujuan dan pembayaran aktual."
        content-class="max-w-md"
      >
        <div class="space-y-1.5 py-2">
          <Label for="cancel-reason">Alasan (wajib)</Label>
          <Input id="cancel-reason" v-model="cancelReason" placeholder="mis. Peserta batal berangkat" />
        </div>
        <template #footer>
          <Button variant="outline" @click="isCancelOpen = false">
            Kembali
          </Button>
          <Button variant="destructive" :disabled="!cancelReason.trim() || isSaving" @click="advanceTo('cancelled', cancelReason.trim())">
            Batalkan Order
          </Button>
        </template>
      </ResponsiveFormSheet>
    </template>
  </div>
</template>
