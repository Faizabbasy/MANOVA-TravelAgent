<script setup lang="ts">
import { ChevronRight, Home } from 'lucide-vue-next'

interface BreadcrumbItem {
  label: string
  to?: string
}

defineProps<{
  items: BreadcrumbItem[]
}>()
</script>

<template>
  <nav class="flex items-center gap-1.5 text-sm text-muted-foreground" aria-label="Breadcrumb">
    <NuxtLink to="/" class="flex items-center hover:text-foreground transition-colors">
      <Home class="h-3.5 w-3.5" />
    </NuxtLink>
    <template v-for="(item, index) in items" :key="index">
      <ChevronRight class="h-3.5 w-3.5 shrink-0" />
      <NuxtLink
        v-if="item.to && index !== items.length - 1"
        :to="item.to"
        class="hover:text-foreground transition-colors"
      >
        {{ item.label }}
      </NuxtLink>
      <span v-else class="font-medium text-foreground">{{ item.label }}</span>
    </template>
  </nav>
</template>
