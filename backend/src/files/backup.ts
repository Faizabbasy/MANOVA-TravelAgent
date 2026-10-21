import {mkdir,readFile,readdir,writeFile} from 'node:fs/promises'
import {basename,isAbsolute,join,resolve} from 'node:path'
import type {Db,Queryable} from '../db/client'
import {backupDatabase,BackupError,restoreDatabase} from '../db/backup'
import {assertBlobKey,DirectoryBlobStore,type BlobStore} from './blob-store'
import {sha256} from './validation'
type Entry={id:string;storage_key:string;sha256:string;size_bytes:number}
type Manifest={version:1;database:{file:string;sha256:string};files:Entry[]}
async function references(db:Queryable){return db.query<Entry>('select id,storage_key,sha256,size_bytes from private_files order by id')}
export async function verifyPrivateFiles(db:Queryable,store:BlobStore){
  const missing:string[]=[],corrupt:string[]=[]
  const rows=await references(db)
  for(const r of rows){const bytes=await store.get(r.storage_key);if(!bytes)missing.push(r.id);else if(bytes.length!==r.size_bytes || sha256(bytes)!==r.sha256)corrupt.push(r.id)}
  return {ready:!missing.length && !corrupt.length,checked:rows.length,missing,corrupt}
}
/** Snapshot DB first. Append-only metadata ensures the subsequent blob list contains every snapshot reference.
 * Extra concurrent committed uploads may be included in the manifest; restore copies only restored DB references.
 */
export async function backupWithPrivateFiles(db:Db,databaseUrl:string,store:BlobStore,outRoot:string){
  if(!isAbsolute(outRoot))throw new BackupError('Backup root must be absolute and private')
  const dir=join(resolve(outRoot),`manova-private-${crypto.randomUUID()}`)
  new DirectoryBlobStore(dir) // Reject public/output locations before writing a DB snapshot.
  await mkdir(dir,{recursive:true})
  const snapshot=await backupDatabase(db,databaseUrl,dir)
  const rows=await references(db),copy=new DirectoryBlobStore(join(dir,'blobs'))
  for(const r of rows){
    const bytes=await store.get(r.storage_key)
    if(!bytes || bytes.length!==r.size_bytes || sha256(bytes)!==r.sha256)throw new BackupError(`Private evidence unavailable/corrupt: ${r.id}; bundle incomplete`)
    await copy.put(r.storage_key,bytes)
  }
  const manifest:Manifest={version:1,database:{file:basename(snapshot.file),sha256:snapshot.sha256},files:rows}
  const bytes=new TextEncoder().encode(JSON.stringify(manifest,null,2))
  await writeFile(join(dir,'manifest.json'),bytes,{flag:'wx',mode:0o600})
  await writeFile(join(dir,'manifest.sha256'),sha256(bytes),{flag:'wx',mode:0o600})
  return {directory:dir,databaseFile:snapshot.file,fileCount:rows.length,manifestSha256:sha256(bytes)}
}
/** Never overwrites an existing database or blob directory; use a fresh isolated restore target. */
export async function restoreWithPrivateFiles(bundle:string,targetUrl:string,blobRoot:string){
  if(!isAbsolute(bundle) || !isAbsolute(blobRoot))throw new BackupError('Restore paths must be absolute')
  const store=new DirectoryBlobStore(blobRoot)
  try{if((await readdir(blobRoot)).length)throw new BackupError('Private blob restore target must be empty')}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e}
  const bytes=await readFile(join(bundle,'manifest.json')),digest=(await readFile(join(bundle,'manifest.sha256'),'utf8')).trim()
  if(sha256(bytes)!==digest)throw new BackupError('Private backup manifest checksum mismatch')
  const m=JSON.parse(bytes.toString('utf8')) as Manifest
  if(m.version!==1 || !m.database || basename(m.database.file)!==m.database.file || !/^manova-(?:pglite|postgres)-[\w.-]+\.(?:tar\.gz|dump)$/.test(m.database.file) || !Array.isArray(m.files))throw new BackupError('Invalid private backup manifest')
  const dbFile=join(bundle,m.database.file)
  if(sha256(await readFile(dbFile))!==m.database.sha256)throw new BackupError('Database snapshot does not match private manifest')
  const backupStore=new DirectoryBlobStore(join(bundle,'blobs')),byKey=new Map<string,Entry>()
  for(const r of m.files){
    assertBlobKey(r.storage_key)
    if(byKey.has(r.storage_key) || !/^[0-9a-f]{64}$/.test(r.sha256) || !Number.isInteger(r.size_bytes) || r.size_bytes<1 || r.size_bytes>10485760)throw new BackupError('Invalid/duplicate private blob manifest entry')
    const data=await backupStore.get(r.storage_key)
    if(!data || data.length!==r.size_bytes || sha256(data)!==r.sha256)throw new BackupError(`Backup evidence unavailable/corrupt: ${r.id}`)
    byKey.set(r.storage_key,r)
  }
  const db=await restoreDatabase(dbFile,targetUrl)
  try{
    for(const r of await references(db)){
      const expected=byKey.get(r.storage_key)
      if(!expected || expected.id!==r.id || expected.sha256!==r.sha256 || expected.size_bytes!==r.size_bytes)throw new BackupError(`Restored database evidence differs: ${r.id}`)
      await store.put(r.storage_key,(await backupStore.get(r.storage_key))!)
    }
    const integrity=await verifyPrivateFiles(db,store)
    if(!integrity.ready)throw new BackupError('Restored private evidence did not reconcile')
    return {db,store,integrity}
  }catch(e){await db.close();throw e}
}
