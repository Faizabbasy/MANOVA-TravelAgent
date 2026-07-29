Section ID: 06
Section name: Dashboard
Section report: `docs/mockup-section-reports/section-06-dashboard.md`

Ikuti PROTOKOL WAJIB continuity dan dokumentasi per section.

Tujuan:
Menyelesaikan dashboard frontend mockup berbasis fixture terpusat dan role-aware.

Scope:
- Opportunity pipeline.
- Active projects.
- Upcoming departures.
- Attention items.
- Budget versus actual.
- Outstanding invoices.
- Recent activities.
- Filter periode, owner, client, project type, dan status sesuai kebutuhan.
- Conditional widgets untuk Management, Sales, Project Manager, Operations, Finance, dan Viewer.
- Loading, empty, error, dan unauthorized states.
- Responsive desktop/mobile.

Aturan:
- Reuse foundation dan existing components.
- Jangan membuat dataset dashboard terpisah.
- Angka harus berasal dari fixture domain.
- Jangan mengarang realtime atau backend.
- Perubahan foundation atau route lama harus dicatat sebagai cross-section impact.

Acceptance criteria:
- Dashboard dapat dibuka tanpa error.
- Widget berubah sesuai role.
- Data konsisten dengan opportunity, project, invoice, dan activity.
- Format Rupiah/tanggal konsisten.
- Validasi dan dokumentasi selesai.

Setelah selesai, update docs/report dan berhenti.