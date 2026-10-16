-- Explicit server-side delivery mode; old callers remain test-scoped by default.
-- No delivery, secrets or enabled cron job are installed by this migration.
drop function public.claim_appointment_email(text[]);
drop function public.prepare_appointment_email(uuid,uuid,jsonb,text[]);
create function public.claim_appointment_email(p_allowlist text[],p_mode text default 'test') returns jsonb language plpgsql security definer set search_path='' as $$
declare o public.appointment_email_outbox;s uuid;begin
 if p_mode is null or p_mode not in ('test','live') or (p_mode='test' and (p_allowlist is null or cardinality(p_allowlist) not between 1 and 20)) or (p_mode='live' and p_allowlist is not null) then return null;end if;
 -- Pick a tenant first without taking queue locks: all commands use Shop first.
 select q.shop_id into s from public.appointment_email_outbox q where q.state in ('queued','retry','leased','dispatching')
 and (p_mode='live' or shop_private.reminder_contact(q.appointment_id)=any(p_allowlist)) and q.due_at<=clock_timestamp() and q.next_attempt_at<=clock_timestamp() and (q.lease_until is null or q.lease_until<clock_timestamp())
 order by q.next_attempt_at,q.due_at,q.id limit 1;
 if s is null then return null;end if;
 perform 1 from public.shops where id=s for update skip locked;if not found then return null;end if;
 select * into o from public.appointment_email_outbox q where q.shop_id=s and q.state in ('queued','retry','leased','dispatching')
 and (p_mode='live' or shop_private.reminder_contact(q.appointment_id)=any(p_allowlist)) and q.due_at<=clock_timestamp() and q.next_attempt_at<=clock_timestamp() and (q.lease_until is null or q.lease_until<clock_timestamp())
 order by q.next_attempt_at,q.due_at,q.id for update skip locked limit 1;
 if o.id is null then return null;end if;
 if not shop_private.reminder_eligible(o.appointment_id) or not exists(select 1 from public.appointment_email_consents c
 join public.appointments a on a.id=c.appointment_id and a.shop_id=c.shop_id and a.starts_at=o.appointment_starts_at and a.client_id=c.client_id
 where c.appointment_id=o.appointment_id and c.enabled and c.email=shop_private.reminder_contact(a.id)) then
  update public.appointment_email_outbox set state='cancelled',lease_token=null,lease_until=null where id=o.id;return null;
 end if;
 if p_mode='test' and not (shop_private.reminder_contact(o.appointment_id)=any(p_allowlist)) then return null;end if;
 if o.attempts>=5 or o.first_attempt_at<=clock_timestamp()-interval '23 hours' then
  update public.appointment_email_outbox set state='review_required',lease_token=null,lease_until=null,last_error='retry_window_exhausted' where id=o.id;return null;
 end if;
 update public.appointment_email_outbox set state='leased',lease_token=gen_random_uuid(),lease_until=clock_timestamp()+interval '2 minutes'
 where id=o.id returning * into o;
 return jsonb_build_object('id',o.id,'leaseToken',o.lease_token,'payload',o.payload,'to',shop_private.reminder_contact(o.appointment_id),
 'startsAt',o.appointment_starts_at,'locale',(select locale from public.appointment_email_consents where appointment_id=o.appointment_id),
 'shopName',(select published->>'publicName' from public.shop_website_profiles where shop_id=o.shop_id),
 'timeZone',coalesce((select h.timezone from public.appointment_working_hours h join public.appointments a on a.id=o.appointment_id and a.shop_id=h.shop_id
 and a.location_id=h.location_id and a.assigned_membership_id=h.membership_id order by h.weekday limit 1),'UTC'));
end$$;

create function public.prepare_appointment_email(p_id uuid,p_lease_token uuid,p_payload jsonb,p_allowlist text[],p_mode text default 'test') returns jsonb
language plpgsql security definer set search_path='' as $$
declare o public.appointment_email_outbox;s uuid;target public.appointments;b text;limit_count integer;budget_now timestamptz;begin
 if p_mode is null or p_mode not in ('test','live') or (p_mode='test' and (p_allowlist is null or cardinality(p_allowlist) not between 1 and 20)) or (p_mode='live' and p_allowlist is not null) then return null;end if;
 select shop_id into s from public.appointment_email_outbox where id=p_id;
 perform 1 from public.shops where id=s for update;
 select * into target from public.appointments where id=(select appointment_id from public.appointment_email_outbox where id=p_id) for update;
 perform 1 from public.clients where id=target.client_id and shop_id=s for share;
 select * into o from public.appointment_email_outbox where id=p_id for update;
 if o.id is null or o.lease_token is distinct from p_lease_token or o.lease_until<=clock_timestamp() or o.state<>'leased' or p_lease_token is null
 or o.attempts>=5 or o.first_attempt_at<=clock_timestamp()-interval '23 hours'
 or not shop_private.reminder_eligible(o.appointment_id)
 or not exists(select 1 from public.appointments a join public.appointment_email_consents c on c.appointment_id=a.id and c.client_id=a.client_id and c.enabled
 where a.id=o.appointment_id and a.starts_at=o.appointment_starts_at and c.email=shop_private.reminder_contact(a.id))
 or p_payload->'to' is distinct from jsonb_build_array(shop_private.reminder_contact(o.appointment_id))
 or (p_mode='test' and not coalesce(shop_private.reminder_contact(o.appointment_id)=any(p_allowlist),false))
 or (o.payload is not null and o.payload is distinct from p_payload)
 then return null;end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('shop-appointment-email-budget',0));
 -- Waiting for the final global lock may outlive every time-based grant.
 if o.lease_until<=clock_timestamp() or o.appointment_starts_at<=clock_timestamp()
 or o.first_attempt_at<=clock_timestamp()-interval '23 hours' or not shop_private.reminder_eligible(o.appointment_id) then return null;end if;
 begin
 budget_now:=clock_timestamp();
 foreach b in array array['rate','day:'||to_char(budget_now at time zone 'UTC','YYYY-MM-DD'),'month:'||to_char(budget_now at time zone 'UTC','YYYY-MM'),'tenant:'||s::text||':'||to_char(budget_now at time zone 'UTC','YYYY-MM-DD')] loop
  limit_count:=case when b='rate' then 2147483647 when b like 'day:%' then 80 when b like 'month:%' then 2400 else 10 end;
  insert into public.appointment_email_budget(bucket) values(b) on conflict do nothing;
  if exists(select 1 from public.appointment_email_budget where bucket=b and (used>=limit_count or next_claim_at>clock_timestamp())) then return null;end if;
 end loop;
 update public.appointment_email_budget set used=used+1,next_claim_at=case when bucket='rate' then clock_timestamp()+interval '1 second' else next_claim_at end
 where bucket=any(array['rate','day:'||to_char(budget_now at time zone 'UTC','YYYY-MM-DD'),'month:'||to_char(budget_now at time zone 'UTC','YYYY-MM'),'tenant:'||s::text||':'||to_char(budget_now at time zone 'UTC','YYYY-MM-DD')]);
 update public.appointment_email_outbox set state='dispatching',dispatch_token=p_lease_token,payload=coalesce(payload,p_payload),attempts=attempts+1,first_attempt_at=coalesce(first_attempt_at,clock_timestamp()) where id=p_id and lease_token=p_lease_token and lease_until>clock_timestamp() and appointment_starts_at>clock_timestamp()
 and (first_attempt_at is null or first_attempt_at>clock_timestamp()-interval '23 hours')
 and shop_private.reminder_eligible(appointment_id) returning * into o;
 if not found then raise exception 'REMINDER_AUTHORIZATION_EXPIRED' using errcode='PRA01';end if;
 insert into public.appointment_email_events(shop_id,appointment_id,action) values(s,o.appointment_id,'authorized');
 return o.payload;
 exception when sqlstate 'PRA01' then return null;end;
end$$;


revoke all on function public.claim_appointment_email(text[],text),public.prepare_appointment_email(uuid,uuid,jsonb,text[],text) from public,anon,authenticated,service_role;
grant execute on function public.claim_appointment_email(text[],text),public.prepare_appointment_email(uuid,uuid,jsonb,text[],text) to service_role;

-- Existing Shop history installs pg_cron/pg_net and Vault; do not provision
-- extensions, credentials or jobs here. Operator activation is configuration.
create table public.appointment_email_schedule_settings (
 singleton boolean primary key default true check(singleton),enabled boolean not null default false,
 project_ref text check(project_ref in ('jvvelvftpfnlogalgxgv','fgdzjnsbcxfbiuogbmom')),
 updated_at timestamptz not null default clock_timestamp(),check(not enabled or project_ref is not null)
);
insert into public.appointment_email_schedule_settings(singleton) values(true);
create table public.appointment_email_schedule_events (
 id uuid primary key default gen_random_uuid(),enabled boolean not null,project_ref text not null,
 created_at timestamptz not null default clock_timestamp()
);
alter table public.appointment_email_schedule_settings enable row level security;
alter table public.appointment_email_schedule_events enable row level security;
revoke all on public.appointment_email_schedule_settings,public.appointment_email_schedule_events from public,anon,authenticated,service_role;

create function shop_private.reminder_schedule_binding(p_project_ref text,p_secrets jsonb) returns jsonb
language plpgsql set search_path='' as $$
declare project_url text;server_key text;worker_token text;begin
 if p_project_ref is null or p_project_ref not in ('jvvelvftpfnlogalgxgv','fgdzjnsbcxfbiuogbmom') then raise exception 'REMINDER_ENVIRONMENT_INVALID' using errcode='22023';end if;
 if p_secrets is null or jsonb_typeof(p_secrets)<>'array' or jsonb_array_length(p_secrets)<>3
 or (select count(distinct value->>'name') from jsonb_array_elements(p_secrets))<>3
 then raise exception 'REMINDER_SCHEDULE_NOT_CONFIGURED' using errcode='55000';end if;
 select value->>'value' into project_url from jsonb_array_elements(p_secrets) where value->>'name'='shop_reminder_project_url';
 select value->>'value' into server_key from jsonb_array_elements(p_secrets) where value->>'name'='shop_reminder_server_key';
 select value->>'value' into worker_token from jsonb_array_elements(p_secrets) where value->>'name'='shop_reminder_worker_token';
 if project_url is distinct from ('https://'||p_project_ref||'.supabase.co') or server_key is null or length(server_key)<32 or worker_token is null or length(worker_token)<32 then
  raise exception 'REMINDER_SCHEDULE_NOT_CONFIGURED' using errcode='55000';end if;
 return jsonb_build_object('url',project_url||'/functions/v1/shop-appointment-reminder-sender',
 'headers',jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||server_key,'apikey',server_key,'X-Shop-Reminder-Worker-Token',worker_token));
end$$;
create function shop_private.reminder_schedule_credentials(p_project_ref text) returns jsonb
language plpgsql security definer set search_path='' as $$declare secrets jsonb;begin
 select jsonb_agg(jsonb_build_object('name',name,'value',decrypted_secret)) into secrets from vault.decrypted_secrets
 where name in ('shop_reminder_project_url','shop_reminder_server_key','shop_reminder_worker_token');
 return shop_private.reminder_schedule_binding(p_project_ref,secrets);
end$$;
create function shop_private.reminder_schedule_http(p_url text,p_headers jsonb) returns bigint
language plpgsql security definer set search_path='' as $$begin
 return net.http_post(url:=p_url,headers:=p_headers,body:='{}'::jsonb,timeout_milliseconds:=60000);
end$$;
create function shop_private.appointment_email_scheduled_request() returns bigint
language plpgsql security definer set search_path='' as $$
declare settings public.appointment_email_schedule_settings;credentials jsonb;begin
 select * into settings from public.appointment_email_schedule_settings where singleton for share;
 if not coalesce(settings.enabled,false) then return null;end if;
 credentials:=shop_private.reminder_schedule_credentials(settings.project_ref);
 return shop_private.reminder_schedule_http(credentials->>'url',credentials->'headers');
end$$;
create function shop_private.reminder_schedule_cron(p_enabled boolean) returns bigint
language plpgsql security definer set search_path='' as $$declare job bigint;begin
 if p_enabled then
  job:=cron.schedule('shop-appointment-email-reminders','* * * * *','select shop_private.appointment_email_scheduled_request();');
 else
  select jobid into job from cron.job where jobname='shop-appointment-email-reminders' and username=current_user;
  if job is not null then perform cron.unschedule(job);end if;
 end if;
 return job;
end$$;
create function public.shop_appointment_email_schedule(p_enabled boolean,p_project_ref text) returns jsonb
language plpgsql security definer set search_path='' as $$declare job bigint;begin
 if (select auth.jwt()->>'role') is distinct from 'service_role' then raise exception 'REMINDER_SERVER_REQUIRED' using errcode='42501';end if;
 if p_enabled is null or p_project_ref is null or p_project_ref not in ('jvvelvftpfnlogalgxgv','fgdzjnsbcxfbiuogbmom') then raise exception 'REMINDER_ENVIRONMENT_INVALID' using errcode='22023';end if;
 perform 1 from public.appointment_email_schedule_settings where singleton for update;
 -- Disable never needs working secrets. It also waits for a current callback.
 if p_enabled then perform shop_private.reminder_schedule_credentials(p_project_ref);end if;
 job:=shop_private.reminder_schedule_cron(p_enabled);
 update public.appointment_email_schedule_settings set enabled=p_enabled,project_ref=p_project_ref,updated_at=clock_timestamp() where singleton;
 insert into public.appointment_email_schedule_events(enabled,project_ref) values(p_enabled,p_project_ref);
 return jsonb_build_object('enabled',p_enabled,'projectRef',p_project_ref,'jobId',job);
end$$;
revoke all on function shop_private.reminder_schedule_binding(text,jsonb),shop_private.reminder_schedule_credentials(text),shop_private.reminder_schedule_http(text,jsonb),shop_private.appointment_email_scheduled_request(),shop_private.reminder_schedule_cron(boolean) from public,anon,authenticated,service_role;
revoke all on function public.shop_appointment_email_schedule(boolean,text) from public,anon,authenticated,service_role;
grant execute on function public.shop_appointment_email_schedule(boolean,text) to service_role;
notify pgrst,'reload schema';

-- Public readiness flag reflects owner policy, never a promise of provider delivery.
create or replace function public.appointment_booking_options(p_slug text,p_token text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare shop uuid;scope jsonb;result jsonb;begin
 shop:=shop_private.booking_shop(p_slug);if shop is null then return '{"enabled":false}'::jsonb;end if;
 scope:=shop_private.appointment_access_scope(p_slug,p_token);
 select jsonb_build_object('enabled',true,'authenticated',scope is not null,'scope',case when scope is null then 'guest' when scope->>'customerId' is null then 'appointment' else 'customer' end,'expiresAt',scope->'expiresAt',
 'leadMinutes',p.lead_minutes,'horizonDays',p.horizon_days,'changeNoticeMinutes',p.change_notice_minutes,'allowReschedule',p.allow_reschedule,'allowCancel',p.allow_cancel,'remindersEnabled',p.reminders_enabled and p.reminder_channel='email',
 'combinations',coalesce((select jsonb_agg(jsonb_build_object('service',service_ref,'location',location_ref,'staff',staff_ref,'serviceName',service_name,'locationName',location_name,'address',address,'staffName',staff_name,'duration',duration+cleanup) order by service_name,location_name,staff_name,staff_ref)
 from (select * from shop_private.booking_combinations(shop) order by service_name,location_name,staff_name,staff_ref limit 500) x),'[]'::jsonb)) into result from public.shop_booking_policies p where p.shop_id=shop;
 return result;
exception when others then return '{"enabled":false}'::jsonb;end$$;


revoke all on function public.appointment_booking_options(text,text) from public,anon,authenticated,service_role;
grant execute on function public.appointment_booking_options(text,text) to anon,authenticated;
