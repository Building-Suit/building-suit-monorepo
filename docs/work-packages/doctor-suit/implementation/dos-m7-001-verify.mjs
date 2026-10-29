// Exact-candidate C02 comparison. Missing qualified legal review is UNAVAILABLE, never a passed opinion.
// No network, SDK, database, identity issuance, provider action or legal authority is supplied here.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash,randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
const started=new Date().toISOString(),argv=process.argv.slice(2)
assert.equal(argv.length,4);assert.equal(argv[0],'--base');assert.equal(argv[2],'--head')
const base=argv[1],head=argv[3];assert.match(base,/^[a-f0-9]{40}$/);assert.match(head,/^[a-f0-9]{40}$/)
const git=(...args)=>execFileSync('git',args,{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim(),root=git('rev-parse','--show-toplevel')
const sha=v=>createHash('sha256').update(v).digest('hex'),source=(rev,file)=>execFileSync('git',['show',`${rev}:${file}`],{cwd:root,stdio:['ignore','pipe','pipe']})
const canonical=v=>JSON.stringify(v,(_k,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b))):x)
const folder='docs/work-packages/doctor-suit/implementation/',script=folder+'dos-m7-001-verify.mjs',inputs={},assertions=[]
function check(id,ok){assertions.push({id,status:ok?'passed':'failed'})}
function bound(file){const b=source(head,file);inputs[file]=sha(b);check('working-source-matches-candidate:'+file,sha(readFileSync(path.join(root,file)))===inputs[file]);return b}
/** Negative or incomplete receipts cannot acquire legal authority through editable metadata. */
function reviewReceipt(receipt,scope){
 if(receipt===null)return'unavailable-no-qualified-receipt'
 if(!receipt||typeof receipt!=='object'||receipt.signed!==true)return'invalid-unsigned'
 if(receipt.candidate_sha!==scope.candidate||receipt.data_flow_sha256!==scope.flow||receipt.jurisdiction!=='Egypt'||!Array.isArray(receipt.participant_ids)||scope.participants.some(id=>!receipt.participant_ids.includes(id)))return'invalid-scope'
 if(receipt.superseded!==false)return'invalid-superseded'
 const date=Date.parse(receipt.reviewed_at),until=receipt.valid_until===null?null:Date.parse(receipt.valid_until)
 if(!Number.isFinite(date)||date>scope.now||(until!==null&&(!Number.isFinite(until)||until<=scope.now||until<=date)))return'invalid-date-or-validity'
 if(!receipt.reviewer||!['identity_ref','qualification_ref','authority_ref'].every(k=>typeof receipt.reviewer[k]==='string'&&receipt.reviewer[k].length>0)||!Array.isArray(receipt.authoritative_sources)||receipt.authoritative_sources.length===0||!Array.isArray(receipt.approved_requirement_refs)||receipt.approved_requirement_refs.length===0)return'invalid-incomplete'
 // This process has no independently authenticated reviewer/issuer connection. A well-shaped claim is not an opinion.
 return'unavailable-reviewer-authority-not-validated'
}
let disposition='unavailable-no-qualified-receipt'
try{
 check('executing-exact-candidate',git('rev-parse','HEAD')===head);check('parent-is-ancestor',git('merge-base',base,head)===base)
 bound(script);bound(folder+'dos-m7-001.md');const p=JSON.parse(bound(folder+'dos-m7-001-packet.json'))
 check('canonical-task-decision-and-parent',p.task_id==='DOS-M7-001'&&p.decision_id==='DOS-M7-GATE-LEGAL'&&p.parent_pr===401&&p.parent_head===base&&p.candidate_binding==='evaluated-committed-head')
 check('genuine-review-policies-and-approval-not-invented',p.review_receipt===null&&p.qualified_reviewer===null&&p.approved_policy_requirements===null&&p.decision_approval===null&&p.gate_state==='OPEN'&&p.full_task_acceptance===false)
 const ids=['doctor-practice','practice-staff','patient','caregiver','saas-operator','external-processors','external-health-partners']
 check('separate-participant-responsibilities-without-assigned-legal-roles',p.participants.length===ids.length&&new Set(p.participants.map(x=>x.id)).size===ids.length&&ids.every(id=>p.participants.some(x=>x.id===id&&x.legal_role===null&&x.approved_legal_basis===null&&x.actual_entity===null&&x.review_questions.length>=2)))
 check('exact-technical-data-flow-binding',p.product_data_flow.length===8&&sha(canonical(p.product_data_flow))===p.data_flow_sha256&&p.product_data_flow.every(x=>x.actors.every(id=>ids.includes(id))&&x.legal_basis===null&&x.actual_hosting_region===null&&x.real_data_approved===false))
 check('proposed-requirements-are-not-approved-policy',p.policy_questions.length>=9&&p.policy_questions.every(x=>x.approved_requirement===null&&x.accountable_policy_owner===null&&x.due_at===null)&&p.review_receipt_requirements.length>=5)
 check('dependent-actions-remain-held',Object.keys(p.dependent_actions).length===8&&Object.values(p.dependent_actions).every(x=>x===false))
 check('all-domain-criteria-remain-unavailable',Object.values(p.cases).length===4&&Object.values(p.cases).every(x=>x.startsWith('unavailable-')))
 check('public-pointer-discovery-does-not-become-authoritative-review',p.qualified_authoritative_legal_texts.length===0&&p.public_reference_discovery.length===2&&p.public_reference_discovery.every(x=>new URL(x.url).hostname==='pdpc.gov.eg'&&x.qualified_review===false))
 const scope={candidate:head,flow:p.data_flow_sha256,participants:ids,now:Date.now()};disposition=reviewReceipt(p.review_receipt,scope)
 check('missing-legal-review-is-unavailable',disposition==='unavailable-no-qualified-receipt')
 const fixture={signed:true,candidate_sha:head,data_flow_sha256:p.data_flow_sha256,jurisdiction:'Egypt',participant_ids:ids,superseded:false,reviewed_at:'2026-01-01T00:00:00Z',valid_until:null,reviewer:{identity_ref:'SYNTHETIC_NOT_A_REVIEWER',qualification_ref:'UNVERIFIED_FIXTURE',authority_ref:'UNVERIFIED_FIXTURE'},authoritative_sources:['SYNTHETIC_NOT_LEGAL_AUTHORITY'],approved_requirement_refs:['SYNTHETIC_NOT_APPROVED_POLICY']}
 for(const [id,patch,expected]of[
  ['unsigned',{signed:false},'invalid-unsigned'],['wrong-candidate',{candidate_sha:base},'invalid-scope'],['changed-flow',{data_flow_sha256:'0'.repeat(64)},'invalid-scope'],['missing-party',{participant_ids:ids.slice(1)},'invalid-scope'],['superseded',{superseded:true},'invalid-superseded'],['expired',{reviewed_at:'2000-01-01T00:00:00Z',valid_until:'2000-01-02T00:00:00Z'},'invalid-date-or-validity'],['future',{reviewed_at:'9999-12-31T00:00:00Z'},'invalid-date-or-validity'],['unqualified',{reviewer:{}},'invalid-incomplete']])check('negative-receipt-control:'+id,reviewReceipt({...fixture,...patch},scope)===expected)
 check('well-shaped-generated-claim-cannot-supply-authority',reviewReceipt(fixture,scope)==='unavailable-reviewer-authority-not-validated')
 for(let n=1;n<=9;n++){const file=`docs/work-packages/doctor-suit/planning-v0.4/DOS-M${n}.json`;check('canonical-packet-'+n+'-unchanged',sha(bound(file))===sha(source(base,file)))}
 const changed=git('diff','--name-only',base,head).split('\n').filter(Boolean);check('evidence-only-allowed-paths',changed.length>0&&changed.every(file=>file.startsWith('docs/work-packages/doctor-suit/')||file==='release-fragments/dos-m7-001.json'||file==='release-fragments/dos-m7-001-consolidation-binding-20261029.json'))
 const factPaths=['docs/architecture/environments.json','apps/doctor-suit/app/utils/authConfiguration.ts','apps/doctor-suit/app/utils/patientCaregiverProtocol.ts','apps/doctor-suit/app/utils/privacyRequests.ts','apps/doctor-suit/app/utils/contactPreferences.ts','apps/doctor-suit/app/utils/locationContext.ts','apps/doctor-suit/app/utils/administrativeEdition.ts','apps/doctor-suit/app/utils/entitlement.ts']
 for(const file of factPaths)check('technical-fact-source-unchanged:'+file,sha(bound(file))===sha(source(base,file)))
 const env=JSON.parse(source(head,'docs/architecture/environments.json')).products['doctor-suit']
 check('repository-map-is-not-hosted-state-approval',env.production.projectRef===''&&env.staging.projectRef===''&&env.schema==='public')
 const {doctorPrivacySnapshot}=await import(pathToFileURL(path.join(root,'apps/doctor-suit/app/utils/privacyRequests.ts')).href),id=n=>`d7010001-0000-4000-8000-${String(n).padStart(12,'0')}`,actor={userId:id(1),sessionId:id(11),practiceId:id(21)},raw={user_id:actor.userId,scope:'own_account',data_mode:'synthetic',policy_configured:false,fulfillment_available:false,items:[]}
 check('existing-synthetic-intake-baseline',doctorPrivacySnapshot(raw,actor).length===0)
 for(const [label,patch]of[['invented-policy',{policy_configured:true}],['unapproved-fulfillment',{fulfillment_available:true}],['foreign-account',{user_id:id(2)}]]){let denied=false;try{doctorPrivacySnapshot({...raw,...patch},actor)}catch{denied=true}check('existing-privacy-boundary-rejects:'+label,denied)}
 const {caregiverPreviewAllows}=await import(pathToFileURL(path.join(root,'apps/doctor-suit/app/utils/patientCaregiverProtocol.ts')).href),grant={id:'synthetic-grant',version:1,grantorAccountId:'synthetic-grantor',recipientAccountId:'synthetic-recipient',patientId:'synthetic-patient',doctorId:'synthetic-doctor',practiceId:'synthetic-practice',relationshipId:'synthetic-relationship',authorityEvidenceRef:'synthetic-not-legal-authority',policyRef:'synthetic-unapproved-policy',actions:['released_timeline'],validFrom:0,validUntil:1000,revokedAt:null,syntheticOnly:true,legalApproval:false},preview={environment:'synthetic',accountId:grant.recipientAccountId,sessionId:'synthetic-session',patientId:grant.patientId,doctorId:grant.doctorId,practiceId:grant.practiceId,relationshipId:grant.relationshipId}
 check('existing-memory-only-caregiver-preview-baseline',caregiverPreviewAllows(grant,preview,'released_timeline',100,1))
 check('synthetic-preview-rejects-invented-legal-approval',!caregiverPreviewAllows({...grant,legalApproval:true},preview,'released_timeline',100,1))
 check('synthetic-preview-rejects-live-scope',!caregiverPreviewAllows(grant,{...preview,environment:'live'},'released_timeline',100,1))
 check('synthetic-preview-rejects-foreign-patient',!caregiverPreviewAllows(grant,{...preview,patientId:'foreign-patient'},'released_timeline',100,1))
}catch{check('input-or-contract-unavailable',false)}
const failed=assertions.some(x=>x.status==='failed'),code=failed?1:2
console.log(JSON.stringify({schema:'doctor-legal-independent-verifier/v1',execution_id:randomUUID(),task_id:'DOS-M7-001',case_id:'DOS-M7-001-C02',exact_base:base,exact_candidate:head,started_at_utc:started,ended_at_utc:new Date().toISOString(),argv:['node',script,...argv],node:process.versions.node,evaluated_input_sha256:inputs,assertions,criterion_status:failed?'failed-input-binding-or-control':'unavailable-no-qualified-review-receipt',review_receipt_disposition:disposition,result:failed?'failed':'controls-verified-qualified-review-unavailable',exit_code:code,qualified_cases:{C01:'unavailable',C02:'unavailable',C03:'unavailable',C04:'unavailable'},government_registration_performed:false,hosted_state_validated:false,legal_or_professional_authority_granted:false,dependent_actions_enabled:false,full_task_acceptance:false}))
process.exitCode=code
