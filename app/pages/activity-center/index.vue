<script setup lang="ts">
import { ref, computed } from 'vue'
import { SYSTEM_EVENTS, getUserById } from '~/data'
import { formatDateTime } from '~/utils/format'
import type { SystemEventModule } from '~/types/activity'
import type { BadgeTone } from '~/types/common'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Activity Center' })

const { currentRole } = useCurrentUser()

/**
 * Activity Center (Prompt 19 — Change Request) — Super Admin saja, BUKAN `canView('administration')` generik
 * (yang juga memberi Management/Viewer akses ke `/admin/audit-trail`) — narrow role exception, pola sama
 * seperti `canManageOpportunity` dst., karena literal Prompt 19-6 hanya menyebut "Super Admin".
 */
const hasAccess = computed(() => currentRole.value === 'super-admin')

const MODULE_LABELS: Record<SystemEventModule, string> = {
  lead: 'Lead', opportunity: 'Opportunity', quotation: 'Quotation', client: 'Client',
  'project-order': 'Project Order', vendor: 'Vendor', finance: 'Finance', user: 'User',
}
const MODULE_TONES: Record<SystemEventModule, BadgeTone> = {
  lead: 'neutral', opportunity: 'primary', quotation: 'warning', client: 'success',
  'project-order': 'info', vendor: 'purple', finance: 'destructive', user: 'neutral',
}

const searchQuery = ref('')
const moduleFilter = ref<'all' | SystemEventModule>('all')
const userFilter = ref<'all' | string>('all')

const userOptions = computed(() => {
  const ids = [...new Set(SYSTEM_EVENTS.map(event => event.userId).filter(Boolean))] as string[]
  return ids.map(id => getUserById(id)).filter((user): user is NonNullable<typeof user> => Boolean(user))
})

const allEvents = [...SYSTEM_EVENTS].sort((a, b) => b.createdAt.localeCompare(a.createdAt))

const filteredEvents = computed(() => {
  let result = allEvents
  if (moduleFilter.value !== 'all') result = result.filter(event => event.module === moduleFilter.value)
  if (userFilter.value !== 'all') result = result.filter(event => event.userId === userFilter.value)
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(event => event.message.toLowerCase().includes(q) || (event.entityId ?? '').toLowerCase().includes(q))
  }
  return result
})

const moduleCounts = computed(() => {
  const map = new Map<SystemEventModule, number>()
  for (const event of SYSTEM_EVENTS) map.set(event.module, (map.get(event.module) ?? 0) + 1)
  return map
})
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Activity Center"
      description="Log aktivitas lintas sistem — lead, opportunity, quotation, client, project order, vendor, finance, user."
      :breadcrumb="[{ label: 'Activity Center' }]"
    />

    <RoleAccessState v-if="!hasAccess" module-label="Activity Center" />

    <template v-else>
      <div class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        <div v-for="[module, count] in moduleCounts" :key="module" class="rounded-xl border border-border bg-card px-4 py-3 text-sm">
          <p class="text-muted-foreground text-xs">{{ MODULE_LABELS[module] }}</p>
          <p class="text-xl font-semibold text-foreground mt-1">{{ count }}</p>
        </div>
      </div>

      <div class="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-3">
        <Input v-model="searchQuery" placeholder="Cari pesan atau entity ID..." class="max-w-sm" />
        <select v-model="moduleFilter" class="appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
          <option value="all">Semua Modul</option>
          <option v-for="(label, key) in MODULE_LABELS" :key="key" :value="key">{{ label }}</option>
        </select>
        <select v-model="userFilter" class="appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
          <option value="all">Semua User</option>
          <option v-for="user in userOptions" :key="user.id" :value="user.id">{{ user.name }}</option>
        </select>
        <span class="text-xs text-muted-foreground ml-auto">Menampilkan {{ filteredEvents.length }} dari {{ allEvents.length }} entri</span>
      </div>

      <SectionCard>
        <ul v-if="filteredEvents.length" class="divide-y divide-border">
          <li v-for="event in filteredEvents" :key="event.id" class="py-3 flex items-start justify-between gap-4">
            <div class="min-w-0">
              <p class="text-sm text-foreground">{{ event.message }}</p>
              <p class="text-xs text-muted-foreground">
                {{ formatDateTime(event.createdAt) }}
                <template v-if="event.entityId"> · <span class="font-mono">{{ event.entityId }}</span></template>
                <template v-if="event.userId"> · {{ getUserById(event.userId)?.name ?? event.userId }}</template>
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
