# Laporan Phase 7 — Dashboard + polish

29 September 2026 · branch `monorepo`. Rujukan: `11-EXECUTION-PHASES.md` (Phase 7), `06-FRONTEND-UX-IA-AND-PAGES.md`, `10-TESTING-AND-ACCEPTANCE-CRITERIA.md`.

> **Batas klaim.** Yang sudah **aktif dan teruji** (API, test, dan browser):
> - dashboard utama aplikasi (`/`) membaca angka keuangan dari server, bukan mock;
> - gerbang workflow project ("Invoice DP terbit", "DP diterima") dan label "tagihan terlambat" mengikuti Finance di server;
> - Reports (pendapatan/laba per bulan, biaya per trip, margin, vendor, invoice aging) dan riwayat trip di CRM dari server;
> - fokus keyboard terlihat di seluruh aplikasi, dan toast diumumkan ke pembaca layar;
> - baseline performa dengan data besar, di PGlite dan PostgreSQL 17.
>
> **Belum:**
> - Belum ada **test pengguna nyata** untuk kriteria "user baru bisa menjawab 6 pertanyaan menu". Setiap halaman menuliskan pertanyaannya di deskripsi judul dan memberi langkah berikutnya di keadaan kosong, tapi itu belum diuji dengan orang.
> - **Ledger rekening** dan **ringkasan project** belum dipaginasi (lihat Performa).
> - Audit aksesibilitas memakai pemeriksaan otomatis dan keyboard di browser, bukan screen reader sungguhan.

## Commit

| Commit | Isi |
|---|---|
| `4eba82d` | `GET /finance/overview`. Dashboard `/`: hero pendapatan/laba mock dan "Monthly Cash Flow" diganti ringkasan Keuangan dari server. "Outstanding Invoices" → "Tagihan Terlambat". Budget vs Actual dan Cost Breakdown memakai biaya nyata, hanya Finance/Super Admin. Komponen mock dihapus. |
| `52ab5d3` | Status pembayaran project membawa `dpInvoiced`/`dpReceived` (tanpa nominal). Gerbang langkah Confirmed dan perhatian project membaca fakta ini, bukan invoice mock. |
| `4fae929` | `GET /finance/reports/monthly`. Reports dan CRM memakai angka server. Admin mendapat catatan, bukan nominal. |
| `4e1fb71` | Overview mengelompokkan invoice per project sekali (sebelumnya O(n²)). Script `backend/scripts/perf-baseline.ts`. |
| (commit ini) | Fokus keyboard global, tautan lewati ke konten, nama tombol sidebar/breadcrumb, toast `aria-live`, laporan ini, checklist. |

## Konteks per role

| Role | Dashboard `/` | Reports | Project detail |
|---|---|---|---|
| Super Admin, Finance | Kas, perkiraan 30 hari, piutang/utang, tagihan terlambat, biaya per project | Semua angka keuangan | Ringkasan lengkap |
| Admin | Status bayar per project tanpa nominal | Catatan "angka keuangan hanya untuk Finance" | Status + gerbang DP |

Angka dashboard diuji sama dengan ringkasan project dan total menu Finance (`test/finance-overview.test.ts`).

## Performa

`bun scripts/perf-baseline.ts` membangun database sekali-pakai lewat API sungguhan: **1.500 invoice customer, 600 invoice vendor, 1.000 pengeluaran**, 2 rekening. Tiap endpoint dipanggil 7 kali, run pertama dibuang. Database dev tidak disentuh.

| Endpoint | PostgreSQL 17 median / p95 (ms) | PGlite median (ms) | Ukuran jawaban |
|---|---|---|---|
| Posisi kas | 3 / 4 | 21 | 0,5 KB |
| Mutasi (bulan, 50 baris) | 11 / 12 | 52 | 28 KB |
| Mutasi (setahun, 50 baris) | 18 / 20 | 117 | 28 KB |
| Ledger rekening (setahun) | 44 / 46 | 280 | **1,5 MB** |
| Piutang (terbuka) | 25 / 29 | 176 | 33 KB |
| Piutang (terlambat) | 23 / 29 | 113 | 33 KB |
| Utang (semua) | 17 / 17 | 87 | 33 KB |
| Cash flow 30 hari | 48 / 53 | 260 | 176 KB |
| Cash flow 12 bulan | 51 / 52 | 257 | 222 KB |
| Overview (dashboard) | 141 / 146 | 764 | 3,6 KB |
| Laporan bulanan (12 bulan) | 12 / 12 | 54 | 3,3 KB |
| Ringkasan project | 94 / 96 | 461 | **1,4 MB** |

Angka di atas diukur **sebelum** `4e1fb71`. Perbaikan itu hanya mengubah perhitungan di memori untuk overview.

Catatan:
- **PostgreSQL** adalah target produksi: semua di bawah 150 ms. PGlite (dev/test) sekitar 5× lebih lambat.
- **Ledger rekening** mengembalikan satu periode utuh dengan saldo berjalan (maks. 1 tahun). Untuk ~1.500 mutasi setahun ukurannya 1,5 MB. Paginasi bisa ditambah dengan membawa saldo awal halaman bila volume nyata jauh lebih besar.
- **Ringkasan project** besar karena data uji menaruh ratusan invoice di tiap project (hanya ada beberapa project demo). Project nyata punya belasan invoice.
- Target angka **tidak** di-hardcode di test (sesuai `10`). Tabel ini baseline untuk dibandingkan nanti.

## Aksesibilitas dan responsif

Perubahan:
- `assets/css/tailwind.css`: ring fokus `:focus-visible` untuk tombol, `[role=button]`, elemen ber-`tabindex`, tautan, dan `summary`. Specificity nol (`:where`), jadi komponen dengan ring sendiri tidak berubah. Tombol memakai outline di dalam supaya tidak terpotong oleh daftar ber-`overflow-hidden`.
- `ToastContainer.vue`: wadah `role=region` + `aria-live="polite"` selalu ada di DOM. Error memakai `role=alert`, lainnya `role=status`. Ikon `aria-hidden`. Lebar dibatasi layar ponsel.

- `layouts/dashboard.vue`: tautan "Lewati ke konten" muncul pada Tab pertama. Enter memindahkan fokus ke `<main id="konten">`, jadi pengguna keyboard tidak perlu melewati ~20 tautan sidebar.
- `AppSidebar.vue`: tombol buka submenu punya nama (`Submenu CRM`) dan `aria-expanded`.
- `Breadcrumb.vue`: ikon beranda punya nama "Beranda".

Audit di browser sebagai Finance, 1440 dan 390 px (Chrome headless). Halaman: Ringkasan, Mutasi Rekening, Piutang, Utang, Cash Flow, Refund & Pembatalan, Rekening & Saldo, dan dashboard `/`.

| Pemeriksaan | Hasil |
|---|---|
| Overflow horizontal | tidak ada di 16 kombinasi halaman × lebar |
| Error konsol / API gagal | 0 |
| Satu `h1` per halaman | ya |
| Gambar tanpa `alt` | 0 |
| Kontrol terlihat tanpa nama | 6 per halaman sebelum perbaikan (tombol submenu sidebar dan ikon beranda). **0** sesudahnya. Di 390 px tautan sidebar tercatat kosong karena laci menu tertutup (teksnya ada). |
| Keyboard (Tab sungguhan) | Setiap elemen yang difokuskan cocok `:focus-visible` dengan outline 2 px. Tautan lewati berfungsi (Tab → Enter → fokus di konten). |

## Bukti

| Pemeriksaan | Hasil |
|---|---|
| Backend test overview (PGlite) | 7 pass |
| Typecheck backend & frontend | bersih |
| Frontend vitest | **224 pass** |
| Lint file frontend yang disentuh | tanpa error |
| Browser | lihat Aksesibilitas dan responsif |
| Performa | tabel di atas (PGlite dan PostgreSQL 17) |

## Data / migrasi

Tidak ada migrasi di Phase 7. Seluruhnya dihitung dari tabel dan view yang sudah ada.

## Risiko

- Paginasi ledger dan ringkasan project (lihat Performa) bila volume nyata jauh di atas baseline.
- Kriteria "6 pertanyaan tanpa onboarding" baru dinilai dari isi layar, belum dari sesi dengan pengguna baru.
