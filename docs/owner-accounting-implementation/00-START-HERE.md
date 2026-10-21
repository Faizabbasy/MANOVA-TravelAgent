# MANOVA accounting otomatis untuk pemilik bisnis

Paket ini adalah arahan implementasi untuk Claude Code. Tujuannya membuat pemilik travel agent dapat menjalankan pencatatan keuangan sehari-hari sendiri, dengan accounting yang terbentuk dari aktivitas MANOVA dan laba perusahaan yang bisa ditelusuri ke transaksi asal.

Tanggal: 21 Oktober 2026, Asia/Bangkok. Repository sasaran: `C:\Users\Syafiq Saputra\MANOVA-TravelAgent`. Baseline kode yang dibaca: `0a2e5b2`, 20 Oktober 2026. Paket ini menambahkan dokumen saja; tidak menyatakan fitur baru sudah diimplementasikan.

## Mandat pengguna

- Accounting sederhana untuk owner yang tidak memiliki tim accounting tetap.
- Project Management, Finance, Accounting, dan modul sumber harus terintegrasi.
- Data yang sudah tersedia tidak dimasukkan ulang. Aksi bisnis memicu catatan turunan sesuai aturan yang benar.
- Owner mengetahui laba perusahaan, keuntungan perjalanan, kondisi kas, dan pekerjaan yang belum lengkap.
- Implementasi dilakukan dengan Claude Code menggunakan paket ini.

## Urutan baca

1. [Kondisi kode dan batasan](01-CURRENT-STATE-AND-CONSTRAINTS.md).
2. [Lingkup produk dan keputusan](02-PRODUCT-SCOPE-AND-DECISIONS.md).
3. [Integrasi Project Management](03-PROJECT-FINANCE-INTEGRATION.md).
4. [Aturan accounting dan jurnal](04-ACCOUNTING-AND-POSTING-RULES.md).
5. [Arsitektur teknis](05-TECHNICAL-ARCHITECTURE.md).
6. [Pengalaman owner dan akses](06-OWNER-UX-AND-ACCESS.md).
7. [Tahapan implementasi](07-IMPLEMENTATION-PHASES.md).
8. [Pengujian dan penerimaan](08-TESTING-AND-ACCEPTANCE.md).
9. [Migrasi dan cutover](09-MIGRATION-AND-CUTOVER.md).
10. [Aturan eksekusi](10-EXECUTION-GUARDRAILS.md).
11. [Keputusan dan progres](11-DECISION-AND-PROGRESS-LOG.md).
12. [Prompt mulai](12-CLAUDE-CODE-START-PROMPT.md).

Baca juga `CLAUDE.md` root dan paket terkait, instruksi `AGENTS.md` yang berlaku, serta ADR terbaru di `docs/manova-finance-implementation/adr/`. Dokumen lama adalah riwayat, bukan bukti bahwa semua fitur masih mock. Audit kode terbaru sebelum mengubahnya.

## Hasil yang harus diwujudkan

Satu order dapat dijual, dipesan ke supplier, dilaksanakan, ditagihkan, dibayar, direkonsiliasi, dan ditutup melalui MANOVA. Semua kejadian keuangan memiliki catatan accounting yang seimbang, memiliki sumber, tahan pengulangan, dan terkoreksi dengan jejak perubahan. Laporan perusahaan mencakup biaya kantor dan akun non-project, bukan hanya menjumlahkan margin trip.

UI owner memakai aktivitas seperti Customer Bayar, Bayar Supplier, Catat Biaya, Kasbon, Bayar Gaji, Beli Aset, dan Cek Bulanan. Owner tidak diwajibkan memilih akun debit dan kredit. Detail jurnal tersedia bagi pemegang akses pemeriksaan.

## Cara menjalankan paket

Jalankan Claude Code dari root repository, lalu gunakan prompt pada dokumen 12. Mulai dengan Fase 0 dan kerjakan irisan kecil yang bisa diuji. Lanjutkan pekerjaan lokal yang sudah jelas tanpa meminta konfirmasi setiap tahap. Keputusan bisnis yang belum diketahui harus dicatat dan tidak boleh ditebak sebagai kebijakan produksi.

Paket ini bukan izin untuk deploy, push, mengganti database aktif, melakukan pembayaran nyata, mengirim pesan keluar, atau mengajukan dokumen pajak. Selesaikan kode, pengujian, rehearsal, dan hasil yang dapat ditinjau sebelum aktivasi produksi yang memerlukan instruksi pengguna.

## Tingkat penyelesaian

| Tingkat | Syarat |
|---|---|
| Implementasi fungsional | Semua cakupan wajib memiliki backend, UI, migrasi, integrasi sumber, dan pengujian |
| Siap accounting | Kebijakan untuk tipe transaksi yang diaktifkan sudah tervalidasi; saldo awal dan seluruh rekonsiliasi lulus |
| Siap produksi | UAT, identitas nyata, penyimpanan file, backup pemulihan, konfigurasi, dan cutover lulus |

Jangan menyebut seluruh program selesai hanya karena jurnal dasar atau dashboard sudah dibuat. Gunakan checklist fase dan catat pekerjaan yang belum selesai.
