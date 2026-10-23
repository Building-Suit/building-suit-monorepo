import type {DoctorMobileIdentity}from'@building-suit/contracts'
import{decodeNativeSession,type NativeSessionBackend,type NativeSessionTokens}from'./nativeSession.ts'
export interface NativeSessionConfiguration {url:string;accountUrl:string;publicKey:string;environment:'local';dataMode:'synthetic'}
export interface NativeAuthRequest {url:string;method:'GET'|'POST'|'PUT';headers:Record<string,string>;body?:Record<string,unknown>;signal:AbortSignal}
export type NativeAuthTransport=(request:NativeAuthRequest)=>Promise<{status:number;data:unknown}>
const object=(value:unknown):value is Record<string,unknown>=>Boolean(value&&typeof value==='object'&&!Array.isArray(value))
const uuid=(value:unknown):value is string=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
const denied=(code='SESSION_REVOKED')=>Object.assign(new Error('Session unavailable'),{code})
export function nativeSessionConfiguration(value:unknown):NativeSessionConfiguration|null{
 if(!object(value)||Object.keys(value).sort().join(',')!=='accountUrl,dataMode,environment,publicKey,url'||value.environment!=='local'||value.dataMode!=='synthetic'||typeof value.url!=='string'||typeof value.accountUrl!=='string'||typeof value.publicKey!=='string')return null
 try{
  const url=new URL(value.url)
  if(!['127.0.0.1','localhost','10.0.2.2'].includes(url.hostname)||url.port!=='65321'||!['http:','https:'].includes(url.protocol)||
    url.pathname!=='/'||url.username||url.password||url.search||url.hash)return null
  let publicKey=/^sb_publishable_[A-Za-z0-9_-]{10,}$/.test(value.publicKey)
  if(!publicKey&&/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value.publicKey))try{
   publicKey=JSON.parse(atob(value.publicKey.split('.')[1]!.replace(/-/g,'+').replace(/_/g,'/'))).role==='anon'
  }catch{/* Privileged or malformed keys fail closed. */}
  if(!publicKey||value.publicKey.length>8192)return null
  const account=new URL(value.accountUrl)
  if(!['127.0.0.1','localhost','10.0.2.2'].includes(account.hostname)||!['3006','4342'].includes(account.port)||!['http:','https:'].includes(account.protocol)||account.pathname!=='/'||account.username||account.password||account.search||account.hash)return null
  return{url:url.origin,accountUrl:account.origin,publicKey:value.publicKey,environment:'local',dataMode:'synthetic'}
 }catch{return null}
}
export function createNativeSessionBackend(configuration:NativeSessionConfiguration,transport:NativeAuthTransport,now=()=>Date.now()):NativeSessionBackend{
 const config=nativeSessionConfiguration(configuration)
 if(!config)throw denied('CONFIGURATION_UNAVAILABLE')
 async function request(path:string,method:NativeAuthRequest['method'],signal:AbortSignal,body?:Record<string,unknown>,token?:string,account=false){
  if(signal.aborted)throw denied('REQUEST_CANCELLED')
  const headers:Record<string,string>=account?{'Content-Type':'application/json'}:{apikey:config!.publicKey,'Content-Type':'application/json',Authorization:'Bearer '+(token??config!.publicKey)}
  const response=await transport({url:(account?config!.accountUrl:config!.url)+path,method,headers,body,signal})
  if(signal.aborted)throw denied('REQUEST_CANCELLED')
  if(!Number.isInteger(response.status)||response.status<200||response.status>=300){
   if([400,401,403].includes(response.status))throw denied(path.includes('grant_type=password')?'CREDENTIALS_REJECTED':'SESSION_REVOKED')
   throw denied('TRANSPORT_UNAVAILABLE')
  }
  if(JSON.stringify(response.data??null).length>65536)throw denied('RESPONSE_UNAVAILABLE')
  return response.data
 }
 function session(raw:unknown):NativeSessionTokens{
  if(!object(raw)||typeof raw.expires_in!=='number'||!Number.isSafeInteger(raw.expires_in)||raw.expires_in<1||raw.expires_in>86400)throw denied()
  const expiresAt=typeof raw.expires_at==='number'?raw.expires_at*1000:now()+raw.expires_in*1000
  if(expiresAt<=now()||expiresAt>now()+86400000)throw denied()
  return decodeNativeSession({accessToken:raw.access_token,refreshToken:raw.refresh_token,expiresAt})
 }
 return{
  async marker(signal){try{
   const raw=await request('/rest/v1/rpc/doctor_runtime_contract','POST',signal,{})
   if(!object(raw)||raw.product!=='doctor-suit'||raw.version!==1||raw.data_mode!=='synthetic')return false
   const contract=await request('/api/auth/mobile-contract','GET',signal,undefined,undefined,true)
   const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(config!.publicKey))),byte=>byte.toString(16).padStart(2,'0')).join('')
   return object(contract)&&contract.product==='doctor-suit'&&contract.version===1&&contract.environment==='local'&&contract.dataMode==='synthetic'&&contract.emailStepReady===true&&contract.backendBinding===hash
  }catch{return false}},
  async emailExists(email,signal){const value=await request('/api/auth/email-step','POST',signal,{email,intent:'sign-in'},undefined,true);if(!object(value)||typeof value.canContinue!=='boolean')throw denied('RESPONSE_UNAVAILABLE');return value.canContinue},
  async signIn(email,password,signal){return session(await request('/auth/v1/token?grant_type=password','POST',signal,{email,password}))},
  async refresh(refreshToken,signal){return session(await request('/auth/v1/token?grant_type=refresh_token','POST',signal,{refresh_token:refreshToken}))},
  async identity(token,signal):Promise<DoctorMobileIdentity|null>{
   const user=await request('/auth/v1/user','GET',signal,undefined,token)
   if(!object(user)||!uuid(user.id))return null
   const context=await request('/rest/v1/rpc/doctor_session_context','POST',signal,{},token)
   if(!object(context)||context.product!=='doctor-suit'||context.user_id!==user.id||!uuid(context.session_id))return null
   return{userId:user.id,sessionId:context.session_id,environment:'local'}
  },
  async revoke(token,signal){await request('/auth/v1/logout?scope=local','POST',signal,{},token)},
  async recover(email,signal){await request('/auth/v1/recover','POST',signal,{email})},
  async verifyRecovery(email,code,signal){return session(await request('/auth/v1/verify','POST',signal,{email,token:code,type:'recovery'}))},
  async password(token,password,signal){await request('/auth/v1/user','PUT',signal,{password},token)},
 }
}
