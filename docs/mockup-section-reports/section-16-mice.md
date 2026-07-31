# Section Report — Section 16: MICE dan Event

**Status:** COMPLETED

Dikerjakan berdasarkan `prompts/SECTION_16_MICE_Event.md`. Section ketujuh belas roadmap Section 00–24 baru, dijalankan setelah Section 15 (Transportation, COMPLETED).

---

## 1. Section Objective dan Scope

"Lengkapi MICE/Event frontend." Wajib: Brief, venue, rooms/sessions, agenda/rundown; Participant categories; Catering, AV, staging, equipment, booths; Vendor packages dan BOQ; Staffing/PIC; Setup/teardown/rehearsal/permit checklist; Capacity and schedule conflicts; Client approval states; Change order, incident, attendance, deliverables. Acceptance: MICE role dapat mengelola event dari planning sampai post-event completion.

## 2. Source Documents yang Dibaca

`prompts/SECTION_16_MICE_Event.md`, `prompts/01-PROTOKOL WAJIB — CONTINUITY, DOKUMENTASI PER SECTION, DAN PERLINDUNGAN HASIL.md`, `CLAUDE.md`, seluruh `docs/mockup-*.md`, `docs/frontend-*.md`, `docs/mockup-section-reports/section-00-*.md` s/d `section-15-transportation.md` (khususnya bagian 17 "Protection Notes untuk Section Berikutnya" laporan Transportation yang eksplisit menunjuk preseden D-070/D-071/D-072 untuk section ini), source code aktual (`app/types/project.ts`, `app/types/ticketing.ts`, `app/types/accommodation.ts`, `app/types/transportation.ts`, `app/types/user.ts`, `app/constants/roles.ts`, `app/constants/navigation.ts`, `app/constants/status.ts`, `app/data/index.ts`, `app/data/projects.ts`, `app/data/vendors.ts`, `app/data/activity.ts`, `app/data/users.ts`, `app/pages/projects/[id]/index.vue`, `app/pages/ticketing/**`/`app/pages/accommodation/**`/`app/pages/transportation/**` sebagai pola modul+dokumen reference), `git status`, `git log`.

## 3. Existing Implementation yang Diperiksa

`git status` menunjukkan Section 06–15 masih uncommitted (belum di-commit user, dicatat apa adanya, tidak diganggu). `docs/frontend-known-issues.md` bagian 11 dan `docs/frontend-implementation-roadmap.md` baris 16 menandai section ini `PARTIAL` — role `mice` sudah ada sejak Foundation, hanya menggerbangi sub-section mice generik di tab "Itinerary & Services" (`canManageServiceType('mice')`).

Audit langsung kode mengonfirmasi `ProjectService` (tipe `mice`) hanya ada 1 baris (`SVC-1035`, "Venue & Rundown Acara", PRJ-103, status `confirmed`, `bookingReference: 'MICE-PLW-VEN01'`, `vendorId: 'VND-004'`) — TIDAK ADA model detail brief/venue/sessions/BOQ/staffing/checklist. Audit `app/data/vendors.ts` mengonfirmasi `VQ-006` (VND-004, Rp280.000.000, `accepted`) sebagai vendor package yang sudah diterima untuk event ini. Audit `app/data/activity.ts` menemukan 3 record existing yang secara langsung relevan dan BELUM pernah ditautkan ke model event manapun: `TSK-1032` ("Konfirmasi venue MICE hari ke-2", `pending-confirmation`), `TSK-1033` ("Kirim rundown acara ke client", `not-started`, depends-on `TSK-1032`), dan `RSK-1031` ("Ketersediaan venue MICE hari ke-2 belum terkonfirmasi final", risk `open` `high`) — ketiganya digunakan sebagai dasar narasi Change Order pada fixture (bagian 9), bukan diubah. Hanya PRJ-103 yang memiliki `mice` di `serviceScope`.

## 4. Decisions yang Digunakan

D-073 (`docs/mockup-design-decisions.md`, baru) — `MiceEvent` entitas baru terpisah dari `ProjectService`; modul top-level `/mice` MENDAMPINGI (bukan menggantikan) tab Project Detail existing, pola arsitektur IDENTIK D-070/D-071/D-072 (Section 13-15) namun dengan struktur SATU event kaya (bukan banyak booking); staffing/PIC dan vendor package DIREUSE dari `User`/`Vendor` existing; "Client approval states" terpisah dari status event; "Capacity and schedule conflicts" sebagai derivasi advisory; dua dokumen client-facing tersanitasi (Rundown dan BOQ).

## 5. Implementation Summary

**Brief, venue** — field `brief`/`venueName`/`venueAddress` literal, ditampilkan di header detail dan kedua dokumen preview.

**Rooms/sessions, agenda/rundown** — `MiceEvent.sessions: MiceSession[]` (embedded) — roomName/sessionTitle/startAt/endAt/capacity/picUserId/isConfirmed. `isConfirmed` (field baru, tidak ada di Section 13-15) membedakan sesi final vs tentatif — dipakai juga sebagai sinyal narasi (fixture: sesi Hari 2 `isConfirmed: false`, menautkan `TSK-1032`).

**Participant categories + Attendance** — `MiceParticipantCategory[]` — `expectedCount`/`actualCount` dalam SATU struct (bukan dua array terpisah), karena Attendance secara literal adalah realisasi Participant Categories yang sama.

**Catering, AV, staging, equipment, booths + Vendor packages dan BOQ** — `MiceBoqItem[]` (6 kategori: catering/av/staging/equipment/booth/other), `vendorId` opsional DIREUSE dari `Vendor` existing (Section 13 lama) — TIDAK ada entitas Supplier paralel. `getMiceBoqTotals` (selector baru) — DERIVASI murni (pola sama `getCostSheetBreakdown`), bukan field tersimpan yang bisa stale.

**Staffing/PIC** — `MiceStaffAssignment[]` — `userId` DIREUSE dari `User` existing (Section 02) — TIDAK ada entitas staff internal paralel.

**Setup/teardown/rehearsal/permit checklist + Deliverables** — `MiceChecklistItem[]`/`MiceDeliverable[]` embedded, masing-masing dengan toggle langsung (`toggleMiceChecklistItem`/`toggleMiceDeliverable`) tanpa perlu dialog Edit — checklist/deliverable adalah interaksi tick-list yang wajar cepat, berbeda dari sessions/BOQ/staffing yang butuh form terstruktur.

**Capacity and schedule conflicts** — `getMiceScheduleConflicts` (selector baru) — DERIVASI murni, ADVISORY (TIDAK memblokir transisi status apa pun, pola sama Departure Readiness Gate D-069). Mendeteksi (a) sesi tumpang tindih waktu di room yang sama, dan (b) kapasitas sesi lebih kecil dari total peserta yang diharapkan. Fixture `MICE-1035` mendemokan kondisi (b) secara nyata — venue Hari 2 alternatif kapasitas 100 pax < 125 peserta diharapkan, ditampilkan sebagai banner peringatan di detail page.

**Client approval states** — `MiceApprovalStatus` (`draft`/`submitted`/`approved`/`rejected`) TERPISAH dari `MiceEventStatus` (`planning`/`confirmed`/`in-progress`/`completed`/`cancelled`), pola sama `QuotationApprovalStatus` terpisah dari `OpportunityStage` (D-049). `rejected` dapat direvisi-dan-diajukan-ulang (`submitted`); `approved` bersifat stabil — perubahan lanjutan lewat "Change Order", bukan re-approval. Direkam oleh role `mice`/internal (representasi keputusan client), TIDAK menyentuh Client Portal (di luar scope literal, menjaga perubahan lintas-section minimal).

**Change order, incident, attendance, deliverables** — `hasChangeOrder`/`changeOrderNote` dan `hasIncident`/`incidentNote` (pola IDENTIK `TransportBooking.hasChange`/`hasIncident`, D-072) — dua flag informasional terpisah, BUKAN status lifecycle tambahan. Fixture mendemokan keduanya aktif sekaligus (Change Order = venue Hari 2 tentatif + rundown belum dikirim client; Incident = keterlambatan unit AV cadangan Hari 1, teratasi).

**Dua dokumen client-facing** — `rundown-preview.vue` (agenda/sessions/venue/brief, TANPA angka finansial sama sekali — rundown secara literal adalah dokumen agenda) dan `boq-preview.vue` (breakdown BOQ per baris + total, HANYA `sellPriceIdr`, `netCostIdr` TIDAK PERNAH tampil). Berbeda dari Transportation (1 client-facing + 1 internal driver sheet) — MICE tidak punya dokumen internal-only karena literal Wajib Section 16 tidak menyebut audiens internal terpisah.

**Modul `/mice`** — `ModuleKey` baru, pola list (`/mice`, search/filter status+project, create dialog) + detail (`/mice/[id]`, seluruh fitur di atas dengan 5 dialog array-editor terpisah — Sessions/Participants/BOQ/Staffing masing-masing, plus 1 dialog Edit info dasar+Change Order+Incident, plus 2 quick-add dialog untuk Checklist/Deliverable) — MENDAMPINGI ringkasan baru di sub-section mice tab Itinerary & Services Project Detail.

## 6. Routes

4 route baru: `/mice` (list), `/mice/[id]` (detail), `/mice/[id]/rundown-preview` (dokumen agenda client-facing), `/mice/[id]/boq-preview` (dokumen budget client-facing). Tidak ada route existing yang di-rename/dihapus. `/projects/[id]` (sub-section mice, tab Itinerary & Services) diperkaya pada route yang sama.

## 7. Files Created, Changed, dan Removed

**Created:**
- `app/types/mice.ts`
- `app/data/mice.ts`
- `app/pages/mice/index.vue`
- `app/pages/mice/[id]/index.vue`
- `app/pages/mice/[id]/rundown-preview.vue`
- `app/pages/mice/[id]/boq-preview.vue`
- `docs/mockup-section-reports/section-16-mice.md` (laporan ini)

**Changed:**
- `app/types/user.ts` (`ModuleKey` +`mice`)
- `app/constants/roles.ts` (`ROLE_MODULE_ACCESS` +kolom `mice` seluruh 16 role)
- `app/constants/navigation.ts` (+menu "MICE", +icon `Presentation`)
- `app/constants/status.ts` (+`MICE_EVENT_STATUSES`, `+MICE_APPROVAL_STATUSES`, `+MICE_BOQ_CATEGORIES`, `+MICE_CHECKLIST_TASKS`)
- `app/data/index.ts` (+`getMiceEventById`, `+getMiceEventsByProject`, `+getMiceEventsByService`, `+getMiceBoqTotals`, `+getMiceScheduleConflicts`, `+createMiceEvent`, `+updateMiceEvent`, `+getMiceEventStatusTransitions`, `+updateMiceEventStatus`, `+getMiceApprovalTransitions`, `+updateMiceClientApproval`, `+toggleMiceChecklistItem`, `+toggleMiceDeliverable`)
- `app/pages/projects/[id]/index.vue` (+blok "MICE Events" di sub-section mice, +computed `miceEvents`)
- `app/pages/admin/roles.vue` (+1 baris `modules`, +update teks `ROLE_NOTES['mice']`)
- `docs/mockup-design-decisions.md` (+D-073)
- `docs/mockup-change-impact-log.md` (+CI-046)
- `docs/mockup-data-scenarios.md` (+bagian 4s)
- `docs/frontend-module-map.md`, `docs/frontend-workflow-map.md`, `docs/frontend-implementation-roadmap.md`, `docs/frontend-known-issues.md`
- `docs/mockup-implementation-state.md`, `docs/mockup-progress.md` (+Entri 25), `docs/mockup-section-progress.md`
- `docs/mockup-section-reports/README.md`

**Removed:** Tidak ada.

## 8. Components Reused/Created

Reused sepenuhnya: `PageHeader`, `SectionCard`, `DetailMetadataList`, `StatusBadge`, `EmptyState`, `RoleAccessState`, `Table*`, `Dialog*`/`DialogScrollContent`, `Checkbox`, `useToast`. Tidak ada shared component baru — pola halaman mengikuti persis `/ticketing`/`/accommodation`/`/transportation` (list+detail, array-editor dalam Dialog) dan `eticket-preview.vue`/`voucher-preview.vue`/`service-order-preview.vue` (print preview client-facing tersanitasi).

## 9. Types/Constants/Fixtures/Mock State

`+MiceEvent`/`MiceSession`/`MiceParticipantCategory`/`MiceBoqItem`/`MiceBoqCategory`/`MiceStaffAssignment`/`MiceChecklistItem`/`MiceChecklistTask`/`MiceDeliverable`/`MiceEventStatus`/`MiceApprovalStatus` (entitas dan type baru, `app/types/mice.ts`). `ModuleKey` +`mice`. Fixture: SATU `MiceEvent` (`MICE-1035`) — berbeda dari Section 13-15 yang punya banyak baris, realita satu event MICE utama per project — menautkan `serviceId: 'SVC-1035'`, 2 sessions (Hari 1 confirmed kapasitas 150, Hari 2 tentatif kapasitas 100 menautkan `TSK-1032`/`RSK-1031`), 4 participant category (total 125 pax expected, 120 actual sejauh ini), 6 baris BOQ (5 ke `VND-004`, 1 ke `VND-007`), 3 staffing assignment (`USR-007`/`002`/`009`), 5 checklist item, 3 deliverable, Change Order + Incident aktif — lihat `docs/mockup-data-scenarios.md` bagian 4s. Tidak ada fixture ID lama yang diganti/dihapus, `VQ-006`/`RSK-1031`/`TSK-1032`/`1033`/`SFT-1032` HANYA dirujuk secara naratif.

## 10. Responsive Behavior

Tidak ada pola baru — seluruh halaman memakai `Table`/`Dialog`/`SectionCard` existing yang sudah responsive (grid `sm:grid-cols-*` untuk financial/summary, `DialogScrollContent` untuk 5 dialog array-editor yang cukup panjang di layar kecil).

## 11. States (Loading/Empty/Error/Unauthorized/Not-Found)

- `RoleAccessState` untuk `!canView('mice')`.
- Not-found: "MICE Event tidak ditemukan" (pola identik section lain) untuk ID yang tidak ada — berlaku di halaman detail MAUPUN kedua dokumen preview.
- Empty state per SectionCard: "Belum ada sesi/kategori peserta/baris BOQ/staffing/checklist item/deliverable tercatat" — masing-masing array embedded punya empty state sendiri.
- Locked state: event `completed`/`cancelled` — `updateMiceEvent` (dan turunannya `toggleMiceChecklistItem`/`toggleMiceDeliverable`) menolak edit lebih lanjut, tombol "Edit"/"Kelola X" tetap tampil tapi mutasi ditolak silently sesuai guard (konsisten pola section 13-15); tombol transisi status habis dari kedua status terminal.
- Financial: "Net cost internal tidak ditampilkan untuk role ini" untuk role tanpa `canViewMiceFinancials`.

## 12. Role Behavior

`canManageMice` = `canManage('mice')` (RANK-based standar) — hanya `mice` (`MANAGE`) dan `super-admin` (`ADMIN`) yang mencapai rank tulis, TIDAK butuh narrow-role-exception tambahan (pola sama section 13-15, D-070/D-071/D-072). `canViewMiceFinancials` = `canManageMice || canViewFinancials` (gabungan existing `FULL_FINANCIAL_VISIBILITY_ROLES` DENGAN `mice`, pola sama section 13-15). Role lain (Sales/AE/Product Planner/Procurement/Ticketing/Accommodation/Transportation/Client/Supplier): `NONE`.

## 13. Validation Commands dan Hasilnya

- `npx nuxi prepare` — **sukses**.
- `npm run build` — **sukses**.
- `npx nuxi typecheck` — gagal, `vue-tsc` belum terpasang (Q8, pre-existing gap, 16 section berturut-turut).
- `npm run lint` — tidak tersedia (Q8, pre-existing).
- `npx vitest run` — "No test files found" (pre-existing).
- **Smoke test HTTP** — `/mice`, `/mice/MICE-1035`, `/mice/MICE-9999` (not-found), `/mice/MICE-1035/rundown-preview`, `/mice/MICE-1035/boq-preview`, `/mice/MICE-9999/rundown-preview`/`boq-preview` (not-found), plus regresi `/projects/PRJ-103?tab=itinerary-services`, `/admin/roles`, `/accommodation`, `/ticketing`, `/transportation` — **seluruhnya HTTP 200**.
- **Smoke test konten** (curl+grep):
  - `/mice` menampilkan venue "Hotel Prima Mitra", status "In Progress", client approval "Disetujui".
  - `/mice/MICE-1035` menampilkan banner "Capacity / Schedule Conflict" dengan teks presisi "\"...\" — kapasitas ruangan (100 pax) lebih kecil dari total peserta yang diharapkan (125 pax)." — dihitung ulang manual (60+10+40+15=125) dan cocok persis; banner "Change Order" dan "Incident" tampil dengan narasi masing-masing; PIC "Lina Marlina" tampil di summary dan staffing; Net Cost/Sell Price/Margin tampil (role default demo Super Admin).
  - `/mice/MICE-9999` menampilkan "MICE Event tidak ditemukan" (halaman detail dan kedua dokumen preview).
  - `rundown-preview` MICE-1035 dikonfirmasi menampilkan "RUNDOWN"/"Ballroom Utama" (2 sesi) TANPA satu pun angka "Rp" — sanitasi maksimal (bukan hanya net cost, seluruh finansial disembunyikan dari dokumen agenda).
  - `boq-preview` MICE-1035 dikonfirmasi menampilkan 6 baris sell price (Rp55jt/72jt/100jt/18jt/25jt/12jt) DAN total "Rp 282.000.000" (dihitung ulang manual dan cocok persis) — TIDAK ADA satu pun angka net cost (Rp45jt/60jt/87,5jt/15jt/20jt/8jt maupun total Rp235,5jt) muncul di halaman (diverifikasi presisi dengan pencarian konteks penuh, bukan asumsi dari grep sederhana yang sempat false-positive pada substring "18.000.000").
  - Regresi `/projects/PRJ-103?tab=itinerary-services` (blok "MICE Events" menampilkan MICE-1035 dengan link ke `/mice/[id]`), `/admin/roles` (kolom "MICE" baru), dan `/accommodation`/`/ticketing`/`/transportation` (modul section sebelumnya) dikonfirmasi tidak berubah.
- **Verifikasi interaktif** (klik toggle checklist/deliverable, dialog array-editor Sessions/Participants/BOQ/Staffing, transisi status dan client approval dengan dialog alasan wajib) **tidak dilakukan headless** — keterbatasan tooling konsisten sejak Section 06. Dimitigasi lewat code review ketat terhadap seluruh guard (`updateMiceEventStatus`/`updateMiceClientApproval` menolak transisi tidak valid/tanpa alasan-catatan wajib, `updateMiceEvent` menolak edit saat status terminal) dan smoke test SSR konten yang membuktikan capacity conflict, sanitasi ganda, dan cross-link ke risk/task existing bekerja benar.

## 14. Regression

`app/pages/projects/[id]/index.vue` (dimiliki Section 12 lama/Foundation — hanya blok "MICE Events" ditambahkan DI DALAM sub-section mice existing, tabel `ProjectService` generik dan tab lain TIDAK disentuh, dikonfirmasi via smoke test `?tab=overview`/`?tab=travelers`/`?tab=finance` tidak berubah). `app/data/activity.ts` (`TSK-1032`/`1033`/`RSK-1031`/`SFT-1032`, dimiliki Section 09/12 lama) TIDAK diubah shape maupun isinya — hanya dirujuk dari teks `MiceEvent.changeOrderNote`. `app/pages/admin/roles.vue` (dimiliki Section 17 lama/Section 02 — hanya 1 baris array + 1 teks catatan ditambahkan). `app/constants/roles.ts` (`ROLE_MODULE_ACCESS` — seluruh 16 baris ditambah 1 properti `mice`, nilai existing untuk 12 modul lain di setiap baris TIDAK diubah). `ProjectService`/`VendorQuotation`/`Vendor`/`User` (Foundation/Section 02/13 lama, dipakai luas) TIDAK diubah shape maupun status-nya sama sekali.

## 15. Cross-Section Impact

`docs/mockup-change-impact-log.md` CI-046 — ringkasan MICE Event di tab Itinerary & Services (Section 12 lama) dan kolom Matrix Role (Section 02/17 lama) — seluruhnya aditif, regression-tested. `RSK-1031`/`TSK-1032`/`TSK-1033`/`SFT-1032` (Section 09/12 lama) HANYA dirujuk secara naratif dari `changeOrderNote`, tidak diubah.

## 16. Known Issues dan Deferred Work

- Q8 (tooling lint/typecheck/test) tetap terbuka — 16 section berturut-turut.
- Seluruh 4 sub-domain operasional lintas-project (Ticketing/Accommodation/Transportation/MICE, Section 13–16) kini RESOLVED — tidak ada lagi `KNOWN_GAP` role-only di kelompok Section 13-16.
- Verifikasi interaktif tidak dilakukan headless (keterbatasan tooling, konsisten sejak Section 06).
- Client approval "Client approval states" direkam internal (role `mice`/Management), BUKAN alur self-service Client Portal — dicatat eksplisit sebagai keputusan scope (D-073), bukan gap tersembunyi.
- Fixture tunggal (`MICE-1035`) tidak mencakup status `requested`/`completed`/`no-show`/`cancelled` untuk event — tetap fully reachable lewat UI transisi, murni keterbatasan satu baris demo (realita satu event per project).

## 17. Protection Notes untuk Section Berikutnya

`MiceEvent` (D-073) — entitas TERPISAH dari `ProjectService`, jangan digabung/direstrukturisasi; `ProjectService` (Foundation, LOCKED secara de facto) TIDAK BOLEH diperluas dengan field spesifik-MICE. Event yang sudah `completed`/`cancelled` bersifat terminal — `updateMiceEvent` sudah menolak edit lebih lanjut, jangan dilonggarkan tanpa keputusan baru. `netCostIdr` TIDAK BOLEH tampil di `rundown-preview.vue`/`boq-preview.vue` — dan `rundown-preview.vue` secara khusus TIDAK BOLEH menampilkan angka finansial apa pun (bukan hanya net cost). `MiceApprovalStatus` (client approval) JANGAN digabung kembali ke `MiceEventStatus` — keduanya sengaja terpisah (pola D-049); "Change order" adalah jalur SATU-SATUNYA untuk perubahan pasca-`approved`, jangan menambahkan jalur `approved → submitted` tanpa keputusan baru. `RSK-1031`/`TSK-1032`/`TSK-1033`/`SFT-1032` (Section 09/12 lama) JANGAN diubah oleh section manapun kecuali eksplisit bagian dari scope pemiliknya. **Dengan Section 13-16 seluruhnya RESOLVED, preseden arsitektur D-070/D-071/D-072/D-073 (modul top-level baru mendampingi tab Project Detail, reuse data existing, sanitasi cost konsisten) TETAP berlaku sebagai acuan** untuk kebutuhan serupa di section berikutnya (mis. RFQ/Service Order Section 17) — JANGAN memindahkan konten tab existing ke top-level manapun (D-020 tetap LOCKED untuk struktur tab itu sendiri).

## 18. Review URLs

Tidak ada deployment publik. Untuk review lokal: `npm run dev`, buka `http://localhost:8080/mice` untuk daftar MICE Event. Buka `http://localhost:8080/mice/MICE-1035` untuk melihat capacity conflict, change order, incident, BOQ, staffing, dan checklist. Buka `http://localhost:8080/mice/MICE-1035/rundown-preview` untuk dokumen agenda client-facing. Buka `http://localhost:8080/mice/MICE-1035/boq-preview` untuk dokumen budget client-facing tersanitasi. Buka `http://localhost:8080/projects/PRJ-103?tab=itinerary-services` untuk melihat titik kolaborasi ringkasan MICE Event di Project Detail.

## 19. Recommended Next Section

**Section 17 — Supplier dan Procurement** (RFQ formal/comparison/clarification, Service Order/amendment/acknowledgment, supplier invoice submission preview — role `procurement` + `vendor: MANAGE` sudah ada sejak Section 02, status PARTIAL), berbasis dependency (`docs/frontend-implementation-roadmap.md`) — dapat mengikuti preseden arsitektur D-070/D-071/D-072/D-073 bila relevan, menunggu perintah eksplisit user.
