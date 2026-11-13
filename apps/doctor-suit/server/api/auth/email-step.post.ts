import{createHash}from'node:crypto'
import{createRequestRateLimit}from'@building-suit/auth/rate-limit'
const byIp=createRequestRateLimit(12,600000,10000),byAddress=createRequestRateLimit(4,600000,20000)
export default defineEventHandler(async event=>{
 setResponseHeader(event,'Cache-Control','no-store')
 const body=await readBody<{email?:unknown;intent?:unknown}>(event),email=typeof body?.email==='string'?body.email.trim().toLowerCase():''
 if(email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!['sign-in','sign-up'].includes(String(body?.intent)))throw createError({statusCode:422,statusMessage:'INVALID_EMAIL_STEP'})
 const ip=getRequestIP(event,{xForwardedFor:process.env.VERCEL==='1'})??'unknown',hash=createHash('sha256').update(email).digest('hex')
 if(!byIp(ip)||!byAddress(`${ip}:${hash}`))throw createError({statusCode:429,statusMessage:'TOO_MANY_ATTEMPTS'})
 const config=useRuntimeConfig(event),provider=config.public.doctorAuth,key=config.doctorAuthEmailLookupKey
 const unavailable=()=>createError({statusCode:503,statusMessage:'EMAIL_LOOKUP_UNAVAILABLE'})
 if(!provider.configured||!key)throw unavailable()
 let url:URL
 try{url=new URL(provider.url);if(url.username||url.password||!(url.protocol==='https:'||url.protocol==='http:'&&['127.0.0.1','localhost'].includes(url.hostname)))throw Error('invalid')
  if(key.startsWith('eyJ')){if(JSON.parse(Buffer.from(key.split('.')[1]||'','base64url').toString()).role!=='service_role')throw Error('invalid')}
  else if(!key.startsWith('sb_secret_'))throw Error('invalid')
 }catch{throw unavailable()}
 let response:Response
 try{response=await fetch(new URL('/rest/v1/rpc/doctor_auth_email_exists',url),{method:'POST',redirect:'error',headers:{apikey:key,...(key.startsWith('eyJ')?{Authorization:`Bearer ${key}`}:{ }), 'Content-Type':'application/json'},body:JSON.stringify({p_email:email}),cache:'no-store',signal:AbortSignal.timeout(6000)})}catch{throw unavailable()}
 if(!response.ok)throw unavailable()
 let exists:unknown;try{exists=await response.json()}catch{throw unavailable()}
 if(typeof exists!=='boolean')throw unavailable()
 return{canContinue:body.intent==='sign-in'?exists:!exists}
})
