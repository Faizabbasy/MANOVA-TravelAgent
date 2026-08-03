# Client Progress — MANOVA B2B Client Experience (18-Page Initiative)

Dicatat sesuai format wajib `prompts/repair_phases/MASTER-PROMPT.md` bagian M. Satu entri per Section `prompts/repair_phases/PROMPT-SECTION-N.md`. Jangan menghapus entri lama — hanya menambah entri baru per section yang selesai dikerjakan.

---

## Section 0 — Audit dan Gap Analysis

**Section:** 0
**Status:** COMPLETED (audit only — tidak ada implementasi kode)
**Pages:** Tidak ada halaman dibuat/diubah pada section ini (dilarang eksplisit oleh `PROMPT-SECTION-0.md`)
**Routes:** Tidak ada route dibuat/diubah
**Components:** Tidak ada component dibuat/diubah
**Mock data:** Tidak ada mock data dibuat/diubah
**Services/store:** Tidak ada
**Workflow:** N/A — section ini murni audit dan dokumentasi

**Temuan utama:**
- 4 route Client existing (`/client`, `/client/opportunities/[id]`, `/client/project-orders/[id]`, `/client/catalog/[requirementId]`) dipetakan lengkap terhadap 18 halaman target — lihat `docs/client-page-inventory.md`.
- 9 dari 18 halaman: **Existing but Incomplete**. 9 dari 18 halaman: **Not Available**. 0 dari 18 halaman: **Existing and Complete** terhadap spesifikasi baru (diperkirakan — spesifikasi lama Section 08 lebih ringkas).
- Reusable infrastructure signifikan ditemukan untuk Notifications/Documents/Messages (`app/types/document-comms.ts`, Section 21) yang sudah lengkap secara tipe tapi belum diekspos ke role `client` (`ROLE_MODULE_ACCESS.client.documents = 'NONE'`).
- Tidak ditemukan pelanggaran terhadap larangan Master Prompt (tidak ada sub-role Client, tidak ada flow B2C, sanitasi cost/margin sudah benar di seluruh halaman existing).

**Test result:**
- lint: 0 error, 19 warning (pre-existing, tidak berkaitan dengan Client role)
- typecheck: 0 error
- test: 91/91 lulus (6 file test)
- build: tidak dijalankan ulang pada section ini (tidak ada perubahan kode); build terakhir pada sesi kerja yang sama berstatus sukses

**Known issue:** Tidak ada bug ditemukan — section ini murni audit, tidak menyentuh kode.

**Next section:** Section 1 (lihat `prompts/repair_phases/PROMPT-SECTION-1.md` untuk scope aktual yang berlaku saat ini — folder `prompts/repair_phases/` sedang dipakai untuk inisiatif Client Experience ini, bukan lagi untuk seri "repair bug" sebelumnya).

---

## Section 1 — Client Foundation

**Section:** 1
**Status:** COMPLETED (foundation only — tidak ada halaman bisnis diimplementasikan penuh, sesuai larangan eksplisit `PROMPT-SECTION-1.md`)

**Routes:** 17 route baru dibuat (seluruhnya shell `ModulePlaceholder`): `/client/notifications`, `/client/travel-requests`, `/client/quotations`, `/client/approvals`, `/client/projects`, `/client/participants`, `/client/itineraries`, `/client/reservations`, `/client/trip-center`, `/client/change-requests`, `/client/documents`, `/client/messages`, `/client/support`, `/client/billing`, `/client/reports`, `/client/feedback`, `/client/company-profile`. 4 route lama (`/client`, `/client/opportunities/[id]`, `/client/project-orders/[id]`, `/client/catalog/[requirementId]`) TIDAK diubah.

**Layout:** Reuse penuh `dashboard.vue` + `AppSidebar.vue` existing (sudah mendukung nested children + `comingSoon` badge + responsive collapse/mobile) — tidak ada layout baru dibuat, sesuai "gunakan existing components terlebih dahulu".

**Auth/Role:** Role `client` sudah sesuai spec sejak sebelum Section 1 (dikonfirmasi Section 0) — tidak diubah. Mock account baru `USR-021` (clientPartyId `PTY-005`) ditambahkan untuk 5 skenario demo.

**Navigation:** `app/constants/navigation.ts` — 1 entri "Client Portal" lama diganti 7 entri top-level (Home/Request & Commercial/Travel Management/Collaboration/Finance & Billing/Insights/Company Profile) berisi 18 child route, seluruhnya `moduleKey: 'client-portal'` (tidak ada modul baru).

**Types:** 6 file baru — `app/types/{travel-request,client-approval,itinerary-version,reservation,support,feedback}.ts`. Tidak ada duplikasi type existing (`Party`/`Quotation`/`Project`/`Traveler`/`ChangeRequest`/`Document`/`Invoice`/`Payment`/`Message`/`Notification` seluruhnya di-reuse apa adanya).

**Mock data:** 6 array kosong baru (`app/data/{travel-requests,client-approvals,itinerary-versions,reservations,support-tickets,feedback}.ts`) + 5 skenario demo (`PTY-005`, `USR-021`, `PRJ-201`-`PRJ-204`, `LED-012`, invoice/payment/traveler/itinerary/service pendukung, `CR-007`) — detail lengkap `docs/client-mock-data-scenarios.md` (baru).

**Store/Service:** Foundation read/filter selector di `app/data/index.ts` (bagian "Client Experience — Foundation selectors") untuk 6 entitas baru: `getTravelRequestsByParty`/`getTravelRequestById`/`getTravelRequestAttachments`, `getClientApprovalsByParty`/`getPendingClientApprovals`, `getItineraryVersionsByProject`/`getLatestItineraryVersion`, `getReservationsByProject`, `getSupportTicketsByParty`/`getSupportTicketById`/`getSupportTicketReplies`, `getFeedbackByProject`/`getFeedbackByParty`. Mutator (create/update) SENGAJA belum ditambahkan — dibangun oleh section yang benar-benar mengonsumsinya (menghindari generic setter tanpa aturan bisnis).

**Reusable components:** `ModulePlaceholder` (sudah ada, belum pernah dipakai sebelum Section 1) dipakai untuk 17 shell. Komponen baru yang diminta Master Prompt (Filter bar, Activity timeline, Readiness progress) SENGAJA belum diekstrak jadi shared component — pola sudah ada (inline, mis. generic confirm-dialog pattern di halaman supplier) tapi diekstrak nanti saat consumer ke-2 muncul (hindari premature abstraction), dicatat sebagai known issue di bawah.

**Files changed:** lihat laporan final chat untuk daftar lengkap (types 6 baru, data 6 file baru + 5 file diedit aditif, `app/data/index.ts` diedit aditif, `app/constants/navigation.ts` diedit, 17 page baru, 5 file docs).

**Test result:**
- lint: 0 error, 19 warning (pre-existing, tidak berkaitan)
- typecheck: 0 error
- test: 91/91 lulus (tidak ada regresi dari seed data baru)
- build: lihat laporan final chat untuk hasil aktual

**Known issues:**
- Filter bar / Activity timeline / Readiness progress shared component belum diekstrak (pattern ada, dipakai inline di tempat lain) — akan diekstrak saat section implementasi pertama benar-benar membutuhkannya.
- Skenario A (Korea) "82% completion" tidak direplikasi presisi secara numerik (hanya sampel traveler, konsisten pola existing) — dicatat jujur di `docs/client-mock-data-scenarios.md`.
- Modul `documents` (`ROLE_MODULE_ACCESS.client.documents`) belum diubah dari `NONE` — akan diaudit hati-hati oleh section yang membangun Notifications/Documents/Messages (bukan Section 1).

**Next section:** Section 2 — Home (Dashboard, Notifications).

---

## Section 2 — Home (Dashboard, Notifications)

**Section:** 2
**Status:** COMPLETED

**Pages:** 2 halaman — `/client` (Dashboard, diperluas, bukan dibangun ulang) dan `/client/notifications` (dibangun penuh, menggantikan `ModulePlaceholder` Section 1).

**Routes:** Tidak ada route baru — `/client` dan `/client/notifications` sudah ada sejak Section 1, hanya `comingSoon: true` pada item nav "Notifications" (`app/constants/navigation.ts`) dihapus.

**Components:** Tidak ada shared component baru dibuat — seluruhnya reuse `StatsCard`/`SectionCard`/`EmptyState`/`ErrorState`/`LoadingState`/`RecentActivity`/`Progress`/`StatusBadge`/`Checkbox`/`PageHeader`/`RoleAccessState` (sudah ada sejak section-section sebelumnya, termasuk `LoadingState`/`ErrorState` yang ternyata sudah ada sejak awal — tidak perlu dibuat, hanya belum pernah dipakai `/client/**`).

**Mock data:** 8 `Notification` baru untuk `USR-021` (`NOT-010`–`NOT-017`, `app/data/document-comms.ts`) — derivasi jujur dari skenario existing (dokumen traveler kurang TRV-2012/TRV-2042, invoice belum lunas INV-2011/INV-2041, trip aktif PRJ-202, invoice lunas INV-2021, trip selesai PRJ-203, perubahan reservasi PRJ-204). Tidak ada mock data baru untuk `TravelRequest`/`Approval`/`SupportTicket` (tetap kosong, foundation-only sesuai Section 1 — Dashboard menampilkan angka 0 yang jujur untuk widget-widget ini, bukan angka statis).

**Services/store:**
- `app/types/document-comms.ts` — `NotificationCategory` (9 kategori Master Prompt G.2) + field opsional `Notification.category`, aditif (9 notifikasi internal lama tidak berubah).
- `app/constants/status.ts` — `NOTIFICATION_CATEGORIES` (StatusOption list, dipakai filter category).
- `app/utils/attention.ts` — `isInvoiceDueSoon`/`INVOICE_DUE_SOON_WINDOW_DAYS` (pola sama `isDocumentExpiringSoon`).
- `app/data/index.ts` — `pushNotification` diperluas (parameter `category` opsional di akhir, aditif); `getClientProjectReadiness` baru (derivasi murni dari `getTravelerReadiness`+`getServiceReadinessMatrix`+`getProjectOutstandingIdr` yang sudah ada, TIDAK ada field tersimpan baru).
- `app/components/layout/NotificationPanel.vue` — "View all notifications" kini bercabang per role (`client` → `/client/notifications`, lainnya tetap `/documents?tab=notifications`).

**Workflow:**
- Dashboard: 7 summary card (Active Projects/Upcoming Trips/Pending Approvals/Incomplete Participants/Outstanding Invoices/Open Issues/Action Required) seluruhnya dihitung dari `PROJECTS`/`INVOICES`/`TRAVELERS`/`CLIENT_APPROVALS`/`SUPPORT_TICKETS` milik `clientScopeId` login — tidak ada angka statis.
- Action Required: agregat `AttentionItem` (quotation menunggu konfirmasi, pending Approval generik, dokumen traveler kurang, invoice overdue/akan jatuh tempo, open Support Ticket) — setiap item `relatedRoute` membuka halaman nyata.
- Upcoming Trip: project aktif dengan keberangkatan mendatang atau sedang berjalan, readiness bar (`getClientProjectReadiness`) per project.
- Financial Summary: Invoiced/Paid/Outstanding/Overdue/Next Due dihitung dari `INVOICES`+`getInvoiceOutstandingIdr` seluruh project company.
- Recent Activity: gabungan `ACTIVITIES` (activity mock terpusat) + Payment `receivedAt` + Change Request `submittedAt`, diurutkan kronologis, reuse `RecentActivity.vue`.
- Quick Actions: 6 aksi (Create Travel Request — dialog existing; Review Approval — ke quotation pertama yang menunggu konfirmasi bila ada, else `/client/approvals`; Add Participant — ke tab Travelers project teratas bila ada, else `/client/participants`; Open Trip Center — `/client/trip-center`; Upload Payment Proof — `/client/billing`; Create Support Ticket — `/client/support`). 3 dari 6 (Trip Center/Upload Payment Proof/Create Support Ticket) mengarah ke shell `ModulePlaceholder` Section 1 karena mutator/halamannya di luar scope Section 2 — dicatat sebagai Known Issue, BUKAN tombol mati (route valid, konten informatif, konsisten pola `comingSoon` nav existing).
- Notifications: list per `userId` (isolasi otomatis, `Notification` sudah per-user), mark as read (klik item, sekaligus navigasi ke entity terkait bila `entityType`/`entityId` dikenali — `project`/`traveler`/`invoice`), mark all as read, search (title+body), category filter (9 kategori), unread filter, notification preference mock (in-app/email per kategori, tidak persisten lintas sesi/tidak terhubung pengiriman nyata), empty/loading/error state.

**State:** Client-side reactive computed di atas fixture terpusat (`app/data/*.ts`) — tidak ada state baru di luar pola existing (`ref`/`computed` per halaman, mutasi lewat mutator `app/data/index.ts` yang sudah ada: `markNotificationRead`/`markAllNotificationsRead`).

**Responsive:** Mengikuti pola grid existing `/client/**` (`grid-cols-2 sm:grid-cols-3 lg:grid-cols-4/6`, list `<ul>` bukan `<Table>` — sudah mobile-friendly tanpa scroll horizontal tambahan, konsisten seluruh halaman Client existing).

**Test:**
- lint: 0 error, 19 warning (pre-existing, tidak berkaitan dengan perubahan Section 2)
- typecheck: 0 error
- test: 91/91 lulus (6 file test, tidak ada regresi)
- build: sukses (`nuxt build` — client + server compile tanpa error; lihat laporan final chat untuk detail)

**Known issues:**
- `getClientProjectReadiness` hanya menghitung 3 dari 6 dimensi readiness Master Prompt G.1 (Participant/Reservation/Payment) — dimensi Commercial/Documents/Execution belum punya sumber data client-safe (PTY-005 belum punya Opportunity; modul `documents` Section 21 masih `NONE` untuk role `client`). Bukan bug — dicatat eksplisit di komentar kode dan di sini, akan dilengkapi saat section terkait membangun sumber datanya.
- 3 dari 6 Quick Action (Open Trip Center/Upload Payment Proof/Create Support Ticket) mengarah ke shell `ModulePlaceholder` (Section 1) karena mutator penuhnya adalah scope section lain (Travel Management/Finance/Collaboration) — sesuai larangan "jangan mengerjakan section lain di luar scope".
- "Pending Approvals"/"Open Issues" akan legitimately menampilkan 0 untuk demo `USR-021` sampai `TravelRequest`/`Approval`/`SupportTicket` benar-benar dikonsumsi section "Request & Commercial"/"Collaboration" — array masih kosong (foundation-only, Section 1), selector sudah tersambung dengan benar.
- `docs/client-mock-data-scenarios.md` belum diupdate untuk mencantumkan 8 `Notification` baru (NOT-010–017) — pertimbangkan menambah catatan singkat di sana bila section berikutnya menambah skenario notifikasi lagi.

**Next section:** Section 3 — Request & Commercial.

---

## Section 3 — Request & Commercial (Travel Requests, Quotations & Proposals, Approval Center)

**Section:** 3
**Status:** COMPLETED

**Pages:** 8 halaman baru — `/client/travel-requests` (list), `/new` (create), `/:id` (detail), `/:id/edit` (edit draft); `/client/quotations` (list), `/:id` (detail), `/:id/preview` (print/PDF mock); `/client/approvals` (list, 5 tab), `/:id` (detail).

**Routes:** Tidak ada route baru di `navigation.ts` — 3 top-level nav item (`Travel Requests`/`Quotations & Proposals`/`Approval Center`) sudah ada sejak Section 1, `comingSoon: true` dihapus. Route nested (`/new`, `/:id`, `/:id/edit`, `/:id/preview`) baru dibuat mengikuti rekomendasi Master Prompt bagian F.

**CRUD / Actions:**
- Travel Requests: Create, Save Draft, Edit Draft (guard status draft/need-clarification), Submit (gate + confirmation dialog + unsaved-changes warning), Duplicate, Cancel (alasan wajib), Respond to Clarification, Attachment mock. Status flow penuh via mock review deterministik (`getTravelRequestReviewGate`).
- Quotations & Proposals: Approve (cascade `recordClientConfirmation`→`advanceOpportunityStage('won-requested')`→`approveOpportunityWon`, pola "Mark as Won" D-053 dari sisi Client — Project otomatis dibuat), Reject, Request Revision (`requestQuotationRevision` baru — versi baru + auto-reapprove mock + reset `clientConfirmedAt`), Comment, Attachment mock, Download Mock PDF.
- Approval Center: Approve/Reject/Request Revision (alasan wajib untuk Reject/Revision) — untuk `entityType: 'change-request'` ikut men-sinkronkan `ChangeRequest.status` lewat `approveChangeRequest`/`rejectChangeRequest` existing (LOCKED).

**Cross-module flow:**
- Travel Request submitted → `TravelRequestActivity` dicatat → `Notification` dipush → mock review (`runTravelRequestMockReview`) → bila lolos gate: cascade `createLead`→`updateLeadQualification`→`qualifyLeadAndCreateOpportunity`→`createQuotation`→`submitQuotationForApproval`→`approveQuotation` (auto-approved, mock Management) → Quotation muncul dengan `approvalStatus: 'approved'`, siap ditinjau Client. TIDAK SATU PUN fungsi pipeline internal (`createLead` dkk.) diubah bodinya — section ini murni orkestrasi pemanggilan berurutan, pola sama `submitMarkAsWon` (`app/pages/crm/opportunities/[id]/index.vue`, D-053).
- Quotation revision requested → `duplicateQuotationVersion` (existing) → auto-resubmit+auto-approve (mock) → `clientConfirmedAt` direset → Activity + Notification.
- Quotation approved (Client) → `Approval` (jika relevan) → Won → Project dibuat memakai `opportunity.destination`/`travelStartDate`/`travelEndDate`/`serviceScope`/`travelerEstimate` dan `quotation.amountIdr` (fungsi `approveOpportunityWon` LOCKED, TIDAK diubah) — Dashboard (Section 2, `getProjectsByParty` reactive) dan Project List ter-update otomatis tanpa sinkronisasi manual tambahan.

**Validation:** `getTravelRequestSubmitGate`/`getTravelRequestReviewGate` (field wajib bertingkat, deterministik); Cancel/Reject/Request Revision (Travel Request, Quotation, Approval) seluruhnya wajib alasan non-kosong sebelum tombol aktif (pola mandatory-reason-on-destructive-transition, konsisten `rejectChangeRequest` existing).

**Components:** `ActivityTimeline.vue` (baru, `app/components/shared/`) — dipakai Travel Request activity, Approval Center audit history; `TravelRequestForm.vue` (baru, `app/components/client/`, folder component baru — `nuxt.config.ts` `components` array ditambah `{ path: '~/components/client', pathPrefix: false }`) — form 7-section (General/Flight/Hotel/Transportation/MICE/Additional Service/Attachment), dipakai `new.vue` dan `[id]/edit.vue`.

**Types/data (aditif, tidak ada breaking change ke tipe LOCKED):**
- `app/types/travel-request.ts` — `TravelRequestActivity` baru (pola sama `LeadActivity`).
- `app/types/client-approval.ts` — `Approval.expiresAt?` baru (derivasi `isApprovalExpired`, bukan status tersimpan).
- `app/types/opportunity.ts` — `Quotation.cancellationPolicy?`/`proposedItineraryNote?` baru (free-text, pola sama `termsAndConditions`); `QuotationAttachment`/`QuotationComment` baru (entitas kecil berdiri sendiri, BUKAN `Document`/`Message` Section 21 — modul `documents` tetap `NONE` untuk client, di luar scope section ini).
- `app/types/document-comms.ts` — `DocumentEntityType` ditambah `'travel-request'`/`'approval'` (union terbuka, dipakai `Notification.entityType`).
- `app/utils/attention.ts` — `isApprovalExpired` baru.
- `app/data/index.ts` — `pushNotification` diperluas (sudah ada param `category` sejak Section 2, kini juga dipakai entityType baru); ~25 fungsi baru (mutator + selector) untuk Travel Request/Quotation/Approval — lihat komentar section "Client Experience — Request & Commercial" di file tsb.
- `app/data/quotation-extras.ts` — file baru (`QUOTATION_ATTACHMENTS`/`QUOTATION_COMMENTS`, kosong).
- Seed data: `TR-001` (Bali MICE, `need-clarification`, menaut `leadId: 'LED-012'`) + 3 `TravelRequestActivity`; `CAPP-001` (menaut `CR-007`, `status: 'pending'`).

**Files:** lihat daftar lengkap di atas (types 4 file diedit, data 3 file diedit + 1 baru, components 2 baru, pages 8 baru, `nuxt.config.ts`+`navigation.ts` diedit, docs 3 file diupdate).

**Test:**
- lint: 0 error, 19 warning (pre-existing, tidak berkaitan)
- typecheck: 0 error
- test: 91/91 lulus (6 file test, tidak ada regresi)
- build: sukses (`nuxt build` — client + server compile tanpa error)

**Known issues:**
- Quotation "Version History" hanya membandingkan `amountIdr` (before/after) — `supersededAmountIdr` (field existing, Section 08) hanya menyimpan nominal sebelumnya, bukan snapshot penuh (breakdown/inclusions/terms versi lama tidak tersimpan). Mengubah `Quotation` jadi entitas multi-baris berisiko terhadap pipeline Won/Approval LOCKED yang mengasumsikan 1:1 Opportunity:Quotation — didokumentasikan sebagai keterbatasan sadar, bukan bug, mengikuti preseden `ItineraryVersion` (Section 1) sebagai pola yang benar untuk versioning penuh bila dibutuhkan section mendatang.
- "Financial Impact" pada Approval Center (`entityType: 'change-request'`) sengaja TIDAK menampilkan `commercialImpactIdr`/`financialImpactNote` mentah (mengikuti sanitasi existing `/client/project-orders/[id]` tab Changes & Incidents) — hanya pernyataan kualitatif + `timelineImpactNote`. Ini konsisten dengan larangan Master Prompt, bukan gap.
- 8 dari 9 `ApprovalEntityType` (semua kecuali `change-request`) belum punya data demo karena entitas sumbernya (itinerary version, participant list, rooming list, dll.) belum dibangun section manapun — Approval Center akan terisi natural saat section "Travel Management" membangunnya.
- Dialog "Ajukan Travel Request" lama di Dashboard (`/client`, Section 2) TIDAK diubah — masih memanggil `createLead` langsung tanpa entitas `TravelRequest` baru, hidup berdampingan dengan jalur baru yang lebih lengkap di `/client/travel-requests`.

**Next section:** Section 4 — Core Project.

---

## Section 4 — Core Project (Projects, Participants, Itineraries, Reservations)

**Section:** 4
**Status:** COMPLETED

**Pages:** 7 halaman baru/diperluas — `/client/projects` (list baru); `app/pages/client/project-orders/[id]/index.vue` (Project Workspace existing DIPERLUAS dari 7 ke 13 tab, TIDAK dibangun ulang); `/client/participants` (list) + `/:id` (detail); `/client/itineraries` (list) + `/:id` (detail) + `/:id/preview` (print); `/client/reservations` (list) + `/[type]/[id]/preview` (print).

**Project Workspace:** 13 tab — Overview, Timeline (baru, milestone derivasi `Project` fields), Services (baru, `getServiceReadinessMatrix`), Participants (relabel dari "Travelers", CRUD tetap sama + link ke `/client/participants`), Itinerary (existing + link ke halaman versioning penuh), Reservations (baru, `getClientReservations` sanitized), Documents (existing, tidak diubah), Billing (relabel dari "Finance", tidak diubah), Change Requests (relabel dari "Changes", kini murni ChangeRequest — Incident dipisah), Issues (baru, dipisah dari tab lama, read-only Incident), Activities (baru, `ActivityTimeline`+`getActivitiesByProject`), Closing (baru, read-only `getProjectClosureSummary`), Kebutuhan Komoditas (existing, tidak diubah). Deep link lama (`?tab=travelers`/`finance`/`changes`) tetap valid — hanya label yang berubah, `value` dipertahankan.

**Participant CRUD:** Add/Edit (reuse `createTraveler`/`updateTraveler` existing), Cancel (`cancelTraveler`, soft-cancel+alasan wajib, append-only — beda dari `removeTraveler` hard-delete existing), Replace (`replaceTraveler`, satu aksi atomik: lama→cancelled+link, baru→dibuat), Mark VIP (`setTravelerVip`), Assign Room/Assign Roommate (`createRoomAssignment`/`setRoomAssignmentTravelers`, mutator BARU — `RoomAssignment` sebelumnya read-only), Bulk Import simulation (reuse `previewTravelerImportMock`/`commitTravelerImport` existing), Export simulation (mock toast-only, pola sama `/reports`), Filter incomplete, Completeness indicator, Passport expiry warning (derivasi `daysUntil`).

**Itinerary versioning:** `requestItineraryRevision` (versi aktif→`revision-requested`, TIDAK PERNAH ditimpa, versi baru dibuat menyalin item + `supersedesVersionId`) dan `approveItineraryVersion` — keduanya mutator BARU (`ItineraryVersion` Section 1 foundation sebelumnya read-only). `ItineraryComment` entitas baru (pola sama `QuotationComment` Section 3). Seed `ITVER-001..004` untuk PRJ-201–204 (PRJ-201 `waiting-approval`, persis narasi Skenario A "Itinerary waiting approval").

**Reservation monitoring:** `getClientReservations` (baru) — derivasi murni dari `getBookingTimeline` existing (Section 18, opsi arsitektur (b) yang direkomendasikan `docs/client-page-inventory.md`), sanitized (TIDAK PERNAH `netCostIdr`/`sellPriceIdr`/status internal/payment gate/attempt log). `RESERVATIONS`/`Reservation` (Section 1 foundation) TETAP kosong sesuai desain aslinya. Preview ticket/voucher/service-order BARU (`/client/reservations/[type]/[id]/preview`) — TIDAK memakai preview internal (`/ticketing`\`/accommodation`\`/transportation`\`/mice`) karena SEMUA gated `canView(<modul>)` yang `NONE` untuk client (bug yang sama ditemukan di `quotation-preview` Section 3, kini terverifikasi berulang di 4 modul lain). Client hanya view + request change — TIDAK ADA mutator edit booking vendor.

**Cross-module flow:**
- Project created → Participant added → Completion recalculated → Project readiness updated → Dashboard updated: SUDAH bekerja penuh secara reactive (`getClientProjectReadiness` membaca `TRAVELERS` langsung, tidak perlu sinkronisasi manual) — sudah benar sejak Section 2, diverifikasi ulang di section ini.
- Participant verified → Reservation can progress → Ticket/voucher availability updated: SEBAGIAN — tidak ada linkage mekanis per-traveler ke status booking individual di data model existing (`FlightBooking` dkk. hanya `travelerIds` agregat) — dicatat sebagai known limitation, TIDAK dipaksakan lewat trigger palsu.
- Itinerary published → Approval created → Client revision request → New version → Client approval → Project readiness updated: SUDAH bekerja penuh — `getClientProjectReadiness` diperluas dengan dimensi `itineraryPercent` baru (derivasi `getLatestItineraryVersion().status`), reactive sama seperti dimensi lain.

**Data layer (aditif, tidak ada breaking change ke tipe/mutator LOCKED):**
- `app/types/project.ts` — `Traveler.isVip`/`cancelled`/`cancelReason`/`replacedByTravelerId`/`replacesTravelerId` baru.
- `app/types/itinerary-version.ts` — `ItineraryComment` baru.
- `app/data/index.ts` — `getTravelerById` (getter tunggal, sebelumnya tidak ada), `setTravelerVip`/`cancelTraveler`/`replaceTraveler`, `createRoomAssignment`/`setRoomAssignmentTravelers`/`removeRoomAssignment`, `getItineraryComments`/`addItineraryComment`/`approveItineraryVersion`/`requestItineraryRevision`, `getClientReservations`; `getClientProjectReadiness` diperluas (`itineraryPercent`, dikecualikan dari rata-rata bila belum ada versi).
- `app/data/itinerary-versions.ts` — seed `ITVER-001..004` + `ITINERARY_COMMENTS` (kosong).
- `app/constants/status.ts` — `ITINERARY_VERSION_STATUSES`, `RESERVATION_CATEGORIES` baru.

**Files:** types 2 file diedit, data 2 file diedit (index.ts besar, itinerary-versions.ts seed), constants 1 file diedit, pages 7 baru/1 diperluas besar, `navigation.ts` diedit, docs 3 file diupdate.

**Test:**
- lint: 0 error, 19 warning (pre-existing, tidak berkaitan)
- typecheck: 0 error
- test: 91/91 lulus (6 file test, tidak ada regresi)
- build: sukses (`nuxt build` — client + server compile tanpa error)

**Known issues:**
- Participant status "Booked"/"Ticketed"/"Travel Completed" (3 dari 9 status Master Prompt bagian G.7) TIDAK direpresentasikan — tidak ada linkage data model per-traveler ke status booking individual. 6 status lain (Draft/Incomplete/Submitted/Verified/Cancelled/Replacement) derivasi jujur dari field yang benar-benar ada.
- Itinerary "Request Revision" tidak benar-benar mengubah konten hari-per-hari (versi baru menyalin item yang sama) — konten itinerary tetap wewenang AE/Ops, di luar kewenangan role Client, dicatat jujur di kode.
- Reservation Category hanya 4 dari 10 nilai (`flight`/`hotel`/`transportation`/`venue`-dari-MICE) punya data nyata — 6 lainnya (visa/insurance/guide/restaurant/activity/event-equipment) tidak punya entitas booking internal sama sekali di codebase, filter tetap menampilkan semua 10 (konsisten pola dropdown lain), bukan bug.
- Participant verified → Reservation progress: link kausal spesifik belum ada (lihat Cross-module flow di atas).

**Next section:** Section 5 — Execution & Changes.

---

## Section 5 — Execution & Changes (Trip Center, Change Requests, Documents)

**Section:** 5
**Status:** COMPLETED

**Pages:** 6 halaman baru/dibangun penuh — `/client/trip-center` (list, menggantikan `ModulePlaceholder`) + `/client/trip-center/[projectId]` (detail, baru); `/client/change-requests` (list Draft+Submitted, menggantikan `ModulePlaceholder`) + `/client/change-requests/[id]` (detail, baru); `/client/documents` (list, menggantikan `ModulePlaceholder`). `app/pages/client/project-orders/[id]/index.vue` (Project Workspace existing) tab "Documents" diperkaya (kategori/versi/preview + link halaman penuh) dan tab "Change Requests" ditambah link "Kelola lengkap →" — dialog cepat lama TIDAK diubah/dihapus.

**Routes:** Tidak ada route baru di `navigation.ts` — 3 item (Trip Center/Change Requests/Documents) sudah ada sejak Section 1, `comingSoon: true` dihapus. Route nested baru (`/[projectId]`, `/[id]`) dibuat mengikuti rekomendasi Master Prompt bagian F.

**Trip Center (Master Prompt bagian A):**
- 3 mode (Pre-departure/Active/Trip Completed) — `getTripCenterMode` (baru), derivasi murni `Project.status`+tanggal vs `DEMO_REFERENCE_DATE`, BUKAN field tersimpan baru.
- Countdown, Current Status (`getProjectOrderStatus`, existing), Today's Schedule/Next Activity (`getTripCenterSchedule`, derivasi `getClientVisibleItineraryItems`), Meeting Point (`getTripCenterMeetingPoint`, item hari-ini atau default `Project.meetingPoint`), Tour Leader/Manova PIC/Emergency Contact (field baru aditif `Project.tourLeaderName/Phone`/`emergencyContactName/Phone`/`meetingPoint`, `ItineraryItem.location`), Flight/Hotel/Transportation summary (`getClientReservations` terfilter kategori, existing Section 4), Announcements (`TripAnnouncement`, entitas baru berdiri sendiri + `confirmTripAnnouncement`), Participant Readiness (`getTravelerReadiness`, existing), Important Documents (`getClientDocumentsByProject`, baru), Open Issues (`getIncidentsByProject`, sanitized status+resolutionNote saja, pola sama tab Issues Project Workspace).
- Action: View Itinerary/Ticket/Voucher (link ke halaman existing Section 4), Contact Manova PIC (`mailto:`), Create Issue (link `/client/support`, shell — halaman create penuh Section 6), Confirm Announcement (`confirmTripAnnouncement`, idempotent).

**Change Requests (Master Prompt bagian B):**
- List, Create, Save Draft, Submit, Detail, Comment, Attachment mock, Impact Review (Cost/Timeline/Cancellation Fee), Approval Decision, Execution Progress, Activity History — seluruhnya berfungsi dari sisi Client.
- `ChangeRequestDraft` — entitas BARU terpisah dari `ChangeRequest` (bukan `status: 'draft'`) agar draft belum-submit tidak pernah muncul di `/changes` internal (LOCKED) yang query `CHANGE_REQUESTS` tanpa filter status. `saveChangeRequestDraft`/`deleteChangeRequestDraft`/`submitChangeRequestDraft` (baru).
- `ChangeRequestStatus` diperluas aditif — 5 nilai lama (`submitted`/`under-review`/`approved`/`rejected`/`implemented`, LOCKED) tetap dipakai apa adanya oleh `/changes`/`/changes/[id]` internal; 6 nilai baru (`availability-check`/`costing`/`waiting-client-approval`/`in-execution`/`cancelled`/`not-feasible`) hanya dijangkau lewat mutator client baru. `CHANGE_REQUEST_TRANSITIONS` diperluas aditif (hanya menambah target, tidak menghapus) — diverifikasi tidak mengubah 1 pun tombol/perilaku internal existing.
- `runChangeRequestMockReview` (baru, deterministik, pola sama `runTravelRequestMockReview` Section 3) — cascade `submitted`→`under-review`→`availability-check`→`costing`→`waiting-client-approval` (mengisi `commercialImpactIdr`/`cancellationFeeIdr`/`timelineImpactNote`/`operationalImpact`) ATAU `not-feasible` via `getChangeRequestReviewGate` (deterministik: tipe re-booking dengan keberangkatan ≤H-7 dianggap tidak feasible, BUKAN random).
- `approveChangeRequestImpact`/`rejectChangeRequestImpact` (baru, keputusan Client atas `waiting-client-approval`) dan `cancelChangeRequest` (baru, Client membatalkan permintaan sendiri sebelum eksekusi) — seluruhnya mencatat `ACTIVITIES` (Activity History) + `pushNotification` ke pihak terkait.
- `ChangeRequestComment`/`ChangeRequestAttachment` (entitas baru, pola sama `ItineraryComment`/`QuotationAttachment`), `ChangeRequestType` (13 nilai "Jenis" Master Prompt lama, opsional).
- `createChangeRequest`/state machine internal (`app/data/index.ts`, Section 19, LOCKED) di-reuse APA ADANYA oleh `submitChangeRequestDraft` — TIDAK ADA logic pipeline yang diduplikasi.

**Documents (Master Prompt bagian C):**
- Search, filter kategori (5 kategori client-facing: Commercial/Participant/Travel/Finance/Closing — `getClientDocumentCategory`, derivasi dari `entityType`/`category`, BUKAN field tersimpan baru), filter project, Preview (dokumen `generated`, link `previewRoute` existing), Download mock (dokumen `uploaded`, toast), Upload mock (`createClientDocument`, selalu `entityType: 'project'`/`accessLevel: 'client'`), Replace Version (`replaceClientDocument`, append-only via `Document.supersedesId` baru), Version History (`getDocumentVersionHistory`, telusuri chain `supersedesId`), Verification (field baru `Document.verified`/`verifiedBy`/`verifiedAt`, read-only dari sisi Client), Expiry (reuse `isDocumentExpired`/`isDocumentExpiringSoon`, existing), Comment (`DocumentComment`, entitas baru), Related Entity.
- `Document`/`DOCUMENT_RECORDS` (Section 21, LOCKED) di-reuse penuh via `getClientDocuments`/`getClientDocumentsByProject` (filter `accessLevel: 'client'` + company scope) — TIDAK ADA dataset dokumen paralel. `ROLE_MODULE_ACCESS.client.documents` TETAP `'NONE'` (tidak disentuh), isolasi lewat gate `client-portal` + filter `accessLevel`, pola sama Notifications (Section 2).

**Cross-module integration:**
- Change Request submitted → Activity (`ACTIVITIES`) → Notification (`pushNotification`) → Mock review (`runChangeRequestMockReview`) → Impact available (`commercialImpactIdr` dkk.) → Approval (`approveChangeRequestImpact`) → Notification ke PM (`project.ownerId`) — SUDAH bekerja penuh, reactive tanpa sinkronisasi manual (Dashboard Recent Activity Section 2 membaca `ACTIVITIES` yang sama).
- Document uploaded → Activity: TIDAK ditambahkan (upload dokumen Client TIDAK men-trigger `ACTIVITIES`/`Notification` baru — konsisten preseden upload internal `/documents`, Section 21, yang juga tidak menghasilkan Activity/Notification otomatis) — dicatat sebagai keterbatasan sadar di Known Issues, bukan bug.
- Project Ready → Trip Center pre-departure → In Progress/Ongoing Trip → Active mode → Completed → Trip completed mode — SUDAH bekerja penuh (`getTripCenterMode` reactive terhadap `Project.status`+tanggal, diverifikasi ketiga skenario demo: PRJ-201 Korea pre-departure, PRJ-202 Abu Dhabi active, PRJ-203 Manila completed).

**Data layer (aditif, tidak ada breaking change ke tipe/mutator LOCKED):**
- `app/types/change-incident.ts` — `ChangeRequestStatus` +6 nilai, `ChangeRequestType` baru, `ChangeRequest.changeType`/`cancellationFeeIdr`/`cancelReason` baru (opsional), `ChangeRequestDraft`/`ChangeRequestComment`/`ChangeRequestAttachment` baru.
- `app/types/document-comms.ts` — `Document.supersedesId`/`verified`/`verifiedBy`/`verifiedAt` baru (opsional), `DocumentComment`/`ClientDocumentCategory` baru.
- `app/types/project.ts` — `Project.tourLeaderName/Phone`/`emergencyContactName/Phone`/`meetingPoint` baru, `ItineraryItem.location` baru (seluruhnya opsional).
- `app/types/trip-center.ts` — file baru, `TripAnnouncement`.
- `app/data/change-incident.ts` — `CHANGE_REQUEST_DRAFTS`/`CHANGE_REQUEST_COMMENTS`/`CHANGE_REQUEST_ATTACHMENTS` baru (kosong); seed `PRJ-201..204` diperluas field Trip Center baru (tour leader/emergency contact/meeting point) + 2 `ITINERARY_ITEMS` PRJ-202 diberi `location`.
- `app/data/document-comms.ts` — `DOCUMENT_COMMENTS` baru (kosong); 3 dokumen client-visible baru untuk PTY-005 (`DOC-C017..019`, mendemokan version history + verification); `DOC-C012` ditandai `verified: true`.
- `app/data/trip-center.ts` — file baru, `TRIP_ANNOUNCEMENTS` (2 seed: PRJ-202 wajib konfirmasi belum dikonfirmasi, PRJ-201 informasional).
- `app/data/index.ts` — ~35 fungsi baru (selector+mutator) untuk Trip Center/Change Requests/Documents, lihat komentar section "Client Experience — Execution & Changes (Repair Phase Section 5)" di file tsb; `CHANGE_REQUEST_TRANSITIONS` diperluas aditif.
- `app/constants/status.ts` — `CHANGE_REQUEST_STATUSES` +6 entri, `CHANGE_REQUEST_TYPES` baru, `CLIENT_DOCUMENT_CATEGORIES` baru.

**Files:** types 3 file diedit + 1 baru, data 3 file diedit + 1 baru, constants 1 file diedit, `navigation.ts` diedit, pages 5 baru + 1 diperluas (project-orders), docs 3 file diupdate.

**Test:**
- lint: 0 error, 19 warning (pre-existing, tidak berkaitan dengan perubahan Section 5)
- typecheck: 0 error
- test: 91/91 lulus (6 file test, tidak ada regresi)
- build: sukses (`nuxt build` — client + server compile tanpa error, chunk `trip-center-*` terkonfirmasi ter-generate)

**Known issues:**
- Kategori Document client-facing (5 bucket Master Prompt) untuk dokumen INTERNAL lama (seed sebelum Section 5) derivasi murni dari `entityType` (fallback `closing` untuk `project`/`party`/`vendor`) — cukup akurat untuk seed existing, tapi bukan jaminan universal untuk entityType yang belum dipetakan eksplisit di `DOCUMENT_ENTITY_TO_CLIENT_CATEGORY`.
- Upload/Replace Version dokumen oleh Client TIDAK men-trigger `ACTIVITIES`/`Notification` (lihat Cross-module integration di atas) — konsisten pola upload internal `/documents` yang juga senyap, bukan regresi.
- "Execution Progress" Change Request menampilkan status 'approved' sebagai state SANGAT transient (langsung dilewati ke `in-execution` dalam satu mutator `approveChangeRequestImpact`) — pilihan desain sadar mengikuti pola auto-cascade Section 3 (Mark as Won), bukan bug; `approvedBy`/`approvedAt` tetap tercatat benar.
- Trip Center "Tour Leader"/"Meeting Point" hanya terisi untuk 4 seed PRJ-201–204 (field baru opsional) — Project lain (PRJ-101–104, dst.) akan tampil "Belum ditugaskan"/"Belum ditentukan", bukan bug (field memang opsional, jujur mencerminkan data yang belum diisi).

**Next section:** Section 6 — Finance & Collaboration.

---

## Section 6 — Finance & Collaboration (Finance & Billing, Messages & Activities, Issues & Support)

**Section:** 6
**Status:** COMPLETED

**Pages:** 7 halaman baru — `/client/billing` (dashboard+list, menggantikan `ModulePlaceholder`) + `/client/billing/invoices/[id]` (detail) + `/client/billing/invoices/[id]/preview` (print, tax invoice/receipt) + `/client/billing/statement` (print, statement of account); `/client/messages` (list, menggantikan shell) + `/client/messages/[projectId]` (detail, tab Messages/Activity Timeline); `/client/support` (list+create, menggantikan shell) + `/client/support/[id]` (detail). Tab "Finance" Project Workspace ditambah link "Buka Finance & Billing lengkap →" (tampilan lama tidak diubah).

**Finance & Billing (Master Prompt bagian A):**
- Finance summary (6 kartu: total nilai project/invoiced/paid/outstanding/overdue/jatuh tempo berikutnya), Invoice list+search+filter status+project, Invoice detail, Payment schedule/history, Download Tax Invoice/Receipt (1 dokumen print mock mencakup keduanya), Upload Payment Proof, Payment reference, Submit payment confirmation, Raise Dispute, Statement of Account (print mock) — seluruhnya berfungsi.
- **Arsitektur "Client tidak boleh menandai Paid sendiri"**: `submitPaymentProof` (mutator Client baru) HANYA mencatat metadata bukti + status `waiting-verification`, TIDAK PERNAH memanggil `recordPayment` (LOCKED, Section 20). `runPaymentVerificationMock` (mock "tim Finance", memanggil `recordPayment` apa adanya) adalah SATU-SATUNYA jalur ke `paid`/`partially-paid` — dipicu LAZY (`onMounted` halaman Billing/invoice detail), bukan cascade instan, agar status `waiting-verification` benar-benar sempat terlihat Client (beda pendekatan dari Section 3/5 yang cascade instan, karena "Waiting Verification" eksplisit diminta sebagai status Master Prompt, bukan sekadar step transien).
- `InvoiceStatus` diperluas ADITIF 2 nilai (`waiting-verification`/`disputed`) — 4 nilai lama (LOCKED, Section 20) tidak berubah makna; 6 nilai Master Prompt lain (Draft/Issued/Viewed/Overdue/Cancelled/Refunded) SENGAJA derivasi (`viewedAt` baru, `isInvoiceOverdue` existing, `status: 'void'` existing) bukan status tersimpan kedua.
- `raiseInvoiceDispute` (baru) — alasan wajib, tidak bisa untuk invoice `paid`/`void`.
- `getClientFinanceSummary` (baru) — agregasi murni di atas `getInvoiceOutstandingIdr`/`isInvoiceOverdue` existing, TIDAK ada angka tersimpan paralel.

**Messages & Activities (Master Prompt bagian 13):**
- Conversation per project (`Message`, channel `client-message`, reuse `sendMessage` Section 21 LOCKED), Reply, Mention mock (reuse hook notifikasi existing), Attachment mock (`Message.attachmentName` baru), Search, Unread state (`Message.readBy` baru + `markProjectMessagesRead`/`getUnreadProjectMessageCount`), Client-visible activity timeline (`getUnifiedActivityTimeline`, Section 21 LOCKED, sudah menggerbangi `internalOnly`).
- **Keputusan desain:** "Quotation/Itinerary/Change Request conversation" TIDAK diimplementasikan sebagai channel `Message` kedua — masing-masing SUDAH punya comment thread dedicated (`QuotationComment`/`ItineraryComment`/`ChangeRequestComment`, Section 3/4/5). Halaman `/client/messages/[projectId]` menyediakan link langsung ke ketiganya ("Percakapan Terkait"), menghormati satu source of truth per entitas — konsisten preseden section-section sebelumnya yang juga memilih entitas comment dedicated alih-alih memakai `Message` generik untuk domain yang sama.
- "Pisahkan message dan system activity" terpenuhi via tab terpisah; "Internal Manova messages hidden" terjamin (`channel !== 'internal-note'` difilter di seluruh selector Client-facing baru).

**Issues & Support (Master Prompt bagian 14):**
- Ticket list+search+filter kategori/status, Create ticket (`createSupportTicket`, auto-assign PIC deterministik per kategori — `SUPPORT_CATEGORY_PIC`), Detail, Reply (`replySupportTicket`, auto `waiting-for-client`→`in-progress` saat Client membalas), Attachment mock, Priority, SLA (`getSupportTicketSlaDueDate`/`isSupportTicketSlaBreached`, deterministik per priority: urgent H+1, high H+2, medium H+3, low H+5), Assigned Manova PIC, Resolution, Confirm Resolution (`confirmSupportTicketResolution`), Reopen (`reopenSupportTicket`, alasan wajib, dicatat sebagai reply — bukan field kedua), Rating (`rateSupportTicketResolution`, 1-5).
- Emergency ticket ditandai visual menonjol (banner merah + border list item) sesuai Wajib eksplisit.
- Seed 3 `SupportTicket` demo (`TCK-001` in-progress, `TCK-002` resolved — mendemokan Confirm/Reopen/Rating, `TCK-003` open/emergency/belum ditriase).

**Cross-module integration:**
- Invoice issued → Notification: TIDAK ditambahkan trigger baru pada `createInvoice` (di luar scope Client, invoice diterbitkan internal) — Notification SUDAH ada sejak Section 2 untuk invoice near-due/overdue (`isInvoiceDueSoon`/`isInvoiceOverdue`). Client uploads proof → Activity+Notification → Waiting Verification → Mock verification (lazy) → Paid/Partially Paid → Dashboard (`getClientFinanceSummary`) dan Project Billing (tab Finance) ter-update reactive — SUDAH bekerja penuh.
- Support ticket created → Activity (bila `projectId` terisi) → Notification (ke assigned PIC) — SUDAH bekerja. "Project issue count"/"Dashboard open issue count" TIDAK ditambahkan sebagai widget baru di Dashboard (`/client`, Section 2, LOCKED) — di luar scope "kerjakan hanya section ini", dicatat sebagai Known Issue.
- Comments pada quotation/itinerary/change request → activity timeline terkait: SUDAH bekerja lewat entitas dedicated masing-masing (lihat keputusan desain Messages & Activities di atas) — TIDAK melalui `getUnifiedActivityTimeline` project-level (yang hanya mencakup `entityType: 'project'`).

**Data layer (aditif, tidak ada breaking change ke tipe/mutator LOCKED):**
- `app/types/finance.ts` — `InvoiceStatus` +2 nilai, `Invoice.viewedAt`/`paymentProof*`/`dispute*` baru (seluruhnya opsional).
- `app/types/document-comms.ts` — `Message.readBy`/`attachmentName` baru (opsional).
- `app/types/support.ts` — `SupportTicket.attachmentName`, `SupportTicketReply.attachmentName` baru (opsional).
- `app/data/support-tickets.ts` — 3 `SupportTicket`+3 `SupportTicketReply` seed baru (sebelumnya kosong).
- `app/data/document-comms.ts` — 3 `Message` baru (PRJ-202, mendemokan unread state).
- `app/data/index.ts` — ~25 fungsi baru (selector+mutator) untuk Finance/Messages/Support, lihat komentar section "Client Experience — Finance & Collaboration (Repair Phase Section 6)"; `sendMessage` diperluas aditif (`attachmentName`/`readBy`).
- `app/constants/status.ts` — `INVOICE_STATUSES` +2 entri, `SUPPORT_TICKET_CATEGORIES`/`SUPPORT_TICKET_PRIORITIES`/`SUPPORT_TICKET_STATUSES` baru.

**Files:** types 3 file diedit, data 3 file diedit, constants 1 file diedit, `navigation.ts` diedit, pages 7 baru + 1 diperluas (project-orders tab Finance), docs 3 file diupdate.

**Test:**
- lint: 0 error, 19 warning (pre-existing, tidak berkaitan dengan perubahan Section 6)
- typecheck: 0 error
- test: 91/91 lulus (6 file test, tidak ada regresi)
- build: sukses (`nuxt build` — client + server compile tanpa error, chunk `support-*`/`trip-center-*`/`statement-*` terkonfirmasi ter-generate)

**Known issues:**
- Dashboard (`/client`, Section 2, LOCKED) belum menampilkan "open issue count"/agregasi Support Ticket sebagai widget baru — di luar scope "kerjakan hanya section ini" (Section 6 fokus 3 halaman Finance/Messages/Support, bukan mengubah Dashboard Section 2).
- "Approval activity" (1 dari 4 kategori Wajib "Pisahkan" Messages & Activities) tidak punya `kind` terpisah di `UnifiedTimelineEntry` (Section 21, LOCKED — hanya activity/system-event/message/document) — approval activity secara konten sudah tercakup `kind: 'activity'`, hanya tidak bisa difilter terpisah dari activity generik lain.
- Tidak ada trigger "resolve" otomatis untuk Support Ticket baru yang dibuat live selama demo (resolusi genuine membutuhkan investigasi, bukan mock instan) — Client hanya bisa mendemokan Confirm/Reopen/Rating lewat 1 tiket seed yang sudah `resolved` (`TCK-002`), jujur bukan menutupi gap dengan fake automation.
- Tax Invoice dan Receipt SENGAJA digabung jadi satu dokumen print mock (bukan 2 route terpisah) — simplifikasi sadar, didokumentasikan di komentar kode.

**Next section:** Section 7 — Insights & Company.

---

## Section 7 — Insights & Company (Reports & Analytics, Feedback & Evaluation, Company Profile)

**Section:** 7
**Status:** COMPLETED — **seluruh 18 halaman Master Prompt bagian E kini Existing & Complete.**

**Pages:** 5 halaman baru — `/client/reports` (menggantikan `ModulePlaceholder`); `/client/feedback` (list, menggantikan shell) + `/client/feedback/[projectId]` (form, baru); `/client/company-profile` (menggantikan shell). `navigation.ts` — `comingSoon: true` dihapus dari 3 item terakhir (Reports & Analytics/Feedback & Evaluation/Company Profile); tidak ada lagi route Client dengan `comingSoon: true`.

**Reports & Analytics (Master Prompt bagian 16):**
- 10 stat card + Spending by Month/Change Request Frequency (`SimpleBarChart`, komponen baru — Chart.js/vue-chartjs diekstrak dari `BudgetChart.vue` Dashboard, pola registrasi identik) + Spending by Destination/Service, Trips by Status, Issue Category, Payment Status (`StatusBreakdownList`, existing) + Participant Trend.
- Filter Date range/Project/Destination/Service/Status Project — satu set filter diterapkan ke seluruh laporan via `getClientReportSummary` (baru, `app/data/index.ts`), agregasi murni di atas `getInvoiceOutstandingIdr`/`getTravelers`/`getPaymentsByInvoice`/`getChangeRequestsByProject`/`getSupportTicketsByParty`/`getFeedbackByProject` (seluruhnya existing) — TIDAK ADA dataset laporan paralel ("Report derived from real mock state").
- Export Excel/PDF mock (toast, pola sama `/reports` internal) + Print view (`window.print()`, `print:hidden` pada filter/actions).
- Known limitation (jujur, bukan bug): "Participant Trend" pendekatan per-project (bukan tren bulanan sungguhan, `Traveler` tidak punya timestamp pendaftaran individual); "Spending by Service" estimasi (nilai project dibagi rata `serviceScope.length`, tidak ada breakdown biaya per-service client-safe).

**Feedback & Evaluation (Master Prompt bagian 17):**
- List (status per Project Order) + Form (12 dimensi rating via `RatingInput.vue` baru — komponen star generik, diekstrak karena 12 field identik dalam satu form) + Recommendation Score + Comment + Improvement Suggestion + Testimonial Consent, Save Draft/Submit, validasi (`overallExperience`+`recommendationScore` wajib), unsaved-changes warning (`onBeforeRouteLeave`, pola sama `TravelRequestForm`), read-only otomatis setelah submit. Rating tunggal Support Ticket (Section 6, dibangun sebelum `RatingInput.vue` ada) TIDAK diubah ke komponen baru ini — di luar scope "jangan mengubah yang tidak berkaitan".
- **Integrasi closing progress**: `submitFeedback` → `ACTIVITIES` (Activity created) → `pushNotification` ke PM (Notification created) → `markProjectFeedbackCollected` (Project closing progress updated) — HANYA menulis `ProjectClosureChecklist.feedbackCollected`, TIDAK PERNAH menyentuh field checklist lain atau logic `evaluateProjectClosureGate` (LOCKED, Section 24 — bahkan tidak memeriksa field ini sebagai blocker, murni indikator progress, bukan gate).
- Known limitation (jujur): "Acknowledged"/"Follow-up Required" (keputusan internal) tidak punya trigger di section ini (Client-only scope) — tidak ada seed demo status tsb, dibanding didemokan lewat fake automation.

**Company Profile (Master Prompt bagian 18):**
- View/Edit/Save/Cancel/unsaved-changes-warning (pola sama Feedback form), Logo upload mock, Legal document upload mock (reuse `Document`/`getClientDocuments` Section 5, `entityType: 'party'`, TIDAK ada entitas dokumen kedua), Billing data, Tax data, Contacts (CRUD penuh — `updateContact`/`deleteContact` baru melengkapi `createContact` existing sejak Prompt 19), Travel Preferences, Change History (reuse `PartyActivity` existing via `getCompanyProfileChangeHistory`, disaring pesan terkait — bukan audit trail kedua), Verification state for sensitive changes.
- **Field sensitif** (registrationNumber/npwp/billingName/billingAddress/paymentTerm): `submitSensitiveCompanyProfileChange` menyimpan ke `Party.pendingProfileChange` (badge "Menunggu Verifikasi" tampil), `runCompanyProfileVerificationMock` (lazy, `onMounted`, pola sama `runPaymentVerificationMock` Section 6) menerapkannya di kunjungan berikutnya — nilai lama tetap berlaku sampai "terverifikasi".
- "Main/Finance/Emergency contact" (Master Prompt) DIWUJUDKAN sebagai role bebas pada `ContactPerson.title` existing — keputusan desain sadar, menghindari 3 field structured baru yang menduplikasi konsep "kontak" yang sudah ada.
- "Tidak ada Users & Access" — dipatuhi, tidak ada satu pun halaman/section user management ditambahkan.

**Cross-module integration:**
- Feedback submitted → Activity + Notification + Project closing progress updated — SUDAH bekerja penuh (lihat detail di atas).
- Company Profile sensitive change → Activity (Change History) + Notification ke `accountOwnerId` + status "Menunggu Verifikasi" → mock verification (lazy) → Activity + Notification konfirmasi — SUDAH bekerja penuh.
- Reports & Analytics reactive terhadap seluruh entitas Section 1-6 (Project/Invoice/Traveler/ChangeRequest/SupportTicket/Feedback) tanpa sinkronisasi manual — nilai laporan otomatis berubah begitu entitas sumber berubah (mis. feedback baru langsung mempengaruhi kartu "Satisfaction").

**Data layer (aditif, tidak ada breaking change ke tipe/mutator LOCKED):**
- `app/types/party.ts` — `Party` +18 field baru (seluruhnya opsional): logo/companyType/address/province/country/postalCode/website/email/preferredCurrency/poRequired/travelPreferences/registrationNumber/npwp/billingName/billingAddress/paymentTerm/pendingProfileChange*3. `CompanyType`/`SensitiveCompanyProfileFields` baru.
- `app/types/finance.ts` — tidak diubah lagi di section ini (perluasan `InvoiceStatus` sudah selesai Section 6); `InvoiceCurrency` di-reuse sebagai `Party.preferredCurrency`.
- `app/data/parties.ts` — PTY-005 diperluas field Company Profile lengkap + 1 `pendingProfileChange` demo (billing address, mendemokan "Menunggu Verifikasi").
- `app/data/index.ts` — ~20 fungsi baru (Feedback: `saveFeedbackDraft`/`submitFeedback`/`markProjectFeedbackCollected`; Company Profile: `updateCompanyProfile`/`submitSensitiveCompanyProfileChange`/`runCompanyProfileVerificationMock`/`getCompanyProfileChangeHistory`/`updateContact`/`deleteContact`/`createCompanyDocument`; Reports: `getClientReportSummary`+helper), lihat komentar section "Client Experience — Insights & Company (Repair Phase Section 7)".
- `app/constants/status.ts` — `FEEDBACK_STATUSES`/`COMPANY_TYPES` baru.
- Komponen baru: `app/components/shared/SimpleBarChart.vue`, `app/components/shared/RatingInput.vue`.

**Files:** types 1 file diedit, data 2 file diedit, constants 1 file diedit, `navigation.ts` diedit, components 2 baru, pages 5 baru, docs 2 file diupdate.

**Test:**
- lint: 0 error, 19 warning (pre-existing, tidak berkaitan dengan perubahan Section 7)
- typecheck: 0 error
- test: 91/91 lulus (6 file test, tidak ada regresi)
- build: sukses (`nuxt build` — client + server compile tanpa error, chunk `reports-*`/`feedback-*`/`company-profile-*` terkonfirmasi ter-generate)

**Known issues:**
- Feedback "Acknowledged"/"Follow-up Required" tidak punya trigger internal di section ini (di luar scope Client-only) — tidak dipaksakan lewat fake automation, dicatat jujur.
- Reports "Participant Trend" adalah pendekatan per-project (bukan tren bulanan sungguhan) dan "Spending by Service" adalah estimasi merata — keduanya keterbatasan data model yang jujur, bukan bug.
- Company Profile "Main/Finance/Emergency contact" diwujudkan lewat `ContactPerson.title` bebas teks, bukan 3 field structured terpisah — keputusan desain, didokumentasikan di kode.

**Next section:** Section 8 — Integration, QA, Regression, and Final Documentation.

---

## Section 8 — Integration, QA, Regression, and Final Documentation

**Section:** 8
**Status:** COMPLETED — **QA/regression pass murni, tidak ada halaman baru** (sesuai larangan eksplisit `PROMPT-SECTION-8.md`: "Jangan menambah fitur besar baru kecuali diperlukan untuk menutup workflow yang terputus").

**Metodologi:** 4 agent audit paralel (read-only, independen satu sama lain) dijalankan atas seluruh codebase `app/pages/client/**`/`app/components/client/**`/`app/data/index.ts`: (1) audit UX 18 halaman terhadap 15 kriteria (route/nav/breadcrumb/loading/empty/error/form validation/confirmation/toast/responsive/broken link/dead button/incorrect status/inconsistent data/accessibility); (2) trace kode 6 flow wajib (Master Prompt bagian H) dari trigger sampai state akhir, evidence file:line; (3) audit keamanan data (grep field internal + verifikasi selector sanitasi + isolasi `clientScopeId`); (4) audit regresi role lain (`git diff` scoped ke file shared) + code quality (duplikasi/dead code/business logic in page/enum consistency/non-deterministic mock data). Baseline lint/typecheck/test/build dijalankan sebelum DAN sesudah perbaikan diterapkan (bukan diklaim dari satu run saja).

**Pages:** Tidak ada halaman baru. 6 halaman existing diperbaiki (lihat "Fixes Applied").

**Routes:** Tidak ada route baru/dihapus. Diverifikasi seluruh 18 route + 4 route lama (`/client`, `/client/opportunities/[id]`, `/client/project-orders/[id]`, `/client/catalog/[requirementId]`) valid dan tidak saling menimpa (`docs/client-information-architecture.md` bagian 7).

**Components:** Tidak ada component baru. `Dialog` konfirmasi ditambahkan inline di `company-profile/index.vue` (pola existing, bukan component baru).

**Mock data:** Tidak ada mock data baru/skenario baru ditambahkan (`docs/client-mock-data-scenarios.md` — Update Section 8 murni verifikasi ulang skenario existing, tidak ada record baru).

**Services/store:** Tidak ada fungsi baru di `app/data/index.ts` pada section ini — seluruh perbaikan adalah edit template/script di layer halaman (page-level), sesuai sifat QA/bugfix (bukan fitur baru yang butuh selector/mutator baru).

**Workflow — 6 flow wajib diverifikasi ulang via trace kode (bukan asumsi laporan section sebelumnya):**
- **Flow 1 (Travel Request → Project): CONNECTED**, dengan 1 bug ditemukan+diperbaiki (lihat Fixes Applied #1).
- **Flow 2 (Participant Readiness): PARTIALLY CONNECTED** — readiness reactive penuh di Dashboard/Projects list, tapi tab Participants Project Workspace tidak menampilkan bar `getClientProjectReadiness.overallPercent` yang sama (hanya tabel dokumen mentah) — gap kosmetik, dicatat sebagai known issue, tidak diperbaiki (di luar scope bugfix, bukan workflow terputus).
- **Flow 3 (Itinerary Approval): CONNECTED** penuh, tidak ada gap.
- **Flow 4 (Invoice → Payment): CONNECTED**, dengan catatan cakupan: `runPaymentVerificationMock` hanya dipicu lazy di halaman Billing list/invoice detail, TIDAK di tab Billing Project Workspace — bila kunjungan Client hanya lewat tab tsb, verifikasi tidak ter-trigger dari sana (tapi begitu ter-trigger dari halaman manapun, seluruh view konsisten reactive). Dicatat sebagai known issue kecil, tidak diperbaiki (workaround: tab tsb sudah punya link "Buka Finance & Billing lengkap →").
- **Flow 5 (Change Request): PARTIALLY CONNECTED** — status/notifikasi/activity log bekerja penuh, tapi "Related project data updated" belum ada linkage mekanis ke Traveler/ItineraryVersion/Reservation (lihat Known Issues). CRITICAL: ditemukan kebocoran data internal pada halaman ini, diperbaiki (lihat Fixes Applied #3).
- **Flow 6 (Trip Center → Closing): PARTIALLY CONNECTED** — seluruh langkah bekerja KECUALI "Create Issue" yang sebelumnya kehilangan konteks project (diperbaiki, lihat Fixes Applied #6).

**Security/Data Visibility:** 1 temuan **CRITICAL** — `app/pages/client/change-requests/[id]/index.vue` merender `commercialImpactIdr`/`cancellationFeeIdr`/`operationalImpact` mentah pada bagian "Impact Review", bertentangan dengan komentar tipe field itu sendiri ("internal-only, TIDAK boleh terlihat Client") dan berbeda dari pola sanitasi yang sudah benar di halaman sejenis (`approvals/[id]/index.vue`). **Diperbaiki** — kini hanya pernyataan kualitatif + `timelineImpactNote`. Selain itu: TIDAK ditemukan kebocoran lain — internal-note message filtering, reservation cost sanitization (`getClientReservations`), itinerary visibility filtering (`getClientVisibleItineraryItems`), quotation cost/margin exclusion, dan cross-tenant party scoping pada seluruh 39 file halaman Client seluruhnya terverifikasi BENAR (dibaca langsung, bukan dipercaya dari klaim section sebelumnya). Detail lengkap: `docs/client-role-scope.md` bagian 6.

**Regression (role lain):** TIDAK ADA blocker/major ditemukan. `nuxt.config.ts` hanya menambah 1 entri component path (sesuai catatan Section 3). `app/constants/navigation.ts` — nav Client diganti struktur (bukan diedit di tempat) tapi TIDAK ADA nav item non-client yang terhapus/berubah. `app/constants/status.ts`/type union (`InvoiceStatus`/`ChangeRequestStatus`) — seluruh nilai lama dipertahankan, hanya nilai baru ditambahkan. `CHANGE_REQUEST_TRANSITIONS` — 3 transisi lama tetap resolve ke target yang sama, hanya opsi baru ditambahkan. Satu catatan minor (bukan blocker): `sendMessage()` kini selalu mengisi `Message.readBy` dengan pengirim (field baru, tidak ada konsumen existing yang mengasumsikan field ini selalu kosong).

**Code quality:** TIDAK ADA blocker/major. Tidak ada duplicate component/type/mock state, tidak ada dead code/unused export, tidak ada `console.log`/`debugger` tersisa, tidak ada broken import, tidak ada `Math.random()`/`Date.now()`/`new Date()` non-deterministik di kode Client. Satu catatan minor: agregasi bisnis di `app/pages/client/index.vue` (Dashboard) cukup berat langsung di `<script setup>` — konsisten dengan pola existing codebase-wide (`app/pages/index.vue`, `app/pages/finance/index.vue`, dll.), bukan anti-pattern baru yang diperkenalkan Client role.

**Fixes Applied (6 bug + beberapa perbaikan minor, seluruhnya scoped — tidak ada refactor besar):**
1. **Dashboard** (`app/pages/client/index.vue`) — dialog "Ajukan Travel Request" lama memanggil `createLead` langsung, TIDAK PERNAH membuat entitas `TravelRequest` — submission "hilang" diam-diam (tidak muncul di `/client/travel-requests`). Dihapus, kedua entry point (tombol header + Quick Action) diarahkan ke `/client/travel-requests/new` (jalur yang benar, sudah ada sejak Section 3).
2. **Notifications** (`app/pages/client/notifications/index.vue`) — `notificationRoute()` tidak memetakan `entityType: 'travel-request'`/`'quotation'` (dead click, notifikasi jenis ini benar-benar dikirim sejak Section 3 tapi tidak bisa dibuka). Ditambahkan pemetaan ke `/client/travel-requests/:id` dan `/client/quotations/:id`.
3. **Change Requests detail** (`app/pages/client/change-requests/[id]/index.vue`) — CRITICAL security fix, lihat "Security/Data Visibility" di atas.
4. **Company Profile** (`app/pages/client/company-profile/index.vue`) — "Delete Contact" tanpa dialog konfirmasi (satu-satunya aksi destruktif di 18 halaman tanpa konfirmasi). Ditambahkan dialog konfirmasi pola existing.
5. **Messages** (`app/pages/client/messages/[projectId]/index.vue`) — kirim pesan tanpa toast sukses (aksi utama halaman, satu-satunya tanpa feedback). Ditambahkan toast "Pesan Terkirim".
6. **Trip Center** (`app/pages/client/trip-center/[projectId]/index.vue` + `app/pages/client/support/index.vue`) — "Create Issue" kehilangan konteks project (`router.push('/client/support')` tanpa parameter). Kini mengirim `?project=<id>`, dibaca `onMounted` di halaman Support untuk langsung membuka form dengan project terisi.

**Perbaikan minor tambahan:** 3 tabel Project Workspace (`app/pages/client/project-orders/[id]/index.vue`, tab Participants/Billing/Kebutuhan Komoditas) dibungkus `overflow-x-auto` (konsistensi responsif, sebelumnya bisa overflow horizontal di mobile); 5 aksi submit comment/reply tanpa toast (Quotations/Itineraries/Change Requests/Documents comment, Support ticket reply) ditambahkan toast sukses; beberapa `aria-label` ditambahkan pada tombol icon-only (star rating, Edit/Delete Contact, filter kategori Notifications).

**Test result (dijalankan ULANG setelah seluruh perbaikan di atas, bukan hanya sebelum):**
- lint: 0 error, 19 warning (pre-existing, tidak berkaitan dengan perubahan Section 8) — 1 error sempat muncul mid-fix (`currentUser` unused setelah dialog Dashboard dihapus), langsung diperbaiki dan diverifikasi ulang 0 error.
- typecheck: 0 error (full project, `vue-tsc --noEmit`)
- unit test: 91/91 lulus (6 file test, tidak ada regresi)
- build: sukses (`nuxt build` — client + server compile tanpa error)

**Known issues (didokumentasikan jujur, bukan diperbaiki — di luar scope "jangan menambah fitur besar baru"):**
- Change Request approved TIDAK memutasi Traveler/ItineraryVersion/Reservation terkait secara mekanis (Flow 5) — hanya notifikasi+activity log. Membangun linkage otomatis untuk 13 `ChangeRequestType` berbeda adalah fitur besar baru, bukan perbaikan bug.
- Tab Participants Project Workspace tidak menampilkan readiness bar terpadu yang sama dengan Dashboard (Flow 2) — gap kosmetik/konsistensi, bukan data salah.
- `runPaymentVerificationMock` tidak dipicu dari tab Billing Project Workspace (Flow 4) — hanya dari halaman Billing/invoice detail (yang selalu reachable via link "Buka Finance & Billing lengkap →").
- Beberapa inkonsistensi kosmetik pola tabel (`<Table>` vs `<ul>` list) di Projects/Documents dibanding halaman client lain — berfungsi normal, hanya beda gaya visual, tidak diseragamkan (risiko regresi visual > manfaat, di luar scope QA fungsional).
- Seluruh known limitation dari Section 1–7 yang sudah didokumentasikan sebelumnya (lihat entri masing-masing di atas) TETAP BERLAKU — tidak ada yang diselesaikan atau digugurkan tanpa dasar oleh Section 8.

**Documentation:** Seluruh 6 dokumen wajib (`docs/client-role-scope.md`, `docs/client-information-architecture.md`, `docs/client-business-flow.md`, `docs/client-page-inventory.md`, `docs/client-mock-data-scenarios.md`, `docs/client-progress.md` — file ini) diperbarui secara ADITIF (entri lama tidak dihapus) dengan hasil audit dan perbaikan Section 8.

**Definition of Done (`PROMPT-SECTION-8.md`) — verifikasi akhir:**
- Satu role CLIENT, tidak ada sub-role — ✅ tidak berubah sejak Section 0.
- 18 halaman tersedia, semua route valid, navigation bekerja — ✅ diverifikasi ulang, 0 route orphan/rusak.
- Main actions bekerja — ✅, 6 dead-button/broken-feedback diperbaiki.
- Mock data saling terhubung — ✅, tidak ada perubahan pada data.
- Travel Request → Quotation → Project, Participant → readiness, Itinerary versioning, Reservation monitoring, Payment flow, Trip Center context-aware, Support flow, Feedback → closing, Project Closed — ✅ seluruhnya CONNECTED (2 PARTIALLY CONNECTED dengan known limitation jujur: Change Request→related-data, readiness bar Participants tab — lihat di atas).
- Tidak ada data internal bocor — ✅ setelah perbaikan CRITICAL Change Requests (sebelum perbaikan, ADA kebocoran — kini tidak).
- Role lain tidak rusak — ✅ regresi audit clean, tidak ada blocker/major.
- Lint/typecheck/test/build selesai — ✅ seluruhnya 0 error setelah perbaikan.
- Docs final diperbarui — ✅ 6 dokumen wajib.

**Next section:** Tidak ada — Section 8 adalah section terakhir roadmap `prompts/repair_phases/`. Inisiatif "18-Page Client Experience" (Section 0–8) selesai. Pengerjaan lanjutan (menutup known limitation Flow 2/4/5 di atas, atau fitur baru) membutuhkan perintah/prompt baru dari user, sesuai larangan eksplisit "jangan lanjut ke section berikutnya tanpa perintah baru".
