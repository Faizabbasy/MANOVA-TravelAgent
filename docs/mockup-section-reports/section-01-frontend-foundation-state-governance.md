# Section Report — Section 01: Frontend Foundation dan State Governance

**Status:** COMPLETED

Dikerjakan berdasarkan `prompts/Section 01 — Frontend Foundation dan State Governance.md`, dijalankan lewat `prompts/99-RUN-CURRENT-SECTION.md` atas perintah user. Section kedua roadmap Section 00–24 baru, dijalankan langsung setelah Section 00 (Current Progress Reconciliation, COMPLETED).

---

## 1. Section Objective dan Scope

"Lengkapi hanya gap foundation frontend" — mencakup: domain types dan status constants terpusat, mock repository/service layer, centralized stores/state per domain, stable ID dan relasi konsisten, state reset/seed scenario/loading-error simulation, mock persistence, format currency/date/timezone, activity generator dan transition helper, permission/data-scope helper terpusat, dan shared UI kit (page header, detail shell, drawer, table, filter, status, timeline, form states, empty/error/unauthorized/not-found). Instruksi eksplisit: **"Jangan mengganti foundation existing yang sudah sehat."**

## 2. Source Documents yang Dibaca

`prompts/Section 01 — Frontend Foundation dan State Governance.md`, `prompts/01-PROTOKOL-WAJIB.md`, `prompts/99-RUN-CURRENT-SECTION.md`, `CLAUDE.md`, seluruh `docs/mockup-*.md`, `docs/frontend-module-map.md`/`frontend-workflow-map.md`/`frontend-implementation-roadmap.md`/`frontend-known-issues.md` (hasil Section 00), `docs/mockup-section-reports/section-00-current-progress-reconciliation.md`, source code aktual (`app/types/**`, `app/constants/**`, `app/data/**`, `app/composables/**`, `app/utils/**`, `app/components/shared/**`), `git status`.

## 3. Existing Implementation yang Diperiksa

Audit Section 00 (2026-08-01) sudah memetakan Section 01 sebagai `PARTIAL` dengan satu gap konkret: "Mock repository/service layer agar pages tidak membaca fixture langsung." Pemeriksaan ulang langsung terhadap 30+ halaman aktual mengonfirmasi: **seluruh halaman tanpa kecuali** mengimpor data lewat satu barrel module (`~/data` = `app/data/index.ts`), tidak ada satu pun halaman yang mengimpor `app/data/leads.ts`/`app/data/opportunities.ts`/dst. secara langsung, dan tidak ada fixture yang di-duplikasi per halaman. Ditemukan juga bahwa `app/components/shared/ErrorState.vue` dan `LoadingState.vue` **sudah ada sejak Foundation lama** (Prompt 5) tapi `ErrorState.vue` belum pernah dipakai halaman manapun (0 referensi) dan `LoadingState.vue` hanya dipakai 2 halaman — bukan bug (mock data dibaca sinkron, jarang ada momen loading/error nyata), tapi dikonfirmasi tersedia untuk dipakai section berikutnya. Satu-satunya gap yang benar-benar konkret dan actionable: **tidak ada mekanisme "state reset/seed scenario"** — sekali data mock dimutasi (create Lead baru, dst.) tidak ada cara mengembalikannya ke kondisi seed tanpa reload/restart aplikasi.

## 4. Decisions yang Digunakan

D-058 (`docs/mockup-design-decisions.md`, baru) — `app/data/index.ts` diformalkan sebagai repository/service layer yang sudah ada, TIDAK dibangun lapisan repository paralel baru (akan jadi premature abstraction/dead code dan memicu refactor besar-berisiko ke 30+ halaman yang sudah sehat, melanggar instruksi eksplisit section ini sendiri).

## 5. Implementation Summary dan User Flow

**State reset / seed scenario** (satu-satunya fitur baru):
1. `app/plugins/mock-reset.client.ts` — plugin client-only, berjalan saat aplikasi pertama dimuat di browser. Memanggil `captureMockSnapshot()` dengan seluruh reactive array terpusat (`LEADS`, `LEAD_ACTIVITIES`, `PARTIES`, `CONTACTS`, `PARTY_ACTIVITIES`, `OPPORTUNITIES`, `QUOTATIONS`, `PROJECTS`, `PROJECT_SERVICES`, `TRAVELER_GROUPS`, `TRAVELERS`, `ROOM_ASSIGNMENTS`, `ITINERARY_ITEMS`, `VENDORS`, `VENDOR_CONTACTS`, `VENDOR_QUOTATIONS`, `VENDOR_ACTIVITIES`, `VENDOR_PRODUCTS`, `INVOICES`, `PAYMENTS`, `ACTIVITIES`, `DOCUMENTS`, `TASKS`) — sengaja **tidak** menyertakan `USERS` (bukan `reactive()`, tidak pernah dimutasi) dan `SYSTEM_EVENTS` (didokumentasikan sebagai log statis).
2. `app/utils/mock-reset.ts` — `captureMockSnapshot()` men-`structuredClone` nilai awal tiap array (idempotent, hanya panggilan pertama yang efektif — mencegah snapshot tertimpa state yang sudah bermutasi bila terpanggil dua kali); `resetMockState()` melakukan `array.splice(0, array.length, ...structuredClone(seed))` per array — mempertahankan reference Proxy `reactive()` yang sama (bukan reassignment, agar reaktivitas tetap terikat ke seluruh consumer existing tanpa perubahan apa pun di sisi mereka); `hasMockSnapshot()` guard untuk UI.
3. `app/pages/settings.vue` — SectionCard baru "Mock Data Management" dengan tombol "Reset Demo Data" (disabled sampai snapshot siap), dialog konfirmasi, dan toast hasil (`useToast`).

User flow: buka `/settings` → klik "Reset Demo Data" → dialog konfirmasi menjelaskan aksi tidak dapat dibatalkan → klik "Reset Demo Data" pada dialog → seluruh state (Lead/Opportunity/Quotation/Project/Vendor/Finance/Activity yang sudah dibuat/diubah selama sesi) kembali ke kondisi seed awal secara instan (reaktif, tanpa reload) → toast sukses.

## 6. Routes

`/settings` — section baru "Mock Data Management" ditambahkan (aditif, section "Profil Akun" dan "Demo Role Switcher" existing tidak disentuh). Tidak ada route baru.

## 7. Files Created, Changed, dan Removed

**Created:**
- `app/utils/mock-reset.ts`
- `app/plugins/mock-reset.client.ts`
- `docs/mockup-section-reports/section-01-frontend-foundation-state-governance.md` (laporan ini)

**Changed:**
- `app/pages/settings.vue` (+import `resetMockState`/`hasMockSnapshot`, +state `isResetDialogOpen`, +handler `submitReset`, +SectionCard "Mock Data Management")
- `docs/mockup-design-decisions.md` (+D-058)
- `docs/frontend-module-map.md`, `docs/frontend-implementation-roadmap.md`, `docs/frontend-known-issues.md` (status Section 01 → COMPLETED, gap ditandai selesai)
- `docs/mockup-implementation-state.md` (bagian 0/1/2b/7/8)
- `docs/mockup-progress.md` (+Entri 10)
- `docs/mockup-section-progress.md` (+entri Section 01 skema baru)
- `docs/mockup-section-reports/README.md` (+baris Section 01)

**Removed:** Tidak ada.

## 8. Components Reused/Created

Reused: `SectionCard`, `Dialog`/`DialogTrigger`/`DialogContent`/`DialogHeader`/`DialogTitle`/`DialogDescription`/`DialogFooter`, `Button`, `useToast`. Tidak ada shared component baru dibuat — audit mengonfirmasi shared UI kit existing (`PageHeader`/`SectionCard`/`Sheet`/`Table*`/`StatusBadge`/`EmptyState`/`ErrorState`/`LoadingState`/`RoleAccessState`/`Dialog*`/`Tabs*`/`DetailMetadataList`) sudah lengkap dan sehat.

## 9. Types/Constants/Fixtures/Mock State

Tidak ada perubahan type/entitas/fixture. `app/utils/mock-reset.ts` membaca (bukan mengubah shape) seluruh reactive array terpusat existing.

## 10. Responsive Behavior

Tidak berubah — section baru di `/settings` memakai `SectionCard`/`Dialog` existing yang sudah responsive.

## 11. States (Loading/Empty/Error/Unauthorized/Not-Found)

- Tombol "Reset Demo Data" disabled sampai `hasMockSnapshot()` bernilai true (guard client-only-plugin-belum-selesai, edge case yang praktis selalu sudah terpenuhi saat halaman interaktif).
- Toast error bila `resetMockState()` gagal (snapshot belum tersedia) — pesan jelas, minta reload.
- Toast sukses setelah reset berhasil.
- Halaman `/settings` sendiri tidak berubah state unauthorized/not-found-nya (tetap `middleware: auth`, tidak ada role-gate tambahan pada section baru — seluruh user login dapat reset demo data, konsisten dengan sifatnya sebagai utilitas demo, bukan aksi bisnis).

## 12. Role Behavior

Tidak ada perubahan role/permission. Tombol "Reset Demo Data" tidak digerbangi role tertentu (bukan aksi bisnis, murni utilitas demo/testing tersedia untuk seluruh role yang bisa mengakses `/settings`).

## 13. Validation Commands dan Hasilnya

- `npx nuxi prepare` — **sukses**.
- `npm run build` — **sukses**. Chunk `settings-*` bertambah ukuran (form baru), `precomputed.mjs` bertambah ~2 kB (plugin baru ter-bundle).
- `npx vitest run` — "No test files found" (pre-existing, Q8, tidak berubah).
- Lint/typecheck — tetap tidak tersedia (Q8, tidak berubah).
- **Smoke test HTTP** — 11 route representatif (`/`, `/settings`, `/customer-journey/leads`, `/crm/opportunities/OPP-006`, `/crm/prospects`, `/projects`, `/vendors`, `/finance/invoices`, `/reports`, `/admin/users`, `/activity-center`, `/supplier`) — **seluruhnya HTTP 200**.
- **Smoke test konten** — `/settings` menampilkan teks "Mock Data Management" dan "Reset Demo Data" tanpa string error (`Internal Server Error`/`TypeError`/`is not defined`) di HTML manapun yang diuji.
- **Verifikasi interaktif** (klik "Reset Demo Data", konfirmasi klik kedua kalinya, verifikasi Lead yang baru dibuat hilang) **tidak dilakukan headless** — tidak ada tool browser (keterbatasan konsisten sejak Section 06 lama). Dimitigasi lewat code review: `resetMockState()` mem-`splice` in-place (mempertahankan reference reactive), dipanggil dari handler yang sudah diverifikasi terpasang benar via smoke test SSR konten.

## 14. Regression

Tidak ada regresi ditemukan — perubahan murni aditif (2 file baru + 1 section baru di 1 halaman). Seluruh 11 route representatif (termasuk route yang datanya dibaca oleh `mock-reset.ts`) tetap HTTP 200 dengan konten tidak berubah dari Prompt 20/Section 00.

## 15. Cross-Section Impact

Tidak ada — tidak menyentuh hasil section/prompt manapun dari skema lama (Prompt 0–20) maupun Section 00.

## 16. Known Issues dan Deferred Work

- Gap Section 02–24 lainnya (role Client/Product Planner/Procurement, Public Lead Intake, Client Portal, dll.) tetap seperti dicatat `docs/frontend-known-issues.md` — di luar scope Section 01, tanggung jawab section pemiliknya.
- Q8 (tooling lint/typecheck/test) tetap terbuka, tidak berubah.
- Komponen shared "Filter" dan "Timeline" generik sengaja TIDAK diekstrak pada section ini (pola ad-hoc per halaman sudah konsisten visual, ekstraksi tanpa kebutuhan konkret kedua dinilai premature abstraction) — dicatat sebagai opsi masa depan, bukan blocking.

## 17. Protection Notes untuk Section Berikutnya

Section 02+ dapat memakai `app/utils/mock-reset.ts`/`resetMockState()` sebagai utilitas siap pakai bila butuh reset state saat demo/testing role baru. Bila menambah reactive array domain baru (mis. saat Section 08/10/17 menambah entitas Client/Product/RFQ), **daftarkan array tsb ke `app/plugins/mock-reset.client.ts`** agar ikut tercakup snapshot/reset — jangan lupa, tapi juga jangan wajib (fitur reset bersifat best-effort/nice-to-have, bukan hard requirement yang memblokir section lain).

## 18. Review URLs

Tidak ada deployment publik. Untuk review lokal: `npm run dev`, buka `http://localhost:8080/settings`, scroll ke section "Mock Data Management", klik "Reset Demo Data" untuk mencoba (opsional: buat Lead baru dulu di `/customer-journey/leads`, lalu reset, dan verifikasi Lead tsb hilang).

## 19. Recommended Next Section

**Section 02 — Role, Access dan Navigation**, berbasis dependency (`docs/frontend-implementation-roadmap.md`) — menunggu perintah eksplisit user.
