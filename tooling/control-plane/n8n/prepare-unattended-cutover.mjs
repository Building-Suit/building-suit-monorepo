#!/usr/bin/env node
// Prepare a reviewable local plan only. No Git publication, SQL, service or n8n writes.
import assert from 'node:assert/strict'
import {readFileSync,writeFileSync,readlinkSync,existsSync} from 'node:fs'
import {createHash} from 'node:crypto'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {verifyRuntimeRelease} from '../runner/runtime-release.mjs'

const hash=bytes=>createHash('sha256').update(bytes).digest('hex')
export function prepareUnattendedCutover({sourceRoot,releaseHome,consumerExport,runSnapshot,adoptionSnapshot,proofs,output}) {
 const previousPointer=readlinkSync(path.join(releaseHome,'current')),previous=verifyRuntimeRelease(path.resolve(releaseHome,previousPointer))
 assert.equal(previous.schema_version,108,'only the inspected schema-108 consumer is supported')
 const consumers=JSON.parse(readFileSync(consumerExport)).workflows
 const required=['pg0BEkbP9E4H4RqB','BS22OperatorGates','BS23OperatorCapability','rzoRWvnSBG7sU1Oh']
 const interfaces=required.map(id=>{const flow=consumers.find(f=>f.id===id);assert.ok(flow?.active,'actual required consumer is inactive/missing: '+id);return {id,name:flow.name,sha256:hash(JSON.stringify(flow))}})
 assert.match(JSON.stringify(consumers.find(f=>f.id===required[0]).nodes),/bs-agent run-supervise/)
 assert.match(JSON.stringify(consumers.find(f=>f.id==='BS23OperatorCapability').nodes),/n8n-nodes-base.ssh/)
 const migrations=['tooling/control-plane/sql/111_unattended_bounded_queue.sql']
 const additions=['tooling/control-plane/runner/unattended-publication.mjs','tooling/control-plane/tests/fixtures/restored-queue-proof.mjs','tooling/control-plane/tests/fixtures/queue-consumer-cutover-proof.mjs','tooling/control-plane/tests/unattended-queue.test.mjs','tooling/control-plane/tests/unattended-queue-postgres.test.mjs','tooling/control-plane/n8n/prepare-unattended-cutover.mjs',...migrations]
 const changed=Object.keys(previous.files).filter(file=>hash(readFileSync(path.join(sourceRoot,file)))!==previous.files[file])
 const files=Object.fromEntries([...new Set([...changed,...additions])].sort().map(file=>[file,hash(readFileSync(path.join(sourceRoot,file)))]))
 assert.ok(!Object.keys(files).some(f=>/\/(109|110)_/.test(f)))
 const runs=JSON.parse(readFileSync(runSnapshot)),adoption=JSON.parse(readFileSync(adoptionSnapshot))
 assert.equal(adoption.length,1);assert.equal(adoption[0].project_ref,'padtxclxwwqvvuiebhte')
 const queues=runs.map(r=>({...r,future_policy_changes:r.tasks.filter(t=>t.execution_count===0&&t.policy.max_attempts!==5).map(t=>({task_id:t.task_id,previous_policy:t.policy,new_policy:'standard-five',new_max_attempts:5})),preserve:r.tasks.filter(t=>t.execution_count>0||t.policy.max_attempts===5).map(t=>({task_id:t.task_id,policy:t.policy.policy_id,max_attempts:t.policy.max_attempts,execution_count:t.execution_count}))}))
 const tested=proofs.map(file=>{assert.ok(existsSync(file),'acceptance proof missing: '+file);const receipt=JSON.parse(readFileSync(file));assert.equal(receipt.passed,true);return {scenario:receipt.scenario??receipt.recovery??'infrastructure-repair',file,sha256:hash(readFileSync(file))}})
 const plan={version:1,live_mutation_performed:false,publication_owner_required:true,project_ref:adoption[0].project_ref,baseline_id:adoption[0].baseline_id,expected_current:previousPointer,previous_release:previous.release_id,previous_source:previous.commit,source_root:sourceRoot,changed_files:files,new_runtime_files:additions,migrations,consumer_export_sha256:hash(readFileSync(consumerExport)),interfaces,queues,acceptance:tested,
 steps:['Before any push, verify actual provider Git/Automatic branching settings prevent feature deploys and hosted preview SQL; repository configuration alone is not a dashboard receipt. Separate publication owner publishes verified feature commit and Draft PR; workers never commit/push. Re-run agent preflight and pr-check.','Quiesce existing Supervisor/runner writers and wait for all unfinished runtime operations to settle; retain protective holds. Snapshot history digests and schema definitions.','Compare live project ref, adoption baseline, current pointer, consumer interface digests, scopes, policies and queue limits. Any drift aborts and requires a fresh reviewed plan.','Apply ONLY 111 using exactMigrationTransaction with the actual published source commit, exact checksum, project ref and existing adoption baseline; compare history digests before/after.','PrepareRuntimeRelease from clean published source, installed file manifest plus listed additions, schemaVersion 111 and independently executed acceptance receipts. Register release and use activateRuntimeRelease with the saved expectedCurrent pointer and readiness callbacks.','Through existing authenticated BS-22/BS-23 owner capability approve each exact existing queue offer as one bounded authorization, including only listed future-policy changes. No per-task ordinary approval. Release only the cutover protective holds and enqueue existing run wakes.','Check actual consumer path, release ledger, Supervisor service and wake acquisition. Do not waive Shop/SAS external or protected-file gates.'],
 rollback:['If activation/readiness fails, existing activateRuntimeRelease restores the previous pointer/services automatically; leave additive 111 and its migration ledger intact.','After any task starts, stop/quiesce writers, hold the three runs, revoke new queue grants through the operator capability, restore the saved schema-108 pointer and restart its services. Preserve all executions, policies for started tasks, branches, Drafts, park records and exact credits. Restore a changed policy only for still-unstarted tasks by explicit owner action. No attempt refund, SQL history deletion or automated merge/deploy.'],
 safety_exceptions:['Unclassified failures and missing trusted PASS / command / source evidence.','Changed task/requirement/verification/scope/policy/controller authority; disabled/revoked owner; existing stop/maintenance/dependency/decision gates.','Existing protected files, SQL/provider/secrets/CI changes, and access-control/security/shared auth/contracts/data-access/server API changes; require separate specific review.','SAS Billing mandatory independent staging evidence and verifier prerequisites; no invented receipt.','Unverified provider feature-deployment/Automatic branching settings prevent publication until checked; no provider settings are changed by the loop.','Five genuine product failures remain blocked; no sixth attempt, budget reset or recurring retry-extension offer.'],authorization_required:true}
 writeFileSync(output,JSON.stringify(plan,null,2)+'\n');return plan
}
if(process.argv[1]===fileURLToPath(import.meta.url)) {
 const [config]=process.argv.slice(2);assert.ok(config,'provide a local JSON preparation config')
 const plan=prepareUnattendedCutover(JSON.parse(readFileSync(config)));process.stdout.write(JSON.stringify({prepared:true,live_mutation_performed:false,output:plan.source_root,previous_release:plan.previous_release,policy_changes:plan.queues.flatMap(q=>q.future_policy_changes).length})+'\n')
}
