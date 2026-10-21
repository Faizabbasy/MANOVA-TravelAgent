# Checkpoint Fase 1 dan irisan Fase 2

21 Oktober 2026, Asia/Bangkok. HEAD tetap `0a2e5b2` / `production`. Ini implementasi lokal **partial**, bukan penyelesaian program, validasi accounting perusahaan, atau izin aktivasi/deploy. Lihat dokumen 11 untuk hasil penutup terbaru.

## Perilaku yang sudah bekerja

Super Admin dapat menyiapkan profil accounting tanpa jurnal harian. Server membuat production OFF atau rehearsal SHADOW (rehearsal ditolak di environment production). Template akun, periode dan draft kebijakan berversi tersimpan. Finance dapat memeriksa trial balance, pending exceptions, source status dan immutable journal detail. Owner mengakses kegiatan Customer Bayar/Bayar Supplier/Catat Biaya melalui Finance existing.

Perubahan source berjalan dalam transaksi SQL yang sama dengan GL dan audit. Tidak ada API bebas yang menerima debit/kredit browser, financial_transactions kedua, project dummy atau perhitungan uang authoritative di Vue. Rehearsal period lock/reopen memakai capability, reason, versi, audit dan konfirmasi produk yang eksplisit.

## File dan relasi

- `0045_accounting_foundation`: book → accounts/periods/policies → immutable events → journals/lines; registry per event/purpose; DB guards pada posting, periods, dimensions, reversal dan cash yang belum di-hook. Down menolak posted evidence.
- `0046_accounting_finance_sources`: tanggal efektif allocation baru (histori dibiarkan unknown), guards invoice/allocation/unsupported credit-refund.
- `backend/src/modules/accounting/{setup,template,posting,cash-source,invoice-source,reads,routes,unsupported}.ts`.
- Hook service Finance, DTO/endpoints/capability dan UI accounting + source panel di mutasi/invoices. Root pre-validation guard mencegah namespace baru melewati RBAC Finance; GET accounting no-store.
- Semua demo seed menolak jika accounting book ada. Tidak mengubah atau menjalankan database aplikasi; semua test/rehearsal terisolasi.

## Matriks implementasi irisan Finance

| Sumber existing | Sambungan baru | Batas saat ini |
|---|---|---|
| `postManualTransaction` | Bank vs klasifikasi policy eksplisit; company/project tetap sumber cash sama | Unknown sifat biaya/dana menjadi pending shadow atau rollback active |
| `postTransfer` / reverse | Dua bank legs via clearing, fee terpisah, exact reversal | Company cash berubah sebesar fee saja |
| `postReceipt` | Bank vs customer advance, lalu allocation → AR | Tidak mengakui revenue; proof verify/Group Trip memakai fungsi ini |
| `issueInvoice` | Fixture unconditional principal billing: AR vs contract liability | Conditional right/agent/mixed/actual tax dan contract components belum supported |
| `postVendorPayment` | Supplier advance vs bank, allocation → AP | Tidak expense kedua |
| `reviewVendorInvoice(approve)` | Fixture prepaid vs AP | Service receipt/accrual/actual matching memerlukan Fase 3 |
| Allocation baru | Event unik per ID allocation, tanggal tersimpan, no new cash | Legacy crossing cutover ditahan sampai opening-source mapping tersedia |
| Cash reverse / invoice void | Exact original lines dibalik, allocation receipt/payment ikut dibalik | Source sebelum cutover/missing original tidak diisi dengan nominal tebakan |
| Credit/cancellation/refund | Existing OFF flow dipertahankan; ACTIVE unsupported ditolak eksplisit | Belum diimplementasikan sebagai accounting lifecycle lengkap; Fase 2 belum selesai |
| Payroll/commission/inventory/company schedules | Belum masuk irisan ini | Fase 5–6 wajib; jangan menganggap template akun sebagai implementasi fitur |

## Bukti angka dan invariant

- Customer invoice 100 juta sebelum jasa: AR +100, contract liability +100, revenue 0. Receipt 30: bank +30; allocation memindahkan advance ke AR; AR tersisa 70, unallocated advance 0, contract liability tetap 100.
- Receipt 30 sebelum invoice menghasilkan posisi yang sama setelah invoice/alokasi. Liability tidak 130 dan tidak hanya 70. Kas tetap dari receipt sekali.
- Supplier deposit 20 juta bukan expense; invoice prepaid 80 menghasilkan prepaid 80/AP 80; allocation deposit menjadikan AP 60/advance 0, kas tidak berubah lagi.
- Reversal receipt membalik cash dan allocation; invoice void membalik billing sekali. Ledger cash = saldo awal rekening + seluruh mutasi; AR/AP = subledger issued/approved yang relevan. Tidak menggabungkan invoice void ke outstanding hanya karena view balance masih menyimpan historinya.
- Semua posted journals balanced, minimal dua lines, satu sisi per line, immutable. Registry posted harus menunjuk journal milik event/purpose yang benar. Party/project/order dan control dimension diperiksa DB.
- Worker berbeda request key untuk event sama mendapat journal ID yang sama. Snapshot berubah menolak replay; pending economic event dapat diselesaikan setelah policy sah tersedia, tanpa mengganti snapshot asal.
- Mandatory posting gagal → source, cash, event, audit dan idempotency claim rollback. Posting dan lock memakai book lock yang sama; post ke closed period menolak. Reopen memakai optimistic version dan capability terpisah.

Semua angka di atas fixture TEST_ONLY, bukan saldo/kontrak/aturan pajak pengguna. D03/D04 tetap unknown berdasarkan jawaban “belum”.

## Pemeriksaan dan gap

Full checkpoint backend: 607 PGlite / 608 PostgreSQL, tidak gagal; beda jumlah karena checkpoint test suite berbeda waktu. Source terbaru diverifikasi final targeted **20 pass pada tiap engine**, 152 assertions (PGlite 16.45s, PostgreSQL 14.75s), termasuk field validation customer/project tanpa cash baru. Backend typecheck terakhir exit 0. Frontend penuh 1255 pass / 66 files; targeted Vue/API juga lulus. Full lint tetap 105 errors/2691 warnings baseline, sementara lint accounting baru lulus. Typecheck solution yang nyata tetap exit 2 dengan 103 diagnostic existing (direct app 102 dan config Nuxt 1); perbaikan generic shared table mengurangi ribuan diagnostics tanpa mematikan pemeriksaan.

Full build checkpoint pertama exit 0 (956.30s, 29.3 MB); snapshot kedua juga exit 0 (1239.89s, 29.4 MB / 5.27 MB gzip), termasuk Nitro selesai. HTTP UAT memakai backend/server/proxy nyata TEST/PGlite dan lulus, termasuk Admin 403 dan unknown policy pending. Browser Chrome/IAB unavailable; hydration, responsive viewport dan keyboard UAT belum diverifikasi. Seluruh server test/rehearsal milik pekerjaan ini sudah dihentikan; data scratch tetap dipertahankan.

Pekerjaan berikutnya: lengkapi mapping/validation/adjustment F1, pending resolution dari source UI, credit/debit/refund/supplier recovery dan correction F2, serta dependencies recognition/fulfillment/accrual/opening. Kemudian lanjut F3–F10 menurut paket. Tidak ada klaim final profit, after-tax lengkap, real bank payment, private file upload, filing pajak atau kesiapan produksi.
