<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import { Search, Plus, Eye, SlidersHorizontal } from 'lucide-vue-next'
import { PARTIES, getUserById, getLeadsByParty, getProjectsByParty, getPartiesByAccountOwner, createParty, isManovaClient, getPartyCreditFacility } from '~/data'
import { findStatusOption } from '~/constants/status'
import { formatCurrencyIdr } from '~/utils/format'
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

/** Filter di mobile — 4 select (Status/Industri/Kota/Owner) numpuk vertikal penuh layar kalau dibiarkan,
 * disembunyikan di belakang satu tombol "Filter" (bottom Sheet), pola sama SalesLeadsPanel. */
const isMobileFilterOpen = ref(false)
const activeFilterCount = computed(() => [
  statusFilter.value !== 'all',
  industryFilter.value !== 'all',
  cityFilter.value !== 'all',
  ownerFilter.value !== 'all'
].filter(Boolean).length)

const ownerOptions = computed(() => {
  const ids = [...new Set(PARTIES.map(p => p.accountOwnerId).filter(Boolean))] as string[]
  return ids.map(id => getUserById(id)).filter((user): user is NonNullable<typeof user> => Boolean(user))
})
const industryOptions = computed(() => [...new Set(PARTIES.map(p => p.industry).filter(Boolean))] as string[])
const cityOptions = computed(() => [...new Set(PARTIES.map(p => p.city).filter(Boolean))] as string[])

const rows = computed(() => {
  const base = isAeScoped.value && portfolioOnly.value ? getPartiesByAccountOwner(currentUser.value.id) : PARTIES
  /** Directory ini khusus company (B2B) — customer individual (B2C, `partyType: 'individual'` dari Sales Order) tidak ditampilkan di sini. */
  let result = base.filter(party => party.partyType !== 'individual').map(party => ({
    party,
    leadCount: getLeadsByParty(party.id).length,
    projectOrderCount: getProjectsByParty(party.id).length,
    credit: getPartyCreditFacility(party.id)
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
    />

    <RoleAccessState v-if="!hasAccess" module-label="modul CRM" />

    <template v-else>
      <div class="space-y-3">
        <div class="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-3">
          <div class="relative flex-1 max-w-sm w-full">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input v-model="searchQuery" placeholder="Cari nama company..." class="pl-9" />
          </div>

          <!-- Desktop/tablet — filter inline, tidak diubah. -->
          <div class="hidden sm:flex sm:flex-wrap sm:items-center gap-3">
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

          <ResponsiveFormSheet
            v-if="canManageParty"
            v-model:open="isCreateOpen"
            title="Tambah Prospect Baru"
            description="Party baru akan dibuat dengan lifecycle status Prospect."
            content-class="max-w-md"
          >
            <template #trigger>
              <Button class="w-full sm:w-auto sm:ml-auto"><Plus class="h-4 w-4 mr-1.5" />Tambah Prospect</Button>
            </template>
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
            <template #footer>
                <Button variant="outline" @click="isCreateOpen = false">
                  Batal
                </Button>
                <Button :disabled="!newName.trim()" @click="submitCreate">
                  Simpan
                </Button>
            </template>
          </ResponsiveFormSheet>
        </div>

        <!-- Mobile — 4 select (Status/Industri/Kota/Owner) + toggle Portfolio di belakang tombol Filter (bottom Sheet). -->
        <div class="sm:hidden">
          <Sheet v-model:open="isMobileFilterOpen">
            <SheetTrigger as-child>
              <Button variant="outline" size="sm" class="w-full justify-start">
                <SlidersHorizontal class="h-3.5 w-3.5 mr-1.5 shrink-0" />
                Filter
                <span v-if="activeFilterCount" class="ml-auto rounded-full bg-primary/10 px-1.5 py-0.5 text-[11px] font-semibold text-primary">
                  {{ activeFilterCount }}
                </span>
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" class="max-h-[85vh] overflow-y-auto rounded-t-2xl">
              <SheetHeader class="text-left">
                <SheetTitle>Filter Company</SheetTitle>
              </SheetHeader>
              <div class="space-y-3 py-4">
                <div class="space-y-1.5">
                  <Label class="text-xs text-muted-foreground">Status</Label>
                  <select v-model="statusFilter" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                    <option value="all">
                      Semua Status
                    </option>
                    <option v-for="status in LIFECYCLE_STATUSES" :key="status.value" :value="status.value">
                      {{ status.label }}
                    </option>
                  </select>
                </div>
                <div class="space-y-1.5">
                  <Label class="text-xs text-muted-foreground">Industri</Label>
                  <select v-model="industryFilter" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                    <option value="all">
                      Semua Industri
                    </option>
                    <option v-for="industry in industryOptions" :key="industry" :value="industry">
                      {{ industry }}
                    </option>
                  </select>
                </div>
                <div class="space-y-1.5">
                  <Label class="text-xs text-muted-foreground">Kota</Label>
                  <select v-model="cityFilter" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                    <option value="all">
                      Semua Kota
                    </option>
                    <option v-for="city in cityOptions" :key="city" :value="city">
                      {{ city }}
                    </option>
                  </select>
                </div>
                <div v-if="!isAeScoped" class="space-y-1.5">
                  <Label class="text-xs text-muted-foreground">Account Owner</Label>
                  <select v-model="ownerFilter" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                    <option value="all">
                      Semua Account Owner
                    </option>
                    <option v-for="user in ownerOptions" :key="user.id" :value="user.id">
                      {{ user.name }}
                    </option>
                  </select>
                </div>
                <label v-if="isAeScoped" class="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                  <Checkbox v-model="portfolioOnly" />
                  Hanya Portfolio Saya
                </label>
              </div>
              <SheetFooter class="flex-row gap-2">
                <Button variant="outline" class="flex-1" @click="isMobileFilterOpen = false">
                  Terapkan
                </Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      <SectionCard>
        <ResponsiveDataView v-if="rows.length" :items="rows" :get-key="row => row.party.id">
          <template #desktop="{ items }">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Kota</TableHead>
                  <TableHead>Telepon</TableHead>
                  <TableHead>Account Owner</TableHead>
                  <TableHead>Leads</TableHead>
                  <TableHead>Project Orders</TableHead>
                  <TableHead>Credit Limit</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="row in items" :key="row.party.id" class="cursor-pointer hover:bg-muted/50" @click="navigateTo(`/customer-journey/customers/${row.party.id}`)">
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
                  <TableCell>{{ row.leadCount }}</TableCell>
                  <TableCell>{{ row.projectOrderCount }}</TableCell>
                  <TableCell>
                    <template v-if="row.credit.limitIdr > 0">
                      <p class="text-sm" :class="row.credit.isOverLimit ? 'text-destructive font-medium' : 'text-foreground'">
                        {{ formatCurrencyIdr(row.credit.usedIdr) }} / {{ formatCurrencyIdr(row.credit.limitIdr) }}
                      </p>
                      <div class="mt-1 h-1.5 w-28 overflow-hidden rounded-full bg-muted">
                        <div class="h-full rounded-full" :class="row.credit.isOverLimit ? 'bg-destructive' : 'bg-primary'" :style="{ width: `${Math.min(100, row.credit.percentUsed)}%` }" />
                      </div>
                    </template>
                    <span v-else class="text-muted-foreground">Belum diset</span>
                  </TableCell>
                  <TableCell>
                    <Eye class="h-4 w-4 text-muted-foreground" />
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </template>

          <template #mobile-card="{ item: row }">
            <button
              type="button"
              class="w-full rounded-xl border border-border bg-card p-4 text-left transition-colors active:bg-muted"
              @click="navigateTo(`/customer-journey/customers/${row.party.id}`)"
            >
              <div class="flex items-start justify-between gap-2">
                <p class="text-sm font-medium text-foreground truncate">
                  {{ row.party.name }}
                </p>
                <div class="flex items-center gap-1.5 shrink-0">
                  <StatusBadge :label="findStatusOption(LIFECYCLE_STATUSES, row.party.lifecycleStatus).label" :tone="findStatusOption(LIFECYCLE_STATUSES, row.party.lifecycleStatus).tone" />
                  <StatusBadge v-if="row.party.lifecycleStatus === 'client' && isManovaClient(row.party.id)" label="Manova Client" tone="purple" />
                </div>
              </div>
              <div class="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p class="text-muted-foreground">
                    Kota
                  </p>
                  <p class="text-foreground">
                    {{ row.party.city ?? '—' }}
                  </p>
                </div>
                <div>
                  <p class="text-muted-foreground">
                    Telepon
                  </p>
                  <p class="text-foreground">
                    {{ row.party.phone ?? '—' }}
                  </p>
                </div>
                <div>
                  <p class="text-muted-foreground">
                    Account Owner
                  </p>
                  <p class="text-foreground">
                    {{ row.party.accountOwnerId ? getUserById(row.party.accountOwnerId)?.name ?? '—' : '—' }}
                  </p>
                </div>
                <div>
                  <p class="text-muted-foreground">
                    Leads / Project Orders
                  </p>
                  <p class="text-foreground">
                    {{ row.leadCount }} / {{ row.projectOrderCount }}
                  </p>
                </div>
              </div>
              <div v-if="row.credit.limitIdr > 0" class="mt-3 text-xs">
                <p class="text-muted-foreground">
                  Credit Limit
                </p>
                <p :class="row.credit.isOverLimit ? 'text-destructive font-medium' : 'text-foreground'">
                  {{ formatCurrencyIdr(row.credit.usedIdr) }} / {{ formatCurrencyIdr(row.credit.limitIdr) }}
                </p>
                <div class="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div class="h-full rounded-full" :class="row.credit.isOverLimit ? 'bg-destructive' : 'bg-primary'" :style="{ width: `${Math.min(100, row.credit.percentUsed)}%` }" />
                </div>
              </div>
            </button>
          </template>
        </ResponsiveDataView>

        <EmptyState
          v-else
          title="Tidak ada company"
          :description="searchQuery || statusFilter !== 'all' || industryFilter !== 'all' || cityFilter !== 'all' || ownerFilter !== 'all' ? 'Tidak ada company yang cocok dengan filter.' : (portfolioOnly ? 'Belum ada company di portfolio Anda.' : 'Belum ada company.')"
        />
      </SectionCard>
    </template>
  </div>
</template>
