# Fase eksekusi bertahap untuk Claude Code

Kerjakan berurutan. Setelah tiap fase, perbarui `13-IMPLEMENTATION-CHECKLIST.md` (salinan kerja di repo), changelog keputusan, matriks consumer, dan bukti check. **Prompt awal hanya mengizinkan Phase 1.** Fase berikutnya dilanjutkan setelah hasil Phase 1 reviewable. Tidak ada fase yang boleh berhenti pada frontend mock tanpa backend/persistence ketika klaimnya end-to-end.

| Fase | Scope | Definition of Done |
|---|---|---|
| **1. Baseline + foundation** | Catat Git baseline terbaru (checkout berubah ke branch `monorepo` dan backend scaffold masuk commit saat paket ditulis; root guides/scripts masih punya perubahan lokal), audit ulang file; matriks finance consumer; ADR DB/auth/API adapter/cutover; scaffold backend config, health, migrations, test runner, core reference bridge, server identity/RBAC minimum; frontend API client skeleton tanpa mengganti UI dulu. | Repo non-finance tetap berjalan; migration fresh/restore teruji; health/auth/scoped endpoint test; baseline lint/typecheck/test/build dicatat; tidak ada finance UI baru atau kas palsu. |
| **2. Money foundation** | Bank accounts, verified opening, cash movements, transfer fee rules/transfer, audit/idempotency/reversal; statement dan account ledger API. | Kas reconcile per rekening/company; transfer+fee directional teruji; error/permission test. |
| **3. AR/AP backend** | Customer invoice/billing schedule, vendor invoice/deposit, obligation, expected date, partial receipt/disbursement allocations; project/booking/vendor summary endpoints. | Issue tidak memindahkan kas; posted payment menurunkan outstanding dan mengubah account; tests customer+vendor partial/dedupe. |
| **4. Finance UI baru: IA + core** | Hapus route/components finance mock setelah dependency map; bangun Dashboard skeleton dari API, Statement, Account Ledger, Receivable, Payable; redirect lama. | Enam menu sudah terstruktur (Cash Flow boleh pending state fase 6), 5 layar inti valid dan terhubung; browser role/mobile/empty/error check. |
| **5. Cancellation/refund** | Policy master multi-tier, booking snapshot, preview, cancellation case, credit/refund, settlement; booking/vendor/project finance context. | H-30/H-14/H-7/H-1 numeric tests, original payment link, posted settlement satu kali, operational booking regression. |
| **6. Cash Flow** | Read model current cash + AR/AP/refund, horizon 30d/3m/6m/12m, filters, gap/confidence, UI Cash Flow. | Proyeksi reconcile dengan actual+outstanding; timing/partial/overdue/transfer tests; drilldown. |
| **7. Dashboard + polish** | Integrasi dashboard final, copy/visual/accessibility/responsive, performance, role-specific context, guides. | User baru bisa menjawab 6 pertanyaan menu tanpa onboarding khusus; visual audit desktop/mobile; angka dashboard cocok detail. |
| **8. Regression + release readiness** | Full E2E, data migration rehearsal, rollback/restore, permissions negative tests, docs/API examples, cutover. | Semua acceptance `10` lulus atau blocker eksplisit; no known double count; non-finance regression lulus; artifacts dan deployment instructions siap. |

## Phase 1 tepatnya

Phase 1 **tidak** berarti migrasi semua mock data. Prioritasnya membuka jalur implementasi yang benar: backend runnable, DB migratable, core identity dan referensi nyata, standar API dan tests, consumer map agar penghapusan finance UI nanti aman. Jika auth produksi/infrastruktur tidak tersedia, buat boundary demo yang jelas dan dokumentasikan blocker produksi; jangan menggantinya dengan `localStorage` role yang dipercaya server.

## Format laporan tiap fase

`Apa berubah` (file + alasan); `Bukti` (perintah/check + hasil, browser journey); `Data/migration impact`; `Keputusan`; `Risiko/blocker`; `Phase berikutnya`. Update checklist hanya untuk hal yang benar-benar lolos. Jangan menyebut UI siap produksi hanya karena backend API aktif, atau backend selesai karena layar mock tampak benar.
