Section 11 — Traveler dan Travel Documents

Baca dan jalankan section ini berdasarkan prompts/01-PROTOKOL-WAJIB.md.

Sebelum Mulai

Baca seluruh docs/ dan laporan section sebelumnya.

Periksa git status dan codebase aktual.

Identifikasi apa yang sudah selesai agar tidak dikerjakan ulang.

Tandai Section 11 sebagai IN_PROGRESS.

Scope

Lengkapi traveler management.

Wajib:

Traveler directory dan participants per Project Order.

Group, rooming, companion.

Passport/ID/visa metadata.

Expiry and missing document warnings.

Emergency contact, dietary, accessibility, special request.

Client self-submission.

Bulk import preview dan error report mock.

Internal verification.

Sensitive values masked sesuai role.

Manifest/rooming list export preview.

Readiness indicator.

Acceptance:

Traveler data digunakan konsisten oleh flight, hotel, transport, MICE, dan operations.

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

Buat laporan:docs/mockup-section-reports/section-11-traveler-documents.md

Berikan URL review.

Berhenti.