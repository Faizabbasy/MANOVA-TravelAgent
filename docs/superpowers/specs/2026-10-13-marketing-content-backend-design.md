# Backend konten marketing (S11b) — desain

Tanggal: 13 Oktober 2026 · Branch: `production` · Status: disetujui (opsi rekomendasi, eksekusi native)

Bagian kedua S11. Tab **Jadwal Konten** dan **Pengembangan Konten** di halaman Marketing pindah ke server. Campaign,
promo, funnel, CAC, LTV dan ROI tetap seperti sekarang (laporan turunan dari lead/quotation/project, campaign & promo
masih mock); HR menyusul di S11c.

## Masalah yang ditutup

1. Jadwal konten dan pipeline pengembangan konten hanya ada di memori browser.
2. Halaman tidak membatasi siapa yang mengubah status: Finance (Marketing VIEW) bisa mengubah status jadwal/tahap konten.
3. UI tidak punya cara menambah jadwal atau ide konten baru.

## Keputusan

| Topik | Keputusan |
|---|---|
| Hak tulis | Capability baru `marketing.manage-content` (Admin + Super Admin), ditambahkan di matriks server, matriks frontend dan katalog capability |
| Hak baca | Semua peran internal; portal 403 |
| Jadwal konten | `CTS-…`: tanggal tayang, platform (`instagram`/`tiktok`/`website`/`email`/`youtube`/`linkedin`), judul, status (`draft`/`scheduled`/`published`), `campaignId` opsional (teks bebas, campaign masih mock), catatan |
| Pengembangan konten | `CTD-…`: judul, tahap (`idea`/`draft`/`review`/`ready`), platform, PIC opsional (user internal aktif), catatan; `updatedOn` diisi server tiap perubahan |
| Ubah | `PATCH` field yang dikirim; validasi sama dengan buat |
| Audit | `content.scheduled/updated`, `content_idea.created/updated` |
| Seed | Dari fixture; seed ulang tidak menimpa baris yang diubah API |
| UI | Dialog **Tambah Jadwal** dan **Tambah Ide Konten**; select status/tahap hanya aktif untuk pemegang capability |

## Backend

- Migrasi `0037_marketing_content`: `content_schedule`, `content_development`.
- `core/marketing.ts` + `core/marketing-routes.ts`: `GET/POST /content-schedule`, `PATCH /content-schedule/:id`,
  `GET/POST /content-development`, `PATCH /content-development/:id`.

## Frontend

- Types/endpoints; `data/marketing-sync.ts` (muat ke `CONTENT_SCHEDULE`/`CONTENT_DEVELOPMENT`, aksi server-first).
- Halaman Marketing: dua dialog baru, select dikunci tanpa capability; layout & reset Settings memuat konten.
- Guard melarang `createContentScheduleItem(`, `updateContentScheduleStatus(`, `createContentDevelopmentItem(`,
  `updateContentDevelopmentStage(`.

## Testing

- Backend `test/marketing.test.ts`: baca (internal/portal/401); buat & ubah (validasi, finance 403, Idempotency-Key, PIC
  portal ditolak), audit; seed tidak menimpa perubahan API.
- Frontend: tes `marketing-sync`, guard, `pnpm test`, vue-tsc ≤ 1983, eslint vs HEAD, `pnpm build`.

## Deploy

Migrasi `0037` otomatis. Setelah push: `bun run db:seed:demo` sekali.
