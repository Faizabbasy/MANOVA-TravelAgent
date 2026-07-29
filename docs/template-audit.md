# Template & Codebase Audit — MANOVA (Prompt 1)

Status: **Audit read-only, tidak ada kode yang diubah/dihapus, tidak ada package yang diinstal/dihapus.**
Landasan: `prompts/PROMPT 0-KONTEKS BISNIS DAN ATURAN KERJA.md` (konteks bisnis MANOVA sudah dikonfirmasi di tahap sebelumnya).
Metode: audit langsung (config, versi, direktori) + 3 sub-agent read-only paralel (rute/layout/middleware, UI/design tokens, data/state/code-quality), lalu verifikasi build.

---

## 1. Executive Summary

Codebase ini adalah **dashboard mockup Nuxt 4 generik** (bertema project/task management ala tool PM internal), bukan aplikasi travel agent. Fondasinya (Nuxt 4, Vue 3, TypeScript, Tailwind, shadcn-nuxt/Reka UI, Chart.js, vee-validate+zod, VueUse) **sudah solid dan layak dipakai ulang** untuk MANOVA — layout, sidebar collapsible, primitives shadcn, pola tabel/wizard/kanban/chart semuanya bisa direuse dengan adaptasi data & domain.

Namun ada tiga kategori masalah nyata yang perlu diperhatikan sebelum lanjut ke tahap berikutnya:

1. **Data mock tidak konsisten lintas halaman.** Entitas "Project", "Task", dan "Expense" masing-masing punya 2–3 bentuk (shape) berbeda di file berbeda, dengan taksonomi status/kategori yang tidak sinkron, dan satu project (`PRJ-005`) hanya muncul di satu file (orphan). Ini persis risiko yang diperingatkan Prompt 0 bagian G ("dummy data harus ... berasal dari satu source yang terpusat").
2. **Satu bug fungsional nyata**: tombol "Delete" di modal detail `expenses.vue` memanggil fungsi `handleDelete` yang tidak pernah didefinisikan → `ReferenceError` saat diklik.
3. **Repo kehilangan folder `.git`.** Ini ditemukan saat audit dan sudah dilaporkan terpisah ke user secara langsung (bukan hasil tindakan saya). Dicatat ulang di bagian Risiko karena berdampak besar pada keamanan kerja lintas-tahap (tidak ada riwayat commit/rollback point saat ini).

Tidak ditemukan integrasi backend/API nyata yang perlu dipertahankan — seluruh "auth", "submit", "save" adalah simulasi client-side (`localStorage` + `setTimeout`). Ini sejalan dengan asumsi Prompt 0 bahwa sistem saat ini adalah frontend mockup murni.

---

## 2. Stack dan Package Audit

**Package manager:** pnpm (dikonfirmasi via `pnpm-lock.yaml` yang ada di root; tidak ada `package-lock.json`/`yarn.lock`).

**Versi terpasang (resolved, dari `node_modules`, bukan sekadar range di `package.json`):**

| Package | Range di package.json | Versi resolved |
|---|---|---|
| nuxt | ^4.3.1 | 4.5.1 |
| vue | ^3.5.28 | 3.5.40 |
| typescript (devDependency) | ^5.7.3 | 5.9.3 |
| reka-ui | ^2.8.2 | 2.10.1 |
| shadcn-nuxt | ^2.4.3 | 2.8.1 |
| vee-validate | ^4.15.1 | 4.15.1 |
| @vee-validate/zod | ^4.15.1 | (mengikuti vee-validate) |
| zod | ^3.25.76 | 3.25.76 |
| chart.js | ^4.5.1 | 4.5.1 |
| vue-chartjs | ^5.3.3 | 5.3.4 |
| date-fns | ^4.1.0 | 4.4.0 |
| lucide-vue-next | ^0.575.0 | 0.575.0 |
| @nuxtjs/tailwindcss | ^6.14.0 | 6.14.0 |
| tailwindcss-animate | ^1.0.7 | 1.0.7 |
| @vueuse/core, @vueuse/nuxt | ^14.2.1 | 14.4.0 |
| class-variance-authority | ^0.7.1 | 0.7.1 |
| clsx | ^2.1.1 | 2.1.1 |
| tailwind-merge | ^3.5.0 | 3.6.0 |
| vue-router | ^4.6.4 | 4.6.4 |
| vue-draggable-plus | ^0.6.1 | 0.6.1 |
| vitest (devDependency) | ^4.0.18 | 4.1.10 |
| @vue/test-utils (devDependency) | ^2.4.6 | 2.4.11 |
| jsdom (devDependency) | ^28.1.0 | terpasang |
| @nuxtjs/eslint-config-typescript (devDependency) | ^12.1.0 | terpasang, **tapi package `eslint` inti tidak terpasang sama sekali** |

Catatan penting soal `typescript`: sebelum audit ini, project sempat gagal build total (27 error `[@vue/compiler-sfc] No fs option provided...`) karena `typescript` tidak pernah dideklarasikan sebagai dependency langsung di `package.json` (hanya ter-resolve transitif ke `typescript@7.0.2`, versi native/Go rewrite yang API classic-nya sudah tidak ada). Ini sudah diperbaiki di sesi sebelumnya dengan menambahkan `"typescript": "^5.7.3"` ke `devDependencies` dan menjalankan `pnpm install` (memakai lockfile yang sama, tidak ada package baru yang benar-benar ditambah ke dependency graph — hanya dipromosikan jadi direct dependency). Dicatat di sini agar histori perbaikan ini terdokumentasi, bukan tindakan baru pada tahap Prompt 1.

**Scripts (`package.json`):** hanya `dev`, `build`, `generate`, `preview`, `postinstall` (`nuxt prepare`). **Tidak ada script `lint`, `typecheck`, atau `test`** meskipun `vitest`, `@vue/test-utils`, dan `jsdom` sudah menjadi devDependency — infrastruktur testing tersedia tapi belum dipakai (tidak ada satu pun file test).

**TypeScript config:** `tsconfig.json` hanya mereferensikan project references hasil generate Nuxt (`.nuxt/tsconfig.*.json`) — standar Nuxt 4, tidak dikustomisasi. `nuxt.config.ts` men-set `typescript: { strict: false, typeCheck: false, shim: false }` — non-strict dan **type-check dimatikan saat build** (sesuai CLAUDE.md yang memang mendokumentasikan ini sebagai keputusan sadar).

**Environment/runtime:** tidak ada `runtimeConfig` di `nuxt.config.ts`, tidak ada file `.env`/`.env.example`. `devServer` di-set ke port 8080, host `0.0.0.0`.

**Nuxt modules:** `@nuxtjs/tailwindcss`, `@vueuse/nuxt`, `shadcn-nuxt`. Tidak ada module state-management (Pinia dsb.) — state saat ini hanya composable `ref` singleton + `localStorage`.

**Data fetching pattern:** tidak ada. Tidak ditemukan `useFetch`/`$fetch`/`useAsyncData` di manapun — seluruh data adalah literal hardcoded di `<script setup>`.

**Authentication pattern:** mock murni berbasis `localStorage` (detail di bagian 9).

**Testing framework:** vitest + @vue/test-utils + jsdom terpasang, **nol file test**.

**Linting/formatting:** tidak ada eslint config (`.eslintrc*`/`eslint.config.*`) dan package inti `eslint` tidak terinstal — `@nuxtjs/eslint-config-typescript` jadi devDependency yang tidak terpakai (dead devDependency).

**Build/deploy config:** Nitro preset default (`node-server`), tidak ada file deployment khusus (tidak ada `Dockerfile`, tidak ada config Vercel/Netlify).

---

## 3. Struktur Codebase

```
app/
├── app.vue                  # root shell: <LoadingBar/> + <NuxtLayout><NuxtPage/></NuxtLayout>
├── components/
│   ├── dashboard/           # 8 komponen widget dashboard (semua domain-specific, dummy data inline)
│   ├── layout/              # AppSidebar, TopHeader, LoadingBar, NotificationPanel
│   └── ui/                  # 15 folder primitive shadcn-nuxt/Reka UI (generic, bersih dari domain logic)
├── composables/             # useSidebar.ts, useIsMobile.ts (hanya 2 file)
├── layouts/
│   └── dashboard.vue        # 11 baris: sidebar + header + <slot/>
├── lib/
│   └── utils.ts             # cn() — DUPLIKAT persis dengan app/utils/cn.ts
├── middleware/
│   └── auth.ts              # named middleware, mock localStorage-based
├── pages/                   # 9 file (rincian di bagian 4)
└── utils/
    └── cn.ts                # DUPLIKAT persis dengan app/lib/utils.ts
```

**Tidak ada** (dicek langsung, bukan asumsi): `app/stores/`, `app/types/`, `app/constants/`, `app/data/`, `app/plugins/`, `server/` (root maupun `app/server/`). Tidak ada `.env*`, tidak ada `vitest.config.*`, tidak ada `.eslintrc*`/`eslint.config.*`.

**Import alias:** `~/` → `app/` (standar Nuxt 4 srcDir), dikonfirmasi konsisten di `components.json` (`components→~/components`, `utils→~/lib/utils`, `ui→~/components/ui`, `lib→~/lib`, `hooks→~/composables`). Satu inkonsistensi kecil: `app/pages/login.vue` mengimpor UI primitives via `@/components/ui/...` alih-alih `~/` — bekerja tapi tidak konsisten dengan konvensi file lain (yang mengandalkan auto-import, tanpa import eksplisit sama sekali).

**Auto-import:** dikonfigurasi di `nuxt.config.ts` — `imports.dirs: ['composables', 'composables/**', 'utils/**']` dan 4 root component (`~/components`, `~/components/layout`, `~/components/dashboard`, `~/components/ui`) semua dengan `pathPrefix: false`. Konsekuensi: `cn()` bisa ter-auto-import dari **dua lokasi sekaligus** (`app/lib/utils.ts` tidak masuk auto-import dirs sebenarnya — hanya `app/utils/cn.ts` yang otomatis ter-auto-import lewat `utils/**`; `app/lib/utils.ts` diakses via alias eksplisit `~/lib/utils` sesuai `components.json`). Jadi dua file ini hidup berdampingan dengan jalur akses berbeda (satu eksplisit-alias, satu auto-import) — tetap merupakan duplikasi kode yang perlu diselesaikan nanti.

**Naming convention:** PascalCase untuk file komponen (`StatsCard.vue`), camelCase untuk composable (`useSidebar.ts`), kebab-case tidak dipakai di mana pun. Konsisten.

**Dead/duplicate files yang terindikasi (tidak dihapus):**
- `app/lib/utils.ts` vs `app/utils/cn.ts` — identik persis.
- `app/components/ui/dialog/DialogContent.vue` vs `DialogScrollContent.vue` — ~90% identik (satu jadi centered-fixed, satu jadi scrollable-overlay) — kandidat untuk digabung jadi satu komponen dengan prop, bukan file terpisah.

**Mock data existing / hardcoded di page:** lihat detail lengkap di bagian 8.

**Route yang tersedia vs rusak:** lihat bagian 4.

---

## 4. Route Inventory

Base path Nuxt 4: `app/pages/**` (srcDir `app/`).

| Route | File | Layout | Middleware | Sumber data | Status interaksi |
|---|---|---|---|---|---|
| `/` | `pages/index.vue` | dashboard | `auth` | 100% literal hardcoded di template (props ke StatsCard dkk.) | Statis, tanpa interaksi di level halaman |
| `/login` | `pages/login.vue` | `false` (standalone) | — | `ref` lokal | Form login mock berfungsi (localStorage); tombol "Forgot password?" mati (tidak ada handler) |
| `/expenses` | `pages/expenses.vue` | dashboard | `auth` | `allExpenses` (20 item hardcoded) | Sangat interaktif (search/filter/sort/pagination/modal/toast) — **tapi ada bug: tombol Delete di modal detail memanggil `handleDelete` yang tidak terdefinisi (ReferenceError saat diklik)** |
| `/tasks` | `pages/tasks.vue` | dashboard | `auth` | `tasks` (6 item hardcoded) | Search + 3 filter berfungsi; checkbox status & tombol "New Task"/"..." dekoratif (tidak ada handler) |
| `/projects` | `pages/projects/index.vue` | dashboard | `auth` | `projects` (4 item hardcoded, PRJ-001..004) | Search + filter status/priority berfungsi; tombol "..." per-card mati |
| `/projects/create` | `pages/projects/create.vue` | dashboard | `auth` | option arrays lokal (`categoryOptions` dst.) | Wizard 3 langkah berfungsi penuh dengan validasi; submit disimulasikan (`setTimeout`), tidak benar-benar menambah ke list `/projects` |
| `/projects/:id` | `pages/projects/[id]/index.vue` | dashboard | `auth` | `projectData` (objek besar, ~1589 baris file, PRJ-001 & PRJ-002 saja yang terkonfirmasi terisi penuh) | Paling kaya: tab Overview/Kanban/Timeline/Finances/Files/Activity, drag-and-drop kanban (vue-draggable-plus), chart budget, semua mutasi in-memory saja |
| `/projects/:id/edit` | `pages/projects/[id]/edit.vue` | dashboard | `auth` | **`projectData` kedua**, independen, diberi komentar eksplisit `// Same mock store as [id].vue` / `// In a real app this would come from a store / API call.` | Wizard edit 3 langkah, dirty-tracking, simulated save |
| `/**` (404) | `pages/[...slug].vue` | dashboard | **tidak ada** | statis (SVG ilustrasi) | "Go Back"/"Go Home" berfungsi. **Halaman ini satu-satunya di antara semua halaman ber-layout dashboard yang tidak dijaga middleware `auth`** — pengunjung tak terautentikasi yang salah ketik URL tetap melihat full app shell (sidebar+header) |

**Routing convention note:** urutan file `[...slug].vue` di filesystem **tidak berpengaruh** terhadap prioritas matching Nuxt 4 (router berbasis `rou3`/radix-tree memprioritaskan static > dynamic > catch-all secara otomatis, terlepas dari urutan file). Catatan di CLAUDE.md soal "harus tetap terakhir" adalah konvensi keterbacaan, bukan keharusan teknis.

**Route yang direferensikan tapi tidak punya file halaman** (ditemukan via `AppSidebar.vue`'s `menuItems`, 13 entri total): `/files`, `/clients`, `/team`, `/time-tracking`, `/reports`, `/invoices`, `/templates`, `/integrations`, `/settings` — **9 dari 13 link sidebar menuju halaman yang tidak ada** dan akan jatuh ke 404. Beberapa nama ini (Clients, Invoices, Reports) justru relevan secara konsep dengan domain MANOVA (Prompt 0 bagian D) — kemungkinan besar akan jadi bagian information architecture riil di Prompt 3, bukan sekadar dihapus.

---

## 5. Layout Inventory

- **`app/layouts/dashboard.vue`** — satu-satunya layout. Struktur: `flex` row — `<AppSidebar/>` (lebar sendiri, collapsible) + kolom `flex-1` berisi `<TopHeader/>` lalu `<main class="flex-1 p-6 overflow-auto"><slot/></main>`. Tidak ada named slot, tidak ada logic responsive di layout itu sendiri.
- **`app/app.vue`** — root shell di luar `NuxtLayout`: `<LoadingBar/>` (progress bar global berbasis `router.beforeEach/afterEach`, animasi `Math.random()`, murni kosmetik) lalu `<NuxtLayout><NuxtPage/></NuxtLayout>`. `pageTransition: { name: 'page', mode: 'out-in' }` diset di `nuxt.config.ts`.
- **`app/components/layout/AppSidebar.vue`** — sidebar collapsible (`w-16` ↔ `w-64`) via `useSidebar()`; berisi 13 `menuItems` hardcoded (9 di antaranya dead link, lihat bagian 4), blok profil user hardcoded ("Daffa Prayoga / daffa@daffascript.com / CEO" — **tidak disinkronkan** dengan `userEmail` yang disimpan saat login), search input dekoratif (hint "⌘K" tanpa keybinding nyata), dan tombol Logout yang berfungsi (`localStorage.removeItem` + redirect `/login`).
- **`app/components/layout/TopHeader.vue`** — header statis: judul "Dashboard" hardcoded (**tidak reaktif terhadap route aktif** — tetap tertulis "Dashboard" di halaman `/expenses`, `/tasks`, dll.), rentang tanggal hardcoded, tombol "Add Widget"/"Export" mati, Popover notifikasi yang berfungsi (dihubungkan ke `NotificationPanel` via template ref + `defineExpose`).
- **`app/components/layout/NotificationPanel.vue`** — 6 notifikasi mock, mark-as-read/mark-all/remove berfungsi penuh secara lokal; tombol "View all notifications" mati (dan memang belum ada halaman `/notifications`).
- **`app/components/layout/LoadingBar.vue`** — progress bar kosmetik, tidak terhubung ke state loading data nyata (karena memang belum ada data-fetching nyata).

**Gap responsive layout:** `useIsMobile()` (composable VueUse `useMediaQuery`) **ada tapi tidak dipakai** oleh `AppSidebar`, `TopHeader`, atau `dashboard.vue` — tidak ada perilaku mobile-drawer/auto-collapse; satu-satunya mekanisme collapse adalah toggle manual via `useSidebar()`, dan state itu tidak persisten (reset ke expanded tiap reload penuh).

---

## 6. Component Inventory

### UI Primitives (`app/components/ui/`) — 15 folder, semua generic, bebas domain logic

`avatar, badge, button, card, checkbox, dialog, input, label, popover, progress, select, separator, sheet, table, tooltip`.

Highlight: `Button` (CVA variant+size lengkap, mendukung `asChild`), `Table` (termasuk `TableEmpty.vue` yang **sudah ada tapi belum dipakai di manapun**), `Sheet` (4 sisi: top/bottom/left/right), `Select` (komposisi Reka UI penuh dengan popper positioning). Tidak ditemukan logic domain (project/task/expense/budget/status/priority) di 78 file yang di-grep dalam folder ini — primitives ini **aman untuk direuse apa adanya**.

Dua near-duplicate yang perlu dicatat: `dialog/DialogContent.vue` vs `dialog/DialogScrollContent.vue` (lihat bagian 3).

### Dashboard Components (`app/components/dashboard/`) — 8 file, semua domain-specific

| Komponen | Props? | Sumber data | Catatan reuse |
|---|---|---|---|
| `StatsCard.vue` | **Ya, satu-satunya** — interface lengkap (`title, value, change?, icon, iconColor?, subtitle?`) | via props | Generic, siap reuse langsung |
| `BudgetChart.vue` | Tidak | `data` const array + **judul/angka headline hardcoded terpisah di template** (tidak terhubung ke `data`) | Perlu adaptasi signifikan; label "Budget/Actual" dan format `$` hardcoded di callback Chart.js |
| `ExpenseCategories.vue` | Tidak | `data` const array | Nama kategori & format `$` hardcoded |
| `ProjectsTable.vue` | Tidak | `projects` const array (5 item, termasuk **PRJ-005 yang tidak ada di file lain**) | Taksonomi status berbeda dari `pages/projects/index.vue` |
| `RecentActivity.vue` | Tidak | `activities` const array (avatar hotlink ke Unsplash) | Struktur cukup generic |
| `TasksOverview.vue` | Tidak | `tasks` const array (shape lebih ramping dari `pages/tasks.vue`) | — |
| `TeamMetrics.vue` | Tidak | `teamMembers` const array (avatar hotlink Unsplash) | — |
| `AIAssistant.vue` | Tidak | Statis, tidak ada data model; tombol "ask" tanpa handler | **Tidak ada konsep MANOVA yang jelas untuk fitur ini di Prompt 0** — perlu validasi apakah dipertahankan |

Semua komponen ini (kecuali StatsCard) memuat dummy data sebagai `const` di dalam file, bukan lewat props — artinya "ganti saja datanya" belum bisa dilakukan tanpa edit source.

### Design tokens / util

`app/lib/utils.ts` == `app/utils/cn.ts` (duplikat persis, lihat bagian 3).

---

## 7. Design System Inventory

**Tailwind config (`tailwind.config.ts`):** `darkMode: ["class"]`; container centered, padding 2rem, breakpoint custom `2xl: 1400px` (sisanya default Tailwind); font `Plus Jakarta Sans` (fallback system-ui); seluruh warna via `hsl(var(--token))` (border/input/ring/background/foreground, primary/secondary/destructive/success/warning/muted/accent/popover/card + `-foreground` masing-masing, sidebar 8 sub-token, `chart-1..5`); `borderRadius`: `lg/md/sm` diturunkan dari `--radius`, **tidak ada mapping untuk `xl`** meski `rounded-xl` dipakai luas di dashboard components (nilai statis Tailwind, kebetulan visual sama dengan `--radius` default saat ini — akan pecah kalau `--radius` diubah); keyframes `accordion-down/up` (referensi `--radix-accordion-content-height` **padahal tidak ada komponen accordion** di `ui/`), `fade-in`, `slide-in`; plugin `tailwindcss-animate`.

**CSS variables (`assets/css/tailwind.css`):** set lengkap light (`:root`) & dark (`.dark`) HSL untuk semua token di atas. `--radius: 0.75rem` hanya didefinisikan di blok light — blok dark tidak mendefinisikan ulang (mewarisi, tidak masalah tapi perlu diperhatikan bila radius ingin berbeda per tema). Utility custom: `.card-shadow`/`.card-shadow-lg` (rgba mentah, bukan token), **`.gradient-primary` pakai hex mentah (`#FF7732`/`#FD0091`), bukan token HSL, dan tampaknya tidak dipakai di manapun** (AIAssistant.vue pakai pola gradient token-based yang berbeda: `from-primary to-chart-4`).

**Checklist pola UI yang dibutuhkan MANOVA (Prompt 0 bagian F & H) vs yang tersedia:**

| Pola | Status | Catatan |
|---|---|---|
| Card, Statistic card, Table, Badge, Avatar, Modal, Drawer | **Ada** | Siap reuse |
| Tabs | **Tidak ada** | Perlu dibangun (reka-ui punya primitive Tabs yang belum dibungkus di `ui/`) |
| Pagination | **Tidak ada** | `expenses.vue` implementasi pagination manual sendiri, belum jadi komponen `ui/` |
| Filter control, Search input | **Sebagian** | Ada pola per-halaman (expenses/tasks/projects), belum jadi komponen bersama |
| Dropdown/action menu | **Tidak ada** | Tombol "..." di beberapa tempat tidak punya menu terpasang |
| Form + validasi | **Tidak ada wrapper** | vee-validate & zod adalah dependency tapi **tidak dipakai di manapun** — semua form (login, create/edit project) pakai `ref` manual + validasi custom, bukan vee-validate |
| Date picker, File upload, Kanban (komponen `ui/` generic), Calendar, Stepper (komponen `ui/` generic), Skeleton, Error state, Breadcrumb, Page title/PageHeader | **Tidak ada** | Kanban *ada* secara ad-hoc di `projects/[id]/index.vue` via `vue-draggable-plus`, tapi bukan primitive reusable |
| Toast/notification | **Ada, tapi lokal** | `expenses.vue` punya sistem toast sendiri; belum jadi komponen `ui/` bersama |
| Empty state | **Primitive ada, tidak dipakai** | `ui/table/TableEmpty.vue` sudah dibuat tapi tidak dipanggil di manapun |
| Loading state | **Tidak ada** | `BudgetChart`/`ExpenseCategories` render `null` sampai `onMounted`, tanpa placeholder |
| Confirmation dialog | **Sebagian** | Primitive `ui/dialog` bisa dipakai untuk ini; `expenses.vue` sudah punya pola konfirmasi delete sendiri, belum jadi komponen bersama |

**Inkonsistensi visual tercatat:** duplikasi `cn()`; radius drift (`ui/` pakai token `--radius`, dashboard components pakai `rounded-xl` statis); `.gradient-primary` pakai hex mentah; peta warna status/priority didefinisikan ulang independen di `ProjectsTable.vue`, `TasksOverview.vue`, dan `StatsCard.vue` (risiko drift); `console.log` tertinggal di `BudgetChart.vue` dan `ExpenseCategories.vue`; ukuran icon tidak konsisten (`h-3.5` s/d `h-10`); dua Dialog varian mirip (lihat atas); avatar hotlink langsung ke `images.unsplash.com` tanpa fallback.

**Responsive/aksesibilitas:** tidak ada dashboard component yang pakai class responsive internal (`sm:`/`md:`/`lg:`) — responsivitas sepenuhnya bergantung pada grid parent page. `ProjectsTable` (8 kolom) hanya `overflow-x-auto`, tanpa fallback card-view mobile. Tombol icon-only (`MoreHorizontal` di ProjectsTable, `Send` di AIAssistant) tidak punya `aria-label`, tidak konsisten dengan `DialogContent`/`SheetContent` yang sudah benar pakai `sr-only`. Status/priority badge sudah memadukan warna+teks (bukan color-only), jadi aman dari sisi ini. Tabel primitif pakai markup semantik `<table>` yang benar.

---

## 8. Data dan State Audit

**Tidak ada** `app/stores/`, `app/types/`, `app/constants/`, `app/data/` — semua dummy data adalah literal `const`/`ref` di dalam `<script setup>` masing-masing file (rincian lokasi & shape ada di laporan sub-agent, ringkasan risiko konsistensi di bawah).

**State/persistence:**
- `useSidebar()` — singleton module-level `ref`, tidak persisten.
- `useIsMobile()` — wrapper `useMediaQuery`, tidak persisten (memang tidak perlu).
- Satu-satunya persistence nyata: `localStorage` — dipakai untuk `isAuthenticated` dan `userEmail` (set di `login.vue`, dibaca di `middleware/auth.ts`, dihapus di `AppSidebar.vue` saat logout). Tidak ada `sessionStorage`, `useCookie`, atau `useState()` Nuxt di manapun.

**Role & permission:** **belum ada RBAC apa pun.** Setiap kemunculan kata "role" di kode adalah label jabatan tampilan (mis. `TeamMetrics.vue`: "Lead Designer", "Project Manager") bukan kontrol akses. Auth hanya flag boolean tunggal, tanpa objek user, tanpa role, tanpa permission check di manapun. Ini artinya struktur role MANOVA (Prompt 0 bagian E — Super Admin, Sales, PM, Operations, dst.) **harus dibangun dari nol**, tidak ada fondasi mock role yang bisa direuse langsung — hanya pola "current user via localStorage" yang bisa diperluas.

**Currency & date formatting:** **tidak ada formatter bersama.** Mayoritas tempat memformat manual `${value.toLocaleString()}` (locale-less, prefix `$` literal). Hanya `expenses.vue` yang punya `Intl.NumberFormat('en-US', {style:'currency', currency:'USD'})` — tapi lokal ke file itu saja, tidak dipakai file lain. **Tidak ada satu pun kemunculan format Rupiah/IDR** — ini perlu dibangun baru untuk memenuhi Prompt 0 aturan K.11 (bukan sekadar reuse). Date juga tidak konsisten: sebagian data pakai string ISO yang bisa di-parse (`expenses.vue`: `'2025-01-15'`), sebagian pakai string bebas non-parseable (`'Today'`, `'Feb 15, 2025'`, `'Overdue'` di `tasks.vue`/`projects/index.vue`). Package `date-fns` **terpasang tapi tidak dipakai di manapun** dalam kode aplikasi.

**ID generation:** tidak konsisten — mayoritas ID adalah string/number literal hasil seed manual (`'PRJ-001'`, `id: 1`), tapi ada dua tempat yang generate ID runtime dengan `Date.now()` (`projects/[id]/index.vue`, untuk subtask & comment/expense baru) — berisiko collision kalau dua entri dibuat dalam milidetik yang sama. Tidak ada `crypto.randomUUID()` di manapun.

**Risiko konsistensi lintas halaman (temuan paling penting di bagian ini):**

1. **"Project" punya 3 shape independen** yang hanya berbagi sebagian field name (`pages/projects/index.vue` vs `dashboard/ProjectsTable.vue` — taksonomi status beda total, `ProjectsTable` py `health` field yang tidak ada di tempat lain, plus `PRJ-005` orphan — vs `pages/projects/[id]/index.vue` yang jauh lebih kaya field-nya).
2. **"Task" punya ≥3 shape** dengan tipe `id` yang bahkan berbeda (`number` di `pages/tasks.vue`, `string` seperti `'T-01'` di `projects/[id]/index.vue`).
3. **"Expense" punya 2 shape** dengan tipe `id` berbeda dan field berbeda (`vendor`/`status`/`hasReceipt` di `pages/expenses.vue` vs `addedBy` di `projects/[id]/index.vue`).
4. **Taksonomi kategori expense berbeda di 3 tempat** tanpa irisan lengkap.
5. **`categoryOptions` create vs edit project tidak sinkron** (edit punya 12 opsi termasuk 4 yang tidak ada di create) — mengedit project bisa menampilkan kategori yang tidak mungkin dihasilkan dari alur create.
6. Data orang (nama/avatar/inisial) di-copy-paste identik ke 5+ file alih-alih disentralisasi (konsisten nilainya, tapi rawan drift ke depan).

Ini semua **mengonfirmasi peringatan eksplisit Prompt 0 bagian G**: dummy data harus disatukan ke satu source sebelum dipakai untuk skenario demo (Normal/High-Change/Complex Project) — pekerjaan ini belum dilakukan sama sekali di codebase saat ini dan akan menjadi fokus tahap berikutnya (bukan tahap ini).

---

## 9. Authentication dan Role Audit

`app/middleware/auth.ts` (dikutip penuh):

```ts
export default defineNuxtRouteMiddleware((to, from) => {
  if (process.client) {
    const isAuthenticated = localStorage.getItem('isAuthenticated')
    if (!isAuthenticated && to.path !== '/login') {
      return navigateTo('/login')
    }
    if (isAuthenticated && to.path === '/login') {
      return navigateTo('/')
    }
  }
})
```

- **Named middleware** (opt-in per halaman via `definePageMeta({ middleware: 'auth' })`), dipakai di 7 dari 9 halaman (semua kecuali `login.vue` dan `[...slug].vue`).
- Mekanisme: **flag boolean di localStorage**, tanpa token, tanpa expiry, tanpa verifikasi server. Login (`login.vue`) menerima **email+password apa pun asal tidak kosong** — bukan validasi kredensial sungguhan (secara eksplisit dikomentari `// Simulate API call`, `// Simple auth check (replace with actual API call)`).
- **Gap SSR**: guard dibungkus `if (process.client)` — no-op saat SSR/prerender. Untuk setup SPA-only seperti saat ini risikonya rendah, tapi jadi catatan penting bila SSR diaktifkan nanti.
- **Halaman 404 tidak dijaga** middleware ini (lihat bagian 4) — inkonsistensi kecil tapi nyata dibanding 7 halaman lain.
- **Tidak ada role/permission** apa pun tersimpan atau dicek — hanya boolean tunggal. Prompt 0 bagian E mensyaratkan dukungan penuh role (Super Admin, Management, Sales, PM, Operations, Ticketing, Hotel, Transportation, MICE, Finance, Viewer) — **tidak ada fondasi mock yang bisa direuse untuk ini**, harus dibangun dari nol pada tahap berikutnya (kemungkinan Prompt 3).

---

## 10. Reuse Opportunities (kategorisasi per Prompt 1 bagian D)

**1. Reuse as-is:**
- Seluruh 15 primitive `app/components/ui/*` (bebas domain logic, terverifikasi via grep).
- `app/layouts/dashboard.vue` (struktur shell).
- `app/components/layout/LoadingBar.vue` (murni kosmetik, tidak terikat domain).
- `app/composables/useSidebar.ts`, `useIsMobile.ts`.
- `app/components/dashboard/StatsCard.vue` (satu-satunya komponen dashboard yang sudah props-driven & generic).
- Pola desain token (`tailwind.config.ts` + `assets/css/tailwind.css`) sebagai fondasi tema — dipakai as-is, isi warna/nama token bisa disesuaikan nanti bila diperlukan tanpa mengganti arsitekturnya.

**2. Reuse with adaptation:**
- `AppSidebar.vue`, `TopHeader.vue`, `NotificationPanel.vue` — pola & interaksi bagus (collapsible, popover, mark-as-read), tapi isi (`menuItems`, profil user, judul header statis) perlu diganti sesuai IA & role MANOVA (pekerjaan Prompt 3, bukan sekarang).
- `pages/login.vue` — pola form + mock-auth flow bisa direuse, tapi perlu diperluas untuk role/user context yang lebih kaya, dan tombol "Forgot password?" perlu keputusan (isi atau hapus).
- `pages/expenses.vue` — pola table+filter+sort+pagination+modal+toast paling matang di codebase ini dan sangat relevan untuk domain Finance MANOVA, tapi butuh perbaikan bug `handleDelete` dan penyesuaian skema data/kategori.
- `pages/tasks.vue`, `pages/projects/*`, `dashboard/ProjectsTable.vue`, `TasksOverview.vue`, `BudgetChart.vue`, `ExpenseCategories.vue`, `RecentActivity.vue`, `TeamMetrics.vue` — struktur & interaksi (wizard, kanban drag-drop, chart theme-aware, activity feed) sangat reusable, tapi **semua perlu di-refactor jadi props-driven** dan datanya diganti skema MANOVA (bukan sekadar ganti isi data, karena saat ini data & label domain baked-in di dalam komponen).

**3. Replace content but keep structure:**
- `pages/projects/[id]/index.vue` dan `[id]/edit.vue` — arsitektur tab (Overview/Kanban/Timeline/Finances/Files/Activity) sangat cocok jadi kerangka halaman "Project Workspace" MANOVA, tapi seluruh isi (field, istilah, kategori) perlu diganti total ke domain travel (itinerary, traveler, vendor, budget vs actual) sambil mempertahankan strukturnya.

**4. Keep temporarily:**
- `dashboard/AIAssistant.vue` — tidak mengganggu, tapi tidak ada mapping domain yang jelas ke MANOVA di Prompt 0. Dipertahankan dulu sampai ada keputusan.
- Seluruh mock data existing — dipertahankan sebagai referensi pola sampai data terpusat MANOVA dibangun (Prompt 2/berikutnya), tidak dihapus sekarang.

**5. Candidate for removal (bukan tindakan sekarang, hanya dicatat sebagai kandidat untuk divalidasi & diputuskan di tahap berikutnya):**
- Salah satu dari `app/lib/utils.ts` / `app/utils/cn.ts` (duplikat persis).
- `.gradient-primary` utility class di `assets/css/tailwind.css` (tampak tidak dipakai di manapun).
- Salah satu dari `DialogContent.vue` / `DialogScrollContent.vue` (bisa digabung jadi satu dengan prop `scrollable`).
- 2 `console.log` debug di `BudgetChart.vue` dan `ExpenseCategories.vue`.

**6. Unknown and needs validation:**
- 9 menu sidebar tanpa halaman (`/files`, `/clients`, `/team`, `/time-tracking`, `/reports`, `/invoices`, `/templates`, `/integrations`, `/settings`) — beberapa istilahnya relevan dengan domain MANOVA (Clients, Invoices, Reports), tapi keputusan IA final adalah scope Prompt 3, bukan tahap ini.
- Apakah `vee-validate`+`zod` (sudah jadi dependency tapi 0% dipakai) akan mulai dipakai untuk form MANOVA, atau pola validasi manual existing (seperti di `create.vue`/`edit.vue`) yang dilanjutkan.

---

## 11. Candidate Removal

(Lihat kategori 5 di atas — tidak ada satu pun yang dihapus pada tahap ini, sesuai batasan Prompt 1.)

---

## 12. Technical Debt

- Dead devDependency: `@nuxtjs/eslint-config-typescript` terpasang tanpa `eslint` inti dan tanpa config file — lint tidak bisa dijalankan sama sekali saat ini.
- Tidak ada script `lint`/`typecheck`/`test` di `package.json` meski tooling (vitest, test-utils, jsdom) sudah ada — nol test coverage.
- Duplikasi `cn()` (2 file identik).
- Dua komponen Dialog near-duplicate.
- Radius token drift (`ui/` vs `rounded-xl` hardcoded di dashboard components).
- Tidak ada formatter currency/date bersama; nol pemakaian `date-fns` meski terpasang; nol format Rupiah/IDR (wajib ditambahkan sesuai Prompt 0 K.11).
- Peta warna status/priority didefinisikan berulang (3 tempat berbeda) tanpa sumber bersama.
- `useIsMobile()` composable tidak dipakai (dead code fungsional, bukan file mati).
- `ID` generation tidak konsisten (`Date.now()` di 2 tempat, rawan koalisi).
- Model data Project/Task/Expense punya banyak shape tidak sinkron (detail bagian 8) — utang teknis terbesar untuk fase berikutnya.
- Bug laten pembagian oleh nol (`NaN%`) di kalkulasi persentase kategori expense pada `projects/[id]/index.vue` jika suatu saat project punya nol expense.
- Workaround manual untuk bug upstream Reka UI (`DialogPortal` mengunci `overflow` body dan tidak selalu ter-cleanup saat navigasi di tengah animasi close) — didokumentasikan di `onUnmounted` pada `projects/[id]/index.vue`; berpotensi muncul lagi di dialog/sheet lain yang dibuat nanti.
- Chart di `BudgetChart.vue` membaca warna tema hanya sekali saat `onMounted` — tidak reaktif bila tema di-toggle saat runtime (belum jadi masalah karena belum ada theme switcher, tapi laten).

---

## 13. Risks

**Risiko tertinggi — di luar kode, ditemukan selama audit:**
- **Folder `.git` sudah tidak ada di working directory saat ini** (dicek via Git Bash, PowerShell, dan `cmd /a:hd` — konsisten tidak ditemukan). Artinya tidak ada riwayat commit yang bisa diakses/rollback dari lokasi ini saat ini. Sudah dilaporkan langsung ke user secara terpisah; dicatat ulang di sini karena berdampak besar pada keamanan kerja di tahap-tahap selanjutnya (tidak ada jaring pengaman version control).

**Risiko fungsional:**
- Bug nyata: tombol Delete di modal detail `expenses.vue` akan crash (`ReferenceError: handleDelete is not defined`) — dampak langsung ke UX bila didemokan sebelum diperbaiki.
- 9 dead link di sidebar — risiko UX/persepsi "banyak fitur belum jadi" saat demo bila tidak dikelola (disembunyikan/diberi badge "coming soon"/dihapus) sebelum demo.
- Auth mock trivial untuk dilewati (localStorage flag) — aman untuk mockup, tapi **harus dikomunikasikan eksplisit ke stakeholder bahwa ini bukan keamanan nyata**, sejalan dengan larangan Prompt 0 ("jangan mengklaim fitur sudah terintegrasi bila masih mockup").

**Risiko data/konsistensi:**
- Model data yang belum tersentralisasi (bagian 8) adalah risiko terbesar untuk skenario demo Normal/High-Change/Complex Project di Prompt 0 bagian G — bila tidak diselesaikan dengan sengaja sebelum membangun fitur baru, ketidaksesuaian data akan makin sulit diurai.

**Risiko teknis:**
- Tidak adanya lint/typecheck/test otomatis berarti regresi kualitas di tahap-tahap berikutnya tidak akan tertangkap otomatis.

---

## 14. Validation Results

Perintah yang dijalankan (semua "aman" — tidak menginstal/menghapus package baru; `pnpm install` yang pernah dijalankan sebelumnya hanya memakai lockfile existing untuk mempromosikan `typescript` jadi direct dependency, sudah dilaporkan sebagai histori di bagian 2):

| Command | Hasil |
|---|---|
| `pnpm install` (memakai lockfile existing) | Berhasil, tidak ada perubahan dependency graph selain `typescript` yang sudah dijelaskan di atas |
| `npm run build` (`nuxt build`) | **Berhasil, exit code 0**, "✨ Build complete!" — dijalankan dua kali untuk konfirmasi, konsisten sukses |
| Lint | **Tidak bisa dijalankan** — tidak ada script `lint`, tidak ada `eslint` package/config |
| Typecheck | **Tidak dijalankan** — tidak ada script `typecheck`; `nuxt.config.ts` men-set `typeCheck: false`; menjalankan `nuxi typecheck` akan memicu instalasi `vue-tsc` yang belum ada di lockfile, melanggar batasan "jangan memasang library baru" pada tahap ini |
| Test | **Tidak ada yang dijalankan** — 0 file test ditemukan di seluruh repo |

Tidak ada type error, lint error, atau test failure yang bisa dilaporkan karena tooling-nya memang belum tersedia/dikonfigurasi — ini sendiri adalah temuan (dicatat di bagian 12).

---

## 15. Recommended Next Step

1. **Klarifikasi status `.git` ke user** sebelum melakukan pekerjaan besar apa pun di tahap berikutnya (di luar kendali saya untuk memutuskan/memulihkan).
2. Lanjut ke **Prompt 2 (Gap Analysis & Template Reuse Mapping)** setelah user memberi perintah — gunakan kategorisasi reuse di bagian 10 sebagai titik awal.
3. Saat masuk ke tahap implementasi (bukan sekarang): prioritaskan menyentralisasi model data Project/Task/Expense (bagian 8) sebelum menambah fitur baru, agar skenario demo Prompt 0-G tidak mewarisi inkonsistensi yang sudah ada.
4. Pertimbangkan (sebagai rekomendasi, bukan tindakan sekarang) menambah script `lint`/`typecheck`/`test` dan memutuskan nasib `@nuxtjs/eslint-config-typescript` (lengkapi dengan `eslint` inti, atau lepas bila memang tidak akan dipakai) — keputusan ini sebaiknya diambil user/tim, dicatat di `docs/mockup-open-questions.md` pada tahap dokumentasi.
5. Bug `handleDelete` di `expenses.vue` sebaiknya diperbaiki secepatnya begitu tahap implementasi dimulai (bukan pada tahap audit ini) karena berisiko crash saat demo.

---

*Dokumen ini dihasilkan pada tahap Prompt 1 dan bersifat read-only findings. Tidak ada halaman MANOVA yang diimplementasikan, tidak ada menu/route yang di-rename, tidak ada dummy data yang diganti, tidak ada fitur yang dihapus, tidak ada library baru yang dipasang, tidak ada design system yang diubah, tidak ada refactor besar yang dilakukan.*
