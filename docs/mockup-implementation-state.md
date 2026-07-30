# Mockup Implementation State — MANOVA

Dokumen kondisi implementasi **terkini** (bukan log kronologis — lihat `docs/mockup-section-progress.md` untuk histori, dan `docs/mockup-progress.md` untuk narasi lengkap Prompt 0–5). Wajib dibaca di awal setiap section baru sesuai `prompts/01-PROTOKOL WAJIB — CONTINUITY, DOKUMENTASI PER SECTION, DAN PERLINDUNGAN HASIL.md` bagian B, dan diperbarui di akhir setiap section sesuai bagian F.

Ditulis berdasarkan pemeriksaan langsung terhadap codebase (`git log`, `git status`, isi file `app/**`) dan hasil validasi yang benar-benar dijalankan ulang pada tanggal update di bawah — bukan disalin buta dari narasi lama.

---

## 1. Current Phase dan Current Section

- **Current phase:** Foundation + Dashboard + CRM Party selesai. Modul Opportunity/Quotation/Project/Vendor/Finance/Reports/Administration (Section 08 ke atas) **belum** dieksekusi.
- **Current section:** Tidak ada section aktif — sistem menunggu perintah user untuk memulai Section 08 (Opportunity dan Quotation).
- **Last completed section:** **Section 07 — CRM Party** (`prompts/09-PROMPT-7-CRM-PARTY.md`), status **COMPLETED**. Detail lengkap: `docs/mockup-section-reports/section-07-crm-party.md`.
- Section 06 — Dashboard: COMPLETED, detail `docs/mockup-section-reports/section-06-dashboard.md`.
- Section 05 — Foundation: COMPLETED, detail `docs/mockup-section-reports/section-05-foundation.md`.
- Section 00–04 (Prompt 0–4): dokumentasi murni, COMPLETED, narasi lengkap `docs/mockup-progress.md` Entri 1–5.

## 2. Route Inventory (Kondisi Aktual, Diperiksa Langsung dari `app/pages/`)

### 2.1 Route Aktif dengan Data Nyata dari Fixture (bukan placeholder)

| Route | File | Catatan |
|---|---|---|
| `/` | `app/pages/index.vue` | Dashboard final (Section 06) + widget Sales "Follow-up Mendatang" diisi Section 07 |
| `/login` | `app/pages/login.vue` | Rebrand MANOVA, mock auth via `localStorage` (tidak diubah) |
| `/crm` | `app/pages/crm/index.vue` | Overview CRM |
| `/crm/prospects` | `app/pages/crm/prospects.vue` | **Baru (Section 07)** — list nyata + search/sort + create-mock "Tambah Prospect" |
| `/crm/clients` | `app/pages/crm/clients.vue` | **Baru (Section 07)** — list nyata + search, tanpa aksi create/convert manual |
| `/crm/parties/[id]` | `app/pages/crm/parties/[id]/index.vue` | **Baru (Section 07)** — Party Detail 5-tab (Overview/Contacts/Opportunities/Activities/Projects*), not-found state, create-mock Contact & Activity |
| `/crm/opportunities` | `app/pages/crm/opportunities.vue` | List nyata (Section 05), belum diperbarui untuk grouping stage — menyusul Section 08 |
| `/projects` | `app/pages/projects/index.vue` | List nyata dari fixture `PROJECTS` |
| `/projects/[id]` | `app/pages/projects/[id]/index.vue` | Shell 8-tab, fixture `PRJ-101`/`PRJ-102`/`PRJ-103`, not-found state |
| `/vendors` | `app/pages/vendors/index.vue` | List nyata dari fixture `VENDORS` |
| `/finance` | `app/pages/finance/index.vue` | Overview Finance |
| `/admin` | `app/pages/admin/index.vue` | Overview Administration |
| `/settings` | `app/pages/settings.vue` | Profil minimal + demo role switcher |
| `/[...slug]` | `app/pages/[...slug].vue` | 404 catch-all existing |

### 2.2 Route Placeholder (`ModulePlaceholder`, `comingSoon: true` di `app/constants/navigation.ts`)

`/crm/quotations`, `/finance/invoices`, `/finance/payments`, `/reports`, `/admin/master-data`, `/admin/users`, `/admin/roles`, `/admin/audit-trail`. (Prospects dan Clients **tidak lagi** placeholder — `comingSoon` dihapus Section 07.)

### 2.3 Route Lama, Ada di Disk, Tidak Ditautkan dari Navigasi Baru (deferred/menunggu adaptasi)

`app/pages/expenses.vue` (bug `handleDelete` belum diperbaiki), `app/pages/tasks.vue`, `app/pages/projects/create.vue`, `app/pages/projects/[id]/edit.vue`. Tidak tersentuh Section 07.

### 2.4 Route Excluded

`/time-tracking`, `/templates`, `/integrations`, `/files` (top-level), `/team` (top-level) — lihat `docs/route-and-role-matrix.md` bagian 1.8.

## 3. Component Shared dan Domain yang Sudah Tersedia

**Shared UI foundation** (`app/components/shared/`, 12 komponen — tidak ada penambahan file baru Section 07, tapi `SectionCard.vue` **diperluas** dengan slot opsional `#actions` di CardHeader, backward-compatible, dipakai tab Contacts/Activities Party Detail untuk tombol "Tambah").

**Primitive `ui/dialog`, `ui/select` (native `<select>` untuk sort/filter list)** — dipakai nyata pertama kali di halaman non-Dashboard oleh Section 07 (Dialog untuk create Prospect/Contact/Activity).

**Dashboard components** — tidak diubah strukturnya Section 07; hanya menerima satu widget baru di halaman `index.vue` (bagian 4).

**Dashboard components yang MASIH belum direuse:** `ProjectsTable.vue`, `TasksOverview.vue`, `TeamMetrics.vue` — tidak tersentuh Section 07, tetap dicadangkan.

**Layout, 15 primitive `ui/*` lama** — tidak diubah Section 07.

## 4. Types, Constants, Fixtures, Mock State, dan Role Behavior yang Aktif

**Types** (`app/types/`, 8 file) — `party.ts` **diperluas Section 07**: `+PartyDetailTab`, `+PartyActivityType`, `+PartyActivity` interface. Tidak ada breaking change ke `Party`/`ContactPerson` existing.

**Constants** (`app/constants/`, 3 file) — `status.ts` **+`PARTY_ACTIVITY_TYPES`** (5 kategori: call/meeting/email/note/follow-up). `navigation.ts` — `comingSoon: true` dihapus dari item Prospects dan Clients.

**Fixtures** (`app/data/`, 8 file + barrel `index.ts`):
- **`parties.ts` — perubahan signifikan Section 07**: `PARTIES` dan `CONTACTS` diubah dari array biasa menjadi `reactive()` (agar create-mock UI benar-benar terlihat lintas halaman tanpa reload — lihat `docs/mockup-change-impact-log.md` CI-004); `+PARTY_ACTIVITIES` (6 seed record, `reactive()`).
- `index.ts` — **selector baru Section 07**: `getProjectsByParty`, `getPartyActivities`, `getUpcomingFollowUps`, `createParty`, `createContact`, `createPartyActivity` (+ helper internal `nextSequentialId`).
- `opportunities.ts`, `projects.ts`, `activity.ts`, `finance.ts`, `users.ts`, `vendors.ts` — tidak diubah Section 07.

**Mock state aktif:** `useCurrentUser()`/`usePermissions()` — tidak diubah. Fixture kini sebagian **mutable dalam sesi** (`PARTIES`/`CONTACTS`/`PARTY_ACTIVITIES`) — pertama kalinya di codebase ini fixture bukan read-only murni.

**Formatter dan helper:** `app/utils/attention.ts` — **+`UPCOMING_FOLLOWUP_WINDOW_DAYS`** (14 hari), **+`isFollowUpUpcoming()`**.

**Role behavior aktif:** Akses **buka halaman** CRM (`canView('crm')`) tidak berubah dari Section 05/06 (module-level, mencakup PM/Finance juga). Akses **tulis** (create Prospect/Contact/Activity) memakai pengecualian sempit baru: `canManageParty = Sales atau Super Admin`, didefinisikan lokal di 3 file halaman (bukan composable baru) — lihat `docs/route-and-role-matrix.md` bagian 1.2 catatan Section 07.

## 5. Area Hasil Section Lama yang Harus Dilindungi

- Seluruh shared component, fixture `app/data/*`, type `app/types/*`, constant `app/constants/*` — jangan diubah shape-nya tanpa cross-section impact check.
- `app/pages/projects/[id]/index.vue` — shell 8-tab, LOCKED (D-026/D-027), tidak tersentuh Section 07.
- `NAV_ITEMS`, `useCurrentUser`/`usePermissions` — satu source of truth, tidak diduplikasi.
- **`app/pages/crm/parties/[id]/index.vue` (Party Detail, 5-tab) kini COMPLETED untuk Section 07** — Section 08 (Opportunity dan Quotation) yang membangun `/crm/opportunities/[id]` harus **cross-link balik** ke tab Opportunities Party Detail, bukan membangun struktur Party terpisah.
- **`PARTIES`/`CONTACTS`/`PARTY_ACTIVITIES` kini `reactive()`** — section berikutnya yang menambah field/entitas terkait Party harus melanjutkan pola ini (bukan membuat array biasa baru yang tidak reaktif untuk entitas terkait).
- `PACT-001`–`006` dan `PTY-001`–`004`/`CP-001`–`004` — Section 08/09 harus **mewarisi**, bukan menduplikasi.
- `SectionCard.vue` kini punya slot opsional `#actions` — section berikutnya yang butuh tombol di header SectionCard harus **memakai slot ini**, bukan membuat pola header custom baru.
- Dashboard (`app/pages/index.vue`) — hanya boleh disentuh untuk "integration minimal" terdokumentasi (seperti CI-005 Section 07), bukan restrukturisasi.

## 6. Known Issues dan Validation Status

Divalidasi ulang langsung pada tanggal update dokumen ini:

| Cek | Hasil | Catatan |
|---|---|---|
| `npx nuxi prepare` | **Sukses** | Regenerasi types setelah penambahan type/fixture/component baru |
| `npm run build` | **Sukses** (exit 0) | Dijalankan ulang setelah seluruh perubahan Section 07 |
| Smoke test route (curl, preview server) | **HTTP 200** untuk `/`, `/crm/prospects`, `/crm/clients`, `/crm/parties/PTY-001`, `/crm/parties/PTY-004`, `/crm/parties/PTY-999` (not-found), `/crm/opportunities`, `/settings`, `/projects` | Tidak ada string error/exception; konten nyata terkonfirmasi (nama party, not-found message) muncul di HTML SSR — halaman CRM baru tidak memakai loading-simulation seperti Dashboard, jadi SSR langsung berisi data lengkap |
| `npx vitest run` | **"No test files found", exit code 1** | Pre-existing, bukan regresi |
| `npx nuxi typecheck` | **Gagal — `vue-tsc` tidak terpasang** | Q8 masih belum diselesaikan |
| Lint | **Tidak tersedia** | Q8 masih belum diselesaikan |
| Interactive/hydrated browser check (Dialog create-mock, dsb.) | **Tidak dilakukan** | Tidak ada tool browser headless tersedia; diverifikasi lewat build success + code review manual terhadap kontrak Reka UI Dialog (pola identik dengan `pages/expenses.vue` existing) |

**Known issues terbuka:**
- **Q8 — Tooling lint/typecheck/test.** Tetap `NEEDS_VALIDATION`. Ini section ketiga berturut-turut yang berjalan tanpa lint/typecheck otomatis (Section 06 dan 07). Sangat direkomendasikan diselesaikan sebelum Section 08.
- Bug `handleDelete` di `app/pages/expenses.vue` — belum diperbaiki, tidak tersentuh Section 07.
- `/crm/opportunities` (Section 05) masih menampilkan list polos tanpa grouping-by-stage untuk 3 opportunity pipeline baru — menyusul Section 08.
- Pagination mock untuk Prospects/Clients **sengaja tidak diimplementasikan** — hanya 4-5 baris data saat ini, kontrol pagination akan menjadi affordance kosong tanpa fungsi nyata; akan ditambahkan bila volume data section berikutnya membutuhkan.
- Interactive/hydrated browser verification tidak dilakukan (keterbatasan tooling lingkungan, konsisten dengan Section 06).
- Q7, Q9, Q10, Q11 — tidak berubah.

## 7. Next Recommended Section

Section 08 — Opportunity dan Quotation (`prompts/10-PROMPT-8-OPPORTUNITY-QUOTATION.md`). **Rekomendasi kuat:** selesaikan Q8 (tooling lint/typecheck) sebelum atau di awal Section 08 — tiga section berturut-turut telah berjalan tanpa validasi otomatis penuh. Tidak dieksekusi otomatis — menunggu perintah user.

## 8. Last Updated

- **Date:** 2026-07-29
- **Updater:** Section 07 (CRM Party) execution, berdasarkan pemeriksaan langsung codebase, build/smoke-test yang benar-benar dijalankan ulang.
