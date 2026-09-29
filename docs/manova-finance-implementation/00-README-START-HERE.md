# MANOVA Finance & Accounting — mulai di sini

Paket eksekusi untuk Claude Code. **Ini spesifikasi dan rencana, bukan klaim bahwa fitur telah diimplementasikan.** Repo yang diaudit: `/Users/daffascript/Downloads/MANOVA-TravelAgent`, 29 September 2026. Baca `01` sampai `14` sebelum mengubah kode, lalu jalankan **Phase 1 saja** sesuai `11-EXECUTION-PHASES.md` dan `CLAUDE-CODE-START-PROMPT.md`.

## Keputusan pengguna yang mengikat

- Enam menu utama: Dashboard, Account Statement, Account Ledger, Receivable, Payable, Cash Flow.
- Finance mengikuti Project/Booking; peringatan finance tidak menghambat operasional. Financial closure yang memang sudah ada tetap menjadi gate khusus penutupan, dan perlu diselaraskan saat implementasi.
- **Seluruh UI finance mockup yang sekarang boleh dihapus dan dibangun ulang** karena dinilai keliru, jelek, dan rumit. Perizinan ini spesifik pada UI finance dan logika mock finance yang terbukti salah. Pertahankan fitur dan alur non-finance; petakan seluruh consumer dan deep link dahulu.
- Cash Flow v1 adalah proyeksi deterministik dari saldo aktual + AR terbuka − AP terbuka; tanpa ML, prediksi berbasis histori, atau what-if editor.
- Frontend dan backend akhirnya harus tersambung nyata, dengan persistence, permission server, dan bukti alur end-to-end. Backend saat audit **belum** memiliki persistence atau API bisnis; jangan menyatakan mockup sebagai implementasi produksi.

## Urutan baca

`01` fakta repo dan gap → `02` aturan domain → `03` model dan migrasi → `04` backend → `05` API → `06` UX/frontend → `07` cash flow → `08` cancellation/refund → `09` keamanan → `10` acceptance → `11` fase → `12` guardrails → `13` checklist → `14` diagram.

## Hirarki sumber keputusan

Instruksi pengguna dalam tugas ini dan koreksi terbarunya > instruksi repo `CLAUDE.md`/AGENTS yang berlaku dan kode/kontrak runtime aktual > dokumen historis di `docs/` > contoh dalam paket ini. Bila repo berubah, catat delta dengan bukti file dan perbarui paket/checklist sebelum coding. Dokumen historis di `docs/mockup-design-decisions.md` berisi keputusan *mockup* yang bisa berbeda dari arah baru; jangan menjadikannya larangan absolut untuk merombak finance.

## Definition of finished untuk seluruh program

Enam menu bekerja dengan data tersimpan; invoice dan pembayaran customer/vendor, refund dan settlement benar-benar mengubah posisi kas hanya saat actual posting; statement, saldo per rekening, AR/AP, dan proyeksi berdamai secara angka; akses server membatasi aksi dan data; desktop/mobile dan empty/loading/error state teruji; seluruh core flow Project/Booking/Vendor/Client tetap berjalan. Setiap fase mencatat file yang berubah, hasil check, dan risiko tersisa.

## Cara memakai paket

Simpan folder ini di lokasi aman atau salin ke `docs/manova-finance-implementation/` saat menjalankan Claude Code. Jangan menimpa dokumen historis. ZIP berisi semua berkas dalam folder ini. Prompt awal ada di `CLAUDE-CODE-START-PROMPT.md`.
