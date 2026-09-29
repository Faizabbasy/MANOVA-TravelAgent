<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { FileX, AlertTriangle, Star } from 'lucide-vue-next'
import {
  getSupportTicketById, getSupportTicketReplies, getProjectById, getUserById,
  replySupportTicket, confirmSupportTicketResolution, reopenSupportTicket, rateSupportTicketResolution,
  getSupportTicketSlaDueDate, isSupportTicketSlaBreached
} from '~/data'
import { SUPPORT_TICKET_CATEGORIES, SUPPORT_TICKET_PRIORITIES, SUPPORT_TICKET_STATUSES, findStatusOption } from '~/constants/status'
import { formatDate, formatDateTime } from '~/utils/format'

/** Issues & Support — Detail (Repair Phase Section 6, Master Prompt bagian 14). Emergency ticket ditandai visual menonjol (banner merah) sesuai Wajib "Emergency ticket harus menonjol secara UI". */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const route = useRoute()
const router = useRouter()
const { canView, clientScopeId } = usePermissions()
const { currentUser } = useCurrentUser()
const { showToast } = useToast()

const ticket = computed(() => getSupportTicketById(String(route.params.id)))
const isOwnCompany = computed(() => Boolean(ticket.value && clientScopeId.value && ticket.value.clientPartyId === clientScopeId.value))
useHead({ title: computed(() => ticket.value ? ticket.value.subject : 'Tidak Ditemukan') })

const project = computed(() => (ticket.value?.projectId ? getProjectById(ticket.value.projectId) : undefined))
const assignedPic = computed(() => (ticket.value?.assignedTo ? getUserById(ticket.value.assignedTo) : undefined))
const replies = computed(() => (ticket.value ? getSupportTicketReplies(ticket.value.id) : []))

const newReply = ref('')
const newAttachmentName = ref('')
function submitReply () {
  if (!ticket.value || !newReply.value.trim()) { return }
  replySupportTicket(ticket.value.id, currentUser.value.id, newReply.value.trim(), newAttachmentName.value.trim() || undefined)
  newReply.value = ''
  newAttachmentName.value = ''
  showToast('Balasan Terkirim', 'Balasan Anda telah ditambahkan ke ticket.', 'success')
}

function handleConfirmResolution () {
  if (!ticket.value) { return }
  const result = confirmSupportTicketResolution(ticket.value.id)
  if (result) { showToast('Ticket Ditutup', 'Terima kasih telah mengonfirmasi penyelesaian.', 'success') }
}

const isReopenOpen = ref(false)
const reopenReason = ref('')
function submitReopen () {
  if (!ticket.value || !reopenReason.value.trim()) { return }
  const result = reopenSupportTicket(ticket.value.id, currentUser.value.id, reopenReason.value.trim())
  reopenReason.value = ''
  isReopenOpen.value = false
  if (result) { showToast('Ticket Dibuka Kembali', 'Tim kami akan meninjau kembali permintaan Anda.', 'info') }
}

function handleRate (rating: number) {
  if (!ticket.value) { return }
  const result = rateSupportTicketResolution(ticket.value.id, rating)
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
            { label: 'Assigned PIC', value: assignedPic?.name ?? 'Belum ditugaskan' },
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
          <Button v-if="ticket.status === 'resolved'" size="sm" @click="handleConfirmResolution">
            Confirm Resolution
          </Button>
          <Dialog v-model:open="isReopenOpen">
            <DialogTrigger as-child>
              <Button size="sm" variant="outline">
                Reopen
              </Button>
            </DialogTrigger>
            <DialogContent class="max-w-md">
              <DialogHeader>
                <DialogTitle>Reopen Ticket</DialogTitle>
                <DialogDescription>Alasan wajib diisi.</DialogDescription>
              </DialogHeader>
              <div class="space-y-1.5 py-2">
                <Label for="reopen-reason">Alasan</Label>
                <Input id="reopen-reason" v-model="reopenReason" />
              </div>
              <DialogFooter>
                <Button variant="outline" @click="isReopenOpen = false">
                  Batal
                </Button>
                <Button :disabled="!reopenReason.trim()" @click="submitReopen">
                  Reopen
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <div class="flex items-center gap-1">
            <span class="text-xs text-muted-foreground mr-1">Rating:</span>
            <button v-for="star in 5" :key="star" type="button" :aria-label="`Beri rating ${star} bintang`" @click="handleRate(star)">
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
              {{ getUserById(reply.authorId)?.name ?? reply.authorId }} · {{ formatDateTime(reply.createdAt) }}
            </p>
          </li>
        </ul>
        <EmptyState v-else title="Belum ada balasan" />
        <div class="border-t border-border pt-4 space-y-2">
          <textarea v-model="newReply" rows="2" class="w-full px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring" placeholder="Tulis balasan..." />
          <div class="flex flex-col sm:flex-row gap-2">
            <Input v-model="newAttachmentName" placeholder="Lampiran (opsional, mock)" class="flex-1" />
            <Button size="sm" :disabled="!newReply.trim()" @click="submitReply">
              Kirim
            </Button>
          </div>
        </div>
      </SectionCard>
    </template>
  </div>
</template>
