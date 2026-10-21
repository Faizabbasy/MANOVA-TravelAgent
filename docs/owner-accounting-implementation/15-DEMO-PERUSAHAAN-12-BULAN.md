# Demo perusahaan 12 bulan — lokal dan tersimpan

Dataset fiktif versi `owner-year-v1`, November 2025–22 Oktober 2026. Ini data demo untuk fungsi existing, bukan buku perusahaan nyata. Kebijakan principal/fulfillment/metode hanya versi TEST_ONLY pada buku rehearsal/shadow; bentuk usaha dan pajak perusahaan tetap unknown.

## Menjalankan setelah clone

Pastikan Bun, Node dan pnpm terpasang. Pasang dependency dari root dengan `npm run install:all` (script memakai Bun di backend dan pnpm di frontend). Dari root, terminal pertama:

```powershell
npm run demo:year
```

Command ini hanya membuka `backend/.data/owner-year-demo-v1/database`, migrasi database demo tersebut, mengisi data sekali, lalu menjalankan API loopback3000. Ia tidak membaca DATABASE_URL aplikasi. Jika database sudah berisi data lain, seed menolak; tidak ada reset atau penghapusan. Eksekusi berikut memakai database yang sama tanpa mengulang transaksi. Menjalankan pada production ditolak.

Terminal kedua:

```powershell
npm run dev:frontend
```

Buka http://localhost:8080/login dan pilih Super Admin atau Finance. Jika port3000 sedang digunakan aplikasi lain, gunakan `npm run demo:year -- --port 3001`, lalu set `$env:NUXT_API_PROXY_TARGET='http://127.0.0.1:3001'` sebelum menjalankan frontend. Jangan menghentikan/menghapus database aplikasi untuk memberi tempat pada demo.

Private file bukti disimpan di `backend/.data/owner-year-demo-v1/private-blobs`. Database dan file lokal tidak ikut Git; kode seed ikut repository bila pengguna melakukan commit/push sendiri. Setelah clone, command yang sama membuat kondisi awal cerita yang sama. Input pengguna sesudahnya tetap tersimpan setelah restart.

## Isi dan cara memperagakan

- 40 project histori existing dengan invoice customer/supplier, penerimaan DP, pelunasan, pembayaran terlambat, piutang dan utang terbuka.
- 3 rekening terverifikasi dan saldo awal accounting yang berasal dari rekening yang sama.
- Jasa diberikan/diterima dan pencocokan invoice supplier secara eksplisit; invoice/uang masuk saja tidak dijadikan laba.
- Biaya software/pemasaran bulanan dan transfer cadangan dengan biaya bank.
- Payroll historis memakai approve+payment asli; bulan berjalan belum ditandai paid tanpa pembayaran.
- Kasbon, bukti biaya, sisa uang staf dan reimbursement yang dibayar sebagian.
- Satu pembelian aset dan penyusutan, pinjaman dan cicilan pokok/bunga, sewa prepaid dan pembebanan bulan yang telah selesai.
- Rekening koran sintetis sepanjang cerita pada rekening yang mempunyai mutasi: sebagian besar Cocok, beberapa baris Oktober Belum cocok untuk latihan. Ada dua baris bank-only (biaya admin12500 dan setoran belum diidentifikasi3juta) yang memerlukan review; impor tidak membuat uang baru. Rekening tanpa mutasi tidak diberi transaksi bank buatan.

Di Laporan & Cek Bulanan, pilih **dari 2025-11-01 sampai 2026-10-22** untuk melihat seluruh cerita. Tampilan bulan berjalan tetap menampilkan Oktober. Data lama dapat ditemukan pada filter tanggal/semua status di daftar transaksi. Pajak dan komisi lanjutan tidak dibuat seolah sudah diimplementasikan; laba setelah pajak tetap belum tersedia.

Pada Cocokkan Rekening Koran, pilih DEMO-BCA dan periode Oktober2026 untuk mencoba kandidat pencocokan. Baris historis sudah dicocokkan oleh fixture demo. Konfirmasi pencocokan tidak menambah kas/jurnal; Catat dari baris ini adalah tindakan sumber baru dan memang menambah transaksi setelah dikonfirmasi. Rerun `demo:year` menambahkan revisi rekening koran sekali pada demo versi awal tanpa mengulang cerita atau mengubah input pengguna. Perubahan pencocokan sesudah itu dipertahankan.

Uji dengan dua akun: Finance dapat menjalankan alur keuangan, Admin operasional tidak dapat membaca nilai Finance. Untuk demo client jangan membuka login Super Admin sekali klik ke internet tanpa pembatasan akses.
