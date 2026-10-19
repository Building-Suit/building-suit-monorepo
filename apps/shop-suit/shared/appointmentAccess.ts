/** Canonical public credential syntax; no country is inferred or prepended. */
export function normalizeAppointmentAccessPhone(value:unknown):string|null {
 if(typeof value!=='string'||value.length>40)return null
 const raw=value.trim().replace(/[٠-٩۰-۹]/g,c=>String('٠١٢٣٤٥٦٧٨٩'.includes(c)?c.charCodeAt(0)-1632:c.charCodeAt(0)-1776))
 if(!/^\+?[0-9][0-9 ().-]{5,39}$/.test(raw))return null
 let digits=raw.replace(/\D/g,'');if(raw.startsWith('00'))digits=digits.slice(2)
 return digits.length>=7&&digits.length<=15?digits:null
}
export function normalizeAppointmentAccessCode(value:unknown):string|null {
 if(typeof value!=='string'||value.length>32)return null
 const code=value.replace(/[ -]/g,'').toUpperCase()
 return /^[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{12}$/.test(code)?code:null
}
export type AppointmentAccessStatus={enabled:boolean;usablePhone:boolean;issuedAt:string|null}
export function parseAppointmentAccessStatus(value:unknown):AppointmentAccessStatus {
 if(!value||typeof value!=='object')throw Error('ACCESS_UNAVAILABLE')
 const s=value as Record<string,unknown>
 if(typeof s.enabled!=='boolean'||typeof s.usablePhone!=='boolean'||s.issuedAt!==null&&(typeof s.issuedAt!=='string'||!Number.isFinite(Date.parse(s.issuedAt))))throw Error('ACCESS_UNAVAILABLE')
 return{enabled:s.enabled,usablePhone:s.usablePhone,issuedAt:s.issuedAt as string|null}
}
export type AppointmentAccessSession={ok:true;token:string;expiresAt:string}
export function parseAppointmentAccessSession(value:unknown,now=Date.now()):AppointmentAccessSession|null {
 if(!value||typeof value!=='object')return null
 const s=value as Record<string,unknown>,expiry=typeof s.expiresAt==='string'?Date.parse(s.expiresAt):NaN
 if(s.ok!==true||typeof s.token!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(s.token)||!Number.isFinite(expiry)||expiry<=now||expiry>now+600000)return null
 return{ok:true,token:s.token,expiresAt:s.expiresAt as string}
}
