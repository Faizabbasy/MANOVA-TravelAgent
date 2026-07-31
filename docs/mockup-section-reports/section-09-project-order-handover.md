# Section Report — Section 09: Project Order dan Handover

**Status:** COMPLETED

Dikerjakan berdasarkan `prompts/SECTION_09_Project_Order_Handover.md`. Section kesepuluh roadmap Section 00–24 baru, dijalankan setelah Section 08 (Client Portal, COMPLETED).

---

## 1. Section Objective dan Scope

"Lengkapi Project Order frontend." Wajib: Project Order list/detail; Source Opportunity dan approved Quotation; AE Account Owner, PM Operational Owner; AE-to-PM handover checklist; PM Accept/Return Handover dengan reason; Team assignment dan role responsibilities; Milestones, tasks, dependencies, documents, risks, activity; Status (10 nilai: Created/Handover Pending/Planning/Confirmed/Ready/In Progress/Completed/Closed/On Hold/Cancelled); Transition guards dan visible reason; Closure checklist shell untuk dipenuhi section akhir. Acceptance: PM dapat menerima handover dan memulai planning tanpa kehilangan data komersial.

## 2. Source Documents yang Dibaca

`prompts/SECTION_09_Project_Order_Handover.md`, `prompts/01-PROTOKOL WAJIB — CONTINUITY, DOKUMENTASI PER SECTION, DAN PERLINDUNGAN HASIL.md`, `CLAUDE.md`, seluruh `docs/mockup-*.md`, `docs/frontend-*.md`, `docs/mockup-open-questions.md` Q16, `docs/mockup-section-reports/section-00-*.md` s/d `section-08-*.md`, source code aktual (`app/pages/projects/[id]/index.vue`, `app/types/project.ts`, `app/types/activity.ts`, `app/data/index.ts`, `app/data/projects.ts`, `app/data/activity.ts`), `git status`, `git log`.

## 3. Existing Implementation yang Diperiksa

`git status` menunjukkan Section 06/07/08 masih uncommitted (belum di-commit user, dicatat apa adanya). Q16 (`docs/mockup-open-questions.md`) sudah eksplisit menandai section ini sebagai blocking sebelum dikerjakan, dengan rekomendasi jelas (derivasi aditif, pola D-053/D-056) — diikuti persis.

Audit langsung kode `app/pages/projects/[id]/index.vue` (shell 8-tab, sudah COMPLETED sejak Section 10 lama/Prompt 5) menemukan:
- **`project.status` TIDAK PERNAH punya mutator** — hanya di-set sekali saat `approveOpportunityWon` (selalu `'draft'`) dan sejak itu statis selamanya, meski `PROJECT_STATUSES` dipakai luas untuk tampilan (Dashboard/Reports/Customer Journey/Project list). Fixture `PRJ-101`/`102`/`103` memang menunjukkan nilai berbeda (`confirmed`/`planning`/`in-progress`) — dikonfirmasi ini hasil hand-edit statis di fixture, BUKAN hasil transisi UI (tidak ada satu baris kode pun yang memanggil `project.status = ...` selain di `approveOpportunityWon`).
- **`teamUserIds` tanpa mutator** — field sudah ada sejak Foundation, ditampilkan sebagai badge di tab Overview, tapi tidak ada cara menambah/menghapus anggota.
- **Tasks tab read-only murni** — hanya `<li>{{ task.title }}</li>` + status badge, tidak ada create/edit sama sekali, `dueAt` (sudah ada di type sejak Foundation) tidak pernah ditampilkan.
- **Tidak ada konsep Milestone/Dependency/Risk** di model data manapun.
- **Bug kecil**: link "Project ini berasal dari opportunity {{ id }}" mengarah ke `/crm/opportunities` (list statis), bukan `/crm/opportunities/{{ id }}` (detail spesifik) — `project.opportunityId` tidak dipakai sama sekali di URL.

**Tidak ada gap** pada: Project Order list/detail (sudah COMPLETED sejak Section 10 lama), Documents (Section 05/14 lama), Activity (Section 14 lama) — seluruhnya reuse apa adanya.

## 4. Decisions yang Digunakan

D-066 (`docs/mockup-design-decisions.md`, baru) — `ProjectOrderStatus` 10-nilai dirivasi dari `ProjectStatus` (LOCKED) + field handover/ready/closure baru; Risk sebagai entitas baru; Task diperluas untuk milestone/dependency (bukan entitas paralel).

## 5. Implementation Summary

**`ProjectOrderStatus` (10 nilai)** — `getProjectOrderStatus(project)` (`app/data/index.ts`) DIRIVASI murni (tidak ada field tersimpan untuk status itu sendiri): `cancelled`/`on-hold` langsung dari `ProjectStatus`; `completed` → `closed` bila `closedAt` terisi; `draft` → `handover-pending`/`planning` tergantung `handoverAcceptedAt`; `confirmed` → `ready` bila `readyAt` terisi; `in-progress`/`ongoing-trip` → `in-progress`; `'created'` secara praktik tidak pernah persisten (project selalu lahir sebagai `draft`). Badge `PageHeader` diganti dari `PROJECT_STATUSES` mentah ke hasil derivasi ini; status mentah tetap tampil sebagai "Status Internal" di `summaryMetadata` (traceability, tidak hilang).

**Handover** — `acceptProjectHandover(projectId, pmId)` dan `returnProjectHandover(projectId, reason, actorId)` (baru), guard hanya dari `status === 'draft'` dan belum accepted. Return TIDAK mengubah `project.status` (tetap Handover Pending) — murni mencatat alasan sebagai `ActivityEntry` visible. UI: SectionCard "Handover & Project Status" baru di tab Overview, tombol Accept/Return (dialog reason untuk Return), digerbangi `canManageProjectOrder` (PM/Super Admin, narrow exception baru — pola sama `canManageTravelers`).

**Source Opportunity dan approved Quotation** — teks "Project ini berasal dari opportunity" diperkaya menampilkan nilai quotation approved (`getQuotationByOpportunity`), link diperbaiki ke detail spesifik (bug fix, CI-039). AE (`sourceOpportunity.ownerId`) ditampilkan eksplisit berdampingan PM di badge Tim Project dan `summaryMetadata`.

**Status transition + guards + visible reason** — `PROJECT_STATUS_TRANSITIONS` (peta eksplisit forward-only + on-hold/cancelled dari hampir semua state, on-hold dapat resume ke 3 state). `updateProjectStatus(projectId, newStatus, actorId, reason?)` mewajibkan `reason` untuk `on-hold`/`cancelled`, dicatat sebagai `ActivityEntry` (bukan `isChange`, reuse tab Activity & Changes existing — "visible" terpenuhi tanpa komponen histori baru). UI: tombol per transisi valid (`getProjectStatusTransitions`) di SectionCard yang sama, dialog reason untuk transisi yang mewajibkannya.

**Team assignment** — `addProjectTeamMember`/`removeProjectTeamMember` (baru). UI: dialog "+ Tambah Anggota" (dropdown user selain PM/anggota existing) dan tombol "×" per anggota untuk menghapus, role user ditampilkan berdampingan nama.

**Milestones, tasks, dependencies** — `ProjectTask` +`isMilestone?`/`dependsOnTaskId?`/`assignedTo?` (aditif). `TASKS` (`app/data/activity.ts`) diupgrade `reactive()`. `createProjectTask`/`updateProjectTask` (baru). Tasks tab ditulis ulang total: dialog "+ Tambah Task" (judul, due date, assignee dropdown, depends-on dropdown dari task lain di project yang sama, checkbox milestone), list menampilkan badge "Milestone", due date, assignee, "Depends on: {judul task lain}", status dropdown per baris (langsung memanggil `updateProjectTask`).

**Risks** — `ProjectRisk` entitas BARU (`app/types/activity.ts`) — severity (`low`/`medium`/`high`)/status (`open`/`mitigated`/`closed`)/lifecycle sendiri, tidak dipaksakan ke `ActivityEntry`/`Opportunity.requirementDetail.riskNotes` yang scoped berbeda. `createProjectRisk`/`updateProjectRiskStatus` (baru). UI: SectionCard "Risks" baru, dialog catat risk baru, klik badge status untuk cycle Open→Mitigated→Closed→Open (PM/Super Admin saja).

**Closure checklist shell** — `ProjectClosureChecklist` (4 item boolean: financeSettled/documentsArchived/feedbackCollected/assetsReturned). `updateProjectClosureChecklist` (baru, merge patch). UI: SectionCard "Closure Checklist" dengan 4 `Checkbox`, TIDAK ada logic yang menghubungkannya ke transisi status Closed (disengaja, shell murni — pemenuhan penuh diserahkan ke Section 24 sesuai instruksi literal).

**Fixture** — `PRJ-101`/`102`/`103` (sudah lama berjalan) di-backfill `handoverAcceptedAt`/`handoverAcceptedBy`. `PRJ-104` (satu-satunya `draft`) SENGAJA dibiarkan tanpa handover — demonstrasi hidup "Handover Pending" + tombol Accept/Return tanpa fixture ID baru. 2 `ProjectRisk` diseed pada `PRJ-103` (complex/MICE 60 pax, paling wajar untuk risk tracking). `assignedTo`/`isMilestone`/`dependsOnTaskId` dibackfill aditif pada beberapa `ProjectTask` existing untuk mendemokan fitur tanpa mengubah task lama yang sudah berjalan.

## 6. Routes

Tidak ada route baru. `/projects/[id]` (tab Overview dan Tasks) diisi penuh pada route yang sama.

## 7. Files Created, Changed, dan Removed

**Created:**
- `docs/mockup-section-reports/section-09-project-order-handover.md` (laporan ini)

**Changed:**
- `app/types/project.ts` (`+ProjectOrderStatus`, `+ProjectClosureChecklist`, `Project` +7 field aditif)
- `app/types/activity.ts` (`ProjectTask` +3 field aditif, `+ProjectRisk`/`ProjectRiskSeverity`/`ProjectRiskStatus`)
- `app/constants/status.ts` (`+PROJECT_ORDER_STATUSES`, `+RISK_SEVERITIES`, `+RISK_STATUSES`)
- `app/data/activity.ts` (`TASKS` jadi `reactive()`, +backfill `isMilestone`/`dependsOnTaskId`/`assignedTo`, `+PROJECT_RISKS`)
- `app/data/projects.ts` (backfill `handoverAcceptedAt`/`handoverAcceptedBy` PRJ-101/102/103, komentar PRJ-104 diperbarui)
- `app/data/index.ts` (+13 mutator/selector: `getProjectOrderStatus`, `getRisksByProject`, `acceptProjectHandover`, `returnProjectHandover`, `markProjectReady`, `getProjectStatusTransitions`, `updateProjectStatus`, `updateProjectClosureChecklist`, `addProjectTeamMember`, `removeProjectTeamMember`, `createProjectTask`, `updateProjectTask`, `createProjectRisk`, `updateProjectRiskStatus`)
- `app/pages/projects/[id]/index.vue` (Overview tab +4 SectionCard baru, Tasks tab ditulis ulang, bug fix link opportunity, badge header diganti)
- `docs/mockup-design-decisions.md` (+D-066)
- `docs/mockup-change-impact-log.md` (+CI-039)
- `docs/mockup-open-questions.md` (Q16 RESOLVED)
- `docs/frontend-module-map.md`, `docs/frontend-workflow-map.md`, `docs/frontend-implementation-roadmap.md`, `docs/frontend-known-issues.md`
- `docs/mockup-implementation-state.md`, `docs/mockup-progress.md` (+Entri 18), `docs/mockup-section-progress.md`
- `docs/mockup-section-reports/README.md`

**Removed:** Tidak ada.

## 8. Components Reused/Created

Reused sepenuhnya: `SectionCard`, `StatusBadge`, `Dialog`/`DialogTrigger`/`DialogContent`/`DialogScrollContent`/`DialogHeader`/`DialogTitle`/`DialogDescription`/`DialogFooter`, `Button`, `Input`, `Label`, `Checkbox`, `DetailMetadataList`, `EmptyState`, `useToast`. Tidak ada shared component baru.

## 9. Types/Constants/Fixtures/Mock State

`Project` +7 field aditif (`handoverAcceptedAt`/`handoverAcceptedBy`/`handoverReturnedAt`/`handoverReturnReason`/`readyAt`/`closedAt`/`closureChecklist`). `ProjectTask` +3 field aditif. `+ProjectRisk` (entitas baru, 2 baris seed). `+ProjectOrderStatus`/`ProjectClosureChecklist`/`ProjectRiskSeverity`/`ProjectRiskStatus` (type baru). `TASKS` jadi `reactive()` (breaking-safe — array yang sama, hanya dibungkus Proxy). Tidak ada fixture ID lama yang diganti/dihapus.

## 10. Responsive Behavior

Tidak ada pola baru — seluruh SectionCard/Dialog/Table baru memakai komponen existing yang sudah responsive.

## 11. States (Loading/Empty/Error/Unauthorized/Not-Found)

- `RoleAccessState` untuk `!canView('project')` (tidak diubah).
- Handover: 2 state jelas (Handover Pending → tombol Accept/Return; selain itu → info "Handover diterima oleh X pada tanggal Y" + tombol transisi status).
- Risks: `EmptyState` "Belum ada risk tercatat" bila kosong.
- Tasks: `EmptyState` "Belum ada task tercatat" bila kosong (tidak diubah).
- Tombol aksi (Accept/Return Handover, transisi status, tambah/hapus team, catat risk, cycle risk status, tambah/edit task) seluruhnya digerbangi `canManageProjectOrder` (PM/Super Admin) — role lain melihat read-only.

## 12. Role Behavior

`canManageProjectOrder` (baru) = `['project-manager', 'super-admin'].includes(currentRole)` — narrow role exception, pola identik `canManageTravelers` (Section 11) dan `canManageServiceType` (Section 12). Management (yang punya `project: 'APPROVE'`) SENGAJA TIDAK termasuk — konsisten pola existing bahwa `APPROVE` level Management dikhususkan untuk approval besar (Change/Won), bukan operasional harian (handover/status/team/task/risk adalah wewenang PM).

## 13. Validation Commands dan Hasilnya

- `npx nuxi prepare` — **sukses**.
- `npm run build` — **sukses di percobaan pertama** (tidak ada error kompilasi/tag tidak tertutup, berbeda dari Section 07 yang sempat perlu 1x perbaikan).
- `npx vitest run` — tidak dijalankan ulang (pre-existing gap, Q8).
- Lint/typecheck — tidak tersedia (pre-existing, Q8).
- **Smoke test HTTP** — `/projects/PRJ-101`–`104`, `/projects/PRJ-101?tab=tasks`, `/projects`, `/`, plus ~11 route regresi (CRM/Customer Journey/Client Portal/Vendors/Finance/Reports/Admin/Settings) — **seluruhnya HTTP 200**.
- **Smoke test konten** (curl+grep):
  - `PRJ-104` (satu-satunya `draft`, handover belum accepted) menampilkan "Handover Pending" (2×) dan tombol "Accept Handover"+"Return Handover".
  - `PRJ-101` (`confirmed`, handover di-backfill accepted) menampilkan "Confirmed" (4×), "Tandai Ready", dan "Handover diterima" — mengonfirmasi derivasi `handover-pending`/`confirmed` bekerja tepat untuk 2 skenario berlawanan.
  - `PRJ-102` (`planning`) menampilkan "Planning" (3×).
  - `PRJ-103` menampilkan judul 2 risk yang diseed persis ("Ketersediaan venue MICE...", "Cuaca ekstrem...") dan tab Tasks menampilkan 3× badge "Milestone" + 1× "Depends on:" — sesuai backfill fixture.
  - `PRJ-101`: link opportunity mengarah persis ke `href="/crm/opportunities/OPP-001"` (dikonfirmasi BUKAN lagi ke list) dan teks "quotation approved" menampilkan "Rp 95.000.000" (cocok `QUO-001.amountIdr`).
- **Verifikasi interaktif** (klik Accept/Return Handover, transisi status dengan reason, tambah/hapus team member, tambah task/risk, cycle risk status) **tidak dilakukan headless** — keterbatasan tooling konsisten sejak Section 06 lama. Dimitigasi lewat code review ketat terhadap seluruh guard mutator baru dan smoke test SSR konten yang membuktikan derivasi status + data baru dirender benar untuk 4 skenario project yang berbeda kondisi.

## 14. Regression

`app/pages/projects/[id]/index.vue` (dimiliki Section 10 lama/Section 11/12/13/14/15 — banyak section sebelumnya menyumbang tab berbeda) disentuh HANYA pada tab Overview (SectionCard baru ditambahkan, tidak ada yang dihapus) dan tab Tasks (ditulis ulang total, tapi tab ini sebelumnya kosong-fungsional sehingga tidak ada regresi perilaku existing yang hilang). Tab lain (Itinerary & Services, Travelers, Vendors, Finance, Documents, Activity & Changes) TIDAK disentuh sama sekali — dikonfirmasi via smoke test bahwa seluruh route regresi representatif tetap HTTP 200 tanpa perubahan konten yang tidak diharapkan.

## 15. Cross-Section Impact

`docs/mockup-change-impact-log.md` CI-039 — bug fix link opportunity asal di tab Overview, menyentuh Section 10 lama (pemilik asli tab Overview `/projects/[id]`) — perbaikan murni (URL yang salah → URL yang benar), tidak ada perubahan perilaku lain, regression-tested.

## 16. Known Issues dan Deferred Work

- Closure Checklist tetap shell tanpa gating (disengaja, D-066) — PM dapat mencentang seluruh item tanpa efek pada transisi status Closed apa pun. Pemenuhan penuh (gating transisi Completed→Closed berdasarkan checklist) diserahkan ke Section 24 sesuai instruksi literal "shell untuk dipenuhi section akhir".
- Dependency task bersifat single-link sederhana (`dependsOnTaskId`, satu task per dependency) — bukan DAG penuh (multiple dependencies, validasi siklus). Cukup untuk mendemokan konsep, evolusi lanjutan bila dibutuhkan use-case lebih kompleks.
- Verifikasi interaktif tidak dilakukan headless (keterbatasan tooling, konsisten sejak Section 06 lama).
- Q8 (tooling lint/typecheck/test) tetap terbuka, tidak berubah.

## 17. Protection Notes untuk Section Berikutnya

`ProjectStatus` (8 nilai, D-028) TETAP LOCKED — `ProjectOrderStatus` (10 nilai) adalah lapisan derivasi TAMBAHAN, bukan pengganti. **Jangan** menambah nilai baru ke `ProjectStatus` untuk "menyamakan" dengan 10 nilai Section 09 — gunakan `getProjectOrderStatus()` sebagai satu-satunya titik derivasi. `PROJECT_STATUS_TRANSITIONS` (peta transisi) dan guard `reason` wajib untuk on-hold/cancelled — jangan dilonggarkan tanpa alasan kuat. Struktur 8-tab `/projects/[id]` TETAP LOCKED (D-026/D-027) — Section 09 menambah SectionCard DI DALAM tab existing, TIDAK menambah tab ke-9; section berikutnya yang butuh UI serupa sebaiknya mengikuti pola yang sama (extend tab existing, bukan tab baru) kecuali ada keputusan LOCKED baru yang eksplisit membuka struktur tab.

## 18. Review URLs

Tidak ada deployment publik. Untuk review lokal: `npm run dev`, buka `http://localhost:8080/projects/PRJ-104` untuk melihat status "Handover Pending" dan mencoba tombol Accept/Return Handover (sebagai PM/Super Admin, default demo role). Buka `http://localhost:8080/projects/PRJ-101` untuk mencoba transisi status dan "Tandai Ready". Buka `http://localhost:8080/projects/PRJ-103` (tab Tasks/`?tab=tasks`) untuk melihat Milestone/Dependency, dan tab Overview untuk melihat 2 Risk yang sudah diseed.

## 19. Recommended Next Section

**Section 10 — Product Planning dan Costing** (entitas Product/Package catalog dan Cost Sheet baru, NOT_STARTED sepenuhnya), berbasis dependency (`docs/frontend-implementation-roadmap.md`) — menunggu perintah eksplisit user.
