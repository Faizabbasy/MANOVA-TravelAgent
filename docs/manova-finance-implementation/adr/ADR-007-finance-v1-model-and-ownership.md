# ADR-007 — Finance V1: model data, kepemilikan, dan akses status bayar

- **Status:** Accepted (29 Sep 2026). Pengguna menyetujui `FINANCE-DOMAIN-MAPPING.md` beserta keputusan #1–#3 ("gas gua approve").
- **Rujukan:** `FINANCE-DOMAIN-MAPPING.md` §6 (model), §7 (kepemilikan), §13 (keputusan).

## Keputusan

### 1. Nilai komersial dan tanggal berangkat di server — milik modul operasional

Finance hanya **membaca** kolom-kolom ini; yang menulisnya adalah modul pemiliknya. Migrasi: `0005_commercial_references`.

| Kolom | Pemilik | Isi saat ini |
|---|---|---|
| `projects.contract_value_minor`, `contract_currency` | Project | Nilai quotation yang diterima (`quotationAmountIdr` fixture) lewat seed demo. |
| `booking_refs.sell_amount_minor` | Booking | Harga jual booking. MICE = Σ harga jual baris BOQ, sama dengan `getMiceBoqTotals`. `null` bila booking belum berharga. |
| `booking_refs.departure_date` | Booking | Tanggal paling awal dari segmen / check-in / pickup / sesi (Asia/Jakarta). Dasar tier H-x. |

- Semua kolom diisi seed sekarang, dan nanti lewat API Project/Booking saat modul itu pindah ke server.
- DTO internal hanya mengirim nilai uang ke role ber-`canViewFullFinancials`. DTO portal tidak mengirimnya sama sekali.

### 2. Tabel nyata V1 vs tampilan hitung

**Tabel nyata:**

| Kelompok | Tabel |
|---|---|
| Uang | `bank_accounts`, `financial_transactions`, `payment_allocations`, `transfers` |
| Piutang | `customer_invoices` (+ `customer_invoice_lines`), `billing_schedule_items` |
| Utang | `vendor_invoices` |
| Pembatalan & refund | `cancellation_policies`, `cancellation_rules`, `booking_policy_snapshots`, `refunds`, `credit_notes` |
| Pendukung | `attachments`, `idempotency_keys` |

**Bukan tabel.** Dihitung dari buku kas atau dicatat sebagai jenis transaksi, supaya tidak ada angka ganda:
- `account_statements`, `ledger_entries`, `receivables`, `payables` — tampilan hitung.
- `payment_records`, `vendor_payments`, `settlements` — jenis transaksi di `financial_transactions` + alokasi.

### 3. Admin melihat status bayar tanpa nominal

- Endpoint konteks (`*/finance-summary`) menyediakan varian **status saja** untuk Admin, misalnya "DP diterima", "Lunas", atau "Terlambat". Varian ini tanpa angka.
- Finance dan Super Admin menerima versi lengkap.

## Konsekuensi

- Profitabilitas dan "sisa belum ditagih" bisa dihitung di server tanpa membaca mock.
- Perubahan nilai kontrak atau harga booking menjadi tanggung jawab modul pemiliknya. Finance tidak pernah menyalin atau mengubahnya.
- Kebocoran Budget/Actual/Nilai Quotation di kartu ringkasan project (R3) ditutup di commit yang sama dengan ADR ini.
