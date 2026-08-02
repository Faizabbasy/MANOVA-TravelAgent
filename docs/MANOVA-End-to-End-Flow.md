# MANOVA — End-to-End Flow (Lead sampai Project Selesai)

Dokumen ini menggantikan cakupan `docs/MANOVA-Client-Vendor-Commodity-End-to-End-Flow.md` sebagai **peta flow end-to-end penuh** — seluruh perjalanan bisnis MANOVA dari Lead masuk sampai Project ditutup, bukan hanya modul Client–Vendor Commodity. Sumber kebenaran: `docs/frontend-workflow-map.md` ("Workflow Utama" 23 langkah, hasil regresi Section 24) dan `docs/frontend-known-issues.md`, disilangkan dengan pengecekan langsung terhadap kode (route dan fungsi dikonfirmasi ada di `app/pages/**` dan `app/data/index.ts`). Dokumen Client–Vendor Commodity yang lama **tetap ada, tidak dihapus** — kini berperan sebagai detail sub-flow untuk salah satu jalur di bawah (lihat bagian 4).

Frontend-only mockup — tidak ada backend/database/payment gateway produksi di mana pun sepanjang flow ini.

---

## 1. Workflow Utama (23 Langkah)

Urutan literal: **Public/Manual Lead → Sales Qualification → Assign Account Executive → Opportunity → Requirement Detail → Product Planning & Costing → Quotation → Management Approval → Client Confirmation → Opportunity Won → Active Client → Project Order → AE-to-PM Handover → Planning → Traveler Collection → Supplier Sourcing → Service Booking → Readiness → On Trip / Event → Changes / Incident → Finance Finalization → Completed → Closed**

| # | Langkah | Status | Route utama | Ringkasan implementasi |
|---|---|---|---|---|
| 1 | Public Lead | Selesai | `/lead-intake` | Form publik tanpa login, 4 kategori kebutuhan, consent, deteksi duplikat |
| 1b | Manual Lead | Selesai | `/customer-journey/leads` | Dialog "New Lead" dibuat langsung oleh Sales |
| 2 | Sales Qualification | Selesai | `/customer-journey/leads` (drawer) | Tab Qualification 13 field, gate kelengkapan sebelum lanjut |
| 3 | Assign Account Executive | Selesai | (bagian form Qualification) | Field "AE yang Menerima Lead" (`Lead.handedOverTo`) |
| 4 | Opportunity | Selesai | `/crm/opportunities` | Auto-create saat Lead di-qualify, cek Party existing (no-duplicate) |
| 5 | Requirement Detail | Selesai | `/crm/opportunities/[id]` | 14 field kebutuhan AE, gate sebelum boleh membuat Quotation |
| 6 | Product Planning & Costing | Selesai | `/product-planning`, `/product-planning/cost-sheets` | Template produk + cost sheet per traveler (markup/pajak/kontingensi), snapshot ke Quotation |
| 7 | Quotation | Selesai | `/crm/opportunities/[id]`, preview PDF | Create/Edit/Versi baru/Duplicate/Compare/Send/Withdraw |
| 8 | Management Approval | Selesai | `/crm/quotations` | Antrean approval komersial (margin/diskon/pajak/markup/risk) |
| 9 | Client Confirmation | Selesai | `/client/opportunities/[id]` | Self-service Client: Accept/Reject/Request Revision |
| 10 | Opportunity Won | Selesai | `/crm/opportunities/[id]` | Tombol "Mark as Won" satu langkah |
| 11 | Active Client | Selesai | (otomatis) | `Party.lifecycleStatus` prospect → client, tanpa duplikasi company |
| 12 | Project Order | Selesai | `/projects/[id]` | `Project` dibuat otomatis saat Won |
| 13 | AE-to-PM Handover | Selesai | `/projects/[id]` (tab Overview) | Accept/Return Handover eksplisit oleh Project Manager, alasan wajib saat return |
| 14 | Planning | Selesai | `/projects/[id]` | Status `draft`/`planning`, seluruh tab Project Detail aktif |
| 15 | Traveler Collection | Selesai | `/projects/[id]` (tab Travelers), `/client/project-orders/[id]` | Data traveler, dokumen (paspor/visa), rooming list, submission mandiri Client |
| 16 | Supplier Sourcing | Selesai | `/procurement`, `/procurement/rfq/[id]`, `/supplier/rfq` | RFQ formal (invite/compare/klarifikasi/select) + assignment cepat existing |
| 17 | Service Booking | Selesai | `/ticketing`, `/accommodation`, `/transportation`, `/mice`, `/bookings`, `/procurement/service-orders/[id]` | Lifecycle penuh per domain + konsolidasi timeline "Booking & Service Order Center" |
| 18 | Readiness | Selesai | `/projects/[id]` (tab Itinerary & Services) | Departure Readiness Gate + Service Readiness Matrix — bersifat advisory, tidak memblokir |
| 19 | On Trip / Event | **Sebagian (PARTIAL)** | run sheet, detail booking per domain | Status `ongoing-trip`, run sheet, shift notes ada — belum full lifecycle "on-trip" terpadu lintas seluruh domain |
| 20 | Changes / Incident | Selesai | `/changes` (+3 sub-detail) | Change Request/Cancellation/Refund/Incident terstruktur, tertaut ke Activity Trail yang sama |
| 21 | Finance Finalization | Selesai | `/finance/invoices`, `/finance/payments`, `/finance/notes`, `/finance/reconciliation` | Invoice/Payment/Credit-Debit Note/AP reconciliation/Financial Closure Gate |
| 22 | Completed | Selesai | (status project) | `ProjectStatus.completed` |
| 23 | Closed | Selesai | `/projects/[id]` (tab Overview, "Project Closure") | `evaluateProjectClosureGate`/`closeProject` — gate finance settled, service terminal, tidak ada incident/change request terbuka |

**Catatan status:** Ringkasan penutup dokumen sumber (`frontend-workflow-map.md`) menyebut seluruh 23 langkah "selesai", namun baris #19 di tabel yang sama secara eksplisit masih ditandai **PARTIAL**. Dokumen ini mengikuti status per-baris yang lebih spesifik — **tidak menuliskan status 100% selama ada baris yang belum penuh.**

---

## 2. Cross-Cutting Layer (Tidak Menambah Langkah Baru, Melengkapi Seluruh Langkah)

| Layer | Route | Melengkapi langkah # |
|---|---|---|
| Documents, Communication & Notifications | `/documents` | Seluruh langkah, terutama #17 (dokumen booking) dan #20 (notifikasi insiden/perubahan) |
| Dashboard, Reports & Activity Center | `/`, `/reports`, `/activity-center`, `/customer-journey/lead-sources` | Seluruh langkah — agregasi dan drill-down |
| Administration & Master Data | `/admin` | Seluruh langkah — role/akses, audit trail, master data |
| Role & Permission Boundary | `usePermissions()` (`vendorScopeId`/`clientScopeId`/`canView`/`canManage`) | Seluruh langkah — isolasi data per role/company diverifikasi di setiap halaman |

---

## 3. Jalur Tambahan (Additive) — Client–Vendor Commodity

**Client–Vendor Commodity BUKAN salah satu dari 23 langkah Workflow Utama** — ini adalah jalur sourcing dan fulfillment TAMBAHAN yang beririsan dengan langkah **#15 (Traveler Collection)** sampai **#17 (Service Booking)**, memberi Client cara lain memenuhi kebutuhan project langsung dari katalog komoditas Vendor (di luar RFQ/Service Order formal dan booking per-domain Flight/Hotel/Transport/MICE):

```
Vendor Publish Commodity → Client Lihat Katalog → Client Buat Requirement → Matching
   → Client Selection → Soft Hold → Vendor Confirmation → Vendor Sold Commodity
```

Route: `/supplier/commodities`, `/supplier/commodity-orders` (Vendor); `/client/project-orders/[id]?tab=commodity`, `/client/catalog/[requirementId]` (Client).

Detail penuh (13 skenario happy path + alternative path, matriks CRUD, known limitations): lihat `docs/MANOVA-Client-Vendor-Commodity-End-to-End-Flow.md` (tidak diubah oleh dokumen ini) dan versi visualnya `MANOVA-Client-Vendor-Commodity-End-to-End-Flow.html`.

---

## 4. Known Gaps (Jujur, Bukan Disembunyikan)

- **Langkah #19 (On Trip / Event) — PARTIAL.** Elemen dasar (status `ongoing-trip`, run sheet, shift notes, 4 modul booking per domain) sudah ada, tapi belum ada lifecycle "on-trip" terpadu lintas seluruh domain dalam satu tampilan.
- **Accommodation (`HotelBooking`) tidak punya flag `hasScheduleChange`** setara Flight/Transport/MICE — gap parity kecil, kosmetik, tidak memblokir alur Change Request (tetap berfungsi lewat jalur generik).
- **Project Closed "documents complete" check bersifat best-effort** — hanya mengecek tidak ada dokumen kedaluwarsa, belum ada konsep "daftar dokumen wajib per tipe project" untuk dibandingkan kelengkapannya.
- **Client–Vendor Commodity** punya known limitations sendiri (Archive tidak memperingatkan Selection aktif, belum ada halaman "My Orders" khusus Client, dll.) — lihat dokumen detailnya di bagian 3.
- Tidak ada backend/database sungguhan di mana pun — seluruh state adalah `reactive()` in-memory yang reset saat reload (kecuali di-reset manual ke seed lewat `/settings`).

---

## 5. Referensi Silang

- `docs/frontend-workflow-map.md` — status per langkah Workflow Utama (sumber utama tabel bagian 1)
- `docs/frontend-known-issues.md` — known gap per section, hasil regresi
- `docs/frontend-module-map.md` — pemetaan route lengkap
- `docs/MANOVA-Client-Vendor-Commodity-End-to-End-Flow.md` — detail jalur tambahan Commodity
- `MANOVA-Laporan-Progres-2026-08-01.html` — laporan progres per section/tahap
- `MANOVA-End-to-End-Flow.html` — versi visual dokumen ini, dapat diunduh sebagai PDF
