# Section Report — Section 13: Ticketing

**Status:** COMPLETED

Dikerjakan berdasarkan `prompts/SECTION_13_Ticketing.md`. Section keempat belas roadmap Section 00–24 baru, dijalankan setelah Section 12 (Itinerary, Operations, Tasks dan Readiness, COMPLETED).

---

## 1. Section Objective dan Scope

"Lengkapi lifecycle flight frontend." Wajib: Flight request/options; Fare/cabin/baggage/ancillary display; PNR/order reference mock; Segments dan traveler assignment; Ticketing deadline; Hold, Confirm, Issue, Reissue, Cancel, Refund state simulation; Group booking/name list; Schedule change/disruption; Fare rules and financial impact; Internal net cost vs client sell price; Documents/ticket preview. Acceptance: Ticketing role dapat mengelola flight dari request sampai completed/refunded pada mock workflow.

## 2. Source Documents yang Dibaca

`prompts/SECTION_13_Ticketing.md`, `prompts/01-PROTOKOL WAJIB — CONTINUITY, DOKUMENTASI PER SECTION, DAN PERLINDUNGAN HASIL.md`, `CLAUDE.md`, seluruh `docs/mockup-*.md`, `docs/frontend-*.md`, `docs/mockup-section-reports/section-00-*.md` s/d `section-12-*.md`, source code aktual (`app/types/project.ts`, `app/types/user.ts`, `app/constants/roles.ts`, `app/constants/navigation.ts`, `app/constants/status.ts`, `app/data/index.ts`, `app/data/projects.ts`, `app/pages/projects/[id]/index.vue`, `app/pages/product-planning/**` dan `app/pages/crm/opportunities/[id]/quotation-preview.vue`/`manifest-preview.vue`/`run-sheet-preview.vue` sebagai pola modul+print-preview reference), `git status`, `git log`.

## 3. Existing Implementation yang Diperiksa

`git status` menunjukkan Section 06–12 masih uncommitted (belum di-commit user, dicatat apa adanya, tidak diganggu). `docs/frontend-known-issues.md` bagian 11 dan `docs/frontend-implementation-roadmap.md` baris 13 menandai section ini `PARTIAL (role-only)` — role `ticketing` sudah ada sejak Foundation, hanya menggerbangi sub-section flight generik di tab "Itinerary & Services" (`canManageServiceType('flight')`).

Audit langsung kode mengonfirmasi `ProjectService` (tipe `flight`) sudah ada dengan `label`/`status`/`vendorId`/`bookingReference` (4 baris existing: `SVC-1011`/`1021`/`1031`/`1032`, masing-masing dengan `bookingReference` mock seperti `'PNR-MNL8201'`) — TIDAK ADA model lifecycle detail (options perbandingan, segments terstruktur, ticketing deadline, state machine granular Hold/Confirm/Issue/Reissue/Cancel/Refund, fare rules, net cost vs sell price terpisah). `docs/frontend-known-issues.md` bagian 11 mencatat potensi ketegangan arsitektur dengan D-020 (LOCKED: Operations/Traveler melebur ke tab Project Detail, bukan menu top-level) sebagai sesuatu yang perlu ditinjau ulang eksplisit saat section ini dikerjakan — dianalisis dan diresolusi (lihat bagian 4/5).

## 4. Decisions yang Digunakan

D-070 (`docs/mockup-design-decisions.md`, baru) — `FlightBooking` entitas baru terpisah dari `ProjectService`; modul top-level `/ticketing` MENDAMPINGI (bukan menggantikan) tab Project Detail existing, meninjau ulang sekaligus meresolusi ketegangan dengan D-020 tanpa membatalkannya; net cost internal disanitasi dari dokumen client-facing (pola sama D-065/D-067/D-068).

## 5. Implementation Summary

**Flight request/options + Fare/cabin/baggage/ancillary display** — `FlightBooking.options: FlightOption[]` (embedded, pola sama `QuotationServiceItem`) — airline/cabinClass/fareIdr/baggageAllowance/ancillaries/isSelected. Booking baru dibuat berstatus `requested` tanpa opsi (diisi lewat edit). Tabel "Flight Options" di detail membandingkan seluruh opsi, tombol "Pilih" (`selectFlightOption`, single-select toggle).

**PNR/order reference mock** — field `pnr` opsional, konsisten dengan `bookingReference` existing pada `ProjectService` yang sudah ditautkan (fixture, lihat bagian 9).

**Segments dan traveler assignment + Group booking/name list** — `FlightSegment[]` (origin/destination/flightNumber/departureAt/arrivalAt) dan `travelerIds[]` — daftar traveler SEKALIGUS berfungsi sebagai "name list" saat lebih dari satu (ditampilkan sebagai SectionCard "Traveler Assignment / Name List").

**Ticketing deadline** — field `ticketingDeadline`, ditampilkan di ringkasan, list, dan e-ticket preview.

**Hold, Confirm, Issue, Reissue, Cancel, Refund state simulation** — `FlightBookingStatus` (7 nilai literal), `FLIGHT_BOOKING_TRANSITIONS` (peta eksplisit, pola sama `PROJECT_STATUS_TRANSITIONS` D-066): `requested→{hold,confirmed,cancelled}`, `hold→{confirmed,cancelled}`, `confirmed→{issued,cancelled}`, `issued→{reissued,cancelled}`, `reissued→{cancelled}`, `cancelled→{refunded}`, `refunded→{}` (terminal). `updateFlightBookingStatus` mewajibkan alasan untuk `cancelled`/`refunded`, mencatat `ActivityEntry` pada project terkait (reuse tab Activity & Changes existing).

**Schedule change/disruption** — `hasScheduleChange`/`scheduleChangeNote`, ditampilkan sebagai banner amber di halaman detail dan disertakan di ringkasan e-ticket bila relevan.

**Fare rules and financial impact + Internal net cost vs client sell price** — `fareRules` (teks bebas), `netCostIdr`/`sellPriceIdr` (opsional terpisah, belum terisi selagi harga belum final), margin derivasi murni (`getFlightBookingMarginIdr`). Visibilitas `netCostIdr`/margin digerbangi `canManageTicketing || canViewFinancials` (Ticketing DAN role finansial penuh D-030) — role lain melihat "—".

**Documents/ticket preview** — `/ticketing/[id]/eticket-preview` (baru), `layout: false`, `window.print()`, pola IDENTIK `quotation-preview.vue`/`manifest-preview.vue`/`run-sheet-preview.vue`. SANITIZED — HANYA `sellPriceIdr` yang ditampilkan, `netCostIdr` TIDAK PERNAH dirender di halaman ini (diverifikasi smoke test).

**Modul `/ticketing`** — `ModuleKey` baru, `product-planner`-style list (`/ticketing`, search/filter status+project, create dialog) + detail (`/ticketing/[id]`, seluruh fitur di atas + dialog edit whole-form) — MENDAMPINGI ringkasan baru di sub-section flight tab Itinerary & Services Project Detail (link + tombol "Buat Flight Booking" prefill `projectId`).

## 6. Routes

3 route baru: `/ticketing` (list), `/ticketing/[id]` (detail), `/ticketing/[id]/eticket-preview` (dokumen). Tidak ada route existing yang di-rename/dihapus. `/projects/[id]` (sub-section flight, tab Itinerary & Services) diperkaya pada route yang sama.

## 7. Files Created, Changed, dan Removed

**Created:**
- `app/types/ticketing.ts`
- `app/data/ticketing.ts`
- `app/pages/ticketing/index.vue`
- `app/pages/ticketing/[id]/index.vue`
- `app/pages/ticketing/[id]/eticket-preview.vue`
- `docs/mockup-section-reports/section-13-ticketing.md` (laporan ini)

**Changed:**
- `app/types/user.ts` (`ModuleKey` +`ticketing`)
- `app/constants/roles.ts` (`ROLE_MODULE_ACCESS` +kolom `ticketing` seluruh 16 role)
- `app/constants/navigation.ts` (+menu "Ticketing", +icon `Plane`)
- `app/constants/status.ts` (+`FLIGHT_BOOKING_STATUSES`, `+CABIN_CLASSES`)
- `app/data/index.ts` (+`getFlightBookingById`, `+getFlightBookingsByProject`, `+getFlightBookingsByService`, `+getFlightBookingMarginIdr`, `+createFlightBooking`, `+updateFlightBooking`, `+getFlightBookingStatusTransitions`, `+updateFlightBookingStatus`, `+selectFlightOption`)
- `app/pages/projects/[id]/index.vue` (+blok "Flight Bookings" di sub-section flight, +computed `flightBookings`)
- `app/pages/admin/roles.vue` (+1 baris `modules`, +update teks `ROLE_NOTES['ticketing']`)
- `docs/mockup-design-decisions.md` (+D-070)
- `docs/mockup-change-impact-log.md` (+CI-043)
- `docs/mockup-data-scenarios.md` (+bagian 4p)
- `docs/frontend-module-map.md`, `docs/frontend-workflow-map.md`, `docs/frontend-implementation-roadmap.md`, `docs/frontend-known-issues.md`
- `docs/mockup-implementation-state.md`, `docs/mockup-progress.md` (+Entri 22), `docs/mockup-section-progress.md`
- `docs/mockup-section-reports/README.md`

**Removed:** Tidak ada.

## 8. Components Reused/Created

Reused sepenuhnya: `PageHeader`, `SectionCard`, `DetailMetadataList`, `StatusBadge`, `EmptyState`, `RoleAccessState`, `Table*`, `Dialog*`/`DialogScrollContent`, `Checkbox`, `useToast`. Tidak ada shared component baru — pola halaman mengikuti persis `/product-planning`+`/product-planning/cost-sheets` (list+detail) dan `quotation-preview.vue`/`manifest-preview.vue`/`run-sheet-preview.vue` (print preview).

## 9. Types/Constants/Fixtures/Mock State

`+FlightBooking`/`FlightOption`/`FlightSegment`/`FlightBookingStatus`/`CabinClass` (entitas dan type baru, `app/types/ticketing.ts`). `ModuleKey` +`ticketing`. Fixture baru: 6 `FlightBooking` (`FLT-1011`/`1021`/`1023`/`1031`/`1032`/`1033`) — 4 di antaranya menautkan `serviceId` ke `ProjectService` existing (`SVC-1011`/`1021`/`1031`/`1032`, `pnr` mengikuti `bookingReference` existing), `fareIdr` opsi mengikuti `costPerPaxIdr` Cost Sheet Section 10 untuk destinasi yang sama, `FLT-1021` (`reissued`) menautkan narasi `CHG-1021` — lihat `docs/mockup-data-scenarios.md` bagian 4p. Tidak ada fixture ID lama yang diganti/dihapus.

## 10. Responsive Behavior

Tidak ada pola baru — seluruh halaman memakai `Table`/`Dialog`/`SectionCard` existing yang sudah responsive (grid `sm:grid-cols-*` untuk financial/summary, `DialogScrollContent` untuk form panjang di layar kecil).

## 11. States (Loading/Empty/Error/Unauthorized/Not-Found)

- `RoleAccessState` untuk `!canView('ticketing')`.
- Not-found: "Flight Booking tidak ditemukan" (pola identik `/vendors/[id]`/`/product-planning/cost-sheets/[id]`) untuk ID yang tidak ada.
- Empty state: "Belum ada Flight Booking" (list kosong), "Belum ada opsi/segmen/traveler tercatat" (detail kosong).
- Locked state: booking `refunded` — `updateFlightBooking` menolak edit, tombol "Edit" tetap tampil tapi mutasi ditolak silently sesuai guard (konsisten pola `CostSheet` `final`); tombol transisi status habis (transisi kosong dari `refunded`).
- Financial: "Net cost internal tidak ditampilkan untuk role ini" untuk role tanpa `canViewFlightFinancials`.

## 12. Role Behavior

`canManageTicketing` = `canManage('ticketing')` (RANK-based standar) — hanya `ticketing` (`MANAGE`) dan `super-admin` (`ADMIN`) yang mencapai rank tulis, TIDAK butuh narrow-role-exception tambahan (pola sama `product-planning`, D-067). `canViewFlightFinancials` = `canManageTicketing || canViewFinancials` (gabungan existing `FULL_FINANCIAL_VISIBILITY_ROLES` — super-admin/management/finance/project-manager/viewer — DENGAN `ticketing`, karena Ticketing-lah yang mengelola net cost vs sell price secara langsung sesuai acceptance literal). Role lain (Sales/AE/Product Planner/Procurement/Accommodation/Transportation/MICE/Client/Supplier): `NONE`.

## 13. Validation Commands dan Hasilnya

- `npx nuxi prepare` — **sukses**.
- `npm run build` — **sukses**.
- `npx nuxi typecheck` — gagal, `vue-tsc` belum terpasang (Q8, pre-existing gap, 13 section berturut-turut).
- `npm run lint` — tidak tersedia (Q8, pre-existing).
- `npx vitest run` — "No test files found" (pre-existing).
- **Smoke test HTTP** — `/ticketing`, `/ticketing/FLT-1011`/`1021`/`1032`/`1033`, `/ticketing/FLT-9999` (not-found), `/ticketing/FLT-1011/eticket-preview`, `/ticketing/FLT-9999/eticket-preview` (not-found), plus regresi `/projects/PRJ-101`/`103?tab=itinerary-services`, `/admin/roles` — **seluruhnya HTTP 200**.
- **Smoke test konten** (curl+grep):
  - `/ticketing` menampilkan 6 baris dengan PNR `MNL8201`/`AUH9221`/`PLW1031A` dan badge status Requested/Hold/Issued/Reissued/Refunded.
  - `/ticketing/FLT-1011` menampilkan PNR "MNL8201", status "Issued", 2 opsi ("Budget Wings Air"/"Garuda Nusantara") dengan "Garuda Nusantara" berlabel "Dipilih", serta "Net Cost"/"Sell Price"/"Margin" (role default demo Super Admin, `canViewFlightFinancials` true).
  - `/ticketing/FLT-1021` menampilkan banner "Schedule Change" dengan teks "...tiket lama di-reissue menyesuaikan jadwal baru." (merujuk CHG-1021).
  - `/ticketing/FLT-9999` menampilkan "Flight Booking tidak ditemukan".
  - `/ticketing/FLT-1011/eticket-preview` — dikonfirmasi menampilkan "E-TICKET"/"PNR: MNL8201"/"Rp 95.000.000" (sell price) TAPI TIDAK menampilkan teks "Net Cost" maupun angka "Rp 75.000.000" (net cost) di manapun pada halaman — **sanitasi client-facing terverifikasi presisi**, bukan asumsi.
  - Regresi `/projects/PRJ-101?tab=itinerary-services` dan `/admin/roles` (kolom "Ticketing" baru) dikonfirmasi tidak berubah selain penambahan yang dimaksud.
- **Verifikasi interaktif** (klik pilih opsi, dialog transisi status dengan alasan wajib, toggle traveler assignment, submit create dialog) **tidak dilakukan headless** — keterbatasan tooling konsisten sejak Section 06. Dimitigasi lewat code review ketat terhadap seluruh guard (`updateFlightBookingStatus` menolak transisi tidak valid/tanpa alasan wajib, `updateFlightBooking` menolak edit saat `refunded`) dan smoke test SSR konten yang membuktikan lifecycle, sanitasi, dan cross-link bekerja benar untuk 6 kondisi booking berbeda.

## 14. Regression

`app/pages/projects/[id]/index.vue` (dimiliki Section 12 lama/Foundation — hanya blok "Flight Bookings" ditambahkan DI DALAM sub-section flight existing, tabel `ProjectService` generik dan tab lain TIDAK disentuh, dikonfirmasi via smoke test `?tab=overview`/`?tab=travelers`/`?tab=finance` tidak berubah). `app/pages/admin/roles.vue` (dimiliki Section 17 lama/Section 02 — hanya 1 baris array + 1 teks catatan ditambahkan, kolom/baris existing tidak berubah). `app/constants/roles.ts` (`ROLE_MODULE_ACCESS` — seluruh 16 baris ditambah 1 properti `ticketing`, nilai existing untuk 9 modul lain di setiap baris TIDAK diubah). `ProjectService` (Foundation, dipakai luas Dashboard/Reports/Client Portal) TIDAK diubah shape-nya sama sekali.

## 15. Cross-Section Impact

`docs/mockup-change-impact-log.md` CI-043 — ringkasan Flight Booking di tab Itinerary & Services (Section 12 lama) dan kolom Matrix Role (Section 02/17 lama) — seluruhnya aditif, regression-tested.

## 16. Known Issues dan Deferred Work

- Q8 (tooling lint/typecheck/test) tetap terbuka — 13 section berturut-turut.
- Accommodation/Transportation/MICE (Section 14–16) TETAP `KNOWN_GAP` — belum ada modul dedicated setara `/ticketing`; preseden arsitektur D-070 (modul top-level baru MENDAMPINGI tab existing) didokumentasikan eksplisit sebagai acuan untuk section-section tersebut.
- Verifikasi interaktif tidak dilakukan headless (keterbatasan tooling, konsisten sejak Section 06).
- `confirmed`/`cancelled` (2 dari 7 status lifecycle) tidak di-seed pada fixture — tetap fully reachable lewat UI transisi, tidak ada gap fungsional, murni keterbatasan jumlah baris demo.
- PNR mock — bukan integrasi GDS/airline nyata (D-006), murni teks referensi.

## 17. Protection Notes untuk Section Berikutnya

`FlightBooking` (D-070) — entitas TERPISAH dari `ProjectService`, jangan digabung/direstrukturisasi; `ProjectService` (Foundation, LOCKED secara de facto karena dipakai luas) TIDAK BOLEH diperluas dengan field spesifik-flight (options/PNR/segments/dst.) — field tsb HANYA hidup di `FlightBooking`. Booking yang sudah `refunded` bersifat terminal — `updateFlightBooking` sudah menolak edit lebih lanjut, jangan dilonggarkan tanpa keputusan baru. `netCostIdr` TIDAK BOLEH tampil di `eticket-preview.vue` atau halaman client-facing manapun (termasuk bila Client Portal kelak menambah view flight) — hanya `sellPriceIdr`. **Preseden arsitektur modul top-level baru MENDAMPINGI tab Project Detail (bukan menggantikan)** — ikuti pola ini untuk Section 14–16 (Accommodation/Transportation/MICE), JANGAN memindahkan konten tab existing ke top-level (D-020 tetap LOCKED untuk struktur tab itu sendiri).

## 18. Review URLs

Tidak ada deployment publik. Untuk review lokal: `npm run dev`, buka `http://localhost:8080/ticketing` untuk daftar Flight Booking. Buka `http://localhost:8080/ticketing/FLT-1021` untuk melihat banner Schedule Change dan status Reissued. Buka `http://localhost:8080/ticketing/FLT-1011/eticket-preview` untuk melihat dokumen e-ticket yang tersanitasi. Buka `http://localhost:8080/projects/PRJ-101?tab=itinerary-services` untuk melihat titik kolaborasi ringkasan Flight Booking di Project Detail.

## 19. Recommended Next Section

**Section 14 — Accommodation** (halaman dedicated, room block/voucher mock, dashboard Accommodation tersendiri — saat ini role-only tanpa page dedicated, status PARTIAL), berbasis dependency (`docs/frontend-implementation-roadmap.md`), mengikuti preseden arsitektur D-070 — menunggu perintah eksplisit user.
