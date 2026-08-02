<script setup lang="ts">
interface BreadcrumbItem {
  label: string
  to?: string
}

withDefaults(defineProps<{
  title: string
  description?: string
  breadcrumb?: BreadcrumbItem[]
}>(), {
  breadcrumb: () => []
})
</script>

<template>
  <div class="space-y-3">
    <Breadcrumb v-if="breadcrumb.length" :items="breadcrumb" />
    <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 class="text-2xl font-bold text-foreground">
          {{ title }}
        </h1>
        <p v-if="description" class="text-sm text-muted-foreground mt-1">
          {{ description }}
        </p>
      </div>
      <div v-if="$slots.actions" class="flex items-center gap-2">
        <slot name="actions" />
      </div>
    </div>
  </div>
</template>
