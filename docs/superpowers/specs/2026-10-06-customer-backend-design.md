# Backend Customer (S1) — desain

Tanggal: 6 Oktober 2026 · Branch: `production` · Status: diimplementasikan

Tahap kedua program "backend untuk halaman lain" (tahap pertama: `2026-10-06-project-core-backend-design.md`,
S0 + S3a). Memakai fondasi tulis S0 (`id_sequences`, `withIdempotency`, `recordAudit`, capability) dan pola
frontend S3a (array `reactive()` diisi dari server setelah sesi siap).

## Keputusan

| Topik | Keputusan |
|---|---|
| Cakupan | Profil customer, kontak (PIC), aktivitas CRM, dan semua pembuatan customer (qualify B2B, qualify B2C, gabung Group Trip, tombol tambah customer) lewat server |
| Limit kredit | Hanya Finance & Super Admin (`finance.edit-credit-limit`), wajib alasan, diaudit |
| Profil & kontak | Admin & Super Admin (`crm.manage-party`) |
| Aktivitas CRM | Optimistis: tampil seketika di layar, dikirim ke server di belakang; gagal → toast peringatan; setelah muat ulang server sumbernya |
| Won lead | Server menaikkan customer `prospect` → `client` saat project dibuat dengan `leadId` |
| Portal client (nonaktif, ADR-006) | Edit profil/kontak di portal tetap mock lokal |
| Tetap lokal | Lead, quotation, sales order (S6), credit facility/sisa limit, semua fitur portal |

## Backend

### Migrasi `0019_customer_writes`

Kolom baru di `parties` (nullable kecuali disebut): `industry`, `company_type` (check: private-company, bumn,
government-agency, university, foundation, event-organizer, travel-agent, other), `size`, `address`, `city`,
`province`, `country`, `postal_code`, `phone`, `email`, `website`, `account_owner_user_id` (FK users),
`registration_number`, `npwp`, `billing_name`, `billing_address`, `payment_term`, `po_required boolean not null
default false`, `travel_preferences`, `credit_limit_minor bigint` (check ≥ 0).

Tabel baru:
- `party_contacts (id text pk, party_id fk parties, name not null, title not null, email, phone, provenance,
  created_at)` — ID `CP-nnn`.
- `party_activities (id text pk, party_id fk parties, lead_id text, type check (call, meeting, email, note,
  follow-up), message not null, owner_user_id fk users, activity_date date not null, due_at date, provenance,
  created_at)` — ID `PACT-nnn`.

`id_sequences` mendapat prefix `CP-` dan `PACT-` (diinisialisasi dari baris yang ada); `nextId` /
`syncIdSequences` mendukung kedua prefix.

### Endpoint

| Endpoint | Siapa | Isi |
|---|---|---|
| `GET /parties`, `/parties/:id` | seperti sekarang (`canListParties`; client hanya dirinya) | + field profil; `creditLimitMinor` hanya untuk peran `canViewFullFinancials` |
| `POST /parties` | `crm.manage-party` | name, partyType (company/individual), lifecycleStatus (default prospect), field profil; `Idempotency-Key` wajib; ID `PTY-` dari server |
| `PATCH /parties/:id` | `crm.manage-party` | field profil; menolak `creditLimitMinor`, `lifecycleStatus`, `id` (400) |
| `PUT /parties/:id/credit-limit` | `finance.edit-credit-limit` (baru) | `creditLimitMinor` (string ≥ 0, atau null untuk menghapus) + `reason` wajib |
| `GET /parties/:id/contacts`, `POST /parties/:id/contacts` | baca: `canListParties`; tulis: `crm.manage-party` | name, title, email?, phone? |
| `GET /party-activities?partyId=&leadId=`, `POST /parties/:id/activities` | baca: `canListParties`; tulis: Admin, Finance, Super Admin (aktivitas = log kerja) — capability baru `crm.log-activity` | type, message, leadId?, activityDate (default hari ini), dueAt? ; owner = aktor |

Validasi Bahasa Indonesia per field; email/website format dasar; NPWP 15–16 digit (titik/strip boleh).
Audit: `party.created`, `party.updated` (before/after), `party.credit_limit_changed` (reason), `party.contact_created`,
`party.activity_created`. Di luar scope → 404.

`createProject` (S3a): bila `leadId` diisi dan party berstatus `prospect`, ubah ke `client` + audit
`party.promoted_to_client` di transaksi yang sama.

### Seed

`extract-demo-core.ts` mengekstrak field profil party (`creditLimitIdr` → `creditLimitMinor`), `CONTACTS` →
`partyContacts`, `PARTY_ACTIVITIES` → `partyActivities`. `seed-demo.ts` meng-upsert ketiganya dan memanggil
`syncIdSequences`. Test kunci uang `db.test.ts` ditambah `creditLimitMinor` (milik Finance, dicatat di ADR-007
update).

## Frontend

- `app/data/parties-sync.ts` (pola `projects-sync.ts`): `upsertServerParty`, `mergeServerParties`,
  `mergeServerContacts`, `mergeServerActivities`, `loadServerParties(api)` (semua halaman), dipanggil dari
  `useProjectsSync`-sejenis `useCustomersSync` di layout dashboard setelah sesi siap; banner layout yang sama
  menampilkan kegagalan keduanya.
- Pembuatan customer async lewat server:
  - `createPartyOnServer` — tombol tambah customer (`customer-journey/customers/index.vue`).
  - `qualifyLeadOnServer(api, leadId)` — B2B: cari party bernama sama di `PARTIES`; bila tidak ada, POST party
    (prospect, company, AE = `lead.handedOverTo`), lalu `qualifyLeadForQuotation(leadId, partyId)` lokal.
  - B2C (`qualifyLeadAndCreateSalesOrder`) dan gabung Group Trip (`qualifyGroupTripLead`): party individu
    dibuat di server lebih dulu, lalu fungsi lokal menerima `partyId`; sales order tetap lokal.
  - Fungsi lokal tidak lagi membuat party dengan `nextSequentialId('PTY-')`.
- Kontak: `crm/parties/[id]` memakai `createContactOnServer`. Portal (`client/company-profile`,
  `DashboardOverviewPanel`) tetap `createContact` lokal.
- Aktivitas: `createPartyActivity` tetap sinkron (push lokal) lalu memanggil sink yang dipasang
  `parties-sync` setelah sesi siap → `POST`; sukses → ID lokal diganti ID server; gagal → toast "Aktivitas belum
  tersimpan ke server". Tanpa sink (test, server mati) → hanya lokal.
- Limit kredit: `customer-journey/customers/[id]` — dialog nominal + alasan, tampil bila
  `session.can('finance.edit-credit-limit')`; Admin melihat nilainya tanpa tombol.
- `applyLeadWon` tidak perlu lagi mengubah `lifecycleStatus` (server yang mengubah; sinkron ulang party setelah
  Won).
- RBAC frontend: tambah `finance.edit-credit-limit` (finance) dan `crm.log-activity` (admin, finance).

## Test

- **Backend** `test/party-writes.test.ts`: create (ID setelah fixture, idempotency, validasi, 401/403),
  patch (field terlarang 400, audit before/after), credit-limit (Finance 200, Admin 403, alasan wajib, null
  menghapus), kontak & aktivitas (create/list, scope 404 untuk client lain), promosi prospect→client saat
  project dengan leadId, integrasi Finance: customer baru → project → invoice terbit.
- **Frontend**: merge party/kontak/aktivitas, `qualifyLeadOnServer` (party sudah ada vs baru), sink aktivitas
  (sukses mengganti ID, gagal memanggil notifikasi), `createPartyOnServer`.
- Test lama tetap lulus; `no-mock-finance` allow-list tidak bertambah.

## Di luar lingkup

Lead/quotation/sales order di server (S6), vendor (S2), credit facility/eksposur piutang dari Finance, portal,
hapus/merge customer, verifikasi perubahan data sensitif.
