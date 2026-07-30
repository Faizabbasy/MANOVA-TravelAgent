import type { Component } from 'vue'
import {
  LayoutDashboard,
  Target,
  FolderKanban,
  Building2,
  Wallet,
  BarChart3,
  ShieldCheck,
} from 'lucide-vue-next'
import type { ModuleKey } from '~/types/user'

export interface NavItem {
  label: string
  to: string
  icon: Component
  /** Module dipakai untuk role-visibility check (docs/route-and-role-matrix.md bagian 5). Kosong = selalu tampil. */
  moduleKey?: ModuleKey
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
]
