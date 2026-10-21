import type { Actor } from '../../auth/rbac'
import type { Queryable } from '../../db/client'
import { ID_PATTERN, paginate, parsePageQuery } from '../../http/envelope'
import { AppError, errors } from '../../http/errors'
import { recordAudit } from '../../shared/audit'
import { isIsoDate } from '../../shared/dates'
import { nextId } from '../../shared/ids'
import { postCompanyExpense } from '../accounting/company-expenses'
import { getBook } from '../accounting/setup'
import { parseMovementAmount, todayBusinessDate } from './common'
import { validateEffectiveDate, validateReason } from './postings'
import { reviewVendorInvoice } from './payables'

const categories = ['office','marketing','utilities','other']
const text = (s: unknown, field: string) => {
  if (typeof s!=='string' || s.trim().length<3 || s.trim().length>200) throw errors.validation({[field]:['Isi 3–200 karakter.']})
  return s.trim()
}
const date = (s: unknown, field: string) => {
  if (typeof s!=='string' || !isIsoDate(s)) throw errors.validation({[field]:['Tanggal harus YYYY-MM-DD.']})
  return s
}
const month = (s: unknown) => {
  if (typeof s!=='string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(s) || !isIsoDate(`${s}-01`)) throw errors.validation({period:['Bulan harus YYYY-MM.']})
  return s
}
async function vendor(tx: Queryable,id: string) {
  if (!ID_PATTERN.test(id) || !(await tx.query('select 1 from vendors where id=$1',[id])).length) throw errors.validation({vendorId:['Vendor tidak ditemukan.']})
}
export interface ExpenseScheduleInput {vendorId:string;description:string;contractRef:string;category:string;amountMinor:string;startMonth:string;months:number;dueDay:number}
export async function createExpenseSchedule(tx: Queryable,actor: Actor,input: ExpenseScheduleInput,requestId: string) {
  const description=text(input.description,'description'), contractRef=text(input.contractRef,'contractRef'), start=month(input.startMonth)
  await vendor(tx,input.vendorId)
  if (!categories.includes(input.category)) throw errors.validation({category:['Pilih kategori biaya kantor.']})
  if (!Number.isInteger(input.months) || input.months<1 || input.months>120 || !Number.isInteger(input.dueDay) || input.dueDay<1 || input.dueDay>28) throw errors.validation({months:['Isi 1–120 bulan dan tanggal jatuh tempo 1–28.']})
  const amount=parseMovementAmount(input.amountMinor)
  await tx.query('select pg_advisory_xact_lock(hashtext($1))',[`company-contract:${contractRef}`])
  if ((await tx.query('select 1 from company_expense_schedules where contract_ref=$1',[contractRef])).length) throw errors.conflict('Kontrak rutin ini sudah tercatat. Buka jadwal existing.')
  const id=await nextId(tx,'CES-')
  await tx.query(`insert into company_expense_schedules(id,vendor_id,description,contract_ref,category,amount_minor,starts_on,months,due_day,created_by)
    values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,[id,input.vendorId,description,contractRef,input.category,amount.toString(),`${start}-01`,input.months,input.dueDay,actor.userId])
  await recordAudit(tx,{action:'finance.company_schedule_created',actorUserId:actor.userId,entityType:'company_expense_schedule',entityId:id,requestId,after:{...input,amountMinor:amount.toString()}})
  return {id}
}
export async function stopExpenseSchedule(tx: Queryable,actor: Actor,id: string,input:{fromMonth:string;reason:string},requestId: string) {
  const from=month(input.fromMonth), reason=validateReason(input.reason)
  const [s]=await tx.query<{starts_on:string;stops_on:string|null}>('select starts_on,stops_on from company_expense_schedules where id=$1 for update',[id])
  if (!s) throw errors.notFound('Jadwal biaya')
  if (s.stops_on) throw errors.conflict('Rencana ini sudah dihentikan. Riwayat biaya yang terjadi tetap tersimpan.')
  if (`${from}-01`<s.starts_on) throw errors.validation({fromMonth:['Bulan penghentian tidak boleh sebelum jadwal mulai.']})
  await tx.query('update company_expense_schedules set stops_on=$2,stop_reason=$3,stopped_by=$4 where id=$1',[id,`${from}-01`,reason,actor.userId])
  await recordAudit(tx,{action:'finance.company_schedule_stopped',actorUserId:actor.userId,entityType:'company_expense_schedule',entityId:id,requestId,reason,after:{fromMonth:from}})
  return {id}
}
export interface CompanyExpenseInput {scheduleId?:string;period?:string;vendorId?:string;category?:string;description?:string;amountMinor?:string;incurredOn:string;dueDate?:string;evidenceRef:string;basis:string}
export async function recordCompanyExpense(tx: Queryable,actor: Actor,input: CompanyExpenseInput,requestId: string) {
  const book=await getBook(tx,true), incurred=validateEffectiveDate(input.incurredOn,'incurredOn'), evidence=text(input.evidenceRef,'evidenceRef')
  if (book?.mode==='active' && incurred<book.cutover_date) throw new AppError(422,'ACCOUNTING_REVIEW_REQUIRED','Biaya sebelum cutover harus dipetakan pada saldo awal.')
  let s:{vendor_id:string;category:string;description:string;amount_minor:string;due_day:number}|undefined
  const period=input.scheduleId ? month(input.period) : null
  if (input.scheduleId) {
    s=(await tx.query<typeof s & {}>(`select vendor_id,category,description,amount_minor,due_day from company_expense_schedules
      where id=$1 and starts_on<=($2 || '-01')::date and starts_on+make_interval(months=>months)>($2 || '-01')::date
      and (stops_on is null or stops_on>($2 || '-01')::date) for update`,[input.scheduleId,period]))[0]
    if (!s) throw errors.notFound('Bulan jadwal biaya aktif')
    if (incurred.slice(0,7)!==period) throw errors.validation({incurredOn:['Tanggal biaya harus berada dalam bulan jadwal yang dipilih.']})
    if ((await tx.query("select 1 from company_expenses where schedule_id=$1 and period=$2 and status='recorded'",[input.scheduleId,period])).length) throw errors.conflict('Bulan ini sudah dicatat. Buka sumber existing.')
  }
  const vendorId=s?.vendor_id ?? input.vendorId ?? '', category=s?.category ?? input.category ?? ''
  await vendor(tx,vendorId)
  if (!categories.includes(category)) throw errors.validation({category:['Pilih kategori biaya kantor.']})
  if (!['estimate','actual'].includes(input.basis)) throw errors.validation({basis:['Pilih estimasi andal atau nilai aktual.']})
  const amount=parseMovementAmount(input.amountMinor ?? s?.amount_minor), description=text(input.description ?? s?.description,'description')
  const due=date(input.dueDate ?? (s ? `${period}-${String(s.due_day).padStart(2,'0')}` : undefined),'dueDate')
  await tx.query('select pg_advisory_xact_lock(hashtext($1))',[`company-evidence:${evidence}`])
  if ((await tx.query('select 1 from company_expenses where evidence_ref=$1',[evidence])).length) throw errors.conflict('Bukti biaya ini sudah tercatat.')
  const id=await nextId(tx,'COX-')
  await tx.query(`insert into company_expenses(id,vendor_id,schedule_id,period,description,category,amount_minor,incurred_on,due_date,evidence_ref,basis,created_by)
    values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,[id,vendorId,input.scheduleId ?? null,period,description,category,amount.toString(),incurred,due,evidence,input.basis,actor.userId])
  const posting=await postCompanyExpense(tx,actor,id,requestId)
  await recordAudit(tx,{action:'finance.company_expense_recorded',actorUserId:actor.userId,entityType:'company_expense',entityId:id,requestId,after:{amountMinor:amount.toString(),vendorId,incurredOn:incurred,evidenceRef:evidence,basis:input.basis}})
  return {id,accountingStatus:posting?.status ?? 'off'}
}
export async function matchCompanyInvoice(tx: Queryable,actor: Actor,id: string,invoiceId: string,requestId: string) {
  await getBook(tx,true)
  const [e]=await tx.query<{status:string}>('select status from company_expenses where id=$1 for update',[id])
  if (!e) throw errors.notFound('Biaya perusahaan')
  if (e.status!=='recorded') throw errors.conflict('Biaya sudah dibatalkan.')
  const [v]=await tx.query<{vendor_id:string;project_id:string|null;sales_order_id:string|null;booking_id:string|null;service_order_id:string|null;invoice_date:string;status:string}>('select vendor_id,project_id,sales_order_id,booking_id,service_order_id,invoice_date,status from vendor_invoices where id=$1 for update',[invoiceId])
  const [valid]=await tx.query(`select 1 from company_expenses where id=$1 and vendor_id=$2 and incurred_on<=$3`,[id,v?.vendor_id ?? '',v?.invoice_date ?? '1900-01-01'])
  if (!v || !valid || v.project_id || v.sales_order_id || v.booking_id || v.service_order_id || !['submitted','under_review'].includes(v.status)) throw errors.validation({vendorInvoiceId:['Pilih invoice kantor asli dari vendor yang sama, belum disetujui, dengan tanggal tidak sebelum biaya terjadi.']})
  if ((await tx.query(`select 1 from company_expense_invoice_links l join vendor_invoices v on v.id=l.vendor_invoice_id
    where (l.expense_id=$1 and v.status not in ('void','rejected')) or l.vendor_invoice_id=$2`,[id,invoiceId])).length) throw errors.conflict('Biaya atau invoice ini sudah ditautkan. Batalkan invoice asal dahulu untuk koreksi.')
  await tx.query('insert into company_expense_invoice_links(vendor_invoice_id,expense_id,created_by) values ($1,$2,$3)',[invoiceId,id,actor.userId])
  await reviewVendorInvoice(tx,actor,invoiceId,{action:'approve',matchStatus:'matched',note:`Biaya kantor ${id}`},requestId)
  await recordAudit(tx,{action:'finance.company_expense_invoice_matched',actorUserId:actor.userId,entityType:'company_expense',entityId:id,requestId,after:{vendorInvoiceId:invoiceId}})
  return {id,vendorInvoiceId:invoiceId}
}
export async function voidCompanyExpense(tx: Queryable,actor: Actor,id: string,reasonInput: string,requestId: string) {
  await getBook(tx,true)
  const reason=validateReason(reasonInput), date=todayBusinessDate()
  const [e]=await tx.query<{status:string}>('select status from company_expenses where id=$1 for update',[id])
  if (!e) throw errors.notFound('Biaya perusahaan')
  if (e.status!=='recorded') throw errors.conflict('Biaya sudah dibatalkan.')
  if ((await tx.query(`select 1 from company_expense_invoice_links l join vendor_invoices v on v.id=l.vendor_invoice_id
    where l.expense_id=$1 and v.status not in ('void','rejected')`,[id])).length) throw errors.validation({reason:['Batalkan invoice yang terkait terlebih dahulu.']})
  await tx.query("update company_expenses set status='void',void_reason=$2,voided_on=$3,voided_by=$4 where id=$1",[id,reason,date,actor.userId])
  await postCompanyExpense(tx,actor,id,requestId,date,reason)
  await recordAudit(tx,{action:'finance.company_expense_voided',actorUserId:actor.userId,entityType:'company_expense',entityId:id,requestId,reason})
  return {id}
}
export async function companyExpenseWorkspace(tx: Queryable,query:{cursor?:string;limit?:string}) {
  const {limit,after}=parsePageQuery(query)
  const rows=await tx.query<{id:string;vendor_id:string;name:string;description:string;category:string;amount_minor:string;incurred_on:string;due_date:string;basis:string;status:string;invoice_id:string|null}>(`select e.*,v.name,
    (select l.vendor_invoice_id from company_expense_invoice_links l join vendor_invoices i on i.id=l.vendor_invoice_id
      where l.expense_id=e.id and i.status not in ('void','rejected') limit 1) as invoice_id
    from company_expenses e join vendors v on v.id=e.vendor_id where ($1::text is null or e.id>$1) order by e.id limit $2`,[after,limit+1])
  const schedules=await tx.query<{id:string;vendor_id:string;name:string;description:string;amount_minor:string;starts_on:string;months:number;due_day:number;stops_on:string|null}>(
    'select s.*,v.name from company_expense_schedules s join vendors v on v.id=s.vendor_id order by s.id limit 101')
  const invoices=await tx.query<{id:string;vendor_id:string;vendor_invoice_number:string;total_minor:string;invoice_date:string}>(`select id,vendor_id,vendor_invoice_number,total_minor,invoice_date from vendor_invoices
    where status in ('submitted','under_review') and project_id is null and sales_order_id is null and booking_id is null and service_order_id is null order by id limit 100`)
  return {...paginate(rows.map(e=>({id:e.id,vendorId:e.vendor_id,vendorName:e.name,description:e.description,category:e.category,amountMinor:e.amount_minor,
    incurredOn:e.incurred_on,dueDate:e.due_date,basis:e.basis,status:e.status,invoiceId:e.invoice_id})),limit),
    schedules:schedules.slice(0,100).map(s=>({id:s.id,vendorId:s.vendor_id,vendorName:s.name,description:s.description,amountMinor:s.amount_minor,startMonth:s.starts_on.slice(0,7),months:s.months,dueDay:s.due_day,stopsOn:s.stops_on})),
    schedulesTruncated:schedules.length>100, invoices:invoices.map(i=>({id:i.id,vendorId:i.vendor_id,number:i.vendor_invoice_number,amountMinor:i.total_minor,invoiceDate:i.invoice_date}))}
}
