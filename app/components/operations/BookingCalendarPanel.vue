<script setup lang="ts">
import { computed, ref } from 'vue'
import { format, addMonths, addDays, addWeeks, startOfWeek, eachDayOfInterval, parseISO } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, ChevronDown, CalendarDays, AlertTriangle, MapPin, CalendarClock, CalendarRange, Search } from 'lucide-vue-next'
import { cn } from '~/lib/utils'
import { useScheduleEvents, SCHEDULE_KIND_META, TONE_DOT, type ScheduleEventKind, type ScheduleEvent } from '~/composables/useScheduleEvents'
import { PLANNING_PINS, getPinsByProject, createPlanningPin, removePlanningPin } from '~/data/geo'
import { PROJECTS, getProjectById } from '~/data'
import { PROJECT_STATUSES } from '~/constants/status'
import { formatDate } from '~/utils/format'
import { DEMO_REFERENCE_DATE } from '~/utils/attention'

/** Menu Operations > Kalender (Penyederhanaan 7-Role/Menu). Dulu `/operations/calendar`, sempat jadi
 * section di `/bookings` bersama Bookings/Exceptions, sekarang halaman tersendiri lagi — logika tidak diubah. */

const { canView, can } = usePermissions()
const { showToast } = useToast()

const hasAccess = computed(() => canView('operations'))
const canManage = computed(() => can('project-order.manage-operations'))

const { events } = useScheduleEvents()

const refreshKey = ref(0)
const innerTab = ref<'calendar' | 'map'>('calendar')
const viewMode = ref<'day' | 'week' | 'month'>('month')
const month = ref(DEMO_REFERENCE_DATE.slice(0, 7))
const selectedDate = ref(DEMO_REFERENCE_DATE)
const kindFilter = ref<'all' | ScheduleEventKind>('all')

const VIEW_MODES: { value: 'day' | 'week' | 'month'; label: string; icon: typeof CalendarDays }[] = [
  { value: 'day', label: 'Hari Ini', icon: CalendarClock },
  { value: 'week', label: 'Minggu Ini', icon: CalendarRange },
  { value: 'month', label: 'Bulan Ini', icon: CalendarDays }
]

const filteredEvents = computed(() =>
  (kindFilter.value === 'all' ? events.value : events.value.filter(event => event.kind === kindFilter.value)))

const monthEvents = computed(() => filteredEvents.value.filter(event => event.date.startsWith(month.value)))
const selectedEvents = computed(() => filteredEvents.value.filter(event => event.date === selectedDate.value))

const attentionEvents = computed(() => events.value.filter(event => event.isAttention))

const kindCounts = computed(() => (Object.keys(SCHEDULE_KIND_META) as ScheduleEventKind[]).map(kind => ({
  kind,
  meta: SCHEDULE_KIND_META[kind],
  count: monthEvents.value.filter(event => event.kind === kind).length
})))

const weekStart = computed(() => format(startOfWeek(parseISO(selectedDate.value), { weekStartsOn: 1 }), 'yyyy-MM-dd'))

/** Jadwal seminggu digrup per hari untuk card detail sisi kanan — hanya hari yang benar-benar ada jadwal, urut tanggal lalu jam. */
const weekDayGroups = computed(() => {
  const start = parseISO(weekStart.value)
  return eachDayOfInterval({ start, end: addDays(start, 6) })
    .map((date) => {
      const iso = format(date, 'yyyy-MM-dd')
      return {
        iso,
        label: format(date, 'EEEE, d MMM', { locale: localeId }),
        events: filteredEvents.value
          .filter(event => event.date === iso)
          .sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''))
      }
    })
    .filter(day => day.events.length > 0)
})

/** Jadwal sebulan digrup per hari untuk card detail sisi kanan — pola sama `weekDayGroups`, hanya hari yang ada jadwal. */
const monthDayGroups = computed(() => {
  const byDate = new Map<string, typeof monthEvents.value>()
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

/** Card detail sisi kanan: Hari -> daftar tunggal tanggal terpilih, Minggu/Bulan -> digrup per hari (hanya hari mode itu, day mode punya card sendiri). */
const sideDayGroups = computed(() => (viewMode.value === 'week' ? weekDayGroups.value : monthDayGroups.value))
const sideEventCount = computed(() => sideDayGroups.value.reduce((total, day) => total + day.events.length, 0))
/** Grup per tanggal (permintaan: "harusnya bisa di collapse") — default terbuka semua, klik header tanggal untuk collapse/expand. Key-nya `day.iso`, di-reset otomatis begitu view/bulan/minggu ganti karena `Set` baru dibuat tiap kali (bukan persist lintas navigasi). */
const collapsedDays = ref(new Set<string>())
function toggleDayCollapsed (iso: string) {
  const next = new Set(collapsedDays.value)
  if (next.has(iso)) { next.delete(iso) } else { next.add(iso) }
  collapsedDays.value = next
}
const sideTitle = computed(() => (viewMode.value === 'week' ? 'Minggu Ini' : 'Bulan Ini'))
const sideRangeNoun = computed(() => (viewMode.value === 'week' ? 'minggu' : 'bulan'))

/** Baris meta ke-2 di card list event (padet, satu baris) — `detail` sumbernya beda-beda per kind
 * (mis. milestone = nama project, maintenance = vendor, itinerary = waktu/lokasi). Nama project ditempel
 * di belakang kalau `detail` BUKAN nama project itu sendiri (mis. milestone), supaya tidak dobel tampil
 * seperti sebelumnya (dulu ada baris link terpisah "Nama Project →" di bawah `detail` yang sering sama persis). */
function eventMetaLine (event: ScheduleEvent): string {
  const projectName = event.projectId ? getProjectById(event.projectId)?.name : undefined
  const parts = [event.detail, projectName && projectName !== event.detail ? projectName : undefined]
  return parts.filter(Boolean).join(' · ')
}

const rangeLabel = computed(() => {
  if (viewMode.value === 'day') { return format(parseISO(selectedDate.value), 'd MMMM yyyy', { locale: localeId }) }
  if (viewMode.value === 'week') {
    const start = parseISO(weekStart.value)
    return `${format(start, 'd MMM', { locale: localeId })} – ${format(addDays(start, 6), 'd MMM yyyy', { locale: localeId })}`
  }
  return format(parseISO(`${month.value}-01`), 'MMMM yyyy', { locale: localeId })
})

/** Set mode kalender + loncat anchor ke hari/minggu/bulan berjalan — pola sama shortcut "Today" di Google Calendar. */
function setViewMode (mode: 'day' | 'week' | 'month') {
  viewMode.value = mode
  selectedDate.value = DEMO_REFERENCE_DATE
  month.value = DEMO_REFERENCE_DATE.slice(0, 7)
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

/* Map perencanaan */
const mapProjectId = ref<'all' | string>('all')
const projectSearch = ref('')

const mapPins = computed(() => {
  void refreshKey.value
  return mapProjectId.value === 'all' ? [...PLANNING_PINS] : getPinsByProject(mapProjectId.value)
})

const plannableProjects = computed(() => PROJECTS.filter(project => project.status !== 'cancelled'))

const filteredProjects = computed(() => {
  const term = projectSearch.value.trim().toLowerCase()
  if (!term) { return plannableProjects.value }
  return plannableProjects.value.filter(project =>
    project.name.toLowerCase().includes(term) || project.destination.toLowerCase().includes(term))
})

/** Titik yang di-"fly to" otomatis oleh peta saat satu project dipilih dari daftar — memakai `destinationGeo` project, terlepas dari pin manual yang sudah/belum dibuat untuk project itu. */
const mapFocusPoint = computed(() => {
  if (mapProjectId.value === 'all') { return undefined }
  const project = getProjectById(mapProjectId.value)
  if (!project?.destinationGeo) { return undefined }
  return { lat: project.destinationGeo.lat, lng: project.destinationGeo.lng, label: `${project.name} — ${project.destination}` }
})

function selectMapProject (projectId: 'all' | string) {
  mapProjectId.value = projectId
}

function onAddPin (payload: { label: string; lat: number; lng: number }) {
  const scoped = mapProjectId.value === 'all' ? undefined : mapProjectId.value
  const order = mapPins.value.length + 1
  createPlanningPin({ ...payload, projectId: scoped, order })
  refreshKey.value += 1
  showToast('Pin ditambahkan', `${payload.label} disematkan di peta perencanaan.`, 'success')
}

function onRemovePin (pinId: string) {
  removePlanningPin(pinId)
  refreshKey.value += 1
}
</script>

<template>
  <div class="space-y-6">
    <RoleAccessState v-if="!hasAccess" module-label="modul Operations & Scheduling" />

    <template v-else>
      <Tabs v-model="innerTab">
        <TabsList>
          <TabsTrigger value="calendar">
            Kalender Jadwal
          </TabsTrigger>
          <TabsTrigger value="map">
            Perencanaan Peta
          </TabsTrigger>
        </TabsList>

        <TabsContent value="calendar" class="pt-4 space-y-4">
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
                    viewMode === mode.value
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
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
          </div>

          <div class="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
            <SectionCard class="xl:col-span-8">
              <Transition name="calendar-fade" mode="out-in">
                <CalendarDayView
                  v-if="viewMode === 'day'"
                  key="day"
                  :date="selectedDate"
                  :events="filteredEvents"
                />
                <CalendarWeekView
                  v-else-if="viewMode === 'week'"
                  key="week"
                  :week-start="weekStart"
                  :events="filteredEvents"
                  :today-iso="DEMO_REFERENCE_DATE"
                  :selected-date="selectedDate"
                  @select="value => selectedDate = value"
                />
                <CalendarMonthGrid
                  v-else
                  key="month"
                  :month="month"
                  :events="filteredEvents"
                  :today-iso="DEMO_REFERENCE_DATE"
                  :selected-date="selectedDate"
                  @select="value => selectedDate = value"
                />
              </Transition>

              <div class="flex flex-wrap gap-x-1.5 gap-y-1.5 mt-4 pt-4 border-t border-border">
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

            <div class="xl:col-span-4 space-y-4 xl:sticky xl:top-4 xl:max-h-[calc(100vh-6rem)] xl:overflow-y-auto xl:pr-1">
            <SectionCard v-if="attentionEvents.length" compact contentClass="max-h-56 overflow-y-auto">
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
                <li
                  v-for="event in attentionEvents"
                  :key="event.id"
                  class="rounded-md border border-destructive/40 bg-destructive/5 px-2.5 py-1.5"
                >
                  <div class="flex items-start justify-between gap-2">
                    <component :is="event.projectId ? 'NuxtLink' : 'div'" :to="event.projectId ? `/project-orders/${event.projectId}` : undefined" class="min-w-0 flex-1" :class="event.projectId && 'hover:underline'">
                      <p class="truncate text-sm font-medium text-foreground">
                        {{ event.title }}
                      </p>
                      <p class="truncate text-xs text-muted-foreground">
                        <template v-if="event.detail">{{ event.detail }} · </template>{{ formatDate(event.date) }}
                      </p>
                    </component>
                    <StatusBadge class="shrink-0" :label="SCHEDULE_KIND_META[event.kind].label" tone="destructive" />
                  </div>
                </li>
              </ul>
            </SectionCard>

            <SectionCard
              v-if="viewMode !== 'day'"
              compact
              contentClass="max-h-[calc(100vh-22rem)] overflow-y-auto"
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
                        <component :is="event.projectId ? 'NuxtLink' : 'div'" :to="event.projectId ? `/project-orders/${event.projectId}` : undefined" class="min-w-0 flex-1" :class="event.projectId && 'hover:underline'">
                          <p class="truncate text-sm font-medium text-foreground">
                            <span v-if="event.time" class="font-medium tabular-nums text-muted-foreground">{{ event.time }} · </span>{{ event.title }}
                          </p>
                          <p v-if="eventMetaLine(event)" class="truncate text-xs text-muted-foreground">
                            {{ eventMetaLine(event) }}
                          </p>
                        </component>
                        <StatusBadge class="shrink-0" :label="SCHEDULE_KIND_META[event.kind].label" :tone="event.tone" />
                      </div>
                    </li>
                  </ul>
                </div>
              </div>

              <EmptyState v-else :icon="CalendarDays" title="Tidak ada jadwal" :description="`Tidak ada jadwal pada ${sideRangeNoun} ini.`" />
            </SectionCard>

            <SectionCard v-else compact :title="formatDate(selectedDate)" :description="`${selectedEvents.length} jadwal pada tanggal ini.`">
              <ul v-if="selectedEvents.length" class="space-y-1.5">
                <li
                  v-for="event in selectedEvents"
                  :key="event.id"
                  class="rounded-md border px-2.5 py-1.5"
                  :class="event.isAttention ? 'border-destructive/40 bg-destructive/5' : 'border-border'"
                >
                  <div class="flex items-start justify-between gap-2">
                    <component :is="event.projectId ? 'NuxtLink' : 'div'" :to="event.projectId ? `/project-orders/${event.projectId}` : undefined" class="min-w-0 flex-1" :class="event.projectId && 'hover:underline'">
                      <p class="truncate text-sm font-medium text-foreground">
                        <span v-if="event.time" class="font-medium tabular-nums text-muted-foreground">{{ event.time }} · </span>{{ event.title }}
                      </p>
                      <p v-if="eventMetaLine(event)" class="truncate text-xs text-muted-foreground">
                        {{ eventMetaLine(event) }}
                      </p>
                    </component>
                    <StatusBadge class="shrink-0" :label="SCHEDULE_KIND_META[event.kind].label" :tone="event.tone" />
                  </div>
                </li>
              </ul>

              <EmptyState v-else :icon="CalendarDays" title="Tidak ada jadwal" description="Pilih tanggal lain pada kalender." />
            </SectionCard>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="map" class="pt-4">
          <div class="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
            <SectionCard class="xl:col-span-4">
              <div class="relative mb-3">
                <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input v-model="projectSearch" placeholder="Cari project atau destinasi..." class="pl-9" />
              </div>

              <div class="space-y-1 max-h-[420px] overflow-y-auto -mr-1 pr-1">
                <button
                  type="button"
                  :class="cn(
                    'w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors',
                    mapProjectId === 'all' ? 'bg-primary/10 ring-1 ring-inset ring-primary/30' : 'hover:bg-muted/40'
                  )"
                  @click="selectMapProject('all')"
                >
                  <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <MapPin class="h-4 w-4" />
                  </span>
                  <span class="min-w-0 flex-1">
                    <span class="block text-sm font-medium text-foreground">Semua Project</span>
                    <span class="block text-xs text-muted-foreground">{{ PLANNING_PINS.length }} titik tersimpan</span>
                  </span>
                </button>

                <button
                  v-for="project in filteredProjects"
                  :key="project.id"
                  type="button"
                  :class="cn(
                    'w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors',
                    mapProjectId === project.id ? 'bg-primary/10 ring-1 ring-inset ring-primary/30' : 'hover:bg-muted/40'
                  )"
                  @click="selectMapProject(project.id)"
                >
                  <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground">
                    {{ project.name.slice(0, 1) }}
                  </span>
                  <span class="min-w-0 flex-1">
                    <span class="block text-sm font-medium text-foreground truncate">{{ project.name }}</span>
                    <span class="block text-xs text-muted-foreground truncate">{{ project.destination }}</span>
                  </span>
                  <StatusBadge
                    class="shrink-0"
                    :label="PROJECT_STATUSES.find(option => option.value === project.status)?.label ?? project.status"
                    :tone="PROJECT_STATUSES.find(option => option.value === project.status)?.tone ?? 'neutral'"
                  />
                </button>

                <EmptyState v-if="!filteredProjects.length" :icon="Search" title="Tidak ditemukan" description="Coba kata kunci lain." />
              </div>

              <p class="mt-3 pt-3 border-t border-border text-[11px] text-muted-foreground">
                Klik project untuk fokuskan peta ke destinasinya. Pin yang dibuat saat satu project dipilih otomatis tertaut ke project tersebut.
              </p>
            </SectionCard>

            <SectionCard class="xl:col-span-8">
              <div class="flex items-center gap-2 mb-3">
                <MapPin class="h-4 w-4 text-muted-foreground" />
                <h3 class="text-base font-semibold text-foreground">
                  Perencanaan Lokasi
                </h3>
              </div>

              <RegionMapPicker
                :pins="mapPins"
                :can-manage="canManage"
                :focus-point="mapFocusPoint"
                @add="onAddPin"
                @remove="onRemovePin"
              />
            </SectionCard>
          </div>
        </TabsContent>
      </Tabs>
    </template>
  </div>
</template>

<style scoped>
.calendar-fade-enter-active,
.calendar-fade-leave-active {
  transition: opacity 0.15s ease;
}
.calendar-fade-enter-from,
.calendar-fade-leave-to {
  opacity: 0;
}
</style>
