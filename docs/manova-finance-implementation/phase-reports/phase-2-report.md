# Laporan Phase 1.5 + Phase 2 — Prasyarat dan fondasi uang

29 September 2026 · branch `monorepo`. Rujukan: `FINANCE-DOMAIN-MAPPING.md` (disetujui) dan ADR-007.

> **Batas klaim.** Yang aktif sekarang adalah **backend** untuk:
> - rekening dan saldo pembuka
> - buku kas (pemasukan lain, pengeluaran)
> - transfer + biaya
> - pembatalan transaksi
> - statement, ledger per rekening, dan posisi kas
>
> Semuanya bisa dipakai lewat API dan client bertipe di frontend. **Belum** ada invoice/piutang/utang (Phase 3), refund (Phase 5), cash flow (Phase 6), maupun layar Finance baru (Phase 4). UI Finance lama (mock) belum disentuh.

## Apa yang berubah

### Phase 1.5 — prasyarat (commit `3275f60`)
- **ADR-007** — model V1, kepemilikan data, dan status bayar tanpa nominal untuk Admin.
- **Migrasi `0005_commercial_references`** — nilai kontrak project serta harga jual dan tanggal berangkat booking. Kolom ini milik modul Project/Booking; Finance hanya membaca.
  - Diisi dari fixture: nilai quotation, harga booking, total BOQ MICE, dan tanggal paling awal.
  - DTO internal mengirimkannya hanya ke role ber-`canViewFullFinancials`.
- **Kebocoran R3 ditutup.** Kartu ringkasan project tidak lagi menampilkan Budget/Actual/Nilai Quotation ke role tanpa hak.

### Phase 2 — fondasi uang (backend + API client)

**Migrasi `0006_finance_money_core`:**

| Tabel | Isi |
|---|---|
| `bank_accounts` | Saldo pembuka dengan maker/checker |
| `financial_transactions` | Satu-satunya catatan uang; trigger menolak UPDATE/DELETE. Constraint: arah wajib sesuai jenis, kaki transfer wajib terikat transfer, pembatalan hanya sekali. |
| `transfers` | Immutable |
| `idempotency_keys` | Kunci idempotency per perintah |

**Modul `backend/src/modules/finance/`:**

| File | Isi |
|---|---|
| `accounts.ts` | Rekening, ajukan & verifikasi saldo pembuka, penyamaran nomor rekening |
| `postings.ts` | Pemasukan lain / pengeluaran, pembatalan, transfer + biaya, pembatalan transfer |
| `reads.ts` | Statement, ledger per rekening, posisi kas, detail transaksi/transfer |
| `routes.ts` | Endpoint API |

**Pendukung:**
- `src/shared/idempotency.ts` — kunci diklaim di dalam transaksi DB yang sama dengan posting.

**Frontend (tanpa perubahan layar):**
- `app/types/api.ts` dan `app/lib/api/endpoints.ts` → `api.finance.*`.
- Setiap perintah uang otomatis mengirim `Idempotency-Key`; kunci yang sama bisa dipakai ulang untuk retry.

## Aturan yang ditegakkan (dan dites)

| Aturan | Di mana |
|---|---|
| Saldo belum ada = "tidak tersedia", bukan Rp0, sampai saldo pembuka diverifikasi | API + test |
| Maker (Finance) ≠ checker (Super Admin); pengaju tidak bisa memverifikasi sendiri | API + test |
| Transaksi hanya pada rekening aktif dengan saldo pembuka terverifikasi, tidak sebelum tanggal cutover, tidak di masa depan | API + test |
| Uang tercatat tidak bisa diubah/dihapus; koreksi = transaksi balik beralasan, sekali saja | trigger DB + unique index + test |
| Saldo tidak boleh minus, termasuk saat 5 posting berjalan paralel | kunci `FOR UPDATE` + test di PostgreSQL |
| Pengiriman ulang dengan Idempotency-Key yang sama tidak mencatat dua kali; kunci yang sama dengan isi berbeda → 409 | test |
| Transfer = keluar + masuk + biaya dalam satu transaksi; kas perusahaan hanya turun sebesar biaya; dibatalkan utuh, tidak per kaki | test |
| Statement: total operasional tidak menghitung transfer internal, tetapi biaya transfer tetap dihitung | test |
| Ledger: saldo awal + masuk − keluar = saldo akhir, dan saldo berjalan per baris cocok dengan saldo rekening | test |
| Admin 403 di semua endpoint Finance; anonim 401 | test |
| Semua aksi uang tercatat di audit bersama pelakunya | test |

## Bukti

| Check | Hasil |
|---|---|
| Backend typecheck | lulus |
| Backend `bun test` — PGlite | **121 pass / 0 fail** (8 file; 25 test baru di `finance-money.test.ts`) |
| Backend `bun test` — PostgreSQL 17 | **121 pass / 0 fail** |
| `db:rehearse` di PostgreSQL 17 | lulus: up 1–6 → seed → down ke 0 → up → backup → restore, skema v6 |
| Frontend typecheck / vitest | lulus / **200 pass** |
| Frontend lint (file yang diubah) | bersih |

Test yang memakai nomor versi skema kini membaca daftar file migrasi, jadi migrasi baru tidak lagi merusaknya.

## Risiko / catatan

- **Biaya transfer masih manual** per transfer (belum ada aturan per arah bank A→B). Cukup untuk V1; aturan otomatis bisa ditambah tanpa mengubah buku kas.
- **Bukti transfer (file) belum bisa dilampirkan.** ADR-005 masih usulan; kolom lampiran ditambahkan saat keputusannya diambil.
- **Pembatalan transaksi yang nanti teralokasi ke invoice** (Phase 3) harus ikut membatalkan alokasinya. Aturan ini dibangun bersama alokasi.
- **Belum ada data keuangan demo.** Layar Phase 4 butuh seed skenario keuangan terpisah dan eksplisit (paket `10`), bukan migrasi dari mock.

## Berikutnya

**Phase 3 — piutang & utang:**
- customer invoice + jadwal tagihan
- vendor invoice
- pembayaran dengan alokasi parsial dan uang muka
- tampilan piutang/utang
- ringkasan Finance untuk project/booking/vendor/customer, termasuk varian status-saja untuk Admin
