<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Search, Plus, Eye } from 'lucide-vue-next'
import { TRANSPORT_BOOKINGS, PROJECTS, VENDORS, getProjectById, createTransportBooking, setServiceVendor, findActiveBookingConflicts, flagBookingOrchestrationDuplicate } from '~/data'
import { TRANSPORT_BOOKING_STATUSES, findStatusOption } from '~/constants/status'
import { formatDateTime } from '~/utils/format'

/** Tab "Transportation" — Menu Operations > Service Operations (Penyederhanaan 7-Role/Menu). Dulu
 * `/transportation` (list), kini tab dalam satu menu bersama Ticketing/Accommodation/MICE. Route detail
 * `/transportation/[id]` TIDAK berubah. */

const route = useRoute()
const { currentUser } = useCurrentUser()
const { canView, canManage } = usePermissions()
const { showToast } = useToast()
const canManageTransportation = computed(() => canManage('transportation'))

const searchQuery = ref('')
const statusFilter = ref('all')
const projectFilter = ref('all')

const rows = computed(() => {
  let result = TRANSPORT_BOOKINGS.map(booking => ({ booking, project: getProjectById(booking.projectId) }))
  if (statusFilter.value !== 'all') { result = result.filter(row => row.booking.status === statusFilter.value) }
  if (projectFilter.value !== 'all') { result = result.filter(row => row.booking.projectId === projectFilter.value) }
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(row =>
      (row.booking.assignedVehiclePlateNumber ?? '').toLowerCase().includes(q) ||
      (row.booking.driverName ?? '').toLowerCase().includes(q) ||
      (row.project?.name ?? '').toLowerCase().includes(q) ||
      row.booking.legs.some(leg => `${leg.pickupLocation} ${leg.dropoffLocation}`.toLowerCase().includes(q))
    )
  }
  return result.sort((a, b) => b.booking.createdAt.localeCompare(a.booking.createdAt))
})

function routeLabel (booking: typeof TRANSPORT_BOOKINGS[number]) {
  if (booking.legs.length === 0) { return '—' }
  const first = booking.legs[0]
  const last = booking.legs[booking.legs.length - 1]
  return booking.legs.length === 1 ? `${first.pickupLocation} → ${first.dropoffLocation}` : `${first.pickupLocation} → ${last.dropoffLocation} (${booking.legs.length} leg)`
}

/* Buat Transport Booking baru — bisa dipicu langsung dari tab Itinerary & Services Project Detail (query projectId+serviceId). */
const isCreateOpen = ref(false)
const newProjectId = ref('')
const newServiceId = ref('')
const newVendorId = ref('')
const vendorOptions = computed(() => VENDORS.filter(v => v.serviceType === 'transportation' && (v.status ?? 'active') === 'active'))

function resetCreateForm () {
  newProjectId.value = ''
  newServiceId.value = ''
  newVendorId.value = ''
}

function openCreateDialog () {
  resetCreateForm()
  if (typeof route.query.projectId === 'string') { newProjectId.value = route.query.projectId }
  if (typeof route.query.serviceId === 'string') { newServiceId.value = route.query.serviceId }
  isCreateOpen.value = true
}

// Quick-create dari Project Detail selalu menyertakan anchor tab (`#transportation`) — cek juga hash-nya,
// bukan cuma `create=1`, supaya panel lain (Flight/Hotel/MICE) yang sama-sama mount di /services tidak
// ikut membuka dialog-nya sendiri saat query ini muncul (dulu ke-4 panel share flag yang sama).
watch(() => route.query.create, (value) => { if (value === '1' && route.hash === '#transportation') { openCreateDialog() } }, { immediate: true })

/** "Duplicate booking prevention" (Section 18, Wajib) — cek booking Transport aktif lain untuk project+service yang sama sebelum membuat. */
const isDuplicateConfirmOpen = ref(false)
const duplicateConflictIds = ref<string[]>([])

function submitCreate () {
  if (!newProjectId.value) { return }
  if (newServiceId.value) {
    const conflicts = findActiveBookingConflicts('transport', newProjectId.value, newServiceId.value)
    if (conflicts.length > 0) {
      duplicateConflictIds.value = conflicts
      isDuplicateConfirmOpen.value = true
      return
    }
  }
  performCreate()
}

function performCreate () {
  const booking = createTransportBooking({
    projectId: newProjectId.value,
    serviceId: newServiceId.value || undefined
  })
  if (booking.serviceId && newVendorId.value) { setServiceVendor(booking.serviceId, newVendorId.value) }
  if (duplicateConflictIds.value.length > 0) {
    flagBookingOrchestrationDuplicate('transport', booking.id, booking.projectId, currentUser.value.id, duplicateConflictIds.value)
    showToast('Transport Booking Dibuat (Duplicate)', 'Ditandai sebagai duplicate booking yang disengaja — tercatat di Activity & Changes project terkait.', 'success')
  }
  isCreateOpen.value = false
  isDuplicateConfirmOpen.value = false
  duplicateConflictIds.value = []
  navigateTo(`/transportation/${booking.id}`)
}

function cancelDuplicateCreate () {
  isDuplicateConfirmOpen.value = false
  duplicateConflictIds.value = []
}
</script>

<template>
  <div class="space-y-6">
    <div v-if="canManageTransportation" class="flex justify-end">
      <Sheet v-model:open="isCreateOpen">
        <SheetTrigger as-child>
          <Button @click="openCreateDialog">
            <Plus class="h-4 w-4 mr-1.5" />Buat Transport Booking
          </Button>
        </SheetTrigger>
        <SheetContent side="right" class="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Transport Booking Baru</SheetTitle>
            <SheetDescription>Dibuat sebagai status "Requested" — lengkapi options/legs/manifest di halaman detail.</SheetDescription>
          </SheetHeader>
          <div class="space-y-4 py-4">
            <div class="space-y-1.5">
              <Label for="trn-project">Project</Label>
              <select id="trn-project" v-model="newProjectId" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                <option value="" disabled>
                  Pilih project
                </option>
                <option v-for="project in PROJECTS" :key="project.id" :value="project.id">
                  {{ project.name }}
                </option>
              </select>
            </div>
            <div class="space-y-1.5">
              <Label for="trn-vendor">Vendor (opsional)</Label>
              <select id="trn-vendor" v-model="newVendorId" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                <option value="">
                  Belum ditentukan
                </option>
                <option v-for="vendor in vendorOptions" :key="vendor.id" :value="vendor.id">
                  {{ vendor.name }}
                </option>
              </select>
            </div>
          </div>
          <SheetFooter class="flex-row justify-end gap-2">
            <Button variant="outline" @click="isCreateOpen = false">
              Batal
            </Button>
            <Button :disabled="!newProjectId" @click="submitCreate">
              Simpan
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <!-- Duplicate booking prevention (Section 18, Wajib) — konfirmasi eksplisit wajib sebelum melanjutkan. -->
      <Dialog v-model:open="isDuplicateConfirmOpen">
        <DialogContent class="max-w-md">
          <DialogHeader>
            <DialogTitle>Booking Aktif Sudah Ada</DialogTitle>
            <DialogDescription>
              Sudah ada Transport Booking aktif untuk service yang sama pada project ini: {{ duplicateConflictIds.join(', ') }}.
              Lanjutkan sebagai duplicate booking yang disengaja?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" @click="cancelDuplicateCreate">
              Batal
            </Button>
            <Button variant="destructive" @click="performCreate">
              Lanjutkan sebagai Duplicate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>

    <RoleAccessState v-if="!canView('transportation')" module-label="modul Service Operations" />

    <template v-else>
      <div class="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div class="relative flex-1 max-w-sm w-full">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input v-model="searchQuery" placeholder="Cari plat nomor, driver, project, atau rute..." class="pl-9" />
        </div>
        <select v-model="statusFilter" class="appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
          <option value="all">
            Semua Status
          </option>
          <option v-for="option in TRANSPORT_BOOKING_STATUSES" :key="option.value" :value="option.value">
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
              <TableHead>Unit / Driver</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Rute</TableHead>
              <TableHead>Manifest</TableHead>
              <TableHead>Jadwal Terdekat</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="row in rows" :key="row.booking.id" class="cursor-pointer hover:bg-muted/50" @click="navigateTo(`/transportation/${row.booking.id}`)">
              <TableCell class="font-medium text-foreground">
                {{ row.booking.assignedVehiclePlateNumber ?? row.booking.driverName ?? '—' }}
              </TableCell>
              <TableCell class="text-muted-foreground">
                {{ row.project?.name ?? row.booking.projectId }}
              </TableCell>
              <TableCell class="text-muted-foreground">
                {{ routeLabel(row.booking) }}
              </TableCell>
              <TableCell class="text-muted-foreground">
                {{ row.booking.travelerIds.length }} pax
              </TableCell>
              <TableCell class="text-muted-foreground">
                {{ row.booking.legs[0]?.scheduledAt ? formatDateTime(row.booking.legs[0].scheduledAt) : '—' }}
              </TableCell>
              <TableCell><StatusBadge :label="findStatusOption(TRANSPORT_BOOKING_STATUSES, row.booking.status).label" :tone="findStatusOption(TRANSPORT_BOOKING_STATUSES, row.booking.status).tone" /></TableCell>
              <TableCell>
                <Eye class="h-4 w-4 text-muted-foreground" />
              </TableCell>
            </TableRow>
            <TableEmpty v-if="rows.length === 0" :colspan="7">
              {{ searchQuery || statusFilter !== 'all' || projectFilter !== 'all' ? 'Tidak ada Transport Booking yang cocok dengan filter.' : 'Belum ada Transport Booking.' }}
            </TableEmpty>
          </TableBody>
        </Table>
      </SectionCard>
    </template>
  </div>
</template>
