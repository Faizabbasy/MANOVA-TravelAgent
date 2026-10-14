import { describe, expect, it } from 'vitest'
import { syncPlanFor } from './sync-plan'

describe('which server data each role loads (S12a)', () => {
  it('internal roles load every module', () => {
    for (const role of ['super-admin', 'admin', 'finance'] as const) {
      expect(syncPlanFor(role)).toEqual([
        'projects', 'customers', 'vendors', 'bookings', 'procurement', 'leads', 'salesOrders', 'travelers', 'itinerary', 'workItems',
        'activity', 'changes', 'documents', 'notifications', 'users', 'masterData', 'inventory', 'marketing', 'hr'
      ])
    }
  })

  it('a client loads only what its portal may read — no customer, vendor, booking or procurement lists (403 for it)', () => {
    expect(syncPlanFor('client')).toEqual(['projects', 'travelers', 'itinerary', 'changes', 'documents', 'notifications', 'clientCommerce'])
  })

  it('a vendor loads only its projects and notifications until its portal moves to the server (S12d)', () => {
    expect(syncPlanFor('vendor')).toEqual(['projects', 'notifications'])
  })
})
