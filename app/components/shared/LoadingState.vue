<script setup lang="ts">
withDefaults(defineProps<{
  message?: string
  rows?: number
}>(), {
  message: 'Memuat data...',
  rows: 3
})
</script>

<template>
  <div class="space-y-3 py-6" role="status" :aria-label="message">
    <div
      v-for="row in rows"
      :key="row"
      class="h-12 w-full rounded-lg bg-muted animate-pulse"
    />
  </div>
</template>
