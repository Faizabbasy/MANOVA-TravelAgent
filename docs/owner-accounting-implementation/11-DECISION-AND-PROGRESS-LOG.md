# Register keputusan dan progres implementasi

Tanggal dibuat: 21 Oktober 2026. Status awal: spesifikasi tersedia, implementasi belum dimulai melalui paket ini. Isi register dari bukti baru; jangan menyalin hasil audit lama sebagai hasil pekerjaan baru.

## Register keputusan

| ID | Topik | Status awal | Yang perlu dicatat |
|---|---|---|---|
| D01 | Accounting owner friendly dan source integration | Diminta pengguna | Pertahankan mandat dokumen 00 |
| D02 | Bentuk entitas dan standar accounting | Belum diketahui — kini menahan dana owner (modal vs prive vs pinjaman owner) dan aktivasi | Pilihan, dasar, tanggal, validator |
| D03 | Prinsipal/agen/campuran dan komponen kontrak | Belum diputuskan — dikonfirmasi pengguna 21 Oktober 2026 | Jawaban “belum” pada pertanyaan paket tour pertama; tetap unknown, tidak mengaktifkan policy produksi |
| D04 | Waktu pengakuan tiap jasa dan lintas bulan | Belum diputuskan — dikonfirmasi pengguna 21 Oktober 2026 | Jawaban “belum” untuk kejadian serah jasa; fixtures tidak menjadi kebijakan nyata |
| D05 | Tax profile dan withholding/export | Belum diketahui — laba setelah pajak null; potongan gaji tanpa perlakuan ditolak; modul pajak belum dibangun | Status, jenis transaksi, basis, rule source dan version |
| D06 | Basis/hak/pembayaran komisi | Belum diketahui — komisi tetap estimasi HR (kontrak × rate), status paid dari closed dihapus, belum dibukukan | Revenue/margin/collected basis, cancellation clawback |
| D07 | Owner tunggal versus tim | Owner harus dapat memakai sendiri; detail belum ditetapkan | ADR, onboarding, self-confirm controls dan dampak maker/checker |
| D08 | Opening balances dan tanggal cutover | Belum diketahui — rencana saldo awal + keputusan per item tersedia untuk rehearsal; produksi hanya pratinjau | Rehearsal terpisah dari saldo nyata yang disetujui |
| D09 | Recurring cost, aset, pinjaman, owner funds | Kebijakan nyata belum diketahui; prepaid mempunyai pilihan metode bulanan eksplisit (0053), recurring/accrual mempunyai kategori/pemetaan eksplisit (0054); fixture terisolasi bukan default produksi | Profile/metode/jadwal dan evidence |
| D10 | Valuta asing dipakai atau tidak | Belum diketahui | Jika dipakai, FX wajib sebelum support aktif |
| D11 | Cadangan kas dan alokasi overhead | Belum diketahui | Horizon, metode manajemen, no double expense |
| D12 | Provider file/auth/email/bank | Belum ditentukan | Adapter dev, provider nyata, credential setup tanpa secrets |
| D13 | Automation invoice draft/auto-issue | Rancangan default draft | Kebijakan yang owner aktifkan, syarat dan audit |

Untuk keputusan baru tambahkan catatan dengan: siapa yang memutuskan, trusted evidence/instruksi pengguna atau asumsi teknis, alternatif, dampak, tanggal efektif, versi policy dan pengujian. Fixture yang memilih nilai bukan persetujuan pengguna untuk produksi.

## Checklist fase

| Fase | Status | Evidence dan pekerjaan berikutnya |
|---|---|---|
| 0 Audit dan baseline | Audit dan perbaikan quality gate selesai | `PHASE-00-AUDIT.md`, ADR-008; checkpoint9/10 menghapus103 diagnostik nyata tanpa melemahkan strictness/rules; typecheck/lint/build exit0, rincian evidence di bawah |
| 1 Fondasi ledger | Fondasi fungsional; fase partial | 0045, setup/period/policy draft+settings, immutable ledger/guards/trial balance/API/UI, lock/reopen rehearsal; browser tersedia. Sisa: mapping/approval/adjustment lengkap dan aktivasi terkendali |
| 2 Finance existing | Cash/billing/allocation + corrections/refund/supplier terhubung; fase partial | 0046–0047/0052/0055–0059, native retail supplier/refund dan private payment-proof source sudah tersambung. Sisa: correction/void sumber pra-cutover dan seluruh varian agency/tax |
| 3 Project Management | Fulfillment/accrual, CR billing dan receipt matching teruji; fase partial | 0047/0057/0059, prefill booking/SO, panel project, CR→draft existing, invoice supplier parsial/backdated→receipt tertentu + reversal. Sisa: contract components/obligations lengkap, peserta/no-show, review/close gates project lengkap, agen/mixed (D03) |
| 4 Retail dan komersial | Native B2C billing/cost/refund + CR billing teruji; fase partial | 0050/0055/0056/0057: order tanpa dummy project, supplier berdimensi order, pembatalan→kasus Finance per customer, amendment→draft terlindungi. Sisa: recovery operasional cancellation, credit loss/write-off/recovery, RFQ/komoditas persisten, limit kredit |
| 5 Biaya dan dana staf | Kasbon/reimburse + payroll settlement + prepaid dan recurring accrual teruji; fase partial | 0048/0053/0054 + halaman `/finance/staff-funds`, Bayar Gaji di HR, prepaid dan biaya rutin/accrual → invoice existing di funding. Sisa: komisi (D06), insentif, split/multi-invoice opex, prepaid via AP/correction, petty cash terpisah |
| 6 Aset pinjaman modal pajak | Aset/penyusutan, pinjaman, dana owner, prepaid amortisasi teruji; pajak belum | 0049/0053 + halaman `/finance/funding` (Aset, Pinjaman & Modal). Sisa: pelepasan/penjualan aset, prepaid correction/AP/prorata, pajak/withholding (D05), FX (D10) |
| 7 Rekonsiliasi file akses | CSV + file privat + physical DB/blob recovery teruji; fase partial | 0051/0058, scoped upload/download asli, checksum/retention/idempotency, PGlite dan PostgreSQL17 physical recovery. Sisa: owner provisioning/recovery, mode owner tunggal (D07 + ADR maker/checker), provider/ACL/retensi produksi |
| 8 Laporan dan owner UX | Laporan/forecast dan beberapa journey browser teruji; fase partial | P&L/BS/contribution satu GL, completeness estimasi terstruktur, prepaid/recurring forecast. Browser B2C/CR/private1440/768/390 lulus. Sisa: forecast tax/loan due dan seluruh commitments, GL drilldown/cash flow lengkap, seluruh journey owner |
| 9 Close dan cutover rehearsal | Monthly/opening/retry/DB+blob recovery teruji; cutover produksi belum | 0052/0053 dan checkpoint10/11 physical PostgreSQL+file restore. Source dates matching dipertahankan terpisah dari posting date. Sisa: correction seluruh sumber pra-cutover, reopen produksi, semua varian mapping/drift/interruption |
| 10 UAT dan handoff | Quality gates diperbaiki dan checkpoint diverifikasi; program belum selesai | Source10 full682backend/1330frontend/build0/browser3pass. Source11 frontend1336/type0, supplier28PGlite+28PG, recovery6PGlite+physicalPG0; full backend/build/browser terbaru sedang berjalan. Handoff seluruh acceptance dan readiness produksi tetap belum |

## Format catatan fase

Salin format ini untuk setiap fase atau checkpoint yang benar-benar dikerjakan:

```text
Tanggal dan fase:
HEAD/branch dan perubahan user yang dipertahankan:
Tujuan dan acceptance IDs:
File/migration/source hooks yang berubah:
Backend/API/DTO dan consumer frontend:
Policy/profile/book mode:
Perilaku owner yang sekarang bekerja:
Tests: command, environment/engine, exit code, jumlah, durasi:
Angka rekonsiliasi dan invariants:
Baseline issues versus regresi:
Browser/roles/direct API/retry/reversal yang diuji:
Keputusan/asumsi baru:
Gap dan dampak aktivasi:
Status implementation/accounting validation/production readiness:
Langkah berikutnya dan file awal untuk melanjutkan:
```

## Matriks penerimaan

| ID | Status awal | Bukti yang harus diisi |
|---|---|---|
| A01 Paket DP dan accrual | Teruji (fixture TEST_ONLY) | `accounting-recognition.test.ts`: tabel A01 per langkah (kas 200→210→220, AR 70→0, deposit 20, accrual 80 → AP 80 → 60 → 0), laba Sep 0 / Okt 20, tanpa biaya 80 kedua; variasi invoice supplier sebelum jasa → prepaid lalu dirilis. PGlite + PG |
| A02 Laba perusahaan dan overhead | Partial | `accounting-staff.test.ts`: biaya kantor + payroll masuk laba sekali; kontribusi project + pos perusahaan = laba sebelum pajak. Penyusutan diuji di funding; prepaid kantor di checkpoint 6: pembayaran bukan beban, amortisasi bulanan tanpa kas kedua. Komisi D06/alokasi overhead tetap pending |
| A03 Receipt sebelum invoice | Core scenario teruji; acceptance lengkap masih partial | `accounting-finance-sources.test.ts`: receipt 30 → invoice 100 → alokasi menghasilkan AR 70/liability 100; receipt reversal juga membalik allocation, tanpa cash kedua |
| A04 Agen | Belum diuji | |
| A05 Refund dan supplier recovery | Core teruji | Refund 10 atas jasa diakui: pendapatan turun sekali saat approve, settlement hanya kas; klaim supplier 4 → biaya turun sekali, penerimaan hanya kas; Δlaba 14, bank 214; deposit recovery + void mengembalikan deposit, reversal deposit berklaim ditolak. Variasi pembatalan sebelum fulfillment/parsial booking masih perlu skenario khusus |
| A06 Kasbon/reimburse | Teruji | Kasbon 5 → bukti 4 (biaya 4) → sisa 1 kembali; bukti sama ditolak 409; variasi 6 dari 5 → reimbursement 1 dibayar sekali; reversal kasbon yang sudah dipakai ditolak; void bukti membalik biaya saja |
| A07 Aset pinjaman owner funds | Teruji (fixture) | `accounting-funding.test.ts`: beli aset 12 → aset, bukan beban; penyusutan per aset-bulan sekali (retry/run ulang 0 tambahan, DB mandatory); pinjaman 50 bukan pendapatan; cicilan 5+1 → kas −6, pinjaman −5, beban 1; reversal cicilan memulihkan; setoran/pengambilan owner ke ekuitas sesuai profil fixture, profil unknown → rollback. PGlite + PG |
| A08 Pajak dan withholding | Belum diuji | |
| A09 Partial lintas periode | Core teruji | Sep 40 (contract asset, sebelum tagihan) → invoice Okt 100 reklas 40 + liability 60 → Okt 60; batas kumulatif ditolak di API & DB; void pemenuhan membalik eksak |
| A10 Project/order existing | Partial | B2C standalone: DP order → invoice tanpa project, AR/liability berdimensi order, jasa diberikan → pendapatan order, tanpa traveler/project baru; paid manual ditolak. HR test memeriksa komisi tidak paid dari closed. Ready/booking per jenis/peserta/CR dan komisi berbasis policy masih perlu skenario |
| A11 Idempotency/concurrency/failure | Sebagian teruji | Retry, source fingerprint, concurrent workers, source/cash/audit rollback, period lock/reopen/version, SQL guards; seluruh tipe sumber/worker/recovery belum lengkap |
| A12 Laporan/rekonsiliasi | Partial (diperluas) | + P&L = ledger, BS seimbang dengan hasil usaha dihitung sekali, kontribusi project + perusahaan = laba sebelum pajak, laba setelah pajak null tanpa profil pajak. Forecast/cash flow aktual belum |
| A13 Bank/file | Bank dan file privat/recovery teruji lokal | `accounting-bank.test.ts`, `private-files.test.ts`, `private-file-recovery.test.ts`, physical PostgreSQL17 rehearsal. Scoped originals/hash/idempotency, missing/corrupt503, original ID lintas invoice/proof/cash; DB+blob target kosong/berisi/corrupt dan akses restored diuji. Provider/retensi produksi belum |
| A14 UX/security | API/komponen/HTTP dan beberapa browser journey teruji; partial | 401/403/404, CSRF, Admin tidak menerima angka; source10 browser3pass, viewport1440/768/390, keyboard/Escape/reload, CR dan private bytes. Seluruh owner flow/peran belum selesai |
| A15 Cutover/release | Partial | Migrasi sampai0059 empty round-trip; down menolak evidence. Opening rehearsal dan DB+blob restore PGlite/physicalPG teruji; guard empty target lintas schema/function. Sisa: koreksi seluruh sumber pra-cutover, full interruption/recovery/cutover serta readiness produksi |

## Melanjutkan setelah konteks berganti

Baca kembali dokumen 00, register ini, laporan fase terakhir, diff aktual dan sumber terkait. Jangan mengulang fase selesai tanpa alasan. Jika HEAD/schema berubah, perbarui baseline dan mapping, lalu lanjutkan dari acceptance yang belum terbukti. Perubahan scope pengguna dicatat dengan tanggal dan dampak, bukan mengganti histori secara diam-diam.

## Checkpoint lokal 21 Oktober 2026 — Fase 0, fondasi F1 dan irisan F2

- HEAD/branch: `0a2e5b2` / `production`; tidak commit/push/fetch/deploy. Untracked `app/` dan paket dokumen pengguna dipertahankan. Database aplikasi/.env tidak dibuka/diubah/dihapus.
- Desain dan matriks aktual: `PHASE-00-AUDIT.md`, `../manova-finance-implementation/adr/ADR-008-derived-owner-accounting.md`. Tidak ada keputusan finansial produksi baru dari fixtures.
- Baseline baru: `bun run typecheck` exit 0 (30.78s); `bun test --timeout 30000` 591 pass/0 fail/53 files (831.98s); `pnpm test` 1241 pass/64 files (196.18s); `pnpm lint` exit 1 (105 error/2691 warning). Raw output pada `baseline-*.log`.
- Tooling: script frontend kini `nuxt prepare && vue-tsc --build --noEmit`; vue-tsc 3.3.13/router 5.4.0 sesuai Nuxt 4.5.1 terpasang. Tidak menurunkan strictness. Pemeriksaan seluruh app sekarang exit 2 dengan 1990 diagnostik source/config (sebelum UI baru ditambahkan); ini quality debt, bukan check hijau. Source baru harus dipisahkan dari baseline pada checkpoint berikutnya.
- File/migration: 0045 fondasi, 0046 tanggal alokasi + mandatory source guards, `backend/src/modules/accounting/*`, Finance services, RBAC, typed DTO/endpoints, halaman `/finance/accounting`, detail jurnal dan panel sumber di mutasi/invoice.
- Mode: migration tidak membuat book. Setup UI/API hanya rehearsal shadow atau production off. Active book hanya fixture terisolasi. Tax/entitas/standard/recognition nyata tetap unknown; owner mode tetap team. Tidak ada opening/cutover produksi atau endpoint aktivasi produksi.
- Perilaku owner: setup konfigurasi, usulan policy berversi, periods, unavailable/provisional trial balance, exception queue, source journal detail; aktivitas uang menuju fitur Finance existing tanpa input jurnal. UI menunjukkan rehearsal dan alasan data belum lengkap.
- Tes awal fondasi: `bun test test/accounting-foundation.test.ts --timeout 60000`: PGlite memory 9 pass/0 fail (7.82s pada checkpoint); PostgreSQL 17 isolated schema 9 pass/0 fail (7.13s). Meliputi auth 401/403, CSRF, 404, idempotency, fingerprint conflict, posted immutability, balance/control dimensions, reversal, transfer clearing, source rollback dan close/posting race. SQL guards diperluas lagi sesudah run PG awal sehingga perlu run ulang final.
- Tes UI/API: `pnpm exec vitest run app/components/accounting/accounting-ui.test.ts app/lib/api/accounting.test.ts app/lib/api/client.test.ts app/constants/navigation.test.ts` exit 0, 34 tests/4 files (38.06s). Memeriksa unknown bukan nol, label rehearsal, format uang exact di atas JS-safe integer, config submission, pending/error, command retry identity dan source routes.
- Rekonsiliasi fondasi: cash GL movement = cash book movement = -10 fixture transfer fee setelah expense+reversal; internal clearing = 0; debit=credit. Ini belum opening/company profit acceptance A01–A15 lengkap.
- Gap F1: policy validation/mapping lifecycle lengkap, controlled adjustment, cumulative obligation constraints dan browser UAT masih pending. Gap F2: fulfillment/accrual belum ada; credit/refund ditahan pada active; source snapshots crossing-cutover belum punya opening registry. Jangan menandai seluruh fase/program selesai.
- Berikutnya: selesaikan/tes `accounting-finance-sources.test.ts` (receipt before/after invoice, supplier prepaid/advance, reversal dan AR/AP/cash reconciliation); ulang SQL tests dua engine; jalankan regression Finance, lint/typecheck file baru/full build dan browser pada backend nyata terisolasi. Lanjut F3–F10 sesuai acceptance yang belum terbukti.
- Status: implementation **partial**, accounting validation **fixture-only**, production readiness **belum siap/tidak diaktifkan**.

### Pembaruan checkpoint dan keputusan pengguna

- Pengguna menjawab **“belum”** untuk peran prinsipal/agen paket tour pertama dan kejadian serah jasa (D03/D04). Ini bukan persetujuan default principal/end-of-trip. Nilai produksi tetap unknown dan pengakuan produksi tidak diaktifkan. Pertanyaan kebijakan lain belum perlu menahan pembangunan teknis terisolasi.
- Typecheck app sesudah generic `ResponsiveDataView` diperbaiki: **102 diagnostik**, turun dari 1990; tidak ada diagnostik accounting/endpoints/komponen shared yang baru pada run tersebut. Tidak menggunakan `any`, menurunkan strictness atau mengecualikan source app untuk menghilangkan error. Utang tipe existing tetap pending, sehingga quality gate belum lulus penuh.
- Full frontend tests sesudah menambahkan route accounting ke allowlist test navigasi: **1255 pass / 66 files**, exit 0, 164.85s. Perubahan allowlist mengikuti route server-backed yang benar-benar ditambahkan; tidak mengubah assertion akses Admin.
- Accounting terbaru: **18 tests / 2 files PGlite**, 145 assertions, exit 0, 24.07s. Tambahan: production environment menolak rehearsal, event pending dapat diselesaikan memakai snapshot lama setelah policy fixture tersedia, concurrent workers berbeda request key menghasilkan satu journal, reopen memakai capability/version/audit, serta cash sebelum cutover menolak walaupun bank opening lebih awal. PostgreSQL latest dan full regression masih berjalan saat catatan ini ditulis.
- Targeted lint memakai ekstensi Vue/TS yang eksplisit dan di-quote untuk PowerShell: `pnpm exec eslint app/components/accounting app/pages/finance/accounting app/components/shared/ResponsiveDataView.vue app/lib/api/accounting.test.ts --ext '.ts,.vue' --fix`, **exit 0**. Full lint awal checkpoint menemukan 108 errors/2749 warnings (3 error baru kemudian diformat); run seluruh lint sesudah formatting masih perlu dicatat. Jangan memakai lint directory tanpa ekstensi Vue sebagai bukti pemeriksaan SFC.
- Full build checkpoint pertama **exit 0**, total 956.30s (~15.94 menit), 29.3 MB (5.27 MB gzip). Client 57.36s, SSR 73.05s, fase Nitro mendominasi durasi. Ini full build yang selesai, bukan timeout; build kedua untuk snapshot lebih baru berjalan terpisah.
- Live HTTP UAT **exit 0**: `APP_ENV=test bun scripts/accounting-rehearsal.ts` (PGlite memory baru) + Nuxt `--envName accounting-uat --no-fork` pada build directory terpisah, lalu `bun scripts/accounting-http-smoke.ts`. Alur: proxy → cookie session → create setup shadow → retry sama → create period → Finance expense → registry pending → trial balance dengan SOURCE_PENDING / netProfit null; Admin 403. Endpoint health mengonfirmasi environment test/PGlite/no drift sebelum smoke melakukan writes. Tidak memakai database aplikasi atau endpoint bank/provider eksternal.
- Browser UAT **belum terverifikasi**: tool inventory browser kosong; Chrome dan IAB sama-sama melaporkan unavailable. HTTP/SSR shell bukan bukti hydration, keyboard, viewport atau browser journey. Dev server/backend UAT milik pekerjaan ini sudah dihentikan dengan pemeriksaan command line dan PID; tidak menghentikan proses pengguna. PostgreSQL cluster scratch ditutup setelah seluruh test selesai.

### Verifikasi penutup source terbaru

| Check | Hasil aktual | Lingkup/evidence |
|---|---|---|
| Backend typecheck terbaru | Exit 0 | `backend-typecheck-final.log` |
| Full backend checkpoint, PGlite | 607 pass / 0 fail / 55 files, exit 0, 989.57s | `checkpoint-backend-pglite.log`; setelah checkpoint suite dimulai ditambahkan tes hardening berikut |
| Full backend checkpoint, PostgreSQL 17 | 608 pass / 0 fail / 55 files, exit 0, 848.12s | `checkpoint-backend-postgres.log`; run dimulai pada checkpoint source/test berbeda, bukan seluruh 19 targeted tests terbaru |
| Accounting final PGlite | 19 pass / 0 fail, 149 assertions, exit 0, 17.14s | `accounting-final-pglite.log`; mencakup perubahan seed guard dan concurrency terbaru |
| Accounting final PostgreSQL 17 | 19 pass / 0 fail, 149 assertions, exit 0, 22.98s | `accounting-final-postgres.log`; schema random terisolasi |
| Frontend penuh | 1255 pass / 66 files, exit 0, 164.85s | `checkpoint-frontend-tests-final.log` |
| Lint penuh terbaru | Exit 1, 105 error / 2691 warning | `checkpoint-frontend-lint-final.log`; sama dengan baseline, bukan lulus |
| Lint accounting + shared component | Exit 0 | `accounting-lint-final.log`; `.ts,.vue` eksplisit |
| Typecheck solution/app sebenarnya | Exit 2, 103 diagnostik | `checkpoint-frontend-typecheck.log`; direct app 102 + 1 diagnostic config Nuxt; tidak ada diagnostic accounting/endpoints/shared yang baru |
| Diff whitespace | Exit 0 | `git diff --check` dengan konfigurasi CRLF repository normal |

Angka final setelah penambahan seed protection: PGlite **19 pass / 149 assertions / 17.14s** dan PostgreSQL **19 pass / 149 assertions / 22.98s**, kedua-duanya exit 0. Build checkpoint kedua dicatat setelah proses selesai. Tidak perlu memperlakukan run penuh checkpoint sebagai run semua tes hardening yang ditambahkan sesudah proses itu dimulai: kedua run final targeted memeriksa source terbaru secara terpisah.

Guard tambahan: setiap demo seed (core/finance/year) kini menolak jika book accounting sudah ada, termasuk OFF/SHADOW, sehingga konfigurasi/evidence user tidak diberi data demo. Test memverifikasi jumlah cash/journal tetap identik sesudah penolakan. Tidak pernah menjalankan seed pada database aplikasi.

Cleanup lokal: dev server UAT loopback 3000/8080 dihentikan hanya setelah PID/command line terverifikasi; cluster PostgreSQL scratch pada 55439 dihentikan setelah full dan targeted tests selesai dengan `pg_ctl -D backend/.data/accounting-pg-rehearsal stop -m fast` (target/port diverifikasi dari `postmaster.opts`). Data directory scratch tetap ada; tidak menghapus DB/data user, tidak menghentikan service PostgreSQL existing.

Status fase tetap **partial**: tidak ada kebijakan bisnis produksi yang ditebak, tidak ada buku produksi diaktifkan. Outstanding teknis F1/F2 (bukan semata keputusan pengguna) mencakup mapping/approval policy lengkap, adjustment, retry/review pending via UI, seluruh credit/refund/supplier recovery, opening-source mapping, dan recognition/fulfillment/accrual dependencies. F3–F10 belum diimplementasikan oleh checkpoint ini. Panduan lokal: `LOCAL-CHECKPOINT-GUIDE.md`.

### Hasil akhir checkpoint source terbaru

- Validasi source tambahan: kombinasi customer/project yang tidak berhubungan kini ditolak sebagai field validation oleh API Finance sebelum cash tersimpan, bukan SQL failure. Relasi customer project dan peserta Group Trip tetap sah; source yang sama dipakai ledger.
- `bun test test/accounting-foundation.test.ts test/accounting-finance-sources.test.ts --timeout 60000`: **20 pass / 0 fail, 152 assertions**, PGlite memory **16.45s**, PostgreSQL 17 schema terisolasi **14.75s**, kedua exit **0**. Evidence: `accounting-final-validation-pglite.log` dan `accounting-final-validation-postgres.log`. Ini menggantikan hasil targeted 19 tests di atas untuk snapshot terakhir; histori full regression tetap mengikuti snapshotnya sendiri.
- `bun run typecheck` sesudah validasi source terakhir: **exit 0** (run console). Tidak ada perubahan backend lagi sesudah run ini.
- Full frontend build snapshot kedua: **exit 0**, total **1239.89s / 20.7 menit**, client **50.73s**, SSR **139.742s**, output **29.4 MB / 5.27 MB gzip**. `checkpoint-frontend-build.log` dan Nuxt `perf-report.json` mencatat full Nitro selesai. Fase bundling Nitro/CommonJS tetap dominan; belum ada optimasi performa build sebagai bagian irisan ini.
- Sesudah run terakhir, PostgreSQL scratch dihentikan dengan sukses. Pemeriksaan port loopback **3000/8080/55439** tidak menemukan listener. `git diff --check` **exit 0**; warning konversi LF/CRLF mengikuti konfigurasi repository, bukan whitespace failure.
- Tidak ada migrasi pada database aplikasi, aktivasi buku produksi, commit/push/deploy, pembayaran nyata, pesan eksternal, filing pajak, atau penghapusan database/perubahan pengguna.

Checkpoint ini disimpan agar pekerjaan berikutnya dapat melanjutkan F1/F2 dari gap di atas tanpa mengulang baseline. **Program accounting otomatis lintas seluruh modul belum selesai dan belum siap produksi.** Jawaban pengguna “belum” tetap D03/D04 unknown; gap teknis lain tetap menjadi pekerjaan implementasi, bukan dianggap menunggu keputusan tersebut.

## Checkpoint 2 — 21 Oktober 2026 (F2 lanjutan, F3 irisan pemenuhan, F5 dana staf/payroll, F8 laporan dasar)

```text
Tanggal dan fase: 21 Oktober 2026; lanjutan F2, irisan F3, F5, F8 (dasar).
HEAD/branch dan perubahan user yang dipertahankan: 0a2e5b2 / production, tanpa commit/push/deploy. Untracked app/, paket dokumen user dan
  pekerjaan checkpoint 1 dipertahankan. Database aplikasi/.env tidak dibuka. Cluster PG scratch lama (55439) tidak dapat dipakai karena nama
  superuser tidak tercatat; tidak dibongkar. Cluster scratch baru backend/.data/accounting-pg-scratch2 (127.0.0.1:55440, user/db accounting_test,
  data sintetis saja) dibuat untuk parity.
Tujuan dan acceptance IDs: A01, A05, A06, A09, A12 (diperluas), A02 (sebagian), A11 (credit/refund/staff rollback).
File/migration/source hooks:
  - 0047_accounting_fulfillment_recovery: service_fulfillments (fakta jasa diberikan/diterima, partial, batas kumulatif DB), supplier_claims,
    allocation ke klaim, allocation_counts() pada v_unallocated_payments, mandatory posting credit note/pemenuhan/klaim (menggantikan blok
    credit/refund unsupported 0046).
  - 0048_accounting_staff_funds_payroll: kind kas employee_advance / employee_advance_return / employee_reimbursement / payroll_payment,
    employee_expense_claims (bukti unik), v_employee_fund_balances, payroll paid hanya dengan pembayaran kas (legacy/demo provenance dikecualikan),
    mandatory posting payroll approve & bukti, akun 2165 utang reimbursement staf.
  - backend/src/modules/accounting/{recognition,staff,reports}.ts; finance/{fulfillments,staff-funds,routes-fulfillment,routes-staff-funds}.ts;
    hook di receivables (credit note issue/void), refunds (write-off, approve, reject), debit-notes (sebelumnya akan gagal di buku aktif),
    postings (reversal guard deposit-berklaim & kasbon terpakai; reversal gaji → run kembali approved), core/hr (approve = beban+utang; pay = kas).
Backend/API/DTO dan consumer frontend:
  - Baru: GET/POST /finance/fulfillments, /fulfillments/:id/void, /finance/supplier-claims(+void), /finance/vendor-refunds, /finance/staff-funds,
    /finance/staff-funds/{advances,returns,reimbursements}, /finance/expense-claims(+void), GET /accounting/reports/{profit-loss,balance-sheet,
    project-contribution}. Semua command Idempotency-Key, capability Finance existing (tanpa role baru).
  - Berubah: POST /payroll-runs/:id/pay kini wajib {bankAccountId, effectiveDate} + Idempotency-Key (status tanpa kas ditolak). Consumer:
    endpoints.ts, hr-sync.ts, halaman HR (dialog Bayar Gaji) diperbarui dalam perubahan yang sama.
  - UI: kartu "Jasa diberikan & diterima" dan "Klaim ke supplier" di panel finance project; halaman /finance/staff-funds (navigasi
    "Kasbon & Bukti Biaya"); laporan laba/posisi/kontribusi di /finance/accounting; label kind kas baru.
Policy/profile/book mode: tidak ada kebijakan produksi baru. Semua posting memerlukan policy usable; tanpa itu SHADOW → pending, ACTIVE →
  rollback (diuji). Fixture TEST_ONLY hanya di buku rehearsal test. Potongan gaji tanpa perlakuan → ditolak, tidak dianggap nol.
Perilaku owner yang sekarang bekerja: catat jasa diberikan/diterima dari prefill booking/SO; klaim & terima pengembalian supplier; credit note
  dan refund menurunkan liability/pendapatan sekali; kasbon → bukti → sisa/reimburse; setujui & bayar gaji dari rekening; baca laba sebelum pajak,
  posisi keuangan dan kontribusi per perjalanan dengan alasan kelengkapan.
Tests (lihat log di folder ini):
  - accounting-recognition 11/11, accounting-staff 5/5, accounting-migrations 2/2 (round-trip down 0044 → up; down 0047 menolak evidence).
  - PostgreSQL 17 scratch: 137/137, 10 file (accounting + HR + refund + AR/AP + debit note + money), exit 0, 72.9s — checkpoint2-accounting-postgres.log.
    Run dingin pertama migration test PG: 1 timeout >120s per test (tanpa error SQL); dua run ulang lulus 9.5s/6.4s.
  - Finance/accounting regression PGlite (12 file): 203/203 setelah tes lama credit-note diperbarui ke kontrak baru (422 policy + trigger mandatory).
  - Frontend penuh: 1283/1283, 69 file, exit 0, 88.6s — checkpoint2-frontend-tests.log.
  - Typecheck app nyata: exit 2, 103 diagnostik = baseline; 0 diagnostik pada file baru/berubah — checkpoint2-frontend-typecheck.log.
  - Lint file baru/berubah (.ts,.vue eksplisit, --fix): 0 error baru; error tersisa di navigation.ts/hr/index.vue identik dengan HEAD.
Angka rekonsiliasi: A01 kas 220 / AR 0 / AP 0 / laba Sep 0, Okt 20; A05 Δlaba 14, bank 214; A06 kas keluar bersih 4 = biaya 4; laporan P&L =
  jumlah jurnal, BS seimbang, kontribusi + pos perusahaan = laba sebelum pajak; laba setelah pajak null.
Baseline vs regresi: tes lama "credit/refund blocked" sengaja diganti (perilaku diminta paket); tes HR pay diganti karena kontrak API berubah
  (paid tanpa kas tidak lagi diizinkan). Full run pertama yang dimulai saat file migrasi 0048 sedang ditulis memberi 12 kegagalan transien
  (migrasi tanpa .down saat itu); file demo-seed diulang 59/59 lulus. Run penuh baru dicatat di bawah.
Keputusan/asumsi baru (teknis, ADR-008 addendum): fakta pemenuhan di Finance; urutan liability→revenue, asset→AR, prepaid→cost, accrual→AP;
  is_final untuk selisih invoice; klaim supplier terpisah; kind kas staf/payroll eksplisit; laba setelah pajak hanya dengan profil pajak valid.
Gap dan dampak aktivasi: agen/mixed (D03) pending; recognition nyata (D04) unknown; komisi (D06) belum diubah — status "paid" komisi dari
  closed_at masih ada di HR dan belum boleh dipakai sebagai kas; insentif belum dibukukan; potongan gaji perlu D05; aset/pinjaman/modal/pajak (F6),
  bank CSV/file privat/owner mode (F7), forecast & navigasi 5 kelompok (F8), close/opening (F9), browser UAT (F10) belum.
Status: implementation partial; accounting validation fixture-only; production readiness belum siap/tidak diaktifkan.
Langkah berikutnya: F6 (aset+penyusutan dari pembelian sah, pinjaman pokok/bunga, setoran/penarikan owner sesuai profil), lalu F8 forecast,
  F9 review/close + opening plan, F7 rekonsiliasi CSV. File awal: backend/src/modules/accounting/*, finance/staff-funds.ts, migrasi 0048.
```

Run penuh backend checkpoint 2 (PGlite memory, source 0047+0048 final): **629 pass / 0 fail / 58 file, exit 0, 663.09s (11m03s)** —
`checkpoint2-backend-pglite.log`. Seluruh perubahan backend checkpoint 2 sudah ada sebelum run dimulai; perubahan sesudahnya hanya frontend
(perbaikan tipe dialog kasbon) yang diverifikasi oleh typecheck/test frontend di atas.

### Checkpoint 2b — F6 aset, pinjaman, dana owner (0049)

- Kind kas baru `asset_purchase`, `loan_proceeds`, `loan_repayment` (split pokok/bunga di `loan_repayments`, harus = kas), `owner_contribution`, `owner_withdrawal`.
  `asset_capitalizations` (harga, nilai sisa, umur, mulai pakai; membuat kartu inventaris atau meminjam aset bukan pembelian) dan
  `asset_depreciations` unik per aset+bulan dengan mandatory posting di buku aktif. Garis lurus bigint exact, sisa pembulatan di bulan terakhir.
- Dana owner: peran ekuitas dari policy `owner_funds` (`contributionRole`/`withdrawalRole`: capital/owner-funds/loan). Tidak ada default;
  bentuk usaha (D02/D09) unknown → pending/rollback. Pokok pinjaman tidak pernah beban; bunga = biaya pendanaan.
- Reversal: pembelian aset yang sudah disusutkan ditolak (perlu fitur pelepasan, belum ada); pinjaman yang sudah dicicil ditolak; reversal cicilan
  membuka kembali status pinjaman.
- Tests: `accounting-funding.test.ts` 4/4 PGlite; PostgreSQL funding+migrations+staff 11/11. Frontend typecheck tetap 103 baseline; lint file baru bersih.
- Halaman `/finance/funding` + navigasi "Aset, Pinjaman & Modal". Pajak (A08) dan pelepasan aset belum diimplementasikan.

### Checkpoint 3 — F9 cek bulanan/tutup periode, retry pending, F4 B2C standalone (0050)

- `GET /accounting/periods/:id/review`: checklist server-side dengan status beres/perlu dilihat/harus diselesaikan dan tautan ke layar sumber.
  `POST /accounting/periods/:id/close` (accounting.close-period, Idempotency-Key, versi, alasan, `confirm: true`) menolak 422 bila ada blocker.
  Status `reviewed` sengaja tidak dipakai: guard posting 0045 memperlakukan periode non-open sebagai terkunci. Piutang/utang sah yang belum jatuh
  tempo tidak memblokir. Rekonsiliasi rekening koran masih "perlu dilihat" sampai F7 tersedia.
- `POST /accounting/exceptions/:eventId/retry` (accounting.manage-setup): menjalankan ulang derivasi sumber yang sama dari snapshot beku setelah
  kebijakan dilengkapi; tidak membuat kas baru (diuji jumlah financial_transactions tetap), event sudah posted → 404.
- B2C standalone: `customer_invoices.project_id` boleh null bila `sales_order_id` ada (check constraint). `confirm-dp` berlaku untuk order mandiri
  (tanpa roster traveler); status paid manual ditolak untuk semua order (`changeSalesOrderStatus`) — perubahan perilaku yang disengaja sesuai
  aturan "tidak ada paid tanpa settlement"; tes lama diperbarui. DTO invoice `project` kini nullable; consumer frontend (row, sheet, dialog,
  receipt, advance, dashboard, portal client) memakai label "Order SLO-…". Halaman sales order menampilkan Konfirmasi DP untuk Finance.
- Tests: accounting-close 2/2; accounting-recognition 12/12 (+B2C); sales-orders + finance-group-trip 20/20; frontend penuh 1290/1290 (71 file),
  typecheck 103 baseline, lint file berubah tanpa error baru.
- Run penuh backend checkpoint 3 (PGlite, source 0045–0050 + close/retry/B2C final): **637 pass / 0 fail / 60 file, exit 0, 604.58s** —
  `checkpoint3-backend-pglite.log`. Frontend checkpoint 3: 1290/1290 (71 file) `checkpoint3-frontend-tests.log`; typecheck 103 baseline
  `checkpoint3-frontend-typecheck.log`. Panduan owner: `13-PANDUAN-OWNER.md`.

### Checkpoint 3b — F7 rekonsiliasi rekening koran (0051)

- `bank_statement_imports` (sha256 unik per rekening, mapping tersimpan), `bank_statement_lines` (identitas baris = referensi bank, atau
  tanggal/arah/nominal/keterangan + nomor kemunculan dalam file), `bank_reconciliation_matches` (banyak-ke-banyak, batas per baris dan per
  transaksi di DB, unmatch sekali dengan alasan, tidak dapat dihapus). Parser CSV murni: pemisah, baris dilewati, format tanggal, gaya angka
  id/en, suffix DB/CR, rupiah tanpa sen (pecahan ditolak), 2 MB / 5000 baris.
- Impor tidak pernah membuat kas. "Catat dari baris" memakai jalur kas manual yang sama lalu mencocokkan dalam satu transaksi.
- Cek bulanan: baris rekening koran periode yang belum cocok = blocker; rekening tanpa impor = perlu dilihat.
- Tests: accounting-bank 5/5 PGlite; PG 45/45 (bank, close, funding, migrations termasuk 0051, recognition+B2C, sales orders, group trip).

### Checkpoint 3c — F9 saldo awal (0052)

- `GET /accounting/opening-plan` (pratinjau read-only) dan `POST /accounting/opening-plan/preview|confirm` (accounting.manage-setup): posisi per
  cutover diturunkan dari Finance — kas per rekening (opening + mutasi < cutover), piutang per invoice terbuka, uang muka customer, utang &
  deposit supplier, utang refund, kasbon/reimbursement, utang gaji, aset & akumulasi penyusutan, pinjaman, klaim supplier. Keputusan bisnis
  diminta per item dengan saran (jasa invoice sudah/belum diberikan; biaya supplier sudah terjadi/dibayar di muka; modal disetor vs saldo laba);
  yang belum dijawab tetap di "saldo awal belum direkonsiliasi" dan buku tidak divalidasi. Hash snapshot berubah → 409; konfirmasi kedua → 409.
- Konfirmasi hanya untuk buku rehearsal; buku produksi hanya pratinjau (aktivasi tetap perintah cutover terpisah). Registry
  `accounting_opening_items` membuat alokasi sesudah cutover atas receipt/invoice sebelum cutover diposting sebagai delta (tidak pending).
- Tests: accounting-opening 3/3 PGlite + PG (bersama migrations 5/5): kas 118 = buku kas per cutover, AR 70, uang muka 10, AP 25, deposit 5,
  kliring 158 sebelum keputusan → 0 sesudah keputusan; alokasi uang muka pra-cutover sesudah cutover tanpa exception; laba diakui saat jasa
  diberikan sesudah cutover. UI: komponen saldo awal di `/finance/accounting` (uji komponen 2/2).
- Belum: reversal/void sumber pra-cutover (koreksi periode lalu), restore DB+blob, drift skema/resumed migration rehearsal penuh.

### Checkpoint 3d — F8 proyeksi kas memakai satu definisi

- Cash Flow v1 (`finance/cashflow.ts`) diperluas, bukan diganti: sumber `commitment` (SO aktif dikurangi invoice supplier yang sudah disetujui;
  invoice yang masih direview tetap di dalam komitmen sehingga tidak terhitung dua kali), `payroll` (payroll disetujui belum dibayar, akhir bulan
  payroll) dan `staff_reimbursement` (terutang ke karyawan, periode pertama). Pokok pinjaman dan klaim supplier ditampilkan sebagai "tidak
  diproyeksikan" karena tanggalnya belum terstruktur — tidak ditebak. Sewa/biaya berulang dan pajak belum ada sumbernya (dicatat sebagai gap).
- Tes cash-flow lama mengisolasi kewajiban demo baru (SO/payroll seed) di setup file; tes baru: komitmen 2x → sebagian menjadi AP → total keluar
  tetap; payroll & reimbursement masuk proyeksi; pokok pinjaman di daftar dikecualikan. `finance-cashflow.test.ts` 36/36.
- Frontend: label sumber & pengecualian baru; baris proyeksi baru membuka layar sumbernya (project, HR, kasbon).

### Checkpoint 4 — navigasi lima kelompok, hasil accounting per project, isolasi tes forecast

- Navigasi Finance diurutkan menjadi lima kelompok kerja (Ringkasan Bisnis · Tagihan & Pembayaran · Transaksi Uang · Kasbon & Bukti Biaya ·
  Laporan & Cek Bulanan); key/route tidak berubah sehingga bookmark dan deep link tetap berlaku. `/finance/reconciliation` yang dulu redirect kini
  halaman rekonsiliasi.
- Kartu "Hasil accounting project" di panel finance project: pendapatan diakui, biaya langsung diakui, kontribusi, budget, sisa komitmen supplier,
  perkiraan biaya akhir (biaya diakui + dibayar di muka + sisa komitmen), tagihan ditagih-belum-diberikan, AR/AP, accrual, uang muka; dan tiga
  status terpisah (operasional, review accounting, pelunasan kas). Endpoint `GET /accounting/projects/:id/summary`.
- Tes forecast dengan angka pasti (`finance-acceptance`, `finance-cashflow`) mengisolasi SO/payroll demo di setup file karena sumber forecast
  baru kini menghitung komitmen demo; perilaku sumber baru diuji terpisah.

## Checkpoint 5 — verifikasi penutup sesi 21 Oktober 2026

| Check | Hasil aktual | Evidence |
|---|---|---|
| Backend typecheck | exit 0 | console |
| Backend penuh PGlite (0045–0052, semua irisan sesi ini) | **649 pass / 0 fail / 62 file, exit 0, 837s** | `checkpoint5-backend-pglite.log` |
| Accounting + finance + HR + sales PostgreSQL 17 scratch | **132 pass / 0 fail / 14 file, exit 0, 95s** | `checkpoint4-accounting-postgres.log` |
| Frontend penuh | **1298 pass / 73 file, exit 0** | `checkpoint5-frontend-tests.log` |
| Typecheck app nyata | exit 2, **103 diagnostik = baseline**, 0 pada file baru/berubah | `checkpoint5-frontend-typecheck.log` |
| Lint file accounting/finance/HR/sales yang disentuh | 3 error tersisa = baseline HEAD `navigation.ts` | console |
| Full build | **exit 0, 16m55.217s, 29.8 MB / 5.33 MB gzip** | `checkpoint5-frontend-build.log`; hasil terminal `Build complete!` dan `exit=0` diverifikasi saat melanjutkan |
| Browser UAT | **belum** — tool browser tidak tersedia di sesi ini | — |

Komisi: status "paid" dari project closed dihapus (closed/completed → approved); `hr.test.ts` menguji 51 baris komisi tanpa paid.
Hasil accounting project: `GET /accounting/projects/:id/summary` diuji (pendapatan/biaya = jurnal project, Admin 403, 404).

**Status program:** implementation **partial** (F1–F9 punya irisan teruji backend+UI; lihat checklist fase), accounting validation
**fixture-only**, production readiness **belum siap, tidak diaktifkan**. Tidak ada commit/push/deploy, perubahan database aplikasi, pembayaran,
pesan eksternal atau filing pajak.

**Sisa pekerjaan utama:** A04 agen/campuran (D03), pengakuan jasa nyata (D04), pajak & withholding A08 (D05), komisi (D06), file bukti privat +
backup blob, mode owner tunggal (D07, ADR maker/checker), owner provisioning/recovery, koreksi sumber pra-cutover, biaya berulang/prepaid opex,
pelepasan aset, biaya supplier per order B2C, refund order B2C, CR berbiaya → billing, kerugian kredit/write-off, RFQ/komoditas persisten, FX (D10),
cadangan kas (D11), browser UAT 1440/768/390.

## Checkpoint 6 — kelanjutan: biaya kantor dibayar di muka (0053)

21 Oktober 2026, Asia/Bangkok. Checkpoint 5 dibaca sebagai histori dan dicocokkan dengan file/log aktual; hasil build lengkap yang sebelumnya belum tercatat sudah diisi di atas. Semua perubahan/untracked pengguna dipertahankan. Tidak melakukan migrasi pada database aplikasi.

- Cakupan: irisan F5/F6, A02/A07/A09/A11/A12/A15 sebagian. `prepaid_expenses` menyimpan jadwal manfaat dan referensi satu pembayaran `financial_transactions` yang sama; `prepaid_expense_amortizations` unik per jadwal/bulan. Bukan cash ledger tambahan dan bukan project dummy.
- Aksi **Bayar di muka** di `/finance/funding#biaya-dibayar-di-muka`: rekening/tanggal/nominal aktual, deskripsi, referensi bukti unik, bulan manfaat pertama, jumlah bulan, dan pilihan metode eksplisit. Tidak memasukkan akun debit/kredit. Referensi bukti bukan unggahan file; private file storage masih gap F7.
- Metode irisan ini hanya `equal-months`, nominal bigint exact dan sisa pembulatan pada bulan terakhir. Pembayaran wajib pada/sebelum tanggal 1 bulan manfaat pertama. Pembayaran untuk manfaat yang sudah terjadi memerlukan alur biaya/utang; tidak disamarkan sebagai prepaid. Tidak memilih metode atau policy produksi untuk pengguna.
- Backend: `finance/prepaid-expenses.ts`, `routes-prepaid.ts` (digabung ke router funding untuk membatasi kedalaman inference Elysia tanpa `any`), `accounting/prepaid.ts`, `prepaid-completeness.ts`; hook cash source/reversal, retry, opening, reports dan monthly review. DTO/typed endpoints, label mutasi dan form/list paginated di frontend diperbarui bersama.
- Pembayaran → Dr prepaid office / Cr bank; pembebanan → Dr office expense / Cr prepaid office, tanpa kas kedua. Policy `prepaid_opex` dan `settings.method` wajib usable. Unknown: shadow pending; active rollback source+cash+schedule. Fixture `test-only` tetap hanya rehearsal; tidak ada endpoint aktivasi produksi.
- **Bebankan bulanan** hanya menerima bulan manfaat yang sudah berakhir; retry/scheduler memakai fungsi sumber yang sama dan PK jadwal/bulan. SQL memeriksa amount per occurrence, relasi pembayaran, keunikan bukti, immutability dan mandatory posting. Pembatalan pembayaran sebelum ada beban menggunakan reversal existing; sesudah ada beban ditahan di API dan SQL sampai correction lifecycle lengkap tersedia.
- Missing service month memakai satu definisi server untuk laporan, close dan opening. Laporan tetap provisional dengan reason `PREPAID_AMORTIZATION_MISSING`; close diblokir. Saldo awal mengambil sisa manfaat historis dan meminta pembebanan pra-cutover diselesaikan sebelum validasi. Pembebanan setelah cutover memakai opening registry, tanpa mengulang pembayaran.
- Bukti angka: bayar 9 juta / 3 bulan → kas 91 dari 100, prepaid 9, beban 0; Agustus beban 3/prepaid 6; September beban tambahan 3/prepaid 3. Dua worker September membukukan satu occurrence. GL cash = opening rekening + mutasi; neraca seimbang. Pada cutover September, opening prepaid 6, beban September 3 dan cash tetap 91.
- Verifikasi terarah: backend typecheck **exit 0**; PGlite **19/19, 5 file, 188 assertions, 72.33s, exit 0** (`checkpoint6-prepaid-regression.log`); PostgreSQL 17 scratch **19/19, 5 file, 188 assertions, 63.55s, exit 0** (`checkpoint6-prepaid-postgres.log`), termasuk migration round-trip 0053 sampai baseline 0044. Scratch yang dijalankan sesi ini sudah dihentikan.
- UI form: **2/2 lulus**, menguji metode tidak dipilih otomatis, exact amount string, error recovery dan pending/double-submit. Lint kedua SFC/form test **exit 0** (`checkpoint6-prepaid-lint.log`). Typecheck solution nyata **exit 2 / 103 diagnostik**, sama jumlah checkpoint 5; **tidak ada diagnostic pada file prepaid baru, endpoint atau funding page** (`checkpoint6-frontend-typecheck.log`). Tidak mematikan rule/strictness.
- Browser inventory sesi ini kembali **apps=[], browsers=[]**; browser UAT belum terverifikasi. HTTP/SFC tests tidak diklaim sebagai browser hydration/viewport/keyboard UAT. Full frontend tests, backend full regression dan full production build snapshot 0053 sedang berjalan; hasil penutup ditambahkan setelah selesai.
- Gap tetap: recurring obligations/opex accrual belum dikerjakan, prorata hari/metode selain bulanan sama besar belum didukung, koreksi beban/prepaid yang sudah dibukukan belum ada, akuisisi prepaid via AP belum ada. Transaksi agen/campuran, pajak, komisi, files/identity/owner mode dan backlog checkpoint 5 lain tetap terbuka. Forecast tidak memasukkan pembebanan prepaid sebagai cash outflow kedua karena pembayaran sudah termasuk saldo aktual.

Status program tetap **implementation partial / accounting validation fixture-only / production belum siap dan tidak diaktifkan**. Hasil suite lengkap checkpoint 5 tidak dipresentasikan sebagai pengujian source 0053.

### Penguatan dan verifikasi checkpoint 6 terbaru

- Negative SQL test sekarang memeriksa guard prepaid dengan accounting **OFF di dalam transaksi yang dibatalkan**, sehingga penolakan tidak hanya bergantung pada mandatory GL guard ACTIVE: pembayaran tanpa jadwal ditolak, reversal kas atas prepaid yang telah dibebankan juga ditolak. Migrasi down 0053 menolak prepaid OFF tanpa perlu posted journal. Setelah policy fixture dilengkapi, request yang sebelumnya gagal dapat memakai **Idempotency-Key yang sama** dengan sukses (claim gagal memang rollback).
- Final targeted prepaid: **8 pass / 0 fail / 80 assertions** pada PGlite **26.52s** dan PostgreSQL 17 scratch **26.28s**, kedua exit **0** (`checkpoint6-prepaid-final-pglite.log`, `checkpoint6-prepaid-final-postgres.log`). Ini memperluas assertions sesudah full backend run dimulai; full checkpoint dan targeted terakhir dibedakan.
- Backend typecheck final **exit 0**, `checkpoint6-backend-typecheck.log`. Full frontend pertama checkpoint 6 **1304/1304, 74 files, 124.11s, exit 0** (`checkpoint6-frontend-tests.log`). Lint seluruh frontend aktual **exit 1, 104 errors / 2571 warnings** (`checkpoint6-frontend-lint.log`); file prepaid baru tidak memiliki diagnostic lint. Dibanding baseline awal 105/2691, ini tetap gate gagal dan bukan klaim semua error lama sudah diperbaiki.
- HTTP smoke melalui server/proxy nyata **exit 0**, termasuk prepaid payment retry, month 3 juta, sisa 6 juta, unknown pending dan Admin 403 (`checkpoint6-http-smoke.log`). Run pertama selesai sukses ketika sedang ditinjau; script kemudian diberi observabilitas per endpoint dan timeout, lalu diulang sekali pada memory instance baru: **exit 0**, `checkpoint6-http-smoke-bounded.log`. Log tidak mencetak cookie/password. SSR shell 200 tidak sama dengan browser hydration.
- Form dilengkapi error/retry saat gagal memuat rekening, loading state dan tautan ke pengaturan bila belum ada rekening verified. Lint targeted sesudah perbaikan **exit 0, tanpa error/warning** (`checkpoint6-prepaid-final-lint.log`). Build pertama checkpoint 6 sengaja dihentikan sebelum selesai karena source UI berubah; **tidak dihitung lulus**. Full tests/typecheck/build terakhir dijalankan untuk source setelah perbaikan ini; hasil final diisi setelah exit aktual.
- Server Nuxt/backend rehearsal dihentikan hanya setelah PID/command line milik sesi ini diverifikasi; PostgreSQL scratch yang dimulai sesi ini juga ditutup. Data aplikasi dan service PostgreSQL existing tidak disentuh. Hasil `git diff --check` tetap exit 0.
- Verifikasi frontend diulang secara serial: run `checkpoint6-frontend-tests-final.log` mempunyai 73 file/1302 tests lulus dan **1 suite gagal load generated tsconfig** (`TSCONFIG_ERROR: Tsconfig not found` pada `AccountingProjectSummary.vue`) ketika `nuxt prepare` berjalan bersamaan. Ini dicatat sebagai kegagalan verifikasi, tidak dianggap hijau. Tidak mengecualikan file/tes; urutan diperbaiki menjadi test dahulu, build sesudah selesai. Typecheck final tetap exit 2/103 baseline.
- Build attempt `checkpoint6-frontend-build-final.log` exit 1 karena lock PID 17776 milik build yang dihentikan sesi ini. PID/command/cwd pada `frontend/node_modules/.cache/nuxt/.nuxt/nuxt.lock` diverifikasi, proses dipastikan tidak ada, lalu **lock tersebut saja** dipindah ke `checkpoint6-abandoned-build-lock.json.log`. Tidak memakai `NUXT_IGNORE_LOCK` atau menghapus direktori generated/user; `frontend/.nuxt/nuxt.lock` dari proses lain tidak disentuh. Evidence serial final: `checkpoint6-frontend-tests-serialized.log` lalu `checkpoint6-frontend-build-verified.log`.
- Full backend PGlite checkpoint 6 **657 pass / 0 fail / 63 files, 6705 assertions, 1037.30s, exit 0** (`checkpoint6-backend-pglite.log`). Source implementasi 0053 sudah lengkap sebelum run dimulai; assertions prepaid tambahan sesudah run dimulai dibuktikan pada final targeted 8/8/80 di kedua engine. Tidak mengklaim full PostgreSQL 63 files dari run parity terarah 19/19.
- Pemeriksaan akhir port **3000/8080/55439 tidak menemukan listener**. Tidak ada server test/rehearsal yang sengaja ditinggalkan; generated build bukan deployment. Frontend typecheck final tetap **103 diagnostik / exit 2**, tidak ada diagnostik prepaid/endpoint/funding baru (`checkpoint6-frontend-typecheck-final.log`).

### Rehearsal pemulihan DB accounting (A15 parsial)

- `backend/test/accounting-recovery.test.ts` memakai PGlite memory baru secara eksplisit, migration + seed sintetis, buku rehearsal TEST_ONLY, pembayaran prepaid dan beban Agustus, lalu periode dikunci. Backup/restore memakai fungsi existing ADR-002, **tidak ada database aplikasi atau `.env` yang dibuka**.
- Setelah restore ke memory baru: snapshot count/uang/fingerprint kas & jurnal (termasuk rekening, dimensi dan pemilik), fingerprint event, versi/settings policy, registry, book mode/owner mode, period lock dan jumlah audit identik. `migrateUp` memverifikasi schema/checksum yang dipulihkan tanpa memutar ulang uang.
- API yang sama setelah restore: Idempotency-Key pembayaran lama mengembalikan transaction ID yang sama dan replay header, tanpa cash/journal/audit tambahan; prepaid tersisa 6 juta, beban Agustus 3 juta, laba setelah pajak null. Source baru ke periode terkunci ditolak 422, Admin 403, anonymous 401 dan mutasi posted line ditolak SQL.
- Final recovery run **1 pass / 0 fail / 15 assertions, 18.79s, exit 0**, `checkpoint6-accounting-recovery.log`; backend typecheck sesudah penambahan test **exit 0**, `checkpoint6-backend-typecheck-recovery.log`. Test ini ditambahkan **sesudah** full run 657/63 selesai, sehingga tidak mengklaim angka full suite mencakup recovery test baru tersebut.
- Arsip sintetis dan checksum dipertahankan dalam ignored `backend/.data/accounting-recovery-rehearsals/synthetic-*` untuk inspeksi lokal; tidak menghapus data/direktori pengguna. Ini **DB-only PGlite**, bukan bukti restore PostgreSQL produksi atau backup/restore private blobs. F7/F9/A15 belum lengkap dan production readiness tetap belum siap.
- Test yang sama kemudian diperluas untuk **PostgreSQL 17 scratch** dengan dua URL khusus: wajib berbeda, host `127.0.0.1:55439`, nama `accounting_recovery_source_<12 hex>` dan `accounting_recovery_target_<12 hex>`. Sumber wajib kosong sebelum migration/seed; restore existing menolak target non-kosong. Tidak memakai URL aplikasi atau bypass checksum.
- PostgreSQL `pg_dump` → `.dump` + SHA256 → `pg_restore --single-transaction` → API/invariants yang sama: **1 pass / 0 fail / 15 assertions, 12.14s, exit 0**, `checkpoint6-accounting-recovery-postgres.log`. Dua DB baru `accounting_recovery_source_fda5e498ec16` / `accounting_recovery_target_fda5e498ec16` dipertahankan dalam cluster scratch; **tidak drop/reset database**. Cluster ditutup sesudah run.
- Ini memperluas bukti menjadi DB-only **kedua engine**; belum mencakup blobs/private proof, seluruh varian opening/source atau recovery operasional produksi. Jangan memakai kelulusan rehearsal untuk mengaktifkan buku nyata.

### Rekap verifikasi source terakhir checkpoint 6

| Check | Hasil aktual | Evidence |
|---|---|---|
| Full backend PGlite | 657/657, 63 files, exit 0, 1037.30s | `checkpoint6-backend-pglite.log`; implementation snapshot, sebelum assertions tambahan dan test recovery ditambahkan |
| Regresi SQL/sumber terkait | 19/19, 5 files, exit 0 pada PGlite dan PostgreSQL | `checkpoint6-prepaid-regression.log`, `checkpoint6-prepaid-postgres.log` |
| Final guard prepaid | 8/8, 80 assertions, exit 0 masing-masing engine | `checkpoint6-prepaid-final-pglite.log`, `checkpoint6-prepaid-final-postgres.log` |
| Recovery DB PGlite terakhir | 1/1, 15 assertions, exit 0, 14.80s | `checkpoint6-accounting-recovery.log` |
| Recovery DB PostgreSQL 17 | 1/1, 15 assertions, exit 0, 12.14s | `checkpoint6-accounting-recovery-postgres.log` |
| Backend typecheck sesudah seluruh source/test terbaru | exit 0 | `checkpoint6-backend-typecheck-recovery.log` |
| Frontend penuh, serial setelah prepare selesai | **1304/1304, 74 files, exit 0, 138.62s** | `checkpoint6-frontend-tests-serialized.log`; 1 suite transient pada run paralel tidak disembunyikan |
| Frontend typecheck sebenarnya | **exit 2, 103 diagnostik baseline** | `checkpoint6-frontend-typecheck-final.log`; tidak ada diagnostic prepaid/endpoint/funding baru |
| Lint penuh | **exit 1, 104 errors / 2571 warnings** | `checkpoint6-frontend-lint.log` |
| Lint file prepaid terakhir | exit 0, tanpa error/warning | `checkpoint6-prepaid-final-lint.log` |
| Live HTTP proxy + source flow | exit 0 | `checkpoint6-http-smoke-bounded.log`; fresh TEST memory, unknown pending, Admin 403 |
| Full build source terakhir | **exit 0, 1012.15s (16m52s), 29.8 MB / 5.35 MB gzip** | `checkpoint6-frontend-build-verified.log`; full Nitro `Build complete!` dan `exit=0`, test dan build serial |
| Browser UAT | Belum tersedia | Inventory apps/browsers kosong; HTTP/SFC/SSR bukan browser UAT |

Tidak ada commit/push/deploy, aktivasi buku produksi, pembayaran eksternal, pesan eksternal, filing pajak, reset/drop database atau penghapusan perubahan pengguna. Kelulusan fixture tidak menetapkan keputusan D02–D13 dan tidak menyelesaikan seluruh program.

Penutup checkpoint 6: full build terakhir **benar-benar selesai exit 0**; client 50.265s, SSR 67.227s, total Nuxt perf 1012.15s, bundling Nitro masih mendominasi. Tidak menghitung run yang dihentikan atau run stale-lock sebagai build lulus. Pemeriksaan port 3000/8080/55439 terakhir kosong dan `git diff --check` exit 0. Status **implementation partial, accounting validation fixture-only, production belum siap/tidak diaktifkan**. Panduan owner terkini: `13-PANDUAN-OWNER.md`; panduan pengujian/rehearsal: `LOCAL-CHECKPOINT-GUIDE.md`.

Langkah implementasi berikutnya yang independen dari D03/D04: recurring obligations/opex accrual dari sumber Finance yang sama, prepaid via AP/correction, biaya/refund native B2C, CR commercial → draft billing, credit loss/write-off, private file+DB/blob recovery, policy approval/mapping lengkap dan quality gate frontend. Tetap gunakan fixture/config untuk keputusan nyata yang belum ditetapkan; jangan memperlakukan jawaban “belum” sebagai alasan menghentikan semua coding.

## Checkpoint 7 — biaya rutin dan accrual kantor (0054), implementasi lokal dan verifikasi

21 Oktober 2026, Asia/Bangkok. Dilanjutkan langsung dalam otorisasi lokal. Scope F5/F8/F9 parsial, A02/A09/A11/A12/A14/A15 parsial; bukan penyelesaian seluruh program.

- Jadwal kontrak persisten `company_expense_schedules` merupakan rencana forecast, bukan invoice, beban atau kas. Owner memilih vendor existing, nominal, kategori, bulan dan tanggal bayar dari kontrak. Stop hanya menghentikan rencana dengan alasan; kewajiban yang telah terjadi tetap ada.
- Konfirmasi **Biaya sudah terjadi** menyimpan sumber `company_expenses` immutable, unique evidence dan occurrence jadwal/bulan. Fakta kontrak diambil server agar tidak diinput ulang. Nominal aktual/estimasi andal dan evidence tetap dikonfirmasi. Posting Dr expense / Cr company-accrued memakai policy `company_expense.settings.classifications` eksplisit; unknown tidak ditebak.
- Akun 2115/company-accrued dipisah dari accrued-cost project, mencegah generic invoice supplier menghapus accrual kantor yang tidak terkait. Invoice asli dari tabel `vendor_invoices` existing ditautkan eksplisit dan di-approve dalam transaksi yang sama: accrual estimasi dibalik, selisih menjadi expense, AP nilai aktual. Pembayaran/alokasi/reversal memakai Finance existing dan satu `financial_transactions`, tanpa ledger uang tandingan.
- Forecast mengganti satu sumber berurutan rencana → incurred accrual → invoice AP → pelunasan. Pembebanan tidak membuat cash forecast kedua. Company-only tidak dimasukkan sebagai biaya langsung project. Pending bulan kontrak yang sudah berakhir membuat laporan provisional dan menjadi blocker monthly review/opening; owner harus mencatat kejadian atau menghentikan rencana dengan alasan.
- API/DTO/typed endpoints dan UI `/finance/funding#biaya-rutin` ditambahkan bersama; form kontrak/biaya, status accounting, invoice existing/create dialog, pembayaran via sheet existing, stop/void dengan alasan dan konfirmasi. Role/capability server, audit/idempotency satu transaksi, posting active mandatory dan SQL immutability tetap berlaku. Buku aktif hanya pada fixture TEST_ONLY terisolasi.
- Temuan awal: komposisi nested prefix Elysia memberi endpoint 404; dipindah menjadi sibling plugin. Tes awal juga memakai key tujuh karakter yang tidak valid; fixture diperbaiki tanpa melonggarkan aturan idempotency. Targeted awal sesudah perbaikan **4/4,55 assertions,exit 0**; regresi awal **45/45,4 files,2333 assertions,exit 0,29.91s** (`checkpoint7-regression-pglite.log`). Ini sebelum tambahan assertions cutover/pending dan completeness opening terakhir.
- Backend typecheck awal exit 0. Verifikasi final PGlite/PostgreSQL, SFC tests, frontend typecheck/lint/full tests/full build **masih pending**; hasil aktual ditambahkan setelah selesai. Browser UAT tetap belum terbukti karena inventory sebelumnya kosong.
- Batas irisan: satu biaya/occurrence ↔ satu invoice aktif; split/multi-invoice dan prepaid via AP/correction belum tersedia. Pilihan kategori tidak menetapkan kebijakan fiskal. Referensi bukti bukan file terunggah. Daftar jadwal dibatasi 100 dengan pemberitahuan eksplisit; volume lebih besar masih perlu pagination. D03/D04 tetap “belum”; kebijakan produksi tidak diisi fixture.

Status **implementation partial / accounting validation fixture-only / production belum siap, tidak diaktifkan**. Tidak deploy/commit/push, migrasi DB aplikasi, pembayaran nyata, pesan keluar atau filing pajak. PostgreSQL port 55439 hanya cluster scratch existing yang diverifikasi dari `postmaster.opts`; migration/test berjalan di schema acak baru.

### Bukti antara checkpoint 7

- Final source tests PGlite **6/6,86 assertions,24.39s,exit 0** (`checkpoint7-company-pglite.log`), termasuk saldo awal 5 → actual invoice 6 → beban baru1, cash tetap100; shadow unknown → TEST_ONLY policy → retry tanpa duplikasi; source dan link/status invoice rollback pada kegagalan mandatory policy.
- PostgreSQL initial regression **60 pass /1 fail** (`checkpoint7-regression-postgres.log`): tes prepaid melakukan down ke52, migration54 kosong sudah turun sebelum53 menolak evidence. API terbaru lalu kehilangan tabel54. Fixture sekarang memanggil `migrateUp` setelah penolakan down sebelum menguji API. Tidak mengubah expectation nominal/aturan bisnis. Final PostgreSQL17 **61/61,6 files,2509 assertions,91.08s,exit0** (`checkpoint7-regression-postgres-final.log`). Resumed migration mempertahankan evidence prepaid.
- Frontend full serial **1311/1311,75 files,99.69s,exit0** (`checkpoint7-frontend-tests.log`); form nyata mencakup konfirmasi, nominal string besar, reuse jadwal, basis tidak dipilih otomatis, error recovery dan pending.
- Frontend app typecheck **exit2,103 diagnostik baseline**, tanpa diagnostic company form/workspace, funding, endpoint atau DTO baru (`checkpoint7-frontend-typecheck.log`). Backend typecheck source/tests exit0 (`checkpoint7-backend-typecheck.log`), setelah tipe key fixture diberi anotasi string (sebelumnya infer UUID template literal menolak key test).
- Targeted lint final **exit0,0 error/warning** pada form/workspace/test, CashFlowItems, cashflow helper/page, funding, endpoints, DTO dan setup form (`checkpoint7-company-lint-final.log`). Run awal43 error spacing endpoint telah diperbaiki; perbandingan sebelum/sesudah tanpa whitespace identik. Formatting ini satu-satunya perubahan frontend setelah full test/build dimulai; tidak ada perubahan perilaku atau deklarasi tipe.
- Browser tool kembali `apps=[], browsers=[]`. Fallback skill Computer Use (`@oai/sky` via node_repl) gagal initialize dengan **failed to write kernel assets: The system cannot find the path specified. (os error 3)**, sebelum ada input aplikasi. Tidak mengklaim browser UAT/hydration/viewport lulus.
- Full backend PGlite dan full production frontend build source0054 sedang berjalan; belum dihitung lulus. Nitro bundling mendominasi seperti checkpoint6; tidak menjalankan duplicate build atau mematikan typecheck/lint rules. HTTP smoke proxy untuk company source sudah ditulis dan menunggu server hasil build siap.

Tambahan verifikasi: perbandingan seluruh baris diagnostik TypeScript checkpoint6-final dan checkpoint7 menghasilkan **103 vs103, diff0 baris**. Jadi ini bukan hanya jumlah yang kebetulan sama. Utang tipe terbesar tetap client tests, cash-flow page dan project-orders lama. Tidak mematikan rule untuk menyembunyikannya. Cluster PostgreSQL scratch55439 yang dijalankan sesi ini dihentikan sesudah final parity; database/data test tetap dipertahankan.

Lint penuh checkpoint7 selesai **exit1,104 errors/2571 warnings**, identik hitungan checkpoint6 (`checkpoint7-frontend-lint.log`). Targeted source baru tetap exit0; tidak mengklaim full quality gate hijau. Diagnosis build sementara: client48.097s, SSR82.713s, sisanya di bundling Nitro. Proses build masih memakai CPU (663.8s CPU pada sekitar9menit wall, private memory4.17GB); tidak ada hard error/exit yang boleh dihitung selesai. Warning trailing-slash export/annotation masih tercatat, tidak disembunyikan.

Batas tambahan company matching: hanya invoice **belum disetujui** yang dapat ditautkan. Reclassification invoice yang sudah approved dan lifecycle koreksi/revisi dengan nomor invoice asli yang sama belum dibuat pada irisan ini; jangan mengganti nomor secara fiktif agar lolos unique constraint. Invoice sebelum service incurred memerlukan prepaid/AP lifecycle yang masih backlog. Owner memilih sumber valid; test fixture tidak menyelesaikan gap tersebut.

Full backend snapshot0054 selesai **664/664,65 files,6821 assertions,799.00s,exit0** (`checkpoint7-backend-pglite.log`). Ini mencakup company-expense6tests, recovery DB dan fixture migration-resume yang diperbaiki. Backend typecheck final juga **exit0** (`checkpoint7-backend-typecheck-final.log`). Source implementasi backend tidak berubah selama full run; script HTTP smoke terpisah diperluas dan tercakup typecheck final. Semua suite lengkap tidak dipakai untuk mengklaim program atau production readiness selesai.

### Rekap final checkpoint 7

| Check | Hasil aktual | Evidence |
|---|---|---|
| Full backend PGlite | **664/664,65 files,6821 assertions,799.00s,exit0** | `checkpoint7-backend-pglite.log` |
| Regresi PostgreSQL17 scratch | **61/61,6 files,2509 assertions,91.08s,exit0** | `checkpoint7-regression-postgres-final.log`; company/prepaid/opening/migrations/invoice sources/cashflow |
| Targeted company PGlite | **6/6,86 assertions,24.39s,exit0** | `checkpoint7-company-pglite.log` |
| Backend typecheck final, termasuk HTTP smoke script terakhir | **exit0** | `checkpoint7-backend-typecheck-final.log` |
| Frontend penuh serial | **1311/1311,75 files,99.69s,exit0** | `checkpoint7-frontend-tests.log` |
| Frontend real app typecheck | **exit2,103 diagnostics; diff0 seluruh baris terhadap checkpoint6** | `checkpoint7-frontend-typecheck.log` |
| Lint source yang disentuh | **exit0,0 error/warning** | `checkpoint7-company-lint-final.log`; formatting endpoint whitespace-only sesudah full tests/build mulai, tanpa perubahan perilaku/tipe |
| Lint penuh | **exit1,104 errors/2571 warnings**, sama baseline checkpoint6 | `checkpoint7-frontend-lint.log` |
| Full production build | **exit0,954.02s (15m54s),29.9MB/5.36MB gzip** | `checkpoint7-frontend-build.log`; Nitro built + `Build complete!` + exit aktual |
| Live HTTP melalui server production build + Nuxt proxy | **exit0**, PGlite memory TEST baru; recurring source retry, invoice asli linked, unknown pending, Admin403; prepaid regression ikut dicek | `checkpoint7-http-smoke.log`, `checkpoint7-uat-backend.log`, `checkpoint7-uat-frontend.log` |
| SSR accounting dan funding | **HTTP200** pada dua route | Smoke di atas; ini hanya shell SSR, bukan browser hydration/UAT |
| Browser/keyboard/1440/768/390 UAT | **Belum terverifikasi** | CUA inventory kosong; native Computer Use gagal initialize kernel assets |
| Whitespace diff + cleanup | `git diff --check` **exit0**; tidak ada listener3000/8080/55439 | PID/command UAT diverifikasi sebelum stop; scratchPG sudah dihentikan |

Full build selesai sepenuhnya, bukan timeout/compile sebagian. Client48.097s, SSR82.713s; Nitro tetap biaya waktu terbesar. Tidak menjalankan build kedua atau mengubah dependency/strictness untuk membuat hasil hijau. Formatting enam typed endpoint sesudah compile hanya spacing (non-whitespace comparison identik).

**Hasil fungsional checkpoint:** owner mempunyai alur biaya perusahaan rutin/tidak ditagih dari kontrak sampai invoice dan pembayaran existing, tanpa mengulang fakta jadwal atau membuat uang/expense kedua. Estimasi10 → actual12 → bayar12 menghasilkan expense12, AP0 dan cash88 dari100. Variasi actual lebih rendah, void invoice lalu void expense, unknown/retry, mandatory rollback, SQL guard, monthly/opening completeness dan crossing cutover5 → actual6 → delta expense1 sudah diuji pada engine yang disebut di atas.

**Status akhir program tetap implementation partial / accounting validation fixture-only / production belum siap, tidak diaktifkan.** Fase0 audit dan seluruh dokumen paket sudah digunakan sebagai arahan; implementasi seluruh fase/acceptance belum selesai. Kelulusan checkpoint tidak menyelesaikan agen/mixed/components (D03), recognition produksi (D04), pajak/withholding (D05), komisi (D06), owner mode/identity/private files+blob recovery, biaya/refund native B2C, CR billing, credit loss, RFQ/commodity, aset disposal, correction/AP prepaid, koreksi pra-cutover dan quality/browser gates.

Langkah independen berikutnya: lengkapi native B2C cost/refund dan CR draft billing; company expense split/approved-invoice correction/prepaid via AP; private evidence dan recovery DB+blob; policy approval/mapping serta quality gate frontend. D03/D04 tetap “belum”, tidak perlu diisi tebakan untuk melanjutkan bagian independen. Tidak ada deploy/commit/push, migrasi database aplikasi, aktivasi produksi, pembayaran nyata, pesan eksternal atau filing pajak. Perubahan pengguna dipertahankan dan database test scratch tidak dihapus.

## Checkpoint 8 — berjalan: supplier native B2C dan refund order

Kelanjutan langsung setelah instruksi pengguna agar pekerjaan terus dilaksanakan sampai selesai, tanpa meminta konfirmasi checkpoint. Implementasi bertahap tetap dalam batas lokal dan data test terisolasi; tidak deploy/commit/push/aktivasi produksi.

- Audit source menemukan supplier fulfillment secara eksplisit menolak `salesOrderId`, vendor invoice tidak mempunyai dimensi order, dan route draft customer invoice menghilangkan `salesOrderId` walaupun domain service sudah mendukungnya (DP internal bekerja). Ini diperbaiki pada sumber yang sama; tidak ada project dummy.
- Migrasi baru0055 menambah dimensi order pada vendor invoice, supplier claim dan transaksi kas yang memerlukan atribusi order. Supplier fulfillment memakai kolom order existing dengan guard scope baru. Buku kas tetap `financial_transactions`; invoice/payments/allocations/corrections existing direuse.
- Derivasi prepaid/accrual supplier sekarang memakai vendor+project+order; dua order dengan vendor sama dan project null tidak boleh saling menutup saldo. Generic company invoice juga tidak boleh menghapus retail accrual. Snapshot source lama dengan order null tetap memiliki fingerprint lama untuk retry.
- Native panel pada halaman sales order mandiri: hasil kontribusi posted GL, jasa diberikan/diterima, invoice supplier existing dan klaim/recovery existing. Admin tidak mendapat nominal. API/DTO/endpoints diperbarui bersama.
- Backend typecheck awal exit0 dan migration/company regression8/8 exit0. Tests dedicated B2C, parityPostgreSQL, frontend typecheck/tests/build dan refund order masih dikerjakan; hasil final belum diklaim.

Pembaruan checkpoint8: native order cancellation0056 memakai tabel refund/policy/credit notes/settlement existing. Pembatalan operasional sales order yang sudah punya invoice issued membuat satu kasus Finance otomatis dalam transaksi yang sama; Admin hanya status, persetujuan dan kas tetap kapabilitas Finance. Kasus finansial sendiri tidak menebak ulang fakta operasional/peserta. Void finansial tidak otomatis menghidupkan order operasional/peserta/room yang sudah dibatalkan; recovery operasional terkontrol masih perlu dituntaskan.

PGlite targeted biaya native+recognition **16/16,196 assertions,11.59s**; refund native+legacy+migration **31/31,168 assertions,23.98s** termasuk isolasi customer peserta GroupTrip. Typecheck app **103 diagnostik baseline, diff0 setelah normalisasi nomor baris**; lint source baru exit0. Parity PG awal107pass/1fail: A05 lama mencoba membayar15Oktober padahal approval tercatat21Oktober. Aturan temporal baru menolak payout sebelum approval; test nominal tetap sama, tanggal payout memakai business date approval. Rerun PG current dan frontend suite sedang berjalan.

Scope review yang ditemukan dan tetap wajib diselesaikan: sumber backdated invoice versus fulfillment yang sudah posted lebih akhir perlu posting-date/correction lifecycle eksplisit; jangan mengklaim semua varian chronology/cutover selesai. Forecast sudah memasukkan AP/refund native; tanggal cash untuk unbilled supplier obligations belum terstruktur. Approval/mapping produksi, withholding, agen/mixed, file/identity/owner mode dan daftar fase tetap partial. Setelah checks ini, lanjut CR komersial ke draft billing; tidak berhenti untuk konfirmasi rutin.

Checkpoint8 hasil antara terbaru: PostgreSQL17 scratch **108/108,10files,2848 assertions,71.30s,exit0** (`checkpoint8-postgres-final.log`); frontend penuh **1314/1314,75files,73.88s,exit0** (`checkpoint8-frontend-tests.log`). Ini tidak diklaim sebagai full backend terbaru atau browser UAT. Typecheck nyata/lint final dan full build snapshot0055/0056 diserialkan; setelah ini pekerjaan tetap dilanjutkan ke CR commercial→draft billing.

Native refund memakai party/order source yang sama; GroupTrip whole-project tidak boleh menggabungkan invoice peserta berbeda ke refund organiser (`MULTI_CUSTOMER_CASE_REQUIRED`). Pembayaran refund sebelum approval ditolak. Cancel order operasional tetap source status/peserta existing; void kasus finansial tidak mengarang pemulihan kursi/room. UI native menyebut batas status tersebut. Fingerprint pending lama dipertahankan ketika kolom order baru null.

Checkpoint8 full production build selesai **exit0,1021.11s (17m01s)** (`checkpoint8-frontend-build.log`). Targeted lint0 dan typecheck103 baseline/diff0 (`checkpoint8-frontend-typecheck-final.log`). Live server hasil build8 + fresh PGlite memory TEST + proxy Nuxt lulus (`checkpoint8-http-smoke.log`): cash/pending/report, prepaid, company invoice matching, Admin403 dan SSR shell200. Browser hydration/viewport belum terverifikasi.

## Checkpoint 9 — CR komersial ke draft invoice tertaut

Migrasi0057, service `finance/change-billing.ts`, routes finance, hooks persetujuan internal/client, DTO/endpoints dan panel detail CR. Rencana memilih komersial saja, fee saja, dua komponen terpisah atau tanpa tagihan beralasan; customer/order dan due date sesuai sumber. Tidak menebak apakah fee sudah termasuk commercial impact; D03/D04 tetap belum.

Sebelum approval belum mengubah kontrak/tagihan. Approval membuat draft invoice existing dan amendment immutable sekali per alokasi. GroupTrip menagih customer peserta dan menambah harga order masing-masing; invoice dasar peserta wajib issued. Tambahan bernomor DN saat diterbitkan. Tidak ada cash/revenue dari approval/draft atau auto-issue tanpa policy. Konfigurasi sesudah approval langsung membuat draft; tanpa rencana menunjukkan keputusan belum lengkap.

Draft sumber tidak diedit/dihapus terpisah. Void rencana beralasan mengembalikan delta kontrak tepat sekali, tidak menimpa perubahan lain. Invoice issued harus di-void dahulu; kontrak tidak boleh dikurangi di bawah jasa yang telah dipenuhi. Amendment dan draft ID tetap historis.

PGlite **23/23,3files,180assertions,23.84s,exit0** (`checkpoint9-cr-pglite-final.log`); PostgreSQL17 scratch **25/25,4files,185assertions,33.48s,exit0** (`checkpoint9-cr-postgres.log`), termasuk empty down/up. Form UI **2/2,exit0** (`checkpoint9-frontend-targeted.log`). Assertion query account type dan warnings envelope dibetulkan, nominal tetap100→110→100. Fulfillment/issue/void membuktikan revenue sekali. Dua customer mendapat3/7 dengan harga103/107; kontrak organiser tetap.

Live HTTP commerce **exit0** (`checkpoint9-commerce-http-smoke.log`), proxy produksi build8 → backend terbaru TEST memory: native order tanpa dummy, supplier invoice AP existing, operational cancellation satu refund, settlement sintetis, CR retry/draft link/void dan Admin403. Ini bukan bukti build/hydration UI CR9. Full checks source terbaru masih berjalan; bukti664/65files lama tidak disebut full suite source baru.

Status keseluruhan **implementation partial / accounting validation fixture-only / production belum siap**. Batas checkpoint8 tetap berlaku (chronology/correction, forecast timing, operational reactivation, opening). Lanjut quality gate dan gap sumber/policy/file/owner/credit-loss/aset tanpa konfirmasi rutin. Tidak deploy/commit/push/migrasi database aplikasi/pembayaran nyata/pesan eksternal.

Quality gate lanjutan checkpoint9: real app typecheck akhirnya **exit0** (`checkpoint9-frontend-typecheck-final.log`). Generic konteks array fixture diperjelas (bukan `as any`, menghapus pemeriksaan atau mengganti nominal); hal ini mengungkap channel `outreach` yang tidak sah, dikoreksi ke enum existing `sales-outreach`. Perbaikan lainnya: narrowing discriminated union cashflow, tipe BadgeTone, unwrap computed template, opsi draggable disabled di level benar, metadata import, Node22 test types eksplisit, dan typed error assertion. 103 diagnostik sebelumnya dihapus pada sumber, strictness/rules tidak dilemahkan. `@types/node` dev dependency mengikuti Node22 lokal.

Full frontend terbaru **1320/1320,76files,124.06s,exit0** (`checkpoint9-frontend-tests.log`). Lint error diperbaiki hanya pada error, tidak me-reformat ribuan warning. Sisa run terakhir1error pada arrow-parens script E2E baru sudah dikoreksi; rerun penuh sedang dilakukan. Dependency `@playwright/test` lokal untuk uji browser (Chrome existing, temporary profile, loopback saja); tidak mengubah dependency runtime app.

Blokir tool native/UI diatasi dengan test browser otomatis lokal: **1/1,19.4s,exit0** (`checkpoint8-browser-uat.log`), real production build8 + Nuxt proxy + TEST memory API. Login owner melalui tombol nyata, hydrate order supplier AP/refund, reload, dialog/Escape, Tab focus dan no horizontal overflow pada1440/768/390. Screenshot di `browser-artifacts/`; gambar390 diperiksa visual. Bukti ini menggantikan status browser-unavailable untuk journey tersebut saja; CR9 dan journey lain belum dihitung browser lulus. Tidak ada provider/produksi; semua request non-loopback diblokir.

Full backend snapshot0057 pertama **673pass/2fail,68files,6986assertions,1027.57s,exit1** (`checkpoint9-backend-pglite.log`), tidak diklaim hijau. Perbaikan: `resolveReferences` memvalidasi customer kontrak/peserta sebelum SQLcash guard; draft public tetap menolak GroupTrip yang harus melalui confirm-DP, native standalone didukung. Test lama menyebut SLO-001 sebagai peserta padahal standalone; test kini memakai SLO-006 GroupTrip untuk400 dan tetap menguji native duplicate422. Harapan nominal tidak diubah. CR GroupTrip test memakai confirm-DP existing, sehingga dua cash DP sah tetap dua; CR tidak menambah cash.

Rerun targeted **33/33,4files,246assertions,34.55s,exit0 PGlite** (`checkpoint9-regression-fixed-pglite-final.log`) dan **35/35,5files,251assertions,46.25s,exit0 PostgreSQL17** (`checkpoint9-regression-fixed-postgres.log`, termasuk migration0058 kosong). Full backend hijau terbaru belum tersedia. Frontend real typecheck verified exit0, full lint **exit0,0errors/2611warnings**; full build9 masih berlangsung. Pekerjaan independen berikutnya tidak menunggu konfirmasi.

## Checkpoint 10 — berjalan: bukti asli privat dan recovery

Migrasi0058 dan endpoint scoped `/private-files`: file asli PDF/JPEG/PNG/WebP, maksimal10MB, magic bytes, SHA256, nama aman, opaque storage key, metadata append-only terkait sumber yang sah. Disk privat lokal atau injected memory TEST; produksi tidak memilih provider/root otomatis. Download authenticated, attachment/nosniff/no-store dan checksum diperiksa. Client hanya source sendiri yang diberi visibility source-party; financial evidence internal tidak dibuka ke Admin/client. Nama attachment legacy tidak dianggap sudah berisi file.

Retry dengan idempotency/source+hash tidak menggandakan blob/source/cash. Unknown commit outcome mempertahankan blob; cleanup hanya object baru yang terkonfirmasi tidak direferensikan. Sumber dengan file tidak dihapus; invoice draft menautkan evidence pada CR/dokumen atau sesudah terbit. File hilang/rusak menghasilkan503, bukan sukses kosong. Backup DB dahulu lalu seluruh referensi append-only dan manifest checksum; restore hanya target DB/blob kosong, cocokkan kembali metadata dan hash. UI, runbook/CLI, full source regression dan recovery test sedang dikerjakan.

Tes private source awal4pass/2fail menemukan Bun menormalkan multipart MIME dan response submit proof mengembalikan invoice, bukan proofID. Kontrak multipart kini menyertakan declaredMime text yang diverifikasi terhadap magic; fixture membaca proofID sumber yang benar. Final private source PGlite **4/4,33assertions,9.91s,exit0** (`checkpoint10-private-files-pglite-final.log`). Backend typecheck terakhir exit0 sebelum penambahan recovery test. Belum mengklaim F7/seluruh program selesai.

Penutup checkpoint9 frontend: **full build exit0,1095.6s (18m16s)** (`checkpoint9-frontend-build.log`); browser produksi **2/2,35.3s,exit0** (`checkpoint9-browser-uat.log`), B2C + CR alokasi/draft/protected edit + reload1440/768/390. Frontend full1320 dan typecheck/lint0 tetap evidence source9, bukan source10 yang sedang berubah.

Checkpoint10 lanjutan: backend private file/recovery PGlite **7/7,2files,58assertions,22.51s,exit0** (`checkpoint10-private-complete-pglite.log`); PostgreSQL17 **6/6,44assertions,9.88s,exit0** (`checkpoint10-private-complete-postgres.log`). Meliputi10MB HTTP, source retention, down58 ditolak, foreign client404, missing/corrupt503, invoice/proof/payment allocation memakai fileID asli tanpa blobcopy. Recovery PGlite DB+blob+checksum target kosong **1/1,14assertions,13.82s** di log terpisah. Restore fisikPG+blob belum diverifikasi; tidak disamakan dengan SQL parity.

UI source10 sudah mencakup invoice terbit, vendor invoice, mutasi, refund, klaim supplier, company/prepaid, expense claim, dokumen/traveler dan lampiran CR/quotation/travel request. Payment proof client menyimpan sourceID lalu mengunggah file asli; nama legacy tidak lagi diklaim upload. Typed client mempertahankan FormData/boundary dan binary Blob; failure JSON menjadi error UI. Tests frontend terarah **40/40,4files,31.85s**; typecheck app finalsource10 **exit0**, setelah narrow JSON-body assertion untuk transport yang sekarang juga menerima FormData. CLI/runbook14 tidak melakukan migration/delete; restore target URL lewat environment, bukan command credentials.

UAT development awal **gagal3/3**: login diklik sebelum hydration; Vite optimizer/HMR reload ikut menginterupsi navigasi dan SSR smoke cold timeout. Tidak diklaim lolos. Tombol login menunggu mounted; LoadingBar route guards/timers hanya client dan dibersihkan (deprecated next dihapus). Frontend dibekukan saat test berikutnya. HTTP commerce fresh memory kemudian exit0. UAT private source terbaru **1/1,55.2s,exit0** (`checkpoint10-browser-private-final.log`): upload PDF asli, download bytes identik, internal visibility, saldo bank tidak berubah,390px tidak overflow dan no pageerror. Ketiga journey/full checks sedang diulang. Artefak browser berikut memakai direktori unik per run supaya evidence lama tidak tertimpa.

Full backend pertama source10 sempat tidak berjalan karena test memanggil migrateDown dengan argumen angka; typecheck menemukan signature harus `{to:57}`. Diperbaiki tanpa mengubah refusal expectation. Typecheck backend kini exit0 dan full PGlite source0058 sedang berjalan (`checkpoint10-backend-pglite.log`); hasilnya belum dihitung lulus. Implementasi keseluruhan tetap partial, accounting fixture-only, produksi tidak diaktifkan.

## Checkpoint 10 — hasil lengkap terverifikasi

Source0058: full backend PGlite **682/682,70file,7047assertions,1035.88s,exit0** (`checkpoint10-backend-pglite.log`). Frontend **1330/1330,77file,138.96s,exit0** (`checkpoint10-frontend-tests.log`). Typecheck backend dan aplikasi nyata exit0, lint **0error/2409warning,exit0**. Full production build **exit0,792.08s** (`checkpoint10-frontend-build.log`). Tidak menghitung compile parsial sebagai build lulus.

UAT browser development final **3/3,exit0** (`checkpoint10-browser-uat-final.log`); pengulangan pada hasil build produksi lokal **3/3,42.4s** (`checkpoint10-production-browser-uat.log`), meliputi native order1440/768/390, CR→draft terlindungi, upload/download bytes bukti asli dan saldo bank tidak berubah. Backend tetap TEST PGlite memory; kata produksi di sini hanya jenis build, bukan deployment/data produksi.

File privat dan backup/restore PGlite sudah mempunyai alur nyata. Restore fisik PostgreSQL+blob masih belum diverifikasi; provider/ACL/retensi produksi belum dipilih. Status seluruh paket tetap implementation partial / accounting validation fixture-only / production belum siap dan tidak diaktifkan.

## Checkpoint 11 — berjalan: invoice supplier ↔ penerimaan jasa tertentu

Migrasi0059 menambah bukti pencocokan immutable pada invoice dan fulfillment existing, tanpa buku kas baru. Kebijakan eksplisit `costMatching=receipt-links`: penerimaan mencatat cost/accrual, invoice mencatat prepaid/AP, pencocokan menutup keduanya serta hanya mengakui selisih estimasi versus aktual. Tagihan terakhir dikonfirmasi eksplisit; flag final lama tidak menebak bahwa invoice berikutnya mencakup seluruh vendor/project. Sumber lama tidak diklasifikasi ulang dengan mengganti policy terkini: jurnal parent harus berasal dari mode terstruktur yang sama, dengan leg prepaid/accrual yang benar.

Tanggal asli invoice dan jasa dipertahankan. Economic date adalah yang paling akhir di antara kedua fakta; posting date dapat dipilih pada periode terbuka sesudahnya, tidak boleh sebelum fakta atau di masa depan. Invoice paid menolak void sebelum mengubah match; pembatalan invoice/penerimaan membalik match serta sumber secara atomik, tidak mengulang uang. SQL menolak overmatching, perubahan fakta, delete/truncate dan void sumber langsung yang menyisakan match aktif.

Backend/UI/DTO sudah tersambung: panel **Jasa yang ditagih** dalam invoice supplier, form parsial/terakhir, pilihan sumber/tanggal terisi, konfirmasi dan alasan, riwayat serta pembatalan. Draft policy kini menyimpan pengaturan terbatas dari UI; tetap draft dan unknown jika keputusan belum ada. Production tidak mendapatkan fallback heuristik legacy; fallback hanya fixture test-only rehearsal lama.

Targeted pertama **7pass/1fail** karena fixture mencoba mengedit policy immutable. Fixture diperbaiki memakai versi baru, bukan melemahkan guard. Pengulangan **10/10 PGlite,128assertions,36.87s** dan **10/10 PostgreSQL17,128assertions,39.85s** (masing-masing3file, termasuk migration down/up dan monthly close). Tes tambahan payment/void, laporan kelengkapan dan browser sedang dituntaskan; angka ini bukan full backend source0059. Frontend awal4/4 lulus, typecheck menemukan dua pemanggilan RequestOptions yang salah dan sedang diverifikasi setelah perbaikan.

Checkpoint11 supplier diperluas: **28/28,5file,350assertions,40.68s PGlite** (`checkpoint11-supplier-verified-pglite.log`) dan **28/28,5file,350assertions,41.36s PostgreSQL17** (`checkpoint11-supplier-verified-postgres.log`). Memverifikasi paid invoice menolak void tanpa mengubah match, payment reversal existing lalu invoice void membalik tepat, laporan perusahaan/project dan cek bulanan tetap memperlihatkan sisa estimasi meski invoice supplier sudah approved. Perkiraan biaya akhir project ditahan/null bila prepaid dan accrual belum terselesaikan sehingga tidak dijumlah ganda; angka recognized tetap dari GL.

Recovery fisik PostgreSQL17 + file privat kini **exit0** (`checkpoint11-private-postgres-recovery-final.log`). `pg_dump`/`pg_restore` dari database sintetis baru ke database sintetis kosong, file asli disk privat, source invoice dan migration checksum identik, scoped download bytes identik, Admin403/anon401, target DB/blob terisi dan bundle rusak ditolak. Database rehearsal dan artefak dipertahankan; database aplikasi tidak disentuh. Perbaikan guard restore: objek pengguna di schema selain public atau function juga berarti target tidak kosong. Run pertama gagal pada assertion script yang salah membaca bentuk migrationStatus (restore fisik sudah selesai); assertion diperbaiki dan seluruh rehearsal diulang pada database baru. Tidak ada database dihapus/reset.

Checkpoint11 hasil source0060: mandatory match posting di deferred SQL guard ditambahkan lewat migrasi baru0060; insert/void langsung tanpa jurnal ditolak dan rollback. Final delta **11/11 PGlite,2file,138assertions,34.28s** (`checkpoint11-supplier-last-pglite.log`), **9/9 PostgreSQL17,133assertions,16.86s** (`checkpoint11-supplier-last-postgres.log`). Kombinasi regression sebelumnya29/29 PG termasuk close/recognition/B2C/migrations. Source-status API kini mengenali match/receipt/claim sehingga panel link jurnal tidak menghasilkan404.

Frontend full **1336/1336,78file,110.82s,exit0**; real typecheck exit0; lint penuh **0error/2409warning,exit0**. Refinement prefill nominal dari sisa invoice diuji ulang4/4 agar owner tidak mengetik ulang harga aktual. Full production build **exit0,1059.25s (17m39s)** (`checkpoint11-frontend-build.log`). Browser hasil build lokal + TEST memory source0060 **1/1,23.5s,exit0** (`checkpoint11-browser-uat.log`): invoice70 bertanggal sebelum receipt60, owner konfirmasi last invoice, cost70/accrual0/prepaid0, reload dan void match kembali60/60/70 tanpa mengubah bank,1440/768/390. Screenshot viewport390 sesudah animasi diperiksa: dialog x0,y0,width390,height960, no overflow/pageerror (`checkpoint11-supplier-dialog-390-settled.png`). Screenshot awal mengambil frame slide-in, bukan ukuran dialog final; evidence settled dipakai untuk visual QA.

Full backend pertama memakai `bun test` default5s dan diinterupsi setelah fixture seed timeout di bawah beban build; **tidak dihitung pass**. Pengulangan memakai script repository `bun run test` (timeout30000) pada salinan source terisolasi schema0060; manifest SHA256 dan lokasi ada di `checkpoint11-backend-source-manifest.json`, tanpa .env/.data aplikasi. Full run ini masih berlangsung (`checkpoint11-backend-pglite-final.log`); source asli dapat melanjutkan checkpoint12 tanpa mengubah snapshot test11. Delta source-status di workspace diuji terpisah pada final9/11 di atas.

## Checkpoint12 — berjalan: konfigurasi rehearsal lewat UI dan koreksi pending

Migrasi0061 menyimpan identitas event versi2 (fakta sumber tetap frozen; ID jurnal parent yang baru tersedia bukan perubahan fakta) serta review immutable proposal→versi test-only. Policy tidak diedit. Command rehearsal hanya buku rehearsal non-production, explicit confirm/reason, metode lengkap, versi draft terbaru, idempotency dan audit; tidak bisa menghasilkan validated policy produksi atau mengaktifkan buku. Settings terbatas untuk klasifikasi bisnis/metode/dana owner sedang disambungkan ke UI.

Backend awal **20/20,3file,163assertions,26.15s PGlite** (`checkpoint12-policy-pglite.log`), typecheck exit0 sebelum penambahan test baru. Invoice pending dan void pending dapat diproses setelah policy fixture sah tanpa mengubah source/fingerprint atau menambah cash. Legacy identity tetap tersimpan dan retargeting/changed facts ditolak. Production profile tetap OFF dan menolak rehearsal. UI, PG parity dan auto-resolution rantai koreksi/allocations masih dikerjakan; checkpoint12 belum selesai.

Checkpoint11 full backend selesai pada snapshot0060: **692/692,71file,7187assertions,746.28s,exit0** (`checkpoint11-backend-pglite-final.log`; elapsed termasuk typecheck766.35s). Snapshot tidak berubah selama run; manifest disimpan. Source-status delta diuji9/11 pada workspace. Seluruh program masih partial; hasil ini bukan klaim source checkpoint12 ikut full run tersebut.

Checkpoint12 diperluas dengan0062: pending marker pembatalan kas dipertahankan dan baru berstatus superseded sesudah semua jurnal asal yang tersedia mempunyai kompensasi posted persis. Tidak membuat jurnal kosong atau mengubah fingerprint. Resolusi parent memproses koreksi sumber yang sudah sah secara otomatis; allocation yang GL-nya baru tersedia sesudah cash reversal mendapat reversal sendiri dalam transaksi retry, tanpa pembayaran kedua. Guard SQL menolak supersede prematur, perubahan identitas dan edit status yang sudah resolved.

Backend target **22/22,4file,206assertions,32.97s PGlite**, typecheck exit0. Regression accounting+Finance+HR+private source **304/304,31file,4822assertions,278.02s PGlite** dan **304/304,31file,4822assertions,264.93s PostgreSQL17**, kedua exit0 (`checkpoint12-accounting-*`). Guard konfigurasi loan-owner diperketat: fixture owner funds hanya modal/prive; pinjaman harus memakai register/terms source pinjaman existing, bukan label kas. Delta policy/corrections PG **6/6,92assertions,31.22s**. Physical PG+directory-file recovery source0062 juga exit0 (`checkpoint12-private-postgres-recovery.log`), database/artefak tetap dipertahankan.

UI checkpoint12 tersambung: usulan bahasa bisnis, kategori/metode eksplisit, confirm TEST_ONLY, versi immutable, API keys stabil, retry sumber existing. Targeted frontend **5/5,2file,33.43s,exit0**, app typecheck exit0, targeted lint exit0. Browser development pertama gagal karena Vite cold-optimizer reload; run warm berikut login200 tetapi dynamic dependency discovery kembali reload saat navigasi. Tidak dihitung pass. Trace tidak menunjukkan local API gagal, hanya font eksternal sengaja diblokir. Dependencies yang benar-benar muncul pada trace kini diprebundle; pengulangan browser dan final build12 belum selesai.

Checkpoint12 browser development sesudah prebundle dependency **1/1,sekitar1.2menit,exit0** (`checkpoint12-browser-uat-prebundled.log`). Owner membuat proposal berbahasa bisnis, menegaskan TEST_ONLY, retry parent membersihkan invoice+void dari queue, source tetap void, fingerprint/jurnal2, AR/deferral0 dan bank tidak berubah; reload1440/768/390 nooverflow/pageerror. Dua run dev sebelumnya tetap dicatat gagal, tidak dihitung pass.

Frontend source12 kini dibekukan untuk typecheck/test/build serial (`checkpoint12-frontend-*.log`, command51791); full backend berjalan pada snapshot terisolasi schema0062 dengan manifest `checkpoint12-backend-source-manifest.json`. Snapshot tidak mencakup perubahan tahap berikut. Production-build UAT12 masih menunggu hasil build selesai. Tidak ada migrasi DB aplikasi/aktivasi produksi/deploy/commit/pembayaran nyata.

## Preview lokal untuk owner — 21 Oktober 2026, 23:47 Asia/Bangkok

Permintaan user: jalankan aplikasi agar hasil dapat ditinjau. Backend `accounting-rehearsal.ts` existing tetap TEST/PGlite memory, schema62, tanpa migrasi database aplikasi. Frontend preview localhost:8080 tersambung ke backend127.0.0.1:3000.

Dev awal gagal: pemuatan login timeout dan Vite melaporkan EPERM saat rename cache dependency. Error juga muncul pada cache terpisah, sehingga penyebabnya tidak boleh disimpulkan hanya build bersamaan. Solusi preview sementara memakai Nuxt layer di TEMP `manova-accounting-preview-6980c58d6da847e3945b956c68237f80`, cache unik, optimizeDeps.noDiscovery=true, SSR=false, output server diarahkan ke log TEMP. Tidak mengubah source/config repository untuk workaround ini. Ini bukti preview client-rendered, bukan bukti production build/SSR.

Browser Chrome nyata, jaringan non-loopback diblokir: login tombol Super Admin berhasil; `/auth/me`200; halaman `/finance/accounting` menampilkan heading Laporan & Cek Bulanan; `/accounting/setup`200; pageErrors kosong; script exit0. Screenshot `local-preview-accounting.png` diperiksa visual. Buku yang ditampilkan TEST_ONLY rehearsal/shadow; produksi tetap tidak aktif. Data uji sementara hilang saat backend direstart. Percobaan membuka browser user otomatis melalui Start-Process ditolak policy tool; link diberikan agar user membuka sendiri.

## Checkpoint 12 — hasil final yang dibaca 22 Oktober 2026

Full backend pada snapshot schema0062 selesai **698 pass / 0 fail / 73 file / 7282 assertions, exit0,1457.88s** (`checkpoint12-backend-pglite.log`; elapsed termasuk typecheck1501.69s). Full frontend build12 selesai **exit0,1639.65s** (`checkpoint12-frontend-build.log`). Ini evidence source12 sebelum koreksi runtime halaman funding pada checkpoint13; build lulus tidak membuktikan setiap halaman bebas bug runtime.

## Checkpoint 13 — koreksi halaman kosong yang ditemukan owner, 22 Oktober 2026

Owner melaporkan konten kosong pada navigasi Kasbon/Laporan/Aset dengan akun Finance. Log browser/server membuktikan `ReferenceError: Cannot access 'dialog' before initialization` pada funding.vue: callback watch di useFinanceLookups dibaca saat setup sebelum dialog dibuat. Deklarasi state dipindah sebelum composable yang menggunakannya. Tidak mengganti hak akses atau mengubah transaksi.

Audit form terkait menemukan query inventaris dan karyawan memiliki enabled tetapi tidak berlangganan perubahan open. Ditambahkan watch lokal agar daftar sumber dimuat saat form dibuka (tanpa mengubah composable global). E2E nyata memakai akun Finance dan Super Admin, mengklik tiga submenu, reload dan membuka form. Run dasar sebelum pengujian opsi **2/2 pass,1.2menit,exit0** (`checkpoint13-finance-navigation-browser-verified.log`). Run awal konfigurasi selector submenu dihentikan dan tidak dihitung pass. Run opsi pertama gagal ketika Escape setelah pemilihan dropdown tidak menutup dialog; pengulangan menguji penutupan eksplisit Batal setelah memilih, Escape tetap diuji pada dialog tanpa pemilihan dropdown. Tidak menyimpulkan perilaku Escape setelah dropdown sudah benar.

Pengujian opsi, lint akhir, dan typecheck source13 masih berjalan; hasil final ditambahkan setelah selesai. Source perbaikan sudah dilayani server preview lokal, DB tetap TEST memory dan tidak direstart. Tidak ada migrasi database aplikasi, commit/push/deploy/aktivasi buku produksi. Seluruh program tetap partial.

Checkpoint13 final: **browser 2/2 pass,1.4menit,exit0** (`checkpoint13-finance-navigation-complete-browser.log`), Finance42.2s dan SuperAdmin35.2s. Masing-masing menavigasi tiga submenu, me-reload halaman, memverifikasi API200, membuka form aset/pinjaman/kasbon/bukti biaya, mengambil daftar inventaris/karyawan nyata dan memilih entri dari dropdown tanpa menyimpan transaksi; pageErrors kosong. Screenshot funding1440 akun Finance diperiksa visual dan menampilkan konten lengkap, bukan layar kosong. **Lint file perubahan exit0** (`checkpoint13-finance-navigation-lint-complete.log`); **typecheck aplikasi nyata exit0** (`checkpoint13-frontend-typecheck.log`). Tidak mengulang full backend karena backend tidak berubah; full build12 tidak diklaim mencakup source13. Catatan keterbatasan keyboard setelah dropdown pada run sebelumnya tetap berlaku, bukan klaim diselesaikan. Preview tetap aktif dengan source perbaikan; user diminta hard refresh untuk memulihkan state setelah exception lama.

## Checkpoint 14 — data demo perusahaan 12 bulan, 22 Oktober 2026

Permintaan owner: isi sistem dengan data dummy seolah perusahaan telah berjalan satu tahun. Implementasi baru `seed-owner-year-demo.ts` memakai referensi/project existing dari demo-core.json dan layanan Finance/HR/accounting nyata. Tidak mengedit jurnal/saldo untuk mengarang hasil. Cerita tetap November2025–22Oktober2026, 12 bulan kalender, bulan berjalan belum penuh. Dataset dibuat sekali, atomic, pada database khusus `backend/.data/owner-year-demo-v1/database`; tidak membaca DATABASE_URL aplikasi. Seed menolak production dan database berisi data lain; tidak ada reset/delete. Audit marker+advisory lock mencegah penggandaan dan eksekusi ulang mempertahankan input pengguna.

Isi seed aktual: **40 project histori,40 invoice customer,40 invoice supplier,221 transaksi kas,577 jurnal source-backed,0 pending**. Ada 3 rekening terverifikasi, saldo awal dari rekening yang sama, pembayaran parsial/lunas/terlambat, piutang/utang terbuka, fulfillment customer/supplier dan explicit receipt matching, biaya bulanan, transfer+fee, payroll approve+payment nyata, kasbon/bukti/sisa/reimbursement sebagian, aset/depresiasi, pinjaman/cicilan, prepaid/amortisasi. Payroll fixture lama yang sekadar berstatus paid tidak disalin; payroll sejarah dibuat lewat source services. Seluruh nominal baru memakai bigint/string; tidak memakai seed lama yang memetakan manual payroll/pajak sebagai biaya accounting. Policy dibuat lewat draft+rehearse TEST_ONLY; profil entitas/pajak tetap unknown, buku shadow, tidak ada policy validated produksi.

Perintah baru: root `npm run demo:year` (backend `bun run demo:year`), seed+migrate hanya DB demo khusus lalu APIloopback3000; `--port 3001` untuk coexist dan `--seed-only` untuk mengisi lalu menutup DB. Private file persisten pada folder khusus sibling. README root dan panduan15 menjelaskan clone/install/run, port, penyimpanan dan filter laporan. Tidak ada commit/push/deploy atau perubahan DB aplikasi. Preview memori lama3000 tetap hidup untuk menjaga sesi/datanya; frontend8080 kini diproxy ke demo persisten3001, bukan DB aplikasi.

Verifikasi:
- Backend typecheck exit0 (`checkpoint14-backend-typecheck-verified.log`).
- Recipe PGlite **5/5,35 assertions,35.78s,exit0** (`checkpoint14-year-demo-pglite-final.log`) dan PostgreSQL17 scratch **5/5,35 assertions,31.62s,exit0** (`checkpoint14-year-demo-postgres.log`). Menguji 12 bulan jurnal, semua bank sama persis dengan buku kas, revenue sama dengan fulfillment sumber, replay tanpa perubahan, akun Finance200/Admin403 dan penolakan production/DB terisi.
- Run pertama menemukan field alokasi supplier bernama vendorInvoiceId dan prepaid tidak boleh dibayar setelah awal manfaat; generator dikoreksi, bukan validasi dilonggarkan. Run berikut auth test gagal karena password default testhelper berbeda dengan demo; test memakai password seed yang benar. Run gagal tidak dihitung lulus.
- Pengisian disk nyata **exit0** (`checkpoint14-persistent-demo-seed.log`), startup berikut `skipped:true`, tidak mengulang input.
- Browser Finance nyata **1/1,53.1s,exit0** (`checkpoint14-year-demo-browser.log`): halaman accounting, kasbon, aset/pinjaman berisi source nyata; form Finance membuat LON-002/TRX-000222 sebesar1juta, reload tetap ada; tidak ada pageErrors. Setelah UAT tersebut data aktual mempunyai satu transaksi contoh tambahan terhadap hitungan seed.
- Backend3001 benar-benar dihentikan/dibuka ulang. API setelah restart menemukan LON-002 dan neraca saldo balanced (`checkpoint14-restart-proof.json`).
- Browser laporan setelah restart **1/1,13.4s,exit0** (`checkpoint14-year-demo-report-final.log`), menunggu kartu laba rugi benar-benar berubah ke rentang2025-11-01–2026-10-22 dan nominal revenue sama dengan API, bukan hanya menunggu heading. Screenshot awal sempat mengambil keadaan loading/hasil bulan lama; assertion diperkuat. Revenue fiktif33.470.000.000 dan laba sebelum pajak6.994.722.000; netProfit null karena profil pajak unknown.
- Frontend typecheck exit0 (`checkpoint14-frontend-typecheck.log`); lint file E2E/config akhir diverifikasi terpisah. Tidak mengklaim full suite/build lama mencakup source baru; runtime app frontend tidak diubah untuk menambah dataset.

Seluruh paket accounting tetap partial; ini penambahan data demo source-backed untuk fitur yang tersedia, bukan implementasi pajak/agen/komisi yang masih menjadi gap.

## Checkpoint 15 — rekening koran demo yang semula kosong, 22 Oktober 2026

Owner menemukan Cocokkan Rekening Koran kosong meskipun kas sudah ada. Penyebab aktual: paket14 belum memasukkan fixture bank statement, bukan API kas hilang. Tambahan `seed-owner-year-statements.ts` mengimpor rekening koran sintetis melalui importStatement dan mencocokkan lewat matchStatementLine. Hanya mengambil transaksi asli seed ber-provenance demo-fixture, tidak mengarang konfirmasi bank atas transaksi baru/input pengguna atau transaksi yang sudah dibalik. Tidak membuat baris bank untuk rekening yang tidak mempunyai mutasi.

Semua bulan dengan mutasi mempunyai contoh statement. Mayoritas transaksi historis sudah Cocok; beberapa transaksi Oktober disisakan Belum cocok untuk latihan. Ditambahkan dua baris bank-only untuk review: biaya admin12500 dan setoran belum diidentifikasi3juta. Keduanya tetap belum menjadi transaksi kas/jurnal sampai pengguna memilih tindakan sumber secara eksplisit. Assertion membandingkan jumlah cash+jurnal sebelum/sesudah fixture dan rollback jika berubah.

Recipe versi awal mendapat revisi additive sekali saat `demo:year` berikutnya. Audit marker tambahan mencegah mengulang match, sehingga tindakan user setelahnya tidak dikembalikan. Buku harus rehearsal/shadow dengan identitas demo yang sesuai. Database aplikasi tidak dibuka; DB demo persisten3001 direstart untuk memuat revisi, frontend tetap8080, preview memori lama3000 dipertahankan. Pinjaman LON-002 hasil input browser sebelumnya tidak dihapus atau di-seed ulang.

Verifikasi backend recipe+rekonsiliasi **11/11,86 assertions,41.03s PGlite** dan **11/11,86 assertions,33.39s PostgreSQL17 scratch**, keduanya exit0 (`checkpoint15-bank-demo-*.log`). Backend typecheck exit0. Browser Finance nyata **1/1,17.5s,exit0** (`checkpoint15-bank-demo-browser.log`): baris Oktober berisi Cocok/Belum cocok; kandidat yang benar dipilih melalui tombol, API match sukses, reload mempertahankan Cocok; saldo bank dan seluruh baris neraca saldo identik sebelum/sesudah pencocokan; pageErrors kosong. Lint E2E exit0 (`checkpoint15-bank-demo-lint.log`). Panduan15 diperbarui. Tidak mengubah UI aplikasi, mengaktifkan produksi, commit/push/deploy atau menghapus data pengguna. Seluruh paket masih partial.

## Commit lokal diminta owner — 22 Oktober 2026

Owner memberi instruksi eksplisit "commit" setelah checkpoint15. Instruksi ini mengizinkan commit lokal pekerjaan accounting, integrasi, quality fixes dan demo12bulan; bukan push/deploy atau aktivasi produksi. Baseline fase0 mencatat tracked tree awal bersih dan tiga paket untracked pengguna. Folder app/ dan docs/MANOVA_FINANCE_CLAUDE_CODE_PACKAGE/ yang tidak dikerjakan tetap di luar commit. Spesifikasi owner-accounting yang digunakan serta progres/panduan ikut commit. Database, .env, log dan browser traces/screenshot/artefak lokal tidak dimasukkan; .gitignore dipertegas untuk output verifikasi tersebut. Pemeriksaan staged diff/whitespace lulus. Validasi kode terbaru tetap evidence checkpoint12–15 di atas; commit tidak mengklaim seluruh acceptance paket selesai.
