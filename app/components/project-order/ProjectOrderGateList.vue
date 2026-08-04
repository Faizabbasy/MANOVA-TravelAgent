<script setup lang="ts">
import { AlertCircle, CheckCircle2 } from 'lucide-vue-next'

const props = withDefaults(defineProps<{
  blockers: string[]
  title?: string
  readyMessage?: string
}>(), {
  title: 'Belum dapat dilanjutkan',
  readyMessage: 'Seluruh syarat step ini sudah terpenuhi.'
})
</script>

<template>
  <div
    v-if="props.blockers.length"
    class="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2.5"
  >
    <div class="flex items-center gap-1.5 mb-1.5">
      <AlertCircle class="h-3.5 w-3.5 text-destructive shrink-0" />
      <p class="text-xs font-semibold text-destructive">
        {{ props.title }}
      </p>
    </div>
    <ul class="space-y-1">
      <li
        v-for="(blocker, index) in props.blockers"
        :key="index"
        class="text-xs text-destructive leading-relaxed pl-3 relative before:content-['•'] before:absolute before:left-0"
      >
        {{ blocker }}
      </li>
    </ul>
  </div>

  <div v-else class="rounded-lg border border-success/40 bg-success/5 px-3 py-2.5">
    <div class="flex items-center gap-1.5">
      <CheckCircle2 class="h-3.5 w-3.5 text-success shrink-0" />
      <p class="text-xs text-success">
        {{ props.readyMessage }}
      </p>
    </div>
  </div>
</template>
