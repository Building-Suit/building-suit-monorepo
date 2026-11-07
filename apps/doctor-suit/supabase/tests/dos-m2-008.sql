begin;
\ir fixtures/clinical.sql
select pg_temp.command('create',jsonb_build_object('patient_id',pg_temp.patient(),'snapshot',pg_temp.snapshot()),8001);
select pg_temp.command('start','{}',8002);
select throws_ok($$select pg_temp.command('finalize',jsonb_build_object('reviewed_version_id',pg_temp.id(999),'reviewed_sha256',repeat('a',64)),8099)$$,'40001','DOCTOR_CLINICAL_REVIEW_CONFLICT','M2-008 finalization must name the exact reviewed version and digest');
select pg_temp.command('finalize','{}',8003);
select pg_temp.put('first',pg_temp.detail()->'versions'->0);
select pg_temp.command('amend','{"reason":"Synthetic correction"}',8004);
select is(pg_temp.detail()->'versions'->0->>'source_version_id',pg_temp.v('first')->>'id','M2-008 amendment links original immutable final version');
select pg_temp.command('finalize','{}',8005);
select is(pg_temp.detail()->'versions'->2->>'snapshot_sha256',pg_temp.v('first')->>'snapshot_sha256','M2-008 later finalization preserves original integrity reference');
select is(pg_temp.detail()->'versions'->2->>'version_status','superseded','M2-008 old final version is visibly superseded');
select is(pg_temp.detail()->'versions'->0->>'actor_user_id',pg_temp.id(1)::text,'M2-008 finalization attributes actual fixture signer');
reset role;update auth.users set deleted_at=clock_timestamp() where id=pg_temp.id(1);set local role authenticated;
select is(public.doctor_clinical_workspace(pg_temp.practice(),pg_temp.location())->>'available','false','M2-008 soft-deleted actor cannot retain fixture chart access');
select * from finish();rollback;
