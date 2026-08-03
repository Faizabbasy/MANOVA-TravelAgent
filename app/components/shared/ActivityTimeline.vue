<script setup lang="ts">
import { History } from 'lucide-vue-next'
import { formatDateTime } from '~/utils/format'

/**
 * Activity timeline generik (Repair Phase Section 3 — Request & Commercial). Diekstrak sebagai shared
 * component karena dipakai 3+ konsumen sejak section ini (Travel Request activity, Quotation revision
 * history via `PartyActivity`, Approval Center audit trail) — pola "kronologis, actor + timestamp" yang
 * sama persis, ditandai sebagai belum diekstrak sejak Section 1 (`docs/client-progress.md`).
 */
export interface ActivityTimelineItem {
  id: string
  message: string
  actorName?: string
  createdAt: string
}

withDefaults(defineProps<{
  items: ActivityTimelineItem[]
  emptyLabel?: string
}>(), {
  emptyLabel: 'Belum ada aktivitas'
})
</script>

<template>
  <EmptyState v-if="items.length === 0" :icon="History" :title="emptyLabel" />
  <ol v-else class="space-y-4">
    <li v-for="item in items" :key="item.id" class="relative pl-5 border-l border-border last:pb-0">
      <span class="absolute -left-[5px] top-1 h-2 w-2 rounded-full bg-primary" />
      <p class="text-sm text-foreground">
        {{ item.message }}
      </p>
      <p class="text-xs text-muted-foreground mt-0.5">
        <template v-if="item.actorName">
          {{ item.actorName }} ·
        </template>{{ formatDateTime(item.createdAt) }}
      </p>
    </li>
  </ol>
</template>
