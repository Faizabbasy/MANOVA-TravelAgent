<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { FileX, Plus, Trash2, Printer, ClipboardList } from 'lucide-vue-next'
import {
  getTransportBookingById, getTransportBookingMarginIdr, getTransportBookingStatusTransitions,
  updateTransportBooking, updateTransportBookingStatus, selectTransportOption,
  getProjectById, getTravelers, getTravelerGroups, getProjectServiceById, setServiceVendor,
  VENDORS,
  createCancellationRecord
} from '~/data'
import { TRANSPORT_BOOKING_STATUSES, VEHICLE_TYPES, findStatusOption } from '~/constants/status'
import { formatCurrencyIdr, formatDate, formatDateTime } from '~/utils/format'
import type { TransportBookingStatus, TransportOption, TransportLeg } from '~/types/transportation'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const route = useRoute()
const router = useRouter()
const { currentUser } = useCurrentUser()
const { canView, canManage, canViewFinancials } = usePermissions()
const canManageTransportation = computed(() => canManage('transportation'))
/** Internal cost isolation (hard rule protokol) — Transportation (pengelola langsung) dan role finansial penuh (D-030) yang melihat net cost; role lain hanya melihat sell price. Pola identik `canViewFlightFinancials`/`canViewAccommodationFinancials`. */
const canViewTransportFinancials = computed(() => canManageTransportation.value || canViewFinancials.value)
const { showToast } = useToast()

const booking = computed(() => getTransportBookingById(String(route.params.id)))
useHead({ title: computed(() => booking.value ? `Transport Booking ${booking.value.id}` : 'Transport Booking Tidak Ditemukan') })

const project = computed(() => (booking.value ? getProjectById(booking.value.projectId) : undefined))
const projectTravelers = computed(() => (project.value ? getTravelers(project.value.id) : []))
const marginIdr = computed(() => (booking.value ? getTransportBookingMarginIdr(booking.value) : undefined))
const group = computed(() => (booking.value?.groupId && project.value ? getTravelerGroups(project.value.id).find(g => g.id === booking.value?.groupId) : undefined))

function traveler (id: string) {
  return projectTravelers.value.find(t => t.id === id)
}
function travelerName (id: string) {
  return traveler(id)?.name ?? id
}
function travelerSpecialRequest (id: string) {
  const t = traveler(id)
  if (!t) { return undefined }
  return [t.specialRequest, t.dietaryRestrictions, t.accessibilityNeeds].filter(Boolean).join(' · ') || undefined
}

const summaryMetadata = computed(() => {
  if (!booking.value) { return [] }
  return [
    { label: 'Project', value: project.value?.name ?? booking.value.projectId },
    { label: 'Jenis Permintaan', value: booking.value.transferType ?? '—' },
    { label: 'Manifest', value: group.value ? `${group.value.name} (${booking.value.travelerIds.length} dari ${group.value.paxCount} pax)` : `${booking.value.travelerIds.length} pax` },
    { label: 'Unit', value: booking.value.assignedVehiclePlateNumber ?? 'Belum ditugaskan' },
    { label: 'Driver', value: booking.value.driverName ? `${booking.value.driverName}${booking.value.driverPhone ? ` (${booking.value.driverPhone})` : ''}` : 'Belum ditugaskan' },
    { label: 'Dibuat', value: formatDate(booking.value.createdAt) }
  ]
})

/* Status transitions */
const isStatusDialogOpen = ref(false)
const pendingStatus = ref<TransportBookingStatus | null>(null)
const statusReason = ref('')
/** "Cancellation and penalty" (Section 19, D-076) — hook ADITIF, lihat komentar identik `app/pages/ticketing/[id]/index.vue`. */
const CANCELLATION_TRIGGER_STATUSES: TransportBookingStatus[] = ['cancelled', 'no-show']
const cancellationPenalty = ref<number | null>(null)
const cancellationRefundEligible = ref(true)

function statusRequiresReason (status: TransportBookingStatus) {
  return status === 'cancelled' || status === 'no-show'
}

function requestStatusChange (newStatus: TransportBookingStatus) {
  if (statusRequiresReason(newStatus)) {
    pendingStatus.value = newStatus
    statusReason.value = ''
    cancellationPenalty.value = null
    cancellationRefundEligible.value = newStatus !== 'no-show'
    isStatusDialogOpen.value = true
    return
  }
  if (!booking.value) { return }
  updateTransportBookingStatus(booking.value.id, newStatus, currentUser.value.id)
  showToast('Status Diperbarui', `Transport Booking kini berstatus "${findStatusOption(TRANSPORT_BOOKING_STATUSES, newStatus).label}".`, 'success')
}

function submitStatusChange () {
  if (!booking.value || !pendingStatus.value || !statusReason.value.trim()) { return }
  const targetStatus = pendingStatus.value
  const result = updateTransportBookingStatus(booking.value.id, targetStatus, currentUser.value.id, statusReason.value.trim())
  isStatusDialogOpen.value = false
  if (!result) { return }
  if (CANCELLATION_TRIGGER_STATUSES.includes(targetStatus)) {
    createCancellationRecord({
      projectId: result.projectId,
      bookingType: 'transport',
      bookingId: result.id,
      reason: statusReason.value.trim(),
      penaltyIdr: cancellationPenalty.value ?? undefined,
      cancelledBy: currentUser.value.id,
      refundEligible: cancellationRefundEligible.value
    })
  }
  showToast('Status Diperbarui', `Transport Booking kini berstatus "${findStatusOption(TRANSPORT_BOOKING_STATUSES, targetStatus).label}".`, 'success')
}

function submitSelectOption (index: number) {
  if (!booking.value) { return }
  selectTransportOption(booking.value.id, index)
}

/* Edit dialog — whole-form, pola sama Flight/Hotel Booking (Section 13/14). */
const isEditOpen = ref(false)
const editVehiclePlate = ref('')
const editVendorId = ref('')
const vendorOptions = computed(() => VENDORS.filter(v => v.serviceType === 'transportation' && (v.status ?? 'active') === 'active'))
const editDriverName = ref('')
const editDriverPhone = ref('')
const editStandbyHours = ref<number | null>(null)
const editOvertimeHours = ref<number | null>(null)
const editTollFee = ref<number | null>(null)
const editNetCost = ref<number | null>(null)
const editSellPrice = ref<number | null>(null)
const editHasChange = ref(false)
const editChangeNote = ref('')
const editHasIncident = ref(false)
const editIncidentNote = ref('')
const editTravelerIds = ref<string[]>([])
const editOptions = ref<TransportOption[]>([])
const editLegs = ref<TransportLeg[]>([])

function openEditDialog () {
  if (!booking.value) { return }
  editVendorId.value = (booking.value.serviceId ? getProjectServiceById(booking.value.serviceId)?.vendorId : undefined) ?? ''
  editVehiclePlate.value = booking.value.assignedVehiclePlateNumber ?? ''
  editDriverName.value = booking.value.driverName ?? ''
  editDriverPhone.value = booking.value.driverPhone ?? ''
  editStandbyHours.value = booking.value.standbyHours ?? null
  editOvertimeHours.value = booking.value.overtimeHours ?? null
  editTollFee.value = booking.value.tollFeeIdr ?? null
  editNetCost.value = booking.value.netCostIdr ?? null
  editSellPrice.value = booking.value.sellPriceIdr ?? null
  editHasChange.value = booking.value.hasChange ?? false
  editChangeNote.value = booking.value.changeNote ?? ''
  editHasIncident.value = booking.value.hasIncident ?? false
  editIncidentNote.value = booking.value.incidentNote ?? ''
  editTravelerIds.value = [...booking.value.travelerIds]
  editOptions.value = booking.value.options.map(option => ({ ...option }))
  editLegs.value = booking.value.legs.map(leg => ({ ...leg }))
  isEditOpen.value = true
}

function toggleEditTraveler (travelerId: string) {
  editTravelerIds.value = editTravelerIds.value.includes(travelerId)
    ? editTravelerIds.value.filter(id => id !== travelerId)
    : [...editTravelerIds.value, travelerId]
}

function addOptionRow () {
  editOptions.value.push({ vehicleType: 'sedan', capacity: 1, rateUnit: 'per-trip', ratePerUnitIdr: 0 })
}
function removeOptionRow (index: number) {
  editOptions.value.splice(index, 1)
}

function addLegRow () {
  editLegs.value.push({ pickupLocation: '', dropoffLocation: '', scheduledAt: '' })
}
function removeLegRow (index: number) {
  editLegs.value.splice(index, 1)
}

function submitEdit () {
  if (!booking.value) { return }
  if (booking.value.serviceId) { setServiceVendor(booking.value.serviceId, editVendorId.value || undefined) }
  updateTransportBooking(booking.value.id, {
    assignedVehiclePlateNumber: editVehiclePlate.value.trim() || undefined,
    driverName: editDriverName.value.trim() || undefined,
    driverPhone: editDriverPhone.value.trim() || undefined,
    standbyHours: editStandbyHours.value ?? undefined,
    overtimeHours: editOvertimeHours.value ?? undefined,
    tollFeeIdr: editTollFee.value ?? undefined,
    netCostIdr: editNetCost.value ?? undefined,
    sellPriceIdr: editSellPrice.value ?? undefined,
    hasChange: editHasChange.value || undefined,
    changeNote: editChangeNote.value.trim() || undefined,
    hasIncident: editHasIncident.value || undefined,
    incidentNote: editIncidentNote.value.trim() || undefined,
    travelerIds: editTravelerIds.value,
    options: editOptions.value.filter(option => option.capacity > 0 && option.ratePerUnitIdr > 0),
    legs: editLegs.value.filter(leg => leg.pickupLocation.trim() && leg.dropoffLocation.trim() && leg.scheduledAt.trim())
  })
  isEditOpen.value = false
  showToast('Transport Booking Diperbarui', 'Perubahan berhasil disimpan.', 'success')
}
</script>

<template>
  <div class="space-y-6">
    <template v-if="!booking">
      <PageHeader title="Transport Booking Tidak Ditemukan" :breadcrumb="[{ label: 'Transportation', to: '/transportation' }, { label: 'Not Found' }]" />
      <SectionCard>
        <EmptyState
          :icon="FileX"
          title="Transport Booking tidak ditemukan"
          :description="`Transport Booking dengan ID '${route.params.id}' tidak ada di data demo saat ini.`"
        >
          <Button @click="router.push('/transportation')">
            Kembali ke Daftar Transportation
          </Button>
        </EmptyState>
      </SectionCard>
    </template>

    <RoleAccessState v-else-if="!canView('transportation')" module-label="modul Transportation" />

    <template v-else>
      <PageHeader :title="`Transport Booking ${booking.id}`" :breadcrumb="[{ label: 'Transportation', to: '/transportation' }, { label: booking.id }]">
        <template #actions>
          <div class="flex flex-wrap items-center gap-2">
            <StatusBadge :label="findStatusOption(TRANSPORT_BOOKING_STATUSES, booking.status).label" :tone="findStatusOption(TRANSPORT_BOOKING_STATUSES, booking.status).tone" />
            <NuxtLink :to="`/transportation/${booking.id}/service-order-preview`" target="_blank">
              <Button size="sm" variant="outline">
                <Printer class="h-4 w-4 mr-1.5" />Service Order
              </Button>
            </NuxtLink>
            <NuxtLink :to="`/transportation/${booking.id}/driver-sheet-preview`" target="_blank">
              <Button size="sm" variant="outline">
                <ClipboardList class="h-4 w-4 mr-1.5" />Driver Sheet
              </Button>
            </NuxtLink>
            <template v-if="canManageTransportation">
              <Button size="sm" variant="outline" @click="openEditDialog">
                Edit
              </Button>
              <Button
                v-for="next in getTransportBookingStatusTransitions(booking.status)"
                :key="next"
                size="sm"
                :variant="next === 'cancelled' || next === 'no-show' ? 'destructive' : 'outline'"
                @click="requestStatusChange(next)"
              >
                {{ findStatusOption(TRANSPORT_BOOKING_STATUSES, next).label }}
              </Button>
            </template>
          </div>
        </template>
      </PageHeader>

      <div v-if="booking.hasChange" class="rounded-lg border border-amber-500/40 bg-amber-500/5 px-4 py-3 text-sm">
        <p class="font-semibold text-foreground">
          Change
        </p>
        <p class="text-muted-foreground mt-1">
          {{ booking.changeNote || 'Terjadi perubahan rute/jadwal — detail belum dicatat.' }}
        </p>
      </div>
      <div v-if="booking.hasIncident" class="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm">
        <p class="font-semibold text-foreground">
          Incident
        </p>
        <p class="text-muted-foreground mt-1">
          {{ booking.incidentNote || 'Terjadi insiden operasional — detail belum dicatat.' }}
        </p>
      </div>

      <SectionCard>
        <DetailMetadataList :items="summaryMetadata" />
        <div v-if="booking.standbyHours || booking.overtimeHours || booking.tollFeeIdr" class="mt-3 flex flex-wrap gap-2">
          <StatusBadge v-if="booking.standbyHours" :label="`Standby ${booking.standbyHours} jam`" tone="info" />
          <StatusBadge v-if="booking.overtimeHours" :label="`Overtime ${booking.overtimeHours} jam`" tone="warning" />
          <StatusBadge v-if="booking.tollFeeIdr" :label="`Toll ${formatCurrencyIdr(booking.tollFeeIdr)}`" tone="neutral" />
        </div>
      </SectionCard>

      <SectionCard title="Transport Options" description="Tipe kendaraan, kapasitas, bagasi, dan aksesibilitas per opsi yang dibandingkan.">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tipe Kendaraan</TableHead>
              <TableHead>Kapasitas</TableHead>
              <TableHead>Bagasi</TableHead>
              <TableHead>Aksesibilitas</TableHead>
              <TableHead>Rate</TableHead>
              <TableHead v-if="canManageTransportation">
                Aksi
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="(option, index) in booking.options" :key="index">
              <TableCell><StatusBadge :label="findStatusOption(VEHICLE_TYPES, option.vehicleType).label" :tone="findStatusOption(VEHICLE_TYPES, option.vehicleType).tone" /></TableCell>
              <TableCell class="text-foreground">
                {{ option.capacity }} pax
              </TableCell>
              <TableCell class="text-muted-foreground">
                {{ option.luggageCapacity ?? '—' }}
              </TableCell>
              <TableCell class="text-muted-foreground">
                {{ option.accessibilityFeatures ?? '—' }}
              </TableCell>
              <TableCell class="text-foreground">
                {{ formatCurrencyIdr(option.ratePerUnitIdr) }} / {{ option.rateUnit }}
              </TableCell>
              <TableCell v-if="canManageTransportation">
                <StatusBadge v-if="option.isSelected" label="Dipilih" tone="success" />
                <Button v-else size="sm" variant="ghost" @click="submitSelectOption(index)">
                  Pilih
                </Button>
              </TableCell>
            </TableRow>
            <TableEmpty v-if="booking.options.length === 0" :colspan="canManageTransportation ? 6 : 5">
              Belum ada opsi tercatat.
            </TableEmpty>
          </TableBody>
        </Table>
      </SectionCard>

      <SectionCard title="Dispatch / Legs" description="Pickup/drop-off, rute, dan jadwal per leg (multi-leg dispatch).">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Leg</TableHead>
              <TableHead>Pickup</TableHead>
              <TableHead>Drop-off</TableHead>
              <TableHead>Jadwal</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="(leg, index) in booking.legs" :key="index">
              <TableCell class="text-foreground">
                {{ leg.label ?? `Leg ${index + 1}` }}
              </TableCell>
              <TableCell class="text-muted-foreground">
                {{ leg.pickupLocation }}
              </TableCell>
              <TableCell class="text-muted-foreground">
                {{ leg.dropoffLocation }}
              </TableCell>
              <TableCell class="text-muted-foreground">
                {{ formatDateTime(leg.scheduledAt) }}
              </TableCell>
            </TableRow>
            <TableEmpty v-if="booking.legs.length === 0" :colspan="4">
              Belum ada leg tercatat.
            </TableEmpty>
          </TableBody>
        </Table>
      </SectionCard>

      <SectionCard title="Manifest / Group Allocation" :description="`${booking.travelerIds.length} traveler ditugaskan pada booking ini`">
        <ul v-if="booking.travelerIds.length" class="divide-y divide-border">
          <li v-for="travelerId in booking.travelerIds" :key="travelerId" class="py-2">
            <p class="text-sm font-medium text-foreground">
              {{ travelerName(travelerId) }}
            </p>
            <p v-if="travelerSpecialRequest(travelerId)" class="text-xs text-muted-foreground mt-0.5">
              {{ travelerSpecialRequest(travelerId) }}
            </p>
          </li>
        </ul>
        <EmptyState v-else title="Belum ada traveler ditugaskan" />
      </SectionCard>

      <SectionCard title="Financial" description="Standby/overtime/toll dan dampak finansial.">
        <div class="grid gap-3 sm:grid-cols-3 mb-3">
          <div v-if="canViewTransportFinancials" class="rounded-lg border border-border p-3">
            <p class="text-xs text-muted-foreground">
              Net Cost (Internal)
            </p>
            <p class="text-lg font-semibold text-foreground">
              {{ booking.netCostIdr !== undefined ? formatCurrencyIdr(booking.netCostIdr) : '—' }}
            </p>
          </div>
          <div class="rounded-lg border border-border p-3">
            <p class="text-xs text-muted-foreground">
              Sell Price (Client)
            </p>
            <p class="text-lg font-semibold text-foreground">
              {{ booking.sellPriceIdr !== undefined ? formatCurrencyIdr(booking.sellPriceIdr) : '—' }}
            </p>
          </div>
          <div v-if="canViewTransportFinancials" class="rounded-lg border border-border p-3">
            <p class="text-xs text-muted-foreground">
              Margin
            </p>
            <p class="text-lg font-semibold text-foreground">
              {{ marginIdr !== undefined ? formatCurrencyIdr(marginIdr) : '—' }}
            </p>
          </div>
        </div>
        <p v-if="booking.statusReason" class="text-sm text-foreground whitespace-pre-line">
          {{ booking.statusReason }}
        </p>
        <p v-if="!canViewTransportFinancials" class="mt-2 text-xs text-muted-foreground">
          Net cost internal tidak ditampilkan untuk role ini.
        </p>
      </SectionCard>

      <!-- Status change dialog (cancelled/no-show — reason wajib) -->
      <Dialog v-model:open="isStatusDialogOpen">
        <DialogContent class="max-w-md">
          <DialogHeader>
            <DialogTitle>{{ pendingStatus ? findStatusOption(TRANSPORT_BOOKING_STATUSES, pendingStatus).label : '' }} Transport Booking</DialogTitle>
            <DialogDescription>Alasan wajib dicatat untuk transisi ini — akan tersimpan sebagai jejak historis di Activity & Changes project terkait.</DialogDescription>
          </DialogHeader>
          <div class="space-y-4 py-2">
            <div class="space-y-1.5">
              <Label for="status-reason">Alasan</Label>
              <Input id="status-reason" v-model="statusReason" placeholder="mis. Peserta membatalkan transfer" />
            </div>
            <template v-if="pendingStatus && CANCELLATION_TRIGGER_STATUSES.includes(pendingStatus)">
              <div class="space-y-1.5 pt-2 border-t border-border">
                <Label for="status-penalty">Penalty (Rp, opsional)</Label>
                <Input id="status-penalty" v-model.number="cancellationPenalty" type="number" placeholder="0" />
              </div>
              <label class="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                <Checkbox v-model="cancellationRefundEligible" />
                Refund Eligible
              </label>
              <p class="text-xs text-muted-foreground">
                Sebuah Cancellation Record akan otomatis dicatat (Section 19) — dapat ditindaklanjuti dengan Refund Request di modul Changes & Incidents.
              </p>
            </template>
          </div>
          <DialogFooter>
            <Button variant="outline" @click="isStatusDialogOpen = false">
              Batal
            </Button>
            <Button variant="destructive" :disabled="!statusReason.trim()" @click="submitStatusChange">
              Konfirmasi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <!-- Edit dialog -->
      <Dialog v-model:open="isEditOpen">
        <DialogScrollContent class="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Transport Booking</DialogTitle>
            <DialogDescription>Perubahan berlaku langsung — status lifecycle diubah lewat tombol terpisah di header.</DialogDescription>
          </DialogHeader>
          <div class="space-y-4 py-2">
            <div class="grid gap-4 sm:grid-cols-2">
              <div class="space-y-1.5">
                <Label for="edit-plate">Nomor Polisi</Label>
                <Input id="edit-plate" v-model="editVehiclePlate" placeholder="mis. DN 1234 AB" />
              </div>
              <div class="space-y-1.5">
                <Label for="edit-vendor">Vendor</Label>
                <select id="edit-vendor" v-model="editVendorId" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                  <option value="">
                    Belum ditentukan
                  </option>
                  <option v-for="vendor in vendorOptions" :key="vendor.id" :value="vendor.id">
                    {{ vendor.name }}
                  </option>
                </select>
              </div>
              <div class="space-y-1.5">
                <Label for="edit-driver-name">Nama Driver</Label>
                <Input id="edit-driver-name" v-model="editDriverName" />
              </div>
              <div class="space-y-1.5">
                <Label for="edit-driver-phone">Telepon Driver</Label>
                <Input id="edit-driver-phone" v-model="editDriverPhone" placeholder="08xx-xxxx-xxxx" />
              </div>
              <div class="space-y-1.5">
                <Label for="edit-toll">Toll Fee (Rp)</Label>
                <Input id="edit-toll" v-model.number="editTollFee" type="number" />
              </div>
              <div class="space-y-1.5">
                <Label for="edit-standby">Standby (jam)</Label>
                <Input id="edit-standby" v-model.number="editStandbyHours" type="number" />
              </div>
              <div class="space-y-1.5">
                <Label for="edit-overtime">Overtime (jam)</Label>
                <Input id="edit-overtime" v-model.number="editOvertimeHours" type="number" />
              </div>
              <div class="space-y-1.5">
                <Label for="edit-net-cost">Net Cost (Rp, internal)</Label>
                <Input id="edit-net-cost" v-model.number="editNetCost" type="number" />
              </div>
              <div class="space-y-1.5">
                <Label for="edit-sell-price">Sell Price (Rp, client)</Label>
                <Input id="edit-sell-price" v-model.number="editSellPrice" type="number" />
              </div>
            </div>

            <div class="space-y-2 pt-2 border-t border-border">
              <div class="flex items-center justify-between">
                <Label>Transport Options</Label>
                <Button size="sm" variant="outline" type="button" @click="addOptionRow">
                  <Plus class="h-3.5 w-3.5 mr-1" />Tambah
                </Button>
              </div>
              <div v-for="(option, index) in editOptions" :key="index" class="grid grid-cols-12 gap-2 items-center">
                <select v-model="option.vehicleType" class="col-span-2 appearance-none px-2 py-1.5 text-xs rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                  <option v-for="vt in VEHICLE_TYPES" :key="vt.value" :value="vt.value">
                    {{ vt.label }}
                  </option>
                </select>
                <Input v-model.number="option.capacity" type="number" placeholder="Kapasitas" class="col-span-2 h-8 text-xs" />
                <Input v-model="option.luggageCapacity" placeholder="Bagasi" class="col-span-2 h-8 text-xs" />
                <Input v-model="option.accessibilityFeatures" placeholder="Aksesibilitas" class="col-span-3 h-8 text-xs" />
                <Input v-model.number="option.ratePerUnitIdr" type="number" placeholder="Rate" class="col-span-2 h-8 text-xs" />
                <button type="button" class="col-span-1 text-muted-foreground hover:text-destructive" @click="removeOptionRow(index)">
                  <Trash2 class="h-4 w-4" />
                </button>
              </div>
              <p v-if="editOptions.length === 0" class="text-xs text-muted-foreground">
                Belum ada opsi — klik "Tambah".
              </p>
            </div>

            <div class="space-y-2 pt-2 border-t border-border">
              <div class="flex items-center justify-between">
                <Label>Dispatch / Legs</Label>
                <Button size="sm" variant="outline" type="button" @click="addLegRow">
                  <Plus class="h-3.5 w-3.5 mr-1" />Tambah
                </Button>
              </div>
              <div v-for="(leg, index) in editLegs" :key="index" class="grid grid-cols-12 gap-2 items-center">
                <Input v-model="leg.pickupLocation" placeholder="Pickup" class="col-span-3 h-8 text-xs" />
                <Input v-model="leg.dropoffLocation" placeholder="Drop-off" class="col-span-3 h-8 text-xs" />
                <Input v-model="leg.label" placeholder="Label (opsional)" class="col-span-2 h-8 text-xs" />
                <Input v-model="leg.scheduledAt" type="datetime-local" class="col-span-3 h-8 text-xs" />
                <button type="button" class="col-span-1 text-muted-foreground hover:text-destructive" @click="removeLegRow(index)">
                  <Trash2 class="h-4 w-4" />
                </button>
              </div>
              <p v-if="editLegs.length === 0" class="text-xs text-muted-foreground">
                Belum ada leg — klik "Tambah".
              </p>
            </div>

            <div class="space-y-2 pt-2 border-t border-border">
              <Label>Manifest / Group Allocation</Label>
              <div class="flex flex-wrap gap-2">
                <label v-for="t in projectTravelers" :key="t.id" class="flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg border border-border cursor-pointer">
                  <Checkbox :model-value="editTravelerIds.includes(t.id)" @update:model-value="toggleEditTraveler(t.id)" />
                  {{ t.name }}
                </label>
              </div>
            </div>

            <div class="space-y-1.5">
              <label class="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                <Checkbox v-model="editHasChange" />
                Tandai Change (perubahan rute/jadwal)
              </label>
              <textarea v-if="editHasChange" v-model="editChangeNote" rows="2" class="w-full px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring" placeholder="Jelaskan perubahan rute/jadwal" />
            </div>
            <div class="space-y-1.5">
              <label class="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                <Checkbox v-model="editHasIncident" />
                Tandai Incident
              </label>
              <textarea v-if="editHasIncident" v-model="editIncidentNote" rows="2" class="w-full px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring" placeholder="Jelaskan insiden operasional" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" @click="isEditOpen = false">
              Batal
            </Button>
            <Button @click="submitEdit">
              Simpan
            </Button>
          </DialogFooter>
        </DialogScrollContent>
      </Dialog>
    </template>
  </div>
</template>
