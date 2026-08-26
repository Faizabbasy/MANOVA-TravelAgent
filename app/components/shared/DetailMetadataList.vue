<script setup lang="ts">
interface MetadataItem {
  label: string
  value: string
}

defineProps<{
  items: MetadataItem[]
}>()
</script>

<template>
  <dl class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-2.5">
    <div v-for="(item, index) in items" :key="index">
      <dt class="text-xs text-muted-foreground">
        {{ item.label }}
      </dt>
      <dd class="text-sm font-medium text-foreground mt-0.5">
        {{ item.value }}
      </dd>
    </div>
  </dl>
</template>
