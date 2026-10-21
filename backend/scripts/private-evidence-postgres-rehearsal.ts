/** Physical PostgreSQL + original-file recovery. Creates only fresh uniquely named databases on our fixed local
 * TEST cluster. Retains every database and artifact for review; never drops/resets a database or touches app config.
 */
import {mkdtemp,mkdir,readFile,writeFile} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {openDb,type Db} from '../src/db/client'
import {loadMigrations,migrateUp,migrationStatus} from '../src/db/migrator'
import {seedDemo} from '../src/db/seed-demo'
import {createApp} from '../src/app'
import {DirectoryBlobStore} from '../src/files/blob-store'
import {backupWithPrivateFiles,restoreWithPrivateFiles,verifyPrivateFiles} from '../src/files/backup'
import {isDatabaseEmpty,restoreDatabase} from '../src/db/backup'
import {ALLOWED_ORIGIN,DEMO,TEST_PASSWORD,testConfig} from '../test/helpers'

if(process.env.APP_ENV!=='test' || process.env.TEST_DATABASE_URL)throw new Error('Explicit APP_ENV=test with no TEST_DATABASE_URL required; this rehearsal owns fresh databases only.')
const base='postgres://accounting_test@127.0.0.1:55439/accounting_test'
const run=crypto.randomUUID().replaceAll('-','').slice(0,16),sourceName=`private_src_${run}`,targetName=`private_dst_${run}`,occupiedName=`private_occupied_${run}`
const url=(name:string)=>`postgres://accounting_test@127.0.0.1:55439/${name}`
const admin=await openDb(base,{max:1})
let source:Db|undefined,restored:Awaited<ReturnType<typeof restoreWithPrivateFiles>>|undefined
const check=(condition:unknown,message:string)=>{if(!condition)throw new Error(message)}
async function refuses(fn:()=>Promise<unknown>,expected:string){try{await fn()}catch(e){if(String(e).includes(expected))return;throw e}throw new Error(`Expected refusal: ${expected}`)}
const root=resolve('.data');await mkdir(root,{recursive:true});const work=await mkdtemp(join(root,'private-postgres-recovery-'))
try{
  for(const name of [sourceName,targetName,occupiedName]){
    if(!/^private_(src|dst|occupied)_[0-9a-f]{16}$/.test(name))throw new Error('Invalid owned rehearsal database name')
    await admin.exec(`create database ${name}`)
  }
  source=await openDb(url(sourceName));await migrateUp(source);await seedDemo(source,{appEnv:'test',password:TEST_PASSWORD})
  const store=new DirectoryBlobStore(join(work,'original-private')),app=createApp({db:source,config:testConfig(),blobs:store})
  const call=async(method:string,path:string,body?:unknown,cookie?:string)=>{
    const r=await app.handle(new Request(`http://localhost/api/v1${path}`,{method,headers:{origin:ALLOWED_ORIGIN,'content-type':'application/json','idempotency-key':crypto.randomUUID(),...(cookie?{cookie}:{})},...(body?{body:JSON.stringify(body)}:{})}))
    const text=await r.text();let json:any;try{json=JSON.parse(text)}catch{throw new Error(`Non-JSON response ${r.status}: ${path}`)}
    check(r.status<300,`HTTP ${r.status}: ${path}: ${text}`);return {json,cookie:r.headers.get('set-cookie')?.split(';')[0]}
  }
  const finance=(await call('POST','/auth/login',{email:DEMO.finance,password:TEST_PASSWORD})).cookie!
  const adminCookie=(await call('POST','/auth/login',{email:DEMO.admin,password:TEST_PASSWORD})).cookie!
  const i=(await call('POST','/finance/customer-invoices',{projectId:'PRJ-101',invoiceType:'dp',dueDate:'2026-12-01',lines:[{description:'TEST_ONLY physical recovery',amountMinor:'1000'}]},finance)).json.data
  await call('POST',`/finance/customer-invoices/${i.id}/issue`,{},finance)
  const bytes=new TextEncoder().encode('%PDF-1.4\nTEST_ONLY physical PostgreSQL private evidence\n%%EOF')
  const form=new FormData();form.set('sourceType','customer_invoice');form.set('sourceId',i.id);form.set('declaredMime','application/pdf');form.set('file',new File([bytes],'TEST_ONLY-pg-recovery.pdf',{type:'application/pdf'}))
  const upload=await app.handle(new Request('http://localhost/api/v1/private-files',{method:'POST',headers:{cookie:finance,origin:ALLOWED_ORIGIN,'idempotency-key':crypto.randomUUID()},body:form}))
  check(upload.status===201,'Physical recovery evidence upload failed');const file=(await upload.json() as any).data
  check((await verifyPrivateFiles(source,store)).ready,'Source private evidence failed verification')
  const before=await source.query('select id,total_minor,status from customer_invoices order by id')
  const bundle=await backupWithPrivateFiles(source,url(sourceName),store,work)
  check(bundle.fileCount===1,'Unexpected private file count')
  const destination=join(work,'restored-private')
  restored=await restoreWithPrivateFiles(bundle.directory,url(targetName),destination)
  check(restored.integrity.ready && restored.integrity.checked===1,'Restored DB + private bytes did not reconcile')
  check(JSON.stringify(await restored.db.query('select id,total_minor,status from customer_invoices order by id'))===JSON.stringify(before),'Restored invoice source differs')
  const schema=await migrationStatus(restored.db);check(schema.problems.length===0 && schema.pending.length===0 && schema.current===loadMigrations().length,'Restored migration history differs')
  const restoredApp=createApp({db:restored.db,config:testConfig(),blobs:restored.store})
  const download=(cookie?:string)=>restoredApp.handle(new Request(`http://localhost/api/v1/private-files/${file.id}/content`,{headers:cookie?{cookie}:{}}))
  const response=await download(finance);check(response.status===200,'Finance session download did not survive restore')
  check(Buffer.from(await response.arrayBuffer()).equals(Buffer.from(bytes)),'Original downloaded bytes differ')
  check((await download(adminCookie)).status===403,'Admin must not read financial evidence after restore')
  check((await download()).status===401,'Anonymous must not read evidence after restore')
  await refuses(()=>restoreWithPrivateFiles(bundle.directory,url(targetName),join(work,'refused-nonempty-db')),'not empty')
  await refuses(()=>restoreWithPrivateFiles(bundle.directory,url(occupiedName),destination),'must be empty')
  const occupied=await openDb(url(occupiedName))
  try{
    await occupied.exec('create schema protected_user_data; create table protected_user_data.keep_me(id integer primary key); insert into protected_user_data.keep_me values(71)')
    check(!await isDatabaseEmpty(occupied),'A user table outside public must prevent restore')
    await refuses(()=>restoreDatabase(bundle.databaseFile,url(occupiedName)),'not empty')
    check((await occupied.query<{id:number}>('select id from protected_user_data.keep_me'))[0]?.id===71,'Occupied user data changed')
  }finally{await occupied.close()}
  const [metadata]=await restored.db.query<{storage_key:string}>('select storage_key from private_files where id=$1',[file.id])
  check(Buffer.from(await readFile(join(destination,metadata!.storage_key))).equals(Buffer.from(bytes)),'Restored directory file differs')
  await writeFile(join(bundle.directory,'blobs',metadata!.storage_key),'TEST_ONLY deliberately corrupted backup copy')
  await refuses(()=>restoreWithPrivateFiles(bundle.directory,url(occupiedName),join(work,'refused-corrupt')),'unavailable/corrupt')
  console.log(JSON.stringify({result:'passed',engine:'PostgreSQL17 physical pg_dump/pg_restore + directory blobs',sourceDatabase:sourceName,restoredDatabase:targetName,occupiedDatabase:occupiedName,artifactDirectory:work,
    assertions:['original source restored','migration checksums','private hash/bytes','restored scoped sessions','Admin403','anonymous401','occupied DB refusal','other-schema user data preserved','occupied blob refusal','corrupt bundle refusal'],privateFileCount:1,databasesRetained:true,applicationDatabaseTouched:false},null,2))
}finally{await restored?.db.close();await source?.close();await admin.close()}
