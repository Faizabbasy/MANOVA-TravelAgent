# Client Business Flow — Kondisi Aktual vs 6 Flow Wajib

Dibuat oleh **Repair Phase / Section 0 — Audit dan Gap Analysis**. Untuk masing-masing dari 6 flow wajib (Master Prompt bagian H), dokumen ini mencatat mekanisme yang SUDAH bekerja hari ini vs. bagian yang BELUM ada — bukan rencana implementasi.

## Flow 1 — Travel Request ke Project

```
Client creates Travel Request → Submitted → Mock Sales Review → Quotation created
→ Client reviews → Client approves → Mock Opportunity Won → Project created
→ Dashboard and Projects updated
```

**STATUS: Sudah bekerja penuh (Repair Phase Section 3 — Request & Commercial).** `TravelRequest` kini entitas nyata dengan status sendiri (`draft/submitted/under-review/need-clarification/proposal-preparation/converted-to-opportunity/cancelled`), dibuat/diedit/disubmit lewat `/client/travel-requests/**`. Begitu disubmit, `runTravelRequestMockReview` (internal, `app/data/index.ts`) meng-cascade OTOMATIS lewat pipeline internal existing yang SUDAH diverifikasi (lihat `docs/frontend-workflow-map.md` langkah 1–12) — `createLead`+`updateLeadQualification`(source `client-portal`)→`qualifyLeadAndCreateOpportunity`→`createQuotation`→`submitQuotationForApproval`→`approveQuotation` (auto-approved, mock Management) — TIDAK SATU PUN fungsi pipeline ini diubah, section 3 murni memanggilnya berurutan. "Client reviews → Client approves" terjadi di `/client/quotations/[id]` (Approve Quotation), yang lalu meng-cascade `recordClientConfirmation`→`advanceOpportunityStage('won-requested')`→`approveOpportunityWon` (pola sama "Mark as Won" internal, D-053) — Project otomatis dibuat, Dashboard (Section 2, derivasi `getProjectsByParty`) dan Project List ter-update otomatis (reactive, tidak perlu sinkronisasi manual).

**Deterministik, bukan selalu langsung Won:** `getTravelRequestReviewGate` (field wajib: tanggal/estimasi peserta/estimasi budget/detail per service scope) menentukan apakah mock review langsung ke Proposal Preparation atau berhenti di `need-clarification` (Client harus "Respond to Clarification" dulu) — lihat skenario demo `TR-001` (Bali MICE, `docs/client-mock-data-scenarios.md` Skenario D) yang sengaja berhenti di `need-clarification`.

**Update Section 8 (perbaikan, bukan lagi hidup berdampingan):** Dialog "Ajukan Travel Request" lama di `/client` (memanggil `createLead`+`updateLeadQualification` langsung, TIDAK PERNAH membuat `TravelRequest`) ternyata bukan sekadar jalur alternatif jujur — ia adalah workflow yang TERPUTUS: judul tombol identik ("Ajukan Travel Request"/"Create Travel Request") dengan halaman `/client/travel-requests/new` yang benar, tapi hasil submit dialog lama tidak pernah muncul di `/client/travel-requests` (list hanya membaca `TRAVEL_REQUESTS`, bukan `LEADS`) — Client yang memakainya akan mengira submit gagal/hilang. Section 8 MENUTUP workflow terputus ini (diizinkan eksplisit oleh `PROMPT-SECTION-8.md`: "kecuali diperlukan untuk menutup workflow yang terputus") dengan menghapus dialog duplikat tsb dan mengarahkan kedua entry point (tombol header + Quick Action) ke `/client/travel-requests/new` — SATU jalur pembuatan Travel Request, bukan dua.

## Flow 2 — Participant Readiness

```
Project created → Client adds participants → Completion calculated → Participant submitted
→ Mock Operation verification → Reservation status updated → Dashboard readiness updated
```

**STATUS: Sudah bekerja hampir penuh (Repair Phase Section 4 — Core Project).** Tab Participants (dulu Travelers) `/client/project-orders/[id]` + `/client/participants/**` — CRUD traveler, completeness derivasi (`isTravelerDocumentMissing`), submission. "Completion calculated → Project readiness updated → Dashboard updated" penuh bekerja: `getClientProjectReadiness` (Section 2, diperluas Section 4) reactive terhadap perubahan `TRAVELERS` — Dashboard (`/client`) langsung ter-update tanpa sinkronisasi manual.

**Belum ada:** "Mock Operation verification → Reservation status updated" — TIDAK ada linkage mekanis antara `toggleTravelerVerification` (per-traveler) dan status booking individual (`FlightBooking` dkk. hanya punya `travelerIds` agregat, bukan status per-traveler) — dicatat jujur sebagai keterbatasan data model existing, bukan dipaksakan lewat trigger palsu. "Reservation status updated" sendiri kini SUDAH dapat diverifikasi (`/client/reservations`, Section 4) — hanya link kausal spesifik dari verifikasi ke reservasi yang belum ada.

## Flow 3 — Itinerary Approval

```
Itinerary published → Approval created → Client reviews → Revision requested
→ New version created → Client approves → Project readiness updated
```

**STATUS: Sudah bekerja penuh (Repair Phase Section 4 — Core Project).** `/client/itineraries/[projectId]` — Approve/Request Revision/Comment/Version History/Compare Versions seluruhnya berfungsi. `requestItineraryRevision` (LOCKED aturan: "setiap revision menghasilkan versi baru") membuat `ItineraryVersion` baru, TIDAK PERNAH menimpa versi lama. `getClientProjectReadiness` kini memasukkan dimensi `itineraryPercent` (baru Section 4) — "Client approves → Project readiness updated" reactive sama seperti Flow 2.

**Known limitation:** konten harian (isi hari-per-hari) tetap wewenang AE/Ops — versi hasil revisi Client menyalin item yang sama (mock, konten tidak berubah otomatis), dicatat jujur di kode dan `docs/client-page-inventory.md` #8.

## Flow 4 — Billing

```
Invoice issued → Notification created → Client opens invoice → Client uploads payment proof
→ Waiting Verification → Mock verification → Paid / Partially Paid → Dashboard and Project Billing updated
```

**STATUS: Sudah bekerja penuh (Repair Phase Section 6 — Finance & Collaboration).** `/client/billing/invoices/[id]` — Client membuka invoice (`markInvoiceViewed`) → Upload Payment Proof (`submitPaymentProof`, status → `waiting-verification`, Activity+Notification tercatat) → Mock verification (`runPaymentVerificationMock`, dipicu lazy saat halaman Billing/invoice detail di-mount berikutnya — BUKAN cascade instan, agar status `waiting-verification` benar-benar sempat terlihat Client) → memanggil `recordPayment` (LOCKED, Section 20) apa adanya → `paid`/`partially-paid` → Dashboard (`getClientFinanceSummary`) dan Project Billing (tab Finance Project Workspace, link "Buka Finance & Billing lengkap →") ter-update otomatis (reactive, tanpa sinkronisasi manual). "Client tidak boleh menandai Paid sendiri" terjamin ARSITEKTUR — `submitPaymentProof` TIDAK PERNAH memanggil `recordPayment`, hanya `runPaymentVerificationMock` yang boleh.

**Aditif:** `InvoiceStatus` +2 nilai (`waiting-verification`/`disputed`) — 4 nilai lama (LOCKED) tidak berubah makna. "Raise dispute" (`raiseInvoiceDispute`) dan "View statement" (`/client/billing/statement`, print mock) turut berfungsi penuh.

## Flow 5 — Change Request

```
Client submits change → Mock Manova review → Availability and cost impact created
→ Client approves impact → Change executed → Related project data updated
```

**STATUS: Sudah bekerja penuh, sesuai arah flow (Repair Phase Section 5 — Execution & Changes).** `/client/change-requests` — Client membuat Change Request (Create/Save Draft/Submit lewat `ChangeRequestDraft`, entitas terpisah agar draft belum-submit tidak bocor ke `/changes` internal), begitu submit `submitChangeRequestDraft` memindahkannya menjadi `ChangeRequest` nyata (`createChangeRequest`, LOCKED, `source: 'client'`) lalu langsung memanggil `runChangeRequestMockReview` — cascade deterministik (pola sama `runTravelRequestMockReview` Section 3): `submitted`→`under-review`→`availability-check`→`costing`→`waiting-client-approval` (mengisi `commercialImpactIdr`/`cancellationFeeIdr`/`timelineImpactNote`/`operationalImpact`) ATAU langsung `not-feasible` bila `getChangeRequestReviewGate` menilai tidak feasible (deterministik: tipe yang butuh re-booking dengan keberangkatan ≤H-7). "Client approves impact" = `approveChangeRequestImpact` (`/client/change-requests/[id]`) — cascade langsung ke `in-execution` ("Change executed"). "Related project data updated" via notifikasi ke PM (`project.ownerId`) + `ACTIVITIES` project terkait (dibaca Dashboard Recent Activity, Section 2, reactive tanpa sinkronisasi manual).

**Status flow diperluas ADITIF:** `ChangeRequestStatus` (5 nilai lama, LOCKED) ditambah 6 nilai baru (`availability-check`/`costing`/`waiting-client-approval`/`in-execution`/`cancelled`/`not-feasible`) — internal `/changes`/`/changes/[id]` TIDAK berubah perilakunya (hanya opsi transisi baru ditambahkan pada `CHANGE_REQUEST_TRANSITIONS`, tidak ada yang dihapus/diganti makna).

**Tab "Change Requests" Project Workspace** (dialog cepat lama, `createChangeRequest` langsung tanpa draft) TETAP ADA berdampingan dengan jalur baru, kini dengan tambahan link "Kelola lengkap →" ke `/client/change-requests`.

**Known limitation dikonfirmasi ulang Section 8 (trace kode langsung, bukan asumsi):** "Change executed → Related project data updated" — `approveChangeRequestImpact` HANYA mengubah `status` ChangeRequest sendiri + mencatat `ACTIVITIES`/`Notification`; TIDAK memanggil `createTraveler`/`updateTraveler`/`requestItineraryRevision`/mutator `RESERVATIONS` apa pun. Artinya untuk `changeType` seperti `add-participant`/`change-flight`/`change-hotel`/`change-itinerary`, data terkait (daftar Traveler/Reservation/ItineraryVersion) TIDAK ikut ter-update secara mekanis begitu Change Request disetujui — Client harus tetap melakukan perubahan itu secara manual di halaman masing-masing (Participants/Itineraries/Reservations). Ini adalah keterbatasan genuine, bukan regresi Section 8: membangun linkage otomatis untuk 13 `ChangeRequestType` berbeda ke 3 modul data berbeda adalah fitur besar baru di luar scope QA-only Section 8 ("jangan menambah fitur besar baru kecuali menutup workflow terputus" — ini bukan workflow terputus, hanya belum seotomatis Master Prompt idealkan). "Change executed" (status `in-execution`) dan notifikasi ke PM tetap berfungsi penuh; hanya efek mekanis ke entitas lain yang belum ada.

## Flow 6 — Trip Closing

```
Project Ready → Trip Center active → Issue can be reported → Trip completed
→ Final documents available → Feedback requested → Completion approval → Project Closed
```

**Sudah bekerja:** `Project.status`/`ProjectOrderStatus` state machine (termasuk `completed`/`closed`) sudah ada dan diverifikasi penuh secara internal (`evaluateProjectClosureGate`/`closeProject`, lihat `docs/frontend-workflow-map.md` langkah 22–23). Trip Center (Section 5) — `/client/trip-center` mode Pre-departure/Active/Completed (`getTripCenterMode`) aktif otomatis mengikuti `Project Ready`→`Active`→`Completed`; "Issue can be reported" tersambung ke `/client/support` (Section 6, penuh); "Final documents available" via Important Documents widget. **Feedback (Repair Phase Section 7)** — `/client/feedback/[projectId]` Save Draft/Submit berfungsi penuh, `submitFeedback` menaut ADITIF ke `ProjectClosureChecklist.feedbackCollected` (`markProjectFeedbackCollected`) — "Feedback requested → Project closing progress updated" SUDAH bekerja.

**Belum ada:** "Completion approval" oleh Client — Project Closure tetap murni aksi internal Management/PM/Super Admin, tidak ada langkah approval Client di sisi manapun (tidak diminta eksplisit oleh section manapun `prompts/repair_phases/`, termasuk `PROMPT-SECTION-7.md` — di luar 18 halaman Master Prompt).

## Ringkasan

| Flow | Bagian yang sudah bekerja | Bagian yang belum ada |
|---|---|---|
| 1. Travel Request → Project | **Penuh (Section 3)** — entitas `TravelRequest` sendiri + cascade otomatis ke Lead/Opportunity/Quotation/Won/Project, seluruhnya reachable murni dari aksi Client | — |
| 2. Participant Readiness | **Hampir penuh (Section 4)** — readiness reactive, Reservation kini entitas client-facing (`/client/reservations`) | Link kausal verifikasi→status reservasi per-traveler (keterbatasan data model, dicatat jujur) |
| 3. Itinerary Approval | **Penuh (Section 4)** — versioning/compare/comment/approve/revision seluruhnya berfungsi | — |
| 4. Billing | **Penuh (Section 6)** — upload proof/mock verification/paid seluruhnya berfungsi, Client tidak bisa self-mark paid | — |
| 5. Change Request | **Hampir penuh (Section 5, diverifikasi ulang Section 8)** — create/draft/submit/mock review/impact approval/execution progress seluruhnya berfungsi dari sisi Client | "Related project data updated" bersifat notifikasi+activity log saja, belum ada linkage mekanis ke Traveler/ItineraryVersion/Reservation per `changeType` (keterbatasan genuine, dicatat jujur) |
| 6. Trip Closing | **Hampir penuh (Section 5/7)** — Trip Center aktif penuh, Feedback→closing progress berfungsi, backend state machine + Closing tab read-only (Section 4) | Completion approval Client (di luar scope 18 halaman) |

Flow 1/3/4 sudah 100% terpenuhi untuk sisi Client (Section 3/4/6, Flow 1 dengan 1 perbaikan workflow-terputus di Section 8). Flow 2/5/6 hampir penuh — bagian tersisa: keterbatasan data model per-traveler↔booking (Flow 2), belum ada linkage mekanis Change Request→entitas terkait (Flow 5, keduanya dicatat jujur bukan dipaksakan lewat trigger palsu), dan "Completion approval Client" (Flow 6, di luar 18 halaman Master Prompt, bukan gap implementasi). Section 8 (Integration & QA) memverifikasi ulang seluruh 6 flow lewat trace kode langsung (bukan asumsi dari laporan section sebelumnya) dan mengonfirmasi tidak ada flow yang BROKEN — status di atas adalah kondisi final.
