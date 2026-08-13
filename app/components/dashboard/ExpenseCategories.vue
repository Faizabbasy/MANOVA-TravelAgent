<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { formatCurrencyIdr } from '~/utils/format'

/**
 * Cost breakdown (Section 06/Dashboard — Finance/Super Admin).
 *
 * REDESIGN kedua — versi bar-list sebelumnya kebenaran secara data (part-to-whole, satu kategori dominan
 * vs sisanya) tapi kebaca terlalu polos untuk data yang justru cocok ditampilkan radial (≤5 kategori
 * bermakna, satu dominan). Bukan donut Chart.js default — ring custom SVG (activity-ring style, celah
 * antar-segmen + ujung membulat, bukan pie-slice tajam), arc "menggambar diri" saat mount, hover pada arc
 * atau baris legend saling menyorot satu sama lain. Baris bernilai Rp0 tetap dikumpulkan jadi satu catatan
 * ringkas (bukan ikut jadi slice mikroskopis).
 */
const props = defineProps<{
  items: { name: string; valueIdr: number }[]
}>()

const total = computed(() => props.items.reduce((sum, item) => sum + item.valueIdr, 0))
const ranked = computed(() => [...props.items].sort((a, b) => b.valueIdr - a.valueIdr))
const visible = computed(() => ranked.value.filter(item => item.valueIdr > 0).slice(0, 5))
const collapsedCount = computed(() => props.items.length - visible.value.length)

const RING_COLORS = ['hsl(var(--primary))', 'hsl(var(--success))', 'hsl(var(--warning))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))']
const RADIUS = 50
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
/** Celah visual antar-arc (dalam satuan panjang lingkaran) — kesan "activity ring", bukan satu cincin utuh. */
const ARC_GAP = 5

function shareOfTotal (value: number): number {
  return total.value > 0 ? (value / total.value) * 100 : 0
}

const segments = computed(() => {
  let cumulative = 0
  return visible.value.map((item, index) => {
    const rawLength = (shareOfTotal(item.valueIdr) / 100) * CIRCUMFERENCE
    const segment = {
      name: item.name,
      value: item.valueIdr,
      share: shareOfTotal(item.valueIdr),
      color: RING_COLORS[index % RING_COLORS.length],
      length: Math.max(0, rawLength - ARC_GAP),
      offset: cumulative
    }
    cumulative += rawLength
    return segment
  })
})

const hoveredIndex = ref<number | null>(null)

/** Arc menggambar diri dari 0 saat mount — sinkron dengan legend, sama bahasa motion dengan `BudgetChart`. */
const mounted = ref(false)
onMounted(async () => {
  await nextTick()
  requestAnimationFrame(() => { mounted.value = true })
})
</script>

<template>
  <div>
    <div class="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
      <div class="relative h-36 w-36 shrink-0">
        <svg viewBox="0 0 120 120" class="h-full w-full -rotate-90">
          <defs>
            <linearGradient v-for="(segment, index) in segments" :id="`ring-grad-${index}`" :key="`grad-${segment.name}`" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" :stop-color="segment.color" stop-opacity="0.55" />
              <stop offset="100%" :stop-color="segment.color" stop-opacity="1" />
            </linearGradient>
          </defs>
          <circle cx="60" cy="60" r="50" fill="none" stroke="hsl(var(--muted))" stroke-width="14" />
          <circle
            v-for="(segment, index) in segments"
            :key="segment.name"
            cx="60"
            cy="60"
            r="50"
            fill="none"
            :stroke="`url(#ring-grad-${index})`"
            stroke-width="14"
            stroke-linecap="round"
            :stroke-dasharray="`${mounted ? segment.length : 0} ${CIRCUMFERENCE}`"
            :stroke-dashoffset="-segment.offset"
            class="cursor-pointer transition-[stroke-dasharray,opacity] ease-out"
            :style="{
              transitionDuration: '750ms',
              transitionDelay: `${index * 90}ms`,
              opacity: hoveredIndex === null || hoveredIndex === index ? 1 : 0.3
            }"
            @mouseenter="hoveredIndex = index"
            @mouseleave="hoveredIndex = null"
          >
            <title>{{ segment.name }}: {{ formatCurrencyIdr(segment.value) }} ({{ segment.share.toFixed(0) }}%)</title>
          </circle>
        </svg>
        <div class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span class="text-[10px] uppercase tracking-wide text-muted-foreground">Total</span>
          <span class="mt-0.5 text-center text-sm font-bold leading-tight text-foreground tabular-nums">{{ formatCurrencyIdr(total) }}</span>
        </div>
      </div>

      <div v-if="visible.length" class="w-full min-w-0 flex-1 space-y-1">
        <button
          v-for="(segment, index) in segments"
          :key="segment.name"
          type="button"
          class="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left transition-colors"
          :class="hoveredIndex === index ? 'bg-muted/70' : 'hover:bg-muted/40'"
          @mouseenter="hoveredIndex = index"
          @mouseleave="hoveredIndex = null"
        >
          <span class="flex min-w-0 items-center gap-2">
            <span class="h-2.5 w-2.5 shrink-0 rounded-full" :style="{ backgroundColor: segment.color }" />
            <span class="truncate text-sm text-foreground">{{ segment.name }}</span>
          </span>
          <span class="flex shrink-0 items-baseline gap-1.5">
            <span class="text-sm font-medium tabular-nums text-foreground">{{ formatCurrencyIdr(segment.value) }}</span>
            <span class="w-9 text-right text-xs tabular-nums text-muted-foreground">{{ segment.share.toFixed(0) }}%</span>
          </span>
        </button>

        <p v-if="collapsedCount > 0" class="px-2 pt-1.5 text-xs text-muted-foreground">
          +{{ collapsedCount }} project lain belum ada catatan biaya
        </p>
      </div>
    </div>

    <EmptyState v-if="!items.length" title="Belum ada data cost" />
  </div>
</template>
