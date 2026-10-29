begin;
\ir fixtures/clinical.sql
reset role;
select lives_ok($$select doctor_private.clinical_medicine(pg_temp.rx()->'medicine')$$,'M2-005 explicit synthetic manual provenance is structurally accepted');
select throws_ok($$select doctor_private.clinical_medicine(jsonb_set(pg_temp.rx()->'medicine','{provenance}','"licensed_catalogue"'))$$,'22023','DOCTOR_CLINICAL_CATALOGUE_UNAVAILABLE','M2-005 licence is not inferred');
select throws_ok($$select doctor_private.clinical_medicine(jsonb_set(pg_temp.rx()->'medicine','{source_version}','"unknown-v2"'))$$,'22023','DOCTOR_CLINICAL_CATALOGUE_UNAVAILABLE','M2-005 unknown source revision is rejected');
select ok(not has_function_privilege('authenticated','doctor_private.clinical_medicine(jsonb)','EXECUTE'),'M2-005 private provenance helper cannot confer clinical authority');
select * from finish();rollback;
