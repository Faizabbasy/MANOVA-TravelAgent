# Laporan Phase 5 — Pembatalan & refund

29 September 2026 · branch `monorepo`. Rujukan: `08-CANCELLATION-DP-POLICY-REFUND-FLOW.md`, `FINANCE-DOMAIN-MAPPING.md` §6.4, ADR-007.

> **Batas klaim.** Yang sudah **aktif dan teruji** (API, test, dan browser):
> - kebijakan pembatalan berversi,
> - snapshot kebijakan per project/booking,
> - pratinjau H-x,
> - kasus refund: dicatat → disetujui/ditolak → dibayar (sebagian boleh) → bisa dibatalkan.
>
> **Belum:**
> - **Status booking/project masih di data mock frontend.** Server mencatat pembatalan secara otoritatif untuk keuangan; status mock baru diubah sesudahnya (lihat "Risiko").
> - **Refund/penalti dari vendor** (uang masuk dari vendor) belum punya alur khusus. Tetap bisa dicatat sebagai pemasukan, dan tidak di-netting.
> - **Cash Flow** (termasuk "refund disetujui belum dibayar" di proyeksi) ada di Phase 6.

## Commit

| Commit | Isi |
|---|---|
| `0e9c0c5` | Backend: migrasi `0011`, kebijakan, pembatalan, refund, ringkasan, seed kebijakan, 21 test |
| `cdb402c` | UI: dialog pembatalan, Refund & Pembatalan, editor kebijakan, integrasi booking/project, pewarisan kebijakan |
| `e1b5f4a` | Modul Changes memakai kasus refund server; refund request mock dipensiunkan |

## Model

| Bagian | Aturan |
|---|---|
| **Kebijakan** (`cancellation_policies` + `cancellation_policy_tiers`) | Tingkat = rentang hari sebelum berangkat `min ≤ H < max`. Harus menyambung, tanpa celah atau tumpang tindih, dan wajib mencakup hari keberangkatan dan sesudahnya. Setelah terbit, isinya **dikunci trigger**. Perubahan = versi baru; hanya boleh ada satu draft per kode. |
| **Snapshot** (`cancellation_policy_assignments`) | Kebijakan ditetapkan ke project atau booking sebagai **salinan versi**. Versi baru tidak mengubah booking lama maupun kasus yang sudah tercatat. Booking tanpa kebijakan sendiri **mewarisi kebijakan project-nya** bila kebijakan itu berlaku untuk jenis booking tersebut. |
| **Kasus** (`refunds`) | Satu kasus aktif per subjek (booking atau seluruh project), dan kasus booking tidak boleh tumpang tindih dengan kasus project. Setelah diputuskan, kasus dibekukan trigger dan tidak pernah dihapus. |
| **Basis refund** | DP yang **benar-benar diterima** di invoice subjek, dikurangi refund sebelumnya. Contoh: DP Rp 30 jt, baru dibayar Rp 20 jt → basis Rp 20 jt. Pembayaran di luar DP tampil terpisah dan hanya bisa di-refund sebagai **pengecualian beralasan**. |
| **Pembulatan** | Refund = ⌊basis × %⌋ dalam rupiah bulat; yang dipertahankan = basis − refund, tepat tanpa selisih. |
| **Saat dicatat** | Sisa tagihan yang belum dibayar dihapus lewat credit note `reduce_receivable` dan rencana tagihan dibatalkan. **Tidak ada uang keluar.** Bila refund menurut kebijakan Rp 0, kasus langsung selesai. |
| **Saat disetujui** | Credit note `refund_liability` mengurangi **pendapatan**, tidak mengubah sisa tagihan (tidak ada efek ganda). Belum ada uang keluar. |
| **Bayar** | Transaksi `refund_settlement` (uang keluar sungguhan) dialokasikan ke kasus. Boleh sebagian, memakai idempotency key. Membatalkan pembayaran membuka kembali sisa refund. |
| **Kasus manual** | Dipakai bila belum ada kebijakan atau tanggal berangkat. Finance menetapkan nominal final saat menyetujui, **tidak pernah melebihi uang yang diterima**. |

Credit note yang lahir dari kasus pembatalan tidak bisa dibatalkan sendiri. Aturan ini dijaga di API maupun trigger database.

## Hak akses

| Role | Bisa |
|---|---|
| Admin | Melihat pratinjau dan **mencatat** pembatalan (kebijakan, H-x, persentase). **Tidak pernah melihat nominal.** Melihat daftar kasus di modul Changes, juga tanpa nominal. |
| Finance | Semua di atas dengan angka, menetapkan kebijakan, menyetujui/menolak, dan membayar refund. |
| Super Admin | Semua. |

Capability baru `project-order.request-cancellation` (Admin + Finance) sudah diselaraskan di RBAC frontend dan backend.

## UI

- **Pembatalan dari booking/project.** Mengubah status ke *Cancelled* di halaman tiket, hotel, transport, MICE, atau project membuka **dialog pembatalan Finance**:
  - pratinjau dari server, tabel tingkat dengan tingkat yang berlaku disorot, tanggal batal bisa dipilih;
  - Finance melihat basis DP, refund dan yang dipertahankan, sisa tagihan yang dihapus, asal pembayaran, uang muka yang belum dialokasikan, dan eksposur vendor;
  - bila belum ada kebijakan, Finance bisa langsung menetapkannya dari dialog;
  - jalur manual dan pengecualian tersedia.

  Setelah kasus tercatat, status mock booking/project baru ikut berubah dengan alasan yang sama.
- **Refund & Pembatalan** (`/finance/refunds`, ditautkan dari Piutang dan Ringkasan):
  - tab *Perlu diputuskan / Perlu dibayar / Selesai / Ditolak*;
  - panel kasus berisi perhitungan, asal pembayaran, dampak ke invoice, dan riwayat bayar;
  - setujui (kasus manual: nominal final), tolak, atau bayar dengan pratinjau saldo.
- **Tab Kebijakan pembatalan:**
  - versi per kode;
  - editor berbasis **batas hari**, sehingga celah atau tumpang tindih tidak mungkin terjadi dan pratinjau kalimat untuk customer langsung terlihat;
  - terbitkan, buat versi baru, nonaktifkan, hapus draft.
- **Kartu Finance project/booking:**
  - baris kebijakan (termasuk "mengikuti project") dan info pembatalan;
  - status "Dibatalkan" terlihat oleh semua role;
  - tutup finance project terhalang bila masih ada refund yang belum selesai. Semua pengganjal kini dari server; cek refund mock sudah dihapus.
- **Ringkasan:** refund yang menunggu keputusan dan refund yang disetujui tetapi belum dibayar.
- **Modul Changes:**
  - tab Refund menampilkan kasus server;
  - tombol "ajukan refund" mock dihapus;
  - detail cancellation menampilkan kartu Finance booking;
  - `/changes/refunds/[id]` dialihkan.
- **Master Data:** "Cancellation Rules" yang hanya tampilan dihapus, karena kebijakan resmi ada di Finance.

## Verifikasi

| Pemeriksaan | Hasil |
|---|---|
| Backend `bun run test` PGlite / PostgreSQL 17 | **181 pass** / **181 pass** |
| Acceptance paket `08` | H-7, DP diterima Rp 20 jt (dari Rp 30 jt) → refund Rp 6 jt, dipertahankan Rp 14 jt, sisa tagihan Rp 10 jt dihapus. Tidak ada uang keluar sebelum dibayar. Bayar Rp 6 jt → saldo turun sekali, replay tidak menggandakan. Kebijakan v2 tidak mengubah kasus. |
| Batas H | H-30 → 100% · H-29 & H-14 → 50% · H-13 & H-7 → 30% · H-6 & H-1 → 0% · H0 dan sesudah berangkat → tingkat "hari keberangkatan & sesudahnya" |
| `db:rehearse` | lulus sampai skema **v11** (up, rollback ke 0, up, backup/restore) |
| Frontend typecheck / vitest | bersih / **220 pass** (termasuk editor tingkat & label) |
| Lint file yang disentuh | tidak ada temuan baru |
| Browser | Admin membatalkan PRJ-204 (H-37, 100%): pratinjau tanpa nominal, status → Dibatalkan. Finance menyetujui dan membayar Rp 50 jt: kasus lunas, dampak invoice benar. Tab kebijakan dan editor diuji. Tab Refund Changes sebagai Admin (tanpa nominal). Pembatalan tiket dengan kebijakan warisan project. |

## Risiko / catatan

- **Status booking/project mock.** Pembatalan tercatat di server dulu. Bila transisi status mock ditolak (misalnya status sekarang tidak boleh ke *cancelled*), UI memberi peringatan jelas bahwa kasus Finance sudah tercatat. Server tetap sumber kebenaran untuk uang dan status bayar ("Dibatalkan"). Hal ini tuntas saat modul booking pindah ke server.
- **Uang muka project yang belum dialokasikan** tidak ikut basis. Dialog menampilkannya agar Finance mengalokasikannya dulu bila perlu.
- **Seed tidak membuat kasus pembatalan.** Status project di modul Project masih mock, dan kasus dari seed akan bertentangan dengan layar lain. Seed hanya menerbitkan kebijakan `STD-DP` dan `HOTEL-FLEX` lalu menetapkannya.

## Berikutnya

**Phase 6 — Cash Flow:** proyeksi = kas aktual + sisa piutang − sisa utang − refund disetujui yang belum dibayar, beserta menunya.
