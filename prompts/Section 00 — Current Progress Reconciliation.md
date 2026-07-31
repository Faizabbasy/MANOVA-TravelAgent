Section 00 — Current Progress Reconciliation

Baca dan jalankan section ini berdasarkan prompts/01-PROTOKOL-WAJIB.md.

Sebelum Mulai

Baca seluruh docs/ dan laporan section sebelumnya.

Periksa git status dan codebase aktual.

Identifikasi apa yang sudah selesai agar tidak dikerjakan ulang.

Tandai Section 00 sebagai IN_PROGRESS.

Scope

Audit progres frontend terakhir sebelum melanjutkan.

Wajib:

Baca seluruh docs dan laporan section existing.

Inventaris route, pages, components, stores, fixtures, types, roles, permissions, dan flow yang sudah tersedia.

Klasifikasikan: COMPLETED, PARTIAL, NOT_STARTED, BROKEN, DUPLICATE, atau NEEDS_REVIEW.

Cocokkan code aktual dengan keputusan terbaru:Sales qualification, AE quotation, Management approval, Customer Journey, Client, Supplier, Project Order, Activity Center, dan Lead Source Recap.

Jangan mengubah application code kecuali memperbaiki broken import/build blocker yang jelas.

Susun dependency order frontend terbaru.

Tandai fitur yang tidak boleh dikerjakan ulang.

Output:

Update implementation state.

Buat/update module map, workflow map, roadmap, known issues.

Buat section report.

Acceptance:

Section berikutnya dapat mengetahui tepat apa yang harus dilanjutkan dan apa yang harus dipertahankan.

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

Buat laporan:docs/mockup-section-reports/section-00-current-progress-reconciliation.md

Berikan URL review.

Berhenti.