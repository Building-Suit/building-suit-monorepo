-- Loaded within the caller's rolled-back transaction. No hosted target.
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
create function pg_temp.id(n integer) returns uuid language sql immutable as $$select ('d2020000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid$$;
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) select pg_temp.id(n),'synthetic-clinical-'||n||'@example.test',now(),'{"clinical_signer":true,"role":"owner"}' from generate_series(1,5)n;
insert into auth.sessions(id,user_id) select pg_temp.id(n+10),pg_temp.id(n) from generate_series(1,5)n;
create temporary table evidence(key text primary key,value jsonb);grant all on evidence to authenticated,service_role;
create function pg_temp.put(k text,v jsonb)returns jsonb language sql as $$insert into evidence values(k,v)on conflict(key)do update set value=excluded.value returning value$$;
create function pg_temp.v(k text)returns jsonb language sql stable as $$select value from evidence where key=k$$;
create function pg_temp.claim(n integer)returns text language sql as $$select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.id(n),'session_id',pg_temp.id(n+10),'role','authenticated','user_metadata',jsonb_build_object('clinical_signer',true))::text,true)$$;
create function pg_temp.practice(n integer default 1)returns uuid language sql stable as $$select(pg_temp.v('owner'||n)->>'practice_id')::uuid$$;
create function pg_temp.location(n integer default 1)returns uuid language sql stable as $$select(pg_temp.v('owner'||n)->>'location_id')::uuid$$;
create function pg_temp.patient(n integer default 1)returns uuid language sql stable as $$select(pg_temp.v('patient'||n)->>'patient_id')::uuid$$;
create function pg_temp.onboard(n integer)returns jsonb language plpgsql as $$declare draft jsonb;begin
 draft:=public.doctor_save_onboarding_draft(pg_temp.id(100+n),0,'Synthetic clinician '||n,'Synthetic practice '||n,'Synthetic clinic '||n,'Etc/UTC');
 return public.doctor_complete_onboarding(pg_temp.id(100+n),(draft->>'version')::integer);end$$;
create function pg_temp.snapshot()returns jsonb language sql immutable as $$select '{"intake":[],"note":{"template_id":"synthetic-neutral","template_version":1,"sections":[{"key":"entered_note","text":""},{"key":"review_notes","text":""}]},"prescriptions":[],"orders":[],"results":[]}'::jsonb$$;
create function pg_temp.rx()returns jsonb language sql immutable as $$select jsonb_build_object('id',pg_temp.id(400),'medicine',jsonb_build_object('identity','synthetic-A','label','Synthetic compound A','provenance','synthetic_manual','source_version','manual-synthetic-v1','strength','entered strength','form','entered form'),'dose',jsonb_build_object('amount','1.25','unit','entered unit','route','entered route'),'start_date','2026-10-20','end_date','2026-10-22','instructions','Synthetic instruction only','segments',jsonb_build_array(jsonb_build_object('kind','as_needed','start_date','2026-10-20','end_date','2026-10-22','timezone','Etc/UTC','interval_minutes',null,'weekdays','[]'::jsonb,'times','[]'::jsonb,'instructions','Explicit synthetic instruction')))$$;
create function pg_temp.command(action text,input jsonb,key integer,expected integer default null)returns jsonb language plpgsql as $$declare result jsonb;reviewed jsonb;begin
 if action='finalize' and input='{}'::jsonb then reviewed:=pg_temp.detail()->'versions'->0;input:=jsonb_build_object('reviewed_version_id',reviewed->>'id','reviewed_sha256',reviewed->>'snapshot_sha256');end if;
 result:=public.doctor_clinical_command(pg_temp.practice(),pg_temp.location(),case when action='create' then null else (pg_temp.v('encounter')->>'encounter_id')::uuid end,case when action='create' then null else coalesce(expected,(pg_temp.v('encounter')->>'version')::integer) end,action,input,pg_temp.id(key));
 perform pg_temp.put('encounter',result);return result;end$$;
create function pg_temp.detail()returns jsonb language sql as $$select public.doctor_clinical_detail(pg_temp.practice(),pg_temp.location(),(pg_temp.v('encounter')->>'encounter_id')::uuid)$$;
set local role authenticated;select pg_temp.claim(1);select pg_temp.put('owner1',pg_temp.onboard(1));
select pg_temp.put('patient1',public.doctor_write_patient(p_practice=>pg_temp.practice(),p_location=>pg_temp.location(),p_input=>'{"name":"Synthetic clinical patient A","phone":"","email":"","date_of_birth":null}',p_key=>pg_temp.id(121)));
select pg_temp.claim(2);select pg_temp.put('owner2',pg_temp.onboard(2));
select pg_temp.put('patient2',public.doctor_write_patient(p_practice=>pg_temp.practice(2),p_location=>pg_temp.location(2),p_input=>'{"name":"Synthetic clinical patient B","phone":"","email":"","date_of_birth":null}',p_key=>pg_temp.id(122)));
reset role;
insert into public.memberships(id,practice_id,user_id,capabilities) values(pg_temp.id(201),pg_temp.practice(),pg_temp.id(3),array['patients.read']);
insert into public.membership_locations(practice_id,membership_id,location_id,capabilities) values(pg_temp.practice(),pg_temp.id(201),pg_temp.location(),array['patients.read']);
insert into doctor_private.clinical_fixture_grants(practice_id,location_id,user_id,capabilities,purpose,evidence_ref,policy_version,valid_until)
 values(pg_temp.practice(),pg_temp.location(),pg_temp.id(1),array['read','draft','review','sign','release','export'],'synthetic_fixture','rolled-back-m2-fixture','synthetic-engineering-v1',clock_timestamp()+interval '1 hour'),
 (pg_temp.practice(2),pg_temp.location(2),pg_temp.id(2),array['read','draft','review','sign','release','export'],'synthetic_fixture','rolled-back-m2-fixture','synthetic-engineering-v1',clock_timestamp()+interval '1 hour'),
 (pg_temp.practice(),pg_temp.location(),pg_temp.id(3),array['read','draft'],'synthetic_fixture','rolled-back-m2-fixture','synthetic-engineering-v1',clock_timestamp()+interval '1 hour');
insert into doctor_private.clinical_recipient_grants(practice_id,patient_id,user_id,purpose,valid_until) values(pg_temp.practice(),pg_temp.patient(),pg_temp.id(4),'synthetic_fixture',clock_timestamp()+interval '1 hour');
set local role authenticated;select pg_temp.claim(1);
