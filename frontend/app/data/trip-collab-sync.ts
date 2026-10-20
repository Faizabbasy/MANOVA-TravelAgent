import { ITINERARY_VERSIONS } from './itinerary-versions'
import { TRIP_ANNOUNCEMENTS } from './trip-center'
import { PROJECTS } from './projects'
import type { ItineraryVersion } from '~/types/itinerary-version'
import type { ItineraryItem, ServiceTypeKey } from '~/types/project'
import type { TripAnnouncement } from '~/types/trip-center'
import type { ItineraryVersionDto, TripAnnouncementDto } from '~/types/api'
import type { ManovaApi } from '~/lib/api/endpoints'
import { isApiError } from '~/lib/api/errors'

/**
 * S12c-4: itinerary versions (staff publish a frozen snapshot of the client-visible items; the client approves or asks
 * for a revision) and trip announcements (the client confirms those that ask for it) come from the server. The old
 * local "request revision creates the next version" mock is gone — staff publish the next version.
 */

type CoreApi = Pick<ManovaApi, 'core'>
const opt = <T>(v: T | null | undefined): T | undefined => (v === null ? undefined : v)
const clean = <T extends object>(o: T): T => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T

export const versionFromServer = (d: ItineraryVersionDto): ItineraryVersion => clean({
  id: d.id,
  projectId: d.projectId,
  versionNumber: d.versionNumber,
  status: d.status,
  items: d.items.map(i => clean({
    id: i.id,
    projectId: d.projectId,
    date: i.date,
    time: opt(i.time),
    title: i.title,
    description: opt(i.description),
    serviceType: opt(i.serviceType) as ServiceTypeKey | undefined,
    timezone: opt(i.timezone),
    location: opt(i.location)
  }) as ItineraryItem),
  createdAt: d.createdAt,
  createdBy: d.createdBy ?? '',
  note: opt(d.note),
  revisionComment: opt(d.revisionComment)
})

export const announcementFromServer = (d: TripAnnouncementDto): TripAnnouncement => ({
  id: d.id,
  projectId: d.projectId,
  title: d.title,
  message: d.message,
  publishedAt: d.publishedAt,
  publishedBy: d.publishedBy ?? '',
  requiresConfirmation: d.requiresConfirmation,
  confirmedByUserIds: d.confirmations.map(c => c.userId)
})

const upsert = <T extends { id: string }>(list: T[], row: T): T => {
  const i = list.findIndex(x => x.id === row.id)
  if (i === -1) { list.push(row) } else { list.splice(i, 1, row) }
  return row
}

/** The given projects' versions and announcements become the server's; other projects' stay as they are. */
export function mergeClientTrip (projectIds: string[], versions: ItineraryVersionDto[], announcements: TripAnnouncementDto[]): void {
  const ids = new Set([...projectIds, ...versions.map(v => v.projectId), ...announcements.map(a => a.projectId)])
  for (let i = ITINERARY_VERSIONS.length - 1; i >= 0; i--) {
    if (ids.has(ITINERARY_VERSIONS[i]!.projectId)) { ITINERARY_VERSIONS.splice(i, 1) }
  }
  ITINERARY_VERSIONS.push(...versions.map(versionFromServer))
  for (let i = TRIP_ANNOUNCEMENTS.length - 1; i >= 0; i--) {
    if (ids.has(TRIP_ANNOUNCEMENTS[i]!.projectId)) { TRIP_ANNOUNCEMENTS.splice(i, 1) }
  }
  TRIP_ANNOUNCEMENTS.push(...announcements.map(announcementFromServer))
}

/* ---------- client writes ---------- */

export const clientDecideItineraryVersionOnServer = async (api: CoreApi, id: string, decision: 'approve' | 'request-revision', comment?: string) =>
  upsert(ITINERARY_VERSIONS, versionFromServer((await api.core.clientDecideItineraryVersion(id, decision, comment)).data))
export const clientConfirmAnnouncementOnServer = async (api: CoreApi, id: string) =>
  upsert(TRIP_ANNOUNCEMENTS, announcementFromServer((await api.core.clientConfirmAnnouncement(id)).data))

/* ---------- loading (client) ---------- */

export async function loadClientTrip (api: CoreApi, partyId: string): Promise<void> {
  const [versions, announcements] = await Promise.all([api.core.listClientItineraryVersions(), api.core.listClientAnnouncements()])
  mergeClientTrip(PROJECTS.filter(p => p.partyId === partyId).map(p => p.id), versions.data, announcements.data)
}

export interface ClientTripSyncState {
  status: 'idle' | 'loading' | 'ready' | 'offline' | 'error'
  userId: string | null
  message: string | null
}

/** Loads the client portal's itinerary versions and trip announcements once per signed-in client (`load(true)` re-reads). */
export function useClientTripSync () {
  const api = useApi()
  const session = useServerSession()
  const { currentUser } = useCurrentUser()
  const state = useState<ClientTripSyncState>('manova-client-trip-sync', () => ({ status: 'idle', userId: null, message: null }))

  async function load (force = false) {
    const user = currentUser.value
    if (user.role !== 'client' || !user.clientPartyId) { return }
    if (!force && state.value.userId === user.id && (state.value.status === 'ready' || state.value.status === 'loading')) { return }
    state.value = { status: 'loading', userId: user.id, message: null }
    try {
      await session.ensure()
      await loadClientTrip(api, user.clientPartyId)
      state.value = { status: 'ready', userId: user.id, message: null }
    } catch (error) {
      const offline = isApiError(error) && (error.status === 0 || error.status >= 500)
      state.value = { status: offline ? 'offline' : 'error', userId: user.id, message: isApiError(error) ? error.message : 'Versi itinerary & pengumuman belum bisa dimuat.' }
    }
  }

  return { state, load }
}
