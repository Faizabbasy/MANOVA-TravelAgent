<script setup lang="ts">
import { computed } from 'vue'
import { addDays, eachDayOfInterval, format, parseISO } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { cn } from '~/lib/utils'
import { TONE_DOT, type ScheduleEvent } from '~/composables/useScheduleEvents'

const props = defineProps<{
  /** Awal minggu (Senin), format `YYYY-MM-DD`. */
  weekStart: string
  /** Seluruh event terfilter (belum di-scope per hari) — komponen ini yang menyaring sendiri per kolom, pola sama `CalendarMonthGrid`. */
  events: ScheduleEvent[]
  /** Tanggal yang disorot sebagai "hari ini" — memakai tanggal acuan demo, bukan waktu nyata. */
  todayIso?: string
  selectedDate?: string
}>()

const emit = defineEmits<{ select: [dateIso: string] }>()

const days = computed(() => {
  const start = parseISO(props.weekStart)
  return eachDayOfInterval({ start, end: addDays(start, 6) }).map((date) => {
    const iso = format(date, 'yyyy-MM-dd')
    return {
      iso,
      dayName: format(date, 'EEEE', { locale: localeId }),
      dayNumber: format(date, 'd MMM', { locale: localeId }),
      events: props.events.filter(event => event.date === iso)
    }
  })
})

const weekLabel = computed(() => {
  const start = parseISO(props.weekStart)
  const end = addDays(start, 6)
  return `${format(start, 'd MMM', { locale: localeId })} – ${format(end, 'd MMM yyyy', { locale: localeId })}`
})
</script>

<template>
  <div>
    <p class="mb-3 text-sm font-semibold capitalize text-foreground">
      {{ weekLabel }}
    </p>

    <div class="grid grid-cols-1 gap-3 sm:grid-cols-7">
      <button
        v-for="day in days"
        :key="day.iso"
        type="button"
        :class="cn(
          'group flex flex-col rounded-xl border border-border bg-card p-2.5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md',
          day.iso === props.todayIso && 'border-primary/30 bg-primary/[0.04]',
          props.selectedDate === day.iso && 'ring-2 ring-inset ring-primary'
        )"
        @click="emit('select', day.iso)"
      >
        <div class="mb-2 flex items-center justify-between gap-1">
          <span class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{{ day.dayName }}</span>
          <span
            :class="cn(
              'inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-[11px] transition-colors',
              day.iso === props.todayIso ? 'bg-primary text-primary-foreground font-semibold shadow-sm' : 'text-foreground group-hover:bg-muted'
            )"
          >
            {{ day.dayNumber.split(' ')[0] }}
          </span>
        </div>

        <ul v-if="day.events.length" class="space-y-1">
          <li v-for="event in day.events" :key="event.id" class="flex items-start gap-1.5">
            <span :class="cn('mt-1 h-1.5 w-1.5 shrink-0 rounded-full', TONE_DOT[event.tone] ?? 'bg-muted-foreground')" />
            <span class="min-w-0 flex-1 truncate text-[11px] leading-tight text-foreground" :title="event.title">
              <span v-if="event.time" class="tabular-nums text-muted-foreground">{{ event.time }} · </span>{{ event.title }}
            </span>
          </li>
        </ul>
        <p v-else class="text-[11px] text-muted-foreground/70">
          Tidak ada jadwal
        </p>
      </button>
    </div>
  </div>
</template>
