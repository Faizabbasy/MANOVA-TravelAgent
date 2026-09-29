import type { AppEnv } from '../config/env'
import { backupDatabase, isDatabaseEmpty, restoreDatabase } from './backup'
import { openDb, type Db } from './client'
import { loadMigrations, migrateDown, migrateUp, migrationStatus } from './migrator'
import { seedDemo } from './seed-demo'
import { seedFinanceDemo } from './seed-finance-demo'

/**
 * Migration + backup/restore rehearsal on scratch databases (docs/.../03 "Migrasi aman" step 6):
 * fresh → up → seed → down to zero → up again → seed → finance demo → backup → restore elsewhere → compare.
 * The finance comparison is a money fingerprint (row counts, cash per account, AR/AP paid, unallocated money)
 * plus a check that the cash book is still immutable after restore (triggers travel with the dump).
 * Throws on the first mismatch; returns a step log for the phase report.
 */

const TABLES = ['parties', 'vendors', 'projects', 'project_services', 'booking_refs', 'service_orders', 'users', 'project_members', 'audit_events'] as const

async function tableCounts(db: Db): Promise<Record<string, number>> {
  const out: Record<string, number> = {}
  for (const table of TABLES) {
    const [row] = await db.query<{ n: number }>(`select count(*)::int as n from ${table}`)
    out[table] = row?.n ?? -1
  }
  return out
}

async function userTableCount(db: Db): Promise<number> {
  const [row] = await db.query<{ n: number }>(
    `select count(*)::int as n from information_schema.tables where table_schema = current_schema() and table_name <> 'schema_migrations'`
  )
  return row?.n ?? -1
}

const FINANCE_TABLES = [
  'bank_accounts', 'financial_transactions', 'transfers', 'transfer_fee_rules', 'customer_invoices', 'customer_invoice_lines',
  'vendor_invoices', 'payment_allocations', 'credit_notes', 'billing_schedule_items', 'cancellation_policies',
  'cancellation_policy_tiers', 'cancellation_policy_assignments', 'refunds'
] as const

/** Everything a restore must reproduce exactly: counts and money, as strings (minor units). */
async function financeFingerprint(db: Db): Promise<Record<string, string>> {
  const out: Record<string, string> = {}
  for (const table of FINANCE_TABLES) {
    const [row] = await db.query<{ n: string }>(`select count(*)::text as n from ${table}`)
    out[table] = row?.n ?? '-1'
  }
  const cash = await db.query<{ code: string; balance: string | null }>(
    `select a.code, (a.opening_balance_minor + coalesce((select sum(case when t.direction = 'in' then t.amount_minor else -t.amount_minor end)
        from financial_transactions t where t.bank_account_id = a.id), 0))::text as balance
       from bank_accounts a order by a.code`
  )
  for (const a of cash) out[`cash:${a.code}`] = a.balance ?? 'unset'
  const [money] = await db.query<Record<string, string>>(
    `select (select coalesce(sum(paid_minor), 0) from v_customer_invoice_balances)::text as ar_paid,
            (select coalesce(sum(credited_minor), 0) from v_customer_invoice_balances)::text as ar_credited,
            (select coalesce(sum(paid_minor), 0) from v_vendor_invoice_balances)::text as ap_paid,
            (select coalesce(sum(unallocated_minor), 0) from v_unallocated_payments)::text as unallocated,
            (select coalesce(sum(amount_minor), 0) from financial_transactions)::text as moved`
  )
  return { ...out, ...money }
}

const same = (a: Record<string, number | string>, b: Record<string, number | string>) => JSON.stringify(a) === JSON.stringify(b)

export async function rehearseMigrations(options: {
  appEnv: AppEnv
  sourceUrl: string
  restoreUrl: string
  backupDir: string
  log?: (line: string) => void
}): Promise<string[]> {
  if (options.appEnv === 'production') throw new Error('Rehearsal is destructive and never runs with APP_ENV=production')
  const steps: string[] = []
  const log = (line: string) => { steps.push(line); options.log?.(line) }
  const total = loadMigrations().length

  const db = await openDb(options.sourceUrl)
  try {
    if (!(await isDatabaseEmpty(db))) throw new Error('Rehearsal source must be an empty scratch database')

    const up1 = await migrateUp(db)
    log(`fresh migrate up: applied ${up1.map(m => m.version).join(', ')} (${up1.length}/${total})`)
    await seedDemo(db, { appEnv: options.appEnv })
    const seeded = await tableCounts(db)
    log(`demo seed: ${JSON.stringify(seeded)}`)

    const down = await migrateDown(db, { to: 0 })
    const left = await userTableCount(db)
    if (left !== 0) throw new Error(`After full rollback ${left} table(s) remain`)
    log(`rollback to 0: reverted ${down.map(m => m.version).join(', ')}; 0 domain tables remain`)

    const up2 = await migrateUp(db)
    await seedDemo(db, { appEnv: options.appEnv })
    const reseeded = await tableCounts(db)
    if (!same(seeded, reseeded)) throw new Error(`Re-applied schema + seed differs: ${JSON.stringify(reseeded)}`)
    log(`re-apply ${up2.length} migration(s) + seed: counts identical`)

    await seedFinanceDemo(db, { appEnv: options.appEnv })
    const money = await financeFingerprint(db)
    const beforeBackup = await tableCounts(db) // the finance seed adds audit rows
    if (Number(money.financial_transactions) === 0) throw new Error('Finance demo seed posted no transactions')
    log(`finance demo: ${money.financial_transactions} transactions, ${money.customer_invoices} customer + ${money.vendor_invoices} vendor invoices, ${money.refunds} refund(s)`)

    const backup = await backupDatabase(db, options.sourceUrl, options.backupDir)
    log(`backup: ${backup.file} (${backup.bytes} bytes, sha256 ${backup.sha256.slice(0, 16)}…)`)

    const restored = await restoreDatabase(backup.file, options.restoreUrl)
    try {
      const restoredCounts = await tableCounts(restored)
      if (!same(beforeBackup, restoredCounts)) throw new Error(`Restored counts differ: ${JSON.stringify(restoredCounts)}`)
      const restoredMoney = await financeFingerprint(restored)
      if (!same(money, restoredMoney)) throw new Error(`Restored finance differs: ${JSON.stringify(restoredMoney)} vs ${JSON.stringify(money)}`)
      let immutable = false
      try { await restored.query("update financial_transactions set memo = 'x'") } catch { immutable = true }
      if (!immutable) throw new Error('Restored cash book accepted an UPDATE (immutability trigger missing)')
      const status = await migrationStatus(restored, undefined, { readOnly: true })
      if (status.current !== total || status.pending.length || status.problems.length) {
        throw new Error(`Restored schema not current: v${status.current}, pending ${status.pending.length}, problems ${status.problems.join('; ')}`)
      }
      log(`restore into fresh target: counts identical, finance fingerprint identical (${Object.keys(money).length} figures), cash book immutable, schema v${status.current}, checksums verified`)
    } finally {
      await restored.close()
    }
  } finally {
    await db.close()
  }
  return steps
}
