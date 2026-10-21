import type {Actor} from '../../auth/rbac'
import type {Queryable} from '../../db/client'
import type {AppEnv} from '../../config/env'
import {AppError,errors} from '../../http/errors'
import {recordAudit} from '../../shared/audit'
import {nextId} from '../../shared/ids'
import {getBook} from './setup'
import {validatePolicySettings} from './policy-settings'

/** Owner can test an explicit proposal without SQL. This command cannot validate a production policy. */
export async function rehearseDraftPolicy(tx:Queryable,actor:Actor,id:string,input:{reason:string;confirm:boolean},requestId:string,appEnv:AppEnv){
  const book=await getBook(tx,true)
  if(!book)throw errors.notFound('Profil accounting')
  if(book.purpose!=='rehearsal' || appEnv==='production')throw new AppError(422,'ACCOUNTING_REVIEW_REQUIRED','Uji kebijakan hanya pada buku rehearsal terisolasi. Kebijakan produksi tidak diubah.')
  if(input.confirm!==true || input.reason.trim().length<5 || input.reason.trim().length>500)throw errors.validation({confirm:['Konfirmasi fixture terisolasi dan tuliskan alasan 5–500 karakter.']})
  const [p]=await tx.query<Record<string,any>>('select * from accounting_policies where id=$1 and book_id=$2',[id,book.id])
  if(!p)throw errors.notFound('Usulan kebijakan')
  const [last]=await tx.query<{version:number}>('select max(version)::integer as version from accounting_policies where book_id=$1 and source_kind=$2',[book.id,p.source_kind])
  if(p.validation_status!=='draft' || p.version!==last!.version)throw errors.conflict('Hanya usulan terbaru yang belum diuji dapat dijadikan fixture. Muat ulang atau buat revisi baru.')
  if((await tx.query('select 1 from accounting_policy_rehearsals where draft_policy_id=$1',[id])).length)throw errors.conflict('Usulan ini sudah mempunyai versi fixture.')
  if([p.principal_agent,p.recognition,p.tax_treatment].some(v=>!v || v==='unknown'))throw errors.validation({policy:['Lengkapi peran, pengakuan dan perlakuan pajak fixture secara eksplisit. Unknown tidak berarti nol.']})
  await validatePolicySettings(tx,book.id,p.source_kind,p.settings)
  let ready=true
  if(['customer_billing','fulfillment','refund'].includes(p.source_kind))ready=p.principal_agent==='principal'
  if(p.source_kind==='customer_billing')ready=ready && p.recognition==='fulfillment' && p.settings.billingRight==='unconditional'
  if(p.source_kind==='fulfillment')ready=ready && p.recognition==='fulfillment'
  if(['vendor_billing','supplier_fulfillment'].includes(p.source_kind))ready=p.recognition==='supplier-fulfillment' && p.settings.costMatching==='receipt-links' && (p.source_kind!=='vendor_billing' || p.settings.invoiceTreatment==='prepaid')
  if(['manual_cash','company_expense'].includes(p.source_kind))ready=Object.keys(p.settings.classifications ?? {}).length>0
  if(p.source_kind==='prepaid_opex')ready=p.settings.method==='equal-months'
  if(p.source_kind==='asset')ready=p.settings.method==='straight-line'
  // Owner lending needs the genuine loan register/terms/repayments, not an owner-funds cash label alone.
  if(p.source_kind==='owner_funds')ready=['capital','owner-funds'].includes(p.settings.contributionRole) && ['capital','owner-funds'].includes(p.settings.withdrawalRole)
  if(['tax','commission'].includes(p.source_kind))ready=false
  if(!ready)throw errors.validation({policy:['Metode sumber fixture belum lengkap atau jenis ini belum mempunyai integrasi yang siap diuji. Periksa aturan khusus sumber; tidak ada fallback kebijakan produksi.']})
  const resultId=await nextId(tx,'APL-'),version=last!.version+1
  await tx.query(`insert into accounting_policies(id,book_id,source_kind,version,effective_from,effective_to,principal_agent,recognition,tax_treatment,validation_status,settings,rationale,created_by)
    select $1,book_id,source_kind,$2,effective_from,effective_to,principal_agent,recognition,tax_treatment,'test-only',settings,rationale,$3 from accounting_policies where id=$4`,[resultId,version,actor.userId,id])
  await tx.query('insert into accounting_policy_rehearsals(draft_policy_id,result_policy_id,reason,tested_by) values($1,$2,$3,$4)',[id,resultId,input.reason.trim(),actor.userId])
  await recordAudit(tx,{action:'finance.accounting_policy_rehearsed',actorUserId:actor.userId,entityType:'accounting_policy',entityId:resultId,requestId,reason:input.reason.trim(),after:{draftPolicyId:id,version,validationStatus:'test-only',purpose:'rehearsal'}})
  return {id:resultId,version,validationStatus:'test-only' as const,draftPolicyId:id}
}
