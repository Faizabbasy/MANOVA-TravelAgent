# Memeriksa irisan implementasi lokal

Ini panduan checkpoint, bukan pernyataan seluruh accounting selesai. Baca status paling baru di dokumen 11. Tidak ada commit, deploy atau perubahan database aplikasi yang dilakukan oleh implementasi ini.

## Yang tersedia

- Bounded module accounting memakai source Finance existing, tidak ada cash book kedua.
- Profil production OFF atau rehearsal SHADOW, template akun, usulan policy immutable/draft dan periode.
- Journal/events/registry dengan source identity, money bigint/string, direct SQL guards, reversal, audit dan capability.
- Neraca saldo, exceptions, journal detail dan status sumber pada mutasi/customer invoice/vendor invoice.
- Hooks untuk manual cash dengan klasifikasi eksplisit, transfer/fee, receipt/vendor deposit, billing customer yang unconditional/deferred dan vendor prepaid sesuai fixture policy, allocation dan reversal. Invoice/DP tidak otomatis revenue.
- Rehearsal lock/reopen dengan alasan, konfirmasi produk, capability dan version check.
- Pemenuhan jasa/accrual, credit note/refund/klaim supplier, kasbon/payroll, aset/penyusutan/pinjaman/dana owner, B2C billing tanpa project dummy, rekonsiliasi CSV, laporan posted GL, cek bulanan, retry pending dan opening plan rehearsal sudah mempunyai irisan teruji. Detail batas setiap fitur ada di dokumen 11.
- Checkpoint 6: biaya kantor dibayar di muka di `/finance/funding#biaya-dibayar-di-muka`, satu pembayaran existing + pembebanan bulanan exact tanpa kas kedua. Missing months masuk laporan/close/opening. Metode produksi belum dipilih untuk pengguna.

Credit/refund/klaim supplier kini memiliki posting wajib pada irisan yang didukung (0047); B2C refund dan correction pra-cutover tetap gap. Mode OFF mempertahankan Finance existing. Tidak ada tombol aktivasi buku produksi atau endpoint validasi policy produksi. Ini belum dukungan seluruh transaksi accounting.

Semua demo seed menolak database yang sudah mempunyai accounting book; gunakan instance test baru untuk demo/rehearsal, jangan menghapus book atau data aplikasi agar seed dapat berjalan.

## Periksa tanpa menyentuh database aplikasi

Backend (Bun), dari `backend/`:

```powershell
bun run typecheck
bun test test/accounting-foundation.test.ts test/accounting-finance-sources.test.ts --timeout 60000
bun test test/accounting-prepaid.test.ts test/accounting-opening.test.ts test/accounting-close.test.ts test/accounting-funding.test.ts test/accounting-migrations.test.ts --timeout 120000
bun test test/accounting-recovery.test.ts --timeout 120000
```

Default tests memakai PGlite memory. Untuk parity PostgreSQL, set `TEST_DATABASE_URL` hanya ke database test terisolasi; helper membuat schema random per file dan membersihkannya setelah test. Jangan arahkan URL ini ke data aplikasi.

Test `accounting-recovery` default memakai PGlite memory meskipun `TEST_DATABASE_URL` diset (seperti tes backup existing). Ia mem-backup dan memulihkan buku fixture dengan journal posted, lalu menguji saldo/fingerprint, replay, period lock dan akses API. Untuk PostgreSQL restore, buat **dua database kosong baru** pada cluster rehearsal khusus `127.0.0.1:55439`, dengan nama `accounting_recovery_source_<12 hex>` dan `accounting_recovery_target_<12 hex>`, lalu set `ACCOUNTING_RECOVERY_SOURCE_URL` / `ACCOUNTING_RECOVERY_TARGET_URL` secara eksplisit serta `PG_BIN` jika binary PG tidak di PATH. Guard menolak URL/nama lain atau sumber non-kosong; jangan memakai database aplikasi dan jangan reset database agar test lolos. Run kedua engine checkpoint 6 lulus; arsip/checksum sintetis dipertahankan di `.data/accounting-recovery-rehearsals/synthetic-*` yang di-ignore Git. File bukti/blob belum ikut recovery ini.

Frontend (pnpm), dari `frontend/`:

```powershell
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

Typecheck sekarang memeriksa project references/app, sehingga utang tipe existing terlihat. Lint/typecheck penuh masih dapat gagal; lihat hitungan/evidence aktual di dokumen 11. Build memerlukan waktu panjang pada mesin audit, dan hanya exit 0 full build yang dihitung lulus.

Jalankan `pnpm typecheck` (yang memanggil `nuxt prepare`), tests dan build secara **berurutan**. Nuxt menulis/membersihkan generated tsconfig yang juga dibaca Vue/Vite saat tes. Build yang dihentikan paksa juga dapat meninggalkan lock: verifikasi PID/cwd/command dahulu, jangan bypass lock atau menghapus direktori generated/data pengguna sembarangan.

## Rehearsal HTTP / browser

Pastikan port 3000 dan 8080 tidak dipakai proses lain. Tidak perlu menjalankan `db:migrate`, seed, reset, atau membuka `.env` database aplikasi.

Terminal backend:

```powershell
$env:APP_ENV='test'
# Jangan set TEST_DATABASE_URL untuk server UAT ini; script menolaknya.
bun scripts/accounting-rehearsal.ts
```

Script membuat PGlite **memory baru** dan data sintetis, mengikat loopback 3000, dan tidak memakai DATABASE_URL aplikasi. Profil awal belum ada. Login memakai akun demo sintetis yang sudah ada di fixture, bukan identitas owner produksi. Tidak ada integrasi bank/payment provider.

Terminal frontend:

```powershell
pnpm exec nuxt dev --envName accounting-uat --no-fork
```

Route `/finance/accounting` menampilkan setup untuk Super Admin, detail baca untuk Finance dan tidak memberikan nominal kepada Admin. Pengaturan mode production tetap OFF; di environment production, pilihan rehearsal ditolak server. Policy UI baru berupa usulan draft, bukan persetujuan accounting/pajak.

Untuk smoke melalui server/proxy nyata, dari `backend/`:

```powershell
bun scripts/accounting-http-smoke.ts
```

Smoke menolak target selain health environment TEST/PGlite, serta menolak bila profil sudah ada. Ia membuat **satu** profil shadow, periode, biaya sintetis, serta prepaid 9 juta / 3 bulan melalui endpoint sumber; memeriksa retry pembayaran, amortisasi 3 juta, sisa manfaat 6 juta, exception/unknown tax dan Admin 403. Log menampilkan langkah tanpa cookie/kredensial, request API timeout 30 detik dan SSR shell 120 detik. Jalankan pada instance memory baru bila ingin mengulang; jangan menghapus data aplikasi agar test dapat berjalan. HTTP smoke tidak menggantikan browser hydration/UAT; sambungkan browser tool untuk memeriksa desktop 1440/tablet 768/mobile 390, focus, refresh dan retry.

## Pekerjaan berikutnya yang masih wajib

Lanjutkan gap aktual dokumen 11: mapping/validation/adjustment lengkap; agen/mixed/components dan recognition nyata; biaya/refund B2C; CR billing; credit loss/write-off; RFQ/komoditas persisten; recurring obligations/opex accrual dan komisi/insentif; pajak/FX; pelepasan aset serta correction/AP/prorata prepaid; files/identity/owner mode; forecast lengkap/GL drilldown/cash flow aktual; koreksi pra-cutover dan recovery DB+blob; browser UAT/handoff. Irisan fulfillment/accrual, refund project, retry UI, bank CSV dan opening rehearsal yang telah diuji tidak perlu dianggap belum dimulai. Peran kontrak dan recognition nyata tetap unknown berdasarkan jawaban pengguna “belum”. Seluruh fase masih partial; jangan menyimpulkan program selesai dari checkpoint ini.

## Pembaruan checkpoint 2–5 (21 Oktober 2026)

Tambahan yang dapat diperiksa lokal (semua dengan buku rehearsal/fixture; buku produksi tetap tidak aktif):

- Migrasi baru 0047–0052: pemenuhan jasa & klaim supplier, dana staf & payroll, aset/pinjaman/dana owner, order B2C tanpa project,
  rekonsiliasi rekening koran, saldo awal. Semua berpasangan up/down; down menolak bila evidence ada.
- Tes backend accounting (PGlite default; set `TEST_DATABASE_URL` hanya ke DB uji terisolasi):

```powershell
bun test test/accounting-foundation.test.ts test/accounting-finance-sources.test.ts test/accounting-recognition.test.ts test/accounting-staff.test.ts test/accounting-funding.test.ts test/accounting-close.test.ts test/accounting-bank.test.ts test/accounting-opening.test.ts test/accounting-migrations.test.ts --timeout 60000
```

- Layar baru/berubah: panel finance project (Hasil accounting, Jasa diberikan & diterima, Klaim ke supplier), `/finance/staff-funds`,
  `/finance/funding`, `/finance/reconciliation`, `/finance/accounting` (laba rugi, posisi, kontribusi, cek bulanan, saldo awal, proses ulang),
  HR "Bayar Gaji", sales order "Konfirmasi DP", Cash Flow (komitmen, gaji, reimbursement). Panduan pemakaian: `13-PANDUAN-OWNER.md`.
- Perubahan perilaku yang disengaja: payroll dan sales order tidak bisa lagi ditandai paid tanpa pembayaran kas; komisi dari project closed
  berstatus approved (bukan paid); invoice order B2C mandiri tidak memakai project.

## Checkpoint 7 — biaya rutin/accrual kantor

Targeted backend: `bun test test/accounting-company-expenses.test.ts test/accounting-prepaid.test.ts test/accounting-opening.test.ts test/accounting-migrations.test.ts test/accounting-finance-sources.test.ts test/finance-cashflow.test.ts --timeout 120000`. Jalankan parity dengan URL test terisolasi sesuai guard di atas. Full tests/build tetap serial di frontend.

Owner flow baru di `/finance/funding#biaya-rutin`: kontrak rutin → konfirmasi biaya terjadi dari jadwal → tautkan invoice asli existing → bayar melalui Utang Vendor existing. Rencana/expense/AP saling menggantikan di forecast; tidak dijumlahkan sebagai tiga kewajiban. Uji unknown policy, pending retry, invoice delta, void/replacement, periode closed dan accrual crossing cutover tersedia. Split/multi-invoice, prepaid via AP/correction, tax/commission policy dan private files masih gap; fase tetap partial.

HTTP smoke diperluas dengan jadwal dan biaya kantor yang pending, invoice asli tertaut, retry sumber serta Admin 403. Tetap gunakan instance TEST PGlite memory baru dan loopback proxy; smoke menolak profil yang sudah ada. Tidak memberi usable policy atau aktivasi produksi lewat smoke.

Perhatian rehearsal migrasi: `migrateDown` commit per langkah. Ketika 0053 menolak karena evidence prepaid, 0054 yang kosong mungkin sudah turun. Test penolakan memanggil `migrateUp` kembali pada fixture tersebut sebelum menjalankan API terbaru; ini menguji resume migration tanpa menghapus evidence. Jangan menjalankan rollback ini pada database aplikasi.
