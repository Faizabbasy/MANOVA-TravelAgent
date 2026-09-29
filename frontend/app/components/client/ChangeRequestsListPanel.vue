<script setup lang="ts">
import { ref, computed } from 'vue'
import { Search, Plus, GitPullRequest } from 'lucide-vue-next'
import {
  getProjectsByParty, getChangeRequestsByParty, getChangeRequestDraftsByParty,
  saveChangeRequestDraft, deleteChangeRequestDraft, submitChangeRequestDraft
} from '~/data'
import { CHANGE_REQUEST_STATUSES, CHANGE_REQUEST_TYPES, findStatusOption } from '~/constants/status'
import { formatDate } from '~/utils/format'
import type { ChangeRequestStatus, ChangeRequestType, ChangeRequestDraft } from '~/types/change-incident'

/**
 * Tab "Change Requests" — Menu Client Portal > My Trips (Penyederhanaan 7-Role/Menu). Dulu
 * `/client/change-requests`, kini tab dalam satu menu bersama Projects/Participants/Itineraries/
 * Reservations/Trip Center — logika tidak diubah. Draft ("Save draft") DISIMPAN TERPISAH dari
 * `ChangeRequest` nyata (`ChangeRequestDraft`) — tidak pernah muncul di `/changes` internal sampai
 * disubmit lewat `submitChangeRequestDraft`.
 */

const { canView, clientScopeId } = usePermissions()
const { currentUser } = useCurrentUser()
const { showToast } = useToast()

const projects = computed(() => (clientScopeId.value ? getProjectsByParty(clientScopeId.value) : []))
const drafts = computed(() => (clientScopeId.value ? getChangeRequestDraftsByParty(clientScopeId.value) : []))
const requests = computed(() => (clientScopeId.value ? getChangeRequestsByParty(clientScopeId.value) : []))

function projectName (projectId: string): string {
  return projects.value.find(p => p.id === projectId)?.name ?? projectId
}

const search = ref('')
const statusFilter = ref<'all' | ChangeRequestStatus>('all')
const filteredRequests = computed(() => {
  let result = requests.value
  if (statusFilter.value !== 'all') { result = result.filter(item => item.status === statusFilter.value) }
  if (search.value.trim()) {
    const q = search.value.toLowerCase()
    result = result.filter(item => item.afterSummary.toLowerCase().includes(q) || item.beforeSummary.toLowerCase().includes(q) || projectName(item.projectId).toLowerCase().includes(q))
  }
  return result.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
})

/* --- Create/Edit draft dialog --- */
const isFormOpen = ref(false)
const editingDraft = ref<ChangeRequestDraft | null>(null)
const formProjectId = ref('')
const formChangeType = ref<ChangeRequestType | ''>('')
const formBeforeSummary = ref('')
const formAfterSummary = ref('')

function resetForm () {
  editingDraft.value = null
  formProjectId.value = projects.value[0]?.id ?? ''
  formChangeType.value = ''
  formBeforeSummary.value = ''
  formAfterSummary.value = ''
}

function openCreateForm () {
  resetForm()
  isFormOpen.value = true
}

function openEditDraft (draft: ChangeRequestDraft) {
  editingDraft.value = draft
  formProjectId.value = draft.projectId
  formChangeType.value = draft.changeType ?? ''
  formBeforeSummary.value = draft.beforeSummary
  formAfterSummary.value = draft.afterSummary
  isFormOpen.value = true
}

const isFormValid = computed(() => Boolean(formProjectId.value && formBeforeSummary.value.trim() && formAfterSummary.value.trim()))

function persistDraft (): ChangeRequestDraft | undefined {
  if (!isFormValid.value) { return undefined }
  return saveChangeRequestDraft({
    id: editingDraft.value?.id,
    projectId: formProjectId.value,
    createdBy: currentUser.value.id,
    changeType: formChangeType.value || undefined,
    beforeSummary: formBeforeSummary.value.trim(),
    afterSummary: formAfterSummary.value.trim()
  })
}

function handleSaveDraft () {
  const draft = persistDraft()
  if (!draft) { return }
  isFormOpen.value = false
  showToast('Draft Tersimpan', 'Permintaan perubahan Anda tersimpan sebagai draft.', 'success')
}

function handleSubmitNow () {
  const draft = persistDraft()
  if (!draft) { return }
  const request = submitChangeRequestDraft(draft.id)
  isFormOpen.value = false
  if (request) { showToast('Change Request Terkirim', `${request.id} — tim kami akan meninjau permintaan Anda.`, 'success') }
}

function handleDeleteDraft (draft: ChangeRequestDraft) {
  deleteChangeRequestDraft(draft.id)
  showToast('Draft Dihapus', 'Draft permintaan perubahan telah dihapus.', 'info')
}

function handleSubmitDraft (draft: ChangeRequestDraft) {
  const request = submitChangeRequestDraft(draft.id)
  if (request) { showToast('Change Request Terkirim', `${request.id} — tim kami akan meninjau permintaan Anda.`, 'success') }
}
</script>

<template>
  <div class="space-y-6">
    <div v-if="canView('client-portal')" class="flex justify-end">
      <Dialog v-model:open="isFormOpen">
        <DialogTrigger as-child>
          <Button size="sm" :disabled="projects.length === 0" @click="openCreateForm">
            <Plus class="h-4 w-4 mr-1.5" />Ajukan Perubahan
          </Button>
        </DialogTrigger>
        <DialogScrollContent class="max-w-lg">
          <DialogHeader>
            <DialogTitle>{{ editingDraft ? 'Edit Draft' : 'Ajukan Permintaan Perubahan' }}</DialogTitle>
            <DialogDescription>Simpan sebagai draft untuk dilanjutkan nanti, atau ajukan langsung ke tim kami.</DialogDescription>
          </DialogHeader>
          <div class="space-y-4 py-2">
            <div class="space-y-1.5">
              <Label for="cr-project">Project Order</Label>
              <select id="cr-project" v-model="formProjectId" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                <option v-for="project in projects" :key="project.id" :value="project.id">
                  {{ project.name }}
                </option>
              </select>
            </div>
            <div class="space-y-1.5">
              <Label for="cr-type">Jenis Perubahan</Label>
              <select id="cr-type" v-model="formChangeType" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                <option value="">
                  Lainnya
                </option>
                <option v-for="option in CHANGE_REQUEST_TYPES" :key="option.value" :value="option.value">
                  {{ option.label }}
                </option>
              </select>
            </div>
            <div class="space-y-1.5">
              <Label for="cr-before">Kondisi Saat Ini</Label>
              <textarea id="cr-before" v-model="formBeforeSummary" rows="2" class="w-full px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring" placeholder="mis. 45 peserta, hotel Deluxe Room Block A" />
            </div>
            <div class="space-y-1.5">
              <Label for="cr-after">Perubahan yang Diminta</Label>
              <textarea id="cr-after" v-model="formAfterSummary" rows="2" class="w-full px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring" placeholder="mis. Tambah 5 peserta menjadi 50 peserta" />
            </div>
          </div>
          <DialogFooter class="flex-col sm:flex-row gap-2">
            <Button variant="outline" @click="isFormOpen = false">
              Batal
            </Button>
            <Button variant="secondary" :disabled="!isFormValid" @click="handleSaveDraft">
              Simpan sebagai Draft
            </Button>
            <Button :disabled="!isFormValid" @click="handleSubmitNow">
              Ajukan Sekarang
            </Button>
          </DialogFooter>
        </DialogScrollContent>
      </Dialog>
    </div>

    <RoleAccessState v-if="!canView('client-portal')" module-label="Client Portal" />

    <template v-else>
      <SectionCard v-if="drafts.length" title="Draft">
        <ul class="divide-y divide-border">
          <li v-for="draft in drafts" :key="draft.id" class="py-3 flex items-center justify-between gap-3 flex-wrap">
            <div class="min-w-0">
              <p class="text-sm font-medium text-foreground truncate">
                {{ projectName(draft.projectId) }} — {{ draft.afterSummary || 'Belum diisi' }}
              </p>
              <p class="text-xs text-muted-foreground">
                Diperbarui {{ formatDate(draft.updatedAt) }}
              </p>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <Button size="sm" variant="outline" @click="openEditDraft(draft)">
                Edit
              </Button>
              <Button size="sm" @click="handleSubmitDraft(draft)">
                Ajukan
              </Button>
              <Button size="sm" variant="ghost" @click="handleDeleteDraft(draft)">
                Hapus
              </Button>
            </div>
          </li>
        </ul>
      </SectionCard>

      <SectionCard>
        <div class="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
          <div class="relative flex-1 max-w-sm w-full">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input v-model="search" placeholder="Cari perubahan atau project..." class="pl-9" />
          </div>
          <select v-model="statusFilter" class="appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
            <option value="all">
              Semua Status
            </option>
            <option v-for="option in CHANGE_REQUEST_STATUSES" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </div>

        <ul v-if="filteredRequests.length" class="divide-y divide-border">
          <li v-for="item in filteredRequests" :key="item.id">
            <NuxtLink :to="`/client/change-requests/${item.id}`" class="py-3 flex items-center justify-between gap-3 group block">
              <div class="min-w-0">
                <p class="text-sm font-medium text-foreground truncate group-hover:underline">
                  {{ projectName(item.projectId) }} — {{ item.afterSummary }}
                </p>
                <p class="text-xs text-muted-foreground truncate">
                  {{ item.id }} · Diajukan {{ formatDate(item.submittedAt) }}
                </p>
              </div>
              <StatusBadge :label="findStatusOption(CHANGE_REQUEST_STATUSES, item.status).label" :tone="findStatusOption(CHANGE_REQUEST_STATUSES, item.status).tone" />
            </NuxtLink>
          </li>
        </ul>
        <EmptyState v-else :icon="GitPullRequest" :title="requests.length ? 'Tidak ada Change Request yang cocok' : 'Belum ada Change Request'" :description="requests.length ? 'Coba ubah kata kunci pencarian atau filter status.' : 'Ajukan permintaan perubahan lewat tombol di atas.'" />
      </SectionCard>
    </template>
  </div>
</template>
