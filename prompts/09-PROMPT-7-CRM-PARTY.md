Section ID: 07
Section name: CRM Party
Section report: `docs/mockup-section-reports/section-07-crm-party.md`

Ikuti PROTOKOL WAJIB.

Scope:
- Party/customer list dan detail.
- Prospect list.
- Client list.
- Contact person.
- Activity history.
- Summary opportunity/project.
- Search, filter, sort, pagination mock.
- Create/edit frontend mock bila masuk scope.
- Empty/loading/error/not-found states.
- Role behavior.

Hard rules:
- Prospect dan Client berasal dari satu master Party.
- History prospect tidak hilang setelah menjadi client.
- Gunakan stable IDs dan fixture terpusat.
- Jangan menggandakan client/contact data.
- Perubahan Dashboard hanya untuk integration minimal dan wajib dicatat.

Acceptance criteria:
- Lifecycle Party → Prospect → Client terlihat jelas.
- Cross-link ke Opportunity/Project konsisten.
- Responsive dan tervalidasi.
- Regression Dashboard selesai.
- Docs/report diperbarui.

Setelah selesai, berhenti.