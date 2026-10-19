<script setup lang="ts">
import { Plus } from 'lucide-vue-next'
import { createSaveGate } from '~/lib/save-gate'
import { APPROVAL_ENTITY_TYPES, APPROVAL_STATUSES, findStatusOption } from '~/constants/status'
import { formatCurrencyIdr, formatDate } from '~/utils/format'
import type { ClientApprovalDto, ClientApprovalInput } from '~/types/api'

/**
 * S12c-3: approvals staff ask the client for on this project (rooming list, extra charge, completion…), read from the
 * server. The client decides in the portal's Approval Center; the owner and the requester are told. Change requests
 * and itinerary versions have their own approval flows and are not asked here.
 */
const props = defineProps<{ projectId: string }>()

const api = useApi()
const session = useServerSession()
const { can } = usePermissions()
const { showToast } = useToast()
const gate = createSaveGate((title, message, tone) => showToast(title, message, tone))

const TYPES = APPROVAL_ENTITY_TYPES.filter(option => option.value !== 'change-request' && option.value !== 'itinerary-version')
const canRequest = computed(() => can('project-order.manage-operations'))
const approvals = ref<ClientApprovalDto[]>([])
const loadError = ref('')
async function load () {
  try {
    await session.ensure()
    approvals.value = (await api.core.listProjectClientApprovals(props.projectId)).data
    loadError.value = ''
  } catch {
    loadError.value = 'Persetujuan client belum bisa dimuat.'
  }
}
onMounted(load)
watch(() => props.projectId, load)

const isFormOpen = ref(false)
const form = reactive({ entityType: 'rooming-list' as ClientApprovalInput['entityType'], title: '', description: '', amount: null as number | null, expiresOn: '' })
function openForm () {
  Object.assign(form, { entityType: 'rooming-list', title: '', description: '', amount: null, expiresOn: '' })
  isFormOpen.value = true
}
const needsAmount = computed(() => form.entityType === 'additional-charge' || form.entityType === 'cancellation-charge')
async function submit () {
  if (!form.title.trim()) { return }
  const input: ClientApprovalInput = {
    entityType: form.entityType,
    title: form.title.trim(),
    ...(form.description.trim() ? { description: form.description.trim() } : {}),
    ...(needsAmount.value && form.amount !== null ? { amountIdr: form.amount } : {}),
    ...(form.expiresOn ? { expiresOn: form.expiresOn } : {})
  }
  const saved = await gate.run('Permintaan Gagal Dikirim', async () => (await api.core.requestClientApproval(props.projectId, input)).data)
  if (!saved) { return }
  isFormOpen.value = false
  showToast('Persetujuan Diminta', 'Client diberi tahu dan memutuskan di Approval Center.', 'success')
  await load()
}
</script>

<template>
  <SectionCard compact title="Persetujuan Client" description="Hal yang perlu disetujui client di portal (rooming list, biaya tambahan, laporan akhir…).">
    <template v-if="canRequest" #actions>
      <Button size="sm" variant="outline" @click="openForm">
        <Plus class="h-4 w-4 mr-1" />Minta Persetujuan
      </Button>
    </template>
    <p v-if="loadError" class="text-xs text-destructive">
      {{ loadError }}
    </p>
    <ul v-else-if="approvals.length" class="divide-y divide-border">
      <li v-for="a in approvals" :key="a.id" class="py-2 flex items-start justify-between gap-3">
        <div class="min-w-0">
          <p class="text-sm font-medium text-foreground truncate">
            {{ a.title }}
          </p>
          <p class="text-xs text-muted-foreground">
            {{ findStatusOption(APPROVAL_ENTITY_TYPES, a.entityType).label }} · {{ formatDate(a.requestedAt) }} oleh {{ a.requestedByName }}
            <template v-if="a.amountIdr !== null">
              · {{ formatCurrencyIdr(a.amountIdr) }}
            </template>
            <template v-if="a.expiresOn">
              · batas {{ formatDate(a.expiresOn) }}
            </template>
          </p>
          <p v-if="a.reason || a.decisionComment" class="text-xs text-foreground mt-0.5">
            {{ a.decidedByName ?? 'Client' }}: {{ a.reason ?? a.decisionComment }}
          </p>
        </div>
        <StatusBadge :label="findStatusOption(APPROVAL_STATUSES, a.status).label" :tone="findStatusOption(APPROVAL_STATUSES, a.status).tone" />
      </li>
    </ul>
    <p v-else class="text-sm text-muted-foreground">
      Belum ada persetujuan yang diminta.
    </p>

    <ResponsiveFormSheet v-model:open="isFormOpen" title="Minta Persetujuan Client" description="Client diberi tahu dan memutuskan di Approval Center." content-class="max-w-md">
      <div class="space-y-3 py-2">
        <div class="space-y-1.5">
          <Label for="cap-type">Jenis</Label>
          <select id="cap-type" v-model="form.entityType" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
            <option v-for="option in TYPES" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </div>
        <div class="space-y-1.5">
          <Label for="cap-title">Judul</Label>
          <Input id="cap-title" v-model="form.title" placeholder="mis. Rooming list final" />
        </div>
        <div class="space-y-1.5">
          <Label for="cap-desc">Keterangan (opsional)</Label>
          <textarea id="cap-desc" v-model="form.description" rows="3" class="w-full px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <div v-if="needsAmount" class="space-y-1.5">
          <Label for="cap-amount">Nominal (Rp)</Label>
          <Input id="cap-amount" v-model.number="form.amount" type="number" min="0" />
        </div>
        <div class="space-y-1.5">
          <Label for="cap-expiry">Batas waktu (opsional)</Label>
          <Input id="cap-expiry" v-model="form.expiresOn" type="date" />
        </div>
      </div>
      <template #footer>
        <Button variant="outline" @click="isFormOpen = false">
          Batal
        </Button>
        <Button :disabled="gate.saving.value || !form.title.trim()" @click="submit">
          Kirim ke Client
        </Button>
      </template>
    </ResponsiveFormSheet>
  </SectionCard>
</template>
