# Backend peserta: traveler, grup & rooming (S7a) — desain

Tanggal: 7 Oktober 2026 · Branch: `production` · Status: disetujui di chat, menunggu review spec

S7 (detail operasional) dipecah: **S7a peserta** (dokumen ini), lalu itinerary dan pelacakan operasional (milestone,
catatan, task, risiko, log) di tahap berikutnya. S7a memindahkan traveler, grup traveler, dan rooming list ke server,
dan membuat traveler peserta Group Trip otomatis saat Finance mengonfirmasi DP.

## Keputusan

| Topik | Keputusan |
|---|---|
| Akses data identitas | **Admin & Finance penuh**: seluruh peran internal membaca data lengkap (paspor, KTP, visa, kontak darurat); portal 403 |
| Hak tulis | `project-order.manage-travelers` (admin; super-admin lolos) |
| Traveler Group Trip | **Otomatis oleh server saat DP**: `confirm-dp` membuat N traveler (N = pax order) dalam transaksi yang sama |
| Batal order Group Trip | Traveler order itu ikut dibatalkan (alasan "Order dibatalkan") dan dikeluarkan dari kamar |
| Hapus vs batal | Hapus = koreksi salah input, ditolak untuk traveler hasil order; batal = keputusan bisnis (soft, alasan wajib) |
| Tetap lokal | Portal client (ADR-006); preview impor (simulasi parsing); readiness peserta (dihitung dari data tersinkron) |

## Backend

### Migrasi `0027_travelers`

- `traveler_groups`: `id` (`TG-`), `project_id` FK projects, `name` not null, `pax_count int ≥ 0 default 0`,
  `rooming_note`, `provenance`, `created_at`, `updated_at`; index `(project_id)`.
- `travelers`: `id` (`TRV-`), `project_id` FK, `group_id` FK traveler_groups, `party_id` FK parties, `lead_id` FK
  leads, `sales_order_id` FK sales_order_refs, `name` not null, `passport_number`, `passport_expiry_date date`,
  `id_number`, `visa_number`, `visa_expiry_date date`, `emergency_contact_name`, `emergency_contact_phone`,
  `special_request`, `dietary_restrictions`, `accessibility_needs`, `companion_of` FK travelers,
  `documents_verified_on date`, `documents_verified_by` FK users, `is_vip boolean default false`,
  `cancelled boolean default false`, `cancel_reason`, `replaced_by` FK travelers, `replaces` FK travelers,
  `provenance`, `created_at`, `updated_at`, `changed_by_api_at timestamptz`; check `cancelled = (cancel_reason is not null)`;
  index `(project_id)`, `(sales_order_id)`.
- `room_assignments`: `id` (`ROOM-`), `project_id` FK, `group_id` FK traveler_groups, `room_label` not null,
  `room_type` check ∈ `single, twin, suite`, `traveler_ids jsonb not null default '[]'` (array), `provenance`,
  `created_at`, `updated_at`; index `(project_id)`.
- `id_sequences`: `TG-`, `TRV-`, `ROOM-`; `syncIdSequences` mengenalnya. Down membalik.

### Traveler

| Endpoint | Aturan |
|---|---|
| `GET /travelers?projectId=`, `GET /travelers/:id` | peran internal; portal 403; scope project seperti `GET /projects/:id` (di luar scope → 404) |
| `POST /projects/:id/travelers` | Idempotency-Key; nama wajib; `groupId` harus grup project yang sama; `companionOfTravelerId` traveler project yang sama; tanggal `YYYY-MM-DD` |
| `PATCH /travelers/:id` | field identitas/kebutuhan/grup/pendamping; `projectId`, `salesOrderId`, `partyId`, `leadId`, status batal/ganti/verifikasi tidak lewat PATCH; traveler batal → 422 |
| `DELETE /travelers/:id` | hanya koreksi: traveler ber-`sales_order_id` atau yang sudah menggantikan/digantikan → 422 "Batalkan, jangan hapus"; dikeluarkan dari kamar |
| `POST /travelers/:id/verify` `{ verified: boolean }` | isi/kosongkan `documents_verified_on/by` |
| `POST /travelers/:id/vip` `{ isVip }` | toggle |
| `POST /travelers/:id/cancel` `{ reason }` | alasan wajib; sudah batal → 422; dikeluarkan dari kamar |
| `POST /travelers/:id/replace` `{ …data traveler baru }` | satu transaksi: baru dibuat di project/grup yang sama (`replaces`), lama dibatalkan (`replaced_by`, alasan "Digantikan oleh …"); kamar lama digantikan oleh yang baru |
| `POST /projects/:id/travelers/import` `{ rows: [{ name, passportNumber?, groupId? }] }` | Idempotency-Key; validasi ulang per baris (nama wajib, paspor unik dalam project & dalam batch, grup project yang sama); baris error tidak dibuat; respons `{ created: Traveler[], rejected: [{ index, errors }] }` |

### Grup & rooming

| Endpoint | Aturan |
|---|---|
| `GET /traveler-groups?projectId=`, `GET /room-assignments?projectId=` | peran internal |
| `POST /projects/:id/traveler-groups`, `PATCH /traveler-groups/:id` | nama wajib; `paxCount ≥ 0` |
| `POST /projects/:id/room-assignments` | grup project yang sama; label wajib; tipe valid; traveler awal opsional (aturan sama dengan isi kamar) |
| `PUT /room-assignments/:id/travelers` `{ travelerIds }` | traveler harus project yang sama dan tidak batal; dikeluarkan otomatis dari kamar lain di project itu; satu transaksi |
| `DELETE /room-assignments/:id` | hapus kamar |

### Otomatis dari sales order (S6b)

- `confirm-dp` (Group Trip, order yang belum punya traveler): membuat `traveler_count` traveler — `project_id` order,
  `party_id`, `lead_id`, `sales_order_id`, nama = nama lead (atau customer) dan `"(Pax n)"` bila pax > 1. Order yang
  sudah punya traveler tidak dibuat ulang (idempoten).
- Batal order Group Trip (`POST /sales-orders/:id/status { to: 'cancelled' }`): traveler order itu yang belum batal
  → batal ("Order dibatalkan") dan keluar dari kamar.

### Seed

44 traveler, 8 grup, 8 kamar fixture. Seed ulang memperbarui baris fixture yang belum pernah diubah API
(`changed_by_api_at` kosong untuk traveler; grup/kamar diperbarui hanya bila `updated_at = created_at`), tidak
menghapus baris buatan pengguna.

## Frontend

- Tipe `TravelerDto`, `TravelerGroupDto`, `RoomAssignmentDto`, `TravelerImportResultDto`; endpoint namespace `core`.
- `data/travelers-sync.ts`: muat `TRAVELERS`, `TRAVELER_GROUPS`, `ROOM_ASSIGNMENTS` (merge di tempat), dipanggil
  `loadServerData` dan reset `settings.vue`; fungsi tulis server-first untuk seluruh aksi di atas.
- Tab peserta `pages/project-orders/[id]/index.vue` dialihkan ke server (tambah/ubah/hapus/verifikasi/VIP/batal/
  ganti/grup/rooming/impor commit). Setelah DP dikonfirmasi, traveler project dimuat ulang dari server;
  `markGroupTripOrderPaid` lokal dihapus.
- Guard `no-local-sales` (atau guard baru `no-local-operations`) melarang `createTraveler(`, `updateTraveler(`,
  `removeTraveler(`, `toggleTravelerVerification(`, `setTravelerVip(`, `cancelTraveler(`, `replaceTraveler(`,
  `createTravelerGroup(`, `createRoomAssignment(`, `setRoomAssignmentTravelers(`, `removeRoomAssignment(`,
  `commitTravelerImport(`, `markGroupTripOrderPaid(` di pages/components (portal client dikecualikan).

## Testing

- Backend (`test/travelers.test.ts`): CRUD + validasi + 401/403/404; finance membaca data lengkap; hapus ditolak untuk
  traveler order; batal/ganti atomik; rooming tanpa dobel-assign dan menolak traveler batal/project lain; impor
  menolak duplikat paspor; confirm-dp membuat N traveler sekali saja; batal order membatalkan traveler-nya; seed
  ulang tidak menimpa perubahan.
- Frontend: tes `travelers-sync`, guard, `pnpm test`, tsc/eslint vs HEAD, `pnpm build`.

## Deploy

Migrasi `0027` otomatis. Setelah push: `bun run db:seed:demo` sekali (traveler, grup, kamar demo).
