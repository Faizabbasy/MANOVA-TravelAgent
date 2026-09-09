<script setup lang="ts">
import { computed, ref } from 'vue'
import { AlertTriangle, CheckCircle2, ListChecks, Milestone as MilestoneIcon, Plus, StickyNote, TrendingUp, Wallet } from 'lucide-vue-next'
import { PROJECTS, getProjectById, getUserById, USERS } from '~/data'
import { getMilestoneDelayDays, getMilestoneProgressPercent, createProjectMilestone } from '~/data/project-order-workflow'
import { PROJECT_MILESTONES } from '~/data/project-orders'
import type { ProjectMilestoneStatus } from '~/types/project-order'
import type { BadgeTone } from '~/types/common'
import { formatDate, formatCurrencyIdr } from '~/utils/format'

/** Menu sidebar baru "Milestones" — list SEMUA `PROJECT_MILESTONES` lintas project (data sudah global,
 * bukan entity baru), dengan filter Project/Status dan "Tambah Milestone" (pakai `createProjectMilestone`
 * yang sudah ada, dipakai juga oleh tab Milestone per-project). Layout meniru "Timeline Tracking" tab
 * Milestone per-project (stat card + list bernomor lingkaran + progress bar) supaya konsisten visual,
 * tapi versi lintas-project ini READ-ONLY (baris klik → tab Milestone project terkait untuk edit/actual
 * date/deliverables) — CRUD detail sengaja tidak diduplikasi di sini. */

const { can } = usePermissions()
const canManage = computed(() => can('project-order.manage-operations'))

const STATUS_META: Record<ProjectMilestoneStatus, { label: string; tone: BadgeTone }> = {
  'not-started': { label: 'Belum Mulai', tone: 'neutral' },
  'in-progress': { label: 'Berjalan', tone: 'info' },
  completed: { label: 'Selesai', tone: 'success' },
  delayed: { label: 'Terlambat', tone: 'destructive' },
  cancelled: { label: 'Dibatalkan', tone: 'neutral' }
}

const projectFilter = ref<'all' | string>('all')
const statusFilter = ref<'all' | ProjectMilestoneStatus>('all')

const filteredMilestones = computed(() => {
  void PROJECT_MILESTONES.length
  return PROJECT_MILESTONES
    .filter(milestone => projectFilter.value === 'all' || milestone.projectId === projectFilter.value)
    .filter(milestone => statusFilter.value === 'all' || milestone.status === statusFilter.value)
})

const rows = computed(() => filteredMilestones.value
  .map(milestone => ({
    milestone,
    project: getProjectById(milestone.projectId),
    delay: getMilestoneDelayDays(milestone),
    progress: getMilestoneProgressPercent(milestone)
  }))
  .sort((a, b) => (a.milestone.actualDate ?? a.milestone.plannedDate).localeCompare(b.milestone.actualDate ?? b.milestone.plannedDate)))

/** Stat cards ringkasan — pola sama "Timeline Tracking" per-project, cuma diagregasi lintas hasil filter saat ini. */
const totalCount = computed(() => filteredMilestones.value.length)
const completedCount = computed(() => filteredMilestones.value.filter(m => m.status === 'completed').length)
const delayedCount = computed(() => filteredMilestones.value.filter(m => (getMilestoneDelayDays(m) ?? 0) > 0 && m.status !== 'completed').length)
const avgProgress = computed(() => {
  if (!filteredMilestones.value.length) { return 0 }
  const total = filteredMilestones.value.reduce((sum, m) => sum + getMilestoneProgressPercent(m), 0)
  return Math.round(total / filteredMilestones.value.length)
})
const totalBudget = computed(() => filteredMilestones.value.reduce((sum, m) => sum + (m.budgetIdr ?? 0), 0))

function delayLabel (delay: number | undefined): string {
  if (delay === undefined) { return '—' }
  if (delay > 0) { return `+${delay} hari` }
  if (delay < 0) { return `${delay} hari` }
  return 'Tepat waktu'
}
function isLate (row: { milestone: { status: ProjectMilestoneStatus }; delay: number | undefined }): boolean {
  return row.delay !== undefined && row.delay > 0 && row.milestone.status !== 'completed'
}
function deliverableCount (milestone: { deliverables?: { done: boolean }[] }): { done: number; total: number } {
  const list = milestone.deliverables ?? []
  return { done: list.filter(item => item.done).length, total: list.length }
}

const projectsWithMilestones = computed(() => {
  const ids = new Set(PROJECT_MILESTONES.map(milestone => milestone.projectId))
  return PROJECTS.filter(project => ids.has(project.id))
})

/* Tambah Milestone */
const isFormOpen = ref(false)
const form = ref({ projectId: '', name: '', plannedDate: '', ownerId: '', note: '' })

function openForm () {
  form.value = { projectId: '', name: '', plannedDate: '', ownerId: '', note: '' }
  isFormOpen.value = true
}

function submitForm () {
  if (!form.value.projectId || !form.value.name.trim() || !form.value.plannedDate) { return }
  createProjectMilestone({
    projectId: form.value.projectId,
    name: form.value.name.trim(),
    plannedDate: form.value.plannedDate,
    ownerId: form.value.ownerId || undefined,
    note: form.value.note.trim() || undefined
  })
  isFormOpen.value = false
}
</script>

<template>
  <div class="space-y-4">
    <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
      <StatsCard title="Total Milestone" :value="String(totalCount)" :icon="ListChecks" />
      <StatsCard title="Selesai" :value="String(completedCount)" :icon="CheckCircle2" icon-color="success" />
      <StatsCard title="Delay" :value="String(delayedCount)" :icon="AlertTriangle" icon-color="destructive" />
      <StatsCard title="Progress Keseluruhan" :value="`${avgProgress}%`" :icon="TrendingUp" :progress-percent="avgProgress" />
      <StatsCard title="Total Budget Milestone" :value="formatCurrencyIdr(totalBudget)" :icon="Wallet" />
    </div>

    <SectionCard compact titleClass="text-sm font-bold normal-case tracking-normal text-foreground" title="Timeline Tracking">
      <template #actions>
        <div class="flex flex-wrap items-center gap-2">
          <select v-model="projectFilter" class="appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
            <option value="all">
              Semua Project
            </option>
            <option v-for="project in projectsWithMilestones" :key="project.id" :value="project.id">
              {{ project.name }}
            </option>
          </select>

          <select v-model="statusFilter" class="appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
            <option value="all">
              Semua Status
            </option>
            <option v-for="(meta, status) in STATUS_META" :key="status" :value="status">
              {{ meta.label }}
            </option>
          </select>

          <Sheet v-if="canManage" v-model:open="isFormOpen">
            <SheetTrigger as-child>
              <Button size="sm" @click="openForm">
                <Plus class="h-4 w-4 mr-1.5" />Tambah Milestone
              </Button>
            </SheetTrigger>
            <SheetContent side="right" class="w-full sm:max-w-lg overflow-y-auto">
              <SheetHeader>
                <SheetTitle>Tambah Milestone</SheetTitle>
                <SheetDescription>Milestone baru untuk salah satu project.</SheetDescription>
              </SheetHeader>
              <div class="space-y-4 py-2">
                <div class="space-y-1.5">
                  <Label for="milestone-project">Project</Label>
                  <select id="milestone-project" v-model="form.projectId" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                    <option value="" disabled>
                      Pilih project...
                    </option>
                    <option v-for="project in PROJECTS" :key="project.id" :value="project.id">
                      {{ project.name }}
                    </option>
                  </select>
                </div>
                <div class="space-y-1.5">
                  <Label for="milestone-name">Nama Milestone</Label>
                  <Input id="milestone-name" v-model="form.name" placeholder="mis. Deposit Lunas" />
                </div>
                <div class="space-y-1.5">
                  <Label for="milestone-date">Tanggal Rencana</Label>
                  <Input id="milestone-date" v-model="form.plannedDate" type="date" />
                </div>
                <div class="space-y-1.5">
                  <Label for="milestone-owner">Owner (opsional)</Label>
                  <select id="milestone-owner" v-model="form.ownerId" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                    <option value="">
                      Tidak ditentukan
                    </option>
                    <option v-for="user in USERS" :key="user.id" :value="user.id">
                      {{ user.name }}
                    </option>
                  </select>
                </div>
                <div class="space-y-1.5">
                  <Label for="milestone-note">Catatan (opsional)</Label>
                  <textarea id="milestone-note" v-model="form.note" rows="3" class="w-full px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
              </div>
              <SheetFooter class="mt-6 flex-row justify-end gap-2">
                <Button variant="outline" @click="isFormOpen = false">
                  Batal
                </Button>
                <Button :disabled="!form.projectId || !form.name.trim() || !form.plannedDate" @click="submitForm">
                  Simpan
                </Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        </div>
      </template>

      <p class="-mt-2 mb-3 text-xs text-muted-foreground">
        {{ completedCount }}/{{ totalCount }} milestone selesai
        <template v-if="delayedCount">
          · <span class="font-medium text-destructive">{{ delayedCount }} terlambat</span>
        </template>
      </p>

      <div v-if="rows.length" class="overflow-hidden rounded-xl border border-border">
        <NuxtLink
          v-for="(row, index) in rows"
          :key="row.milestone.id"
          :to="`/project-orders/${row.milestone.projectId}?tab=milestone`"
          class="flex gap-3 px-4 py-3 transition-colors hover:bg-muted/30"
          :class="[
            index !== rows.length - 1 ? 'border-b border-border' : '',
            row.milestone.status === 'completed' ? 'bg-success/[0.03]' : ''
          ]"
        >
          <div
            class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold"
            :class="row.milestone.status === 'completed'
              ? 'bg-success text-success-foreground'
              : isLate(row) ? 'border-2 border-destructive bg-card text-destructive' : 'border-2 border-border bg-card text-muted-foreground'"
          >
            {{ String(index + 1).padStart(2, '0') }}
          </div>

          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <p class="text-sm font-semibold text-foreground">
                {{ row.milestone.name }}
              </p>
              <StatusBadge
                :label="STATUS_META[row.milestone.status].label"
                :tone="isLate(row) ? 'destructive' : STATUS_META[row.milestone.status].tone"
              />
              <StickyNote v-if="row.milestone.note" class="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            </div>
            <p class="mt-0.5 text-xs text-muted-foreground">
              {{ row.project?.name ?? '—' }}
              <template v-if="row.milestone.actualDate"> · Realisasi {{ formatDate(row.milestone.actualDate) }}</template>
              <template v-else> · Rencana {{ formatDate(row.milestone.plannedDate) }}</template>
              <template v-if="row.milestone.ownerId"> · {{ getUserById(row.milestone.ownerId)?.name ?? row.milestone.ownerId }}</template>
              <template v-if="isLate(row)"> · <span class="font-medium text-destructive">{{ delayLabel(row.delay) }}</span></template>
              <template v-if="row.milestone.budgetIdr"> · {{ formatCurrencyIdr(row.milestone.budgetIdr) }}</template>
            </p>
            <div class="mt-1.5 flex items-center gap-2">
              <div class="h-1.5 w-24 shrink-0 overflow-hidden rounded-full bg-muted">
                <div class="h-full rounded-full bg-primary transition-all" :style="{ width: `${row.progress}%` }" />
              </div>
              <span class="text-[11px] text-muted-foreground">{{ row.progress }}%</span>
              <span v-if="deliverableCount(row.milestone).total" class="inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                <ListChecks class="h-3 w-3" />{{ deliverableCount(row.milestone).done }}/{{ deliverableCount(row.milestone).total }} selesai
              </span>
            </div>
          </div>
        </NuxtLink>
      </div>
      <EmptyState v-else :icon="MilestoneIcon" title="Belum ada milestone" description="Tidak ada milestone yang cocok dengan filter ini." />
    </SectionCard>
  </div>
</template>
