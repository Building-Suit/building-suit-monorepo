import test from'node:test'
import assert from'node:assert/strict'
import{doctorAdministrationPath,doctorAdministrationDigest,doctorAdministrationSignature,handleDoctorAdministration}from'../../supabase/functions/_shared/doctor-administration.mjs'
import{syntheticDoctorAdminId as id,syntheticDoctorAdminNow as now,syntheticDoctorAdminMaterial as material,syntheticDoctorAdminConfiguration as configuration,syntheticDoctorAdminPacket as packet}from'../helpers/administration-packet.mjs'
function harness(binding=configuration()){
 const seen=new Set(),audits=[],reads=[]
 return{seen,audits,reads,dependencies:{now:()=>now,loadBinding:async()=>binding,readVerificationKey:async reference=>{assert.equal(reference,'synthetic-fixture:memory-only');return material},consumeNonce:async receipt=>{const key=[receipt.sourceBindingId,receipt.keyId,receipt.nonce].join(':');if(seen.has(key))return false;seen.add(key);return true},readTargetSubject:async subject=>{reads.push(subject);return{subscriberUserId:subject,practiceId:id(12),authVerified:true,storedOwner:true,state:'trial',subscriptionRevision:1}},appendAudit:async entry=>{audits.push(entry);return id(13)}}}
}
test('signed Doctor read is environment/operator bound, response HMAC echoes exact request and audit contains no payload',async()=>{
 const h=harness(),request=await packet(),result=await handleDoctorAdministration(request,h.dependencies),body=JSON.parse(new TextDecoder().decode(result.bytes))
 assert.equal(result.status,200);assert.equal(body.data.subscriberUserId,id(11));assert.equal(body.data.paymentConfirmed,false);assert.equal(body.data.operatorGrantAvailable,false)
 assert.equal(result.headers['x-bs-body-sha256'],await doctorAdministrationDigest(result.bytes))
 const responseInput=['BS-S2S-RESPONSE-HMAC-SHA256','1.0','synthetic-key-v1',id(8),id(9),id(1),id(3),id(5),'synthetic-doctor-fixture','200',body.requestDigest,result.headers['x-bs-body-sha256']].join('\n')
 assert.equal(result.headers['x-bs-signature'],await doctorAdministrationSignature(material,responseInput))
 assert.equal(h.audits.length,1);assert.equal(h.audits[0].outcome,'synthetic_read');assert.ok(!Object.hasOwn(h.audits[0],'payload'));assert.ok(!Object.hasOwn(h.audits[0],'signature'))
 await assert.rejects(handleDoctorAdministration(request,h.dependencies),/REPLAY_DENIED/)
 assert.equal(h.reads.length,1)
})
test('missing bindings, proof, key validity, manifest, versions, skew and command scope fail closed',async()=>{
 const request=await packet()
 await assert.rejects(handleDoctorAdministration(request),/UNAVAILABLE/)
 for(const change of[null,{enabled:false},{suit:'shop-suit'},{mode:'live'},{sourceEnvironmentId:id(5)},{signingReference:null},{livePolicyEvidence:null},{operatorApprovalEvidence:null},{clockSkewSeconds:null},{nonceRetentionSeconds:1},{maximumBodyBytes:null},{protocolVersion:'2.0'},{keyValidUntil:'2026-10-17T00:00:00Z'},{manifest:{...configuration().manifest,verified:false}},{manifest:{...configuration().manifest,expiresAt:'2026-10-17T00:00:00Z'}},{manifest:{...configuration().manifest,capabilities:[]}},{capabilities:['doctor.plan.command'] }]){
  const h=harness(change===null?null:{...configuration(),...change});await assert.rejects(handleDoctorAdministration(request,h.dependencies),/UNAVAILABLE/);assert.equal(h.reads.length,0)
 }
 const h=harness();await assert.rejects(handleDoctorAdministration(await packet({body:{operation:'doctor.plan.command'}}),h.dependencies),/CAPABILITY_UNAVAILABLE/)
 assert.equal(h.reads.length,0)
})
test('wrong signature, bytes, headers, binding and untrusted identity/URL payload never reach domain',async()=>{
 for(const change of[{method:'GET'},{path:doctorAdministrationPath+'?return=https://untrusted.example'},{bytes:new TextEncoder().encode('{}')}]){
  const h=harness();await assert.rejects(handleDoctorAdministration({...await packet(),...change},h.dependencies));assert.equal(h.reads.length,0)
 }
 for(const wire of[{targetEnvironmentId:id(14)},{sourceBindingId:id(14)},{keyId:'foreign-key'},{audience:'shop'},{timestamp:now/1000-31},{timestamp:now/1000+31}]){const h=harness();await assert.rejects(handleDoctorAdministration(await packet({wire}),h.dependencies));assert.equal(h.reads.length,0)}
 const request=await packet();request.headers.push(['X-BS-KEY-ID','synthetic-key-v1']);await assert.rejects(handleDoctorAdministration(request,harness().dependencies),/HEADERS_INVALID/)
 for(const payload of[{email:'synthetic@example.test'},{subscriberUserId:id(11),returnUrl:'https://untrusted.example'},{subscriberUserId:id(11),password:'synthetic-not-a-credential'},{subscriberUserId:id(11),role:'owner'}]){const h=harness();await assert.rejects(handleDoctorAdministration(await packet({body:{payload}}),h.dependencies));assert.equal(h.reads.length,0)}
 const bad=await packet();bad.headers.find(([name])=>name==='x-bs-signature')[1]='A'.repeat(43);await assert.rejects(handleDoctorAdministration(bad,harness().dependencies),/SIGNATURE_INVALID/)
})
test('signed role cannot widen operator capability; denial and target failure retain consumed nonce and audit',async()=>{
 const binding=configuration();binding.operators[0].capabilities=[]
 const h=harness(binding),request=await packet()
 assert.equal((await handleDoctorAdministration(request,h.dependencies)).status,403);assert.equal(h.audits[0].outcome,'operator_denied');assert.equal(h.seen.size,1);assert.equal(h.reads.length,0)
 await assert.rejects(handleDoctorAdministration(request,h.dependencies),/REPLAY_DENIED/)
 const unverified=harness();unverified.dependencies.readTargetSubject=async()=>({subscriberUserId:id(11),practiceId:id(12),authVerified:false,storedOwner:true,state:'trial',subscriptionRevision:1})
 const denial=await handleDoctorAdministration(await packet(),unverified.dependencies);assert.equal(denial.status,403);assert.equal(JSON.parse(new TextDecoder().decode(denial.bytes)).error.code,'DOCTOR_ADMIN_TARGET_DENIED');assert.ok(denial.headers['x-bs-signature']);assert.equal(unverified.audits[0].outcome,'target_denied');assert.equal(unverified.seen.size,1)
 const failed=harness();failed.dependencies.readVerificationKey=async()=>{throw Error('synthetic provider internals must not escape')};await assert.rejects(handleDoctorAdministration(await packet(),failed.dependencies),/^Error: DOCTOR_ADMIN_UNAVAILABLE$/)
})

test('revoked binding or elapsed signature window after nonce persistence cannot authorize a stale read',async()=>{
 const revoked=harness(),consume=revoked.dependencies.consumeNonce
 revoked.dependencies.consumeNonce=async value=>{const accepted=await consume(value);revoked.dependencies.loadBinding=async()=>({...configuration(),enabled:false});return accepted}
 await assert.rejects(handleDoctorAdministration(await packet(),revoked.dependencies),/UNAVAILABLE/);assert.equal(revoked.reads.length,0);assert.equal(revoked.seen.size,1);assert.equal(revoked.audits[0].outcome,'operator_denied')
 const elapsed=harness(),persist=elapsed.dependencies.consumeNonce
 elapsed.dependencies.consumeNonce=async value=>{const accepted=await persist(value);elapsed.dependencies.now=()=>now+31000;return accepted}
 await assert.rejects(handleDoctorAdministration(await packet(),elapsed.dependencies),/UNAVAILABLE/);assert.equal(elapsed.reads.length,0);assert.equal(elapsed.seen.size,1)
})
