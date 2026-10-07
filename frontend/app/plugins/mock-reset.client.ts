import {
  LEADS, LEAD_ACTIVITIES,
  PARTIES, CONTACTS, PARTY_ACTIVITIES,
  QUOTATIONS,
  PROJECTS, PROJECT_SERVICES, TRAVELER_GROUPS, TRAVELERS, ROOM_ASSIGNMENTS, ITINERARY_ITEMS,
  VENDORS, VENDOR_CONTACTS, VENDOR_QUOTATIONS, VENDOR_ACTIVITIES, VENDOR_PRODUCTS,
  INVOICES, PAYMENTS, CREDIT_NOTES,
  ACTIVITIES, DOCUMENTS, TASKS,
  SALES_ORDERS
} from '~/data'
import { USERS } from '~/data/users'
import { ROLE_DEFINITIONS, ROLE_MODULE_GRANTS, ROLE_MENU_GRANTS, ROLE_CAPABILITY_GRANTS } from '~/data/rbac'
import { OPEX_ENTRIES, PROJECT_EXPENSES } from '~/data/finance-ext'
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
    CREDIT_NOTES,
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
    ROLE_CAPABILITY_GRANTS,
    /** `CREDIT_NOTES`/`OPEX_ENTRIES` are sources of `getJournalEntries()`: reset them with the rest. */
    OPEX_ENTRIES,
    /** `PROJECT_EXPENSES` (pengeluaran project ad-hoc) — mutable lewat `createProjectExpense()`, sama seperti `OPEX_ENTRIES` di atas, ikut jadi sumber `getJournalEntries()`/`getProjectActualCostIdr()`. */
    PROJECT_EXPENSES,
    /**
     * Sales Order (B2C individual) — `SALES_ORDERS` dimutasi oleh `createSalesOrder()`/`updateSalesOrderStatus()`.
     * Wajib didaftarkan bersama `PARTIES`: tanpa ini, "Reset Demo Data" mengembalikan `PARTIES` (menghapus
     * customer individual yang baru dibuat) tapi meninggalkan `SALES_ORDERS` menunjuk ke customer yang sudah
     * tidak ada.
     */
    SALES_ORDERS
  })
})
