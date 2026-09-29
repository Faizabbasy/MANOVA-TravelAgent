# ADR-002 — Database, driver, migrasi, dan backup

- **Status:** Accepted (Phase 1, 29 Sep 2026)
- **Konteks:** Repo tidak punya DB, ORM, migrasi, atau backup. Paket `03` mensyaratkan FK, transaksi atomik, unique constraint, index, migrasi berurutan, backup/restore, dan melarang membangun finance di atas pilihan sementara yang tak bisa dimigrasi. Lingkungan audit: Windows 11, PostgreSQL 17 terpasang sebagai service (kredensial tidak diketahui — tidak disentuh), Docker Desktop terpasang tetapi daemon mati; developer lain memakai macOS.

## Keputusan

1. **PostgreSQL adalah system of record** (produksi, staging, dev bersama). Relasional, transaksional, `SELECT … FOR UPDATE`, advisory lock, check/unique/FK, `bigint` untuk minor unit.
2. **Dua driver, satu dialek SQL** di balik `backend/src/db/client.ts` (`Db`: `query`, `exec`, `transaction`, `close`):
   - `postgres://…` → **postgres.js 3.4.9** ke server PostgreSQL.
   - `pglite://<dir>` / `pglite://memory` → **PGlite 0.5.8** (PostgreSQL dikompilasi ke WASM, in-process). Dipakai untuk dev lokal tanpa infrastruktur (default `pglite://.data/pglite`) dan test. **Ditolak di `APP_ENV=production`** oleh validasi env.
   - Tipe dikembalikan identik di kedua driver: `int8`/`numeric` → string, `date` → `YYYY-MM-DD`, `timestamptz` → `Date`, `jsonb` → objek. JSON ditulis sebagai `$n::text::jsonb` (postgres.js menserialisasi ulang string yang diikat langsung ke `::jsonb` — bug ini tertangkap oleh test paritas dan kini diuji).
3. **Migrasi SQL murni** di `backend/migrations/NNNN_name.up.sql` + `.down.sql`, dijalankan oleh runner kecil `backend/src/db/migrator.ts`: satu transaksi per migrasi, `pg_advisory_xact_lock` terhadap migrator paralel, tabel `schema_migrations(version, name, checksum)`. Checksum SHA-256 dinormalisasi CRLF→LF (repo memakai `core.autocrlf`). File yang diedit setelah diterapkan (drift), file hilang, atau migrasi out-of-order → migrasi ditolak dan server menolak start.
4. **Backup/restore** (`backend/src/db/backup.ts`): Postgres = `pg_dump --format=custom` → `pg_restore --single-transaction --exit-on-error`; PGlite = tarball data-dir. Setiap backup punya sidecar `.sha256`; restore memverifikasi checksum dan **hanya ke database/direktori kosong**.
5. **Rehearsal** `bun run db:rehearse`: fresh → up → seed → down ke 0 → up → seed → backup → restore ke target baru → bandingkan jumlah baris dan versi skema.
6. Rollback di production mensyaratkan `--confirm-backup <file yang ada>`. Reversal data uang (Phase 2+) memakai compensating entry, bukan down-migration.

## Alternatif yang ditolak

- **SQLite (`bun:sqlite`)** — tanpa infrastruktur, tetapi dialek/locking berbeda dari target produksi → risiko "pilihan sementara yang tak bisa dimigrasi".
- **Drizzle/Prisma** — Prisma berat dan engine-binary; Drizzle bagus tetapi migrator bawaannya forward-only dan skema TS dapat drift dari SQL. SQL eksplisit lebih mudah direview untuk constraint uang. Query builder bisa ditambahkan nanti di atas `Db` tanpa mengubah skema.
- **Docker Compose Postgres sebagai syarat dev** — tetap didukung lewat `DATABASE_URL`, tetapi tidak diwajibkan karena daemon tidak selalu tersedia.

## Konsekuensi

- Dev bisa `bun run dev` tanpa memasang apa pun; tim yang ingin paritas penuh cukup mengarahkan `DATABASE_URL` ke Postgres.
- PGlite satu proses: data-dir tidak boleh dibuka dua proses bersamaan (CLI db dan server berjalan berurutan). PGlite 0.5.8 melaporkan PostgreSQL 18.3; server lokal yang diuji 17 — suite test dijalankan di keduanya.
- Test suite: default PGlite in-memory; `TEST_DATABASE_URL=postgres://…` menjalankan suite yang sama pada schema Postgres terisolasi per file.

## Cara menjalankan

```bash
cd backend
bun run db:migrate            # terapkan migrasi (juga otomatis di `bun run dev`)
bun run db:status             # versi, pending, drift
bun run db:rollback --steps 1 # atau --to 0
bun run db:seed:demo          # data demo (ditolak di production)
bun run db:backup             # → .data/backups/*.tar.gz|.dump + .sha256
bun run db:restore <file> --target <url-db-kosong>
bun run db:rehearse [--source <pg-url-kosong> --restore <pg-url-kosong>]
TEST_DATABASE_URL=postgres://user@host:5432/db bun test
```
