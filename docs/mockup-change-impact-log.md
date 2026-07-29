# Mockup Change Impact Log — MANOVA

Log **append-only**, wajib diperbarui setiap kali sebuah section mengubah hasil section sebelumnya, sesuai `prompts/01-PROTOKOL WAJIB — CONTINUITY, DOKUMENTASI PER SECTION, DAN PERLINDUNGAN HASIL.md` bagian A dan C. Histori lama tidak dihapus atau ditimpa.

Setiap entri wajib memuat: Change ID dan tanggal · Triggering section · Previous section affected · Alasan perubahan · Files affected · Previous behavior dan new behavior · Risk · Regression checks · Dokumentasi yang diperbarui.

---

## CI-001 — Eksekusi Penghapusan `AIAssistant.vue` sesuai Keputusan D-023

- **Change ID / Tanggal:** CI-001 · 2026-07-29
- **Triggering section:** Section 05 — Bersihkan Template dan Siapkan Foundation (eksekusi kode).
- **Previous section affected:** Section 03 — Information Architecture, Route, Role, dan Workflow (pemilik keputusan D-023: "penghapusan fisik `dashboard/AIAssistant.vue` menunggu tahap cleanup Prompt 5, tidak dieksekusi sekarang").
- **Alasan perubahan:** Section 03 secara eksplisit menunda eksekusi fisik keputusan ke Section 05 (keputusan itu sendiri murni dokumentasi, tidak mengubah kode). Section 05 adalah section pertama yang benar-benar mengeksekusi keputusan tersebut sebagai perubahan kode.
- **Files affected:** `app/components/dashboard/AIAssistant.vue` (dihapus), `app/pages/index.vue` (satu-satunya pemanggil komponen ini, ditulis ulang total pada Section 05 sehingga referensi lama otomatis tidak ada).
- **Previous behavior:** Dashboard lama merender `AIAssistant.vue` sebagai widget statis tanpa mapping domain MANOVA apa pun.
- **New behavior:** Dashboard baru (Section 05) tidak lagi memiliki widget AI Assistant; seluruh widget berbasis fixture domain MANOVA (opportunity, project, invoice, activity).
- **Risk:** Rendah — dependency check (`grep` lintas `app/`) mengonfirmasi hanya `pages/index.vue` lama yang merender komponen ini, dan halaman tersebut sudah ditulis ulang total pada section yang sama sehingga tidak ada pemanggil yang tertinggal.
- **Regression checks:** `npm run build` sukses setelah penghapusan (dijalankan 3x pada Section 05); smoke test manual route `/` menunjukkan HTTP 200 tanpa error konsol terkait komponen hilang.
- **Dokumentasi yang diperbarui:** `docs/mockup-progress.md` (Entri 6), `docs/mockup-design-decisions.md` (D-023, status tetap LOCKED, catatan eksekusi ditambahkan), `docs/mockup-section-reports/section-05-foundation.md`.

---

*(Belum ada entri lain. Section 06 ke atas belum dieksekusi pada saat dokumen ini ditulis, sehingga belum ada perubahan lintas-section terhadap hasil Section 05 yang perlu dicatat. Entri berikutnya akan ditambahkan begitu sebuah section mengubah hasil section sebelumnya — lihat protokol bagian C untuk kriteria kapan perubahan section lama diperbolehkan.)*
