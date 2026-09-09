<script setup lang="ts">
import { computed, ref } from 'vue'
import { format, parseISO, differenceInCalendarDays } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { Briefcase, Clock, Lock, NotebookText, Search } from 'lucide-vue-next'
import { PROJECTS, getProjectById, getUserById } from '~/data'
import { ACTIVITIES, SHIFT_NOTES } from '~/data/activity'
import { DEMO_REFERENCE_DATE } from '~/utils/attention'

/** Menu sidebar baru "Catatan/Aktivitas" — feed gabungan `ACTIVITIES` + `SHIFT_NOTES` lintas project
 * (keduanya sudah data global/reactive, tidak ada entity baru), read-only. Dikelompokkan per tanggal
 * (pola timeline umum) — tiap entri link ke tab Activity & Changes project terkait (CRUD detailnya tetap
 * di sana). "Internal" cuma ditempel di Shift Note — itu satu-satunya jenis catatan yang secara desain
 * murni internal (lihat komentar `ShiftNote` di `app/types/activity.ts`), bukan status baru yang dikarang. */

type FeedEntry = {
  id: string
  projectId: string
  createdAt: string
  kind: 'change' | 'activity' | 'shift-note'
  text: string
  authorId?: string
}

const feed = computed<FeedEntry[]>(() => {
  const activityEntries: FeedEntry[] = ACTIVITIES.map(entry => ({
    id: entry.id,
    projectId: entry.projectId,
    createdAt: entry.createdAt,
    kind: entry.isChange ? 'change' : 'activity',
    text: entry.message,
    authorId: entry.requestedBy
  }))
  const shiftEntries: FeedEntry[] = SHIFT_NOTES.map(note => ({
    id: note.id,
    projectId: note.projectId,
    createdAt: note.createdAt,
    kind: 'shift-note',
    text: note.note,
    authorId: note.authorId
  }))
  return [...activityEntries, ...shiftEntries].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
})

const KIND_META: Record<FeedEntry['kind'], { label: string; tone: 'destructive' | 'neutral' | 'info'; iconBg: string; iconColor: string }> = {
  change: { label: 'Perubahan', tone: 'destructive', iconBg: 'bg-destructive/15', iconColor: 'text-destructive' },
  activity: { label: 'Aktivitas', tone: 'neutral', iconBg: 'bg-muted', iconColor: 'text-muted-foreground' },
  'shift-note': { label: 'Shift Note', tone: 'info', iconBg: 'bg-chart-5/15', iconColor: 'text-chart-5' }
}

function initials (name?: string): string {
  if (!name?.trim()) { return 'SY' }
  return name.trim().slice(0, 2).toUpperCase()
}

function relativeDays (iso: string): string {
  const diff = differenceInCalendarDays(parseISO(DEMO_REFERENCE_DATE), parseISO(iso))
  if (diff <= 0) { return 'Hari ini' }
  if (diff === 1) { return 'Kemarin' }
  return `${diff} hari yang lalu`
}

const searchQuery = ref('')
const kindFilter = ref<'all' | FeedEntry['kind']>('all')

const rows = computed(() => feed.value
  .filter(entry => kindFilter.value === 'all' || entry.kind === kindFilter.value)
  .filter((entry) => {
    if (!searchQuery.value.trim()) { return true }
    const term = searchQuery.value.trim().toLowerCase()
    return entry.text.toLowerCase().includes(term) || (getProjectById(entry.projectId)?.name ?? '').toLowerCase().includes(term)
  })
  .map(entry => ({ entry, project: getProjectById(entry.projectId), author: entry.authorId ? getUserById(entry.authorId) : undefined })))

/** Dikelompokkan per tanggal (bukan per project) — pola timeline umum, mengikuti referensi layout. */
const groupedByDate = computed(() => {
  const map = new Map<string, typeof rows.value>()
  for (const row of rows.value) {
    if (!map.has(row.entry.createdAt)) { map.set(row.entry.createdAt, []) }
    map.get(row.entry.createdAt)!.push(row)
  }
  return [...map.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, entries]) => ({ date, label: format(parseISO(date), 'EEEE, d MMMM yyyy', { locale: localeId }), entries }))
})
</script>

<template>
  <div class="space-y-4">
    <SectionCard flush content-class="flex flex-wrap items-center gap-3 p-3">
      <div class="relative min-w-[220px] flex-1">
        <Search class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input v-model="searchQuery" placeholder="Cari catatan..." class="pl-9" />
      </div>
      <select v-model="kindFilter" class="appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
        <option value="all">
          Semua Tipe
        </option>
        <option v-for="(meta, kind) in KIND_META" :key="kind" :value="kind">
          {{ meta.label }}
        </option>
      </select>
    </SectionCard>

    <div v-if="groupedByDate.length" class="space-y-5">
      <div v-for="group in groupedByDate" :key="group.date">
        <div class="mb-2 flex items-center gap-3">
          <p class="shrink-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {{ group.label }}
          </p>
          <div class="h-px flex-1 bg-border" />
          <span class="shrink-0 text-xs text-muted-foreground">{{ group.entries.length }}</span>
        </div>

        <div class="space-y-2">
          <NuxtLink
            v-for="row in group.entries"
            :key="`${row.entry.kind}-${row.entry.id}`"
            :to="`/project-orders/${row.entry.projectId}?tab=activity-changes`"
            class="flex items-start gap-3 rounded-xl border border-border bg-card p-3 shadow-sm transition-colors hover:bg-muted/30"
          >
            <span :class="['flex h-9 w-9 shrink-0 items-center justify-center rounded-full', KIND_META[row.entry.kind].iconBg]">
              <Briefcase :class="['h-4 w-4', KIND_META[row.entry.kind].iconColor]" />
            </span>

            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-2">
                <Avatar class="h-5 w-5 shrink-0" :title="row.author?.name ?? 'Sistem'">
                  <AvatarFallback class="bg-primary/15 text-[9px] font-semibold text-primary">
                    {{ initials(row.author?.name) }}
                  </AvatarFallback>
                </Avatar>
                <p class="text-sm font-semibold text-foreground">
                  {{ row.author?.name ?? 'Sistem' }}
                </p>
                <StatusBadge :label="row.project?.name ?? 'Project'" tone="warning" />
                <span v-if="row.entry.kind === 'shift-note'" class="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  <Lock class="h-3 w-3" />Internal
                </span>
              </div>
              <p class="mt-1 text-sm text-foreground">
                {{ row.entry.text }}
              </p>
            </div>

            <span class="ml-auto flex shrink-0 items-center gap-1 whitespace-nowrap text-xs text-muted-foreground">
              <Clock class="h-3.5 w-3.5" />{{ relativeDays(row.entry.createdAt) }}
            </span>
          </NuxtLink>
        </div>
      </div>
    </div>
    <SectionCard v-else>
      <EmptyState :icon="NotebookText" title="Belum ada aktivitas" description="Tidak ada aktivitas/catatan yang cocok dengan filter ini." />
    </SectionCard>
  </div>
</template>
