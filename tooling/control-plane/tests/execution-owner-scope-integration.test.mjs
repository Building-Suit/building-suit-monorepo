import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,readFileSync} from 'node:fs'
import {spawnSync} from 'node:child_process'
import {tmpdir} from 'node:os'
import path from 'node:path'

const required=process.env.CP_BATCH_READY_TEST_REQUIRE_POSTGRES==='1'
for(const scenario of ['owner-scope','retry-finalization','retry-finalization-future'])test(`real schema-105 recovery plus additive owner API / service / CLI / Git: ${scenario}`,{skip:!required&&!process.env.CP_EGRESS_TEST_CONTAINER,timeout:420000},t=>{
 const container=process.env.CP_EGRESS_TEST_CONTAINER;assert.match(container??'',/^cp-.*disposable[-a-z0-9]*$/,'explicit disposable PostgreSQL is mandatory')
 const output=mkdtempSync(path.join(tmpdir(),'cp-execution-owner-proof-'))
 const r=spawnSync(process.execPath,[new URL('./synthetic-runtime-e2e.mjs',import.meta.url).pathname,output,'--dispatch-integration','--supervisor-service','--fault='+scenario],{env:{...process.env,CP_EGRESS_TEST_CONTAINER:container},encoding:'utf8',timeout:400000,maxBuffer:4*1024*1024})
 assert.equal(r.status,0,r.stdout+'\n'+r.stderr+'\nEvidence: '+output)
 const proof=JSON.parse(readFileSync(path.join(output,'focused-repair-proof.json')))
 assert.equal(proof.real_cli,true);assert.equal(proof.real_postgres,true);assert.equal(proof.real_git_publisher,scenario==='owner-scope');assert.equal(proof.terminal_replay_unchanged??proof.settled_replay_unchanged,true);assert.equal(proof.dot_calls,0)
 if(scenario.startsWith('retry-finalization')){assert.equal(proof.attempt,2);assert.equal(proof.no_new_attempt,true);assert.equal(proof.consumed_receipt_preserved,true);assert.equal(proof.staging_gate_preserved,true)}
 else {assert.equal(proof.exact_credits,2);assert.equal(proof.shared_credit,1);assert.equal(proof.authenticated,true);assert.equal(proof.revocation_enforced,true);assert.equal(proof.replay_one_wake,true)}
 t.diagnostic(JSON.stringify({scenario,evidence:output,...proof.counts,credits:proof.exact_credits,shared_credit:proof.shared_credit??0}))
})
