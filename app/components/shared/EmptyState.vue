<script setup lang="ts">
import type { Component } from 'vue'
import { Inbox } from 'lucide-vue-next'

withDefaults(defineProps<{
  icon?: Component
  title: string
  description?: string
}>(), {
  icon: () => Inbox,
})
</script>

<template>
  <div class="flex flex-col items-center justify-center py-16 px-6 text-center">
    <div class="p-4 rounded-full bg-muted mb-4">
      <component :is="icon" class="h-7 w-7 text-muted-foreground" />
    </div>
    <p class="text-sm font-medium text-foreground">{{ title }}</p>
    <p v-if="description" class="text-xs text-muted-foreground mt-1 max-w-sm">{{ description }}</p>
    <div v-if="$slots.default" class="mt-4">
      <slot />
    </div>
  </div>
</template>
