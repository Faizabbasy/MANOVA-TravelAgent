# Laporan Phase 8 — Regression + release readiness

30 September 2026 · branch `monorepo`. Rujukan: `11-EXECUTION-PHASES.md` (Phase 8), `10-TESTING-AND-ACCEPTANCE-CRITERIA.md`, `09-RBAC-AUDIT-VALIDATION.md`, `15-RELEASE-AND-CUTOVER.md` (baru).

> **Batas klaim.**
> - **Implementasi:** semua acceptance `10` untuk Finance lulus, atau blockernya ditulis eksplisit di bawah. Tidak ada double count yang diketahui.
> - **Deployment:** siap untuk lokal/demo dan staging (PostgreSQL 17). Mode production diuji jalan (smoke).
> - **Runtime produksi dengan data nyata:** **belum bisa**. Ada tiga blocker keputusan/infrastruktur (identitas, impor data referensi, lampiran bukti), dirinci di `15-RELEASE-AND-CUTOVER.md`.

## Commit

| Commit | Isi |
|---|---|
| `33663f7` | **Aturan biaya transfer per arah** (item checklist yang tertinggal sejak Phase 2): migrasi 0013, API, kutipan di form transfer, pengelolaan di halaman rekening |
| `388af24` | Fixture acceptance terkontrol dengan rekonsiliasi angka pasti |
| `d33bce3` | **Perbaikan keamanan:** pemanggil ditolak sebelum body divalidasi, plus sapuan izin seluruh route |
| `3745098` | Rehearsal membawa data Finance melewati backup/restore |
| `7746bc2` | Tidak ada scroll ke samping di lebar tablet |
| (commit ini) | Laporan ini, `15-RELEASE-AND-CUTOVER.md`, README backend, checklist |

## Apa berubah

### 1. Aturan biaya transfer per arah (`33663f7`)
Spec `02` meminta "Arah fee A→B dan B→A punya rule berbeda". Sampai Phase 7 biaya masih diketik manual.

- `transfer_fee_rules`: arah (dari → ke), tetap atau persen (basis poin) dengan min/maks, periode berlaku, aktif/nonaktif. Trigger DB menolak dua aturan aktif yang periodenya bertabrakan untuk arah yang sama, dengan advisory lock per pasangan agar dua insert bersamaan tidak lolos berdua.
- Server memilih aturan dari arah + tanggal transfer; klien tidak pernah menunjuk aturan. Kolom biaya kosong berarti aturan dipakai. Biaya yang diketik dan berbeda tercatat `manual`, berdampingan dengan kutipan aturan.
- Setiap transfer menyimpan `fee_source`, `fee_rule_id`, dan snapshot aturan. Mengubah aturan tidak pernah menulis ulang riwayat (diuji).
- UI: bagian "Biaya transfer" di halaman rekening (tambah/ubah, status Berlaku/Mulai nanti/Berakhir/Nonaktif). Form transfer mengutip biaya langsung ("Aturan BCA-OPS → MDR-VENDOR (biaya tetap): Rp 6.500"). Detail mutasi menjelaskan asal biayanya.

### 2. Fixture acceptance (`388af24`)
`test/finance-acceptance.test.ts` membangun fixture dari `10` lewat API sungguhan: 2 rekening, 2 project, customer A/B, vendor hotel dan maskapai, DP parsial, pelunasan, dua invoice vendor, kebijakan 4 tingkat, refund H-7, transfer dengan biaya per arah, dan satu reversal. Semua angka ditulis tangan di kepala file:

| Angka | Nilai |
|---|---|
| Kas perusahaan | Rp 623.993.500 = OPS 543.993.500 + VND 80.000.000 |
| Piutang / terlambat | Rp 240 jt / Rp 40 jt |
| Utang / terlambat | Rp 75 jt / Rp 45 jt |
| Perkiraan kas 30 hari | Rp 788.993.500 |
| Pendapatan project A / B | Rp 300 jt / Rp 14 jt (30 − 10 dihapus − 6 refund) |

Rekonsiliasi yang diuji: kas = jumlah rekening; ledger berantai dan penutupan = saldo hari ini; statement tanpa transfer internal dan pasangan yang dibatalkan, tapi biaya transfer tetap dihitung; AR/AP = jumlah baris; cash flow berantai per periode, total = jumlah baris = jumlah item; tagihan terlambat di periode pertama; uang yang sudah diposting tidak diproyeksikan lagi; dashboard = ringkasan project = laporan bulanan; Admin hanya melihat status.

### 3. Gerbang izin sebelum validasi (`d33bce3`) — temuan keamanan
Sapuan seluruh route menemukan bahwa Elysia memvalidasi body **sebelum** handler berjalan. Akibatnya, di 28 route tulis, request anonim atau Admin dengan body kosong mendapat **400 berisi nama field**, bukan 401/403. Tidak ada data yang bocor atau tertulis, tapi pemanggil tanpa akses bisa mempelajari bentuk API.

Perbaikan: `src/modules/finance/access.ts`, dipasang di `onTransform` global (berjalan sebelum validasi). Gerbang ini mewajibkan sesi, lalu akses Finance atau salah satu route bersama Admin (status, kebijakan, permintaan pembatalan). Handler tetap memeriksa capability persisnya.

`test/finance-permissions.test.ts` (16 test):
- Semua route Finance dibaca dari tabel route (≥ 70): anonim 401, Admin 403 di luar rute bersama.
- Rute bersama Admin tidak memuat satu pun field nominal.
- Sesi user suspended dan cookie palsu → 401.
- Tampering: alokasi ke invoice customer/vendor lain, booking dari project lain, field aktor/waktu di body (diabaikan), rekening belum terverifikasi, Idempotency-Key sama dengan body beda.
- Maker ≠ checker berlaku juga untuk Super Admin.
- Audit memuat aktor dan request ID yang diterima klien, bersifat append-only, dan percobaan yang ditolak tidak menulis audit.
- Belum ada route bukti/lampiran (ADR-005). Test menjaga agar route seperti itu tidak muncul tanpa test aksesnya.

### 4. Rehearsal dengan data Finance (`3745098`)
Rehearsal sekarang menjalankan finance demo sesudah re-apply, lalu membandingkan **sidik jari keuangan** sebelum dan sesudah restore (22 angka: jumlah baris, saldo per rekening, AR/AP terbayar, uang belum dialokasikan, total bergerak). Rehearsal juga membuktikan buku kas tetap menolak UPDATE setelah restore.

### 5. Tablet 768 px (`7746bc2`)
Dengan sidebar terbuka, lebar konten tinggal 512 px. Tiga halaman bisa di-scroll ke samping:
- **Piutang:** tiga tombol di header. `PageHeader` kini menumpuk dan membungkus di bawah `lg`.
- **Detail project:** tab 829 px. `TabsList` diberi `max-w-full` agar scroll internalnya bekerja.
- **Cash Flow:** label `sr-only` di dalam tabel adalah elemen absolut tanpa leluhur `relative`, sehingga lolos dari wadah scroll dan melebarkan halaman ke 1.029 px. Wadahnya kini `relative`.

Tampilan 1440 dan 390 tidak berubah (diukur ulang).

### 6. Dokumen rilis
- `15-RELEASE-AND-CUTOVER.md`: status per lingkungan, blocker produksi, konfigurasi, langkah deploy, smoke check, rollback, cutover, contoh `curl` untuk semua alur utama, dan kode error.
- README backend: tabel API dilengkapi sampai Phase 8.

## Bukti

| Pemeriksaan | Hasil |
|---|---|
| Backend `bun run test` PGlite | **263 pass** (16 file) |
| Backend `bun run test` PostgreSQL 17 | **263 pass** (16 file) |
| Acceptance / izin / biaya transfer (PGlite + PostgreSQL 17) | 14 / 16 / 9 pass di kedua engine |
| `db:rehearse` PostgreSQL 17 | lulus sampai **v13** (7 langkah; sidik jari 22 angka identik; buku kas immutable setelah restore) |
| Typecheck backend & frontend | bersih |
| Frontend vitest | **228 pass** (termasuk 4 test helper aturan biaya) |
| Frontend `pnpm build` | berhasil (`.output`, preset node-server) |
| Lint file yang disentuh | tanpa error. 1 warning lama di `PageHeader.vue` (`require-default-prop`) sudah ada sebelumnya. |
| Smoke mode production (PostgreSQL, port 3100) | `/api/v1/health` 200 v13 tanpa engine/versi; anonim 401 termasuk POST body kosong; demo-login 404; POST dari origin asing 403 (CSRF); cookie `__Host-manova_session; Secure; HttpOnly; SameSite=Lax` |
| Browser Admin 1440 (17 halaman) | dashboard, pipeline, project order + detail PRJ-102 (gerbang DP dari server), daftar booking, tiket/hotel/transport/MICE, vendor, procurement, CRM customer, Reports, Changes (daftar refund), `/finance` → dialihkan ke `/`. Tanpa error konsol, API gagal, atau overflow. |
| Deep link lama (Finance) | `/finance/invoices` → Piutang, `/payments` → Mutasi, `/ledger` → Rekening, `/notes` → Piutang, `/reconciliation` → Mutasi, `/opex` → Mutasi (`kind=expense`), `/tax` → Ringkasan |
| Tablet 768 | halaman Finance, dashboard, project order + detail, vendor, tiket, booking, CRM: tanpa scroll samping setelah perbaikan. Sisa 2 px di dashboard (lihat Risiko). |
| Browser aturan biaya | tambah aturan BCA-OPS → MDR-VENDOR Rp 6.500 (tampil "Berlaku"); form transfer mengutip Rp 6.500 dan berganti ke biaya yang diketik |

## Acceptance `10` — status

| Skenario | Status |
|---|---|
| Invoice terbit → AR | lulus (acceptance) |
| Receipt DP parsial | lulus. Receipt terikat ke customer, project lewat alokasi. |
| Vendor invoice approve → AP | lulus |
| Vendor payment parsial + replay | lulus |
| Transfer A→B dengan biaya, aturan B→A berbeda | lulus (Phase 8) |
| Refund H-7 | lulus |
| Cash flow 30d/3m/6m/12m | lulus (Phase 6 + acceptance) |
| Reversal | lulus |
| RBAC | lulus untuk tiga role aktif. Client/supplier: portal dimatikan (ADR-006), DTO portal belum dibuat. |
| Alur lama tetap bekerja | halaman lolos render dan test frontend. Alur operasional masih mock frontend (ADR-004). |
| Browser 1440/768/390, keyboard | lulus. Screen reader sungguhan belum. |
| Data besar | baseline Phase 7. Statement/AR/AP dipaginasi. |

## Data / migrasi

- **0013** aditif: tabel `transfer_fee_rules` dan kolom `fee_source`, `fee_rule_id`, `fee_snapshot` di `transfers`. Transfer lama tercatat `manual`.
- Rollback ke 12 diuji di rehearsal. Rilis lama menolak start di v13, jadi turunkan skema dulu (`15-RELEASE-AND-CUTOVER.md`).
- **Database dev:** dimigrasi ke v13. Satu aturan biaya demo dibuat lewat browser (BCA-OPS → MDR-VENDOR Rp 6.500). Tidak ada transfer yang diposting.

## Keputusan

- Gerbang izin Finance dipasang sekali di `onTransform`, bukan di tiap route, karena hanya hook itu yang berjalan sebelum validasi. Daftar rute bersama Admin sengaja pendek dan diuji.
- Biaya yang diketik boleh berbeda dari aturan (bank kadang memotong lain). Selisihnya tidak ditolak, tapi dicatat `manual` bersama kutipannya supaya bisa ditelusuri.

## Risiko / blocker

- **Blocker produksi:** identitas pengguna (ADR-003), impor referensi nyata (ADR-004), lampiran bukti (ADR-005). Detail dan urutan cutover di `15-RELEASE-AND-CUTOVER.md`.
- Screen reader sungguhan belum diuji. Yang sudah: label, fokus, `aria-live`, dan tab sungguhan.
- Dashboard di 768 px masih bisa bergeser 2 px ke samping. Tidak ada satu elemen pun yang menyebabkannya, dan sudah ada sebelum Phase 8.
- Ledger rekening dan ringkasan project belum dipaginasi (Phase 7).
