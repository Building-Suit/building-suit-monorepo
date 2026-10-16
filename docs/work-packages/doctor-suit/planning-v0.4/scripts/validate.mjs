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
for(const f of manifest.preserved_files){const b=readFileSync(resolve(base,'sources',f.path)); assert.equal(b.length,f.bytes); assert.equal(createHash('sha256').update(b).digest('hex'),f.sha256)}
const wanted=process.argv[2]
const files=readdirSync(base).filter(p=>/^DOS-M\d.json$/.test(p)).sort()
const packets=files.map(f=>JSON.parse(readFileSync(resolve(base,f))))
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
  assert.equal(t.verification_cases.length,t.verification_scenarios.length)
  for(const c of t.verification_cases){assert(c.command_refs.length||c.external_evidence_required);for(const ref of c.command_refs)assert(p.verification_config_proposal.commands.some(x=>x.name===ref))}
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
  assert.deepEqual(proposal.task_dependencies.filter(l=>l.task_id===t.task_id).map(l=>l.depends_on_task_id),t.task_dependencies)
  const prior=source.tasks.find(s=>s.task_id===t.task_id)
  for(const d of prior.task_dependencies)assert(t.task_dependencies.includes(d),`${t.task_id} dropped source dependency ${d}`)
  visit(t.task_id)
  taskReports.push({task_id:t.task_id,command_mapping:'resolved-against-repository-resolver',proposed_configuration_readiness:'passed-static-only-not-live-admission',checks:result.checks.length,planned_outputs:result.deferred.filter(x=>x.kind==='planned_test').length,explicit_gates:result.blockers.length+result.deferred.filter(x=>x.kind!=='planned_test').length,product_execution:'not-run'})
 }
 const final=p.tasks.at(-1), reachable=new Set();function deps(id){for(const d of allTasks.get(id).task_dependencies){if(!reachable.has(d)){reachable.add(d);deps(d)}}}deps(final.task_id)
 for(const t of p.tasks.slice(0,-1))assert(reachable.has(t.task_id),`${final.task_id} omits ${t.task_id}`)
 reports.push({milestone:p.milestone_id,tasks:p.tasks.length,requirements:p.requirements.length,decisions:p.decisions.length,start_gate:'open-linked-to-every-task',artifact_validation:'passed',live_import_validation:'pending-parent-contract',task_reports:taskReports})
}
console.log(JSON.stringify({source_bytes:'verified',task_count:reports.reduce((n,r)=>n+r.tasks,0),reports},null,2))
