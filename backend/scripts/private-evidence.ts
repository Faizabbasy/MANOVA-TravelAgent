/** Explicit operator commands only. No migration, deletion, production activation or external provider calls. */
import {isAbsolute,resolve} from 'node:path'
import {loadConfig} from '../src/config/env'
import {openDb} from '../src/db/client'
import {DirectoryBlobStore} from '../src/files/blob-store'
import {backupWithPrivateFiles,restoreWithPrivateFiles,verifyPrivateFiles} from '../src/files/backup'
const [command,...args]=process.argv.slice(2)
const value=(flag:string)=>{const i=args.indexOf(flag);return i<0?undefined:args[i+1]}
const required=(flag:string)=>{const v=value(flag);if(!v)throw new Error(`Required ${flag}`);return v}
if(!['verify','backup','restore'].includes(command ?? ''))throw new Error('Usage: bun run scripts/private-evidence.ts verify | backup --out ABS_PRIVATE_DIR | restore --bundle ABS_BUNDLE --blob-root ABS_EMPTY_DIR (PRIVATE_RESTORE_TARGET_URL required for restore)')
if(command==='restore'){
  const bundle=required('--bundle'),target=process.env.PRIVATE_RESTORE_TARGET_URL,root=required('--blob-root')
  if(!target)throw new Error('PRIVATE_RESTORE_TARGET_URL is required; never pass database credentials in command arguments')
  if(!isAbsolute(bundle)||!isAbsolute(root))throw new Error('Restore paths must be absolute')
  if(process.env.DATABASE_URL && target===process.env.DATABASE_URL)throw new Error('Restore target must be explicitly separate from the configured application database')
  const restored=await restoreWithPrivateFiles(bundle,target,root)
  try{console.log(JSON.stringify({result:'restored-to-isolated-target',...restored.integrity}))}finally{await restored.db.close()}
}else{
  const config=loadConfig()
  const root=config.privateFilesPath ?? (config.appEnv==='development' ? resolve('.data/private-blobs') : null)
  if(!root)throw new Error('PRIVATE_FILE_ROOT must be explicitly configured for this environment')
  const store=new DirectoryBlobStore(root),db=await openDb(config.databaseUrl)
  try{
    if(command==='verify')console.log(JSON.stringify(await verifyPrivateFiles(db,store)))
    else console.log(JSON.stringify(await backupWithPrivateFiles(db,config.databaseUrl,store,required('--out'))))
  }finally{await db.close()}
}
