<script setup lang="ts">
import { computed } from 'vue'
import { getRfqsForVendor, getRfqResponseByVendor, getProjectById } from '~/data'
import { RFQ_STATUSES, SERVICE_TYPES, findStatusOption } from '~/constants/status'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'RFQ Inbox' })

const { canView, vendorScopeId } = usePermissions()

/** Vendor isolation (Section 17, pola sama `/supplier/products`/`/supplier/orders`) — hanya RFQ yang mengundang `vendorScopeId`. */
const rows = computed(() => {
  if (!vendorScopeId.value) return []
  return getRfqsForVendor(vendorScopeId.value).map(rfq => ({
    rfq,
    project: rfq.projectId ? getProjectById(rfq.projectId) : undefined,
    myResponse: getRfqResponseByVendor(rfq.id, vendorScopeId.value!),
  }))
})
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="RFQ Inbox"
      description="RFQ yang mengundang company Anda — respons harga, klarifikasi, dan status seleksi."
      :breadcrumb="[{ label: 'Supplier Portal', to: '/supplier' }, { label: 'RFQ Inbox' }]"
    />

    <RoleAccessState v-if="!canView('supplier-portal') || !vendorScopeId" module-label="Supplier Portal" />

    <template v-else>
      <SectionCard>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Judul RFQ</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Jenis Layanan</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead>Respons Saya</TableHead>
              <TableHead>Status RFQ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="row in rows" :key="row.rfq.id" class="cursor-pointer hover:bg-muted/50" @click="navigateTo(`/supplier/rfq/${row.rfq.id}`)">
              <TableCell class="font-medium text-foreground">{{ row.rfq.title }}</TableCell>
              <TableCell class="text-muted-foreground">{{ row.project?.name ?? '—' }}</TableCell>
              <TableCell><StatusBadge :label="findStatusOption(SERVICE_TYPES, row.rfq.serviceType).label" :tone="findStatusOption(SERVICE_TYPES, row.rfq.serviceType).tone" /></TableCell>
              <TableCell class="text-muted-foreground">{{ row.rfq.dueAt ?? '—' }}</TableCell>
              <TableCell>
                <StatusBadge
                  v-if="row.myResponse"
                  :label="row.myResponse.status"
                  :tone="row.myResponse.status === 'selected' ? 'success' : row.myResponse.status === 'rejected' ? 'destructive' : 'info'"
                />
                <span v-else class="text-xs text-muted-foreground">Belum merespons</span>
              </TableCell>
              <TableCell><StatusBadge :label="findStatusOption(RFQ_STATUSES, row.rfq.status).label" :tone="findStatusOption(RFQ_STATUSES, row.rfq.status).tone" /></TableCell>
            </TableRow>
            <TableEmpty v-if="rows.length === 0" :colspan="6">Belum ada RFQ yang mengundang company Anda.</TableEmpty>
          </TableBody>
        </Table>
      </SectionCard>
    </template>
  </div>
</template>
