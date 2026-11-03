import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { scryptSync } from 'node:crypto'
import { load } from '../../scripts/load-test-module.mjs'
const D = await load('../server/utils/hqDomain.ts')
const { HqStore, tokenHash } = await load('../server/utils/hqStore.ts')
const A = await load('../server/utils/hqAuth.ts')
const founder = { id:'founder', role:'founder' }, ceo = { id:'AG-CEO-001', role:'ceo' }, hr = { id:'AG-HR-001', role:'hr' }
let sequence = 0
const proposal = () => ({ action:'create_task', idempotencyKey:'key'+ ++sequence, title:'Synthetic review', brief:'Review synthetic evidence', acceptance:'Actual report with independent review', allowedActions:'Read supplied evidence only', budget:0 })
const f = (store, body) => store.execute(founder, D.parseFounderAction({ idempotencyKey:'key'+ ++sequence, ...body },founder))
const a = (store, actor, name, body) => store.execute(actor,D.parseAgentAction(name,{ requestKey:'key'+ ++sequence,...body },actor))
const approved = store => { const { id }=f(store,proposal());f(store,{action:'approve_task',id});return id }
const error = (fn,status) => assert.throws(fn,e=>e.status===status)
test('closed roster and founder/HR projections hide private messages',()=>{
 const s=new HqStore(':memory:');f(s,{action:'send_message',text:'Founder private'});
 const h=D.projectState(s.read(),hr,'sqlite');assert.deepEqual(h.agents.map(x=>x.id),['ceo','hr']);assert.equal(h.messages.length,0);s.close()
})
test('server parsing rejects role spoofing, direct HR chat, scope changes and spending',()=>{
 error(()=>D.parseFounderAction({...proposal(),owner:'hr'},founder),403)
 error(()=>D.parseFounderAction({action:'send_message',idempotencyKey:'k',agent:'hr',text:'No'},founder),403)
 error(()=>D.parseFounderAction({...proposal(),budget:1},founder),422)
 error(()=>D.parseFounderAction(proposal(),ceo),403)
 error(()=>D.parseAgentAction('hq_reply',{requestKey:'k',text:'No'},hr),403)
 error(()=>D.parseAgentAction('hq_update_task',{requestKey:'k',agent:'ceo'},hr),403)
 error(()=>D.parseFounderAction({...proposal(),reviewer:'me'},founder),422)
})
test('approval precedes execution and CEO delegation instructions are visible to HR',()=>{
 const s=new HqStore(':memory:');const {id}=f(s,proposal());error(()=>a(s,ceo,'hq_update_task',{id,status:'running',detail:'No'}),403)
 f(s,{action:'approve_task',id});a(s,ceo,'hq_delegate_task',{id,detail:'Review ONLY supplied staffing evidence'})
 const h=D.projectState(s.read(),hr,'sqlite');assert.ok(h.events.some(e=>e.detail.includes('ONLY supplied')))
 error(()=>a(s,ceo,'hq_update_task',{id,status:'running',detail:'Not owner'}),403)
 a(s,hr,'hq_update_task',{id,status:'running',detail:'Started with supplied evidence'})
 a(s,hr,'hq_report',{id,text:'Bounded report to CEO'})
 assert.equal(D.projectState(s.read(),founder,'sqlite').internalMessages,undefined)
 a(s,hr,'hq_update_task',{id,status:'review',detail:'Report ready',deliverable:'Actual synthetic report'})
 error(()=>a(s,hr,'hq_update_task',{id,status:'completed',detail:'Self accepted',reviewEvidence:'Me'}),403)
 a(s,ceo,'hq_update_task',{id,status:'completed',detail:'Independently reviewed',reviewEvidence:'Independent reviewer accepted evidence'})
 assert.equal(s.read().tasks[0].status,'completed');s.close()
})
test('completion requires deliverable and fresh review after retries or changed evidence',()=>{
 const s=new HqStore(':memory:');const id=approved(s)
 a(s,ceo,'hq_update_task',{id,status:'running',detail:'Start'})
 error(()=>a(s,ceo,'hq_update_task',{id,status:'review',detail:'No report'}),422)
 a(s,ceo,'hq_update_task',{id,status:'review',detail:'Report',deliverable:'A',reviewEvidence:'Review A'})
 a(s,ceo,'hq_update_task',{id,status:'blocked',detail:'Missing prerequisite'})
 a(s,ceo,'hq_update_task',{id,status:'queued',detail:'Prerequisite restored'})
 a(s,ceo,'hq_update_task',{id,status:'running',detail:'Retry'})
 a(s,ceo,'hq_update_task',{id,status:'review',detail:'Same report'})
 error(()=>a(s,ceo,'hq_update_task',{id,status:'completed',detail:'Stale review'}),422)
 a(s,ceo,'hq_update_task',{id,status:'completed',detail:'Fresh review',reviewEvidence:'Fresh independent report review'})
 s.close()
})
test('record-derived work status is computed before display truncation',()=>{
 const doc=D.initialDocument();const task={...doc.tasks[0],id:'older',owner:'ceo',status:'running'}
 doc.tasks=Array.from({length:150},(_,i)=>({...task,id:'t'+i,status:'proposed'})).concat(task)
 const state=D.projectState(doc,founder,'sqlite');assert.equal(state.tasks.length,150);assert.equal(state.agents[0].status,'working')
})
test('idempotency is atomic, survives reopen, rejects key reuse; cancellation blocks later work',()=>{
 const dir=mkdtempSync(join(tmpdir(),'hq-'));const path=join(dir,'hq.sqlite');let s=new HqStore(path)
 const body=proposal();const first=f(s,body);assert.deepEqual(f(s,body),first)
 error(()=>f(s,{...body,title:'Changed'}),409);assert.equal(s.read().tasks.filter(x=>x.id===first.id).length,1)
 s.close();s=new HqStore(path);assert.deepEqual(f(s,body),first)
 f(s,{action:'approve_task',id:first.id});f(s,{action:'cancel_task',id:first.id})
 error(()=>a(s,ceo,'hq_update_task',{id:first.id,status:'running',detail:'Late start'}),409)
 assert.equal(s.read().tasks[0].status,'cancelled');s.close();rmSync(dir,{recursive:true,force:true})
})
test('sessions expire/revoke; login attempts are bounded and database stores no raw token',()=>{
 const s=new HqStore(':memory:');const token=s.createSession(100);assert.ok(s.sessionValid(token,101));assert.ok(!s.sessionValid(token,100+8*60*60*1000))
 s.revokeSession(token);assert.ok(!s.sessionValid(token,102))
 for(let i=0;i<8;i++)s.failedLogin('synthetic-address',100)
 error(()=>s.checkLoginLimit('synthetic-address',101),429);s.checkLoginLimit('synthetic-address',100+15*60*1000);s.close()
})
test('auth fails closed; independent tokens cannot impersonate each other; origin is exact',()=>{
 assert.equal(A.configuration({}),null)
 const salt='a'.repeat(32);const password='synthetic-password-only';const passwordHash=salt+':'+scryptSync(password,salt,64).toString('hex')
 const env={HQ_APP_ORIGIN:'http://127.0.0.1:3100',HQ_DATA_PATH:'/tmp/hq-synthetic.sqlite',HQ_FOUNDER_PASSWORD_HASH:passwordHash,HQ_CEO_TOKEN_SHA256:tokenHash('c'.repeat(40)),HQ_HR_TOKEN_SHA256:tokenHash('h'.repeat(40))}
 const conf=A.configuration(env);assert.ok(conf);assert.ok(A.passwordMatches(password,passwordHash));assert.ok(!A.passwordMatches('wrong-password',passwordHash))
 assert.equal(A.configuration({...env,HQ_APP_ORIGIN:'https://hq.example'}),null)
 assert.equal(A.configuration({...env,HQ_HR_TOKEN_SHA256:env.HQ_CEO_TOKEN_SHA256}),null)
 assert.equal(A.executorActor('Bearer '+'h'.repeat(40),conf).role,'hr');assert.equal(A.executorActor('Bearer '+'c'.repeat(40),conf).role,'ceo')
 error(()=>A.executorActor('Bearer '+'x'.repeat(40),conf),401);error(()=>A.requireOrigin('https://evil.example',conf.origin),403)
})
test('CEO can propose from conversation; HR cannot; execution still needs founder approval',()=>{
 const s=new HqStore(':memory:');const input={title:'CEO proposal',brief:'Scoped outcome',acceptance:'Actual report and review',allowedActions:'Read synthetic input only'}
 error(()=>a(s,hr,'hq_propose_task',input),403)
 const {id}=a(s,ceo,'hq_propose_task',input);assert.equal(s.read().tasks[0].status,'proposed')
 error(()=>a(s,ceo,'hq_update_task',{id,status:'running',detail:'Unapproved'}),403)
 f(s,{action:'approve_task',id});a(s,ceo,'hq_update_task',{id,status:'running',detail:'Approved scope'})
 s.close()
})
