# Kondisi kode dan batasan implementasi

## Baseline yang harus diperbarui

Audit pada 21 Oktober 2026 membaca HEAD `0a2e5b2` pada branch `production`. Migrasi terakhir yang terlihat adalah `0044_itinerary_versions_announcements`. Temukan versi berikutnya dari file aktual; jangan mengunci nomor migrasi baru ke 0045 bila repository sudah berubah.

Hasil pemeriksaan sebelumnya pada HEAD tersebut:

| Pemeriksaan | Hasil |
|---|---|
| Backend typecheck | Lulus |
| Backend test | 591 lulus, 0 gagal, 53 file; sekitar 998 detik di mesin audit |
| Frontend test | 1241 lulus, 64 file |
| Frontend lint | 105 error dan 2691 warning |
| Script frontend typecheck utama | Exit 0; belum dapat dipercaya sebagai cakupan penuh |
| Pemeriksaan langsung app Nuxt | 1986 diagnostik TypeScript dan kegagalan kompatibilitas plugin Vue |
| Build frontend | Client dan SSR terkompilasi; bundling Nitro dihentikan setelah sekitar 15 menit, bukan dinyatakan lulus |

Angka tersebut adalah baseline audit sebelumnya, bukan hasil tes implementasi Claude. Ulangi pemeriksaan yang relevan, simpan exit code, waktu, versi runtime, dan bedakan kegagalan lama dari regresi. Pemeriksaan langsung saat itu menggunakan `pnpm exec vue-tsc --noEmit -p .nuxt/tsconfig.app.json`; temukan direktori generated config yang benar pada Nuxt terpasang sebelum mengandalkan perintah tersebut.

Git tracking lokal saat audit menunjukkan ahead 240 terhadap referensi origin yang tersimpan; remote tidak di-fetch. Ini tidak membuktikan kondisi server atau GitHub saat eksekusi. Ada untracked `app/` dan `docs/MANOVA_FINANCE_CLAUDE_CODE_PACKAGE/`; jangan menghapus atau menganggapnya milik pekerjaan ini. Jalankan status baru sebelum mengedit.

## Stack dan pola yang dipertahankan

- Frontend Nuxt 4, Vue 3, TypeScript, Tailwind, komponen yang sudah ada; package manager `pnpm`.
- Backend Elysia di Bun; package manager `bun`.
- PostgreSQL adalah basis produksi; PGlite untuk pengembangan dan pengujian.
- Proxy Nuxt `/api/v1/**`, cookie sesi HttpOnly, validasi server, capability, row scope, audit, idempotency.
- Uang SQL `bigint` minor units dan DTO string desimal. Jangan melakukan aritmetika uang dengan floating point.
- Migrasi baru berpasangan up/down; migrasi yang telah diterapkan tidak diedit.
- Gunakan `recordAudit`, `withIdempotency`, `nextId`, envelope HTTP, dan pesan validasi Indonesia yang sudah ada.
- Route baru diuji untuk sukses, validasi, 401, 403, dan 404 karena scope. SQL diuji pada kedua engine.

## Peta kode yang sudah ada

Path berikut relatif terhadap root repository dan diverifikasi pada baseline. Baca implementasi sebelum memilih hook.

| Area | Path sumber |
|---|---|
| Workspace project | `frontend/app/pages/project-orders/[id]/index.vue`, `frontend/app/pages/projects/[id]/index.vue`, `frontend/app/components/project-order/` |
| Tahapan project | `frontend/app/data/project-order-workflow.ts`, `frontend/app/types/project-order.ts`, `backend/src/modules/core/project-workflow.ts` |
| Header dan kontrak project | `backend/src/modules/core/project-writes.ts`, `frontend/app/data/projects-sync.ts` |
| Budget layanan dan booking | `backend/src/modules/core/service-writes.ts`, `booking-writes.ts`, `booking-status.ts`, `booking-orchestration.ts`, `frontend/app/data/bookings-sync.ts` |
| Supplier dan procurement | `backend/src/modules/core/vendor-quotations.ts`, `service-orders.ts`, `vendor-writes.ts`, `vendor-portal.ts`, `frontend/app/data/procurement-sync.ts` |
| Lead dan penjualan | `backend/src/modules/sales/`, `frontend/app/data/leads-sync.ts`, `sales-orders-sync.ts` |
| Peserta dan itinerary | `backend/src/modules/core/travelers.ts`, `itinerary.ts`, `trip-collab.ts` |
| Task dan milestone | `backend/src/modules/core/tasks.ts`, `milestones.ts`, `frontend/app/data/work-items-sync.ts` |
| Perubahan dan insiden | `backend/src/modules/core/change-requests.ts`, `incidents.ts`, `frontend/app/data/changes-sync.ts` |
| Finance sumber transaksi | `backend/src/modules/finance/receivables.ts`, `payables.ts`, `postings.ts`, `refunds.ts`, `group-trip.ts`, `debit-notes.ts`, `payment-proofs.ts` |
| Finance laporan | `backend/src/modules/finance/summaries.ts`, `overview.ts`, `reports.ts`, `cashflow.ts`, `reads.ts` |
| Finance di project | `frontend/app/components/finance/FinanceProjectPanel.vue`, `FinanceProjectExpenses.vue`, `FinanceContextPanel.vue`, `FinanceGroupTripDpDialog.vue` |
| HR dan aset | `backend/src/modules/core/hr.ts`, `inventory.ts`, `frontend/app/data/hr-sync.ts`, `inventory-sync.ts` |
| Kontrak API | `frontend/app/types/api.ts`, `frontend/app/lib/api/endpoints.ts`, `frontend/app/composables/useApi.ts` |
| Security dan uang | `backend/src/auth/rbac.ts`, `backend/src/modules/core/scope.ts`, `backend/src/shared/`, `frontend/app/data/rbac.ts` |
| File dan audit | `backend/src/modules/core/documents.ts`, `collab.ts`, `audit-reads.ts`, ADR-005 |

## Sambungan yang sudah nyata

- Project menyimpan nilai kontrak, referensi quotation/lead, layanan dan budget layanan di server.
- Ready memeriksa fakta invoice DP dan penerimaan DP dari Finance. Jangan menggantinya dengan checkbox pembayaran frontend.
- Finance summary project mengambil tagihan, pembayaran, utang supplier, pengeluaran project, dan refund dari record Finance.
- Pengeluaran project sudah mem-posting kas aktual dan dihitung sebagai biaya project.
- Invoice supplier dapat terkait project, booking, dan service order. Booking memiliki pembatasan bila sudah terkait transaksi Finance.
- Pembatalan Finance dan refund sudah memiliki lifecycle, settlement dan reversal.
- Group Trip memiliki invoice dan DP per peserta; pembuatan traveler terkait konfirmasi DP sudah terintegrasi.
- Penutupan finance/project memiliki blocker saldo, draft/rencana tagihan, utang, refund dan aset yang dipinjam.

## Gap yang harus ditutup

- Ledger yang tersedia adalah mutasi rekening, bukan General Ledger berpasangan.
- `reports.ts` memakai tanggal invoice customer sebagai revenue dan invoice supplier serta pengeluaran sebagai cost. Label accrual saat ini bukan bukti pengakuan layanan lengkap.
- B2C standalone tanpa project ditolak oleh `createInvoiceDraft` pada baseline.
- Accounts dan customer/vendor invoices V1 dibatasi IDR. Master currency tidak membuat multi-currency accounting otomatis tersedia.
- Komisi di `hr.ts` diturunkan dari nilai kontrak dan status project; closed dapat menghasilkan label paid tanpa settlement komisi. Payroll paid belum mem-posting kas.
- `master-data.ts` menyatakan konfigurasinya referensi saja; tax-rule belum menjadi mesin pajak.
- RFQ, amandemen SO, komoditas dan cost sheet masih memiliki jalur lokal. Data yang memengaruhi finansial harus dipindah ke server sebelum dijadikan sumber jurnal.
- File bukti/lampiran masih banyak berupa metadata/nama file; bank statement reconciliation yang sesungguhnya belum ditemukan.
- Satu owner harus dapat mengoperasikan produk, tetapi pembatasan maker/checker saldo awal yang ada memakai aktor berbeda. Selesaikan desain mode owner secara eksplisit, bukan membuat dua akun palsu atau menghapus pengamanan diam-diam.

## Prioritas instruksi

Ikuti instruksi pengguna dan repository. Paket ini adalah perubahan produk yang diminta pengguna, bukan alasan menghapus fitur yang sudah bekerja. Catat perubahan kontrak/ADR lama secara eksplisit. Jangan mengedit `sources/` jika ada mirror referensi sinkron. Tidak perlu mengubah root `CLAUDE.md` hanya agar paket ini dibaca; prompt mulai sudah menunjuk direktori ini.
