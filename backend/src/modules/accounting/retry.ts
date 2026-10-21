import type { Actor } from '../../auth/rbac'
import type { Queryable } from '../../db/client'
import { AppError, errors } from '../../http/errors'
import { recordAudit } from '../../shared/audit'
import { postCashSource } from './cash-source'
import { postAllocationSource, postInvoiceSource } from './invoice-source'
import { postCreditNoteSource, postFulfillmentSource, postSupplierClaimSource } from './recognition'
import { postDepreciationSource } from './assets'
import { postPrepaidAmortization } from './prepaid'
import { postCompanyExpense } from './company-expenses'
import { postExpenseClaimSource, postPayrollSource } from './staff'
import { getBook } from './setup'
import { postVendorFulfillmentMatch } from './supplier-matching'

/**
 * Re-derive a pending source after its policy/facts were completed. Runs the SAME source derivation (frozen snapshot,
 * fingerprint check), so it can never create cash, change the source, or post a second journal. Voids and
 * reversals re-run from the original event's correction reason.
 */
export async function retryPendingEvent(tx: Queryable, actor: Actor, eventId: string, requestId: string) {
  const book = await getBook(tx, true)
  if (!book) throw errors.notFound('Profil accounting')
  const [e] = await tx.query<{ id: string; source_type: string; source_id: string; event_kind: string; effective_date: string; snapshot: Record<string, any> }>(`
    select e.id, e.source_type, e.source_id, e.event_kind, e.effective_date, e.snapshot from accounting_events e
      join accounting_posting_registry r on r.event_id = e.id and r.book_id = e.book_id where e.id = $1 and e.book_id = $2 and r.status = 'pending'`, [eventId, book.id])
  if (!e) throw errors.notFound('Pekerjaan accounting tertunda')
  const reason = typeof e.snapshot.correctionReason === 'string' ? e.snapshot.correctionReason : undefined
  const voided = e.event_kind === 'source_voided' || e.event_kind === 'invoice_voided'
  let result: { status: string } | undefined
  switch (e.source_type) {
    case 'vendor_fulfillment_match': result = await postVendorFulfillmentMatch(tx,actor,e.source_id,requestId,voided ? reason : undefined,voided ? e.effective_date : undefined); break
    case 'company_expense': result = await postCompanyExpense(tx,actor,e.source_id,requestId,voided ? e.effective_date : undefined,voided ? reason : undefined); break
    case 'financial_transaction': result = await postCashSource(tx, actor, e.source_id, requestId); break
    case 'customer_invoice': case 'vendor_invoice':
      result = await postInvoiceSource(tx, actor, e.source_type, e.source_id, e.effective_date, requestId, voided ? reason : undefined); break
    case 'payment_allocation': result = await postAllocationSource(tx, actor, e.source_id, requestId); break
    case 'service_fulfillment': result = await postFulfillmentSource(tx, actor, e.source_id, requestId, voided ? reason : undefined, voided ? e.effective_date : undefined); break
    case 'supplier_claim': result = await postSupplierClaimSource(tx, actor, e.source_id, requestId, voided ? reason : undefined, voided ? e.effective_date : undefined); break
    case 'credit_note': result = await postCreditNoteSource(tx, actor, e.source_id, requestId, voided ? reason : undefined, voided ? e.effective_date : undefined); break
    case 'employee_expense_claim': result = await postExpenseClaimSource(tx, actor, e.source_id, requestId, voided ? reason : undefined, voided ? e.effective_date : undefined); break
    case 'payroll_run': result = await postPayrollSource(tx, actor, e.source_id, requestId); break
    case 'asset_depreciation': {
      const [assetId, period] = e.source_id.split(':')
      result = await postDepreciationSource(tx, actor, assetId!, period!, requestId); break
    }
    case 'prepaid_amortization': {
      const [id, period] = e.source_id.split(':')
      result = await postPrepaidAmortization(tx, actor, id!, period!, requestId); break
    }
    default: throw new AppError(422, 'ACCOUNTING_REVIEW_REQUIRED', 'Jenis sumber ini belum dapat diproses ulang otomatis.')
  }
  if(result?.status==='posted'){
    // Existing corrections are authorised business facts. Resolving their parent derives the compensations too;
    // it never repeats a payment or changes the cancelled source back to issued/recorded.
    if(e.source_type==='financial_transaction' || e.source_type==='payment_allocation'){
      const reversals=await tx.query<{id:string}>(e.source_type==='financial_transaction'
        ?'select id from financial_transactions where reversal_of_id=$1'
        :'select r.id from payment_allocations a join financial_transactions r on r.reversal_of_id=a.transaction_id where a.id=$1::bigint',[e.source_id])
      for(const r of reversals)await postCashSource(tx,actor,r.id,requestId)
    }
    if(!voided){
      const corrections=await tx.query<{id:string}>(`select c.id from accounting_events c join accounting_posting_registry r on r.event_id=c.id and r.book_id=c.book_id
        where c.book_id=$1 and c.source_type=$2 and c.source_id=$3 and c.event_kind in('source_voided','invoice_voided') and r.status='pending' order by c.id`,[book.id,e.source_type,e.source_id])
      for(const c of corrections)await retryPendingEvent(tx,actor,c.id,requestId)
    }
  }
  const [after] = await tx.query<{ status: string; reason_message: string | null }>('select status, reason_message from accounting_posting_registry where book_id = $1 and event_id = $2', [book.id, eventId])
  await recordAudit(tx, { action: 'finance.accounting_pending_retried', actorUserId: actor.userId, entityType: 'accounting_event', entityId: eventId, requestId,
    after: { sourceType: e.source_type, sourceId: e.source_id, status: after?.status ?? result?.status ?? null } })
  return { eventId, status: (after?.status==='superseded'?'posted':after?.status ?? 'pending') as 'pending' | 'posted', message: after?.status === 'pending' ? after.reason_message : null }
}
