import type { Actor } from '../auth/rbac'
import type { Queryable } from './client'
import { SeedRefusedError } from './seed-demo'
import { recordAudit } from '../shared/audit'
import { importStatement, matchStatementLine } from '../modules/finance/bank-statements'

const MARKER = 'owner-year-bank-v1'
const csvCell = (value: string) => `"${value.replaceAll('"', '""')}"`

/** Optional additive fixture revision. Import/matching never creates a second cash transaction or journal. */
export async function seedOwnerYearStatements(tx: Queryable, finance: Actor) {
  if ((await tx.query('select id from audit_events where action=$1 and entity_id=$2', ['demo.bank_statements_completed', MARKER])).length) return
  const [book] = await tx.query<{ purpose: string; mode: string; name: string }>('select purpose,mode,name from accounting_books where singleton')
  if (!book || book.purpose !== 'rehearsal' || book.mode !== 'shadow' || book.name !== 'DEMO FIKTIF — MANOVA 12 bulan') {
    throw new SeedRefusedError('Bank statement demo may only extend the dedicated owner year rehearsal.')
  }
  const before = await tx.query('select (select count(*) from financial_transactions) as cash,(select count(*) from accounting_journals) as journals')
  const accounts = await tx.query<{ id: string; code: string }>("select id,code from bank_accounts where code in ('DEMO-BCA','DEMO-MDR','DEMO-BRI') order by code")
  let imported = 0, matched = 0, leftForPractice = 0
  for (const account of accounts) {
    // Never fabricate a bank confirmation for transactions the user entered or reversed after the original seed.
    const rows = await tx.query<{ id: string; direction: string; amount_minor: string; effective_date: string; label: string }>(`select t.id,t.direction,t.amount_minor,t.effective_date,coalesce(t.memo,t.reference,t.kind) as label
      from financial_transactions t where t.bank_account_id=$1 and t.provenance='demo-fixture' and t.reversal_of_id is null
      and not exists(select 1 from financial_transactions r where r.reversal_of_id=t.id)
      and t.effective_date between '2025-11-01' and '2026-10-22' order by t.effective_date,t.id`, [account.id])
    if (!rows.length) continue // No movement in the supplier reserve account: do not invent one.
    const csv = ['Tanggal,Deskripsi,Nominal,Referensi', ...rows.map(t => [t.effective_date, csvCell(`DEMO rekening koran: ${t.label}`), `${t.direction === 'out' ? '-' : ''}${t.amount_minor}`, `DEMO-BANK-${t.id}`].join(','))]
    if (account.code === 'DEMO-BCA') {
      csv.push('2026-10-20,"DEMO biaya admin bank belum dicatat",-12500,DEMO-BANK-FEE-REVIEW')
      csv.push('2026-10-21,"DEMO setoran belum diidentifikasi - perlu ditinjau",3000000,DEMO-BANK-IN-REVIEW')
    }
    const result = await importStatement(tx, finance, { bankAccountId: account.id, fileName: `DEMO-${account.code}-2025-11_2026-10.csv`, csv: csv.join('\n'), mapping: { delimiter: ',', skipRows: 1, dateColumn: 0, descriptionColumn: 1, amountColumn: 2, referenceColumn: 3, dateFormat: 'YYYY-MM-DD', numberStyle: 'en' } }, MARKER)
    imported += result.imported
    const lines = await tx.query<{ id: string; external_ref: string }>('select id,external_ref from bank_statement_lines where import_id=$1', [result.importId])
    const byRef = new Map(lines.map(l => [l.external_ref, l.id]))
    let octoberPractice = 0
    for (const row of rows) {
      if (row.effective_date.startsWith('2026-10') && octoberPractice++ < 2) { leftForPractice++; continue }
      await matchStatementLine(tx, finance, byRef.get(`DEMO-BANK-${row.id}`)!, { matches: [{ transactionId: row.id, amountMinor: row.amount_minor }] }, MARKER)
      matched++
    }
  }
  const after = await tx.query('select (select count(*) from financial_transactions) as cash,(select count(*) from accounting_journals) as journals')
  if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error('Statement fixture changed the cash book or journals; rolling back.')
  await recordAudit(tx, { action: 'demo.bank_statements_completed', actorUserId: finance.userId, entityType: 'demo_fixture', entityId: MARKER, requestId: MARKER,
    reason: 'TEST_ONLY rekening koran sintetis, sebagian cocok dan sebagian untuk latihan; bukan bukti bank nyata', after: { imported, matched, leftForPractice, bankOnlyReviewRows: 2 } })
}
