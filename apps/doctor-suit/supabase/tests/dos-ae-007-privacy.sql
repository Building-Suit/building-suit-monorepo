begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
create function pg_temp.id(n integer)returns uuid language sql immutable as $$select('ae200000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid$$;
create function pg_temp.claim(n integer)returns text language sql as $$select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.id(n),'session_id',pg_temp.id(n+10),'role','authenticated')::text,true)$$;
insert into auth.users(id,email,email_confirmed_at)select pg_temp.id(n),'synthetic-privacy-'||n||'@example.test',now()from generate_series(1,3)n;
insert into auth.sessions(id,user_id)select pg_temp.id(n+10),pg_temp.id(n)from generate_series(1,3)n;
insert into public.doctor_candidate_admissions(id,user_id,purpose,evidence_ref,valid_until)select pg_temp.id(n+40),pg_temp.id(n),'synthetic_fixture','disposable-privacy:'||n,clock_timestamp()+interval'2 hours'from generate_series(1,2)n;
update public.doctor_edition_policy set mode='administrative_candidate',revision=2,change_reason='Owned privacy request acceptance';
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid='public.doctor_privacy_requests'::regclass),'request records enforce RLS');
select ok(not has_table_privilege('anon','public.doctor_privacy_requests','select'),'anonymous cannot read requests');
select ok(not has_table_privilege('service_role','public.doctor_privacy_requests','select'),'service client cannot read requests');
select ok(not has_function_privilege('anon','public.doctor_submit_privacy_request(text,uuid)','execute'),'anonymous cannot submit requests');
select ok(not has_function_privilege('service_role','public.doctor_submit_privacy_request(text,uuid)','execute'),'service client cannot submit requests');
set local role authenticated;select pg_temp.claim(1);
select is(public.doctor_privacy_requests()->>'scope','own_account','scope is authenticated own account');
select is(public.doctor_privacy_requests()->>'policy_configured','false','intake grants no qualified policy');
select is(public.doctor_privacy_requests()->>'fulfillment_available','false','intake grants no fulfillment');
select is(jsonb_array_length(public.doctor_privacy_requests()->'items'),0,'new actor has no requests');
select lives_ok($$select public.doctor_submit_privacy_request('access_review',pg_temp.id(51))$$,'unconfigured subscription can submit own request');
select lives_ok($$select public.doctor_submit_privacy_request('access_review',pg_temp.id(51))$$,'committed request replay succeeds');
select lives_ok($$select public.doctor_submit_privacy_request('access_review',pg_temp.id(52))$$,'same unresolved kind does not create another record');
select is((select count(*)from public.doctor_privacy_requests),1::bigint,'same kind/key retries keep one immutable record');
select throws_ok($$select public.doctor_submit_privacy_request('erasure_review',pg_temp.id(51))$$,'40001','DOCTOR_PRIVACY_REQUEST_CONFLICT','key cannot change request kind');
select throws_ok($$select public.doctor_submit_privacy_request('patient_export',pg_temp.id(53))$$,'22023','DOCTOR_PRIVACY_REQUEST_INVALID','unsupported patient export rejected');
select throws_ok($$select public.doctor_submit_privacy_request(null,pg_temp.id(53))$$,'22023','DOCTOR_PRIVACY_REQUEST_INVALID','null kind rejected');
select throws_ok($$insert into public.doctor_privacy_requests(user_id,session_id,request_key,kind)values(pg_temp.id(2),pg_temp.id(12),pg_temp.id(53),'access_review')$$,'42501',null,'direct cross-user insert denied');
select throws_ok($$update public.doctor_privacy_requests set state='awaiting_review'$$,'42501',null,'direct rewrite denied');
select pg_temp.claim(2);
select is((select count(*)from public.doctor_privacy_requests),0::bigint,'independent account cannot read other account request');
select is(jsonb_array_length(public.doctor_privacy_requests()->'items'),0,'RPC does not expose another account');
select lives_ok($$select public.doctor_submit_privacy_request('restriction_review',pg_temp.id(51))$$,'keys and requests remain actor-scoped');
reset role;
select is((select count(*)from public.doctor_privacy_requests),2::bigint,'two independent actors have separate receipts');
select is((select count(*)from public.doctor_privacy_requests where user_id=pg_temp.id(1)and session_id=pg_temp.id(11)),1::bigint,'receipt attributes verified actor and session');
select throws_ok($$delete from public.doctor_privacy_requests$$,'42501','DOCTOR_PRIVACY_REQUEST_IMMUTABLE','database delete cannot erase audit');
select throws_ok($$truncate public.doctor_privacy_requests$$,'42501','DOCTOR_PRIVACY_REQUEST_IMMUTABLE','database truncate cannot erase audit');
select is((select count(*)from public.doctor_saas_accounts),0::bigint,'request intake creates no subscription');
select is((select count(*)from public.patient_identities),0::bigint,'request intake performs no patient fulfillment');
set local role authenticated;select pg_temp.claim(3);
select throws_ok($$select public.doctor_privacy_requests()$$,'42501',null,'unadmitted actor cannot read candidate product');
select throws_ok($$select public.doctor_submit_privacy_request('access_review',pg_temp.id(51))$$,'42501',null,'unadmitted actor cannot submit candidate request');
reset role;

insert into public.doctor_saas_terms_versions(id,plan_key,version,status,currency,currency_exponent,monthly_minor,trial_days,staff_limit,staff_unlimited,clinic_limit,clinic_unlimited,over_limit_policy,renewal_policy,grace_days,expiry_policy,cancellation_policy,refund_policy,terms_document_ref,commercial_approval_ref,legal_approval_ref)values
 (pg_temp.id(81),'synthetic-privacy',1,'approved','USD',2,1234,2,2,false,3,false,'block_new_allocation','manual',0,'historical_read_only','period_end','manual_review','synthetic-privacy/v1','SYNTHETIC_PRIVATE_COMMERCIAL','SYNTHETIC_PRIVATE_LEGAL'),
 (pg_temp.id(82),'synthetic-privacy',2,'approved','USD',2,1234,2,1,false,0,false,'read_only_until_within_limit','manual',0,'historical_read_only','period_end','manual_review','synthetic-privacy/v2','SYNTHETIC_PRIVATE_COMMERCIAL','SYNTHETIC_PRIVATE_LEGAL');

with stamp as(select clock_timestamp()as ending)
insert into public.doctor_saas_periods(id,subscriber_user_id,terms_version_id,kind,started_at,ends_at,accepted_document_ref)
 select pg_temp.id(n+80),pg_temp.id(n),pg_temp.id(81),'trial',ending-interval'3 days',ending-interval'1 day','synthetic-privacy/v1'from stamp cross join generate_series(1,2)n;
insert into public.doctor_saas_accounts(subscriber_user_id,current_period_id,state,reason_code)
 select pg_temp.id(n),pg_temp.id(n+80),'enabled','trial_started'from generate_series(1,2)n;
insert into public.doctor_saas_period_events(subscriber_user_id,revision,period_id,reason_code,next_state)
 select pg_temp.id(n),1,pg_temp.id(n+80),'trial_started','enabled'from generate_series(1,2)n;
set local role authenticated;select pg_temp.claim(1);
select is(public.doctor_saas_status()->>'state','expired','requester has an actually expired period');
select lives_ok($$select public.doctor_submit_privacy_request('erasure_review',pg_temp.id(71))$$,'expired account can request review without erasing data');
select is(jsonb_array_length(public.doctor_privacy_requests()->'items'),2,'expired account can read its own request history');
reset role;
update public.doctor_saas_accounts set state='suspended',reason_code='operator_hold',revision=2 where subscriber_user_id=pg_temp.id(2);
set local role authenticated;select pg_temp.claim(2);
select lives_ok($$select public.doctor_submit_privacy_request('correction_review',pg_temp.id(72))$$,'operator-held account can request review without correcting records');
select is(jsonb_array_length(public.doctor_privacy_requests()->'items'),2,'held account retains own request reads');
reset role;
select is((select count(*)from public.patient_identities),0::bigint,'expiry and hold requests still perform no patient fulfillment');
select * from finish();rollback;
