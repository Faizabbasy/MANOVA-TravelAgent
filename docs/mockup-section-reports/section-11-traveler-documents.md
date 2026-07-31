# Section Report — Section 11: Traveler dan Travel Documents

**Status:** COMPLETED

Dikerjakan berdasarkan `prompts/SECTION_11_Traveler_Travel_Documents.md`. Section kedua belas roadmap Section 00–24 baru, dijalankan setelah Section 10 (Product Planning dan Costing, COMPLETED).

---

## 1. Section Objective dan Scope

"Lengkapi traveler management." Wajib: Traveler directory dan participants per Project Order; Group, rooming, companion; Passport/ID/visa metadata; Expiry and missing document warnings; Emergency contact, dietary, accessibility, special request; Client self-submission; Bulk import preview dan error report mock; Internal verification; Sensitive values masked sesuai role; Manifest/rooming list export preview; Readiness indicator. Acceptance: Traveler data digunakan konsisten oleh flight, hotel, transport, MICE, dan operations.

## 2. Source Documents yang Dibaca

`prompts/SECTION_11_Traveler_Travel_Documents.md`, `prompts/01-PROTOKOL WAJIB — CONTINUITY, DOKUMENTASI PER SECTION, DAN PERLINDUNGAN HASIL.md`, `CLAUDE.md`, seluruh `docs/mockup-*.md`, `docs/frontend-*.md`, `docs/mockup-section-reports/section-00-*.md` s/d `section-10-*.md` (termasuk `section-11-traveler-participant.md`, laporan Section 11 SKEMA LAMA), source code aktual (`app/types/project.ts`, `app/utils/attention.ts`, `app/utils/format.ts`, `app/data/index.ts`, `app/data/projects.ts`, `app/pages/projects/[id]/index.vue`, `app/pages/client/project-orders/[id]/index.vue`, `app/pages/crm/opportunities/[id]/quotation-preview.vue` sebagai pola print-preview reference), `git status`, `git log`.

## 3. Existing Implementation yang Diperiksa

`git status` menunjukkan Section 06–10 masih uncommitted (belum di-commit user, dicatat apa adanya, tidak diganggu). `docs/frontend-known-issues.md` bagian 9 dan `docs/frontend-implementation-roadmap.md` baris 11 menandai section ini `PARTIAL` — hanya `passportNumber`/`passportExpiryDate` yang di-track, visa/tiket/asuransi belum ada.

Audit langsung kode mengonfirmasi fondasi traveler/participant/group/rooming SUDAH COMPLETED sejak Section 11 skema lama (Prompt 11, `docs/mockup-section-reports/section-11-traveler-participant.md`): `Traveler`/`TravelerGroup`/`RoomAssignment` (`app/types/project.ts`), CRUD penuh (`createTraveler`/`updateTraveler`/`removeTraveler`), missing-document indicator (`isTravelerDocumentMissing`, hanya berbasis paspor), filter/search, role gate `canManageTravelers` (PM/Super Admin). "Client self-submission" DIKONFIRMASI sudah RESOLVED sejak Section 08 (Client Portal) — `app/pages/client/project-orders/[id]/index.vue` sudah memanggil `createTraveler`/`updateTraveler` langsung.

Gap konkret yang ditemukan (belum ada di manapun): ID/visa metadata; dietary/accessibility sebagai field terpisah (sebelumnya hanya `specialRequest` freeform); companion; internal verification (tidak ada konsep "staf mengonfirmasi dokumen sudah diperiksa", terpisah dari computed kelengkapan); sensitive value masking (nomor dokumen selalu tampil penuh ke seluruh role yang `canView('project')`); bulk import preview + error report (`importTravelersMock` lama langsung membuat baris tanpa tahap preview/validasi apa pun); manifest/rooming list export preview (tidak ada halaman print-friendly untuk data traveler, berbeda dari Quotation yang sudah punya sejak Section 05); readiness indicator (tidak ada agregat kesiapan data traveler per project).

## 4. Decisions yang Digunakan

D-068 (`docs/mockup-design-decisions.md`, baru) — Field traveler baru aditif pada model existing (bukan entitas paralel); visa dievaluasi kondisional (hanya bila diisi); sensitive value masking berbasis role; bulk import diganti alur preview+commit dua tahap; manifest export preview mengikuti pola `quotation-preview.vue` (D-062); readiness indicator scoped ke kesiapan data traveler (terpisah dari readiness checklist agregat Section 12).

## 5. Implementation Summary

**Passport/ID/visa metadata** — `Traveler` (`app/types/project.ts`) +`idNumber`/`visaNumber`/`visaExpiryDate` (seluruhnya opsional). Form tambah/edit (internal dan Client Portal) diperkaya dengan field ini.

**Expiry and missing document warnings** — `isTravelerDocumentMissing` (`app/utils/attention.ts`) diperluas: bila `visaNumber` terisi, `visaExpiryDate` wajib ada dan tidak boleh kedaluwarsa sebelum keberangkatan (pola sama passport). Traveler TANPA `visaNumber` sama sekali tidak terpengaruh (regression-safe terhadap 16 dari 17 traveler existing).

**Emergency contact, dietary, accessibility, special request** — `dietaryRestrictions`/`accessibilityNeeds` (baru) dipisah dari `specialRequest` (tetap ada sebagai "lainnya" freeform). Ditampilkan sebagai kolom "Catatan" gabungan di tabel (ringkas) dan baris terpisah di manifest preview.

**Group, rooming, companion** — `companionOfTravelerId` (baru) mereferensikan `Traveler.id` lain di project yang sama. Dropdown "Mendampingi Traveler Lain" di form (mengecualikan diri sendiri), ditampilkan sebagai teks "Mendampingi: {nama}" di bawah nama traveler pada tabel.

**Client self-submission** — dikonfirmasi sudah RESOLVED sejak Section 08 (reuse `createTraveler`/`updateTraveler` apa adanya). Section ini memperkaya form `/client/project-orders/[id]` dengan field baru yang sama (ID/visa/dietary/accessibility) — Client kini dapat submit data selengkap form internal (kecuali companion/internal verification yang tetap internal-only, lihat bagian 12).

**Bulk import preview dan error report mock** — `importTravelersMock` lama (langsung membuat baris) DIHAPUS (lihat CI-041), diganti `previewTravelerImportMock(projectId, count)` (murni baca, menghasilkan `TravelerImportPreviewRow[]` dengan `errors[]` — baris ke-2 sengaja nama kosong, baris ke-4 sengaja paspor duplikat dengan traveler existing) dan `commitTravelerImport(projectId, rows)` (hanya membuat baris `errors.length === 0`). UI: tombol "Import (Mock)" membuka dialog preview (tabel Nama/Nomor Paspor/Status dengan badge Valid/Error + alasan), tombol "Import Baris Valid (N)" mengeksekusi commit, hasil (N berhasil, M gagal) ditampilkan di dialog yang sama sebelum ditutup.

**Internal verification** — `toggleTravelerVerification(travelerId, actorId)` (baru) — toggle tunggal (verify/unverify), mencatat `documentsVerifiedAt`/`documentsVerifiedBy`. UI: badge "Terverifikasi"/"Belum Diverifikasi" yang bisa diklik (PM/Super Admin), read-only untuk role lain.

**Sensitive values masked sesuai role** — `maskDocumentNumber` (baru, `app/utils/format.ts`) menyisakan 4 karakter terakhir. Hanya `canManageTravelers` (PM/Super Admin) yang melihat nomor paspor/ID/visa penuh — role lain melihat versi masked, baik di tabel dashboard maupun manifest print preview (satu fungsi dipakai konsisten di kedua tempat). Client Portal TIDAK di-masking (data milik company sendiri).

**Manifest/rooming list export preview** — `/projects/[id]/manifest-preview.vue` (baru), `layout: false`, print via `window.print()` — pola IDENTIK `quotation-preview.vue` (Section 05, D-062). Menampilkan tabel traveler (nama/group/paspor/kontak darurat/catatan/status) + tabel rooming list, dengan masking yang sama berdasarkan role viewer.

**Readiness indicator** — `getTravelerReadiness(projectId)` (baru, derivasi murni) mengembalikan `{ total, documentsCompleteCount, verifiedCount, roomingAssignedCount, readinessPercent }`. Ditampilkan sebagai 4 stat tile di atas tabel tab Travelers.

## 6. Routes

1 route baru: `/projects/[id]/manifest-preview`. Tidak ada route existing yang di-rename/dihapus. `/projects/[id]` (tab Travelers) dan `/client/project-orders/[id]` (tab Travelers) diperkaya pada route yang sama.

## 7. Files Created, Changed, dan Removed

**Created:**
- `app/pages/projects/[id]/manifest-preview.vue`
- `docs/mockup-section-reports/section-11-traveler-documents.md` (laporan ini)

**Changed:**
- `app/types/project.ts` (`Traveler` +7 field aditif: `idNumber`/`visaNumber`/`visaExpiryDate`/`dietaryRestrictions`/`accessibilityNeeds`/`companionOfTravelerId`/`documentsVerifiedAt`/`documentsVerifiedBy`)
- `app/utils/attention.ts` (`isTravelerDocumentMissing` diperluas mengevaluasi visa kondisional)
- `app/utils/format.ts` (+`maskDocumentNumber`)
- `app/data/index.ts` (`CreateTravelerInput` +6 field, `importTravelersMock` DIHAPUS, +`toggleTravelerVerification`, `+getTravelerReadiness`/`TravelerReadinessSummary`, `+previewTravelerImportMock`/`TravelerImportPreviewRow`, `+commitTravelerImport`)
- `app/data/projects.ts` (backfill selektif field baru pada 9 dari 17 traveler existing, lihat `docs/mockup-data-scenarios.md` bagian 4n)
- `app/pages/projects/[id]/index.vue` (tab Travelers ditulis ulang: readiness tile, kolom dokumen/catatan gabungan, masking, verifikasi, companion, dialog import preview menggantikan tombol langsung)
- `app/pages/client/project-orders/[id]/index.vue` (form traveler +5 field: ID/visa/visa-expiry/dietary/accessibility, tabel +kolom Visa dan Catatan)
- `docs/mockup-design-decisions.md` (+D-068)
- `docs/mockup-change-impact-log.md` (+CI-041)
- `docs/mockup-data-scenarios.md` (+bagian 4n)
- `docs/frontend-module-map.md`, `docs/frontend-workflow-map.md`, `docs/frontend-implementation-roadmap.md`, `docs/frontend-known-issues.md`
- `docs/mockup-implementation-state.md`, `docs/mockup-progress.md` (+Entri 20), `docs/mockup-section-progress.md`
- `docs/mockup-section-reports/README.md`

**Removed:** Tidak ada file (fungsi `importTravelersMock` dihapus dari `app/data/index.ts`, bukan file terpisah).

## 8. Components Reused/Created

Reused sepenuhnya: `SectionCard`, `Table`/`TableHeader`/`TableBody`/`TableRow`/`TableHead`/`TableCell`/`TableEmpty`, `Dialog`/`DialogTrigger`/`DialogContent`/`DialogScrollContent`/`DialogHeader`/`DialogTitle`/`DialogDescription`/`DialogFooter`, `Button`, `Input`, `Label`, `Checkbox`, `StatusBadge`, `EmptyState`, `RoleAccessState`, `useToast`. Tidak ada shared component baru — halaman manifest preview mengikuti pola `quotation-preview.vue` persis (print-friendly, `layout: false`, bukan komponen `ui/*` baru).

## 9. Types/Constants/Fixtures/Mock State

`Traveler` +7 field aditif (opsional, seluruh traveler existing tetap valid tanpa migrasi). `+TravelerReadinessSummary`/`TravelerImportPreviewRow` (type baru, `app/data/index.ts`). Fixture: 9 dari 17 traveler existing diberi field baru selektif (lihat `docs/mockup-data-scenarios.md` bagian 4n) — tidak ada traveler/group/room baru dibuat, murni memperkaya data existing.

## 10. Responsive Behavior

Tidak ada pola baru — readiness tile memakai `grid-cols-2 sm:grid-cols-4`, form dialog memakai `DialogScrollContent` (sudah ada) untuk mengakomodasi field yang bertambah banyak di layar kecil. Manifest preview mengikuti pola print-responsive `quotation-preview.vue` (`max-w-4xl`, `print:` utility classes).

## 11. States (Loading/Empty/Error/Unauthorized/Not-Found)

- `RoleAccessState` untuk `!canView('project')` (tidak berubah).
- Not-found: `manifest-preview.vue` menampilkan `EmptyState` "Project tidak ditemukan" untuk ID yang tidak ada (pola sama `quotation-preview.vue`).
- Import preview: badge "Valid"/"Error" per baris + daftar alasan error; ringkasan jumlah berhasil/gagal ditampilkan setelah commit.
- Empty state existing ("Belum ada traveler tercatat") tidak berubah.
- Tombol aksi (Edit/Hapus/Import/Verifikasi) tetap digerbangi `canManageTravelers` (PM/Super Admin) — role lain read-only, dengan catatan tambahan "nomor dokumen ditampilkan tersamar" untuk role tanpa akses penuh.

## 12. Role Behavior

`canManageTravelers` (PM/Super Admin, narrow-role-exception existing Section 11 lama) tetap menggerbangi seluruh CRUD dan aksi baru (import, verifikasi). **Baru:** gate masking — hanya `canManageTravelers` yang melihat nomor paspor/ID/visa penuh; role lain (Management, Finance, Sales, AE, Ticketing/Accommodation/Transportation/MICE, Viewer) melihat versi masked. Client (self-submission) tidak digerbangi `canManageTravelers` sama sekali — isolasi lewat `clientScopeId` existing (Section 08), dan tidak di-masking (melihat data traveler company sendiri, bukan pihak lain).

## 13. Validation Commands dan Hasilnya

- `npx nuxi prepare` — **sukses**.
- `npm run build` — **sukses** (2x run).
- `npx nuxi typecheck` — gagal, `vue-tsc` belum terpasang (Q8, pre-existing gap, 11 section berturut-turut).
- `npm run lint` — tidak tersedia (Q8, pre-existing).
- `npx vitest run` — "No test files found" (pre-existing).
- **Smoke test HTTP** — `/projects/PRJ-101`/`102`/`103?tab=travelers`, `/projects/PRJ-101/manifest-preview`, `/projects/PRJ-999/manifest-preview` (not-found), `/client/project-orders/PRJ-101?tab=travelers`, plus regresi `/`, `/crm/opportunities`, `/crm/opportunities/OPP-009`, `/product-planning`, `/vendors`, `/finance`, `/admin/roles`, `/settings` — **seluruhnya HTTP 200**.
- **Smoke test konten** (curl+grep):
  - PRJ-101: readiness tile menunjukkan "Dokumen Lengkap" 6/6 (grep menghitung 7 kemunculan termasuk label stat tile itu sendiri, dikonfirmasi bukan anomali), "Terverifikasi" 1/6 (TRV-1011), companion "Mendampingi: Hendra Wijaya" tampil untuk Nadia Puspita — seluruhnya cocok fixture yang dihitung ulang manual.
  - PRJ-102: 3/6 "Dokumen Belum Lengkap" — `TRV-1023` (tanpa paspor), `TRV-1022` (paspor kedaluwarsa 115 hari sebelum keberangkatan, <180 hari ambang), `TRV-1025` (visa TANPA tanggal kedaluwarsa — kondisi BARU, dikonfirmasi aturan visa bekerja, sebelumnya "Dokumen Lengkap"). `TRV-1021` (visa lengkap) tetap "Dokumen Lengkap" — mengonfirmasi visa lengkap TIDAK memicu status tidak lengkap.
  - `/projects/PRJ-103/manifest-preview`: menampilkan "MANIFEST", "Rooming List", "Twin 101", "Suite VIP 1" — konten manifest dan rooming list ter-render benar.
  - `/client/project-orders/PRJ-101?tab=travelers`: menampilkan "Tidak Ditemukan" di bawah role default demo (Super Admin, tanpa `clientScopeId`) — **perilaku existing sejak Section 08** (D-065, dikonfirmasi bukan regresi baru; verifikasi konten Client-facing sesungguhnya tetap memerlukan role switch interaktif yang tidak dapat dilakukan headless).
  - Regresi 8 route representatif lintas modul lain dikonfirmasi tidak berubah.
- **Verifikasi interaktif** (klik dialog import preview lalu commit, toggle verifikasi, ganti role untuk membuktikan masking tersamar, print manifest) **tidak dilakukan headless** — keterbatasan tooling konsisten sejak Section 06. Dimitigasi lewat code review ketat terhadap seluruh guard (`toggleTravelerVerification`, `previewTravelerImportMock`/`commitTravelerImport`, kondisi masking `canManageTravelers.value ? full : maskDocumentNumber(...)`) dan smoke test SSR konten yang membuktikan kalkulasi readiness dan kondisi visa baru bekerja benar untuk 3 skenario project berbeda.

## 14. Regression

`app/pages/projects/[id]/index.vue` (dimiliki Section 11 lama — tab Travelers ditulis ulang, tab lain TIDAK disentuh, dikonfirmasi via smoke test `?tab=overview`/`?tab=itinerary-services`/`?tab=finance` tidak berubah). `app/pages/client/project-orders/[id]/index.vue` (dimiliki Section 08 — hanya tab Travelers yang diperkaya, tab Overview/Itinerary/Documents/Finance/Change Request tidak disentuh). `app/data/index.ts` (`importTravelersMock` dihapus — satu-satunya pemanggil sudah diperbarui bersamaan, tidak ada consumer lain yang patah, dikonfirmasi lewat grep sebelum dan sesudah perubahan). `isTravelerDocumentMissing` (dipakai lintas `/projects/[id]`, `/client/project-orders/[id]`, dan selektor `getTravelersMissingDocuments`) — perubahan aditif (kondisional pada `visaNumber`) dikonfirmasi tidak mengubah hasil untuk traveler yang belum diberi visa (16 dari 17).

## 15. Cross-Section Impact

`docs/mockup-change-impact-log.md` CI-041 — `importTravelersMock` (Section 11 lama) dihapus diganti alur preview+commit, form traveler Client Portal (Section 08) diperkaya field baru — keduanya aditif, regression-tested.

## 16. Known Issues dan Deferred Work

- Q8 (tooling lint/typecheck/test) tetap terbuka — 11 section berturut-turut.
- Tiket dan asuransi TETAP tidak ada field/UI — di luar Wajib literal Section 11 (tidak disebutkan dalam scope), `KNOWN_GAP` eksplisit di `docs/frontend-known-issues.md`, bukan gap tersembunyi.
- Verifikasi interaktif tidak dilakukan headless (keterbatasan tooling, konsisten sejak Section 06).
- Readiness indicator (Section 11) scoped ke data traveler saja — readiness checklist/matrix agregat lintas-domain (booking/payment/dst.) tetap `KNOWN_GAP` terpisah, milik Section 12.
- Companion bersifat single-link sederhana (satu `companionOfTravelerId` per traveler) — bukan grup keluarga/multi-companion penuh, cukup untuk mendemokan konsep.

## 17. Protection Notes untuk Section Berikutnya

`Traveler` (D-068) — field baru bersifat aditif, jangan direstrukturisasi jadi entitas terpisah. `isTravelerDocumentMissing` — evaluasi visa TETAP kondisional (hanya bila `visaNumber` terisi); jangan diubah jadi wajib universal tanpa keputusan baru (akan mengubah status seluruh fixture yang belum diberi visa). `maskDocumentNumber`/gate `canManageTravelers` untuk sensitive values — berlaku di SELURUH titik tampilan nomor dokumen (tabel dashboard, manifest preview); section berikutnya yang menambah titik tampilan baru (mis. laporan/print lain yang menampilkan data traveler) WAJIB menerapkan masking yang sama. `getTravelerReadiness` — scoped ke kesiapan data traveler saja; JANGAN dianggap sebagai readiness checklist lengkap Section 12 (booking/payment/dst. tetap terpisah).

## 18. Review URLs

Tidak ada deployment publik. Untuk review lokal: `npm run dev`, buka `http://localhost:8080/projects/PRJ-102?tab=travelers` untuk melihat readiness tile dan kondisi visa baru (Citra Ananda kini "Dokumen Belum Lengkap"). Buka `http://localhost:8080/projects/PRJ-103/manifest-preview` untuk melihat manifest/rooming list print preview. Buka `http://localhost:8080/projects/PRJ-101?tab=travelers` dan klik "Import (Mock)" untuk mencoba alur preview+error report.

## 19. Recommended Next Section

**Section 12 — Itinerary, Operations, Tasks dan Readiness** (readiness checklist/matrix agregat lintas-domain, departure countdown/alert eksplisit, run sheet — status PARTIAL), berbasis dependency (`docs/frontend-implementation-roadmap.md`) — menunggu perintah eksplisit user.
