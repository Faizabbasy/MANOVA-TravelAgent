import {hasCapability,hasModuleLevel,type Actor} from '../auth/rbac'
import type {Queryable} from '../db/client'
import {errors} from '../http/errors'
import {ID_PATTERN} from '../http/envelope'
import {assertStaffCollab,resolveCollabTarget} from '../modules/core/collab'

export const FILE_SOURCES=['financial_transaction','customer_invoice','vendor_invoice','payment_proof','refund','supplier_claim','expense_claim','company_expense','prepaid_expense','payroll_run','document','traveler','change-request','quotation','travel-request'] as const
export type FileSource=typeof FILE_SOURCES[number]
const FINANCE_TABLES:Partial<Record<FileSource,string>>={financial_transaction:'financial_transactions',customer_invoice:'customer_invoices',vendor_invoice:'vendor_invoices',refund:'refunds',supplier_claim:'supplier_claims',expense_claim:'employee_expense_claims',company_expense:'company_expenses',prepaid_expense:'prepaid_expenses',payroll_run:'payroll_runs'}
export async function resolveFileSource(tx:Queryable,actor:Actor,type:string,id:string,write=false):Promise<{type:FileSource;id:string;partyId:string|null}> {
  if(!(FILE_SOURCES as readonly string[]).includes(type))throw errors.validation({sourceType:['Jenis sumber file tidak didukung.']})
  if(!ID_PATTERN.test(id))throw errors.notFound('Sumber file')
  const source=type as FileSource
  if(actor.role==='vendor')throw errors.forbidden()
  const table=FINANCE_TABLES[source]
  if(table){
    if(!hasCapability(actor.role,'finance.view-cash') || (write && !hasCapability(actor.role,'finance.post-cash')))throw errors.forbidden()
    if(!(await tx.query(`select 1 from ${table} where id=$1`,[id])).length)throw errors.notFound('Sumber file')
    if(write && source==='customer_invoice' && (await tx.query("select 1 from customer_invoices where id=$1 and status='draft'",[id])).length)throw errors.validation({sourceId:['Lampirkan bukti draft pada sumber CR/dokumen. Bukti invoice memakai invoice yang sudah terbit.']})
    return {type:source,id,partyId:null} // Internal financial evidence is never shared implicitly.
  }
  if(source==='payment_proof'){
    if(actor.role!=='client' && !hasCapability(actor.role,'finance.view-cash'))throw errors.forbidden()
    const [p]=await tx.query<{party_id:string}>('select party_id from payment_proofs where id=$1',[id])
    if(!p || (actor.role==='client' && p.party_id!==actor.partyId))throw errors.notFound('Sumber file')
    return {type:source,id,partyId:p.party_id}
  }
  if(['change-request','quotation','travel-request','document'].includes(source)){
    if(actor.role!=='client')assertStaffCollab(actor,source,write)
    const target=await resolveCollabTarget(tx,source,id,actor.role==='client' ? actor.partyId! : undefined)
    if(source==='document'){
      // An invoice attachment must not become an alternate financial-data route for Admin.
      const [d]=await tx.query<{entity_type:string}>('select entity_type from documents where id=$1',[id])
      if(d?.entity_type==='invoice' && actor.role!=='client' && !hasCapability(actor.role,'finance.view-cash'))throw errors.forbidden()
    }
    return {type:source,id,partyId:target.partyId}
  }
  if(source==='traveler'){
    if(actor.role!=='client' && !hasModuleLevel(actor.role,'operations',write ? 'MANAGE' : 'VIEW'))throw errors.forbidden()
    const [p]=await tx.query<{party_id:string|null}>(`select coalesce(t.party_id,s.party_id,p.party_id) as party_id from travelers t left join sales_order_refs s on s.id=t.sales_order_id left join projects p on p.id=t.project_id where t.id=$1`,[id])
    if(!p || (actor.role==='client' && p.party_id!==actor.partyId))throw errors.notFound('Sumber file')
    return {type:source,id,partyId:p.party_id}
  }
  throw errors.notFound('Sumber file')
}
