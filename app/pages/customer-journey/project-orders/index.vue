<script setup lang="ts">
import { ref, computed } from 'vue'
import { Search } from 'lucide-vue-next'
import { PROJECTS, getPartyById, getOpportunityById, getUserById, getProjectsByAccountExecutive } from '~/data'
import { PROJECT_STATUSES, PROJECT_CHARACTERISTICS, findStatusOption } from '~/constants/status'
import { formatDateRange, daysUntil } from '~/utils/format'
import { DEMO_REFERENCE_DATE } from '~/utils/attention'
import type { Project } from '~/types/project'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Project Orders' })

const { canView } = usePermissions()
const { currentUser, currentRole } = useCurrentUser()
/** Sales dibatasi ke Lead saja pada Customer Journey (docs Prompt 19-10) — narrow exception. */
const hasAccess = computed(() => canView('crm') && currentRole.value !== 'sales')
const isAeScoped = computed(() => currentRole.value === 'account-executive')

const searchQuery = ref('')
const statusFilter = ref<'all' | Project['status']>('all')
const typeFilter = ref<'all' | Project['characteristic']>('all')
const clientFilter = ref<'all' | string>('all')
const accountExecutiveFilter = ref<'all' | string>('all')
const projectManagerFilter = ref<'all' | string>('all')
/** "Date" (Wajib "Filters by source, owner, stage, client, date, project type") — periode keberangkatan, pola sama `reports/index.vue`. */
const departurePeriodFilter = ref<'all' | '30' | '60' | '90'>('all')
/** "AE data scope ke portfolio miliknya" (Section 07, Wajib) — default ON untuk AE. */
const portfolioOnly = ref(isAeScoped.value)

const clientOptions = computed(() => {
  const ids = [...new Set(PROJECTS.map(p => p.partyId))]
  return ids.map(id => getPartyById(id)).filter((party): party is NonNullable<typeof party> => Boolean(party))
})
const accountExecutiveOptions = computed(() => {
  const ids = [...new Set(PROJECTS.map(p => p.opportunityId ? getOpportunityById(p.opportunityId)?.ownerId : undefined).filter(Boolean))] as string[]
  return ids.map(id => getUserById(id)).filter((user): user is NonNullable<typeof user> => Boolean(user))
})
const projectManagerOptions = computed(() => {
  const ids = [...new Set(PROJECTS.map(p => p.ownerId))]
  return ids.map(id => getUserById(id)).filter((user): user is NonNullable<typeof user> => Boolean(user))
})

const rows = computed(() => {
  const base = isAeScoped.value && portfolioOnly.value ? getProjectsByAccountExecutive(currentUser.value.id) : PROJECTS
  let result = base.map(project => ({
    project,
    party: getPartyById(project.partyId),
    accountExecutiveId: project.opportunityId ? getOpportunityById(project.opportunityId)?.ownerId : undefined,
  }))

  if (statusFilter.value !== 'all') result = result.filter(row => row.project.status === statusFilter.value)
  if (typeFilter.value !== 'all') result = result.filter(row => row.project.characteristic === typeFilter.value)
  if (clientFilter.value !== 'all') result = result.filter(row => row.project.partyId === clientFilter.value)
  if (accountExecutiveFilter.value !== 'all') result = result.filter(row => row.accountExecutiveId === accountExecutiveFilter.value)
  if (projectManagerFilter.value !== 'all') result = result.filter(row => row.project.ownerId === projectManagerFilter.value)
  if (departurePeriodFilter.value !== 'all') {
    result = result.filter((row) => {
      const days = daysUntil(row.project.travelStartDate, DEMO_REFERENCE_DATE)
      return days >= 0 && days <= Number(departurePeriodFilter.value)
    })
  }
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(row => row.project.name.toLowerCase().includes(q) || row.project.id.toLowerCase().includes(q))
  }
  return result
})
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Project Orders"
      description="Entitas yang sama dengan Project (`/projects`) — tampilan Account Executive-centric untuk Customer Journey."
      :breadcrumb="[{ label: 'Customer Journey', to: '/customer-journey' }, { label: 'Project Orders' }]"
    />

    <RoleAccessState v-if="!hasAccess" module-label="modul Customer Journey" />

    <template v-else>
      <div class="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-3">
        <div class="relative flex-1 max-w-sm w-full">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input v-model="searchQuery" placeholder="Cari nama atau nomor Project Order..." class="pl-9" />
        </div>
        <select v-model="clientFilter" class="appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
          <option value="all">Semua Client</option>
          <option v-for="party in clientOptions" :key="party.id" :value="party.id">{{ party.name }}</option>
        </select>
        <select v-model="statusFilter" class="appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
          <option value="all">Semua Status</option>
          <option v-for="status in PROJECT_STATUSES" :key="status.value" :value="status.value">{{ status.label }}</option>
        </select>
        <select v-model="typeFilter" class="appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
          <option value="all">Semua Tipe</option>
          <option v-for="type in PROJECT_CHARACTERISTICS" :key="type.value" :value="type.value">{{ type.label }}</option>
        </select>
        <select v-model="accountExecutiveFilter" class="appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
          <option value="all">Semua Account Executive</option>
          <option v-for="user in accountExecutiveOptions" :key="user.id" :value="user.id">{{ user.name }}</option>
        </select>
        <select v-model="projectManagerFilter" class="appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
          <option value="all">Semua Project Manager</option>
          <option v-for="user in projectManagerOptions" :key="user.id" :value="user.id">{{ user.name }}</option>
        </select>
        <select v-model="departurePeriodFilter" class="appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
          <option value="all">Semua Periode Keberangkatan</option>
          <option value="30">30 Hari ke Depan</option>
          <option value="60">60 Hari ke Depan</option>
          <option value="90">90 Hari ke Depan</option>
        </select>
        <label v-if="isAeScoped" class="flex items-center gap-2 text-sm text-foreground cursor-pointer">
          <Checkbox v-model="portfolioOnly" />
          Hanya Portfolio Saya
        </label>
      </div>

      <SectionCard>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Project Order</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Tanggal</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Account Executive</TableHead>
              <TableHead>Project Manager</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="row in rows" :key="row.project.id" class="cursor-pointer hover:bg-muted/50" @click="navigateTo(`/customer-journey/project-orders/${row.project.id}`)">
              <TableCell class="font-medium text-foreground">{{ row.project.name }}<span class="block text-xs text-muted-foreground font-normal">{{ row.project.id }}</span></TableCell>
              <TableCell class="text-muted-foreground">{{ row.party?.name ?? '—' }}</TableCell>
              <TableCell class="text-muted-foreground">{{ formatDateRange(row.project.travelStartDate, row.project.travelEndDate) }}</TableCell>
              <TableCell><StatusBadge :label="findStatusOption(PROJECT_STATUSES, row.project.status).label" :tone="findStatusOption(PROJECT_STATUSES, row.project.status).tone" /></TableCell>
              <TableCell class="text-muted-foreground">{{ row.accountExecutiveId ? getUserById(row.accountExecutiveId)?.name ?? '—' : '—' }}</TableCell>
              <TableCell class="text-muted-foreground">{{ getUserById(row.project.ownerId)?.name ?? '—' }}</TableCell>
            </TableRow>
            <TableEmpty v-if="rows.length === 0" :colspan="6">Tidak ada Project Order yang cocok dengan filter.</TableEmpty>
          </TableBody>
        </Table>
      </SectionCard>
    </template>
  </div>
</template>
