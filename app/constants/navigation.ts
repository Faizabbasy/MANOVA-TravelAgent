import type { Component } from 'vue'
import {
  LayoutDashboard,
  Target,
  FolderKanban,
  Building2,
  Wallet,
  BarChart3,
  ShieldCheck,
  Route,
  Activity,
  Truck,
} from 'lucide-vue-next'
import type { ModuleKey, RoleId } from '~/types/user'

export interface NavItem {
  label: string
  to: string
  icon: Component
  /** Module dipakai untuk role-visibility check (docs/route-and-role-matrix.md bagian 5). Kosong = selalu tampil. */
  moduleKey?: ModuleKey
  /**
   * Narrow role-visibility override (Prompt 19 — Change Request) — dipakai HANYA saat granularity modul
   * (`moduleKey`) tidak cukup presisi (mis. Activity Center literal Super Admin saja, sedangkan modul
   * `administration` juga memberi Management/Viewer `VIEW`). Bila diisi, item hanya tampil untuk role di
   * daftar ini (menggantikan cek `moduleKey`, bukan menambahkannya) — pola yang sama seperti narrow role
   * exception di halaman (`canManageOpportunity` dst.), diterapkan di level visibilitas nav.
   */
  roles?: RoleId[]
  /** Halaman belum diimplementasikan penuh — tampil dengan label "Segera" (Prompt 5-D). */
  comingSoon?: boolean
  children?: NavItem[]
}

/**
 * Satu source of truth navigation (Prompt 5-D), mengikuti docs/mockup-information-architecture.md bagian 2-3
 * dan docs/route-and-role-matrix.md bagian 0. Settings sengaja tidak ada di sini — diakses lewat popover
 * profil (D-022), bukan sidebar utama.
 */
export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', to: '/', icon: LayoutDashboard },
  /**
   * Customer Journey (Prompt 19). Sales dibatasi ke Leads saja (docs Prompt 19-10 "Sales: terbatas pada
   * Lead") — Customers/Project Orders/Lead Source Recap pakai `roles` override (daftar seluruh role dengan
   * `crm` VIEW+ MINUS `sales`), Leads sendiri tetap `moduleKey: 'crm'` generik (Sales tetap perlu akses).
   */
  {
    label: 'Customer Journey',
    to: '/customer-journey',
    icon: Route,
    moduleKey: 'crm',
    children: [
      { label: 'Leads', to: '/customer-journey/leads', icon: Route, moduleKey: 'crm' },
      { label: 'Customers', to: '/customer-journey/customers', icon: Route, roles: ['super-admin', 'management', 'account-executive', 'project-manager', 'finance', 'viewer'] },
      { label: 'Project Orders', to: '/customer-journey/project-orders', icon: Route, roles: ['super-admin', 'management', 'account-executive', 'project-manager', 'finance', 'viewer'] },
      { label: 'Lead Source Recap', to: '/customer-journey/lead-sources', icon: Route, roles: ['super-admin', 'management', 'account-executive', 'project-manager', 'finance', 'viewer'] },
    ],
  },
  {
    label: 'CRM',
    to: '/crm',
    icon: Target,
    moduleKey: 'crm',
    children: [
      { label: 'Prospects', to: '/crm/prospects', icon: Target, moduleKey: 'crm' },
      { label: 'Clients', to: '/crm/clients', icon: Target, moduleKey: 'crm' },
      { label: 'Opportunities', to: '/crm/opportunities', icon: Target, moduleKey: 'crm' },
      { label: 'Quotations', to: '/crm/quotations', icon: Target, moduleKey: 'crm', comingSoon: true },
    ],
  },
  { label: 'Projects', to: '/projects', icon: FolderKanban, moduleKey: 'project' },
  { label: 'Vendors', to: '/vendors', icon: Building2, moduleKey: 'vendor' },
  {
    label: 'Finance',
    to: '/finance',
    icon: Wallet,
    moduleKey: 'finance',
    children: [
      { label: 'Invoices', to: '/finance/invoices', icon: Wallet, moduleKey: 'finance' },
      { label: 'Payments', to: '/finance/payments', icon: Wallet, moduleKey: 'finance' },
    ],
  },
  { label: 'Reports', to: '/reports', icon: BarChart3, moduleKey: 'reports' },
  /** Activity Center (Prompt 19) — literal "Super Admin Dashboard" saja, `roles` override karena modul `administration` juga memberi Management/Viewer `VIEW`. */
  { label: 'Activity Center', to: '/activity-center', icon: Activity, roles: ['super-admin'] },
  {
    label: 'Administration',
    to: '/admin',
    icon: ShieldCheck,
    moduleKey: 'administration',
    children: [
      { label: 'Master Data', to: '/admin/master-data', icon: ShieldCheck, moduleKey: 'administration' },
      { label: 'Users', to: '/admin/users', icon: ShieldCheck, moduleKey: 'administration' },
      { label: 'Roles and Permissions', to: '/admin/roles', icon: ShieldCheck, moduleKey: 'administration' },
      { label: 'Audit Trail', to: '/admin/audit-trail', icon: ShieldCheck, moduleKey: 'administration' },
    ],
  },
  /** Supplier Portal (Prompt 19) — External Partners, hanya `supplier` (dan Super Admin untuk oversight, lihat `ROLE_MODULE_ACCESS['supplier-portal']`). */
  {
    label: 'Supplier Portal',
    to: '/supplier',
    icon: Truck,
    moduleKey: 'supplier-portal',
    children: [
      { label: 'Products', to: '/supplier/products', icon: Truck, moduleKey: 'supplier-portal' },
      { label: 'Orders', to: '/supplier/orders', icon: Truck, moduleKey: 'supplier-portal' },
    ],
  },
]
