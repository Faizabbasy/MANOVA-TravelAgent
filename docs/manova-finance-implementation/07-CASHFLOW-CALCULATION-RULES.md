# Cash Flow v1 — aturan hitung dan klasifikasi

Cash Flow adalah **proyeksi posisi kas**, bukan laba, revenue, ML, atau estimasi dari chart historis. API/server adalah sumber perhitungan tunggal; Vue hanya memformat.

```text
currentCash(asOf) = Σ verified opening account balance + Σ posted cash movements through asOf
periodOpening[0] = currentCash(asOf)
periodIncoming = Σ outstanding eligible AR on selected expected date
periodOutgoing = Σ outstanding eligible AP + approved unpaid refund obligations + known transfer fee/outflow
periodClosing = periodOpening + periodIncoming - periodOutgoing
periodOpening[n+1] = periodClosing[n]
```

**Kebijakan double count:** invoice dan receipt yang sudah posted tidak masuk forecast sebagai AR lagi; vendor invoice yang telah dibayar tidak masuk AP lagi; settlement refund yang posted tidak masuk refund outflow lagi. Internal transfer tidak mengubah saldo seluruh perusahaan, hanya distribusi rekening; hanya fee menjadi outflow perusahaan. Credit note mengurangi AR atau menciptakan refund obligation sesuai payment yang sudah diterima, tidak otomatis kas keluar. Opex yang belum menjadi AP bisa masuk `planned outflow` hanya jika punya sumber/expected date dan dedupe terhadap AP.

## Tanggal, horizon, dan status

- `asOf` = akhir hari bisnis Asia/Jakarta; 30d = 30 hari kalender mulai hari berikutnya, 3m/6m/12m = bulan kalender yang mencakup sisa bulan berjalan plus bulan berikutnya dengan batas jelas di UI/API. Dokumentasikan `periodStart`/`periodEnd` dalam response.
- `dueDate` adalah tanggal kontrak, `expectedDate` adalah estimasi realistis. Forecast memakai expected bila ada; jika tidak, due. Overdue yang masih outstanding ditempatkan pada bucket **segera/first future period** dan dilabel overdue, bukan dibiarkan di bulan lampau atau diam-diam dihapus.
- Confirmed = kewajiban sah dan tanggal/nominal pasti; Expected = sah tetapi jadwal estimasi; Overdue = melewati due dan belum selesai. Ini label transparansi, bukan bobot probabilitas. Jangan kalikan nilai dengan 0.7/0.9 secara tersembunyi.
- Draft/rejected/void bukan AR/AP yang valid; disputed harus ditampilkan sebagai kategori risiko dengan aturan include/exclude eksplisit. Default proposal: include outstanding dengan badge disputed dan subtotal terpisah, agar cash gap konservatif; uji dengan bisnis sebelum final.
- Planned payment yang belum actual masuk forecast satu kali. Refund obligation approved tetapi belum settled termasuk outgoing; cancellation preview/draft tidak termasuk.

## Filter

Company total = semua rekening eligible dan semua kewajiban. Per rekening = opening rekening itu + obligations dengan rekening tujuan/sumber yang ditetapkan; obligations belum ditetapkan ditampilkan di `unallocated` dan tidak disisipkan diam-diam. Per project = net incoming/outgoing project dan dampaknya pada company cash; jangan menyebut closing itu `saldo project` kecuali ada allocation rekening khusus. Rekening berbeda currency harus dikonversi menggunakan rate snapshot terdokumentasi atau tampil per currency; tidak boleh dijumlah mentah.

## Warning

Cash gap bila proyeksi closing < 0; low cash bila di bawah configurable floor rekening/perusahaan. Tampilkan **tanggal pertama** kondisi negatif, nilai, 3 kontributor utama, dan link AR/AP penyebab. Warning advisory; tidak otomatis membatalkan booking atau pembayaran. Jika opening balance belum diverifikasi, tampilkan `Perkiraan belum tersedia` dan daftar data yang kurang.

## Contoh acceptance numerik

Pada 1 Okt saldo terverifikasi Rp300 juta. AR Okt Rp200 juta; AP Okt Rp150 juta. Closing Okt Rp350 juta. November AR Rp100 juta; AP Rp400 juta. Closing Nov Rp50 juta. Jika vendor Rp100 juta dibayar 15 Okt, saldo actual turun Rp100 juta, AP outstanding turun sama, maka forecast closing Okt tetap Rp350 juta (tanpa double count). Jika ada refund Rp20 juta belum settled, closing Okt Rp330 juta; setelah settlement posted, current cash turun Rp20 juta dan refund outstanding nol, forecast closing tetap Rp330 juta.

Test wajib: cutoff posting di hari asOf, partial receipt/payment, overdue, credit note sebelum/selepas cash receipt, refund partial, internal transfer+fee, account filter unallocated, project filter non-project expense, void/reversal, cross-month date, timezone boundary, currency rounding, zero-data/no opening balance. Hasil per bulan dan total harus reconcile dengan detail drilldown.
