# Checklist implementasi (salin ke repo saat Phase 1)

Status awal semua belum dikerjakan. Centang hanya dengan bukti file/test/route. Simpan catatan `Evidence:` di bawah item atau tautkan laporan fase.

## Phase 1 — baseline/foundation

- [x] Catat branch/HEAD/status Git dan instruksi lokal; identifikasi perubahan user.
  Evidence: `01-CURRENT-STATE-ASSESSMENT.md` § "Delta audit Phase 1" (branch `monorepo` @ `685d708`; satu-satunya untracked `docs/MANOVA_FINANCE_CLAUDE_CODE_PACKAGE/` dibiarkan).
- [x] Buat matriks consumer finance mock lintas frontend termasuk `project-orders`, `client`, `vendors`, booking, dashboard, navigation, tests.
  Evidence: `finance-consumer-matrix.md` (consumer → kontrak → fase → regression check; peta redirect deep link).
- [x] Audit ulang package, deployment env, DB/auth yang mungkin baru ditambahkan.
  Evidence: delta audit (toolchain, PostgreSQL 17 lokal, Docker mati, tidak ada DB/auth/HTTP di repo).
- [x] Tulis ADR DB + migration runner + auth + API client + typed booking reference + demo/production cutover.
  Evidence: `adr/ADR-001` … `ADR-004` (Accepted), `adr/ADR-005` proof storage (Proposed, diputuskan awal Phase 2).
- [x] Backend health, env validation, error envelope, request ID, migration command, test runner.
  Evidence: `backend/src/{config/env.ts,app.ts,http/*,modules/health/routes.ts}`, `backend/scripts/db.ts`; `bun test` 86/86 pada PGlite dan pada PostgreSQL 17 (lihat laporan Phase 1).
- [x] Core Party/Project/Vendor/Booking reference strategy terbukti lewat test; server authorization dasar.
  Evidence: migrasi `0002_core_references`, `0003_identity`; `backend/test/core-scope.test.ts` (scope client/vendor/internal, ID tampering, 404 di luar scope), `http.test.ts` (sesi, CSRF, throttle, audit), `rbac.test.ts`.
- [x] Frontend typed API client skeleton/runtime config; tidak ada finance UI mock baru.
  Evidence: `frontend/app/lib/api/*`, `app/lib/money.ts`, `app/types/api.ts`, `app/composables/useApi.ts`, `nuxt.config.ts` (`runtimeConfig`, proxy `/api/v1/**`); 15 test baru. Tidak ada halaman/komponen yang diubah.
- [x] Catat baseline frontend lint/typecheck/test/build dan backend checks; non-finance smoke.
  Evidence: `phase-reports/phase-1-report.md` §3 — baseline vs sesudah (lint identik dengan baseline yang sudah gagal 81 error; typecheck, test 192, build lulus), backend typecheck + 86 test × 2 engine + rehearsal Postgres, smoke browser 7 halaman non-finance + proxy/login.

## Money, AR/AP, statement/ledger

- [ ] Rekening + opening verified/cutover + directional transfer fee.
  Progress (Phase 2): rekening, saldo pembuka maker (Finance) / checker (Super Admin), dan cutover **selesai**. Biaya transfer masih diinput manual per transfer; aturan biaya per arah (`transfer_fee_rules`) belum dibuat. Evidence: `backend/src/modules/finance/accounts.ts`, `test/finance-money.test.ts`.
- [ ] Posted cash movement, allocation, reversal, idempotency, audit, proof metadata.
  Progress (Phase 2–3): buku kas immutable (trigger DB), reversal sekali dengan alasan, Idempotency-Key, audit, dan alokasi parsial + uang muka (Phase 3) **selesai**. Yang tersisa: bukti transfer (menunggu ADR-005).
- [x] Account Statement actual-only, filter/drilldown; Account Ledger per bank/account opening/in/out/closing/running balance.
  Evidence (API; UI di Phase 4): `GET /api/v1/finance/statement` (filter tanggal/rekening/project/arah/jenis, total operasional tanpa transfer internal, cursor stabil), `GET /api/v1/finance/accounts/{id}/ledger` (saldo awal/masuk/keluar/akhir + saldo berjalan, dipotong di tanggal cutover). Test rekonsiliasi di `test/finance-money.test.ts`.
- [x] Customer invoice/billing schedule + AR outstanding/expected/due/partial receipt.
  Evidence: migrasi `0008`, `backend/src/modules/finance/receivables.ts`, `test/finance-arap.test.ts`. Mencakup: jadwal DP/termin → draft → terbit (dibekukan trigger DB) → penerimaan parsial → uang muka → alokasi belakangan → credit note → void; sisa tagihan satu rumus (`v_customer_invoice_balances`); tanggal perkiraan terpisah dari jatuh tempo.
- [x] Vendor invoice/deposit + AP outstanding/expected/due/partial disbursement.
  Evidence: `backend/src/modules/finance/payables.ts`, `test/finance-arap.test.ts`. Mencakup: invoice vendor (nomor unik per vendor, terhubung service order/project) → review → setujui/tolak; persetujuan tidak memindahkan kas; bayar parsial; deposit vendor dialokasikan kemudian; void hanya tanpa pembayaran.
- [ ] Vendor/Booking/Project finance context dari record yang sama; client/supplier DTO tersanitasi.
  Progress (Phase 3): `GET /projects|bookings|vendors|parties/{id}/finance-summary` dari record yang sama — lengkap untuk Finance/Super Admin, status tanpa nominal untuk Admin (diuji: tidak ada satu pun field uang). DTO portal client/supplier menunggu aktivasi portal (ADR-006).
- [x] Internal transfer dua kaki + fee, company cash reconcile.
  Evidence: `POST /api/v1/finance/transfers` (out + in + fee dalam satu transaksi DB, kas perusahaan hanya turun sebesar biaya), pembatalan seluruh kaki sekaligus. Test di `test/finance-money.test.ts`, lulus di PGlite dan PostgreSQL 17.

## UI baru

- [x] Semua UI finance mock lama dihapus setelah consumer pindah; import/deep links tidak putus.
  Evidence (Phase 4): 9 panel `components/finance/*Panel.vue` + ringkasan mock dihapus; 7 route lama redirect (`phase-reports/phase-4-report.md`). Mock `data/finance*.ts` tetap untuk consumer non-finance (Phase 5–7).
- [x] Sidebar tepat enam menu: Dashboard, Statement, Ledger, Receivable, Payable, Cash Flow.
  Evidence (Phase 6): `constants/navigation.ts` — Ringkasan, Mutasi Rekening, Rekening & Saldo, Piutang Customer, Utang Vendor, Cash Flow; test `navigation.test.ts`.
- [ ] Enam halaman tersambung API dengan loading/error/empty/filter empty/success dan mobile/keyboard support.
  Status: enam halaman tersambung API dan diuji di browser 1440/390px (Cash Flow: `phase-reports/phase-6-report.md`). Audit keyboard/aksesibilitas menyeluruh di Phase 7.
- [x] Dashboard cash/inflow/outflow/AR/AP/projected/gap/recent reconcile dengan detail.
  Evidence: Ringkasan Finance memakai endpoint yang sama dengan layar detail; Phase 6 menambah kartu "Perkiraan saldo 30 hari lagi" dan butir saldo minus dari `GET /finance/cash-flow` (sama dengan halaman Cash Flow).

## Cancellation/refund/cashflow

- [x] Policy master versioned multi-tier, scope/effective date/basis, rule validation.
  Evidence (Phase 5): `cancellation_policies` + tiers, trigger freeze, validasi tingkat (backend + editor), `test/finance-refunds.test.ts`.
- [x] Booking policy snapshot dan H boundary tests.
  Evidence: `cancellation_policy_assignments` (snapshot, pewarisan dari project), test H-30/14/7/1/0 dan "policy v2 tidak mengubah kasus".
- [x] Refund mengacu payment asli, credit note/obligation tidak double count.
  Evidence: `source_payments` per kasus; `reduce_receivable` (write-off) vs `refund_liability` (refund) terpisah; test acceptance H-7 DP 20 jt → refund 6 jt.
- [x] Settlement posted dari rekening, statement/ledger/booking history diperbarui atomik.
  Evidence: `refund_settlement` + alokasi dalam satu transaksi DB, idempotent; reversal membuka kembali kasus (`phase-reports/phase-5-report.md`).
- [x] Cashflow 30d/3m/6m/12m dari current cash + outstanding AR − outstanding AP/refund; account/project filter, overdue, confidence, warnings.
  Evidence (Phase 6): `backend/src/modules/finance/cashflow.ts`, `test/finance-cashflow.test.ts` (34 test, contoh numerik 07, rekonsiliasi baris = rincian), `pages/finance/cash-flow.vue`; `phase-reports/phase-6-report.md`.

## Release acceptance

- [ ] Permission negative tests untuk role/ID tampering, proof access, audit trace.
- [ ] Numeric reconciliation dan E2E journeys `10-TESTING-AND-ACCEPTANCE-CRITERIA.md` lulus.
- [ ] Browser desktop/tablet/mobile, keyboard/accessibility, deep-link redirects.
- [ ] Data migration/cutover rehearsal, backup/restore, no destructive seed.
- [ ] Semua laporan fase berisi file, check, hasil, risiko; status implementation/deployment/runtime dibedakan.
