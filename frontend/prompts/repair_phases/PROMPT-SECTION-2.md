PROMPT SECTION 2

DASHBOARD DAN NOTIFICATIONS

Baca kembali Master Prompt, progress terbaru, dan foundation Section 1.

Kerjakan hanya Section 2 — Home:

Dashboard

Notifications

A. Dashboard

Implementasikan dashboard yang menggunakan data terpusat.

Summary

Active projects

Upcoming trips

Pending approvals

Incomplete participants

Outstanding invoices

Open issues

Action required

Setiap action harus dapat membuka detail atau halaman terkait.

Contoh:

Quotation waiting approval

Itinerary revision

Missing passport

Invoice near due date

Change request decision

Closing approval

Upcoming trip

Project

Destination

Date

Participants

Readiness

Manova PIC

Status

Readiness

Commercial

Participants

Reservation

Documents

Payment

Execution

Recent activity

Gunakan activity mock terpusat.

Financial summary

Invoiced

Paid

Outstanding

Overdue

Next due

Quick action

Create Travel Request

Review Approval

Add Participant

Open Trip Center

Upload Payment Proof

Create Support Ticket

B. Notifications

Implementasikan:

List

Unread state

Mark as read

Mark all as read

Search

Category filter

Unread filter

Related entity navigation

Empty state

Loading state

Error state

Notification preference mock

Cross-module behavior

Marking notification read updates unread counter

Clicking notification opens entity/page

Dashboard count uses same data source

New mock actions can add notification

No hardcoded counter disconnected from store

Acceptance criteria

Dashboard is not static

All cards derive from shared data

All quick actions work

Notifications have real mock state

Responsive desktop/mobile

No unrelated pages changed

Test and docs

Jalankan test relevan dan update:

docs/client-page-inventory.md
docs/client-progress.md

Laporkan:

SECTION 2 — HOME
STATUS:

PAGES:
- Dashboard
- Notifications

WORKING FLOWS:
- ...

COMPONENTS:
- ...

STATE:
- ...

RESPONSIVE:
- ...

TEST:
- lint:
- typecheck:
- test:
- build:

KNOWN ISSUES:
- ...

NEXT SECTION:
Section 3 — Request & Commercial

Berhenti setelah Section 2 selesai.