Section 04 — Sales Leads dan Qualification

Baca dan jalankan section ini berdasarkan prompts/01-PROTOKOL-WAJIB.md.

Sebelum Mulai

Baca seluruh docs/ dan laporan section sebelumnya.

Periksa git status dan codebase aktual.

Identifikasi apa yang sudah selesai agar tidak dikerjakan ulang.

Tandai Section 04 sebagai IN_PROGRESS.

Scope

Lengkapi workflow Sales end-to-end.

Wajib:

Leads Table/Kanban/Inbox.

Lead right drawer: Overview, Qualification, Activities, Follow-ups.

Create/edit/archive/reopen/merge suggestion.

Qualification draft dan final:travel type, destination, period, traveler estimate, services, budget range, decision maker, urgency, expected close, notes, assigned AE.

Qualify & Create Opportunity disabled bila requirement minimum belum lengkap.

Lead→Opportunity idempotency dalam mock state.

Activity dan follow-up history.

Sales tidak membuat final quotation, tidak approve, tidak Mark as Won.

Acceptance:

Sales dapat menyelesaikan pekerjaan dari Lead masuk sampai handover ke AE tanpa workflow buntu.

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

Buat laporan:docs/mockup-section-reports/section-04-sales-leads-qualification.md

Berikan URL review.

Berhenti.