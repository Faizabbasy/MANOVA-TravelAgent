import { reactive } from 'vue'
import type { SessionLog } from '~/types/user'

/**
 * Log Session (Administration, dekat Audit & Activity) — audit trail login/logout user. Terpisah dari
 * `ACTIVITIES`/`SYSTEM_EVENTS` (`app/data/activity.ts`) karena ini murni catatan akses sesi (kapan login,
 * kapan logout, dari IP/device mana), bukan aktivitas bisnis lintas-modul.
 */
const sessionLogSeed: SessionLog[] = [
  { id: 'SES-001', userId: 'USR-001', loginAt: '2026-09-01T08:02:00+07:00', logoutAt: '2026-09-01T17:14:00+07:00', ipAddress: '103.10.24.11', device: 'Chrome · Windows 11', status: 'ended' },
  { id: 'SES-002', userId: 'USR-002', loginAt: '2026-09-01T08:15:00+07:00', logoutAt: '2026-09-01T16:45:00+07:00', ipAddress: '103.10.24.15', device: 'Chrome · macOS', status: 'ended' },
  { id: 'SES-003', userId: 'USR-003', loginAt: '2026-09-01T09:00:00+07:00', logoutAt: '2026-09-01T18:30:00+07:00', ipAddress: '182.253.4.201', device: 'Safari · macOS', status: 'ended' },
  { id: 'SES-004', userId: 'USR-008', loginAt: '2026-09-02T07:55:00+07:00', ipAddress: '103.10.24.20', device: 'Edge · Windows 11', status: 'active' },
  { id: 'SES-005', userId: 'USR-010', loginAt: '2026-09-02T07:30:00+07:00', ipAddress: '36.75.10.5', device: 'Chrome · Windows 11', status: 'active' },
  { id: 'SES-006', userId: 'USR-015', loginAt: '2026-08-31T10:12:00+07:00', logoutAt: '2026-08-31T14:05:00+07:00', ipAddress: '114.5.98.33', device: 'Chrome · Android', status: 'ended' },
  { id: 'SES-007', userId: 'USR-021', loginAt: '2026-09-01T13:20:00+07:00', logoutAt: '2026-09-01T13:55:00+07:00', ipAddress: '180.244.11.90', device: 'Safari · iOS', status: 'ended' },
  { id: 'SES-008', userId: 'USR-001', loginAt: '2026-09-02T08:05:00+07:00', ipAddress: '103.10.24.11', device: 'Chrome · Windows 11', status: 'active' }
]

export const SESSION_LOGS: SessionLog[] = reactive(sessionLogSeed)

export function getSessionLogs (): SessionLog[] {
  return [...SESSION_LOGS].sort((a, b) => b.loginAt.localeCompare(a.loginAt))
}

export function createSessionLog (input: Omit<SessionLog, 'id'>): SessionLog {
  const id = `SES-${String(SESSION_LOGS.length + 1).padStart(3, '0')}`
  const log: SessionLog = { id, ...input }
  SESSION_LOGS.push(log)
  return log
}

export function endSessionLog (id: string, logoutAt: string): void {
  const log = SESSION_LOGS.find(entry => entry.id === id)
  if (log) {
    log.logoutAt = logoutAt
    log.status = 'ended'
  }
}

/** Durasi sesi dalam menit — `null` bila masih aktif (belum logout). */
export function getSessionDurationMinutes (log: SessionLog): number | null {
  if (!log.logoutAt) { return null }
  const start = new Date(log.loginAt).getTime()
  const end = new Date(log.logoutAt).getTime()
  return Math.max(0, Math.round((end - start) / 60000))
}
