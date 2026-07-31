# Section Report — Section 03: Public Lead Intake

**Status:** COMPLETED

Dikerjakan berdasarkan `prompts/Section 03 — Public Lead Intake.md`, dijalankan lewat `prompts/99-RUN-CURRENT-SECTION.md` atas perintah user. Section keempat roadmap Section 00–24 baru, dijalankan setelah Section 02 (Role, Access dan Navigation, COMPLETED).

---

## 1. Section Objective dan Scope

"Implementasikan public lead intake frontend." Wajib: form publik Corporate Travel/Group Travel/Individual/MICE; form awal sederhana (contact name, company opsional, source, phone/email); consent checkbox + privacy copy mock; UTM/source/referrer preview; validation, duplicate suggestion, success/error; submission masuk ke centralized Lead state; confirmation reference mock; publik tidak mendapat dashboard internal; internal Sales melihat lead baru. Acceptance: Lead public dapat ditelusuri ke Lead list dan Lead Source Recap.

## 2. Source Documents yang Dibaca

`prompts/Section 03 — Public Lead Intake.md`, `prompts/01-PROTOKOL-WAJIB.md`, `prompts/99-RUN-CURRENT-SECTION.md`, `CLAUDE.md`, seluruh `docs/mockup-*.md`, `docs/frontend-*.md`, `docs/mockup-section-reports/section-00-*.md`/`section-01-*.md`/`section-02-*.md`, source code aktual (`app/types/lead.ts`, `app/data/index.ts` — `createLead`/`updateLeadQualification`/`getLeadMissingQualification`, `app/pages/login.vue`, `app/pages/customer-journey/leads/index.vue`, `app/components/shared/ErrorState.vue`, `app/components/ui/checkbox/*`), `git status`.

## 3. Existing Implementation yang Diperiksa

Audit mengonfirmasi seluruh Lead saat ini dibuat internal oleh Sales lewat dialog "New Lead" di `/customer-journey/leads` (halaman ter-autentikasi) — tidak ada satu pun jalur publik tanpa login. `Lead`/`LeadServiceCategory`/`LeadSource` (type) dan `createLead`/`updateLeadQualification` (mutator, Prompt 20) sudah lengkap secara struktural untuk menampung seluruh field yang diminta Section 03 (nama, company, source, phone, email, serviceCategory, destination, travelerEstimate, requirementSummary, qualificationNotes) — tidak perlu perubahan type/mutator apa pun. `ErrorState.vue` (ditemukan Section 01, belum pernah dipakai) cocok dipakai di sini sebagai state error pertama yang benar-benar reachable oleh user. `Checkbox.vue` (shadcn primitive) sudah dipakai di 2 halaman lain dengan pola `v-model` yang konsisten.

## 4. Decisions yang Digunakan

D-060 (`docs/mockup-design-decisions.md`, baru) — route tunggal `/lead-intake` dengan selector 4 kategori (bukan 4 route terpisah), owner default `USR-001`, reuse penuh `createLead`+`updateLeadQualification` tanpa mutator/field baru.

## 5. Implementation Summary dan User Flow

`app/pages/lead-intake/index.vue` (baru) — `definePageMeta({ layout: false })`, tanpa `middleware: 'auth'`:
1. User membuka `/lead-intake` (opsional `?type=<kategori>&utm_source=...&utm_medium=...&utm_campaign=...` dari kampanye pemasaran mock).
2. Memilih/melihat kategori terpilih (Corporate Travel/Group Travel/Individual Travel/MICE — Event) via 4 pill button; copy/label field menyesuaikan.
3. Mengisi Nama Kontak (wajib), Company (opsional), Telepon/Email (minimal satu), opsional Destinasi/Perkiraan Traveler/Ceritakan Kebutuhan, memilih "Bagaimana Anda mengetahui MANOVA?" (pre-terisi otomatis dari `utm_source` bila ada, dapat diubah manual).
4. Melihat panel "Data Kunjungan (Preview)" — transparansi UTM/referrer yang terdeteksi.
5. Bila telepon/email cocok dengan Lead existing, muncul info non-blocking (duplicate suggestion) — tetap boleh submit.
6. Mencentang consent (wajib), opsional membuka ringkasan kebijakan privasi mock.
7. Klik "Kirim Permintaan" — validasi dijalankan; bila ada yang kurang, warning list muncul (Nama Kontak/kontak minimal satu/consent) tanpa submit.
8. Bila valid: `createLead()` dipanggil (field dasar, `ownerId: 'USR-001'`), lalu `updateLeadQualification()` (field tambahan + `qualificationNotes` berisi ringkasan tracking UTM/referrer) — Lead baru langsung ada di `LEADS` centralized state.
9. Tampil state sukses: nomor referensi (`Lead.id`, mis. `LED-011`) + tombol "Ajukan Permintaan Baru" (reset form).
10. Internal Sales yang membuka `/customer-journey/leads` melihat Lead baru ini apa adanya (stage `new`, owner `USR-001`) — tanpa wiring tambahan, karena satu sumber data yang sama.

## 6. Routes

`/lead-intake` (baru, publik). `/login` (+link discoverability, tidak ada perubahan logic).

## 7. Files Created, Changed, dan Removed

**Created:**
- `app/pages/lead-intake/index.vue`
- `docs/mockup-section-reports/section-03-public-lead-intake.md` (laporan ini)

**Changed:**
- `app/pages/login.vue` (+1 paragraf link `NuxtLink` ke `/lead-intake`)
- `docs/mockup-design-decisions.md` (+D-060)
- `docs/mockup-open-questions.md` (Q15 → RESOLVED)
- `docs/mockup-change-impact-log.md` (+CI-032)
- `docs/frontend-module-map.md`, `docs/frontend-workflow-map.md`, `docs/frontend-implementation-roadmap.md`, `docs/frontend-known-issues.md`
- `docs/mockup-implementation-state.md`, `docs/mockup-progress.md`, `docs/mockup-section-progress.md`
- `docs/mockup-section-reports/README.md`

**Removed:** Tidak ada.

## 8. Components Reused/Created

Reused sepenuhnya: `Input`, `Label`, `Button`, `Checkbox`, `ErrorState` (pemakaian pertama sejak Foundation). Tidak ada shared component baru.

## 9. Types/Constants/Fixtures/Mock State

**Tidak ada perubahan** — `Lead`, `LeadServiceCategory`, `LeadSource`, `LEAD_SOURCES`, `LEAD_SERVICE_CATEGORIES`, `createLead`, `updateLeadQualification` seluruhnya reuse apa adanya dari Prompt 20.

## 10. Responsive Behavior

Layout kartu terpusat (`max-w-2xl`, grid 1 kolom di mobile → 2 kolom untuk field Telepon/Email di `sm:` ke atas) — pola identik `/login` (sudah responsive, dipertahankan).

## 11. States (Loading/Empty/Error/Unauthorized/Not-Found)

- **Validation state** — warning list muncul HANYA setelah percobaan submit pertama (`hasAttemptedSubmit`), tidak mengganggu user saat mengisi form pertama kali.
- **Duplicate suggestion state** — info non-blocking, computed reaktif terhadap perubahan telepon/email.
- **Success state** — kartu konfirmasi dengan nomor referensi.
- **Error state** — `ErrorState.vue` dengan `retryable`, tombol retry mengembalikan ke form (tidak kehilangan data yang sudah diisi, karena hanya `viewState` yang berubah, bukan reset field).
- Tidak ada state "unauthorized"/"not-found" — halaman ini memang publik, tidak ada middleware yang bisa memblokir.

## 12. Role Behavior

Tidak ada perubahan role/permission. Halaman ini TIDAK memeriksa role sama sekali (publik, sebelum login) — konsisten Wajib "Public tidak mendapat dashboard internal" (tidak ada `RoleAccessState`, tidak ada `usePermissions()` dipanggil).

## 13. Validation Commands dan Hasilnya

- `npx nuxi prepare` — **sukses**.
- `npm run build` — **sukses**, chunk `lead-intake-*` baru ter-compile.
- `npx vitest run` — "No test files found" (pre-existing, Q8).
- **Smoke test HTTP** — `/`, `/login`, `/lead-intake` (termasuk dengan query `?type=mice-event&utm_source=instagram&utm_medium=cpc&utm_campaign=demo`), `/customer-journey/leads`, `/customer-journey/lead-sources`, + 13 route existing representatif (CRM/Projects/Vendors/Finance/Reports/Admin/Activity Center/Supplier/Client/Settings) — **seluruhnya HTTP 200**, tidak ada string "Internal Server Error"/"TypeError"/"is not defined" di HTML manapun.
- **Smoke test konten** — `/lead-intake?type=mice-event` menampilkan "MICE / Event" dan "Corporate Travel" (label kategori) sesuai preset query; `/login` menampilkan teks "Isi form di sini".
- **Verifikasi interaktif** (isi form lengkap, klik "Kirim Permintaan", cek Lead baru muncul di `/customer-journey/leads` dan angka di `/customer-journey/lead-sources` bertambah) **tidak dilakukan headless** — keterbatasan tooling konsisten sejak Section 06 lama. Dimitigasi lewat code review: `createLead`/`updateLeadQualification` adalah mutator YANG SAMA PERSIS dan TIDAK DIUBAH dari yang sudah divalidasi end-to-end di Prompt 20 (dipanggil dengan pola argumen identik dengan `submitCreate()` di `/customer-journey/leads/index.vue`), sehingga korespondensi perilakunya terjamin oleh kesamaan kode, bukan asumsi.

## 14. Regression

`app/pages/login.vue` (baseline Foundation, belum pernah disentuh section manapun) disentuh secara aditif murni (CI-032, 1 paragraf) — form login/logic autentikasi mock tidak diubah. Tidak ada route/halaman lain yang tersentuh. 13 route existing representatif diverifikasi tetap HTTP 200.

## 15. Cross-Section Impact

`docs/mockup-change-impact-log.md` CI-032 (`/login`, baseline Foundation) — aditif murni, regression-tested, tidak mengubah perilaku form login.

## 16. Known Issues dan Deferred Work

- Merge-duplicate PENUH (menggabungkan 2 Lead record) tetap tanggung jawab Section 04 — Section 03 hanya menampilkan sinyal/preview non-blocking saat intake.
- Distribusi/assignment otomatis Lead publik ke Sales tertentu (di luar default `USR-001`) tidak diimplementasikan — dicatat sebagai simplifikasi eksplisit (D-060), bukan gap tersembunyi.
- Verifikasi interaktif submit form tidak dilakukan headless (keterbatasan tooling, konsisten sejak Section 06 lama).
- Q8 (tooling) tetap terbuka, tidak berubah.

## 17. Protection Notes untuk Section Berikutnya

Section 04 (Sales Leads dan Qualification) dapat menambahkan mekanisme merge-duplicate PENUH di atas sinyal `duplicateMatch` yang pola-nya sudah ada di `/lead-intake` (silakan reuse pola pencarian phone/email yang sama, jangan buat mekanisme deteksi duplikat paralel). Jangan mengubah `createLead`/`updateLeadQualification` tanpa memeriksa dampaknya ke `/lead-intake` (konsumen baru mutator ini sejak Section 03).

## 18. Review URLs

Tidak ada deployment publik. Untuk review lokal: `npm run dev`, buka `http://localhost:8080/lead-intake` (coba juga `http://localhost:8080/lead-intake?type=mice-event&utm_source=instagram&utm_medium=cpc&utm_campaign=demo1` untuk melihat preview UTM), isi dan kirim form, lalu login sebagai Sales dan buka `/customer-journey/leads` untuk melihat Lead baru serta `/customer-journey/lead-sources` untuk melihat angka bertambah.

## 19. Recommended Next Section

**Section 04 — Sales Leads dan Qualification**, berbasis dependency (`docs/frontend-implementation-roadmap.md`) — menunggu perintah eksplisit user.
