import {persistedVerificationChecks} from '../runner/failure-evidence.mjs'
import {requiresSameAttemptVerification} from '../runner/binding-recovery.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {readFileSync} from 'node:fs'
import {planSupervisorStep} from '../runner/task-supervisor.mjs'
const snapshot={packet:{task:{task_id:'LEGACY-FAILED',status:'failed'},retry_policy:{max_attempts:3}},executions:[{execution_id:7,attempt:1,status:'succeeded'}],verification_runs:[{execution_id:7,verification_run_id:9,status:'failed'}],failures:[],exhaustion_audit:{action:'investigate',entries:[{execution_id:7,classification:'UNKNOWN'}]},authoritative_failure:{execution_id:7,classification:'VERIFIER_INFRA',evidence:{protocol:2,verification_run_id:9,adoption_materialization:true}},recovery_readiness:{allowed:true}}
test('legacy untrusted verification materializes once through Supervisor despite stale unknown audit',()=>{const p=planSupervisorStep(snapshot);assert.equal(p.command,'task-verify');assert.equal(p.execution.execution_id,7);assert.equal(p.failure_class,'verification-infrastructure')})
test('consumed adoption permission cannot reopen unchanged execution',()=>{const p=planSupervisorStep({...snapshot,recovery_readiness:{allowed:false}});assert.equal(p.kind,'wait');assert.equal(p.command,undefined)})
test('legacy adoption preserves history, supersedes incompatible identity and coalesces 100 wakes', {skip:!process.env.CP_EGRESS_TEST_DATABASE},()=>{assert.match(process.env.CP_EGRESS_TEST_DATABASE,/^cp_/);const r=spawnSync('docker',['exec','-i',process.env.CP_EGRESS_TEST_CONTAINER,'psql','-U','postgres','-d',process.env.CP_EGRESS_TEST_DATABASE,'-Xq','-v','ON_ERROR_STOP=1'],{input:readFileSync(new URL('./legacy-adoption-smoke.sql',import.meta.url)),encoding:'utf8'});assert.equal(r.status,0,r.stderr)})

test('legacy failed verification cannot replay as the new materialization operation',()=>{const op={action:'task-verify',execution_id:7};assert.equal(requiresSameAttemptVerification(snapshot,op),true);assert.equal(requiresSameAttemptVerification({...snapshot,verification_runs:[{execution_id:7,verification_run_id:10,status:'failed'}]},op),false);assert.equal(requiresSameAttemptVerification(snapshot,{...op,execution_id:8}),false)})

test('receipt materialization preserves executable results over earlier planned omissions',()=>{const omitted={name:'same',status:'skipped',command:null},failed={name:'same',status:'fail',command:'node test.mjs',exit_code:1,log_path:'/bound.log'};assert.deepEqual(persistedVerificationChecks([omitted,failed]),[failed]);assert.deepEqual(persistedVerificationChecks([failed,omitted]),[failed]);assert.throws(()=>persistedVerificationChecks([failed,{...failed,status:'pass'}]),/conflicting_verification_check_results/)})
