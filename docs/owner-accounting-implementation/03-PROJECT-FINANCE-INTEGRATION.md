# Integrasi Project Management dengan Finance dan Accounting

Checkpoint8–9: native retail memakai order ID pada supplier fulfillment/invoice/claim/cash attribution dan refund existing (0055/0056), tanpa project dummy. Cancel operasional dengan invoice issued membuat satu kasus Finance; customer GroupTrip tetap per peserta. CR menggunakan alokasi penagihan eksplisit (0057): approval → amendment kontrak/order + draft invoice sekali, bukan cash/revenue. UI sumber di sales order dan detail CR; nomor/source links memakai Finance existing. Bukti dan batas chronology/opening/forecast ada pada dokumen11; ini belum menyelesaikan seluruh matriks.

## Satu sumber transaksi

Project atau order adalah dimensi penghubung, bukan salinan buku keuangan. Pertahankan ID project, layanan, booking, quotation, service order, customer dan vendor yang sudah ada. Biaya kantor boleh tanpa project; order retail memiliki order ID tanpa project dummy. Accounting membaca fakta server yang sama dengan Finance.

Setiap integrasi harus menjawab: aksi sumber, fakta/versi yang dipakai, syarat aktor, waktu efektif, draft atau final, dampak kas, dampak laba, koreksi, dan kunci anti-duplikat. Buat matriks implementasi aktual berdasarkan tabel berikut di Fase 0; tandai existing, extend, new, tested, dan evidence.

## Matriks aksi dan hasil

| Sumber atau aksi | Hasil otomatis yang harus disambungkan | Batas dan koreksi |
|---|---|---|
| Lead Won dan project baru | Referensi kontrak/quotation, komponen penjualan, budget awal dan rencana termin dari kontrak | Tidak langsung revenue; replay Won tidak membuat project, jadwal atau jurnal ganda |
| Quotation dikirim atau diterima client | Snapshot harga/lingkup/kebijakan dan draft rencana penagihan sesuai persetujuan | Persetujuan bukan uang masuk; versi lama tetap dapat ditelusuri |
| Buat project manual | Setup nilai kontrak, jenis layanan, counterparties dan kebijakan yang belum lengkap | Tidak memaksa quotation palsu; ikuti gate existing dan dokumentasikan bila perlu jalur sah project manual |
| Budget layanan diubah | Versi baseline budget dan perbandingan margin estimasi | Budget bukan actual expense; milestone/itinerary tidak ditambahkan lagi sebagai biaya layanan yang sama |
| Task atau milestone dibuat/selesai | Pengingat biaya, billing milestone atau fulfillment yang memang dikonfigurasi | Centang task/checklist sendiri bukan bukti uang dibayar/jasa diterima |
| Itinerary diubah atau versi diterima client | Evaluasi dampak harga/biaya pada item yang terkait layanan; buat action bila perlu CR | Tidak membuat biaya kedua untuk hotel/transport yang sudah di booking |
| RFQ diterima, quotation vendor dipilih | Pilihan supplier, harga dan syarat pembatalan tersimpan; commitment sesuai SO yang sah | RFQ kalah/quote belum diterima hanya estimasi; tetap lokal tidak boleh menjadi sumber buku |
| SO dibuat atau disetujui | Komitmen supplier beserta sisa nilai belum ditagih dan tanggal rencana bayar | Utang invoice dan commitment harus saling mengurangi dalam forecast, bukan ditotal ganda |
| SO diamandemen/vendor diganti | Versi komitmen, delta budget/margin dan review kewajiban lama | Hormati invoice/payment existing; jangan menghapus kewajiban supplier lama |
| Booking flight/hotel/transport/MICE | Hubungkan harga jual/net, komponen jasa, supplier, SO dan fulfillment | Konfirmasi booking bukan bukti pembayaran atau otomatis pengakuan seluruh jasa |
| PNR/tiket diterbitkan atau layanan diserahkan | Bukti fulfillment komponen yang sesuai profil; memicu recognition sah | Tipe layanan berbeda boleh memiliki waktu pengakuan berbeda; jangan hardcode semua ke akhir trip |
| Peserta ditambah/diganti/dibatalkan | Evaluasi harga per peserta, biaya kamar/kursi, commitment dan CR yang diperlukan | Mengedit jumlah peserta tidak boleh diam-diam mengubah invoice terbit atau kontrak beku |
| Group Trip DP peserta | Reuse invoice, receipt, status order dan traveler existing; tambah jurnal accounting terkait | Jangan membuat receipt/traveler/invoice kedua. Per peserta dan total trip harus reconcile |
| Order B2C standalone | Invoice, receipt, vendor costs, recognition, credit/refund dan profit per order | Perlu perluasan referensi tanpa project; tidak memakai project dummy yang terlihat owner |
| Termin jatuh tempo atau milestone billing sah | Draft invoice atau auto-issue sesuai kebijakan owner; audit tindakan otomatis | Schedule belum menjadi AR; penerbitan invoice tidak otomatis menjadi revenue |
| Bukti bayar customer diterima | Antrean verifikasi dengan usulan invoice/rekening/nominal | Upload bukti bukan receipt; hanya verifikasi yang sah mem-posting kas/jurnal |
| Receipt terkonfirmasi | Kas masuk, alokasi piutang/uang muka, status DP dan gate Ready diperbarui | Alokasi existing tetap satu sumber; sisa uang muka dan unearned revenue adalah konsep berbeda |
| Layanan supplier diterima | Pengakuan cost atau accrual bila invoice belum ada, berdasarkan bukti dan estimasi terotorisasi | Bila nilai belum dapat ditentukan, tampilkan pending estimate; jangan nol palsu |
| Invoice supplier disetujui | AP, clearing accrual/prepaid terkait, selisih biaya, margin dan forecast | Mencocokkan SO/penerimaan/invoice. Nomor supplier duplikat tetap ditolak |
| Supplier dibayar atau deposit dialokasikan | Penyelesaian AP/uang muka, kas, alokasi, jurnal dan referensi bukti | Tidak mengakui expense kedua saat membayar invoice yang sudah menjadi cost |
| Biaya lapangan dari tab Pengeluaran | Reuse posting Finance; jurnal otomatis sesuai sifat biaya, project dan bukti | Jangan mempertahankan form baru yang mem-posting kas kedua untuk tindakan sama |
| Kasbon tour leader/staf | Advance kepada pemegang kas, settlement per bukti, pengembalian sisa/utang reimbursement | Pengiriman kasbon belum menjadi biaya; cegah bukti yang sama diklaim dua kali |
| CR berbiaya diterima client | Versi kontrak/delta biaya dan draft debit/credit billing yang terhubung | Approval hanya pemicu setelah detail commercial sah; bukan langsung cash atau revenue |
| Insiden/no-show/perubahan layanan | Kasus biaya, klaim supplier, penalti atau refund sesuai keputusan | Catatan insiden tidak otomatis menjadi beban/pendapatan tanpa nilai dan otorisasi |
| Pembatalan project/booking | Reuse policy snapshot, credit note dan kasus refund existing; kurangi commitment yang dibatalkan | Bedakan pengurangan AR, kewajiban refund customer dan tagihan pemulihan dari supplier |
| Refund customer disetujui/dibayar | Koreksi accounting yang sesuai, liability refund, settlement bank dan audit | Pengakuan kewajiban dan uang keluar terpisah; settlement tidak mengurangi revenue kedua kali |
| Supplier mengembalikan dana/credit | Supplier claim/receivable, reversal prepaid/cost yang sesuai, kas masuk atau offset AP | Tidak dicampur dengan refund customer. Nilai dan timeline bisa berbeda |
| Trip completed | Review fulfillment, biaya belum ditagih, kasbon dan margin sementara | Completed bukan bukti semua cash lunas, bukan otomatis komisi paid |
| Review accounting project | Checklist bukti, recognition, accrued costs, komisi dan tax completeness | Boleh menghasilkan profit dengan AR/AP terbuka; status settlement tetap ditampilkan |
| Finance close dan project close | Reuse gate existing dan tambah accounting completeness yang relevan | Pertahankan gate settlement legacy sampai ADR perubahan disetujui; recognition tidak menunggu closed_at |
| Gaji/komisi/insentif | Beban/utang sesuai kebijakan, lalu settlement kas payroll yang sama | Jangan mem-posting ulang bila pembayaran sudah tercatat lewat kas manual yang ditautkan |
| Aset dibeli/dipakai/dijual | Acquisition dari pembelian sah, depreciation, disposal; peminjaman memengaruhi kesiapan operasional | Membuat kartu inventory atau meminjam aset bukan acquisition/expense baru |
| Sewa kantor/marketing/utilitas/pinjaman/modal | Company-level accounting, jadwal pembayaran dan profit/neraca/forecast | Tidak dipaksa ke project; pokok pinjaman/setoran modal tidak masuk revenue |

## Tahapan project existing

Frontend memiliki enam step presentasi: Drafting, Confirmed, Start, Departure, On Progress dan Done. Step diturunkan dari status project existing; baca `project-order-workflow.ts` dan `project-workflow.ts`. Jangan mengganti delapan status domain secara massal.

| Step | Informasi keuangan yang owner butuhkan |
|---|---|
| Drafting | Nilai kontrak, budget baseline, margin estimasi, kelengkapan syarat komersial |
| Confirmed | Termin DP, invoice/draft, penerimaan aktual, komitmen supplier dan deadline |
| Start | Kebutuhan modal kerja, deposit supplier, kasbon, dokumen/bukti |
| Departure | Status pembiayaan, biaya terikat dan kesiapan; bukan auto-recognition semua komponen |
| On Progress | Pengeluaran, revisi/CR, fulfillment dan perkiraan biaya akhir |
| Done | Hasil sementara, biaya belum lengkap, piutang/utang, review accounting, lalu penutupan sesuai gate |

Pertahankan Ready berbasis fakta Finance. Migrasikan gate bernilai keuangan atau keputusan kritis ke server bila masih frontend-only. Semua API dan UI mengonsumsi evaluasi gate yang sama; jangan hanya menyembunyikan tombol.

## Tiga status yang tidak boleh tertukar

1. Selesai operasional: layanan/perjalanan telah dilaksanakan.
2. Sudah direview secara accounting: pengakuan dan biaya cukup lengkap untuk laporan, dengan bukti/estimasi yang sah.
3. Selesai pembayaran: seluruh kewajiban kas terkait diselesaikan sesuai syarat penutupan.

Gunakan fakta/field tambahan yang kompatibel untuk membedakannya. Project existing baru dapat closed sesudah finance settled; jangan menghapus gate itu tanpa ADR. Owner tetap boleh melihat profit saat completed walaupun AR/AP belum lunas. Tutup buku bulanan tidak mensyaratkan seluruh piutang/utang perusahaan nol.

## Biaya dan margin

Tampilkan budget, commitment tersisa, biaya diakui, estimasi biaya belum terjadi, pembayaran, serta proyeksi biaya akhir secara terpisah. Item yang sama tidak boleh terhitung dari budget milestone, itinerary, SO dan invoice sekaligus.

Alokasi overhead adalah analisis manajemen yang terpisah dari actual direct cost. Total P&L perusahaan mencakup overhead asli sekali; jangan menjumlahkan overhead alokasi ke expense lagi. Beri laporan project sebelum dan sesudah alokasi dengan basis/metode yang terlihat.

## Kriteria integrasi selesai

- Setiap baris matriks memiliki pemilik service/handler, sumber data persisten, rule, koreksi dan pengujian.
- Tidak ada langkah wajib input ulang di accounting untuk fakta yang sudah lengkap dari sumber.
- Tidak ada alur sumber baru yang melewati posting saat accounting aktif.
- Pembatalan, revisi, pengulangan, akses langsung API dan kegagalan di tengah transaksi diuji.
- Project Summary, Finance, Accounting dan laporan perusahaan membaca definisi/fakta yang konsisten.

## Pembaruan matriks checkpoint 7 (0054)

| Aksi sumber | Pemilik service dan sumber persisten | Integrasi turunan dan koreksi | Pengujian |
|---|---|---|---|
| Rencana kontrak rutin | `finance/company-expenses.createExpenseSchedule`, `company_expense_schedules` | Forecast saja, tanpa invoice/jurnal/kas; kontrak unik, stop remaining months dengan alasan | `accounting-company-expenses.test.ts`: retry, duplicate contract, forecast |
| Biaya kantor sudah terjadi | `recordCompanyExpense`, `company_expenses` (jadwal/bulan/bukti unik) | Dr expense / Cr company-accrued; explicit classification policy; shadow pending/retry, active atomic rollback; void sumber exact original | PGlite/PostgreSQL fixture, SQL immutability, two workers, closed period, auth |
| Invoice asli mengganti estimasi | `matchCompanyInvoice` → `reviewVendorInvoice`, `company_expense_invoice_links` + `vendor_invoices` existing | Clear accrual penuh, delta expense, AP actual; vendor/company scope; source posting mandatory; void invoice restores accrual, lalu source void | Estimasi10/actual12, estimasi5/actual4, negative policy rollback, no second cash |
| Pembayaran biaya kantor | Existing vendor payment/allocation | Dr AP / Cr bank via advance/allocation existing; satu cash source, forecast AP tinggal outstanding | Nominal12, GL bank88 dari100, expense tetap12; BS balanced |
| Opening dan monthly review kantor | `accounting/opening`, `review`, `reports`, view forecast | Carry pre-cutover accrual, later invoice only delta; completed recurring months belum direview memblokir close/opening dan laporan provisional | Opening5 → actual6, delta expense1, cash100 tetap |

Irisan ini company-only dan satu invoice aktif per biaya. Project-linked costs tetap memakai fulfillment/accrual project existing. Tidak ada input jurnal manual atau project dummy. Bukti angka fixture bukan kebijakan produksi; hasil checks final dan batas fitur ada di dokumen 11 checkpoint 7.

Checkpoint10/11: bukti file asli privat tertaut source (invoice/proof/cash allocation/CR/dokumen), checksum + scoped download dan physical PostgreSQL17 DB/blob recovery sudah diuji. Checkpoint11 mode supplier receipt-links menyambungkan invoice aktual parsial/final ke penerimaan jasa tertentu; reversal mengikuti source transaction. Source lama tetap historis. Bukti targeted SQL/source28PGlite+28PG; full quality/browser current lihat11, jangan menganggap seluruh matriks/fase selesai.
