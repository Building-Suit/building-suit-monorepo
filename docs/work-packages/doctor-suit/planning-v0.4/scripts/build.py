#!/usr/bin/env python3
"""Build review-only task contracts. Does not connect to or write any database."""
import copy
import hashlib
import json
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parents[1]
SOURCE = json.loads((BASE / 'sources/doctor-suit-planning-v0.2.json').read_text())
REVISION = 'doctor-suit-planning-v0.4'
ROOT = 'docs/work-packages/doctor-suit/'
SHARED = ['packages/ui/src/templates/', 'packages/ui/src/organisms/', 'packages/ui/src/utils/', 'packages/ui/package.json', 'packages/ui/tests/', 'packages/ux/src/', 'packages/ux/tests/', 'packages/contracts/src/', 'packages/contracts/package.json', 'packages/contracts/tests/', 'docs/shared/ui-ownership-manifest.json', 'docs/shared/atomic-template-route-inventory.json', 'apps/building-suit-docs/app/pages/components.vue']
RULES = [
 'Synthetic identities and patient records only. No real patient data, credentials, hosted product migrations, provider purchases, deployments, merges or main promotion are authorized.',
 'Doctor owns the practice across locations. Secretary memberships and grants remain independent per doctor and location. Patient identity, doctor relationship and encounter are separate; phone/email equality never merges identities or shares charts.',
 'Use the pinned Nuxt/Vue/pnpm monorepo and root lockfile. Every web route renders one registered complete packages/ui template; shared interactions belong in packages/ux; app adapters own queries and domain logic. Never import other apps or add Suit-local Vue composition/CSS.',
 'Read current root and scoped AGENTS plus git preflight before implementation. Work only in assigned worktree and allowed paths. Preserve history and unrelated edits. Worker leaves verification/publication to control plane; no worker commits or pushes.',
 'No automatic diagnosis, prescribing, dose advice, medication substitution, clinical efficacy claims or guaranteed notifications. Evidence-dependent clinical, legal, provider, commercial and mobile choices remain explicit gates.',
 'No task execution until parent confirms all nine milestones safely stored and the relevant real blocking start decision is explicitly resolved. Saving/importing plans does not authorize execution or release.',
]
EVIDENCE = [
 'Task ID, exact base/head SHA, parent PR and changed paths; immutable test log/artifact references tied to the candidate.',
 'Exact command argv, environment/tool versions, start/end time and exit code; distinguish passed, failed and unrun checks. Missing tests or skipped suites never count as acceptance.',
 'Synthetic fixture identities, positive and negative assertions, permissions and data-integrity results; redact tokens and private payloads.',
 'Independent verifier results, unresolved decision IDs and reviewed scope; implemented, verified, published, merged and deployed are separate states.',
]

def write(path, data):
 path.parent.mkdir(parents=True, exist_ok=True)
 path.write_text(json.dumps(data, ensure_ascii=False, indent=2)+'\n')

def command(name, program, args, capabilities=None):
 return dict(name=name,program=program,args=args,cwd='.',timeout_ms=1800000,capabilities=capabilities or [])

def database_lifecycle():
 def local(name,args):
  result=command(name,'pnpm',['exec','supabase']+args,['database','rls-authorization'])
  result['cwd']='apps/doctor-suit'
  return result
 return {'kind':'supabase-local','local_only':True,'start_when_needed':True,'start_commands':[local('doctor-local-start',['start'])],'reset_commands':[local('doctor-local-reset',['db','reset','--local'])],'test_commands':[local('doctor-local-regression',['test','db','--local'])]}

def commands_for(task):
 result=[]
 for p in task['expected_outputs']:
  tid=task['task_id'].lower()
  if p.endswith('.test.mjs'):
   result.append(command(tid+'-unit','node',['--test',p]))
  if p.endswith('.sql'):
   entry=command(tid+'-data','pnpm',['exec','supabase','test','db',p.removeprefix('apps/doctor-suit/'),'--local'],['database','rls-authorization','storage-policy','signed-url-expiry'])
   entry['cwd']='apps/doctor-suit'
   result.append(entry)
  if p.endswith('.spec.ts'):
   result.append(command(tid+'-browser','pnpm',['exec','playwright','test','-c','apps/doctor-suit/tests/e2e/playwright.config.ts',p,'--workers=1','--retries=0'],['browser','browser-security']))
 return result

def render_description(task, requirements, decisions):
 lines=[task['objective'],'','Requirements']
 lines += [f"- {r['requirement_id']}: {r['summary']}" for r in requirements if r['requirement_id'] in task['linked_requirement_ids']]
 lines += ['', 'Dependencies: '+(', '.join(task['task_dependencies']) or 'none'), 'Blocking decisions: '+', '.join(task['blocking_decision_ids']), '', 'Allowed paths']
 lines += ['- '+p for p in task['allowed_paths']]
 lines += ['', 'Acceptance']+[f'{i+1}. {a}' for i,a in enumerate(task['acceptance_criteria'])]
 lines += ['', 'Verification scenarios']+['- '+s for s in task['verification_scenarios']]
 lines += ['', 'Expected outputs']+['- '+p for p in task['expected_outputs']]
 lines += ['', 'Executable verification obligations',json.dumps(task['verification_plan'],ensure_ascii=False,indent=2),'','Execution boundaries']+['- '+x for x in RULES]
 lines += ['', 'Evidence handback']+['- '+x for x in task['evidence_requirements']]
 return '\n'.join(lines)

def finish(milestone, tasks, requirements, decisions):
 mid=milestone['milestone_id']; all_commands=[]
 for t in tasks:
  t.update(status='planned',engine_stage='pending',model_profile='deep',model_profile_strategy='require_verified_high_capability_deep_route',retry_policy_id=None)
  t['allowed_paths']=sorted(set(t['allowed_paths']))
  t['evidence_requirements']=EVIDENCE + t.get('specific_evidence',[])
  t['source_reading']=['AGENTS.md','README.md','docs/agent-workflows.md','docs/shared/git-workflow.md','packages/ui/AGENTS.md','docs/shared/design-system.md','docs/shared/interactions.md','docs/shared/data-table.md','docs/architecture/identity.md','docs/shared/database.md','docs/shared/future-suit-administration.md','docs/shared/atomic-template-route-inventory.json','docs/shared/ui-ownership-manifest.json','tooling/control-plane/runner/task-prompt.mjs','tooling/control-plane/runner/verification-mode.mjs']
  own_commands=commands_for(t)
  t['verification_cases']=[{'case_id':t['task_id']+f'-V{i+1:02d}','assertion':scenario,'required_outputs':[o for o in t['expected_outputs'] if o.endswith(('.test.mjs','.spec.ts','.sql'))],'command_refs':[c['name'] for c in own_commands],'external_evidence_required':any(v['kind']=='external_gate' for v in t['verification_plan']),'acceptance_rule':'Implement these observable positive/negative assertions against real task behavior; no source-grep-only, empty, skipped or fabricated-pass substitute.'} for i,scenario in enumerate(t['verification_scenarios'])]
  t['acceptance_mapping']=[{'criterion':i+1,'text':a,'verification_case_ids':[v['case_id'] for v in t['verification_cases']],'review_evidence':t['evidence_requirements']} for i,a in enumerate(t['acceptance_criteria'])]
  t['metadata']={**t.get('metadata',{}),'artifact_revision':REVISION,'source_revision':'1d0108f85fb8d468f8ad6380c9c6bf60a435ca4d','milestone_id':mid,'allowed_paths':t['allowed_paths'],'source_allowed_paths':t['allowed_paths'],'clinical_live_data_allowed':False,'verification_mode':'milestone' if t is tasks[-1] else 'focused','scope_approval':'planning-authorized-execution-gated','publication_policy':{'merge_authorized':False,'deployment_authorized':False,'hosted_database_changes_authorized':False,'review_required_before_integration':True}}
  t['description']=render_description(t,requirements,decisions)
  all_commands += commands_for(t)
 packet={'artifact_schema':'review-only-task-contract-v1','artifact_revision':REVISION,'milestone_id':mid,'title':milestone['title'],'category':milestone['category'],'depends_on_milestones':milestone['depends_on'],'expected_task_count':milestone['task_count'],'status':'prepared-not-imported-not-admitted','target':{'repository':'Building-Suit/building-suit-monorepo','automation_project_ref':'padtxclxwwqvvuiebhte','project_slug':'building-suit','project_id':'f71b3b2b-d56b-4f7e-94f5-0b8c379a1088','suit_slug':'doctor-suit','workstream_slug':'doctor-suit','application_path':'apps/doctor-suit','registration_status':'missing-per-parent-readonly-observation; parent must supply reviewed registration'},'requirements':requirements,'decisions':decisions,'tasks':tasks,'verification_config_proposal':{'commands':all_commands,'database':database_lifecycle()},'import_readiness':{'safe_to_apply':False,'all_tasks_blocked':True,'open_start_decision':mid+'-GATE-START','live_schema_contract_pending':True,'publication_authority_granted':False,'model_and_retry_route_pending':True},'execution_boundaries':RULES}
 raw=json.dumps(packet,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()
 packet['content_sha256']=hashlib.sha256(raw).hexdigest()
 write(BASE/(mid+'.json'),packet)
 # This is data for the parent's reviewed importer, not a second task-creation path.
 proposal={'format':'reviewed-import-proposal-v1','milestone_id':mid,'packet_file':mid+'.json','packet_sha256':packet['content_sha256'],'target':packet['target'],'safe_to_apply':False,'task_create_function':'control.create_task_with_publication_contract(text,text,text,integer,integer,text,text,text,text,text,jsonb,jsonb,text,jsonb)','task_ids':[t['task_id'] for t in tasks],'requirements':requirements,'decisions':decisions,'task_requirements':[{'task_id':t['task_id'],'requirement_id':r,'suit_slug':'doctor-suit'} for t in tasks for r in t['linked_requirement_ids']],'task_dependencies':[{'task_id':t['task_id'],'depends_on_task_id':d,'dependency_type':'hard'} for t in tasks for d in t['task_dependencies']],'task_decisions':[{'task_id':t['task_id'],'decision_id':d,'suit_slug':'doctor-suit','blocking':True} for t in tasks for d in t['blocking_decision_ids']]+[{'task_id':t['task_id'],'decision_id':d,'suit_slug':'doctor-suit','blocking':False} for t in tasks for d in t.get('produces_decision_ids',[])],'transaction_contract':['Verify exact Automation target, live function/schema/trigger fingerprints, immutable project ID, route, model, retry policy, command registrations and publication scopes before writes.','Acquire parent-reviewed transaction serialization lock and reread every scoped ID; existing equal payload is a no-op only after full canonical comparison; any differing state/history aborts. Never overwrite existing tasks, decisions, execution or requirement history.','Create or verify the real OPEN milestone start decision before any task; create every task through supported function and link every task to that decision with blocking=true in the SAME transaction.','Create all requirement, decision and dependency links and refresh contracts after final metadata. Do not commit partial task/link batches.','Assert exact payload counts, complete links, zero ready Doctor tasks using live ready-task predicate, zero claims/runs/executions, no publication authority, and all start decisions still OPEN immediately before commit.','Dry-run rollback and review returned evidence first. Parent controls any commit; never remove a guard from the original draft SQL.','After commit read back canonical packets and zero-ready evidence. Keep all nine start gates open until parent confirms all nine safely saved; release each milestone separately in dependency order.'],'pending_inputs':['Parent live schema/consumer and trigger contract','Reviewed Doctor suit/workstream/app mapping (function requires active project/workstream)','Verified high-capability deep model and retry policy IDs','Approved command registration and protected publication paths','Exact no-ready-task SQL predicate and transaction/rollback proof']}
 write(BASE/(mid+'.import-proposal.json'),proposal)
 lines=[f"# {mid} — {milestone['title']}",'',f"{len(tasks)} tasks. Prepared for review; not imported or admitted. Source and import fingerprints are in `{mid}.json` and `{mid}.import-proposal.json`.",'','Milestone prerequisites: '+(', '.join(milestone['depends_on']) or 'none')+'. Every task also has an open blocking start decision.','']
 for t in tasks: lines += [f"## {t['task_id']} — {t['title']}",'',t['description'],'']
 (BASE/(mid+'.md')).write_text('\n'.join(lines))
 print(f'{mid}: {len(tasks)} tasks, {len(requirements)} requirements, {len(decisions)} decisions; sha256 {packet["content_sha256"]}')

def m1():
 tasks=copy.deepcopy(SOURCE['tasks']); req=copy.deepcopy(SOURCE['requirements']); dec=copy.deepcopy(SOURCE['decisions'])
 for r in req:
  if r['requirement_id']=='DOS-M1-R003': r['summary']='M1 is the public product website plus administrative doctor/secretary browser portal, synthetic data only; clinical prescribing starts M2 and mobile remains later.'
  if r['requirement_id']=='DOS-M1-R005': r['summary']='Use Building-Suit/building-suit-monorepo, pinned stack, shared packages/ui templates and packages/ux interactions; Doctor app adapters own logic/data. Independent runtime verification and publication remain control-plane owned.'
 dec[0]['decision_text']='OPEN: Parent must confirm all nine milestones safely stored, exact live schema/consumer compatibility, route registration, high-capability model/retry policies, executable verification mapping and publication scope. Saving plans never releases this gate.'
 dec[1].update(status='approved',decision_text=req[2]['summary'],source='Current delegated user authorization; supersedes v0.2 uncertainty, retains original ID.')
 dec[2]['decision_text']='Repository placement and shared architecture are authorized. Runtime app/workstream registration, exact model/retry/verification contracts and protected publication paths still require parent live-schema review; this decision stays OPEN until those concrete prerequisites are verified.'
 dec[2]['source']='Current delegation confirms repository; parent reports missing Doctor app mapping.'
 dec[3].update(status='approved',decision_text='For synthetic M1 use opaque patient IDs and practice-patient relationships, display name plus optional recorded contact and demographics, explicit duplicate-review warnings, optimistic correction and archive. No identity verification or cross-practice merge is inferred. Real-data dataset/retention requires M7 review.',source='Ordinary design choice within current authorization; legal/clinical decisions remain gated.')
 dec[4]['decision_text']='Use existing Building tokens and text Doctor Suit branding for the synthetic preview; do not invent logo provenance, domain, pricing/trial, support recipient or release claims. Real public destinations/claims require supplied evidence. This gate applies to public acceptance, not ordinary internal layout choices.'
 for t in tasks:
  if 'docs/shared/ui-ownership-manifest.json' in t['allowed_paths']: t['allowed_paths'] += ['docs/shared/atomic-template-route-inventory.json']
  if any(p.startswith('packages/ui') for p in t['allowed_paths']): t['allowed_paths'] += ['apps/building-suit-docs/app/pages/components.vue']
  # Release registration/history is not a product implementation permission.
  t['allowed_paths']=[p for p in t['allowed_paths'] if p!='release-changes/items.json']
  if t['task_id']=='DOS-M1-002':
   t['expected_outputs'] += ['apps/doctor-suit/package.json','apps/doctor-suit/tests/e2e/playwright.config.ts']
  if t['task_id']=='DOS-M1-003':
   t['allowed_paths'] += ['docs/architecture/environments.json']
   t['acceptance_criteria'] += ['Record local-only collision-free project/port mapping and blank unprovisioned hosted entries; no credentials. Create the local data verification lifecycle and generated types; reject hosted targets in the browser fixture harness.']
  plan=[]
  for v in t['verification_plan']:
   if v['kind']=='planned_test':
    outputs=v['expected_outputs']; suffix='data' if any(p.endswith('.sql') for p in outputs) else 'browser' if any(p.endswith('.spec.ts') for p in outputs) else 'unit'
    v['commands']=[t['task_id'].lower()+'-'+suffix]
   plan.append(v)
  # A full regression remains required alongside the named task test.
  if any(p.endswith('.test.mjs') for p in t['expected_outputs']): plan.append({'version':2,'kind':'command','description':'Run full repository unit regression including affected shared consumers','command':'pnpm test'})
  if t['task_id'] in ['DOS-M1-018','DOS-M1-020']:
   plan.append({'version':2,'kind':'external_gate','description':'Independent exact-candidate shared-consumer browser evidence for all changed shared templates/controllers','blocker':'shared_consumer_browser_receipts_required','phase':'pre_publication'})
  t['verification_plan']=plan
  t['specific_evidence']=['M1 acceptance is synthetic administrative web only; prescribing, payment, patient/mobile apps and production claims remain unavailable.']
 finish(SOURCE['milestones'][0],tasks,req,dec)

if __name__=='__main__':
 selected=int(sys.argv[1]) if len(sys.argv)>1 else 1
 if selected==1: m1()
 else:
  from later import build_later
  build_later(selected, SOURCE, finish, ROOT, SHARED)
