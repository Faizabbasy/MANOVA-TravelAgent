<script setup lang="ts">
import { ref, computed } from 'vue'
import { Calendar, Plus, Bell } from 'lucide-vue-next'

const notificationPanelRef = ref()
const unreadCount = computed(() => notificationPanelRef.value?.unreadCount || 0)
</script>

<template>
  <header class="h-16 bg-card border-b border-border flex items-center justify-between px-6 sticky top-0 z-10">
    <div class="flex items-center gap-4">
      <h1 class="text-xl font-semibold text-foreground">Dashboard</h1>
      <div class="flex items-center gap-2 text-sm text-muted-foreground">
        <Calendar class="h-4 w-4" />
        <span>Jan 1, 2025 - Jan 16, 2025</span>
      </div>
    </div>

    <div class="flex items-center gap-3">
      <Button variant="outline" size="sm" class="gap-2">
        <Plus class="h-4 w-4" />
        Add Widget
      </Button>
      <Button size="sm" class="gap-2 bg-primary hover:bg-primary/90">
        Export
      </Button>

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
