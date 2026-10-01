import type { Actor } from '../../auth/rbac'
import type { Queryable } from '../../db/client'
import { errors } from '../../http/errors'
import { recordAudit } from '../../shared/audit'
import { isIsoDate } from '../../shared/dates'
import { parseMovementAmount, rule, todayBusinessDate } from './common'
import { validateReason } from './postings'
import { lockInvoice } from './receivables'

/**
 * Debit note — an extra charge on an issued customer invoice (extra room, admin fee…). Kept as a supplementary
 * invoice of type `debit_note` (number DN-YYYY-#####) for the same customer, project, booking and sales order,
 * pointing at its origin. Because it is an invoice, receivables, aging, cash flow, revenue, receipt
 * allocation and void all apply unchanged. No money moves when it is issued.
 */
export async function issueDebitNote (tx: Queryable, actor: Actor, originId: string,
  input: { amountMinor: string; reason: string; dueDate: string }, requestId: string) {
  const origin = await lockInvoice(tx, originId)
  if (origin.status !== 'issued') throw rule('Debit note hanya untuk invoice yang sudah terbit.')
  if (origin.invoice_type === 'debit_note') throw rule('Debit note dibuat dari invoice asal, bukan dari debit note lain.')
  const amount = parseMovementAmount(input.amountMinor)
  const reason = validateReason(input.reason)
  const issueDate = todayBusinessDate()
  if (typeof input.dueDate !== 'string' || !isIsoDate(input.dueDate)) throw errors.validation({ dueDate: ['Tanggal harus berformat YYYY-MM-DD.'] })
  if (input.dueDate < issueDate) throw errors.validation({ dueDate: ['Jatuh tempo tidak boleh sebelum hari ini.'] })

  // Lines may only be written while an invoice is a draft (customer_invoice_lines_guard), so: draft → line → issue.
  const [draft] = await tx.query<{ id: string }>(
    `insert into customer_invoices (project_id, party_id, booking_type, booking_id, sales_order_id, invoice_type, adjusts_invoice_id,
       total_minor, due_date, notes, created_by)
     values ($1, $2, $3, $4, $5, 'debit_note', $6, $7, $8, $9, $10) returning id`,
    [origin.project_id, origin.party_id, origin.booking_type, origin.booking_id, origin.sales_order_id ?? null, origin.id,
      amount.toString(), input.dueDate, reason, actor.userId]
  )
  await tx.query('insert into customer_invoice_lines (invoice_id, position, description, amount_minor) values ($1, 1, $2, $3)',
    [draft!.id, reason, amount.toString()])
  const [ctx] = await tx.query<{ project_name: string; party_name: string }>(
    'select p.name as project_name, pa.name as party_name from projects p, parties pa where p.id = $1 and pa.id = $2',
    [origin.project_id, origin.party_id])
  const [numbered] = await tx.query<{ number: string }>(
    `select 'DN-' || to_char($1::date, 'YYYY') || '-' || lpad(nextval('finance_debit_note_number_seq')::text, 5, '0') as number`, [issueDate])
  await tx.query(
    `update customer_invoices set status = 'issued', number = $2, issue_date = $3, issued_by = $4, issued_at = now(),
       billing_snapshot = $5::text::jsonb, updated_at = now() where id = $1`,
    [draft!.id, numbered!.number, issueDate, actor.userId,
      JSON.stringify({ partyName: ctx!.party_name, projectName: ctx!.project_name, adjustsInvoiceNumber: origin.number })]
  )
  await recordAudit(tx, {
    action: 'finance.debit_note_issued', actorUserId: actor.userId, entityType: 'customer_invoice', entityId: draft!.id, requestId, reason,
    after: { adjustsInvoiceId: origin.id, number: numbered!.number, amountMinor: amount.toString(), dueDate: input.dueDate }
  })
  return { id: draft!.id, number: numbered!.number }
}
