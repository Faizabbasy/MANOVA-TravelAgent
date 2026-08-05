<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Search, Plus } from 'lucide-vue-next'
import { MICE_EVENTS, PROJECTS, VENDORS, getProjectById, createMiceEvent, setServiceVendor } from '~/data'
import { MICE_EVENT_STATUSES, MICE_APPROVAL_STATUSES, findStatusOption } from '~/constants/status'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'MICE' })

const route = useRoute()
const { canView, canManage } = usePermissions()
const canManageMice = computed(() => canManage('mice'))

const searchQuery = ref('')
const statusFilter = ref('all')
const projectFilter = ref('all')

const rows = computed(() => {
  let result = MICE_EVENTS.map(event => ({ event, project: getProjectById(event.projectId) }))
  if (statusFilter.value !== 'all') { result = result.filter(row => row.event.status === statusFilter.value) }
  if (projectFilter.value !== 'all') { result = result.filter(row => row.event.projectId === projectFilter.value) }
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(row =>
      (row.event.venueName ?? '').toLowerCase().includes(q) ||
      (row.event.brief ?? '').toLowerCase().includes(q) ||
      (row.project?.name ?? '').toLowerCase().includes(q)
    )
  }
  return result.sort((a, b) => b.event.createdAt.localeCompare(a.event.createdAt))
})

/* Buat MICE Event baru — bisa dipicu langsung dari tab Itinerary & Services Project Detail (query projectId+serviceId). */
const isCreateOpen = ref(false)
const newProjectId = ref('')
const newServiceId = ref('')
const newVenueName = ref('')
const newVendorId = ref('')
const vendorOptions = computed(() => VENDORS.filter(v => v.serviceType === 'mice' && (v.status ?? 'active') === 'active'))

function resetCreateForm () {
  newProjectId.value = ''
  newServiceId.value = ''
  newVenueName.value = ''
  newVendorId.value = ''
}

function openCreateDialog () {
  resetCreateForm()
  if (typeof route.query.projectId === 'string') { newProjectId.value = route.query.projectId }
  if (typeof route.query.serviceId === 'string') { newServiceId.value = route.query.serviceId }
  isCreateOpen.value = true
}

watch(() => route.query.create, (value) => { if (value === '1') { openCreateDialog() } }, { immediate: true })

function submitCreate () {
  if (!newProjectId.value) { return }
  const event = createMiceEvent({
    projectId: newProjectId.value,
    serviceId: newServiceId.value || undefined,
    venueName: newVenueName.value || undefined
  })
  if (event.serviceId && newVendorId.value) { setServiceVendor(event.serviceId, newVendorId.value) }
  isCreateOpen.value = false
  navigateTo(`/mice/${event.id}`)
}
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="MICE"
      description="MICE Event lifecycle — brief, venue, sessions, BOQ, staffing, checklist, client approval, dari planning sampai post-event completion."
      :breadcrumb="[{ label: 'MICE' }]"
    >
      <template v-if="canManageMice" #actions>
        <Dialog v-model:open="isCreateOpen">
          <DialogTrigger as-child>
            <Button @click="openCreateDialog">
              <Plus class="h-4 w-4 mr-1.5" />Buat MICE Event
            </Button>
          </DialogTrigger>
          <DialogContent class="max-w-md">
            <DialogHeader>
              <DialogTitle>MICE Event Baru</DialogTitle>
              <DialogDescription>Dibuat sebagai status "Planning" — lengkapi sessions/BOQ/staffing/checklist di halaman detail.</DialogDescription>
            </DialogHeader>
            <div class="space-y-4 py-2">
              <div class="space-y-1.5">
                <Label for="mice-project">Project</Label>
                <select id="mice-project" v-model="newProjectId" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                  <option value="" disabled>
                    Pilih project
                  </option>
                  <option v-for="project in PROJECTS" :key="project.id" :value="project.id">
                    {{ project.name }}
                  </option>
                </select>
              </div>
              <div class="space-y-1.5">
                <Label for="mice-venue">Venue (opsional)</Label>
                <Input id="mice-venue" v-model="newVenueName" placeholder="mis. Hotel Prima Mitra — Convention Center Wing" />
              </div>
              <div class="space-y-1.5">
                <Label for="mice-vendor">Vendor (opsional)</Label>
                <select id="mice-vendor" v-model="newVendorId" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                  <option value="">
                    Belum ditentukan
                  </option>
                  <option v-for="vendor in vendorOptions" :key="vendor.id" :value="vendor.id">
                    {{ vendor.name }}
                  </option>
                </select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" @click="isCreateOpen = false">
                Batal
              </Button>
              <Button :disabled="!newProjectId" @click="submitCreate">
                Simpan
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </template>
    </PageHeader>

    <RoleAccessState v-if="!canView('mice')" module-label="modul MICE" />

    <template v-else>
      <div class="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div class="relative flex-1 max-w-sm w-full">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input v-model="searchQuery" placeholder="Cari venue, brief, atau project..." class="pl-9" />
        </div>
        <select v-model="statusFilter" class="appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
          <option value="all">
            Semua Status
          </option>
          <option v-for="option in MICE_EVENT_STATUSES" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
        <select v-model="projectFilter" class="appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
          <option value="all">
            Semua Project
          </option>
          <option v-for="project in PROJECTS" :key="project.id" :value="project.id">
            {{ project.name }}
          </option>
        </select>
      </div>

      <SectionCard>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Venue</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Sessions</TableHead>
              <TableHead>Peserta Diharapkan</TableHead>
              <TableHead>Client Approval</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="row in rows" :key="row.event.id" class="cursor-pointer hover:bg-muted/50" @click="navigateTo(`/mice/${row.event.id}`)">
              <TableCell class="font-medium text-foreground">
                {{ row.event.venueName ?? '—' }}
              </TableCell>
              <TableCell class="text-muted-foreground">
                {{ row.project?.name ?? row.event.projectId }}
              </TableCell>
              <TableCell class="text-muted-foreground">
                {{ row.event.sessions.length }} sesi
              </TableCell>
              <TableCell class="text-muted-foreground">
                {{ row.event.participantCategories.reduce((sum, c) => sum + c.expectedCount, 0) }} pax
              </TableCell>
              <TableCell><StatusBadge :label="findStatusOption(MICE_APPROVAL_STATUSES, row.event.clientApprovalStatus).label" :tone="findStatusOption(MICE_APPROVAL_STATUSES, row.event.clientApprovalStatus).tone" /></TableCell>
              <TableCell><StatusBadge :label="findStatusOption(MICE_EVENT_STATUSES, row.event.status).label" :tone="findStatusOption(MICE_EVENT_STATUSES, row.event.status).tone" /></TableCell>
            </TableRow>
            <TableEmpty v-if="rows.length === 0" :colspan="6">
              {{ searchQuery || statusFilter !== 'all' || projectFilter !== 'all' ? 'Tidak ada MICE Event yang cocok dengan filter.' : 'Belum ada MICE Event.' }}
            </TableEmpty>
          </TableBody>
        </Table>
      </SectionCard>
    </template>
  </div>
</template>
