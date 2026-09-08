<script setup lang="ts">
import { computed, ref } from 'vue'
import { Table as TableIcon, GanttChartSquare, Info, Check, X, StickyNote, ChevronDown, Wallet, ListChecks, Trash2, Settings2, Plus, LayoutTemplate, AlertTriangle } from 'lucide-vue-next'
import { cn } from '~/lib/utils'
import { getMilestoneDelayDays, getProjectMilestoneSummary, getMilestoneProgressPercent } from '~/data/project-order-workflow'
import { USERS, MILESTONE_TEMPLATES, getUserById } from '~/data'
import { formatDate, formatCurrencyIdr } from '~/utils/format'
import { DEMO_REFERENCE_DATE } from '~/utils/attention'
import type { BadgeTone } from '~/types/common'
import type { ProjectMilestone, ProjectMilestoneStatus } from '~/types/project-order'

const props = defineProps<{
  projectId: string
  milestones: ProjectMilestone[]
  canManage: boolean
  /** Tanggal rencana hanya boleh diubah sebelum Project Order dikonfirmasi. */
  plannedDatesLocked: boolean
}>()

const emit = defineEmits<{
  'update-planned': [payload: { milestoneId: string; plannedDate: string }]
  'mark-actual': [milestoneId: string]
  'update-note': [payload: { milestoneId: string; note: string }]
  'toggle-deliverable': [payload: { milestoneId: string; deliverableId: string }]
  'add-deliverable': [payload: { milestoneId: string; label: string }]
  'remove-deliverable': [payload: { milestoneId: string; deliverableId: string }]
  'update-budget': [payload: { milestoneId: string; budgetIdr?: number }]
  'add-milestone': [payload: { name: string; plannedDate: string; ownerId?: string; budgetIdr?: number }]
  'apply-template': [payload: { templateId: string; baseDate: string }]
}>()

const view = ref<'table' | 'gantt'>('table')

/** Dialog "Tambah Milestone" — form baru, terpisah dari expand-panel per milestone existing di atas. */
const isAddOpen = ref(false)
const newName = ref('')
const newPlannedDate = ref('')
const newOwnerId = ref('')
const newBudget = ref<number | null>(null)

function openAddDialog () {
  newName.value = ''
  newPlannedDate.value = ''
  newOwnerId.value = ''
  newBudget.value = null
  isAddOpen.value = true
}

function submitAddMilestone () {
  if (!newName.value.trim() || !newPlannedDate.value) { return }
  emit('add-milestone', {
    name: newName.value.trim(),
    plannedDate: newPlannedDate.value,
    ownerId: newOwnerId.value || undefined,
    budgetIdr: newBudget.value ?? undefined
  })
  isAddOpen.value = false
}

/** Dialog "Terapkan Template" — pilih Milestone Template aktif + tanggal acuan, mengganti seluruh milestone project ini. */
const isApplyTemplateOpen = ref(false)
const applyTemplateId = ref('')
const applyBaseDate = ref('')

const activeMilestoneTemplates = computed(() => MILESTONE_TEMPLATES.filter(template => template.isActive))
const selectedApplyTemplate = computed(() => MILESTONE_TEMPLATES.find(template => template.id === applyTemplateId.value))

function openApplyTemplateDialog () {
  applyTemplateId.value = ''
  applyBaseDate.value = ''
  isApplyTemplateOpen.value = true
}

function submitApplyTemplate () {
  if (!applyTemplateId.value || !applyBaseDate.value) { return }
  emit('apply-template', { templateId: applyTemplateId.value, baseDate: applyBaseDate.value })
  isApplyTemplateOpen.value = false
}

/** Panel expand per milestone (tanggal rencana + catatan) — dibuka/ditutup lokal di komponen ini (tidak
 * perlu state di parent, sama seperti `view`), cuma nilai final yang di-emit lewat "Save"/perubahan input. */
const expandedMilestoneId = ref<string | null>(null)
const noteDraft = ref('')

function toggleExpand (milestone: ProjectMilestone) {
  if (expandedMilestoneId.value === milestone.id) {
    expandedMilestoneId.value = null
    noteDraft.value = ''
    return
  }
  expandedMilestoneId.value = milestone.id
  noteDraft.value = milestone.note ?? ''
}

function saveNote (milestoneId: string) {
  emit('update-note', { milestoneId, note: noteDraft.value })
}

const summary = computed(() => getProjectMilestoneSummary(props.projectId))

const STATUS_META: Record<ProjectMilestoneStatus, { label: string; tone: BadgeTone }> = {
  'not-started': { label: 'Belum Mulai', tone: 'neutral' },
  'in-progress': { label: 'Berjalan', tone: 'info' },
  completed: { label: 'Selesai', tone: 'success' },
  delayed: { label: 'Terlambat', tone: 'destructive' },
  cancelled: { label: 'Dibatalkan', tone: 'neutral' }
}

const rows = computed(() => props.milestones.map(milestone => ({
  milestone,
  delay: getMilestoneDelayDays(milestone),
  ownerName: milestone.ownerId ? getUserById(milestone.ownerId)?.name : undefined
})))

function delayLabel (delay: number | undefined): string {
  if (delay === undefined) { return '—' }
  if (delay > 0) { return `+${delay} hari` }
  if (delay < 0) { return `${delay} hari` }
  return 'Tepat waktu'
}

function deliverableCount (milestone: ProjectMilestone): { done: number; total: number } {
  const list = milestone.deliverables ?? []
  return { done: list.filter(item => item.done).length, total: list.length }
}

/** Sheet "Kelola Milestone" — budget & checklist deliverables. Toggle/tambah/hapus deliverable diterapkan
 * langsung (sama seperti "Tandai Selesai" di baris utama); budget pakai draft + tombol Simpan eksplisit,
 * konsisten dengan pola "Edit Budget Layanan" di halaman detail project. */
const isManageOpen = ref(false)
const manageMilestoneId = ref<string | null>(null)
const budgetDraft = ref<number | null>(null)
const newDeliverableLabel = ref('')

const manageMilestone = computed(() => props.milestones.find(item => item.id === manageMilestoneId.value))

function openManageSheet (milestone: ProjectMilestone) {
  manageMilestoneId.value = milestone.id
  budgetDraft.value = milestone.budgetIdr ?? null
  newDeliverableLabel.value = ''
  isManageOpen.value = true
}

function saveBudget () {
  if (!manageMilestoneId.value) { return }
  emit('update-budget', { milestoneId: manageMilestoneId.value, budgetIdr: budgetDraft.value ?? undefined })
  isManageOpen.value = false
}

function addDeliverable () {
  if (!manageMilestoneId.value || !newDeliverableLabel.value.trim()) { return }
  emit('add-deliverable', { milestoneId: manageMilestoneId.value, label: newDeliverableLabel.value })
  newDeliverableLabel.value = ''
}

function toggleDeliverable (deliverableId: string) {
  if (!manageMilestoneId.value) { return }
  emit('toggle-deliverable', { milestoneId: manageMilestoneId.value, deliverableId })
}

function removeDeliverable (deliverableId: string) {
  if (!manageMilestoneId.value) { return }
  emit('remove-deliverable', { milestoneId: manageMilestoneId.value, deliverableId })
}

function isLate (row: { milestone: ProjectMilestone; delay: number | undefined }): boolean {
  return row.delay !== undefined && row.delay > 0 && row.milestone.status !== 'completed'
}
</script>

<template>
  <SectionCard compact titleClass="text-sm font-bold normal-case tracking-normal text-foreground" title="Timeline Tracking">
    <template #actions>
      <div class="flex items-center gap-2">
        <Button v-if="canManage" size="sm" variant="outline" @click="openApplyTemplateDialog">
          <LayoutTemplate class="mr-1 h-3.5 w-3.5" />Terapkan Template
        </Button>
        <Button v-if="canManage" size="sm" variant="outline" @click="openAddDialog">
          <Plus class="mr-1 h-3.5 w-3.5" />Tambah Milestone
        </Button>
        <div class="inline-flex rounded-lg border border-border p-0.5">
          <button
            v-for="option in (['table', 'gantt'] as const)"
            :key="option"
            type="button"
            :class="cn(
              'flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors',
              view === option ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            )"
            @click="view = option"
          >
            <component :is="option === 'table' ? TableIcon : GanttChartSquare" class="h-3.5 w-3.5" />
            {{ option === 'table' ? 'Table' : 'Gantt' }}
          </button>
        </div>
      </div>
    </template>

    <p class="-mt-2 mb-3 text-xs text-muted-foreground">
      {{ summary.completed }}/{{ summary.total }} milestone selesai
      <template v-if="summary.delayed">
        · <span class="text-destructive font-medium">{{ summary.delayed }} terlambat ({{ summary.totalDelayDays }} hari kumulatif)</span>
      </template>
    </p>

    <div v-if="!plannedDatesLocked" class="rounded-lg border border-chart-5/30 bg-chart-5/5 px-3 py-2 mb-3 flex gap-2">
      <Info class="h-4 w-4 text-chart-5 shrink-0 mt-0.5" />
      <div>
        <p class="text-xs font-medium text-foreground">
          Tanggal rencana masih dapat diubah
        </p>
        <p class="text-xs text-muted-foreground mt-0.5">
          Setelah Project Order dikonfirmasi, tanggal rencana dikunci dan hanya tanggal realisasi yang dapat diisi.
        </p>
      </div>
    </div>

    <template v-if="view === 'table'">
      <div v-if="rows.length" class="overflow-hidden rounded-xl border border-border">
        <div v-for="(row, index) in rows" :key="row.milestone.id" class="relative">
          <!-- Garis penghubung ke milestone berikutnya — absolute terhadap seluruh blok (header + expand panel),
               bukan cuma tinggi header row, supaya tetap nyambung mulus saat panel-nya dibuka. -->
          <div v-if="index !== rows.length - 1" class="absolute bottom-0 left-8 top-11 w-px bg-border" />

          <div
            class="flex cursor-pointer gap-3 px-4 py-3 transition-colors hover:bg-muted/30"
            :class="[
              index !== rows.length - 1 || expandedMilestoneId === row.milestone.id ? 'border-b border-border' : '',
              row.milestone.status === 'completed' ? 'bg-success/[0.03]' : ''
            ]"
            @click="toggleExpand(row.milestone)"
          >
            <div
              class="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold"
              :class="row.milestone.status === 'completed'
                ? 'bg-success text-success-foreground'
                : isLate(row) ? 'border-2 border-destructive bg-card text-destructive' : 'border-2 border-border bg-card text-muted-foreground'"
            >
              {{ String(index + 1).padStart(2, '0') }}
            </div>

            <div class="min-w-0 flex-1 pb-0.5">
              <div class="flex flex-wrap items-center gap-2">
                <p class="text-sm font-semibold text-foreground">
                  {{ row.milestone.name }}
                </p>
                <StatusBadge
                  :label="STATUS_META[row.milestone.status].label"
                  :tone="isLate(row) ? 'destructive' : STATUS_META[row.milestone.status].tone"
                />
                <StickyNote v-if="row.milestone.note" class="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              </div>
              <p class="mt-0.5 text-xs text-muted-foreground">
                <template v-if="row.milestone.actualDate">
                  Realisasi {{ formatDate(row.milestone.actualDate) }}
                </template>
                <template v-else>
                  Rencana {{ formatDate(row.milestone.plannedDate) }}
                </template>
                <template v-if="row.ownerName">
                  · {{ row.ownerName }}
                </template>
                <template v-if="isLate(row)">
                  · <span class="font-medium text-destructive">{{ delayLabel(row.delay) }}</span>
                </template>
                <template v-if="row.milestone.budgetIdr">
                  · {{ formatCurrencyIdr(row.milestone.budgetIdr) }}
                </template>
              </p>
              <div class="mt-1.5 flex items-center gap-2">
                <div class="h-1.5 w-24 shrink-0 overflow-hidden rounded-full bg-muted">
                  <div
                    class="h-full rounded-full bg-primary transition-all"
                    :style="{ width: `${getMilestoneProgressPercent(row.milestone)}%` }"
                  />
                </div>
                <span class="text-[11px] text-muted-foreground">{{ getMilestoneProgressPercent(row.milestone) }}%</span>
                <span v-if="deliverableCount(row.milestone).total" class="inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                  <ListChecks class="h-3 w-3" />{{ deliverableCount(row.milestone).done }}/{{ deliverableCount(row.milestone).total }} selesai
                </span>
              </div>
            </div>

            <div class="flex shrink-0 items-start gap-1.5" @click.stop>
              <div
                class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors"
                :class="row.milestone.actualDate ? 'bg-success text-success-foreground' : 'border-2 border-border text-transparent hover:border-primary/40 hover:text-primary/50'"
              >
                <button
                  v-if="!row.milestone.actualDate && canManage && row.milestone.status !== 'cancelled'"
                  type="button"
                  class="flex h-full w-full items-center justify-center rounded-full"
                  title="Tandai Selesai"
                  @click="emit('mark-actual', row.milestone.id)"
                >
                  <Check class="h-4 w-4" />
                </button>
                <Check v-else-if="row.milestone.actualDate" class="h-4 w-4" />
              </div>
              <ChevronDown
                class="mt-2 h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform"
                :class="expandedMilestoneId === row.milestone.id ? 'rotate-180' : ''"
              />
            </div>
          </div>

          <div
            v-if="expandedMilestoneId === row.milestone.id"
            class="space-y-3 bg-muted/20 px-4 py-3 pl-[3.75rem]"
            :class="index !== rows.length - 1 ? 'border-b border-border' : ''"
            @click.stop
          >
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <p class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Rencana
                </p>
                <input
                  v-if="canManage && !plannedDatesLocked && row.milestone.status !== 'completed'"
                  type="date"
                  :value="row.milestone.plannedDate"
                  class="mt-1 w-full rounded-lg border border-input bg-card px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  @change="emit('update-planned', { milestoneId: row.milestone.id, plannedDate: ($event.target as HTMLInputElement).value })"
                >
                <p v-else class="mt-1 text-sm text-foreground">
                  {{ formatDate(row.milestone.plannedDate) }}
                </p>
              </div>
              <div>
                <p class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Realisasi
                </p>
                <p class="mt-1 text-sm" :class="row.milestone.actualDate ? 'text-foreground' : 'text-muted-foreground'">
                  {{ row.milestone.actualDate ? formatDate(row.milestone.actualDate) : '—' }}
                </p>
              </div>
              <div>
                <p class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Delay
                </p>
                <p class="mt-1 text-sm" :class="row.delay === undefined ? 'text-muted-foreground' : row.delay > 0 ? 'font-medium text-destructive' : 'text-success'">
                  {{ delayLabel(row.delay) }}
                </p>
              </div>
            </div>

            <div>
              <p class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Catatan
              </p>
              <template v-if="canManage">
                <textarea
                  v-model="noteDraft"
                  rows="2"
                  placeholder="Tambahkan catatan (mis. alasan delay, alasan selesai lebih cepat)"
                  class="mt-1 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <div class="mt-2 flex items-center justify-end gap-3">
                  <button type="button" class="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground" @click="toggleExpand(row.milestone)">
                    <X class="h-3.5 w-3.5" />Cancel
                  </button>
                  <Button size="sm" @click="saveNote(row.milestone.id)">
                    <Check class="mr-1 h-3.5 w-3.5" />Save
                  </Button>
                </div>
              </template>
              <p v-else class="mt-1 text-sm text-muted-foreground">
                {{ row.milestone.note || 'Belum ada catatan.' }}
              </p>
            </div>

            <div class="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2">
              <div class="min-w-0">
                <p class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Budget Milestone
                </p>
                <p class="mt-0.5 text-sm font-semibold text-foreground">
                  {{ row.milestone.budgetIdr ? formatCurrencyIdr(row.milestone.budgetIdr) : 'Belum diisi' }}
                </p>
              </div>
              <div v-if="deliverableCount(row.milestone).total" class="shrink-0 text-right">
                <p class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Deliverables
                </p>
                <p class="mt-0.5 text-sm font-semibold text-foreground">
                  {{ deliverableCount(row.milestone).done }}/{{ deliverableCount(row.milestone).total }} selesai
                </p>
              </div>
              <Button v-if="canManage" size="sm" variant="outline" class="shrink-0" @click="openManageSheet(row.milestone)">
                <Settings2 class="mr-1 h-3.5 w-3.5" />Kelola
              </Button>
            </div>

            <div v-if="deliverableCount(row.milestone).total" class="space-y-1.5">
              <p class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Checklist
              </p>
              <label v-for="deliverable in row.milestone.deliverables" :key="deliverable.id" class="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  :checked="deliverable.done"
                  :disabled="!canManage"
                  class="h-3.5 w-3.5 shrink-0 rounded border-input"
                  @change="emit('toggle-deliverable', { milestoneId: row.milestone.id, deliverableId: deliverable.id })"
                >
                <span :class="deliverable.done ? 'text-muted-foreground line-through' : 'text-foreground'">{{ deliverable.label }}</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      <EmptyState v-else title="Belum ada milestone" description="Milestone akan muncul begitu Project Order punya rencana jadwal." />
    </template>

    <ProjectOrderGanttChart v-else :milestones="milestones" />

    <p class="text-[11px] text-muted-foreground mt-3">
      Delay dihitung dari selisih tanggal realisasi terhadap rencana. Milestone yang belum selesai diukur
      terhadap tanggal acuan demo ({{ formatDate(DEMO_REFERENCE_DATE) }}), sehingga keterlambatan yang sedang
      berjalan ikut terlihat.
    </p>

    <Dialog v-model:open="isAddOpen">
      <DialogContent class="max-w-md">
        <DialogHeader>
          <DialogTitle>Tambah Milestone</DialogTitle>
          <DialogDescription>Milestone baru ditambahkan ke Timeline Tracking project ini.</DialogDescription>
        </DialogHeader>
        <div class="space-y-4 py-2">
          <div class="space-y-1.5">
            <Label for="new-milestone-name">Nama Milestone</Label>
            <Input id="new-milestone-name" v-model="newName" placeholder="mis. Konfirmasi Vendor & Booking" />
          </div>
          <div class="space-y-1.5">
            <Label for="new-milestone-date">Tanggal Rencana</Label>
            <Input id="new-milestone-date" v-model="newPlannedDate" type="date" />
          </div>
          <div class="space-y-1.5">
            <Label for="new-milestone-owner">Owner (opsional)</Label>
            <select id="new-milestone-owner" v-model="newOwnerId" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
              <option value="">
                Belum ditentukan
              </option>
              <option v-for="user in USERS" :key="user.id" :value="user.id">
                {{ user.name }}
              </option>
            </select>
          </div>
          <div class="space-y-1.5">
            <Label for="new-milestone-budget">Budget (Rp, opsional)</Label>
            <CurrencyInput id="new-milestone-budget" v-model="newBudget" placeholder="mis. 5000000" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="isAddOpen = false">
            Batal
          </Button>
          <Button :disabled="!newName.trim() || !newPlannedDate" @click="submitAddMilestone">
            Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="isApplyTemplateOpen">
      <DialogContent class="max-w-md">
        <DialogHeader>
          <DialogTitle>Terapkan Milestone Template</DialogTitle>
          <DialogDescription>Seluruh milestone project ini akan digantikan oleh isi template yang dipilih.</DialogDescription>
        </DialogHeader>
        <div class="space-y-4 py-2">
          <div class="space-y-1.5">
            <Label for="apply-template-select">Template</Label>
            <select id="apply-template-select" v-model="applyTemplateId" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
              <option value="">
                Pilih template
              </option>
              <option v-for="template in activeMilestoneTemplates" :key="template.id" :value="template.id">
                {{ template.label }} ({{ template.items.length }} milestone)
              </option>
            </select>
          </div>
          <div class="space-y-1.5">
            <Label for="apply-template-date">Tanggal Acuan</Label>
            <Input id="apply-template-date" v-model="applyBaseDate" type="date" />
          </div>
          <div v-if="selectedApplyTemplate" class="flex gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2">
            <AlertTriangle class="h-4 w-4 shrink-0 text-destructive mt-0.5" />
            <p class="text-xs text-destructive">
              Seluruh milestone project ini akan DIHAPUS dan digantikan oleh {{ selectedApplyTemplate.items.length }} milestone dari template ini. Aksi ini tidak dapat dibatalkan.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="isApplyTemplateOpen = false">
            Batal
          </Button>
          <Button :disabled="!applyTemplateId || !applyBaseDate" variant="destructive" @click="submitApplyTemplate">
            Terapkan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Sheet v-model:open="isManageOpen">
      <SheetContent side="right" class="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Kelola Milestone{{ manageMilestone ? `: ${manageMilestone.name}` : '' }}</SheetTitle>
          <SheetDescription>Atur budget dan checklist deliverables milestone ini.</SheetDescription>
        </SheetHeader>

        <div class="space-y-5 py-2">
          <div class="space-y-1.5">
            <Label for="milestone-budget">
              <Wallet class="mr-1 inline h-3.5 w-3.5" />Budget (Rp)
            </Label>
            <CurrencyInput id="milestone-budget" v-model="budgetDraft" placeholder="mis. 5000000" />
          </div>

          <div class="space-y-2">
            <Label>
              <ListChecks class="mr-1 inline h-3.5 w-3.5" />Deliverables
            </Label>
            <div v-if="manageMilestone?.deliverables?.length" class="space-y-1.5">
              <div v-for="deliverable in manageMilestone.deliverables" :key="deliverable.id" class="flex items-center gap-2 rounded-lg border border-border px-2.5 py-1.5">
                <input
                  type="checkbox"
                  :checked="deliverable.done"
                  class="h-3.5 w-3.5 shrink-0 rounded border-input"
                  @change="toggleDeliverable(deliverable.id)"
                >
                <span class="min-w-0 flex-1 truncate text-sm" :class="deliverable.done ? 'text-muted-foreground line-through' : 'text-foreground'">{{ deliverable.label }}</span>
                <button type="button" class="shrink-0 text-muted-foreground hover:text-destructive" title="Hapus" @click="removeDeliverable(deliverable.id)">
                  <Trash2 class="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <p v-else class="text-xs text-muted-foreground">
              Belum ada item checklist.
            </p>
            <div class="flex gap-2">
              <input
                v-model="newDeliverableLabel"
                type="text"
                placeholder="Tambah item checklist"
                class="w-full rounded-lg border border-input bg-card px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                @keyup.enter="addDeliverable"
              >
              <Button size="sm" variant="outline" class="shrink-0" @click="addDeliverable">
                Tambah
              </Button>
            </div>
          </div>
        </div>

        <SheetFooter class="mt-6 flex-row justify-end gap-2">
          <Button variant="outline" @click="isManageOpen = false">
            Tutup
          </Button>
          <Button @click="saveBudget">
            Simpan Budget
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  </SectionCard>
</template>
