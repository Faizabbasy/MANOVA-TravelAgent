PROMPT SECTION 6

FINANCE & BILLING, MESSAGES & ACTIVITIES, ISSUES & SUPPORT

Baca Master Prompt, progress terbaru, dan codebase terbaru.

Kerjakan hanya Section 6 — Finance & Collaboration:

Finance & Billing

Messages & Activities

Issues & Support

A. Finance & Billing

Implementasikan:

Finance summary

Invoice list

Search/filter

Invoice detail

Payment schedule

Payment history

Tax invoice

Receipt

Credit note

Upload payment proof

Payment reference

Payment confirmation

Raise dispute

Statement of account

Status:

Draft
Issued
Viewed
Waiting Verification
Partially Paid
Paid
Overdue
Disputed
Cancelled
Refunded

Client tidak boleh menandai Paid sendiri.

B. Messages & Activities

Implementasikan:

Project conversation

Quotation conversation

Itinerary conversation

Change request conversation

Reply

Comment

Mention mock

Attachment mock

Search

Unread state

Client-visible activity timeline

Activity filters

Pisahkan message dan system activity.

C. Issues & Support

Implementasikan:

Ticket list

Search/filter

Create ticket

Detail

Reply

Attachment

Priority

SLA

Assigned Manova PIC

Resolution

Confirm resolution

Reopen

Close

Rating

Emergency ticket harus menonjol secara UI.

Cross-module integration

Invoice issued
→ Notification
→ Dashboard financial summary
→ Client uploads proof
→ Waiting Verification
→ Mock verification
→ Paid / Partially Paid
→ Project billing updated

Support ticket created
→ Activity
→ Notification
→ Project issue count updated
→ Dashboard open issue count updated

Comments on quotation/itinerary/change request
→ Related activity timeline updated

Acceptance criteria

Invoice/payment mock workflow works

Payment proof has validation

Client cannot self-mark paid

Messages scoped to correct entity

Internal Manova messages hidden

Ticket lifecycle works

SLA and priority visible

Test dan docs

Update:

docs/client-business-flow.md
docs/client-page-inventory.md
docs/client-progress.md

Laporan:

SECTION 6 — FINANCE & COLLABORATION
STATUS:

PAGES:
- Finance & Billing
- Messages & Activities
- Issues & Support

BILLING FLOW:
- ...

MESSAGE FLOW:
- ...

SUPPORT FLOW:
- ...

CROSS-MODULE FLOW:
- ...

TEST:
- lint:
- typecheck:
- test:
- build:

KNOWN ISSUES:
- ...

NEXT SECTION:
Section 7 — Insights & Company

Berhenti setelah Section 6 selesai.