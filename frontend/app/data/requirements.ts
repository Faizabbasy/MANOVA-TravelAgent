import { reactive } from 'vue'
import type { CommodityRequirement } from '~/types/requirement'

/**
 * Commodity Requirement — mock repository (Phase 1). Terikat ke `projectId` + `clientPartyId`, pola
 * isolasi sama seperti `getProjectsByParty`/`clientScopeId` existing (Phase 0 Section 5).
 *
 * Edge case yang sengaja diseed: CRQ-004 (`closed`) dan CRQ-005 (`cancelled`) adalah status terminal —
 * dipakai test untuk memverifikasi tidak ada transisi keluar dari status tsb.
 */
export const COMMODITY_REQUIREMENTS: CommodityRequirement[] = reactive([
  { id: 'CRQ-001', projectId: 'PRJ-101', clientPartyId: 'PTY-001', category: 'hotel', title: 'Kamar untuk 20 peserta kunjungan Bali', quantity: 10, detail: { category: 'hotel', checkInDate: '2026-08-10', checkOutDate: '2026-08-15', roomCount: 10 }, status: 'open', createdAt: '2026-07-15' },
  { id: 'CRQ-002', projectId: 'PRJ-102', clientPartyId: 'PTY-002', category: 'mice', title: 'Venue Meeting Tahunan', quantity: 1, detail: { category: 'mice', eventType: 'Annual Meeting', participantCount: 80, eventDate: '2026-09-01' }, status: 'draft', createdAt: '2026-07-20' },
  { id: 'CRQ-003', projectId: 'PRJ-101', clientPartyId: 'PTY-001', category: 'hotel', title: 'Kamar Budget Tambahan Tim Support', quantity: 5, detail: { category: 'hotel', checkInDate: '2026-08-01', checkOutDate: '2026-08-31', roomCount: 5 }, status: 'selection-in-progress', createdAt: '2026-07-18' },
  { id: 'CRQ-004', projectId: 'PRJ-104', clientPartyId: 'PTY-001', category: 'transportation', title: 'Bus Antar Jemput Bandara', quantity: 1, status: 'closed', createdAt: '2026-06-01', updatedAt: '2026-07-10' },
  { id: 'CRQ-005', projectId: 'PRJ-103', clientPartyId: 'PTY-003', category: 'flight', title: 'Tiket Pesawat Grup', quantity: 15, status: 'cancelled', createdAt: '2026-06-10', updatedAt: '2026-07-05' },
  { id: 'CRQ-006', projectId: 'PRJ-102', clientPartyId: 'PTY-002', category: 'mice', title: 'Venue Meeting Eksekutif Q3', quantity: 1, detail: { category: 'mice', eventType: 'Board Meeting', participantCount: 40, eventDate: '2026-09-01' }, status: 'fulfilled', createdAt: '2026-07-08', updatedAt: '2026-07-25' },
  { id: 'CRQ-007', projectId: 'PRJ-103', clientPartyId: 'PTY-003', category: 'hotel', title: 'Kamar Cadangan Tim Logistik', quantity: 2, status: 'selection-submitted', createdAt: '2026-06-25' }
])
