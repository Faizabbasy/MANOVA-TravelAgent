import { describe, expect, it } from 'vitest'
import { USERS } from './users'
import { SYSTEM_EVENTS } from './activity'
import { SESSION_LOGS } from './session-logs'
import { canSwitchTo, mergeServerUsers, suspendUserOnServer, userFromServer } from './users-sync'
import { mergeServerSessions, mergeServerSystemEvents } from './audit-sync'
import type { UserDto } from '~/types/api'

const user = (over: Partial<UserDto> = {}): UserDto => ({
  id: 'USR-001',
  name: 'Rani Kusuma',
  email: 'rani.kusuma@manova.id',
  role: 'admin',
  status: 'active',
  suspendedReason: null,
  suspendedAt: null,
  clientPartyId: null,
  vendorId: null,
  ...over
})

describe('users-sync', () => {
  it('maps the server user to the local shape', () => {
    expect(userFromServer(user({ status: 'suspended', suspendedReason: 'Cuti', suspendedAt: '2026-10-12T01:00:00.000Z' }))).toMatchObject({ status: 'suspended', suspendedReason: 'Cuti' })
    expect(userFromServer(user()).suspendedReason).toBeUndefined()
  })

  it('merge updates users in place and leaves users that only exist locally', () => {
    const before = USERS.find(u => u.id === 'USR-001')!
    const localOnly = { ...before, id: 'USR-900', name: 'Lokal' }
    USERS.push(localOnly)
    mergeServerUsers([user({ name: 'Rani (server)' })])
    expect(USERS.find(u => u.id === 'USR-001')).toBe(before)
    expect(before.name).toBe('Rani (server)')
    expect(USERS.some(u => u.id === 'USR-900')).toBe(true)
  })

  it('a refused suspension leaves the local user active', async () => {
    mergeServerUsers([user()])
    const api = { core: { suspendUser: () => Promise.reject(new Error('403')) } } as never
    await expect(suspendUserOnServer(api, 'USR-001', 'Cuti')).rejects.toThrow()
    expect(USERS.find(u => u.id === 'USR-001')!.status).toBe('active')
  })
})

describe('audit-sync', () => {
  it('server events replace earlier server events and keep the local ones', () => {
    const local = SYSTEM_EVENTS.length
    mergeServerSystemEvents([{ id: 'AUD-1', module: 'user', type: 'auth.login', message: 'Masuk', entityId: null, userId: 'USR-002', createdAt: '2026-10-12T01:00:00.000Z' }])
    mergeServerSystemEvents([{ id: 'AUD-2', module: 'user', type: 'auth.logout', message: 'Keluar', entityId: null, userId: 'USR-002', createdAt: '2026-10-12T02:00:00.000Z' }])
    expect(SYSTEM_EVENTS.filter(e => e.id.startsWith('AUD-')).map(e => e.id)).toEqual(['AUD-2'])
    expect(SYSTEM_EVENTS.length).toBe(local + 1)
  })

  it('the session log is the server list', () => {
    mergeServerSessions([{ id: 'SES-9', userId: 'USR-002', loginAt: '2026-10-12T01:00:00.000Z', logoutAt: null, ipAddress: '127.0.0.1', device: 'Bun', status: 'active' }])
    expect(SESSION_LOGS.map(s => s.id)).toEqual(['SES-9'])
    expect(SESSION_LOGS[0]!.logoutAt).toBeUndefined()
  })
})

describe('role switcher', () => {
  it('cannot switch to a suspended user or a hidden portal role', () => {
    expect(canSwitchTo(userFromServer(user()))).toBe(true)
    expect(canSwitchTo(userFromServer(user({ status: 'suspended', suspendedReason: 'Cuti' })))).toBe(false)
    expect(canSwitchTo(userFromServer(user({ role: 'client' })))).toBe(false)
    expect(canSwitchTo(undefined)).toBe(false)
  })
})
