import type {DoctorMobileIdentity} from '@building-suit/contracts'

export const doctorNativeSessionNamespace='bs-doctor-mobile-local-synthetic-auth-v1'
export interface NativeSessionTokens {accessToken:string;refreshToken:string;expiresAt:number}
export interface NativeSessionVault {read():Promise<string|null>;write(value:string):Promise<void>;clear():Promise<void>}
export interface NativeSessionBackend {
 marker(signal:AbortSignal):Promise<boolean>
 signIn(email:string,password:string,signal:AbortSignal):Promise<NativeSessionTokens>
 refresh(refreshToken:string,signal:AbortSignal):Promise<NativeSessionTokens>
 identity(accessToken:string,signal:AbortSignal):Promise<DoctorMobileIdentity|null>
 revoke(accessToken:string,signal:AbortSignal):Promise<void>
 recover(email:string,signal:AbortSignal):Promise<void>
 verifyRecovery(email:string,code:string,signal:AbortSignal):Promise<NativeSessionTokens>
 password(accessToken:string,password:string,signal:AbortSignal):Promise<void>
}
export interface NativeSessionState {
 phase:'signed-out'|'loading'|'ready'|'recovery-sent'|'error'
 identity:DoctorMobileIdentity|null
 error:'unavailable'|'credentials'|'storage'|'revocation-unconfirmed'|null
}
export const nativeSessionState=():NativeSessionState=>({phase:'signed-out',identity:null,error:null})
const uuid=(value:unknown):value is string=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
export function decodeNativeSession(value:unknown):NativeSessionTokens {
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Session unavailable')
 const row=value as Record<string,unknown>
 if(Object.keys(row).sort().join(',')!=='accessToken,expiresAt,refreshToken'||
   typeof row.accessToken!=='string'||row.accessToken.length<16||row.accessToken.length>16384||
   typeof row.refreshToken!=='string'||row.refreshToken.length<8||row.refreshToken.length>4096||
   !Number.isSafeInteger(row.expiresAt)||(row.expiresAt as number)<1)throw new Error('Session unavailable')
 return{accessToken:row.accessToken,refreshToken:row.refreshToken,expiresAt:row.expiresAt as number}
}
const syntheticEmail=(email:string)=>/^[^\s@]+@[^\s@]+\.test$/i.test(email)&&email.length<=254

/** The vault holds tokens, never authority. Every restore/resume obtains a
 * current server user + SID before publishing identity. No chart is cached. */
export function createNativeSession(backend:NativeSessionBackend|null,vault:NativeSessionVault,state=nativeSessionState(),clearProtected=()=>{},now=()=>Date.now()) {
 let generation=0,abort=new AbortController(),tokens:NativeSessionTokens|null=null
 let storage=Promise.resolve()
 function stored<T>(command:()=>Promise<T>):Promise<T>{const result=storage.then(command);storage=result.then(()=>{},()=>{});return result}
 function begin(phase:NativeSessionState['phase']='loading'){
  generation++;abort.abort();abort=new AbortController();tokens=null
  state.identity=null;state.error=null;state.phase=phase;clearProtected()
  return{revision:generation,signal:abort.signal}
 }
 function failed(revision:number,error:NativeSessionState['error']='unavailable'){
  if(generation===revision){tokens=null;state.identity=null;state.phase='error';state.error=error;clearProtected()}
  return false
 }
 async function marker(signal:AbortSignal){if(!backend||!await backend.marker(signal))throw new Error('Session unavailable')}
 async function accept(raw:unknown,revision:number,signal:AbortSignal){
  const value=decodeNativeSession(raw)
  if(value.expiresAt<=now())throw new Error('Session expired')
  const actor=await backend!.identity(value.accessToken,signal)
  if(generation!==revision)return false
  if(!actor||!uuid(actor.userId)||!uuid(actor.sessionId)||actor.environment!=='local'){
   await stored(()=>vault.clear());return failed(revision,'credentials')
  }
  await stored(async()=>{if(generation===revision)await vault.write(JSON.stringify(value))})
  if(generation!==revision)return false
  tokens=value;state.identity={...actor};state.phase='ready';state.error=null;return true
 }
 async function signIn(email:string,password:string){
  const {revision,signal}=begin()
  try{
   await stored(()=>vault.clear())
   if(!syntheticEmail(email)||password.length<12||password.length>1024)return failed(revision,'credentials')
   await marker(signal);if(generation!==revision)return false
   return await accept(await backend!.signIn(email.trim().toLowerCase(),password,signal),revision,signal)
  }catch{return failed(revision)}
 }
 async function resume(){
  const {revision,signal}=begin()
  try{
   const encoded=await stored(()=>vault.read());if(generation!==revision)return false
   if(encoded===null){state.phase='signed-out';return false}
   let value:NativeSessionTokens
   try{value=decodeNativeSession(JSON.parse(encoded))}catch{await stored(()=>vault.clear());return failed(revision,'storage')}
   await marker(signal);if(generation!==revision)return false
   if(value.expiresAt<=now()+30000)value=await backend!.refresh(value.refreshToken,signal)
   return await accept(value,revision,signal)
  }catch{return failed(revision)}
 }
 async function signOut(){
  const previous=tokens,{revision,signal}=begin('signed-out')
  try{await stored(()=>vault.clear())}catch{return failed(revision,'storage')}
  if(previous&&backend)try{await backend.revoke(previous.accessToken,signal)}catch{return failed(revision,'revocation-unconfirmed')}
  return generation===revision
 }
 async function recover(email:string){
  const {revision,signal}=begin()
  try{
   await stored(()=>vault.clear())
   if(!syntheticEmail(email))return failed(revision,'credentials')
   await marker(signal);if(generation!==revision)return false
   await backend!.recover(email.trim().toLowerCase(),signal)
   if(generation!==revision)return false
   state.phase='recovery-sent';return true
  }catch{return failed(revision)}
 }
 async function completeRecovery(email:string,code:string,password:string){
  const {revision,signal}=begin()
  try{
   await stored(()=>vault.clear())
   if(!syntheticEmail(email)||!/^\d{6,10}$/.test(code)||password.length<12||password.length>1024)return failed(revision,'credentials')
   await marker(signal);if(generation!==revision)return false
   const value=decodeNativeSession(await backend!.verifyRecovery(email.trim().toLowerCase(),code,signal))
   if(generation!==revision)return false
   await backend!.password(value.accessToken,password,signal)
   return await accept(value,revision,signal)
  }catch{return failed(revision)}
 }
 function lock(){begin('signed-out')}
 return{state,signIn,resume,signOut,recover,completeRecovery,lock,dispose:lock,
  // Kept inside the product adapter, never in view projections or URLs.
  accessToken:()=>state.phase==='ready'?tokens?.accessToken??null:null}
}
