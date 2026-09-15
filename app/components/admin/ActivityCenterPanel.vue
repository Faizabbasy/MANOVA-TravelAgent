<script setup lang="ts">
import { ref, computed } from 'vue'
import { SlidersHorizontal } from 'lucide-vue-next'
import { SYSTEM_EVENTS, VENDOR_QUOTATIONS, getUserById, getQuotationById, getPartyById, getProjectById } from '~/data'
import { formatDateTime } from '~/utils/format'
import type { SystemEvent, SystemEventModule } from '~/types/activity'
import type { BadgeTone } from '~/types/common'

/**
 * Tab "Activity Center" — Menu Administration > Audit & Activity (Penyederhanaan 7-Role/Menu). Dulu
 * `/activity-center`, kini tab dalam satu menu bersama Audit Trail — logika tidak diubah.
 *
 * Gate BUKAN `canView('administration')` generik (yang juga memberi Management akses ke tab Audit Trail).
 * Digerbangi capability `admin.view-activity-center` yang secara default hanya dipegang Super Admin.
 */

const { can } = usePermissions()

const hasAccess = computed(() => can('admin.view-activity-center'))

const MODULE_LABELS: Record<SystemEventModule, string> = {
  lead: 'Lead',
  quotation: 'Quotation',
  client: 'Client',
  'project-order': 'Project Order',
  vendor: 'Vendor',
  finance: 'Finance',
  user: 'User',
  administration: 'Administration'
}
const MODULE_TONES: Record<SystemEventModule, BadgeTone> = {
  lead: 'neutral',
  quotation: 'warning',
  client: 'success',
  'project-order': 'info',
  vendor: 'purple',
  finance: 'destructive',
  user: 'neutral',
  administration: 'neutral'
}

const searchQuery = ref('')
const moduleFilter = ref<'all' | SystemEventModule>('all')
const userFilter = ref<'all' | string>('all')

const userOptions = computed(() => {
  const ids = [...new Set(SYSTEM_EVENTS.map(event => event.userId).filter(Boolean))] as string[]
  return ids.map(id => getUserById(id)).filter((user): user is NonNullable<typeof user> => Boolean(user))
})

const allEvents = [...SYSTEM_EVENTS].sort((a, b) => b.createdAt.localeCompare(a.createdAt))

/** Filter di mobile — 2 select (Modul/User) disembunyikan di belakang tombol Filter (bottom Sheet),
 * pola sama SalesLeadsPanel — search tetap tampil langsung. */
const isMobileFilterOpen = ref(false)
const activeFilterCount = computed(() => [
  moduleFilter.value !== 'all',
  userFilter.value !== 'all'
].filter(Boolean).length)

const filteredEvents = computed(() => {
  let result = allEvents
  if (moduleFilter.value !== 'all') { result = result.filter(event => event.module === moduleFilter.value) }
  if (userFilter.value !== 'all') { result = result.filter(event => event.userId === userFilter.value) }
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(event => event.message.toLowerCase().includes(q) || (event.entityId ?? '').toLowerCase().includes(q))
  }
  return result
})

const moduleCounts = computed(() => {
  const map = new Map<SystemEventModule, number>()
  for (const event of SYSTEM_EVENTS) { map.set(event.module, (map.get(event.module) ?? 0) + 1) }
  return map
})

/**
 * Drill-down link per event (Section 22) — memetakan `module`+`entityId` ke route detail yang SUDAH ADA,
 * HANYA bila pemetaannya aman/jelas. Module `lead`/`finance`/`user` SENGAJA tidak menghasilkan link —
 * bukan gap tersembunyi, didokumentasikan di `docs/frontend-known-issues.md` bagian 17.
 */
function eventLink (event: SystemEvent): string | undefined {
  if (!event.entityId) { return undefined }
  switch (event.module) {
    case 'quotation': {
      const quotation = getQuotationById(event.entityId)
      return quotation ? `/crm/leads/${quotation.leadId}` : undefined
    }
    case 'client':
      return getPartyById(event.entityId) ? `/crm/parties/${event.entityId}` : undefined
    case 'project-order':
      return getProjectById(event.entityId) ? `/project-orders/${event.entityId}` : undefined
    case 'vendor': {
      // `entityId` untuk module `vendor` adalah ID VendorQuotation (mis. VQ-009), bukan ID Vendor — tautkan ke Vendor pemilik quotation tsb.
      const vendorQuotation = VENDOR_QUOTATIONS.find(q => q.id === event.entityId)
      return vendorQuotation ? `/vendors/${vendorQuotation.vendorId}` : undefined
    }
    default:
      return undefined
  }
}
</script>

<template>
  <div class="space-y-6">
    <RoleAccessState v-if="!hasAccess" module-label="Activity Center" />

    <template v-else>
      <div class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        <div v-for="[module, count] in moduleCounts" :key="module" class="rounded-xl border border-border bg-card px-4 py-3 text-sm">
          <p class="text-muted-foreground text-xs">
            {{ MODULE_LABELS[module] }}
          </p>
          <p class="text-xl font-semibold text-foreground mt-1">
            {{ count }}
          </p>
        </div>
      </div>

      <div class="space-y-3">
        <div class="flex flex-col lg:flex-row lg:items-center gap-3">
          <Input v-model="searchQuery" placeholder="Cari pesan atau entity ID..." class="max-w-sm" />

          <!-- Desktop/tablet — filter inline, tidak diubah. -->
          <div class="hidden lg:flex lg:items-center gap-3">
            <select v-model="moduleFilter" class="appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
              <option value="all">
                Semua Modul
              </option>
              <option v-for="(label, key) in MODULE_LABELS" :key="key" :value="key">
                {{ label }}
              </option>
            </select>
            <select v-model="userFilter" class="appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
              <option value="all">
                Semua User
              </option>
              <option v-for="user in userOptions" :key="user.id" :value="user.id">
                {{ user.name }}
              </option>
            </select>
            <span class="text-xs text-muted-foreground ml-auto">Menampilkan {{ filteredEvents.length }} dari {{ allEvents.length }} entri</span>
          </div>
        </div>

        <!-- Mobile — 2 select di belakang tombol Filter (bottom Sheet), supaya tidak numpuk vertikal. -->
        <div class="lg:hidden">
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
                <SheetTitle>Filter Activity Center</SheetTitle>
              </SheetHeader>
              <div class="space-y-3 py-4">
                <div class="space-y-1.5">
                  <Label class="text-xs text-muted-foreground">Modul</Label>
                  <select v-model="moduleFilter" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                    <option value="all">
                      Semua Modul
                    </option>
                    <option v-for="(label, key) in MODULE_LABELS" :key="key" :value="key">
                      {{ label }}
                    </option>
                  </select>
                </div>
                <div class="space-y-1.5">
                  <Label class="text-xs text-muted-foreground">User</Label>
                  <select v-model="userFilter" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                    <option value="all">
                      Semua User
                    </option>
                    <option v-for="user in userOptions" :key="user.id" :value="user.id">
                      {{ user.name }}
                    </option>
                  </select>
                </div>
              </div>
              <SheetFooter class="flex-row gap-2">
                <Button variant="outline" class="flex-1" @click="isMobileFilterOpen = false">
                  Terapkan
                </Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        </div>

        <p class="lg:hidden text-xs text-muted-foreground">
          Menampilkan {{ filteredEvents.length }} dari {{ allEvents.length }} entri
        </p>
      </div>

      <SectionCard>
        <ul v-if="filteredEvents.length" class="divide-y divide-border">
          <li v-for="event in filteredEvents" :key="event.id" class="py-3 flex items-start justify-between gap-4">
            <div class="min-w-0">
              <NuxtLink v-if="eventLink(event)" :to="eventLink(event) ?? '/admin/audit-trail#activity-center'" class="text-sm text-foreground hover:underline">
                {{ event.message }}
              </NuxtLink>
              <p v-else class="text-sm text-foreground">
                {{ event.message }}
              </p>
              <p class="text-xs text-muted-foreground">
                {{ formatDateTime(event.createdAt) }}
                <template v-if="event.entityId">
                  · <span class="font-mono">{{ event.entityId }}</span>
                </template>
                <template v-if="event.userId">
                  · {{ getUserById(event.userId)?.name ?? event.userId }}
                </template>
              </p>
            </div>
            <StatusBadge :label="MODULE_LABELS[event.module]" :tone="MODULE_TONES[event.module]" />
          </li>
        </ul>
        <EmptyState v-else title="Tidak ada event yang cocok dengan filter" />
      </SectionCard>
    </template>
  </div>
</template>
