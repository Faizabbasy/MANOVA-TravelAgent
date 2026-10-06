import type { PartyDto } from '~/types/api'

/** A customer as `GET /parties` returns it to internal roles (for tests only). */
export function serverPartyDto (over: Partial<PartyDto> = {}): PartyDto {
  return {
    id: 'PTY-901',
    name: 'PT Uji Server',
    lifecycleStatus: 'client',
    partyType: 'company',
    preferredCurrency: null,
    industry: null,
    companyType: null,
    size: null,
    address: null,
    city: null,
    province: null,
    country: null,
    postalCode: null,
    phone: null,
    email: null,
    website: null,
    accountOwnerUserId: 'USR-001',
    registrationNumber: null,
    npwp: null,
    billingName: null,
    billingAddress: null,
    paymentTerm: null,
    poRequired: false,
    travelPreferences: null,
    creditLimitMinor: null,
    createdAt: '2026-10-06',
    provenance: 'manual',
    ...over
  }
}
