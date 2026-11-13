// Independent exact-candidate C03 comparison. No network, SDK, DB, device, Auth or government/provider operation.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash,randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
const started=new Date().toISOString(),argv=process.argv.slice(2)
assert.equal(argv.length,4);assert.equal(argv[0],'--base');assert.equal(argv[2],'--head')
const base=argv[1],head=argv[3];assert.match(base,/^[a-f0-9]{40}$/);assert.match(head,/^[a-f0-9]{40}$/)
const git=(...args)=>execFileSync('git',args,{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim(),root=git('rev-parse','--show-toplevel'),hash=v=>createHash('sha256').update(v).digest('hex'),source=(rev,file)=>execFileSync('git',['show',`${rev}:${file}`],{cwd:root,stdio:['ignore','pipe','pipe']})
const folder='docs/work-packages/doctor-suit/implementation/',script=folder+'dos-m6-010-verify.mjs',inputs={},assertions=[]
function check(id,ok){assertions.push({id,status:ok?'passed':'failed'})}
function bound(file){const b=source(head,file);inputs[file]=hash(b);check('working-source-matches-candidate:'+file,hash(readFileSync(path.join(root,file)))===inputs[file]);return b}
try{
 check('executing-exact-candidate',git('rev-parse','HEAD')===head);check('parent-is-ancestor',git('merge-base',base,head)===base)
 bound(script);bound(folder+'dos-m6-010.md');const packet=JSON.parse(bound(folder+'dos-m6-010-packet.json'))
 const reviewPath='apps/doctor-suit/tests/financial-acceptance-review.mjs';bound(reviewPath)
 const {financialAcceptanceDisposition}=await import(pathToFileURL(path.join(root,reviewPath)).href),disposition=financialAcceptanceDisposition(packet,{base,head})
 check('correct-task-and-reviewed-parent',packet.parent_pr===499&&packet.parent_head===base&&packet.task_id==='DOS-M6-010')
 check('no-invented-domain-authority',packet.accountable_financial_review===null&&packet.commercial_lifecycle_approval===null&&packet.approved_taxpayer_profile===null&&packet.approved_provider_account===null&&disposition.authority_granted===false)
 check('commercial-launch-stays-unapproved',packet.synthetic_only===true&&disposition.commercial_launch==='unapproved'&&packet.commercial_launch_approved===false&&packet.live_money_used===false&&packet.production_billing_exercised===false&&packet.external_provider_enabled===false&&packet.tax_adapter_enabled===false)
 check('current-unavailable-obligations-not-fabricated',packet.current_candidate_receipts.length===0&&disposition.engineering_cases.every(c=>c.status==='unavailable')&&disposition.accountable_financial_review==='unavailable'&&disposition.full_task_acceptance===false&&packet.full_task_acceptance===false)
 check('actual-journey-and-review-limits-explicit',packet.cases['DOS-M6-010-C01']==='unrun-exact-candidate-full-journey'&&packet.cases['DOS-M6-010-C02']==='unavailable-accountable-independent-financial-review'&&packet.known_limitations.length>=4&&packet.review_requirements.length>=5)
 check('historical-runs-are-only-source-specific',packet.inherited_evidence.length>=2&&packet.inherited_evidence.every(e=>/^[a-f0-9]{40}$/.test(e.source_head)&&e.source_head!==head&&/^https:\/\/github\.com\/Building-Suit\/building-suit-monorepo\/actions\/runs\/\d+$/.test(e.url)&&typeof e.disposition==='string'))
 const tax=JSON.parse(bound(folder+'dos-m6-008-packet.json'))
 check('tax-profile-and-dependent-adapter-remain-held',tax.qualified_applicability_review===null&&tax.decision_approval===null&&tax.adapter.enabled===false&&tax.adapter.submissions_enabled===false&&tax.adapter.compliance_claims_enabled===false)
 for(let n=1;n<=9;n++){const file=`docs/work-packages/doctor-suit/planning-v0.4/DOS-M${n}.json`,b=bound(file);check(`canonical-packet-${n}-unchanged`,hash(b)===hash(source(base,file)))}
 const task=JSON.parse(source(head,'docs/work-packages/doctor-suit/planning-v0.4/DOS-M6.json')).tasks.find(t=>t.task_id==='DOS-M6-010')
 check('canonical-task-retains-accountable-review',task.description.includes('accountable-human-review')&&task.description.includes('independent-exact-candidate-automated-verifier'))
 const changed=git('diff','--name-only',base,head).split('\n').filter(Boolean),allowed=task.allowed_paths
 check('only-task-allowed-paths',changed.length>0&&changed.every(file=>allowed.some(p=>p.endsWith('/')?file.startsWith(p):file===p)))
 const model='apps/doctor-suit/app/utils/practiceFinancialReport.ts';bound(model)
 for(const file of ['practiceMoney.ts','practiceBilling.ts','locationContext.ts','administrativeEdition.ts','entitlement.ts'])bound('apps/doctor-suit/app/utils/'+file)
 const {financialReport}=await import(pathToFileURL(path.join(root,model)).href),id=n=>`d2100010-0000-4000-8000-${String(n).padStart(12,'0')}`,scope={userId:id(1),practiceId:id(21),locationId:null},query={from:null,until:null,status:'all',metric:'charges',currency:null,exponent:null,page:1}
 const raw={actor_user_id:scope.userId,practice_id:scope.practiceId,location_id:null,from:null,until:null,status:'all',metric:'charges',source_currency:null,source_exponent:null,page:1,date_basis:'first_charge_issue_utc_inclusive_start_exclusive_end',balance_basis:'current_latest_charge_with_full_linked_history',observed_at:'2026-10-26T12:00:00Z',totals:[],total:0,items:[],data_mode:'synthetic',external_transport_enabled:false,live_collection:false,tax_invoice_available:false,tax_applicability:'unreviewed',provider_payout:'unavailable',saas_ledger_included:false}
 check('pure-report-contract-baseline',financialReport(raw,scope,query).total===0)
 for(const [label,patch]of Object.entries({external_transport:{external_transport_enabled:true},live_money:{live_collection:true},tax_invoice:{tax_invoice_available:true},tax_exempt:{tax_applicability:'exempt'},provider_payout:{provider_payout:'settled'},saas_netting:{saas_ledger_included:true}})){let denied=false;try{financialReport({...raw,...patch},scope,query)}catch{denied=true}check('pure-report-boundary-rejects:'+label,denied)}
}catch{check('input-or-contract-unavailable',false)}
const passed=assertions.every(a=>a.status==='passed'),code=passed?0:1
console.log(JSON.stringify({schema:'doctor-financial-independent-verifier/v1',execution_id:randomUUID(),task_id:'DOS-M6-010',case_id:'DOS-M6-010-C03',exact_base:base,exact_candidate:head,started_at_utc:started,ended_at_utc:new Date().toISOString(),argv:['node',script,...argv],node:process.versions.node,evaluated_input_sha256:inputs,assertions,exit_code:code,result:passed?'passed-blocked-disposition-and-pure-contract-only':'failed',runtime_journey_acceptance:'unrun-for-exact-candidate',accountable_financial_review:'unavailable',commercial_launch:'unapproved',legal_or_provider_authority_granted:false,full_task_acceptance:false}))
process.exitCode=code
