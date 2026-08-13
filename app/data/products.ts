import { reactive } from 'vue'
import type { ProductTemplate, CostSheet } from '~/types/product'

/**
 * `reactive()` (Section 10 — roadmap Section 00–24 baru) — melanjutkan pola Section 07 dst. Product
 * Planner butuh create/edit template dan cost sheet, plus "Apply to Quotation" yang harus ter-propagate
 * ke Lead Detail (Section 05/08) tanpa reload.
 *
 * Fixture di bawah sengaja mencakup 3 kondisi berbeda (Wajib "Planner dapat menyiapkan product/costing
 * yang digunakan AE dan Project"):
 * 1. PRD-001/CS-001 dan PRD-002/CS-002 — Cost Sheet historis yang SUDAH `applied` ke Quotation Won
 *    (LED-009/LED-013, docs/mockup-data-scenarios.md bagian 1/2), mendemokan snapshot konsep secara nyata.
 * 2. CS-005 — Cost Sheet baseline berdiri sendiri (`leadId` kosong), referensi Planner sebelum ada
 *    Lead spesifik.
 * 3. PRD-003/CS-003/CS-004 — dua skenario (Economy vs Premium) melekat pada LED-019 (qualified, "Ready for
 *    Quotation", BELUM ada Quotation) — demo hidup "Scenario/version comparison" dan tombol "Apply to
 *    Quotation" yang benar-benar berfungsi (bukan hanya seeded-done).
 *
 * Total sell hasil kalkulasi (`getCostSheetBreakdown`, app/data/index.ts) SENGAJA tidak dipaksa sama persis
 * dengan `Quotation.amountIdr` historis — nilai quotation final adalah hasil negosiasi AE, sementara Cost
 * Sheet adalah usulan Planner; variance kecil merefleksikan alur bisnis nyata, bukan bug data.
 */
export const PRODUCT_TEMPLATES: ProductTemplate[] = reactive([
  {
    id: 'PRD-001',
    name: 'Manila Business Trip — Flight Only Package',
    destination: 'Manila, Filipina',
    serviceScope: ['flight'],
    status: 'active',
    itineraryConcept: '3 hari 2 malam, flight only untuk keperluan bisnis singkat — akomodasi diatur sendiri oleh client.',
    serviceAlternatives: [
      { service: 'flight', label: 'Ekonomi — Maskapai Budget', costPerPaxIdr: 3_200_000, isRecommended: false, notes: 'Jadwal terbatas, tanpa bagasi tambahan.' },
      { service: 'flight', label: 'Ekonomi — Maskapai Full Service', costPerPaxIdr: 4_100_000, isRecommended: true, notes: 'Jadwal pagi tersedia, termasuk bagasi 20kg.' }
    ],
    inclusions: 'Tiket pesawat PP kelas ekonomi, bagasi 20kg (opsi full-service).',
    exclusions: 'Akomodasi, transportasi darat, konsumsi, asuransi perjalanan.',
    assumptions: 'Harga tiket asumsi booking minimal H-14 keberangkatan, subject to seat availability maskapai.',
    validityStart: '2026-07-01',
    validityEnd: '2026-12-31',
    basePaxCount: 6,
    createdBy: 'USR-001',
    createdAt: '2026-06-05'
  },
  {
    id: 'PRD-002',
    name: 'Abu Dhabi Corporate MICE Package',
    destination: 'Abu Dhabi, Uni Emirat Arab',
    serviceScope: ['flight', 'hotel'],
    status: 'active',
    itineraryConcept: '5 hari 4 malam, corporate gathering — flight + hotel dengan meeting room harian.',
    serviceAlternatives: [
      { service: 'hotel', label: 'Hotel Bintang 4 — Business District', costPerPaxIdr: 4_500_000, isRecommended: true, notes: '4 malam, termasuk sarapan dan 1 meeting room.' },
      { service: 'hotel', label: 'Hotel Bintang 5 — Corniche View', costPerPaxIdr: 7_200_000, isRecommended: false, notes: '4 malam, upgrade fasilitas ballroom.' },
      { service: 'flight', label: 'Ekonomi — Direct Flight', costPerPaxIdr: 9_800_000, isRecommended: true }
    ],
    inclusions: 'Tiket pesawat PP, hotel sesuai pilihan (4 malam, sarapan), transportasi bandara-hotel PP.',
    exclusions: 'Makan siang/malam di luar itinerary, aktivitas pribadi, visa (diurus terpisah).',
    assumptions: 'Room block group rate, minimum 10 pax untuk harga tercantum.',
    validityStart: '2026-06-01',
    validityEnd: '2027-03-31',
    basePaxCount: 15,
    createdBy: 'USR-001',
    createdAt: '2026-05-20'
  },
  {
    id: 'PRD-003',
    name: 'Palu Full MICE Conference Package',
    destination: 'Palu, Indonesia',
    serviceScope: ['flight', 'hotel', 'transportation', 'mice'],
    status: 'draft',
    itineraryConcept: '5 hari 4 malam, full MICE — flight, hotel, transportasi charter, dan venue/BOQ acara untuk konferensi regional.',
    serviceAlternatives: [
      { service: 'hotel', label: 'Hotel Bintang 3 — Standard', costPerPaxIdr: 3_600_000, isRecommended: false },
      { service: 'hotel', label: 'Hotel Bintang 4 — Convention Center', costPerPaxIdr: 5_400_000, isRecommended: true, notes: 'Dekat venue acara, hemat waktu transportasi.' },
      { service: 'mice', label: 'Venue Standard — Ballroom + AV Dasar', costPerPaxIdr: 1_200_000, isRecommended: false },
      { service: 'mice', label: 'Venue Premium — Ballroom + Full AV + Staffing', costPerPaxIdr: 2_100_000, isRecommended: true }
    ],
    inclusions: 'Tiket pesawat PP, hotel, transportasi charter bandara-hotel-venue, venue acara + AV.',
    exclusions: 'Konsumsi di luar rangkaian acara resmi, akomodasi tambahan H-1/H+1, dokumentasi profesional.',
    assumptions: 'Estimasi masih disempurnakan Product Planner — belum final untuk seluruh sub-layanan (status Draft).',
    validityStart: '2026-08-01',
    validityEnd: '2027-06-30',
    basePaxCount: 25,
    createdBy: 'USR-001',
    createdAt: '2026-07-25'
  }
])

export const COST_SHEETS: CostSheet[] = reactive([
  {
    id: 'CS-001',
    name: 'Manila Business Trip Q3 2026 — Cost Sheet',
    productId: 'PRD-001',
    leadId: 'LED-009',
    travelerCount: 6,
    currency: 'IDR',
    lineItems: [
      { service: 'flight', description: 'Tiket PP ekonomi full-service, booking last-minute (6 pax)', costPerPaxIdr: 12_500_000 }
    ],
    markupPercent: 15,
    taxPercent: 5,
    contingencyPercent: 3,
    status: 'final',
    version: 1,
    inclusions: 'Tiket pesawat PP kelas ekonomi, bagasi 20kg.',
    exclusions: 'Akomodasi, transportasi darat, konsumsi.',
    createdBy: 'USR-001',
    createdAt: '2026-06-12',
    appliedToQuotationId: 'QUO-001',
    appliedAt: '2026-06-24'
  },
  {
    id: 'CS-002',
    name: 'Abu Dhabi Corporate Gathering — Cost Sheet',
    productId: 'PRD-002',
    leadId: 'LED-013',
    travelerCount: 15,
    currency: 'IDR',
    lineItems: [
      { service: 'flight', description: 'Tiket PP direct flight (15 pax)', costPerPaxIdr: 9_800_000 },
      { service: 'hotel', description: 'Hotel bintang 4, 4 malam (15 pax)', costPerPaxIdr: 4_500_000 }
    ],
    markupPercent: 15,
    taxPercent: 5,
    contingencyPercent: 3,
    status: 'final',
    version: 1,
    inclusions: 'Tiket pesawat PP, hotel 4 malam (sarapan), transportasi bandara-hotel PP.',
    exclusions: 'Makan siang/malam di luar itinerary, visa.',
    createdBy: 'USR-001',
    createdAt: '2026-06-08',
    appliedToQuotationId: 'QUO-002',
    appliedAt: '2026-06-19'
  },
  {
    id: 'CS-005',
    name: 'Abu Dhabi Corporate Package — Baseline Reference',
    productId: 'PRD-002',
    travelerCount: 15,
    currency: 'IDR',
    lineItems: [
      { service: 'flight', description: 'Tiket PP direct flight (referensi baseline)', costPerPaxIdr: 9_800_000 },
      { service: 'hotel', description: 'Hotel bintang 4, 4 malam (referensi baseline)', costPerPaxIdr: 4_500_000 }
    ],
    markupPercent: 15,
    taxPercent: 5,
    contingencyPercent: 3,
    status: 'draft',
    version: 1,
    createdBy: 'USR-001',
    createdAt: '2026-05-22',
    notes: 'Baseline referensi — belum terikat Lead spesifik, dipakai sebagai starting point saat AE membawa deal baru ke destinasi ini.'
  },
  {
    id: 'CS-003',
    name: 'Palu MICE Conference 2027 — Economy Scenario',
    productId: 'PRD-003',
    leadId: 'LED-019',
    travelerCount: 25,
    currency: 'IDR',
    lineItems: [
      { service: 'flight', description: 'Tiket PP ekonomi (25 pax)', costPerPaxIdr: 3_400_000 },
      { service: 'hotel', description: 'Hotel bintang 3, 4 malam (25 pax)', costPerPaxIdr: 3_600_000 },
      { service: 'transportation', description: 'Transportasi charter bandara-hotel-venue PP', costPerPaxIdr: 450_000 },
      { service: 'mice', description: 'Venue standard (Ballroom + AV dasar)', costPerPaxIdr: 1_200_000 }
    ],
    markupPercent: 12,
    taxPercent: 5,
    contingencyPercent: 5,
    status: 'draft',
    version: 1,
    createdBy: 'USR-001',
    createdAt: '2026-07-28',
    notes: 'Skenario ekonomis — margin lebih tipis, cocok bila budget client terbatas.'
  },
  {
    id: 'CS-004',
    name: 'Palu MICE Conference 2027 — Premium Scenario',
    productId: 'PRD-003',
    leadId: 'LED-019',
    travelerCount: 25,
    currency: 'IDR',
    lineItems: [
      { service: 'flight', description: 'Tiket PP ekonomi, jadwal fleksibel (25 pax)', costPerPaxIdr: 3_400_000 },
      { service: 'hotel', description: 'Hotel bintang 4 dekat convention center, 4 malam (25 pax)', costPerPaxIdr: 5_400_000 },
      { service: 'transportation', description: 'Transportasi charter bandara-hotel-venue PP', costPerPaxIdr: 450_000 },
      { service: 'mice', description: 'Venue premium (Ballroom + Full AV + Staffing)', costPerPaxIdr: 2_100_000 }
    ],
    markupPercent: 12,
    taxPercent: 5,
    contingencyPercent: 5,
    status: 'draft',
    version: 1,
    createdBy: 'USR-001',
    createdAt: '2026-07-29',
    notes: 'Skenario premium — pengalaman lebih baik untuk delegasi VIP, margin lebih tebal.'
  }
])
