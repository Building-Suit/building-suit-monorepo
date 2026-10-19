import {bookingUuid,bookingExpiry,parseBookingOptions,parseBookingSlots,parseBookingManagement} from '../../../../shared/appointmentBooking'
import {parseAppointmentAccessSession,normalizeAppointmentAccessPhone,normalizeAppointmentAccessCode} from '../../../../shared/appointmentAccess'
import {websiteUrl,validWebsiteSlug,configuredWebsiteDomain} from '../../../../shared/websiteAddress'
import {readBoundedInquiryBody} from '../../../utils/readBoundedInquiryBody'
import {publicWebsiteRpc} from '../../../utils/publicWebsiteRpc'
import {createInquiryRateLimit} from '../../../utils/inquiryRateLimit'
const reads=createInquiryRateLimit(100),writes=createInquiryRateLimit(20)
export default defineEventHandler(async event=>{
 const host=event.context.websiteHost,action=getRouterParam(event,'action'),config=useRuntimeConfig(event)
 const domain=configuredWebsiteDomain(config.public)
 setResponseHeader(event,'Cache-Control','private, no-store');setResponseHeader(event,'X-Robots-Tag','noindex, nofollow')
 if(!domain||host?.kind!=='website'||!validWebsiteSlug(event.context.websiteCanonicalSlug)||!action||!['options','slots','manage','command','reminder'].includes(action))throw createError({statusCode:404,statusMessage:'Not Found'})
 if(getHeader(event,'origin')!==websiteUrl(host.slug,domain))throw createError({statusCode:403,statusMessage:'Access unavailable'})
 const token=event.context.appointmentAccessToken as string|undefined,cookieName=`bs-shop-${config.public.appEnvironment}-appointment-access`
 const clear=()=>{event.context.appointmentAccessCookieName=cookieName;deleteCookie(event,cookieName,{path:'/api/website',httpOnly:true,secure:true,sameSite:'strict'})}
 const denied=()=>action==='options'?{enabled:false}:action==='slots'?{slots:[]}:action==='manage'?{authenticated:false}:{ok:false}
 if(!(action==='command'||action==='reminder'?writes:reads)(`${event.context.websiteCanonicalSlug}:${event.node.req.socket?.remoteAddress??'unknown'}`))return denied()
 const rpc=(name:string,args:Record<string,unknown>)=>publicWebsiteRpc({url:config.public.supabase.url,key:config.public.supabase.key},name,{p_slug:host.slug,p_token:token??null,...args})
 try{
  if(!getHeader(event,'content-type')?.startsWith('application/json'))return denied()
  const raw=await readBoundedInquiryBody(event,4096)
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return denied()
  const body=raw as Record<string,unknown>,keys=Object.keys(body)
  if(action==='options'){
   if(keys.length)return denied();const data=parseBookingOptions(await rpc('appointment_booking_options',{}));if(data.enabled&&!data.authenticated&&token)clear();return data
  }
  if(action==='manage'){
   if(keys.some(k=>k!=='page')||!Number.isSafeInteger(body.page)||Number(body.page)<1||Number(body.page)>100000)return denied()
   const data=parseBookingManagement(await rpc('appointment_booking_manage',{p_page:body.page}));if(!data){clear();return{authenticated:false}};if(data.page!==body.page)return denied();return data
  }
  if(action==='reminder'){
   if(keys.some(k=>!['reference','enabled','locale'].includes(k))||!bookingUuid(body.reference)||typeof body.enabled!=='boolean'||typeof body.locale!=='string'||!['en','ar'].includes(body.locale))return denied()
   const result=await rpc('appointment_reminder_preference',{p_reference:body.reference,p_enabled:body.enabled,p_locale:body.locale}) as {ok?:boolean}|null
   return{ok:result?.ok===true}
  }
  if(action==='slots'){
   if(keys.some(k=>!['service','location','staff','date','reference'].includes(k))||!bookingUuid(body.service)||!bookingUuid(body.location)||!bookingUuid(body.staff)||typeof body.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(body.date)||!Number.isFinite(Date.parse(body.date))||new Date(body.date).toISOString().slice(0,10)!==body.date||body.reference!==undefined&&body.reference!==null&&!bookingUuid(body.reference))return denied()
   return{slots:parseBookingSlots(await rpc('appointment_booking_slots',{p_service:body.service,p_location:body.location,p_staff:body.staff,p_date:body.date,p_reference:body.reference??null}))}
  }
  if(keys.some(k=>!['operation','requestKey','reference','service','location','staff','startsAt','name','phone'].includes(k))||typeof body.operation!=='string'||!['create','reschedule','cancel'].includes(body.operation)||typeof body.requestKey!=='string'||!/^[a-f0-9]{64}$/.test(body.requestKey))return denied()
  if(body.reference!==undefined&&body.reference!==null&&!bookingUuid(body.reference))return denied()
  if(body.operation!=='create'&&!bookingUuid(body.reference))return denied()
  if(body.operation!=='cancel'&&(!bookingUuid(body.service)||!bookingUuid(body.location)||!bookingUuid(body.staff)||typeof body.startsAt!=='string'||body.startsAt.length>50||!Number.isFinite(Date.parse(body.startsAt))))return denied()
  if(body.name!==undefined&&body.name!==null&&(typeof body.name!=='string'||body.name.trim().length<2||Array.from(body.name).length>160||Array.from(body.name).some(c=>c.charCodeAt(0)<32||c.charCodeAt(0)===127)))return denied()
  if(body.phone!==undefined&&body.phone!==null&&!normalizeAppointmentAccessPhone(body.phone))return denied()
  const value=await rpc('appointment_booking_command',{p_operation:body.operation,p_request_key:body.requestKey,p_reference:body.reference??null,p_service:body.service??null,p_location:body.location??null,p_staff:body.staff??null,p_starts_at:body.startsAt??null,p_name:body.name??null,p_phone:body.phone===undefined||body.phone===null?null:normalizeAppointmentAccessPhone(body.phone)}) as Record<string,unknown>|null
  if(value?.ok!==true){if(value?.accessEnded===true){clear();return{ok:false,accessEnded:true}}return{ok:false}}
  if(!bookingUuid(value.reference))return denied()
  const expiresAt=bookingExpiry(value.expiresAt),code=value.code===null?null:normalizeAppointmentAccessCode(value.code)
  if(value.code!==null&&!code)return denied()
  if(value.token!==undefined){const session=parseAppointmentAccessSession(value);if(!session)return denied();event.context.appointmentAccessCookieName=cookieName;setCookie(event,cookieName,session.token,{path:'/api/website',httpOnly:true,secure:true,sameSite:'strict',maxAge:Math.max(1,Math.floor((Date.parse(session.expiresAt)-Date.now())/1000))})}
  return{ok:true,reference:value.reference,expiresAt,code}
 }catch{return denied()}
})
