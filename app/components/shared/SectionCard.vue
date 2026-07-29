<script setup lang="ts">
withDefaults(defineProps<{
  title?: string
  description?: string
}>(), {})
</script>

<template>
  <Card>
    <CardHeader v-if="title">
      <CardTitle class="text-base">{{ title }}</CardTitle>
      <CardDescription v-if="description">{{ description }}</CardDescription>
    </CardHeader>
    <CardContent>
      <slot />
    </CardContent>
  </Card>
</template>
