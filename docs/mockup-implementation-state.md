# Mockup Implementation State — MANOVA

Dokumen kondisi implementasi **terkini** (bukan log kronologis — lihat `docs/mockup-section-progress.md` untuk histori, dan `docs/mockup-progress.md` untuk narasi lengkap Prompt 0–5). Wajib dibaca di awal setiap section baru sesuai `prompts/01-PROTOKOL WAJIB — CONTINUITY, DOKUMENTASI PER SECTION, DAN PERLINDUNGAN HASIL.md` bagian B, dan diperbarui di akhir setiap section sesuai bagian F.

Ditulis berdasarkan pemeriksaan langsung terhadap codebase (`git log`, `git status`, isi file `app/**`) dan hasil validasi yang benar-benar dijalankan ulang pada tanggal update di bawah — bukan disalin buta dari narasi lama.

---

## 1. Current Phase dan Current Section

- **Current phase:** Foundation + Dashboard selesai. Modul CRM/Opportunity/Project/Vendor/Finance/Reports/Administration (Section 07 ke atas) **belum** dieksekusi.
- **Current section:** Tidak ada section aktif — sistem menunggu perintah user untuk memulai Section 07 (CRM Party).
- **Last completed section:** **Section 06 — Dashboard** (`prompts/08-PROMPT-6-DASHBOARD.md`), status **COMPLETED**. Detail lengkap: `docs/mockup-section-reports/section-06-dashboard.md`.
- Section 05 — Foundation: COMPLETED, detail `docs/mockup-section-reports/section-05-foundation.md`.
- Section 00–04 (Prompt 0–4: Konteks Bisnis, Audit Template, Gap Analysis, Information Architecture, Dokumentasi) adalah tahap dokumentasi murni (tidak ada kode diubah) — statusnya COMPLETED, narasi lengkap ada di `docs/mockup-progress.md` Entri 1–5.

## 2. Route Inventory (Kondisi Aktual, Diperiksa Langsung dari `app/pages/`)

### 2.1 Route Aktif dengan Data Nyata dari Fixture (bukan placeholder)

| Route | File | Catatan |
|---|---|---|
| `/` | `app/pages/index.vue` | **Dashboard final (Section 06)** — filter (status/tipe/client/owner/periode), widget kondisional per role sesuai `docs/route-and-role-matrix.md` bagian 6, seluruh angka dari fixture pusat |
| `/login` | `app/pages/login.vue` | Rebrand MANOVA, mock auth via `localStorage` (middleware existing, tidak diubah) |
| `/crm` | `app/pages/crm/index.vue` | Overview CRM |
| `/crm/opportunities` | `app/pages/crm/opportunities.vue` | List nyata dari fixture `OPPORTUNITIES` (belum diperbarui untuk 3 opportunity pipeline baru — menyusul Section 08) |
| `/projects` | `app/pages/projects/index.vue` | List nyata dari fixture `PROJECTS` (ditulis ulang total dari data hardcoded lama) |
| `/projects/[id]` | `app/pages/projects/[id]/index.vue` | Shell 8-tab, fixture `PRJ-101`/`PRJ-102`/`PRJ-103`, not-found state untuk ID tak dikenal |
| `/vendors` | `app/pages/vendors/index.vue` | List nyata dari fixture `VENDORS` |
| `/finance` | `app/pages/finance/index.vue` | Overview Finance |
| `/admin` | `app/pages/admin/index.vue` | Overview Administration |
| `/settings` | `app/pages/settings.vue` | Profil minimal + demo role switcher (`useCurrentUser`) |
| `/[...slug]` | `app/pages/[...slug].vue` | 404 catch-all existing, dipertahankan |

### 2.2 Route Placeholder (`ModulePlaceholder`, berlabel "Segera" di navigasi — `comingSoon: true` di `app/constants/navigation.ts`)

`/crm/prospects`, `/crm/clients`, `/crm/quotations`, `/finance/invoices`, `/finance/payments`, `/reports`, `/admin/master-data`, `/admin/users`, `/admin/roles`, `/admin/audit-trail`.

Seluruhnya sudah routable (build sukses, tidak 404), tapi isinya baru komponen `ModulePlaceholder` — **belum implementasi fungsional**, tidak tersentuh oleh Section 06 (di luar scope Dashboard).

### 2.3 Route Lama, Ada di Disk, Tidak Ditautkan dari Navigasi Baru (deferred/menunggu adaptasi)

`app/pages/expenses.vue` (punya bug `handleDelete` belum diperbaiki, dicatat sejak audit Prompt 1), `app/pages/tasks.vue`, `app/pages/projects/create.vue`, `app/pages/projects/[id]/edit.vue`. Tidak tersentuh oleh Section 06.

### 2.4 Route Excluded (tidak dilanjutkan sama sekali)

`/time-tracking`, `/templates`, `/integrations`, `/files` (top-level), `/team` (top-level) — lihat `docs/route-and-role-matrix.md` bagian 1.8 untuk alasan per item.

## 3. Component Shared dan Domain yang Sudah Tersedia

**Shared UI foundation** (`app/components/shared/`, **12 komponen** — 11 dari Section 05 + `StatusBreakdownList.vue` baru Section 06): `PageHeader.vue`, `Breadcrumb.vue`, `StatusBadge.vue`, `EmptyState.vue`, `LoadingState.vue`, `ErrorState.vue`, `AttentionIndicator.vue`, `SectionCard.vue`, `DetailMetadataList.vue`, `ModulePlaceholder.vue`, `RoleAccessState.vue`, **`StatusBreakdownList.vue`** (breakdown-by-status generik: props `items: StatusBreakdownItem[]` — dipakai Opportunity Pipeline, Active Projects by Status, Service Readiness; kemungkinan dipakai lagi Section 16 Reports).

**Primitive baru** (`app/components/ui/tabs/`): `Tabs.vue`, `TabsList.vue`, `TabsTrigger.vue`, `TabsContent.vue`, `index.ts` — berbasis Reka UI, dipakai Project Detail shell.

**Primitive `ui/select` kini benar-benar dipakai** (Section 06) — filter bar Dashboard adalah pemakaian nyata pertama (sebelumnya hanya ada di codebase tanpa consumer).

**Dashboard components existing — kini direuse dan diadaptasi (Section 06), bukan lagi hardcoded fake data:**
- `dashboard/StatsCard.vue` — dipakai apa adanya sejak Section 05 (Dashboard, CRM overview, Finance overview).
- `dashboard/BudgetChart.vue` — **diadaptasi Section 06**: dari line chart bulanan fiktif (USD) menjadi bar chart Budget vs Actual per project nyata (IDR), props `labels/budgetIdr/actualIdr`.
- `dashboard/ExpenseCategories.vue` — **diadaptasi Section 06**: dari doughnut department fiktif (USD) menjadi cost breakdown per project nyata (IDR), props `items: {name, valueIdr}[]`.
- `dashboard/RecentActivity.vue` — **diadaptasi Section 06**: dari daftar user/avatar fiktif menjadi daftar activity project nyata, props `items`.

**Dashboard components existing yang MASIH belum direuse (dicadangkan untuk section domain lain):** `ProjectsTable.vue` (Section 10 — Project Core), `TasksOverview.vue` (Section 14 — Project Changes), `TeamMetrics.vue` (Section 17 — Administration, atau Overview Project Detail). **Area yang harus dilindungi** — jangan dihapus tanpa dependency check ulang.

**Layout existing dipertahankan:** `layouts/dashboard.vue`, `components/layout/AppSidebar.vue`, `components/layout/TopHeader.vue`, `composables/useSidebar.ts`, `composables/useIsMobile.ts` (tidak diubah Section 06).

**15 primitive `ui/*` lama** — dipertahankan apa adanya, sumber reuse utama untuk seluruh section berikutnya.

## 4. Types, Constants, Fixtures, Mock State, dan Role Behavior yang Aktif

**Types** (`app/types/`, 8 file) — **tidak diubah Section 06** (tidak ada field baru ditambahkan; seluruh widget baru memakai field yang sudah ada di `Project`, `Opportunity`, `Quotation`, `ProjectTask`, `ActivityEntry`).

**Constants** (`app/constants/`, 3 file) — tidak diubah Section 06.

**Fixtures** (`app/data/`, 8 file + barrel `index.ts`):
- `users.ts`, `parties.ts`, `vendors.ts`, `finance.ts` — tidak diubah Section 06.
- `projects.ts` — tidak diubah Section 06 (3 Project tetap `PRJ-101/102/103`).
- **`opportunities.ts` — diperluas Section 06**: +3 Opportunity pipeline aktif (`OPP-005` negotiation, `OPP-006` proposal, `OPP-007` qualification) dan +2 Quotation (`QUO-005`, `QUO-006`) agar widget "Opportunity Pipeline" dan "Quotations Menunggu Keputusan" punya data nyata (sebelumnya seluruh 4 Opportunity sudah Won/Lost, pipeline selalu kosong). Lihat `docs/mockup-change-impact-log.md` CI-002.
- **`activity.ts` — diperluas Section 06**: +2 Task dengan `dueAt` di masa depan (`TSK-1023`, `TSK-1035`) agar widget "Milestone/Task Mendatang" (Project Manager) punya data selain yang overdue.
- `index.ts` — **selector baru Section 06**: `getProjectsByOwner`, `getServicesForProjects`, `getUpcomingTasks`, `getRecentChanges` (murni tambahan, tidak mengubah selector existing).

**Mock state aktif:** `useCurrentUser()`, `usePermissions()` — tidak diubah Section 06, dipakai apa adanya oleh Dashboard.

**Formatter dan helper:** `app/utils/format.ts` — tidak diubah. `app/utils/attention.ts` — **+2 export Section 06**: `UPCOMING_TASK_WINDOW_DAYS` (14 hari) dan `isTaskUpcoming()` (murni tambahan).

**Role behavior aktif:** Dashboard kini mengimplementasikan **precise 1:1 mapping** ke `docs/route-and-role-matrix.md` bagian 6 (Management: Pipeline/Active-by-status/Budget vs Actual/Outstanding/Attention/Recent updates; Sales: Pipeline/Quotations pending; Project Manager: 5 widget "milik sendiri"; Operations-family: Service Readiness scoped per sub-domain + Upcoming Departure; Finance: Budget vs Actual/Cost breakdown/Outstanding; Super Admin: superset + admin summary; Viewer: identik dengan Management, read-only). Detail interpretasi (Lead tidak dimodelkan, Cost breakdown per-project bukan per-kategori, Sales follow-up activity deferred) dicatat di `docs/route-and-role-matrix.md` bagian 6 dan section report.

## 5. Area Hasil Section Lama yang Harus Dilindungi

- Seluruh 12 shared component, seluruh fixture `app/data/*`, seluruh type `app/types/*`, seluruh constant `app/constants/*` — dipakai lintas banyak halaman, jangan diubah shape-nya tanpa cross-section impact check.
- `app/pages/projects/[id]/index.vue` — shell 8-tab, struktur tab/single-route tidak boleh diubah (LOCKED, D-026/D-027).
- `NAV_ITEMS` (`app/constants/navigation.ts`) — satu source of truth navigasi.
- `useCurrentUser`/`usePermissions` — satu source of truth role mock.
- `ProjectsTable.vue`, `TasksOverview.vue`, `TeamMetrics.vue` — masih dicadangkan, jangan dihapus.
- **`app/pages/index.vue` (Dashboard) kini COMPLETED untuk Section 06** — section berikutnya (07 ke atas) yang membutuhkan Dashboard menampilkan data baru (mis. Party/Opportunity real setelah CRM dibangun) harus **menyesuaikan fixture**, bukan menulis ulang struktur widget/filter Dashboard tanpa alasan kuat.
- `OPP-005`–`007`/`QUO-005`–`006`/`TSK-1023`/`TSK-1035` (ditambahkan Section 06) — Section 07/08/14 harus **mewarisi dan memperluas** baris ini bila membangun halaman Opportunity/Quotation/Task sungguhan, bukan menduplikasi dengan ID baru untuk konsep yang sama.
- `docs/mockup-data-scenarios.md` — fixture section baru wajib konsisten dengan skenario dan ID di dalamnya (termasuk bagian 4a yang baru).

## 6. Known Issues dan Validation Status

Divalidasi ulang langsung pada tanggal update dokumen ini:

| Cek | Hasil | Catatan |
|---|---|---|
| `npx nuxi prepare` | **Sukses** | Regenerasi types `.nuxt/` setelah penambahan komponen/selector baru |
| `npm run build` | **Sukses** (exit 0) | Dijalankan 2x (sebelum dan sesudah pembersihan unused import) |
| Smoke test route (curl, preview server) | **HTTP 200** untuk `/`, `/settings`, `/login`, `/projects`, `/projects/PRJ-101`, `/crm`, `/vendors`, `/finance`, `/admin` | Tidak ada string error/exception di HTML; SSR menampilkan `LoadingState` (by design — data terisi setelah hydration client, konsisten dengan Section 05) |
| Bundle content check | Widget baru ("Opportunity Pipeline", "Total Budget vs Actual", dll.) **terkonfirmasi ter-compile** ke dalam server bundle | Verifikasi tekstual pada `.output/server/chunks/build/pages-*.mjs` |
| `npx vitest run` | **"No test files found", exit code 1** | Pre-existing, bukan regresi |
| `npx nuxi typecheck` | **Gagal — `vue-tsc` tidak terpasang** | Q8 belum diselesaikan (lihat catatan di bawah) |
| Lint | **Tidak tersedia** | Sama seperti Section 05, Q8 belum diselesaikan |
| Interactive/hydrated browser check | **Tidak dilakukan** | Tidak ada tool browser headless tersedia di lingkungan ini; verifikasi dilakukan lewat build success + bundle content check + code review manual, bukan screenshot interaktif |

**Known issues terbuka:**
- **Q8 — Tooling lint/typecheck/test belum lengkap.** Tetap `NEEDS_VALIDATION`. Section 05 merekomendasikan penyelesaian Q8 sebelum Section 06 dimulai; **user secara eksplisit memerintahkan Section 06 dikerjakan langsung** (`prompts/99-RUN-CURRENT-SECTION.md`) tanpa menyelesaikan Q8 terlebih dahulu — instruksi user diikuti sesuai protokol (instruksi eksplisit mengesampingkan rekomendasi section sebelumnya), tapi Q8 dicatat tetap terbuka dan makin mendesak untuk section berikutnya.
- **Bug `handleDelete` di `app/pages/expenses.vue`** — belum diperbaiki, tidak tersentuh Section 06.
- **"Follow-up/activity mendatang milik sendiri" (Sales)** — belum diimplementasikan, data model Activity level-Party/Opportunity belum ada (lihat bagian 4 dan section report).
- **"Cost breakdown" Finance** — per-project, bukan per jenis layanan (keterbatasan fixture, bukan bug).
- Q7, Q9, Q10, Q11 — tidak berubah, lihat `docs/mockup-open-questions.md`.

## 7. Next Recommended Section

Section 07 — CRM Party (`prompts/09-PROMPT-7-CRM-PARTY.md`). **Rekomendasi:** selesaikan Q8 (tooling lint/typecheck) sebelum atau di awal Section 07 — sudah dua section berturut-turut berjalan tanpa lint/typecheck otomatis. Tidak dieksekusi otomatis — menunggu perintah user.

## 8. Last Updated

- **Date:** 2026-07-29
- **Updater:** Section 06 (Dashboard) execution, berdasarkan pemeriksaan langsung codebase, build/smoke-test yang benar-benar dijalankan ulang — bukan berdasarkan asumsi.
