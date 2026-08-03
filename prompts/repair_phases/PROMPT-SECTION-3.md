PROMPT SECTION 3

TRAVEL REQUESTS, QUOTATIONS & PROPOSALS, APPROVAL CENTER

Baca Master Prompt, codebase terbaru, dan docs/client-progress.md.

Kerjakan hanya Section 3 — Request & Commercial:

Travel Requests

Quotations & Proposals

Approval Center

A. Travel Requests

Implementasikan:

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

Detail

Activity timeline

Clarification response

Attachment mock

Validation

Unsaved changes warning

Confirmation dialog

Form harus mencakup:

General information

Flight

Hotel

Transportation

MICE

Additional service

Attachment

Status flow:

Draft
→ Submitted
→ Under Review
→ Need Clarification
→ Proposal Preparation
→ Converted to Opportunity

B. Quotations & Proposals

Implementasikan:

List

Search/filter

Detail

Service breakdown

Selling price

Tax

Payment terms

Inclusion/exclusion

Terms

Cancellation policy

Proposed itinerary

Attachments

Comments

Version history

Compare version

Compare package option

Request revision

Approve

Reject

Download mock PDF

Jangan tampilkan internal cost.

C. Approval Center

Implementasikan:

Pending list

Approved

Rejected

Revision requested

Expired

Detail

Financial impact

Timeline impact

Supporting document

Comment

Audit history

Approve

Reject

Request revision

Reject dan revision wajib alasan.

Cross-module integration

Wajib berfungsi:

Travel Request submitted
→ Activity created
→ Notification created
→ Mock review
→ Quotation appears

Quotation revision requested
→ New status
→ Activity
→ Notification
→ New quotation version simulation

Quotation approved
→ Approval recorded
→ Quotation Approved
→ Mock Opportunity Won
→ Project created
→ Dashboard updated
→ Project List updated

Project yang dibuat harus menggunakan data quotation/request, bukan data baru yang tidak terhubung.

Acceptance criteria

Travel request CRUD mock berfungsi

Form validation berfungsi

Quotation version history tidak ditimpa

Approval decision berfungsi

Approval membuat audit trail

Approved quotation membuat project

Data internal tidak bocor

Test dan docs

Update:

docs/client-business-flow.md
docs/client-page-inventory.md
docs/client-progress.md

Laporan:

SECTION 3 — REQUEST & COMMERCIAL
STATUS:

PAGES:
- Travel Requests
- Quotations & Proposals
- Approval Center

CRUD / ACTIONS:
- ...

CROSS-MODULE FLOW:
- ...

VALIDATION:
- ...

COMPONENTS:
- ...

FILES:
- ...

TEST:
- lint:
- typecheck:
- test:
- build:

KNOWN ISSUES:
- ...

NEXT SECTION:
Section 4 — Core Project

Berhenti setelah Section 3 selesai.