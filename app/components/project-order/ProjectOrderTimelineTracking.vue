<script setup lang="ts">
import { computed, ref } from 'vue'
import { Table as TableIcon, GanttChartSquare, Info, Check, X, StickyNote, ChevronDown } from 'lucide-vue-next'
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

function isLate (row: { milestone: ProjectMilestone; delay: number | undefined }): boolean {
  return row.delay !== undefined && row.delay > 0 && row.milestone.status !== 'completed'
}
</script>

<template>
  <SectionCard compact titleClass="text-sm font-bold normal-case tracking-normal text-foreground" title="Timeline Tracking">
    <template #actions>
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
              </p>
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
  </SectionCard>
</template>
