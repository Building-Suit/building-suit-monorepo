-- Real Storage uses contentLength during permission probing and size on commit.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
create temp table upload_ids(key text primary key,id uuid);
grant all on upload_ids to authenticated;
insert into auth.users(id,email,raw_user_meta_data) values
 ('55000000-0000-4000-8000-000000000001','upload-owner@test.local','{}'),
 ('55000000-0000-4000-8000-000000000002','upload-viewer@test.local','{}');
select set_config('request.jwt.claims','{"sub":"55000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
insert into upload_ids values('org',public.create_organization('Storage admission regression','EGP'));
reset role;
insert into public.organization_members(organization_id,user_id,role)
 select id,'55000000-0000-4000-8000-000000000002','viewer' from upload_ids where key='org';
set local role authenticated;
create function pg_temp.upload_key() returns text language sql as $$
 select id::text||'/organization/'||id::text||'/native.pdf' from upload_ids where key='org'; $$;
insert into upload_ids select 'reservation',public.reserve_attachment_upload(
 (select id from upload_ids where key='org'),'organization',(select id from upload_ids where key='org'),
 'native.pdf','application/pdf',51,pg_temp.upload_key());
select ok(app.storage_upload_matches_reservation('attachments',pg_temp.upload_key(),'{"contentLength":51,"mimetype":"application/pdf"}'),
 'Provider admission accepts exact declared bytes');
select ok(app.storage_upload_matches_reservation('attachments',pg_temp.upload_key(),'{"size":51,"mimetype":"application/pdf"}'),
 'Existing final-size metadata remains supported');
select ok(app.storage_upload_matches_reservation('attachments',pg_temp.upload_key(),'{"size":51,"contentLength":51,"mimetype":"application/pdf"}'),
 'Both length fields must agree with the reservation');
select ok(not app.storage_upload_matches_reservation('attachments',pg_temp.upload_key(),payload),label)
 from (values
 ('{"size":51,"contentLength":52,"mimetype":"application/pdf"}'::jsonb,'Conflicting lengths rejected'),
 ('{"contentLength":52,"mimetype":"application/pdf"}','Oversized declared bytes rejected'),
 ('{"size":52,"mimetype":"application/pdf"}','Oversized final bytes rejected'),
 ('{"contentLength":null,"mimetype":"application/pdf"}','Null length rejected'),
 ('{"mimetype":"application/pdf"}','Missing length rejected'),
 ('{}','Empty metadata rejected'),
 ('{"contentLength":"9999999999999999999999999999999","mimetype":"application/pdf"}','Oversized integer input rejected without conversion'),
 ('{"contentLength":51,"mimetype":"image/png"}','MIME mismatch rejected'),
 ('{"contentLength":"051","mimetype":"application/pdf"}','Noncanonical byte length rejected')
 ) v(payload,label);
select ok(not app.storage_upload_matches_reservation('foreign-bucket',pg_temp.upload_key(),'{"contentLength":51,"mimetype":"application/pdf"}'),
 'Another bucket cannot use the reservation');
select ok(not app.storage_upload_matches_reservation('attachments',pg_temp.upload_key()||'.other','{"contentLength":51,"mimetype":"application/pdf"}'),
 'Another object cannot use the reservation');
select set_config('request.jwt.claims','{"sub":"55000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select ok(not app.storage_upload_matches_reservation('attachments',pg_temp.upload_key(),'{"contentLength":51,"mimetype":"application/pdf"}'),
 'Viewer cannot use an owner reservation');
select set_config('request.jwt.claims','{"sub":"55000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select ok(not app.storage_upload_matches_reservation('attachments',pg_temp.upload_key(),'{"contentLength":51,"mimetype":"application/pdf"}'),
 'Outsider cannot use the reservation');
reset role;
update app.attachment_storage_reservations set expires_at=now()-interval '1 minute'
 where id=(select id from upload_ids where key='reservation');
select set_config('request.jwt.claims','{"sub":"55000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select ok(not app.storage_upload_matches_reservation('attachments',pg_temp.upload_key(),'{"contentLength":51,"mimetype":"application/pdf"}'),
 'Expired owner reservation rejected');
select * from finish();
rollback;
