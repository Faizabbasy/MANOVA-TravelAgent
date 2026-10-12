import { ASSET_CHECKOUTS, ASSETS, MAINTENANCE_SCHEDULES } from './inventory'
import type { Asset, AssetCheckout, AssetCondition, MaintenanceSchedule } from '~/types/inventory'
import type {
  AssetCheckoutDto, AssetCheckoutInput, AssetDto, AssetInput, AssetMaintenanceDto, AssetMaintenanceInput
} from '~/types/api'
import type { ManovaApi } from '~/lib/api/endpoints'
import { isApiError } from '~/lib/api/errors'

/**
 * Server → `ASSETS`, `MAINTENANCE_SCHEDULES`, `ASSET_CHECKOUTS` (S11a). The server is the source: each list becomes the
 * server's (same objects kept), and every change goes to the server first — a refused save leaves the local data as it
 * was. A checkout, return or finished maintenance also changes the asset, so the assets are reloaded after those.
 * Admin and Super Admin write (`inventory.manage-asset`); internal roles read. 'overdue' comes from the server.
 */

type CoreApi = Pick<ManovaApi, 'core'>
const opt = <T>(v: T | null | undefined): T | undefined => (v === null ? undefined : v)
const idr = (minor: string | null): number | undefined => (minor === null ? undefined : Number(minor))
/** Drops undefined keys so a cleared field disappears from the local object too. */
const clean = <T extends object>(o: T): T => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T

export const assetFromServer = (d: AssetDto): Asset => clean({
  id: d.id,
  code: d.code,
  name: d.name,
  category: d.category,
  brand: opt(d.brand),
  serialNumber: opt(d.serialNumber),
  purchasedAt: d.purchasedOn,
  purchasePriceIdr: idr(d.purchasePriceMinor),
  condition: d.condition,
  status: d.status,
  location: d.location,
  quantity: d.quantity,
  note: opt(d.note)
})

export const maintenanceFromServer = (d: AssetMaintenanceDto): MaintenanceSchedule => clean({
  id: d.id,
  assetId: d.assetId,
  type: d.type,
  scheduledAt: d.scheduledOn,
  completedAt: opt(d.completedOn),
  status: d.status,
  vendorName: opt(d.vendorName),
  costIdr: idr(d.costMinor),
  note: opt(d.note),
  intervalDays: opt(d.intervalDays)
})

export const checkoutFromServer = (d: AssetCheckoutDto): AssetCheckout => clean({
  id: d.id,
  assetId: d.assetId,
  projectId: opt(d.projectId),
  borrowedBy: d.borrowedBy,
  checkedOutAt: d.checkedOutOn,
  dueAt: d.dueOn,
  returnedAt: opt(d.returnedOn),
  status: d.status,
  conditionOnReturn: opt(d.conditionOnReturn),
  note: opt(d.note)
})

function overwrite<T extends { id: string }> (target: T, value: T): T {
  for (const key of Object.keys(target)) { if (!(key in value)) { delete (target as Record<string, unknown>)[key] } }
  return Object.assign(target, value)
}

/** The list becomes `rows` in server order, reusing the objects already on screen. */
function replaceList<T extends { id: string }> (list: T[], rows: T[]): void {
  const next = rows.map((row) => {
    const local = list.find(item => item.id === row.id)
    return local ? overwrite(local, row) : row
  })
  list.splice(0, list.length, ...next)
}

function upsert<T extends { id: string }> (list: T[], value: T): T {
  const local = list.find(item => item.id === value.id)
  if (local) { return overwrite(local, value) }
  list.unshift(value)
  return list[0]!
}

export function mergeServerInventory (data: { assets: AssetDto[]; maintenance: AssetMaintenanceDto[]; checkouts: AssetCheckoutDto[] }): void {
  replaceList(ASSETS, data.assets.map(assetFromServer))
  replaceList(MAINTENANCE_SCHEDULES, data.maintenance.map(maintenanceFromServer))
  replaceList(ASSET_CHECKOUTS, data.checkouts.map(checkoutFromServer))
}

export async function loadServerInventory (api: CoreApi): Promise<void> {
  const [assets, maintenance, checkouts] = await Promise.all([api.core.listAssets(), api.core.listAssetMaintenance(), api.core.listAssetCheckouts()])
  mergeServerInventory({ assets: assets.data, maintenance: maintenance.data, checkouts: checkouts.data })
}

async function reloadAssets (api: CoreApi): Promise<void> {
  replaceList(ASSETS, (await api.core.listAssets()).data.map(assetFromServer))
}

export async function createAssetOnServer (api: CoreApi, input: AssetInput): Promise<Asset> {
  const created = assetFromServer((await api.core.createAsset(input)).data)
  ASSETS.push(created)
  return ASSETS[ASSETS.length - 1]!
}
export async function updateAssetOnServer (api: CoreApi, id: string, input: AssetInput): Promise<Asset> {
  return upsert(ASSETS, assetFromServer((await api.core.updateAsset(id, input)).data))
}
export async function checkoutAssetOnServer (api: CoreApi, input: AssetCheckoutInput): Promise<AssetCheckout> {
  const checkout = upsert(ASSET_CHECKOUTS, checkoutFromServer((await api.core.checkoutAsset(input)).data))
  await reloadAssets(api)
  return checkout
}
export async function returnAssetOnServer (api: CoreApi, checkoutId: string, condition: AssetCondition): Promise<AssetCheckout> {
  const checkout = upsert(ASSET_CHECKOUTS, checkoutFromServer((await api.core.returnAsset(checkoutId, condition)).data))
  await reloadAssets(api)
  return checkout
}
export async function scheduleMaintenanceOnServer (api: CoreApi, input: AssetMaintenanceInput): Promise<MaintenanceSchedule> {
  return upsert(MAINTENANCE_SCHEDULES, maintenanceFromServer((await api.core.scheduleAssetMaintenance(input)).data))
}
export async function completeMaintenanceOnServer (api: CoreApi, id: string): Promise<MaintenanceSchedule> {
  const schedule = upsert(MAINTENANCE_SCHEDULES, maintenanceFromServer((await api.core.completeAssetMaintenance(id)).data))
  await reloadAssets(api)
  return schedule
}

export interface InventorySyncState {
  status: 'idle' | 'loading' | 'ready' | 'offline' | 'error'
  userId: string | null
  message: string | null
}

/** Loads inventory once per signed-in user (dashboard layout, "Reset Demo Data"). */
export function useInventorySync () {
  const api = useApi()
  const session = useServerSession()
  const { currentUser } = useCurrentUser()
  const state = useState<InventorySyncState>('manova-inventory-sync', () => ({ status: 'idle', userId: null, message: null }))

  async function load (force = false) {
    const userId = currentUser.value.id
    if (!force && state.value.userId === userId && (state.value.status === 'ready' || state.value.status === 'loading')) { return }
    state.value = { status: 'loading', userId, message: null }
    try {
      await session.ensure()
      await loadServerInventory(api)
      state.value = { status: 'ready', userId, message: null }
    } catch (error) {
      const offline = isApiError(error) && (error.status === 0 || error.status >= 500)
      state.value = { status: offline ? 'offline' : 'error', userId, message: isApiError(error) ? error.message : 'Inventory belum bisa dimuat dari server.' }
    }
  }

  return { state, load }
}
