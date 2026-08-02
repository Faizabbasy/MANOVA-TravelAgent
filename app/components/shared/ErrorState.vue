<script setup lang="ts">
import { AlertCircle } from 'lucide-vue-next'

withDefaults(defineProps<{
  title?: string
  description?: string
  retryable?: boolean
}>(), {
  title: 'Terjadi kesalahan',
  description: 'Data tidak dapat dimuat. Silakan coba lagi.',
  retryable: false
})

const emit = defineEmits<{ retry: [] }>()
</script>

<template>
  <div class="flex flex-col items-center justify-center py-16 px-6 text-center">
    <div class="p-4 rounded-full bg-destructive/10 mb-4">
      <AlertCircle class="h-7 w-7 text-destructive" />
    </div>
    <p class="text-sm font-medium text-foreground">
      {{ title }}
    </p>
    <p class="text-xs text-muted-foreground mt-1 max-w-sm">
      {{ description }}
    </p>
    <Button v-if="retryable" variant="outline" size="sm" class="mt-4" @click="emit('retry')">
      Coba Lagi
    </Button>
  </div>
</template>
