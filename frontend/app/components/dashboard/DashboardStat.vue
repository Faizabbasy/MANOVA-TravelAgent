<script setup lang="ts">
import { computed, type Component } from 'vue'
import { cn } from '~/lib/utils'

/**
 * KPI tile sekunder — page-local, hanya dipakai `index.vue`.
 *
 * Sengaja diam-diam dibanding `DashboardHeroPanel` di atasnya (hairline + putih, bukan tint-block +
 * ikon-dalam-lingkaran) — supaya Pemasukan Bersih/Profit tetap yang paling menonjol di halaman ini, bukan
 * ke-6 tile ini ikut berebut perhatian dengan warna solid yang sama kuatnya. Ikon jadi chip kotak kecil
 * pojok kiri (bukan lingkaran besar), garis aksen tipis 2px di atas kartu menggantikan bg bertint penuh,
 * dan angka pakai `tabular-nums` (font aplikasi biasa, bukan font berbeda) supaya rapi berbaris.
 */
const props = withDefaults(defineProps<{
  label: string
  value: string
  icon: Component
  color?: 'blue' | 'rose' | 'violet' | 'teal' | 'amber' | 'cyan'
  subtitle?: string
}>(), { color: 'blue' })

/**
 * Angka panjang (mis. "Rp 1.705.000.000") tidak boleh membelah di tengah digit — spasi antara "Rp" dan
 * nominalnya adalah non-breaking space (bawaan `Intl.NumberFormat`), jadi tanpa ini teks tidak punya titik
 * potong yang valid dan `break-words` akan memotongnya sembarang di tengah angka. Solusinya bukan izinkan
 * wrap, tapi cegah wrap sama sekali (`whitespace-nowrap`) dan kecilkan ukuran font otomatis kalau kepanjangan.
 */
const valueTextClass = computed(() => {
  const length = props.value.length
  if (length > 15) { return 'text-base' }
  if (length > 12) { return 'text-lg' }
  if (length > 9) { return 'text-xl' }
  return 'text-2xl'
})

const ACCENT_BAR: Record<string, string> = {
  blue: 'bg-primary',
  rose: 'bg-rose-500',
  violet: 'bg-violet-500',
  teal: 'bg-teal-500',
  amber: 'bg-amber-500',
  cyan: 'bg-cyan-500'
}

const ICON_CLASSES: Record<string, string> = {
  blue: 'bg-primary/10 text-primary',
  rose: 'bg-rose-500/10 text-rose-600',
  violet: 'bg-violet-500/10 text-violet-600',
  teal: 'bg-teal-500/10 text-teal-600',
  amber: 'bg-amber-500/10 text-amber-600',
  cyan: 'bg-cyan-500/10 text-cyan-600'
}
</script>

<template>
  <div class="group relative min-w-0 overflow-hidden rounded-xl border border-border bg-card p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:shadow-black/5">
    <span class="absolute inset-x-0 top-0 h-0.5 origin-left scale-x-0 transition-transform duration-200 group-hover:scale-x-100" :class="ACCENT_BAR[color]" />

    <div class="flex items-center gap-2">
      <div class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg" :class="ICON_CLASSES[color]">
        <component :is="icon" class="h-3.5 w-3.5" />
      </div>
      <p class="truncate text-xs font-medium text-muted-foreground">
        {{ label }}
      </p>
    </div>

    <p :class="cn('mt-2.5 whitespace-nowrap font-semibold leading-8 tracking-tight text-foreground tabular-nums', valueTextClass)">
      {{ value }}
    </p>
    <p v-if="subtitle" class="mt-1 truncate text-xs text-muted-foreground">
      {{ subtitle }}
    </p>
  </div>
</template>
