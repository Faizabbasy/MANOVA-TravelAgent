<script setup lang="ts">
import { ref, computed } from 'vue'
import { Bell } from 'lucide-vue-next'
import { ROLES } from '~/constants/roles'
import { findStatusOption } from '~/constants/status'

const notificationPanelRef = ref()
const unreadCount = computed(() => notificationPanelRef.value?.unreadCount || 0)

const { currentUser, currentRole } = useCurrentUser()
const roleOption = computed(() => findStatusOption(ROLES, currentRole.value))
</script>

<template>
  <header class="h-16 bg-card border-b border-border flex items-center justify-between px-6 sticky top-0 z-10">
    <div class="flex items-center gap-2 text-sm text-muted-foreground">
      <span>Masuk sebagai</span>
      <span class="font-medium text-foreground">{{ currentUser.name }}</span>
      <StatusBadge :label="roleOption.label" :tone="roleOption.tone" />
    </div>

    <div class="flex items-center gap-3">
      <!-- Notification Popover -->
      <Popover>
        <PopoverTrigger as-child>
          <button class="relative p-2 hover:bg-muted rounded-lg transition-colors">
            <Bell class="h-5 w-5 text-muted-foreground" />
            <span
              v-if="unreadCount > 0"
              class="absolute top-1.5 right-1.5 w-2 h-2 bg-destructive rounded-full animate-pulse"
            />
          </button>
        </PopoverTrigger>
        <PopoverContent class="p-0 w-auto" align="end">
          <NotificationPanel ref="notificationPanelRef" />
        </PopoverContent>
      </Popover>
    </div>
  </header>
</template>
