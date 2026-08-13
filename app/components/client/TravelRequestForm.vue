<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { Plus } from 'lucide-vue-next'
import {
  createTravelRequest, updateTravelRequestDraft, submitTravelRequest, addTravelRequestAttachment,
  getTravelRequestAttachments, getTravelRequestSubmitGate
} from '~/data'
import { SERVICE_TYPES } from '~/constants/status'
import type { ServiceTypeKey } from '~/types/project'
import type { TravelRequest } from '~/types/travel-request'

/**
 * Form Travel Request (Repair Phase Section 3 — Request & Commercial, Wajib "Form harus mencakup: General
 * information/Flight/Hotel/Transportation/MICE/Additional service/Attachment"). Dipakai `new.vue` (create)
 * dan `[id]/edit.vue` (edit draft) — diekstrak sebagai shared component sejak konsumen ke-2 (pola Section 1).
 * Memuat aksi Save Draft/Submit sendiri (bukan hanya render field) agar dirty-tracking untuk "Unsaved
 * changes warning" tetap satu sumber kebenaran di satu tempat.
 */
const props = defineProps<{ initial?: TravelRequest }>()
const emit = defineEmits<{ saved: [TravelRequest]; submitted: [TravelRequest] }>()

const { clientScopeId } = usePermissions()
const { currentUser } = useCurrentUser()
const { showToast } = useToast()

function snapshotOf (source?: TravelRequest) {
  return {
    requestName: source?.requestName ?? '',
    tripType: source?.tripType ?? '',
    purpose: source?.purpose ?? '',
    destination: source?.destination ?? '',
    travelStartDate: source?.travelStartDate ?? '',
    travelEndDate: source?.travelEndDate ?? '',
    dateFlexible: source?.dateFlexible ?? false,
    estimatedParticipants: source?.estimatedParticipants ?? null,
    estimatedBudgetIdr: source?.estimatedBudgetIdr ?? null,
    currency: source?.currency ?? 'IDR',
    serviceScope: [...(source?.serviceScope ?? [])] as ServiceTypeKey[],
    flightAirline: source?.flightRequirement?.preferredAirline ?? '',
    flightCabinClass: source?.flightRequirement?.cabinClass ?? '',
    flightNotes: source?.flightRequirement?.notes ?? '',
    hotelStarRating: source?.hotelRequirement?.starRating ?? '',
    hotelRoomType: source?.hotelRequirement?.roomType ?? '',
    hotelNotes: source?.hotelRequirement?.notes ?? '',
    transportVehicleType: source?.transportationRequirement?.vehicleType ?? '',
    transportNotes: source?.transportationRequirement?.notes ?? '',
    miceEventType: source?.miceRequirement?.eventType ?? '',
    miceExpectedAttendees: source?.miceRequirement?.expectedAttendees ?? null,
    miceNotes: source?.miceRequirement?.notes ?? '',
    additionalServicesNote: source?.additionalServicesNote ?? ''
  }
}

const initialSnapshot = snapshotOf(props.initial)
const form = reactive(snapshotOf(props.initial))

const isDirty = computed(() => JSON.stringify(form) !== JSON.stringify(initialSnapshot))
let justNavigated = false

onBeforeRouteLeave(() => {
  if (justNavigated || !isDirty.value) { return true }
  return window.confirm('Anda memiliki perubahan yang belum disimpan. Yakin ingin meninggalkan halaman ini?')
})

function toggleServiceScope (type: ServiceTypeKey) {
  const index = form.serviceScope.indexOf(type)
  if (index === -1) { form.serviceScope.push(type) } else { form.serviceScope.splice(index, 1) }
}

function buildPatch () {
  return {
    requestName: form.requestName.trim(),
    tripType: form.tripType.trim() || undefined,
    purpose: form.purpose.trim() || undefined,
    destination: form.destination.trim(),
    travelStartDate: form.travelStartDate || undefined,
    travelEndDate: form.travelEndDate || undefined,
    dateFlexible: form.dateFlexible,
    estimatedParticipants: form.estimatedParticipants ?? undefined,
    estimatedBudgetIdr: form.estimatedBudgetIdr ?? undefined,
    currency: form.currency.trim() || undefined,
    serviceScope: form.serviceScope,
    flightRequirement: form.serviceScope.includes('flight')
      ? { preferredAirline: form.flightAirline.trim() || undefined, cabinClass: form.flightCabinClass.trim() || undefined, notes: form.flightNotes.trim() || undefined }
      : undefined,
    hotelRequirement: form.serviceScope.includes('hotel')
      ? { starRating: form.hotelStarRating.trim() || undefined, roomType: form.hotelRoomType.trim() || undefined, notes: form.hotelNotes.trim() || undefined }
      : undefined,
    transportationRequirement: form.serviceScope.includes('transportation')
      ? { vehicleType: form.transportVehicleType.trim() || undefined, notes: form.transportNotes.trim() || undefined }
      : undefined,
    miceRequirement: form.serviceScope.includes('mice')
      ? { eventType: form.miceEventType.trim() || undefined, expectedAttendees: form.miceExpectedAttendees ?? undefined, notes: form.miceNotes.trim() || undefined }
      : undefined,
    additionalServicesNote: form.additionalServicesNote.trim() || undefined
  }
}

const submitGateMissing = computed(() => getTravelRequestSubmitGate({ requestName: form.requestName, destination: form.destination, serviceScope: form.serviceScope }))

const isSaving = ref(false)
function saveDraft (): TravelRequest | undefined {
  if (!clientScopeId.value) { return undefined }
  isSaving.value = true
  let result: TravelRequest | undefined
  if (props.initial) {
    result = updateTravelRequestDraft(props.initial.id, buildPatch())
  } else {
    result = createTravelRequest(clientScopeId.value, buildPatch(), currentUser.value.id)
  }
  isSaving.value = false
  return result
}

function submitSaveDraft () {
  const result = saveDraft()
  if (!result) { showToast('Gagal Menyimpan', 'Draft tidak dapat disimpan.', 'error'); return }
  Object.assign(initialSnapshot, snapshotOf(result))
  justNavigated = true
  showToast('Draft Tersimpan', `Travel Request "${result.requestName}" tersimpan sebagai draft.`, 'success')
  emit('saved', result)
}

const isSubmitConfirmOpen = ref(false)
function submitTravelRequestFlow () {
  const draft = saveDraft()
  if (!draft) { showToast('Gagal Mengirim', 'Travel Request tidak dapat disimpan.', 'error'); return }
  const result = submitTravelRequest(draft.id, currentUser.value.id)
  isSubmitConfirmOpen.value = false
  if (!result) { showToast('Gagal Mengirim', 'Lengkapi Nama Permintaan, Destinasi, dan Layanan sebelum mengirim.', 'error'); return }
  justNavigated = true
  showToast('Travel Request Terkirim', `"${result.requestName}" telah dikirim dan sedang ditinjau.`, 'success')
  emit('submitted', result)
}

/* Attachment mock (Wajib) */
const attachmentFileName = ref('')
const attachments = computed(() => (props.initial ? getTravelRequestAttachments(props.initial.id) : []))
function uploadAttachment () {
  if (!props.initial || !attachmentFileName.value.trim()) { return }
  addTravelRequestAttachment(props.initial.id, attachmentFileName.value.trim(), currentUser.value.id)
  attachmentFileName.value = ''
  showToast('Attachment Ditambahkan', 'Metadata attachment tercatat (mock, bukan file upload nyata).', 'success')
}
</script>

<template>
  <div class="space-y-6">
    <SectionCard title="General Information">
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div class="space-y-1.5 sm:col-span-2">
          <Label for="tr-name">Nama Permintaan</Label>
          <Input id="tr-name" v-model="form.requestName" placeholder="mis. Company Outing Bali 2026" />
        </div>
        <div class="space-y-1.5">
          <Label for="tr-trip-type">Trip Type</Label>
          <Input id="tr-trip-type" v-model="form.tripType" placeholder="mis. Incentive Trip" />
        </div>
        <div class="space-y-1.5">
          <Label for="tr-destination">Destinasi</Label>
          <Input id="tr-destination" v-model="form.destination" placeholder="mis. Bali, Indonesia" />
        </div>
        <div class="space-y-1.5 sm:col-span-2">
          <Label for="tr-purpose">Tujuan Perjalanan</Label>
          <textarea id="tr-purpose" v-model="form.purpose" rows="2" class="w-full px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <div class="space-y-1.5">
          <Label for="tr-start">Tanggal Mulai</Label>
          <Input id="tr-start" v-model="form.travelStartDate" type="date" :disabled="form.dateFlexible" />
        </div>
        <div class="space-y-1.5">
          <Label for="tr-end">Tanggal Selesai</Label>
          <Input id="tr-end" v-model="form.travelEndDate" type="date" :disabled="form.dateFlexible" />
        </div>
        <label class="flex items-center gap-2 text-sm text-foreground cursor-pointer sm:col-span-2">
          <Checkbox v-model="form.dateFlexible" />Tanggal fleksibel
        </label>
        <div class="space-y-1.5">
          <Label for="tr-participants">Estimasi Jumlah Peserta</Label>
          <Input id="tr-participants" v-model.number="form.estimatedParticipants" type="number" min="0" />
        </div>
        <div class="space-y-1.5">
          <Label for="tr-budget">Estimasi Budget (IDR)</Label>
          <CurrencyInput id="tr-budget" v-model="form.estimatedBudgetIdr" min="0" />
        </div>
        <div class="space-y-1.5 sm:col-span-2">
          <Label>Layanan yang Dibutuhkan</Label>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="type in SERVICE_TYPES"
              :key="type.value"
              type="button"
              class="rounded-full border px-3 py-1 text-xs transition-colors"
              :class="form.serviceScope.includes(type.value) ? 'border-primary bg-primary/10 text-primary' : 'border-input text-muted-foreground'"
              @click="toggleServiceScope(type.value)"
            >
              {{ type.label }}
            </button>
          </div>
        </div>
      </div>
    </SectionCard>

    <SectionCard v-if="form.serviceScope.includes('flight')" title="Flight Requirement">
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div class="space-y-1.5">
          <Label for="tr-flight-airline">Maskapai Preferensi</Label>
          <Input id="tr-flight-airline" v-model="form.flightAirline" />
        </div>
        <div class="space-y-1.5">
          <Label for="tr-flight-cabin">Kelas Kabin</Label>
          <Input id="tr-flight-cabin" v-model="form.flightCabinClass" placeholder="mis. Economy" />
        </div>
        <div class="space-y-1.5 sm:col-span-2">
          <Label for="tr-flight-notes">Catatan</Label>
          <textarea id="tr-flight-notes" v-model="form.flightNotes" rows="2" class="w-full px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
      </div>
    </SectionCard>

    <SectionCard v-if="form.serviceScope.includes('hotel')" title="Hotel Requirement">
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div class="space-y-1.5">
          <Label for="tr-hotel-star">Star Rating</Label>
          <Input id="tr-hotel-star" v-model="form.hotelStarRating" placeholder="mis. 4-star" />
        </div>
        <div class="space-y-1.5">
          <Label for="tr-hotel-room">Tipe Kamar</Label>
          <Input id="tr-hotel-room" v-model="form.hotelRoomType" placeholder="mis. Twin Sharing" />
        </div>
        <div class="space-y-1.5 sm:col-span-2">
          <Label for="tr-hotel-notes">Catatan</Label>
          <textarea id="tr-hotel-notes" v-model="form.hotelNotes" rows="2" class="w-full px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
      </div>
    </SectionCard>

    <SectionCard v-if="form.serviceScope.includes('transportation')" title="Transportation Requirement">
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div class="space-y-1.5">
          <Label for="tr-transport-vehicle">Tipe Kendaraan</Label>
          <Input id="tr-transport-vehicle" v-model="form.transportVehicleType" placeholder="mis. Bus 40 Seat" />
        </div>
        <div class="space-y-1.5 sm:col-span-2">
          <Label for="tr-transport-notes">Catatan</Label>
          <textarea id="tr-transport-notes" v-model="form.transportNotes" rows="2" class="w-full px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
      </div>
    </SectionCard>

    <SectionCard v-if="form.serviceScope.includes('mice')" title="MICE Requirement">
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div class="space-y-1.5">
          <Label for="tr-mice-type">Jenis Event</Label>
          <Input id="tr-mice-type" v-model="form.miceEventType" placeholder="mis. Conference" />
        </div>
        <div class="space-y-1.5">
          <Label for="tr-mice-attendees">Estimasi Peserta Event</Label>
          <Input id="tr-mice-attendees" v-model.number="form.miceExpectedAttendees" type="number" min="0" />
        </div>
        <div class="space-y-1.5 sm:col-span-2">
          <Label for="tr-mice-notes">Catatan</Label>
          <textarea id="tr-mice-notes" v-model="form.miceNotes" rows="2" class="w-full px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
      </div>
    </SectionCard>

    <SectionCard title="Additional Service">
      <textarea v-model="form.additionalServicesNote" rows="3" class="w-full px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring" placeholder="mis. Kebutuhan visa, asuransi perjalanan, dsb." />
    </SectionCard>

    <SectionCard v-if="initial" title="Attachment" description="Mock — metadata nama file saja, bukan upload file sungguhan.">
      <div class="flex gap-2 mb-3">
        <Input v-model="attachmentFileName" placeholder="mis. Proposal_Acara.pdf" class="max-w-sm" />
        <Button size="sm" variant="outline" :disabled="!attachmentFileName.trim()" @click="uploadAttachment">
          <Plus class="h-4 w-4 mr-1.5" />Tambah
        </Button>
      </div>
      <ul v-if="attachments.length" class="divide-y divide-border">
        <li v-for="attachment in attachments" :key="attachment.id" class="py-2 text-sm text-foreground">
          {{ attachment.fileName }}
        </li>
      </ul>
      <EmptyState v-else title="Belum ada attachment" />
    </SectionCard>

    <div class="flex flex-wrap items-center justify-between gap-3 pt-2">
      <p v-if="submitGateMissing.length" class="text-xs text-muted-foreground">
        Lengkapi sebelum submit: {{ submitGateMissing.join(', ') }}
      </p>
      <div class="flex gap-2 ml-auto">
        <Button variant="outline" :disabled="isSaving || !form.requestName.trim()" @click="submitSaveDraft">
          Simpan Draft
        </Button>
        <Dialog v-model:open="isSubmitConfirmOpen">
          <DialogTrigger as-child>
            <Button :disabled="submitGateMissing.length > 0">
              Submit
            </Button>
          </DialogTrigger>
          <DialogContent class="max-w-md">
            <DialogHeader>
              <DialogTitle>Kirim Travel Request?</DialogTitle>
              <DialogDescription>Permintaan akan dikirim untuk ditinjau tim kami. Anda tidak dapat mengedit lagi sampai ada respons (atau permintaan klarifikasi).</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" @click="isSubmitConfirmOpen = false">
                Batal
              </Button>
              <Button @click="submitTravelRequestFlow">
                Kirim Sekarang
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  </div>
</template>
