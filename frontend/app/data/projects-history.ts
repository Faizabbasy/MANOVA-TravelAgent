import type { Party } from '~/types/party'
import type { Project, ProjectService, ServiceTypeKey } from '~/types/project'
import type { ProjectMilestone } from '~/types/project-order'

/**
 * Riwayat satu tahun perusahaan (keberangkatan Nov 2025 – Okt 2026) untuk demo ke klien/atasan.
 * Spec: docs/superpowers/specs/2026-10-05-year-demo-data-design.md.
 *
 * Satu baris = satu project. Project, layanan, dan milestone dibentuk dari baris ini lalu ditambahkan
 * SETELAH data demo lama (PRJ-101 … PRJ-502) di `projects.ts`, `project-orders.ts`, dan `parties.ts`, jadi
 * urutan dan `find()` pertama data lama tidak berubah. Uangnya tidak ada di sini (lihat ADR-004): invoice,
 * pembayaran, dan biaya dibuat di server oleh `bun run db:seed:year-demo`.
 *
 * Sengaja tidak memakai PTY-001/PTY-005, VND-006, dan status `confirmed` — dipakai assertion test cakupan
 * backend (core-scope.test.ts).
 */

/** Tanggal acuan operasional frontend (`DEMO_REFERENCE_DATE` di utils/attention.ts). */
const REFERENCE_DATE = '2026-07-29'

type Kind = 'dinas' | 'incentive' | 'mice' | 'umroh'

interface HistoryRow {
  id: string
  name: string
  partyId: string
  destination: string
  start: string
  end: string
  pax: number
  /** Nilai kontrak dalam juta rupiah. */
  contractJt: number
  kind: Kind
}

export const HISTORY_PARTIES: Party[] = [
  { id: 'PTY-019', name: 'PT Nusantara Digital Solusi', lifecycleStatus: 'client', createdAt: '2025-08-12', accountOwnerId: 'USR-001', size: '201-500', city: 'Jakarta', phone: '021-5550-2019', creditLimitIdr: 1_000_000_000 },
  { id: 'PTY-020', name: 'PT Garuda Agro Lestari', lifecycleStatus: 'client', createdAt: '2025-08-20', accountOwnerId: 'USR-001', size: '1000+', city: 'Medan', phone: '061-5550-2020', creditLimitIdr: 1_500_000_000 },
  { id: 'PTY-021', name: 'PT Mitra Farmasi Sejahtera', lifecycleStatus: 'client', createdAt: '2025-09-02', accountOwnerId: 'USR-001', size: '501-1000', city: 'Jakarta', phone: '021-5550-2021', creditLimitIdr: 1_500_000_000 },
  { id: 'PTY-022', name: 'Yayasan Al-Hikmah Travel Ibadah', lifecycleStatus: 'client', createdAt: '2025-08-28', accountOwnerId: 'USR-001', size: '51-200', city: 'Depok', phone: '021-5550-2022', creditLimitIdr: 2_000_000_000 },
  { id: 'PTY-023', name: 'PT Bank Perkasa Nasional', lifecycleStatus: 'client', createdAt: '2025-09-10', accountOwnerId: 'USR-001', size: '1000+', city: 'Jakarta', phone: '021-5550-2023', creditLimitIdr: 2_000_000_000 },
  { id: 'PTY-024', name: 'PT Sentosa Retail Indonesia', lifecycleStatus: 'client', createdAt: '2025-09-18', accountOwnerId: 'USR-001', size: '1000+', city: 'Tangerang', phone: '021-5550-2024', creditLimitIdr: 1_500_000_000 },
  { id: 'PTY-025', name: 'PT Insan Teknologi Global', lifecycleStatus: 'client', createdAt: '2025-10-01', accountOwnerId: 'USR-001', size: '201-500', city: 'Bandung', phone: '022-5550-2025', creditLimitIdr: 1_000_000_000 },
  { id: 'PTY-026', name: 'PT Prima Energi Mandiri', lifecycleStatus: 'client', createdAt: '2025-10-15', accountOwnerId: 'USR-001', size: '1000+', city: 'Balikpapan', phone: '0542-5550-2026', creditLimitIdr: 2_000_000_000 },
  { id: 'PTY-027', name: 'PT Otomotif Jaya Dealerindo', lifecycleStatus: 'client', createdAt: '2025-11-03', accountOwnerId: 'USR-001', size: '501-1000', city: 'Surabaya', phone: '031-5550-2027', creditLimitIdr: 1_500_000_000 },
  { id: 'PTY-028', name: 'PT Asuransi Amanah Bersama', lifecycleStatus: 'client', createdAt: '2025-11-20', accountOwnerId: 'USR-001', size: '501-1000', city: 'Jakarta', phone: '021-5550-2028', creditLimitIdr: 1_000_000_000 },
  { id: 'PTY-029', name: 'PT Kosmetika Cantik Nusantara', lifecycleStatus: 'client', createdAt: '2025-12-08', accountOwnerId: 'USR-001', size: '201-500', city: 'Jakarta', phone: '021-5550-2029', creditLimitIdr: 1_500_000_000 },
  { id: 'PTY-030', name: 'PT Logistik Samudra Raya', lifecycleStatus: 'client', createdAt: '2026-01-12', accountOwnerId: 'USR-001', size: '501-1000', city: 'Semarang', phone: '024-5550-2030', creditLimitIdr: 1_000_000_000 }
]

const ROWS: HistoryRow[] = [
  // Nov 2025
  { id: 'PRJ-301', name: 'Tokyo Sales Kick-off 2025', partyId: 'PTY-019', destination: 'Tokyo, Jepang', start: '2025-11-10', end: '2025-11-15', pax: 8, contractJt: 280, kind: 'dinas' },
  { id: 'PRJ-302', name: 'Bali Annual Gathering 2025', partyId: 'PTY-020', destination: 'Bali, Indonesia', start: '2025-11-20', end: '2025-11-23', pax: 55, contractJt: 820, kind: 'incentive' },
  { id: 'PRJ-303', name: 'Singapore Fintech Summit', partyId: 'PTY-003', destination: 'Singapura', start: '2025-11-26', end: '2025-11-29', pax: 6, contractJt: 165, kind: 'dinas' },
  // Des 2025 — liburan akhir tahun
  { id: 'PRJ-304', name: 'Korea Winter Incentive', partyId: 'PTY-021', destination: 'Seoul, Korea Selatan', start: '2025-12-05', end: '2025-12-10', pax: 40, contractJt: 1150, kind: 'incentive' },
  { id: 'PRJ-305', name: 'Umroh Akhir Tahun 1447 H', partyId: 'PTY-022', destination: 'Makkah & Madinah, Arab Saudi', start: '2025-12-08', end: '2025-12-17', pax: 45, contractJt: 1350, kind: 'umroh' },
  { id: 'PRJ-306', name: 'Istanbul Leadership Retreat', partyId: 'PTY-023', destination: 'Istanbul, Turki', start: '2025-12-12', end: '2025-12-18', pax: 24, contractJt: 960, kind: 'incentive' },
  { id: 'PRJ-307', name: 'Dubai Year-End Expo', partyId: 'PTY-002', destination: 'Dubai, Uni Emirat Arab', start: '2025-12-14', end: '2025-12-18', pax: 10, contractJt: 310, kind: 'dinas' },
  { id: 'PRJ-308', name: 'Bali Family Holiday Program', partyId: 'PTY-024', destination: 'Bali, Indonesia', start: '2025-12-22', end: '2025-12-27', pax: 60, contractJt: 780, kind: 'incentive' },
  { id: 'PRJ-309', name: 'Tokyo Christmas Incentive', partyId: 'PTY-019', destination: 'Tokyo, Jepang', start: '2025-12-20', end: '2025-12-26', pax: 30, contractJt: 1080, kind: 'incentive' },
  // Jan 2026
  { id: 'PRJ-310', name: 'Singapore Partner Meeting', partyId: 'PTY-025', destination: 'Singapura', start: '2026-01-14', end: '2026-01-16', pax: 5, contractJt: 95, kind: 'dinas' },
  { id: 'PRJ-311', name: 'Annual Conference 2026', partyId: 'PTY-026', destination: 'Jakarta, Indonesia', start: '2026-01-27', end: '2026-01-29', pax: 300, contractJt: 1450, kind: 'mice' },
  // Feb 2026 — musim umroh sebelum Ramadan
  { id: 'PRJ-312', name: 'Umroh Rajab 1447 H', partyId: 'PTY-022', destination: 'Makkah & Madinah, Arab Saudi', start: '2026-02-02', end: '2026-02-11', pax: 40, contractJt: 1200, kind: 'umroh' },
  { id: 'PRJ-313', name: 'Osaka Dealer Incentive', partyId: 'PTY-027', destination: 'Osaka, Jepang', start: '2026-02-09', end: '2026-02-14', pax: 35, contractJt: 1250, kind: 'incentive' },
  { id: 'PRJ-314', name: 'Umroh Karyawan Berprestasi', partyId: 'PTY-028', destination: 'Makkah & Madinah, Arab Saudi', start: '2026-02-16', end: '2026-02-25', pax: 30, contractJt: 930, kind: 'umroh' },
  { id: 'PRJ-315', name: 'Singapore Distributor Visit', partyId: 'PTY-029', destination: 'Singapura', start: '2026-02-18', end: '2026-02-20', pax: 4, contractJt: 70, kind: 'dinas' },
  { id: 'PRJ-316', name: 'Bali Sales Conference', partyId: 'PTY-030', destination: 'Bali, Indonesia', start: '2026-02-24', end: '2026-02-27', pax: 120, contractJt: 1600, kind: 'mice' },
  // Mar 2026
  { id: 'PRJ-317', name: "Umroh Sya'ban 1447 H", partyId: 'PTY-024', destination: 'Makkah & Madinah, Arab Saudi', start: '2026-03-02', end: '2026-03-11', pax: 45, contractJt: 1400, kind: 'umroh' },
  { id: 'PRJ-318', name: 'Seoul Tech Expo Delegation', partyId: 'PTY-003', destination: 'Seoul, Korea Selatan', start: '2026-03-09', end: '2026-03-13', pax: 12, contractJt: 420, kind: 'dinas' },
  { id: 'PRJ-319', name: 'Paris & Swiss Top Achiever Trip', partyId: 'PTY-021', destination: 'Paris, Prancis', start: '2026-03-14', end: '2026-03-22', pax: 20, contractJt: 1500, kind: 'incentive' },
  { id: 'PRJ-320', name: 'Dubai Investment Forum', partyId: 'PTY-025', destination: 'Dubai, Uni Emirat Arab', start: '2026-03-23', end: '2026-03-26', pax: 8, contractJt: 290, kind: 'dinas' },
  { id: 'PRJ-321', name: 'Bali Regional Meeting', partyId: 'PTY-020', destination: 'Bali, Indonesia', start: '2026-03-27', end: '2026-03-29', pax: 80, contractJt: 640, kind: 'mice' },
  // Apr 2026
  { id: 'PRJ-322', name: 'Tokyo Sakura Incentive', partyId: 'PTY-026', destination: 'Tokyo, Jepang', start: '2026-04-02', end: '2026-04-08', pax: 28, contractJt: 1150, kind: 'incentive' },
  { id: 'PRJ-323', name: 'Singapore Board Meeting', partyId: 'PTY-002', destination: 'Singapura', start: '2026-04-20', end: '2026-04-22', pax: 6, contractJt: 120, kind: 'dinas' },
  // Mei 2026
  { id: 'PRJ-324', name: 'Istanbul Product Launch', partyId: 'PTY-029', destination: 'Istanbul, Turki', start: '2026-05-06', end: '2026-05-11', pax: 50, contractJt: 1700, kind: 'mice' },
  { id: 'PRJ-325', name: 'Bali Wellness Retreat', partyId: 'PTY-028', destination: 'Bali, Indonesia', start: '2026-05-14', end: '2026-05-17', pax: 35, contractJt: 520, kind: 'incentive' },
  { id: 'PRJ-326', name: 'Seoul Buyer Visit', partyId: 'PTY-030', destination: 'Seoul, Korea Selatan', start: '2026-05-25', end: '2026-05-29', pax: 7, contractJt: 230, kind: 'dinas' },
  // Jun 2026 — libur sekolah
  { id: 'PRJ-327', name: 'Umroh Libur Sekolah 1447 H', partyId: 'PTY-022', destination: 'Makkah & Madinah, Arab Saudi', start: '2026-06-08', end: '2026-06-17', pax: 45, contractJt: 1450, kind: 'umroh' },
  { id: 'PRJ-328', name: 'Japan Family Gathering', partyId: 'PTY-027', destination: 'Osaka, Jepang', start: '2026-06-12', end: '2026-06-18', pax: 50, contractJt: 1650, kind: 'incentive' },
  { id: 'PRJ-329', name: 'London Banking Study Visit', partyId: 'PTY-023', destination: 'London, Inggris', start: '2026-06-15', end: '2026-06-21', pax: 15, contractJt: 980, kind: 'incentive' },
  { id: 'PRJ-330', name: 'Singapore Kids Holiday Program', partyId: 'PTY-024', destination: 'Singapura', start: '2026-06-22', end: '2026-06-26', pax: 40, contractJt: 600, kind: 'incentive' },
  { id: 'PRJ-331', name: 'Bali Leadership Summit', partyId: 'PTY-019', destination: 'Bali, Indonesia', start: '2026-06-24', end: '2026-06-27', pax: 90, contractJt: 1250, kind: 'mice' },
  // Jul 2026
  { id: 'PRJ-332', name: 'Korea Summer Incentive', partyId: 'PTY-025', destination: 'Seoul, Korea Selatan', start: '2026-07-01', end: '2026-07-06', pax: 38, contractJt: 1200, kind: 'incentive' },
  { id: 'PRJ-333', name: 'Turkey Cappadocia Tour', partyId: 'PTY-026', destination: 'Istanbul, Turki', start: '2026-07-06', end: '2026-07-14', pax: 32, contractJt: 1300, kind: 'incentive' },
  { id: 'PRJ-334', name: 'Umroh Muharram 1448 H', partyId: 'PTY-028', destination: 'Makkah & Madinah, Arab Saudi', start: '2026-07-13', end: '2026-07-22', pax: 40, contractJt: 1250, kind: 'umroh' },
  { id: 'PRJ-335', name: 'Dubai Retail Expo', partyId: 'PTY-029', destination: 'Dubai, Uni Emirat Arab', start: '2026-07-16', end: '2026-07-20', pax: 9, contractJt: 340, kind: 'dinas' },
  { id: 'PRJ-336', name: 'Amsterdam Logistics Conference', partyId: 'PTY-030', destination: 'Amsterdam, Belanda', start: '2026-07-20', end: '2026-07-25', pax: 6, contractJt: 380, kind: 'dinas' },
  // Agu – Okt 2026
  { id: 'PRJ-337', name: 'Bali Partner Gathering', partyId: 'PTY-021', destination: 'Bali, Indonesia', start: '2026-08-11', end: '2026-08-14', pax: 70, contractJt: 900, kind: 'incentive' },
  { id: 'PRJ-338', name: 'Tokyo Agri Expo Delegation', partyId: 'PTY-020', destination: 'Tokyo, Jepang', start: '2026-08-24', end: '2026-08-28', pax: 12, contractJt: 450, kind: 'dinas' },
  { id: 'PRJ-339', name: 'Singapore Tech Week', partyId: 'PTY-027', destination: 'Singapura', start: '2026-09-14', end: '2026-09-17', pax: 10, contractJt: 260, kind: 'dinas' },
  { id: 'PRJ-340', name: 'Umroh Rabiul Awal 1448 H', partyId: 'PTY-022', destination: 'Makkah & Madinah, Arab Saudi', start: '2026-10-19', end: '2026-10-28', pax: 45, contractJt: 1400, kind: 'umroh' }
]

const SERVICES_BY_KIND: Record<Kind, { type: ServiceTypeKey; label: string; vendorId: string; share: number }[]> = {
  dinas: [
    { type: 'flight', label: 'Tiket pesawat', vendorId: 'VND-001', share: 0.6 },
    { type: 'hotel', label: 'Hotel bisnis', vendorId: 'VND-002', share: 0.4 }
  ],
  incentive: [
    { type: 'flight', label: 'Tiket pesawat grup', vendorId: 'VND-001', share: 0.45 },
    { type: 'hotel', label: 'Hotel & resort', vendorId: 'VND-002', share: 0.4 },
    { type: 'transportation', label: 'Bus pariwisata & tour', vendorId: 'VND-003', share: 0.15 }
  ],
  mice: [
    { type: 'flight', label: 'Tiket pesawat peserta', vendorId: 'VND-001', share: 0.3 },
    { type: 'hotel', label: 'Hotel peserta', vendorId: 'VND-002', share: 0.3 },
    { type: 'mice', label: 'Venue, produksi & rundown', vendorId: 'VND-004', share: 0.4 }
  ],
  umroh: [
    { type: 'flight', label: 'Tiket pesawat umroh', vendorId: 'VND-001', share: 0.45 },
    { type: 'hotel', label: 'Hotel Makkah & Madinah', vendorId: 'VND-002', share: 0.4 },
    { type: 'transportation', label: 'Bus & handling Saudi', vendorId: 'VND-003', share: 0.15 }
  ]
}

function shiftDays (iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

const num = (row: HistoryRow) => Number(row.id.slice(4))
const isDone = (row: HistoryRow) => row.end < REFERENCE_DATE
/** Porsi biaya vendor 75–80% dari kontrak (deterministik per project; sama dengan seed server). */
const costRatio = (row: HistoryRow) => 0.75 + (num(row) % 6) * 0.01

export const HISTORY_PROJECTS: Project[] = ROWS.map((row) => {
  const contract = row.contractJt * 1_000_000
  return {
    id: row.id,
    name: row.name,
    partyId: row.partyId,
    destination: row.destination,
    travelStartDate: row.start,
    travelEndDate: row.end,
    characteristic: row.kind === 'mice' ? 'complex' : 'normal',
    serviceScope: SERVICES_BY_KIND[row.kind].map(s => s.type),
    travelerCount: row.pax,
    ownerId: 'USR-002',
    teamUserIds: ['USR-002'],
    status: isDone(row) ? 'completed' : 'in-progress',
    quotationAmountIdr: contract,
    budgetIdr: Math.round(contract * 0.78),
    actualCostIdr: isDone(row) ? Math.round(contract * costRatio(row)) : 0,
    handoverAcceptedAt: shiftDays(row.start, -75),
    handoverAcceptedBy: 'USR-002'
  }
})

export const HISTORY_SERVICES: ProjectService[] = ROWS.flatMap(row =>
  SERVICES_BY_KIND[row.kind].map((s, i) => ({
    id: `SVC-${num(row)}${i + 1}`,
    projectId: row.id,
    type: s.type,
    label: s.label,
    status: isDone(row) ? 'completed' as const : 'confirmed' as const,
    vendorId: s.vendorId,
    budgetIdr: Math.round(row.contractJt * 1_000_000 * 0.78 * s.share)
  }))
)

export const HISTORY_MILESTONES: ProjectMilestone[] = ROWS.flatMap((row) => {
  const steps = [
    { stepKey: 'drafting' as const, name: 'SPK / Handover Diterima', offset: -75 },
    { stepKey: 'confirmed' as const, name: 'Invoice DP Terbit', offset: -60 },
    { stepKey: 'confirmed' as const, name: 'Konfirmasi Vendor & Booking', offset: -30 },
    { stepKey: 'departure' as const, name: 'Keberangkatan', offset: 0 }
  ]
  return steps.map((step, i) => {
    const plannedDate = shiftDays(row.start, step.offset)
    const done = plannedDate < REFERENCE_DATE
    return {
      id: `PMS-${num(row)}-${i + 1}`,
      projectId: row.id,
      stepKey: step.stepKey,
      name: step.name,
      plannedDate,
      ...(done ? { actualDate: plannedDate } : {}),
      ownerId: i === 1 ? 'USR-008' : 'USR-002',
      status: done ? 'completed' as const : 'not-started' as const
    }
  })
})
