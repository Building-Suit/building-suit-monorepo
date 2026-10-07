import {persistedVerificationChecks} from '../runner/failure-evidence.mjs'
import {requiresSameAttemptVerification} from '../runner/binding-recovery.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {readFileSync} from 'node:fs'
import {planSupervisorStep,classifySupervisorFailure} from '../runner/task-supervisor.mjs'
const snapshot={packet:{task:{task_id:'LEGACY-FAILED',status:'failed'},retry_policy:{max_attempts:3}},executions:[{execution_id:7,attempt:1,status:'succeeded'}],verification_runs:[{execution_id:7,verification_run_id:9,status:'failed'}],failures:[],exhaustion_audit:{action:'investigate',entries:[{execution_id:7,classification:'UNKNOWN'}]},authoritative_failure:{execution_id:7,classification:'VERIFIER_INFRA',evidence:{protocol:2,verification_run_id:9,adoption_materialization:true}},recovery_readiness:{allowed:true}}
test('legacy untrusted verification materializes once through Supervisor despite stale unknown audit',()=>{const p=planSupervisorStep(snapshot);assert.equal(p.command,'task-verify');assert.equal(p.execution.execution_id,7);assert.equal(p.failure_class,'verification-infrastructure')})
test('consumed adoption permission cannot reopen unchanged execution',()=>{const p=planSupervisorStep({...snapshot,recovery_readiness:{allowed:false}});assert.equal(p.kind,'wait');assert.equal(p.command,undefined)})
test('legacy adoption preserves history, supersedes incompatible identity and coalesces 100 wakes', {skip:!process.env.CP_EGRESS_TEST_DATABASE},()=>{assert.match(process.env.CP_EGRESS_TEST_DATABASE,/^cp_/);const r=spawnSync('docker',['exec','-i',process.env.CP_EGRESS_TEST_CONTAINER,'psql','-U','postgres','-d',process.env.CP_EGRESS_TEST_DATABASE,'-Xq','-v','ON_ERROR_STOP=1'],{input:readFileSync(new URL('./legacy-adoption-smoke.sql',import.meta.url)),encoding:'utf8'});assert.equal(r.status,0,r.stderr)})

test('legacy failed verification cannot replay as the new materialization operation',()=>{const op={action:'task-verify',execution_id:7};assert.equal(requiresSameAttemptVerification(snapshot,op),true);assert.equal(requiresSameAttemptVerification({...snapshot,verification_runs:[{execution_id:7,verification_run_id:10,status:'failed'}]},op),false);assert.equal(requiresSameAttemptVerification(snapshot,{...op,execution_id:8}),false)})

test('receipt materialization preserves executable results over earlier planned omissions',()=>{const omitted={name:'same',status:'skipped',command:null},failed={name:'same',status:'fail',command:'node test.mjs',exit_code:1,log_path:'/bound.log'};assert.deepEqual(persistedVerificationChecks([omitted,failed]),[failed]);assert.deepEqual(persistedVerificationChecks([failed,omitted]),[failed]);assert.throws(()=>persistedVerificationChecks([failed,{...failed,status:'pass'}]),/conflicting_verification_check_results/)})

test('trusted current verifier failure supersedes a stale UNKNOWN wait',()=>{const s={...snapshot,authoritative_failure:{classification:'VERIFIER_INFRA',evidence:{protocol:2,verification_run_id:9}},recovery_readiness:{allowed:false},recovery:{status:'active',next_action:'wait-external',failure_class:'unknown-outcome',condition:{fingerprint:'stale'},next_wake_at:null}};const p=planSupervisorStep(s);assert.equal(p.next_action,'reverify');assert.equal(p.failure_class,'verification-infrastructure');assert.equal(p.kind,'wait');const repaired=planSupervisorStep({...s,recovery_readiness:{allowed:true}});assert.equal(repaired.command,'task-verify');assert.equal(repaired.execution.execution_id,7)})
test('trusted convergence preserves history, one wake and one zero-charge repaired verification',{skip:!process.env.CP_EGRESS_TEST_DATABASE},()=>{const r=spawnSync('docker',['exec','-i',process.env.CP_EGRESS_TEST_CONTAINER,'psql','-U','postgres','-d',process.env.CP_EGRESS_TEST_DATABASE,'-Xq','-v','ON_ERROR_STOP=1'],{input:readFileSync(new URL('./trusted-convergence-smoke.sql',import.meta.url)),encoding:'utf8'});assert.equal(r.status,0,r.stderr)})

test('local database preparation changes verifier inputs without changing product source',async()=>{
 const {mkdtempSync,mkdirSync,writeFileSync,rmSync}=await import('node:fs')
 const {tmpdir}=await import('node:os')
 const path=await import('node:path')
 const {recoveryActionInput}=await import('../runner/recovery-action-guard.mjs')
 const root=mkdtempSync(path.join(tmpdir(),'convergence-'))
 try {
  const git=args=>{const r=spawnSync('git',args,{cwd:root,encoding:'utf8'});assert.equal(r.status,0,r.stderr)}
  git(['init','-q']);writeFileSync(path.join(root,'.gitignore'),'.local/\n');git(['add','.gitignore']);git(['-c','user.name=Fixture','-c','user.email=fixture@example.test','commit','-qm','fixture'])
  const s={...snapshot,packet:{...snapshot.packet,project:{verification_config:{database:{kind:'supabase-local',local_only:true}}}},executions:[{...snapshot.executions[0],worktree_path:root}]}
  const source=new URL('../../../',import.meta.url).pathname
  const before=recoveryActionInput(s,'task-verify',source)
  mkdirSync(path.join(root,'.local/verification-inputs'),{recursive:true});writeFileSync(path.join(root,'.local/verification-inputs/database-preparation.json'),JSON.stringify({local_only:true,migrations:['current'],schema_prepared:true}))
  const repaired=recoveryActionInput(s,'task-verify',source)
  assert.notEqual(repaired.evidence.source_fingerprint,before.evidence.source_fingerprint)
  assert.equal(recoveryActionInput(s,'task-verify',source).fingerprint,repaired.fingerprint)
  git(['diff','--exit-code','HEAD'])
  const hosted={...s,packet:{...s.packet,project:{verification_config:{database:{kind:'supabase-local',local_only:false}}}}}
  const without=structuredClone(hosted);rmSync(path.join(root,'.local'),{recursive:true});const original=recoveryActionInput(without,'task-verify',source)
  mkdirSync(path.join(root,'.local/verification-inputs'),{recursive:true});writeFileSync(path.join(root,'.local/verification-inputs/database-preparation.json'),'{}')
  assert.equal(recoveryActionInput(hosted,'task-verify',source).fingerprint,original.fingerprint)
 } finally {rmSync(root,{recursive:true,force:true})}
})

test('late obsolete verification outcome cannot overwrite current trusted classification',()=>{
 const s={...snapshot,authoritative_failure:{execution_id:7,classification:'VERIFIER_INFRA',evidence:{verification_run_id:9}}}
 const payload={error:'task_action_failed',classification:{failure_class:'unknown-outcome'}}
 const decision=classifySupervisorFailure({command:'task-verify',payload,snapshot:s})
 assert.equal(decision.failure_class,'verification-infrastructure');assert.equal(decision.next_action,'reverify');assert.equal(decision.command,undefined)
 assert.equal(classifySupervisorFailure({command:'task-verify',payload:{error:'task_action_failed'},snapshot:s}).next_action,'reverify')
 const newer={...s,verification_runs:[{execution_id:7,verification_run_id:10,status:'failed'}]}
 assert.equal(classifySupervisorFailure({command:'task-verify',payload,snapshot:newer}).failure_class,'unknown-outcome')
 assert.equal(classifySupervisorFailure({command:'task-verify',payload:{error:'denied',classification:{failure_class:'operator-wait'}},snapshot:s}).next_action,'wait-operator')
})
