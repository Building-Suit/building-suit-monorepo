import {websiteUrl,websiteDomain} from './websiteAddress.ts'
import {publicWebsiteQuery} from './publicWebsite.ts'
export const bookingUuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
const object=(v:unknown):v is Record<string,unknown>=>Boolean(v&&typeof v==='object'&&!Array.isArray(v))
const text=(v:unknown,max:number)=>{if(typeof v!=='string'||Array.from(v).length>max)throw Error('INVALID_BOOKING_RESPONSE');return v}
const integer=(v:unknown,min:number,max:number)=>{if(!Number.isSafeInteger(v)||Number(v)<min||Number(v)>max)throw Error('INVALID_BOOKING_RESPONSE');return Number(v)}
const bool=(v:unknown)=>{if(typeof v!=='boolean')throw Error('INVALID_BOOKING_RESPONSE');return v}
const uuid=(v:unknown)=>{if(!bookingUuid(v))throw Error('INVALID_BOOKING_RESPONSE');return v}
const instant=(v:unknown)=>{const s=text(v,50);if(!Number.isFinite(Date.parse(s)))throw Error('INVALID_BOOKING_RESPONSE');return s}
export function bookingExpiry(v:unknown){const s=instant(v),t=Date.parse(s);if(t<=Date.now()||t>Date.now()+600000)throw Error('INVALID_BOOKING_RESPONSE');return s}
export type BookingScope='guest'|'customer'|'appointment'
export type BookingCombination={service:string;location:string;staff:string;serviceName:string;locationName:string;address:string;staffName:string;duration:number}
export type BookingOptions={enabled:false}|{enabled:true;authenticated:boolean;scope:BookingScope;expiresAt:string|null;leadMinutes:number;horizonDays:number;changeNoticeMinutes:number;allowReschedule:boolean;allowCancel:boolean;remindersEnabled:boolean;combinations:BookingCombination[]}
export function parseBookingOptions(v:unknown):BookingOptions{
 if(object(v)&&v.enabled===false)return{enabled:false}
 if(!object(v)||v.enabled!==true||typeof v.scope!=='string'||!['guest','customer','appointment'].includes(v.scope)||!Array.isArray(v.combinations)||v.combinations.length>500||typeof v.remindersEnabled!=='boolean')throw Error('INVALID_BOOKING_RESPONSE')
 const authenticated=bool(v.authenticated),scope=v.scope as BookingScope
 if(authenticated===(scope==='guest'))throw Error('INVALID_BOOKING_RESPONSE')
 return{enabled:true,authenticated,scope,expiresAt:authenticated?bookingExpiry(v.expiresAt):null,leadMinutes:integer(v.leadMinutes,0,10080),horizonDays:integer(v.horizonDays,1,90),changeNoticeMinutes:integer(v.changeNoticeMinutes,0,10080),allowReschedule:bool(v.allowReschedule),allowCancel:bool(v.allowCancel),remindersEnabled:bool(v.remindersEnabled),combinations:v.combinations.map(c=>{if(!object(c))throw Error('INVALID_BOOKING_RESPONSE');return{service:uuid(c.service),location:uuid(c.location),staff:uuid(c.staff),serviceName:text(c.serviceName,160),locationName:text(c.locationName,120),address:text(c.address,500),staffName:text(c.staffName,120),duration:integer(c.duration,1,2880)}})}
}
export type BookingSlot={startsAt:string;endsAt:string;timeZone:string}
function zone(v:unknown){const s=text(v,100);try{new Intl.DateTimeFormat('en',{timeZone:s})}catch{throw Error('INVALID_BOOKING_RESPONSE')}return s}
export function parseBookingSlots(v:unknown):BookingSlot[]{if(!object(v)||!Array.isArray(v.slots)||v.slots.length>200)throw Error('INVALID_BOOKING_RESPONSE');return v.slots.map(s=>{if(!object(s))throw Error('INVALID_BOOKING_RESPONSE');const startsAt=instant(s.startsAt),endsAt=instant(s.endsAt);if(Date.parse(endsAt)<=Date.parse(startsAt))throw Error('INVALID_BOOKING_RESPONSE');return{startsAt,endsAt,timeZone:zone(s.timeZone)}})}
export type ManagedBooking={reference:string;startsAt:string;endsAt:string;service:string;staff:string;timeZone:string;canCancel:boolean;canReschedule:boolean;reminderEligible:boolean;reminderEnabled:boolean;serviceRef:string|null;locationRef:string|null;staffRef:string|null;location:{name:string;address:string}|null}
export type BookingManagement={authenticated:true;expiresAt:string;scope:'customer'|'appointment';page:number;total:number;items:ManagedBooking[]}
export function parseBookingManagement(v:unknown):BookingManagement|null{
 if(object(v)&&v.authenticated===false)return null
 if(!object(v)||v.authenticated!==true||typeof v.scope!=='string'||!['customer','appointment'].includes(v.scope)||!Array.isArray(v.items)||v.items.length>20)throw Error('INVALID_BOOKING_RESPONSE')
 const items=v.items.map(a=>{if(!object(a))throw Error('INVALID_BOOKING_RESPONSE');const startsAt=instant(a.startsAt),endsAt=instant(a.endsAt),canReschedule=bool(a.canReschedule);if(Date.parse(endsAt)<=Date.parse(startsAt))throw Error('INVALID_BOOKING_RESPONSE');let location:ManagedBooking['location']=null;if(a.location!==null){if(!object(a.location))throw Error('INVALID_BOOKING_RESPONSE');location={name:text(a.location.name,120),address:text(a.location.address,500)}}const serviceRef=a.serviceRef===null?null:uuid(a.serviceRef),locationRef=a.locationRef===null?null:uuid(a.locationRef),staffRef=a.staffRef===null?null:uuid(a.staffRef);if(canReschedule&&(!serviceRef||!locationRef||!staffRef))throw Error('INVALID_BOOKING_RESPONSE');return{reference:uuid(a.reference),startsAt,endsAt,service:text(a.service,160),staff:text(a.staff,160),timeZone:zone(a.timeZone),canCancel:bool(a.canCancel),canReschedule,reminderEligible:a.reminderEligible===undefined?false:bool(a.reminderEligible),reminderEnabled:a.reminderEnabled===undefined?false:bool(a.reminderEnabled),serviceRef,locationRef,staffRef,location}})
 const total=integer(v.total,0,Number.MAX_SAFE_INTEGER)
 if(v.scope==='appointment'&&(total>1||items.length>1))throw Error('INVALID_BOOKING_RESPONSE')
 return{authenticated:true,scope:v.scope as BookingManagement['scope'],expiresAt:bookingExpiry(v.expiresAt),page:integer(v.page,1,100000),total,items}
}
export type BookingPolicy={enabled:boolean;lead_minutes:number;horizon_days:number;change_notice_minutes:number;allow_reschedule:boolean;allow_cancel:boolean;reminder_lead_minutes:number;reminders_enabled?:boolean}
export type BookingSettings={policy:BookingPolicy;staff:{membershipId:string;name:string;publicName:string;published:boolean}[]}
export function emptyBookingPolicy():BookingPolicy{return{enabled:false,lead_minutes:60,horizon_days:30,change_notice_minutes:120,allow_reschedule:true,allow_cancel:true,reminder_lead_minutes:1440,reminders_enabled:false}}
export function parseBookingSettings(v:unknown):BookingSettings{
 if(!object(v)||!object(v.policy)||!Array.isArray(v.staff)||v.staff.length>2000||typeof v.policy.reminders_enabled!=='boolean'||v.policy.reminder_channel!==(v.policy.reminders_enabled?'email':null))throw Error('INVALID_BOOKING_RESPONSE')
 const p=v.policy;return{policy:{enabled:bool(p.enabled),lead_minutes:integer(p.lead_minutes,0,10080),horizon_days:integer(p.horizon_days,1,90),change_notice_minutes:integer(p.change_notice_minutes,0,10080),allow_reschedule:bool(p.allow_reschedule),allow_cancel:bool(p.allow_cancel),reminder_lead_minutes:integer(p.reminder_lead_minutes,15,10080),reminders_enabled:bool(p.reminders_enabled)},staff:v.staff.map(s=>{if(!object(s))throw Error('INVALID_BOOKING_RESPONSE');return{membershipId:uuid(s.membershipId),name:text(s.name,160),publicName:text(s.publicName,120),published:bool(s.published)}})}
}
export function websiteBookingUrl(slug:string,locale:'en'|'ar',domain:string=websiteDomain,service?:string){const u=new URL('/book',websiteUrl(slug,domain));if(locale==='en')u.searchParams.set('lang','en');if(service&&bookingUuid(service))u.searchParams.set('service',service);return u.href}
export function bookingPageQuery(query:URLSearchParams){const params=new URLSearchParams(query);const service=params.get('service');if(params.getAll('service').length>1||service!==null&&!bookingUuid(service))throw Error('INVALID_BOOKING_QUERY');params.delete('service');return{...publicWebsiteQuery(params),service:service??undefined}}
