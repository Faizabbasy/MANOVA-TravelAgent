<script setup lang="ts">
import { computed } from 'vue'
import { format, parseISO } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { CalendarDays } from 'lucide-vue-next'
import { cn } from '~/lib/utils'
import { TONE_DOT, type ScheduleEvent } from '~/composables/useScheduleEvents'

const props = defineProps<{
  /** Tanggal yang ditampilkan, format `YYYY-MM-DD`. */
  date: string
  /** Seluruh event terfilter (belum di-scope ke `date`) — komponen ini yang menyaring sendiri, pola sama `CalendarMonthGrid`. */
  events: ScheduleEvent[]
}>()

const dayLabel = computed(() => format(parseISO(props.date), 'EEEE, d MMMM yyyy', { locale: localeId }))

/** Event date-only (flight/transport/mice/itinerary tanpa jam valid, atau kind lain yang memang tidak punya jam sama sekali) — bucket "Sepanjang Hari" di atas, bukan dipaksa masuk jam tertentu. */
const allDayEvents = computed(() => props.events.filter(event => event.date === props.date && !event.time))

/**
 * Grup event yang punya jam, per jam (urut ascending) — hanya jam yang benar-benar ada event yang dirender
 * (bukan 24 baris kosong) supaya tetap padat, konsisten prinsip "tidak ada ruang kosong" yang sudah dipakai
 * di seluruh redesign kalender/project detail sebelumnya.
 */
const hourGroups = computed(() => {
  const withTime = props.events.filter(event => event.date === props.date && event.time)
  const byHour = new Map<string, ScheduleEvent[]>()
  for (const event of withTime) {
    const hour = event.time!.slice(0, 2) + ':00'
    if (!byHour.has(hour)) { byHour.set(hour, []) }
    byHour.get(hour)!.push(event)
  }
  return [...byHour.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([hour, hourEvents]) => ({ hour, events: hourEvents.sort((a, b) => (a.time ?? '').localeCompare(b.time ?? '')) }))
})

const hasAnyEvent = computed(() => allDayEvents.value.length > 0 || hourGroups.value.length > 0)
</script>

<template>
  <div>
    <p class="mb-3 text-sm font-semibold capitalize text-foreground">
      {{ dayLabel }}
    </p>

    <div v-if="hasAnyEvent" class="space-y-5">
      <div v-if="allDayEvents.length">
        <p class="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Sepanjang Hari
        </p>
        <ul class="space-y-1.5">
          <li
            v-for="event in allDayEvents"
            :key="event.id"
            class="flex items-start gap-2.5 rounded-xl border border-border bg-card px-3 py-2.5 shadow-sm transition-shadow hover:shadow-md"
          >
            <span :class="cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', TONE_DOT[event.tone] ?? 'bg-muted-foreground')" />
            <div class="min-w-0">
              <p class="truncate text-sm font-medium text-foreground">
                {{ event.title }}
              </p>
              <p v-if="event.detail" class="truncate text-xs text-muted-foreground">
                {{ event.detail }}
              </p>
            </div>
          </li>
        </ul>
      </div>

      <div v-for="group in hourGroups" :key="group.hour" class="flex gap-3">
        <div class="flex w-14 shrink-0 flex-col items-end pt-1.5">
          <span class="text-xs font-semibold tabular-nums text-foreground">{{ group.hour }}</span>
        </div>
        <div class="relative min-w-0 flex-1 pl-4">
          <span class="absolute inset-y-0 left-0 w-px bg-border" />
          <span class="absolute left-0 top-2 h-1.5 w-1.5 -translate-x-[3px] rounded-full bg-primary" />
          <ul class="min-w-0 space-y-1.5 pb-1">
            <li
              v-for="event in group.events"
              :key="event.id"
              class="flex items-start gap-2.5 rounded-xl border border-border bg-card px-3 py-2.5 shadow-sm transition-shadow hover:shadow-md"
              :class="event.isAttention && 'border-destructive/40 bg-destructive/5'"
            >
              <span :class="cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', TONE_DOT[event.tone] ?? 'bg-muted-foreground')" />
              <div class="min-w-0">
                <p class="truncate text-sm font-medium text-foreground">
                  {{ event.title }}
                </p>
                <p v-if="event.detail" class="truncate text-xs text-muted-foreground">
                  {{ event.detail }}
                </p>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </div>

    <EmptyState v-else :icon="CalendarDays" title="Tidak ada jadwal" description="Tidak ada jadwal pada hari ini." />
  </div>
</template>
