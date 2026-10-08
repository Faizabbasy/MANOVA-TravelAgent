# Backend itinerary harian (S7b) — desain

Tanggal: 8 Oktober 2026 · Branch: `production` · Status: diimplementasikan (plan 2026-10-08-itinerary-items-backend)

S7b memindahkan **item itinerary harian** project ke server. Versi itinerary, komentar, dan approve/minta revisi
tetap lokal karena hanya dipakai portal client yang disembunyikan (ADR-006). Pelacakan operasional (milestone,
catatan, task, risiko, log) menyusul di S7c.

## Keputusan

| Topik | Keputusan |
|---|---|
| Lingkup | Item harian saja (`ITINERARY_ITEMS`); versi & komentar tetap lokal |
| Hak tulis | `project-order.manage-operations` (admin; super-admin lolos) |
| Hak baca | Seluruh peran internal, termasuk nominal vendor; portal 403 |
| Tanggal vs periode project | Tidak dipaksa berada dalam periode project (layar sekarang juga tidak memaksa) |
| Toggle internal/client | Lewat `PATCH { visibleToClient }`, tanpa endpoint khusus |
| Tetap lokal | Versi itinerary (`ITVER-`), komentar, approve/minta revisi, seluruh halaman portal client |

## Backend

### Migrasi `0028_itinerary_items`

- `itinerary_items`: `id` (`ITIN-`), `project_id` FK projects not null, `date date not null`,
  `time text` check `~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'`, `title text not null check (title <> '')`, `description`,
  `service_type` check ∈ `flight, hotel, transportation, mice, additional`, `group_id` FK traveler_groups,
  `timezone`, `location`, `visible_to_client boolean not null default true`, `vendor_id` FK vendors,
  `vendor_amount_minor bigint` check `≥ 0`, check `vendor_amount_minor is null or vendor_id is not null`,
  `changed_by_api_at timestamptz`, `provenance`, `created_at`, `updated_at`; index `(project_id, date)`.
- `id_sequences`: `ITIN-`; `syncIdSequences` mengenal tabel ini. Down membalik.

### Endpoint

| Endpoint | Aturan |
|---|---|
| `GET /itinerary-items?projectId=` | peran internal; portal 403; urut `date, time nulls first, id` |
| `POST /projects/:id/itinerary-items` | Idempotency-Key; project harus ada (404); `date` `YYYY-MM-DD` dan `title` wajib; `time` `HH:MM`; `serviceType` valid; `groupId` grup project yang sama; `vendorId` vendor yang ada; `vendorAmountMinor` string desimal ≥ 0 dan hanya bila `vendorId` diisi |
| `PATCH /itinerary-items/:id` | field yang sama (parsial); `null` mengosongkan field opsional; `projectId` tidak bisa diubah; aturan vendor/nominal dicek pada hasil gabungan (mengosongkan vendor ikut mengosongkan nominal) |
| `DELETE /itinerary-items/:id` | hapus permanen; 404 bila tidak ada |

Semua tulis: `requireCapability('project-order.manage-operations')`, perubahan + `recordAudit` dalam satu transaksi,
set `changed_by_api_at = now()`. Respons tulis = bentuk yang sama dengan GET:

```ts
ItineraryItemDto { id, projectId, date, time: string|null, title, description: string|null,
  serviceType: ServiceTypeKey|null, groupId: string|null, timezone: string|null, location: string|null,
  visibleToClient: boolean, vendorId: string|null, vendorAmountMinor: string|null }
```

### Seed

42 item fixture `ITIN-` dari `data/projects.ts` lewat `extract-demo-core.ts`. Seed ulang memperbarui baris fixture
yang `changed_by_api_at` kosong, tidak menyentuh item yang sudah diubah API dan tidak menghapus item buatan pengguna.

## Frontend

- Tipe `ItineraryItemDto`, `ItineraryItemInput` di `types/api.ts`; endpoint `listItineraryItems`,
  `createItineraryItem`, `updateItineraryItem`, `deleteItineraryItem` di namespace `core`.
- `data/itinerary-sync.ts`: muat `ITINERARY_ITEMS` (merge di tempat, `vendorAmountMinor` → `vendorAmountIdr`),
  `useItinerarySync()` dipanggil di `layouts/dashboard.vue` (peran internal) dan reset `settings.vue`; fungsi tulis
  server-first `createItineraryItemOnServer`, `updateItineraryItemOnServer`, `deleteItineraryItemOnServer`.
- Dialihkan ke server: tab itinerary `pages/project-orders/[id]/index.vue` (tambah, ubah, hapus, toggle
  internal/client) dan "Tambah Acara" di `components/operations/BookingCalendarPanel.vue`. Tombol nonaktif selama
  menyimpan; error API tampil sebagai toast.
- Guard `no-local-sales` melarang `createItineraryItem(`, `updateItineraryItem(`, `removeItineraryItem(` di
  pages/components (portal client dikecualikan seperti biasa).

## Testing

- Backend (`test/itinerary.test.ts`): CRUD + validasi (tanggal/judul wajib, format jam, jenis layanan, grup project
  lain, vendor tidak ada, nominal tanpa vendor, nominal negatif) + 401/403 (finance tulis, portal baca) + 404;
  idempotensi create; PATCH mengosongkan vendor ikut mengosongkan nominal; seed ulang tidak menimpa perubahan API;
  migrasi 0028 naik/turun di `db.test.ts`.
- Frontend: tes `itinerary-sync`, guard, `pnpm test`, tsc/eslint vs HEAD, `pnpm build`.

## Deploy

Migrasi `0028` otomatis. Setelah push: `bun run db:seed:demo` sekali (42 item itinerary demo).
