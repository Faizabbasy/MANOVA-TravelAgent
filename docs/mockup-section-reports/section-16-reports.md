# Section 16 — Reports

**Status:** COMPLETED

Dikerjakan berdasarkan `prompts/18-PROMPT-16-REPORTS.md`, dijalankan lewat `prompts/99-RUN-CURRENT-SECTION.md` atas perintah user.

---

## 1. Section Objective dan Scope

Membangun `/reports` (sebelumnya `ModulePlaceholder` sejak Section 05) menjadi satu halaman laporan agregasi lintas-modul dengan 6 section granular sesuai scope literal Prompt 16: Sales Pipeline, Project Performance, Upcoming Departure dan Service Readiness, Vendor Summary, Budget vs Actual dan Margin, Invoice Aging dan Outstanding — masing-masing dengan filter, chart/table, states, dan visibilitas per role. **Tidak membuat dataset report terpisah** — seluruh angka diturunkan langsung dari fixture domain existing dan selektor yang sudah divalidasi section sebelumnya (terutama Section 15). Tidak ada klaim analytics backend; export mock **tidak** dikerjakan (hard rule: "Export hanya mock bila sudah disepakati" — belum ada kesepakatan eksplisit, jadi didefer, bukan diasumsikan).

## 2. Source Documents yang Dibaca

`prompts/01-PROTOKOL WAJIB — CONTINUITY, DOKUMENTASI PER SECTION, DAN PERLINDUNGAN HASIL.md`, `prompts/18-PROMPT-16-REPORTS.md`, `CLAUDE.md`, seluruh `docs/*.md` (implementation-state, section-progress, change-impact-log, route-and-role-matrix bagian 1.6/5/5.1/6, design-decisions), `docs/mockup-section-reports/section-05-foundation.md` s/d `section-15-project-finance.md` (terutama section-15 bagian 18 "Protection Notes" yang eksplisit menunjuk Section 16 untuk reuse selektor finansial), source code aktual (`app/pages/reports/index.vue` lama, `app/pages/index.vue` Dashboard untuk pola widget/filter, `app/pages/finance/invoices.vue`, `app/pages/vendors/index.vue`, `app/data/index.ts`, `app/composables/usePermissions.ts`, `app/constants/roles.ts`, `app/constants/status.ts`, `app/constants/navigation.ts`, `app/types/*.ts`, `app/utils/attention.ts`, `app/utils/format.ts`, komponen `StatusBreakdownList.vue`/`BudgetChart.vue`/`StatsCard.vue`/`RoleAccessState.vue`/`PageHeader.vue`), `git status`/`git log`.

## 3. Existing Implementation yang Diperiksa

`/reports` masih `ModulePlaceholder` (Section 05), `comingSoon: true` di `AppSidebar` (`app/constants/navigation.ts`). `docs/route-and-role-matrix.md` bagian 1.6 mencatat "4 section dalam satu halaman: Sales Pipeline, Project Performance, Cost and Margin, Finance Summary" (ditulis Prompt 3, sebelum scope literal Prompt 16 final memecahnya jadi 6 item granular). Bagian 5 (Role & Access Matrix, LOCKED) mencantumkan baris Reports per role hanya untuk 4 nama section tsb — dua section baru yang diminta scope literal Prompt 16 (Upcoming Departure/Service Readiness, Vendor Summary) belum punya pemetaan role eksplisit di dokumen manapun. Selektor finansial (`getInvoiceOutstandingIdr`, `getCommittedVendorCostIdr`, `invoiceAgingDays`) dan operasional (`getServicesForProjects`, `isUpcomingDeparture`) sudah tervalidasi presisi di Section 06/12/15 — dikonfirmasi cukup untuk seluruh agregasi Section 16 tanpa perlu selektor finansial baru. Ditemukan juga: `Invoices`/`Payments` di `app/constants/navigation.ts` masih bertanda `comingSoon: true` walau sudah `COMPLETED` sejak Section 15 — **dicatat sebagai known issue, tidak diperbaiki** (di luar ownership Section 16, lihat bagian 17). `git log`/`git status` dikonfirmasi bersih kecuali `prompts/99-RUN-CURRENT-SECTION.md` yang diedit user, commit terakhir `5542dd0 "SECTION15-PROJECT-FINANCE"`.

## 4. Decisions yang Digunakan

Route Matrix bagian 5 (Role & Access Matrix modul Reports — `ROLE_MODULE_ACCESS.reports`, dipakai sebagai gerbang halaman: super-admin/management/sales/project-manager/finance/viewer = akses; operations/ticketing/accommodation/transportation/mice = `NONE`, ditolak `RoleAccessState`). Bagian 5.1 ("Export mock" opsional, tidak wajib). D-037 (format Rupiah/tanggal konsisten). Section 15 bagian 18 "Protection Notes" (reuse selektor finansial, jangan hitung ulang logic).

**Keputusan implementasi baru Section 16 (bukan perubahan LOCKED, klarifikasi granularity per section — dicatat transparan karena bagian 5 hanya memetakan 4 nama section, sedangkan scope literal Prompt 16 final berisi 6 item):** pemetaan role per section granular ditentukan sebagai berikut, konsisten dengan baris Reports bagian 5 untuk 4 section yang sudah ada, dan diperluas secara pragmatis-bisnis untuk 2 section baru:
- **Sales Pipeline** — Sales, Management, Super Admin, Viewer (persis baris LOCKED).
- **Project Performance** — Project Manager, Management, Super Admin, Viewer (persis baris LOCKED).
- **Upcoming Departure dan Service Readiness** — Project Manager, Management, Super Admin, Viewer (dianggap bagian dari cakupan "Project Performance" untuk PM — keduanya KPI operasional project yang sama; Operations/Ticketing/Accommodation/Transportation/MICE **tidak** melihatnya di Reports meski melihat info serupa di Dashboard, karena `ROLE_MODULE_ACCESS.reports` mereka `NONE`, LOCKED sejak Foundation).
- **Vendor Summary** — Project Manager, Finance, Management, Super Admin, Viewer (section baru, tidak ada baris LOCKED persis; ditambahkan untuk PM karena PM mengelola assignment vendor per project — Section 13 — dan untuk Finance karena committed vendor cost adalah komponen budget/margin).
- **Budget vs Actual dan Margin** — Finance, Management, Super Admin, Viewer (persis baris LOCKED "Cost and Margin"; PM **tidak** termasuk, konsisten dengan baris LOCKED PM hanya "Project Performance").
- **Invoice Aging dan Outstanding** — Finance, Management, Super Admin, Viewer (persis baris LOCKED "Finance Summary").

Halaman `/reports` sendiri (gerbang module-level) tetap `canView('reports')` — role dengan `NONE` (Operations family) melihat `RoleAccessState`, bukan halaman kosong.

## 5. Implementation Summary dan User Flow

Satu halaman `/reports` dengan filter bersama (Status Project, Tipe Project, Periode Keberangkatan — berlaku ke 5 dari 6 section berbasis Project; Sales Pipeline berbasis Opportunity, tidak terpengaruh) dan 6 `SectionCard` yang tampil kondisional per role:

1. **Sales Pipeline** — `StatusBreakdownList` per stage Opportunity (reuse pola `opportunityPipeline` Dashboard, dihitung ulang secara lokal karena logic tsb belum jadi selektor bersama), plus stat Open Opportunities / Nilai Pipeline Terbuka / Win Rate.
2. **Project Performance** — breakdown status dan karakteristik project (`StatusBreakdownList` x2), stat Active/Completed/On Hold/Rata-rata Traveler.
3. **Upcoming Departure dan Service Readiness** — list keberangkatan ≤30 hari (reuse `isUpcomingDeparture`) dengan readiness fraction per project (reuse `getProjectServices`), plus `StatusBreakdownList` readiness lintas service (reuse `getServicesForProjects`, selektor Section 06).
4. **Vendor Summary** — stat Vendor Aktif/Committed Vendor Cost/Total Quotation, `StatusBreakdownList` status quotation vendor, tabel Top Vendor by Committed Cost (agregasi baru di level page, bukan selektor `data/index.ts` baru — murni `.reduce()` atas `VENDOR_QUOTATIONS` yang sudah reactive sejak Section 13).
5. **Budget vs Actual dan Margin** — `StatsCard` Budget/Actual/Variance/Quotation/Margin (agregat, formula identik Section 15: `Margin = Quotation − Actual`, `Variance = Budget − Actual`) + `BudgetChart` (reuse komponen, satu bar-pair per project).
6. **Invoice Aging dan Outstanding** — `StatsCard` Total Outstanding/Invoice Overdue, `StatusBreakdownList` aging bucket (Belum Jatuh Tempo / 1–30 / 31–60 / 60+ hari, dihitung dari `invoiceAgingDays` — reuse Section 15), tabel invoice outstanding terurut aging (reuse `getInvoiceOutstandingIdr`).

**User flow yang bisa didemokan:** buka `/reports` sebagai Super Admin/Management/Viewer → seluruh 6 section tampil dengan angka konsisten terhadap `/finance/invoices`, tab Finance Project Detail, dan `/vendors` (mis. Invoice Aging menampilkan "28 hari overdue"/"9 hari overdue" — persis sama dengan `/finance/invoices`, Committed Vendor Cost total Rp1.365.000.000 — persis sum tiga project di tab Finance) → beralih role ke Sales → hanya section "Sales Pipeline" tampil → beralih ke Finance → hanya "Budget vs Actual dan Margin" dan "Invoice Aging dan Outstanding" tampil → beralih ke Operations → `RoleAccessState` ("Anda tidak memiliki akses").

## 6. Routes

Tidak ada route baru. `/reports` (Section 05 `ModulePlaceholder` shell) diisi penuh.

## 7. Files Created, Changed, dan Removed

**Created:** `app/pages/reports/index.vue` (ditulis ulang total dari `ModulePlaceholder`), `docs/mockup-section-reports/section-16-reports.md`.

**Changed:** `app/constants/navigation.ts` (nav item Reports: `comingSoon: true` dihapus — halaman kini benar-benar terimplementasi, satu baris).

**Removed:** Tidak ada.

## 8. Components Reused dan Created

**Reused:** `PageHeader`, `SectionCard`, `RoleAccessState`, `LoadingState`, `EmptyState`, `StatusBreakdownList`, `StatsCard`, `BudgetChart`, `Table*`, `Select*`. Tidak ada komponen file baru.

**Created:** Tidak ada.

## 9. Types, Constants, Fixtures, dan Mock State

**Tidak ada perubahan type/constant/fixture.** Seluruh data (`PROJECTS`, `OPPORTUNITIES`, `QUOTATIONS`, `VENDOR_QUOTATIONS`, `INVOICES`) dan selektor (`getProjectServices`, `getServicesForProjects`, `getVendorById`, `getCommittedVendorCostIdr`, `getInvoiceOutstandingIdr`, `getProjectById`) dipakai apa adanya (read-only), mengikuti eksplisit protection notes Section 15. Tidak ada selektor baru ditambahkan ke `app/data/index.ts` — agregasi Vendor Summary (top vendor by committed cost) dan Sales Pipeline (breakdown per stage) dihitung sebagai `computed()` lokal di halaman, karena logic tsb belum pernah diekstrak jadi selektor bersama pada section manapun (pola yang sama seperti `opportunityPipeline`/`projectsByStatus` di Dashboard, yang juga tetap lokal di halaman masing-masing, bukan di `data/index.ts`).

## 10. Responsive Behavior

Filter row: `grid-cols-1 sm:grid-cols-3`. Stat row per section: `grid-cols-1 sm:grid-cols-2/3/4/5` tergantung jumlah kartu. Section 3 dan 4 (dua kolom internal — list+breakdown, breakdown+table): `grid-cols-1 lg:grid-cols-2`. Tidak diverifikasi lewat browser interaktif — tidak ada tool headless browser tersedia (keterbatasan konsisten sejak Section 06).

## 11. Loading, Empty, Error, Not-Found, dan Unauthorized States

- **Loading:** `LoadingState` disimulasikan 400ms (`isLoading` + `onMounted`/`setTimeout`, pola identik Dashboard Section 06) sebelum seluruh section dirender.
- **Empty:** `StatusBreakdownList` (empty label built-in) untuk seluruh breakdown; `EmptyState` eksplisit untuk daftar (Upcoming Departures, Top Vendor, tabel invoice outstanding) dan `BudgetChart` (fallback bila tidak ada project sesuai filter).
- **Error:** Tidak ada state error baru — konsisten dengan seluruh halaman list/agregasi section lain (data fixture sinkron, tidak ada fetch async nyata).
- **Not-found:** Tidak berlaku — halaman statis tanpa parameter dinamis.
- **Unauthorized:** `RoleAccessState` untuk `!canView('reports')` (Operations/Ticketing/Accommodation/Transportation/MICE).

## 12. Role Behavior

`canView('reports')` — gerbang akses halaman (module-level, `ROLE_MODULE_ACCESS.reports`, existing sejak Foundation). Enam flag `visibleTo(...)` lokal (pola identik Dashboard Section 06) menggerbangi tiap `SectionCard` sesuai pemetaan pada bagian 4 di atas — bukan constant/permission baru, murni computed lokal membandingkan `currentRole`.

## 13. Validation Commands dan Hasilnya

- `npx nuxi prepare` — **sukses**.
- `npm run build` — **sukses (exit 0, dijalankan 2x — run kedua setelah fix `comingSoon`)**.
- `npx vitest run` — "No test files found" (pre-existing, Q8).
- `npx nuxi typecheck` — gagal, `vue-tsc` tidak terpasang (Q8, pre-existing).
- Lint — tidak tersedia (Q8, pre-existing).
- **Smoke test HTTP** (curl): `/`, `/projects`, `/projects/PRJ-102`, `/vendors`, `/finance/invoices`, `/finance/payments`, `/crm/opportunities`, `/reports` — seluruhnya **HTTP 200**.
- **Verifikasi bundle server** (karena `isLoading` membuat SSR HTML awal hanya berisi skeleton — pola identik Dashboard Section 06, dikonfirmasi dengan curl `/` yang juga hanya menampilkan "Memuat ringkasan dashboard..." pada SSR, bukan regresi Section 16): grep `.output/server/chunks/build/reports-*.mjs` mengonfirmasi seluruh 6 judul section ("Sales Pipeline", "Project Performance", "Upcoming Departure dan Service Readiness", "Vendor Summary", "Budget vs Actual dan Margin", "Invoice Aging dan Outstanding") ter-compile ke bundle.
- **Verifikasi angka manual** (silang dengan fixture `app/data/*.ts` dan angka yang sudah tervalidasi Section 15): Budget total 3 project = Rp1.645.000.000, Actual = Rp1.597.500.000, Variance = Rp47.500.000, Quotation = Rp1.840.000.000, Margin = Rp242.500.000 (jumlah persis dari tiga angka per-project Section 15 yang sudah divalidasi). Invoice outstanding: INV-1021 (Rp60jt, 28 hari overdue), INV-1022 (Rp35jt, 9 hari overdue), INV-1032 (Rp700jt, jatuh tempo 7 hari lagi) → Total Outstanding Rp795.000.000, Invoice Overdue = 2 — **persis cocok** dengan aging yang sudah divalidasi Section 15. Committed Vendor Cost total = Rp1.365.000.000 (sum 6 `VENDOR_QUOTATIONS` berstatus `accepted`). Sales Pipeline: Win Rate 75% (3 Won / 1 Lost), Nilai Pipeline Terbuka Rp240.000.000 (QUO-005 Rp180jt + QUO-006 Rp60jt, OPP-007 belum ada quotation → dihitung 0, bukan error).
- Tidak ditemukan string "Internal Server Error"/"TypeError"/"is not defined" pada seluruh HTML yang di-curl.
- **Regresi** — `/`, `/projects`, `/projects/PRJ-102`, `/vendors`, `/finance/invoices`, `/finance/payments`, `/crm/opportunities` tetap HTTP 200 tanpa perubahan file (hanya `app/constants/navigation.ts` yang disentuh di luar `app/pages/reports/index.vue`, dan itu satu baris penghapusan flag `comingSoon` khusus item Reports).
- **Verifikasi interaktif** (ganti role dan cek 6 section muncul/hilang sesuai matrix bagian 4, ganti filter) **tidak dilakukan** — tidak ada tool browser headless (keterbatasan konsisten sejak Section 06; role tersimpan di `localStorage` klien, SSR selalu render sebagai Super Admin default). Dimitigasi lewat code review ketat terhadap `visibleTo(...)` per section dan manual trace kondisi `v-if`.

## 14. Regression Checks

Section 06 (Dashboard — tidak disentuh kodenya sama sekali, dikonfirmasi HTTP 200 dan skeleton loading identik pre-existing), Section 13 (Vendor — `VENDOR_QUOTATIONS`/`getVendorById` hanya dibaca, tidak dimutasi; `/vendors` dikonfirmasi tidak berubah), Section 15 (Finance — `getInvoiceOutstandingIdr`/`getCommittedVendorCostIdr`/`invoiceAgingDays` hanya dipanggil, tidak diubah signature/logic-nya; `/finance/invoices`/`/finance/payments` dikonfirmasi tidak berubah) — seluruhnya diverifikasi tidak beregresi.

## 15. Cross-Section Impact

Satu entri baru: **CI-017** (`docs/mockup-change-impact-log.md`) — penghapusan flag `comingSoon: true` pada nav item Reports (`app/constants/navigation.ts`, dimiliki Section 05), dipicu langsung oleh Section 16 menyelesaikan halaman yang sebelumnya ditandai "Segera". Tidak ada entri lain — seluruh selektor Section 15 (`getInvoiceOutstandingIdr`, `getCommittedVendorCostIdr`, `invoiceAgingDays`) dan Section 06/12 (`getServicesForProjects`, `isUpcomingDeparture`) dipakai read-only tanpa perubahan signature/perilaku.

**Ditemukan namun sengaja tidak diperbaiki (di luar ownership Section 16):** `app/constants/navigation.ts` baris Invoices/Payments masih bertanda `comingSoon: true` walau `COMPLETED` sejak Section 15 — kemungkinan oversight Section 15 yang tidak menghapus flag tsb saat menyelesaikan halaman. Tidak diperbaiki di sini untuk menjaga scope Section 16 tetap murni Reports (instruksi eksplisit "Kerjakan hanya scope Prompt 16"); dicatat sebagai known issue (bagian 17) untuk diperbaiki eksplisit oleh user atau section berikutnya yang menyentuh Finance.

## 16. Review URLs

Tidak tersedia — lingkungan pengembangan lokal saja (`npm run dev` / `node .output/server/index.mjs`, tidak ada deployment publik).

## 17. Known Issues dan Deferred Work

- **Q8 (tooling lint/typecheck/test) masih terbuka** — **dua belas section berturut-turut** (06–16) berjalan tanpa validasi otomatis penuh.
- Export mock **tidak dikerjakan** — hard rule literal Prompt 16 ("Export hanya mock bila sudah disepakati") belum ada kesepakatan eksplisit; didefer, bukan gap tersembunyi.
- Pemetaan role untuk 2 section baru (Upcoming Departure/Service Readiness, Vendor Summary) adalah keputusan implementasi Section 16 sendiri (bagian 4), **bukan** perluasan tabel LOCKED bagian 5 — didokumentasikan transparan, disarankan direview user bila konvensi ini perlu diformalkan sebagai LOCKED di `docs/route-and-role-matrix.md`.
- `app/constants/navigation.ts` — Invoices/Payments masih bertanda `comingSoon: true` meski sudah `COMPLETED` (Section 15) — dicatat, tidak diperbaiki (di luar scope Section 16, lihat bagian 15).
- Verifikasi interaktif ganti-role dan filter tidak dilakukan langsung (keterbatasan tooling lingkungan, konsisten sejak Section 06).

## 18. Protection Notes untuk Section Berikutnya

- `app/pages/reports/index.vue` — pemilik penuh 6 section Reports. Section 17 (Administration)/18 (Regression) **tidak perlu** menyentuh file ini kecuali untuk integrasi/regression fix eksplisit.
- Filter Reports (`statusFilter`/`typeFilter`/`periodFilter`) lokal ke halaman ini — tidak berbagi state dengan filter Dashboard (Section 06), sengaja terpisah karena beda halaman/konteks.
- Bila Section 17/18 butuh agregasi finansial/vendor/operasional baru, **reuse** selektor `app/data/index.ts` existing yang sama (bagian 9) — jangan hitung ulang logic yang sama di tempat lain, mengikuti pola yang sudah diterapkan sejak Section 15.
- Pemetaan role 6 section Reports (bagian 4) adalah keputusan implementasi Section 16, didokumentasikan di `docs/route-and-role-matrix.md` bagian 1.6 (catatan implementasi baru) — rujuk ke sana, jangan asumsikan ulang dari bagian 5 (yang hanya mencakup 4 nama section lama).

## 19. Recommended Next Section

Section 17 — Administration (`prompts/19-PROMPT-17-ADMINISTRATION.md`), dengan rekomendasi sangat kuat menyelesaikan Q8 terlebih dahulu — dua belas section berturut-turut telah berjalan tanpa validasi otomatis penuh. Tidak dieksekusi otomatis — menunggu perintah user.
