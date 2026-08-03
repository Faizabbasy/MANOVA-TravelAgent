<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { Search, Plus, LifeBuoy, AlertTriangle } from 'lucide-vue-next'
import { getProjectsByParty, getSupportTicketsByParty, createSupportTicket, getSupportTicketSlaDueDate, isSupportTicketSlaBreached } from '~/data'
import { SUPPORT_TICKET_CATEGORIES, SUPPORT_TICKET_PRIORITIES, SUPPORT_TICKET_STATUSES, findStatusOption } from '~/constants/status'
import { formatDate } from '~/utils/format'
import type { SupportTicketCategory, SupportTicketPriority, SupportTicketStatus } from '~/types/support'

/**
 * Issues & Support — List (Repair Phase Section 6 — Finance & Collaboration, Master Prompt bagian 14).
 * `SupportTicket` (Section 1 foundation) SENGAJA terpisah dari `Incident` internal (audit trail operasional)
 * — lihat komentar `app/types/support.ts`.
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Issues & Support' })

const route = useRoute()
const { canView, clientScopeId } = usePermissions()
const { currentUser } = useCurrentUser()
const { showToast } = useToast()

const projects = computed(() => (clientScopeId.value ? getProjectsByParty(clientScopeId.value) : []))
const tickets = computed(() => (clientScopeId.value ? getSupportTicketsByParty(clientScopeId.value) : []))

function projectName (projectId?: string): string {
  return projects.value.find(p => p.id === projectId)?.name ?? '—'
}

const search = ref('')
const statusFilter = ref<'all' | SupportTicketStatus>('all')
const categoryFilter = ref<'all' | SupportTicketCategory>('all')

const filteredTickets = computed(() => {
  let result = tickets.value
  if (statusFilter.value !== 'all') { result = result.filter(item => item.status === statusFilter.value) }
  if (categoryFilter.value !== 'all') { result = result.filter(item => item.category === categoryFilter.value) }
  if (search.value.trim()) {
    const q = search.value.toLowerCase()
    result = result.filter(item => item.subject.toLowerCase().includes(q) || item.description.toLowerCase().includes(q))
  }
  return result.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
})

/* --- Create ticket --- */
const isFormOpen = ref(false)
const formProjectId = ref('')
const formCategory = ref<SupportTicketCategory>('operational')
const formPriority = ref<SupportTicketPriority>('medium')
const formSubject = ref('')
const formDescription = ref('')
const formAttachmentName = ref('')

function openCreateForm (prefillProjectId?: string) {
  formProjectId.value = prefillProjectId ?? ''
  formCategory.value = 'operational'
  formPriority.value = 'medium'
  formSubject.value = ''
  formDescription.value = ''
  formAttachmentName.value = ''
  isFormOpen.value = true
}

/** "Create issue" dari Trip Center (`?project=<id>`) — buka form dengan project sudah terisi, bukan shell tanpa konteks. */
onMounted(() => {
  const projectId = String(route.query.project ?? '')
  if (projectId && projects.value.some(project => project.id === projectId)) {
    openCreateForm(projectId)
  }
})

function submitTicket () {
  if (!clientScopeId.value || !formSubject.value.trim() || !formDescription.value.trim()) { return }
  const ticket = createSupportTicket({
    clientPartyId: clientScopeId.value,
    projectId: formProjectId.value || undefined,
    category: formCategory.value,
    priority: formPriority.value,
    subject: formSubject.value.trim(),
    description: formDescription.value.trim(),
    createdBy: currentUser.value.id,
    attachmentName: formAttachmentName.value.trim() || undefined
  })
  isFormOpen.value = false
  if (ticket) { showToast('Ticket Terkirim', `${ticket.id} telah ditugaskan ke tim kami.`, 'success') }
}
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Issues & Support"
      description="Ajukan dan pantau tiket bantuan untuk seluruh Project Order Anda."
      :breadcrumb="[{ label: 'Client Portal', to: '/client' }, { label: 'Collaboration' }, { label: 'Issues & Support' }]"
    >
      <template #actions>
        <Dialog v-model:open="isFormOpen">
          <DialogTrigger as-child>
            <Button size="sm" @click="openCreateForm()">
              <Plus class="h-4 w-4 mr-1.5" />Create Ticket
            </Button>
          </DialogTrigger>
          <DialogScrollContent class="max-w-lg">
            <DialogHeader>
              <DialogTitle>Buat Support Ticket</DialogTitle>
              <DialogDescription>Tim kami akan ditugaskan otomatis sesuai kategori.</DialogDescription>
            </DialogHeader>
            <div class="space-y-4 py-2">
              <div class="space-y-1.5">
                <Label for="tck-project">Project Order (opsional)</Label>
                <select id="tck-project" v-model="formProjectId" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                  <option value="">
                    Tidak terkait project tertentu
                  </option>
                  <option v-for="project in projects" :key="project.id" :value="project.id">
                    {{ project.name }}
                  </option>
                </select>
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div class="space-y-1.5">
                  <Label for="tck-category">Kategori</Label>
                  <select id="tck-category" v-model="formCategory" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                    <option v-for="option in SUPPORT_TICKET_CATEGORIES" :key="option.value" :value="option.value">
                      {{ option.label }}
                    </option>
                  </select>
                </div>
                <div class="space-y-1.5">
                  <Label for="tck-priority">Priority</Label>
                  <select id="tck-priority" v-model="formPriority" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                    <option v-for="option in SUPPORT_TICKET_PRIORITIES" :key="option.value" :value="option.value">
                      {{ option.label }}
                    </option>
                  </select>
                </div>
              </div>
              <div class="space-y-1.5">
                <Label for="tck-subject">Subjek</Label>
                <Input id="tck-subject" v-model="formSubject" placeholder="mis. Kendala reservasi hotel" />
              </div>
              <div class="space-y-1.5">
                <Label for="tck-description">Deskripsi</Label>
                <textarea id="tck-description" v-model="formDescription" rows="3" class="w-full px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div class="space-y-1.5">
                <Label for="tck-attachment">Lampiran (opsional, mock)</Label>
                <Input id="tck-attachment" v-model="formAttachmentName" placeholder="mis. foto-bukti.jpg" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" @click="isFormOpen = false">
                Batal
              </Button>
              <Button :disabled="!formSubject.trim() || !formDescription.trim()" @click="submitTicket">
                Kirim
              </Button>
            </DialogFooter>
          </DialogScrollContent>
        </Dialog>
      </template>
    </PageHeader>

    <RoleAccessState v-if="!canView('client-portal')" module-label="Client Portal" />

    <template v-else>
      <SectionCard>
        <div class="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4 flex-wrap">
          <div class="relative flex-1 max-w-sm w-full">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input v-model="search" placeholder="Cari subjek atau deskripsi..." class="pl-9" />
          </div>
          <select v-model="statusFilter" class="appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
            <option value="all">
              Semua Status
            </option>
            <option v-for="option in SUPPORT_TICKET_STATUSES" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
          <select v-model="categoryFilter" class="appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
            <option value="all">
              Semua Kategori
            </option>
            <option v-for="option in SUPPORT_TICKET_CATEGORIES" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </div>

        <ul v-if="filteredTickets.length" class="divide-y divide-border">
          <li v-for="ticket in filteredTickets" :key="ticket.id">
            <NuxtLink :to="`/client/support/${ticket.id}`" :class="['py-3 flex items-center justify-between gap-3 group block rounded-lg', ticket.category === 'emergency' && 'bg-destructive/5 -mx-3 px-3 border-l-2 border-destructive']">
              <div class="min-w-0">
                <div class="flex items-center gap-2">
                  <AlertTriangle v-if="ticket.category === 'emergency'" class="h-3.5 w-3.5 text-destructive shrink-0" />
                  <p class="text-sm font-medium text-foreground truncate group-hover:underline">
                    {{ ticket.subject }}
                  </p>
                </div>
                <p class="text-xs text-muted-foreground truncate">
                  {{ ticket.id }} · {{ projectName(ticket.projectId) }} · {{ findStatusOption(SUPPORT_TICKET_CATEGORIES, ticket.category).label }} · {{ formatDate(ticket.createdAt) }}
                  <template v-if="isSupportTicketSlaBreached(ticket)">
                    · <span class="text-destructive font-medium">SLA Terlewati (target {{ formatDate(getSupportTicketSlaDueDate(ticket)) }})</span>
                  </template>
                </p>
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <StatusBadge :label="findStatusOption(SUPPORT_TICKET_PRIORITIES, ticket.priority).label" :tone="findStatusOption(SUPPORT_TICKET_PRIORITIES, ticket.priority).tone" />
                <StatusBadge :label="findStatusOption(SUPPORT_TICKET_STATUSES, ticket.status).label" :tone="findStatusOption(SUPPORT_TICKET_STATUSES, ticket.status).tone" />
              </div>
            </NuxtLink>
          </li>
        </ul>
        <EmptyState v-else :icon="LifeBuoy" :title="tickets.length ? 'Tidak ada ticket yang cocok' : 'Belum ada Support Ticket'" :description="tickets.length ? 'Coba ubah kata kunci pencarian atau filter.' : 'Buat ticket baru lewat tombol di atas bila Anda membutuhkan bantuan.'" />
      </SectionCard>
    </template>
  </div>
</template>
