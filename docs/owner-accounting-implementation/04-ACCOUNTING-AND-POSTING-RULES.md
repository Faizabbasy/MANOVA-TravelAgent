# Aturan accounting dan jurnal otomatis

## Model buku

Gunakan pembukuan berpasangan pada functional currency yang dipilih. Fase inti IDR. Setiap jurnal posted seimbang, immutable, punya sumber dan tanggal efektif. Owner bekerja dengan kejadian bisnis; service accounting menentukan akun dari policy version yang sudah aktif.

Invoice adalah penagihan, receipt adalah penerimaan kas, fulfillment adalah pemenuhan jasa, dan recognition adalah pengakuan accounting. Jangan menganggap satu status menggantikan semuanya. Penerbitan invoice sebelum layanan yang membentuk hak tagih tanpa syarat dapat menjadi AR versus contract liability, bukan revenue. Bila hak tagih masih bersyarat, pertahankan billing document/proforma tanpa mengakui AR sampai syarat terpenuhi. Simpan pilihan ini sebagai kebijakan kontrak.

## Daftar akun awal

Sediakan template yang bisa dipetakan dan diaktifkan, bukan COA bebas yang wajib disusun owner. Nomor berikut hanya contoh penomoran, tidak mengikat kode database.

| Kelompok | Akun minimum |
|---|---|
| Kas | Bank per rekening, petty cash, payment clearing bila diperlukan |
| Aset lancar | AR customer, unbilled receivable/contract asset sesuai policy, supplier advance, prepaid trip cost, employee advance, supplier refund claim, prepaid opex, tax credit |
| Aset tetap | Acquisition cost per kelas, accumulated depreciation |
| Liabilitas | AP supplier, accrued cost, customer advance/contract liability, pass-through payable prinsipal, refund payable, payroll/commission payable, tax payable, loan principal |
| Ekuitas | Modal, saldo laba, pengambilan/distribusi sesuai bentuk entitas, opening balance clearing sementara |
| Pendapatan | Pendapatan jasa prinsipal, fee/komisi agen, pendapatan lainnya dengan mapping eksplisit |
| Beban | Direct cost perjalanan, biaya kantor/gaji/marketing, komisi, biaya bank, depreciation, finance cost, bad debt, FX dan pajak yang berlaku |

Control account wajib memiliki dimensi yang cocok: customer pada AR/advance, vendor pada AP/deposit/claim, pegawai/pemegang kas pada kasbon, rekening pada kas, dan project/order bila transaksi terkait perjalanan. Akun clearing sementara tidak boleh menjadi tempat menutup selisih tanpa penjelasan.

## Pola jurnal inti

Contoh di bawah mengecualikan pajak dan FX agar hubungan pokok terlihat. Tambahkan komponennya dari profil yang valid; contoh ini bukan kebijakan fiskal default. Setiap baris adalah pola bersyarat, bukan kewajiban mem-posting semua baris untuk transaksi yang sama.

| Kejadian | Debit | Kredit | Ketentuan |
|---|---|---|---|
| Invoice sebelum jasa, hak tagih tanpa syarat | AR | Contract liability | Belum revenue; hindari pencatatan advance dua kali |
| Customer membayar invoice | Bank | AR | Komponen sisa tidak teralokasi ke customer advance; pembayaran tidak mem-posting revenue lagi |
| Customer membayar sebelum invoice | Bank | Customer advance | Saat invoice sah terbentuk, pindahkan advance untuk menyelesaikan AR tanpa mengubah cash |
| Customer advance dipakai pada invoice deferred | Customer advance | AR | Contract liability dari invoice tetap sampai fulfillment; pilih model subaccount yang tidak menduplikasi liability |
| Jasa prinsipal dipenuhi sesudah penagihan | Contract liability | Service revenue | Proporsi/periode berdasarkan obligation yang dipenuhi |
| Jasa telah dipenuhi sebelum penagihan | AR atau contract asset | Service revenue | Pilih sesuai sifat hak tagih; saat invoice muncul, reclass contract asset ke AR tanpa revenue kedua |
| Dana diterima atas nama prinsipal | Bank | Pass-through payable dan bagian fee yang belum/sudah diakui | Hanya hak fee/komisi yang menjadi revenue; bukan nilai bruto titipan |
| Meneruskan uang ke prinsipal | Pass-through payable | Bank | Tidak menjadi biaya perjalanan bruto lagi |
| Deposit supplier tanpa invoice | Supplier advance | Bank | Belum expense |
| Invoice supplier sebelum jasa | Prepaid trip cost | AP | Tidak langsung expense; allocation deposit mengurangi AP dan supplier advance |
| Jasa supplier diterima sebelum invoice | Direct cost | Accrued supplier cost | Butuh nilai estimasi andal dan evidence; unmatched estimate menurunkan completeness |
| Invoice diterima sesudah accrual | Accrued supplier cost dan selisih cost/prepaid sesuai fakta | AP | Reclass accrual; hanya selisih sah memengaruhi expense tambahan |
| Jasa diterima dari prepaid cost | Direct cost | Prepaid trip cost | Cost sekali, berdasarkan service fulfillment |
| Invoice supplier atas jasa yang sudah diberikan tanpa accrual | Direct cost | AP | Jangan berlaku jika accrual/prepaid untuk sumber sama sudah ada |
| Supplier dibayar | AP | Bank | Allocation ke supplier advance jika belum ada AP; tidak expense kedua |
| Biaya langsung dibayar dan sudah terjadi | Expense atau aset/prepaid yang sesuai | Bank | Reuse cash posting existing; hindari pengakuan invoice sekaligus cash-expense untuk sumber sama |
| Kasbon diberikan | Employee advance | Bank/petty cash | Bukan expense |
| Bukti kasbon disetujui | Expense/aset/prepaid sesuai bukti | Employee advance | Sisa tetap advance; kelebihan menjadi reimbursement payable |
| Sisa kasbon kembali | Bank/petty cash | Employee advance | Tidak menjadi other income |
| Gaji/komisi menjadi hak | Payroll/commission expense | Payroll/commission payable | Waktu dan basis mengikuti profil, bukan closed_at untuk paid |
| Gaji/komisi dibayar | Payable terkait | Bank | Cegah expense kedua dan pembayaran kedua |
| Beli aset | Fixed asset | AP atau bank | Tidak semua asset record adalah acquisition |
| Depreciation periodik | Depreciation expense | Accumulated depreciation | Scheduler/retry tidak boleh menduplikasi periode aset |
| Bayar sewa di muka | Prepaid opex | Bank/AP | Amortisasi periode: expense versus prepaid |
| Dana pinjaman diterima | Bank | Loan principal payable | Bukan revenue |
| Cicilan pinjaman | Loan principal payable dan interest expense/accrual | Bank | Pokok bukan expense |
| Setoran owner | Bank | Equity atau owner loan sesuai substansi | Pilih klasifikasi profil entitas; bukan revenue |
| Dana diambil owner | Equity/distribution/owner loan sesuai fakta | Bank | Jangan selalu menjadikannya opex atau dividen otomatis |
| Customer memotong pajak, bukti valid | Bank dan tax credit/akun sesuai profil | AR | Bila bukti belum lengkap, gunakan receivable/clearing terpisah yang dapat direview, bukan hapus AR sebagai diskon |
| PPN dipungut yang berlaku | AR/bank sesuai transaksi | Tax payable | Pisahkan dari revenue; input tax hanya diperlakukan sesuai kelayakan profil |
| Tax payable dibayar | Tax payable | Bank | Tidak expense kedua bila sudah diakui |

Pastikan kasus invoice sebelum pembayaran dan pembayaran sebelum invoice menghasilkan posisi akhir identik untuk fakta ekonomi identik. Outstanding AR dan nilai contract liability adalah dua ukuran berbeda. `v_unallocated_payments` existing hanya mengukur alokasi uang, bukan seluruh pendapatan diterima di muka.

## Prinsipal dan agen

Simpan role pada kontrak/komponen layanan dengan policy version. Nilai booking bruto tetap boleh dipakai untuk operational sales volume, tetapi jangan dicampur dengan accounting revenue. Fee yang ditagih customer dan komisi dari supplier dapat memiliki sumber/hak terpisah. Kontrak campuran memakai komponen dan allocation yang terdokumentasi, bukan satu boolean global.

Jangan menyimpulkan tiket selalu agen atau paket selalu prinsipal. Fixture boleh memilih profil fiktif secara eksplisit. Aktivasi real books memerlukan pilihan yang tervalidasi untuk produk yang diaktifkan.

## Fulfillment dan periode

- Dukung partial delivery dan layanan lintas bulan; jumlah diakui tidak melebihi hak kontraktual yang sah.
- Booking status, bukti layanan, dan milestone dapat menjadi evidence sesuai policy. Satu centang checklist tidak otomatis mewakili seluruh obligation.
- Perubahan jadwal tidak mengubah jurnal posted diam-diam. Gunakan change/version/correction yang efektif di periode terbuka.
- Operational completed boleh menjadi usulan recognition yang masih memerlukan review bila evidence/amount kurang.
- Biaya sudah terjadi namun belum dibayar tetap dapat menjadi expense dengan accrual. Utang belum lunas tidak mencegah P&L bulanan.
- Biaya yang belum terjadi tetap forecast/commitment, bukan expense.
- Revenue dan cost harus memiliki referensi komponen, pemenuhan, periode, dan adjustment asal agar partials dapat dicocokkan.

## Koreksi dan pembatalan

Reversal cash existing harus memicu accounting reversal/reclassification yang sesuai, dengan keterlacakan original. Membatalkan receipt tidak otomatis membatalkan jasa yang sudah diakui. Membatalkan booking tidak otomatis menghapus seluruh utang supplier yang masih sah.

Reuse credit note dan refund existing. Bedakan credit yang menurunkan AR, kewajiban uang kembali, dan settlement cash. Bila revenue belum diakui, pembatalan dapat mengurangi contract liability; bila sudah diakui, gunakan adjustment revenue sesuai policy. Refund settlement mengurangi liability, bukan revenue kedua kali.

Supplier claim/credit terpisah dari customer refund. Pemulihan deposit mengurangi supplier advance; pemulihan cost yang diakui mengoreksi cost sesuai periode/policy. Komisi dan pajak terkait mengikuti koreksinya. Prior-period correction tidak boleh menulis ke bulan terkunci melalui jalan lain.

Pisahkan potongan harga/pembatalan dari kerugian kredit. Customer tidak mampu membayar bukan otomatis pembatalan jasa atau pengurangan revenue. Sediakan review impairment/allowance/write-off sesuai profil, alasan dan approval; recovery sesudah write-off punya kejadian tersendiri. Jangan menggunakan credit note diskon untuk menyembunyikan piutang macet.

Untuk invoice/bukti terlambat dari periode tertutup, simpan tanggal ekonomi asli dan tanggal posting accounting secara terpisah. Gunakan prosedur reopen atau adjustment periode terbuka yang dibenarkan kebijakan; jangan memalsukan tanggal sumber/bank, mengubah periode lama diam-diam, atau menolak semua penyelesaian kewajiban lama tanpa jalan koreksi yang sah.

## Laporan dan laba

- P&L: recognized revenue, direct cost, selling/commission expense, overhead, depreciation, finance cost, FX dan income tax sesuai profil.
- Laba bersih tidak dihitung dari saldo bank atau semua uang masuk dikurangi semua uang keluar.
- Neraca: assets = liabilities + equity, dengan current-period result/retained earnings diperhitungkan sekali.
- Trial balance dan control account reconcile dengan AR/AP, uang muka, kasbon, rekening dan aset.
- Arus kas aktual dibedakan dari forecast. Transfer internal dikecualikan dari total perusahaan, fee tetap tercatat.
- Project contribution/direct margin berbeda dari company net profit. Alokasi overhead tidak menambah company expense kedua kali.
- Net profit after tax hanya ditampilkan sebagai lengkap jika tax profile dan accrual/review terkait lengkap. Jika belum, tampilkan laba sebelum pajak atau laba sementara dengan alasan.
- Buku sebelum cutover diberi status unavailable/historical view yang jelas; jangan mengarang perbandingan accounting dari data yang tidak dibukukan.

## Kelengkapan dan finalitas

Simpan reasons yang dapat ditindaklanjuti: source belum diposting, policy belum lengkap, supplier cost belum diestimasi, mismatch invoice, kasbon terbuka, tax proof kurang, bank belum reconcile, dan opening belum tervalidasi. Draft dan exception tidak boleh menghilang dari laporan completeness.

Gunakan status estimasi, sementara, dan ditutup. Ditutup berarti direview/dikunci menurut kebijakan dan masih dapat dikoreksi secara terkontrol, bukan jaminan tidak akan ada penyesuaian masa depan. Jangan memberi label final hanya karena seluruh cash lunas.
