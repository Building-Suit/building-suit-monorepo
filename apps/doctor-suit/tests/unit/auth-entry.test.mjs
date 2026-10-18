import test from'node:test'
import assert from'node:assert/strict'
import{doctorAuthEntryRedirect}from'../../app/utils/authEntry.ts'
import{doctorAuthSetupReport,doctorVerifyAuthSetup}from'../../app/utils/authDiagnostics.ts'
const env={APP_ENV:'local',APP_URL:'http://localhost:3006',DOCTOR_SUPABASE_URL:'https://doctor.example.test',DOCTOR_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_SYNTHETIC_ONLY'}
test('exact legacy entries preserve only canonical safe return paths and intended PKCE reset material',()=>{
 assert.deepEqual(doctorAuthEntryRedirect('/auth/login',{returnTo:'/account?private=discard',code:'discard',token:'discard'}),{path:'/sign-in',query:{next:'/account'}})
 assert.deepEqual(doctorAuthEntryRedirect('/auth/login/',{next:'//evil.example.test'}),{path:'/sign-in',query:{next:'/workspace'}})
 assert.deepEqual(doctorAuthEntryRedirect('/auth/signup',{}),{path:'/sign-up',query:{}})
 assert.deepEqual(doctorAuthEntryRedirect('/auth/forgot-password',{code:'discard'}),{path:'/recover',query:{}})
 assert.deepEqual(doctorAuthEntryRedirect('/auth/reset-password',{code:'synthetic-code',sb_flow_id:'synthetic-flow-123',redirect:'https://evil.example.test'}),{path:'/recover',query:{code:'synthetic-code',sb_flow_id:'synthetic-flow-123'}})
 for(const p of['/auth/unknown','/auth/login/extra','/sign-in','/auth/login//'])assert.equal(doctorAuthEntryRedirect(p,{}),null)
})
test('auth diagnostics distinguish missing Doctor fields, deliberate runtime disable and unverified configuration without plans',()=>{
 assert.deepEqual(doctorAuthSetupReport({SUPABASE_URL:'https://other.example.test',SUPABASE_KEY:'other'}).missing,['DOCTOR_SUPABASE_URL','DOCTOR_SUPABASE_PUBLISHABLE_KEY'])
 assert.equal(doctorAuthSetupReport(env).status,'configured_unverified')
 assert.equal(doctorAuthSetupReport({...env,DOCTOR_PLAN:'unconfigured'}).configured,true)
 assert.equal(doctorAuthSetupReport({...env,DOCTOR_SUPABASE_PUBLISHABLE_KEY:'sb_secret_NEVER'}).errorCode,'DOCTOR_PUBLIC_KEY_REQUIRED')
 assert.equal(doctorAuthSetupReport({NUXT_PUBLIC_DOCTOR_AUTH_CONFIGURED:'false'},true).status,'explicitly_disabled')
 assert.equal(JSON.stringify(doctorAuthSetupReport(env)).includes(env.DOCTOR_SUPABASE_PUBLISHABLE_KEY),false)
 assert.equal(JSON.stringify(doctorAuthSetupReport(env)).includes(env.DOCTOR_SUPABASE_URL),false)
})
test('optional verification admits only the Doctor marker and makes no credential or entitlement request',async()=>{
 let calls=0
 const request=async(url,options)=>{calls++;assert.equal(url,'https://doctor.example.test/rest/v1/rpc/doctor_runtime_contract');assert.equal(options.method,'POST');assert.equal(options.redirect,'error');assert.equal(options.body,'{}');return new Response(JSON.stringify({product:'doctor-suit',version:1,data_mode:'synthetic'}))}
 assert.equal((await doctorVerifyAuthSetup(env,false,request)).marker,'verified');assert.equal(calls,1)
 assert.equal((await doctorVerifyAuthSetup({},false,request)).status,'unconfigured');assert.equal(calls,1)
 for(const data of[{product:'shop-suit',version:1,data_mode:'synthetic'},{product:'doctor-suit',version:2,data_mode:'synthetic'},{product:'doctor-suit',version:1,data_mode:'live'}])assert.equal((await doctorVerifyAuthSetup(env,false,async()=>new Response(JSON.stringify(data)))).marker,'wrong_or_missing_marker')
 assert.equal((await doctorVerifyAuthSetup(env,false,async()=>{throw new Error('private provider detail')})).marker,'unreachable_or_invalid_response')
})
