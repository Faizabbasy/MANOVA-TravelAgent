# Client Page Inventory — Gap Analysis (18 Halaman)

Dibuat oleh **Repair Phase / Section 0 — Audit dan Gap Analysis** (`prompts/repair_phases/PROMPT-SECTION-0.md`). Setiap halaman ditandai sesuai kondisi kode AKTUAL yang sudah diverifikasi langsung (dibaca, bukan diasumsikan) per hari ini. **Tidak ada implementasi baru pada dokumen/section ini.**

**Update Section 1 (Foundation):** seluruh 18 route rekomendasi kini SUDAH ADA dan valid (17 sebagai shell `ModulePlaceholder`, 1 — Dashboard — mengarah ke `/client` existing yang sudah berfungsi) — lihat `docs/client-information-architecture.md` bagian 6. Status "Not Available"/"Existing but Incomplete" di bawah ini **TETAP BERLAKU untuk BISNIS LOGIC-nya** (shell bukan implementasi fungsional) — Section 1 tidak mengubah satu pun penilaian gap di bawah, murni menambahkan route yang bisa diklik + fondasi (types/mock data/nav).

Legenda status: **Existing & Complete** / **Existing but Incomplete** / **Not Available**.

---

### 1. Dashboard
**Status:** Existing & Complete (Repair Phase Section 2 — Home)
**Existing:** `app/pages/client/index.vue` diperluas (bukan dibangun ulang, mengikuti rekomendasi di bawah) — 7 summary card (Active Projects/Upcoming Trips/Pending Approvals/Incomplete Participants/Outstanding Invoices/Open Issues/Action Required), Quick Actions (6 aksi, seluruhnya membuka halaman/dialog nyata), Action Required list (derivasi `AttentionItem`, setiap item navigable), Upcoming Trip (readiness per-project via `getClientProjectReadiness`), Financial Summary (Invoiced/Paid/Outstanding/Overdue/Next Due), Recent Activity (`getActivitiesByProject`+Payment+ChangeRequest, derivasi terpusat) — SEMUA di atas Action Center/Profile/Support/Contacts/Opportunity/Project list existing (dipertahankan apa adanya).
**Belum ada:** dimensi readiness "Commercial"/"Documents"/"Execution" (Master Prompt bagian G.1) belum masuk skor `getClientProjectReadiness` — belum ada Opportunity untuk PTY-005 dan modul `documents` (Section 21) masih `NONE` untuk role client; skor readiness saat ini murni Participant+Reservation+Payment, dicatat sebagai known issue, bukan diisi angka statis.
**Update Section 8 (perbaikan bug):** dialog "Ajukan Travel Request" lama (memanggil `createLead` langsung, TIDAK PERNAH membuat entitas `TravelRequest`) DIHAPUS — kedua entry point (tombol header + Quick Action "Create Travel Request") kini mengarah ke `/client/travel-requests/new`, satu-satunya jalur pembuatan Travel Request. Sebelumnya submit lewat dialog ini "hilang" secara diam-diam (tidak error, tapi tidak pernah muncul di `/client/travel-requests`) — lihat `docs/client-business-flow.md` Flow 1.
**Reusable module tersedia:** `StatsCard`, `SectionCard`, `EmptyState`, `RecentActivity`, `Progress` (shared components); `getClientProjectReadiness` (baru, `app/data/index.ts`, derivasi murni dari `getTravelerReadiness`/`getServiceReadinessMatrix`/`getProjectOutstandingIdr` yang sudah ada).
**Risiko:** rendah — murni UI/agregasi di atas data yang sudah ada.

---

### 2. Notifications
**Status:** Existing & Complete (Repair Phase Section 2 — Home)
**Existing:** `/client/notifications` (menggantikan `ModulePlaceholder` Section 1) — list, unread state, mark as read (klik item), mark all as read, search, category filter (9 kategori baru `NotificationCategory`), unread filter, related entity navigation (`project`/`traveler`/`invoice` → halaman Project Order tab terkait), empty/loading/error state, notification preference mock (in-app/email per kategori, `Checkbox`, tidak terhubung pengiriman nyata). Isolasi TETAP lewat `Notification.userId === currentUser.id` (bukan `ROLE_MODULE_ACCESS.client.documents` — modul itu SENGAJA tidak diubah dari `'NONE'`, notification adalah entitas per-user, bukan bagian modul `documents` konsolidasi Section 21).
**Reusable module tersedia:** `Notification`/`getNotificationsForUser`/`getUnreadNotificationCount`/`markNotificationRead`/`markAllNotificationsRead` (Section 21, LOCKED shape, di-reuse apa adanya — TIDAK ada entitas notifikasi kedua). `NotificationPanel.vue` (bell popover, TopHeader) kini bercabang: "View all notifications" ke `/client/notifications` untuk role `client`, tetap `/documents?tab=notifications` untuk role internal.
**Risiko:** rendah — `ROLE_MODULE_ACCESS.client.documents` tetap `'NONE'` (tidak disentuh), gating halaman memakai `canView('client-portal')` yang sudah `MANAGE` untuk role `client` sejak Section 1.

---

### 3. Travel Requests
**Status:** Existing & Complete (Repair Phase Section 3 — Request & Commercial)
**Existing:** `/client/travel-requests` (list, search/filter/sort), `/new` (create), `/:id` (detail + activity timeline + Duplicate/Cancel/Respond to Clarification), `/:id/edit` (edit draft, shared `TravelRequestForm` component). Form penuh (General/Flight/Hotel/Transportation/MICE/Additional Service/Attachment mock), Save Draft/Submit dengan confirmation dialog + unsaved-changes warning (`onBeforeRouteLeave`). Status flow lengkap (`draft→submitted→under-review→need-clarification→proposal-preparation→converted-to-opportunity`, plus `cancelled`) via mock review deterministik (`getTravelRequestReviewGate`) — begitu lolos, cascade OTOMATIS lewat `createLead`→`updateLeadQualification`→`qualifyLeadAndCreateOpportunity`→`createQuotation`→`submitQuotationForApproval`→`approveQuotation` (pipeline internal LOCKED, di-reuse utuh, "Mock Sales Review"/"Management Approval" disimulasikan instan).
**Reusable module tersedia:** `TravelRequest`/`getTravelRequestsByParty`/`getTravelRequestById` (Section 1 foundation) kini punya mutator penuh (`createTravelRequest`/`updateTravelRequestDraft`/`duplicateTravelRequest`/`cancelTravelRequest`/`submitTravelRequest`/`respondToTravelRequestClarification`) + `TravelRequestActivity` (baru, pola sama `LeadActivity`) + `TravelRequestAttachment` (sudah ada, kini dipakai).
**Risiko:** rendah — entitas baru, tidak menyentuh `Lead`/`Opportunity`/`Quotation` LOCKED, hanya memanggilnya secara berurutan.

---

### 4. Quotations & Proposals
**Status:** Existing & Complete (Repair Phase Section 3 — Request & Commercial)
**Existing:** `/client/quotations` (list, agregasi seluruh Quotation company lintas Opportunity), `/:id` (detail lengkap: service breakdown, selling price, tax, payment terms, inclusion/exclusion, terms, **cancellation policy** dan **proposed itinerary** baru — field aditif `Quotation.cancellationPolicy`/`proposedItineraryNote`), Version History (toggle before/after dari `supersededAmountIdr` existing, pola sama Cost Sheet), Compare Package Option (banding quotation Opportunity lain milik company yang sama), Comments (`QuotationComment`, entitas baru), Attachments (`QuotationAttachment`, entitas baru, mock), Approve (reuse `recordClientConfirmation`+`advanceOpportunityStage`+`approveOpportunityWon` berurutan — pola "Mark as Won" D-053 dari sisi Client, LANGSUNG membuat Project), Reject, Request Revision (`requestQuotationRevision` baru — reuse `duplicateQuotationVersion`+`submitQuotationForApproval`+`approveQuotation`, reset `clientConfirmedAt`), dan Download Mock PDF (`/:id/preview`, halaman print baru — TERPISAH dari `/crm/opportunities/[id]/quotation-preview` internal yang ternyata gated `canView('crm')`, jadi TIDAK reachable dari Client meski pernah dirujuk sebagai `previewRoute` Section 21).
**Reusable module tersedia:** `Quotation`/`getQuotationByOpportunity`, seluruh pipeline approval/versi/Won internal (LOCKED, `app/data/index.ts`) — TIDAK ada logic pipeline yang diduplikasi, seluruhnya orkestrasi pemanggilan berurutan.
**Risiko:** rendah — field baru pada `Quotation` seluruhnya opsional/aditif; `/client/opportunities/[id]` (Section 08) TIDAK diubah, tetap berfungsi sebagai entry point alternatif.

---

### 5. Approval Center
**Status:** Existing & Complete (Repair Phase Section 3 — Request & Commercial)
**Existing:** `/client/approvals` (list, tab Pending/Approved/Rejected/Revision Requested/Expired — "Expired" derivasi `isApprovalExpired`, bukan status tersimpan), `/:id` (detail: Financial Impact tersanitasi/Timeline Impact/Supporting Document/Comment/Audit History via `ACTIVITIES` project terkait, Approve/Reject/Request Revision dengan alasan wajib untuk Reject/Revision). Mutator baru (`approveClientApproval`/`rejectClientApproval`/`requestClientApprovalRevision`) mengaudit ke `ACTIVITIES` (sumber sama Dashboard "Recent Activity", Section 2). Untuk `entityType: 'change-request'`, keputusan ikut men-sinkronkan `ChangeRequest.status` lewat `approveChangeRequest`/`rejectChangeRequest` existing (LOCKED, Section 19) — satu sumber kebenaran, tidak ada dua status yang bisa berbeda.
**Reusable module tersedia:** `Approval`/`getClientApprovalsByParty`/`getPendingClientApprovals` (Section 1 foundation) kini punya mutator penuh; field baru `expiresAt` (opsional, derivasi `isApprovalExpired`).
**Data demo:** `CAPP-001` menaut ke `CR-007` (skenario "Singapore Conference", `docs/client-mock-data-scenarios.md`) — satu-satunya item nyata saat ini karena 8 dari 9 `ApprovalEntityType` (itinerary-version/participant-list/rooming-list/dll.) belum punya sumber data — akan terisi natural saat section "Travel Management"/"Collaboration" membangun entitas sumbernya, TIDAK dipaksakan sebagai data palsu.
**Risiko:** rendah — pemetaan sinkronisasi hanya untuk `change-request` (satu-satunya entitas riil saat ini), 8 tipe lain murni memutasi `Approval` sendiri (aman, tidak ada entitas lain untuk disinkronkan).

---

### 6. Projects
**Status:** Existing & Complete (Repair Phase Section 4 — Core Project)
**Existing:** `/client/projects` (list baru — search/filter status/kolom readiness/nilai project/Manova PIC/aktivitas terakhir, reuse `getProjectsByParty`+`getClientProjectReadiness`) menautkan ke `app/pages/client/project-orders/[id]/index.vue` (Project Workspace, TIDAK dibangun ulang) yang kini punya 12 tab penuh (Overview/Timeline/Services/Participants/Itinerary/Reservations/Documents/Billing/Change Requests/Issues/Activities/Closing) + 1 tab aditif Kebutuhan Komoditas. Timeline/Services/Activities/Closing derivasi murni dari data existing (`Project` fields/`getServiceReadinessMatrix`/`getActivitiesByProject`/`getProjectClosureSummary`); Issues dipisah dari tab "Changes & Incidents" lama (kini "Change Requests" murni).
**Reusable module tersedia:** seluruh selector di atas SUDAH ADA sebelum section ini — tidak ada dataset baru untuk Projects sendiri.
**Risiko:** rendah — deep link lama (`?tab=travelers`/`finance`/`changes` dari Dashboard Section 2) tetap valid (`value` tab dipertahankan, hanya label yang berubah).

---

### 7. Participants
**Status:** Existing & Complete (Repair Phase Section 4 — Core Project)
**Existing:** `/client/participants` (list lintas project — search/filter project/filter incomplete, bulk select+action, Mark VIP, Bulk Import simulation via `previewTravelerImportMock`/`commitTravelerImport` existing, Export simulation mock pola sama `/reports`) + `/client/participants/[id]` (detail — Edit, Mark VIP, Cancel, Replace, Assign Room/Assign Roommate). 3 mutator baru (`setTravelerVip`/`cancelTraveler`/`replaceTraveler`, soft-cancel append-only — BUKAN hard-delete seperti `removeTraveler` existing) + 3 mutator `RoomAssignment` baru (`createRoomAssignment`/`setRoomAssignmentTravelers`/`removeRoomAssignment` — sebelumnya read-only). Field baru aditif pada `Traveler`: `isVip`/`cancelled`/`cancelReason`/`replacedByTravelerId`/`replacesTravelerId`.
**Reusable module tersedia:** `createTraveler`/`updateTraveler`/`isTravelerDocumentMissing` (Section 11, LOCKED) di-reuse apa adanya.
**Known limitation:** status "Booked"/"Ticketed"/"Travel Completed" (Master Prompt 9 status) TIDAK direpresentasikan — tidak ada linkage per-traveler ke status booking individual di data model existing (FlightBooking dkk. hanya punya `travelerIds` agregat). Status yang ditampilkan (Draft/Incomplete/Submitted/Verified/Cancelled/Replacement) derivasi jujur dari field yang benar-benar ada.

---

### 8. Itineraries
**Status:** Existing & Complete (Repair Phase Section 4 — Core Project)
**Existing:** `/client/itineraries` (list, 1 baris per project berisi itinerary) + `/:id` (`:id` = project id — daily timeline/table view toggle, Version History, Compare Versions, Comment, Request Revision, Approve, Download Mock PDF via `/:id/preview` baru). `ItineraryVersion` (Section 1 foundation) kini punya mutator penuh: `requestItineraryRevision` (versi aktif ditandai `revision-requested`, TIDAK PERNAH ditimpa — versi baru dibuat menyalin item yang sama, `supersedesVersionId` menaut ke versi lama) dan `approveItineraryVersion`. `ItineraryComment` (entitas baru, pola sama `QuotationComment` Section 3) untuk Comment. Seed `ITVER-001..004` untuk PRJ-201–204 (PRJ-201/Korea `waiting-approval`, persis narasi Skenario A).
**Reusable module tersedia:** `getClientVisibleItineraryItems`/`getItineraryVersionsByProject`/`getLatestItineraryVersion` (sudah ada) di-reuse apa adanya.
**Known limitation:** konten harian itinerary (isi hari-per-hari) TETAP wewenang AE/Ops — Client hanya bisa MEMINTA revisi (comment), bukan mengedit item; versi hasil revisi karena itu menyalin item yang sama (mock, jujur didokumentasikan di kode).

---

### 9. Reservations
**Status:** Existing & Complete (Repair Phase Section 4 — Core Project)
**Existing:** `/client/reservations` (list lintas project, search/filter kategori) + tab "Reservations" `/client/project-orders/[id]` + `/client/reservations/[type]/[id]/preview` (confirmation/ticket/voucher preview client-safe BARU — bukan reuse `/ticketing`\`/accommodation`\`/transportation`\`/mice` preview internal yang ternyata SEMUA gated `canView(<modul>)`, `NONE` untuk client, pola bug yang sama ditemukan di `quotation-preview` Section 3). Opsi arsitektur (b) yang dipilih: `getClientReservations` (baru) derivasi murni dari `getBookingTimeline` existing (Section 18) — TIDAK ada dataset booking paralel, `RESERVATIONS`/`Reservation` (Section 1 foundation) TETAP kosong sesuai desain aslinya ("didesain untuk diderivasi, bukan dataset paralel").
**Reusable module tersedia:** `getBookingTimeline`/`getFlightBookingById`/`getHotelBookingById`/`getTransportBookingById`/`getMiceEventById` (Section 13-18, LOCKED) di-reuse apa adanya — TIDAK ADA mutator baru (Client hanya view + request change lewat Change Request, sesuai larangan Master Prompt "no direct vendor booking editing").
**Known limitation:** hanya 4 dari 10 `ReservationCategory` (flight/hotel/transportation/venue-dari-mice) punya data nyata — visa/insurance/guide/restaurant/activity/event-equipment tidak punya entitas booking internal sama sekali di codebase, filter dropdown tetap menampilkan seluruh 10 kategori (konsisten pola dropdown lain), hasil kosong untuk 6 kategori tsb bukan bug.

---

### 10. Trip Center
**Status:** Existing & Complete (Repair Phase Section 5 — Execution & Changes)
**Existing:** `/client/trip-center` (list Project Order dikelompokkan mode) + `/client/trip-center/[projectId]` (detail penuh) — countdown, current status (`getProjectOrderStatus`), today's schedule/next activity (`getTripCenterSchedule`, derivasi `getClientVisibleItineraryItems`), meeting point (`getTripCenterMeetingPoint`), Tour Leader/Manova PIC/Emergency Contact (field baru `Project.tourLeaderName/Phone`/`emergencyContactName/Phone`/`meetingPoint`, `ItineraryItem.location`), Flight/Hotel/Transportation summary (`getClientReservations` terfilter kategori), Announcements (`TripAnnouncement`, entitas baru, dengan Confirm), Participant readiness (`getTravelerReadiness`), Important documents (`getClientDocumentsByProject`), Open Issues (`getIncidentsByProject`, sanitized status+resolutionNote). Action View itinerary/ticket/voucher/Contact PIC seluruhnya menaut ke halaman real; Create Issue menaut ke `/client/support` (shell, Section 6).
**Reusable module tersedia:** `getTripCenterMode` (baru, derivasi `Project.status`+tanggal, 3 mode Pre-departure/Active/Completed) — TIDAK ADA dataset booking/jadwal paralel, sesuai rekomendasi opsi derivasi.
**Update Section 8 (perbaikan konteks):** "Create Issue" sebelumnya hanya `router.push('/client/support')` tanpa konteks project — Client harus memilih ulang project secara manual di form. Kini mengirim `?project=<projectId>`, dibaca `/client/support` (`onMounted`) untuk langsung membuka form Create Ticket dengan project sudah terisi.
**Risiko:** rendah — murni derivasi + 1 entitas baru kecil (`TripAnnouncement`).

---

### 11. Change Requests
**Status:** Existing & Complete (Repair Phase Section 5 — Execution & Changes)
**Existing:** `/client/change-requests` (list Draft+Submitted, create/save-draft/submit) + `/:id` (detail: Impact Review/Cost Impact/Timeline Impact/Cancellation Fee, Approve/Reject keputusan Client, Cancel, Comment, Attachment mock, Execution Progress, Activity History). Tab "Change Requests" Project Workspace tetap ada (dialog cepat lama + link ke halaman penuh). `ChangeRequestStatus` diperluas ADITIF (6 nilai baru: `availability-check`/`costing`/`waiting-client-approval`/`in-execution`/`cancelled`/`not-feasible`) — 5 nilai lama & seluruh flow internal `/changes` TIDAK berubah perilakunya (hanya opsi transisi baru ditambahkan, tidak ada yang dihapus). `ChangeRequestDraft` entitas TERPISAH (bukan `ChangeRequest.status: 'draft'`) agar draft belum-submit tidak pernah bocor ke `/changes` internal.
**Reusable module tersedia:** `createChangeRequest`/state machine existing di-reuse APA ADANYA oleh `submitChangeRequestDraft`; `runChangeRequestMockReview` (baru, deterministik, pola sama `runTravelRequestMockReview` Section 3) meng-cascade submitted→under-review→availability-check→costing→waiting-client-approval (atau `not-feasible` via `getChangeRequestReviewGate`), mengisi `commercialImpactIdr`/`cancellationFeeIdr`/`timelineImpactNote`/`operationalImpact` deterministik (bukan random).
**Update Section 8 (perbaikan keamanan CRITICAL):** halaman detail (`/:id`) sebelumnya merender `commercialImpactIdr`/`cancellationFeeIdr`/`operationalImpact` MENTAH pada bagian "Impact Review" — bertentangan dengan komentar tipe sendiri (`app/types/change-incident.ts`) yang eksplisit menandai field ini internal-only. Diperbaiki: kini hanya pernyataan kualitatif + `timelineImpactNote`, identik pola `approvals/[id]/index.vue`. Detail lengkap di `docs/client-role-scope.md` bagian 6.
**Known limitation (dikonfirmasi ulang Section 8):** `approveChangeRequestImpact` tidak memutasi entitas terkait (Traveler/ItineraryVersion/Reservation) — "Related project data updated" (Master Prompt Flow 5) hanya terpenuhi lewat notifikasi+`ACTIVITIES`, belum linkage mekanis. Detail di `docs/client-business-flow.md` Flow 5.
**Risiko:** rendah — perluasan status aditif murni, diverifikasi tidak mengubah 1 pun perilaku tombol internal `/changes`/`/changes/[id]` (transisi lama tetap resolve identik).

---

### 12. Documents
**Status:** Existing & Complete (Repair Phase Section 5 — Execution & Changes)
**Existing:** `/client/documents` — search, filter kategori (5 kategori client-facing: Commercial/Participant/Travel/Finance/Closing, derivasi `getClientDocumentCategory` dari `entityType`/`category`, BUKAN field tersimpan baru), filter project, preview (dokumen `generated`)/download mock (dokumen `uploaded`), upload mock (`createClientDocument`, selalu `accessLevel: 'client'`), replace version (`replaceClientDocument`, append-only via `Document.supersedesId` baru — tidak pernah menimpa versi lama), version history (`getDocumentVersionHistory`), verification status (field baru `Document.verified`/`verifiedBy`/`verifiedAt`, read-only dari sisi Client), expiry (reuse `isDocumentExpired`/`isDocumentExpiringSoon`), comment (`DocumentComment`, entitas baru), related entity. Tab Documents Project Workspace diperkaya (kategori/versi/preview) sambil mempertahankan list lama (`ProjectDocument`) apa adanya, plus link ke halaman penuh (deep link `?project=`).
**Reusable module tersedia:** `Document`/`DOCUMENT_RECORDS` (Section 21) di-reuse penuh via `getClientDocuments`/`getClientDocumentsByProject` (filter `accessLevel: 'client'` + company scope) — TIDAK ADA dataset dokumen paralel. `ROLE_MODULE_ACCESS.client.documents` TETAP `'NONE'` (tidak disentuh) — isolasi lewat gate `client-portal` + filter `accessLevel`, pola sama Notifications (Section 2).
**Risiko:** rendah — seluruh field baru pada `Document` opsional/aditif, tidak ada breaking change ke `/documents` internal.

---

### 13. Messages & Activities
**Status:** Existing & Complete (Repair Phase Section 6 — Finance & Collaboration)
**Existing:** `/client/messages` (list project + unread badge) + `/client/messages/[projectId]` (tab Messages — reply/mention mock/attachment mock/unread-state via `Message.readBy` baru; tab Activity Timeline — `getUnifiedActivityTimeline('project', projectId, 'client')`, Section 21 LOCKED, filter `kind !== 'message'`). "Quotation/Itinerary/Change Request conversation" DIWUJUDKAN sebagai link ke comment thread yang SUDAH ADA masing-masing (`QuotationComment`/`ItineraryComment`/`ChangeRequestComment`, Section 3/4/5) — keputusan desain sadar, BUKAN diimplementasikan ulang sebagai channel `Message` kedua untuk entitas yang sama (satu source of truth per entitas).
**Reusable module tersedia:** `Message`/`sendMessage`/`getUnifiedActivityTimeline` (Section 21, LOCKED) di-reuse penuh — `internalOnly`/`channel !== 'internal-note'` filtering diverifikasi tidak bocor.
**Known limitation:** "Approval activity" (salah satu dari 4 kategori Wajib "Pisahkan") tidak punya `kind` terpisah di `UnifiedTimelineEntry` (hanya activity/system-event/message/document) — approval activity SECARA KONTEN sudah masuk `kind: 'activity'` (ACTIVITIES mencatat keputusan approval), hanya tidak bisa difilter terpisah dari activity lain.

---

### 14. Issues & Support
**Status:** Existing & Complete (Repair Phase Section 6 — Finance & Collaboration)
**Existing:** `/client/support` (list + search/filter kategori/status + Create Ticket, emergency ticket ditandai visual menonjol) + `/client/support/[id]` (detail: reply+attachment mock, SLA target/breach indicator, Assigned PIC, Resolution, Confirm Resolution, Reopen, Rating 1-5). `SupportTicket` (Section 1 foundation) kini punya mutator penuh (`createSupportTicket` — auto-assign PIC deterministik per kategori; `replySupportTicket` — auto `waiting-for-client`→`in-progress` saat Client membalas; `confirmSupportTicketResolution`/`reopenSupportTicket`/`rateSupportTicketResolution`).
**Reusable module tersedia:** tetap terpisah dari `Incident` internal (LOCKED) sesuai desain Section 1 — tidak ada tumpang tindih.
**Known limitation:** tidak ada trigger "resolve" otomatis untuk tiket BARU yang dibuat live selama demo (resolusi membutuhkan investigasi genuine, bukan mock instan seperti Availability Check Change Request) — 2 dari 3 tiket seed SENGAJA sudah `resolved`/`in-progress` agar aksi Confirm/Reopen/Rating tetap bisa didemokan jujur tanpa fake automation.

---

### 15. Finance & Billing
**Status:** Existing & Complete (Repair Phase Section 6 — Finance & Collaboration)
**Existing:** `/client/billing` (dashboard 6 kartu ringkasan + invoice list search/filter status/project + link Statement of Account) + `/client/billing/invoices/[id]` (detail: payment schedule/history, Upload Payment Proof, Raise Dispute, link Download Tax Invoice/Receipt) + `/client/billing/invoices/[id]/preview` (print mock, tax invoice + receipt satu dokumen) + `/client/billing/statement` (print mock, Statement of Account). "Client tidak boleh menandai Paid sendiri" terjamin secara ARSITEKTUR — `submitPaymentProof` (mutator Client) TIDAK PERNAH memanggil `recordPayment` (LOCKED, Section 20); hanya `runPaymentVerificationMock` (mock "tim Finance", dipicu lazy saat halaman Billing/invoice detail di-mount berikutnya, BUKAN cascade instan) yang memanggilnya.
**Reusable module tersedia:** `Invoice`/`Payment`/`CreditNote`/`recordPayment` (Section 20, LOCKED) di-reuse apa adanya. `InvoiceStatus` diperluas ADITIF 2 nilai (`waiting-verification`/`disputed`) — 4 nilai lama tidak berubah makna, seluruh selektor existing (`getInvoiceOutstandingIdr` dkk.) otomatis memperlakukan keduanya sebagai "belum lunas" tanpa perubahan kode di selektor tsb.
**Risiko:** rendah — perluasan status aditif murni, "Draft/Issued/Viewed/Overdue/Cancelled/Refunded" (6 nilai Master Prompt lain) SENGAJA derivasi (`viewedAt`, `isInvoiceOverdue`, `status: 'void'`) bukan status tersimpan kedua, menghindari representasi ganda.

---

### 16. Reports & Analytics
**Status:** Existing & Complete (Repair Phase Section 7 — Insights & Company)
**Existing:** `/client/reports` — 10 stat card (Total Trips/Projects/Participants/Spending/Average Project Value/Upcoming Trips/Completed Trips/Outstanding Invoices/Cancellation Rate/Satisfaction) + Spending by Month & Change Request Frequency (`SimpleBarChart`, Chart.js/vue-chartjs, diekstrak dari `BudgetChart.vue` Dashboard) + Spending by Destination/Service, Trips by Status, Issue Category, Payment Status (`StatusBreakdownList`, pola sama `/reports` internal) + Participant Trend. Filter Date range/Project/Destination/Service/Status, Export Excel/PDF mock (toast, pola sama `/reports`), Print view (`window.print()`).
**Reusable module tersedia:** `getClientReportSummary` (baru, `app/data/index.ts`) — agregasi murni di atas `getInvoiceOutstandingIdr`/`getTravelers`/`getChangeRequestsByProject`/`getSupportTicketsByParty`/`getFeedbackByProject` (seluruhnya existing) — TIDAK ADA dataset laporan paralel.
**Known limitation:** "Participant Trend" adalah pendekatan (bar per Project Order diurutkan tanggal keberangkatan, bukan tren bulanan sungguhan) karena `Traveler` tidak punya timestamp pendaftaran individual — dicatat jujur di kode, bukan bug. "Spending by Service" adalah estimasi (nilai project dibagi rata jumlah service dalam `serviceScope`, karena tidak ada breakdown biaya per-service yang client-safe).
**Risiko:** rendah — murni agregasi/read di atas selector existing.

---

### 17. Feedback & Evaluation
**Status:** Existing & Complete (Repair Phase Section 7 — Insights & Company)
**Existing:** `/client/feedback` (list Project Order + status feedback) + `/client/feedback/[projectId]` (form 12 dimensi rating + recommendation score + comment + improvement suggestion + testimonial consent, Save Draft/Submit, read-only setelah submit). `Feedback` (Section 1 foundation) kini punya mutator penuh (`saveFeedbackDraft`/`submitFeedback`).
**Reusable module tersedia:** `RatingInput.vue` (baru, komponen star-rating generik, dipakai 12 dimensi + rating Support Ticket Section 6 — TIDAK diduplikasi).
**Integrasi closure:** `submitFeedback` memanggil `markProjectFeedbackCollected` — menaut ADITIF ke `ProjectClosureChecklist.feedbackCollected` SAJA (field lain di checklist tidak disentuh). `evaluateProjectClosureGate` (LOCKED, Section 24) bahkan TIDAK memeriksa field ini sebagai blocker — integrasi murni indikator progress, sesuai "aditif murni, tidak mengubah logic gate existing" (rekomendasi Section 0 diikuti persis).
**Known limitation:** "Acknowledged"/"Follow-up Required" (keputusan tim internal) tidak punya trigger otomatis di section ini (di luar scope Client-only) — tidak ada seed demo untuk status tsb (jujur, bukan fake automation); Client dapat mendemokan penuh Draft→Submit untuk PRJ-203 (skenario "Feedback pending").

---

### 18. Company Profile
**Status:** Existing & Complete (Repair Phase Section 7 — Insights & Company)
**Existing:** `/client/company-profile` — View/Edit/Save/Cancel/unsaved-changes-warning, Logo upload mock, Legal document upload mock (reuse `Document`/`getClientDocuments` Section 5, `entityType: 'party'`), Billing data, Tax data, Contacts (CRUD penuh — `updateContact`/`deleteContact` baru melengkapi `createContact` existing), Travel preferences, Change History (reuse `PartyActivity` existing, disaring), Verification state for sensitive changes.
**Field sensitif** (registrationNumber/npwp/billingName/billingAddress/paymentTerm) TIDAK langsung ditulis — `submitSensitiveCompanyProfileChange` menyimpan ke `Party.pendingProfileChange` (badge "Menunggu Verifikasi" tampil di halaman), `runCompanyProfileVerificationMock` (lazy, dipicu `onMounted`, pola sama `runPaymentVerificationMock` Section 6) menerapkannya di kunjungan berikutnya.
**Reusable module tersedia:** `Party` (`app/types/party.ts`, LOCKED) diperluas ADITIF murni (seluruh field baru opsional) — halaman internal (`/crm/parties/[id]`) TIDAK terpengaruh. "Main/Finance/Emergency contact" (Master Prompt) DIWUJUDKAN sebagai role bebas pada field `ContactPerson.title` existing (bukan 3 field structured baru) — keputusan desain sadar, menghindari duplikasi konsep "kontak" yang sudah ada.
**Update Section 8 (perbaikan bug):** "Delete Contact" sebelumnya menghapus kontak LANGSUNG tanpa konfirmasi (satu-satunya aksi destruktif di seluruh 18 halaman tanpa dialog konfirmasi, melanggar konsistensi pola Master Prompt K "Confirmation dialog"). Kini melalui dialog konfirmasi ("Kontak ... akan dihapus... tidak dapat dibatalkan") sebelum `deleteContact` dipanggil.
**Risiko:** rendah — tidak ada Users & Access (sesuai larangan eksplisit), field baru seluruhnya opsional/aditif.

---

## Ringkasan Klasifikasi

**Update Section 2 (Home):** Dashboard dan Notifications kini **Existing & Complete** terhadap Master Prompt bagian G.1/G.2 — lihat #1/#2 di atas.
**Update Section 5 (Execution & Changes):** Trip Center, Change Requests, dan Documents kini **Existing & Complete** — lihat #10/#11/#12 di atas.
**Update Section 6 (Finance & Collaboration):** Finance & Billing, Messages & Activities, dan Issues & Support kini **Existing & Complete** — lihat #13/#14/#15 di atas.
**Update Section 7 (Insights & Company):** Reports & Analytics, Feedback & Evaluation, dan Company Profile kini **Existing & Complete** — lihat #16/#17/#18 di atas. **Seluruh 18 halaman kini Existing & Complete.**

| Status | Jumlah halaman |
|---|---|
| Existing & Complete | 18 (seluruh 18 halaman Master Prompt bagian E) |
| Existing but Incomplete | 0 |
| Not Available | 0 |

Total 18/18 halaman selesai per Repair Phase Section 7. Section 8 (Integration, QA, Regression, and Final Documentation) fokus pada regresi lintas-section, konsistensi data, dan dokumentasi akhir — bukan halaman baru.

## Update Section 8 — Final Integration & QA

Audit penuh dijalankan terhadap seluruh 18 halaman (route/nav/breadcrumb/loading/empty/error/form validation/confirmation/toast/responsive/broken link/dead button/status/accessibility) plus trace kode 6 flow wajib, audit keamanan data, audit regresi role lain, dan audit code quality (lihat `docs/client-progress.md` Section 8 untuk metodologi dan hasil test lengkap).

**Bug diperbaiki (6):**
1. Dashboard — dialog "Ajukan Travel Request" lama menulis ke `Lead`, bukan `TravelRequest` (workflow terputus, data hilang diam-diam) — lihat #1 di atas.
2. Notifications — dead click untuk notifikasi `entityType: 'travel-request'`/`'quotation'` — kini `notificationRoute()` memetakan keduanya.
3. Change Requests detail — kebocoran data internal `commercialImpactIdr`/`cancellationFeeIdr`/`operationalImpact` (CRITICAL, security) — lihat #11 di atas.
4. Company Profile — Delete Contact tanpa dialog konfirmasi — lihat #18 di atas.
5. Messages — kirim pesan tanpa toast konfirmasi — kini menampilkan "Pesan Terkirim".
6. Trip Center — "Create Issue" kehilangan konteks project — lihat #10 di atas.

**Perbaikan minor (konsistensi, bukan bug fungsional):** 3 tabel di Project Workspace (tab Participants/Billing/Kebutuhan Komoditas) dibungkus `overflow-x-auto` (sebelumnya berisiko overflow horizontal di mobile, tidak konsisten dengan pola tabel di halaman lain); 5 aksi submit comment/reply (Quotations/Itineraries/Change Requests/Documents/Support ticket reply) kini menampilkan toast sukses, konsisten dengan aksi lain di halaman yang sama; beberapa `aria-label` ditambahkan pada tombol icon-only (star rating Support Ticket, Edit/Delete Contact Company Profile, filter kategori Notifications).

**Tidak diperbaiki (didokumentasikan sebagai known limitation, bukan bug — di luar scope "jangan menambah fitur besar baru"):** linkage mekanis Change Request→Traveler/Itinerary/Reservation (lihat #11), beberapa gap minor kosmetik (pola Table vs `<ul>` tidak seragam di Projects/Documents — berfungsi normal, hanya berbeda gaya).

**Hasil:** lint 0 error (19 warning pre-existing tidak berkaitan), typecheck 0 error, unit test 91/91 lulus, build sukses — seluruhnya diverifikasi ULANG setelah perbaikan di atas diterapkan (bukan hanya sebelum).
