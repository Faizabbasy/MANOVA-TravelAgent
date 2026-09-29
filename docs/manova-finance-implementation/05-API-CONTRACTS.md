# Kontrak API v1 (rancangan target)

Gunakan prefix `/api/v1`; nama route final boleh menyesuaikan konvensi baru yang ditetapkan Phase 1, tetapi **semantik harus sama**. JSON memakai `amountMinor` sebagai string desimal integer agar aman dari batas integer JavaScript; `currency` ISO, `date` `YYYY-MM-DD`, timestamp ISO UTC. Setiap response punya `data`, `meta.requestId`; list punya `meta.pagination`. Error: `{ error: { code, message, fieldErrors?, details? }, meta: { requestId } }`. Status umum: 400 invalid, 401 unauthenticated, 403 forbidden, 404 scoped not found, 409 state/version/idempotency conflict, 422 rule violation. Mutasi finansial menerima `Idempotency-Key` dan bila perlu `If-Match`/version.

## Read API

| Endpoint | Query/hasil | Akses |
|---|---|---|
| `GET /finance/dashboard` | `asOf`, `accountBalances`, `totalCash`, period inflow/outflow, AR/AP totals, 30d projected closing, top gaps, recent movements | finance/management sesuai scope |
| `GET /finance/accounts` | rekening aktif, masked number, currency, saldo per rekening | finance; edit lebih sempit |
| `GET /finance/statement` | `from,to,accountId,projectId,bookingType,bookingId,direction,sourceType,cursor,limit`; posted movement + source links, proof metadata | finance, scoped |
| `GET /finance/accounts/{id}/ledger` | `from,to,cursor,limit`; opening, rows dengan running balance, in/out, closing; urutan stabil `(effectiveAt,id)` | finance, scoped |
| `GET /finance/receivables` | status, due/expected range, project/customer, overdue, paginated; outstanding dan allocations | finance |
| `GET /finance/payables` | status, due/expected range, project/vendor, paginated; outstanding dan allocations | finance/procurement terbatas |
| `GET /finance/cash-flow` | `horizon=30d|3m|6m|12m`, `projectId?`, `accountId?`, `asOf?`; current cash, monthly rows, gaps, assumptions, excluded/unassigned count, confidence split | finance/management |
| `GET /projects/{id}/finance-summary` | sanitized sesuai role: customer invoice/AR, vendor invoice/AP, receipts/disbursements, refund, projected net; source IDs | project member/finance sesuai scope |
| `GET /bookings/{type}/{id}/finance-summary` | invoice, deposit/payment, AR, vendor deposit/AP, policy summary, refunds | internal; client view subset sell-side |
| `GET /vendors/{id}/finance-summary` | vendor invoice, paid/outstanding, due next | finance/procurement; supplier hanya miliknya dan tanpa internal-only data |
| `GET /finance/policies`, `GET /finance/policies/{id}` | current/past versions, tiers, scope/effective date | finance/admin; read-only internal sesuai role |

## Write API

| Endpoint | Operasi dan aturan |
|---|---|
| `POST /finance/accounts`, `PATCH /finance/accounts/{id}` | create/update metadata rekening; opening balance hanya melalui controlled opening command; rekening yang sudah dipakai tidak hard-delete. |
| `POST /finance/accounts/{id}/verify-opening` | amount, cutover date, reason, approver; one-time/versioned, audit. |
| `POST/PATCH /finance/transfer-fee-rules` | rule arah, nominal/%, validity; preview fee saat transfer. |
| `POST /finance/customer-invoices`, `PATCH /finance/customer-invoices/{id}`, `POST .../{id}/issue`, `POST .../{id}/void` | Draft CRUD; issue mensyaratkan party/project, due date, line total valid. Void dengan reason dan guard existing payment. |
| `POST /finance/vendor-invoices`, `PATCH .../{id}`, `POST .../{id}/approve|reject` | Vendor/service order scope, duplicate invoice number check, invoice approval; non-approved tidak menjadi payable confirmed kecuali aturan status terdokumentasi. |
| `PATCH /finance/receivables/{id}/expectation`, `PATCH /finance/payables/{id}/expectation` | expectedDate + reason/confidence; due date kontrak tidak otomatis berubah. |
| `POST /finance/receipts` | posted customer cash in + `allocations[]` ke AR atau advance, account, effectiveDate, method, reference, proof; hitung ulang outstanding. |
| `POST /finance/disbursements` | posted vendor cash out + AP allocations/advance, account, payee, proof; partial allowed. |
| `POST /finance/transfers` | from/to account, amount, directional fee quote/snapshot, effectiveDate, proof; atomic two legs + fee movement. |
| `POST /finance/policies`, `PATCH .../{id}`, `POST .../{id}/publish|deactivate` | Draft CRUD; published version immutable; tier validation. |
| `PUT /bookings/{type}/{id}/cancellation-policy` | assign published policy version/snapshot before cancellation; scope check. |
| `POST /bookings/{type}/{id}/cancellation-preview` | side-effect-free preview from actual paid deposit and policy snapshot; return tier, basis, forfeited/refundable, source payment IDs. |
| `POST /bookings/{type}/{id}/cancellations` | Create cancellation case idempotently; reason, policy snapshot, obligations and audit. Operational booking status is updated via its existing domain service, coordinated without direct frontend mutation. |
| `POST /finance/refunds/{id}/approve|reject` | maker/checker according to permission; reason mandatory on reject. |
| `POST /finance/refunds/{id}/settle` | account, payee, amount, originalPaymentId, proof/reference; posted cash out and settlement in one transaction; support partial until fully settled. |
| `POST /finance/credit-notes`, `GET /finance/credit-notes/{id}` | Manual adjustment only with documented reason/permission and precise effect on AR versus refund liability; generated cancellation credit note uses same record, no duplicate write path. |
| `GET /finance/refunds/{id}`, `GET /finance/settlements/{id}` | Case detail with payment, booking, policy snapshot, approvals, postings, proof and audit timeline. |
| `POST /finance/movements/{id}/reverse` | reason, actor and compensating movement; never delete posted history. |

## Contoh payload dan response

```json
POST /api/v1/finance/receipts
Idempotency-Key: 0cb3d891-6efb-4a4a-a214-3df82456e134
{
  "accountId": "BANK-01", "amountMinor": "30000000", "currency": "IDR",
  "effectiveDate": "2026-10-05", "projectId": "PRJ-101",
  "booking": { "type": "hotel", "id": "HBK-101" },
  "payerPartyId": "PTY-001", "reference": "TRX-ABC-001",
  "allocations": [{ "receivableId": "AR-001", "amountMinor": "30000000" }]
}
```

```json
{ "data": { "receiptId": "RCPT-001", "movementId": "MOV-001", "posted": true,
  "accountId": "BANK-01", "amountMinor": "30000000", "allocations": [
    { "receivableId": "AR-001", "amountMinor": "30000000", "outstandingMinor": "70000000" }
  ] }, "meta": { "requestId": "req-123" } }
```

Cross-project/customer/vendor IDs yang bukan milik actor harus menghasilkan 404/403 tanpa membocorkan record. Upload proof memakai endpoint terpisah dengan tipe/ukuran/ownership check dan mengembalikan `attachmentId`, bukan path filesystem dari client. Jangan terima `actorId` dari body; ambil dari session server.

## Shape read model yang wajib stabil

`GET /finance/cash-flow` harus mengembalikan `asOf`, `timezone`, `horizon`, `scope` (`company|project|account`), `openingCashMinor`, `rows[]` berisi `startDate,endDate,openingMinor,incomingMinor,outgoingMinor,closingMinor,confirmedIncomingMinor,expectedIncomingMinor,overdueIncomingMinor,confirmedOutgoingMinor,expectedOutgoingMinor,overdueOutgoingMinor`, lalu `warnings[]`, `excluded[]`, dan `assumptions`. Setiap bucket dapat di-drill down dengan source IDs. Jika opening belum diverifikasi, `data.available=false`, `reason=OPENING_BALANCE_UNVERIFIED`; angka nol tidak dipalsukan.

`GET /finance/accounts/{id}/ledger` mengembalikan opening/closing **berdasarkan periode yang dipilih**, bukan total sejak awal. Statement movement memakai `movementId`, `transferId?`, `sourceType/sourceId`, `projectId?`, `booking?`, `direction`, `amountMinor`, `effectiveAt`, `postedAt`, `accountId`, `counterparty`, `memo`, `proof`, `reversalOf?`. Ketika ada transfer, company statement dapat menandai kedua kaki sebagai internal transfer supaya inflow/outflow operasional tidak terinflasi.
