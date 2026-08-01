# Section Report — Section 19: Changes, Cancellation, Refund dan Incident

**Status:** COMPLETED

Dikerjakan berdasarkan `prompts/SECTION_19_Changes_Cancellation_Refund_Incident.md`. Section kedua puluh roadmap Section 00–24 baru, dijalankan setelah Section 18 (Booking dan Service Orders, COMPLETED).

---

## 1. Section Objective dan Scope

"Lengkapi exception management." Wajib: Change request dari Client/Internal/Supplier. Before/after dan affected entities. Operational, commercial, financial, timeline impact. Approval states. Additional quotation/change order. Cancellation and penalty. Refund request, approval, partial/full, credit status mock. Incident severity, owner, escalation, communication, resolution. Versioned itinerary/order history. Client-safe visibility. Acceptance: High-change project dapat diselesaikan tanpa menghapus histori.

## 2. Source Documents yang Dibaca

`prompts/SECTION_19_Changes_Cancellation_Refund_Incident.md`, `prompts/01-PROTOKOL WAJIB — CONTINUITY, DOKUMENTASI PER SECTION, DAN PERLINDUNGAN HASIL.md`, `CLAUDE.md`, `docs/mockup-section-progress.md` (Section 18 entry penuh, "Next action"), `docs/mockup-design-decisions.md` (D-070 s/d D-075 dibaca penuh sebagai preseden arsitektur — khususnya D-075 "consolidation/orchestration layer" sebagai template terdekat), `docs/mockup-change-impact-log.md` (CI-048), `docs/frontend-known-issues.md` §14/§15 (gap statement literal untuk Section 19 dan Section 20, dibaca verbatim), `docs/frontend-implementation-roadmap.md` baris Section 19, `docs/frontend-module-map.md` §4, `docs/frontend-workflow-map.md` baris 20 "Changes / Incident", `docs/mockup-open-questions.md`, `docs/mockup-section-reports/README.md`, `docs/mockup-section-reports/section-18-booking-service-orders.md` (template struktur laporan), `docs/mockup-section-reports/section-14-project-changes.md` (OLD SCHEME predecessor — fondasi `ActivityEntry`/`ChangeCategory`/`ChangeApprovalStatus` yang diperluas, bukan diduplikasi), source code aktual (`app/types/activity.ts` — `ActivityEntry` lengkap, `app/types/ticketing.ts`/`accommodation.ts`/`transportation.ts`/`mice.ts` — field `cancelled`/`no-show`/`hasChange`/`hasIncident`/`hasChangeOrder`/penalty/`statusReason`, `app/types/finance.ts` — `Invoice`/`Payment` minimal, `app/types/booking-orchestration.ts`+`app/data/booking-orchestration.ts` — template struktural terdekat, `app/types/user.ts` — `ModuleKey`, `app/constants/status.ts`/`roles.ts`/`navigation.ts`, `app/data/index.ts` — `createChangeEntry`/`approveChangeEntry`/`rejectChangeEntry`, `update*BookingStatus` 4 fungsi, `syncBookingPaymentGateOnStatusChange`, `app/pages/projects/[id]/index.vue` — tab "Activity & Changes", `app/pages/client/index.vue`+`app/pages/client/**` — pola sanitasi Client Portal, `app/pages/bookings/index.vue`+`exceptions/index.vue` — template list-page, `app/pages/ticketing/[id]/index.vue` — template status-dialog mandatory-reason, `app/pages/procurement/index.vue` — template query-param tab, `app/pages/admin/roles.vue`), disambiguasi naming eksplisit `prompts/21-PROMPT-19-CHANGES-&-UPDATE.md` (OLD SCHEME, topik berbeda total — role restructuring/AE-Sales split, diabaikan), `git status`.

## 3. Existing Implementation yang Diperiksa

`git status` menunjukkan Section 00–18 masih uncommitted (belum di-commit user, dicatat apa adanya, tidak diganggu). `docs/frontend-known-issues.md` §14 dan `docs/frontend-implementation-roadmap.md` baris 26 menandai section ini `PARTIAL` — tab "Activity & Changes" (`ActivityEntry` + `ChangeCategory`/`ChangeApprovalStatus`, Section 14 lama) menangani "Change" generik dengan baik, tapi belum ada kategori/field khusus Cancellation (penalty seragam lintas domain), Refund (partial/full/credit status), atau Incident (severity/escalation/communication).

Audit langsung kode mengonfirmasi: `ActivityEntry` (Section 14 lama) sudah punya `isChange`/`reviewed`/`category`/`reason`/`requestedBy`/`beforeValue`/`afterValue`/`impactNote`/`approvalStatus`/`approvedBy` — fondasi audit trail yang solid untuk change tracking generik, TAPI tanpa affected-entity linking terstruktur, tanpa dampak 4-dimensi (operational/commercial/financial/timeline) terpisah, tanpa additional-quotation-link, dan tanpa konsep Cancellation/Refund/Incident sama sekali. `HotelBooking` (Section 14, D-071) satu-satunya dari 4 domain booking yang punya field penalty sendiri (`cancellationPenaltyIdr`/`noShowPenaltyIdr`) — Flight/Transport/MICE tidak punya. `Invoice`/`Payment` (Foundation) sengaja minimal — tidak ada konsep refund/credit sama sekali. `BookingOrchestrationRecord`/`BookingTimelineEntry` (Section 18, D-075) dikonfirmasi sebagai template struktural paling relevan: "entitas baru, ID-linked, derived aggregation, don't touch what it references."

## 4. Decisions yang Digunakan

D-076 (`docs/mockup-design-decisions.md`, baru) — empat entitas baru fully additive (`ChangeRequest`/`CancellationRecord`/`RefundRequest`/`Incident`, `app/types/change-incident.ts`). `ChangeRequest` TIDAK menggantikan `ActivityEntry` — WAJIB menaut satu `ActivityEntry` (`activityEntryId`) lewat `createChangeRequest`→`createChangeEntry`, `approveChangeRequest`/`rejectChangeRequest`→`approveChangeEntry`/`rejectChangeEntry`. Refund tetap self-contained (`creditStatus` mock, TIDAK menyentuh `Invoice`/`Payment`) — forward dependency eksplisit ke Section 20. "Versioned history" = sifat append-only `ChangeRequest` (bukan entitas versioning baru). Cancellation hook di 4 halaman detail booking ADITIF SETELAH `update*BookingStatus` berhasil (bukan mengubah guard existing). Approval komersial (`ChangeRequest`/`RefundRequest`) tetap `canApprove('project')` existing — BUKAN rank baru pada modul `changes`.

## 5. Implementation Summary

**Change request dari Client/Internal/Supplier** — `ChangeRequest.source: 'client'|'internal'|'supplier'` (baru, `app/types/change-incident.ts`). Fixture `CR-001` s/d `CR-006` mencakup ketiganya (3 internal, 2 client, 1 supplier).

**Before/after dan affected entities** — `beforeSummary`/`afterSummary` (string terstruktur) + `affectedEntities: AffectedEntityRef[]` (menautkan `entityType`+`entityId` lintas-domain flight/hotel/transport/mice/itinerary/order/project — pola sama referensi ID di `BookingOrchestrationRecord`).

**Operational, commercial, financial, timeline impact** — 4 field terpisah (`operationalImpact`/`commercialImpactIdr`/`financialImpactNote`/`timelineImpactNote`), seluruhnya opsional (tidak setiap Change Request punya keempat dimensi dampak).

**Approval states** — `ChangeRequestStatus` 5-nilai (`submitted`/`under-review`/`approved`/`rejected`/`implemented`), peta transisi eksplisit `CHANGE_REQUEST_TRANSITIONS` via `getChangeRequestStatusTransitions`. `approveChangeRequest`/`rejectChangeRequest` (mandatory reason untuk reject, pola sama `updateFlightBookingStatus` dkk.) SELALU memanggil `approveChangeEntry`/`rejectChangeEntry` existing pada `ActivityEntry` yang ditaut (`activityEntryId`) — `markChangeRequestUnderReview`/`markChangeRequestImplemented` melengkapi 2 transisi lain yang tidak butuh field tambahan.

**Additional quotation/change order** — `linkedQuotationId` opsional, menaut ke `Quotation` existing (`getQuotationById`, selector baru trivial) — ditampilkan di `/changes/[id]` sebagai section "Additional Quotation / Change Order".

**Cancellation and penalty** — `CancellationRecord` (baru), lapisan penalty-tracking SERAGAM lintas 4 domain booking. Dibuat ADITIF dari hook UI-level di `app/pages/ticketing/[id]/index.vue`, `accommodation/[id]/index.vue`, `transportation/[id]/index.vue`, `mice/[id]/index.vue` — dialog status cancel-equivalent existing (mandatory-reason, LOCKED sejak Section 13-16) diperkaya field opsional "Penalty (Rp)" + checkbox "Refund Eligible" HANYA saat status target adalah cancel-equivalent (`cancelled`/`refunded`/`no-show` sesuai domain). `createCancellationRecord` dipanggil SETELAH `update*BookingStatus` mengembalikan hasil sukses — guard/transition-map/reason-wajib pada fungsi tsb TIDAK disentuh sama sekali.

**Refund request, approval, partial/full, credit status mock** — `RefundRequest` (baru), `type: 'partial'|'full'`, status 5-nilai (`requested`/`under-review`/`approved`/`rejected`/`processed`) via `updateRefundRequestStatus` (mandatory reason untuk `rejected`). `creditStatus` field MOCK self-contained (`pending`/`issued`/`not-applicable`) — otomatis `issued` saat status `processed`, `not-applicable` saat `rejected`. `cancellationId`/`invoiceId` murni referensi ID READ-ONLY (`invoiceId` menaut `Invoice` existing untuk konteks tampilan saja, TIDAK PERNAH memutasi `Invoice.status`).

**Incident severity, owner, escalation, communication, resolution** — `Incident` (baru), severity 4-nilai (`low`/`medium`/`high`/`critical`), `ownerId`. `escalateIncident` (status→`escalated`, set `escalatedTo`, tambah entri `communicationLog` otomatis mendeskripsikan eskalasi). `appendIncidentCommunication` (log manual, tidak mengubah status). `resolveIncident` (resolution note WAJIB, status→`resolved`, `resolvedAt`). `updateIncidentStatus` (transisi umum lain — `investigating`, `closed`).

**Versioned itinerary/order history** — dipenuhi lewat sifat APPEND-ONLY `ChangeRequest`: setiap `ChangeRequest` dibuat baru dan tidak pernah diedit/dihapus setelah dibuat, hanya `status` yang berpindah lewat transition map eksplisit. `/changes` (tab "Change Requests") dan tab "Activity & Changes" `/projects/[id]` menampilkan daftar ini terorder kronologis per project sebagai "Change History" — BUKAN entitas versioning baru.

**Client-safe visibility** — `/client/project-orders/[id]` tab "Change Request" di-rename "Changes & Incidents": Change Request hanya menampilkan `status`+`beforeSummary`/`afterSummary` (TIDAK PERNAH `operationalImpact`/`commercialImpactIdr`/`financialImpactNote`, bahkan untuk request `source: 'client'` milik Client itu sendiri), Incident hanya `status`+`resolutionNote` (TIDAK PERNAH `severity`/`escalatedTo`/`communicationLog`). `submitChangeRequest` (form existing) dialihkan dari `createChangeEntry` langsung menjadi `createChangeRequest` (`source: 'client'`) — hasil akhir tetap satu `ActivityEntry` yang sama seperti sebelumnya, kini plus satu `ChangeRequest` terstruktur.

**Acceptance "High-change project dapat diselesaikan tanpa menghapus histori"** — seluruh 4 entitas baru bersifat append-only/immutable-setelah-dibuat (hanya field status yang berubah lewat mutator eksplisit dengan transition map — tidak ada mutator "delete" untuk `ChangeRequest`/`CancellationRecord`/`RefundRequest`/`Incident` manapun); terminal states (`rejected`/`implemented` untuk Change Request, `rejected`/`processed` untuk Refund, `closed` untuk Incident) benar-benar terminal (transition map mengembalikan array kosong).

**Modul baru `/changes`** (`ModuleKey` `changes`) — list 4-tab query-param (`change-requests`/`cancellations`/`refunds`/`incidents`, pola sama `/procurement`), create dialog untuk Change Request/Refund/Incident (Cancellation hanya dibuat via hook booking, bukan dari `/changes` langsung — konsisten "additive, bukan entry point kedua"), 4 route detail (`/changes/[id]`, `/changes/cancellations/[id]`, `/changes/refunds/[id]`, `/changes/incidents/[id]`). `operations`/`project-manager` `MANAGE`, `management`/`finance`/`viewer` `VIEW` — approval komersial (`ChangeRequest`/`RefundRequest` approve/reject) tetap digerbangi `canApprove('project')` existing (rank Management pada modul `project`), BUKAN rank baru pada modul `changes` — konsisten hard rule "Hanya Management yang melakukan commercial approval" tanpa mekanisme approval kedua.

**Extension tab Project Detail** — tab "Activity & Changes" `/projects/[id]` mendapat 4 SectionCard baru (Change Requests/Cancellations/Refund Requests/Incidents) SETELAH list `ActivityEntry` existing (yang TIDAK diubah) — surgical addition, masing-masing dengan link ke `/changes/**`.

## 6. Routes

5 route baru: `/changes` (list 4-tab), `/changes/[id]` (Change Request detail), `/changes/cancellations/[id]`, `/changes/refunds/[id]`, `/changes/incidents/[id]`. Tidak ada route existing yang di-rename/dihapus. `/projects/[id]` (tab Activity & Changes) dan `/client/project-orders/[id]` (tab Changes & Incidents) diperkaya pada route yang sama.

## 7. Files Created, Changed, dan Removed

**Created:**
- `app/types/change-incident.ts`
- `app/data/change-incident.ts`
- `app/pages/changes/index.vue`
- `app/pages/changes/[id]/index.vue`
- `app/pages/changes/cancellations/[id]/index.vue`
- `app/pages/changes/refunds/[id]/index.vue`
- `app/pages/changes/incidents/[id]/index.vue`
- `docs/mockup-section-reports/section-19-change-cancel-refund-incident.md` (laporan ini)

**Changed:**
- `app/data/activity.ts` (+3 `ActivityEntry` baru `CHG-1032`/`1033`/`1034` — entri existing TIDAK diubah, murni append)
- `app/types/user.ts` (`ModuleKey` +`changes`)
- `app/constants/roles.ts` (`ROLE_MODULE_ACCESS` +kolom `changes` seluruh 16 role)
- `app/constants/navigation.ts` (+menu "Changes & Incidents" 4-child, +icon `AlertTriangle`)
- `app/constants/status.ts` (+`CHANGE_REQUEST_SOURCES`/`CHANGE_REQUEST_STATUSES`/`REFUND_REQUEST_STATUSES`/`REFUND_CREDIT_STATUSES`/`INCIDENT_SEVERITIES`/`INCIDENT_STATUSES`)
- `app/data/index.ts` (+import `CHANGE_REQUESTS`/`CANCELLATION_RECORDS`/`REFUND_REQUESTS`/`INCIDENTS`, +export, +`getQuotationById`, +seluruh selector/mutator Change Request/Cancellation/Refund/Incident [`getChangeRequestsByProject`/`createChangeRequest`/`getChangeRequestStatusTransitions`/`approveChangeRequest`/`rejectChangeRequest`/`markChangeRequestUnderReview`/`markChangeRequestImplemented`/`getCancellationRecordsByProject`/`getCancellationRecordByBooking`/`createCancellationRecord`/`getRefundRequestsByProject`/`createRefundRequest`/`getRefundRequestStatusTransitions`/`updateRefundRequestStatus`/`getIncidentsByProject`/`getAllIncidents`/`getOpenIncidentQueue`/`createIncident`/`getIncidentStatusTransitions`/`updateIncidentStatus`/`escalateIncident`/`appendIncidentCommunication`/`resolveIncident`])
- `app/pages/ticketing/[id]/index.vue`/`app/pages/accommodation/[id]/index.vue`/`app/pages/transportation/[id]/index.vue`/`app/pages/mice/[id]/index.vue` (+import `createCancellationRecord`, +ref `cancellationPenalty`/`cancellationRefundEligible`, +field Penalty/Refund Eligible pada dialog status cancel-equivalent, +panggilan mutator SETELAH `update*BookingStatus` berhasil)
- `app/pages/projects/[id]/index.vue` (+import selector Section 19, +4 computed `projectChangeRequests`/`projectCancellations`/`projectRefunds`/`projectIncidents`, +4 SectionCard baru di tab "Activity & Changes" — list `ActivityEntry` existing TIDAK diubah)
- `app/pages/client/project-orders/[id]/index.vue` (tab "Change Request"→"Changes & Incidents", `submitChangeRequest` beralih dari `createChangeEntry` ke `createChangeRequest`, +computed `projectChangeRequests`/`projectIncidents` menggantikan `changeEntries` lama, +SectionCard "Incidents" sanitized)
- `app/pages/admin/roles.vue` (+1 baris `modules`, +update teks `ROLE_NOTES['operations']`/`ROLE_NOTES['project-manager']`)
- `docs/mockup-design-decisions.md` (+D-076)
- `docs/mockup-change-impact-log.md` (+CI-049)
- `docs/mockup-data-scenarios.md` (+bagian 4v)
- `docs/frontend-module-map.md`, `docs/frontend-workflow-map.md`, `docs/frontend-implementation-roadmap.md`, `docs/frontend-known-issues.md` (§14 RESOLVED, §15 diperbarui dengan forward dependency)
- `docs/mockup-implementation-state.md`, `docs/mockup-progress.md` (+Entri 28), `docs/mockup-section-progress.md`
- `docs/mockup-section-reports/README.md`

**Removed:** Tidak ada.

## 8. Components Reused/Created

Reused sepenuhnya: `PageHeader`, `SectionCard`, `DetailMetadataList`, `StatusBadge`, `EmptyState`, `RoleAccessState`, `Table*`, `Dialog*`/`DialogScrollContent`, `Checkbox`, `StatsCard`, `Tabs*`, `useToast`, `Input`, `Label`, `Button`. Tidak ada shared component baru — `/changes` (list) mengikuti pola `/procurement` (query-param tab + `Tabs`/`TabsList`/`TabsContent`) dan `/bookings` (search+filter+table+stat card); 4 halaman detail mengikuti pola `/ticketing/[id]` (status-dialog mandatory-reason, `DetailMetadataList` untuk ringkasan); dialog Penalty/Refund Eligible di 4 halaman booking detail meng-extend dialog status existing (bukan dialog baru terpisah).

## 9. Types/Constants/Fixtures/Mock State

`+ChangeRequestSource`/`ChangeRequestStatus`/`AffectedEntityRef`/`ChangeRequest`/`CancellationRecord`/`RefundRequestStatus`/`RefundRequest`/`IncidentSeverity`/`IncidentStatus`/`IncidentCommunicationEntry`/`Incident` (entitas dan type baru, `app/types/change-incident.ts`, seluruhnya aditif). `ModuleKey` +`changes`. `+CHANGE_REQUEST_SOURCES`/`CHANGE_REQUEST_STATUSES`/`REFUND_REQUEST_STATUSES`/`REFUND_CREDIT_STATUSES`/`INCIDENT_SEVERITIES`/`INCIDENT_STATUSES` (`app/constants/status.ts`).

Fixture (`app/data/change-incident.ts`): 6 `ChangeRequest` (`CR-001` s/d `CR-006`, 3 sumber, 5 status — 3 menaut `ActivityEntry` LAMA `CHG-1021`/`1023`/`1031`, 3 menaut `ActivityEntry` BARU `CHG-1032`/`1033`/`1034`), 3 `CancellationRecord` (`CNX-001` s/d `CNX-003`, 2 dengan penalty + 1 tanpa), 5 `RefundRequest` (`REF-001` s/d `REF-005`, seluruh 5 status, partial+full, 1 `creditStatus: 'issued'`), 4 `Incident` (`INC-001` s/d `INC-004`, seluruh 4 severity, 1 `escalated` dengan `communicationLog` 2-entri, 2 booking-linked + 2 project-level). Lihat `docs/mockup-data-scenarios.md` bagian 4v untuk narasi lengkap.

## 10. Responsive Behavior

Tidak ada pola baru — `/changes` memakai `Tabs`+`Table` dengan `overflow-x-auto`, filter bar `flex-col sm:flex-row` (stack di layar kecil), stat card grid `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4` — pola sama `/bookings`/`/procurement`. Halaman detail memakai `grid sm:grid-cols-2` untuk before/after dan dampak. Dialog Penalty/Refund Eligible `max-w-md` — konsisten dialog konfirmasi existing.

## 11. States (Loading/Empty/Error/Unauthorized/Not-Found)

- `RoleAccessState` untuk `!canView('changes')` di `/changes` dan seluruh 4 route detail.
- Not-found: `EmptyState` + `FileX` icon untuk ID yang tidak ditemukan di keempat route detail (`Change Request tidak ditemukan`/`Cancellation tidak ditemukan`/`Refund Request tidak ditemukan`/`Incident tidak ditemukan`), dengan tombol kembali ke `/changes`.
- Empty state: `TableEmpty` per tab di `/changes` (dinamis sesuai filter aktif), `EmptyState` untuk sub-section kosong di tab Project Detail dan Client Portal.
- Guard/transition state: tombol aksi status (approve/reject/under-review/implemented untuk Change Request; approve/reject/process untuk Refund; investigate/escalate/resolve/close untuk Incident) hanya muncul bila `getChangeRequestStatusTransitions`/`getRefundRequestStatusTransitions`/`getIncidentStatusTransitions` mengizinkan transisi tsb dari status saat ini — transition map eksplisit mencegah transisi ilegal baik dari UI maupun panggilan mutator langsung.
- Validation: dialog reject Change Request/Refund dan dialog Resolve Incident — tombol submit `disabled` sampai field wajib (alasan/resolution note) terisi, pola sama dialog cancel booking existing.

## 12. Role Behavior

`canManageChanges` = `canManage('changes')` — `operations`/`project-manager` (`MANAGE`) dan `super-admin` (`ADMIN`) mencapai rank tulis (create Change Request/Refund/Incident, escalate/resolve Incident, mulai review, proses refund). `canApproveChangeRequest`/`canApproveRefund` = `canApprove('project')` MURNI (bukan `canManage('changes')`) — Management/Super Admin approve/reject Change Request dan Refund lewat rank existing pada modul `project`, konsisten `canApproveChanges` Section 14 lama, TIDAK ada mekanisme approval kedua. Role lain internal (`finance`/`viewer`): `VIEW`. Role lain (Sales/AE/Product Planner/Ticketing/Accommodation/Transportation/MICE/Procurement): `NONE` — role domain (Ticketing dkk.) tetap membuat `CancellationRecord` lewat halaman detail booking masing-masing (gate tetap `canManage('ticketing')` dkk. existing, bukan `canManage('changes')`). Client/Supplier: `NONE` pada modul `changes` — mengakses versi sanitized lewat `client-portal`/`supplier-portal` masing-masing (Client sudah diimplementasikan, Supplier di luar scope literal Section 19).

## 13. Validation Commands dan Hasilnya

- `npx nuxi prepare` — **sukses**.
- `npm run build` — **sukses** (2x run — run pertama menemukan bug: sort comparator `incRows` di `app/pages/changes/index.vue` memakai `a.id`/`b.id` [properti tidak ada pada wrapper `{item, project}`] alih-alih `a.item.id`/`b.item.id`, menyebabkan HTTP 500 saat runtime di `/changes?tab=incidents` — TIDAK tertangkap saat build karena TypeScript tidak flag akses property yang technically valid pada objek any-like dalam konteks ini; ditemukan lewat smoke test HTTP, diperbaiki, build+smoke-test ulang sukses).
- `npx nuxi typecheck` — gagal, `vue-tsc` belum terpasang (Q8, pre-existing gap, 19 section berturut-turut).
- `npm run lint` — tidak tersedia (Q8, pre-existing).
- `npx vitest run` — "No test files found" (pre-existing).
- **Smoke test HTTP** — `/changes`, `/changes?tab=cancellations|refunds|incidents`, `/changes/CR-001` s/d `CR-006`, `/changes/cancellations/CNX-001` s/d `CNX-003`, `/changes/refunds/REF-001` s/d `REF-005`, `/changes/incidents/INC-001` s/d `INC-004`, plus ID tidak ada untuk masing-masing route detail (`/changes/nonexistent-id` dkk. — not-found UI, bukan error), regresi `/projects/PRJ-101` s/d `PRJ-104?tab=activity-changes`, `/client`, `/client/project-orders/PRJ-101`/`PRJ-102`, `/bookings`, `/bookings/exceptions`, `/procurement`, `/admin/roles`, `/ticketing`+`/ticketing/FLT-1021`+`/ticketing/FLT-1023`, `/accommodation`+`/accommodation/HTL-1022`+`/accommodation/HTL-1023`, `/transportation`+`/transportation/TRN-1034`+`/transportation/TRN-1037`, `/mice`+`/mice/MICE-1035`, `/`, `/nonexistent-route-xyz` (catch-all) — **seluruhnya HTTP 200** (48 route dicek total).
- **Smoke test konten** (curl+grep):
  - `/changes` menampilkan 4 stat card ("Change Request Terbuka"/"Total Cancellation"/"Refund Terbuka"/"Incident Terbuka").
  - `/changes/incidents/INC-001` menampilkan badge "Escalated" dan narasi eskalasi ke "Fajar Nugroho" (Operations, `USR-009`) — mengonfirmasi fixture escalation bekerja.
  - `/projects/PRJ-102?tab=activity-changes` menampilkan seluruh 4 SectionCard baru ("Change Requests"/"Cancellations"/"Refund Requests"/"Incidents") berdampingan dengan list `ActivityEntry` existing.
  - `/admin/roles` menampilkan kolom "Changes & Incidents".
  - Dev server log diperiksa (`grep -iE "warn|error"`) — hanya warning Tailwind class ambiguity pre-existing setelah fix, tidak ada error dari kode Section 19.
- **Verifikasi sanitasi Client Portal** — dilakukan lewat CODE REVIEW (bukan curl konten langsung), karena `/client/**` membutuhkan role `client` aktif yang di-toggle lewat role-switcher client-side (tidak terbawa oleh request curl tanpa sesi — keterbatasan yang sama sudah dicatat sejak Section 06/18). `grep` mengonfirmasi template `app/pages/client/project-orders/[id]/index.vue` tidak pernah mereferensikan `severity`/`escalatedTo`/`communicationLog`/`operationalImpact`/`commercialImpactIdr`/`financialImpactNote` di luar komentar penjelas.
- **Verifikasi interaktif** (klik approve/reject Change Request, escalate/resolve Incident, ajukan Refund dari Cancellation, isi field Penalty/Refund Eligible di dialog cancel booking) **tidak dilakukan headless** — keterbatasan tooling konsisten sejak Section 06. Dimitigasi lewat code review ketat terhadap seluruh guard (`getChangeRequestStatusTransitions`/`getRefundRequestStatusTransitions`/`getIncidentStatusTransitions`, mandatory-reason pada `rejectChangeRequest`/`updateRefundRequestStatus`/`resolveIncident`) dan smoke test SSR konten yang membuktikan skenario kunci fixture bekerja benar.

## 14. Regression

`app/pages/projects/[id]/index.vue` (dimiliki Section 14 lama/Foundation — extension SURGICAL: hanya 4 SectionCard baru ditambahkan SETELAH list `ActivityEntry` existing di dalam `TabsContent value="activity-changes"`; dialog "Catat Perubahan"+list `ActivityEntry`+seluruh tab lain [Overview/Itinerary & Services/Travelers/Vendors/Finance/Tasks/Documents] TIDAK disentuh — dikonfirmasi via smoke test `?tab=activity-changes` pada 4 project). `app/pages/ticketing/[id]/index.vue`/`accommodation/[id]/index.vue`/`transportation/[id]/index.vue`/`mice/[id]/index.vue` (dimiliki Section 13/14/15/16 — hanya penambahan field opsional pada dialog status existing + 1 panggilan mutator SETELAH `update*BookingStatus`; form Edit, tabel Options/Segments/Legs/Sessions, dan seluruh SectionCard lain TIDAK diubah). `app/pages/client/project-orders/[id]/index.vue` (dimiliki Section 08 — hanya tab "Change Request" yang diperkaya, 5 tab lain [Overview/Itinerary/Travelers/Documents/Finance] TIDAK disentuh). `app/pages/admin/roles.vue` (dimiliki Section 02/17 lama — hanya 1 baris array + 2 teks catatan ditambahkan). `app/constants/roles.ts` (`ROLE_MODULE_ACCESS` — seluruh 16 baris ditambah 1 properti `changes`, nilai existing untuk 15 modul lain di setiap baris TIDAK diubah). `createChangeEntry`/`approveChangeEntry`/`rejectChangeEntry` (`app/data/index.ts`, Section 14 lama) — **TIDAK disentuh sama sekali**, nol perubahan signature/behavior; `createChangeRequest`/`approveChangeRequest`/`rejectChangeRequest` (Section 19) memanggilnya sebagai dependency eksternal. `update*BookingStatus` (Section 13-16) — guard/transition-map/reason-wajib TIDAK diubah, hook Cancellation murni panggilan tambahan SETELAH mutator mengembalikan hasil sukses. `Invoice`/`Payment` (Foundation) — **TIDAK disentuh sama sekali**.

## 15. Cross-Section Impact

`docs/mockup-change-impact-log.md` CI-049 — hook `createCancellationRecord` ke 4 halaman detail booking (Section 13-16, TIDAK mengubah guard/transition-map/reason-wajib existing), extension tab Activity & Changes (Section 14 lama, list `ActivityEntry` existing TIDAK diubah), extension Client Portal (Section 08, `submitChangeRequest` beralih fungsi implementasi tapi hasil akhir `ActivityEntry` yang sama tetap terbentuk — nol regresi visibilitas data), Matrix Role dan `ModuleKey`/`NAV_ITEMS`/`ROLE_MODULE_ACCESS` (Section 02/17 lama) — seluruhnya aditif, regression-tested. `FlightBooking`/`HotelBooking`/`TransportBooking`/`MiceEvent`/`Invoice`/`Payment`/`ActivityEntry` (Section 13-16/Foundation/Section 14 lama) TIDAK diubah shape maupun isinya sama sekali — nol risiko regresi terhadap consumer existing (Dashboard/Reports/Client Portal lain/modul masing-masing).

## 16. Known Issues dan Deferred Work

- Q8 (tooling lint/typecheck/test) tetap terbuka — 19 section berturut-turut.
- **Bug ditemukan dan diperbaiki dalam section yang sama** (bukan dibiarkan): sort comparator `incRows` di `app/pages/changes/index.vue` — lihat bagian 13 di atas untuk detail lengkap.
- **`RefundRequest.creditStatus` bersifat MOCK self-contained** — TIDAK terintegrasi ke `Invoice`/`Payment`/`CreditNote` nyata (Section 20/Project Finance masih PARTIAL). Ini adalah forward dependency EKSPLISIT, bukan gap tersembunyi — didokumentasikan di `docs/frontend-known-issues.md` bagian 15 dan D-076 (`docs/mockup-design-decisions.md`).
- Cancellation hanya dapat dibuat lewat hook di 4 halaman detail booking (bukan lewat dialog "Buat" langsung di `/changes`) — keputusan sengaja (konsisten pola "additive, bukan entry point kedua/dataset paralel"), dicatat sebagai desain bukan gap.
- Verifikasi interaktif tidak dilakukan headless (keterbatasan tooling, konsisten sejak Section 06).
- Sanitasi Client Portal diverifikasi via code review, bukan curl konten langsung — keterbatasan role-switcher client-side yang sama sudah dicatat sejak Section 06/18, bukan gap baru.

## 17. Protection Notes untuk Section Berikutnya

`ChangeRequest`/`CancellationRecord`/`RefundRequest`/`Incident`/modul `/changes` (D-076) — fully additive, JANGAN menambah field ke `FlightBooking`/`HotelBooking`/`TransportBooking`/`MiceEvent`/`Invoice`/`Payment` untuk kebutuhan apa pun terkait Section 19. `createChangeRequest`/`approveChangeRequest`/`rejectChangeRequest` WAJIB TETAP memanggil `createChangeEntry`/`approveChangeEntry`/`rejectChangeEntry` (Section 14 lama, LOCKED) — JANGAN membuat log/audit trail kedua yang terpisah dari `ActivityEntry` pada pekerjaan lanjutan mana pun. `RefundRequest.creditStatus` TETAP field mock self-contained sampai ada keputusan baru eksplisit dari Section 20 — JANGAN diintegrasikan ke `Invoice`/`Payment` secara diam-diam. Hook `createCancellationRecord` di 4 halaman detail booking bersifat ADITIF SETELAH `update*BookingStatus`/`updateMiceEventStatus` berhasil — JANGAN memindahkannya ke dalam fungsi mutator itu sendiri atau mengubah guard/transition-map/reason-wajib existing tanpa keputusan baru eksplisit. Approval Change Request/Refund TETAP lewat `canApprove('project')` existing — JANGAN menambah rank `APPROVE` pada modul `changes` sebagai mekanisme approval kedua. Dengan Section 19 selesai, ini adalah turunan KEDUA dari preseden "consolidation/orchestration layer lintas-domain" D-075 (turunan pertama, Section 18) — preseden `createChangeRequest`+`activityEntryId` (menaut balik ke audit trail existing, bukan menggantikannya) dapat dijadikan acuan tambahan bila section berikutnya butuh pola serupa (agregasi/exception-tracking lintas beberapa entitas existing tanpa menduplikasi data atau audit trail).

## 18. Review URLs

Tidak ada deployment publik. Untuk review lokal: `npm run dev`, buka `http://localhost:8080/changes` untuk daftar 4-tab (coba tab Incidents, klik "Incident" untuk membuat baru). Buka `http://localhost:8080/changes/CR-002` untuk Change Request "under-review" (upgrade kamar hotel PRJ-102, menaut `CHG-1023` existing). Buka `http://localhost:8080/changes/incidents/INC-001` untuk Incident `escalated` dengan communication log 2-entri. Buka `http://localhost:8080/changes/cancellations/CNX-001` untuk Cancellation dengan penalty dan tombol "Ajukan Refund". Buka `http://localhost:8080/changes/refunds/REF-001` untuk Refund `processed` dengan `creditStatus: 'issued'`. Buka `http://localhost:8080/projects/PRJ-102?tab=activity-changes` untuk melihat 4 SectionCard baru berdampingan dengan Activity list existing. Buka `http://localhost:8080/ticketing/FLT-1023` untuk melihat booking `refunded` yang menghasilkan `CNX-001` (via tombol status sebelumnya). Buka `http://localhost:8080/admin/roles` untuk kolom "Changes & Incidents" pada Matrix Role. Untuk Client Portal, ganti role demo ke `client` (Sarah Amelia / PTY-002) lewat `/settings`, lalu buka `/client/project-orders/PRJ-102?tab=changes` untuk melihat tampilan sanitized.

## 19. Recommended Next Section

**Section 20 — Project Finance** (Refund/credit status mock — `RefundRequest.creditStatus` Section 19 adalah forward dependency eksplisit-nya, status PARTIAL saat ini), berbasis dependency (`docs/frontend-implementation-roadmap.md`), menunggu perintah eksplisit user. Section ini TIDAK dilanjutkan otomatis ke Section 20 — berhenti sesuai instruksi protokol.
