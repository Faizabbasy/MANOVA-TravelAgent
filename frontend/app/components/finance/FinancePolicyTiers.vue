<script setup lang="ts">
import { cn } from '~/lib/utils'
import type { PolicyTier } from '~/types/api'
import { tierLabel } from '~/lib/finance/policy'

/** A policy's tiers as a compact table, farthest from departure first; the applicable tier highlighted. */
const props = defineProps<{ tiers: PolicyTier[]; active?: PolicyTier | null; compact?: boolean }>()
const ordered = computed(() => [...props.tiers].sort((a, b) => (b.minDays ?? -Infinity) - (a.minDays ?? -Infinity)))
const isActive = (t: PolicyTier) => !!props.active && props.active.minDays === t.minDays && props.active.maxDays === t.maxDays
</script>

<template>
  <ul :class="cn('divide-y divide-border overflow-hidden rounded-lg border border-border', compact ? 'text-xs' : 'text-sm')">
    <li
      v-for="t in ordered"
      :key="`${t.minDays}-${t.maxDays}`"
      :class="cn('flex items-center justify-between gap-3 px-3', compact ? 'py-1.5' : 'py-2', isActive(t) && 'bg-primary/5 font-medium')"
      :aria-current="isActive(t) ? 'true' : undefined"
    >
      <span class="flex items-center gap-2">
        <span v-if="isActive(t)" class="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
        {{ tierLabel(t) }}
      </span>
      <span class="shrink-0 tabular-nums">
        <span :class="t.refundBp > 0 ? 'text-success' : 'text-muted-foreground'">refund {{ t.refundBp / 100 }}%</span>
        <span class="text-muted-foreground"> · hangus {{ t.forfeitBp / 100 }}%</span>
      </span>
    </li>
  </ul>
</template>
