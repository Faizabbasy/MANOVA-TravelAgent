MANOVA — Change Request: Customer Journey, Account Executive, Supplier, dan Commercial Approval

Baca dan jalankan perubahan berikut terhadap codebase MANOVA yang sudah ada.

Gunakan kondisi codebase aktual dan seluruh dokumentasi pada folder docs/ sebagai source of truth.

Sebelum mulai:

Baca prompts/01-PROTOKOL-WAJIB.md.

Baca seluruh file pada folder docs/.

Baca laporan section terakhir pada docs/mockup-section-reports/.

Periksa git status.

Jangan menimpa perubahan user atau mengubah hasil section lama tanpa kebutuhan.

Bila perubahan lintas section diperlukan, lakukan minimal, catat pada docs/mockup-change-impact-log.md, lalu lakukan regression check.

Kerjakan hanya perubahan pada prompt ini.

1. Perubahan Role

Perbarui role MANOVA agar mencakup:

Internal

Super Admin

Management

Account Executive

Sales

Project Manager

Operations

Ticketing

Accommodation

Transportation

MICE

Finance

Viewer / Auditor

External Partners

Supplier

Tambahkan contoh akun supplier dari vendor berbeda:

PT ABC

PT EFG

Masing-masing supplier harus:

terhubung ke satu vendor company;

memiliki produk atau layanan yang berbeda;

hanya dapat melihat data company sendiri;

hanya dapat melihat assignment, quotation, order, atau project yang terkait;

tidak dapat melihat vendor lain;

tidak dapat melihat lead, Customer Journey internal, margin internal, atau activity internal yang tidak relevan.

Gunakan vendor isolation pada frontend mock secara konsisten.

2. Sales dan Account Executive

Sales

Sales bertanggung jawab untuk:

menerima lead;

memeriksa validitas lead;

melakukan screening awal;

mencatat sumber lead;

membuat follow-up;

mengubah status lead menjadi qualified atau unqualified;

menyerahkan lead qualified kepada Account Executive.

Sales tidak boleh melakukan final commercial approval dan tidak boleh Mark as Won.

Account Executive

Account Executive bertanggung jawab untuk:

menerima lead qualified;

membuat Opportunity;

melakukan requirement gathering;

mengelola relationship dengan prospect/client;

membuat, mengubah, dan merevisi quotation;

membuat versi quotation bila dibutuhkan;

melakukan negosiasi;

submit quotation untuk commercial approval;

Mark as Won setelah approval Management;

melakukan handover ke Project Manager;

tetap menjadi Account Owner setelah project berjalan.

Tambahkan action:

Create Quotation

Edit Quotation

Submit for Approval

Revise Quotation

Mark as Lost

Mark as Won hanya setelah approval Management.

3. Commercial Approval

Gunakan hanya role Management sebagai commercial approver.

Jangan membuat role Sales Manager baru.

Workflow:

Draft Quotation→ Submitted for Approval→ Approved by Management→ Negotiation / Final Confirmation→ Opportunity Won

Bila ditolak:

Submitted for Approval→ Rejected by Management→ kembali ke Account Executive untuk revisi.

Management meninjau:

quotation value;

discount;

estimated margin;

payment terms;

service scope;

project complexity;

commercial risk.

Aturan:

AE dapat membuat dan mengubah quotation.

AE dapat submit quotation ke Management.

Management dapat approve atau reject.

AE tidak dapat Mark as Won sebelum approval Management.

Tampilkan approver, status, tanggal, catatan, dan history approval.

Ini frontend mock; jangan mengklaim backend workflow nyata.

4. Opportunity Won

Ketika Opportunity menjadi Won:

company Prospect berubah menjadi Active Client;

jangan membuat duplicate company;

Opportunity berubah menjadi Won;

Project Order / Project otomatis dibuat;

AE tetap menjadi Account Owner;

Project Manager menjadi Operational Owner;

quotation approved dibawa ke Project Order;

client, contact, destination, travel date, traveler count, service scope, payment terms, dan commercial notes ikut dibawa;

activity log dibuat;

duplicate Project Order dari Opportunity yang sama dicegah.

Untuk repeat client:

jangan membuat client baru;

buat Opportunity dan Project Order baru pada client existing.

5. Customer Journey Dashboard

Tambahkan dashboard bernama Customer Journey.

Akses:

Super Admin: penuh.

Account Executive: penuh untuk data yang dimiliki atau diizinkan.

Sales: terbatas pada Lead sesuai role matrix.

Customer Journey mencakup:

A. Leads

Sediakan:

Table

Kanban

Inbox

Search

Filter stage

Filter owner

Filter source

New Lead

Archived leads

Lead source

Owner

Last updated

Follow-up indicator

Saat lead diklik, tampilkan right-side drawer berisi:

Overview

Activities

Follow-ups

Contact information

Lead source

Owner

Qualification details

Expected close bila tersedia

Notes

Qualify & Create Opportunity

Archive

Jangan gunakan Convert to Customer.

Flow yang benar:

Lead→ Qualified→ Create Opportunity→ Quotation→ Management Approval→ Won→ Active Client→ Project Order

B. Customers

Tambahkan halaman Customers/Companies dengan:

company list;

search;

filter industry;

filter size;

city;

phone;

status Prospect/Active Client;

Account Owner;

New Company bila sesuai scope.

Customer Detail memiliki tab:

Overview

Contacts

Opportunities

Project Orders

Activities

Documents

Tampilkan:

lifecycle Prospect atau Active Client;

Account Executive;

contact persons;

active opportunities;

project order history;

recent activities;

total project/value summary bila tersedia.

C. Project Orders

Tambahkan halaman semua Project Orders.

Filter:

client;

status;

Account Executive;

Project Manager;

travel date;

project type.

Detail Project Order menampilkan:

PO / Project Order number;

status;

status workflow;

overview;

financial;

documents;

client;

Account Executive;

Project Manager;

destination;

travel date;

service scope;

activity;

related Opportunity;

approved Quotation.

Gunakan pola UI existing seperti timeline, tabs, cards, dan document folder.

6. Super Admin Dashboard

Lead Source Recap

Tampilkan rekap sumber lead:

Website

Instagram

TikTok

WhatsApp

Referral

Event

Email

Sales Outreach

Other

Metrik:

total leads;

qualified leads;

opportunities created;

won opportunities;

conversion rate per source.

Gunakan fixture lead yang sama, bukan dataset terpisah.

Activity Center

Tambahkan halaman Activity Center untuk Super Admin.

Tampilkan activity lintas sistem:

lead created;

lead assigned;

follow-up added;

lead qualified;

opportunity created;

quotation created;

quotation submitted;

quotation approved/rejected;

opportunity won/lost;

client activated;

Project Order created;

project updated;

supplier activity;

invoice/payment activity;

user/role activity.

Filter:

date;

user;

role;

module;

activity type;

entity;

severity bila relevan.

Gunakan activity yang terhubung ke entity sumber.

7. Supplier dan External Partners

Tambahkan area External Partners.

Minimal mencakup:

vendor company;

supplier user;

vendor contact;

product/service catalog;

vendor assignment;

related order/project;

fulfillment/status;

documents yang relevan.

Contoh:

PT ABC

Supplier user khusus PT ABC.

Menjual produk/layanan kategori tertentu.

PT EFG

Supplier user khusus PT EFG.

Menjual produk/layanan berbeda dari PT ABC.

Supplier hanya dapat melihat:

company sendiri;

profile sendiri;

products/services sendiri;

assignment/order sendiri;

documents dan fulfillment status sendiri.

Supplier tidak dapat melihat:

vendor lain;

Customer Journey;

leads;

opportunity internal;

commercial approval;

margin;

activity internal umum.

8. Route dan Navigation

Evaluasi route berdasarkan codebase existing.

Rekomendasi:

/customer-journey

/customer-journey/leads

/customer-journey/customers

/customer-journey/customers/[id]

/customer-journey/project-orders

/customer-journey/project-orders/[id]

/customer-journey/lead-sources

/activity-center

/external-partners

/external-partners/vendors

/external-partners/vendors/[id]

/supplier

/supplier/products

/supplier/orders

Jangan membuat route duplikat bila route existing dapat diadaptasi.

9. Data Foundation

Perluas dummy data terpusat untuk:

lead;

lead source;

owner;

qualification;

follow-up;

Account Executive;

Opportunity;

Quotation;

Quotation version;

Management approval;

Prospect lifecycle;

Active Client lifecycle;

Project Order;

Activity;

vendor company;

supplier user;

vendor product/service;

supplier assignment.

Tambahkan minimal:

satu lead Website;

satu lead Instagram;

satu lead TikTok;

satu qualified lead milik AE;

satu quotation menunggu approval;

satu quotation approved;

satu Opportunity Won;

satu Active Client dengan beberapa Project Orders;

PT ABC dengan produk/layanan tertentu;

PT EFG dengan produk/layanan berbeda;

supplier user untuk masing-masing vendor.

Gunakan stable IDs dan relasi konsisten.

10. Hak Akses Minimum

Super Admin

full Customer Journey;

Lead Source Recap;

Activity Center;

semua Customers;

semua Project Orders;

semua vendor/supplier;

role/user management.

Management

review quotation;

approve/reject commercial approval;

melihat pipeline, client, dan Project Order;

melihat commercial summary.

Account Executive

mengelola lead yang ditugaskan;

membuat Opportunity;

membuat/mengubah quotation;

submit approval;

melihat approval;

Mark as Won setelah approved;

melihat Customer portfolio;

melihat Project Orders client yang dimiliki.

Sales

mengelola lead;

screening;

qualification;

follow-up;

assign ke AE sesuai permission;

tidak approve quotation;

tidak Mark as Won.

Supplier

data vendor sendiri;

product/service sendiri;

order/assignment sendiri;

tidak melihat Customer Journey internal.

Gunakan helper permission existing, jangan menyebarkan permission logic langsung di banyak component.

11. Dokumentasi

Update:

docs/mockup-scope.md

docs/mockup-information-architecture.md

docs/mockup-data-scenarios.md

docs/mockup-design-decisions.md

docs/mockup-open-questions.md

docs/mockup-progress.md

docs/route-and-role-matrix.md

docs/template-reuse-mapping.md

docs/mockup-implementation-state.md

docs/mockup-section-progress.md

docs/mockup-change-impact-log.md

Buat laporan:

docs/mockup-section-reports/change-customer-journey-ae-supplier.md

Laporan harus mencatat:

scope;

role changes;

Sales dan AE flow;

Management approval;

Customer Journey;

Lead Source Recap;

Activity Center;

supplier isolation;

route;

files created/changed/removed;

data/types/constants;

permission changes;

validation;

regression;

known issues;

review URLs.

12. Validation

Setelah implementasi:

jalankan lint;

typecheck;

test;

build;

periksa route baru;

periksa role switcher;

periksa Super Admin;

periksa Management approval;

periksa AE quotation;

periksa Sales qualification;

periksa Supplier PT ABC;

periksa Supplier PT EFG;

pastikan supplier tidak dapat melihat vendor lain;

periksa desktop/mobile;

periksa loading, empty, error, not-found, unauthorized;

periksa console dan hydration warning;

regression-test module existing yang terdampak.

Laporkan issue pre-existing dan issue baru secara terpisah.

13. Acceptance Criteria

Selesai bila:

Account Executive tersedia.

AE dapat membuat dan mengubah quotation.

Hanya Management yang dapat approve/reject commercial approval.

Opportunity tidak dapat Won sebelum approval Management.

Opportunity Won mengaktifkan Client dan membuat Project Order.

Customer Journey tersedia untuk Super Admin dan AE.

Leads memiliki Table/Kanban/Inbox dan right-side drawer.

Action lead menggunakan Qualify & Create Opportunity.

Customers memiliki Overview, Contacts, Opportunities, Project Orders, Activities, Documents.

Project Orders memiliki list dan detail workflow.

Super Admin memiliki Lead Source Recap.

Super Admin memiliki Activity Center.

Supplier PT ABC dan PT EFG memiliki akun dan produk/layanan berbeda.

Supplier hanya melihat data vendor sendiri.

Data lintas halaman konsisten.

Dokumentasi dan laporan diperbarui.

Validation dilaporkan jujur.

Setelah selesai:

berikan laporan akhir;

cantumkan URL review;

berhenti;

jangan lanjut ke section lain tanpa perintah saya.