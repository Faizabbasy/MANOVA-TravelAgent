# Diagram flow utama

Diagram adalah target arsitektur, bukan representasi bahwa backend sekarang sudah menjalankannya.

## Project → Booking → AR/AP → actual → proyeksi

```mermaid
flowchart LR
  P[Project] --> B[Booking: flight / hotel / transport / MICE]
  B --> CI[Customer invoice / billing schedule]
  B --> VI[Vendor invoice / deposit]
  CI --> AR[Receivable outstanding]
  VI --> AP[Payable outstanding]
  AR --> CF[Cash Flow projection]
  AP --> CF
  AR --> R[Customer receipt posted]
  AP --> D[Vendor disbursement posted]
  R --> S[Account Statement: actual]
  D --> S
  S --> L[Account Ledger per bank account]
  L --> C[Current cash]
  C --> CF
  CF --> DB[Finance Dashboard]
```

## Customer invoice → receivable → receipt

```mermaid
sequenceDiagram
  participant O as Project/Booking
  participant F as Finance API
  participant A as Account
  O->>F: Issue customer invoice (project, party, due/expected)
  F->>F: Create AR once; no cash movement
  F-->>O: Invoice + outstanding
  O->>F: Record receipt + AR allocations + idempotency key
  F->>F: Validate scope, amount, allocation, status
  F->>A: Post cash in atomically
  F->>F: Reduce AR and append audit
  F-->>O: Movement, new outstanding, statement link
```

## Vendor invoice → payable → payment

```mermaid
flowchart LR
  V[Vendor / Service Order] --> I[Vendor invoice submitted]
  I --> Q{Review / match}
  Q -->|Rejected| X[No payable]
  Q -->|Accepted| AP[Payable: due + expected]
  AP --> PM[Partial/full disbursement posted]
  PM --> ST[Statement cash out]
  PM --> AP2[Remaining AP recalculated]
  ST --> BL[Bank ledger balance]
```

## Cancellation policy → credit → refund settlement

```mermaid
flowchart TD
  B[Booking with policy version snapshot] --> C[Cancellation requested + reason]
  C --> P[Preview tier from departure/cancel dates]
  D[Posted customer DP payments] --> P
  P --> K[Retained + refundable split]
  K --> A{Approval}
  A -->|Rejected| RJ[Audit rejection; no cash out]
  A -->|Approved| CN[Credit note + refund obligation linked to original payment]
  CN --> SE[Settlement from selected bank account]
  SE --> M[Posted cash out + allocation]
  M --> S[Statement, account ledger, booking history]
  M --> CF[Cash Flow outstanding updated]
```

## Cashflow projection: actual vs expected

```mermaid
flowchart LR
  OB[Verified opening balance] --> AC[Current cash as of date]
  MOV[Posted actual movements] --> AC
  AR[Open AR by expected/due date] --> PR[Monthly projection]
  AP[Open AP by expected/due date] --> PR
  RF[Approved unpaid refunds] --> PR
  AC --> PR
  PR --> M1[Month 1 opening + incoming - outgoing = closing]
  M1 --> M2[Month 2 opening = Month 1 closing]
  M2 --> GAP[First negative/low cash warning]
```

## Transfer per rekening

```mermaid
flowchart LR
  A[Account A] -->|cash out| T[Transfer ID]
  T -->|cash in| B[Account B]
  T -->|fee A to B rule snapshot| F[Fee cash out]
  A & B & F --> L[Account Ledger movements]
  L --> C[Company total changes only by fee]
```
