<script setup lang="ts">
import { computed } from 'vue'
import { getServiceOrdersByVendor, getProjectById } from '~/data'
import { SERVICE_ORDER_STATUSES, findStatusOption } from '~/constants/status'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Service Order Inbox' })

const { canView, vendorScopeId } = usePermissions()

/** Vendor isolation (Section 17) — hanya Service Order milik `vendorScopeId`. */
const rows = computed(() => {
  if (!vendorScopeId.value) return []
  return getServiceOrdersByVendor(vendorScopeId.value).map(so => ({ so, project: so.projectId ? getProjectById(so.projectId) : undefined }))
})
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Service Order Inbox"
      description="Service Order untuk company Anda — acknowledge, update fulfillment, dan ajukan invoice."
      :breadcrumb="[{ label: 'Supplier Portal', to: '/supplier' }, { label: 'Service Orders' }]"
    />

    <RoleAccessState v-if="!canView('supplier-portal') || !vendorScopeId" module-label="Supplier Portal" />

    <template v-else>
      <SectionCard>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Project</TableHead>
              <TableHead>RFQ Asal</TableHead>
              <TableHead>Line Items</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="row in rows" :key="row.so.id" class="cursor-pointer hover:bg-muted/50" @click="navigateTo(`/supplier/service-orders/${row.so.id}`)">
              <TableCell class="font-medium text-foreground">{{ row.project?.name ?? '— (engagement langsung)' }}</TableCell>
              <TableCell class="text-muted-foreground">{{ row.so.rfqId ?? '—' }}</TableCell>
              <TableCell class="text-muted-foreground">{{ row.so.lineItems.length }} item</TableCell>
              <TableCell><StatusBadge :label="findStatusOption(SERVICE_ORDER_STATUSES, row.so.status).label" :tone="findStatusOption(SERVICE_ORDER_STATUSES, row.so.status).tone" /></TableCell>
            </TableRow>
            <TableEmpty v-if="rows.length === 0" :colspan="4">Belum ada Service Order untuk company Anda.</TableEmpty>
          </TableBody>
        </Table>
      </SectionCard>
    </template>
  </div>
</template>
