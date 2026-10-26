// Documentation readiness only. All four accountable-review criteria remain UNAVAILABLE.
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {createHash,randomUUID} from 'node:crypto'
import {readFileSync} from 'node:fs'
const started=new Date().toISOString(),args=process.argv.slice(2),checks=[],inputs={}
assert.equal(args.length,4);assert.equal(args[0],'--base');assert.equal(args[2],'--head')
const base=args[1],head=args[3],folder='docs/work-packages/doctor-suit/implementation/'
assert.match(base,/^[a-f0-9]{40}$/);assert.match(head,/^[a-f0-9]{40}$/)
const git=(...a)=>execFileSync('git',a,{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim()
const hash=b=>createHash('sha256').update(b).digest('hex')
const canonical=v=>JSON.stringify(v,(_k,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b))):x)
function check(id,ok){checks.push({id,status:ok?'passed':'failed'})}
function bound(file){const b=execFileSync('git',['show',`${head}:${file}`],{stdio:['ignore','pipe','pipe']});inputs[file]=hash(b);check('working-input:'+file,hash(readFileSync(file))===inputs[file]);return b}
function readiness(p){
 const reasons=[]
 if(p.legal_review_receipt===null)reasons.push('missing-qualified-legal-review')
 if(p.hosting_decision===null)reasons.push('missing-accountable-hosting-decision')
 const ids=new Set(p.inventory.map(n=>n.id))
 for(const n of p.inventory){
  if(!n.actual_region)reasons.push('unknown-region:'+n.id)
  if(!n.verified_subprocessors||!n.accountable_approval)reasons.push('unapproved-processor:'+n.id)
  if(!n.actual_supplier_entity||!n.actual_account||!n.executed_contract||!n.approved_transfer_basis||!n.approved_retention||!n.support_authority)reasons.push('incomplete-evidence:'+n.id)
 }
 for(const f of p.flows)if([...f.steps,...f.side_destinations].some(id=>!ids.has(id)))reasons.push('unknown-flow-destination:'+f.id)
 if(hash(canonical(p.flows))!==p.data_flow_sha256)reasons.push('changed-flow-digest')
 if(p.unexpected_sensitive_analytics===true)reasons.push('unexpected-sensitive-analytics')
 // A machine-readable claim cannot authenticate its issuer or supply professional authority.
 return{status:'unavailable',reasons:reasons.length?reasons:['reviewer-authority-not-independently-validated']}
}
try{
 check('candidate-is-current-head',git('rev-parse','HEAD')===head)
 check('exact-published-parent',base==='2ac85c8a8c3d2266e59c9e484b4860fafcaa5a74'&&git('merge-base',base,head)===base)
 bound(folder+'dos-m7-002-verify.mjs');bound(folder+'dos-m7-002.md')
 const p=JSON.parse(bound(folder+'dos-m7-002-packet.json'))
 check('canonical-task-parent-and-gate',p.task_id==='DOS-M7-002'&&p.parent_pr===502&&p.parent_head===base&&p.decision_id==='DOS-M7-GATE-HOSTING'&&p.candidate_binding==='evaluated-committed-head')
 check('all-accountable-criteria-unavailable',Object.keys(p.cases).length===4&&Object.values(p.cases).every(x=>x==='unavailable-accountable-hosting-review'))
 check('approval-and-dependent-actions-held',p.gate_state==='OPEN'&&p.full_task_acceptance===false&&p.hosting_decision===null&&p.legal_review_receipt===null&&Object.keys(p.dependent_actions).length===8&&Object.values(p.dependent_actions).every(x=>x===false))
 const ids=['browser','android','ssr','auth-db','documents','account-mail','outbox','financial','observability','ci','backups','support','partner']
 check('complete-unique-component-inventory',p.inventory.length===ids.length&&new Set(p.inventory.map(x=>x.id)).size===ids.length&&ids.every(id=>p.inventory.some(x=>x.id===id)))
 const unknown=['actual_supplier_entity','actual_account','actual_region','verified_subprocessors','executed_contract','approved_transfer_basis','approved_retention','support_authority','accountable_approval']
 check('actual-account-contract-region-authority-not-invented',p.inventory.every(n=>unknown.every(k=>n[k]===null)))
 check('six-digest-bound-flows',p.flows.length===6&&hash(canonical(p.flows))===p.data_flow_sha256&&p.flows.every(f=>[...f.steps,...f.side_destinations].every(id=>ids.includes(id))))
 for(const id of ['document','reminder'])check(id+'-includes-all-side-destinations',p.flows.some(f=>f.id===id&&['observability','backups','support'].every(k=>f.side_destinations.includes(k))))
 check('separate-account-mobile-money-and-ci-traces',['account-verification','android-auth','synthetic-money','ci-recovery'].every(id=>p.flows.some(x=>x.id===id)))
 check('public-provider-pages-are-not-customer-evidence',p.public_references.length===4&&p.public_references.every(x=>x.observed_at==='2026-10-26'&&x.customer_specific_evidence===false&&['supabase.com','vercel.com'].includes(new URL(x.url).hostname)))
 check('required-accountable-receipt-scope-enumerated',p.approval_evidence_required.length===5)
 const disposition=readiness(p)
 check('actual-incomplete-packet-remains-unavailable',disposition.status==='unavailable'&&disposition.reasons.includes('unknown-region:auth-db')&&disposition.reasons.includes('unapproved-processor:observability'))
 const changed=structuredClone(p);changed.flows[0].steps.push('unapproved-subprocessor')
 check('reject-unknown-subprocessor-and-changed-scope',readiness(changed).reasons.includes('unknown-flow-destination:document')&&readiness(changed).reasons.includes('changed-flow-digest'))
 const analytics=structuredClone(p);analytics.unexpected_sensitive_analytics=true
 check('reject-unexpected-sensitive-analytics',readiness(analytics).reasons.includes('unexpected-sensitive-analytics'))
 const claim=structuredClone(p);claim.hosting_decision={signed:true,approved:true,candidate:head};claim.legal_review_receipt={signed:true};for(const n of claim.inventory)for(const k of unknown)n[k]='SYNTHETIC_UNVERIFIED_CLAIM'
 check('well-shaped-generated-claim-is-not-authority',readiness(claim).status==='unavailable'&&readiness(claim).reasons[0]==='reviewer-authority-not-independently-validated')
 let tasks=0
 for(let i=1;i<=9;i++){const file=`docs/work-packages/doctor-suit/planning-v0.4/DOS-M${i}.json`,b=bound(file);check('canonical-packet-unchanged:'+i,hash(b)===hash(execFileSync('git',['show',`${base}:${file}`])));tasks+=JSON.parse(b).tasks.length}
 check('nine-packets-104-tasks',tasks===104)
 const env=JSON.parse(bound('docs/architecture/environments.json'))
 check('environment-map-parent-identical',hash(Buffer.from(JSON.stringify(env)))===hash(Buffer.from(JSON.stringify(JSON.parse(execFileSync('git',['show',`${base}:docs/architecture/environments.json`],{encoding:'utf8'}))))))
 check('only-authorized-document-and-fragment-diff',git('diff','--name-only',base,head).split('\n').every(f=>f.startsWith('docs/work-packages/doctor-suit/')||f==='release-fragments/dos-m7-002.json'))
 const failed=checks.filter(x=>x.status==='failed').length
 console.log(JSON.stringify({schema:'doctor-hosting-readiness/v1',execution_id:randomUUID(),task_id:'DOS-M7-002',exact_base:base,exact_candidate:head,started_at_utc:started,ended_at_utc:new Date().toISOString(),argv:['node',...process.argv.slice(1)],node:process.versions.node,evaluated_input_sha256:inputs,assertions:checks,control_passes:checks.length-failed,control_failures:failed,disposition,criterion_status:p.cases,domain_approval:false,full_task_acceptance:false,exit_code:failed?1:2},null,2));process.exitCode=failed?1:2
}catch{console.log(JSON.stringify({schema:'doctor-hosting-readiness/v1',exact_base:base,exact_candidate:head,assertions:checks,status:'failed-to-evaluate',domain_approval:false,exit_code:1},null,2));process.exitCode=1}
