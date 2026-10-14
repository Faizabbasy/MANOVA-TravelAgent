# Portal client — quotation, reservasi & tagihan dari server (S12a-2) — desain

Tanggal: 14 Oktober 2026 · Branch: `production` · Status: diimplementasikan (plan 2026-10-14-client-portal-commercial)

Lanjutan S12a. Portal client membaca **quotation, reservasi (booking) dan tagihan** dari server lewat endpoint khusus
client dengan DTO whitelist, dan kebocoran field internal dari route S12a ditutup.

## Keputusan pengguna

1. **Reservasi tanpa harga** — angka untuk client hanya lewat quotation yang dikirim dan invoice (ADR-007: DTO portal
   tanpa uang).
2. **Penalti pembatalan dan dampak biaya change request terlihat** oleh client (memang ditagihkan); catatan finansial
   internal dan ID staf disembunyikan.

## Masalah yang ditutup

1. Quotation, reservasi dan tagihan di portal client masih data lokal; `/quotations`, `/leads`, `/bookings` dan route
   Finance menolak client.
2. Daftar quotation lokal menampilkan draft/submitted yang belum dikirim ke client.
3. Route S12a mengirim ID staf yang tidak ditampilkan (`uploadedBy`, `verifiedBy`, `documentsVerifiedBy`,
   `cancelledBy`, `mentions`, `readBy`) dan `financialImpactNote` change request.

## Keputusan desain

| Topik | Keputusan |
|---|---|
| Bentuk | Endpoint baru `GET /client/quotations`, `GET /client/reservations`, `GET /client/invoices` (+ detail `/client/invoices/:id`) — hanya role client; internal & vendor 403. DTO dibangun dari whitelist, bukan dengan menghapus field dari DTO internal |
| Quotation | Lead milik party client, quotation dengan `sentToClientOn` terisi (sudah disetujui & dikirim; revisi yang belum dikirim ulang tidak tampil). Field: id, versi, tanggal, total, diskon, pajak, mata uang, rincian layanan, syarat bayar, berlaku sampai, S&K, inklusi/eksklusi, kebijakan batal, catatan itinerary, total versi sebelumnya, `accepted` (lead sudah jadi project), ringkasan lead (judul, perusahaan, nama, tujuan, tanggal, estimasi peserta, lingkup), nama penyusun. **Tidak**: markup, estimasi biaya/margin, cost sheet, catatan/aktor approval |
| Reservasi | Booking di project milik party client. Field inti: tipe, id, project, status + status untuk client (Diproses/Dikonfirmasi/Selesai/Dibatalkan), referensi (PNR/konfirmasi), tanggal berangkat, tenggat, peserta, label; `details` whitelist per tipe (flight: segmen, tenggat tiket, maskapai, kelas; hotel: properti, tipe kamar, meal plan, check-in/out, jumlah kamar, voucher, tenggat batal; transport: jenis, leg, kendaraan, plat, sopir; MICE: venue, alamat, sesi, kategori peserta, deliverable, status persetujuan client). **Tidak**: harga jual/net, vendor, harga opsi, BOQ biaya, catatan internal, PIC/staf, gate pembayaran, jejak percobaan, duplikat |
| Tagihan | Invoice dengan `party_id` = party client (bukan party project — invoice peserta Group Trip), status issued/void (draft tidak). Field: id, nomor, project, tipe, status, settlement, overdue, mata uang, total, dibayar, dikreditkan, sisa, tanggal terbit/jatuh tempo, sengketa, alasan void, baris, snapshot tagihan; pembayaran (nominal, tanggal, referensi; yang di-reverse tidak); credit note (id, nominal, alasan, status, tanggal); ringkasan (total ditagih, dibayar, sisa, jatuh tempo terdekat). **Tidak**: perkiraan tagih internal, catatan internal, rekening & ID transaksi, efek/refund credit note, ID staf |
| Pembersihan S12a | Untuk client: dokumen tanpa `uploadedBy`/`verifiedBy`; traveler tanpa `documentsVerifiedBy`; pembatalan tanpa `cancelledBy` (penalti tetap); pesan tanpa `mentions`/`readBy` (pengirim tetap, ditampilkan sebagai nama); change request tanpa `financialImpactNote` (dampak komersial tetap) |
| Frontend | `data/client-commerce-sync.ts` memuat ketiga endpoint untuk role client dan mengisi data yang dibaca panel portal (quotation & lead, reservasi, invoice/pembayaran/credit note); panel portal memakai data itu. Aksi portal (setujui/tolak quotation, bukti bayar, sengketa) tetap lokal (S12b/S12c) |

## Testing

- Backend `test/client-commerce.test.ts`: tiap endpoint hanya data party client; quotation draft/submitted/belum
  dikirim tidak muncul; field internal tidak ada (dicek per kunci); reservasi tanpa uang/vendor; invoice draft & party
  lain tidak muncul, invoice peserta Group Trip ikut party yang ditagih; internal & vendor 403. Pembersihan S12a.
- Frontend: tes mapper client (quotation, reservasi, invoice), `pnpm test`, vue-tsc ≤ 1983, eslint vs HEAD, build.

## Deploy

Tanpa migrasi.
