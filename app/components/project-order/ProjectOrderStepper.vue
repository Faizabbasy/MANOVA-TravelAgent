<script setup lang="ts">
import { Check, AlertTriangle } from 'lucide-vue-next'
import { cn } from '~/lib/utils'
import { formatDate } from '~/utils/format'
import type { ProjectOrderStepView } from '~/types/project-order'

const props = defineProps<{
  steps: ProjectOrderStepView[]
  selectedStepKey?: string
}>()

const emit = defineEmits<{ select: [stepKey: string] }>()

/**
 * Refinement UI: sebelumnya konektor selalu berwarna primary sampai step aktif, termasuk ketika step
 * aktif justru sedang TERBLOKIR (merah) — garis biru menuju lingkaran merah membaca seperti kemajuan
 * normal. Kini konektor mengambil warna dari step SESUDAHNYA, dan step yang belum tercapai memakai garis
 * netral, sehingga jalur yang sudah dilalui dan yang belum langsung terbaca.
 */
const CIRCLE_CLASS: Record<ProjectOrderStepView['state'], string> = {
  completed: 'border-primary bg-primary text-primary-foreground',
  current: 'border-primary bg-primary text-primary-foreground ring-4 ring-primary/15',
  blocked: 'border-destructive bg-destructive text-destructive-foreground ring-4 ring-destructive/15',
  future: 'border-border bg-card text-muted-foreground'
}

const LABEL_CLASS: Record<ProjectOrderStepView['state'], string> = {
  completed: 'text-foreground',
  current: 'text-primary font-semibold',
  blocked: 'text-destructive font-semibold',
  future: 'text-muted-foreground'
}
</script>

<template>
  <div class="overflow-x-auto pb-1">
    <ol class="flex min-w-[680px] items-start">
      <li
        v-for="(step, index) in props.steps"
        :key="step.def.key"
        class="flex flex-1 items-start last:flex-none"
      >
        <button
          type="button"
          class="group flex w-[104px] shrink-0 flex-col items-center gap-2 rounded-lg px-1 py-1 transition-colors hover:bg-muted/50"
          :title="step.def.description"
          :aria-current="step.state === 'current' || step.state === 'blocked' ? 'step' : undefined"
          @click="emit('select', step.def.key)"
        >
          <span
            :class="cn(
              'flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-semibold transition-all',
              CIRCLE_CLASS[step.state],
              props.selectedStepKey === step.def.key && 'ring-offset-2 ring-offset-card'
            )"
          >
            <Check v-if="step.state === 'completed'" class="h-4 w-4" />
            <AlertTriangle v-else-if="step.state === 'blocked'" class="h-4 w-4" />
            <template v-else>{{ step.def.index }}</template>
          </span>

          <span class="flex flex-col items-center gap-0.5">
            <span :class="cn('text-xs leading-tight', LABEL_CLASS[step.state])">
              {{ step.def.label }}
            </span>
            <span class="h-4 text-[11px] leading-4 text-muted-foreground">
              {{ step.completedAt ? formatDate(step.completedAt) : '' }}
            </span>
          </span>
        </button>

        <span
          v-if="index < props.steps.length - 1"
          :class="cn(
            'mt-[18px] h-0.5 flex-1 rounded-full',
            props.steps[index + 1].state === 'future' ? 'bg-border' : 'bg-primary/70'
          )"
        />
      </li>
    </ol>
  </div>
</template>
