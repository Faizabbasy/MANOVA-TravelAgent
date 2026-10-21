import type { Db, Queryable } from '../../db/client'
import { errors } from '../../http/errors'
import { paginate, parsePageQuery } from '../../http/envelope'
import { bookDto, dateInput, getBook } from './setup'

export async function setupStatus(tx: Queryable) {
  const b = await getBook(tx)
  if (!b) return { book:null,accounts:[],periods:[],policies:[],activationAvailable:false as const }
  const accounts = await tx.query<Record<string, any>>('select * from accounting_accounts where book_id=$1 order by code',[b.id])
  const periods = await tx.query<Record<string, any>>('select * from accounting_periods where book_id=$1 order by starts_on,id',[b.id])
  const policies = await tx.query<Record<string, any>>('select * from accounting_policies where book_id=$1 order by source_kind,version desc',[b.id])
  return { book:bookDto(b),activationAvailable:false as const,
    accounts:accounts.map(a => ({ code:a.code,name:a.name,type:a.account_type,controlRole:a.control_role,requiredDimension:a.required_dimension })),
    periods:periods.map(p => ({ id:p.id,startsOn:p.starts_on,endsOn:p.ends_on,status:p.status,version:p.version })),
    policies:policies.map(p => ({ id:p.id,sourceKind:p.source_kind,version:p.version,effectiveFrom:p.effective_from,principalAgent:p.principal_agent,
      recognition:p.recognition,taxTreatment:p.tax_treatment,validationStatus:p.validation_status,rationale:p.rationale,settings:p.settings })) }
}

export async function trialBalance(db: Db, asOf: string) {
  dateInput(asOf,'asOf')
  return db.transaction(async tx => {
    const [b] = await tx.query<Record<string, any>>('select * from accounting_books where singleton for share')
    const available = !!b && b.mode !== 'off' && asOf >= b.cutover_date
    const reasons: { code:string;message:string }[] = []
    if (!b) reasons.push({ code:'SETUP_REQUIRED',message:'Buat profil accounting terlebih dahulu.' })
    else {
      if (b.mode === 'off') reasons.push({ code:'BOOK_OFF',message:'Buku accounting belum aktif.' })
      if (b.purpose === 'rehearsal') reasons.push({ code:'REHEARSAL_ONLY',message:'Ini hasil rehearsal, bukan buku produksi atau saldo bank.' })
      if (asOf < b.cutover_date) reasons.push({ code:'BEFORE_CUTOVER',message:'Buku sebelum cutover belum tersedia.' })
      if (!b.opening_validated) reasons.push({ code:'OPENING_REQUIRED',message:'Saldo awal accounting belum direkonsiliasi.' })
      if (b.tax_status !== 'validated') reasons.push({ code:'TAX_PROFILE_INCOMPLETE',message:'Profil pajak belum tervalidasi; laba setelah pajak belum tersedia.' })
    }
    const [pending] = b ? await tx.query<{ count:string }>(`select count(*) as count from accounting_posting_registry r join accounting_events e on e.id=r.event_id
      where r.book_id=$1 and r.status='pending' and e.effective_date <= $2`,[b.id,asOf]) : []
    if (pending && BigInt(pending.count) > 0n) reasons.push({ code:'SOURCE_PENDING',message:`${pending.count} kejadian sumber memerlukan kebijakan atau fakta tambahan.` })
    const rows = available ? await tx.query<{ code:string;name:string;account_type:string;debit:string;credit:string;balance:string }>(
      `select a.code,a.name,a.account_type,coalesce(sum(l.debit_minor),0) as debit,coalesce(sum(l.credit_minor),0) as credit,
       coalesce(sum(l.debit_minor-l.credit_minor),0) as balance from accounting_accounts a
       left join (accounting_journal_lines l join accounting_journals j on j.id=l.journal_id and j.status='posted' and j.effective_date <= $2)
       on l.book_id=a.book_id and l.account_code=a.code where a.book_id=$1 group by a.code,a.name,a.account_type order by a.code`,[b.id,asOf]) : []
    let debit = 0n,credit = 0n
    for (const r of rows) { debit += BigInt(r.debit);credit += BigInt(r.credit) }
    return { asOf,timezone:b?.timezone ?? null,currency:b?.currency ?? 'IDR',period:null,
      basis:b?.purpose === 'rehearsal' ? 'rehearsal' as const : 'recognized' as const,available,
      completeness:available ? 'provisional' as const : 'unavailable' as const,reasons,policyVersion:b?.version ?? null,
      totalDebitMinor:available ? debit.toString() : null,totalCreditMinor:available ? credit.toString() : null,
      balanced:available ? debit === credit : null,netProfitMinor:null,
      rows:rows.map(r => ({ code:r.code,name:r.name,type:r.account_type,debitMinor:r.debit,creditMinor:r.credit,balanceMinor:r.balance })) }
  })
}

export async function listJournals(tx: Queryable, query: { limit?:string;cursor?:string;sourceType?:string;sourceId?:string;projectId?:string }) {
  const { limit,after } = parsePageQuery(query)
  const b = await getBook(tx)
  if (!b) return { items:[],pagination:{ limit,nextCursor:null } }
  const rows = await tx.query<Record<string, any> & { id:string }>(`select j.id,j.description,j.effective_date,j.reversal_of_id,e.source_type,e.source_id,
    j.policy_id from accounting_journals j join accounting_events e on e.id=j.event_id
    where j.book_id=$1 and j.status='posted' and ($2::text is null or j.id > $2)
    and ($3::text is null or e.source_type=$3) and ($4::text is null or e.source_id=$4)
    and ($5::text is null or exists (select 1 from accounting_journal_lines l where l.journal_id=j.id and l.project_id=$5))
    order by j.id limit $6`,[b.id,after,query.sourceType ?? null,query.sourceId ?? null,query.projectId ?? null,limit+1])
  return paginate(rows.map(j => ({ id:j.id,description:j.description,effectiveDate:j.effective_date,reversalOfId:j.reversal_of_id,
    sourceType:j.source_type,sourceId:j.source_id,policyId:j.policy_id })),limit)
}

export async function journalDetail(tx: Queryable,id:string) {
  const b = await getBook(tx)
  if (!b) throw errors.notFound('Jurnal accounting')
  const [j] = await tx.query<Record<string, any>>(`select j.*,e.source_type,e.source_id,e.source_version,e.event_kind,e.snapshot,e.request_id,
    p.version as policy_version from accounting_journals j join accounting_events e on e.id=j.event_id
    join accounting_policies p on p.id=j.policy_id where j.id=$1 and j.book_id=$2 and j.status='posted'`,[id,b.id])
  if (!j) throw errors.notFound('Jurnal accounting')
  const lines = await tx.query<Record<string, any>>(`select l.*,a.name from accounting_journal_lines l join accounting_accounts a on a.book_id=l.book_id and a.code=l.account_code
    where journal_id=$1 order by line_no`,[id])
  return { id:j.id,description:j.description,effectiveDate:j.effective_date,status:j.status,sourceType:j.source_type,sourceId:j.source_id,
    sourceVersion:j.source_version,eventKind:j.event_kind,policyId:j.policy_id,policyVersion:j.policy_version,reversalOfId:j.reversal_of_id,
    correctionReason:j.correction_reason,requestId:j.request_id,snapshot:j.snapshot,
    lines:lines.map(l => ({ accountCode:l.account_code,accountName:l.name,debitMinor:l.debit_minor,creditMinor:l.credit_minor,
      bankAccountId:l.bank_account_id,projectId:l.project_id,salesOrderId:l.sales_order_id,partyId:l.party_id,vendorId:l.vendor_id,employeeId:l.employee_id })) }
}

export async function listExceptions(tx: Queryable,query:{ limit?:string;cursor?:string }) {
  const { limit,after } = parsePageQuery(query)
  const b = await getBook(tx)
  if (!b) return { items:[],pagination:{ limit,nextCursor:null } }
  const rows = await tx.query<Record<string, any> & { id:string }>(`select (e.id || ':' || r.purpose) as id,e.id as event_id,e.source_type,e.source_id,e.effective_date,r.reason_code,r.reason_message
    from accounting_posting_registry r join accounting_events e on e.id=r.event_id where r.book_id=$1 and r.status='pending'
    and ($2::text is null or (e.id || ':' || r.purpose) > $2) order by (e.id || ':' || r.purpose) limit $3`,[b.id,after,limit+1])
  return paginate(rows.map(r => ({ id:r.id,eventId:r.event_id,sourceType:r.source_type,sourceId:r.source_id,effectiveDate:r.effective_date,code:r.reason_code,message:r.reason_message })),limit)
}

export async function sourceStatus(tx:Queryable,type:string,id:string) {
  const sources:Record<string,string> = {
    company_expense:'select incurred_on as effective_date from company_expenses where id=$1',
    financial_transaction:'select effective_date from financial_transactions where id=$1',
    customer_invoice:'select issue_date as effective_date from customer_invoices where id=$1',
    vendor_invoice:'select invoice_date as effective_date from vendor_invoices where id=$1',
    vendor_fulfillment_match:'select posting_date as effective_date from vendor_fulfillment_matches where id=$1',
    service_fulfillment:'select fulfilled_on as effective_date from service_fulfillments where id=$1',
    supplier_claim:'select recognized_on as effective_date from supplier_claims where id=$1'
  }
  if (!sources[type]) throw errors.notFound('Sumber accounting')
  const [source] = await tx.query<{ effective_date:string | null }>(sources[type],[id])
  if (!source) throw errors.notFound('Sumber accounting')
  const b = await getBook(tx)
  if (!b || b.mode === 'off') return { status:'off' as const,basis:b?.purpose ?? null,message:'Accounting belum aktif. Transaksi Finance tetap memakai sumber existing.',journals:[] }
  if (source.effective_date && source.effective_date < b.cutover_date) return { status:'before-cutover' as const,basis:b.purpose,message:'Sumber sebelum cutover memerlukan mapping saldo awal, bukan mengulang kas.',journals:[] }
  const rows = await tx.query<{ status:'pending'|'posted';reason_message:string | null;journal_id:string | null }>(`select r.status,r.reason_message,r.journal_id
    from accounting_events e join accounting_posting_registry r on r.event_id=e.id and r.book_id=e.book_id
    where e.book_id=$1 and e.source_type=$2 and e.source_id=$3 order by e.id`,[b.id,type,id])
  const pending = rows.filter(r => r.status === 'pending')
  return { status:pending.length ? 'pending' as const : rows.length ? 'posted' as const : 'not-captured' as const,basis:b.purpose,
    message:pending.length ? pending.map(r => r.reason_message).join(' ') : rows.length ? 'Jurnal terbentuk dari transaksi sumber yang sama.' : 'Belum ada event accounting untuk sumber ini. Kelengkapan belum dapat dinyatakan.',
    journals:rows.filter(r => r.journal_id).map(r => r.journal_id!) }
}
