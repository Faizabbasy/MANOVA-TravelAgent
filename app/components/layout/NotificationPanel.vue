<script setup lang="ts">
import { ref, computed } from 'vue'
import { Bell, CheckCircle2, AlertCircle, Clock, FolderKanban, DollarSign, Users, X } from 'lucide-vue-next'

interface Notification {
  id: string
  type: 'success' | 'warning' | 'info' | 'error'
  title: string
  message: string
  time: string
  read: boolean
  icon?: any
}

const notifications = ref<Notification[]>([
  {
    id: '1',
    type: 'success',
    title: 'Project Completed',
    message: 'Website Redesign project has been marked as completed',
    time: '5 min ago',
    read: false,
    icon: CheckCircle2
  },
  {
    id: '2',
    type: 'warning',
    title: 'Budget Alert',
    message: 'Mobile App project is at 85% of allocated budget',
    time: '1 hour ago',
    read: false,
    icon: DollarSign
  },
  {
    id: '3',
    type: 'info',
    title: 'New Task Assigned',
    message: 'You have been assigned to "API Integration" task',
    time: '2 hours ago',
    read: false,
    icon: FolderKanban
  },
  {
    id: '4',
    type: 'info',
    title: 'Team Member Added',
    message: 'Sarah Johnson joined the Marketing Campaign project',
    time: '3 hours ago',
    read: true,
    icon: Users
  },
  {
    id: '5',
    type: 'error',
    title: 'Deadline Approaching',
    message: 'E-commerce Platform deadline is in 2 days',
    time: '5 hours ago',
    read: true,
    icon: Clock
  },
  {
    id: '6',
    type: 'success',
    title: 'Payment Received',
    message: 'Client payment of $12,500 has been received',
    time: '1 day ago',
    read: true,
    icon: DollarSign
  }
])

const unreadCount = computed(() => notifications.value.filter(n => !n.read).length)

const markAsRead = (id: string) => {
  const notification = notifications.value.find(n => n.id === id)
  if (notification) {
    notification.read = true
  }
}

const markAllAsRead = () => {
  notifications.value.forEach(n => n.read = true)
}

const removeNotification = (id: string) => {
  notifications.value = notifications.value.filter(n => n.id !== id)
}

const getTypeColor = (type: string) => {
  switch (type) {
    case 'success':
      return 'text-success'
    case 'warning':
      return 'text-warning'
    case 'error':
      return 'text-destructive'
    default:
      return 'text-primary'
  }
}

const getTypeBg = (type: string) => {
  switch (type) {
    case 'success':
      return 'bg-success/10'
    case 'warning':
      return 'bg-warning/10'
    case 'error':
      return 'bg-destructive/10'
    default:
      return 'bg-primary/10'
  }
}

defineExpose({
  unreadCount
})
</script>

<template>
  <div class="w-96 max-h-[600px] flex flex-col">
    <!-- Header -->
    <div class="p-4 border-b border-border">
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center gap-2">
          <h3 class="font-semibold text-foreground">Notifications</h3>
          <Badge v-if="unreadCount > 0" variant="destructive" class="h-5 min-w-5 px-1.5">
            {{ unreadCount }}
          </Badge>
        </div>
        <Button
          v-if="unreadCount > 0"
          variant="ghost"
          size="sm"
          @click="markAllAsRead"
          class="text-xs h-7"
        >
          Mark all read
        </Button>
      </div>
    </div>

    <!-- Notifications List -->
    <div class="flex-1 overflow-y-auto">
      <div v-if="notifications.length === 0" class="p-8 text-center">
        <Bell class="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
        <p class="text-sm text-muted-foreground">No notifications yet</p>
      </div>

      <div v-else>
        <div
          v-for="(notification, index) in notifications"
          :key="notification.id"
          class="relative group"
        >
          <div
            :class="[
              'p-4 hover:bg-muted/50 transition-colors cursor-pointer',
              !notification.read && 'bg-primary/5'
            ]"
            @click="markAsRead(notification.id)"
          >
            <div class="flex gap-3">
              <!-- Icon -->
              <div :class="['p-2 rounded-lg h-fit', getTypeBg(notification.type)]">
                <component
                  :is="notification.icon"
                  :class="['h-4 w-4', getTypeColor(notification.type)]"
                />
              </div>

              <!-- Content -->
              <div class="flex-1 min-w-0">
                <div class="flex items-start justify-between gap-2 mb-1">
                  <h4 class="font-medium text-sm text-foreground">
                    {{ notification.title }}
                  </h4>
                  <button
                    @click.stop="removeNotification(notification.id)"
                    class="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-muted rounded"
                  >
                    <X class="h-3 w-3 text-muted-foreground" />
                  </button>
                </div>
                <p class="text-sm text-muted-foreground mb-2">
                  {{ notification.message }}
                </p>
                <div class="flex items-center gap-2">
                  <span class="text-xs text-muted-foreground">{{ notification.time }}</span>
                  <span v-if="!notification.read" class="w-1.5 h-1.5 bg-primary rounded-full" />
                </div>
              </div>
            </div>
          </div>
          <Separator v-if="index < notifications.length - 1" />
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="p-3 border-t border-border">
      <Button variant="ghost" class="w-full text-sm" size="sm">
        View all notifications
      </Button>
    </div>
  </div>
</template>
