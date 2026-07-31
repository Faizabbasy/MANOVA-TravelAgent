# Section Report — Section 12: Itinerary, Operations, Tasks dan Readiness

**Status:** COMPLETED

Dikerjakan berdasarkan `prompts/SECTION_12_Itinerary_Operations_Tasks_Readiness.md`. Section ketiga belas roadmap Section 00–24 baru, dijalankan setelah Section 11 (Traveler dan Travel Documents, COMPLETED).

---

## 1. Section Objective dan Scope

"Implementasikan operational command center." Wajib: Day-by-day itinerary; Timezone-aware schedule; Internal vs client-shared itinerary; Tasks, checklist, owner, deadline, blocker, dependency; Service readiness matrix; Departure readiness gates; Run sheet, contacts, emergency info; Attention/exception queue; On-trip updates dan shift notes mock; Calendar/timeline views. Acceptance: PM dan Operations dapat membawa project dari Planning sampai On Trip melalui frontend.

## 2. Source Documents yang Dibaca

`prompts/SECTION_12_Itinerary_Operations_Tasks_Readiness.md`, `prompts/01-PROTOKOL WAJIB — CONTINUITY, DOKUMENTASI PER SECTION, DAN PERLINDUNGAN HASIL.md`, `CLAUDE.md`, seluruh `docs/mockup-*.md`, `docs/frontend-*.md`, `docs/mockup-section-reports/section-00-*.md` s/d `section-11-*.md` (termasuk `section-12-itinerary-operations.md`, laporan Section 12 SKEMA LAMA), source code aktual (`app/types/project.ts`, `app/types/activity.ts`, `app/data/index.ts`, `app/data/projects.ts`, `app/data/activity.ts`, `app/pages/projects/[id]/index.vue`, `app/pages/client/project-orders/[id]/index.vue`, `app/pages/crm/opportunities/[id]/quotation-preview.vue` dan `app/pages/projects/[id]/manifest-preview.vue` sebagai pola print-preview reference), `git status`, `git log`.

## 3. Existing Implementation yang Diperiksa

`git status` menunjukkan Section 06–11 masih uncommitted (belum di-commit user, dicatat apa adanya, tidak diganggu). `docs/frontend-known-issues.md` bagian 10 dan `docs/frontend-implementation-roadmap.md` baris 12 menandai section ini `PARTIAL` — "Readiness checklist/matrix terpisah, departure countdown/alert eksplisit, run sheet" belum ada.

Audit langsung kode mengonfirmasi Day-by-day itinerary (`ItineraryItem`, tab "Itinerary & Services") dan Tasks (owner/deadline/dependency/milestone) SUDAH COMPLETED sejak Section 12 lama (Prompt 12) dan Section 09 (roadmap baru) — `docs/mockup-section-reports/section-12-itinerary-operations.md` dan `section-09-project-order-handover.md`. Tidak ada mutator create/update pada `ItineraryItem` (read-only murni, disengaja sejak Section 12 lama — di luar scope literal CRUD).

Gap konkret yang ditemukan (belum ada di manapun): timezone label pada itinerary; distinction internal vs client-shared (Client Portal menampilkan seluruh itinerary tanpa filter apa pun); task blocker (tidak ada konsep "blocked", hanya `status`); service readiness matrix (agregat lintas-tipe-layanan); departure readiness gate (kombinasi sinyal traveler/service/task/risk/invoice); run sheet/contacts/emergency info (tidak ada halaman print-friendly operasional, berbeda dari manifest Section 11 yang fokus data traveler); attention/exception queue (tidak ada agregator lintas-tab); on-trip updates/shift notes (tidak ada entitas/UI); calendar/timeline view (hanya list per-tanggal, tidak ada alternatif visual).

## 4. Decisions yang Digunakan

D-069 (`docs/mockup-design-decisions.md`, baru) — Field itinerary/task baru aditif; readiness gate/matrix derivasi murni dan ADVISORY (tidak memblokir transisi status, pola sama Closure Checklist D-066); `ShiftNote` entitas baru terpisah dari `ActivityEntry`; run sheet mengikuti pola print-preview `quotation-preview.vue`/`manifest-preview.vue` (D-062/D-068); timeline view murni CSS tanpa library baru.

## 5. Implementation Summary

**Timezone-aware schedule** — `ItineraryItem.timezone` (baru, label teks IANA mis. "Asia/Manila") ditampilkan berdampingan `time` di Daily Itinerary dan run sheet. Backfill: seluruh 17 item existing (Asia/Jakarta untuk keberangkatan dari Jakarta, destinasi masing-masing untuk item lain).

**Internal vs client-shared itinerary** — `ItineraryItem.visibleToClient` (baru, default `true` bila kosong). `getClientVisibleItineraryItems` (selector baru) menjadi SATU-SATUNYA titik filter yang dipakai `/client/project-orders/[id]` (menggantikan `getItineraryItems` mentah). Toggle "Jadikan Internal"/"Tampilkan ke Client" per item di halaman internal (`canManageOperations` — PM/Operations/Super Admin), badge "Internal Only" untuk item yang disembunyikan. 3 item baru diseed sebagai contoh nyata (`ITIN-1015`/`1026`/`1037`).

**Tasks, checklist, owner, deadline, blocker, dependency** — `ProjectTask.isBlocked`/`blockedReason` (baru, aditif terhadap `status` LOCKED). Dialog "Blokir" (alasan wajib), tombol "Buka Blokir" (langsung, tanpa dialog). Badge "Blocked" + teks alasan di baris task. Owner/deadline/dependency sudah ada sejak Section 09, tidak diubah.

**Service readiness matrix** — `getServiceReadinessMatrix(projectId)` (baru, derivasi murni dari `PROJECT_SERVICES`, tipe layanan data-driven bukan dari `project.serviceScope`). SectionCard "Service Readiness Matrix" (tabel: tipe/total/confirmed/persentase) di tab Itinerary & Services.

**Departure readiness gates** — `getDepartureReadiness(projectId)` (baru, derivasi) mengagregasi `getTravelerReadiness` (Section 11), `getServiceReadinessMatrix`, blocked tasks, open risks, outstanding invoices — menghasilkan `isReady`/`blockingReasons[]`/`daysUntilDeparture`. SectionCard "Departure Readiness Gate" (badge Ready/Belum Siap, countdown H-, 4 stat tile, daftar alasan belum terpenuhi). **Bersifat ADVISORY** — tidak menggerbangi `updateProjectStatus` manapun.

**Run sheet, contacts, emergency info** — `/projects/[id]/run-sheet-preview` (baru), `layout: false`, `window.print()` — pola identik `quotation-preview.vue`/`manifest-preview.vue`. Menampilkan jadwal harian, team contacts (`teamUserIds`→`USERS`), vendor contacts (`getVendorContacts` per service), dan emergency info traveler (dengan masking sensitive value, konsisten D-068).

**Attention/exception queue** — `getProjectAttentionQueue(projectId)` (baru, derivasi) mengagregasi task blocked/overdue, service changed, risk open, traveler dokumen kurang, invoice overdue — masing-masing item membawa `tab` tujuan. SectionCard "Attention / Exception Queue" — klik item langsung pindah ke tab terkait (`activeTab.value = item.tab`).

**On-trip updates dan shift notes mock** — `ShiftNote` (entitas baru, `app/types/activity.ts`) — id/projectId/authorId/shift (pagi/siang/malam)/note/createdAt. `getShiftNotes`/`createShiftNote` (baru). SectionCard "On-Trip Updates / Shift Notes" dengan dialog tambah catatan (`canManageOperations`). Diseed 2 baris pada PRJ-103 (satu-satunya project `in-progress` pada tanggal referensi demo).

**Calendar/timeline views** — toggle "List"/"Timeline" pada SectionCard Daily Itinerary — data identik, mode Timeline menambahkan garis vertikal + dot marker per item (CSS murni, `before:` pseudo-element Tailwind), bukan komponen calendar/library baru.

## 6. Routes

1 route baru: `/projects/[id]/run-sheet-preview`. Tidak ada route existing yang di-rename/dihapus. `/projects/[id]` (tab Itinerary & Services dan Tasks) dan `/client/project-orders/[id]` (tab Itinerary) diperkaya pada route yang sama.

## 7. Files Created, Changed, dan Removed

**Created:**
- `app/pages/projects/[id]/run-sheet-preview.vue`
- `docs/mockup-section-reports/section-12-itinerary-operations-readiness.md` (laporan ini)

**Changed:**
- `app/types/project.ts` (`ItineraryItem` +`timezone`/`visibleToClient`)
- `app/types/activity.ts` (`ProjectTask` +`isBlocked`/`blockedReason`, `+ShiftNote`/`ShiftPeriod`)
- `app/data/index.ts` (+`updateItineraryItem`, `+getClientVisibleItineraryItems`, `+toggleTaskBlocked`, `+getServiceReadinessMatrix`/`ServiceReadinessRow`, `+getDepartureReadiness`/`DepartureReadinessSummary`, `+getProjectAttentionQueue`/`AttentionQueueItem`, `+getShiftNotes`/`createShiftNote`)
- `app/data/activity.ts` (`+SHIFT_NOTES`, `TSK-1021` di-backfill `isBlocked`/`blockedReason`)
- `app/data/projects.ts` (backfill `timezone` seluruh 17 `ItineraryItem`, +3 item internal-only baru)
- `app/pages/projects/[id]/index.vue` (tab Itinerary & Services +4 SectionCard baru + toggle timeline + toggle internal-only, tab Tasks +blocker UI + dialog)
- `app/pages/client/project-orders/[id]/index.vue` (`getItineraryItems` → `getClientVisibleItineraryItems`)
- `docs/mockup-design-decisions.md` (+D-069)
- `docs/mockup-change-impact-log.md` (+CI-042)
- `docs/mockup-data-scenarios.md` (+bagian 4o)
- `docs/frontend-module-map.md`, `docs/frontend-workflow-map.md`, `docs/frontend-implementation-roadmap.md`, `docs/frontend-known-issues.md`
- `docs/mockup-implementation-state.md`, `docs/mockup-progress.md` (+Entri 21), `docs/mockup-section-progress.md`
- `docs/mockup-section-reports/README.md`

**Removed:** Tidak ada.

## 8. Components Reused/Created

Reused sepenuhnya: `SectionCard`, `Table`/`TableHeader`/`TableBody`/`TableRow`/`TableHead`/`TableCell`, `Dialog`/`DialogTrigger`/`DialogContent`/`DialogHeader`/`DialogTitle`/`DialogDescription`/`DialogFooter`, `Button`, `Input`, `Label`, `StatusBadge`, `EmptyState`, `RoleAccessState`, `useToast`. Tidak ada shared component baru — halaman run-sheet-preview mengikuti pola `quotation-preview.vue`/`manifest-preview.vue` persis, timeline view murni utility class Tailwind.

## 9. Types/Constants/Fixtures/Mock State

`ItineraryItem` +2 field aditif (opsional). `ProjectTask` +2 field aditif (opsional). `+ShiftNote`/`ShiftPeriod` (entitas dan type baru). Fixture: 17 `ItineraryItem` existing diberi `timezone`, +3 item baru (`ITIN-1015`/`1026`/`1037`, internal-only), `TSK-1021` diberi `isBlocked`/`blockedReason`, +2 `ShiftNote` baru (`SFT-1031`/`1032`). Lihat `docs/mockup-data-scenarios.md` bagian 4o.

## 10. Responsive Behavior

Tidak ada pola baru — readiness tile memakai `grid-cols-2 sm:grid-cols-4` (konsisten pola readiness Section 11), toggle List/Timeline dan tabel matrix memakai komponen existing yang sudah responsive. Run sheet mengikuti pola print-responsive `manifest-preview.vue`.

## 11. States (Loading/Empty/Error/Unauthorized/Not-Found)

- `RoleAccessState` untuk `!canView('project')` (tidak berubah).
- Not-found: `run-sheet-preview.vue` menampilkan `EmptyState` "Project tidak ditemukan" (pola sama `manifest-preview.vue`/`quotation-preview.vue`).
- Attention Queue dan SectionCard Departure Readiness/Service Matrix hanya tampil bila ada data relevan (`v-if`) — tidak menampilkan card kosong yang membingungkan.
- Shift Notes: `EmptyState` "Belum ada shift note tercatat" bila kosong.
- Tombol aksi (toggle internal-only, blokir/buka blokir task, catat shift note) digerbangi `canManageOperations`/`canManageProjectOrder` — role lain read-only.

## 12. Role Behavior

**Baru:** `canManageOperations` (PM/Operations/Super Admin) — menggerbangi toggle internal-only itinerary dan create shift note, pola sama `SERVICE_TYPE_ROLE_MAP` existing ("PM/Operations/Super Admin mengelola SELURUH sub-section"). Task blocker digerbangi `canManageProjectOrder` existing (PM/Super Admin) — konsisten gate CRUD Tasks lainnya, TIDAK memperluas ke Operations (blocker adalah keputusan manajemen task, bukan operasional sub-domain harian). Departure Readiness Gate/Service Matrix/Attention Queue bersifat READ-ONLY untuk seluruh role yang `canView('project')` — tidak ada gerbang tulis karena murni presentasi derivasi.

## 13. Validation Commands dan Hasilnya

- `npx nuxi prepare` — **sukses**.
- `npm run build` — **sukses**.
- `npx nuxi typecheck` — gagal, `vue-tsc` belum terpasang (Q8, pre-existing gap, 12 section berturut-turut).
- `npm run lint` — tidak tersedia (Q8, pre-existing).
- `npx vitest run` — "No test files found" (pre-existing).
- **Smoke test HTTP** — `/projects/PRJ-101`/`102`/`103?tab=itinerary-services`, `/projects/PRJ-101`/`102?tab=tasks`, `/projects/PRJ-101/run-sheet-preview`, `/projects/PRJ-999/run-sheet-preview` (not-found), `/client/project-orders/PRJ-101`/`102?tab=itinerary`, plus regresi `/`, `/crm/opportunities`, `/crm/opportunities/OPP-009`, `/product-planning`, `/product-planning/cost-sheets/CS-003`, `/vendors`, `/finance`, `/admin/roles`, `/settings`, `/projects/PRJ-103/manifest-preview` — **seluruhnya HTTP 200**.
- **Smoke test konten** (curl+grep):
  - `/projects/PRJ-101?tab=itinerary-services` menampilkan "Ready to Depart", timezone "Asia/Jakarta"/"Asia/Manila", badge "Internal Only" (untuk `ITIN-1015`), "Departure Readiness Gate", "Service Readiness Matrix".
  - `/projects/PRJ-102?tab=itinerary-services` menampilkan "Belum Siap" dan Attention Queue berisi "...diblokir: Menunggu konfirmasi ketersediaan kamar Suite dari hotel".
  - `/projects/PRJ-102?tab=tasks` menampilkan badge "Blocked", tombol "Buka Blokir", dan teks alasan blokir.
  - `/projects/PRJ-103?tab=itinerary-services` menampilkan "On-Trip Updates"/"Shift Notes" dengan 2 catatan yang diseed (shift pagi dan siang).
  - `/client/project-orders/PRJ-102?tab=itinerary` dikonfirmasi TIDAK menampilkan "Serah Terima Room Block..." (item internal-only baru) TAPI tetap menampilkan "Corporate Gathering" (item lama) — filtering `visibleToClient` bekerja benar.
  - `/projects/PRJ-103/run-sheet-preview` menampilkan "RUN SHEET", "Team Contacts", "Vendor Contacts", "Emergency Info Traveler".
  - Regresi 10 route representatif lintas modul lain dikonfirmasi tidak berubah.
- **Verifikasi interaktif** (klik toggle internal-only, dialog blokir task, catat shift note, toggle List/Timeline, ganti role untuk membuktikan gate `canManageOperations`) **tidak dilakukan headless** — keterbatasan tooling konsisten sejak Section 06. Dimitigasi lewat code review ketat terhadap seluruh guard (`toggleTaskBlocked` menolak blokir tanpa alasan, `getClientVisibleItineraryItems` sebagai satu-satunya titik filter Client Portal) dan smoke test SSR konten yang membuktikan kalkulasi readiness/attention queue/filtering bekerja benar untuk 3 skenario project berbeda kondisi.

## 14. Regression

`app/pages/projects/[id]/index.vue` (dimiliki Section 12 lama/Section 09 — tab Itinerary & Services dan Tasks diperkaya, tab lain TIDAK disentuh, dikonfirmasi via smoke test `?tab=overview`/`?tab=travelers`/`?tab=finance` tidak berubah). `app/pages/client/project-orders/[id]/index.vue` (dimiliki Section 08 — hanya selector itinerary yang diganti, field/UI lain tidak disentuh). `isTravelerDocumentMissing`/`getTravelerReadiness` (Section 11) dipanggil apa adanya oleh `getDepartureReadiness`, tidak diubah. `updateProjectStatus`/`PROJECT_STATUS_TRANSITIONS` (Section 09/D-066) TIDAK disentuh — readiness gate murni advisory, dikonfirmasi tombol transisi status tetap berfungsi identik.

## 15. Cross-Section Impact

`docs/mockup-change-impact-log.md` CI-042 — filter itinerary Client Portal (Section 08), tab Itinerary & Services (Section 12 lama) dan Tasks (Section 09) diperkaya — seluruhnya aditif, regression-tested.

## 16. Known Issues dan Deferred Work

- Q8 (tooling lint/typecheck/test) tetap terbuka — 12 section berturut-turut.
- Halaman/dashboard dedicated per sub-domain (Ticketing/Accommodation/Transportation/MICE) TETAP di luar scope Section 12 — literal Wajib section ini tidak menyebutnya, tetap `KNOWN_GAP` milik Section 13–16.
- Departure Readiness Gate bersifat advisory (disengaja, D-069) — PM dapat mengabaikan status "Belum Siap" dan tetap mentransisikan status project; pemenuhan penuh sebagai hard gate adalah evolusi lanjutan bila dibutuhkan.
- Verifikasi interaktif tidak dilakukan headless (keterbatasan tooling, konsisten sejak Section 06).
- Timeline view murni visual (garis+dot), bukan calendar grid penuh dengan navigasi bulan — cukup untuk mendemokan konsep "calendar/timeline views" tanpa membangun komponen kalender kompleks baru.

## 17. Protection Notes untuk Section Berikutnya

`getDepartureReadiness`/`getServiceReadinessMatrix`/`getProjectAttentionQueue` (D-069) — TETAP derivasi murni dan ADVISORY; JANGAN dijadikan hard gate pada `updateProjectStatus` tanpa keputusan baru eksplisit (akan mengunci banyak skenario demo existing yang sengaja belum "siap"). `getClientVisibleItineraryItems` — SATU-SATUNYA selector yang boleh dipakai untuk menampilkan itinerary di halaman Client Portal manapun; jangan query `ITINERARY_ITEMS`/`getItineraryItems` langsung dari `app/pages/client/**`. `ShiftNote` TERPISAH dari `ActivityEntry` — jangan digabung meski keduanya sama-sama "log" (semantik approval vs operasional berbeda). `ProjectTask.isBlocked` independen dari `status` — task bisa `in-progress` dan `isBlocked: true` bersamaan, jangan diperlakukan sebagai status eksklusif.

## 18. Review URLs

Tidak ada deployment publik. Untuk review lokal: `npm run dev`, buka `http://localhost:8080/projects/PRJ-102?tab=itinerary-services` untuk melihat Departure Readiness Gate "Belum Siap" dan Attention Queue. Buka `http://localhost:8080/projects/PRJ-103?tab=itinerary-services` untuk melihat Shift Notes dan toggle Timeline. Buka `http://localhost:8080/projects/PRJ-103/run-sheet-preview` untuk melihat run sheet print preview. Buka `http://localhost:8080/client/project-orders/PRJ-102?tab=itinerary` untuk mengonfirmasi item internal tersaring.

## 19. Recommended Next Section

**Section 13 — Ticketing** (halaman dedicated, PNR/e-ticket mock, dashboard Ticketing tersendiri — saat ini role-only tanpa page dedicated, status PARTIAL), berbasis dependency (`docs/frontend-implementation-roadmap.md`) — menunggu perintah eksplisit user.
