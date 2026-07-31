Section 13 — Ticketing

Baca dan jalankan section ini berdasarkan prompts/01-PROTOKOL-WAJIB.md.

Sebelum Mulai

Baca seluruh docs/ dan laporan section sebelumnya.

Periksa git status dan codebase aktual.

Identifikasi apa yang sudah selesai agar tidak dikerjakan ulang.

Tandai Section 13 sebagai IN_PROGRESS.

Scope

Lengkapi lifecycle flight frontend.

Wajib:

Flight request/options.

Fare/cabin/baggage/ancillary display.

PNR/order reference mock.

Segments dan traveler assignment.

Ticketing deadline.

Hold, Confirm, Issue, Reissue, Cancel, Refund state simulation.

Group booking/name list.

Schedule change/disruption.

Fare rules and financial impact.

Internal net cost vs client sell price.

Documents/ticket preview.

Acceptance:

Ticketing role dapat mengelola flight dari request sampai completed/refunded pada mock workflow.

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

Buat laporan:docs/mockup-section-reports/section-13-ticketing.md

Berikan URL review.

Berhenti.