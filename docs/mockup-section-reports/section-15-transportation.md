# Section Report — Section 15: Transportation

**Status:** COMPLETED

Dikerjakan berdasarkan `prompts/SECTION_15_Transportation.md`. Section keenam belas roadmap Section 00–24 baru, dijalankan setelah Section 14 (Accommodation, COMPLETED).

---

## 1. Section Objective dan Scope

"Lengkapi transportation frontend." Wajib: Transfer/service request; Pickup/drop-off, route, schedule; Vehicle type, capacity, luggage, accessibility; Supplier, vehicle, driver, contact; Manifest/group allocation; Multi-leg dispatch; Standby/overtime/toll; Quote, assignment, confirmation, service order, driver sheet; Change, cancellation, incident, no-show. Acceptance: Transportation role dapat merencanakan dan menutup seluruh service.

## 2. Source Documents yang Dibaca

`prompts/SECTION_15_Transportation.md`, `prompts/01-PROTOKOL WAJIB — CONTINUITY, DOKUMENTASI PER SECTION, DAN PERLINDUNGAN HASIL.md`, `CLAUDE.md`, seluruh `docs/mockup-*.md`, `docs/frontend-*.md`, `docs/mockup-section-reports/section-00-*.md` s/d `section-14-accommodation.md` (khususnya bagian 17 "Protection Notes untuk Section Berikutnya" laporan Accommodation yang eksplisit menunjuk preseden D-070/D-071 untuk section ini), source code aktual (`app/types/project.ts`, `app/types/ticketing.ts`, `app/types/accommodation.ts`, `app/types/user.ts`, `app/constants/roles.ts`, `app/constants/navigation.ts`, `app/constants/status.ts`, `app/data/index.ts`, `app/data/projects.ts`, `app/data/vendors.ts`, `app/pages/projects/[id]/index.vue`, `app/pages/ticketing/**`/`app/pages/accommodation/**` sebagai pola modul+dokumen reference), `git status`, `git log`.

## 3. Existing Implementation yang Diperiksa

`git status` menunjukkan Section 06–14 masih uncommitted (belum di-commit user, dicatat apa adanya, tidak diganggu). `docs/frontend-known-issues.md` bagian 11 dan `docs/frontend-implementation-roadmap.md` baris 15 menandai section ini `PARTIAL` — role `transportation` sudah ada sejak Foundation, hanya menggerbangi sub-section transportation generik di tab "Itinerary & Services" (`canManageServiceType('transportation')`).

Audit langsung kode mengonfirmasi `ProjectService` (tipe `transportation`) hanya ada 1 baris (`SVC-1034`, "Ground Transportation", PRJ-103, status `pending-confirmation`, `vendorId: 'VND-003'`, TANPA `bookingReference`) — TIDAK ADA model lifecycle detail. Audit `app/data/vendors.ts` mengonfirmasi 2 `VendorQuotation` bersaing untuk `SVC-1034` (`VQ-009` VND-003 Rp45.000.000 "10 unit bus pariwisata", `VQ-010` VND-005 Rp52.000.000) MASIH `submitted` — belum diputuskan Procurement (Section 13 lama). Section ini TIDAK mengubah/memutuskan status kedua quotation tsb (di luar scope, keputusan tetap wewenang Procurement). Hanya PRJ-103 yang memiliki `transportation` di `serviceScope` (PRJ-101/102 tidak).

## 4. Decisions yang Digunakan

D-072 (`docs/mockup-design-decisions.md`, baru) — `TransportBooking` entitas baru terpisah dari `ProjectService`; modul top-level `/transportation` MENDAMPINGI (bukan menggantikan) tab Project Detail existing, pola arsitektur IDENTIK D-070/D-071 (Section 13/Ticketing, Section 14/Accommodation); manifest/group allocation DIREUSE dari `TravelerGroup`/`Traveler` (Section 11), supplier DIREUSE dari `Vendor`/`ProjectService.vendorId` (Section 13 lama); dua dokumen terpisah (Service Order client-facing tersanitasi vs Driver Sheet internal tanpa informasi harga sama sekali).

## 5. Implementation Summary

**Transfer/service request** — field `transferType` (`airport-pickup`/`airport-dropoff`/`point-to-point`/`full-day-charter`/`multi-day-charter`), ditampilkan di ringkasan dan dokumen.

**Pickup/drop-off, route, schedule + Multi-leg dispatch** — `TransportBooking.legs: TransportLeg[]` (embedded, pola sama `FlightSegment`) — pickupLocation/dropoffLocation/scheduledAt/label. `TRN-1034` mendemokan 3 leg (airport-hotel kedatangan, hotel-venue, hotel-airport kepulangan).

**Vehicle type, capacity, luggage, accessibility** — `TransportBooking.options: TransportOption[]` (embedded, pola sama `HotelOption`/`FlightOption`) — vehicleType/capacity/luggageCapacity/accessibilityFeatures/rateUnit/ratePerUnitIdr/isSelected. Tabel "Transport Options" membandingkan seluruh opsi, tombol "Pilih" (`selectTransportOption`, single-select toggle).

**Supplier, vehicle, driver, contact** — Supplier DIREUSE penuh dari `ProjectService.vendorId`/`Vendor` existing (Section 13 lama) — TIDAK ada entitas Supplier paralel. `assignedVehiclePlateNumber`/`driverName`/`driverPhone` field baru, terisi begitu status mencapai `assigned` ke atas (mock, D-006).

**Manifest/group allocation** — SENGAJA TIDAK diduplikasi. `groupId` (opsional) menautkan ke `TravelerGroup` (Section 11) existing; `travelerIds` menunjuk ke `Traveler` existing — SEKALIGUS berfungsi sebagai indikator individual vs group (`TRN-1037` 1 traveler = individual, `TRN-1034`/`1035`/`1036` banyak traveler = group) sesuai acceptance literal, tanpa flag/type terpisah.

**Standby/overtime/toll** — `standbyHours`/`overtimeHours`/`tollFeeIdr` field eksplisit terpisah dari rate dasar opsi kendaraan, ditampilkan sebagai badge ringkasan di header detail (`TRN-1034`: Standby 4 jam, Toll Rp150.000).

**Quote, assignment, confirmation, service order, driver sheet** — `TransportBookingStatus` (7 nilai literal), `TRANSPORT_BOOKING_TRANSITIONS` (peta eksplisit mengikuti urutan tahap literal): `requested→{quoted,cancelled}`, `quoted→{assigned,cancelled}`, `assigned→{confirmed,cancelled}`, `confirmed→{completed,cancelled,no-show}`. `updateTransportBookingStatus` mewajibkan alasan untuk `cancelled`/`no-show`, mencatat `ActivityEntry` pada project terkait. DUA halaman print-friendly terpisah (berbeda dari Ticketing/Accommodation yang hanya satu): `service-order-preview.vue` (client-facing, SANITIZED, hanya `sellPriceIdr`) dan `driver-sheet-preview.vue` (dokumen INTERNAL untuk driver lapangan — route/vehicle/driver/passenger manifest/kontak darurat/catatan operasional, TIDAK menampilkan `netCostIdr` MAUPUN `sellPriceIdr` sama sekali karena driver tidak butuh informasi harga).

**Change, cancellation, incident, no-show** — `hasChange`/`changeNote` (pola sama `FlightBooking.hasScheduleChange`, contoh `TRN-1035` jadwal city tour dimajukan) dan `hasIncident`/`incidentNote` (field BARU, terpisah dari "Change" karena bersifat tidak terduga, contoh `TRN-1036` unit diganti karena kendala AC) — keduanya flag informasional, BUKAN status lifecycle tambahan. TIDAK ada field "penalty" (berbeda dari Accommodation D-071) — literal Wajib Section 15 tidak menyebutkannya, sengaja tidak ditambahkan.

**Modul `/transportation`** — `ModuleKey` baru, pola list (`/transportation`, search/filter status+project, create dialog) + detail (`/transportation/[id]`, seluruh fitur di atas + dialog edit whole-form) — MENDAMPINGI ringkasan baru di sub-section transportation tab Itinerary & Services Project Detail (link + tombol "Buat Transport Booking" prefill `projectId`).

## 6. Routes

4 route baru: `/transportation` (list), `/transportation/[id]` (detail), `/transportation/[id]/service-order-preview` (dokumen client-facing), `/transportation/[id]/driver-sheet-preview` (dokumen internal driver). Tidak ada route existing yang di-rename/dihapus. `/projects/[id]` (sub-section transportation, tab Itinerary & Services) diperkaya pada route yang sama.

## 7. Files Created, Changed, dan Removed

**Created:**
- `app/types/transportation.ts`
- `app/data/transportation.ts`
- `app/pages/transportation/index.vue`
- `app/pages/transportation/[id]/index.vue`
- `app/pages/transportation/[id]/service-order-preview.vue`
- `app/pages/transportation/[id]/driver-sheet-preview.vue`
- `docs/mockup-section-reports/section-15-transportation.md` (laporan ini)

**Changed:**
- `app/types/user.ts` (`ModuleKey` +`transportation`)
- `app/constants/roles.ts` (`ROLE_MODULE_ACCESS` +kolom `transportation` seluruh 16 role)
- `app/constants/navigation.ts` (+menu "Transportation", +icon `Bus`)
- `app/constants/status.ts` (+`TRANSPORT_BOOKING_STATUSES`, `+VEHICLE_TYPES`)
- `app/data/index.ts` (+`getTransportBookingById`, `+getTransportBookingsByProject`, `+getTransportBookingsByService`, `+getTransportBookingMarginIdr`, `+createTransportBooking`, `+updateTransportBooking`, `+getTransportBookingStatusTransitions`, `+updateTransportBookingStatus`, `+selectTransportOption`)
- `app/pages/projects/[id]/index.vue` (+blok "Transport Bookings" di sub-section transportation, +computed `transportBookings`)
- `app/pages/admin/roles.vue` (+1 baris `modules`, +update teks `ROLE_NOTES['transportation']`)
- `docs/mockup-design-decisions.md` (+D-072)
- `docs/mockup-change-impact-log.md` (+CI-045)
- `docs/mockup-data-scenarios.md` (+bagian 4r)
- `docs/frontend-module-map.md`, `docs/frontend-workflow-map.md`, `docs/frontend-implementation-roadmap.md`, `docs/frontend-known-issues.md`
- `docs/mockup-implementation-state.md`, `docs/mockup-progress.md` (+Entri 24), `docs/mockup-section-progress.md`
- `docs/mockup-section-reports/README.md`

**Removed:** Tidak ada.

## 8. Components Reused/Created

Reused sepenuhnya: `PageHeader`, `SectionCard`, `DetailMetadataList`, `StatusBadge`, `EmptyState`, `RoleAccessState`, `Table*`, `Dialog*`/`DialogScrollContent`, `Checkbox`, `useToast`. Tidak ada shared component baru — pola halaman mengikuti persis `/ticketing`/`/accommodation` (list+detail) dan `eticket-preview.vue`/`voucher-preview.vue`/`run-sheet-preview.vue` (print preview, termasuk pola dokumen internal tanpa harga dari `run-sheet-preview.vue` D-069).

## 9. Types/Constants/Fixtures/Mock State

`+TransportBooking`/`TransportOption`/`TransportLeg`/`TransportBookingStatus`/`VehicleType`/`TransportRateUnit`/`TransferType` (entitas dan type baru, `app/types/transportation.ts`). `ModuleKey` +`transportation`. Fixture baru: 5 `TransportBooking` (`TRN-1034`/`1035`/`1036`/`1037`/`1038`), seluruhnya di PRJ-103 (satu-satunya project dengan `transportation` di `serviceScope`) — `TRN-1034` menautkan `serviceId: 'SVC-1034'` dan `groupId: 'GRP-001'` (rate kendaraan berada dalam skala yang sama dengan `VQ-009`/`VQ-010` TANPA memaksakan kesamaan angka persis), `TRN-1035`/`1036` menautkan `groupId` ke `GRP-002`/`GRP-003`, `TRN-1037` individual tanpa `groupId`, `TRN-1038` standalone tanpa `serviceId`/`groupId` — lihat `docs/mockup-data-scenarios.md` bagian 4r. Tidak ada fixture ID lama yang diganti/dihapus atau status `VendorQuotation` yang diubah.

## 10. Responsive Behavior

Tidak ada pola baru — seluruh halaman memakai `Table`/`Dialog`/`SectionCard` existing yang sudah responsive (grid `sm:grid-cols-*` untuk financial/summary, `DialogScrollContent` untuk form panjang di layar kecil).

## 11. States (Loading/Empty/Error/Unauthorized/Not-Found)

- `RoleAccessState` untuk `!canView('transportation')`.
- Not-found: "Transport Booking tidak ditemukan" (pola identik `/ticketing/[id]`/`/accommodation/[id]`) untuk ID yang tidak ada.
- Empty state: "Belum ada Transport Booking" (list kosong), "Belum ada opsi/leg/traveler ditugaskan" (detail kosong), "Belum ada rooming list" setara — "Belum ada leg tercatat"/"Belum ada traveler ditugaskan".
- Locked state: booking `completed`/`cancelled`/`no-show` — `updateTransportBooking` menolak edit, tombol "Edit" tetap tampil tapi mutasi ditolak silently sesuai guard (konsisten pola `HotelBooking`/`FlightBooking`); tombol transisi status habis (transisi kosong dari ketiga status terminal).
- Financial: "Net cost internal tidak ditampilkan untuk role ini" untuk role tanpa `canViewTransportFinancials`.

## 12. Role Behavior

`canManageTransportation` = `canManage('transportation')` (RANK-based standar) — hanya `transportation` (`MANAGE`) dan `super-admin` (`ADMIN`) yang mencapai rank tulis, TIDAK butuh narrow-role-exception tambahan (pola sama `ticketing`/`accommodation`, D-070/D-071). `canViewTransportFinancials` = `canManageTransportation || canViewFinancials` (gabungan existing `FULL_FINANCIAL_VISIBILITY_ROLES` DENGAN `transportation`, pola sama `canViewFlightFinancials`/`canViewAccommodationFinancials`). Role lain (Sales/AE/Product Planner/Procurement/Ticketing/Accommodation/MICE/Client/Supplier): `NONE`.

## 13. Validation Commands dan Hasilnya

- `npx nuxi prepare` — **sukses**.
- `npm run build` — **sukses**.
- `npx nuxi typecheck` — gagal, `vue-tsc` belum terpasang (Q8, pre-existing gap, 15 section berturut-turut).
- `npm run lint` — tidak tersedia (Q8, pre-existing).
- `npx vitest run` — "No test files found" (pre-existing).
- **Smoke test HTTP** — `/transportation`, `/transportation/TRN-1034`/`1035`/`1036`/`1037`/`1038`, `/transportation/TRN-9999` (not-found), `/transportation/TRN-1034/service-order-preview`, `/transportation/TRN-1034/driver-sheet-preview`, `/transportation/TRN-9999/service-order-preview`/`driver-sheet-preview` (not-found), plus regresi `/projects/PRJ-103?tab=itinerary-services`, `/admin/roles`, `/accommodation`, `/ticketing` — **seluruhnya HTTP 200**.
- **Smoke test konten** (curl+grep):
  - `/transportation` menampilkan 5 baris dengan unit `DN 1234 AB`/`DN 5678 CD`/`DN 9012 EF` dan badge status Assigned/Confirmed/Completed/Cancelled/Quoted (masing-masing 2 baris kecuali Quoted 2 — total 5 status lifecycle terwakili dari 7).
  - `TRN-1034` menampilkan driver "Herman Wijaya", opsi "Minibus" terpilih, badge "Standby 4 jam" dan "Toll Rp 150.000", serta Net Cost/Sell Price/Margin (role default demo Super Admin, `canViewTransportFinancials` true).
  - `TRN-1035` menampilkan banner "Change" dengan teks "...dimajukan dari 10:00...".
  - `TRN-1036` menampilkan banner "Incident" ("...kendala AC...") dan manifest menampilkan "Dedi Kurniawan" dengan catatan "Membutuhkan akses kursi roda" (reuse `Traveler.accessibilityNeeds`) serta opsi kendaraan "Ramp kursi roda, sabuk pengaman khusus".
  - `TRN-1037` menampilkan alasan pembatalan "...kendaraan pribadi..." dan TIDAK menampilkan tombol transisi apa pun (status terminal `cancelled`).
  - `TRN-9999` menampilkan "Transport Booking tidak ditemukan" (baik halaman detail maupun kedua dokumen preview).
  - `service-order-preview` TRN-1034 dikonfirmasi menampilkan "SERVICE ORDER" dan "Rp 7.200.000" (sell price) TANPA teks "Net Cost" di manapun.
  - `driver-sheet-preview` TRN-1034 dikonfirmasi menampilkan "DRIVER SHEET"/"Herman Wijaya"/"DN 1234 AB"/manifest traveler ("Michael Tanuwijaya"/"Putri Anggraeni") TAPI **nol kemunculan string "Rp" di seluruh halaman** — sanitasi ganda (client vs driver) terverifikasi presisi, bukan asumsi.
  - `/projects/PRJ-103?tab=itinerary-services` menampilkan blok "Transport Bookings" dengan seluruh 5 `TRN-*` dan link ke `/transportation/[id]`; `/admin/roles` menampilkan kolom "Transportation" baru.
  - Regresi `/accommodation`, `/ticketing`, `/accommodation/HTL-1022`, `/ticketing/FLT-1011`, `/projects/PRJ-102?tab=itinerary-services` dikonfirmasi tidak berubah.
- **Verifikasi interaktif** (klik pilih opsi, dialog transisi status dengan alasan wajib, toggle traveler assignment, submit create dialog) **tidak dilakukan headless** — keterbatasan tooling konsisten sejak Section 06. Dimitigasi lewat code review ketat terhadap seluruh guard (`updateTransportBookingStatus` menolak transisi tidak valid/tanpa alasan wajib, `updateTransportBooking` menolak edit saat status terminal) dan smoke test SSR konten yang membuktikan lifecycle, reuse manifest/supplier, sanitasi ganda, dan cross-link bekerja benar untuk 5 kondisi booking berbeda.

## 14. Regression

`app/pages/projects/[id]/index.vue` (dimiliki Section 12 lama/Foundation — hanya blok "Transport Bookings" ditambahkan DI DALAM sub-section transportation existing, tabel `ProjectService` generik dan tab lain TIDAK disentuh, dikonfirmasi via smoke test `?tab=overview`/`?tab=travelers`/`?tab=finance` tidak berubah). Tab "Travelers" (Section 11, `getTravelerGroups`/`Traveler`) TIDAK diubah shape-nya sama sekali. `app/pages/admin/roles.vue` (dimiliki Section 17 lama/Section 02 — hanya 1 baris array + 1 teks catatan ditambahkan). `app/constants/roles.ts` (`ROLE_MODULE_ACCESS` — seluruh 16 baris ditambah 1 properti `transportation`, nilai existing untuk 11 modul lain di setiap baris TIDAK diubah). `ProjectService`/`VendorQuotation` (Foundation/Section 13 lama, dipakai luas Dashboard/Reports/Vendor Management) TIDAK diubah shape maupun status-nya sama sekali.

## 15. Cross-Section Impact

`docs/mockup-change-impact-log.md` CI-045 — ringkasan Transport Booking di tab Itinerary & Services (Section 12 lama) dan kolom Matrix Role (Section 02/17 lama) — seluruhnya aditif, regression-tested. `VendorQuotation` VQ-009/VQ-010 (SVC-1034, Section 13 lama) TIDAK diubah statusnya — keputusan vendor tetap wewenang Procurement.

## 16. Known Issues dan Deferred Work

- Q8 (tooling lint/typecheck/test) tetap terbuka — 15 section berturut-turut.
- MICE (Section 16) TETAP `KNOWN_GAP` — belum ada modul dedicated setara `/transportation`/`/accommodation`/`/ticketing`; preseden arsitektur D-070/D-071/D-072 didokumentasikan eksplisit sebagai acuan.
- Verifikasi interaktif tidak dilakukan headless (keterbatasan tooling, konsisten sejak Section 06).
- `requested`/`no-show` (2 dari 7 status lifecycle) tidak di-seed pada fixture — tetap fully reachable lewat UI transisi, murni keterbatasan jumlah baris demo.
- Nomor polisi/driver mock — bukan integrasi fleet management nyata (D-006), murni teks referensi.

## 17. Protection Notes untuk Section Berikutnya

`TransportBooking` (D-072) — entitas TERPISAH dari `ProjectService`, jangan digabung/direstrukturisasi; `ProjectService` (Foundation, LOCKED secara de facto) TIDAK BOLEH diperluas dengan field spesifik-transportasi — field tsb HANYA hidup di `TransportBooking`. Booking yang sudah `completed`/`cancelled`/`no-show` bersifat terminal — `updateTransportBooking` sudah menolak edit lebih lanjut, jangan dilonggarkan tanpa keputusan baru. `netCostIdr`/`sellPriceIdr` TIDAK BOLEH tampil di `driver-sheet-preview.vue` (nol harga, bukan hanya net cost yang disembunyikan) — dan `netCostIdr` TIDAK BOLEH tampil di `service-order-preview.vue`. `VendorQuotation` VQ-009/VQ-010 (SVC-1034) JANGAN diubah statusnya oleh section manapun kecuali eksplisit bagian dari scope Procurement (Section 17 lama/Section 17 baru). **Preseden arsitektur modul top-level baru MENDAMPINGI tab Project Detail (bukan menggantikan), dua dokumen terpisah bila literal Wajib menyebut dua audiens/kebutuhan berbeda** — ikuti pola ini untuk Section 16 (MICE), JANGAN memindahkan konten tab existing ke top-level (D-020 tetap LOCKED untuk struktur tab itu sendiri).

## 18. Review URLs

Tidak ada deployment publik. Untuk review lokal: `npm run dev`, buka `http://localhost:8080/transportation` untuk daftar Transport Booking. Buka `http://localhost:8080/transportation/TRN-1034` untuk melihat assignment driver+unit, standby/toll, dan multi-leg dispatch. Buka `http://localhost:8080/transportation/TRN-1036` untuk melihat banner Incident dan manifest dengan catatan aksesibilitas (reuse Section 11). Buka `http://localhost:8080/transportation/TRN-1034/service-order-preview` untuk dokumen client-facing tersanitasi. Buka `http://localhost:8080/transportation/TRN-1034/driver-sheet-preview` untuk dokumen internal driver tanpa informasi harga sama sekali. Buka `http://localhost:8080/projects/PRJ-103?tab=itinerary-services` untuk melihat titik kolaborasi ringkasan Transport Booking di Project Detail.

## 19. Recommended Next Section

**Section 16 — MICE dan Event** (halaman dedicated, venue/BOQ/staffing mock, dashboard MICE tersendiri — saat ini role-only tanpa page dedicated, status PARTIAL), berbasis dependency (`docs/frontend-implementation-roadmap.md`), mengikuti preseden arsitektur D-070/D-071/D-072 — menunggu perintah eksplisit user.
