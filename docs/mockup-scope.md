# Mockup Scope — MANOVA (Prompt 2, diperbarui di Prompt 3)

Status dokumen: **belum ada implementasi**. Scope awal disusun di Prompt 2 (hasil gap analysis); route/IA/role final sudah dikunci di Prompt 3 (`docs/mockup-information-architecture.md`, `docs/route-and-role-matrix.md`) dan tercermin di update bagian 3–4 dokumen ini.

---

## 1. Tujuan Dokumen

Menentukan apa yang termasuk dan tidak termasuk dalam fase "mockup" MANOVA saat ini, berdasarkan hasil audit (Prompt 1) dan gap analysis (Prompt 2 — `docs/template-reuse-mapping.md`). Dokumen ini menjawab "apa yang sedang kita bangun" secara garis besar; detail rute/role/workflow menyusul di Prompt 3.

## 2. Dalam Scope (In Scope)

Berdasarkan domain mapping di `docs/template-reuse-mapping.md` bagian B & I, mockup MANOVA mencakup 10 area kerja berikut, dikerjakan bertahap sesuai urutan phasing:

1. **Foundation** — sentralisasi data/tipe, formatter IDR & tanggal, status-badge terpusat, primitive `ui/tabs`, perbaikan bug fungsional (`handleDelete`), resolusi duplikasi `cn()`.
2. **CRM** — Prospects, Clients (dua filtered-view dari satu master `Party`), Opportunities, Quotations, dengan Contacts & Activities sebagai tab di Party Detail (`docs/mockup-information-architecture.md` bagian 3.2).
3. **Opportunity to Project** — alur Opportunity Won → Project otomatis (LOCKED) dengan model approval dua-langkah Sales→Management/Super Admin (`docs/route-and-role-matrix.md` bagian 2).
4. **Project Management** — Project list (`/projects`), Project Detail dengan **8 tab final**: Overview, Itinerary & Services, Travelers, Vendors, Finance, Tasks, Documents, Activity & Changes (`docs/mockup-information-architecture.md` bagian 4), Edit project.
5. **Vendor** — Direktori Vendor top-level (`/vendors`) + tab "Vendors" kontekstual di Project Detail.
6. **Finance** — Invoices, Payments top-level (`/finance/...`); Budget/Cost/Outstanding melebur sebagai bagian tab "Finance" di Project Detail (bukan halaman top-level terpisah).
7. **Reporting** — Dashboard lintas-domain final (widget kondisional per role) + halaman `/reports` (Sales Pipeline/Project Performance/Cost and Margin/Finance Summary sebagai section dalam satu halaman).
8. **Administration** — Master Data, Users, Roles and Permissions, Audit Trail (`/admin/...`).

**Catatan perubahan dari Prompt 2:** Operations dan Traveler **tidak lagi jadi phase dengan menu top-level sendiri** — isinya melebur menjadi tab "Itinerary & Services" dan "Travelers" di dalam Project Detail (phase Project Management), hasil resolusi Q3 di `docs/mockup-open-questions.md`.

**Skenario data demo wajib (Prompt 0-G, isi data belum dibangun — ini scope implementasi, bukan scope dokumentasi):**
- Normal Project.
- High-Change Project.
- Complex Project.

Ketiganya harus tercermin secara konsisten di seluruh modul di atas (bukan hanya di halaman Project), memakai satu sumber data terpusat.

## 3. Di Luar Scope Fase Mockup Saat Ini

- Backend/API nyata, integrasi airline/hotel/payment gateway/WhatsApp/vendor API — dilarang eksplisit oleh Prompt 0 dan tidak menjadi bagian scope kapan pun selama fase mockup frontend ini berlangsung.
- Autentikasi/keamanan produksi nyata (mock `localStorage` saat ini dipertahankan sebagai mock, bukan diperkuat jadi auth nyata).
- Granular permission per-field — Prompt 0-E eksplisit meminta struktur role/permission yang *scalable dan terdokumentasi*, bukan seluruh permission granular dibangun sekaligus di awal.
- Fitur B2C penuh — sistem harus *cukup umum* untuk mengakomodasi B2C di masa depan (Prompt 0-A), tapi fase mockup ini fokus B2B; tidak ada halaman/alur khusus B2C yang dibangun sekarang.
- Lint/typecheck/test tooling baru (eslint, vue-tsc, dll.) — pemasangan tooling baru menunggu keputusan eksplisit di luar batasan "jangan memasang package" tahap ini.

## 4. Kandidat yang Sudah Diputuskan di Prompt 3 (dulunya terbuka di Prompt 2)

Seluruh 6 kandidat berikut sudah diresolusi di Prompt 3 — lihat `docs/mockup-open-questions.md` (ditandai `[RESOLVED]`) dan `docs/mockup-design-decisions.md` (entri #18–#23) untuk detail lengkap:
- `Tasks` tidak lagi top-level, melebur jadi tab "Tasks" di Project Detail.
- `Operations` dan `Travelers` tidak jadi top-level, melebur jadi tab "Itinerary & Services" dan "Travelers" di Project Detail; `Vendors` tetap top-level.
- Wizard `/projects/create` direpurpose jadi konfirmasi otomatis setelah Opportunity Won, bukan entry point manual mandiri.
- `Settings` dipertahankan skema minimal, diakses lewat popover profil, bukan item sidebar utama.
- 9 dead link sidebar lama sudah punya tujuan final masing-masing (`docs/route-and-role-matrix.md` bagian 1.8).

**Masih terbuka (belum diputuskan, bukan scope Prompt 3):** lihat Q7–Q9 di `docs/mockup-open-questions.md` — adopsi `vee-validate`+`zod`, kelengkapan tooling lint/typecheck/test, dan nilai threshold numerik untuk attention condition/approval berjenjang. Ketiganya relevan untuk tahap implementasi, bukan tahap IA/route/role.

## 5. Prinsip Pembatas Scope

Mengikuti Prompt 0 bagian H dan Prompt 2 bagian J:
- Tidak menginstal library baru sebelum memastikan library existing tidak cukup.
- Tidak menduplikasi komponen yang sudah tersedia.
- Tidak menghapus file sebelum mapping dan dokumentasi selesai (dokumen ini bagian dari proses tsb, belum berarti "selesai" untuk eksekusi).
- Tidak membuat route/menu tanpa source of truth — seluruh IA final ditentukan di Prompt 3, bukan diasumsikan dari daftar acuan Prompt 2 begitu saja.
