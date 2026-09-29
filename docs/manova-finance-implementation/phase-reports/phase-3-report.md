# Laporan Phase 3 — Piutang & utang

29 September 2026 · branch `monorepo`. Rujukan: `FINANCE-DOMAIN-MAPPING.md` §6.2–§6.3, ADR-007.

> **Batas klaim.** Backend piutang/utang dan API-nya **aktif dan teruji**, beserta client bertipe di frontend. **Belum** ada layar (Phase 4), refund dan pembatalan booking (Phase 5), maupun cash flow (Phase 6). Mock finance lama di frontend belum disentuh.

## Apa yang berubah

### Migrasi `0008_finance_receivables_payables`

**Tabel:**

| Tabel | Isi |
|---|---|
| `billing_schedule_items` | Jadwal tagihan (DP / termin / pelunasan) |
| `customer_invoices` + `customer_invoice_lines` | Invoice customer dan barisnya |
| `credit_notes` | Pengurang tagihan |
| `vendor_invoices` | Invoice vendor |
| `payment_allocations` | Pembayaran mana melunasi invoice mana |

**View** — satu-satunya rumus sisa tagihan/utang; tidak ada angka yang disimpan ganda:

| View | Isi |
|---|---|
| `v_active_allocations` | Alokasi yang masih berlaku (pembayarannya tidak dibatalkan) |
| `v_customer_invoice_balances` | Sisa tagihan = total − alokasi aktif − credit note |
| `v_vendor_invoice_balances` | Sisa utang = total − alokasi aktif |
| `v_unallocated_payments` | Uang muka customer / deposit vendor |

**Trigger database** — pertahanan berlapis, di samping pengecekan layanan dengan kunci baris:

| Aturan | Isi |
|---|---|
| Alokasi | Tidak melebihi nominal pembayaran maupun sisa tagihan. Hanya ke invoice terbit milik customer yang sama, atau invoice vendor yang disetujui milik vendor yang sama. Tidak ke pembayaran yang dibatalkan. Tidak bisa diubah/dihapus/TRUNCATE. |
| Invoice customer terbit | Dibekukan: nomor, nominal, pihak, tanggal kontrak, dan baris. Tidak bisa dihapus. Void hanya tanpa pembayaran aktif / credit note. |
| Invoice vendor yang sudah direview | Dibekukan. Tidak pernah dihapus. Void hanya tanpa pembayaran aktif. |

### Kode backend (`backend/src/modules/finance/`)

| File | Isi |
|---|---|
| `receivables.ts` | Jadwal tagihan, invoice customer (draft → terbit → void, tanggal perkiraan, sengketa), credit note, penerimaan + alokasi + uang muka, daftar piutang |
| `payables.ts` | Invoice vendor (catat → review → setujui/tolak → void), pembayaran vendor + alokasi + deposit, daftar utang |
| `summaries.ts` | Ringkasan untuk project/booking/vendor/customer (lengkap vs status-saja), daftar uang muka |
| `routes-ar-ap.ts` | Endpoint API |

Capability baru `project-order.view-payment-status` (Admin + Finance) untuk keputusan #3. Namespace `finance.*` sengaja tidak dipakai, karena Admin tidak boleh memegang capability Finance apa pun.

### Frontend (tanpa perubahan layar)

- `app/types/api.ts` dan `api.finance.*` di `app/lib/api/endpoints.ts`.
- Penerimaan, pembayaran vendor, dan alokasi otomatis mengirim `Idempotency-Key`.

## Aturan yang ditegakkan (dan dites)

| Aturan | Bukti |
|---|---|
| Draft dan jadwal tagihan bukan piutang; menerbitkan invoice tidak memindahkan kas | test |
| Pembayaran parsial menurunkan sisa tepat sebesar alokasinya dan menaikkan saldo rekening | test |
| Kelebihan bayar menjadi uang muka customer; dialokasikan ke invoice berikutnya tanpa kas bergerak lagi | test |
| Tidak bisa mengalokasikan melebihi sisa tagihan, melebihi pembayaran, atau ke invoice customer lain | test layanan + trigger DB |
| Credit note mengurangi tagihan dan tidak pernah melampaui sisa; invoice yang ada pembayarannya tidak bisa di-void | test |
| Membatalkan penerimaan melepas alokasinya (tagihan kembali terbuka, riwayat tetap ada); penerimaan yang dibatalkan tidak bisa dialokasikan lagi | test |
| Invoice vendor jadi utang **hanya** setelah disetujui; persetujuan tidak memindahkan kas; kecocokan yang disengketakan tidak bisa disetujui | test |
| Bayar vendor parsial/penuh; kelebihan bayar ditolak; deposit vendor dialokasikan kemudian | test |
| Nomor invoice vendor unik per vendor (tanpa beda huruf besar/kecil); service order/booking dari vendor lain ditolak | test |
| Tagihan terlambat (dengan jumlah hari) muncul di daftar piutang, ringkasan project, dan ringkasan booking | test |
| Tanggal perkiraan bayar berubah tanpa mengubah jatuh tempo kontrak | test |
| Admin: ringkasan status tanpa **satu pun** field uang di 5 endpoint; 403 di semua menu Finance | test (dicek rekursif per nama field) |
| Profitabilitas project = (tagihan − credit note) − (invoice vendor disetujui + pengeluaran project) | test: 975 jt − 3 jt = 972 jt, margin 99,69% |

## Bukti

| Check | Hasil |
|---|---|
| Backend typecheck | lulus |
| Backend `bun test` — PGlite | **147 pass / 0 fail** (21 test baru di `finance-arap.test.ts`) |
| Backend `bun test` — PostgreSQL 17 | **147 pass / 0 fail** |
| `db:rehearse` PostgreSQL 17 | lulus sampai skema **v8** |
| Frontend typecheck / vitest / lint (file berubah) | lulus / **202 pass** / bersih |

## Keputusan desain yang perlu diketahui

- **Customer invoice selalu milik customer project-nya.** Tidak dipilih bebas, sehingga tidak bisa salah pihak.
- **Profitabilitas memakai dasar akrual:** pendapatan = yang sudah ditagih, bukan yang sudah dibayar. Posisi kas terlihat di menu Kas/Cash Flow.
- **Tagihan yang melebihi nilai kontrak tidak diblokir**, hanya diberi peringatan `EXCEEDS_CONTRACT_VALUE`. Change request memang bisa menambah tagihan.
- **Membatalkan alokasi dilakukan dengan membatalkan pembayarannya.** Alokasi sendiri permanen; ini menjaga jejak audit.

## Risiko / sisa

- **DTO portal client/supplier** belum dibuat (portal disembunyikan, ADR-006).
- **Bukti transfer** belum bisa dilampirkan (ADR-005).
- **Pajak** di luar V1: nominal invoice adalah nilai yang ditagih.
- **Mock finance lama masih dipakai layar lama.** Angkanya tidak sama dengan server sampai layar dipindah di Phase 4. Ini risiko R2 di dokumen mapping.

## Berikutnya

**Phase 4 — UI Finance baru:**
- Hapus UI mock setelah semua pemakainya pindah.
- Dashboard (sementara), Statement, Ledger, Receivable, Payable.
- Panel konteks di halaman project/booking/vendor/customer.
- Redirect link lama.
- Seed skenario keuangan demo.
