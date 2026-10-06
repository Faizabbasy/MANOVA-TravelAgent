# ADR-004 — Core reference bridge, typed booking reference, dan cutover demo vs produksi

- **Status:** Accepted (Phase 1, 29 Sep 2026)
- **Konteks:** Finance butuh FK valid ke Party/Project/Vendor/Booking, tetapi seluruh domain operasional masih array `reactive()` di `frontend/app/data/*` dan paket melarang rewrite massal `app/data/index.ts` maupun membuat booking tandingan. Temuan audit yang membentuk desain:
  - Tidak ada entitas Booking universal: `FlightBooking`, `HotelBooking`, `TransportBooking`, `MiceEvent` di empat file tipe; agregasi `booking-orchestration.ts` memakai literal `'flight' | 'hotel' | 'transport' | 'mice'` (bukan `'transportation'` seperti `ServiceTypeKey`).
  - Booking **tidak punya `vendorId`**. Vendor terhubung lewat `ProjectService.vendorId` (via `booking.serviceId`) atau `ServiceOrder.vendorId` (procurement). Vendor demo `VND-006` hanya terhubung lewat `SO-002` → PRJ-102.
  - ID fixture stabil dan statis (`PTY-001`, `VND-006`, `PRJ-101`, `SVC-1011`, `FLT-1011`, `SO-002`), tanggal fixture statis.

## Keputusan

1. **Bridge referensi, bukan domain kedua** (migrasi `0002_core_references`): `parties`, `vendors`, `projects` (+ `project_members` di `0003`), `project_services`, `service_orders`, `booking_refs(booking_type, booking_id, project_id, service_id?)`. Hanya kolom identitas/relasi/tampilan dasar; **tanpa harga, biaya, status booking, atau lifecycle procurement.**
2. **Typed booking reference** `(booking_type, booking_id)` dengan literal orkestrasi (`transport`). FK komposit memaksa service sebuah booking/service order berada di project yang sama. Tidak ada tabel booking universal.
3. **ID legacy dipakai apa adanya** sebagai primary key teks, sehingga deep link lama dan referensi finance tetap cocok. Kolom `provenance ∈ {manual, demo-fixture, migration}` membedakan asal data.
4. **Seed demo diekstrak deterministik** dari fixture frontend oleh `bun run seed:extract` → `backend/src/db/seeds/demo-core.json` (terurut, tanpa timestamp; ekstraktor dev-only, server tidak pernah membaca source frontend). Seed memuat referensi dan 7 akun demo saja — **tidak ada invoice/payment/saldo**; test memastikan tidak ada field uang.
5. **API Phase 1 read-only** untuk referensi ini (`/projects`, `/parties`, `/vendors`, `/service-orders/:id`, `/bookings/:type/:id`) dengan scope server. Mutasi referensi tetap di modul operasional sampai domain tersebut dimigrasi.

## Cutover demo vs produksi

| Lingkungan | Sumber referensi | Uang |
|---|---|---|
| Dev/demo | `db:seed:demo` (provenance `demo-fixture`) | Belum ada di Phase 1. Phase 2+ memakai fixture test-only eksplisit (paket `10`), bukan riwayat mock. |
| Produksi | Import terkontrol ber-provenance `migration` atau entri `manual`; seed demo ditolak | Saldo pembuka diverifikasi (maker finance, checker management) pada tanggal cutover; transaksi sebelum cutover hanya historical import. |

Selama domain operasional masih mock, **status/tanggal project di bridge adalah snapshot** saat seed. Aturan pakainya: finance boleh memakai bridge untuk identitas, scope, dan label; keputusan yang bergantung pada status/tanggal booking live (mis. H-x cancellation di Phase 5) harus menunggu domain booking punya sumber server atau mengambil data dari layanan booking resmi. Ini dicatat sebagai blocker Phase 5.

## Alternatif yang ditolak

- **Menyalin seluruh `app/data/index.ts` ke backend** — dilarang paket; menciptakan dua sumber tulis.
- **Tabel `bookings` universal** — bersaing dengan empat domain booking.
- **String ID bebas tanpa FK** — tidak menjamin validitas referensi finance.

## Cara menjalankan

```bash
cd backend
bun run seed:extract    # regenerasi demo-core.json setelah fixture frontend berubah (review diff-nya)
bun run db:seed:demo    # upsert idempotent
```

## Update 2026-10-06 — Project header write API (S3a)

Header project kini ditulis lewat API (`POST /api/v1/projects`, `PATCH /api/v1/projects/:id`, dan
`PUT /api/v1/projects/:id/contract-value` khusus Finance/Super Admin). ID baru dibuat server (`id_sequences`,
format sama: `PRJ-503` dst.) dan baris ber-provenance `manual`. Frontend mengisi array `PROJECTS` dari server
setelah sesi siap (`app/data/projects-sync.ts`). Status/alur Project Order, tim, layanan, milestone, traveler,
dan itinerary **masih** modul frontend sampai tahapnya pindah. Spec:
`docs/superpowers/specs/2026-10-06-project-core-backend-design.md`.
