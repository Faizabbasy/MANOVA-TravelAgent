# Section 09 — Opportunity Won to Project

**Status:** COMPLETED

Dikerjakan berdasarkan `prompts/11-PROMPT-9-OPPORTUNITY-WON-TO-PROJECT.md`, dijalankan lewat `prompts/99-RUN-CURRENT-SECTION.md` atas perintah user.

---

## 1. Section Objective dan Scope

Mengimplementasikan aksi "Approve Won" (Management/Super Admin) pada Opportunity berstatus WonRequested, beserta seluruh efek otomatisnya: permission check, confirmation dialog, requirement validation, transisi stage ke Won, pembuatan Project otomatis (party/client, contact, destination, date, service scope, traveler estimate, quotation, owner dibawa ke Project), activity log, success/error feedback, redirect ke Project Detail, duplicate prevention, dan mock persistence yang jujur.

## 2. Source Documents yang Dibaca

`prompts/01-PROTOKOL WAJIB — CONTINUITY, DOKUMENTASI PER SECTION, DAN PERLINDUNGAN HASIL.md`, `prompts/11-PROMPT-9-OPPORTUNITY-WON-TO-PROJECT.md`, `docs/mockup-implementation-state.md`, `docs/mockup-section-progress.md`, `docs/mockup-change-impact-log.md`, `docs/mockup-section-reports/section-07-crm-party.md` dan `section-08-opportunity-quotation.md`, `docs/route-and-role-matrix.md` (bagian 2 — Opportunity-to-Project Workflow, checklist LOCKED bagian 2.2; bagian 5), `docs/mockup-data-scenarios.md`.

## 3. Existing Implementation yang Diperiksa

`app/pages/crm/opportunities/[id]/index.vue` (stage stepper Section 08), `app/types/{opportunity,party,project}.ts`, `app/data/{opportunities,parties,projects,activity}.ts`, `app/composables/usePermissions.ts` (`canApprove` — belum pernah dipakai sebelum section ini), `app/pages/expenses.vue` (pola toast lokal). `git status`/`git log` diperiksa — commit terakhir "Create CRM PARTY" (Section 07); Section 08 belum di-commit, working tree berisi perubahan Section 08+09 sekaligus (dicatat, tidak memengaruhi akurasi laporan ini).

## 4. Decisions yang Digunakan

D-002/D-024 (Party model, transisi lifecycle otomatis saat Won), D-025 (model role Won dua-langkah — bagian approval final diimplementasikan di section ini), D-040 (jam demo tetap). Checklist efek Won `docs/route-and-role-matrix.md` bagian 2.2 (LOCKED) diikuti item per item — lihat bagian 7 untuk verifikasi eksplisit.

## 5. Implementation Summary dan User Flow

Pada Opportunity Detail (`/crm/opportunities/[id]`) di stage `won-requested`: role tanpa `canApprove('crm')` melihat teks "Menunggu approval Management/Super Admin"; role dengan `canApprove('crm')` (Management, Super Admin) melihat requirement validation terlebih dahulu — bila ada field wajib yang kosong (destinasi/tanggal/traveler estimate/quotation), tombol Approve tidak muncul, hanya kotak peringatan berisi daftar yang kurang. Bila lengkap, tombol "Approve Won" dan "Reject" muncul. Approve membuka dialog konfirmasi merangkum efek (Project baru, potensi perubahan lifecycle Party), lalu mengeksekusi seluruh checklist LOCKED sekaligus, menampilkan toast sukses, dan redirect ke Project Detail. Reject membuka dialog catatan, mengembalikan opportunity ke Negotiation.

**User flow yang bisa didemokan:** login Management atau Super Admin → buka `/crm/opportunities/OPP-005` (sudah di-seed pada stage Won-Requested) → lihat tombol Approve Won aktif (requirement lengkap) → klik → dialog konfirmasi menyebutkan destinasi Bali, 30 pax, dan PTY-004 akan menjadi Client → konfirmasi → toast "Project Berhasil Dibuat" → redirect ke `/projects/PRJ-104` (Project baru, Draft, tim berisi Sales asal) → cek `/crm/parties/PTY-004` → lifecycle kini Client, tab Projects muncul.

## 6. Routes

Tidak ada route baru. Interaksi di `/crm/opportunities/[id]` (Section 08); hasil di `/projects`/`/projects/[id]` (Section 05).

## 7. Files Created, Changed, dan Removed — Verifikasi Checklist LOCKED (bagian 2.2)

**Created:** `app/composables/useToast.ts`, `app/components/shared/ToastContainer.vue`.

**Changed:** `app/types/project.ts`, `app/data/projects.ts`, `app/data/activity.ts`, `app/data/opportunities.ts`, `app/data/index.ts`, `app/layouts/dashboard.vue`, `app/pages/crm/opportunities/[id]/index.vue`.

**Removed:** Tidak ada.

**Verifikasi checklist 8 item (docs bagian 2.2, LOCKED) — item per item:**

| # | Item Checklist | Status | Implementasi |
|---|---|---|---|
| 1 | Project otomatis dibuat, status Draft | ✅ | `approveOpportunityWon` push `Project` baru dengan `status: 'draft'` |
| 2 | `project.opportunityId` disimpan | ✅ | Diisi dari `opportunity.id` |
| 3 | `project.partyId` terhubung; lifecycle Prospect→Client | ✅ | Diisi dari `opportunity.partyId`; `party.lifecycleStatus` diflip bila masih `'prospect'` |
| 4 | Data dasar (judul, destinasi, tanggal, traveler estimate) disalin | ✅ | `name`/`destination`/`travelStartDate`/`travelEndDate`/`travelerCount` dari field Opportunity (Section 08) |
| 5 | Service scope awal dibawa | ✅ | `serviceScope` disalin langsung |
| 6 | Initial budget/quotation dibawa, `sourceQuotationId` disimpan | ✅ | `budgetIdr`/`quotationAmountIdr` = `quotation.amountIdr`; `sourceQuotationId` (field baru) = `quotation.id` |
| 7 | Activity log mencatat perubahan | ✅ | Entri `ACTIVITIES` baru: format persis "Project {kode} dibuat dari Opportunity {kode} (Won oleh {approver})" |
| 8 | User menerima feedback keberhasilan (toast + link) | ✅ | `showToast('Project Berhasil Dibuat', ...)` + `router.push('/projects/{id}')` |

**Field yang TIDAK eksplisit di checklist tapi dibutuhkan Project (didokumentasikan sebagai interpretasi, lihat `docs/route-and-role-matrix.md` bagian 2 catatan Section 09):** `ownerId` (default PM `USR-002`, Sales asal masuk `teamUserIds`), `characteristic` (default `'normal'`), `actualCostIdr` (mulai `0`).

## 8. Components Reused dan Created

**Reused:** `Dialog*`, `Button`, `Label`, `Input`, `SectionCard`.

**Created:** `ToastContainer.vue` (lihat CI-011) + `useToast()` composable.

## 9. Types, Constants, Fixtures, dan Mock State

`Project.sourceQuotationId` (baru, opsional). `PROJECTS`/`ACTIVITIES` kini `reactive()`. `OPP-005` di-seed ke `won-requested` (CI-012) agar section ini demonstrable out-of-the-box.

## 10. Responsive Behavior

Mengikuti pola Dialog/Button existing (Section 07/08), tidak ada elemen baru yang butuh penyesuaian layout khusus. Toast container `fixed top-5 right-5` — diadaptasi identik dari `expenses.vue`, sudah terbukti responsif di lingkungan yang sama.

## 11. Loading, Empty, Error, Not-Found, dan Unauthorized States

- **Loading:** Tidak ada simulasi baru — konsisten precedent.
- **Empty/Validation:** Kotak peringatan "Belum bisa di-approve — requirement berikut belum lengkap" dengan daftar spesifik, alih-alih tombol yang gagal senyap atau error tak jelas.
- **Error:** Toast `type: 'error'` untuk kegagalan (`approveOpportunityWon`/`rejectOpportunityWon` mengembalikan `undefined` — mis. race condition duplicate click, atau stage sudah berubah). Ini SATU-SATUNYA "error state tersimulasi" yang genuinely mungkin terjadi sejauh Section 05-09 (berbeda dari section lain yang mencatat "tidak ada sumber error" — di sini guard fungsi benar-benar bisa mengembalikan gagal).
- **Not-found:** Tidak berubah dari Section 08.
- **Unauthorized:** Tombol Approve/Reject tidak dirender sama sekali untuk role tanpa `canApprove('crm')` (Sales, PM, Operations-family, Finance, Viewer) — hanya teks netral "Menunggu approval".

## 12. Role Behavior

`canApprove('crm')` (helper generik `usePermissions()`, sudah ada sejak Section 05, pertama kali benar-benar dipakai di sini) — Management (`crm: APPROVE`) dan Super Admin (`crm: ADMIN`) lolos; Sales/PM/Operations-family/Finance/Viewer (semua `≤ MANAGE` atau `VIEW`) tidak. Ini BERBEDA dari pola `canManageOpportunity`/`canManageParty` (pengecualian sempit Sales+SuperAdmin dari Section 07/08) — di sini justru Management yang harus diikutsertakan, sesuai desain perannya sebagai approver.

## 13. Validation Commands dan Hasilnya

- `npx nuxi prepare` — sukses.
- `npm run build` — **sukses (exit 0)**.
- `npx vitest run` — "No test files found" (pre-existing).
- `npx nuxi typecheck` — gagal, `vue-tsc` tidak terpasang (Q8, pre-existing).
- Lint — tidak tersedia (Q8, pre-existing).
- Smoke test konten (curl + grep, mengikuti pelajaran Section 08 — bukan hanya status code):
  - `/crm/opportunities/OPP-005` → title dinamis benar, menampilkan "Won (Menunggu Approval)", "Approve Won", "Reject" (user default Super Admin, requirement OPP-005 lengkap).
  - `/crm/parties/PTY-004` → masih "Prospect" (kondisi sebelum approve).
  - `/projects` → masih hanya `PRJ-101/102/103` (belum ada `PRJ-104`, kondisi sebelum approve).
  - `/crm/opportunities/OPP-001`, `OPP-999` → regresi Section 08 tetap benar.
- **Verifikasi interaktif end-to-end (klik Approve → project tercipta → toast → redirect → party lifecycle berubah) TIDAK dapat dilakukan** — tidak ada tool browser headless di lingkungan eksekusi ini. Dimitigasi dengan:
  1. Code review baris-demi-baris `approveOpportunityWon` terhadap seluruh 8 item checklist LOCKED (bagian 7 tabel) — status ✅ untuk semua item berdasarkan pembacaan kode, bukan asumsi.
  2. Build sukses mengonfirmasi tidak ada error tipe/binding pada seluruh kode baru (Dialog bindings, computed, function calls).
  3. Kondisi *sebelum* aksi diverifikasi benar via curl (poin di atas) — memastikan setidaknya starting state sudah tepat untuk aksi tersebut dijalankan pengguna nyata.

Ini adalah keterbatasan tooling yang sama seperti Section 06-08, dicatat secara eksplisit — bukan diklaim sebagai "tervalidasi penuh" padahal belum.

## 14. Regression Checks

Section 07/08 routes (`/crm/prospects`, `/crm/clients`, `/crm/parties/[id]`, `/crm/opportunities`, `/crm/opportunities/[id]` untuk opportunity lain) diverifikasi tetap HTTP 200 dengan konten benar setelah perubahan `reactive()` pada `PROJECTS`/`ACTIVITIES`.

## 15. Cross-Section Impact

`docs/mockup-change-impact-log.md`: **CI-010** (Project/Activity fixture reactive + `sourceQuotationId`, milik Section 05), **CI-011** (toast diekstrak dari `expenses.vue`, milik Section 05/layout), **CI-012** (OPP-005 dimajukan ke `won-requested`, milik Section 08).

## 16. Review URLs

Tidak tersedia — lingkungan pengembangan lokal saja.

## 17. Known Issues dan Deferred Work

- **Q8 (tooling lint/typecheck/test) masih terbuka** — **lima section berturut-turut** (06–09) berjalan tanpa validasi otomatis penuh. **Sangat direkomendasikan** diselesaikan sebelum Section 10, terutama karena business logic di section ini (mutasi lintas 4 entitas: Opportunity, Project, Party, Activity dalam satu operasi) adalah yang paling kompleks sejauh ini dan paling diuntungkan oleh jaring pengaman typecheck/test.
- **Verifikasi interaktif end-to-end tidak dilakukan** (bagian 13) — keterbatasan tooling lingkungan, dimitigasi lewat code review ketat, bukan diklaim selesai tanpa dasar.
- `DEFAULT_PROJECT_OWNER_ID` (PM default `USR-002`) — keputusan sementara tanpa alur assignment PM manual; belum ada scope eksplisit untuk itu di section manapun sejauh ini.
- Model approval berjenjang berdasarkan nilai/kompleksitas (dipertimbangkan tapi ditolak di Prompt 3-E) tetap tidak diimplementasikan — konsisten dengan keputusan LOCKED D-025.

## 18. Protection Notes untuk Section Berikutnya

- **`approveOpportunityWon`/`rejectOpportunityWon` (`app/data/index.ts`) adalah satu-satunya jalur sah membuat Project dari Opportunity** — Section 10+ tidak boleh membuat jalur pembuatan Project paralel.
- **`useToast`/`ToastContainer` kini infrastruktur bersama** — section berikutnya yang butuh feedback sukses/gagal harus memakainya, bukan membangun toast lokal baru.
- `Project.sourceQuotationId` — Section 15 (Project Finance) kemungkinan akan memakainya untuk menautkan breakdown budget ke quotation asal.
- Project hasil konversi Won (`PRJ-104` dst.) akan berstatus `Draft` dengan tab-tab shell yang masih placeholder (Travelers/Itinerary/Vendors/Finance/Tasks/Documents/Activity & Changes hanya berisi Overview) — Section 10 (Project Core) dan seterusnya mengisi ini secara bertahap, konsisten dengan project existing (`PRJ-101/102/103`).
- Jangan mengubah `DEFAULT_PROJECT_OWNER_ID` secara diam-diam — bila Section 10+ membangun alur assignment PM nyata, catat sebagai cross-section impact terhadap Section 09.

## 19. Recommended Next Section

Section 10 — Project Core (`prompts/12-PROMPT-10-PROJECT-CORE.md`), dengan rekomendasi sangat kuat menyelesaikan Q8 terlebih dahulu — lima section berturut-turut telah berjalan tanpa validasi otomatis penuh. Tidak dieksekusi otomatis — menunggu perintah user.
