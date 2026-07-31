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

/**
 * `structuredClone()` tidak dapat mengkloning array Vue `reactive()` (Proxy) secara langsung — Proxy
 * bukan exotic Array asli, sehingga browser melempar `DataCloneError: [object Array] could not be
 * cloned`. Seluruh fixture di sini adalah data JSON-safe murni (string/number/boolean/array/object
 * bersarang, tanpa Date/Map/Set/function), jadi round-trip `JSON.stringify`/`JSON.parse` cukup — proses
 * ini juga otomatis "melepas" Proxy karena hasil akhirnya dibangun ulang sebagai object polos.
 */
function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

/** Dipanggil sekali di client plugin — idempotent (panggilan kedua diabaikan agar snapshot tidak tertimpa oleh state yang sudah bermutasi). */
export function captureMockSnapshot(arrays: ResettableArrays) {
  if (snapshot) return
  registry = arrays
  snapshot = {}
  for (const key in arrays) {
    snapshot[key] = deepClone(arrays[key])
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
    target.splice(0, target.length, ...deepClone(seed))
  }
  return true
}
