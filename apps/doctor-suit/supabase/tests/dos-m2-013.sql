begin;
\ir fixtures/clinical.sql
select pg_temp.command('create',jsonb_build_object('patient_id',pg_temp.patient(),'snapshot',pg_temp.snapshot()),13001);
select pg_temp.put('package',public.doctor_clinical_export(pg_temp.practice(),pg_temp.location(),(pg_temp.v('encounter')->>'encounter_id')::uuid,pg_temp.id(13002)));
select is(encode(sha256(convert_to(pg_temp.v('package')->>'canonical_manifest','UTF8')),'hex'),pg_temp.v('package')->>'sha256','M2-013 manifest checksum is reproducible');
select is((pg_temp.v('package')->>'canonical_manifest')::jsonb->>'versions_total','1','M2-013 manifest declares complete version population');
select is((pg_temp.v('package')->>'canonical_manifest')::jsonb->>'retention_policy','unapproved_no_erasure','M2-013 export does not invent retention or erasure authority');
select is(public.doctor_clinical_export(pg_temp.practice(),pg_temp.location(),(pg_temp.v('encounter')->>'encounter_id')::uuid,pg_temp.id(13002)),pg_temp.v('package'),'M2-013 exact export replay preserves immutable package');
select pg_temp.claim(2);select throws_ok($$select public.doctor_clinical_export(pg_temp.practice(),pg_temp.location(),(pg_temp.v('encounter')->>'encounter_id')::uuid,pg_temp.id(13003))$$,'42501',null,'M2-013 foreign practice export is denied');
select * from finish();rollback;
