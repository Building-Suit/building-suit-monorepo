-- Actual PostgreSQL metadata/RLS tests; byte validation and real Storage HTTP are separate acceptance.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
insert into auth.users(id,email,email_confirmed_at,is_anonymous)select ('51000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'synthetic-document-'||n||'@example.test',now(),false from generate_series(1,6)n;
insert into auth.sessions(id,user_id,not_after)select ('52000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,('51000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,now()+interval '1 hour' from generate_series(1,6)n;
insert into public.doctor_profiles(user_id,display_name)values('51000000-0000-0000-0000-000000000001','Synthetic document doctor A'),('51000000-0000-0000-0000-000000000003','Synthetic document doctor B');
insert into public.practices(id,owner_user_id,name)values('53000000-0000-0000-0000-000000000001','51000000-0000-0000-0000-000000000001','Synthetic document A'),('53000000-0000-0000-0000-000000000002','51000000-0000-0000-0000-000000000003','Synthetic document B');
insert into public.locations(id,practice_id,name,timezone)values
 ('54000000-0000-0000-0000-000000000001','53000000-0000-0000-0000-000000000001','Document A1','Africa/Cairo'),
 ('54000000-0000-0000-0000-000000000002','53000000-0000-0000-0000-000000000001','Document A2','Europe/London'),
 ('54000000-0000-0000-0000-000000000003','53000000-0000-0000-0000-000000000002','Document B1','Etc/UTC');
insert into public.memberships(id,practice_id,user_id,capabilities)values
 ('55000000-0000-0000-0000-000000000001','53000000-0000-0000-0000-000000000001','51000000-0000-0000-0000-000000000002',array['patients.read','documents.read','documents.write']),
 ('55000000-0000-0000-0000-000000000002','53000000-0000-0000-0000-000000000002','51000000-0000-0000-0000-000000000002',array['patients.read','documents.read']),
 ('55000000-0000-0000-0000-000000000003','53000000-0000-0000-0000-000000000001','51000000-0000-0000-0000-000000000004',array['patients.read','documents.read']),
 ('55000000-0000-0000-0000-000000000004','53000000-0000-0000-0000-000000000001','51000000-0000-0000-0000-000000000005',array['patients.read','documents.write']);
insert into public.membership_locations(practice_id,membership_id,location_id,capabilities)values
 ('53000000-0000-0000-0000-000000000001','55000000-0000-0000-0000-000000000001','54000000-0000-0000-0000-000000000001',array['patients.read','documents.read','documents.write']),
 ('53000000-0000-0000-0000-000000000001','55000000-0000-0000-0000-000000000001','54000000-0000-0000-0000-000000000002',array['patients.read','documents.read']),
 ('53000000-0000-0000-0000-000000000002','55000000-0000-0000-0000-000000000002','54000000-0000-0000-0000-000000000003',array['patients.read','documents.read']),
 ('53000000-0000-0000-0000-000000000001','55000000-0000-0000-0000-000000000003','54000000-0000-0000-0000-000000000001',array['patients.read','documents.read']),
 ('53000000-0000-0000-0000-000000000001','55000000-0000-0000-0000-000000000004','54000000-0000-0000-0000-000000000001',array['patients.read','documents.write']);
insert into public.patient_identities(id)values('57000000-0000-0000-0000-000000000001'),('57000000-0000-0000-0000-000000000002');
insert into public.practice_patients(id,practice_id,patient_identity_id,display_name,created_location_id,created_by)values
 ('58000000-0000-0000-0000-000000000001','53000000-0000-0000-0000-000000000001','57000000-0000-0000-0000-000000000001','Synthetic document patient A','54000000-0000-0000-0000-000000000001','51000000-0000-0000-0000-000000000001'),
 ('58000000-0000-0000-0000-000000000002','53000000-0000-0000-0000-000000000002','57000000-0000-0000-0000-000000000002','Synthetic document patient B','54000000-0000-0000-0000-000000000003','51000000-0000-0000-0000-000000000003');
create function pg_temp.id(prefix text,n integer) returns uuid language sql immutable as $$select (prefix||'000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid$$;
create function pg_temp.claim(n integer)returns text language sql as $$select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.id('51',n),'session_id',pg_temp.id('52',n),'role','authenticated','user_metadata',jsonb_build_object('role','owner','verified',true))::text,true)$$;
create function pg_temp.reserve(n integer,actor integer default 1,document uuid default null,revision integer default null,name text default 'synthetic.pdf',mime text default 'application/pdf',bytes bigint default 128,hash text default repeat('a',64)) returns jsonb language sql as $$select public.doctor_reserve_document(pg_temp.id('51',actor),pg_temp.id('52',actor),pg_temp.id('53',1),pg_temp.id('54',1),pg_temp.id('58',1),name,mime,bytes,hash,pg_temp.id('56',n),document,revision)$$;
create function pg_temp.intent()returns uuid language sql as $$select (current_setting('test.document.intent')::jsonb->>'intent_id')::uuid$$;
create function pg_temp.document()returns uuid language sql as $$select (current_setting('test.document.intent')::jsonb->>'document_id')::uuid$$;
create function pg_temp.file()returns uuid language sql as $$select (current_setting('test.document.intent')::jsonb->>'version_id')::uuid$$;
-- A future unrelated permissive Storage policy must not open this private bucket.
create policy fixture_other_buckets on storage.buckets for all to authenticated using(true) with check(true);
create policy fixture_other_objects on storage.objects for all to authenticated using(true) with check(true);
insert into storage.buckets(id,name,public)values('synthetic-unrelated','synthetic-unrelated',false);
insert into storage.objects(bucket_id,name)values('doctor-private-documents','synthetic-placeholder.pdf'),('synthetic-unrelated','synthetic-other.pdf');
select is((select public from storage.buckets where id='doctor-private-documents'),false,'DOS-M1-012-C02: supported bucket configuration is private');
select is((select file_size_limit from storage.buckets where id='doctor-private-documents'),5242880::bigint,'supported bucket configuration enforces the validated file bound');
set local role authenticated;
select pg_temp.claim(1);
select is((public.doctor_patient_documents(pg_temp.id('53',1),pg_temp.id('54',1),pg_temp.id('58',1))->>'total')::integer,0,'authorized empty document state is explicit');
select is(public.doctor_patient_profile(pg_temp.id('53',1),pg_temp.id('54',1),pg_temp.id('58',1))->'patient'->>'provenance','entered_unverified','profile preserves entered/unverified patient provenance');
select is(public.doctor_patient_profile(pg_temp.id('53',1),pg_temp.id('54',1),pg_temp.id('58',1))->'source_context'->>'location_name','Document A1','profile retains explicit origin clinic reference');
select is(public.doctor_patient_profile(pg_temp.id('53',1),pg_temp.id('54',1),pg_temp.id('58',1))->'source_context'->>'actor_label','Synthetic document doctor A','profile attribution derives an account label without granting authority');
select ok((public.doctor_patient_profile(pg_temp.id('53',1),pg_temp.id('54',1),pg_temp.id('58',1))->>'documents_write')::boolean,'stored owner authority determines document controls');
select ok(not(public.doctor_patient_profile(pg_temp.id('53',1),pg_temp.id('54',1),pg_temp.id('58',1)) ? 'diagnosis'),'administrative profile invents no clinical finding');

select throws_ok($$select pg_temp.reserve(1)$$,'42501',null,'browser cannot impersonate the trusted ingest service');
select throws_ok($$select public.doctor_finalize_document(pg_temp.id('51',1),pg_temp.id('52',1),pg_temp.id('59',1))$$,'42501',null,'browser cannot finalize bytes without trusted ingestion');
select is((select count(*) from storage.buckets where id='doctor-private-documents'),0::bigint,'restrictive bucket policy prevents client discovery despite a permissive fixture policy');
with changed as (update storage.buckets set public=true where id='doctor-private-documents' returning id)select is((select count(*) from changed),0::bigint,'clients cannot make the private bucket public despite permissive fixture policy');
select is((select count(*) from storage.objects where bucket_id='doctor-private-documents'),0::bigint,'DOS-M1-012-C02: direct private object reads are denied');
select is((select count(*) from storage.objects where bucket_id='synthetic-unrelated'),1::bigint,'the private guard does not alter unrelated bucket policy');
select throws_ok($$insert into storage.objects(bucket_id,name)values('doctor-private-documents','client-spoof.pdf')$$,'42501',null,'client cannot bypass byte verification with a direct Storage insert');
set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select set_config('test.document.intent',pg_temp.reserve(1)::text,true);
select is(pg_temp.reserve(1),current_setting('test.document.intent')::jsonb,'reserved upload retries preserve exact path, IDs and input');
select is(auth.jwt()->>'role','service_role','trusted command restores the original request claims');
select throws_ok($$select pg_temp.reserve(1,1,null,null,'different.pdf')$$,'22023','DOCTOR_IDEMPOTENCY_CONFLICT','a key cannot name another file intent');
select throws_ok($$select pg_temp.reserve(2,1,null,null,'bad.exe','application/x-msdownload')$$,'22023','DOCTOR_DOCUMENT_INVALID','unsupported MIME metadata is rejected before storage/finalization');
select throws_ok($$select pg_temp.reserve(2,1,null,null,'bad.png','application/pdf')$$,'22023','DOCTOR_DOCUMENT_INVALID','extension and MIME must agree');
select throws_ok($$select pg_temp.reserve(2,1,null,null,'../bad.pdf')$$,'22023','DOCTOR_DOCUMENT_INVALID','path-like filenames are rejected');
select throws_ok($$select pg_temp.reserve(2,1,null,null,'large.pdf','application/pdf',5242881)$$,'22023','DOCTOR_DOCUMENT_INVALID','oversized metadata is rejected');
select throws_ok($$select pg_temp.reserve(2,1,null,null,'empty.pdf','application/pdf',0)$$,'22023','DOCTOR_DOCUMENT_INVALID','empty metadata is rejected');
select throws_ok($$select pg_temp.reserve(2,1,null,null,'hash.pdf','application/pdf',128,'bad')$$,'22023','DOCTOR_DOCUMENT_INVALID','unvalidated integrity data is rejected');
select throws_ok($$select public.doctor_reserve_document(pg_temp.id('51',1),pg_temp.id('52',2),pg_temp.id('53',1),pg_temp.id('54',1),pg_temp.id('58',1),'bad.pdf','application/pdf',128,repeat('a',64),pg_temp.id('56',2))$$,'42501','DOCTOR_AUTH_REQUIRED','service actor/session IDs must describe the same current verified user');
select throws_ok($$select public.doctor_reserve_document(pg_temp.id('51',1),pg_temp.id('52',1),pg_temp.id('53',1),pg_temp.id('54',1),pg_temp.id('58',2),'foreign.pdf','application/pdf',128,repeat('a',64),pg_temp.id('56',2))$$,'42501','DOCTOR_ACCESS_DENIED','another doctor patient cannot be attached to the selected practice');
select lives_ok($$select public.doctor_finalize_document(pg_temp.id('51',1),pg_temp.id('52',1),pg_temp.intent())$$,'trusted finalization creates one immutable administrative file version');
select lives_ok($$select public.doctor_finalize_document(pg_temp.id('51',1),pg_temp.id('52',1),pg_temp.intent())$$,'finalization exact retry is idempotent');
reset role;
select is((select count(*) from public.patient_documents),1::bigint,'one logical document is created');
select is((select count(*) from public.patient_document_versions),1::bigint,'a retry does not duplicate the immutable file version');
select is((select count(*) from public.patient_document_events),1::bigint,'a retry does not duplicate upload history');
set local role authenticated;
select pg_temp.claim(1);
select is(public.doctor_patient_documents(pg_temp.id('53',1),pg_temp.id('54',1),pg_temp.id('58',1))->'rows'->0->'current'->>'provenance','uploaded_unreviewed','DOS-M1-012-C04: uploaded content never implies review or a clinical result');
select is(public.doctor_patient_documents(pg_temp.id('53',1),pg_temp.id('54',1),pg_temp.id('58',1))->'rows'->0->'current'->>'uploaded_by',pg_temp.id('51',1)::text,'DOS-M1-012-C03: uploader is the actual verified account');
select ok(position('object_path' in public.doctor_patient_documents(pg_temp.id('53',1),pg_temp.id('54',1),pg_temp.id('58',1))::text)=0,'client metadata contains no Storage object path');
select ok(position('sha256' in public.doctor_document_history(pg_temp.id('53',1),pg_temp.id('54',1),pg_temp.id('58',1),pg_temp.document())::text)=0,'client history contains no private storage integrity plan');
select throws_ok($$update public.patient_document_versions set uploaded_by=pg_temp.id('51',2)$$,'42501',null,'client cannot rewrite the historical uploader');
select throws_ok($$delete from public.patient_documents$$,'42501',null,'client cannot hard-delete document history');
select pg_temp.claim(3);
select throws_ok($$select public.doctor_patient_documents(pg_temp.id('53',1),pg_temp.id('54',1),pg_temp.id('58',1))$$,'42501','DOCTOR_ACCESS_DENIED','a doctor cannot discover another practice file metadata');
select pg_temp.claim(5);
select throws_ok($$select public.doctor_patient_documents(pg_temp.id('53',1),pg_temp.id('54',1),pg_temp.id('58',1))$$,'42501','DOCTOR_ACCESS_DENIED','documents.write does not implicitly grant documents.read');
set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select throws_ok($$select pg_temp.reserve(3,4)$$,'42501','DOCTOR_ACCESS_DENIED','read-only staff cannot obtain an upload reservation');
select throws_ok($$select pg_temp.reserve(3,5)$$,'42501','DOCTOR_ACCESS_DENIED','write-only staff still needs explicit document read');
select set_config('test.document.replacement',pg_temp.reserve(3,2,pg_temp.document(),1,'replacement.png','image/png',128,repeat('b',64))::text,true);
select set_config('test.document.loser',pg_temp.reserve(4,1,pg_temp.document(),1,'losing.pdf')::text,true);
reset role;
update public.locations set name='Renamed document A1',timezone='Etc/UTC' where id=pg_temp.id('54',1);
set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select lives_ok($$select public.doctor_finalize_document(pg_temp.id('51',2),pg_temp.id('52',2),(current_setting('test.document.replacement')::jsonb->>'intent_id')::uuid)$$,'authorized secretary can replace an administrative attachment');
select throws_ok($$select public.doctor_finalize_document(pg_temp.id('51',1),pg_temp.id('52',1),(current_setting('test.document.loser')::jsonb->>'intent_id')::uuid)$$,'40001','DOCTOR_DOCUMENT_CONFLICT','a stale replacement cannot silently overwrite the accepted version');
reset role;
select is((select count(*) from public.patient_document_versions),2::bigint,'replacement preserves both versions');
select is((select uploaded_by::text from public.patient_document_versions where id=pg_temp.file()),pg_temp.id('51',1)::text,'replacement preserves original uploader identity');
select is((select location_name from public.patient_document_versions where id=pg_temp.file()),'Document A1','historical location name is immutable despite a later rename');
select is((select timezone from public.patient_document_versions where id=pg_temp.file()),'Africa/Cairo','historical timezone is immutable despite a later settings change');
set local role authenticated;
select pg_temp.claim(1);
select is((public.doctor_document_history(pg_temp.id('53',1),pg_temp.id('54',1),pg_temp.id('58',1),pg_temp.document())->>'total')::integer,2,'history exposes both authorized versions');
select lives_ok($$select public.doctor_archive_document(pg_temp.id('53',1),pg_temp.id('54',1),pg_temp.id('58',1),pg_temp.document(),2,pg_temp.id('56',5))$$,'archive marks the logical document without deleting versions');
select lives_ok($$select public.doctor_archive_document(pg_temp.id('53',1),pg_temp.id('54',1),pg_temp.id('58',1),pg_temp.document(),2,pg_temp.id('56',5))$$,'archive exact retry is idempotent');
set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select throws_ok($$select pg_temp.reserve(6,1,pg_temp.document(),3)$$,'22023','DOCTOR_DOCUMENT_ARCHIVED','archived document cannot be silently replaced/reactivated');
select lives_ok($$select public.doctor_document_delivery(pg_temp.id('51',2),pg_temp.id('52',2),pg_temp.id('53',1),pg_temp.id('54',2),pg_temp.id('58',1),pg_temp.document(),pg_temp.file())$$,'current read authority at another clinic permits the preserved practice file');
select lives_ok($$select public.doctor_document_delivery(pg_temp.id('51',2),pg_temp.id('52',2),pg_temp.id('53',1),pg_temp.id('54',2),pg_temp.id('58',1),pg_temp.document(),pg_temp.file(),pg_temp.id('56',7))$$,'delivery recheck records the actual current account/location request');
select lives_ok($$select public.doctor_document_delivery(pg_temp.id('51',2),pg_temp.id('52',2),pg_temp.id('53',1),pg_temp.id('54',2),pg_temp.id('58',1),pg_temp.document(),pg_temp.file(),pg_temp.id('56',7))$$,'uncertain delivery retry retains one attributed request event');
reset role;
select is((select count(*) from public.patient_document_events where event_type='document.download_requested'),1::bigint,'delivery intent does not duplicate its audit');
select is((select location_id::text from public.patient_document_events where event_type='document.download_requested'),pg_temp.id('54',2)::text,'download attribution uses current working clinic rather than owning the patient');
set local role authenticated;
select pg_temp.claim(1);
select lives_ok($$select public.doctor_set_membership_status(pg_temp.id('53',1),pg_temp.id('55',1),1,'revoked',pg_temp.id('56',8))$$,'owner can revoke the independent A membership');
set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select throws_ok($$select public.doctor_document_delivery(pg_temp.id('51',2),pg_temp.id('52',2),pg_temp.id('53',1),pg_temp.id('54',2),pg_temp.id('58',1),pg_temp.document(),pg_temp.file(),pg_temp.id('56',7))$$,'42501','DOCTOR_ACCESS_DENIED','DOS-M1-012-C03: revoked access cannot replay a previously allowed delivery');
select throws_ok($$select pg_temp.reserve(9,2)$$,'42501','DOCTOR_ACCESS_DENIED','revocation also rejects the next trusted upload reservation');
set local role authenticated;
select pg_temp.claim(2);
select throws_ok($$select public.doctor_patient_documents(pg_temp.id('53',1),pg_temp.id('54',1),pg_temp.id('58',1))$$,'42501','DOCTOR_ACCESS_DENIED','same-session metadata reads observe revocation');
select is((public.doctor_patient_documents(pg_temp.id('53',2),pg_temp.id('54',3),pg_temp.id('58',2))->>'total')::integer,0,'independent B file access remains unchanged after revoking A');
select pg_temp.claim(1);
select lives_ok($$select public.doctor_archive_patient(pg_temp.id('53',1),pg_temp.id('54',1),pg_temp.id('58',1),1,pg_temp.id('56',10))$$,'patient archive preserves referencing documents');
select is((public.doctor_patient_documents(pg_temp.id('53',1),pg_temp.id('54',1),pg_temp.id('58',1))->>'total')::integer,1,'current authority can read preserved archived-patient file metadata');
select is((public.doctor_patient_documents(pg_temp.id('53',1),pg_temp.id('54',1),pg_temp.id('58',1))->>'can_write')::boolean,false,'archived-patient files do not accept new writes');
reset role;
select is((select count(*) from public.patient_document_versions),2::bigint,'all immutable file versions remain after both archives');
select is((select count(*) from public.patient_document_events),4::bigint,'upload, replacement, archive and delivery history remain intact');
select throws_ok($$delete from public.practice_patients where id=pg_temp.id('58',1)$$,'23503',null,'actual document references prevent accidental privileged patient deletion');
set local role anon;
select throws_ok($$select public.doctor_patient_documents(pg_temp.id('53',1),pg_temp.id('54',1),pg_temp.id('58',1))$$,'42501',null,'anonymous metadata access is forbidden');
reset role;
select * from finish();
rollback;
