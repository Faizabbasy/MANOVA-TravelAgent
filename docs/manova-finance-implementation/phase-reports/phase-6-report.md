# Laporan Phase 6 — Cash Flow

29 September 2026 · branch `monorepo`. Rujukan: `07-CASHFLOW-CALCULATION-RULES.md`, `05-API-CONTRACTS.md` (cash-flow), `06-FRONTEND-UX-IA-AND-PAGES.md`.

> **Batas klaim.** Yang sudah **aktif dan teruji** (API, test, dan browser):
> - proyeksi kas 30 hari / 3 / 6 / 12 bulan dari saldo terverifikasi hari ini;
> - tampilan perusahaan, per rekening, dan per project;
> - peringatan saldo minus dan saldo di bawah minimum;
> - rincian sampai ke invoice/refund sumbernya;
> - menu ke-6 "Cash Flow" dan kartu "Perkiraan saldo 30 hari lagi" di Ringkasan Finance.
>
> **Belum:**
> - Invoice dan utang belum punya **rekening tujuan/sumber**, jadi tampilan per rekening hanya menunjukkan saldo rekening itu. Kewajiban tampil terpisah sebagai "tanpa rekening" (sesuai `07`).
> - **Saldo minimum** hanya diingat di browser (localStorage), belum ada pengaturan tersimpan per perusahaan/rekening.
> - **Pengeluaran rutin yang belum menjadi invoice** (gaji, sewa) belum bisa direncanakan. Tidak ada sumber datanya, jadi tidak dikarang.
> - **Dashboard utama aplikasi** (`/`) masih punya bagian "Monthly Cash Flow" lama dari data mock. Bagian itu diganti di Phase 7 (integrasi dashboard final).

## Commit

| Commit | Isi |
|---|---|
| `0c4f074` | `GET /finance/cash-flow`, halaman Cash Flow, grafik, menu ke-6, kartu dashboard, 24 test backend |
| `00f55ac` | Perbaikan review independen (lihat di bawah), 10 test tambahan |

## Rumus

```text
saldo awal[0]  = saldo terverifikasi hari ini (semua mutasi yang sudah dicatat)
masuk          = sisa tagihan customer yang sudah terbit, dikurangi uang muka customer yang sama
keluar         = sisa invoice vendor yang sudah disetujui + refund disetujui yang belum dibayar
saldo akhir[n] = saldo awal[n] + masuk[n] − keluar[n];  saldo awal[n+1] = saldo akhir[n]
```

| Aturan | Keputusan |
|---|---|
| **Tanggal** | Memakai tanggal perkiraan bayar bila ada, selain itu jatuh tempo. Tanggal yang sudah lewat (terlambat, atau perkiraan yang lewat) masuk **periode pertama** dan diberi label. Tagihan terlambat yang punya tanggal perkiraan baru mengikuti tanggal itu, tetap berlabel "Terlambat". |
| **Label** | "Sesuai jatuh tempo", "Tanggal perkiraan", dan "Terlambat" hanya menjelaskan asal tanggal. **Nilai tidak pernah dikalikan peluang.** |
| **Periode** | 30 hari = per minggu mulai besok (minggu terakhir 2 hari). 3/6/12 bulan = sisa bulan ini, lalu 3/6/12 bulan kalender penuh. Setiap baris memuat `startDate`/`endDate`. Tanggal bisnis Asia/Jakarta. |
| **Tanpa hitung ganda** | Penerimaan, pembayaran, dan pembayaran refund yang sudah dicatat sudah ada di saldo dan mengurangi sisanya. Pembatalan pembayaran mengembalikan keduanya. Transfer antar rekening netral, hanya biaya transfer yang mengurangi kas. |
| **Uang muka customer** | Uang muka yang belum dialokasikan sudah ada di saldo, jadi mengurangi tagihan terbuka customer yang sama (tagihan paling awal dulu). Sisanya tampil di "Tidak dihitung". **Deposit vendor tidak dikurangkan** dari utang, agar perkiraan tetap hati-hati. |
| **Refund** | Refund disetujui yang belum dibayar dihitung di periode pertama (terutang sekarang). Pembatalan yang belum diputuskan tidak dihitung, tapi ditampilkan. |
| **Sengketa** | Tetap dihitung, dengan subtotal dan label sendiri. |
| **Tidak dihitung, tapi ditampilkan** | Draft invoice, rencana tagihan, invoice vendor yang masih direview, pembatalan yang menunggu keputusan (termasuk jumlah kasus yang nominalnya belum ditentukan), sisa uang muka, deposit vendor, dan tagihan/utang setelah rentang yang dipilih. |
| **Saldo belum terverifikasi** | `available=false` + daftar rekening yang kurang. **Tidak pernah menampilkan angka nol palsu.** Arus bersih per project tetap tersedia karena tidak bergantung pada saldo. |
| **Per rekening** | Saldo rekening itu. Kewajiban belum punya rekening, jadi dicantumkan sebagai "tanpa rekening" dengan totalnya dan tidak dihitung. |
| **Per project** | Arus bersih mulai dari nol. **Tidak disebut saldo**, dan tidak ada klaim "saldo minus". Pengeluaran tanpa project tidak ikut. |
| **Peringatan** | Saldo minus: tanggal pertama (termasuk hari ini bila saldo sudah minus), nilai, titik terendah, dan 3 pengeluaran terbesar sebelum tanggal itu (bisa diklik). Saldo minimum: batas opsional dari pengguna. Peringatan hanya informasi, tidak membatalkan apa pun. |
| **Konsistensi** | Saldo dan kewajiban dibaca dalam satu snapshot (`repeatable read`). |
| **`asOf`** | Selalu hari ini. Proyeksi dari tanggal lampau butuh saldo dan alokasi per titik waktu, jadi tidak ada di v1. |

## Hak akses

`finance.view-cash-flow`: Finance dan Super Admin. Admin mendapat 403 (diuji). Admin juga tidak melihat menu maupun kartu di dashboard.

## UI

- **`/finance/cash-flow`:**
  - pilihan rentang;
  - filter rekening/project (satu per satu);
  - kolom "Peringatan saldo minimum";
  - 4 angka utama: saldo hari ini, perkiraan saldo akhir, uang masuk, uang keluar;
  - banner saldo minus/minimum dengan pengeluaran penyebabnya;
  - label terlambat/sengketa/uang muka;
  - grafik (batang masuk/keluar + garis saldo) **berdampingan dengan tabel per periode**;
  - klik periode untuk melihat rincian (invoice/refund dengan asal tanggalnya), lalu buka detailnya;
  - bagian "Tidak dihitung dalam perkiraan" dengan tautan;
  - penjelasan "Cara menghitung".
- **Di ponsel** tabel diganti daftar periode yang bisa dibuka.
- **Status:** memuat, error (termasuk penanda bila angka masih dari pilihan sebelumnya), belum tersedia, dan kosong.
- **Grafik** memakai garis lurus. Kurva akan menyiratkan saldo di antara titik yang tidak ada di data.
- **Ringkasan Finance:**
  - kartu "Perkiraan saldo 30 hari lagi" di urutan kedua, sesuai urutan baca `06`;
  - bila akan minus, butir teratas "Perlu perhatian".
- **Sidebar Finance** sekarang enam menu: Ringkasan, Mutasi Rekening, Rekening & Saldo, Piutang Customer, Utang Vendor, Cash Flow.

## Bukti

| Pemeriksaan | Hasil |
|---|---|
| Backend `bun run test` PGlite / PostgreSQL 17 | **217 pass** / **217 pass** (34 di `finance-cashflow`) |
| Contoh numerik `07` | Saldo 300 jt; Okt +200 −150 → 350 jt; Nov +100 −400 → 50 jt. Bayar vendor 100 jt → penutupan tetap. Refund 20 jt → 330 jt, tetap 330 jt setelah dibayar (test murni + skenario API). |
| Test wajib `07` | Batas hari ini, awal dan akhir rentang; pembayaran sebagian; terlambat; perkiraan lewat atau baru; credit note; refund sebagian dan pembatalan pembayarannya; transfer + biaya; filter rekening (tanpa rekening); filter project (tanpa pengeluaran non-project); void dan pembatalan pembayaran; lintas bulan dan tahun kabisat; batas zona waktu (17:30 UTC = besoknya di Jakarta); tanpa rekening dan saldo belum terverifikasi. **Setiap jawaban API dicek:** rantai saldo, baris = jumlah rincian, total = jumlah baris. |
| Typecheck backend & frontend | bersih |
| Frontend vitest | **223 pass** |
| Lint file yang disentuh | tanpa error |
| Browser (1440 & 390 px) | Status belum tersedia (BRI-CADANGAN), 3 bulan dan 30 hari, rincian periode, filter project dan rekening, saldo minimum, ponsel, kartu dashboard. Tidak ada error konsol atau API, tidak ada overflow horizontal. |

## Data / migrasi

- Tidak ada migrasi. Seluruhnya dihitung dari tabel dan view yang sudah ada.
- **Database dev:** saldo awal `BRI-CADANGAN` diverifikasi sebagai Super Admin, supaya proyeksi lengkap bisa dicoba. Seed demo sengaja membiarkannya menunggu verifikasi; seed ulang mengembalikan kondisi itu.

## Review independen & perbaikan (`00f55ac`)

| Temuan | Perbaikan |
|---|---|
| Uang muka customer terhitung dua kali (sudah di saldo dan masih sebagai tagihan) | Uang muka dikurangkan dari tagihan terbuka customer yang sama. Tampil per tagihan dan sebagai label. Sisanya di "Tidak dihitung". |
| Tagihan terlambat dengan tanggal perkiraan baru disebut "dihitung di periode pertama" | Keterangan dibuat dari posisi sebenarnya. Label memberi tahu berapa yang di periode pertama. |
| Gagal memuat ulang menampilkan angka lama tanpa tanda | Muncul pesan error dan catatan "angka masih dari pilihan sebelumnya". |
| Saldo dan kewajiban dibaca terpisah | Dibaca dalam satu transaksi `repeatable read`. |
| Peringatan minimum hilang bila mulai di hari yang sama dengan saldo minus; saldo yang sudah minus hari ini tidak terdeteksi | Keduanya diperbaiki (fungsi peringatan murni, diuji). |
| Pembatalan manual yang belum diputuskan tampil Rp 0 | Ditandai "nominalnya belum ditentukan". |
| Aksesibilitas | Tombol rentang memakai `aria-pressed`. Baris periode punya tombol dengan `aria-expanded`/`aria-controls`. |
| Celah test | Ditambah 10 test (lihat Bukti). |

## Risiko

- Pencocokan uang muka memakai customer (dan project pada tampilan project). Bila uang muka sebenarnya untuk tagihan yang belum terbit, perkiraan uang masuk jadi sedikit lebih rendah. Arahnya hati-hati, dan tertulis di "Cara menghitung".
- Tanpa rekening pada kewajiban, tampilan per rekening terbatas. Menambah "rekening rencana" pada invoice adalah perubahan model kecil untuk fase berikutnya bila dibutuhkan.

## Berikutnya

**Phase 7 — Dashboard + polish:**
- integrasi dashboard utama (mengganti "Monthly Cash Flow" mock);
- tampilan, aksesibilitas, dan responsif;
- performa;
- konteks per role;
- panduan singkat.
