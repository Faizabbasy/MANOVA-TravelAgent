<script setup lang="ts">
import { computed, type Component } from 'vue'
import { cn } from '~/lib/utils'

/**
 * KPI tile — page-local, hanya dipakai `index.vue`.
 *
 * Ikon lingkaran solid + angka besar di bawahnya (bukan label/value sejajar dengan ikon di kanan) —
 * komposisi lebih tegas dan tidak generik dibanding pola "label kiri, ikon kanan" sebelumnya.
 *
 * Tint lembut per warna (bukan lagi kartu putih polos) — supaya baris KPI ini kebaca satu keluarga
 * dengan kartu hero Keuntungan/Pemasukan Bersih di atasnya (sama-sama color-coded), tapi levelnya lebih
 * tenang: tint tipis, bukan warna solid penuh, karena ini 6 tile sekaligus bukan 1-2 angka utama.
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

const BADGE_CLASSES: Record<string, string> = {
  blue: 'bg-blue-500 text-white',
  rose: 'bg-rose-500 text-white',
  violet: 'bg-violet-500 text-white',
  teal: 'bg-teal-500 text-white',
  amber: 'bg-amber-500 text-white',
  cyan: 'bg-cyan-500 text-white'
}

const TINT_CLASSES: Record<string, string> = {
  blue: 'border-blue-500/15 bg-blue-500/[0.05]',
  rose: 'border-rose-500/15 bg-rose-500/[0.05]',
  violet: 'border-violet-500/15 bg-violet-500/[0.05]',
  teal: 'border-teal-500/15 bg-teal-500/[0.05]',
  amber: 'border-amber-500/15 bg-amber-500/[0.05]',
  cyan: 'border-cyan-500/15 bg-cyan-500/[0.05]'
}
</script>

<template>
  <div
    :class="cn(
      'group relative min-w-0 rounded-2xl border p-4 shadow-[0_1px_2px_0_hsl(224_71%_4%/0.04)] transition-shadow duration-150 hover:shadow-md',
      TINT_CLASSES[color]
    )"
  >
    <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" :class="BADGE_CLASSES[color]">
      <component :is="icon" class="h-5 w-5" />
    </div>
    <p class="mt-3 truncate text-xs font-medium text-muted-foreground">
      {{ label }}
    </p>
    <p :class="cn('mt-1 whitespace-nowrap font-bold leading-8 tracking-tight text-foreground tabular-nums', valueTextClass)">
      {{ value }}
    </p>
    <p v-if="subtitle" class="mt-1.5 truncate text-xs text-muted-foreground">
      {{ subtitle }}
    </p>
  </div>
</template>
