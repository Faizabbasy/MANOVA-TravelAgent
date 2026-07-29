Saya akan mengubah dashboard template yang sudah ada menjadi mockup sistem Travel Agent bernama MANOVA.

Project ini menggunakan Nuxt.js. Tugas kamu adalah melakukan reuse terhadap codebase, layout, komponen, design system, dan pola implementasi yang sudah tersedia. Jangan langsung membuat aplikasi baru dari nol dan jangan melakukan rewrite besar tanpa kebutuhan yang jelas.

Pada tahap ini, jangan mengubah kode apa pun. Baca dan pahami konteks berikut sebagai landasan untuk seluruh pekerjaan selanjutnya.

==================================================
A. KONTEKS PRODUK
==================================================

MANOVA adalah sistem pengelolaan operasional project untuk bisnis travel agent.

Fokus utama sistem adalah kebutuhan B2B, tetapi struktur sistem harus cukup umum agar nantinya dapat mengakomodasi kebutuhan B2C. Sistem tidak boleh terlalu spesifik untuk satu travel agent saja karena akan digunakan untuk mengakomodasi pola operasional beberapa travel agent yang berbeda.

Sistem digunakan untuk mengelola proses sejak lead atau calon client masuk, opportunity dibuat, quotation disiapkan, opportunity dinyatakan won, project otomatis terbentuk, kebutuhan perjalanan diproses, biaya dipantau, invoice diterbitkan, pembayaran diterima, hingga project selesai.

==================================================
B. TIPE PROJECT
==================================================

Sistem harus dapat mendukung berbagai kombinasi layanan berikut:

1. Project tiket pesawat saja.
   Contoh: perjalanan Manila dengan distribusi data operasional yang sebelumnya dilakukan melalui Google Sheet.

2. Project tiket pesawat dan hotel.
   Contoh: perjalanan Abu Dhabi.

3. Project tiket pesawat, hotel, dan transportasi.
   Contoh: perjalanan Korea.

4. Project yang memiliki kebutuhan MICE.
   Contoh: project Palu.

Project dapat memiliki karakteristik:

- Project normal.
- Project dengan banyak perubahan.
- Project paling kompleks.
- Individual traveler.
- Group traveler.
- Corporate travel.
- Event atau MICE.
- Domestic atau international.
- Satu atau beberapa jenis layanan dalam satu project.

==================================================
C. ALUR BISNIS UTAMA
==================================================

Gunakan alur utama berikut sebagai baseline:

Lead masuk
→ Prospect
→ Opportunity
→ Penyusunan kebutuhan dan quotation
→ Opportunity Won
→ Project otomatis dibuat
→ Project planning
→ Pengelolaan itinerary dan traveler
→ Pemesanan atau pengelolaan service
→ Pengelolaan vendor
→ Monitoring perubahan
→ Budget dan actual cost
→ Invoice
→ Payment
→ Project completion

Keputusan yang sudah dikunci:

- Client dan Prospect idealnya menggunakan satu master data pihak/customer dengan lifecycle atau status yang membedakan keduanya.
- Opportunity yang berubah menjadi Won otomatis membuat Project.
- Seluruh role akan digunakan saat demo.
- Hak mengubah Opportunity menjadi Won harus mengikuti role dan permission yang masuk akal. Rekomendasikan role final berdasarkan audit dan kebutuhan operasional, tetapi jangan hardcode keputusan tanpa mendokumentasikannya.
- Sistem saat ini adalah frontend mockup menggunakan dummy data, kecuali codebase existing memang sudah memiliki backend yang harus dipertahankan.
- Jangan mengarang integrasi airline, hotel, payment gateway, WhatsApp API, atau vendor API nyata.
- Jangan mengklaim fitur sudah terintegrasi bila masih berupa mockup.

==================================================
D. DOMAIN DAN ENTITAS UTAMA
==================================================

Entitas minimum yang perlu dipertimbangkan:

CRM:
- Party atau Customer Account.
- Prospect.
- Client.
- Contact Person.
- Lead.
- Opportunity.
- Activity.
- Quotation.

Project:
- Project.
- Project Type.
- Project Status.
- Project Timeline.
- Project Member.
- Project Change.
- Project Document.
- Project Note.
- Approval atau decision log bila diperlukan.

Traveler:
- Traveler.
- Participant.
- Group.
- Rooming List.
- Passport atau travel document metadata.
- Emergency contact.
- Special request.

Operations:
- Itinerary.
- Flight.
- Hotel.
- Transportation.
- MICE atau Event.
- Additional Service.
- Booking atau reservation reference.
- Operational task.
- Service status.

Vendor:
- Vendor.
- Vendor Contact.
- Vendor Service.
- Vendor Quotation.
- Purchase atau cost commitment bila relevan.

Finance:
- Project Budget.
- Estimated Cost.
- Actual Cost.
- Client Quotation.
- Invoice.
- Payment.
- Outstanding.
- Margin atau profitability summary.

Administration:
- User.
- Role.
- Permission.
- Master Data.
- Audit Trail atau Activity Log.
- Notification mock.

Nama final entitas boleh disesuaikan setelah audit agar mengikuti pola codebase, tetapi konsep bisnisnya tidak boleh hilang.

==================================================
E. ROLE YANG PERLU DIDUKUNG
==================================================

Seluruh role akan digunakan dalam demo. Minimal pertimbangkan:

- Super Admin.
- Management atau Owner.
- Sales.
- Project Manager.
- Operations.
- Ticketing.
- Hotel atau Accommodation.
- Transportation.
- MICE atau Event.
- Finance.
- Viewer atau Auditor.

Jangan langsung membuat seluruh permission secara granular pada tahap pertama. Buat struktur role dan permission mock yang scalable dan terdokumentasi.

==================================================
F. KEBUTUHAN DASHBOARD
==================================================

Dashboard harus membantu pengguna memahami kondisi bisnis dan project, bukan hanya menampilkan kartu statistik generik.

Pertimbangkan informasi berikut:

- Jumlah lead dan opportunity aktif.
- Opportunity berdasarkan stage.
- Nilai pipeline.
- Project aktif.
- Project berdasarkan status.
- Upcoming departure.
- Project yang membutuhkan perhatian.
- Project dengan banyak perubahan.
- Progress operasional.
- Budget versus actual cost.
- Invoice dan outstanding payment.
- Activity atau task mendatang.
- Recent updates.
- Filter berdasarkan periode, owner, client, project type, dan status.

Visual dan metrik final harus menyesuaikan data scenario dan komponen template yang tersedia.

==================================================
G. SKENARIO DATA DEMO
==================================================

Siapkan fondasi data untuk minimal tiga skenario utama:

1. Normal Project
   - Alur relatif stabil.
   - Perubahan sedikit.
   - Service sederhana atau menengah.
   - Status dan timeline berjalan sesuai rencana.

2. High-Change Project
   - Terdapat perubahan traveler, jadwal, flight, hotel, atau kebutuhan layanan.
   - Harus terlihat change history dan item yang membutuhkan perhatian.

3. Complex Project
   - Banyak traveler.
   - Multi-service.
   - Dapat memiliki flight, hotel, transportation, dan MICE.
   - Banyak vendor.
   - Budget dan actual cost lebih kompleks.
   - Memiliki task, dokumen, dan milestone yang lebih banyak.

Dummy data harus realistis, konsisten lintas halaman, dan berasal dari satu source yang terpusat. Jangan membuat data yang saling bertentangan di halaman berbeda.

==================================================
H. PRINSIP REUSE TEMPLATE
==================================================

Lakukan reuse terhadap:

- Layout.
- Sidebar.
- Header.
- Navigation behavior.
- Responsive behavior.
- Form controls.
- Table.
- Card.
- Modal atau drawer.
- Tabs.
- Badge.
- Pagination.
- Filter.
- Chart wrapper.
- Loading state.
- Empty state.
- Error state.
- Notification/toast.
- Utility dan composable.
- Type definitions yang masih relevan.
- Design tokens.
- Theme.
- Icon library.
- Authentication mock bila tersedia.
- Route middleware bila tersedia.

Jangan:

- Membuat design system baru bila template sudah memilikinya.
- Menginstal library baru sebelum memastikan library existing tidak mampu memenuhi kebutuhan.
- Menduplikasi komponen yang sebenarnya sudah tersedia.
- Menghapus file secara massal sebelum mapping dan dokumentasi selesai.
- Mengubah seluruh warna, spacing, typography, atau layout tanpa alasan.
- Mencampurkan dummy data langsung ke banyak page component.
- Menggunakan `any` secara sembarangan.
- Membuat route dan menu tanpa source of truth.
- Mengubah stack Nuxt.js menjadi framework lain.
- Mengarang backend, API, atau integrasi produksi.

==================================================
I. ATURAN TEKNIS
==================================================

1. Audit package manager dan gunakan package manager yang sudah dipakai project.
2. Audit versi Nuxt, Vue, TypeScript, UI framework, state management, validation, table, chart, icon, date, dan utility library.
3. Pertahankan pola coding existing yang masih sehat.
4. Gunakan TypeScript apabila codebase sudah menggunakan TypeScript.
5. Gunakan struktur data terpusat.
6. Pisahkan domain types, constants, dummy data, composables, dan presentation components.
7. Hindari overengineering karena tahap awal adalah frontend mockup.
8. Seluruh halaman harus responsive.
9. Setiap list penting harus memiliki empty, loading, dan error state mock.
10. Seluruh status harus menggunakan constant atau enum yang konsisten.
11. Seluruh currency harus menggunakan format Rupiah Indonesia bila nilai menggunakan IDR.
12. Seluruh tanggal demo harus konsisten.
13. Jangan menulis informasi sensitif nyata pada dummy data.
14. Jangan mengubah fungsionalitas template yang masih digunakan tanpa melaporkan dampaknya.
15. Jalankan lint, typecheck, test, dan build sesuai script yang tersedia setelah mulai melakukan perubahan kode.

==================================================
J. DOKUMENTASI SOURCE OF TRUTH
==================================================

Gunakan atau buat file berikut:

- `docs/mockup-scope.md`
- `docs/mockup-information-architecture.md`
- `docs/mockup-data-scenarios.md`
- `docs/mockup-design-decisions.md`
- `docs/mockup-open-questions.md`
- `docs/mockup-progress.md`
- `docs/template-reuse-mapping.md`
- `docs/route-and-role-matrix.md`

Jangan menghapus informasi yang sudah benar dari dokumen existing. Update bagian yang relevan, isi bagian kosong, dan tandai keputusan yang masih membutuhkan validasi.

==================================================
K. ATURAN PELAPORAN
==================================================

Pada akhir setiap tahap, laporkan:

- Ringkasan pekerjaan.
- File yang diperiksa.
- File yang dibuat.
- File yang diubah.
- Komponen existing yang dapat direuse.
- Komponen yang perlu diadaptasi.
- Fitur template yang tidak relevan.
- Risiko atau konflik teknis.
- Keputusan yang dikunci.
- Open questions.
- Hasil lint, typecheck, test, dan build bila kode telah berubah.
- Rekomendasi langkah berikutnya.

Untuk tahap konteks ini:

- Jangan mengubah kode.
- Jangan membuat halaman.
- Jangan menginstal package.
- Jangan menghapus file.
- Konfirmasi pemahamanmu dengan merangkum domain, tujuan reuse, batasan, dan urutan kerja.
- Setelah itu berhenti dan tunggu prompt berikutnya.