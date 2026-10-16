#!/usr/bin/env python3
"""Build review-only task contracts. Does not connect to or write any database."""
import copy
import hashlib
import json
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parents[1]
SOURCE = json.loads((BASE / 'sources/doctor-suit-planning-v0.2.json').read_text())
REVISION = 'doctor-suit-planning-v0.4-review-3'
ROOT = 'docs/work-packages/doctor-suit/'
SHARED = ['packages/ui/src/templates/', 'packages/ui/src/organisms/', 'packages/ui/src/utils/', 'packages/ui/package.json', 'packages/ui/tests/', 'packages/ux/src/', 'packages/ux/tests/', 'packages/contracts/src/', 'packages/contracts/package.json', 'packages/contracts/tests/', 'docs/shared/ui-ownership-manifest.json', 'docs/shared/atomic-template-route-inventory.json', 'apps/building-suit-docs/app/pages/components.vue']
RULES = [
 'Synthetic identities and patient records only. No real patient data, credentials, hosted product migrations, provider purchases, deployments, merges or main promotion are authorized.',
 'Doctor owns the practice across locations. Secretary memberships and grants remain independent per doctor and location. Patient identity, doctor relationship and encounter are separate; phone/email equality never merges identities or shares charts.',
 'Use the pinned Nuxt/Vue/pnpm monorepo and root lockfile. Every web route renders one registered complete packages/ui template; shared interactions belong in packages/ux; app adapters own queries and domain logic. Never import other apps or add Suit-local Vue composition/CSS.',
 'Read current root and scoped AGENTS plus git preflight before implementation. Work only in assigned worktree and allowed paths. Preserve history and unrelated edits. Worker leaves verification/publication to control plane; no worker commits or pushes.',
 'No automatic diagnosis, prescribing, dose advice, medication substitution, clinical efficacy claims or guaranteed notifications. Evidence-dependent clinical, legal, provider, commercial and mobile choices remain explicit gates.',
 'No task execution until parent confirms all nine milestones safely stored and the relevant real blocking start decision is explicitly resolved. Saving/importing plans does not authorize execution or release.',
 'The user has authorized eventual implementation of M1, M2 and M3 after all nine plans are safely saved. This is not authorization to bypass genuine clinical/provider gates, retry the cancelled live-schema refresh, use real patients or activate live clinical care.',
 'M1–M3 completion means checked implementation in GitHub with exact-candidate verification evidence. The user handles Vercel and hosted Supabase connections; those connections or deployments are not completion requirements for the authorized synthetic implementation. Genuine domain approvals still gate dependent capabilities.',
 'Routine authority/document/scope/disabled-operation/status checks use independent automated exact-candidate verification, with no additional human acknowledgement. Existing approvals may be checked but not invented or replaced by automation.',
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
 lines += ['', 'Criterion-specific coverage',json.dumps(task['verification_cases'],ensure_ascii=False,indent=2),'','Release ownership',json.dumps(task['release_contract'],ensure_ascii=False,indent=2)]
 lines += ['', 'Evidence handback']+['- '+x for x in task['evidence_requirements']]
 return '\n'.join(lines)

def finish(milestone, tasks, requirements, decisions):
 from coverage import build_coverage
 mid=milestone['milestone_id']; all_commands=[command('doctor-release-check','pnpm',['release:check'])]
 for t in tasks:
  t.update(status='planned',engine_stage='pending',model_profile='deep',model_profile_strategy='require_verified_high_capability_deep_route',retry_policy_id=None)
  # Every task owns its own append-only provenance; public inventory edits are row-scoped.
  fragment='release-fragments/'+t['task_id'].lower()+'.json'
  t['allowed_paths']=[p for p in t['allowed_paths'] if p not in ['release-fragments/','release-changes/items.json']]+[fragment]
  t['expected_outputs'].append(fragment)
  public_or_shared=any(p.startswith('packages/ui/') for p in t['allowed_paths'])
  if public_or_shared:t['allowed_paths'].append('release-changes/items.json')
  t['release_contract']={'fragment_path':fragment,'accepted_fragments':'append-only; never rewrite accepted provenance','inventory_path':'release-changes/items.json' if public_or_shared else None,'inventory_write_scope':'Only append or refine entries documenting this task\'s surviving public behavior, with this task fragment in sources and distinctive current-code probes. Existing related items may gain this source/probe only; preserve unrelated IDs, copy, probes, sources and all accepted history. Resolve affected consumers through the actual dependency graph.','registration_rule':'Only already-verified active operational Suits with explicit baselines may receive public inventory. Do not activate Doctor or invent a baseline. Keep Doctor-only synthetic preview provenance internal until separate release registration; do not hide visible changes to existing consumers as internal.','receipt_rule':'Run pnpm release:check against the exact candidate HEAD and verified task/base/main refs after the control plane creates the candidate. A run on the pre-change HEAD is not acceptance. Preserve gate/evidence separately from product test results.'}
  t['verification_plan'].append({'version':2,'kind':'external_gate','description':'Exact-candidate release provenance, net-change inventory and affected-consumer classification evidence','commands':['doctor-release-check'],'phase':'pre_publication','blocker':'release_check_receipt_must_match_candidate_head_and_reviewed_classification'})
  t['allowed_paths']=sorted(set(t['allowed_paths']))
  t['evidence_requirements']=EVIDENCE + t.get('specific_evidence',[])
  t['source_reading']=['AGENTS.md','README.md','docs/agent-workflows.md','docs/shared/git-workflow.md','packages/ui/AGENTS.md','docs/shared/design-system.md','docs/shared/interactions.md','docs/shared/data-table.md','docs/architecture/identity.md','docs/shared/database.md','docs/shared/future-suit-administration.md','docs/shared/atomic-template-route-inventory.json','docs/shared/ui-ownership-manifest.json','tooling/control-plane/runner/task-prompt.mjs','tooling/control-plane/runner/verification-mode.mjs']
  t['verification_cases'],t['acceptance_mapping']=build_coverage(t)
  t['metadata']={**t.get('metadata',{}),'artifact_revision':REVISION,'source_revision':'1d0108f85fb8d468f8ad6380c9c6bf60a435ca4d','milestone_id':mid,'allowed_paths':t['allowed_paths'],'source_allowed_paths':t['allowed_paths'],'clinical_live_data_allowed':False,'verification_mode':'milestone' if t is tasks[-1] else 'focused','scope_approval':'planning-authorized-execution-gated','publication_policy':{'merge_authorized':False,'deployment_authorized':False,'hosted_database_changes_authorized':False,'review_required_before_integration':True}}
  t['description']=render_description(t,requirements,decisions)
  all_commands += commands_for(t)
 packet={'artifact_schema':'review-only-task-contract-v1','artifact_revision':REVISION,'milestone_id':mid,'title':milestone['title'],'category':milestone['category'],'depends_on_milestones':milestone['depends_on'],'expected_task_count':milestone['task_count'],'status':'prepared-not-imported-not-admitted','target':{'repository':'Building-Suit/building-suit-monorepo','automation_project_ref':'padtxclxwwqvvuiebhte','project_slug':'building-suit','project_id':'f71b3b2b-d56b-4f7e-94f5-0b8c379a1088','suit_slug':'doctor-suit','workstream_slug':'doctor-suit','application_path':'apps/doctor-suit','registration_status':'missing-per-parent-readonly-observation; parent must supply reviewed registration'},'requirements':requirements,'decisions':decisions,'tasks':tasks,'verification_config_proposal':{'commands':all_commands,'database':database_lifecycle()},'import_readiness':{'safe_to_apply':False,'all_tasks_blocked':True,'open_start_decision':mid+'-GATE-START','live_schema_contract_pending':True,'publication_authority_granted':False,'model_and_retry_route_pending':True},'execution_boundaries':RULES}
 raw=json.dumps(packet,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()
 packet['content_sha256']=hashlib.sha256(raw).hexdigest()
 write(BASE/(mid+'.json'),packet)
 # This is data for the parent's reviewed importer, not a second task-creation path.
 proposal={'format':'reviewed-import-proposal-v1','milestone_id':mid,'packet_file':mid+'.json','packet_sha256':packet['content_sha256'],'target':packet['target'],'safe_to_apply':False,'task_create_function':'control.create_task_with_publication_contract(text,text,text,integer,integer,text,text,text,text,text,jsonb,jsonb,text,jsonb)','task_ids':[t['task_id'] for t in tasks],'requirements':requirements,'decisions':decisions,'task_requirements':[{'task_id':t['task_id'],'requirement_id':r,'suit_slug':'doctor-suit'} for t in tasks for r in t['linked_requirement_ids']],'task_dependencies':[{'task_id':t['task_id'],'depends_on_task_id':d,'dependency_type':'hard'} for t in tasks for d in t['task_dependencies']],'task_decisions':[{'task_id':t['task_id'],'decision_id':d,'suit_slug':'doctor-suit','blocking':True} for t in tasks for d in t['blocking_decision_ids']]+[{'task_id':t['task_id'],'decision_id':d,'suit_slug':'doctor-suit','blocking':False} for t in tasks for d in t.get('produces_decision_ids',[])+t.get('informational_decision_ids',[])],'transaction_contract':['Verify exact Automation target, live function/schema/trigger fingerprints, immutable project ID, route, model, retry policy, command registrations and publication scopes before writes.','Acquire parent-reviewed transaction serialization lock and reread every scoped ID; existing equal payload is a no-op only after full canonical comparison; any differing state/history aborts. Never overwrite existing tasks, decisions, execution or requirement history.','Create or verify the real OPEN milestone start decision before any task; create every task through supported function and link every task to that decision with blocking=true in the SAME transaction.','Create all requirement, decision and dependency links and refresh contracts after final metadata. Do not commit partial task/link batches.','Assert exact payload counts, complete links, zero ready Doctor tasks using live ready-task predicate, zero claims/runs/executions, no publication authority, and all start decisions still OPEN immediately before commit.','Dry-run rollback and review returned evidence first. Parent controls any commit; never remove a guard from the original draft SQL.','After commit read back canonical packets and zero-ready evidence. Keep all nine start gates open until parent confirms all nine safely saved; release each milestone separately in dependency order.'],'pending_inputs':['Parent live schema/consumer and trigger contract','Reviewed Doctor suit/workstream/app mapping (function requires active project/workstream)','Verified high-capability deep model and retry policy IDs','Approved command registration and protected publication paths','Exact no-ready-task SQL predicate and transaction/rollback proof']}
 proposal['live_read_hold']={'action':'refresh live schema/function/trigger fingerprints','status':'explicitly-cancelled-not-retried','required_next_authorization':'renewed permission from parent/user before any live refresh or import','no_hosted_actions_performed':True}
 proposal['create_task_calls']=[]
 for t in tasks:
  canonical=copy.deepcopy(t)
  fingerprint=hashlib.sha256(json.dumps(canonical,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()).hexdigest()
  metadata={**copy.deepcopy(t['metadata']),'canonical_task_contract':canonical,'canonical_task_sha256':fingerprint,'canonical_task_schema':'review-only-task-contract-v1','source_packet_sha256':packet['content_sha256']}
  proposal['create_task_calls'].append({'function':'control.create_task_with_publication_contract','review_only':True,'bindings_required':['p_workstream_slug','p_model_profile','p_retry_policy_id'],'arguments':{'p_project_slug':'building-suit','p_workstream_slug':None,'p_task_id':t['task_id'],'p_sequence':t['sequence'],'p_priority':t['priority'],'p_title':t['title'],'p_description':t['description'],'p_task_type':t['task_type'],'p_risk_level':t['risk_level'],'p_model_profile':None,'p_acceptance_criteria':t['acceptance_criteria'],'p_verification_plan':t['verification_plan'],'p_retry_policy_id':None,'p_metadata':metadata},'binding_rule':'Fill required runtime values only from renewed, reviewed live evidence. Do not create a model/retry policy, fall back to a cheaper route or widen project scopes. Preserve the canonical object byte-for-byte under metadata; record resolved runtime values separately.'})
 proposal['readback_assertions']=['All nine milestone start decisions remain open, including milestones not selected for implementation.','For every task, canonical_task_contract in stored metadata is deeply equal to the reviewed canonical task and canonical_task_sha256 matches.','Round-trip all supported top-level function arguments plus requirement/dependency/decision links; retain produced/informational decisions as blocking=false.','Compare shared project allowed_publication_paths to its locked pre-import value and require exact equality; no scope widening is part of registration.','Use the reviewed live ready-task predicate and require zero ready Doctor tasks before commit and after readback; no partial task batch may commit.']
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
 dec[4].update(title='Authorized synthetic-preview branding and copy',status='approved',decision_text='Use existing Building design tokens and text Doctor Suit branding for the synthetic browser preview. Explain doctor ownership, administrative workflows and clearly labeled planned features. Use real internal preview routes; hide unavailable external support, prices/trials, store downloads and production signup. No actual public domain or clinical/commercial/compliance claim is needed for M1 synthetic acceptance.',source='Current user authorization of ordinary design choices and explicit parent review correction. The original decision ID is retained; its live-public portion is separated into DOS-M1-D005.')
 dec.append({'decision_id':'DOS-M1-D005','title':'Live public domain, external destinations and factual claims approval','status':'open','decision_text':'Before any live public-domain configuration, external support/contact destination, commercial offer, clinical/compliance/provider claim or product launch assertion: obtain actual evidence and accountable approval for the exact destination/claim. This release-stage gate does not block synthetic M1 implementation or preview acceptance. No task or importer may silently approve it.','source':'Split from original DOS-M1-D004 by parent review; original source bytes/history preserved.','enforcement_phase':'live-public-release','supersedes_portion_of':'DOS-M1-D004'})
 for t in tasks:
  if 'docs/shared/ui-ownership-manifest.json' in t['allowed_paths']: t['allowed_paths'] += ['docs/shared/atomic-template-route-inventory.json']
  if any(p.startswith('packages/ui') for p in t['allowed_paths']): t['allowed_paths'] += ['apps/building-suit-docs/app/pages/components.vue']
  # Release registration/history is not a product implementation permission.
  t['allowed_paths']=[p for p in t['allowed_paths'] if p!='release-changes/items.json']
  if t['task_id']=='DOS-M1-001':
   t['acceptance_criteria'][0]='Document the confirmed synthetic public-site and administrative doctor/secretary portal scope, authorized ordinary design choices and unresolved live/domain decisions separately.'
  if t['task_id']=='DOS-M1-002':
   t['expected_outputs'] += ['apps/doctor-suit/package.json','apps/doctor-suit/tests/e2e/playwright.config.ts']
  if t['task_id']=='DOS-M1-003':
   t['allowed_paths'] += ['docs/architecture/environments.json']
   t['acceptance_criteria'] += ['Record local-only collision-free project/port mapping and blank unprovisioned hosted entries; no credentials. Create the local data verification lifecycle and generated types; reject hosted targets in the browser fixture harness.']
  if t['task_id']=='DOS-M1-004':
   output='apps/doctor-suit/tests/e2e/dos-m1-004.spec.ts'
   t['expected_outputs'].append(output)
   t['verification_plan'].append({'version':2,'kind':'planned_test','description':'Exercise real browser shell keyboard/focus, dirty-state, context-switch and EN/AR responsive behavior','expected_outputs':[output],'commands':['dos-m1-004-browser'],'requires':['browser']})
   t['acceptance_criteria'][3]='Verify English/Arabic, LTR/RTL and light/dark shell behavior at 390px and 1280px viewports through the existing repository infrastructure; all navigation and dialog actions remain reachable with correct direction and visible focus.'
   t['verification_scenarios'] += ['Playwright drives Tab/Shift+Tab and Escape through shell navigation and dialogs, asserts focus trap/return, rejects accidental dirty-state dismissal and verifies explicit discard.', 'Render EN/AR × light/dark × 390px/1280px; assert navigation reachability, direction, active doctor/location visibility and no horizontal overflow.', 'Delay the previous-context request, switch practices and verify the late response and old draft never appear in the newly selected context.']
  if t['task_id'] in ['DOS-M1-005','DOS-M1-019','DOS-M1-020']:
   t['informational_decision_ids']=['DOS-M1-D005']
  if t['task_id']=='DOS-M1-019':
   t['acceptance_criteria'][0]='Verify titles, descriptions and locale metadata on the synthetic preview origin; omit a production canonical URL until an approved real domain is configured. Real-domain acceptance remains DOS-M1-D005 and is not required to finish this synthetic task.'
   t['acceptance_criteria'][2]='Use Building tokens and text Doctor Suit branding plus approved preview copy; hide external support/contact destinations until actual details are supplied. No fabricated store links, pricing, compliance or production claims.'
  plan=[]
  for v in t['verification_plan']:
   if t['task_id']=='DOS-M1-001' and v['kind']=='planned_test':
    v['description']='Create and execute the traceable website contract regression; routine scope/document checks use independent automation, while genuine live-public approval remains separate.'
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
  for r in req:
   if r['requirement_id']=='DOS-M1-F'+t['task_id'][-3:]:r['summary']=t['objective']+' Acceptance: '+' '.join(t['acceptance_criteria'])
 finish(SOURCE['milestones'][0],tasks,req,dec)

if __name__=='__main__':
 selected=int(sys.argv[1]) if len(sys.argv)>1 else 1
 if selected==1: m1()
 else:
  from later import build_later
  build_later(selected, SOURCE, finish, ROOT, SHARED)
