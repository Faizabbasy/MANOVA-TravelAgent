# Mockup Implementation State — MANOVA

Dokumen kondisi implementasi **terkini** (bukan log kronologis — lihat `docs/mockup-section-progress.md` untuk histori, dan `docs/mockup-progress.md` untuk narasi lengkap Prompt 0–5). Wajib dibaca di awal setiap section baru sesuai `prompts/01-PROTOKOL WAJIB — CONTINUITY, DOKUMENTASI PER SECTION, DAN PERLINDUNGAN HASIL.md` bagian B, dan diperbarui di akhir setiap section sesuai bagian F.

Ditulis berdasarkan pemeriksaan langsung terhadap codebase (`git log`, `git status`, isi file `app/**`) dan hasil validasi yang benar-benar dijalankan ulang pada tanggal update di bawah — bukan disalin buta dari narasi lama.

---

## 1. Current Phase dan Current Section

- **Current phase:** Foundation + Dashboard + CRM Party + Opportunity/Quotation + Opportunity Won to Project selesai. Modul Project Core/Traveler/Itinerary/Vendor/Finance/Reports/Administration (Section 10 ke atas) **belum** dieksekusi.
- **Current section:** Tidak ada section aktif — sistem menunggu perintah user untuk memulai Section 10 (Project Core).
- **Last completed section:** **Section 09 — Opportunity Won to Project** (`prompts/11-PROMPT-9-OPPORTUNITY-WON-TO-PROJECT.md`), status **COMPLETED**. Detail lengkap: `docs/mockup-section-reports/section-09-opportunity-won-to-project.md`.
- Section 08 — Opportunity dan Quotation: COMPLETED, detail `docs/mockup-section-reports/section-08-opportunity-quotation.md`.
- Section 07 — CRM Party: COMPLETED, detail `docs/mockup-section-reports/section-07-crm-party.md`.
- Section 06 — Dashboard: COMPLETED, detail `docs/mockup-section-reports/section-06-dashboard.md`.
- Section 05 — Foundation: COMPLETED, detail `docs/mockup-section-reports/section-05-foundation.md`.
- Section 00–04: dokumentasi murni, COMPLETED, narasi `docs/mockup-progress.md` Entri 1–5.

**Catatan commit:** Section 08 dan 09 belum di-commit oleh user pada saat dokumen ini ditulis (`git log` terakhir menunjuk "Create CRM PARTY" = Section 07) — working tree berisi perubahan Section 08+09 sekaligus. Ini tidak memengaruhi keakuratan dokumen ini (ditulis berdasarkan isi file aktual, bukan asumsi commit).

## 2. Route Inventory (Kondisi Aktual)

Tidak ada route baru Section 09 (semua interaksi terjadi di `/crm/opportunities/[id]` yang sudah ada sejak Section 08, dan hasilnya muncul di `/projects`/`/projects/[id]` yang sudah ada sejak Section 05). Lihat `docs/route-and-role-matrix.md` untuk inventory lengkap — baris `/crm/opportunities/[id]` kini berstatus **selesai (Section 09)**.

## 3. Component Shared dan Domain yang Sudah Tersedia

**Baru (Section 09):**
- `app/composables/useToast.ts` — toast global (state singleton module-level, sama pola dengan `useCurrentUser`), diekstrak dari pola lokal `pages/expenses.vue` yang sejak Section 05 dicatat sebagai "akan direuse".
- `app/components/shared/ToastContainer.vue` — visual overlay toast, dipasang sekali di `app/layouts/dashboard.vue`.

Tidak ada shared component lain yang diubah.

## 4. Types, Constants, Fixtures, Mock State, dan Role Behavior yang Aktif

**Types:**
- `app/types/project.ts` — **`Project` diperluas**: `+sourceQuotationId?` (docs bagian 2.2 checklist item 6, field yang disebut di checklist tapi belum ada di type sejak Foundation).

**Fixtures (`app/data/`):**
- **`projects.ts` — `PROJECTS` kini `reactive()`** (lanjutan pola Section 07/08) — Approve Won mendorong Project baru ke sini.
- **`activity.ts` — `ACTIVITIES` kini `reactive()`** — Approve Won mencatat entri baru ke sini.
- `opportunities.ts` — `OPP-005` dimajukan dari `negotiation` ke `won-requested` (seed, agar section ini demonstrable tanpa klik manual dulu lewat seluruh stage).
- `index.ts` — **selector/mutator baru Section 09**: `getOpportunityMissingRequirements`, `approveOpportunityWon`, `rejectOpportunityWon`, konstanta `DEFAULT_PROJECT_OWNER_ID` (`USR-002`).

**Mock state aktif:** `useToast()` — toast global baru. `canApprove('crm')` (dari `usePermissions()`, sudah ada sejak Section 05, **pertama kali benar-benar dipakai** di Section 09) — gerbang akses Approve/Reject Won (Management/Super Admin).

**Role behavior aktif:** Approve/Reject Won memakai `canApprove('crm')` (module-level, generik — BUKAN pengecualian sempit seperti `canManageParty`/`canManageOpportunity`), karena di sini Management memang HARUS diikutsertakan (perannya sebagai approver final, docs D-025).

## 5. Area Hasil Section Lama yang Harus Dilindungi

- Seluruh shared component, fixture, type, constant — jangan diubah shape-nya tanpa cross-section impact check.
- `app/pages/projects/[id]/index.vue` (shell 8-tab, LOCKED) — **tidak disentuh Section 09**, tapi Project baru hasil konversi akan membuka shell ini apa adanya (tab lain masih placeholder sampai Section 10+).
- **`approveOpportunityWon`/`rejectOpportunityWon` (`app/data/index.ts`) kini menjadi satu-satunya cara sah membuat Project dari Opportunity** — section berikutnya (Project Core dst.) tidak boleh membuat jalur pembuatan Project paralel; `pages/projects/create.vue` (wizard lama) tetap tidak ditautkan navigasi (deferred/excluded, D-018).
- **`useToast`/`ToastContainer` kini shared infrastructure** — section berikutnya yang butuh feedback sukses/gagal harus memakai ini, bukan membuat sistem toast lokal baru (seperti `expenses.vue` lama).
- `DEFAULT_PROJECT_OWNER_ID = 'USR-002'` — keputusan sementara (belum ada alur assignment PM manual); bila Section 10+ membangun assignment PM, pertimbangkan mengganti default ini dengan alur pemilihan nyata.
- `Project.sourceQuotationId` — field baru, section finance (Section 15) kemungkinan akan memakainya untuk menautkan quotation asal ke breakdown budget.

## 6. Known Issues dan Validation Status

Divalidasi ulang langsung pada tanggal update dokumen ini:

| Cek | Hasil | Catatan |
|---|---|---|
| `npx nuxi prepare` | **Sukses** | Setelah penambahan type/fixture/composable/component baru |
| `npm run build` | **Sukses (exit 0)** | |
| Smoke test route (curl, status + konten) | **HTTP 200 dan konten benar** untuk seluruh route regresi (`/`, `/projects`, `/crm/opportunities`, `/crm/opportunities/OPP-001`, `/crm/opportunities/OPP-005`, `/crm/opportunities/OPP-999`, `/crm/parties/PTY-001`, `/crm/parties/PTY-004`, `/crm/prospects`, `/crm/clients`) | `OPP-005` dikonfirmasi menampilkan badge "Won (Menunggu Approval)" dan tombol "Approve Won"/"Reject" untuk user default (Super Admin); `PTY-004` dikonfirmasi masih berstatus "Prospect" (belum di-approve); `/projects` dikonfirmasi masih 3 project (belum ada `PRJ-104`) — seluruhnya kondisi **sebelum** aksi Approve dijalankan |
| `npx vitest run` | **"No test files found", exit code 1** | Pre-existing |
| `npx nuxi typecheck` | **Gagal — `vue-tsc` tidak terpasang** | Q8 belum diselesaikan |
| Lint | **Tidak tersedia** | Q8 belum diselesaikan |
| **Verifikasi fungsional end-to-end Approve Won (klik tombol → project tercipta → redirect)** | **Tidak dapat diverifikasi langsung** | Memerlukan interaksi client-side (klik, dialog, mutasi reaktif) — tidak ada tool browser headless di lingkungan ini. Diverifikasi lewat: (1) code review langsung terhadap `approveOpportunityWon` line-by-line terhadap checklist LOCKED bagian 2.2, (2) build sukses (compiler akan gagal pada type/binding salah), (3) konfirmasi kondisi *sebelum* aksi benar (lihat baris smoke test di atas) |

**Known issues terbuka:**
- **Q8 — Tooling lint/typecheck/test.** Tetap `NEEDS_VALIDATION`. **Lima section berturut-turut** (06, 07, 08, 09) berjalan tanpa validasi otomatis penuh. **Sangat direkomendasikan** diselesaikan sebelum Section 10 — semakin banyak business logic kritis (seperti Won-to-Project ini) yang berjalan tanpa jaring pengaman typecheck/test otomatis.
- Verifikasi interaktif end-to-end Approve Won tidak dapat dilakukan langsung (keterbatasan tooling, lihat tabel di atas) — mitigasi lewat code review ketat.
- Peringatan routing dari Section 08 (bagian 5, section-08 report) tetap berlaku untuk section mendatang.
- Bug `handleDelete` di `app/pages/expenses.vue` — tidak tersentuh.
- Q7, Q9, Q10, Q11 — tidak berubah.

## 7. Next Recommended Section

Section 10 — Project Core (`prompts/12-PROMPT-10-PROJECT-CORE.md`). **Rekomendasi sangat kuat:** selesaikan Q8 sebelum Section 10 — lima section berturut-turut telah menambah business logic tanpa validasi otomatis, dan Section 10 akan langsung bekerja di atas Project (termasuk Project hasil konversi Won yang baru dibangun mekanismenya). Tidak dieksekusi otomatis — menunggu perintah user.

## 8. Last Updated

- **Date:** 2026-07-30
- **Updater:** Section 09 (Opportunity Won to Project) execution, berdasarkan pemeriksaan langsung codebase, build/smoke-test yang benar-benar dijalankan ulang.
