# Portal client — baca data server (S12a) — desain

Tanggal: 14 Oktober 2026 · Branch: `production` · Status: disetujui (portal aktif di dev/staging; mulai S12a; eksekusi native)

S12 (portal) dipecah: **S12a** portal client membaca data server yang sudah ada (dokumen ini), **S12a-2** bacaan
komersial client (quotation, reservasi/booking, invoice), **S12b** tulisan client ke tabel yang ada, **S12c** fitur
khusus portal client (tabel baru), **S12d** portal vendor, **S12e** RFQ, **S12f** katalog komoditas.

## Keputusan pengguna

1. Portal client & vendor **aktif di development/staging saja**; production tetap tertutup sampai S12 selesai.
2. Mulai dari portal client **baca-saja**.

## Masalah yang ditutup

1. Portal tidak bisa dicoba: login client/vendor ditolak (`ROLE_DISABLED`) di semua lingkungan.
2. Hampir semua layar portal client menampilkan data lokal; route server untuk peserta, itinerary, change request,
   insiden, dokumen dan pesan menolak user portal.

## Keputusan desain

| Topik | Keputusan |
|---|---|
| Aktivasi | `PORTAL_LOGIN` default **aktif di non-production**, **ditolak di production** (config error), mirip `DEMO_LOGIN` |
| Info ke frontend | `GET /auth/options` (publik): `{ demoLogin, portalLogin }`. Frontend menampilkan role portal di login satu-klik & role switcher hanya bila `portalLogin` |
| Akun demo | Dimas Pratama (client, PTY-005) dan Hasan Alfarizi (vendor, VND-006) ditambahkan ke kartu login satu-klik |
| Scope client | Semua bacaan dibatasi ke project milik party client (`projects.party_id = users.party_id`); data project lain tidak pernah dikirim; detail milik party lain → 404 |
| Vendor | Tetap 403 di route-route ini (S12d) |
| Peserta | `GET /travelers`, `/traveler-groups`, `/room-assignments` (+ detail) — seluruh field (data peserta milik client sendiri) |
| Itinerary | Hanya item `visibleToClient`; `vendorId` dan `vendorAmountMinor` dikirim `null` |
| Change request | `GET /change-requests` — seluruh field (dampak komersial memang ditagihkan ke client) |
| Insiden | `GET /incidents` — tanpa log komunikasi internal (`communicationLog: []`), `ownerId`/`escalatedTo` disembunyikan |
| Pembatalan | `GET /booking-cancellations` — milik project client |
| Dokumen | Hanya `accessLevel = 'client'`, milik project client atau entitas party client |
| Pesan | Hanya kanal `client-message` milik project client |
| Notifikasi | Sudah per-user; kini dimuat juga untuk client |
| Frontend | Layout memuat sync peserta, itinerary, changes, dokumen, notifikasi untuk role client; tulisan portal tetap lokal (S12b) |

## Backend

- `config/env.ts`: default & larangan production untuk `PORTAL_LOGIN`.
- `auth/routes.ts`: `GET /auth/options`.
- `core/client-scope.ts`: `readerScope(actor)` → `{}` (internal) | `{ partyId }` (client) | 403 (vendor/lainnya) dan
  penyaring tampilan client (itinerary, insiden).
- Filter `partyId` (+ `clientVisibleOnly`) di `listTravelers`, `listTravelerGroups`, `listRoomAssignments`,
  `listItineraryItems`, `listChangeRequests`, `listIncidents`, `listBookingCancellations`, `listDocuments`,
  `listMessages`; route terkait memakai `readerScope`.

## Frontend

- `GET /auth/options` dimuat di login & layout; `isRoleSelectable` menghormati status portal.
- `DEMO_LOGIN_ACCOUNTS` + client & vendor; layout memuat sync terkait untuk client.

## Testing

- Backend `test/client-portal.test.ts`: login client aktif di test/dev, config menolak di production; tiap route
  hanya mengembalikan data party client (project lain tak muncul, detail lain 404), penyaringan itinerary/insiden/
  dokumen/pesan, vendor 403, internal tetap melihat semua.
- Frontend: tes opsi portal & role selectable, `pnpm test`, vue-tsc ≤ 1983, eslint vs HEAD, `pnpm build`.

## Deploy

Tanpa migrasi. Staging (APP_ENV=development) otomatis mengizinkan portal; production menolak `PORTAL_LOGIN=true`.
