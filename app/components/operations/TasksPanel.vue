<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { SortableEvent } from 'vue-draggable-plus'
import { VueDraggable } from 'vue-draggable-plus'
import { AlertTriangle, Calendar, CheckCircle2, CircleDashed, Clock, GripVertical, LayoutGrid, List as ListIcon, Lock, Plus, Search, UserRound } from 'lucide-vue-next'
import { PROJECTS, USERS, getProjectById, getUserById, updateProjectTask, createProjectTask } from '~/data'
import { TASKS } from '~/data/activity'
import { TASK_STATUSES, findStatusOption } from '~/constants/status'
import { formatDate } from '~/utils/format'
import type { ProjectTask } from '~/types/activity'

/** Menu sidebar "Tugas" — Kanban board lintas SEMUA project (data sudah global, `TASKS`, tidak ada entity
 * baru), pola sama "Tasks Kanban Board" per-project (`project-orders/[id]/index.vue`) tapi status diubah
 * lewat drag-and-drop (bukan dropdown) dan setiap kartu menyebut nama project-nya sendiri karena lintas
 * project. Persist status lewat `updateProjectTask` yang sudah ada (bukan mutator baru). */

const { can } = usePermissions()
const canManage = computed(() => can('project-order.manage-operations'))

function initials (name?: string): string {
  if (!name?.trim()) { return '—' }
  return name.trim().slice(0, 2).toUpperCase()
}

/** Warna kolom (header bar + body tint + dashed drop-zone) per status — tone konsisten sama badge status
 * lain di app (info=biru/Berlangsung, warning=oranye/Menunggu Review, success=hijau/Selesai,
 * destructive=merah/Overdue), bukan warna baru. */
const COLUMN_TONE_CLASSES: Record<string, { dot: string; headerText: string; column: string; dash: string }> = {
  'not-started': { dot: 'bg-muted-foreground', headerText: 'text-foreground', column: 'bg-foreground/[0.07]', dash: 'border-border' },
  'in-progress': { dot: 'bg-chart-5', headerText: 'text-chart-5', column: 'bg-chart-5/10', dash: 'border-chart-5/30' },
  'pending-confirmation': { dot: 'bg-warning', headerText: 'text-warning', column: 'bg-warning/10', dash: 'border-warning/40' },
  done: { dot: 'bg-success', headerText: 'text-success', column: 'bg-success/10', dash: 'border-success/30' },
  overdue: { dot: 'bg-destructive', headerText: 'text-destructive', column: 'bg-destructive/10', dash: 'border-destructive/30' }
}

const projectFilter = ref<'all' | string>('all')
const projectsWithTasks = computed(() => {
  const ids = new Set(TASKS.map(task => task.projectId))
  return PROJECTS.filter(project => ids.has(project.id))
})

const searchQuery = ref('')
const viewMode = ref<'kanban' | 'table'>('kanban')

const filteredTasks = computed(() => TASKS
  .filter(task => projectFilter.value === 'all' || task.projectId === projectFilter.value)
  .filter(task => !searchQuery.value.trim() || task.title.toLowerCase().includes(searchQuery.value.trim().toLowerCase())))

const totalCount = computed(() => filteredTasks.value.length)
const inProgressCount = computed(() => filteredTasks.value.filter(task => task.status === 'in-progress').length)
const overdueCount = computed(() => filteredTasks.value.filter(task => task.status === 'overdue').length)
const doneCount = computed(() => filteredTasks.value.filter(task => task.status === 'done').length)

/** Salinan lokal per kolom untuk `VueDraggable` (butuh array yang bisa dia mutasi langsung sewaktu drag).
 * Sumber kebenaran tetap `TASKS` — disinkronkan ulang setiap kali `filteredTasks` berubah (termasuk
 * setelah drag men-trigger `updateProjectTask`), jadi urutan dalam kolom tidak pernah dianggap permanen. */
const boardColumns = ref<Record<string, ProjectTask[]>>({})
function syncBoardColumns () {
  const map: Record<string, ProjectTask[]> = {}
  for (const status of TASK_STATUSES) { map[status.value] = [] }
  for (const task of filteredTasks.value) { map[task.status]?.push(task) }
  boardColumns.value = map
}
watch(filteredTasks, syncBoardColumns, { immediate: true, deep: true })

function onDragEnd (event: SortableEvent, targetStatus: ProjectTask['status']) {
  const taskId = (event.item as HTMLElement).dataset.taskId
  if (!taskId) { return }
  const task = TASKS.find(item => item.id === taskId)
  if (!task || task.status === targetStatus) { return }
  updateProjectTask(taskId, { status: targetStatus })
}

/** "Tambah Tugas" (global) — `projectId` opsional (beda dari "Tambah Task" per-project yang selalu terikat
 * satu project): task tanpa project itu murni tugas umum, tidak tertaut/tidak muncul di board manapun
 * selain di sini. Reuse `createProjectTask` yang sudah ada (bukan mutator baru). */
const isFormOpen = ref(false)
const form = ref({ title: '', projectId: '', dueAt: '', assignedTo: '' })

function openForm () {
  form.value = { title: '', projectId: '', dueAt: '', assignedTo: '' }
  isFormOpen.value = true
}

function submitForm () {
  if (!form.value.title.trim()) { return }
  createProjectTask({
    projectId: form.value.projectId || undefined,
    title: form.value.title.trim(),
    dueAt: form.value.dueAt || undefined,
    assignedTo: form.value.assignedTo || undefined
  })
  isFormOpen.value = false
}
</script>

<template>
  <div class="space-y-4">
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <StatsCard title="Total Tugas" :value="String(totalCount)" :icon="ListIcon" />
      <StatsCard title="Sedang Berlangsung" :value="String(inProgressCount)" :icon="CircleDashed" icon-color="primary" />
      <StatsCard title="Terlambat" :value="String(overdueCount)" :icon="AlertTriangle" icon-color="destructive" />
      <StatsCard title="Selesai" :value="String(doneCount)" :icon="CheckCircle2" icon-color="success" />
    </div>

    <div class="flex flex-col lg:flex-row lg:items-center gap-3">
      <div class="relative flex-1 w-full">
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input v-model="searchQuery" placeholder="Cari judul tugas..." class="pl-9" />
      </div>

      <select v-model="projectFilter" class="appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
        <option value="all">
          Semua Project
        </option>
        <option v-for="project in projectsWithTasks" :key="project.id" :value="project.id">
          {{ project.name }}
        </option>
      </select>

      <div class="flex items-center gap-1 rounded-lg border border-border p-0.5">
        <Button :variant="viewMode === 'table' ? 'secondary' : 'ghost'" size="sm" @click="viewMode = 'table'">
          <ListIcon class="h-4 w-4" />
        </Button>
        <Button :variant="viewMode === 'kanban' ? 'secondary' : 'ghost'" size="sm" @click="viewMode = 'kanban'">
          <LayoutGrid class="h-4 w-4" />
        </Button>
      </div>

      <Sheet v-if="canManage" v-model:open="isFormOpen">
        <SheetTrigger as-child>
          <Button size="sm" @click="openForm">
            <Plus class="h-4 w-4 mr-1.5" />Tambah Tugas
          </Button>
        </SheetTrigger>
        <SheetContent side="right" class="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Tambah Tugas</SheetTitle>
            <SheetDescription>Project opsional — kosongkan kalau ini tugas umum, tidak terkait project tertentu.</SheetDescription>
          </SheetHeader>
          <div class="space-y-4 py-2">
            <div class="space-y-1.5">
              <Label for="task-title">Judul</Label>
              <Input id="task-title" v-model="form.title" placeholder="mis. Follow-up pembayaran termin" />
            </div>
            <div class="space-y-1.5">
              <Label for="task-project">Project (opsional)</Label>
              <select id="task-project" v-model="form.projectId" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                <option value="">
                  Tidak terkait project tertentu
                </option>
                <option v-for="project in PROJECTS" :key="project.id" :value="project.id">
                  {{ project.name }}
                </option>
              </select>
            </div>
            <div class="space-y-1.5">
              <Label for="task-due">Due Date (opsional)</Label>
              <Input id="task-due" v-model="form.dueAt" type="date" />
            </div>
            <div class="space-y-1.5">
              <Label for="task-assignee">Assignee (opsional)</Label>
              <select id="task-assignee" v-model="form.assignedTo" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                <option value="">
                  Belum ditentukan
                </option>
                <option v-for="user in USERS" :key="user.id" :value="user.id">
                  {{ user.name }}
                </option>
              </select>
            </div>
          </div>
          <SheetFooter class="mt-6 flex-row justify-end gap-2">
            <Button variant="outline" @click="isFormOpen = false">
              Batal
            </Button>
            <Button :disabled="!form.title.trim()" @click="submitForm">
              Simpan
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>

    <div v-if="viewMode === 'kanban'" class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      <div v-for="status in TASK_STATUSES" :key="status.value" class="flex min-w-0 flex-col rounded-lg p-2" :class="COLUMN_TONE_CLASSES[status.value].column">
        <div class="flex items-center gap-1.5 px-1 py-1">
          <span :class="['h-1.5 w-1.5 shrink-0 rounded-full', COLUMN_TONE_CLASSES[status.value].dot]" />
          <span class="text-xs font-semibold" :class="COLUMN_TONE_CLASSES[status.value].headerText">{{ status.label }}</span>
          <span
            class="flex h-4 min-w-4 items-center justify-center rounded-full bg-card px-1 text-[10px] font-semibold"
            :class="COLUMN_TONE_CLASSES[status.value].headerText"
          >
            {{ boardColumns[status.value]?.length ?? 0 }}
          </span>
          <Lock v-if="status.value === 'done'" class="ml-auto h-3 w-3 opacity-60" :class="COLUMN_TONE_CLASSES[status.value].headerText" />
        </div>

        <VueDraggable
          v-model="boardColumns[status.value]"
          :group="{ name: 'tasks-global', disabled: !canManage }"
          :disabled="!canManage"
          :animation="150"
          item-key="id"
          class="mt-1 max-h-[520px] flex-1 space-y-1.5 overflow-y-auto pr-0.5"
          @end="event => onDragEnd(event, status.value)"
        >
          <div
            v-for="task in boardColumns[status.value]"
            :key="task.id"
            :data-task-id="task.id"
            class="rounded-md border border-border bg-card p-2 shadow-sm"
            :class="canManage ? 'cursor-grab active:cursor-grabbing' : ''"
          >
            <div class="flex items-center gap-1">
              <span v-if="task.isMilestone" class="shrink-0 rounded-full border border-primary/30 bg-primary/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-primary">Milestone</span>
              <StatusBadge v-if="task.isBlocked" label="Blocked" tone="destructive" />
              <span class="ml-auto shrink-0 font-mono text-[9px] text-muted-foreground">{{ task.id }}</span>
              <GripVertical v-if="canManage" class="h-3 w-3 shrink-0 text-muted-foreground/50" />
            </div>
            <p class="mt-1 break-words text-xs font-semibold leading-snug text-foreground [overflow-wrap:anywhere]">
              {{ task.title }}
            </p>
            <NuxtLink v-if="task.projectId" :to="`/project-orders/${task.projectId}?tab=tasks`" class="mt-1 block truncate text-[11px] text-primary hover:underline">
              {{ getProjectById(task.projectId)?.name ?? task.projectId }}
            </NuxtLink>
            <p v-else class="mt-1 truncate text-[11px] text-muted-foreground">
              Tidak terkait project
            </p>
            <div class="mt-1.5 flex items-center justify-between gap-1.5">
              <span class="flex min-w-0 items-center gap-1 text-[11px] text-muted-foreground">
                <Calendar class="h-3 w-3 shrink-0" />{{ task.dueAt ? formatDate(task.dueAt) : '—' }}
              </span>
              <Avatar v-if="task.assignedTo" class="h-4 w-4 shrink-0" :title="getUserById(task.assignedTo)?.name ?? task.assignedTo">
                <AvatarFallback class="bg-primary/15 text-[8px] font-semibold text-primary">
                  {{ initials(getUserById(task.assignedTo)?.name) }}
                </AvatarFallback>
              </Avatar>
              <span v-else class="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-dashed border-muted-foreground/40" title="Belum ditugaskan">
                <UserRound class="h-2.5 w-2.5 text-muted-foreground/50" />
              </span>
            </div>
          </div>

          <div
            v-if="(boardColumns[status.value]?.length ?? 0) === 0"
            class="flex items-center justify-center rounded-md border-2 border-dashed py-6 text-center text-[11px] text-muted-foreground"
            :class="COLUMN_TONE_CLASSES[status.value].dash"
          >
            Tarik tugas ke sini
          </div>
        </VueDraggable>
      </div>
    </div>

    <SectionCard v-else flush>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Judul</TableHead>
            <TableHead>Project</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Due Date</TableHead>
            <TableHead>Assignee</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="task in filteredTasks" :key="task.id">
            <TableCell class="max-w-[280px]">
              <div class="flex flex-wrap items-center gap-1.5">
                <span v-if="task.isMilestone" class="shrink-0 rounded-full border border-primary/30 bg-primary/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-primary">Milestone</span>
                <p class="truncate font-medium text-foreground">
                  {{ task.title }}
                </p>
                <StatusBadge v-if="task.isBlocked" label="Blocked" tone="destructive" />
              </div>
            </TableCell>
            <TableCell class="text-muted-foreground">
              <NuxtLink v-if="task.projectId" :to="`/project-orders/${task.projectId}?tab=tasks`" class="text-primary hover:underline">
                {{ getProjectById(task.projectId)?.name ?? task.projectId }}
              </NuxtLink>
              <span v-else>Tidak terkait project</span>
            </TableCell>
            <TableCell>
              <StatusBadge :label="findStatusOption(TASK_STATUSES, task.status).label" :tone="findStatusOption(TASK_STATUSES, task.status).tone" />
            </TableCell>
            <TableCell class="text-muted-foreground">
              {{ task.dueAt ? formatDate(task.dueAt) : '—' }}
            </TableCell>
            <TableCell class="text-muted-foreground">
              {{ task.assignedTo ? (getUserById(task.assignedTo)?.name ?? task.assignedTo) : '—' }}
            </TableCell>
          </TableRow>
          <TableEmpty v-if="filteredTasks.length === 0" :colspan="5">
            Tidak ada task yang cocok dengan filter ini.
          </TableEmpty>
        </TableBody>
      </Table>
    </SectionCard>
  </div>
</template>
