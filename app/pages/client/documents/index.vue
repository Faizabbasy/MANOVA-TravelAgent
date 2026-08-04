<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import { Search, Plus, FileText, ExternalLink } from 'lucide-vue-next'
import {
  getProjectsByParty, getClientDocuments, getClientDocumentCategory,
  createClientDocument, replaceClientDocument, getDocumentVersionHistory,
  getDocumentComments, addDocumentComment, getUserById
} from '~/data'
import { CLIENT_DOCUMENT_CATEGORIES, DOCUMENT_ENTITY_TYPES, findStatusOption } from '~/constants/status'
import { formatDate } from '~/utils/format'
import { isDocumentExpired, isDocumentExpiringSoon } from '~/utils/attention'
import type { Document, ClientDocumentCategory } from '~/types/document-comms'

/**
 * Documents — Client-facing (Repair Phase Section 5 — Execution & Changes, Master Prompt bagian C). Reuse
 * penuh `Document`/`DOCUMENT_RECORDS` (Section 21) via `getClientDocuments` (filter `accessLevel: 'client'`
 * + company scope) — TIDAK ADA dataset dokumen paralel.
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Documents' })

const route = useRoute()
const { canView, clientScopeId } = usePermissions()
const { currentUser } = useCurrentUser()
const { showToast } = useToast()

const projects = computed(() => (clientScopeId.value ? getProjectsByParty(clientScopeId.value) : []))
const documents = computed(() => (clientScopeId.value ? getClientDocuments(clientScopeId.value) : []))

function projectName (projectId?: string): string {
  return projects.value.find(p => p.id === projectId)?.name ?? '—'
}

const search = ref('')
const categoryFilter = ref<'all' | ClientDocumentCategory>('all')
/** Preset dari deep link `?project=` (tab Documents Project Workspace, `docs/client-page-inventory.md` #12). */
const projectFilter = ref((route.query.project as string) || 'all')

const rows = computed(() => {
  let result = documents.value
  if (categoryFilter.value !== 'all') { result = result.filter(doc => getClientDocumentCategory(doc) === categoryFilter.value) }
  if (projectFilter.value !== 'all') { result = result.filter(doc => doc.projectId === projectFilter.value) }
  if (search.value.trim()) {
    const q = search.value.toLowerCase()
    result = result.filter(doc => doc.name.toLowerCase().includes(q) || projectName(doc.projectId).toLowerCase().includes(q))
  }
  return result
})

/* --- Upload --- */
const isUploadOpen = ref(false)
const uploadProjectId = ref('')
const uploadName = ref('')
const uploadCategory = ref<ClientDocumentCategory>('travel')
const uploadExpiresAt = ref('')

function resetUploadForm () {
  uploadProjectId.value = projects.value[0]?.id ?? ''
  uploadName.value = ''
  uploadCategory.value = 'travel'
  uploadExpiresAt.value = ''
}
function openUpload () {
  resetUploadForm()
  isUploadOpen.value = true
}
function submitUpload () {
  if (!uploadProjectId.value || !uploadName.value.trim()) { return }
  const document = createClientDocument({
    projectId: uploadProjectId.value,
    name: uploadName.value.trim(),
    category: uploadCategory.value,
    uploadedBy: currentUser.value.id,
    expiresAt: uploadExpiresAt.value || undefined
  })
  isUploadOpen.value = false
  showToast('Dokumen Diunggah', `${document.name} tersimpan sebagai versi ${document.version} (mock, bukan file upload nyata).`, 'success')
}

/* --- Detail (version history + comment + replace) --- */
const isDetailOpen = ref(false)
const activeDocument = ref<Document | null>(null)
const newComment = ref('')

function openDetail (document: Document) {
  activeDocument.value = document
  newComment.value = ''
  isDetailOpen.value = true
}
const versionHistory = computed(() => (activeDocument.value ? getDocumentVersionHistory(activeDocument.value.id) : []))
const activeComments = computed(() => (activeDocument.value ? getDocumentComments(activeDocument.value.id) : []))

function handleReplaceVersion () {
  if (!activeDocument.value) { return }
  const next = replaceClientDocument(activeDocument.value.id, currentUser.value.id)
  if (next) {
    activeDocument.value = next
    showToast('Versi Baru Diunggah', `Versi ${next.version} tercatat menggantikan versi sebelumnya (mock).`, 'success')
  }
}
function submitComment () {
  if (!activeDocument.value || !newComment.value.trim()) { return }
  addDocumentComment(activeDocument.value.id, currentUser.value.id, newComment.value.trim())
  newComment.value = ''
  showToast('Komentar Ditambahkan', 'Komentar Anda berhasil disimpan.', 'success')
}

function handleDownload (document: Document) {
  showToast('Download (Mock)', `${document.name} — simulasi unduhan, tidak ada file nyata (D-006).`, 'info')
}
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Documents"
      description="Pusat dokumen lintas seluruh Project Order Anda — pencarian, kategori, versi, preview, dan unggah."
      :breadcrumb="[{ label: 'Client Portal', to: '/client' }, { label: 'Collaboration' }, { label: 'Documents' }]"
    >
      <template #actions>
        <Dialog v-model:open="isUploadOpen">
          <DialogTrigger as-child>
            <Button size="sm" :disabled="projects.length === 0" @click="openUpload">
              <Plus class="h-4 w-4 mr-1.5" />Upload Document
            </Button>
          </DialogTrigger>
          <DialogScrollContent class="max-w-lg">
            <DialogHeader>
              <DialogTitle>Upload Document Baru</DialogTitle>
              <DialogDescription>Mock upload — tidak ada file storage nyata, hanya metadata tercatat (D-006).</DialogDescription>
            </DialogHeader>
            <div class="space-y-4 py-2">
              <div class="space-y-1.5">
                <Label for="doc-project">Project Order</Label>
                <select id="doc-project" v-model="uploadProjectId" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                  <option v-for="project in projects" :key="project.id" :value="project.id">
                    {{ project.name }}
                  </option>
                </select>
              </div>
              <div class="space-y-1.5">
                <Label for="doc-name">Nama Dokumen</Label>
                <Input id="doc-name" v-model="uploadName" placeholder="mis. Scan_Paspor_Peserta.pdf" />
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div class="space-y-1.5">
                  <Label for="doc-category">Kategori</Label>
                  <select id="doc-category" v-model="uploadCategory" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                    <option v-for="option in CLIENT_DOCUMENT_CATEGORIES" :key="option.value" :value="option.value">
                      {{ option.label }}
                    </option>
                  </select>
                </div>
                <div class="space-y-1.5">
                  <Label for="doc-expiry">Expiry Date (opsional)</Label>
                  <Input id="doc-expiry" v-model="uploadExpiresAt" type="date" />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" @click="isUploadOpen = false">
                Batal
              </Button>
              <Button :disabled="!uploadProjectId || !uploadName.trim()" @click="submitUpload">
                Simpan
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
            <Input v-model="search" placeholder="Cari nama dokumen atau project..." class="pl-9" />
          </div>
          <select v-model="categoryFilter" class="appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
            <option value="all">
              Semua Kategori
            </option>
            <option v-for="option in CLIENT_DOCUMENT_CATEGORIES" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
          <select v-model="projectFilter" class="appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
            <option value="all">
              Semua Project
            </option>
            <option v-for="project in projects" :key="project.id" :value="project.id">
              {{ project.name }}
            </option>
          </select>
        </div>

        <div class="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Document</TableHead>
                <TableHead>Related Entity</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Verification</TableHead>
                <TableHead>Expiry</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="doc in rows" :key="doc.id">
                <TableCell class="font-medium text-foreground max-w-[220px] truncate">
                  {{ doc.name }}
                </TableCell>
                <TableCell class="text-muted-foreground">
                  {{ findStatusOption(DOCUMENT_ENTITY_TYPES, doc.entityType).label }} · {{ doc.entityId }}
                </TableCell>
                <TableCell class="text-muted-foreground">
                  {{ projectName(doc.projectId) }}
                </TableCell>
                <TableCell><StatusBadge :label="findStatusOption(CLIENT_DOCUMENT_CATEGORIES, getClientDocumentCategory(doc)).label" :tone="findStatusOption(CLIENT_DOCUMENT_CATEGORIES, getClientDocumentCategory(doc)).tone" /></TableCell>
                <TableCell class="text-muted-foreground">
                  v{{ doc.version }}
                </TableCell>
                <TableCell>
                  <StatusBadge v-if="doc.verified" label="Terverifikasi" tone="success" />
                  <span v-else class="text-xs text-muted-foreground">Belum diverifikasi</span>
                </TableCell>
                <TableCell>
                  <template v-if="doc.expiresAt">
                    <StatusBadge
                      :label="isDocumentExpired(doc.expiresAt) ? `Expired ${formatDate(doc.expiresAt)}` : isDocumentExpiringSoon(doc.expiresAt) ? `Segera: ${formatDate(doc.expiresAt)}` : formatDate(doc.expiresAt)"
                      :tone="isDocumentExpired(doc.expiresAt) ? 'destructive' : isDocumentExpiringSoon(doc.expiresAt) ? 'warning' : 'neutral'"
                    />
                  </template>
                  <span v-else class="text-xs text-muted-foreground">Tidak ada</span>
                </TableCell>
                <TableCell>
                  <div class="flex items-center gap-2">
                    <NuxtLink v-if="doc.sourceType === 'generated' && doc.previewRoute" :to="doc.previewRoute" target="_blank" class="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                      Preview <ExternalLink class="h-3 w-3" />
                    </NuxtLink>
                    <button v-else class="text-xs text-primary hover:underline" @click="handleDownload(doc)">
                      Download
                    </button>
                    <button class="text-xs text-muted-foreground hover:underline" @click="openDetail(doc)">
                      Detail
                    </button>
                  </div>
                </TableCell>
              </TableRow>
              <TableEmpty v-if="rows.length === 0" :colspan="8">
                <EmptyState :icon="FileText" :title="documents.length ? 'Tidak ada dokumen yang cocok' : 'Belum ada dokumen'" :description="documents.length ? 'Coba ubah kata kunci pencarian atau filter.' : 'Dokumen akan tampil di sini setelah tim kami membagikannya atau Anda mengunggah.'" />
              </TableEmpty>
            </TableBody>
          </Table>
        </div>
      </SectionCard>

      <Dialog v-model:open="isDetailOpen">
        <DialogScrollContent class="max-w-lg">
          <DialogHeader>
            <DialogTitle>{{ activeDocument?.name }}</DialogTitle>
            <DialogDescription>Version history, komentar, dan replace version.</DialogDescription>
          </DialogHeader>
          <div v-if="activeDocument" class="space-y-4 py-2">
            <div>
              <p class="text-xs font-medium text-muted-foreground mb-2">
                Version History
              </p>
              <ul class="divide-y divide-border">
                <li v-for="version in versionHistory" :key="version.id" class="py-1.5 flex items-center justify-between text-sm">
                  <span class="text-foreground">v{{ version.version }}</span>
                  <span class="text-xs text-muted-foreground">{{ formatDate(version.uploadedAt ?? version.generatedAt ?? '') }}</span>
                </li>
              </ul>
              <Button v-if="activeDocument.sourceType === 'uploaded'" size="sm" variant="outline" class="mt-2" @click="handleReplaceVersion">
                Replace Version
              </Button>
            </div>
            <div class="pt-3 border-t border-border">
              <p class="text-xs font-medium text-muted-foreground mb-2">
                Comments
              </p>
              <ul v-if="activeComments.length" class="space-y-2 mb-2">
                <li v-for="comment in activeComments" :key="comment.id" class="text-sm">
                  <p class="text-foreground">
                    {{ comment.body }}
                  </p>
                  <p class="text-xs text-muted-foreground">
                    {{ getUserById(comment.authorId)?.name ?? comment.authorId }} · {{ formatDate(comment.createdAt) }}
                  </p>
                </li>
              </ul>
              <p v-else class="text-sm text-muted-foreground mb-2">
                Belum ada komentar.
              </p>
              <div class="flex gap-2">
                <Input v-model="newComment" placeholder="Tulis komentar..." class="flex-1" @keyup.enter="submitComment" />
                <Button size="sm" :disabled="!newComment.trim()" @click="submitComment">
                  Kirim
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" @click="isDetailOpen = false">
              Tutup
            </Button>
          </DialogFooter>
        </DialogScrollContent>
      </Dialog>
    </template>
  </div>
</template>
