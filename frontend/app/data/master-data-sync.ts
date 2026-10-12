import {
  AIRLINES, AIRPORTS, ASSIGNMENT_RULES, CANCELLATION_RULES, DOCUMENT_TEMPLATES, MASTER_CURRENCIES, MASTER_DESTINATIONS, MASTER_HOTELS,
  MASTER_PROJECT_TYPES, MASTER_SERVICE_TYPES, MASTER_VENDOR_CATEGORIES, MILESTONE_TEMPLATES, NUMBERING_SCHEMES, ORGANIZATION_PROFILE, PAYMENT_TERMS,
  READINESS_GATE_CONFIGS, TAX_RULES
} from './master-data'
import type { MasterDataCategoryKey } from '~/types/master-data'
import type { MasterDataRecordDto, OrganizationProfileDto, OrganizationProfileInput } from '~/types/api'
import type { ManovaApi } from '~/lib/api/endpoints'
import { isApiError } from '~/lib/api/errors'

/**
 * Server → master data arrays and the organization profile (S10b). The server is the source: each category is
 * replaced by the server's list (same objects kept, so open forms and tables stay bound), and every change goes to
 * the server first — a refused save leaves the local data as it was. Admin and Super Admin write
 * (`admin.manage-master-data`); every internal role reads.
 */

type CoreApi = Pick<ManovaApi, 'core'>
type Rec = { id: string; isActive: boolean } & Record<string, unknown>

const LISTS: Record<MasterDataCategoryKey, Rec[]> = {
  'project-type': MASTER_PROJECT_TYPES as unknown as Rec[],
  'service-type': MASTER_SERVICE_TYPES as unknown as Rec[],
  destination: MASTER_DESTINATIONS as unknown as Rec[],
  'vendor-category': MASTER_VENDOR_CATEGORIES as unknown as Rec[],
  airport: AIRPORTS as unknown as Rec[],
  airline: AIRLINES as unknown as Rec[],
  hotel: MASTER_HOTELS as unknown as Rec[],
  currency: MASTER_CURRENCIES as unknown as Rec[],
  'tax-rule': TAX_RULES as unknown as Rec[],
  'payment-term': PAYMENT_TERMS as unknown as Rec[],
  'cancellation-rule': CANCELLATION_RULES as unknown as Rec[],
  'numbering-scheme': NUMBERING_SCHEMES as unknown as Rec[],
  'document-template': DOCUMENT_TEMPLATES as unknown as Rec[],
  'readiness-gate': READINESS_GATE_CONFIGS as unknown as Rec[],
  'assignment-rule': ASSIGNMENT_RULES as unknown as Rec[],
  'milestone-template': MILESTONE_TEMPLATES as unknown as Rec[]
}

export const recordFromServer = (d: MasterDataRecordDto): Rec => ({ id: d.id, isActive: d.isActive, ...structuredClone(d.data) })

/** Overwrites `target` with `value`, dropping keys the server no longer has, without replacing the object. */
function overwrite (target: Rec, value: Rec): Rec {
  for (const key of Object.keys(target)) { if (!(key in value)) { delete target[key] } }
  return Object.assign(target, value)
}

function upsert (category: MasterDataCategoryKey, d: MasterDataRecordDto): Rec {
  const list = LISTS[category]
  const value = recordFromServer(d)
  const local = list.find(r => r.id === d.id)
  if (local) { return overwrite(local, value) }
  list.push(value)
  return list[list.length - 1]!
}

export function mergeServerMasterData (records: MasterDataRecordDto[]): void {
  const byCategory = new Map<MasterDataCategoryKey, MasterDataRecordDto[]>()
  for (const d of records) { byCategory.set(d.category, [...(byCategory.get(d.category) ?? []), d]) }
  for (const [category, rows] of byCategory) {
    const list = LISTS[category]
    if (!list) { continue }
    const next = rows.map((d) => {
      const local = list.find(r => r.id === d.id)
      return local ? overwrite(local, recordFromServer(d)) : recordFromServer(d)
    })
    list.splice(0, list.length, ...next)
  }
}

export function mergeServerOrganizationProfile (d: OrganizationProfileDto): void {
  Object.assign(ORGANIZATION_PROFILE, {
    id: d.id,
    legalName: d.legalName,
    displayName: d.displayName,
    address: d.address,
    defaultCurrencyCode: d.defaultCurrencyCode,
    businessHours: d.businessHours,
    contactEmail: d.contactEmail,
    contactPhone: d.contactPhone,
    updatedAt: d.updatedAt,
    updatedBy: d.updatedBy ?? ''
  })
}

/** Master data plus the profile; a database without a profile yet (404) keeps the local one until it is saved. */
export async function loadServerMasterData (api: CoreApi): Promise<void> {
  mergeServerMasterData((await api.core.listMasterData()).data)
  try {
    mergeServerOrganizationProfile((await api.core.getOrganizationProfile()).data)
  } catch (error) {
    if (!(isApiError(error) && error.status === 404)) { throw error }
  }
}

export async function createMasterRecordOnServer (api: CoreApi, category: MasterDataCategoryKey, input: Record<string, unknown>): Promise<Rec> {
  return upsert(category, (await api.core.createMasterRecord(category, input)).data)
}
export async function updateMasterRecordOnServer (api: CoreApi, category: MasterDataCategoryKey, id: string, patch: Record<string, unknown>): Promise<Rec> {
  return upsert(category, (await api.core.updateMasterRecord(category, id, patch)).data)
}
export async function setMasterRecordActiveOnServer (api: CoreApi, category: MasterDataCategoryKey, id: string, active: boolean): Promise<Rec> {
  const res = active ? await api.core.reactivateMasterRecord(category, id) : await api.core.deactivateMasterRecord(category, id)
  return upsert(category, res.data)
}
export async function updateOrganizationProfileOnServer (api: CoreApi, input: OrganizationProfileInput): Promise<typeof ORGANIZATION_PROFILE> {
  const { legalName, displayName, address, defaultCurrencyCode, businessHours, contactEmail, contactPhone } = input
  mergeServerOrganizationProfile((await api.core.updateOrganizationProfile({ legalName, displayName, address, defaultCurrencyCode, businessHours, contactEmail, contactPhone })).data)
  return ORGANIZATION_PROFILE
}

export interface MasterDataSyncState {
  status: 'idle' | 'loading' | 'ready' | 'offline' | 'error'
  userId: string | null
  message: string | null
}

/** Loads master data once per signed-in user (dashboard layout, "Reset Demo Data"). */
export function useMasterDataSync () {
  const api = useApi()
  const session = useServerSession()
  const { currentUser } = useCurrentUser()
  const state = useState<MasterDataSyncState>('manova-master-data-sync', () => ({ status: 'idle', userId: null, message: null }))

  async function load (force = false) {
    const userId = currentUser.value.id
    if (!force && state.value.userId === userId && (state.value.status === 'ready' || state.value.status === 'loading')) { return }
    state.value = { status: 'loading', userId, message: null }
    try {
      await session.ensure()
      await loadServerMasterData(api)
      state.value = { status: 'ready', userId, message: null }
    } catch (error) {
      const offline = isApiError(error) && (error.status === 0 || error.status >= 500)
      state.value = { status: offline ? 'offline' : 'error', userId, message: isApiError(error) ? error.message : 'Master data belum bisa dimuat dari server.' }
    }
  }

  return { state, load }
}
