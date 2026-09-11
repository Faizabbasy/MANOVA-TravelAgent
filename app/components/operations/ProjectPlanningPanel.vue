<script setup lang="ts">
import { computed, ref } from 'vue'
import { MapPin, Search } from 'lucide-vue-next'
import { cn } from '~/lib/utils'
import { PLANNING_PINS, getPinsByProject, createPlanningPin, removePlanningPin } from '~/data/geo'
import { PROJECTS, getProjectById } from '~/data'
import { PROJECT_STATUSES } from '~/constants/status'

/** Menu Operasional > Perencanaan Project (dulu "Perencanaan Peta" — tab dalam satu halaman bareng
 * Kalender, sekarang menu sidebar sendiri per permintaan). Logic/isi TIDAK diubah, cuma dipindah apa
 * adanya dari `BookingCalendarPanel.vue`. */

const { canView, can } = usePermissions()
const { showToast } = useToast()

const hasAccess = computed(() => canView('operations'))
const canManage = computed(() => can('project-order.manage-operations'))

const refreshKey = ref(0)
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
  <div class="space-y-4">
    <RoleAccessState v-if="!hasAccess" module-label="modul Operations & Scheduling" />

    <div v-else class="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
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
  </div>
</template>
