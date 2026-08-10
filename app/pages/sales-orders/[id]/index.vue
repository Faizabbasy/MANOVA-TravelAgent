<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { FileX } from 'lucide-vue-next'
import { getSalesOrderById, getPartyById, updateSalesOrderStatus, getSalesOrderStatusTransitions } from '~/data'
import { SALES_ORDER_STATUSES, findStatusOption } from '~/constants/status'
import { formatCurrencyIdr, formatDateRange, formatDate } from '~/utils/format'
import type { SalesOrderStatus } from '~/types/sales-order'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const route = useRoute()
const router = useRouter()
const { canView, canManage } = usePermissions()
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
    { label: 'Dibuat', value: formatDate(order.value.createdAt) }
  ]
})

const nextStatuses = computed(() => (order.value ? getSalesOrderStatusTransitions(order.value.status) : []))

function advanceTo (status: SalesOrderStatus) {
  if (!order.value) { return }
  updateSalesOrderStatus(order.value.id, status)
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
            @click="advanceTo(status)"
          >
            {{ findStatusOption(SALES_ORDER_STATUSES, status).label }}
          </Button>
        </div>
      </SectionCard>
    </template>
  </div>
</template>
