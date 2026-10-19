# Portal client — change request & respons quotation di server (S12b-2) — desain

Tanggal: 19 Oktober 2026 · Branch: `production` · Status: diimplementasikan (plan 2026-10-19-client-change-requests-quotation-response)

Lanjutan S12b-1. Change request dari client dan respons client atas quotation (setuju / tolak / minta revisi) pindah dari
mock lokal ke server. Draft, komentar dan lampiran CR tetap lokal (S12c).

## Keputusan pengguna

1. **Alur CR disederhanakan**: `submitted` → `under-review` → (staf mengisi dampak lalu mengirim ke client)
   `waiting-client-approval` → `approved` (dieksekusi) → `implemented`. Client boleh menolak dampak (`rejected`) atau
   membatalkan (`cancelled`) selama belum disetujui. "Tidak bisa dilaksanakan" = ditolak staf dengan alasan. Cek
   ketersediaan & costing digabung ke `under-review`.
2. **Persetujuan client hanya bila ada biaya**: CR dari client dengan dampak komersial atau biaya pembatalan > 0 harus
   dikirim ke client dan disetujui client; tanpa biaya staf boleh langsung menyetujui. CR internal tidak butuh client.
3. **Respons quotation dicatat + staf diberi tahu**; Won / pembuatan project tetap oleh staf (tidak diblokir). Minta
   revisi = staf diberi tahu lalu merevisi lewat alur internal (tanpa revisi otomatis).

## Masalah yang ditutup

- CR client hanya lokal (`CR-L`), langkah review/costing/persetujuan disimulasikan mock instan dengan biaya karangan;
  server tidak punya status menunggu client, batal, tipe perubahan, biaya pembatalan, maupun jejak keputusan client.
- Setuju/tolak/minta revisi quotation hanya catatan lokal; tampilan tidak berubah; "minta revisi" membuat & menyetujui
  versi baru otomatis.

## Keputusan desain

| Topik | Keputusan |
|---|---|
| Skema (migrasi 0039) | `change_requests.status` + `waiting-client-approval`, `cancelled`; kolom `change_type` (13 tipe portal, nullable), `cancellation_fee_minor` (≥ 0), `client_decided_by`, `client_decided_at`, `cancel_reason`, `cancelled_by`, `cancelled_at` (cek: `cancelled` wajib alasan). `quotations` + `client_response` (`accepted`/`rejected`/`revision-requested`), `client_response_note`, `client_response_version`, `client_responded_by`, `client_responded_at` |
| Staf — kirim dampak | `POST /change-requests/:id/send-to-client` (`project-order.review-change`): dari `submitted`/`under-review`, isi `commercialImpactMinor`, `cancellationFeeMinor`, `timelineImpactNote`, `operationalImpact`, `financialImpactNote`; minimal satu biaya > 0 (tanpa biaya → setujui langsung); hanya CR `source = client`. Status → `waiting-client-approval`; notifikasi ke requester (client) |
| Staf — setujui | `approve` menolak (422) CR client yang dampak/biaya pembatalannya > 0 — harus lewat client. `reject` tetap (alasan wajib; dipakai juga untuk "tidak bisa dilaksanakan"); requester client diberi notifikasi |
| Client — ajukan | `POST /client/projects/:id/change-requests` (Idempotency-Key): `changeType` (opsional), `beforeSummary`, `afterSummary`; kategori CHG dari tipe; `source = client`; project milik party dan bukan `completed`/`cancelled`; notifikasi owner project |
| Client — putuskan | `POST /client/change-requests/:id/approve` (`waiting-client-approval` → `approved`, `client_decided_*`, entri CHG disetujui), `/reject` (alasan wajib → `rejected`, `client_decided_*`, CHG ditolak), `/cancel` (alasan wajib; dari `submitted`/`under-review`/`waiting-client-approval` → `cancelled`, CHG ditolak). Hanya CR project party client; owner project diberi notifikasi |
| Gerbang S8 | Project → `completed` ditolak selama ada CR `submitted`/`under-review`/`waiting-client-approval` |
| Respons quotation | `POST /client/quotations/:id/respond` `{ response, note }`: quotation sudah dikirim ke party client, belum jadi project; satu respons per versi (versi baru membuka respons lagi); `rejected` & `revision-requested` wajib catatan. Catatan aktivitas party + notifikasi ke handled-by / owner lead. Respons hanya berlaku untuk versi yang sedang berjalan (`client_response_version = current_version`) |
| Tampilan | DTO CR + `changeType`, `cancellationFeeMinor`, `clientDecidedBy/At`, `cancelReason`, `cancelledAt`; DTO quotation internal & `/client/quotations` + `clientResponse` `{ response, note, version, respondedAt }` (null bila belum / versi lama) |
| Frontend | Portal: daftar & form CR, dialog cepat, detail CR (setujui/tolak dampak, batalkan; tampil dampak komersial & biaya batal) lewat server; mock review dihapus. Halaman CR internal: aksi "Kirim dampak ke client" + peta transisi baru. Halaman quotation client: tombol lewat server, status respons tampil, tombol hilang setelah merespons versi itu. Quotation internal menampilkan respons client |

## Testing

- Backend: migrasi naik/turun; alur penuh client→staf→client; approve langsung ditolak bila ada biaya; send-to-client
  tanpa biaya 400/422; client menyetujui/menolak/membatalkan hanya di status yang benar & hanya CR party-nya; gerbang
  completed; respons quotation (sekali per versi, revisi membuka lagi, sebelum dikirim/sudah Won/party lain ditolak,
  catatan wajib); notifikasi; client lain/role lain 403/404.
- Frontend: mapper & sync CR/quotation, guard mutator lokal, `pnpm test`, vue-tsc ≤ 1987, eslint vs HEAD, build.

## Deploy

Migrasi 0039 (tambah kolom & perluas CHECK; aman untuk data lama).
