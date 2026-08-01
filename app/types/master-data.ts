import type { ID } from './common'

/**
 * Master Data (Section 17 lama — dipertahankan apa adanya; Section 23 — Administration, Master Data dan
 * Audit, roadmap Section 00–24 baru — migrasi ke reactive editable state + 11 kategori baru). Shape
 * `MasterDataItem` TIDAK diubah (id/label/description/isActive) agar konsumen lama tidak perlu berubah;
 * yang berubah hanyalah lokasi (`app/constants/master-data.ts` → `app/data/master-data.ts`) dan
 * mutabilitas (`reactive()`).
 */
export interface MasterDataItem {
  id: ID
  label: string
  description?: string
  isActive: boolean
}

/**
 * Operational Reference — Section 23, kategori baru. Daftar referensi admin-configurable SAJA — TIDAK
 * ditautkan sebagai foreign key ke `FlightBooking`/`HotelBooking` (Section 13-14, LOCKED), yang tetap
 * memakai field bebas teks/bisnis apa adanya. Lihat D-080 untuk batas non-integrasi ini secara eksplisit.
 */
export interface Airport {
  id: ID
  iataCode: string
  name: string
  city: string
  isActive: boolean
}

export interface Airline {
  id: ID
  iataCode: string
  name: string
  isActive: boolean
}

export interface Hotel {
  id: ID
  name: string
  city: string
  starRating?: number
  isActive: boolean
}

/**
 * Commercial & Finance — Section 23, kategori baru, seluruhnya reference/configuration data. `MasterCurrency`
 * berelasi konseptual dengan `Invoice.currency` (Section 20) tapi TIDAK memutasi type `Invoice`.
 * `CancellationRule` adalah konfigurasi/referensi SAJA — TIDAK menyentuh transition guard `CancellationRecord`/
 * `update*BookingStatus` (Section 13-19, LOCKED).
 */
export interface MasterCurrency {
  id: ID
  code: string
  name: string
  symbol: string
  isActive: boolean
}

export interface TaxRule {
  id: ID
  name: string
  ratePercent: number
  appliesTo: string
  isActive: boolean
}

export interface PaymentTerm {
  id: ID
  label: string
  daysDue: number
  isActive: boolean
}

export interface CancellationRule {
  id: ID
  name: string
  daysBeforeDeparture: number
  penaltyPercent: number
  appliesToBookingType: string
  isActive: boolean
}

/**
 * System Configuration — Section 23, kategori baru. SELURUHNYA display/config preview — TIDAK di-wire ke
 * mesin bisnis nyata (ID generation `nextSequentialId`, departure-readiness derivation Section 12, lead-routing
 * mutator Section 04, seluruhnya LOCKED dan tetap hardcoded/protected di fixture masing-masing). Didokumentasikan
 * eksplisit sebagai batas non-integrasi yang disengaja, bukan gap tersembunyi (lihat D-080, known issues §18).
 */
export interface NumberingScheme {
  id: ID
  entityType: string
  prefix: string
  /** Preview murni tampilan — bukan counter nyata yang dipakai `nextSequentialId`. */
  nextNumberPreview: string
  isActive: boolean
}

export interface DocumentTemplate {
  id: ID
  name: string
  category: string
  /** Referensi longgar ke `Document.category` (Section 21) — TIDAK memutasi type `Document`. */
  appliesToDocumentCategory: string
  bodyPreview: string
  isActive: boolean
}

export interface ReadinessGateConfig {
  id: ID
  name: string
  description: string
  appliesToModule: string
  isActive: boolean
}

export interface AssignmentRule {
  id: ID
  name: string
  description: string
  triggerCondition: string
  targetRole: string
  isActive: boolean
}

/**
 * Organization Profile — Section 23, baru. Diinterpretasikan sebagai profil PERUSAHAAN travel agency itu
 * sendiri (singleton), BUKAN multi-tenancy — tidak ada indikasi sistem multi-tenant di 22 section sebelumnya
 * (judgment call, didokumentasikan D-080).
 */
export interface OrganizationProfile {
  id: ID
  legalName: string
  displayName: string
  address: string
  defaultCurrencyCode: string
  businessHours: string
  contactEmail: string
  contactPhone: string
  updatedAt: string
  updatedBy: ID
}

/**
 * Category key registry (Section 23) — dipakai mutator CRUD generik (`createMasterDataRecord` dkk.,
 * `app/data/index.ts`) untuk memilih array reactive + prefix ID yang tepat per kategori, tanpa menciptakan
 * 15×3 fungsi bernama-spesifik terpisah (opsi generik yang secara eksplisit diizinkan brief Section 23).
 */
export type MasterDataCategoryKey =
  | 'project-type'
  | 'service-type'
  | 'destination'
  | 'vendor-category'
  | 'airport'
  | 'airline'
  | 'hotel'
  | 'currency'
  | 'tax-rule'
  | 'payment-term'
  | 'cancellation-rule'
  | 'numbering-scheme'
  | 'document-template'
  | 'readiness-gate'
  | 'assignment-rule'
