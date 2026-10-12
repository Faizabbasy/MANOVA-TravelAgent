import { describe, expect, it } from 'vitest'
import { ASSET_CHECKOUTS, ASSETS, MAINTENANCE_SCHEDULES, getOverdueMaintenance, getUpcomingMaintenance } from './inventory'
import {
  assetFromServer, checkoutAssetOnServer, mergeServerInventory, returnAssetOnServer, scheduleMaintenanceOnServer
} from './inventory-sync'
import type { AssetCheckoutDto, AssetDto, AssetMaintenanceDto } from '~/types/api'
import { shiftDate, todayJakarta } from '~/lib/finance/dates'

const asset = (over: Partial<AssetDto> = {}): AssetDto => ({
  id: 'AST-001',
  code: 'CAM-001',
  name: 'Sony A7 IV Body',
  category: 'camera',
  brand: 'Sony',
  serialNumber: null,
  purchasedOn: '2024-03-12',
  purchasePriceMinor: '38500000',
  condition: 'excellent',
  status: 'available',
  location: 'Gudang Jakarta',
  quantity: 1,
  note: null,
  ...over
})
const maint = (over: Partial<AssetMaintenanceDto> = {}): AssetMaintenanceDto => ({
  id: 'MNT-001', assetId: 'AST-001', type: 'routine', scheduledOn: '2026-07-30', completedOn: null, status: 'scheduled', vendorName: null, costMinor: '850000', note: null, intervalDays: null, ...over
})
const checkout = (over: Partial<AssetCheckoutDto> = {}): AssetCheckoutDto => ({
  id: 'ACO-001', assetId: 'AST-001', projectId: 'PRJ-103', borrowedBy: 'USR-002', checkedOutOn: '2026-07-20', dueOn: '2026-08-20', returnedOn: null, status: 'checked-out', conditionOnReturn: null, note: null, ...over
})

describe('inventory-sync', () => {
  it('maps a server asset to the local shape (money to IDR numbers, dates to the local names)', () => {
    expect(assetFromServer(asset())).toMatchObject({ id: 'AST-001', purchasedAt: '2024-03-12', purchasePriceIdr: 38_500_000, brand: 'Sony' })
    expect(assetFromServer(asset({ purchasePriceMinor: null, brand: null }))).not.toHaveProperty('brand')
  })

  it('the server lists replace the local ones in place, keeping object identity', () => {
    const first = ASSETS.find(a => a.id === 'AST-001')!
    mergeServerInventory({ assets: [asset({ name: 'Server' }), asset({ id: 'AST-020', code: 'CAM-020' })], maintenance: [maint()], checkouts: [] })
    expect(ASSETS.map(a => a.id)).toEqual(['AST-001', 'AST-020'])
    expect(ASSETS[0]).toBe(first)
    expect(first.name).toBe('Server')
    expect(MAINTENANCE_SCHEDULES.map(m => m.id)).toEqual(['MNT-001'])
    expect(ASSET_CHECKOUTS).toEqual([])
  })

  it('a maintenance the server reports overdue counts as overdue, not upcoming', () => {
    mergeServerInventory({ assets: [asset()], maintenance: [maint({ id: 'MNT-002', scheduledOn: '2026-08-05', status: 'overdue' })], checkouts: [] })
    expect(getOverdueMaintenance().map(m => m.id)).toEqual(['MNT-002'])
    expect(getUpcomingMaintenance().map(m => m.id)).toEqual([])
  })

  it('upcoming maintenance is measured from today (Jakarta), like the overdue status from the server', () => {
    const tomorrow = shiftDate(todayJakarta(), 1)
    mergeServerInventory({ assets: [asset()], maintenance: [maint({ id: 'MNT-003', scheduledOn: tomorrow })], checkouts: [] })
    expect(getUpcomingMaintenance().map(m => m.id)).toEqual(['MNT-003'])
    expect(getOverdueMaintenance()).toEqual([])
  })

  it('a refused checkout or return leaves the local data as it was', async () => {
    mergeServerInventory({ assets: [asset()], maintenance: [], checkouts: [checkout()] })
    const api = {
      core: {
        checkoutAsset: () => Promise.reject(new Error('422')),
        returnAsset: () => Promise.reject(new Error('422')),
        scheduleAssetMaintenance: () => Promise.reject(new Error('403'))
      }
    } as never
    await expect(checkoutAssetOnServer(api, { assetId: 'AST-001', dueOn: '2026-12-01' })).rejects.toThrow()
    await expect(returnAssetOnServer(api, 'ACO-001', 'good')).rejects.toThrow()
    await expect(scheduleMaintenanceOnServer(api, { assetId: 'AST-001', type: 'repair', scheduledOn: '2026-12-01' })).rejects.toThrow()
    expect(ASSET_CHECKOUTS[0]!.status).toBe('checked-out')
    expect(ASSETS[0]!.status).toBe('available')
    expect(MAINTENANCE_SCHEDULES).toEqual([])
  })

  it('an accepted checkout reloads the asset too (it is now in use)', async () => {
    mergeServerInventory({ assets: [asset()], maintenance: [], checkouts: [] })
    const api = {
      core: {
        checkoutAsset: () => Promise.resolve({ data: checkout({ id: 'ACO-009' }) }),
        listAssets: () => Promise.resolve({ data: [asset({ status: 'in-use' })] })
      }
    } as never
    await checkoutAssetOnServer(api, { assetId: 'AST-001', dueOn: '2026-12-01' })
    expect(ASSET_CHECKOUTS.map(c => c.id)).toEqual(['ACO-009'])
    expect(ASSETS[0]!.status).toBe('in-use')
  })
})
