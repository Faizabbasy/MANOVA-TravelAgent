Protokol ini berlaku untuk seluruh Prompt 0 sampai Prompt 18.

A. Source of truth continuity

Claude wajib membuat dan memelihara:

docs/mockup-implementation-state.md

docs/mockup-section-progress.md

docs/mockup-change-impact-log.md

docs/mockup-section-reports/README.md

docs/mockup-section-reports/section-XX-<section-name>.md

docs/mockup-implementation-state.md

Dokumen kondisi implementasi terkini. Wajib berisi:

Current phase dan current section.

Last completed section.

Route aktif, selesai, in-progress, dan deferred.

Component shared dan domain yang sudah tersedia.

Types, constants, fixtures, mock state, dan role behavior yang sudah aktif.

Area hasil section lama yang harus dilindungi.

Known issues dan validation status.

Next recommended section.

Last updated date dan section updater.

docs/mockup-section-progress.md

Log append-only. Setiap entry wajib memiliki:

Section ID dan nama.

Tanggal.

Status: NOT_STARTED, IN_PROGRESS, COMPLETED, BLOCKED, NEEDS_REVIEW, atau DEFERRED.

Scope dan completed items.

Files created, changed, dan removed.

Routes affected.

Components reused dan created.

Data/types/constants affected.

Validation results.

Known issues.

Cross-section impact.

Next action.

Histori lama tidak boleh dihapus atau ditimpa.

docs/mockup-change-impact-log.md

Wajib diperbarui bila task baru mengubah hasil section sebelumnya. Setiap entry berisi:

Change ID dan tanggal.

Triggering section.

Previous section affected.

Alasan perubahan.

Files affected.

Previous behavior dan new behavior.

Risk.

Regression checks.

Dokumentasi yang diperbarui.

Laporan per section

Gunakan file seperti:

docs/mockup-section-reports/section-06-dashboard.md

docs/mockup-section-reports/section-07-crm-party.md

docs/mockup-section-reports/section-08-opportunity-quotation.md

Isi minimum:

Section objective dan scope.

Source documents yang dibaca.

Existing implementation yang diperiksa.

Decisions yang digunakan.

Implementation summary dan user flow.

Routes.

Files created, changed, dan removed.

Components reused dan created.

Types, constants, fixtures, dan mock state.

Responsive behavior.

Loading, empty, error, not-found, dan unauthorized states.

Role behavior.

Validation commands dan hasilnya.

Regression checks.

Cross-section impact.

Review URLs.

Known issues dan deferred work.

Protection notes untuk section berikutnya.

Recommended next section.

B. Pre-execution reading protocol

Sebelum mengerjakan setiap section, Claude wajib membaca secara lengkap:

File prompt section yang akan dieksekusi.

CLAUDE.md.

Seluruh dokumen source of truth pada folder docs.

docs/mockup-implementation-state.md.

docs/mockup-section-progress.md.

docs/mockup-change-impact-log.md.

Laporan section sebelumnya pada docs/mockup-section-reports/.

Source code aktual yang berhubungan dengan section baru.

git status dan perubahan yang belum di-commit.

Claude tidak boleh hanya mengandalkan percakapan. Codebase dan dokumentasi repository adalah source of truth.

C. Perlindungan hasil section sebelumnya

Saat mengerjakan section baru:

Jangan rewrite section yang sudah COMPLETED.

Jangan mengubah route, UI, flow, data, atau component section lama hanya untuk merapikan kode.

Jangan melakukan refactor global di luar scope.

Jangan mengganti shared component bila berisiko merusak halaman selesai.

Jangan menghapus fixture, type, constant, helper, atau asset yang masih digunakan.

Jangan mengubah terminology, route, role, atau keputusan berstatus LOCKED.

Jangan menyentuh perubahan user yang tidak terkait.

Jangan reset, checkout, stash, atau revert perubahan user.

Section lama hanya boleh diubah bila:

Dibutuhkan untuk integrasi section baru.

Memperbaiki bug nyata.

Menjaga konsistensi shared component.

Menyelesaikan build, typecheck, test, atau regression issue.

Diminta secara eksplisit oleh user.

Bila perlu mengubah section lama:

Lakukan perubahan paling minimal.

Catat pada docs/mockup-change-impact-log.md.

Update laporan section lama bila kondisi faktual berubah.

Jalankan regression check pada area terdampak.

Jelaskan perubahan tersebut di laporan akhir.

D. Section ownership

Setiap laporan section wajib mencatat ownership:

Route dan page component milik section.

Domain components yang dibuat.

Shared components yang digunakan atau diperluas.

Fixtures, types, constants, dan composables yang dibuat atau diperluas.

Perubahan lintas ownership wajib dicatat sebagai cross-section impact.

E. Aturan implementasi incremental

Setiap section harus:

Memulai dari codebase aktual.

Menggunakan foundation, fixtures, types, constants, route, role, dan shared components yang sudah ada.

Tidak membuat dataset paralel.

Menambah variant daripada menduplikasi component tanpa alasan.

Menjaga responsive behavior.

Menyediakan state yang relevan.

Menjaga format Rupiah dan tanggal.

Menjaga role visibility.

Tetap frontend-only dengan mock data.

Menjalankan validasi setelah implementasi.

Memperbarui dokumentasi sebelum menyatakan selesai.

Claude tidak boleh memberi status COMPLETED bila route utama belum berjalan, validasi gagal akibat perubahan section, acceptance criteria belum terpenuhi, atau laporan section belum diperbarui. Gunakan NEEDS_REVIEW bila implementasi selesai tetapi masih membutuhkan review visual user.

F. Post-execution documentation protocol

Sebelum laporan akhir, Claude wajib:

Update docs/mockup-implementation-state.md.

Append docs/mockup-section-progress.md.

Buat/update laporan section.

Update docs/mockup-change-impact-log.md bila diperlukan.

Update dokumen domain lain bila keputusan, route, role, scope, atau data scenario berubah.

Re-read dokumentasi yang baru diubah untuk memastikan benar-benar tersimpan.

G. Format laporan akhir section

Laporan akhir wajib memuat:

Section dan status.

Scope.

Source docs yang dibaca.

Files created, changed, removed.

Routes implemented.

Components reused dan created.

Data/types/constants affected.

Role behavior.

States implemented.

Validation dan regression results.

Cross-section changes.

Dokumentasi yang diperbarui.

Known issues.

Review URLs.

Next recommended section.

Setelah laporan, berhenti. Jangan lanjut ke section berikutnya tanpa perintah user.

H. Perintah standar menjalankan setiap prompt

Baca file prompt berikut secara lengkap:

`prompts/<NAMA_FILE>.md`

Sebelum mengerjakan:
1. Ikuti PROTOKOL WAJIB continuity dan dokumentasi per section.
2. Baca seluruh source-of-truth docs dan laporan section sebelumnya.
3. Periksa git status dan codebase aktual.
4. Jangan mengubah hasil section lama kecuali benar-benar dibutuhkan.
5. Bila perubahan lintas section diperlukan, lakukan minimal, catat impact, dan regression-test area terkait.

Kerjakan hanya scope prompt tersebut.

Setelah selesai:
- Jalankan seluruh validasi yang tersedia.
- Update implementation state, progress log, change impact log bila diperlukan, dan laporan section.
- Re-read dokumentasi yang baru diubah.
- Berikan laporan akhir.
- Berhenti dan jangan lanjut ke section berikutnya tanpa perintah saya.