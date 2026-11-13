import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { ref, shallowRef, computed, watch, effectScope, onScopeDispose } from 'vue'
registerHooks({resolve(s,c,next){if(s.startsWith('.')&&!/\.[a-z]+$/i.test(s)&&c.parentURL?.includes('/apps/company-hq/'))return next(`${s}.ts`,c);return next(s,c)}})
const { useHqEmailConnectionTest } = await import('../../app/composables/useHqEmailConnectionTest.ts')
const { parseEmailTest, parseEmailReadiness, emailTestApprovable } = await import('../../app/utils/emailConnectionTest.ts')
const sample = (extra={}) => ({id:'11111111-1111-4111-8111-111111111111',agentId:'AG-EMAIL-002',managerId:'AG-EMAIL-001',sender:'Shop Suit Team <hello@shop.building-suit.com>',recipient:'test@example.invalid',subject:'Test',body:'Exact message',digest:'a'.repeat(64),expiresAt:new Date(Date.now()+60000).toISOString(),state:'prepared',providerAccepted:false,delivered:false,providerId:null,...extra})
const ready={agentId:'AG-EMAIL-002',managerId:'AG-EMAIL-001',sender:'Shop Suit Team <hello@shop.building-suit.com>',domain:'shop.building-suit.com',configured:false,providerTested:false,scope:'founder-test-only',automaticSending:false}
function fixture(t, fetcher) {
 const scope=effectScope(), access=ref({status:'founder',pending:false,user:{displayName:'Founder',detailLabel:'Fixture'}})
 const descriptors=new Map()
 for(const [key,value] of Object.entries({ref,shallowRef,computed,watch,onScopeDispose,$fetch:fetcher})){
  descriptors.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,configurable:true,writable:true})
 }
 const instance=scope.run(()=>useHqEmailConnectionTest(()=>access.value))
 t.after(()=>{scope.stop();for(const [key,d] of descriptors)d?Object.defineProperty(globalThis,key,d):delete globalThis[key]})
 return {instance,access}
}
test('strict projections do not infer sender/recipient or delivery',()=>{
 assert.ok(parseEmailTest(sample()));assert.ok(parseEmailReadiness(ready))
 for(const change of [{agentId:'AG-SALES-002'},{sender:'Other <x@example.com>'},{providerAccepted:true},{delivered:true},{digest:'bad'},{expiresAt:'bad'}])assert.equal(parseEmailTest(sample(change)),null)
 assert.equal(parseEmailReadiness({...ready,automaticSending:true}),null)
 assert.equal(emailTestApprovable(sample({state:'uncertain'}),Date.now()),false)
 assert.equal(emailTestApprovable(sample({expiresAt:'2000-01-01'}),Date.now()),false)
})
test('prepare and approve are separate exact immutable actions with no send request',async t=>{
 const calls=[];const {instance}=fixture(t,async(url,options)=>{calls.push({url,options});return calls.length===1?sample():sample({state:'approved'})})
 await instance.command({action:'prepare',recipient:'test@example.invalid',subject:'Test',body:'Exact message'})
 assert.equal(calls.length,1);assert.equal(instance.presentation.value.test.state,'prepared')
 await instance.command({action:'decide',id:sample().id,digest:'b'.repeat(64),approve:true});assert.equal(calls.length,1)
 await instance.command({action:'decide',id:sample().id,digest:sample().digest,approve:true});assert.equal(calls.length,2)
 assert.deepEqual(calls[1].options.body,{digest:sample().digest,approve:true})
 assert.ok(calls.every(c=>!c.url.includes('send')));assert.equal(instance.presentation.value.test.state,'approved')
 assert.match(instance.presentation.value.message,/queued for the Oracle worker/)
})
test('uncertain prepare retains key and blocks changed inputs; no automatic retry',async t=>{
 const calls=[];const {instance}=fixture(t,async(url,options)=>{calls.push({url,options});if(calls.length===1)throw Error('timeout');return sample()})
 const action={action:'prepare',recipient:'test@example.invalid',subject:'Test',body:'Exact message'}
 await instance.command(action);await instance.command({...action,body:'Changed'});assert.equal(calls.length,1)
 await instance.command(action);assert.equal(calls.length,2);assert.equal(calls[0].options.body.requestKey,calls[1].options.body.requestKey)
})
test('uncertain approval requires readback before another decision',async t=>{
 const calls=[];const {instance}=fixture(t,async(url,options)=>{calls.push({url,options});if(calls.length===1)return sample();if(calls.length===2)throw Error('timeout');return url.endsWith('readiness')?ready:sample({state:'approved'})})
 await instance.command({action:'prepare',recipient:'test@example.invalid',subject:'Test',body:'Exact message'})
 const decision={action:'decide',id:sample().id,digest:sample().digest,approve:true}
 await instance.command(decision);await instance.command(decision);assert.equal(calls.length,2)
 await instance.command({action:'refresh'});assert.equal(calls.length,4);assert.equal(instance.presentation.value.test.state,'approved')
})
test('access loss clears private content and ignores late results',async t=>{
 let resolve;const {instance,access}=fixture(t,()=>new Promise(r=>{resolve=r}))
 const p=instance.command({action:'prepare',recipient:'test@example.invalid',subject:'Test',body:'Exact message'})
 access.value={status:'anonymous',pending:false};await Promise.resolve();resolve(sample());await p
 assert.equal(instance.presentation.value.test,null);assert.equal(instance.presentation.value.pending,false)
})

test('existing test can be recovered by ID without preparing or sending',async t=>{
 const calls=[];const {instance}=fixture(t,async(url,options)=>{calls.push({url,options});return url.endsWith('readiness')?ready:sample({state:'uncertain'})})
 await instance.command({action:'refresh',id:sample().id})
 assert.equal(calls.length,2);assert.ok(calls.every(c=>!c.options.method));assert.equal(instance.presentation.value.test.state,'uncertain')
 await instance.command({action:'prepare',recipient:'another@example.invalid',subject:'Test',body:'Different'})
 assert.equal(calls.length,2)
})
