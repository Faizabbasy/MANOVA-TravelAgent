Section 01 — Frontend Foundation dan State Governance

Baca dan jalankan section ini berdasarkan prompts/01-PROTOKOL-WAJIB.md.

Sebelum Mulai

Baca seluruh docs/ dan laporan section sebelumnya.

Periksa git status dan codebase aktual.

Identifikasi apa yang sudah selesai agar tidak dikerjakan ulang.

Tandai Section 01 sebagai IN_PROGRESS.

Scope

Lengkapi hanya gap foundation frontend.

Wajib:

Domain types dan status constants terpusat.

Mock repository/service layer agar pages tidak membaca fixture langsung.

Centralized stores/state per domain.

Stable IDs dan relasi konsisten.

State reset, seed scenario, loading/error simulation.

Mock persistence yang jelas bila dibutuhkan.

Format currency/date/timezone.

Activity generator dan transition helper.

Permission/data-scope helper terpusat.

Shared UI: page header, detail shell, drawer, table, filter, status, timeline, form states, empty/error/unauthorized/not-found.

Jangan mengganti foundation existing yang sudah sehat.

Acceptance:

Semua section berikutnya memakai source of truth yang sama.

Tidak ada fixture terduplikasi per halaman.

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

Buat laporan:docs/mockup-section-reports/section-01-frontend-foundation-state-governance.md

Berikan URL review.

Berhenti.