# Tahapan implementasi Claude Code

## Pola eksekusi

Kerjakan perubahan kecil dari backend sampai UI sumbernya, lalu tes. Semua fase wajib menghasilkan implementasi yang bisa dipakai, bukan backend-only atau mock-only. Dependency yang belum tiba boleh ditampilkan sebagai belum tersedia; jangan memberi tombol sukses palsu. Update dokumen 11 dan laporan fase dengan bukti aktual.

Lanjutkan fase berikutnya bila syaratnya terpenuhi. Jangan berhenti untuk meminta konfirmasi rutin setelah setiap fase. Jika konteks/tool budget habis, simpan checkpoint yang jelas dan laporkan sisa; jangan menyatakan program selesai. Unknown policy tidak boleh diisi dengan tebakan produksi. Kerjakan bagian independen sambil mencatat keputusan yang diperlukan.

## Fase 0 audit dan baseline

1. Baca instruksi root/paket, ADR-001 sampai ADR terbaru yang relevan, paket ini dan Git status.
2. Perbarui daftar fitur, jalur server/lokal dan matriks seluruh aksi pada dokumen 03.
3. Catat versi aktual dependencies, schema, test, lint, typecheck dan build; periksa generated Nuxt configs dan plugin compatibility.
4. Perbaiki false-green typecheck terlebih dahulu. Bedakan tooling error, error source lama, warning dan regresi. Hindari mematikan aturan/strictness global untuk membuat indikator hijau.
5. Pilih keputusan teknis sendiri yang rutin. Buat register untuk profil akuntansi, tax, recognition, owner mode dan cutover yang belum diketahui.
6. Buat ADR desain lintas modul dan backlog fase dengan acceptance ID.

Hasil: laporan baseline, source-to-posting matrix, policy register, ADR dan rencana file. Tidak mengaktifkan buku pada DB nyata.

## Fase 1 profil dan fondasi ledger

Implementasikan profile off/shadow/active, COA template/mapping, periods, immutable business events, journal/lines, posting registry, source references, adjustment/reversal, trial balance dasar dan control-account dimensions. Buat wizard setup dan detail jurnal yang terbatas akses.

Tes balancing, direct SQL guards, duplicate event berbeda request key, partial event identity, policy unknown, immutable posted, period locking, actor/scope, dan concurrent posting. Pakai buku fixture terisolasi untuk menjalankan active flow. Opening nyata menunggu Fase 9.

## Fase 2 integrasi Finance existing

Hook semua jalur cash, transfer/fee, invoice, receipt/allocation/advance, vendor invoice/payment, credit/debit note, cancellation/refund, payment-proof verify dan reversal. Pertahankan record sumber dan ID. Post di transaksi yang sama ketika buku aktif. Tampilkan posting status dan source links di panel Finance existing.

Tes fixture utama dokumen 08, partials, receipts sebelum/sesudah invoice, deposit allocation, direct cost versus invoice, retry dan rollback. Tidak menganggap invoice otomatis revenue. Jangan menyelesaikan fase ini hanya dengan route journal yang dipanggil manual dari frontend.

## Fase 3 Project Management dan pengakuan jasa

Implementasikan contract/service components, policy principal/agent, obligations dan partial fulfillment; SO commitments, service receipt, accrued/unbilled supplier cost, prepaid release, matching invoice actual dan correction. Integrasikan budget, booking, itinerary/milestone, peserta, CR berbiaya, no-show, supplier claims, project review dan close gates.

Gunakan enam step presentasi existing dan source facts server. Tambahkan panel budget/commitment/recognized/forecast/review pada workspace yang sama. Uji task selesai bukan paid, invoice bukan fulfilled, trip completed bukan cash settled, late cost, per-booking cancellation, dan race close versus financial change.

## Fase 4 order retail dan dependency komersial

Hilangkan batas finance pada B2C standalone melalui referensi order yang sah; jangan memakai project dummy. Pastikan Group Trip per peserta dan agregat reconcile tanpa duplicate traveler/invoice. Sambungkan contract amendment dengan draft/auto billing policy dan per-party collection.

Tambahkan review kerugian kredit/allowance/write-off yang terpisah dari price reduction atau cancellation, berikut recovery dan kontrolnya. Kredit macet tidak diselesaikan dengan membuat diskon palsu.

Persistensikan minimum RFQ/SO amendments/cost sheet/commodity transactions yang dipakai sebagai sumber nilai. Terapkan limit kredit existing ke exposure/outstanding dan transaksi sesuai kebijakan dengan explicit override dan audit. Public lead intake yang menjadi sumber order harus persisten. Jangan memperluas marketplace/promosi yang tidak dibutuhkan integrasi.

Hasil: corporate/project dan retail/order memakai mesin Finance/Accounting yang sama, dengan dimensi yang tepat.

## Fase 5 biaya perusahaan dan dana staf

Implementasikan kasbon, pertanggungjawaban bukti, petty cash, reimbursement, opex invoice/unbilled accrual, recurring expense/prepaid schedule. Hubungkan HR payroll/commission/incentive ke expense/payable/settlement. Hapus logika paid dari project closed pada sumber komisi baru dengan migrasi/compatibility yang terdokumentasi.

Pemilik memilih rule komisi sesuai profil. Setiap biaya dapat project-linked atau company-only. Reuse/link pembayaran lama agar payroll paid tidak membuat expense/cash kedua. Owner UI memakai action bisnis dan exception queue.

## Fase 6 aset pinjaman modal dan pajak

Hubungkan acquisition ke invoice/payment dan inventory, depreciation schedule, disposal, loan principal/interest, owner funds sesuai entity profile dan prepaid amortization. Tambahkan tax profile/rule versions, tax components, withholding proofs, tax payable/payment dan export yang sesuai skema aktif.

Tax settings unknown memblokir klaim net-after-tax lengkap dan tipe posting yang membutuhkan profile, bukan dianggap pajak nol. Implementasikan fitur teknis dan fixture fiktif sambil menunggu validasi profil nyata. Bila foreign transactions dipakai, kerjakan multi-currency amounts, rates, settlement gain/loss dan revaluation sebelum mengaktifkan transaksi tersebut.

## Fase 7 rekonsiliasi bukti dan akses owner

Implementasikan bank CSV preview/import/matching, split/group payments, fee/transfer, unmatched transaction resolution, controlled unmatch dan audit. Tambahkan file asli privat menurut ADR-005, scoped download dan recovery DB+file. Lengkapi owner account provisioning dan recovery berdasarkan auth existing.

Implementasikan mode owner tunggal dan tim secara eksplisit. Buat ADR perubahan maker/checker, jangan diam-diam melemahkan mode tim. Tes same-owner flow yang sah dan penolakan bypass untuk role yang tidak berwenang.

## Fase 8 laporan dan pengalaman lengkap owner

Bangun P&L, BS, trial balance, GL drilldown, actual cash flow, project/order margin, completeness, cash obligations dan forecast 13 minggu atau horizon setara yang dapat dijelaskan. Forecast harus memasukkan recurring opex, payroll/tax/loan due, approved obligations serta sisa commitments tanpa double count.

Pasang lima kelompok pekerjaan keuangan dengan kompatibilitas route lama. Gunakan satu definisi angka di project, Finance, Accounting dan reporting. Uji owner journey, refresh, mobile, keyboard dan peran yang dibatasi. Tidak ada net-profit final jika tax/missing-cost masih unknown.

## Fase 9 review penutupan migrasi dan rehearsal

Implementasikan monthly review/close/reopen dan project accounting review yang terpisah dari settlement. Jalankan dry run cutover pada salinan anonim/synthetic, opening balances lengkap, source mapping, no-double-cash dan reconciliation. Uji transaksi tertunda, crossing cutover, prior-period correction dan rollback/recovery sesuai dokumen 09.

Laporan lama tidak ditulis ulang sebagai GL secara diam-diam. Beri historical labels dan compatibility strategy. Semua sumber dalam matriks harus terbukti terhubung, termasuk reversal/correction dan sumber non-project.

## Fase 10 verifikasi akhir dan handoff

Jalankan suite yang relevan penuh di PGlite/PostgreSQL terisolasi, frontend tests, real app typecheck, lint, build yang benar-benar selesai dan browser UAT. Analisis baseline error dan build lambat; jangan mengklaim lulus dari compiler sebagian.

Lengkapi user guide, runbook, policy/cutover checklist, migrations and rollback constraints, test evidence, unresolved decisions dan release status. Serahkan hasil lokal yang reviewable. Deploy/production data activation/real payments/external messages/filing hanya setelah instruksi pengguna yang sesuai.

## Format laporan setiap fase

- Cakupan selesai dan acceptance IDs yang terbukti.
- File, migration, source hooks, API/DTO dan perubahan UX.
- Command, engine/config, exit code dan hasil; baseline versus regresi.
- Contoh angka dan rekonsiliasi, idempotency, security dan recovery.
- Keputusan baru beserta basisnya, unknown yang tersisa dan dampaknya.
- Langkah berikutnya dan status fase, tanpa menyatakan bagian belum diuji sudah selesai.
