import { reactive } from 'vue'
import type { ID, GeoPoint } from '~/types/common'

/**
 * Koordinat destinasi untuk perencanaan berbasis peta (Revisi 9-Modul, `revisi.md` #22–23:
 * "untuk perencanan pakai map / ketik daerah dan di map di pin").
 *
 * SENGAJA tanpa library peta eksternal. Peta digambar sebagai bidang koordinat yang diproyeksikan
 * (equirectangular) di atas SVG inline, sehingga:
 *   - demo tetap berjalan penuh tanpa koneksi internet (tidak ada tile server yang dipanggil),
 *   - tidak ada dependency baru yang perlu dipasang, dan
 *   - tidak ada API key yang perlu dikelola.
 * Konsekuensinya peta ini skematik, bukan peta jalan — cukup untuk menempatkan dan membandingkan lokasi
 * destinasi, yang memang tujuan fitur ini.
 *
 * `destinationId` menaut ke `MASTER_DESTINATIONS` (`app/data/master-data.ts`) supaya daftar destinasi
 * tetap satu sumber; file ini hanya menambahkan koordinatnya.
 */

export const DESTINATION_COORDINATES: GeoPoint[] = reactive([
  { destinationId: 'DST-001', name: 'Manila', country: 'Filipina', lat: 14.5995, lng: 120.9842, airportCode: 'MNL' },
  { destinationId: 'DST-002', name: 'Abu Dhabi', country: 'Uni Emirat Arab', lat: 24.4539, lng: 54.3773, airportCode: 'AUH' },
  { destinationId: 'DST-003', name: 'Palu', country: 'Indonesia', lat: -0.8917, lng: 119.8707, airportCode: 'PLW' },
  { destinationId: 'DST-004', name: 'Denpasar (Bali)', country: 'Indonesia', lat: -8.6705, lng: 115.2126, airportCode: 'DPS' },
  { destinationId: 'DST-005', name: 'Singapura', country: 'Singapura', lat: 1.3521, lng: 103.8198, airportCode: 'SIN' },
  { destinationId: 'DST-006', name: 'Tokyo', country: 'Jepang', lat: 35.6762, lng: 139.6503, airportCode: 'HND' },
  { destinationId: 'DST-007', name: 'Bangkok', country: 'Thailand', lat: 13.7563, lng: 100.5018, airportCode: 'BKK' },
  { name: 'Jakarta', country: 'Indonesia', lat: -6.2088, lng: 106.8456, airportCode: 'CGK' },
  { name: 'Surabaya', country: 'Indonesia', lat: -7.2575, lng: 112.7521, airportCode: 'SUB' },
  { name: 'Yogyakarta', country: 'Indonesia', lat: -7.7956, lng: 110.3695, airportCode: 'YIA' },
  { name: 'Bandung', country: 'Indonesia', lat: -6.9175, lng: 107.6191, airportCode: 'BDO' },
  { name: 'Medan', country: 'Indonesia', lat: 3.5952, lng: 98.6722, airportCode: 'KNO' },
  { name: 'Makassar', country: 'Indonesia', lat: -5.1477, lng: 119.4327, airportCode: 'UPG' },
  { name: 'Balikpapan', country: 'Indonesia', lat: -1.2379, lng: 116.8529, airportCode: 'BPN' },
  { name: 'Labuan Bajo', country: 'Indonesia', lat: -8.4964, lng: 119.8877, airportCode: 'LBJ' },
  { name: 'Lombok', country: 'Indonesia', lat: -8.5833, lng: 116.1167, airportCode: 'LOP' },
  { name: 'Batam', country: 'Indonesia', lat: 1.0456, lng: 104.0305, airportCode: 'BTH' },
  { name: 'Kuala Lumpur', country: 'Malaysia', lat: 3.1390, lng: 101.6869, airportCode: 'KUL' },
  { name: 'Ho Chi Minh City', country: 'Vietnam', lat: 10.8231, lng: 106.6297, airportCode: 'SGN' },
  { name: 'Seoul', country: 'Korea Selatan', lat: 37.5665, lng: 126.9780, airportCode: 'ICN' },
  { name: 'Dubai', country: 'Uni Emirat Arab', lat: 25.2048, lng: 55.2708, airportCode: 'DXB' },
  { name: 'Sydney', country: 'Australia', lat: -33.8688, lng: 151.2093, airportCode: 'SYD' }
])

export interface PlanningPin {
  id: ID
  projectId?: ID
  label: string
  lat: number
  lng: number
  note?: string
  /** Urutan kunjungan dalam rencana perjalanan — menggambar garis rute antar pin. */
  order?: number
}

export const PLANNING_PINS: PlanningPin[] = reactive([
  { id: 'PIN-001', projectId: 'PRJ-103', label: 'Palu — Venue Konferensi', lat: -0.8917, lng: 119.8707, order: 1, note: 'Lokasi utama MICE Conference 2026.' },
  { id: 'PIN-002', projectId: 'PRJ-103', label: 'Makassar — Titik Transit', lat: -5.1477, lng: 119.4327, order: 2, note: 'Transit penerbangan peserta dari Jawa.' },
  { id: 'PIN-003', projectId: 'PRJ-101', label: 'Manila — Kantor Klien', lat: 14.5995, lng: 120.9842, order: 1 },
  { id: 'PIN-004', projectId: 'PRJ-102', label: 'Abu Dhabi — Kandidat Venue', lat: 24.4539, lng: 54.3773, order: 1, note: 'Opsi kedua setelah venue pertama tidak tersedia.' }
])

/** Cari koordinat berdasarkan nama daerah — pencocokan longgar agar "bali" menemukan "Denpasar (Bali)". */
export function searchDestinations (query: string): GeoPoint[] {
  const term = query.trim().toLowerCase()
  if (!term) { return [] }
  return DESTINATION_COORDINATES.filter(point =>
    point.name.toLowerCase().includes(term) ||
    point.country.toLowerCase().includes(term) ||
    (point.airportCode ?? '').toLowerCase().includes(term))
}

/**
 * Resolusi "teks destinasi" (mis. `Opportunity.destination`/`Project.destination`, format bebas seperti
 * "Bali, Indonesia" atau "Denpasar") ke satu `GeoPoint` — dasar "menyimpan data lokasi terstruktur" saat
 * destinasi dibuat/diubah (`updateOpportunityRequirement`, `approveOpportunityWon`, dll, `app/data/index.ts`).
 * Format "Kota, Negara" dipecah per-bagian karena teks gabungan itu sendiri jarang cocok sebagai substring
 * dari `name`/`country` yang tersimpan.
 */
export function resolveDestinationGeo (destinationText: string): GeoPoint | undefined {
  const term = destinationText.trim().toLowerCase()
  if (!term) { return undefined }

  const direct = DESTINATION_COORDINATES.find(point =>
    point.name.toLowerCase().includes(term) ||
    term.includes(point.name.toLowerCase()) ||
    (point.airportCode ?? '').toLowerCase() === term)
  if (direct) { return direct }

  const parts = term.split(',').map(part => part.trim()).filter(Boolean)
  for (const part of parts) {
    const match = DESTINATION_COORDINATES.find(point =>
      point.name.toLowerCase().includes(part) ||
      part.includes(point.name.toLowerCase()) ||
      point.country.toLowerCase().includes(part) ||
      part.includes(point.country.toLowerCase()))
    if (match) { return match }
  }
  return undefined
}

export function getPinsByProject (projectId: string): PlanningPin[] {
  return PLANNING_PINS
    .filter(pin => pin.projectId === projectId)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
}

export function createPlanningPin (input: Omit<PlanningPin, 'id'>): PlanningPin {
  const pin: PlanningPin = { ...input, id: `PIN-${String(PLANNING_PINS.length + 1).padStart(3, '0')}` }
  PLANNING_PINS.push(pin)
  return pin
}

export function removePlanningPin (pinId: string): boolean {
  const index = PLANNING_PINS.findIndex(pin => pin.id === pinId)
  if (index === -1) { return false }
  PLANNING_PINS.splice(index, 1)
  return true
}

/** Jarak great-circle (km) — dipakai untuk menaksir panjang rute antar pin. */
export function haversineKm (a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (value: number) => (value * Math.PI) / 180
  const earthRadiusKm = 6371
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)

  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2)
  return Math.round(2 * earthRadiusKm * Math.asin(Math.sqrt(h)))
}
