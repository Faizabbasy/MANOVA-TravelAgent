import { CONTACTS, PARTIES, PARTY_ACTIVITIES } from './parties'
import { getLeadById, setPartyActivitySink } from './index'
import type { ContactPerson, Party, PartyActivity } from '~/types/party'
import type { ContactCreateInput, PartyActivityDto, PartyContactDto, PartyCreateInput, PartyDto } from '~/types/api'
import type { ManovaApi } from '~/lib/api/endpoints'
import { newIdempotencyKey } from '~/lib/api/client'
import { isApiError } from '~/lib/api/errors'

/**
 * Server → `PARTIES` / `CONTACTS` / `PARTY_ACTIVITIES` (S1, spec 2026-10-06-customer-backend). The server owns
 * the customer profile, credit limit (Finance), contacts and the CRM activity log. Fields still local
 * (portal logo, pending sensitive changes) stay on the local object, which is updated in place.
 */

const orUndefined = <T>(value: T | null): T | undefined => (value === null ? undefined : value)

function serverPartyFields (dto: PartyDto): Partial<Party> {
  return {
    id: dto.id,
    name: dto.name,
    lifecycleStatus: dto.lifecycleStatus,
    partyType: orUndefined(dto.partyType),
    preferredCurrency: orUndefined(dto.preferredCurrency) as Party['preferredCurrency'],
    industry: orUndefined(dto.industry),
    companyType: orUndefined(dto.companyType),
    size: orUndefined(dto.size),
    address: orUndefined(dto.address),
    city: orUndefined(dto.city),
    province: orUndefined(dto.province),
    country: orUndefined(dto.country),
    postalCode: orUndefined(dto.postalCode),
    phone: orUndefined(dto.phone),
    email: orUndefined(dto.email),
    website: orUndefined(dto.website),
    accountOwnerId: orUndefined(dto.accountOwnerUserId),
    registrationNumber: orUndefined(dto.registrationNumber),
    npwp: orUndefined(dto.npwp),
    billingName: orUndefined(dto.billingName),
    billingAddress: orUndefined(dto.billingAddress),
    paymentTerm: orUndefined(dto.paymentTerm),
    poRequired: dto.poRequired || undefined,
    travelPreferences: orUndefined(dto.travelPreferences),
    // Internal roles always see the limit (`canViewFullFinancials`), so null means "no limit".
    creditLimitIdr: dto.creditLimitMinor === null ? undefined : Number(dto.creditLimitMinor),
    createdAt: dto.createdAt
  }
}

/** Updates (in place) or appends one server customer. */
export function upsertServerParty (dto: PartyDto): Party {
  const local = PARTIES.find(p => p.id === dto.id)
  if (local) {
    Object.assign(local, serverPartyFields(dto))
    return local
  }
  PARTIES.push(serverPartyFields(dto) as Party)
  return PARTIES[PARTIES.length - 1]!
}

/** The full server list replaces the local one. */
export function mergeServerParties (list: PartyDto[]): void {
  const keep = new Set(list.map(p => p.id))
  for (let i = PARTIES.length - 1; i >= 0; i--) {
    if (!keep.has(PARTIES[i]!.id)) { PARTIES.splice(i, 1) }
  }
  for (const dto of list) { upsertServerParty(dto) }
}

export function contactFromServer (dto: PartyContactDto): ContactPerson {
  return { id: dto.id, partyId: dto.partyId, name: dto.name, title: dto.title, email: orUndefined(dto.email), phone: orUndefined(dto.phone) }
}

export function activityFromServer (dto: PartyActivityDto): PartyActivity {
  return {
    id: dto.id,
    partyId: dto.partyId,
    leadId: orUndefined(dto.leadId),
    type: dto.type,
    message: dto.message,
    ownerId: dto.ownerUserId,
    createdAt: dto.activityDate,
    dueAt: orUndefined(dto.dueAt)
  }
}

export function mergeServerContacts (list: PartyContactDto[]): void {
  CONTACTS.splice(0, CONTACTS.length, ...list.map(contactFromServer))
}

export function mergeServerActivities (list: PartyActivityDto[]): void {
  PARTY_ACTIVITIES.splice(0, PARTY_ACTIVITIES.length, ...list.map(activityFromServer))
}

/** A locally logged activity got its server ID: keep the row, swap the ID. */
export function applyServerActivityId (localId: string, serverId: string): void {
  const row = PARTY_ACTIVITIES.find(a => a.id === localId)
  if (row) { row.id = serverId }
}

/**
 * The sink `createPartyActivity` calls for every new activity: it is already on screen, the server copy is
 * written in the background. A failure keeps the local row and warns the user (it disappears after a reload).
 */
export function makeActivitySink (api: Pick<ManovaApi, 'core'>, warn: (message: string) => void) {
  return async (activity: PartyActivity): Promise<void> => {
    try {
      const res = await api.core.createActivity(activity.partyId, {
        type: activity.type,
        message: activity.message,
        ...(activity.leadId ? { leadId: activity.leadId } : {}),
        ...(activity.dueAt ? { dueAt: activity.dueAt } : {})
      })
      applyServerActivityId(activity.id, res.data.id)
    } catch {
      warn('Aktivitas belum tersimpan ke server dan akan hilang setelah halaman dimuat ulang.')
    }
  }
}

/** Every customer, contact and activity; the local arrays change only after all three arrived. */
export async function loadServerCustomers (api: Pick<ManovaApi, 'core'>): Promise<void> {
  const parties: PartyDto[] = []
  let cursor: string | undefined
  for (let page = 0; page < 200; page++) {
    const res = await api.core.listParties({ limit: 100, ...(cursor ? { cursor } : {}) })
    parties.push(...res.data)
    const next = res.meta.pagination?.nextCursor ?? null
    if (!next) { break }
    cursor = next
  }
  const [contacts, activities] = await Promise.all([api.core.listAllContacts(), api.core.listActivities({})])
  mergeServerParties(parties)
  mergeServerContacts(contacts.data)
  mergeServerActivities(activities.data)
}

export interface CustomersSyncState {
  status: 'idle' | 'loading' | 'ready' | 'offline' | 'error'
  userId: string | null
  message: string | null
}

/** Loads customers once per signed-in user and installs the activity sink (dashboard layout, "Reset Demo Data"). */
export function useCustomersSync () {
  const api = useApi()
  const session = useServerSession()
  const { currentUser } = useCurrentUser()
  const { showToast } = useToast()
  const state = useState<CustomersSyncState>('manova-customers-sync', () => ({ status: 'idle', userId: null, message: null }))

  async function load (force = false) {
    const userId = currentUser.value.id
    if (!force && state.value.userId === userId && (state.value.status === 'ready' || state.value.status === 'loading')) { return }
    state.value = { status: 'loading', userId, message: null }
    try {
      await session.ensure()
      await loadServerCustomers(api)
      setPartyActivitySink(makeActivitySink(api, message => showToast('Aktivitas', message, 'warning')))
      state.value = { status: 'ready', userId, message: null }
    } catch (error) {
      setPartyActivitySink(null)
      const offline = isApiError(error) && (error.status === 0 || error.status >= 500)
      state.value = {
        status: offline ? 'offline' : 'error',
        userId,
        message: isApiError(error) ? error.message : 'Daftar customer belum bisa dimuat dari server.'
      }
    }
  }

  return { state, load }
}

/** Creates a customer on the server (one idempotency key per form fill) and adds it to `PARTIES`. */
export async function createPartyOnServer (api: Pick<ManovaApi, 'core'>, input: PartyCreateInput, idempotencyKey: string = newIdempotencyKey()): Promise<Party> {
  const res = await api.core.createParty(input, idempotencyKey)
  return upsertServerParty(res.data)
}

/**
 * The customer a lead qualifies into: an existing one with the same name (company: case-insensitive company
 * name; individual: an individual with the lead's name), otherwise a new one on the server. Throws when the
 * server refuses, before the lead is touched.
 */
export async function ensureCustomerForLead (api: Pick<ManovaApi, 'core'>, leadId: string, kind: 'company' | 'individual', idempotencyKey: string = newIdempotencyKey()): Promise<Party> {
  const lead = getLeadById(leadId)
  if (!lead) { throw new Error(`Lead ${leadId} tidak ditemukan.`) }
  const name = (kind === 'company' ? lead.companyName || lead.name : lead.name).trim()
  const existing = PARTIES.find(p => p.name.toLowerCase() === name.toLowerCase() && (kind === 'company' ? p.partyType !== 'individual' : p.partyType === 'individual'))
  if (existing) { return existing }
  return await createPartyOnServer(api, {
    name,
    partyType: kind,
    lifecycleStatus: kind === 'individual' ? 'client' : 'prospect',
    accountOwnerUserId: lead.handedOverTo ?? lead.ownerId
  }, idempotencyKey)
}

/** Adds a contact person on the server (internal CRM; the hidden client portal keeps its local `createContact`). */
export async function createContactOnServer (api: Pick<ManovaApi, 'core'>, partyId: string, input: ContactCreateInput): Promise<ContactPerson> {
  const res = await api.core.createContact(partyId, input)
  CONTACTS.push(contactFromServer(res.data))
  return CONTACTS[CONTACTS.length - 1]!
}

/** Finance sets (or clears, with `null`) a customer's credit limit with a reason; the answer updates `PARTIES`. */
export async function setCreditLimitOnServer (api: Pick<ManovaApi, 'core'>, partyId: string, limitIdr: number | null, reason: string): Promise<Party> {
  const res = await api.core.setCreditLimit(partyId, {
    creditLimitMinor: limitIdr === null ? null : String(Math.round(limitIdr)),
    reason: reason.trim()
  })
  return upsertServerParty(res.data)
}
