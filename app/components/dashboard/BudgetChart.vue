<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { AlertTriangle } from 'lucide-vue-next'
import { formatCurrencyIdr } from '~/utils/format'

/**
 * Budget vs Actual (Section 06/Dashboard — Management/Finance/Super Admin/Viewer).
 *
 * REDESIGN ketiga — metrik yang sebenarnya ingin dijawab widget ini adalah "berapa persen budget project
 * ini sudah terpakai", bukan sekadar dua magnitude sejajar. Satu bar `% pemakaian` per project (target =
 * 100% dari sisi kanan track, bukan tanda terpisah), dengan tekstur garis putus-putus pada bagian track
 * yang belum terpakai (nuansa "blueprint/ledger", bukan bar polos), dan ikon peringatan begitu mendekati
 * atau melewati budget. 4 tingkat warna (bukan cuma over/under 2 warna) supaya variasinya lebih kaya dan
 * lebih informatif: jauh di bawah budget → biru, wajar → hijau, mendekati limit → kuning, lewat budget →
 * merah.
 */
const props = withDefaults(defineProps<{
  labels: string[]
  budgetIdr: number[]
  actualIdr: number[]
  /** Tinggi area daftar bar (scrollable jika project lebih banyak dari yang muat). */
  heightClass?: string
}>(), { heightClass: 'h-[220px]' })

const totalBudget = computed(() => props.budgetIdr.reduce((sum, value) => sum + value, 0))
const totalActual = computed(() => props.actualIdr.reduce((sum, value) => sum + value, 0))
const variancePct = computed(() => {
  if (totalBudget.value === 0) { return 0 }
  return ((totalActual.value - totalBudget.value) / totalBudget.value) * 100
})

type Tier = 'low' | 'ontrack' | 'warning' | 'over'

const TIER_BAR: Record<Tier, string> = {
  low: 'bg-gradient-to-r from-primary/70 to-primary',
  ontrack: 'bg-gradient-to-r from-success/70 to-success',
  warning: 'bg-gradient-to-r from-warning/70 to-warning',
  over: 'bg-gradient-to-r from-destructive/70 to-destructive'
}

const TIER_TEXT: Record<Tier, string> = {
  low: 'text-primary',
  ontrack: 'text-success',
  warning: 'text-warning',
  over: 'text-destructive'
}

function tierOf (pct: number): Tier {
  if (pct > 100) { return 'over' }
  if (pct >= 90) { return 'warning' }
  if (pct >= 60) { return 'ontrack' }
  return 'low'
}

const rows = computed(() => props.labels.map((label, index) => {
  const budget = props.budgetIdr[index] ?? 0
  const actual = props.actualIdr[index] ?? 0
  const utilizationPct = budget > 0 ? (actual / budget) * 100 : (actual > 0 ? 100 : 0)
  const tier = tierOf(utilizationPct)
  return {
    label,
    budget,
    actual,
    tier,
    clampedPct: Math.min(100, utilizationPct),
    utilizationLabel: `${Math.round(utilizationPct)}%`
  }
}))

/** Bar tumbuh dari 0 saat mount (bukan langsung tampil final) — animasi berarti, bukan dekorasi. */
const mounted = ref(false)
onMounted(async () => {
  await nextTick()
  requestAnimationFrame(() => { mounted.value = true })
})

function compactIdr (value: number): string {
  if (value >= 1_000_000_000) { return `Rp${(value / 1_000_000_000).toLocaleString('id-ID', { maximumFractionDigits: 1 })} M` }
  if (value >= 1_000_000) { return `Rp${(value / 1_000_000).toLocaleString('id-ID', { maximumFractionDigits: 1 })} jt` }
  return formatCurrencyIdr(value)
}
</script>

<template>
  <div>
    <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
      <div>
        <p class="text-xs text-muted-foreground">
          Total Budget vs Actual
        </p>
        <div class="flex items-center gap-2 mt-1">
          <span class="text-xl font-bold text-foreground tabular-nums">{{ formatCurrencyIdr(totalActual) }}</span>
          <span
            class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold"
            :class="variancePct > 0 ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success'"
          >
            {{ variancePct > 0 ? '↑' : '↓' }} {{ Math.abs(variancePct).toFixed(1) }}% vs budget
          </span>
        </div>
      </div>
    </div>

    <div :class="props.heightClass" class="mt-4 space-y-4 overflow-y-auto pr-1">
      <div v-for="(row, index) in rows" :key="row.label" :title="`Actual ${formatCurrencyIdr(row.actual)} · Budget ${formatCurrencyIdr(row.budget)}`">
        <div class="flex items-center justify-between gap-2 mb-1.5">
          <p class="truncate text-xs font-medium text-foreground">
            {{ row.label }}
          </p>
          <span class="flex shrink-0 items-center gap-1">
            <AlertTriangle v-if="row.tier === 'warning' || row.tier === 'over'" class="h-3 w-3" :class="TIER_TEXT[row.tier]" />
            <span class="text-xs font-semibold tabular-nums" :class="TIER_TEXT[row.tier]">{{ row.utilizationLabel }}</span>
          </span>
        </div>

        <div class="track-texture relative h-2.5 rounded-full overflow-hidden">
          <div
            class="absolute inset-y-0 left-0 rounded-full transition-[width] ease-out"
            :class="TIER_BAR[row.tier]"
            :style="{ width: `${mounted ? row.clampedPct : 0}%`, transitionDuration: '800ms', transitionDelay: `${index * 70}ms` }"
          />
        </div>

        <div class="mt-1 flex items-center justify-between text-[11px] tabular-nums text-muted-foreground">
          <span>Actual {{ compactIdr(row.actual) }}</span>
          <span>Budget {{ compactIdr(row.budget) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Tekstur garis putus-putus di track kosong — nuansa "blueprint/ledger", terlihat di bagian yang belum terpakai karena bar solid di atasnya menutupinya. */
.track-texture {
  background-image: repeating-linear-gradient(90deg, hsl(var(--border)) 0, hsl(var(--border)) 2px, transparent 2px, transparent 6px);
  background-color: hsl(var(--muted) / 0.4);
}
</style>
