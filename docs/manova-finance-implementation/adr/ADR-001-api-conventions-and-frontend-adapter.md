# ADR-001 — API conventions dan adapter frontend

- **Status:** Accepted (Phase 1, 29 Sep 2026)
- **Konteks:** `backend/` (Bun + Elysia) sebelumnya hanya `GET /` → `Hello Elysia`. Frontend (Nuxt 4) tidak punya satu pun pemanggilan HTTP (`$fetch`/`useFetch`/`runtimeConfig` nihil) dan belum punya `frontend/server/`. Finance baru wajib membaca API nyata (paket `04`, `05`, `12`).

## Keputusan

**Kontrak HTTP** (mengikuti `05-API-CONTRACTS.md`):

| Hal | Aturan |
|---|---|
| Prefix | `/api/v1`. Liveness `GET /health` di luar prefix untuk orkestrator container. |
| Sukses | `{ data, meta: { requestId } }`; list menambah `meta.pagination: { limit, nextCursor }` |
| Error | `{ error: { code, message, fieldErrors?, details? }, meta: { requestId } }`. `message` sudah bahasa Indonesia awam. |
| Status | 400 `VALIDATION_FAILED`/`INVALID_JSON`/`BAD_REQUEST`, 401 `UNAUTHENTICATED`/`INVALID_CREDENTIALS`, 403 `FORBIDDEN`/`CSRF_ORIGIN_REJECTED`, 404 `NOT_FOUND` (termasuk data di luar scope) / `ROUTE_NOT_FOUND`, 409 `CONFLICT`, 422 `RULE_VIOLATION`, 429 `TOO_MANY_ATTEMPTS`, 500 `INTERNAL` (detail hanya di log server) |
| Request ID | Header `X-Request-Id` di setiap respons; ID masuk yang well-formed (`[A-Za-z0-9._:-]{8,128}`) diteruskan, selain itu dibuat `req_<uuid>`. |
| Pagination | Cursor opaque (base64url dari id terakhir), urutan stabil by id, `limit` 1–100 (default 25). |
| Uang | `amountMinor` string integer minor unit (`"30000000"`), tak pernah number/float. Persen = basis point. Pembulatan half-up eksplisit (`backend/src/shared/money.ts`). |
| Waktu | Tanggal bisnis `YYYY-MM-DD` zona `Asia/Jakarta`; instant ISO UTC (`backend/src/shared/dates.ts`). |
| Mutasi finansial (Phase 2+) | Header `Idempotency-Key` dan `If-Match`; sudah diizinkan CORS dan dikirim oleh client frontend. |

**Adapter frontend** — satu pola: `frontend/app/lib/api/` (bukan composable ganda atau `services/` kedua).

- `app/types/api.ts` — tipe wire, cermin DTO backend. Perubahan shape API wajib mengubah file ini di commit yang sama (aturan root `CLAUDE.md`).
- `app/lib/api/client.ts` — client framework-free dengan `Transport` yang dapat diganti (fetch untuk browser/test). Mengirim `credentials: 'include'`, header idempotency/version, mengubah semua kegagalan menjadi satu `ApiError`.
- `app/lib/api/errors.ts` — `ApiError { status, code, message, requestId, fieldErrors }` + helper `isConflict`, `isRetryable`, `fieldError()`.
- `app/lib/api/endpoints.ts` — satu fungsi bertipe per endpoint; UI tidak menulis path mentah.
- `app/lib/money.ts` — format tampilan `MoneyMinor` via BigInt (tanpa float). Tidak ada kalkulasi saldo/outstanding di Vue.
- `app/composables/useApi.ts` — wiring Nuxt. Browser memanggil `/api/v1/**` di origin Nuxt; route Nitro `frontend/server/routes/api/v1/[...path].ts` mem-proxy ke backend sehingga cookie sesi HttpOnly tetap first-party. Proxy **menimpa** `X-Forwarded-For` dengan alamat socket yang dilihatnya (tidak meneruskan nilai dari klien); backend dengan `TRUST_PROXY=true` membaca hop paling kanan. SSR memanggil backend langsung dengan cookie request diteruskan.

**Konfigurasi:** `NUXT_API_PROXY_TARGET` (default `http://localhost:3000`, dibaca saat runtime), `NUXT_PUBLIC_API_BASE` (default `/api/v1`). Lihat `frontend/.env.example`.

## Alternatif yang ditolak

- **CORS langsung browser → :3000 dengan cookie cross-site** — butuh `SameSite=None` dan memperbesar permukaan CSRF. CORS allowlist tetap diimplementasikan untuk kasus API di origin terpisah.
- **`useFetch` di tiap halaman** — mengikat logika error/idempotency ke komponen dan sulit dites; client di `lib/` diuji tanpa Nuxt.
- **Klien OpenAPI tergenerasi** — belum ada spesifikasi OpenAPI; dipertimbangkan ulang saat endpoint finance bertambah (Elysia dapat menghasilkan skema).

## Konsekuensi

- `routeRules.proxy` statis sengaja tidak dipakai: ia meneruskan `X-Forwarded-For` milik klien apa adanya (temuan review keamanan Phase 1). Backend hanya boleh dapat dijangkau lewat proxy ini bila `TRUST_PROXY=true`.
- Phase 1 **tidak** mengganti UI apa pun: belum ada layar yang memanggil `useApi()`.

## Cara menjalankan / verifikasi

```bash
npm run dev                                   # frontend :8080 + backend :3000
curl http://localhost:8080/api/v1/health      # lewat proxy Nuxt
pnpm --dir frontend exec vitest run app/lib   # test client + money
```
