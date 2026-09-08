<script setup lang="ts">
import { computed, ref } from 'vue'
import { format, addMonths, addDays, addWeeks, startOfWeek, eachDayOfInterval, parseISO } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, ChevronDown, CalendarDays, AlertTriangle, CalendarClock, CalendarRange, Plus } from 'lucide-vue-next'
import { cn } from '~/lib/utils'
import { useScheduleEvents, SCHEDULE_KIND_META, TONE_DOT, type ScheduleEventKind, type ScheduleEvent } from '~/composables/useScheduleEvents'
import { formatDate } from '~/utils/format'

/**
 * Tab "Kalender" — Project Order detail. Reuse penuh `useScheduleEvents()` (Booking Calendar, Menu
 * Operations) di-filter ke `projectId` project ini saja — TIDAK memperkenalkan entitas jadwal baru, sama
 * seperti kalender global `/calendar` (lihat komentar desain di `useScheduleEvents.ts`). "Tambah Jadwal"
 * di sini mengarah ke Itinerary Item (satu-satunya jenis jadwal yang memang dirancang untuk diisi manual)
 * lewat emit `add`, ditangani parent (Sheet "Tambah Itinerary" yang sama dengan tab Itinerary & Services).
 */
const props = defineProps<{
  projectId: string
  defaultDate: string
}>()

const emit = defineEmits<{ add: [dateIso: string] }>()

const { events } = useScheduleEvents()
const projectEvents = computed(() => events.value.filter(event => event.projectId === props.projectId))

const viewMode = ref<'day' | 'week' | 'month'>('month')
const month = ref(props.defaultDate.slice(0, 7))
const selectedDate = ref(props.defaultDate)
const kindFilter = ref<'all' | ScheduleEventKind>('all')

const VIEW_MODES: { value: 'day' | 'week' | 'month'; label: string; icon: typeof CalendarDays }[] = [
  { value: 'day', label: 'Hari', icon: CalendarClock },
  { value: 'week', label: 'Minggu', icon: CalendarRange },
  { value: 'month', label: 'Bulan', icon: CalendarDays }
]

const filteredEvents = computed(() =>
  (kindFilter.value === 'all' ? projectEvents.value : projectEvents.value.filter(event => event.kind === kindFilter.value)))

const monthEvents = computed(() => filteredEvents.value.filter(event => event.date.startsWith(month.value)))
const selectedEvents = computed(() => filteredEvents.value.filter(event => event.date === selectedDate.value))
const attentionEvents = computed(() => projectEvents.value.filter(event => event.isAttention))

const kindCounts = computed(() => (Object.keys(SCHEDULE_KIND_META) as ScheduleEventKind[])
  .map(kind => ({ kind, meta: SCHEDULE_KIND_META[kind], count: monthEvents.value.filter(event => event.kind === kind).length }))
  .filter(entry => entry.count > 0 || kindFilter.value === entry.kind))

const weekStart = computed(() => format(startOfWeek(parseISO(selectedDate.value), { weekStartsOn: 1 }), 'yyyy-MM-dd'))

/** Jadwal seminggu digrup per hari untuk daftar sisi kanan — hanya hari yang benar-benar ada jadwal, urut tanggal lalu jam. Pola sama `BookingCalendarPanel.vue`. */
const weekDayGroups = computed(() => {
  const start = parseISO(weekStart.value)
  return eachDayOfInterval({ start, end: addDays(start, 6) })
    .map((date) => {
      const iso = format(date, 'yyyy-MM-dd')
      return {
        iso,
        label: format(date, 'EEEE, d MMM', { locale: localeId }),
        events: filteredEvents.value.filter(event => event.date === iso).sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''))
      }
    })
    .filter(day => day.events.length > 0)
})

const monthDayGroups = computed(() => {
  const byDate = new Map<string, ScheduleEvent[]>()
  for (const event of monthEvents.value) {
    if (!byDate.has(event.date)) { byDate.set(event.date, []) }
    byDate.get(event.date)!.push(event)
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, dayEvents]) => ({
      iso: date,
      label: format(parseISO(date), 'EEEE, d MMM', { locale: localeId }),
      events: dayEvents.sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''))
    }))
})

const sideDayGroups = computed(() => (viewMode.value === 'week' ? weekDayGroups.value : monthDayGroups.value))
const sideEventCount = computed(() => sideDayGroups.value.reduce((total, day) => total + day.events.length, 0))
const sideTitle = computed(() => (viewMode.value === 'week' ? 'Minggu Ini' : 'Bulan Ini'))
const sideRangeNoun = computed(() => (viewMode.value === 'week' ? 'minggu' : 'bulan'))

const collapsedDays = ref(new Set<string>())
function toggleDayCollapsed (iso: string) {
  const next = new Set(collapsedDays.value)
  if (next.has(iso)) { next.delete(iso) } else { next.add(iso) }
  collapsedDays.value = next
}

const rangeLabel = computed(() => {
  if (viewMode.value === 'day') { return format(parseISO(selectedDate.value), 'd MMMM yyyy', { locale: localeId }) }
  if (viewMode.value === 'week') {
    const start = parseISO(weekStart.value)
    return `${format(start, 'd MMM', { locale: localeId })} – ${format(addDays(start, 6), 'd MMM yyyy', { locale: localeId })}`
  }
  return format(parseISO(`${month.value}-01`), 'MMMM yyyy', { locale: localeId })
})

function setViewMode (mode: 'day' | 'week' | 'month') {
  viewMode.value = mode
  selectedDate.value = props.defaultDate
  month.value = props.defaultDate.slice(0, 7)
}

function shiftView (offset: number) {
  if (viewMode.value === 'day') {
    selectedDate.value = format(addDays(parseISO(selectedDate.value), offset), 'yyyy-MM-dd')
    return
  }
  if (viewMode.value === 'week') {
    selectedDate.value = format(addWeeks(parseISO(selectedDate.value), offset), 'yyyy-MM-dd')
    return
  }
  month.value = format(addMonths(parseISO(`${month.value}-01`), offset), 'yyyy-MM')
}

/** Sidebar kanan diukur PERSIS ke tinggi render card kalender kiri lewat `useElementSize` (VueUse) —
 * bukan CSS Grid stretch. CSS-only pendekatan (grid stretch, `min-h-0`+`overflow` di anak) SELALU gagal
 * di kasus ini karena lingkaran setan sizing: tinggi track grid ikut dihitung dari konten TERTINGGI di
 * baris itu (termasuk sidebar kanan sendiri kalau kontennya lebih panjang dari kalender), jadi
 * `height:100%` di kanan cuma "mengikuti" tinggi dirinya sendiri, bukan tinggi kiri. Makanya harus diukur
 * beneran dari DOM kiri via JS lalu dipasang sebagai angka piksel eksplisit di kanan. `useElementSize`
 * reaktif otomatis ke perubahan konten (ganti bulan/minggu, resize window) — dipilih dibanding
 * `ResizeObserver` manual supaya nggak ada celah timing mount/HMR yang bikin observer telat/nggak jalan. */
const calendarCardRef = ref<HTMLElement | null>(null)
const { height: calendarCardHeight } = useElementSize(calendarCardRef)
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="flex flex-wrap items-center gap-3">
        <div class="flex items-center gap-1 rounded-lg border border-border bg-card p-0.5">
          <Button variant="ghost" size="sm" class="h-8 w-8 p-0 text-muted-foreground hover:text-foreground" @click="shiftView(-1)">
            <ChevronLeft class="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" class="h-8 w-8 p-0 text-muted-foreground hover:text-foreground" @click="shiftView(1)">
            <ChevronRight class="h-4 w-4" />
          </Button>
        </div>

        <div class="flex items-center gap-0.5 rounded-lg bg-muted p-0.5">
          <button
            v-for="mode in VIEW_MODES"
            :key="mode.value"
            type="button"
            :class="cn(
              'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all',
              viewMode === mode.value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )"
            @click="setViewMode(mode.value)"
          >
            <component :is="mode.icon" class="h-3.5 w-3.5" />
            {{ mode.label }}
          </button>
        </div>

        <p class="hidden text-sm font-semibold capitalize text-foreground sm:block">
          {{ rangeLabel }}
        </p>

        <select v-model="kindFilter" class="appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
          <option value="all">
            Semua Jenis Jadwal
          </option>
          <option v-for="entry in kindCounts" :key="entry.kind" :value="entry.kind">
            {{ entry.meta.label }} ({{ entry.count }})
          </option>
        </select>
      </div>

      <Button size="sm" @click="emit('add', selectedDate)">
        <Plus class="h-4 w-4 mr-1.5" />Tambah Jadwal
      </Button>
    </div>

    <div class="grid grid-cols-1 items-start xl:grid-cols-12 gap-5">
      <div ref="calendarCardRef" class="xl:col-span-8">
      <SectionCard>
        <CalendarDayView
          v-if="viewMode === 'day'"
          :date="selectedDate"
          :events="filteredEvents"
        />
        <CalendarWeekView
          v-else-if="viewMode === 'week'"
          :week-start="weekStart"
          :events="filteredEvents"
          :today-iso="defaultDate"
          :selected-date="selectedDate"
          @select="value => selectedDate = value"
        />
        <CalendarMonthGrid
          v-else
          :month="month"
          :events="filteredEvents"
          :today-iso="defaultDate"
          :selected-date="selectedDate"
          @select="value => selectedDate = value"
        />

        <div v-if="kindCounts.length" class="flex flex-wrap gap-x-1.5 gap-y-1.5 mt-4 pt-4 border-t border-border">
          <span
            v-for="entry in kindCounts.filter(item => item.count)"
            :key="entry.kind"
            class="flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2.5 py-1"
          >
            <span :class="cn('h-1.5 w-1.5 rounded-full', TONE_DOT[entry.meta.tone] ?? 'bg-muted-foreground')" />
            <span class="text-xs text-muted-foreground">{{ entry.meta.label }} ({{ entry.count }})</span>
          </span>
        </div>
      </SectionCard>
      </div>

      <div
        class="flex flex-col space-y-4 overflow-hidden xl:col-span-4"
        :style="calendarCardHeight ? { height: `${calendarCardHeight}px` } : undefined"
      >
        <SectionCard v-if="attentionEvents.length" compact class="shrink-0">
          <template #header>
            <div class="flex items-center gap-2">
              <AlertTriangle class="h-4 w-4 shrink-0 text-destructive" />
              <div>
                <p class="text-xs font-semibold uppercase tracking-wide text-foreground">
                  Jadwal Butuh Perhatian
                </p>
                <p class="text-xs text-muted-foreground">
                  {{ attentionEvents.length }} jadwal terlambat/melewati tenggat
                </p>
              </div>
            </div>
          </template>
          <ul class="space-y-1.5">
            <li v-for="event in attentionEvents" :key="event.id" class="rounded-md border border-destructive/40 bg-destructive/5 px-2.5 py-1.5">
              <div class="flex items-start justify-between gap-2">
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-medium text-foreground">
                    {{ event.title }}
                  </p>
                  <p class="truncate text-xs text-muted-foreground">
                    <template v-if="event.detail">
                      {{ event.detail }} ·
                    </template>{{ formatDate(event.date) }}
                  </p>
                </div>
                <StatusBadge class="shrink-0" :label="SCHEDULE_KIND_META[event.kind].label" tone="destructive" />
              </div>
            </li>
          </ul>
        </SectionCard>

        <SectionCard
          v-if="viewMode !== 'day'"
          compact
          class="flex min-h-0 flex-1 flex-col"
          content-class="min-h-0 flex-1 overflow-y-auto"
          :title="sideTitle"
          :description="`${sideEventCount} jadwal pada ${sideRangeNoun} ini.`"
        >
          <div v-if="sideDayGroups.length" class="space-y-3">
            <div v-for="day in sideDayGroups" :key="day.iso">
              <button
                type="button"
                class="mb-1 flex w-full items-center gap-1.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground"
                @click="toggleDayCollapsed(day.iso)"
              >
                <ChevronDown class="h-3 w-3 shrink-0 transition-transform" :class="{ '-rotate-90': collapsedDays.has(day.iso) }" />
                {{ day.label }}
                <span class="font-normal normal-case text-muted-foreground/70">({{ day.events.length }})</span>
              </button>
              <ul v-if="!collapsedDays.has(day.iso)" class="space-y-1.5">
                <li
                  v-for="event in day.events"
                  :key="event.id"
                  class="rounded-md border px-2.5 py-1.5"
                  :class="event.isAttention ? 'border-destructive/40 bg-destructive/5' : 'border-border'"
                >
                  <div class="flex items-start justify-between gap-2">
                    <div class="min-w-0 flex-1">
                      <p class="truncate text-sm font-medium text-foreground">
                        <span v-if="event.time" class="font-medium tabular-nums text-muted-foreground">{{ event.time }} · </span>{{ event.title }}
                      </p>
                      <p v-if="event.detail" class="truncate text-xs text-muted-foreground">
                        {{ event.detail }}
                      </p>
                    </div>
                    <StatusBadge class="shrink-0" :label="SCHEDULE_KIND_META[event.kind].label" :tone="event.tone" />
                  </div>
                </li>
              </ul>
            </div>
          </div>
          <EmptyState v-else :icon="CalendarDays" title="Tidak ada jadwal" :description="`Tidak ada jadwal project ini pada ${sideRangeNoun} ini.`" />
        </SectionCard>

        <SectionCard v-else compact class="flex min-h-0 flex-1 flex-col" content-class="min-h-0 flex-1 overflow-y-auto" :title="formatDate(selectedDate)" :description="`${selectedEvents.length} jadwal pada tanggal ini.`">
          <ul v-if="selectedEvents.length" class="space-y-1.5">
            <li
              v-for="event in selectedEvents"
              :key="event.id"
              class="rounded-md border px-2.5 py-1.5"
              :class="event.isAttention ? 'border-destructive/40 bg-destructive/5' : 'border-border'"
            >
              <div class="flex items-start justify-between gap-2">
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-medium text-foreground">
                    <span v-if="event.time" class="font-medium tabular-nums text-muted-foreground">{{ event.time }} · </span>{{ event.title }}
                  </p>
                  <p v-if="event.detail" class="truncate text-xs text-muted-foreground">
                    {{ event.detail }}
                  </p>
                </div>
                <StatusBadge class="shrink-0" :label="SCHEDULE_KIND_META[event.kind].label" :tone="event.tone" />
              </div>
            </li>
          </ul>
          <EmptyState v-else :icon="CalendarDays" title="Tidak ada jadwal" description="Pilih tanggal lain, atau tambahkan jadwal baru." />
        </SectionCard>
      </div>
    </div>
  </div>
</template>
