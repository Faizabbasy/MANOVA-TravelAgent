<script setup lang="ts">
import type { StatusBreakdownItem } from '~/components/shared/StatusBreakdownList.vue'

/**
 * Opportunity Pipeline — page-local (index.vue), khusus widget "Opportunity Pipeline". Sengaja terpisah dari
 * `StatusBreakdownList` (breakdown generik yang dipakai widget lain) karena bentuknya funnel corong, bukan
 * daftar bar horizontal — visual permintaan langsung, data sumbernya tetap `opportunityPipeline` di index.vue,
 * tidak ada logic/angka baru di sini.
 */
const props = defineProps<{ items: StatusBreakdownItem[] }>()

/** Gradasi biru → ungu untuk stage proses, hijau khusus stage "won" — supaya tiap stage kelihatan beda meski
 * tone-nya generik (mis. "proposal" dan "negotiation" sama-sama tone "primary" di StatusBreakdownList). */
const GRADIENT = ['#8FC1F5', '#63A3EE', '#4A85E3', '#5B4FE8', '#8B5CF6']
const WON_COLOR = 'hsl(var(--success))'

const maxCount = computed(() => Math.max(1, ...props.items.map(item => item.count)))

/**
 * Tiap band dihitung MANDIRI dari count stage-nya sendiri (relatif ke stage terbesar) — tidak dirantai ke
 * lebar band sebelumnya. Data snapshot stage saat ini TIDAK selalu mengecil monoton ke bawah (mis. "Won"
 * mengakumulasi seluruh deal menang sepanjang waktu, jadi wajar count-nya lebih besar dari stage tengah
 * yang isinya cuma deal yang KEBETULAN sedang di stage itu sekarang) — merantai lebar antar-band akan
 * memaksa bentuk funnel palsu (melebar-menyempit tidak konsisten dengan datanya sendiri).
 */
const bands = computed(() => props.items.map((item, index) => {
  const width = Math.max(24, Math.min(100, (item.count / maxCount.value) * 100))
  const color = item.key === 'won' ? WON_COLOR : GRADIENT[Math.min(index, GRADIENT.length - 1)]
  return { item, width, color }
}))

/** Wedge tipis mandiri (bukan dari lebar band tetangga) — sekadar aksen "corong" ringan di tiap bar sendiri. */
function clipPath (width: number) {
  const top = Math.min(100, width + 6)
  const bottom = Math.max(18, width - 6)
  const topLeft = (100 - top) / 2
  const bottomLeft = (100 - bottom) / 2
  return `polygon(${topLeft}% 0%, ${100 - topLeft}% 0%, ${100 - bottomLeft}% 100%, ${bottomLeft}% 100%)`
}
</script>

<template>
  <EmptyState v-if="!items.length" title="Belum ada data" />
  <div v-else class="space-y-1">
    <div v-for="band in bands" :key="band.item.key" class="flex items-center gap-3">
      <span class="w-28 shrink-0 truncate text-right text-xs font-medium text-foreground sm:w-32">
        {{ band.item.label }}
      </span>
      <div class="relative h-9 flex-1">
        <div
          class="absolute inset-0 transition-[clip-path] duration-500 ease-out"
          :style="{ clipPath: clipPath(band.width), backgroundColor: band.color }"
        />
      </div>
      <span class="w-24 shrink-0 whitespace-nowrap text-xs text-muted-foreground sm:w-28">
        {{ band.item.count }}<template v-if="band.item.secondaryLabel"> &middot; {{ band.item.secondaryLabel }}</template>
      </span>
    </div>
  </div>
</template>
