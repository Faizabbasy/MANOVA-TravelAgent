# Prompt mulai Claude Code

Salin teks berikut ke Claude Code yang dibuka di root `C:\Users\Syafiq Saputra\MANOVA-TravelAgent`.

---

Implementasikan accounting otomatis yang mudah digunakan owner pada project MANOVA ini berdasarkan seluruh paket `docs/owner-accounting-implementation/`.

Baca `CLAUDE.md` root, instruksi paket backend/frontend dan AGENTS.md yang berlaku. Mulai dari `docs/owner-accounting-implementation/00-START-HERE.md`, kemudian baca dokumen 01 sampai 11. Perbarui baseline terhadap kode aktual; jangan menganggap catatan audit lama sebagai hasil tes baru.

Tujuan saya: owner travel agent tanpa tim accounting tetap dapat menjalankan pencatatan harian melalui action bisnis di MANOVA. Project Management, booking, supplier, penjualan, Finance, HR, inventory dan biaya kantor harus mengalir ke accounting tanpa input ulang. Sistem harus menghasilkan laba project/order, laba perusahaan, posisi kas/utang/aset, rekonsiliasi, dan penutupan bulanan yang dapat ditelusuri.

Pertahankan fitur existing. Jangan membuat accounting mock, project dummy untuk retail, backend kedua, cash ledger tandingan, atau form debit/kredit sebagai pekerjaan harian owner. Bedakan quotation, commitment, invoice, DP, fulfillment, recognition, payment dan reconciliation. Status completed/closed atau bukti bayar yang diunggah tidak boleh otomatis berarti uang sudah dibayar. Jurnal posted seimbang, immutable, tahan retry dan terkait sumber; koreksi memakai reversal/adjustment.

Kerjakan berurutan menurut dokumen 07, mulai Fase 0 lalu lanjutkan implementasi lokal dalam irisan kecil backend sampai UI dan pengujian. Jangan berhenti hanya pada rencana atau meminta konfirmasi rutin setiap fase. Ikuti matriks integrasi dokumen 03 dan acceptance A01 sampai A15. Perbarui register/progres dokumen 11 dengan evidence, hasil checks, keputusan, gap dan langkah lanjut.

Kebijakan nyata yang belum diketahui—prinsipal/agen, recognition, pajak, komisi, mode owner, saldo awal dan cutover—tidak boleh ditebak. Bangun konfigurasi dan fixture terisolasi, lanjutkan pekerjaan independen, dan tanyakan keputusan yang benar-benar dibutuhkan. Tahan aktivasi tipe yang belum memiliki policy sah; jangan menyebut laba setelah pajak lengkap bila datanya belum cukup.

Pakai bun di backend dan pnpm di frontend, migrasi baru, bigint/string untuk uang, auth/capability/scope, audit dan idempotency existing. Perbaiki quality gate frontend yang false-green dan verifikasi typecheck app sebenarnya. Jalankan pengujian relevan di PGlite/PostgreSQL terisolasi, frontend tests, lint, full build dan browser UAT; jangan klaim lulus dari compile sebagian.

Saya mengizinkan implementasi kode lokal sesuai paket ini. Jangan deploy, push/commit, reset/hapus database atau perubahan user, mengaktifkan buku pada data produksi, melakukan pembayaran nyata, mengirim pesan eksternal atau filing pajak tanpa instruksi saya. Selesaikan hasil lokal yang bisa ditinjau dan rehearsal terlebih dahulu.

Mulai sekarang dengan membaca paket, memeriksa repository dan melaksanakan Fase 0. Setelah baseline dan desain teknis dicatat, lanjutkan irisan implementasi pertama yang bisa diuji. Laporkan progres secara ringkas dengan status implementasi, validasi accounting dan kesiapan produksi yang dibedakan.
