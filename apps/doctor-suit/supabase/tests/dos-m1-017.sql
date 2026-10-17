begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
create function pg_temp.id(n integer)returns uuid language sql immutable as $$select('d1700000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid$$;
insert into auth.users(id,email,email_confirmed_at)select pg_temp.id(n),'synthetic-audit-'||n||'@example.test',now()from generate_series(1,4)n;
insert into auth.sessions(id,user_id)select pg_temp.id(n+10),pg_temp.id(n)from generate_series(1,4)n;
insert into public.doctor_profiles(user_id,display_name)values(pg_temp.id(1),'Synthetic doctor A'),(pg_temp.id(2),'Synthetic doctor B');
insert into public.practices(id,owner_user_id,name)values(pg_temp.id(21),pg_temp.id(1),'Synthetic practice A'),(pg_temp.id(22),pg_temp.id(2),'Synthetic practice B');
insert into public.locations(id,practice_id,name,timezone)values(pg_temp.id(31),pg_temp.id(21),'Synthetic A1','Etc/UTC'),(pg_temp.id(32),pg_temp.id(21),'Synthetic A2','Etc/UTC'),(pg_temp.id(33),pg_temp.id(22),'Synthetic B1','Etc/UTC');
insert into public.memberships(id,practice_id,user_id,capabilities)values(pg_temp.id(41),pg_temp.id(21),pg_temp.id(3),array['audit.read','patients.read','documents.read','appointments.read']), (pg_temp.id(42),pg_temp.id(22),pg_temp.id(3),array['audit.read','patients.read']);
insert into public.membership_locations(practice_id,membership_id,location_id,capabilities)values(pg_temp.id(21),pg_temp.id(41),pg_temp.id(31),array['audit.read','patients.read']), (pg_temp.id(21),pg_temp.id(41),pg_temp.id(32),array['patients.read']), (pg_temp.id(22),pg_temp.id(42),pg_temp.id(33),array['audit.read','patients.read']);
create function pg_temp.claim(n integer)returns text language sql as $$select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.id(n),'session_id',pg_temp.id(n+10),'role','authenticated','user_metadata',jsonb_build_object('role','owner'))::text,true)$$;
create function pg_temp.audit(practice integer default 21,location integer default null,query text default '',page integer default 0)returns jsonb language sql as $$select public.doctor_administrative_audit(pg_temp.id(practice),case when location is null then null else pg_temp.id(location)end,query,page)$$;
-- Representative attributed event payloads include deliberately forbidden test
-- sentinels, proving the public projection never serializes details.
insert into public.audit_events(practice_id,actor_user_id,event_type,entity_id,details)
select pg_temp.id(21),pg_temp.id(1),'patient.created',pg_temp.id(200+n),jsonb_build_object('location_id',pg_temp.id(31),'sentinel','DO_NOT_EXPOSE_SYNTHETIC_PAYLOAD')from generate_series(1,25)n;
insert into public.audit_events(practice_id,actor_user_id,event_type,entity_id,details)values
(pg_temp.id(21),pg_temp.id(1),'patient.archived',pg_temp.id(230),jsonb_build_object('location_id',pg_temp.id(32))),
(pg_temp.id(22),pg_temp.id(2),'patient.created',pg_temp.id(231),jsonb_build_object('location_id',pg_temp.id(33))),
(pg_temp.id(21),pg_temp.id(1),'secretary.invited',pg_temp.id(232),jsonb_build_object('grants',jsonb_build_array(jsonb_build_object('location_id',pg_temp.id(31))))),
(pg_temp.id(21),pg_temp.id(1),'secretary.grants_changed',pg_temp.id(233),'{}'),
(pg_temp.id(21),pg_temp.id(1),'document.download_requested',pg_temp.id(234),jsonb_build_object('location_id',pg_temp.id(31),'object_path','PRIVATE_OBJECT_SENTINEL')),
(pg_temp.id(21),pg_temp.id(1),'appointment.rescheduled',pg_temp.id(235),jsonb_build_object('from_location_id',pg_temp.id(31),'to_location_id',pg_temp.id(32),'reason','PRIVATE_REASON_SENTINEL')),
(pg_temp.id(21),pg_temp.id(1),'secretary.status_changed',pg_temp.id(41),jsonb_build_object('from','active','to','suspended')),
(pg_temp.id(21),pg_temp.id(1),'clinical.signed',pg_temp.id(237),'{}');
set local role authenticated;select pg_temp.claim(1);
select is(pg_temp.audit()->>'total','31','C01 owner sees all administrative events, excluding future clinical events');
select is(jsonb_typeof(pg_temp.audit()->'items'->0->'id'),'string','audit bigint identities are serialized losslessly as text');
select is(jsonb_array_length(pg_temp.audit()->'items'),20,'C04 first audit page is bounded');
select is(jsonb_array_length(pg_temp.audit(21,null,'',1)->'items'),11,'C04 later page preserves full population count');
select is(pg_temp.audit(21,null,'document.download_requested')->>'total','1','C01 document access is labeled as request, not asserted delivery');
select is(pg_temp.audit(21,null,'secretary.')->>'total','3','C01 invitations, grants and status changes remain represented');
select is(pg_temp.audit(21,null,'PRIVATE_OBJECT_SENTINEL')->>'total','0','C04 search cannot probe private object paths');
select ok(pg_temp.audit()::text not like '%SENTINEL%','C04 private details do not enter audit projection');
select is((select count(*)::integer from jsonb_object_keys(pg_temp.audit()->'items'->0)),5,'C04 projection has only five allowlisted event fields');
select is(pg_temp.audit(21,null,'%')->>'total','0','wildcards are literal search text');
select throws_ok($$select pg_temp.audit(22)$$,'42501','DOCTOR_ACCESS_DENIED','C02 foreign practice query denied');
select throws_ok($$select pg_temp.audit(21,33)$$,'42501','DOCTOR_ACCESS_DENIED','foreign clinic cannot be substituted');
select throws_ok($$select pg_temp.audit(21,null,'',-1)$$,'22023','DOCTOR_AUDIT_QUERY_INVALID','negative pages denied');
select throws_ok($$select pg_temp.audit(21,null,repeat('x',121))$$,'22023','DOCTOR_AUDIT_QUERY_INVALID','unbounded searches denied');
select throws_ok($$update public.audit_events set details='{}'$$,'42501',null,'C02 client cannot rewrite audit');
select throws_ok($$delete from public.audit_events$$,'42501',null,'C02 client cannot erase audit');
select pg_temp.claim(3);
select is(pg_temp.audit(21,31)->>'total','25','C04 delegated audit grant includes only permitted source domain and clinic');
select is((select count(*)::integer from public.audit_events),0,'C04 delegated audit grant never exposes raw event payloads');
select throws_ok($$select pg_temp.audit(21,32)$$,'42501','DOCTOR_ACCESS_DENIED','audit cannot borrow grant from another clinic');
select throws_ok($$select pg_temp.audit()$$,'42501','DOCTOR_ACCESS_DENIED','secretary cannot request whole-practice audit');
select is(pg_temp.audit(22,33)->>'total','1','independent B audit grant works');
select is(pg_temp.audit(21,31,'document.')->>'total','0','document events require independent documents read');
reset role;
update public.membership_locations set capabilities=array['audit.read','patients.read','documents.read','appointments.read']where membership_id=pg_temp.id(41)and location_id=pg_temp.id(31);
set local role authenticated;select pg_temp.claim(3);
select is(pg_temp.audit(21,31,'document.')->>'total','1','C01 permitted document request history becomes visible');
select is(pg_temp.audit(21,31,'appointment.')->>'total','0','cross-clinic event requires every represented clinic grant');
reset role;update public.membership_locations set capabilities=array['audit.read','patients.read','appointments.read']where membership_id=pg_temp.id(41)and location_id=pg_temp.id(32);
set local role authenticated;select pg_temp.claim(3);
select is(pg_temp.audit(21,31,'appointment.')->>'total','1','both independently granted clinics admit the cross-clinic event');
select is(pg_temp.audit(21,31,'secretary.')->>'total','0','practice-wide permission history remains owner-only');
select is(public.doctor_personal_account_audit()->>'total','0','personal audit starts empty and cannot include another account');
select public.doctor_update_account_settings('Synthetic secretary','',true,0,pg_temp.id(301));
select is(public.doctor_personal_account_audit()->>'total','1','C01 own account changes have an attributed self-only audit');
select is(public.doctor_personal_account_audit('Synthetic secretary')->>'total','0','personal names are neither exposed nor searchable');
select pg_temp.claim(1);
select is(public.doctor_personal_account_audit()->>'total','0','practice owner cannot read secretary personal activity');
reset role;update public.memberships set status='revoked',version=version+1 where id=pg_temp.id(41);
set local role authenticated;select pg_temp.claim(3);
select throws_ok($$select pg_temp.audit(21,31)$$,'42501','DOCTOR_ACCESS_DENIED','same SID loses revoked A audit');
select is(pg_temp.audit(22,33)->>'total','1','revocation leaves independent B usable');
select is(public.doctor_personal_account_audit()->>'total','1','membership revocation does not impersonate personal-account revocation');
reset role;update public.locations set archived_at=now()where id=pg_temp.id(32);
set local role authenticated;select pg_temp.claim(1);
select is(pg_temp.audit(21,null,'patient.archived')->>'total','1','owner retains archival activity after clinic archive');
select pg_temp.claim(4);
select throws_ok($$select pg_temp.audit()$$,'42501','DOCTOR_ACCESS_DENIED','editable owner metadata does not grant authority');
reset role;delete from auth.sessions where id=pg_temp.id(13);
set local role authenticated;select pg_temp.claim(3);
select throws_ok($$select public.doctor_personal_account_audit()$$,'42501','DOCTOR_AUTH_REQUIRED','revoked provider SID loses personal audit');
select throws_ok($$select pg_temp.audit(22,33)$$,'42501','DOCTOR_AUTH_REQUIRED','revoked provider SID loses independent practice audit');
reset role;
create temporary table actual_audit_commands(label text primary key,result jsonb);
grant select,insert on actual_audit_commands to authenticated;
set local role authenticated;select pg_temp.claim(1);
insert into actual_audit_commands values('patient',public.doctor_write_patient(pg_temp.id(21),pg_temp.id(31),'{"name":"Synthetic audit command","phone":"","email":"","date_of_birth":null}',pg_temp.id(401)));
select public.doctor_write_patient(pg_temp.id(21),pg_temp.id(31),'{"name":"Synthetic audit corrected","phone":"","email":"","date_of_birth":null}',pg_temp.id(402),(select(result->>'patient_id')::uuid from actual_audit_commands where label='patient'),1);
select public.doctor_archive_patient(pg_temp.id(21),pg_temp.id(31),(select(result->>'patient_id')::uuid from actual_audit_commands where label='patient'),2,pg_temp.id(403));
select is(pg_temp.audit(21,null,(select result->>'patient_id'from actual_audit_commands where label='patient'))->>'total','3','C01 actual patient create/correction/archive reconcile to three visible events');
select ok(not exists(select 1 from jsonb_array_elements(pg_temp.audit(21,null,(select result->>'patient_id'from actual_audit_commands where label='patient'))->'items')r where r->>'actor_user_id'<>pg_temp.id(1)::text),'C01 actual write events retain verified actor attribution');
insert into actual_audit_commands values('location',public.doctor_write_location(pg_temp.id(21),'Synthetic audit location','Etc/UTC','','',pg_temp.id(404)));
select public.doctor_write_location(pg_temp.id(21),'Synthetic audit revised','Etc/UTC','','',pg_temp.id(405),(select(result->>'location_id')::uuid from actual_audit_commands where label='location'),1);
select public.doctor_archive_location(pg_temp.id(21),(select(result->>'location_id')::uuid from actual_audit_commands where label='location'),2,pg_temp.id(406));
select is(pg_temp.audit(21,null,(select result->>'location_id'from actual_audit_commands where label='location'))->>'total','3','C01 actual location create/edit/archive history remains visible');
insert into actual_audit_commands values('invitation',public.doctor_invite_secretary(pg_temp.id(21),'synthetic-audit-4@example.test',encode(sha256(decode(repeat('c',64),'hex')),'hex'),jsonb_build_array(jsonb_build_object('location_id',pg_temp.id(31),'capabilities',jsonb_build_array('audit.read','patients.read'))),pg_temp.id(407)));
select is(pg_temp.audit(21,null,(select result->>'invitation_id'from actual_audit_commands where label='invitation'))->>'total','1','C01 actual invitation intent is visible without its recipient or token');
reset role;
insert into public.audit_events(id,practice_id,actor_user_id,event_type,entity_id)overriding system value values(9223372036854775807,pg_temp.id(21),pg_temp.id(1),'practice.profile_updated',pg_temp.id(999));
set local role authenticated;select pg_temp.claim(1);
select is(pg_temp.audit(21,null,pg_temp.id(999)::text)->'items'->0->>'id','9223372036854775807','largest audit ID remains exact beyond JavaScript numeric precision');
reset role;set local role anon;
select throws_ok($$select pg_temp.audit()$$,'42501',null,'anonymous audit denied');
reset role;
select * from finish();rollback;
