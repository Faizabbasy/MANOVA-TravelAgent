<script setup lang="ts">
import { computed, ref } from 'vue'
import { Search, FolderKanban, AlertTriangle, CheckCircle2, Clock } from 'lucide-vue-next'
import { cn } from '~/lib/utils'
import { PROJECTS, getPartyById, getUserById, getProjectOrderStatus } from '~/data'
import {
  PROJECT_ORDER_STEPS,
  getProjectOrderStep,
  evaluateProjectOrderStepGate,
  getProjectMilestoneSummary
} from '~/data/project-order-workflow'
import { PROJECT_ORDER_STATUSES, PROJECT_CHARACTERISTICS, findStatusOption } from '~/constants/status'
import { formatCurrencyIdr, formatDateRange } from '~/utils/format'
import type { ProjectOrderStepKey } from '~/types/project-order'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Project' })

const { canView, canViewFinancials } = usePermissions()
const { currentUser } = useCurrentUser()

/**
 * Daftar kanonik Project Order (Revisi 9-Modul) — menggantikan dua daftar paralel yang sebelumnya membaca
 * `PROJECTS` yang sama (`/projects` dan `/customer-journey/project-orders`). Setiap baris menampilkan step
 * aktif pada alur 6 step beserta indikator apakah step tersebut sedang tertahan gerbangnya.
 */
const hasAccess = computed(() => canView('operations'))

const searchQuery = ref('')
const stepFilter = ref<'all' | ProjectOrderStepKey>('all')
const attentionOnly = ref(false)
const mineOnly = ref(false)

const rows = computed(() => PROJECTS.map((project) => {
  const stepKey = getProjectOrderStep(project)
  const step = PROJECT_ORDER_STEPS.find(item => item.key === stepKey)!
  const gate = evaluateProjectOrderStepGate(project.id, stepKey)
  const milestones = getProjectMilestoneSummary(project.id)

  return {
    project,
    party: getPartyById(project.partyId),
    owner: getUserById(project.ownerId),
    orderStatus: findStatusOption(PROJECT_ORDER_STATUSES, getProjectOrderStatus(project)),
    characteristic: findStatusOption(PROJECT_CHARACTERISTICS, project.characteristic),
    step,
    gate,
    milestones,
    needsAttention: !gate.ready || milestones.delayed > 0
  }
}))

const filteredRows = computed(() => {
  let result = rows.value
  if (stepFilter.value !== 'all') { result = result.filter(row => row.step.key === stepFilter.value) }
  if (attentionOnly.value) { result = result.filter(row => row.needsAttention) }
  if (mineOnly.value) { result = result.filter(row => row.project.ownerId === currentUser.value.id) }
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(row =>
      row.project.name.toLowerCase().includes(query) ||
      row.project.id.toLowerCase().includes(query) ||
      (row.party?.name ?? '').toLowerCase().includes(query))
  }
  return result
})

const stats = computed(() => ({
  total: rows.value.length,
  blocked: rows.value.filter(row => !row.gate.ready).length,
  delayed: rows.value.filter(row => row.milestones.delayed > 0).length,
  closed: rows.value.filter(row => Boolean(row.project.closedAt)).length
}))

/** Distribusi per step untuk chip filter — sekaligus menunjukkan di mana pekerjaan menumpuk. */
const stepCounts = computed(() => PROJECT_ORDER_STEPS.map(step => ({
  step,
  count: rows.value.filter(row => row.step.key === step.key).length
})))
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Project"
      description="Seluruh project order MANOVA dalam alur 6 step: Drafting → Confirmed → Start → Departure → On Progress → Done."
      :breadcrumb="[{ label: 'Operations & Scheduling' }, { label: 'Project' }]"
    />

    <RoleAccessState v-if="!hasAccess" module-label="modul Operations & Scheduling" />

    <template v-else>
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Total Project" :value="String(stats.total)" :icon="FolderKanban" />
        <StatsCard title="Step Tertahan" :value="String(stats.blocked)" :icon="AlertTriangle" :icon-color="stats.blocked ? 'destructive' : 'success'" />
        <StatsCard title="Ada Milestone Telat" :value="String(stats.delayed)" :icon="Clock" :icon-color="stats.delayed ? 'warning' : 'success'" />
        <StatsCard title="Selesai & Ditutup" :value="String(stats.closed)" :icon="CheckCircle2" icon-color="success" />
      </div>

      <div class="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-3">
        <div class="relative flex-1 max-w-sm w-full">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input v-model="searchQuery" placeholder="Cari nomor, nama, atau customer..." class="pl-9" />
        </div>
        <label class="flex items-center gap-2 text-sm text-foreground cursor-pointer">
          <Checkbox v-model="attentionOnly" />
          Hanya yang butuh perhatian
        </label>
        <label class="flex items-center gap-2 text-sm text-foreground cursor-pointer">
          <Checkbox v-model="mineOnly" />
          Hanya milik saya
        </label>
      </div>

      <div class="flex flex-wrap gap-2">
        <button
          type="button"
          :class="cn(
            'px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors',
            stepFilter === 'all' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground'
          )"
          @click="stepFilter = 'all'"
        >
          Semua ({{ rows.length }})
        </button>
        <button
          v-for="entry in stepCounts"
          :key="entry.step.key"
          type="button"
          :class="cn(
            'px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors',
            stepFilter === entry.step.key ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground'
          )"
          @click="stepFilter = entry.step.key"
        >
          {{ entry.step.index }}. {{ entry.step.label }} ({{ entry.count }})
        </button>
      </div>

      <SectionCard>
        <Table v-if="filteredRows.length">
          <TableHeader>
            <TableRow>
              <TableHead>Project</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Step Aktif</TableHead>
              <TableHead>Jadwal</TableHead>
              <TableHead>Milestone</TableHead>
              <TableHead v-if="canViewFinancials" class="text-right">
                Nilai Kontrak
              </TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow
              v-for="row in filteredRows"
              :key="row.project.id"
              class="cursor-pointer"
              @click="$router.push(`/project-orders/${row.project.id}`)"
            >
              <TableCell>
                <p class="text-sm font-medium text-foreground">
                  {{ row.project.name }}
                </p>
                <p class="text-xs text-muted-foreground font-mono">
                  {{ row.project.id }} · {{ row.owner?.name ?? '—' }}
                </p>
              </TableCell>
              <TableCell>
                <p class="text-sm text-foreground">
                  {{ row.party?.name ?? '—' }}
                </p>
                <StatusBadge :label="row.characteristic.label" :tone="row.characteristic.tone" />
              </TableCell>
              <TableCell>
                <div class="flex items-center gap-1.5">
                  <span
                    :class="cn(
                      'h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0',
                      row.gate.ready ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'
                    )"
                  >
                    {{ row.step.index }}
                  </span>
                  <span class="text-sm text-foreground">{{ row.step.label }}</span>
                </div>
                <p v-if="!row.gate.ready" class="text-xs text-destructive mt-0.5 line-clamp-1" :title="row.gate.blockers.join(' ')">
                  {{ row.gate.blockers.length }} syarat belum terpenuhi
                </p>
              </TableCell>
              <TableCell class="text-sm text-muted-foreground">
                {{ formatDateRange(row.project.travelStartDate, row.project.travelEndDate) }}
              </TableCell>
              <TableCell>
                <span class="text-sm text-foreground">{{ row.milestones.completed }}/{{ row.milestones.total }}</span>
                <p v-if="row.milestones.delayed" class="text-xs text-destructive">
                  {{ row.milestones.delayed }} telat
                </p>
              </TableCell>
              <TableCell v-if="canViewFinancials" class="text-right text-sm font-medium text-foreground">
                {{ formatCurrencyIdr(row.project.quotationAmountIdr) }}
              </TableCell>
              <TableCell>
                <StatusBadge :label="row.orderStatus.label" :tone="row.orderStatus.tone" />
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>

        <EmptyState
          v-else
          :icon="FolderKanban"
          title="Tidak ada Project yang cocok"
          description="Ubah kata kunci atau lepas filter yang aktif."
        />
      </SectionCard>
    </template>
  </div>
</template>
