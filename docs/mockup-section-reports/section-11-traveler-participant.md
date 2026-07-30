# Section 11 — Traveler and Participant

**Status:** COMPLETED

Dikerjakan berdasarkan `prompts/13-PROMPT-11-TRAVELER-PARTICIPANT.md`, dijalankan lewat `prompts/99-RUN-CURRENT-SECTION.md` atas perintah user.

---

## 1. Section Objective dan Scope

Mengisi tab "Travelers" pada Project Detail (baseline Foundation sejak Section 05, belum diisi detail penuh) dengan: traveler/participant list dan profile, group dan rooming list, passport/travel document metadata, emergency contact dan special request, missing document indicator, add/edit/remove/import mock, filter/states/role behavior. **Tidak mengerjakan** tab lain (Itinerary & Services, Vendors, Finance, Tasks, Documents, Activity & Changes — tetap baseline Foundation, menyusul Section 12-15), tidak mengubah struktur 8-tab/single-route, dan tidak mengubah Overview lebih dari yang benar-benar diperlukan (pada akhirnya: Overview **tidak disentuh sama sekali**, opsi paling minimal yang tersedia).

## 2. Source Documents yang Dibaca

`prompts/01-PROTOKOL WAJIB — CONTINUITY, DOKUMENTASI PER SECTION, DAN PERLINDUNGAN HASIL.md`, `prompts/13-PROMPT-11-TRAVELER-PARTICIPANT.md`, `CLAUDE.md`, seluruh `docs/*.md` (implementation-state, section-progress, change-impact-log, data-scenarios, design-decisions, information-architecture, open-questions, scope, route-and-role-matrix, template-reuse-mapping, template-audit), `docs/mockup-section-reports/section-05-foundation.md` s/d `section-10-project-core.md`, source code aktual (`app/types/project.ts`, `app/data/projects.ts`, `app/data/index.ts`, `app/constants/status.ts`, `app/utils/attention.ts`, `app/utils/format.ts`, `app/composables/usePermissions.ts`, `app/composables/useCurrentUser.ts`, `app/pages/projects/[id]/index.vue`, `app/pages/crm/prospects.vue`, `app/pages/crm/parties/[id]/index.vue` sebagai pola CRUD/dialog reference), `git status`.

## 3. Existing Implementation yang Diperiksa

Tab "Travelers" (`app/pages/projects/[id]/index.vue`) sejak Section 05 hanya menampilkan `TravelerGroup[]` (nama + paxCount) dan daftar `specialRequest` datar, dibaca dari `TRAVELERS`/`TRAVELER_GROUPS` (`app/data/projects.ts`) — array biasa (bukan `reactive()`), hanya 1 baris traveler (`TRV-1031`, PRJ-103, wheelchair) untuk seluruh 3 skenario. Tidak ada field dokumen/kontak darurat, tidak ada rooming list eksplisit, tidak ada CRUD. Pola CRUD create-mock existing (Contact/Activity di `crm/parties/[id]/index.vue`, Prospect di `crm/prospects.vue`) dipakai sebagai referensi Dialog+Label+Input+`reactive()` mutator; pola narrow role-carve-out (`canManageParty`) dipakai sebagai referensi `canManageTravelers`. `git log`/`git status` dikonfirmasi bersih, commit terakhir `2650015 "SECTION10-Project-Core"`.

## 4. Decisions yang Digunakan

D-026/D-027 (8-tab, single-route, LOCKED — tidak disentuh), D-030 (Role & Access Matrix — PM `MANAGE`, Management `APPROVE` khusus perubahan besar/cancel, dipakai sebagai dasar `canManageTravelers`), D-006 (larangan fabrikasi integrasi nyata — diterapkan pada desain "Import (Mock)"), D-038 (sentralisasi status constants — `ROOM_TYPES` ditambahkan ke `app/constants/status.ts`, bukan hardcode lokal).

## 5. Implementation Summary dan User Flow

Tab Travelers ditulis ulang total (sebelumnya baseline minimal) menjadi modul traveler penuh:
- **List dan profile:** tabel traveler (nama, group, dokumen paspor, kontak darurat, special request, status dokumen), profil lengkap dapat dilihat/diedit lewat dialog yang sama dengan form tambah.
- **Group dan rooming list:** kartu ringkasan per group (nama, paxCount, `roomingNote` — mis. "5 kamar twin (10 pax)") plus daftar "Rooming List" konkret (`ROOM_ASSIGNMENTS`, entitas baru) yang memetakan traveler bernama ke kamar spesifik untuk 3 group PRJ-103.
- **Passport/travel document metadata:** `passportNumber`/`passportExpiryDate` per traveler (field baru).
- **Emergency contact dan special request:** `emergencyContactName`/`emergencyContactPhone` (field baru), `specialRequest` (sudah ada sejak Foundation).
- **Missing document indicator:** `isTravelerDocumentMissing()` (baru, `app/utils/attention.ts`) — true bila nomor/tanggal expiry paspor kosong, ATAU sisa masa berlaku paspor pada tanggal keberangkatan project < 180 hari (`PASSPORT_EXPIRY_WARNING_DAYS`). Ditampilkan sebagai badge "Dokumen Belum Lengkap"/"Dokumen Lengkap" per baris, plus toggle filter "Hanya dokumen belum lengkap".
- **Add/edit/remove/import mock:** dialog tambah/edit (nama, group, paspor, kontak darurat, special request), tombol hapus dengan dialog konfirmasi, tombol "Import (Mock)" yang mensimulasikan hasil import 3 baris traveler dengan data dokumen kosong (butuh dilengkapi manual — merefleksikan kondisi realistis hasil import massal).
- **Filter:** search nama, filter per group (termasuk "Tanpa Group"), toggle dokumen belum lengkap.
- **States:** empty state penuh ("Belum ada traveler tercatat") bila 0 traveler; `TableEmpty` khusus bila filter tidak menghasilkan baris meski data ada.
- **Role behavior:** `canManageTravelers` (Project Manager, Super Admin) menggerbangi seluruh aksi tulis (tambah/edit/hapus/import); role lain (termasuk Management, Sales, role sub-domain operasional) hanya melihat, konsisten dengan D-030 bagian 5 (Management `APPROVE` khusus perubahan besar/cancel project, bukan CRUD traveler rutin).

**User flow yang bisa didemokan:** buka `/projects/PRJ-102?tab=travelers` sebagai Super Admin → lihat 6 traveler, 2 di antaranya berlabel "Dokumen Belum Lengkap" (satu karena belum mengisi paspor sama sekali, satu karena paspor kurang dari 6 bulan berlaku saat keberangkatan) → toggle "Hanya dokumen belum lengkap" → hanya 2 baris tersisa → klik "Tambah Traveler" → isi nama saja → simpan → toast "Traveler Ditambahkan" → baris baru langsung muncul di tabel dengan badge "Dokumen Belum Lengkap" (karena field paspor kosong) → klik "Import (Mock)" → 3 baris baru muncul sekaligus dengan toast yang menjelaskan ini simulasi → beralih ke `/projects/PRJ-103?tab=travelers` → lihat 3 kartu group dengan `roomingNote`, dan Rooming List menampilkan penugasan kamar konkret (mis. "Suite VIP 1 — Dedi Kurniawan, Reza Firmansyah").

## 6. Routes

Tidak ada route baru. `/projects/[id]` (Section 05, tab Travelers) diisi penuh.

## 7. Files Created, Changed, dan Removed

**Created:** `docs/mockup-section-reports/section-11-traveler-participant.md` (dokumen ini).

**Changed:**
- `app/types/project.ts` — `Traveler` +`passportNumber`/`passportExpiryDate`/`emergencyContactName`/`emergencyContactPhone`; `TravelerGroup` +`roomingNote`; +`RoomType`, +`RoomAssignment`.
- `app/data/projects.ts` — `TRAVELER_GROUPS`/`TRAVELERS` dibungkus `reactive()`; fixture traveler diperluas dari 1 baris menjadi 18 baris (6 per skenario utama); +`ROOM_ASSIGNMENTS` (3 baris, PRJ-103).
- `app/data/index.ts` — +`getTravelersByGroup`, `+getRoomAssignments`, `+getTravelersMissingDocuments`, `+createTraveler`, `+updateTraveler`, `+removeTraveler`, `+importTravelersMock`; export `+ROOM_ASSIGNMENTS`.
- `app/utils/attention.ts` — +`PASSPORT_EXPIRY_WARNING_DAYS`, `+isTravelerDocumentMissing`.
- `app/constants/status.ts` — +`ROOM_TYPES`.
- `app/pages/projects/[id]/index.vue` — tab Travelers ditulis ulang total (filter/search/CRUD/rooming list); tab lain **tidak diubah** (diverifikasi smoke test, bagian 13).

**Removed:** Tidak ada.

## 8. Components Reused dan Created

**Reused:** `Dialog`/`DialogTrigger`/`DialogContent`/`DialogHeader`/`DialogTitle`/`DialogDescription`/`DialogFooter`, `Label`, `Input`, `Button`, `Table`/`TableHeader`/`TableRow`/`TableHead`/`TableBody`/`TableCell`/`TableEmpty`, `SectionCard` (+`#actions`), `StatusBadge`, `EmptyState`, `useToast`/`ToastContainer` (Section 09) — seluruhnya dipakai apa adanya, mengikuti pola CRUD Contact/Activity (Section 07). `Checkbox` (`ui/checkbox`) — **pemakaian nyata pertama** di halaman MANOVA manapun (sebelumnya hanya ada di `pages/tasks.vue`/`expenses.vue` lama, tidak ditautkan navigasi).

**Created:** Tidak ada file komponen baru — seluruh UI baru ditulis inline di `projects/[id]/index.vue` (konsisten dengan tab lain yang juga tidak diekstrak jadi komponen terpisah).

## 9. Types, Constants, Fixtures, dan Mock State

Lihat bagian 7 di atas dan `docs/mockup-change-impact-log.md` (CI-013) untuk detail lengkap. Ringkasan fixture baru: 17 traveler baru (`TRV-1011`–`1016`, `TRV-1021`–`1026`, `TRV-1032`–`1036`) + 1 traveler existing diperkaya (`TRV-1031`), 3 `RoomAssignment` baru (`ROOM-001`–`003`), `roomingNote` pada 3 `TravelerGroup` existing. Sampel representatif, bukan 1:1 dengan `travelerCount` — didokumentasikan di `docs/mockup-data-scenarios.md` bagian 4e.

## 10. Responsive Behavior

Filter row: `flex-col sm:flex-row` (search+select+checkbox menumpuk di layar sempit). Group summary cards: `grid-cols-1 sm:grid-cols-3`. Form dialog: `grid-cols-1 sm:grid-cols-2`. Tabel traveler memakai `Table` primitive yang sudah membungkus `overflow-auto` (scroll horizontal otomatis di layar sempit untuk 6-7 kolom). Tidak diverifikasi lewat browser interaktif — tidak ada tool headless browser tersedia di lingkungan ini (konsisten keterbatasan sejak Section 06); kelas Tailwind konsisten dengan pola responsive existing.

## 11. Loading, Empty, Error, Not-Found, dan Unauthorized States

- **Loading:** Tidak ada simulasi baru — konsisten precedent (data lokal sinkron, tidak ada async fetch).
- **Empty:** `EmptyState` penuh bila `travelers.length === 0` (skenario hipotetis, tidak terjadi pada 3 project demo saat ini karena seluruhnya sudah punya sampel); `TableEmpty` khusus bila filter aktif menghasilkan 0 baris meski data ada (diverifikasi: toggle "Hanya dokumen belum lengkap" pada PRJ-101 — yang seluruh travelernya berdokumen lengkap — akan menampilkan pesan ini, walau tidak di-screenshot langsung, logic-nya diverifikasi lewat code review dan konsisten dengan pola `rows.length === 0` di `crm/prospects.vue`).
- **Error:** Tidak ada state error tersimulasi baru — konsisten precedent, tidak ada sumber async yang bisa gagal.
- **Not-found:** Tidak berubah dari Section 05 — diverifikasi ulang tetap benar (`PRJ-999`).
- **Unauthorized:** `RoleAccessState` untuk `!canView('project')` — tidak berubah (gerbang halaman, bukan gerbang tab).

## 12. Role Behavior

`canView('project')` (module-level, sejak Section 05) tetap gerbang akses halaman. **Baru:** `canManageTravelers` (Project Manager, Super Admin) — pengecualian sempit yang sama polanya dengan `canManageParty` (Section 07): akses modul `project` generik (`canManage('project')`) akan meloloskan Management karena rank `APPROVE` > `MANAGE`, padahal `docs/route-and-role-matrix.md` bagian 5 memberi Management `APPROVE` khusus untuk "perubahan besar/cancel project", bukan CRUD rutin traveler — didokumentasikan sebagai klarifikasi implementasi di `docs/route-and-role-matrix.md` bagian 1.3, bukan mekanisme role-check baru.

## 13. Validation Commands dan Hasilnya

- `npx nuxi prepare` — **sukses**.
- `npm run build` — **sukses (exit 0)**.
- `npx vitest run` — "No test files found" (pre-existing, Q8).
- `npx nuxi typecheck` — gagal, `vue-tsc` tidak terpasang (Q8, pre-existing).
- Lint — tidak tersedia (Q8, pre-existing).
- **Smoke test konten mendalam** (curl + grep, bukan hanya status code — disiplin sejak Section 08):
  - `/projects/PRJ-101?tab=travelers`, `PRJ-102`, `PRJ-103` — seluruhnya HTTP 200.
  - PRJ-101: 6 traveler bernama tampil (mis. "Hendra Wijaya", "Nadia Puspita"), seluruhnya berlabel "Dokumen Lengkap" (6/6) — cocok dengan skenario "berjalan mulus".
  - PRJ-102: "Sarah Amelia", "Yusuf Maulana", "Indah Permatasari" tampil; **2 baris "Dokumen Belum Lengkap"**, 4 "Dokumen Lengkap" — cocok persis dengan fixture (1 paspor expiring, 1 belum diisi sama sekali).
  - PRJ-103: "Dedi Kurniawan" dan "Membutuhkan akses kursi roda" tampil; 3 nama group (Management/Sales Team/Partner-VIP) muncul di filter dropdown; "Rooming List" section tampil dengan label kamar "Twin 101"/"Twin 205"/"Suite VIP 1"; 1 baris "Dokumen Belum Lengkap" (Taufik Hidayat), 5 "Dokumen Lengkap".
  - Tombol "Import (Mock)" dan "Tambah Traveler" terkonfirmasi ter-render (role default demo = Super Admin, `canManageTravelers` true).
  - Tidak ditemukan string "Internal Server Error"/"TypeError"/"is not defined" di HTML manapun.
  - **Regresi tab lain** — `?tab=itinerary-services` (PRJ-103: Flight Batch 1/2, Ground Transportation, Venue tetap tampil), `?tab=finance` (PRJ-102: INV-1021/1022 tetap tampil) — konten identik dengan sebelum Section 11, Overview **tidak disentuh sama sekali**.
- **Verifikasi interaktif** (klik dialog tambah/edit/hapus, toggle filter, ganti role lewat `/settings` lalu cek tombol aksi hilang) **tidak dilakukan** — tidak ada tool browser headless di lingkungan ini (keterbatasan konsisten sejak Section 06). Dimitigasi lewat code review ketat terhadap `canManageTravelers`, `filteredTravelers`, dan mutator `app/data/index.ts` (pola identik dengan CRUD Section 07/09 yang sudah terverifikasi konten-nya).

## 14. Regression Checks

Section 05 (shell 8-tab, tidak diubah strukturnya), Section 10 (Overview tab, tidak disentuh sama sekali — dikonfirmasi lewat smoke test `?tab=overview` menampilkan konten identik), Section 06 (Dashboard, tidak membaca `TRAVELERS`/`TRAVELER_GROUPS`, tidak terdampak) — seluruhnya diverifikasi tidak beregresi.

## 15. Cross-Section Impact

**Satu entri baru:** CI-013 (`docs/mockup-change-impact-log.md`) — perluasan `Traveler`/`TravelerGroup` (Section 05) menjadi `reactive()` dengan field baru, dan entitas baru `RoomAssignment`. Konsisten dengan kriteria protokol bagian C (dibutuhkan untuk integrasi/pengisian scope Section 11 yang memang direncanakan sejak awal untuk tab ini).

## 16. Review URLs

Tidak tersedia — lingkungan pengembangan lokal saja (`npm run dev` / `node .output/server/index.mjs`, tidak ada deployment publik).

## 17. Known Issues dan Deferred Work

- **Q8 (tooling lint/typecheck/test) masih terbuka** — **tujuh section berturut-turut** (06–11) berjalan tanpa validasi otomatis penuh.
- CRUD group (tambah/edit/hapus `TravelerGroup`) **sengaja tidak diimplementasikan** — hard rule scope literal hanya menyebut "Add/edit/remove/import mock" untuk traveler/participant; 3 group demo existing (PRJ-103) sudah cukup mendemonstrasikan konsep. Traveler baru dapat di-assign ke group existing lewat dropdown, tapi tidak dapat membuat group baru dari UI.
- Profil traveler bernama tetap sampel representatif (6/6/6 dari 6/18/60) — bukan sensus penuh 1:1 dengan `travelerCount`, didokumentasikan transparan (bukan gap tersembunyi), konsisten dengan pola efisiensi fixture yang sudah dipakai sejak Foundation.
- Rooming list (`ROOM_ASSIGNMENTS`) hanya mencakup traveler bernama yang datanya tercatat (3 kamar contoh), bukan seluruh kapasitas fisik 5+13+2 kamar yang disebut `roomingNote` — narasi ringkas (`roomingNote`) tetap mencerminkan angka lengkap dari `docs/mockup-data-scenarios.md`.
- Verifikasi interaktif (klik dialog, toggle filter, ganti role) tidak dilakukan langsung (keterbatasan tooling lingkungan, konsisten sejak Section 06).
- `project.travelerCount` tidak disinkronkan otomatis saat traveler ditambah/dihapus dari UI — keduanya sengaja dianggap konsep terpisah (headcount resmi skenario demo vs profil tercatat bertahap), didokumentasikan di komentar `app/data/projects.ts` dan `app/data/index.ts`.

## 18. Protection Notes untuk Section Berikutnya

- Tab Travelers kini sumber lengkap untuk traveler/participant/group/rooming — Section 12 (Itinerary and Operations) dan section berikutnya **tidak perlu** menduplikasi ringkasan traveler di tab lain; cukup rujuk balik bila relevan (mis. jumlah pax untuk kebutuhan operasional).
- `Traveler`/`TravelerGroup`/`RoomAssignment` di `app/types/project.ts` dan `app/data/projects.ts` — jangan diubah shape-nya tanpa cross-section impact check; gunakan selector/mutator existing di `app/data/index.ts` (`getTravelers`, `getTravelerGroups`, `getRoomAssignments`, `createTraveler`, `updateTraveler`, `removeTraveler`, `importTravelersMock`).
- `canManageTravelers` (narrow role-carve-out PM/Super Admin) — pola yang sama sebaiknya diikuti bila section berikutnya butuh gerbang tulis serupa di tab lain Project Detail (Itinerary & Services untuk role sub-domain, dst.), bukan mengandalkan `canManage('project')` generik yang terlalu longgar untuk Management.
- Overview tab (Section 10) **tidak disentuh** — bila section mendatang ingin menambah ringkasan traveler di Overview, itu adalah keputusan baru yang harus dicatat sebagai cross-section impact, bukan default.

## 19. Recommended Next Section

Section 12 — Itinerary and Operations (`prompts/14-PROMPT-12-ITINERARY-OPERATIONS.md`), dengan rekomendasi sangat kuat menyelesaikan Q8 terlebih dahulu — tujuh section berturut-turut telah berjalan tanpa validasi otomatis penuh. Tidak dieksekusi otomatis — menunggu perintah user.
