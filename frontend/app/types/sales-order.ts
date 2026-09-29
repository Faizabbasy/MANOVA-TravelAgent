import type { ID } from './common'

/** Sales Order (B2C individual) — status flow linear + cancel, jauh lebih ringan dari 6-step Project Order (lihat `docs/superpowers/specs/2026-08-11-sales-order-b2c-design.md`). */
export type SalesOrderStatus = 'draft' | 'paid' | 'ongoing' | 'done' | 'cancelled'

export interface SalesOrder {
  id: ID
  /** → `Party` dengan `partyType: 'individual'`. */
  customerId: ID
  destination: string
  travelStartDate: string
  travelEndDate: string
  travelerCount: number
  priceIdr: number
  status: SalesOrderStatus
  note?: string
  createdAt: string
}
