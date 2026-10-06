# Backend Project inti + fondasi tulis (S0 + S3a) — desain

Tanggal: 6 Oktober 2026 · Branch: `production` · Status: disetujui (brainstorming), menunggu review spec

## Konteks

Server saat ini hanya memiliki uang (Finance). Project, customer, vendor, dan booking di server adalah salinan
read-only dari fixture frontend (ADR-004); semua halaman non-finance membaca/menulis array `reactive()` di
`frontend/app/data`. Project yang dibuat di UI tidak ada di server, jadi Finance menampilkan "belum tersedia"/404
untuk project itu, dan nilai kontrak bisa berbeda antara UI dan server.

Program besar "backend untuk halaman lain" dipecah menjadi sub-project (S0 fondasi, S1 Customer, S2 Vendor,
S3 Project, S4 Booking, S5 Procurement, S6 Sales, S7 Detail operasional, S8 Perubahan/insiden/pembatalan,
S9–S12 lainnya), dikerjakan satu per satu, standar siap produksi. **Dokumen ini hanya S0 + data utama project
(S3a).** Status/alur Project Order, tim, layanan + vendor (S3b) dan sisanya menyusul dengan spec sendiri.

## Keputusan

| Topik | Keputusan |
|---|---|
| Target | Siap produksi bertahap: hak akses di server, audit, test, sama seperti Finance |
| Tahap ini | S0 (fondasi tulis) + data utama project |
| Integrasi frontend | Pendekatan A: array `PROJECTS` diisi dari server setelah sesi siap; halaman tetap |
| Nilai kontrak | Diisi saat project dibuat; setelah itu hanya Finance & Super Admin yang mengubah, dengan alasan dan audit |
| Nilai kontrak < yang sudah ditagih | Ditolak |
| Customer | Project hanya bisa dibuat untuk party yang sudah ada di server (sampai S1 selesai) |

## S0 — fondasi tulis (dipakai ulang semua tahap)

- **ID dari server.** Tabel `id_sequences (prefix text primary key, last_value integer not null)`. Fungsi
  `nextId(q, prefix, width = 3)` mengunci baris prefix (`select … for update`), menaikkan, dan mengembalikan
  `PRJ-341` dst. Migrasi mengisi nilai awal dari angka terbesar yang sudah ada per prefix (PRJ; prefix lain
  ditambahkan oleh tahapnya masing-masing). Seed demo (`seed-demo.ts`) memperbarui `id_sequences` setelah upsert
  supaya ID baru tidak bentrok dengan fixture.
- **Pola endpoint tulis** (didokumentasikan di `backend/CLAUDE.md`):
  - `auth.requireCapability(...)`; capability baru ditambahkan di `backend/src/auth/rbac.ts` **dan**
    `frontend/app/data/rbac.ts` dalam perubahan yang sama.
  - Validasi → `errors.validation({ field: ['pesan Bahasa Indonesia'] })`.
  - Perubahan + `recordAudit` (before/after) dalam satu transaksi.
  - Create memakai `withIdempotency` (header `Idempotency-Key` wajib untuk POST create).
  - Baris yang dibuat lewat API ber-provenance `manual` (default kolom yang sudah ada).
  - Response memakai view yang sama dengan GET (scope + aturan nominal ADR-007).

## Data utama project (S3a)

### Migrasi `0017_project_core_writes`

Kolom baru di `projects` (semua nullable/default agar baris lama tetap valid):

| Kolom | Tipe | Catatan |
|---|---|---|
| `characteristic` | text not null default `'normal'` | check: normal / high-change / complex |
| `service_scope` | text[] not null default `'{}'` | elemen: flight / hotel / transportation / mice / additional |
| `traveler_count` | integer not null default 0 | check ≥ 0 |
| `is_group_trip` | boolean not null default false | |
| `lead_id`, `source_quotation_id` | text | referensi saja, belum ada FK (Lead/Quotation masih mock) |
| `tour_leader_name`, `tour_leader_phone`, `emergency_contact_name`, `emergency_contact_phone`, `meeting_point` | text | kontak lapangan |

Ditambah tabel `id_sequences` (S0, prefix `PRJ-` dan `PTY-`). `down.sql` menghapus kolom dan tabel.

**Party placeholder Group Trip:** dicari berdasarkan nama `MANOVA Group Trip (Internal)` (di data demo: `PTY-009`,
sama dengan frontend `getOrCreateGroupTripPlaceholderParty`). Bila belum ada (mis. database produksi kosong),
server membuatnya di transaksi yang sama (`party_type = individual`, ID dari `id_sequences`).

### Endpoint

| Endpoint | Siapa | Isi |
|---|---|---|
| `POST /api/v1/projects` | capability `project-order.manage-operations` (Admin, Super Admin) | name, partyId (atau `isGroupTrip: true` → party placeholder Group Trip), destination, travelStartDate, travelEndDate, characteristic, serviceScope, travelerCount, contractValueMinor, leadId?, sourceQuotationId?. Server mengisi: id, status `draft`, owner = aktor (bila user internal) dan anggota tim = owner |
| `PATCH /api/v1/projects/:id` | `project-order.manage-operations` | name, destination, tanggal, travelerCount, characteristic, serviceScope, 5 kontak lapangan. **Tidak** menerima status, party, atau nilai kontrak (400 bila dikirim) |
| `PUT /api/v1/projects/:id/contract-value` | capability baru `finance.edit-contract-value` (Finance, Super Admin) | `contractValueMinor`, `reason` (wajib). Ditolak 422 bila < total yang sudah ditagih (invoice terbit − credit note), sama dengan "Ditagih" di finance-summary |
| `GET /api/v1/projects`, `/projects/:id` | seperti sekarang | ditambah field baru; `contractValueMinor` tetap null untuk peran tanpa `canViewFullFinancials` (portal client/vendor). Admin, Finance, Super Admin melihatnya — aturan "tanpa nominal" ADR-007 #3 hanya untuk ringkasan Finance |

Validasi: nama & tujuan wajib, tanggal valid dan mulai ≤ selesai, travelerCount ≥ 1, serviceScope tidak kosong
dan nilainya dikenal, contractValueMinor string angka ≥ 0, party harus ada di server (status `client` maupun
`prospect` diterima, sama dengan UI sekarang); bila partyId tidak ditemukan → 422 "Customer belum tersimpan di
server". Project di luar scope → 404.

Audit: `project.created`, `project.updated` (field yang berubah, before/after), `project.contract_value_changed`
(before, after, reason).

## Frontend

### `app/data/projects-sync.ts` (baru)

- `mergeServerProjects(serverList)`: untuk tiap project server, `Object.assign` field server ke objek lokal
  dengan ID sama (objek tetap sama → reaktivitas dan referensi halaman aman), atau push objek baru dengan nilai
  default untuk field lokal (`budgetIdr` = 0, `actualCostIdr` = 0, `destinationGeo` di-resolve). Project lokal
  yang tidak ada di server dihapus dari array. `quotationAmountIdr` = `Number(contractValueMinor)` bila tidak
  null; bila null (peran tanpa `canViewFullFinancials`) nilai lokal dipertahankan, 0 untuk project baru.
- `useProjectsSync()`: status `idle | loading | ready | offline | error`; `load()` mengambil semua halaman
  `GET /projects?limit=100` (cursor). Dipanggil setelah `useServerSession` berstatus `ready` (satu kali per
  sesi, ulang setelah "Reset Demo Data"). Offline → data lokal tetap tampil + banner yang sudah ada.

### Mutator

- `createProject(input)` menjadi **async**: `api.core.createProject` (idempotency key per submit) → merge hasil
  → `seedDefaultProjectMilestones` (milestone masih lokal) → kembalikan project. `nextSequentialId('PRJ-')`
  tidak dipakai lagi. Pemanggil diubah ke `await` dengan loading & pesan error: `pages/project-orders/index.vue`,
  `pages/customer-journey/customers/[id]/index.vue`, `pages/crm/parties/[id]/index.vue`, dan `markLeadWon`
  (jadi async; pemanggilnya ikut diubah).
- `updateProjectSchedule` dan `updateProjectFieldContacts` → `PATCH`, lalu merge hasil.
- `app/lib/api/endpoints.ts` + `app/types/api.ts`: `createProject`, `updateProject`, `setContractValue`, dan
  field baru di DTO project.
- Panel Finance project: tombol **"Ubah nilai kontrak"** (dialog nominal + alasan) untuk
  `finance.edit-contract-value`; setelah sukses, summary dan hero dimuat ulang.
- "Reset Demo Data" (`utils/mock-reset.ts`) tidak menyentuh server; setelah reset, `useProjectsSync().load()`.

## Finance

- Project baru dari API langsung punya `contract_value_minor`, jadi finance-summary, hero, dan gate DP bekerja.
- Test integrasi: buat project via API → buat & terbitkan invoice DP → finance-summary menunjukkan kontrak,
  "Ditagih", dan status yang benar → turunkan nilai kontrak di bawah "Ditagih" → 422.

## Seed

- `extract-demo-core.ts` ikut mengekstrak characteristic, serviceScope, travelerCount, isGroupTrip, leadId,
  sourceQuotationId, dan kontak lapangan; `seed-demo.ts` meng-upsert kolom baru dan memperbarui `id_sequences`.
- Party placeholder Group Trip sudah ada di fixture (`PTY-009`); tidak ada perubahan fixture party.
- `db.test.ts` (kunci field uang di seed) tidak berubah: tidak ada kolom uang baru.

## Test

- **Backend** (`test/project-writes.test.ts`): sukses create/patch/contract-value; validasi tiap field; 401;
  403 (Finance create/patch, Admin contract-value); 404 di luar scope (client/vendor); idempotency (dua POST
  kunci sama = satu project); ID berurutan setelah seed (PRJ-341); audit tercatat; PATCH menolak status/nilai
  kontrak; group trip → party placeholder (dibuat bila belum ada); party tak dikenal → 422; integrasi
  Finance di atas. Juga dijalankan di PostgreSQL (`TEST_DATABASE_URL`) karena ada SQL baru.
- **Frontend**: `projects-sync.test.ts` (merge: update in-place, project baru, hapus yang tak ada di server,
  aturan `quotationAmountIdr`), `createProject` async dengan API tiruan (sukses, error validasi, server mati).
- Test lama tetap lulus; `no-mock-finance.test.ts` tidak bertambah allow-list.

## Masih mock setelah tahap ini

Status & alur Project Order (handover, ready, advance, close), tim, layanan + vendor, milestone, tugas,
traveler, itinerary, foto. Perubahannya tetap hilang saat refresh (seperti sekarang) sampai tahapnya selesai.
Customer yang dibuat di UI belum ada di server (S1).

## Di luar lingkup

S1–S12, manajemen user nyata (ADR-003), unggah file (ADR-005), impor data produksi (`provenance = migration`).
