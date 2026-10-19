import { VENDOR_CONTACTS, VENDOR_DOCUMENTS, VENDOR_PRODUCTS, VENDORS } from './vendors'
import type { Vendor, VendorContact, VendorDocument, VendorProduct } from '~/types/vendor'
import type { VendorContactDto, VendorCreateInput, VendorDocumentDto, VendorDto, VendorPatchInput, VendorProductDto } from '~/types/api'
import type { ManovaApi } from '~/lib/api/endpoints'
import { newIdempotencyKey } from '~/lib/api/client'
import { isApiError } from '~/lib/api/errors'

/**
 * Server → `VENDORS` / `VENDOR_CONTACTS` / `VENDOR_PRODUCTS` / `VENDOR_DOCUMENTS` (S2, vendor backend). The server
 * owns the vendor profile, contacts, catalog and document records; vendor quotations, activities and service
 * orders stay local (procurement). Vendor objects are updated in place so page references keep working.
 */

const orUndefined = <T>(value: T | null): T | undefined => (value === null ? undefined : value)

function serverVendorFields (dto: VendorDto): Partial<Vendor> {
  return {
    id: dto.id,
    name: dto.name,
    serviceType: dto.serviceType,
    status: dto.status,
    contactName: dto.contactName ?? '',
    contactPhone: orUndefined(dto.contactPhone),
    category: orUndefined(dto.category)
  }
}

export function upsertServerVendor (dto: VendorDto): Vendor {
  const local = VENDORS.find(v => v.id === dto.id)
  if (local) {
    Object.assign(local, serverVendorFields(dto))
    return local
  }
  VENDORS.push(serverVendorFields(dto) as Vendor)
  return VENDORS[VENDORS.length - 1]!
}

export function mergeServerVendors (list: VendorDto[]): void {
  const keep = new Set(list.map(v => v.id))
  for (let i = VENDORS.length - 1; i >= 0; i--) {
    if (!keep.has(VENDORS[i]!.id)) { VENDORS.splice(i, 1) }
  }
  for (const dto of list) { upsertServerVendor(dto) }
}

const contactFromServer = (d: VendorContactDto): VendorContact => ({ id: d.id, vendorId: d.vendorId, name: d.name, title: d.title, email: orUndefined(d.email), phone: orUndefined(d.phone) })
export const productFromServer = (d: VendorProductDto): VendorProduct => ({
  id: d.id,
  vendorId: d.vendorId,
  name: d.name,
  category: d.category,
  description: orUndefined(d.description),
  priceIdr: d.priceMinor === null ? undefined : Number(d.priceMinor)
})
const documentFromServer = (d: VendorDocumentDto): VendorDocument => ({ id: d.id, vendorId: d.vendorId, name: d.name, type: d.type, uploadedAt: d.uploadedAt })

export function mergeServerVendorCatalog (catalog: { contacts: VendorContactDto[]; products: VendorProductDto[]; documents: VendorDocumentDto[] }): void {
  VENDOR_CONTACTS.splice(0, VENDOR_CONTACTS.length, ...catalog.contacts.map(contactFromServer))
  VENDOR_PRODUCTS.splice(0, VENDOR_PRODUCTS.length, ...catalog.products.map(productFromServer))
  VENDOR_DOCUMENTS.splice(0, VENDOR_DOCUMENTS.length, ...catalog.documents.map(documentFromServer))
}

/** Every vendor and its catalog; the local arrays change only after everything arrived. */
export async function loadServerVendors (api: Pick<ManovaApi, 'core'>): Promise<void> {
  const vendors: VendorDto[] = []
  let cursor: string | undefined
  for (let page = 0; page < 200; page++) {
    const res = await api.core.listVendors({ limit: 100, ...(cursor ? { cursor } : {}) })
    vendors.push(...res.data)
    const next = res.meta.pagination?.nextCursor ?? null
    if (!next) { break }
    cursor = next
  }
  const [contacts, products, documents] = await Promise.all([api.core.listVendorContacts(), api.core.listVendorProducts(), api.core.listVendorDocuments()])
  mergeServerVendors(vendors)
  mergeServerVendorCatalog({ contacts: contacts.data, products: products.data, documents: documents.data })
}

export async function createVendorOnServer (api: Pick<ManovaApi, 'core'>, input: VendorCreateInput, idempotencyKey: string = newIdempotencyKey()): Promise<Vendor> {
  return upsertServerVendor((await api.core.createVendor(input, idempotencyKey)).data)
}

export async function updateVendorOnServer (api: Pick<ManovaApi, 'core'>, vendorId: string, input: VendorPatchInput): Promise<Vendor> {
  return upsertServerVendor((await api.core.updateVendor(vendorId, input)).data)
}

export async function createVendorContactOnServer (api: Pick<ManovaApi, 'core'>, vendorId: string, input: { name: string; title: string; email?: string; phone?: string }): Promise<VendorContact> {
  VENDOR_CONTACTS.push(contactFromServer((await api.core.createVendorContact(vendorId, input)).data))
  return VENDOR_CONTACTS[VENDOR_CONTACTS.length - 1]!
}

export async function createVendorProductOnServer (api: Pick<ManovaApi, 'core'>, vendorId: string, input: { name: string; category: VendorProduct['category']; description?: string; priceIdr?: number }): Promise<VendorProduct> {
  const res = await api.core.createVendorProduct(vendorId, {
    name: input.name,
    category: input.category,
    ...(input.description ? { description: input.description } : {}),
    ...(input.priceIdr !== undefined ? { priceMinor: String(Math.round(input.priceIdr)) } : {})
  })
  VENDOR_PRODUCTS.push(productFromServer(res.data))
  return VENDOR_PRODUCTS[VENDOR_PRODUCTS.length - 1]!
}

export async function createVendorDocumentOnServer (api: Pick<ManovaApi, 'core'>, vendorId: string, input: { name: string; type: string }): Promise<VendorDocument> {
  VENDOR_DOCUMENTS.push(documentFromServer((await api.core.createVendorDocument(vendorId, input)).data))
  return VENDOR_DOCUMENTS[VENDOR_DOCUMENTS.length - 1]!
}

export interface VendorsSyncState {
  status: 'idle' | 'loading' | 'ready' | 'offline' | 'error'
  userId: string | null
  message: string | null
}

/** Loads vendors once per signed-in user (dashboard layout, "Reset Demo Data"). */
export function useVendorsSync () {
  const api = useApi()
  const session = useServerSession()
  const { currentUser } = useCurrentUser()
  const state = useState<VendorsSyncState>('manova-vendors-sync', () => ({ status: 'idle', userId: null, message: null }))

  async function load (force = false) {
    const userId = currentUser.value.id
    if (!force && state.value.userId === userId && (state.value.status === 'ready' || state.value.status === 'loading')) { return }
    state.value = { status: 'loading', userId, message: null }
    try {
      await session.ensure()
      await loadServerVendors(api)
      state.value = { status: 'ready', userId, message: null }
    } catch (error) {
      const offline = isApiError(error) && (error.status === 0 || error.status >= 500)
      state.value = { status: offline ? 'offline' : 'error', userId, message: isApiError(error) ? error.message : 'Daftar vendor belum bisa dimuat dari server.' }
    }
  }

  return { state, load }
}
