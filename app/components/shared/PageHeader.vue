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
    <div class="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-violet-500/10 to-cyan-500/10 px-5 py-5">
      <div class="pointer-events-none absolute -top-10 -right-10 h-32 w-32 rounded-full bg-primary/20 blur-3xl" />
      <div class="relative flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div class="min-w-0">
          <h1 class="text-2xl font-bold text-foreground">
            {{ title }}
          </h1>
          <p v-if="description" class="text-sm text-muted-foreground mt-1">
            {{ description }}
          </p>
        </div>
        <div v-if="$slots.actions" class="flex items-center gap-2 shrink-0">
          <slot name="actions" />
        </div>
      </div>
    </div>
  </div>
</template>
