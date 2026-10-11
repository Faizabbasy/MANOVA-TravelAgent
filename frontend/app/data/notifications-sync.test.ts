import { describe, expect, it } from 'vitest'
import { NOTIFICATION_RECORDS } from './document-comms'
import { markNotificationReadOnServer, mergeServerNotifications, notificationFromServer, removeNotificationOnServer } from './notifications-sync'
import type { NotificationDto } from '~/types/api'

const dto = (over: Partial<NotificationDto> = {}): NotificationDto => ({
  id: 'NOT-001',
  userId: 'USR-002',
  type: 'mention',
  title: 'Anda disebut',
  body: 'Cek rooming',
  entityType: 'project',
  entityId: 'PRJ-103',
  category: null,
  read: false,
  createdAt: '2026-07-20T02:00:00.000Z',
  ...over
})

describe('notifications-sync', () => {
  it('maps the server notification to the local shape', () => {
    expect(notificationFromServer(dto())).toMatchObject({ id: 'NOT-001', userId: 'USR-002', read: false, entityType: 'project' })
    expect(notificationFromServer(dto({ category: null })).category).toBeUndefined()
  })

  it('merge keeps identity, drops server-gone rows and keeps the client portal rows written locally (NOT-L)', () => {
    const before = NOTIFICATION_RECORDS.find(x => x.id === 'NOT-001')!
    NOTIFICATION_RECORDS.push({ ...before, id: 'NOT-L001' })
    mergeServerNotifications([dto({ title: 'Dari server' })])
    expect(NOTIFICATION_RECORDS.map(x => x.id).sort()).toEqual(['NOT-001', 'NOT-L001'])
    expect(NOTIFICATION_RECORDS.find(x => x.id === 'NOT-001')).toBe(before)
    expect(before.title).toBe('Dari server')
  })

  it('read and remove go to the server first; a refused call leaves the local row as it was', async () => {
    mergeServerNotifications([dto(), dto({ id: 'NOT-002' })])
    const ok = { core: { markNotificationRead: (id: string) => Promise.resolve({ data: dto({ id, read: true }) }), removeNotification: (id: string) => Promise.resolve({ data: { id, deleted: true } }) } } as never
    await markNotificationReadOnServer(ok, 'NOT-001')
    expect(NOTIFICATION_RECORDS.find(x => x.id === 'NOT-001')!.read).toBe(true)
    const refused = { core: { removeNotification: () => Promise.reject(new Error('404')) } } as never
    await expect(removeNotificationOnServer(refused, 'NOT-002')).rejects.toThrow()
    expect(NOTIFICATION_RECORDS.some(x => x.id === 'NOT-002')).toBe(true)
    await removeNotificationOnServer(ok, 'NOT-002')
    expect(NOTIFICATION_RECORDS.some(x => x.id === 'NOT-002')).toBe(false)
  })
})
