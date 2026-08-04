<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { FileX, Printer, LayoutList, Table2 } from 'lucide-vue-next'
import {
  getProjectById, getUserById, getClientVisibleItineraryItems,
  getItineraryVersionsByProject, getLatestItineraryVersion,
  getItineraryComments, addItineraryComment, requestItineraryRevision, approveItineraryVersion
} from '~/data'
import { ITINERARY_VERSION_STATUSES, findStatusOption } from '~/constants/status'
import { formatDayLabel, formatDate, formatDateTime } from '~/utils/format'

/**
 * Itineraries — Detail (Repair Phase Section 4 — Core Project, `:id` = Project id). "Setiap revision
 * menghasilkan versi baru" — `requestItineraryRevision` (LOCKED aturan di data layer) tidak pernah
 * menimpa versi lama, hanya menambah baris baru. Isolasi: project harus milik `clientScopeId`.
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const route = useRoute()
const router = useRouter()
const { canView, clientScopeId } = usePermissions()
const { currentUser } = useCurrentUser()
const { showToast } = useToast()

const project = computed(() => getProjectById(String(route.params.id)))
const isOwnCompany = computed(() => Boolean(project.value && clientScopeId.value && project.value.partyId === clientScopeId.value))
useHead({ title: computed(() => project.value ? `Itinerary — ${project.value.name}` : 'Tidak Ditemukan') })

const versions = computed(() => (project.value ? getItineraryVersionsByProject(project.value.id) : []))
const latestVersion = computed(() => (project.value ? getLatestItineraryVersion(project.value.id) : undefined))
const displayItems = computed(() => latestVersion.value?.items ?? (project.value ? getClientVisibleItineraryItems(project.value.id) : []))

const viewMode = ref<'daily' | 'table'>('daily')
const groupedByDate = computed(() => {
  const groups = new Map<string, typeof displayItems.value>()
  for (const item of displayItems.value) {
    const list = groups.get(item.date) ?? []
    list.push(item)
    groups.set(item.date, list)
  }
  return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]))
})

const canDecide = computed(() => Boolean(latestVersion.value && ['waiting-approval', 'under-review'].includes(latestVersion.value.status)))

/* --- Compare versions --- */
const compareLeftId = ref('')
const compareRightId = ref('')
const compareLeft = computed(() => versions.value.find(v => v.id === compareLeftId.value))
const compareRight = computed(() => versions.value.find(v => v.id === compareRightId.value))

/* --- Comment --- */
const commentBody = ref('')
const comments = computed(() => (project.value ? getItineraryComments(project.value.id).map(item => ({ ...item, authorName: getUserById(item.authorId)?.name ?? item.authorId })) : []))
function submitComment () {
  if (!project.value || !commentBody.value.trim()) { return }
  addItineraryComment(project.value.id, currentUser.value.id, commentBody.value.trim())
  commentBody.value = ''
  showToast('Komentar Ditambahkan', 'Komentar Anda berhasil disimpan.', 'success')
}

/* --- Approve --- */
function submitApprove () {
  if (!latestVersion.value) { return }
  const result = approveItineraryVersion(latestVersion.value.id, currentUser.value.id)
  if (result) { showToast('Itinerary Disetujui', `Versi ${result.versionNumber} telah Anda setujui.`, 'success') }
}

/* --- Request revision --- */
const isRevisionDialogOpen = ref(false)
const revisionComment = ref('')
function submitRevisionRequest () {
  if (!project.value || !revisionComment.value.trim()) { return }
  const result = requestItineraryRevision(project.value.id, currentUser.value.id, revisionComment.value.trim())
  revisionComment.value = ''
  isRevisionDialogOpen.value = false
  if (result) { showToast('Revisi Diajukan', `Versi ${result.versionNumber} disiapkan menunggu approval.`, 'success') }
}
</script>

<template>
  <div class="space-y-6">
    <template v-if="!project || !isOwnCompany">
      <PageHeader title="Tidak Ditemukan" :breadcrumb="[{ label: 'Client Portal', to: '/client' }, { label: 'Tidak Ditemukan' }]" />
      <SectionCard>
        <EmptyState :icon="FileX" title="Itinerary tidak ditemukan" description="Project ini tidak ada atau bukan milik company Anda.">
          <Button @click="router.push('/client/itineraries')">
            Kembali ke Itineraries
          </Button>
        </EmptyState>
      </SectionCard>
    </template>

    <RoleAccessState v-else-if="!canView('client-portal')" module-label="Client Portal" />

    <template v-else>
      <PageHeader
        :title="`Itinerary — ${project.name}`"
        :breadcrumb="[{ label: 'Client Portal', to: '/client' }, { label: 'Travel Management' }, { label: 'Itineraries', to: '/client/itineraries' }, { label: project.name }]"
      >
        <template #actions>
          <StatusBadge v-if="latestVersion" :label="findStatusOption(ITINERARY_VERSION_STATUSES, latestVersion.status).label" :tone="findStatusOption(ITINERARY_VERSION_STATUSES, latestVersion.status).tone" />
          <NuxtLink :to="`/client/itineraries/${project.id}/preview`" target="_blank">
            <Button size="sm" variant="outline">
              <Printer class="h-4 w-4 mr-1.5" />Download Mock PDF
            </Button>
          </NuxtLink>
        </template>
      </PageHeader>

      <SectionCard>
        <template #actions>
          <div class="flex items-center gap-1 rounded-lg border border-border p-0.5">
            <button type="button" class="p-1.5 rounded" :class="viewMode === 'daily' ? 'bg-primary/10 text-primary' : 'text-muted-foreground'" title="Daily timeline" @click="viewMode = 'daily'">
              <LayoutList class="h-4 w-4" />
            </button>
            <button type="button" class="p-1.5 rounded" :class="viewMode === 'table' ? 'bg-primary/10 text-primary' : 'text-muted-foreground'" title="Table view" @click="viewMode = 'table'">
              <Table2 class="h-4 w-4" />
            </button>
          </div>
        </template>

        <template v-if="displayItems.length === 0">
          <EmptyState title="Itinerary belum tersedia" description="Itinerary akan tampil di sini setelah tim kami menyusunnya." />
        </template>
        <template v-else-if="viewMode === 'daily'">
          <div v-for="[date, items] in groupedByDate" :key="date" class="mb-4 last:mb-0">
            <p class="text-xs font-medium text-muted-foreground mb-2">
              {{ formatDayLabel(date) }}
            </p>
            <ul class="divide-y divide-border">
              <li v-for="item in items" :key="item.id" class="py-2">
                <p class="text-sm font-medium text-foreground">
                  {{ item.time ? `${item.time} — ` : '' }}{{ item.title }}
                </p>
                <p v-if="item.description" class="text-xs text-muted-foreground">
                  {{ item.description }}
                </p>
              </li>
            </ul>
          </div>
        </template>
        <template v-else>
          <div class="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Waktu</TableHead>
                  <TableHead>Kegiatan</TableHead>
                  <TableHead>Deskripsi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="item in displayItems" :key="item.id">
                  <TableCell class="text-muted-foreground">
                    {{ formatDate(item.date) }}
                  </TableCell>
                  <TableCell class="text-muted-foreground">
                    {{ item.time || '—' }}
                  </TableCell>
                  <TableCell class="font-medium text-foreground">
                    {{ item.title }}
                  </TableCell>
                  <TableCell class="text-muted-foreground">
                    {{ item.description || '—' }}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </template>

        <div v-if="canDecide" class="mt-4 pt-4 border-t border-border flex flex-wrap gap-2">
          <Button @click="submitApprove">
            Approve
          </Button>
          <Dialog v-model:open="isRevisionDialogOpen">
            <DialogTrigger as-child>
              <Button variant="outline">
                Request Revision
              </Button>
            </DialogTrigger>
            <DialogContent class="max-w-md">
              <DialogHeader>
                <DialogTitle>Request Revision</DialogTitle>
                <DialogDescription>Jelaskan perubahan yang Anda butuhkan — versi baru akan disiapkan menunggu approval Anda kembali.</DialogDescription>
              </DialogHeader>
              <div class="space-y-1.5 py-2">
                <Label for="itin-revision-comment">Detail Revisi</Label>
                <textarea id="itin-revision-comment" v-model="revisionComment" rows="3" class="w-full px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <DialogFooter>
                <Button variant="outline" @click="isRevisionDialogOpen = false">
                  Batal
                </Button>
                <Button :disabled="!revisionComment.trim()" @click="submitRevisionRequest">
                  Kirim
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </SectionCard>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard title="Version History">
          <ul v-if="versions.length" class="divide-y divide-border">
            <li v-for="version in versions" :key="version.id" class="py-2 flex items-center justify-between gap-2">
              <span class="text-sm text-foreground">Versi {{ version.versionNumber }}</span>
              <StatusBadge :label="findStatusOption(ITINERARY_VERSION_STATUSES, version.status).label" :tone="findStatusOption(ITINERARY_VERSION_STATUSES, version.status).tone" />
            </li>
          </ul>
          <EmptyState v-else title="Belum ada versi" />

          <template v-if="versions.length > 1">
            <div class="mt-4 pt-4 border-t border-border">
              <p class="text-xs font-medium text-muted-foreground mb-2">
                Compare Versions
              </p>
              <div class="grid grid-cols-2 gap-2 mb-3">
                <select v-model="compareLeftId" class="appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                  <option value="">
                    Versi A
                  </option>
                  <option v-for="version in versions" :key="version.id" :value="version.id">
                    Versi {{ version.versionNumber }}
                  </option>
                </select>
                <select v-model="compareRightId" class="appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                  <option value="">
                    Versi B
                  </option>
                  <option v-for="version in versions" :key="version.id" :value="version.id">
                    Versi {{ version.versionNumber }}
                  </option>
                </select>
              </div>
              <div v-if="compareLeft && compareRight" class="grid grid-cols-2 gap-3 text-xs">
                <div class="rounded-lg border border-border p-2 space-y-1">
                  <p v-for="item in compareLeft.items" :key="item.id" class="text-foreground">
                    {{ formatDate(item.date) }} — {{ item.title }}
                  </p>
                </div>
                <div class="rounded-lg border border-border p-2 space-y-1">
                  <p v-for="item in compareRight.items" :key="item.id" class="text-foreground">
                    {{ formatDate(item.date) }} — {{ item.title }}
                  </p>
                </div>
              </div>
            </div>
          </template>
        </SectionCard>

        <SectionCard title="Comments">
          <div class="flex gap-2 mb-3">
            <Input v-model="commentBody" placeholder="Tulis komentar..." @keyup.enter="submitComment" />
            <Button size="sm" variant="outline" :disabled="!commentBody.trim()" @click="submitComment">
              Kirim
            </Button>
          </div>
          <ul v-if="comments.length" class="space-y-3">
            <li v-for="comment in comments" :key="comment.id" class="text-sm">
              <p class="text-foreground">
                {{ comment.body }}
              </p>
              <p class="text-xs text-muted-foreground mt-0.5">
                {{ comment.authorName }} · {{ formatDateTime(comment.createdAt) }}
              </p>
            </li>
          </ul>
          <EmptyState v-else title="Belum ada komentar" />
        </SectionCard>
      </div>
    </template>
  </div>
</template>
