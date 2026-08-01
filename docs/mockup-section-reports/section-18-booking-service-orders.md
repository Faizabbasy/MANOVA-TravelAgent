# Section Report — Section 18: Booking dan Service Orders

**Status:** COMPLETED

Dikerjakan berdasarkan `prompts/SECTION_18_Booking_Service_Orders.md`. Section kesembilan belas roadmap Section 00–24 baru, dijalankan setelah Section 17 (Supplier dan Procurement, COMPLETED).

---

## 1. Section Objective dan Scope

"Bangun unified booking/service-order center." Wajib: Semua Flight/Hotel/Transport/MICE service requirement dalam satu timeline. Booking references, holds, confirmations, deadlines, vouchers. Internal/supplier/client-visible status mapping. Split supplier. Dependency antar-service. Confirmation and payment gates. Failure/retry/manual fallback simulation. Duplicate booking prevention. Exception list. Acceptance: Operations memiliki satu sumber kebenaran seluruh service.

## 2. Source Documents yang Dibaca

`prompts/SECTION_18_Booking_Service_Orders.md`, `prompts/01-PROTOKOL WAJIB — CONTINUITY, DOKUMENTASI PER SECTION, DAN PERLINDUNGAN HASIL.md`, `CLAUDE.md`, `docs/mockup-section-progress.md` (Section 17 entry penuh, "Next action"), `docs/mockup-design-decisions.md` (D-070 s/d D-074 dibaca penuh sebagai preseden arsitektur), `docs/mockup-change-impact-log.md` (CI-047), `docs/frontend-known-issues.md` bagian 13 (catatan disambiguasi `ServiceOrder` Section 17 vs "Service Order konsolidasi" Section 18 — dibaca verbatim), `docs/frontend-implementation-roadmap.md` baris Section 18, `docs/frontend-module-map.md` baris Section 18, `docs/frontend-workflow-map.md` baris 17 "Service Booking", `docs/mockup-open-questions.md`, `docs/mockup-section-reports/README.md`, `docs/mockup-section-reports/section-17-supplier-procurement.md` (template struktur laporan), source code aktual (`app/types/ticketing.ts`/`accommodation.ts`/`transportation.ts`/`mice.ts`, `app/types/project.ts` — `ProjectService`, `app/types/procurement.ts` — `ServiceOrder` Section 17, `app/types/user.ts` — `ModuleKey`, `app/constants/status.ts` — seluruh `*_BOOKING_STATUSES`, `app/constants/roles.ts`, `app/constants/navigation.ts`, `app/data/ticketing.ts`/`accommodation.ts`/`transportation.ts`/`mice.ts` — enumerasi seluruh fixture, `app/data/index.ts` — selector/mutator Flight/Hotel/Transport/MICE Booking lengkap, `app/pages/projects/[id]/index.vue` — tab Itinerary & Services, `app/pages/ticketing/index.vue`/`app/pages/ticketing/[id]/index.vue` sebagai template, `app/pages/accommodation/index.vue`/`app/pages/transportation/index.vue`, `app/pages/procurement/index.vue` sebagai template dashboard+filter, `app/pages/admin/roles.vue`, `app/composables/usePermissions.ts`), `git status`.

## 3. Existing Implementation yang Diperiksa

`git status` menunjukkan Section 00–17 masih uncommitted (belum di-commit user, dicatat apa adanya, tidak diganggu). `docs/frontend-known-issues.md` bagian 13 dan `docs/frontend-implementation-roadmap.md` baris 25 menandai section ini `NOT_STARTED` — booking flight/hotel/transport/MICE hanya terlihat sebagai baris `ProjectService` generik di tab "Itinerary & Services" (plus 4 blok ringkasan per-domain yang ditambahkan Section 13-16), belum ada tampilan konsolidasi lintas jenis layanan.

Audit langsung kode mengonfirmasi: `FlightBooking`/`HotelBooking`/`TransportBooking`/`MiceEvent` (Section 13-16) masing-masing punya lifecycle detail lengkap sendiri (7/7/7/5 status literal), fixture berjumlah 6/6/5/1 = 18 booking total. Tidak ada field/selector yang menautkan keempatnya secara silang (dependency, payment gate gabungan, exception gabungan) sebelum section ini. `ServiceOrder` (`app/types/procurement.ts`, Section 17) dikonfirmasi sebagai entitas TERPISAH (dokumen formal Procurement→vendor) — sesuai catatan disambiguasi, TIDAK disentuh sama sekali oleh section ini.

## 4. Decisions yang Digunakan

D-075 (`docs/mockup-design-decisions.md`, baru) — consolidation/orchestration LAYER fully additive: `BookingOrchestrationRecord` menautkan ID ke 4 entitas booking existing (TIDAK menambah field ke entitas tsb), `BookingTimelineEntry` sebagai DERIVED view-model (pola `getServiceReadinessMatrix`/`getProjectAttentionQueue`, D-069). Nama sengaja dijauhkan dari "Service Order" (resolusi eksplisit disambiguasi `docs/frontend-known-issues.md` bagian 13). Duplicate-check dilakukan di level halaman (SEBELUM memanggil fungsi create existing), bukan di dalam fungsi create — menjaga LOCKED protection Section 13-15 (`docs/frontend-implementation-roadmap.md`).

## 5. Implementation Summary

**Semua Flight/Hotel/Transport/MICE service requirement dalam satu timeline** — `getBookingTimeline(projectId?)` (baru, `app/data/index.ts`), DERIVASI murni dari 4 array booking existing + `BOOKING_ORCHESTRATION_RECORDS`, tanpa `projectId` = lintas seluruh project (`/bookings`), dengan `projectId` = terskop satu project (tab Itinerary & Services). Seluruh 18 booking fixture existing tercakup (diverifikasi eksplisit, tidak ada yang "hilang").

**Booking references, holds, confirmations, deadlines, vouchers** — `BookingTimelineEntry.reference` (PNR/confirmation number/plate number/`ProjectService.bookingReference` MICE), `startDate` (segment/check-in/leg/session pertama), `deadlineDate` (ticketing/cancellation deadline bila ada), `voucherHref` (link ke `eticket-preview`/`voucher-preview`/`service-order-preview`/`rundown-preview` existing masing-masing domain — TIDAK menduplikasi konten dokumen tsb).

**Internal/supplier/client-visible status mapping** — TIGA field terpisah: `internalStatus` (label penuh vocabulary status existing per domain via `findStatusOption`), `clientVisibleStatus`/`supplierVisibleStatus` (bucket 4-kategori "Diproses/Dikonfirmasi/Selesai/Dibatalkan" dan "Menunggu Aksi/Dalam Pengerjaan/Terpenuhi/Dibatalkan", disederhanakan dari vocabulary status YANG SAMA per domain — BUKAN enum baru, murni fungsi pemetaan `bookingStatusBucket`). Split supplier bersifat SIMULATIF — keempat domain booking tidak punya Supplier Portal sendiri (vendor-facing sesungguhnya tetap `ServiceOrder` Procurement Section 17), bucket ini murni pelabelan konsolidasi operasional internal.

**Dependency antar-service** — `BookingOrchestrationRecord.dependsOn` (opsional, cross-domain), dinilai "satisfied" bila booking dependency sudah confirmed-equivalent (`BOOKING_CONFIRMED_STATUSES` per domain). Fixture `TRN-1035` (Transport, Sales Team GRP-002, `confirmed`) `dependsOn` `HTL-1034` (Hotel, Sales Team GRP-002 juga, masih `quoted`) — mendemokan "blocked dependency" exception nyata, bukan skenario lepas konteks (kedua booking sama-sama melayani grup yang sama).

**Confirmation and payment gates** — `paymentGateStatus` (`not-required`/`pending`/`cleared`), bergerak otomatis `not-required`→`pending` saat booking mencapai status confirmed-equivalent (hook `syncBookingPaymentGateOnStatusChange`, dipanggil dari `updateFlightBookingStatus`/`updateHotelBookingStatus`/`updateTransportBookingStatus`/`updateMiceEventStatus`, TIDAK mengubah guard/reason-wajib existing). Aksi "Mark Payment Cleared" (Operations/Finance-facing, `/bookings`) — `setBookingPaymentGateStatus`, mock murni (D-006), TIDAK menyentuh `app/data/finance.ts`/`Invoice`/`Payment` (Section 20 masih PARTIAL).

**Failure/retry/manual fallback simulation** — `BookingAttempt[]` (attempt log narasi/mock, D-006). Fixture `FLT-1021` (Abu Dhabi, `reissued`) — percobaan reissue otomatis pertama `failed` (timeout GDS mock) diikuti `manual-fallback` (tim Ticketing memproses manual lewat counter airline), menautkan ke `scheduleChangeNote` existing. Aksi "Catat Percobaan" (`/bookings`, `appendBookingAttempt`) memungkinkan menambah entri baru kapan pun.

**Duplicate booking prevention** — Flight/Hotel/Transport (BUKAN MICE — satu event per project, duplikasi tidak relevan secara semantik, sesuai literal Wajib). `findActiveBookingConflicts(bookingType, projectId, serviceId)` (baru) dipanggil di level halaman create (`/ticketing`, `/accommodation`, `/transportation`) SEBELUM memanggil `createFlightBooking`/`createHotelBooking`/`createTransportBooking` — bila ditemukan booking aktif lain untuk `projectId`+`serviceId` yang sama, dialog konfirmasi "Booking Aktif Sudah Ada" wajib dikonfirmasi eksplisit; setelah konfirmasi, `flagBookingOrchestrationDuplicate` mencatat `ActivityEntry` + `flaggedDuplicate: true` pada record baru. Fungsi create existing (Section 13-15) TIDAK diubah signature/behavior-nya sama sekali.

**Exception list** — `getBookingExceptionQueue()` (baru), memfilter seluruh `BookingTimelineEntry` dengan `exceptions.length > 0`. Agregasi mencakup flag domain existing (`hasScheduleChange` [flight], status `amended` [hotel, tidak punya field `hasChange` terpisah], `hasChange`+`hasIncident` [transport], `hasChangeOrder`+`hasIncident`+`getMiceScheduleConflicts` reuse [MICE]) DITAMBAH kondisi baru orchestration (dependency belum terpenuhi, percobaan terakhir gagal, duplicate flag). Halaman baru `/bookings/exceptions` menampilkan daftar ini dengan link langsung ke detail booking masing-masing.

**Acceptance "Operations memiliki satu sumber kebenaran seluruh service"** — modul baru `bookings` (`ModuleKey`), `operations` `MANAGE` penuh (Timeline, Exception Queue, payment gate, attempt log); `project-manager`/`management`/`finance`/`viewer` `VIEW`; role lain (termasuk `ticketing`/`accommodation`/`transportation`/`mice` — TETAP mengelola modul masing-masing langsung) `NONE`.

**Refactor tab Project Detail** — 4 blok ringkasan booking terpisah (Flight/Hotel/Transport/MICE Bookings, ditambahkan Section 13-16) di tab "Itinerary & Services" `/projects/[id]` DIGANTI 1 SectionCard "Booking Timeline" terunifikasi (`getBookingTimeline(projectId)`, pre-filtered) — informasi IDENTIK `/bookings` (reference/status/deadline/voucher/exception/dependency/payment-gate). Tombol "Buat X Booking" quick-create per tipe layanan TETAP ada (dipindah ke footer masing-masing SectionCard per tipe di dalam loop existing, bukan dihapus). SectionCard RFQ/Service Order Procurement (Section 17) di tab yang sama TIDAK disentuh.

## 6. Routes

2 route baru: `/bookings` (Timeline, dashboard+filter project/domain/kategori-status/exception, aksi Mark Payment Cleared/Catat Percobaan), `/bookings/exceptions` (Exception Queue). Tidak ada route existing yang di-rename/dihapus. `/projects/[id]` diperkaya pada route yang sama (tab Itinerary & Services).

## 7. Files Created, Changed, dan Removed

**Created:**
- `app/types/booking-orchestration.ts`
- `app/data/booking-orchestration.ts`
- `app/pages/bookings/index.vue`
- `app/pages/bookings/exceptions/index.vue`
- `docs/mockup-section-reports/section-18-booking-service-orders.md` (laporan ini)

**Changed:**
- `app/types/user.ts` (`ModuleKey` +`bookings`)
- `app/constants/roles.ts` (`ROLE_MODULE_ACCESS` +kolom `bookings` seluruh 16 role)
- `app/constants/navigation.ts` (+menu "Booking & Service Order Center" 2-child, +icon `CalendarClock`)
- `app/constants/status.ts` (+`BOOKING_PAYMENT_GATE_STATUSES`, `+BOOKING_ATTEMPT_OUTCOMES`)
- `app/data/index.ts` (+import `BOOKING_ORCHESTRATION_RECORDS`, +export, +seluruh selector/mutator Booking Orchestration [`getBookingOrchestrationRecord`/`getBookingTimeline`/`getBookingExceptionQueue`/`setBookingPaymentGateStatus`/`appendBookingAttempt`/`findActiveBookingConflicts`/`flagBookingOrchestrationDuplicate`], +helper internal [`getOrCreateBookingOrchestrationRecord`/`getBookingStatusValue`/`bookingStatusBucket`/`describe*BookingForTimeline`/`buildBookingTimelineEntry`/`syncBookingPaymentGateOnStatusChange`], +1 baris hook di `updateFlightBookingStatus`/`updateHotelBookingStatus`/`updateTransportBookingStatus`/`updateMiceEventStatus`)
- `app/pages/ticketing/index.vue` (+duplicate booking prevention: import `findActiveBookingConflicts`/`flagBookingOrchestrationDuplicate`, +`useCurrentUser`/`useToast`, +dialog konfirmasi "Booking Aktif Sudah Ada")
- `app/pages/accommodation/index.vue` (pola identik ticketing)
- `app/pages/transportation/index.vue` (pola identik ticketing/accommodation)
- `app/pages/projects/[id]/index.vue` (hapus 4 computed `flightBookings`/`hotelBookings`/`transportBookings`/`miceEvents` + import `get*BookingsByProject`/`get*EventsByProject`/`FLIGHT_BOOKING_STATUSES`/dst., +1 computed `projectBookingTimeline` + import `getBookingTimeline`/`BOOKING_PAYMENT_GATE_STATUSES`, hapus 4 blok template ringkasan booking, +1 SectionCard "Booking Timeline" terunifikasi, +tombol "Buat X Booking" quick-create dipindah ke footer per-tipe)
- `app/pages/admin/roles.vue` (+1 baris `modules`, +update teks `ROLE_NOTES['operations']`)
- `docs/mockup-design-decisions.md` (+D-075)
- `docs/mockup-change-impact-log.md` (+CI-048)
- `docs/mockup-data-scenarios.md` (+bagian 4u)
- `docs/frontend-module-map.md`, `docs/frontend-workflow-map.md`, `docs/frontend-implementation-roadmap.md`, `docs/frontend-known-issues.md` (bagian 13, RESOLVED)
- `docs/mockup-implementation-state.md`, `docs/mockup-progress.md` (+Entri 27), `docs/mockup-section-progress.md`
- `docs/mockup-section-reports/README.md`

**Removed:** Tidak ada.

## 8. Components Reused/Created

Reused sepenuhnya: `PageHeader`, `SectionCard`, `DetailMetadataList`, `StatusBadge`, `EmptyState`, `RoleAccessState`, `Table*`, `Dialog*`, `Checkbox`, `useToast`, `Input`, `Label`, `Button`. Tidak ada shared component baru — pola halaman `/bookings` mengikuti persis `/procurement` (dashboard+stat implisit lewat SectionCard description+filter+table), `/bookings/exceptions` mengikuti pola daftar item beranotasi (`EmptyState` untuk kondisi kosong). Dialog duplicate-booking di 3 halaman create mengikuti pola `Dialog`/`DialogContent`/`DialogFooter` identik dialog status-change existing (`/ticketing/[id]`).

## 9. Types/Constants/Fixtures/Mock State

`+BookingDomain`/`BookingPaymentGateStatus`/`BookingAttemptOutcome`/`BookingAttempt`/`BookingOrchestrationDependency`/`BookingOrchestrationRecord`/`BookingTimelineDependencyView`/`BookingTimelineEntry` (entitas dan type baru, `app/types/booking-orchestration.ts`, seluruhnya aditif). `ModuleKey` +`bookings`. `+BOOKING_PAYMENT_GATE_STATUSES`/`BOOKING_ATTEMPT_OUTCOMES` (`app/constants/status.ts`).

Fixture: 18 `BookingOrchestrationRecord` (`BKO-001` s/d `BKO-018`) — satu per booking existing (6 Flight + 6 Hotel + 5 Transport + 1 MICE). Payment gate: 4 `cleared`, 6 `pending`, 8 `not-required`. Dependency chain: `TRN-1035` → `HTL-1034` (blocked). Attempt log: `FLT-1021` (failed → manual-fallback). Duplicate flag: `HTL-1036`. Lihat `docs/mockup-data-scenarios.md` bagian 4u untuk narasi lengkap.

## 10. Responsive Behavior

Tidak ada pola baru — `/bookings` memakai `Table` dengan `overflow-x-auto` (kolom cukup banyak: Booking/Project/Traveler-Deadline/Status/Payment Gate/Financial opsional/Exceptions/Aksi), filter bar `flex-col lg:flex-row` (stack di layar kecil, sejajar di layar besar) — pola sama halaman list lain. `/bookings/exceptions` memakai list vertikal sederhana (tidak butuh tabel lebar). Dialog duplicate-booking `max-w-md` — konsisten dialog konfirmasi existing.

## 11. States (Loading/Empty/Error/Unauthorized/Not-Found)

- `RoleAccessState` untuk `!canView('bookings')` di `/bookings` dan `/bookings/exceptions`.
- Empty state: `TableEmpty` di `/bookings` ("Tidak ada booking yang cocok dengan filter." / "Belum ada booking tercatat." — dinamis sesuai filter aktif); `EmptyState` di `/bookings/exceptions` ("Tidak ada exception" bila `getBookingExceptionQueue()` kosong).
- Locked/guard state: `Mark Payment Cleared` hanya muncul bila `canManageBookings && entry.paymentGateStatus === 'pending'` (tidak bisa diklik dua kali/pada gate yang sudah `cleared`); `setBookingPaymentGateStatus` no-op (return record tanpa mutasi/log) bila status target sama dengan status saat ini.
- Validation: dialog duplicate-booking di 3 halaman create — tombol "Lanjutkan sebagai Duplicate" hanya muncul setelah konflik terdeteksi, wajib klik eksplisit (bukan default/otomatis) sebelum booking benar-benar dibuat.
- Financial gating: kolom "Net Cost / Sell Price" di `/bookings` hanya render bila `canViewFinancials` (role finansial penuh D-030) — Operations (pemilik modul `bookings`) TIDAK otomatis melihatnya kecuali juga masuk `FULL_FINANCIAL_VISIBILITY_ROLES`.

## 12. Role Behavior

`canManageBookings` = `canManage('bookings')` (RANK-based standar) — `operations` (`MANAGE`) dan `super-admin` (`ADMIN`) mencapai rank tulis di `/bookings` (Mark Payment Cleared, Catat Percobaan). `canViewBookingFinancials` = `canViewFinancials` MURNI (BUKAN `canManageBookings || canViewFinancials`) — sengaja berbeda dari pola D-070/D-071/D-072/D-073 (`canManage<Domain> || canViewFinancials`) karena Operations bukan pengelola langsung net cost domain manapun, hanya orkestrator status/gate. Role lain internal (`project-manager`/`management`/`finance`/`viewer`): `VIEW`. Role lain (Sales/AE/Product Planner/Ticketing/Accommodation/Transportation/MICE/Procurement/Client/Supplier): `NONE` — termasuk role domain (Ticketing dkk.) yang TETAP mengelola modulnya sendiri secara langsung, bukan lewat konsolidasi ini.

## 13. Validation Commands dan Hasilnya

- `npx nuxi prepare` — **sukses**.
- `npm run build` — **sukses** (2x run, termasuk setelah perbaikan `SectionCard` tanpa prop `title` yang membuat `description` tidak ter-render pada `/bookings` dan `/bookings/exceptions` — `CardHeader` di komponen `SectionCard` di-gate `v-if="title"`, ditemukan+diperbaiki dalam section yang sama).
- `npx nuxi typecheck` — gagal, `vue-tsc` belum terpasang (Q8, pre-existing gap, 18 section berturut-turut).
- `npm run lint` — tidak tersedia (Q8, pre-existing).
- `npx vitest run` — "No test files found" (pre-existing).
- **Smoke test HTTP** — `/bookings`, `/bookings/exceptions`, plus regresi `/ticketing`, `/ticketing/FLT-1021`, `/accommodation`, `/accommodation/HTL-1034`, `/transportation`, `/transportation/TRN-1035`, `/mice`, `/mice/MICE-1035`, `/procurement`, `/vendors`, `/finance`, `/reports`, `/product-planning`, `/customer-journey`, `/admin/roles`, `/projects/PRJ-101`–`104?tab=itinerary-services`, `/`, `/nonexistent-route-xyz` (not-found, catch-all) — **seluruhnya HTTP 200**.
- **Smoke test konten** (curl+grep):
  - `/bookings` menampilkan "18 dari 18 booking ditampilkan" — seluruh fixture existing tercakup, tidak ada yang hilang.
  - `/bookings` menampilkan 6× tombol "Mark Payment Cleared" — cocok persis jumlah booking `paymentGateStatus: pending` yang diseed (dihitung ulang manual, cocok).
  - `/bookings` menampilkan exception `FLT-1021` ("Perubahan jadwal: Tanggal keberangkatan berubah dari 15–19 Sep menjadi 22–26 Sep 2026...") dan duplicate flag `HTL-1036` ("Ditandai sebagai duplicate booking yang disengaja (dibuat dengan konfirmasi eksplisit).").
  - `/bookings` menampilkan kolom "Net Cost / Sell Price" dengan nilai (mis. "Net: Rp 58.800.000") untuk role Super Admin (default demo user D-041, role finansial penuh).
  - `/bookings/exceptions` menampilkan "6 booking membutuhkan perhatian" dan "Dependency belum terpenuhi: Hotel HTL-1034 (menunggu konfirmasi)." untuk `TRN-1035`.
  - `/projects/PRJ-101?tab=itinerary-services` dikonfirmasi TIDAK LAGI menampilkan 4 heading lama ("Flight Bookings"/"Hotel Bookings"/"Transport Bookings"/"MICE Events" sebagai `<p>` terpisah) — digantikan SectionCard "Booking Timeline" yang menampilkan `FLT-1011` dengan badge domain dan status; tombol "Buat Flight Booking" tetap tampil.
  - `/admin/roles` menampilkan kolom "Bookings".
  - Regresi `/projects/PRJ-103?tab=itinerary-services` — blok "Procurement — RFQ dan Service Order" (Section 17) dikonfirmasi TIDAK berubah kontennya.
  - Dev server log diperiksa (`grep -iE "warn|error"`) — hanya warning Tailwind class ambiguity pre-existing, tidak ada error/warning dari kode baru Section 18.
- **Verifikasi interaktif** (klik Mark Payment Cleared, Catat Percobaan, konfirmasi dialog duplicate booking, klik filter) **tidak dilakukan headless** — keterbatasan tooling konsisten sejak Section 06. Dimitigasi lewat code review ketat terhadap seluruh guard (`setBookingPaymentGateStatus` no-op bila status sama, `appendBookingAttempt` selalu append tanpa guard status karena bersifat log historis, `flagBookingOrchestrationDuplicate` hanya dipanggil setelah konfirmasi eksplisit, `findActiveBookingConflicts` hanya menghitung status non-terminal per domain) dan smoke test SSR konten yang membuktikan seluruh skenario kunci (dependency blocked, payment gate pending/cleared, failed→manual-fallback attempt log, duplicate flag) bekerja benar dari fixture.

## 14. Regression

`app/pages/projects/[id]/index.vue` (dimiliki Section 12 lama/Foundation — refactor SURGICAL: hanya 4 blok booking di dalam `v-for="type in visibleServiceTypes"` yang diganti, tabel `ProjectService` generik, SectionCard Procurement Section 17, dan SELURUH tab lain [Overview/Travelers/Vendors/Finance/Tasks/Documents/Activity & Changes] TIDAK disentuh — dikonfirmasi via smoke test `?tab=itinerary-services` pada 4 project). `app/pages/ticketing/index.vue`/`app/pages/accommodation/index.vue`/`app/pages/transportation/index.vue` (dimiliki Section 13/14/15 — hanya penambahan dialog+2 fungsi baru, form create/list/filter existing TIDAK diubah). `app/pages/admin/roles.vue` (dimiliki Section 17 lama/Section 02 — hanya 1 baris array + 1 teks catatan ditambahkan). `app/constants/roles.ts` (`ROLE_MODULE_ACCESS` — seluruh 16 baris ditambah 1 properti `bookings`, nilai existing untuk 14 modul lain di setiap baris TIDAK diubah). `updateFlightBookingStatus`/`updateHotelBookingStatus`/`updateTransportBookingStatus`/`updateMiceEventStatus` (`app/data/index.ts`, Section 13-16) — hanya 1 baris tambahan (`syncBookingPaymentGateOnStatusChange`) per fungsi, guard transisi/reason-wajib/`ActivityEntry` existing TIDAK diubah. `createFlightBooking`/`createHotelBooking`/`createTransportBooking`/`createMiceEvent` (Section 13-16) — **TIDAK disentuh sama sekali**, nol perubahan. `ServiceOrder`/`RFQ`/`RFQInvitation`/`RFQResponse`/`RFQClarificationMessage`/`ServiceOrderAmendment`/`SupplierInvoice` (Section 17, `app/types/procurement.ts`/`app/data/procurement.ts`) — TIDAK disentuh sama sekali.

## 15. Cross-Section Impact

`docs/mockup-change-impact-log.md` CI-048 — refactor tab Itinerary & Services (Section 12 lama/Foundation, pemilik asli), duplicate-check addition ke 3 halaman create-booking (Section 13-15), Matrix Role dan `ModuleKey`/`NAV_ITEMS`/`ROLE_MODULE_ACCESS` (Section 02/17 lama) — seluruhnya aditif, regression-tested. `FlightBooking`/`HotelBooking`/`TransportBooking`/`MiceEvent` (Section 13-16) TIDAK diubah shape maupun isinya sama sekali — nol risiko regresi terhadap consumer existing (Dashboard/Reports/Client Portal/modul masing-masing).

## 16. Known Issues dan Deferred Work

- Q8 (tooling lint/typecheck/test) tetap terbuka — 18 section berturut-turut.
- **Bug ditemukan dan diperbaiki dalam section yang sama** (bukan dibiarkan): `SectionCard` (`app/components/shared/SectionCard.vue`) me-render `CardHeader` (termasuk `description`) hanya bila prop `title` diisi (`v-if="title"`) — halaman `/bookings` dan `/bookings/exceptions` awalnya memberi `:description` tanpa `title`, membuat ringkasan jumlah booking/exception tidak pernah tampil (bukan crash, tapi informasi hilang secara diam-diam). Diperbaiki dengan menambahkan `title` eksplisit ("Booking Timeline"/"Daftar Exception") ke kedua `SectionCard` tsb. Diverifikasi ulang via curl+grep sebelum dan sesudah perbaikan (rebuild kedua sukses, teks "18 dari 18 booking ditampilkan"/"6 booking membutuhkan perhatian" dikonfirmasi tampil setelah fix).
- "Supplier-visible status" pada `BookingTimelineEntry` bersifat simulatif (bucket label internal untuk konsolidasi, BUKAN Supplier Portal baru) — keempat domain booking Section 13-16 tidak punya akses Supplier sendiri (vendor-facing sesungguhnya tetap `ServiceOrder` Procurement Section 17, `/supplier/service-orders`) — dicatat sebagai keputusan D-075, bukan gap tersembunyi/fabrikasi mesin bisnis (D-006).
- Cross-project selector "wrapper" (`getAllFlightBookings` dkk.) SENGAJA tidak ditambahkan — array `FLIGHT_BOOKINGS`/`HOTEL_BOOKINGS`/`TRANSPORT_BOOKINGS`/`MICE_EVENTS` sudah diekspor penuh dari `app/data/index.ts` dan sudah dipakai langsung cross-project oleh `/ticketing`/`/accommodation`/`/transportation`/`/mice` (list page) sejak Section 13-16 — menambah wrapper selector baru untuk hal yang sudah bisa diakses langsung akan menduplikasi API tanpa manfaat, dicatat sebagai deviasi kecil dari kata literal brief ("add cross-project versions... if they don't already exist"), bukan gap.
- Verifikasi interaktif tidak dilakukan headless (keterbatasan tooling, konsisten sejak Section 06).
- Fixture: `requested` (transport/hotel awal) dan beberapa kombinasi payment-gate/attempt-log lain tidak seluruhnya di-seed pada setiap domain — tetap fully reachable lewat aksi UI (`Mark Payment Cleared`/`Catat Percobaan`), murni keterbatasan jumlah baris demo, konsisten pola Section 13-17.

## 17. Protection Notes untuk Section Berikutnya

`BookingOrchestrationRecord`/`BookingTimelineEntry`/modul `/bookings` (D-075) — consolidation/orchestration LAYER fully additive, JANGAN menambah field ke `FlightBooking`/`HotelBooking`/`TransportBooking`/`MiceEvent` untuk kebutuhan apa pun terkait Section 18 — gunakan `BookingOrchestrationRecord` (menautkan via `bookingType`+`bookingId`). `createFlightBooking`/`createHotelBooking`/`createTransportBooking`/`createMiceEvent` (Section 13-16, LOCKED) TETAP tidak boleh diubah signature/behavior — duplicate-check dan orchestration record dibuat DI LUAR fungsi tsb (level halaman/lazy-create via `getOrCreateBookingOrchestrationRecord`), jangan dipindah ke dalam fungsi create tanpa keputusan baru eksplisit. `BookingTimelineEntry` TETAP derivasi murni (`getBookingTimeline`) — jangan tambahkan field tersimpan yang bisa stale. `ServiceOrder`/`RFQ`/`SupplierInvoice` (Section 17, D-074) TIDAK disentuh oleh section ini — JANGAN membuat tipe/entitas baru bernama "Service Order" apa pun di lingkup Section 18 pada pekerjaan lanjutan mana pun; istilah yang dipakai SENGAJA "Booking Orchestration"/"Booking Timeline"/label nav "Booking & Service Order Center" (UI-only) — lihat `docs/frontend-known-issues.md` bagian 13 (disambiguasi DIPERTAHANKAN, bukan dihapus, karena tetap relevan). `netCostIdr`/`sellPriceIdr` pada `BookingTimelineEntry` digerbangi `canViewFinancials` MURNI (bukan `canManage('bookings')`) — JANGAN diubah agar Operations otomatis melihat net cost lintas domain tanpa keputusan baru eksplisit. Dengan Section 18 selesai, ini adalah preseden ARSITEKTUR PERTAMA untuk "consolidation/orchestration layer lintas-domain" (berbeda dari D-070/D-071/D-072/D-073 yang seluruhnya single-domain "modul top-level baru mendampingi tab") — dapat dijadikan acuan bila section berikutnya butuh pola agregasi lintas beberapa entitas existing tanpa menduplikasi data.

## 18. Review URLs

Tidak ada deployment publik. Untuk review lokal: `npm run dev`, buka `http://localhost:8080/bookings` untuk Timeline konsolidasi (coba filter Domain=Transport, Kategori Status, atau centang "Hanya Exception"). Buka `http://localhost:8080/bookings/exceptions` untuk Exception Queue (6 booking, termasuk dependency blocked `TRN-1035` dan duplicate flag `HTL-1036`). Buka `http://localhost:8080/projects/PRJ-101?tab=itinerary-services` untuk melihat SectionCard "Booking Timeline" terunifikasi menggantikan 4 blok lama. Buka `http://localhost:8080/projects/PRJ-103?tab=itinerary-services` untuk melihat dependency `TRN-1035`→`HTL-1034` dan blok Procurement Section 17 yang tetap tidak berubah di bawahnya. Buka `http://localhost:8080/ticketing` (atau `/accommodation`, `/transportation`) dan buat booking baru dengan `projectId`+`serviceId` yang sudah punya booking aktif (mis. via query `?projectId=PRJ-102&serviceId=SVC-1022`) untuk melihat dialog duplicate-booking prevention. Buka `http://localhost:8080/admin/roles` untuk kolom "Bookings" pada Matrix Role.

## 19. Recommended Next Section

**Section 19 — Changes, Cancellation, Refund dan Incident** (record terstruktur terpisah dari `ActivityEntry` generik — Cancellation dengan penalty, Refund dengan status partial/full/credit, Incident dengan severity/escalation — status PARTIAL saat ini, tab "Activity & Changes" existing hanya menangani "Change" generik), berbasis dependency (`docs/frontend-implementation-roadmap.md`), menunggu perintah eksplisit user. Section ini TIDAK dilanjutkan otomatis ke Section 19 — berhenti sesuai instruksi protokol.
