<script setup lang="ts">
import { Check, AlertTriangle, Plane } from 'lucide-vue-next'
import { cn } from '~/lib/utils'
import { formatDate } from '~/utils/format'
import type { ProjectOrderStepView } from '~/types/project-order'

const props = defineProps<{
  steps: ProjectOrderStepView[]
  selectedStepKey?: string
}>()

const emit = defineEmits<{ select: [stepKey: string] }>()

/**
 * "Flight path" — rute Order Status digambar sebagai garis penerbangan bertitik, bukan step-circle
 * generik. Ikon pesawat menandai step `current`/`blocked` (posisi "kamu di sini sekarang"); step
 * `completed` jadi titik solid (sudah dilewati), `future` jadi titik hampa (belum dilalui). Warna
 * konektor mengikuti step SESUDAHNYA (pola sama versi lama) supaya jalur yang sudah dilalui vs belum
 * tetap terbaca sekilas.
 */
const NODE_CLASS: Record<ProjectOrderStepView['state'], string> = {
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
    <ol class="flex min-w-[720px] items-start">
      <li
        v-for="(step, index) in props.steps"
        :key="step.def.key"
        class="flex flex-1 items-start last:flex-none"
      >
        <button
          type="button"
          class="group flex w-[110px] shrink-0 flex-col items-center gap-2 rounded-lg px-1 py-1 transition-colors hover:bg-muted/50"
          :title="step.def.description"
          :aria-current="step.state === 'current' || step.state === 'blocked' ? 'step' : undefined"
          @click="emit('select', step.def.key)"
        >
          <span
            :class="cn(
              'relative flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-semibold transition-all duration-300',
              NODE_CLASS[step.state],
              props.selectedStepKey === step.def.key && 'ring-offset-2 ring-offset-card'
            )"
          >
            <Check v-if="step.state === 'completed'" class="h-4 w-4" />
            <AlertTriangle v-else-if="step.state === 'blocked'" class="h-4 w-4" />
            <template v-else>{{ step.def.index }}</template>

            <!-- "Kamu di sini" — pesawat kecil melayang di atas node aktif, penanda posisi sekarang di rute. -->
            <Plane
              v-if="step.state === 'current'"
              class="absolute -top-5 h-3.5 w-3.5 rotate-90 text-primary"
              aria-hidden="true"
            />
          </span>

          <span class="flex flex-col items-center gap-0.5">
            <span :class="cn('text-xs leading-tight', LABEL_CLASS[step.state])">
              {{ step.def.label }}
            </span>
            <span class="h-4 font-ticket-mono text-[10px] leading-4 text-muted-foreground">
              {{ step.completedAt ? formatDate(step.completedAt) : '' }}
            </span>
          </span>
        </button>

        <span
          v-if="index < props.steps.length - 1"
          class="mt-[14px] h-0 flex-1 border-t-2"
          :class="props.steps[index + 1].state === 'future' ? 'border-dotted border-border' : 'border-dashed border-primary/60'"
        />
      </li>
    </ol>
  </div>
</template>
