/**
 * State reset / seed scenario (Section 01 — Frontend Foundation dan State Governance). Mock-only:
 * menyimpan snapshot nilai awal seluruh `reactive()` array terpusat (`app/data/*.ts`) begitu aplikasi
 * pertama kali dimuat di browser (dipanggil dari `app/plugins/mock-reset.client.ts`), lalu menyediakan
 * `resetMockState()` untuk mengembalikan seluruh state ke kondisi seed tsb — dipakai tombol "Reset Demo
 * Data" (`app/pages/settings.vue`). TIDAK menyentuh `USERS` (bukan `reactive()`, tidak pernah dimutasi —
 * tidak ada `createUser`) maupun `SYSTEM_EVENTS` (didokumentasikan sebagai log statis, `app/data/activity.ts`).
 */

type ResettableArrays = Record<string, unknown[]>

let registry: ResettableArrays | null = null
let snapshot: Record<string, unknown[]> | null = null

/** Dipanggil sekali di client plugin — idempotent (panggilan kedua diabaikan agar snapshot tidak tertimpa oleh state yang sudah bermutasi). */
export function captureMockSnapshot(arrays: ResettableArrays) {
  if (snapshot) return
  registry = arrays
  snapshot = {}
  for (const key in arrays) {
    snapshot[key] = structuredClone(arrays[key])
  }
}

export function hasMockSnapshot(): boolean {
  return snapshot !== null
}

/** Mengembalikan seluruh reactive array terpusat ke kondisi seed awal (in-place, mempertahankan reference Proxy `reactive()` yang sama). */
export function resetMockState(): boolean {
  if (!registry || !snapshot) return false
  for (const key in registry) {
    const target = registry[key]
    const seed = snapshot[key]
    target.splice(0, target.length, ...structuredClone(seed))
  }
  return true
}
