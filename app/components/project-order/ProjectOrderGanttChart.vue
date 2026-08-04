<script setup lang="ts">
import { computed } from 'vue'
import { differenceInCalendarDays, parseISO, addDays, format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { cn } from '~/lib/utils'
import { getMilestoneDelayDays } from '~/data/project-order-workflow'
import { DEMO_REFERENCE_DATE } from '~/utils/attention'
import type { ProjectMilestone } from '~/types/project-order'

const props = defineProps<{ milestones: ProjectMilestone[] }>()

/**
 * Gantt digambar dengan CSS + date-fns saja — tidak menambah dependency chart baru. Skala sumbu X
 * dinormalisasi ke rentang planned/actual terkecil sampai terbesar, plus padding 3 hari di kedua ujung.
 */
const range = computed(() => {
  const dates = props.milestones.flatMap(milestone => [milestone.plannedDate, milestone.actualDate].filter(Boolean) as string[])
  dates.push(DEMO_REFERENCE_DATE)
  if (!dates.length) { return undefined }

  const sorted = [...dates].sort()
  const start = addDays(parseISO(sorted[0]), -3)
  const end = addDays(parseISO(sorted[sorted.length - 1]), 3)
  const totalDays = Math.max(1, differenceInCalendarDays(end, start))
  return { start, end, totalDays }
})

function percentOf (isoDate: string): number {
  if (!range.value) { return 0 }
  const offset = differenceInCalendarDays(parseISO(isoDate), range.value.start)
  return Math.min(100, Math.max(0, (offset / range.value.totalDays) * 100))
}

const todayPercent = computed(() => percentOf(DEMO_REFERENCE_DATE))

const rows = computed(() => props.milestones.map((milestone) => {
  const delay = getMilestoneDelayDays(milestone)
  const plannedPercent = percentOf(milestone.plannedDate)
  const actualPercent = milestone.actualDate ? percentOf(milestone.actualDate) : todayPercent.value

  const left = Math.min(plannedPercent, actualPercent)
  const width = Math.max(1.2, Math.abs(actualPercent - plannedPercent))

  return {
    milestone,
    delay,
    plannedPercent,
    left,
    width,
    /** Bar hanya digambar bila ada rentang nyata antara rencana dan realisasi (atau keterlambatan berjalan). */
    hasBar: Boolean(milestone.actualDate) || (delay !== undefined && delay > 0)
  }
}))

/** Empat penanda bulan di sumbu X — cukup untuk orientasi tanpa membuat sumbu penuh sesak. */
const axisTicks = computed(() => {
  if (!range.value) { return [] }
  return [0, 0.33, 0.66, 1].map(fraction => ({
    percent: fraction * 100,
    label: format(addDays(range.value!.start, Math.round(range.value!.totalDays * fraction)), 'd MMM', { locale: localeId })
  }))
})
</script>

<template>
  <div v-if="range" class="space-y-2">
    <div class="flex items-center gap-4 text-[11px] text-muted-foreground">
      <span class="flex items-center gap-1.5"><span class="h-2 w-4 rounded-sm bg-primary" /> Sesuai / lebih cepat</span>
      <span class="flex items-center gap-1.5"><span class="h-2 w-4 rounded-sm bg-destructive" /> Terlambat</span>
      <span class="flex items-center gap-1.5"><span class="h-3 w-0.5 bg-warning" /> Hari ini</span>
    </div>

    <div class="overflow-x-auto">
      <div class="min-w-[560px]">
        <div class="relative">
          <span
            class="absolute top-0 bottom-6 w-0.5 bg-warning/70 z-10"
            :style="{ left: `${todayPercent}%` }"
          />

          <ul class="space-y-1.5">
            <li v-for="row in rows" :key="row.milestone.id" class="flex items-center gap-3">
              <span class="w-44 shrink-0 text-xs text-foreground truncate" :title="row.milestone.name">
                {{ row.milestone.name }}
              </span>

              <span class="relative flex-1 h-6 rounded bg-muted/50">
                <span
                  class="absolute top-1/2 -translate-y-1/2 h-2.5 w-2.5 rounded-full border-2 border-card bg-muted-foreground"
                  :style="{ left: `calc(${row.plannedPercent}% - 5px)` }"
                  :title="`Rencana: ${row.milestone.plannedDate}`"
                />
                <span
                  v-if="row.hasBar"
                  :class="cn(
                    'absolute top-1/2 -translate-y-1/2 h-2.5 rounded-full',
                    row.delay !== undefined && row.delay > 0 ? 'bg-destructive' : 'bg-primary'
                  )"
                  :style="{ left: `${row.left}%`, width: `${row.width}%` }"
                  :title="row.milestone.actualDate ? `Realisasi: ${row.milestone.actualDate}` : 'Sedang berjalan / lewat jatuh tempo'"
                />
              </span>

              <span
                :class="cn(
                  'w-16 shrink-0 text-right text-[11px]',
                  row.delay === undefined ? 'text-muted-foreground' : row.delay > 0 ? 'text-destructive font-medium' : 'text-success'
                )"
              >
                {{ row.delay === undefined ? '—' : `${row.delay > 0 ? '+' : ''}${row.delay}h` }}
              </span>
            </li>
          </ul>

          <div class="relative h-5 mt-1 ml-[188px] mr-[76px]">
            <span
              v-for="tick in axisTicks"
              :key="tick.percent"
              class="absolute text-[10px] text-muted-foreground -translate-x-1/2"
              :style="{ left: `${tick.percent}%` }"
            >
              {{ tick.label }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>

  <EmptyState v-else title="Belum ada milestone" description="Tambahkan milestone untuk melihat Gantt." />
</template>
