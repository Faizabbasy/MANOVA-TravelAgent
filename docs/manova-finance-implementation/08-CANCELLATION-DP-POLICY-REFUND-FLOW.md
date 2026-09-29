# Cancellation / DP Policy / Credit Note / Refund / Settlement

`frontend/app/data/master-data.ts` memiliki `CANCELLATION_RULES` display-only; `app/data/index.ts` memiliki `createCancellationRecord`, `createRefundRequest`, dan hook `updateRefundRequestStatus → issueCreditNote`. Keduanya adalah **peta migrasi**, bukan flow final. Finance UI mock lama boleh dibuang. Booking lifecycle asli berada di `app/data/index.ts` (`updateFlightBookingStatus`, `updateHotelBookingStatus`, `updateTransportBookingStatus`, MICE status) dan halaman detail masing-masing; integrasi cancel perlu tetap menghormati transisi domain.

## Master policy

Policy punya code/name, description, status draft/published/inactive, scope (`bookingType`, B2B/B2C/segment bila tersedia), effectiveFrom/To, calculationBasis default `paid_customer_deposit`, version, dan beberapa tier. Tier interval contoh: H≥30 refund 100%, 14≤H<30 refund 50%, 7≤H<14 refund 30%, 1≤H<7 refund 0%; H<1/after departure wajib aturan eksplisit. Tiap tier menyimpan lower/upper bound hari atau canonical ordering, `forfeitPercent`, `refundPercent`, optional cap. Validasi 0–100 dan jumlah keduanya 100 untuk basis yang sama; gap/overlap ditolak. Hitung H dari tanggal berangkat booking dalam zona Asia/Jakarta, tanggal cancel efektif, dan aturan inklusif boundary; uji H-30, H-14, H-7, H-1, H0.

Saat booking menyimpan policy, simpan `policyId`, `version`, serta snapshot tier/basis/effective date. Kebijakan terbit tidak boleh diedit in place; buat versi baru. Scope tidak cocok atau tanggal tidak aktif menghasilkan error yang bisa dimengerti; UI menawarkan policy yang valid saja. Jangan backfill policy mock ke booking lama secara otomatis tanpa rekonsiliasi.

## Perhitungan dan contoh

Basis default = total **deposit customer yang benar-benar posted** dan dialokasikan ke booking, dikurangi refund sebelumnya. Jika DP dijanjikan Rp30 juta tetapi baru diterima Rp20 juta, basis maksimal Rp20 juta. Pada H-7, hangus 70% dan refund 30%: retained Rp14 juta, refundable Rp6 juta. Bila ada beberapa payment, preview menampilkan allocation per payment ID. Nilai refund tidak boleh melebihi kas yang diterima dikurangi refund/chargeback sebelumnya. Pembulatan: hitung total refund menurut aturan integer IDR, lalu retained = basis − refund agar selisih nol.

## Alur state yang harus atomik

1. User pilih **Batalkan booking** → preview tanpa side effect: policy version, tier, basis DP posted, retained, refundable, source payment, kemungkinan vendor penalty terpisah.
2. Konfirmasi reason → cancellation case dibuat sekali; status booking ditransisikan via service booking resmi; snapshot tersimpan. Jika gagal, rollback konsisten atau case diberi state yang dapat ditindaklanjuti; jangan frontend melakukan dua mutasi terpisah yang bisa separuh berhasil.
3. Jika refundable > 0, buat credit note/refund obligation yang menunjuk original payment, invoice terkait, booking/project, reason, policy snapshot. Bedakan credit yang mengurangi AR belum dibayar dari uang yang harus dikembalikan karena sudah diterima. Satu credit note tidak boleh mengurangi AR dan sekaligus mengakui seluruh refund kas dengan efek ganda.
4. Review/approve sesuai RBAC. Approved **belum** berarti uang keluar. Finance pilih rekening, penerima, proof/reference, nominal parsial/penuh → settlement posted; buat movement actual out dan allocation refund dalam satu DB transaction. Booking history, statement, ledger, dashboard, dan cashflow berubah dari sumber yang sama.
5. Reversal settlement dengan alasan dan audit; refund obligation kembali terbuka sesuai reversal. Jangan menghapus riwayat.

## Vendor side dan pengecualian

Vendor penalty/deposit refund adalah kewajiban/receivable berbeda dari refund customer; jangan meng-netting diam-diam. Jika vendor mengembalikan deposit, catat receipt tersendiri. Jika customer sudah membayar lebih dari DP, policy basis `paid deposit` tetap diterapkan hanya pada deposit; saldo lain diselesaikan sesuai terms yang di-snapshot atau melalui pengecualian dengan approval. Jika booking tidak punya departure date/policy, blok hanya aksi **hitung otomatis refund**, tampilkan penyebab dan jalur eskalasi/manual terotorisasi; jangan hentikan operasional project.

## Acceptance kasus

H-7, DP posted Rp20 juta, policy 70/30 → refund obligation Rp6 juta; sebelum settlement statement belum punya uang keluar; setelah settlement Rp6 juta dari BANK-01, saldo turun Rp6 juta, refund outstanding nol; request ulang dengan idempotency key tidak menggandakan credit/movement. Edit policy ke versi 2 tidak mengubah hasil case lama.
