import {Elysia,t} from 'elysia'
import {resolve} from 'node:path'
import type {AppDeps} from '../app-deps'
import type {AuthContext} from '../auth/context'
import {AppError,errors} from '../http/errors'
import {assertIdParam,ok,requestIdOf} from '../http/envelope'
import {requireIdempotencyKey,withIdempotency} from '../shared/idempotency'
import {nextId} from '../shared/ids'
import {recordAudit} from '../shared/audit'
import {DirectoryBlobStore,MemoryBlobStore,type BlobStore} from './blob-store'
import {resolveFileSource} from './scope'
import {sha256,validateFile} from './validation'

type FileRow={id:string;source_type:string;source_id:string;owner_party_id:string|null;visibility:string;storage_key:string;sha256:string;mime:string;size_bytes:number;original_name:string;uploaded_by:string;created_at:Date}
const dto=(r:FileRow)=>({id:r.id,sourceType:r.source_type,sourceId:r.source_id,visibility:r.visibility,name:r.original_name,mime:r.mime,sizeBytes:r.size_bytes,sha256:r.sha256,uploadedBy:r.uploaded_by,uploadedAt:r.created_at.toISOString()})
export function privateFileRoutes(deps:AppDeps,auth:AuthContext){
  const {db,config}=deps
  const storage:BlobStore|null=deps.blobs ?? (config.appEnv==='test' ? new MemoryBlobStore() : config.privateFilesPath ? new DirectoryBlobStore(config.privateFilesPath) : config.appEnv==='development' ? new DirectoryBlobStore(resolve('.data/private-blobs')) : null)
  function store(){if(!storage)throw new AppError(503,'PRIVATE_STORAGE_UNCONFIGURED','Penyimpanan file privat belum dikonfigurasi.');return storage}
  return new Elysia({prefix:'/api/v1/private-files'})
    .get('',async({request,query})=>{
      const actor=await auth.requireActor(request)
      await resolveFileSource(db,actor,query.sourceType,query.sourceId)
      // Reuse original evidence through existing invoice/proof/allocation links; never copy the blob for cash.
      const rows=await db.query<FileRow>(`select * from private_files f where ((source_type=$1 and source_id=$2)
        or ($1='customer_invoice' and source_type='payment_proof' and source_id in(select id from payment_proofs where customer_invoice_id=$2))
        or ($1='customer_invoice' and source_type='change-request' and source_id in(select p.change_request_id from customer_invoices i join change_billing_allocations a on a.id=i.change_billing_allocation_id join change_billing_plans p on p.id=a.plan_id where i.id=$2))
        or ($1='financial_transaction' and source_type in ('customer_invoice','vendor_invoice') and source_id in(select a.target_id from payment_allocations a where a.transaction_id=$2 and a.target_type=f.source_type))
        or ($1='financial_transaction' and source_type='payment_proof' and source_id in(select pp.id from payment_proofs pp join payment_allocations a on a.target_type='customer_invoice' and a.target_id=pp.customer_invoice_id where a.transaction_id=$2))) and
        ($3::text is null or (visibility='source-party' and owner_party_id=$3)) order by created_at desc,id desc limit 101`,[query.sourceType,query.sourceId,actor.role==='client' ? actor.partyId : null])
      return ok(request,{items:rows.slice(0,100).map(dto),truncated:rows.length>100})
    },{query:t.Object({sourceType:t.String(),sourceId:t.String()})})
    .post('',async({request,body,set})=>{
      const actor=await auth.requireActor(request)
      const key=requireIdempotencyKey(request)
      await resolveFileSource(db,actor,body.sourceType,body.sourceId,true)
      const visibility=actor.role==='client' ? 'source-party' : body.visibility ?? 'internal'
      if(!['internal','source-party'].includes(visibility))throw errors.validation({visibility:['Pilih akses internal atau customer sumber.']})
      const bytes=new Uint8Array(await body.file.arrayBuffer())
      // Keep the caller's declared MIME as a text field: Bun may normalise a multipart File.type by sniffing.
      const file=validateFile(bytes,body.declaredMime,body.file.name)
      let uncommittedKey:string|null=null
      try{
        const r=await withIdempotency(db,{actorUserId:actor.userId,route:'POST /private-files',key,body:{sourceType:body.sourceType,sourceId:body.sourceId,visibility,...file}},async tx=>{
          const source=await resolveFileSource(tx,actor,body.sourceType,body.sourceId,true)
          if(visibility==='source-party' && !source.partyId)throw errors.validation({visibility:['Sumber ini hanya menyimpan bukti internal.']})
          await tx.query('select pg_advisory_xact_lock(hashtext($1))',[`private-file:${source.type}:${source.id}:${file.sha256}`])
          const [existing]=await tx.query<FileRow>('select * from private_files where source_type=$1 and source_id=$2 and sha256=$3',[source.type,source.id,file.sha256])
          if(existing){
            if(actor.role==='client' && (existing.visibility!=='source-party' || existing.owner_party_id!==actor.partyId))throw errors.conflict('Bukti yang sama sudah tertaut secara internal. Hubungi pengelola sumber.')
            return dto(existing)
          }
          const blobKey=crypto.randomUUID()
          await store().put(blobKey,bytes);uncommittedKey=blobKey
          const [row]=await tx.query<FileRow>(`insert into private_files(id,source_type,source_id,owner_party_id,visibility,storage_key,sha256,mime,size_bytes,original_name,uploaded_by)
            values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning *`,[await nextId(tx,'PFL-'),source.type,source.id,source.partyId,visibility,blobKey,file.sha256,file.mime,file.sizeBytes,file.originalName,actor.userId])
          await recordAudit(tx,{action:'private_file.uploaded',actorUserId:actor.userId,entityType:source.type,entityId:source.id,requestId:requestIdOf(request),after:{fileId:row!.id,sha256:file.sha256,sizeBytes:file.sizeBytes,visibility}})
          return dto(row!)
        })
        uncommittedKey=null
        if(r.replayed)set.headers['idempotent-replayed']='true'
        set.status=201;return ok(request,r.data)
      }catch(e){
        // An unknown commit outcome must retain the bytes. Only remove a definitely unreferenced object.
        if(uncommittedKey)try{
          if(!(await db.query('select 1 from private_files where storage_key=$1',[uncommittedKey])).length)await store().removeUncommitted(uncommittedKey)
        }catch{/* Retain orphan for reconciliation if the DB/store cannot confirm cleanup. */}
        throw e
      }
    },{body:t.Object({sourceType:t.String(),sourceId:t.String(),declaredMime:t.String(),visibility:t.Optional(t.String()),file:t.File({maxSize:'10m'})})})
    .get('/:id/content',async({request,params})=>{
      const actor=await auth.requireActor(request),id=assertIdParam(params.id,'File')
      const [row]=await db.query<FileRow>('select * from private_files where id=$1',[id])
      if(!row)throw errors.notFound('File')
      await resolveFileSource(db,actor,row.source_type,row.source_id)
      if(actor.role==='client' && (row.visibility!=='source-party' || row.owner_party_id!==actor.partyId))throw errors.notFound('File')
      const bytes=await store().get(row.storage_key)
      if(!bytes || bytes.length!==row.size_bytes || sha256(bytes)!==row.sha256)throw new AppError(503,'PRIVATE_FILE_INTEGRITY','File tidak tersedia atau checksum tidak cocok. Pulihkan file asli dari backup; metadata tidak diubah.')
      await db.transaction(tx=>recordAudit(tx,{action:'private_file.downloaded',actorUserId:actor.userId,entityType:row.source_type,entityId:row.source_id,requestId:requestIdOf(request),after:{fileId:id}}))
      return new Response(bytes,{headers:{'content-type':row.mime,'content-disposition':`attachment; filename*=UTF-8''${encodeURIComponent(row.original_name)}`,'x-content-type-options':'nosniff','cache-control':'private, no-store','content-length':String(bytes.length)}})
    })
}
