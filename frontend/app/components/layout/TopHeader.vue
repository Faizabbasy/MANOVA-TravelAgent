<script setup lang="ts">
import { ref, computed } from 'vue'
import { Bell, ChevronRight } from 'lucide-vue-next'
import { useRoute } from 'vue-router'
import { ROLES } from '~/constants/roles'
import { findStatusOption } from '~/constants/status'
import { findNavItemForPath, NAV_ITEMS } from '~/constants/navigation'

const notificationPanelRef = ref()
const unreadCount = computed(() => notificationPanelRef.value?.unreadCount || 0)

const route = useRoute()
const { currentUser, currentRole } = useCurrentUser()
const roleOption = computed(() => findStatusOption(ROLES.value, currentRole.value))

/**
 * Refinement UI: header sebelumnya hanya berisi "Masuk sebagai …" — 90% ruang paling atas terbuang
 * padahal itu tempat orang mencari orientasi. Kini menampilkan jejak lokasi (modul → halaman), sehingga
 * pengguna selalu tahu ia sedang berada di mana tanpa harus memindai sidebar.
 */
const location = computed(() => {
  const current = findNavItemForPath(route.path)
  if (!current) { return undefined }

  const parent = NAV_ITEMS.find(item =>
    item.key === current.key || item.children?.some(child => child.key === current.key))

  return {
    module: parent && parent.key !== current.key ? parent.label : undefined,
    page: current.label
  }
})
</script>

<template>
  <header class="sticky top-0 z-10 flex h-14 items-center justify-between gap-4 border-b border-border bg-card/95 px-6 backdrop-blur supports-[backdrop-filter]:bg-card/80">
    <div class="flex min-w-0 items-center gap-1.5 text-sm">
      <template v-if="location">
        <span v-if="location.module" class="hidden truncate text-muted-foreground sm:inline">{{ location.module }}</span>
        <ChevronRight v-if="location.module" class="hidden h-3.5 w-3.5 shrink-0 text-muted-foreground/60 sm:inline" />
        <span class="truncate font-medium text-foreground">{{ location.page }}</span>
      </template>
    </div>

    <div class="flex shrink-0 items-center gap-3">
      <div class="hidden items-center gap-2 text-sm md:flex">
        <span class="text-muted-foreground">Masuk sebagai</span>
        <span class="font-medium text-foreground">{{ currentUser.name }}</span>
        <StatusBadge :label="roleOption.label" :tone="roleOption.tone" dot />
      </div>

      <Popover>
        <PopoverTrigger as-child>
          <button
            class="relative rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Notifikasi"
          >
            <Bell class="h-[18px] w-[18px]" />
            <span
              v-if="unreadCount > 0"
              class="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive ring-2 ring-card"
            />
          </button>
        </PopoverTrigger>
        <PopoverContent class="w-auto p-0" align="end">
          <NotificationPanel ref="notificationPanelRef" />
        </PopoverContent>
      </Popover>
    </div>
  </header>
</template>
