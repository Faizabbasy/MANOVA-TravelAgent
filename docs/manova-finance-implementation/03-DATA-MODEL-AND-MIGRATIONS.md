# Model data dan strategi migrasi

Repo belum memiliki schema/migration/ORM. **Nama di bawah adalah rancangan target, bukan nama tabel yang sudah ada.** Pada Phase 1, pilih relational persistence dan migration runner sesuai infrastruktur repo yang benar-benar tersedia; catat keputusan serta versi dependency. Keperluan wajib: foreign key, transaksi atomik, unique constraint, index, migration terurut, backup/restore. Jangan mengandalkan array `reactive()` untuk produksi.

## Relasi minimal yang disarankan

| Entitas target | Field penting dan relasi | Constraint penting |
|---|---|---|
| `parties`, `vendors`, `projects`, `service_orders`, `booking_refs` | Migrasikan/bridge ID existing `Party`, `Vendor`, `Project`, 4 domain booking; `booking_refs` = `(type,id,project_id,service_id?)` | FK atau validated typed ref; jangan buat booking baru yang bersaing dengan domain operasional |
| `bank_accounts` | code, bank, masked account number, holder, currency, active, openingBalanceMinor, openingEffectiveAt, verifiedBy | code unik; nomor rekening disimpan aman; inactive tidak bisa dipilih untuk posting baru |
| `transfer_fee_rules` | fromAccountId, toAccountId/bank code, fixed/percent, value, min/max, effectiveFrom/To, active | pair+periode tidak ambigu; arah eksplisit |
| `customer_invoices`, `customer_invoice_lines` | projectId, partyId, bookingRef?, type dp/progress/final, issue/due/expected, currency, totalMinor, status, version | stable external ref, due date wajib saat issued |
| `vendor_invoices`, `vendor_invoice_lines` | vendorId, serviceOrderId?, projectId?, bookingRef?, due/expected, totalMinor, approval/match state | dedupe vendor invoice reference per vendor; rejected bukan AP aktif |
| `obligations` atau view AR/AP | sourceType+sourceId, direction, total/outstanding, due/expected, confidence | satu obligation aktif per sumber/termin; status hasil derivasi bila bisa |
| `cash_movements` | accountId, direction, amountMinor, currency, sourceType+sourceId, projectId?, bookingRef?, party/vendor?, effectiveAt, postedAt, actor, memo, proofId, state, reversalOf?, idempotencyKey | posted immutable; unik idempotency; amount > 0; source valid |
| `payment_allocations` | movementId, obligationId, amountMinor | total allocations ≤ movement; tidak melebihi outstanding |
| `transfers` | from/to account, amount, fee, ruleSnapshot, state, postedAt | satu transfer menghasilkan 2 movement + fee yang jelas dalam 1 DB transaction |
| `cancellation_policies`, `policy_tiers`, `booking_policy_assignments` | scope/type, effective range, basis, thresholds, forfeit/refund pct, version, snapshot | tier tak overlap, persentase total 100, published version immutable |
| `cancellation_cases`, `credit_notes`, `refund_obligations`, `settlements` | originalPaymentId, bookingRef, projectId, policySnapshot, split amount, approval/posting state, bankAccountId | refund unik per case/pembayaran; no double application |
| `attachments`, `audit_events` | safe file reference, hash, MIME, actor, action, before/after IDs, timestamp | append-only audit; signed access / ownership checks |

**Project/Booking mapping:** `frontend/app/types/project.ts` dan `frontend/app/types/booking-orchestration.ts` menentukan ID dan status yang harus dihormati. Detail booking ada di `ticketing.ts`, `accommodation.ts`, `transportation.ts`, `mice.ts`. `frontend/app/types/finance.ts` dan `procurement.ts` adalah peta field lama, bukan schema otomatis. Simpan mapping legacy ID dan seed provenance untuk demo agar referensi ke PRJ/INV/SINV lama tidak putus bila data demo dipindah.

## Uang, waktu, dan mata uang

Gunakan integer minor unit atau decimal fixed precision di DB dan JSON string aman; **jangan floating point untuk uang atau persen fee**. IDR tanpa sen, simpan kebijakan pembulatan eksplisit (mis. half-up ke rupiah) dan uji. `Invoice.amountIdr` lama sudah IDR meski `currency` dapat USD; cek arti `exchangeRateSnapshot` sebelum migrasi. Untuk v1 pilih satu currency ledger per rekening dan laporkan semua company total dalam IDR dengan snapshot kurs posting; jangan menjumlah nominal lintas currency tanpa konversi. `dueDate`/`expectedDate` bertipe tanggal lokal Asia/Jakarta; `postedAt` timestamp UTC. Forecast bucket berdasarkan tanggal bisnis Asia/Jakarta.

## Migrasi aman

1. Inventory schema nihil dan fixture lama; identifikasi siapa yang benar-benar dipakai user/demo. Buat backup/export dan checksum bila ada data nyata di luar source.
2. Migration awal membuat tabel/constraint/index dan seed **idempotent** untuk role/master yang diperlukan. Tabel core disiapkan sebelum finance FK. Tidak mengubah fixture non-finance sekaligus.
3. Jalankan dual-read/adapter per slice bila app masih memakai `~/data`; satu source of truth per layar. Hindari dual-write tak transaksional. Catat cutover di checklist.
4. Opening bank balance harus diinput/diverifikasi dengan tanggal cutover. Transaksi sebelum cutover bersifat historical import dan tidak boleh ditambahkan lagi di atas opening. Jika belum diverifikasi, tampilkan posisi kas `Belum tersedia`, jangan tampilkan angka palsu.
5. Backfill invoice/payment/credit mock hanya ke lingkungan demo/seed, dengan flag provenance. Jangan berpura-pura riwayat pembayaran mock adalah transaksi bank sungguhan di lingkungan produksi.
6. Migrasi forward/backward diuji pada salinan DB. Rollback struktur boleh; reversal data posted adalah compensating entry, bukan delete. Jangan menurunkan migrasi yang membuang audit/uang tanpa backup.

Index awal: `(project_id, due_date)`, `(account_id, effective_at, id)`, `(state, expected_date)`, `(source_type, source_id)`, `(booking_type, booking_id)`, `(vendor_id, external_invoice_ref)`, dan unique idempotency key per actor/operation. Revisi setelah query plan nyata.
