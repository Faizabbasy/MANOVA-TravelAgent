import { describe, expect, it } from 'vitest'
import { SALES_ORDERS } from './sales-orders'
import { changeSalesOrderStatusOnServer, mergeServerSalesOrders, salesOrderFromServer } from './sales-orders-sync'
import { getProjectSeatsAvailable, getProjectSeatsFilled, getProjectSeatsPending } from './index'
import type { SalesOrderDto } from '~/types/api'

const dto = (over: Partial<SalesOrderDto> = {}): SalesOrderDto => ({
  id: 'SLO-006',
  projectId: 'PRJ-205',
  partyId: 'PTY-010',
  partyName: 'Peserta',
  leadId: 'LED-021',
  destination: 'Bromo & Ijen, Indonesia',
  travelStartDate: '2026-09-18',
  travelEndDate: '2026-09-21',
  travelerCount: 2,
  priceMinor: '7000000',
  status: 'paid',
  statusReason: null,
  note: null,
  paidOn: '2026-08-10',
  createdOn: '2026-08-10',
  updatedAt: '2026-08-10T00:00:00.000Z',
  ...over
})

describe('sales-orders-sync', () => {
  it('maps a server order to the local shape', () => {
    expect(salesOrderFromServer(dto())).toMatchObject({ id: 'SLO-006', customerId: 'PTY-010', projectId: 'PRJ-205', priceIdr: 7_000_000, status: 'paid', createdAt: '2026-08-10', leadId: 'LED-021', paidOn: '2026-08-10' })
    expect(salesOrderFromServer(dto({ projectId: null })).projectId).toBeUndefined()
  })

  it('merge replaces the list in place and seats follow the orders (paid fills, draft holds)', () => {
    const before = SALES_ORDERS.find(o => o.id === 'SLO-006')!
    mergeServerSalesOrders([dto(), dto({ id: 'SLO-007', status: 'draft', travelerCount: 1 }), dto({ id: 'SLO-010', status: 'cancelled', travelerCount: 1 })])
    expect(SALES_ORDERS.map(o => o.id)).toEqual(['SLO-006', 'SLO-007', 'SLO-010'])
    expect(SALES_ORDERS[0]).toBe(before)
    expect(getProjectSeatsFilled('PRJ-205')).toBe(2)
    expect(getProjectSeatsPending('PRJ-205')).toBe(1)
    expect(getProjectSeatsAvailable('PRJ-205')).toBeGreaterThanOrEqual(0)
  })

  it('status change takes the server answer', async () => {
    mergeServerSalesOrders([dto({ id: 'SLO-001', projectId: null, status: 'draft' })])
    const api = {
      sales: {
        changeSalesOrderStatus: (id: string, input: { to: string }) => Promise.resolve({ data: dto({ id, projectId: null, status: input.to as SalesOrderDto['status'] }) })
      }
    } as never
    const order = await changeSalesOrderStatusOnServer(api, 'SLO-001', 'paid')
    expect(order.status).toBe('paid')
    expect(SALES_ORDERS.find(o => o.id === 'SLO-001')!.status).toBe('paid')
  })
})
