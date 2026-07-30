# Demo Script — MANOVA Travel Agent Mockup

Panduan demo minimal yang menunjukkan seluruh alur bisnis utama MANOVA secara berurutan. Gunakan bersama `docs/mockup-final-route-inventory.md` sebagai referensi route dan `docs/mockup-final-known-issues.md` untuk daftar batasan yang perlu dijelaskan ke audience.

> **Dev server:** `npm run dev` → http://localhost:8080  
> **Login:** Tidak ada auth nyata — cukup klik "Sign In" pada halaman `/login`; username/password diabaikan.

---

## Persiapan Demo

1. Jalankan `npm run dev`.
2. Buka http://localhost:8080 — secara default login sebagai **Admin MANOVA** (Super Admin).
3. Pastikan sidebar terlihat — klik ikon hamburger bila tersembunyi di viewport sempit.

---

## Demo Flow Minimum

### Step 1 — CRM: Prospect → Opportunity → Quotation

**Route:** `/crm/prospects` → `/crm/opportunities` → `/crm/opportunities/[id]`

1. **Prospects:** Buka `/crm/prospects`. Tampilkan daftar party (prospect dan client), fitur pencarian, dan badge status.
2. **Klik party** (mis. "PT Maju Bersama") untuk melihat detail party: info, contacts, activity log, dan peluang (opportunities) terkait.
3. **Opportunities:** Buka `/crm/opportunities`. Tampilkan pipeline dengan badge stage (Qualification → Proposal → Negotiation → Won/Lost). Tunjukkan filter stage dan search.
4. **Opportunity Detail:** Klik salah satu opportunity. Tunjukkan:
   - Detail opportunity dan quotation terkait.
   - Tombol **"Submit Won"** (untuk role Sales pada opportunity yang sudah di-stage `negotiation`).

---

### Step 2 — Won → Project Otomatis

**Route:** `/crm/opportunities/[id]` → `/projects/[id]`

1. Beralih ke role **Sales** via Settings atau Admin > Role Switcher.
2. Buka opportunity yang tepat (mis. OPP-005 atau OPP-006 — masih pada stage terbuka).
3. Klik **"Submit Won"** — status berubah menjadi `won-requested`.
4. Beralih ke role **Management** via Role Switcher.
5. Buka kembali opportunity → tombol **"Approve Won"** tersedia → klik.
6. Konfirmasi pop-up muncul → setujui → Nuxt meredirect ke halaman Project Detail yang otomatis dibuat.

**Poin demo:** Tunjukkan bahwa Project Detail yang baru terbuka sudah berisi data dari opportunity (nama project, client, budget, dll.).

---

### Step 3 — Project Core: Overview & Tab Navigasi

**Route:** `/projects/[id]` (tab Overview, Tasks, Documents)

1. Buka salah satu project demo: **PRJ-101** (Manila — Normal), **PRJ-102** (Abu Dhabi — High-Change), atau **PRJ-103** (Palu MICE — Complex).
2. **Overview tab:** Tunjukkan summary (status, tipe layanan, budget ring-chart, attention indicator bila ada).
3. **Tasks tab:** Tunjukkan daftar tasks per project dengan status (In Progress, Overdue, Not Started, Done).

---

### Step 4 — Traveler & Participant

**Route:** `/projects/[id]?tab=travelers`

1. Buka tab **Travelers** pada PRJ-103 (Palu MICE — skenario paling kompleks).
2. Tunjukkan daftar group traveler dengan breakdown jumlah pax dan tipe kamar.
3. Tunjukkan tombol tambah traveler manual (mock — data tidak persisten ke backend).

---

### Step 5 — Itinerary & Services

**Route:** `/projects/[id]?tab=itinerary-services`

1. Buka tab **Itinerary & Services** pada PRJ-102 (Abu Dhabi — High-Change).
2. Tunjukkan daily itinerary per hari (Day 1, Day 2, dst.).
3. Tunjukkan sub-section per service type (Flight, Hotel, Transportation, MICE, Additional).
4. Tunjukkan kemampuan update status service (mis. Flight: Pending → Confirmed) sesuai role.

---

### Step 6 — Vendor Management

**Route:** `/vendors` → `/vendors/[id]` → `/projects/[id]?tab=vendors`

1. **Vendor List:** Buka `/vendors`. Tunjukkan daftar vendor dengan filter jenis layanan.
2. **Vendor Detail:** Klik vendor untuk membuka detail 4-tab (Overview, Contacts, Quotations, Activity).
3. **Project Vendors tab:** Kembali ke project detail → tab **Vendors**. Tunjukkan assignment vendor per service, quotation comparison, dan tombol Accept/Reject.

---

### Step 7 — Project Changes

**Route:** `/projects/[id]?tab=activity-changes`

1. Buka tab **Activity & Changes** pada PRJ-102.
2. Tunjukkan log perubahan dengan detail (kategori, requester, before/after value, dampak).
3. Tunjukkan CHG-1023 yang masih `pending` → tombol Approve/Reject tersedia untuk role Management.
4. Tunjukkan form **"Catat Perubahan"** untuk mencatat perubahan baru.

---

### Step 8 — Budget, Cost & Finance

**Route:** `/projects/[id]?tab=finance` → `/finance/invoices` → `/finance/payments`

1. **Finance tab Project:** Buka tab Finance pada PRJ-102. Tunjukkan Invoice list, outstanding amount.
2. **Invoices global:** Buka `/finance/invoices`. Tunjukkan daftar invoice lintas-project, aging indicator (overdue), filter status.
3. **Payments:** Buka `/finance/payments`. Tunjukkan payment records per invoice.

---

### Step 9 — Reports

**Route:** `/reports`

1. Buka `/reports`. Tunjukkan 6 section laporan:
   - Sales Pipeline (Win Rate, nilai pipeline terbuka)
   - Project Performance (status breakdown)
   - Upcoming Departure & Service Readiness (30 hari ke depan)
   - Vendor Summary (committed cost per service type)
   - Budget vs Actual dan Margin
   - Invoice Aging dan Outstanding
2. Gunakan filter (status/tipe/periode) untuk menyaring data.

---

### Step 10 — Administration

**Route:** `/admin` → `/admin/users` → `/admin/roles` → `/admin/master-data` → `/admin/audit-trail`

1. **Hub Admin:** Buka `/admin`. Tampilkan menu navigasi dan panel Demo Role Switcher.
2. **Role Switcher:** Klik user berbeda — perhatikan sidebar berubah (mis. Sales tidak melihat Finance/Admin).
3. **Users:** Buka `/admin/users`. Klik user → dialog detail menampilkan permission matrix personal. Klik "Beralih ke User Ini".
4. **Roles & Permissions:** Buka `/admin/roles`. Tunjukkan visual grid matriks berwarna, legend level akses.
5. **Master Data:** Buka `/admin/master-data`. Beralih antara tab (Tipe Project, Jenis Layanan, Destinasi, Kategori Vendor).
6. **Audit Trail:** Buka `/admin/audit-trail`. Tunjukkan stats, filter, dan detail log perubahan (sebelum/sesudah, dampak).

---

## Demonstrasi Role Behavior

Ubah role via **Settings** (`/settings`) atau **Admin Hub** (`/admin`) menggunakan Demo Role Switcher. Lalu perhatikan:

| Role Demo | Yang Berubah |
|---|---|
| **Super Admin** | Semua modul terbuka, semua tombol aksi aktif |
| **Management** | Lihat semua modul; tombol Approve Won/Change muncul; tidak bisa manage user |
| **Sales** | Hanya CRM terbuka; tidak ada Finance/Admin/Reports; tombol Submit Won aktif |
| **Project Manager** | Project + beberapa Finance (project miliknya); tidak ada CRM write |
| **Operations** | Hanya Project (Itinerary & Services); tidak ada CRM/Finance |
| **Finance** | Finance + Project Finance tab; tidak ada CRM write |
| **Viewer** | Semua modul read-only; tidak ada tombol aksi |

---

## Skenario Data Demo

| ID Project | Nama | Karakteristik | Catatan |
|---|---|---|---|
| PRJ-101 | Manila Business Trip | Normal | Selesai; e-ticket sudah diterbitkan |
| PRJ-102 | Abu Dhabi Luxury Tour | High-Change | Ada 3 perubahan (2 approved, 1 pending — CHG-1023) |
| PRJ-103 | Palu MICE Gathering | Complex | Multi-group, multi-service, rooming list kompleks |

---

## Catatan untuk Presenter

- Seluruh mutasi data (create, update, approve) tersimpan di **memory sesi** — reload halaman akan mereset data ke fixture awal.
- Tidak ada backend nyata — ini adalah **frontend mockup** untuk validasi UX dan alur bisnis.
- Untuk daftar batasan dan known issues, lihat `docs/mockup-final-known-issues.md`.
