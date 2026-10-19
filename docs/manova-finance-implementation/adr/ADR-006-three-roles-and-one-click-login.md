# ADR-006 — Tiga role dan login satu-klik

- **Status:** Accepted (29 Sep 2026, permintaan pengguna)
- **Menggantikan sebagian:** matriks 7-role di ADR-003 (mekanisme sesi, CSRF, throttle, dan scope tetap berlaku)

## Keputusan pengguna

1. Login dibuat *easy access*: satu klik di halaman login langsung masuk ke akunnya.
2. Role dibatasi tiga: **Admin**, **Finance**, dan **Super Admin** yang bisa keduanya.
3. Admin = semua modul **kecuali Finance** (dipilih dari opsi yang ditawarkan).
4. Portal Client & Vendor **disembunyikan dulu**, kodenya tidak dihapus (dipilih dari opsi yang ditawarkan).

## Matriks

| Role | Modul | Catatan |
|---|---|---|
| Super Admin | Semua (ADMIN), termasuk Finance | Satu-satunya yang mengelola user & role, dan checker saldo pembuka. |
| Admin | Sales, CRM, Operations (APPROVE); Vendor & Partner, Inventory, Marketing, HR, Reporting & BI, Administration, Documents (MANAGE); **Finance: NONE** | Gabungan management + sales + operations lama. Memegang semua capability operasional dan master data, tetapi **tidak** mengelola user/role, karena siapa pun yang bisa mengatur role bisa memberi dirinya Finance. |
| Finance | Finance (MANAGE); modul lain VIEW sebagai konteks | Semua capability `finance.*` kecuali `approve-opening-balance` (maker/checker: hanya Super Admin yang menyetujui). |
| Client, Vendor | Portal masing-masing | `hidden` di frontend, `active: false` di server. Login ditolak (`403 ROLE_DISABLED`) dan sesi lama tidak berlaku, kecuali `PORTAL_LOGIN=true`. Aturan scope tetap ada dan tetap dites. |

- **Role lama tidak dihapus dari data.** `management`/`sales`/`operations` dan semua id yang dulu melebur ke sana diresolusi ke `admin` lewat `LEGACY_ROLE_ALIAS` (frontend). Pemanggilan `isRole('operations')` dan sejenisnya di puluhan halaman tetap bekerja tanpa diubah.
- **Migrasi `0004_three_roles`** memindahkan user server ke `admin`. Down-migration bersifat lossy (kembali ke `operations`).
- **Konsekuensi yang disengaja dan diuji:** role lama yang dulu bisa melihat Finance (management, project-manager, viewer) kini tidak lagi lewat Admin.
  - Widget dashboard yang berisi data Finance (ringkasan pendapatan/kas, Outstanding Invoices, Invoice Aging) hanya untuk Finance dan Super Admin.
  - Tab Finance di detail project hanya tampil untuk role dengan akses modul Finance.
- Pembatasan "Sales hanya melihat portofolionya" dimatikan karena Sales kini Admin yang melihat seluruh data. Flag-nya tetap ada supaya mudah dihidupkan lagi.

## Login satu-klik

- **Halaman login** menampilkan tiga kartu akun (`DEMO_LOGIN_ACCOUNTS`): Admin MANOVA (Super Admin), Doni Saputra (Admin; pemilik semua project demo), dan Budi Santoso (Finance).
- **Klik kartu** → `POST /api/v1/auth/demo-login { userId }` → sesi server sungguhan (cookie HttpOnly, audit `auth.demo_login`) → user aktif di aplikasi disetel → masuk ke `/`.
- **Pembatasan server:**
  - `DEMO_LOGIN` default aktif di development/test dan **tidak bisa diaktifkan di production** (config ditolak).
  - Hanya user `provenance = 'demo-fixture'` yang aktif dan role-nya boleh login yang diterima; selain itu 404 yang sama.
  - Tetap melewati cek Origin (CSRF).
- **Bila server API mati**, aplikasi tetap bisa dipakai dalam *mode lokal* dengan toast peringatan (data server tidak tersedia). Penolakan dari server (misalnya akun belum di-seed) ditampilkan sebagai error, bukan diam-diam masuk.
- **Form email & kata sandi** tetap ada (dilipat) dan memakai `POST /auth/login`.
- **Logout** kini juga mengakhiri sesi server.

## Perbaikan terkait

User aktif kini disimpan di cookie + `useState`, bukan hanya `localStorage`:

- Dulu server selalu merender Super Admin lalu browser menukarnya, sehingga muncul hydration mismatch. Mismatch class tidak dikoreksi di production, jadi badge atau nama user lain bisa tampil salah. Dengan login satu-klik, kasus ini jadi umum.
- Middleware akses route sekarang juga berjalan saat SSR. Halaman terlarang (misalnya `/finance` untuk Admin) tidak dirender sama sekali: server mengalihkan ke `/?ditolak=<path>`.
- Toast "Akses ditolak" ditampilkan setelah hydration, hanya bila path tersebut memang menu terlarang bagi user itu, sehingga tautan buatan tidak bisa memunculkan pesan palsu.

## Cara menjalankan

```bash
cd backend && bun run db:migrate && APP_ENV=development bun run db:seed:demo
cd .. && npm run dev    # buka http://localhost:8080/login
```

Untuk mengaktifkan portal lagi nanti:

- backend: `PORTAL_LOGIN=true`
- frontend: hapus `hidden: true` pada role client/vendor di `app/data/rbac.ts` dan tambahkan akunnya ke `DEMO_LOGIN_ACCOUNTS`.

## Update 2026-10-14 — Portal aktif di development/staging (S12a)

Keputusan pengguna: portal client & vendor **dinyalakan di development/staging** selama datanya dipindah ke server
(S12), dan **tetap tertutup di production** sampai S12 selesai.

- Backend: `PORTAL_LOGIN` default `true` di luar production; `PORTAL_LOGIN=true` di production ditolak saat start
  (config error), seperti `DEMO_LOGIN`. `.env.example` dan `deploy/bootstrap-server.sh` kini menulis `PORTAL_LOGIN=true`.
  **Server staging yang sudah ada menyimpan `PORTAL_LOGIN=false` di `backend/.env`** (ditulis saat bootstrap) —
  ubah manual ke `true` lalu `pm2 reload manova-api` agar portal bisa dicoba di staging.
- `GET /api/v1/auth/options` (publik) → `{ demoLogin, portalLogin }`. Plugin `plugins/portal-options.ts` membacanya saat
  SSR; role portal tetap `hidden` di data, tetapi `isRoleSelectable` mengizinkannya selama `portalLogin` aktif.
- Login satu-klik menampilkan Dimas Pratama (client, PTY-005) dan Hasan Alfarizi (vendor) bila portal aktif.

## Update 2026-10-19 — Portal client menulis ke server (S12b-1)

Di dev/staging (portal aktif), client kini menulis peserta & kamar, dokumen & pesan, profil non-sensitif & kontak, dan
sengketa invoice lewat `/api/v1/client/*` — hanya untuk party-nya sendiri, dengan log aktivitas dan notifikasi ke staf.
Perubahan peserta dikunci setelah project berangkat (lewat change request). Entitas khusus portal (travel request,
approval, support, feedback, bukti bayar, perubahan profil sensitif) tetap lokal sampai S12c.
