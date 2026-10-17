begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
create function pg_temp.id(n integer)returns uuid language sql immutable as $$select('ae170000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid$$;
create function pg_temp.claim(n integer)returns text language sql as $$select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.id(n),'session_id',pg_temp.id(n+10),'role','authenticated','user_metadata',jsonb_build_object('paid',true,'unlimited',true))::text,true)$$;
create function pg_temp.context(practice integer,location integer)returns jsonb language sql as $$select row from jsonb_array_elements(public.doctor_contexts())row where row->>'practice_id'=pg_temp.id(practice)::text and row->>'location_id'=pg_temp.id(location)::text$$;
insert into auth.users(id,email,email_confirmed_at)select pg_temp.id(n),'synthetic-context-'||n||'@example.test',now()from generate_series(1,5)n;
insert into auth.sessions(id,user_id)select pg_temp.id(n+10),pg_temp.id(n)from generate_series(1,5)n;
insert into public.doctor_candidate_admissions(id,user_id,purpose,evidence_ref,valid_until)select pg_temp.id(n+40),pg_temp.id(n),'synthetic_fixture','disposable-context:'||n,clock_timestamp()+interval'2 hours'from generate_series(1,5)n;
insert into public.doctor_profiles(user_id,display_name)select pg_temp.id(n),'Synthetic owner '||n from unnest(array[1,2,3,5])n;
insert into public.practices(id,owner_user_id,name)select pg_temp.id(n+20),pg_temp.id(n),'Synthetic practice '||n from unnest(array[1,2,3,5])n;
insert into public.locations(id,practice_id,name,timezone)values
 (pg_temp.id(31),pg_temp.id(21),'Synthetic A1','Etc/UTC'),(pg_temp.id(32),pg_temp.id(21),'Synthetic A2','Etc/UTC'),
 (pg_temp.id(33),pg_temp.id(22),'Synthetic B1','Etc/UTC'),(pg_temp.id(34),pg_temp.id(23),'Synthetic unconfigured clinic','Etc/UTC'),(pg_temp.id(35),pg_temp.id(25),'Synthetic expired clinic','Etc/UTC');
insert into public.memberships(id,practice_id,user_id,capabilities)values
 (pg_temp.id(61),pg_temp.id(21),pg_temp.id(4),array['patients.read','patients.write']),
 (pg_temp.id(62),pg_temp.id(22),pg_temp.id(4),array['patients.read','patients.write']);
insert into public.membership_locations(practice_id,membership_id,location_id)values
 (pg_temp.id(21),pg_temp.id(61),pg_temp.id(31)),(pg_temp.id(21),pg_temp.id(61),pg_temp.id(32)),(pg_temp.id(22),pg_temp.id(62),pg_temp.id(33));
insert into public.doctor_saas_terms_versions(id,plan_key,version,status,currency,currency_exponent,monthly_minor,trial_days,staff_limit,staff_unlimited,clinic_limit,clinic_unlimited,over_limit_policy,renewal_policy,grace_days,expiry_policy,cancellation_policy,refund_policy,terms_document_ref,commercial_approval_ref,legal_approval_ref)values
 (pg_temp.id(81),'synthetic-context',1,'approved','USD',2,1234,2,2,false,3,false,'block_new_allocation','manual',0,'historical_read_only','period_end','manual_review','synthetic-context/v1','SYNTHETIC_PRIVATE_COMMERCIAL','SYNTHETIC_PRIVATE_LEGAL'),
 (pg_temp.id(82),'synthetic-context',2,'approved','USD',2,1234,2,1,false,0,false,'read_only_until_within_limit','manual',0,'historical_read_only','period_end','manual_review','synthetic-context/v2','SYNTHETIC_PRIVATE_COMMERCIAL','SYNTHETIC_PRIVATE_LEGAL');
update public.doctor_saas_configuration set terms_version_id=pg_temp.id(81),revision=2,change_reason='Synthetic context normal allowance';
set local role authenticated;select pg_temp.claim(1);select public.doctor_start_saas_trial(pg_temp.id(81),2,'synthetic-context/v1',pg_temp.id(91));reset role;
update public.doctor_saas_configuration set terms_version_id=pg_temp.id(82),revision=3,change_reason='Synthetic context read-only allowance';
set local role authenticated;select pg_temp.claim(2);select public.doctor_start_saas_trial(pg_temp.id(82),3,'synthetic-context/v2',pg_temp.id(92));reset role;
with stamp as(select clock_timestamp()at time zone'UTC'as ending)
insert into public.doctor_saas_periods(id,subscriber_user_id,terms_version_id,kind,started_at,ends_at,accepted_document_ref)
 select pg_temp.id(83),pg_temp.id(5),pg_temp.id(81),'trial',(ending-interval'3 days')at time zone'UTC',(ending-interval'1 day')at time zone'UTC','synthetic-context/v1'from stamp;
insert into public.doctor_saas_accounts(subscriber_user_id,current_period_id,state,reason_code)values(pg_temp.id(5),pg_temp.id(83),'enabled','trial_started');
insert into public.doctor_saas_period_events(subscriber_user_id,revision,period_id,reason_code,next_state)values(pg_temp.id(5),1,pg_temp.id(83),'trial_started','enabled');


update public.doctor_edition_policy set mode='administrative_candidate',revision=2,change_reason='Owned version document acceptance';
set local role authenticated;select pg_temp.claim(1);
select is(public.doctor_saas_terms_document(pg_temp.id(81)),null::jsonb,'missing document is explicitly unavailable');
reset role;
insert into public.doctor_saas_terms_documents(terms_version_id,document_ref,content_en,content_ar)values
 (pg_temp.id(81),'synthetic-context/v1','Synthetic test document only. No live-sale or legal approval.','وثيقة اختبار اصطناعية فقط. لا تمنح موافقة قانونية أو بيعاً حياً.');
select throws_ok($$insert into public.doctor_saas_terms_documents(terms_version_id,document_ref,content_en,content_ar)values(pg_temp.id(82),'synthetic-wrong/v1',repeat('e',30),repeat('a',30))$$,'22023','DOCTOR_SAAS_DOCUMENT_BINDING_INVALID','document reference must match immutable terms');
select throws_ok($$update public.doctor_saas_terms_documents set content_en=repeat('x',30)$$,'42501','DOCTOR_SAAS_HISTORY_IMMUTABLE','published text cannot be rewritten');
select throws_ok($$delete from public.doctor_saas_terms_documents$$,'42501','DOCTOR_SAAS_HISTORY_IMMUTABLE','document history cannot be removed');
select ok(not has_table_privilege('authenticated','public.doctor_saas_terms_documents','select'),'raw document table is not client readable');
select ok(not has_function_privilege('anon','public.doctor_saas_terms_document(uuid)','execute'),'anonymous cannot read document RPC');
select ok(not has_function_privilege('service_role','public.doctor_saas_terms_document(uuid)','execute'),'service client cannot bypass document authorization');
set local role authenticated;select pg_temp.claim(1);
select is(public.doctor_saas_terms_document(pg_temp.id(81))->>'document_ref','synthetic-context/v1','subscriber reads exact accepted version despite current offer change');
select is(public.doctor_saas_terms_document(pg_temp.id(81))->>'content_en','Synthetic test document only. No live-sale or legal approval.','English full text is available');
select is(public.doctor_saas_terms_document(pg_temp.id(81))->>'content_ar','وثيقة اختبار اصطناعية فقط. لا تمنح موافقة قانونية أو بيعاً حياً.','Arabic full text is available');
select throws_ok($$select public.doctor_saas_terms_document(pg_temp.id(99))$$,'42501','DOCTOR_ACCESS_DENIED','unbound non-current document denied');
select pg_temp.claim(5);
select is(public.doctor_saas_terms_document(pg_temp.id(81))->>'document_ref','synthetic-context/v1','expired prior subscriber retains accepted text');
select pg_temp.claim(4);
select throws_ok($$select public.doctor_saas_terms_document(pg_temp.id(81))$$,'42501','DOCTOR_OWNER_ENROLLMENT_REQUIRED','delegated actor cannot read another owner bound document');
reset role;
update public.doctor_saas_configuration set terms_version_id=pg_temp.id(81),revision=4,change_reason='Owned document current offer';
set local role authenticated;select pg_temp.claim(3);
select is(public.doctor_saas_terms_document(pg_temp.id(81))->>'document_ref','synthetic-context/v1','eligible new owner can review configured current version before trial');
reset role;
select * from finish();rollback;
