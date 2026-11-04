import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { load } from '../../scripts/load-test-module.mjs'
const D=await load('../server/utils/hqDomain.ts'),{HqStore}=await load('../server/utils/hqStore.ts')
const founder={id:'founder',role:'founder'},ceo={id:'AG-CEO-001',role:'ceo'},hr={id:'AG-HR-001',role:'hr'}
let sequence=0
const action=(store,body)=>store.execute(founder,D.parseFounderAction({idempotencyKey:'directory-'+ ++sequence,...body},founder))
const proposal=store=>action(store,{action:'create_task',title:'Synthetic plan',brief:'Bounded work',acceptance:'Evidence and review',allowedActions:'Read synthetic records only'})
const mutation=(store,fn)=>store.transaction(document=>({document,result:fn(document)}))
const check=(fn,status)=>assert.throws(fn,error=>error.status===status)
test('legacy documents project the verified HR department and four distinct configured employees without inventing activity',()=>{
 const doc=D.initialDocument();delete doc.departments
 const before=structuredClone(doc),state=D.projectState(doc,founder,'sqlite')
 assert.deepEqual(state.departments.map(d=>[d.id,d.name]),[['hr','HR & Agent Development']])
 assert.deepEqual(state.employees.map(e=>[e.name,e.role,e.departmentId]),[['Steve','CEO','ceo'],['Maya','HR Lead','hr'],['Noah','Recruiter','hr'],['Iris','Evaluator','hr']])
 assert.equal(new Set(state.employees.map(e=>e.id)).size,4)
 assert.deepEqual(state.employees.map(e=>e.reportsTo),['founder','AG-CEO-001','AG-HR-001','AG-HR-001'])
 assert.ok(state.employees.every(e=>e.status==='idle'&&e.runtime==='not_activated'))
 assert.equal(state.runtime.enabled,false);assert.equal(state.runtime.model,'configuration_required')
 assert.deepEqual(state.brain.events,[]);assert.equal(state.brain.writeConnection,'not_configured')
 assert.deepEqual(doc,before);assert.equal(doc.tasks[0].owner,'hr')
})
test('department creation is founder-only, bounded, normalized, atomic and retry-safe across SQLite restart',()=>{
 const dir=mkdtempSync(join(tmpdir(),'hq-directory-')),path=join(dir,'hq.sqlite');let store=new HqStore(path)
 const body={action:'create_department',idempotencyKey:'persistent-department',name:'  Research   Operations  ',description:'Review company research.'}
 const first=action(store,body);assert.deepEqual(action(store,body),first)
 assert.equal(store.read().departments.length,2);assert.equal(store.read().departments[1].name,'Research Operations')
 check(()=>action(store,{...body,description:'Different request'}),409)
 for(const actor of [ceo,hr]){
  check(()=>D.parseFounderAction(body,actor),403)
  check(()=>store.execute(actor,{name:'create_department',key:'forged',payload:{name:'Unauthorized',description:'No'}}),403)
 }
 for(const name of ['Unassigned',' UNASSIGNED ','Unassigned office','Ｕｎａｓｓｉｇｎｅｄ','Hidden\u200bdepartment'])check(()=>action(store,{...body,idempotencyKey:'name'+ ++sequence,name}),422)
 check(()=>action(store,{...body,idempotencyKey:'duplicate',name:'research operations'}),409)
 check(()=>action(store,{...body,idempotencyKey:'extra',employeeIds:['AG-HR-001']}),422)
 store.close();store=new HqStore(path);assert.deepEqual(action(store,body),first)
 assert.equal(store.read().departments.filter(d=>d.id===first.id).length,1)
 for(let i=2;i<24;i++)action(store,{action:'create_department',name:'Department '+i,description:'Bounded unit '+i})
 check(()=>action(store,{action:'create_department',name:'Overflow',description:'No capacity'}),409)
 assert.equal(store.read().departments.length,24);store.close();rmSync(dir,{recursive:true,force:true})
})
test('milestones are immutable after approval, idempotent, capped and never inferred completed',()=>{
 const store=new HqStore(':memory:'),{id}=proposal(store)
 const body={action:'add_milestone',id,title:'Review scope',acceptance:'Independent scope review',idempotencyKey:'milestone-once'}
 const first=action(store,body);assert.deepEqual(action(store,body),first)
 check(()=>action(store,{...body,idempotencyKey:'duplicate-milestone',title:'review scope'}),409)
 check(()=>D.parseFounderAction(body,hr),403)
 check(()=>store.execute(ceo,{name:'add_milestone',key:'forged',payload:{id,title:'No',acceptance:'No'}}),403)
 check(()=>action(store,{...body,idempotencyKey:'status',status:'completed'}),422)
 for(let i=1;i<20;i++)action(store,{action:'add_milestone',id,title:'Step '+i,acceptance:'Evidence '+i})
 check(()=>action(store,{action:'add_milestone',id,title:'Overflow',acceptance:'Evidence'}),409)
 action(store,{action:'approve_task',id})
 check(()=>action(store,{action:'add_milestone',id,title:'Changed approved scope',acceptance:'No'}),409)
 assert.deepEqual(action(store,body),first)
 mutation(store,doc=>{doc.tasks.find(t=>t.id===id).status='completed'})
 assert.ok(D.projectState(store.read(),founder,'sqlite').tasks.find(t=>t.id===id).milestones.every(m=>m.status==='planned'))
 assert.equal(store.read().tasks.find(t=>t.id===id).milestones.length,20);store.close()
})
test('private directory and Brain evidence are founder-only and Brain writes are never inferred from delivery',()=>{
 const doc=D.initialDocument()
 doc.workflowRuns={synthetic:{key:'synthetic',taskId:'HR-001',status:'completed',leaseUntil:0,checkpoints:{research:{stage:'research',agentId:'AG-HR-002',completedAt:'2026-11-04T00:00:00.000Z',brain:[{id:'private-file',text:'Private Brain body',revision:'1',accessedAt:'2026-11-04T00:00:00.000Z'}]}},outbox:{status:'delivered'},failures:[]}}
 const state=D.projectState(doc,founder,'sqlite')
 assert.deepEqual(state.brain.events,[{id:'synthetic:research',direction:'inbound',taskId:'HR-001',agentId:'AG-HR-002',createdAt:'2026-11-04T00:00:00.000Z',fileCount:1}])
 assert.ok(!JSON.stringify(state.brain.events).includes('Private Brain body'))
 assert.equal(state.brain.writeConnection,'not_configured')
 for(const actor of [hr,ceo]){
  const internal=D.projectState(doc,actor,'sqlite')
  assert.deepEqual(internal.departments,[]);assert.deepEqual(internal.employees,[]);assert.deepEqual(internal.brain.events,[])
 }
})
test('employee activity identifies only the current evidence-backed stage and fences stale leases and cancelled tasks',()=>{
 const doc=D.initialDocument();const task={...doc.tasks[0],id:'active',status:'running',workflow:{},approvedAt:'2026-11-04'};doc.tasks.push(task)
 const run={key:'active',taskId:'active',status:'running',leaseUntil:Date.now()+60000,checkpoints:{},failures:[]};doc.workflowRuns={active:run}
 const statuses=()=>Object.fromEntries(D.projectState(doc,founder,'sqlite').employees.map(e=>[e.name,e.status]))
 assert.deepEqual(statuses(),{Steve:'idle',Maya:'idle',Noah:'working',Iris:'idle'})
 run.checkpoints.research={stage:'research',agentId:'AG-HR-002',brain:[],completedAt:'2026-11-04'}
 assert.deepEqual(statuses(),{Steve:'idle',Maya:'idle',Noah:'idle',Iris:'working'})
 run.leaseUntil=0;assert.ok(Object.values(statuses()).every(s=>s==='idle'))
 run.status='blocked';task.status='blocked';assert.equal(statuses().Iris,'blocked')
 task.status='queued';assert.equal(statuses().Iris,'queued')
 task.status='cancelled';assert.ok(Object.values(statuses()).every(s=>s==='idle'))
})
