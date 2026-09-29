# Spesifikasi domain Finance & Accounting

## Bahasa produk dan batas domain

**Project/Booking** memicu kebutuhan finansial; mereka tetap dikelola oleh modul operasional. **Receivable** adalah uang customer yang masih harus masuk. **Payable** adalah uang yang harus keluar ke vendor/pihak lain. **Account Statement** berisi mutasi *actual posted*. **Account Ledger** mengelompokkan mutasi actual per rekening dan menampilkan opening/in/out/closing periodik. **Cash Flow** memakai saldo actual dan kewajiban yang belum diselesaikan untuk melihat posisi kas ke depan. Dashboard merangkum semuanya.

Konteks finance pada halaman Booking dan Vendor adalah lensa ke record yang sama, bukan tabel/lifecycle terpisah. Finance tidak mengubah status booking atau menghalangi Project/Booking; warning tetap advisory. Jangan jadikan unpaid invoice sebagai prasyarat umum untuk operasional. Closure project yang sudah mempunyai gate khusus perlu dievaluasi ulang agar memakai sumber baru tanpa diam-diam melemahkan atau menguatkan gate tersebut.

## Aturan sumber tunggal

| Fakta | Sumber otoritatif | Bukan sumber |
|---|---|---|
| Tagihan customer | Customer invoice/termin yang diterbitkan, terkait Party/Project dan opsional Booking | angka quotation atau dashboard card |
| Tagihan vendor | Vendor invoice yang lolos status yang disepakati; deposit vendor terjadwal sebagai kewajiban unik | accepted vendor quotation dihitung lagi sebagai AP |
| Pembayaran aktual | Posting receipt/disbursement ke rekening, dengan allocation ke invoice/obligation | tombol status `paid` saja |
| Posisi kas | Opening balance yang diverifikasi + semua cash postings setelah cutover | total revenue, margin, atau jurnal tanpa identitas rekening |
| Proyeksi | Outstanding AR/AP + expected/due date + current cash | histori chart atau transaksi yang sudah lunas |

Perbedaan status: `draft/submitted/approved` adalah workflow dokumen; `open/partial/settled/void` adalah hasil kewajiban terhitung; `pending/posted/reversed` adalah status perpindahan uang. Jangan menyamakan approval dengan kas keluar, credit note dengan refund terbayar, atau note dengan kas yang bergerak.

## Invariant wajib

- Nilai uang non-negatif dalam unit terkecil/integer; posted cash movement tidak bisa diedit/hapus, koreksi memakai reversal bertautan. `postedAt`, `effectiveAt`, actor, source, account, currency, amount, dan idempotency key terlacak.
- Receipt customer dan vendor disbursement boleh dialokasikan parsial; jumlah allocation tidak melebihi movement maupun outstanding. Overpayment ditahan sebagai unapplied balance/advance yang jelas, tidak dipotong diam-diam.
- AR outstanding = nominal invoice efektif − credit yang benar-benar mengurangi invoice − allocations receipt yang posted; AP outstanding = nominal kewajiban efektif − allocations disbursement posted. Credit untuk refund kas yang sudah diterima diperlakukan terpisah dari pengurangan AR agar tidak double count.
- Internal transfer membuat sepasang entry rekening (out/in) terikat satu transfer ID; tidak mengubah kas total perusahaan kecuali fee. Arah fee A→B dan B→A punya rule berbeda.
- Setiap refund mengacu pada payment asli dan booking/project; total refund posted + reserved tidak melebihi nominal eligible menurut policy dan saldo yang benar-benar diterima. Credit note dan settlement punya identitas berbeda.
- Invoice void tidak memunculkan AR/AP baru; bila pernah ada payment, wajib alur credit/refund/advance yang diaudit, bukan hilangkan pembayaran historis.
- Policy cancellation di-snapshot saat dipilih/diaktifkan pada booking; perubahan master tidak menulis ulang hasil pembatalan historis.
- Beri dukungan transaksi non-project (mis. biaya kantor) secara eksplisit; filter project hanya menampilkan entri yang terkait project dan memberi tanda cakupan terbatas.

## Lifecycle inti

1. Project/Booking dibuat: belum ada cash posting. Billing schedule boleh menghasilkan planned invoice/AR hanya sesuai aturan issuance yang disepakati.
2. Invoice customer diterbitkan → AR; receipt posted dan dialokasikan → AR turun, statement + ledger bertambah.
3. Vendor invoice masuk dan divalidasi → AP; vendor payment posted → AP turun, statement + ledger berkurang.
4. Cancellation preview → policy tier/snapshot dan split hangus/refund → approval bila berlaku → credit note/refund obligation → settlement posted → statement/ledger dan booking history.
5. Cash Flow dihitung ulang dari snapshot saldo + AR/AP outstanding, termasuk refund obligation yang belum paid sebagai outflow satu kali.

**Keputusan saat implementasi:** untuk payment sebelum invoice (DP customer), gunakan customer advance/deposit yang kemudian dialokasikan ke invoice; jangan menciptakan receipt kedua ketika invoice diterbitkan. Untuk deposit vendor sebelum vendor invoice, gunakan vendor advance dan settle ke AP berikutnya. Bila produk belum butuh advance penuh, batasi UI yang dapat membuat kasus itu sampai model jelas, sambil tetap menjaga booking tidak terblokir.
