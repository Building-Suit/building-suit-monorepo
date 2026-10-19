import {normalizeAppointmentAccessCode,normalizeAppointmentAccessPhone,parseAppointmentAccessSession} from '../../../../shared/appointmentAccess'
import {readBoundedInquiryBody} from '../../../utils/readBoundedInquiryBody'
import {createInquiryRateLimit} from '../../../utils/inquiryRateLimit'
import {publicWebsiteRpc} from '../../../utils/publicWebsiteRpc'
import {websiteUrl,validWebsiteSlug,configuredWebsiteDomain} from '../../../../shared/websiteAddress'
const allowed=createInquiryRateLimit(20)
export default defineEventHandler(async event=>{
 const host=event.context.websiteHost,action=getRouterParam(event,'action'),config=useRuntimeConfig(event)
 const domain=configuredWebsiteDomain(config.public)
 setResponseHeader(event,'Cache-Control','private, no-store');setResponseHeader(event,'X-Robots-Tag','noindex, nofollow')
 const logout=action==='logout'&&event.context.appointmentAccessLogout===true
 if(!domain||host?.kind!=='website'||!logout&&!validWebsiteSlug(event.context.websiteCanonicalSlug)||!action||!['verify','validate','rotate','logout'].includes(action))throw createError({statusCode:404,statusMessage:'Not Found'})
 if(getHeader(event,'origin')!==websiteUrl(host.slug,domain))throw createError({statusCode:403,statusMessage:'Access unavailable'})
 const cookieName=`bs-shop-${config.public.appEnvironment}-appointment-access`
 // Public host middleware strips private auth cookies, but retains this host-only
 // HttpOnly capability in a separate context field for this narrowly scoped API.
 event.context.appointmentAccessCookieName=cookieName
 const oldToken=event.context.appointmentAccessToken as string|undefined
 const rpc=(name:string,args:Record<string,unknown>)=>publicWebsiteRpc({url:config.public.supabase.url,key:config.public.supabase.key},name,args)
 const clear=()=>deleteCookie(event,cookieName,{path:'/api/website',httpOnly:true,secure:true,sameSite:'strict'})
 const fail=()=>({ok:false})
 if(action!=='logout'&&!allowed(`${event.context.websiteCanonicalSlug}:${event.node.req.socket?.remoteAddress??'unknown'}`))return fail()
 try{
  if(!getHeader(event,'content-type')?.startsWith('application/json'))return fail()
  const raw=await readBoundedInquiryBody(event,2048)
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return fail()
  if(action==='verify'){
   clear()
   if(oldToken){const revoked=await rpc('appointment_access_session_revoke',{p_slug:host.slug,p_token:oldToken}) as {ok?:boolean}|null;if(revoked?.ok!==true)return fail()}
   if(Object.keys(raw).some(k=>!['code','phone'].includes(k)))return fail()
   const input=raw as {code?:unknown;phone?:unknown},code=normalizeAppointmentAccessCode(input.code),phone=normalizeAppointmentAccessPhone(input.phone)
   // Even malformed credential attempts reach the authoritative database quota.
   const session=parseAppointmentAccessSession(await rpc('appointment_access_verify',{p_slug:host.slug,p_code:code,p_phone:phone}))
   if(!session)return fail()
   setCookie(event,cookieName,session.token,{path:'/api/website',httpOnly:true,secure:true,sameSite:'strict',maxAge:Math.max(1,Math.floor((Date.parse(session.expiresAt)-Date.now())/1000))})
   return{ok:true,expiresAt:session.expiresAt}
  }
  if(Object.keys(raw).length)return fail()
  if(action==='logout'){clear();if(oldToken){const revoked=await rpc('appointment_access_session_revoke',{p_slug:host.slug,p_token:oldToken}) as {ok?:boolean}|null;if(revoked?.ok!==true)return fail()};return{ok:true}}
  if(!oldToken)return fail()
  if(action==='rotate'){
   clear();const session=parseAppointmentAccessSession(await rpc('appointment_access_session_rotate',{p_slug:host.slug,p_token:oldToken}))
   if(!session)return fail()
   setCookie(event,cookieName,session.token,{path:'/api/website',httpOnly:true,secure:true,sameSite:'strict',maxAge:Math.max(1,Math.floor((Date.parse(session.expiresAt)-Date.now())/1000))})
   return{ok:true,expiresAt:session.expiresAt}
  }
  const result=await rpc('appointment_access_session_validate',{p_slug:host.slug,p_token:oldToken}) as {ok?:boolean;expiresAt?:unknown}|null
  const valid=parseAppointmentAccessSession({ok:result?.ok,token:oldToken,expiresAt:result?.expiresAt})
  if(!valid){clear();return fail()}
  return{ok:true,expiresAt:valid.expiresAt}
 }catch{return fail()}
})
