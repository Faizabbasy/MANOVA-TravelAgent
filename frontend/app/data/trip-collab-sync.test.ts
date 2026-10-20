import { describe, expect, it } from 'vitest'
import { ITINERARY_VERSIONS } from './itinerary-versions'
import { TRIP_ANNOUNCEMENTS } from './trip-center'
import { announcementFromServer, clientConfirmAnnouncementOnServer, clientDecideItineraryVersionOnServer, mergeClientTrip, versionFromServer } from './trip-collab-sync'
import type { ManovaApi } from '~/lib/api/endpoints'
import type { ItineraryVersionDto, TripAnnouncementDto } from '~/types/api'

const ok = <T>(data: T) => Promise.resolve({ data })
const apiWith = (core: Record<string, unknown>) => ({ core } as unknown as Pick<ManovaApi, 'core'>)

const version = (over: Partial<ItineraryVersionDto> = {}): ItineraryVersionDto => ({
  id: 'ITV-900',
  projectId: 'PRJ-201',
  projectName: 'Korea',
  versionNumber: 3,
  status: 'waiting-approval',
  items: [{ id: 'ITIN-9', date: '2026-10-13', time: null, title: 'City tour', description: null, serviceType: 'additional', timezone: 'Asia/Seoul', location: null }],
  note: 'Revisi hari 2',
  revisionComment: null,
  createdBy: null,
  createdByName: 'Doni',
  createdAt: '2026-10-19T00:00:00.000Z',
  decidedBy: null,
  decidedByName: null,
  decidedAt: null,
  ...over
})
const announcement = (over: Partial<TripAnnouncementDto> = {}): TripAnnouncementDto => ({
  id: 'ANN-900',
  projectId: 'PRJ-201',
  projectName: 'Korea',
  title: 'Titik kumpul',
  message: 'Lobby',
  requiresConfirmation: true,
  publishedBy: null,
  publishedByName: 'Doni',
  publishedAt: '2026-10-19T00:00:00.000Z',
  confirmations: [{ userId: 'USR-021', name: 'Dimas', confirmedAt: '2026-10-19T01:00:00.000Z' }],
  confirmedByMe: true,
  ...over
})

describe('itinerary versions & trip announcements sync (S12c-4)', () => {
  it('maps a version snapshot to local items (nulls dropped, project id added)', () => {
    const v = versionFromServer(version())
    expect(v).toMatchObject({ id: 'ITV-900', projectId: 'PRJ-201', versionNumber: 3, status: 'waiting-approval', note: 'Revisi hari 2' })
    expect(v.items[0]).toEqual({ id: 'ITIN-9', projectId: 'PRJ-201', date: '2026-10-13', title: 'City tour', serviceType: 'additional', timezone: 'Asia/Seoul' })
  })

  it('maps an announcement with who confirmed', () => {
    expect(announcementFromServer(announcement())).toMatchObject({ id: 'ANN-900', requiresConfirmation: true, confirmedByUserIds: ['USR-021'] })
  })

  it('the listed projects’ versions and announcements become the server’s', () => {
    mergeClientTrip(['PRJ-201'], [version()], [announcement()])
    expect(ITINERARY_VERSIONS.filter(v => v.projectId === 'PRJ-201').map(v => v.id)).toEqual(['ITV-900'])
    expect(TRIP_ANNOUNCEMENTS.filter(a => a.projectId === 'PRJ-201').map(a => a.id)).toEqual(['ANN-900'])
    expect(ITINERARY_VERSIONS.some(v => v.projectId === 'PRJ-202')).toBe(true)
  })

  it('a decision or confirmation changes the lists only with the server’s answer', async () => {
    mergeClientTrip(['PRJ-201'], [version()], [announcement({ confirmations: [], confirmedByMe: false })])
    await expect(clientDecideItineraryVersionOnServer(apiWith({ clientDecideItineraryVersion: () => Promise.reject(new Error('422')) }), 'ITV-900', 'approve')).rejects.toThrow()
    expect(ITINERARY_VERSIONS.find(v => v.id === 'ITV-900')?.status).toBe('waiting-approval')
    await clientDecideItineraryVersionOnServer(apiWith({ clientDecideItineraryVersion: () => ok(version({ status: 'revision-requested', revisionComment: 'Tambah free time' })) }), 'ITV-900', 'request-revision', 'Tambah free time')
    expect(ITINERARY_VERSIONS.find(v => v.id === 'ITV-900')).toMatchObject({ status: 'revision-requested', revisionComment: 'Tambah free time' })
    await clientConfirmAnnouncementOnServer(apiWith({ clientConfirmAnnouncement: () => ok(announcement()) }), 'ANN-900')
    expect(TRIP_ANNOUNCEMENTS.find(a => a.id === 'ANN-900')?.confirmedByUserIds).toEqual(['USR-021'])
  })
})
