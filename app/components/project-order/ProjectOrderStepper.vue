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
 *
 * Garis konektor SENGAJA dipisah dari baris label (bukan sibling dari tombol lingkaran+label yang
 * lebarnya ikut lebar label) — supaya garis selalu nempel persis ke tepi lingkaran, terlepas dari
 * panjang label tiap step ("On Progress" vs "Start"). Tiap step render 2 baris: baris lingkaran+garis
 * (lingkaran fixed-width, garis flex-1 di kiri-kanannya langsung menyentuh tepi lingkaran), lalu baris
 * label di bawahnya, center-align mengikuti lebar kolom step itu sendiri.
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

function connectorClass (state: ProjectOrderStepView['state']): string {
  return state === 'future' ? 'border-dotted border-border' : 'border-dashed border-primary/60'
}
</script>

<template>
  <div class="overflow-x-auto no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden pb-1">
    <ol class="grid min-w-[720px] items-start" :style="{ gridTemplateColumns: `repeat(${props.steps.length}, minmax(0, 1fr))` }">
      <li
        v-for="(step, index) in props.steps"
        :key="step.def.key"
        class="flex flex-col items-center"
      >
        <div class="flex w-full items-center">
          <span
            class="h-0 flex-1 border-t-2"
            :class="index === 0 ? 'border-transparent' : connectorClass(step.state)"
          />
          <button
            type="button"
            class="group flex shrink-0 items-center justify-center rounded-full p-0 transition-colors"
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
          </button>
          <span
            v-if="index < props.steps.length - 1"
            class="h-0 flex-1 border-t-2"
            :class="connectorClass(props.steps[index + 1].state)"
          />
          <span v-else class="flex-1" />
        </div>

        <button
          type="button"
          class="mt-2 flex flex-col items-center gap-0.5 whitespace-nowrap rounded-lg px-1 py-1 transition-colors hover:bg-muted/50"
          :title="step.def.description"
          @click="emit('select', step.def.key)"
        >
          <span :class="cn('text-xs leading-tight', LABEL_CLASS[step.state])">
            {{ step.def.label }}
          </span>
          <span class="h-4 font-ticket-mono text-[10px] leading-4 text-muted-foreground">
            {{ step.completedAt ? formatDate(step.completedAt) : '' }}
          </span>
        </button>
      </li>
    </ol>
  </div>
</template>
