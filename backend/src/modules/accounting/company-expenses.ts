import type { Actor } from '../../auth/rbac'
import type { Queryable } from '../../db/client'
import { AppError, errors } from '../../http/errors'
import { findPolicy, originalLines, postBusinessEvent, type JournalLine } from './posting'
import { roleCodes } from './recognition'
import { getBook } from './setup'
import { openingCovers } from './opening'

export async function companyExpenseLines(tx: Queryable, date: string, category: string, vendorId: string, parts: [string, bigint][]) {
  const book = (await getBook(tx))!
  const p = await findPolicy(tx,book,'company_expense',date), code = await roleCodes(tx,book)
  const role = (p?.settings.classifications as Record<string,string> | undefined)?.[category]
  const valid = role === 'office-expense' // Additional categories may map here explicitly; no classification guessed from an outflow.
  return { lines: parts.filter(([,n]) => n!==0n).map(([r,n]): JournalLine => ({accountCode:code(r==='expense' ? role ?? '' : r),
    debitMinor:n>0n ? n.toString() : '0',creditMinor:n<0n ? (-n).toString() : '0',vendorId})),
    pendingReason:valid ? undefined : {code:'COMPANY_EXPENSE_CLASSIFICATION_REQUIRED',message:'Validasi klasifikasi biaya kantor pada kebijakan sumber terlebih dahulu.'} }
}
export async function postCompanyExpense(tx: Queryable, actor: Actor, id: string, requestId: string, voidDate?: string, reason?: string) {
  const book = await getBook(tx,true)
  if (!book || book.mode==='off') return
  const [e] = await tx.query<{id:string;vendor_id:string;category:string;amount_minor:string;incurred_on:string;evidence_ref:string;basis:string;description:string}>(
    'select id,vendor_id,category,amount_minor,incurred_on,evidence_ref,basis,description from company_expenses where id=$1',[id])
  if (!e) throw errors.notFound('Biaya perusahaan')
  const date = voidDate ?? e.incurred_on
  if (date<book.cutover_date) {
    if (book.mode==='active') throw new AppError(422,'ACCOUNTING_REVIEW_REQUIRED','Biaya sebelum cutover harus melalui saldo awal/koreksi yang dapat ditelusuri.')
    return
  }
  const original = reason ? (await tx.query<{id:string}>(`select j.id from accounting_journals j join accounting_events e on e.id=j.event_id
    where e.book_id=$1 and e.source_type='company_expense' and e.source_id=$2 and e.event_kind='source_recorded' and j.status='posted'`,[book.id,id]))[0] : undefined
  const derived = await companyExpenseLines(tx,date,e.category,e.vendor_id,[['expense',BigInt(e.amount_minor)],['company-accrued',-BigInt(e.amount_minor)]])
  return postBusinessEvent(tx,actor,{sourceType:'company_expense',sourceId:id,sourceVersion:reason ? 'void' : '1',kind:reason ? 'source_voided' : 'source_recorded',
    effectiveDate:date,snapshot:{...e,...(reason ? {correctionReason:reason} : {})},policyKind:'company_expense',description:`${reason ? 'Pembatalan' : 'Biaya kantor'} ${id}`,
    lines:reason ? original ? await originalLines(tx,original.id) : [] : derived.lines,reversalOfId:original?.id,correctionReason:reason,
    pendingReason:reason ? original ? undefined : {code:'OPENING_SOURCE_MAPPING_REQUIRED',message:'Koreksi sumber sebelum cutover memerlukan review saldo awal.'} : derived.pendingReason},requestId)
}
export async function companyInvoiceLines(tx: Queryable, invoiceId: string, date: string, total: bigint) {
  const [e] = await tx.query<{id:string;vendor_id:string;category:string;amount_minor:string;incurred_on:string}>(`select e.id,e.vendor_id,e.category,e.amount_minor,e.incurred_on
    from company_expense_invoice_links l join company_expenses e on e.id=l.expense_id where l.vendor_invoice_id=$1`,[invoiceId])
  if (!e) return null
  const book = (await getBook(tx))!
  const derived = await companyExpenseLines(tx,date,e.category,e.vendor_id,[['company-accrued',BigInt(e.amount_minor)],['expense',total-BigInt(e.amount_minor)],['payable',-total]])
  const [posted] = await tx.query(`select 1 from accounting_events e join accounting_posting_registry r on r.event_id=e.id and r.book_id=e.book_id
    where e.book_id=$1 and e.source_type='company_expense' and e.source_id=$2 and e.event_kind='source_recorded' and r.status='posted'`,[book.id,e.id])
  if (!posted && !(e.incurred_on<book.cutover_date && await openingCovers(tx,book.id,'company_expense',e.id))) {
    derived.pendingReason = {code:'COMPANY_EXPENSE_SOURCE_REQUIRED',message:'Beban/accrual asal atau mapping saldo awal belum dibukukan. Selesaikan sumber tanpa mengulang pembayaran.'}
  }
  return derived
}
