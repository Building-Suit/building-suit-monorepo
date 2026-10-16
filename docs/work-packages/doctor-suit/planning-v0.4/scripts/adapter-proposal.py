#!/usr/bin/env python3
"""Assemble a local review-only adapter/registration proposal; no network/SQL."""
from pathlib import Path
import hashlib
import json

BASE=Path(__file__).resolve().parents[1]
packets=[json.loads((BASE/f'DOS-M{i}.json').read_text()) for i in range(1,10)]
commands={}
for packet in packets:
 for command in packet['verification_config_proposal']['commands']:
  name=command['name']
  if name in commands:assert commands[name]==command
  commands[name]=command
data={
 'schema':'doctor-reviewed-registration-adapter-proposal-v1',
 'status':'review-only; no runtime registration or hosted action performed',
 'safe_to_apply':False,
 'live_schema_refresh':{'status':'explicitly-cancelled-not-retried','renewed_permission_required':True},
 'target':{'automation_project_ref':'padtxclxwwqvvuiebhte','project_id':'f71b3b2b-d56b-4f7e-94f5-0b8c379a1088','project_slug':'building-suit','repository':'Building-Suit/building-suit-monorepo'},
 'required_live_bindings':{'schema_function_trigger_consumer_fingerprints':None,'approved_workstream_slug':None,'verified_high_capability_model_profile':None,'verified_retry_policy_id':None,'project_allowed_publication_paths_before_sha256':None,'exact_zero_ready_predicate':None,'reviewed_registration_mutation_interface':None},
 'registration_proposal':{
  'suit':{'table_from_inspected_repository':'control.suits','identity':{'slug':'doctor-suit','display_name':'Doctor Suit','stack_key':'doctor-suit','app_path':'apps/doctor-suit'},'status_proposal':'planning; do not activate the suit during plan storage'},
  'workstream':{'table_from_inspected_repository':'control.workstreams','identity':{'project_id':'f71b3b2b-d56b-4f7e-94f5-0b8c379a1088','slug':'doctor-suit','display_name':'Doctor Suit','stack_key':'doctor-suit','application_path':'apps/doctor-suit','suit_slug':'doctor-suit'},'model_profile':None,'retry_policy_id':None,'active':None,'active_constraint':'The inspected task-create function requires active project/workstream. Parent must explicitly review this registration condition; never disable a shared project or bypass the creation function. All nine real open start gates and zero-ready assertions remain mandatory.','concurrency_policy_proposal':{'serialized':True},'verification_config_proposal':{'commands':list(commands.values()),'database':packets[0]['verification_config_proposal']['database']},'publication_config_proposal':{'merge_authorized':False,'deployment_authorized':False,'hosted_database_changes_authorized':False,'review_required_before_integration':True}},
  'project_app_mapping':{'table_from_inspected_repository':'control.projects','column':'application_paths','proposed_single_key_delta':{'doctor-suit':'apps/doctor-suit'},'rule':'Only after actual live shape/key semantics are verified and parent reviews this narrow delta. Preserve every other project field/key; do not call a broad project-register upsert.'},
  'forbidden_mutations':['control.projects.allowed_publication_paths','shared project model/retry defaults','shared project verification configuration','existing suits/workstreams','credentials/provider configuration','operational release catalogue/baselines'],
  'scope_check':'Compare every proposed task path to already-authorized live project scope. Any missing scope is a reported admission blocker, never an automatic scope-widening operation.',
 },
 'task_argument_adapter':{'source':'DOS-Mn.json tasks[]','destination_function':'control.create_task_with_publication_contract','per_milestone_calls':'DOS-Mn.import-proposal.json create_task_calls[]','runtime_binding_rule':'Required runtime argument values are null until actual reviewed bindings are supplied. The canonical deep requirement expresses the requested capability only; it does not establish a provider/model registration.','metadata_rule':'p_metadata contains every original metadata key plus complete canonical_task_contract, canonical_task_sha256, canonical_task_schema and source_packet_sha256. Preserve this object without dropping objective, evidence, coverage, dependencies or release ownership. No recursive embedding: the embedded object is the canonical task before adapter metadata is added.','readback_rule':'Deep-compare stored metadata canonical_task_contract with canonical source, verify digest, then compare actual top-level arguments and all links against the bound proposal.'},
 'atomic_import_protocol':[
  'Wait for renewed permission for the cancelled live schema refresh; no retry has occurred.',
  'Review fresh immutable target/schema/consumer/trigger identities, registry absence or exact existing contents, supported mutation interfaces, model/retry routes and unchanged project publication scopes.',
  'Create/verify all nine real OPEN start-decision records within reviewed suit registration, before any task can be committed. Keep them open through every milestone import.',
  'For each milestone M1 through M9, begin one transaction with reviewed serialization, compare scoped existing IDs/history, verify all nine gates remain open and insert missing requirements/decisions without overwriting existing content.',
  'Create the complete milestone task batch through the supported function and attach every task to its own OPEN start decision with blocking=true before any commit. Add all requirement/dependency/decision links; evidence producers and informational decisions are blocking=false.',
  'Preserve complete canonical task metadata; bind runtime values only from reviewed evidence. Refresh final publication contracts after all links and metadata exist.',
  'Before commit assert exact task/link/metadata counts and hashes, all nine start gates OPEN, exact shared project publication-scope equality, zero ready Doctor tasks using the reviewed live predicate, and no claims/executions/publication authority. Any failed assertion aborts the whole milestone transaction.',
  'First obtain a rollback-only validation receipt. Parent reviews a separate commit action; never edit a guard out of the original supplied SQL.',
  'Read back complete canonical task objects, link sets, open gates and zero-ready evidence after commit. An uncertain outcome requires readback, never a blind retry.',
  'Only after all nine readbacks pass may the parent confirm safe storage and release relevant M1–M3 gates in dependency order. Genuine clinical/provider/legal decisions still apply; no real-patient or live clinical activation is authorized.',
 ],
 'milestones':[{'milestone_id':p['milestone_id'],'tasks':len(p['tasks']),'packet_sha256':p['content_sha256'],'start_decision':p['milestone_id']+'-GATE-START','start_status':'open','proposal_file':p['milestone_id']+'.import-proposal.json'} for p in packets],
}
data['proposal_sha256']=hashlib.sha256(json.dumps(data,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()).hexdigest()
(BASE/'registration-adapter.proposal.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
print('Review-only registration/adapter proposal assembled; all live bindings remain unresolved.')
