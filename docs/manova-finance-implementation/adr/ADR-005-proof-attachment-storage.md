# ADR-005 — Penyimpanan bukti transaksi (proof/attachment)

- **Status:** Proposed — diputuskan final di awal Phase 2 (belum ada kode di Phase 1)
- **Konteks:** Receipt, disbursement, transfer, dan settlement (Phase 2–5) membawa bukti. Paket `05`/`09`: upload lewat endpoint terpisah dengan cek tipe/ukuran/kepemilikan, mengembalikan `attachmentId`, bukan path; file tidak boleh di `public/`; akses lewat otorisasi; hash tersimpan; nominal tidak pernah dibaca dari file. Hosting target belum diketahui.

## Usulan

1. Tabel `attachments(id, owner_scope, sha256, mime, size_bytes, original_name, storage_key, uploaded_by, uploaded_at)` — append-only; entitas finance merujuk `attachment_id`.
2. Antarmuka `BlobStore { put, get, delete? }` dengan dua implementasi: **direktori privat lokal** di luar web root (`backend/.data/blobs`, dev) dan **object storage S3-compatible** (produksi; provider mengikuti hosting). `storage_key` acak, bukan nama file pengguna.
3. Validasi: allowlist MIME yang diverifikasi dari magic bytes (PDF, JPEG, PNG, WebP), batas ukuran (usulan 10 MB), nama file disanitasi, tidak mengeksekusi/merender konten.
4. Download hanya melalui endpoint API yang mengecek scope aktor terhadap entitas pemilik, dengan `Content-Disposition: attachment` dan `X-Content-Type-Options: nosniff`; atau signed URL pendek bila memakai object storage.
5. Scan malware bila platform menyediakan; bila tidak, file tetap diisolasi dan tidak pernah dilayani inline.

## Yang perlu diputuskan

Provider object storage produksi, batas ukuran final, dan retensi. Backup DB (ADR-002) tidak mencakup blob; kebijakan backup blob diputuskan bersama provider.
