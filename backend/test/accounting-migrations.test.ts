import { describe,expect,test } from 'bun:test'
import { makeTestApp,makeTestDb } from './helpers'
import { migrateDown,migrateUp } from '../src/db/migrator'

/** Accounting migrations are reversible only while no financial evidence exists (dev/scratch); evidence blocks the down step. */
describe('accounting migrations 0045–0047',() => {
  test('round-trip down to 0044 and up again on an empty schema keeps Finance views working',async () => {
    const { db,cleanup } = await makeTestDb()
    try {
      await migrateUp(db)
      await migrateDown(db,{ to:44 })
      expect((await db.query("select to_regclass('service_fulfillments') as t"))[0]!.t).toBeNull()
      expect((await db.query('select count(*) as n from v_unallocated_payments'))[0]!.n).toBe('0')
      await migrateUp(db)
      expect((await db.query("select to_regclass('supplier_claims') as t"))[0]!.t).not.toBeNull()
    } finally { await cleanup() }
  },120000)
  test('0047 down refuses while fulfillment evidence exists',async () => {
    const t = await makeTestApp(),db = t.db,cleanup = t.cleanup
    try {
      await db.query(`insert into service_fulfillments (id,side,project_id,party_id,amount_minor,fulfilled_on,evidence,created_by)
        values ('SFL-T1','customer','PRJ-101','PTY-001',10,'2026-10-01','TEST_ONLY evidence','USR-010')`)
      await expect(migrateDown(db,{ to:46 })).rejects.toThrow()
      expect((await db.query("select to_regclass('service_fulfillments') as t"))[0]!.t).not.toBeNull()
    } finally { await cleanup() }
  },120000)
})
