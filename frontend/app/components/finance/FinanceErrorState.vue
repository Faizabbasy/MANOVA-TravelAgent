<script setup lang="ts">
import { AlertCircle } from 'lucide-vue-next'
import type { ApiError } from '~/lib/api/errors'

/** A failed load, with the server's own message and request ID (for support), plus retry. */
defineProps<{ error: ApiError; compact?: boolean }>()
const emit = defineEmits<{ retry: [] }>()
</script>

<template>
  <div class="flex flex-col items-center justify-center px-6 text-center" :class="compact ? 'py-8' : 'py-14'" role="alert">
    <div class="mb-3 rounded-full bg-destructive/10 p-3">
      <AlertCircle class="h-6 w-6 text-destructive" />
    </div>
    <p class="text-sm font-medium text-foreground">
      Data belum bisa dimuat
    </p>
    <p class="mt-1 max-w-md text-xs leading-relaxed text-muted-foreground">
      {{ error.message }}
    </p>
    <p v-if="error.requestId" class="mt-1 font-mono text-[11px] text-muted-foreground/80">
      Kode referensi: {{ error.requestId }}
    </p>
    <Button variant="outline" size="sm" class="mt-4" @click="emit('retry')">
      Coba lagi
    </Button>
  </div>
</template>
