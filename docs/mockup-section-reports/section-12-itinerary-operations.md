# Section 12 — Itinerary and Operations

**Status:** COMPLETED

Dikerjakan berdasarkan `prompts/14-PROMPT-12-ITINERARY-OPERATIONS.md`, dijalankan lewat `prompts/99-RUN-CURRENT-SECTION.md` atas perintah user.

---

## 1. Section Objective dan Scope

Mengisi tab "Itinerary & Services" pada Project Detail (baseline Foundation sejak Section 05 — flat table tanpa booking reference/daily itinerary/role granularity) dengan: daily itinerary, conditional sub-section Flight/Hotel/Transportation/MICE/Additional Service, booking/reference mock, service status dan readiness, operational tasks, timeline/list pattern (bukan komponen kalender baru), change markers untuk High-Change Project, states, dan role behavior granular per sub-domain. **Tidak mengerjakan** tab lain (Vendors, Finance — tetap baseline Foundation, menyusul Section 13-15), tidak mengubah struktur 8-tab/single-route, tidak menyentuh Overview/Travelers (Section 10/11).

## 2. Source Documents yang Dibaca

`prompts/01-PROTOKOL WAJIB — CONTINUITY, DOKUMENTASI PER SECTION, DAN PERLINDUNGAN HASIL.md`, `prompts/14-PROMPT-12-ITINERARY-OPERATIONS.md`, `CLAUDE.md`, seluruh `docs/*.md` (implementation-state, section-progress, change-impact-log, data-scenarios, design-decisions, information-architecture, open-questions, scope, route-and-role-matrix, template-reuse-mapping), `docs/mockup-section-reports/section-05-foundation.md` s/d `section-11-traveler-participant.md`, source code aktual (`app/types/project.ts`, `app/data/projects.ts`, `app/data/index.ts`, `app/constants/status.ts`, `app/utils/attention.ts`, `app/utils/format.ts`, `app/composables/usePermissions.ts`, `app/pages/projects/[id]/index.vue`), `git status`/`git log`.

## 3. Existing Implementation yang Diperiksa

Tab "Itinerary & Services" sejak Section 05 hanya menampilkan satu tabel flat (`Jenis Layanan`/`Detail`/`Vendor`/`Status`) dari `getProjectServices(project.id)` — tidak dikelompokkan per tipe layanan (D-039 belum direalisasikan penuh), tidak ada booking reference, tidak ada daily itinerary, tidak ada operational task preview, tidak ada role granularity (murni gerbang `canView('project')` di level halaman). `PROJECT_SERVICES` array biasa (bukan `reactive()`). Tidak ada komponen Timeline/Calendar/Kanban tersisa di codebase (dihapus/diganti sejak Section 05) — dikonfirmasi tidak ada `dashboard/ProjectsTable.vue` dkk. yang relevan untuk pola ini. `git log`/`git status` dikonfirmasi bersih, commit terakhir `14b6106 "SECTION13-Traveler-Participant"`.

## 4. Decisions yang Digunakan

D-026/D-027 (8-tab, single-route, LOCKED — tidak disentuh), D-029 (Service Status generik, dipakai apa adanya), D-030 (Role & Access Matrix bagian 5 — direalisasikan presisi per sub-domain, bukan pengecualian sempit tunggal seperti Section 11), D-036 (kebijakan penambahan package — tidak ada library kalender dipasang, daily itinerary tetap list/divide-y), D-038 (sentralisasi status constants — `SERVICE_TYPES` diperluas di `app/constants/status.ts`, bukan hardcode), D-039 (conditional service sections, direalisasikan penuh sebagai sub-section terpisah per tipe).

## 5. Implementation Summary dan User Flow

Tab Itinerary & Services ditulis ulang total (sebelumnya satu tabel flat) menjadi:
- **Daily itinerary:** list dikelompokkan per tanggal (`ITINERARY_ITEMS`, entitas baru), menampilkan waktu, judul, deskripsi, referensi group (bila ada, memakai ID `TravelerGroup` existing dari Section 11 — konsisten, bukan data baru), dan badge tipe layanan terkait.
- **Conditional service sections:** satu `SectionCard` per tipe layanan yang benar-benar dipakai project (`project.serviceScope`), plus section "Additional Service" bila ada baris service bertipe itu (data-driven, terpisah dari klasifikasi 4-tipe resmi). Tidak pernah menampilkan section untuk tipe yang tidak dipakai (hard rule).
- **Booking/reference mock:** kolom "Booking Reference" per service (mock nomor referensi manual, bukan hasil integrasi API nyata).
- **Service status dan readiness:** tiap section menampilkan fraksi readiness ("X dari Y layanan siap (Confirmed/Completed)"); status per service dapat diubah lewat dropdown (hanya untuk role yang berwenang pada tipe tsb).
- **Operational tasks:** preview 5 task pertama (reuse `getTasksByProject`, sumber data sama dengan tab Tasks — tidak duplikasi), tombol "Lihat Semua Task" berpindah ke tab Tasks.
- **Change markers:** badge "Perlu Ditinjau" pada service berstatus `changed`; banner "Penanda Perubahan" di puncak tab (hanya tampil untuk project `characteristic: high-change` dengan minimal 1 service `changed`), dengan tombol ke tab Activity & Changes.
- **Role behavior granular:** `canManageServiceType(type)` — PM/Operations/Super Admin mengelola seluruh sub-section; Ticketing/Accommodation/Transportation/MICE hanya sub-section domainnya sendiri (Flight/Hotel/Transportation/MICE); role lain read-only.
- **States:** empty state per section (`TableEmpty`) bila 0 service untuk tipe tsb; empty state penuh bila project tidak punya service sama sekali; empty state daily itinerary bila kosong.

**User flow yang bisa didemokan:** buka `/projects/PRJ-102?tab=itinerary-services` (High-Change Project) sebagai Super Admin → banner "Penanda Perubahan" tampil (1 service `changed`: Room Block A) → lihat daily itinerary 5 hari (termasuk "Check-in Hotel" pasca upgrade kamar) → section Flight dan Hotel tampil (sesuai `serviceScope`), section Transportation/MICE tidak muncul sama sekali → klik dropdown status Room Block A, ubah ke "Confirmed" → toast "Status Layanan Diperbarui" → badge "Perlu Ditinjau" hilang, banner otomatis hilang (0 service `changed` tersisa) → beralih ke `?tab=overview` → Service Summary (Section 10) otomatis merefleksikan status baru tanpa reload (data sama, computed generik) → ganti role ke Ticketing (via `/settings`) → kembali ke tab ini → dropdown "Update Status" hanya muncul di section Flight, section Hotel jadi read-only.

## 6. Routes

Tidak ada route baru. `/projects/[id]` (tab `itinerary-services`) diisi penuh.

## 7. Files Created, Changed, dan Removed

**Created:** `docs/mockup-section-reports/section-12-itinerary-operations.md` (dokumen ini).

**Changed:**
- `app/types/project.ts` — `ServiceTypeKey` +`'additional'`; `ProjectService` +`bookingReference`; +`ItineraryItem`.
- `app/data/projects.ts` — `PROJECT_SERVICES` dibungkus `reactive()`, +`bookingReference` pada 5 baris existing, +`SVC-1036` (tipe `additional`, PRJ-103); +`ITINERARY_ITEMS` (15 baris lintas 3 skenario).
- `app/data/index.ts` — +`getItineraryItems`, `+updateServiceStatus`; export `+ITINERARY_ITEMS`.
- `app/constants/status.ts` — `SERVICE_TYPES` +`additional`.
- `app/utils/format.ts` — +`formatDayLabel`.
- `app/pages/projects/[id]/index.vue` — tab Itinerary & Services ditulis ulang total; tab lain **tidak diubah** (diverifikasi smoke test, bagian 13).

**Removed:** Tidak ada.

## 8. Components Reused dan Created

**Reused:** `SectionCard` (+`#actions`), `Table*`/`TableEmpty`, `StatusBadge`, `EmptyState`, `Button`, `useToast`/`ToastContainer` — seluruhnya dipakai apa adanya. Pola list `divide-y divide-border` (dipakai luas sejak Foundation, mis. tab Activity & Changes) direuse untuk daily itinerary, bukan komponen kalender/timeline baru (tidak ada library kalender terpasang).

**Created:** Tidak ada file komponen baru — konsisten dengan tab lain yang juga tidak diekstrak jadi komponen terpisah.

## 9. Types, Constants, Fixtures, dan Mock State

Lihat bagian 7 di atas dan `docs/mockup-change-impact-log.md` (CI-014) untuk detail lengkap. Ringkasan fixture baru: 15 `ItineraryItem` (4 PRJ-101, 5 PRJ-102, 6 PRJ-103), 1 `ProjectService` baru (`SVC-1036`, tipe `additional`), 5 `bookingReference` pada service existing.

## 10. Responsive Behavior

Daily itinerary: `flex items-start gap-3` per baris, kolom waktu `w-14 shrink-0` (tetap terbaca di layar sempit). Service section table memakai `Table` primitive (`overflow-auto` bawaan — scroll horizontal otomatis untuk 5 kolom + kolom aksi). Tidak diverifikasi lewat browser interaktif — tidak ada tool headless browser tersedia di lingkungan ini (konsisten keterbatasan sejak Section 06); kelas Tailwind konsisten dengan pola responsive existing.

## 11. Loading, Empty, Error, Not-Found, dan Unauthorized States

- **Loading:** Tidak ada simulasi baru — konsisten precedent (data lokal sinkron).
- **Empty:** `EmptyState` untuk daily itinerary kosong dan untuk "tidak ada service sama sekali"; `TableEmpty` per section bila tipe tsb tidak punya baris service (skenario hipotetis — tidak terjadi pada 3 project demo karena `visibleServiceTypes` hanya menampilkan tipe yang memang dipakai).
- **Error:** Tidak ada state error tersimulasi baru.
- **Not-found:** Tidak berubah dari Section 05 — diverifikasi ulang tetap benar (`PRJ-999`).
- **Unauthorized:** `RoleAccessState` untuk `!canView('project')` — tidak berubah (gerbang halaman, bukan gerbang tab).

## 12. Role Behavior

`canView('project')` (module-level) tetap gerbang akses halaman. **Baru:** `canManageServiceType(type)` — granularity presisi sesuai `docs/route-and-role-matrix.md` bagian 5: PM/Operations/Super Admin mengelola seluruh sub-section (Operations = "koordinasi umum"); Ticketing/Accommodation/Transportation/MICE hanya `MANAGE` pada sub-section domainnya sendiri; role lain (Sales/Finance/Viewer) read-only murni. Berbeda dari pendekatan Section 11 (`canManageTravelers`, pengecualian sempit tunggal) — di sini granularitas per-tipe memang dituntut eksplisit oleh matrix bagian 5, bukan penyederhanaan berlebihan bila diterapkan generik.

## 13. Validation Commands dan Hasilnya

- `npx nuxi prepare` — **sukses**.
- `npm run build` — **sukses (exit 0)**.
- `npx vitest run` — "No test files found" (pre-existing, Q8).
- `npx nuxi typecheck` — gagal, `vue-tsc` tidak terpasang (Q8, pre-existing).
- Lint — tidak tersedia (Q8, pre-existing).
- **Smoke test konten mendalam** (curl + grep, bukan hanya status code — disiplin sejak Section 08):
  - `/projects/PRJ-101?tab=itinerary-services`, `PRJ-102`, `PRJ-103` — seluruhnya HTTP 200.
  - PRJ-101 (flight only): hanya section "Flight" tampil (Hotel/Transportation/MICE **tidak** dirender sama sekali — dikonfirmasi tidak ada di HTML), daily itinerary 4 item ("Keberangkatan Jakarta → Manila", dst.), booking reference "PNR-MNL8201" tampil.
  - PRJ-102 (flight+hotel, high-change): banner "Penanda Perubahan" + teks "1 layanan mengalami perubahan" tampil; badge "Perlu Ditinjau" tampil untuk Room Block A; 5 item Corporate Gathering/keberangkatan/kepulangan; booking reference "HTL-AUH-A104" tampil.
  - PRJ-103 (flight+hotel+transportation+mice, complex): section "Additional Service" tampil dengan "Asuransi Perjalanan Grup"/"INS-PLW-2026"; daily itinerary menampilkan referensi group ("Kedatangan Group Management", "Kedatangan Group Partner / VIP"); readiness fraction diverifikasi presisi per section (Flight 1/2, Hotel 1/1, Transportation 0/1, MICE 1/1, Additional 1/1 — cocok persis dengan status fixture 6 service); 6 elemen `<select>` "Update Status" terkonfirmasi ter-render (role default demo Super Admin, `canManageServiceType` true untuk seluruh tipe).
  - Tidak ditemukan string "Internal Server Error"/"TypeError"/"is not defined" di HTML manapun.
  - **Regresi terverifikasi dan efek samping fixture terkonfirmasi presisi (bukan diasumsikan):** Overview PRJ-103 (`?tab=overview`) — Service Summary kini menampilkan "Confirmed: 4" dan "Pending Confirmation: 2" (sebelumnya Confirmed: 3 — bertambah 1 karena `SVC-1036` baru, sesuai perkiraan CI-014), dikonfirmasi lewat pemeriksaan nilai literal di HTML, bukan sekadar HTTP 200. Tab Travelers (Section 11) dan tab lain tetap HTTP 200 tanpa perubahan konten.
- **Verifikasi interaktif** (klik dropdown Update Status, ganti role lewat `/settings` lalu cek dropdown Ticketing hanya muncul di section Flight) **tidak dilakukan** — tidak ada tool browser headless di lingkungan ini (keterbatasan konsisten sejak Section 06). Dimitigasi lewat code review ketat terhadap `canManageServiceType`/`SERVICE_TYPE_ROLE_MAP` dan mutator `updateServiceStatus` (pola identik dengan CRUD Section 07/09/11 yang sudah terverifikasi konten-nya).

## 14. Regression Checks

Section 05 (shell 8-tab, tidak diubah strukturnya), Section 10 (Overview tab kode tidak diubah — perubahan angka Service Summary adalah efek fixture yang diharapkan dan terverifikasi presisi, bukan bug), Section 11 (Travelers tab, tidak disentuh — dikonfirmasi lewat smoke test `?tab=travelers` menampilkan konten identik) — seluruhnya diverifikasi tidak beregresi secara tidak terduga.

## 15. Cross-Section Impact

**Satu entri baru:** CI-014 (`docs/mockup-change-impact-log.md`) — perluasan `ProjectService` (Section 05) menjadi `reactive()` dengan `bookingReference`, tipe layanan baru `additional`, dan entitas baru `ItineraryItem`; termasuk dampak terverifikasi ke Service Summary Overview (Section 10). Konsisten dengan kriteria protokol bagian C.

## 16. Review URLs

Tidak tersedia — lingkungan pengembangan lokal saja (`npm run dev` / `node .output/server/index.mjs`, tidak ada deployment publik).

## 17. Known Issues dan Deferred Work

- **Q8 (tooling lint/typecheck/test) masih terbuka** — **delapan section berturut-turut** (06–12) berjalan tanpa validasi otomatis penuh.
- Daily itinerary (`ItineraryItem`) bersifat read-only — tidak ada CRUD, karena tidak diminta eksplisit di scope literal Section 12 (berbeda dari Traveler Section 11).
- CRUD untuk `ProjectService` (tambah/hapus baris service baru dari UI) tidak diimplementasikan — scope hanya meminta "Service status dan readiness" (update status), bukan create/delete layanan; menambah/menghapus service tetap lewat fixture.
- Verifikasi interaktif (klik dropdown, ganti role) tidak dilakukan langsung (keterbatasan tooling lingkungan, konsisten sejak Section 06).
- Operational Tasks preview membatasi ke 5 task pertama tanpa sortir eksplisit berdasarkan urgensi — cukup untuk demo saat ini (project dengan task terbanyak, PRJ-103, hanya punya 4 task).

## 18. Protection Notes untuk Section Berikutnya

- Tab Itinerary & Services kini sumber lengkap untuk daily itinerary/service status/booking reference — Section 13 (Vendor Management) dan section berikutnya **tidak perlu** menduplikasi ringkasan service di tab lain; cukup rujuk balik bila relevan (mis. `vendorsForProject` yang sudah ada tetap sumber kebenaran untuk tab Vendors).
- `ProjectService`/`ItineraryItem` di `app/types/project.ts` dan `app/data/projects.ts` — jangan diubah shape-nya tanpa cross-section impact check; gunakan selector/mutator existing (`getProjectServices`, `getItineraryItems`, `updateServiceStatus`).
- `canManageServiceType`/`SERVICE_TYPE_ROLE_MAP` (granularity per sub-domain) — pola ini adalah realisasi presisi dari Role & Access Matrix bagian 5; bila Section 13 (Vendor) butuh role-gating serupa berbasis sub-domain (Ticketing/Accommodation/dst. terhadap vendor jenis tertentu), pola yang sama bisa direplikasi.
- Overview (Section 10) dan Travelers (Section 11) **tidak disentuh** — perubahan angka Service Summary di Overview adalah efek data (fixture bertambah), bukan perubahan kode; tetap dicatat eksplisit di CI-014, bukan default yang boleh diulang tanpa dokumentasi untuk perubahan fixture yang lebih besar.

## 19. Recommended Next Section

Section 13 — Vendor Management (`prompts/15-PROMPT-13-VENDOR-MANAGEMENT.md`), dengan rekomendasi sangat kuat menyelesaikan Q8 terlebih dahulu — delapan section berturut-turut telah berjalan tanpa validasi otomatis penuh. Tidak dieksekusi otomatis — menunggu perintah user.
