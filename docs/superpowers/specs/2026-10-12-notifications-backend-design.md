# Backend notifikasi (S9b) — desain

Tanggal: 12 Oktober 2026 · Branch: `production` · Status: disetujui (opsi rekomendasi, eksekusi native)

S9b memindahkan notifikasi internal (`NOTIFICATION_RECORDS`) ke server: server membuat notifikasi di transaksi aksinya,
dan setiap user membaca, menandai dibaca, dan menghapus notifikasinya sendiri.

## Keputusan

| Topik | Keputusan |
|---|---|
| Pemicu server | Mention di pesan (S9), penugasan task saat dibuat / PIC berganti (S7c), eskalasi insiden ke user (S8) — dalam transaksi yang sama |
| Mention | Hanya user internal (bukan role client/vendor) — menutup minor S9 |
| Akses | Setiap user hanya melihat & mengubah notifikasinya sendiri (`user_id = aktor`); milik orang lain → 404 |
| Hapus | Hapus permanen milik sendiri (sama dengan perilaku layar) |
| Tetap lokal | Notifikasi yang dipicu portal client (travel request, approval, pembayaran, tiket, feedback …) — prefix `NOT-L…`, sinkron mempertahankannya |
| Pembaruan | Layout memuat saat masuk; panel lonceng memuat ulang saat dibuka |

## Backend

- Migrasi `0033_notifications`: `notifications` — `id` (`NOT-`), `user_id` FK users, `type` ∈ mention/assignment/reminder/
  escalation/change/incident/document/message, `title`, `body`, `entity_type`, `entity_id`, `category`, `read boolean`,
  `provenance`, `created_at`; index `(user_id, created_at)`. `id_sequences`: `NOT-`.
- `notify(tx, { userId, type, title, body, entityType?, entityId? })` dipanggil dari `sendMessage` (per mention, kecuali
  pengirim sendiri), `createTask`/`updateTask` (PIC baru, kecuali aktor sendiri), `escalateIncident` (target).
- Endpoint: `GET /notifications` (milik aktor, terbaru dulu), `POST /notifications/:id/read`, `POST /notifications/read-all`,
  `DELETE /notifications/:id`. Semua user yang login (termasuk portal — hanya miliknya sendiri).
- Seed: 17 notifikasi fixture (`NOT-001…017`).

## Frontend

- `data/notifications-sync.ts`: muat notifikasi user yang login ke `NOTIFICATION_RECORDS` (baris `NOT-L…` dipertahankan),
  `markNotificationReadOnServer`, `markAllNotificationsReadOnServer`, `removeNotificationOnServer`; layout & reset settings;
  panel lonceng memuat ulang saat dibuka.
- `NotificationPanel` dan tab Notifikasi `/documents` memakai server. `pushNotification` lokal untuk mention/penugasan/
  eskalasi dihapus (server yang membuat); `pushNotification` lokal tersisa untuk portal memakai prefix `NOT-L`.
- Guard melarang `markNotificationRead(`, `markAllNotificationsRead(`, `removeNotification(`, `pushNotification(` di layar.

## Testing

- Backend (`test/notifications.test.ts`): mention → notifikasi untuk yang di-mention (bukan pengirim), mention user portal
  400; task dibuat/PIC berganti → notifikasi; eskalasi → notifikasi; baca/baca-semua/hapus hanya milik sendiri (orang lain 404);
  401; seed.
- Frontend: tes `notifications-sync`, guard, `pnpm test`, vue-tsc ≤ 1983, eslint vs HEAD, `pnpm build`.

## Deploy

Migrasi `0033` otomatis. Setelah push: `bun run db:seed:demo` sekali.
