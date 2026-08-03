<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { FileX, MessageSquare } from 'lucide-vue-next'
import {
  getProjectById, getUserById, USERS,
  getClientProjectMessages, markProjectMessagesRead, sendMessage,
  getUnifiedActivityTimeline, getQuotationByOpportunity, getChangeRequestsByProject, getLatestItineraryVersion
} from '~/data'
import { formatDateTime } from '~/utils/format'

/**
 * Messages & Activities — Detail per Project (Repair Phase Section 6, Master Prompt bagian 13). Tab
 * "Messages" reuse `sendMessage`/`getClientProjectMessages` (channel client-message, `internal-note` TIDAK
 * PERNAH ditampilkan). Tab "Activity Timeline" reuse `getUnifiedActivityTimeline('project', projectId,
 * 'client')` (Section 21, LOCKED) yang SUDAH menggerbangi `internalOnly` — "Pisahkan message dan system
 * activity" terpenuhi karena timeline ini SENGAJA mengecualikan `kind: 'message'` (sudah ada tab sendiri).
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const route = useRoute()
const router = useRouter()
const { canView, clientScopeId } = usePermissions()
const { currentUser } = useCurrentUser()
const { showToast } = useToast()

const project = computed(() => getProjectById(String(route.params.projectId)))
const isOwnCompany = computed(() => Boolean(project.value && clientScopeId.value && project.value.partyId === clientScopeId.value))
useHead({ title: computed(() => project.value ? `Messages — ${project.value.name}` : 'Tidak Ditemukan') })

type Tab = 'messages' | 'activity'
const activeTab = computed<Tab>({
  get: () => (['messages', 'activity'].includes(route.query.tab as string) ? (route.query.tab as Tab) : 'messages'),
  set: value => router.replace({ query: { ...route.query, tab: value } })
})

onMounted(() => {
  if (project.value && isOwnCompany.value) { markProjectMessagesRead(project.value.id, currentUser.value.id) }
})

const messages = computed(() => (project.value ? getClientProjectMessages(project.value.id) : []))

const newMessage = ref('')
const newAttachmentName = ref('')
const newMentions = ref<string[]>([])
const internalUsers = computed(() => USERS.filter(user => user.role !== 'client' && user.role !== 'supplier'))
function toggleMention (userId: string) {
  const index = newMentions.value.indexOf(userId)
  if (index === -1) { newMentions.value.push(userId) } else { newMentions.value.splice(index, 1) }
}
function submitMessage () {
  if (!project.value || !newMessage.value.trim()) { return }
  sendMessage({
    entityType: 'project',
    entityId: project.value.id,
    projectId: project.value.id,
    channel: 'client-message',
    senderId: currentUser.value.id,
    body: newMessage.value.trim(),
    mentions: newMentions.value.length ? [...newMentions.value] : undefined,
    attachmentName: newAttachmentName.value.trim() || undefined
  })
  newMessage.value = ''
  newAttachmentName.value = ''
  newMentions.value = []
  showToast('Pesan Terkirim', 'Pesan Anda telah dikirim ke tim kami.', 'success')
}

/* --- Activity timeline --- */
const kindFilter = ref<'all' | 'activity' | 'document'>('all')
const activityTimeline = computed(() => {
  if (!project.value) { return [] }
  let entries = getUnifiedActivityTimeline('project', project.value.id, 'client').filter(entry => entry.kind !== 'message')
  if (kindFilter.value !== 'all') { entries = entries.filter(entry => entry.kind === kindFilter.value) }
  return entries
})

/* --- Related conversations --- */
const quotation = computed(() => (project.value?.opportunityId ? getQuotationByOpportunity(project.value.opportunityId) : undefined))
const latestItineraryVersion = computed(() => (project.value ? getLatestItineraryVersion(project.value.id) : undefined))
const changeRequests = computed(() => (project.value ? getChangeRequestsByProject(project.value.id) : []))
</script>

<template>
  <div class="space-y-6">
    <template v-if="!project || !isOwnCompany">
      <PageHeader title="Tidak Ditemukan" :breadcrumb="[{ label: 'Client Portal', to: '/client' }, { label: 'Tidak Ditemukan' }]" />
      <SectionCard>
        <EmptyState :icon="FileX" title="Project Order tidak ditemukan" description="Project Order ini tidak ada atau bukan milik company Anda.">
          <Button @click="router.push('/client/messages')">
            Kembali ke Messages & Activities
          </Button>
        </EmptyState>
      </SectionCard>
    </template>

    <RoleAccessState v-else-if="!canView('client-portal')" module-label="Client Portal" />

    <template v-else>
      <PageHeader
        :title="project.name"
        :breadcrumb="[{ label: 'Client Portal', to: '/client' }, { label: 'Collaboration' }, { label: 'Messages & Activities', to: '/client/messages' }, { label: project.name }]"
      />

      <SectionCard title="Percakapan Terkait" description="Comment thread khusus per entitas — bukan duplikasi channel pesan project ini.">
        <div class="flex flex-wrap gap-2">
          <NuxtLink v-if="quotation" :to="`/client/quotations/${quotation.id}`">
            <Button size="sm" variant="outline">
              Quotation Conversation
            </Button>
          </NuxtLink>
          <NuxtLink v-if="latestItineraryVersion" :to="`/client/itineraries/${project.id}`">
            <Button size="sm" variant="outline">
              Itinerary Conversation
            </Button>
          </NuxtLink>
          <NuxtLink v-for="cr in changeRequests" :key="cr.id" :to="`/client/change-requests/${cr.id}`">
            <Button size="sm" variant="outline">
              Change Request {{ cr.id }}
            </Button>
          </NuxtLink>
          <p v-if="!quotation && !latestItineraryVersion && changeRequests.length === 0" class="text-sm text-muted-foreground">
            Belum ada quotation/itinerary/change request untuk Project Order ini.
          </p>
        </div>
      </SectionCard>

      <Tabs v-model="activeTab">
        <TabsList>
          <TabsTrigger value="messages">
            Messages
          </TabsTrigger>
          <TabsTrigger value="activity">
            Activity Timeline
          </TabsTrigger>
        </TabsList>

        <TabsContent value="messages">
          <SectionCard>
            <ul v-if="messages.length" class="space-y-4 mb-4">
              <li v-for="message in messages" :key="message.id" :class="['max-w-lg', message.senderId === currentUser.id ? 'ml-auto text-right' : '']">
                <div :class="['inline-block rounded-lg px-3 py-2 text-sm', message.senderId === currentUser.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground']">
                  {{ message.body }}
                  <p v-if="message.attachmentName" class="text-xs opacity-80 mt-1">
                    📎 {{ message.attachmentName }}
                  </p>
                </div>
                <p class="text-xs text-muted-foreground mt-0.5">
                  {{ getUserById(message.senderId)?.name ?? message.senderId }} · {{ formatDateTime(message.sentAt) }}
                </p>
              </li>
            </ul>
            <EmptyState v-else :icon="MessageSquare" title="Belum ada pesan" description="Mulai percakapan dengan tim kami di bawah." />

            <div class="border-t border-border pt-4 space-y-2">
              <textarea v-model="newMessage" rows="2" class="w-full px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring" placeholder="Tulis pesan..." />
              <div class="flex flex-col sm:flex-row gap-2 sm:items-center">
                <Input v-model="newAttachmentName" placeholder="Nama lampiran (opsional, mock)" class="sm:max-w-xs" />
                <div class="flex flex-wrap gap-1.5 flex-1">
                  <button
                    v-for="user in internalUsers"
                    :key="user.id"
                    type="button"
                    :class="['px-2 py-1 text-xs rounded-full border', newMentions.includes(user.id) ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border text-muted-foreground']"
                    @click="toggleMention(user.id)"
                  >
                    @{{ user.name }}
                  </button>
                </div>
                <Button size="sm" :disabled="!newMessage.trim()" class="shrink-0" @click="submitMessage">
                  Kirim
                </Button>
              </div>
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="activity">
          <div class="flex items-center gap-3 mb-4">
            <select v-model="kindFilter" class="appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
              <option value="all">
                Semua Tipe
              </option>
              <option value="activity">
                System Activity
              </option>
              <option value="document">
                Document Activity
              </option>
            </select>
          </div>
          <SectionCard>
            <ActivityTimeline
              :items="activityTimeline.map(entry => ({ id: entry.id, message: `${entry.label} — ${entry.detail}`, createdAt: entry.at }))"
              empty-label="Belum ada aktivitas tercatat"
            />
          </SectionCard>
        </TabsContent>
      </Tabs>
    </template>
  </div>
</template>
