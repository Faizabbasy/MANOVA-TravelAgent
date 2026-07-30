# Section 14 — Project Changes

**Status:** COMPLETED

Dikerjakan berdasarkan `prompts/16-PROMPT-14-PROJECT-CHANGES.md`, dijalankan lewat `prompts/99-RUN-CURRENT-SECTION.md` atas perintah user.

---

## 1. Section Objective dan Scope

Mengisi tab "Activity & Changes" pada Project Detail (baseline Foundation sejak Section 05 — hanya pesan datar + badge Reviewed/Belum Direview) dengan: change list/detail (category, reason, requester, tanggal, before/after), dampak ke traveler/itinerary/service/vendor/budget, status dan approval mock, change timeline, attention indicator, states, dan role access. **Tidak mengerjakan** tab lain (Finance — tetap baseline Foundation, menyusul Section 15), tidak menyentuh Overview/Travelers/Itinerary & Services/Vendors (Section 10/11/12/13) kodenya, tidak menyentuh `hasUnreviewedChange`/Dashboard (Section 06, LOCKED).

## 2. Source Documents yang Dibaca

`prompts/01-PROTOKOL WAJIB — CONTINUITY, DOKUMENTASI PER SECTION, DAN PERLINDUNGAN HASIL.md`, `prompts/16-PROMPT-14-PROJECT-CHANGES.md`, `CLAUDE.md`, seluruh `docs/*.md` (implementation-state, section-progress, change-impact-log, data-scenarios, design-decisions, information-architecture bagian 4, route-and-role-matrix bagian 3.3/5.1), `docs/mockup-section-reports/section-05-foundation.md` s/d `section-13-vendor-management.md`, source code aktual (`app/types/activity.ts`, `app/data/activity.ts`, `app/data/index.ts`, `app/constants/status.ts`, `app/utils/attention.ts`, `app/composables/usePermissions.ts`, `app/composables/useCurrentUser.ts`, `app/pages/projects/[id]/index.vue`), `git status`/`git log`.

## 3. Existing Implementation yang Diperiksa

Tab "Activity & Changes" sejak Section 05 menampilkan `ActivityEntry[]` (`id/projectId/message/isChange/reviewed/createdAt`) dengan toggle "All/Changes only" dan badge Reviewed/Belum Direview — tidak ada kategori/requester/before-after/impact/approval. `hasUnreviewedChange`/`isProjectNeedingAttention` (`app/utils/attention.ts`, Section 06, LOCKED) membaca `isChange`/`reviewed` dari array yang sama — dikonfirmasi tidak disentuh. 4 entri `CHG-*` existing (PRJ-102 ×3, PRJ-103 ×1) sudah merepresentasikan skenario High-Change secara naratif (message teks) tapi tanpa struktur data. `git log`/`git status` dikonfirmasi bersih (kecuali `prompts/99-RUN-CURRENT-SECTION.md` yang diedit user), commit terakhir `19f21b9 "SECTION15-VENDOR-MANAGEMENT"`.

## 4. Decisions yang Digunakan

D-038 (sentralisasi status constants — `CHANGE_CATEGORIES`/`CHANGE_APPROVAL_STATUSES` ditambahkan ke `app/constants/status.ts`), IA bagian 4 (LOCKED — "Activity & Changes... data berasal dari satu sumber log yang sama... bukan dua sumber data terpisah", dasar keputusan memperluas `ActivityEntry` alih-alih membuat entitas `Change` baru), Route Matrix bagian 5.1 (Action Flag "Approve — Super Admin, Management", dipakai apa adanya untuk gerbang Setujui/Tolak, bukan permission baru), pola approval dua-langkah Section 09/13 (ajukan → setujui/tolak) direplikasi untuk konsistensi UX.

## 5. Implementation Summary dan User Flow

- **Change list/detail:** tiap entry `isChange` kini menampilkan badge kategori, badge status approval, before/after, requester (nama, via `getUserById`), catatan dampak, dan tanggal — seluruhnya inline di baris yang sama (tidak ada route detail terpisah, konsisten prinsip single-route D-027; sama seperti pendekatan "profil = tampilan diperkaya" di Section 11/13).
- **Category, reason, requester, date, before/after:** field baru aditif pada `ActivityEntry`, diisi untuk 4 entri `CHG-*` existing (enrichment, bukan record baru) dan untuk entry baru via dialog "Catat Perubahan".
- **Traveler, itinerary, service, vendor, budget impact:** `category: ChangeCategory` (`traveler`/`itinerary`/`service`/`vendor`/`budget`/`other`) + `impactNote` bebas teks untuk deskripsi dampak spesifik (mis. "Actual cost meningkat ~Rp25.000.000").
- **Status dan approval mock:** `approvalStatus` (`pending`/`approved`/`rejected`), terpisah dari `reviewed` (LOCKED, Section 06). Tombol "Setujui"/"Tolak" tampil untuk entry `pending`, digerbangi `canApprove('project')` (Management/Super Admin — reuse `usePermissions`, bukan mekanisme baru). Aksi mock eksplisit — dialog dan toast menyatakan ini simulasi, tidak ada klaim workflow approval sungguhan.
- **Change timeline:** mode "Changes only" kini diurutkan kronologis ascending (`createdAt`) dengan left-border berwarna sesuai status approval (kuning=pending, hijau=approved, merah=rejected) — pola visual timeline sederhana tanpa komponen baru.
- **Attention indicator:** `AttentionIndicator` (shared component, Section 05) ditampilkan untuk entry `approvalStatus: 'pending'`.
- **States:** empty state existing dipertahankan; tidak ada state baru selain yang sudah ada.
- **Role access:** `canView('project')` tetap gerbang tab (tidak berubah). **Baru:** `canLogChange` (PM, Operations, Ticketing, Accommodation, Transportation, MICE, Super Admin — siapa pun yang berpotensi mengajukan perubahan di area kerjanya) untuk dialog "Catat Perubahan"; `canApproveChanges` (`canApprove('project')` generik — Management, Super Admin) untuk Setujui/Tolak.

**User flow yang bisa didemokan:** buka `/projects/PRJ-102?tab=activity-changes` sebagai Management → lihat 3 change: 2 "Disetujui" (tanggal, traveler count) dan 1 "Menunggu Approval" (upgrade kamar Deluxe→Suite, diajukan Maya Putri/Accommodation, dampak "Actual cost meningkat ~Rp25.000.000") dengan tombol "Setujui"/"Tolak" → klik "Setujui" → toast "Perubahan Disetujui" → badge berubah "Disetujui", tombol hilang, `AttentionIndicator` hilang → beralih role ke Project Manager → klik "Catat Perubahan" → isi kategori "Vendor", alasan "Vendor transportasi mengganti armada" → simpan → entry baru muncul berstatus "Menunggu Approval" (role PM tidak melihat tombol Setujui/Tolak pada entry manapun, hanya Management/Super Admin yang bisa).

## 6. Routes

Tidak ada route baru. `/projects/[id]` (tab `activity-changes`) diisi penuh.

## 7. Files Created, Changed, dan Removed

**Created:** `docs/mockup-section-reports/section-14-project-changes.md`.

**Changed:**
- `app/types/activity.ts` — `+ChangeCategory`, `+ChangeApprovalStatus`; `ActivityEntry` +7 field opsional.
- `app/data/activity.ts` — 4 baris `CHG-*` existing diperkaya field baru (bukan record baru).
- `app/constants/status.ts` — `+CHANGE_CATEGORIES`, `+CHANGE_APPROVAL_STATUSES`.
- `app/data/index.ts` — `+createChangeEntry`, `+approveChangeEntry`, `+rejectChangeEntry`.
- `app/pages/projects/[id]/index.vue` — tab "Activity & Changes" diperkaya (dialog Catat Perubahan, detail per-entry, Setujui/Tolak, timeline kronologis); tab lain **tidak diubah** (diverifikasi smoke test, bagian 13).

**Removed:** Tidak ada.

## 8. Components Reused dan Created

**Reused:** `Dialog*`, `Label`, `Input`, `Button`, `SectionCard` (+`#actions`), `StatusBadge`, `AttentionIndicator`, `EmptyState`, `useToast`/`ToastContainer` — seluruhnya dipakai apa adanya.

**Created:** Tidak ada file komponen baru.

## 9. Types, Constants, Fixtures, dan Mock State

Lihat bagian 7 dan `docs/mockup-change-impact-log.md` (CI-016). Ringkasan: 4 `ActivityEntry` existing diperkaya (bukan record baru), `+CHANGE_CATEGORIES` (6 opsi), `+CHANGE_APPROVAL_STATUSES` (3 opsi).

## 10. Responsive Behavior

Entry list tetap `divide-y divide-border` (pola existing); badge kategori/approval memakai `flex-wrap` agar tidak overflow di layar sempit; area aksi (Setujui/Tolak) `flex-col items-end` terpisah dari konten utama. Tidak diverifikasi lewat browser interaktif — tidak ada tool headless browser tersedia (konsisten keterbatasan sejak Section 06).

## 11. Loading, Empty, Error, Not-Found, dan Unauthorized States

- **Loading:** Tidak ada simulasi baru.
- **Empty:** `EmptyState` existing dipertahankan (`visibleActivities.length === 0`).
- **Error:** Tidak ada state error baru.
- **Not-found:** Tidak berubah dari Section 05 — diverifikasi ulang tetap benar (`PRJ-999`).
- **Unauthorized:** `RoleAccessState` untuk `!canView('project')` — tidak berubah (gerbang halaman, bukan gerbang tab).

## 12. Role Behavior

`canView('project')` tetap gerbang akses halaman. **Baru:** `canLogChange` (narrow list — PM/Operations/role sub-domain/Super Admin, pola sama dengan `SERVICE_TYPE_ROLE_MAP` full-access-role di Section 12) untuk mengajukan Change; `canApproveChanges` (`canApprove('project')` generik, **tidak perlu pengecualian sempit** — Management memang dimaksudkan untuk approve per Route Matrix bagian 5.1) untuk Setujui/Tolak.

## 13. Validation Commands dan Hasilnya

- `npx nuxi prepare` — **sukses**.
- `npm run build` — **sukses (exit 0)**.
- `npx vitest run` — "No test files found" (pre-existing, Q8).
- `npx nuxi typecheck` — gagal, `vue-tsc` tidak terpasang (Q8, pre-existing).
- Lint — tidak tersedia (Q8, pre-existing).
- **Smoke test konten mendalam** (curl + grep):
  - `/projects/PRJ-102?tab=activity-changes` — HTTP 200; badge "Disetujui" ×2, "Menunggu Approval" ×2 (1 badge status + 1 AttentionIndicator, dari satu entry `pending` yang sama — bukan duplikasi bug), tombol "Setujui"/"Tolak" masing-masing ×1 (cocok 1 entry `pending`), "Sebelum: Deluxe"/"Sesudah: Suite" tampil, "Diajukan oleh: Maya Putri" tampil, "Dampak: Actual cost..." tampil, kategori "Itinerary"/"Service"/"Traveler" masing-masing ×1 (cocok 3 entry PRJ-102).
  - `/projects/PRJ-103?tab=activity-changes` — HTTP 200; kategori "Traveler" ×1, "Disetujui" ×1, "Sebelum: 20 pax"/"Sesudah: 25 pax" tampil.
  - Tombol "Catat Perubahan" terkonfirmasi ter-render (role default demo Super Admin, `canLogChange` true).
  - Tidak ditemukan string "Internal Server Error"/"TypeError"/"is not defined" di HTML manapun.
  - **Regresi tab lain** — `?tab=overview`, `?tab=travelers`, `?tab=itinerary-services`, `?tab=vendors` tetap HTTP 200 tanpa perubahan konten; Dashboard (`/`) tetap HTTP 200.
- **Verifikasi interaktif** (klik Setujui/Tolak, klik Catat Perubahan, ganti role dan cek tombol hilang) **tidak dilakukan** — tidak ada tool browser headless (keterbatasan konsisten sejak Section 06). Dimitigasi lewat code review ketat terhadap `approveChangeEntry`/`rejectChangeEntry`/`createChangeEntry` (pola mutasi identik dengan Section 07/09/11/12/13 yang sudah terverifikasi konten-nya).

## 14. Regression Checks

Section 05 (shell 8-tab, tidak diubah strukturnya), Section 06 (`hasUnreviewedChange`/`isProjectNeedingAttention`/Dashboard — dikonfirmasi tidak disentuh, field baru murni aditif), Section 10/11/12/13 (Overview/Travelers/Itinerary & Services/Vendors — tidak disentuh, dikonfirmasi smoke test) — seluruhnya diverifikasi tidak beregresi.

## 15. Cross-Section Impact

**Satu entri baru:** CI-016 (`docs/mockup-change-impact-log.md`) — `ActivityEntry` (Section 05) diperluas dengan field Change (aditif). Sesuai hard rule "Dashboard/Project integration minimal wajib dicatat sebagai impact": Section 14 **tidak mengubah kode Dashboard** — integrasi terjadi otomatis lewat selector/computed existing (`isProjectNeedingAttention`, Recent Activity Overview) yang sudah membaca `ACTIVITIES` sejak Section 06/10, sehingga entry baru/berubah otomatis mengalir tanpa perubahan kode tambahan di luar `app/data/*`.

## 16. Review URLs

Tidak tersedia — lingkungan pengembangan lokal saja (`npm run dev` / `node .output/server/index.mjs`, tidak ada deployment publik).

## 17. Known Issues dan Deferred Work

- **Q8 (tooling lint/typecheck/test) masih terbuka** — **sepuluh section berturut-turut** (06–14) berjalan tanpa validasi otomatis penuh.
- Tidak ada route/halaman detail terpisah untuk satu Change — detail ditampilkan inline di baris yang sama (konsisten prinsip single-route, bukan keterbatasan tak disengaja).
- CRUD hapus Change tidak diimplementasikan — scope tidak meminta delete, hanya create (log) dan approve/reject.
- Verifikasi interaktif (klik Setujui/Tolak/Catat Perubahan, ganti role) tidak dilakukan langsung (keterbatasan tooling lingkungan, konsisten sejak Section 06).

## 18. Protection Notes untuk Section Berikutnya

- Tab "Activity & Changes" kini sumber lengkap untuk change detail/approval — Section 15 (Project Finance) dan berikutnya **tidak perlu** menduplikasi ringkasan ini; bila Finance butuh referensi dampak budget dari sebuah Change, baca `ActivityEntry.category === 'budget'`/`impactNote` langsung, jangan buat log dampak budget paralel.
- `ActivityEntry`/`ChangeCategory`/`ChangeApprovalStatus` di `app/types/activity.ts` — jangan diubah shape-nya tanpa cross-section impact check; gunakan mutator existing (`createChangeEntry`, `approveChangeEntry`, `rejectChangeEntry`).
- **`reviewed` (Section 06, LOCKED) dan `approvalStatus` (Section 14) adalah dua flag terpisah** — jangan menyatukan maknanya tanpa memperbarui `hasUnreviewedChange`/`isProjectNeedingAttention` (`app/utils/attention.ts`) sekaligus, dan catat sebagai cross-section impact bila dilakukan.
- Overview/Travelers/Itinerary & Services/Vendors (Section 10/11/12/13) **tidak disentuh** — perubahan apa pun pada tab tsb ke depannya harus jelas kepemilikannya.

## 19. Recommended Next Section

Section 15 — Project Finance (`prompts/17-PROMPT-15-PROJECT-FINANCE.md`), dengan rekomendasi sangat kuat menyelesaikan Q8 terlebih dahulu — sepuluh section berturut-turut telah berjalan tanpa validasi otomatis penuh. Tidak dieksekusi otomatis — menunggu perintah user.
