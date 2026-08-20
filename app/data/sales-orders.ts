import { reactive } from 'vue'
import type { SalesOrder } from '~/types/sales-order'

/** Seed data Sales Order (B2C individual) — 5 baris, satu per status, terikat ke Party individual PTY-006..008 (`app/data/parties.ts`). */
export const SALES_ORDERS: SalesOrder[] = reactive([
  { id: 'SLO-001', customerId: 'PTY-006', destination: 'Bali', travelStartDate: '2026-08-20', travelEndDate: '2026-08-24', travelerCount: 2, priceIdr: 18_500_000, status: 'draft', createdAt: '2026-07-01' },
  { id: 'SLO-002', customerId: 'PTY-007', destination: 'Yogyakarta', travelStartDate: '2026-08-05', travelEndDate: '2026-08-08', travelerCount: 4, priceIdr: 12_000_000, status: 'paid', createdAt: '2026-07-10' },
  { id: 'SLO-003', customerId: 'PTY-008', destination: 'Raja Ampat', travelStartDate: '2026-07-25', travelEndDate: '2026-07-30', travelerCount: 1, priceIdr: 32_000_000, status: 'ongoing', createdAt: '2026-06-20' },
  { id: 'SLO-004', customerId: 'PTY-006', destination: 'Singapura', travelStartDate: '2026-06-10', travelEndDate: '2026-06-13', travelerCount: 2, priceIdr: 15_000_000, status: 'done', createdAt: '2026-05-15' },
  { id: 'SLO-005', customerId: 'PTY-007', destination: 'Lombok', travelStartDate: '2026-06-01', travelEndDate: '2026-06-04', travelerCount: 3, priceIdr: 14_000_000, status: 'cancelled', createdAt: '2026-05-01' },
  /** Booking Project B2C (Group Trip) dummy PRJ-205, `app/data/projects.ts` — pola sama `qualifyGroupTripLead`: `projectId` di-set begitu Qualified, status `paid` = DP terkonfirmasi (peserta ikut jadi `Traveler`, lihat `app/data/projects.ts` TRV-2051), status `draft` = Awaiting DP (belum jadi Traveler). */
  { id: 'SLO-006', customerId: 'PTY-010', projectId: 'PRJ-205', destination: 'Bromo & Ijen, Indonesia', travelStartDate: '2026-09-18', travelEndDate: '2026-09-21', travelerCount: 2, priceIdr: 7_000_000, status: 'paid', createdAt: '2026-08-10' },
  { id: 'SLO-007', customerId: 'PTY-011', projectId: 'PRJ-205', destination: 'Bromo & Ijen, Indonesia', travelStartDate: '2026-09-18', travelEndDate: '2026-09-21', travelerCount: 1, priceIdr: 3_500_000, status: 'draft', createdAt: '2026-08-15' }
])
