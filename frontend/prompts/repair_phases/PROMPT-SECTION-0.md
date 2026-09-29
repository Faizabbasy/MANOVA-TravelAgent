PROMPT SECTION 0

AUDIT, GAP ANALYSIS, DAN IMPLEMENTATION FOUNDATION PLAN

Baca kembali MASTER PROMPT MANOVA B2B CLIENT ROLE dan jadikan sebagai sumber requirement utama.

Untuk perintah ini, kerjakan hanya Section 0 — Audit dan Gap Analysis.

Jangan mengimplementasikan 18 halaman Client terlebih dahulu.

Scope

Audit seluruh struktur codebase.

Audit folder docs.

Audit progress terakhir.

Audit:

Nuxt structure

Layout

Navigation

Auth mock

Role handling

Route middleware

Design system

UI components

Form pattern

Table pattern

Modal/drawer pattern

Notification/toast

Mock data

Store/composable/service

Existing pages

Cari seluruh implementasi Client yang sudah tersedia.

Identifikasi fitur yang sudah sesuai.

Identifikasi fitur yang belum tersedia.

Identifikasi fitur yang perlu diperbaiki, bukan dibuat ulang.

Petakan reusable components.

Petakan risiko integrasi dengan role internal.

Deliverable

Buat gap analysis untuk 18 halaman:

1. Dashboard
2. Notifications
3. Travel Requests
4. Quotations & Proposals
5. Approval Center
6. Projects
7. Participants
8. Itineraries
9. Reservations
10. Trip Center
11. Change Requests
12. Documents
13. Messages & Activities
14. Issues & Support
15. Finance & Billing
16. Reports & Analytics
17. Feedback & Evaluation
18. Company Profile

Untuk setiap halaman, tandai:

Existing and complete

Existing but incomplete

Not available

Reusable module available

Dependency

Risk

Recommended action

Dokumentasi

Buat atau update:

docs/client-role-scope.md
docs/client-information-architecture.md
docs/client-business-flow.md
docs/client-page-inventory.md
docs/client-progress.md

Jangan membuat file duplikat jika dokumen setara sudah ada.

Quality Check

Jalankan pemeriksaan yang tidak mengubah behavior:

Existing lint jika tersedia

Existing typecheck jika tersedia

Existing test jika tersedia

Existing build jika diperlukan dan masuk akal

Laporkan baseline error existing secara jujur.

Jangan memperbaiki error unrelated pada section ini kecuali sangat kecil dan diperlukan untuk audit.

Format laporan

SECTION 0 — AUDIT
STATUS:

CONDITION OF EXISTING CODEBASE:
- ...

CLIENT FEATURES ALREADY AVAILABLE:
- ...

CLIENT FEATURES INCOMPLETE:
- ...

CLIENT FEATURES NOT AVAILABLE:
- ...

REUSABLE COMPONENTS:
- ...

REUSABLE SERVICES / STORES:
- ...

AUTH AND ROUTE FINDINGS:
- ...

RISKS:
- ...

DOCUMENTATION UPDATED:
- ...

BASELINE TEST RESULT:
- lint:
- typecheck:
- test:
- build:

RECOMMENDED SECTION 1 PLAN:
- ...

Setelah laporan selesai, berhenti.

Jangan lanjut ke Section 1.