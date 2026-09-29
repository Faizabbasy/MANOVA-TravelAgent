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
- [ ] Posted cash movement, allocation, reversal, idempotency, audit, proof metadata.
- [ ] Account Statement actual-only, filter/drilldown; Account Ledger per bank/account opening/in/out/closing/running balance.
- [ ] Customer invoice/billing schedule + AR outstanding/expected/due/partial receipt.
- [ ] Vendor invoice/deposit + AP outstanding/expected/due/partial disbursement.
- [ ] Vendor/Booking/Project finance context dari record yang sama; client/supplier DTO tersanitasi.
- [ ] Internal transfer dua kaki + fee, company cash reconcile.

## UI baru

- [ ] Semua UI finance mock lama dihapus setelah consumer pindah; import/deep links tidak putus.
- [ ] Sidebar tepat enam menu: Dashboard, Statement, Ledger, Receivable, Payable, Cash Flow.
- [ ] Enam halaman tersambung API dengan loading/error/empty/filter empty/success dan mobile/keyboard support.
- [ ] Dashboard cash/inflow/outflow/AR/AP/projected/gap/recent reconcile dengan detail.

## Cancellation/refund/cashflow

- [ ] Policy master versioned multi-tier, scope/effective date/basis, rule validation.
- [ ] Booking policy snapshot dan H boundary tests.
- [ ] Refund mengacu payment asli, credit note/obligation tidak double count.
- [ ] Settlement posted dari rekening, statement/ledger/booking history diperbarui atomik.
- [ ] Cashflow 30d/3m/6m/12m dari current cash + outstanding AR − outstanding AP/refund; account/project filter, overdue, confidence, warnings.

## Release acceptance

- [ ] Permission negative tests untuk role/ID tampering, proof access, audit trace.
- [ ] Numeric reconciliation dan E2E journeys `10-TESTING-AND-ACCEPTANCE-CRITERIA.md` lulus.
- [ ] Browser desktop/tablet/mobile, keyboard/accessibility, deep-link redirects.
- [ ] Data migration/cutover rehearsal, backup/restore, no destructive seed.
- [ ] Semua laporan fase berisi file, check, hasil, risiko; status implementation/deployment/runtime dibedakan.
