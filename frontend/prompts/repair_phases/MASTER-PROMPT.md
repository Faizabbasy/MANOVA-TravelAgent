MASTER PROMPT

MANOVA B2B CLIENT ROLE — 18-PAGE CLIENT EXPERIENCE

Anda sedang melanjutkan pengembangan project MANOVA, sebuah Travel Agent Management System / Travel ERP B2B yang digunakan oleh perusahaan travel untuk mengelola seluruh lifecycle perjalanan client.

Project saat ini menggunakan:

Nuxt 4

Vue 3

TypeScript

Frontend/mockup only

Mock data

Belum menggunakan backend production

Belum menggunakan database production

Belum menggunakan API eksternal nyata

Lanjutkan dari codebase MANOVA yang sudah ada.

Jangan membuat project baru jika codebase sudah tersedia.

Jangan mengubah, menghapus, atau merombak fitur role lain yang tidak berkaitan dengan implementasi role Client.

A. DEFINISI ROLE CLIENT

Dalam MANOVA hanya ada satu role eksternal Client:

CLIENT

Client adalah perusahaan atau organisasi B2B yang membeli layanan perjalanan dari Manova.

Contoh:

Perusahaan swasta

BUMN

Instansi pemerintah

Universitas

Yayasan

Event organizer

Corporate group

Travel agent lain yang menggunakan Manova sebagai partner

Role Client bukan customer B2C individual yang membeli paket wisata melalui marketplace.

Jangan membuat flow B2C seperti:

Public travel marketplace

Browse paket wisata umum

Shopping cart

Checkout konsumen

Loyalty point individual

Public package booking

B. SATU ROLE CLIENT, TANPA SUB-ROLE

Hanya ada satu role:

CLIENT

Jangan membuat role terpisah seperti:

Client Admin

Client PIC

Client Approver

Client Finance

Client Viewer

Participant

Seluruh fungsi customer B2B digabungkan ke role Client.

Role Client dapat:

Membuat travel request

Mengelola kebutuhan perjalanan

Melihat proposal dan quotation

Meminta revisi quotation

Memberikan approval

Mengelola participant

Melihat itinerary

Memantau reservation

Mengajukan change request

Mengakses dokumen

Melihat invoice

Mengunggah bukti pembayaran

Mengirim pesan

Membuat support ticket

Melihat laporan

Memberikan feedback

Mengelola profil perusahaan

Participant tetap menjadi entitas data dalam project, bukan role login terpisah.

Jangan membuat halaman user management atau role management khusus Client.

C. TUJUAN CLIENT EXPERIENCE

Client harus dapat menjalankan alur lengkap:

Travel Request
→ Requirement Review
→ Proposal & Quotation
→ Revision / Approval
→ Opportunity Won
→ Project Created
→ Participant Collection
→ Itinerary Review
→ Reservation Monitoring
→ Invoice & Payment
→ Trip Execution
→ Change / Issue Handling
→ Final Documents
→ Feedback
→ Project Closing

Client area tidak boleh hanya berisi dashboard dan daftar data.

Setiap halaman harus mempunyai fungsi nyata, mock workflow, state, validation, action, dan feedback.

D. BATASAN DATA CLIENT

Role Client hanya boleh melihat data milik perusahaan client yang sedang login.

Client tidak boleh melihat:

Data perusahaan client lain

Buying price vendor

Internal vendor quotation

Vendor contract internal

RAB internal

Margin

Markup

Profitability internal

Komisi

Internal approval Manova

Internal notes

Internal chat

Evaluasi vendor internal

Cash flow internal

Data payroll

Data user internal

Audit keamanan internal

Client hanya boleh melihat:

Selling price kepada client

Layanan yang dibeli

Status operasional client-visible

Dokumen client-visible

Participant milik project perusahaan tersebut

Invoice dan pembayaran perusahaan tersebut

Activity yang ditandai client-visible

E. STRUKTUR 18 HALAMAN CLIENT

Gunakan struktur berikut.

HOME

Dashboard

Notifications

REQUEST & COMMERCIAL

Travel Requests

Quotations & Proposals

Approval Center

TRAVEL MANAGEMENT

Projects

Participants

Itineraries

Reservations

Trip Center

Change Requests

COLLABORATION

Documents

Messages & Activities

Issues & Support

FINANCE

Finance & Billing

INSIGHTS

Reports & Analytics

Feedback & Evaluation

COMPANY

Company Profile

Jangan menambahkan halaman Users & Access karena hanya ada satu role Client.

F. REKOMENDASI ROUTE

Sesuaikan route dengan convention project existing.

/client
/client/notifications

/client/travel-requests
/client/travel-requests/new
/client/travel-requests/:id
/client/travel-requests/:id/edit

/client/quotations
/client/quotations/:id

/client/approvals
/client/approvals/:id

/client/projects
/client/projects/:id

/client/participants
/client/participants/:id

/client/itineraries
/client/itineraries/:id

/client/reservations
/client/reservations/:id

/client/trip-center
/client/trip-center/:projectId

/client/change-requests
/client/change-requests/new
/client/change-requests/:id

/client/documents

/client/messages
/client/messages/:projectId

/client/support
/client/support/new
/client/support/:id

/client/billing
/client/billing/invoices/:id

/client/reports
/client/feedback
/client/company-profile

Tidak semua detail harus menjadi halaman terpisah jika lebih cocok menggunakan:

Drawer

Modal

Tab dalam Project Workspace

Side panel

Nested detail route

G. DETAIL 18 HALAMAN

1. Dashboard

Dashboard menampilkan:

Active projects

Upcoming trips

Pending approvals

Incomplete participant data

Outstanding invoices

Open issues

Action required

Project readiness

Upcoming trip

Recent activity

Financial summary

Quick actions

Quick actions:

Create Travel Request

Review Approval

Add Participant

View Upcoming Trip

Upload Payment Proof

Create Support Ticket

Dashboard harus dihitung dari mock data terpusat, bukan angka statis yang tidak terhubung.

2. Notifications

Fitur:

Notification list

Mark as read

Mark all as read

Unread filter

Category filter

Search

Open related entity

Empty state

Notification preference mock

Kategori:

Approval

Project

Participant

Reservation

Document

Payment

Trip

Support

System

3. Travel Requests

Fitur:

List

Search

Filter

Sort

Create

Save draft

Edit draft

Submit

Duplicate

Cancel

Open detail

Activity history

Respond to clarification

Upload attachment

Data:

Request name

Company

Contact person

Trip type

Purpose

Destination

Travel dates

Flexible date

Estimated participants

Estimated budget

Currency

Flight requirements

Hotel requirements

Transportation requirements

MICE requirements

Additional services

Attachments

Status:

Draft
Submitted
Under Review
Need Clarification
Proposal Preparation
Converted to Opportunity
Cancelled
Closed

4. Quotations & Proposals

Fitur:

List quotation

Detail proposal

Service breakdown

Selling price

Tax

Payment terms

Inclusion

Exclusion

Terms

Cancellation policy

Proposed itinerary

Attachments

Comments

Version history

Compare versions

Compare package options

Request revision

Approve

Reject

Download mock PDF

Status:

Sent
Viewed
Revision Requested
Revised
Waiting Approval
Approved
Rejected
Expired
Superseded

Client tidak boleh melihat internal cost dan margin.

5. Approval Center

Jenis approval:

Proposal

Quotation

Final itinerary

Participant list

Rooming list

Change request

Additional charge

Cancellation charge

Project completion

Final report

Berita acara

Action:

Approve

Reject

Request revision

Add comment

Setiap keputusan harus menyimpan mock audit:

Approver

Timestamp

Decision

Comment

Version

Approved amount

Reject dan request revision wajib memiliki alasan.

6. Projects

Project list menampilkan:

Project code

Project name

Destination

Travel dates

Participant count

Project value

Readiness

Project status

Manova PIC

Last activity

Status:

Initiation
Planning
Preparation
Ready
In Progress
On Hold
Completed
Closing
Closed
Cancelled

Project Workspace mempunyai tab:

Overview

Timeline

Services

Participants

Itinerary

Reservations

Documents

Billing

Change Requests

Issues

Activities

Closing

7. Participants

Fitur:

List

Add

Edit

Bulk import mock

Export

Replace

Cancel

Assign room

Assign roommate

Mark VIP

Filter incomplete data

Bulk action

Detail

Document completeness

Data:

Full name

Gender

Birth date

Nationality

Identity

Passport

Visa

Phone

Email

Emergency contact

Dietary preference

Allergy

Medical note

Special assistance

Room preference

Seat preference

Baggage

Notes

Status:

Draft
Incomplete
Submitted
Need Revision
Verified
Booked
Ticketed
Cancelled
Replaced
Travel Completed

8. Itineraries

Fitur:

List

Daily timeline

Table view

Version history

Compare versions

Comments

Request revision

Approve

Download mock PDF

Isi itinerary:

Date

Time

Activity

Location

Transportation

Hotel

Meal

Meeting point

Dress code

PIC

Notes

Attachment

Status:

Draft
Under Review
Revision Requested
Waiting Approval
Approved
Final
Superseded

Jangan menimpa versi lama.

9. Reservations

Kategori:

Flight

Hotel

Transportation

Venue

Restaurant

Guide

Activity

Visa

Insurance

Event equipment

Client dapat:

Melihat reservation status

Membuka confirmation

Membuka ticket

Membuka voucher

Memantau deadline

Meminta perubahan melalui Change Request

Client tidak dapat mengedit booking vendor secara langsung.

Status:

Requested
Checking Availability
On Hold
Reserved
Confirmed
Issued
Changed
Cancelled
Completed

10. Trip Center

Trip Center aktif menjelang dan saat perjalanan.

Tampilkan:

Countdown

Current trip status

Today’s schedule

Next activity

Meeting point

Tour Leader

Manova PIC

Emergency contact

Flight

Hotel

Transportation

Announcements

Participant readiness

Important documents

Open issues

Action:

View itinerary

View ticket

View voucher

Contact Manova PIC

Create issue

Confirm announcement

11. Change Requests

Jenis:

Add participant

Remove participant

Replace participant

Change date

Change flight

Change hotel

Add transportation

Add activity

Upgrade service

Remove service

Change itinerary

Cancel service

Cancel project

Detail:

Original condition

Requested change

Reason

Availability result

Cost impact

Schedule impact

Cancellation fee

Required approval

Progress

Comments

Activity history

Status:

Draft
Submitted
Under Review
Availability Check
Costing
Waiting Client Approval
Approved
Rejected
In Execution
Completed
Cancelled

12. Documents

Kategori:

Commercial

Participant

Travel

Finance

Closing

Fitur:

Search

Filter category

Filter project

Preview

Download

Upload

Replace version

Version history

Verification status

Expiry date

Comment

Related entity

Gunakan mock file metadata.

13. Messages & Activities

Fitur:

Conversation per project

Conversation per quotation

Conversation per itinerary

Conversation per change request

Comment

Reply

Mention mock

Attachment mock

Search

Unread filter

Client-visible activity timeline

Pisahkan:

Message thread

System activity

Document activity

Approval activity

Jangan tampilkan internal chat Manova.

14. Issues & Support

Kategori:

Reservation

Participant

Document

Billing

Operational

Complaint

Emergency

Technical

Service quality

Priority:

Low
Medium
High
Urgent

Status:

Open
Assigned
In Progress
Waiting for Client
Resolved
Closed
Reopened

Fitur:

Create ticket

Reply

Attachment

SLA

Assigned PIC

Resolution

Confirm resolution

Reopen

Close

Rate resolution

15. Finance & Billing

Dashboard:

Total project value

Total invoiced

Total paid

Outstanding

Overdue

Next due date

Invoice:

Invoice number

Project

Issue date

Due date

Subtotal

Tax

Total

Paid amount

Outstanding

Status

Payment schedule

Payment history

Tax invoice

Receipt

Credit note

Action:

Download invoice

Download tax invoice

Upload payment proof

Submit payment confirmation

Raise dispute

View statement

Client tidak dapat menandai invoice sebagai Paid secara langsung.

16. Reports & Analytics

Cards:

Total trips

Total projects

Total participants

Total spending

Average project value

Upcoming trips

Completed trips

Outstanding invoices

Analytics:

Spending by month

Spending by destination

Spending by service

Trips by status

Participant trend

Change request frequency

Cancellation rate

Issue category

Payment status

Satisfaction

Fitur:

Date filter

Project filter

Destination filter

Service filter

Export Excel mock

Export PDF mock

Print view

17. Feedback & Evaluation

Form:

Overall experience

Sales responsiveness

Proposal quality

Itinerary quality

Hotel

Transportation

Tour Leader

Operation support

Reservation handling

Communication

Issue resolution

Value for money

Recommendation score

Comment

Improvement suggestion

Testimonial permission

Status:

Not Started
Draft
Submitted
Acknowledged
Follow-up Required
Closed

Feedback harus memperbarui project closing progress.

18. Company Profile

Data:

Company name

Logo

Industry

Company type

Registration number

NPWP

Address

City

Province

Country

Postal code

Website

Main contact

Phone

Email

Finance contact

Emergency contact

Billing name

Billing address

Tax data

Payment term

Preferred currency

PO requirement

Travel preferences

Company documents

Tidak ada user management atau sub-role management.

H. CROSS-MODULE FLOW WAJIB

Flow 1 — Travel Request ke Project

Client creates Travel Request
→ Request Submitted
→ Mock Sales Review
→ Quotation created
→ Client reviews
→ Client approves
→ Mock Opportunity becomes Won
→ Project automatically created
→ Dashboard and Projects updated

Flow 2 — Participant Readiness

Project created
→ Client adds participants
→ Completion calculated
→ Participant submitted
→ Mock Operation verification
→ Reservation status updated
→ Dashboard readiness updated

Flow 3 — Itinerary Approval

Itinerary published
→ Approval created
→ Client reviews
→ Revision requested
→ New version created
→ Client approves
→ Project readiness updated

Flow 4 — Billing

Invoice issued
→ Notification created
→ Client opens invoice
→ Client uploads payment proof
→ Waiting Verification
→ Mock verification
→ Paid / Partially Paid
→ Dashboard and Project Billing updated

Flow 5 — Change Request

Client submits change
→ Mock Manova review
→ Availability and cost impact created
→ Client approves impact
→ Change executed
→ Related project data updated

Flow 6 — Trip Closing

Project Ready
→ Trip Center active
→ Issue can be reported
→ Trip completed
→ Final documents available
→ Feedback requested
→ Completion approval
→ Project Closed

I. MOCK DATA SCENARIOS

Gunakan minimal lima skenario yang sama di seluruh modul.

Scenario A — Korea Incentive Trip

45 participants

Preparation

Quotation approved

Participant completion 82%

Hotel confirmed

Flight on hold

Invoice partially paid

Itinerary waiting approval

Scenario B — Abu Dhabi Business Delegation

24 participants

Trip active

Trip Center enabled

One schedule change

One open issue

Invoice paid

Scenario C — Manila Corporate Meeting

Trip completed

Final invoice paid

Final report available

Feedback pending

Completion approval pending

Scenario D — Bali MICE Event

Travel request Need Clarification

No quotation yet

Venue and event requirements incomplete

Scenario E — Singapore Conference

Major change request

Cancellation fee

Revised quotation available

Approval pending

Jangan menggunakan Lorem Ipsum.

J. ARSITEKTUR FRONTEND

Pisahkan:

types
mock-data
services/repositories
stores/composables
pages
components
utils

Jangan menaruh seluruh business logic dalam page component.

Sediakan type/interface untuk:

ClientCompany

TravelRequest

Quotation

QuotationVersion

Approval

Project

Participant

Itinerary

ItineraryVersion

Reservation

ChangeRequest

Document

Invoice

Payment

MessageThread

Activity

SupportTicket

Feedback

Notification

Gunakan ID relasional yang konsisten.

Jika project sudah menggunakan Pinia, ikuti Pinia.

Jika tidak, ikuti state pattern existing.

K. UI/UX REQUIREMENTS

Gunakan design system existing

Jangan membuat design system baru tanpa kebutuhan

Professional corporate B2B

Responsive desktop, tablet, mobile

Clear information hierarchy

Status badge konsisten

Search dan filter

Empty state

Loading state

Error state

Success feedback

Confirmation dialog

Unsaved changes warning

Form validation

Responsive table

Mobile card alternative

Breadcrumbs pada detail

Accessible labels

Jangan hanya mengandalkan warna

Tidak ada tombol mati

Tidak ada placeholder page

L. CLIENT ACCESS

Gunakan role:

CLIENT

Client hanya dapat mengakses route /client/**.

Tambahkan mock Client account jika sistem memiliki mock login atau role switcher.

Jangan merusak role internal.

Jangan mengubah permission role lain jika tidak berkaitan.

M. DOKUMENTASI WAJIB

Buat atau update, menyesuaikan struktur docs existing:

docs/client-role-scope.md
docs/client-information-architecture.md
docs/client-business-flow.md
docs/client-page-inventory.md
docs/client-mock-data-scenarios.md
docs/client-progress.md

Jangan membuat file duplikat jika dokumen setara sudah ada.

docs/client-progress.md harus mencatat:

Section

Status

Pages

Routes

Components

Mock data

Services/store

Workflow

Test result

Known issue

Next section

N. QUALITY GATE

Setiap section wajib:

Membaca master prompt.

Membaca progress terakhir.

Mengaudit code existing.

Menggunakan ulang component yang sesuai.

Menjaga cross-module consistency.

Menjalankan lint jika tersedia.

Menjalankan typecheck jika tersedia.

Menjalankan unit test jika tersedia.

Menjalankan build jika relevan.

Memperbaiki error yang disebabkan perubahan section.

Update dokumentasi.

Berhenti setelah section selesai.

Jangan lanjut ke section berikutnya tanpa perintah baru.

O. LARANGAN

Jangan:

Membuat banyak role Client

Membuat sub-role Client

Membuat participant sebagai role login

Membuat backend atau API nyata

Menghubungkan database production

Menampilkan cost vendor atau margin

Mengubah fitur role lain yang tidak berkaitan

Menghapus fitur existing yang benar

Membuat tombol tanpa fungsi

Membuat placeholder page

Membuat angka dashboard yang tidak terhubung

Menggunakan data random yang tidak konsisten

Menggunakan Lorem Ipsum

Menduplikasi component existing

Menyimpan seluruh logic dalam page

Mengerjakan section lain di luar scope

Mengklaim test pass jika tidak dijalankan