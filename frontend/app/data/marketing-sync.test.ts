import { describe, expect, it } from 'vitest'
import { CONTENT_DEVELOPMENT, CONTENT_SCHEDULE } from './marketing'
import {
  createContentIdeaOnServer, createContentScheduleOnServer, mergeServerContent, updateContentIdeaOnServer, updateContentScheduleOnServer
} from './marketing-sync'
import type { ContentIdeaDto, ContentScheduleDto } from '~/types/api'

const schedule = (over: Partial<ContentScheduleDto> = {}): ContentScheduleDto => ({
  id: 'CTS-001', publishDate: '2026-09-03', platform: 'instagram', title: 'Teaser', status: 'published', campaignId: 'CMP-001', note: null, ...over
})
const idea = (over: Partial<ContentIdeaDto> = {}): ContentIdeaDto => ({
  id: 'CTD-001', title: 'Video promo', stage: 'idea', platform: 'tiktok', ownerId: 'USR-001', note: null, updatedOn: '2026-08-20', ...over
})

describe('marketing-sync', () => {
  it('the server lists replace the local ones in place; updatedOn becomes updatedAt', () => {
    const first = CONTENT_SCHEDULE.find(x => x.id === 'CTS-001')!
    mergeServerContent({ schedule: [schedule({ title: 'Server' }), schedule({ id: 'CTS-010', campaignId: null })], ideas: [idea({ ownerId: null })] })
    expect(CONTENT_SCHEDULE.map(x => x.id)).toEqual(['CTS-001', 'CTS-010'])
    expect(CONTENT_SCHEDULE[0]).toBe(first)
    expect(first.title).toBe('Server')
    expect(CONTENT_SCHEDULE[1]).not.toHaveProperty('campaignId')
    expect(CONTENT_DEVELOPMENT).toEqual([{ id: 'CTD-001', title: 'Video promo', stage: 'idea', platform: 'tiktok', updatedAt: '2026-08-20' }])
  })

  it('a refused change leaves the local data as it was', async () => {
    mergeServerContent({ schedule: [schedule({ status: 'scheduled' })], ideas: [idea()] })
    const api = {
      core: {
        updateContentSchedule: () => Promise.reject(new Error('403')),
        updateContentIdea: () => Promise.reject(new Error('403')),
        createContentSchedule: () => Promise.reject(new Error('400')),
        createContentIdea: () => Promise.reject(new Error('400'))
      }
    } as never
    await expect(updateContentScheduleOnServer(api, 'CTS-001', { status: 'published' })).rejects.toThrow()
    await expect(updateContentIdeaOnServer(api, 'CTD-001', { stage: 'ready' })).rejects.toThrow()
    await expect(createContentScheduleOnServer(api, { publishDate: '2026-11-01', platform: 'email', title: 'X', status: 'draft' })).rejects.toThrow()
    await expect(createContentIdeaOnServer(api, { title: 'X', stage: 'idea', platform: 'email' })).rejects.toThrow()
    expect(CONTENT_SCHEDULE.map(x => [x.id, x.status])).toEqual([['CTS-001', 'scheduled']])
    expect(CONTENT_DEVELOPMENT.map(x => [x.id, x.stage])).toEqual([['CTD-001', 'idea']])
  })

  it('accepted changes take the server answer', async () => {
    mergeServerContent({ schedule: [], ideas: [idea()] })
    const api = {
      core: {
        createContentSchedule: () => Promise.resolve({ data: schedule({ id: 'CTS-020', status: 'draft' }) }),
        updateContentIdea: () => Promise.resolve({ data: idea({ stage: 'review', updatedOn: '2026-10-13' }) })
      }
    } as never
    await createContentScheduleOnServer(api, { publishDate: '2026-09-03', platform: 'instagram', title: 'Teaser', status: 'draft' })
    await updateContentIdeaOnServer(api, 'CTD-001', { stage: 'review' })
    expect(CONTENT_SCHEDULE.map(x => x.id)).toEqual(['CTS-020'])
    expect(CONTENT_DEVELOPMENT[0]).toMatchObject({ stage: 'review', updatedAt: '2026-10-13' })
  })
})
