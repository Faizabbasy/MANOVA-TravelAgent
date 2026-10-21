# ADR-009 — Draft billing dari perubahan komersial

Status: implemented locally, production inactive. Acceptance A10/A11, migrations0057.

Commercial impact dan cancellation fee existing tidak membuktikan apakah fee terpisah atau sudah termasuk. Finance memilih basis dan pembagian customer secara eksplisit. Unknown tidak dijumlahkan otomatis. Alokasi sah mengikuti project/order dan customer existing, bukan party dari request sebagai authority.

Approval internal/client atau konfigurasi sesudah approval menerapkan amendment kontrak/order immutable dan ordinary invoice drafts satu kali. Peserta GroupTrip memakai invoice/customer sendiri. Tidak ada uang/revenue dari approval. Invoice dasar issued → tambahan draft debit note; tanpa dasar pada kontrak project → draft other. Auto-issue belum diaktifkan tanpa policy.

Source plan, allocation, contract amendment dan invoice creation atomik/idempotent. Invoice source facts tidak diedit/hapus terpisah. Void issued invoice dengan kontrol existing dahulu, lalu void plan mengurangi delta kontrak, menolak jika jasa sudah melebihi hak hasil koreksi. Riwayat dipertahankan. Koreksi tidak menimpa perubahan lain.

Bukti PGlite/PostgreSQL, source UI, HTTP proxy dan batas kualitas/release ada pada doc11 paket owner accounting. CR draft menghindari input ulang Finance; manual journal/cash ledger baru tidak dibuat.
