<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  Search, CheckCheck, Bell, ClipboardCheck, FolderKanban, Users, CalendarClock, FileText, Receipt,
  PlaneTakeoff, LifeBuoy
} from 'lucide-vue-next'
import type { Component } from 'vue'
import {
  getPartyById, getNotificationsForUser, getUnreadNotificationCount, markNotificationRead,
  markAllNotificationsRead, TRAVELERS, INVOICES
} from '~/data'
import { NOTIFICATION_CATEGORIES, findStatusOption } from '~/constants/status'
import { formatDateTime } from '~/utils/format'
import type { Notification, NotificationCategory } from '~/types/document-comms'

/**
 * Client Notifications (Repair Phase Section 2 — Home). Full implementation menggantikan
 * `ModulePlaceholder` Section 1 — REUSE penuh entitas `Notification`/`getNotificationsForUser`/
 * `getUnreadNotificationCount`/`markNotificationRead`/`markAllNotificationsRead` (Section 21, LOCKED
 * shape), TIDAK membuat entitas notifikasi kedua. Isolasi otomatis lewat `userId === currentUser.id`
 * (pola sama `NotificationPanel.vue`) — tidak perlu filter `clientScopeId` tambahan karena `Notification`
 * sudah per-user, bukan per-company.
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Notifications' })

const { canView, clientScopeId } = usePermissions()
const { currentUser } = useCurrentUser()
const { showToast } = useToast()

const party = computed(() => (clientScopeId.value ? getPartyById(clientScopeId.value) : undefined))

/** Data seluruhnya fixture sinkron (bukan fetch async nyata) — TIDAK ada delay buatan (lihat `app/pages/index.vue`, D-079: delay client-only membuat konten SSR yang sudah benar sempat "hilang" jadi skeleton setelah hydration). `isLoading` disediakan agar `LoadingState` tetap terpasang untuk skenario async masa depan. */
const isLoading = ref(false)

const search = ref('')
const categoryFilter = ref<'all' | NotificationCategory>('all')
const unreadOnly = ref(false)

const notifications = computed(() => getNotificationsForUser(currentUser.value.id))
const unreadCount = computed(() => getUnreadNotificationCount(currentUser.value.id))
const hasAnyFilter = computed(() => Boolean(search.value.trim()) || categoryFilter.value !== 'all' || unreadOnly.value)

const filteredNotifications = computed(() => {
  let result = notifications.value
  if (categoryFilter.value !== 'all') { result = result.filter(item => item.category === categoryFilter.value) }
  if (unreadOnly.value) { result = result.filter(item => !item.read) }
  if (search.value.trim()) {
    const q = search.value.toLowerCase()
    result = result.filter(item => item.title.toLowerCase().includes(q) || item.body.toLowerCase().includes(q))
  }
  return result
})

const CATEGORY_ICON_MAP: Record<NotificationCategory, Component> = {
  approval: ClipboardCheck,
  project: FolderKanban,
  participant: Users,
  reservation: CalendarClock,
  document: FileText,
  payment: Receipt,
  trip: PlaneTakeoff,
  support: LifeBuoy,
  system: Bell
}
const categoryIcon = (category?: NotificationCategory) => CATEGORY_ICON_MAP[category ?? 'system']
const categoryLabel = (category?: NotificationCategory) => findStatusOption(NOTIFICATION_CATEGORIES, category ?? 'system').label
const categoryTone = (category?: NotificationCategory) => findStatusOption(NOTIFICATION_CATEGORIES, category ?? 'system').tone

/**
 * "Related entity navigation" (Wajib) — memetakan `entityType`/`entityId` ke halaman Client yang SUDAH
 * bekerja. `entityType` yang dipakai notifikasi Client saat ini: `project`/`traveler`/`invoice`
 * (`/client/project-orders/[id]`, tab sesuai konteks), plus `travel-request`/`quotation` (Repair Phase
 * Section 3 — Request & Commercial, lihat `runTravelRequestMockReview`/`submitTravelRequest` di
 * `app/data/index.ts`) yang mengarah langsung ke halaman detail masing-masing via `entityId`.
 */
function notificationRoute (notification: Notification): string | undefined {
  if (notification.entityType === 'project' && notification.entityId) {
    return `/client/project-orders/${notification.entityId}`
  }
  if (notification.entityType === 'traveler' && notification.entityId) {
    const traveler = TRAVELERS.find(item => item.id === notification.entityId)
    return traveler ? `/client/project-orders/${traveler.projectId}?tab=travelers` : undefined
  }
  if (notification.entityType === 'invoice' && notification.entityId) {
    const invoice = INVOICES.find(item => item.id === notification.entityId)
    return invoice ? `/client/project-orders/${invoice.projectId}?tab=finance` : undefined
  }
  if (notification.entityType === 'travel-request' && notification.entityId) {
    return `/client/travel-requests/${notification.entityId}`
  }
  if (notification.entityType === 'quotation' && notification.entityId) {
    return `/client/quotations/${notification.entityId}`
  }
  return undefined
}

function openNotification (notification: Notification) {
  markNotificationRead(notification.id)
  const target = notificationRoute(notification)
  if (target) { navigateTo(target) }
}

/** Notification preference (Wajib "Notification preference mock") — murni UI simulation (D-006), tersimpan per sesi halaman, TIDAK terhubung ke pengiriman nyata (konsisten pola `deliveryChannel`/`deliveryStatus` Section 21). */
function buildPreferenceDefaults (): Record<NotificationCategory, boolean> {
  const defaults = {} as Record<NotificationCategory, boolean>
  for (const option of NOTIFICATION_CATEGORIES) { defaults[option.value] = true }
  return defaults
}
const emailPreferences = ref<Record<NotificationCategory, boolean>>(buildPreferenceDefaults())
const inAppPreferences = ref<Record<NotificationCategory, boolean>>(buildPreferenceDefaults())

function savePreferences () {
  showToast('Preferensi Disimpan', 'Preferensi notifikasi Anda telah diperbarui (mock, belum terhubung ke pengiriman email/in-app nyata).', 'success')
}
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Notifications"
      description="Notifikasi in-app untuk Anda — approval, participant, reservation, payment, trip, dan support."
      :breadcrumb="[{ label: 'Client Portal', to: '/client' }, { label: 'Home' }, { label: 'Notifications' }]"
    >
      <template v-if="unreadCount > 0" #actions>
        <Button size="sm" variant="outline" @click="markAllNotificationsRead(currentUser.id)">
          <CheckCheck class="h-4 w-4 mr-1.5" />Mark All Read
        </Button>
      </template>
    </PageHeader>

    <RoleAccessState v-if="!canView('client-portal')" module-label="Client Portal" />
    <ErrorState v-else-if="!party" description="Profil company untuk akun Anda tidak ditemukan. Hubungi Account Executive Anda." />
    <LoadingState v-else-if="isLoading" message="Memuat notifikasi..." />

    <template v-else>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatsCard title="Total Notifikasi" :value="String(notifications.length)" :icon="Bell" />
        <StatsCard title="Belum Dibaca" :value="String(unreadCount)" :icon="Bell" icon-color="warning" />
      </div>

      <SectionCard title="Notification Preferences" description="Mock — belum terhubung ke pengiriman email/in-app nyata.">
        <div class="space-y-3">
          <div v-for="option in NOTIFICATION_CATEGORIES" :key="option.value" class="flex items-center justify-between gap-3 py-1.5 border-b border-border last:border-0">
            <span class="text-sm text-foreground">{{ option.label }}</span>
            <div class="flex items-center gap-4">
              <label class="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                <Checkbox v-model="inAppPreferences[option.value]" />In-app
              </label>
              <label class="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                <Checkbox v-model="emailPreferences[option.value]" />Email
              </label>
            </div>
          </div>
        </div>
        <div class="mt-4">
          <Button size="sm" variant="outline" @click="savePreferences">
            Simpan Preferensi
          </Button>
        </div>
      </SectionCard>

      <SectionCard>
        <div class="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
          <div class="relative flex-1 max-w-sm w-full">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input v-model="search" placeholder="Cari notifikasi..." class="pl-9" />
          </div>
          <select v-model="categoryFilter" aria-label="Filter kategori notifikasi" class="appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
            <option value="all">
              Semua Category
            </option>
            <option v-for="option in NOTIFICATION_CATEGORIES" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
          <label class="flex items-center gap-2 text-sm text-foreground cursor-pointer shrink-0">
            <Checkbox v-model="unreadOnly" />Hanya belum dibaca
          </label>
        </div>

        <ul v-if="filteredNotifications.length" class="divide-y divide-border">
          <li
            v-for="notification in filteredNotifications"
            :key="notification.id"
            :class="['py-3 flex items-start gap-3 cursor-pointer rounded transition-colors hover:bg-muted/50', !notification.read && 'bg-primary/5 -mx-4 px-4']"
            @click="openNotification(notification)"
          >
            <component :is="categoryIcon(notification.category)" class="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-1.5 mb-1 flex-wrap">
                <StatusBadge :label="categoryLabel(notification.category)" :tone="categoryTone(notification.category)" />
                <span v-if="!notification.read" class="w-1.5 h-1.5 bg-primary rounded-full" />
              </div>
              <p class="text-sm font-medium text-foreground">
                {{ notification.title }}
              </p>
              <p class="text-sm text-muted-foreground">
                {{ notification.body }}
              </p>
              <p class="text-xs text-muted-foreground mt-0.5">
                {{ formatDateTime(notification.createdAt) }}
              </p>
            </div>
          </li>
        </ul>
        <EmptyState
          v-else
          :icon="Bell"
          :title="hasAnyFilter ? 'Tidak ada notifikasi yang cocok' : 'Belum ada notifikasi'"
          :description="hasAnyFilter ? 'Coba ubah kata kunci pencarian atau filter.' : 'Notifikasi baru akan muncul di sini.'"
        />
      </SectionCard>
    </template>
  </div>
</template>
