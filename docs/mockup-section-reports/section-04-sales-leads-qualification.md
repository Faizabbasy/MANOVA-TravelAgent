# Section Report — Section 04: Sales Leads dan Qualification

**Status:** COMPLETED

Dikerjakan berdasarkan `prompts/Section 04 — Sales Leads dan Qualification.md`, dijalankan lewat `prompts/99-RUN-CURRENT-SECTION.md` atas perintah user. Section kelima roadmap Section 00–24 baru, dijalankan setelah Section 03 (Public Lead Intake, COMPLETED).

---

## 1. Section Objective dan Scope

"Lengkapi workflow Sales end-to-end." Wajib: Leads Table/Kanban/Inbox; Lead right drawer (Overview/Qualification/Activities/Follow-ups); Create/edit/archive/reopen/merge suggestion; Qualification draft dan final (travel type, destination, period, traveler estimate, services, budget range, decision maker, urgency, expected close, notes, assigned AE); Qualify & Create Opportunity disabled bila requirement minimum belum lengkap; Lead→Opportunity idempotency; Activity dan follow-up history; Sales tidak membuat final quotation/approve/Mark as Won. Acceptance: Sales dapat menyelesaikan pekerjaan dari Lead masuk sampai handover ke AE tanpa workflow buntu.

## 2. Source Documents yang Dibaca

`prompts/Section 04 — Sales Leads dan Qualification.md`, `prompts/01-PROTOKOL-WAJIB.md`, `prompts/99-RUN-CURRENT-SECTION.md`, `CLAUDE.md`, seluruh `docs/mockup-*.md`, `docs/frontend-*.md`, `docs/mockup-section-reports/section-00-*.md` s/d `section-03-*.md`, source code aktual (`app/pages/customer-journey/leads/index.vue`, `app/pages/lead-intake/index.vue`, `app/data/index.ts`, `app/data/leads.ts`, `app/types/lead.ts`), `git status`.

## 3. Existing Implementation yang Diperiksa

Audit Section 00 (diverifikasi ulang langsung terhadap kode) mengonfirmasi mayoritas Wajib Section 04 **sudah COMPLETED sejak Prompt 20**: Leads Table/Kanban/Inbox (`viewMode` toggle), drawer 4-tab (Overview/Qualification/Activities/Follow-ups), form Qualification 13 field (draft via "Simpan Draft", final via gate `getLeadMissingQualification` sebelum "Qualify & Create Opportunity" aktif — seluruh field literal Wajib: travel type=`serviceCategory`, destination, period=`travelStartDate`/`travelEndDate`, traveler estimate, services=`serviceScope`, budget range, decision maker, urgency, expected close, notes=`qualificationNotes`, assigned AE=`handedOverTo`), idempotency (`lead.opportunityId` guard), activity/follow-up history, dan Sales tidak bisa quotation/approve/Mark as Won (permission gate existing). Ditemukan 3 gap konkret: (1) tidak ada aksi "Edit" untuk field kontak dasar (nama/company/source/phone/email) setelah Lead dibuat; (2) `archiveLead` satu arah, tidak ada "Reopen"; (3) tidak ada deteksi/mekanisme "merge suggestion" sama sekali di halaman internal (Section 03 baru membangun preview non-blocking di form PUBLIK, bukan di halaman internal Sales).

## 4. Decisions yang Digunakan

D-061 (`docs/mockup-design-decisions.md`, baru) — merge suggestion sebagai archive-dengan-referensi (bukan true field-merge), selector deteksi duplikat dipusatkan dan dipakai ulang lintas Section 03/04.

## 5. Implementation Summary

**Edit Lead** — dialog baru dipicu tombol "Edit Lead" di tab Overview (tampil bila `canManageLead && !archived`). Field identik dengan New Lead dialog (nama, company, source, phone, email), pre-filled dari `selectedLead`. Mutator baru `updateLeadContact` (`app/data/index.ts`).

**Reopen** — tombol baru di `SheetFooter`, tampil bila `canManageLead && selectedLead.archived`. Mutator baru `reopenLead` (kebalikan `archiveLead`, tidak menyentuh `stage`/data qualification).

**Merge Suggestion** — selector `getLeadDuplicateCandidates({phone, email, excludeLeadId})` (baru, `app/data/index.ts`) mencocokkan phone/email (trim, email case-insensitive) terhadap Lead lain yang belum archived. Dipakai di 3 tempat:
1. New Lead dialog — info non-blocking saat mengisi phone/email (pola sama `/lead-intake`).
2. Table view — badge "Possible Duplicate" per baris.
3. Drawer Overview tab — panel "Lead Serupa Terdeteksi" berisi daftar kandidat + tombol "Tandai sebagai Duplikat" per kandidat, membuka dialog konfirmasi, memanggil `mergeLeadAsDuplicate(currentLeadId, candidateId, actorId)` — mengarsipkan lead saat ini dengan 2 `LeadActivity` (di lead yang diarsipkan dan di lead canonical) sebagai jejak referensi.

**Refactor `/lead-intake` (Section 03)** — computed `duplicateMatch` sebelumnya memakai `LEADS.find(...)` inline, sekarang memanggil `getLeadDuplicateCandidates({phone, email})[0]` — perilaku identik, sumber logic terpusat (CI-033).

**Fixture `LED-011`** — Lead baru ("Yuni K. Kartika") dengan email persis sama dengan `LED-007` ("Yuni Kartika") — mendemokan seluruh fitur di atas tanpa mengubah satu pun nilai field Lead lama.

## 6. Routes

Tidak ada route baru. `/customer-journey/leads` mendapat fitur baru (tetap 1 route). `/lead-intake` di-refactor internal (perilaku tidak berubah dari sisi user).

## 7. Files Created, Changed, dan Removed

**Created:**
- `docs/mockup-section-reports/section-04-sales-leads-qualification.md` (laporan ini)

**Changed:**
- `app/data/index.ts` (+`reopenLead`, +`LeadContactInput`/`updateLeadContact`, +`getLeadDuplicateCandidates`, +`mergeLeadAsDuplicate`)
- `app/pages/customer-journey/leads/index.vue` (+Edit Lead dialog, +Reopen button, +merge suggestion panel/dialog, +duplicate hint New Lead dialog, +badge Table view)
- `app/pages/lead-intake/index.vue` (refactor `duplicateMatch`)
- `app/data/leads.ts` (+`LED-011`)
- `docs/mockup-design-decisions.md` (+D-061)
- `docs/mockup-change-impact-log.md` (+CI-033)
- `docs/mockup-data-scenarios.md` (+4l, update total Lead 10→11)
- `docs/frontend-module-map.md`, `docs/frontend-workflow-map.md`, `docs/frontend-implementation-roadmap.md`, `docs/frontend-known-issues.md`
- `docs/mockup-implementation-state.md`, `docs/mockup-progress.md`, `docs/mockup-section-progress.md`
- `docs/mockup-section-reports/README.md`

**Removed:** Tidak ada.

## 8. Components Reused/Created

Reused sepenuhnya: `Dialog`/`DialogTrigger`/`DialogContent`/`DialogHeader`/`DialogTitle`/`DialogDescription`/`DialogFooter`, `SectionCard`, `StatusBadge`, `Button`, `Input`, `Label`. Tidak ada shared component baru.

## 9. Types/Constants/Fixtures/Mock State

**Tidak ada perubahan shape type** — `LeadContactInput` (interface baru untuk input mutator) hanya subset opsional field `Lead` existing. 1 fixture baru (`LED-011`), tidak ada fixture lama yang diubah nilainya.

## 10. Responsive Behavior

Tidak berubah — dialog/panel baru memakai komponen existing yang sudah responsive.

## 11. States (Loading/Empty/Error/Unauthorized/Not-Found)

- Panel "Lead Serupa Terdeteksi" hanya tampil bila `selectedLeadDuplicates.length > 0` (tidak ada empty state eksplisit — cukup tidak render panel).
- Tombol "Edit Lead"/"Reopen"/"Tandai sebagai Duplikat" seluruhnya digerbangi `canManageLead` (narrow role exception existing, tidak diubah — Sales/AE/Super Admin).
- Dialog konfirmasi merge menampilkan nama+ID kedua lead sebelum eksekusi (mencegah salah klik).

## 12. Role Behavior

Tidak ada perubahan role/permission. Seluruh aksi baru memakai `canManageLead` yang SAMA PERSIS (tidak diubah) dengan aksi existing (Archive, Qualify, dst.) — Sales, Account Executive, Super Admin.

## 13. Validation Commands dan Hasilnya

- `npx nuxi prepare` — **sukses**.
- `npm run build` — **sukses** (2x run, sebelum dan sesudah penambahan fixture `LED-011`).
- `npx vitest run` — "No test files found" (pre-existing, Q8).
- **Smoke test HTTP** — ~25 route (baru+existing representatif, termasuk `/lead-intake`, `/customer-journey/leads`, `/customer-journey/lead-sources`, seluruh route Section 00–03 dan Prompt 19/20) — **seluruhnya HTTP 200**.
- **Smoke test konten:**
  - `/customer-journey/leads` menampilkan badge "Possible Duplicate" 2× (baris `LED-007` dan `LED-011`, simetris — dikonfirmasi via curl).
  - `/customer-journey/lead-sources` menampilkan Total Leads **11** (naik dari 10), Qualified/Opportunities Created/Won tetap **3/2/1** (tidak terpengaruh, `LED-011` berstage `new`).
  - Tidak ditemukan string "Internal Server Error"/"TypeError"/"is not defined" di HTML manapun yang diuji.
- **Verifikasi interaktif** (klik "Edit Lead"/"Reopen"/"Tandai sebagai Duplikat", isi form New Lead dengan phone/email yang sudah ada) **tidak dilakukan headless** — keterbatasan tooling konsisten sejak Section 06 lama. Dimitigasi lewat code review ketat terhadap mutator baru (pola identik mutator Lead existing yang sudah tervalidasi Prompt 20) dan smoke test SSR konten (badge, angka Lead Source Recap) yang membuktikan data/selector bekerja benar di level render.

## 14. Regression

`app/pages/lead-intake/index.vue` (Section 03, baru COMPLETED) disentuh via refactor pure (CI-033) — perilaku diverifikasi identik (smoke test tetap 200, form tetap render dengan query UTM). Tidak ada route/halaman lain yang tersentuh. Seluruh route existing representatif tetap HTTP 200 tanpa perubahan konten yang tidak diharapkan.

## 15. Cross-Section Impact

`docs/mockup-change-impact-log.md` CI-033 (`/lead-intake`, Section 03) — pure refactor, regression-tested, tidak mengubah perilaku dari sisi user.

## 16. Known Issues dan Deferred Work

- Merge suggestion TIDAK melakukan true field-merge (gabung field/activity dari 2 lead jadi 1) — dicatat eksplisit sebagai simplifikasi (D-061), bukan gap tersembunyi. Evolusi lanjutan (bila dibutuhkan) adalah scope terpisah.
- Verifikasi interaktif tidak dilakukan headless (keterbatasan tooling, konsisten sejak Section 06 lama).
- Q8 (tooling) tetap terbuka, tidak berubah.
- Gap Section 05 (Quotation duplicate/compare/send-mock/withdraw/PDF preview) belum dikerjakan — di luar scope Section 04.

## 17. Protection Notes untuk Section Berikutnya

Section 05 (Account Executive Opportunity dan Quotation) dapat mereuse pola `getLeadDuplicateCandidates`/archive-dengan-referensi bila butuh mekanisme serupa untuk Quotation (mis. "duplicate quotation" suggestion) — bukan kewajiban, hanya opsi konsisten. Jangan mengubah `getLeadDuplicateCandidates`/`mergeLeadAsDuplicate` tanpa memeriksa dampaknya ke `/lead-intake` (Section 03) dan `/customer-journey/leads` (Section 04) — dua konsumen aktif sejak section ini.

## 18. Review URLs

Tidak ada deployment publik. Untuk review lokal: `npm run dev`, buka `http://localhost:8080/customer-journey/leads`, klik lead "Yuni Kartika" (`LED-007`) atau "Yuni K. Kartika" (`LED-011`) untuk melihat panel "Lead Serupa Terdeteksi" dan badge "Possible Duplicate" di Table view. Coba "Edit Lead" pada lead mana pun, dan "Archive" lalu "Reopen" untuk memverifikasi siklus penuh.

## 19. Recommended Next Section

**Section 05 — Account Executive Opportunity dan Quotation**, berbasis dependency (`docs/frontend-implementation-roadmap.md`) — menunggu perintah eksplisit user.
