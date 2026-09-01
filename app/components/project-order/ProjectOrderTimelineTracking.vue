<script setup lang="ts">
import { computed, ref } from 'vue'
import { Table as TableIcon, GanttChartSquare, Info, Check, X, StickyNote } from 'lucide-vue-next'
import { cn } from '~/lib/utils'
import { getMilestoneDelayDays, getProjectMilestoneSummary } from '~/data/project-order-workflow'
import { getUserById } from '~/data'
import { formatDate } from '~/utils/format'
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
}>()

const view = ref<'table' | 'gantt'>('table')

/** Editor catatan per milestone — dibuka/ditutup lokal di komponen ini (tidak perlu state di parent, sama seperti `view`), cuma nilai final yang di-emit lewat "Save". */
const editingNoteMilestoneId = ref<string | null>(null)
const noteDraft = ref('')

function openNoteEditor (milestone: ProjectMilestone) {
  editingNoteMilestoneId.value = milestone.id
  noteDraft.value = milestone.note ?? ''
}

function closeNoteEditor () {
  editingNoteMilestoneId.value = null
  noteDraft.value = ''
}

function saveNote (milestoneId: string) {
  emit('update-note', { milestoneId, note: noteDraft.value })
  closeNoteEditor()
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
</script>

<template>
  <SectionCard>
    <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
      <div>
        <h3 class="text-base font-semibold text-foreground">
          Timeline Tracking
        </h3>
        <p class="text-xs text-muted-foreground mt-0.5">
          {{ summary.completed }}/{{ summary.total }} milestone selesai
          <template v-if="summary.delayed">
            · <span class="text-destructive font-medium">{{ summary.delayed }} terlambat ({{ summary.totalDelayDays }} hari kumulatif)</span>
          </template>
        </p>
      </div>

      <div class="inline-flex rounded-lg border border-border p-0.5">
        <button
          v-for="option in (['table', 'gantt'] as const)"
          :key="option"
          type="button"
          :class="cn(
            'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
            view === option ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
          )"
          @click="view = option"
        >
          <component :is="option === 'table' ? TableIcon : GanttChartSquare" class="h-3.5 w-3.5" />
          {{ option === 'table' ? 'Table' : 'Gantt' }}
        </button>
      </div>
    </div>

    <div v-if="!plannedDatesLocked" class="rounded-lg border border-chart-5/30 bg-chart-5/5 px-3 py-2.5 mb-4 flex gap-2">
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
      <Table v-if="rows.length">
        <TableHeader>
          <TableRow>
            <TableHead>Milestone</TableHead>
            <TableHead>Rencana</TableHead>
            <TableHead>Realisasi</TableHead>
            <TableHead>Delay</TableHead>
            <TableHead>Status</TableHead>
            <TableHead v-if="canManage" class="text-right">
              Aksi
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <template v-for="row in rows" :key="row.milestone.id">
          <TableRow>
            <TableCell>
              <div class="flex items-start gap-1.5">
                <div class="min-w-0">
                  <p class="text-sm font-medium text-foreground">
                    {{ row.milestone.name }}
                  </p>
                  <p v-if="row.ownerName" class="text-xs text-muted-foreground">
                    {{ row.ownerName }}
                  </p>
                  <p v-if="row.milestone.note" class="text-xs text-muted-foreground italic mt-0.5">
                    {{ row.milestone.note }}
                  </p>
                </div>
                <button
                  v-if="canManage"
                  type="button"
                  class="flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-primary"
                  :title="row.milestone.note ? 'Edit catatan' : 'Tambah catatan'"
                  @click="editingNoteMilestoneId === row.milestone.id ? closeNoteEditor() : openNoteEditor(row.milestone)"
                >
                  <StickyNote class="h-3.5 w-3.5" />
                </button>
              </div>
            </TableCell>
            <TableCell class="whitespace-nowrap">
              <input
                v-if="canManage && !plannedDatesLocked && row.milestone.status !== 'completed'"
                type="date"
                :value="row.milestone.plannedDate"
                class="rounded-lg border border-input bg-card px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                @change="emit('update-planned', { milestoneId: row.milestone.id, plannedDate: ($event.target as HTMLInputElement).value })"
              >
              <span v-else class="text-foreground">{{ formatDate(row.milestone.plannedDate) }}</span>
            </TableCell>
            <TableCell class="whitespace-nowrap">
              <span :class="row.milestone.actualDate ? 'text-foreground' : 'text-muted-foreground'">
                {{ row.milestone.actualDate ? formatDate(row.milestone.actualDate) : '—' }}
              </span>
            </TableCell>
            <TableCell class="whitespace-nowrap">
              <span
                :class="cn(
                  row.delay === undefined ? 'text-muted-foreground' : row.delay > 0 ? 'font-medium text-destructive' : 'text-success'
                )"
              >
                {{ delayLabel(row.delay) }}
              </span>
            </TableCell>
            <TableCell>
              <StatusBadge
                :label="STATUS_META[row.milestone.status].label"
                :tone="row.delay !== undefined && row.delay > 0 && row.milestone.status !== 'completed' ? 'destructive' : STATUS_META[row.milestone.status].tone"
                dot
              />
            </TableCell>
            <!--
              Refinement UI: tombol "Tandai Selesai" sebelumnya tampil sebagai `outline` penuh (warna
              primary) di setiap baris yang belum selesai — delapan tombol sejajar menarik perhatian lebih
              besar daripada data yang seharusnya dibaca. Kini diam netral abu-abu, baru berubah ke warna
              primary (border/teks biru + tint bg) saat di-hover sebagai affordance interaktif.
            -->
            <TableCell v-if="canManage" class="text-right">
              <Button
                v-if="!row.milestone.actualDate && row.milestone.status !== 'cancelled'"
                variant="outline"
                size="sm"
                class="whitespace-nowrap border-border bg-transparent text-muted-foreground shadow-none hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
                @click="emit('mark-actual', row.milestone.id)"
              >
                <Check class="mr-1 h-3.5 w-3.5" />
                Tandai Selesai
              </Button>
            </TableCell>
          </TableRow>
          <TableRow v-if="editingNoteMilestoneId === row.milestone.id" class="hover:bg-transparent">
            <TableCell :colspan="canManage ? 6 : 5" class="border-l-2 border-l-primary bg-primary/[0.03] py-3">
              <textarea
                v-model="noteDraft"
                rows="2"
                autofocus
                placeholder="Tambahkan catatan (mis. alasan delay, alasan selesai lebih cepat)"
                class="w-full rounded-lg border border-primary/50 bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <div class="mt-2 flex items-center justify-end gap-3">
                <button type="button" class="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground" @click="closeNoteEditor">
                  <X class="h-3.5 w-3.5" />Cancel
                </button>
                <Button size="sm" @click="saveNote(row.milestone.id)">
                  <Check class="mr-1 h-3.5 w-3.5" />Save
                </Button>
              </div>
            </TableCell>
          </TableRow>
          </template>
        </TableBody>
      </Table>

      <EmptyState v-else title="Belum ada milestone" description="Milestone akan muncul begitu Project Order punya rencana jadwal." />
    </template>

    <ProjectOrderGanttChart v-else :milestones="milestones" />

    <p class="text-[11px] text-muted-foreground mt-3">
      Delay dihitung dari selisih tanggal realisasi terhadap rencana. Milestone yang belum selesai diukur
      terhadap tanggal acuan demo ({{ formatDate(DEMO_REFERENCE_DATE) }}), sehingga keterlambatan yang sedang
      berjalan ikut terlihat.
    </p>
  </SectionCard>
</template>
