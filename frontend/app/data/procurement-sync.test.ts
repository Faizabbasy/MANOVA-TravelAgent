import { describe, expect, it } from 'vitest'
import { VENDOR_QUOTATIONS } from './vendors'
import { SERVICE_ORDERS } from './procurement'
import { mergeServerQuotations, mergeServerServiceOrders, quotationFromServer, runServiceOrderStatusChange } from './procurement-sync'
import type { ServiceOrderDto, VendorQuotationDto } from '~/types/api'

const q = (over: Partial<VendorQuotationDto> = {}): VendorQuotationDto => ({ id: 'VQ-900', vendorId: 'VND-001', projectId: 'PRJ-101', serviceId: 'SVC-1011', serviceType: 'flight', amountMinor: '90000000', notes: null, status: 'submitted', decisionReason: null, submittedOn: '2026-10-01', decidedAt: null, ...over })
const so = (over: Partial<ServiceOrderDto> = {}): ServiceOrderDto => ({ id: 'SO-900', vendorId: 'VND-001', vendorName: 'Garuda', projectId: 'PRJ-101', serviceId: 'SVC-1011', serviceType: 'flight', status: 'draft', statusReason: null, netCostMinor: '90000000', lineItems: [], sourceQuotationId: null, acknowledgedAt: null, fulfilledAt: null, createdAt: '2026-10-01', updatedAt: '2026-10-01', ...over })

describe('procurement-sync', () => {
  it('maps quotations (amount in rupiah) and replaces the local list with the server one', () => {
    expect(quotationFromServer(q())).toMatchObject({ id: 'VQ-900', amountIdr: 90_000_000, submittedAt: '2026-10-01', status: 'submitted' })
    mergeServerQuotations([q()])
    expect(VENDOR_QUOTATIONS.map(x => x.id)).toEqual(['VQ-900'])
  })

  it('merges service orders in place with net cost in rupiah; rows not on the server go; local rfqId stays', () => {
    SERVICE_ORDERS.splice(0, SERVICE_ORDERS.length, { id: 'SO-900', rfqId: 'RFQ-1', vendorId: 'VND-001', lineItems: [], status: 'draft', createdAt: '2026-10-01' }, { id: 'SO-LOCAL', vendorId: 'VND-002', lineItems: [], status: 'draft', createdAt: '2026-10-01' })
    const local = SERVICE_ORDERS.find(x => x.id === 'SO-900')!
    mergeServerServiceOrders([so({ status: 'sent' })])
    expect(SERVICE_ORDERS.map(x => x.id)).toEqual(['SO-900'])
    expect(SERVICE_ORDERS[0]).toBe(local)
    expect(local).toMatchObject({ status: 'sent', netCostIdr: 90_000_000, vendorId: 'VND-001', rfqId: 'RFQ-1', projectId: 'PRJ-101', serviceId: 'SVC-1011' })
  })

  it('status change: server first, local activity after, server version wins; a refusal changes nothing', async () => {
    mergeServerServiceOrders([so()])
    const calls: string[] = []
    const api = { core: { changeServiceOrderStatus: () => { calls.push('server'); return Promise.resolve({ data: so({ status: 'sent' }) }) } } } as never
    await runServiceOrderStatusChange(api, 'SO-900', 'sent', undefined, () => { calls.push('local') })
    expect(calls).toEqual(['server', 'local'])
    expect(SERVICE_ORDERS.find(x => x.id === 'SO-900')!.status).toBe('sent')
    const refused = { core: { changeServiceOrderStatus: () => Promise.reject(new Error('422')) } } as never
    await expect(runServiceOrderStatusChange(refused, 'SO-900', 'cancelled', 'x', () => { calls.push('local2') })).rejects.toThrow()
    expect(calls).not.toContain('local2')
    expect(SERVICE_ORDERS.find(x => x.id === 'SO-900')!.status).toBe('sent')
  })
})
