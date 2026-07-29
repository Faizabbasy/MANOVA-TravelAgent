# Mockup Implementation State — MANOVA

Dokumen kondisi implementasi **terkini** (bukan log kronologis — lihat `docs/mockup-section-progress.md` untuk histori, dan `docs/mockup-progress.md` untuk narasi lengkap Prompt 0–5). Wajib dibaca di awal setiap section baru sesuai `prompts/01-PROTOKOL WAJIB — CONTINUITY, DOKUMENTASI PER SECTION, DAN PERLINDUNGAN HASIL.md` bagian B, dan diperbarui di akhir setiap section sesuai bagian F.

Ditulis berdasarkan pemeriksaan langsung terhadap codebase (`git log`, `git status`, isi file `app/**`) dan hasil validasi yang benar-benar dijalankan ulang pada tanggal update di bawah — bukan disalin buta dari narasi lama.

---

## 1. Current Phase dan Current Section

- **Current phase:** Foundation selesai. Belum ada modul bisnis (Section 06 ke atas) yang dieksekusi.
- **Current section:** Tidak ada section aktif — sistem menunggu perintah user untuk memulai Section 06 (Dashboard).
- **Last completed section:** **Section 05 — Foundation** (`prompts/07-.PROMPT 5 — BERSIHKAN TEMPLATE DAN SIAPKAN FOUNDATION.md`), status **COMPLETED**. Detail lengkap: `docs/mockup-section-reports/section-05-foundation.md`.
- Section 00–04 (Prompt 0–4: Konteks Bisnis, Audit Template, Gap Analysis, Information Architecture, Dokumentasi) adalah tahap dokumentasi murni (tidak ada kode diubah) — statusnya COMPLETED, narasi lengkap ada di `docs/mockup-progress.md` Entri 1–5.

## 2. Route Inventory (Kondisi Aktual, Diperiksa Langsung dari `app/pages/`)

### 2.1 Route Aktif dengan Data Nyata dari Fixture (bukan placeholder)

| Route | File | Catatan |
|---|---|---|
| `/` | `app/pages/index.vue` | Dashboard, widget kondisional per role, memakai fixture pusat |
| `/login` | `app/pages/login.vue` | Rebrand MANOVA, mock auth via `localStorage` (middleware existing, tidak diubah) |
| `/crm` | `app/pages/crm/index.vue` | Overview CRM |
| `/crm/opportunities` | `app/pages/crm/opportunities.vue` | List nyata dari fixture `OPPORTUNITIES` |
| `/projects` | `app/pages/projects/index.vue` | List nyata dari fixture `PROJECTS` (ditulis ulang total dari data hardcoded lama) |
| `/projects/[id]` | `app/pages/projects/[id]/index.vue` | Shell 8-tab, fixture `PRJ-101`/`PRJ-102`/`PRJ-103`, not-found state untuk ID tak dikenal |
| `/vendors` | `app/pages/vendors/index.vue` | List nyata dari fixture `VENDORS` |
| `/finance` | `app/pages/finance/index.vue` | Overview Finance |
| `/admin` | `app/pages/admin/index.vue` | Overview Administration |
| `/settings` | `app/pages/settings.vue` | Profil minimal + demo role switcher (`useCurrentUser`) |
| `/[...slug]` | `app/pages/[...slug].vue` | 404 catch-all existing, dipertahankan |

### 2.2 Route Placeholder (`ModulePlaceholder`, berlabel "Segera" di navigasi — `comingSoon: true` di `app/constants/navigation.ts`)

`/crm/prospects`, `/crm/clients`, `/crm/quotations`, `/finance/invoices`, `/finance/payments`, `/reports`, `/admin/master-data`, `/admin/users`, `/admin/roles`, `/admin/audit-trail`.

Seluruhnya sudah routable (build sukses, tidak 404), tapi isinya baru komponen `ModulePlaceholder` (judul, deskripsi, breadcrumb, badge phase) — **belum implementasi fungsional**, sesuai batasan eksplisit Prompt 5.

### 2.3 Route Lama, Ada di Disk, Tidak Ditautkan dari Navigasi Baru (deferred/menunggu adaptasi)

`app/pages/expenses.vue` (punya bug `handleDelete` belum diperbaiki, dicatat sejak audit Prompt 1), `app/pages/tasks.vue`, `app/pages/projects/create.vue`, `app/pages/projects/[id]/edit.vue`. Route ini masih bisa diakses langsung lewat URL tapi bukan bagian IA aktif — akan diadaptasi/direpurpose pada section Project Finance, Project Changes, Project Core, dan Opportunity Won to Project.

### 2.4 Route Excluded (tidak dilanjutkan sama sekali)

`/time-tracking`, `/templates`, `/integrations`, `/files` (top-level), `/team` (top-level) — lihat `docs/route-and-role-matrix.md` bagian 1.8 untuk alasan per item.

## 3. Component Shared dan Domain yang Sudah Tersedia

**Shared UI foundation** (`app/components/shared/`, 11 komponen, diperiksa langsung — semuanya ada): `PageHeader.vue`, `Breadcrumb.vue`, `StatusBadge.vue`, `EmptyState.vue`, `LoadingState.vue`, `ErrorState.vue`, `AttentionIndicator.vue`, `SectionCard.vue`, `DetailMetadataList.vue`, `ModulePlaceholder.vue`, `RoleAccessState.vue`.

**Primitive baru** (`app/components/ui/tabs/`): `Tabs.vue`, `TabsList.vue`, `TabsTrigger.vue`, `TabsContent.vue`, `index.ts` — berbasis Reka UI, dipakai Project Detail shell.

**Dashboard components existing yang direuse apa adanya:** `dashboard/StatsCard.vue` (dipakai di Dashboard, CRM overview, Finance overview).

**Dashboard components existing yang BELUM direuse (sengaja dipertahankan, bukan dihapus, menunggu section Finance/Project/Reporting):** `dashboard/BudgetChart.vue`, `ExpenseCategories.vue`, `ProjectsTable.vue`, `RecentActivity.vue`, `TasksOverview.vue`, `TeamMetrics.vue`. **Ini area yang harus dilindungi** — jangan dihapus tanpa dependency check ulang, kategorinya masih `ADAPT`/`REUSE_COMPONENTS`, bukan `REMOVE_AFTER_VALIDATION`.

**Layout existing dipertahankan:** `layouts/dashboard.vue`, `components/layout/AppSidebar.vue` (navigasi ditulis ulang berbasis `NAV_ITEMS`), `components/layout/TopHeader.vue` (disederhanakan), `composables/useSidebar.ts`, `composables/useIsMobile.ts` (tidak diubah).

**15 primitive `ui/*` lama** (Table, Badge, Card, Button, Input, Popover, Tooltip, Avatar, Separator, Dialog, Sheet, Select, Checkbox, Label, Progress) — dipertahankan apa adanya, sumber reuse utama untuk seluruh section berikutnya.

## 4. Types, Constants, Fixtures, Mock State, dan Role Behavior yang Aktif

**Types** (`app/types/`, 8 file, diperiksa langsung): `common.ts`, `user.ts`, `party.ts`, `opportunity.ts`, `project.ts`, `vendor.ts`, `finance.ts`, `activity.ts`.

**Constants** (`app/constants/`, 3 file): `status.ts` (status project/service/dll.), `roles.ts` (`ROLES`, `ROLE_MODULE_ACCESS` — 11 role x 6 modul x 5 level akses, `FULL_FINANCIAL_VISIBILITY_ROLES`), `navigation.ts` (`NAV_ITEMS`, satu source of truth sidebar).

**Fixtures** (`app/data/`, 8 file + barrel `index.ts`, isi diperiksa langsung):
- `users.ts` — 1 user per role (11 user, default demo `USR-010` = Super Admin).
- `parties.ts` — 4 Party (`PTY-001`–`PTY-004`: 3 `client`, 1 `prospect`) + 4 Contact.
- `opportunities.ts` — `OPPORTUNITIES` + `QUOTATIONS`.
- `vendors.ts` — 5 Vendor (`VND-001`–`VND-005`).
- `projects.ts` — 3 Project (`PRJ-101` Manila/flight-only, `PRJ-102` Abu Dhabi/flight+hotel dengan service `changed` dan `cancelled`, `PRJ-103` Palu/flight+hotel+transportation+MICE dengan traveler group dan traveler ber-`specialRequest`) + `PROJECT_SERVICES`, `TRAVELER_GROUPS`, `TRAVELERS`.
- `finance.ts` — `INVOICES`, `PAYMENTS`.
- `activity.ts` — `ACTIVITIES`, `DOCUMENTS`, `TASKS`.
- `index.ts` — barrel export + selector helper (`getProjectById`, `getProjectsNeedingAttention`, `getOutstandingInvoices`, dll.).

**Mock state aktif:** `useCurrentUser()` (`app/composables/useCurrentUser.ts`) — reactive current-user id, persist ke `localStorage` (`manovaCurrentUserId`), default Super Admin, diganti lewat role switcher di `/settings`. `usePermissions()` — helper `canView`/`canManage` dsb. berbasis `ROLE_MODULE_ACCESS`. Auth mock lama (`middleware/auth.ts`, flag `localStorage.isAuthenticated`) tidak diubah, tetap dipakai apa adanya.

**Formatter dan helper:** `app/utils/format.ts` (Rupiah, tanggal, dll.), `app/utils/attention.ts` (`isProjectNeedingAttention`, dipakai `getProjectsNeedingAttention`). `app/lib/utils.ts` (`cn()`) dipertahankan sebagai satu-satunya sumber — duplikatnya (`app/utils/cn.ts`) sudah dihapus (dependency-checked, tidak ada pemakai).

**Role behavior aktif:** navigasi sidebar sudah role-aware (item dengan `moduleKey` disembunyikan bila `ROLE_MODULE_ACCESS[role][moduleKey] === 'NONE'`); Dashboard menampilkan widget kondisional per role; halaman lain belum punya role-gating granular di luar navigasi (menyusul per section masing-masing).

## 5. Area Hasil Section Lama yang Harus Dilindungi

- Seluruh 11 shared component, seluruh fixture `app/data/*`, seluruh type `app/types/*`, seluruh constant `app/constants/*` — dipakai lintas banyak halaman, jangan diubah shape-nya tanpa cross-section impact check.
- `app/pages/projects/[id]/index.vue` — shell 8-tab adalah kerangka yang akan diisi oleh Section 10–15; jangan mengubah struktur tab atau routing single-route-nya (LOCKED, D-026/D-027).
- `NAV_ITEMS` (`app/constants/navigation.ts`) — satu source of truth navigasi; section baru menambah item/menghapus `comingSoon`, bukan membuat struktur navigasi paralel.
- `useCurrentUser`/`usePermissions` — satu source of truth role mock; jangan membuat mekanisme role-check kedua.
- Dashboard components yang belum direuse (bagian 3) — jangan dihapus, statusnya masih dicadangkan untuk section mendatang.
- `docs/mockup-data-scenarios.md` (Normal/High-Change/Complex, ID `PRJ-101/102/103`) — fixture section baru wajib konsisten dengan skenario dan ID ini, bukan membuat dataset paralel.

## 6. Known Issues dan Validation Status

Divalidasi ulang langsung pada tanggal update dokumen ini (bukan hanya dikutip dari log lama):

| Cek | Hasil | Catatan |
|---|---|---|
| `npm run build` | **Sukses** (exit 0) | Build production kembali dijalankan saat penyusunan dokumen ini, konsisten dengan hasil Prompt 5 |
| `npx vitest run` | **"No test files found", exit code 1** | Pre-existing sejak awal template, 0 test file — bukan regresi |
| `npx nuxi typecheck` | **Gagal — `vue-tsc` tidak terpasang** | Tooling belum diinstal (Q8, `NEEDS_VALIDATION`), konsisten dengan Prompt 5 |
| Lint | **Tidak tersedia** | Tidak ada script `lint` di `package.json`; `eslint` core tidak ada di `node_modules` (hanya config package `@nuxtjs/eslint-config-typescript` yang terpasang, tidak dipakai) |

**Known issues terbuka (lihat `docs/mockup-open-questions.md` untuk detail):**
- **Q8 — Tooling lint/typecheck/test belum lengkap.** Status `NEEDS_VALIDATION`, **blocking sebelum Section 06 (Dashboard) dimulai** menurut catatan Prompt 5 — belum diselesaikan.
- **Bug `handleDelete` di `app/pages/expenses.vue`** — belum diperbaiki (route ini belum ditautkan ke navigasi, tapi wajib diperbaiki sebelum diadaptasi di Section 15 Project Finance).
- Q7 (adopsi `vee-validate`+`zod`), Q9 (threshold numerik attention — sudah ada asumsi default aman), Q10, Q11 — non-blocking/deferred, lihat dokumen open questions.

## 7. Next Recommended Section

Section 06 — Dashboard (`prompts/08-PROMPT-6-DASHBOARD.md`). **Rekomendasi eksplisit dari log Prompt 5:** putuskan dan selesaikan Q8 (tooling lint/typecheck) terlebih dahulu sebelum atau di awal Section 06, karena Q8 berstatus blocking. Tidak dieksekusi otomatis — menunggu perintah user.

## 8. Last Updated

- **Date:** 2026-07-29
- **Updater:** Continuity documentation setup (dijalankan atas permintaan user sebelum implementasi mockup dimulai), berdasarkan pemeriksaan langsung codebase dan re-run validasi — bukan berdasarkan asumsi.
