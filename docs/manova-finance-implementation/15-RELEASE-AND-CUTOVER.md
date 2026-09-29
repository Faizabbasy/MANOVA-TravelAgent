# Rilis, deployment, dan cutover Finance

Disusun di Phase 8 (30 September 2026). Menjelaskan cara menjalankan rilis ini, hal yang **belum** bisa dilakukan di produksi, dan contoh API untuk alur utama.

## Status rilis

| Lingkungan | Status | Alasan |
|---|---|---|
| Lokal / demo (PGlite) | **Siap** | `npm run dev`, seed demo, login satu klik. |
| Staging (PostgreSQL 17, data demo) | **Siap** | Semua check Phase 8 lulus di PostgreSQL 17 (test, rehearsal, backup/restore). |
| Produksi dengan data nyata | **Terblokir** | Lihat "Blocker produksi". |

### Blocker produksi (harus diputuskan sebelum cutover)

1. **Identitas pengguna (ADR-003).** IdP produksi (SSO vs email+sandi) belum diputuskan. Belum ada cara membuat akun nyata: seed demo ditolak di production dan belum ada layar/CLI manajemen user yang tersambung ke server. Reset sandi dan MFA menunggu keputusan ini.
2. **Data referensi nyata (ADR-004).** Project, customer, vendor, dan booking di server masih berupa *bridge* dari fixture frontend (`provenance = demo-fixture`). Produksi butuh impor terkontrol ber-provenance `migration`, dan alat impornya belum ada. Domain operasional (booking, project order) masih mock di frontend. Karena itu H-x pembatalan memakai tanggal keberangkatan dari bridge.
3. **Bukti transfer / lampiran (ADR-005).** Masih usulan. Belum ada route unggah; test izin memastikan route seperti itu tidak muncul tanpa test aksesnya sendiri.

Yang **tidak** memblokir, tapi perlu diketahui:
- Invoice dan utang belum punya rekening tujuan/sumber, jadi tampilan Cash Flow per rekening hanya menunjukkan saldonya (Phase 6).
- Saldo minimum Cash Flow hanya disimpan di browser.
- Pengeluaran rutin tanpa invoice (gaji, sewa) belum bisa direncanakan di Cash Flow.

## Komponen

| Komponen | Jalankan | Catatan |
|---|---|---|
| PostgreSQL 17 | layanan terkelola atau server sendiri | Satu database. `pg_dump`/`pg_restore` harus ada di PATH (atau `PG_BIN`) untuk backup. |
| Backend (`backend/`, Bun ≥ 1.2) | `bun install --production` lalu `bun run db:migrate` dan `bun run start` | Menolak start bila ada migrasi tertunda atau checksum berbeda. |
| Frontend (`frontend/`, Node 20+, pnpm) | `pnpm install --frozen-lockfile`, `pnpm build`, lalu `node .output/server/index.mjs` | Browser memanggil `/api/v1/**` di origin frontend; Nuxt meneruskannya ke backend. |

### Konfigurasi backend (`backend/.env`, lihat `.env.example`)

| Variabel | Produksi | Keterangan |
|---|---|---|
| `APP_ENV` | `production` | Mengaktifkan semua pengaman di bawah. |
| `DATABASE_URL` | `postgres://…` | Wajib. PGlite ditolak di production. |
| `APP_ORIGINS` | origin frontend, mis. `https://app.manova.id` | Wajib. Dipakai untuk CORS dan cek CSRF. |
| `COOKIE_SECURE` | `true` (dipaksa) | Nama cookie menjadi `__Host-manova_session`. |
| `TRUST_PROXY` | `true` **hanya** bila backend tidak bisa diakses langsung dari internet (hanya lewat proxy Nuxt) | Menentukan IP untuk throttle login dan audit. |
| `DEMO_LOGIN` | `false` (dipaksa) | Login satu klik mati. |
| `PORTAL_LOGIN` | `false` | Portal client/vendor dimatikan (ADR-006). |
| `SESSION_TTL_HOURS` | sesuai kebijakan | Default 12. |

### Konfigurasi frontend (`frontend/.env`)

| Variabel | Nilai |
|---|---|
| `NUXT_API_PROXY_TARGET` | URL internal backend, mis. `http://backend:3000` |
| `NUXT_PUBLIC_API_BASE` | biarkan `/api/v1` (request tetap first-party lewat proxy) |

## Deploy (staging atau rilis berikutnya)

1. **Backup dulu.** `bun run db:backup --out /backup/manova` menghasilkan file dump dan `.sha256`. Simpan di luar server.
2. **Migrasi.** `bun run db:status` menunjukkan migrasi tertunda. Lalu `bun run db:migrate`. Rilis ini menambah **0013** (`transfer_fee_rules` dan tiga kolom asal biaya di `transfers`). Migrasinya aditif, transfer lama tercatat sebagai biaya `manual`.
3. **Start backend**, lalu frontend.
4. **Smoke check:**
   - `GET /health` → 200 (liveness).
   - `GET /api/v1/health` → 200, `database.pendingMigrations = 0`. Status 503 berarti skema belum siap.
   - Login sebagai Finance, buka Finance → Ringkasan. Saldo tampil atau "belum tersedia" (bukan Rp 0 palsu).
   - `GET /api/v1/finance/cash-position` tanpa login → 401.

### Rollback

- **Kode + skema:** rilis lama **menolak start** di skema yang punya migrasi yang tidak ia kenal ("Applied migration … has no file"). Karena itu, turunkan skema dulu dengan kode rilis ini: `bun run db:rollback --to 12 --confirm-backup <file-backup>` (production menolak rollback tanpa file backup), lalu deploy rilis sebelumnya. Rollback 0013 menghapus aturan biaya dan kolom asal biaya. Nominal biaya pada transfer tetap ada.
- **Data:** `bun run db:restore <file> --target <database-kosong>`. Checksum diverifikasi dan target wajib kosong. Arahkan `DATABASE_URL` ke database hasil restore.

Rehearsal lengkap (up → rollback ke 0 → up → seed → finance demo → backup → restore → bandingkan) dijalankan di database scratch dengan `bun run db:rehearse --source <url> --restore <url>`. Rehearsal menolak jalan di `APP_ENV=production` dan pada database yang tidak kosong.

## Cutover produksi (setelah blocker 1 dan 2 selesai)

1. Impor referensi (project, customer, vendor, booking) dengan provenance `migration`. Jangan jalankan `db:seed:demo` atau `db:seed:finance-demo`: keduanya ditolak di production dan pada data non-demo.
2. Buat akun nyata. Finance dan Super Admin harus **orang yang berbeda**: saldo pembuka memakai maker/checker, dan Super Admin pun tidak bisa memverifikasi saldo yang ia ajukan sendiri.
3. **Tanggal cutover.** Finance menambah setiap rekening dan mengisi saldo pembuka dari rekening koran per tanggal cutover. Super Admin memverifikasi dengan nominal dan tanggal yang sama (409 bila berubah di antaranya). Transaksi sebelum tanggal ini tidak dicatat per baris.
4. Isi **aturan biaya transfer** per arah (Rekening → detail → Biaya transfer) dan **kebijakan pembatalan**.
5. Catat tagihan customer dan utang vendor yang masih terbuka per tanggal cutover (invoice terbit, dengan jatuh tempo asli).
6. **Rekonsiliasi hari pertama:** Ringkasan = jumlah saldo rekening = rekening koran; Piutang/Utang = daftar terbuka di sistem lama.

## Contoh API

Semua jawaban: `{ data, meta: { requestId } }` atau `{ error: { code, message, fieldErrors? }, meta }`. Uang selalu string dalam satuan terkecil (IDR: rupiah), mis. `"6500"`. Setiap POST yang memindahkan uang wajib memakai header `Idempotency-Key`: mengulang dengan kunci yang sama mengembalikan hasil pertama (header `idempotent-replayed: true`), sedangkan kunci yang sama dengan isi berbeda ditolak.

```bash
API=http://localhost:3000/api/v1
H='-H content-type:application/json -H origin:http://localhost:8080'

# Login (cookie sesi HttpOnly)
curl -s -c jar $H -X POST $API/auth/login -d '{"email":"budi.santoso@manova.id","password":"manova-demo"}'

# Rekening + saldo pembuka (Finance mengajukan, Super Admin lain memverifikasi)
curl -s -b jar $H -X POST $API/finance/accounts -d '{"code":"BCA-OPS","bankName":"BCA","holderName":"PT MANOVA","accountNumber":"8720415566"}'
curl -s -b jar $H -X POST $API/finance/accounts/BA-001/opening -d '{"amountMinor":"500000000","openingDate":"2026-09-01"}'
curl -s -b jar-superadmin $H -X POST $API/finance/accounts/BA-001/opening/verify -d '{"balanceMinor":"500000000","openingDate":"2026-09-01"}'

# Aturan biaya per arah, lalu kutipan biaya
curl -s -b jar $H -X POST $API/finance/transfer-fee-rules \
  -d '{"fromAccountId":"BA-001","toAccountId":"BA-002","feeType":"fixed","fixedMinor":"6500","effectiveFrom":"2026-09-01"}'
curl -s -b jar "$API/finance/transfer-fee-quote?fromAccountId=BA-001&toAccountId=BA-002&amountMinor=30000000&effectiveDate=2026-09-30"
# → { "data": { "feeMinor": "6500", "rule": { … } } }

# Transfer: kosongkan feeMinor supaya aturan dipakai (feeSource "rule"); isi bila bank memotong lain ("manual")
curl -s -b jar $H -H 'idempotency-key: trf-2026-09-30-001' -X POST $API/finance/transfers \
  -d '{"fromAccountId":"BA-001","toAccountId":"BA-002","amountMinor":"30000000","effectiveDate":"2026-09-30"}'

# Invoice DP → terbit (belum ada uang bergerak) → uang masuk sebagian dengan alokasi
curl -s -b jar $H -X POST $API/finance/customer-invoices \
  -d '{"projectId":"PRJ-201","invoiceType":"dp","lines":[{"description":"DP 50%","amountMinor":"100000000"}],"dueDate":"2026-10-10"}'
curl -s -b jar $H -X POST $API/finance/customer-invoices/CINV-00001/issue -d '{"issueDate":"2026-09-30","dueDate":"2026-10-10"}'
curl -s -b jar $H -H 'idempotency-key: rcpt-2026-09-30-001' -X POST $API/finance/receipts \
  -d '{"bankAccountId":"BA-001","amountMinor":"60000000","effectiveDate":"2026-09-30","partyId":"PTY-005","allocations":[{"invoiceId":"CINV-00001","amountMinor":"60000000"}]}'

# Pembatalan booking H-7 → setujui → bayar refund (uang keluar hanya di langkah terakhir, sekali)
curl -s -b jar $H -X POST $API/finance/cancellations/preview -d '{"subjectType":"flight","subjectId":"FLT-1021","cancelDate":"2026-09-30"}'
curl -s -b jar $H -H 'idempotency-key: cxl-FLT-1021' -X POST $API/finance/cancellations \
  -d '{"subjectType":"flight","subjectId":"FLT-1021","cancelDate":"2026-09-30","reason":"Customer membatalkan"}'
curl -s -b jar $H -X POST $API/finance/refunds/RF-00001/approve -d '{"note":"Sesuai kebijakan"}'
curl -s -b jar $H -H 'idempotency-key: rf-RF-00001-pay' -X POST $API/finance/refunds/RF-00001/settlements \
  -d '{"bankAccountId":"BA-001","amountMinor":"6000000","effectiveDate":"2026-09-30"}'

# Baca: kas, mutasi, piutang/utang, proyeksi, dashboard
curl -s -b jar $API/finance/cash-position
curl -s -b jar "$API/finance/statement?from=2026-09-01&to=2026-09-30&limit=50"
curl -s -b jar "$API/finance/receivables?settlement=overdue"
curl -s -b jar "$API/finance/cash-flow?horizon=3m"
curl -s -b jar $API/finance/overview
```

Kode error yang perlu ditangani klien: `401 UNAUTHENTICATED`, `403 FORBIDDEN` (juga dikembalikan **sebelum** validasi isi untuk pemanggil tanpa akses Finance), `400 VALIDATION_FAILED` (`fieldErrors` per field), `409` (konflik / sudah dibatalkan / idempotency), `422 RULE_VIOLATION` (aturan bisnis, pesan bahasa awam).
