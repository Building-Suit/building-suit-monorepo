import assert from 'node:assert/strict'
import {test} from 'node:test'
import {appointmentReminderEmail} from '../../../../packages/ui/src/utils/appointmentReminderEmail.ts'
import {createAppointmentReminderSender,processAppointmentReminder,reminderConfiguration} from '../../supabase/functions/_shared/appointment-reminders.mjs'
const config={allowlist:['consented@example.test'],from:'reminders@building-suit.com',apiKey:'synthetic-test-key'}
const row={id:'synthetic-queue',leaseToken:'synthetic-lease',to:config.allowlist[0],startsAt:'2026-10-30T00:30:00Z',timeZone:'Africa/Cairo',locale:'en',shopName:'Example <Shop>'}
function fixture({prepared=true,accepted=true,payload=null}={}){const calls=[];return{calls,rpc:async(name,args)=>{calls.push({name,args});if(name==='claim_appointment_email')return{...row,payload};if(name==='prepare_appointment_email')return prepared?args.p_payload:null;if(name==='finish_appointment_email')return accepted;throw Error('unexpected_rpc')}}}
test('private English/Arabic templates escape content and use the schedule timezone including Cairo DST',()=>{
 for(const locale of ['en','ar']){const message=appointmentReminderEmail({...row,locale});assert.ok(message.html.includes(`lang="${locale}" dir="${locale==='ar'?'rtl':'ltr'}"`));assert.ok(message.html.includes('Example &lt;Shop&gt;'));assert.ok(message.text.includes('Africa/Cairo'));assert.ok(!message.html.includes('href=')&&!message.html.includes('<img'));assert.ok(message.html.length<10000)}
 const before=appointmentReminderEmail({...row,startsAt:'2026-10-29T20:30:00Z'}),after=appointmentReminderEmail({...row,startsAt:'2026-10-30T00:30:00Z'})
 assert.match(before.text,/23:30/);assert.match(after.text,/02:30/);assert.throws(()=>appointmentReminderEmail({...row,timeZone:'invalid'}))
})
test('sender requires exact worker authorization and explicit test allowlist; disabled/live/invalid config never touches DB/provider',async()=>{
 let calls=0;const values={SHOP_REMINDER_WORKER_TOKEN:'x'.repeat(32),SHOP_REMINDER_FROM:config.from,RESEND_API_KEY:config.apiKey,SUPABASE_URL:'https://example.invalid',SUPABASE_SERVICE_ROLE_KEY:'synthetic',SHOP_REMINDER_TEST_ALLOWLIST:row.to}
 const handler=createAppointmentReminderSender({env:key=>values[key],rpc:async()=>{calls++;return null},fetchImpl:async()=>{throw Error('forbidden')}})
 for(const mode of [undefined,'disabled','live','TEST']){values.SHOP_REMINDER_DELIVERY_MODE=mode;assert.equal((await handler(new Request('https://worker.invalid',{method:'POST',headers:{authorization:`Bearer ${values.SUPABASE_SERVICE_ROLE_KEY}`,'x-shop-reminder-worker-token':values.SHOP_REMINDER_WORKER_TOKEN}}))).status,503)}
 values.SHOP_REMINDER_DELIVERY_MODE='test';assert.equal((await handler(new Request('https://worker.invalid',{method:'POST'}))).status,401);assert.equal(calls,0)
 assert.equal((await handler(new Request('https://worker.invalid',{method:'POST',headers:{authorization:`Bearer ${values.SUPABASE_SERVICE_ROLE_KEY}`,'x-shop-reminder-worker-token':values.SHOP_REMINDER_WORKER_TOKEN}}))).status,200);assert.equal(calls,1)
 values.SHOP_REMINDER_TEST_ALLOWLIST='*';assert.equal(reminderConfiguration(key=>values[key]),null)
})
test('cancelled consent or exhausted budget after claim prevents the provider side effect',async()=>{
 const f=fixture({prepared:false});let sent=0;assert.equal(await processAppointmentReminder({...f,configuration:config,fetchImpl:async()=>{sent++}}),'deferred');assert.equal(sent,0);assert.equal(f.calls.length,2)
})
test('mocked provider accepts one frozen payload with stable idempotency key',async()=>{
 const f=fixture();let request;assert.equal(await processAppointmentReminder({...f,configuration:config,fetchImpl:async(url,options)=>{request={url,...options};return Response.json({id:'mock-receipt'})}}),'sent')
 assert.equal(request.url,'https://api.resend.com/emails');assert.equal(request.headers['idempotency-key'],'shop-appointment/synthetic-queue');assert.deepEqual(JSON.parse(request.body).to,[row.to]);assert.deepEqual(f.calls.at(-1).args,{p_id:row.id,p_lease_token:row.leaseToken,p_status:'sent',p_provider_id:'mock-receipt'})
})
test('uncertain, throttled, permanent and superseded outcomes do not leak provider bodies or resend in-process',async()=>{
 for(const [response,status] of [[()=>{throw Error('private body')},'retry'],[()=>new Response('private',{status:429}),'retry'],[()=>new Response('private',{status:400}),'review_required'],[()=>Response.json({}),'retry']]){
  const f=fixture();let sends=0;assert.equal(await processAppointmentReminder({...f,configuration:config,fetchImpl:async()=>{sends++;return response()}}),status);assert.equal(sends,1);assert.ok(!JSON.stringify(f.calls).includes('private body'))
 }
 const f=fixture({accepted:false});assert.equal(await processAppointmentReminder({...f,configuration:config,fetchImpl:async()=>Response.json({id:'accepted-before-cancel'})}),'superseded')
})
test('retry reuses frozen provider payload across template/from changes and rejects unallowlisted rows',async()=>{
 const frozen={from:config.from,to:[row.to],subject:'Frozen',html:'old',text:'old'},f=fixture({payload:frozen});await processAppointmentReminder({...f,configuration:{...config,from:'changed@building-suit.com'},fetchImpl:async(url,options)=>{assert.equal(options.body,JSON.stringify(frozen));return Response.json({id:'same-receipt'})}})
 const denied=fixture();await assert.rejects(()=>processAppointmentReminder({...denied,configuration:{...config,allowlist:['other@example.test']},fetchImpl:async()=>{throw Error('must not send')}}),/RECIPIENT_DENIED/);assert.equal(denied.calls.length,1)
})
