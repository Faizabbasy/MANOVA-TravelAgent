<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Search, Plus, FileText, Bell, AlertTriangle, CheckCheck, X, ExternalLink, List, LayoutGrid, Image, FileSpreadsheet, File as FileIcon } from 'lucide-vue-next'
import {
  PROJECTS, USERS,
  getProjectById, getUserById,
  DOCUMENT_RECORDS, MESSAGE_RECORDS,
  createDocument, sendMessage,
  getNotificationsForUser, getUnreadNotificationCount,
  markNotificationRead, markAllNotificationsRead, removeNotification
} from '~/data'
import {
  DOCUMENT_ENTITY_TYPES, DOCUMENT_ACCESS_LEVELS, MESSAGE_CHANNELS, MESSAGE_DELIVERY_STATUSES, NOTIFICATION_TYPES,
  findStatusOption
} from '~/constants/status'
import { formatDate } from '~/utils/format'
import { isDocumentExpired, isDocumentExpiringSoon } from '~/utils/attention'
import type { DocumentEntityType, DocumentAccessLevel, MessageChannel } from '~/types/document-comms'

/**
 * Documents & Communication (Section 21 — roadmap Section 00–24 baru, D-078). Modul konsolidasi-style baru
 * MENDAMPINGI (bukan menggantikan) `ProjectDocument`/`getDocumentsByProject`/`getDocumentsByParty` (Section
 * 14 lama/Prompt 19) dan `VendorDocument` (Section 17) — lihat `app/types/document-comms.ts` untuk rasional
 * lengkap. Pola halaman (tab via query-param) mengikuti `/changes` (Section 19), preseden konsolidasi
 * ter-dekat. Tab "Notifications" adalah tujuan kanonik "View all notifications" dari `NotificationPanel.vue`
 * (bell popover, TopHeader) — SATU-SATUNYA UI daftar notifikasi lengkap, tidak ada halaman kedua yang divergen.
 */

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Documents & Communication' })

const route = useRoute()
const router = useRouter()
const { currentUser } = useCurrentUser()
const { canView, canManage } = usePermissions()
const { showToast } = useToast()
const canManageDocuments = computed(() => canManage('documents'))

type DocTab = 'documents' | 'messages' | 'notifications'
const activeTab = computed<DocTab>({
  get: () => {
    const tab = route.query.tab as string
    return (['documents', 'messages', 'notifications'].includes(tab) ? tab : 'documents') as DocTab
  },
  set: value => router.replace({ query: { ...route.query, tab: value } })
})

function entityLabel (entityType: DocumentEntityType, entityId: string): string {
  return `${findStatusOption(DOCUMENT_ENTITY_TYPES, entityType).label} · ${entityId}`
}

/* --- Documents tab --- */
const docViewMode = ref<'list' | 'grid'>('list')
/** Ikon kartu Grid — dokumen di sini murni metadata mock (tidak ada file/thumbnail sungguhan), jadi ikon
 * ditentukan dari ekstensi nama file, pola sama Google Drive saat tidak ada preview. */
function documentFileIcon (name: string) {
  const extension = name.split('.').pop()?.toLowerCase() ?? ''
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension)) { return Image }
  if (['xls', 'xlsx', 'csv'].includes(extension)) { return FileSpreadsheet }
  if (['pdf', 'doc', 'docx'].includes(extension)) { return FileText }
  return FileIcon
}
const docSearch = ref('')
const docCategoryFilter = ref('all')
const docAccessFilter = ref<'all' | DocumentAccessLevel>('all')
const docEntityFilter = ref<'all' | DocumentEntityType>('all')
const docExpiryFilter = ref<'all' | 'expired' | 'expiring-soon'>('all')

const documentCategories = computed(() => Array.from(new Set(DOCUMENT_RECORDS.map(item => item.category))).sort())

const documentRows = computed(() => {
  let result = DOCUMENT_RECORDS.map(item => ({ item, project: item.projectId ? getProjectById(item.projectId) : undefined }))
  if (docCategoryFilter.value !== 'all') { result = result.filter(row => row.item.category === docCategoryFilter.value) }
  if (docAccessFilter.value !== 'all') { result = result.filter(row => row.item.accessLevel === docAccessFilter.value) }
  if (docEntityFilter.value !== 'all') { result = result.filter(row => row.item.entityType === docEntityFilter.value) }
  if (docExpiryFilter.value === 'expired') { result = result.filter(row => isDocumentExpired(row.item.expiresAt)) }
  if (docExpiryFilter.value === 'expiring-soon') { result = result.filter(row => isDocumentExpiringSoon(row.item.expiresAt)) }
  if (docSearch.value.trim()) {
    const q = docSearch.value.toLowerCase()
    result = result.filter(row => row.item.name.toLowerCase().includes(q) || row.item.entityId.toLowerCase().includes(q) || (row.project?.name ?? '').toLowerCase().includes(q))
  }
  return result.sort((a, b) => (b.item.uploadedAt ?? b.item.generatedAt ?? '').localeCompare(a.item.uploadedAt ?? a.item.generatedAt ?? ''))
})

const expiredCount = computed(() => DOCUMENT_RECORDS.filter(item => isDocumentExpired(item.expiresAt)).length)
const expiringSoonCount = computed(() => DOCUMENT_RECORDS.filter(item => isDocumentExpiringSoon(item.expiresAt)).length)

const isUploadOpen = ref(false)
const newDocEntityType = ref<DocumentEntityType>('project')
const newDocEntityId = ref('')
const newDocProjectId = ref('')
const newDocName = ref('')
const newDocCategory = ref('')
const newDocAccessLevel = ref<DocumentAccessLevel>('internal')
const newDocExpiresAt = ref('')

function resetUploadForm () {
  newDocEntityType.value = 'project'
  newDocEntityId.value = ''
  newDocProjectId.value = ''
  newDocName.value = ''
  newDocCategory.value = ''
  newDocAccessLevel.value = 'internal'
  newDocExpiresAt.value = ''
}

function submitUpload () {
  if (!newDocEntityId.value.trim() || !newDocName.value.trim() || !newDocCategory.value.trim()) { return }
  const document = createDocument({
    entityType: newDocEntityType.value,
    entityId: newDocEntityId.value.trim(),
    projectId: newDocProjectId.value || undefined,
    name: newDocName.value.trim(),
    category: newDocCategory.value.trim(),
    accessLevel: newDocAccessLevel.value,
    expiresAt: newDocExpiresAt.value || undefined,
    uploadedBy: currentUser.value.id
  })
  resetUploadForm()
  isUploadOpen.value = false
  showToast('Dokumen Diunggah', `${document.name} tercatat sebagai versi ${document.version} (mock, bukan file upload nyata).`, 'success')
}

/* --- Messages tab --- */
const msgSearch = ref('')
const msgChannelFilter = ref<'all' | MessageChannel>('all')

const messageRows = computed(() => {
  let result = MESSAGE_RECORDS.map(item => ({ item, project: item.projectId ? getProjectById(item.projectId) : undefined, sender: getUserById(item.senderId) }))
  if (msgChannelFilter.value !== 'all') { result = result.filter(row => row.item.channel === msgChannelFilter.value) }
  if (msgSearch.value.trim()) {
    const q = msgSearch.value.toLowerCase()
    result = result.filter(row => row.item.body.toLowerCase().includes(q) || row.item.entityId.toLowerCase().includes(q) || (row.project?.name ?? '').toLowerCase().includes(q))
  }
  return result.sort((a, b) => b.item.sentAt.localeCompare(a.item.sentAt))
})

const failedDeliveryCount = computed(() => MESSAGE_RECORDS.filter(item => item.deliveryStatus === 'failed').length)

const isComposeOpen = ref(false)
const newMsgEntityType = ref<DocumentEntityType>('project')
const newMsgEntityId = ref('')
const newMsgProjectId = ref('')
const newMsgChannel = ref<MessageChannel>('internal-note')
const newMsgBody = ref('')
const newMsgMentions = ref<string[]>([])
const newMsgDeliveryChannel = ref<'email' | 'whatsapp'>('email')

function resetComposeForm () {
  newMsgEntityType.value = 'project'
  newMsgEntityId.value = ''
  newMsgProjectId.value = ''
  newMsgChannel.value = 'internal-note'
  newMsgBody.value = ''
  newMsgMentions.value = []
  newMsgDeliveryChannel.value = 'email'
}

function toggleMention (userId: string) {
  const index = newMsgMentions.value.indexOf(userId)
  if (index === -1) { newMsgMentions.value.push(userId) } else { newMsgMentions.value.splice(index, 1) }
}

function submitCompose () {
  if (!newMsgEntityId.value.trim() || !newMsgBody.value.trim()) { return }
  const message = sendMessage({
    entityType: newMsgEntityType.value,
    entityId: newMsgEntityId.value.trim(),
    projectId: newMsgProjectId.value || undefined,
    channel: newMsgChannel.value,
    senderId: currentUser.value.id,
    body: newMsgBody.value.trim(),
    mentions: newMsgMentions.value.length ? [...newMsgMentions.value] : undefined,
    deliveryChannel: newMsgChannel.value === 'internal-note' ? undefined : newMsgDeliveryChannel.value
  })
  resetComposeForm()
  isComposeOpen.value = false
  showToast('Pesan Terkirim', `Status: ${findStatusOption(MESSAGE_DELIVERY_STATUSES, message.deliveryStatus).label} (simulasi, bukan email/WA nyata).`, 'success')
}

/* --- Notifications tab (tujuan kanonik "View all notifications") --- */
const notifications = computed(() => getNotificationsForUser(currentUser.value.id))
const unreadCount = computed(() => getUnreadNotificationCount(currentUser.value.id))
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Documents & Communication"
      description="Document center konsolidasi (categories/version/expiry/access level), internal notes/client/supplier messages, dan in-app notification center — Section 21."
      :breadcrumb="[{ label: 'Documents & Communication' }]"
    >
      <template v-if="canManageDocuments && activeTab === 'documents'" #actions>
        <Dialog v-model:open="isUploadOpen">
          <DialogTrigger as-child>
            <Button size="sm">
              <Plus class="h-4 w-4 mr-1.5" />Upload Document
            </Button>
          </DialogTrigger>
          <DialogScrollContent class="max-w-lg">
            <DialogHeader>
              <DialogTitle>Upload Document Baru</DialogTitle>
              <DialogDescription>Mock upload — tidak ada file storage nyata, hanya metadata tercatat (D-006).</DialogDescription>
            </DialogHeader>
            <div class="space-y-4 py-2">
              <div class="grid grid-cols-2 gap-3">
                <div class="space-y-1.5">
                  <Label for="doc-entity-type">Entity Type</Label>
                  <select id="doc-entity-type" v-model="newDocEntityType" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                    <option v-for="option in DOCUMENT_ENTITY_TYPES" :key="option.value" :value="option.value">
                      {{ option.label }}
                    </option>
                  </select>
                </div>
                <div class="space-y-1.5">
                  <Label for="doc-entity-id">Entity ID</Label>
                  <Input id="doc-entity-id" v-model="newDocEntityId" placeholder="mis. PRJ-101" />
                </div>
              </div>
              <div class="space-y-1.5">
                <Label for="doc-project">Project (opsional, untuk filter cross-project)</Label>
                <select id="doc-project" v-model="newDocProjectId" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                  <option value="">
                    Tidak terkait project tertentu
                  </option>
                  <option v-for="project in PROJECTS" :key="project.id" :value="project.id">
                    {{ project.name }}
                  </option>
                </select>
              </div>
              <div class="space-y-1.5">
                <Label for="doc-name">Nama Dokumen</Label>
                <Input id="doc-name" v-model="newDocName" placeholder="mis. Kontrak_Vendor_Terbaru.pdf" />
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div class="space-y-1.5">
                  <Label for="doc-category">Category</Label>
                  <Input id="doc-category" v-model="newDocCategory" placeholder="mis. Contract" />
                </div>
                <div class="space-y-1.5">
                  <Label for="doc-access">Access Level</Label>
                  <select id="doc-access" v-model="newDocAccessLevel" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                    <option v-for="option in DOCUMENT_ACCESS_LEVELS" :key="option.value" :value="option.value">
                      {{ option.label }}
                    </option>
                  </select>
                </div>
              </div>
              <div class="space-y-1.5">
                <Label for="doc-expiry">Expiry Date (opsional)</Label>
                <Input id="doc-expiry" v-model="newDocExpiresAt" type="date" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" @click="isUploadOpen = false">
                Batal
              </Button>
              <Button :disabled="!newDocEntityId.trim() || !newDocName.trim() || !newDocCategory.trim()" @click="submitUpload">
                Simpan
              </Button>
            </DialogFooter>
          </DialogScrollContent>
        </Dialog>
      </template>

      <template v-else-if="canManageDocuments && activeTab === 'messages'" #actions>
        <Dialog v-model:open="isComposeOpen">
          <DialogTrigger as-child>
            <Button size="sm">
              <Plus class="h-4 w-4 mr-1.5" />New Message
            </Button>
          </DialogTrigger>
          <DialogScrollContent class="max-w-lg">
            <DialogHeader>
              <DialogTitle>Kirim Pesan Baru</DialogTitle>
              <DialogDescription>Internal note, client message, atau supplier message — delivery status simulasi mock, tanpa integrasi email/WhatsApp nyata.</DialogDescription>
            </DialogHeader>
            <div class="space-y-4 py-2">
              <div class="grid grid-cols-2 gap-3">
                <div class="space-y-1.5">
                  <Label for="msg-entity-type">Entity Type</Label>
                  <select id="msg-entity-type" v-model="newMsgEntityType" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                    <option v-for="option in DOCUMENT_ENTITY_TYPES" :key="option.value" :value="option.value">
                      {{ option.label }}
                    </option>
                  </select>
                </div>
                <div class="space-y-1.5">
                  <Label for="msg-entity-id">Entity ID</Label>
                  <Input id="msg-entity-id" v-model="newMsgEntityId" placeholder="mis. PRJ-101" />
                </div>
              </div>
              <div class="space-y-1.5">
                <Label for="msg-project">Project (opsional)</Label>
                <select id="msg-project" v-model="newMsgProjectId" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                  <option value="">
                    Tidak terkait project tertentu
                  </option>
                  <option v-for="project in PROJECTS" :key="project.id" :value="project.id">
                    {{ project.name }}
                  </option>
                </select>
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div class="space-y-1.5">
                  <Label for="msg-channel">Channel</Label>
                  <select id="msg-channel" v-model="newMsgChannel" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                    <option v-for="option in MESSAGE_CHANNELS" :key="option.value" :value="option.value">
                      {{ option.label }}
                    </option>
                  </select>
                </div>
                <div v-if="newMsgChannel !== 'internal-note'" class="space-y-1.5">
                  <Label for="msg-delivery-channel">Delivery Channel (mock)</Label>
                  <select id="msg-delivery-channel" v-model="newMsgDeliveryChannel" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                    <option value="email">
                      Email
                    </option>
                    <option value="whatsapp">
                      WhatsApp
                    </option>
                  </select>
                </div>
              </div>
              <div class="space-y-1.5">
                <Label for="msg-body">Pesan</Label>
                <textarea id="msg-body" v-model="newMsgBody" rows="3" class="w-full px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div class="space-y-1.5">
                <Label>Mentions (opsional — memicu notifikasi)</Label>
                <div class="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 border border-border rounded-lg">
                  <button
                    v-for="user in USERS"
                    :key="user.id"
                    type="button"
                    :class="['px-2 py-1 text-xs rounded-full border', newMsgMentions.includes(user.id) ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border text-muted-foreground']"
                    @click="toggleMention(user.id)"
                  >
                    {{ user.name }}
                  </button>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" @click="isComposeOpen = false">
                Batal
              </Button>
              <Button :disabled="!newMsgEntityId.trim() || !newMsgBody.trim()" @click="submitCompose">
                Kirim
              </Button>
            </DialogFooter>
          </DialogScrollContent>
        </Dialog>
      </template>

      <template v-else-if="activeTab === 'notifications' && unreadCount > 0" #actions>
        <Button size="sm" variant="outline" @click="markAllNotificationsRead(currentUser.id)">
          <CheckCheck class="h-4 w-4 mr-1.5" />Mark All Read
        </Button>
      </template>
    </PageHeader>

    <RoleAccessState v-if="!canView('documents')" module-label="modul Documents & Communication" />

    <template v-else>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Total Documents" :value="String(DOCUMENT_RECORDS.length)" :icon="FileText" />
        <StatsCard title="Expired" :value="String(expiredCount)" :icon="AlertTriangle" icon-color="destructive" />
        <StatsCard title="Akan Kedaluwarsa" :value="String(expiringSoonCount)" :icon="AlertTriangle" icon-color="warning" />
        <StatsCard title="Notifikasi Belum Dibaca" :value="String(unreadCount)" :icon="Bell" icon-color="warning" />
      </div>

      <Tabs v-model="activeTab">
        <TabsList>
          <TabsTrigger value="documents">
            Documents
          </TabsTrigger>
          <TabsTrigger value="messages">
            Messages
          </TabsTrigger>
          <TabsTrigger value="notifications">
            Notifications
          </TabsTrigger>
        </TabsList>

        <TabsContent value="documents">
          <div class="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4 flex-wrap">
            <div class="relative flex-1 max-w-sm w-full">
              <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input v-model="docSearch" placeholder="Cari nama dokumen, entity, atau project..." class="pl-9" />
            </div>
            <select v-model="docCategoryFilter" class="appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
              <option value="all">
                Semua Category
              </option>
              <option v-for="category in documentCategories" :key="category" :value="category">
                {{ category }}
              </option>
            </select>
            <select v-model="docAccessFilter" class="appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
              <option value="all">
                Semua Access Level
              </option>
              <option v-for="option in DOCUMENT_ACCESS_LEVELS" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
            <select v-model="docEntityFilter" class="appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
              <option value="all">
                Semua Entity Type
              </option>
              <option v-for="option in DOCUMENT_ENTITY_TYPES" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
            <select v-model="docExpiryFilter" class="appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
              <option value="all">
                Semua Status Expiry
              </option>
              <option value="expired">
                Expired
              </option>
              <option value="expiring-soon">
                Akan Kedaluwarsa
              </option>
            </select>
            <div class="relative flex items-center gap-1 rounded-lg border border-border p-0.5 ml-auto">
              <div
                class="absolute inset-y-0.5 left-0.5 h-8 w-8 rounded-md bg-success transition-transform duration-300 ease-in-out"
                :class="docViewMode === 'grid' ? 'translate-x-[calc(100%+0.25rem)]' : 'translate-x-0'"
              />
              <button
                type="button"
                class="relative z-10 flex h-8 w-8 items-center justify-center rounded-md transition-colors duration-300"
                :class="docViewMode === 'list' ? 'text-success-foreground' : 'text-muted-foreground hover:text-foreground'"
                @click="docViewMode = 'list'"
              >
                <List class="h-4 w-4" />
              </button>
              <button
                type="button"
                class="relative z-10 flex h-8 w-8 items-center justify-center rounded-md transition-colors duration-300"
                :class="docViewMode === 'grid' ? 'text-success-foreground' : 'text-muted-foreground hover:text-foreground'"
                @click="docViewMode = 'grid'"
              >
                <LayoutGrid class="h-4 w-4" />
              </button>
            </div>
          </div>
          <SectionCard v-if="docViewMode === 'list'" description="Dokumen 'uploaded' murni metadata mock; dokumen 'generated' menautkan ke halaman preview existing (tidak menduplikasi generator dokumen).">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Document</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Access Level</TableHead>
                  <TableHead>Expiry</TableHead>
                  <TableHead>Source</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="row in documentRows" :key="row.item.id">
                  <TableCell class="font-medium text-foreground max-w-[220px] truncate">
                    {{ row.item.name }}
                  </TableCell>
                  <TableCell class="text-muted-foreground">
                    {{ entityLabel(row.item.entityType, row.item.entityId) }}
                  </TableCell>
                  <TableCell class="text-muted-foreground">
                    {{ row.project?.name ?? '—' }}
                  </TableCell>
                  <TableCell class="text-muted-foreground">
                    {{ row.item.category }}
                  </TableCell>
                  <TableCell class="text-muted-foreground">
                    v{{ row.item.version }}
                  </TableCell>
                  <TableCell><StatusBadge :label="findStatusOption(DOCUMENT_ACCESS_LEVELS, row.item.accessLevel).label" :tone="findStatusOption(DOCUMENT_ACCESS_LEVELS, row.item.accessLevel).tone" /></TableCell>
                  <TableCell>
                    <template v-if="row.item.expiresAt">
                      <StatusBadge
                        :label="isDocumentExpired(row.item.expiresAt) ? `Expired ${formatDate(row.item.expiresAt)}` : isDocumentExpiringSoon(row.item.expiresAt) ? `Segera: ${formatDate(row.item.expiresAt)}` : formatDate(row.item.expiresAt)"
                        :tone="isDocumentExpired(row.item.expiresAt) ? 'destructive' : isDocumentExpiringSoon(row.item.expiresAt) ? 'warning' : 'neutral'"
                      />
                    </template>
                    <span v-else class="text-xs text-muted-foreground">Tidak ada</span>
                  </TableCell>
                  <TableCell>
                    <NuxtLink v-if="row.item.sourceType === 'generated' && row.item.previewRoute" :to="row.item.previewRoute" target="_blank" class="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                      Preview <ExternalLink class="h-3 w-3" />
                    </NuxtLink>
                    <span v-else class="text-xs text-muted-foreground">Uploaded</span>
                  </TableCell>
                </TableRow>
                <TableEmpty v-if="documentRows.length === 0" :colspan="8">
                  {{ docSearch || docCategoryFilter !== 'all' || docAccessFilter !== 'all' || docEntityFilter !== 'all' || docExpiryFilter !== 'all' ? 'Tidak ada dokumen yang cocok dengan filter.' : 'Belum ada dokumen tercatat.' }}
                </TableEmpty>
              </TableBody>
            </Table>
          </SectionCard>

          <SectionCard v-else description="Dokumen 'uploaded' murni metadata mock; dokumen 'generated' menautkan ke halaman preview existing (tidak menduplikasi generator dokumen).">
            <div v-if="documentRows.length > 0" class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
              <a
                v-for="row in documentRows"
                :key="row.item.id"
                :href="row.item.sourceType === 'generated' && row.item.previewRoute ? row.item.previewRoute : undefined"
                :target="row.item.sourceType === 'generated' && row.item.previewRoute ? '_blank' : undefined"
                class="flex flex-col items-center gap-2 rounded-lg border border-border p-4 text-center hover:bg-accent/50 transition-colors"
                :class="row.item.sourceType === 'generated' && row.item.previewRoute ? 'cursor-pointer' : 'cursor-default'"
              >
                <component :is="documentFileIcon(row.item.name)" class="h-10 w-10 text-muted-foreground" />
                <p class="text-xs font-medium text-foreground w-full truncate" :title="row.item.name">
                  {{ row.item.name }}
                </p>
              </a>
            </div>
            <p v-else class="text-sm text-muted-foreground text-center py-6">
              {{ docSearch || docCategoryFilter !== 'all' || docAccessFilter !== 'all' || docEntityFilter !== 'all' || docExpiryFilter !== 'all' ? 'Tidak ada dokumen yang cocok dengan filter.' : 'Belum ada dokumen tercatat.' }}
            </p>
          </SectionCard>
        </TabsContent>

        <TabsContent value="messages">
          <div class="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
            <div class="relative flex-1 max-w-sm w-full">
              <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input v-model="msgSearch" placeholder="Cari isi pesan, entity, atau project..." class="pl-9" />
            </div>
            <select v-model="msgChannelFilter" class="appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
              <option value="all">
                Semua Channel
              </option>
              <option v-for="option in MESSAGE_CHANNELS" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
            <StatusBadge v-if="failedDeliveryCount > 0" :label="`${failedDeliveryCount} Gagal Terkirim`" tone="destructive" />
          </div>
          <SectionCard description="Delivery status Email/WhatsApp bersifat simulasi mock (D-006) — tidak ada integrasi channel komunikasi nyata.">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Entity</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>Sender</TableHead>
                  <TableHead>Pesan</TableHead>
                  <TableHead>Sent At</TableHead>
                  <TableHead>Delivery Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="row in messageRows" :key="row.item.id">
                  <TableCell class="text-muted-foreground">
                    {{ entityLabel(row.item.entityType, row.item.entityId) }}
                  </TableCell>
                  <TableCell class="text-muted-foreground">
                    {{ row.project?.name ?? '—' }}
                  </TableCell>
                  <TableCell><StatusBadge :label="findStatusOption(MESSAGE_CHANNELS, row.item.channel).label" :tone="findStatusOption(MESSAGE_CHANNELS, row.item.channel).tone" /></TableCell>
                  <TableCell class="text-muted-foreground">
                    {{ row.sender?.name ?? row.item.senderId }}
                  </TableCell>
                  <TableCell class="text-muted-foreground max-w-[280px] truncate">
                    {{ row.item.body }}
                  </TableCell>
                  <TableCell class="text-muted-foreground">
                    {{ formatDate(row.item.sentAt) }}
                  </TableCell>
                  <TableCell><StatusBadge :label="findStatusOption(MESSAGE_DELIVERY_STATUSES, row.item.deliveryStatus).label" :tone="findStatusOption(MESSAGE_DELIVERY_STATUSES, row.item.deliveryStatus).tone" /></TableCell>
                </TableRow>
                <TableEmpty v-if="messageRows.length === 0" :colspan="7">
                  {{ msgSearch || msgChannelFilter !== 'all' ? 'Tidak ada pesan yang cocok dengan filter.' : 'Belum ada pesan tercatat.' }}
                </TableEmpty>
              </TableBody>
            </Table>
          </SectionCard>
        </TabsContent>

        <TabsContent value="notifications">
          <SectionCard description="Notifikasi hanya untuk Anda (mengikuti bell popover TopHeader) — bukan daftar lintas user.">
            <ul v-if="notifications.length" class="divide-y divide-border">
              <li v-for="notification in notifications" :key="notification.id" :class="['py-3 flex items-start justify-between gap-3', !notification.read && 'bg-primary/5 -mx-4 px-4 rounded']">
                <div class="min-w-0 cursor-pointer" @click="markNotificationRead(notification.id)">
                  <div class="flex items-center gap-1.5 mb-1">
                    <StatusBadge :label="findStatusOption(NOTIFICATION_TYPES, notification.type).label" :tone="findStatusOption(NOTIFICATION_TYPES, notification.type).tone" />
                    <span v-if="!notification.read" class="w-1.5 h-1.5 bg-primary rounded-full" />
                  </div>
                  <p class="text-sm font-medium text-foreground">
                    {{ notification.title }}
                  </p>
                  <p class="text-sm text-muted-foreground">
                    {{ notification.body }}
                  </p>
                  <p class="text-xs text-muted-foreground mt-0.5">
                    {{ formatDate(notification.createdAt) }}
                  </p>
                </div>
                <button class="p-1 hover:bg-muted rounded shrink-0" @click="removeNotification(notification.id)">
                  <X class="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </li>
            </ul>
            <EmptyState v-else title="Tidak ada notifikasi" description="Notifikasi baru akan muncul di sini." />
          </SectionCard>
        </TabsContent>
      </Tabs>
    </template>
  </div>
</template>
