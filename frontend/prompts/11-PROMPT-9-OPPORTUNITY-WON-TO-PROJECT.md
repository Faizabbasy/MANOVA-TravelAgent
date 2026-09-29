Section ID: 09
Section name: Opportunity Won to Project
Section report: `docs/mockup-section-reports/section-09-opportunity-won-to-project.md`

Ikuti PROTOKOL WAJIB.

Scope:
- Permission check.
- Confirmation dialog.
- Requirement validation.
- Stage menjadi Won.
- Project otomatis dibuat.
- Party/client, contact, destination, date, service scope, traveler estimate, quotation, dan owner dibawa ke Project.
- Activity log.
- Success/error feedback.
- Redirect ke Project Detail.
- Duplicate prevention.
- Mock persistence behavior yang jujur.

Hard rules:
- Satu Opportunity hanya membuat satu Project.
- Jangan mengarang backend persistence.
- Gunakan source of truth fixture/state yang sama.
- Regression Section 07–08 wajib.

Acceptance criteria:
- Flow end-to-end berjalan.
- Project hasil konversi dapat dibuka.
- Unauthorized action ditolak.
- Duplicate action dicegah.
- Docs/report/change impact diperbarui.

Setelah selesai, berhenti.