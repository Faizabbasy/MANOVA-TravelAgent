<script setup lang="ts">
import { computed } from 'vue'
import { Eye } from 'lucide-vue-next'
import { getRfqsForVendor, getRfqResponseByVendor, getProjectById } from '~/data'
import { RFQ_STATUSES, SERVICE_TYPES, findStatusOption } from '~/constants/status'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'RFQ Inbox' })

const { canView, vendorScopeId } = usePermissions()

/** Vendor isolation (Section 17, pola sama `/supplier/products`/`/supplier/orders`) — hanya RFQ yang mengundang `vendorScopeId`. */
const rows = computed(() => {
  if (!vendorScopeId.value) { return [] }
  return getRfqsForVendor(vendorScopeId.value).map(rfq => ({
    rfq,
    project: rfq.projectId ? getProjectById(rfq.projectId) : undefined,
    myResponse: getRfqResponseByVendor(rfq.id, vendorScopeId.value!)
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
        <ResponsiveDataView :items="rows" :get-key="row => row.rfq.id">
          <template #desktop="{ items }">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Judul RFQ</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Jenis Layanan</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Respons Saya</TableHead>
                  <TableHead>Status RFQ</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="row in items" :key="row.rfq.id" class="cursor-pointer hover:bg-muted/50" @click="navigateTo(`/supplier/rfq/${row.rfq.id}`)">
                  <TableCell class="font-medium text-foreground">
                    {{ row.rfq.title }}
                  </TableCell>
                  <TableCell class="text-muted-foreground">
                    {{ row.project?.name ?? '—' }}
                  </TableCell>
                  <TableCell><StatusBadge :label="findStatusOption(SERVICE_TYPES, row.rfq.serviceType).label" :tone="findStatusOption(SERVICE_TYPES, row.rfq.serviceType).tone" /></TableCell>
                  <TableCell class="text-muted-foreground">
                    {{ row.rfq.dueAt ?? '—' }}
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      v-if="row.myResponse"
                      :label="row.myResponse.status"
                      :tone="row.myResponse.status === 'selected' ? 'success' : row.myResponse.status === 'rejected' ? 'destructive' : 'info'"
                    />
                    <span v-else class="text-xs text-muted-foreground">Belum merespons</span>
                  </TableCell>
                  <TableCell><StatusBadge :label="findStatusOption(RFQ_STATUSES, row.rfq.status).label" :tone="findStatusOption(RFQ_STATUSES, row.rfq.status).tone" /></TableCell>
                  <TableCell>
                    <Eye class="h-4 w-4 text-muted-foreground" />
                  </TableCell>
                </TableRow>
                <TableEmpty v-if="rows.length === 0" :colspan="7">
                  Belum ada RFQ yang mengundang company Anda.
                </TableEmpty>
              </TableBody>
            </Table>
          </template>

          <template #mobile-card="{ item: row }">
            <button
              type="button"
              class="w-full rounded-xl border border-border bg-card p-4 text-left transition-colors active:bg-muted"
              @click="navigateTo(`/supplier/rfq/${row.rfq.id}`)"
            >
              <div class="flex items-start justify-between gap-2">
                <div class="min-w-0">
                  <p class="text-sm font-medium text-foreground truncate">
                    {{ row.rfq.title }}
                  </p>
                  <p class="text-xs text-muted-foreground">
                    {{ row.project?.name ?? '—' }}
                  </p>
                </div>
                <StatusBadge :label="findStatusOption(RFQ_STATUSES, row.rfq.status).label" :tone="findStatusOption(RFQ_STATUSES, row.rfq.status).tone" />
              </div>
              <div class="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p class="text-muted-foreground">
                    Jenis Layanan
                  </p>
                  <StatusBadge :label="findStatusOption(SERVICE_TYPES, row.rfq.serviceType).label" :tone="findStatusOption(SERVICE_TYPES, row.rfq.serviceType).tone" />
                </div>
                <div>
                  <p class="text-muted-foreground">
                    Due Date
                  </p>
                  <p class="text-foreground">
                    {{ row.rfq.dueAt ?? '—' }}
                  </p>
                </div>
                <div>
                  <p class="text-muted-foreground">
                    Respons Saya
                  </p>
                  <StatusBadge
                    v-if="row.myResponse"
                    :label="row.myResponse.status"
                    :tone="row.myResponse.status === 'selected' ? 'success' : row.myResponse.status === 'rejected' ? 'destructive' : 'info'"
                  />
                  <span v-else class="text-muted-foreground">Belum merespons</span>
                </div>
              </div>
            </button>
          </template>
        </ResponsiveDataView>
      </SectionCard>
    </template>
  </div>
</template>
