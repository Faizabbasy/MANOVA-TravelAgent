# Portal client — aksi tulis pada tabel yang sudah ada (S12b-1) — desain

Tanggal: 19 Oktober 2026 · Branch: `production` · Status: diimplementasikan (plan 2026-10-19-client-portal-writes)

Lanjutan S12a/S12a-2. Aksi tulis portal client untuk **peserta, dokumen & pesan, profil & kontak, dan sengketa
invoice** dipindah dari mutasi array lokal ke server, lewat endpoint khusus client. Change request (status alur portal)
dan respons quotation (terima/tolak/revisi) menyusul di **S12b-2**; entitas khusus portal (travel request, approval,
versi itinerary, support, feedback, bukti bayar, perubahan profil sensitif, katalog) di **S12c**.

## Keputusan pengguna

1. Lingkup S12b-1 = peserta + dokumen & pesan + profil & kontak + sengketa invoice; CR & respons quotation = S12b-2.
2. Perubahan peserta dari client **langsung berlaku, dengan batas status**: hanya selama project belum berangkat
   (status bukan `ongoing-trip`, `completed`, `cancelled`); setelah itu lewat change request. Verifikasi dokumen
   peserta & VIP tetap hak staf. Staf mendapat log aktivitas + notifikasi.

## Masalah yang ditutup

Portal client masih memutasi array lokal untuk aksi-aksi ini (ID `TRV-`/`ROOM-` lokal, `DOC-L`, `MSG-L`, `CP-` lokal,
sengketa hanya di memori). Endpoint internal menolak client (capability internal) dan menerima field yang hanya boleh
diisi staf.

## Keputusan desain

| Topik | Keputusan |
|---|---|
| Bentuk | Endpoint baru di bawah `/api/v1/client/*`, hanya role client (`clientParty()` seperti S12a-2: role lain 403, party dari sesi, tidak pernah dari request). Logika tulis memakai fungsi internal yang ada (travelers, documents, party-writes, receivables); field dibatasi whitelist sebelum diteruskan. Create memakai `Idempotency-Key` seperti endpoint internal. Respons = view client (`clientTraveler`, `clientDocument`, `clientMessage`, view invoice S12a-2) |
| Kepemilikan | Project harus `party_id` = party client (404 bila bukan miliknya — tidak membocorkan keberadaan). Traveler/kamar/dokumen/kontak/invoice dicek lewat project/party pemiliknya |
| Batas status peserta | Tulis peserta & kamar ditolak 422 "Project sudah berjalan/selesai/dibatalkan — ajukan perubahan lewat change request." bila status project `ongoing-trip`, `completed`, atau `cancelled` |
| Peserta | `POST /client/projects/:id/travelers`, `PATCH /client/travelers/:id`, `POST /client/travelers/:id/cancel` (alasan wajib), `POST /client/travelers/:id/replace`, `POST /client/projects/:id/travelers/import`, `POST /client/projects/:id/room-assignments`, `PUT /client/room-assignments/:id/travelers`. Field profil = whitelist profil traveler yang ada (nama, grup, paspor, ID, visa, kontak darurat, permintaan khusus, diet, aksesibilitas, pendamping); field staf (`isVip`, verifikasi dokumen, pembatalan, link order) ditolak 400 seperti edit internal. Hapus traveler, hapus kamar, grup & VIP tidak dibuka untuk client |
| Dokumen | `POST /client/documents` (metadata saja, seperti S9): `entityType` project (project milik party), traveler (traveler di project milik party; `projectId` diisi dari traveler) atau party (party sendiri; dokumen perusahaan). `accessLevel` selalu `client`, `verified` false, `uploadedBy` = user client. `POST /client/documents/:id/replace`: dokumen lama harus terlihat oleh client, `source_type` uploaded, belum digantikan; versi baru = versi lama + 1, `supersedes_id` = lama, entitas sama |
| Pesan | `POST /client/messages`: `projectId` milik party, kanal selalu `client-message`, tanpa mention (ditolak bila dikirim), isi ≤ 4000, lampiran nama file opsional. `POST /client/projects/:id/messages/read`: user client ditambahkan ke `read_by` pesan `client-message` project itu |
| Profil | `PATCH /client/profile`: field yang boleh = industri, ukuran, alamat, kota, provinsi, negara, kode pos, telepon, website, email, jenis perusahaan, wajib PO, preferensi perjalanan. Field sensitif (nama, NPWP, no. registrasi, nama & alamat billing, termin bayar, AE) ditolak 422 "Perubahan data registrasi/pajak/billing diajukan lewat verifikasi." (alur verifikasi = S12c). Dicatat sebagai aktivitas party "Company Profile diperbarui oleh Client." |
| Kontak | `POST /client/contacts`, `PATCH /client/contacts/:id`, `DELETE /client/contacts/:id` — kontak party sendiri; validasi sama dengan create internal (nama & jabatan wajib, email valid). Fungsi `updateContact`/`deleteContact` baru di party-writes (audit `party.contact_updated`/`party.contact_deleted`) |
| Sengketa | `POST /client/invoices/:id/dispute` `{reason}`: invoice issued milik party client (cakupan S12a-2), belum lunas, belum disengketakan; memakai `setInvoiceDispute` (audit `finance.invoice_disputed`). Penyelesaian tetap Finance. Respons = view invoice client |
| Log & notifikasi | Dalam transaksi yang sama: aktivitas project (`recordProjectActivity`) untuk perubahan peserta, kamar, dokumen project/traveler dan pesan — teks menyebut client; notifikasi ke owner project (`projects.owner_user_id`, bila ada) untuk peserta/kamar (`change`), dokumen (`document`), pesan (`message`); ke account owner party untuk profil, kontak & dokumen perusahaan; ke semua user Finance aktif untuk sengketa. Pengirim tidak pernah menerima notifikasinya sendiri |
| Frontend | `data/client-portal-writes.ts`: pemanggil endpoint client + upsert hasil ke array lokal memakai mapper yang ada. Komponen portal (peserta, kamar, dokumen, pesan, profil, kontak, sengketa) menjadi server-first dengan `createSaveGate`: gagal = tidak ada perubahan lokal + toast alasan. Tombol VIP disembunyikan di portal. Log/notifikasi lokal (`ACT-L`/`NOT-L`) untuk aksi ini tidak lagi dibuat. Mock verifikasi (bukti bayar, profil sensitif) dan entitas S12c tetap lokal |

## Testing

- Backend `test/client-portal-writes.test.ts`: tiap endpoint — sukses untuk milik party client; project/traveler/
  kamar/dokumen/kontak/invoice party lain 404; status project terkunci 422; field staf/sensitif ditolak; role lain
  (admin, finance, vendor) 403, tanpa sesi 401; aktivitas project & notifikasi owner/Finance terbentuk; dokumen selalu
  `client` & belum terverifikasi; replace menaikkan versi dan menolak dokumen generated/sudah digantikan; pesan tanpa
  mention; read menandai hanya pesan `client-message` project itu.
- Frontend: tes `client-portal-writes` (upsert hasil server, error tidak mengubah array), guard `-L` untuk aksi yang
  dipindah, `pnpm test`, vue-tsc ≤ 1983, eslint vs HEAD, build.

## Deploy

Tanpa migrasi.
