# Section 08 — Opportunity dan Quotation

**Status:** COMPLETED

Dikerjakan berdasarkan `prompts/10-PROMPT-8-OPPORTUNITY-QUOTATION.md`, dijalankan lewat `prompts/99-RUN-CURRENT-SECTION.md` atas perintah user.

---

## 1. Section Objective dan Scope

Membangun modul CRM — Opportunity dan Quotation: list/detail Opportunity, pipeline/stage visualization, owner/value/requirement/destination/travel date/traveler estimate/service scope, activity/follow-up, quotation summary/version mock, alur Lost dan On Hold, filter dan states, role behavior. **Workflow Won penuh (approve + pembuatan Project) eksplisit di luar scope** — itu Section 09.

## 2. Source Documents yang Dibaca

`prompts/01-PROTOKOL WAJIB — CONTINUITY, DOKUMENTASI PER SECTION, DAN PERLINDUNGAN HASIL.md`, `prompts/10-PROMPT-8-OPPORTUNITY-QUOTATION.md`, `docs/mockup-implementation-state.md`, `docs/mockup-section-progress.md`, `docs/mockup-change-impact-log.md`, `docs/mockup-section-reports/section-06-dashboard.md` dan `section-07-crm-party.md`, `docs/route-and-role-matrix.md` (bagian 1.2, 2, 5), `docs/mockup-data-scenarios.md`.

## 3. Existing Implementation yang Diperiksa

`app/pages/crm/opportunities.vue` (list shell Section 05), `app/pages/crm/parties/[id]/index.vue` dan `app/pages/projects/[id]/index.vue` (pola tab/detail dari Section 07), `app/types/opportunity.ts`, `app/data/opportunities.ts`, `app/components/shared/StatusBreakdownList.vue` (Section 06), `app/composables/{useCurrentUser,usePermissions}.ts`. `git status`/`git log` diperiksa — bersih kecuali `prompts/99-RUN-CURRENT-SECTION.md` (menunjuk Section 08).

## 4. Decisions yang Digunakan

D-024 (Party model), D-025 (model role Won dua-langkah — hanya bagian "submit" yang aktif di section ini), D-028/D-029 (constants status), D-030 (Role & Access Matrix), D-040 (jam demo tetap).

## 5. Implementation Summary dan User Flow

`/crm/opportunities` menampilkan pipeline visualization (breakdown per stage, reuse `StatusBreakdownList`) di atas tabel yang bisa difilter (search, stage, party) — setiap baris menaut ke `/crm/opportunities/[id]` (baru). Halaman detail menampilkan info lengkap opportunity (party, owner, destinasi, tanggal perkiraan, estimasi traveler, requirement, service scope, estimasi nilai), stage stepper dengan aksi maju sesuai stage aktif, quotation (create otomatis saat lanjut ke Proposal, revisi dengan version mock), dan activity/follow-up (reuse `PartyActivity` dari Section 07 dengan tag opportunity).

**User flow yang bisa didemokan:** login Sales → buka Opportunities → lihat pipeline breakdown per stage → klik opportunity di stage Qualification (OPP-007) → lihat field travel/requirement masih kosong (empty state) → klik "Lanjut ke Requirement Gathering" → isi requirement (belum ada UI edit inline untuk requirement — lihat known issues) → "Lanjut ke Proposal" → dialog minta nilai quotation → submit → quotation ter-generate dan stage jadi Proposal → "Lanjut ke Negotiation" → "Ajukan sebagai Won" → status jadi WonRequested, menunggu Section 09. Alternatif: buka OPP-005 (Bali, sudah di Negotiation) → lihat quotation versi 2 (direvisi dari Rp 150jt) → klik "Revisi Quotation" → masukkan nilai baru → versi jadi 3.

## 6. Routes

`/crm/opportunities` (dipindah lokasi file, isi sama secara konsep tapi diperkaya), `/crm/opportunities/[id]` (baru).

## 7. Files Created, Changed, dan Removed

**Created:** `app/pages/crm/opportunities/index.vue`, `app/pages/crm/opportunities/[id]/index.vue`.

**Changed:**
- `app/types/opportunity.ts` — `Opportunity` +7 field, `Quotation` +2 field.
- `app/types/party.ts` — `PartyActivity` +`opportunityId?`.
- `app/data/opportunities.ts` — `reactive()`, field lengkap seluruh 7 opportunity, `QUO-005` jadi versi 2.
- `app/data/parties.ts` — backfill `opportunityId` pada 4 record.
- `app/data/index.ts` — `+getOpportunityById`, `+getPartyActivitiesByOpportunity`, `+advanceOpportunityStage`, `+createQuotation`, `+reviseQuotation`; `createPartyActivity` diperluas.
- `app/pages/crm/parties/[id]/index.vue` — baris Opportunities tab kini menaut ke detail.

**Removed:** `app/pages/crm/opportunities.vue` (isinya dipindah ke `opportunities/index.vue` — lihat bagian 13/17 untuk detail bug routing yang melatarbelakangi ini).

## 8. Components Reused dan Created

**Reused:** `StatusBreakdownList` (pipeline visualization, bukan Chart.js baru — lihat catatan bagian 17), `SectionCard` (+`#actions`), `Dialog*`, `Table*`, `StatusBadge`, `DetailMetadataList`, `PageHeader`, `EmptyState`, `RoleAccessState`, `Label`, `Input`, `Button`.

**Created:** Tidak ada komponen baru.

## 9. Types, Constants, Fixtures, dan Mock State

`Opportunity` — 7 field baru (`ownerId`, `estimatedValueIdr`, `destination`, `travelStartDate?`, `travelEndDate?`, `travelerEstimate?`, `requirementNotes?`), seluruhnya diisi untuk 6 dari 7 opportunity (OPP-007 sengaja dikosongkan sebagian — stage Qualification, mendemonstrasikan empty state). `Quotation` — `version`, `supersededAmountIdr?` untuk "version mock" ringan (bukan histori penuh multi-row). `OPPORTUNITIES`/`QUOTATIONS` kini `reactive()`. `PartyActivity` — `opportunityId?` opsional, backfill pada 4 dari 6 seed record Section 07.

## 10. Responsive Behavior

Mengikuti pola grid/flex responsif yang sama dengan halaman list/detail lain (Prospects, Party Detail). Tidak diverifikasi lewat browser interaktif — hanya lewat kelas Tailwind konsisten dengan pola existing.

## 11. Loading, Empty, Error, Not-Found, dan Unauthorized States

- **Loading:** Tidak ada simulasi — konsisten precedent Section 05/07 untuk halaman non-Dashboard.
- **Empty:** "Belum ada quotation" (opportunity pra-Proposal), "Requirement belum digali", "Belum ditentukan" (tanggal/traveler kosong), "Belum ada activity untuk opportunity ini", "Tidak ada opportunity yang cocok dengan filter".
- **Error:** Tidak ada state error tersimulasi baru — konsisten Section 06/07 (tidak ada sumber async yang bisa gagal pada mock murni).
- **Not-found:** Opportunity Detail menampilkan not-found (ikon `FileX`, ID yang dicari, tombol kembali) untuk ID tidak dikenal — dikonfirmasi via smoke test `OPP-999`.
- **Unauthorized:** `RoleAccessState` untuk role tanpa `crm:VIEW`. Aksi tulis (transisi stage, quotation, activity) disembunyikan total untuk role selain Sales/Super Admin.

## 12. Role Behavior

Akses buka halaman: `canView('crm')` (coarse, module-level, sama seperti Section 07). Akses tulis: `canManageOpportunity = Sales atau Super Admin` — Management **dikecualikan** dari transisi stage sehari-hari meski modul `crm`-nya `APPROVE` (dikhususkan untuk approve Won, Section 09), konsisten pola `canManageParty` Section 07.

## 13. Validation Commands dan Hasilnya

- `npx nuxi prepare` — sukses (2x).
- `npm run build` — **sukses (exit 0), 2x** — build pertama sukses secara teknis namun (lihat di bawah) menyembunyikan bug routing; build kedua setelah fix juga sukses dan hasilnya diverifikasi benar.
- `npx vitest run` — "No test files found" (pre-existing).
- `npx nuxi typecheck` — gagal, `vue-tsc` tidak terpasang (Q8, pre-existing).
- Lint — tidak tersedia (Q8, pre-existing).

**Bug ditemukan dan diperbaiki selama section ini (didokumentasikan secara transparan, bukan disembunyikan):**

Setelah build pertama sukses, smoke test awal (`curl` status code) melaporkan HTTP 200 untuk `/crm/opportunities/OPP-001`, `/OPP-005`, `/OPP-007`, `/OPP-999` — tampak baik-baik saja. Namun verifikasi lebih dalam (membandingkan ukuran file dan mencari string konten spesifik) mengungkap: **ketiganya mengembalikan halaman 404 catch-all yang identik** (byte-size sama persis, `<title>MANOVA</title>` generik), bukan Opportunity Detail. Root cause: `app/pages/crm/opportunities.vue` (file datar) bersanding dengan direktori `app/pages/crm/opportunities/[id]/` — kombinasi file+direktori dengan nama sama ini membuat Nuxt/Vue Router gagal me-resolve route nested `[id]`, fallback diam-diam ke 404 tanpa warning build maupun error runtime.

**Perbaikan:** memindahkan isi `opportunities.vue` ke `opportunities/index.vue` (menghapus file datar), mengikuti pola `projects/index.vue` + `projects/[id]/index.vue` yang sudah terbukti benar di codebase ini. Setelah rebuild, verifikasi ulang dengan curl + grep konten spesifik mengonfirmasi:
- `OPP-005`: `<title>Bali Team Building 2026</title>`, menampilkan "Versi 2" dan "Direvisi dari Rp 150.000.000".
- `OPP-007`: menampilkan "Belum ditentukan", "Requirement belum digali", "Belum ada quotation".
- `OPP-999`: `<title>Opportunity Tidak Ditemukan</title>`, menampilkan "Opportunity tidak ditemukan".
- `OPP-001`: menampilkan link "Lihat Project hasil konversi" ke `PRJ-101`.
- Regresi: `/`, `/crm`, `/crm/prospects`, `/crm/clients`, `/crm/parties/PTY-001`, `/crm/parties/PTY-004`, `/projects` — seluruhnya tetap HTTP 200 dengan konten benar.

**Pelajaran didokumentasikan di `docs/mockup-implementation-state.md` bagian 5** sebagai peringatan routing untuk section berikutnya — HTTP 200 saja tidak cukup untuk memvalidasi route dinamis baru, perlu verifikasi konten.

**Interactive/hydrated browser verification — tidak dilakukan** (tidak ada tool browser headless di lingkungan ini), tapi verifikasi konten via curl kali ini jauh lebih dalam dari section sebelumnya justru karena bug ini ditemukan — bukan sekadar cek status code.

## 14. Regression Checks

Lihat bagian 13 — seluruh route regresi (Dashboard, CRM overview, Prospects, Clients, Party Detail, Projects) diverifikasi ulang setelah fix dan tetap benar.

## 15. Cross-Section Impact

`docs/mockup-change-impact-log.md`: **CI-007** (fixture Opportunity/Quotation reactive + field baru, milik Section 05/06), **CI-008** (`PartyActivity.opportunityId` + backfill, milik Section 07), **CI-009** (Party Detail Opportunities tab ditaut ke detail, milik Section 07).

## 16. Review URLs

Tidak tersedia — lingkungan pengembangan lokal saja.

## 17. Known Issues dan Deferred Work

- **Q8 (tooling lint/typecheck/test) masih terbuka** — empat section berturut-turut (06, 07, 08) berjalan tanpa validasi otomatis penuh. **Sangat direkomendasikan** diselesaikan sebelum Section 09.
- **Penyederhanaan dari rancangan awal (didokumentasikan, bukan penyimpangan diam-diam):** "pipeline chart baru (Chart.js wrapper baru)" diimplementasikan sebagai reuse `StatusBreakdownList`; "stepper adaptasi `pages/projects/create.vue`" diimplementasikan sebagai rangkaian `StatusBadge` sederhana, bukan literal adaptasi wizard.
- Tidak ada UI untuk mengedit `requirementNotes`/`destination`/`travelStartDate`/`travelerEstimate` setelah opportunity dibuat (field-field ini hanya terisi lewat seed data) — belum ada scope eksplisit "edit opportunity" di Section 08, hanya "list/detail" dan transisi stage. Deferred ke section yang eksplisit meminta form edit Opportunity bila diperlukan.
- Detail quotation mandiri (`/crm/quotations/[id]`) tetap tidak dibuat, sesuai keputusan deferred `docs/mockup-information-architecture.md` bagian 6.2 — quotation dilihat kontekstual dari Opportunity Detail.
- Approve Won dan pembuatan Project **sengaja tidak diimplementasikan** — placeholder teks "Menunggu approval Management/Super Admin" ditampilkan untuk stage `won-requested`, sesuai hard rule Section 08.
- Bug routing (bagian 13) sudah diperbaiki dalam section ini — tidak ada known issue tersisa darinya, hanya catatan pencegahan untuk section berikutnya (`docs/mockup-implementation-state.md` bagian 5).

## 18. Protection Notes untuk Section Berikutnya

- **Jangan membuat file datar `app/pages/X.vue` bersanding direktori `app/pages/X/` yang juga punya route** — lihat bug routing bagian 13. Pola yang benar: `X/index.vue` + `X/[id]/index.vue` dalam direktori yang sama.
- Section 09 (Opportunity Won to Project) akan menambahkan aksi "Approve Won" pada `/crm/opportunities/[id]` di stage `won-requested` (saat ini hanya placeholder teks) — **integrasi ke halaman yang sudah ada**, bukan rewrite.
- `OPPORTUNITIES`/`QUOTATIONS` kini `reactive()` — lanjutkan pola ini untuk efek Won→Project (Section 09), bukan mekanisme state terpisah.
- `advanceOpportunityStage`/`createQuotation`/`reviseQuotation` (`app/data/index.ts`) — Section 09 sebaiknya memakai/memperluas helper ini untuk transisi `WonRequested → Won`, bukan menulis mutasi baru yang terpisah.
- `PartyActivity.opportunityId` — Section 09/14 dapat memanfaatkan untuk mencatat activity "Project dibuat dari Opportunity Won", tapi log utama efek Won sebaiknya tetap masuk `ActivityEntry` (project-scoped) sesuai checklist efek Won di `docs/route-and-role-matrix.md` bagian 2.2, bukan `PartyActivity`.

## 19. Recommended Next Section

Section 09 — Opportunity Won to Project (`prompts/11-PROMPT-9-OPPORTUNITY-WON-TO-PROJECT.md`), dengan rekomendasi sangat kuat menyelesaikan Q8 terlebih dahulu — empat section berturut-turut telah berjalan tanpa validasi otomatis penuh. Tidak dieksekusi otomatis — menunggu perintah user.
