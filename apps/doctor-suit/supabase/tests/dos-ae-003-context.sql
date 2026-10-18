begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
create function pg_temp.id(n integer)returns uuid language sql immutable as $$select('ae130000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid$$;
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
select ok(not has_function_privilege('authenticated','doctor_private.saas_entitlement_context(uuid)','EXECUTE'),'browser cannot query another owner entitlement through the private helper');
select ok(not has_function_privilege('service_role','doctor_private.saas_entitlement_context(uuid)','EXECUTE'),'service API has no arbitrary practice entitlement query');
set local role authenticated;select pg_temp.claim(1);
select is(pg_temp.context(21,31)#>>'{entitlement,state}','preview','synthetic preview retains its explicit legacy behavior');
select is(pg_temp.context(21,31)#>>'{entitlement,writes_allowed}','true','preview metadata does not masquerade as a paid subscription');
reset role;
update public.doctor_edition_policy set mode='administrative_candidate',revision=2,change_reason='Explicit synthetic entitlement context acceptance';
set local role authenticated;select pg_temp.claim(1);
select is(jsonb_array_length(public.doctor_contexts()),2,'owner retains both authorized historical clinic contexts');
select is(pg_temp.context(21,31)#>>'{entitlement,state}','trial','candidate uses the stored owner period');
select is(pg_temp.context(21,31)#>>'{entitlement,revision}','1','context includes the actual account revision');
select is(pg_temp.context(21,31)#>>'{entitlement,writes_allowed}','true','active ordinary write allowance is explicit');
select is(pg_temp.context(21,31)#>>'{entitlement,can_add_staff}','true','staff room comes from active members plus pending invitations');
select is(pg_temp.context(21,31)#>>'{entitlement,can_add_clinic}','true','clinic room uses subscribed allowance, not the current offer');
select is(pg_temp.context(21,31)#>>'{entitlement,over_limit}','false','room is separate from an over-limit claim');
select ok((pg_temp.context(21,31)#>>'{entitlement,observed_at}')::timestamptz<(pg_temp.context(21,31)#>>'{entitlement,valid_until}')::timestamptz,'trial observation precedes its immutable expiry');
select is((select count(distinct row#>>'{entitlement,observed_at}')::integer from jsonb_array_elements(public.doctor_contexts())row),1,'entitlement is evaluated once per authorized practice rather than once per clinic');
select ok(not(pg_temp.context(21,31)->'entitlement'?|array['subscriber_user_id','terms','monthly_minor','commercial_approval_ref','legal_approval_ref']),'context metadata exposes no subscriber financial snapshot or approval evidence');
select pg_temp.claim(4);
select is(jsonb_array_length(public.doctor_contexts()),3,'independent secretary keeps exact clinic scopes across both practices');
select is(pg_temp.context(21,31)#>>'{entitlement,writes_allowed}','true','secretary receives the first practice owner allowance');
select is(pg_temp.context(22,33)#>>'{entitlement,writes_allowed}','false','same secretary receives the second practice read-only allowance');
select is(pg_temp.context(22,33)#>>'{entitlement,over_limit}','true','read-only owner over-limit state is explicit');
select is(pg_temp.context(22,33)#>>'{entitlement,can_add_staff}','false','over-limit state grants no new staff allocation');
select ok(pg_temp.context(22,33)->'capabilities'?'patients.write','stored role write grant is retained separately from current paid write state');
select throws_ok($$select doctor_private.saas_entitlement_context(pg_temp.id(23))$$,'42501',null,'an invited actor cannot request arbitrary owner metadata');
select pg_temp.claim(3);
select is(pg_temp.context(23,34)#>>'{entitlement,state}','unconfigured','missing subscription stays unconfigured despite paid browser metadata');
select is(pg_temp.context(23,34)#>>'{entitlement,revision}','0','missing account has no fabricated revision');
select is(pg_temp.context(23,34)#>>'{entitlement,writes_allowed}','false','unconfigured period offers no paid writes');
select is(pg_temp.context(23,34)#>>'{entitlement,can_add_clinic}','false','unconfigured owner receives no allocation');
select pg_temp.claim(5);
select is(pg_temp.context(25,35)#>>'{entitlement,state}','expired','clock expiry changes projected state without changing account revision');
select is(pg_temp.context(25,35)#>>'{entitlement,revision}','1','expiry does not reset or rewrite subscription history');
select is(pg_temp.context(25,35)#>>'{entitlement,writes_allowed}','false','expired owner retains a historical context with no write offer');
select ok((pg_temp.context(25,35)#>>'{entitlement,observed_at}')::timestamptz>=(pg_temp.context(25,35)#>>'{entitlement,valid_until}')::timestamptz,'expired observation is at or after the retained end');
reset role;
update public.doctor_saas_accounts set state='suspended',revision=2,reason_code='operator_hold'where subscriber_user_id=pg_temp.id(1);
update public.doctor_saas_configuration set terms_version_id=null,revision=4,change_reason='Synthetic offer withdrawal';
set local role authenticated;select pg_temp.claim(4);
select is(pg_temp.context(21,31)#>>'{entitlement,state}','suspended','owner hold changes only that practice entitlement');
select is(pg_temp.context(21,31)#>>'{entitlement,revision}','2','owner hold invalidates the revision epoch');
select is(pg_temp.context(21,31)#>>'{entitlement,writes_allowed}','false','held subscription cannot offer writes to independent staff');
select is(pg_temp.context(22,33)#>>'{entitlement,state}','trial','unrelated owner period remains independently current');
select ok(pg_temp.context(21,31)->'capabilities'?'patients.read','history read grants survive the first owner hold');
reset role;
insert into public.doctor_candidate_revocations(admission_id,reason)values(pg_temp.id(44),'operator_revoke');
set local role authenticated;select pg_temp.claim(4);
select throws_ok($$select public.doctor_contexts()$$,'42501','DOCTOR_SYNTHETIC_ADMISSION_REQUIRED','paid metadata never bypasses provider identity or synthetic admission');
reset role;
select is((select count(*)::integer from public.doctor_saas_accounts where subscriber_user_id=pg_temp.id(4)),0,'staff context reads create no subscriber account');
select * from finish();rollback;
