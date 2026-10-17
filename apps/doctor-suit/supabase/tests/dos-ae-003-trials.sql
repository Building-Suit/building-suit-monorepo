begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
set local timezone='America/New_York';
select no_plan();
create function pg_temp.id(n integer)returns uuid language sql immutable as $$select('ae060000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid$$;
insert into auth.users(id,email,email_confirmed_at)select pg_temp.id(n),'synthetic-trial-'||n||'@example.test',now()from generate_series(1,6)n;
insert into auth.sessions(id,user_id)select pg_temp.id(n+10),pg_temp.id(n)from generate_series(1,6)n;
insert into public.doctor_candidate_admissions(user_id,purpose,evidence_ref,valid_until)select pg_temp.id(n),'synthetic_fixture','disposable-sql:saas-trials',clock_timestamp()+interval'2 hours'from generate_series(1,6)n;
insert into public.doctor_profiles(user_id,display_name)values(pg_temp.id(2),'Synthetic trial owner B'),(pg_temp.id(4),'Synthetic historical owner');
insert into public.practices(id,owner_user_id,name)values(pg_temp.id(21),pg_temp.id(2),'Synthetic trial B'),(pg_temp.id(22),pg_temp.id(4),'Synthetic historical practice');
insert into public.memberships(id,practice_id,user_id,capabilities)values(pg_temp.id(41),pg_temp.id(21),pg_temp.id(3),array['patients.read']);
create function pg_temp.claim(n integer)returns text language sql as $$select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.id(n),'session_id',pg_temp.id(n+10),'role','authenticated','user_metadata',jsonb_build_object('role','owner','paid',true,'trial_days',9999))::text,true)$$;
update public.doctor_edition_policy set mode='administrative_candidate',revision=2,change_reason='Synthetic trial verification';
select is((select count(*)::integer from public.doctor_saas_accounts),0,'migration subscribes no owner or staff automatically');
select ok(not has_table_privilege('authenticated','public.doctor_saas_periods','INSERT'),'browser cannot mint a trial or paid period');
select ok(not has_table_privilege('service_role','public.doctor_saas_accounts','UPDATE'),'service key cannot rewrite subscriber state');
select ok(not has_function_privilege('authenticated','doctor_private.saas_account_state(uuid)','EXECUTE'),'internal subscriber lookup is not a cross-owner query');
select ok(not has_function_privilege('anon','public.doctor_start_saas_trial(uuid,integer,text,uuid)','EXECUTE'),'anonymous actor cannot start a trial');
set local role authenticated;select pg_temp.claim(1);
select is(public.doctor_saas_status()->>'state','unconfigured','status read does not infer a trial from browser metadata');
select is(public.doctor_saas_status()->>'revision','0','no account has no fabricated subscription revision');
select throws_ok($$select public.doctor_start_saas_trial(pg_temp.id(51),1,'synthetic-trials/v1',pg_temp.id(71))$$,'DS001','DOCTOR_SAAS_TERMS_UNCONFIGURED','unconfigured offer cannot allocate a trial');
reset role;
-- Choose a positive synthetic duration crossing the next NY offset transition.
-- This catches connection-timezone/DST drift without depending on today's season.
select set_config('test.saas_trial_days',(select min(n)::text from generate_series(1,370)n where extract(timezone from clock_timestamp()+pg_catalog.make_interval(hours=>n*24))<>extract(timezone from clock_timestamp())),true);
insert into public.doctor_saas_terms_versions(id,plan_key,version,status,currency,currency_exponent,monthly_minor,trial_days,staff_limit,staff_unlimited,clinic_limit,clinic_unlimited,over_limit_policy,renewal_policy,grace_days,expiry_policy,cancellation_policy,refund_policy,terms_document_ref,commercial_approval_ref,legal_approval_ref)
values(pg_temp.id(51),'synthetic-trials',1,'approved','USD',2,1234,current_setting('test.saas_trial_days')::integer,1,false,1,false,'block_new_allocation','manual',0,'historical_read_only','period_end','manual_review','synthetic-trials/v1','SYNTHETIC_FIXTURE_COMMERCIAL','SYNTHETIC_FIXTURE_LEGAL'),
(pg_temp.id(52),'synthetic-trials',2,'approved','USD',2,2345,0,1,false,1,false,'block_new_allocation','manual',0,'historical_read_only','period_end','manual_review','synthetic-trials/v2','SYNTHETIC_FIXTURE_COMMERCIAL','SYNTHETIC_FIXTURE_LEGAL');
update public.doctor_saas_configuration set terms_version_id=pg_temp.id(51),revision=2,change_reason='Synthetic trial offer';
set local role authenticated;select pg_temp.claim(1);
select throws_ok($$select public.doctor_start_saas_trial(pg_temp.id(51),1,'synthetic-trials/v1',pg_temp.id(71))$$,'40001','DOCTOR_SAAS_TERMS_CONFLICT','stale configuration cannot start a trial');
select throws_ok($$select public.doctor_start_saas_trial(pg_temp.id(52),2,'synthetic-trials/v2',pg_temp.id(71))$$,'40001','DOCTOR_SAAS_TERMS_CONFLICT','browser cannot choose a different plan than the trusted pointer');
select throws_ok($$select public.doctor_start_saas_trial(pg_temp.id(51),2,'synthetic-wrong/version',pg_temp.id(71))$$,'22023','DOCTOR_SAAS_TERMS_ACCEPTANCE_REQUIRED','document version is explicit and exact');
select lives_ok($$select public.doctor_start_saas_trial(pg_temp.id(51),2,'synthetic-trials/v1',pg_temp.id(71))$$,'explicit prospective Doctor may start before clinic setup');
select is(public.doctor_saas_status()->'practice_id','null'::jsonb,'trial allocation does not invent a practice or ownership');
select is(public.doctor_saas_status()->>'state','trial','status comes from the trusted immutable period');
select is(public.doctor_saas_status()->>'period_active','true','current trial has a current period, independently of paid activation');
select is(public.doctor_saas_status()->>'paid_activation_available','false','trial cannot self-activate paid access');
select set_config('test.saas_original_end',public.doctor_saas_status()#>>'{period,ends_at}',true);
select is(public.doctor_start_saas_trial(pg_temp.id(51),2,'synthetic-trials/v1',pg_temp.id(71))->>'period_id',public.doctor_saas_status()#>>'{period,id}','exact retry returns the original period');
select throws_ok($$select public.doctor_start_saas_trial(pg_temp.id(51),2,'synthetic-trials/v1',pg_temp.id(72))$$,'DS004','DOCTOR_SAAS_TRIAL_ALREADY_USED','new key cannot reset the trial');
select throws_ok($$select public.doctor_start_saas_trial(pg_temp.id(51),2,'synthetic-other/version',pg_temp.id(71))$$,'22023','DOCTOR_IDEMPOTENCY_CONFLICT','reused key cannot change the accepted contract');
select throws_ok($$select doctor_private.saas_account_state(pg_temp.id(2))$$,'42501',null,'client cannot inspect another subscriber through the private helper');
select pg_temp.claim(3);
select throws_ok($$select public.doctor_start_saas_trial(pg_temp.id(51),2,'synthetic-trials/v1',pg_temp.id(71))$$,'42501','DOCTOR_OWNER_ENROLLMENT_REQUIRED','independent staff is not promoted into a subscriber');
select throws_ok($$select public.doctor_saas_status()$$,'42501','DOCTOR_OWNER_ENROLLMENT_REQUIRED','staff status read does not create an account');
reset role;
select is((select count(*)::integer from public.doctor_saas_periods where subscriber_user_id=pg_temp.id(1)),1,'only one immutable trial period exists');
select is((select count(*)::integer from public.doctor_saas_period_events where subscriber_user_id=pg_temp.id(1)),1,'retries append no duplicate activation event');
select is((select extract(epoch from ends_at-started_at)from public.doctor_saas_periods where subscriber_user_id=pg_temp.id(1)),current_setting('test.saas_trial_days')::numeric*86400,'trial days are exact UTC days across a connection DST transition');
select throws_ok($$update public.doctor_saas_periods set ends_at=ends_at+interval'1 day'where subscriber_user_id=pg_temp.id(1)$$,'42501','DOCTOR_SAAS_HISTORY_IMMUTABLE','operator cannot rewrite a period to reset its trial');
select throws_ok($$delete from public.doctor_saas_accounts where subscriber_user_id=pg_temp.id(1)$$,'42501','DOCTOR_SAAS_HISTORY_IMMUTABLE','deleting the account cannot reset historical usage');
select throws_ok($$update public.doctor_saas_accounts set state='suspended',reason_code='operator_hold'where subscriber_user_id=pg_temp.id(1)$$,'40001','DOCTOR_SAAS_ACCOUNT_CONFLICT','account changes require current revision');
update public.doctor_saas_accounts set state='suspended',revision=2,reason_code='operator_hold'where subscriber_user_id=pg_temp.id(1);
set local role authenticated;select pg_temp.claim(1);
select is(public.doctor_saas_status()->>'state','suspended','operator hold is current trusted state');
select is((public.doctor_saas_status()#>>'{period,ends_at}')::timestamptz,current_setting('test.saas_original_end')::timestamptz,'hold preserves the originally granted period end');
reset role;
update public.doctor_saas_accounts set state='enabled',revision=3,reason_code='operator_resume'where subscriber_user_id=pg_temp.id(1);
update public.doctor_saas_configuration set terms_version_id=pg_temp.id(52),revision=3,change_reason='Synthetic offer replacement';
set local role authenticated;select pg_temp.claim(1);
select is(public.doctor_saas_status()->'terms'->>'terms_id',pg_temp.id(51)::text,'subscriber retains the original approved terms snapshot');
select is(public.doctor_saas_terms()->'terms'->>'terms_id',pg_temp.id(52)::text,'new offers are separate from an existing subscribed snapshot');
select is((public.doctor_saas_status()#>>'{period,ends_at}')::timestamptz,current_setting('test.saas_original_end')::timestamptz,'resume and new offer cannot extend or reset the old trial');
select is(public.doctor_start_saas_trial(pg_temp.id(51),2,'synthetic-trials/v1',pg_temp.id(71))->>'period_id',public.doctor_saas_status()#>>'{period,id}','original uncertain response remains safely replayable after offer replacement');
select pg_temp.claim(5);
select throws_ok($$select public.doctor_start_saas_trial(pg_temp.id(52),3,'synthetic-trials/v2',pg_temp.id(71))$$,'DS005','DOCTOR_SAAS_TRIAL_UNAVAILABLE','explicit no-trial terms do not become an implicit free period');
reset role;
with moment as(select clock_timestamp()at time zone'UTC'as stamp),days as(select trial_days from public.doctor_saas_terms_versions where id=pg_temp.id(51))
insert into public.doctor_saas_periods(id,subscriber_user_id,terms_version_id,kind,started_at,ends_at,accepted_document_ref)
select pg_temp.id(64),pg_temp.id(4),pg_temp.id(51),'trial',(stamp-interval'1 day'-make_interval(days=>trial_days))at time zone'UTC',(stamp-interval'1 day')at time zone'UTC','synthetic-trials/v1'from moment,days
union all
select pg_temp.id(66),pg_temp.id(6),pg_temp.id(51),'trial',(stamp+interval'1 day')at time zone'UTC',(stamp+interval'1 day'+make_interval(days=>trial_days))at time zone'UTC','synthetic-trials/v1'from moment,days;
insert into public.doctor_saas_accounts(subscriber_user_id,current_period_id,state,reason_code)values(pg_temp.id(4),pg_temp.id(64),'enabled','trial_started'),(pg_temp.id(6),pg_temp.id(66),'enabled','trial_started');
set local role authenticated;select pg_temp.claim(4);
select is(public.doctor_saas_status()->>'state','expired','expiry is derived from original timestamps without deleting history');
select is(public.doctor_saas_status()->>'period_active','false','expired periods do not appear active');
select ok(public.doctor_saas_status()->'period'->>'id'=pg_temp.id(64)::text,'expired subscriber can read their original period');
select throws_ok($$select public.doctor_start_saas_trial(pg_temp.id(52),3,'synthetic-trials/v2',pg_temp.id(71))$$,'DS004','DOCTOR_SAAS_TRIAL_ALREADY_USED','expiry never resets trial eligibility');
select pg_temp.claim(6);
select is(public.doctor_saas_status()->>'state','scheduled','future timestamps cannot grant an early active period');
select is(public.doctor_saas_status()->>'period_active','false','future period stays inactive');
reset role;
select throws_ok($$update public.doctor_saas_accounts set current_period_id=pg_temp.id(64),revision=4,reason_code='period_transition'where subscriber_user_id=pg_temp.id(1)$$,'23503',null,'composite identity key prevents a foreign period assignment');
select throws_ok($$insert into public.doctor_saas_periods(subscriber_user_id,terms_version_id,kind,started_at,ends_at,accepted_document_ref)values(pg_temp.id(2),pg_temp.id(51),'paid',clock_timestamp(),clock_timestamp()+interval'1 day','synthetic-trials/v1')$$,'22023','DOCTOR_SAAS_PERIOD_INVALID','paid periods have no unverified activation path');
select throws_ok($$delete from public.doctor_saas_period_events$$,'42501','DOCTOR_SAAS_HISTORY_IMMUTABLE','financial-state history cannot be erased');
insert into public.doctor_saas_terms_versions(id,plan_key,version,status,currency,currency_exponent,monthly_minor,trial_days,staff_limit,staff_unlimited,clinic_limit,clinic_unlimited,over_limit_policy,renewal_policy,grace_days,expiry_policy,cancellation_policy,refund_policy,terms_document_ref,commercial_approval_ref,legal_approval_ref)
select pg_temp.id(53),'synthetic-trials',3,'approved',currency,currency_exponent,monthly_minor,10000000,staff_limit,staff_unlimited,clinic_limit,clinic_unlimited,over_limit_policy,renewal_policy,grace_days,expiry_policy,cancellation_policy,refund_policy,'synthetic-trials/v3',commercial_approval_ref,legal_approval_ref from public.doctor_saas_terms_versions where id=pg_temp.id(52);
update public.doctor_saas_configuration set terms_version_id=pg_temp.id(53),revision=4,change_reason='Synthetic unsupported transport date';
set local role authenticated;select pg_temp.claim(5);
select throws_ok($$select public.doctor_start_saas_trial(pg_temp.id(53),4,'synthetic-trials/v3',pg_temp.id(73))$$,'22023','DOCTOR_SAAS_PERIOD_INVALID','unsupported transport dates fail atomically instead of starting an unreadable period');
reset role;
select is((select count(*)::integer from public.doctor_saas_accounts where subscriber_user_id in(pg_temp.id(3),pg_temp.id(5))),0,'staff and no-trial requests create no subscriber account');
select * from finish();rollback;
