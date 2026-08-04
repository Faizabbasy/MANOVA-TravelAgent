<script setup lang="ts">
import { computed } from 'vue'
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, format, isSameMonth, parseISO } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { cn } from '~/lib/utils'
import type { ScheduleEvent } from '~/composables/useScheduleEvents'

const props = withDefaults(defineProps<{
  /** Bulan yang ditampilkan, format `YYYY-MM`. */
  month: string
  events: ScheduleEvent[]
  /** Tanggal yang disorot sebagai "hari ini" — memakai tanggal acuan demo, bukan waktu nyata. */
  todayIso?: string
  selectedDate?: string
  maxPerDay?: number
}>(), { maxPerDay: 3 })

const emit = defineEmits<{ select: [dateIso: string] }>()

/**
 * Grid bulanan ditulis tangan dengan date-fns — primitif `Calendar` dari shadcn belum terpasang di repo
 * ini, dan menambahkannya hanya untuk tampilan bulanan read-only tidak sepadan.
 */
const days = computed(() => {
  const anchor = parseISO(`${props.month}-01`)
  return eachDayOfInterval({
    start: startOfWeek(startOfMonth(anchor), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(anchor), { weekStartsOn: 1 })
  }).map((date) => {
    const iso = format(date, 'yyyy-MM-dd')
    return {
      iso,
      dayNumber: format(date, 'd'),
      isCurrentMonth: isSameMonth(date, anchor),
      events: props.events.filter(event => event.date === iso)
    }
  })
})

const WEEKDAYS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']

const TONE_DOT: Record<string, string> = {
  neutral: 'bg-muted-foreground',
  primary: 'bg-primary',
  success: 'bg-success',
  warning: 'bg-warning',
  destructive: 'bg-destructive',
  info: 'bg-chart-5',
  purple: 'bg-chart-4'
}

const monthLabel = computed(() => format(parseISO(`${props.month}-01`), 'MMMM yyyy', { locale: localeId }))
</script>

<template>
  <div>
    <p class="text-sm font-semibold text-foreground mb-3 capitalize">
      {{ monthLabel }}
    </p>

    <div class="grid grid-cols-7 gap-px rounded-lg overflow-hidden border border-border bg-border">
      <div
        v-for="weekday in WEEKDAYS"
        :key="weekday"
        class="bg-muted/60 px-2 py-1.5 text-center text-xs font-medium text-muted-foreground"
      >
        {{ weekday }}
      </div>

      <button
        v-for="day in days"
        :key="day.iso"
        type="button"
        :class="cn(
          'bg-card min-h-[92px] p-1.5 text-left align-top transition-colors hover:bg-muted/40',
          !day.isCurrentMonth && 'bg-muted/20',
          props.selectedDate === day.iso && 'ring-2 ring-inset ring-primary'
        )"
        @click="emit('select', day.iso)"
      >
        <span
          :class="cn(
            'inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs',
            day.iso === props.todayIso ? 'bg-primary text-primary-foreground font-semibold' : day.isCurrentMonth ? 'text-foreground' : 'text-muted-foreground'
          )"
        >
          {{ day.dayNumber }}
        </span>

        <ul class="mt-1 space-y-0.5">
          <li
            v-for="event in day.events.slice(0, props.maxPerDay)"
            :key="event.id"
            class="flex items-center gap-1"
          >
            <span :class="cn('h-1.5 w-1.5 rounded-full shrink-0', TONE_DOT[event.tone] ?? 'bg-muted-foreground')" />
            <span class="text-[11px] text-foreground truncate leading-tight" :title="event.title">{{ event.title }}</span>
          </li>
          <li v-if="day.events.length > props.maxPerDay" class="text-[11px] text-muted-foreground pl-2.5">
            +{{ day.events.length - props.maxPerDay }} lainnya
          </li>
        </ul>
      </button>
    </div>
  </div>
</template>
