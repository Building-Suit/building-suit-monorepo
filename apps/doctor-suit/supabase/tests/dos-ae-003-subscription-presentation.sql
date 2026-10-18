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

insert into auth.users(id,email,email_confirmed_at)values(pg_temp.id(6),'synthetic-subscription-new-owner@example.test',now());
insert into auth.sessions(id,user_id)values(pg_temp.id(16),pg_temp.id(6));
insert into public.doctor_candidate_admissions(id,user_id,purpose,evidence_ref,valid_until)values(pg_temp.id(46),pg_temp.id(6),'synthetic_fixture','disposable-subscription-owner',clock_timestamp()+interval'2 hours');
update public.doctor_edition_policy set mode='administrative_candidate',revision=2,change_reason='Owned subscription presentation acceptance';
set local role authenticated;
select pg_temp.claim(1);
select is(public.doctor_saas_status()->>'state','trial','owner 1 retains computed subscription state');
select is(public.doctor_saas_status()->>'business_writes_allowed','true','owner 1 receives current business availability');
select is(public.doctor_practice_setup()->>'subscription_required','false','owner 1 setup follows subscription authority');
select ok((public.doctor_saas_status()->>'observed_at')::timestamptz<=clock_timestamp(),'status observation comes from database clock');
select pg_temp.claim(2);
select is(public.doctor_saas_status()->>'state','trial','owner 2 retains computed subscription state');
select is(public.doctor_saas_status()->>'business_writes_allowed','false','owner 2 receives current business availability');
select is(public.doctor_practice_setup()->>'subscription_required','true','owner 2 setup follows subscription authority');
select ok((public.doctor_saas_status()->>'observed_at')::timestamptz<=clock_timestamp(),'status observation comes from database clock');
select pg_temp.claim(3);
select is(public.doctor_saas_status()->>'state','unconfigured','owner 3 retains computed subscription state');
select is(public.doctor_saas_status()->>'business_writes_allowed','false','owner 3 receives current business availability');
select is(public.doctor_practice_setup()->>'subscription_required','true','owner 3 setup follows subscription authority');
select ok((public.doctor_saas_status()->>'observed_at')::timestamptz<=clock_timestamp(),'status observation comes from database clock');
select pg_temp.claim(5);
select is(public.doctor_saas_status()->>'state','expired','owner 5 retains computed subscription state');
select is(public.doctor_saas_status()->>'business_writes_allowed','false','owner 5 receives current business availability');
select is(public.doctor_practice_setup()->>'subscription_required','true','owner 5 setup follows subscription authority');
select ok((public.doctor_saas_status()->>'observed_at')::timestamptz<=clock_timestamp(),'status observation comes from database clock');
select pg_temp.claim(4);
select throws_ok($$select public.doctor_saas_status()$$,'42501','DOCTOR_OWNER_ENROLLMENT_REQUIRED','active staff cannot become an owner through subscription UI');
select pg_temp.claim(6);
select is(public.doctor_practice_setup()->>'subscription_required','true','new admitted owner needs a bound period before practice setup');
select is(public.doctor_saas_status()->>'business_writes_allowed','false','new unconfigured owner has no invented writes');
reset role;
update public.doctor_saas_configuration set terms_version_id=pg_temp.id(81),revision=4,change_reason='Explicit synthetic current trial offer';
set local role authenticated;select pg_temp.claim(6);
select lives_ok($$select public.doctor_start_saas_trial(pg_temp.id(81),4,'synthetic-context/v1',pg_temp.id(96))$$,'new owner can explicitly accept configured trial before onboarding');
select is(public.doctor_practice_setup()->>'subscription_required','false','accepted trial permits initial setup under configured clinic allowance');
select is(public.doctor_saas_status()->>'business_writes_allowed','true','fresh status confirms initial setup availability');
select is(public.doctor_saas_status()->>'paid_activation_available','false','synthetic trial does not enable paid activation');
select is(public.doctor_saas_status()->>'live_activation','false','synthetic trial does not enable live activation');
reset role;
select is((select count(*)::integer from public.practices where owner_user_id=pg_temp.id(6)),0,'trial start never creates a practice');
select is((select count(*)::integer from public.doctor_profiles where user_id=pg_temp.id(6)),0,'trial start grants no professional profile or verification');
select * from finish();rollback;
