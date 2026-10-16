import {websiteUrl} from './websiteAddress.ts'
export type PortalBucket='upcoming'|'past'
export type PortalStatus='booked'|'arrived'|'waiting'|'in_service'|'completed'|'cancelled'|'no_show'
export type PortalAppointment={startsAt:string;endsAt:string;timeZone:string;service:string;staff:string|null;status:PortalStatus;location:{name:string;address:string}|null}
export type CustomerPortal={authenticated:true;expiresAt:string;scope:'customer'|'appointment';bucket:PortalBucket;page:number;pageSize:20;total:number;items:PortalAppointment[]}
const object=(v:unknown):v is Record<string,unknown>=>Boolean(v&&typeof v==='object'&&!Array.isArray(v))
const text=(v:unknown,max:number)=>{if(typeof v!=='string'||Array.from(v).length>max)throw Error('INVALID_PORTAL_RESPONSE');return v}
const instant=(v:unknown)=>{const s=text(v,50);if(!Number.isFinite(Date.parse(s)))throw Error('INVALID_PORTAL_RESPONSE');return s}
/** Construct a fresh field allowlist at both HTTP and client boundaries. */
export function parseCustomerPortal(value:unknown,now=Date.now()):CustomerPortal|null {
 if(object(value)&&value.authenticated===false)return null
 if(!object(value)||value.authenticated!==true||typeof value.scope!=='string'||!['customer','appointment'].includes(value.scope)||typeof value.bucket!=='string'||!['upcoming','past'].includes(value.bucket)||!Number.isSafeInteger(value.page)||Number(value.page)<1||value.pageSize!==20||!Number.isSafeInteger(value.total)||Number(value.total)<0||!Array.isArray(value.items)||value.items.length>20)throw Error('INVALID_PORTAL_RESPONSE')
 const expiresAt=instant(value.expiresAt),expiry=Date.parse(expiresAt)
 if(expiry<=now||expiry>now+600000)throw Error('INVALID_PORTAL_RESPONSE')
 const items=value.items.map(v=>{
  if(!object(v)||typeof v.status!=='string'||!['booked','arrived','waiting','in_service','completed','cancelled','no_show'].includes(v.status))throw Error('INVALID_PORTAL_RESPONSE')
  const timeZone=text(v.timeZone,100);try{new Intl.DateTimeFormat('en',{timeZone})}catch{throw Error('INVALID_PORTAL_RESPONSE')}
  const startsAt=instant(v.startsAt),endsAt=instant(v.endsAt)
  if(Date.parse(endsAt)<=Date.parse(startsAt))throw Error('INVALID_PORTAL_RESPONSE')
  let location:PortalAppointment['location']=null
  if(v.location!==null){if(!object(v.location))throw Error('INVALID_PORTAL_RESPONSE');location={name:text(v.location.name,120),address:text(v.location.address,500)}}
  return{startsAt,endsAt,timeZone,service:text(v.service,160),staff:v.staff===null?null:text(v.staff,160),status:v.status as PortalStatus,location}
 })
 if(value.scope==='appointment'&&(Number(value.total)>1||items.length>1))throw Error('INVALID_PORTAL_RESPONSE')
 return{authenticated:true,expiresAt,scope:value.scope as CustomerPortal['scope'],bucket:value.bucket as PortalBucket,page:Number(value.page),pageSize:20,total:Number(value.total),items}
}
export function websitePortalUrl(slug:string,locale:'ar'|'en'):string {const url=new URL('/my-appointments',websiteUrl(slug));if(locale==='en')url.searchParams.set('lang','en');return url.href}
