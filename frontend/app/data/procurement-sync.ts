import { VENDOR_QUOTATIONS } from './vendors'
import { SERVICE_ORDERS } from './procurement'
import { refreshProjectActivities } from './activity-sync'
import type { VendorQuotation } from '~/types/vendor'
import type { ServiceOrder } from '~/types/procurement'
import type { QuotationCreateInput, ServiceOrderDto, VendorQuotationDto } from '~/types/api'
import type { ManovaApi } from '~/lib/api/endpoints'
import { newIdempotencyKey } from '~/lib/api/client'
import { isApiError } from '~/lib/api/errors'
import { SERVICE_ORDER_STATUSES, findStatusOption } from '~/constants/status'

/**
 * Server → `VENDOR_QUOTATIONS` + `SERVICE_ORDERS` (S4b). The server owns quotations and service orders (created
 * on vendor assignment, cancelled on vendor change, status changes); RFQ links and amendments stay local (S5).
 */

type CoreApi = Pick<ManovaApi, 'core'>
const idr = (minor: string | null) => (minor === null ? undefined : Number(minor))

export function quotationFromServer (d: VendorQuotationDto): VendorQuotation {
  const q: VendorQuotation = { id: d.id, vendorId: d.vendorId, projectId: d.projectId, serviceType: d.serviceType, amountIdr: idr(d.amountMinor) ?? 0, status: d.status, submittedAt: d.submittedOn }
  if (d.serviceId) { q.serviceId = d.serviceId }
  if (d.notes) { q.notes = d.notes }
  return q
}

export function serviceOrderFromServer (d: ServiceOrderDto): Partial<ServiceOrder> & Pick<ServiceOrder, 'id'> {
  return {
    id: d.id,
    vendorId: d.vendorId,
    projectId: d.projectId ?? undefined,
    serviceId: d.serviceId ?? undefined,
    lineItems: d.lineItems,
    status: d.status,
    netCostIdr: idr(d.netCostMinor),
    acknowledgedAt: d.acknowledgedAt ?? undefined,
    fulfilledAt: d.fulfilledAt ?? undefined,
    statusReason: d.statusReason ?? undefined,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
    vendorInvoices: (d.vendorInvoices ?? []).map(v => ({ id: v.id, vendorInvoiceNumber: v.vendorInvoiceNumber, status: v.status, invoiceDate: v.invoiceDate, totalIdr: idr(v.totalMinor) }))
  }
}

export function upsertServerQuotation (d: VendorQuotationDto): VendorQuotation {
  const value = quotationFromServer(d)
  const local = VENDOR_QUOTATIONS.find(q => q.id === d.id)
  if (!local) {
    VENDOR_QUOTATIONS.push(value)
    return VENDOR_QUOTATIONS[VENDOR_QUOTATIONS.length - 1]!
  }
  Object.assign(local, value)
  return local
}

export function mergeServerQuotations (list: VendorQuotationDto[]): void {
  VENDOR_QUOTATIONS.splice(0, VENDOR_QUOTATIONS.length, ...list.map(quotationFromServer))
}

/** Updates in place; local-only fields (RFQ link, sell price) stay on rows the server also has. */
export function upsertServerServiceOrder (d: ServiceOrderDto): ServiceOrder {
  serverOrderIds.add(d.id)
  const value = serviceOrderFromServer(d)
  const local = SERVICE_ORDERS.find(so => so.id === d.id)
  if (!local) {
    SERVICE_ORDERS.push(value as ServiceOrder)
    return SERVICE_ORDERS[SERVICE_ORDERS.length - 1]!
  }
  Object.assign(local, value)
  return local
}

/** IDs the server knows; orders outside it are RFQ orders still kept locally until procurement moves (S5). */
const serverOrderIds = new Set<string>()
export const isServerServiceOrder = (id: string) => serverOrderIds.has(id)

export function mergeServerServiceOrders (list: ServiceOrderDto[]): void {
  const keep = new Set(list.map(so => so.id))
  serverOrderIds.clear()
  for (const id of keep) { serverOrderIds.add(id) }
  for (let i = SERVICE_ORDERS.length - 1; i >= 0; i--) {
    const local = SERVICE_ORDERS[i]!
    if (!keep.has(local.id) && !local.rfqId) { SERVICE_ORDERS.splice(i, 1) }
  }
  for (const so of list) { upsertServerServiceOrder(so) }
}

export async function loadServerProcurement (api: CoreApi): Promise<void> {
  const [quotations, orders] = await Promise.all([api.core.listVendorQuotations(), api.core.listServiceOrders()])
  mergeServerQuotations(quotations.data)
  mergeServerServiceOrders(orders.data)
}

/** A project's quotations and service orders as the server has them now (after an accept or a vendor change). */
/** One order as the server has it now — its page reloads it on open, so Finance vendor invoices are never stale. */
export async function reloadServiceOrder (api: CoreApi, id: string): Promise<ServiceOrder> {
  return upsertServerServiceOrder((await api.core.getServiceOrder(id)).data)
}

export async function reloadProjectProcurement (api: CoreApi, projectId: string): Promise<void> {
  const [quotations, orders] = await Promise.all([api.core.listVendorQuotations({ projectId }), api.core.listServiceOrders({ projectId })])
  for (const q of quotations.data) { upsertServerQuotation(q) }
  for (const so of orders.data) { upsertServerServiceOrder(so) }
}

export async function submitQuotationOnServer (api: CoreApi, input: QuotationCreateInput, key: string = newIdempotencyKey()): Promise<VendorQuotation> {
  return upsertServerQuotation((await api.core.createVendorQuotation(input, key)).data)
}

export async function acceptQuotationOnServer (api: CoreApi, id: string): Promise<VendorQuotation> {
  const accepted = upsertServerQuotation((await api.core.acceptVendorQuotation(id)).data)
  await reloadProjectProcurement(api, accepted.projectId)
  return accepted
}

export async function rejectQuotationOnServer (api: CoreApi, id: string, reason?: string): Promise<VendorQuotation> {
  return upsertServerQuotation((await api.core.rejectVendorQuotation(id, reason)).data)
}

export interface ProcurementSyncState {
  status: 'idle' | 'loading' | 'ready' | 'offline' | 'error'
  userId: string | null
  message: string | null
}

/** Loads quotations and service orders once per signed-in user (dashboard layout, "Reset Demo Data"). */
export function useProcurementSync () {
  const api = useApi()
  const session = useServerSession()
  const { currentUser } = useCurrentUser()
  const state = useState<ProcurementSyncState>('manova-procurement-sync', () => ({ status: 'idle', userId: null, message: null }))

  async function load (force = false) {
    const userId = currentUser.value.id
    if (!force && state.value.userId === userId && (state.value.status === 'ready' || state.value.status === 'loading')) { return }
    state.value = { status: 'loading', userId, message: null }
    try {
      await session.ensure()
      await loadServerProcurement(api)
      state.value = { status: 'ready', userId, message: null }
    } catch (error) {
      const offline = isApiError(error) && (error.status === 0 || error.status >= 500)
      state.value = { status: offline ? 'offline' : 'error', userId, message: isApiError(error) ? error.message : 'Quotation & service order belum bisa dimuat dari server.' }
    }
  }

  return { state, load }
}

/**
 * Service order status (S4b): server first; the local mutator then runs only for its activity entry (it still sees
 * the old status, so its transition check passes), and the server's version of the order wins.
 */
export async function runServiceOrderStatusChange (api: CoreApi, id: string, to: string, reason: string | undefined, localSideEffects: () => unknown): Promise<ServiceOrder> {
  const dto = (await api.core.changeServiceOrderStatus(id, { to, ...(reason?.trim() ? { reason: reason.trim() } : {}) })).data
  localSideEffects()
  const order = upsertServerServiceOrder(dto)
  await refreshProjectActivities(api, order.projectId) // S7d: the server logged the status change
  return order
}

/** Orders a vendor invoice can point at (Finance dialog): the vendor's active orders, labelled with project and status. */
/** Opened from a project, only orders of that project (or without one) — picking another project's order would move the invoice. */
export function serviceOrderPickOptions (orders: ServiceOrderDto[], projectId?: string | null): { value: string; label: string; hint: string }[] {
  return orders
    .filter(so => so.status !== 'cancelled' && (!projectId || !so.projectId || so.projectId === projectId))
    .map(so => ({
      value: so.id,
      label: so.id,
      hint: [so.projectId, findStatusOption(SERVICE_ORDER_STATUSES, so.status).label].filter(Boolean).join(' · ')
    }))
}
