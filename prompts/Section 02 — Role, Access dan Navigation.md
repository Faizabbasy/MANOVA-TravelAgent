Section 02 — Role, Access dan Navigation

Baca dan jalankan section ini berdasarkan prompts/01-PROTOKOL-WAJIB.md.

Sebelum Mulai

Baca seluruh docs/ dan laporan section sebelumnya.

Periksa git status dan codebase aktual.

Identifikasi apa yang sudah selesai agar tidak dikerjakan ulang.

Tandai Section 02 sebagai IN_PROGRESS.

Scope

Finalisasikan role dan navigation frontend.

Role:Super Admin, Management, Sales, Account Executive, Product Planner, Project Manager, Operations, Ticketing, Accommodation, Transportation, MICE, Procurement, Finance, Viewer/Auditor, Client, Supplier.

Wajib:

Role switcher mock.

Navigation per role.

Route guards frontend.

Data scope Client dan Supplier per company.

Unauthorized states.

Super Admin full visibility tetapi bukan commercial approver normal.

Management commercial approval.

AE quotation dan Won setelah approved.

Sales Lead/qualification.

Client portal.

Supplier portal.

Matrix view untuk review permission.

Acceptance:

Setiap role melihat menu dan data yang sesuai.

Supplier PT ABC tidak melihat PT EFG.

Client A tidak melihat Client B pada mock scope.

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

Buat laporan:docs/mockup-section-reports/section-02-role-access-navigation.md

Berikan URL review.

Berhenti.