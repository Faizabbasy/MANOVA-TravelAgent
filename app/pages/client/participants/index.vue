<script setup lang="ts">
import { ref, computed } from 'vue'
import { Search, Plus, Users, Star, Upload, Download, AlertTriangle } from 'lucide-vue-next'
import {
  getProjectsByParty, getTravelers, createTraveler, previewTravelerImportMock, commitTravelerImport,
  setTravelerVip, cancelTraveler
} from '~/data'
import { isTravelerDocumentMissing, DEMO_REFERENCE_DATE } from '~/utils/attention'
import { daysUntil } from '~/utils/format'
import type { TravelerImportPreviewRow } from '~/data'

/**
 * Participants — List (Repair Phase Section 4 — Core Project). Agregasi lintas seluruh Project Order
 * company (`docs/client-page-inventory.md` #7 rekomendasi), REUSE penuh `getTravelers`/`createTraveler`
 * (Section 11, LOCKED) — TIDAK ada dataset traveler paralel. Edit detail lengkap tetap di
 * `/client/participants/[id]` dan tab Participants `/client/project-orders/[id]`.
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Participants' })

const { canView, clientScopeId } = usePermissions()
const { showToast } = useToast()

const projects = computed(() => (clientScopeId.value ? getProjectsByParty(clientScopeId.value) : []))

const rows = computed(() => projects.value.flatMap(project => getTravelers(project.id).map(traveler => ({ traveler, project }))))

const search = ref('')
const projectFilter = ref('all')
const incompleteOnly = ref(false)
const selectedIds = ref<string[]>([])

const filteredRows = computed(() => {
  let result = rows.value
  if (projectFilter.value !== 'all') { result = result.filter(row => row.project.id === projectFilter.value) }
  if (incompleteOnly.value) { result = result.filter(row => isTravelerDocumentMissing(row.traveler, row.project.travelStartDate)) }
  if (search.value.trim()) {
    const q = search.value.toLowerCase()
    result = result.filter(row => row.traveler.name.toLowerCase().includes(q))
  }
  return result
})

function isPassportExpiringSoon (passportExpiryDate?: string): boolean {
  if (!passportExpiryDate) { return false }
  const days = daysUntil(passportExpiryDate, DEMO_REFERENCE_DATE)
  return days >= 0 && days <= 180
}

function participantStatusLabel (row: { traveler: typeof rows.value[number]['traveler']; project: typeof rows.value[number]['project'] }): { label: string; tone: 'success' | 'warning' | 'destructive' | 'neutral' } {
  if (row.traveler.cancelled) { return { label: 'Cancelled', tone: 'neutral' } }
  if (row.traveler.replacesTravelerId) { return { label: 'Replacement', tone: 'warning' } }
  if (row.traveler.documentsVerifiedAt) { return { label: 'Verified', tone: 'success' } }
  if (!isTravelerDocumentMissing(row.traveler, row.project.travelStartDate)) { return { label: 'Submitted', tone: 'warning' } }
  return { label: 'Incomplete', tone: 'destructive' }
}

function toggleSelect (id: string) {
  const index = selectedIds.value.indexOf(id)
  if (index === -1) { selectedIds.value.push(id) } else { selectedIds.value.splice(index, 1) }
}

/* --- Add participant (perlu pilih project) --- */
const isAddDialogOpen = ref(false)
const addProjectId = ref('')
const addName = ref('')
function submitAdd () {
  if (!addProjectId.value || !addName.value.trim()) { return }
  createTraveler({ projectId: addProjectId.value, name: addName.value.trim() })
  addName.value = ''
  isAddDialogOpen.value = false
  showToast('Peserta Ditambahkan', `${addName.value || 'Peserta baru'} berhasil ditambahkan.`, 'success')
}

/* --- Bulk actions --- */
function bulkMarkVip () {
  for (const id of selectedIds.value) { setTravelerVip(id, true) }
  showToast('Ditandai VIP', `${selectedIds.value.length} peserta ditandai VIP.`, 'success')
  selectedIds.value = []
}
const isBulkCancelDialogOpen = ref(false)
const bulkCancelReason = ref('')
function submitBulkCancel () {
  if (!bulkCancelReason.value.trim()) { return }
  let count = 0
  for (const id of selectedIds.value) { if (cancelTraveler(id, bulkCancelReason.value.trim())) { count++ } }
  showToast('Peserta Dibatalkan', `${count} peserta dibatalkan.`, 'info')
  bulkCancelReason.value = ''
  isBulkCancelDialogOpen.value = false
  selectedIds.value = []
}

/* --- Bulk import simulation (Wajib) --- */
const isImportDialogOpen = ref(false)
const importProjectId = ref('')
const importPreviewRows = ref<TravelerImportPreviewRow[]>([])
function generateImportPreview () {
  if (!importProjectId.value) { return }
  importPreviewRows.value = previewTravelerImportMock(importProjectId.value, 5)
}
function submitImport () {
  if (!importProjectId.value || importPreviewRows.value.length === 0) { return }
  const created = commitTravelerImport(importProjectId.value, importPreviewRows.value)
  showToast('Import Selesai (Mock)', `${created.length} dari ${importPreviewRows.value.length} baris berhasil diimpor.`, created.length === importPreviewRows.value.length ? 'success' : 'warning')
  importPreviewRows.value = []
  importProjectId.value = ''
  isImportDialogOpen.value = false
}

/* --- Export simulation (Wajib, mock — tidak ada file nyata dihasilkan, pola sama /reports) --- */
const isExportDialogOpen = ref(false)
const exportFormat = ref<'csv' | 'pdf'>('csv')
function submitExport () {
  const filename = `participants-${DEMO_REFERENCE_DATE}.${exportFormat.value}`
  showToast('Export Disiapkan', `${filename} (mock, tidak ada file yang benar-benar dihasilkan).`, 'success')
  isExportDialogOpen.value = false
}
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Participants"
      description="Peserta lintas seluruh Project Order company Anda."
      :breadcrumb="[{ label: 'Client Portal', to: '/client' }, { label: 'Travel Management' }, { label: 'Participants' }]"
    >
      <template #actions>
        <Button size="sm" variant="outline" @click="isImportDialogOpen = true">
          <Upload class="h-4 w-4 mr-1.5" />Import
        </Button>
        <Button size="sm" variant="outline" @click="isExportDialogOpen = true">
          <Download class="h-4 w-4 mr-1.5" />Export
        </Button>
        <Button size="sm" :disabled="projects.length === 0" @click="isAddDialogOpen = true">
          <Plus class="h-4 w-4 mr-1.5" />Tambah Peserta
        </Button>
      </template>
    </PageHeader>

    <RoleAccessState v-if="!canView('client-portal')" module-label="Client Portal" />

    <template v-else>
      <SectionCard>
        <div class="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4 flex-wrap">
          <div class="relative flex-1 max-w-sm w-full">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input v-model="search" placeholder="Cari nama peserta..." class="pl-9" />
          </div>
          <select v-model="projectFilter" class="appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
            <option value="all">
              Semua Project
            </option>
            <option v-for="project in projects" :key="project.id" :value="project.id">
              {{ project.name }}
            </option>
          </select>
          <label class="flex items-center gap-2 text-sm text-foreground cursor-pointer shrink-0">
            <Checkbox v-model="incompleteOnly" />Hanya belum lengkap
          </label>
        </div>

        <div v-if="selectedIds.length" class="flex items-center gap-2 mb-4 p-3 rounded-lg bg-primary/5 border border-primary/20">
          <span class="text-sm text-foreground">{{ selectedIds.length }} dipilih</span>
          <Button size="sm" variant="outline" @click="bulkMarkVip">
            <Star class="h-4 w-4 mr-1.5" />Mark VIP
          </Button>
          <Button size="sm" variant="destructive" @click="isBulkCancelDialogOpen = true">
            Cancel Terpilih
          </Button>
        </div>

        <div class="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead />
                <TableHead>Nama</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Paspor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="row in filteredRows" :key="row.traveler.id">
                <TableCell>
                  <Checkbox :model-value="selectedIds.includes(row.traveler.id)" @update:model-value="toggleSelect(row.traveler.id)" />
                </TableCell>
                <TableCell class="font-medium text-foreground">
                  <NuxtLink :to="`/client/participants/${row.traveler.id}`" class="hover:underline">
                    {{ row.traveler.name }}
                  </NuxtLink>
                  <Star v-if="row.traveler.isVip" class="h-3.5 w-3.5 inline ml-1.5 text-warning fill-warning" />
                </TableCell>
                <TableCell class="text-muted-foreground">
                  {{ row.project.name }}
                </TableCell>
                <TableCell class="text-muted-foreground">
                  {{ row.traveler.passportNumber || '—' }}
                  <AlertTriangle v-if="isPassportExpiringSoon(row.traveler.passportExpiryDate)" class="h-3.5 w-3.5 inline ml-1 text-warning" />
                </TableCell>
                <TableCell>
                  <StatusBadge :label="participantStatusLabel(row).label" :tone="participantStatusLabel(row).tone" />
                </TableCell>
                <TableCell>
                  <NuxtLink :to="`/client/participants/${row.traveler.id}`">
                    <Button size="sm" variant="ghost">
                      Detail
                    </Button>
                  </NuxtLink>
                </TableCell>
              </TableRow>
              <TableEmpty v-if="filteredRows.length === 0" :colspan="6">
                <EmptyState :icon="Users" :title="rows.length ? 'Tidak ada peserta yang cocok' : 'Belum ada peserta'" :description="rows.length ? 'Coba ubah kata kunci pencarian atau filter.' : 'Tambahkan peserta ke Project Order Anda.'" />
              </TableEmpty>
            </TableBody>
          </Table>
        </div>
      </SectionCard>
    </template>

    <!-- Add Dialog -->
    <Dialog v-model:open="isAddDialogOpen">
      <DialogContent class="max-w-md">
        <DialogHeader>
          <DialogTitle>Tambah Peserta</DialogTitle>
          <DialogDescription>Pilih Project Order dan nama peserta. Lengkapi detail lainnya dari halaman Detail setelah tersimpan.</DialogDescription>
        </DialogHeader>
        <div class="space-y-4 py-2">
          <div class="space-y-1.5">
            <Label for="add-project">Project Order</Label>
            <select id="add-project" v-model="addProjectId" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
              <option value="">
                Pilih project...
              </option>
              <option v-for="project in projects" :key="project.id" :value="project.id">
                {{ project.name }}
              </option>
            </select>
          </div>
          <div class="space-y-1.5">
            <Label for="add-name">Nama Lengkap</Label>
            <Input id="add-name" v-model="addName" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="isAddDialogOpen = false">
            Batal
          </Button>
          <Button :disabled="!addProjectId || !addName.trim()" @click="submitAdd">
            Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Bulk Cancel Dialog -->
    <Dialog v-model:open="isBulkCancelDialogOpen">
      <DialogContent class="max-w-md">
        <DialogHeader>
          <DialogTitle>Batalkan {{ selectedIds.length }} Peserta?</DialogTitle>
          <DialogDescription>Alasan wajib diisi.</DialogDescription>
        </DialogHeader>
        <div class="space-y-1.5 py-2">
          <Label for="bulk-cancel-reason">Alasan</Label>
          <Input id="bulk-cancel-reason" v-model="bulkCancelReason" />
        </div>
        <DialogFooter>
          <Button variant="outline" @click="isBulkCancelDialogOpen = false">
            Batal
          </Button>
          <Button variant="destructive" :disabled="!bulkCancelReason.trim()" @click="submitBulkCancel">
            Batalkan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Import Dialog (Bulk import simulation, Wajib) -->
    <Dialog v-model:open="isImportDialogOpen">
      <DialogScrollContent class="max-w-lg">
        <DialogHeader>
          <DialogTitle>Bulk Import Peserta (Mock)</DialogTitle>
          <DialogDescription>Simulasi parsing file — bukan upload file sungguhan (mock, D-006). Baris dengan error tidak akan diimpor.</DialogDescription>
        </DialogHeader>
        <div class="space-y-4 py-2">
          <div class="space-y-1.5">
            <Label for="import-project">Project Order</Label>
            <select id="import-project" v-model="importProjectId" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer" @change="generateImportPreview">
              <option value="">
                Pilih project...
              </option>
              <option v-for="project in projects" :key="project.id" :value="project.id">
                {{ project.name }}
              </option>
            </select>
          </div>
          <div v-if="importPreviewRows.length" class="space-y-2">
            <p class="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Preview ({{ importPreviewRows.length }} baris)
            </p>
            <ul class="divide-y divide-border text-sm">
              <li v-for="(row, index) in importPreviewRows" :key="index" class="py-2">
                <p class="text-foreground">
                  {{ row.name || '(nama kosong)' }}
                </p>
                <p v-if="row.errors.length" class="text-xs text-destructive">
                  {{ row.errors.join('; ') }}
                </p>
                <p v-else class="text-xs text-success">
                  Siap diimpor
                </p>
              </li>
            </ul>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="isImportDialogOpen = false">
            Batal
          </Button>
          <Button :disabled="importPreviewRows.length === 0" @click="submitImport">
            Import Baris Valid
          </Button>
        </DialogFooter>
      </DialogScrollContent>
    </Dialog>

    <!-- Export Dialog (mock, Wajib) -->
    <Dialog v-model:open="isExportDialogOpen">
      <DialogContent class="max-w-sm">
        <DialogHeader>
          <DialogTitle>Export Peserta (Mock)</DialogTitle>
          <DialogDescription>Simulasi export — tidak ada file yang benar-benar dihasilkan (D-006).</DialogDescription>
        </DialogHeader>
        <div class="space-y-1.5 py-2">
          <Label for="export-format">Format</Label>
          <select id="export-format" v-model="exportFormat" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
            <option value="csv">
              CSV
            </option>
            <option value="pdf">
              PDF
            </option>
          </select>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="isExportDialogOpen = false">
            Batal
          </Button>
          <Button @click="submitExport">
            Export
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
