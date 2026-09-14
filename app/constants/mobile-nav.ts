import type { Component } from 'vue'
import { LayoutDashboard, Route, ListChecks, CalendarDays, FolderKanban, Wallet, FileText } from 'lucide-vue-next'

export interface MobileTabItem {
  /** Sengaja disamakan dengan `NavItem.key` di `~/constants/navigation` bila memungkinkan, supaya
   * gating RBAC (`canViewMenu`) dan active-state bisa memakai sumber yang sama. */
  key: string
  label: string
  to: string
  icon: Component
}

/**
 * 4 slot bottom-tab untuk role internal (bukan client), disepakati manual — BUKAN hasil filter
 * otomatis dari `NAV_ITEMS`, karena "Tugas" dan "Kalender" adalah child dari grup "Operasional",
 * bukan entri top-level. Slot ke-5 ("Lainnya") dirender terpisah oleh `MobileBottomNav.vue`.
 */
export const INTERNAL_MOBILE_TABS: MobileTabItem[] = [
  { key: 'dashboard', label: 'Dashboard', to: '/', icon: LayoutDashboard },
  { key: 'operations', label: 'Project', to: '/project-orders', icon: Route },
  { key: 'operasional.tasks', label: 'Tugas', to: '/tasks', icon: ListChecks },
  { key: 'operasional.calendar', label: 'Kalender', to: '/calendar', icon: CalendarDays }
]

/** 4 slot bottom-tab untuk role client (portal eksternal). */
export const CLIENT_MOBILE_TABS: MobileTabItem[] = [
  { key: 'client-portal.dashboard', label: 'Dashboard', to: '/client', icon: LayoutDashboard },
  { key: 'client-portal.trips', label: 'My Trips', to: '/client/project-orders', icon: FolderKanban },
  { key: 'client-portal.billing', label: 'Billing', to: '/client/billing', icon: Wallet },
  { key: 'client-portal.documents', label: 'Documents & Support', to: '/client/documents', icon: FileText }
]
