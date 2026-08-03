# Client Mock Data Scenarios

Dibuat oleh **Repair Phase / Section 1 — Client Foundation** (`prompts/repair_phases/PROMPT-SECTION-1.md` item 5, mengikuti `prompts/repair_phases/MASTER-PROMPT.md` bagian I). 5 skenario wajib, seluruhnya milik company demo baru **PTY-005 "PT Java Bhakti Persada"** (login demo: `USR-021` "Dimas Pratama", role `client`) — company terpisah dari PTY-001-004 agar tidak mengubah data yang sudah dipakai fixture/test section lain.

Data dibangun HANYA dengan entitas yang sudah ada (`Project`, `Traveler`, `ProjectService`, `ItineraryItem`, `Invoice`, `Payment`, `Lead`, `ChangeRequest`) — 6 entitas baru Section 1 (`TravelRequest`/`Approval`/`ItineraryVersion`/`Reservation`/`SupportTicket`/`Feedback`) sengaja masih kosong (foundation only, belum ada halaman/mutator yang mengonsumsinya).

## Skenario A — Korea Incentive Trip

- **Record:** `PRJ-201` "Korea Incentive Trip 2026", destinasi Seoul, 12-16 Okt 2026, `status: 'planning'`, 45 traveler (2 sampel: `TRV-2011`/`TRV-2012`).
- **Narasi vs data:** Hotel confirmed (`SVC-2012`), Flight masih pending (`SVC-2011`, `status: 'pending-confirmation'` — vocabulary `ServiceStatus` existing tidak punya nilai "hold" persis, dipetakan ke status terdekat), Invoice partially paid (`INV-2011`/`PAY-2011`, ~50%), Itinerary baru 2 item dasar (belum ada `ItineraryVersion` — "waiting approval" akan direpresentasikan nyata begitu section "Core Project" membangun versioning).
- **Completion 82% peserta:** TIDAK direplikasi persis secara numerik (hanya 2 dari 45 sampel traveler diisi, mengikuti konvensi "sampel representatif" existing sejak Section 11) — dicatat jujur, bukan dihitung presisi ke 82%.

## Skenario B — Abu Dhabi Business Delegation

- **Record:** `PRJ-202` "Abu Dhabi Business Delegation", 25 Jul-2 Agu 2026, `status: 'ongoing-trip'` (Trip Active), 24 traveler (2 sampel).
- **Narasi vs data:** Flight + Hotel keduanya `confirmed` (`SVC-2021`/`SVC-2022`), Invoice `paid` penuh (`INV-2021`/`PAY-2021`).
- **"Trip Center enabled", "one schedule change", "one open issue":** Trip Center sendiri belum ada UI (route shell, section "Execution & Changes"); "schedule change"/"open issue" BELUM direpresentasikan sebagai `ChangeRequest`/`Incident` baru pada skenario ini di Section 1 — dicatat sebagai kebutuhan data tambahan untuk section yang membangun Trip Center/Issues & Support, bukan gap tersembunyi.

## Skenario C — Manila Corporate Meeting

- **Record:** `PRJ-203` "Manila Corporate Meeting 2026", 10-13 Jun 2026, `status: 'completed'`, 12 traveler (1 sampel).
- **Narasi vs data:** Flight `completed` (`SVC-2031`), Invoice final `paid` penuh (`INV-2031`/`PAY-2031`).
- **"Final report available", "Feedback pending", "Completion approval pending":** `Feedback` untuk `PRJ-203` sengaja TIDAK ada record (array `FEEDBACK_RECORDS` kosong) — merepresentasikan "pending"/belum disubmit secara akurat (bukan status tersimpan yang harus dicari, ketiadaan record = belum ada feedback). "Final report" dan "Completion approval" oleh Client belum punya mekanisme sama sekali (lihat `docs/client-page-inventory.md` #17) — akan dibangun section "Insights & Company".

## Skenario D — Bali MICE Event

- **Record:** `LED-012` (Lead, BUKAN Project) — "Dimas Pratama"/PT Java Bhakti Persada, `source: 'client-portal'`, `stage: 'contacted'`, destinasi Bali, `serviceCategory: 'mice-event'`.
- **Kenapa Lead, bukan Project/TravelRequest:** skenario ini eksplisit "No quotation yet" — belum pernah melewati Won, jadi tidak boleh punya `Project`. `TravelRequest` (entitas baru Section 1) belum punya mutator/halaman (dibangun section "Request & Commercial"), jadi untuk sementara direpresentasikan lewat `Lead` existing yang paling dekat maknanya (pra-Opportunity, butuh klarifikasi). `qualificationNotes` mencatat kebutuhan venue/event yang belum lengkap.

## Skenario E — Singapore Conference

- **Record:** `PRJ-204` "Singapore Conference 2026", 5-8 Nov 2026, `status: 'confirmed'`, 15 traveler (2 sampel).
- **Narasi vs data:** `CR-007` (`ChangeRequest`, `app/data/change-incident.ts`) — perubahan besar (perpanjangan + ganti venue hotel), `commercialImpactIdr` 42 juta merepresentasikan cancellation fee + biaya tambahan, `status: 'under-review'` (approval pending). Invoice `partially-paid` (`INV-2041`/`PAY-2041`).
- **"Revised quotation available":** `CR-007.linkedQuotationId` sengaja kosong — belum ada `Quotation` baru dibuat untuk PRJ-204 (tidak ada Opportunity/Quotation flow yang dijalankan untuk demo ini); akan diisi nyata saat section "Request & Commercial" membangun alur revised quotation dari Change Request.

## Update Section 8 — Final QA Sign-off

5 skenario di atas dicatat pada Section 1 (foundation, sebelum halaman bisnis dibangun) — beberapa catatan "belum ada UI/mekanisme" di dalamnya sudah RESOLVED oleh Section 2–7 (Trip Center/Issues & Support/Reports/Feedback/Reservations seluruhnya sudah dibangun penuh, lihat `docs/client-progress.md` per section). Skenario tetap dipertahankan sebagai catatan historis (bukan dihapus/ditulis ulang) sesuai instruksi "jangan menghapus entri lama" — status UI terkini untuk masing-masing entitas ada di `docs/client-page-inventory.md`.

Diverifikasi ulang end-to-end pada Section 8 (audit + trace kode, bukan browser manual):
- **Skenario A (Korea, PRJ-201):** itinerary `waiting-approval` (`ITVER-001`) terkonfirmasi dapat direview/approve/request-revision penuh di `/client/itineraries/PRJ-201`.
- **Skenario B (Abu Dhabi, PRJ-202):** Trip Center mode `active` terkonfirmasi derivasi otomatis dari `status: 'ongoing-trip'`; `TRIP_ANNOUNCEMENTS` (Section 5) mengisi kebutuhan "one schedule change" secara jujur (bukan `ChangeRequest`/`Incident` baru — announcement, bukan perubahan booking).
- **Skenario C (Manila, PRJ-203):** `FEEDBACK_RECORDS` tetap kosong untuk PRJ-203 (feedback pending, akurat) — Section 8 mengonfirmasi `/client/feedback/PRJ-203` dapat mendemokan Save Draft/Submit penuh dari kondisi kosong ini.
- **Skenario D (Bali, `LED-012`/`TR-001`):** Section 3 menambahkan `TR-001` (`TravelRequest`, status `need-clarification`) yang menaut ke `LED-012` — skenario D kini didemokan lewat entitas `TravelRequest` asli, bukan `Lead` mentah saja.
- **Skenario E (Singapore, `CR-007`):** terverifikasi Section 8 — Impact Review pada `/client/change-requests` TIDAK PERNAH menampilkan `commercialImpactIdr` mentah ke Client (lihat perbaikan keamanan di `docs/client-role-scope.md` bagian 6); `CR-007` dipakai sebagai data demo utama Approval Center (`CAPP-001`).

Tidak ada skenario/mock data baru ditambahkan pada Section 8 (sesuai larangan "jangan menambah fitur besar baru") — seluruh perubahan Section 8 adalah perbaikan kode terhadap data yang sudah ada.

## Prinsip yang Dipegang

- **Tidak ada data yang dipaksakan pas ke narasi bila tipe/enum yang ada tidak mendukungnya** (mis. "flight on hold" dipetakan ke `pending-confirmation`, bukan menambah nilai enum baru di Section 1 hanya untuk 1 baris seed data) — didokumentasikan di sini secara eksplisit, bukan disembunyikan.
- **ID relasional konsisten**: `PRJ-20x.partyId → PTY-005`, `INV-20xx.projectId → PRJ-20x`, `PAY-20xx.invoiceId → INV-20xx`, `SVC-20xx.projectId → PRJ-20x`, `TRV-20xx.projectId → PRJ-20x`, `ITIN-20xx.projectId → PRJ-20x`, `CR-007.projectId → PRJ-204`.
- **Tidak menyentuh PRJ-101-104/PTY-001-004** — seluruh data lama yang sudah dipakai section/audit lain tetap utuh.
