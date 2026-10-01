<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { MapPinOff } from 'lucide-vue-next'
import type { Map as LeafletMap, Marker as LeafletMarker, Polyline as LeafletPolyline, CircleMarker as LeafletCircleMarker } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { DESTINATION_COORDINATES } from '~/data/geo'
import type { GeoPoint } from '~/types/common'

/** Titik keberangkatan tetap untuk `showRoute` — Jakarta/Soekarno-Hatta (CGK), entri yang sama dengan
 * `DESTINATION_COORDINATES` (`app/data/geo.ts`), konsisten dengan origin "CGK · Jakarta" di boarding-pass
 * hero Project Order (`ProjectBoardingPassHero.vue`). Bukan klaim rute penerbangan sungguhan — dekoratif. */
const ORIGIN = DESTINATION_COORDINATES.find(point => point.airportCode === 'CGK')!

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
  /** Opt-in — gambar rute garis putus-putus dari Jakarta (CGK) ke `geo`, dipakai halaman detail Project
   * ("boarding pass" theme). Default false supaya pemakaian existing (Opportunity/Quotation/Client Portal,
   * dll) tetap peta pin tunggal seperti sebelumnya. */
  showRoute?: boolean
}>(), {
  geo: undefined,
  destinationText: undefined,
  showRoute: false
})

const mapEl = ref<HTMLDivElement>()
let map: LeafletMap | undefined
let marker: LeafletMarker | undefined
let originMarker: LeafletCircleMarker | undefined
let route: LeafletPolyline | undefined

/** Pin kustom warna primary aplikasi (bukan marker biru default Leaflet) — HSL sama persis dengan `--primary` (`assets/css/tailwind.css`). */
const PIN_HTML = `
  <svg width="28" height="28" viewBox="0 0 24 24" fill="hsl(241 98% 55%)" stroke="white" stroke-width="1.5" stroke-linejoin="round">
    <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
    <circle cx="12" cy="10" r="3" fill="white" stroke="none" />
  </svg>
`

function renderRoute (L: typeof import('leaflet')) {
  originMarker?.remove()
  originMarker = undefined
  route?.remove()
  route = undefined
  if (!map || !props.geo || !props.showRoute) { return }
  if (props.geo.lat === ORIGIN.lat && props.geo.lng === ORIGIN.lng) { return }

  originMarker = L.circleMarker([ORIGIN.lat, ORIGIN.lng], {
    radius: 6, color: 'hsl(241 98% 55%)', weight: 2, fillColor: 'white', fillOpacity: 1
  }).bindTooltip(`${ORIGIN.name} (${ORIGIN.airportCode})`, { permanent: false }).addTo(map)

  route = L.polyline([[ORIGIN.lat, ORIGIN.lng], [props.geo.lat, props.geo.lng]], {
    color: 'hsl(241 98% 55%)', weight: 2, dashArray: '6 6'
  }).addTo(map)

  map.fitBounds([[ORIGIN.lat, ORIGIN.lng], [props.geo.lat, props.geo.lng]], { padding: [32, 32], maxZoom: 10 })
}

async function initMap () {
  if (!props.geo || !mapEl.value || map) { return }
  const L = await import('leaflet')

  map = L.map(mapEl.value, { scrollWheelZoom: true }).setView([props.geo.lat, props.geo.lng], 12)

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
    maxZoom: 19
  }).addTo(map)

  const icon = L.divIcon({ html: PIN_HTML, className: '', iconSize: [28, 28], iconAnchor: [14, 28] })
  marker = L.marker([props.geo.lat, props.geo.lng], { icon }).addTo(map)

  /** `fitBounds` (di `renderRoute`) menghitung zoom dari ukuran pixel container — kalau dipanggil di frame
   * yang sama dengan `L.map()` (sebelum browser sempat layout container-nya, mis. saat section ini baru
   * mount), Leaflet baca ukuran sebagai 0 dan jatuh ke zoom dunia penuh. `invalidateSize` + tunda satu frame
   * memaksa Leaflet baca ulang ukuran container yang sudah settled sebelum fitBounds jalan. */
  requestAnimationFrame(() => {
    map?.invalidateSize()
    renderRoute(L)
  })
}

function destroyMap () {
  map?.remove()
  map = undefined
  marker = undefined
  originMarker = undefined
  route = undefined
}

watch(() => props.geo, async (geo) => {
  if (!geo) { destroyMap(); return }
  if (!map) { initMap(); return }
  map.setView([geo.lat, geo.lng], map.getZoom())
  marker?.setLatLng([geo.lat, geo.lng])
  renderRoute(await import('leaflet'))
}, { flush: 'post' })

onMounted(() => { initMap() })
onBeforeUnmount(() => { destroyMap() })
</script>

<template>
  <div class="rounded-lg border border-border overflow-hidden">
    <div v-if="geo" ref="mapEl" class="relative z-0 h-[200px] w-full" />

    <div v-else class="flex items-center gap-2 px-3 py-3 text-muted-foreground bg-muted/20">
      <MapPinOff class="h-3.5 w-3.5 shrink-0" />
      <span class="text-xs">
        Lokasi<template v-if="destinationText"> "{{ destinationText }}"</template> belum cocok dengan referensi koordinat kami.
      </span>
    </div>
  </div>
</template>
