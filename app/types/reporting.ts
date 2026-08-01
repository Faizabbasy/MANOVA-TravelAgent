import type { ID } from './common'

/**
 * Saved Views (Section 22 — Dashboards, Reports, Lead Recap dan Activity Center, roadmap Section 00–24
 * baru). Snapshot filter Dashboard (`/`) atau Reports (`/reports`) yang dapat disimpan dan diterapkan
 * ulang oleh user yang sama — TIDAK menambah filter baru, murni membungkus filter ref yang SUDAH ADA di
 * kedua halaman (`statusFilter`/`typeFilter`/`clientFilter`/`ownerFilter`/`periodFilter` di Dashboard;
 * `statusFilter`/`typeFilter`/`periodFilter` di Reports). `filters` disimpan sebagai `Record<string, string>`
 * generik (bukan union type per-halaman) karena kedua halaman punya bentuk filter yang mirip tapi tidak
 * identik — page-level yang bertanggung jawab memetakan field yang relevan saat `applySavedView` dipanggil.
 * Centralized reactive mock state (pola sama seluruh fixture lain) — SENGAJA BUKAN localStorage/sessionStorage
 * agar konsisten dengan seluruh section sebelumnya (lihat D-079).
 */
export type SavedViewPage = 'dashboard' | 'reports'

export interface SavedView {
  id: ID
  userId: ID
  page: SavedViewPage
  label: string
  filters: Record<string, string>
  createdAt: string
}
