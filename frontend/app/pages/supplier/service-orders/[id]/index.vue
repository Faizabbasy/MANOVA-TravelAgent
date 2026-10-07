<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { FileX } from 'lucide-vue-next'
import { getServiceOrderById, getServiceOrderAmendments, updateServiceOrderStatus, getProjectById } from '~/data'
import { isServerServiceOrder, reloadServiceOrder, runServiceOrderStatusChange } from '~/data/procurement-sync'
import type { ServiceOrderStatus } from '~/types/procurement'
import { isApiError } from '~/lib/api/errors'
import { SERVICE_ORDER_STATUSES, findStatusOption } from '~/constants/status'
import { formatCurrencyIdr, formatDate } from '~/utils/format'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const route = useRoute()
const router = useRouter()
const { currentUser } = useCurrentUser()
const { canView, vendorScopeId } = usePermissions()
const { showToast } = useToast()

const serviceOrder = computed(() => getServiceOrderById(String(route.params.id)))
useHead({ title: computed(() => serviceOrder.value ? `Service Order ${serviceOrder.value.id}` : 'Service Order Tidak Ditemukan') })

/** Vendor isolation (Section 17) — hanya dapat diakses bila Service Order ini milik `vendorScopeId`. */
const isOwn = computed(() => !!serviceOrder.value && !!vendorScopeId.value && serviceOrder.value.vendorId === vendorScopeId.value)

const project = computed(() => (serviceOrder.value?.projectId ? getProjectById(serviceOrder.value.projectId) : undefined))
const amendments = computed(() => (serviceOrder.value ? getServiceOrderAmendments(serviceOrder.value.id) : []))

/** "Acknowledge a sent Service Order" (Wajib) — hanya dari status `sent`. */
const soApi = useApi()
// S5: Finance may have recorded or reviewed a vendor invoice since the app loaded — take the order fresh on open.
onMounted(() => {
  const id = String(route.params.id)
  // A local RFQ order (SO-L…) is not on the server: its 404 is ignored.
  if (!id.startsWith('SO-L')) { reloadServiceOrder(soApi, id).catch(() => undefined) }
})
const isSavingOrder = ref(false)
/** Server first (S4b); the local mutator then only adds its activity entry. Returns false when the server refused. */
async function changeOrderStatus (to: ServiceOrderStatus, reason?: string): Promise<boolean> {
  const current = serviceOrder.value
  if (!current || isSavingOrder.value) { return false }
  // Orders created from an RFQ are still local until procurement moves to the server (S5).
  if (!isServerServiceOrder(current.id)) { return updateServiceOrderStatus(current.id, to, currentUser.value.id, reason) !== undefined }
  isSavingOrder.value = true
  try {
    await runServiceOrderStatusChange(soApi, current.id, to, reason, () => updateServiceOrderStatus(current.id, to, currentUser.value.id, reason))
    return true
  } catch (error) {
    showToast('Status Service Order Gagal Diubah', isApiError(error) ? error.message : 'Server belum bisa dihubungi. Coba lagi.', 'error')
    return false
  } finally {
    isSavingOrder.value = false
  }
}
async function acknowledge () {
  if (!serviceOrder.value) { return }
  if (await changeOrderStatus('acknowledged')) { showToast('Service Order Diakui', 'Service Order berhasil diakui (acknowledged).', 'success') }
}

/** "Update fulfillment status" (Wajib) — dari `acknowledged`/`amended` ke `fulfilled`. */
async function markFulfilled () {
  if (!serviceOrder.value) { return }
  if (await changeOrderStatus('fulfilled')) { showToast('Fulfillment Diperbarui', 'Service Order kini berstatus "Fulfilled".', 'success') }
}

</script>

<template>
  <div class="space-y-6">
    <template v-if="!serviceOrder || !isOwn">
      <PageHeader title="Service Order Tidak Ditemukan" :breadcrumb="[{ label: 'Supplier Portal', to: '/supplier' }, { label: 'Service Orders', to: '/supplier/orders#service-orders' }, { label: 'Not Found' }]" />
      <SectionCard>
        <EmptyState :icon="FileX" title="Service Order tidak ditemukan" :description="`Service Order dengan ID '${route.params.id}' tidak ada atau bukan milik company Anda.`">
          <Button @click="router.push('/supplier/orders#service-orders')">
            Kembali ke Service Order Inbox
          </Button>
        </EmptyState>
      </SectionCard>
    </template>

    <RoleAccessState v-else-if="!canView('supplier-portal') || !vendorScopeId" module-label="Supplier Portal" />

    <template v-else>
      <PageHeader :title="`Service Order ${serviceOrder.id}`" :breadcrumb="[{ label: 'Supplier Portal', to: '/supplier' }, { label: 'Service Orders', to: '/supplier/orders#service-orders' }, { label: serviceOrder.id }]">
        <template #actions>
          <div class="flex flex-wrap items-center gap-2">
            <StatusBadge :label="findStatusOption(SERVICE_ORDER_STATUSES, serviceOrder.status).label" :tone="findStatusOption(SERVICE_ORDER_STATUSES, serviceOrder.status).tone" />
            <Button v-if="serviceOrder.status === 'sent'" size="sm" @click="acknowledge">
              Acknowledge
            </Button>
            <Button v-if="['acknowledged', 'amended'].includes(serviceOrder.status)" size="sm" variant="outline" @click="markFulfilled">
              Tandai Fulfilled
            </Button>
          </div>
        </template>
      </PageHeader>

      <SectionCard>
        <DetailMetadataList
          :items="[
            { label: 'Project', value: project?.name ?? '— (engagement langsung)' },
            { label: 'RFQ Asal', value: serviceOrder.rfqId ?? '— (engagement langsung)' },
            { label: 'Diakui', value: serviceOrder.acknowledgedAt ? formatDate(serviceOrder.acknowledgedAt) : 'Belum' },
            { label: 'Fulfilled', value: serviceOrder.fulfilledAt ? formatDate(serviceOrder.fulfilledAt) : 'Belum' },
          ]"
        />
      </SectionCard>

      <SectionCard title="Line Items">
        <ResponsiveDataView :items="serviceOrder.lineItems" :get-key="(item, index) => index">
          <template #desktop="{ items }">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Deskripsi</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Sell Price</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="(item, index) in items" :key="index">
                  <TableCell class="text-foreground">
                    {{ item.description }}
                  </TableCell>
                  <TableCell class="text-muted-foreground">
                    {{ item.quantity }}
                  </TableCell>
                  <TableCell class="text-muted-foreground">
                    {{ item.unit }}
                  </TableCell>
                  <TableCell class="text-foreground">
                    {{ index === 0 && serviceOrder.sellPriceIdr !== undefined ? formatCurrencyIdr(serviceOrder.sellPriceIdr) : '—' }}
                  </TableCell>
                </TableRow>
                <TableEmpty v-if="serviceOrder.lineItems.length === 0" :colspan="4">
                  Belum ada line item.
                </TableEmpty>
              </TableBody>
            </Table>
          </template>

          <template #mobile-card="{ item, index }">
            <div class="rounded-xl border border-border bg-card p-4">
              <p class="text-sm font-medium text-foreground">
                {{ item.description }}
              </p>
              <div class="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p class="text-muted-foreground">
                    Qty
                  </p>
                  <p class="text-foreground">
                    {{ item.quantity }}
                  </p>
                </div>
                <div>
                  <p class="text-muted-foreground">
                    Unit
                  </p>
                  <p class="text-foreground">
                    {{ item.unit }}
                  </p>
                </div>
                <div>
                  <p class="text-muted-foreground">
                    Sell Price
                  </p>
                  <p class="text-foreground">
                    {{ index === 0 && serviceOrder.sellPriceIdr !== undefined ? formatCurrencyIdr(serviceOrder.sellPriceIdr) : '—' }}
                  </p>
                </div>
              </div>
            </div>
          </template>
        </ResponsiveDataView>
        <p class="mt-2 text-xs text-muted-foreground">
          Internal cost/margin MANOVA tidak ditampilkan di Supplier Portal — hanya sell price (nilai yang disepakati dengan company Anda).
        </p>
      </SectionCard>

      <SectionCard title="Amendment History">
        <ul v-if="amendments.length" class="divide-y divide-border">
          <li v-for="amendment in amendments" :key="amendment.id" class="py-2">
            <p class="text-sm text-foreground">
              {{ amendment.reason }}
            </p>
            <p class="text-xs text-muted-foreground">
              {{ formatDate(amendment.changedAt) }}
            </p>
          </li>
        </ul>
        <EmptyState v-else title="Belum ada amendment tercatat" />
      </SectionCard>

      <!-- S5: invoices go to MANOVA Finance (Utang Vendor) as documents; here only what Finance recorded for this order. -->
      <ServiceOrderVendorInvoices :invoices="serviceOrder.vendorInvoices ?? []" />
    </template>
  </div>
</template>
