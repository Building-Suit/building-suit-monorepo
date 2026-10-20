begin;
\ir fixtures/clinical.sql
select pg_temp.command('create',jsonb_build_object('patient_id',pg_temp.patient(),'snapshot',pg_temp.snapshot()),14901);
select pg_temp.command('start','{}',14902);select pg_temp.command('finalize','{}',14903);
select pg_temp.put('retained',pg_temp.detail()->'versions'->0);
select public.doctor_write_location(p_practice=>pg_temp.practice(),p_name=>'Synthetic fallback clinic',p_timezone=>'Etc/UTC',p_phone=>'',p_address=>'',p_key=>pg_temp.id(14904));
select lives_ok($$select public.doctor_archive_patient(pg_temp.practice(),pg_temp.location(),pg_temp.patient(),1,pg_temp.id(14905))$$,'M2-014 actual patient archival retains referencing clinical records');
select is(pg_temp.detail()->'versions'->0->>'snapshot_sha256',pg_temp.v('retained')->>'snapshot_sha256','M2-014 archived patient history retains exact final source integrity');
select lives_ok($$select public.doctor_archive_location(pg_temp.practice(),pg_temp.location(),1,pg_temp.id(14906))$$,'M2-014 actual clinic archival preserves the practice-owned historical encounter');
select is(pg_temp.detail()->'encounter'->>'location_name','Synthetic clinic 1','M2-014 archived origin keeps its captured clinic provenance');
select is(pg_temp.detail()->'versions'->0->>'snapshot_sha256',pg_temp.v('retained')->>'snapshot_sha256','M2-014 archived clinic history remains readable under current practice authority');
select throws_ok($$select pg_temp.command('create',jsonb_build_object('patient_id',pg_temp.patient(),'snapshot',pg_temp.snapshot()),14907)$$,'22023','DOCTOR_CLINICAL_ARCHIVED','M2-014 archived origin cannot accept new clinical writes');
select * from finish();rollback;
