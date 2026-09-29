<script setup lang="ts">
import { AlertTriangle, Loader2 } from 'lucide-vue-next'
import { cn } from '~/lib/utils'
import type { ApiError } from '~/lib/api/errors'

/**
 * Shell for every finance form: title, one clear primary action, server error shown in plain words with its
 * reference code, and a submit that cannot be double-fired. Field-level errors are rendered by the form next
 * to each input (FinanceField); this banner carries the rest.
 */
const props = withDefaults(defineProps<{
  open: boolean
  title: string
  description?: string
  submitLabel: string
  pending?: boolean
  error?: ApiError | null
  submitDisabled?: boolean
  tone?: 'default' | 'destructive'
  size?: 'md' | 'lg'
}>(), { description: undefined, pending: false, error: null, submitDisabled: false, tone: 'default', size: 'md' })

const emit = defineEmits<{ 'update:open': [value: boolean]; submit: [] }>()

/** Field errors are shown inline; show the banner only for the rest (or when no field matched). */
const bannerMessage = computed(() => props.error?.message ?? null)

function onSubmit () {
  if (props.pending || props.submitDisabled) { return }
  emit('submit')
}
</script>

<template>
  <Dialog :open="open" @update:open="value => !pending && emit('update:open', value)">
    <DialogContent
      :class="cn('max-h-[calc(100dvh-2rem)] w-[calc(100vw-1.5rem)] gap-0 overflow-y-auto rounded-xl p-0', size === 'lg' ? 'sm:max-w-2xl' : 'sm:max-w-lg')"
      @interact-outside="event => pending && event.preventDefault()"
    >
      <form novalidate class="flex flex-col" @submit.prevent="onSubmit">
        <DialogHeader class="space-y-1.5 border-b border-border px-5 pb-4 pt-5 text-left sm:px-6">
          <DialogTitle class="pr-6 text-base font-semibold">
            {{ title }}
          </DialogTitle>
          <DialogDescription v-if="description" class="text-[13px] leading-relaxed">
            {{ description }}
          </DialogDescription>
        </DialogHeader>

        <div class="space-y-4 px-5 py-5 sm:px-6">
          <div
            v-if="bannerMessage"
            class="flex gap-2.5 rounded-lg border border-destructive/25 bg-destructive/5 px-3.5 py-3 text-sm text-destructive"
            role="alert"
          >
            <AlertTriangle class="mt-0.5 h-4 w-4 shrink-0" />
            <div class="min-w-0">
              <p class="font-medium leading-snug">
                {{ bannerMessage }}
              </p>
              <p v-if="error?.requestId" class="mt-0.5 font-mono text-[11px] text-destructive/70">
                Kode referensi: {{ error.requestId }}
              </p>
            </div>
          </div>

          <slot />
        </div>

        <div v-if="$slots.summary" class="border-t border-border bg-muted/40 px-5 py-4 sm:px-6">
          <slot name="summary" />
        </div>

        <DialogFooter class="flex-col-reverse gap-2 border-t border-border px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
          <Button type="button" variant="outline" :disabled="pending" @click="emit('update:open', false)">
            Batal
          </Button>
          <Button type="submit" :variant="tone === 'destructive' ? 'destructive' : 'default'" :disabled="pending || submitDisabled" class="min-w-[9rem]">
            <Loader2 v-if="pending" class="mr-2 h-4 w-4 animate-spin" />
            {{ pending ? 'Menyimpan…' : submitLabel }}
          </Button>
        </DialogFooter>
      </form>
      <p class="sr-only" aria-live="polite">
        {{ pending ? 'Menyimpan, mohon tunggu' : '' }}
      </p>
    </DialogContent>
  </Dialog>
</template>
