import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {spawnSync,spawn} from 'node:child_process'

const container=process.env.CP_EGRESS_TEST_CONTAINER,backup=process.env.CP_SHARED_PLANNING_BACKUP
const db='cp_shared_planning_disposable_'+process.pid+'_'+Date.now()
const run='1a75a547-3372-4e2a-b51c-3b1b2bf9ad81',foundation='BS-SA-FUTURE-SUIT-001',later='BS-SA-FUTURE-SUIT-M4-VALIDATION-001'
const docker=(args,input)=>spawnSync('docker',['exec','-i',container,...args],{input,encoding:'utf8',timeout:120000,maxBuffer:32*1024*1024})
const sql=input=>docker(['psql','-U','postgres','-d',db,'-XqAt','-v','ON_ERROR_STOP=1'],input)
const q=input=>{const r=sql(input);assert.equal(r.status,0,r.stderr);return r.stdout.trim().split('\n').filter(Boolean).at(-1)}
const json=input=>JSON.parse(q(input))
const repair=`SELECT control.repair_shared_future_suit_dependency('${run}','147862b56eb8e0f2417a5d4a8d768bee','Owner requested audited foundation/M4 split in Codex on 2026-10-10.');`
const choices=`SELECT control.approve_shared_changelog_choices('${run}','semantic-prerelease',48,'Owner explicitly selected semantic versioning with prerelease labels and 48 hours in Codex on 2026-10-10.');`
const acquisition=`SELECT control.acquire_workflow_run_task('${run}','cp-batch-v2',(SELECT controller_fingerprint FROM control.workflow_runs WHERE run_id='${run}'),'shared-planning-test','runner');`
const history=()=>q(`SELECT md5(jsonb_build_object('executions',(SELECT jsonb_agg(to_jsonb(e) ORDER BY execution_id) FROM control.executions e),'credits',(SELECT jsonb_agg(to_jsonb(c) ORDER BY run_id,task_id) FROM control.workflow_run_task_credits c),'grants',(SELECT jsonb_agg(to_jsonb(e) ORDER BY event_id) FROM control.operator_authority_events e),'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY policy_id) FROM control.retry_policies p),'limits',(SELECT jsonb_agg(jsonb_build_array(run_id,max_tasks,completed_tasks) ORDER BY run_id) FROM control.workflow_runs))::text);`)
const parallel=input=>new Promise(resolve=>{const p=spawn('docker',['exec','-i',container,'psql','-U','postgres','-d',db,'-XqAt','-v','ON_ERROR_STOP=1']);let err='';p.stderr.on('data',b=>err+=b);p.stdout.resume();p.on('exit',code=>resolve({code,err}));p.stdin.end(input)})

test('audited Shared planning split on isolated restored control fixture',{skip:!backup,timeout:180000},async t=>{
 assert.match(container??'',/^cp-.*disposable[-a-z0-9]*$/)
 assert.equal(docker(['createdb','-U','postgres',db]).status,0)
 try{
  const restored=docker(['pg_restore','-U','postgres','-d',db,'--exit-on-error'],readFileSync(backup));assert.equal(restored.status,0,restored.stderr)
  if(process.env.CP_SHARED_PLANNING_FIXTURE==='1'){
   q(readFileSync(new URL('../sql/115_frozen_shared_publication_roots.sql',import.meta.url),'utf8'))
   q(`UPDATE control.tasks SET status='complete' WHERE task_id IN('BS-REALTIME-FOUNDATION-001','BS-REALTIME-ADOPTION-001');UPDATE control.workflow_runs SET completed_tasks=2,current_task_id=NULL WHERE run_id='${run}';`)
  }
  const before=history(),original=json(`SELECT acceptance_criteria FROM control.tasks WHERE task_id='${foundation}';`)
  q(readFileSync(new URL('../sql/116_shared_foundation_planning.sql',import.meta.url),'utf8'))
  await t.test('baseline preserves real M4 dependency and open owner decisions',()=>{
   assert.equal(q(`SELECT control.task_hard_dependencies_complete('${foundation}');`),'f')
   assert.equal(q("SELECT control.task_blocking_decisions_clear('BS-CHANGELOG-VERSION-001');"),'f')
  })
  await t.test('executor cannot authorize a planning repair or owner choices',()=>{
   for(const call of [repair,choices])assert.notEqual(sql('BEGIN;SET LOCAL ROLE bs_runtime_executor;'+call+'ROLLBACK;').status,0)
  })
  await t.test('wrong run, stale scope, active claim and changed acceptance fail closed',()=>{
   for(const call of [repair.replace(run,'06124632-a51d-4d08-bb62-ee4e8cedb9dc'),repair.replace('147862b56eb8e0f2417a5d4a8d768bee','bad')])assert.notEqual(sql(call).status,0)
   for(const mutation of [`UPDATE control.workflow_runs SET current_task_id='BS-CHANGELOG-VERSION-001' WHERE run_id='${run}'`, `UPDATE control.tasks SET acceptance_criteria='["changed"]' WHERE task_id='${foundation}'`])assert.notEqual(sql('BEGIN;'+mutation+';'+repair+'ROLLBACK;').status,0)
   assert.equal(history(),before)
  })
  await t.test('concurrent planning replay records one repair and one deferred task',async()=>{
   const results=await Promise.all([parallel('SET ROLE bs_control_operator;'+repair),parallel('SET ROLE bs_control_operator;'+repair)])
   for(const r of results)assert.equal(r.code,0,r.err)
   assert.equal(q(`SELECT count(*) FROM control.audit_events WHERE task_id='${foundation}' AND action='shared_foundation_dependency_repaired';`),'1')
   assert.equal(q(`SELECT count(*) FROM control.tasks WHERE task_id='${later}';`),'1')
   assert.equal(history(),before)
  })
  await t.test('foundation criteria, frozen grant and retry policies retained; M4 coverage explicit and unadmitted',()=>{
   assert.deepEqual(json(`SELECT acceptance_criteria FROM control.tasks WHERE task_id='${foundation}';`),original)
   assert.equal(q(`SELECT control.unattended_queue_task_current('${run}','${foundation}');`),'t')
   assert.equal(q(`SELECT control.unattended_queue_task_current('${run}','${later}');`),'f')
   assert.equal(q(`SELECT control.task_hard_dependencies_complete('${later}');`),'f')
   assert.equal(q(`SELECT dependency_type FROM control.task_dependencies WHERE task_id='${foundation}' AND depends_on_task_id='SAS-M4-EVENTS-001';`),'soft')
   assert.equal(q(`SELECT status FROM control.tasks WHERE task_id='SAS-M4-EVENTS-001';`),'planned')
   assert.equal(history(),before)
  })
  await t.test('independent foundation progresses with SAS M4 planned and changelog decisions open',()=>{
   assert.equal(json(`SELECT control.reconcile_ordinary_run_task('${run}','${foundation}');`).authorized,true)
   const selected=json('BEGIN;'+acquisition+'ROLLBACK;');assert.equal(selected.acquired,true);assert.equal(selected.task_id,foundation)
   assert.equal(q("SELECT control.task_blocking_decisions_clear('BS-CHANGELOG-VERSION-001');"),'f')
   assert.equal(history(),before)
  })
  await t.test('genuine hard prerequisite still prevents claim and implementation admission',()=>{
   const result=json(`BEGIN;UPDATE control.task_dependencies SET dependency_type='hard' WHERE task_id='${foundation}' AND depends_on_task_id='SAS-M4-EVENTS-001';${acquisition}ROLLBACK;`)
   assert.equal(result.acquired,false)
   assert.equal(history(),before)
  })
  await t.test('restart and claim replay preserve one task and no execution or completion credit',()=>{
   const selected=json(acquisition);assert.equal(selected.acquired,true);assert.equal(selected.task_id,foundation)
   for(let i=0;i<4;i++){const replay=json(acquisition);assert.equal(replay.task_id,foundation);assert.equal(replay.acquired,true)}
   assert.equal(history(),before)
   // An unfinished claim cannot earn a credit, including repeated requests.
   for(let i=0;i<2;i++)assert.notEqual(sql(`SELECT control.record_workflow_task_success('${run}','${foundation}','${run}:${foundation}');`).status,0)
   assert.equal(history(),before)
   q(`UPDATE control.workflow_runs SET current_task_id=NULL,controller_lease_token=NULL,controller_lease_expires_at=NULL WHERE run_id='${run}';UPDATE control.tasks SET status='planned' WHERE task_id='${foundation}';`)
  })
  await t.test('explicit owner decisions are recorded with choices; restart replay is idempotent',()=>{
   assert.equal(json('SET ROLE bs_control_operator;'+choices).approved,true)
   const audits=q("SELECT count(*) FROM control.audit_events WHERE action='shared_changelog_decision_approved';")
   assert.equal(audits,'2')
   for(let i=0;i<3;i++)assert.equal(json('SET ROLE bs_control_operator;'+choices).idempotent,true)
   assert.equal(q("SELECT count(*) FROM control.audit_events WHERE action='shared_changelog_decision_approved';"),audits)
   assert.equal(q("SELECT control.task_blocking_decisions_clear('BS-CHANGELOG-VERSION-001');"),'t')
   assert.equal(json(repair).idempotent,true)
   assert.equal(history(),before)
  })
  await t.test('original frozen plans are retained and effective amendments reject drift',()=>{
   assert.equal(q(`SELECT count(*) FROM control.bounded_plan_dependency_amendments WHERE run_id='${run}' AND task_id='${foundation}';`),'1')
   assert.equal(q(`SELECT plan->'prerequisite_bindings'->0->>'dependency_type' FROM control.bounded_verification_plans WHERE run_id='${run}' AND task_id='${foundation}';`),'hard')
   assert.equal(q(`SELECT control.effective_bounded_verification_plan('${run}','${foundation}')->'prerequisite_bindings'->0->>'dependency_type';`),'soft')
   assert.notEqual(sql(`BEGIN;UPDATE control.bounded_plan_dependency_amendments SET evidence='changed';ROLLBACK;`).status,0)
   assert.notEqual(sql(`BEGIN;UPDATE control.task_dependencies SET dependency_type='hard' WHERE task_id='${foundation}' AND depends_on_task_id='SAS-M4-EVENTS-001';SELECT control.effective_bounded_verification_plan('${run}','${foundation}');ROLLBACK;`).status,0)
   assert.equal(history(),before)
  })
  await t.test('conflicting decision replay cannot override approval',()=>{
   assert.notEqual(sql(choices.replace(',48,',',24,')).status,0)
  })
  await t.test('completed task credit replay remains exactly once',()=>{
   const credit=json('SELECT to_jsonb(c) FROM control.workflow_run_task_credits c LIMIT 1;');assert.ok(credit);json(`SELECT control.record_workflow_task_success('${credit.run_id}','${credit.task_id}','${credit.idempotency_key}');`)
   assert.equal(history(),before)
  })
 }finally{assert.equal(docker(['dropdb','--force','-U','postgres',db]).status,0)}
})
