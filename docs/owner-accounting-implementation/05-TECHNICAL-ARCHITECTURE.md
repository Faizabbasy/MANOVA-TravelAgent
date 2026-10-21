# Arsitektur teknis dan kontrak integrasi

## Pendekatan implementasi

Tambahkan bounded module accounting di monorepo existing, misalnya `backend/src/modules/accounting/`. Nama tabel dan service di bawah adalah rancangan, bukan file yang sudah ada. Jangan membuat backend kedua, financial_transactions tandingan, atau financial state yang authoritative di browser.

Domain sumber tetap memiliki transaksi operasional dan cash. Accounting memiliki journal dan balances turunannya. Orkestrasi dipanggil dari service bisnis, bukan watcher Vue atau handler frontend setelah request sukses. Gunakan `Queryable` transaksi yang sama agar source, audit, business event dan jurnal committed bersama.

## Struktur data minimum

Rancang migrasi bertahap dan dokumentasikan ERD atau relasi tekstual. Sesuaikan dengan schema yang sudah tersedia.

| Entitas usulan | Isi dan constraint |
|---|---|
| Accounting profile/book | Entitas, functional currency, timezone, cutover, mode aktivasi, policy version, periode fiskal |
| Accounting accounts | Code unik per book, type, control role, normal balance, active/effective dates, izin posting |
| Accounting periods | Rentang tidak overlap, open/reviewed/closed, lock version, actor dan alasan reopen |
| Accounting policies | Jenis sumber/layanan, principal/agent, recognition, tax mapping, commission/depreciation; versioned effective dates |
| Obligations dan fulfillments | Komponen kontrak, nilai alokasi, delivery evidence, total terpenuhi/diakui dan tanggal; mendukung partial |
| Business financial events | ID unik, source type/id/version, event kind, occurredAt/effectiveDate, snapshot, actor, requestId, policyVersion |
| Journal entries dan lines | Book, event, nomor, tanggal, currency, status, reversal/correction link, account, debit/credit, project/order, party/vendor/employee/bank dan references |
| Posting registry | Unique event dan posting purpose; status pending/posted/rejected, failure reason, retry metadata |
| Cost commitments/accruals | SO/booking/component, nilai total/consumed/cancelled, dates, supplier, fulfillment dan invoice matching |
| Bank import dan statement lines | Account, source/file hash, external identity, original raw row, decimal amount, dates, import actor |
| Reconciliation matches | Many-to-many statement line ke cash transactions, matched amounts, fees/splits, reversal/unmatch history |
| Employee advances/settlements | Pemegang kas, sumber pembayaran, bukti, alokasi cost, sisa dan settlement |
| Expense dan recurring schedules | Kejadian/kewajiban rutin, periode beban, due/payment dates, project opsional; satu sumber dengan cash/payroll terkait |
| Asset accounting | Link acquisition/inventory, capitalization, in-service date, useful life/method, depreciation per periode, disposal |
| Loans dan owner funds | Counterparty, principal, interest schedule, settlement refs, entity treatment |
| Tax documents/positions | Profil/rule version, basis, amount, period, external document identity, proof dan settlement; bukan duplikasi invoice |
| Accounting review dan exceptions | Project/order/period, outstanding reasons, owner, resolution, evidence, completion and lock version |

Tidak semua tabel harus dibuat sekaligus. Reuse entitas lama bila semantiknya benar. Hindari tabel generik JSON tanpa constraint untuk ledger, alokasi uang, atau status finansial kritis.

## Invariant database dan transaksi

1. Posted entry memiliki minimal dua lines, total debit = kredit, nilai non-negatif dan satu sisi per line. Nol/entry kosong tidak diposting.
2. Posted header/lines tidak diedit atau dihapus; correction membuat entry baru. Draft dapat diedit dengan version check.
3. Tidak ada source yang dihitung dua kali meskipun memakai Idempotency-Key berbeda. Gunakan business event identity dan unique registry per book/purpose.
4. Partial fulfillment mempunyai event ID sendiri serta batas kumulatif obligation; jangan membuat unique constraint yang melarang partial yang sah.
5. Validasi tanggal/period lock dalam transaksi yang sama dengan posting. Race posting versus close/reopen diuji.
6. Ledger bank control cocok dengan cash book existing untuk batas cutover dan period yang sama. AR/AP serta control account lain cocok dengan sumbernya.
7. Currency, source ownership, project/order/component dan counterparty konsisten; referensi silang customer/project/vendor lain ditolak.
8. Rule balancing diterapkan saat transisi ke posted, bukan saat menambahkan satu line draft. Gunakan DB guard yang kompatibel PostgreSQL/PGlite dan tes akses langsung SQL.
9. API amount string; backend pakai bigint/decimal exact. Kurs memakai decimal/rational exact, rounding terpusat, rounding account eksplisit dan bounded.
10. Snapshot ekonomi event dan policy frozen; replay tidak memakai nominal terbaru dari record yang sudah direvisi.

## Posting service dan kegagalan

Contoh antarmuka internal: `postBusinessEvent(tx, event)` memvalidasi profile, posting registry, policy, period, source links dan lines lalu menulis journal/audit. Ini bukan API bebas untuk browser mengirim debit/kredit.

Saat accounting aktif untuk transaksi bersangkutan, kegagalan mandatory posting menggagalkan perubahan sumber yang sama. Jangan membuat uang sukses berubah tetapi ledger silently tertinggal. Preflight informasi policy yang wajib dan tampilkan action yang bisa diselesaikan owner.

Untuk pengembangan/cutover, gunakan mode off/shadow/active yang eksplisit. Shadow hanya di book/rehearsal terisolasi atau read model yang tidak diklaim sebagai buku aktif; jangan mengisi GL produksi dari event yang belum tervalidasi. Migrasi schema tidak otomatis mengaktifkan accounting.

Jika perlu pemrosesan background, gunakan transactional outbox/registry database dan worker sederhana yang tahan retry. Tidak perlu Kafka/Redis hanya untuk ini. Event berulang payroll, depreciation, accrual, recurring invoice dan reminder memanggil service domain yang sama dengan unique schedule occurrence. Jangan menjadikan outbox eventual yang gagal sebagai laporan keuangan lengkap. Deskripsikan apakah tiap event wajib synchronous atau pending dan bagaimana completeness membaca pending tersebut.

## Kontrak API

Pertahankan endpoint source existing; perluas response kompatibel atau versioned untuk accounting reference/status. Update seluruh consumer dalam perubahan yang sama. Endpoint baru ditempatkan pada namespace yang jelas, misalnya `/api/v1/accounting/...`, dengan existing envelope dan capability server.

Auth dan izin akses diperiksa sebelum validasi body yang bisa membocorkan kontrak. Namespace accounting baru memerlukan guard yang setara dengan Finance existing; jangan menganggap finance path guard otomatis mencakup namespace lain. Actor, owner dan scope berasal dari sesi server, bukan field otoritas dalam request body. Pertahankan CSRF/origin checks, cookie security dan audit export.

Kebutuhan read: owner overview, project/order financial facts, event journal trail, accounts/GL/trial balance, P&L/BS/actual cash flow, forecasts, exceptions, periods, bank reconciliation dan setup status. Semua list/filter totals server-side, pagination stabil dan satu definisi per laporan.

Kebutuhan command: setup/mapping, opening preview/confirm, source allocation/correction, reconciliation import/preview/match/unmatch, period review/close/reopen, exception resolution, controlled manual adjustment. Command finansial memakai Idempotency-Key dan conflict/version checks sesuai pola repo.

Read model minimum membawa `asOf`, timezone, currency, period, `available`, `completeness`, `reasons`, `policyVersion` dan `basis`. Field uang nullable bila unavailable, bukan angka nol. Contoh konseptual:

```json
{
  "data": {
    "period": "2026-10",
    "currency": "IDR",
    "basis": "recognized",
    "available": true,
    "profitBeforeTaxMinor": "15000000",
    "netProfitMinor": null,
    "completeness": "provisional",
    "reasons": [{"code":"TAX_PROFILE_INCOMPLETE","action":"Lengkapi profil pajak"}]
  },
  "meta": {"requestId":"example"}
}
```

Jangan expose gaji, bank number penuh, tax ID, vendor net cost atau journal sensitif ke role/client yang tidak berwenang. Angka aggregate, export, autocomplete dan PDF termasuk boundary akses.

## Rekonsiliasi bank

- Mulai dengan CSV yang dapat dipetakan kolom, preview, per-account statement period dan import identity. Parser menghormati format Indonesia/international secara eksplisit.
- Import baris rekening koran bukan mem-posting transaksi cash secara otomatis. Match existing terlebih dahulu. Unmatched baru boleh memicu source transaction yang dikonfirmasi, ditautkan dan diposting sekali.
- Gunakan external transaction ID bila ada; fallback import identity + row identity dan review duplicate. Dua transaksi sah bernominal/tanggal sama jangan digabung hanya karena field identik.
- Dukung satu penerimaan untuk banyak invoice, banyak penerimaan untuk satu invoice, split fee, transfer internal dua rekening, payment gateway gross/fee/net dan koreksi match.
- Total matched per sisi tidak melebihi nilai; transaksi batal/reversed tidak tetap dianggap settled. Unmatch tidak menghapus receipt atau jurnal asli.
- Simpan raw data terbatas sesuai akses. Validasi ukuran, tanggal, encoding dan formula injection pada ekspor CSV.

## File dan identitas

Implementasikan ADR-005 atau ADR penerus yang sah: file privat, content type/size validation, checksum, metadata pemilik, download terotorisasi dan backup blob. Nama file bukan bukti upload. Form source menyimpan bukti sekali dan Finance/Accounting mereferensikannya.

Owner nyata memerlukan onboarding/provisioning dan recovery yang server-backed. Gunakan mekanisme autentikasi existing sebagai dasar; jangan menambahkan demo login production atau bypass role. Provider SSO/S3/email dipilih dari keputusan bisnis/config; dev memakai adapter lokal yang jelas. Pengiriman eksternal tidak disimulasikan sebagai berhasil.

## Pembacaan dan performa

Rekonsiliasi laporan memakai snapshot konsisten dan date range yang sama. Index untuk event identity, source links, account/date, project/order/date, period dan reconciliation status. Hindari N+1 per project, per-journal atau per-row.

Derived balance boleh di-cache/materialize hanya setelah definisi dan invalidation/rebuild terbukti. Ledger posted dan source facts tetap dapat membangun ulang read model tanpa mengulang cash. Tes volume realistis, pagination, totals, locking dan recovery sebelum optimasi tambahan.
