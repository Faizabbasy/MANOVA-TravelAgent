# Final Route Inventory — MANOVA Travel Agent Mockup

Inventarisasi **kondisi aktual final** seluruh route yang ter-generate Nuxt dari direktori `app/pages/`. Status berdasarkan hasil audit langsung pada Section 18 — Regression and Demo Readiness.

> **Legend Status:**
> - ✅ **ACTIVE** — route terhubung di sidebar, lengkap, dan layak demo
> - ⏳ **PLACEHOLDER** — route terhubung di sidebar tapi menampilkan `ModulePlaceholder`
> - 🔒 **LOCKED** — route ada dan fungsional tapi di luar demo flow (file template lama, sengaja tidak dihapus)
> - 🚫 **EXCLUDED** — route ada di kode tapi tidak termasuk IA MANOVA (sesuai `docs/route-and-role-matrix.md` 1.8)

---

## Route Aktif (Demo Flow)

| Route | Status | Halaman/Komponen | Akses Role | Breadcrumb | Notes |
|---|---|---|---|---|---|
| `/login` | ✅ | Login page | Publik | — | Mock auth — klik Sign In langsung masuk |
| `/` | ✅ | Dashboard | Semua | — | 7 widget role-aware; layout berubah per role |
| `/settings` | ✅ | Settings + Role Switcher | Semua | Settings | Role switcher sinkron dengan `useCurrentUser()` |
| `/crm` | ✅ | CRM Hub | CRM (VIEW+) | CRM | Index dengan quick links |
| `/crm/prospects` | ✅ | Prospect List | CRM (VIEW+) | CRM › Prospects | Search, filter, create mock |
| `/crm/clients` | ✅ | Client List | CRM (VIEW+) | CRM › Clients | Daftar client aktif |
| `/crm/parties/[id]` | ✅ | Party Detail | CRM (VIEW+) | CRM › [Nama Party] | 4 tab: Info, Contacts, Activity, Opportunities |
| `/crm/opportunities` | ✅ | Opportunity List | CRM (VIEW+) | CRM › Opportunities | Filter stage, search, pipeline view |
| `/crm/opportunities/[id]` | ✅ | Opportunity Detail | CRM (VIEW+) | CRM › Opportunities › [Nama] | Stage tracker, quotation list, Submit/Approve Won |
| `/crm/quotations` | ⏳ | Placeholder | CRM (VIEW+) | CRM › Quotations | `comingSoon` di sidebar — halaman quota list global belum diimplementasikan |
| `/projects` | ✅ | Project List | Project (VIEW+) | Projects | Filter status/tipe/karakteristik, search |
| `/projects/[id]` | ✅ | Project Detail | Project (VIEW+) | Projects › [Nama] | 8 tab: Overview, Travelers, Itinerary & Services, Vendors, Kanban, Tasks, Activity & Changes, Finance |
| `/vendors` | ✅ | Vendor List | Vendor (VIEW+) | Vendors | Filter jenis layanan, create mock |
| `/vendors/[id]` | ✅ | Vendor Detail | Vendor (VIEW+) | Vendors › [Nama] | 4 tab: Overview, Contacts, Quotations, Activity |
| `/finance` | ✅ | Finance Hub | Finance (VIEW+) | Finance | Quick links ke Invoices dan Payments |
| `/finance/invoices` | ✅ | Invoice List | Finance (VIEW+) | Finance › Invoices | Filter status, aging indicator, detail modal |
| `/finance/payments` | ✅ | Payment List | Finance (VIEW+) | Finance › Payments | Filter invoice/status, payment detail |
| `/reports` | ✅ | Reports | Reports (VIEW+) | Reports | 6 section laporan dengan filter |
| `/admin` | ✅ | Admin Hub + Role Switcher | Administration (VIEW+) | Administration | Demo Role Switcher reaktif |
| `/admin/master-data` | ✅ | Master Data | Administration (VIEW+) | Administration › Master Data | 4 kategori dengan tab switcher |
| `/admin/users` | ✅ | User List & Detail | Administration (VIEW+) | Administration › Users | Search, filter role, dialog permission matrix |
| `/admin/roles` | ✅ | Role & Permission Matrix | Administration (VIEW+) | Administration › Roles and Permissions | Grid berwarna + legend + action flags |
| `/admin/audit-trail` | ✅ | Audit Trail Log | Administration (VIEW+) | Administration › Audit Trail | Stats, multi-filter, detail perubahan |
| `/[...slug]` | ✅ | 404 Catch-all | Semua | — | Halaman 404 custom untuk route tidak ditemukan |

---

## Route Template Lama (Accessible via URL, Tidak di Sidebar)

| Route | Status | Deskripsi | Keputusan |
|---|---|---|---|
| `/tasks` | 🚫 | Old template — daftar task generik (Mobile Banking App, Healthcare Portal) | Excluded per D-002; melebur ke tab Tasks di Project Detail |
| `/expenses` | 🔒 | Old template — daftar expense generik; bug `handleDelete` **sudah diperbaiki** | Sengaja tidak dihapus (referensi kode untuk Invoice) — tidak terhubung dari nav |
| `/projects/create` | 🔒 | Wizard 3-step project creation | Alur Won→Project diimplementasikan di `/crm/opportunities/[id]`, bukan standalone wizard ini |
| `/projects/[id]/edit` | 🔒 | Wizard edit project | Deferred — belum di-adapt ke skema MANOVA |

---

## Tab & Sub-route Project Detail (`/projects/[id]`)

| Tab | Query Param | Status | Notes |
|---|---|---|---|
| Overview | `?tab=overview` | ✅ | Budget ring chart, service summary, attention indicators |
| Travelers | `?tab=travelers` | ✅ | Group list, rooming, create traveler mock |
| Itinerary & Services | `?tab=itinerary-services` | ✅ | Daily itinerary + per-service sections dengan update status |
| Vendors | `?tab=vendors` | ✅ | Assignment per service, quotation comparison, Accept/Reject |
| Kanban | `?tab=kanban` | ✅ | Drag-and-drop task board |
| Tasks | `?tab=tasks` | ✅ | Task list dengan status |
| Activity & Changes | `?tab=activity-changes` | ✅ | Log aktivitas + change detail + approve/reject + create |
| Finance | `?tab=finance` | ✅ | Invoice list project, outstanding, actual cost |

---

## Navigasi Sidebar — Status Flag

| Menu Item | `comingSoon` Flag | Status |
|---|---|---|
| Dashboard | — | ✅ Active |
| CRM | — | ✅ Active |
| CRM › Prospects | — | ✅ Active |
| CRM › Clients | — | ✅ Active |
| CRM › Opportunities | — | ✅ Active |
| CRM › Quotations | ✅ comingSoon | ⏳ Placeholder |
| Projects | — | ✅ Active |
| Vendors | — | ✅ Active |
| Finance | — | ✅ Active |
| Finance › Invoices | — | ✅ Active (fixed Section 18) |
| Finance › Payments | — | ✅ Active (fixed Section 18) |
| Reports | — | ✅ Active |
| Administration | — | ✅ Active |
| Administration › Master Data | — | ✅ Active |
| Administration › Users | — | ✅ Active |
| Administration › Roles and Permissions | — | ✅ Active |
| Administration › Audit Trail | — | ✅ Active |

---

## Ringkasan Statistik

| Kategori | Jumlah |
|---|---|
| Route ACTIVE (demo-ready) | 23 |
| Route PLACEHOLDER (comingSoon) | 1 (`/crm/quotations`) |
| Route LOCKED (template lama, tidak di sidebar) | 3 |
| Route EXCLUDED (template lama, dead) | 1 (`/tasks`) |
| **Total route ter-generate Nuxt** | **28** |

---

## Data Skenario yang Tersedia

| Entity | Fixture | Count |
|---|---|---|
| Projects | `PROJECTS` | 3 (PRJ-101, PRJ-102, PRJ-103) |
| Parties | `PARTIES` | 6+ |
| Opportunities | `OPPORTUNITIES` | 7 (3 Won, 1 Lost, 3 open) |
| Quotations | `QUOTATIONS` | 6+ |
| Project Services | `PROJECT_SERVICES` | 11 |
| Itinerary Items | `ITINERARY_ITEMS` | 15 |
| Travelers | `TRAVELERS`, `GROUPS`, `ROOMS` | — |
| Vendors | `VENDORS` | 5+ |
| Vendor Quotations | `VENDOR_QUOTATIONS` | 10 |
| Invoices | `INVOICES` | 5+ |
| Payments | `PAYMENTS` | — |
| Activity/Changes | `ACTIVITIES` | 5 (1 activity + 4 changes) |
| Users (demo) | `USERS` | 10+ |
