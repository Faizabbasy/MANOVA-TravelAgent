import { ITINERARY_ITEMS } from './projects'
import type { ItineraryItem } from '~/types/project'
import type { ItineraryItemDto, ItineraryItemInput } from '~/types/api'
import type { ManovaApi } from '~/lib/api/endpoints'
import { newIdempotencyKey } from '~/lib/api/client'
import { isApiError } from '~/lib/api/errors'

/**
 * Server → `ITINERARY_ITEMS` (S7b). The server owns the daily itinerary; writes go to the server first and its answer
 * replaces the local item in place. Itinerary versions and comments stay local with the hidden client portal (ADR-006).
 */

type CoreApi = Pick<ManovaApi, 'core'>
const opt = <T>(v: T | null | undefined): T | undefined => (v === null ? undefined : v)

export function itineraryItemFromServer (d: ItineraryItemDto): ItineraryItem {
  return {
    id: d.id,
    projectId: d.projectId,
    date: d.date,
    time: opt(d.time),
    title: d.title,
    description: opt(d.description),
    serviceType: opt(d.serviceType),
    groupId: opt(d.groupId),
    timezone: opt(d.timezone),
    location: opt(d.location),
    visibleToClient: d.visibleToClient,
    vendorId: opt(d.vendorId),
    vendorAmountIdr: d.vendorAmountMinor === null ? undefined : Number(d.vendorAmountMinor)
  }
}

function upsert (value: ItineraryItem): ItineraryItem {
  const local = ITINERARY_ITEMS.find(x => x.id === value.id)
  if (!local) {
    ITINERARY_ITEMS.push(value)
    return ITINERARY_ITEMS[ITINERARY_ITEMS.length - 1]!
  }
  Object.assign(local, value)
  return local
}

export function mergeServerItinerary (items: ItineraryItemDto[]): void {
  const keep = new Set(items.map(x => x.id))
  for (let i = ITINERARY_ITEMS.length - 1; i >= 0; i--) {
    if (!keep.has(ITINERARY_ITEMS[i]!.id)) { ITINERARY_ITEMS.splice(i, 1) }
  }
  for (const item of items) { upsert(itineraryItemFromServer(item)) }
}

export async function loadServerItinerary (api: CoreApi): Promise<void> {
  mergeServerItinerary((await api.core.listItineraryItems()).data)
}

type ItineraryPatch = Partial<Omit<ItineraryItem, 'id' | 'projectId'>>
const TEXT_FIELDS = ['time', 'description', 'serviceType', 'groupId', 'timezone', 'location'] as const

/**
 * Form patch → API input. A field present but empty clears it on the server (`null`); clearing the vendor also clears
 * its amount; rupiah becomes a whole-number minor string.
 */
export function itineraryInput (patch: ItineraryPatch): ItineraryItemInput {
  const out: ItineraryItemInput = {}
  if ('date' in patch && patch.date !== undefined) { out.date = patch.date }
  if ('title' in patch && patch.title !== undefined) { out.title = patch.title }
  for (const field of TEXT_FIELDS) {
    if (field in patch) { (out as Record<string, unknown>)[field] = patch[field] || null }
  }
  if ('visibleToClient' in patch && patch.visibleToClient !== undefined) { out.visibleToClient = patch.visibleToClient }
  if ('vendorId' in patch) {
    out.vendorId = patch.vendorId || null
    if (!out.vendorId) { out.vendorAmountMinor = null }
  }
  if ('vendorAmountIdr' in patch && out.vendorAmountMinor !== null) {
    out.vendorAmountMinor = patch.vendorAmountIdr == null ? null : String(Math.max(0, Math.round(patch.vendorAmountIdr)))
  }
  return out
}

export async function createItineraryItemOnServer (api: CoreApi, projectId: string, input: ItineraryItemInput & { date: string; title: string }, key: string = newIdempotencyKey()): Promise<ItineraryItem> {
  return upsert(itineraryItemFromServer((await api.core.createItineraryItem(projectId, input, key)).data))
}
export async function updateItineraryItemOnServer (api: CoreApi, id: string, input: ItineraryItemInput): Promise<ItineraryItem> {
  return upsert(itineraryItemFromServer((await api.core.updateItineraryItem(id, input)).data))
}
export async function deleteItineraryItemOnServer (api: CoreApi, id: string): Promise<void> {
  await api.core.deleteItineraryItem(id)
  const index = ITINERARY_ITEMS.findIndex(x => x.id === id)
  if (index !== -1) { ITINERARY_ITEMS.splice(index, 1) }
}

export interface ItinerarySyncState {
  status: 'idle' | 'loading' | 'ready' | 'offline' | 'error'
  userId: string | null
  message: string | null
}

/** Loads the daily itinerary once per signed-in user (dashboard layout, "Reset Demo Data"). */
export function useItinerarySync () {
  const api = useApi()
  const session = useServerSession()
  const { currentUser } = useCurrentUser()
  const state = useState<ItinerarySyncState>('manova-itinerary-sync', () => ({ status: 'idle', userId: null, message: null }))

  async function load (force = false) {
    const userId = currentUser.value.id
    if (!force && state.value.userId === userId && (state.value.status === 'ready' || state.value.status === 'loading')) { return }
    state.value = { status: 'loading', userId, message: null }
    try {
      await session.ensure()
      await loadServerItinerary(api)
      state.value = { status: 'ready', userId, message: null }
    } catch (error) {
      const offline = isApiError(error) && (error.status === 0 || error.status >= 500)
      state.value = { status: offline ? 'offline' : 'error', userId, message: isApiError(error) ? error.message : 'Itinerary belum bisa dimuat dari server.' }
    }
  }

  return { state, load }
}
