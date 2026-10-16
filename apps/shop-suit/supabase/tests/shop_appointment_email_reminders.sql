-- Included after the public-booking synthetic fixture, always disposable.
create temporary table reminder_fixture(shop uuid,slug text,actor uuid,appointment uuid,reference uuid,token text,email text,queue uuid);
do $$declare f record;cred jsonb;session jsonb;ref uuid;r jsonb;slot timestamptz;comb jsonb;begin
 for f in select b.shop,b.slug,a.actor,a.appointment,a.customer from booking_fixture b join access_fixture a on a.shop=b.shop loop
  perform set_config('request.jwt.claim.sub',f.actor::text,true);
  update public.clients set email='reminder-'||replace(f.shop::text,'-','')||'@example.test' where id=f.customer and shop_id=f.shop;
  -- Existing contact data alone never opts a customer in.
  assert not exists(select 1 from public.appointment_email_consents where appointment_id=f.appointment);
  cred:=public.appointment_access_issue(f.shop,f.appointment);
  session:=public.appointment_access_verify(f.slug,cred->>'code','01000000000');
  perform public.appointment_booking_manage(f.slug,session->>'token');
  select reference into ref from public.appointment_booking_references where appointment_id=f.appointment;
  assert ref is not null and session->>'token' is not null;
  assert public.appointment_reminder_preference(f.slug,session->>'token',ref,true,'en')->>'ok'='false','owner opt-in required';
  perform public.shop_booking_settings_save(f.shop,'{"enabled":true,"lead_minutes":0,"horizon_days":30,"change_notice_minutes":60,"allow_reschedule":true,"allow_cancel":true,"reminder_lead_minutes":15,"reminders_enabled":true}',
   (select jsonb_agg(jsonb_build_object('membershipId',membership_id,'publicName',public_name)) from public.shop_booking_staff where shop_id=f.shop and published));
  assert not exists(select 1 from public.appointment_email_consents where appointment_id=f.appointment),'owner setting never bulk-enrolls';
  comb:=public.appointment_booking_options(f.slug,session->>'token')->'combinations'->0;
  slot:=(public.appointment_booking_slots(f.slug,(comb->>'service')::uuid,(comb->>'location')::uuid,(comb->>'staff')::uuid,current_date+3,session->>'token')->'slots'->0->>'startsAt')::timestamptz;
  r:=public.appointment_booking_command(f.slug,session->>'token','create',encode(extensions.gen_random_bytes(32),'hex'),null,(comb->>'service')::uuid,(comb->>'location')::uuid,(comb->>'staff')::uuid,slot);
  assert r->>'ok'='true','synthetic verified customer public appointment';
  ref:=(r->>'reference')::uuid;select appointment_id into f.appointment from public.appointment_booking_references where reference=ref;

  r:=public.appointment_reminder_preference(f.slug,session->>'token',ref,true,'ar');assert r->>'ok'='true','eligible customer can consent';
  assert public.appointment_booking_options(f.slug,session->>'token')->>'remindersEnabled'='true','published readiness reflects explicit owner policy only';
  assert public.appointment_reminder_preference(f.slug,session->>'token',ref,true,'ar')->>'ok'='true','same consent safe to retry';
  assert (select count(*) from public.appointment_email_outbox where appointment_id=f.appointment)=1,'one queue row per appointment instant';
  r:=public.appointment_booking_manage(f.slug,session->>'token');
  assert r::text not like '%@example.test%' and r::text not like '%PRIVATE financial notes%','contact and notes never projected';
  assert exists(select 1 from jsonb_array_elements(r->'items') item where item->>'reference'=ref::text and item->>'reminderEnabled'='true');
  insert into reminder_fixture select f.shop,f.slug,f.actor,f.appointment,ref,session->>'token',shop_private.reminder_contact(f.appointment),id from public.appointment_email_outbox where appointment_id=f.appointment;
 end loop;
end$$;

do $$declare f record;g record;r jsonb;p jsonb;begin
 select * into f from reminder_fixture order by shop limit 1;select * into g from reminder_fixture where shop<>f.shop limit 1;
 assert public.appointment_reminder_preference(g.slug,f.token,g.reference,true,'en')->>'ok'='false','cross-tenant token denied';
 assert public.appointment_reminder_preference(f.slug,f.token,g.reference,true,'en')->>'ok'='false','cross-tenant reference denied';
 assert public.appointment_reminder_preference(f.slug,'invalid',f.reference,false,'en')->>'ok'='false','invalid scope cannot opt out another customer';
 assert public.appointment_reminder_preference(f.slug,f.token,f.reference,true,'xx')->>'ok'='false','locale validated';
 assert public.appointment_reminder_preference((select slug from booking_fixture where shop=f.shop),(select token from booking_fixture where shop=f.shop),(select reference from booking_fixture where shop=f.shop),true,'en')->>'ok'='false','guest phone scope cannot consent saved customer email';
 assert public.claim_appointment_email(array[f.email]) is null,'not due cannot claim';
 update public.appointment_email_outbox set due_at=clock_timestamp()-interval '1 minute' where id=f.queue;
 assert public.claim_appointment_email(array['other@example.test']) is null,'allowlist enforced in database';
 r:=public.claim_appointment_email(array[f.email]);assert (r->>'id')::uuid=f.queue and r->>'to'=f.email;
 assert r->>'shopName'=(select published->>'publicName' from public.shop_website_profiles where shop_id=f.shop),'email uses independent published name only';
 assert public.claim_appointment_email(array[f.email]) is null,'live lease prevents a second worker claim';
 p:=jsonb_build_object('from','reminders@building-suit.com','to',jsonb_build_array(f.email),'subject','Synthetic','text','private synthetic','html','<p>synthetic</p>');
 assert public.prepare_appointment_email(f.queue,gen_random_uuid(),p,array[f.email]) is null,'wrong fence denied';
 assert public.prepare_appointment_email(f.queue,(r->>'leaseToken')::uuid,p||'{"to":["other@example.test"]}',array[f.email]) is null,'recipient substitution denied';
 assert public.prepare_appointment_email(f.queue,(r->>'leaseToken')::uuid,p,array[f.email])=p,'prepare authorizes and freezes payload';
 assert public.finish_appointment_email(f.queue,(r->>'leaseToken')::uuid,'retry')=true,'uncertain result retries only frozen payload';
 update public.appointment_email_outbox set next_attempt_at=clock_timestamp(),lease_until=null where id=f.queue;
 update public.appointment_email_budget set next_claim_at='-infinity' where bucket='rate';
 r:=public.claim_appointment_email(array[f.email]);assert r->'payload'=p;
 assert public.prepare_appointment_email(f.queue,(r->>'leaseToken')::uuid,p||'{"subject":"changed"}',array[f.email]) is null,'retry payload cannot change';
 assert public.prepare_appointment_email(f.queue,(r->>'leaseToken')::uuid,p,array[f.email])=p;
 assert public.finish_appointment_email(f.queue,(r->>'leaseToken')::uuid,'sent','synthetic-receipt');
 assert public.claim_appointment_email(array[f.email]) is null,'accepted emails are never resent';
 assert not public.finish_appointment_email(f.queue,(r->>'leaseToken')::uuid,'retry'),'stale completion fenced';
end$$;

-- Each behavior is isolated by a savepoint so the same synthetic queue can prove
-- cancellation/contact/quota/retry boundaries without weakening their invariants.
savepoint reminder_case;
do $$declare f record;r jsonb;p jsonb;begin
 select * into f from reminder_fixture order by shop desc limit 1;
 update public.appointment_email_outbox set due_at=clock_timestamp()-interval '1 minute' where id=f.queue;
 r:=public.claim_appointment_email(array[f.email]);assert r is not null;
 assert public.appointment_reminder_preference(f.slug,f.token,f.reference,false,'en')->>'ok'='true';
 p:=jsonb_build_object('to',jsonb_build_array(f.email));
 assert public.prepare_appointment_email(f.queue,(r->>'leaseToken')::uuid,p,array[f.email]) is null,'consent revoked after claim prevents send';
 assert (select state from public.appointment_email_outbox where id=f.queue)='cancelled';
end$$;
rollback to reminder_case;
do $$declare f record;r jsonb;begin
 select * into f from reminder_fixture order by shop desc limit 1;
 update public.clients set email='changed@example.test' where id=(select client_id from public.appointments where id=f.appointment);
 assert not (select enabled from public.appointment_email_consents where appointment_id=f.appointment),'contact change needs fresh consent';
 assert (select state from public.appointment_email_outbox where id=f.queue)='cancelled';
end$$;
rollback to reminder_case;
do $$declare f record;r jsonb;p jsonb;begin
 select * into f from reminder_fixture order by shop desc limit 1;
 update public.appointment_email_outbox set due_at=clock_timestamp()-interval '1 minute',attempts=5 where id=f.queue;
 assert public.claim_appointment_email(array[f.email]) is null;
 assert (select state from public.appointment_email_outbox where id=f.queue)='review_required','bounded retry count';
end$$;
rollback to reminder_case;
do $$declare f record;begin
 select * into f from reminder_fixture order by shop desc limit 1;
 update public.appointment_email_outbox set due_at=clock_timestamp()-interval '1 minute',first_attempt_at=clock_timestamp()-interval '23 hours' where id=f.queue;
 assert public.claim_appointment_email(array[f.email]) is null;
 assert (select state from public.appointment_email_outbox where id=f.queue)='review_required','no retry after provider key safety window';
end$$;
rollback to reminder_case;
do $$declare f record;r jsonb;p jsonb;begin
 select * into f from reminder_fixture order by shop desc limit 1;
 update public.appointment_email_outbox set due_at=clock_timestamp()-interval '1 minute' where id=f.queue;
 r:=public.claim_appointment_email(array[f.email]);
 insert into public.appointment_email_budget(bucket,used) values('tenant:'||f.shop::text||':'||to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD'),10) on conflict(bucket) do update set used=10;
 assert public.prepare_appointment_email(f.queue,(r->>'leaseToken')::uuid,jsonb_build_object('to',jsonb_build_array(f.email)),array[f.email]) is null,'tenant daily budget enforced';
end$$;
rollback to reminder_case;
do $$declare role_name text;t text;signature text;begin
 foreach role_name in array array['anon','authenticated','service_role'] loop
  foreach t in array array['appointment_email_consents','appointment_email_outbox','appointment_email_events','appointment_email_budget','appointment_email_schedule_settings','appointment_email_schedule_events'] loop
   assert not has_table_privilege(role_name,'public.'||t,'SELECT,INSERT,UPDATE,DELETE'),'no direct private table privileges';
   assert (select relrowsecurity from pg_class where oid=('public.'||t)::regclass),'private tables RLS';
  end loop;
 end loop;
 foreach role_name in array array['anon','authenticated'] loop
  foreach signature in array array['public.claim_appointment_email(text[],text)','public.prepare_appointment_email(uuid,uuid,jsonb,text[],text)','public.finish_appointment_email(uuid,uuid,text,text)','public.shop_booking_settings_save_before_email(uuid,jsonb,jsonb)','public.appointment_booking_manage_before_email(text,text,integer)'] loop
   assert not has_function_privilege(role_name,signature,'EXECUTE'),'no browser worker/helper privilege';
  end loop;
 end loop;
 assert not has_function_privilege('anon','public.shop_booking_settings_save(uuid,jsonb,jsonb)','EXECUTE');
end$$;

-- A prepared request is the send authorization point. Revocation after that
-- point cancels retries but retains any late provider acceptance receipt.
savepoint reminder_late_acceptance;
do $$declare f record;r jsonb;p jsonb;begin
 select * into f from reminder_fixture order by shop desc limit 1;
 update public.appointment_email_outbox set due_at=clock_timestamp()-interval '1 minute' where id=f.queue;
 update public.appointment_email_budget set next_claim_at='-infinity' where bucket='rate';
 r:=public.claim_appointment_email(array[f.email]);p:=jsonb_build_object('to',jsonb_build_array(f.email));
 assert public.prepare_appointment_email(f.queue,(r->>'leaseToken')::uuid,p,array[f.email])=p;
 assert public.appointment_reminder_preference(f.slug,f.token,f.reference,false,'en')->>'ok'='true';
 assert public.finish_appointment_email(f.queue,(r->>'leaseToken')::uuid,'sent','late-synthetic-receipt');
 assert (select state='cancelled' and provider_email_id='late-synthetic-receipt' from public.appointment_email_outbox where id=f.queue);
 assert not public.finish_appointment_email(f.queue,(r->>'leaseToken')::uuid,'retry');
 assert public.claim_appointment_email(array[f.email]) is null;
end$$;
rollback to reminder_late_acceptance;

-- Tenant-owner policy enforcement uses current Auth, not body-selected IDs.
savepoint reminder_policy_scope;
do $$declare f record;g record;begin
 select * into f from reminder_fixture order by shop limit 1;select * into g from reminder_fixture where shop<>f.shop limit 1;
 perform set_config('request.jwt.claim.sub',f.actor::text,true);
 begin
  perform public.shop_booking_settings_save(g.shop,'{"enabled":true,"lead_minutes":0,"horizon_days":30,"change_notice_minutes":60,"allow_reschedule":true,"allow_cancel":true,"reminder_lead_minutes":15,"reminders_enabled":true}','[]');
  raise exception 'CROSS_TENANT_POLICY_ALLOWED';
 exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claim.sub','',true);
 begin
  perform public.shop_booking_settings_save(f.shop,'{"enabled":true,"lead_minutes":0,"horizon_days":30,"change_notice_minutes":60,"allow_reschedule":true,"allow_cancel":true,"reminder_lead_minutes":15,"reminders_enabled":true}','[]');
  raise exception 'UNAUTHENTICATED_POLICY_ALLOWED';
 exception when insufficient_privilege then null;end;
end$$;
rollback to reminder_policy_scope;
savepoint reminder_budget_caps;
do $$declare f record;r jsonb;p jsonb;b text;cap integer;begin
 select * into f from reminder_fixture order by shop desc limit 1;
 update public.appointment_email_outbox set due_at=clock_timestamp()-interval '1 minute' where id=f.queue;
 r:=public.claim_appointment_email(array[f.email]);p:=jsonb_build_object('to',jsonb_build_array(f.email));
 foreach b in array array['day:'||to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD'),'month:'||to_char(clock_timestamp() at time zone 'UTC','YYYY-MM')] loop
  update public.appointment_email_budget set used=0,next_claim_at='-infinity';
  cap:=case when b like 'day:%' then 80 else 2400 end;
  insert into public.appointment_email_budget(bucket,used) values(b,cap) on conflict(bucket) do update set used=excluded.used;
  assert public.prepare_appointment_email(f.queue,(r->>'leaseToken')::uuid,p,array[f.email]) is null,'global Free allocation cap enforced';
 end loop;
 update public.appointment_email_budget set used=0,next_claim_at='-infinity';
 insert into public.appointment_email_budget(bucket,next_claim_at) values('rate',clock_timestamp()+interval '1 minute') on conflict(bucket) do update set next_claim_at=excluded.next_claim_at;
 assert public.prepare_appointment_email(f.queue,(r->>'leaseToken')::uuid,p,array[f.email]) is null,'global rate gate enforced';
 assert (select attempts from public.appointment_email_outbox where id=f.queue)=0,'deferrals never count as provider attempts';
end$$;
rollback to reminder_budget_caps;
savepoint reminder_reconsent;
do $$declare f record;begin
 select * into f from reminder_fixture order by shop desc limit 1;
 assert public.appointment_reminder_preference(f.slug,f.token,f.reference,false,'en')->>'ok'='true';
 assert public.appointment_reminder_preference(f.slug,f.token,f.reference,true,'en')->>'ok'='true';
 assert (select state='queued' and attempts=0 and payload is null from public.appointment_email_outbox where id=f.queue),'fresh consent may revive only a never-attempted intent';
 assert (select count(*) from public.appointment_email_outbox where appointment_id=f.appointment)=1;
end$$;
rollback to reminder_reconsent;
savepoint reminder_live_mode;
do $$declare f record;r jsonb;p jsonb;begin
 select * into f from reminder_fixture order by shop desc limit 1;
 update public.appointment_email_outbox set next_attempt_at=clock_timestamp()+interval '10 years' where id<>f.queue;
 update public.appointment_email_outbox set due_at=clock_timestamp()-interval '1 minute' where id=f.queue;
 assert public.claim_appointment_email(null) is null,'NULL list never implicitly selects live mode';
 assert public.claim_appointment_email(null,'LIVE') is null,'invalid mode refused';
 assert public.claim_appointment_email(array[f.email],'live') is null,'live/test configuration cannot be confused';
 r:=public.claim_appointment_email(null,'live');assert (r->>'id')::uuid=f.queue,'explicit live mode claims an eligible consented customer without test allowlist';
 p:=jsonb_build_object('to',jsonb_build_array(f.email));
 assert public.prepare_appointment_email(f.queue,(r->>'leaseToken')::uuid,p,null) is null,'default prepare remains test-scoped';
 update public.appointment_email_budget set used=0,next_claim_at='-infinity';
 insert into public.appointment_email_budget(bucket,used) values('month:'||to_char(clock_timestamp() at time zone 'UTC','YYYY-MM'),2400) on conflict(bucket) do update set used=2400;
 assert public.prepare_appointment_email(f.queue,(r->>'leaseToken')::uuid,p,null,'live') is null,'live mode retains free allocation caps';
 update public.appointment_email_budget set used=0,next_claim_at='-infinity';
 assert public.prepare_appointment_email(f.queue,(r->>'leaseToken')::uuid,p,null,'live')=p,'explicit live authorization still binds exact eligible recipient';
end$$;
rollback to reminder_live_mode;
