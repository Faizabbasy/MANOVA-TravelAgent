import {
  LEADS, LEAD_ACTIVITIES,
  PARTIES, CONTACTS, PARTY_ACTIVITIES,
  OPPORTUNITIES, QUOTATIONS,
  PROJECTS, PROJECT_SERVICES, TRAVELER_GROUPS, TRAVELERS, ROOM_ASSIGNMENTS, ITINERARY_ITEMS,
  VENDORS, VENDOR_CONTACTS, VENDOR_QUOTATIONS, VENDOR_ACTIVITIES, VENDOR_PRODUCTS,
  INVOICES, PAYMENTS,
  ACTIVITIES, DOCUMENTS, TASKS
} from '~/data'
import { USERS } from '~/data/users'
import { ROLE_DEFINITIONS, ROLE_MODULE_GRANTS, ROLE_MENU_GRANTS, ROLE_CAPABILITY_GRANTS } from '~/data/rbac'
import { captureMockSnapshot } from '~/utils/mock-reset'

/**
 * Client-only (Section 01) — menyimpan snapshot seed seluruh reactive array terpusat SEDINI mungkin
 * (sebelum interaksi user apa pun bisa memutasinya), agar `resetMockState()` (Settings → "Reset Demo Data")
 * benar-benar mengembalikan ke data seed asli, bukan state yang sudah sempat berubah.
 */
export default defineNuxtPlugin(() => {
  captureMockSnapshot({
    LEADS,
    LEAD_ACTIVITIES,
    PARTIES,
    CONTACTS,
    PARTY_ACTIVITIES,
    OPPORTUNITIES,
    QUOTATIONS,
    PROJECTS,
    PROJECT_SERVICES,
    TRAVELER_GROUPS,
    TRAVELERS,
    ROOM_ASSIGNMENTS,
    ITINERARY_ITEMS,
    VENDORS,
    VENDOR_CONTACTS,
    VENDOR_QUOTATIONS,
    VENDOR_ACTIVITIES,
    VENDOR_PRODUCTS,
    INVOICES,
    PAYMENTS,
    ACTIVITIES,
    DOCUMENTS,
    TASKS,
    /**
     * RBAC (Revisi 9-Modul) — WAJIB terdaftar. Tanpa backend, konfigurasi permission yang salah tidak bisa
     * dipulihkan dari server; "Reset Demo Data" harus ikut mengembalikan role & grant, bukan hanya user.
     * (Tersedia juga pemulihan yang lebih tepat sasaran lewat `resetRbacToDefaults()` di Settings.)
     */
    USERS,
    ROLE_DEFINITIONS,
    ROLE_MODULE_GRANTS,
    ROLE_MENU_GRANTS,
    ROLE_CAPABILITY_GRANTS
  })
})
