# Lingkup produk dan keputusan bisnis

## Tujuan produk

Owner mencatat kejadian bisnis sekali di fitur asal. Sistem membentuk tagihan, komitmen, pembayaran, pengakuan pendapatan/biaya, jurnal, rekonsiliasi dan laporan sesuai kewenangan serta tahap kejadian. Sistem menjelaskan data yang belum lengkap, bukan menampilkan kepastian palsu.

Tiga angka utama dibedakan: saldo kas, laba bisnis, dan proyeksi dana yang dapat digunakan setelah kewajiban serta cadangan. Proyeksi terakhir bukan jaminan keamanan, bukan saldo bank, dan harus menampilkan horizon dan asumsi.

## Keputusan yang sudah berasal dari pengguna

1. Accounting harus mudah digunakan pemilik bisnis tanpa tim accounting tetap.
2. Integrasi terutama dengan Project Management dan seluruh sumber transaksi lain adalah cakupan wajib.
3. Otomatisasi mengurangi input ulang, bukan hanya menambah laporan atau menu jurnal.
4. Laba perusahaan dan keuntungan trip harus dapat dijelaskan sampai transaksi asal.
5. Pencatatan biaya kantor tidak dipaksa masuk project perjalanan.
6. Claude Code akan mengeksekusi implementasi; dokumen ini bukan implementasi.

## Cakupan wajib

- Semua alur project existing, empat jenis booking, peserta/Group Trip, change request, cancellation/refund, supplier dan biaya lapangan.
- B2C standalone tetap dapat ditagih, diterima pembayarannya, diberi biaya, dikoreksi dan direfund tanpa project dummy.
- Accounting otomatis berpasangan, saldo awal lengkap, jurnal koreksi, periode dan keterlacakan sumber.
- Pendapatan per pemenuhan jasa; billing dan cash terpisah; dukungan peran prinsipal, agen, dan kontrak campuran pada level komponen yang relevan.
- Komitmen supplier, biaya yang sudah terjadi namun invoice belum datang, penggantian accrual dengan invoice aktual, uang muka dan alokasi.
- Payroll, komisi, kasbon, reimbursement, petty cash, recurring expense, aset/penyusutan, prepaid expense, pinjaman dan modal/penarikan sesuai bentuk entitas.
- Rekonsiliasi bank CSV minimum, split dan pembayaran gabungan, impor tahan duplikat, antrean pengecualian.
- Pajak berbasis profil dan tanggal berlaku, bukti potong, pencatatan kewajiban/pembayaran, ekspor yang tervalidasi formatnya.
- Laporan keuangan, laba project/order, forecast lengkap, kelengkapan data, penutupan project dan periode.
- Penyimpanan file asli privat, identitas owner nyata, pemulihan akses, backup DB dan file yang dapat dipulihkan.
- IDR terlebih dahulu. Transaksi luar negeri/multi-currency adalah modul bersyarat: bila bisnis menggunakannya, modul ini wajib sebelum tipe tersebut diaktifkan sebagai supported. Jangan menerima transaksi asing seolah-olah IDR atau mengklaim dukungan hanya karena ada field currency.

## Cakupan yang tidak perlu dibesarkan

Integrasi langsung GDS/BSP, bank API, payment gateway, WhatsApp/email, OCR/AI, filing pajak langsung, multi-company consolidation dan native mobile tidak wajib untuk versi inti. Siapkan batas integrasi dan impor/ekspor yang benar. Jangan membuat kredensial, simulasi sukses provider, atau menganggap pencatatan sebagai bukti transaksi eksternal berhasil.

Jika RFQ/komoditas dan pembelian lain dipakai untuk transaksi finansial, persistensikan minimum lifecycle, harga, supplier, penerimaan dan linkage yang diperlukan. Fitur marketplace, pencarian supplier atau promosi lanjutan di luar lingkup. Perbaikan public lead intake dapat dilakukan sebagai dependency penjualan; jangan membiarkan lead finansial baru hanya hidup di browser.

## Keputusan yang belum diberikan

Isi register pada dokumen 11. Pisahkan keputusan coding yang dapat ditentukan sendiri dari kebijakan keuangan nyata.

| Keputusan | Sikap saat implementasi |
|---|---|
| Bentuk usaha dan standar accounting | Buat profil terkonfigurasi; jangan otomatis menyatakan semua usaha memakai SAK EMKM atau PSAK tertentu |
| Model prinsipal/agen tiap produk/kontrak | Simpan keputusan beserta alasan, effective date dan versi. Unknown menahan posting pengakuan terkait, bukan ditebak dari nama produk |
| Pengakuan jasa paket lintas bulan, tiket/fee, MICE | Perlu kebijakan per performance obligation; gunakan profil fixture untuk tes saja |
| Status pajak dan perlakuan tiap jenis transaksi | Tidak ada tarif hardcoded universal, tidak ada tax unknown dianggap nol |
| Sumber dan waktu hak komisi | Mendukung revenue, margin atau collected basis sesuai kebijakan; paid hanya dari settlement nyata |
| Cutover dan saldo awal | Gunakan rehearsal fiktif; jangan menyusun saldo nyata dari tebakan fixture |
| Cadangan kas dan alokasi overhead | Tampilkan sebagai konfigurasi manajemen, bukan aturan statutory |
| Mode owner tunggal atau tim | Bangun mode jelas; kebijakan existing maker/checker tetap berlaku sampai konfigurasi mode yang sah diaktifkan |
| Metode penyusutan, kapitalisasi, prepaid, impairment | Kebijakan versioned; nilai demo bukan default produksi yang diam-diam aktif |

Lanjutkan kode, UI konfigurasi, migrasi, dan pengujian fixture ketika keputusan belum tersedia. Tahan aktivasi posting nyata untuk tipe yang terdampak dan ajukan pertanyaan yang spesifik hanya bila pekerjaan dependen tidak bisa dilanjutkan. Jangan berhenti setiap fase untuk meminta izin rutin.

## Makna otomatis

- Catatan turunan yang deterministik boleh terbentuk otomatis.
- Kejadian tanpa fakta yang cukup menghasilkan draft atau antrean review, lengkap dengan asal dan alasan.
- Auto-issue invoice hanya berdasarkan kontrak/termin dan kebijakan automation yang diaktifkan. Default awal draft; owner dapat memilih penerbitan otomatis per jenis kejadian setelah setup.
- Auto-post jurnal setelah kejadian sah memenuhi aturan dan profil accounting aktif. Jurnal bukan input wajib tambahan bagi owner.
- Uang bergerak saat pembayaran aktual diverifikasi/terkonfirmasi melalui alur yang sah, bukan karena tombol selesai di project.
- Menjadwalkan, menyetujui, melaksanakan, membayar, merekonsiliasi dan menutup adalah kejadian berbeda.

## Referensi untuk validasi kebijakan

Per 21 Oktober 2026, rujukan berikut membantu validasi, bukan menetapkan profil perusahaan pengguna:

- [IAI SAK EMKM pendapatan dan beban](https://www.iaiglobal.or.id/v03/files/file_sak/emkm/files/basic-html/page43.html): penerimaan sebelum jasa diberikan dan hubungan keagenan perlu perlakuan tersendiri.
- [IAI SAK Entitas Privat efektif 2025](https://web.iaiglobal.or.id/SAK-EP-Efektif/SAK%20Entitas%20Privat%20Efektif%20Per%201%20Januari%202025): kerangka laporan, pendapatan, aset, imbalan kerja, pajak dan valuta asing.
- [IAI buletin prinsipal dan agen](https://web.iaiglobal.or.id/assets/files/file_berita/Buletin_Implementasi_Volume_2.pdf): keputusan mengikuti substansi dan kerangka yang berlaku, bukan label produk.
- [JDIH PMK 11 tahun 2025](https://jdih.kemenkeu.go.id/dok/pmk-11-tahun-2025) dengan perubahan termasuk PMK 53/2025: verifikasi teks dan status terbaru saat mengimplementasikan aturan pajak travel.
- [DJP Coretax SPT](https://www.pajak.go.id/id/reformdjp/coretax-spt): persiapan dokumen dan kanal impor harus mengikuti skema aktif.

Validasi kebijakan awal dan kasus khusus dapat melibatkan profesional eksternal tanpa membuat produk bergantung pada tim accounting harian. Jangan menyatakan produk otomatis memenuhi seluruh kewajiban hukum/pajak hanya karena ekspor berhasil.
