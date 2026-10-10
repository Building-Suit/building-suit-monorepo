import test from 'node:test'
import assert from 'node:assert/strict'
import {boundedVerificationReadiness} from '../runner/bounded-verification-readiness.mjs'
const packet=(id,entries)=>({task:{task_id:id,verification_plan:entries},project:{verification_config:{commands:[{name:'synthetic-unit',program:'node',args:['--test','synthetic.test.mjs'],capabilities:['database']}]}},workstream:{}})
test('P009 entire resolved bounded set has reviewed plan fingerprints',()=>{const r=boundedVerificationReadiness([packet('one',['git diff --check']),packet('two',[{version:2,kind:'command',description:'Synthetic database proof',command:'synthetic-unit',requires:['database']}])],2);assert.equal(r.ready,true);assert.equal(r.plans.length,2);assert.ok(r.plans.every(p=>/^[a-f0-9]{64}$/.test(p.plan_fingerprint)));assert.equal(boundedVerificationReadiness([packet('one',['git diff --check'])],2).ready,false)})
test('P009 a later unresolved obligation blocks readiness before any task dispatch',()=>{const r=boundedVerificationReadiness([packet('one',['git diff --check']),packet('later',['Unregistered cross-tenant browser authorization coverage'])],2);assert.equal(r.ready,false);assert.equal(r.gate.task_id,'later');assert.equal(r.gate.reason,'whole_bound_verification_mapping_required')})
test('P009 task-owned output does not block attempt one; external evidence is preserved',()=>{const r=boundedVerificationReadiness([packet('task',[{version:2,kind:'planned_test',description:'Create a deterministic fixture',expected_outputs:['synthetic.test.mjs']},{version:2,kind:'external_gate',description:'Advisor evidence from trusted provider',phase:'pre_publication'}])],1);assert.equal(r.ready,true);assert.deepEqual(r.plans[0].obligations.map(x=>x.category),['TASK_OWNED_OUTPUT','EXTERNAL_EVIDENCE']);assert.ok(r.plans[0].obligations[1].external_gate)})
test('P009 unrelated lint cannot satisfy browser authorization coverage',()=>{const r=boundedVerificationReadiness([packet('task',[{version:2,kind:'command',description:'Cross-tenant browser security',command:'git diff --check',requires:['browser-security']}])],1);assert.equal(r.ready,false)})

test('whole-bound admission inspects existing artifacts before creating a run', async () => {
 const {mkdtempSync,writeFileSync,rmSync}=await import('node:fs')
 const {tmpdir}=await import('node:os')
 const path=await import('node:path')
 const directory=mkdtempSync(path.join(tmpdir(),'cp-admission-'))
 try {
  const entry={version:2,kind:'command',description:'Synthetic database proof',command:'synthetic-unit',requires:['database']}
  const packets=[packet('first',['git diff --check']),packet('later',[entry])]
  const options={sourceRoot:directory,requireExecutables:true}
  let result=boundedVerificationReadiness(packets,2,options)
  assert.equal(result.ready,false)
  assert.equal(result.gate.task_id,'later')
  assert.ok(result.plans[1].obligations[0].reasons.includes('pre_existing_verification_artifact_missing'))
  writeFileSync(path.join(directory,'synthetic.test.mjs'),'// Existing executable fixture\n')
  result=boundedVerificationReadiness(packets,2,options)
  assert.equal(result.ready,true)
 } finally {rmSync(directory,{recursive:true,force:true})}
})

test('whole-bound review reports all later configuration debt in one pre-attempt result',()=>{
 const packets=[packet('first',['Unknown first obligation']),packet('second',['Unknown second obligation'])]
 const result=boundedVerificationReadiness(packets,2)
 assert.equal(result.ready,false);assert.equal(result.plans.length,2);assert.deepEqual(result.gates.map(g=>g.task_id),['first','second'])
})
test('task-owned output freezes its registered executable and refuses an unrelated command',()=>{
 const owned={version:2,kind:'planned_test',description:'Create the task-owned database invariant test',command:'synthetic-unit',requires:['database'],expected_outputs:['synthetic.test.mjs']}
 const result=boundedVerificationReadiness([packet('owned',[owned])],1)
 assert.equal(result.ready,true);assert.equal(result.plans[0].obligations[0].category,'TASK_OWNED_OUTPUT');assert.equal(result.plans[0].obligations[0].checks[0].program,'node')
 assert.equal(boundedVerificationReadiness([packet('owned',[{...owned,command:'git diff --check'}])],1).ready,false)
 assert.equal(boundedVerificationReadiness([packet('owned',[{...owned,expected_outputs:['../other-task.test.mjs']}])],1).ready,false)
})
