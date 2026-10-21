# ADR-011 — Usulan rehearsal dan identitas koreksi pending

Status: implemented local; validation fixture-only; production inactive. Date:21 Oktober2026.

Usulan policy immutable tidak cukup untuk owner menguji alur tanpa SQL. Endpoint rehearsal menyalin draft terbaru persis ke versi baru test-only, dengan konfirmasi data fiktif, alasan, idempotency dan audit. `accounting_policy_rehearsals` menyimpan hubungan immutable; SQL menolak fakta/jenis/book yang berbeda dan hasil selain test-only. Tidak ada endpoint ini yang mengesahkan policy produksi atau mengaktifkan buku.

Unknown tetap unknown. Settings dibatasi menurut sumber, berupa pilihan metode/kategori bisnis yang didukung. Peran agen/mixed, tax dan commission yang belum mempunyai integrasi lengkap tidak diberi kelulusan fixture palsu. Pinjaman owner memerlukan register, syarat dan pelunasan loan existing; label owner-funds saja tidak cukup.

Event identity versi2 memisahkan snapshot/tanggal/alasan sumber dari ID jurnal parent yang baru tersedia setelah pending diselesaikan. Posted journal tetap mengikat parent immutable dan menolak retargeting. Legacy identity1 dipertahankan, termasuk fingerprint aslinya: pending correction dengan fakta sama boleh memperoleh parent yang telah posted; replay sesudah posted hanya menerima parent terikat yang sama. Perubahan fakta tetap conflict. Ini bukan backfill otomatis seluruh varian schema/legacy cutover.

Pembatalan kas mempunyai satu compensation per jurnal kas/alokasi asal. Jika cash reversal terjadi sebelum parent GL tersedia dalam shadow, marker awal tidak dihapus dan tidak diberi jurnal kosong. Registry marker baru dapat menjadi superseded setelah setiap parent yang tersedia telah mempunyai reversal posted persis. Guard SQL memverifikasi graph tersebut dan melarang perubahan identitas/status resolved. Source status menunjuk jurnal nyata, bukan marker.

Retry parent juga memproses koreksi sumber yang sudah tercatat. Allocation yang baru dapat dibukukan setelah receipt dibalik otomatis memperoleh compensation sendiri; tidak membuat receipt/payment kedua. Pending yang masih kekurangan policy/periode tetap terlihat. Tidak memulihkan status operasional sumber yang sudah void atau mengubah tanggal aslinya.

Owner memakai usulan, uji rehearsal dan tombol Proses ulang pada antrean yang sama. Produksi tetap memerlukan policy approval, owner/identity decisions, cutover/mapping dan kontrol mode yang terpisah. Validasi PGlite/PostgreSQL dan browser/quality evidence dicatat di dokumen11; tidak menganggap kelulusan fixture sebagai readiness produksi.
