# Data demo "perusahaan berjalan 1 tahun" — desain

Tanggal: 5 Oktober 2026 · Branch: `production` · Status: diimplementasikan

## Tujuan

Demo ke klien/atasan. Dashboard, Finance, laporan bulanan, dan daftar project harus terlihat seperti
perusahaan travel menengah yang sudah berjalan setahun (Nov 2025 – Okt 2026), dengan angka yang masuk akal
dan satu cerita yang nyambung. Dipasang di lokal dulu; server staging menyusul (manual, di luar lingkup ini).

## Keputusan

| Topik | Keputusan |
|---|---|
| Data lama | 11 project (PRJ-101..104, 201..205, 501, 502), 18 party, 7 vendor tetap, ID tidak berubah |
| Skala | ±40 project baru (±4/bulan), total 51 project, omzet ±Rp 37 M/tahun (hasil seed) |
| Pendekatan | A: tabel project histori di frontend + seed finance tahunan terpisah |
| Seed lama | `db:seed:finance-demo` dan test-nya **tidak diubah** |
| Tanggal | Kalender tetap: rekening dibuka 1 Sep 2025, keberangkatan Nov 2025 – Okt 2026. Transaksi bertanggal setelah hari ini dilewati |

## Fakta yang membatasi desain

- Halaman project di UI membaca fixture frontend (`frontend/app/data/projects.ts`), bukan `GET /projects`.
  Project baru harus ada di fixture; server mendapatkannya lewat `seed:extract` → `demo-core.json` → `db:seed:demo`.
- Layanan finance menolak tanggal di masa depan, mewajibkan `effectiveDate ≥ opening_date` rekening yang sudah
  diverifikasi, dan menolak keluar uang yang membuat saldo negatif pada tanggal itu atau sesudahnya.
- Saldo pembuka: Finance (USR-008) mengajukan, Super Admin (USR-010) memverifikasi.
- Credit note dan reverse selalu bertanggal hari ini; refund/pembatalan juga berbasis hari ini.
- Laporan bulanan: maks. 24 bulan, berbasis akrual (invoice terbit, tagihan vendor disetujui, biaya).
  Cash Flow hanya proyeksi ke depan. Dashboard "Tahun ini" = Jan–Okt 2026; setahun penuh lewat "Semua Waktu".
- Tanggal acuan operasional frontend tetap `DEMO_REFERENCE_DATE = 2026-07-29`.

## Cerita

### Project baru (PRJ-301 … PRJ-340)

- Pola musiman per bulan keberangkatan: Nov 3, Des 6, Jan 2, Feb 5, Mar 5, Apr 2, Mei 3, Jun 5, Jul 5,
  Agu 2, Sep 1, Okt 1 (= 40).
- Jenis dan rentang nilai kontrak:
  - Perjalanan dinas korporat: 2–10 orang, Rp 50–300 jt
  - Incentive trip / gathering: 20–60 orang, Rp 400 jt – 1,5 M
  - MICE / konferensi: Rp 500 jt – 2 M (characteristic `complex`)
  - Grup umroh / wisata: 20–45 orang, Rp 600 jt – 1,5 M (`isGroupTrip` tidak dipakai; tanpa sales order)
- Tujuan: Jepang, Korea, Singapura, Bali, Turki, Arab Saudi, Eropa, Dubai.
- Customer: 12 party baru PTY-019 … PTY-030 (`lifecycleStatus: 'client'`), ditambah repeat order dari
  customer lama **kecuali** PTY-001 dan PTY-005 (dipakai di assertion test cakupan).
- Vendor layanan memakai vendor yang ada **kecuali** VND-006.
- Status mengikuti `DEMO_REFERENCE_DATE`: pulang sebelum 2026-07-29 → `completed`; berangkat Agu–Okt →
  `in-progress`. Tidak memakai `confirmed` (dipakai assertion test filter).
- `budgetIdr` = 78% kontrak, `actualCostIdr` = biaya vendor aktual untuk yang `completed`, 0 untuk yang belum.
- Tiap project: 2–4 layanan (flight/hotel/transportation/mice) dan 4 milestone standar (SPK, Itinerary final,
  Invoice DP, Konfirmasi vendor), `completed` untuk project selesai.

### Uang (server, lewat layanan finance asli)

- **Rekening, saldo pembuka 2025-09-01, semua diverifikasi** (DP project Nov–Des 2025 terbit Sep–Okt 2025, jadi rekening harus sudah ada): BCA Operasional Rp 1,5 M, Mandiri Vendor
  Rp 400 jt, BRI Cadangan Rp 250 jt.
- **Per project baru:**
  - Invoice DP 30–50%, terbit H-60 s/d H-45 dari keberangkatan, jatuh tempo +7 hari.
  - Invoice pelunasan terbit H-21, jatuh tempo H-14.
  - Perilaku bayar (deterministik per project): ±80% tepat waktu, ±15% telat 1–30 hari, 3 project masih
    menunggak sampai hari ini (PRJ-335, PRJ-337 belum bayar; PRJ-329 baru bayar 50% pelunasan). PRJ-340 pelunasan jatuh tempo 5 Okt 2026, belum dibayar.
  - Tagihan vendor per layanan, total 75–80% kontrak, tanggal H-30, disetujui, dibayar H-10 dari Mandiri.
- **Biaya operasional bulanan mulai Sep 2025 (BCA, tanggal 25):** gaji Rp 180 jt, sewa Rp 35 jt, listrik/internet Rp 8 jt,
  marketing Rp 15 jt (Rp 30 jt di Okt, Jan, Mei sebelum musim ramai).
- **Transfer BCA → Mandiri** otomatis di hari pembayaran vendor bila saldo Mandiri kurang (kelipatan Rp 250 jt), biaya transfer Rp 6.500 diisi langsung (tanpa aturan biaya).
- **Tambahan:** THR Rp 180 jt (10 Mar 2026), PPh Badan Rp 95 jt (28 Apr 2026), komisi maskapai Rp 2,5–7 jt tiap tanggal 15.
- **Hasil seed (dicek 5 Okt 2026):** omzet ±Rp 36,9 M, laba kotor ±Rp 9 M, biaya operasional ±Rp 3,5 M, laba bersih ±Rp 5,5 M, saldo semua rekening positif setiap hari.
- **11 project lama:** keadaan meniru demo sekarang dengan tanggal absolut Sep–Okt 2026 — PRJ-203 lunas,
  PRJ-202 DP lunas + pelunasan sebagian & telat, PRJ-103 DP lunas + progress terbuka, PRJ-201 DP terbit
  belum dibayar, PRJ-101 telat, PRJ-102 draft, PRJ-204 uang muka belum dialokasikan, PRJ-205 Group Trip
  tanpa invoice (DP peserta dikonfirmasi lewat UI).
- **Kebijakan pembatalan:** STD-DP dan HOTEL-FLEX seperti seed lama.
- **Tidak ada di histori:** credit note, reverse, pembatalan/refund.

## Komponen

1. `frontend/app/data/projects-history.ts` (baru)
   - `HISTORY_PARTIES`: 12 party baru.
   - `HISTORY_ROWS`: tabel satu baris per project (id, partyId, nama, tujuan, mulai, selesai, orang, nilai
     kontrak, jenis, vendor per layanan).
   - Fungsi pembentuk `buildHistoryProjects`, `buildHistoryServices`, `buildHistoryMilestones`.
   - `projects.ts`, `parties.ts`, `project-orders.ts` menambahkan hasilnya ke array yang sudah ada (setelah data
     lama, supaya urutan dan `find()` pertama tidak berubah).
2. `backend/src/db/seeds/demo-core.json` dibuat ulang dengan `bun run seed:extract`.
3. `backend/src/db/seed-year-demo.ts` (baru): `seedYearDemo(db, { appEnv, today? })`.
   - Aturan sama dengan seed finance lama: tolak di production, tolak bila ada data non-demo, tidak melakukan
     apa-apa bila sudah ada data finance, semua transaksi dalam transaksi bertanda `demo-fixture`.
   - Membangun daftar kejadian (event) bertanggal dari tabel project + jadwal biaya, mengurutkan per tanggal,
     lalu memanggil layanan finance satu per satu. Event setelah `today` dilewati.
   - Membaca project dari `demo-core.json` (sudah termasuk project histori) — tidak mengimpor kode frontend.
     Parameter per project (persen DP, perilaku bayar, porsi vendor) diturunkan secara deterministik dari ID.
4. `backend/scripts/db.ts`: perintah `seed:year-demo`; `backend/package.json` dan root `package.json`:
   script `db:seed:year-demo`.
5. `CLAUDE.md` root dan `backend/CLAUDE.md`: baris perintah baru + cara reset database lokal.

## Test

- **Baru** `backend/test/year-demo-seed.test.ts` (PGlite, `today` = 2026-10-05):
  - seed selesai tanpa error dan hasilnya sama bila dijalankan di dua database baru;
  - tidak ada saldo rekening negatif di akhir setiap hari;
  - tiap bulan Sep 2025 – Sep 2026 punya pengeluaran, dan tiap bulan Okt 2025 – Sep 2026 punya pendapatan (laporan bulanan);
  - PRJ-329, PRJ-335, PRJ-337, PRJ-101, PRJ-202 muncul sebagai piutang telat;
  - omzet setahun di rentang Rp 30–40 M;
  - menjalankan ulang tidak menambah data; ditolak di production.
- **Disesuaikan**: `core-scope.test.ts` (daftar/jumlah project, halaman, parties 30) dan `db.test.ts`
  (daftar ID project) agar ikut `DEMO_CORE`, bukan daftar 11 ID tertulis.
- **Tidak diubah**: semua test finance lain, termasuk `finance-demo-seed.test.ts` dan
  `finance-overview.test.ts`.
- Frontend: typecheck, test, dan build harus tetap lulus; satu test kecil memastikan setiap project histori
  punya party yang ada dan ID unik.

## Cara pakai (lokal)

```bash
# matikan backend dulu
rm -rf backend/.data/pglite
npm run db:migrate
npm run db:seed:demo
npm run db:seed:year-demo
```

`db:seed:finance-demo` dan `db:seed:year-demo` tidak dipakai bersamaan: mana yang jalan pertama membuat data
finance, yang kedua tidak melakukan apa-apa.

## Di luar lingkup

- Pemasangan di server staging (perlu database server dikosongkan; dilakukan manual bersama Satria).
- Booking (flight/hotel/transport/MICE), traveler, dan sales order untuk project histori.
- Mengubah `DEMO_REFERENCE_DATE` atau logika tanggal di frontend.
