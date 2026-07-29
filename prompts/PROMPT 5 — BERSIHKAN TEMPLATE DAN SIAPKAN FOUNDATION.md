Gunakan seluruh dokumen pada folder `docs` sebagai source of truth.

Sekarang mulai tahap coding pertama: membersihkan template secara aman dan menyiapkan foundation MANOVA. Jangan langsung membangun seluruh modul bisnis.

Tujuan tahap ini adalah menghasilkan app shell, navigation, route foundation, shared types, constants, dummy data foundation, role mock, dan reusable component baseline yang stabil untuk implementasi modul berikutnya.

==================================================
A. PRE-FLIGHT CHECK
==================================================

Sebelum mengubah kode:

1. Baca seluruh file berikut:
   - `docs/mockup-scope.md`
   - `docs/mockup-information-architecture.md`
   - `docs/mockup-data-scenarios.md`
   - `docs/mockup-design-decisions.md`
   - `docs/mockup-open-questions.md`
   - `docs/mockup-progress.md`
   - `docs/template-reuse-mapping.md`
   - `docs/route-and-role-matrix.md`
   - `docs/template-audit.md`

2. Periksa git status.
3. Catat baseline lint, typecheck, test, dan build.
4. Jangan menyentuh perubahan user yang tidak terkait.
5. Jangan melakukan reset atau checkout massal.
6. Jangan menghapus file candidate sebelum memeriksa dependensinya.
7. Ikuti package manager dan coding pattern existing.

==================================================
B. CLEANUP STRATEGY
==================================================

Lakukan cleanup berdasarkan `docs/template-reuse-mapping.md`.

Gunakan urutan aman:

1. Identifikasi menu yang tidak relevan.
2. Lepaskan menu dari navigation terlebih dahulu bila memang sudah diputuskan.
3. Pastikan route lama tidak menjadi dependency fitur lain.
4. Pertahankan komponen reusable.
5. Pindahkan komponen generik bila lokasinya terlalu domain-specific dan pemindahan aman.
6. Hapus file hanya bila berstatus `REMOVE_AFTER_VALIDATION`, dependensi sudah diperiksa, dan keputusan removal telah locked.
7. Bila masih ragu, sembunyikan atau tandai deprecated; jangan hapus.
8. Jangan melakukan mass search-and-replace tanpa review.
9. Jangan menghapus asset yang masih direferensikan.
10. Jangan menghapus auth, layout, middleware, theme, atau shared utility yang masih dibutuhkan.

Laporkan seluruh file yang dihapus beserta alasan dan hasil dependency check.

==================================================
C. APP IDENTITY
==================================================

Adaptasi identitas aplikasi menjadi MANOVA secara terkontrol:

- App name.
- Page title.
- Sidebar brand.
- Header brand.
- Placeholder logo bila logo final belum tersedia.
- Metadata.
- Login copy bila relevan.
- Navigation label.

Jangan mengarang brand guideline. Pertahankan theme template kecuali keputusan docs menyatakan lain.

==================================================
D. NAVIGATION FOUNDATION
==================================================

Implementasikan navigation berdasarkan route-and-role matrix.

Persyaratan:

- Navigation memiliki satu source of truth.
- Mendukung nested menu bila pattern existing mendukung.
- Mendukung icon dari library existing.
- Mendukung active state.
- Mendukung collapsed sidebar.
- Mendukung responsive/mobile.
- Mendukung role visibility mock.
- Tidak menampilkan menu kosong.
- Tidak menampilkan menu deferred kecuali diberi label jelas sebagai demo placeholder dan memang diputuskan.
- Breadcrumb mengikuti route metadata bila memungkinkan.

Jangan membuat seluruh isi halaman bisnis. Untuk route foundation, gunakan page shell atau placeholder yang rapi bila page tersebut memang masuk foundation.

==================================================
E. ROUTE FOUNDATION
==================================================

Buat route sesuai scope foundation.

Minimum route yang dapat disiapkan:

- Dashboard.
- CRM overview atau entry point.
- Opportunities list shell.
- Projects list shell.
- Project detail shell.
- Vendors list shell.
- Finance overview shell.
- Administration entry point bila included.

Aturan:

- Jangan membuat halaman kosong polos.
- Gunakan standard page header.
- Tampilkan title, description, breadcrumb, dan placeholder state yang informatif.
- Jangan isi data bisnis secara berlebihan.
- Jangan mengklaim fitur selesai.
- Route deferred tidak perlu dibuat.
- Dynamic route harus memiliki fallback untuk ID yang tidak ditemukan.
- Periksa direct navigation dan refresh.

==================================================
F. TYPE FOUNDATION
==================================================

Buat struktur type yang mengikuti pattern codebase.

Pertimbangkan domain:

- Common.
- User.
- Role.
- Permission.
- Party.
- Contact.
- Opportunity.
- Quotation.
- Project.
- Traveler.
- Itinerary.
- Service.
- Flight.
- Hotel.
- Transportation.
- MICE.
- Vendor.
- Budget.
- Cost.
- Invoice.
- Payment.
- Activity.
- Document.
- Change log.

Jangan memasukkan seluruh detail domain bila belum digunakan.

Aturan:

- Hindari `any`.
- Gunakan union atau enum pattern yang sesuai codebase.
- Pisahkan identifier, status, dan shared metadata secara masuk akal.
- Hindari circular dependency.
- Gunakan naming konsisten.
- Type harus mendukung tiga data scenario.
- Jangan membuat abstraction backend yang belum ada.

==================================================
G. CONSTANTS DAN STATUS
==================================================

Buat source of truth untuk:

- Opportunity stage.
- Project status.
- Service status.
- Invoice status.
- Payment status.
- Role.
- Permission level.
- Project type.
- Service type.
- Attention severity.

Setiap status harus memiliki:

- Value.
- Label.
- Badge variant atau presentation mapping bila pattern existing mendukung.
- Sort order bila relevan.

Jangan hardcode label status di banyak page.

==================================================
H. DUMMY DATA FOUNDATION
==================================================

Buat dummy data terpusat berdasarkan `docs/mockup-data-scenarios.md`.

Minimum:

- Users untuk seluruh role demo.
- Parties.
- Contacts.
- Prospects.
- Clients.
- Opportunities.
- Projects.
- Project services.
- Travelers atau participants.
- Vendors.
- Budget summaries.
- Invoices.
- Payments.
- Activities.
- Changes.
- Attention items.

Aturan:

- Gunakan stable IDs.
- Relasi harus konsisten.
- Jangan duplikasi object berbeda dengan ID yang sama.
- Jangan menaruh seluruh data dalam satu file raksasa bila codebase mendukung modular fixture.
- Sediakan helper selector sederhana bila dibutuhkan.
- Jangan membuat fake API bila tidak diperlukan.
- Jangan menyimpan data sensitif nyata.
- Gunakan nilai IDR dan format yang konsisten.
- Gunakan tanggal demo yang saling masuk akal.
- Project normal, high-change, dan complex harus dapat dibedakan.

==================================================
I. CURRENT USER DAN ROLE MOCK
==================================================

Siapkan mock current user yang sederhana dan mudah diganti saat demo.

Persyaratan:

- Seluruh role demo tersedia.
- Role dapat diubah melalui satu source of truth atau demo switcher bila sesuai scope.
- Navigation visibility mengikuti role.
- Page access mock mengikuti route matrix.
- Financial visibility dapat dibatasi.
- Unauthorized state harus jelas.
- Jangan membuat authentication backend.
- Jangan menyimpan permission logic tersebar di banyak component.
- Gunakan helper/composable untuk `canView`, `canManage`, atau pola existing yang setara.

Bila template sudah memiliki auth mock, adaptasi tanpa merusak behavior existing.

==================================================
J. SHARED FORMATTERS
==================================================

Pastikan tersedia formatter terpusat untuk:

- Rupiah.
- Number.
- Percentage.
- Date.
- Date time.
- Date range.
- Traveler count.
- Status label.

Gunakan locale Indonesia untuk Rupiah dan tanggal bila sesuai keputusan docs.

Jangan membuat format manual berbeda-beda di setiap halaman.

==================================================
K. SHARED UI FOUNDATION
==================================================

Reuse atau adaptasi komponen existing untuk menghasilkan baseline berikut:

- Page header.
- Breadcrumb.
- KPI card.
- Status badge.
- Data table wrapper bila existing.
- Filter bar.
- Search input.
- Empty state.
- Loading state.
- Error state.
- Attention indicator.
- Section card.
- Detail metadata list.
- Confirmation dialog bila diperlukan.
- Role access state.
- Responsive tab atau navigation pattern untuk Project Detail.

Jangan menduplikasi komponen library hanya untuk mengganti nama.

==================================================
L. DASHBOARD FOUNDATION
==================================================

Dashboard pada tahap ini cukup membuktikan foundation bekerja.

Gunakan dummy data terpusat dan reusable components untuk menampilkan contoh:

- Active projects.
- Open opportunities.
- Upcoming departures.
- Attention items.
- Outstanding invoices.
- Recent activity.

Dashboard belum harus final. Fokus:

- Data flow konsisten.
- Responsive.
- Role visibility bekerja.
- Status badge konsisten.
- Format Rupiah dan tanggal benar.
- Loading, empty, dan error state dapat disimulasikan.
- Tidak ada data hardcoded langsung yang menduplikasi fixture.

==================================================
M. PROJECT DETAIL SHELL
==================================================

Buat Project Detail shell menggunakan salah satu project scenario.

Minimum:

- Project header.
- Client.
- Destination.
- Travel date.
- Project status.
- Project owner.
- Summary metrics.
- Tab atau section navigation sesuai IA.
- Overview placeholder yang menggunakan data real dari fixture.
- Not-found state.
- Conditional service visibility.

Jangan implementasikan seluruh itinerary, traveler, vendor, dan finance detail pada tahap ini.

==================================================
N. QUALITY AND SAFETY
==================================================

Setelah perubahan:

- Jalankan formatter yang sesuai hanya pada file terkait.
- Jalankan lint.
- Jalankan typecheck.
- Jalankan test.
- Jalankan build.
- Periksa route utama.
- Periksa desktop dan mobile layout.
- Periksa console error.
- Periksa broken import.
- Periksa hydration warning.
- Periksa navigation role visibility.
- Periksa direct refresh dynamic route.
- Periksa dark mode bila template mendukung.
- Jangan meninggalkan debug log.
- Jangan meninggalkan data template lama pada UI aktif tanpa alasan.

Bila baseline sudah memiliki error sebelum perubahan, bedakan:

- Pre-existing.
- Introduced by this phase.
- Fixed in this phase.
- Deferred.

Jangan mengklaim semua pass bila ada kegagalan.

==================================================
O. DOCUMENTATION UPDATE
==================================================

Update:

- `docs/mockup-progress.md`
- `docs/mockup-design-decisions.md`
- `docs/mockup-open-questions.md`
- `docs/template-reuse-mapping.md`
- `docs/route-and-role-matrix.md`

Catat:

- File dibuat.
- File diubah.
- File dihapus.
- Komponen direuse.
- Route aktif.
- Dummy data tersedia.
- Role behavior.
- Validation result.
- Known issue.
- Deferred work.
- Rekomendasi prompt berikutnya.

Jangan menghapus histori lama.

==================================================
P. ACCEPTANCE CRITERIA
==================================================

Foundation dianggap selesai bila:

1. Template masih dapat dijalankan.
2. Build tidak rusak akibat perubahan baru.
3. App identity sudah menjadi MANOVA.
4. Navigation mengikuti IA.
5. Role visibility mock berjalan.
6. Route foundation dapat dibuka.
7. Dummy data terpusat tersedia.
8. Type dan status constants tersedia.
9. Formatter terpusat tersedia.
10. Dashboard foundation menggunakan fixture.
11. Project Detail shell menggunakan fixture.
12. Empty/loading/error state memiliki baseline.
13. Tidak ada menu template lama yang masih aktif tanpa alasan.
14. Komponen reusable tidak terhapus.
15. Candidate removal sudah diperiksa dependensinya.
16. Dokumentasi telah diperbarui.
17. Tidak ada klaim integrasi backend nyata.

==================================================
Q. LAPORAN AKHIR
==================================================

Berikan laporan dengan format:

1. Executive summary.
2. Files created.
3. Files changed.
4. Files removed beserta alasan.
5. Existing components reused.
6. New shared components.
7. Routes activated.
8. Navigation and role behavior.
9. Dummy data scenarios available.
10. Validation commands and results.
11. Pre-existing issues.
12. Issues introduced and resolved.
13. Remaining known issues.
14. Documentation updated.
15. Recommended next implementation prompt.

Jangan lanjut membangun CRM, Opportunity, atau seluruh Project module setelah foundation selesai. Berhenti setelah laporan.