<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import {
  getTravelRequestSubmitGate
} from '~/data'
import { SERVICE_TYPES } from '~/constants/status'
import type { ServiceTypeKey } from '~/types/project'
import type { TravelRequest } from '~/types/travel-request'
import type { TravelRequestInput } from '~/types/api'
import { clientCreateTravelRequestOnServer, clientSubmitTravelRequestOnServer, clientUpdateTravelRequestOnServer } from '~/data/client-requests-sync'
import { createSaveGate } from '~/lib/save-gate'

/**
 * Form Travel Request (Repair Phase Section 3 — Request & Commercial, Wajib "Form harus mencakup: General
 * information/Flight/Hotel/Transportation/MICE/Additional service/Attachment"). Dipakai `new.vue` (create)
 * dan `[id]/edit.vue` (edit draft) — diekstrak sebagai shared component sejak konsumen ke-2 (pola Section 1).
 * Memuat aksi Save Draft/Submit sendiri (bukan hanya render field) agar dirty-tracking untuk "Unsaved
 * changes warning" tetap satu sumber kebenaran di satu tempat.
 */
const props = defineProps<{ initial?: TravelRequest }>()
const emit = defineEmits<{ saved: [TravelRequest]; submitted: [TravelRequest] }>()

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

/** Every field is sent; an emptied field clears what the draft had (S12c-3: the server keeps the draft). */
function buildPatch (): TravelRequestInput {
  const text = (v: string) => v.trim() || null
  return {
    requestName: form.requestName.trim(),
    tripType: text(form.tripType),
    purpose: text(form.purpose),
    destination: form.destination.trim(),
    travelStartDate: form.travelStartDate || null,
    travelEndDate: form.travelEndDate || null,
    dateFlexible: form.dateFlexible,
    estimatedParticipants: form.estimatedParticipants || null,
    estimatedBudgetIdr: form.estimatedBudgetIdr ?? null,
    currency: text(form.currency),
    serviceScope: form.serviceScope,
    flightRequirement: form.serviceScope.includes('flight')
      ? clean({ preferredAirline: form.flightAirline.trim() || undefined, cabinClass: form.flightCabinClass.trim() || undefined, notes: form.flightNotes.trim() || undefined })
      : null,
    hotelRequirement: form.serviceScope.includes('hotel')
      ? clean({ starRating: form.hotelStarRating.trim() || undefined, roomType: form.hotelRoomType.trim() || undefined, notes: form.hotelNotes.trim() || undefined })
      : null,
    transportationRequirement: form.serviceScope.includes('transportation')
      ? clean({ vehicleType: form.transportVehicleType.trim() || undefined, notes: form.transportNotes.trim() || undefined })
      : null,
    miceRequirement: form.serviceScope.includes('mice')
      ? clean({ eventType: form.miceEventType.trim() || undefined, expectedAttendees: form.miceExpectedAttendees ?? undefined, notes: form.miceNotes.trim() || undefined })
      : null,
    additionalServicesNote: text(form.additionalServicesNote)
  }
}
const clean = <T extends object>(o: T): T => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T

const submitGateMissing = computed(() => getTravelRequestSubmitGate({ requestName: form.requestName, destination: form.destination, serviceScope: form.serviceScope }))

const api = useApi()
const gate = createSaveGate((title, message, tone) => showToast(title, message, tone))
const isSaving = computed(() => gate.saving.value)
/** The draft on the server (created on the first save, then updated). */
let savedId = props.initial?.id
const saveDraft = (): Promise<TravelRequest> => (savedId
  ? clientUpdateTravelRequestOnServer(api, savedId, buildPatch())
  : clientCreateTravelRequestOnServer(api, buildPatch()))

async function submitSaveDraft () {
  const result = await gate.run('Gagal Menyimpan', saveDraft)
  if (!result) { return }
  savedId = result.id
  Object.assign(initialSnapshot, snapshotOf(result))
  justNavigated = true
  showToast('Draft Tersimpan', `Travel Request "${result.requestName}" tersimpan sebagai draft.`, 'success')
  emit('saved', result)
}

const isSubmitConfirmOpen = ref(false)
async function submitTravelRequestFlow () {
  const result = await gate.run('Gagal Mengirim', async () => {
    const draft = await saveDraft()
    savedId = draft.id
    return clientSubmitTravelRequestOnServer(api, draft.id)
  })
  isSubmitConfirmOpen.value = false
  if (!result) { return }
  Object.assign(initialSnapshot, snapshotOf(result))
  justNavigated = true
  showToast('Travel Request Terkirim', `"${result.requestName}" telah dikirim — tim kami akan meninjaunya.`, 'success')
  emit('submitted', result)
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

    <EntityAttachments v-if="initial" entity-type="travel-request" :entity-id="initial.id" portal title="Attachment" />

    <div class="flex flex-wrap items-center justify-between gap-3 pt-2">
      <p v-if="submitGateMissing.length" class="text-xs text-muted-foreground">
        Lengkapi sebelum submit: {{ submitGateMissing.join(', ') }}
      </p>
      <div class="flex gap-2 ml-auto">
        <Button variant="outline" :disabled="isSaving || !form.requestName.trim()" @click="submitSaveDraft">
          Simpan Draft
        </Button>
        <!-- S12c-3: saat klarifikasi, jawaban dikirim dari halaman detail (server menerima submit hanya dari draft). -->
        <Dialog v-if="!initial || initial.status === 'draft'" v-model:open="isSubmitConfirmOpen">
          <DialogTrigger as-child>
            <Button :disabled="isSaving || submitGateMissing.length > 0">
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
