import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,readFileSync,rmSync} from 'node:fs'
import {spawnSync} from 'node:child_process'
import {tmpdir} from 'node:os'
import path from 'node:path'

const container=process.env.CP_EGRESS_TEST_CONTAINER
const required=process.env.CP_BATCH_READY_TEST_REQUIRE_POSTGRES==='1'
// Every scenario creates its own disposable DB and local Git/provider fixtures.
// Neither source-repository commits nor hosted resources participate.
for(const fault of [null,'verifier-fixture','product-defect'])test(`real wake/service/CLI dispatch: ${fault??'publication, credit, next task and restart'}`,{skip:!required&&!container,timeout:360000},t=>{
 assert.match(container??'',/^cp-.*disposable[-a-z0-9]*$/,'explicit disposable PostgreSQL container required')
 const output=mkdtempSync(path.join(tmpdir(),'cp-supervisor-dispatch-'))
 const args=[new URL('./synthetic-runtime-e2e.mjs',import.meta.url).pathname,output,'--dispatch-integration','--supervisor-service',...(fault?['--fault='+fault]:['--fault-publication=pr'])]
 const result=spawnSync(process.execPath,args,{encoding:'utf8',timeout:340000,maxBuffer:4*1024*1024,env:{...process.env,CP_EGRESS_TEST_CONTAINER:container}})
  assert.equal(result.status,0,`${result.stdout}\n${result.stderr}\nEvidence: ${output}`)
  const proof=JSON.parse(readFileSync(path.join(output,'supervisor-service-proof.json'))),outcome=JSON.parse(readFileSync(path.join(output,'outcome.json')))
  assert.equal(proof.real_cli,true);assert.equal(proof.claimed_wake_task_action,true);assert.equal(proof.dot_calls,0);assert.equal(proof.terminal_replay_unchanged,true);assert.equal(proof.shared_credit,1)
  assert.equal(outcome.credits,2);assert.equal(outcome.publications,2)
  assert.deepEqual(outcome.product_accounting.map(a=>a.consumed),fault==='product-defect'?[1,0]:[0,0])
  if(fault==='verifier-fixture'){assert.equal(proof.counts.executions,1);assert.equal(proof.counts.verifications,2);assert.equal(JSON.parse(readFileSync(path.join(output,'automatic-fixture-repair.json'))).product_attempts,0)}
  if(fault==='product-defect'){assert.equal(proof.counts.executions,2);assert.equal(proof.counts.verifications,2)}
  if(!fault){assert.equal(proof.restarted,true);assert.equal(proof.external_response_reconciled,true)}
  t.diagnostic(JSON.stringify({scenario:fault??'restart/publication-response',executions:proof.counts.executions,verifications:proof.counts.verifications,credits:outcome.credits,publications:outcome.publications,shared_credit:proof.shared_credit,consumed:outcome.product_accounting.map(a=>a.consumed),terminal_replay_unchanged:proof.terminal_replay_unchanged}))
  rmSync(output,{recursive:true,force:true})
})
