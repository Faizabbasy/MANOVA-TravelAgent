Section 07 — Customer Journey

Baca dan jalankan section ini berdasarkan prompts/01-PROTOKOL-WAJIB.md.

Sebelum Mulai

Baca seluruh docs/ dan laporan section sebelumnya.

Periksa git status dan codebase aktual.

Identifikasi apa yang sudah selesai agar tidak dikerjakan ulang.

Tandai Section 07 sebagai IN_PROGRESS.

Scope

Lengkapi Customer Journey Dashboard untuk Super Admin dan Account Executive.

Wajib:

Overview funnel Lead→Qualified→Opportunity→Approved→Won→Client→Project Order.

Leads Table/Kanban/Inbox dengan drawer.

Customers/Companies list.

Customer detail tabs:Overview, Contacts, Opportunities, Project Orders, Activities, Documents.

Project Orders list dan detail.

Drill-down dari metrics ke records.

Filters by source, owner, stage, client, date, project type.

AE data scope ke portfolio miliknya; Super Admin seluruh data.

Acceptance:

Semua entity saling terhubung dan tidak menggunakan dataset paralel.

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

Buat laporan:docs/mockup-section-reports/section-07-customer-journey.md

Berikan URL review.

Berhenti.