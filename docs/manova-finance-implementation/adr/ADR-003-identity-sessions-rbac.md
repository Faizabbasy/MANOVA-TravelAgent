# ADR-003 — Identitas, sesi, dan RBAC server

- **Status:** Accepted untuk dev/demo; **produksi butuh keputusan IdP** (lihat Konsekuensi) — Phase 1, 29 Sep 2026
- **Konteks:** Login mock (`frontend/app/pages/login.vue`) menerima email/sandi apa pun dan menulis `localStorage.isAuthenticated`; identitas aktif sebenarnya `localStorage.manovaCurrentUserId` (default `USR-010` super-admin) yang bisa diganti dari Settings. `middleware/auth.ts` dan `rbac.global.ts` hanya client-side. Paket `09` dan `12` melarang API mempercayai role/scope dari browser.

## Keputusan

**Sesi server opaque** (`backend/src/auth/sessions.ts`, migrasi `0003_identity`):

- Tabel `users` (email unik lower-case, `role` ∈ 7 role frontend, `party_id` untuk `client`, `vendor_id` untuk `vendor`, `status`, `password_hash` argon2id via `Bun.password`). Check constraint memaksa: client ⇒ tepat satu party, vendor ⇒ tepat satu vendor, role internal ⇒ tanpa scope.
- Login → token acak 256-bit di cookie `HttpOnly; SameSite=Lax; Path=/` (nama `__Host-manova_session` + `Secure` bila `COOKIE_SECURE`), DB hanya menyimpan SHA-256 token. Kedaluwarsa absolut (`SESSION_TTL_HOURS`, default 12). Logout menghapus baris; user `suspended` langsung kehilangan sesi karena lookup join `users.status`.
- Pesan gagal login seragam (`INVALID_CREDENTIALS`) dan waktu verifikasi disamakan (dummy hash) agar email tidak bisa di-enumerasi. Throttle dihitung **sebelum** verifikasi sandi (tebakan paralel tidak lolos): 5 percobaan / 15 menit per (IP, email) dan 20 per email dari IP mana pun → 429 + `Retry-After`; login sukses me-reset.
- **CSRF:** SameSite=Lax + mutasi dari `Origin` di luar `APP_ORIGINS` atau `Sec-Fetch-Site: cross-site` ditolak 403 sebelum handler. CORS hanya untuk origin allowlist.
- Audit append-only: `auth.login`, `auth.login_failed` (dengan alasan, tanpa sandi), `auth.logout`.

**RBAC server** (`backend/src/auth/rbac.ts`) = batas keamanan; salinan frontend hanya affordance.

- Role, module key, dan level **mencerminkan persis** `frontend/app/data/rbac.ts` (`SEED_MODULE_LEVELS`, `SEED_CAPABILITIES`), termasuk `super-admin` bypass.
- Capability finance baru dari paket `09`: `finance.view-cash`, `finance.view-cash-flow` (finance, management), `finance.manage-bank-accounts`, `finance.post-cash`, `finance.manage-receivables`, `finance.manage-payables`, `finance.settle-refund`, `finance.manage-policy` (finance), `finance.approve-opening-balance` (management — sengaja **bukan** maker finance), `finance.approve-refund` (finance, management), `finance.view-project-finance` (finance, management, operations). `GET /api/v1/auth/me` mengembalikan modul + capability hasil hitung server.
- **Scope baris** (`backend/src/modules/core/scope.ts`), satu tempat: client → project milik `party_id`-nya; vendor → project tempat ia memegang `project_services` atau `service_orders`, dan hanya booking pada service miliknya; internal → semua project bila level `operations ≥ VIEW` (sama dengan mock: `ownerId/teamUserIds` hanya filter "milik saya"). Di luar scope = **404** (tidak membocorkan keberadaan). Portal menerima DTO tereduksi (tanpa owner/team/provenance/vendor link).

**Batas demo:** akun demo hanya dibuat `bun run db:seed:demo` — butuh `APP_ENV=development|test` eksplisit, ditolak di production, **ditolak bila DB sudah berisi data non-demo**, dan upsert hanya menyentuh baris ber-provenance `demo-fixture` dengan email fixture frontend dan sandi `DEMO_PASSWORD` (default `manova-demo`). Tidak ada endpoint "login sebagai role" dan server tidak membaca `localStorage`.

## Alternatif yang ditolak

- **JWT stateless** — tidak bisa dicabut seketika saat suspend/logout tanpa denylist; sesi DB lebih sederhana dan cukup untuk skala ini.
- **Mempercayai header role dari frontend demo** — dilarang paket `09`/`12`.
- **Tabel roles/grants runtime sekarang** — builder role di mock bisa membuat role baru, tetapi menyimpannya di server memerlukan UI admin + audit + guard anti-lockout. Ditunda; matriks code-reviewed dulu.

## Konsekuensi / keputusan terbuka

1. **Frontend belum memakai login server.** Mengganti `login.vue` + `useCurrentUser` (role switcher demo) adalah perubahan lintas modul; direncanakan sebagai prasyarat Phase 4 dengan mode demo yang eksplisit.
2. **IdP produksi** (SSO perusahaan vs email+sandi) belum diputuskan; reset sandi, MFA, dan rotasi sesi menyusul keputusan itu.
3. **Scope PM/Operations per project:** paket `09` menyebut "ringkasan project sesuai scope"; mock tidak membatasi per project. Server saat ini mengikuti mock; pembatasan per `project_members` tinggal mengubah `projectScopeOf` bila bisnis memutuskan.
4. Throttle login in-memory → per instance; butuh store bersama sebelum multi-instance.

## Cara menjalankan

```bash
cd backend && bun run db:seed:demo && bun run dev
curl -c jar -H 'content-type: application/json' -H 'origin: http://localhost:8080' \
  -d '{"email":"budi.santoso@manova.id","password":"manova-demo"}' http://localhost:3000/api/v1/auth/login
curl -b jar http://localhost:3000/api/v1/auth/me
```
