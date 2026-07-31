<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Search, Plus, ClipboardList, FileText, CheckCircle2, Clock } from 'lucide-vue-next'
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
  set: value => router.replace({ query: { ...route.query, tab: value } }),
})

/* Quick stats */
const openRfqCount = computed(() => RFQS.filter(rfq => !['closed'].includes(rfq.status)).length)
const closedRfqCount = computed(() => RFQS.filter(rfq => rfq.status === 'closed').length)
const activeServiceOrderCount = computed(() => SERVICE_ORDERS.filter(so => !['fulfilled', 'cancelled'].includes(so.status)).length)
const fulfilledServiceOrderCount = computed(() => SERVICE_ORDERS.filter(so => so.status === 'fulfilled').length)

/* RFQ list */
const rfqSearch = ref('')
const rfqStatusFilter = ref('all')
const rfqRows = computed(() => {
  let result = RFQS.map(rfq => ({ rfq, project: rfq.projectId ? getProjectById(rfq.projectId) : undefined }))
  if (rfqStatusFilter.value !== 'all') result = result.filter(row => row.rfq.status === rfqStatusFilter.value)
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
  if (soStatusFilter.value !== 'all') result = result.filter(row => row.so.status === soStatusFilter.value)
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

function resetCreateForm() {
  newTitle.value = ''
  newProjectId.value = ''
  newServiceType.value = 'hotel'
  newDueAt.value = ''
  newNotes.value = ''
  newLineDescription.value = ''
  newLineQuantity.value = null
  newLineUnit.value = ''
}

function submitCreate() {
  if (!newTitle.value.trim() || !newLineDescription.value.trim() || !newLineQuantity.value) return
  const rfq = createRfq({
    title: newTitle.value.trim(),
    projectId: newProjectId.value || undefined,
    serviceType: newServiceType.value,
    lineItems: [{ description: newLineDescription.value.trim(), quantity: newLineQuantity.value, unit: newLineUnit.value.trim() || 'unit' }],
    dueAt: newDueAt.value || undefined,
    notes: newNotes.value.trim() || undefined,
    createdBy: currentUser.value.id,
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
        <Dialog v-model:open="isCreateOpen">
          <DialogTrigger as-child>
            <Button><Plus class="h-4 w-4 mr-1.5" />Buat RFQ</Button>
          </DialogTrigger>
          <DialogScrollContent class="max-w-lg">
            <DialogHeader>
              <DialogTitle>RFQ Baru</DialogTitle>
              <DialogDescription>Dibuat sebagai status "Draft" — undang vendor dan lengkapi line item lain di halaman detail.</DialogDescription>
            </DialogHeader>
            <div class="space-y-4 py-2">
              <div class="space-y-1.5">
                <Label for="rfq-title">Judul RFQ</Label>
                <Input id="rfq-title" v-model="newTitle" placeholder="mis. RFQ Akomodasi Tambahan" />
              </div>
              <div class="space-y-1.5">
                <Label for="rfq-project">Project (opsional)</Label>
                <select id="rfq-project" v-model="newProjectId" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                  <option value="">Belum terhubung ke project</option>
                  <option v-for="project in PROJECTS" :key="project.id" :value="project.id">{{ project.name }}</option>
                </select>
              </div>
              <div class="space-y-1.5">
                <Label for="rfq-service-type">Jenis Layanan</Label>
                <select id="rfq-service-type" v-model="newServiceType" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                  <option v-for="type in SERVICE_TYPES" :key="type.value" :value="type.value">{{ type.label }}</option>
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
            <DialogFooter>
              <Button variant="outline" @click="isCreateOpen = false">Batal</Button>
              <Button :disabled="!newTitle.trim() || !newLineDescription.trim() || !newLineQuantity" @click="submitCreate">Simpan</Button>
            </DialogFooter>
          </DialogScrollContent>
        </Dialog>
      </template>
    </PageHeader>

    <RoleAccessState v-if="!canView('procurement')" module-label="modul Procurement" />

    <template v-else>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="RFQ Aktif" :value="String(openRfqCount)" :icon="ClipboardList" />
        <StatsCard title="RFQ Closed" :value="String(closedRfqCount)" :icon="CheckCircle2" icon-color="success" />
        <StatsCard title="Service Order Aktif" :value="String(activeServiceOrderCount)" :icon="Clock" icon-color="warning" />
        <StatsCard title="Service Order Fulfilled" :value="String(fulfilledServiceOrderCount)" :icon="FileText" icon-color="success" />
      </div>

      <Tabs v-model="activeTab">
        <TabsList>
          <TabsTrigger value="rfq">RFQ</TabsTrigger>
          <TabsTrigger value="service-orders">Service Orders</TabsTrigger>
        </TabsList>

        <TabsContent value="rfq">
          <div class="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
            <div class="relative flex-1 max-w-sm w-full">
              <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input v-model="rfqSearch" placeholder="Cari judul RFQ atau project..." class="pl-9" />
            </div>
            <select v-model="rfqStatusFilter" class="appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
              <option value="all">Semua Status</option>
              <option v-for="option in RFQ_STATUSES" :key="option.value" :value="option.value">{{ option.label }}</option>
            </select>
          </div>
          <SectionCard>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Judul RFQ</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Jenis Layanan</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="row in rfqRows" :key="row.rfq.id" class="cursor-pointer hover:bg-muted/50" @click="navigateTo(`/procurement/rfq/${row.rfq.id}`)">
                  <TableCell class="font-medium text-foreground">{{ row.rfq.title }}</TableCell>
                  <TableCell class="text-muted-foreground">{{ row.project?.name ?? '—' }}</TableCell>
                  <TableCell><StatusBadge :label="findStatusOption(SERVICE_TYPES, row.rfq.serviceType).label" :tone="findStatusOption(SERVICE_TYPES, row.rfq.serviceType).tone" /></TableCell>
                  <TableCell class="text-muted-foreground">{{ row.rfq.dueAt ?? '—' }}</TableCell>
                  <TableCell><StatusBadge :label="findStatusOption(RFQ_STATUSES, row.rfq.status).label" :tone="findStatusOption(RFQ_STATUSES, row.rfq.status).tone" /></TableCell>
                </TableRow>
                <TableEmpty v-if="rfqRows.length === 0" :colspan="5">
                  {{ rfqSearch || rfqStatusFilter !== 'all' ? 'Tidak ada RFQ yang cocok dengan filter.' : 'Belum ada RFQ.' }}
                </TableEmpty>
              </TableBody>
            </Table>
          </SectionCard>
        </TabsContent>

        <TabsContent value="service-orders">
          <div class="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
            <div class="relative flex-1 max-w-sm w-full">
              <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input v-model="soSearch" placeholder="Cari vendor atau project..." class="pl-9" />
            </div>
            <select v-model="soStatusFilter" class="appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
              <option value="all">Semua Status</option>
              <option v-for="option in SERVICE_ORDER_STATUSES" :key="option.value" :value="option.value">{{ option.label }}</option>
            </select>
          </div>
          <SectionCard>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>RFQ Asal</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="row in soRows" :key="row.so.id" class="cursor-pointer hover:bg-muted/50" @click="navigateTo(`/procurement/service-orders/${row.so.id}`)">
                  <TableCell class="font-medium text-foreground">{{ row.vendor?.name ?? row.so.vendorId }}</TableCell>
                  <TableCell class="text-muted-foreground">{{ row.project?.name ?? '—' }}</TableCell>
                  <TableCell class="text-muted-foreground">{{ row.so.rfqId ?? '— (engagement langsung)' }}</TableCell>
                  <TableCell><StatusBadge :label="findStatusOption(SERVICE_ORDER_STATUSES, row.so.status).label" :tone="findStatusOption(SERVICE_ORDER_STATUSES, row.so.status).tone" /></TableCell>
                </TableRow>
                <TableEmpty v-if="soRows.length === 0" :colspan="4">
                  {{ soSearch || soStatusFilter !== 'all' ? 'Tidak ada Service Order yang cocok dengan filter.' : 'Belum ada Service Order.' }}
                </TableEmpty>
              </TableBody>
            </Table>
          </SectionCard>
        </TabsContent>
      </Tabs>
    </template>
  </div>
</template>
