PROTOKOL WAJIB — FRONTEND-ONLY CONTINUATION

Tujuan

Bangun frontend mockup MANOVA yang lengkap secara operasional untuk Travel Agent B2B. Sistem harus menggambarkan seluruh workflow nyata, tetapi tidak memakai backend.

Batasan Teknis

Dilarang membuat:

backend/server API produksi;

database;

migration;

ORM;

queue/background worker;

webhook;

payment gateway nyata;

airline/hotel/vendor integration nyata;

authentication provider nyata;

klaim persistence produksi.

Gunakan:

Nuxt.js dan struktur codebase existing;

TypeScript;

typed domain models;

centralized fixtures;

centralized state/store;

mock repository/service layer;

localStorage/sessionStorage hanya bila dibutuhkan untuk simulasi interaksi, dan harus diberi label sebagai mock persistence;

reusable components;

route middleware dan permission helper frontend untuk simulasi akses;

deterministic mock errors/loading/empty states;

realistic but fictional data.

Aturan Continuity

Sebelum setiap section:

Baca prompt section.

Baca protokol ini.

Baca CLAUDE.md.

Baca seluruh file pada docs/.

Baca:

docs/mockup-implementation-state.md

docs/mockup-section-progress.md

docs/mockup-change-impact-log.md

laporan section terakhir pada docs/mockup-section-reports/

Periksa git status.

Audit code aktual yang berkaitan.

Identifikasi fitur yang sudah selesai, sebagian selesai, belum ada, atau rusak.

Jangan mengulang atau mengganti hasil selesai tanpa kebutuhan integrasi.

Tandai section IN_PROGRESS.

Aturan Implementasi

Kerjakan hanya gap pada section saat ini.

Jangan membuat ulang foundation yang sudah benar.

Jangan membuat dataset paralel untuk halaman berbeda.

Semua flow harus memakai satu source of truth.

Setiap action harus mempunyai hasil state yang jelas.

Simulasikan permission, validation, approval, handover, activity, dan state transition secara konsisten.

Setiap module wajib memiliki page list/detail/form/action/history/states yang memang dibutuhkan.

Sediakan loading, empty, error, unauthorized, not-found, validation, success, dan conflict state yang relevan.

Jangan meninggalkan tombol tidak berfungsi.

Action deferred harus diberi status jelas dan hanya boleh ada bila benar-benar berada di section berikutnya.

Jangan mengarang integrasi nyata.

Jangan menampilkan internal cost/margin kepada Client atau Supplier.

Client dan Supplier hanya boleh melihat data company mereka pada mock access scope.

Super Admin bukan approver komersial normal.

Hanya Management yang melakukan commercial approval.

Account Executive dapat membuat quotation.

Sales mengelola Lead dan qualification.

Opportunity Won mengaktifkan Client dan membuat Project Order tanpa menduplikasi company.

Role Final

Internal

Super Admin

Management

Sales

Account Executive

Product Planner / Travel Consultant

Project Manager

Operations

Ticketing

Accommodation

Transportation

MICE

Procurement / Vendor Management

Finance

Viewer / Auditor

External

Client

Supplier

Workflow Utama

Public/Manual Lead→ Sales Qualification→ Assign Account Executive→ Opportunity→ Requirement Detail→ Product Planning & Costing→ Quotation→ Management Approval→ Client Confirmation→ Opportunity Won→ Active Client→ Project Order→ AE-to-PM Handover→ Planning→ Traveler Collection→ Supplier Sourcing→ Service Booking→ Readiness→ On Trip / Event→ Changes / Incident→ Finance Finalization→ Completed→ Closed

Dokumentasi Wajib

Pertahankan docs existing dan buat/update:

docs/mockup-implementation-state.md

docs/mockup-section-progress.md

docs/mockup-change-impact-log.md

docs/mockup-progress.md

docs/mockup-scope.md

docs/mockup-information-architecture.md

docs/mockup-data-scenarios.md

docs/mockup-design-decisions.md

docs/mockup-open-questions.md

docs/route-and-role-matrix.md

docs/mockup-section-reports/

docs/frontend-module-map.md

docs/frontend-workflow-map.md

docs/frontend-implementation-roadmap.md

docs/frontend-end-to-end-implementation-guide.md

docs/frontend-known-issues.md

docs/frontend-demo-and-review-guide.md

Setelah Section Selesai

Jalankan formatter file terkait.

Jalankan lint.

Jalankan typecheck.

Jalankan test yang tersedia.

Jalankan build.

Smoke-test seluruh route dan role terkait.

Regression-test section sebelumnya yang terdampak.

Update seluruh dokumentasi yang relevan.

Buat laporan section.

Berhenti dan jangan lanjut otomatis.

Definition of Done

Section tidak boleh COMPLETED bila:

hanya ada dashboard/list tanpa action;

form/action belum berfungsi pada mock state;

role access belum bekerja;

data tidak konsisten lintas halaman;

loading/empty/error/unauthorized belum tersedia;

lint/typecheck/build gagal akibat section;

dokumentasi belum diperbarui;

acceptance criteria belum terpenuhi.

Gunakan NEEDS_REVIEW bila implementasi sudah lengkap tetapi perlu review visual user.