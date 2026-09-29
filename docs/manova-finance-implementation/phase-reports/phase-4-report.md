# Laporan Phase 4 — UI Finance baru

29 September 2026 · branch `monorepo`. Rujukan: `06-FRONTEND-UX-IA-AND-PAGES.md`, `finance-consumer-matrix.md`, `FINANCE-DOMAIN-MAPPING.md` §11, ADR-006/007.

> **Batas klaim.** Lima layar Finance dan panel konteks memakai **API server**, bukan mock. Semuanya diuji di browser sungguhan (Chrome headless, 1440px dan 390px) sebagai Finance, Super Admin, dan Admin.
>
> **Belum:**
> - **Cash Flow** (proyeksi) masuk Phase 6. Menunya sengaja belum ditampilkan agar tidak ada layar palsu.
> - **Refund dan pembatalan booking** masuk Phase 5.
> - Mock `data/finance*.ts` masih dipakai layar **non-finance**: dashboard aplikasi, laporan, portal client, CRM LTV, dan marketing ROI. Semuanya dipindah di Phase 5–7 sesuai matriks consumer.

## Commit

| Commit | Isi |
|---|---|
| `7963f90` | Seed skenario keuangan demo + migrasi `0010` |
| `9d7e04a` | Fondasi UI, Rekening & Saldo, buku rekening, drawer mobile |
| `78ec480` | Mutasi Rekening + tombol "Catat transaksi" |
| `b332148` | Piutang Customer |
| `5f36046` | Utang Vendor |
| `8dc5dec` | Dashboard Finance |
| `b5b97ee` | Panel konteks: project, booking, vendor, customer |

## Layar

Setiap layar punya state lengkap: skeleton saat memuat, error dengan kode referensi dan tombol "Coba lagi", empty state yang dibedakan dari hasil filter kosong, dan toast sukses. Semua angka berasal dari server; UI tidak menghitung ulang saldo maupun sisa.

| Menu | Route | Menjawab |
|---|---|---|
| Ringkasan | `/finance` | Berapa kas hari ini, dan apa yang perlu diperhatikan? |
| Mutasi Rekening | `/finance/statement` | Uang apa yang benar-benar masuk/keluar? |
| Rekening & Saldo | `/finance/accounts`, `/finance/accounts/[id]` | Saldo ada di rekening mana, dan bagaimana bergerak? |
| Piutang Customer | `/finance/receivables` | Customer mana harus bayar, kapan, dan berapa sisanya? |
| Utang Vendor | `/finance/payables` | Vendor mana harus dibayar, kapan, dan berapa sisanya? |

### Ringkasan (`/finance`)

- **Satu angka utama:** saldo tersedia. Kalau ada rekening yang belum terverifikasi, labelnya menjadi "Saldo rekening terverifikasi" dan rekening yang belum masuk disebutkan.
- Perubahan dibanding 30 hari lalu, dan grafik saldo harian 30 hari yang dibangun hanya dari saldo berjalan server (`lib/finance/trend.ts`, dites).
- **"Perlu perhatian"**, diurutkan menurut urgensi. Setiap item punya sebab dan tombol aksi: rekening belum diverifikasi, piutang terlambat, utang vendor terlambat, invoice vendor menunggu review, rencana tagihan yang sudah waktunya, tagihan jatuh tempo 7 hari, draft, dan uang muka yang belum dipakai.

### Mutasi Rekening (`/finance/statement`)

- Filter: periode, arah, rekening, project, dan transfer internal. Juga menerima `?kind=expense`.
- Total dari server, yang **mengecualikan** transfer internal dan pasangan yang dibatalkan; hal ini juga ditulis di layar.
- Daftar per hari, "Muat lebih banyak" berbasis cursor, dan panel detail.

### Rekening & Saldo (`/finance/accounts`, `/finance/accounts/[id]`)

- Kartu rekening berisi saldo dan **langkah berikutnya**: isi saldo awal (maker) → Super Admin memverifikasi (checker).
- Tombol "Verifikasi" tidak pernah muncul untuk orang yang mengajukan.
- Checker mengirim ulang angka persis yang ia lihat. Kalau maker mengubahnya di tengah jalan, server menolak dengan 409.
- Buku rekening per periode: saldo awal + masuk − keluar = saldo akhir, dengan saldo berjalan per baris.

### Piutang Customer (`/finance/receivables`)

- Daftar kerja diurutkan menurut jatuh tempo terdekat. Tab: belum lunas, terlambat, draft, rencana tagihan, lunas.
- **Panel invoice:**
  - Draft: terbitkan, ubah, hapus.
  - Terbit: catat pembayaran, perkiraan tanggal bayar, credit note, sengketa, void. Setiap aksi meminta alasan yang tersimpan di audit.
- Form invoice menampilkan konteks nilai kontrak, sudah ditagih, dan belum ditagih.
- Rencana tagihan diubah menjadi draft dengan satu klik.
- Uang muka customer bisa dipakai untuk invoice; tidak ada uang yang bergerak.

### Utang Vendor (`/finance/payables`)

- Alur: review → setujui (dengan hasil pencocokan order; yang disengketakan tidak bisa disetujui) atau tolak → bayar.
- Juga tersedia rencana tanggal bayar, void invoice yang belum dibayar, dan pemakaian deposit vendor.
- Invoice yang masih direview tidak dihitung sebagai utang; ini dijelaskan di layar.

### "Catat transaksi" — satu pintu pencatatan uang

Lima pilihan, masing-masing dengan penjelasan singkat:

- Pembayaran customer
- Pemasukan lain
- Pembayaran vendor
- Pengeluaran operasional
- Transfer antar rekening

Perilakunya:

- Pembayaran dialokasikan otomatis ke jatuh tempo terlama dulu dan masih bisa diubah (`lib/finance/allocation.ts`, dites). Sisanya tampil sebagai uang muka/deposit.
- Sebelum konfirmasi, form menampilkan pratinjau saldo rekening sesudahnya.
- Setiap pengiriman membawa satu Idempotency-Key per niat, jadi pengiriman ulang tidak mencatat dua kali.
- Pembatalan transaksi berupa transaksi balik (alasan wajib). Transfer dibatalkan beserta biayanya.

## Panel konteks

Semua panel memakai endpoint yang sama dengan layar Finance, jadi tidak ada angka ganda.

**Detail project:**
- Tab Finance mock diganti panel dari API: kontrak, ditagih, diterima, sisa, belum ditagih, biaya vendor, profitabilitas akrual, daftar invoice, dan aksi.
- Ringkasan project menampilkan status bayar untuk semua role; Admin hanya melihat label.
- "Actual Cost" mock dihapus dari ringkasan.

**Tutup finance project:**
- Pengganjal dihitung dari server: sisa piutang, draft, rencana tagihan, invoice vendor dalam review, dan utang vendor.
- Refund request masih dicek dari mock sampai Phase 5, sehingga gate tidak melemah maupun menguat.

**Booking (tiket/hotel/transport/MICE), vendor, dan customer CRM:** kartu "Tagihan & pembayaran". Finance melihat angka dan daftar invoice; Admin hanya status atau jumlah, dan keputusan ini diambil server.

## Navigasi & redirect

Menu Finance: Ringkasan → Mutasi Rekening → Rekening & Saldo → Piutang Customer → Utang Vendor. Cash Flow ditambahkan di Phase 6.

| Route lama | Sekarang |
|---|---|
| `/finance/invoices`, `/finance/notes` | `/finance/receivables` |
| `/finance/payments`, `/finance/reconciliation` | `/finance/statement` |
| `/finance/ledger` | `/finance/accounts` (buku rekening, bukan General Ledger) |
| `/finance/opex`, `/expenses` | `/finance/statement?kind=expense` * |
| `/finance/tax` | `/finance` (pajak di luar V1) |

\* **Menyimpang dari matriks, dengan sengaja.** Matriks mengarahkan opex ke Payables. Di model baru, opex adalah uang keluar ber-kategori, bukan invoice vendor. Halaman Utang tetap menautkan ke daftar pengeluaran.

**Dihapus:** kesembilan panel `components/finance/*Panel.vue` lama (GL, pajak, pembayaran, rekonsiliasi, invoice, piutang, credit/debit note, hutang, opex) serta halaman ringkasan mock.

## Fondasi teknis (frontend)

| Bagian | Isi |
|---|---|
| `useServerSession` | Menyelaraskan sesi API dengan user yang dipakai di aplikasi. Kalau role diganti lewat Settings/Admin, sesi otomatis masuk ulang via demo login. Saat server mati atau sesi habis, statusnya ditampilkan jelas; tidak pernah menampilkan data orang lain atau layar kosong yang tampak seperti "tidak ada uang". |
| `useFinanceQuery` / `useFinanceAction` | Data client-only. Hasil lama tetap tampil saat refresh, respons yang datang tidak berurutan diabaikan, dan **setiap mutasi me-refresh semua layar yang terbuka**. Aksi tidak bisa dobel-submit, dan error server tampil di field terkait maupun sebagai banner. |
| `FinanceMoneyInput` | Nilai berupa string minor unit yang persis (bukan float), dengan pemisah ribuan saat mengetik. |
| `lib/finance/dates.ts` | "Hari ini" selalu dalam Asia/Jakarta, apa pun zona waktu browser. |
| Shell aplikasi | Di bawah 768px sidebar menjadi drawer dengan tombol menu di header. Sebelumnya semua halaman terhimpit di HP. Perubahan hanya di level CSS, tanpa hydration mismatch. |

## Seed demo keuangan (`npm run db:seed:finance-demo`)

Seed dibangun lewat service backend yang sama dengan API, sehingga tidak mungkin berisi keadaan yang tidak bisa dibuat aplikasi.

**Isi:**
- 3 rekening: 2 terverifikasi, 1 menunggu checker.
- Invoice customer dari jadwal tagihan: lunas, sebagian dan terlambat, dengan janji bayar, credit note, draft, dan uang muka.
- Invoice vendor: dibayar, terlambat sebagian, disetujui, dan dalam review.
- Transfer dengan biaya, pengeluaran, pemasukan lain, dan satu pembatalan.

**Sifat:**
- Tanggal relatif terhadap hari ini, jadi selalu ada yang terlambat dan jatuh tempo.
- Migrasi `0010` membuat seluruh rekening dan baris buku kas bertanda `provenance = 'demo-fixture'`, tanpa pernah meng-UPDATE buku kas yang immutable.
- Hanya berjalan sekali, dan ditolak di production.

## Verifikasi

| Pemeriksaan | Hasil |
|---|---|
| Backend `bun test` (PGlite) / PostgreSQL 17 | **158 pass** / **158 pass** |
| Frontend typecheck / vitest | bersih / **216 pass** (termasuk test alokasi, tren saldo, tanggal & label) |
| Lint file yang disentuh | tidak ada temuan baru; beberapa temuan lama ikut dibersihkan |
| Browser, Finance | 5 layar × 1440px/390px tanpa error konsol, tanpa API gagal, tanpa overflow horizontal |
| Browser, alur ujung ke ujung | verifikasi saldo awal (Super Admin) · pembayaran customer + alokasi · pembayaran vendor · pengeluaran · rencana → draft → terbit · review → setujui → bayar |
| Browser, Admin | `/finance` ditolak dan dialihkan · project/booking/vendor/customer hanya status/jumlah, tanpa nominal Finance |

## Review independen — temuan & perbaikan

Review independen atas seluruh commit Phase 4 **tidak menemukan cacat berat**:

- Tidak ada perhitungan uang dengan float.
- Idempotency-Key benar di semua dialog.
- Admin tidak pernah melihat nominal.
- Kontrak API cocok dengan backend.

Ada 3 temuan sedang dan 8 ringan; semuanya diperbaiki.

| # | Temuan | Perbaikan |
|---|---|---|
| 1 | Dialog perkiraan bayar dibuka dengan tanggal kosong, sehingga menyimpan tanpa mengubah apa pun akan **menghapus** janji bayar | Tanggal lama diisi saat dialog dibuka |
| 2 | Rencana tagihan di tab Finance project tidak termuat bila halaman dibuka langsung (hak akses dicek sebelum sesi siap) | Syarat `enabled` dievaluasi setelah sesi server siap |
| 3 | Mengganti customer di form pembayaran menyisakan project dan alokasi milik customer sebelumnya | Direset saat customer/vendor berganti; alokasi hanya ke invoice yang tampil; error project ditampilkan |
| 4 | Mengosongkan jatuh tempo/perkiraan/catatan saat mengubah draft tidak tersimpan | Field kosong dikirim sebagai `''` (server mengosongkannya) |
| 5 | "Muat lebih banyak" bisa menempelkan baris dari tab/filter sebelumnya | Penanda generasi; jawaban lama dibuang |
| 6 | Saldo awal kosong terkirim sebagai Rp0 | Tombol nonaktif sampai nominal diisi (Rp0 tetap bisa diketik) |
| 7 | Tombol tutup finance bisa memakai data yang sedang dimuat atau gagal dimuat; kontrak yang belum habis ditagih tidak menjadi pengganjal | Tombol nonaktif saat memuat/error; ditambah pengganjal "nilai kontrak belum seluruhnya ditagih" |
| 8 | Daftar alokasi terpotong di 100 invoice | Mengikuti cursor sampai habis (`lib/finance/paging.ts`, dites); jumlah draft di dashboard ditulis "100+" |
| 9 | Tanggal uang bisa dipilih sebelum saldo awal rekening | `min` = tanggal saldo awal (transfer: yang terakhir dari dua rekening) |
| 10 | Ganti role saat sesi sedang dibuat bisa mengembalikan sesi user sebelumnya | Sesi yang sedang dibuat dipisah per user |
| 11 | Setiap mutasi memuat ulang semua referensi (project/customer/vendor) | Data referensi tidak ikut di-refresh oleh mutasi keuangan |

**Catatan seed:** seed tidak atomik. Kalau terhenti di tengah, jalankan ulang pada database baru (hapus `backend/.data/pglite`, lalu migrasi dan kedua seed).

Setelah perbaikan, database demo lokal direset ke kondisi seed yang bersih. Data lama disimpan sebagai `backend/.data/pglite-before-phase4-reset`; folder ini tidak di-commit dan boleh dihapus.

## Catatan untuk keputusan berikutnya

- **Kartu "Financial" di halaman booking** (net cost, harga jual, margin) sudah ada sebelum Phase 4 dan masih terlihat oleh Admin. Angkanya milik modul Booking (penetapan harga), bukan Finance. Perlu diputuskan apakah Admin boleh melihat margin booking.
- Filter customer di tab "Rencana tagihan" disaring di browser berdasarkan daftar project. Ini wajar untuk skala sekarang; saat data besar, perlu filter `partyId` di endpoint jadwal.

## Berikutnya

- **Phase 5:** pembatalan & refund (policy H-x, snapshot, settlement), serta memindahkan halaman refund/cancellation dari mock.
- **Phase 6:** Cash Flow (proyeksi) beserta menunya.
