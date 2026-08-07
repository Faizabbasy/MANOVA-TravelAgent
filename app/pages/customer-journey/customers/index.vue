<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import { Search, Plus } from 'lucide-vue-next'
import { PARTIES, getUserById, getOpportunitiesByParty, getProjectsByParty, getPartiesByAccountOwner, createParty, isManovaClient } from '~/data'
import { findStatusOption } from '~/constants/status'
import type { StatusOption } from '~/types/common'
import type { PartyLifecycleStatus } from '~/types/party'

/**
 * Database Customer (Penyederhanaan 7-Role/Menu) — menggantikan 3 halaman terpisah yang sebelumnya
 * membaca `PARTIES` yang sama beda filter: halaman ini sendiri (dulu "Customers", sudah punya filter
 * status/industri/kota/owner + portfolio toggle), `/crm/prospects` (aksi "Tambah Prospect", diserap ke
 * sini), `/crm/clients` (badge "Manova Client", diserap ke sini). Kedua route lama kini redirect ke sini
 * dengan `?status=prospect`/`?status=client`.
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Database Customer' })

const route = useRoute()
const { canView, isRole, can } = usePermissions()
const { currentUser } = useCurrentUser()
/** Sales dibatasi ke Lead saja pada Customer Journey (docs Prompt 19-10 "Sales: terbatas pada Lead") — narrow exception, halaman lain (`crm`) tetap generik. */
const hasAccess = computed(() => canView('crm'))
/** Portfolio scoping — Sales (yang kini juga mencakup Account Executive lama) melihat portfolio miliknya. */
const isAeScoped = computed(() => isRole('sales'))
/** Aksi tulis (buat prospect) — narrow exception yang sama dengan `/crm/prospects` lama, lihat komentar di sana (sebelum diserap ke sini). */
const canManageParty = computed(() => can('crm.manage-party'))

const LIFECYCLE_STATUSES: StatusOption<PartyLifecycleStatus>[] = [
  { value: 'prospect', label: 'Prospect', tone: 'warning', order: 1 },
  { value: 'client', label: 'Active Client', tone: 'success', order: 2 }
]

const searchQuery = ref('')
/** Drill-down (Sales Pipeline > Funnel) — `?status=client`/`?status=prospect` deep-link ke satu status saja (dulu 2 route terpisah, `/crm/clients`/`/crm/prospects`). */
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

const isCreateOpen = ref(false)
const newName = ref('')
const newIndustry = ref('')

function submitCreate () {
  if (!newName.value.trim()) { return }
  const party = createParty({ name: newName.value.trim(), industry: newIndustry.value.trim() || undefined })
  newName.value = ''
  newIndustry.value = ''
  isCreateOpen.value = false
  navigateTo(`/crm/parties/${party.id}`)
}
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Database Customer"
      description="Directory company (Party) — Prospect dan Active Client dalam satu tabel, filter status untuk mempersempit."
      :breadcrumb="[{ label: 'Database Customer' }]"
    >
      <template v-if="canManageParty" #actions>
        <Dialog v-model:open="isCreateOpen">
          <DialogTrigger as-child>
            <Button><Plus class="h-4 w-4 mr-1.5" />Tambah Prospect</Button>
          </DialogTrigger>
          <DialogContent class="max-w-md">
            <DialogHeader>
              <DialogTitle>Tambah Prospect Baru</DialogTitle>
              <DialogDescription>Party baru akan dibuat dengan lifecycle status Prospect.</DialogDescription>
            </DialogHeader>
            <div class="space-y-4 py-2">
              <div class="space-y-1.5">
                <Label for="prospect-name">Nama Party</Label>
                <Input id="prospect-name" v-model="newName" placeholder="mis. PT Nama Perusahaan" />
              </div>
              <div class="space-y-1.5">
                <Label for="prospect-industry">Industri (opsional)</Label>
                <Input id="prospect-industry" v-model="newIndustry" placeholder="mis. Manufaktur, Retail, dll." />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" @click="isCreateOpen = false">
                Batal
              </Button>
              <Button :disabled="!newName.trim()" @click="submitCreate">
                Simpan
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </template>
    </PageHeader>

    <RoleAccessState v-if="!hasAccess" module-label="modul CRM" />

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
                <div class="flex items-center gap-1.5">
                  <StatusBadge :label="findStatusOption(LIFECYCLE_STATUSES, row.party.lifecycleStatus).label" :tone="findStatusOption(LIFECYCLE_STATUSES, row.party.lifecycleStatus).tone" />
                  <StatusBadge v-if="row.party.lifecycleStatus === 'client' && isManovaClient(row.party.id)" label="Manova Client" tone="purple" />
                </div>
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
