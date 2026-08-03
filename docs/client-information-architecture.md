# Client Information Architecture — Kondisi Aktual vs Target 18 Halaman

Dibuat oleh **Repair Phase / Section 0 — Audit dan Gap Analysis**. Diperbarui oleh **Section 1 — Client Foundation** (bagian 6 di bawah) — bagian 1-5 di bawah ini TETAP dipertahankan apa adanya sebagai catatan kondisi SEBELUM Section 1 (historical baseline, jangan dihapus).

## 1. Struktur Aktual (Sebelum Section 0)

Navigasi (`app/constants/navigation.ts`) hanya punya **satu entri** untuk Client: `{ label: 'Client Portal', to: '/client', moduleKey: 'client-portal' }` — tanpa children/submenu.

Route yang benar-benar ada hari ini:

| Route | File | Isi aktual |
|---|---|---|
| `/client` | `app/pages/client/index.vue` | Satu halaman gabungan: stats company, "Action Center" (agregat item butuh tindakan, derivasi murni — bukan entitas Notification), dialog "Ajukan Travel Request" (membuat `Lead` mentah + qualification draft), Profil Company (read-only), Support/AE contact, Contacts CRUD, list Opportunity, list Project Order |
| `/client/opportunities/[id]` | `app/pages/client/opportunities/[id]/index.vue` | Detail Opportunity + Quotation view (sanitized), Accept/Reject/Request Revision self-service |
| `/client/project-orders/[id]` | `app/pages/client/project-orders/[id]/index.vue` | Satu halaman 7-tab: Overview, Itinerary (read-only flat list), Travelers (CRUD + submission), Documents (read-only list nama+tanggal), Finance (read-only invoice + payment history), Changes & Incidents (read-only sanitized), Kebutuhan Komoditas (CRUD Requirement penuh) |
| `/client/catalog/[requirementId]` | `app/pages/client/catalog/[requirementId]/index.vue` | Katalog komoditas Vendor, matching, compare, selection, Soft Hold — lihat `docs/MANOVA-Client-Vendor-Commodity-End-to-End-Flow.md` |

**Total: 4 route/file, 1 nav entry.** Struktur ini adalah hasil Section 08 (Client Portal, roadmap lama) ditambah Phase 1–6 Client–Vendor Commodity — BUKAN struktur 18-halaman bergaya B2B enterprise portal yang diminta Master Prompt baru.

## 2. Struktur Target (Master Prompt bagian E/F)

7 grup, 18 halaman:

| Grup | Halaman | Route rekomendasi Master Prompt |
|---|---|---|
| HOME | Dashboard | `/client` |
| HOME | Notifications | `/client/notifications` |
| REQUEST & COMMERCIAL | Travel Requests | `/client/travel-requests`, `/new`, `/:id`, `/:id/edit` |
| REQUEST & COMMERCIAL | Quotations & Proposals | `/client/quotations`, `/:id` |
| REQUEST & COMMERCIAL | Approval Center | `/client/approvals`, `/:id` |
| TRAVEL MANAGEMENT | Projects | `/client/projects`, `/:id` |
| TRAVEL MANAGEMENT | Participants | `/client/participants`, `/:id` |
| TRAVEL MANAGEMENT | Itineraries | `/client/itineraries`, `/:id` |
| TRAVEL MANAGEMENT | Reservations | `/client/reservations`, `/:id` |
| TRAVEL MANAGEMENT | Trip Center | `/client/trip-center/:projectId` |
| TRAVEL MANAGEMENT | Change Requests | `/client/change-requests`, `/new`, `/:id` |
| COLLABORATION | Documents | `/client/documents` |
| COLLABORATION | Messages & Activities | `/client/messages/:projectId` |
| COLLABORATION | Issues & Support | `/client/support`, `/new`, `/:id` |
| FINANCE | Finance & Billing | `/client/billing`, `/invoices/:id` |
| INSIGHTS | Reports & Analytics | `/client/reports` |
| INSIGHTS | Feedback & Evaluation | `/client/feedback` |
| COMPANY | Company Profile | `/client/company-profile` |

Master Prompt mengizinkan sebagian detail memakai Drawer/Modal/Tab/Side panel/Nested route alih-alih halaman terpisah penuh — keputusan mana yang jadi halaman penuh vs. Project Workspace tab akan ditentukan di section implementasi masing-masing (Section 2–7 pada `prompts/repair_phases/`), BUKAN pada Section 0 ini.

## 3. Pemetaan Kondisi Aktual → Target (Ringkas)

Rincian per-halaman lengkap ada di `docs/client-page-inventory.md`. Ringkasan struktural:

- **Projects, Participants, Itineraries, Documents, Finance & Billing, Change Requests** — kontennya SUDAH ADA hari ini, tapi terkubur sebagai 5 dari 7 tab di SATU halaman `/client/project-orders/[id]`, bukan 6 halaman/route terpisah seperti target.
- **Dashboard** — sudah ada sebagai bagian dari `/client` (bercampur dengan Profile/Contacts/Support), belum jadi halaman "Dashboard" yang berdiri sendiri dengan seluruh card yang diminta (Pending approvals, Incomplete participant data, Project readiness per-project, Quick actions lengkap).
- **Notifications** — belum ada sebagai halaman; yang ada adalah "Action Center" versi derivasi murni (bukan entitas `Notification` per-user yang bisa mark-as-read). Entitas `Notification` (Section 21, `app/types/document-comms.ts`) SUDAH ADA di kode tapi role `client` saat ini `documents: 'NONE'` — tidak diekspos ke Client sama sekali.
- **Travel Requests** — TIDAK ADA sebagai entitas/halaman. Dialog "Ajukan Travel Request" di `/client` hanya membuat `Lead` mentah tanpa halaman list/detail/draft/status-tracking sendiri.
- **Quotations & Proposals** — hanya ada inline di dalam `/client/opportunities/[id]` (satu quotation per opportunity, tanpa list, tanpa version compare eksplisit, tanpa cancellation policy/compare package options).
- **Approval Center** — TIDAK ADA sebagai halaman generik. Hanya ada Accept/Reject/Request Revision untuk Quotation; approval untuk final itinerary/participant list/rooming list/additional charge/dll. TIDAK ADA.
- **Reservations, Trip Center** — TIDAK ADA sama sekali untuk booking tradisional (Flight/Hotel/Transport/dll — entitas ini `FlightBooking`/`HotelBooking`/dst. adalah internal-only, tidak pernah diekspos ke `/client/**`). Hanya ada padanan parsial lewat Client–Vendor Commodity (Soft Hold/Order status) untuk komoditas yang dibeli lewat jalur itu.
- **Messages & Activities, Issues & Support, Reports & Analytics, Feedback & Evaluation, Company Profile (edit)** — TIDAK ADA sama sekali untuk Client.

## 4. Reusable Infrastructure (Dipetakan, Belum Diintegrasikan)

| Modul target | Infrastruktur reusable yang sudah ada | Status integrasi ke Client |
|---|---|---|
| Notifications | `Notification`, `Message`, `Document`, `UnifiedTimelineEntry` (`app/types/document-comms.ts`, Section 21) + halaman `/documents` (internal) | Belum diekspos — `ROLE_MODULE_ACCESS.client.documents = 'NONE'` |
| Documents | Sama seperti di atas, plus `ProjectDocument`/`getDocumentsByProject`/`getDocumentsByParty` (lebih sederhana, sudah dipakai tab Documents existing) | Sebagian (versi sederhana saja) |
| Finance & Billing | `Invoice`/`Payment`/`getInvoicesByProject`/`getPaymentsByInvoice`, `INVOICE_STATUSES`/`INVOICE_TYPES` | Sebagian (read-only, sudah dipakai tab Finance existing) |
| Change Requests | `ChangeRequest`/`CancellationRecord`/`RefundRequest`/`Incident` (`app/types/change-incident.ts`, Section 19) | Sebagian (read-only sanitized, sudah dipakai tab Changes & Incidents) |
| Projects/Itineraries/Participants | `Project`, itinerary item, `Traveler`/`TravelerGroup`/`RoomAssignment` | Sebagian (sudah dipakai sebagai tab, belum sebagai halaman dengan versioning/compare) |
| Reservations | `FlightBooking`/`HotelBooking`/`TransportBooking`/`MiceEvent`, `BookingOrchestrationRecord`/`BookingTimelineEntry` (Section 13-18) | Tidak ada — seluruhnya internal-only hari ini, tidak ada client-facing view |
| — | `CommoditySelection`/`CommodityOrder` (Phase 1-6 Client–Vendor Commodity) | Ada, tapi domain terpisah dari Reservations tradisional, bukan pengganti |

## 5. Risiko Integrasi dengan Role Internal

- Setiap halaman baru yang menambah field ke tipe existing (`Project`, `Invoice`, dll.) berisiko menyentuh section LOCKED lain — mayoritas kebutuhan 18 halaman sudah bisa dipenuhi oleh entitas yang ada, risiko utama ada pada **Travel Requests**, **Approval Center generik**, **Trip Center**, **Issues & Support (`SupportTicket`)**, **Feedback**, dan **Company Profile edit** yang butuh entitas/field benar-benar baru.
- Mengekspos modul `documents` ke role `client` (mengubah `ROLE_MODULE_ACCESS.client.documents` dari `NONE`) berpotensi berdampak ke halaman internal `/documents` bila filter visibilitas per-role belum benar-benar diuji dari sisi Client — perlu penanganan hati-hati, bukan sekadar mengganti nilai enum.
- `Reservations`/`Trip Center` butuh keputusan arsitektur: apakah menambahkan client-facing READ-ONLY view di atas `FlightBooking`/dst. (mengikuti pola sanitasi voucher/eticket existing), atau membuat view derivasi baru murni dari `BookingOrchestrationRecord` (Section 18) yang sudah lintas-domain — keputusan ini berada di luar scope Section 0 (audit), akan direkomendasikan di Section perencanaan berikutnya.

## 6. Struktur Setelah Section 1 (Foundation)

Navigasi (`app/constants/navigation.ts`) sekarang punya **7 entri top-level** (bukan lagi satu "Client Portal") — `NavItem.children` hanya mendukung satu level nesting, jadi 7 grup Master Prompt direalisasikan sebagai 7 item top-level dengan children, pola identik "Customer Journey"/"CRM":

| Nav top-level | Children | Route |
|---|---|---|
| Home | Dashboard, Notifications | `/client`, `/client/notifications` |
| Request & Commercial | Travel Requests, Quotations & Proposals, Approval Center | `/client/travel-requests`, `/client/quotations`, `/client/approvals` |
| Travel Management | Projects, Participants, Itineraries, Reservations, Trip Center, Change Requests | `/client/projects`, `/client/participants`, `/client/itineraries`, `/client/reservations`, `/client/trip-center`, `/client/change-requests` |
| Collaboration | Documents, Messages & Activities, Issues & Support | `/client/documents`, `/client/messages`, `/client/support` |
| Finance & Billing | (tanpa children) | `/client/billing` |
| Insights | Reports & Analytics, Feedback & Evaluation | `/client/reports`, `/client/feedback` |
| Company Profile | (tanpa children) | `/client/company-profile` |

**Seluruh 18 route kini valid dan dapat diklik dari nav** (memenuhi acceptance criteria "Semua menu memiliki route yang valid"). 17 dari 18 memakai shell `ModulePlaceholder` (`comingSoon: true`, badge "Segera") — HANYA "Dashboard" yang mengarah ke `/client` existing yang sudah berfungsi penuh. 4 halaman lama (`/client`, `/client/opportunities/[id]`, `/client/project-orders/[id]`, `/client/catalog/[requirementId]`) **TIDAK dihapus/diubah** — tetap berfungsi penuh, disebutkan sebagai referensi "sementara" di deskripsi tiap shell terkait, akan dikonsolidasikan ke IA baru oleh section implementasi masing-masing (bukan Section 1).

Type baru (foundation, array seed kosong kecuali dicatat lain): `TravelRequest` (`app/types/travel-request.ts`), `Approval` (`app/types/client-approval.ts`), `ItineraryVersion` (`app/types/itinerary-version.ts`), `Reservation` (`app/types/reservation.ts`), `SupportTicket` (`app/types/support.ts`), `Feedback` (`app/types/feedback.ts`). Selector read/filter foundation untuk keenamnya sudah ada di `app/data/index.ts` (bagian "Client Experience — Foundation selectors"). Mock data 5 skenario (Party PTY-005 + Project PRJ-201-204 + Lead LED-012) — lihat `docs/client-mock-data-scenarios.md` (baru).

## 7. Struktur Final Setelah Section 2–8 (Integration & QA)

Seluruh 18 halaman target bagian 2 di atas kini terealisasi penuh — shell `ModulePlaceholder` (bagian 6) sudah 100% diganti implementasi bisnis nyata oleh Section 2–7 (rincian per halaman ada di `docs/client-page-inventory.md`, status "Existing & Complete" untuk seluruh 18). Nav 7-grup (bagian 6) TIDAK berubah strukturnya sejak Section 1 — hanya `comingSoon: true` yang dihapus bertahap per section.

**Section 8 (Integration, QA, Regression, Final Documentation)** melakukan audit penuh terhadap IA final ini dan TIDAK menemukan route orphan, nav item yang salah arah, atau halaman yang hilang dari sidebar — seluruh 18 route + `/client/project-orders/[id]` (Project Workspace, sengaja di luar nav, dijangkau dari list) dan 4 route lama (`/client`, `/client/opportunities/[id]`, `/client/project-orders/[id]`, `/client/catalog/[requirementId]`) tetap valid dan tidak saling menimpa. Satu perbaikan navigasi diterapkan Section 8: Notifications sebelumnya tidak bisa membuka entitas `travel-request`/`quotation` terkait (dead click) — kini `notificationRoute()` (`app/pages/client/notifications/index.vue`) memetakan kedua `entityType` tersebut ke halaman detail masing-masing.
