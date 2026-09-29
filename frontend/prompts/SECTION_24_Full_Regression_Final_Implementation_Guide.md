Section 24 — Full Regression dan Final Implementation Guide

Baca dan jalankan section ini berdasarkan prompts/01-PROTOKOL-WAJIB.md.

Sebelum Mulai

Baca seluruh docs/ dan laporan section sebelumnya.

Periksa git status dan codebase aktual.

Identifikasi apa yang sudah selesai agar tidak dikerjakan ulang.

Tandai Section 24 sebagai IN_PROGRESS.

Scope

Audit seluruh frontend dari progres pertama sampai Project Closed.

Wajib:

Uji semua role.

Uji complete flow:Lead→Qualification→AE→Opportunity→Quotation→Management Approval→Client Confirmation→Won→Active Client→Project Order→Handover→Planning→Traveler→Supplier→Booking→Ready→On Trip→Finance→Completed→Closed.

Uji rejection, revision, duplicate prevention, cancellation, refund, incident, overdue, supplier failure, schedule change.

Periksa all routes, navigation, permissions, data consistency, terminology, responsive, empty/loading/error/unauthorized/not-found.

Jalankan lint, typecheck, test, build.

Perbaiki bug nyata tanpa redesign besar.

Project Closed membutuhkan:services completed,finance finalized,unresolved issues handled,documents complete,client feedback/final note,closure summary.

Final docs:

Update seluruh docs existing.

Final docs/frontend-module-map.md.

Final docs/frontend-workflow-map.md.

Final docs/frontend-implementation-roadmap.md.

Buat docs/frontend-end-to-end-implementation-guide.md yang menjelaskan langkah implementasi frontend dari kondisi awal sampai selesai, urutan dependency, file penting, state architecture, per-role modules, testing, review, dan maintenance.

Final docs/frontend-known-issues.md.

Final docs/frontend-demo-and-review-guide.md.

Final implementation state dan route inventory.

Acceptance:

Tidak ada workflow frontend utama yang buntu.

Tidak ada role yang kehilangan action inti.

Semua known issues dilaporkan jujur.

Tidak ada klaim backend/integrasi/persistence produksi.

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

Buat laporan:docs/mockup-section-reports/section-24-full-regression-final-docs.md

Berikan URL review.

Berhenti.