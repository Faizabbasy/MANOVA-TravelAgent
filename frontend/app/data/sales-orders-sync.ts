import { SALES_ORDERS } from './sales-orders'
import type { SalesOrder } from '~/types/sales-order'
import type { SalesOrderDto } from '~/types/api'
import type { ManovaApi } from '~/lib/api/endpoints'
import { isApiError } from '~/lib/api/errors'

/**
 * Server → `SALES_ORDERS` (S6b). The server owns sales orders — standalone B2C and Group Trip bookings — their status
 * and the seats they hold. Travelers created after a DP stay local (S7).
 */

type SalesApi = Pick<ManovaApi, 'sales'>

export function salesOrderFromServer (d: SalesOrderDto): SalesOrder {
  return {
    id: d.id,
    customerId: d.partyId,
    destination: d.destination ?? '',
    travelStartDate: d.travelStartDate ?? '',
    travelEndDate: d.travelEndDate ?? '',
    travelerCount: d.travelerCount,
    priceIdr: Number(d.priceMinor),
    status: d.status,
    note: d.note ?? undefined,
    createdAt: d.createdOn,
    projectId: d.projectId ?? undefined,
    leadId: d.leadId ?? undefined,
    statusReason: d.statusReason ?? undefined,
    paidOn: d.paidOn ?? undefined
  }
}

export function upsertServerSalesOrder (d: SalesOrderDto): SalesOrder {
  const value = salesOrderFromServer(d)
  const local = SALES_ORDERS.find(o => o.id === d.id)
  if (!local) {
    SALES_ORDERS.push(value)
    return SALES_ORDERS[SALES_ORDERS.length - 1]!
  }
  Object.assign(local, value)
  return local
}

export function mergeServerSalesOrders (list: SalesOrderDto[]): void {
  const keep = new Set(list.map(o => o.id))
  for (let i = SALES_ORDERS.length - 1; i >= 0; i--) {
    if (!keep.has(SALES_ORDERS[i]!.id)) { SALES_ORDERS.splice(i, 1) }
  }
  for (const o of list) { upsertServerSalesOrder(o) }
}

export async function loadServerSalesOrders (api: SalesApi): Promise<void> {
  mergeServerSalesOrders((await api.sales.listSalesOrders()).data)
}

/** One order as the server has it now (after a Finance DP confirmation marked it paid). */
export async function reloadSalesOrder (api: SalesApi, id: string): Promise<SalesOrder> {
  return upsertServerSalesOrder((await api.sales.getSalesOrder(id)).data)
}

export async function changeSalesOrderStatusOnServer (api: SalesApi, id: string, to: SalesOrder['status'], reason?: string): Promise<SalesOrder> {
  return upsertServerSalesOrder((await api.sales.changeSalesOrderStatus(id, { to, ...(reason?.trim() ? { reason: reason.trim() } : {}) })).data)
}

export interface SalesOrdersSyncState {
  status: 'idle' | 'loading' | 'ready' | 'offline' | 'error'
  userId: string | null
  message: string | null
}

/** Loads sales orders once per signed-in user (dashboard layout, "Reset Demo Data"). */
export function useSalesOrdersSync () {
  const api = useApi()
  const session = useServerSession()
  const { currentUser } = useCurrentUser()
  const state = useState<SalesOrdersSyncState>('manova-sales-orders-sync', () => ({ status: 'idle', userId: null, message: null }))

  async function load (force = false) {
    const userId = currentUser.value.id
    if (!force && state.value.userId === userId && (state.value.status === 'ready' || state.value.status === 'loading')) { return }
    state.value = { status: 'loading', userId, message: null }
    try {
      await session.ensure()
      await loadServerSalesOrders(api)
      state.value = { status: 'ready', userId, message: null }
    } catch (error) {
      const offline = isApiError(error) && (error.status === 0 || error.status >= 500)
      state.value = { status: offline ? 'offline' : 'error', userId, message: isApiError(error) ? error.message : 'Sales order belum bisa dimuat dari server.' }
    }
  }

  return { state, load }
}
