begin;
\ir fixtures/clinical.sql
select pg_temp.command('create',jsonb_build_object('patient_id',pg_temp.patient(),'snapshot',pg_temp.snapshot()),7001);
select pg_temp.put('rx',pg_temp.rx());
select throws_ok($$select pg_temp.command('save',jsonb_build_object('snapshot',jsonb_set(pg_temp.snapshot(),'{prescriptions}',jsonb_build_array(jsonb_set(pg_temp.v('rx'),'{segments,0,timezone}','"Invalid/Zone"')))),7002)$$,'22023','DOCTOR_CLINICAL_SCHEDULE_INVALID','M2-007 named timezone is required');
select throws_ok($$select pg_temp.command('save',jsonb_build_object('snapshot',jsonb_set(pg_temp.snapshot(),'{prescriptions}',jsonb_build_array(jsonb_set(pg_temp.v('rx'),'{segments,0,interval_minutes}','60')))),7003)$$,'22023','DOCTOR_CLINICAL_SCHEDULE_INVALID','M2-007 as-needed instructions cannot acquire an inferred cadence');
select throws_ok($$select pg_temp.command('save',jsonb_build_object('snapshot',jsonb_set(pg_temp.snapshot(),'{prescriptions}',jsonb_build_array(jsonb_set(pg_temp.v('rx'),'{segments}',(pg_temp.rx()->'segments')||(pg_temp.rx()->'segments'))))),7004)$$,'22023','DOCTOR_CLINICAL_SCHEDULE_OVERLAP','M2-007 overlapping segments require explicit correction');
select pg_temp.command('save',jsonb_build_object('snapshot',jsonb_set(pg_temp.snapshot(),'{prescriptions}',jsonb_build_array(pg_temp.rx()))),7005);
select is(pg_temp.detail()->'versions'->0->'snapshot'->'prescriptions'->0->'segments',pg_temp.rx()->'segments','M2-007 as-needed representation remains exact without dose-event generation');
select * from finish();rollback;
