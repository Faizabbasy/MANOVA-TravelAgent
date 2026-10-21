# ADR-010 — Pencocokan invoice supplier ke penerimaan jasa

Status: implemented local, production inactive. Date: 21 Oktober2026.

Saldo vendor+project/order saja tidak mengidentifikasi layanan yang ditagih. Flag penerimaan final tidak membuktikan invoice berikutnya merupakan seluruh actual; invoice bisa parsial atau bertanggal sebelum jasa yang sudah dibukukan. Menghabiskan seluruh accrual vendor akan salah menghitung biaya dan menghilangkan estimasi lain.

Kebijakan `costMatching=receipt-links` memakai invoice dan service_fulfillment existing. Penerimaan membukukan cost/accrual, invoice membukukan prepaid/AP. `vendor_fulfillment_matches` menyimpan alokasi aktual dan estimasi yang dikonsumsi, scope sumber, tanggal dan alasan immutable. Matching membalik accrual/prepaid dan mengakui hanya selisih; tidak membuat pembayaran. Tagihan terakhir wajib dikonfirmasi untuk menutup seluruh sisa estimasi, termasuk aktual lebih rendah. Pasangan receipt/invoice aktif hanya sekali; beberapa invoice dapat menagih satu receipt dan satu invoice dapat dialokasikan ke beberapa receipt.

Economic date adalah max(invoice_date,fulfilled_on). Posting date minimal economic date, tidak di masa depan, dalam periode terbuka; source dates tidak ditimpa. Void memakai reversal persis pada tanggal koreksi dan membuka kembali sisa alokasi. Void invoice/penerimaan membalik match aktif dalam transaksi sumber yang sama. Paid invoice menolak void sebelum side effect; payment reversal tetap alur existing.

Parent journals wajib berasal dari policy terstruktur yang sama dan memiliki leg prepaid/accrual sebesar sumber. Policy baru tidak menulis ulang sumber legacy. Mode legacy hanya dipertahankan untuk fixture rehearsal test-only; produksi tanpa keputusan eksplisit tetap pending/block. Draft settings dari UI belum berarti policy sah.

Satu helper kelengkapan dipakai laporan perusahaan, project dan monthly review. Invoice tak terkait tidak menghilangkan peringatan estimasi. Perkiraan biaya akhir project ditahan/null saat prepaid dan accrual belum dapat dipasangkan; recognized cost tetap dihitung dari GL. Sisa commitment SO mengurangi bagian yang sudah diterima maupun ditagih, tanpa mengurangi keduanya dua kali.

Koreksi saldo awal/legacy, pemisahan komponen prinsipal/agen, pajak dan kontrak produksi tetap memerlukan alur/policy masing-masing. ADR ini tidak mengaktifkan buku produksi atau mengesahkan kebijakan fiskal.
