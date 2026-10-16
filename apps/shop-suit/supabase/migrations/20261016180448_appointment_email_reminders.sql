-- Appointment email reminders. Delivery remains disabled/test-allowlisted in the
-- worker. No cron, credentials or actual recipients are installed by migration.
alter table public.shop_booking_policies
 drop constraint shop_booking_policies_reminders_enabled_check,
 drop constraint shop_booking_policies_reminder_channel_check,
 add constraint booking_email_channel check ((reminders_enabled and reminder_channel is not null and reminder_channel='email') or (not reminders_enabled and reminder_channel is null));

create table public.appointment_email_consents (
 appointment_id uuid primary key, shop_id uuid not null references public.shops(id),
 client_id uuid not null, email text not null, enabled boolean not null default false,
 locale text not null check(locale in ('en','ar')),
 credential_id uuid not null, updated_at timestamptz not null default clock_timestamp(),
 foreign key(appointment_id,shop_id) references public.appointments(id,shop_id),
 foreign key(client_id,shop_id) references public.clients(id,shop_id),
 foreign key(credential_id,shop_id) references public.appointment_access_credentials(id,shop_id)
);
create table public.appointment_email_outbox (
 id uuid primary key default gen_random_uuid(),shop_id uuid not null references public.shops(id),
 appointment_id uuid not null,appointment_starts_at timestamptz not null,due_at timestamptz not null,
 state text not null default 'queued' check(state in ('queued','leased','dispatching','retry','sent','cancelled','review_required')),
 attempts integer not null default 0 check(attempts between 0 and 5),
 lease_token uuid,dispatch_token uuid,lease_until timestamptz,first_attempt_at timestamptz,next_attempt_at timestamptz not null default clock_timestamp(),
 payload jsonb,provider_email_id text,last_error text,sent_at timestamptz,created_at timestamptz not null default clock_timestamp(),
 unique(appointment_id,appointment_starts_at),
 foreign key(appointment_id,shop_id) references public.appointments(id,shop_id)
);
create index appointment_email_due on public.appointment_email_outbox(next_attempt_at,due_at) where state in ('queued','retry','leased','dispatching');
create table public.appointment_email_events (
 id uuid primary key default gen_random_uuid(),shop_id uuid not null references public.shops(id),appointment_id uuid,
 action text not null check(action in ('opted_in','opted_out','authorized','sent','retry','review_required','policy_enabled','policy_disabled')),
 credential_id uuid,actor_user_id uuid,created_at timestamptz not null default clock_timestamp(),
 foreign key(appointment_id,shop_id) references public.appointments(id,shop_id)
);
-- Every provider POST, including retries, consumes an allowance. UTC buckets,
-- global serialization and a one-second gate keep multiple workers bounded.
create table public.appointment_email_budget (
 bucket text primary key,used integer not null default 0,next_claim_at timestamptz not null default '-infinity'
);
do $$declare t text;begin foreach t in array array['appointment_email_consents','appointment_email_outbox','appointment_email_events','appointment_email_budget'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
end loop;end$$;

create function shop_private.reminder_contact(p_appointment uuid) returns text language sql volatile set search_path='' as $$
 select lower(btrim(c.email)) from public.appointments a join public.clients c on c.id=a.client_id and c.shop_id=a.shop_id
 where a.id=p_appointment and a.identity_kind='customer' and c.is_active
 and length(btrim(c.email)) between 3 and 254
 and btrim(c.email) ~ '^[A-Za-z0-9.!#$%&''*+/=?^_`{|}~-]+@[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z]{2,63}$'
$$;
create function shop_private.reminder_eligible(p_appointment uuid) returns boolean language sql volatile set search_path='' as $$
 select exists(select 1 from public.appointments a
 join public.shop_booking_policies p on p.shop_id=a.shop_id and p.enabled and p.reminders_enabled and p.reminder_channel='email'
 join public.shops s on s.id=a.shop_id and s.status='active'
 join public.shop_locations l on l.id=a.location_id and l.shop_id=a.shop_id and l.status='active'
 where a.id=p_appointment and a.status='booked' and a.starts_at>clock_timestamp()
 and shop_private.reminder_contact(a.id) is not null
 and shop_private.booking_shop((select slug from public.shop_websites where shop_id=a.shop_id and publication_state='published'))=a.shop_id)
$$;
create function shop_private.reminder_enqueue(p_appointment uuid) returns void language plpgsql set search_path='' as $$begin
 insert into public.appointment_email_outbox(shop_id,appointment_id,appointment_starts_at,due_at)
 select a.shop_id,a.id,a.starts_at,a.starts_at-make_interval(mins=>p.reminder_lead_minutes)
 from public.appointments a join public.shop_booking_policies p on p.shop_id=a.shop_id
 join public.appointment_email_consents c on c.appointment_id=a.id and c.shop_id=a.shop_id and c.client_id=a.client_id and c.enabled
 and c.email=shop_private.reminder_contact(a.id)
 where a.id=p_appointment and shop_private.reminder_eligible(a.id)
 -- No catch-up reminder after its intended time, and never resurrect an old send.
 and a.starts_at-make_interval(mins=>p.reminder_lead_minutes)>clock_timestamp()
 on conflict(appointment_id,appointment_starts_at) do update set state='queued',due_at=excluded.due_at,next_attempt_at=clock_timestamp(),lease_token=null,lease_until=null
 where appointment_email_outbox.state='cancelled' and appointment_email_outbox.attempts=0 and appointment_email_outbox.payload is null;
end$$;
create function shop_private.reminder_invalidate() returns trigger language plpgsql security definer set search_path='' as $$begin
 update public.appointment_email_outbox set state='cancelled',lease_token=null,lease_until=null
 where appointment_id=new.id and state in ('queued','leased','dispatching','retry');
 if old.client_id is distinct from new.client_id then
  update public.appointment_email_consents set enabled=false,updated_at=clock_timestamp() where appointment_id=new.id;
 end if;
 perform shop_private.reminder_enqueue(new.id);return new;
end$$;
create trigger trg_email_reminder_invalidate after update of starts_at,status,client_id,location_id,assigned_membership_id,service_id on public.appointments
 for each row when (old.starts_at is distinct from new.starts_at or old.status is distinct from new.status or old.client_id is distinct from new.client_id or old.location_id is distinct from new.location_id or old.assigned_membership_id is distinct from new.assigned_membership_id or old.service_id is distinct from new.service_id)
 execute function shop_private.reminder_invalidate();
create function shop_private.reminder_contact_invalidate() returns trigger language plpgsql security definer set search_path='' as $$begin
 update public.appointment_email_consents set enabled=false,updated_at=clock_timestamp() where client_id=new.id and shop_id=new.shop_id;
 update public.appointment_email_outbox o set state='cancelled',lease_token=null,lease_until=null
 from public.appointments a where a.id=o.appointment_id and a.client_id=new.id and a.shop_id=new.shop_id and o.state in ('queued','leased','dispatching','retry');
 return new;
end$$;
create trigger trg_email_reminder_contact after update of email,is_active on public.clients for each row
 when (old.email is distinct from new.email or old.is_active is distinct from new.is_active) execute function shop_private.reminder_contact_invalidate();

-- Preserve the existing policy/staff command and its authorization/audit behavior.
alter function public.shop_booking_settings_save(uuid,jsonb,jsonb) rename to shop_booking_settings_save_before_email;
revoke all on function public.shop_booking_settings_save_before_email(uuid,jsonb,jsonb) from public,anon,authenticated,service_role;
create function public.shop_booking_settings_save(p_shop_id uuid,p_policy jsonb,p_staff jsonb) returns void language plpgsql security definer set search_path='' as $$
declare email_enabled boolean:=false;previous public.shop_booking_policies;begin
 if p_policy ? 'reminders_enabled' then
  if jsonb_typeof(p_policy->'reminders_enabled')<>'boolean' then raise exception 'INVALID_REMINDER_POLICY';end if;
  email_enabled:=(p_policy->>'reminders_enabled')::boolean;
 end if;
 perform shop_private.website_catalog_owner(p_shop_id);
 perform 1 from public.shops where id=p_shop_id for update;
 select * into previous from public.shop_booking_policies where shop_id=p_shop_id;
 perform public.shop_booking_settings_save_before_email(p_shop_id,p_policy-'reminders_enabled',p_staff);
 update public.shop_booking_policies set reminders_enabled=email_enabled,reminder_channel=case when email_enabled then 'email' end where shop_id=p_shop_id;
 -- Consent is retained; existing queue rows never resurrect on policy changes.
 update public.appointment_email_outbox set state='cancelled',lease_token=null,lease_until=null where shop_id=p_shop_id and state in ('queued','leased','dispatching','retry') and (not email_enabled or not (p_policy->>'enabled')::boolean or previous.reminder_lead_minutes is distinct from (p_policy->>'reminder_lead_minutes')::integer);
 insert into public.appointment_email_events(shop_id,actor_user_id,action) values(p_shop_id,auth.uid(),case when email_enabled then 'policy_enabled' else 'policy_disabled' end);
end$$;

create function public.appointment_reminder_preference(p_slug text,p_token text,p_reference uuid,p_enabled boolean,p_locale text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare scope jsonb;shop uuid;a public.appointments;email text;begin
 shop:=shop_private.booking_shop(p_slug);scope:=shop_private.appointment_access_scope(p_slug,p_token);
 if shop is null or scope is null or scope->>'customerId' is null or p_enabled is null or p_locale not in ('en','ar') or p_locale is null then return '{"ok":false}'::jsonb;end if;
 if not shop_private.appointment_access_rate('reminder-consent:'||coalesce(scope->>'credentialId',''),20) then return '{"ok":false}'::jsonb;end if;
 perform 1 from public.shops where id=shop for update;
 scope:=shop_private.booking_lock_scope(p_slug,p_token,scope);
 select * into a from public.appointments where id=shop_private.booking_own(scope,p_reference);
 if a.id is null then return '{"ok":false}'::jsonb;end if;
 perform 1 from public.appointments where id=a.id for update;
 -- Recheck capability, identity, contact and eligibility after every lock wait.
 scope:=shop_private.appointment_access_scope(p_slug,p_token);select * into a from public.appointments where id=shop_private.booking_own(scope,p_reference);
 email:=shop_private.reminder_contact(a.id);
 if scope->>'customerId' is null or a.id is null or a.client_id is distinct from (scope->>'customerId')::uuid
 or (p_enabled and (not shop_private.reminder_eligible(a.id)
 or not exists(select 1 from public.shop_booking_policies p where p.shop_id=shop and a.starts_at-make_interval(mins=>p.reminder_lead_minutes)>clock_timestamp())
 or exists(select 1 from public.appointment_email_outbox o where o.appointment_id=a.id and o.appointment_starts_at=a.starts_at and o.attempts>0 and o.state in ('cancelled','sent','review_required')))) then return '{"ok":false}'::jsonb;end if;
 if p_enabled then
  insert into public.appointment_email_consents(appointment_id,shop_id,client_id,email,enabled,locale,credential_id)
  values(a.id,shop,a.client_id,email,true,p_locale,(scope->>'credentialId')::uuid)
  on conflict(appointment_id) do update set email=excluded.email,client_id=excluded.client_id,enabled=true,locale=excluded.locale,credential_id=excluded.credential_id,updated_at=clock_timestamp();
  perform shop_private.reminder_enqueue(a.id);
 else
  update public.appointment_email_consents set enabled=false,updated_at=clock_timestamp() where appointment_id=a.id and shop_id=shop;
  update public.appointment_email_outbox set state='cancelled',lease_token=null,lease_until=null where appointment_id=a.id and state in ('queued','leased','dispatching','retry');
 end if;
 insert into public.appointment_email_events(shop_id,appointment_id,credential_id,action) values(shop,a.id,(scope->>'credentialId')::uuid,case when p_enabled then 'opted_in' else 'opted_out' end);
 return '{"ok":true}'::jsonb;
end$$;

-- Extend only the already-authorized management projection, never return email.
alter function public.appointment_booking_manage(text,text,integer) rename to appointment_booking_manage_before_email;
revoke all on function public.appointment_booking_manage_before_email(text,text,integer) from public,anon,authenticated,service_role;
create function public.appointment_booking_manage(p_slug text,p_token text,p_page integer default 1) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;begin
 result:=public.appointment_booking_manage_before_email(p_slug,p_token,p_page);
 if result->>'authenticated'<>'true' then return result;end if;
 return result||jsonb_build_object('items',coalesce((select jsonb_agg(item||jsonb_build_object(
 'reminderEligible',coalesce(result->>'scope'='customer' and shop_private.reminder_eligible(r.appointment_id)
 and exists(select 1 from public.appointments a join public.shop_booking_policies p on p.shop_id=a.shop_id where a.id=r.appointment_id and a.starts_at-make_interval(mins=>p.reminder_lead_minutes)>clock_timestamp())
 and not exists(select 1 from public.appointment_email_outbox o join public.appointments a on a.id=o.appointment_id where o.appointment_id=r.appointment_id and o.appointment_starts_at=a.starts_at and o.attempts>0 and o.state in ('cancelled','sent','review_required')),false),
 'reminderEnabled',exists(select 1 from public.appointment_email_consents c where c.appointment_id=r.appointment_id and c.enabled and c.email=shop_private.reminder_contact(r.appointment_id))) order by ordinal)
 from jsonb_array_elements(result->'items') with ordinality v(item,ordinal)
 join public.appointment_booking_references r on r.reference=(item->>'reference')::uuid),'[]'::jsonb));
end$$;

-- Worker contract: only a server role can invoke; browser roles have no queue
-- access. The explicit allowlist is enforced again in SQL and frozen-payload checks.
create function public.claim_appointment_email(p_allowlist text[]) returns jsonb language plpgsql security definer set search_path='' as $$
declare o public.appointment_email_outbox;s uuid;begin
 if p_allowlist is null or cardinality(p_allowlist) not between 1 and 20 then return null;end if;
 -- Pick a tenant first without taking queue locks: all commands use Shop first.
 select q.shop_id into s from public.appointment_email_outbox q where q.state in ('queued','retry','leased','dispatching')
 and shop_private.reminder_contact(q.appointment_id)=any(p_allowlist) and q.due_at<=clock_timestamp() and q.next_attempt_at<=clock_timestamp() and (q.lease_until is null or q.lease_until<clock_timestamp())
 order by q.next_attempt_at,q.due_at,q.id limit 1;
 if s is null then return null;end if;
 perform 1 from public.shops where id=s for update skip locked;if not found then return null;end if;
 select * into o from public.appointment_email_outbox q where q.shop_id=s and q.state in ('queued','retry','leased','dispatching')
 and shop_private.reminder_contact(q.appointment_id)=any(p_allowlist) and q.due_at<=clock_timestamp() and q.next_attempt_at<=clock_timestamp() and (q.lease_until is null or q.lease_until<clock_timestamp())
 order by q.next_attempt_at,q.due_at,q.id for update skip locked limit 1;
 if o.id is null then return null;end if;
 if not shop_private.reminder_eligible(o.appointment_id) or not exists(select 1 from public.appointment_email_consents c
 join public.appointments a on a.id=c.appointment_id and a.shop_id=c.shop_id and a.starts_at=o.appointment_starts_at and a.client_id=c.client_id
 where c.appointment_id=o.appointment_id and c.enabled and c.email=shop_private.reminder_contact(a.id)) then
  update public.appointment_email_outbox set state='cancelled',lease_token=null,lease_until=null where id=o.id;return null;
 end if;
 if not (shop_private.reminder_contact(o.appointment_id)=any(p_allowlist)) then return null;end if;
 if o.attempts>=5 or o.first_attempt_at<=clock_timestamp()-interval '23 hours' then
  update public.appointment_email_outbox set state='review_required',lease_token=null,lease_until=null,last_error='retry_window_exhausted' where id=o.id;return null;
 end if;
 update public.appointment_email_outbox set state='leased',lease_token=gen_random_uuid(),lease_until=clock_timestamp()+interval '2 minutes'
 where id=o.id returning * into o;
 return jsonb_build_object('id',o.id,'leaseToken',o.lease_token,'payload',o.payload,'to',shop_private.reminder_contact(o.appointment_id),
 'startsAt',o.appointment_starts_at,'locale',(select locale from public.appointment_email_consents where appointment_id=o.appointment_id),
 'shopName',(select name from public.shops where id=o.shop_id),
 'timeZone',coalesce((select h.timezone from public.appointment_working_hours h join public.appointments a on a.id=o.appointment_id and a.shop_id=h.shop_id
 and a.location_id=h.location_id and a.assigned_membership_id=h.membership_id order by h.weekday limit 1),'UTC'));
end$$;

create function public.prepare_appointment_email(p_id uuid,p_lease_token uuid,p_payload jsonb,p_allowlist text[]) returns jsonb
language plpgsql security definer set search_path='' as $$
declare o public.appointment_email_outbox;s uuid;target public.appointments;b text;limit_count integer;budget_now timestamptz;begin
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
 or not coalesce(shop_private.reminder_contact(o.appointment_id)=any(p_allowlist),false)
 or (o.payload is not null and o.payload is distinct from p_payload)
 then return null;end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('shop-appointment-email-budget',0));
 budget_now:=clock_timestamp();
 foreach b in array array['rate','day:'||to_char(budget_now at time zone 'UTC','YYYY-MM-DD'),'month:'||to_char(budget_now at time zone 'UTC','YYYY-MM'),'tenant:'||s::text||':'||to_char(budget_now at time zone 'UTC','YYYY-MM-DD')] loop
  limit_count:=case when b='rate' then 2147483647 when b like 'day:%' then 80 when b like 'month:%' then 2400 else 10 end;
  insert into public.appointment_email_budget(bucket) values(b) on conflict do nothing;
  if exists(select 1 from public.appointment_email_budget where bucket=b and (used>=limit_count or next_claim_at>clock_timestamp())) then return null;end if;
 end loop;
 update public.appointment_email_budget set used=used+1,next_claim_at=case when bucket='rate' then clock_timestamp()+interval '1 second' else next_claim_at end
 where bucket=any(array['rate','day:'||to_char(budget_now at time zone 'UTC','YYYY-MM-DD'),'month:'||to_char(budget_now at time zone 'UTC','YYYY-MM'),'tenant:'||s::text||':'||to_char(budget_now at time zone 'UTC','YYYY-MM-DD')]);
 update public.appointment_email_outbox set state='dispatching',dispatch_token=p_lease_token,payload=coalesce(payload,p_payload),attempts=attempts+1,first_attempt_at=coalesce(first_attempt_at,clock_timestamp()) where id=p_id returning * into o;
 insert into public.appointment_email_events(shop_id,appointment_id,action) values(s,o.appointment_id,'authorized');
 return o.payload;
end$$;

create function public.finish_appointment_email(p_id uuid,p_lease_token uuid,p_status text,p_provider_id text default null) returns boolean
language plpgsql security definer set search_path='' as $$
declare o public.appointment_email_outbox;s uuid;begin
 select shop_id into s from public.appointment_email_outbox where id=p_id;perform 1 from public.shops where id=s for update;
 select * into o from public.appointment_email_outbox where id=p_id for update;
 -- Preserve a late acceptance receipt after cancellation without re-enabling
 -- the queue or accepting stale retry/failure transitions.
 if o.state='cancelled' and p_status='sent' and o.dispatch_token=p_lease_token and o.provider_email_id is null
 and p_provider_id is not null and length(p_provider_id) between 1 and 128 then
  update public.appointment_email_outbox set provider_email_id=p_provider_id,sent_at=clock_timestamp() where id=p_id;
  insert into public.appointment_email_events(shop_id,appointment_id,action) values(s,o.appointment_id,'sent');return true;
 end if;
 if o.state<>'dispatching' or o.lease_token is distinct from p_lease_token or p_lease_token is null or o.lease_until<=clock_timestamp() then return false;end if;
 if p_status is null or p_status not in ('sent','retry','review_required') or (p_status='sent' and (p_provider_id is null or length(p_provider_id) not between 1 and 128)) then raise exception 'INVALID_REMINDER_RESULT';end if;
 update public.appointment_email_outbox set state=case when p_status='retry' and (attempts>=5 or first_attempt_at<=clock_timestamp()-interval '23 hours') then 'review_required' else p_status end,
 provider_email_id=case when p_status='sent' then p_provider_id end,sent_at=case when p_status='sent' then clock_timestamp() end,
 next_attempt_at=clock_timestamp()+make_interval(secs=>least(3600,60*power(2,attempts)::integer)),lease_token=null,lease_until=null,
 last_error=case when p_status='retry' then 'provider_result_uncertain' when p_status='review_required' then 'provider_rejected' end where id=p_id;
 insert into public.appointment_email_events(shop_id,appointment_id,action) values(s,o.appointment_id,p_status);return true;
end$$;

revoke all on function public.shop_booking_settings_save(uuid,jsonb,jsonb),public.appointment_reminder_preference(text,text,uuid,boolean,text),public.appointment_booking_manage(text,text,integer),public.claim_appointment_email(text[]),public.prepare_appointment_email(uuid,uuid,jsonb,text[]),public.finish_appointment_email(uuid,uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function public.shop_booking_settings_save(uuid,jsonb,jsonb) to authenticated;
grant execute on function public.appointment_reminder_preference(text,text,uuid,boolean,text),public.appointment_booking_manage(text,text,integer) to anon,authenticated;
grant execute on function public.claim_appointment_email(text[]),public.prepare_appointment_email(uuid,uuid,jsonb,text[]),public.finish_appointment_email(uuid,uuid,text,text) to service_role;
revoke all on function shop_private.reminder_contact(uuid),shop_private.reminder_eligible(uuid),shop_private.reminder_enqueue(uuid),shop_private.reminder_invalidate(),shop_private.reminder_contact_invalidate() from public,anon,authenticated,service_role;
