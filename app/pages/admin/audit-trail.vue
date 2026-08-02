<script setup lang="ts">
import { ref, computed } from 'vue'
import { Search } from 'lucide-vue-next'
import { ACTIVITIES, SYSTEM_EVENTS, PROJECTS, getUserById, getProjectById } from '~/data'
import { formatDateTime } from '~/utils/format'
import { ROLES } from '~/constants/roles'
import { findStatusOption } from '~/constants/status'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Audit Trail — Administration' })

const { canView } = usePermissions()

// Filters (3 dropdown existing, TIDAK diubah/direstrukturisasi)
const projectFilter = ref<'all' | string>('all')
const typeFilter = ref<'all' | 'change' | 'activity'>('all')
const reviewFilter = ref<'all' | 'reviewed' | 'unreviewed'>('all')

/**
 * Free-text search (Section 23 — Administration, Master Data dan Audit, roadmap Section 00–24 baru,
 * D-080, Wajib "Audit trail search"). Aditif ke 3 filter dropdown existing — TIDAK menghapus/merestrukturisasi
 * apa pun. Mencari lintas `ActivityEntry.message`/`reason`/`impactNote`/`category` (existing, di atas) DAN
 * `SystemEvent.message`/`type` (SectionCard baru "Log Sistem (Non-Project)" di bawah) — dua entitas berbeda,
 * satu search box, tanpa membuat entitas audit ketiga (menghormati D-076).
 */
const searchQuery = ref('')

// All entries sorted latest-first
const allEntries = [...ACTIVITIES].sort((a, b) => b.createdAt.localeCompare(a.createdAt))

const filteredEntries = computed(() => {
  let result = allEntries
  if (projectFilter.value !== 'all') {
    result = result.filter(e => e.projectId === projectFilter.value)
  }
  if (typeFilter.value === 'change') {
    result = result.filter(e => e.isChange)
  } else if (typeFilter.value === 'activity') {
    result = result.filter(e => !e.isChange)
  }
  if (reviewFilter.value === 'reviewed') {
    result = result.filter(e => e.reviewed)
  } else if (reviewFilter.value === 'unreviewed') {
    result = result.filter(e => !e.reviewed)
  }
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.trim().toLowerCase()
    result = result.filter(e =>
      e.message.toLowerCase().includes(q) ||
      (e.reason ?? '').toLowerCase().includes(q) ||
      (e.impactNote ?? '').toLowerCase().includes(q) ||
      (e.category ?? '').toLowerCase().includes(q) ||
      (e.beforeValue ?? '').toLowerCase().includes(q) ||
      (e.afterValue ?? '').toLowerCase().includes(q)
    )
  }
  return result
})

// Log Sistem (Non-Project) — SystemEvent, module 'administration' dkk. (Prompt 19 + Section 23). Search-only, TIDAK punya 3 filter dropdown existing (scope berbeda dari ActivityEntry — lintas-modul, bukan project-scoped).
const allSystemEvents = [...SYSTEM_EVENTS].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
const filteredSystemEvents = computed(() => {
  if (!searchQuery.value.trim()) { return allSystemEvents }
  const q = searchQuery.value.trim().toLowerCase()
  return allSystemEvents.filter(e => e.message.toLowerCase().includes(q) || e.type.toLowerCase().includes(q) || e.module.toLowerCase().includes(q))
})

// Stats
const totalEntries = computed(() => allEntries.length)
const changeCount = computed(() => allEntries.filter(e => e.isChange).length)
const unreviewedCount = computed(() => allEntries.filter(e => e.isChange && !e.reviewed).length)

function userLabel (userId?: string): string {
  if (!userId) { return '—' }
  const user = getUserById(userId)
  if (!user) { return userId }
  const roleLabel = findStatusOption(ROLES, user.role).label
  return `${user.name} (${roleLabel})`
}

function projectLabel (projectId: string): string {
  return getProjectById(projectId)?.name ?? projectId
}

// Change category tone
const CAT_TONE: Record<string, string> = {
  traveler: 'info',
  itinerary: 'primary',
  service: 'purple',
  vendor: 'warning',
  budget: 'destructive',
  other: 'neutral'
}
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Audit Trail"
      description="Log aktivitas dan perubahan lintas project. Konsisten dengan tab Activity & Changes tiap Project Detail."
      :breadcrumb="[{ label: 'Administration', to: '/admin' }, { label: 'Audit Trail' }]"
    />

    <RoleAccessState v-if="!canView('administration')" module-label="modul Administration" />

    <template v-else>
      <!-- Summary stats -->
      <div class="grid grid-cols-3 gap-3">
        <div class="rounded-xl border border-border bg-card px-4 py-3 text-sm">
          <p class="text-muted-foreground text-xs mb-0.5">
            Total Entri
          </p>
          <p class="text-xl font-semibold text-foreground">
            {{ totalEntries }}
          </p>
        </div>
        <div class="rounded-xl border border-border bg-card px-4 py-3 text-sm">
          <p class="text-muted-foreground text-xs mb-0.5">
            Perubahan (isChange)
          </p>
          <p class="text-xl font-semibold text-foreground">
            {{ changeCount }}
          </p>
        </div>
        <div class="rounded-xl border border-border bg-card px-4 py-3 text-sm">
          <p class="text-muted-foreground text-xs mb-0.5">
            Perubahan Belum Ditinjau
          </p>
          <p class="text-xl font-semibold" :class="unreviewedCount > 0 ? 'text-warning' : 'text-success'">
            {{ unreviewedCount }}
          </p>
        </div>
      </div>

      <!-- Search (Section 23, D-080) — lintas ActivityEntry dan SystemEvent, aditif ke 3 filter dropdown di bawah -->
      <div class="relative max-w-sm w-full">
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input v-model="searchQuery" placeholder="Cari pesan, alasan, dampak, kategori..." class="pl-9" />
      </div>

      <!-- Filters -->
      <div class="flex flex-wrap items-center gap-3">
        <select
          v-model="projectFilter"
          class="appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer"
        >
          <option value="all">
            Semua Project
          </option>
          <option v-for="project in PROJECTS" :key="project.id" :value="project.id">
            {{ project.name }}
          </option>
        </select>

        <select
          v-model="typeFilter"
          class="appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer"
        >
          <option value="all">
            Semua Tipe
          </option>
          <option value="change">
            Perubahan saja
          </option>
          <option value="activity">
            Aktivitas saja
          </option>
        </select>

        <select
          v-model="reviewFilter"
          class="appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer"
        >
          <option value="all">
            Semua Status Tinjauan
          </option>
          <option value="reviewed">
            Sudah Ditinjau
          </option>
          <option value="unreviewed">
            Belum Ditinjau
          </option>
        </select>

        <span class="text-xs text-muted-foreground ml-auto">
          Menampilkan {{ filteredEntries.length }} dari {{ totalEntries }} entri
        </span>
      </div>

      <!-- Log entries -->
      <SectionCard>
        <EmptyState
          v-if="filteredEntries.length === 0"
          title="Tidak ada entri"
          description="Tidak ada aktivitas yang cocok dengan filter saat ini."
        />

        <ul v-else class="divide-y divide-border">
          <li
            v-for="entry in filteredEntries"
            :key="entry.id"
            class="py-4 space-y-2"
          >
            <div class="flex items-start justify-between gap-4">
              <div class="flex-1 min-w-0">
                <p class="text-sm text-foreground leading-snug">
                  {{ entry.message }}
                </p>
                <p class="text-xs text-muted-foreground mt-0.5">
                  <span class="font-medium text-foreground/70">{{ projectLabel(entry.projectId) }}</span>
                  &nbsp;·&nbsp;{{ formatDateTime(entry.createdAt) }}
                  &nbsp;·&nbsp;<span class="font-mono text-xs">{{ entry.id }}</span>
                </p>
              </div>
              <div class="flex items-center gap-1.5 shrink-0">
                <StatusBadge
                  v-if="entry.isChange"
                  label="Perubahan"
                  tone="warning"
                />
                <StatusBadge
                  v-else
                  label="Aktivitas"
                  tone="neutral"
                />
                <StatusBadge
                  v-if="entry.isChange"
                  :label="entry.reviewed ? 'Ditinjau' : 'Belum Ditinjau'"
                  :tone="entry.reviewed ? 'success' : 'destructive'"
                />
              </div>
            </div>

            <!-- Change detail (bila isChange) -->
            <div
              v-if="entry.isChange && (entry.category || entry.requestedBy || entry.approvalStatus)"
              class="pl-0 grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-1 text-xs"
            >
              <div v-if="entry.category">
                <span class="text-muted-foreground">Kategori:</span>
                <StatusBadge
                  :label="entry.category"
                  :tone="(CAT_TONE[entry.category] as any) ?? 'neutral'"
                  class="ml-1"
                />
              </div>
              <div v-if="entry.requestedBy">
                <span class="text-muted-foreground">Diajukan oleh:</span>
                <span class="ml-1 text-foreground">{{ userLabel(entry.requestedBy) }}</span>
              </div>
              <div v-if="entry.approvedBy">
                <span class="text-muted-foreground">Disetujui oleh:</span>
                <span class="ml-1 text-foreground">{{ userLabel(entry.approvedBy) }}</span>
              </div>
              <div v-if="entry.approvalStatus">
                <span class="text-muted-foreground">Status:</span>
                <StatusBadge
                  :label="entry.approvalStatus === 'approved' ? 'Disetujui' : entry.approvalStatus === 'rejected' ? 'Ditolak' : 'Menunggu'"
                  :tone="entry.approvalStatus === 'approved' ? 'success' : entry.approvalStatus === 'rejected' ? 'destructive' : 'warning'"
                  class="ml-1"
                />
              </div>
              <div v-if="entry.beforeValue && entry.afterValue" class="col-span-2 sm:col-span-4">
                <span class="text-muted-foreground">Perubahan:</span>
                <span class="ml-1 line-through text-muted-foreground">{{ entry.beforeValue }}</span>
                <span class="mx-1 text-muted-foreground">→</span>
                <span class="font-medium text-foreground">{{ entry.afterValue }}</span>
              </div>
              <div v-if="entry.impactNote" class="col-span-2 sm:col-span-4 text-muted-foreground">
                <span class="font-medium">Dampak:</span> {{ entry.impactNote }}
              </div>
            </div>
          </li>
        </ul>
      </SectionCard>

      <!--
        Log Sistem (Non-Project) — SystemEvent (Section 23, D-080). SectionCard TERPISAH, aditif di bawah
        log ActivityEntry existing di atas (TIDAK digabung jadi satu list — dua entitas berbeda shape/scope,
        ActivityEntry project-scoped vs SystemEvent lintas-modul level-atas). Search box di atas berlaku ke
        KEDUA section ini sekaligus.
      -->
      <SectionCard
        title="Log Sistem (Non-Project)"
        description="SystemEvent lintas-modul level-atas (lead/opportunity/quotation/client/project-order/vendor/finance/user/administration) — termasuk aksi admin baru (master data, organization profile, suspend/reactivate user)."
      >
        <EmptyState
          v-if="filteredSystemEvents.length === 0"
          title="Tidak ada entri"
          description="Tidak ada log sistem yang cocok dengan pencarian."
        />
        <ul v-else class="divide-y divide-border">
          <li v-for="event in filteredSystemEvents" :key="event.id" class="py-3 space-y-1">
            <div class="flex items-start justify-between gap-4">
              <p class="text-sm text-foreground leading-snug flex-1 min-w-0">
                {{ event.message }}
              </p>
              <StatusBadge :label="event.module" tone="neutral" class="shrink-0" />
            </div>
            <p class="text-xs text-muted-foreground">
              <span class="font-mono">{{ event.type }}</span>
              &nbsp;·&nbsp;{{ formatDateTime(event.createdAt) }}
              <template v-if="event.userId">
                &nbsp;·&nbsp;{{ userLabel(event.userId) }}
              </template>
              &nbsp;·&nbsp;<span class="font-mono text-xs">{{ event.id }}</span>
            </p>
          </li>
        </ul>
      </SectionCard>
    </template>
  </div>
</template>
