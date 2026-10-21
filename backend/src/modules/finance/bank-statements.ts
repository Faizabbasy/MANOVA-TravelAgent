import { createHash } from 'node:crypto'
import type { Actor } from '../../auth/rbac'
import type { Db, Queryable } from '../../db/client'
import { getBook } from '../accounting/setup'
import { ID_PATTERN } from '../../http/envelope'
import { errors } from '../../http/errors'
import { recordAudit } from '../../shared/audit'
import { nextId } from '../../shared/ids'
import { parseMovementAmount, rule } from './common'
import { postManualTransaction, validateReason } from './postings'
import { parseStatementCsv, type StatementMapping, type StatementRow } from './statement-csv'

/**
 * Rekening koran (owner accounting F7). Import stores the bank's view; it never posts cash. Each line is matched to
 * existing cash transactions (split/fee/one-to-many allowed), or the owner confirms a new source transaction from it.
 */

export interface StatementInput { bankAccountId: string; fileName: string; csv: string; mapping: StatementMapping }

function readMapping(raw: unknown): StatementMapping {
  const m = (raw ?? {}) as Record<string, unknown>
  const col = (k: string, required: boolean) => {
    const v = m[k]
    if (v === undefined || v === null) { if (required) throw errors.validation({ [`mapping.${k}`]: ['Pilih kolom.'] }); return undefined }
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > 50) throw errors.validation({ [`mapping.${k}`]: ['Nomor kolom 0–50.'] })
    return v
  }
  if (![',', ';', '\t'].includes(m.delimiter as string)) throw errors.validation({ 'mapping.delimiter': ['Pemisah kolom: koma, titik koma atau tab.'] })
  if (!['YYYY-MM-DD', 'DD/MM/YYYY', 'DD-MM-YYYY'].includes(m.dateFormat as string)) throw errors.validation({ 'mapping.dateFormat': ['Pilih format tanggal.'] })
  if (!['id', 'en'].includes(m.numberStyle as string)) throw errors.validation({ 'mapping.numberStyle': ['Pilih format angka.'] })
  const skip = m.skipRows ?? 0
  if (typeof skip !== 'number' || !Number.isInteger(skip) || skip < 0 || skip > 50) throw errors.validation({ 'mapping.skipRows': ['Baris dilewati 0–50.'] })
  const amountColumn = col('amountColumn', false), debitColumn = col('debitColumn', false), creditColumn = col('creditColumn', false)
  if ((amountColumn === undefined) === (debitColumn === undefined || creditColumn === undefined)) {
    throw errors.validation({ 'mapping.amountColumn': ['Pilih satu kolom nominal bertanda, atau kolom debit dan kredit.'] })
  }
  return { delimiter: m.delimiter as StatementMapping['delimiter'], skipRows: skip, dateColumn: col('dateColumn', true)!, dateFormat: m.dateFormat as StatementMapping['dateFormat'],
    descriptionColumn: col('descriptionColumn', true)!, amountColumn, debitColumn, creditColumn, referenceColumn: col('referenceColumn', false), numberStyle: m.numberStyle as 'id' | 'en' }
}

/** Stable identity: the bank's own reference, else date/side/amount/description plus the occurrence within this file. */
function identities(rows: StatementRow[]) {
  const seen = new Map<string, number>()
  return rows.map(r => {
    const base = r.externalRef ? `ref:${r.externalRef}` : `row:${r.bookedOn}|${r.direction}|${r.amountMinor}|${r.description.toLowerCase().replace(/\s+/g, ' ').trim()}`
    const n = (seen.get(base) ?? 0) + 1
    seen.set(base, n)
    // A bank reference is unique by itself; a repeated one in the same file is kept as its own row, never merged.
    return r.externalRef && n === 1 ? base : `${base}#${n}`
  })
}

async function account(q: Queryable, id: unknown) {
  if (typeof id !== 'string' || !ID_PATTERN.test(id)) throw errors.validation({ bankAccountId: ['Pilih rekening.'] })
  const [a] = await q.query<{ id: string }>('select id from bank_accounts where id = $1', [id])
  if (!a) throw errors.validation({ bankAccountId: ['Rekening tidak ditemukan.'] })
  return a.id
}

function parseInput(input: StatementInput) {
  if (typeof input.csv !== 'string' || !input.csv.trim()) throw errors.validation({ csv: ['Unggah isi file CSV rekening koran.'] })
  const fileName = typeof input.fileName === 'string' ? input.fileName.trim().slice(0, 200) : ''
  if (!fileName) throw errors.validation({ fileName: ['Nama file wajib.'] })
  const mapping = readMapping(input.mapping)
  return { fileName, mapping, parsed: parseStatementCsv(input.csv, mapping) }
}

/** Read-only preview: parsed rows, errors and which rows already exist — nothing is written. */
export async function previewStatement(db: Db, input: StatementInput) {
  const bankAccountId = await account(db, input.bankAccountId)
  const { parsed } = parseInput(input)
  const ids = identities(parsed.rows)
  const existing = new Set((await db.query<{ row_identity: string }>('select row_identity from bank_statement_lines where bank_account_id = $1 and row_identity = any($2::text[])',
    [bankAccountId, ids])).map(r => r.row_identity))
  return { rows: parsed.rows.map((r, i) => ({ ...r, raw: undefined, duplicate: existing.has(ids[i]!) })), errors: parsed.errors,
    totals: { inMinor: parsed.rows.filter(r => r.direction === 'in').reduce((s, r) => s + BigInt(r.amountMinor), 0n).toString(),
      outMinor: parsed.rows.filter(r => r.direction === 'out').reduce((s, r) => s + BigInt(r.amountMinor), 0n).toString() } }
}

export async function importStatement(tx: Queryable, actor: Actor, input: StatementInput, requestId: string) {
  const bankAccountId = await account(tx, input.bankAccountId)
  await tx.query('select id from bank_accounts where id = $1 for update', [bankAccountId])
  const { fileName, mapping, parsed } = parseInput(input)
  if (parsed.errors.length) throw errors.validation({ csv: parsed.errors.slice(0, 10).map(e => `Baris ${e.lineNo}: ${e.message}`) })
  const sha = createHash('sha256').update(input.csv).digest('hex')
  const [again] = await tx.query<{ id: string; row_count: number; skipped_duplicates: number }>('select id, row_count, skipped_duplicates from bank_statement_imports where bank_account_id = $1 and file_sha256 = $2', [bankAccountId, sha])
  if (again) return { importId: again.id, imported: 0, skippedDuplicates: again.row_count + again.skipped_duplicates, alreadyImported: true }
  // Duplicates are known before writing (account row locked), so the immutable import row is written once with final counts.
  const ids = identities(parsed.rows)
  const existing = new Set((await tx.query<{ row_identity: string }>('select row_identity from bank_statement_lines where bank_account_id = $1 and row_identity = any($2::text[])',
    [bankAccountId, ids])).map(r => r.row_identity))
  const fresh = parsed.rows.map((r, i) => ({ r, identity: ids[i]! })).filter(x => !existing.has(x.identity))
  const imported = fresh.length, skipped = parsed.rows.length - fresh.length
  const id = await nextId(tx, 'BSI-')
  await tx.query(`insert into bank_statement_imports (id, bank_account_id, file_name, file_sha256, mapping, row_count, skipped_duplicates, imported_by)
    values ($1,$2,$3,$4,$5::text::jsonb,$6,$7,$8)`, [id, bankAccountId, fileName, sha, JSON.stringify(mapping), imported, skipped, actor.userId])
  for (const { r, identity } of fresh) {
    await tx.query(`insert into bank_statement_lines (id, import_id, bank_account_id, line_no, booked_on, description, direction, amount_minor, external_ref, row_identity, raw)
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::text::jsonb)`,
    [await nextId(tx, 'BSL-'), id, bankAccountId, r.lineNo, r.bookedOn, r.description, r.direction, r.amountMinor, r.externalRef, identity, JSON.stringify(r.raw)])
  }
  await recordAudit(tx, { action: 'finance.bank_statement_imported', actorUserId: actor.userId, entityType: 'bank_statement_import', entityId: id, requestId,
    after: { bankAccountId, fileName, sha256: sha, imported, skippedDuplicates: skipped } })
  return { importId: id, imported, skippedDuplicates: skipped, alreadyImported: false }
}

const LINE_SELECT = `select l.*, coalesce((select sum(m.amount_minor) from bank_reconciliation_matches m join financial_transactions t on t.id = m.transaction_id
    where m.statement_line_id = l.id and m.unmatched_at is null and not exists (select 1 from financial_transactions r where r.reversal_of_id = t.id)), 0) as matched_minor
  from bank_statement_lines l`

function lineDto(l: Record<string, any>) {
  const matched = BigInt(l.matched_minor), amount = BigInt(l.amount_minor)
  return { id: l.id as string, bankAccountId: l.bank_account_id as string, bookedOn: l.booked_on as string, description: l.description as string,
    direction: l.direction as 'in' | 'out', amountMinor: l.amount_minor as string, externalRef: (l.external_ref ?? null) as string | null, matchedMinor: matched.toString(),
    status: matched === 0n ? 'unmatched' as const : matched === amount ? 'matched' as const : 'partial' as const }
}

async function readLine(q: Queryable, lineId: string) {
  if (!ID_PATTERN.test(lineId)) throw errors.notFound('Baris rekening koran')
  const [line] = await q.query<Record<string, any>>(`${LINE_SELECT} where l.id = $1`, [lineId])
  if (!line) throw errors.notFound('Baris rekening koran')
  return line
}

/** Lines of one account and date range, with server-side status; unmatched lines get candidate transactions to confirm. */
export async function listStatementLines(db: Db, query: { bankAccountId?: string; from?: string; to?: string; status?: string }) {
  const bankAccountId = await account(db, query.bankAccountId)
  const from = query.from && /^\d{4}-\d{2}-\d{2}$/.test(query.from) ? query.from : '0001-01-01'
  const to = query.to && /^\d{4}-\d{2}-\d{2}$/.test(query.to) ? query.to : '9999-12-31'
  const lines = (await db.query<Record<string, any>>(`${LINE_SELECT} where l.bank_account_id = $1 and l.booked_on between $2 and $3 order by l.booked_on, l.id limit 1000`,
    [bankAccountId, from, to])).map(lineDto).filter(l => !query.status || l.status === query.status)
  const open = lines.filter(l => l.status !== 'matched')
  // Candidates: same account and direction, unreconciled amount left, within ±5 days. The owner confirms; nothing is auto-matched.
  const candidates = open.length ? await db.query<Record<string, any>>(`select t.id, t.kind, t.direction, t.amount_minor, t.effective_date, coalesce(t.counterparty, t.memo, t.reference) as label,
      t.amount_minor - coalesce((select sum(m.amount_minor) from bank_reconciliation_matches m where m.transaction_id = t.id and m.unmatched_at is null), 0) as open_minor
    from financial_transactions t where t.bank_account_id = $1 and t.reversal_of_id is null and not exists (select 1 from financial_transactions r where r.reversal_of_id = t.id)
      and t.effective_date between ($2::date - 5) and ($3::date + 5)`, [bankAccountId, open[0]!.bookedOn, open.at(-1)!.bookedOn]) : []
  const forLine = (l: (typeof open)[number]) => {
    const left = BigInt(l.amountMinor) - BigInt(l.matchedMinor)
    return candidates.filter(c => c.direction === l.direction && BigInt(c.open_minor) > 0n && Math.abs(Date.parse(c.effective_date) - Date.parse(l.bookedOn)) <= 5 * 86_400_000)
      .sort((a, b) => Number(BigInt(a.open_minor) !== left) - Number(BigInt(b.open_minor) !== left))
      .slice(0, 5).map(c => ({ transactionId: c.id as string, kind: c.kind as string, effectiveDate: c.effective_date as string, label: (c.label ?? null) as string | null,
        openMinor: c.open_minor as string, exactAmount: BigInt(c.open_minor) === left }))
  }
  const [unmatchedCash] = await db.query<{ n: string }>(`select count(*) as n from financial_transactions t where t.bank_account_id = $1 and t.effective_date between $2 and $3
    and t.reversal_of_id is null and not exists (select 1 from financial_transactions r where r.reversal_of_id = t.id)
    and t.amount_minor > coalesce((select sum(m.amount_minor) from bank_reconciliation_matches m where m.transaction_id = t.id and m.unmatched_at is null), 0)`, [bankAccountId, from, to])
  return { lines: lines.map(l => ({ ...l, candidates: l.status === 'matched' ? [] : forLine(l) })), unmatchedCashCount: Number(unmatchedCash!.n) }
}

export async function matchStatementLine(tx: Queryable, actor: Actor, lineId: string, input: { matches: { transactionId: string; amountMinor: string }[] }, requestId: string) {
  const line = await readLine(tx, lineId)
  if (!Array.isArray(input.matches) || !input.matches.length || input.matches.length > 20) throw errors.validation({ matches: ['Pilih 1–20 transaksi kas.'] })
  const seen = new Set<string>()
  const parsed = input.matches.map((m, i) => {
    if (!m?.transactionId || !ID_PATTERN.test(m.transactionId) || seen.has(m.transactionId)) throw errors.validation({ [`matches.${i}.transactionId`]: ['Transaksi tidak valid atau ganda.'] })
    seen.add(m.transactionId)
    return { transactionId: m.transactionId, amount: parseMovementAmount(m.amountMinor, `matches.${i}.amountMinor`) }
  })
  const total = parsed.reduce((s, m) => s + m.amount, 0n)
  if (total > BigInt(line.amount_minor) - BigInt(line.matched_minor)) throw errors.validation({ matches: ['Total melebihi sisa baris rekening koran.'] })
  for (const m of [...parsed].sort((a, b) => a.transactionId.localeCompare(b.transactionId))) {
    const [t] = await tx.query<{ bank_account_id: string; direction: string }>('select bank_account_id, direction from financial_transactions where id = $1', [m.transactionId])
    if (!t || t.bank_account_id !== line.bank_account_id || t.direction !== line.direction) {
      throw rule('Transaksi harus dari rekening dan arah yang sama dengan baris rekening koran.')
    }
    await tx.query('insert into bank_reconciliation_matches (statement_line_id, transaction_id, amount_minor, matched_by) values ($1,$2,$3,$4)', [lineId, m.transactionId, m.amount.toString(), actor.userId])
  }
  await recordAudit(tx, { action: 'finance.bank_line_matched', actorUserId: actor.userId, entityType: 'bank_statement_line', entityId: lineId, requestId,
    after: { matches: parsed.map(m => ({ transactionId: m.transactionId, amountMinor: m.amount.toString() })) } })
  return lineDto(await readLine(tx, lineId))
}

export async function unmatchStatementLine(tx: Queryable, actor: Actor, lineId: string, reasonInput: unknown, requestId: string) {
  const reason = validateReason(reasonInput)
  await readLine(tx, lineId)
  const undone = await tx.query<{ id: string }>(`update bank_reconciliation_matches set unmatched_at = now(), unmatched_by = $2, unmatch_reason = $3
    where statement_line_id = $1 and unmatched_at is null returning id`, [lineId, actor.userId, reason])
  if (!undone.length) throw rule('Baris ini belum dicocokkan.')
  await recordAudit(tx, { action: 'finance.bank_line_unmatched', actorUserId: actor.userId, entityType: 'bank_statement_line', entityId: lineId, requestId, reason,
    after: { matches: undone.map(u => u.id) } })
  return lineDto(await readLine(tx, lineId))
}

/**
 * A line with no source yet (bank fee, interest, a forgotten expense): the owner confirms what it is, the SAME manual
 * cash path posts it once, and it is matched in the same transaction. Receipts and supplier payments use their own forms.
 */
export async function recordFromStatementLine(tx: Queryable, actor: Actor, lineId: string, input: { category?: string; projectId?: string; memo?: string }, requestId: string) {
  await getBook(tx, true)
  const line = await readLine(tx, lineId)
  if (BigInt(line.matched_minor) > 0n) throw rule('Baris ini sudah (sebagian) dicocokkan. Cocokkan sisanya ke transaksi yang ada.')
  const { transactionId } = await postManualTransaction(tx, actor, {
    bankAccountId: line.bank_account_id, kind: line.direction === 'in' ? 'other_income' : 'expense', amountMinor: line.amount_minor, effectiveDate: line.booked_on,
    category: line.direction === 'out' ? input.category : undefined, projectId: input.projectId, reference: line.external_ref ?? undefined,
    memo: (input.memo?.trim() || line.description || 'Dari rekening koran').slice(0, 500)
  }, requestId)
  await tx.query('insert into bank_reconciliation_matches (statement_line_id, transaction_id, amount_minor, matched_by) values ($1,$2,$3,$4)', [lineId, transactionId, line.amount_minor, actor.userId])
  await recordAudit(tx, { action: 'finance.bank_line_recorded', actorUserId: actor.userId, entityType: 'bank_statement_line', entityId: lineId, requestId, after: { transactionId } })
  return { transactionId, line: lineDto(await readLine(tx, lineId)) }
}
