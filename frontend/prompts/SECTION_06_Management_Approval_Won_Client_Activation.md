Section 06 — Management Approval, Won dan Client Activation

Baca dan jalankan section ini berdasarkan prompts/01-PROTOKOL-WAJIB.md.

Sebelum Mulai

Baca seluruh docs/ dan laporan section sebelumnya.

Periksa git status dan codebase aktual.

Identifikasi apa yang sudah selesai agar tidak dikerjakan ulang.

Tandai Section 06 sebagai IN_PROGRESS.

Scope

Lengkapi commercial approval dan conversion frontend.

Wajib:

Management approval queue.

Detail review quotation, margin, discount, terms, complexity, risk.

Approve, reject, return for revision dengan notes/history.

Hanya Management yang mengapprove.

AE melihat result dan merevisi bila rejected.

Client confirmation mock.

AE Mark as Won hanya setelah approved dan confirmed.

Transaction simulation:Prospect→Active Client,Opportunity→Won,approved quotation final,Project Order dibuat,Account Owner AE,PM assignment,activity generated.

Duplicate Client dan Project Order prevention.

Acceptance:

Seluruh permitted dan forbidden flow dapat diuji melalui role switcher.

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

Buat laporan:docs/mockup-section-reports/section-06-management-approval-won.md

Berikan URL review.

Berhenti.