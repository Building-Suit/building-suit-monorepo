begin;
\ir fixtures/clinical.sql
-- One existing synthetic owner/relationship; client platform claims grant no
-- additional role, professional signing or provider authority.
select pg_temp.command('create',jsonb_build_object('patient_id',pg_temp.patient(),'snapshot',pg_temp.snapshot()),40101);
select is(pg_temp.detail()->>'data_mode','synthetic','M4-010 native/backend candidate retains synthetic data mode');
select is(pg_temp.detail()->>'clinical_approval','false','M4-010 mobile clients cannot infer clinical approval');
select is(pg_temp.detail()->>'live_prescribing','false','M4-010 mobile clients cannot activate live prescribing');
select is(pg_temp.detail()->'versions'->0->>'professional_signature','false','M4-010 entered notes are not a professional signature');
select throws_ok($$select public.doctor_clinical_command(pg_temp.practice(),pg_temp.location(),null,null,'create',jsonb_build_object('patient_id',pg_temp.patient(),'snapshot',pg_temp.snapshot(),'clinical_approval',true),pg_temp.id(40102))$$,'22023',null,'M4-010 client-supplied clinical approval fields are rejected');
select pg_temp.command('start','{}',40103);
select pg_temp.put('reviewed',pg_temp.detail()->'versions'->0);
select pg_temp.claim(3);
select set_config('request.jwt.claims',(current_setting('request.jwt.claims')::jsonb||jsonb_build_object('user_metadata',jsonb_build_object('role','doctor','portal','doctor','platform','android','clinical_signer',true,'practice_id',pg_temp.practice())))::text,true);
select throws_ok($$select public.doctor_appointment_board(pg_temp.practice(),pg_temp.location(),current_date,0,0)$$,'42501',null,'M4-010 editable mobile claims cannot manufacture secretary appointment grants');
select throws_ok($$select public.doctor_clinical_command(pg_temp.practice(),pg_temp.location(),(pg_temp.v('encounter')->>'encounter_id')::uuid,(pg_temp.v('encounter')->>'version')::integer,'finalize',jsonb_build_object('reviewed_version_id',pg_temp.v('reviewed')->>'id','reviewed_sha256',pg_temp.v('reviewed')->>'snapshot_sha256'),pg_temp.id(40104))$$,'42501',null,'M4-010 forged native doctor/signer metadata cannot authorize secretary finalization');
reset role;
update public.memberships set status='revoked' where id=pg_temp.id(201);
set local role authenticated;select pg_temp.claim(3);
select throws_ok($$select public.doctor_patients(pg_temp.practice(),pg_temp.location(),0,25,'','active')$$,'42501',null,'M4-010 a valid cached session cannot retain revoked relationship grants');
reset role;
delete from auth.sessions where id=pg_temp.id(11);
set local role authenticated;select pg_temp.claim(1);
select throws_ok($$select pg_temp.detail()$$,'42501',null,'M4-010 restored credentials cannot read a chart after server session revocation');
select * from finish();rollback;
