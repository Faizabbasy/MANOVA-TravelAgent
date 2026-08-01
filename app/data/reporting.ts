import { reactive } from 'vue'
import type { SavedView } from '~/types/reporting'

/**
 * Fixture Saved Views (Section 22, D-079) — `reactive()` (pola sama seluruh fixture mutable lain),
 * `createSavedView`/`deleteSavedView` (`app/data/index.ts`) memerlukan array reaktif. Dua seed contoh
 * (Dashboard milik Super Admin, Reports milik Management) agar UI "Saved Views" tidak kosong secara
 * default saat didemokan — field `filters` memakai key generik (`status`/`type`/`client`/`owner`/`period`)
 * yang dipetakan balik ke ref filter existing masing-masing halaman saat `applySavedView` dipanggil.
 */
export const SAVED_VIEWS: SavedView[] = reactive([
  {
    id: 'SVW-001',
    userId: 'USR-010',
    page: 'dashboard',
    label: 'Project Confirmed — 60 Hari ke Depan',
    filters: { status: 'confirmed', period: '60' },
    createdAt: '2026-07-28',
  },
  {
    id: 'SVW-002',
    userId: 'USR-003',
    page: 'reports',
    label: 'Project In Progress — Kuartal Ini',
    filters: { status: 'in-progress', period: '90' },
    createdAt: '2026-07-29',
  },
])
