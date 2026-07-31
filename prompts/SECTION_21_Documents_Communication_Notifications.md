Section 21 — Documents, Communication dan Notifications

Baca dan jalankan section ini berdasarkan prompts/01-PROTOKOL-WAJIB.md.

Sebelum Mulai

Baca seluruh docs/ dan laporan section sebelumnya.

Periksa git status dan codebase aktual.

Identifikasi apa yang sudah selesai agar tidak dikerjakan ulang.

Tandai Section 21 sebagai IN_PROGRESS.

Scope

Lengkapi cross-module communication.

Wajib:

Document folders per entity/project.

Categories, versions, expiry, access level.

Internal/client/supplier visibility.

Generated document previews.

Internal notes, client messages, supplier messages.

In-app notification center.

Email/WhatsApp delivery status simulation tanpa klaim integrasi.

Mentions, assignments, reminders, escalation.

Unified activity timeline dengan filtering akses.

Acceptance:

Dokumen dan komunikasi dapat ditelusuri ke entity dan tidak bocor lintas role.

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

Buat laporan:docs/mockup-section-reports/section-21-documents-comms-notifications.md

Berikan URL review.

Berhenti.