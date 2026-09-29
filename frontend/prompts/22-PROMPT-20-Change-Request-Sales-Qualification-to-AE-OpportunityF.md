MANOVA — Change Request: Sales Qualification to Account Executive Opportunity Flow

Baca dan jalankan perubahan berikut terhadap codebase MANOVA yang sudah ada.

Gunakan kondisi codebase aktual dan seluruh dokumentasi pada folder docs/ sebagai source of truth.

Sebelum mulai:

Baca prompts/01-PROTOKOL-WAJIB.md.

Baca seluruh dokumentasi pada folder docs/.

Baca laporan section terakhir pada docs/mockup-section-reports/.

Periksa git status.

Jangan menimpa perubahan user.

Jangan mengubah section lama kecuali benar-benar dibutuhkan.

Bila perubahan lintas section diperlukan, lakukan minimal, catat pada docs/mockup-change-impact-log.md, lalu lakukan regression check.

Kerjakan hanya perubahan pada prompt ini.

1. Tujuan Perubahan

Perbaiki alur Customer Journey agar pembagian tanggung jawab Sales dan Account Executive jelas.

Flow final:

Lead Baru→ Sales Screening→ Sales Lengkapi Qualification→ Qualified→ Assign ke Account Executive→ Opportunity Otomatis Dibuat→ AE Lengkapi Requirement Detail→ AE Buat Quotation→ AE Submit ke Management→ Management Approve / Reject→ AE Mark as Won→ Active Client→ Project Order Otomatis Dibuat

2. Form Tambah Lead Baru oleh Sales

Pertahankan form awal tetap sederhana.

Field:

Nama Kontak — wajib

Nama Company — opsional

Sumber Lead — wajib

Telepon — opsional

Email — opsional

Setelah disimpan:

lead dibuat dengan stage New;

owner otomatis adalah Sales yang sedang login;

lead masuk ke daftar Leads;

activity Lead Created tercatat;

jangan langsung membuat Opportunity;

jangan langsung membuat Customer;

jangan meminta requirement perjalanan lengkap pada form awal.

3. Lead Detail Drawer

Saat lead diklik, tampilkan right-side drawer.

Tab:

Overview

Qualification

Activities

Follow-ups

Overview

Tampilkan:

Nama kontak

Nama company

Stage

Sumber lead

Owner Sales

Account Executive tujuan bila sudah ditentukan

Telepon

Email

Tanggal dibuat

Expected close bila tersedia

Qualification summary

Recent activity

Action:

Catat Activity / Follow-up

Lengkapi Qualification

Archive

Jangan tampilkan action Convert to Customer.

4. Qualification Form oleh Sales

Tambahkan form Lengkapi Qualification.

Field wajib sebelum lead dapat dinyatakan Qualified:

Jenis kebutuhan:

Corporate Travel

Group Travel

Individual Travel

MICE / Event

Destinasi atau area tujuan

Tanggal atau periode perjalanan

Estimasi jumlah traveler

Service scope:

Flight

Hotel

Transportation

MICE

Other

Ringkasan kebutuhan awal

Account Executive yang menerima lead

Hasil qualification

Field opsional:

Estimasi budget atau budget range

Fleksibilitas tanggal

Decision maker

Tingkat urgensi

Expected close

Special request awal

Catatan hasil komunikasi

Action:

Simpan Draft

Qualify & Create Opportunity

Mark as Unqualified

5. Validation Qualification

Tombol Qualify & Create Opportunity harus disabled bila field wajib belum lengkap.

Tampilkan warning yang jelas, misalnya:

Destinasi belum diisi

Periode perjalanan belum diisi

Estimasi traveler belum diisi

Service scope belum dipilih

Account Executive belum dipilih

Ringkasan kebutuhan belum diisi

Jangan izinkan Opportunity dibuat dari lead yang belum lengkap.

6. Saat Sales Menekan Qualify & Create Opportunity

Sistem frontend mock harus:

Mengubah Lead menjadi Qualified.

Menyimpan qualification data.

Menetapkan Account Executive.

Membuat Opportunity baru.

Menghubungkan Opportunity ke Lead asal.

Menghubungkan Opportunity ke Party/Prospect.

Membawa data berikut ke Opportunity:

nama kontak;

nama company;

sumber lead;

destinasi;

periode perjalanan;

estimasi traveler;

service scope;

budget range;

expected close;

qualification notes;

Account Executive.

Membuat activity:

Lead Qualified

Lead Assigned to Account Executive

Opportunity Created

Mencegah satu Lead membuat lebih dari satu Opportunity.

Mengarahkan user ke Opportunity Detail atau menampilkan success state dengan link ke Opportunity.

7. Akses Sales

Sales dapat:

membuat Lead;

mengedit data awal Lead;

melakukan screening;

mengisi Qualification;

membuat Follow-up;

menandai Qualified atau Unqualified;

memilih Account Executive;

membuat Opportunity melalui action qualification;

melihat Opportunity hasil handover secara read-only atau terbatas.

Sales tidak dapat:

membuat final quotation;

submit commercial approval;

approve quotation;

Mark as Won;

mengubah commercial terms setelah handover kecuali permission khusus ditentukan.

8. Opportunity Detail untuk Account Executive

Setelah Opportunity dibuat, Account Executive menjadi owner utama.

Opportunity Detail harus menampilkan:

A. Overview

Prospect / Party

Contact person

Lead source

Account Executive

Destination

Travel period

Estimated traveler

Service scope

Estimated value

Expected close

Qualification summary

Related Lead

B. Requirement Detail

AE harus dapat melengkapi:

detail itinerary concept;

departure city;

destination detail;

detailed travel dates;

detailed traveler composition;

room requirement;

flight preference;

transport requirement;

MICE requirement;

special request;

decision maker;

payment terms;

commercial notes;

operational notes;

risk notes.

AE dapat mengubah atau menyempurnakan requirement awal dari Sales tanpa menghapus histori qualification.

C. Activities

komunikasi client;

meeting;

follow-up;

revision request;

commercial notes;

handover notes.

D. Quotation

quotation versions;

quotation value;

discount;

estimated cost;

estimated margin;

payment terms;

service breakdown;

status approval;

revision history.

9. Action untuk Account Executive

AE harus memiliki action:

Edit Requirement

Create Quotation

Edit Quotation

Create New Version

Submit for Approval

Revise Quotation

Mark as Lost

Mark as Won hanya setelah Management Approval

AE wajib dapat membuat quotation langsung dari Opportunity.

10. Requirement Gate untuk Quotation

AE tidak boleh membuat atau submit quotation bila requirement minimum belum lengkap.

Requirement minimum:

destination;

travel period;

estimated traveler;

service scope;

requirement summary;

contact person;

Account Executive;

estimated value atau quotation value;

payment terms bila diwajibkan;

margin/cost summary bila dipakai pada approval.

Tampilkan daftar field yang belum lengkap.

Gunakan status yang jelas:

Pending Requirement→ Ready for Quotation→ Quotation Draft→ Pending Management Approval→ Approved→ Won

Jangan gunakan status Won (Menunggu Approval) karena membingungkan.

11. Quotation oleh Account Executive

AE dapat:

membuat quotation;

mengisi service breakdown;

mengisi harga;

mengisi discount;

mengisi payment terms;

membuat versi baru;

menyimpan draft;

submit ke Management;

revisi setelah rejection.

Quotation harus terhubung ke:

Opportunity

Prospect/Client

Account Executive

Requirement

Service scope

Approval history

Gunakan dummy data terpusat dan stable IDs.

12. Management Approval

Hanya role Management yang dapat approve atau reject commercial approval.

Jangan gunakan Super Admin sebagai approver bisnis normal.

Management meninjau:

quotation value;

discount;

estimated margin;

payment terms;

service scope;

project complexity;

commercial risk.

Workflow:

Quotation Draft→ Submitted for Approval→ Approved by Management→ Ready to Win

Bila ditolak:

Submitted for Approval→ Rejected by Management→ kembali ke AE untuk revisi.

Tampilkan:

approver;

tanggal approval;

status;

catatan;

history approval.

13. Mark as Won oleh AE

AE hanya dapat Mark as Won jika:

requirement lengkap;

quotation tersedia;

quotation sudah Approved by Management;

client confirmation sudah dicatat bila digunakan;

Opportunity belum pernah dikonversi.

Saat Won:

Prospect menjadi Active Client;

jangan membuat duplicate company;

Opportunity menjadi Won;

approved quotation dikunci sebagai quotation final;

Project Order / Project otomatis dibuat;

AE tetap menjadi Account Owner;

Project Manager menjadi Operational Owner;

data requirement dan commercial dibawa ke Project Order;

activity log dibuat;

duplicate Project Order dicegah.

14. UI/UX yang Harus Diperbaiki

Lead Drawer

Tambahkan:

tab Qualification;

completion indicator;

missing-field warning;

assigned Account Executive;

qualification summary;

status handover.

Opportunity Detail

Tambahkan:

tombol Edit Requirement;

requirement completeness;

quotation actions;

Management approval status;

related Lead;

approval history;

clear stage indicator.

Ganti status yang membingungkan:

dari Won (Menunggu Approval)

menjadi Pending Management Approval

Gunakan label final:

Pending Requirement

Ready for Quotation

Quotation Draft

Pending Management Approval

Approved

Won

Lost

15. Dummy Data

Tambahkan atau perbaiki fixture agar tersedia:

Lead New tanpa qualification;

Lead Contacted dengan follow-up;

Lead Qualified dan assigned ke AE;

Lead Unqualified;

Opportunity Pending Requirement;

Opportunity Ready for Quotation;

Opportunity dengan Draft Quotation;

Opportunity Pending Management Approval;

Opportunity Approved;

Opportunity Won;

qualification history;

quotation version history;

Management approval history.

Pastikan relasi Lead → Opportunity → Client → Project Order konsisten.

16. Permission Minimum

Sales

Create Lead

Edit Lead

Add Follow-up

Complete Qualification

Assign Account Executive

Qualify / Unqualify

View handed-over Opportunity

Account Executive

View assigned Leads

Manage Opportunity

Edit Requirement

Create/Edit Quotation

Submit Approval

Revise Quotation

Mark as Lost

Mark as Won setelah approved

Management

View Opportunity

Review Quotation

Approve

Reject

Add approval notes

Super Admin

Full system visibility

User/role/master data

Audit visibility

bukan commercial approver normal

17. Dokumentasi

Update dokumen yang terdampak:

docs/mockup-scope.md

docs/mockup-information-architecture.md

docs/mockup-data-scenarios.md

docs/mockup-design-decisions.md

docs/mockup-open-questions.md

docs/mockup-progress.md

docs/route-and-role-matrix.md

docs/mockup-implementation-state.md

docs/mockup-section-progress.md

docs/mockup-change-impact-log.md

Buat laporan:

docs/mockup-section-reports/change-sales-qualification-ae-opportunity.md

Isi laporan:

flow sebelum dan sesudah;

role behavior;

Lead form;

Qualification form;

Opportunity creation;

AE requirement completion;

AE quotation;

Management approval;

permission changes;

files created/changed/removed;

validation;

regression;

known issues;

review URLs.

18. Validation

Setelah implementasi:

jalankan lint;

jalankan typecheck;

jalankan test;

jalankan build;

test create Lead;

test qualification draft;

test validation missing field;

test Qualify & Create Opportunity;

test duplicate prevention;

test Account Executive handover;

test AE Edit Requirement;

test AE Create Quotation;

test Submit for Approval;

test Management Approve;

test Management Reject;

test AE Mark as Won sebelum approval harus ditolak;

test AE Mark as Won setelah approval harus berhasil;

test Active Client dan Project Order terbentuk;

test role visibility;

test desktop dan mobile;

test loading, empty, error, not-found, unauthorized;

periksa console dan hydration warning;

regression-test Customer Journey, CRM, Opportunity, Dashboard, dan Project Order.

Laporkan pre-existing issue dan issue baru secara terpisah.

19. Acceptance Criteria

Perubahan selesai bila:

Form Lead awal tetap sederhana.

Sales dapat melengkapi Qualification setelah Lead dibuat.

Sales dapat menyimpan qualification draft.

Qualification memiliki validasi field wajib.

Sales dapat assign Account Executive.

Sales dapat Qualify & Create Opportunity.

Satu Lead tidak dapat membuat Opportunity ganda.

Opportunity membawa data qualification.

AE menjadi owner Opportunity.

AE dapat melengkapi requirement detail.

AE dapat membuat dan mengubah quotation.

AE dapat submit ke Management.

Hanya Management yang dapat approve/reject.

Status tidak lagi menggunakan Won (Menunggu Approval).

AE tidak dapat Mark as Won sebelum approval.

Opportunity Won mengaktifkan Client.

Project Order otomatis dibuat.

Activity history konsisten.

Role permission bekerja.

Dokumentasi diperbarui.

Validation dilaporkan jujur.

Setelah selesai:

berikan laporan akhir;

cantumkan URL yang perlu direview;

berhenti;

jangan lanjut ke section lain tanpa perintah saya.