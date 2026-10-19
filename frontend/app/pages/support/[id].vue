<script setup lang="ts">
import { AlertTriangle, FileX, Lock } from 'lucide-vue-next'
import { USERS, getSupportTicketSlaDueDate, isSupportTicketSlaBreached } from '~/data'
import { ticketFromServer } from '~/data/support-sync'
import { isOpenTicket, ticketActions } from '~/lib/support'
import { createSaveGate } from '~/lib/save-gate'
import { isApiError } from '~/lib/api/errors'
import { SUPPORT_TICKET_CATEGORIES, SUPPORT_TICKET_PRIORITIES, SUPPORT_TICKET_STATUSES, findStatusOption } from '~/constants/status'
import { formatDate, formatDateTime } from '~/utils/format'
import type { SupportTicketDto } from '~/types/api'

/**
 * S12c-2: satu tiket support di sisi staf — tugaskan, ubah status, balas client atau tulis catatan internal (tidak
 * terlihat client), selesaikan dengan catatan, dan tutup setelah diselesaikan. Semua lewat server.
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const route = useRoute()
const api = useApi()
const session = useServerSession()
const { can } = usePermissions()
const { showToast } = useToast()
const gate = createSaveGate((title, message, tone) => showToast(title, message, tone))

const canManage = computed(() => can('support.manage-ticket'))
const dto = ref<SupportTicketDto | null>(null)
const status = ref<'loading' | 'ready' | 'missing' | 'error'>('loading')
const loadError = ref('')
const ticket = computed(() => (dto.value ? ticketFromServer(dto.value) : undefined))
const actions = computed(() => (ticket.value ? ticketActions(ticket.value.status) : undefined))
useHead({ title: computed(() => dto.value?.subject ?? 'Tiket Support') })

async function load () {
  if (!canManage.value) { return }
  try {
    await session.ensure()
    dto.value = (await api.core.getSupportTicket(String(route.params.id))).data
    status.value = 'ready'
  } catch (error) {
    if (isApiError(error) && error.status === 404) { status.value = 'missing'; return }
    loadError.value = isApiError(error) ? error.message : 'Server belum bisa dihubungi.'
    status.value = 'error'
  }
}
onMounted(load)

/** Runs a write; the server's ticket replaces what the page shows. */
async function act (title: string, action: (id: string) => Promise<{ data: SupportTicketDto }>, success: string) {
  if (!dto.value) { return false }
  const id = dto.value.id
  const saved = await gate.run(title, async () => (await action(id)).data)
  if (!saved) { return false }
  dto.value = saved
  showToast('Tersimpan', success, 'success')
  return true
}

const staff = computed(() => USERS.filter(user => user.status === 'active' && user.role !== 'client' && user.role !== 'vendor'))
const assignTo = ref('')
watch(dto, (value) => { assignTo.value = value?.assignedTo ?? '' }, { immediate: true })
const assign = () => act('Tiket Gagal Ditugaskan', id => api.core.assignSupportTicket(id, assignTo.value), 'Tiket ditugaskan — penanggung jawab diberi tahu.')

const MOVE_LABEL = { 'in-progress': 'Tandai Sedang Ditangani', 'waiting-for-client': 'Tunggu Jawaban Client' } as const
const move = (to: 'in-progress' | 'waiting-for-client') => act('Status Gagal Diubah', id => api.core.setSupportTicketStatus(id, to), 'Status tiket diperbarui.')

const reply = ref('')
const internal = ref(false)
watch(actions, (value) => { if (value && !value.reply) { internal.value = true } })
async function sendReply () {
  if (!reply.value.trim()) { return }
  const message = reply.value.trim()
  const asInternal = internal.value
  const done = await act('Balasan Gagal Dikirim', id => api.core.replySupportTicket(id, { message, internal: asInternal }),
    asInternal ? 'Catatan internal disimpan — tidak terlihat client.' : 'Balasan terkirim ke client.')
  if (done) { reply.value = '' }
}

const isResolveOpen = ref(false)
const resolveNote = ref('')
async function resolve () {
  if (!resolveNote.value.trim()) { return }
  const note = resolveNote.value.trim()
  const done = await act('Tiket Gagal Diselesaikan', id => api.core.resolveSupportTicket(id, note), 'Tiket diselesaikan — client diminta mengonfirmasi.')
  if (done) { isResolveOpen.value = false; resolveNote.value = '' }
}

const close = () => act('Tiket Gagal Ditutup', id => api.core.closeSupportTicket(id), 'Tiket ditutup.')
</script>

<template>
  <div class="space-y-6">
    <RoleAccessState v-if="!canManage" module-label="Tiket Support" />

    <div v-else-if="status === 'loading'" class="h-40 animate-pulse rounded-xl bg-muted" />

    <template v-else-if="status !== 'ready' || !dto || !ticket || !actions">
      <PageHeader title="Tiket Support" :breadcrumb="[{ label: 'Tiket Support', to: '/support' }, { label: String(route.params.id) }]" />
      <SectionCard>
        <EmptyState :icon="FileX" :title="status === 'missing' ? 'Tiket tidak ditemukan' : 'Tiket belum bisa dimuat'" :description="status === 'missing' ? 'Tiket ini tidak ada.' : loadError">
          <Button variant="outline" @click="navigateTo('/support')">
            Kembali ke inbox
          </Button>
        </EmptyState>
      </SectionCard>
    </template>

    <template v-else>
      <div v-if="ticket.category === 'emergency'" class="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive font-medium">
        <AlertTriangle class="h-4 w-4 shrink-0" />
        Emergency Ticket — prioritaskan penanganan.
      </div>

      <PageHeader :title="dto.subject" :breadcrumb="[{ label: 'Tiket Support', to: '/support' }, { label: dto.id }]">
        <template #actions>
          <StatusBadge :label="findStatusOption(SUPPORT_TICKET_PRIORITIES, ticket.priority).label" :tone="findStatusOption(SUPPORT_TICKET_PRIORITIES, ticket.priority).tone" />
          <StatusBadge :label="findStatusOption(SUPPORT_TICKET_STATUSES, ticket.status).label" :tone="findStatusOption(SUPPORT_TICKET_STATUSES, ticket.status).tone" />
        </template>
      </PageHeader>

      <SectionCard title="Ringkasan">
        <DetailMetadataList
          :items="[
            { label: 'Customer', value: dto.partyName },
            { label: 'Project', value: dto.projectName ?? 'Tidak terkait project tertentu' },
            { label: 'Kategori', value: findStatusOption(SUPPORT_TICKET_CATEGORIES, ticket.category).label },
            { label: 'Dibuat', value: `${formatDate(dto.createdAt)} oleh ${dto.createdByName ?? dto.createdBy}` },
            { label: 'Penanggung jawab', value: dto.assignedToName ?? 'Antrean (belum ditugaskan)' },
            { label: 'SLA Target', value: formatDate(getSupportTicketSlaDueDate(ticket)) },
            ...(dto.reopenCount ? [{ label: 'Dibuka ulang', value: `${dto.reopenCount}×` }] : []),
            ...(dto.resolutionRating ? [{ label: 'Rating client', value: `${dto.resolutionRating}/5${dto.ratingNote ? ` — ${dto.ratingNote}` : ''}` }] : [])
          ]"
        />
        <p v-if="isOpenTicket(ticket.status) && isSupportTicketSlaBreached(ticket)" class="text-xs text-destructive font-medium mt-3">
          SLA target telah terlewati.
        </p>
        <p class="text-sm text-foreground mt-4 pt-4 border-t border-border whitespace-pre-line">
          {{ dto.description }}
        </p>
        <p v-if="dto.attachmentName" class="text-xs text-muted-foreground mt-2">
          📎 {{ dto.attachmentName }}
        </p>
        <p v-if="dto.resolutionNote" class="text-sm text-foreground mt-4 pt-4 border-t border-border">
          <span class="font-medium">Penyelesaian:</span> {{ dto.resolutionNote }}
          <span v-if="dto.resolvedAt" class="text-xs text-muted-foreground"> · {{ formatDate(dto.resolvedAt) }}</span>
        </p>
      </SectionCard>

      <SectionCard v-if="actions.assign || actions.moveTo.length || actions.resolve || actions.close" title="Tindakan">
        <div class="flex flex-col gap-4">
          <div v-if="actions.assign" class="flex flex-col sm:flex-row gap-2 sm:items-end">
            <div class="space-y-1.5 flex-1 max-w-sm">
              <Label for="tck-assign">Tugaskan ke</Label>
              <select id="tck-assign" v-model="assignTo" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                <option value="" disabled>
                  Pilih staf
                </option>
                <option v-for="user in staff" :key="user.id" :value="user.id">
                  {{ user.name }}
                </option>
              </select>
            </div>
            <Button size="sm" variant="outline" :disabled="gate.saving.value || !assignTo || assignTo === dto.assignedTo" @click="assign">
              Tugaskan
            </Button>
          </div>
          <div class="flex flex-wrap gap-2">
            <Button
              v-for="to in actions.moveTo"
              :key="to"
              size="sm"
              variant="outline"
              :disabled="gate.saving.value"
              @click="move(to)"
            >
              {{ MOVE_LABEL[to] }}
            </Button>
            <ResponsiveFormSheet v-if="actions.resolve" v-model:open="isResolveOpen" title="Selesaikan Tiket" description="Catatan penyelesaian dikirim ke client." content-class="max-w-md">
              <template #trigger>
                <Button size="sm">
                  Selesaikan
                </Button>
              </template>
              <div class="space-y-1.5 py-2">
                <Label for="tck-resolve">Catatan penyelesaian</Label>
                <textarea id="tck-resolve" v-model="resolveNote" rows="3" class="w-full px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <template #footer>
                <Button variant="outline" @click="isResolveOpen = false">
                  Batal
                </Button>
                <Button :disabled="gate.saving.value || !resolveNote.trim()" @click="resolve">
                  Selesaikan
                </Button>
              </template>
            </ResponsiveFormSheet>
            <Button v-if="actions.close" size="sm" variant="outline" :disabled="gate.saving.value" @click="close">
              Tutup Tiket
            </Button>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Percakapan">
        <ul v-if="dto.replies.length" class="divide-y divide-border mb-4">
          <li v-for="item in dto.replies" :key="item.id" :class="['py-3', item.internal && 'bg-warning/5 -mx-3 px-3 border-l-2 border-warning']">
            <p class="text-sm text-foreground whitespace-pre-line">
              {{ item.message }}
            </p>
            <p v-if="item.attachmentName" class="text-xs text-muted-foreground mt-1">
              📎 {{ item.attachmentName }}
            </p>
            <p class="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
              <Lock v-if="item.internal" class="h-3 w-3" />
              {{ item.authorName ?? '—' }}{{ item.fromClient ? ' (client)' : '' }}{{ item.internal ? ' · catatan internal' : '' }} · {{ formatDateTime(item.createdAt) }}
            </p>
          </li>
        </ul>
        <EmptyState v-else title="Belum ada balasan" />
        <div class="border-t border-border pt-4 space-y-2">
          <textarea v-model="reply" rows="2" class="w-full px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring" :placeholder="internal ? 'Catatan internal (tidak terlihat client)...' : 'Balasan untuk client...'" />
          <div class="flex flex-wrap items-center justify-between gap-2">
            <label class="flex items-center gap-2 text-sm text-foreground">
              <Checkbox v-model="internal" :disabled="!actions.reply" />
              Catatan internal
            </label>
            <Button size="sm" :disabled="gate.saving.value || !reply.trim()" @click="sendReply">
              {{ internal ? 'Simpan Catatan' : 'Kirim ke Client' }}
            </Button>
          </div>
        </div>
      </SectionCard>
    </template>
  </div>
</template>
