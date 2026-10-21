# Panduan owner: accounting otomatis MANOVA

Status: panduan implementasi lokal (rehearsal). Buku produksi **belum aktif**; kebijakan prinsipal/agen, pengakuan jasa, pajak, komisi, bentuk usaha dan saldo awal belum diputuskan (lihat dokumen 11). Angka di layar berlabel "rehearsal" atau "sementara" sampai keputusan itu disahkan.

## Prinsipnya

Anda mencatat **kejadian bisnis** di tempat kejadiannya. Sistem membentuk jurnal sendiri. Tidak ada form debit/kredit untuk pekerjaan harian.

| Yang terjadi | Di mana dicatat | Akibatnya |
|---|---|---|
| Customer membayar | Finance → Piutang Customer → Terima pembayaran (atau Konfirmasi DP pada order) | Kas masuk; melunasi tagihan atau menjadi uang muka customer. Belum menambah laba. |
| Jasa diberikan ke customer | Workspace project → Finance → **Jasa diberikan** (prefill dari booking) | Pendapatan diakui sebesar jasa yang sudah diberikan. Tidak memindahkan uang. |
| Jasa supplier sudah diterima | Workspace project → **Jasa supplier diterima** (prefill dari SO) | Biaya diakui; bila invoice supplier belum datang, menjadi utang belum ditagih (estimasi). |
| Invoice supplier datang | Finance → Utang Vendor → setujui invoice | Menggantikan estimasi tanpa biaya kedua; bila jasa belum diterima, menjadi biaya dibayar di muka. |
| Bayar supplier / deposit | Finance → Bayar vendor | Kas keluar; mengurangi utang atau menjadi uang muka supplier. Tidak menambah biaya lagi. |
| Supplier mengembalikan dana | Workspace project → **Klaim ke supplier**, lalu **Terima** saat uang masuk | Klaim mengurangi biaya (atau mengembalikan deposit); penerimaan hanya melunasi klaim. |
| Refund ke customer | Refund & Pembatalan (alur existing) | Saat disetujui: kewajiban refund; saat dibayar: kas keluar. Pendapatan hanya dikoreksi sekali. |
| Biaya kantor | Mutasi Rekening → Catat pengeluaran | Kas keluar; menjadi biaya sesuai kategori yang sudah dipetakan kebijakan. |
| Sewa/langganan kantor dibayar beberapa bulan di muka | Aset, Pinjaman & Modal → **Biaya kantor dibayar di muka** → Bayar di muka | Satu kas keluar menjadi prepaid; **Bebankan bulanan** memindahkan manfaat ke biaya tanpa pembayaran lagi. |
| Uang jalan staf | **Kasbon & Bukti Biaya** → Beri uang jalan | Uang dipegang karyawan; belum biaya. |
| Bukti pengeluaran staf | Kasbon & Bukti Biaya → Catat bukti | Bukti sah menjadi biaya; kelebihan menjadi reimbursement. Nomor bukti yang sama ditolak. |
| Gaji | HR → Payroll → Setujui, lalu **Bayar Gaji** dari rekening | Setujui = beban & utang gaji bulan itu; Bayar = kas keluar. Status dibayar hanya dari pembayaran. |
| Beli aset | **Aset, Pinjaman & Modal** → Beli aset | Aset (bukan biaya); penyusutan bulanan lewat "Hitung penyusutan". |
| Pinjaman / cicilan | Aset, Pinjaman & Modal | Pinjaman bukan pendapatan; cicilan memisahkan pokok (mengurangi utang) dan bunga (biaya). |
| Setor/ambil dana owner | Aset, Pinjaman & Modal | Modal/prive sesuai bentuk usaha — bukan pendapatan atau biaya. |
| Order B2C mandiri dibayar | Sales order → **Konfirmasi DP** (Finance) | Invoice atas order itu sendiri (tanpa project tambahan) dan kas masuk. Status paid tidak lagi diubah manual. |

## Membaca hasil

Buka **Laporan & Cek Bulanan** (`/finance/accounting`):

- **Laba rugi**: pendapatan diakui, biaya langsung perjalanan, biaya perusahaan, **laba sebelum pajak**. "Laba setelah pajak" tetap *belum tersedia* sampai profil pajak disahkan.
- **Posisi keuangan**: yang dimiliki, kewajiban, modal dan hasil usaha sejak buku dimulai; harus seimbang.
- **Keuntungan per perjalanan**: pendapatan − biaya langsung per project/order. Biaya kantor dihitung sekali di tingkat perusahaan.
- Daftar alasan di bawah angka menjelaskan apa yang membuat angka masih sementara (rehearsal, saldo awal, pajak, transaksi tertunda, estimasi supplier).

Saldo bank ≠ laba. Uang DP customer menambah kas tetapi belum laba sampai jasanya diberikan.

## Cek bulanan

Di halaman yang sama, pilih periode lalu baca **Cek bulanan**. Setiap baris menyebut apa yang perlu dilakukan dan menautkan ke layarnya:

1. Saldo kas & bank cocok dengan buku.
2. Semua transaksi sumber sudah dibukukan (yang tertunda biasanya menunggu kebijakan; setelah kebijakan dilengkapi, Super Admin menekan **Proses ulang**).
3. Biaya supplier yang masih estimasi (boleh, tetapi terlihat).
4. Penyusutan aset bulan itu.
5. Gaji bulan itu sudah disetujui.
6. Kasbon terbuka (informasi).
7. Debit = kredit.

Piutang dan utang yang memang belum jatuh tempo **tidak** menghalangi penutupan. Setelah tidak ada hal yang "harus diselesaikan", isi catatan, centang konfirmasi dan **Tutup periode**. Transaksi baru bertanggal di bulan itu akan ditolak; koreksi memerlukan pembukaan kembali yang tercatat.

## Rekening koran

**Cocokkan Rekening Koran** (`/finance/reconciliation`): impor CSV dari bank (tentukan kolom, pratinjau, lalu impor). Impor tidak membuat transaksi uang. Untuk setiap baris, pilih transaksi yang cocok (bisa satu baris ke beberapa transaksi, mis. pembayaran + biaya transfer) atau **Catat dari baris ini** untuk biaya bank/bunga yang belum tercatat. Impor ulang file yang sama tidak menambah baris.

## Biaya kantor dibayar di muka

Untuk biaya kantor dibayar di muka, pilih awal manfaat pada tanggal 1 bulan dan metode sama besar per bulan secara eksplisit. Metode tersebut harus sesuai kebijakan yang tervalidasi; bukan default produksi. Jalankan pembebanan hanya sampai bulan yang telah berakhir. Bulan yang sudah dibebankan dilewati saat diulang. Jika belum dibebankan, cek bulanan menunjukkan blocker dan laporan menjelaskan kekurangannya. Referensi bukti adalah nomor bukti/kontrak, bukan file yang sudah diunggah.

Pembayaran yang belum pernah dibebankan dapat dibatalkan lewat mutasi existing dengan alasan. Pembatalan sesudah ada beban memerlukan koreksi terkait dan belum tersedia pada irisan ini. Prorata harian dan prepaid dari invoice/utang supplier belum tersedia. Biaya berulang yang belum dibayar memakai alur di bawah.

## Bukti asli privat

Pada panel **Bukti asli privat**, pilih file PDF/JPEG/PNG/WebP maksimal10MB lalu **Unggah file asli**. File tersimpan privat dan **Unduh asli** memeriksa akses serta integritas bytes. Nama lampiran legacy hanya referensi sampai file aslinya benar-benar diunggah. Bukti internal tidak dibuka ke client; berbagi ke customer harus dipilih eksplisit pada sumber yang mendukungnya. Mengunggah bukti tidak mengonfirmasi kas atau pembayaran.

Invoice, bukti bayar dan alokasi pembayaran menautkan file asal yang sama. File tidak perlu diunggah ulang pada setiap perpindahan. File hilang/rusak menampilkan kegagalan; recovery membutuhkan database dan blob bersama (runbook14). Provider dan retensi produksi belum ditetapkan.

## Biaya dan refund order B2C

Buka order mandiri → panel Finance. Konfirmasi jasa supplier, catat invoice asli melalui Utang Vendor, lalu gunakan pembayaran existing. Klaim supplier tertaut order. Kontribusi memakai jurnal yang sama dengan laporan perusahaan; hasil rehearsal dan sumber pending diberi penjelasan.

Pembatalan order yang memiliki invoice issued membuat satu kasus Finance otomatis. Finance mereview nominal/kebijakan dan membayar melalui refund existing. GroupTrip memakai customer peserta sendiri. Void finansial tidak otomatis memulihkan kursi/room/peserta yang dibatalkan.

## Tagihan dari Change Request

Di detail CR → **Tagihan dari perubahan**, Finance memilih **Tentukan penagihan**. Pilih komponen yang disetujui dan bagi nominal persis ke kontrak project/order peserta. Fee dijumlahkan hanya bila komponen terpisah. Goodwill memakai tanpa tagihan dan alasan.

Sesudah approval, draft dibuat otomatis dan kontrak/order bertambah sesuai alokasi. Buka untuk terbitkan; tambahan invoice dasar menjadi debit note. Approval/draft belum mengakui jasa atau menerima uang. Jika approval lebih dulu, konfigurasi sesudahnya langsung membuat draft.

Koreksi melalui void rencana beralasan lalu revisi. Invoice issued harus di-void dahulu; pemenuhan melebihi kontrak setelah koreksi perlu direview pada sumber jasa. Jangan membuat tagihan manual kedua untuk CR yang sama.

## Batas yang masih berlaku

Pajak/withholding, komisi berbasis kebijakan, transaksi agen, valuta asing, mode owner tunggal, saldo awal/cutover produksi, kelengkapan proyeksi kas 13 minggu dan pelepasan aset. Jangan memakai angka rehearsal sebagai laporan resmi.

## Biaya rutin dan biaya yang belum ditagih

Di **Aset, Pinjaman & Modal → Biaya rutin & belum ditagih** (`/finance/funding#biaya-rutin`):

1. **Tambah rencana rutin** sekali dari kontrak vendor: nominal, kategori, bulan pertama, jumlah bulan, tanggal rencana bayar. Rencana masuk forecast; belum menjadi beban, invoice atau pembayaran.
2. Saat biaya benar-benar terjadi, pilih **Biaya sudah terjadi** dan jadwal/bulannya. Vendor, keterangan dan nominal kontrak terisi dari sumber existing. Periksa nilai aktual/estimasi andal dan referensi bukti; ini mencatat beban dan kewajiban belum ditagih, tanpa memindahkan uang.
3. Ketika invoice asli datang, **Tautkan invoice existing**, atau **Catat invoice asli** melalui dialog Utang Vendor yang sama. Konfirmasi pencocokan. Invoice harus dari vendor yang sama, company-only dan belum disetujui. Nilai aktual mengganti estimasi; selisihnya saja menjadi tambahan/pengurangan biaya.
4. **Buka invoice & bayar** memakai alur pembayaran vendor existing. Tidak perlu mencatat biaya yang sama lagi sebagai pengeluaran kas manual. Forecast mengganti accrual dengan AP dan mengurangi kewajiban setelah dibayar.
5. Kesalahan sumber dikoreksi dengan alasan: batalkan invoice terkait terlebih dahulu, lalu batalkan biaya. Riwayat tidak dihapus. Jika kontrak berakhir, **Hentikan rencana** mulai bulan yang benar; biaya yang sudah terjadi tetap terutang.

Contoh fixture: biaya diperkirakan 10 juta, invoice asli 12 juta → total beban 12 juta, utang invoice 12 juta. Setelah pembayaran 12 juta, utang nol dan beban tetap 12 juta. Jadwal tidak otomatis membuktikan jasa terjadi. Bulan yang sudah berakhir harus direview sebelum tutup periode/validasi saldo awal. Satu biaya saat ini hanya mendukung satu invoice aktif; split/multi-invoice belum tersedia. Referensi bukti bukan unggahan file. Kebijakan kategori wajib tervalidasi; angka rehearsal bukan kebijakan fiskal produksi.

## Pencocokan tagihan supplier ke jasa

Pada invoice supplier approved, bagian **Jasa yang ditagih** → **Cocokkan penerimaan jasa**. Pilih receipt dari supplier dan project/order yang sama; nominal/tanggal sudah disediakan dari sumber. Bila invoice hanya sebagian, sisakan estimasi terbuka. Centang **Ini tagihan terakhir** hanya setelah memastikan sisa estimasi jasa tersebut memang ditutup; selisih actual menjadi tambahan/pengurangan biaya sekali. Pencocokan tidak membayar uang.

Contoh fixture: receipt estimasi60, invoice pertama30, invoice terakhir40 → total biaya70; receipt lain20 tetap terbuka. Invoice tanggal30September dengan jasa2Oktober baru dicocokkan paling awal2Oktober. Tanggal sumber tetap. Koreksi melalui **Batalkan pencocokan** dan alasan; void invoice/penerimaan membalik pencocokan terkait otomatis. Invoice paid harus membatalkan pembayaran existing dahulu. Sumber lama tanpa jurnal mode terstruktur memerlukan review mapping/koreksi, tidak dipaksa ke mode baru.

## Menguji usulan kebijakan tanpa SQL

Dalam buku rehearsal terisolasi, buka **Laporan & Cek Bulanan → Pengaturan periode dan usulan kebijakan**. Pilih sumber, tanggal mulai, peran, kejadian pengakuan dan metode/kategori yang sudah diputuskan untuk fixture. Pilihan awal tetap **Belum diputuskan**; jangan mengisi kebijakan produksi dengan angka contoh. Simpan usulan, lalu **Uji di rehearsal**, isi alasan dan konfirmasi data fiktif. Sistem membuat versi TEST_ONLY baru; draft dan riwayat lama tetap tersimpan. Buku produksi tidak mempunyai tindakan pengujian ini.

Setelah fixture lengkap, buka antrean pekerjaan dan **Proses ulang** sumber asal. Pembatalan yang sudah tercatat ikut dibalik dari jurnal sumbernya; pembayaran tidak diulang. Bila alokasi baru dapat diproses setelah penerimaan dibatalkan, kompensasinya juga terbentuk otomatis. Sumber tetap void, fingerprint tetap, dan saldo kas tidak bergerak lagi. Jika policy atau periode masih kurang, pekerjaan tetap pending dengan alasan.

Pinjaman owner memakai **Catat Pinjaman** dengan syarat dan register pinjaman, bukan sekadar label setoran owner. Pajak/komisi/agen yang belum didukung tidak mendapat status lolos palsu dari menu pengujian.
