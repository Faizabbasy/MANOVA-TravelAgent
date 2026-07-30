<script setup lang="ts">
withDefaults(defineProps<{
  title?: string
  description?: string
}>(), {})
</script>

<template>
  <Card>
    <CardHeader v-if="title" class="flex flex-row items-start justify-between gap-3 space-y-0">
      <div>
        <CardTitle class="text-base">{{ title }}</CardTitle>
        <CardDescription v-if="description">{{ description }}</CardDescription>
      </div>
      <div v-if="$slots.actions" class="shrink-0">
        <slot name="actions" />
      </div>
    </CardHeader>
    <CardContent>
      <slot />
    </CardContent>
  </Card>
</template>
