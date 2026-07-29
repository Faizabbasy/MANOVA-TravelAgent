Gunakan seluruh hasil dari konteks, audit, gap analysis, information architecture, route, role, dan workflow yang sudah dibuat.

Pada tahap ini rapikan folder `docs` agar menjadi source of truth sebelum coding dimulai.

Jangan implementasi halaman dan jangan mengubah application code kecuali benar-benar dibutuhkan untuk memperbaiki link dokumentasi. Fokus hanya pada dokumentasi.

==================================================
A. FILE DOKUMENTASI WAJIB
==================================================

Pastikan file berikut tersedia:

1. `docs/mockup-scope.md`
2. `docs/mockup-information-architecture.md`
3. `docs/mockup-data-scenarios.md`
4. `docs/mockup-design-decisions.md`
5. `docs/mockup-open-questions.md`
6. `docs/mockup-progress.md`
7. `docs/template-reuse-mapping.md`
8. `docs/route-and-role-matrix.md`
9. `docs/template-audit.md`

Bila file sudah ada:

- Jangan overwrite secara buta.
- Pertahankan informasi existing yang masih valid.
- Gabungkan informasi baru secara terstruktur.
- Hapus duplikasi hanya bila maknanya benar-benar sama.
- Tandai informasi lama yang sudah tidak berlaku sebagai deprecated bila perlu.
- Jangan menghapus histori progress.

==================================================
B. MOCKUP SCOPE
==================================================

`docs/mockup-scope.md` harus mencakup:

- Product objective.
- Business context.
- Primary users.
- B2B focus dan B2C extensibility.
- In-scope modules.
- Out-of-scope.
- Demo scope.
- Deferred scope.
- Assumptions.
- Constraints.
- Non-goals.
- Acceptance criteria.
- Definition of done untuk frontend mockup.

Tegaskan:

- Ini frontend mockup.
- Dummy data terpusat.
- Tidak ada klaim integrasi nyata.
- Opportunity Won membuat Project.
- Party menjadi source untuk Prospect dan Client.
- Seluruh role digunakan pada demo.
- Template existing harus direuse.

==================================================
C. INFORMATION ARCHITECTURE
==================================================

`docs/mockup-information-architecture.md` harus mencakup:

- Sitemap.
- Navigation hierarchy.
- Module description.
- Page inventory.
- Project Detail tabs atau sections.
- Cross-module navigation.
- Breadcrumb behavior.
- Mobile navigation behavior.
- Empty menu prevention.
- Conditional service sections.
- Mermaid diagram bila membantu.

==================================================
D. DATA SCENARIOS
==================================================

`docs/mockup-data-scenarios.md` harus berisi skenario data demo yang konsisten.

Minimal:

1. Normal Project.
2. High-Change Project.
3. Complex Project.

Untuk setiap skenario, definisikan:

- Client.
- Contact person.
- Opportunity.
- Project.
- Destination.
- Travel date.
- Project type.
- Services.
- Traveler count.
- Project owner.
- Team.
- Vendor.
- Quotation.
- Budget.
- Actual cost.
- Invoice.
- Payment.
- Timeline.
- Task.
- Change history.
- Attention item.
- Documents.
- Status.

Tambahkan data scenario tambahan bila dibutuhkan untuk:

- Empty state.
- Overdue invoice.
- Lost opportunity.
- Upcoming departure.
- Cancelled service.
- Pending confirmation.
- Role-restricted finance view.

Pastikan satu entitas yang sama memakai ID dan nilai yang sama di seluruh halaman.

==================================================
E. DESIGN DECISIONS
==================================================

`docs/mockup-design-decisions.md` harus menggunakan format keputusan seperti:

- Decision ID.
- Title.
- Status.
- Context.
- Decision.
- Reason.
- Consequence.
- Affected files or modules.
- Date.

Gunakan status:

- `LOCKED`
- `PROPOSED`
- `NEEDS_VALIDATION`
- `DEFERRED`
- `SUPERSEDED`

Catat minimal keputusan terkait:

- Nuxt.js tetap digunakan.
- Template reuse strategy.
- Design system reuse.
- Party sebagai basis Prospect dan Client.
- Opportunity Won otomatis membuat Project.
- Route architecture.
- Project Detail architecture.
- Role model.
- Dummy data terpusat.
- Status constants.
- Rupiah dan date formatting.
- Conditional modules berdasarkan service.
- No fake integration.
- Package addition policy.

==================================================
F. OPEN QUESTIONS
==================================================

`docs/mockup-open-questions.md` harus:

- Hanya berisi pertanyaan yang benar-benar belum diputuskan.
- Tidak mengulang keputusan yang sudah locked.
- Memiliki ID.
- Memiliki category.
- Memiliki impact.
- Memiliki recommendation.
- Memiliki owner bila diketahui.
- Memiliki status.
- Menjelaskan apakah blocking atau non-blocking.

Pisahkan:

- Blocking before foundation.
- Blocking before module implementation.
- Non-blocking.
- Deferred.

Jangan menjadikan hal kecil sebagai blocker bila dapat menggunakan asumsi aman untuk mockup.

==================================================
G. PROGRESS
==================================================

`docs/mockup-progress.md` harus menjadi log yang append-only secara konseptual.

Untuk setiap tahap catat:

- Date.
- Phase.
- Status.
- Completed.
- Files changed.
- Validation.
- Decisions.
- Open issues.
- Next recommended prompt.

Jangan menghapus histori tahap sebelumnya.

==================================================
H. ROUTE AND ROLE MATRIX
==================================================

`docs/route-and-role-matrix.md` harus mencakup:

- Route.
- Module.
- Page.
- Menu placement.
- Demo inclusion.
- Role access.
- Main action.
- Reuse source.
- Implementation phase.
- Status.

Tambahkan role access matrix yang mudah dibaca.

==================================================
I. TEMPLATE REUSE MAPPING
==================================================

`docs/template-reuse-mapping.md` harus mencakup:

- Existing feature.
- Existing route.
- Existing component.
- Proposed MANOVA use.
- Reuse category.
- Required adaptation.
- Candidate removal.
- Dependency.
- Risk.
- Execution phase.

Pastikan setiap candidate removal memiliki alasan dan dependency check.

==================================================
J. DOCUMENT CONSISTENCY CHECK
==================================================

Lakukan pemeriksaan silang:

- Nama module konsisten.
- Nama route konsisten.
- Nama role konsisten.
- Nama status konsisten.
- Scope tidak bertentangan.
- Open question tidak bertentangan dengan locked decision.
- Data scenario mengikuti route dan module.
- Reuse mapping mengikuti hasil audit.
- Tidak ada referensi file yang tidak ada.
- Tidak ada TODO tanpa konteks.
- Tidak ada placeholder generik yang seharusnya sudah dapat diisi.

==================================================
K. OUTPUT
==================================================

Pada akhir tahap:

1. Tampilkan daftar file docs yang dibuat atau diubah.
2. Ringkas keputusan locked.
3. Ringkas open questions yang masih blocking.
4. Konfirmasi apakah foundation coding dapat dimulai.
5. Jangan mulai coding.
6. Berhenti dan tunggu prompt berikutnya.