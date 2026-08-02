<script setup lang="ts">
import { Activity as ActivityIcon } from 'lucide-vue-next'
import { formatDateTime } from '~/utils/format'

/**
 * Recent Activity (Section 06/Dashboard — Management/Super Admin/Viewer), diadaptasi dari
 * RecentActivity.vue template lama (dulu daftar user/avatar fiktif). Sekarang menerima entri activity
 * log nyata dari fixture project (sumber yang sama dengan tab "Activity & Changes" nanti di Section 14).
 */
defineProps<{
  items: { id: string; message: string; projectName?: string; createdAt: string; isChange?: boolean }[]
}>()
</script>

<template>
  <ul class="divide-y divide-border">
    <li v-for="activity in items" :key="activity.id" class="py-3 flex items-start gap-3">
      <ActivityIcon class="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
      <div class="min-w-0 flex-1">
        <p class="text-sm text-foreground">
          {{ activity.message }}
        </p>
        <p class="text-xs text-muted-foreground">
          <template v-if="activity.projectName">
            {{ activity.projectName }} ·
          </template>{{ formatDateTime(activity.createdAt) }}
        </p>
      </div>
      <StatusBadge v-if="activity.isChange" label="Perubahan" tone="warning" />
    </li>
    <EmptyState v-if="items.length === 0" title="Belum ada aktivitas" />
  </ul>
</template>
