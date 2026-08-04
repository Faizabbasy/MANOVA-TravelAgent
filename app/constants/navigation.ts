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
  BedDouble,
  Bus,
  Presentation,
  CalendarClock,
  AlertTriangle,
  BarChart3,
  Activity,
  FileText,
  ShieldCheck,
  Truck,
  Bell,
  Send,
  ClipboardCheck,
  Calendar,
  Compass,
  GitPullRequest,
  MessageSquare,
  LifeBuoy,
  Star,
  Briefcase,
  ArrowDownToLine,
  ArrowUpFromLine,
  TrendingDown,
  BookOpen,
  Percent,
  UserCog,
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
 * Navigasi 9 modul (Revisi 9-Modul) — menggantikan 26 entri top-level lama yang tumbuh organik per-section.
 * Urutan modul mengikuti daftar yang diminta klien:
 *   1 Sales · 2 Finance & ACC · 3 CRM · 4 Vendor & Partner · 5 Operations & Scheduling
 *   6 HR · 7 Inventory · 8 Marketing & Analysis · 9 Reporting & BI
 * disusul modul sistem: Documents, Administration, Vendor Portal, dan Client Portal.
 *
 * Modul 6-8 (HR, Inventory, Marketing) belum punya halaman — entri navigasinya ditambahkan pada fase
 * pembangunan masing-masing, BUKAN sekarang, supaya tidak ada menu yang mengarah ke 404.
 *
 * Settings sengaja tidak ada di sini — diakses lewat popover profil (D-022).
 */
export const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', to: '/', icon: LayoutDashboard },

  /* ---------- 1. Sales ---------- */
  {
    key: 'sales',
    label: 'Sales',
    to: '/crm/opportunities',
    icon: TrendingUp,
    moduleKey: 'sales',
    children: [
      { key: 'sales.leads', label: 'Leads', to: '/customer-journey/leads', icon: Route, moduleKey: 'sales' },
      { key: 'sales.opportunities', label: 'Opportunities', to: '/crm/opportunities', icon: Target, moduleKey: 'sales' },
      { key: 'sales.quotations', label: 'Quotation & Invoice', to: '/crm/quotations', icon: FileText, moduleKey: 'sales' },
      { key: 'sales.product-templates', label: 'Product Templates', to: '/product-planning', icon: Package, moduleKey: 'sales' },
      { key: 'sales.cost-sheets', label: 'Cost Sheets', to: '/product-planning/cost-sheets', icon: Package, moduleKey: 'sales' },
      { key: 'sales.lead-intake', label: 'Form Lead Intake', to: '/lead-intake', icon: Send, moduleKey: 'sales' }
    ]
  },

  /* ---------- 2. Finance & ACC ---------- */
  {
    key: 'finance',
    label: 'Finance & ACC',
    to: '/finance',
    icon: Wallet,
    moduleKey: 'finance-acc',
    children: [
      { key: 'finance.overview', label: 'Ringkasan', to: '/finance', icon: Wallet, moduleKey: 'finance-acc' },
      { key: 'finance.invoices', label: 'Invoices', to: '/finance/invoices', icon: Wallet, moduleKey: 'finance-acc' },
      { key: 'finance.receivables', label: 'Receivables (AR)', to: '/finance/receivables', icon: ArrowDownToLine, moduleKey: 'finance-acc', isNew: true },
      { key: 'finance.payables', label: 'Payables (AP)', to: '/finance/payables', icon: ArrowUpFromLine, moduleKey: 'finance-acc', isNew: true },
      { key: 'finance.payments', label: 'Payments', to: '/finance/payments', icon: Wallet, moduleKey: 'finance-acc' },
      { key: 'finance.opex', label: 'Opex', to: '/finance/opex', icon: TrendingDown, moduleKey: 'finance-acc', isNew: true },
      { key: 'finance.ledger', label: 'General Ledger & Revenue', to: '/finance/ledger', icon: BookOpen, moduleKey: 'finance-acc', isNew: true },
      { key: 'finance.tax', label: 'Tax & Multi Currency', to: '/finance/tax', icon: Percent, moduleKey: 'finance-acc', isNew: true },
      { key: 'finance.notes', label: 'Credit/Debit Notes', to: '/finance/notes', icon: Wallet, moduleKey: 'finance-acc' },
      { key: 'finance.reconciliation', label: 'Reconciliation', to: '/finance/reconciliation', icon: Wallet, moduleKey: 'finance-acc' }
    ]
  },

  /* ---------- 3. CRM ---------- */
  {
    key: 'crm',
    label: 'CRM',
    to: '/customer-journey',
    icon: Heart,
    moduleKey: 'crm',
    children: [
      { key: 'crm.journey', label: 'Customer Journey', to: '/customer-journey', icon: Route, moduleKey: 'crm' },
      { key: 'crm.customers', label: 'Database Customer', to: '/customer-journey/customers', icon: Users, moduleKey: 'crm' },
      { key: 'crm.prospects', label: 'Prospects', to: '/crm/prospects', icon: Users, moduleKey: 'crm' },
      { key: 'crm.clients', label: 'Clients', to: '/crm/clients', icon: Users, moduleKey: 'crm' },
      { key: 'crm.follow-ups', label: 'Follow-up Otomatis', to: '/crm/follow-ups', icon: Bell, moduleKey: 'crm', isNew: true },
      { key: 'crm.loyalty', label: 'Loyalty Program', to: '/crm/loyalty', icon: Star, moduleKey: 'crm', isNew: true },
      { key: 'crm.feedback', label: 'Review & Feedback', to: '/crm/feedback', icon: MessageSquare, moduleKey: 'crm', isNew: true },
      { key: 'crm.lead-sources', label: 'Lead Source Recap', to: '/customer-journey/lead-sources', icon: BarChart3, moduleKey: 'crm' }
    ]
  },

  /* ---------- 4. Vendor & Partner Management ---------- */
  {
    key: 'vendor-partner',
    label: 'Vendor & Partner',
    to: '/vendors',
    icon: Building2,
    moduleKey: 'vendor-partner',
    children: [
      { key: 'vendor-partner.directory', label: 'Data Vendor', to: '/vendors', icon: Building2, moduleKey: 'vendor-partner' },
      { key: 'vendor-partner.rfq', label: 'RFQ', to: '/procurement', icon: ClipboardList, moduleKey: 'vendor-partner' },
      { key: 'vendor-partner.service-orders', label: 'Service Orders', to: '/procurement?tab=service-orders', icon: ClipboardList, moduleKey: 'vendor-partner' },
      { key: 'vendor-partner.performance', label: 'Rating & Performance', to: '/procurement/performance', icon: Star, moduleKey: 'vendor-partner' }
    ]
  },

  /* ---------- 5. Operations & Scheduling ---------- */
  {
    key: 'operations',
    label: 'Operations & Scheduling',
    to: '/project-orders',
    icon: Route,
    moduleKey: 'operations',
    children: [
      { key: 'operations.project-orders', label: 'Project Orders', to: '/project-orders', icon: FolderKanban, moduleKey: 'operations', isNew: true },
      { key: 'operations.projects-legacy', label: 'Project Workspace (Detail)', to: '/projects', icon: FolderKanban, moduleKey: 'operations' },
      { key: 'operations.calendar', label: 'Booking Calendar & Map', to: '/operations/calendar', icon: Calendar, moduleKey: 'operations', isNew: true },
      { key: 'operations.bookings', label: 'Booking Center', to: '/bookings', icon: CalendarClock, moduleKey: 'operations' },
      { key: 'operations.booking-exceptions', label: 'Booking Exceptions', to: '/bookings/exceptions', icon: AlertTriangle, moduleKey: 'operations' },
      { key: 'operations.changes', label: 'Change Request & Incident', to: '/changes', icon: GitPullRequest, moduleKey: 'operations' },
      { key: 'operations.ticketing', label: 'Ticketing', to: '/ticketing', icon: Plane, moduleKey: 'operations' },
      { key: 'operations.accommodation', label: 'Accommodation', to: '/accommodation', icon: BedDouble, moduleKey: 'operations' },
      { key: 'operations.transportation', label: 'Transportation', to: '/transportation', icon: Bus, moduleKey: 'operations' },
      { key: 'operations.mice', label: 'MICE', to: '/mice', icon: Presentation, moduleKey: 'operations' }
    ]
  },

  /* ---------- 6. Human Resource Management ---------- */
  { key: 'hr', label: 'Human Resource', to: '/hr', icon: UserCog, moduleKey: 'hr', isNew: true },

  /* ---------- 7. Inventory ---------- */
  { key: 'inventory', label: 'Inventory', to: '/inventory', icon: Package, moduleKey: 'inventory', isNew: true },

  /* ---------- 8. Marketing & Analysis ---------- */
  { key: 'marketing', label: 'Marketing & Analysis', to: '/marketing', icon: Megaphone, moduleKey: 'marketing', isNew: true },

  /* ---------- 9. Reporting & Business Intelligence ---------- */
  {
    key: 'bi',
    label: 'Reporting & BI',
    to: '/reports',
    icon: BarChart3,
    moduleKey: 'bi',
    children: [
      { key: 'bi.reports', label: 'Reports', to: '/reports', icon: BarChart3, moduleKey: 'bi' },
      { key: 'bi.analytics', label: 'Analytics & Marketing ROI', to: '/reports/analytics', icon: TrendingUp, moduleKey: 'bi', isNew: true },
      { key: 'bi.activity-center', label: 'Activity Center', to: '/activity-center', icon: Activity, moduleKey: 'administration' }
    ]
  },

  /* ---------- Sistem: Documents ---------- */
  {
    key: 'documents',
    label: 'Documents & Communication',
    to: '/documents',
    icon: FileText,
    moduleKey: 'documents',
    children: [
      { key: 'documents.files', label: 'Documents', to: '/documents', icon: FileText, moduleKey: 'documents' },
      { key: 'documents.messages', label: 'Messages', to: '/documents?tab=messages', icon: MessageSquare, moduleKey: 'documents' },
      { key: 'documents.notifications', label: 'Notifications', to: '/documents?tab=notifications', icon: Bell, moduleKey: 'documents' }
    ]
  },

  /* ---------- Sistem: Administration ---------- */
  {
    key: 'administration',
    label: 'Administration',
    to: '/admin',
    icon: ShieldCheck,
    moduleKey: 'administration',
    children: [
      { key: 'administration.overview', label: 'Ringkasan', to: '/admin', icon: ShieldCheck, moduleKey: 'administration' },
      { key: 'administration.users', label: 'Users', to: '/admin/users', icon: Users, moduleKey: 'administration' },
      { key: 'administration.roles', label: 'Roles & Permissions', to: '/admin/roles', icon: ShieldCheck, moduleKey: 'administration' },
      { key: 'administration.master-data', label: 'Master Data', to: '/admin/master-data', icon: ClipboardList, moduleKey: 'administration' },
      { key: 'administration.audit-trail', label: 'Audit Trail', to: '/admin/audit-trail', icon: Activity, moduleKey: 'administration' },
      { key: 'administration.organization', label: 'Organization Profile', to: '/admin/organization', icon: Building2, moduleKey: 'administration' }
    ]
  },

  /**
   * Sistem: Vendor Portal — dulu "Supplier Portal". Rute `/supplier/*` SENGAJA tidak diubah (rename
   * alias-only): `moduleKey` lama `'supplier-portal'` teresolusi ke `'vendor-portal'` lewat
   * `LEGACY_MODULE_ALIAS`, sehingga 12 call-site `canView('supplier-portal')` di halaman-halaman tsb
   * tidak perlu disentuh sama sekali.
   */
  {
    key: 'vendor-portal',
    label: 'Vendor Portal',
    to: '/supplier',
    icon: Truck,
    moduleKey: 'vendor-portal',
    children: [
      { key: 'vendor-portal.home', label: 'Dashboard', to: '/supplier', icon: Truck, moduleKey: 'vendor-portal' },
      { key: 'vendor-portal.products', label: 'Products', to: '/supplier/products', icon: Package, moduleKey: 'vendor-portal' },
      { key: 'vendor-portal.orders', label: 'Orders', to: '/supplier/orders', icon: ClipboardList, moduleKey: 'vendor-portal' },
      { key: 'vendor-portal.rfq', label: 'RFQ Inbox', to: '/supplier/rfq', icon: ClipboardList, moduleKey: 'vendor-portal' },
      { key: 'vendor-portal.service-orders', label: 'Service Orders', to: '/supplier/service-orders', icon: ClipboardList, moduleKey: 'vendor-portal' },
      { key: 'vendor-portal.commodities', label: 'Komoditas Saya', to: '/supplier/commodities', icon: Package, moduleKey: 'vendor-portal' },
      { key: 'vendor-portal.commodity-orders', label: 'Vendor Orders', to: '/supplier/commodity-orders', icon: Package, moduleKey: 'vendor-portal' }
    ]
  },

  /* ---------- Sistem: Client Portal (7 grup, hanya untuk role `client`) ---------- */
  {
    key: 'client-portal.home',
    label: 'Home',
    to: '/client',
    icon: LayoutDashboard,
    moduleKey: 'client-portal',
    children: [
      { key: 'client-portal.dashboard', label: 'Dashboard', to: '/client', icon: LayoutDashboard, moduleKey: 'client-portal' },
      { key: 'client-portal.notifications', label: 'Notifications', to: '/client/notifications', icon: Bell, moduleKey: 'client-portal' }
    ]
  },
  {
    key: 'client-portal.commercial',
    label: 'Request & Commercial',
    to: '/client/travel-requests',
    icon: Send,
    moduleKey: 'client-portal',
    children: [
      { key: 'client-portal.travel-requests', label: 'Travel Requests', to: '/client/travel-requests', icon: Send, moduleKey: 'client-portal' },
      { key: 'client-portal.quotations', label: 'Quotations & Proposals', to: '/client/quotations', icon: FileText, moduleKey: 'client-portal' },
      { key: 'client-portal.approvals', label: 'Approval Center', to: '/client/approvals', icon: ClipboardCheck, moduleKey: 'client-portal' }
    ]
  },
  {
    key: 'client-portal.travel',
    label: 'Travel Management',
    to: '/client/projects',
    icon: FolderKanban,
    moduleKey: 'client-portal',
    children: [
      { key: 'client-portal.projects', label: 'Projects', to: '/client/projects', icon: FolderKanban, moduleKey: 'client-portal' },
      { key: 'client-portal.participants', label: 'Participants', to: '/client/participants', icon: Users, moduleKey: 'client-portal' },
      { key: 'client-portal.itineraries', label: 'Itineraries', to: '/client/itineraries', icon: Calendar, moduleKey: 'client-portal' },
      { key: 'client-portal.reservations', label: 'Reservations', to: '/client/reservations', icon: CalendarClock, moduleKey: 'client-portal' },
      { key: 'client-portal.trip-center', label: 'Trip Center', to: '/client/trip-center', icon: Compass, moduleKey: 'client-portal' },
      { key: 'client-portal.change-requests', label: 'Change Requests', to: '/client/change-requests', icon: GitPullRequest, moduleKey: 'client-portal' }
    ]
  },
  {
    key: 'client-portal.collaboration',
    label: 'Collaboration',
    to: '/client/documents',
    icon: FileText,
    moduleKey: 'client-portal',
    children: [
      { key: 'client-portal.documents', label: 'Documents', to: '/client/documents', icon: FileText, moduleKey: 'client-portal' },
      { key: 'client-portal.messages', label: 'Messages & Activities', to: '/client/messages', icon: MessageSquare, moduleKey: 'client-portal' },
      { key: 'client-portal.support', label: 'Issues & Support', to: '/client/support', icon: LifeBuoy, moduleKey: 'client-portal' }
    ]
  },
  { key: 'client-portal.billing', label: 'Finance & Billing', to: '/client/billing', icon: Wallet, moduleKey: 'client-portal' },
  {
    key: 'client-portal.insights',
    label: 'Insights',
    to: '/client/reports',
    icon: BarChart3,
    moduleKey: 'client-portal',
    children: [
      { key: 'client-portal.reports', label: 'Reports & Analytics', to: '/client/reports', icon: BarChart3, moduleKey: 'client-portal' },
      { key: 'client-portal.feedback', label: 'Feedback & Evaluation', to: '/client/feedback', icon: Star, moduleKey: 'client-portal' }
    ]
  },
  { key: 'client-portal.company-profile', label: 'Company Profile', to: '/client/company-profile', icon: Briefcase, moduleKey: 'client-portal' }
]

/** Seluruh entri (induk + anak) diratakan — dipakai builder menu di Admin > Roles dan middleware RBAC. */
export function flattenNavItems (items: NavItem[] = NAV_ITEMS): NavItem[] {
  return items.flatMap(item => [item, ...flattenNavItems(item.children ?? [])])
}

/**
 * Peta path → NavItem key terdekat (paling spesifik). Dipakai `middleware/rbac.global.ts` untuk
 * menggerbangi akses URL langsung — tanpa ini, menyembunyikan menu hanya kosmetik.
 */
export function findNavItemForPath (path: string): NavItem | undefined {
  const candidates = flattenNavItems()
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
       * `/crm/opportunities`). Saat seri, pilih daun — itulah entri yang di-grant admin per-menu.
       */
      return Number(Boolean(a.children?.length)) - Number(Boolean(b.children?.length))
    })
  return candidates[0]
}
