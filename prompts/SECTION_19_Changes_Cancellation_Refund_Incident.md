Section 19 — Changes, Cancellation, Refund dan Incident

Baca dan jalankan section ini berdasarkan prompts/01-PROTOKOL-WAJIB.md.

Sebelum Mulai

Baca seluruh docs/ dan laporan section sebelumnya.

Periksa git status dan codebase aktual.

Identifikasi apa yang sudah selesai agar tidak dikerjakan ulang.

Tandai Section 19 sebagai IN_PROGRESS.

Scope

Lengkapi exception management.

Wajib:

Change request dari Client/Internal/Supplier.

Before/after dan affected entities.

Operational, commercial, financial, timeline impact.

Approval states.

Additional quotation/change order.

Cancellation and penalty.

Refund request, approval, partial/full, credit status mock.

Incident severity, owner, escalation, communication, resolution.

Versioned itinerary/order history.

Client-safe visibility.

Acceptance:

High-change project dapat diselesaikan tanpa menghapus histori.

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

Buat laporan:docs/mockup-section-reports/section-19-change-cancel-refund-incident.md

Berikan URL review.

Berhenti.