import {mkdir,open,readFile,unlink} from 'node:fs/promises'
import {isAbsolute,join,resolve} from 'node:path'
/** Opaque keys only. This directory must never be mounted by a web/static server. */
export interface BlobStore {
  put(key:string,bytes:Uint8Array):Promise<void>
  get(key:string):Promise<Uint8Array|null>
  removeUncommitted(key:string):Promise<void>
}
const KEY=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
export function assertBlobKey(key:string) {if(!KEY.test(key))throw new Error('Invalid opaque blob key')}
export class MemoryBlobStore implements BlobStore {
  private readonly data=new Map<string,Uint8Array>()
  async put(key:string,bytes:Uint8Array){assertBlobKey(key);if(this.data.has(key))throw new Error('Blob key exists');this.data.set(key,bytes.slice())}
  async get(key:string){assertBlobKey(key);return this.data.get(key)?.slice() ?? null}
  async removeUncommitted(key:string){assertBlobKey(key);this.data.delete(key)}
}
export class DirectoryBlobStore implements BlobStore {
  readonly root:string
  constructor(root:string){
    if(!isAbsolute(root))throw new Error('Private blob root must be absolute')
    this.root=resolve(root)
    if (/(?:^|[\\/])(?:public|\.output)(?:[\\/]|$)/i.test(this.root)) throw new Error('Private blobs cannot use a public/output directory')
  }
  private path(key:string){assertBlobKey(key);return join(this.root,key)}
  async put(key:string,bytes:Uint8Array){
    const file=this.path(key)
    await mkdir(this.root,{recursive:true})
    const handle=await open(file,'wx',0o600)
    try{await handle.writeFile(bytes);await handle.sync()}catch(e){await handle.close();await unlink(file);throw e}
    await handle.close()
  }
  async get(key:string){try{return new Uint8Array(await readFile(this.path(key)))}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return null;throw e}}
  async removeUncommitted(key:string){try{await unlink(this.path(key))}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e}}
}
