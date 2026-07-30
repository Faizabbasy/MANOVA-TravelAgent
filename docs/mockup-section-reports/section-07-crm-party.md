# Section 07 — CRM Party

**Status:** COMPLETED

Dikerjakan berdasarkan `prompts/09-PROMPT-7-CRM-PARTY.md`, dijalankan lewat `prompts/99-RUN-CURRENT-SECTION.md` atas perintah user.

---

## 1. Section Objective dan Scope

Membangun modul CRM — Party: Prospects list, Clients list, Party Detail (Overview/Contacts/Opportunities/Activities/Projects*). Scope eksplisit: Party/customer list dan detail, Prospect list, Client list, Contact person, Activity history, summary opportunity/project, search/filter/sort/pagination mock, create/edit frontend mock, empty/loading/error/not-found states, role behavior.

## 2. Source Documents yang Dibaca

`prompts/01-PROTOKOL WAJIB — CONTINUITY, DOKUMENTASI PER SECTION, DAN PERLINDUNGAN HASIL.md`, `prompts/09-PROMPT-7-CRM-PARTY.md`, `docs/mockup-implementation-state.md`, `docs/mockup-section-progress.md`, `docs/mockup-change-impact-log.md`, `docs/mockup-section-reports/section-05-foundation.md` dan `section-06-dashboard.md`, `docs/route-and-role-matrix.md` (bagian 1.2, 5), `docs/mockup-information-architecture.md` (bagian 3.2, 5), `docs/mockup-data-scenarios.md`.

## 3. Existing Implementation yang Diperiksa

`app/pages/crm/{index,clients,prospects,opportunities}.vue` (shell Section 05), `app/pages/projects/index.vue` dan `app/pages/projects/[id]/index.vue` (pola reuse table dan tab yang secara eksplisit direkomendasikan docs), `app/types/party.ts`, `app/data/parties.ts`, `app/constants/{status,navigation}.ts`, `app/composables/{useCurrentUser,usePermissions}.ts`, `app/components/shared/*`, `app/components/ui/{dialog,select}/*`. `git status`/`git log` diperiksa — bersih kecuali `prompts/99-RUN-CURRENT-SECTION.md` (menunjuk Section 07).

## 4. Decisions yang Digunakan

D-001/D-024 (Party tunggal untuk Prospect/Client), D-002 (Won → Project otomatis, ditegaskan lewat larangan aksi "convert" manual di halaman Clients), D-030 (Role & Access Matrix, granularity modul), D-040 (jam demo tetap `DEMO_REFERENCE_DATE`).

## 5. Implementation Summary dan User Flow

`/crm/prospects` dan `/crm/clients` kini menampilkan data nyata dari satu master `PARTIES` yang sama (filter `lifecycleStatus`), dengan search + sort (Prospects) / search (Clients), dan tombol "Tambah Prospect" (Sales/Super Admin saja) yang membuka dialog form sederhana lalu redirect ke Party Detail baru. `/crm/parties/[id]` adalah halaman detail baru dengan 5 tab: **Overview** (ringkasan + catatan lifecycle), **Contacts** (list + tambah), **Opportunities** (list read-only, belum ada halaman detail — Section 08), **Activities** (list + catat activity baru, termasuk jadwal follow-up), **Projects** (kondisional: hanya tampil bila Client dan punya ≥1 project, cross-link ke `/projects/[id]` yang sudah ada).

**User flow yang bisa didemokan:** login sebagai Sales → buka Prospects → klik "Tambah Prospect" → isi nama → redirect ke Party Detail baru (kosong, siap diisi Contact/Activity) → tambah Contact → tambah Activity dengan jadwal follow-up mendatang → buka Dashboard → widget "Follow-up Mendatang" menampilkan activity yang baru dibuat. Alternatif: buka Party existing (PTY-004, prospect) → lihat riwayat Contacts/Activities/Opportunities yang sudah ada sejak awal.

## 6. Routes

`/crm/prospects` (real), `/crm/clients` (real), `/crm/parties/[id]` (baru).

## 7. Files Created, Changed, dan Removed

**Created:** `app/pages/crm/parties/[id]/index.vue`.

**Changed:**
- `app/pages/crm/prospects.vue`, `app/pages/crm/clients.vue` — rewrite total dari `ModulePlaceholder`.
- `app/pages/index.vue` — +widget "Follow-up Mendatang" (Sales), minimal (lihat CI-005).
- `app/data/parties.ts` — `PARTIES`/`CONTACTS` dibungkus `reactive()`, `+PARTY_ACTIVITIES` (6 seed record) (lihat CI-004).
- `app/data/index.ts` — `+getProjectsByParty`, `+getPartyActivities`, `+getUpcomingFollowUps`, `+createParty`, `+createContact`, `+createPartyActivity`, `+nextSequentialId` (internal).
- `app/types/party.ts` — `+PartyDetailTab`, `+PartyActivityType`, `+PartyActivity`.
- `app/constants/status.ts` — `+PARTY_ACTIVITY_TYPES`.
- `app/constants/navigation.ts` — `comingSoon` dihapus dari item Prospects dan Clients.
- `app/utils/attention.ts` — `+UPCOMING_FOLLOWUP_WINDOW_DAYS`, `+isFollowUpUpcoming()`.
- `app/components/shared/SectionCard.vue` — `+slot #actions` opsional (lihat CI-006).

**Removed:** Tidak ada.

## 8. Components Reused dan Created

**Reused:** `SectionCard`, `EmptyState`, `RoleAccessState`, `StatusBadge`, `DetailMetadataList`, `PageHeader`, `Tabs`/`TabsList`/`TabsTrigger`/`TabsContent` (pola dari Project Detail), `Table`/`TableHeader`/`TableRow`/`TableCell`/`TableEmpty`, `Dialog`/`DialogTrigger`/`DialogContent`/`DialogHeader`/`DialogTitle`/`DialogDescription`/`DialogFooter` (pola dari `pages/expenses.vue`), `Label`, `Input`, `Button`. Native `<select>` untuk sort (pola dari `pages/projects/index.vue`).

**Created:** Tidak ada file komponen baru — `SectionCard.vue` diperluas (bukan komponen baru), lihat bagian 7.

## 9. Types, Constants, Fixtures, dan Mock State

`Party`/`ContactPerson` — tidak ada breaking change. `PartyActivity` — entitas baru, scoped ke Party (berbeda dari `ActivityEntry` yang scoped ke Project). `PARTY_ACTIVITY_TYPES` — 5 kategori dengan tone/order konsisten pola `StatusOption`. Fixture `PARTIES`/`CONTACTS`/`PARTY_ACTIVITIES` kini `reactive()` — **pertama kalinya di codebase ini fixture bukan read-only murni**; `createParty`/`createContact`/`createPartyActivity` menghasilkan ID sekuensial (`PTY-005`, dst.) via helper `nextSequentialId`, dengan `createdAt` memakai `DEMO_REFERENCE_DATE` tetap (bukan `new Date()`), konsisten D-040.

## 10. Responsive Behavior

Mengikuti pola grid/flex responsif yang sama dengan `pages/projects/index.vue` (`flex-col sm:flex-row` untuk filter bar, `grid-cols-1 sm:grid-cols-2` untuk form dialog). Tidak diverifikasi lewat browser interaktif (lihat bagian 13/17) — hanya lewat kelas Tailwind yang identik dengan pola existing yang sudah tervalidasi.

## 11. Loading, Empty, Error, Not-Found, dan Unauthorized States

- **Loading:** Tidak ada simulasi loading — mengikuti precedent Section 05 untuk halaman list/detail non-Dashboard (`/projects`, `/crm/opportunities`, Project Detail juga tidak memakai `LoadingState`); data fixture dibaca sinkron, SSR langsung berisi konten lengkap (dikonfirmasi lewat curl, bagian 13).
- **Empty:** Prospects/Clients menampilkan pesan berbeda untuk "belum ada data" vs "tidak cocok dengan pencarian". Tab Contacts/Opportunities/Activities/Projects di Party Detail masing-masing punya `EmptyState` sendiri.
- **Error:** Tidak ada state error tersimulasi baru — sama seperti Section 06, tidak ada sumber data async yang bisa gagal pada mock frontend murni ini; `ErrorState.vue` tetap tersedia, tidak dipaksakan dipakai tanpa trigger kegagalan nyata.
- **Not-found:** Party Detail menampilkan not-found state (ikon `FileX`, pesan berisi ID yang dicari, tombol kembali ke `/crm`) untuk ID tidak dikenal — dikonfirmasi via smoke test `/crm/parties/PTY-999`.
- **Unauthorized:** `RoleAccessState` untuk role tanpa `crm:VIEW`. Aksi tulis (create Prospect/Contact/Activity) disembunyikan total (bukan ditampilkan-lalu-diblokir) untuk role selain Sales/Super Admin, via `canManageParty`.

## 12. Role Behavior

**Akses buka halaman** (`canView('crm')`, module-level, D-030) — mencakup Sales/Management/PM/Finance/Super Admin/Viewer (siapa pun dengan `crm ≥ VIEW`), sedikit lebih luas dari tabel per-route docs bagian 1.2 karena PM/Finance memegang `crm:VIEW` di level modul (untuk konteks Project/Invoice yang mereferensikan Party). **Akses tulis** (create Prospect/Contact/Activity) memakai `canManageParty = Sales atau Super Admin` — pengecualian sempit yang presisi sesuai docs bagian 1.2 (termasuk **mengecualikan Management**, meski `ROLE_MODULE_ACCESS.management.crm = 'APPROVE'` yang secara rank generik akan lolos `canManage('crm')` — didokumentasikan sebagai keputusan sengaja di `docs/route-and-role-matrix.md` bagian 1.2, bukan bug).

## 13. Validation Commands dan Hasilnya

- `npx nuxi prepare` — sukses.
- `npm run build` — **sukses (exit 0)**.
- `npx vitest run` — "No test files found", exit code 1 (pre-existing).
- `npx nuxi typecheck` — gagal, `vue-tsc` tidak terpasang (Q8, pre-existing).
- Lint — tidak tersedia (Q8, pre-existing).
- Smoke test manual (curl, preview server): `/`, `/crm/prospects`, `/crm/clients`, `/crm/parties/PTY-001`, `/crm/parties/PTY-004`, `/crm/parties/PTY-999`, `/crm/opportunities`, `/settings`, `/projects` — **seluruhnya HTTP 200**.
- Verifikasi konten: `PTY-001` detail menampilkan "PT Cipta Distribusi Nusantara" (3x, header+breadcrumb+badge), `PTY-999` menampilkan "Party tidak ditemukan", `/crm/prospects` menampilkan "PT Melati Wisata Kreasi", `/crm/clients` menampilkan seluruh 3 nama client — dikonfirmasi lewat SSR HTML langsung (bukan menunggu hydration, berbeda dari Dashboard).
- **Interactive/hydrated browser verification (Dialog create-mock, dsb.) — tidak dilakukan.** Tidak ada tool browser headless tersedia di lingkungan eksekusi ini. Diverifikasi lewat: build success (Vue SFC compiler akan gagal pada binding/slot yang salah), kesesuaian pola Dialog dengan `pages/expenses.vue` yang sudah terbukti berfungsi, dan code review manual terhadap kontrak props Reka UI (`v-model:open`, `as-child`).

## 14. Regression Checks

`/crm` (overview, consumer `PARTIES`/`OPPORTUNITIES`/`QUOTATIONS`), `/crm/opportunities` (consumer `PARTIES` via `getPartyById`), `/` (Dashboard, consumer `PARTIES` di beberapa widget) — seluruhnya tetap HTTP 200 dan menampilkan data yang sama seperti sebelum Section 07 (perubahan `PARTIES`/`CONTACTS` ke `reactive()` bersifat backward-compatible untuk operasi baca). `SectionCard` dipakai di banyak halaman (Dashboard, `/projects`, Project Detail) — smoke test seluruh halaman tersebut tetap HTTP 200 setelah penambahan slot `#actions` opsional.

## 15. Cross-Section Impact

`docs/mockup-change-impact-log.md`: **CI-004** (fixture Party jadi reactive + `PartyActivity`, milik Section 05), **CI-005** (widget Dashboard Follow-up Mendatang, milik Section 06), **CI-006** (`SectionCard` slot `#actions`, milik Section 05).

## 16. Review URLs

Tidak tersedia — lingkungan pengembangan lokal saja.

## 17. Known Issues dan Deferred Work

- **Q8 (tooling lint/typecheck/test) masih terbuka** — section ketiga berturut-turut (06, 07) berjalan tanpa validasi otomatis penuh. Sangat direkomendasikan diselesaikan sebelum Section 08.
- Interactive/hydrated browser verification tidak dilakukan (keterbatasan tooling lingkungan).
- Pagination mock untuk Prospects/Clients **sengaja tidak dibuat** — hanya 4–5 baris data, kontrol pagination akan jadi affordance kosong tanpa fungsi nyata pada volume data saat ini. Akan ditambahkan bila section berikutnya menambah cukup banyak Party.
- `/crm/opportunities` (Section 05) belum menampilkan grouping-by-stage untuk 3 opportunity pipeline baru (`OPP-005`–`007`) — tetap tampil sebagai list polos; penyempurnaan tampilan menyusul Section 08.
- Detail halaman Opportunity mandiri (`/crm/opportunities/[id]`) belum ada — tab Opportunities di Party Detail read-only, tidak ada link yang bisa diklik ke detail (sesuai batasan, itu scope Section 08).

## 18. Protection Notes untuk Section Berikutnya

- Jangan membuat entitas Party/Contact/Activity paralel — pakai `PARTIES`/`CONTACTS`/`PARTY_ACTIVITIES` dan selector `app/data/index.ts` yang sudah ada.
- `PARTIES`/`CONTACTS`/`PARTY_ACTIVITIES` kini `reactive()` — bila section berikutnya menambah entitas terkait Party yang butuh create-mock, ikuti pola yang sama (bukan array biasa).
- `canManageParty` (Sales/Super Admin) didefinisikan lokal di 3 file (`prospects.vue`, `parties/[id]/index.vue`) — bila Section 08/09 butuh pengecualian serupa untuk Opportunity, pertimbangkan pola yang sama (bukan menambah cabang baru ke `usePermissions()` generik).
- `SectionCard.vue` kini punya slot `#actions` — pakai ini untuk tombol header, jangan bikin pola custom baru.
- Party Detail (`/crm/parties/[id]`) kini COMPLETED untuk Section 07 — Section 08 yang membangun `/crm/opportunities/[id]` harus menaut balik ke Party Detail (via `partyId`), bukan mendirikan struktur Party terpisah.
- `PACT-001`–`006` — Section 08/14 boleh memperluas array ini bila butuh lebih banyak activity, mengikuti pola ID yang sama.

## 19. Recommended Next Section

Section 08 — Opportunity dan Quotation (`prompts/10-PROMPT-8-OPPORTUNITY-QUOTATION.md`), dengan rekomendasi kuat menyelesaikan Q8 (tooling lint/typecheck) terlebih dahulu — tiga section berturut-turut telah berjalan tanpa validasi otomatis penuh. Tidak dieksekusi otomatis — menunggu perintah user.
