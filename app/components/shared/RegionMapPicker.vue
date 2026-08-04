<script setup lang="ts">
import { computed, ref } from 'vue'
import { Search, MapPin, Trash2, Plus } from 'lucide-vue-next'
import { cn } from '~/lib/utils'
import { searchDestinations, haversineKm, type GeoPoint, type PlanningPin } from '~/data/geo'

const props = withDefaults(defineProps<{
  pins: PlanningPin[]
  canManage?: boolean
  /** Batas bidang peta (equirectangular). Default mencakup Asia Tenggara s/d Timur Tengah & Australia. */
  bounds?: { minLat: number; maxLat: number; minLng: number; maxLng: number }
}>(), {
  canManage: true,
  bounds: () => ({ minLat: -40, maxLat: 45, minLng: 45, maxLng: 155 })
})

const emit = defineEmits<{
  add: [payload: { label: string; lat: number; lng: number }]
  remove: [pinId: string]
}>()

/**
 * Peta perencanaan tanpa library eksternal (`revisi.md` #22–23). Titik diproyeksikan equirectangular ke
 * bidang SVG, dengan grid lintang/bujur sebagai orientasi. Konsekuensi yang disadari: ini peta skematik,
 * bukan peta jalan bertile — dipilih agar demo tetap berjalan penuh tanpa koneksi internet dan tanpa
 * API key. Semua koordinat nyata, jadi jarak dan posisi relatif antar destinasi tetap akurat.
 */
const query = ref('')
const suggestions = computed(() => searchDestinations(query.value).slice(0, 6))
const hoveredPinId = ref<string | undefined>()

function toX (lng: number): number {
  const { minLng, maxLng } = props.bounds
  return ((lng - minLng) / (maxLng - minLng)) * 100
}

function toY (lat: number): number {
  const { minLat, maxLat } = props.bounds
  /** Lintang naik ke atas, sumbu Y SVG naik ke bawah — karena itu dibalik. */
  return ((maxLat - lat) / (maxLat - minLat)) * 100
}

const plotted = computed(() => [...props.pins]
  .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  .map(pin => ({ pin, x: toX(pin.lng), y: toY(pin.lat) })))

/** Garis rute antar pin berurutan + total jarak — memberi arti pada urutan kunjungan. */
const routeLine = computed(() => plotted.value.map(item => `${item.x},${item.y}`).join(' '))

const totalDistanceKm = computed(() => {
  const sorted = [...props.pins].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  let total = 0
  for (let index = 1; index < sorted.length; index += 1) {
    total += haversineKm(sorted[index - 1], sorted[index])
  }
  return total
})

const latitudeTicks = computed(() => {
  const { minLat, maxLat } = props.bounds
  const step = (maxLat - minLat) / 4
  return [0, 1, 2, 3, 4].map(index => Math.round(minLat + step * index))
})

const longitudeTicks = computed(() => {
  const { minLng, maxLng } = props.bounds
  const step = (maxLng - minLng) / 4
  return [0, 1, 2, 3, 4].map(index => Math.round(minLng + step * index))
})

function addFromSuggestion (point: GeoPoint) {
  emit('add', { label: `${point.name}, ${point.country}`, lat: point.lat, lng: point.lng })
  query.value = ''
}
</script>

<template>
  <div class="space-y-3">
    <div v-if="canManage" class="relative">
      <div class="relative">
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input v-model="query" placeholder="Ketik nama daerah untuk menyematkan pin (mis. Bali, Manila, Tokyo)..." class="pl-9" />
      </div>

      <ul
        v-if="suggestions.length"
        class="absolute z-20 mt-1 w-full rounded-lg border border-border bg-card shadow-lg overflow-hidden"
      >
        <li v-for="point in suggestions" :key="`${point.name}-${point.lat}`">
          <button
            type="button"
            class="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/60 transition-colors"
            @click="addFromSuggestion(point)"
          >
            <MapPin class="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span class="min-w-0 flex-1">
              <span class="block text-sm text-foreground truncate">{{ point.name }}, {{ point.country }}</span>
              <span class="block text-xs text-muted-foreground">
                {{ point.lat.toFixed(3) }}, {{ point.lng.toFixed(3) }}
                <template v-if="point.airportCode"> · {{ point.airportCode }}</template>
              </span>
            </span>
            <Plus class="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          </button>
        </li>
      </ul>
    </div>

    <div class="relative rounded-lg border border-border bg-muted/20 overflow-hidden">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" class="w-full h-[340px]">
        <!-- Grid orientasi lintang/bujur -->
        <g stroke="currentColor" class="text-border" stroke-width="0.15">
          <line v-for="index in 5" :key="`h-${index}`" x1="0" :y1="(index - 1) * 25" x2="100" :y2="(index - 1) * 25" />
          <line v-for="index in 5" :key="`v-${index}`" :x1="(index - 1) * 25" y1="0" :x2="(index - 1) * 25" y2="100" />
        </g>

        <!-- Garis khatulistiwa ditebalkan sebagai patokan utama -->
        <line
          x1="0"
          :y1="toY(0)"
          x2="100"
          :y2="toY(0)"
          stroke="currentColor"
          class="text-warning"
          stroke-width="0.3"
          stroke-dasharray="1.5 1"
        />

        <!-- Rute antar pin -->
        <polyline
          v-if="plotted.length > 1"
          :points="routeLine"
          fill="none"
          stroke="currentColor"
          class="text-primary"
          stroke-width="0.4"
          stroke-dasharray="1.5 1"
        />

        <!-- Pin -->
        <g v-for="(item, index) in plotted" :key="item.pin.id">
          <circle
            :cx="item.x"
            :cy="item.y"
            :r="hoveredPinId === item.pin.id ? 2.2 : 1.6"
            fill="currentColor"
            class="text-primary transition-all"
            @mouseenter="hoveredPinId = item.pin.id"
            @mouseleave="hoveredPinId = undefined"
          />
          <text
            :x="item.x"
            :y="item.y + 0.6"
            text-anchor="middle"
            class="fill-primary-foreground"
            style="font-size: 2px; font-weight: 600"
          >{{ index + 1 }}</text>
        </g>
      </svg>

      <!-- Label sumbu -->
      <div class="absolute inset-x-0 bottom-0 flex justify-between px-1 pb-0.5 pointer-events-none">
        <span v-for="tick in longitudeTicks" :key="tick" class="text-[10px] text-muted-foreground">{{ tick }}°</span>
      </div>
      <div class="absolute inset-y-0 left-0 flex flex-col justify-between py-1 pl-1 pointer-events-none">
        <span v-for="tick in latitudeTicks" :key="tick" class="text-[10px] text-muted-foreground">{{ tick }}°</span>
      </div>
    </div>

    <div class="flex flex-wrap items-center justify-between gap-2">
      <p class="text-xs text-muted-foreground">
        {{ pins.length }} titik disematkan
        <template v-if="totalDistanceKm"> · total rute ±{{ totalDistanceKm.toLocaleString('id-ID') }} km</template>
      </p>
      <p class="text-[11px] text-muted-foreground">
        Peta skematik berbasis koordinat asli — berjalan penuh tanpa koneksi internet.
      </p>
    </div>

    <ul v-if="plotted.length" class="space-y-1">
      <li
        v-for="(item, index) in plotted"
        :key="item.pin.id"
        class="flex items-center gap-2 px-2.5 py-2 rounded-lg transition-colors"
        :class="hoveredPinId === item.pin.id ? 'bg-primary/5' : 'hover:bg-muted/40'"
        @mouseenter="hoveredPinId = item.pin.id"
        @mouseleave="hoveredPinId = undefined"
      >
        <span class="h-5 w-5 shrink-0 rounded-full bg-primary text-primary-foreground text-[11px] font-semibold flex items-center justify-center">
          {{ index + 1 }}
        </span>
        <span class="min-w-0 flex-1">
          <span class="block text-sm text-foreground truncate">{{ item.pin.label }}</span>
          <span class="block text-xs text-muted-foreground">
            {{ item.pin.lat.toFixed(4) }}, {{ item.pin.lng.toFixed(4) }}
            <template v-if="item.pin.note"> · {{ item.pin.note }}</template>
          </span>
        </span>
        <button
          v-if="canManage"
          class="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
          title="Hapus pin"
          @click="emit('remove', item.pin.id)"
        >
          <Trash2 class="h-3.5 w-3.5" />
        </button>
      </li>
    </ul>

    <EmptyState
      v-else
      :icon="MapPin"
      title="Belum ada titik"
      description="Ketik nama daerah di kolom pencarian untuk menyematkan pin pertama."
    />
  </div>
</template>
