# Pengalaman pemilik bisnis dan pengaturan akses

## Prinsip interaksi

Owner melihat aktivitas bisnis, hasil dan pengecualian. Debit/kredit, COA dan GL berada pada detail pemeriksaan, bukan form harian wajib. Gunakan bahasa Indonesia, label spesifik, angka yang dapat dibuka ke sumber, dan action yang menyelesaikan masalah.

Reuse layout, komponen, nuxt routes, validation, save gates dan project workspace existing. Jangan redesign seluruh aplikasi. Tambahkan komponen shared hanya ketika dipakai beberapa alur. UI wajib membaca server dan pulih setelah refresh, pindah perangkat, pergantian user dan direct deep link.

## Struktur navigasi

Sederhanakan area keuangan menjadi lima kelompok pekerjaan. Ini grouping UX; route lama dan bookmark harus tetap berfungsi melalui alias/redirect yang diuji.

| Kelompok | Isi utama |
|---|---|
| Ringkasan Bisnis | Laba, saldo uang, proyeksi kas, tagihan penting, kualitas data dan tindakan hari ini |
| Tagihan dan Pembayaran | Customer/vendor, termin, AR/AP, bukti bayar, refund, collection dan payment approval |
| Transaksi Uang | Bank/cash ledger existing, penerimaan, pembayaran, transfer, bank import dan pencocokan |
| Kasbon dan Bukti Biaya | Advance staf, pertanggungjawaban, reimbursement dan bukti asal |
| Laporan dan Cek Bulanan | P&L, posisi aset/utang/modal, arus kas aktual, review periode, export dan detail accounting |

Biaya dan keuntungan perjalanan tetap di project/order yang sama, bukan project accounting kedua. Advanced settings memuat profil, akun, policies, recurring items, aset, pinjaman dan akses.

## Form harian

Action utama: Customer Bayar, Bayar Supplier, Catat Biaya, Beri Uang Jalan, Pertanggungjawabkan Uang Jalan, Bayar Gaji, Beli Aset, Tambah Modal atau Catat Pinjaman. Pilihan yang tersedia mengikuti sumber/capability dan kondisi transaksi.

- Prefill customer/vendor/project/order/invoice/amount dari tempat action dibuka.
- Minta hanya tanggal, rekening, nominal aktual, bukti dan informasi yang belum diketahui.
- Jelaskan konsekuensi: “Melunasi invoice X”, “Masih uang muka supplier”, “Belum menambah keuntungan”.
- Pembayaran parsial, lebih bayar, biaya transfer dan potongan pajak memiliki alur jelas; jangan menyembunyikan sisa lewat write-off otomatis.
- Tidak ada tombol paid yang sekadar menulis status tanpa cash settlement/reference terverifikasi.
- Upload/pencocokan menghasilkan usulan bila belum pasti; owner mengonfirmasi, bukan sistem menebak akun sensitif.
- Koreksi memakai “Batalkan pencatatan” atau action khusus dengan alasan dan preview dampak, bukan edit posted amount.

## Ringkasan project

Gunakan area keuangan existing dan tambahkan panel:

1. Nilai penjualan versus recognized revenue.
2. Budget, commitment, actual recognized cost dan perkiraan biaya akhir.
3. Customer harus bayar, supplier harus dibayar, deposit dan kasbon tersisa.
4. Margin estimasi, contribution actual dan hasil setelah alokasi overhead opsional.
5. Kejadian belum lengkap dengan PIC, deadline, dampak dan deep link.
6. Timeline “SO dibuat → jasa diterima → invoice → pembayaran → pencocokan → jurnal”.

Tampilkan status operasional, accounting review dan cash settlement secara terpisah. Jangan memakai satu badge Lunas untuk seluruh keadaan. Admin tanpa akses Finance tetap hanya menerima status yang diizinkan; jangan memperlihatkan angka sensitif melalui panel baru.

## Laba dan kualitas data

Setiap angka menunjukkan periode, basis, currency dan status estimasi/sementara/ditutup. Jika pajak belum lengkap, label “Laba sebelum pajak” atau “Laba sementara”, bukan net profit pasti. Unknown tidak menjadi nol. Pembanding sebelum cutover tidak tersedia kecuali histori tervalidasi.

Perkiraan dana bebas menampilkan kewajiban dalam horizon, cadangan, expected receipts dan asumsi. Jangan mengurangi DP customer dan kewajiban supplier yang merepresentasikan dana sama dua kali; tunjukkan komponen dan rule coverage. Angka ini bukan saran distribusi laba/dividen otomatis.

## Antrean pekerjaan dan review bulanan

Antrean harian mencakup bank unmatched, bukti bayar, invoice overdue, supplier due, kasbon belum selesai, perubahan margin dan posting exception. Satu item menampilkan masalah, sumber, nominal/dampak jika tersedia, pemilik, tanggal dan action.

Cek bulanan berurutan: bank/kas cocok, missing source/fulfillment lengkap, AR/AP/advance/kasbon ditinjau, expense payroll/commission/asset/tax lengkap, trial balance/control account cocok, review hasil, tutup periode. Jelaskan alasan blocker dalam bahasa bisnis dan arahkan ke fitur sumber.

Piutang/utang sah yang belum jatuh tempo tidak memblokir close periode hanya karena belum dibayar. Supplier cost yang belum punya invoice dapat memakai accrual terotorisasi; jangan memaksa membayar atau membuat invoice palsu untuk menutup bulan.

## Mode owner tunggal dan mode tim

Keinginan owner bekerja sendiri adalah kebutuhan produk. Buat konfigurasi mode eksplisit yang server-side, diaudit dan dapat direview. Reuse super-admin/kapabilitas owner sah; hindari role baru bila tidak diperlukan.

- Mode tim mempertahankan separation of duties dan maker/checker existing, termasuk saldo awal.
- Mode owner tunggal dapat memiliki alur konfirmasi mandiri yang jelas untuk tindakan yang diizinkan kebijakan mode tersebut. Perubahan perilaku maker/checker memerlukan ADR dan tes terpisah; tidak cukup menghapus cek aktor berbeda.
- Owner mengaktifkan mode dengan penjelasan konsekuensi, konfirmasi saldo terhadap rekening koran, reason/evidence dan audit. Jangan meminta owner membuat dua akun seolah dua orang.
- Jangan mengaktifkan mode owner secara otomatis pada database tim yang sudah berjalan.
- Penutupan/reopen, perubahan rekening tujuan supplier, adjustment besar dan policy changes tetap memerlukan konfirmasi eksplisit dalam UI, reauthentication bila sesuai desain dan audit.
- UI confirmation bukan permission chat untuk setiap langkah pengembangan. Ini kontrol produk bagi transaksi nyata.

Capability minimum: view-business-finance, view-posting-detail, manage-accounting-setup, post-source-money, review-reconciliation, close-period, reopen-period, approve-adjustment, view-payroll, manage-private-proof. Audit mapping terhadap tiga role internal sekarang; jangan memberi Admin seluruh Finance hanya agar panel baru tampil.

## Kriteria kualitas UX

Verifikasi browser desktop 1440, tablet 768, mobile 390; keyboard, dialog focus, accessible names, error recovery, loading/empty/filter-empty, double-click dan network retry. Uji owner dapat menyelesaikan perjalanan contoh dan cek bulanan tanpa memasukkan jurnal atau membuka database.

Keberhasilan produk: tidak ada input ulang fakta yang sudah lengkap; setiap pengecualian dapat diselesaikan dari sumber; saldo/laba memiliki arti yang jelas; tidak ada label sukses ketika file, pembayaran eksternal atau posting sebenarnya gagal.
