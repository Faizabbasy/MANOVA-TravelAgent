import { expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { createApp } from '../src/app'
import { backupDatabase, isDatabaseEmpty, restoreDatabase } from '../src/db/backup'
import { openDb, type Db } from '../src/db/client'
import { migrateUp } from '../src/db/migrator'
import { seedDemo } from '../src/db/seed-demo'
import { createBook, createPeriod } from '../src/modules/accounting/setup'
import { postBusinessEvent } from '../src/modules/accounting/posting'
import { testConfig } from './helpers'

/** Default is PGlite memory. Optional PostgreSQL restore is restricted to two explicitly named fresh scratch databases. */
const recoverySource = process.env.ACCOUNTING_RECOVERY_SOURCE_URL
const recoveryTarget = process.env.ACCOUNTING_RECOVERY_TARGET_URL
test(`accounting DB restore preserves money, fingerprints, source retry, locks and authorization (${recoverySource ? 'PostgreSQL scratch' : 'PGlite'})`, async () => {
  if (recoverySource || recoveryTarget) {
    if (!recoverySource || !recoveryTarget || recoverySource === recoveryTarget) throw new Error('Recovery requires two distinct scratch databases')
    for (const [url, role] of [[recoverySource,'source'],[recoveryTarget,'target']] as const) {
      const parsed = new URL(url)
      if (parsed.protocol !== 'postgres:' || parsed.hostname !== '127.0.0.1' || parsed.port !== '55439'
        || !new RegExp(`^/accounting_recovery_${role}_[a-f0-9]{12}$`).test(parsed.pathname)) {
        throw new Error('Recovery URLs must name fresh accounting_recovery_source/target databases on loopback scratch port 55439')
      }
    }
  }
  const sourceUrl = recoverySource ?? 'pglite://memory', targetUrl = recoveryTarget ?? 'pglite://memory'
  const source = await openDb(sourceUrl)
  let restored: Db | undefined
  const config = testConfig({ demoLogin: true })
  const actor = { userId:'USR-010',role:'super-admin' as const,name:'TEST_ONLY',email:'test@example.invalid',sessionId:'TEST_ONLY',partyId:null,vendorId:null }
  function caller(db: Db) {
    const app = createApp({ db, config })
    return async (method: string, path: string, options: { body?: unknown; cookie?: string; key?: string } = {}) => {
      const response = await app.handle(new Request(`http://localhost/api/v1${path}`, { method,
        headers: { ...(options.cookie ? { cookie: options.cookie } : {}), ...(options.body ? { 'content-type':'application/json' } : {}), ...(options.key ? { 'idempotency-key':options.key } : {}) },
        ...(options.body ? { body: JSON.stringify(options.body) } : {}) }))
      return { status: response.status, headers: response.headers, json: await response.json() as any }
    }
  }
  // Only hashes/counts leave the DB snapshot helper; no sessions, password hashes or token values in assertion output.
  async function snapshot(db: Db) {
    const [cash] = await db.query(`select count(*) as count,coalesce(sum(case when direction='in' then amount_minor else -amount_minor end),0) as movement,
      md5(coalesce(string_agg(id || ':' || bank_account_id || ':' || direction || ':' || amount_minor::text || ':' || currency || ':' || effective_date::text || ':' || created_by,'|' order by id),'')) as fingerprint from financial_transactions`)
    const [journals] = await db.query(`select count(*) as count,coalesce(sum(l.debit_minor),0) as debit,coalesce(sum(l.credit_minor),0) as credit,
      md5(coalesce(string_agg(l.journal_id || ':' || l.line_no::text || ':' || l.account_code || ':' || l.debit_minor::text || ':' || l.credit_minor::text
        || ':' || coalesce(l.bank_account_id,'') || ':' || coalesce(l.project_id,'') || ':' || coalesce(l.party_id,'') || ':' || coalesce(l.vendor_id,'') || ':' || coalesce(l.employee_id,''),'|' order by l.journal_id,l.line_no),'')) as fingerprint
      from accounting_journal_lines l join accounting_journals j on j.id=l.journal_id and j.status='posted'`)
    const events = await db.query('select id,fingerprint,actor_user_id from accounting_events order by id')
    const periods = await db.query('select id,status,version from accounting_periods order by id')
    const books = await db.query('select id,purpose,mode,owner_mode,opening_validated from accounting_books')
    const policies = await db.query('select id,source_kind,version,validation_status,md5(settings::text) as settings_fingerprint from accounting_policies order by id')
    const registry = await db.query('select event_id,purpose,status,journal_id from accounting_posting_registry order by event_id,purpose')
    const [audit] = await db.query('select count(*) as count from audit_events')
    return { cash, journals, events, periods, books, policies, registry, audit }
  }
  try {
    if (!(await isDatabaseEmpty(source))) throw new Error('Recovery source must be a fresh empty scratch database')
    await migrateUp(source)
    await seedDemo(source, { appEnv:'test', password:'TEST_ONLY_not_a_real_login' })
    await source.query(`insert into bank_accounts(id,code,bank_name,holder_name,account_number,opening_status,opening_balance_minor,opening_date,
      opening_submitted_by,opening_submitted_at,opening_verified_by,opening_verified_at,created_by)
      values ('BA-RECOVERY','RECOVERY','Synthetic','TEST_ONLY','123456','verified',100000000,'2026-08-01','USR-001',now(),'USR-010',now(),'USR-010')`)
    const b = await source.transaction(tx => createBook(tx,actor,{name:'TEST_ONLY recovery',purpose:'rehearsal',cutoverDate:'2026-08-01',timezone:'Asia/Jakarta'},'req_setup','test'))
    const p = await source.transaction(tx => createPeriod(tx,actor,{startsOn:'2026-08-01',endsOn:'2026-08-31',reason:'TEST_ONLY period'},'req_period'))
    for (const kind of ['opening','prepaid_opex']) {
      await source.query(`insert into accounting_policies(id,book_id,source_kind,version,effective_from,principal_agent,recognition,tax_treatment,validation_status,settings,rationale,created_by)
        values ($1,$2,$3,1,'2026-08-01','not-applicable','TEST_ONLY','TEST_ONLY_EXCLUDED','test-only',$4::text::jsonb,'TEST_ONLY recovery fixture','USR-010')`,
        [`APL-${kind}`,b.id,kind,JSON.stringify(kind === 'prepaid_opex' ? {method:'equal-months'} : {})])
    }
    await source.transaction(tx => postBusinessEvent(tx,actor,{sourceType:'test_opening',sourceId:'TEST_ONLY',sourceVersion:'1',kind:'opening',effectiveDate:'2026-08-01',
      snapshot:{amountMinor:'100000000'},policyKind:'opening',description:'TEST_ONLY opening',
      lines:[{accountCode:'1100',bankAccountId:'BA-RECOVERY',debitMinor:'100000000',creditMinor:'0'},{accountCode:'3100',debitMinor:'0',creditMinor:'100000000'}]},'req_opening'))
    await source.query("update accounting_books set mode='active',entity_type='TEST_ONLY',accounting_standard='TEST_ONLY',opening_validated=true")
    const call = caller(source)
    const ownerLogin = await call('POST','/auth/demo-login',{body:{userId:'USR-010'}})
    const cookie = ownerLogin.headers.get('set-cookie')!.split(';')[0]!
    const adminLogin = await call('POST','/auth/demo-login',{body:{userId:'USR-002'}})
    const adminCookie = adminLogin.headers.get('set-cookie')!.split(';')[0]!
    const body = {bankAccountId:'BA-RECOVERY',amountMinor:'9000000',effectiveDate:'2026-08-01',description:'TEST_ONLY recovery rent',evidenceRef:'TEST_ONLY-RESTORE',startMonth:'2026-08',months:3,method:'equal-months'}
    const paid = await call('POST','/finance/prepaid-expenses',{body,cookie,key:'recovery-payment'})
    expect(paid.status).toBe(201)
    expect((await call('POST','/finance/prepaid-amortization-runs',{body:{throughPeriod:'2026-08'},cookie,key:'recovery-amort'})).status).toBe(200)
    await source.query("update accounting_periods set status='closed',reason='TEST_ONLY completed period' where id=$1",[p.id])
    const before = await snapshot(source)
    const parent = resolve(import.meta.dir,'../.data/accounting-recovery-rehearsals')
    mkdirSync(parent,{recursive:true})
    const archiveDirectory = mkdtempSync(join(parent,'synthetic-'))
    const archive = await backupDatabase(source,sourceUrl,archiveDirectory)
    restored = await restoreDatabase(archive.file,targetUrl)
    expect(await snapshot(restored)).toEqual(before)
    await migrateUp(restored) // existing checksums/schema survive restore; no migration or money replay.
    const after = caller(restored)
    const replay = await after('POST','/finance/prepaid-expenses',{body,cookie,key:'recovery-payment'})
    expect(replay.status).toBe(201);expect(replay.json.data.transactionId).toBe(paid.json.data.transactionId)
    expect(replay.headers.get('idempotent-replayed')).toBe('true')
    expect(await snapshot(restored)).toEqual(before)
    const list = await after('GET','/finance/prepaid-expenses?asOf=2026-08-31',{cookie})
    expect(list.json.data.items[0]).toMatchObject({totalMinor:'9000000',amortizedMinor:'3000000',remainingMinor:'6000000'})
    const pl = await after('GET','/accounting/reports/profit-loss?from=2026-08-01&to=2026-08-31',{cookie})
    expect(pl.json.data.profitBeforeTaxMinor).toBe('-3000000');expect(pl.json.data.netProfitMinor).toBeNull()
    const closed = await after('POST','/finance/prepaid-expenses',{body:{...body,evidenceRef:'TEST_ONLY-CLOSED'},cookie,key:'restored-period-lock'})
    expect(closed.status).toBe(422)
    expect((await after('GET','/finance/prepaid-expenses',{cookie:adminCookie})).status).toBe(403)
    expect((await after('GET','/finance/prepaid-expenses')).status).toBe(401)
    await expect(restored.query("update accounting_journal_lines set debit_minor=debit_minor+1 where debit_minor>0")).rejects.toThrow()
    expect(await snapshot(restored)).toEqual(before)
  } finally {
    await restored?.close()
    await source.close()
  }
},120000)
