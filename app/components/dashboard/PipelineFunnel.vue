<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import type { StatusBreakdownItem } from '~/components/shared/StatusBreakdownList.vue'
import { formatNumber } from '~/utils/format'

/**
 * Opportunity Pipeline — page-local (index.vue), khusus widget "Opportunity Pipeline". Riwayat bentuknya:
 * funnel corong custom → diagram batang (Chart.js, horizontal lalu vertikal) → ini, dirombak total dari
 * referensi visual eksplisit (kartu finance "hero number + chart + panel stat" dengan bar pucat default,
 * warna+tekstur cuma muncul saat hover, tooltip kartu presisi). Data sumbernya tetap `opportunityPipeline`
 * di index.vue (`items` prop, tidak berubah) — seluruh angka turunan (total, stage Won, stage teramai,
 * konversi terbaik) dihitung MURNI dari `items` yang sama, tidak ada logic/fetch baru.
 *
 * Palet ordinal 5-langkah (satu hue indigo, terang→gelap) tervalidasi lolos `dataviz` skill's
 * `validate_palette.js --ordinal` (monotone, jarak-L cukup, kontras ujung terang, hue tunggal). "Won"
 * sengaja LEPAS dari ramp ini dan pakai token status sukses — bukan langkah ramp ke-6, karena "Won" bukan
 * urutan lebih jauh, melainkan status tercapai.
 */
const props = defineProps<{ items: StatusBreakdownItem[] }>()

const PROCESS_RAMP = ['#7b79ec', '#3532e2', '#1c19b3', '#131178', '#0b0a47']
/** Hex ekuivalen token `--success` (142 76% 36%, sama di light/dark) — dipakai literal supaya bisa dikombinasikan dengan alpha-hex untuk wash/hatch, sesuatu yang tidak bisa dilakukan pada `hsl(var(--success))`. */
const WON_COLOR = '#16a249'

const revealed = ref(false)
const prefersReducedMotion = ref(false)
onMounted(() => {
  prefersReducedMotion.value = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  requestAnimationFrame(() => { revealed.value = true })
})

const maxCount = computed(() => Math.max(1, ...props.items.map(item => item.count)))
const totalCount = computed(() => props.items.reduce((sum, item) => sum + item.count, 0))
const wonItem = computed(() => props.items.find(item => item.key === 'won'))
const busiestItem = computed(() => (props.items.length
  ? [...props.items].sort((a, b) => b.count - a.count)[0]
  : undefined))

/** Geometri kolom — persentase murni (0-100) di dua sumbu, dipakai bareng oleh bar (CSS) dan kurva (SVG viewBox 0 0 100 100) supaya keduanya presisi nyambung tanpa drift. */
const MIN_HEIGHT_PCT = 14
const MAX_HEIGHT_PCT = 92
const columns = computed(() => {
  const n = props.items.length
  if (!n) { return [] }
  const colWidth = 100 / n
  return props.items.map((item, index) => {
    const heightPct = MIN_HEIGHT_PCT + (item.count / maxCount.value) * (MAX_HEIGHT_PCT - MIN_HEIGHT_PCT)
    return {
      item,
      index,
      cx: colWidth * (index + 0.5),
      topPct: 100 - heightPct,
      heightPct,
      color: item.key === 'won' ? WON_COLOR : PROCESS_RAMP[Math.min(index, PROCESS_RAMP.length - 1)]
    }
  })
})

/** Kurva mengalir antar-kolom bertetangga + persentase lanjut (bisa >100% — "Won" mengakumulasi, bukan cuma menyusut monoton). Selalu tampil (tidak ikut ghosting bar) — ini struktur funnel-nya sendiri, bukan detail yang perlu disembunyikan. */
const flows = computed(() => {
  const cols = columns.value
  const result: { key: string; d: string; labelX: number; labelY: number; pct: number; fromLabel: string; toLabel: string }[] = []
  for (let i = 0; i < cols.length - 1; i++) {
    const a = cols[i]
    const b = cols[i + 1]
    const midX = (a.cx + b.cx) / 2
    result.push({
      key: `${a.item.key}-${b.item.key}`,
      d: `M ${a.cx} ${a.topPct} C ${midX} ${a.topPct} ${midX} ${b.topPct} ${b.cx} ${b.topPct}`,
      labelX: midX,
      labelY: Math.min(a.topPct, b.topPct) - 3,
      pct: a.item.count > 0 ? Math.round((b.item.count / a.item.count) * 100) : 0,
      fromLabel: a.item.label,
      toLabel: b.item.label
    })
  }
  return result
})

const bestFlow = computed(() => (flows.value.length
  ? [...flows.value].sort((a, b) => b.pct - a.pct)[0]
  : undefined))

const hoveredKey = ref<string | null>(null)

/** Wash tipis + garis diagonal 45°/135° dalam warna stage-nya sendiri — cuma dipakai kolom yang lagi di-hover, supaya warna jadi "hadiah" interaksi, bukan menyala di semua bar sekaligus. */
function hatchStyle (hex: string) {
  return {
    backgroundColor: `${hex}22`,
    backgroundImage: `repeating-linear-gradient(45deg, ${hex}99 0px, ${hex}99 2px, transparent 2px, transparent 7px)`
  }
}
</script>

<template>
  <EmptyState v-if="!items.length" title="Belum ada data" />
  <div v-else class="flex flex-col gap-5 sm:flex-row">
    <!-- Kiri: angka hero + chart -->
    <div class="min-w-0 flex-1">
      <p class="text-[1.75rem] font-bold leading-9 tracking-tight text-foreground tabular-nums">
        {{ formatNumber(totalCount) }}
      </p>
      <p class="text-xs text-muted-foreground">
        Opportunity aktif dalam pipeline
      </p>

      <div class="relative mt-5 h-[168px]">
        <svg class="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <path
            v-for="flow in flows"
            :key="flow.key"
            :d="flow.d"
            fill="none"
            stroke="hsl(var(--border))"
            stroke-width="1.5"
            vector-effect="non-scaling-stroke"
            :style="{ opacity: revealed ? 1 : 0, transition: prefersReducedMotion ? 'none' : 'opacity 500ms ease-out 400ms' }"
          />
        </svg>

        <span
          v-for="flow in flows"
          :key="`${flow.key}-label`"
          class="pointer-events-none absolute -translate-x-1/2 -translate-y-full whitespace-nowrap text-[10px] font-medium text-muted-foreground"
          :style="{ left: `${flow.labelX}%`, top: `${flow.labelY}%`, opacity: revealed ? 1 : 0, transition: prefersReducedMotion ? 'none' : 'opacity 500ms ease-out 600ms' }"
        >
          {{ flow.pct }}%
        </span>

        <div class="relative flex h-full items-end">
          <div
            v-for="col in columns"
            :key="col.item.key"
            class="group relative flex h-full flex-1 flex-col items-center justify-end"
            @mouseenter="hoveredKey = col.item.key"
            @mouseleave="hoveredKey = null"
          >
            <!-- Tooltip kartu, cuma muncul saat kolom ini di-hover -->
            <div
              v-if="hoveredKey === col.item.key"
              class="pointer-events-none absolute z-10 w-44 -translate-x-1/2 rounded-xl border border-border bg-card p-3 text-left shadow-lg"
              :style="{ left: `${col.cx}%`, bottom: `calc(${col.heightPct}% + 12px)` }"
            >
              <p class="truncate text-xs font-semibold text-foreground">
                {{ col.item.label }}
              </p>
              <div class="mt-1.5 space-y-1">
                <div class="flex items-center justify-between gap-2 text-[11px]">
                  <span class="flex items-center gap-1.5 text-muted-foreground">
                    <span class="h-1.5 w-1.5 shrink-0 rounded-full" :style="{ backgroundColor: col.color }" />
                    Opportunity
                  </span>
                  <span class="font-semibold text-foreground">{{ col.item.count }}</span>
                </div>
                <div v-if="col.item.secondaryLabel" class="flex items-center justify-between gap-2 text-[11px]">
                  <span class="flex items-center gap-1.5 text-muted-foreground">
                    <span class="h-1.5 w-1.5 shrink-0 rounded-full opacity-0" />
                    Nilai
                  </span>
                  <span class="font-semibold text-foreground">{{ col.item.secondaryLabel }}</span>
                </div>
              </div>
            </div>

            <span class="mb-1.5 text-[11px] font-semibold tabular-nums text-foreground">
              {{ col.item.count }}
            </span>
            <div
              class="w-full max-w-[42px] rounded-full"
              :style="[
                hoveredKey === col.item.key ? hatchStyle(col.color) : { backgroundColor: '#E9EAEE' },
                {
                  height: revealed ? `${col.heightPct}%` : '0%',
                  transition: prefersReducedMotion
                    ? 'none'
                    : `height 650ms cubic-bezier(0.16, 1, 0.3, 1) ${col.index * 70}ms, background-color 200ms ease-out`
                }
              ]"
            />
          </div>
        </div>
      </div>

      <div class="mt-2 flex border-t border-border pt-2">
        <div v-for="col in columns" :key="`${col.item.key}-axis`" class="flex-1 min-w-0 px-0.5 text-center">
          <p class="truncate text-[11px] text-muted-foreground" :title="col.item.label">
            {{ col.item.label }}
          </p>
        </div>
      </div>
    </div>

    <!-- Kanan: panel insight, turunan murni dari `items` yang sama -->
    <div class="flex w-full shrink-0 flex-col gap-6 border-t border-border pt-5 sm:w-48 sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0">
      <div>
        <p class="text-xs font-medium text-muted-foreground">
          Won
        </p>
        <p class="mt-1 text-2xl font-bold leading-8 text-foreground tabular-nums">
          {{ wonItem ? wonItem.count : '—' }}
        </p>
        <p class="mt-0.5 truncate text-xs text-muted-foreground">
          {{ wonItem?.secondaryLabel ?? 'Belum ada deal menang' }}
        </p>
      </div>
      <div v-if="busiestItem">
        <p class="text-xs font-medium text-muted-foreground">
          Stage Teramai
        </p>
        <p class="mt-1 truncate text-base font-semibold leading-6 text-foreground">
          {{ busiestItem.label }}
        </p>
        <p class="mt-0.5 text-xs text-muted-foreground">
          {{ busiestItem.count }} opportunity
        </p>
      </div>
      <div v-if="bestFlow">
        <p class="text-xs font-medium text-muted-foreground">
          Konversi Terbaik
        </p>
        <p class="mt-1 text-2xl font-bold leading-8 text-success tabular-nums">
          {{ bestFlow.pct }}%
        </p>
        <p class="mt-0.5 truncate text-xs text-muted-foreground">
          {{ bestFlow.fromLabel }} → {{ bestFlow.toLabel }}
        </p>
      </div>
    </div>
  </div>
</template>
