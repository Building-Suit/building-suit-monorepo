begin;
\ir fixtures/clinical.sql
select pg_temp.command('create',jsonb_build_object('patient_id',pg_temp.patient(),'snapshot',pg_temp.snapshot()),12001);
select pg_temp.command('start','{}',12002);select pg_temp.command('finalize','{}',12003);
select pg_temp.command('release',jsonb_build_object('recipient_user_id',pg_temp.id(4),'expires_at',to_char(clock_timestamp()+interval '1 hour','YYYY-MM-DD"T"HH24:MI:SS"Z"')),12004);
select is(pg_temp.detail()->>'recipients_total','1','M2-012 picker reports its full authorized count');
select ok(position(pg_temp.id(4)::text in (pg_temp.detail()->'recipients'->0->>'name'))>0,'M2-012 recipient identity is explicit rather than contact-inferred');
select pg_temp.put('share',pg_temp.v('encounter'));select pg_temp.claim(4);
select ok(not(public.doctor_clinical_released((pg_temp.v('share')->>'release_id')::uuid)?'note'),'M2-012 patient projection excludes private notes');
select throws_ok($$select pg_temp.detail()$$,'42501',null,'M2-012 a released artifact is not chart membership');
reset role;update doctor_private.clinical_recipient_grants set revoked_at=clock_timestamp() where user_id=pg_temp.id(4);set local role authenticated;select pg_temp.claim(4);
select throws_ok($$select public.doctor_clinical_released((pg_temp.v('share')->>'release_id')::uuid)$$,'42501',null,'M2-012 independent recipient relationship revocation takes effect');
select * from finish();rollback;
