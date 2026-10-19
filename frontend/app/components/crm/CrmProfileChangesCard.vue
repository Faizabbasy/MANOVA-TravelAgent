<script setup lang="ts">
import { profileChangeRows } from '~/lib/profile-changes'
import { createSaveGate } from '~/lib/save-gate'
import { upsertServerParty } from '~/data/parties-sync'
import { getPartyById } from '~/data'
import type { ProfileChangeDto } from '~/types/api'

/**
 * S12c-1: a client's proposed change to its registration / tax / billing data or company name, waiting for review.
 * Approve applies it to the customer; reject sends the client the reason.
 */
const props = defineProps<{ partyId: string }>()

const api = useApi()
const { showToast } = useToast()
const gate = createSaveGate((title, message, tone) => showToast(title, message, tone))
const changes = ref<ProfileChangeDto[]>([])

async function load () {
  try {
    changes.value = (await api.core.listProfileChanges({ status: 'submitted', partyId: props.partyId })).data
  } catch {
    changes.value = [] // only reviewers (crm.manage-party) can list them; the card simply stays hidden otherwise
  }
}
onMounted(load)
watch(() => props.partyId, load)

const party = computed(() => getPartyById(props.partyId))
const rows = (change: ProfileChangeDto) => profileChangeRows(change.changes, (party.value ?? {}) as Record<string, string | undefined>)

async function approve (change: ProfileChangeDto) {
  const ok = await gate.run('Perubahan Gagal Diterapkan', async () => {
    await api.core.approveProfileChange(change.id)
    upsertServerParty((await api.core.getParty(props.partyId)).data)
    return true
  })
  if (!ok) { return }
  showToast('Perubahan Data Diterapkan', 'Data perusahaan telah diperbarui dan client diberi tahu.', 'success')
  await load()
}

const isRejectOpen = ref(false)
const rejectReason = ref('')
const rejecting = ref<ProfileChangeDto | null>(null)
function openReject (change: ProfileChangeDto) {
  rejecting.value = change
  rejectReason.value = ''
  isRejectOpen.value = true
}
async function submitReject () {
  if (!rejecting.value || !rejectReason.value.trim()) { return }
  const id = rejecting.value.id
  const ok = await gate.run('Penolakan Gagal Disimpan', () => api.core.rejectProfileChange(id, rejectReason.value.trim()))
  if (!ok) { return }
  isRejectOpen.value = false
  showToast('Perubahan Data Ditolak', 'Client diberi tahu alasannya.', 'info')
  await load()
}
</script>

<template>
  <SectionCard v-if="changes.length" title="Perubahan Data Menunggu Verifikasi" description="Diajukan client lewat portal — data baru berlaku setelah disetujui.">
    <div v-for="change in changes" :key="change.id" class="space-y-3">
      <p class="text-xs text-muted-foreground">
        Diajukan {{ change.submittedByName ?? change.submittedBy }} · {{ change.submittedAt.slice(0, 10) }}
      </p>
      <div class="divide-y divide-border rounded-lg border border-border text-sm">
        <div v-for="row in rows(change)" :key="row.field" class="grid grid-cols-1 gap-1 px-3 py-2 sm:grid-cols-3">
          <span class="text-muted-foreground">{{ row.label }}</span>
          <span class="text-muted-foreground line-through">{{ row.current }}</span>
          <span class="font-medium text-foreground">{{ row.proposed }}</span>
        </div>
      </div>
      <div class="flex gap-2">
        <Button size="sm" :disabled="gate.saving.value" @click="approve(change)">
          Setujui & Terapkan
        </Button>
        <Button size="sm" variant="outline" :disabled="gate.saving.value" @click="openReject(change)">
          Tolak
        </Button>
      </div>
    </div>
    <ResponsiveFormSheet v-model:open="isRejectOpen" title="Tolak Perubahan Data" description="Alasan akan diteruskan ke client." content-class="max-w-md">
      <div class="space-y-1.5 py-2">
        <Label for="pc-reject">Alasan</Label>
        <Input id="pc-reject" v-model="rejectReason" placeholder="mis. Mohon lampirkan dokumen NPWP terbaru" />
      </div>
      <template #footer>
        <Button variant="outline" @click="isRejectOpen = false">
          Batal
        </Button>
        <Button variant="destructive" :disabled="!rejectReason.trim() || gate.saving.value" @click="submitReject">
          Tolak
        </Button>
      </template>
    </ResponsiveFormSheet>
  </SectionCard>
</template>
