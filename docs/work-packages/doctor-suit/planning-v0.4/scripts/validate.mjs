import {readFileSync, existsSync, readdirSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {fileURLToPath} from 'node:url'
import {resolve} from 'node:path'
import assert from 'node:assert/strict'
import {resolveVerificationPlan, verificationPlanHasEntries, evaluateWorkstreamReadiness} from '../../../../../tooling/control-plane/runner/verification-mode.mjs'
import {safeRegisteredCommand, validateLocalSupabaseLifecycle} from '../../../../../tooling/control-plane/lib/workstream-readiness.mjs'

const base=fileURLToPath(new URL('../',import.meta.url))
const original=JSON.parse(readFileSync(resolve(base,'sources/doctor-suit-planning-v0.2.json')))
const manifest=JSON.parse(readFileSync(resolve(base,'sources/manifest.json')))
const reviewBaseline=JSON.parse(readFileSync(resolve(base,'review-baseline.json')))
for(const f of manifest.preserved_files){const b=readFileSync(resolve(base,'sources',f.path)); assert.equal(b.length,f.bytes); assert.equal(createHash('sha256').update(b).digest('hex'),f.sha256)}
const wanted=process.argv[2]
const files=readdirSync(base).filter(p=>/^DOS-M\d.json$/.test(p)).sort()
const packets=files.map(f=>JSON.parse(readFileSync(resolve(base,f))))
const registrationPath=resolve(base,'registration-adapter.proposal.json')
if(!wanted&&existsSync(registrationPath)){
 const registration=JSON.parse(readFileSync(registrationPath))
 const {proposal_sha256,...body}=registration
 assert.equal(createHash('sha256').update(JSON.stringify(sorted(body))).digest('hex'),proposal_sha256)
 assert.equal(registration.safe_to_apply,false)
 assert.equal(registration.live_schema_refresh.status,'explicitly-cancelled-not-retried')
 assert(Object.values(registration.required_live_bindings).every(v=>v===null))
 assert(registration.registration_proposal.forbidden_mutations.includes('control.projects.allowed_publication_paths'))
 assert.equal(registration.milestones.length,9)
 for(const m of registration.milestones){const p=packets.find(p=>p.milestone_id===m.milestone_id);assert.equal(m.packet_sha256,p.content_sha256);assert.equal(m.start_status,'open')}
}
const allTasks=new Map(packets.flatMap(p=>p.tasks.map(t=>[t.task_id,t])))
const allRequirements=new Set(packets.flatMap(p=>p.requirements.map(r=>r.requirement_id)))
const allDecisions=new Map(packets.flatMap(p=>p.decisions.map(d=>[d.decision_id,d])))
function sorted(value){if(Array.isArray(value))return value.map(sorted);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,sorted(value[k])]));return value}
assert.equal(allTasks.size,packets.reduce((n,p)=>n+p.tasks.length,0),'global task ID collision')
const inScope=(p,scopes)=>scopes.some(s=>p===s||s.endsWith('/')&&p.startsWith(s))
const visited=new Set(), active=new Set()
function visit(id){assert(allTasks.has(id),`missing dependency ${id}`); assert(!active.has(id),`cycle ${id}`); if(visited.has(id))return;active.add(id);for(const d of allTasks.get(id).task_dependencies)visit(d);active.delete(id);visited.add(id)}
const reports=[]
for(const p of packets){
 if(wanted&&p.milestone_id!==wanted)continue
 const source=original.milestones.find(m=>m.milestone_id===p.milestone_id)
 assert.equal(p.tasks.length,source.task_count)
 assert.deepEqual(p.tasks.map(t=>t.task_id),source.tasks.map(t=>t.task_id))
 assert.deepEqual(p.depends_on_milestones,source.depends_on)
 assert.equal(new Set(p.tasks.map(t=>t.task_id)).size,p.tasks.length)
 assert.equal(p.import_readiness.safe_to_apply,false)
 const {content_sha256,...content}=p
 assert.equal(createHash('sha256').update(JSON.stringify(sorted(content))).digest('hex'),content_sha256,'packet fingerprint mismatch')
 const start=p.decisions.find(d=>d.decision_id===p.milestone_id+'-GATE-START')
 assert.equal(start?.status,'open')
 const proposal=JSON.parse(readFileSync(resolve(base,p.milestone_id+'.import-proposal.json')))
 assert.equal(proposal.safe_to_apply,false);assert.equal(proposal.packet_sha256,p.content_sha256)
 for(const d of p.decisions)assert(proposal.task_decisions.some(l=>l.decision_id===d.decision_id),`orphan decision ${d.decision_id}`)
 for(const c of p.verification_config_proposal.commands)assert(safeRegisteredCommand(c),`unsafe command ${c.name}`)
 assert.equal(validateLocalSupabaseLifecycle(p.verification_config_proposal.database).valid,true)
 assert.equal(new Set(p.verification_config_proposal.commands.map(c=>c.name)).size,p.verification_config_proposal.commands.length)
 const taskReports=[]
 for(const t of p.tasks){
  assert.equal(t.status,'planned'); assert.equal(t.engine_stage,'pending');assert.equal(t.metadata.clinical_live_data_allowed,false)
  assert(t.blocking_decision_ids.includes(start.decision_id))
  assert(t.acceptance_criteria.length>=3);assert(t.verification_scenarios.length>=2);assert(t.description.length>1000);assert(t.allowed_paths.length>0)
  for(const d of t.blocking_decision_ids)assert(allDecisions.has(d),`${t.task_id} missing decision ${d}`)
  for(const r of t.linked_requirement_ids)assert(allRequirements.has(r),`${t.task_id} missing requirement ${r}`)
  for(const path of [...t.allowed_paths,...t.expected_outputs])assert(!path.startsWith('/')&&!path.split('/').includes('..'),`unsafe path ${path}`)
  for(const path of t.expected_outputs)assert(inScope(path,t.allowed_paths),`${t.task_id} output outside scope: ${path}`)
  assert.deepEqual(t.metadata.allowed_paths,t.allowed_paths)
  assert.equal(t.acceptance_mapping.length,t.acceptance_criteria.length)
  assert.equal(t.verification_cases.length,t.acceptance_criteria.length+1)
  for(const c of t.verification_cases){
   assert(c.command_refs.length||c.external_evidence_required);assert(c.procedure.length>40)
   for(const ref of c.command_refs)assert(ref==='pnpm check'||p.verification_config_proposal.commands.some(x=>x.name===ref))
   for(const output of c.required_outputs)assert(t.expected_outputs.includes(output))
   if(c.criterion_ids.length){
    assert.equal(c.evidence_policy.human_approval_required,c.evidence_types.includes('accountable-human-review'))
    const automated=c.evidence_types.includes('independent-exact-candidate-automated-verifier')
    assert.equal(c.evidence_policy.independent_automated_verification_required,automated)
    if(automated){assert(c.evidence_policy.automated_receipt_fields.includes('exact candidate SHA and base SHA'));assert(c.evidence_policy.missing_evidence_behavior.includes('never ask for a human acknowledgement'))}
    if(p.milestone_id==='DOS-M1')assert.equal(c.evidence_policy.human_approval_required,false,'M1 ordinary synthetic implementation must not acquire a new human approval requirement')
    if(['DOS-M1-001-C01','DOS-M1-001-C02','DOS-M1-001-C04','DOS-M1-002-C04','DOS-M1-017-C03','DOS-M1-020-C04'].includes(c.case_id)){
     assert(automated);assert(c.command_refs.includes(t.task_id.toLowerCase()+'-unit'))
    }
   }
  }
  for(const m of t.acceptance_mapping){assert.deepEqual(m.verification_case_ids,[t.task_id+`-C${String(m.criterion).padStart(2,'0')}`]);const c=t.verification_cases.find(c=>c.case_id===m.verification_case_ids[0]);assert.deepEqual(c.criterion_ids,[m.criterion]);assert.equal(c.assertion,m.text)}
  assert(!t.verification_plan.some(v=>['reviewer_identity_scope_candidate_and_decision_evidence_required','criterion_review_evidence_required'].includes(v.blocker)),'blanket human review gate must not return')
  assert(verificationPlanHasEntries(t.verification_plan))
  const result=resolveVerificationPlan({entries:t.verification_plan,configuredCommands:p.verification_config_proposal.commands,phase:'pre_implementation'})
  const unexpected=result.blockers
  assert.equal(result.unenforced.length,0,`${t.task_id} unenforced ${JSON.stringify(result.unenforced)}`)
  assert.equal(unexpected.length,0,`${t.task_id} invalid mapping ${JSON.stringify(unexpected)}`)
  for(const o of t.verification_plan.filter(x=>x.kind==='planned_test'))assert(o.commands?.length,`${t.task_id} planned output without command`)
  const readiness=evaluateWorkstreamReadiness({task:t,suit:{slug:'doctor-suit'},project:{verification_config:{}},workstream:{application_path:'apps/doctor-suit',verification_config:p.verification_config_proposal,publication_config:t.metadata.publication_policy},publication_boundaries:{task_paths:t.allowed_paths,source_paths:t.allowed_paths}})
  assert.equal(readiness.ready,true,`${t.task_id} proposed configuration cannot be admitted: ${JSON.stringify(readiness)}`)
  assert(proposal.task_decisions.some(l=>l.task_id===t.task_id&&l.decision_id===start.decision_id&&l.blocking))
  for(const d of t.produces_decision_ids??[])assert(proposal.task_decisions.some(l=>l.task_id===t.task_id&&l.decision_id===d&&l.blocking===false),`missing producer evidence link ${d}`)
  for(const d of t.informational_decision_ids??[])assert(proposal.task_decisions.some(l=>l.task_id===t.task_id&&l.decision_id===d&&l.blocking===false))
  const call=proposal.create_task_calls.find(c=>c.arguments.p_task_id===t.task_id)
  assert(call.review_only);assert.equal(call.arguments.p_workstream_slug,null);assert.equal(call.arguments.p_model_profile,null);assert.equal(call.arguments.p_retry_policy_id,null)
  assert.deepEqual(call.arguments.p_metadata.canonical_task_contract,t,'canonical task fields lost in adapter metadata')
  assert.equal(createHash('sha256').update(JSON.stringify(sorted(t))).digest('hex'),call.arguments.p_metadata.canonical_task_sha256)
  assert.equal(proposal.live_read_hold.status,'explicitly-cancelled-not-retried')
  assert.equal(t.release_contract.fragment_path,'release-fragments/'+t.task_id.toLowerCase()+'.json')
  assert(!t.allowed_paths.includes('release-fragments/'))
  assert.equal(t.allowed_paths.includes('release-changes/items.json'),t.release_contract.inventory_path==='release-changes/items.json')
  assert(t.verification_plan.some(v=>v.commands?.includes('doctor-release-check')))
  assert.deepEqual(t.task_dependencies,reviewBaseline.tasks[t.task_id],`review changed dependency graph for ${t.task_id}`)
  if(['DOS-M1-005','DOS-M1-019','DOS-M1-020'].includes(t.task_id)){assert(!t.blocking_decision_ids.includes('DOS-M1-D005'));assert.equal(allDecisions.get('DOS-M1-D004').status,'approved')}
  if(t.task_id==='DOS-M1-004'){
   assert(t.expected_outputs.includes('apps/doctor-suit/tests/e2e/dos-m1-004.spec.ts'))
   for(const i of [2,3,4])assert(t.verification_cases[i-1].command_refs.includes('dos-m1-004-browser'))
   const c=p.verification_config_proposal.commands.find(c=>c.name==='dos-m1-004-browser');assert.equal(c.program,'pnpm');assert(c.args.includes('playwright'));assert(c.args.includes('--workers=1'));assert(c.args.includes('--retries=0'))
  }
  assert.deepEqual(proposal.task_dependencies.filter(l=>l.task_id===t.task_id).map(l=>l.depends_on_task_id),t.task_dependencies)
  const prior=source.tasks.find(s=>s.task_id===t.task_id)
  for(const d of prior.task_dependencies)assert(t.task_dependencies.includes(d),`${t.task_id} dropped source dependency ${d}`)
  visit(t.task_id)
  taskReports.push({task_id:t.task_id,command_mapping:'resolved-against-repository-resolver',proposed_configuration_readiness:'passed-static-only-not-live-admission',checks:result.checks.length,planned_outputs:result.deferred.filter(x=>x.kind==='planned_test').length,explicit_gates:result.blockers.length+result.deferred.filter(x=>x.kind!=='planned_test').length,product_execution:'not-run'})
 }
 const final=p.tasks.at(-1), reachable=new Set();function deps(id){for(const d of allTasks.get(id).task_dependencies){if(!reachable.has(d)){reachable.add(d);deps(d)}}}deps(final.task_id)
 for(const t of p.tasks.slice(0,-1))assert(reachable.has(t.task_id),`${final.task_id} omits ${t.task_id}`)
 reports.push({milestone:p.milestone_id,tasks:p.tasks.length,requirements:p.requirements.length,decisions:p.decisions.length,criterion_cases:p.tasks.reduce((n,t)=>n+t.acceptance_mapping.length,0),coverage:'criterion-specific-procedure-and-selected-executable/evidence',routine_checks:'independent-automated-exact-candidate-no-human-acknowledgement',canonical_metadata:'all-task-fields-deep-equal-and-hash-verified',dependency_graph:'identical-to-c9716fbf-review-baseline',release_scope:'task-fragment-and-related-inventory-only',start_gate:'open-linked-to-every-task',artifact_validation:'passed',live_import_validation:'held-cancelled-refresh-needs-renewed-permission',task_reports:taskReports})
}
console.log(JSON.stringify({source_bytes:'verified',task_count:reports.reduce((n,r)=>n+r.tasks,0),reports},null,2))
