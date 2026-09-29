import { reactive } from 'vue'
import type {
  MasterDataItem, Airport, Airline, Hotel, MasterCurrency, TaxRule, PaymentTerm, CancellationRule,
  NumberingScheme, DocumentTemplate, ReadinessGateConfig, AssignmentRule, OrganizationProfile
} from '~/types/master-data'

/**
 * Master Data (Section 23 — Administration, Master Data dan Audit, roadmap Section 00–24 baru, D-080).
 * Migrasi dari `app/constants/master-data.ts` (Section 17 lama, static read-only) — 4 array pertama di
 * bawah ini mempertahankan ID/label/description/isActive PERSIS SAMA (tidak ada yang di-renumber/rename,
 * konsumen lama seperti `/admin/master-data` tetap kompatibel), hanya berpindah lokasi dan menjadi
 * `reactive()` agar `createMasterDataRecord`/`updateMasterDataRecord`/`deactivateMasterDataRecord`/
 * `reactivateMasterDataRecord` (`app/data/index.ts`) dapat memutasinya.
 */

/** Tipe project (karakteristik) — sesuai PROJECT_CHARACTERISTICS (docs/route-and-role-matrix.md bagian 3). */
export const MASTER_PROJECT_TYPES: MasterDataItem[] = reactive([
  { id: 'PT-001', label: 'Normal Project', description: 'Perjalanan standar tanpa kompleksitas tinggi', isActive: true },
  { id: 'PT-002', label: 'High-Change Project', description: 'Perjalanan dengan banyak perubahan itinerary/pax selama proses', isActive: true },
  { id: 'PT-003', label: 'Complex Project', description: 'Perjalanan multi-destination, multi-vendor, atau multi-grup besar', isActive: true }
])

/** Tipe layanan operasional — sesuai SERVICE_TYPES (docs/route-and-role-matrix.md bagian 4). */
export const MASTER_SERVICE_TYPES: MasterDataItem[] = reactive([
  { id: 'ST-001', label: 'Flight', description: 'Tiket pesawat dan penerbangan', isActive: true },
  { id: 'ST-002', label: 'Hotel', description: 'Akomodasi penginapan', isActive: true },
  { id: 'ST-003', label: 'Transportation', description: 'Transportasi darat, bus, shuttle, dll.', isActive: true },
  { id: 'ST-004', label: 'MICE', description: 'Meeting, Incentive, Conference, Exhibition', isActive: true },
  { id: 'ST-005', label: 'Additional Service', description: 'Layanan tambahan di luar kategori utama', isActive: true }
])

/** Destinasi demo — konsisten dengan skenario PRJ-101/102/103 (docs/mockup-data-scenarios.md). */
export const MASTER_DESTINATIONS: MasterDataItem[] = reactive([
  { id: 'DST-001', label: 'Manila, Filipina', description: 'Asia Tenggara', isActive: true },
  { id: 'DST-002', label: 'Abu Dhabi, UAE', description: 'Timur Tengah', isActive: true },
  { id: 'DST-003', label: 'Palu, Indonesia', description: 'Domestik — Sulawesi Tengah', isActive: true },
  { id: 'DST-004', label: 'Bali, Indonesia', description: 'Domestik — Bali', isActive: true },
  { id: 'DST-005', label: 'Singapura', description: 'Asia Tenggara', isActive: true },
  { id: 'DST-006', label: 'Tokyo, Jepang', description: 'Asia Timur', isActive: true },
  { id: 'DST-007', label: 'Bangkok, Thailand', description: 'Asia Tenggara', isActive: false }
])

/** Kategori vendor — sesuai jenis layanan yang dikerjakan vendor (docs/mockup-data-scenarios.md bagian 0.2). */
export const MASTER_VENDOR_CATEGORIES: MasterDataItem[] = reactive([
  { id: 'VC-001', label: 'Maskapai / Airline', description: 'Vendor tiket pesawat', isActive: true },
  { id: 'VC-002', label: 'Hotel / Penginapan', description: 'Vendor akomodasi', isActive: true },
  { id: 'VC-003', label: 'Transportasi Darat', description: 'Vendor bus, shuttle, rental kendaraan', isActive: true },
  { id: 'VC-004', label: 'MICE Organizer', description: 'Vendor penyelenggara event/meeting', isActive: true },
  { id: 'VC-005', label: 'Kargo / Ekspedisi', description: 'Vendor logistik dan kargo', isActive: true },
  { id: 'VC-006', label: 'Asuransi Perjalanan', description: 'Vendor asuransi untuk traveler', isActive: false }
])

/**
 * Airport/Airline/Hotel (Section 23, baru) — daftar referensi ADMIN-CONFIGURABLE saja. SENGAJA TIDAK
 * ditautkan sebagai foreign key ke `FlightBooking`/`HotelBooking` (Section 13-14, LOCKED) — kedua entitas
 * tsb tetap memakai field bebas teks/bisnis apa adanya (lihat D-080).
 */
export const AIRPORTS: Airport[] = reactive([
  { id: 'APT-001', iataCode: 'CGK', name: 'Soekarno-Hatta International Airport', city: 'Jakarta', isActive: true },
  { id: 'APT-002', iataCode: 'MNL', name: 'Ninoy Aquino International Airport', city: 'Manila', isActive: true },
  { id: 'APT-003', iataCode: 'AUH', name: 'Abu Dhabi International Airport', city: 'Abu Dhabi', isActive: true },
  { id: 'APT-004', iataCode: 'PLW', name: 'Mutiara SIS Al-Jufrie Airport', city: 'Palu', isActive: true },
  { id: 'APT-005', iataCode: 'DPS', name: 'Ngurah Rai International Airport', city: 'Bali', isActive: true },
  { id: 'APT-006', iataCode: 'SIN', name: 'Singapore Changi Airport', city: 'Singapura', isActive: true }
])

export const AIRLINES: Airline[] = reactive([
  { id: 'ALN-001', iataCode: 'GA', name: 'Garuda Indonesia', isActive: true },
  { id: 'ALN-002', iataCode: 'JT', name: 'Lion Air', isActive: true },
  { id: 'ALN-003', iataCode: 'QG', name: 'Citilink', isActive: true },
  { id: 'ALN-004', iataCode: 'PR', name: 'Philippine Airlines', isActive: true },
  { id: 'ALN-005', iataCode: 'EY', name: 'Etihad Airways', isActive: true }
])

export const MASTER_HOTELS: Hotel[] = reactive([
  { id: 'MHTL-001', name: 'Grand Manila Hotel', city: 'Manila', starRating: 5, isActive: true },
  { id: 'MHTL-002', name: 'Abu Dhabi Corniche Hotel', city: 'Abu Dhabi', starRating: 5, isActive: true },
  { id: 'MHTL-003', name: 'Palu Bay Resort', city: 'Palu', starRating: 4, isActive: true },
  { id: 'MHTL-004', name: 'Bali Beachfront Suites', city: 'Bali', starRating: 4, isActive: true }
])

/**
 * Commercial & Finance (Section 23, baru). `MASTER_CURRENCIES` berelasi konseptual dengan `InvoiceCurrency`
 * (Section 20, `app/types/finance.ts`) — nilai `code` sengaja mencakup keempatnya (`IDR`/`USD`/`SGD`/`EUR`)
 * agar cek "in-use" (`getMasterDataUsageCount`, `app/data/index.ts`) terhadap `INVOICES` bermakna.
 */
export const MASTER_CURRENCIES: MasterCurrency[] = reactive([
  { id: 'CUR-001', code: 'IDR', name: 'Rupiah Indonesia', symbol: 'Rp', isActive: true },
  { id: 'CUR-002', code: 'USD', name: 'US Dollar', symbol: '$', isActive: true },
  { id: 'CUR-003', code: 'SGD', name: 'Singapore Dollar', symbol: 'S$', isActive: true },
  { id: 'CUR-004', code: 'EUR', name: 'Euro', symbol: '€', isActive: true }
])

export const TAX_RULES: TaxRule[] = reactive([
  { id: 'TAX-001', name: 'PPN 11%', ratePercent: 11, appliesTo: 'Seluruh layanan kena pajak standar', isActive: true },
  { id: 'TAX-002', name: 'PPh 23 (Jasa Vendor)', ratePercent: 2, appliesTo: 'Pembayaran jasa ke vendor/supplier', isActive: true }
])

export const PAYMENT_TERMS: PaymentTerm[] = reactive([
  { id: 'PTM-001', label: 'DP 50% / Pelunasan H-7', daysDue: 7, isActive: true },
  { id: 'PTM-002', label: 'Net 14', daysDue: 14, isActive: true },
  { id: 'PTM-003', label: 'Net 30', daysDue: 30, isActive: true }
])

/**
 * `appliesToBookingType` — referensi/konfigurasi SAJA, TIDAK menggerbangi guard `CancellationRecord`/
 * `update*BookingStatus` (Section 13-19, LOCKED) mana pun.
 */
export const CANCELLATION_RULES: CancellationRule[] = reactive([
  { id: 'CXR-001', name: 'Flight — Pembatalan H-14+', daysBeforeDeparture: 14, penaltyPercent: 10, appliesToBookingType: 'flight', isActive: true },
  { id: 'CXR-002', name: 'Flight — Pembatalan H-7 s.d. H-13', daysBeforeDeparture: 7, penaltyPercent: 50, appliesToBookingType: 'flight', isActive: true },
  { id: 'CXR-003', name: 'Hotel — Pembatalan H-3+', daysBeforeDeparture: 3, penaltyPercent: 0, appliesToBookingType: 'hotel', isActive: true },
  { id: 'CXR-004', name: 'Hotel — Pembatalan < H-3', daysBeforeDeparture: 0, penaltyPercent: 100, appliesToBookingType: 'hotel', isActive: true }
])

/**
 * System Configuration (Section 23, baru). SELURUHNYA display/config preview — TIDAK di-wire ke mesin
 * bisnis nyata (`nextSequentialId`, departure-readiness derivation, lead-routing mutator, seluruhnya
 * LOCKED, lihat `app/types/master-data.ts` dan D-080).
 */
export const NUMBERING_SCHEMES: NumberingScheme[] = reactive([
  { id: 'NUM-001', entityType: 'Invoice', prefix: 'INV-', nextNumberPreview: 'INV-1042 (preview)', isActive: true },
  { id: 'NUM-002', entityType: 'Project', prefix: 'PRJ-', nextNumberPreview: 'PRJ-105 (preview)', isActive: true },
  { id: 'NUM-003', entityType: 'Quotation', prefix: 'QUO-', nextNumberPreview: 'QUO-011 (preview)', isActive: true }
])

export const DOCUMENT_TEMPLATES: DocumentTemplate[] = reactive([
  { id: 'DTPL-001', name: 'Template Quotation Standar', category: 'Quotation', appliesToDocumentCategory: 'Quotation', bodyPreview: 'Kepada [Nama Client], berikut penawaran perjalanan untuk [Destinasi]...', isActive: true },
  { id: 'DTPL-002', name: 'Template E-Ticket', category: 'Ticketing', appliesToDocumentCategory: 'E-Ticket', bodyPreview: 'E-Ticket a.n. [Nama Traveler], PNR [Kode PNR]...', isActive: true },
  { id: 'DTPL-003', name: 'Template Voucher Hotel', category: 'Accommodation', appliesToDocumentCategory: 'Voucher', bodyPreview: 'Voucher menginap a.n. [Nama Traveler] di [Nama Hotel]...', isActive: true }
])

export const READINESS_GATE_CONFIGS: ReadinessGateConfig[] = reactive([
  { id: 'RGC-001', name: 'Flight Confirmed', description: 'Seluruh FlightBooking project berstatus confirmed/issued', appliesToModule: 'ticketing', isActive: true },
  { id: 'RGC-002', name: 'Hotel Confirmed', description: 'Seluruh HotelBooking project berstatus confirmed', appliesToModule: 'accommodation', isActive: true },
  { id: 'RGC-003', name: 'Traveler Documents Verified', description: 'Seluruh dokumen traveler wajib sudah diverifikasi', appliesToModule: 'project', isActive: true },
  { id: 'RGC-004', name: 'Outstanding Invoice Lunas', description: 'Tidak ada invoice project dengan outstanding > 0', appliesToModule: 'finance', isActive: true }
])

export const ASSIGNMENT_RULES: AssignmentRule[] = reactive([
  { id: 'ASR-001', name: 'Lead Sumber Website → Sales Rotasi', description: 'Lead dari sumber Website ditugaskan bergilir ke tim Sales', triggerCondition: 'source = website', targetRole: 'sales', isActive: true },
  { id: 'ASR-002', name: 'Lead Urgency Tinggi → Sales Senior', description: 'Lead dengan urgency tinggi diprioritaskan ke Sales senior', triggerCondition: 'urgency = high', targetRole: 'sales', isActive: true },
  { id: 'ASR-003', name: 'Lead Won → PM Rotasi', description: 'Project baru dari Lead Won ditugaskan bergilir ke Project Manager', triggerCondition: 'lead.projectId is set', targetRole: 'project-manager', isActive: true }
])

/**
 * Organization Profile (Section 23, baru) — singleton, profil perusahaan travel agency itu sendiri
 * (BUKAN multi-tenancy, lihat `app/types/master-data.ts`). `reactive()` object tunggal (bukan array) —
 * `updateOrganizationProfile` (`app/data/index.ts`) memutasi in-place lewat `Object.assign`.
 */
export const ORGANIZATION_PROFILE: OrganizationProfile = reactive({
  id: 'ORG-001',
  legalName: 'PT Manova Wisata Nusantara',
  displayName: 'MANOVA Travel',
  address: 'Jl. Jenderal Sudirman Kav. 52-53, Jakarta Selatan, DKI Jakarta 12190',
  defaultCurrencyCode: 'IDR',
  businessHours: 'Senin–Jumat 09.00–18.00 WIB',
  contactEmail: 'info@manova.id',
  contactPhone: '+62 21 5140 2200',
  updatedAt: '2026-06-01',
  updatedBy: 'USR-010'
})
