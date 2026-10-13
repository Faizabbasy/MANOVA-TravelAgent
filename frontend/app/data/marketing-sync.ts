import { CONTENT_DEVELOPMENT, CONTENT_SCHEDULE } from './marketing'
import type { ContentDevelopmentItem, ContentScheduleItem } from '~/types/marketing'
import type { ContentIdeaDto, ContentIdeaInput, ContentScheduleDto, ContentScheduleInput } from '~/types/api'
import type { ManovaApi } from '~/lib/api/endpoints'
import { isApiError } from '~/lib/api/errors'

/**
 * Server → `CONTENT_SCHEDULE` and `CONTENT_DEVELOPMENT` (S11b). The server is the source: each list becomes the
 * server's (same objects kept), and every change goes to the server first — a refused save leaves the local data as it
 * was. Admin and Super Admin write (`marketing.manage-content`); internal roles read.
 */

type CoreApi = Pick<ManovaApi, 'core'>
const opt = <T>(v: T | null | undefined): T | undefined => (v === null ? undefined : v)
const clean = <T extends object>(o: T): T => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T

export const scheduleFromServer = (d: ContentScheduleDto): ContentScheduleItem => clean({
  id: d.id,
  publishDate: d.publishDate,
  platform: d.platform,
  title: d.title,
  status: d.status,
  campaignId: opt(d.campaignId),
  note: opt(d.note)
})

export const ideaFromServer = (d: ContentIdeaDto): ContentDevelopmentItem => clean({
  id: d.id,
  title: d.title,
  stage: d.stage,
  platform: d.platform,
  ownerId: opt(d.ownerId),
  updatedAt: d.updatedOn,
  note: opt(d.note)
})

function overwrite<T extends { id: string }> (target: T, value: T): T {
  for (const key of Object.keys(target)) { if (!(key in value)) { delete (target as Record<string, unknown>)[key] } }
  return Object.assign(target, value)
}
function replaceList<T extends { id: string }> (list: T[], rows: T[]): void {
  const next = rows.map((row) => {
    const local = list.find(item => item.id === row.id)
    return local ? overwrite(local, row) : row
  })
  list.splice(0, list.length, ...next)
}
function upsert<T extends { id: string }> (list: T[], value: T): T {
  const local = list.find(item => item.id === value.id)
  if (local) { return overwrite(local, value) }
  list.push(value)
  return list[list.length - 1]!
}

export function mergeServerContent (data: { schedule: ContentScheduleDto[]; ideas: ContentIdeaDto[] }): void {
  replaceList(CONTENT_SCHEDULE, data.schedule.map(scheduleFromServer))
  replaceList(CONTENT_DEVELOPMENT, data.ideas.map(ideaFromServer))
}

export async function loadServerContent (api: CoreApi): Promise<void> {
  const [schedule, ideas] = await Promise.all([api.core.listContentSchedule(), api.core.listContentIdeas()])
  mergeServerContent({ schedule: schedule.data, ideas: ideas.data })
}

export async function createContentScheduleOnServer (api: CoreApi, input: ContentScheduleInput): Promise<ContentScheduleItem> {
  return upsert(CONTENT_SCHEDULE, scheduleFromServer((await api.core.createContentSchedule(input)).data))
}
export async function updateContentScheduleOnServer (api: CoreApi, id: string, input: ContentScheduleInput): Promise<ContentScheduleItem> {
  return upsert(CONTENT_SCHEDULE, scheduleFromServer((await api.core.updateContentSchedule(id, input)).data))
}
export async function createContentIdeaOnServer (api: CoreApi, input: ContentIdeaInput): Promise<ContentDevelopmentItem> {
  return upsert(CONTENT_DEVELOPMENT, ideaFromServer((await api.core.createContentIdea(input)).data))
}
export async function updateContentIdeaOnServer (api: CoreApi, id: string, input: ContentIdeaInput): Promise<ContentDevelopmentItem> {
  return upsert(CONTENT_DEVELOPMENT, ideaFromServer((await api.core.updateContentIdea(id, input)).data))
}

export interface MarketingSyncState {
  status: 'idle' | 'loading' | 'ready' | 'offline' | 'error'
  userId: string | null
  message: string | null
}

/** Loads marketing content once per signed-in user (dashboard layout, "Reset Demo Data"). */
export function useMarketingSync () {
  const api = useApi()
  const session = useServerSession()
  const { currentUser } = useCurrentUser()
  const state = useState<MarketingSyncState>('manova-marketing-sync', () => ({ status: 'idle', userId: null, message: null }))

  async function load (force = false) {
    const userId = currentUser.value.id
    if (!force && state.value.userId === userId && (state.value.status === 'ready' || state.value.status === 'loading')) { return }
    state.value = { status: 'loading', userId, message: null }
    try {
      await session.ensure()
      await loadServerContent(api)
      state.value = { status: 'ready', userId, message: null }
    } catch (error) {
      const offline = isApiError(error) && (error.status === 0 || error.status >= 500)
      state.value = { status: offline ? 'offline' : 'error', userId, message: isApiError(error) ? error.message : 'Konten marketing belum bisa dimuat dari server.' }
    }
  }

  return { state, load }
}
