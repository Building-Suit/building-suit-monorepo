// C03 exact-source restriction comparison. No network/service/device or clinical/legal authority.
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {createHash,randomUUID} from 'node:crypto'
import {readFileSync} from 'node:fs'
import path from 'node:path'
import {pathToFileURL} from 'node:url'
const started=new Date().toISOString(),args=process.argv.slice(2),assertions=[],inputs={}
assert.equal(args.length,4);assert.equal(args[0],'--base');assert.equal(args[2],'--head')
const base=args[1],head=args[3],folder='docs/work-packages/doctor-suit/implementation/'
assert.match(base,/^[a-f0-9]{40}$/);assert.match(head,/^[a-f0-9]{40}$/)
const git=(...a)=>execFileSync('git',a,{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim(),root=git('rev-parse','--show-toplevel')
const hash=v=>createHash('sha256').update(v).digest('hex'),source=(rev,f)=>execFileSync('git',['show',`${rev}:${f}`],{stdio:['ignore','pipe','pipe']})
const canonical=v=>JSON.stringify(v,(_k,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b))):x)
function check(id,ok){assertions.push({id,status:ok?'passed':'failed'})}
function bound(file){const b=source(head,file);inputs[file]=hash(b);check('working-source:'+file,hash(readFileSync(path.join(root,file)))===inputs[file]);return b}
function rejected(fn){try{fn();return false}catch{return true}}
try{
 check('candidate-is-current-head',git('rev-parse','HEAD')===head);check('parent-is-ancestor',git('merge-base',base,head)===base)
 bound(folder+'dos-m7-003-verify.mjs');bound(folder+'dos-m7-003.md');const p=JSON.parse(bound(folder+'dos-m7-003-packet.json'))
 check('canonical-task-parent-and-decision',p.task_id==='DOS-M7-003'&&p.parent_pr===503&&p.parent_head===base&&p.decision_id==='DOS-M7-GATE-REAL-DATA'&&p.candidate_binding==='evaluated-committed-head')
 check('clinical-review-and-real-data-approval-not-invented',['clinical_review','approved_clinical_scope','approved_delegation_policy','approved_emergency_wording','qualified_reviewer','owner_pilot_authorization','qualified_pilot_authorization'].every(k=>p[k]===null)&&p.gate_state==='OPEN'&&p.full_task_acceptance===false)
 check('governance-mandates-not-inferred',p.governance_roles.length===7&&new Set(p.governance_roles.map(r=>r.id)).size===7&&p.governance_roles.every(r=>['actual_identity','qualification','mandate','accepted_scope'].every(k=>r[k]===null)))
 check('pilot-not-run-or-population-invented',Object.keys(p.pilot_required_evidence).length===16&&Object.values(p.pilot_required_evidence).every(x=>x===null)&&p.actual_pilot_participants.length===0&&p.actual_pilot_results.length===0)
 check('stop-thresholds-and-accountable-owners-unapproved',p.proposed_stop_conditions.length===6&&p.proposed_stop_conditions.every(x=>x.approved_threshold===null&&x.accountable_decision_owner===null))
 check('workflow-exact-source-bound',p.proposed_workflow.length===6&&hash(canonical(p.proposed_workflow))===p.workflow_sha256)
 check('synthetic-only-boundaries-retained',p.technical_restrictions.data_mode==='synthetic'&&Object.entries(p.technical_restrictions).filter(([k])=>k!=='data_mode').length===13&&Object.entries(p.technical_restrictions).every(([k,v])=>k==='data_mode'||v===false))
 check('domain-review-obligations-unavailable',[1,2,4].every(n=>p.cases['DOS-M7-003-C0'+n].startsWith('unavailable-')))
 const legal=JSON.parse(bound(folder+'dos-m7-001-packet.json')),hosting=JSON.parse(bound(folder+'dos-m7-002-packet.json'))
 check('existing-legal-hosting-authority-absent',legal.review_receipt===null&&legal.decision_approval===null&&hosting.legal_review_receipt===null&&hosting.hosting_decision===null&&[legal,hosting].every(x=>x.gate_state==='OPEN'&&x.full_task_acceptance===false))
 const model='packages/contracts/src/doctorClinical.ts',edition='apps/doctor-suit/app/utils/administrativeEdition.ts',caregiver='apps/doctor-suit/app/utils/patientCaregiverProtocol.ts'
 for(const f of[model,edition,caregiver,folder+'dos-m2-001-continuation.md','apps/doctor-suit/supabase/migrations/20261019234429_clinical_encounter_foundation.sql','docs/architecture/environments.json']){const b=bound(f);check('existing-product-policy-bytes-parent-identical:'+f,hash(b)===hash(source(base,f)))}
 const{clinicalDirectory,emptyClinicalSnapshot,validClinicalSnapshot}=await import(pathToFileURL(path.join(root,model)).href)
 const safe={available:false,data_mode:'synthetic',clinical_approval:false,live_prescribing:false,rows:[],patients:[],total:0,capabilities:[]}
 check('actual-pure-contract-accepts-unavailable-synthetic-directory',clinicalDirectory(safe).available===false)
 for(const[k,v]of Object.entries({data_mode:'real',clinical_approval:true,live_prescribing:true}))check('actual-clinical-decoder-rejects:'+k,rejected(()=>clinicalDirectory({...safe,[k]:v})))
 check('syntactic-entered-snapshot-is-not-clinical-efficacy',validClinicalSnapshot(emptyClinicalSnapshot())===true)
 for(const k of['automatic_diagnosis','automatic_prescribing','recommended_dose','medication_substitution','clinical_efficacy_claim'])check('actual-snapshot-shape-rejects:'+k,validClinicalSnapshot({...emptyClinicalSnapshot(),[k]:'SYNTHETIC_NOT_AUTHORITY'})===false)
 const {doctorEditionMode}=await import(pathToFileURL(path.join(root,edition)).href)
 for(const mode of['live','production_clinical','qualified_prescribing'])check('actual-edition-contract-rejects:'+mode,doctorEditionMode(mode)===false)
 const {caregiverPreviewAllows}=await import(pathToFileURL(path.join(root,caregiver)).href)
 check('absent-caregiver-authority-remains-denied',caregiverPreviewAllows(null,null,'released_prescription',Date.now())===false)
 let tasks=0
 for(let i=1;i<=9;i++){const f=`docs/work-packages/doctor-suit/planning-v0.4/DOS-M${i}.json`,b=bound(f);check('canonical-packet-unchanged:'+i,hash(b)===hash(source(base,f)));tasks+=JSON.parse(b).tasks.length}
 check('nine-packets-104-tasks-preserved',tasks===104)
 check('only-canonical-document-and-own-fragment-diff',git('diff','--name-only',base,head).split('\n').every(f=>f.startsWith('docs/work-packages/doctor-suit/')||f==='release-fragments/dos-m7-003.json'))
}catch{check('input-or-contract-evaluation-failed',false)}
const failures=assertions.filter(x=>x.status==='failed').length
console.log(JSON.stringify({schema:'doctor-clinical-governance-restrictions/v1',execution_id:randomUUID(),task_id:'DOS-M7-003',case_id:'DOS-M7-003-C03',exact_base:base,exact_candidate:head,started_at_utc:started,ended_at_utc:new Date().toISOString(),argv:['node',...process.argv.slice(1)],node:process.versions.node,evaluated_input_sha256:inputs,assertions,control_passes:assertions.length-failures,control_failures:failures,exit_code:failures?1:0,result:failures?'failed':'passed-synthetic-restriction-comparison-only',runtime_or_pilot_executed:false,clinical_or_legal_authority_granted:false,full_task_acceptance:false},null,2));process.exitCode=failures?1:0
