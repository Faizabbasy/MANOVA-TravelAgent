import { SYSTEM_EVENTS } from './activity'
import { SESSION_LOGS } from './session-logs'
import type { SystemEvent, SystemEventModule } from '~/types/activity'
import type { SessionLog } from '~/types/user'
import type { SessionLogDto, SystemEventDto } from '~/types/api'
import type { ManovaApi } from '~/lib/api/endpoints'

/**
 * Server audit trail → Activity Center (`SYSTEM_EVENTS`) and Session Log (`SESSION_LOGS`), S10a. Server rows
 * (`AUD-…`) are replaced on every load; events the still-local editors write (RBAC, master data, organization:
 * `EVT-…`) stay. The session log is the server's list of sign-ins.
 */

type CoreApi = Pick<ManovaApi, 'core'>

export function mergeServerSystemEvents (list: SystemEventDto[]): void {
  for (let i = SYSTEM_EVENTS.length - 1; i >= 0; i--) {
    if (SYSTEM_EVENTS[i]!.id.startsWith('AUD-')) { SYSTEM_EVENTS.splice(i, 1) }
  }
  for (const d of list) {
    const event: SystemEvent = {
      id: d.id,
      module: d.module as SystemEventModule,
      type: d.type,
      message: d.message,
      entityId: d.entityId ?? undefined,
      userId: d.userId ?? undefined,
      createdAt: d.createdAt
    }
    SYSTEM_EVENTS.push(event)
  }
}

export function mergeServerSessions (list: SessionLogDto[]): void {
  const rows: SessionLog[] = list.map(d => ({
    id: d.id,
    userId: d.userId,
    loginAt: d.loginAt,
    logoutAt: d.logoutAt ?? undefined,
    ipAddress: d.ipAddress,
    device: d.device,
    status: d.status
  }))
  SESSION_LOGS.splice(0, SESSION_LOGS.length, ...rows)
}

/** Activity Center & Session Log (needs `admin.view-activity-center`); a refusal leaves the local demo data. */
export async function loadServerAudit (api: CoreApi): Promise<void> {
  const [events, sessions] = await Promise.all([api.core.listAuditEvents(), api.core.listAuditSessions()])
  mergeServerSystemEvents(events.data)
  mergeServerSessions(sessions.data)
}
