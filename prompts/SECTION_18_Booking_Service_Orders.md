Section 18 — Booking dan Service Orders

Baca dan jalankan section ini berdasarkan prompts/01-PROTOKOL-WAJIB.md.

Sebelum Mulai

Baca seluruh docs/ dan laporan section sebelumnya.

Periksa git status dan codebase aktual.

Identifikasi apa yang sudah selesai agar tidak dikerjakan ulang.

Tandai Section 18 sebagai IN_PROGRESS.

Scope

Bangun unified booking/service-order center.

Wajib:

Semua Flight/Hotel/Transport/MICE service requirement dalam satu timeline.

Booking references, holds, confirmations, deadlines, vouchers.

Internal/supplier/client-visible status mapping.

Split supplier.

Dependency antar-service.

Confirmation and payment gates.

Failure/retry/manual fallback simulation.

Duplicate booking prevention.

Exception list.

Acceptance:

Operations memiliki satu sumber kebenaran seluruh service.

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

Buat laporan:docs/mockup-section-reports/section-18-booking-service-orders.md

Berikan URL review.

Berhenti.