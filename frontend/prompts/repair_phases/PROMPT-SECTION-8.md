PROMPT SECTION 8

END-TO-END INTEGRATION, QA, REGRESSION, DAN FINAL DOCUMENTATION

Baca:

Master Prompt

Seluruh docs/client-*.md

docs/client-progress.md

Codebase terbaru

Seluruh hasil Section 0–7

Kerjakan hanya Section 8 — Integration, QA, Regression, and Final Documentation.

Jangan menambah fitur besar baru kecuali diperlukan untuk menutup workflow yang terputus.

A. Audit 18 halaman

Periksa seluruh halaman:

Dashboard

Notifications

Travel Requests

Quotations & Proposals

Approval Center

Projects

Participants

Itineraries

Reservations

Trip Center

Change Requests

Documents

Messages & Activities

Issues & Support

Finance & Billing

Reports & Analytics

Feedback & Evaluation

Company Profile

Periksa:

Route

Navigation

Breadcrumb

Loading

Empty

Error

Form validation

Confirmation

Toast/feedback

Responsive

Broken links

Dead button

Incorrect status

Inconsistent data

Accessibility basics

B. End-to-end flow

Uji secara manual dan/atau automated bila pattern tersedia.

E2E 1

Travel Request
→ Submit
→ Quotation
→ Revision
→ Approval
→ Project Created

E2E 2

Project
→ Add Participants
→ Complete Data
→ Verification
→ Reservation
→ Ticket/Voucher

E2E 3

Itinerary
→ Review
→ Revision
→ New Version
→ Approval
→ Project Readiness

E2E 4

Invoice
→ Payment Proof
→ Waiting Verification
→ Mock Verification
→ Paid/Partially Paid

E2E 5

Change Request
→ Impact Review
→ Approval
→ Execution
→ Related Data Updated

E2E 6

Trip Center
→ Issue
→ Support Ticket
→ Resolution
→ Trip Completed
→ Feedback
→ Completion Approval
→ Project Closed

C. Data security audit

Pastikan tidak ada tampilan Client yang memperlihatkan:

Cost vendor

Margin

Markup

Internal notes

Internal approval

Internal message

Client lain

Internal vendor evaluation

Internal finance data

D. Regression audit role lain

Pastikan implementasi Client tidak merusak:

Internal navigation

Auth

Role access

Existing routes

Existing components

Existing mock data

Existing business flow

Jangan melakukan refactor besar unrelated.

E. Code quality

Periksa:

Duplicate component

Duplicate type

Duplicate mock state

Business logic di page

Inconsistent enum/status

Dead code

Console errors

Type errors

Broken import

Non-deterministic mock data

F. Test

Jalankan seluruh pemeriksaan yang tersedia:

lint

typecheck

unit tests

integration tests

build

Jika browser automation tersedia, jalankan critical path.

Jangan mengklaim pass untuk test yang tidak tersedia atau tidak dijalankan.

G. Final documentation

Finalkan:

docs/client-role-scope.md
docs/client-information-architecture.md
docs/client-business-flow.md
docs/client-page-inventory.md
docs/client-mock-data-scenarios.md
docs/client-progress.md

Tambahkan end-to-end flow final dan daftar known limitations frontend mock.

Jika project memiliki laporan progres HTML utama, update file laporan progress existing tanpa membuat file laporan duplikat.

Definition of Done

Client implementation dianggap selesai jika:

Satu role CLIENT

Tidak ada sub-role Client

18 halaman tersedia

Semua route valid

Navigation bekerja

Main actions bekerja

Mock data saling terhubung

Travel Request menghasilkan Quotation

Quotation Approved menghasilkan Project

Participant memengaruhi readiness

Itinerary versioning bekerja

Reservation dapat dipantau

Change Request memengaruhi data terkait

Payment flow bekerja

Trip Center context-aware

Support flow bekerja

Feedback memengaruhi closing

Project dapat Closed

Tidak ada data internal bocor

Role lain tidak rusak

Lint/typecheck/test/build selesai sesuai tool tersedia

Docs final diperbarui

Format final report

SECTION 8 — FINAL INTEGRATION & QA
STATUS:

18-PAGE COMPLETION:
1. Dashboard:
2. Notifications:
3. Travel Requests:
4. Quotations & Proposals:
5. Approval Center:
6. Projects:
7. Participants:
8. Itineraries:
9. Reservations:
10. Trip Center:
11. Change Requests:
12. Documents:
13. Messages & Activities:
14. Issues & Support:
15. Finance & Billing:
16. Reports & Analytics:
17. Feedback & Evaluation:
18. Company Profile:

END-TO-END TEST:
- Request to Project:
- Participant to Reservation:
- Itinerary Approval:
- Invoice Payment:
- Change Request:
- Trip to Closing:

SECURITY / DATA VISIBILITY:
- ...

REGRESSION:
- ...

FIXES APPLIED:
- ...

TEST RESULT:
- lint:
- typecheck:
- unit test:
- integration test:
- build:

DOCUMENTATION:
- ...

KNOWN LIMITATIONS:
- ...

FINAL RECOMMENDATION:
- ...

Setelah laporan final selesai, berhenti.

Jangan membuat backend atau memulai scope baru.