import {expect,test} from 'bun:test'
import {mkdtemp,mkdir,readFile,writeFile} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {createApp} from '../src/app'
import {DirectoryBlobStore,MemoryBlobStore} from '../src/files/blob-store'
import {backupWithPrivateFiles,restoreWithPrivateFiles,verifyPrivateFiles} from '../src/files/backup'
import {ALLOWED_ORIGIN,DEMO,makeTestApp,testConfig} from './helpers'

test.skipIf(Boolean(process.env.TEST_DATABASE_URL))('PGlite database + private evidence restore retains scoped downloads and refuses corrupted/occupied targets',async()=>{
  const root=resolve('.data');await mkdir(root,{recursive:true})
  const work=await mkdtemp(join(root,'private-recovery-'))
  const blobs=new MemoryBlobStore(),t=await makeTestApp({blobs})
  let restored:Awaited<ReturnType<typeof restoreWithPrivateFiles>>|undefined
  try{
    const cookie=await t.login(DEMO.finance)
    const invoice=(await t.call('POST','/api/v1/finance/customer-invoices',{cookie,body:{projectId:'PRJ-101',invoiceType:'dp',dueDate:'2026-12-01',lines:[{description:'TEST_ONLY recovery',amountMinor:'1000'}]}})).json.data.id
    expect((await t.call('POST',`/api/v1/finance/customer-invoices/${invoice}/issue`,{cookie,body:{}})).status).toBe(200)
    const bytes=new TextEncoder().encode('%PDF-1.4\nTEST_ONLY durable private evidence\n%%EOF')
    const form=new FormData();form.set('sourceType','customer_invoice');form.set('sourceId',invoice);form.set('declaredMime','application/pdf');form.set('file',new File([bytes],'TEST_ONLY.pdf',{type:'application/pdf'}))
    const response=await t.app.handle(new Request('http://localhost/api/v1/private-files',{method:'POST',headers:{cookie,origin:ALLOWED_ORIGIN,'idempotency-key':'TEST_ONLY_recovery_file'},body:form}))
    expect(response.status).toBe(201);const file=(await response.json() as any).data
    expect(await verifyPrivateFiles(t.db,blobs)).toMatchObject({ready:true,checked:1})
    const admin=await t.login(DEMO.admin)
    const bundle=await backupWithPrivateFiles(t.db,'pglite://memory',blobs,work)
    expect(bundle.fileCount).toBe(1)
    const destination=join(work,'restored-private')
    restored=await restoreWithPrivateFiles(bundle.directory,'pglite://memory',destination)
    expect(restored.integrity).toEqual({ready:true,checked:1,missing:[],corrupt:[]})
    const app=createApp({db:restored.db,config:testConfig(),blobs:restored.store})
    const download=await app.handle(new Request(`http://localhost/api/v1/private-files/${file.id}/content`,{headers:{cookie}}))
    expect(download.status).toBe(200);expect(new Uint8Array(await download.arrayBuffer())).toEqual(bytes)
    expect((await app.handle(new Request(`http://localhost/api/v1/private-files/${file.id}/content`,{headers:{cookie:admin}}))).status).toBe(403)
    // Restored sessions belong to the snapshot; anonymous still cannot read private content.
    expect((await app.handle(new Request(`http://localhost/api/v1/private-files/${file.id}/content`))).status).toBe(401)
    await expect(restoreWithPrivateFiles(bundle.directory,'pglite://memory',destination)).rejects.toThrow('must be empty')
    const [row]=await restored.db.query<{storage_key:string}>('select storage_key from private_files where id=$1',[file.id])
    expect(new Uint8Array(await readFile(join(destination,row!.storage_key)))).toEqual(bytes)
    const backupFile=join(bundle.directory,'blobs',row!.storage_key)
    await writeFile(backupFile,'TEST_ONLY corrupt backup')
    await expect(restoreWithPrivateFiles(bundle.directory,'pglite://memory',join(work,'fresh-refused'))).rejects.toThrow('unavailable/corrupt')
    expect(()=>new DirectoryBlobStore(join(work,'public','files'))).toThrow()
    await expect(restored.store.get('../escape')).rejects.toThrow('Invalid opaque blob key')
  }finally{await restored?.db.close();await t.cleanup()}
},120000)
