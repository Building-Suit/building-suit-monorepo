import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {spawnSync,spawn} from 'node:child_process'

const container=process.env.CP_EGRESS_TEST_CONTAINER
const backup=process.env.CP_SHARED115_BACKUP
const database='cp_shared115_disposable_'+process.pid+'_'+Date.now()
const run='1a75a547-3372-4e2a-b51c-3b1b2bf9ad81',task='BS-REALTIME-FOUNDATION-001'
const call=`SELECT control.reconcile_ordinary_run_task('${run}','${task}');`
const docker=(args,input)=>spawnSync('docker',['exec','-i',container,...args],{input,encoding:'utf8',timeout:120000,maxBuffer:16*1024*1024})
const sql=s=>docker(['psql','-U','postgres','-d',database,'-XqAt','-v','ON_ERROR_STOP=1'],s)
const q=s=>{const r=sql(s);assert.equal(r.status,0,r.stderr);return r.stdout.trim().split('\n').filter(Boolean).at(-1)}
const json=s=>JSON.parse(q(s))
const parallel=s=>new Promise(resolve=>{const p=spawn('docker',['exec','-i',container,'psql','-U','postgres','-d',database,'-XqAt','-v','ON_ERROR_STOP=1']);let out='',err='';p.stdout.on('data',b=>out+=b);p.stderr.on('data',b=>err+=b);p.on('exit',code=>resolve({code,out,err}));p.stdin.end(s)})
const history=()=>q(`SELECT md5(jsonb_build_object('executions',(SELECT jsonb_agg(to_jsonb(e) ORDER BY execution_id) FROM control.executions e),'credits',(SELECT jsonb_agg(to_jsonb(c) ORDER BY run_id,task_id) FROM control.workflow_run_task_credits c),'dependencies',(SELECT jsonb_agg(to_jsonb(d) ORDER BY task_id,depends_on_task_id) FROM control.task_dependencies d),'grants',(SELECT jsonb_agg(to_jsonb(e) ORDER BY event_id) FROM control.operator_authority_events e),'limits',(SELECT jsonb_agg(jsonb_build_array(run_id,max_tasks,completed_tasks) ORDER BY run_id) FROM control.workflow_runs))::text);`)

test('frozen Shared multi-root repair on the restored live schema114',{skip:!backup,timeout:180000},async t=>{
 assert.match(container??'',/^cp-.*disposable[-a-z0-9]*$/)
 assert.equal(docker(['createdb','-U','postgres',database]).status,0)
 try {
  // Restore ownership and ACLs as well as data, so worker denial tests use the
  // real capability boundary. No hosted connection enters this test process.
  const roles=['bs_runtime_verifier','bs_runtime_installer','bs_runtime_operator','bs_runtime_observer']
  assert.equal(docker(['psql','-U','postgres','-Xq','-v','ON_ERROR_STOP=1'],roles.map(r=>`DO $$ BEGIN IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='${r}') THEN CREATE ROLE ${r}; END IF; END $$;`).join('\n')).status,0)
  const restored=docker(['pg_restore','-U','postgres','-d',database,'--exit-on-error'],readFileSync(backup));assert.equal(restored.status,0,restored.stderr)
  const original=q("SELECT pg_get_functiondef('control.reconcile_ordinary_run_task(uuid,text)'::regprocedure);")
  // pg_get_functiondef is multiline, unlike ordinary q() results.
  const originalDefinition=sql("SELECT pg_get_functiondef('control.reconcile_ordinary_run_task(uuid,text)'::regprocedure);").stdout.trim()
  const originalScopes=json(`SELECT coalesce(metadata->'publication_resolved_scopes','[]') FROM control.tasks WHERE task_id='${task}';`)
  const before=history(),migration=readFileSync(new URL('../sql/115_frozen_shared_publication_roots.sql',import.meta.url),'utf8')
  await t.test('baseline reproduces the exact admission defect and preserves dependency truth',()=>{
   assert.equal(q(`SELECT control.unattended_queue_task_current('${run}','${task}') AND control.task_hard_dependencies_complete('${task}') AND control.task_blocking_decisions_clear('${task}');`),'t')
   assert.notEqual(sql(call).status,0)
   assert.equal(q(`SELECT control.task_publication_authority_is_current('${task}');`),'f')
  })
  q(migration)
  await t.test('current frozen roots reconcile, without new approvals or history changes',()=>{
   assert.equal(json(call).authorized,true)
   assert.deepEqual(json(`SELECT metadata->'publication_resolved_scopes' FROM control.tasks WHERE task_id='${task}';`).sort(),['docs/shared/**','packages/contracts/**','packages/data-access/**','packages/ux/**'])
   assert.equal(q(`SELECT control.task_publication_authority_is_current('${task}');`),'t')
   assert.equal(history(),before)
  })
  await t.test('unchanged repeated reconciliation is idempotent',()=>{
   const n=q(`SELECT count(*) FROM control.task_events WHERE task_id='${task}' AND event_type='queue_shared_scope_derived';`)
   for(let i=0;i<3;i++)assert.equal(json(call).authorized,true)
   assert.equal(q(`SELECT count(*) FROM control.task_events WHERE task_id='${task}' AND event_type='queue_shared_scope_derived';`),n)
  })
  await t.test('native queue acquisition selects Foundation without starting or crediting a test execution',()=>{
   const result=json(`BEGIN;SELECT control.reconcile_native_run_admission('${run}');SELECT control.acquire_workflow_run_task('${run}','cp-batch-v2',(SELECT controller_fingerprint FROM control.workflow_runs WHERE run_id='${run}'),'shared115-test-lease','runner');ROLLBACK;`)
   assert.equal(result.acquired,true,JSON.stringify(result));assert.equal(result.task_id,task);assert.equal(history(),before)
  })
  const rejected=[
   ['fabricated task root',`UPDATE control.tasks SET metadata=jsonb_set(metadata,'{allowed_paths}',(metadata->'allowed_paths')||'"apps/super-admin-suit/**"') WHERE task_id='${task}'`],
   ['task fingerprint drift',`UPDATE control.tasks SET title=title||' changed' WHERE task_id='${task}'`],
   ['requirement drift',`UPDATE control.requirements SET summary=summary||' changed' WHERE requirement_id='BS-LAUNCH-R12'`],
   ['verification plan drift',`UPDATE control.tasks SET verification_plan='["fabricated-check"]' WHERE task_id='${task}'`],
   ['project boundary drift',`UPDATE control.projects SET allowed_publication_paths='["packages/ui/"]' WHERE project_id=(SELECT project_id FROM control.workflow_runs WHERE run_id='${run}')`],
   ['disabled owner',`UPDATE control.operator_actors SET enabled=false WHERE actor_id=(SELECT actor_id FROM control.operator_authority_events WHERE event_id=18)`],
   ['run limit drift',`UPDATE control.workflow_runs SET max_tasks=max_tasks+1 WHERE run_id='${run}'`],
  ]
  for(const [name,mutation] of rejected)await t.test(name+' fails closed',()=>{assert.notEqual(sql(`BEGIN;${mutation};${call}ROLLBACK;`).status,0)})
  await t.test('unsupported roots remain blocked even in a synthetic matching frozen fixture',()=>{
   for(const root of ['tooling/**','packages/secrets/**','apps/shop-suit/supabase/**','.github/workflows/**','packages/../auth/**']){
    // Deliberately forged grants are possible only as local postgres fixtures.
    // Runtime identities have no write capability for authority events.
    const mutation=`ALTER TABLE control.operator_authority_events DISABLE TRIGGER USER;UPDATE control.tasks SET metadata=jsonb_set(metadata,'{allowed_paths}',jsonb_build_array('${root}')) WHERE task_id='${task}';UPDATE control.operator_authority_events ev SET offer=jsonb_set(offer,'{tasks}',(SELECT jsonb_agg(CASE WHEN value->>'task_id'='${task}' THEN value||jsonb_build_object('allowed_paths',jsonb_build_array('${root}'),'scope_fingerprint',control.dot_scope_fingerprint('${task}')) ELSE value END) FROM jsonb_array_elements(ev.offer->'tasks'))) WHERE event_id=18;`
    const result=sql(`BEGIN;${mutation}${call}ROLLBACK;`);assert.notEqual(result.status,0,root);assert.match(result.stderr,/frozen_shared_source_root_not_allowed/,result.stderr)
   }
  })
  await t.test('worker cannot fabricate grant or alter registered paths',()=>{
   for(const statement of [`UPDATE control.operator_authority_events SET response='approve' WHERE event_id=18`,`UPDATE control.tasks SET metadata='{}' WHERE task_id='${task}'`])assert.notEqual(sql(`BEGIN;SET LOCAL ROLE bs_runtime_executor;${statement};ROLLBACK;`).status,0)
   assert.match(sql('BEGIN;UPDATE control.operator_authority_events SET response=\'approve\' WHERE event_id=18;ROLLBACK;').stderr,/append_only_control_evidence/)
  })
  await t.test('reimported resolution metadata is safely rederived from unchanged grant',()=>{
   q(`UPDATE control.tasks SET metadata=metadata-'publication_resolved_scopes' WHERE task_id='${task}';`)
   assert.equal(json(call).authorized,true);assert.equal(history(),before)
  })
  await t.test('concurrent reconciliation derives once under native row locks',async()=>{
   q(`UPDATE control.tasks SET metadata=metadata-'publication_resolved_scopes' WHERE task_id='${task}';`)
   const n=Number(q(`SELECT count(*) FROM control.task_events WHERE task_id='${task}' AND event_type='queue_shared_scope_derived';`))
   const results=await Promise.all([parallel(`BEGIN;SELECT run_id FROM control.workflow_runs WHERE run_id='${run}' FOR UPDATE;SELECT pg_sleep(0.5);${call}COMMIT;`),parallel(call)])
   for(const r of results)assert.equal(r.code,0,r.err)
   assert.equal(Number(q(`SELECT count(*) FROM control.task_events WHERE task_id='${task}' AND event_type='queue_shared_scope_derived';`)),n+1)
  })
  await t.test('genuine local revocation serializes and prevents subsequent derivation',async()=>{
   const actor=q('SELECT actor_id FROM control.operator_authority_events WHERE event_id=18;'),gate=q('SELECT gate_fingerprint FROM control.operator_authority_events WHERE event_id=18;')
   const results=await Promise.all([parallel(`BEGIN;SELECT run_id FROM control.workflow_runs WHERE run_id='${run}' FOR UPDATE;SELECT pg_sleep(0.5);${call}COMMIT;`),parallel(`BEGIN;SELECT control.resolve_authenticated_operator_gate('${actor}','${run}','${gate}','revoke');SELECT pg_sleep(0.2);ROLLBACK;`)])
   for(const r of results)assert.equal(r.code,0,r.err)
   assert.notEqual(sql(`BEGIN;SELECT control.resolve_authenticated_operator_gate('${actor}','${run}','${gate}','revoke');${call}ROLLBACK;`).status,0)
  })
  await t.test('future-SAS hard prerequisite stays blocked, with no credit or attempt',()=>{
   assert.notEqual(sql(`SELECT control.reconcile_ordinary_run_task('${run}','BS-SA-FUTURE-SUIT-001');`).status,0)
   assert.equal(q("SELECT control.task_hard_dependencies_complete('BS-SA-FUTURE-SUIT-001');"),'f')
   assert.equal(history(),before)
  })
  await t.test('rollback restores native hold, retaining receipts and histories',()=>{
   assert.ok(original)
   q(`BEGIN;${originalDefinition};UPDATE control.tasks SET metadata=jsonb_set(metadata,'{publication_resolved_scopes}','${JSON.stringify(originalScopes)}') WHERE task_id='${task}';SELECT control.refresh_publication_readiness_contract('${task}','shared115-rollback-test');COMMIT;`)
   assert.notEqual(sql(call).status,0);assert.equal(q(`SELECT control.task_publication_authority_is_current('${task}');`),'f');assert.equal(history(),before)
   q(migration);assert.equal(json(call).authorized,true)
  })
  t.diagnostic('Live control-only backup restored with ownership/ACLs; no hosted test writes, new execution, fabricated live receipt or credit.')
 } finally {assert.equal(docker(['dropdb','--force','-U','postgres',database]).status,0)}
})
