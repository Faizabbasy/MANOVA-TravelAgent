# Section Report — Section 06: Management Approval, Won dan Client Activation

**Status:** COMPLETED

Dikerjakan berdasarkan `prompts/SECTION_06_Management_Approval_Won_Client_Activation.md`. Section ketujuh roadmap Section 00–24 baru, dijalankan setelah Section 05 (Account Executive Opportunity dan Quotation, COMPLETED) dan setelah bug fix `mock-reset.ts` (CI-035, `docs/frontend-known-issues.md` bagian 0b) yang dilaporkan user di antara kedua section.

---

## 1. Section Objective dan Scope

"Lengkapi commercial approval dan conversion frontend." Wajib: Management approval queue; Detail review quotation, margin, discount, terms, complexity, risk; Approve, reject, return for revision dengan notes/history; Hanya Management yang mengapprove; AE melihat result dan merevisi bila rejected; Client confirmation mock; AE Mark as Won hanya setelah approved dan confirmed; Transaction simulation (Prospect→Active Client, Opportunity→Won, approved quotation final, Project Order dibuat, Account Owner AE, PM assignment, activity generated); Duplicate Client dan Project Order prevention. Acceptance: Seluruh permitted dan forbidden flow dapat diuji melalui role switcher.

## 2. Source Documents yang Dibaca

`prompts/SECTION_06_Management_Approval_Won_Client_Activation.md`, `prompts/01-PROTOKOL WAJIB — CONTINUITY, DOKUMENTASI PER SECTION, DAN PERLINDUNGAN HASIL.md`, `CLAUDE.md`, seluruh `docs/mockup-*.md`, `docs/frontend-*.md`, `docs/mockup-section-reports/section-00-*.md` s/d `section-05-*.md`, source code aktual (`app/pages/crm/opportunities/[id]/index.vue`, `app/pages/crm/quotations.vue`, `app/data/index.ts`, `app/constants/navigation.ts`, `app/constants/roles.ts`), `git status`, `git log`.

## 3. Existing Implementation yang Diperiksa

`git status` di awal sesi menunjukkan working tree bersih (`nothing to commit, working tree clean`) — Section 05 dan bug fix `mock-reset.ts` sebelumnya sudah ter-commit (`7536e95 section-03-05`). Audit terhadap `docs/frontend-known-issues.md` bagian 4 dan `docs/mockup-open-questions.md` Q14 mengonfirmasi mayoritas Wajib Section 06 **sudah COMPLETED** sejak Prompt 19 (Commercial Approval: submit/approve/reject per-Opportunity, `canApprove('crm')` membatasi hanya Management/Super Admin) dan Section 05 (Client Confirmation AE-facing, gerbang UI Mark as Won) serta Section 09 (transaksi Won: Project dibuat, Prospect→Client, PM default assignment, activity log). Gap konkret yang tersisa (Q14, belum RESOLVED sebelum sesi ini):
1. Tidak ada halaman agregat "Management Approval Queue" — Commercial Approval hanya bisa diakses satu-per-satu dari `/crm/opportunities/[id]`.
2. Tidak ada visibilitas Management-facing untuk opportunity yang menunggu Client Confirmation (AE-facing sudah ada sejak Section 05, tapi Management tidak punya cara melihat daftar lintas Opportunity).
3. Tidak ada histori/audit trail approve/reject — `Quotation.approvalNote`/`approvedBy` hanya menyimpan nilai keputusan TERAKHIR, keputusan sebelumnya (mis. reject pertama sebelum akhirnya approved di submission kedua) tertimpa tanpa jejak.
4. Gerbang "approved + confirmed" sebelum Mark as Won hanya divalidasi di UI (`submitMarkAsWon`, Opportunity Detail) — mutator `approveOpportunityWon` sendiri tidak memvalidasi ulang, sehingga forbidden flow secara teknis bisa lolos bila dipanggil dari luar UI yang sudah digerbangi.

**Tidak ditemukan gap** pada "return for revision" (fungsional sudah setara "reject" existing — quotation `rejected` sudah dapat direvisi AE lewat "Create New Version"), "Account Owner AE" (sudah terisi sejak `qualifyLeadAndCreateOpportunity`, hanya belum ditegaskan ulang di titik Won), dan "Duplicate Client/Project Order prevention" (guard `projectId` di `approveOpportunityWon` dan dedup Party by name di `qualifyLeadAndCreateOpportunity` sudah ada sejak Section 09/Prompt 20).

## 4. Decisions yang Digunakan

D-063 (`docs/mockup-design-decisions.md`, baru) — Management Approval Queue agregat di `/crm/quotations`; "Reject" berfungsi sekaligus sebagai "Return for Revision" (tidak ada status paralel baru); gerbang Won dipindah ke level data.

## 5. Implementation Summary

**`/crm/quotations`** (sebelumnya `ModulePlaceholder`, `comingSoon: true` di nav) ditulis ulang total menjadi Management Approval Queue dengan 3 tab (state via query param `?tab=`, pola sama `projects/[id]/index.vue`, deep-linkable dan dapat diverifikasi tanpa interaksi JS):
- **"Menunggu Approval"** — `getQuotationsPendingApproval()` (quotation baru, `approvalStatus === 'submitted'`). Klik baris/tombol "Review" membuka dialog detail: nilai quotation, discount, tax/fee, markup, estimated margin, payment terms, valid until, service breakdown, **complexity** (dirivasi dari `serviceScope.length`+`travelerEstimate`, fungsi lokal halaman — bukan field tersimpan baru), **risk notes** (`Opportunity.requirementDetail.riskNotes`, reuse field Section 08). Untuk `canApprove('crm')` (Management/Super Admin), dialog menampilkan field catatan + tombol "Approve" dan "Reject (Return for Revision)" (disabled tanpa catatan).
- **"Menunggu Client Confirmation"** — `getOpportunitiesPendingClientConfirmation()` (baru, quotation `approved` tapi `Opportunity.clientConfirmedAt` belum terisi, stage `negotiation`/`on-hold`). Read-only bagi Management — link "Lihat Opportunity →" ke halaman detail tempat AE benar-benar mencatat konfirmasi (Section 05), TIDAK ada aksi duplikat di sini (client confirmation tetap satu jalur, dijaga agar tidak ada 2 cara mencatat hal yang sama).
- **"Semua Quotation"** — seluruh `QUOTATIONS`, browse read-only dengan status badge, klik baris membuka dialog detail yang sama (tanpa tombol approve/reject bila status bukan `submitted`).

**Histori approve/reject** — `submitQuotationForApproval`, `approveQuotation`, `rejectQuotation` (`app/data/index.ts`) masing-masing kini memanggil `createPartyActivity` (reuse mutator Section 07, TIDAK ada komponen/tabel histori baru) — hasilnya otomatis tampil di tab "Activity / Follow-up" Opportunity Detail (Section 08) yang sudah ada, tanpa perubahan UI di halaman tsb.

**Gerbang Won di level data** — `approveOpportunityWon` (Section 09) mendapat baris guard baru: `if (quotation.approvalStatus !== 'approved' || !opportunity.clientConfirmedAt) return undefined`, ditambahkan setelah `getOpportunityMissingRequirements` (requirement dasar) dan sebelum project dibuat. Perilaku UI (`submitMarkAsWon`, Opportunity Detail) tidak berubah sama sekali — guard ini murni defense-in-depth di level data, transparan bagi permitted flow yang sudah selalu memenuhi kedua syarat sejak Section 05.

**Account Owner AE** — `approveOpportunityWon` kini eksplisit menjalankan `party.accountOwnerId = opportunity.ownerId` bersamaan dengan `party.lifecycleStatus = 'client'`, menegaskan ulang field yang sebenarnya sudah terisi sejak Party dibuat (`qualifyLeadAndCreateOpportunity`) — aditif, tidak mengubah nilai pada skenario normal (AE tidak berganti antara create Opportunity dan Won).

**Duplicate prevention** — diverifikasi ulang (bukan diubah): `approveOpportunityWon` mengembalikan project existing (bukan membuat baru) bila `opportunity.projectId` sudah terisi; `qualifyLeadAndCreateOpportunity` mencari Party existing by company name sebelum membuat baru.

## 6. Routes

`/crm/quotations` — isi penuh dari placeholder (route sama, bukan baru). Tidak ada route baru.

## 7. Files Created, Changed, dan Removed

**Created:**
- `docs/mockup-section-reports/section-06-management-approval-won.md` (laporan ini)

**Changed:**
- `app/pages/crm/quotations.vue` (ditulis ulang total dari `ModulePlaceholder`)
- `app/constants/navigation.ts` (`comingSoon` dihapus dari item "Quotations")
- `app/data/index.ts` (+`getQuotationsPendingApproval`, +`getOpportunitiesPendingClientConfirmation`; `submitQuotationForApproval`/`approveQuotation`/`rejectQuotation` +`createPartyActivity` logging; `approveOpportunityWon` +guard `approvalStatus`/`clientConfirmedAt` +`party.accountOwnerId`; +import `formatCurrencyIdr`)
- `docs/mockup-design-decisions.md` (+D-063)
- `docs/mockup-change-impact-log.md` (+CI-036)
- `docs/mockup-open-questions.md` (Q14 RESOLVED)
- `docs/frontend-module-map.md`, `docs/frontend-workflow-map.md`, `docs/frontend-implementation-roadmap.md`, `docs/frontend-known-issues.md`
- `docs/mockup-implementation-state.md`, `docs/mockup-progress.md` (+Entri 15), `docs/mockup-section-progress.md`
- `docs/mockup-section-reports/README.md`

**Removed:** Tidak ada.

## 8. Components Reused/Created

Reused sepenuhnya: `PageHeader`, `SectionCard`, `RoleAccessState`, `Tabs`/`TabsList`/`TabsTrigger`/`TabsContent`, `Table`/`TableHeader`/`TableRow`/`TableHead`/`TableBody`/`TableCell`/`TableEmpty`, `StatusBadge`, `Dialog`/`DialogScrollContent`/`DialogHeader`/`DialogTitle`/`DialogDescription`/`DialogFooter`, `DetailMetadataList`, `Button`, `Input`, `Label`, `NuxtLink`, `useToast`. Tidak ada shared component baru.

## 9. Types/Constants/Fixtures/Mock State

Tidak ada perubahan type/shape apa pun. Tidak ada fixture baru/diubah — halaman baru murni membaca `QUOTATIONS`/`OPPORTUNITIES` existing lewat selector baru (fungsi filter, tidak mengubah data).

## 10. Responsive Behavior

Tidak berubah — halaman baru memakai `Tabs`/`Table`/`Dialog` existing yang sudah responsive (pola identik `finance/invoices.vue`/`vendors/[id]/index.vue`).

## 11. States (Loading/Empty/Error/Unauthorized/Not-Found)

- `RoleAccessState` untuk role tanpa `canView('crm')`.
- `TableEmpty` per tab ("Tidak ada quotation yang menunggu approval saat ini." / "Tidak ada opportunity yang menunggu client confirmation saat ini." / "Belum ada quotation.").
- Dialog review: tombol Approve/Reject hanya tampil bila `canApproveCommercial && approvalStatus === 'submitted'` (selain itu, tombol "Tutup" saja) — role tanpa approve access (mis. AE, Sales, Finance) tetap bisa membuka dialog untuk membaca detail (transparansi), hanya tidak bisa mengeksekusi keputusan.
- Tombol "Reject" disabled dengan `title` penjelasan bila catatan kosong (catatan wajib untuk reject).

## 12. Role Behavior

`canView('crm')` menentukan akses halaman (Management/Super Admin/AE/Sales/Product Planner/Finance/Viewer — level `VIEW` ke atas). `canApprove('crm')` (Management/Super Admin, level `APPROVE`/`ADMIN`) menentukan siapa yang melihat tombol Approve/Reject di dialog review — **tidak diubah** dari pola existing (`canApproveCommercial` di Opportunity Detail, Prompt 19). Tab "Menunggu Client Confirmation" murni informasional untuk siapa pun yang `canView('crm')`, tidak ada aksi berbeda per role di tab ini (aksi tetap di Opportunity Detail, AE-only).

## 13. Validation Commands dan Hasilnya

- `npx nuxi prepare` — **sukses** (2x run).
- `npm run build` — **sukses** (3x run total selama sesi — run pertama sempat gagal karena stale lock `.nuxt/nuxt.lock` peninggalan proses `dev` lama dari sesi sebelumnya, dibersihkan lalu retry sukses; 2 run berikutnya sukses langsung setelah masing-masing perubahan).
- `npx vitest run` — "No test files found" (pre-existing, Q8).
- `npx nuxi typecheck` — tidak dijalankan ulang (pre-existing gap, `vue-tsc` tidak terpasang, Q8, tidak berubah sejak section-section sebelumnya).
- Lint — tidak tersedia (pre-existing, Q8).
- **Smoke test HTTP** — ~29 route lintas seluruh modul (`/`, `/login`, `/crm`, `/crm/prospects`, `/crm/clients`, `/crm/opportunities` [+`OPP-005`/`006`/`010`], `/crm/opportunities/OPP-010/quotation-preview`, `/crm/quotations`, `/crm/parties/PTY-001`, `/projects` [+`PRJ-101`], `/vendors` [+`VND-001`], `/finance` [+`invoices`/`payments`], `/reports`, `/admin` [+`roles`/`users`], `/customer-journey` [+`leads`], `/lead-intake`, `/settings`, `/activity-center`, `/supplier`, `/client`) — **seluruhnya HTTP 200**.
- **Smoke test konten** (curl+grep):
  - `/crm/quotations` (default, `?tab=pending-approval`) menampilkan tab count "Menunggu Approval (1)" / "Menunggu Client Confirmation (1)" / "Semua Quotation (8)" — cocok fixture (`QUO-005` satu-satunya `submitted`; `OPP-006` satu-satunya approved-belum-confirmed; 8 quotation total `QUO-001/002/003/004/005/006/008/010`). `QUO-005` muncul di tab default.
  - `/crm/quotations?tab=pending-confirmation` menampilkan "Manila Repeat Business Q4 2026" (`OPP-006`).
  - `/crm/quotations?tab=all` menampilkan seluruh 8 ID quotation.
  - `/crm/opportunities/OPP-006` tetap menampilkan tombol Mark as Won `disabled title="Client confirmation belum dicatat"` (perilaku UI tidak berubah, kini didukung guard data baru).
  - `/crm/opportunities/OPP-001` (won lama, Prompt 20) tetap menampilkan link "Lihat Project hasil konversi" — regresi historis tidak terpengaruh guard baru (guard hanya aktif pada transisi `won-requested → won`, opportunity yang sudah `won` tidak pernah melewati path ini lagi).
- **Verifikasi interaktif** (klik Approve/Reject dari queue, buka dialog review, isi catatan) **tidak dilakukan headless** — keterbatasan tooling konsisten sejak Section 06 lama (skema Prompt). Dimitigasi lewat: (a) reuse penuh mutator `approveQuotation`/`rejectQuotation` yang SUDAH tervalidasi interaktif secara tidak langsung lewat penggunaan identik di Opportunity Detail sejak Prompt 19; (b) code review ketat terhadap guard baru; (c) smoke test SSR konten yang membuktikan seleksi/filter/derivasi data bekerja benar di level render untuk seluruh skenario kunci.

## 14. Regression

Tidak ada file section lain yang disentuh di luar `app/data/index.ts` (perluasan perilaku mutator existing, bukan breaking change signature) dan `app/constants/navigation.ts` (satu baris, hapus flag). `approveOpportunityWon` (dimiliki Section 09) diperkaya, bukan direstrukturisasi — regresi terhadap 4 Opportunity yang sudah `won` (`OPP-001`/`002`/`003`/`008`) dan seluruh Project/Dashboard/Reports yang bergantung padanya dikonfirmasi tidak berubah (guard baru hanya berlaku pada path `won-requested → won` yang belum pernah dilalui data historis tsb lagi).

## 15. Cross-Section Impact

`docs/mockup-change-impact-log.md` CI-036 — guard `approveOpportunityWon` dipindah ke level data, menyentuh Section 09 (pemilik asli mutator, guard existing `stage`/`projectId`/`getOpportunityMissingRequirements` tidak diubah) dan Section 05 (pemilik gerbang UI existing `submitMarkAsWon`, tidak diubah — guard baru transparan terhadap flow yang sudah memenuhi syarat).

## 16. Known Issues dan Deferred Work

- Notifikasi push/email ke Management saat quotation baru masuk queue **tidak diimplementasikan** — di luar scope (larangan integrasi nyata per protokol `01-PROTOKOL-WAJIB.md`), Management perlu membuka `/crm/quotations` secara manual untuk melihat antrean terbaru.
- Client confirmation tetap dicatat manual oleh AE (mock) — bukan self-service dari Client Portal (Section 08 tetap pemilik fitur Client Portal penuh), didokumentasikan sebagai batasan yang disengaja.
- Verifikasi interaktif (klik Approve/Reject/buka dialog) tidak dilakukan headless — keterbatasan tooling konsisten, dimitigasi lewat reuse mutator tervalidasi dan smoke test SSR konten.
- Q8 (tooling lint/typecheck/test) tetap terbuka, tidak berubah.

## 17. Protection Notes untuk Section Berikutnya

`getQuotationsPendingApproval`/`getOpportunitiesPendingClientConfirmation` (baru, `app/data/index.ts`) — selector murni (tidak memutasi apa pun), aman direuse section lain yang butuh daftar serupa (mis. widget Dashboard Management di masa depan) tanpa menghitung ulang logic yang sama. **Jangan mengubah** guard baru di `approveOpportunityWon` (`approvalStatus === 'approved' && clientConfirmedAt`) tanpa memeriksa dampaknya ke `/crm/opportunities/[id]` (Section 05, satu-satunya pemanggil UI saat ini) — bila section berikutnya menambah gerbang lain, tambahkan sebagai kondisi TAMBAHAN (pola AND), bukan mengganti. `QuotationApprovalStatus` (`draft`/`submitted`/`approved`/`rejected`) TETAP 4 nilai — jangan menambah "returned-for-revision" sebagai status kelima tanpa meninjau ulang D-063 (keputusan sadar untuk TIDAK melakukan ini).

## 18. Review URLs

Tidak ada deployment publik. Untuk review lokal: `npm run dev`, buka `http://localhost:8080/crm/quotations` untuk melihat 3 tab (klik tab atau tambahkan `?tab=pending-confirmation`/`?tab=all` di URL untuk deep-link langsung), klik baris `QUO-005` (tab "Menunggu Approval") untuk membuka dialog review lengkap dan mencoba Approve/Reject sebagai Super Admin (default demo role). Buka `http://localhost:8080/crm/opportunities/OPP-006` untuk melihat efek gerbang baru (Mark as Won tetap disabled sampai Client Confirmation dicatat via section Commercial Approval).

## 19. Recommended Next Section

**Section 07 — Customer Journey** (melengkapi funnel drill-down per stage dan conversion metrics eksplisit), berbasis dependency (`docs/frontend-implementation-roadmap.md`) — menunggu perintah eksplisit user.
