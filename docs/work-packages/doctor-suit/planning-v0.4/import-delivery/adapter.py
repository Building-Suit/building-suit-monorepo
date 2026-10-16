#!/usr/bin/env python3
"""Verify/reconstruct approved bytes and render rollback-only SQL. Never connects."""
import argparse
import hashlib
import json
import re
from pathlib import Path

BASE=Path(__file__).resolve().parent
SOURCE_HEAD='7a6dcc2084000b4054010d94a04a85a408282497'
PROJECT='f71b3b2b-d56b-4f7e-94f5-0b8c379a1088'
TARGET='padtxclxwwqvvuiebhte'
def encoded(v):return (json.dumps(v,ensure_ascii=False,indent=2)+'\n').encode()
def canonical_sha(v):return hashlib.sha256(json.dumps(v,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()).hexdigest()
def read_part(record):
 p=BASE/record['artifact_id'];assert p.resolve().is_relative_to(BASE.resolve())
 raw=p.read_bytes();assert len(raw)==record['bytes'] and hashlib.sha256(raw).hexdigest()==record['sha256'],f'Corrupt chunk {p.name}'
 assert hashlib.sha1(f'blob {len(raw)}\0'.encode()+raw).hexdigest()==record['git_blob_sha1']
 return json.loads(raw)
def load():
 manifest=json.loads((BASE/'manifest.json').read_text());assert manifest['source_head']==SOURCE_HEAD
 proposals=[]
 for entry in manifest['files']:
  header=read_part(entry['header']);calls=[read_part(c) for c in entry['create_task_calls']]
  values={**header,'create_task_calls':calls};proposal={k:values[k] for k in entry['top_level_key_order']};raw=encoded(proposal)
  assert len(raw)==entry['source_bytes'] and hashlib.sha256(raw).hexdigest()==entry['source_sha256'],'Proposal reconstruction differs from approved bytes'
  assert proposal['packet_sha256']==entry['packet_content_sha256'] and proposal['milestone_id']==entry['milestone_id']
  assert [c['arguments']['p_task_id'] for c in calls]==proposal['task_ids']
  for c in calls:
   assert c['function']=='control.create_task_with_publication_contract' and c['review_only']
   a=c['arguments'];m=a['p_metadata'];t=m['canonical_task_contract'];assert canonical_sha(t)==m['canonical_task_sha256']
   assert m['source_packet_sha256']==proposal['packet_sha256'] and a['p_task_id']==t['task_id']
   assert a['p_workstream_slug'] is None and a['p_model_profile'] is None and a['p_retry_policy_id'] is None
   assert any(d['task_id']==t['task_id'] and d['decision_id']==proposal['milestone_id']+'-GATE-START' and d['blocking'] for d in proposal['task_decisions'])
  proposals.append(proposal)
 assert len(proposals)==9 and sum(len(p['task_ids']) for p in proposals)==104
 assert sum(len(p['task_dependencies']) for p in proposals)==244
 return manifest,proposals

def validate_bindings(b,step):
 assert b['source_head']==SOURCE_HEAD and b['automation_project_ref']==TARGET
 assert b['workstream_slug']=='doctor-suit' and b['model_profile']=='deep'
 assert re.fullmatch(r'[a-z][a-z0-9-]*',b['retry_policy_id'])
 for k in ['review_receipt','live_read_receipt','model_route_receipt','consumer_review_receipt']:
  assert isinstance(b[k],str) and len(b[k].strip())>=8,f'Missing reviewed evidence: {k}'
 for k in ['create_function_md5','refresh_function_md5','ready_view_md5','catalog_md5']:
  assert re.fullmatch('[0-9a-f]{32}',b[k]),f'Missing observed fingerprint: {k}'
 p=b['project_snapshot'];assert p['project_id']==PROJECT and p['slug']=='building-suit' and p['github_repository']=='Building-Suit/building-suit-monorepo' and p['active'] is True
 assert 'created_at' not in p and 'updated_at' not in p
 assert isinstance(p['application_paths'],dict) and isinstance(p['allowed_publication_paths'],list)
 if step=='registration':assert 'doctor-suit' not in p['application_paths']
 else:assert p['application_paths'].get('doctor-suit')=='apps/doctor-suit'
 return b

def quote_json(v):return "'"+json.dumps(v,ensure_ascii=False,separators=(',',':')).replace("'","''")+"'::jsonb"
def render(step,bindings,readback=False):
 _,proposals=load();validate_bindings(bindings,step)
 commands={}
 for p in proposals:
  # The exact proposed command and database configs live in canonical packets.
  packet=json.loads((BASE.parent/p['packet_file']).read_text())
  raw=packet.copy();claimed=raw.pop('content_sha256');assert canonical_sha(raw)==claimed==p['packet_sha256']
  for c in packet['verification_config_proposal']['commands']:
   assert c['name'] not in commands or commands[c['name']]==c
   commands[c['name']]=c
 database=json.loads((BASE.parent/'DOS-M1.json').read_text())['verification_config_proposal']['database']
 payload={'source_head':SOURCE_HEAD,'milestone_id':step,'all_start_decisions':[next(d for d in p['decisions'] if d['decision_id']==p['milestone_id']+'-GATE-START') for p in proposals],
 'verification_config':{'commands':list(commands.values()),'database':database},
 'publication_config':{'merge_authorized':False,'deployment_authorized':False,'hosted_database_changes_authorized':False,'review_required_before_integration':True}}
 payload['expected_counts']={'tasks':0,'requirements':0,'decisions':9}
 if step!='registration':
  n=int(step.removeprefix('DOS-M'));assert 1<=n<=9
  payload['proposal']=proposals[n-1]
  payload['expected_counts']={'tasks':sum(len(p['task_ids']) for p in proposals[:n]),'requirements':sum(len(p['requirements']) for p in proposals[:n]),'decisions':9+sum(len(p['decisions'])-1 for p in proposals[:n])}
  payload['previous_tasks']=[{'task_id':c['arguments']['p_task_id'],'canonical_task_sha256':c['arguments']['p_metadata']['canonical_task_sha256']} for p in proposals[:n-1] for c in p['create_task_calls']]
 if readback:
  return re.sub(r'__INPUT__|__BINDINGS__',lambda m:quote_json(payload if m[0]=='__INPUT__' else bindings),(BASE/'adapter-readback.sql').read_text())
 common=(BASE/'adapter-common.sql').read_text()
 catalog=(BASE/'catalog-fingerprint.sql').read_text().strip().removesuffix(';')
 # Replace template markers before inserting JSON; user-controlled text is never evaluated as template/code.
 common=common.replace('__CATALOG__',catalog)
 common=re.sub(r'__INPUT__|__BINDINGS__',lambda m:quote_json(payload if m[0]=='__INPUT__' else bindings),common)
 final=(BASE/'adapter-final.sql').read_text()
 guard=final[:final.index('SELECT pg_temp.doctor_assert_stopped();')]+ 'SELECT pg_temp.doctor_assert_stopped();\n'
 sql=common+(guard if step!='registration' else '')+(BASE/('adapter-register.sql' if step=='registration' else 'adapter-milestone.sql')).read_text()+final
 assert sql.rstrip().endswith('ROLLBACK;')
 return sql

def evidence_sql():
 catalog=(BASE/'catalog-fingerprint.sql').read_text().strip().removesuffix(';')
 return "SELECT jsonb_build_object('project_snapshot',(SELECT to_jsonb(p)-'created_at'-'updated_at' FROM control.projects p WHERE project_id='"+PROJECT+"'),'create_function_md5',md5(pg_get_functiondef('control.create_task_with_publication_contract(text,text,text,integer,integer,text,text,text,text,text,jsonb,jsonb,text,jsonb)'::regprocedure)),'refresh_function_md5',md5(pg_get_functiondef('control.refresh_publication_readiness_contract(text,text)'::regprocedure)),'ready_view_md5',md5(pg_get_viewdef('control.ready_tasks'::regclass,true)),'catalog_md5',("+catalog+"));\n"

def main():
 p=argparse.ArgumentParser(description=__doc__);sub=p.add_subparsers(dest='action',required=True)
 sub.add_parser('verify');sub.add_parser('evidence-query')
 r=sub.add_parser('reconstruct');r.add_argument('--output',type=Path,required=True)
 r=sub.add_parser('render');r.add_argument('--step',choices=['registration']+[f'DOS-M{i}' for i in range(1,10)],required=True);r.add_argument('--bindings',type=Path,required=True);r.add_argument('--output',type=Path,required=True);r.add_argument('--readback',action='store_true',help='Render a SELECT-only post-commit receipt instead of a rollback transaction')
 args=p.parse_args()
 if args.action=='evidence-query':print(evidence_sql(),end='');return
 manifest,proposals=load()
 if args.action=='verify':print(json.dumps({'source_head':SOURCE_HEAD,'milestones':9,'tasks':104,'dependencies':244,'result':'all chunks, reconstructed proposal bytes and canonical metadata hashes verified'}));return
 if args.action=='reconstruct':
  args.output.mkdir(parents=True,exist_ok=True)
  for p in proposals:(args.output/(p['milestone_id']+'.import-proposal.json')).write_bytes(encoded(p))
 else:
  sql=render(args.step,json.loads(args.bindings.read_text()),readback=args.readback);args.output.write_text(sql)
  print(json.dumps({'file':str(args.output),'bytes':len(sql.encode()),'sha256':hashlib.sha256(sql.encode()).hexdigest(),'transaction_end':'read-only' if args.readback else 'ROLLBACK','executed':False}))
if __name__=='__main__':main()
