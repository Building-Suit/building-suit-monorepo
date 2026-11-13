begin;
\ir fixtures/clinical.sql
select pg_temp.command('create',jsonb_build_object('patient_id',pg_temp.patient(),'snapshot',pg_temp.snapshot()),6001);
select pg_temp.command('save',jsonb_build_object('snapshot',jsonb_set(pg_temp.snapshot(),'{prescriptions}',jsonb_build_array(pg_temp.rx()))),6002);
select is(pg_temp.detail()->'versions'->0->'snapshot'->'prescriptions'->0,pg_temp.rx(),'M2-006 structured entered regimen round trips without clinical defaults');
select is(pg_temp.detail()->'encounter'->>'status','draft','M2-006 saving is not signing');
select throws_ok($$select pg_temp.command('save',jsonb_build_object('snapshot',jsonb_set(pg_temp.snapshot(),'{prescriptions}',jsonb_build_array(jsonb_set(pg_temp.rx(),'{dose,amount}','"0"')))),6003)$$,'22023',null,'M2-006 invalid numeric shape is rejected without replacement dose');
select throws_ok($$select pg_temp.command('save',jsonb_build_object('snapshot',jsonb_set(pg_temp.snapshot(),'{prescriptions}',jsonb_build_array(pg_temp.rx()||'{"recommended":true}'))),6004)$$,'22023',null,'M2-006 clinical recommendation fields are not accepted');
select * from finish();rollback;
