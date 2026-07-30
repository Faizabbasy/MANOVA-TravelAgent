# Final Known Issues — MANOVA Travel Agent Mockup

Dokumen ini mendokumentasikan **seluruh known issues, batasan, dan deferred items** pada titik akhir implementasi mockup (Section 18 — Regression and Demo Readiness). Dibedakan antara isu pre-existing, isu yang disengaja (by design), dan isu yang ditemukan pada Section 18.

> Semua isu di sini bukan "bug tersembunyi" — semuanya terdokumentasi dan sudah diketahui tim.

---

## Kategori A — Pre-existing (Sebelum Section 05)

### A-001: Tailwind CSS Ambiguity Warning pada Dialog Animation Classes
- **Lokasi:** Build output (Tailwind CSS compiler)
- **Deskripsi:** Kelas `data-[state=closed]:slide-out-to-top-[48%]` dan `data-[state=open]:slide-in-from-top-[48%]` menghasilkan warning "is ambiguous and matches multiple utilities" dari Tailwind v3.
- **Root cause:** Berasal dari class string yang di-generate oleh `shadcn-nuxt` / `reka-ui` Dialog primitives.
- **Impact:** Hanya warning di console build — tidak ada visual regression. Dialog berfungsi normal.
- **Status:** Pre-existing, bukan introduced oleh Section manapun. Tidak difix karena komponen shadcn-nuxt tidak boleh dimodifikasi langsung (CLAUDE.md).
- **Mitigation:** Tidak ada — dapat di-ignore oleh audience demo.

### A-002: `EBUSY` Error saat Nitro Build pada Windows
- **Lokasi:** `npm run build` di Windows
- **Deskripsi:** Setelah build selesai, Nitro mencoba menghapus direktori `.output` lama dan mendapat error `EBUSY: resource busy or locked, rmdir '.output'`.
- **Impact:** Build tetap menghasilkan output yang valid — error terjadi di langkah final cleanup, setelah seluruh file sudah di-generate.
- **Status:** Pre-existing Windows filesystem behavior. Tidak ada code fix yang diperlukan.
- **Mitigation:** Jalankan `npm run build` dua kali berturut-turut atau close semua file explorer yang membuka direktori `.output`.

### A-003: Tidak Ada File Test (`vitest run` gagal dengan exit 1)
- **Lokasi:** `vitest`, `@vue/test-utils`, `jsdom` terpasang sebagai devDependency
- **Deskripsi:** Tidak ada satu pun file test (`*.test.ts`, `*.spec.ts`) yang dibuat selama 18 section implementasi.
- **Impact:** `npx vitest run` selalu gagal dengan "No test files found, exiting with code 1".
- **Status:** Pre-existing gap (Q8 di `docs/mockup-open-questions.md`). Infrastruktur testing tersedia tapi belum dipakai karena prioritas diberikan ke implementasi fitur.
- **Mitigation:** Untuk demo, gunakan `npm run dev` dan pengujian manual.

### A-004: `vue-tsc` Tidak Terpasang — Typecheck Tidak Bisa Dijalankan
- **Lokasi:** `devDependencies` tidak memuat `vue-tsc`
- **Deskripsi:** `npx nuxi typecheck` membutuhkan `vue-tsc` yang belum diinstal.
- **Impact:** Tidak ada typecheck otomatis. TypeScript error hanya terdeteksi pada level editor (IDE).
- **Status:** Pre-existing gap (Q8). `nuxt.config.ts` secara eksplisit men-set `typeCheck: false`.
- **Mitigation:** TypeScript non-strict mode dan Nuxt auto-import sudah menangkap sebagian besar kesalahan tipe.

### A-005: Tidak Ada ESLint Config
- **Lokasi:** Root project — tidak ada `.eslintrc.*` atau `eslint.config.*`
- **Deskripsi:** `@nuxtjs/eslint-config-typescript` terpasang sebagai devDependency tapi tidak pernah dikonfigurasi.
- **Impact:** Tidak ada linting otomatis.
- **Status:** Pre-existing gap (Q8).

---

## Kategori B — By Design (Keputusan Deliberate)

### B-001: `/crm/quotations` Masih Placeholder (`ModulePlaceholder`)
- **Lokasi:** `app/pages/crm/quotations.vue`
- **Deskripsi:** Halaman `/crm/quotations` menampilkan `ModulePlaceholder` dengan phase "CRM".
- **Root cause:** Quotations list global (lintas opportunity) tidak termasuk dalam scope yang sudah dieksekusi (Section 08 hanya implementasi quotation di dalam Opportunity Detail).
- **Impact:** Route `/crm/quotations` dapat diakses tapi menampilkan placeholder. Nav item di sidebar bertanda `comingSoon: true`.
- **Status:** By design — deferred, bukan bug. Quotation per-opportunity sudah lengkap di `/crm/opportunities/[id]`.

### B-002: Data Mutasi Tidak Persisten (Reset saat Reload)
- **Lokasi:** Seluruh `reactive()` array di `app/data/*.ts`
- **Deskripsi:** Semua operasi create/update/approve tersimpan di Vue reactive state dalam memori browser. Reload halaman mereset ke fixture awal.
- **Root cause:** Desain mockup frontend-only tanpa backend.
- **Impact:** Audience demo harus aware bahwa data tidak persistent.
- **Status:** By design — sesuai scope Prompt 0. Backend tidak diimplementasikan.

### B-003: Routes Template Lama Masih Accessible via URL
- **Lokasi:** `app/pages/tasks.vue` (`/tasks`) dan `app/pages/expenses.vue` (`/expenses`), `app/pages/projects/create.vue` (`/projects/create`), `app/pages/projects/[id]/edit.vue` (`/projects/[id]/edit`)
- **Deskripsi:** File-file ini berasal dari template generik lama. Mereka tidak terhubung dari sidebar manapun tapi masih accessible via URL langsung.
  - `/tasks` — berisi data task "Mobile Banking App", "Healthcare Portal", dll. (template lama)
  - `/expenses` — berisi data pengeluaran generik (template lama) + bug `handleDelete` sudah diperbaiki di Section 18
  - `/projects/create` — wizard 3-langkah, form standalone tidak terhubung ke alur Won→Project
  - `/projects/[id]/edit` — wizard edit, belum di-adapt ke skema MANOVA
- **Root cause:** Sengaja tidak dihapus (kategori `ADAPT` di `docs/template-reuse-mapping.md`). Pola code-nya sudah diadaptasi untuk halaman MANOVA (Invoice, Quotation, dll.) tetapi file aslinya dibiarkan.
- **Impact:** Bila user mengetik URL langsung, akan melihat halaman template lama. Tidak ada link dari navigasi resmi yang mengarah ke sana.
- **Status:** Known, documented. Tidak dihapus sesuai protocol.

### B-004: Komponen Dashboard Tidak Dirender (`ProjectsTable`, `TasksOverview`, `TeamMetrics`)
- **Lokasi:** `app/components/dashboard/ProjectsTable.vue`, `TasksOverview.vue`, `TeamMetrics.vue`
- **Deskripsi:** Ketiga komponen ini tidak dirender di halaman manapun dalam implementasi MANOVA final.
- **Root cause:** Dashboard MANOVA (Section 06) menggunakan widget baru yang langsung di-build di `pages/index.vue` tanpa reuse komponen-komponen ini.
- **Status:** By design — `ADAPT` status, sengaja tidak dihapus per `docs/mockup-section-reports/section-05-foundation.md` bagian 51.

### B-005: Tidak Ada Export Laporan
- **Lokasi:** `/reports`
- **Deskripsi:** Tombol export PDF/Excel tidak diimplementasikan di halaman Reports.
- **Root cause:** Scope eksplisit Prompt 16 tidak menyertakan export mock.
- **Status:** By design — deferred.

### B-006: Tidak Ada CRUD Invoice/Payment
- **Lokasi:** `/finance/invoices`, `/finance/payments`
- **Deskripsi:** Halaman Finance hanya menampilkan data fixture; tidak ada form tambah/edit invoice atau payment baru.
- **Root cause:** Scope Prompt 15 — read-only display dengan filter.
- **Status:** By design — deferred.

---

## Kategori C — Ditemukan pada Section 18 (Audit)

### C-001: Bug `handleDelete` di `expenses.vue` — **DIPERBAIKI** ✅
- **Lokasi:** `app/pages/expenses.vue`, baris 941 (sebelum fix)
- **Deskripsi:** Tombol "Delete" di modal detail expense memanggil fungsi `handleDelete` yang tidak terdefinisi → `ReferenceError` saat diklik.
- **Root cause:** Copy-paste error saat membuat modal detail; fungsi yang benar adalah `requestDelete` (defined di baris 222).
- **Fix:** Diganti dengan `requestDelete(detailExpense); isDetailOpen = false` — konsisten dengan tombol delete di table row.
- **Status:** **FIXED** — Section 18, CI-019.

### C-002: Verifikasi Interaktif Ganti-Role Tidak Dilakukan Secara Headless
- **Lokasi:** Seluruh halaman role-aware
- **Deskripsi:** Tidak ada automated test untuk memverifikasi bahwa perpindahan role di client-side benar-benar menyembunyikan/menampilkan elemen sesuai `ROLE_MODULE_ACCESS`.
- **Root cause:** Keterbatasan tooling — role tersimpan di `localStorage` klien, tidak bisa disimulasikan via SSR/curl.
- **Impact:** Memerlukan verifikasi manual oleh penguji manusia.
- **Status:** Acknowledged — verifikasi manual diperlukan sebelum production.

### C-003: Build Warning `PLUGIN_TIMINGS` — Pre-existing
- **Lokasi:** `npm run build`
- **Deskripsi:** Nuxt/Vite menampilkan `WARN [PLUGIN_TIMINGS]` tentang plugin yang memakan banyak waktu build.
- **Impact:** Tidak ada — hanya performance hint, bukan error.
- **Status:** Pre-existing. Tidak memerlukan action.

---

## Ringkasan Status

| Kategori | Jumlah | Status |
|---|---|---|
| Pre-existing (A) | 5 | Documented, tidak diperbaiki (di luar scope) |
| By Design (B) | 6 | Documented, deliberate decision |
| Ditemukan Section 18 (C) | 3 | C-001 sudah diperbaiki ✅, C-002 acknowledged, C-003 documented |

**Blocker demo:** Tidak ada — seluruh route demo dapat dibuka, demo flow berjalan, tidak ada runtime crash pada halaman yang digunakan dalam demo.
