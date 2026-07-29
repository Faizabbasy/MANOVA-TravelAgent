# Template Reuse Mapping — MANOVA (Prompt 2, dilengkapi di Prompt 4)

Status dokumen: **Gap analysis, tidak ada implementasi.** Tidak ada kode yang diubah, tidak ada file dihapus, tidak ada rename, tidak ada route/sidebar yang diubah, tidak ada package dipasang.
Landasan: `prompts/PROMPT 0-KONTEKS BISNIS DAN ATURAN KERJA.md` (bagian keputusan LOCKED) dan `docs/template-audit.md` (temuan Prompt 1).
Status keputusan pada dokumen ini: seluruh kategori reuse, phasing, dan rekomendasi berstatus **PROPOSED** kecuali dinyatakan eksplisit **LOCKED** (diwarisi dari Prompt 0) — belum divalidasi user, akan dikunci di Prompt 3 setelah keputusan IA/route/role diambil.

---

## 0. Keputusan LOCKED yang Dipakai sebagai Dasar

Diwarisi langsung dari Prompt 0 bagian C, dipakai sebagai constraint pengambilan keputusan reuse di dokumen ini:

- **LOCKED** — Client dan Prospect menggunakan satu master data pihak/customer (Party/Customer Account) dengan lifecycle/status pembeda.
- **LOCKED** — Opportunity yang menjadi Won otomatis membuat Project (tidak ada alur manual create-project independen dari CRM sebagai baseline).
- **LOCKED** — Seluruh role dipakai saat demo (tidak ada role yang di-skip).
- **LOCKED** — Hak mengubah Opportunity → Won mengikuti role/permission yang direkomendasikan berdasarkan audit, bukan hardcode tanpa dokumentasi.
- **LOCKED** — Sistem adalah frontend mockup dummy data; tidak ada backend nyata yang perlu dipertahankan (dikonfirmasi Prompt 1 — tidak ditemukan integrasi API/backend nyata).
- **LOCKED** — Tidak boleh mengarang integrasi airline/hotel/payment/WhatsApp/vendor API nyata, dan tidak boleh mengklaim fitur mockup sebagai terintegrasi.

Implikasi langsung terhadap reuse mapping: pola wizard `pages/projects/create.vue` sebagai "manual create project independen" **kemungkinan besar bukan alur utama** MANOVA (project seharusnya lahir dari Opportunity Won) — lihat kategori ADAPT di bagian C dan resolusi final di D-018 (`docs/mockup-design-decisions.md`).

---

## 0.5 Consolidated Reuse Summary (kolom wajib Prompt 4-I)

Tabel ringkas dengan kolom persis sesuai Prompt 4-I. Baris 1–9 diringkas dari Mapping Matrix bagian C (detail lengkap di sana); baris 10–17 diringkas dari bagian G (Fitur Tidak Relevan / candidate removal).

| Existing feature | Existing route | Existing component | Proposed MANOVA use | Reuse category | Required adaptation | Candidate removal | Dependency | Risk | Execution phase |
|---|---|---|---|---|---|---|---|---|---|
| Dashboard home | `/` | `StatsCard`, `ProjectsTable`, `BudgetChart`, dll. | Dashboard lintas-domain | `REUSE_LAYOUT_REPLACE_CONTENT` | 7/8 widget jadi props-driven, data diganti | Tidak (AIAssistant terpisah, lihat baris 14) | Dirender di `pages/index.vue`, tidak ada dependensi lain | Sedang | Foundation (shell) → Reporting |
| Login | `/login` | Form fields, `ui/input`/`button`/`card` | Authentication | `REUSE_COMPONENTS` | Perluas payload user+role | Tidak | Dibaca `middleware/auth.ts` | Rendah | Foundation |
| Expenses list | `/expenses` | Table+filter+modal+toast custom | Finance (Actual Cost, basis Invoice) | `REUSE_LAYOUT_REPLACE_CONTENT` | Perbaiki bug `handleDelete`, ganti skema | Tidak | Tidak ada dependensi lain (standalone page) | Sedang | Finance |
| Tasks list | `/tasks` | Table custom | — (dilebur, lihat D-019) | `ADAPT` → **excluded sebagai top-level** | — | **Ya, sebagai menu top-level** (isi/logic direuse ke tab "Tasks") | Menu `AppSidebar.vue`; tidak ada store/middleware lain | Rendah (tidak ada dependensi lain yang rusak) | Project Management |
| Project list | `/projects` | Table custom, badge status/priority | Project — All Projects | `REUSE_LAYOUT_REPLACE_CONTENT` | Ganti skema status/priority | Tidak | — | Rendah–sedang | Project Management |
| Project create wizard | `/projects/create` | Stepper custom, form fields | — (direpurpose, lihat D-018) | `ADAPT` → **excluded sebagai entry point mandiri** | Pola stepper dipakai ulang untuk konfirmasi Won→Project | **Ya, sebagai halaman/menu manual** (pola tetap direuse, bukan dihapus filenya) | Tidak ada route lain yang bergantung | Sedang | Opportunity to Project |
| Project workspace | `/projects/:id` | Tab custom, drag-drop kanban, chart | Project Workspace (8 tab) | `REUSE_LAYOUT_REPLACE_CONTENT` | Isi diganti total per domain, tab diekstrak jadi primitive | Tidak | Workaround bug Reka UI `DialogPortal` terdokumentasi di `onUnmounted` — perlu dibawa saat refactor | **Tinggi** | Project Management → seluruh phase domain |
| Project edit wizard | `/projects/:id/edit` | Sama pola dengan create.vue | Project — Edit Project | `ADAPT` | Satukan skema dengan `[id]/index.vue` (saat ini 2 store independen) | Tidak | Bergantung pada skema Project final | Sedang | Project Management |
| 404 page | `/[...slug]` | SVG statis, tombol | 404 (sama) | `REUSE_AS_IS` | Tidak ada; catatan: tidak dijaga middleware `auth` | Tidak | Tidak ada | Rendah | Foundation |
| Sidebar item `Time Tracking` | `/time-tracking` (dead link) | Entri menu saja | — | `REMOVE_AFTER_VALIDATION` | — | **Ya** | Hanya `AppSidebar.vue menuItems`, tidak ada page/store/middleware | Rendah (aman dihapus) | Regression and demo readiness |
| Sidebar item `Integrations` | `/integrations` (dead link) | Entri menu saja | — | `REMOVE_AFTER_VALIDATION` | — | **Ya** | Hanya entri menu | Rendah (aman dihapus) | Regression and demo readiness |
| Sidebar item `Templates` | `/templates` (dead link) | Entri menu saja | — | `REMOVE_AFTER_VALIDATION` (butuh validasi) | — | **Ya, menunggu validasi** (Q di `docs/mockup-open-questions.md` arsip) | Hanya entri menu | Rendah | Regression and demo readiness |
| Sidebar item `Files` | `/files` (dead link) | Entri menu saja | Tab "Documents" Project Detail | `REUSE_LAYOUT_REPLACE_CONTENT` (sebagai tab, bukan top-level) | Nama/ikon dipakai ulang untuk label tab | **Ya, sebagai menu top-level** (bukan konsepnya) | Hanya entri menu | Rendah | Project Management |
| `dashboard/AIAssistant.vue` | Dirender di `/` | Komponen statis tanpa data model | — (tidak dilanjutkan, D-023) | `KEEP_TEMPORARILY` → **excluded dari desain baru** | — | **Ya (keputusan diambil, eksekusi fisik ditunda ke Prompt 5)** | Dirender di `pages/index.vue`, tidak ada store/middleware lain | Rendah | Regression and demo readiness |
| `app/lib/utils.ts` vs `app/utils/cn.ts` | — (utility, bukan route) | `cn()` duplikat persis | Satu sumber `cn()` | Konsolidasi teknis (DEFERRED, D-017) | Pilih satu, update seluruh pemanggil | **Ya, salah satu** | Dipanggil hampir di seluruh komponen `ui/*` dan `layout/*` — **risiko tinggi bila ceroboh** | Sedang (karena luas dipakai) | Foundation |
| `dialog/DialogContent.vue` vs `DialogScrollContent.vue` | — (komponen, bukan route) | Dua Dialog ~90% identik | Satu komponen dengan prop `scrollable` | Konsolidasi teknis (DEFERRED, D-017) | Gabung jadi satu dengan prop | Tidak (keduanya dipakai aktif, bukan dead code) | Dipakai di banyak modal existing | Rendah | Foundation |
| `.gradient-primary` CSS class | — (utility CSS) | Class tidak dipakai di manapun | — | `REMOVE_AFTER_VALIDATION` | — | **Ya** | Tidak ada elemen yang mereferensikan | Rendah (aman dihapus) | Regression and demo readiness |

---

## A. Tujuan Reuse (ringkasan pendekatan)

Setiap page/fitur/komponen/data model/route/navigation item template existing dievaluasi ke salah satu dari 8 kategori berikut (didefinisikan tetap di bagian C):

`REUSE_AS_IS` · `REUSE_COMPONENTS` · `REUSE_LAYOUT_REPLACE_CONTENT` · `ADAPT` · `KEEP_TEMPORARILY` · `REPLACE` · `REMOVE_AFTER_VALIDATION` · `NEW_REQUIRED`

Prinsip pengambilan keputusan:
- Struktur/pola interaksi yang sudah matang (wizard, tab workspace, table+filter+modal+toast, kanban drag-drop, chart wrapper) → dipertahankan strukturnya, isi domain diganti.
- Data yang saat ini baked-in ke komponen (bukan props-driven) → wajib direfactor jadi props-driven sebelum reuse penuh, dicatat sebagai "required adaptation", bukan alasan untuk REPLACE.
- Fitur tanpa mapping domain yang jelas ke Prompt 0 → tidak langsung dihapus; masuk kategori KEEP_TEMPORARILY atau REMOVE_AFTER_VALIDATION tergantung risiko dependensi, dan dicatat sebagai open question.
- Tidak ada keputusan yang menyederhanakan mapping hanya berdasarkan kemiripan nama halaman (mis. "Expenses" tidak otomatis disamakan dengan "Invoice" hanya karena sama-sama finance).

## B. Domain Mapping

Domain acuan MANOVA (CRM, Project, Operations, Traveler, Vendor, Finance, Administration) mengikuti definisi lengkap di file prompt ini (bagian B) dan Prompt 0 bagian D — tidak diulang di sini untuk menghindari duplikasi; dipakai sebagai kolom "Proposed MANOVA module" di Mapping Matrix (bagian C).

---

## C. Mapping Matrix

| Existing route | Existing page/feature | Existing purpose | Existing main components | Proposed MANOVA module | Proposed MANOVA route | Reuse category | Required adaptation | Data impact | Navigation impact | Risk | Recommended action | Execution phase |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `/` | Dashboard home | Overview generik PM (stat cards + 6 widget) | `StatsCard`, `ProjectsTable`, `BudgetChart`, `ExpenseCategories`, `RecentActivity`, `TasksOverview`, `TeamMetrics`, `AIAssistant` | Dashboard lintas-domain (CRM pipeline + Project status + Operations + Finance) | `/` | `REUSE_LAYOUT_REPLACE_CONTENT` | Grid/shell dipertahankan; 6 dari 8 widget perlu jadi props-driven & datanya diganti KPI MANOVA (lead/opportunity count, pipeline value, project by status, upcoming departure, attention list, budget vs actual, invoice outstanding) | Butuh data agregasi terpusat lintas modul (baru ada setelah CRM/Project/Finance module tersedia) | Tidak ada — tetap `/` | Sedang — 7/8 widget perlu refactor; `AIAssistant` belum ada mapping domain | Finalisasi bertahap: stat card & widget yang datanya sudah tersedia duluan diisi lebih awal, sisanya menyusul per modul | Disebar per modul, finalisasi di **Regression and demo readiness** |
| `/login` | Login page | Mock auth (email+password apa saja asal tidak kosong) | Form fields, `ui/input`, `ui/button`, `ui/card` | Authentication (Administration) | `/login` | `REUSE_COMPONENTS` | Perluas mock user object agar membawa role (bukan sekadar boolean flag); putuskan nasib tombol "Forgot password?" (isi minimal atau hapus) | Butuh struktur `User`+`Role` mock (belum ada sama sekali, lihat bagian E) | Tidak ada | Rendah | Reuse alur, perluas payload login | Foundation |
| `/expenses` | Expenses list | Table+filter+sort+pagination+modal+toast paling matang di codebase | Custom table (bukan `ui/table` primitive?), modal, toast lokal | Finance — Actual Cost / cost entry per project | `/finance/...` (final path menyusul Prompt 3) | `REUSE_LAYOUT_REPLACE_CONTENT` | Wajib perbaiki bug `handleDelete` (ReferenceError) sebelum reuse; skema kategori & status diganti taksonomi MANOVA (flight/hotel/transport/MICE/service); currency format wajib IDR sesuai Prompt 0 K.11 | Perlu skema `ActualCost`/`Expense` tunggal yang terhubung ke Project & Vendor (saat ini standalone) | Kemungkinan pindah ke bawah menu Finance, bukan top-level (lihat bagian F) | Sedang — bug fungsional nyata + skema perlu digeneralisasi | Reuse pola interaksi, ganti skema data, perbaiki bug saat implementasi | Finance |
| `/tasks` | Tasks list (cross-project) | List tugas generik dengan search+filter | Custom table, checkbox (dekoratif) | Ambigu — bisa jadi "Operational Task" cross-project ATAU tetap generic Project Task list | belum ditentukan | `ADAPT` | Perlu keputusan scope dulu (lihat open question): apakah ini terpisah dari Kanban task di dalam project workspace, atau redundant dengan itu | Skema Task perlu disatukan dengan shape Task di `projects/[id]/index.vue` (saat ini beda tipe `id`: number vs `'T-01'`) | Mungkin dilebur ke Operations menu, atau dipertahankan sebagai cross-project task view | Sedang — potensi duplikasi konsep dengan Kanban tab di project workspace | Tunda keputusan final ke Prompt 3; sementara tetap `KEEP_TEMPORARILY` secara fungsi | Project Management |
| `/projects` | Project list | List project dengan search+filter status/priority | Custom table, badge status/priority | Project — Project List | `/projects` | `REUSE_LAYOUT_REPLACE_CONTENT` | Skema status/priority diganti taksonomi MANOVA (termasuk penanda tipe project: flight-only/flight+hotel/flight+hotel+transport/MICE, dan karakteristik Normal/High-Change/Complex) | Konsolidasi dengan shape `ProjectsTable.vue` (dashboard) dan `projects/[id]/index.vue` yang saat ini berbeda-beda | Tidak ada perubahan besar, tetap top-level | Rendah–sedang | Reuse struktur table+filter, ganti skema & data | Project Management |
| `/projects/create` | Project create wizard (3 step) | Wizard buat project baru manual | Stepper custom (bukan primitive `ui/`), form fields, validasi manual | Ambigu terhadap keputusan LOCKED "Opportunity Won → Project otomatis" | belum ditentukan | `ADAPT` | Pola wizard 3-langkah sangat reusable untuk alur lain (mis. Quotation builder di CRM, atau "Project setup" step setelah Won) — tapi wizard ini sebagai "manual create project independen" berpotensi bertentangan dengan alur LOCKED | Tidak ada type baru sampai keputusan scope final | Tergantung keputusan — bisa jadi bukan lagi top-level "Projects > Create" | Sedang — risiko membangun alur yang nanti dianggap tidak sesuai baseline bisnis | **NEEDS_VALIDATION** — jangan dihapus, jangan diimplementasi dulu sampai Prompt 3 memutuskan fungsi wizard ini | Opportunity to Project |
| `/projects/:id` | Project workspace (tab: Overview/Kanban/Timeline/Finances/Files/Activity) | Halaman project paling kaya di codebase | Tab custom (bukan `ui/tabs` primitive — belum ada), drag-drop kanban (`vue-draggable-plus`), chart budget, file list, activity log | Project Workspace MANOVA (inti Project Management) | `/projects/:id` | `REUSE_LAYOUT_REPLACE_CONTENT` | Arsitektur tab dipertahankan, isi diganti total: Overview→ringkasan traveler/itinerary/budget, Kanban→Operational Task, Timeline→Project Timeline/Itinerary, Finances→Budget vs Actual+Invoice/Payment, Files→Document, Activity→Change history/Activity feed. Kemungkinan perlu tab tambahan (Traveler, Vendor) — lihat `NEW_REQUIRED` di bagian D | Perlu skema Project yang jauh lebih kaya (traveler, itinerary item, vendor assignment, budget breakdown) — belum ada di manapun | Tidak ada perubahan route | **Tinggi** — komponen paling kompleks & paling bernilai untuk direuse, tapi juga paling berisiko rusak bila direfactor ceroboh (termasuk workaround bug Reka UI `DialogPortal` yang sudah terdokumentasi di `onUnmounted`) | Reuse kerangka tab, ganti isi bertahap per domain (Operations/Traveler/Vendor/Finance) | Project Management (kerangka) → Operations/Traveler/Vendor/Finance (isi per tab) |
| `/projects/:id/edit` | Project edit wizard (3 step) | Edit project existing, dirty-tracking | Sama polanya dengan `create.vue`, store kedua yang independen dari `[id]/index.vue` | Project — Edit Project | `/projects/:id/edit` | `ADAPT` | Skema field disamakan dengan Project Workspace; dirty-tracking pattern reusable apa adanya | Harus pakai skema Project yang sama dengan `[id]/index.vue` (saat ini dua store independen — risiko drift) | Tidak ada | Sedang | Reuse pola wizard+dirty-tracking, satukan sumber data dengan workspace | Project Management |
| `/[...slug]` | 404 page | Halaman error statis | SVG ilustrasi, tombol Go Back/Go Home | Sama (404) | `/[...slug]` | `REUSE_AS_IS` | Catatan: halaman ini satu-satunya tanpa middleware `auth` — evaluasi konsistensi saat implementasi (bukan tahap ini) | Tidak ada | Tidak ada | Rendah | Reuse langsung | Foundation |

Catatan silang-referensi: 9 sidebar item tanpa halaman (`/files`, `/clients`, `/team`, `/time-tracking`, `/reports`, `/invoices`, `/templates`, `/integrations`, `/settings`) tidak punya baris tersendiri di matrix ini karena tidak ada *existing page* untuk dipetakan — dibahas sebagai kandidat *fitur baru* di bagian F (Navigation Gap) dan sebagai *dead link* di bagian G.

---

## D. Component Reuse Matrix

| Kebutuhan MANOVA | Komponen existing yang bisa dipakai | Perlu wrapper? | Perlu variant baru? | Perlu komponen baru? | Terlalu spesifik ke domain lama? | Risiko merusak halaman existing |
|---|---|---|---|---|---|---|
| KPI card | `dashboard/StatsCard.vue` (satu-satunya komponen props-driven) | Tidak | Tidak | Tidak | Tidak — sudah generic | Rendah — reuse langsung |
| Opportunity pipeline (funnel/stage value) | Tidak ada — `BudgetChart.vue` memakai Chart.js tapi baked-in ke domain budget | Ya (wrapper Chart.js generic) | Ya (varian funnel/stacked-bar per stage) | Sebagian | Ya — `BudgetChart.vue` saat ini domain-specific | Rendah bila dibangun sebagai komponen baru terpisah, bukan modifikasi `BudgetChart.vue` langsung |
| Project table | `ui/table/*` (primitive generic) + pola dari `pages/projects/index.vue` atau `dashboard/ProjectsTable.vue` | Tidak (primitive sudah cukup) | Tidak | Tidak | Tidak untuk primitive; ya untuk kedua implementasi existing (skema beda) | Sedang — perlu pilih satu pola acuan, bukan gabungkan dua langsung |
| Project status badge | `ui/badge` (generic) | Ya — perlu wrapper pemetaan status→warna terpusat (saat ini didefinisikan ulang di 3 tempat berbeda: `ProjectsTable`, `TasksOverview`, `StatsCard`) | Tidak | Tidak | Tidak untuk primitive | Rendah, tapi wajib sentralisasi dulu agar tidak mewarisi drift 3 tempat tsb |
| Upcoming departure | Tidak ada padanan langsung | Ya (bisa dari pola card-list `RecentActivity.vue`) | Ya | Sebagian | Tidak | Rendah |
| Attention list (project butuh perhatian) | `RecentActivity.vue` (pola feed list dengan icon+teks) mendekati | Ya | Ya | Sebagian | Ya — data & styling `RecentActivity` saat ini spesifik "activity", bukan "attention/alert" | Rendah bila dibuat sebagai varian terpisah |
| Client detail | Tidak ada halaman detail party/client sama sekali | — | — | Ya | — | Tidak ada risiko (belum ada yang dipakai) — tapi pola header-info+tabs dari Project Workspace bisa dipakai sebagai kerangka |
| Opportunity stage (indikator tahap) | Stepper ad-hoc di `create.vue`/`edit.vue` (bukan primitive `ui/`) | Ya | Ya | Sebagian (perlu `ui/stepper` primitive dulu, dicatat sebagai gap di audit Prompt 1) | Ya — implementasi stepper saat ini menyatu dengan logic wizard project | Rendah bila diekstrak jadi primitive baru |
| Project tabs | Tab implementation di `projects/[id]/index.vue` (custom, bukan primitive `ui/tabs` — reka-ui Tabs belum dibungkus, temuan Prompt 1 bagian 7) | Ya — ekstrak jadi `ui/tabs` primitive berbasis reka-ui | Tidak | Tidak | Sebagian — logic tab saat ini menyatu dengan halaman | **Sedang** — ekstraksi harus hati-hati agar tidak merusak halaman project workspace yang sudah kompleks |
| Itinerary timeline | Tab "Timeline" di `projects/[id]/index.vue` | Ya | Ya (isi jadi flight/hotel/transport/MICE, bukan task timeline) | Sebagian | Ya — saat ini isinya task-oriented | Rendah–sedang |
| Service summary | Pola `ExpenseCategories.vue` (breakdown kategori + chart) mendekati | Ya | Ya | Sebagian | Ya — kategori & format `$` baked-in | Rendah |
| Traveler table | `ui/table` + pola table existing (sama seperti Project table) | Tidak (primitive) | Ya (kolom & data beda total) | Sebagian | Tidak untuk primitive | Rendah |
| Vendor quotation comparison | Tidak ada pola comparison-table di codebase | Ya (berbasis `ui/table`) | Ya | Ya | — | Tidak ada risiko (baru) |
| Budget versus actual | `dashboard/BudgetChart.vue` — **mapping konsep paling langsung** di seluruh audit | Tidak (butuh refactor, bukan wrapper baru) | Ya (per-project, bukan global) | Tidak | Ya — saat ini hardcoded single dataset + `console.log` tertinggal + tidak reaktif ke tema | Sedang — komponen ini dipakai di dashboard, refactor perlu jaga kompatibilitas tampilan dashboard sementara |
| Invoice table | Pola `pages/expenses.vue` (table+filter+modal+toast paling matang) | Tidak | Ya | Tidak | Ya — skema/istilah expense perlu diganti invoice | Sedang — sama seperti Expenses, mewarisi bug `handleDelete` bila tidak diperbaiki dulu |
| Payment status | `ui/badge` + wrapper status-mapping yang sama dengan Project status badge | Ya (berbagi wrapper yang sama) | Tidak | Tidak | Tidak | Rendah |
| Change log | Tab "Activity" di `projects/[id]/index.vue` / `RecentActivity.vue` | Ya | Ya (fokus ke before/after value, bukan generic activity) | Sebagian | Ya | Rendah–sedang |
| Activity feed | `dashboard/RecentActivity.vue` — mapping langsung | Tidak | Tidak (isi data diganti saja) | Tidak | Sebagian — avatar hotlink ke Unsplash perlu diganti (larangan data sensitif/nyata Prompt 0 K.13 tidak berlaku ke gambar stok, tapi tetap risiko dependency eksternal) | Rendah |
| Role matrix | **Tidak ada sama sekali** — audit Prompt 1 bagian 9 mengonfirmasi nol RBAC di codebase | — | — | Ya, sepenuhnya baru | — | Tidak ada risiko ke halaman existing (murni tambahan), tapi effort besar karena dibangun dari nol |
| Empty/loading/error state | `ui/table/TableEmpty.vue` ada tapi **tidak dipakai di manapun**; tidak ada loading/error state komponen sama sekali (`BudgetChart`/`ExpenseCategories` render `null` sebelum mount) | Ya (untuk loading/error) | Tidak | Ya (loading skeleton + error state; empty state tinggal dipasang) | Tidak | Rendah — murni penambahan, tapi wajib per Prompt 0 aturan teknis #9 |

---

## E. Data Model Gap

**Type yang dapat direuse:** praktis tidak ada type formal (`app/types/` tidak ada sama sekali per audit Prompt 1 bagian 3) — yang ada hanya *shape* inferred dari literal. Satu-satunya interface eksplisit adalah props `StatsCard.vue`, polanya (interface jelas, props-driven) yang layak dijadikan acuan gaya penulisan type baru — bukan reuse isi.

**Type yang perlu digeneralisasi:**
- `Project` — 3 shape berbeda (`pages/projects/index.vue`, `dashboard/ProjectsTable.vue`, `pages/projects/[id]/index.vue`) → disatukan jadi satu `Project` type dengan field opsional yang mengakomodasi tipe layanan (flight-only/+hotel/+transport/MICE) dan karakteristik (Normal/High-Change/Complex).
- `Task` — ≥3 shape, termasuk tipe `id` yang tidak konsisten (`number` vs `'T-01'`) → satu `Task`/`OperationalTask` type dengan `id` string konsisten.
- `Expense` — 2 shape berbeda (`pages/expenses.vue` vs `projects/[id]/index.vue`) → satu `ActualCost`/`Expense` type yang terhubung ke `Project` dan `Vendor`.

**Type yang perlu diganti (bukan sekadar digeneralisasi):**
- Taksonomi kategori expense (berbeda di 3 tempat tanpa irisan lengkap) → diganti taksonomi biaya travel (flight/hotel/transport/MICE/service/lainnya).
- `categoryOptions` create vs edit project yang tidak sinkron (12 vs subset) → satu sumber enum tunggal.

**Type baru yang dibutuhkan** (belum ada representasinya sama sekali di codebase):
- CRM: `Party`/`CustomerAccount` (basis Client & Prospect sesuai keputusan LOCKED), `ContactPerson`, `Lead`, `Opportunity`, `Activity`, `Quotation`.
- Traveler: `Traveler`, `Group`, `RoomingList`, `TravelDocument`, `EmergencyContact`, `SpecialRequest`.
- Operations: `Itinerary`, `Flight`, `Hotel`, `Transportation`, `MICEEvent`, `AdditionalService`, `BookingReference`.
- Vendor: `Vendor`, `VendorContact`, `VendorService`, `VendorQuotation`.
- Finance: `Budget`, `EstimatedCost`, `Invoice`, `Payment`, `Outstanding`, `MarginSummary` (selain `ActualCost` yang digeneralisasi dari `Expense`).
- Administration: `User`, `Role`, `Permission`, `MasterDataItem`, `AuditTrailEntry`, `NotificationItem` (seed awal bisa dari data `NotificationPanel.vue` existing).

**Status dan enum baru yang dibutuhkan:** `OpportunityStage`, `ProjectType` (flight-only/+hotel/+transport/MICE), `ProjectComplexity` (Normal/High-Change/Complex), `BookingStatus`, `InvoiceStatus`, `PaymentStatus`, `VendorQuotationStatus`, `OperationalTaskStatus` — seluruhnya harus jadi constant/enum tunggal (Prompt 0 aturan teknis #10), tidak didefinisikan ulang per file seperti pola lama.

**Relasi penting yang harus dimodelkan:**
- `Opportunity` → (Won) → `Project` (LOCKED).
- `Project` → `Traveler[]`/`Group`, `Project` → `ItineraryItem[]` (Flight/Hotel/Transport/MICE), `ItineraryItem` → `Vendor`.
- `Project` → `Budget`/`ActualCost` → `Invoice` → `Payment`.
- `Party` (Client/Prospect) ↔ `ContactPerson[]`.
- `User` → `Role` → `Permission`; `Project` → `ProjectMember` (User+role-in-project).

**Data yang harus terpusat:** seluruh dummy data lintas widget dashboard (`BudgetChart`, `ExpenseCategories`, `ProjectsTable`, `RecentActivity`, `TasksOverview`, `TeamMetrics`) dan lintas page (`tasks.vue`, `expenses.vue`, `projects/index.vue`, `projects/[id]/*.vue`) harus pindah ke satu modul data terpusat (lokasi tepatnya keputusan Prompt 3, kemungkinan `app/data/` atau `app/constants/` sesuai Prompt 0 aturan teknis #5–6) — **belum boleh dipindahkan pada tahap ini**.

**Data yang tidak boleh lagi berada langsung di page:** seluruh const array domain-specific yang disebut di atas, termasuk option arrays (`categoryOptions` dkk. di `create.vue`/`edit.vue`).

**ID dan reference yang harus konsisten:** hentikan pola `Date.now()` untuk ID runtime (ditemukan di 2 tempat, rawan collision) dan tipe `id` campuran (number/string); rekomendasi memakai skema ID bergaya bisnis yang sudah sebagian ada (`PRJ-001`) secara konsisten lintas entitas — keputusan skema final **DEFERRED** ke tahap implementasi.

**Data scenario untuk 3 tipe project demo:** 4 project hardcoded existing (`PRJ-001..004`) **tidak** merepresentasikan skenario Prompt 0 bagian G (Normal/High-Change/Complex) maupun 4 contoh tipe layanan (Manila flight-only, Abu Dhabi flight+hotel, Korea flight+hotel+transport, Palu MICE) — pemetaan/pembuatan data baru untuk skenario ini harus didesain di modul data terpusat pada tahap implementasi, **tidak diimplementasikan pada tahap ini**.

---

## F. Navigation Gap

**Sidebar existing (13 item, urutan sesuai `AppSidebar.vue`):** Dashboard(`/`), Projects(`/projects`), Tasks(`/tasks`), Expenses(`/expenses`), Files(`/files`), Clients(`/clients`), Team(`/team`), Time Tracking(`/time-tracking`), Reports(`/reports`), Invoices(`/invoices`), Templates(`/templates`), Integrations(`/integrations`), Settings(`/settings`). 4 punya halaman, 9 dead link (dikonfirmasi Prompt 1).

**Rekomendasi menu sementara (PROPOSED, belum LOCKED — evaluasi kebutuhan fase mockup, bukan sekadar salin daftar acuan Prompt 2):**

| Menu | Rekomendasi | Alasan |
|---|---|---|
| Dashboard | Pertahankan | Sudah ada, jadi entry point utama |
| CRM | Tambahkan | Menampung Lead/Prospect/Client/Opportunity/Quotation — saat ini hanya direpresentasikan sebagian oleh dead link `/clients` |
| Projects | Pertahankan | Sudah ada dan paling matang |
| Operations | **Perlu keputusan** (lihat open question) | Bisa jadi menu top-level tersendiri (itinerary/flight/hotel/transport/MICE lintas-project) atau cukup hidup sebagai tab di dalam Project Workspace tanpa menu top-level sendiri — jangan buat menu kosong hanya karena ada di daftar acuan |
| Travelers | **Perlu keputusan** (lihat open question) | Sama seperti Operations — traveler bisa jadi direktori lintas-project (menu sendiri) atau cukup sub-tab per project |
| Vendors | Tambahkan (prioritas menyusul, bukan Foundation) | Konsep vendor sama sekali belum ada di template, relevan untuk fase Vendor |
| Finance | Tambahkan, menyerap `/expenses` existing + dead link `/invoices` | Menyatukan Actual Cost, Invoice, Payment dalam satu payung, bukan dua menu terpisah tanpa hierarki |
| Reports | Tambahkan (menggantikan dead link `/reports`) | Relevan langsung untuk kebutuhan dashboard filter & margin summary Prompt 0-F |
| Master Data | Tambahkan (Administration) | Dibutuhkan untuk skalabilitas beberapa travel agent (Prompt 0-A: sistem tidak boleh terlalu spesifik ke satu travel agent) |
| User & Role Management | Tambahkan (menggantikan sebagian konsep dead link `/team`) | Wajib karena RBAC belum ada sama sekali (audit Prompt 1-9); seluruh role dipakai saat demo (LOCKED) |
| Settings | **DEFERRED** — evaluasi dulu apakah ada isi konkret sebelum ditambahkan | Instruksi eksplisit "hindari menu kosong"; saat ini hanya ada tombol "Profile Settings" dekoratif di `AppSidebar.vue` yang menuju `/settings` (juga dead) |

**Dead link yang tidak direkomendasikan lanjut sebagai menu top-level (dibahas detail alasannya di bagian G):** `Files` (kemungkinan dilebur ke tab "Files" di Project Workspace, bukan menu top-level terpisah), `Time Tracking` (tidak ada konsep di Prompt 0), `Templates` (fungsi tidak jelas, butuh validasi), `Integrations` (bertentangan dengan larangan mengarang integrasi nyata Prompt 0-C).

**Tasks (top-level existing):** butuh keputusan scope — apakah tetap top-level (cross-project operational task list) atau melebur ke dalam Operations/Project Workspace Kanban tab (berpotensi duplikat konsep dengan Kanban tab yang sudah ada di `/projects/:id`). Dicatat sebagai open question.

---

## G. Fitur yang Tidak Relevan (candidate removal — bukan tindakan sekarang)

| Fitur/file | Alasan tidak relevan | Komponen reusable di dalamnya | Dependensi (route/component/store/middleware/nav) | Aman dihapus / disembunyikan / dipertahankan sementara |
|---|---|---|---|---|
| `dashboard/AIAssistant.vue` | Tidak ada konsep AI assistant di Prompt 0 manapun | Tidak ada — statis, tanpa data model, tombol tanpa handler | Dirender di `pages/index.vue`; tidak ada store/middleware terkait | **Dipertahankan sementara** — jangan hapus tanpa validasi user; kandidat kuat untuk dihilangkan dari dashboard MANOVA tapi keputusan bukan wewenang tahap ini |
| Sidebar item `Time Tracking` (`/time-tracking`) | Tidak ada entitas/konsep time-tracking di domain MANOVA manapun (CRM/Project/Operations/Traveler/Vendor/Finance/Administration) | Tidak ada — halaman tidak pernah ada, hanya entri menu | Hanya `AppSidebar.vue menuItems`; tidak ada page/store/middleware terkait | **Kandidat aman untuk disembunyikan/dihapus dari menu** setelah validasi user — tidak ada dependensi lain yang akan rusak |
| Sidebar item `Integrations` (`/integrations`) | Bertentangan langsung dengan larangan Prompt 0-C "jangan mengarang integrasi airline/hotel/payment/WhatsApp/vendor API nyata" | Tidak ada — halaman tidak pernah ada | Hanya entri menu | **Kandidat aman untuk dihapus dari menu** — risiko salah persepsi stakeholder (dikira sudah ada integrasi nyata) bila dipertahankan |
| Sidebar item `Templates` (`/templates`) | Fungsi tidak jelas — bisa berarti project template, quotation template, atau dokumen template; tidak disebut eksplisit di Prompt 0 | Tidak ada — halaman tidak pernah ada | Hanya entri menu | **Butuh validasi user dulu** sebelum diputuskan dihapus atau diberi makna baru (mis. Quotation Template) |
| Sidebar item `Files` (`/files`) | Konsep "Document" sudah punya rumah lebih baik sebagai tab "Files" di dalam Project Workspace (`/projects/:id`), menu top-level terpisah berisiko duplikasi/kebingungan IA | Nama & ikon (`FileText`) bisa dipakai ulang untuk label tab di Project Workspace | Hanya entri menu | **Kandidat disembunyikan sebagai menu top-level**, difungsikan ulang sebagai tab existing — bukan dihapus konsepnya |
| `app/lib/utils.ts` vs `app/utils/cn.ts` (duplikat `cn()`) | Duplikasi kode murni, bukan fitur — tidak berhubungan langsung dengan gap analysis domain, tapi dicatat ulang karena berdampak ke seluruh reuse component (setiap komponen UI memanggil `cn()`) | Isi identik, salah satu bisa dipertahankan | Diimpor oleh hampir seluruh komponen `ui/*` dan `layout/*` (dua jalur akses: auto-import `utils/**` dan alias eksplisit `~/lib/utils` via `components.json`) | **Perlu keputusan teknis di Prompt 3/implementasi** — menghapus salah satu berisiko merusak file yang memakai jalur akses spesifik itu; bukan tindakan tahap ini |
| `dialog/DialogContent.vue` vs `dialog/DialogScrollContent.vue` | Near-duplicate (~90% identik) | Keduanya dipakai (centered-fixed vs scrollable-overlay) — bukan dead code, jadi bukan murni "tidak relevan" | Dipakai di berbagai modal existing (mis. `expenses.vue`, `projects/[id]/index.vue`) | **Dipertahankan** — ini kandidat konsolidasi teknis (gabung jadi satu dengan prop `scrollable`), bukan kandidat removal fitur |
| `.gradient-primary` CSS utility | Tidak dipakai di manapun (grep tidak menemukan pemakaian) | Tidak ada — murni CSS class | Hanya didefinisikan di `assets/css/tailwind.css`, tidak ada elemen yang mereferensikan | **Kandidat aman dihapus** — tapi tetap menunggu validasi eksplisit sebelum dieksekusi (bukan tahap ini) |
| 2x `console.log` di `BudgetChart.vue` dan `ExpenseCategories.vue` | Debug leftover, bukan fitur | Tidak relevan (bukan fitur) | Tidak ada dependensi | **Kandidat aman dihapus saat refactor komponen tsb**, bukan tindakan berdiri sendiri sekarang |

Tidak ada satu pun item pada tabel ini yang dieksekusi (dihapus/disembunyikan) pada tahap Prompt 2 — seluruhnya kandidat untuk divalidasi di Prompt 3 dan dieksekusi di Prompt 5 (cleanup).

---

## H. Output Dokumentasi

Dokumen ini adalah 1 dari 5 output wajib Prompt 2. Lihat juga:
- `docs/mockup-scope.md` — batas scope fase mockup.
- `docs/mockup-design-decisions.md` — keputusan reuse berstatus per kategori LOCKED/PROPOSED/NEEDS_VALIDATION/DEFERRED.
- `docs/mockup-open-questions.md` — pertanyaan terbuka yang perlu divalidasi user sebelum Prompt 3.
- `docs/mockup-progress.md` — log kronologis (diupdate, bukan ditimpa).

---

## I. Rekomendasi Phasing

| Phase | Scope | Route | Main components | Reuse target | Data dependency | Exit criteria |
|---|---|---|---|---|---|---|
| **Foundation** | Sentralisasi data & tipe dasar, formatter currency/date, status-badge wrapper terpusat, ekstraksi `ui/tabs` primitive, perbaikan bug `handleDelete`, resolusi duplikasi `cn()` | `/login`, `/[...slug]`, shell (`dashboard.vue`, `AppSidebar.vue`, `TopHeader.vue`) | `StatsCard`, `ui/*` primitives, formatter baru | `REUSE_AS_IS` + `REUSE_COMPONENTS` | Tidak ada — ini fondasi untuk phase lain | Formatter IDR & tanggal konsisten tersedia; satu sumber status-badge; `ui/tabs` primitive siap dipakai; build tetap sukses |
| **CRM** | Party/Customer Account, Prospect, Client, Contact Person, Lead, Opportunity, Activity, Quotation | Menu baru "CRM" (route final di Prompt 3) | Table baru (berbasis `ui/table`), pipeline/funnel chart baru | `NEW_REQUIRED` dominan, `REUSE_COMPONENTS` untuk table/card/modal | Butuh `Party` type baru (bagian E) | Data CRM demo tersedia dan konsisten dengan Project yang akan lahir dari Won di phase berikutnya |
| **Opportunity to Project** | Alur Opportunity → Won → Project otomatis (LOCKED); keputusan nasib wizard `/projects/create` | Menyambung CRM ke `/projects` | Wizard existing (`create.vue`/`edit.vue`) sebagai basis, permission check Won | `ADAPT` wizard, `NEW_REQUIRED` untuk trigger otomatis | Bergantung pada `Opportunity` (phase CRM) dan `Project` type (Foundation) | Opportunity Won menghasilkan Project baru secara konsisten di data mock; role/permission untuk aksi Won terdokumentasi |
| **Project Management** | Project list, Project Workspace (kerangka tab), Edit project | `/projects`, `/projects/:id`, `/projects/:id/edit` | `ProjectsTable`/`projects/index.vue` (dipilih satu acuan), tab workspace | `REUSE_LAYOUT_REPLACE_CONTENT` | Butuh `Project` type final (Foundation+CRM) | Project list & workspace tampil dengan skema MANOVA, data 3 skenario demo (Normal/High-Change/Complex) mulai terisi |
| **Operations** | Itinerary, Flight, Hotel, Transportation, MICE, Additional Service, Booking status, Operational Task | Tab "Timeline"/"Kanban" di Project Workspace, menu "Operations" bila diputuskan perlu (lihat open question) | Timeline tab, Kanban tab (adaptasi) | `ADAPT` konten tab existing | Butuh `Itinerary`/`Flight`/`Hotel`/dst. type baru | Ketiga skenario demo punya kombinasi service yang sesuai Prompt 0-B (flight-only/+hotel/+transport/MICE) |
| **Traveler** | Traveler, Participant, Group, Rooming List, Travel Document, Special Request | Tab baru di Project Workspace / menu "Travelers" (tergantung keputusan) | Traveler table baru | `NEW_REQUIRED` | Terhubung ke `Project` | Data traveler tersedia untuk skenario Complex Project (banyak traveler) |
| **Vendor** | Vendor, Vendor Contact, Vendor Service, Vendor Quotation | Menu "Vendors" baru | Vendor table, quotation comparison (baru) | `NEW_REQUIRED` | Terhubung ke `Itinerary`/`ActualCost` | Data vendor tersedia untuk skenario Complex Project (banyak vendor) |
| **Finance** | Budget, Estimated/Actual Cost (adaptasi `/expenses`), Invoice, Payment, Outstanding, Margin Summary | `/expenses` (diadaptasi), menu "Finance" baru menyerap Invoice | `BudgetChart` (refactor), pola table `expenses.vue` | `REUSE_LAYOUT_REPLACE_CONTENT` + `NEW_REQUIRED` (Invoice/Payment) | Terhubung ke `Project` dan `Vendor` | Budget vs Actual per project akurat; Invoice/Payment konsisten dengan data cost |
| **Reporting** | Dashboard final, Reports menu | `/` (finalisasi widget tersisa), menu "Reports" baru | Sisa widget dashboard, chart baru | Kombinasi seluruh kategori | Bergantung pada seluruh phase sebelumnya | Dashboard menampilkan metrik lintas-domain sesuai Prompt 0-F tanpa data placeholder |
| **Administration** | User, Role, Permission, Master Data, Audit Trail, Notification | Menu "User & Role Management", "Master Data" baru | Role matrix (baru), `NotificationPanel` (adaptasi) | `NEW_REQUIRED` dominan, `REUSE_COMPONENTS` untuk notification | RBAC harus terhubung ke aksi Opportunity→Won (phase Opportunity to Project) | Seluruh role Prompt 0-E terdefinisi dengan permission mock yang scalable |
| **Regression and demo readiness** | Cleanup kandidat removal (bagian G), verifikasi 3 skenario demo end-to-end, finalisasi dashboard, hapus dead link yang sudah divalidasi | Seluruh route | Seluruh komponen | — | Seluruh phase sebelumnya | Build/lint/typecheck/test (bila ada) sukses; tidak ada dead link tersisa tanpa keputusan; 3 skenario demo bisa didemokan tanpa data bertentangan |

---

## Ringkasan Akhir

**Jumlah fitur/baris per reuse category (Mapping Matrix bagian C, 9 baris route-level):**
- `REUSE_AS_IS`: 1 (`/[...slug]` 404)
- `REUSE_COMPONENTS`: 1 (`/login`)
- `REUSE_LAYOUT_REPLACE_CONTENT`: 4 (`/`, `/expenses`, `/projects`, `/projects/:id`)
- `ADAPT`: 3 (`/tasks`, `/projects/create` [NEEDS_VALIDATION], `/projects/:id/edit`)
- `NEW_REQUIRED`: tidak ada di level route (karena belum ada halaman baru dibuat), tapi dominan di Component Reuse Matrix (bagian D: Vendor quotation comparison, Role matrix, Client detail, dll.)

**Top reusable assets:**
1. Arsitektur tab Project Workspace (`/projects/:id`) — reuse struktural paling bernilai di seluruh codebase.
2. Pola table+filter+search+modal+toast `pages/expenses.vue` — basis terbaik untuk Invoice table & Traveler table.
3. 15 primitive `ui/*` (bebas domain logic, terverifikasi Prompt 1) — fondasi seluruh komponen baru.
4. `StatsCard.vue` — satu-satunya komponen dashboard yang sudah props-driven, reuse langsung.
5. Layout shell (`dashboard.vue`, `AppSidebar.vue` struktur collapsible, `TopHeader.vue`, `NotificationPanel.vue`) — pola interaksi bagus, tinggal ganti isi.

**Top removal candidates (bukan keputusan final):**
1. Sidebar `Integrations` — bertentangan langsung dengan larangan Prompt 0.
2. Sidebar `Time Tracking` — tidak ada domain match sama sekali.
3. `dashboard/AIAssistant.vue` — tidak ada mapping domain, tapi effort rendah untuk dipertahankan sementara.
4. Duplikasi `cn()` (`app/lib/utils.ts` vs `app/utils/cn.ts`).
5. `.gradient-primary` CSS class — tidak dipakai di manapun.

**Gap paling besar:**
1. **RBAC/Role & Permission** — nol fondasi, harus dibangun total (Administration phase), padahal seluruh role wajib dipakai saat demo (LOCKED).
2. **CRM domain** — nol representasi di codebase existing (Lead/Opportunity/Quotation/Party sama sekali tidak ada).
3. **Traveler & Vendor domain** — nol representasi, harus dibangun dari nol.
4. **Data terpusat** — Project/Task/Expense punya 2–3 shape tidak sinkron; harus disatukan sebelum modul baru dibangun di atasnya.
5. **Currency IDR** — nol pemakaian format Rupiah di seluruh codebase saat ini (wajib per Prompt 0 K.11).

**Risiko utama:**
1. Wizard `/projects/create` berpotensi bertentangan dengan alur LOCKED "Opportunity Won → Project otomatis" — perlu keputusan scope sebelum implementasi (lihat `docs/mockup-open-questions.md`).
2. Refactor Project Workspace (`/projects/:id`) berisiko tinggi karena kompleksitas tertinggi di codebase (drag-drop kanban, workaround bug Reka UI, banyak state lokal).
3. Ambiguitas scope `Tasks` top-level vs Kanban tab di Project Workspace — potensi duplikasi konsep bila tidak diputuskan di Prompt 3.
4. Ambiguitas menu Operations & Travelers — top-level menu vs sub-tab in-project — berisiko menu kosong bila dipaksakan tanpa data yang cukup di fase awal.
5. Ekstraksi `ui/tabs` primitive dari implementasi ad-hoc di Project Workspace berisiko merusak halaman yang sudah kompleks bila tidak dilakukan hati-hati.

**Keputusan yang perlu dikunci pada tahap berikutnya (Prompt 3):**
1. Fungsi final wizard `/projects/create` (dipertahankan sebagai alur manual, direpurpose jadi bagian alur Opportunity→Project, atau dihapus).
2. Scope `Tasks` top-level vs Kanban tab (duplikat konsep atau dipisahkan secara sengaja).
3. Apakah Operations dan Travelers jadi menu top-level tersendiri atau cukup sub-tab di Project Workspace.
4. Nasib final 9 dead link sidebar (hapus/reuse makna/redirect ke tab existing).
5. Route final tiap modul baru (CRM, Vendors, Finance, Reports, Master Data, User & Role Management).
6. Skema ID final lintas entitas dan lokasi modul data terpusat (`app/data/` vs `app/constants/` vs kombinasi).
7. Nasib `dashboard/AIAssistant.vue` dan menu `Settings`.
