import{createHash}from'node:crypto'
import{createRequestRateLimit}from'@building-suit/auth/rate-limit'
const limit=createRequestRateLimit(60,600000,10000)
export default defineEventHandler(async event=>{
 setResponseHeader(event,'Cache-Control','no-store')
 if(!limit(getRequestIP(event,{xForwardedFor:process.env.VERCEL==='1'})??'unknown'))throw createError({statusCode:429,statusMessage:'TOO_MANY_ATTEMPTS'})
 const config=useRuntimeConfig(event),provider=config.public.doctorAuth
 const unavailable=()=>createError({statusCode:503,statusMessage:'MOBILE_CONNECTION_UNAVAILABLE'})
 if(!provider.configured||provider.environment!=='local'||!config.doctorAuthEmailLookupKey)throw unavailable()
 let url:URL
 try{url=new URL(provider.url);if(!['http:','https:'].includes(url.protocol)||!['127.0.0.1','localhost'].includes(url.hostname)||url.port!=='65321'||url.pathname!=='/'||url.username||url.password||url.search||url.hash)throw unavailable()}catch{throw unavailable()}
 try{
  const response=await fetch(new URL('/rest/v1/rpc/doctor_runtime_contract',url),{method:'POST',redirect:'error',headers:{apikey:provider.key,Authorization:'Bearer '+provider.key,'Content-Type':'application/json'},body:'{}',cache:'no-store',signal:AbortSignal.timeout(6000)})
  if(!response.ok)throw unavailable()
  const raw=await response.json()
  if(!raw||raw.product!=='doctor-suit'||raw.version!==1||raw.data_mode!=='synthetic')throw unavailable()
 }catch{throw unavailable()}
 return{product:'doctor-suit',version:1,environment:'local',dataMode:'synthetic',emailStepReady:true,backendBinding:createHash('sha256').update(provider.key).digest('hex')}
})
