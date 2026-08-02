<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { FileX, Plus, Trash2, Printer } from 'lucide-vue-next'
import {
  getFlightBookingById, getFlightBookingMarginIdr, getFlightBookingStatusTransitions,
  updateFlightBooking, updateFlightBookingStatus, selectFlightOption,
  getProjectById, getTravelers,
  createCancellationRecord
} from '~/data'
import { FLIGHT_BOOKING_STATUSES, CABIN_CLASSES, findStatusOption } from '~/constants/status'
import { formatCurrencyIdr, formatDate, formatDateTime } from '~/utils/format'
import type { FlightBookingStatus, FlightOption, FlightSegment } from '~/types/ticketing'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const route = useRoute()
const router = useRouter()
const { currentUser } = useCurrentUser()
const { canView, canManage, canViewFinancials } = usePermissions()
const canManageTicketing = computed(() => canManage('ticketing'))
/** "Internal net cost vs client sell price" (Wajib) — Ticketing (pengelola langsung) dan role finansial penuh (D-030) yang melihat net cost; role lain hanya melihat sell price. */
const canViewFlightFinancials = computed(() => canManageTicketing.value || canViewFinancials.value)
const { showToast } = useToast()

const booking = computed(() => getFlightBookingById(String(route.params.id)))
useHead({ title: computed(() => booking.value ? `Flight Booking ${booking.value.id}` : 'Flight Booking Tidak Ditemukan') })

const project = computed(() => (booking.value ? getProjectById(booking.value.projectId) : undefined))
const projectTravelers = computed(() => (project.value ? getTravelers(project.value.id) : []))
const marginIdr = computed(() => (booking.value ? getFlightBookingMarginIdr(booking.value) : undefined))

function travelerName (id: string) {
  return projectTravelers.value.find(traveler => traveler.id === id)?.name ?? id
}

const summaryMetadata = computed(() => {
  if (!booking.value) { return [] }
  return [
    { label: 'Project', value: project.value?.name ?? booking.value.projectId },
    { label: 'PNR', value: booking.value.pnr ?? 'Belum terbit' },
    { label: 'Ticketing Deadline', value: booking.value.ticketingDeadline ? formatDate(booking.value.ticketingDeadline) : '—' },
    { label: 'Traveler', value: `${booking.value.travelerIds.length} pax` },
    { label: 'Dibuat', value: formatDate(booking.value.createdAt) }
  ]
})

/* Status transitions */
const isStatusDialogOpen = ref(false)
const pendingStatus = ref<FlightBookingStatus | null>(null)
const statusReason = ref('')
/**
 * "Cancellation and penalty" (Section 19, D-076) — hook ADITIF alongside (bukan menggantikan) alur
 * mandatory-reason cancel existing (Section 13, LOCKED). `createCancellationRecord` dipanggil SETELAH
 * `updateFlightBookingStatus` berhasil, tidak pernah mengubah guard/transition-map/reason-wajib di atas.
 */
const CANCELLATION_TRIGGER_STATUSES: FlightBookingStatus[] = ['cancelled', 'refunded']
const cancellationPenalty = ref<number | null>(null)
const cancellationRefundEligible = ref(true)

function statusRequiresReason (status: FlightBookingStatus) {
  return status === 'cancelled' || status === 'refunded'
}

function requestStatusChange (newStatus: FlightBookingStatus) {
  if (statusRequiresReason(newStatus)) {
    pendingStatus.value = newStatus
    statusReason.value = ''
    cancellationPenalty.value = null
    cancellationRefundEligible.value = newStatus !== 'refunded'
    isStatusDialogOpen.value = true
    return
  }
  if (!booking.value) { return }
  updateFlightBookingStatus(booking.value.id, newStatus, currentUser.value.id)
  showToast('Status Diperbarui', `Flight Booking kini berstatus "${findStatusOption(FLIGHT_BOOKING_STATUSES, newStatus).label}".`, 'success')
}

function submitStatusChange () {
  if (!booking.value || !pendingStatus.value || !statusReason.value.trim()) { return }
  const targetStatus = pendingStatus.value
  const result = updateFlightBookingStatus(booking.value.id, targetStatus, currentUser.value.id, statusReason.value.trim())
  isStatusDialogOpen.value = false
  if (!result) { return }
  if (CANCELLATION_TRIGGER_STATUSES.includes(targetStatus)) {
    createCancellationRecord({
      projectId: result.projectId,
      bookingType: 'flight',
      bookingId: result.id,
      reason: statusReason.value.trim(),
      penaltyIdr: cancellationPenalty.value ?? undefined,
      cancelledBy: currentUser.value.id,
      refundEligible: cancellationRefundEligible.value
    })
  }
  showToast('Status Diperbarui', `Flight Booking kini berstatus "${findStatusOption(FLIGHT_BOOKING_STATUSES, targetStatus).label}".`, 'success')
}

function submitSelectOption (index: number) {
  if (!booking.value) { return }
  selectFlightOption(booking.value.id, index)
}

/* Edit dialog — whole-form, pola sama Cost Sheet (Section 10). */
const isEditOpen = ref(false)
const editPnr = ref('')
const editTicketingDeadline = ref('')
const editFareRules = ref('')
const editNetCost = ref<number | null>(null)
const editSellPrice = ref<number | null>(null)
const editHasScheduleChange = ref(false)
const editScheduleChangeNote = ref('')
const editTravelerIds = ref<string[]>([])
const editOptions = ref<FlightOption[]>([])
const editSegments = ref<FlightSegment[]>([])

function openEditDialog () {
  if (!booking.value) { return }
  editPnr.value = booking.value.pnr ?? ''
  editTicketingDeadline.value = booking.value.ticketingDeadline ?? ''
  editFareRules.value = booking.value.fareRules ?? ''
  editNetCost.value = booking.value.netCostIdr ?? null
  editSellPrice.value = booking.value.sellPriceIdr ?? null
  editHasScheduleChange.value = booking.value.hasScheduleChange ?? false
  editScheduleChangeNote.value = booking.value.scheduleChangeNote ?? ''
  editTravelerIds.value = [...booking.value.travelerIds]
  editOptions.value = booking.value.options.map(option => ({ ...option }))
  editSegments.value = booking.value.segments.map(segment => ({ ...segment }))
  isEditOpen.value = true
}

function toggleEditTraveler (travelerId: string) {
  editTravelerIds.value = editTravelerIds.value.includes(travelerId)
    ? editTravelerIds.value.filter(id => id !== travelerId)
    : [...editTravelerIds.value, travelerId]
}

function addOptionRow () {
  editOptions.value.push({ airline: '', cabinClass: 'economy', fareIdr: 0 })
}
function removeOptionRow (index: number) {
  editOptions.value.splice(index, 1)
}

function addSegmentRow () {
  editSegments.value.push({ origin: '', destination: '', departureAt: '' })
}
function removeSegmentRow (index: number) {
  editSegments.value.splice(index, 1)
}

function submitEdit () {
  if (!booking.value) { return }
  updateFlightBooking(booking.value.id, {
    pnr: editPnr.value.trim() || undefined,
    ticketingDeadline: editTicketingDeadline.value || undefined,
    fareRules: editFareRules.value.trim() || undefined,
    netCostIdr: editNetCost.value ?? undefined,
    sellPriceIdr: editSellPrice.value ?? undefined,
    hasScheduleChange: editHasScheduleChange.value || undefined,
    scheduleChangeNote: editScheduleChangeNote.value.trim() || undefined,
    travelerIds: editTravelerIds.value,
    options: editOptions.value.filter(option => option.airline.trim() && option.fareIdr > 0),
    segments: editSegments.value.filter(segment => segment.origin.trim() && segment.destination.trim() && segment.departureAt.trim())
  })
  isEditOpen.value = false
  showToast('Flight Booking Diperbarui', 'Perubahan berhasil disimpan.', 'success')
}
</script>

<template>
  <div class="space-y-6">
    <template v-if="!booking">
      <PageHeader title="Flight Booking Tidak Ditemukan" :breadcrumb="[{ label: 'Ticketing', to: '/ticketing' }, { label: 'Not Found' }]" />
      <SectionCard>
        <EmptyState
          :icon="FileX"
          title="Flight Booking tidak ditemukan"
          :description="`Flight Booking dengan ID '${route.params.id}' tidak ada di data demo saat ini.`"
        >
          <Button @click="router.push('/ticketing')">
            Kembali ke Daftar Ticketing
          </Button>
        </EmptyState>
      </SectionCard>
    </template>

    <RoleAccessState v-else-if="!canView('ticketing')" module-label="modul Ticketing" />

    <template v-else>
      <PageHeader :title="`Flight Booking ${booking.id}`" :breadcrumb="[{ label: 'Ticketing', to: '/ticketing' }, { label: booking.id }]">
        <template #actions>
          <div class="flex flex-wrap items-center gap-2">
            <StatusBadge :label="findStatusOption(FLIGHT_BOOKING_STATUSES, booking.status).label" :tone="findStatusOption(FLIGHT_BOOKING_STATUSES, booking.status).tone" />
            <NuxtLink :to="`/ticketing/${booking.id}/eticket-preview`" target="_blank">
              <Button size="sm" variant="outline">
                <Printer class="h-4 w-4 mr-1.5" />E-Ticket Preview
              </Button>
            </NuxtLink>
            <template v-if="canManageTicketing">
              <Button size="sm" variant="outline" @click="openEditDialog">
                Edit
              </Button>
              <Button
                v-for="next in getFlightBookingStatusTransitions(booking.status)"
                :key="next"
                size="sm"
                :variant="next === 'cancelled' || next === 'refunded' ? 'destructive' : 'outline'"
                @click="requestStatusChange(next)"
              >
                {{ findStatusOption(FLIGHT_BOOKING_STATUSES, next).label }}
              </Button>
            </template>
          </div>
        </template>
      </PageHeader>

      <div v-if="booking.hasScheduleChange" class="rounded-lg border border-amber-500/40 bg-amber-500/5 px-4 py-3 text-sm">
        <p class="font-semibold text-foreground">
          Schedule Change / Disruption
        </p>
        <p class="text-muted-foreground mt-1">
          {{ booking.scheduleChangeNote || 'Terjadi perubahan jadwal — detail belum dicatat.' }}
        </p>
      </div>

      <SectionCard>
        <DetailMetadataList :items="summaryMetadata" />
      </SectionCard>

      <SectionCard title="Flight Options" description="Fare, cabin, baggage, dan ancillary per opsi maskapai yang dibandingkan.">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Maskapai</TableHead>
              <TableHead>Cabin</TableHead>
              <TableHead>Fare</TableHead>
              <TableHead>Bagasi</TableHead>
              <TableHead>Ancillary</TableHead>
              <TableHead v-if="canManageTicketing">
                Aksi
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="(option, index) in booking.options" :key="index">
              <TableCell class="text-foreground">
                {{ option.airline }}
              </TableCell>
              <TableCell><StatusBadge :label="findStatusOption(CABIN_CLASSES, option.cabinClass).label" :tone="findStatusOption(CABIN_CLASSES, option.cabinClass).tone" /></TableCell>
              <TableCell class="text-foreground">
                {{ formatCurrencyIdr(option.fareIdr) }}
              </TableCell>
              <TableCell class="text-muted-foreground">
                {{ option.baggageAllowance ?? '—' }}
              </TableCell>
              <TableCell class="text-muted-foreground">
                {{ option.ancillaries ?? '—' }}
              </TableCell>
              <TableCell v-if="canManageTicketing">
                <StatusBadge v-if="option.isSelected" label="Dipilih" tone="success" />
                <Button v-else size="sm" variant="ghost" @click="submitSelectOption(index)">
                  Pilih
                </Button>
              </TableCell>
            </TableRow>
            <TableEmpty v-if="booking.options.length === 0" :colspan="canManageTicketing ? 6 : 5">
              Belum ada opsi tercatat.
            </TableEmpty>
          </TableBody>
        </Table>
      </SectionCard>

      <SectionCard title="Segments">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Rute</TableHead>
              <TableHead>Nomor Penerbangan</TableHead>
              <TableHead>Keberangkatan</TableHead>
              <TableHead>Kedatangan</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="(segment, index) in booking.segments" :key="index">
              <TableCell class="text-foreground">
                {{ segment.origin }} → {{ segment.destination }}
              </TableCell>
              <TableCell class="text-muted-foreground">
                {{ segment.flightNumber ?? '—' }}
              </TableCell>
              <TableCell class="text-muted-foreground">
                {{ formatDateTime(segment.departureAt) }}
              </TableCell>
              <TableCell class="text-muted-foreground">
                {{ segment.arrivalAt ? formatDateTime(segment.arrivalAt) : '—' }}
              </TableCell>
            </TableRow>
            <TableEmpty v-if="booking.segments.length === 0" :colspan="4">
              Belum ada segmen tercatat.
            </TableEmpty>
          </TableBody>
        </Table>
      </SectionCard>

      <SectionCard title="Traveler Assignment / Name List" :description="`${booking.travelerIds.length} traveler ditugaskan pada booking ini`">
        <ul v-if="booking.travelerIds.length" class="divide-y divide-border">
          <li v-for="travelerId in booking.travelerIds" :key="travelerId" class="py-2 text-sm text-foreground">
            {{ travelerName(travelerId) }}
          </li>
        </ul>
        <EmptyState v-else title="Belum ada traveler ditugaskan" />
      </SectionCard>

      <SectionCard title="Financial" description="Fare rules dan dampak finansial.">
        <div class="grid gap-3 sm:grid-cols-3 mb-3">
          <div v-if="canViewFlightFinancials" class="rounded-lg border border-border p-3">
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
          <div v-if="canViewFlightFinancials" class="rounded-lg border border-border p-3">
            <p class="text-xs text-muted-foreground">
              Margin
            </p>
            <p class="text-lg font-semibold text-foreground">
              {{ marginIdr !== undefined ? formatCurrencyIdr(marginIdr) : '—' }}
            </p>
          </div>
        </div>
        <p v-if="booking.fareRules" class="text-sm text-foreground whitespace-pre-line">
          {{ booking.fareRules }}
        </p>
        <p v-else class="text-sm text-muted-foreground">
          Belum ada fare rules tercatat.
        </p>
        <p v-if="!canViewFlightFinancials" class="mt-2 text-xs text-muted-foreground">
          Net cost internal tidak ditampilkan untuk role ini.
        </p>
      </SectionCard>

      <!-- Status change dialog (cancelled/refunded — reason wajib) -->
      <Dialog v-model:open="isStatusDialogOpen">
        <DialogContent class="max-w-md">
          <DialogHeader>
            <DialogTitle>{{ pendingStatus ? findStatusOption(FLIGHT_BOOKING_STATUSES, pendingStatus).label : '' }} Flight Booking</DialogTitle>
            <DialogDescription>Alasan wajib dicatat untuk transisi ini — akan tersimpan sebagai jejak historis di Activity & Changes project terkait.</DialogDescription>
          </DialogHeader>
          <div class="space-y-4 py-2">
            <div class="space-y-1.5">
              <Label for="status-reason">Alasan</Label>
              <Input id="status-reason" v-model="statusReason" placeholder="mis. Traveler membatalkan perjalanan" />
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
            <DialogTitle>Edit Flight Booking</DialogTitle>
            <DialogDescription>Perubahan berlaku langsung — status lifecycle diubah lewat tombol terpisah di header.</DialogDescription>
          </DialogHeader>
          <div class="space-y-4 py-2">
            <div class="grid gap-4 sm:grid-cols-2">
              <div class="space-y-1.5">
                <Label for="edit-pnr">PNR</Label>
                <Input id="edit-pnr" v-model="editPnr" placeholder="mis. MNL8201" />
              </div>
              <div class="space-y-1.5">
                <Label for="edit-deadline">Ticketing Deadline</Label>
                <Input id="edit-deadline" v-model="editTicketingDeadline" type="date" />
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
                <Label>Flight Options</Label>
                <Button size="sm" variant="outline" type="button" @click="addOptionRow">
                  <Plus class="h-3.5 w-3.5 mr-1" />Tambah
                </Button>
              </div>
              <div v-for="(option, index) in editOptions" :key="index" class="grid grid-cols-12 gap-2 items-center">
                <Input v-model="option.airline" placeholder="Maskapai" class="col-span-3 h-8 text-xs" />
                <select v-model="option.cabinClass" class="col-span-2 appearance-none px-2 py-1.5 text-xs rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                  <option v-for="cabin in CABIN_CLASSES" :key="cabin.value" :value="cabin.value">
                    {{ cabin.label }}
                  </option>
                </select>
                <Input v-model.number="option.fareIdr" type="number" placeholder="Fare" class="col-span-2 h-8 text-xs" />
                <Input v-model="option.baggageAllowance" placeholder="Bagasi" class="col-span-2 h-8 text-xs" />
                <Input v-model="option.ancillaries" placeholder="Ancillary" class="col-span-2 h-8 text-xs" />
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
                <Label>Segments</Label>
                <Button size="sm" variant="outline" type="button" @click="addSegmentRow">
                  <Plus class="h-3.5 w-3.5 mr-1" />Tambah
                </Button>
              </div>
              <div v-for="(segment, index) in editSegments" :key="index" class="grid grid-cols-12 gap-2 items-center">
                <Input v-model="segment.origin" placeholder="Asal" class="col-span-3 h-8 text-xs" />
                <Input v-model="segment.destination" placeholder="Tujuan" class="col-span-3 h-8 text-xs" />
                <Input v-model="segment.flightNumber" placeholder="No. Penerbangan" class="col-span-2 h-8 text-xs" />
                <Input v-model="segment.departureAt" type="datetime-local" class="col-span-3 h-8 text-xs" />
                <button type="button" class="col-span-1 text-muted-foreground hover:text-destructive" @click="removeSegmentRow(index)">
                  <Trash2 class="h-4 w-4" />
                </button>
              </div>
              <p v-if="editSegments.length === 0" class="text-xs text-muted-foreground">
                Belum ada segmen — klik "Tambah".
              </p>
            </div>

            <div class="space-y-2 pt-2 border-t border-border">
              <Label>Traveler Assignment</Label>
              <div class="flex flex-wrap gap-2">
                <label v-for="traveler in projectTravelers" :key="traveler.id" class="flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg border border-border cursor-pointer">
                  <Checkbox :model-value="editTravelerIds.includes(traveler.id)" @update:model-value="toggleEditTraveler(traveler.id)" />
                  {{ traveler.name }}
                </label>
              </div>
            </div>

            <div class="space-y-1.5 pt-2 border-t border-border">
              <Label for="edit-fare-rules">Fare Rules</Label>
              <textarea id="edit-fare-rules" v-model="editFareRules" rows="2" class="w-full px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>

            <div class="space-y-1.5">
              <label class="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                <Checkbox v-model="editHasScheduleChange" />
                Tandai Schedule Change / Disruption
              </label>
              <textarea v-if="editHasScheduleChange" v-model="editScheduleChangeNote" rows="2" class="w-full px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring" placeholder="Jelaskan perubahan jadwal/gangguan" />
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
