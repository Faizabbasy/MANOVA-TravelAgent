Gunakan konteks MANOVA, hasil audit, dan template reuse mapping yang sudah dibuat.

Pada tahap ini finalisasikan rancangan Information Architecture, route structure, navigation, role access, dan workflow utama sebelum implementasi dimulai.

Belum boleh melakukan implementasi halaman, rename massal, atau penghapusan fitur.

==================================================
A. INFORMATION ARCHITECTURE
==================================================

Susun Information Architecture yang logis untuk frontend mockup MANOVA.

Struktur baseline yang harus dievaluasi:

1. Dashboard

2. CRM
   - Parties atau Customers
   - Prospects
   - Clients
   - Contacts
   - Opportunities
   - Activities
   - Quotations

3. Projects
   - All Projects
   - Project Detail
   - Project Changes
   - Project Documents
   - Project Tasks atau Timeline

4. Operations
   - Itineraries
   - Flights
   - Hotels
   - Transportation
   - MICE
   - Additional Services

5. Travelers
   - Travelers
   - Participants
   - Groups
   - Rooming Lists

6. Vendors
   - Vendors
   - Vendor Services
   - Vendor Quotations

7. Finance
   - Project Budgets
   - Costs
   - Invoices
   - Payments
   - Outstanding

8. Reports
   - Sales Pipeline
   - Project Performance
   - Cost and Margin
   - Finance Summary

9. Administration
   - Master Data
   - Users
   - Roles and Permissions
   - Audit Trail

Evaluasi apakah beberapa menu lebih tepat menjadi tab di Project Detail daripada menu global. Hindari menu terlalu dalam dan hindari halaman kosong.

==================================================
B. ROUTE DESIGN
==================================================

Susun route final yang mengikuti pola Nuxt dan pola codebase existing.

Untuk setiap route, tentukan:

- Route path.
- Page name.
- Parent menu.
- Page purpose.
- Required data.
- Main reusable component.
- Access role.
- Whether included in demo.
- Status: foundation, phase later, deferred, atau excluded.

Pertimbangkan pola berikut hanya sebagai contoh, bukan kewajiban:

- `/dashboard`
- `/crm/parties`
- `/crm/prospects`
- `/crm/clients`
- `/crm/opportunities`
- `/crm/opportunities/[id]`
- `/projects`
- `/projects/[id]`
- `/projects/[id]/itinerary`
- `/projects/[id]/travelers`
- `/projects/[id]/services`
- `/projects/[id]/vendors`
- `/projects/[id]/finance`
- `/projects/[id]/changes`
- `/finance/invoices`
- `/finance/payments`
- `/vendors`
- `/admin/users`
- `/admin/roles`
- `/admin/master-data`

Sesuaikan dengan nested route dan layout pattern yang ditemukan pada audit.

==================================================
C. PROJECT DETAIL STRUCTURE
==================================================

Rancang Project Detail sebagai pusat operasional.

Evaluasi tab atau section berikut:

- Overview.
- Timeline.
- Itinerary.
- Travelers.
- Services.
- Flights.
- Hotels.
- Transportation.
- MICE.
- Vendors.
- Budget and Cost.
- Invoice and Payment.
- Tasks.
- Documents.
- Changes.
- Activity.

Hindari tab berlebihan. Gabungkan area yang seharusnya satu konteks dan tentukan area mana yang baru muncul bila project menggunakan service terkait.

==================================================
D. PARTY, PROSPECT, DAN CLIENT
==================================================

Gunakan konsep satu master data pihak/customer.

Tentukan model UI yang memungkinkan:

- Party dibuat sebagai prospect.
- Prospect memiliki contact person dan activity.
- Prospect dapat memiliki opportunity.
- Setelah memenuhi kondisi bisnis, party dapat memiliki status client.
- History prospect tidak hilang setelah menjadi client.
- Client dapat memiliki beberapa project dan contact person.

Jangan membuat data Prospect dan Client sebagai dua master yang tidak berhubungan tanpa alasan kuat.

==================================================
E. OPPORTUNITY TO PROJECT WORKFLOW
==================================================

Rancang workflow:

- Draft.
- Qualification.
- Requirement Gathering.
- Proposal atau Quotation.
- Negotiation.
- Won.
- Lost.
- On Hold bila dibutuhkan.

Saat Opportunity menjadi Won:

- Project otomatis dibuat.
- Referensi opportunity disimpan.
- Client terhubung ke project.
- Data dasar project diambil dari opportunity.
- Service scope awal dapat dibawa ke project.
- Initial budget atau quotation reference dapat dibawa.
- Activity log mencatat perubahan.
- User menerima feedback bahwa project berhasil dibuat.

Tentukan role yang masuk akal untuk mengubah Opportunity menjadi Won.

Gunakan prinsip:

- Sales dapat mengelola opportunity.
- Approval atau final win dapat dilakukan oleh Sales Manager, Management, atau role tertentu bila nilai/kompleksitas melewati batas.
- Karena sistem masih mockup, permission dapat disimulasikan tetapi harus terstruktur.
- Pilih model paling sederhana yang tetap realistis untuk demo.
- Dokumentasikan keputusan final dan alasannya.

==================================================
F. PROJECT STATUS
==================================================

Susun status project yang cukup untuk demo tanpa menjadi terlalu kompleks.

Pertimbangkan:

- Draft.
- Planning.
- Confirmed.
- In Progress.
- Departed atau Ongoing Trip.
- Completed.
- On Hold.
- Cancelled.

Tentukan:

- Status display.
- Allowed transition mock.
- Badge.
- Dashboard grouping.
- Attention condition.
- Completion criteria.

==================================================
G. SERVICE STATUS
==================================================

Susun status generik untuk flight, hotel, transportation, dan MICE.

Hindari membuat status berbeda total bila dapat menggunakan lifecycle umum seperti:

- Not Started.
- Sourcing.
- Quoted.
- Pending Confirmation.
- Confirmed.
- Changed.
- Cancelled.
- Completed.

Tambahkan subtype-specific field bila memang diperlukan.

==================================================
H. ROLE AND ACCESS MATRIX
==================================================

Gunakan seluruh role demo berikut:

- Super Admin.
- Management.
- Sales.
- Project Manager.
- Operations.
- Ticketing.
- Accommodation.
- Transportation.
- MICE.
- Finance.
- Viewer atau Auditor.

Untuk setiap module dan action, tentukan minimal:

- View.
- Create.
- Edit.
- Change status.
- Approve.
- Delete mock.
- Export mock bila ada.
- View financial information.
- Manage users.

Gunakan access level sederhana:

- `NONE`
- `VIEW`
- `MANAGE`
- `APPROVE`
- `ADMIN`

Jangan membuat permission hingga level field bila belum diperlukan.

==================================================
I. DASHBOARD ROLE BEHAVIOR
==================================================

Tentukan bagaimana dashboard dapat berubah berdasarkan role.

Contoh:

- Management melihat pipeline, active projects, cost, margin, dan outstanding.
- Sales melihat lead, opportunity, quotation, dan follow-up.
- Project Manager melihat active project, milestone, change, dan attention item.
- Operations melihat service readiness dan upcoming departure.
- Finance melihat invoice, payment, outstanding, dan cost.
- Viewer hanya dapat melihat summary yang diizinkan.

Jangan membuat dashboard terpisah sepenuhnya untuk setiap role bila satu dashboard dapat menggunakan conditional widget.

==================================================
J. OUTPUT DOKUMENTASI
==================================================

Buat atau update:

1. `docs/mockup-information-architecture.md`
2. `docs/route-and-role-matrix.md`
3. `docs/mockup-design-decisions.md`
4. `docs/mockup-open-questions.md`
5. `docs/mockup-progress.md`
6. `docs/mockup-scope.md`

Isi minimum:

- Sitemap.
- Navigation tree.
- Route inventory.
- Page purpose.
- Project detail architecture.
- Workflow diagram dalam Mermaid bila sesuai.
- Opportunity-to-project workflow.
- Role matrix.
- Project status.
- Service status.
- Demo scope.
- Deferred scope.
- Locked decisions.
- Open questions.

==================================================
K. ACCEPTANCE CRITERIA
==================================================

Tahap ini dianggap selesai bila:

- Tidak ada route utama yang ambigu.
- Sidebar structure sudah jelas.
- Project detail structure sudah jelas.
- Opportunity-to-project flow sudah jelas.
- Role matrix mencakup seluruh role demo.
- Scope demo dan deferred scope terpisah.
- Tidak ada menu yang tidak memiliki tujuan.
- Semua keputusan penting tercatat.
- Tidak ada kode aplikasi yang diubah.

Pada akhir pekerjaan, berikan ringkasan keputusan final dan berhenti.