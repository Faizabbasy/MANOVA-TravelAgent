import { describe, it, expect } from 'vitest'
import {
  SALES_ORDERS, getSalesOrderById, getSalesOrdersSummary,
  getSalesOrderStatusTransitions, createSalesOrder, updateSalesOrderStatus
} from './index'

describe('Sales Order (B2C)', () => {
  it('status flow linear: draft -> paid -> ongoing -> done, cancel dari status non-terminal saja', () => {
    expect(getSalesOrderStatusTransitions('draft')).toEqual(['paid', 'cancelled'])
    expect(getSalesOrderStatusTransitions('paid')).toEqual(['ongoing', 'cancelled'])
    expect(getSalesOrderStatusTransitions('ongoing')).toEqual(['done', 'cancelled'])
    expect(getSalesOrderStatusTransitions('done')).toEqual([])
    expect(getSalesOrderStatusTransitions('cancelled')).toEqual([])
  })

  it('createSalesOrder menolak input tidak valid (nama kosong, tanggal terbalik, jumlah nol)', () => {
    expect(createSalesOrder({ customerName: '', destination: 'Bali', travelStartDate: '2026-09-01', travelEndDate: '2026-09-03', travelerCount: 1, priceIdr: 1_000_000 })).toBeUndefined()
    expect(createSalesOrder({ customerName: 'Test', destination: 'Bali', travelStartDate: '2026-09-05', travelEndDate: '2026-09-01', travelerCount: 1, priceIdr: 1_000_000 })).toBeUndefined()
    expect(createSalesOrder({ customerName: 'Test', destination: 'Bali', travelStartDate: '2026-09-01', travelEndDate: '2026-09-03', travelerCount: 0, priceIdr: 1_000_000 })).toBeUndefined()
    expect(createSalesOrder({ customerName: 'Test', destination: 'Bali', travelStartDate: '2026-09-01', travelEndDate: '2026-09-03', travelerCount: 1, priceIdr: 0 })).toBeUndefined()
  })

  it('createSalesOrder membuat Party individual baru dan SalesOrder berstatus draft', () => {
    const before = SALES_ORDERS.length
    const order = createSalesOrder({ customerName: 'Budi Santoso Test', destination: 'Bali', travelStartDate: '2026-09-01', travelEndDate: '2026-09-03', travelerCount: 2, priceIdr: 10_000_000 })
    expect(order).toBeDefined()
    expect(order!.status).toBe('draft')
    expect(order!.id.startsWith('SLO-')).toBe(true)
    expect(SALES_ORDERS.length).toBe(before + 1)
    expect(getSalesOrderById(order!.id)).toBe(order)
  })

  it('updateSalesOrderStatus menolak lompat step tapi menerima transisi valid', () => {
    const order = SALES_ORDERS.find(o => o.id === 'SLO-001')!
    expect(order.status).toBe('draft')
    expect(updateSalesOrderStatus(order.id, 'done')).toBeUndefined()
    expect(order.status).toBe('draft')
    expect(updateSalesOrderStatus(order.id, 'paid')).toBeDefined()
    expect(order.status).toBe('paid')
  })

  it('getSalesOrdersSummary menghitung total dan per-status dengan benar', () => {
    const summary = getSalesOrdersSummary()
    expect(summary.total).toBe(SALES_ORDERS.length)
    expect(summary.draft).toBe(SALES_ORDERS.filter(o => o.status === 'draft').length)
    expect(summary.paid).toBe(SALES_ORDERS.filter(o => o.status === 'paid').length)
    expect(summary.done).toBe(SALES_ORDERS.filter(o => o.status === 'done').length)
  })
})
