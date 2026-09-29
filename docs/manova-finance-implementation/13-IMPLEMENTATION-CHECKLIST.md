# Checklist implementasi (salin ke repo saat Phase 1)

Status awal semua belum dikerjakan. Centang hanya dengan bukti file/test/route. Simpan catatan `Evidence:` di bawah item atau tautkan laporan fase.

## Phase 1 — baseline/foundation

- [ ] Catat branch/HEAD/status Git dan instruksi lokal; identifikasi perubahan user.
- [ ] Buat matriks consumer finance mock lintas frontend termasuk `project-orders`, `client`, `vendors`, booking, dashboard, navigation, tests.
- [ ] Audit ulang package, deployment env, DB/auth yang mungkin baru ditambahkan.
- [ ] Tulis ADR DB + migration runner + auth + API client + typed booking reference + demo/production cutover.
- [ ] Backend health, env validation, error envelope, request ID, migration command, test runner.
- [ ] Core Party/Project/Vendor/Booking reference strategy terbukti lewat test; server authorization dasar.
- [ ] Frontend typed API client skeleton/runtime config; tidak ada finance UI mock baru.
- [ ] Catat baseline frontend lint/typecheck/test/build dan backend checks; non-finance smoke.

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
