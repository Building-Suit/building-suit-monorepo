begin;
\ir fixtures/clinical.sql
select pg_temp.command('create',jsonb_build_object('patient_id',pg_temp.patient(),'snapshot',pg_temp.snapshot()),9001);
select pg_temp.command('save',jsonb_build_object('snapshot',jsonb_set(pg_temp.snapshot(),'{prescriptions}',jsonb_build_array(pg_temp.rx()))),9002);
select pg_temp.command('start','{}',9003);select pg_temp.command('finalize','{}',9004);
select is(pg_temp.detail()->'versions'->0->>'version_status','active','M2-009 one final source is the active print version');
select is(pg_temp.detail()->'versions'->0->'snapshot'->'prescriptions'->0->>'instructions',pg_temp.rx()->>'instructions','M2-009 print source instructions are unmodified');
select throws_ok($$select pg_temp.command('release',jsonb_build_object('recipient_user_id',pg_temp.id(5),'expires_at',to_char(clock_timestamp()+interval '1 hour','YYYY-MM-DD"T"HH24:MI:SS"Z"')),9005)$$,'42501','DOCTOR_CLINICAL_RECIPIENT_DENIED','M2-009 an unbound recipient cannot receive a share');
select pg_temp.command('release',jsonb_build_object('recipient_user_id',pg_temp.id(4),'expires_at',to_char(clock_timestamp()+interval '1 hour','YYYY-MM-DD"T"HH24:MI:SS"Z"')),9006);
select pg_temp.put('released',pg_temp.v('encounter'));
select pg_temp.claim(4);select is(public.doctor_clinical_released((pg_temp.v('released')->>'release_id')::uuid)->>'release_id',pg_temp.v('released')->>'release_id','M2-009 bound recipient can read the exact final version');
reset role;update auth.users set banned_until=clock_timestamp()+interval '1 hour' where id=pg_temp.id(1);set local role authenticated;
select throws_ok($$select public.doctor_clinical_released((pg_temp.v('released')->>'release_id')::uuid)$$,'42501',null,'M2-009 disabled issuing account cannot sustain fixture delivery');
reset role;update auth.users set banned_until=null where id=pg_temp.id(1);set local role authenticated;select pg_temp.claim(1);
select pg_temp.command('revoke_release',jsonb_build_object('release_id',pg_temp.v('released')->>'release_id','reason','Synthetic withdrawal'),9007);
select pg_temp.claim(4);select throws_ok($$select public.doctor_clinical_released((pg_temp.v('released')->>'release_id')::uuid)$$,'42501',null,'M2-009 revoked share cannot expose old prescription');
select * from finish();rollback;
