# Backend user & jejak audit (S10a) — desain

Tanggal: 12 Oktober 2026 · Branch: `production` · Status: diimplementasikan (plan 2026-10-12-users-audit-backend)

S10 (admin) dipecah. **S10a** (dokumen ini): direktori user di server (suspend, aktifkan, ganti role) dan Activity
Center / Session Log dari jejak audit server. **S10b**: master data & profil organisasi. Editor RBAC (role & matriks izin)
tetap seperti sekarang: server sengaja memakai matriks tetap di kode (`backend/src/auth/rbac.ts`); membuatnya bisa
diedit di server berisiko eskalasi hak akses dan perlu keputusan terpisah.

## Masalah yang ditutup

1. Admin biasa bisa menaikkan siapa pun (termasuk dirinya) menjadi Super Admin lewat panel Users (gate
   `canManage('administration')`, bukan `admin.manage-users`).
2. Suspend user di UI tidak berefek di server dan role switcher tetap mengizinkan user yang di-suspend.
3. Activity Center & Session Log hanya data demo statis; jejak audit server (`audit_events`) tidak terbaca.

## Keputusan

| Topik | Keputusan |
|---|---|
| Hak kelola user | `admin.manage-users` (Super Admin saja — sudah begitu di matriks server) |
| Suspend | Alasan wajib; tidak bisa suspend diri sendiri; Super Admin aktif terakhir tidak bisa di-suspend; sesi user langsung berakhir dan login ditolak |
| Ganti role | Hanya ke/dari peran internal `super-admin`, `admin`, `finance`; user portal tidak bisa dipindah; tidak bisa mengganti role sendiri; Super Admin aktif terakhir tidak bisa diturunkan; sesi user diakhiri agar izin baru berlaku |
| Daftar user | `GET /users` untuk peran internal (nama dipakai di banyak layar); portal 403 |
| Activity Center | `GET /audit/events` (`admin.view-activity-center`): 200 kejadian audit terbaru dipetakan ke bentuk `SystemEvent` |
| Session Log | `GET /audit/sessions` (`admin.view-activity-center`): login/demo-login dipasangkan dengan logout dari jejak audit |
| Seed | Seed ulang tidak menimpa status/role user yang diubah lewat API |
| Role switcher | Menolak user yang di-suspend |
| Tetap lokal | Editor RBAC, master data & profil organisasi (S10b), event lokal `EVT-` dari editor itu |

## Backend

- Migrasi `0034_user_admin`: `users` + `suspended_reason`, `suspended_at`, `changed_by_api_at`; check
  `status <> 'suspended' or suspended_reason is not null`.
- `core/users.ts`: `listUsers`, `suspendUser`, `reactivateUser`, `changeUserRole` (aturan di atas, kunci baris, audit,
  hapus sesi user yang berubah).
- `core/audit-reads.ts`: `listSystemEvents(limit)` (modul dari prefix aksi: `lead/quotation` → lead/quotation, `party` →
  client, `project/booking/service/task/milestone/...` → project-order, `vendor/service_order` → vendor, `finance`/`invoice`/
  `receipt`… → finance, `auth/user` → user, lainnya → administration) dan `listSessions()`.
- Routes: `GET /users`, `POST /users/:id/suspend {reason}`, `POST /users/:id/reactivate`, `PUT /users/:id/role {role}`,
  `GET /audit/events`, `GET /audit/sessions`.

## Frontend

- `data/users-sync.ts`: muat `USERS` (upsert di tempat; user lokal yang tidak ada di server dibiarkan), suspend/aktifkan/
  ganti role server-first; `data/audit-sync.ts`: Activity Center (`SYSTEM_EVENTS` — baris server `AUD-…` diganti tiap
  muat, `EVT-…` lokal tetap) dan Session Log (`SESSION_LOGS` diganti data server); layout & reset settings.
- `UsersDirectoryPanel` memakai server dan gate `can('admin.manage-users')`; `RolesPermissionsPanel` menugaskan role
  internal lewat server (role kustom lokal ditolak server dengan pesan jelas).
- `setCurrentUser` menolak user yang di-suspend.
- Guard melarang `suspendUser(`, `reactivateUser(`, `assignUserRole(` di layar.

## Testing

- Backend (`test/users-audit.test.ts`): daftar (internal 200, portal 403, 401); suspend (alasan wajib, diri sendiri 422,
  Super Admin terakhir 422, admin biasa 403, sesi target mati & login ditolak), aktifkan; ganti role (role tak dikenal/
  portal 400, diri sendiri 422, Super Admin terakhir 422, admin biasa 403); audit events & sessions (gate, bentuk, urutan);
  seed tidak menimpa status yang diubah API.
- Frontend: tes `users-sync`, `audit-sync`, guard, `pnpm test`, vue-tsc ≤ 1983, eslint vs HEAD, `pnpm build`.

## Deploy

Migrasi `0034` otomatis. Setelah push: `bun run db:seed:demo` sekali.
