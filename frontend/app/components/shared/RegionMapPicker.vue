<script setup lang="ts">
import { computed, ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { Search, MapPin, Trash2, Plus } from 'lucide-vue-next'
import type { Map as LeafletMap, Marker as LeafletMarker, Polyline as LeafletPolyline } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { searchDestinations, haversineKm, type GeoPoint, type PlanningPin } from '~/data/geo'

const props = withDefaults(defineProps<{
  pins: PlanningPin[]
  canManage?: boolean
}>(), {
  canManage: true
})

const emit = defineEmits<{
  add: [payload: { label: string; lat: number; lng: number }]
  remove: [pinId: string]
}>()

/**
 * Peta jalan asli (Leaflet + tile CARTO Voyager, gratis tanpa API key) — bisa zoom/pan/scroll seperti Google
 * Maps, sama seperti `DestinationMap.vue`. Beda dengan komponen itu: di sini banyak pin sekaligus, dengan
 * search/add/remove dan garis rute antar pin berurutan.
 */
const query = ref('')
const suggestions = computed(() => searchDestinations(query.value).slice(0, 6))
const hoveredPinId = ref<string | undefined>()

const plotted = computed(() => [...props.pins].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)))

const totalDistanceKm = computed(() => {
  let total = 0
  for (let index = 1; index < plotted.value.length; index += 1) {
    total += haversineKm(plotted.value[index - 1], plotted.value[index])
  }
  return total
})

function pinIconHtml (label: string): string {
  return `
    <div style="position:relative; width:28px; height:28px;">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="hsl(241 98% 55%)" stroke="white" stroke-width="1.5" stroke-linejoin="round">
        <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
      </svg>
      <span style="position:absolute; top:4px; left:0; width:24px; text-align:center; font-size:11px; font-weight:700; color:white;">${label}</span>
    </div>
  `
}

const mapEl = ref<HTMLDivElement>()
let map: LeafletMap | undefined
let markers: LeafletMarker[] = []
let route: LeafletPolyline | undefined

async function renderMap () {
  if (!mapEl.value) { return }
  const L = await import('leaflet')

  if (!map) {
    map = L.map(mapEl.value, {
      scrollWheelZoom: true,
      worldCopyJump: false,
      maxBounds: [[-90, -180], [90, 180]],
      maxBoundsViscosity: 1
    }).setView([10, 105], 4)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>',
      maxZoom: 19,
      noWrap: true
    }).addTo(map)
  }

  markers.forEach(marker => marker.remove())
  markers = plotted.value.map((pin, index) => {
    const icon = L.divIcon({ html: pinIconHtml(String(index + 1)), className: '', iconSize: [28, 28], iconAnchor: [14, 28] })
    const marker = L.marker([pin.lat, pin.lng], { icon }).addTo(map as LeafletMap)
    marker.bindTooltip(pin.label, { direction: 'top', offset: [0, -26] })
    marker.on('mouseover', () => { hoveredPinId.value = pin.id })
    marker.on('mouseout', () => { hoveredPinId.value = undefined })
    return marker
  })

  route?.remove()
  route = plotted.value.length > 1
    ? L.polyline(plotted.value.map(pin => [pin.lat, pin.lng]), { color: 'hsl(241 98% 55%)', weight: 3, dashArray: '6 6' }).addTo(map)
    : undefined

  if (plotted.value.length) {
    map.fitBounds(plotted.value.map(pin => [pin.lat, pin.lng]), { padding: [40, 40], maxZoom: 10 })
  }
}

function destroyMap () {
  map?.remove()
  map = undefined
  markers = []
  route = undefined
}

watch(plotted, () => { void nextTick(() => renderMap()) }, { deep: true })

onMounted(() => { renderMap() })
onBeforeUnmount(() => { destroyMap() })

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

    <div class="rounded-lg border border-border overflow-hidden">
      <div ref="mapEl" class="relative z-0 h-[340px] w-full" />
    </div>

    <div class="flex flex-wrap items-center justify-between gap-2">
      <p class="text-xs text-muted-foreground">
        {{ pins.length }} titik disematkan
        <template v-if="totalDistanceKm"> · total rute ±{{ totalDistanceKm.toLocaleString('id-ID') }} km</template>
      </p>
      <p class="text-[11px] text-muted-foreground">
        Peta jalan asli (OpenStreetMap/CARTO) — butuh koneksi internet untuk memuat tile.
      </p>
    </div>

    <ul v-if="plotted.length" class="space-y-1">
      <li
        v-for="(pin, index) in plotted"
        :key="pin.id"
        class="flex items-center gap-2 px-2.5 py-2 rounded-lg transition-colors"
        :class="hoveredPinId === pin.id ? 'bg-primary/5' : 'hover:bg-muted/40'"
        @mouseenter="hoveredPinId = pin.id"
        @mouseleave="hoveredPinId = undefined"
      >
        <span class="h-5 w-5 shrink-0 rounded-full bg-primary text-primary-foreground text-[11px] font-semibold flex items-center justify-center">
          {{ index + 1 }}
        </span>
        <span class="min-w-0 flex-1">
          <span class="block text-sm text-foreground truncate">{{ pin.label }}</span>
          <span class="block text-xs text-muted-foreground">
            {{ pin.lat.toFixed(4) }}, {{ pin.lng.toFixed(4) }}
            <template v-if="pin.note"> · {{ pin.note }}</template>
          </span>
        </span>
        <button
          v-if="canManage"
          class="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
          title="Hapus pin"
          @click="emit('remove', pin.id)"
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
