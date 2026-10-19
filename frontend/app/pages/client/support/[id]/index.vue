<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { FileX, AlertTriangle, Star } from 'lucide-vue-next'
import {
  getSupportTicketById, getSupportTicketReplies, getProjectById, getUserById,
  getSupportTicketSlaDueDate, isSupportTicketSlaBreached
} from '~/data'
import { clientConfirmTicket, clientRateTicket, clientReopenTicket, clientReplyTicket, useClientSupportSync } from '~/data/support-sync'
import { createSaveGate } from '~/lib/save-gate'
import { SUPPORT_TICKET_CATEGORIES, SUPPORT_TICKET_PRIORITIES, SUPPORT_TICKET_STATUSES, findStatusOption } from '~/constants/status'
import { formatDate, formatDateTime } from '~/utils/format'

/**
 * Issues & Support — Detail (Repair Phase Section 6, Master Prompt bagian 14). Emergency ticket ditandai visual menonjol (banner merah) sesuai Wajib "Emergency ticket harus menonjol secara UI".
 * S12c-2: balasan, konfirmasi, buka ulang dan rating disimpan di server dulu; catatan internal staf tidak pernah sampai ke sini.
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const route = useRoute()
const router = useRouter()
const { canView, clientScopeId } = usePermissions()
const { showToast } = useToast()
const api = useApi()
const gate = createSaveGate((title, message, tone) => showToast(title, message, tone))
/** S12c-2 review: opened from a notification, the ticket may have changed on the server — read it again. */
const supportSync = useClientSupportSync()
onMounted(() => { supportSync.load(true) })

const ticket = computed(() => getSupportTicketById(String(route.params.id)))
const isOwnCompany = computed(() => Boolean(ticket.value && clientScopeId.value && ticket.value.clientPartyId === clientScopeId.value))
useHead({ title: computed(() => ticket.value ? ticket.value.subject : 'Tidak Ditemukan') })

const project = computed(() => (ticket.value?.projectId ? getProjectById(ticket.value.projectId) : undefined))
const assignedPicName = computed(() => ticket.value?.assignedToName ?? (ticket.value?.assignedTo ? getUserById(ticket.value.assignedTo)?.name : undefined))
const replies = computed(() => (ticket.value ? getSupportTicketReplies(ticket.value.id).filter(reply => !reply.internal) : []))
const replyAuthor = (reply: { authorName?: string; authorId: string }) => reply.authorName ?? getUserById(reply.authorId)?.name ?? reply.authorId

const newReply = ref('')
const newAttachmentName = ref('')
async function submitReply () {
  if (!ticket.value || !newReply.value.trim()) { return }
  const id = ticket.value.id
  const saved = await gate.run('Balasan Gagal Dikirim', () => clientReplyTicket(api, id, newReply.value.trim(), newAttachmentName.value.trim() || undefined))
  if (!saved) { return }
  newReply.value = ''
  newAttachmentName.value = ''
  showToast('Balasan Terkirim', 'Balasan Anda telah ditambahkan ke ticket.', 'success')
}

async function handleConfirmResolution () {
  if (!ticket.value) { return }
  const id = ticket.value.id
  const result = await gate.run('Konfirmasi Gagal', () => clientConfirmTicket(api, id))
  if (result) { showToast('Ticket Ditutup', 'Terima kasih telah mengonfirmasi penyelesaian.', 'success') }
}

const isReopenOpen = ref(false)
const reopenReason = ref('')
async function submitReopen () {
  if (!ticket.value || !reopenReason.value.trim()) { return }
  const id = ticket.value.id
  const result = await gate.run('Ticket Gagal Dibuka Kembali', () => clientReopenTicket(api, id, reopenReason.value.trim()))
  if (!result) { return }
  reopenReason.value = ''
  isReopenOpen.value = false
  showToast('Ticket Dibuka Kembali', 'Tim kami akan meninjau kembali permintaan Anda.', 'info')
}

async function handleRate (rating: number) {
  if (!ticket.value) { return }
  const id = ticket.value.id
  const result = await gate.run('Rating Gagal Disimpan', () => clientRateTicket(api, id, rating))
  if (result) { showToast('Terima Kasih', 'Rating Anda telah tercatat.', 'success') }
}
</script>

<template>
  <div class="space-y-6">
    <template v-if="!ticket || !isOwnCompany">
      <PageHeader title="Tidak Ditemukan" :breadcrumb="[{ label: 'Client Portal', to: '/client' }, { label: 'Tidak Ditemukan' }]" />
      <SectionCard>
        <EmptyState :icon="FileX" title="Support Ticket tidak ditemukan" description="Ticket ini tidak ada atau bukan milik company Anda.">
          <Button @click="router.push('/client/documents#support')">
            Kembali ke Issues & Support
          </Button>
        </EmptyState>
      </SectionCard>
    </template>

    <RoleAccessState v-else-if="!canView('client-portal')" module-label="Client Portal" />

    <template v-else>
      <div v-if="ticket.category === 'emergency'" class="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive font-medium">
        <AlertTriangle class="h-4 w-4 shrink-0" />
        Ini adalah Emergency Ticket — tim kami memprioritaskan penanganan tiket ini.
      </div>

      <PageHeader
        :title="ticket.subject"
        :breadcrumb="[{ label: 'Client Portal', to: '/client' }, { label: 'Documents & Support' }, { label: 'Issues & Support', to: '/client/documents#support' }, { label: ticket.id }]"
      >
        <template #actions>
          <StatusBadge :label="findStatusOption(SUPPORT_TICKET_PRIORITIES, ticket.priority).label" :tone="findStatusOption(SUPPORT_TICKET_PRIORITIES, ticket.priority).tone" />
          <StatusBadge :label="findStatusOption(SUPPORT_TICKET_STATUSES, ticket.status).label" :tone="findStatusOption(SUPPORT_TICKET_STATUSES, ticket.status).tone" />
        </template>
      </PageHeader>

      <SectionCard title="Ringkasan">
        <DetailMetadataList
          :items="[
            { label: 'Kategori', value: findStatusOption(SUPPORT_TICKET_CATEGORIES, ticket.category).label },
            { label: 'Project', value: project?.name ?? 'Tidak terkait project tertentu' },
            { label: 'Dibuat', value: formatDate(ticket.createdAt) },
            { label: 'Assigned PIC', value: assignedPicName ?? 'Antrean tim kami' },
            { label: 'SLA Target', value: formatDate(getSupportTicketSlaDueDate(ticket)) },
          ]"
        />
        <p v-if="isSupportTicketSlaBreached(ticket)" class="text-xs text-destructive font-medium mt-3">
          SLA target telah terlewati.
        </p>
        <p class="text-sm text-foreground mt-4 pt-4 border-t border-border whitespace-pre-line">
          {{ ticket.description }}
        </p>
        <p v-if="ticket.attachmentName" class="text-xs text-muted-foreground mt-2">
          📎 {{ ticket.attachmentName }}
        </p>
      </SectionCard>

      <SectionCard v-if="ticket.status === 'resolved' || ticket.status === 'closed'" title="Resolution">
        <p class="text-sm text-foreground">
          {{ ticket.resolutionNote ?? 'Tim kami telah menyelesaikan permintaan Anda.' }}
        </p>
        <p v-if="ticket.resolvedAt" class="text-xs text-muted-foreground mt-1">
          Diselesaikan {{ formatDate(ticket.resolvedAt) }}
        </p>
        <div class="flex flex-wrap items-center gap-3 mt-4">
          <Button v-if="ticket.status === 'resolved'" size="sm" :disabled="gate.saving.value" @click="handleConfirmResolution">
            Confirm Resolution
          </Button>
          <ResponsiveFormSheet v-model:open="isReopenOpen" title="Reopen Ticket" description="Alasan wajib diisi." content-class="max-w-md">
            <template #trigger>
              <Button size="sm" variant="outline">
                Reopen
              </Button>
            </template>
            <div class="space-y-1.5 py-2">
              <Label for="reopen-reason">Alasan</Label>
              <Input id="reopen-reason" v-model="reopenReason" />
            </div>
            <template #footer>
              <Button variant="outline" @click="isReopenOpen = false">
                Batal
              </Button>
              <Button :disabled="gate.saving.value || !reopenReason.trim()" @click="submitReopen">
                Reopen
              </Button>
            </template>
          </ResponsiveFormSheet>
          <div class="flex items-center gap-1">
            <span class="text-xs text-muted-foreground mr-1">Rating:</span>
            <button
              v-for="star in 5"
              :key="star"
              type="button"
              :disabled="gate.saving.value"
              :aria-label="`Beri rating ${star} bintang`"
              @click="handleRate(star)"
            >
              <Star :class="['h-4 w-4', (ticket.resolutionRating ?? 0) >= star ? 'fill-warning text-warning' : 'text-muted-foreground']" />
            </button>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Reply">
        <ul v-if="replies.length" class="divide-y divide-border mb-4">
          <li v-for="reply in replies" :key="reply.id" class="py-3">
            <p class="text-sm text-foreground">
              {{ reply.message }}
            </p>
            <p v-if="reply.attachmentName" class="text-xs text-muted-foreground mt-1">
              📎 {{ reply.attachmentName }}
            </p>
            <p class="text-xs text-muted-foreground mt-1">
              {{ replyAuthor(reply) }} · {{ formatDateTime(reply.createdAt) }}
            </p>
          </li>
        </ul>
        <EmptyState v-else title="Belum ada balasan" />
        <p v-if="ticket.status === 'closed'" class="border-t border-border pt-4 text-xs text-muted-foreground">
          Ticket sudah ditutup — buka kembali bila masalah belum selesai.
        </p>
        <div v-else class="border-t border-border pt-4 space-y-2">
          <textarea v-model="newReply" rows="2" class="w-full px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring" placeholder="Tulis balasan..." />
          <div class="flex flex-col sm:flex-row gap-2">
            <Input v-model="newAttachmentName" placeholder="Lampiran (opsional, mock)" class="flex-1" />
            <Button size="sm" :disabled="gate.saving.value || !newReply.trim()" @click="submitReply">
              Kirim
            </Button>
          </div>
        </div>
      </SectionCard>
    </template>
  </div>
</template>
