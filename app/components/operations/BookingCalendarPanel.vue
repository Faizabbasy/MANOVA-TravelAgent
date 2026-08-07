<script setup lang="ts">
import { computed, ref } from 'vue'
import { format, addMonths, parseISO } from 'date-fns'
import { ChevronLeft, ChevronRight, CalendarDays, AlertTriangle, MapPin } from 'lucide-vue-next'
import { cn } from '~/lib/utils'
import { useScheduleEvents, SCHEDULE_KIND_META, type ScheduleEventKind } from '~/composables/useScheduleEvents'
import { PLANNING_PINS, getPinsByProject, createPlanningPin, removePlanningPin } from '~/data/geo'
import { PROJECTS, getProjectById } from '~/data'
import { formatDate } from '~/utils/format'
import { DEMO_REFERENCE_DATE } from '~/utils/attention'

/** Tab "Calendar" — Menu Operations > Booking & Schedule (Penyederhanaan 7-Role/Menu). Dulu
 * `/operations/calendar`, kini tab dalam satu menu bersama Bookings/Exceptions — logika tidak diubah. */

const { canView, can } = usePermissions()
const { showToast } = useToast()

const hasAccess = computed(() => canView('operations'))
const canManage = computed(() => can('project-order.manage-operations'))

const { events } = useScheduleEvents()

const refreshKey = ref(0)
const innerTab = ref<'calendar' | 'map'>('calendar')
const month = ref(DEMO_REFERENCE_DATE.slice(0, 7))
const selectedDate = ref(DEMO_REFERENCE_DATE)
const kindFilter = ref<'all' | ScheduleEventKind>('all')

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

function shiftMonth (offset: number) {
  month.value = format(addMonths(parseISO(`${month.value}-01`), offset), 'yyyy-MM')
}

/* Map perencanaan */
const mapProjectId = ref<'all' | string>('all')
const mapPins = computed(() => {
  void refreshKey.value
  return mapProjectId.value === 'all' ? [...PLANNING_PINS] : getPinsByProject(mapProjectId.value)
})

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
      <div
        v-if="attentionEvents.length"
        class="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 flex gap-2"
      >
        <AlertTriangle class="h-4 w-4 text-destructive shrink-0 mt-0.5" />
        <div>
          <p class="text-sm font-medium text-foreground">
            {{ attentionEvents.length }} jadwal butuh perhatian
          </p>
          <p class="text-xs text-muted-foreground mt-0.5">
            Milestone terlambat dan maintenance yang sudah melewati jadwalnya ditandai merah di kalender.
          </p>
        </div>
      </div>

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
            <div class="flex items-center gap-2">
              <Button variant="outline" size="sm" @click="shiftMonth(-1)">
                <ChevronLeft class="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" @click="month = DEMO_REFERENCE_DATE.slice(0, 7)">
                Hari Ini
              </Button>
              <Button variant="outline" size="sm" @click="shiftMonth(1)">
                <ChevronRight class="h-4 w-4" />
              </Button>
            </div>

            <select v-model="kindFilter" class="appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
              <option value="all">
                Semua Jenis Jadwal
              </option>
              <option v-for="entry in kindCounts" :key="entry.kind" :value="entry.kind">
                {{ entry.meta.label }} ({{ entry.count }})
              </option>
            </select>
          </div>

          <div class="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
            <SectionCard class="xl:col-span-8">
              <CalendarMonthGrid
                :month="month"
                :events="filteredEvents"
                :today-iso="DEMO_REFERENCE_DATE"
                :selected-date="selectedDate"
                @select="value => selectedDate = value"
              />

              <div class="flex flex-wrap gap-x-4 gap-y-1.5 mt-4 pt-4 border-t border-border">
                <span v-for="entry in kindCounts.filter(item => item.count)" :key="entry.kind" class="flex items-center gap-1.5">
                  <span
                    :class="cn('h-2 w-2 rounded-full', {
                      'bg-primary': entry.meta.tone === 'primary',
                      'bg-success': entry.meta.tone === 'success',
                      'bg-warning': entry.meta.tone === 'warning',
                      'bg-destructive': entry.meta.tone === 'destructive',
                      'bg-chart-5': entry.meta.tone === 'info',
                      'bg-chart-4': entry.meta.tone === 'purple',
                      'bg-muted-foreground': entry.meta.tone === 'neutral'
                    })"
                  />
                  <span class="text-xs text-muted-foreground">{{ entry.meta.label }} ({{ entry.count }})</span>
                </span>
              </div>
            </SectionCard>

            <SectionCard class="xl:col-span-4" :title="formatDate(selectedDate)" :description="`${selectedEvents.length} jadwal pada tanggal ini.`">
              <ul v-if="selectedEvents.length" class="space-y-2.5">
                <li
                  v-for="event in selectedEvents"
                  :key="event.id"
                  class="rounded-lg border px-3 py-2.5"
                  :class="event.isAttention ? 'border-destructive/40 bg-destructive/5' : 'border-border'"
                >
                  <div class="flex items-start gap-2">
                    <div class="min-w-0 flex-1">
                      <p class="text-sm font-medium text-foreground">
                        {{ event.title }}
                      </p>
                      <p v-if="event.detail" class="text-xs text-muted-foreground mt-0.5">
                        {{ event.detail }}
                      </p>
                    </div>
                    <StatusBadge :label="SCHEDULE_KIND_META[event.kind].label" :tone="event.tone" />
                  </div>
                  <NuxtLink
                    v-if="event.projectId"
                    :to="`/project-orders/${event.projectId}`"
                    class="inline-block mt-1.5 text-xs text-primary hover:underline"
                  >
                    {{ getProjectById(event.projectId)?.name ?? event.projectId }} →
                  </NuxtLink>
                </li>
              </ul>

              <EmptyState v-else :icon="CalendarDays" title="Tidak ada jadwal" description="Pilih tanggal lain pada kalender." />
            </SectionCard>
          </div>
        </TabsContent>

        <TabsContent value="map" class="pt-4 space-y-4">
          <div class="flex flex-wrap items-center gap-3">
            <select v-model="mapProjectId" class="appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
              <option value="all">
                Semua Project
              </option>
              <option v-for="project in PROJECTS" :key="project.id" :value="project.id">
                {{ project.name }}
              </option>
            </select>
            <p class="text-xs text-muted-foreground">
              Pin yang dibuat saat satu project dipilih otomatis tertaut ke project tersebut.
            </p>
          </div>

          <SectionCard>
            <div class="flex items-center gap-2 mb-3">
              <MapPin class="h-4 w-4 text-muted-foreground" />
              <h3 class="text-base font-semibold text-foreground">
                Perencanaan Lokasi
              </h3>
            </div>

            <RegionMapPicker
              :pins="mapPins"
              :can-manage="canManage"
              @add="onAddPin"
              @remove="onRemovePin"
            />
          </SectionCard>
        </TabsContent>
      </Tabs>
    </template>
  </div>
</template>
