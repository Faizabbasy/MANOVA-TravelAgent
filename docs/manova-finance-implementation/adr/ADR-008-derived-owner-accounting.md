# ADR-008 — Accounting turunan dan aktivasi terpisah

Status: implementation in progress, 21 Oktober 2026. Otorisasi: permintaan pengguna pada sesi implementasi lokal paket owner-accounting; bukan izin cutover/deploy. Memperluas ADR-007 tanpa mengganti cash book, RBAC atau gate settlement existing.

`financial_transactions` tetap satu-satunya catatan perpindahan kas. Accounting mempunyai `accounting_books → accounts / periods / policies → events → journals → lines`, dan `posting_registry` untuk hasil posted/pending. Semua reference ID sumber dipertahankan. Service sumber memanggil accounting memakai `Queryable` transaksi yang sama. Tidak ada endpoint browser untuk memasukkan jurnal harian.

Satu badan usaha/buku per instalasi saat ini; mata uang IDR. Template akun adalah pemetaan awal, bukan kebijakan aktif. Kebijakan dibuat sebagai versi immutable/draft, dengan tanggal berlaku dan alasan. Kebijakan fixture TEST_ONLY hanya boleh mem-posting ke buku rehearsal. Profile/tax/recognition/cutover nyata tetap unknown sampai divalidasi. Migrasi tidak membuat buku. Setup API hanya dapat membuat produksi OFF atau rehearsal SHADOW; aktivasi produksi belum diekspos.

Posting mengunci buku, event identity, lalu periode dan journal. Period command menggunakan lock buku yang sama. Database memeriksa balancing saat transisi draft → posted, dimensi control account, tanggal, policy, reversal identik, serta melarang mutasi/truncate bukti posted. Registry unik per book/event/purpose; fingerprint membedakan replay identik dari nominal/fakta yang berubah. Reversal adalah journal baru yang menukar seluruh sisi dan dimensi original. Partial fulfillment kelak harus memakai identity sendiri dan batas kumulatif obligation; fondasi event tidak dengan sendirinya memenuhi batas kumulatif itu.

Semua cash insert ketika buku ACTIVE harus mempunyai hasil posting sebelum commit (deferred constraint trigger). Ini penjaga tambahan untuk jalur sumber yang belum di-hook, bukan pengganti orkestrasi service. Mandatory posting failure menggagalkan source, cash, audit dan klaim idempotency. SHADOW dapat menyimpan pending exception; tidak diklaim sebagai buku produksi. Trial balance rehearsal diberi label dan alasan opening/tax/pending. Sebelum cutover/off: amount unavailable/null.

Namespace `/accounting` memiliki pre-validation guard sendiri. Finance membaca detail; hanya Super Admin mengelola setup; Admin/client/vendor tidak menerima nominal accounting. Capability server dan frontend disinkronkan. Tidak mengubah maker/checker bank atau mengaktifkan single-owner: desain dan implementasi itu tetap Fase 7.

Fondasi tidak memberikan izin aktivasi seluruh tipe: invoice, recognition, refund, payroll, asset, tax, cutover dan close harus masing-masing lulus source integration dan acceptance. Lock periode rehearsal terpisah dari monthly close produksi yang memerlukan completeness/reconciliation. Down migration menolak ketika journal posted ada; pemulihan forward/restore terkontrol, bukan penghapusan evidence.

Quality tooling: root tsconfig frontend adalah solution references tanpa files; `vue-tsc -p tsconfig.json` tidak memeriksa app. Script diganti `nuxt prepare && vue-tsc --build --noEmit`. vue-tsc 3.3.13 dan vue-router 5.4.0 diselaraskan dengan Nuxt aktual 4.5.1 (dependency router ^5.2.0). Tidak menurunkan strictness atau mengecualikan app. Referensi: [Nuxt typecheck](https://nuxt.com/docs/api/commands/typecheck), [TypeScript project references](https://www.typescriptlang.org/docs/handbook/project-references), manifest Nuxt terpasang. Error source lama tetap menjadi pekerjaan quality gate, bukan false green.

## Addendum 21 Oktober 2026 — pemenuhan jasa, credit/refund dan klaim supplier (0047)

Keputusan teknis (bukan kebijakan keuangan produksi; D03/D04 tetap unknown):

- `service_fulfillments` adalah fakta Finance satu kali untuk "jasa diberikan" (customer) dan "jasa supplier diterima" (supplier), partial diperbolehkan, immutable kecuali void dengan alasan. Bukan invoice, bukan pembayaran, bukan status project. Batas kumulatif sisi customer = nilai kontrak/order atau tagihan sah terbit, yang lebih tinggi; diperiksa service dan trigger DB dengan lock baris kontrak.
- Turunan ledger dihitung dari saldo GL kontrak (sales order, atau project+customer) pada tanggal efektif: pemenuhan customer mengurangi contract liability lebih dulu, sisanya contract asset; invoice berikutnya mereklas contract asset ke AR sebelum menambah liability. Pemenuhan supplier melepas prepaid lebih dulu, sisanya accrued cost; invoice supplier menghapus accrual lebih dulu, lalu selisih menjadi direct cost hanya bila pemenuhan vendor ditandai selesai (`is_final`), selain itu prepaid. Pemenuhan yang dicatat mundur (backdated) memakai saldo per tanggalnya; presentasi gross antar-tanggal dapat berbeda bila urutan input tidak kronologis, posisi akhir tetap sama — dicatat sebagai keterbatasan untuk review periode.
- Credit note (`reduce_receivable` dan `refund_liability`) mengurangi contract liability lebih dulu dan hanya sisanya mengoreksi pendapatan diakui; refund settlement hanya Dr refund payable / Cr bank. Void credit note/pemenuhan/klaim = reversal eksak jurnal asal. Blok "credit/refund unsupported" 0046 diganti mandatory-posting trigger per sumber.
- `supplier_claims` (pemulihan biaya atau pengembalian deposit) terpisah dari refund customer. Deposit recovery memakai alokasi `payment_allocations` dari deposit yang sama (tidak ada kas baru); void klaim mengembalikan deposit melalui `allocation_counts()` pada `v_unallocated_payments` dan pengecekan alokasi; reversal deposit yang mendanai klaim aktif ditolak. Penerimaan dana supplier memakai kind `vendor_refund` existing: Dr bank / Cr supplier claim.
- Command sumber berada di namespace Finance (`/finance/fulfillments`, `/finance/supplier-claims`, `/finance/vendor-refunds`) dengan capability Finance existing dan Idempotency-Key; tidak ada role/capability baru. Status booking/SO ditampilkan sebagai prefill/bukti untuk dikonfirmasi owner, tidak pernah pengakuan otomatis.
- Down migration 0047 menolak bila fakta pemenuhan/klaim atau jurnal posted ada.

## Addendum 21 Oktober 2026 — dana staf, payroll, aset, pinjaman, dana owner (0048–0049)

- Satu buku kas tetap: kind baru di `financial_transactions` dengan link wajib (employee_id, payroll_run_id, asset_id, loan_id) daripada tabel kas
  tandingan. Laporan Finance lama menghitung pembayaran gaji dan bukti pengeluaran staf sebagai biaya; kasbon, aset, pinjaman dan dana owner tidak.
- Payroll: approve = beban bulan payroll + utang per karyawan (net); bayar = satu `payroll_payment` dari rekening. Status paid tanpa kas ditolak
  (trigger) kecuali baris legacy/demo berdasarkan provenance. API `POST /payroll-runs/:id/pay` berubah (body + Idempotency-Key), consumer HR diperbarui.
- Kasbon: posisi per karyawan (`v_employee_fund_balances`); bukti → biaya (project = biaya langsung, kantor = kategori dipetakan policy); kelebihan →
  utang reimbursement (akun 2165, ditambahkan ke buku yang ada oleh migrasi karena akun immutable). Bukti unik global.
- Aset dikapitalisasi lewat "Beli Aset" (kas); penyusutan bulanan idempoten per aset/bulan. Pinjaman dan cicilan memisahkan pokok/bunga. Dana owner
  mengikuti peran dari profil entitas; tidak ditebak.

## Addendum 21 Oktober 2026 — cek bulanan, retry pending, B2C standalone (0050)

- Tutup periode hanya dari checklist server tanpa blocker; tidak ada status `reviewed` karena guard posting mengunci setiap periode non-open.
  Retry pending menjalankan derivasi sumber yang sama dari snapshot beku; bukan editor jurnal.
- Order B2C mandiri ditagih pada dimensi sales order (invoice `project_id` null + check constraint), tidak memakai project dummy. Semua order
  menjadi paid hanya lewat konfirmasi DP/pembayaran Finance (sebelumnya order mandiri dapat diubah paid manual tanpa kas). Mengubah kontrak
  ADR-007/S6b secara eksplisit; consumer frontend diperbarui pada perubahan yang sama.

## Addendum 21 Oktober 2026 — rekonsiliasi rekening koran (0051)

- Rekening koran adalah bukti bank, bukan buku kas kedua: impor tidak mem-posting kas; pencocokan menautkan baris ke `financial_transactions`
  yang ada. Identitas baris tanpa referensi bank memakai nomor kemunculan per file sehingga transaksi identik yang sah tidak tergabung.
  Transaksi yang dibatalkan otomatis tidak dihitung cocok (dihitung saat baca), riwayat pencocokan tidak dihapus.

## Addendum 21 Oktober 2026 — prepaid kantor (0053)

- Aksi bisnis membayar biaya kantor di muka mencatat satu `financial_transactions.kind=prepaid_opex`, lalu jadwal manfaat immutable dengan FK unik ke pembayaran tersebut. Tidak memakai `expense` agar cash payment tidak menjadi biaya kantor langsung pada laporan legacy.
- Metode irisan ini `equal-months`, dipilih eksplisit dan memerlukan usable policy `prepaid_opex` dengan `settings.method` yang cocok. Ini konfigurasi teknik/fixture, bukan keputusan D09 produksi. Nominal dibagi dengan bigint; sisa berada di occurrence terakhir.
- Bulan manfaat yang telah berakhir menghasilkan occurrence unik `(prepaid_expense_id,period)` dan jurnal beban vs prepaid. Mandatory posting sinkron di active; shadow pending tetap tampak. Retry, audit, period lock dan opening mapping mengikuti mesin yang sama. Amortisasi tidak mem-posting kas.
- Satu query completeness menentukan bulan manfaat yang hilang untuk laporan, saldo awal dan cek bulanan. Saldo awal membawa sisa manfaat historis; pembebanan pasca-cutover mengurangi saldo itu tanpa mengulang kas. Pembayaran yang sudah diamortisasi tidak dapat direverse sebagai kas saja (guard API+SQL); correction lifecycle terpisah masih backlog.
- Pembayaran setelah awal manfaat, metode prorata/harian, prepaid dari AP, recurring obligation dan pengunggahan bukti asli belum didukung oleh irisan ini. Referensi bukti tidak ditampilkan sebagai file terunggah.

## Addendum 21 Oktober 2026 — recurring company accrual (0054)

- Rencana kontrak dan occurrence biaya yang terjadi adalah sumber persisten terpisah. Rencana hanya forecast. Occurrence immutable mengakui beban vs liability `company-accrued` (2115, vendor wajib); tidak mencatat uang.
- Role liability kantor dipisah dari accrued-cost project agar invoice supplier umum tidak menghabiskan accrual yang tidak terkait. Tautan satu invoice asli existing ke satu occurrence, vendor/company scope dan satu invoice aktif dijaga API+SQL. Invoice actual membersihkan estimasi sepenuhnya, selisih terhadap nominal actual masuk expense yang sama; payable memakai invoice actual. Payment/allocation tetap existing.
- Pemetaan kategori memerlukan usable policy `company_expense.settings.classifications`, saat ini hanya role office-expense yang diizinkan. Tidak memilih pajak atau klasifikasi produksi secara implisit. Shadow pending/retry, active source rollback, void exact original dan period locks memakai mesin existing.
- Forecast memilih plan, expense belum diinvoiced, atau AP satu kali. Source opening membawa accrual sebelum cutover; invoice berikutnya memakai opening registry dan mem-posting delta. Completed contract month yang belum direview menjadi exception laporan/close/opening.
- UI source business actions di funding menggunakan vendor/jadwal/invoice existing; tidak ada input akun debit-kredit. Split/multi-invoice, prepaid via AP dan private evidence files tetap backlog.
