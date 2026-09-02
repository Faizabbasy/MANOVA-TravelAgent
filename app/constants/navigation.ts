import type { Component } from 'vue'
import {
  LayoutDashboard,
  TrendingUp,
  Target,
  Package,
  Wallet,
  Heart,
  Users,
  Building2,
  ClipboardList,
  Route,
  FolderKanban,
  Plane,
  CalendarClock,
  CalendarDays,
  BarChart3,
  Activity,
  FileText,
  ShieldCheck,
  Truck,
  Send,
  GitPullRequest,
  Briefcase,
  ArrowDownToLine,
  ArrowUpFromLine,
  BookOpen,
  UserCog,
  Settings,
  Megaphone
} from 'lucide-vue-next'
import type { ModuleKey, RoleId } from '~/types/user'

export interface NavItem {
  /**
   * Slug stabil, unik lintas seluruh pohon. INI target `RoleMenuGrant` — admin dapat memberi/mencabut
   * satu menu untuk sebuah role lewat Admin > Roles > Menus tanpa perlu membuat modul baru.
   * Sengaja TIDAK diturunkan dari label atau route, supaya rename label / pindah route tidak diam-diam
   * mencabut akses yang sudah diberikan.
   */
  key: string
  label: string
  to: string
  icon: Component
  /** Gerbang default. Bila tidak ada `RoleMenuGrant`, level menu mewarisi level modul ini. Kosong = selalu tampil. */
  moduleKey?: ModuleKey
  /**
   * Narrow role override — DEPRECATED sejak RBAC dinamis. Role literal tidak akan pernah cocok dengan role
   * custom yang dibuat admin. Pakai `moduleKey` + `RoleMenuGrant`, atau capability di dalam halaman.
   */
  roles?: RoleId[]
  /** Halaman belum diimplementasikan penuh — tampil dengan label "Segera". */
  comingSoon?: boolean
  /** Halaman baru hasil Revisi 9-Modul — tampil dengan label "Baru". */
  isNew?: boolean
  /** Hanya SATU level nesting yang didukung `AppSidebar.vue`. */
  children?: NavItem[]
}

/**
 * Navigasi (Penyederhanaan 7-Role/Menu, Agustus 2026) — konsolidasi agresif dari 92 entri (20 top-level +
 * 72 anak) menjadi ±23 entri internal. Prinsip: **halaman digabung jadi tab pada route yang sama, tidak ada
 * fitur yang hilang** — setiap grup di bawah ini adalah SATU halaman tipis berisi `<Tabs>`, tiap tab
 * me-render komponen panel yang isinya dipindah apa adanya dari halaman lama (lihat
 * `app/components/<modul>/*Panel.vue`). Route lama yang menu-nya hilang dari sidebar TETAP hidup sebagai
 * redirect murni (`app/pages/**\/index.vue` yang isinya cuma `navigateTo(...)`) — bookmark/link lama tidak
 * 404, tapi tidak lagi muncul di sidebar. Daftar path-nya ada di `HIDDEN_NAV_ROUTES` di bawah supaya tetap
 * tergerbang RBAC walau sudah tidak ada di `NAV_ITEMS`.
 *
 * Urutan sidebar sengaja menaruh poros bisnis di atas: Dashboard → Operations & Scheduling (Project Order)
 * → Finance & ACC (pencatatan jurnal) → Sales → CRM → Vendor & Partner → HR/Inventory/Marketing →
 * Reporting & BI → Documents → Administration → Vendor Portal → Client Portal.
 *
 * Modul HR/Inventory/Marketing belum punya halaman sendiri — entri navigasinya tetap flat tanpa anak
 * sampai halamannya dibangun, supaya tidak ada menu yang mengarah ke 404.
 *
 * Settings sengaja tidak ada di sini — diakses lewat popover profil (D-022).
 */
export const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', to: '/', icon: LayoutDashboard },
  /** Varian dashboard eksekutif — angka besar + Analytics & Marketing ROI, tanpa widget operasional harian.
   * `moduleKey: 'bi'` sengaja membuat item ini otomatis tersembunyi untuk role tanpa akses Reporting & BI
   * (kebanyakan role selain Management/Super Admin), jadi tidak menambah baris sidebar untuk mereka. */
  { key: 'leader-dashboard', label: 'Leader Dashboard', to: '/leader-dashboard', icon: BarChart3, moduleKey: 'bi' },

  /* ---------- Operations & Scheduling (poros: Project Order) ---------- */
  { key: 'operations', label: 'Project', to: '/project-orders', icon: Route, moduleKey: 'operations' },

  /* ---------- Kalender — sejajar dengan grup lain, bukan anak Operations & Scheduling ---------- */
  { key: 'calendar', label: 'Kalender', to: '/calendar', icon: CalendarDays, moduleKey: 'operations' },

  /* ---------- Finance & ACC (poros: pencatatan jurnal) ---------- */
  {
    key: 'finance',
    label: 'Finance & ACC',
    to: '/finance',
    icon: Wallet,
    moduleKey: 'finance-acc',
    children: [
      { key: 'finance.overview', label: 'Ringkasan', to: '/finance', icon: Wallet, moduleKey: 'finance-acc' },
      { key: 'finance.invoices', label: 'Invoice & Piutang', to: '/finance/invoices', icon: ArrowDownToLine, moduleKey: 'finance-acc' },
      { key: 'finance.payables', label: 'Hutang & Opex', to: '/finance/payables', icon: ArrowUpFromLine, moduleKey: 'finance-acc' },
      { key: 'finance.payments', label: 'Pembayaran & Rekonsiliasi', to: '/finance/payments', icon: Wallet, moduleKey: 'finance-acc' },
      { key: 'finance.ledger', label: 'Buku Besar', to: '/finance/ledger', icon: BookOpen, moduleKey: 'finance-acc' }
    ]
  },

  /* ---------- Sales — "Sales mengurus deal" (seluruh corong Lead→Opportunity→Quotation) ---------- */
  { key: 'sales', label: 'Leads', to: '/sales/pipeline', icon: TrendingUp, moduleKey: 'sales' },

  /* ---------- CRM — "CRM mengurus customer" (data pelanggan, bukan corong deal) ---------- */
  {
    key: 'crm',
    label: 'Customer',
    to: '/customer-journey/customers',
    icon: Heart,
    moduleKey: 'crm',
    children: [
      { key: 'crm.customers', label: 'Database Customer', to: '/customer-journey/customers', icon: Users, moduleKey: 'crm' }
    ]
  },

  /* ---------- Vendor & Partner ---------- */
  {
    key: 'vendor-partner',
    label: 'Vendor & Partner',
    to: '/vendors',
    icon: Building2,
    moduleKey: 'vendor-partner',
    children: [
      { key: 'vendor-partner.directory', label: 'Data Vendor', to: '/vendors', icon: Building2, moduleKey: 'vendor-partner' },
      { key: 'vendor-partner.procurement', label: 'Procurement', to: '/procurement', icon: ClipboardList, moduleKey: 'vendor-partner' }
    ]
  },

  /* ---------- Human Resource / Inventory (tetap top-level, belum bertab) ---------- */
  { key: 'hr', label: 'Karyawan', to: '/hr', icon: UserCog, moduleKey: 'hr', isNew: true },
  { key: 'inventory', label: 'Inventory', to: '/inventory', icon: Package, moduleKey: 'inventory', isNew: true },

  /* Reporting & BI — masih di-hold sementara (diminta hilang dulu dari sidebar).
   * Route tetap hidup, tetap tergerbang RBAC lewat HIDDEN_NAV_ROUTES di bawah. */

  /* ---------- Documents & Communication — entri tunggal, tab Documents/Messages/Notifications di dalam halaman ---------- */
  { key: 'documents', label: 'Documents & Communication', to: '/documents', icon: FileText, moduleKey: 'documents' },

  /* ---------- Marketing & Analysis — ditampilkan lagi di sidebar, di bawah Documents & Communication ---------- */
  { key: 'marketing', label: 'Marketing & Analysis', to: '/marketing', icon: Megaphone, moduleKey: 'marketing' },

  /* ---------- Administration ---------- */
  {
    key: 'administration',
    label: 'Setting',
    to: '/admin',
    icon: Settings,
    moduleKey: 'administration',
    children: [
      { key: 'administration.overview', label: 'Ringkasan & Organisasi', to: '/admin', icon: ShieldCheck, moduleKey: 'administration' },
      { key: 'administration.users', label: 'Users & Roles', to: '/admin/users', icon: Users, moduleKey: 'administration' },
      { key: 'administration.master-data', label: 'Master Data', to: '/admin/master-data', icon: ClipboardList, moduleKey: 'administration' },
      { key: 'administration.audit-trail', label: 'Audit & Activity', to: '/admin/audit-trail', icon: Activity, moduleKey: 'administration' }
    ]
  },

  /**
   * Sistem: Vendor Portal — dulu "Supplier Portal". Rute `/supplier/*` SENGAJA tidak diubah (rename
   * alias-only): `moduleKey` lama `'supplier-portal'` teresolusi ke `'vendor-portal'` lewat
   * `LEGACY_MODULE_ALIAS`, sehingga call-site `canView('supplier-portal')` di halaman-halaman tsb
   * tidak perlu disentuh sama sekali.
   */
  {
    key: 'vendor-portal',
    label: 'Katalog',
    to: '/supplier',
    icon: Truck,
    moduleKey: 'vendor-portal',
    /** Portal eksternal — hanya berguna untuk login vendor itu sendiri, bukan menu yang perlu dilihat
     * Super Admin/staf lain walau modul-nya ter-grant penuh ke mereka. */
    roles: ['vendor'],
    children: [
      { key: 'vendor-portal.home', label: 'Dashboard', to: '/supplier', icon: Truck, moduleKey: 'vendor-portal' },
      { key: 'vendor-portal.products', label: 'Katalog', to: '/supplier/products', icon: Package, moduleKey: 'vendor-portal' },
      { key: 'vendor-portal.orders', label: 'Orders', to: '/supplier/orders', icon: ClipboardList, moduleKey: 'vendor-portal' },
      { key: 'vendor-portal.rfq', label: 'RFQ Inbox', to: '/supplier/rfq', icon: ClipboardList, moduleKey: 'vendor-portal' }
    ]
  },

  /**
   * Sistem: Client Portal — dulu 7 grup beranak 18 entri; tiap grup kini SATU halaman bertab (detail
   * konsolidasi di `docs`/plan), jadi flat tanpa anak lagi.
   */
  /** Portal eksternal — hanya berguna untuk login client itu sendiri, bukan menu yang perlu dilihat Super
   * Admin/staf lain walau modul-nya ter-grant penuh ke mereka (sama seperti Vendor Portal di atas). */
  { key: 'client-portal.dashboard', label: 'Dashboard', to: '/client', icon: LayoutDashboard, moduleKey: 'client-portal', roles: ['client'] },
  { key: 'client-portal.requests', label: 'Request & Approval', to: '/client/travel-requests', icon: Send, moduleKey: 'client-portal', roles: ['client'] },
  { key: 'client-portal.trips', label: 'My Trips', to: '/client/project-orders', icon: FolderKanban, moduleKey: 'client-portal', roles: ['client'] },
  { key: 'client-portal.documents', label: 'Documents & Support', to: '/client/documents', icon: FileText, moduleKey: 'client-portal', roles: ['client'] },
  { key: 'client-portal.billing', label: 'Billing', to: '/client/billing', icon: Wallet, moduleKey: 'client-portal', roles: ['client'] },
  { key: 'client-portal.reports', label: 'Reports & Feedback', to: '/client/reports', icon: BarChart3, moduleKey: 'client-portal', roles: ['client'] },
  { key: 'client-portal.company-profile', label: 'Company Profile', to: '/client/company-profile', icon: Briefcase, moduleKey: 'client-portal', roles: ['client'] }
]

/** Bentuk minimal yang dibutuhkan gerbang RBAC — dipakai bareng oleh `NavItem` dan `HIDDEN_NAV_ROUTES`. */
interface RouteGate {
  key: string
  label: string
  to: string
  moduleKey?: ModuleKey
  children?: RouteGate[]
}

/**
 * Route lama yang menunya sudah dilebur ke menu lain (Penyederhanaan 7-Role/Menu) sehingga TIDAK LAGI ada
 * di `NAV_ITEMS`, tapi route-nya sendiri (redirect stub, atau halaman detail yang menggantung di bawahnya,
 * mis. `/client/quotations/[id]`) tetap hidup — supaya bookmark/link lama tidak 404, dan supaya sidebar
 * yang "disembunyikan" tidak sekadar kosmetik (`findNavItemForPath` mengecek daftar ini juga, dipakai
 * `middleware/rbac.global.ts`). `moduleKey` di sini HARUS sama dengan `moduleKey` menu gabungan tujuannya.
 */
export const HIDDEN_NAV_ROUTES: RouteGate[] = [
  // Operations
  { key: 'hidden.projects-legacy', label: 'Project Workspace (lama)', to: '/projects', moduleKey: 'operations' },
  { key: 'hidden.operations-bookings', label: 'Daftar Booking', to: '/bookings', moduleKey: 'operations' },
  { key: 'hidden.operations-changes', label: 'Change & Incident', to: '/changes', moduleKey: 'operations' },
  { key: 'hidden.operations-calendar', label: 'Booking Calendar & Map', to: '/operations/calendar', moduleKey: 'operations' },
  { key: 'hidden.services', label: 'Service Operations', to: '/services', moduleKey: 'operations' },
  { key: 'hidden.booking-exceptions', label: 'Booking Exceptions', to: '/bookings/exceptions', moduleKey: 'operations' },
  { key: 'hidden.ticketing', label: 'Ticketing', to: '/ticketing', moduleKey: 'operations' },
  { key: 'hidden.accommodation', label: 'Accommodation', to: '/accommodation', moduleKey: 'operations' },
  { key: 'hidden.transportation', label: 'Transportation', to: '/transportation', moduleKey: 'operations' },
  { key: 'hidden.mice', label: 'MICE', to: '/mice', moduleKey: 'operations' },

  // Finance & ACC
  { key: 'hidden.finance-receivables', label: 'Receivables (AR)', to: '/finance/receivables', moduleKey: 'finance-acc' },
  { key: 'hidden.finance-notes', label: 'Credit/Debit Notes', to: '/finance/notes', moduleKey: 'finance-acc' },
  { key: 'hidden.finance-opex', label: 'Opex', to: '/finance/opex', moduleKey: 'finance-acc' },
  { key: 'hidden.finance-reconciliation', label: 'Reconciliation', to: '/finance/reconciliation', moduleKey: 'finance-acc' },
  { key: 'hidden.finance-tax', label: 'Tax & Multi Currency', to: '/finance/tax', moduleKey: 'finance-acc' },

  // Sales (corong lama, kini tab Pipeline) + Produk & Costing lama
  { key: 'hidden.customer-journey', label: 'Customer Journey', to: '/customer-journey', moduleKey: 'sales' },
  { key: 'hidden.leads', label: 'Leads', to: '/customer-journey/leads', moduleKey: 'sales' },
  { key: 'hidden.lead-sources', label: 'Lead Source Recap', to: '/customer-journey/lead-sources', moduleKey: 'sales' },
  { key: 'hidden.opportunities', label: 'Opportunities', to: '/crm/opportunities', moduleKey: 'sales' },
  { key: 'hidden.quotations-internal', label: 'Quotations (internal)', to: '/crm/quotations', moduleKey: 'sales' },
  /** Halaman detail Lead (`/crm/leads/[id]`, dan child `/quotation-preview`) — TIDAK deprecated, satu-satunya tempat
   * membangun Quotation dan menjalankan Commercial Approval setelah Lead B2B di-qualify. Tanpa entri spesifik ini,
   * `findNavItemForPath` jatuh ke entri terpanjang berikutnya yang cocok (`hidden.crm-hub`, `/crm`) sehingga header
   * salah menampilkan "CRM Hub (lama)" — padahal path `/crm/leads/*` tidak terkait section CRM Hub lama itu sama sekali. */
  { key: 'hidden.crm-lead-detail', label: 'Quotation & Approval', to: '/crm/leads', moduleKey: 'sales' },
  { key: 'hidden.product-planning', label: 'Produk & Costing', to: '/product-planning', moduleKey: 'sales' },
  { key: 'hidden.cost-sheets', label: 'Cost Sheets', to: '/product-planning/cost-sheets', moduleKey: 'sales' },

  // CRM
  { key: 'hidden.engagement', label: 'Engagement', to: '/crm/engagement', moduleKey: 'crm' },
  { key: 'hidden.prospects', label: 'Prospects', to: '/crm/prospects', moduleKey: 'crm' },
  { key: 'hidden.clients', label: 'Clients', to: '/crm/clients', moduleKey: 'crm' },
  { key: 'hidden.follow-ups', label: 'Follow-up Otomatis', to: '/crm/follow-ups', moduleKey: 'crm' },
  { key: 'hidden.loyalty', label: 'Loyalty Program', to: '/crm/loyalty', moduleKey: 'crm' },
  { key: 'hidden.crm-feedback', label: 'Review & Feedback', to: '/crm/feedback', moduleKey: 'crm' },
  { key: 'hidden.crm-hub', label: 'CRM Hub (lama)', to: '/crm', moduleKey: 'crm' },

  // Vendor & Partner
  { key: 'hidden.procurement-performance', label: 'Rating & Performance', to: '/procurement/performance', moduleKey: 'vendor-partner' },

  // Reporting & BI / Administration
  { key: 'hidden.bi', label: 'Reporting & BI', to: '/reports', moduleKey: 'bi' },
  { key: 'hidden.reports-analytics', label: 'Analytics & Marketing ROI', to: '/reports/analytics', moduleKey: 'bi' },

  { key: 'hidden.activity-center', label: 'Activity Center', to: '/activity-center', moduleKey: 'administration' },
  { key: 'hidden.session-log', label: 'Log Session', to: '/admin/session-log', moduleKey: 'administration' },
  { key: 'hidden.admin-roles', label: 'Roles & Permissions', to: '/admin/roles', moduleKey: 'administration' },
  { key: 'hidden.admin-organization', label: 'Organization Profile', to: '/admin/organization', moduleKey: 'administration' },

  // Vendor Portal
  { key: 'hidden.supplier-commodities', label: 'Komoditas Saya', to: '/supplier/commodities', moduleKey: 'vendor-portal' },
  { key: 'hidden.supplier-service-orders', label: 'Service Orders', to: '/supplier/service-orders', moduleKey: 'vendor-portal' },
  { key: 'hidden.supplier-commodity-orders', label: 'Vendor Orders', to: '/supplier/commodity-orders', moduleKey: 'vendor-portal' },

  // Client Portal
  { key: 'hidden.client-notifications', label: 'Notifications', to: '/client/notifications', moduleKey: 'client-portal' },
  { key: 'hidden.client-quotations', label: 'Quotations & Proposals', to: '/client/quotations', moduleKey: 'client-portal' },
  { key: 'hidden.client-approvals', label: 'Approval Center', to: '/client/approvals', moduleKey: 'client-portal' },
  { key: 'hidden.client-projects', label: 'Projects', to: '/client/projects', moduleKey: 'client-portal' },
  { key: 'hidden.client-participants', label: 'Participants', to: '/client/participants', moduleKey: 'client-portal' },
  { key: 'hidden.client-itineraries', label: 'Itineraries', to: '/client/itineraries', moduleKey: 'client-portal' },
  { key: 'hidden.client-reservations', label: 'Reservations', to: '/client/reservations', moduleKey: 'client-portal' },
  { key: 'hidden.client-trip-center', label: 'Trip Center', to: '/client/trip-center', moduleKey: 'client-portal' },
  { key: 'hidden.client-change-requests', label: 'Change Requests', to: '/client/change-requests', moduleKey: 'client-portal' },
  { key: 'hidden.client-messages', label: 'Messages & Activities', to: '/client/messages', moduleKey: 'client-portal' },
  { key: 'hidden.client-support', label: 'Issues & Support', to: '/client/support', moduleKey: 'client-portal' },
  { key: 'hidden.client-feedback', label: 'Feedback & Evaluation', to: '/client/feedback', moduleKey: 'client-portal' },
  { key: 'hidden.client-opportunities', label: 'Opportunity (lama)', to: '/client/opportunities', moduleKey: 'client-portal' }
]

/** Seluruh entri (induk + anak) diratakan — dipakai builder menu di Admin > Roles dan middleware RBAC. */
export function flattenNavItems (items: NavItem[] = NAV_ITEMS): NavItem[] {
  return items.flatMap(item => [item, ...flattenNavItems(item.children ?? [])])
}

/**
 * Peta path → NavItem/HIDDEN_NAV_ROUTES terdekat (paling spesifik). Dipakai `middleware/rbac.global.ts`
 * untuk menggerbangi akses URL langsung — tanpa ini, menyembunyikan menu hanya kosmetik. Mencakup
 * `HIDDEN_NAV_ROUTES` supaya route yang sudah tidak tampil di sidebar (redirect stub atau halaman detail
 * yang menggantung di bawah route lama) tetap tergerbang, bukan diam-diam lolos karena tidak lagi ada di
 * `NAV_ITEMS`.
 */
export function findNavItemForPath (path: string): NavItem | undefined {
  const candidates: RouteGate[] = [...flattenNavItems(), ...HIDDEN_NAV_ROUTES]
    .filter((item) => {
      const base = item.to.split('?')[0]
      if (base === '/') { return path === '/' }
      return path === base || path.startsWith(`${base}/`)
    })
    .sort((a, b) => {
      const byDepth = b.to.split('?')[0].length - a.to.split('?')[0].length
      if (byDepth !== 0) { return byDepth }
      /**
       * Route induk grup sering sama persis dengan salah satu anaknya (mis. grup "Sales" menunjuk ke
       * `/sales/pipeline`). Saat seri, pilih daun — itulah entri yang di-grant admin per-menu.
       */
      return Number(Boolean(a.children?.length)) - Number(Boolean(b.children?.length))
    })
  return candidates[0] as NavItem | undefined
}
