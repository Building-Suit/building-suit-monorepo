import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { load } from '../../scripts/load-test-module.mjs'
const { HqStore } = await load('../server/utils/hqStore.ts')
const { parseFounderAction } = await load('../server/utils/hqDomain.ts')
const { LocalInvalidationCursor, LocalUpdateConnections, localUpdatePolicy, hostedRealtimePlan } = await load('../server/utils/hqRealtime.ts')

test('local invalidations contain only revision, follow committed writes and survive SQLite reopen',()=>{
 const directory=mkdtempSync(join(tmpdir(),'hq-invalidations-')),file=join(directory,'hq.sqlite')
 let store=new HqStore(file);const token=store.createSession(),started=Date.now()
 const cursor=new LocalInvalidationCursor(store,token,started)
 assert.deepEqual(cursor.poll(started),{kind:'invalidate',revision:'0'})
 assert.deepEqual(cursor.poll(started+1),{kind:'unchanged'})
 const founder={id:'founder',role:'founder'},command=parseFounderAction({action:'send_message',idempotencyKey:'revision-1',text:'Private founder message that must never enter the SSE payload'},founder)
 store.execute(founder,command)
 const update=cursor.poll(started+2);assert.deepEqual(update,{kind:'invalidate',revision:'1'})
 assert.equal(JSON.stringify(update).includes('Private'),false)
 assert.throws(()=>store.transaction(()=>{throw Error('Synthetic rollback')}))
 assert.deepEqual(cursor.poll(started+3),{kind:'unchanged'})
 store.close();store=new HqStore(file)
 assert.equal(store.revision(),1)
 assert.deepEqual(new LocalInvalidationCursor(store,token,started).poll(started+4),{kind:'invalidate',revision:'1'})
 store.close();rmSync(directory,{recursive:true,force:true})
})
test('invalidations reauthorize every poll and never read after revocation, expiry or malformed session',()=>{
 let reads=0,checks=0,valid=true
 const source={sessionValid(){checks++;return valid},revision(){reads++;return 2}},token='a'.repeat(43)
 const cursor=new LocalInvalidationCursor(source,token,1000)
 assert.equal(cursor.poll(1000).kind,'invalidate');assert.equal(cursor.poll(1001).kind,'unchanged')
 valid=false;assert.equal(cursor.poll(1002).kind,'closed');valid=true
 assert.equal(cursor.poll(1003).kind,'closed');assert.equal(reads,2);assert.equal(checks,3)
 const expired=new LocalInvalidationCursor(source,token,1000)
 assert.equal(expired.poll(1000+localUpdatePolicy.lifetimeMs).kind,'closed');assert.equal(reads,2)
 assert.equal(new LocalInvalidationCursor(source,'invalid',1000).poll(1000).kind,'closed');assert.equal(checks,3)
 assert.equal(new LocalInvalidationCursor(source,token,1000).poll(999).kind,'closed')
})
test('local stream budgets bound per-session and process connections and release idempotently',()=>{
 const connections=new LocalUpdateConnections(),release=[]
 release.push(connections.acquire('session-1'),connections.acquire('session-1'))
 assert.throws(()=>connections.acquire('session-1'),error=>error.code==='HQ_UPDATE_LIMIT')
 for(let i=0;i<6;i++)release.push(connections.acquire('session-'+(i+2)))
 assert.throws(()=>connections.acquire('session-9'),error=>error.code==='HQ_UPDATE_LIMIT')
 release[0]();release[0]();const last=connections.acquire('session-9')
 assert.throws(()=>connections.acquire('session-10'),error=>error.code==='HQ_UPDATE_LIMIT')
 release.forEach(close=>close());last()
 for(let i=0;i<8;i++)connections.acquire('fresh-'+i)()
})
test('hosted Realtime remains closed and preserves requested refs and staging mapping conflict',()=>{
 const staging=hostedRealtimePlan('staging'),production=hostedRealtimePlan('production')
 assert.equal(staging.requestedProjectRef,'lwecnmsosfwovlzxauml')
 assert.equal(production.requestedProjectRef,'dfeiuxsqhgzontefmrjc')
 for(const plan of [staging,production]){assert.equal(plan.enabled,false);assert.equal(plan.access,'denied');assert.equal(plan.sendsWorkspaceDocument,false);assert.ok(plan.blockers.includes('PROJECT_ACCESS_DENIED'))}
 assert.ok(staging.blockers.includes('SUPER_ADMIN_PROJECT_MAPPING_CONFLICT'))
})
