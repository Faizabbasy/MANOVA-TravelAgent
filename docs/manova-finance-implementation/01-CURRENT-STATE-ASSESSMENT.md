# Kondisi repo aktual dan gap

Audit baca-saja pada 29 September 2026. Ini snapshot, bukan pengganti audit singkat saat eksekusi.

| Area | Bukti aktual | Implikasi |
|---|---|---|
| Struktur | `frontend/`, `backend/`, `docs/`; root `package.json` muncul saat audit berlangsung dengan script orchestrator, tanpa shared package/DB | Dua package terpisah: pnpm untuk frontend, Bun untuk backend. Root scripts membantu menjalankan keduanya. |
| Frontend | `frontend/package.json`: Nuxt 4, Vue 3, pnpm, Vitest, lint/typecheck/build; `frontend/nuxt.config.ts` | Pertahankan shell dan design tokens; UI finance boleh dibuat ulang. |
| Backend | `backend/package.json`: Bun + Elysia, `backend/src/index.ts` hanya `GET /` → `Hello Elysia` port 3000; `test` sengaja gagal | Belum ada API domain, DB/ORM/migration/auth/test backend. Semua harus dibangun bertahap. |
| Data frontend | `frontend/app/data/index.ts` menjadi facade mutator/selector atas array `reactive()` di `app/data/*`; `app/types/*` berisi type | Ini mock in-memory, bukan persistence. Buat adapter API lalu migrasikan consumer per slice. |
| Auth/RBAC | `app/middleware/auth.ts` dan `rbac.global.ts` memakai `localStorage`/client; `app/data/rbac.ts`, `app/composables/usePermissions.ts` | Permission frontend hanya affordance; API wajib validasi identitas, role, ownership, dan scope sendiri. |
| Finance mock | `app/pages/finance/*`, `app/components/finance/*`, `app/types/finance*.ts`, `app/data/finance*.ts` | UI dan kalkulasi mock boleh diganti. Audit referensi dari halaman non-finance dulu. |
| AR | `Invoice`, `Payment`, `CreditNote` di `app/types/finance.ts`; `getInvoiceOutstandingIdr` di `app/data/index.ts`; `getReceivables` di `app/data/finance-ext.ts` | Ada dua hitungan outstanding: `getReceivables` mengabaikan credit note. Target backend harus satu rumus/otoritas. |
| AP | `SupplierInvoice` di `app/types/procurement.ts`, `SUPPLIER_INVOICES` di `app/data/procurement.ts`, `paySupplierInvoice` di `app/data/index.ts` | Pembayaran hanya mengubah status `paid`/`paidAt`, tanpa rekening asal, nominal parsial, dan mutasi kas. |
| Ledger | `getJournalEntries` dan `LEDGER_ACCOUNTS` di `app/data/finance-ext.ts`; `/finance/ledger` menampilkan General Ledger | Kebutuhan baru Account Ledger = subledger bank per rekening, **bukan** General Ledger/jurnal. Jangan namai dua hal itu sama. |
| Cancel/refund | `CancellationRecord`/`RefundRequest` di `app/types/change-incident.ts`; `createCancellationRecord`, `updateRefundRequestStatus` di `app/data/index.ts`; `CancellationRule` di `app/types/master-data.ts` | Rule saat ini hanya preview dan satu ambang per baris. Saat refund `processed`, kode menerbitkan credit note, tetapi tak mencatat pengeluaran aktual. Redesign flow domain diperlukan. |
| Booking | Booking tersebar di `app/types/ticketing.ts`, `accommodation.ts`, `transportation.ts`, `mice.ts`; agregasi `app/types/booking-orchestration.ts`, `app/data/index.ts`; `/bookings` timeline | Tidak ada satu tabel/entitas Booking universal. Gunakan typed booking reference (`bookingType`, `bookingId`) dan hubungan project/service yang ada, jangan duplikasi booking. |
| Project/Vendor/Client | `app/pages/project-orders/[id]/index.vue` punya tab Finance; `app/pages/vendors/[id]/index.vue`; `app/pages/client/project-orders/[id]/index.vue` menampilkan invoice/payment | Tambahkan read-only finance context yang relevan, sanitasi harga internal di client/supplier. |
| Navigasi | `app/constants/navigation.ts` menggabung menu finance lama dan hidden routes; `app/constants/modules.ts` punya `finance-acc` | Ganti IA enam menu; audit `findNavItemForPath`, hidden routes, redirect/bookmark lama, serta tests navigasi. |
| Master | `app/data/master-data.ts` memiliki `CANCELLATION_RULES` untuk display/config preview; `app/pages/admin/master-data.vue` | Perlu master policy versioned yang benar-benar dipakai booking, terpisah dari display-only rule lama atau migrasi yang disadari. |
| Design | `app/components/shared/{PageHeader,SectionCard,EmptyState,LoadingState,ErrorState,StatusBadge}.vue`, `app/components/ui/*`, Tailwind | Reuse primitive, grid, tipografi, warna, dan density app. Finance UI baru fokus bahasa awam dan hierarki. |
| Form/chart conventions | `frontend/package.json` menyediakan vee-validate, Zod, Chart.js/vue-chartjs; `frontend/CLAUDE.md` mengarahkan wrapper atas UI primitives | Pilih pola form/chart yang konsisten dengan kode aktif. `frontend/CLAUDE.md` punya beberapa deskripsi lama (mis. catatan test belum ada), jadi package scripts/kode aktual lebih kuat. |
| Docs | `docs/mockup-section-reports/section-20-project-finance.md`, `section-19-change-cancel-refund-incident.md`, `docs/frontend-known-issues.md` | Berguna sebagai riwayat dan peta consumer, bukan acceptance final Finance baru. |
| Instruksi Claude | Root `CLAUDE.md`, `frontend/CLAUDE.md`, `backend/CLAUDE.md` muncul/diperbarui saat audit; root menetapkan pnpm/Bun per package dan satu commit/PR untuk perubahan lintas API/UI | Baca ulang karena pada pemeriksaan terakhir sebagian masih untracked; ikuti jika tetap berlaku dan tidak bertentangan dengan arahan pengguna. |

## Risiko checkout yang harus dicek sebelum eksekusi

Checkout berubah **selama penyusunan paket**: awalnya 539 entri (`D` untuk berkas root lama, `frontend/` dan `backend/` untracked, branch `master`, HEAD `10d1d1c`). Lalu `frontend/` masuk commit `0d4781e`. Pemeriksaan terakhir: branch `monorepo`, HEAD `64339d0` (`feat: add Elysia (Bun) backend scaffold`), `backend/` sudah tracked; `.claude/launch.json` dan `frontend/CLAUDE.md` modified, sementara root `CLAUDE.md`, `backend/CLAUDE.md`, `package.json`, `frontend/pnpm-workspace.yaml` masih untracked (di samping artefak paket ini). Ini perubahan eksternal yang harus dihormati. **Jangan reset, clean, atau menganggap perubahan ini pekerjaan Claude.** Audit Git ulang sebelum Phase 1 dan pertahankan seluruh perubahan lokal tersebut.

## Gap prioritas

1. Backend core + persistence + auth tidak ada; implementasi finance end-to-end menuntut jalur Project/Party/Vendor/Booking/Invoice yang persisten atau bridge yang jelas.
2. Tidak ada master rekening dan actual cash movement. Saldo saat ini tidak dapat dihitung andal dari jurnal mock tanpa opening balance/bank identity.
3. AR/AP belum punya expected date yang andal, pembayaran parsial vendor, account allocation, idempotency, atau settlement real.
4. Cash Flow chart lama `app/components/dashboard/DashboardCashFlowSection.vue` adalah chart income/expense dashboard mock; bukan projected cash position.
5. Data dan akses mock client-side perlu migrasi terukur. `frontend/app/utils/mock-reset.ts` serta plugin client-nya hanya untuk demo; jangan jalankan terhadap data nyata.

## Audit consumer sebelum menghapus mock finance

Cari semua import/panggilan `~/data`, `finance-ext`, `INVOICES`, `PAYMENTS`, `CREDIT_NOTES`, `SUPPLIER_INVOICES`, `getInvoiceOutstandingIdr`, `getProjectActualCostIdr`, `evaluateFinanceClosureGate`, `closeProjectFinance`, route `/finance/*`, dan komponen chart dashboard. Bangun matriks **consumer → contract baru → fase migrasi → regression check**. Setelah consumer pindah, UI finance lama boleh dihapus total, termasuk komponen, route, dan fixture finance yang tak dibutuhkan. Pertahankan deep link lama melalui redirect yang masuk akal.
