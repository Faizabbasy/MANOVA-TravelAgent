# Mockup Open Questions — MANOVA

Status dokumen: daftar kumulatif pertanyaan yang belum bisa dijawab tanpa keputusan/konfirmasi user. Entri tidak dihapus setelah terjawab — ditandai **[RESOLVED — lihat entri terkait di `docs/mockup-design-decisions.md`]** dan alasan resolusinya, bukan dihapus dari daftar.

Setiap entri mengikuti format: pertanyaan, konteks/kenapa ini terbuka, opsi yang teridentifikasi, dampak bila tidak diputuskan.

---

## Dari Prompt 2 (Gap Analysis)

### Q1. Apa fungsi final wizard `/projects/create` terhadap alur LOCKED "Opportunity Won → Project otomatis"? **[RESOLVED — lihat entri #18 di `docs/mockup-design-decisions.md`]**
- **Resolusi (Prompt 3):** dipilih opsi 2 — wizard direpurpose jadi bagian tampilan konfirmasi/setup awal Project yang muncul otomatis setelah Opportunity di-approve Won, bukan lagi entry point mandiri "buat project manual". Detail: `docs/route-and-role-matrix.md` bagian 2.
- **Konteks:** Prompt 0 mengunci bahwa Project otomatis terbentuk dari Opportunity yang Won. Tapi template existing punya wizard 3-langkah manual `pages/projects/create.vue` yang lengkap (validasi, step indicator) untuk *membuat project dari nol*, tanpa melalui Opportunity.
- **Opsi yang teridentifikasi:**
  1. Wizard ini dihapus/tidak dipakai — Project hanya bisa lahir dari Opportunity Won.
  2. Wizard ini direpurpose jadi bagian dari alur "Opportunity Won" (mis. step konfirmasi/setup awal Project setelah Won ditekan), bukan entry point independen.
  3. Wizard ini dipertahankan sebagai jalur manual sekunder untuk kasus tertentu (mis. project non-CRM, migrasi data), dengan pembatasan role.
- **Dampak bila tidak diputuskan:** risiko membangun/mempertahankan alur yang bertentangan dengan baseline bisnis LOCKED, atau menghapus komponen yang sebenarnya masih relevan.

### Q2. Apakah `/tasks` (top-level) tetap dipertahankan terpisah dari Kanban tab di Project Workspace (`/projects/:id`)? **[RESOLVED — lihat entri #19 di `docs/mockup-design-decisions.md`]**
- **Resolusi (Prompt 3):** dipilih opsi 2 — `/tasks` tidak lagi jadi menu top-level, task dikelola dalam tab "Tasks" di Project Detail; visibilitas lintas-project cukup lewat widget dashboard.
- **Konteks:** Keduanya sama-sama merepresentasikan "task", dengan shape data yang saat ini berbeda (`id: number` di `/tasks` vs `id: 'T-01'` di Project Workspace). Prompt 0 menyebut "Operational task" sebagai bagian domain Operations, tapi tidak menegaskan apakah ini cross-project atau strictly per-project.
- **Opsi yang teridentifikasi:**
  1. `/tasks` jadi cross-project operational task list (agregasi dari semua project), Kanban tab tetap per-project view dari data yang sama.
  2. `/tasks` dilebur/dihapus sebagai menu top-level, task hanya dikelola dalam konteks per-project (Kanban tab).
  3. `/tasks` dan Kanban tab sengaja dipisahkan sebagai dua konsep berbeda (mis. task administratif umum vs task operasional project).
- **Dampak bila tidak diputuskan:** duplikasi konsep/data source, kebingungan IA saat demo (dua tempat menunjukkan "task" dengan data yang bisa saling tidak sinkron).

### Q3. Apakah Operations dan Travelers menjadi menu top-level tersendiri, atau cukup sub-tab di dalam Project Workspace? **[RESOLVED — lihat entri #20 di `docs/mockup-design-decisions.md`]**
- **Resolusi (Prompt 3):** dipilih opsi 1 untuk keduanya — tetap sub-tab di Project Detail untuk fase mockup awal (Operations→tab "Itinerary & Services", Travelers→tab "Travelers"). Vendor **tidak** mengikuti pola ini, tetap jadi menu top-level karena karakteristik lintas-project yang berbeda. Opsi 2/3 dicatat sebagai kemungkinan evolusi (`docs/mockup-design-decisions.md` entri #33), bukan dipilih sekarang.
- **Konteks:** Prompt 2 bagian F secara eksplisit meminta "jangan membuat semua item hanya karena tersedia dalam daftar" dan "hindari menu kosong". Domain Operations (itinerary/flight/hotel/dst.) dan Traveler pada dasarnya selalu terikat konteks satu project tertentu, bukan entitas yang natural untuk dilihat lintas-project di awal fase mockup.
- **Opsi yang teridentifikasi:**
  1. Keduanya tetap sub-tab di Project Workspace saja untuk fase mockup awal, menu top-level ditunda ke fase lanjut (bila ada kebutuhan lintas-project, mis. "semua traveler yang belum lengkap dokumennya di semua project").
  2. Keduanya dijadikan menu top-level sejak awal untuk mendukung tampilan agregat lintas-project (mis. direktori Traveler, direktori Vendor booking).
  3. Hybrid — salah satu (mis. Travelers) jadi menu top-level lebih dulu karena kebutuhan agregasi lebih jelas (Prompt 0-F menyebut "upcoming departure" yang perlu data traveler lintas project), sementara Operations tetap sub-tab dulu.
- **Dampak bila tidak diputuskan:** risiko membuat menu kosong (melanggar instruksi eksplisit Prompt 2-F) atau sebaliknya kehilangan kebutuhan agregasi yang penting untuk dashboard.

### Q4. Bagaimana nasib final 9 dead link sidebar (`/files`, `/clients`, `/team`, `/time-tracking`, `/reports`, `/invoices`, `/templates`, `/integrations`, `/settings`)? **[RESOLVED — lihat entri #21 di `docs/mockup-design-decisions.md`]**
- **Resolusi (Prompt 3):** `/clients`→`/crm/clients`, `/invoices`→`/finance/invoices`, `/reports`→`/reports`, `/files`→tab Documents Project Detail, `/team`→`/admin/users`+info tim Overview, `/time-tracking`/`/templates`/`/integrations`→excluded. `/settings` diresolusi terpisah di Q5.
- **Konteks:** Detail per-item sudah dianalisis di `docs/template-reuse-mapping.md` bagian G. Beberapa punya mapping domain jelas (`/clients`→CRM, `/invoices`→Finance, `/reports`→Reports), beberapa tidak jelas (`/templates`), dan beberapa bertentangan dengan aturan Prompt 0 (`/integrations`).
- **Opsi yang teridentifikasi:** per-item, lihat tabel di `docs/template-reuse-mapping.md` bagian G untuk rekomendasi awal (aman dihapus / butuh validasi / dilebur jadi tab existing).
- **Dampak bila tidak diputuskan:** dead link tetap ada saat demo, berisiko memberi kesan "banyak fitur belum jadi" (sudah dicatat sebagai risiko di audit Prompt 1 bagian 13).

### Q5. Apakah menu `Settings` dipertahankan, dan bila ya, isi minimal apa yang membuatnya tidak jadi "menu kosong"? **[RESOLVED — lihat entri #22 di `docs/mockup-design-decisions.md`]**
- **Resolusi (Prompt 3):** dipilih opsi 2 dengan penyesuaian — Settings dipertahankan skema minimal (profil/akun pribadi), tapi diakses lewat popover profil user, **bukan** item sidebar utama.
- **Konteks:** Prompt 2 bagian F menyebutkan Settings sebagai opsi "bila memang dibutuhkan". Saat ini satu-satunya jejak konsep Settings adalah tombol "Profile Settings" dekoratif di popover profil `AppSidebar.vue`, yang juga menuju `/settings` yang tidak ada halamannya.
- **Opsi yang teridentifikasi:**
  1. Tidak ada menu Settings di fase mockup awal; tombol "Profile Settings" dihapus/diarahkan ke tempat lain.
  2. Settings dipertahankan dengan isi minimal (mis. preferensi tampilan, info akun) sebagai halaman kecil, bukan menu kosong.
  3. Settings ditunda sepenuhnya ke fase setelah demo readiness.
- **Dampak bila tidak diputuskan:** tombol yang sudah ada di UI (popover profil) akan tetap mati/dead-end bila tidak ada keputusan eksplisit.

### Q6. Apakah `dashboard/AIAssistant.vue` dipertahankan, diberi mapping domain baru, atau dihapus? **[RESOLVED — lihat entri #23 di `docs/mockup-design-decisions.md`]**
- **Resolusi (Prompt 3):** dipilih opsi 1 — tidak dilanjutkan sebagai bagian desain dashboard MANOVA. Penghapusan fisik file tetap ditunda ke tahap cleanup (Prompt 5), sesuai batasan tahap ini.
- **Konteks:** Tidak ada konsep AI assistant di Prompt 0 manapun. Komponen ini statis, tanpa data model, tombol "ask" tanpa handler — tidak mengganggu fungsi lain, tapi juga tidak punya tujuan bisnis yang jelas untuk MANOVA.
- **Opsi yang teridentifikasi:**
  1. Dihapus dari dashboard MANOVA (tidak relevan dengan domain travel agent B2B).
  2. Dipertahankan sebagai placeholder untuk fitur masa depan (mis. AI assistant untuk membantu quotation/itinerary) — tapi ini berarti mengarang scope baru yang tidak diminta Prompt 0, perlu konfirmasi eksplisit user dulu.
- **Dampak bila tidak diputuskan:** komponen tetap nangkring di dashboard tanpa fungsi, atau dihapus prematur padahal user punya rencana untuk itu.

### Q7. Apakah `vee-validate` + `zod` (dependency terpasang, 0% dipakai) akan mulai dipakai untuk form MANOVA baru, atau pola validasi manual existing (seperti di `create.vue`/`edit.vue`) yang dilanjutkan?
- **Konteks:** Diwariskan dari Prompt 1 bagian 10 (unknown and needs validation), relevan langsung untuk gap analysis karena banyak form baru (CRM, Traveler, Vendor, dll.) akan dibangun di fase-fase berikutnya.
- **Opsi yang teridentifikasi:**
  1. Mulai pakai `vee-validate`+`zod` untuk seluruh form baru MANOVA (dependency sudah ada, sesuai prinsip "jangan instal library baru sebelum memastikan yang existing tidak cukup" — justru mendukung pemakaian ini).
  2. Lanjutkan pola manual existing demi konsistensi dengan form lama yang belum di-refactor.
- **Dampak bila tidak diputuskan:** risiko dua pola validasi berbeda hidup berdampingan tanpa alasan yang terdokumentasi.

### Q8. Apakah script `lint`/`typecheck`/`test` akan ditambahkan ke `package.json`, dan apa nasib devDependency mati `@nuxtjs/eslint-config-typescript` (terpasang tanpa `eslint` inti)?
- **Konteks:** Diwariskan dari Prompt 1 bagian 15 (rekomendasi), relevan untuk gap analysis karena Prompt 0 aturan teknis #15 mewajibkan "jalankan lint, typecheck, test, dan build sesuai script yang tersedia setelah mulai melakukan perubahan kode" — tapi script tersebut belum ada.
- **Opsi yang teridentifikasi:**
  1. Lengkapi `eslint` inti + tambah script `lint`, putuskan juga script `typecheck` (catatan: menjalankan `nuxi typecheck` memicu instalasi `vue-tsc` yang belum ada di lockfile — perlu keputusan eksplisit soal instalasi ini sebelum implementasi).
  2. Lepas `@nuxtjs/eslint-config-typescript` sebagai devDependency mati bila memang tidak akan dipakai.
- **Dampak bila tidak diputuskan:** regresi kualitas kode di tahap implementasi tidak akan tertangkap otomatis (dicatat sebagai risiko teknis di audit Prompt 1 bagian 13).

---

## Dari Prompt 3 (Information Architecture, Route, Role, dan Workflow)

### Q9. Berapa nilai ambang batas (threshold) numerik untuk kondisi "attention" project dan untuk kemungkinan approval berjenjang pada alur Won?
- **Konteks:** `docs/route-and-role-matrix.md` bagian 3.3 mendefinisikan kondisi "attention" secara kualitatif (mis. "biaya aktual melewati ambang batas terhadap budget, mis. >90%", "service mendekati tanggal keberangkatan") tapi angka pastinya sengaja belum ditentukan — begitu juga opsi approval berjenjang berdasarkan nilai opportunity (`docs/mockup-design-decisions.md` entri #32) yang butuh angka threshold nyata dari bisnis.
- **Opsi yang teridentifikasi:** angka ditentukan saat implementasi berdasarkan data skenario demo yang akan dibangun (Normal/High-Change/Complex Project), atau dikonfirmasi dulu ke user/stakeholder MANOVA sebelum implementasi.
- **Dampak bila tidak diputuskan:** widget "Attention list" dan opsi approval berjenjang tidak bisa diimplementasikan presisi tanpa asumsi sepihak — untuk versi pertama cukup dipakai heuristik kualitatif di atas, angka pasti menyusul.
