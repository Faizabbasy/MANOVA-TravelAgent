<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { FileX, Plus, Trash2, Printer } from 'lucide-vue-next'
import {
  getHotelBookingById, getHotelBookingMarginIdr, getHotelBookingStatusTransitions,
  updateHotelBooking, updateHotelBookingStatus, selectHotelOption,
  getProjectById, getTravelers, getHotelRoomingList, getTravelerGroups,
  createCancellationRecord,
} from '~/data'
import { HOTEL_BOOKING_STATUSES, MEAL_PLANS, findStatusOption } from '~/constants/status'
import { formatCurrencyIdr, formatDate } from '~/utils/format'
import type { HotelBookingStatus, HotelOption, MealPlan } from '~/types/accommodation'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const route = useRoute()
const router = useRouter()
const { currentUser } = useCurrentUser()
const { canView, canManage, canViewFinancials } = usePermissions()
const canManageAccommodation = computed(() => canManage('accommodation'))
/** "Internal cost isolation" (Wajib) — Accommodation (pengelola langsung) dan role finansial penuh (D-030) yang melihat net cost; role lain hanya melihat sell price. Pola identik `canViewFlightFinancials` (Section 13). */
const canViewAccommodationFinancials = computed(() => canManageAccommodation.value || canViewFinancials.value)
const { showToast } = useToast()

const booking = computed(() => getHotelBookingById(String(route.params.id)))
useHead({ title: computed(() => booking.value ? `Hotel Booking ${booking.value.id}` : 'Hotel Booking Tidak Ditemukan') })

const project = computed(() => (booking.value ? getProjectById(booking.value.projectId) : undefined))
const projectTravelers = computed(() => (project.value ? getTravelers(project.value.id) : []))
const marginIdr = computed(() => (booking.value ? getHotelBookingMarginIdr(booking.value) : undefined))
const roomingList = computed(() => (booking.value && project.value ? getHotelRoomingList(project.value.id, booking.value.groupId) : []))
const group = computed(() => (booking.value?.groupId && project.value ? getTravelerGroups(project.value.id).find(g => g.id === booking.value?.groupId) : undefined))

function traveler(id: string) {
  return projectTravelers.value.find(t => t.id === id)
}
function travelerName(id: string) {
  return traveler(id)?.name ?? id
}
/** "Traveler special requests" (Wajib) — reuse `Traveler.specialRequest`/`dietaryRestrictions`/`accessibilityNeeds` (Section 11), bukan field baru. */
function travelerSpecialRequest(id: string) {
  const t = traveler(id)
  if (!t) return undefined
  return [t.specialRequest, t.dietaryRestrictions, t.accessibilityNeeds].filter(Boolean).join(' · ') || undefined
}

const summaryMetadata = computed(() => {
  if (!booking.value) return []
  return [
    { label: 'Project', value: project.value?.name ?? booking.value.projectId },
    { label: 'Konfirmasi', value: booking.value.confirmationNumber ?? 'Belum terbit' },
    { label: 'Check-in', value: booking.value.checkInDate ? formatDate(booking.value.checkInDate) : '—' },
    { label: 'Check-out', value: booking.value.checkOutDate ? formatDate(booking.value.checkOutDate) : '—' },
    { label: 'Rooms Blocked', value: booking.value.roomsBlocked !== undefined ? `${booking.value.roomsBlocked} kamar` : '—' },
    { label: 'Traveler', value: `${booking.value.travelerIds.length} pax` },
    { label: 'Dibuat', value: formatDate(booking.value.createdAt) },
  ]
})

/* Status transitions */
const isStatusDialogOpen = ref(false)
const pendingStatus = ref<HotelBookingStatus | null>(null)
const statusReason = ref('')
/** "Cancellation and penalty" (Section 19, D-076) — hook ADITIF, lihat komentar identik `app/pages/ticketing/[id]/index.vue`. */
const CANCELLATION_TRIGGER_STATUSES: HotelBookingStatus[] = ['cancelled', 'no-show']
const cancellationPenalty = ref<number | null>(null)
const cancellationRefundEligible = ref(true)

function statusRequiresReason(status: HotelBookingStatus) {
  return status === 'cancelled' || status === 'no-show'
}

function requestStatusChange(newStatus: HotelBookingStatus) {
  if (statusRequiresReason(newStatus)) {
    pendingStatus.value = newStatus
    statusReason.value = ''
    cancellationPenalty.value = (newStatus === 'no-show' ? booking.value?.noShowPenaltyIdr : booking.value?.cancellationPenaltyIdr) ?? null
    cancellationRefundEligible.value = newStatus !== 'no-show'
    isStatusDialogOpen.value = true
    return
  }
  if (!booking.value) return
  updateHotelBookingStatus(booking.value.id, newStatus, currentUser.value.id)
  showToast('Status Diperbarui', `Hotel Booking kini berstatus "${findStatusOption(HOTEL_BOOKING_STATUSES, newStatus).label}".`, 'success')
}

function submitStatusChange() {
  if (!booking.value || !pendingStatus.value || !statusReason.value.trim()) return
  const targetStatus = pendingStatus.value
  const result = updateHotelBookingStatus(booking.value.id, targetStatus, currentUser.value.id, statusReason.value.trim())
  isStatusDialogOpen.value = false
  if (!result) return
  if (CANCELLATION_TRIGGER_STATUSES.includes(targetStatus)) {
    createCancellationRecord({
      projectId: result.projectId, bookingType: 'hotel', bookingId: result.id,
      reason: statusReason.value.trim(), penaltyIdr: cancellationPenalty.value ?? undefined,
      cancelledBy: currentUser.value.id, refundEligible: cancellationRefundEligible.value,
    })
  }
  showToast('Status Diperbarui', `Hotel Booking kini berstatus "${findStatusOption(HOTEL_BOOKING_STATUSES, targetStatus).label}".`, 'success')
}

function submitSelectOption(index: number) {
  if (!booking.value) return
  selectHotelOption(booking.value.id, index)
}

/* Edit dialog — whole-form, pola sama Flight Booking (Section 13). */
const isEditOpen = ref(false)
const editConfirmationNumber = ref('')
const editCheckInDate = ref('')
const editCheckOutDate = ref('')
const editCancellationDeadline = ref('')
const editRoomsBlocked = ref<number | null>(null)
const editEarlyCheckIn = ref(false)
const editLateCheckOut = ref(false)
const editAmendmentNote = ref('')
const editNetCost = ref<number | null>(null)
const editSellPrice = ref<number | null>(null)
const editCancellationPenalty = ref<number | null>(null)
const editNoShowPenalty = ref<number | null>(null)
const editTravelerIds = ref<string[]>([])
const editOptions = ref<HotelOption[]>([])

function openEditDialog() {
  if (!booking.value) return
  editConfirmationNumber.value = booking.value.confirmationNumber ?? ''
  editCheckInDate.value = booking.value.checkInDate ?? ''
  editCheckOutDate.value = booking.value.checkOutDate ?? ''
  editCancellationDeadline.value = booking.value.cancellationDeadline ?? ''
  editRoomsBlocked.value = booking.value.roomsBlocked ?? null
  editEarlyCheckIn.value = booking.value.earlyCheckInRequested ?? false
  editLateCheckOut.value = booking.value.lateCheckOutRequested ?? false
  editAmendmentNote.value = booking.value.amendmentNote ?? ''
  editNetCost.value = booking.value.netCostIdr ?? null
  editSellPrice.value = booking.value.sellPriceIdr ?? null
  editCancellationPenalty.value = booking.value.cancellationPenaltyIdr ?? null
  editNoShowPenalty.value = booking.value.noShowPenaltyIdr ?? null
  editTravelerIds.value = [...booking.value.travelerIds]
  editOptions.value = booking.value.options.map(option => ({ ...option }))
  isEditOpen.value = true
}

function toggleEditTraveler(travelerId: string) {
  editTravelerIds.value = editTravelerIds.value.includes(travelerId)
    ? editTravelerIds.value.filter(id => id !== travelerId)
    : [...editTravelerIds.value, travelerId]
}

function addOptionRow() {
  editOptions.value.push({ propertyName: '', roomType: '', ratePlan: '', mealPlan: 'room-only', ratePerNightIdr: 0 })
}
function removeOptionRow(index: number) {
  editOptions.value.splice(index, 1)
}

function submitEdit() {
  if (!booking.value) return
  updateHotelBooking(booking.value.id, {
    confirmationNumber: editConfirmationNumber.value.trim() || undefined,
    checkInDate: editCheckInDate.value || undefined,
    checkOutDate: editCheckOutDate.value || undefined,
    cancellationDeadline: editCancellationDeadline.value || undefined,
    roomsBlocked: editRoomsBlocked.value ?? undefined,
    earlyCheckInRequested: editEarlyCheckIn.value || undefined,
    lateCheckOutRequested: editLateCheckOut.value || undefined,
    amendmentNote: editAmendmentNote.value.trim() || undefined,
    netCostIdr: editNetCost.value ?? undefined,
    sellPriceIdr: editSellPrice.value ?? undefined,
    cancellationPenaltyIdr: editCancellationPenalty.value ?? undefined,
    noShowPenaltyIdr: editNoShowPenalty.value ?? undefined,
    travelerIds: editTravelerIds.value,
    options: editOptions.value.filter(option => option.propertyName.trim() && option.roomType.trim() && option.ratePerNightIdr > 0),
  })
  isEditOpen.value = false
  showToast('Hotel Booking Diperbarui', 'Perubahan berhasil disimpan.', 'success')
}
</script>

<template>
  <div class="space-y-6">
    <template v-if="!booking">
      <PageHeader title="Hotel Booking Tidak Ditemukan" :breadcrumb="[{ label: 'Accommodation', to: '/accommodation' }, { label: 'Not Found' }]" />
      <SectionCard>
        <EmptyState
          :icon="FileX"
          title="Hotel Booking tidak ditemukan"
          :description="`Hotel Booking dengan ID '${route.params.id}' tidak ada di data demo saat ini.`"
        >
          <Button @click="router.push('/accommodation')">Kembali ke Daftar Accommodation</Button>
        </EmptyState>
      </SectionCard>
    </template>

    <RoleAccessState v-else-if="!canView('accommodation')" module-label="modul Accommodation" />

    <template v-else>
      <PageHeader :title="`Hotel Booking ${booking.id}`" :breadcrumb="[{ label: 'Accommodation', to: '/accommodation' }, { label: booking.id }]">
        <template #actions>
          <div class="flex flex-wrap items-center gap-2">
            <StatusBadge :label="findStatusOption(HOTEL_BOOKING_STATUSES, booking.status).label" :tone="findStatusOption(HOTEL_BOOKING_STATUSES, booking.status).tone" />
            <NuxtLink :to="`/accommodation/${booking.id}/voucher-preview`" target="_blank">
              <Button size="sm" variant="outline"><Printer class="h-4 w-4 mr-1.5" />Voucher Preview</Button>
            </NuxtLink>
            <template v-if="canManageAccommodation">
              <Button size="sm" variant="outline" @click="openEditDialog">Edit</Button>
              <Button
                v-for="next in getHotelBookingStatusTransitions(booking.status)" :key="next"
                size="sm" :variant="next === 'cancelled' || next === 'no-show' ? 'destructive' : 'outline'"
                @click="requestStatusChange(next)"
              >{{ findStatusOption(HOTEL_BOOKING_STATUSES, next).label }}</Button>
            </template>
          </div>
        </template>
      </PageHeader>

      <div v-if="booking.status === 'amended' && booking.amendmentNote" class="rounded-lg border border-purple-500/40 bg-purple-500/5 px-4 py-3 text-sm">
        <p class="font-semibold text-foreground">Amendment</p>
        <p class="text-muted-foreground mt-1">{{ booking.amendmentNote }}</p>
      </div>

      <SectionCard>
        <DetailMetadataList :items="summaryMetadata" />
        <div v-if="booking.earlyCheckInRequested || booking.lateCheckOutRequested" class="mt-3 flex flex-wrap gap-2">
          <StatusBadge v-if="booking.earlyCheckInRequested" label="Early Check-in Diminta" tone="info" />
          <StatusBadge v-if="booking.lateCheckOutRequested" label="Late Check-out Diminta" tone="info" />
        </div>
      </SectionCard>

      <SectionCard title="Hotel Options" description="Property, room type, rate plan, meal plan, dan policies per opsi yang dibandingkan.">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Property</TableHead>
              <TableHead>Room Type</TableHead>
              <TableHead>Rate Plan</TableHead>
              <TableHead>Meal</TableHead>
              <TableHead>Rate/Malam</TableHead>
              <TableHead>Policies</TableHead>
              <TableHead v-if="canManageAccommodation">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="(option, index) in booking.options" :key="index">
              <TableCell class="text-foreground">{{ option.propertyName }}</TableCell>
              <TableCell class="text-muted-foreground">{{ option.roomType }}</TableCell>
              <TableCell class="text-muted-foreground">{{ option.ratePlan }}</TableCell>
              <TableCell><StatusBadge :label="findStatusOption(MEAL_PLANS, option.mealPlan).label" :tone="findStatusOption(MEAL_PLANS, option.mealPlan).tone" /></TableCell>
              <TableCell class="text-foreground">{{ formatCurrencyIdr(option.ratePerNightIdr) }}</TableCell>
              <TableCell class="text-muted-foreground">{{ option.policies ?? '—' }}</TableCell>
              <TableCell v-if="canManageAccommodation">
                <StatusBadge v-if="option.isSelected" label="Dipilih" tone="success" />
                <Button v-else size="sm" variant="ghost" @click="submitSelectOption(index)">Pilih</Button>
              </TableCell>
            </TableRow>
            <TableEmpty v-if="booking.options.length === 0" :colspan="canManageAccommodation ? 7 : 6">Belum ada opsi tercatat.</TableEmpty>
          </TableBody>
        </Table>
      </SectionCard>

      <SectionCard
        title="Room Block / Rooming List"
        :description="group ? `Group: ${group.name}${group.roomingNote ? ` — ${group.roomingNote}` : ''}` : `${booking.roomsBlocked ?? 0} kamar diblok`"
      >
        <ul v-if="roomingList.length" class="divide-y divide-border">
          <li v-for="room in roomingList" :key="room.id" class="py-2 flex items-center justify-between gap-2">
            <div class="min-w-0">
              <p class="text-sm font-medium text-foreground">{{ room.roomLabel }}</p>
              <p class="text-xs text-muted-foreground">{{ room.travelerIds.map(travelerName).join(', ') || 'Belum ada traveler ditugaskan' }}</p>
            </div>
            <StatusBadge :label="room.roomType" tone="info" />
          </li>
        </ul>
        <EmptyState v-else title="Belum ada rooming list tercatat" description="Rooming list per kamar dikelola di tab Travelers Project Detail (Section 11) — booking ini belum ditautkan ke group manapun, atau belum ada kamar ter-assign." />
      </SectionCard>

      <SectionCard title="Traveler / Special Requests" :description="`${booking.travelerIds.length} traveler ditugaskan pada booking ini`">
        <ul v-if="booking.travelerIds.length" class="divide-y divide-border">
          <li v-for="travelerId in booking.travelerIds" :key="travelerId" class="py-2">
            <p class="text-sm font-medium text-foreground">{{ travelerName(travelerId) }}</p>
            <p v-if="travelerSpecialRequest(travelerId)" class="text-xs text-muted-foreground mt-0.5">{{ travelerSpecialRequest(travelerId) }}</p>
          </li>
        </ul>
        <EmptyState v-else title="Belum ada traveler ditugaskan" />
      </SectionCard>

      <SectionCard title="Financial" description="Cancellation deadline, penalty, dan dampak finansial.">
        <div class="grid gap-3 sm:grid-cols-3 mb-3">
          <div v-if="canViewAccommodationFinancials" class="rounded-lg border border-border p-3">
            <p class="text-xs text-muted-foreground">Net Cost (Internal)</p>
            <p class="text-lg font-semibold text-foreground">{{ booking.netCostIdr !== undefined ? formatCurrencyIdr(booking.netCostIdr) : '—' }}</p>
          </div>
          <div class="rounded-lg border border-border p-3">
            <p class="text-xs text-muted-foreground">Sell Price (Client)</p>
            <p class="text-lg font-semibold text-foreground">{{ booking.sellPriceIdr !== undefined ? formatCurrencyIdr(booking.sellPriceIdr) : '—' }}</p>
          </div>
          <div v-if="canViewAccommodationFinancials" class="rounded-lg border border-border p-3">
            <p class="text-xs text-muted-foreground">Margin</p>
            <p class="text-lg font-semibold text-foreground">{{ marginIdr !== undefined ? formatCurrencyIdr(marginIdr) : '—' }}</p>
          </div>
        </div>
        <div class="grid gap-3 sm:grid-cols-3 mb-3 text-sm">
          <p class="text-muted-foreground">Cancellation Deadline: <span class="text-foreground">{{ booking.cancellationDeadline ? formatDate(booking.cancellationDeadline) : '—' }}</span></p>
          <p class="text-muted-foreground">Cancellation Penalty: <span class="text-foreground">{{ booking.cancellationPenaltyIdr !== undefined ? formatCurrencyIdr(booking.cancellationPenaltyIdr) : '—' }}</span></p>
          <p class="text-muted-foreground">No-Show Penalty: <span class="text-foreground">{{ booking.noShowPenaltyIdr !== undefined ? formatCurrencyIdr(booking.noShowPenaltyIdr) : '—' }}</span></p>
        </div>
        <p v-if="booking.statusReason" class="text-sm text-foreground whitespace-pre-line">{{ booking.statusReason }}</p>
        <p v-if="!canViewAccommodationFinancials" class="mt-2 text-xs text-muted-foreground">Net cost internal tidak ditampilkan untuk role ini.</p>
      </SectionCard>

      <!-- Status change dialog (cancelled/no-show — reason wajib) -->
      <Dialog v-model:open="isStatusDialogOpen">
        <DialogContent class="max-w-md">
          <DialogHeader>
            <DialogTitle>{{ pendingStatus ? findStatusOption(HOTEL_BOOKING_STATUSES, pendingStatus).label : '' }} Hotel Booking</DialogTitle>
            <DialogDescription>Alasan wajib dicatat untuk transisi ini — akan tersimpan sebagai jejak historis di Activity & Changes project terkait.</DialogDescription>
          </DialogHeader>
          <div class="space-y-4 py-2">
            <div class="space-y-1.5">
              <Label for="status-reason">Alasan</Label>
              <Input id="status-reason" v-model="statusReason" placeholder="mis. Traveler membatalkan menginap" />
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
              <p class="text-xs text-muted-foreground">Sebuah Cancellation Record akan otomatis dicatat (Section 19) — dapat ditindaklanjuti dengan Refund Request di modul Changes & Incidents.</p>
            </template>
          </div>
          <DialogFooter>
            <Button variant="outline" @click="isStatusDialogOpen = false">Batal</Button>
            <Button variant="destructive" :disabled="!statusReason.trim()" @click="submitStatusChange">Konfirmasi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <!-- Edit dialog -->
      <Dialog v-model:open="isEditOpen">
        <DialogScrollContent class="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Hotel Booking</DialogTitle>
            <DialogDescription>Perubahan berlaku langsung — status lifecycle diubah lewat tombol terpisah di header.</DialogDescription>
          </DialogHeader>
          <div class="space-y-4 py-2">
            <div class="grid gap-4 sm:grid-cols-2">
              <div class="space-y-1.5">
                <Label for="edit-confirmation">Nomor Konfirmasi</Label>
                <Input id="edit-confirmation" v-model="editConfirmationNumber" placeholder="mis. AUH-A104" />
              </div>
              <div class="space-y-1.5">
                <Label for="edit-rooms-blocked">Rooms Blocked</Label>
                <Input id="edit-rooms-blocked" v-model.number="editRoomsBlocked" type="number" />
              </div>
              <div class="space-y-1.5">
                <Label for="edit-checkin">Check-in</Label>
                <Input id="edit-checkin" v-model="editCheckInDate" type="date" />
              </div>
              <div class="space-y-1.5">
                <Label for="edit-checkout">Check-out</Label>
                <Input id="edit-checkout" v-model="editCheckOutDate" type="date" />
              </div>
              <div class="space-y-1.5">
                <Label for="edit-deadline">Cancellation Deadline</Label>
                <Input id="edit-deadline" v-model="editCancellationDeadline" type="date" />
              </div>
              <div class="space-y-1.5">
                <Label for="edit-net-cost">Net Cost (Rp, internal)</Label>
                <Input id="edit-net-cost" v-model.number="editNetCost" type="number" />
              </div>
              <div class="space-y-1.5">
                <Label for="edit-sell-price">Sell Price (Rp, client)</Label>
                <Input id="edit-sell-price" v-model.number="editSellPrice" type="number" />
              </div>
              <div class="space-y-1.5">
                <Label for="edit-cancel-penalty">Cancellation Penalty (Rp)</Label>
                <Input id="edit-cancel-penalty" v-model.number="editCancellationPenalty" type="number" />
              </div>
              <div class="space-y-1.5">
                <Label for="edit-noshow-penalty">No-Show Penalty (Rp)</Label>
                <Input id="edit-noshow-penalty" v-model.number="editNoShowPenalty" type="number" />
              </div>
            </div>

            <div class="flex flex-wrap gap-4">
              <label class="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                <Checkbox v-model="editEarlyCheckIn" />
                Early Check-in Diminta
              </label>
              <label class="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                <Checkbox v-model="editLateCheckOut" />
                Late Check-out Diminta
              </label>
            </div>

            <div class="space-y-2 pt-2 border-t border-border">
              <div class="flex items-center justify-between">
                <Label>Hotel Options</Label>
                <Button size="sm" variant="outline" type="button" @click="addOptionRow"><Plus class="h-3.5 w-3.5 mr-1" />Tambah</Button>
              </div>
              <div v-for="(option, index) in editOptions" :key="index" class="grid grid-cols-12 gap-2 items-center">
                <Input v-model="option.propertyName" placeholder="Property" class="col-span-3 h-8 text-xs" />
                <Input v-model="option.roomType" placeholder="Room Type" class="col-span-2 h-8 text-xs" />
                <Input v-model="option.ratePlan" placeholder="Rate Plan" class="col-span-2 h-8 text-xs" />
                <select v-model="option.mealPlan" class="col-span-2 appearance-none px-2 py-1.5 text-xs rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                  <option v-for="meal in MEAL_PLANS" :key="meal.value" :value="meal.value">{{ meal.label }}</option>
                </select>
                <Input v-model.number="option.ratePerNightIdr" type="number" placeholder="Rate/Malam" class="col-span-2 h-8 text-xs" />
                <button type="button" class="col-span-1 text-muted-foreground hover:text-destructive" @click="removeOptionRow(index)"><Trash2 class="h-4 w-4" /></button>
                <Input v-model="option.policies" placeholder="Policies (opsional)" class="col-span-11 h-8 text-xs" />
              </div>
              <p v-if="editOptions.length === 0" class="text-xs text-muted-foreground">Belum ada opsi — klik "Tambah".</p>
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
              <Label for="edit-amendment-note">Amendment Note</Label>
              <textarea id="edit-amendment-note" v-model="editAmendmentNote" rows="2" class="w-full px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring" placeholder="Jelaskan perubahan (mis. upgrade tipe kamar)" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" @click="isEditOpen = false">Batal</Button>
            <Button @click="submitEdit">Simpan</Button>
          </DialogFooter>
        </DialogScrollContent>
      </Dialog>
    </template>
  </div>
</template>
