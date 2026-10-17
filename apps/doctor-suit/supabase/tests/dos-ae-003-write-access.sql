begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
create function pg_temp.id(n integer)returns uuid language sql immutable as $$select('ae100000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid$$;
create function pg_temp.claim(n integer)returns text language sql as $$select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.id(n),'session_id',pg_temp.id(n+10),'role','authenticated','user_metadata',jsonb_build_object('paid',true,'unlimited',true))::text,true)$$;
create function pg_temp.command(query text)returns void language plpgsql security invoker as $$begin execute query;set constraints all immediate;set constraints all deferred;end $$;
create function pg_temp.patient(practice integer,location integer,patient integer,key integer,version integer default 1)returns text language sql as $$select format('select public.doctor_write_patient(%L,%L,%L::jsonb,%L,%L,%L)',pg_temp.id(practice),pg_temp.id(location),jsonb_build_object('name','Synthetic correction '||key,'phone','','email','','date_of_birth',null),pg_temp.id(key),pg_temp.id(patient),version)$$;
create function pg_temp.grants(locations integer[],caps text[])returns jsonb language sql as $$select coalesce(jsonb_agg(jsonb_build_object('location_id',pg_temp.id(n),'capabilities',to_jsonb(caps))),'[]')from unnest(locations)n$$;
insert into auth.users(id,email,email_confirmed_at)select pg_temp.id(n),'synthetic-write-'||n||'@example.test',now()from generate_series(1,4)n;
insert into auth.sessions(id,user_id)select pg_temp.id(n+10),pg_temp.id(n)from generate_series(1,4)n;
insert into public.doctor_candidate_admissions(user_id,purpose,evidence_ref,valid_until)select pg_temp.id(n),'synthetic_fixture','disposable-write:'||n,clock_timestamp()+interval'2 hours'from generate_series(1,4)n;
insert into public.doctor_profiles(user_id,display_name)select pg_temp.id(n),'Synthetic owner '||n from unnest(array[1,2,4])n;
insert into public.practices(id,owner_user_id,name)select pg_temp.id(n+20),pg_temp.id(n),'Synthetic practice '||n from unnest(array[1,2,4])n;
insert into public.locations(id,practice_id,name,timezone)values
 (pg_temp.id(31),pg_temp.id(21),'Synthetic A1','Etc/UTC'),(pg_temp.id(32),pg_temp.id(21),'Synthetic A2','Etc/UTC'),
 (pg_temp.id(33),pg_temp.id(22),'Synthetic B1','Etc/UTC'),(pg_temp.id(34),pg_temp.id(22),'Synthetic B2','Etc/UTC'),(pg_temp.id(35),pg_temp.id(24),'Synthetic expired clinic','Etc/UTC');
insert into public.memberships(id,practice_id,user_id,capabilities)values
 (pg_temp.id(41),pg_temp.id(21),pg_temp.id(3),array['patients.read','patients.write','appointments.read','queue.manage']),
 (pg_temp.id(42),pg_temp.id(22),pg_temp.id(3),array['patients.read','patients.write']);
-- Legacy NULL location capabilities inherit the membership union.
insert into public.membership_locations(practice_id,membership_id,location_id)values
 (pg_temp.id(21),pg_temp.id(41),pg_temp.id(31)),(pg_temp.id(21),pg_temp.id(41),pg_temp.id(32)),(pg_temp.id(22),pg_temp.id(42),pg_temp.id(33));
insert into public.patient_identities(id)values(pg_temp.id(51)),(pg_temp.id(52)),(pg_temp.id(53));
insert into public.practice_patients(id,practice_id,patient_identity_id,display_name,created_location_id,created_by)values
 (pg_temp.id(61),pg_temp.id(21),pg_temp.id(51),'Synthetic A patient',pg_temp.id(31),pg_temp.id(1)),
 (pg_temp.id(62),pg_temp.id(22),pg_temp.id(52),'Synthetic B patient',pg_temp.id(33),pg_temp.id(2)),
 (pg_temp.id(63),pg_temp.id(24),pg_temp.id(53),'Synthetic expired patient',pg_temp.id(35),pg_temp.id(4));
insert into public.appointments(id,practice_id,doctor_user_id,location_id,patient_id,starts_at,ends_at,timezone,location_name,created_by)
 values(pg_temp.id(71),pg_temp.id(21),pg_temp.id(1),pg_temp.id(31),pg_temp.id(61),'2030-01-02T09:00Z','2030-01-02T09:20Z','Etc/UTC','Synthetic A1',pg_temp.id(1));
insert into public.secretary_invitations(id,practice_id,recipient_email,token_hash,grants,created_by,expires_at)
 values(pg_temp.id(72),pg_temp.id(22),'synthetic-write-1@example.test',encode(sha256(decode(repeat('ef',32),'hex')),'hex'),pg_temp.grants(array[33],array['patients.read']),pg_temp.id(2),clock_timestamp()+interval'2 hours');
insert into public.doctor_saas_terms_versions(id,plan_key,version,status,currency,currency_exponent,monthly_minor,trial_days,staff_limit,staff_unlimited,clinic_limit,clinic_unlimited,over_limit_policy,renewal_policy,grace_days,expiry_policy,cancellation_policy,refund_policy,terms_document_ref,commercial_approval_ref,legal_approval_ref)values
 (pg_temp.id(81),'synthetic-business',1,'approved','USD',2,1234,2,1,false,1,false,'block_new_allocation','manual',0,'historical_read_only','period_end','manual_review','synthetic-business/v1','SYNTHETIC_COMMERCIAL','SYNTHETIC_LEGAL'),
 (pg_temp.id(82),'synthetic-business',2,'approved','USD',2,1234,2,2,false,1,false,'read_only_until_within_limit','manual',0,'historical_read_only','period_end','manual_review','synthetic-business/v2','SYNTHETIC_COMMERCIAL','SYNTHETIC_LEGAL');
update public.doctor_saas_configuration set terms_version_id=pg_temp.id(81),revision=2,change_reason='Synthetic block-allocation policy';
set local role authenticated;select pg_temp.claim(1);select public.doctor_start_saas_trial(pg_temp.id(81),2,'synthetic-business/v1',pg_temp.id(91));reset role;
update public.doctor_saas_configuration set terms_version_id=pg_temp.id(82),revision=3,change_reason='Synthetic read-only policy';
set local role authenticated;select pg_temp.claim(2);select public.doctor_start_saas_trial(pg_temp.id(82),3,'synthetic-business/v2',pg_temp.id(92));reset role;
with stamp as(select clock_timestamp()at time zone'UTC'as ending)
insert into public.doctor_saas_periods(id,subscriber_user_id,terms_version_id,kind,started_at,ends_at,accepted_document_ref)
 select pg_temp.id(83),pg_temp.id(4),pg_temp.id(81),'trial',(ending-interval'3 days')at time zone'UTC',(ending-interval'1 day')at time zone'UTC','synthetic-business/v1'from stamp;
insert into public.doctor_saas_accounts(subscriber_user_id,current_period_id,state,reason_code)values(pg_temp.id(4),pg_temp.id(83),'enabled','trial_started');
insert into public.doctor_saas_period_events(subscriber_user_id,revision,period_id,reason_code,next_state)values(pg_temp.id(4),1,pg_temp.id(83),'trial_started','enabled');
select ok(not has_function_privilege('authenticated','doctor_private.saas_owner_business_state(uuid,boolean,boolean)','EXECUTE'),'owner cannot ask the private helper to borrow another subscriber');
select ok(not has_function_privilege('service_role','doctor_private.saas_business_access(uuid,boolean,boolean)','EXECUTE'),'service API cannot invoke internal entitlement authority');
select is((select count(*)::integer from pg_trigger where tgname like'doctor_saas_business_%_final'and tgdeferrable and tginitdeferred),10,'all ten core physical tables have final authority checks');
update public.doctor_edition_policy set mode='administrative_candidate',revision=2,change_reason='Explicit synthetic write acceptance';
set local role authenticated;select pg_temp.claim(1);
select lives_ok($$select pg_temp.command(pg_temp.patient(21,31,61,101))$$,'block-new-allocation policy preserves ordinary patient corrections above a cap');
select lives_ok($$select pg_temp.command(format('select public.doctor_update_practice_profile(%L,1,%L,%L,%L)',pg_temp.id(21),'Synthetic updated owner','Synthetic updated practice',pg_temp.id(102)))$$,'profile and practice edits use the active owner plan without requiring new quota');
select lives_ok($$select pg_temp.command(format('select public.doctor_write_location(%L,%L,%L,%L,%L,%L,%L,1)',pg_temp.id(21),'Synthetic A1 corrected','Etc/UTC','','',pg_temp.id(103),pg_temp.id(31)))$$,'existing clinic correction is an ordinary write under block policy');
reset role;
select lives_ok($$select pg_temp.command(format('update public.appointments set ends_at=ends_at+interval%L,version=2 where id=%L','5 minutes',pg_temp.id(71)))$$,'physical appointment changes also accept the bound active owner policy');
set local role authenticated;
select throws_ok($$select pg_temp.command(format('select public.doctor_write_location(%L,%L,%L,%L,%L,%L)',pg_temp.id(21),'Synthetic new denied clinic','Etc/UTC','','',pg_temp.id(104)))$$,'DS003','DOCTOR_SAAS_CLINIC_LIMIT','block policy still denies new allocation while above a cap');
select pg_temp.claim(2);
select throws_ok($$select pg_temp.command(pg_temp.patient(22,33,62,105))$$,'DS007','DOCTOR_SAAS_OVER_LIMIT_READ_ONLY','read-only over-limit policy blocks ordinary patient corrections');
select is(public.doctor_patient(pg_temp.id(22),pg_temp.id(33),pg_temp.id(62))->'patient'->>'name','Synthetic B patient','over-limit historical patient reads remain available');
select throws_ok($$select pg_temp.command(format('select public.doctor_write_schedule(%L,%L,0,%L::jsonb,%L,1)',pg_temp.id(22),pg_temp.id(33),jsonb_build_object('slot_minutes',20,'weekly','[]'::jsonb,'exceptions','[]'::jsonb),pg_temp.id(106)))$$,'DS007','DOCTOR_SAAS_OVER_LIMIT_READ_ONLY','availability writes obey the read-only over-limit policy');
select lives_ok($$select pg_temp.command(format('select public.doctor_archive_location(%L,%L,1,%L)',pg_temp.id(22),pg_temp.id(34),pg_temp.id(107)))$$,'unused-clinic reduction remains available to recover from read-only over-limit state');
select lives_ok($$select pg_temp.command(pg_temp.patient(22,33,62,105))$$,'same stable correction request can succeed after reducing back within the limit');
select lives_ok($$select pg_temp.command(format('select public.doctor_write_schedule(%L,%L,0,%L::jsonb,%L,1)',pg_temp.id(22),pg_temp.id(33),jsonb_build_object('slot_minutes',20,'weekly','[]'::jsonb,'exceptions','[]'::jsonb),pg_temp.id(106)))$$,'new schedule is allowed after recovery');
select lives_ok($$select pg_temp.command(format('select public.doctor_write_schedule(%L,%L,1,%L::jsonb,%L,1)',pg_temp.id(22),pg_temp.id(33),jsonb_build_object('slot_minutes',30,'weekly','[]'::jsonb,'exceptions','[]'::jsonb),pg_temp.id(108)))$$,'schedule update with its location primary key also checks current authority');
select pg_temp.claim(1);
select lives_ok($$select pg_temp.command(format('select public.doctor_accept_secretary_invitation(%L,%L,%L)',pg_temp.id(72),repeat('ef',32),pg_temp.id(122)))$$,'read-only policy accepts a reserved invitation exactly at the staff cap');
reset role;
select is(doctor_private.saas_usage(pg_temp.id(22))->>'staff_total','2','acceptance converts the reservation without increasing final staff usage');
select is((select status from public.secretary_invitations where id=pg_temp.id(72)),'accepted','successful reserved conversion marks the invitation accepted');
update public.doctor_saas_accounts set state='suspended',revision=revision+1,reason_code='operator_hold'where subscriber_user_id=pg_temp.id(1);
set local role authenticated;select pg_temp.claim(1);
select throws_ok($$select pg_temp.command(pg_temp.patient(21,31,61,109,2))$$,'DS006','DOCTOR_SAAS_PERIOD_INACTIVE','held subscriber cannot correct administrative records');
select throws_ok($$select pg_temp.command(format('select public.doctor_update_practice_profile(%L,2,%L,%L,%L)',pg_temp.id(21),'Synthetic denied rename','Synthetic denied practice',pg_temp.id(110)))$$,'DS006','DOCTOR_SAAS_PERIOD_INACTIVE','Doctor profile changes cannot bypass the held subscription');
select lives_ok($$select pg_temp.command(format('select public.doctor_set_membership_grants(%L,%L,1,%L::jsonb,%L)',pg_temp.id(21),pg_temp.id(41),pg_temp.grants(array[31],array['patients.read']),pg_temp.id(111)))$$,'legacy inherited grant reductions use deltas and remain available during a hold');
select throws_ok($$select pg_temp.command(format('select public.doctor_set_membership_grants(%L,%L,2,%L::jsonb,%L)',pg_temp.id(21),pg_temp.id(41),pg_temp.grants(array[31],array['patients.read','patients.write']),pg_temp.id(112)))$$,'DS006','DOCTOR_SAAS_PERIOD_INACTIVE','expanding the membership union requires an active owner period');
select throws_ok($$select pg_temp.command(format('select public.doctor_set_membership_grants(%L,%L,2,%L::jsonb,%L)',pg_temp.id(21),pg_temp.id(41),pg_temp.grants(array[31,32],array['patients.read']),pg_temp.id(113)))$$,'DS006','DOCTOR_SAAS_PERIOD_INACTIVE','adding a new location with an unchanged union still requires entitlement');
select lives_ok($$select pg_temp.command(format('select public.doctor_set_membership_grants(%L,%L,2,%L::jsonb,%L)',pg_temp.id(21),pg_temp.id(41),'[]',pg_temp.id(114)))$$,'removing every remaining grant requires no new allocation');
select lives_ok($$select pg_temp.command(format('select public.doctor_set_membership_status(%L,%L,3,%L,%L)',pg_temp.id(21),pg_temp.id(41),'suspended',pg_temp.id(115)))$$,'security suspension stays available during a hold');
select lives_ok($$select pg_temp.command(format('select public.doctor_archive_location(%L,%L,1,%L)',pg_temp.id(21),pg_temp.id(32),pg_temp.id(121)))$$,'unused-clinic archival remains a security reduction during a hold');
select lives_ok($$select public.doctor_update_account_settings('Synthetic personal settings','',false,0,pg_temp.id(116))$$,'personal settings stay independent of a business subscription');
select is(public.doctor_patient(pg_temp.id(21),pg_temp.id(31),pg_temp.id(61))->'patient'->>'name','Synthetic correction 101','subscription hold preserves authorized historical reads');
select lives_ok($$select pg_temp.command(pg_temp.patient(21,31,61,101))$$,'committed correction receipt replay grants no new write after suspension');
select pg_temp.claim(3);
select lives_ok($$select pg_temp.command(pg_temp.patient(22,33,62,117,2))$$,'independent secretary can still write for another active practice after the first owner hold');
select lives_ok($$select pg_temp.command(format('select public.doctor_write_patient(%L,%L,%L::jsonb,%L)',pg_temp.id(22),pg_temp.id(33),jsonb_build_object('name','Synthetic new secretary-entered patient','phone','','email','','date_of_birth',null),pg_temp.id(120)))$$,'secretary new-patient identity links atomically to the subscribed practice owner');
select throws_ok($$select public.doctor_patient(pg_temp.id(21),pg_temp.id(31),pg_temp.id(61))$$,'42501','DOCTOR_ACCESS_DENIED','subscription history access never restores revoked role grants');
select pg_temp.claim(4);
select is(public.doctor_saas_status()->>'state','expired','retained original period is expired');
select is(public.doctor_patient(pg_temp.id(24),pg_temp.id(35),pg_temp.id(63))->'patient'->>'name','Synthetic expired patient','expiry preserves authorized history');
select throws_ok($$select pg_temp.command(pg_temp.patient(24,35,63,118))$$,'DS006','DOCTOR_SAAS_PERIOD_INACTIVE','expired trial cannot write through forged paid metadata');
select lives_ok($$select public.doctor_update_account_settings('Synthetic expired personal settings','',false,0,pg_temp.id(119))$$,'expiry preserves personal account and recovery settings');
reset role;select pg_temp.claim(1);
select throws_ok($$select pg_temp.command(format('update public.locations set archived_at=archived_at+interval%L where id=%L','1 minute',pg_temp.id(32)))$$,'DS006','DOCTOR_SAAS_PERIOD_INACTIVE','archival reduction does not permit later timestamp rewrites during a hold');
select throws_ok($$select pg_temp.command(format('update public.appointments set state=%L,version=2 where id=%L','cancelled',pg_temp.id(71)))$$,'DS006','DOCTOR_SAAS_PERIOD_INACTIVE','physical appointment transition cannot bypass subscription state');
select is((select version from public.appointments where id=pg_temp.id(71)),2,'denied appointment write does not advance its version');
select pg_temp.claim(2);
select throws_ok($$select pg_temp.command('insert into public.patient_identities default values')$$,'42501','DOCTOR_PATIENT_LINK_REQUIRED','deferred identity link check rejects an orphan synthetic identity');
select throws_ok($$update public.patient_identities set created_at=clock_timestamp()where id=pg_temp.id(52)$$,'42501','DOCTOR_PATIENT_IDENTITY_IMMUTABLE','identity history cannot be rewritten through a physical update');
select is((select count(*)::integer from public.patient_identities),4,'denied writes leave no orphan identity or partial patient');
select is((select count(*)::integer from doctor_private.command_receipts where command_key in(pg_temp.id(104),pg_temp.id(109),pg_temp.id(110),pg_temp.id(112),pg_temp.id(113),pg_temp.id(118))),0,'denied business writes leave no success receipts');
select is((select version from public.practice_patients where id=pg_temp.id(61)),2,'denied correction preserves the committed historical version');
select is((select count(*)::integer from public.membership_locations where membership_id=pg_temp.id(42)),1,'security reductions never rewrite an independent practice membership');
select * from finish();rollback;
