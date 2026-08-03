# Client Role Scope — MANOVA B2B Client Experience

Dibuat oleh **Repair Phase / Section 0 — Audit dan Gap Analysis** (`prompts/repair_phases/PROMPT-SECTION-0.md`), berdasarkan `prompts/repair_phases/MASTER-PROMPT.md`. Dokumen ini adalah source of truth definisi role Client untuk inisiatif "18-Page Client Experience" — **audit only, belum ada implementasi baru pada section ini.**

## 1. Definisi Role

MANOVA hanya punya **satu role eksternal Client** — sudah sesuai dengan implementasi aktual:

- `app/types/user.ts` (`RoleId`) sudah mendaftarkan `'client'` sebagai satu-satunya role eksternal non-vendor.
- `app/constants/roles.ts` (`ROLE_MODULE_ACCESS.client`) — HANYA `'client-portal': 'MANAGE'`, seluruh modul internal lain (`crm`/`project`/`vendor`/`finance`/`reports`/`administration`/`product-planning`/`ticketing`/`accommodation`/`transportation`/`mice`/`procurement`/`bookings`/`changes`/`documents`) bernilai `'NONE'`.
- Tidak ada sub-role (`Client Admin`/`Client PIC`/`Client Approver`/`Client Finance`/`Client Viewer`) di mana pun dalam kode — **sudah sesuai** Master Prompt bagian B.
- `Participant`/`Traveler` (`app/types/activity.ts` / entitas traveler existing) adalah data dalam project, bukan akun login — **sudah sesuai**.

**Kesimpulan:** Tidak ada perubahan diperlukan pada struktur role. Larangan "jangan membuat sub-role/role tambahan" (Master Prompt bagian O) sudah otomatis terpenuhi oleh kondisi kode saat ini.

## 2. Isolasi Data (Scope per Company)

`usePermissions().clientScopeId` (`app/composables/usePermissions.ts:35`) — `clientPartyId` milik user login bila `currentRole === 'client'`, kosong untuk role lain. Pola ini identik `vendorScopeId` untuk Supplier.

Diverifikasi pada 4 halaman Client yang sudah ada:

| Halaman | Isolasi |
|---|---|
| `app/pages/client/index.vue` | Seluruh data (`getOpportunitiesByParty`, `getProjectsByParty`, `getContactsByParty`) di-scope ke `clientScopeId`, tidak pernah membaca array penuh |
| `app/pages/client/opportunities/[id]/index.vue` | `isOwnCompany` computed — `opportunity.partyId === clientScopeId`, selain itu tampil "Tidak Ditemukan" (bukan error/crash) |
| `app/pages/client/project-orders/[id]/index.vue` | `isOwnCompany` computed sama, menggerbangi seluruh 7 tab |
| `app/pages/client/catalog/[requirementId]/index.vue` | `isOwn` computed — `requirement.clientPartyId === clientScopeId` |

## 3. Batasan Data — Sudah Diverifikasi vs Perlu Diaudit Ulang saat Halaman Baru Dibuat

Field yang **TIDAK BOLEH** dirender ke Client (Master Prompt bagian D), status verifikasi pada halaman existing:

| Field internal | Status |
|---|---|
| `discountIdr`/`estimatedCostIdr`/`estimatedMarginIdr`/`markupIdr` (Quotation) | Terverifikasi TIDAK dirender di `client/opportunities/[id]/index.vue` — hanya `amountIdr`/`taxIdr`/`serviceBreakdown` (selling price) |
| `budgetIdr`/`actualCostIdr` (Project) | Tidak direferensikan sama sekali di halaman Client manapun saat ini |
| `operationalImpact`/`commercialImpactIdr`/`financialImpactNote` (ChangeRequest), `severity`/`escalatedTo`/`communicationLog` (Incident) | Terverifikasi TIDAK dirender di tab "Changes & Incidents" `client/project-orders/[id]` (hanya status + before/after summary / resolution note) |
| `costPriceIdr` (Commodity) | Terverifikasi TIDAK dirender di `client/catalog/[requirementId]/index.vue` |
| Data company Client lain | Tidak ada jalur akses — seluruh query di-scope `clientScopeId` |

**Catatan untuk implementasi 18 halaman ke depan:** setiap halaman/route BARU (Travel Requests, Quotations & Proposals, Approval Center, Reservations, Trip Center, Reports & Analytics, dll.) WAJIB diaudit ulang satu per satu terhadap daftar field ini sebelum dianggap selesai — sanitasi tidak otomatis berlaku hanya karena route berada di bawah `/client/**`.

## 4. Akses Route

Middleware saat ini (`app/middleware/auth.ts`) hanya memeriksa status login (`localStorage.isAuthenticated`), **bukan role-per-route** — pembatasan akses per-role dilakukan di level halaman lewat `usePermissions().canView('client-portal')` + `RoleAccessState` (pola konsisten di seluruh 4 halaman Client existing). Rekomendasi Master Prompt "Client hanya dapat mengakses route `/client/**`" sudah tercapai secara struktural (route lain butuh `moduleKey` berbeda yang `client` role tidak punya), namun tidak ada guard eksplisit di middleware — ini konsisten dengan pola seluruh role lain di aplikasi (tidak spesifik ke Client, bukan gap/regresi).

## 5. Larangan yang Wajib Tetap Dijaga

Diambil langsung dari Master Prompt bagian O, dikonfirmasi belum dilanggar oleh kode existing:

- Tidak ada flow B2C (marketplace publik, shopping cart, checkout konsumen) — tidak ditemukan.
- Tidak ada halaman Users & Access khusus Client — tidak ditemukan.
- Super Admin bukan approver komersial normal — tidak berubah oleh apa pun terkait Client role.

## 6. Section 8 — Final QA Sign-off (Data Security Audit)

Audit keamanan data penuh dijalankan terhadap seluruh 39 file `.vue` di `app/pages/client/**`/`app/components/client/**` (grep field internal + spot-check selector `app/data/index.ts` + verifikasi isolasi `clientScopeId` di setiap halaman detail).

**1 temuan CRITICAL, sudah diperbaiki:** `app/pages/client/change-requests/[id]/index.vue` (bagian "Impact Review") merender `commercialImpactIdr`/`cancellationFeeIdr`/`operationalImpact` mentah — bertentangan dengan komentar tipe `ChangeRequest.commercialImpactIdr` sendiri (`app/types/change-incident.ts`: "internal-only, TIDAK boleh terlihat Client... bahkan begitu tetap disanitasi") dan berbeda dari pola sanitasi yang SUDAH BENAR di halaman sejenis (`app/pages/client/approvals/[id]/index.vue`, tab Changes & Incidents `project-orders/[id]/index.vue`). **Diperbaiki**: bagian tsb kini hanya menampilkan pernyataan kualitatif "Dampak finansial telah dihitung..." + `timelineImpactNote` (non-komersial), identik pola `approvals/[id]/index.vue` — nominal `commercialImpactIdr`/`cancellationFeeIdr` dan narasi `operationalImpact` tidak lagi dirender di halaman manapun untuk role `client`.

**Verified safe (tidak ada perubahan diperlukan):** field cost/margin/markup/commission/internal-note pada seluruh halaman Client lain (grep menyeluruh, hanya ditemukan di komentar kode yang justru MENJELASKAN larangan ini, bukan binding template); `getUnifiedActivityTimeline`/`getClientProjectMessages` (internal-note filtering); `getClientReservations` (allow-list eksplisit, tidak ada `netCostIdr`/`sellPriceIdr`/status internal yang lolos); isolasi `clientScopeId`/`isOwnCompany` pada seluruh 12 halaman detail (`[id]`-style) — seluruhnya menampilkan "Tidak Ditemukan" untuk entitas milik company lain, bukan data bocor.

**Kesimpulan Section 8:** setelah perbaikan di atas, TIDAK ADA data internal (cost vendor/margin/markup/internal note/internal approval/internal chat/data company lain) yang dapat diakses role `client` di seluruh 18 halaman + 4 route lama. Definition of Done "Tidak ada data internal bocor" (`prompts/repair_phases/PROMPT-SECTION-8.md`) terpenuhi.
