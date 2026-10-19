# Portal client — bukti bayar & perubahan profil sensitif di server (S12c-1) — desain

Tanggal: 19 Oktober 2026 · Branch: `production` · Status: diimplementasikan (plan 2026-10-19-client-payment-proof-profile-change)

Bagian pertama S12c (entitas khusus portal). Bukti bayar invoice dan perubahan data sensitif perusahaan pindah dari
mock lokal (yang memverifikasi sendiri tanpa staf) ke server dengan alur *client ajukan → staf verifikasi*. Sub-tahap
lain: S12c-2 support & feedback, S12c-3 travel request & approval, S12c-4 itinerary & trip center, S12c-5 komentar &
lampiran.

## Keputusan pengguna

1. **Verifikasi bukti bayar = Finance mencatat penerimaan kas**: dialog penerimaan terisi dari bukti (nominal, tanggal,
   referensi); Finance memilih rekening dan boleh mengoreksi nominal; posting penerimaan (teralokasi ke invoice) =
   bukti terverifikasi. Finance juga bisa menolak bukti dengan alasan. Nominal resmi selalu dari Finance.
2. **Isi bukti**: nomor referensi, nominal, tanggal transfer, bank pengirim, catatan, nama file (metadata saja — upload
   file asli menyusul ADR-005).
3. **Profil sensitif** (NPWP, no. registrasi, nama & alamat billing, termin bayar, **nama perusahaan**) diajukan client
   dan ditinjau Admin (pemegang `crm.manage-party`) / Super Admin: setujui = diterapkan, tolak = dengan alasan.

## Keputusan desain

| Topik | Keputusan |
|---|---|
| Skema (migrasi 0040) | `payment_proofs` (`PPF-`): invoice, party, pengaju, referensi, `amount_minor` > 0, `transfer_date`, bank pengirim, catatan, nama file, status `submitted`/`verified`/`rejected`, peninjau & waktu, alasan tolak, `receipt_transaction_id` (TRX); satu bukti `submitted` per invoice (unique parsial). `customer_invoices.client_viewed_at`. `party_profile_changes` (`PPC-`): party, pengaju, `changes` jsonb (subset field sensitif), status `submitted`/`approved`/`rejected`, peninjau, alasan; satu `submitted` per party |
| Client — bukti bayar | `POST /client/invoices/:id/payment-proofs` (Idempotency-Key): invoice issued milik party, sisa > 0, tidak ada bukti menunggu; nominal ≤ sisa; tanggal transfer ≤ hari ini. Notifikasi semua user Finance aktif. `POST /client/invoices/:id/viewed` mengisi `client_viewed_at` sekali |
| DTO client | invoice client + `paymentProof` (bukti terakhir: status, referensi, nominal, tanggal, bank, catatan, nama file, diajukan, alasan tolak) dan `viewedAt` |
| Finance | `GET /finance/payment-proofs?status=` (`finance.view-cash`); `POST /finance/payment-proofs/:id/verify` (`finance.post-cash`, Idempotency-Key) `{ bankAccountId, amountMinor, effectiveDate, reference? }` → `postReceipt` dengan alokasi ke invoice (≤ sisa) + bukti `verified` + `receipt_transaction_id` + audit `finance.payment_proof_verified`; `POST …/reject` (`finance.manage-receivables`) `{ reason }` → `rejected`. Pengaju client diberi notifikasi. `getInvoice` Finance memuat bukti invoice |
| Client — profil sensitif | `POST /client/profile/changes` `{ name?, npwp?, registrationNumber?, billingName?, billingAddress?, paymentTerm? }`: minimal satu field berbeda dari data aktif; validasi sama dengan `updateParty` (NPWP 15–16 digit, ≤ 500 karakter); satu pengajuan menunggu per party (422 bila ada). Aktivitas party + notifikasi account owner & semua Admin/Super Admin aktif. `GET /client/profile` memuat `pendingChange` |
| Staf — profil | `GET /party-profile-changes?status=&partyId=` (`crm.manage-party`); `POST /party-profile-changes/:id/approve` → `updateParty` dengan perubahan (audit `party.updated`) + status `approved`; `/reject { reason }`. Pengaju diberi notifikasi; aktivitas party mencatat hasil |
| Frontend client | Form bukti bayar + tanggal transfer, bank pengirim, nama file; status "Menunggu Verifikasi"/"Ditolak" dari server; mock verifikasi & viewed lokal dihapus. Company profile: field sensitif diajukan ke server, banner menunggu dari server; mock verifikasi dihapus; nama perusahaan bisa diajukan |
| Frontend staf | Finance: kartu "Bukti Bayar Masuk" di halaman piutang + banner di invoice sheet dengan Verifikasi (rekening, nominal, tanggal — terisi dari bukti) / Tolak. CRM: kartu "Perubahan Data Menunggu Verifikasi" di detail customer (setujui / tolak) |

## Testing

- Backend: ajukan bukti (validasi, satu menunggu, nominal ≤ sisa, party lain 404, invoice lunas 422), Finance verify
  (penerimaan teralokasi, sisa turun, bukti verified, replay key), reject (alasan wajib), role lain 403; viewed sekali;
  profil (validasi NPWP, tanpa perubahan 400/422, satu menunggu), approve menerapkan & reject; notifikasi; migrasi
  naik/turun lewat `db.test`.
- Frontend: mapper (status menunggu verifikasi dari bukti), guard mutator lokal, `pnpm test`, vue-tsc ≤ 1987, eslint, build.

## Deploy

Migrasi 0040 (tabel & kolom baru).
