<script setup lang="ts">
import { CheckCircle2, XCircle, AlertTriangle, Info } from 'lucide-vue-next'
import { cn } from '~/lib/utils'

const { toasts } = useToast()
</script>

<template>
  <Teleport to="body">
    <div class="fixed top-5 right-5 z-[9999] flex flex-col gap-2 pointer-events-none">
      <TransitionGroup
        enter-active-class="transition-all duration-300 ease-out"
        enter-from-class="opacity-0 translate-x-8 scale-95"
        enter-to-class="opacity-100 translate-x-0 scale-100"
        leave-active-class="transition-all duration-200 ease-in"
        leave-from-class="opacity-100 translate-x-0 scale-100"
        leave-to-class="opacity-0 translate-x-8 scale-95"
      >
        <div
          v-for="toast in toasts"
          :key="toast.id"
          :class="cn(
            'pointer-events-auto flex items-start gap-3 w-80 rounded-xl border p-4 shadow-lg bg-card',
            toast.type === 'success' && 'border-success/20',
            toast.type === 'error' && 'border-destructive/20',
            toast.type === 'warning' && 'border-warning/20',
            toast.type === 'info' && 'border-primary/20',
          )"
        >
          <div
            :class="cn(
              'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
              toast.type === 'success' && 'bg-success/10 text-success',
              toast.type === 'error' && 'bg-destructive/10 text-destructive',
              toast.type === 'warning' && 'bg-warning/10 text-warning',
              toast.type === 'info' && 'bg-primary/10 text-primary',
            )"
          >
            <CheckCircle2 v-if="toast.type === 'success'" class="h-4 w-4" />
            <XCircle v-else-if="toast.type === 'error'" class="h-4 w-4" />
            <AlertTriangle v-else-if="toast.type === 'warning'" class="h-4 w-4" />
            <Info v-else class="h-4 w-4" />
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold text-foreground">
              {{ toast.title }}
            </p>
            <p class="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              {{ toast.message }}
            </p>
          </div>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>
