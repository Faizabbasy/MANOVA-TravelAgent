Section 23 — Administration, Master Data dan Audit

Baca dan jalankan section ini berdasarkan prompts/01-PROTOKOL-WAJIB.md.

Sebelum Mulai

Baca seluruh docs/ dan laporan section sebelumnya.

Periksa git status dan codebase aktual.

Identifikasi apa yang sudah selesai agar tidak dikerjakan ulang.

Tandai Section 23 sebagai IN_PROGRESS.

Scope

Lengkapi administration frontend.

Wajib:

Users, roles, permissions, organizations.

Destinations, airports, airlines, hotels, service/project types.

Currencies, taxes, payment terms, cancellation rules.

Numbering, templates, readiness gates, assignment rules.

Audit trail search.

Access review and suspended user state.

Feature/configuration forms frontend.

Historical snapshot warning ketika master berubah.

Acceptance:

Super Admin dapat mengelola seluruh konfigurasi frontend tanpa menjadi approver komersial.

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

Buat laporan:docs/mockup-section-reports/section-23-admin-master-audit.md

Berikan URL review.

Berhenti.