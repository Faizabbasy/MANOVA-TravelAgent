import type {Actor} from '../../auth/rbac'
import type {Queryable} from '../../db/client'
import {errors} from '../../http/errors'
import {recordAudit} from '../../shared/audit'
import {nextId} from '../../shared/ids'
import {isIsoDate} from '../../shared/dates'
import {getBook} from '../accounting/setup'
import {parseMovementAmount} from './common'
import {validateReason} from './postings'
import {assertBillable} from './refunds'
import {assertOrderBillable} from './order-scope'

export interface ChangeBillingInput {mode:string;basis:string;reason:string;allocations:{salesOrderId?:string;amountMinor:string;dueDate:string}[]}
type Plan=Record<string,any>&{id:string;change_request_id:string;mode:string;status:string;total_minor:string}
type Allocation=Record<string,any>&{id:string;project_id:string;sales_order_id:string|null;party_id:string;amount_minor:string;due_date:string;adjusts_invoice_id:string|null;invoice_id:string|null}

export async function changeBillingStatus(tx:Queryable,changeRequestId:string) {
  const [cr]=await tx.query<{id:string;status:string;project_id:string;commercial:string;fee:string}>(`select id,status,project_id,coalesce(commercial_impact_minor,0) as commercial,coalesce(cancellation_fee_minor,0) as fee from change_requests where id=$1`,[changeRequestId])
  if (!cr) throw errors.notFound('Change request')
  const plans=await tx.query<Plan>('select * from change_billing_plans where change_request_id=$1 order by created_at,id',[changeRequestId])
  const allocations=await tx.query<Allocation>(`select a.*,p.name as party_name,i.status as invoice_status from change_billing_allocations a
    join change_billing_plans b on b.id=a.plan_id join parties p on p.id=a.party_id left join customer_invoices i on i.id=a.invoice_id
    where b.change_request_id=$1 order by a.id`,[changeRequestId])
  const targets=await tx.query<{sales_order_id:string|null;party_name:string;contract_minor:string|null}>(`select null::text as sales_order_id,pa.name as party_name,p.contract_value_minor as contract_minor
    from projects p join parties pa on pa.id=p.party_id where p.id=$1
    union all select s.id,pa.name,s.price_minor from sales_order_refs s join parties pa on pa.id=s.party_id where s.project_id=$1 and s.status<>'cancelled' order by sales_order_id nulls first`,[cr.project_id])
  return {changeRequestId,projectId:cr.project_id,changeStatus:cr.status,commercialMinor:cr.commercial,feeMinor:cr.fee,
    targets:targets.map(t=>({salesOrderId:t.sales_order_id,partyName:t.party_name,contractMinor:t.contract_minor})),
    needsDecision:!plans.some(p=>p.status!=='void') && (BigInt(cr.commercial)>0n || BigInt(cr.fee)>0n),
    plans:plans.map(p=>({id:p.id,mode:p.mode,basis:p.basis,status:p.status,totalMinor:p.total_minor,reason:p.reason,voidReason:p.void_reason ?? null,
      allocations:allocations.filter(a=>a.plan_id===p.id).map(a=>({id:a.id,salesOrderId:a.sales_order_id,partyId:a.party_id,partyName:a.party_name,amountMinor:a.amount_minor,dueDate:a.due_date,invoiceId:a.invoice_id,invoiceStatus:a.invoice_status ?? null}))}))}
}

export async function createChangeBillingPlan(tx:Queryable,actor:Actor,changeRequestId:string,input:ChangeBillingInput,requestId:string) {
  await getBook(tx,true)
  const [cr]=await tx.query<{project_id:string;status:string;commercial:string;fee:string}>(`select project_id,status,coalesce(commercial_impact_minor,0) as commercial,coalesce(cancellation_fee_minor,0) as fee from change_requests where id=$1 for update`,[changeRequestId])
  if (!cr) throw errors.notFound('Change request')
  if (['rejected','cancelled'].includes(cr.status)) throw errors.conflict('Perubahan ini sudah ditolak atau dibatalkan.')
  if ((await tx.query("select 1 from change_billing_plans where change_request_id=$1 and status<>'void'",[changeRequestId])).length) throw errors.conflict('Rencana penagihan sudah ada. Buka sumbernya; jangan membuat tagihan kedua.')
  const reason=validateReason(input.reason)
  const commercial=BigInt(cr.commercial),fee=BigInt(cr.fee)
  let total:bigint
  if (input.mode==='no-charge' && input.basis==='none') total=0n
  else if (input.mode==='charge' && ['commercial','fee','separate'].includes(input.basis)) total=input.basis==='commercial' ? commercial : input.basis==='fee' ? fee : commercial+fee
  else throw errors.validation({basis:['Pilih tidak ditagihkan, total komersial, fee saja, atau dua komponen yang terpisah secara eksplisit.']})
  if (input.mode==='charge') parseMovementAmount(total.toString(),'totalMinor')
  if (!Array.isArray(input.allocations) || input.allocations.length>100 || (input.mode==='no-charge' && input.allocations.length) || (input.mode==='charge' && !input.allocations.length)) throw errors.validation({allocations:['Isi pembagian tagihan untuk mode ditagihkan; tidak ada pembagian untuk mode tanpa tagihan.']})
  const [project]=await tx.query<{party_id:string;contract_value_minor:string|null}>('select party_id,contract_value_minor from projects where id=$1 for update',[cr.project_id])
  if (!project) throw errors.notFound('Project')
  if(input.mode==='charge') await assertBillable(tx,cr.project_id,null)
  const prepared:Omit<Allocation,'id'>[]=[]
  const seen=new Set<string>();let allocated=0n
  for(const row of input.allocations) {
    const scope=row.salesOrderId ?? 'project'
    if (seen.has(scope)) throw errors.validation({allocations:['Satu target hanya boleh sekali dalam rencana.']})
    seen.add(scope)
    const amount=parseMovementAmount(row.amountMinor,'allocations.amountMinor'),dueDate=row.dueDate
    if (!isIsoDate(dueDate)) throw errors.validation({dueDate:['Tanggal jatuh tempo harus YYYY-MM-DD.']})
    let party=project.party_id
    if (row.salesOrderId) {
      await assertOrderBillable(tx,row.salesOrderId)
      const [o]=await tx.query<{project_id:string|null;party_id:string}>('select project_id,party_id from sales_order_refs where id=$1 for update',[row.salesOrderId])
      if (!o || o.project_id!==cr.project_id) throw errors.validation({salesOrderId:['Order bukan peserta project perubahan ini.']})
      party=o.party_id
    } else if (project.contract_value_minor===null) throw errors.validation({allocations:['Nilai kontrak project belum diketahui. Lengkapi kontrak sumber sebelum menambah hak tagih.']})
    const [base]=await tx.query<{id:string}>(`select id from customer_invoices where project_id=$1 and party_id=$2 and sales_order_id is not distinct from $3 and status='issued' and invoice_type<>'debit_note' order by issue_date desc,id desc limit 1`,[cr.project_id,party,row.salesOrderId ?? null])
    if (row.salesOrderId && !base) throw errors.validation({salesOrderId:['Invoice dasar peserta harus sudah terbit sebelum membuat tambahan tagihan.']})
    allocated+=amount
    prepared.push({plan_id:'',project_id:cr.project_id,sales_order_id:row.salesOrderId ?? null,party_id:party,amount_minor:amount.toString(),due_date:dueDate,adjusts_invoice_id:base?.id ?? null,invoice_id:null})
  }
  if (allocated!==total) throw errors.validation({allocations:[`Total pembagian harus sama dengan nilai sumber yang dipilih (${total}).`]})
  const id=await nextId(tx,'CBP-')
  await tx.query(`insert into change_billing_plans(id,change_request_id,mode,basis,commercial_minor,fee_minor,total_minor,reason,created_by) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,[id,changeRequestId,input.mode,input.basis,commercial.toString(),fee.toString(),total.toString(),reason,actor.userId])
  for(const a of prepared) await tx.query(`insert into change_billing_allocations(id,plan_id,project_id,sales_order_id,party_id,amount_minor,due_date,adjusts_invoice_id) values ($1,$2,$3,$4,$5,$6,$7,$8)`,[await nextId(tx,'CBI-'),id,a.project_id,a.sales_order_id,a.party_id,a.amount_minor,a.due_date,a.adjusts_invoice_id])
  await recordAudit(tx,{action:'finance.change_billing_configured',actorUserId:actor.userId,entityType:'change_billing_plan',entityId:id,requestId,reason,after:{changeRequestId,mode:input.mode,basis:input.basis,totalMinor:total.toString()}})
  if (['approved','implemented'].includes(cr.status)) await applyChangeBilling(tx,actor,changeRequestId,requestId)
  return changeBillingStatus(tx,changeRequestId)
}

/** Called by BOTH internal/client approval handlers and configuration after approval; source identity makes it once-only. */
export async function applyChangeBilling(tx:Queryable,actor:Actor,changeRequestId:string,requestId:string) {
  const [p]=await tx.query<Plan>("select * from change_billing_plans where change_request_id=$1 and status<>'void' for update",[changeRequestId])
  if (!p || p.status==='applied') return
  const [cr]=await tx.query<{status:string;after_summary:string}>('select status,after_summary from change_requests where id=$1 for update',[changeRequestId])
  if (!cr || !['approved','implemented'].includes(cr.status)) return
  const rows=await tx.query<Allocation>('select * from change_billing_allocations where plan_id=$1 order by id',[p.id])
  for(const a of rows) {
    await assertOrderBillable(tx,a.sales_order_id)
    await assertBillable(tx,a.project_id,null)
    if(a.adjusts_invoice_id && !(await tx.query("select 1 from customer_invoices where id=$1 and status='issued'",[a.adjusts_invoice_id])).length) throw errors.conflict('Invoice dasar berubah; revisi rencana penagihan sebelum menyetujui perubahan.')
    const [before]=await tx.query<{n:string}>(a.sales_order_id ? 'select price_minor as n from sales_order_refs where id=$1 for update' : 'select contract_value_minor as n from projects where id=$1 for update',[a.sales_order_id ?? a.project_id])
    if (!before?.n) throw errors.conflict('Nilai kontrak sumber belum diketahui.')
    const next=BigInt(before.n)+BigInt(a.amount_minor)
    if (next>1000000000000000n) throw errors.validation({totalMinor:['Nilai kontrak hasil perubahan melebihi batas.']})
    await tx.query(a.sales_order_id ? 'update sales_order_refs set price_minor=$2,updated_at=now(),status_changed_at=now() where id=$1' : 'update projects set contract_value_minor=$2,updated_at=now() where id=$1',[a.sales_order_id ?? a.project_id,next.toString()])
    await tx.query(`insert into change_billing_amendments(allocation_id,kind,before_minor,after_minor,created_by) values ($1,'apply',$2,$3,$4)`,[a.id,before.n,next.toString(),actor.userId])
    const [invoice]=await tx.query<{id:string}>(`insert into customer_invoices(project_id,party_id,sales_order_id,invoice_type,adjusts_invoice_id,total_minor,due_date,notes,created_by,change_billing_allocation_id)
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning id`,[a.project_id,a.party_id,a.sales_order_id,a.adjusts_invoice_id ? 'debit_note' : 'other',a.adjusts_invoice_id,a.amount_minor,a.due_date,`Perubahan ${changeRequestId}: ${cr.after_summary}`.slice(0,1000),actor.userId,a.id])
    await tx.query('insert into customer_invoice_lines(invoice_id,position,description,amount_minor) values ($1,1,$2,$3)',[invoice!.id,`Perubahan ${changeRequestId}: ${cr.after_summary}`.slice(0,500),a.amount_minor])
    await tx.query('update change_billing_allocations set invoice_id=$2 where id=$1',[a.id,invoice!.id])
  }
  await tx.query("update change_billing_plans set status='applied',applied_at=now() where id=$1",[p.id])
  await recordAudit(tx,{action:'finance.change_billing_drafted',actorUserId:actor.userId,entityType:'change_billing_plan',entityId:p.id,requestId,after:{changeRequestId,invoiceCount:rows.length,totalMinor:p.total_minor}})
}

export async function voidChangeBillingPlan(tx:Queryable,actor:Actor,id:string,reasonInput:string,requestId:string) {
  await getBook(tx,true)
  const reason=validateReason(reasonInput)
  const [ref]=await tx.query<{change_request_id:string}>('select change_request_id from change_billing_plans where id=$1',[id])
  if (!ref) throw errors.notFound('Rencana penagihan')
  await tx.query('select id from change_requests where id=$1 for update',[ref.change_request_id])
  const [p]=await tx.query<Plan>('select * from change_billing_plans where id=$1 for update',[id])
  if (!p) throw errors.notFound('Rencana penagihan')
  if (p.status==='void') throw errors.conflict('Rencana sudah dibatalkan.')
  const rows=await tx.query<Allocation>('select * from change_billing_allocations where plan_id=$1 order by id',[id])
  for(const a of rows) if(a.invoice_id && (await tx.query("select 1 from customer_invoices where id=$1 and status='issued'",[a.invoice_id])).length) throw errors.conflict('Void invoice sumber terlebih dahulu; pembayaran/credit note mengikuti kontrol Finance existing.')
  await tx.query("update change_billing_plans set status='void',void_reason=$2,voided_by=$3 where id=$1",[id,reason,actor.userId])
  for(const a of rows) {
    if (p.status==='applied') {
      const [current]=await tx.query<{n:string}>(a.sales_order_id ? 'select price_minor as n from sales_order_refs where id=$1 for update' : 'select contract_value_minor as n from projects where id=$1 for update',[a.sales_order_id ?? a.project_id])
      const next=BigInt(current!.n)-BigInt(a.amount_minor)
      const [used]=await tx.query<{n:string}>(`select coalesce(sum(amount_minor),0) as n from service_fulfillments where side='customer' and status='recorded' and project_id=$1 and party_id=$2 and sales_order_id is not distinct from $3`,[a.project_id,a.party_id,a.sales_order_id])
      if (next<=0n || BigInt(used!.n)>next) throw errors.conflict('Hak kontrak sudah dipenuhi. Koreksi pemenuhan sumber sebelum membatalkan tambahan kontrak.')
      await tx.query(a.sales_order_id ? 'update sales_order_refs set price_minor=$2,updated_at=now(),status_changed_at=now() where id=$1' : 'update projects set contract_value_minor=$2,updated_at=now() where id=$1',[a.sales_order_id ?? a.project_id,next.toString()])
      await tx.query(`insert into change_billing_amendments(allocation_id,kind,before_minor,after_minor,created_by) values ($1,'reverse',$2,$3,$4)`,[a.id,current!.n,next.toString(),actor.userId])
    }
    if(a.invoice_id) await tx.query("delete from customer_invoices where id=$1 and status='draft'",[a.invoice_id])
  }
  await recordAudit(tx,{action:'finance.change_billing_voided',actorUserId:actor.userId,entityType:'change_billing_plan',entityId:id,requestId,reason,after:{changeRequestId:p.change_request_id}})
  return changeBillingStatus(tx,p.change_request_id)
}
