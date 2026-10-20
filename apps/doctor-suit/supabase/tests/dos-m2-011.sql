begin;
\ir fixtures/clinical.sql
select pg_temp.command('create',jsonb_build_object('patient_id',pg_temp.patient(),'snapshot',pg_temp.snapshot()),11001);
select pg_temp.put('order',jsonb_build_object('id',pg_temp.id(500),'kind','imaging','request','Synthetic entered request','due_at',null,'state','requested','reason',''));
select pg_temp.put('result',jsonb_build_object('id',pg_temp.id(501),'order_id',pg_temp.id(500),'document_version_id',null,'stage','requested','annotation',''));
select pg_temp.put('snapshot',jsonb_set(jsonb_set(pg_temp.snapshot(),'{orders}',jsonb_build_array(pg_temp.v('order'))),'{results}',jsonb_build_array(pg_temp.v('result'))));
select pg_temp.command('save',jsonb_build_object('snapshot',pg_temp.v('snapshot')),11002);
select throws_ok($$select pg_temp.command('save',jsonb_build_object('snapshot',jsonb_set(pg_temp.v('snapshot'),'{results,0,stage}','"reviewed"')),11003)$$,'22023','DOCTOR_CLINICAL_RESULT_INVALID','M2-011 received/reviewed requires an actual referenced document version');
select throws_ok($$select pg_temp.command('save',jsonb_build_object('snapshot',jsonb_set(jsonb_set(pg_temp.v('snapshot'),'{results,0,document_version_id}',to_jsonb(pg_temp.id(999)::text)),'{results,0,stage}','"received"')),11004)$$,'42501','DOCTOR_CLINICAL_DOCUMENT_DENIED','M2-011 forged or foreign document version is rejected');
select is(pg_temp.detail()->'versions'->0->'snapshot'->'results'->0->>'stage','requested','M2-011 failed file/review commands do not promote result status');

-- Provider Storage is a SQL interface scaffold here. Real uploaded bytes are
-- checked separately by the actual-provider HTTP acceptance runner.
set local role service_role;
select pg_temp.put('upload',public.doctor_reserve_document(pg_temp.id(1),pg_temp.id(11),pg_temp.practice(),pg_temp.location(),pg_temp.patient(),'synthetic.pdf','application/pdf',128,repeat('a',64),pg_temp.id(11100)));
select pg_temp.put('file',public.doctor_finalize_document(pg_temp.id(1),pg_temp.id(11),(pg_temp.v('upload')->>'intent_id')::uuid));
set local role authenticated;select pg_temp.claim(1);
select pg_temp.put('snapshot',jsonb_set(jsonb_set(pg_temp.v('snapshot'),'{results,0,document_version_id}',to_jsonb(pg_temp.v('file')->>'version_id')),'{results,0,stage}','"uploaded"'));
select pg_temp.command('save',jsonb_build_object('snapshot',pg_temp.v('snapshot')),11101);
select is(pg_temp.detail()->'versions'->0->'snapshot'->'results'->0->>'stage','uploaded','M2-011 trusted file version remains explicitly unreviewed after upload');
select throws_ok($$select pg_temp.command('save',jsonb_build_object('snapshot',jsonb_set(pg_temp.v('snapshot'),'{results,0,stage}','"released"')),11102)$$,'22023','DOCTOR_CLINICAL_RESULT_TRANSITION_INVALID','M2-011 upload cannot skip receipt and review');
select pg_temp.put('snapshot',jsonb_set(pg_temp.v('snapshot'),'{results,0,stage}','"received"'));select pg_temp.command('save',jsonb_build_object('snapshot',pg_temp.v('snapshot')),11103);
select pg_temp.put('snapshot',jsonb_set(pg_temp.v('snapshot'),'{results,0,stage}','"reviewed"'));select pg_temp.command('save',jsonb_build_object('snapshot',pg_temp.v('snapshot')),11104);
select pg_temp.put('snapshot',jsonb_set(pg_temp.v('snapshot'),'{results,0,stage}','"released"'));select pg_temp.command('save',jsonb_build_object('snapshot',pg_temp.v('snapshot')),11105);
select pg_temp.command('start','{}',11106);select pg_temp.command('finalize','{}',11107);
select pg_temp.command('release',jsonb_build_object('recipient_user_id',pg_temp.id(4),'expires_at',to_char(clock_timestamp()+interval '1 hour','YYYY-MM-DD"T"HH24:MI:SS"Z"')),11108);
select pg_temp.put('release',pg_temp.v('encounter'));select pg_temp.claim(4);
select is(public.doctor_clinical_released((pg_temp.v('release')->>'release_id')::uuid)->'results'->0->>'document_version_id',pg_temp.v('file')->>'version_id','M2-011 explicit review and release exposes exact approved source version');
select throws_ok($$select public.doctor_clinical_release_delivery(pg_temp.id(4),pg_temp.id(14),(pg_temp.v('release')->>'release_id')::uuid,(pg_temp.v('file')->>'version_id')::uuid)$$,'42501',null,'M2-011 recipients cannot request Storage object paths directly');
set local role service_role;
select ok(public.doctor_clinical_release_delivery(pg_temp.id(4),pg_temp.id(14),(pg_temp.v('release')->>'release_id')::uuid,(pg_temp.v('file')->>'version_id')::uuid,pg_temp.id(11109))?'object_path','M2-011 trusted adapter obtains only the currently released source file');
select ok(public.doctor_clinical_release_delivery(pg_temp.id(4),pg_temp.id(14),(pg_temp.v('release')->>'release_id')::uuid,(pg_temp.v('file')->>'version_id')::uuid,pg_temp.id(11109))?'object_path','M2-011 exact delivery retry remains currently authorized');
reset role;select is((select count(*) from public.clinical_events where encounter_id=(pg_temp.v('encounter')->>'encounter_id')::uuid and action='download'),1::bigint,'M2-011 delivery retry appends one attributed download event');set local role service_role;
select throws_ok($$select public.doctor_clinical_release_delivery(pg_temp.id(5),pg_temp.id(15),(pg_temp.v('release')->>'release_id')::uuid,(pg_temp.v('file')->>'version_id')::uuid)$$,'42501',null,'M2-011 trusted adapter cannot substitute another recipient');
reset role;update doctor_private.clinical_recipient_grants set revoked_at=clock_timestamp()where user_id=pg_temp.id(4);set local role service_role;
select throws_ok($$select public.doctor_clinical_release_delivery(pg_temp.id(4),pg_temp.id(14),(pg_temp.v('release')->>'release_id')::uuid,(pg_temp.v('file')->>'version_id')::uuid,pg_temp.id(11109))$$,'42501',null,'M2-011 file delivery receipt cannot revive a revoked recipient');

select * from finish();rollback;
