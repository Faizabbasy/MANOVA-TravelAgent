import {afterAll,beforeAll,describe,expect,test} from 'bun:test'
import {ALLOWED_ORIGIN,DEMO,makeTestApp,type TestApp} from './helpers'
import {MemoryBlobStore} from '../src/files/blob-store'
import {validateFile,sha256} from '../src/files/validation'
import {migrateDown} from '../src/db/migrator'
const PDF=new TextEncoder().encode('%PDF-1.4\nTEST_ONLY evidence\n%%EOF')
describe('private evidence on real business sources',()=>{
  const blobs=new MemoryBlobStore()
  let t:TestApp,finance:string,admin:string,client:string,invoice:string,fileId:string,proofId:string
  const call=(method:string,path:string,body?:unknown,cookie=finance)=>t.call(method,`/api/v1${path}`,{cookie,body,headers:{'idempotency-key':crypto.randomUUID()}})
  const post=async(path:string,body:unknown,cookie=finance)=>{const r=await call('POST',path,body,cookie);expect(r.status,r.text).toBeLessThan(300);return r.json.data}
  async function upload(type:string,id:string,options:{bytes?:Uint8Array;mime?:string;cookie?:string;key?:string;visibility?:string;name?:string}={}){
    const body=new FormData();body.set('sourceType',type);body.set('sourceId',id);body.set('declaredMime',options.mime ?? 'application/pdf');body.set('file',new File([options.bytes ?? PDF],options.name ?? 'bukti.pdf',{type:options.mime ?? 'application/pdf'}));if(options.visibility)body.set('visibility',options.visibility)
    const r=await t.app.handle(new Request('http://localhost/api/v1/private-files',{method:'POST',headers:{cookie:options.cookie ?? finance,origin:ALLOWED_ORIGIN,'idempotency-key':options.key ?? crypto.randomUUID()},body}))
    return {status:r.status,json:await r.json() as any}
  }
  beforeAll(async()=>{
    t=await makeTestApp({blobs});finance=await t.login(DEMO.finance);admin=await t.login(DEMO.admin);client=await t.login(DEMO.client)
    invoice=(await post('/finance/customer-invoices',{projectId:'PRJ-201',invoiceType:'dp',dueDate:'2026-12-01',lines:[{description:'TEST_ONLY source',amountMinor:'10000000'}]})).id
    await post(`/finance/customer-invoices/${invoice}/issue`,{})
  },60000)
  afterAll(async()=>{await t?.cleanup()})
  test('file bytes, hash and source survive retry without creating money or exposing storage paths',async()=>{
    const key='TEST-private-file-key'
    const r=await upload('customer_invoice',invoice,{key,name:'../invoice.pdf'});expect(r.status,JSON.stringify(r.json)).toBe(201)
    fileId=r.json.data.id;expect(r.json.data).toMatchObject({name:'invoice.pdf',sha256:sha256(PDF),sizeBytes:PDF.length,sourceId:invoice,visibility:'internal'})
    expect(JSON.stringify(r.json)).not.toContain('storage_key')
    expect((await upload('customer_invoice',invoice,{key,name:'../invoice.pdf'})).json.data.id).toBe(fileId)
    expect((await upload('customer_invoice',invoice)).json.data.id).toBe(fileId)
    expect((await upload('customer_invoice',invoice,{key,bytes:new TextEncoder().encode('%PDF-1.4\nOTHER')})).status).toBe(409)
    const r2=await t.app.handle(new Request(`http://localhost/api/v1/private-files/${fileId}/content`,{headers:{cookie:finance}}))
    expect(r2.status).toBe(200);expect(r2.headers.get('content-disposition')).toStartWith('attachment;');expect(r2.headers.get('x-content-type-options')).toBe('nosniff');expect(new Uint8Array(await r2.arrayBuffer())).toEqual(PDF)
    expect((await t.db.query('select count(*) as n from private_files'))[0]!.n).toBe('1')
    expect((await t.db.query('select count(*) as n from financial_transactions'))[0]!.n).toBe('0')
  })
  test('scope, real MIME, limits and append-only source retention are enforced',async()=>{
    expect((await upload('customer_invoice',invoice,{cookie:''})).status).toBe(401)
    expect((await upload('customer_invoice',invoice,{cookie:admin})).status).toBe(403)
    expect((await upload('customer_invoice','MISSING')).status).toBe(404)
    expect((await upload('customer_invoice',invoice,{bytes:new TextEncoder().encode('<html>not a PDF</html>')})).status).toBe(400)
    expect((await upload('customer_invoice',invoice,{mime:'image/png'})).status).toBe(400)
    expect(()=>validateFile(new Uint8Array(10485761),'application/pdf','too-large.pdf')).toThrow()
    const huge=new Uint8Array(10485761);huge.set(PDF)
    expect((await upload('customer_invoice',invoice,{bytes:huge})).status).toBe(400)
    await expect(t.db.query("update private_files set original_name='changed' where id=$1",[fileId])).rejects.toThrow()
    await expect(t.db.query('delete from private_files where id=$1',[fileId])).rejects.toThrow()
    expect((await call('GET',`/private-files/${fileId}/content`,undefined,admin)).status).toBe(403)
  })
  test('client proof upload is scoped, never shares internal evidence implicitly, and does not verify cash',async()=>{
    await post(`/client/invoices/${invoice}/payment-proofs`,{reference:'TEST-FILE',amountMinor:'1000',transferDate:'2026-10-21'},client)
    proofId=(await t.db.query<{id:string}>('select id from payment_proofs where customer_invoice_id=$1',[invoice]))[0]!.id
    const internal=await upload('payment_proof',proofId)
    expect(internal.status).toBe(201)
    expect((await call('GET',`/private-files/${internal.json.data.id}/content`,undefined,client)).status).toBe(404)
    const r=await upload('payment_proof',proofId,{cookie:client,bytes:new TextEncoder().encode('%PDF-1.4\nCLIENT_TEST_ONLY')} )
    expect(r.status,JSON.stringify(r.json)).toBe(201);expect(r.json.data.visibility).toBe('source-party')
    const list=await call('GET',`/private-files?sourceType=payment_proof&sourceId=${proofId}`,undefined,client)
    expect(list.json.data.items).toHaveLength(1)
    await t.db.query("update users set party_id='PTY-006' where id='USR-021'")
    expect((await call('GET',`/private-files/${r.json.data.id}/content`,undefined,client)).status).toBe(404)
    await t.db.query("update users set party_id='PTY-005' where id='USR-021'")
    expect((await t.db.query('select status from payment_proofs where id=$1',[proofId]))[0]!.status).toBe('submitted')
    expect((await t.db.query('select count(*) as n from financial_transactions'))[0]!.n).toBe('0')
  })
  test('missing or corrupt bytes are unavailable, never replaced with a successful empty download',async()=>{
    const [row]=await t.db.query<{storage_key:string}>('select storage_key from private_files where id=$1',[fileId])
    await blobs.removeUncommitted(row!.storage_key)
    expect((await call('GET',`/private-files/${fileId}/content`)).status).toBe(503)
    await blobs.put(row!.storage_key,new TextEncoder().encode('tampered'))
    const bad=await call('GET',`/private-files/${fileId}/content`)
    expect(bad.status).toBe(503);expect(bad.json.error.code).toBe('PRIVATE_FILE_INTEGRITY')
    await blobs.removeUncommitted(row!.storage_key);await blobs.put(row!.storage_key,PDF)
  })
  test('invoice and cash reuse the original proof files through existing allocations without copying blobs',async()=>{
    const before=(await t.db.query('select count(*) as n from private_files'))[0]!.n
    const invoiceFiles=await call('GET',`/private-files?sourceType=customer_invoice&sourceId=${invoice}`)
    expect(invoiceFiles.status,invoiceFiles.text).toBe(200);expect(invoiceFiles.json.data.items).toHaveLength(3)
    await t.db.query(`insert into bank_accounts(id,code,bank_name,holder_name,account_number,opening_status,opening_balance_minor,opening_date,opening_submitted_by,opening_submitted_at,opening_verified_by,opening_verified_at,created_by)
      values ('BA-FILE','FILE','Synthetic','TEST_ONLY','123456','verified',0,'2026-09-01','USR-001',now(),'USR-010',now(),'USR-010')`)
    const receipt=await post('/finance/receipts',{bankAccountId:'BA-FILE',partyId:'PTY-005',projectId:'PRJ-201',amountMinor:'1000',effectiveDate:'2026-10-21',allocations:[{invoiceId:invoice,amountMinor:'1000'}]})
    const files=await call('GET',`/private-files?sourceType=financial_transaction&sourceId=${receipt.transactionId}`)
    expect(files.status,files.text).toBe(200)
    expect(files.json.data.items.map((f:any)=>f.id).sort()).toEqual(invoiceFiles.json.data.items.map((f:any)=>f.id).sort())
    expect((await t.db.query('select count(*) as n from private_files'))[0]!.n).toBe(before)
  })
  test('evidence retains a document source and blocks destructive down migration',async()=>{
    const [d]=await t.db.query<{id:string}>("select id from documents where entity_type<>'invoice' order by id limit 1")
    const uploaded=await upload('document',d!.id,{cookie:admin})
    expect(uploaded.status,JSON.stringify(uploaded.json)).toBe(201)
    await expect(t.db.query('delete from documents where id=$1',[d!.id])).rejects.toThrow('retains this source')
    await expect(migrateDown(t.db,{to:57})).rejects.toThrow('Private evidence exists')
    expect((await call('GET',`/private-files/${fileId}/content`)).status).toBe(200)
  })
})
