import { CONTACTS, PARTIES, PARTY_ACTIVITIES } from './parties'
import type { ContactPerson, Party, PartyActivity } from '~/types/party'
import type { PartyActivityDto, PartyContactDto, PartyDto } from '~/types/api'

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
