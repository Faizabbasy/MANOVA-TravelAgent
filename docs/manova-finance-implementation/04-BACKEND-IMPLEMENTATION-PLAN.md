# Rencana implementasi backend (Bun + Elysia)

`backend/src/index.ts` saat audit hanya starter `GET /`. Tidak ada service, schema, auth, database, migration, ataupun test domain. Root `package.json` baru mengorkestrasi `frontend` (pnpm) dan `backend` (Bun); `backend/CLAUDE.md` meminta usul struktur sebelum fitur besar. Pertahankan Bun/Elysia sebagai host, lalu bangun modul berlapis. Contoh lokasi baru berikut adalah **extension point yang disarankan**, bukan klaim bahwa file telah ada.

```text
backend/src/index.ts                # composition, error handler, health, plugin routes
backend/src/config/                 # env validation, time zone, currency policy
backend/src/db/                     # connection, schema, migrations, transactions
backend/src/auth/                   # identity, session/token, RBAC/scope server
backend/src/modules/core/           # Party/Project/Vendor/Booking reference bridge
backend/src/modules/finance/
  accounts/ statements/ receivables/ payables/ payments/
  policies/ cancellations/ refunds/ cashflow/ dashboard/
backend/src/shared/                 # money/date errors, pagination, audit, attachments
backend/test/                       # domain + route + persistence integration
```

## Urutan kerja backend

1. **Foundation:** tentukan DB dan migration runner dari lingkungan; validasi env; health endpoint; standar error; request ID; transaction wrapper; backend test runner. `backend/package.json` saat ini hanya `dev` dan test placeholder—perbaiki scripts secara bertahap.
2. **Identity/core references:** server harus tahu user/role/Party/Vendor scope. Frontend `localStorage` demo tidak boleh dipercaya API. Pilih session/auth integration yang cocok dengan aplikasi setelah audit; untuk lokal, demo auth eksplisit terisolasi dari produksi. Persist atau bridge Project/Party/Vendor/Booking yang diperlukan agar FK finance valid. Jangan meng-klon seluruh frontend `app/data/index.ts` ke backend. Buat satu contract per domain yang akan dimigrasi bertahap.
3. **Money foundation:** rekening + opening balance, cash movement posted/reversal, allocation, transfer dan fee directional. Semua posting satu transaksi DB dengan audit dan idempotency.
4. **AR/AP:** invoice status dan obligation; partial allocation, due/expected, vendor deposit/advance. `frontend/app/data/index.ts` fungsi `createInvoice`, `recordPayment`, `paySupplierInvoice` menjadi referensi consumer/behavior lama, bukan implementasi server final.
5. **Cancellation/refund:** policy versioning, booking snapshot, preview deterministic, approve/process split, credit note, refund obligation, settlement. Jangan mengikat aturan finansial ke UI-only hook `updateRefundRequestStatus`.
6. **Read models:** statement, per-account ledger, cashflow, dashboard. Hitung agregat di server dari posting/obligation yang sama; tidak ada kalkulasi bisnis duplikat di komponen Vue.

## Transaksi dan event

Setiap command mutasi menempuh: authenticate → authorize action+scope → validate request → lock/read state → calculate invariant → insert/update domain records → cash movement/audit/outbox bila perlu → commit → response. Gunakan unique constraint/idempotency key untuk retry. Email, notifikasi, atau webhook eksternal bila nanti ada diproses setelah commit; bukan syarat v1.

`POST /receipts`, `/disbursements`, `/transfers`, `/settlements` harus menghasilkan postings **sekali**. Pada kegagalan di tengah, tidak boleh ada invoice `paid` tanpa movement, atau movement tanpa allocation yang diminta. Status `approved` pada vendor invoice tidak otomatis posted. Proof file tidak menjadi sumber nominal; nominal disetujui di command dan dicatat oleh actor.

## Integrasi dengan mock frontend

Buat API client/repository pada `frontend/app/composables` atau `app/services` (pilih satu pola) dengan typed DTO. Layar finance baru hanya membaca API. Migrasikan referensi non-finance yang membutuhkan angka ke endpoint summary/project-finance read model, lalu hapus import mock yang tidak dipakai. `frontend/app/data/index.ts` sangat besar dan dipakai lintas fitur; ubah di titik yang diperlukan, jangan rewrite massal. Pastikan `frontend/app/pages/project-orders/[id]/index.vue`, `vendors/[id]/index.vue`, dan `client/project-orders/[id]/index.vue` memakai projection/endpoint tersanitasi sesuai role.

## Titik keputusan Phase 1

Tuliskan ADR singkat: DB/driver/migrations, strategi auth, lokasi API base URL (Nuxt runtime config), cara menyimpan proof, pilihan typed booking reference versus persisted core booking, cutover demo versus produksi. Jika infrastruktur belum ada, pilih stack relasional transaksional yang didukung hosting target dan setup dev yang dapat direproduksi; jangan membuat seluruh fitur finance di atas pilihan DB sementara yang tak bisa dimigrasi. Keputusan harus disertai alasan, perintah lokal, dan hasil smoke test.
