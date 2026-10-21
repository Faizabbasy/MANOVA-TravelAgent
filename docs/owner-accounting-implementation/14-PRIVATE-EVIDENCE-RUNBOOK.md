# Bukti asli privat dan pemulihan lokal

Status implementasi/checks terbaru mengikuti dokumen11. Kode lokal ini tidak mengaktifkan penyimpanan atau buku produksi.

## Penggunaan

Panel **Bukti asli privat** berada di invoice customer yang sudah terbit, invoice supplier, mutasi, refund, klaim supplier, kasbon/biaya staf, biaya kantor/prepaid, dokumen dan detail dokumen traveler. CR/quotation/travel request memakai panel lampiran existing. Invoice draft menautkan evidence pada sumber CR/dokumen; tidak menghapus sumber berfile demi koreksi.

Pilih file asli, lalu **Unggah file asli**. PDF/JPEG/PNG/WebP maksimal10MB; server memeriksa magic bytes, MIME, ukuran dan SHA256. Nama referensi/attachment legacy tidak dianggap file asli. File tidak mengubah nominal, tidak menyatakan pembayaran diverifikasi, dan tidak mengakui jasa/biaya.

Default internal. Berbagi ke customer hanya tersedia pada sumber ber-customer dan dipilih eksplisit; client tetap dibatasi party sumber. Bukti finansial internal tidak dapat dibuka Admin/client lewat endpoint file. Bukti bayar client dilampirkan setelah referensi pembayaran tersimpan; Finance melihatnya di dialog verifikasi. Verifikasi pembayaran tetap lewat transaksi existing.

Invoice/proof/alokasi pembayaran menampilkan file asli yang sama pada sumber terkait. Tidak mengunggah ulang file untuk mutasi atau membuat cash baru. Download melalui API authenticated dengan disposition attachment, nosniff dan no-store. File hilang/korup menghasilkan error yang dapat diretry; metadata/jurnal tidak diganti agar terlihat berhasil.

## Penyimpanan

`BlobStore` memiliki memory TEST dan direktori privat lokal. Default development: `backend/.data/private-blobs`; bukan static web root. `PRIVATE_FILE_ROOT` dapat berisi path absolut privat. Direktori public/.output ditolak. Produksi tanpa root/provider eksplisit menolak upload/download dengan503. Provider/retensi/backup produksi belum dipilih dan tidak menjadi default dari fixture.

Metadata immutable di `private_files`, storage key opaque. Sumber berfile tidak dihapus; koreksi memakai lifecycle sumber. Ulang key mengembalikan hasil sama; hash sama pada sumber sama tidak membuat file kedua. Pada unknown commit outcome, bytes dipertahankan agar transaksi yang ternyata commit tidak kehilangan file. Orphan akibat crash perlu direkonsiliasi; tidak ada penghapusan otomatis/retensi diam-diam.

## Verifikasi dan backup

Perintah operator berikut tidak menjalankan migrasi atau menghapus database/file. Gunakan hanya lingkungan/sumber yang telah ditentukan dan direktori backup privat. Kredensial mengikuti environment, jangan taruh pada command line atau log.

```powershell
# Dari backend; periksa APP_ENV/DATABASE_URL/PRIVATE_FILE_ROOT yang dipilih secara aman dahulu.
bun run scripts/private-evidence.ts verify
bun run scripts/private-evidence.ts backup --out C:/MANOVA-private/backups
```

Backup mengambil snapshot DB existing dahulu, lalu membaca referensi file append-only. Manifest dan DB snapshot memiliki checksum; setiap blob diverifikasi sebelum disalin. Upload konkuren yang selesai setelah snapshot boleh menjadi superset dalam manifest; restore menyalin hanya referensi yang ada dalam DB hasil snapshot. Backup yang tidak lengkap tidak memiliki manifest sukses. Jangan menyebut DB-only backup sebagai backup bukti lengkap.

## Restore terisolasi

Tetapkan `PRIVATE_RESTORE_TARGET_URL` melalui environment ke target baru/kosong yang berbeda dari aplikasi aktif; root file tujuan juga harus kosong. PostgreSQL memerlukan pg_dump/pg_restore (`PG_BIN` bila perlu). Jangan menjalankan contoh pada database/root aplikasi aktif.

```powershell
# PRIVATE_RESTORE_TARGET_URL wajib sudah menunjuk target rehearsal baru; tidak ditulis di command arguments.
bun run scripts/private-evidence.ts restore --bundle C:/MANOVA-private/backups/BUNDLE_YANG_DIPILIH --blob-root C:/MANOVA-private/rehearsal-empty-blobs
```

Restore memverifikasi manifest, snapshot dan seluruh blob sebelum menulis target DB. Restore DB menolak target tidak kosong; file tujuan tidak pernah ditimpa. Hasil DB direkonsiliasi lagi ke manifest dan bytes. Jika restore terhenti, pertahankan evidence untuk diagnosis; jangan reset/hapus target secara otomatis. Jangan arahkan aplikasi ke target sebelum seluruh integrity/source/security checks dan instruksi aktivasi yang sesuai.

Tests sintetis PGlite membuktikan DB+blob restore, scoped download, anonymous/Admin denial, target berisi ditolak dan blob korup ditolak. Rehearsal fisik PostgreSQL17 + directory blobs juga telah lulus (`checkpoint11-private-postgres-recovery-final.log`): source invoice/migration checksum, bytes asli, scoped session, refusal target berisi di schema lain dan bundle korup. Guard target kosong memeriksa semua schema pengguna serta function, bukan hanya tabel pada search_path.

Rehearsal tersebut memakai `scripts/private-evidence-postgres-rehearsal.ts`, khusus `APP_ENV=test`, tanpa `TEST_DATABASE_URL`, pada cluster scratch tetap127.0.0.1:55439 dengan role accounting_test. Script membuat tiga database berawalan `private_src_`, `private_dst_`, `private_occupied_` dengan suffix acak, tidak menghapus database atau artefak. Jangan mengganti target script menjadi database aplikasi. Provider/ACL/retensi dan recovery produksi tetap membutuhkan konfigurasi serta validasi terpisah; keberhasilan rehearsal bukan aktivasi produksi.
