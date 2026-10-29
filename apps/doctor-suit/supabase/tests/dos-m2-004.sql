begin;
\ir fixtures/clinical.sql
select pg_temp.command('create',jsonb_build_object('patient_id',pg_temp.patient(),'snapshot',pg_temp.snapshot()),4001);
select throws_ok($$select pg_temp.command('save',jsonb_build_object('snapshot',jsonb_set(pg_temp.snapshot(),'{note,template_version}','2')),4002)$$,'22023','DOCTOR_CLINICAL_TEMPLATE_INVALID','M2-004 unknown template version is rejected');
select throws_ok($$select pg_temp.command('save',jsonb_build_object('snapshot',jsonb_set(pg_temp.snapshot(),'{note,sections,1,key}','"entered_note"')),4003)$$,'22023','DOCTOR_CLINICAL_TEMPLATE_INVALID','M2-004 duplicate section cannot replace a required section');
select pg_temp.command('save',jsonb_build_object('snapshot',jsonb_set(pg_temp.snapshot(),'{note,sections,0,text}','""')),4004);
select pg_temp.command('start','{}',4005);
reset role;
select throws_ok($$select doctor_private.clinical_snapshot(jsonb_set(pg_temp.snapshot(),'{note,sections,0,text}','""'),pg_temp.practice(),pg_temp.location(),pg_temp.patient(),true)$$,'22023',null,'M2-004 incomplete neutral note may remain draft but cannot finalize');
set local role authenticated;
select is(pg_temp.detail()->'versions'->0->'snapshot'->'note'->>'template_version','1','M2-004 saved note retains pinned template version');
select * from finish();rollback;
