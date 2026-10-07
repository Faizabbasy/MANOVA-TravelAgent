# Backend lead, quotation client & Won (S6a) — desain

Tanggal: 7 Oktober 2026 · Branch: `production` · Status: disetujui di chat, menunggu review spec

Lanjutan S5-lite. S6a memindahkan pra-penjualan B2B ke server: lead + aktivitas/follow-up, qualify (dengan customer
di server), quotation client dengan riwayat per versi + approval, dan "Mark as Won" yang membuat project dari versi
quotation yang disetujui. **S6b** (berikutnya): Sales Order B2C / Group Trip (`sales_order_refs`, kursi, DP).

## Keputusan

| Topik | Keputusan |
|---|---|
| Lingkup | **S6a = Lead + Quotation + Won.** Sales order B2C, Group Trip, cost sheet tetap lokal (S6b / nanti) |
| Versi quotation | **Riwayat per versi**: tiap versi menyimpan isi lengkapnya sendiri; versi yang sudah diajukan terkunci |
| Persetujuan sendiri | **Boleh, tapi tercatat**: pengaju boleh menyetujui versinya sendiri; server menyimpan pengaju & penyetuju, audit menandai `selfApproved` |
| Nilai kontrak | Won mengambil nilai versi yang disetujui. Revisi quotation setelah Won **tidak** mengubah project; perubahan nilai kontrak tetap lewat Finance (aturan S3a) |
| Hak akses | Tulis lead/quotation: `sales.manage-lead`; approve/reject: `sales.approve-quotation`; Won: `sales.mark-won`; aktivitas/follow-up: `crm.manage-follow-up`. Semua admin (super-admin lolos). Finance baca saja. Portal tidak menulis |
| Tetap lokal | Cost sheet & `applyCostSheetToQuotation` (field `costSheetId` disimpan sebagai teks bebas), lampiran & komentar quotation, akun login client otomatis (portal disembunyikan, ADR-006), sales order B2C & data B2C Group Trip (disimpan apa adanya, lihat bawah), laporan/SLA (membaca data yang sudah sinkron) |

## Backend

### Migrasi `0024_leads_quotations`

Tabel baru `leads`:
- `id text primary key` (`LED-`), `name text not null`, `company_name`, `title`, `source` (10 nilai `LeadSource`),
  `stage text not null default 'new'` check ∈ `new, contacted, qualified, unqualified`
- `owner_user_id` FK users not null, `handed_over_to` FK users, `phone`, `email`, `qualification_notes`,
  `expected_close_date date`, `archived boolean not null default false`, `archive_reason text`
- `party_id` FK parties, `qualified_at timestamptz`, `unqualified_reason text`
- Kebutuhan perjalanan: `service_category` check ∈ `corporate-travel, group-travel, individual-travel, mice-event`,
  `destination`, `travel_start_date date`, `travel_end_date date` (check end ≥ start), `traveler_estimate int` (> 0),
  `service_scope jsonb not null default '[]'` (array jenis layanan), `requirement_summary`, `budget_range`,
  `date_flexible boolean`, `decision_maker`, `urgency` check ∈ `low, medium, high`, `special_request_note`
- `b2c jsonb not null default '{}'` — field B2C/Group Trip (`groupTripProjectId`, jumlah dewasa/anak/bayi, penerimaan
  harga, kesiapan, hasil, follow-up berikutnya) disimpan apa adanya; aturannya pindah di S6b
- `merged_into text` FK leads (lead duplikat), `provenance`, `created_at`, `updated_at`; index `(stage)`, `(party_id)`

Tabel baru `lead_activities`: `id` (`LACT-`), `lead_id` FK leads, `type` (tipe `PartyActivityType` yang sama dengan
`party_activities`), `message text not null`, `owner_user_id` FK users, `due_at timestamptz` (follow-up), `done_at
timestamptz`, `created_at`, `provenance`; index `(lead_id)`.

Tabel baru `quotations` (header): `id` (`QUO-`), `lead_id` FK leads, `current_version int not null default 1`,
`sent_to_client_at timestamptz`, `created_at`, `updated_at`, `provenance`. Satu quotation per lead: unique `(lead_id)`.

Tabel baru `quotation_versions` (isi per versi): PK `(quotation_id, version)`;
- uang `bigint` minor: `amount_minor` (> 0, ≤ 1e15), `discount_minor`, `tax_minor`, `markup_minor`,
  `estimated_cost_minor`, `estimated_margin_minor` (boleh null)
- `currency text not null default 'IDR'`, `payment_terms`, `valid_until date`, `terms_and_conditions`, `inclusions`,
  `exclusions`, `cancellation_policy`, `proposed_itinerary_note`, `cost_sheet_id text` (tanpa FK, cost sheet lokal)
- `service_breakdown jsonb not null default '[]'` (`[{service, description?, amountMinor}]`)
- `status text not null default 'draft'` check ∈ `draft, submitted, approved, rejected, superseded`
- `submitted_by`, `submitted_at`, `decided_by`, `decided_at`, `decision_note`, `created_by`, `created_at`, `updated_at`

`projects`: FK `lead_id → leads(id)` dan `source_quotation_id → quotations(id)` ditambah `NOT VALID` (baris lama di
server staging menunjuk lead yang baru muncul setelah seed; baris baru tetap dicek).

`id_sequences`: `LED-`, `LACT-`, `QUO-` dari angka terbesar; `syncIdSequences` mengenal ketiganya. Down migration
membalik semuanya.

### Status quotation

`approvalStatus` yang dilihat frontend = status **versi terbaru** (`current_version`). `superseded` hanya untuk versi
lama yang digantikan revisi; versi lama tidak pernah diubah isinya.

### Lead

| Endpoint | Aturan |
|---|---|
| `GET /leads`, `GET /leads/:id` | peran internal (admin, finance, super-admin); client/vendor 403. Termasuk aktivitas & ringkasan quotation |
| `POST /leads` | Idempotency-Key; `sales.manage-lead`; `name`, `source` wajib; `ownerUserId` default = aktor; stage `new` |
| `PATCH /leads/:id` | kontak, kebutuhan perjalanan, `handedOverTo`, `b2c`, `stage` hanya `new ↔ contacted`. Lead yang Won (punya project) atau diarsip → 422. `stage`, `partyId`, `archived`, `mergedInto` tidak bisa lewat PATCH |
| `POST /leads/:id/qualify` `{ customerKind: 'company'\|'individual', partyId? }` | B2B (kategori ≠ `individual-travel`): syarat sama dengan `getLeadMissingQualification` — kategori, destinasi, periode, peserta, jenis layanan, ringkasan, AE; kurang → 422 dengan `details.missing` (daftar field). Customer: `partyId` bila dikirim (harus ada), kalau tidak cari customer dengan nama sama (tak peka huruf besar, jenis cocok), kalau tidak ada buat baru (company → `prospect`, individual → `client`, account owner = AE). Satu transaksi: lead `qualified`, `qualified_at`, `party_id`. B2C: lead `qualified` + customer saja; sales order tetap lokal (S6b). Sudah qualified → kembalikan apa adanya |
| `POST /leads/:id/unqualify` `{ reason }` | alasan wajib; lead Won → 422 |
| `POST /leads/:id/archive` `{ reason? }` / `POST /leads/:id/reopen` | arsip lead Won → 422 |
| `POST /leads/:id/merge` `{ intoLeadId }` | lead ini duplikat dari `intoLeadId`: keduanya ada, beda, tidak Won, target tidak diarsip. Lead ini diarsip, `merged_into` diisi, aktivitas catatan di kedua lead |
| `POST /leads/:id/activities` `{ type, message, dueAt? }` | `crm.manage-follow-up`; `POST /leads/:id/activities/:activityId/done` menandai follow-up selesai |

### Quotation

| Endpoint | Aturan |
|---|---|
| `POST /leads/:id/quotation` | Idempotency-Key; `sales.manage-lead`; lead B2B `qualified`, belum punya quotation (sudah ada → 409 `CONFLICT` dengan id-nya). Isi awal versi 1 (draft) dari body |
| `PATCH /quotations/:id` | edit versi terbaru; hanya bila `draft` (selain itu 422 "Ajukan revisi untuk mengubah quotation yang sudah diajukan") |
| `POST /quotations/:id/revise` | versi terbaru harus `submitted`/`approved`/`rejected`; buat versi baru (salinan isi, `draft`); versi lama → `superseded` kecuali yang `rejected` (tetap `rejected`). `sent_to_client_at` dikosongkan |
| `POST /quotations/:id/submit` | `draft` → `submitted`; isi `submitted_by/at`; nilai > 0 |
| `POST /quotations/:id/withdraw` | `submitted` → `draft` (pengaju atau siapa pun dengan `sales.manage-lead`) |
| `POST /quotations/:id/approve` `{ note? }` | `sales.approve-quotation`; `submitted` → `approved`; audit `selfApproved: submitted_by = aktor` |
| `POST /quotations/:id/reject` `{ note }` | `sales.approve-quotation`; catatan wajib; `submitted` → `rejected` |
| `POST /quotations/:id/send` | versi terbaru `approved`; isi `sent_to_client_at`. Tidak mengirim email/WA; akun portal client tetap lokal |

Semua quotation yang lead-nya sudah Won tetap bisa direvisi (riwayat komersial), tapi tidak menyentuh project.

### Won

`POST /leads/:id/won` (`sales.mark-won`, Idempotency-Key):
- Lead sudah punya project (`projects.lead_id`) → kembalikan project itu (200, tanpa membuat baru).
- Syarat: lead `qualified`, punya `party_id`, quotation dengan versi terbaru `approved`, destinasi, periode, peserta,
  jenis layanan. Kurang → 422 dengan `details.missing`.
- Satu transaksi lewat jalur `createProject` S3a (bukan duplikasi logika): nama = `title ?? company_name ?? name`,
  `characteristic: 'normal'`, nilai kontrak = `amount_minor` versi yang disetujui, `lead_id`, `source_quotation_id`;
  customer prospect → client (sudah di S3a); audit `lead.won`.
- Balapan dua klik tertahan oleh `projects_one_per_lead`: pelanggaran unik → kembalikan project yang sudah ada.

### Seed

`seed-demo` memasukkan 31 lead, aktivitasnya, dan 10 quotation fixture sebagai **versi 1** (status fixture). Seed ulang
tidak menimpa stage lead, status versi, atau versi tambahan yang dibuat pengguna (pola S4b). `syncIdSequences` setelah
seed.

## Frontend

- Tipe `LeadDto`, `LeadActivityDto`, `QuotationDto` (header + versi terbaru + `versions[]` ringkas) di `types/api.ts`;
  endpoint di `lib/api/endpoints.ts`.
- `data/leads-sync.ts`: memuat lead, aktivitas, quotation dari server ke `LEADS`, `LEAD_ACTIVITIES`, `QUOTATIONS`
  (merge di tempat, pola `*-sync.ts`); dipanggil `loadServerData` di `layouts/dashboard.vue` dan reset di `settings.vue`.
  `Lead.quotationId` / `projectId` diisi dari server (project via `lead_id`).
- Penulisan lewat server lebih dulu, lalu server yang menang: `LeadDetailSheet.vue` dan `pages/crm/leads/[id]/index.vue`
  (dua tempat dengan logika ganda) memakai fungsi sync yang sama. `ensureCustomerForLead` + `markLeadWonOnServer` di
  jalur B2B diganti `qualify` / `won` server.
- Riwayat versi tampil di kartu quotation (versi, nilai, status, pengaju/penyetuju); panel pipeline & laporan membaca
  data yang sudah sinkron tanpa perubahan logika.
- B2C: qualify memanggil server untuk status + customer, lalu `qualifyLeadAndCreateSalesOrder` / `qualifyGroupTripLead`
  lokal seperti sekarang.
- `no-mock` guard: mutator lokal yang sudah pindah (`createLead`, `createQuotation`, `approveQuotation`, …) tidak boleh
  dipanggil lagi dari pages/components.

## Testing

- Backend (`test/leads-quotations.test.ts`): tiap endpoint sukses, validasi, 401, 403 (finance menulis, client membaca);
  qualify kurang field → `missing`; customer dipakai ulang vs dibuat; revisi mengunci versi lama; self-approve tercatat;
  Won idempoten & dua klik → satu project; nilai kontrak = versi yang disetujui; revisi setelah Won tidak mengubah
  project; merge mengarsip + catatan; seed ulang tidak menimpa.
- Frontend: tes `leads-sync` (merge, qualify, Won), guard no-mock, `pnpm test`, tsc/eslint dibanding HEAD, `pnpm build`.

## Deploy

Migrasi `0024` jalan otomatis. Setelah push: `bun run db:seed:demo` sekali di server (memasukkan lead & quotation).
