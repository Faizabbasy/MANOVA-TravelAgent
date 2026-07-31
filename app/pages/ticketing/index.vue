<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Search, Plus } from 'lucide-vue-next'
import { FLIGHT_BOOKINGS, PROJECTS, getProjectById, createFlightBooking } from '~/data'
import { FLIGHT_BOOKING_STATUSES, findStatusOption } from '~/constants/status'
import { formatCurrencyIdr, formatDate } from '~/utils/format'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Ticketing' })

const route = useRoute()
const { canView, canManage } = usePermissions()
const canManageTicketing = computed(() => canManage('ticketing'))

const searchQuery = ref('')
const statusFilter = ref('all')
const projectFilter = ref('all')

const rows = computed(() => {
  let result = FLIGHT_BOOKINGS.map(booking => ({ booking, project: getProjectById(booking.projectId) }))
  if (statusFilter.value !== 'all') result = result.filter(row => row.booking.status === statusFilter.value)
  if (projectFilter.value !== 'all') result = result.filter(row => row.booking.projectId === projectFilter.value)
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(row =>
      (row.booking.pnr ?? '').toLowerCase().includes(q)
      || (row.project?.name ?? '').toLowerCase().includes(q)
      || row.booking.segments.some(segment => `${segment.origin} ${segment.destination}`.toLowerCase().includes(q)),
    )
  }
  return result.sort((a, b) => b.booking.createdAt.localeCompare(a.booking.createdAt))
})

function routeLabel(booking: typeof FLIGHT_BOOKINGS[number]) {
  if (booking.segments.length === 0) return '—'
  const first = booking.segments[0]
  const last = booking.segments[booking.segments.length - 1]
  return booking.segments.length === 1 ? `${first.origin} → ${first.destination}` : `${first.origin} → ${last.destination} (${booking.segments.length} segmen)`
}

/* Buat Flight Booking baru — bisa dipicu langsung dari tab Itinerary & Services Project Detail (query projectId+serviceId). */
const isCreateOpen = ref(false)
const newProjectId = ref('')
const newServiceId = ref('')
const newTicketingDeadline = ref('')

function resetCreateForm() {
  newProjectId.value = ''
  newServiceId.value = ''
  newTicketingDeadline.value = ''
}

function openCreateDialog() {
  resetCreateForm()
  if (typeof route.query.projectId === 'string') newProjectId.value = route.query.projectId
  if (typeof route.query.serviceId === 'string') newServiceId.value = route.query.serviceId
  isCreateOpen.value = true
}

watch(() => route.query.create, (value) => { if (value === '1') openCreateDialog() }, { immediate: true })

function submitCreate() {
  if (!newProjectId.value) return
  const booking = createFlightBooking({
    projectId: newProjectId.value,
    serviceId: newServiceId.value || undefined,
    ticketingDeadline: newTicketingDeadline.value || undefined,
  })
  isCreateOpen.value = false
  navigateTo(`/ticketing/${booking.id}`)
}
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Ticketing"
      description="Flight Booking lifecycle — request/options, PNR, segments, deadline, Hold/Confirm/Issue/Reissue/Cancel/Refund."
      :breadcrumb="[{ label: 'Ticketing' }]"
    >
      <template v-if="canManageTicketing" #actions>
        <Dialog v-model:open="isCreateOpen">
          <DialogTrigger as-child>
            <Button @click="openCreateDialog"><Plus class="h-4 w-4 mr-1.5" />Buat Flight Booking</Button>
          </DialogTrigger>
          <DialogContent class="max-w-md">
            <DialogHeader>
              <DialogTitle>Flight Booking Baru</DialogTitle>
              <DialogDescription>Dibuat sebagai status "Requested" — lengkapi options/segments/traveler assignment di halaman detail.</DialogDescription>
            </DialogHeader>
            <div class="space-y-4 py-2">
              <div class="space-y-1.5">
                <Label for="flt-project">Project</Label>
                <select id="flt-project" v-model="newProjectId" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                  <option value="" disabled>Pilih project</option>
                  <option v-for="project in PROJECTS" :key="project.id" :value="project.id">{{ project.name }}</option>
                </select>
              </div>
              <div class="space-y-1.5">
                <Label for="flt-deadline">Ticketing Deadline (opsional)</Label>
                <Input id="flt-deadline" v-model="newTicketingDeadline" type="date" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" @click="isCreateOpen = false">Batal</Button>
              <Button :disabled="!newProjectId" @click="submitCreate">Simpan</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </template>
    </PageHeader>

    <RoleAccessState v-if="!canView('ticketing')" module-label="modul Ticketing" />

    <template v-else>
      <div class="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div class="relative flex-1 max-w-sm w-full">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input v-model="searchQuery" placeholder="Cari PNR, project, atau rute..." class="pl-9" />
        </div>
        <select v-model="statusFilter" class="appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
          <option value="all">Semua Status</option>
          <option v-for="option in FLIGHT_BOOKING_STATUSES" :key="option.value" :value="option.value">{{ option.label }}</option>
        </select>
        <select v-model="projectFilter" class="appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
          <option value="all">Semua Project</option>
          <option v-for="project in PROJECTS" :key="project.id" :value="project.id">{{ project.name }}</option>
        </select>
      </div>

      <SectionCard>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>PNR</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Rute</TableHead>
              <TableHead>Traveler</TableHead>
              <TableHead>Deadline</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="row in rows" :key="row.booking.id" class="cursor-pointer hover:bg-muted/50" @click="navigateTo(`/ticketing/${row.booking.id}`)">
              <TableCell class="font-medium text-foreground">{{ row.booking.pnr ?? '—' }}</TableCell>
              <TableCell class="text-muted-foreground">{{ row.project?.name ?? row.booking.projectId }}</TableCell>
              <TableCell class="text-muted-foreground">{{ routeLabel(row.booking) }}</TableCell>
              <TableCell class="text-muted-foreground">{{ row.booking.travelerIds.length }} pax</TableCell>
              <TableCell class="text-muted-foreground">{{ row.booking.ticketingDeadline ? formatDate(row.booking.ticketingDeadline) : '—' }}</TableCell>
              <TableCell><StatusBadge :label="findStatusOption(FLIGHT_BOOKING_STATUSES, row.booking.status).label" :tone="findStatusOption(FLIGHT_BOOKING_STATUSES, row.booking.status).tone" /></TableCell>
            </TableRow>
            <TableEmpty v-if="rows.length === 0" :colspan="6">
              {{ searchQuery || statusFilter !== 'all' || projectFilter !== 'all' ? 'Tidak ada Flight Booking yang cocok dengan filter.' : 'Belum ada Flight Booking.' }}
            </TableEmpty>
          </TableBody>
        </Table>
      </SectionCard>
    </template>
  </div>
</template>
