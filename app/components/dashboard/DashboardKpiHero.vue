<script setup lang="ts">
import type { Component } from 'vue'
import { formatNumber } from '~/utils/format'
import { useCountUp } from '~/composables/useCountUp'

/**
 * Hero tile untuk KPI row yang cuma berisi SATU card (mis. dashboard Sales — hanya "Leads in Quotation"
 * yang visible untuk role ini). `DashboardStat` sengaja diam-diam supaya tidak berebut perhatian dengan
 * `DashboardHeroPanel` (Pemasukan Bersih/Profit) — tapi kalau hero finansial itu tidak tampil (role Sales
 * tidak punya akses), satu-satunya KPI card jadi elemen paling atas di halaman dan berhak dapat perlakuan
 * "hero", bukan tile kecil yang di-stretch grid auto-fit jadi kotak lebar kosong.
 *
 * Tidak ada sparkline — tidak ada histori bulanan asli untuk hitungan lead ini (beda dari
 * `DashboardHeroPanel`), jadi sengaja tidak digambar tren palsu. Motif ikon besar transparan di kanan
 * murni dekoratif (bukan data).
 */
const props = withDefaults(defineProps<{
  label: string
  value: number
  icon: Component
  subtitle?: string
  ctaLabel?: string
  ctaTo?: string
  color?: 'blue' | 'rose' | 'violet' | 'teal' | 'amber' | 'cyan'
}>(), { color: 'violet' })

const ACCENT_BG: Record<string, string> = {
  blue: 'bg-gradient-to-br from-primary/[0.14] via-primary/[0.04] to-transparent',
  rose: 'bg-gradient-to-br from-destructive/[0.14] via-destructive/[0.04] to-transparent',
  violet: 'bg-gradient-to-br from-violet-500/[0.14] via-violet-500/[0.04] to-transparent',
  teal: 'bg-gradient-to-br from-teal-500/[0.14] via-teal-500/[0.04] to-transparent',
  amber: 'bg-gradient-to-br from-amber-500/[0.14] via-amber-500/[0.04] to-transparent',
  cyan: 'bg-gradient-to-br from-cyan-500/[0.14] via-cyan-500/[0.04] to-transparent'
}

const ACCENT_BORDER: Record<string, string> = {
  blue: 'border-primary/[0.14]',
  rose: 'border-destructive/[0.14]',
  violet: 'border-violet-500/[0.14]',
  teal: 'border-teal-500/[0.14]',
  amber: 'border-amber-500/[0.14]',
  cyan: 'border-cyan-500/[0.14]'
}

const ACCENT_BADGE: Record<string, string> = {
  blue: 'bg-primary text-primary-foreground',
  rose: 'bg-destructive text-destructive-foreground',
  violet: 'bg-violet-500 text-white',
  teal: 'bg-teal-500 text-white',
  amber: 'bg-amber-500 text-white',
  cyan: 'bg-cyan-500 text-white'
}

const ACCENT_TEXT: Record<string, string> = {
  blue: 'text-primary',
  rose: 'text-destructive',
  violet: 'text-violet-600',
  teal: 'text-teal-600',
  amber: 'text-amber-600',
  cyan: 'text-cyan-600'
}

const ACCENT_WATERMARK: Record<string, string> = {
  blue: 'text-primary/[0.06]',
  rose: 'text-destructive/[0.06]',
  violet: 'text-violet-500/[0.06]',
  teal: 'text-teal-500/[0.06]',
  amber: 'text-amber-500/[0.06]',
  cyan: 'text-cyan-500/[0.06]'
}

const displayValue = useCountUp(props.value, 80)
</script>

<template>
  <div
    class="kpi-hero group relative flex max-w-lg items-center gap-5 overflow-hidden rounded-2xl border p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
    :class="[ACCENT_BG[color], ACCENT_BORDER[color]]"
  >
    <component
      :is="icon"
      class="pointer-events-none absolute -right-4 -bottom-6 h-32 w-32 rotate-[-8deg] transition-transform duration-300 group-hover:rotate-0"
      :class="ACCENT_WATERMARK[color]"
      aria-hidden="true"
    />

    <div class="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl shadow-sm" :class="ACCENT_BADGE[color]">
      <component :is="icon" class="h-6 w-6" />
    </div>

    <div class="relative min-w-0">
      <p class="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {{ label }}
      </p>
      <p class="mt-1.5 text-[2.75rem] font-bold leading-none tabular-nums text-foreground">
        {{ formatNumber(displayValue.value) }}
      </p>
      <p v-if="subtitle" class="mt-2 text-sm text-muted-foreground">
        {{ subtitle }}
      </p>
      <NuxtLink v-if="ctaTo" :to="ctaTo" class="mt-3 inline-flex items-center gap-1 text-sm font-semibold hover:underline" :class="ACCENT_TEXT[color]">
        {{ ctaLabel ?? 'Lihat detail' }}
        <span aria-hidden="true">→</span>
      </NuxtLink>
    </div>
  </div>
</template>

<style scoped>
.kpi-hero {
  animation: kpi-hero-in 0.5s ease-out backwards;
}

@keyframes kpi-hero-in {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

@media (prefers-reduced-motion: reduce) {
  .kpi-hero { animation: none; }
}
</style>
