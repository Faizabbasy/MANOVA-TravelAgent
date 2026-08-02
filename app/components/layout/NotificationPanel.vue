<script setup lang="ts">
import { computed } from 'vue'
import type { Component } from 'vue'
import { Bell, AtSign, UserPlus, Clock, Siren, FileWarning, AlertCircle, FileText, MessageSquare, X } from 'lucide-vue-next'
import {
  getNotificationsForUser, getUnreadNotificationCount,
  markNotificationRead, markAllNotificationsRead, removeNotification as removeNotificationRecord
} from '~/data'
import type { NotificationType } from '~/types/document-comms'
import { formatDate } from '~/utils/format'

/**
 * Notification Panel (Section 21 — Documents, Communication dan Notifications, D-078). REWIRED dari data
 * hardcoded fake ("Website Redesign project completed", dsb. — leftover starter-template boilerplate, zero
 * koneksi ke data aplikasi ini) menjadi `Notification` nyata (`app/types/document-comms.ts`,
 * `getNotificationsForUser`/`getUnreadNotificationCount`/`markNotificationRead`/`markAllNotificationsRead`/
 * `removeNotification`, `app/data/index.ts`). Shell UI (popover, list styling, mark-as-read/remove
 * interaction) DIPERTAHANKAN persis seperti sebelumnya — ini adalah AKTIVASI boilerplate mati, bukan
 * mengubah fitur yang sudah bekerja (`docs/mockup-change-impact-log.md` CI-051).
 */

const { currentUser } = useCurrentUser()

const notifications = computed(() => getNotificationsForUser(currentUser.value.id))
const unreadCount = computed(() => getUnreadNotificationCount(currentUser.value.id))

const markAsRead = (id: string) => markNotificationRead(id)
const markAllAsRead = () => markAllNotificationsRead(currentUser.value.id)
const removeNotification = (id: string) => removeNotificationRecord(id)

const TYPE_ICON_MAP: Record<NotificationType, Component> = {
  mention: AtSign,
  assignment: UserPlus,
  reminder: Clock,
  escalation: Siren,
  change: FileWarning,
  incident: AlertCircle,
  document: FileText,
  message: MessageSquare
}

/** Bucket warna disederhanakan dari 8 `NotificationType` menjadi 4 tone existing (pola sama badge tone lintas codebase). */
const TYPE_TONE_MAP: Record<NotificationType, 'success' | 'warning' | 'info' | 'error'> = {
  mention: 'info',
  assignment: 'info',
  reminder: 'warning',
  escalation: 'error',
  change: 'warning',
  incident: 'error',
  document: 'info',
  message: 'info'
}

const getTypeIcon = (type: NotificationType) => TYPE_ICON_MAP[type]

const getTypeColor = (type: NotificationType) => {
  switch (TYPE_TONE_MAP[type]) {
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

const getTypeBg = (type: NotificationType) => {
  switch (TYPE_TONE_MAP[type]) {
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

function goToAllNotifications () {
  navigateTo('/documents?tab=notifications')
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
          <h3 class="font-semibold text-foreground">
            Notifications
          </h3>
          <Badge v-if="unreadCount > 0" variant="destructive" class="h-5 min-w-5 px-1.5">
            {{ unreadCount }}
          </Badge>
        </div>
        <Button
          v-if="unreadCount > 0"
          variant="ghost"
          size="sm"
          class="text-xs h-7"
          @click="markAllAsRead"
        >
          Mark all read
        </Button>
      </div>
    </div>

    <!-- Notifications List -->
    <div class="flex-1 overflow-y-auto">
      <div v-if="notifications.length === 0" class="p-8 text-center">
        <Bell class="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
        <p class="text-sm text-muted-foreground">
          No notifications yet
        </p>
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
              !notification.read && 'bg-primary/5',
            ]"
            @click="markAsRead(notification.id)"
          >
            <div class="flex gap-3">
              <!-- Icon -->
              <div :class="['p-2 rounded-lg h-fit', getTypeBg(notification.type)]">
                <component
                  :is="getTypeIcon(notification.type)"
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
                    class="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-muted rounded"
                    @click.stop="removeNotification(notification.id)"
                  >
                    <X class="h-3 w-3 text-muted-foreground" />
                  </button>
                </div>
                <p class="text-sm text-muted-foreground mb-2">
                  {{ notification.body }}
                </p>
                <div class="flex items-center gap-2">
                  <span class="text-xs text-muted-foreground">{{ formatDate(notification.createdAt) }}</span>
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
      <Button variant="ghost" class="w-full text-sm" size="sm" @click="goToAllNotifications">
        View all notifications
      </Button>
    </div>
  </div>
</template>
