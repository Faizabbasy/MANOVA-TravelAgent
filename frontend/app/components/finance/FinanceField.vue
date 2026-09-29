<script setup lang="ts">
/** Label + control + hint/error, wired for screen readers (the control gets `id`, error is announced). */
defineProps<{
  id: string
  label: string
  error?: string | null
  hint?: string
  optional?: boolean
}>()
</script>

<template>
  <div class="space-y-1.5">
    <Label :for="id" class="flex items-baseline gap-1.5 text-[13px] font-medium">
      {{ label }}
      <span v-if="optional" class="text-xs font-normal text-muted-foreground">(opsional)</span>
    </Label>
    <slot />
    <p v-if="error" :id="`${id}-error`" class="text-xs font-medium text-destructive" role="alert">
      {{ error }}
    </p>
    <p v-else-if="hint" :id="`${id}-hint`" class="text-xs leading-relaxed text-muted-foreground">
      {{ hint }}
    </p>
  </div>
</template>
