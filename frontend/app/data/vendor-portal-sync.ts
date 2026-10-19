import { VENDOR_PRODUCTS, VENDOR_QUOTATIONS, VENDORS } from './vendors'
import { PROJECT_SERVICES } from './projects'
import { FLIGHT_BOOKINGS } from './ticketing'
import { HOTEL_BOOKINGS } from './accommodation'
import { TRANSPORT_BOOKINGS } from './transportation'
import { MICE_EVENTS } from './mice'
import { SERVICE_ORDERS } from './procurement'
import { productFromServer, upsertServerVendor } from './vendors-sync'
import type { VendorProduct } from '~/types/vendor'
import type { VendorProductDto } from '~/types/api'
import type { ManovaApi } from '~/lib/api/endpoints'
import { isApiError } from '~/lib/api/errors'

/**
 * Vendor portal (S12d): the signed-in vendor's own profile and product catalogue from the server. Its service orders,
 * quotations, services and bookings come through the procurement and bookings syncs (the server scopes them to the
 * vendor). Products are added only through `/vendor/products`.
 */

type CoreApi = Pick<ManovaApi, 'core'>

/** The vendor's own products become the server's; other vendors' products are left as they are. */
export function mergeVendorProducts (vendorId: string, list: VendorProductDto[]): void {
  for (let i = VENDOR_PRODUCTS.length - 1; i >= 0; i--) {
    if (VENDOR_PRODUCTS[i]!.vendorId === vendorId) { VENDOR_PRODUCTS.splice(i, 1) }
  }
  VENDOR_PRODUCTS.push(...list.map(productFromServer))
}

export async function loadVendorPortal (api: CoreApi, vendorId: string): Promise<void> {
  const [vendor, products] = await Promise.all([api.core.getVendor(vendorId), api.core.listOwnVendorProducts()])
  upsertServerVendor(vendor.data)
  mergeVendorProducts(vendorId, products.data)
}

export async function createOwnVendorProductOnServer (api: CoreApi, input: { name: string; category: VendorProduct['category']; description?: string; priceIdr?: number }): Promise<VendorProduct> {
  const res = await api.core.createOwnVendorProduct({
    name: input.name,
    category: input.category,
    ...(input.description ? { description: input.description } : {}),
    ...(input.priceIdr !== undefined ? { priceMinor: String(Math.round(input.priceIdr)) } : {})
  })
  const product = productFromServer(res.data)
  VENDOR_PRODUCTS.push(product)
  return VENDOR_PRODUCTS[VENDOR_PRODUCTS.length - 1]!
}

/* ---------- leaving the vendor session ---------- */

/**
 * A vendor session replaces shared lists with its own scoped view (procurement: orders & quotations; bookings:
 * services & reduced bookings; this sync: its vendor & products). Logout/login are SPA navigations, so the next user
 * of the tab (a client does not reload these) would read the vendor's view: keep the lists as they were and put them
 * back when someone else signs in.
 */
const SHARED = () => ({
  services: PROJECT_SERVICES,
  flights: FLIGHT_BOOKINGS,
  hotels: HOTEL_BOOKINGS,
  transports: TRANSPORT_BOOKINGS,
  mice: MICE_EVENTS,
  orders: SERVICE_ORDERS,
  quotations: VENDOR_QUOTATIONS,
  vendors: VENDORS,
  products: VENDOR_PRODUCTS
}) as Record<string, unknown[]>
let snapshot: Record<string, unknown[]> | null = null

/** Called before the vendor's syncs load; the first call of a vendor session wins. */
export function takeVendorSnapshot (): void {
  if (snapshot) { return }
  snapshot = Object.fromEntries(Object.entries(SHARED()).map(([key, list]) => [key, JSON.parse(JSON.stringify(list)) as unknown[]]))
}

/** Puts the shared lists back; false when no vendor session left anything to restore. */
export function resetVendorPortal (): boolean {
  if (!snapshot) { return false }
  for (const [key, list] of Object.entries(SHARED())) { list.splice(0, list.length, ...snapshot[key]!) }
  snapshot = null
  return true
}

export interface VendorPortalSyncState {
  status: 'idle' | 'loading' | 'ready' | 'offline' | 'error'
  userId: string | null
  message: string | null
}

/** Loads the vendor's profile and products once per signed-in vendor. */
export function useVendorPortalSync () {
  const api = useApi()
  const session = useServerSession()
  const { currentUser } = useCurrentUser()
  const state = useState<VendorPortalSyncState>('manova-vendor-portal-sync', () => ({ status: 'idle', userId: null, message: null }))

  async function load (force = false) {
    const user = currentUser.value
    if (user.role !== 'vendor' || !user.vendorId) { return }
    if (!force && state.value.userId === user.id && (state.value.status === 'ready' || state.value.status === 'loading')) { return }
    state.value = { status: 'loading', userId: user.id, message: null }
    try {
      await session.ensure()
      await loadVendorPortal(api, user.vendorId)
      state.value = { status: 'ready', userId: user.id, message: null }
    } catch (error) {
      const offline = isApiError(error) && (error.status === 0 || error.status >= 500)
      state.value = { status: offline ? 'offline' : 'error', userId: user.id, message: isApiError(error) ? error.message : 'Profil & produk vendor belum bisa dimuat.' }
    }
  }

  /** Before the vendor's syncs load: keep the shared lists so they can be put back afterwards. */
  function prepare () { takeVendorSnapshot() }

  /** Someone else signed in: restore the shared lists; true when the vendor's syncs must load again next time. */
  function reset (): boolean {
    const restored = resetVendorPortal()
    if (state.value.userId !== null) { state.value = { status: 'idle', userId: null, message: null } }
    return restored
  }

  return { state, load, prepare, reset }
}
