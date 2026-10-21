# Migrasi saldo awal cutover dan pemulihan

## Tujuan cutover

Buku baru mulai pada tanggal yang dipilih dengan saldo yang telah direkonsiliasi. Cash, invoice, AR/AP, uang muka dan histori existing tidak boleh bergerak lagi hanya karena accounting diaktifkan. Schema migration dan book activation adalah proses berbeda.

Jangan menghapus `.data`, reset database, mengganti data user dengan seed, atau menjalankan rollback destruktif pada database aktif. Semua rehearsal menggunakan database terisolasi. Jangan menyalin `.env`, credential, paspor atau bukti transfer nyata ke laporan/Git.

## Tahap persiapan

1. Identifikasi environment, database target, book status dan sumber kebenaran setiap saldo. Tampilkan identitas target tanpa membocorkan secret.
2. Backup database beserta checksum dan file privat. Uji restore ke target kosong terisolasi; backup yang belum diuji pulih tidak cukup.
3. Inventarisasi schema/version, rows dan nilai kontrol; simpan snapshot read-only yang aman.
4. Validasi profil bisnis, currency, policy, metode opening dan tanggal cutover. Jangan memilih tanggal dari DEMO_REFERENCE_DATE.
5. Pastikan ada periode terbuka, source hook lengkap, jurnal corrections dan prosedur recovery.

## Dua strategi yang harus dibedakan

Strategi utama yang direkomendasikan adalah prospective cutover dengan opening balance yang tervalidasi. Histori operational/Finance lama tetap dapat dibaca dengan labelnya, tetapi bukan GL lengkap sebelum cutover.

Historical backfill hanya dipilih bila data, fulfillment dan kebijakan historis cukup. Jalankan dry run, gunakan source identity dan policy yang sesuai, bandingkan hasil, lalu aktivasi setelah verifikasi. Jangan menjalankan source cash commands ulang saat melakukan backfill journal. Jangan mengisi kekurangan dengan current contract values atau status project sekarang seolah itu fakta historis.

## Saldo yang wajib dipetakan

| Saldo | Sumber dan verifikasi |
|---|---|
| Bank/petty cash | Account ledger/rekening koran dan tanggal cutover yang sama |
| AR/AP | Outstanding per customer/vendor, invoice, project/order, currency dan aging |
| Customer advance/contract liability | Pisahkan unallocated cash dari invoiced-but-unearned; jangan hanya memakai `v_unallocated_payments` |
| Supplier advance/prepaid/accrued costs | Per supplier dan jasa, status penerimaan, invoice dan allocation |
| Refund payable dan supplier claim | Kasus sah yang belum settled, dengan sumber payment/credit yang sama |
| Staff advances/reimbursements | Pemegang kas, evidence, outstanding dan due date |
| Payroll/commission/tax liabilities atau credits | Kewajiban dan pembayaran aktual; status legacy paid saja tidak cukup |
| Aset/accumulated depreciation/prepaid opex | Register dan dokumen per aset/periode |
| Pinjaman/modal/saldo laba | Rincian principal, interest, entity treatment dan saldo opening yang disetujui |

Opening entry harus balanced. Opening suspense boleh dipakai hanya sebagai item yang belum diselesaikan dan menahan klaim siap/final; jangan otomatis memasukkan selisih ke retained earnings tanpa dasar. Saldo laba sebagai balancing figure memerlukan opening plan dan verifikasi bahwa seluruh aset/liabilitas telah lengkap.

## Opening plan dan aktivasi

Implementasikan preview read-only yang menghasilkan plan ID, cutover, source snapshot/version/hash, amounts, mapping, exceptions, projected journal dan reconciliation. Owner/reviewer melihat ringkasan bahasa bisnis dengan drilldown.

Saat activation, cek ulang snapshot masih sama, lock profile/period/source window yang relevan, dan gunakan idempotent command unik. Source drift menolak activation dan meminta preview baru. Posting opening sekali; catat actor, evidence, profile/policy version dan audit.

Jangan menjalankan semua transaksi cash historis setelah kas opening dari saldo akhir sudah masuk. Untuk event crossing cutover, opening mencakup posisi sebelum cutover; hanya kejadian ekonomis sesudahnya diposting sebagai delta. Buat registry mapping legacy sources ke opening balance agar alokasi/settlement sesudah cutover tidak menimbulkan saldo negatif palsu atau pengakuan ulang.

Accounting boleh tetap off/shadow sampai syarat aktivasi terpenuhi. Aktifkan hanya tipe yang policy dan hook-nya lengkap; jangan menyebut seluruh accounting supported bila sebagian sumber masih bypass.

## Checklist rehearsal

- [ ] Migration up berjalan dari schema existing tanpa mengubah applied checksums.
- [ ] Existing application dan endpoint Finance masih kompatibel sebelum book diaktifkan.
- [ ] Preview tidak mengubah domain/cash/journal posted.
- [ ] Opening GL bank = cash existing; AR/AP/control accounts = subledger.
- [ ] Assets = liabilities + equity dan trial balance seimbang.
- [ ] Customer DP yang sudah dialokasikan ke invoice tapi jasa belum diberikan tetap masuk unearned position yang benar.
- [ ] Open project/order, late supplier invoice dan refund crossing cutover tersambung.
- [ ] Retry aktivasi, drift, interrupted process dan concurrent source action aman.
- [ ] Tidak ada cash baru dari import/backfill atau journal reconstruction.
- [ ] Report sebelum cutover tidak dibuat-buat; opening tidak menjadi revenue current month.
- [ ] Restore DB dan file menghasilkan saldo, fingerprint uang, ownership dan akses identik.
- [ ] Mode owner/tim, posting mandatory dan period lock bekerja sesudah restore.

## Rollback dan recovery

Sebelum ada posting baru, schema down hanya dijalankan pada scratch atau target yang terbukti aman dan didukung migrasi. Setelah posted journals ada, default recovery memakai perbaikan forward atau restore terkontrol dengan analisis kejadian setelah backup. Jangan menghapus jurnal untuk membuat versi lama start.

Migrasi down yang akan menghilangkan posted financial evidence harus menolak secara jelas atau memerlukan runbook terpisah dan backup. Identifikasi versi aplikasi yang memahami schema; existing migrator menolak drift/unknown schema.

Jika worker/outbox tertunda, replay event yang sama memperbaiki journal/read model tanpa mengulang source cash. Pending event tetap terlihat dalam completeness. Bila posting mandatory synchronous gagal, source transaction harus rollback, bukan dijalankan ulang secara manual sebagai expense lain.

## Produksi

Pisahkan status implementasi, kebijakan tervalidasi, UAT, dan deployment. Sebelum aktivasi nyata: policy decisions terisi, saldo awal disetujui, identitas nyata siap, file storage dan recovery tersedia, build/checks lulus, serta ada daftar tindakan cutover yang spesifik. Deploy/aktivasi database nyata memerlukan instruksi pengguna; jangan melakukannya hanya karena seluruh kode selesai.
