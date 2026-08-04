<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { MapPinOff } from 'lucide-vue-next'
import type { Map as LeafletMap, Marker as LeafletMarker } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { GeoPoint } from '~/types/common'

/**
 * Peta pin destinasi tunggal — dipakai di detail Opportunity/Quotation/Project/Itinerary dan Client Portal
 * untuk menampilkan `destinationGeo` yang sama (`resolveDestinationGeo`, `app/data/geo.ts`).
 *
 * Peta jalan asli (Leaflet + tile CARTO Voyager, gratis tanpa API key) — bisa zoom/pan/scroll seperti
 * Google Maps. BEDA dari revisi sebelumnya (peta skematik SVG offline): butuh koneksi internet untuk memuat
 * tile, tapi resolusi lat/lng-nya sendiri tetap murni lokal (`resolveDestinationGeo`), tidak ada geocoding
 * API pihak ketiga yang dipanggil.
 *
 * Sengaja komponen terpisah dari `RegionMapPicker` (banyak pin + search/add/remove untuk perencanaan) —
 * di sini hanya SATU titik, read-only, tanpa interaksi tambahan selain zoom/pan bawaan peta.
 */
const props = withDefaults(defineProps<{
  geo?: GeoPoint
  /** Ditampilkan pada pesan fallback ketika `geo` kosong — teks destinasi asli yang tidak cocok referensi. */
  destinationText?: string
}>(), {
  geo: undefined,
  destinationText: undefined
})

const mapEl = ref<HTMLDivElement>()
let map: LeafletMap | undefined
let marker: LeafletMarker | undefined

/** Pin kustom warna primary aplikasi (bukan marker biru default Leaflet) — HSL sama persis dengan `--primary` (`assets/css/tailwind.css`). */
const PIN_HTML = `
  <svg width="28" height="28" viewBox="0 0 24 24" fill="hsl(241 98% 55%)" stroke="white" stroke-width="1.5" stroke-linejoin="round">
    <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
    <circle cx="12" cy="10" r="3" fill="white" stroke="none" />
  </svg>
`

async function initMap () {
  if (!props.geo || !mapEl.value || map) { return }
  const L = await import('leaflet')

  map = L.map(mapEl.value, { scrollWheelZoom: true }).setView([props.geo.lat, props.geo.lng], 12)

  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>',
    maxZoom: 19
  }).addTo(map)

  const icon = L.divIcon({ html: PIN_HTML, className: '', iconSize: [28, 28], iconAnchor: [14, 28] })
  marker = L.marker([props.geo.lat, props.geo.lng], { icon }).addTo(map)
}

function destroyMap () {
  map?.remove()
  map = undefined
  marker = undefined
}

watch(() => props.geo, (geo) => {
  if (!geo) { destroyMap(); return }
  if (!map) { initMap(); return }
  map.setView([geo.lat, geo.lng], map.getZoom())
  marker?.setLatLng([geo.lat, geo.lng])
}, { flush: 'post' })

onMounted(() => { initMap() })
onBeforeUnmount(() => { destroyMap() })
</script>

<template>
  <div class="rounded-lg border border-border overflow-hidden">
    <div v-if="geo" ref="mapEl" class="h-[280px] w-full" />

    <div v-else class="flex items-center gap-2 px-3 py-3 text-muted-foreground bg-muted/20">
      <MapPinOff class="h-3.5 w-3.5 shrink-0" />
      <span class="text-xs">
        Lokasi<template v-if="destinationText"> "{{ destinationText }}"</template> belum cocok dengan referensi koordinat kami.
      </span>
    </div>
  </div>
</template>
