import { ROOM_ASSIGNMENTS, TRAVELERS, TRAVELER_GROUPS } from './projects'
import type { RoomAssignment, Traveler, TravelerGroup } from '~/types/project'
import type { RoomAssignmentDto, TravelerDto, TravelerGroupDto, TravelerInput } from '~/types/api'
import type { ManovaApi } from '~/lib/api/endpoints'
import { newIdempotencyKey } from '~/lib/api/client'
import { isApiError } from '~/lib/api/errors'

/**
 * Server → `TRAVELERS`, `TRAVELER_GROUPS`, `ROOM_ASSIGNMENTS` (S7a). The server owns participants, groups and the
 * rooming list; writes go to the server first and its answer replaces the local object in place. The hidden client
 * portal still edits locally (ADR-006).
 */

type CoreApi = Pick<ManovaApi, 'core'>
const opt = <T>(v: T | null | undefined): T | undefined => (v === null ? undefined : v)

export function travelerFromServer (d: TravelerDto): Traveler {
  return {
    id: d.id,
    projectId: d.projectId,
    groupId: opt(d.groupId),
    partyId: opt(d.partyId),
    leadId: opt(d.leadId),
    salesOrderId: opt(d.salesOrderId),
    name: d.name,
    passportNumber: opt(d.passportNumber),
    passportExpiryDate: opt(d.passportExpiryDate),
    idNumber: opt(d.idNumber),
    visaNumber: opt(d.visaNumber),
    visaExpiryDate: opt(d.visaExpiryDate),
    emergencyContactName: opt(d.emergencyContactName),
    emergencyContactPhone: opt(d.emergencyContactPhone),
    specialRequest: opt(d.specialRequest),
    dietaryRestrictions: opt(d.dietaryRestrictions),
    accessibilityNeeds: opt(d.accessibilityNeeds),
    companionOfTravelerId: opt(d.companionOfTravelerId),
    documentsVerifiedAt: opt(d.documentsVerifiedOn),
    documentsVerifiedBy: opt(d.documentsVerifiedBy),
    isVip: d.isVip,
    cancelled: d.cancelled,
    cancelReason: opt(d.cancelReason),
    replacedByTravelerId: opt(d.replacedByTravelerId),
    replacesTravelerId: opt(d.replacesTravelerId)
  }
}

const groupFromServer = (d: TravelerGroupDto): TravelerGroup => ({ id: d.id, projectId: d.projectId, name: d.name, paxCount: d.paxCount, roomingNote: opt(d.roomingNote) })
const roomFromServer = (d: RoomAssignmentDto): RoomAssignment => ({ id: d.id, projectId: d.projectId, groupId: d.groupId, roomLabel: d.roomLabel, roomType: d.roomType, travelerIds: [...d.travelerIds] })

function upsert<T extends { id: string }> (list: T[], value: T): T {
  const local = list.find(x => x.id === value.id)
  if (!local) {
    list.push(value)
    return list[list.length - 1]!
  }
  Object.assign(local, value)
  return local
}

function replaceAll<T extends { id: string }> (list: T[], values: T[]) {
  const keep = new Set(values.map(v => v.id))
  for (let i = list.length - 1; i >= 0; i--) {
    if (!keep.has(list[i]!.id)) { list.splice(i, 1) }
  }
  for (const v of values) { upsert(list, v) }
}

export const upsertServerTraveler = (d: TravelerDto): Traveler => upsert(TRAVELERS, travelerFromServer(d))
export const upsertServerGroup = (d: TravelerGroupDto): TravelerGroup => upsert(TRAVELER_GROUPS, groupFromServer(d))
export const upsertServerRoom = (d: RoomAssignmentDto): RoomAssignment => upsert(ROOM_ASSIGNMENTS, roomFromServer(d))

export function mergeServerTravelers (travelers: TravelerDto[], groups: TravelerGroupDto[], rooms: RoomAssignmentDto[]): void {
  replaceAll(TRAVELERS, travelers.map(travelerFromServer))
  replaceAll(TRAVELER_GROUPS, groups.map(groupFromServer))
  replaceAll(ROOM_ASSIGNMENTS, rooms.map(roomFromServer))
}

export async function loadServerTravelers (api: CoreApi): Promise<void> {
  const [travelers, groups, rooms] = await Promise.all([api.core.listTravelers(), api.core.listTravelerGroups(), api.core.listRoomAssignments()])
  mergeServerTravelers(travelers.data, groups.data, rooms.data)
}

/** One project's participants as the server has them now (e.g. after a Group Trip DP created travelers). */
export async function reloadProjectTravelers (api: CoreApi, projectId: string): Promise<void> {
  const [travelers, rooms] = await Promise.all([api.core.listTravelers({ projectId }), api.core.listRoomAssignments({ projectId })])
  for (const t of travelers.data) { upsertServerTraveler(t) }
  for (const r of rooms.data) { upsertServerRoom(r) }
}

/**
 * After a sales order status change: a cancelled Group Trip order cancelled its travelers on the server and took them
 * out of their rooms (S7a), so that project's participants are reloaded. Other changes leave participants untouched.
 */
export async function reloadTravelersAfterOrderChange (api: CoreApi, order: { status: string; projectId?: string }): Promise<void> {
  if (order.status !== 'cancelled' || !order.projectId) { return }
  await reloadProjectTravelers(api, order.projectId)
}

export async function createTravelerOnServer (api: CoreApi, projectId: string, input: TravelerInput & { name: string }, key: string = newIdempotencyKey()): Promise<Traveler> {
  return upsertServerTraveler((await api.core.createTraveler(projectId, input, key)).data)
}
export async function updateTravelerOnServer (api: CoreApi, id: string, input: TravelerInput): Promise<Traveler> {
  return upsertServerTraveler((await api.core.updateTraveler(id, input)).data)
}
export async function deleteTravelerOnServer (api: CoreApi, id: string): Promise<void> {
  await api.core.deleteTraveler(id)
  const index = TRAVELERS.findIndex(x => x.id === id)
  if (index !== -1) { TRAVELERS.splice(index, 1) }
  for (const room of ROOM_ASSIGNMENTS) { room.travelerIds = room.travelerIds.filter(x => x !== id) }
}
export async function verifyTravelerOnServer (api: CoreApi, id: string, verified: boolean): Promise<Traveler> {
  return upsertServerTraveler((await api.core.verifyTraveler(id, verified)).data)
}
export async function setTravelerVipOnServer (api: CoreApi, id: string, isVip: boolean): Promise<Traveler> {
  return upsertServerTraveler((await api.core.setTravelerVip(id, isVip)).data)
}
export async function cancelTravelerOnServer (api: CoreApi, id: string, reason: string): Promise<Traveler> {
  const traveler = upsertServerTraveler((await api.core.cancelTraveler(id, reason)).data)
  for (const room of ROOM_ASSIGNMENTS) { room.travelerIds = room.travelerIds.filter(x => x !== id) }
  return traveler
}
export async function replaceTravelerOnServer (api: CoreApi, id: string, input: TravelerInput & { name: string }): Promise<Traveler> {
  const replacement = upsertServerTraveler((await api.core.replaceTraveler(id, input)).data)
  await reloadProjectTravelers(api, replacement.projectId)
  return replacement
}
export async function importTravelersOnServer (api: CoreApi, projectId: string, rows: { name: string; passportNumber?: string; groupId?: string }[], key: string = newIdempotencyKey()) {
  const res = (await api.core.importTravelers(projectId, rows, key)).data
  return { created: res.created.map(upsertServerTraveler), rejected: res.rejected }
}
export async function createTravelerGroupOnServer (api: CoreApi, projectId: string, name: string, key: string = newIdempotencyKey()): Promise<TravelerGroup> {
  return upsertServerGroup((await api.core.createTravelerGroup(projectId, { name }, key)).data)
}
export async function createRoomOnServer (api: CoreApi, projectId: string, input: { groupId: string; roomLabel: string; roomType: string; travelerIds?: string[] }, key: string = newIdempotencyKey()): Promise<RoomAssignment> {
  const room = upsertServerRoom((await api.core.createRoomAssignment(projectId, input, key)).data)
  await reloadProjectTravelers(api, projectId)
  return room
}
export async function setRoomTravelersOnServer (api: CoreApi, id: string, travelerIds: string[]): Promise<RoomAssignment> {
  const room = upsertServerRoom((await api.core.setRoomTravelers(id, travelerIds)).data)
  await reloadProjectTravelers(api, room.projectId) // other rooms of the project may have lost a traveler
  return room
}
export async function deleteRoomOnServer (api: CoreApi, id: string): Promise<void> {
  await api.core.deleteRoomAssignment(id)
  const index = ROOM_ASSIGNMENTS.findIndex(x => x.id === id)
  if (index !== -1) { ROOM_ASSIGNMENTS.splice(index, 1) }
}

export interface TravelersSyncState {
  status: 'idle' | 'loading' | 'ready' | 'offline' | 'error'
  userId: string | null
  message: string | null
}

/** Loads participants once per signed-in user (dashboard layout, "Reset Demo Data"). */
export function useTravelersSync () {
  const api = useApi()
  const session = useServerSession()
  const { currentUser } = useCurrentUser()
  const state = useState<TravelersSyncState>('manova-travelers-sync', () => ({ status: 'idle', userId: null, message: null }))

  async function load (force = false) {
    const userId = currentUser.value.id
    if (!force && state.value.userId === userId && (state.value.status === 'ready' || state.value.status === 'loading')) { return }
    state.value = { status: 'loading', userId, message: null }
    try {
      await session.ensure()
      await loadServerTravelers(api)
      state.value = { status: 'ready', userId, message: null }
    } catch (error) {
      const offline = isApiError(error) && (error.status === 0 || error.status >= 500)
      state.value = { status: offline ? 'offline' : 'error', userId, message: isApiError(error) ? error.message : 'Peserta belum bisa dimuat dari server.' }
    }
  }

  return { state, load }
}
