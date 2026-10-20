import type {SupabaseClient} from '@supabase/supabase-js'
import type {Database} from '../types/database.types'
import {clinicalReleased,type ClinicalReleased} from './clinical.ts'
export function clinicalReleaseRepository(client:SupabaseClient<Database>,url:string,publicKey:string,transport:typeof fetch=fetch){
 return {
  async load(release:string,signal:AbortSignal){const {data,error}=await client.rpc('doctor_clinical_released',{p_release:release}).abortSignal(signal);if(error)throw error;return clinicalReleased(data,release)},
  async download(release:ClinicalReleased,versionId:string,key:string,signal:AbortSignal){
   const document=release.documents.find(item=>item.id===versionId);if(!document)throw {code:'42501'}
   const session=await client.auth.getSession();if(session.error||!session.data.session)throw {code:'42501'}
   const response=await transport(`${url}/functions/v1/doctor-clinical-release`,{method:'POST',headers:{apikey:publicKey,Authorization:`Bearer ${session.data.session.access_token}`,'x-doctor-release':encodeURIComponent(JSON.stringify({releaseId:release.release_id,versionId,key}))},signal})
   if(!response.ok)throw {code:[401,403].includes(response.status)?'42501':'unavailable'}
   if(response.headers.get('content-type')!==document.mime||!response.headers.get('content-disposition')?.startsWith('attachment;'))throw {code:'unavailable'}
   const reader=response.body?.getReader();if(!reader)throw {code:'unavailable'}
   const bytes=new Uint8Array(document.size);let size=0
   try{for(;;){const part=await reader.read();if(part.done)break;if(size+part.value.length>document.size){await reader.cancel();throw {code:'unavailable'}}bytes.set(part.value,size);size+=part.value.length}}finally{reader.releaseLock()}
   const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(byte=>byte.toString(16).padStart(2,'0')).join('')
   if(size!==document.size||hash!==document.sha256)throw {code:'unavailable'}
   return {filename:document.filename,blob:new Blob([bytes],{type:document.mime})}
  },
 }
}
