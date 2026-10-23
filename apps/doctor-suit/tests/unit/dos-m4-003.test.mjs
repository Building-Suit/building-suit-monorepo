import test from 'node:test'
import assert from 'node:assert/strict'
import {createNativeSession,decodeNativeSession}from '../../mobile/doctor/app/utils/nativeSession.ts'
const actor={userId:'d4030000-0000-4000-8000-000000000001',sessionId:'d4030000-0000-4000-8000-000000000002',environment:'local'}
const token={accessToken:'synthetic-access-only',refreshToken:'synthetic-refresh-only',expiresAt:200000}
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve}}
function fixture(){
 let value=null,clears=0,verified=0,protectedClears=0
 const vault={read:async()=>value,write:async v=>{value=v},clear:async()=>{clears++;value=null}}
 const backend={marker:async()=>true,signIn:async()=>token,refresh:async()=>({...token,expiresAt:300000}),identity:async()=>{verified++;return actor},revoke:async()=>{},recover:async()=>{},verifyRecovery:async()=>token,password:async()=>{}}
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
test('expired tokens refresh before identity, and revoked refresh never leaves usable state',async()=>{
 const f=fixture();await f.vault.write(JSON.stringify({...token,expiresAt:1}));let refreshed=0
 f.backend.refresh=async()=>{refreshed++;return token};assert.equal(await f.session.resume(),true);assert.equal(refreshed,1)
 f.session.lock();f.backend.refresh=async()=>{throw new Error('private refresh failure')};await f.vault.write(JSON.stringify({...token,expiresAt:1}))
 assert.equal(await f.session.resume(),false);assert.equal(f.session.accessToken(),null);assert.equal(f.session.state.identity,null)
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
})
test('recovery uses entered OTP, clears prior account scope and verifies new identity after password change',async()=>{
 const f=fixture();await f.session.signIn('synthetic@example.test','synthetic-password');assert.equal(await f.session.recover('synthetic@example.test'),true)
 assert.equal(f.value,null);assert.equal(f.session.state.identity,null);let changed=false
 f.backend.password=async()=>{changed=true};f.backend.identity=async()=>{assert.equal(changed,true);return actor}
 assert.equal(await f.session.completeRecovery('synthetic@example.test','123456','replacement-password'),true)
 assert.equal(await f.session.completeRecovery('synthetic@example.test','?token=unsafe','replacement-password'),false)
 assert.equal(f.session.state.identity,null)
})
