# Pengujian dan kriteria penerimaan

## Aturan bukti

Gunakan fixture sintetis dan database terisolasi. Semua angka berikut dalam juta rupiah untuk dibaca manusia; tests menggunakan bigint minor IDR exact, misalnya Rp200 juta = `"200000000"`. Tidak ada rate/policy fixture yang menjadi default fiskal produksi.

Uji service domain, persistence, HTTP dan browser untuk perjalanan pengguna. Source-guard tests boleh membantu migrasi frontend, tetapi tidak menggantikan pengujian perilaku. Jangan membuat tes yang hanya memeriksa string kode atau menyalin implementasi formula yang sama sebagai expected result.

## A01 paket prinsipal dengan DP dan biaya tertunda

Fixture book aktif dengan profil prinsipal fiktif, tanpa pajak/FX untuk kasus ini. Cutover 1 September 2026; cash opening 200 dan equity 200. Trip diberikan Oktober; invoice mengikat tanpa syarat sehingga menjadi AR versus contract liability sebelum fulfillment. Kontrak 100, supplier total 80. Recognition paket pada delivery Oktober dipilih eksplisit untuk fixture.

| Kejadian | Kas | AR | Supplier advance atau prepaid | AP atau accrued cost | Contract liability | Revenue kumulatif | Cost kumulatif |
|---|---:|---:|---:|---:|---:|---:|---:|
| Opening | 200 | 0 | 0 | 0 | 0 | 0 | 0 |
| September invoice customer 100 | 200 | 100 | 0 | 0 | 100 | 0 | 0 |
| Customer DP 30 | 230 | 70 | 0 | 0 | 100 | 0 | 0 |
| Deposit supplier 20, belum ada invoice/jasa | 210 | 70 | 20 | 0 | 100 | 0 | 0 |
| Oktober jasa diberikan dan supplier service diterima, invoice belum datang | 210 | 70 | 20 | 80 accrued | 0 | 100 | 80 |
| Supplier invoice 80, clear accrual dan alokasikan deposit 20 | 210 | 70 | 0 | 60 AP | 0 | 100 | 80 |
| Customer bayar sisa 70 | 280 | 0 | 0 | 60 AP | 0 | 100 | 80 |
| Supplier dibayar 60 | 220 | 0 | 0 | 0 | 0 | 100 | 80 |

September profit 0; Oktober profit 20. Neraca selalu seimbang. Ketika invoice supplier menggantikan accrual tidak ada expense 80 kedua. Deposit allocation tidak mem-posting cash kedua. Variasi: invoice supplier diterima sebelum jasa; akun prepaid terbentuk dan dirilis saat jasa diberikan, hasil akhir sama.

## A02 biaya kantor dan laba perusahaan

Lanjutkan A01 dengan October office expense 5, payroll expense/payable 4, commission expense/payable 2 dan depreciation 1. Company profit sebelum pajak = 8. Jika payroll/commission belum dibayar, profit tetap 8; settlement berikutnya hanya mengubah cash dan liabilities. Lengkapi acquisition/opening asset yang mendasari depreciation agar BS reconcile.

Alokasi office expense 5 ke project untuk analisis tidak menjadikan company profit 3. P&L company expense tersebut tetap sekali. Net-after-tax unavailable bila profil pajak belum lengkap; jangan menyebut 8 sebagai laba bersih setelah pajak.

## A03 receipt sebelum invoice

Customer bayar 30 sebelum invoice. Bank naik 30 dan advance 30. Setelah invoice sah 100 dibuat sebelum jasa, AR gross 100, advance diaplikasikan 30, AR remaining 70 dan contract liability total 100. Hasil sama dengan A01, bukan liability 130 atau hanya 70. Uji sebagian advance tidak dialokasikan, beberapa invoice dan koreksi allocation.

## A04 transaksi agen

Book/profil fiktif agen: customer membayar 102; bagian prinsipal 100 dan hak fee 2. Ketika fee obligation terpenuhi, revenue hanya 2. Penyelesaian 100 ke prinsipal tidak menjadi expense bruto tambahan. Setelah penyelesaian, delta bank 2, pass-through liability 0 dan profit 2 sebelum biaya lain. Operational sales volume boleh 102 tetapi label berbeda dari revenue.

## A05 cash refund dan supplier recovery

Kasus terpisah dari A02: mulai posisi akhir A01 (delta profit/cash 20). Refund atas jasa yang sudah diakui disetujui 10 lalu dibayar; total revenue adjustment hanya 10. Supplier cost recovery diakui 4 lalu diterima; cost adjustment hanya 4. Delta profit akhir 14 dan bank akhir 214. Bentuk credit/refund liability mengikuti service Finance existing; jangan mengurangi revenue pada approval sekaligus settlement.

Variasi: cancellation sebelum fulfillment, partial booking cancellation, policy snapshot, supplier recovery hanya atas deposit, customer refund lebih cepat dari supplier refund, reverse receipt/payment/refund, dan biaya penalti yang memang tetap terutang. Uji state dan posisi pada setiap tahap, bukan hanya saldo akhir.

## A06 kasbon dan reimburse

Kasbon 5 kepada tour leader: bank -5, employee advance +5, expense 0. Bukti sah 4: expense +4, advance tersisa 1. Kembalikan 1: bank +1 dan advance 0. Pemakaian akhir cash 4 dan expense 4. Bukti yang sama diklaim lagi ditolak. Variasi pengeluaran 6 dengan advance 5: reimbursement payable 1, dibayar sekali.

## A07 aset pinjaman dan dana owner

Pembelian aset 12 tidak langsung menjadi expense 12; ledger aset dan bank/AP berubah. Depreciation occurrence hanya sekali per aset/periode. Pinjaman diterima 50 bukan revenue. Cicilan pokok 5 dan bunga 1 membuat cash -6, loan -5 dan expense 1 atau clearing interest accrual yang sudah ada. Setoran modal bukan revenue; pengambilan dana mengikuti entity profile, bukan automatic expense.

## A08 potongan pajak dan tax profile

Fixture sintetis: AR 100 diselesaikan bank 98 dan bukti potong valid 2. AR 0, cash 98, tax credit/position 2 sesuai profil; revenue tidak turun 2 sebagai diskon. Ini contoh nominal, bukan rekomendasi tarif 2 persen untuk semua transaksi. Bukti belum tersedia masuk exception dengan saldo yang dapat ditelusuri.

Fixture pajak transaksi terpisah memakai rule buatan bernama `TEST_ONLY`, bukan rate Indonesia default. Uji inclusive/exclusive, effective date, pengkreditan yang diperbolehkan/tidak, rounding, void/correction dan tax payable settlement. Unknown profile tidak dianggap exempt. Export round-trip tervalidasi schema aktif; filing eksternal tidak dipalsukan.

Kasus credit loss terpisah: AR sah 10 yang tidak tertagih memiliki allowance/write-off sesuai profil. Revenue jasa tidak otomatis turun sebagai diskon; bad debt expense/allowance dan AR reconcile. Recovery kemudian tidak menambah revenue jasa yang sama lagi.

## A09 partial dan lintas periode

Kontrak 100 memiliki obligation yang diizinkan policy fiktif: delivery September 40 dan Oktober 60. Revenue masing-masing 40/60, tidak 100 di September karena invoice terbit. Partial supplier fulfillment dan accrual match mengikuti komponen yang sama. Revisi ke jadwal berikut tidak mengedit posted journals. Revenue reversal tidak melebihi recognized source.

## A10 project dan order yang sudah ada

- Ready tetap menunggu invoice DP dan cash receipt aktual.
- Booking flight, hotel, transport dan MICE masing-masing memiliki fixture lengkap sampai posting dan cancellation.
- Budget milestone/itinerary yang terkait booking tidak menjadi actual cost kedua.
- Tambah/ganti peserta yang mengubah biaya memerlukan review delta dan CR sesuai aturan; tidak mengedit invoice issued.
- CR approval tambahan membuat draft billing tertaut sekali, auto-issue hanya bila policy mengizinkan; no cash movement.
- B2C standalone lengkap invoice/receipt/cost/refund/profit tanpa project dummy.
- Dua peserta Group Trip punya customer invoice/receipt masing-masing; totals trip = jumlah participant orders dan biaya trip yang relevan, tanpa duplicate traveler.
- Komisi tidak menjadi paid karena completed/closed. Payment proof submission belum menjadi cash.
- Project completed dengan AR 70 dan AP 60 dapat menampilkan profit sementara/reviewed, tetapi legacy final close tetap mengikuti settlement gates yang didokumentasikan.
- Monthly close tidak mewajibkan AR/AP sah nol; missing accrued cost/unknown mandatory policy tetap blocker completeness.

## A11 idempotency concurrency dan kegagalan

Uji request sama berulang, request key sama body beda, source event sama dengan request key baru, dua worker, dua partial fulfillment bersamaan, double-click, crash sebelum/sesudah commit dan retry setelah timeout. Domain source, cash, journal dan audit sama-sama rollback pada mandatory posting failure saat active. Event adjustment/reversal punya identity sendiri dan cumulative limit.

Concurrent close versus posting, perubahan policy versus posting, dua payment allocation, overpayment, cross-scope IDs dan reopened period harus konsisten. Saat lock closed, tidak ada jalan bypass lewat refund, depreciation, payroll, backdated invoice, API langsung atau worker.

Late invoice dari periode tertutup tetap dapat diselesaikan melalui reopen atau adjustment periode terbuka yang sah. Tanggal sumber tetap asli, posting date serta alasan correction terlihat, dan cash tidak digandakan.

## A12 laporan dan rekonsiliasi

- Total debit = kredit; BS assets = liabilities + equity termasuk current result tepat sekali.
- GL cash = account ledger existing pada cutover/date basis sama.
- AR/AP/advance/accrual/employee/tax/asset control account = subledger; party/project/order attribution cocok.
- P&L company = project/order recognized contribution + company revenue/expense yang belum ada pada contribution; overhead allocation tidak menggandakan biaya.
- Period totals = sum detail drilldown, termasuk pagination/filter yang benar.
- Statement actual berbeda dari forecast; internal transfer mengubah company cash hanya sebesar fee.
- Forecast memasukkan sisa commitment, invoice, payroll, tax, loan dan recurring expenses tepat sekali pada setiap konversi lifecycle.
- Contoh forecast: kas awal 50, expected receipts 40, supplier remaining 30, payroll 10, rent 5, tax due 2 menghasilkan closing 43. Jika 20 dari commitment menjadi AP, total obligation supplier tetap 30, bukan 50.

## A13 bank reconciliation dan file

Impor ulang file tidak menambah statement rows/cash. Dua transaksi sah dengan tanggal/nominal identik tetap dua transaksi. Matching satu-ke-banyak, banyak-ke-satu, split fee, transfer dua rekening, refund dan reversal reconcile. Import tidak mem-posting cash sebelum konfirmasi source baru. Unmatch mempertahankan audit dan journal cash asal.

Private upload/download diuji untuk unauthorized, scope, MIME/size, metadata/file mismatch, checksum, missing blob dan backup restore. Bukti dapat ditelusuri dari source ke journal tanpa duplikasi file. Tidak ada public passport/payment-proof URL.

## A14 UX dan security

Owner dapat membuat satu perjalanan/order, menerima pembayaran, mencatat biaya, membayar supplier, menyelesaikan kasbon, membaca profit dan menutup bulan tanpa input debit/kredit. Uji desktop/tablet/mobile, keyboard, no dead button, loading/error/retry, refresh dan direct link.

Matrix role diuji di endpoint, aggregate, detail dan export. Mode tim menjaga maker/checker. Mode owner tunggal hanya berjalan melalui pengaturan/kapabilitas sah dan audit, bukan client flag; tidak butuh dua akun palsu. Payroll/tax/bank dan client/vendor data tidak bocor.

## A15 migrasi dan release

Lulus seluruh checklist dokumen 09 termasuk opening/subledger matching, no replay cash, crossing cutover, read-only preview, backup+blob restore, schema drift dan resumed migration. Existing tests tetap lulus; fixture acceptance lama tidak diam-diam ditulis ulang hanya untuk menyesuaikan bug baru.

Quality evidence mencakup backend typecheck, tes engine yang diwajibkan, frontend tests, typecheck app yang nyata, lint dan full build exit 0. Jika baseline issues tetap ada, beri status yang akurat dan unresolved work; jangan menandai release siap penuh. Browser UAT harus memakai backend nyata terisolasi, bukan mock data yang menyembunyikan integration failure.
