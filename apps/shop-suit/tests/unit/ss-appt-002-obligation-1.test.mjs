import test from 'node:test'
import assert from 'node:assert/strict'
import {parseBookingOptions,parseBookingSlots,parseBookingManagement,parseBookingSettings} from '../../shared/appointmentBooking.ts'
import {createBookingFixture,combinations} from '../fixtures/public-booking.mjs'
test('public booking adapters reconstruct only bounded public choices, slots and scoped management fields',()=>{
 const model=createBookingFixture(),shop='alpha-tools',c=combinations(shop)[0]
 const options=parseBookingOptions(model.rpc('appointment_booking_options',{p_slug:shop}));assert.equal(options.enabled,true);assert.equal(options.scope,'guest');assert.equal(options.remindersEnabled,false);assert.ok(!JSON.stringify(options).includes('PRIVATE'))
 const day=new Date(Date.now()+86400000).toISOString().slice(0,10),slots=parseBookingSlots(model.rpc('appointment_booking_slots',{p_slug:shop,p_service:c.service,p_location:c.location,p_staff:c.staff,p_date:day}));assert.equal(slots.length,4)
 const session=model.rpc('appointment_access_verify',{p_slug:shop,p_code:'5678ABCDEFGH',p_phone:'201000000002'})
 const management=parseBookingManagement(model.rpc('appointment_booking_manage',{p_slug:shop,p_token:session.token,p_page:1}));assert.equal(management.items.length,1);assert.ok(!JSON.stringify(management).includes('PRIVATE'));assert.ok(!('customerId' in management.items[0]))
 assert.deepEqual(parseBookingOptions({enabled:false,private:'SECRET'}),{enabled:false});assert.equal(parseBookingManagement({authenticated:false,items:[{notes:'PRIVATE'}]}),null)
 assert.throws(()=>parseBookingOptions({...options,scope:['guest']}));assert.equal(parseBookingOptions({...options,remindersEnabled:true}).remindersEnabled,true);assert.throws(()=>parseBookingOptions({...options,remindersEnabled:'true'}));assert.throws(()=>parseBookingSlots({slots:[{startsAt:'bad',endsAt:'bad',timeZone:'invalid'}]}));assert.throws(()=>parseBookingManagement({...management,scope:'appointment',total:2}));assert.throws(()=>parseBookingManagement({...management,expiresAt:new Date(Date.now()-1).toISOString()}))
 const settings={policy:{enabled:false,lead_minutes:60,horizon_days:30,change_notice_minutes:120,allow_reschedule:true,allow_cancel:true,reminder_lead_minutes:1440,reminders_enabled:false,reminder_channel:null},staff:[]};assert.equal(parseBookingSettings(settings).policy.enabled,false);assert.throws(()=>parseBookingSettings({...settings,policy:{...settings.policy,reminders_enabled:true}}))
})
