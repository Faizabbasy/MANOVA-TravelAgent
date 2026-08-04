<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { FileX, Star, BedDouble } from 'lucide-vue-next'
import {
  getTravelerById, getProjectById, updateTraveler, setTravelerVip, cancelTraveler, replaceTraveler,
  getTravelerGroups, getRoomAssignments, createRoomAssignment, setRoomAssignmentTravelers, getTravelers
} from '~/data'
import { formatDate } from '~/utils/format'
import { isTravelerDocumentMissing } from '~/utils/attention'
import type { RoomType } from '~/types/project'

/**
 * Participants — Detail (Repair Phase Section 4 — Core Project). Isolasi: project traveler ini harus milik
 * `clientScopeId` user login. Edit reuse `updateTraveler` (Section 11, LOCKED) — field set IDENTIK dialog
 * Edit di tab Participants `/client/project-orders/[id]` (satu sumber logic form, disalin sengaja karena
 * kedua halaman adalah entry point berbeda untuk aksi yang sama, bukan duplikasi konsep).
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const route = useRoute()
const router = useRouter()
const { canView, clientScopeId } = usePermissions()
const { showToast } = useToast()

const traveler = computed(() => getTravelerById(String(route.params.id)))
const project = computed(() => (traveler.value ? getProjectById(traveler.value.projectId) : undefined))
const isOwnCompany = computed(() => Boolean(project.value && clientScopeId.value && project.value.partyId === clientScopeId.value))
useHead({ title: computed(() => traveler.value ? traveler.value.name : 'Tidak Ditemukan') })

const isMissingDocs = computed(() => Boolean(traveler.value && project.value && isTravelerDocumentMissing(traveler.value, project.value.travelStartDate)))

/* --- Edit --- */
const isEditDialogOpen = ref(false)
const form = ref({
  name: '',
  passportNumber: '',
  passportExpiryDate: '',
  idNumber: '',
  visaNumber: '',
  visaExpiryDate: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
  dietaryRestrictions: '',
  accessibilityNeeds: '',
  specialRequest: ''
})
function openEdit () {
  if (!traveler.value) { return }
  form.value = {
    name: traveler.value.name,
    passportNumber: traveler.value.passportNumber ?? '',
    passportExpiryDate: traveler.value.passportExpiryDate ?? '',
    idNumber: traveler.value.idNumber ?? '',
    visaNumber: traveler.value.visaNumber ?? '',
    visaExpiryDate: traveler.value.visaExpiryDate ?? '',
    emergencyContactName: traveler.value.emergencyContactName ?? '',
    emergencyContactPhone: traveler.value.emergencyContactPhone ?? '',
    dietaryRestrictions: traveler.value.dietaryRestrictions ?? '',
    accessibilityNeeds: traveler.value.accessibilityNeeds ?? '',
    specialRequest: traveler.value.specialRequest ?? ''
  }
  isEditDialogOpen.value = true
}
function submitEdit () {
  if (!traveler.value || !form.value.name.trim()) { return }
  updateTraveler(traveler.value.id, {
    name: form.value.name.trim(),
    passportNumber: form.value.passportNumber.trim() || undefined,
    passportExpiryDate: form.value.passportExpiryDate || undefined,
    idNumber: form.value.idNumber.trim() || undefined,
    visaNumber: form.value.visaNumber.trim() || undefined,
    visaExpiryDate: form.value.visaExpiryDate || undefined,
    emergencyContactName: form.value.emergencyContactName.trim() || undefined,
    emergencyContactPhone: form.value.emergencyContactPhone.trim() || undefined,
    dietaryRestrictions: form.value.dietaryRestrictions.trim() || undefined,
    accessibilityNeeds: form.value.accessibilityNeeds.trim() || undefined,
    specialRequest: form.value.specialRequest.trim() || undefined
  })
  isEditDialogOpen.value = false
  showToast('Data Diperbarui', 'Perubahan berhasil disimpan.', 'success')
}

/* --- Mark VIP --- */
function toggleVip () {
  if (!traveler.value) { return }
  setTravelerVip(traveler.value.id, !traveler.value.isVip)
  showToast(traveler.value.isVip ? 'VIP Diaktifkan' : 'VIP Dinonaktifkan', traveler.value.name, 'success')
}

/* --- Cancel --- */
const isCancelDialogOpen = ref(false)
const cancelReason = ref('')
function submitCancel () {
  if (!traveler.value || !cancelReason.value.trim()) { return }
  cancelTraveler(traveler.value.id, cancelReason.value.trim())
  cancelReason.value = ''
  isCancelDialogOpen.value = false
  showToast('Peserta Dibatalkan', `${traveler.value.name} ditandai cancelled.`, 'info')
}

/* --- Replace --- */
const isReplaceDialogOpen = ref(false)
const replaceName = ref('')
function submitReplace () {
  if (!traveler.value || !replaceName.value.trim()) { return }
  const result = replaceTraveler(traveler.value.id, { name: replaceName.value.trim() })
  replaceName.value = ''
  isReplaceDialogOpen.value = false
  if (result) {
    showToast('Peserta Digantikan', `${result.previous.name} digantikan oleh ${result.replacement.name}.`, 'success')
    router.push(`/client/participants/${result.replacement.id}`)
  }
}

/* --- Room assignment (Wajib "Assign room"/"Assign roommate") --- */
const group = computed(() => (traveler.value?.groupId && project.value ? getTravelerGroups(project.value.id).find(g => g.id === traveler.value!.groupId) : undefined))
const groupRooms = computed(() => (project.value && group.value ? getRoomAssignments(project.value.id).filter(room => room.groupId === group.value!.id) : []))
const currentRoom = computed(() => groupRooms.value.find(room => room.travelerIds.includes(traveler.value?.id ?? '')))
const groupmates = computed(() => (project.value && group.value ? getTravelers(project.value.id).filter(t => t.groupId === group.value!.id && t.id !== traveler.value?.id) : []))
const roommatesNotYetAssigned = computed(() => groupmates.value.filter(t => !currentRoom.value?.travelerIds.includes(t.id)))

const isCreateRoomOpen = ref(false)
const newRoomLabel = ref('')
const newRoomType = ref<RoomType>('twin')
function submitCreateRoom () {
  if (!traveler.value || !project.value || !group.value || !newRoomLabel.value.trim()) { return }
  createRoomAssignment({ projectId: project.value.id, groupId: group.value.id, roomLabel: newRoomLabel.value.trim(), roomType: newRoomType.value, travelerIds: [traveler.value.id] })
  newRoomLabel.value = ''
  isCreateRoomOpen.value = false
  showToast('Room Ditugaskan', `${traveler.value.name} ditugaskan ke ${newRoomLabel.value || 'kamar baru'}.`, 'success')
}
function assignToRoom (roomId: string) {
  const room = groupRooms.value.find(item => item.id === roomId)
  if (!room || !traveler.value) { return }
  setRoomAssignmentTravelers(roomId, [...room.travelerIds, traveler.value.id])
  showToast('Room Ditugaskan', `${traveler.value.name} ditugaskan ke ${room.roomLabel}.`, 'success')
}
function addRoommate (roommateId: string) {
  if (!currentRoom.value) { return }
  setRoomAssignmentTravelers(currentRoom.value.id, [...currentRoom.value.travelerIds, roommateId])
  showToast('Roommate Ditambahkan', 'Roommate berhasil ditambahkan ke kamar ini.', 'success')
}
</script>

<template>
  <div class="space-y-6">
    <template v-if="!traveler || !project || !isOwnCompany">
      <PageHeader title="Tidak Ditemukan" :breadcrumb="[{ label: 'Client Portal', to: '/client' }, { label: 'Tidak Ditemukan' }]" />
      <SectionCard>
        <EmptyState :icon="FileX" title="Peserta tidak ditemukan" description="Peserta ini tidak ada atau bukan milik company Anda.">
          <Button @click="router.push('/client/participants')">
            Kembali ke Participants
          </Button>
        </EmptyState>
      </SectionCard>
    </template>

    <RoleAccessState v-else-if="!canView('client-portal')" module-label="Client Portal" />

    <template v-else>
      <PageHeader
        :title="traveler.name"
        :breadcrumb="[{ label: 'Client Portal', to: '/client' }, { label: 'Travel Management' }, { label: 'Participants', to: '/client/participants' }, { label: traveler.name }]"
      >
        <template #actions>
          <StatusBadge v-if="traveler.cancelled" label="Cancelled" tone="neutral" />
          <StatusBadge v-else-if="traveler.documentsVerifiedAt" label="Verified" tone="success" />
          <StatusBadge v-else-if="isMissingDocs" label="Incomplete" tone="destructive" />
          <StatusBadge v-else label="Submitted" tone="warning" />
          <Button size="sm" variant="outline" @click="toggleVip">
            <Star class="h-4 w-4 mr-1.5" :class="traveler.isVip ? 'fill-warning text-warning' : ''" />{{ traveler.isVip ? 'VIP' : 'Mark VIP' }}
          </Button>
          <Button size="sm" variant="outline" @click="openEdit">
            Edit
          </Button>
        </template>
      </PageHeader>

      <SectionCard v-if="traveler.cancelled" title="Status: Cancelled">
        <p class="text-sm text-muted-foreground">
          {{ traveler.cancelReason }}
        </p>
        <p v-if="traveler.replacedByTravelerId" class="text-sm mt-2">
          <NuxtLink :to="`/client/participants/${traveler.replacedByTravelerId}`" class="text-primary hover:underline">
            Lihat peserta pengganti →
          </NuxtLink>
        </p>
      </SectionCard>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard title="Data Peserta">
          <DetailMetadataList
            :items="[
              { label: 'Project', value: project.name },
              { label: 'Nomor Paspor', value: traveler.passportNumber || '—' },
              { label: 'Masa Berlaku Paspor', value: traveler.passportExpiryDate ? formatDate(traveler.passportExpiryDate) : '—' },
              { label: 'Nomor ID/KTP', value: traveler.idNumber || '—' },
              { label: 'Nomor Visa', value: traveler.visaNumber || '—' },
              { label: 'Masa Berlaku Visa', value: traveler.visaExpiryDate ? formatDate(traveler.visaExpiryDate) : '—' },
              { label: 'Kontak Darurat', value: traveler.emergencyContactName ? `${traveler.emergencyContactName} (${traveler.emergencyContactPhone || '—'})` : '—' },
              { label: 'Dietary', value: traveler.dietaryRestrictions || '—' },
              { label: 'Accessibility', value: traveler.accessibilityNeeds || '—' },
              { label: 'Catatan Lain', value: traveler.specialRequest || '—' },
            ]"
          />
        </SectionCard>

        <SectionCard title="Rooming">
          <template v-if="!group">
            <EmptyState :icon="BedDouble" title="Belum tergabung dalam group" description="Assign group dikelola oleh tim kami saat menyusun rooming list." />
          </template>
          <template v-else>
            <div v-if="currentRoom" class="space-y-3">
              <DetailMetadataList :items="[{ label: 'Kamar', value: `${currentRoom.roomLabel} (${currentRoom.roomType})` }]" />
              <div v-if="roommatesNotYetAssigned.length">
                <p class="text-xs font-medium text-muted-foreground mb-2">
                  Tambah Roommate
                </p>
                <div class="flex flex-wrap gap-2">
                  <Button v-for="mate in roommatesNotYetAssigned" :key="mate.id" size="sm" variant="outline" @click="addRoommate(mate.id)">
                    + {{ mate.name }}
                  </Button>
                </div>
              </div>
            </div>
            <template v-else>
              <div v-if="groupRooms.length" class="space-y-2 mb-3">
                <p class="text-xs font-medium text-muted-foreground">
                  Kamar Tersedia dalam Group
                </p>
                <div class="flex flex-wrap gap-2">
                  <Button v-for="room in groupRooms" :key="room.id" size="sm" variant="outline" @click="assignToRoom(room.id)">
                    {{ room.roomLabel }} ({{ room.travelerIds.length }} orang)
                  </Button>
                </div>
              </div>
              <Dialog v-model:open="isCreateRoomOpen">
                <DialogTrigger as-child>
                  <Button size="sm">
                    Buat Kamar Baru
                  </Button>
                </DialogTrigger>
                <DialogContent class="max-w-sm">
                  <DialogHeader>
                    <DialogTitle>Buat Kamar Baru</DialogTitle>
                  </DialogHeader>
                  <div class="space-y-4 py-2">
                    <div class="space-y-1.5">
                      <Label for="room-label">Label Kamar</Label>
                      <Input id="room-label" v-model="newRoomLabel" placeholder="mis. Room 301" />
                    </div>
                    <div class="space-y-1.5">
                      <Label for="room-type">Tipe Kamar</Label>
                      <select id="room-type" v-model="newRoomType" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                        <option value="single">
                          Single
                        </option>
                        <option value="twin">
                          Twin
                        </option>
                        <option value="suite">
                          Suite
                        </option>
                      </select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" @click="isCreateRoomOpen = false">
                      Batal
                    </Button>
                    <Button :disabled="!newRoomLabel.trim()" @click="submitCreateRoom">
                      Simpan
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </template>
          </template>
        </SectionCard>
      </div>

      <SectionCard v-if="!traveler.cancelled" title="Aksi Lain">
        <div class="flex flex-wrap gap-2">
          <Dialog v-model:open="isReplaceDialogOpen">
            <DialogTrigger as-child>
              <Button size="sm" variant="outline">
                Replace
              </Button>
            </DialogTrigger>
            <DialogContent class="max-w-sm">
              <DialogHeader>
                <DialogTitle>Ganti Peserta</DialogTitle>
                <DialogDescription>{{ traveler.name }} akan ditandai cancelled dan digantikan peserta baru.</DialogDescription>
              </DialogHeader>
              <div class="space-y-1.5 py-2">
                <Label for="replace-name">Nama Peserta Pengganti</Label>
                <Input id="replace-name" v-model="replaceName" />
              </div>
              <DialogFooter>
                <Button variant="outline" @click="isReplaceDialogOpen = false">
                  Batal
                </Button>
                <Button :disabled="!replaceName.trim()" @click="submitReplace">
                  Ganti
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog v-model:open="isCancelDialogOpen">
            <DialogTrigger as-child>
              <Button size="sm" variant="destructive">
                Cancel
              </Button>
            </DialogTrigger>
            <DialogContent class="max-w-sm">
              <DialogHeader>
                <DialogTitle>Batalkan Peserta?</DialogTitle>
                <DialogDescription>Alasan wajib diisi.</DialogDescription>
              </DialogHeader>
              <div class="space-y-1.5 py-2">
                <Label for="cancel-reason">Alasan</Label>
                <Input id="cancel-reason" v-model="cancelReason" />
              </div>
              <DialogFooter>
                <Button variant="outline" @click="isCancelDialogOpen = false">
                  Batal
                </Button>
                <Button variant="destructive" :disabled="!cancelReason.trim()" @click="submitCancel">
                  Batalkan
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </SectionCard>

      <!-- Edit Dialog -->
      <Dialog v-model:open="isEditDialogOpen">
        <DialogScrollContent class="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Peserta</DialogTitle>
          </DialogHeader>
          <div class="space-y-4 py-2">
            <div class="space-y-1.5">
              <Label for="edit-name">Nama Lengkap</Label><Input id="edit-name" v-model="form.name" />
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div class="space-y-1.5">
                <Label for="edit-passport">Nomor Paspor</Label><Input id="edit-passport" v-model="form.passportNumber" />
              </div>
              <div class="space-y-1.5">
                <Label for="edit-passport-exp">Masa Berlaku Paspor</Label><Input id="edit-passport-exp" v-model="form.passportExpiryDate" type="date" />
              </div>
              <div class="space-y-1.5">
                <Label for="edit-id">Nomor ID/KTP</Label><Input id="edit-id" v-model="form.idNumber" />
              </div>
              <div class="space-y-1.5">
                <Label for="edit-visa">Nomor Visa</Label><Input id="edit-visa" v-model="form.visaNumber" />
              </div>
              <div class="space-y-1.5">
                <Label for="edit-visa-exp">Masa Berlaku Visa</Label><Input id="edit-visa-exp" v-model="form.visaExpiryDate" type="date" />
              </div>
            </div>
            <div class="space-y-1.5">
              <Label for="edit-emergency-name">Nama Kontak Darurat</Label><Input id="edit-emergency-name" v-model="form.emergencyContactName" />
            </div>
            <div class="space-y-1.5">
              <Label for="edit-emergency-phone">Telepon Kontak Darurat</Label><Input id="edit-emergency-phone" v-model="form.emergencyContactPhone" />
            </div>
            <div class="space-y-1.5">
              <Label for="edit-dietary">Dietary Restriction</Label><Input id="edit-dietary" v-model="form.dietaryRestrictions" />
            </div>
            <div class="space-y-1.5">
              <Label for="edit-accessibility">Accessibility Needs</Label><Input id="edit-accessibility" v-model="form.accessibilityNeeds" />
            </div>
            <div class="space-y-1.5">
              <Label for="edit-special">Permintaan Khusus Lainnya</Label><Input id="edit-special" v-model="form.specialRequest" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" @click="isEditDialogOpen = false">
              Batal
            </Button>
            <Button :disabled="!form.name.trim()" @click="submitEdit">
              Simpan
            </Button>
          </DialogFooter>
        </DialogScrollContent>
      </Dialog>
    </template>
  </div>
</template>
