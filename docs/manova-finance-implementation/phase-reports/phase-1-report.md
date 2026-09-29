# Laporan Phase 1 — Baseline + foundation

Tanggal: 29 September 2026 · Branch `monorepo` (HEAD awal `685d708`) · Belum di-commit.

> **Batas klaim.** Phase 1 membangun jalur implementasi: backend yang bisa dijalankan dan dites, DB yang bisa dimigrasi, identitas dan scope server, standar API, API client frontend, dan peta consumer. **Belum ada** fitur finance: tidak ada rekening, mutasi kas, AR/AP, refund, cash flow, atau layar finance baru. UI finance mock lama belum disentuh.

## 1. Apa yang berubah

### Backend (`backend/`)

| File | Alasan |
|---|---|
| `package.json`, `bun.lock`, `tsconfig.json` | Dependency dipin (`elysia ^1.4.30`, `postgres 3.4.9`, `@electric-sql/pglite 0.5.8`, `typescript ~5.9.3`, `@types/bun`), script dev/test/typecheck/db, TS strict dan bundler resolution. Script `test` placeholder yang sengaja gagal diganti. |
| `migrations/0001_foundation`, `0002_core_references`, `0003_identity` (`.up/.down.sql`) | Audit append-only (trigger menolak UPDATE/DELETE/TRUNCATE); bridge referensi party/vendor/project/service/service order/booking; users, sessions, project members. |
| `src/config/env.ts` | Validasi env yang gagal cepat dan melaporkan semua masalah sekaligus. Production wajib `postgres://`, `APP_ORIGINS` eksplisit, dan cookie Secure. |
| `src/db/{client,migrator,backup,rehearsal,seed-demo}.ts`, `src/db/seeds/demo-core.json` | Adapter dua driver dengan tipe identik, migration runner, backup/restore bercek checksum, rehearsal, seed demo yang aman. |
| `src/app.ts`, `src/app-deps.ts`, `src/index.ts`, `src/http/*` | Request ID, security headers, CORS allowlist, cek Origin untuk CSRF, error envelope, pagination, boot yang menolak skema belum siap. |
| `src/auth/*` | Sesi opaque (hanya hash yang disimpan), argon2id, throttle login, RBAC server, route login/logout/me. |
| `src/modules/health/*`, `src/modules/core/*` | Liveness/readiness; baca referensi core dengan scope baris per role. |
| `src/shared/{money,dates,audit}.ts` | Uang BigInt minor unit, tanggal bisnis Asia/Jakarta, penulis audit. |
| `scripts/db.ts`, `scripts/extract-demo-core.ts` | CLI database; ekstraktor seed deterministik dari fixture frontend. |
| `test/*.test.ts` (7 file) | Unit, persistence, dan HTTP. |
| `README.md`, `CLAUDE.md`, `.env.example` | Cara menjalankan dan aturan kerja backend. |

### Frontend (`frontend/`) — tanpa perubahan halaman atau komponen

| File | Alasan |
|---|---|
| `app/types/api.ts` | Tipe wire yang mencerminkan DTO backend. |
| `app/lib/api/{client,errors,endpoints}.ts` (+ `client.test.ts`) | API client bertipe dengan transport yang bisa diganti dan `ApiError` terpadu. |
| `app/lib/money.ts` (+ test) | Format tampilan `MoneyMinor` via BigInt. |
| `app/composables/useApi.ts` | Wiring Nuxt untuk browser dan SSR (meneruskan cookie). |
| `server/routes/api/v1/[...path].ts` | Proxy first-party ke backend yang menimpa `X-Forwarded-For`. |
| `nuxt.config.ts` | `runtimeConfig.apiProxyTarget`, `runtimeConfig.public.apiBase`. |
| `.env.example` | Konfigurasi proxy. |

### Root dan docs

- `package.json` (script backend) dan `CLAUDE.md` (perintah dan penunjuk dokumen).
- `docs/manova-finance-implementation/`:
  - `adr/ADR-001` sampai `ADR-005`
  - `finance-consumer-matrix.md`
  - bagian delta di `01-CURRENT-STATE-ASSESSMENT.md` (ditambahkan, bukan menimpa)
  - checklist `13` untuk Phase 1
  - laporan ini
- Folder untracked `docs/MANOVA_FINANCE_CLAUDE_CODE_PACKAGE/` **tidak disentuh**.

### Tooling mesin

`bun 1.4.2` dan `pnpm 12.6.0` dipasang global via npm karena tidak tersedia. `pnpm install --frozen-lockfile` tidak mengubah lockfile.

## 2. Keputusan

Keputusan lengkap ada di ADR:

- **ADR-001** — kontrak `/api/v1`, envelope, error code, `amountMinor` string, satu pola client di `app/lib/api`, dan proxy Nuxt.
- **ADR-002** — PostgreSQL sebagai sumber kebenaran. postgres.js dipakai untuk server, PGlite untuk dev lokal dan test (ditolak di production). Migrasi berupa SQL murni ber-checksum; backup/restore dan rehearsal tersedia.
- **ADR-003** — sesi server, CSRF/CORS, throttle, dan RBAC server yang mencerminkan matriks frontend ditambah capability finance baru. Scope baris dicek di server; data di luar scope → 404.
- **ADR-004** — bridge referensi (bukan domain kedua), typed booking reference dengan literal `transport`, `service_orders` untuk relasi vendor, ID legacy, provenance, dan rencana cutover demo vs produksi.
- **ADR-005** — penyimpanan bukti (Proposed, diputuskan final di Phase 2).

### Konflik yang dicatat

1. Paket menyebut HEAD `64339d0` dengan root guide untracked. Kenyataannya HEAD `685d708` dan semuanya tracked.
2. `backend/CLAUDE.md` lama meminta struktur diusulkan sebelum fitur besar. Prompt Phase 1 memerintahkan membangun foundation dengan ADR, jadi ADR berfungsi sebagai usulan yang bisa direview.
3. Paket mengasumsikan vendor terhubung lewat booking. Di repo, relasinya lewat `ProjectService` / `ServiceOrder`.
4. Paket `09` menyebut PM "sesuai scope", sedangkan mock tidak membatasi per project. Server mengikuti mock (keputusan terbuka).

## 3. Bukti

### Backend

| Check | Hasil |
|---|---|
| `bun run typecheck` | Lulus (0 error). |
| `bun test` (PGlite in-memory) | **86 pass / 0 fail**, 7 file. |
| `TEST_DATABASE_URL=postgres://…/manova_test bun test` (PostgreSQL 17.x, schema terisolasi per file) | **86 pass / 0 fail**. |
| `db:rehearse` di PostgreSQL 17 (`rehearse_src` → `rehearse_dst`, `pg_dump`/`pg_restore`) | Lulus 6 langkah. Detail di bawah tabel. |
| Rehearsal PGlite (di dalam `backup.test.ts`) | Lulus. |
| Boot guard | DB belum dimigrasi → keluar dengan "3 pending migration(s)". `APP_ENV=production` tanpa `DATABASE_URL` → ditolak. PGlite di production → ditolak. `db:seed:demo` tanpa `APP_ENV` → ditolak. |
| Smoke HTTP nyata (`bun run start`, curl) | `/api/v1/health` 200 schema v3 → login 200 → `/auth/me` 200 → `/projects` 200 → logout → `/auth/me` 401. |

Langkah rehearsal PostgreSQL 17:

1. Up 1, 2, 3.
2. Seed: 8 party, 7 vendor, 8 project, 17 service, 18 booking ref, 2 service order, 7 user.
3. Down ke 0 → tidak ada tabel domain yang tersisa.
4. Up lagi dan seed → jumlah baris identik.
5. Backup (dump 30.955 byte + sha256).
6. Restore → jumlah baris identik, skema v3, checksum terverifikasi.

### Cakupan test

- **Paritas driver** — termasuk regresi JSON postgres.js.
- **Migrasi** — fresh, idempotent, rollback bertahap dan ke 0, `--to`, drift checksum, out-of-order, file yang tidak berpasangan.
- **Invariant DB** — audit append-only, scope user per role, email unik lower-case, service booking harus satu project, literal `transport`.
- **Seed** — idempoten, ditolak di production, ditolak pada data non-demo tanpa menimpa akun nyata, tanpa field uang.
- **Backup** — checksum yang dirusak ditolak, file tanpa sidecar ditolak, target yang tidak kosong ditolak.
- **HTTP** — request ID, 404 envelope, security header, CORS, CSRF.
- **Auth** — cookie flags, token yang disimpan ter-hash, pesan gagal seragam, validasi berbahasa Indonesia, logout dan suspend mencabut sesi, sesi kedaluwarsa, throttle sekuensial dan paralel, cookie rusak → 401, audit tanpa sandi.
- **RBAC** — cermin matriks frontend, maker/checker opening balance, finance-only posting.
- **Scope** — tiap role internal, paginasi cursor, client/vendor, ID tampering (`partyId`, ID project lain), 404 tanpa bocor, ID/cursor NUL → 400/404.

### Frontend

Dibandingkan dengan baseline sebelum perubahan:

| Check | Baseline | Sesudah |
|---|---|---|
| `pnpm lint` | Gagal: 138 problem (81 error, 57 warning) | **Identik baris-per-baris dengan baseline**. File baru lint-clean (`eslint server app/lib app/types/api.ts app/composables/useApi.ts nuxt.config.ts` → 0 problem). |
| `pnpm typecheck` | Lulus | Lulus |
| `pnpm test` | 177 pass (10 file) | **192 pass** (12 file; +15 test baru) |
| `pnpm build` | Lulus | Lulus (build ulang setelah perbaikan review; route proxy `server/routes/api/v1/[...path]` ada di output) |

### Smoke non-finance dan proxy di browser nyata

Build produksi (`node .output/server/index.mjs`, :8080) + backend (`bun run start`, `TRUST_PROXY=true`, :3000), Chrome headless via CDP (`scratchpad/browser-smoke.mjs`), viewport 1440×900, sesi mock dibuat lewat `localStorage` seperti login demo:

| Halaman | Judul (h1) | Console error / exception | Error page |
|---|---|---|---|
| `/` | Halo, Admin. | tidak ada | tidak |
| `/project-orders` | Project | tidak ada | tidak |
| `/project-orders/PRJ-103` | Palu MICE Conference 2026 | tidak ada | tidak |
| `/bookings` | Daftar Booking | tidak ada | tidak |
| `/ticketing/FLT-1011` | Flight Booking FLT-1011 | tidak ada | tidak |
| `/vendors/VND-006` | PT ABC | tidak ada | tidak |
| `/crm/parties/PTY-001` | PT Cipta Distribusi Nusantara | tidak ada | tidak |
| `/finance` (UI lama, belum disentuh) | Finance | tidak ada | tidak |
| `/finance/invoices` (UI lama) | Invoice & Piutang | tidak ada | tidak |

Dari halaman di browser, lewat proxy Nuxt → backend: `GET /api/v1/health` 200 (schema v3) · `/auth/me` sebelum login 401 · `POST /auth/login` 200 (role finance) · `/auth/me` 200 `USR-008` · `/projects?limit=3` 200 `PRJ-101..103` + cursor · `document.cookie` **tidak** memuat token (HttpOnly) · logout 200 · `/auth/me` 401. Login gagal dengan header palsu `X-Forwarded-For: 6.6.6.6` lewat proxy tercatat di audit dengan IP socket `::1` (header klien ditimpa). Screenshot tersimpan di scratchpad sesi (tidak di-commit). Catatan: tile peta CARTO menampilkan "API KEY REQUIRED" — kondisi lama, bukan akibat Phase 1.

Yang **tidak** diuji di Phase 1: viewport mobile/tablet dan keyboard/screen reader (tidak ada UI baru), serta `nuxt dev` (yang diuji adalah build produksi).

## 4. Dampak data dan migrasi

- Skema baru v3 (3 migrasi). Belum ada data produksi.
- Dev default memakai `backend/.data/pglite` (di-gitignore).
- Seed demo hanya berisi referensi dan 7 login (password `manova-demo`). Tidak ada uang di dalamnya.
- Data mock frontend tidak berubah.
- Cutover produksi (import `migration`, saldo pembuka terverifikasi) dijelaskan di ADR-004 dan dilakukan pada fase money/release.

## 5. Temuan review keamanan (independen) dan perbaikannya

Semua temuan sudah diperbaiki dan diberi test regresi:

1. **High** — seed demo bisa menimpa role dan sandi akun nyata bila dijalankan terhadap DB produksi tanpa `APP_ENV`.
   - Perbaikan: butuh `APP_ENV` eksplisit.
   - Perbaikan: menolak DB yang berisi data non-demo.
   - Perbaikan: upsert dibatasi pada baris `demo-fixture`.
2. **Medium** — throttle login bisa ditembus dengan permintaan paralel.
   - Perbaikan: percobaan dihitung sebelum verifikasi.
   - Perbaikan: batas per email ditambahkan.
3. **Medium** — IP di belakang proxy Nuxt bisa dipalsukan, atau semua pengguna tampil dengan IP yang sama.
   - Perbaikan: proxy Nitro menimpa `X-Forwarded-For`.
   - Perbaikan: backend membaca hop paling kanan saat `TRUST_PROXY=true`.
4. **Low** — cookie rusak menghasilkan 500. Sekarang → 401.
5. **Low** — byte NUL di ID/cursor menghasilkan 500. Sekarang → 404/400.

Catatan minor yang juga ditangani:

- Sandi DB lewat `PGPASSWORD`, bukan command line.
- Rollback production memverifikasi checksum backup.
- Health di production tidak menampilkan versi, environment, maupun engine.

## 6. Risiko dan blocker

1. **Frontend belum memakai login server.** `login.vue` menerima kredensial apa pun, dan role switcher memakai `localStorage`. Harus dialihkan sebelum layar finance berbasis API (prasyarat Phase 4). Perlu keputusan bentuk "mode demo".
2. **IdP produksi, reset sandi, dan MFA** belum diputuskan.
3. **Bridge berupa snapshot.** Status dan tanggal project/booking di backend tidak ikut berubah saat mock frontend berubah. Phase 5 (H-x cancellation) membutuhkan sumber booking server atau layanan resmi.
4. **Scope PM per project** dan **role runtime (Roles builder)** belum ada di server. Keputusan bisnis.
5. Throttle in-memory, sehingga berlaku per instance.
6. Lint frontend sudah gagal sejak baseline (81 error) dan tidak diperbaiki karena di luar scope. Gate CI tidak bisa memakai `pnpm lint` apa adanya.
7. PGlite melaporkan PostgreSQL 18.3, sedangkan server yang diuji 17. Suite dijalankan di keduanya, tetapi versi produksi perlu dikunci.
8. Penyimpanan bukti (ADR-005) masih Proposed.

## 7. Kesiapan fase berikutnya

**Phase 2 (money foundation) siap dimulai.** Yang sudah tersedia:

- Pola migrasi.
- Transaksi dan audit dalam satu transaksi.
- Helper uang.
- `requireCapability` beserta capability `finance.manage-bank-accounts`, `finance.approve-opening-balance`, dan `finance.post-cash`.
- Idempotency header yang sudah diizinkan CORS dan dikirim client.
- Scope project.
- Test harness dua engine.

Yang perlu disiapkan di Phase 2:

- Tabel `idempotency_keys`.
- Keputusan final ADR-005.
- Fixture keuangan test-only sesuai paket `10`.

**Phase 4 (UI)** membutuhkan butir risiko #1 terlebih dahulu.
