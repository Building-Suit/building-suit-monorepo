import test from 'node:test'
import assert from 'node:assert/strict'
import{createHash}from'node:crypto'
import {createNativeSession,decodeNativeSession}from '../../mobile/doctor/app/utils/nativeSession.ts'
import{createNativeSessionBackend,nativeSessionConfiguration}from'../../mobile/doctor/app/utils/nativeSessionBackend.ts'
import{nativeVaultEvidence}from'../../mobile/doctor/scripts/native-vault-evidence.mjs'
const actor={userId:'d4030000-0000-4000-8000-000000000001',sessionId:'d4030000-0000-4000-8000-000000000002',environment:'local'}
const token={accessToken:'synthetic-access-only',refreshToken:'synthetic-refresh-only',expiresAt:200000}
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve}}
function fixture(){
 let value=null,clears=0,verified=0,protectedClears=0
 const vault={read:async()=>value,write:async v=>{value=v},clear:async()=>{clears++;value=null}}
 const backend={marker:async()=>true,emailExists:async()=>true,signIn:async()=>token,refresh:async()=>({...token,expiresAt:300000}),identity:async()=>{verified++;return actor},revoke:async()=>{},recover:async()=>{},verifyRecovery:async()=>token,password:async()=>{}}
 const session=createNativeSession(backend,vault,undefined,()=>{protectedClears++},()=>100000)
 return{session,backend,vault,get value(){return value},get clears(){return clears},get verified(){return verified},get protectedClears(){return protectedClears}}
}
test('sign-in persists only tokens after a current server identity; state exposes no credentials',async()=>{
 const f=fixture();assert.equal(await f.session.signIn('synthetic@example.test','synthetic-password'),true)
 assert.equal(f.verified,1);assert.deepEqual(f.session.state.identity,actor)
 assert.deepEqual(JSON.parse(f.value),token);assert.equal(JSON.stringify(f.session.state).includes('synthetic-access-only'),false)
})
test('encrypted restore and every foreground resume recheck server identity; lock is not authorization',async()=>{
 const f=fixture();await f.session.signIn('synthetic@example.test','synthetic-password');f.session.lock()
 assert.equal(f.session.accessToken(),null);assert.equal(f.session.state.identity,null)
 assert.equal(await f.session.resume(),true);assert.equal(f.verified,2)
 f.backend.identity=async()=>null;assert.equal(await f.session.resume(),false)
 assert.equal(f.session.state.identity,null);assert.equal(f.value,null)
})
test('unchanged foreground revalidation preserves drafts; revoked or unreachable sessions clear immediately',async()=>{
 const f=fixture();await f.session.signIn('synthetic@example.test','synthetic-password');const before=f.protectedClears
 assert.equal(await f.session.revalidate(),true);assert.equal(f.protectedClears,before)
 const clear=deferred();f.vault.clear=()=>clear.promise;f.backend.identity=async()=>null
 const checking=f.session.revalidate();await new Promise(r=>setImmediate(r))
 assert.equal(f.session.state.identity,null);assert.equal(f.session.accessToken(),null);assert.ok(f.protectedClears>before)
 clear.resolve();assert.equal(await checking,false)
 const g=fixture();await g.session.signIn('synthetic@example.test','synthetic-password');g.backend.identity=async()=>{throw new Error('offline')}
 assert.equal(await g.session.revalidate(),false);assert.equal(g.session.state.identity,null);assert.equal(g.session.accessToken(),null)
})
test('a token expiring during verification cannot become authenticated-looking state',async()=>{
 let clock=100000;const f=fixture(),verified=deferred()
 f.backend.identity=()=>verified.promise
 const session=createNativeSession(f.backend,f.vault,undefined,()=>{},()=>clock)
 const login=session.signIn('synthetic@example.test','synthetic-password');await new Promise(r=>setImmediate(r))
 clock=200001;verified.resolve(actor);assert.equal(await login,false);assert.equal(session.state.identity,null);assert.equal(f.value,null)
 const g=fixture();clock=100000;const active=createNativeSession(g.backend,g.vault,undefined,()=>{},()=>clock)
 assert.equal(await active.signIn('synthetic@example.test','synthetic-password'),true)
 clock=200001;assert.equal(active.identity(),null);assert.equal(active.accessToken(),null)
})
test('expired tokens refresh before identity, and revoked refresh never leaves usable state',async()=>{
 const f=fixture();await f.vault.write(JSON.stringify({...token,expiresAt:1}));let refreshed=0
 f.backend.refresh=async()=>{refreshed++;return token};assert.equal(await f.session.resume(),true);assert.equal(refreshed,1)
 f.session.lock();f.backend.refresh=async()=>{throw Object.assign(new Error('private refresh failure'),{code:'SESSION_REVOKED'})};await f.vault.write(JSON.stringify({...token,expiresAt:1}))
 assert.equal(await f.session.resume(),false);assert.equal(f.session.accessToken(),null);assert.equal(f.session.state.identity,null)
 assert.equal(f.value,null)
})
test('a late revoked identity cannot purge a newer signed-in account',async()=>{
 const f=fixture(),late=deferred();let calls=0
 f.backend.identity=()=>++calls===1?late.promise:Promise.resolve(actor)
 const old=f.session.signIn('old@example.test','synthetic-password');await new Promise(r=>setImmediate(r))
 assert.equal(await f.session.signIn('new@example.test','synthetic-password'),true)
 late.resolve(null);assert.equal(await old,false);assert.deepEqual(JSON.parse(f.value),token);assert.equal(f.session.state.phase,'ready')
})
test('unavailable native storage never falls back to browser storage or usable identity',async()=>{
 const f=fixture();f.vault.read=async()=>{throw new Error('private storage sentinel')}
 assert.equal(await f.session.resume(),false);assert.equal(f.session.state.error,'storage');assert.equal(f.verified,0)
 assert.equal(JSON.stringify(f.session.state).includes('sentinel'),false)
})
const config={url:'http://127.0.0.1:65321',accountUrl:'http://127.0.0.1:3006',publicKey:'sb_publishable_synthetic_public_only',environment:'local',dataMode:'synthetic'}
function provider(){
 const requests=[],contract={product:'doctor-suit',version:1,environment:'local',dataMode:'synthetic',emailStepReady:true,backendBinding:createHash('sha256').update(config.publicKey).digest('hex')}
 let actorId=actor.userId
 const transport=async request=>{
  requests.push(request);const path=new URL(request.url).pathname
  if(path==='/rest/v1/rpc/doctor_runtime_contract')return{status:200,data:{product:'doctor-suit',version:1,data_mode:'synthetic'}}
  if(path==='/api/auth/mobile-contract')return{status:200,data:contract}
  if(path==='/api/auth/email-step')return{status:200,data:{canContinue:request.body.email==='synthetic@example.test'}}
  if(path==='/auth/v1/token'||path==='/auth/v1/verify')return{status:200,data:{access_token:token.accessToken,refresh_token:token.refreshToken,expires_in:3600}}
  if(path==='/auth/v1/user'&&request.method==='GET')return{status:200,data:{id:actor.userId,user_metadata:{owner:true}}}
  if(path==='/rest/v1/rpc/doctor_session_context')return{status:200,data:{product:'doctor-suit',user_id:actorId,session_id:actor.sessionId}}
  return{status:200,data:{}}
 }
 return{requests,contract,transport,set actorId(value){actorId=value},backend:createNativeSessionBackend(config,transport,()=>100000)}
}
test('native configuration rejects hosted/other-port targets, credentials, unknown fields and privileged keys',()=>{
 assert.deepEqual(nativeSessionConfiguration(config),config)
 assert.equal(nativeSessionConfiguration({...config,publicKey:config.publicKey+'\r\nprivate-header: x'}),null)
 for(const patch of [{url:'https://other.supabase.co'},{url:'http://127.0.0.1:61321'},{accountUrl:'https://example.test'},{accountUrl:'http://127.0.0.1:3006/?token=unsafe'},{environment:'production'},{publicKey:'sb_secret_private_sentinel'},{serviceKey:'private sentinel'}])assert.equal(nativeSessionConfiguration({...config,...patch}),null)
})
test('native provider verifies both synthetic backend and matching email-step server before credentials',async()=>{
 const p=provider(),signal=new AbortController().signal
 assert.equal(await p.backend.marker(signal),true)
 assert.equal(await p.backend.emailExists('synthetic@example.test',signal),true)
 assert.equal(await p.backend.emailExists('missing@example.test',signal),false)
 const web=p.requests.filter(r=>r.url.includes(':3006'))
 assert.equal(web.every(r=>!('Authorization'in r.headers)&&!('apikey'in r.headers)),true)
 p.contract.backendBinding='wrong';assert.equal(await p.backend.marker(signal),false)
 assert.equal(p.requests.some(r=>r.body?.password),false)
})
test('native provider binds verified user and server SID, ignores editable metadata and keeps credentials out of URLs',async()=>{
 const p=provider(),signal=new AbortController().signal
 const value=await p.backend.signIn('synthetic@example.test','synthetic-password',signal)
 assert.equal(value.expiresAt,3700000);assert.deepEqual(await p.backend.identity(value.accessToken,signal),actor)
 p.actorId='d4030000-0000-4000-8000-000000000099';assert.equal(await p.backend.identity(value.accessToken,signal),null)
 await p.backend.recover('synthetic@example.test',signal);await p.backend.verifyRecovery('synthetic@example.test','123456',signal)
 assert.equal(p.requests.some(r=>r.url.includes('synthetic-password')||r.url.includes('123456')||r.url.includes(token.accessToken)),false)
 assert.equal(p.requests.find(r=>r.url.endsWith('/auth/v1/verify')).body.type,'recovery')
})
test('native protocol rejects refresh denial and malformed lifetime without exposing provider bodies',async()=>{
 const signal=new AbortController().signal
 const denied=createNativeSessionBackend(config,async()=>({status:400,data:{error:'private sentinel'}}))
 await assert.rejects(()=>denied.refresh('synthetic-refresh',signal),error=>error.code==='SESSION_REVOKED'&&!error.message.includes('sentinel'))
 const invalid=createNativeSessionBackend(config,async()=>({status:200,data:{access_token:token.accessToken,refresh_token:token.refreshToken,expires_in:999999999}}))
 await assert.rejects(()=>invalid.signIn('synthetic@example.test','synthetic-password',signal))
})
test('native evidence requires exact starts/completions and preserves failed/skipped/unrun without private diagnostics',()=>{
 const cls='com.buildingsuit.doctor.synthetic.DoctorSessionVaultTest',expected=[{method:'roundtrip',id:'ciphertext-roundtrip'},{method:'tamper',id:'tamper-denied'}]
 const row=(method,code)=>`INSTRUMENTATION_STATUS: class=${cls}\nINSTRUMENTATION_STATUS: test=${method}\nINSTRUMENTATION_STATUS_CODE: ${code}\n`
 const passed=row('roundtrip',1)+row('roundtrip',0)+row('tamper',1)+row('tamper',0)+'OK (2 tests)\nINSTRUMENTATION_CODE: -1\n'
 assert.equal(nativeVaultEvidence(passed,cls,expected).accepted,true)
 for(const bad of [passed.replace(row('tamper',0),row('tamper',-2)),passed.replace(row('tamper',0),row('tamper',-3)),passed.replace(row('tamper',0),''),passed+row('roundtrip',0),passed.replace('OK (2 tests)','FAILURES!!!'),passed.replaceAll('tamper','private sentinel')]){
  const result=nativeVaultEvidence(bad,cls,expected);assert.equal(result.accepted,false);assert.equal(JSON.stringify(result).includes('private sentinel'),false)
 }
 const mixed=nativeVaultEvidence(row('roundtrip',1)+row('roundtrip',0)+row('tamper',1)+row('tamper',-2)+'private sentinel',cls,expected)
 assert.deepEqual(mixed.cases,[{id:'ciphertext-roundtrip',status:'passed'},{id:'tamper-denied',status:'failed'}])
})
test('real mobile admission handler fails closed and binds only the public key without returning lookup authority',async()=>{
 const names=['defineEventHandler','setResponseHeader','getRequestIP','useRuntimeConfig','createError','fetch'],previous=new Map(names.map(name=>[name,globalThis[name]]))
 const runtime={public:{doctorAuth:{configured:false,environment:'local',url:config.url,key:config.publicKey}},doctorAuthEmailLookupKey:'private_lookup_sentinel'}
 let requests=0,valid=true
 try{
  Object.assign(globalThis,{defineEventHandler:handler=>handler,setResponseHeader:()=>{},getRequestIP:()=> 'owned-synthetic-test',useRuntimeConfig:()=>runtime,createError:input=>Object.assign(new Error(input.statusMessage),input),fetch:async(url,options)=>{
   requests++;assert.equal(new URL(url).origin,config.url);assert.equal(options.redirect,'error')
   assert.equal(options.headers.apikey,config.publicKey);assert.equal(JSON.stringify(options).includes(runtime.doctorAuthEmailLookupKey),false)
   return new Response(JSON.stringify({product:valid?'doctor-suit':'shop-suit',version:1,data_mode:'synthetic'}))
  }})
  const handler=(await import('../../server/api/auth/mobile-contract.get.ts')).default
  await assert.rejects(()=>handler({}),error=>error.statusCode===503);assert.equal(requests,0)
  runtime.public.doctorAuth.configured=true
  const result=await handler({})
  assert.equal(result.backendBinding,createHash('sha256').update(config.publicKey).digest('hex'))
  assert.equal(result.emailStepReady,true);assert.equal(JSON.stringify(result).includes('private_lookup_sentinel'),false)
  valid=false;await assert.rejects(()=>handler({}),error=>error.statusCode===503)
  runtime.public.doctorAuth.environment='production';const before=requests;await assert.rejects(()=>handler({}),error=>error.statusCode===503);assert.equal(requests,before)
 }finally{for(const[name,value]of previous)if(value===undefined)delete globalThis[name];else globalThis[name]=value}
})
test('logout clears local authority and durable credentials even when server revocation is unavailable',async()=>{
 const f=fixture();await f.session.signIn('synthetic@example.test','synthetic-password');f.backend.revoke=async()=>{throw new Error('network')}
 assert.equal(await f.session.signOut(),false);assert.equal(f.value,null);assert.equal(f.session.state.identity,null)
 assert.equal(f.session.state.error,'revocation-unconfirmed');assert.equal(f.session.accessToken(),null)
})
test('logout wins against an in-flight native write and stale server verification',async()=>{
 const f=fixture(),write=deferred();let writing=false;const original=f.vault.write
 f.vault.write=async value=>{writing=true;await write.promise;await original(value)}
 const login=f.session.signIn('synthetic@example.test','synthetic-password')
 while(!writing)await new Promise(r=>setImmediate(r))
 const logout=f.session.signOut();write.resolve();await Promise.all([login,logout]);assert.equal(f.value,null);assert.equal(f.session.state.identity,null)
 const g=fixture(),verify=deferred();g.backend.identity=()=>verify.promise
 const stale=g.session.signIn('synthetic@example.test','synthetic-password');await new Promise(r=>setImmediate(r));await g.session.signOut();verify.resolve(actor)
 assert.equal(await stale,false);assert.equal(g.value,null);assert.equal(g.session.state.identity,null)
})
test('wrong product marker, malformed storage and non-synthetic credential input fail closed',async()=>{
 const f=fixture();f.backend.marker=async()=>false;assert.equal(await f.session.signIn('synthetic@example.test','synthetic-password'),false)
 assert.equal(f.value,null);assert.equal(f.verified,0)
 await f.vault.write('{"accessToken":"private sentinel","serviceKey":"private sentinel"}');assert.equal(await f.session.resume(),false);assert.equal(f.value,null)
 const g=fixture();assert.equal(await g.session.signIn('real@example.com','synthetic-password'),false);assert.equal(g.verified,0)
 assert.throws(()=>decodeNativeSession({...token,userMetadata:{owner:true}}))
 assert.throws(()=>decodeNativeSession({...token,accessToken:'sb_secret_synthetic-only'}))
 const service='eyJhbGciOiJIUzI1NiJ9.'+Buffer.from(JSON.stringify({role:'service_role'})).toString('base64url')+'.synthetic-signature'
 assert.throws(()=>decodeNativeSession({...token,accessToken:service}))
})
test('recovery uses entered OTP, clears prior account scope and verifies new identity after password change',async()=>{
 const f=fixture();await f.session.signIn('synthetic@example.test','synthetic-password');assert.equal(await f.session.recover('synthetic@example.test'),true)
 assert.equal(f.value,null);assert.equal(f.session.state.identity,null);let changed=false
 f.backend.password=async()=>{changed=true};f.backend.identity=async()=>{assert.equal(changed,true);return actor}
 assert.equal(await f.session.completeRecovery('synthetic@example.test','123456','replacement-password'),true)
 assert.equal(await f.session.completeRecovery('synthetic@example.test','?token=unsafe','replacement-password'),false)
 assert.equal(f.session.state.identity,null)
})
