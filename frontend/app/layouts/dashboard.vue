<script setup lang="ts">
import { useCustomersSync } from '~/data/parties-sync'
import { useProjectsSync } from '~/data/projects-sync'
import { useVendorsSync } from '~/data/vendors-sync'
import { useBookingsSync } from '~/data/bookings-sync'
import { useProcurementSync } from '~/data/procurement-sync'
import { useLeadsSync } from '~/data/leads-sync'
import { useSalesOrdersSync } from '~/data/sales-orders-sync'
import { useTravelersSync } from '~/data/travelers-sync'
import { useItinerarySync } from '~/data/itinerary-sync'
import { useWorkItemsSync } from '~/data/work-items-sync'
import { useActivitySync } from '~/data/activity-sync'
import { useChangesSync } from '~/data/changes-sync'
import { useDocumentsSync } from '~/data/documents-sync'
import { useNotificationsSync } from '~/data/notifications-sync'
import { useUsersSync } from '~/data/users-sync'
import { useMasterDataSync } from '~/data/master-data-sync'
import { useInventorySync } from '~/data/inventory-sync'
import { useMarketingSync } from '~/data/marketing-sync'
import { useHrSync } from '~/data/hr-sync'
import { syncPlanFor, type SyncKey } from '~/data/sync-plan'
import { useClientCommerceSync } from '~/data/client-commerce-sync'
import { useVendorPortalSync } from '~/data/vendor-portal-sync'

const isMobile = useIsMobile()
/** Project (S3a/S3b), customer (S1), vendor (S2), layanan & booking (S4a), quotation & service order (S4b), serta lead & quotation client (S6a) milik server: dimuat sekali per user yang login ke array lokal. */
const projectsSync = useProjectsSync()
const customersSync = useCustomersSync()
const vendorsSync = useVendorsSync()
const bookingsSync = useBookingsSync()
const procurementSync = useProcurementSync()
const leadsSync = useLeadsSync()
const salesOrdersSync = useSalesOrdersSync()
const travelersSync = useTravelersSync()
const itinerarySync = useItinerarySync()
const workItemsSync = useWorkItemsSync()
const activitySync = useActivitySync()
const changesSync = useChangesSync()
const documentsSync = useDocumentsSync()
const notificationsSync = useNotificationsSync()
const usersSync = useUsersSync()
const masterDataSync = useMasterDataSync()
const inventorySync = useInventorySync()
const marketingSync = useMarketingSync()
const hrSync = useHrSync()
const clientCommerceSync = useClientCommerceSync()
const vendorPortalSync = useVendorPortalSync()
const { currentUser } = useCurrentUser()
/**
 * Which server data each role loads (`syncPlanFor`, S12a): internal roles load every module; a portal user only what its
 * portal may read — the internal lists answer 403 for it and would raise a lasting banner or overwrite portal data.
 */
const SYNCS: Record<SyncKey, { load: (force?: boolean) => unknown }> = {
  projects: projectsSync,
  customers: customersSync,
  vendors: vendorsSync,
  bookings: bookingsSync,
  procurement: procurementSync,
  leads: leadsSync,
  salesOrders: salesOrdersSync,
  travelers: travelersSync,
  itinerary: itinerarySync,
  workItems: workItemsSync,
  activity: activitySync,
  changes: changesSync,
  documents: documentsSync,
  notifications: notificationsSync,
  users: usersSync,
  masterData: masterDataSync,
  inventory: inventorySync,
  marketing: marketingSync,
  hr: hrSync,
  clientCommerce: clientCommerceSync,
  vendorPortal: vendorPortalSync
}
const loadServerData = (force = false) => {
  // Before the internal syncs: a client session that ended on this tab gives the shared lists back first.
  if (currentUser.value.role !== 'client') { clientCommerceSync.reset() }
  for (const key of syncPlanFor(currentUser.value.role)) { SYNCS[key].load(force) }
}
onMounted(() => { loadServerData() })
watch(() => currentUser.value.id, () => { loadServerData() })

const unsyncedLabel = computed(() => {
  const failed = (s: { status: string }) => s.status === 'offline' || s.status === 'error'
  const parts = [
    failed(projectsSync.state.value) ? 'project' : null,
    failed(customersSync.state.value) ? 'customer' : null,
    failed(vendorsSync.state.value) ? 'vendor' : null,
    failed(bookingsSync.state.value) ? 'layanan & booking' : null,
    failed(procurementSync.state.value) ? 'quotation & service order' : null,
    failed(leadsSync.state.value) ? 'lead & quotation client' : null,
    failed(salesOrdersSync.state.value) ? 'sales order' : null,
    failed(travelersSync.state.value) ? 'peserta' : null,
    failed(itinerarySync.state.value) ? 'itinerary' : null,
    failed(workItemsSync.state.value) ? 'task & milestone' : null,
    failed(activitySync.state.value) ? 'log aktivitas' : null,
    failed(changesSync.state.value) ? 'change request & insiden' : null,
    failed(documentsSync.state.value) ? 'dokumen & pesan' : null
  ].filter(Boolean)
  return parts.length ? parts.join(', ') : null
})
const unsyncedMessage = computed(() => projectsSync.state.value.message ?? customersSync.state.value.message ?? vendorsSync.state.value.message ?? bookingsSync.state.value.message ?? procurementSync.state.value.message ?? leadsSync.state.value.message ?? salesOrdersSync.state.value.message ?? travelersSync.state.value.message ?? itinerarySync.state.value.message ?? workItemsSync.state.value.message ?? activitySync.state.value.message ?? changesSync.state.value.message ?? documentsSync.state.value.message)
</script>

<template>
  <div class="min-h-screen flex w-full bg-background">
    <!-- Keyboard users reach the page without tabbing through the whole sidebar first. -->
    <a
      href="#konten"
      class="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[10000] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
    >
      Lewati ke konten
    </a>
    <AppSidebar />
    <div class="flex-1 flex flex-col min-w-0">
      <TopHeader />
      <main
        id="konten"
        tabindex="-1"
        class="flex-1 overflow-auto p-4 md:p-6 outline-none"
        :class="isMobile ? 'pb-[calc(5rem+env(safe-area-inset-bottom))]' : ''"
      >
        <div
          v-if="unsyncedLabel"
          role="status"
          class="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100"
        >
          <span>Daftar {{ unsyncedLabel }} belum tersinkron dengan server — yang tampil data lokal. {{ unsyncedMessage }}</span>
          <Button size="sm" variant="outline" @click="loadServerData(true)">
            Coba lagi
          </Button>
        </div>
        <slot />
      </main>
    </div>
    <MobileBottomNav v-if="isMobile" />
    <ToastContainer />
  </div>
</template>
