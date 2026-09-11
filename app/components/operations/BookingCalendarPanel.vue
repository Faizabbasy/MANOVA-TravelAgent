<script setup lang="ts">
import { computed, ref } from 'vue'
import { format, addMonths, addDays, addWeeks, startOfWeek, eachDayOfInterval, parseISO } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, ChevronDown, CalendarDays, AlertTriangle, CalendarClock, CalendarRange, Plus } from 'lucide-vue-next'
import { cn } from '~/lib/utils'
import { useScheduleEvents, SCHEDULE_KIND_META, TONE_DOT, type ScheduleEventKind, type ScheduleEvent } from '~/composables/useScheduleEvents'
import { PROJECTS, getProjectById, createItineraryItem } from '~/data'
import { formatDate } from '~/utils/format'
import { DEMO_REFERENCE_DATE } from '~/utils/attention'

/** Menu Operasional > Kalender. Dulu satu halaman bertab bareng "Perencanaan Peta" (`ProjectPlanningPanel`
 * sekarang) — dipisah jadi menu sidebar sendiri-sendiri per permintaan, supaya keduanya independen. */

const { canView, can } = usePermissions()
const { showToast } = useToast()

const hasAccess = computed(() => canView('operations'))
const canManage = computed(() => can('project-order.manage-operations'))

const { events } = useScheduleEvents()

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

/** "Tambah Acara" (menu Kalender, lintas-project) — bikin `ItineraryItem` sama seperti "Tambah Jadwal" di
 * tab Kalender per-project, hanya ditambah pilih Project dulu karena di sini belum ada project context. */
const isAddEventOpen = ref(false)
const addEventForm = ref({ projectId: '', date: '', time: '', title: '', location: '', description: '' })

function openAddEvent () {
  addEventForm.value = { projectId: '', date: selectedDate.value, time: '', title: '', location: '', description: '' }
  isAddEventOpen.value = true
}

function submitAddEvent () {
  if (!addEventForm.value.projectId || !addEventForm.value.date || !addEventForm.value.title.trim()) { return }
  createItineraryItem({
    projectId: addEventForm.value.projectId,
    date: addEventForm.value.date,
    time: addEventForm.value.time.trim() || undefined,
    title: addEventForm.value.title.trim(),
    location: addEventForm.value.location.trim() || undefined,
    description: addEventForm.value.description.trim() || undefined,
    visibleToClient: true
  })
  isAddEventOpen.value = false
  showToast('Jadwal Ditambahkan', `"${addEventForm.value.title}" berhasil dicatat di kalender.`, 'success')
}

/** Klik kotak tanggal di grid Bulan/Minggu buka slide-over kanan berisi SEMUA jadwal tanggal itu sekaligus
 * (bukan satu-satu per item) — pola sama LeadDetailSheet (`components/sales`), disesuaikan jadi list
 * ringkas per jadwal, tiap baris link ke project-nya masing-masing. */
const isDaySheetOpen = ref(false)
const daySheetDate = ref<string | null>(null)
const daySheetEvents = computed(() => (daySheetDate.value ? filteredEvents.value.filter(event => event.date === daySheetDate.value) : []))
function openDaySheet (dateIso: string) {
  selectedDate.value = dateIso
  daySheetDate.value = dateIso
  isDaySheetOpen.value = true
}
const daySheetLabel = computed(() => (daySheetDate.value ? format(parseISO(daySheetDate.value), 'EEEE, d MMMM yyyy', { locale: localeId }) : ''))

/** Klik baris jadwal (yang punya `projectId`) langsung ke detail project-nya. Dulu dicoba lewat
 * `<component :is="event.projectId ? 'NuxtLink' : 'div'">`, tapi resolusi komponen dinamis via string
 * tidak jalan di sini — diganti `@click` + `navigateTo` yang pasti jalan. */
function goToProject (projectId?: string) {
  if (!projectId) { return }
  isDaySheetOpen.value = false
  navigateTo(`/project-orders/${projectId}`)
}
</script>

<template>
  <div class="space-y-4">
    <RoleAccessState v-if="!hasAccess" module-label="modul Operations & Scheduling" />

    <template v-else>
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

        <Sheet v-if="canManage" v-model:open="isAddEventOpen">
          <SheetTrigger as-child>
            <Button size="sm" @click="openAddEvent">
              <Plus class="h-4 w-4 mr-1.5" />Tambah Acara
            </Button>
          </SheetTrigger>
          <SheetContent side="right" class="w-full sm:max-w-lg overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Tambah Acara</SheetTitle>
              <SheetDescription>Jadwal baru untuk salah satu project (itinerary item).</SheetDescription>
            </SheetHeader>
            <div class="space-y-4 py-2">
              <div class="space-y-1.5">
                <Label for="event-project">Project</Label>
                <select id="event-project" v-model="addEventForm.projectId" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                  <option value="" disabled>
                    Pilih project...
                  </option>
                  <option v-for="project in PROJECTS" :key="project.id" :value="project.id">
                    {{ project.name }}
                  </option>
                </select>
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div class="space-y-1.5">
                  <Label for="event-date">Tanggal</Label>
                  <Input id="event-date" v-model="addEventForm.date" type="date" />
                </div>
                <div class="space-y-1.5">
                  <Label for="event-time">Waktu (opsional)</Label>
                  <Input id="event-time" v-model="addEventForm.time" type="time" />
                </div>
              </div>
              <div class="space-y-1.5">
                <Label for="event-title">Judul</Label>
                <Input id="event-title" v-model="addEventForm.title" placeholder="mis. Penjemputan Bandara" />
              </div>
              <div class="space-y-1.5">
                <Label for="event-location">Lokasi (opsional)</Label>
                <Input id="event-location" v-model="addEventForm.location" placeholder="mis. Terminal 3, Bandara Soekarno-Hatta" />
              </div>
              <div class="space-y-1.5">
                <Label for="event-description">Deskripsi (opsional)</Label>
                <textarea id="event-description" v-model="addEventForm.description" rows="3" class="w-full px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
            </div>
            <SheetFooter class="mt-6 flex-row justify-end gap-2">
              <Button variant="outline" @click="isAddEventOpen = false">
                Batal
              </Button>
              <Button :disabled="!addEventForm.projectId || !addEventForm.date || !addEventForm.title.trim()" @click="submitAddEvent">
                Simpan
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
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
              @select="openDaySheet"
            />
            <CalendarMonthGrid
              v-else
              key="month"
              :month="month"
              :events="filteredEvents"
              :today-iso="DEMO_REFERENCE_DATE"
              :selected-date="selectedDate"
              @select="openDaySheet"
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
                <div
                  class="min-w-0 flex-1"
                  :class="event.projectId && 'cursor-pointer hover:underline'"
                  @click="goToProject(event.projectId)"
                >
                  <p class="truncate text-sm font-medium text-foreground">
                    {{ event.title }}
                  </p>
                  <p class="truncate text-xs text-muted-foreground">
                    <template v-if="event.detail">{{ event.detail }} · </template>{{ formatDate(event.date) }}
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
                    <div
                      class="min-w-0 flex-1"
                      :class="event.projectId && 'cursor-pointer hover:underline'"
                      @click="goToProject(event.projectId)"
                    >
                      <p class="truncate text-sm font-medium text-foreground">
                        <span v-if="event.time" class="font-medium tabular-nums text-muted-foreground">{{ event.time }} · </span>{{ event.title }}
                      </p>
                      <p v-if="eventMetaLine(event)" class="truncate text-xs text-muted-foreground">
                        {{ eventMetaLine(event) }}
                      </p>
                    </div>
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
                <div
                  class="min-w-0 flex-1"
                  :class="event.projectId && 'cursor-pointer hover:underline'"
                  @click="goToProject(event.projectId)"
                >
                  <p class="truncate text-sm font-medium text-foreground">
                    <span v-if="event.time" class="font-medium tabular-nums text-muted-foreground">{{ event.time }} · </span>{{ event.title }}
                  </p>
                  <p v-if="eventMetaLine(event)" class="truncate text-xs text-muted-foreground">
                    {{ eventMetaLine(event) }}
                  </p>
                </div>
                <StatusBadge class="shrink-0" :label="SCHEDULE_KIND_META[event.kind].label" :tone="event.tone" />
              </div>
            </li>
          </ul>

          <EmptyState v-else :icon="CalendarDays" title="Tidak ada jadwal" description="Pilih tanggal lain pada kalender." />
        </SectionCard>
        </div>
      </div>

      <Sheet v-model:open="isDaySheetOpen">
        <SheetContent side="right" class="w-full sm:max-w-sm overflow-y-auto">
          <SheetHeader>
            <SheetTitle class="capitalize">
              {{ daySheetLabel }}
            </SheetTitle>
            <SheetDescription>{{ daySheetEvents.length }} jadwal pada tanggal ini.</SheetDescription>
          </SheetHeader>

          <div v-if="daySheetEvents.length" class="mt-4 divide-y divide-border overflow-hidden rounded-lg border border-border">
            <div
              v-for="event in daySheetEvents"
              :key="event.id"
              :class="[
                'flex items-start gap-2 px-3 py-2 transition-colors',
                event.isAttention ? 'bg-destructive/5' : '',
                event.projectId && 'cursor-pointer hover:bg-muted/40'
              ]"
              @click="goToProject(event.projectId)"
            >
              <span :class="cn('mt-1 h-1.5 w-1.5 shrink-0 self-start rounded-full', TONE_DOT[event.tone] ?? 'bg-muted-foreground')" />
              <div class="min-w-0 flex-1 py-0.5">
                <div class="flex items-start gap-1.5">
                  <p class="min-w-0 flex-1 break-words text-xs font-semibold leading-snug text-foreground [overflow-wrap:anywhere]">
                    <span v-if="event.time" class="tabular-nums font-normal text-muted-foreground">{{ event.time }} · </span>{{ event.title }}
                  </p>
                  <AlertTriangle v-if="event.isAttention" class="mt-0.5 h-3 w-3 shrink-0 text-destructive" />
                </div>
                <p class="mt-0.5 break-words text-[11px] leading-snug text-muted-foreground [overflow-wrap:anywhere]">
                  {{ SCHEDULE_KIND_META[event.kind].label }}
                  <template v-if="event.projectId"> · {{ getProjectById(event.projectId)?.name ?? event.projectId }}</template>
                </p>
                <p v-if="event.detail" class="mt-0.5 break-words text-[11px] leading-snug text-muted-foreground [overflow-wrap:anywhere]">
                  {{ event.detail }}
                </p>
              </div>
              <ChevronRight v-if="event.projectId" class="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            </div>
          </div>
          <EmptyState v-else title="Tidak ada jadwal" description="Tidak ada jadwal pada tanggal ini." />
        </SheetContent>
      </Sheet>
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
