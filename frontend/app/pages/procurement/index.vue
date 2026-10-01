<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Search, Plus, ClipboardList, FileText, CheckCircle2, Clock, Eye } from 'lucide-vue-next'
import { RFQS, SERVICE_ORDERS, PROJECTS, getProjectById, getVendorById, createRfq } from '~/data'
import { RFQ_STATUSES, SERVICE_ORDER_STATUSES, SERVICE_TYPES, findStatusOption } from '~/constants/status'
import type { ServiceTypeKey } from '~/types/project'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Procurement' })

const route = useRoute()
const router = useRouter()
const { currentUser } = useCurrentUser()
const { canView, canManage } = usePermissions()
const canManageProcurement = computed(() => canManage('procurement'))

const activeTab = computed<'rfq' | 'service-orders'>({
  get: () => (route.query.tab === 'service-orders' ? 'service-orders' : 'rfq'),
  set: value => router.replace({ query: { ...route.query, tab: value } })
})

/* Quick stats */
const openRfqCount = computed(() => RFQS.filter(rfq => !['closed'].includes(rfq.status)).length)
const closedRfqCount = computed(() => RFQS.filter(rfq => rfq.status === 'closed').length)
const activeServiceOrderCount = computed(() => SERVICE_ORDERS.filter(so => !['fulfilled', 'cancelled'].includes(so.status)).length)
const fulfilledServiceOrderCount = computed(() => SERVICE_ORDERS.filter(so => so.status === 'fulfilled').length)

/** Versi ringkas 4 stat di atas, dipakai strip horizontal-scroll mobile — semua nilainya angka pendek jadi
 * aman dipadatkan (beda dari kartu bernilai currency/ID panjang yang wajib grid-cols-1 di mobile). */
const countTiles = computed(() => [
  { key: 'rfq-active', label: 'RFQ Aktif', value: String(openRfqCount.value), icon: ClipboardList, tone: 'primary' as const },
  { key: 'rfq-closed', label: 'RFQ Closed', value: String(closedRfqCount.value), icon: CheckCircle2, tone: 'success' as const },
  { key: 'so-active', label: 'SO Aktif', value: String(activeServiceOrderCount.value), icon: Clock, tone: 'warning' as const },
  { key: 'so-fulfilled', label: 'SO Fulfilled', value: String(fulfilledServiceOrderCount.value), icon: FileText, tone: 'success' as const }
])

/* RFQ list */
const rfqSearch = ref('')
const rfqStatusFilter = ref('all')
const rfqRows = computed(() => {
  let result = RFQS.map(rfq => ({ rfq, project: rfq.projectId ? getProjectById(rfq.projectId) : undefined }))
  if (rfqStatusFilter.value !== 'all') { result = result.filter(row => row.rfq.status === rfqStatusFilter.value) }
  if (rfqSearch.value.trim()) {
    const q = rfqSearch.value.toLowerCase()
    result = result.filter(row => row.rfq.title.toLowerCase().includes(q) || (row.project?.name ?? '').toLowerCase().includes(q))
  }
  return result.sort((a, b) => b.rfq.createdAt.localeCompare(a.rfq.createdAt))
})

/* Service Order list */
const soSearch = ref('')
const soStatusFilter = ref('all')
const soRows = computed(() => {
  let result = SERVICE_ORDERS.map(so => ({ so, project: so.projectId ? getProjectById(so.projectId) : undefined, vendor: getVendorById(so.vendorId) }))
  if (soStatusFilter.value !== 'all') { result = result.filter(row => row.so.status === soStatusFilter.value) }
  if (soSearch.value.trim()) {
    const q = soSearch.value.toLowerCase()
    result = result.filter(row => (row.vendor?.name ?? '').toLowerCase().includes(q) || (row.project?.name ?? '').toLowerCase().includes(q))
  }
  return result.sort((a, b) => b.so.createdAt.localeCompare(a.so.createdAt))
})

/* Buat RFQ baru */
const isCreateOpen = ref(false)
const newTitle = ref('')
const newProjectId = ref('')
const newServiceType = ref<ServiceTypeKey>('hotel')
const newDueAt = ref('')
const newNotes = ref('')
const newLineDescription = ref('')
const newLineQuantity = ref<number | null>(null)
const newLineUnit = ref('')

function resetCreateForm () {
  newTitle.value = ''
  newProjectId.value = ''
  newServiceType.value = 'hotel'
  newDueAt.value = ''
  newNotes.value = ''
  newLineDescription.value = ''
  newLineQuantity.value = null
  newLineUnit.value = ''
}

function submitCreate () {
  if (!newTitle.value.trim() || !newLineDescription.value.trim() || !newLineQuantity.value) { return }
  const rfq = createRfq({
    title: newTitle.value.trim(),
    projectId: newProjectId.value || undefined,
    serviceType: newServiceType.value,
    lineItems: [{ description: newLineDescription.value.trim(), quantity: newLineQuantity.value, unit: newLineUnit.value.trim() || 'unit' }],
    dueAt: newDueAt.value || undefined,
    notes: newNotes.value.trim() || undefined,
    createdBy: currentUser.value.id
  })
  resetCreateForm()
  isCreateOpen.value = false
  navigateTo(`/procurement/rfq/${rfq.id}`)
}
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Procurement"
      description="RFQ formal, comparison, clarification, seleksi vendor, Service Order, dan Procurement Performance Review."
      :breadcrumb="[{ label: 'Procurement' }]"
    >
      <template v-if="canManageProcurement && activeTab === 'rfq'" #actions>
        <ResponsiveFormSheet
          v-model:open="isCreateOpen"
          title="RFQ Baru"
          description="Dibuat sebagai status &quot;Draft&quot; — undang vendor dan lengkapi line item lain di halaman detail."
          content-class="max-w-lg"
          scroll
        >
          <template #trigger>
            <Button><Plus class="h-4 w-4 mr-1.5" />Buat RFQ</Button>
          </template>
          <div class="space-y-4 py-2">
              <div class="space-y-1.5">
                <Label for="rfq-title">Judul RFQ</Label>
                <Input id="rfq-title" v-model="newTitle" placeholder="mis. RFQ Akomodasi Tambahan" />
              </div>
              <div class="space-y-1.5">
                <Label for="rfq-project">Project (opsional)</Label>
                <select id="rfq-project" v-model="newProjectId" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                  <option value="">
                    Belum terhubung ke project
                  </option>
                  <option v-for="project in PROJECTS" :key="project.id" :value="project.id">
                    {{ project.name }}
                  </option>
                </select>
              </div>
              <div class="space-y-1.5">
                <Label for="rfq-service-type">Jenis Layanan</Label>
                <select id="rfq-service-type" v-model="newServiceType" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                  <option v-for="type in SERVICE_TYPES" :key="type.value" :value="type.value">
                    {{ type.label }}
                  </option>
                </select>
              </div>
              <div class="grid grid-cols-3 gap-2">
                <div class="col-span-2 space-y-1.5">
                  <Label for="rfq-line-desc">Kebutuhan (Line Item)</Label>
                  <Input id="rfq-line-desc" v-model="newLineDescription" placeholder="mis. Kamar Twin tambahan" />
                </div>
                <div class="space-y-1.5">
                  <Label for="rfq-line-qty">Qty</Label>
                  <Input id="rfq-line-qty" v-model.number="newLineQuantity" type="number" />
                </div>
              </div>
              <div class="space-y-1.5">
                <Label for="rfq-line-unit">Unit</Label>
                <Input id="rfq-line-unit" v-model="newLineUnit" placeholder="mis. kamar/malam, trip, paket" />
              </div>
              <div class="space-y-1.5">
                <Label for="rfq-due">Due Date (opsional)</Label>
                <Input id="rfq-due" v-model="newDueAt" type="date" />
              </div>
              <div class="space-y-1.5">
                <Label for="rfq-notes">Catatan (opsional)</Label>
                <Input id="rfq-notes" v-model="newNotes" />
              </div>
          </div>
          <template #footer>
            <Button variant="outline" @click="isCreateOpen = false">
              Batal
            </Button>
            <Button :disabled="!newTitle.trim() || !newLineDescription.trim() || !newLineQuantity" @click="submitCreate">
              Simpan
            </Button>
          </template>
        </ResponsiveFormSheet>
      </template>
    </PageHeader>

    <RoleAccessState v-if="!canView('procurement')" module-label="modul Procurement" />

    <template v-else>
      <div class="hidden sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="RFQ Aktif" :value="String(openRfqCount)" :icon="ClipboardList" />
        <StatsCard title="RFQ Closed" :value="String(closedRfqCount)" :icon="CheckCircle2" icon-color="success" />
        <StatsCard title="Service Order Aktif" :value="String(activeServiceOrderCount)" :icon="Clock" icon-color="warning" />
        <StatsCard title="Service Order Fulfilled" :value="String(fulfilledServiceOrderCount)" :icon="FileText" icon-color="success" />
      </div>

      <!-- Mobile: strip horizontal-scroll, nilai semuanya angka pendek jadi aman dipadatkan (StatsCard size="sm") -->
      <div class="sm:hidden -mx-1 grid grid-flow-col auto-cols-[minmax(110px,1fr)] gap-2 overflow-x-auto px-1 pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <StatsCard
          v-for="tile in countTiles"
          :key="tile.key"
          size="sm"
          :title="tile.label"
          :value="tile.value"
          :icon="tile.icon"
          :icon-color="tile.tone"
        />
      </div>

      <Tabs v-model="activeTab">
        <TabsList>
          <TabsTrigger value="rfq">
            RFQ
          </TabsTrigger>
          <TabsTrigger value="service-orders">
            Service Orders
          </TabsTrigger>
        </TabsList>

        <TabsContent value="rfq">
          <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-4">
            <div class="relative flex-1 max-w-sm w-full">
              <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input v-model="rfqSearch" placeholder="Cari judul RFQ atau project..." class="pl-9" />
            </div>
            <select v-model="rfqStatusFilter" class="appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
              <option value="all">
                Semua Status
              </option>
              <option v-for="option in RFQ_STATUSES" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </div>
          <SectionCard>
            <ResponsiveDataView :items="rfqRows" :get-key="row => row.rfq.id">
              <template #desktop="{ items }">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Judul RFQ</TableHead>
                      <TableHead>Project</TableHead>
                      <TableHead>Jenis Layanan</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow v-for="row in items" :key="row.rfq.id" class="cursor-pointer hover:bg-muted/50" @click="navigateTo(`/procurement/rfq/${row.rfq.id}`)">
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
                      <TableCell><StatusBadge :label="findStatusOption(RFQ_STATUSES, row.rfq.status).label" :tone="findStatusOption(RFQ_STATUSES, row.rfq.status).tone" /></TableCell>
                      <TableCell>
                        <Eye class="h-4 w-4 text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                    <TableEmpty v-if="rfqRows.length === 0" :colspan="6">
                      {{ rfqSearch || rfqStatusFilter !== 'all' ? 'Tidak ada RFQ yang cocok dengan filter.' : 'Belum ada RFQ.' }}
                    </TableEmpty>
                  </TableBody>
                </Table>
              </template>

              <template #mobile-card="{ item: row }">
                <button
                  type="button"
                  class="w-full rounded-xl border border-border bg-card p-4 text-left transition-colors active:bg-muted"
                  @click="navigateTo(`/procurement/rfq/${row.rfq.id}`)"
                >
                  <div class="flex items-start justify-between gap-2">
                    <p class="text-sm font-medium text-foreground truncate">
                      {{ row.rfq.title }}
                    </p>
                    <StatusBadge :label="findStatusOption(RFQ_STATUSES, row.rfq.status).label" :tone="findStatusOption(RFQ_STATUSES, row.rfq.status).tone" />
                  </div>
                  <div class="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p class="text-muted-foreground">
                        Project
                      </p>
                      <p class="text-foreground">
                        {{ row.project?.name ?? '—' }}
                      </p>
                    </div>
                    <div>
                      <p class="text-muted-foreground">
                        Jenis Layanan
                      </p>
                      <p class="text-foreground">
                        {{ findStatusOption(SERVICE_TYPES, row.rfq.serviceType).label }}
                      </p>
                    </div>
                    <div>
                      <p class="text-muted-foreground">
                        Due Date
                      </p>
                      <p class="text-foreground">
                        {{ row.rfq.dueAt ?? '—' }}
                      </p>
                    </div>
                  </div>
                </button>
              </template>
            </ResponsiveDataView>
          </SectionCard>
        </TabsContent>

        <TabsContent value="service-orders">
          <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-4">
            <div class="relative flex-1 max-w-sm w-full">
              <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input v-model="soSearch" placeholder="Cari vendor atau project..." class="pl-9" />
            </div>
            <select v-model="soStatusFilter" class="appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
              <option value="all">
                Semua Status
              </option>
              <option v-for="option in SERVICE_ORDER_STATUSES" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </div>
          <SectionCard>
            <ResponsiveDataView :items="soRows" :get-key="row => row.so.id">
              <template #desktop="{ items }">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vendor</TableHead>
                      <TableHead>Project</TableHead>
                      <TableHead>RFQ Asal</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow v-for="row in items" :key="row.so.id" class="cursor-pointer hover:bg-muted/50" @click="navigateTo(`/procurement/service-orders/${row.so.id}`)">
                      <TableCell class="font-medium text-foreground">
                        {{ row.vendor?.name ?? row.so.vendorId }}
                      </TableCell>
                      <TableCell class="text-muted-foreground">
                        {{ row.project?.name ?? '—' }}
                      </TableCell>
                      <TableCell class="text-muted-foreground">
                        {{ row.so.rfqId ?? '— (engagement langsung)' }}
                      </TableCell>
                      <TableCell><StatusBadge :label="findStatusOption(SERVICE_ORDER_STATUSES, row.so.status).label" :tone="findStatusOption(SERVICE_ORDER_STATUSES, row.so.status).tone" /></TableCell>
                      <TableCell>
                        <Eye class="h-4 w-4 text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                    <TableEmpty v-if="soRows.length === 0" :colspan="5">
                      {{ soSearch || soStatusFilter !== 'all' ? 'Tidak ada Service Order yang cocok dengan filter.' : 'Belum ada Service Order.' }}
                    </TableEmpty>
                  </TableBody>
                </Table>
              </template>

              <template #mobile-card="{ item: row }">
                <button
                  type="button"
                  class="w-full rounded-xl border border-border bg-card p-4 text-left transition-colors active:bg-muted"
                  @click="navigateTo(`/procurement/service-orders/${row.so.id}`)"
                >
                  <div class="flex items-start justify-between gap-2">
                    <p class="text-sm font-medium text-foreground truncate">
                      {{ row.vendor?.name ?? row.so.vendorId }}
                    </p>
                    <StatusBadge :label="findStatusOption(SERVICE_ORDER_STATUSES, row.so.status).label" :tone="findStatusOption(SERVICE_ORDER_STATUSES, row.so.status).tone" />
                  </div>
                  <div class="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p class="text-muted-foreground">
                        Project
                      </p>
                      <p class="text-foreground">
                        {{ row.project?.name ?? '—' }}
                      </p>
                    </div>
                    <div>
                      <p class="text-muted-foreground">
                        RFQ Asal
                      </p>
                      <p class="text-foreground">
                        {{ row.so.rfqId ?? '— (engagement langsung)' }}
                      </p>
                    </div>
                  </div>
                </button>
              </template>
            </ResponsiveDataView>
          </SectionCard>
        </TabsContent>
      </Tabs>
    </template>
  </div>
</template>
