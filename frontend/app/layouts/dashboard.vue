<script setup lang="ts">
import { useCustomersSync } from '~/data/parties-sync'
import { useProjectsSync } from '~/data/projects-sync'
import { useVendorsSync } from '~/data/vendors-sync'
import { useBookingsSync } from '~/data/bookings-sync'
import { useProcurementSync } from '~/data/procurement-sync'
import { useLeadsSync } from '~/data/leads-sync'

const isMobile = useIsMobile()
/** Project (S3a/S3b), customer (S1), vendor (S2), layanan & booking (S4a), quotation & service order (S4b), serta lead & quotation client (S6a) milik server: dimuat sekali per user yang login ke array lokal. */
const projectsSync = useProjectsSync()
const customersSync = useCustomersSync()
const vendorsSync = useVendorsSync()
const bookingsSync = useBookingsSync()
const procurementSync = useProcurementSync()
const leadsSync = useLeadsSync()
const { currentUser } = useCurrentUser()
/** Lead & quotation (S6a) are internal: the (hidden) portals get 403, so they are not loaded there. */
const loadLeads = (force: boolean) => { if (!['client', 'vendor'].includes(currentUser.value.role)) { leadsSync.load(force) } }
const loadServerData = (force = false) => { projectsSync.load(force); customersSync.load(force); vendorsSync.load(force); bookingsSync.load(force); procurementSync.load(force); loadLeads(force) }
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
    failed(leadsSync.state.value) ? 'lead & quotation client' : null
  ].filter(Boolean)
  return parts.length ? parts.join(', ') : null
})
const unsyncedMessage = computed(() => projectsSync.state.value.message ?? customersSync.state.value.message ?? vendorsSync.state.value.message ?? bookingsSync.state.value.message ?? procurementSync.state.value.message ?? leadsSync.state.value.message)
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
