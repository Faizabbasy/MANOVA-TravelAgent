# Frontend: IA, page contract, dan UX

**Keputusan terbaru pengguna:** hapus UI finance mockup lama dan desain ulang enam halaman utama. Desain baru harus lebih proper, cantik, tenang, dan cepat dipahami user baru. Pertahankan visual shell dan komponen dasar app (`frontend/app/layouts/dashboard.vue`, `app/components/layout/AppSidebar.vue`, `app/components/shared/*`, `app/components/ui/*`, `assets/css/tailwind.css`) kecuali perubahan kecil yang terbukti perlu. Jangan redesign seluruh produk.

## IA target

| Menu | Route baru yang disarankan | Satu pertanyaan yang dijawab |
|---|---|---|
| Dashboard | `/finance` | Kas hari ini dan apa yang perlu diperhatikan? |
| Account Statement | `/finance/statement` | Uang apa yang benar-benar masuk/keluar? |
| Account Ledger | `/finance/accounts` dan `/finance/accounts/[id]` | Saldo ada di rekening mana, dan bagaimana bergerak? |
| Receivable | `/finance/receivables` | Customer mana harus bayar, kapan, dan berapa sisa? |
| Payable | `/finance/payables` | Vendor mana harus dibayar, kapan, dan berapa sisa? |
| Cash Flow | `/finance/cash-flow` | Kas 30 hari sampai 12 bulan mendatang akan seperti apa? |

Workflow pendukung (tidak harus submenu utama): invoice, receipts/payments, settlement, refund/credit note, rekening dan fee, cancellation policy. Gunakan halaman detail/drawer kontekstual atau tautan dari keenam area; hindari menu primer panjang. Retain bookmark lama `/finance/invoices`, `/finance/payments`, `/finance/ledger`, `/finance/notes`, `/finance/reconciliation`, `/finance/opex`, `/finance/tax` melalui redirect/deep-link relevan saat komponen lamanya dihapus. `frontend/app/constants/navigation.ts`, `navigation.test.ts`, `app/middleware/rbac.global.ts`, dan `app/constants/modules.ts` harus diselaraskan.

## Struktur layar

**Dashboard:** hero saldo total terverifikasi dengan `as of`; kartu kas masuk/keluar periode, AR, AP, projected closing; chart sederhana timeline opening→closing; alert cash gap dengan tanggal dan penyebab; transaksi terbaru. Tunjukkan ketidaktersediaan saldo dengan call to action verifikasi opening balance, bukan Rp0 palsu.

**Statement:** tabel desktop/card mobile, sticky filter tanggal/rekening/arah/project, nominal +/− jelas, detail side sheet dengan source chain, bukti, notes, reversal. Hanya posted actual. Tombol "Catat uang masuk/keluar" membuka form ringkas dan mengarahkan ke allocation sesuai source; jangan menampilkan term akuntansi tanpa penjelasan.

**Ledger:** daftar kartu rekening saldo dan status; detail satu rekening menunjukkan opening/in/out/closing untuk periode, running balance dan proof/source pada setiap mutasi. Transfer antar rekening mudah dibaca sebagai satu aksi dengan dua kaki; biaya terpisah. Ini **bank account ledger**, bukan `app/components/finance/LedgerPanel.vue` yang saat ini adalah General Ledger.

**Receivable/Payable:** ringkasan total outstanding dan overdue, worklist yang diurutkan aksi terdekat; status jelas, due vs expected date terpisah, progress paid/outstanding, filter project/customer/vendor, detail source, alokasi pembayaran, CTA record/confirm. Vendor detail (`app/pages/vendors/[id]/index.vue`) mendapat panel invoice/AP dari endpoint yang sama. Booking/project detail (`app/pages/project-orders/[id]/index.vue` dan halaman booking tipe `ticketing/accommodation/transportation/mice`) mendapat finance context yang sama tanpa menciptakan record duplikat.

**Cash Flow:** pilihan horizon 30d/3m/6m/12m, filter project dan rekening, headline projected closing serta gap paling awal; grafik garis/bar sederhana; tabel bulan opening/incoming/outgoing/closing, breakdown AR/AP klik-ke-sumber, badge confirmed/expected/overdue. Untuk filter project, beri label bahwa opening cash adalah saldo perusahaan (atau tampilkan net flow project dengan baseline nol), jangan mengklaim project punya rekening sendiri jika tidak dialokasikan. Filter rekening mengecualikan AR/AP tanpa account assignment dari total dan memperlihatkan jumlah yang belum teralokasi; total perusahaan tetap tersedia.

## Pola interaksi dan kualitas visual

- Satu CTA utama per layar; detail lanjutan di drawer; progressive disclosure untuk fee, FX, allocations, dan policy tiers.
- Gunakan istilah bahasa Indonesia yang dipahami non-finance: "Uang masuk", "Uang keluar", "Sisa tagihan", "Perkiraan tanggal bayar", dengan istilah teknis kecil sebagai secondary label jika perlu.
- Numeral tabular, currency alignment, status bukan warna saja, line length pendek, ruang antar blok memadai. Visual chart selalu punya tabel/ringkasan teks yang setara.
- Reuse `PageHeader`, `SectionCard`, `EmptyState`, `LoadingState`, `ErrorState`, `StatusBadge`, `ui/dialog`, `ui/table`, `ui/input/CurrencyInput.vue`; desain ulang composition finance baru, bukan styling ulang komponen lama satu per satu.
- Untuk form, pakai vee-validate + Zod yang sudah tersedia, dan tetap validasi ulang di API. Untuk chart, gunakan Chart.js/vue-chartjs yang sudah tersedia bila cocok; jangan menambah library visual kedua tanpa alasan.
- Mobile: filter sheet, tabel ke card; tidak ada horizontal overflow untuk aksi pokok. Keyboard, focus ring, dialog focus trap, label form, error inline, kontras, screen reader text, `aria-live` untuk hasil mutasi.
- State: skeleton saat load, empty state berbeda untuk belum ada rekening/belum ada invoice/filter kosong, retry error dengan request ID, confirm untuk posting/reversal/cancel, sukses menunjukkan link transaksi yang tercipta. Jangan sembunyikan error server.
- Di `frontend/app/pages/client/project-orders/[id]/index.vue`, tampilkan invoice/payment/refund customer saja. Jangan kirim AP, margin, bank internal, atau vendor net cost melalui API client-facing. Supplier portal juga terisolasi.

### Blueprint visual yang dapat ditinjau

Gunakan Plus Jakarta Sans dan token HSL yang sudah ada di `frontend/assets/css/tailwind.css` (`--primary`, `--background`, `--card`, `--success`, `--warning`, `--destructive`, `--radius`) serta spacing/shadow dari `frontend/tailwind.config.ts`. Sasaran rasa: dashboard operasional premium yang tenang, bukan panel admin padat. Hero menampilkan **satu angka utama** dengan label `Saldo tersedia per [tanggal]`; empat metrik lain lebih kecil. Alert punya hierarki severity, kalimat sebab, dan CTA. Tabel menonjolkan nama pihak + due date + sisa, sedangkan ID dan metadata sekunder ditempatkan di detail. Gunakan ikon lucide yang sudah ada secara hemat, border/warna hanya untuk memisahkan konteks, bukan dekorasi.

Contoh urutan scan di Dashboard: `Saldo saat ini` → `Perkiraan 30 hari` → `Uang masuk / Uang keluar` → `Tagihan customer / Kewajiban vendor` → `Perlu perhatian` → `Aktivitas terbaru`. Di mobile, urutan ini tetap sama satu kolom. Hindari menampilkan 10 KPI dengan bobot visual setara. Di Cash Flow, tempatkan chart dan tabel bulan berdekatan agar pembaca bisa memeriksa angka; klik gap membuka AR/AP penyumbang. Pada form, tampilkan preview hasil seperti `Saldo BCA setelah transfer`, `Sisa tagihan setelah pembayaran`, dan `Estimasi refund`, sebelum tombol konfirmasi. Format Rp dengan pemisah ribuan dan tanggal Indonesia, namun simpan nilai API mentah tanpa locale parsing ambigu.

Tinjau 6 layar di 1440px dan 375px dengan screenshot nyata, lalu lakukan satu putaran revisi visual berdasarkan: kejelasan angka utama dalam 3 detik, jumlah aksi primer, jarak/kontras, keselarasan numerik, dan panjang form. Jangan menyatakan “award level” hanya dari gradient atau animasi; kualitas diukur dari keputusan yang cepat dan aman untuk user non-finance.

## Audit sebelum delete

Peta import semua file `app/pages/finance/*` dan `app/components/finance/*`. Hapus semua UI finance lama setelah route baru/redirect dan consumer non-finance memakai contract baru. `app/components/dashboard/DashboardCashFlowSection.vue` boleh dihapus dari dashboard bila hanya chart mock; ganti dengan projection real pada Finance Dashboard tanpa memalsukan histori. Screenshot baseline halaman non-finance penting sebelum/akhir untuk memastikan shell konsisten.
