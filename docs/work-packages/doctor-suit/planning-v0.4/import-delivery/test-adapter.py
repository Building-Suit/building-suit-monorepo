#!/usr/bin/env python3
"""Integration checks in an explicit disposable, network-isolated PostgreSQL container."""
import copy
import importlib.util
import json
import os
from pathlib import Path
import subprocess

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[4]
spec=importlib.util.spec_from_file_location('adapter',HERE/'adapter.py');adapter=importlib.util.module_from_spec(spec);spec.loader.exec_module(adapter)
container=os.environ.get('CP_DOCTOR_IMPORT_TEST_CONTAINER','')
assert container.startswith('cp-doctor-import-disposable'), 'An explicitly disposable container is required'
inspect=json.loads(subprocess.check_output(['docker','inspect',container],text=True))[0]
assert inspect['HostConfig']['NetworkMode']=='none', 'Tests must not reach any network/hosted database'
def run(sql,fail=False):
 p=subprocess.run(['docker','exec','-i',container,'psql','-U','postgres','-XqAt','-v','ON_ERROR_STOP=1'],input=sql,text=True,capture_output=True)
 if fail:
  assert p.returncode!=0,'Expected transaction rejection';return p.stderr
 assert p.returncode==0,p.stderr[-4000:]
 return p.stdout.strip()
def value(sql):return json.loads(run(sql).splitlines()[-1])
def counts():return value("SELECT jsonb_build_object('tasks',(SELECT count(*) FROM control.tasks),'suits',(SELECT count(*) FROM control.suits),'decisions',(SELECT count(*) FROM control.decisions),'requirements',(SELECT count(*) FROM control.requirements),'ready',(SELECT count(*) FROM control.ready_tasks),'executions',(SELECT count(*) FROM control.executions));")
def bindings():
 b=value(adapter.evidence_sql())
 b.update(source_head=adapter.SOURCE_HEAD,automation_project_ref=adapter.TARGET,workstream_slug='doctor-suit',review_receipt='DISPOSABLE TEST ONLY',live_read_receipt='DISPOSABLE TEST ONLY',consumer_review_receipt='DISPOSABLE TEST ONLY')
 return b

def setup():
 # Exact repository schema/routine bodies are used, not a fake create/refresh routine.
 r=ROOT/'tooling/control-plane/sql';sql=(r/'001_control_schema.sql').read_text()
 x=(r/'014_generic_automation_platform.sql').read_text();sql+='BEGIN;\n'+x[x.index('CREATE TABLE IF NOT EXISTS control.retry_policies'):x.index('INSERT INTO control.retry_policies')]+x[x.index('ALTER TABLE control.tasks\n  ADD COLUMN'):x.index('ALTER TABLE control.executions')]+x[x.index('CREATE OR REPLACE VIEW control.ready_tasks AS'):x.index('CREATE OR REPLACE FUNCTION control.generic_task_packet')]+'COMMIT;\n'
 x=(r/'009_continuous_runs.sql').read_text();sql+='BEGIN;\n'+x[x.index('CREATE TABLE IF NOT EXISTS control.workflow_runs'):x.index('CREATE OR REPLACE FUNCTION')]+'COMMIT;\n'
 x=(r/'027_authoritative_publication_readiness.sql').read_text();sql+=x[:x.index('/*\n * Structural root files')]+'COMMIT;\n'
 x=(r/'028_batch_admission_safe_resume.sql').read_text();sql+='BEGIN;\n'+x[x.index('CREATE TABLE IF NOT EXISTS control.batch_repair_generations'):x.index('CREATE TABLE IF NOT EXISTS control.workflow_run_task_credits')]+'COMMIT;\n'
 sql+="INSERT INTO control.projects(project_id,slug,display_name,repository_path,github_repository,local_repository_root,worktree_root,active,application_paths,allowed_publication_paths) VALUES('f71b3b2b-d56b-4f7e-94f5-0b8c379a1088','building-suit','Disposable fixture','Building-Suit/building-suit-monorepo','Building-Suit/building-suit-monorepo','.','fixture',true,'{\"unrelated\":\"apps/unrelated\"}','[\"docs/\",\"apps/\",\"packages/\",\"tooling/\",\"release-fragments/\",\"release-changes/\",\"package.json\",\"pnpm-lock.yaml\",\"pnpm-workspace.yaml\",\"turbo.json\",\"AGENTS.md\"]');"
 run(sql)

assert value("SELECT count(*) FROM pg_namespace WHERE nspname='control';")==0,'Use a fresh disposable database, never reset an existing one'
setup();results=[]
original_project=value("SELECT to_jsonb(p)-'created_at'-'updated_at' FROM control.projects p;")
assert value('SELECT count(*) FROM control.retry_policies;')==0
def passed(name):results.append(name);print(name,flush=True)
manifest,proposals=adapter.load();passed('all nine exact-byte proposals and canonical hashes verified')
b=bindings();before=counts();sql=adapter.render('registration',b);run(sql);assert counts()==before;passed('registration rollback leaves no rows or mapping')
bad=copy.deepcopy(b);bad['create_function_md5']='0'*32;run(adapter.render('registration',bad),fail=True);assert counts()==before;passed('stale routine fingerprint rejects before mutation')
changed=sql.replace('-- Storage never modifies the shared project, including its application mapping.',"UPDATE control.projects SET allowed_publication_paths='[\"unapproved/\"]';\n-- Storage never modifies the shared project, including its application mapping.")
run(changed,fail=True);assert counts()==before;passed('shared project scope drift aborts registration')
changed=sql.replace('-- Storage never modifies the shared project, including its application mapping.',"UPDATE control.projects SET application_paths=application_paths||'{\"doctor-suit\":\"apps/doctor-suit\"}';\n-- Storage never modifies the shared project, including its application mapping.")
run(changed,fail=True);assert counts()==before;passed('Doctor project mapping addition is rejected')
bad=copy.deepcopy(b);bad['model_route_receipt']='An invented route must not be accepted'
try:adapter.render('registration',bad)
except AssertionError:pass
else:raise AssertionError('Route receipt accepted by storage adapter')
passed('execution-route bindings are rejected rather than fabricated')

# Commit is only for this isolated test database; the delivered renderer cannot emit COMMIT.
def commit_fixture(sql):
 assert sql.rstrip().endswith('ROLLBACK;');return run(sql.rstrip()[:-len('ROLLBACK;')]+'COMMIT;')
commit_fixture(sql);receipt=value(adapter.render('registration',b,readback=True));assert all(v is True for k,v in receipt.items() if k not in ['source_head','step','task_count']),receipt;assert counts()['decisions']==9 and counts()['tasks']==0;passed('registration stores nine real open gates before tasks')
b=bindings();m1=adapter.render('DOS-M1',b);before=counts()
# No route, retry policy or command configuration exists or is needed to store plans.
assert value("SELECT to_jsonb(active) FROM control.workstreams WHERE slug='doctor-suit';") is False
assert value("SELECT verification_config FROM control.workstreams WHERE slug='doctor-suit';")=={}
assert value("SELECT metadata->'verification_config_proposal'->'commands' FROM control.workstreams WHERE slug='doctor-suit';")
assert value("SELECT to_jsonb(p)-'created_at'-'updated_at' FROM control.projects p;")==original_project
passed('inactive unbound registration, command proposals in metadata, shared project unchanged and zero retry policies')
err=run(m1.replace("p_model_profile=>'no_ai'","p_model_profile=>NULL"),fail=True)
assert 'model_profile' in err and 'not-null' in err
passed('actual task NOT NULL constraint rejects a null model value; no_ai is the supported non-provider value')
activate="UPDATE control.workstreams SET active=true WHERE project_id='f71b3b2b-d56b-4f7e-94f5-0b8c379a1088' AND slug='doctor-suit' AND active=false;"
assert activate in m1
err=run(m1.replace(activate,''),fail=True);assert 'Active project/workstream not found' in err
passed('actual supported routine rejects an inactive workstream at insertion')
window=m1.replace(activate,activate+"\nSELECT 'DOCTOR_STORAGE_TRANSIENT';SELECT pg_sleep(2);")
worker=subprocess.Popen(['docker','exec','-i',container,'psql','-U','postgres','-XqAt','-v','ON_ERROR_STOP=1'],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
# Feed on a separate thread because the complete canonical input exceeds pipe capacity.
import threading
writer=threading.Thread(target=lambda:(worker.stdin.write(window),worker.stdin.close()));writer.start()
for line in worker.stdout:
 if line.strip()=='DOCTOR_STORAGE_TRANSIENT':
  assert value("SELECT to_jsonb(active) FROM control.workstreams WHERE slug='doctor-suit';") is False
  assert counts()['tasks']==0 and counts()['ready']==0
  break
else:raise AssertionError('No transient test window reached')
worker.stdout.read();error=worker.stderr.read();assert worker.wait()==0,error;writer.join();assert counts()==before
passed('independent connection never observes transient active flag or uncommitted tasks')

start=m1.index('  INSERT INTO control.task_decisions(task_id,suit_slug,decision_id,blocking)')
end=m1.index(' END LOOP;',start)
missing=m1[:start]+m1[end:];run(missing,fail=True);assert counts()==before;passed('missing start links aborts the entire task batch')
deactivate="UPDATE control.workstreams SET active=false WHERE project_id='f71b3b2b-d56b-4f7e-94f5-0b8c379a1088' AND slug='doctor-suit';"
err=run(m1.replace(deactivate,''),fail=True);assert 'inactive and unbound' in err;assert counts()==before
passed('a persisted active workstream is rejected before commit')
installed=m1.replace(deactivate,deactivate+"\nUPDATE control.workstreams SET verification_config='{\"commands\":[{\"name\":\"unverified\"}]}' WHERE slug='doctor-suit';")
err=run(installed,fail=True);assert 'inactive and unbound' in err;assert counts()==before
passed('installed executable commands are rejected before commit')
closed=m1.replace('SELECT pg_temp.doctor_assert_stopped();',"UPDATE control.decisions SET status='approved' WHERE decision_id='DOS-M1-GATE-START';\nSELECT pg_temp.doctor_assert_stopped();",1)
run(closed,fail=True);assert counts()==before;passed('closed start gate rejects import and rolls back')
for n in range(1,10):
 step=f'DOS-M{n}';b=bindings();sql=adapter.render(step,b);before=counts()
 run(sql);assert counts()==before
 commit_fixture(sql);receipt=value(adapter.render(step,b,readback=True));assert all(v is True for k,v in receipt.items() if k not in ['source_head','step','task_count']),receipt;after=counts();assert after['tasks']==sum(len(p['task_ids']) for p in proposals[:n]);assert after['ready']==0 and after['executions']==0
 assert value("SELECT to_jsonb(p)-'created_at'-'updated_at' FROM control.projects p;")==original_project
 assert value("SELECT to_jsonb(active) FROM control.workstreams WHERE slug='doctor-suit';") is False
 assert value('SELECT count(*) FROM control.retry_policies;')==0
 passed(step+' rollback and atomic storage preserve inactive workstream, unchanged project and zero ready/admitted tasks')

# Admission evidence is forbidden even when an admission is blocked/revoked.
admission="""INSERT INTO control.batch_repair_generations(repair_id,evidence_sha256,registry_patch,controller_proof,status,idempotency_key) VALUES('storage-test',repeat('0',64),'{}','{}','prepared','storage-test');
INSERT INTO control.workflow_runs(run_id,suit_slug,max_tasks) VALUES('a0000000-0000-4000-8000-000000000001','doctor-suit',1);
INSERT INTO control.batch_task_admissions(repair_id,task_id,run_id,ordinal,input_generation,contract_fingerprint,verification_fingerprint,status) VALUES('storage-test','DOS-M1-001','a0000000-0000-4000-8000-000000000001',1,0,'fixture','fixture','blocked');
"""
receipt=value('BEGIN;'+admission+adapter.render('DOS-M9',bindings(),readback=True)+'ROLLBACK;')
assert receipt['no_batch_admissions'] is False
# The pre-commit guard is tested independently of the earlier no-workflow guard.
guard=(HERE/'adapter-common.sql').read_text();guard=guard[guard.index('CREATE FUNCTION pg_temp.doctor_assert_stopped()'):]
assertion="CREATE FUNCTION pg_temp.doctor_assert(ok boolean,message text) RETURNS void LANGUAGE plpgsql AS $$BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION '%',message;END IF;END $$;"
err=run('BEGIN;'+admission+assertion+guard+'ROLLBACK;',fail=True);assert 'Doctor batch admission exists' in err
assert value('SELECT count(*) FROM control.batch_task_admissions;')==0
passed('any Doctor batch admission fails pre-commit assertion and readback, including blocked admission')
before=counts();run(adapter.render('DOS-M9',bindings()),fail=True);assert counts()==before;passed('duplicate batch rejected without overwriting history')
actual=value("SELECT jsonb_object_agg(task_id,metadata) FROM control.tasks WHERE suit_slug='doctor-suit';")
expected={c['arguments']['p_task_id']:c['arguments']['p_metadata'] for p in proposals for c in p['create_task_calls']}
assert {tid:{k:v for k,v in m.items() if k!='planning_storage'} for tid,m in actual.items()}==expected
assert all(m['planning_storage']['model_route_bound'] is False for m in actual.values())
assert counts()=={'tasks':104,'suits':1,'decisions':37,'requirements':117,'ready':0,'executions':0}
assert value('SELECT count(*) FROM control.task_dependencies;')==244
passed('104 complete canonical metadata objects, 117 requirements, 37 decisions and 244 edges read back exactly')
print(json.dumps({'tests':len(results),'passed':results,'fixture':'network-isolated PostgreSQL 17; repository 001/009/014/027/028 table and routine contracts','live_validation':False,'hosted_writes':False},indent=2))
