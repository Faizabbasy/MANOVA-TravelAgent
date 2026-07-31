# Section Report — Section 14: Accommodation

**Status:** COMPLETED

Dikerjakan berdasarkan `prompts/SECTION_14_Accommodation.md`. Section kelima belas roadmap Section 00–24 baru, dijalankan setelah Section 13 (Ticketing, COMPLETED).

---

## 1. Section Objective dan Scope

"Lengkapi hotel frontend." Wajib: Hotel sourcing/options; Property, room type, rate plan, meal, policies; Room block, occupancy, rooming list; Check-in/out, early/late request; Quote, booking, confirmation, voucher; Amendment, cancellation, no-show, deadline, penalty; Traveler special requests; Internal cost isolation. Acceptance: Accommodation role dapat menangani individual maupun group secara penuh.

## 2. Source Documents yang Dibaca

`prompts/SECTION_14_Accommodation.md`, `prompts/01-PROTOKOL WAJIB — CONTINUITY, DOKUMENTASI PER SECTION, DAN PERLINDUNGAN HASIL.md`, `CLAUDE.md`, seluruh `docs/mockup-*.md`, `docs/frontend-*.md`, `docs/mockup-section-reports/section-00-*.md` s/d `section-13-ticketing.md` (khususnya bagian 17 "Protection Notes untuk Section Berikutnya" yang eksplisit menunjuk preseden D-070 untuk section ini), source code aktual (`app/types/project.ts`, `app/types/ticketing.ts`, `app/types/user.ts`, `app/constants/roles.ts`, `app/constants/navigation.ts`, `app/constants/status.ts`, `app/data/index.ts`, `app/data/projects.ts`, `app/data/ticketing.ts`, `app/data/vendors.ts`, `app/data/products.ts`, `app/pages/projects/[id]/index.vue`, `app/pages/ticketing/**` sebagai pola modul+print-preview reference), `git status`, `git log`.

## 3. Existing Implementation yang Diperiksa

`git status` menunjukkan Section 06–13 masih uncommitted (belum di-commit user, dicatat apa adanya, tidak diganggu). `docs/frontend-known-issues.md` bagian 11 dan `docs/frontend-implementation-roadmap.md` baris 14 menandai section ini `PARTIAL` — role `accommodation` sudah ada sejak Foundation, hanya menggerbangi sub-section hotel generik di tab "Itinerary & Services" (`canManageServiceType('hotel')`).

Audit langsung kode mengonfirmasi `ProjectService` (tipe `hotel`) sudah ada dengan `label`/`status`/`vendorId`/`bookingReference` (3 baris existing: `SVC-1022`/`1023`/`1033`) — TIDAK ADA model lifecycle detail (options perbandingan, check-in/out, voucher, state machine granular Quote/Confirm/Amend/Cancel/No-Show, penalty, net cost vs sell price terpisah). Yang BERBEDA dari kondisi Ticketing sebelum Section 13: rooming list dan traveler special request SUDAH punya model dedicated sejak Section 11 (`TravelerGroup`/`RoomAssignment`/`Traveler.specialRequest`/`dietaryRestrictions`/`accessibilityNeeds`) — audit mengonfirmasi ketiganya sudah lengkap dan tidak perlu dibangun ulang, hanya perlu ditautkan (reuse read-only) dari `HotelBooking` baru.

## 4. Decisions yang Digunakan

D-071 (`docs/mockup-design-decisions.md`, baru) — `HotelBooking` entitas baru terpisah dari `ProjectService`; modul top-level `/accommodation` MENDAMPINGI (bukan menggantikan) tab Project Detail existing, pola arsitektur IDENTIK D-070 (Section 13); room block/occupancy/rooming list dan traveler special request DIREUSE dari `TravelerGroup`/`RoomAssignment`/`Traveler` (Section 11), bukan diduplikasi; net cost internal disanitasi dari dokumen client-facing (pola sama D-065/D-067/D-070).

## 5. Implementation Summary

**Hotel sourcing/options + Property, room type, rate plan, meal, policies** — `HotelBooking.options: HotelOption[]` (embedded, pola sama `FlightOption`) — propertyName/roomType/ratePlan/mealPlan/ratePerNightIdr/policies/isSelected. Booking baru dibuat berstatus `requested` tanpa opsi (diisi lewat edit). Tabel "Hotel Options" di detail membandingkan seluruh opsi, tombol "Pilih" (`selectHotelOption`, single-select toggle).

**Room block, occupancy, rooming list** — SENGAJA TIDAK diduplikasi. `HotelBooking.groupId` (opsional) menautkan ke `TravelerGroup` (Section 11) existing; `getHotelRoomingList(projectId, groupId)` (selector baru, murni filter `RoomAssignment` by `groupId`) membaca data yang sama persis dipakai tab Travelers. `roomsBlocked` (angka) tetap field baru — merepresentasikan kuantitas kamar diblok/dipesan, konsep berbeda dari baris `RoomAssignment` aktual yang sudah di-assign nama.

**Check-in/out, early/late request** — field `checkInDate`/`checkOutDate`/`earlyCheckInRequested`/`lateCheckOutRequested`, ditampilkan sebagai metadata + badge di header detail.

**Quote, booking, confirmation, voucher** — `confirmationNumber` opsional (pola sama `pnr`), konsisten dengan `bookingReference` existing pada `ProjectService` yang sudah ditautkan (fixture, lihat bagian 9). `voucherIssuedAt` — timestamp milestone mock. Halaman `/accommodation/[id]/voucher-preview` (print-friendly, sanitized, pola IDENTIK `eticket-preview.vue`).

**Amendment, cancellation, no-show, deadline, penalty** — `HotelBookingStatus` (7 nilai literal), `HOTEL_BOOKING_TRANSITIONS` (peta eksplisit, pola sama `FLIGHT_BOOKING_TRANSITIONS`): `requested→{quoted,cancelled}`, `quoted→{confirmed,cancelled}`, `confirmed→{amended,completed,cancelled,no-show}`, `amended→{completed,cancelled,no-show}` (BUKAN terminal — beda dari `reissued` pada Flight, karena amandemen hotel adalah kejadian tengah siklus, bukan penanda mendekati akhir), `completed`/`cancelled`/`no-show→{}` (terminal). `updateHotelBookingStatus` mewajibkan alasan untuk `cancelled`/`no-show`, mencatat `ActivityEntry` pada project terkait (reuse tab Activity & Changes existing). `cancellationDeadline`, `cancellationPenaltyIdr`/`noShowPenaltyIdr` (opsional, diedit manual — tidak ada kalkulasi persentase otomatis, konsisten larangan mengarang mesin bisnis nyata).

**Traveler special requests** — SENGAJA TIDAK diduplikasi. `travelerIds` menunjuk ke `Traveler` existing; halaman detail membaca `specialRequest`/`dietaryRestrictions`/`accessibilityNeeds` (Section 11) langsung dari traveler yang ditunjuk, ditampilkan di SectionCard "Traveler / Special Requests" (SEKALIGUS berfungsi sebagai indikator individual vs group — 1 entri = individual, banyak entri = group, tanpa flag/type terpisah).

**Internal cost isolation** — `netCostIdr`/`sellPriceIdr` (opsional terpisah, belum terisi selagi harga belum final). Visibilitas `netCostIdr`/margin digerbangi `canManageAccommodation || canViewFinancials` (Accommodation DAN role finansial penuh D-030) — role lain melihat "—". `voucher-preview.vue` — SANITIZED, HANYA `sellPriceIdr` yang ditampilkan, `netCostIdr` TIDAK PERNAH dirender (diverifikasi smoke test presisi).

**Modul `/accommodation`** — `ModuleKey` baru, pola list (`/accommodation`, search/filter status+project, create dialog) + detail (`/accommodation/[id]`, seluruh fitur di atas + dialog edit whole-form) — MENDAMPINGI ringkasan baru di sub-section hotel tab Itinerary & Services Project Detail (link + tombol "Buat Hotel Booking" prefill `projectId`).

## 6. Routes

3 route baru: `/accommodation` (list), `/accommodation/[id]` (detail), `/accommodation/[id]/voucher-preview` (dokumen). Tidak ada route existing yang di-rename/dihapus. `/projects/[id]` (sub-section hotel, tab Itinerary & Services) diperkaya pada route yang sama.

## 7. Files Created, Changed, dan Removed

**Created:**
- `app/types/accommodation.ts`
- `app/data/accommodation.ts`
- `app/pages/accommodation/index.vue`
- `app/pages/accommodation/[id]/index.vue`
- `app/pages/accommodation/[id]/voucher-preview.vue`
- `docs/mockup-section-reports/section-14-accommodation.md` (laporan ini)

**Changed:**
- `app/types/user.ts` (`ModuleKey` +`accommodation`)
- `app/constants/roles.ts` (`ROLE_MODULE_ACCESS` +kolom `accommodation` seluruh 16 role)
- `app/constants/navigation.ts` (+menu "Accommodation", +icon `BedDouble`)
- `app/constants/status.ts` (+`HOTEL_BOOKING_STATUSES`, `+MEAL_PLANS`)
- `app/data/index.ts` (+`getHotelRoomingList`, `+getHotelBookingById`, `+getHotelBookingsByProject`, `+getHotelBookingsByService`, `+getHotelBookingMarginIdr`, `+createHotelBooking`, `+updateHotelBooking`, `+getHotelBookingStatusTransitions`, `+updateHotelBookingStatus`, `+selectHotelOption`)
- `app/pages/projects/[id]/index.vue` (+blok "Hotel Bookings" di sub-section hotel, +computed `hotelBookings`)
- `app/pages/admin/roles.vue` (+1 baris `modules`, +update teks `ROLE_NOTES['accommodation']`)
- `docs/mockup-design-decisions.md` (+D-071)
- `docs/mockup-change-impact-log.md` (+CI-044)
- `docs/mockup-data-scenarios.md` (+bagian 4q)
- `docs/frontend-module-map.md`, `docs/frontend-workflow-map.md`, `docs/frontend-implementation-roadmap.md`, `docs/frontend-known-issues.md`
- `docs/mockup-implementation-state.md`, `docs/mockup-progress.md` (+Entri 23), `docs/mockup-section-progress.md`
- `docs/mockup-section-reports/README.md`

**Removed:** Tidak ada.

## 8. Components Reused/Created

Reused sepenuhnya: `PageHeader`, `SectionCard`, `DetailMetadataList`, `StatusBadge`, `EmptyState`, `RoleAccessState`, `Table*`, `Dialog*`/`DialogScrollContent`, `Checkbox`, `useToast`. Tidak ada shared component baru — pola halaman mengikuti persis `/ticketing`+`/ticketing/[id]` (list+detail) dan `eticket-preview.vue` (print preview).

## 9. Types/Constants/Fixtures/Mock State

`+HotelBooking`/`HotelOption`/`HotelBookingStatus`/`MealPlan` (entitas dan type baru, `app/types/accommodation.ts`). `ModuleKey` +`accommodation`. Fixture baru: 6 `HotelBooking` (`HTL-1022`/`1023`/`1033`/`1034`/`1035`/`1036`) — 3 di antaranya menautkan `serviceId` ke `ProjectService` existing (`SVC-1022`/`1023`/`1033`, `confirmationNumber` mengikuti `bookingReference` existing), 3 di antaranya menautkan `groupId` ke `TravelerGroup` existing (`GRP-001`/`002`/`003`) sehingga rooming list-nya membaca `ROOM-001`/`002`/`003` existing tanpa duplikasi, `ratePerNightIdr` opsi mengikuti `costPerPaxIdr` Cost Sheet Section 10 (`CS-002`/`003`/`004`) dibagi 4 malam untuk destinasi yang sama, `HTL-1022` (`amended`) menautkan narasi upgrade Suite yang sama seperti `ITIN-1022`/`1026` — lihat `docs/mockup-data-scenarios.md` bagian 4q. Tidak ada fixture ID lama yang diganti/dihapus.

## 10. Responsive Behavior

Tidak ada pola baru — seluruh halaman memakai `Table`/`Dialog`/`SectionCard` existing yang sudah responsive (grid `sm:grid-cols-*` untuk financial/summary, `DialogScrollContent` untuk form panjang di layar kecil).

## 11. States (Loading/Empty/Error/Unauthorized/Not-Found)

- `RoleAccessState` untuk `!canView('accommodation')`.
- Not-found: "Hotel Booking tidak ditemukan" (pola identik `/ticketing/[id]`) untuk ID yang tidak ada.
- Empty state: "Belum ada Hotel Booking" (list kosong), "Belum ada opsi/rooming list/traveler ditugaskan" (detail kosong).
- Locked state: booking `completed`/`cancelled`/`no-show` — `updateHotelBooking` menolak edit, tombol "Edit" tetap tampil tapi mutasi ditolak silently sesuai guard (konsisten pola `FlightBooking.refunded`); tombol transisi status habis (transisi kosong dari ketiga status terminal).
- Financial: "Net cost internal tidak ditampilkan untuk role ini" untuk role tanpa `canViewAccommodationFinancials`.

## 12. Role Behavior

`canManageAccommodation` = `canManage('accommodation')` (RANK-based standar) — hanya `accommodation` (`MANAGE`) dan `super-admin` (`ADMIN`) yang mencapai rank tulis, TIDAK butuh narrow-role-exception tambahan (pola sama `ticketing`, D-070). `canViewAccommodationFinancials` = `canManageAccommodation || canViewFinancials` (gabungan existing `FULL_FINANCIAL_VISIBILITY_ROLES` — super-admin/management/finance/project-manager/viewer — DENGAN `accommodation`, karena Accommodation-lah yang mengelola net cost vs sell price secara langsung sesuai acceptance literal, pola sama `canViewFlightFinancials`). Role lain (Sales/AE/Product Planner/Procurement/Ticketing/Transportation/MICE/Client/Supplier): `NONE`.

## 13. Validation Commands dan Hasilnya

- `npx nuxi prepare` — **sukses**.
- `npm run build` — **sukses**.
- `npx nuxi typecheck` — gagal, `vue-tsc` belum terpasang (Q8, pre-existing gap, 14 section berturut-turut).
- `npm run lint` — tidak tersedia (Q8, pre-existing).
- `npx vitest run` — "No test files found" (pre-existing).
- **Smoke test HTTP** — `/accommodation`, `/accommodation/HTL-1022`/`1023`/`1033`/`1034`/`1035`/`1036`, `/accommodation/HTL-9999` (not-found), `/accommodation/HTL-1022/voucher-preview`, `/accommodation/HTL-9999/voucher-preview` (not-found), plus regresi `/projects/PRJ-101`/`102`/`103?tab=itinerary-services`, `/admin/roles` — **seluruhnya HTTP 200**.
- **Smoke test konten** (curl+grep):
  - `/accommodation` menampilkan 6 baris dengan konfirmasi `AUH-A104`/`PLW-2200`/`PLW-2200-VIP` dan badge status Requested/Quoted/Confirmed/Amended/Cancelled.
  - `/accommodation/HTL-1022` menampilkan banner "Amendment", opsi terpilih "Corniche Suite Wing", serta "Net Cost"/"Sell Price"/"Margin" (role default demo Super Admin, `canViewAccommodationFinancials` true).
  - `/accommodation/HTL-1023` menampilkan narasi "digabungkan ke Room Block A" dan "Cancellation Penalty" Rp2.025.000.
  - `/accommodation/HTL-1033` menampilkan rooming list "Twin 101" dengan traveler "Michael Tanuwijaya"/"Putri Anggraeni" — dikonfirmasi PERSIS sama dengan `ROOM-001` (Section 11), bukan data baru.
  - `/accommodation/HTL-1035` menampilkan "Membutuhkan akses kursi roda" (reuse `Traveler.accessibilityNeeds` milik `TRV-1031`) dan badge "Late Check-out Diminta" — mendemokan booking individual/VIP dalam entitas yang sama.
  - `/accommodation/HTL-9999` menampilkan "Hotel Booking tidak ditemukan".
  - `/accommodation/HTL-1022/voucher-preview` — dikonfirmasi menampilkan "VOUCHER"/"Rp 152.900.000" (sell price) TAPI TIDAK menampilkan teks "Net Cost" maupun angka "Rp129.600.000" (net cost) di manapun pada halaman — **sanitasi client-facing terverifikasi presisi**, bukan asumsi.
  - Regresi `/projects/PRJ-102?tab=itinerary-services` (blok "Hotel Bookings" menampilkan HTL-1022/1023 dengan link ke `/accommodation/[id]`) dan `/admin/roles` (kolom "Accommodation" baru) dikonfirmasi tidak berubah selain penambahan yang dimaksud.
- **Verifikasi interaktif** (klik pilih opsi, dialog transisi status dengan alasan wajib, toggle traveler assignment, submit create dialog) **tidak dilakukan headless** — keterbatasan tooling konsisten sejak Section 06. Dimitigasi lewat code review ketat terhadap seluruh guard (`updateHotelBookingStatus` menolak transisi tidak valid/tanpa alasan wajib, `updateHotelBooking` menolak edit saat status terminal) dan smoke test SSR konten yang membuktikan lifecycle, reuse rooming list/special request, sanitasi, dan cross-link bekerja benar untuk 6 kondisi booking berbeda.

## 14. Regression

`app/pages/projects/[id]/index.vue` (dimiliki Section 12 lama/Foundation — hanya blok "Hotel Bookings" ditambahkan DI DALAM sub-section hotel existing, tabel `ProjectService` generik dan tab lain TIDAK disentuh, dikonfirmasi via smoke test `?tab=overview`/`?tab=travelers`/`?tab=finance` tidak berubah). Tab "Travelers" (Section 11, `getRoomAssignments`/`getTravelerGroups`/`Traveler.specialRequest`) TIDAK diubah shape-nya sama sekali — `getHotelRoomingList` murni filter read-only di atas data yang sama. `app/pages/admin/roles.vue` (dimiliki Section 17 lama/Section 02 — hanya 1 baris array + 1 teks catatan ditambahkan, kolom/baris existing tidak berubah). `app/constants/roles.ts` (`ROLE_MODULE_ACCESS` — seluruh 16 baris ditambah 1 properti `accommodation`, nilai existing untuk 10 modul lain di setiap baris TIDAK diubah). `ProjectService` (Foundation, dipakai luas Dashboard/Reports/Client Portal) TIDAK diubah shape-nya sama sekali.

## 15. Cross-Section Impact

`docs/mockup-change-impact-log.md` CI-044 — ringkasan Hotel Booking di tab Itinerary & Services (Section 12 lama) dan kolom Matrix Role (Section 02/17 lama) — seluruhnya aditif, regression-tested. Rooming list Hotel Booking Detail membaca `RoomAssignment`/`TravelerGroup` (Section 11) read-only.

## 16. Known Issues dan Deferred Work

- Q8 (tooling lint/typecheck/test) tetap terbuka — 14 section berturut-turut.
- Transportation/MICE (Section 15–16) TETAP `KNOWN_GAP` — belum ada modul dedicated setara `/accommodation`/`/ticketing`; preseden arsitektur D-070/D-071 didokumentasikan eksplisit sebagai acuan untuk section-section tersebut.
- Verifikasi interaktif tidak dilakukan headless (keterbatasan tooling, konsisten sejak Section 06).
- `completed`/`no-show` (2 dari 7 status lifecycle) tidak di-seed pada fixture — tetap fully reachable lewat UI transisi, tidak ada gap fungsional, murni keterbatasan jumlah baris demo.
- Confirmation number mock — bukan integrasi PMS/OTA nyata (D-006), murni teks referensi.

## 17. Protection Notes untuk Section Berikutnya

`HotelBooking` (D-071) — entitas TERPISAH dari `ProjectService`, jangan digabung/direstrukturisasi; `ProjectService` (Foundation, LOCKED secara de facto karena dipakai luas) TIDAK BOLEH diperluas dengan field spesifik-hotel (options/room block/voucher/dst.) — field tsb HANYA hidup di `HotelBooking`. Booking yang sudah `completed`/`cancelled`/`no-show` bersifat terminal — `updateHotelBooking` sudah menolak edit lebih lanjut, jangan dilonggarkan tanpa keputusan baru. `netCostIdr` TIDAK BOLEH tampil di `voucher-preview.vue` atau halaman client-facing manapun (termasuk bila Client Portal kelak menambah view hotel) — hanya `sellPriceIdr`. `TravelerGroup`/`RoomAssignment`/`Traveler.specialRequest`/`dietaryRestrictions`/`accessibilityNeeds` (Section 11) TIDAK BOLEH diduplikasi menjadi field baru di `HotelBooking` — HotelBooking HANYA menyimpan referensi (`groupId`/`travelerIds`), section berikutnya harus mengikuti pola reuse yang sama untuk kebutuhan serupa. **Preseden arsitektur modul top-level baru MENDAMPINGI tab Project Detail (bukan menggantikan)** — ikuti pola ini untuk Section 15–16 (Transportation/MICE), JANGAN memindahkan konten tab existing ke top-level (D-020 tetap LOCKED untuk struktur tab itu sendiri).

## 18. Review URLs

Tidak ada deployment publik. Untuk review lokal: `npm run dev`, buka `http://localhost:8080/accommodation` untuk daftar Hotel Booking. Buka `http://localhost:8080/accommodation/HTL-1022` untuk melihat banner Amendment dan opsi Suite terpilih. Buka `http://localhost:8080/accommodation/HTL-1033` untuk melihat rooming list yang reuse `ROOM-001` (Section 11). Buka `http://localhost:8080/accommodation/HTL-1035` untuk melihat catatan aksesibilitas traveler (reuse Section 11) dan kasus booking individual/VIP. Buka `http://localhost:8080/accommodation/HTL-1022/voucher-preview` untuk melihat dokumen voucher yang tersanitasi. Buka `http://localhost:8080/projects/PRJ-102?tab=itinerary-services` untuk melihat titik kolaborasi ringkasan Hotel Booking di Project Detail.

## 19. Recommended Next Section

**Section 15 — Transportation** (halaman dedicated, driver/vehicle mock, dashboard Transportation tersendiri — saat ini role-only tanpa page dedicated, status PARTIAL), berbasis dependency (`docs/frontend-implementation-roadmap.md`), mengikuti preseden arsitektur D-070/D-071 — menunggu perintah eksplisit user.
