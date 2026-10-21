import {createHash} from 'node:crypto'
import {errors} from '../http/errors'
export const MAX_FILE_BYTES=10*1024*1024
export function sha256(bytes:Uint8Array){return createHash('sha256').update(bytes).digest('hex')}
export function validateFile(bytes:Uint8Array,declaredMime:string,originalName:string){
  if(!bytes.length || bytes.length>MAX_FILE_BYTES)throw errors.validation({file:['File harus berisi data dan maksimal 10 MB.']})
  const starts=(b:number[])=>b.every((v,i)=>bytes[i]===v)
  const mime=starts([0x25,0x50,0x44,0x46,0x2d])?'application/pdf':starts([137,80,78,71,13,10,26,10])?'image/png':starts([255,216,255])?'image/jpeg':
    starts([82,73,70,70]) && [87,69,66,80].every((v,i)=>bytes[i+8]===v)?'image/webp':null
  if(!mime || (declaredMime && declaredMime!==mime))throw errors.validation({file:['Gunakan PDF, JPEG, PNG atau WebP dengan isi yang cocok dengan tipe file.']})
  const name=originalName.split(/[\\/]/).pop()?.replace(/[\x00-\x1f\x7f"<>:]/g,'_').trim().slice(0,180) || 'bukti'
  return {mime,originalName:name,sizeBytes:bytes.length,sha256:sha256(bytes)}
}
