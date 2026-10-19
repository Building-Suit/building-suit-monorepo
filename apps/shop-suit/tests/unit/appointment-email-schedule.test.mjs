import {spawnSync} from 'node:child_process'
import assert from 'node:assert/strict'
import {test} from 'node:test'
import {configureShopReminderSchedule} from '../../../../tooling/database/configure-shop-reminder-schedule.mjs'
const approved={CI:'true',GITHUB_ACTIONS:'true',GITHUB_REF:'refs/heads/stg',GITHUB_SHA:'a'.repeat(40),SHOP_REMINDER_APPROVED_SHA:'a'.repeat(40),SHOP_REMINDER_SCHEDULE_APPROVED:'true',SHOP_REMINDER_SCHEDULE_SERVICE_ROLE_KEY:'synthetic-ci-service-key-'.repeat(2)}
test('schedule configuration refuses local, feature-branch, wrong SHA and unapproved calls before transport',async()=>{
 let requests=0
 for(const patch of [{CI:'false'},{GITHUB_ACTIONS:'false'},{GITHUB_REF:'refs/heads/feature'},{GITHUB_SHA:'bad'},{SHOP_REMINDER_APPROVED_SHA:'b'.repeat(40)},{SHOP_REMINDER_SCHEDULE_APPROVED:'false'}]){
  const values={...approved,...patch};await assert.rejects(()=>configureShopReminderSchedule({environment:'staging',enabled:true,env:name=>values[name],fetchImpl:async()=>{requests++}}),/CI_APPROVAL_REQUIRED/)
 }
 assert.equal(requests,0)
})
test('approved CI enable/disable binds immutable registry project and emits only safe configuration result',async()=>{
 for(const [environment,ref,project] of [['staging','stg','jvvelvftpfnlogalgxgv'],['production','main','fgdzjnsbcxfbiuogbmom']])for(const enabled of [true,false]){
  const values={...approved,GITHUB_REF:'refs/heads/'+ref};let calls=0
  const result=await configureShopReminderSchedule({environment,enabled,env:name=>values[name],fetchImpl:async(url,options)=>{
   calls++;assert.equal(url,`https://${project}.supabase.co/rest/v1/rpc/shop_appointment_email_schedule`);assert.equal(options.redirect,'error');assert.equal(options.headers.authorization,'Bearer '+values.SHOP_REMINDER_SCHEDULE_SERVICE_ROLE_KEY);assert.deepEqual(JSON.parse(options.body),{p_enabled:enabled,p_project_ref:project});return Response.json({enabled,projectRef:project,jobId:enabled?321:null,unexpectedPrivateField:'must-not-log'})
  }})
  assert.equal(calls,1);assert.equal(result.enabled,enabled);assert.ok(!JSON.stringify(result).includes('synthetic-ci'));assert.ok(!JSON.stringify(result).includes('must-not-log'))
 }
})
test('configuration rejects provider errors/mismatched results without reflecting response bodies',async()=>{
 for(const response of [()=>{throw Error('secret provider body')},()=>new Response('secret provider body',{status:200}),()=>new Response('secret provider body',{status:403}),()=>Response.json({enabled:true,projectRef:'foreign-project',jobId:1}),()=>Response.json({enabled:true,projectRef:'jvvelvftpfnlogalgxgv',jobId:null})]){
  await assert.rejects(()=>configureShopReminderSchedule({environment:'staging',enabled:true,env:name=>approved[name],fetchImpl:async()=>response()}),error=>!error.message.includes('secret provider')&&/REMINDER_SCHEDULE/.test(error.message))
 }
})

test('deployment email is generated from the canonical UI source without a second editable template',()=>{
 const result=spawnSync(process.execPath,['tooling/ui/build-appointment-reminder-email.mjs','--check'],{encoding:'utf8'});assert.equal(result.status,0,result.stderr)
})
