<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Search, Plus } from 'lucide-vue-next'
import { HOTEL_BOOKINGS, PROJECTS, getProjectById, createHotelBooking } from '~/data'
import { HOTEL_BOOKING_STATUSES, findStatusOption } from '~/constants/status'
import { formatDate } from '~/utils/format'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Accommodation' })

const route = useRoute()
const { canView, canManage } = usePermissions()
const canManageAccommodation = computed(() => canManage('accommodation'))

const searchQuery = ref('')
const statusFilter = ref('all')
const projectFilter = ref('all')

const rows = computed(() => {
  let result = HOTEL_BOOKINGS.map(booking => ({ booking, project: getProjectById(booking.projectId) }))
  if (statusFilter.value !== 'all') result = result.filter(row => row.booking.status === statusFilter.value)
  if (projectFilter.value !== 'all') result = result.filter(row => row.booking.projectId === projectFilter.value)
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(row =>
      (row.booking.confirmationNumber ?? '').toLowerCase().includes(q)
      || (row.project?.name ?? '').toLowerCase().includes(q)
      || row.booking.options.some(option => option.propertyName.toLowerCase().includes(q)),
    )
  }
  return result.sort((a, b) => b.booking.createdAt.localeCompare(a.booking.createdAt))
})

function propertyLabel(booking: typeof HOTEL_BOOKINGS[number]) {
  if (booking.options.length === 0) return '—'
  const selected = booking.options.find(option => option.isSelected) ?? booking.options[0]
  return `${selected.propertyName} — ${selected.roomType}`
}

/* Buat Hotel Booking baru — bisa dipicu langsung dari tab Itinerary & Services Project Detail (query projectId+serviceId). */
const isCreateOpen = ref(false)
const newProjectId = ref('')
const newServiceId = ref('')
const newCheckInDate = ref('')
const newCheckOutDate = ref('')

function resetCreateForm() {
  newProjectId.value = ''
  newServiceId.value = ''
  newCheckInDate.value = ''
  newCheckOutDate.value = ''
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
  const booking = createHotelBooking({
    projectId: newProjectId.value,
    serviceId: newServiceId.value || undefined,
    checkInDate: newCheckInDate.value || undefined,
    checkOutDate: newCheckOutDate.value || undefined,
  })
  isCreateOpen.value = false
  navigateTo(`/accommodation/${booking.id}`)
}
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Accommodation"
      description="Hotel Booking lifecycle — sourcing/options, room block, check-in/out, Quote/Confirm/Amend/Cancel/No-Show."
      :breadcrumb="[{ label: 'Accommodation' }]"
    >
      <template v-if="canManageAccommodation" #actions>
        <Dialog v-model:open="isCreateOpen">
          <DialogTrigger as-child>
            <Button @click="openCreateDialog"><Plus class="h-4 w-4 mr-1.5" />Buat Hotel Booking</Button>
          </DialogTrigger>
          <DialogContent class="max-w-md">
            <DialogHeader>
              <DialogTitle>Hotel Booking Baru</DialogTitle>
              <DialogDescription>Dibuat sebagai status "Requested" — lengkapi options/room block/traveler assignment di halaman detail.</DialogDescription>
            </DialogHeader>
            <div class="space-y-4 py-2">
              <div class="space-y-1.5">
                <Label for="htl-project">Project</Label>
                <select id="htl-project" v-model="newProjectId" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                  <option value="" disabled>Pilih project</option>
                  <option v-for="project in PROJECTS" :key="project.id" :value="project.id">{{ project.name }}</option>
                </select>
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div class="space-y-1.5">
                  <Label for="htl-checkin">Check-in (opsional)</Label>
                  <Input id="htl-checkin" v-model="newCheckInDate" type="date" />
                </div>
                <div class="space-y-1.5">
                  <Label for="htl-checkout">Check-out (opsional)</Label>
                  <Input id="htl-checkout" v-model="newCheckOutDate" type="date" />
                </div>
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

    <RoleAccessState v-if="!canView('accommodation')" module-label="modul Accommodation" />

    <template v-else>
      <div class="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div class="relative flex-1 max-w-sm w-full">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input v-model="searchQuery" placeholder="Cari konfirmasi, project, atau property..." class="pl-9" />
        </div>
        <select v-model="statusFilter" class="appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
          <option value="all">Semua Status</option>
          <option v-for="option in HOTEL_BOOKING_STATUSES" :key="option.value" :value="option.value">{{ option.label }}</option>
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
              <TableHead>Konfirmasi</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Property / Room Type</TableHead>
              <TableHead>Check-in / Check-out</TableHead>
              <TableHead>Traveler</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="row in rows" :key="row.booking.id" class="cursor-pointer hover:bg-muted/50" @click="navigateTo(`/accommodation/${row.booking.id}`)">
              <TableCell class="font-medium text-foreground">{{ row.booking.confirmationNumber ?? '—' }}</TableCell>
              <TableCell class="text-muted-foreground">{{ row.project?.name ?? row.booking.projectId }}</TableCell>
              <TableCell class="text-muted-foreground">{{ propertyLabel(row.booking) }}</TableCell>
              <TableCell class="text-muted-foreground">{{ row.booking.checkInDate ? formatDate(row.booking.checkInDate) : '—' }} – {{ row.booking.checkOutDate ? formatDate(row.booking.checkOutDate) : '—' }}</TableCell>
              <TableCell class="text-muted-foreground">{{ row.booking.travelerIds.length }} pax</TableCell>
              <TableCell><StatusBadge :label="findStatusOption(HOTEL_BOOKING_STATUSES, row.booking.status).label" :tone="findStatusOption(HOTEL_BOOKING_STATUSES, row.booking.status).tone" /></TableCell>
            </TableRow>
            <TableEmpty v-if="rows.length === 0" :colspan="6">
              {{ searchQuery || statusFilter !== 'all' || projectFilter !== 'all' ? 'Tidak ada Hotel Booking yang cocok dengan filter.' : 'Belum ada Hotel Booking.' }}
            </TableEmpty>
          </TableBody>
        </Table>
      </SectionCard>
    </template>
  </div>
</template>
