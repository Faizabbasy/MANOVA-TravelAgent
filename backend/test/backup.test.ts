import { afterAll, describe, expect, test } from 'bun:test'
import { appendFileSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { BackupError, backupDatabase, restoreDatabase,isDatabaseEmpty } from '../src/db/backup'
import { openDb } from '../src/db/client'
import { migrateUp } from '../src/db/migrator'
import { rehearseMigrations } from '../src/db/rehearsal'
import { loadMigrations } from '../src/db/migrator'
import { seedDemo } from '../src/db/seed-demo'

const work = mkdtempSync(join(tmpdir(), 'manova-backup-'))
afterAll(() => rmSync(work, { recursive: true, force: true }))

describe('backup and restore (PGlite)', () => {
  test('an object outside the current schema or a function still makes a restore target occupied',async()=>{
    const db=await openDb('pglite://memory')
    try{
      expect(await isDatabaseEmpty(db)).toBe(true)
      await db.exec('create schema protected_user_data; create table protected_user_data.keep_me(id integer primary key); insert into protected_user_data.keep_me values(71)')
      expect(await isDatabaseEmpty(db)).toBe(false)
      expect((await db.query<{id:number}>('select id from protected_user_data.keep_me'))[0]!.id).toBe(71)
    }finally{await db.close()}
    const functions=await openDb('pglite://memory')
    try{
      await functions.exec('create function public.keep_me() returns integer language sql as $$ select 71 $$')
      expect(await isDatabaseEmpty(functions)).toBe(false)
    }finally{await functions.close()}
  })
  test('full rehearsal: fresh → up → seed → down to 0 → up → backup → restore → identical', async () => {
    const steps = await rehearseMigrations({
      appEnv: 'test',
      sourceUrl: 'pglite://memory',
      restoreUrl: 'pglite://memory',
      backupDir: join(work, 'rehearsal')
    })
    expect(steps).toHaveLength(7)
    expect(steps.at(-1)).toContain(`cash book immutable, schema v${loadMigrations().length}, checksums verified`)
  }, 60_000)

  test('restore refuses a tampered backup', async () => {
    const db = await openDb('pglite://memory')
    await migrateUp(db)
    await seedDemo(db, { appEnv: 'test', password: 'x' })
    const backup = await backupDatabase(db, 'pglite://memory', join(work, 'tamper'))
    await db.close()
    appendFileSync(backup.file, 'x')
    await expect(restoreDatabase(backup.file, 'pglite://memory')).rejects.toThrow('Checksum mismatch')
  }, 60_000)

  test('restore refuses a backup without checksum and a non-empty target directory', async () => {
    const lonely = join(work, 'lonely.tar.gz')
    writeFileSync(lonely, 'data')
    await expect(restoreDatabase(lonely, 'pglite://memory')).rejects.toBeInstanceOf(BackupError)

    const db = await openDb('pglite://memory')
    await migrateUp(db)
    const backup = await backupDatabase(db, 'pglite://memory', join(work, 'guard'))
    await db.close()
    const occupied = join(work, 'occupied')
    mkdirSync(occupied, { recursive: true })
    writeFileSync(join(occupied, 'PG_VERSION'), '17')
    await expect(restoreDatabase(backup.file, `pglite://${occupied}`)).rejects.toThrow('not empty')
  }, 60_000)

  test('rehearsal never runs in production', async () => {
    await expect(rehearseMigrations({ appEnv: 'production', sourceUrl: 'pglite://memory', restoreUrl: 'pglite://memory', backupDir: work }))
      .rejects.toThrow('never runs')
  })
})
