# Section 21 — Documents, Communication dan Notifications

**Status:** COMPLETED

Dikerjakan berdasarkan `prompts/SECTION_21_Documents_Communication_Notifications.md`, dijalankan atas perintah user.

---

## 1. Section Objective dan Scope

Melengkapi cross-module communication frontend tanpa backend — membangun modul konsolidasi-style baru `/documents` yang MENDAMPINGI (bukan menggantikan) dokumen yang sudah tersebar per tab (`ProjectDocument` Project Detail, `getDocumentsByParty` Customer Detail, Section 14 lama/Prompt 19) dan `VendorDocument` (Section 17). Wajib literal: Document folders per entity/project; categories, versions, expiry, access level; internal/client/supplier visibility; generated document previews; internal notes/client messages/supplier messages; in-app notification center; Email/WhatsApp delivery status simulation tanpa klaim integrasi; mentions/assignments/reminders/escalation; unified activity timeline dengan filtering akses. Acceptance: "Dokumen dan komunikasi dapat ditelusuri ke entity dan tidak bocor lintas role." **Tidak mengerjakan** section lain — `ChangeRequest`/`Incident` (Section 19), `ProjectTask` (Section 09 lama) TIDAK disentuh kecuali 4 hook aditif eksplisit-diizinkan (lihat bagian 4/9).

## 2. Source Documents yang Dibaca

`prompts/01-PROTOKOL WAJIB — CONTINUITY, DOKUMENTASI PER SECTION, DAN PERLINDUNGAN HASIL.md`, `prompts/SECTION_21_Documents_Communication_Notifications.md`, `CLAUDE.md`, `docs/mockup-section-progress.md` (entri Section 20 penuh), `docs/mockup-design-decisions.md` D-070 s.d. D-077 penuh (rantai preseden arsitektur — khususnya D-075/D-076 "consolidation/orchestration layer lintas-domain" dan D-077 "kapan section memperluas domain miliknya sendiri secara langsung"), `docs/frontend-known-issues.md` §16 (gap statement literal), `docs/frontend-implementation-roadmap.md`/`docs/frontend-module-map.md`/`docs/frontend-workflow-map.md`/`docs/mockup-open-questions.md`/`docs/mockup-section-reports/README.md`/`docs/mockup-section-reports/section-20-project-finance.md` (template struktur laporan 19-bagian). Source code dibaca penuh: `app/types/activity.ts` (`ActivityEntry`/`ProjectDocument`/`ProjectTask`/`SystemEvent`), `app/data/activity.ts` (`DOCUMENTS` fixture 6 baris), `app/data/index.ts` (`getDocumentsByProject`/`getDocumentsByParty`/`createChangeEntry`/`approveChangeEntry`/`rejectChangeEntry`/`escalateIncident`/`appendIncidentCommunication`/`approveChangeRequest`/`rejectChangeRequest`/`createProjectTask`/`updateProjectTask`, `Quotation.sentToClientAt` handling), `app/components/layout/TopHeader.vue`/`NotificationPanel.vue` (dikonfirmasi hardcoded fake data starter-template), semua 9 halaman `*-preview.vue` (diinventarisasi via `Glob`), `app/types/procurement.ts` (`VendorDocument`), `app/types/user.ts` (`ModuleKey`), `app/constants/roles.ts`/`navigation.ts`/`status.ts`, `app/pages/projects/[id]/index.vue` (tab Documents dan Activity & Changes), `app/pages/changes/index.vue` (pola tab query-param terdekat untuk direplikasi). `git status`/`git log` diperiksa — dikonfirmasi bersih kecuali working tree Section 00-20 yang memang belum di-commit (tidak disentuh).

## 3. Existing Implementation yang Diperiksa

`ProjectDocument` (`app/types/activity.ts`) minimal — hanya `id`/`projectId`/`name`/`uploadedAt`, `DOCUMENTS` fixture hanya 6 baris. `getDocumentsByParty` (Prompt 19) murni union `getDocumentsByProject` lintas seluruh Project Order satu company — tidak ada entitas `PartyDocument` paralel. `VendorDocument` (Section 17, `app/types/vendor.ts`) domain terpisah untuk dokumen vendor (kontrak/sertifikasi/NPWP), preview mock. `NotificationPanel.vue` (`app/components/layout/`) sudah ada sejak starter-template — `ref<Notification[]>` hardcoded 6 notifikasi fake generik PM-SaaS ("Website Redesign project completed", "$12,500 payment received"), interface lokal `type: 'success'|'warning'|'info'|'error'`, ZERO import dari `~/data`. `TopHeader.vue` sudah punya bell icon + badge unread yang bekerja lewat `notificationPanelRef.value?.unreadCount` (`defineExpose`). `Quotation.sentToClientAt` (Section 05, `app/pages/crm/opportunities/[id]/index.vue` baris ~257) — precedent mock delivery-status TERDEKAT: satu timestamp flip via `sendQuotationToClient`, komentar eksplisit "simulasi, bukan email/WA nyata". 9 halaman `*-preview.vue` diinventarisasi lengkap (lihat bagian 5). Tidak ada `Message`/communication-log terstruktur terpisah dari `PartyActivity`/`LeadActivity`/`VendorActivity` (internal-only). Tidak ada unified timeline access-filtered.

## 4. Decisions yang Digunakan

D-075 (Section 18, preseden "consolidation/orchestration layer lintas-domain", hook representatif bukan menyeluruh) dan D-076 (Section 19, turunan kedua preseden tsb, `ChangeRequest` menaut balik ke `ActivityEntry` bukan menggantikannya) — Section 21 adalah turunan KETIGA, pola yang sama diterapkan pada `Document`/`Message`/`Notification` menaut ke `ProjectDocument`/`ActivityEntry` tanpa memutasi. D-077 (Section 20, "section memperluas domain miliknya sendiri secara langsung") — DIPERTIMBANGKAN tapi TIDAK diterapkan di sini, karena `Document`/`Message`/`Notification` adalah domain BARU milik Section 21 sendiri (bukan perluasan `ProjectDocument`/`VendorDocument` milik section lain) — jadi pola D-070 s.d. D-076 ("entitas baru, jangan mutasi") tetap yang berlaku, BUKAN pola D-077. Pola halaman list-tab query-param (`/changes`, Section 19) direplikasi persis untuk `/documents`. D-078 (BARU, dicatat section ini — rasional lengkap arsitektur Document/Message/Notification, hook kurasi, unified timeline — lihat `docs/mockup-design-decisions.md`).

## 5. Implementation Summary dan User Flow

**Types (`app/types/document-comms.ts`, baru):** `DocumentAccessLevel`/`DocumentSourceType`/`DocumentEntityType` (12 nilai) — `Document` (entityType/entityId/projectId opsional/name/category/version/uploadedAt-atau-generatedAt/expiresAt/accessLevel/sourceType/previewRoute/uploadedBy). `MessageChannel`/`MessageDeliveryStatus` — `Message` (entityType/entityId/projectId/channel/senderId/body/mentions/sentAt/deliveryStatus/deliveryChannel). `NotificationType` (8 nilai) — `Notification` (userId/type/title/body/entityType/entityId/createdAt/read). `UnifiedTimelineEntryKind` — `UnifiedTimelineEntry` (id/at/kind/label/detail/internalOnly).

**9 route preview diinventarisasi dan diverifikasi (fixture `Document.previewRoute` HANYA menaut ke ini, tidak ada yang lain):** `/crm/opportunities/[id]/quotation-preview`, `/ticketing/[id]/eticket-preview`, `/accommodation/[id]/voucher-preview`, `/transportation/[id]/service-order-preview`, `/transportation/[id]/driver-sheet-preview`, `/mice/[id]/rundown-preview`, `/mice/[id]/boq-preview`, `/projects/[id]/run-sheet-preview`, `/projects/[id]/manifest-preview`.

**Fixtures (`app/data/document-comms.ts`, baru):** 16 `Document` (12 entityType tercakup, `DOC-C011` expired, `DOC-C012` expiring-soon, mix uploaded/generated), 8 `Message` (3 channel, 4 deliveryStatus termasuk `failed`/`queued`, 2 dengan mentions), 9 `Notification` (5 user berbeda, mixed read/unread, seluruh 8 type). Detail lengkap: `docs/mockup-data-scenarios.md` bagian 4x.

**Selektor/mutator baru (`app/data/index.ts`):** `getDocumentById`/`getDocumentsByEntity`/`getDocumentsForProject` (union dengan `getDocumentsByProject` legacy)/`createDocument`; `getMessageById`/`getMessagesByEntity`/`sendMessage` (settle deterministik `sent`/`delivered`, memicu `pushNotification` type `mention` bila `mentions` terisi); `getNotificationById`/`getNotificationsForUser`/`getUnreadNotificationCount`/`markNotificationRead`/`markAllNotificationsRead`/`removeNotification`/`pushNotification`; `getUnifiedActivityTimeline(entityType, entityId, viewerAccessLevel)` (derived, agregasi `ActivityEntry`+`SystemEvent`+`Message`+`Document`, filter `internalOnly`).

**4 hook notification-push kurasi (nama fungsi TERVERIFIKASI dari kode, bukan approx. dari brief):**
1. `sendMessage` (baru, Section 21) — mentions → `pushNotification(..., 'mention', ...)`.
2. `escalateIncident` (`app/data/index.ts` baris ~3487, Section 19, LOCKED) — SATU baris aditif → `pushNotification(escalatedTo, 'escalation', ...)`.
3. `approveChangeRequest`/`rejectChangeRequest` (Section 19, LOCKED) — SATU baris aditif masing-masing → `pushNotification(request.requestedBy, 'change', ...)`.
4. `createProjectTask`/`updateProjectTask` (Section 09 lama, LOCKED — **koreksi dari brief**: brief menyebut approx. "Section 12's task-assignment mutator"; verifikasi kode menemukan task CRUD sesungguhnya milik Section 09 lama, Section 12 hanya menambah `isBlocked`/`blockedReason`) — hook di kedua fungsi, `updateProjectTask` digerbangi guard `patch.assignedTo !== task.assignedTo` mencegah notifikasi berulang.

**`NotificationPanel.vue` rewire:** data source diganti `getNotificationsForUser(currentUser.id)`/`getUnreadNotificationCount`/`markNotificationRead`/`markAllNotificationsRead`/`removeNotification`, shell UI (popover, styling, `defineExpose({ unreadCount })`) dipertahankan 100%. `TopHeader.vue` TIDAK disentuh. "View all notifications" → `navigateTo('/documents?tab=notifications')` (tujuan kanonik tunggal).

**Halaman baru `/documents` (3 tab query-param, pola `/changes`):**
- Tab **Documents** — filter search/category/access-level/entity-type/expiry-status, StatsCard (Total/Expired/Expiring Soon/Unread Notifications), tabel dengan badge access-level+expiry, link "Preview" untuk dokumen `generated`, dialog "Upload Document" (mock).
- Tab **Messages** — filter search/channel, badge failed-delivery-count, tabel dengan badge channel+delivery-status, dialog "New Message" (entity/project/channel/body/mentions-checkbox/delivery-channel).
- Tab **Notifications** — list notifikasi milik user login, mark-as-read per klik, mark-all-read, remove per item.

**Extension Project Detail (`app/pages/projects/[id]/index.vue`):** tab "Documents" diperkaya tabel category/version/access-level/expiry/source via `getDocumentsForProject` (union legacy+baru, widget Overview "recentDocuments" TIDAK diubah). Tab "Activity & Changes" +SectionCard "Communication" (compose pesan project, channel selector, list pesan dengan badge channel+delivery-status) dan +SectionCard "Unified Activity Timeline (Internal View)" (`getUnifiedActivityTimeline('project', id, 'internal')`).

**User flow yang bisa didemokan:** buka `/documents` sebagai Management/PM/Operations → lihat StatsCard Expired=1 (`DOC-C011`) → filter Expiry Status "Expired" → klik "Upload Document" → isi entity/name/category/access-level → dokumen baru muncul. Buka `/changes/incidents/INC-001` → "Eskalasikan" → login sebagai target eskalasi (mis. `USR-009`, Fajar Nugroho) → buka bell popover TopHeader → notifikasi eskalasi baru muncul unread. Buka tab "Tasks" `/projects/PRJ-101` → assign task ke user baru → login sebagai user tsb → notifikasi assignment muncul. Buka `/projects/PRJ-101?tab=activity-changes` → SectionCard "Communication" → "Kirim Pesan" (client-message) → pesan baru muncul dengan badge "Diterima" (delivered).

## 6. Routes

Baru: `/documents` (3 tab query-param: default/`?tab=messages`/`?tab=notifications`). Tidak ada route existing yang dihapus/di-rename — `/projects/[id]` (tab `documents`/`activity-changes`) diperkaya pada route yang sama.

## 7. Files Created, Changed, dan Removed

**Created:** `app/types/document-comms.ts`, `app/data/document-comms.ts`, `app/pages/documents/index.vue`, `docs/mockup-section-reports/section-21-documents-comms-notifications.md` (laporan ini).

**Changed:** `app/data/index.ts`, `app/components/layout/NotificationPanel.vue`, `app/pages/projects/[id]/index.vue`, `app/types/user.ts`, `app/constants/roles.ts`, `app/constants/navigation.ts`, `app/constants/status.ts`, `app/utils/attention.ts`, `app/pages/admin/roles.vue`, `docs/mockup-design-decisions.md` (+D-078), `docs/mockup-change-impact-log.md` (+CI-051), `docs/mockup-data-scenarios.md` (+bagian 4x), `docs/frontend-module-map.md`, `docs/frontend-workflow-map.md`, `docs/frontend-implementation-roadmap.md`, `docs/frontend-known-issues.md` (§16 RESOLVED), `docs/mockup-implementation-state.md`, `docs/mockup-progress.md` (+Entri 30), `docs/mockup-section-progress.md` (+entri Section 21), `docs/mockup-section-reports/README.md`.

**Removed:** Tidak ada.

## 8. Components Reused dan Created

**Reused:** `PageHeader`, `SectionCard`, `DetailMetadataList`, `StatusBadge`, `EmptyState`, `RoleAccessState`, `Table*`, `Dialog*`/`DialogScrollContent`, `Tabs*`, `StatsCard`, `Input`, `Label`, `useToast`. Tidak ada komponen shared file baru.

**Created:** Tidak ada komponen shared baru — hanya 1 halaman baru (bagian 6/7).

## 9. Types, Constants, Fixtures, dan Mock State

`app/types/document-comms.ts` (baru) — lihat bagian 5. `app/constants/status.ts` +`DOCUMENT_ENTITY_TYPES`/`DOCUMENT_ACCESS_LEVELS`/`MESSAGE_CHANNELS`/`MESSAGE_DELIVERY_STATUSES`/`NOTIFICATION_TYPES`. `app/utils/attention.ts` +`DOCUMENT_EXPIRY_WARNING_DAYS` (30 hari, pola sama `UPCOMING_DEPARTURE_WINDOW_DAYS`), +`isDocumentExpired`/`isDocumentExpiringSoon` (fungsi murni baru). Fixture: 16 `Document`, 8 `Message`, 9 `Notification` — detail lengkap skenario `docs/mockup-data-scenarios.md` bagian 4x.

## 10. Responsive Behavior

Mengikuti pola grid existing (`grid-cols-1 sm:grid-cols-2/3/4`, `flex-col sm:flex-row` untuk filter bar) di seluruh SectionCard/StatsCard/filter baru — konsisten dengan `/changes`/`/finance` existing. Tidak diverifikasi lewat browser interaktif — tidak ada tool headless browser tersedia (keterbatasan konsisten sejak Section 06).

## 11. Loading, Empty, Error, Not-Found, dan Unauthorized States

- **Loading:** Tidak ada simulasi baru (data mock sinkron, konsisten pola section lain).
- **Empty:** `TableEmpty`/`EmptyState` untuk seluruh list baru (Documents/Messages kosong sesuai filter vs benar-benar kosong dibedakan pesannya; Notifications kosong "Tidak ada notifikasi").
- **Error/Validation:** Dialog Upload Document/New Message/Kirim Pesan — tombol submit disabled sampai field wajib terisi (entityId/name/category untuk Document; entityId/body untuk Message), konsisten pola disabled-button sejak Section 05.
- **Not-found:** Tidak berubah dari section lain — diverifikasi ulang tetap benar (`/nonexistent-route-xyz` tetap 200 dengan konten 404).
- **Unauthorized:** `RoleAccessState` untuk `!canView('documents')` di `/documents`. Aksi mutasi (Upload/New Message/Mark All Read) digerbangi `canManage('documents')` untuk Upload/Compose — Mark All Read tersedia untuk seluruh user yang punya notifikasi (bukan digerbangi modul, karena notifikasi bersifat personal per-user, bukan resource modul).

## 12. Role Behavior

`canView('documents')` — gerbang akses `/documents`. `canManage('documents')` — gerbang aksi Upload Document/New Message (dialog hanya muncul untuk role dengan rank ≥ MANAGE: `super-admin`/`management`/`project-manager`/`operations`). Notifikasi (`getNotificationsForUser`/mark-read/remove) TIDAK digerbangi modul `documents` — setiap user (termasuk `client`/`supplier`) yang login tetap bisa melihat notifikasi MILIKNYA SENDIRI lewat bell popover (personal, bukan resource modul-level) — konsisten prinsip "setiap user berhak tahu notifikasi dirinya", TIDAK melanggar sanitasi karena `Notification.userId` sudah membatasi ke satu user. `client`/`supplier` `NONE` di modul `documents` (tidak bisa akses `/documents` top-level) — tetap memakai `getDocumentsByParty`/portal existing untuk dokumen, TIDAK diperluas Section 21 (didokumentasikan sebagai deferred, bagian 17).

## 13. Validation Commands dan Hasilnya

- `npx nuxi prepare` — **sukses**.
- `npm run build` — **sukses (exit 0)**, tanpa error TypeScript baru (hanya warning Tailwind ambiguous-class pre-existing dan deprecation warning Node dari dependency, tidak terkait perubahan section ini).
- `npx vitest run` — tidak dijalankan ulang terpisah (pre-existing "No test files found", Q8, tidak berubah sejak section-section sebelumnya).
- `npx nuxi typecheck` — tidak dijalankan (pre-existing gagal, `vue-tsc` tidak terpasang, Q8).
- Lint — tidak tersedia (Q8, pre-existing).
- **Smoke test HTTP** (curl, dev server `npm run dev` port 8080 — server existing dari sesi sebelumnya dipakai ulang, file baru otomatis termuat via HMR Nuxt dev, dikonfirmasi dengan curl langsung ke `/documents` sebelum sweep penuh): `/`, `/documents`, `/documents?tab=messages`, `/documents?tab=notifications`, `/projects/PRJ-101` s/d `PRJ-104` (`?tab=documents`/`?tab=activity-changes`), `/changes`, `/changes?tab=cancellations`, `/bookings`, `/bookings/exceptions`, `/procurement`, `/finance`, `/finance/invoices`, `/finance/notes`, `/finance/reconciliation`, `/admin/roles`, `/ticketing`, `/accommodation`, `/transportation`, `/mice`, `/crm/opportunities`, `/customer-journey`, `/client`, `/supplier`, `/nonexistent-route-xyz` — **seluruhnya HTTP 200**.
- **Smoke test konten** (curl+grep): `/documents` menampilkan judul "Documents & Communication" (HTML entity `&amp;`) dan dokumen expired "Kontrak Vendor PT ABC" dengan badge "Expired 1..." (`DOC-C011`); `/projects/PRJ-101?tab=documents` menampilkan dokumen legacy ("Kontrak Kerjasama PRJ-101") DAN dokumen baru ("E-Ticket FLT-1011") dalam satu tabel union; `/projects/PRJ-101?tab=activity-changes` menampilkan SectionCard "Communication" DAN "Unified Activity Timeline"; sidebar nav SSR menampilkan menu "Documents & Communication" dengan 3 child link (Documents/Messages/Notifications).
- Tidak ditemukan string "Internal Server Error"/"TypeError"/"is not defined"/"ReferenceError" di HTML manapun.
- **Verifikasi interaktif** (klik bell popover/mark-as-read/mark-all-read/kirim pesan/upload dokumen/eskalasi memicu notifikasi) **tidak dilakukan headless** — tidak ada tool browser headless (keterbatasan konsisten sejak Section 06). Dimitigasi lewat code review ketat terhadap seluruh 4 hook (lokasi baris persis, guard duplikasi di `updateProjectTask`) dan smoke test konten SSR pada state awal fixture (notifikasi seed `NOT-001` s.d. `NOT-009` sudah memverifikasi rendering read/unread/8-type tanpa perlu memicu hook runtime).

## 14. Regression Checks

Section 14 lama/Prompt 19 (`ProjectDocument`/`getDocumentsByProject`/`getDocumentsByParty` — shape TIDAK berubah, `getDocumentsForProject` murni union tambahan, widget Overview "recentDocuments" `/projects/[id]` dikonfirmasi masih memakai selector lama apa adanya via code review), Section 17 (`VendorDocument` — TIDAK disentuh sama sekali, `/vendors/[id]` tab Documents tidak terpengaruh), Section 19 (`escalateIncident`/`approveChangeRequest`/`rejectChangeRequest` — guard/transition-map/reason-wajib TIDAK berubah, `/changes/incidents/INC-001`/`/changes/[id]` dikonfirmasi HTTP 200 tanpa perubahan konten selain efek samping notifikasi baru yang tidak terlihat di SSR non-personal), Section 09 lama (`createProjectTask`/`updateProjectTask` — signature TIDAK berubah, tab "Tasks" `/projects/[id]` dikonfirmasi HTTP 200, `handleTaskStatusChange` [hanya kirim `{ status }`] dikonfirmasi via code review TIDAK memicu hook assignment baru), starter-template boilerplate (`NotificationPanel.vue`/`TopHeader.vue` — kontrak `defineExpose({ unreadCount })` dipertahankan, `TopHeader.vue` tidak disentuh sama sekali) — seluruhnya diverifikasi tidak beregresi.

## 15. Cross-Section Impact

`docs/mockup-change-impact-log.md` CI-051 — daftar lengkap seluruh titik sentuh lintas-section: 4 hook `pushNotification` (`sendMessage` internal ke Section 21 sendiri; `escalateIncident`/`approveChangeRequest`/`rejectChangeRequest` Section 19 LOCKED, satu baris aditif tiap fungsi; `createProjectTask`/`updateProjectTask` Section 09 lama LOCKED, satu-dua baris aditif dengan guard anti-duplikasi), rewire `NotificationPanel.vue` (aktivasi boilerplate mati, `TopHeader.vue` tidak disentuh), extension tab Documents/Activity & Changes Project Detail (Section 09/14 lama), nav/roles/ModuleKey (Section 02 lama). Seluruh titik sentuh bersifat aditif/regression-tested, dikonfirmasi via smoke test bagian 13.

## 16. Review URLs

Tidak tersedia — lingkungan pengembangan lokal saja (`npm run dev`, port 8080, tidak ada deployment publik). Dev server sudah **dihentikan** (`taskkill`) setelah smoke test selesai, sesuai instruksi validasi.

## 17. Known Issues dan Deferred Work

- **Q8 (tooling lint/typecheck/test) masih terbuka** — **21 section berturut-turut** (06–21) berjalan tanpa validasi otomatis penuh.
- **Versi client-safe/supplier-safe Unified Activity Timeline di Portal DIDEFER** — `getUnifiedActivityTimeline` sudah generik dan mendukung `viewerAccessLevel: 'client'`/`'supplier'` (parameter sudah ada, filter `internalOnly` sudah diterapkan di level selector), tapi belum ada pemanggilan tambahan di `/client/project-orders/[id]` atau `/supplier/service-orders/[id]` — diprioritaskan ke internal-view (must-have) karena keterbatasan scope waktu section ini, dicatat eksplisit sebagai stretch goal yang tersisa, BUKAN keterbatasan arsitektur (tinggal 1 pemanggilan tambahan + 1 SectionCard di masing-masing halaman portal).
- Email/WhatsApp delivery status (`Message.deliveryStatus`/`deliveryChannel`) **TETAP simulasi mock murni selamanya** sesuai protokol — batas permanen, bukan gap.
- Verifikasi interaktif (klik-demo seluruh aksi baru) tidak dilakukan headless (keterbatasan tooling lingkungan, konsisten sejak Section 06).
- Deviasi kecil dari brief (didokumentasikan penuh di D-078/CI-051): brief menyebut approx. "Section 12's task-assignment mutator" untuk hook #4 — verifikasi kode menemukan fungsi sesungguhnya adalah `createProjectTask`/`updateProjectTask` milik Section 09 lama (Section 12 hanya menambah field `isBlocked`/`blockedReason` pada `ProjectTask` yang sudah ada, tidak punya mutator create/update sendiri).

## 18. Protection Notes untuk Section Berikutnya

- `Document`/`Message`/`Notification`/`UnifiedTimelineEntry` (D-078) kini LOCKED — `ProjectDocument`/`getDocumentsByProject`/`getDocumentsByParty` (Section 14 lama) dan `VendorDocument` (Section 17) TETAP TIDAK BOLEH diubah shape-nya untuk kebutuhan Section 21 apa pun; gunakan `getDocumentsForProject` (union) atau `Document` entitas baru untuk kebutuhan dokumen terstruktur baru.
- `Document.previewRoute` HANYA boleh menaut ke route preview yang SUDAH ADA dan diverifikasi — JANGAN membuat generator dokumen baru atau route preview fiktif untuk kebutuhan section berikutnya.
- `pushNotification` HANYA dipanggil dari 4 hook yang sudah didaftar di CI-051 — bila section berikutnya butuh notification-push tambahan (mis. Section 22 Dashboards/Activity Center), tambahkan hook baru secara EKSPLISIT dan DICATAT (pola sama CI-051), JANGAN menyebar `pushNotification` ke banyak mutator sekaligus tanpa dokumentasi.
- `NotificationPanel.vue`/`TopHeader.vue` — kontrak `defineExpose({ unreadCount })` WAJIB dipertahankan bila section berikutnya menyentuh salah satunya.
- `/documents?tab=notifications` TETAP SATU-SATUNYA tujuan "View all notifications" — JANGAN membuat halaman `/notifications` terpisah yang divergen.
- Versi client-safe/supplier-safe Unified Activity Timeline di Portal — DIDEFER, bukan diblokir. Section 22 atau section Portal manapun berikutnya dapat menambahkannya sebagai perluasan aditif kecil (`getUnifiedActivityTimeline(entityType, entityId, 'client'|'supplier')` sudah siap dipanggil).

## 19. Recommended Next Section

Section 22 — Dashboards, Reports, Lead Recap dan Activity Center (`prompts/SECTION_22_*.md` atau nama serupa), berbasis urutan roadmap literal. Tidak dieksekusi otomatis — menunggu perintah user.
