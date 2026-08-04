<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import { Search } from 'lucide-vue-next'
import { PARTIES, getUserById, getOpportunitiesByParty, getProjectsByParty, getPartiesByAccountOwner } from '~/data'
import { findStatusOption } from '~/constants/status'
import type { StatusOption } from '~/types/common'
import type { PartyLifecycleStatus } from '~/types/party'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Customers' })

const route = useRoute()
const { canView, isRole } = usePermissions()
const { currentUser } = useCurrentUser()
/** Sales dibatasi ke Lead saja pada Customer Journey (docs Prompt 19-10 "Sales: terbatas pada Lead") — narrow exception, halaman lain (`crm`) tetap generik. */
const hasAccess = computed(() => canView('crm'))
/** Portfolio scoping — Sales (yang kini juga mencakup Account Executive lama) melihat portfolio miliknya. */
const isAeScoped = computed(() => isRole('sales'))

const LIFECYCLE_STATUSES: StatusOption<PartyLifecycleStatus>[] = [
  { value: 'prospect', label: 'Prospect', tone: 'warning', order: 1 },
  { value: 'client', label: 'Active Client', tone: 'success', order: 2 }
]

const searchQuery = ref('')
/** Drill-down (Section 07, Customer Journey Funnel) — `?status=client` dari `/customer-journey` deep-link ke Active Client saja. */
const statusFilter = ref<'all' | PartyLifecycleStatus>((route.query.status as PartyLifecycleStatus) || 'all')
const industryFilter = ref('all')
const cityFilter = ref('all')
const ownerFilter = ref('all')
/** "AE data scope ke portfolio miliknya" (Section 07, Wajib) — default ON untuk AE, tidak berlaku/tidak tampil untuk role lain (Super Admin/Management selalu melihat seluruh data). */
const portfolioOnly = ref(isAeScoped.value)

const ownerOptions = computed(() => {
  const ids = [...new Set(PARTIES.map(p => p.accountOwnerId).filter(Boolean))] as string[]
  return ids.map(id => getUserById(id)).filter((user): user is NonNullable<typeof user> => Boolean(user))
})
const industryOptions = computed(() => [...new Set(PARTIES.map(p => p.industry).filter(Boolean))] as string[])
const cityOptions = computed(() => [...new Set(PARTIES.map(p => p.city).filter(Boolean))] as string[])

const rows = computed(() => {
  const base = isAeScoped.value && portfolioOnly.value ? getPartiesByAccountOwner(currentUser.value.id) : PARTIES
  let result = base.map(party => ({
    party,
    opportunityCount: getOpportunitiesByParty(party.id).length,
    projectOrderCount: getProjectsByParty(party.id).length
  }))

  if (statusFilter.value !== 'all') { result = result.filter(row => row.party.lifecycleStatus === statusFilter.value) }
  if (industryFilter.value !== 'all') { result = result.filter(row => row.party.industry === industryFilter.value) }
  if (cityFilter.value !== 'all') { result = result.filter(row => row.party.city === cityFilter.value) }
  if (ownerFilter.value !== 'all') { result = result.filter(row => row.party.accountOwnerId === ownerFilter.value) }
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(row => row.party.name.toLowerCase().includes(q))
  }
  return result
})
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Customers"
      description="Directory company (Party) yang sama dengan CRM Prospects/Clients — tampilan Account Executive-centric untuk Customer Journey."
      :breadcrumb="[{ label: 'Customer Journey', to: '/customer-journey' }, { label: 'Customers' }]"
    />

    <RoleAccessState v-if="!hasAccess" module-label="modul Customer Journey" />

    <template v-else>
      <div class="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-3">
        <div class="relative flex-1 max-w-sm w-full">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input v-model="searchQuery" placeholder="Cari nama company..." class="pl-9" />
        </div>
        <select v-model="statusFilter" class="appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
          <option value="all">
            Semua Status
          </option>
          <option v-for="status in LIFECYCLE_STATUSES" :key="status.value" :value="status.value">
            {{ status.label }}
          </option>
        </select>
        <select v-model="industryFilter" class="appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
          <option value="all">
            Semua Industri
          </option>
          <option v-for="industry in industryOptions" :key="industry" :value="industry">
            {{ industry }}
          </option>
        </select>
        <select v-model="cityFilter" class="appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
          <option value="all">
            Semua Kota
          </option>
          <option v-for="city in cityOptions" :key="city" :value="city">
            {{ city }}
          </option>
        </select>
        <select v-if="!isAeScoped" v-model="ownerFilter" class="appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
          <option value="all">
            Semua Account Owner
          </option>
          <option v-for="user in ownerOptions" :key="user.id" :value="user.id">
            {{ user.name }}
          </option>
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
              <TableHead>Company</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Kota</TableHead>
              <TableHead>Telepon</TableHead>
              <TableHead>Account Owner</TableHead>
              <TableHead>Opportunities</TableHead>
              <TableHead>Project Orders</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="row in rows" :key="row.party.id" class="cursor-pointer hover:bg-muted/50" @click="navigateTo(`/customer-journey/customers/${row.party.id}`)">
              <TableCell class="font-medium text-foreground">
                {{ row.party.name }}
              </TableCell>
              <TableCell>
                <StatusBadge :label="findStatusOption(LIFECYCLE_STATUSES, row.party.lifecycleStatus).label" :tone="findStatusOption(LIFECYCLE_STATUSES, row.party.lifecycleStatus).tone" />
              </TableCell>
              <TableCell class="text-muted-foreground">
                {{ row.party.city ?? '—' }}
              </TableCell>
              <TableCell class="text-muted-foreground">
                {{ row.party.phone ?? '—' }}
              </TableCell>
              <TableCell class="text-muted-foreground">
                {{ row.party.accountOwnerId ? getUserById(row.party.accountOwnerId)?.name ?? '—' : '—' }}
              </TableCell>
              <TableCell>{{ row.opportunityCount }}</TableCell>
              <TableCell>{{ row.projectOrderCount }}</TableCell>
            </TableRow>
            <TableEmpty v-if="rows.length === 0" :colspan="7">
              {{ searchQuery || statusFilter !== 'all' || industryFilter !== 'all' || cityFilter !== 'all' || ownerFilter !== 'all' ? 'Tidak ada company yang cocok dengan filter.' : (portfolioOnly ? 'Belum ada company di portfolio Anda.' : 'Belum ada company.') }}
            </TableEmpty>
          </TableBody>
        </Table>
      </SectionCard>
    </template>
  </div>
</template>
