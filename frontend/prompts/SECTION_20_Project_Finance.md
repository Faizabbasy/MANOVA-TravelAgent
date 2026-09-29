Section 20 — Project Finance

Baca dan jalankan section ini berdasarkan prompts/01-PROTOKOL-WAJIB.md.

Sebelum Mulai

Baca seluruh docs/ dan laporan section sebelumnya.

Periksa git status dan codebase aktual.

Identifikasi apa yang sudah selesai agar tidak dikerjakan ulang.

Tandai Section 20 sebagai IN_PROGRESS.

Scope

Lengkapi finance frontend tanpa backend.

Wajib:

Budget, estimate, committed cost, actual cost, variance, margin.

Multi-currency display dan exchange-rate snapshot mock.

Client invoice, DP, payment, outstanding, aging.

Supplier invoice/AP, payment schedule, match status.

Refund/credit/debit note states.

Reconciliation workspace mock.

Financial permissions.

Client hanya melihat sell-side invoice/payment.

Supplier hanya melihat invoice miliknya.

Acceptance:

Finance dapat menjalankan frontend workflow AR/AP sampai settlement dan closure gate.

Ketentuan

Frontend-only. Jangan membuat backend, API produksi, database, migration, queue, webhook, atau integrasi nyata.

Gunakan typed fixtures, centralized state, mock repository, dan komponen existing.

Implementasikan seluruh UI/action/state/permission yang berada dalam scope.

Perubahan lintas section harus minimal, dicatat, dan regression-tested.

Jangan lanjut ke section berikutnya.

Setelah Selesai

Jalankan formatter file terkait, lint, typecheck, test, dan build.

Smoke-test route dan role terkait.

Update docs, implementation state, progress, change impact log, known issues, dan module/workflow map.

Buat laporan:docs/mockup-section-reports/section-20-project-finance.md

Berikan URL review.

Berhenti.