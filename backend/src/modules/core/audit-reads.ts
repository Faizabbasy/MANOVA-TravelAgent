import type { Queryable } from '../../db/client'

/**
 * Read models over the append-only audit trail (S10a): the Activity Center's system events and the session log.
 * Nothing here writes; the trail itself is written by `recordAudit` inside each action.
 */

const str = (v: unknown) => (v === null || v === undefined ? null : String(v))
const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : str(v))

/** Activity Center module from the action's first segment. */
const MODULES: [RegExp, string][] = [
  [/^(lead|lead_activity)\b/, 'lead'],
  [/^(quotation|sales_quotation)\b/, 'quotation'],
  [/^(party|contact)\b/, 'client'],
  [/^(vendor|vendor_quotation|service_order)\b/, 'vendor'],
  [/^(auth|user)\b/, 'user'],
  [/^(project|booking|service|task|milestone|traveler|itinerary|incident|change_request|project_change|document|message|sales_order)\b/, 'project-order'],
  [/^(finance|invoice|customer_invoice|vendor_invoice|receipt|payment|refund|credit_note|debit_note|account|period|bank|cash|transfer)/, 'finance']
]
export const moduleOf = (action: string) => MODULES.find(([re]) => re.test(action))?.[1] ?? 'administration'

const LABEL: Record<string, string> = {
  'auth.login': 'Masuk', 'auth.demo_login': 'Masuk (demo)', 'auth.logout': 'Keluar', 'auth.login_failed': 'Gagal masuk',
  'user.suspended': 'User dinonaktifkan', 'user.reactivated': 'User diaktifkan kembali', 'user.role_changed': 'Role user diubah',
  'master_data.created': 'Master data ditambahkan', 'master_data.updated': 'Master data diperbarui',
  'master_data.deactivated': 'Master data dinonaktifkan', 'master_data.reactivated': 'Master data diaktifkan kembali',
  'organization.updated': 'Profil organisasi diperbarui'
}

/** `withFinance` false (no Finance access, e.g. Admin) leaves out Finance actions and the reasons Finance wrote. */
export async function listSystemEvents(db: Queryable, withFinance: boolean, limit = 200) {
  const rows = await db.query<Record<string, unknown>>(
    `select a.id, a.occurred_at, a.actor_user_id, a.action, a.entity_type, a.entity_id, a.reason, u.name as actor_name
       from audit_events a left join users u on u.id = a.actor_user_id
      where ($2::boolean or a.action !~ $3)
      order by a.occurred_at desc, a.id desc limit $1`, [limit, withFinance, MODULES.find(([, m]) => m === 'finance')![0].source])
  return rows.map(r => {
    const action = r.action as string
    const label = LABEL[action] ?? action.replace(/[._]/g, ' ')
    const target = r.entity_id ? ` ${r.entity_type ?? ''} ${r.entity_id}`.replace(/\s+/g, ' ') : ''
    const who = r.actor_name ? ` oleh ${r.actor_name}` : ''
    return {
      id: `AUD-${r.id}`,
      module: moduleOf(action),
      type: action,
      message: `${label}${target}${who}${r.reason ? ` — ${r.reason}` : ''}`.trim(),
      entityId: str(r.entity_id),
      userId: str(r.actor_user_id),
      createdAt: iso(r.occurred_at)!
    }
  })
}

/** Each sign-in paired with the same user's next sign-out (an open one is still active or expired without logout). */
export async function listSessions(db: Queryable, limit = 200) {
  const rows = await db.query<Record<string, unknown>>(
    `select a.id, a.actor_user_id, a.occurred_at, a.ip, a.user_agent,
            (select min(o.occurred_at) from audit_events o
              where o.action = 'auth.logout' and o.actor_user_id = a.actor_user_id and o.occurred_at >= a.occurred_at
                and not exists (select 1 from audit_events n where n.action in ('auth.login', 'auth.demo_login')
                                  and n.actor_user_id = a.actor_user_id and n.occurred_at > a.occurred_at and n.occurred_at <= o.occurred_at)) as logout_at
       from audit_events a
      where a.action in ('auth.login', 'auth.demo_login') and a.actor_user_id is not null
      order by a.occurred_at desc, a.id desc limit $1`, [limit])
  return rows.map(r => ({
    id: `SES-${r.id}`,
    userId: r.actor_user_id as string,
    loginAt: iso(r.occurred_at)!,
    logoutAt: iso(r.logout_at),
    ipAddress: str(r.ip) ?? '—',
    device: str(r.user_agent) ?? '—',
    status: r.logout_at ? 'ended' : 'active'
  }))
}
