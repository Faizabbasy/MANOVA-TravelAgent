# Aturan eksekusi dan definisi selesai

## Lingkup pekerjaan

Implementasikan kebutuhan paket ini di monorepo MANOVA dengan fitur existing sebagai fondasi. Wewenang coding lokal berasal dari prompt eksekusi pengguna, bukan dari status dokumen ini saja. Dokumen yang sedang dibaca adalah spesifikasi, bukan izin untuk tindakan eksternal.

Jangan melakukan reset/clean Git, menghapus untracked files, mengganti database, mengedit applied migrations, memperbarui dependencies massal, mengubah framework, menghapus RBAC atau menulis ulang `app/data/index.ts` secara massal. Perubahan tooling yang diperlukan harus sempit, beralasan dan diuji.

Gunakan bun di backend dan pnpm di frontend. Root npm scripts adalah wrapper yang sudah ada; jangan menambah lockfile package manager lain. Jangan mengubah `.env` atau mengungkap secrets; konfigurasi baru didokumentasikan di `.env.example` tanpa nilai nyata.

Simpan perubahan user. Commit/push/PR/deploy hanya bila diperintahkan pengguna atau ada otorisasi sesi yang jelas. Jika membuat commit, perubahan satu fitur API+UI harus koheren sesuai aturan repository.

## Aturan accounting yang tidak boleh dilanggar

1. Tidak ada journal dari frontend watcher atau kalkulasi authoritative di browser.
2. Tidak ada revenue otomatis dari invoice/Won/DP tanpa policy fulfillment yang sesuai.
3. Tidak ada paid otomatis dari project closed, task completed, approval, atau upload bukti.
4. Tidak ada duplicate source uang, invoice, cost, overhead, advance, refund atau recognition.
5. Tidak ada uang dengan floating point; policy/rounding/version harus dapat diaudit.
6. Tidak ada tax unknown dianggap nol, semua kontrak dianggap prinsipal atau semua trip dianggap delivered saat checkbox dicentang.
7. Tidak ada posted journal diedit/dihapus; reversal dan adjustment memiliki referensi dan alasan.
8. Tidak ada bypass period lock lewat endpoint sumber, worker, backdated transaksi atau correction.
9. Tidak ada automatic write-off/selisih ke akun lain hanya agar laporan reconcile.
10. Tidak ada data lokal-only yang menjadi source of truth financial posting.
11. Tidak ada penurunan akses role Admin/client/vendor untuk mempermudah integrasi.
12. Tidak ada label “laba bersih final”, “file terunggah”, “pembayaran sukses” atau “pajak dilaporkan” tanpa fakta pendukung.

## Perubahan API dan frontend

Update DTO, typed endpoints, composables, all consumers, roles dan tests bersama. Pertahankan deep links dan halaman preview. Aggregate status-only Admin tidak boleh membocorkan amount lewat endpoint baru. Siapkan loading, unavailable, partial/provisional, error/retry dan empty states yang berbeda.

Pakai source-action flow dengan source/ledger atomicity. Jika aksi otomatis hanya menciptakan draft karena evidence belum cukup, UI menjelaskan bahwa draft belum memindahkan uang/mengakui laba. Jangan memaksa owner menyetujui ulang jurnal deterministik setelah mengonfirmasi transaksi sumber yang sama.

## Pengujian yang proporsional

Tidak perlu menjalankan seluruh suite lama yang memakan waktu lama setelah setiap edit. Jalankan targeted tests ketika membuat perubahan, dan full relevant suites pada checkpoint integrasi/rilis. SQL baru wajib diverifikasi di PGlite dan PostgreSQL terisolasi sesuai aturan backend; jika engine belum tersedia, catat gap dan jangan klaim parity.

Jalankan backend typecheck/test, frontend tests, typecheck dengan cakupan app sebenarnya, lint, full build dan browser journey. Simpan exit code. Frontend root tsconfig refs/files kosong bisa membuat script tampak hijau; perbaiki jalur yang benar, jangan menggunakan false green sebagai bukti.

Build audit sebelumnya terhenti di tahap akhir. Investigasi compatibility/performance pada lingkungan aktual; timeout bukan build lulus. Jangan menjalankan build/lint duplikat secara bersamaan tanpa alasan. Hentikan proses pemeriksaan milik sendiri yang sudah tidak diperlukan dengan identitas tepat, bukan membunuh seluruh proses node/bun pengguna.

Jika baseline error masih ada, bedakan dari regresi dan perbaiki yang menghalangi feature/quality gate. Hindari proyek kosmetik ribuan baris. Release tetap belum siap penuh bila check wajib masih gagal; laporan tidak boleh menyembunyikannya.

## Penanganan keputusan dan hambatan

Keputusan implementasi rutin tidak memerlukan pertanyaan. Gunakan konfigurasi/policy fixtures untuk melanjutkan ketika nilai nyata belum ada. Ajukan pertanyaan singkat hanya untuk keputusan yang benar-benar menentukan perilaku finansial dan tidak dapat disimpulkan; jelaskan transaksi yang terdampak. Kerjakan bagian independen sambil menunggu.

Tidak ada instruksi untuk memakai subagent. Pilihan delegasi mengikuti otorisasi pengguna dan aturan tool/lingkungan yang benar-benar tersedia. Tidak perlu membuat chat/task baru atau automation untuk mengerjakan paket ini.

Jika environment menghalangi tindakan, simpan hasil aman dan laporkan blokir spesifik. Jangan mengganti workflow dengan mock yang menutupi kegagalan. Pekerjaan yang belum terverifikasi ditandai pending.

## Definisi selesai program

- Seluruh fase wajib dokumen 07 dan acceptance dokumen 08 selesai dengan evidence.
- Seluruh baris sumber dokumen 03 dipetakan dan tidak ada source active yang bypass accounting.
- Owner dapat menjalankan corporate/project dan retail/order tanpa mengulang input di accounting.
- Debit/kredit, source journals, cash book, subledger, project/order margin dan laporan perusahaan reconcile.
- Private files, identitas nyata, owner mode, policy setup, period close/reopen dan recovery bekerja.
- Real net-after-tax hanya tersedia untuk profil yang cukup; unknown/pending terlihat jelas.
- Required checks dan full build benar-benar lulus; UAT memakai backend server nyata terisolasi.
- Migration/cutover dry run, rollback constraints dan DB+blob restore terdokumentasi dan diuji.
- Tidak ada perubahan/deploy pada data produksi tanpa otorisasi yang sesuai.

Program dapat memiliki implementation complete tetapi activation blocked karena profil nyata belum divalidasi. Tulis dua status tersebut terpisah. Fitur bersyarat FX hanya ditandai not applicable bila bisnis memang tidak menggunakannya; jangan memakainya untuk menyembunyikan fitur wajib yang belum dibuat.
