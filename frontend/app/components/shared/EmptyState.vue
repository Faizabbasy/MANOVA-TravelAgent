<script setup lang="ts">
import type { Component } from 'vue'
import { Inbox } from 'lucide-vue-next'

withDefaults(defineProps<{
  icon?: Component
  title: string
  description?: string
  /** `compact` untuk empty state di dalam panel sempit — `py-16` terlalu boros di kolom sidebar. */
  size?: 'default' | 'compact'
}>(), {
  icon: () => Inbox,
  size: 'default'
})
</script>

<template>
  <div
    class="flex flex-col items-center justify-center px-6 text-center"
    :class="size === 'compact' ? 'py-8' : 'py-12'"
  >
    <div
      class="mb-3 rounded-full bg-muted/70"
      :class="size === 'compact' ? 'p-2.5' : 'p-3.5'"
    >
      <component
        :is="icon"
        class="text-muted-foreground"
        :class="size === 'compact' ? 'h-5 w-5' : 'h-6 w-6'"
      />
    </div>
    <p class="text-sm font-medium text-foreground">
      {{ title }}
    </p>
    <p v-if="description" class="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
      {{ description }}
    </p>
    <div v-if="$slots.default" class="mt-4">
      <slot />
    </div>
  </div>
</template>
