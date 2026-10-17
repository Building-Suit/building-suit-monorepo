import {randomBytes,randomUUID} from 'node:crypto'
export const combinations=shop=>[{service:shop==='alpha-tools'?'11111111-1111-4111-8111-111111111111':'22222222-2222-4222-8222-222222222222',location:shop==='alpha-tools'?'33333333-3333-4333-8333-333333333333':'44444444-4444-4444-8444-444444444444',staff:shop==='alpha-tools'?'55555555-5555-4555-8555-555555555555':'66666666-6666-4666-8666-666666666666',serviceName:shop==='alpha-tools'?'Alpha appointment':'Beta appointment',locationName:shop==='alpha-tools'?'Alpha public studio':'Beta public office',address:'Public street',staffName:'Public specialist',duration:30}]
export function createBookingFixture(){
 const sessions=new Map(),appointments=new Map(),commands=new Map();let enabled=true
 const add=(shop,customer,startsAt)=>{const c=combinations(shop)[0],row={reference:randomUUID(),shop,customer,startsAt,endsAt:new Date(Date.parse(startsAt)+1800000).toISOString(),service:c.serviceName,staff:c.staffName,timeZone:'Africa/Cairo',status:'booked',canCancel:true,canReschedule:true,serviceRef:c.service,locationRef:c.location,staffRef:c.staff,location:{name:c.locationName,address:c.address}};appointments.set(row.reference,row);return row}
 function reset(){sessions.clear();appointments.clear();commands.clear();enabled=true;const day=new Date(Date.now()+86400000).toISOString().slice(0,10);for(const shop of ['alpha-tools','beta-tools']){add(shop,'customer-a',day+'T12:00:00.000Z');add(shop,'customer-b',day+'T13:00:00.000Z')}}reset()
 const valid=(shop,token)=>{const s=sessions.get(token);return s&&s.shop===shop&&Date.parse(s.expiresAt)>Date.now()?s:null}
 const own=(s,row)=>row.shop===s.shop&&(s.customer?row.customer===s.customer:row.reference===s.reference)
 const mint=(shop,customer,reference)=>{const token=randomBytes(32).toString('base64url'),expiresAt=new Date(Date.now()+590000).toISOString();sessions.set(token,{shop,customer,reference,expiresAt});return{ok:true,token,expiresAt}}
 function rpc(name,a){
  if(name==='control'){reset();enabled=a.enabled??true;return{ok:true}}
  const s=valid(a.p_slug,a.p_token),combo=combinations(a.p_slug)[0]
  if(name==='appointment_access_verify'){
   if(a.p_phone!=='201000000002')return{ok:false}
   if(['5678ABCDEFGH','9ABCABCDEFGH'].includes(a.p_code))return mint(a.p_slug,a.p_code==='5678ABCDEFGH'?'customer-a':'customer-b',null)
   const row=[...appointments.values()].find(r=>r.shop===a.p_slug&&!r.customer)
   return a.p_code==='0123ABCDEFGH'&&row?mint(a.p_slug,null,row.reference):{ok:false}
  }
  if(name==='appointment_access_session_revoke'){sessions.delete(a.p_token);return{ok:true}}
  if(name==='appointment_access_session_validate')return s?{ok:true,expiresAt:s.expiresAt}:{ok:false}
  if(name==='appointment_booking_options')return !enabled||a.p_slug==='disabled-tools'?{enabled:false}:{enabled:true,authenticated:Boolean(s),scope:s?s.customer?'customer':'appointment':'guest',expiresAt:s?.expiresAt??null,leadMinutes:0,horizonDays:30,changeNoticeMinutes:60,allowReschedule:true,allowCancel:true,remindersEnabled:false,combinations:[combo],privatePhone:'PRIVATE-CONTACT'}
  if(name==='appointment_booking_slots'){
   if(!enabled||a.p_service!==combo.service||a.p_location!==combo.location||a.p_staff!==combo.staff||a.p_reference&&(!s||!appointments.has(a.p_reference)||!own(s,appointments.get(a.p_reference))))return{slots:[]}
   return{slots:[8,9,10,11].map(h=>({startsAt:a.p_date+`T${String(h).padStart(2,'0')}:00:00.000Z`,endsAt:a.p_date+`T${String(h).padStart(2,'0')}:30:00.000Z`,timeZone:'Africa/Cairo'})).filter(slot=>![...appointments.values()].some(r=>r.shop===a.p_slug&&r.reference!==a.p_reference&&r.status==='booked'&&r.startsAt===slot.startsAt))}
  }
  if(name==='appointment_reminder_preference'){
   const row=appointments.get(a.p_reference)
   if(!s?.customer||!row||!own(s,row)||row.status!=='booked'||typeof a.p_enabled!=='boolean'||!['en','ar'].includes(a.p_locale))return{ok:false}
   row.reminderEnabled=a.p_enabled;return{ok:true}
  }
  if(name==='appointment_booking_manage'){
   if(!s||!enabled)return{authenticated:false}
   const rows=[...appointments.values()].filter(r=>own(s,r)&&r.status==='booked').sort((a,b)=>a.startsAt.localeCompare(b.startsAt))
   return{authenticated:true,expiresAt:s.expiresAt,scope:s.customer?'customer':'appointment',page:a.p_page,total:rows.length,items:rows.slice((a.p_page-1)*20,a.p_page*20).map(r=>({...r,reminderEligible:Boolean(s.customer),reminderEnabled:r.reminderEnabled??false,notes:'PRIVATE-NOTES',payments:'PRIVATE-PAYMENTS'}))}
  }
  if(name==='appointment_booking_command'){
   if(!enabled||a.p_token&&!s)return{ok:false,accessEnded:true}
   const key=a.p_slug+':'+a.p_request_key,prior=commands.get(key);if(prior)return prior
   let row,session,code=null
   if(a.p_operation==='create'){
    if(s&&!s.customer||!s&&(!a.p_name||!a.p_phone)||[...appointments.values()].some(r=>r.shop===a.p_slug&&r.status==='booked'&&r.startsAt===a.p_starts_at))return{ok:false}
    row=add(a.p_slug,s?.customer??null,a.p_starts_at);if(!s){session=mint(a.p_slug,null,row.reference);code='0123ABCDEFGH'}
   }else{
    row=appointments.get(a.p_reference);if(!s||!row||!own(s,row)||row.status!=='booked')return{ok:false}
    if(a.p_operation==='cancel')row.status='cancelled'
    else if(a.p_operation==='reschedule'){row.startsAt=a.p_starts_at;row.endsAt=new Date(Date.parse(row.startsAt)+1800000).toISOString()}
    else return{ok:false}
   }
   const result={ok:true,reference:row.reference,code,expiresAt:s?.expiresAt,...session,privateCustomerId:'PRIVATE-ID'};commands.set(key,result);return result
  }
  if(name==='appointment_customer_portal'){
   if(!s)return{authenticated:false}
   const rows=[...appointments.values()].filter(r=>own(s,r)&&(a.p_bucket==='past'?r.status!=='booked':r.status==='booked'))
   return{authenticated:true,expiresAt:s.expiresAt,scope:s.customer?'customer':'appointment',bucket:a.p_bucket,page:a.p_page,pageSize:20,total:rows.length,items:rows.map(r=>({...r,reminderEligible:Boolean(s.customer),reminderEnabled:r.reminderEnabled??false,notes:'PRIVATE'}))}
  }
  return{ok:false}
 }
 return{rpc}
}
