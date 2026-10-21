import { createHash } from 'node:crypto'
import type { Actor } from '../../auth/rbac'
import type { Queryable } from '../../db/client'
import { AppError, errors } from '../../http/errors'
import { recordAudit } from '../../shared/audit'
import { nextId } from '../../shared/ids'
import { parseAmountMinor } from '../../shared/money'
import { dateInput, getBook, type BookRow } from './setup'

export interface JournalLine {
  accountCode: string; debitMinor: string; creditMinor: string; bankAccountId?: string | null
  projectId?: string | null; salesOrderId?: string | null; partyId?: string | null; vendorId?: string | null; employeeId?: string | null
}
export interface BusinessEvent {
  sourceType: string; sourceId: string; sourceVersion: string; kind: string; effectiveDate: string
  snapshot: Record<string, unknown>; policyKind: string; description: string; purpose?: string
  lines: JournalLine[]; reversalOfId?: string; correctionReason?: string
  pendingReason?: { code: string; message: string }
}
export interface PolicyRow extends Record<string, unknown> {
  id: string; source_kind: string; version: number; validation_status: string; principal_agent: string
  recognition: string; tax_treatment: string; settings: Record<string, unknown>
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`).join(',')}}`
  return JSON.stringify(value ?? null)
}

export async function findPolicy(tx: Queryable, book: BookRow, kind: string, date: string) {
  // The latest effective version wins, including a draft. An unvalidated revision never silently falls back to an old rule.
  const [policy] = await tx.query<PolicyRow>(`select * from accounting_policies where book_id=$1 and source_kind=$2
    and effective_from <= $3 and (effective_to is null or effective_to >= $3) order by version desc limit 1`, [book.id,kind,date])
  return policy ?? null
}

export function usablePolicy(book: BookRow, policy: PolicyRow | null): policy is PolicyRow {
  return !!policy && (policy.validation_status === 'validated' || (policy.validation_status === 'test-only' && book.purpose === 'rehearsal'))
    && policy.principal_agent !== 'unknown' && policy.recognition !== 'unknown' && policy.tax_treatment !== 'unknown'
}

/** Called only from server domain services with their existing transaction. No free-form journal HTTP endpoint. */
export async function postBusinessEvent(tx: Queryable, actor: Actor, event: BusinessEvent, requestId: string) {
  const book = await getBook(tx,true)
  if (!book || book.mode === 'off') return { status: 'off' as const, journalId: null }
  const date = dateInput(event.effectiveDate,'effectiveDate')
  if (date < book.cutover_date) return { status: 'before-cutover' as const, journalId: null }
  const purpose = event.purpose ?? 'primary'
  // Freeze economic facts, not a pending attempt's derived lines: a policy can legitimately resolve a pending event.
  // Once posted, the registry returns the original immutable journal before consulting a newer policy.
  const facts={snapshot:JSON.parse(JSON.stringify(event.snapshot)),date,correctionReason:event.correctionReason}
  const fingerprint=createHash('sha256').update(canonical(facts)).digest('hex')
  const legacyFingerprint=(reversalOfId?:string)=>createHash('sha256').update(canonical({...facts,reversalOfId})).digest('hex')
  let [existing] = await tx.query<{ id: string; fingerprint: string;identity_version:number }>(`select id,fingerprint,identity_version from accounting_events
    where book_id=$1 and source_type=$2 and source_id=$3 and source_version=$4 and event_kind=$5`,[book.id,event.sourceType,event.sourceId,event.sourceVersion,event.kind])
  if(existing){
    let same=existing.fingerprint===(existing.identity_version===2?fingerprint:legacyFingerprint(event.reversalOfId))
    if(!same && existing.identity_version===1 && event.reversalOfId && event.correctionReason && ['source_voided','invoice_voided'].includes(event.kind)
      && existing.fingerprint===legacyFingerprint(undefined)){
      // A legacy pending void was frozen before its parent could post. Preserve its original fingerprint;
      // only a still-pending registry may now bind to the immutable parent and compensate its exact lines.
      same=(await tx.query(`select 1 from accounting_posting_registry r left join accounting_journals j on j.id=r.journal_id
        where r.event_id=$1 and (r.status='pending' or (r.status='posted' and j.reversal_of_id=$2))`,[existing.id,event.reversalOfId])).length>0
    }
    if(!same)throw new AppError(409,'ACCOUNTING_SOURCE_CONFLICT','Fakta sumber berbeda dari event yang tersimpan. Gunakan koreksi yang dapat ditelusuri.')
  }
  if (existing) {
    const [registered] = await tx.query<{ journal_id: string | null; status: 'pending' | 'posted';reversal_of_id:string|null }>(`select r.journal_id,r.status,j.reversal_of_id from accounting_posting_registry r left join accounting_journals j on j.id=r.journal_id where r.book_id=$1 and r.event_id=$2 and r.purpose=$3`,[book.id,existing.id,purpose])
    if (registered?.status === 'posted') {
      if((registered.reversal_of_id ?? undefined)!==event.reversalOfId)throw new AppError(409,'ACCOUNTING_SOURCE_CONFLICT','Koreksi sudah terikat jurnal asal yang berbeda. Gunakan koreksi yang dapat ditelusuri.')
      return { status: 'posted' as const, journalId: registered.journal_id }
    }
  } else {
    existing = { id:await nextId(tx,'AEV-'), fingerprint,identity_version:2 }
    await tx.query(`insert into accounting_events (id,book_id,source_type,source_id,source_version,event_kind,effective_date,snapshot,fingerprint,actor_user_id,request_id,identity_version)
      values ($1,$2,$3,$4,$5,$6,$7,$8::text::jsonb,$9,$10,$11,2)`,[existing.id,book.id,event.sourceType,event.sourceId,event.sourceVersion,event.kind,date,JSON.stringify(event.snapshot),fingerprint,actor.userId,requestId])
  }
  const policy = await findPolicy(tx,book,event.policyKind,date)
  const pending = event.pendingReason ?? (!usablePolicy(book,policy) ? { code:'POLICY_REQUIRED',message:'Lengkapi dan validasi kebijakan sumber sebelum membukukan transaksi ini.' } : null)
  if (pending) {
    if (book.mode === 'active') throw new AppError(422,'ACCOUNTING_POLICY_REQUIRED',pending.message,{ details:{ sourceType:event.sourceType,sourceId:event.sourceId,reason:pending.code } })
    await tx.query(`insert into accounting_posting_registry (book_id,event_id,purpose,status,reason_code,reason_message)
      values ($1,$2,$3,'pending',$4,$5) on conflict (book_id,event_id,purpose) do update
      set reason_code=excluded.reason_code,reason_message=excluded.reason_message,updated_at=now()`,[book.id,existing.id,purpose,pending.code,pending.message])
    return { status:'pending' as const,journalId:null }
  }
  const [period] = await tx.query<{ id: string; status: string }>(`select id,status from accounting_periods where book_id=$1 and starts_on <= $2 and ends_on >= $2 for update`,[book.id,date])
  if (!period || period.status !== 'open') throw new AppError(422,'ACCOUNTING_PERIOD_LOCKED','Periode accounting belum tersedia atau sudah dikunci. Tinjau periode sebelum mencatat transaksi sumber.')
  if (event.lines.length < 2) throw errors.validation({ lines:['Jurnal memerlukan minimal dua baris yang seimbang.'] })
  let debit = 0n, credit = 0n
  for (const line of event.lines) {
    const d = parseAmountMinor(line.debitMinor,'debitMinor',{ allowZero:true }), c = parseAmountMinor(line.creditMinor,'creditMinor',{ allowZero:true })
    if (d > 1_000_000_000_000_000n || c > 1_000_000_000_000_000n) throw errors.validation({ lines:['Nominal satu baris melebihi batas transaksi.'] })
    if ((d === 0n) === (c === 0n)) throw errors.validation({ lines:['Setiap baris harus memiliki tepat satu sisi positif.'] })
    debit += d; credit += c
  }
  if (debit !== credit) throw errors.validation({ lines:['Total debit dan kredit harus sama.'] })
  const id = await nextId(tx,'AJN-',6)
  await tx.query(`insert into accounting_journals (id,book_id,event_id,purpose,policy_id,period_id,effective_date,description,reversal_of_id,correction_reason)
    values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,[id,book.id,existing.id,purpose,policy!.id,period.id,date,event.description,event.reversalOfId ?? null,event.correctionReason ?? null])
  let n = 0
  for (const l of event.lines) {
    await tx.query(`insert into accounting_journal_lines (journal_id,book_id,line_no,account_code,debit_minor,credit_minor,bank_account_id,project_id,sales_order_id,party_id,vendor_id,employee_id)
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,[id,book.id,++n,l.accountCode,l.debitMinor,l.creditMinor,l.bankAccountId ?? null,l.projectId ?? null,l.salesOrderId ?? null,l.partyId ?? null,l.vendorId ?? null,l.employeeId ?? null])
  }
  await tx.query("update accounting_journals set status='posted',posted_at=now() where id=$1",[id])
  await tx.query(`insert into accounting_posting_registry (book_id,event_id,purpose,status,journal_id) values ($1,$2,$3,'posted',$4)
    on conflict (book_id,event_id,purpose) do update set status='posted',journal_id=excluded.journal_id,reason_code=null,reason_message=null,updated_at=now()`,[book.id,existing.id,purpose,id])
  await recordAudit(tx,{ action:'finance.accounting_posted',actorUserId:actor.userId,entityType:'accounting_journal',entityId:id,requestId,
    after:{ eventId:existing.id,sourceType:event.sourceType,sourceId:event.sourceId,policyId:policy!.id,effectiveDate:date,reversalOfId:event.reversalOfId ?? null } })
  return { status:'posted' as const,journalId:id }
}

export async function originalLines(tx: Queryable, id: string): Promise<JournalLine[]> {
  return (await tx.query<Record<string, any>>('select * from accounting_journal_lines where journal_id=$1 order by line_no',[id])).map(l => ({
    accountCode:l.account_code,debitMinor:l.credit_minor,creditMinor:l.debit_minor,bankAccountId:l.bank_account_id,projectId:l.project_id,
    salesOrderId:l.sales_order_id,partyId:l.party_id,vendorId:l.vendor_id,employeeId:l.employee_id
  }))
}
