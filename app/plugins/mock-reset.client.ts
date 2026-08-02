import {
  LEADS, LEAD_ACTIVITIES,
  PARTIES, CONTACTS, PARTY_ACTIVITIES,
  OPPORTUNITIES, QUOTATIONS,
  PROJECTS, PROJECT_SERVICES, TRAVELER_GROUPS, TRAVELERS, ROOM_ASSIGNMENTS, ITINERARY_ITEMS,
  VENDORS, VENDOR_CONTACTS, VENDOR_QUOTATIONS, VENDOR_ACTIVITIES, VENDOR_PRODUCTS,
  INVOICES, PAYMENTS,
  ACTIVITIES, DOCUMENTS, TASKS
} from '~/data'
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
    TASKS
  })
})
