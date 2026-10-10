import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs'
import {execFileSync} from 'node:child_process'
import {tmpdir} from 'node:os'
import path from 'node:path'
import {parentContinuation} from '../runner/dot.mjs'
import {classifyHealth} from '../runner/dot-health-state.mjs'
import {dispatchRecovery} from '../runner/dot-general-recovery.mjs'
const git=(cwd,...args)=>execFileSync('git',args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim()
for(const parent of ['stg','codex/super-admin-suit/parent'])test(`advancing ${parent} owns stale admission recovery and preserves active task base`,async()=>{
 const root=mkdtempSync(path.join(tmpdir(),'dot-parent-admission-'))
 try{
  git(root,'init','-b',parent);git(root,'config','user.name','Admission Fixture');git(root,'config','user.email','fixture@example.invalid')
  writeFileSync(path.join(root,'base'),'base');git(root,'add','base');git(root,'commit','-m','parent before integration')
  const old=git(root,'rev-parse','HEAD'),worktree=path.join(root,'worker')
  git(root,'worktree','add','-b','codex/super-admin-suit/task',worktree,old)
  writeFileSync(path.join(worktree,'implementation'),'preserve existing implementation')
  writeFileSync(path.join(root,'integrated'),'verified parent advance');git(root,'add','integrated');git(root,'commit','-m','advance parent')
  const current=git(root,'rev-parse',parent)
  assert.notEqual(old,current)
  const continuation=parentContinuation({sameBranch:true,oldPresent:true,newPresent:true,
   ancestor:git(root,'merge-base','--is-ancestor',old,current)==='',containsOld:git(worktree,'merge-base','--is-ancestor',old,'HEAD')==='',dirty:true,workerActive:true})
  assert.equal(continuation.action,'continue-preserved-base')
  const run={run_id:'original-seven-task-run',status:'running',completed_tasks:0,max_tasks:7,current_task_id:null}
  const admission={task_id:'SAS-M1-REGISTRY-001',publication_current:false,dependencies:[],decisions:[]}
  const health=classifyHealth({run,admission,key:'run:original-seven-task-run'})
  assert.equal(health.state,'WAITING_ADMISSION');assert.equal(health.operator_action_required,false)
  assert.equal(health.recovery_owner,'Dot');assert.match(health.why,/contract stale/)
  const persistedClaims=new Set(),starts=[]
  const cycle=()=>dispatchRecovery({health,snapshot:{},claim:async(id,key,family)=>{
   assert.equal(id,run.run_id);assert.equal(family,'controller-acquisition')
   if(persistedClaims.has(key))return {claimed:false}
   persistedClaims.add(key);return {claimed:true,job:{key}}
  },start:async job=>starts.push(job)})
  await cycle();await cycle();assert.equal(starts.length,1)
  // A restarted watchdog sees the persisted claim, rather than dispatching again.
  await cycle();assert.equal(starts.length,1)
  const running=classifyHealth({run:{...run,current_task_id:admission.task_id},task:{task_id:admission.task_id,status:'in_progress'},execution:{execution_id:311,attempt:1,status:'running'}},{worker_alive:true})
  assert.equal(running.state,'RUNNING');assert.equal(running.operator_action_required,false)
  assert.equal(git(worktree,'rev-parse','HEAD'),old)
  assert.equal(readFileSync(path.join(worktree,'implementation'),'utf8'),'preserve existing implementation')
  assert.equal(run.max_tasks,7);assert.equal(run.completed_tasks,0);assert.equal(running.attempt,1)
 }finally{rmSync(root,{recursive:true,force:true})}
})
