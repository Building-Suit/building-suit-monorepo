-- SS-APPT-002. Explicit public booking only. No delivery provider or automatic opt-in.
create table public.shop_booking_policies (
 shop_id uuid primary key references public.shops(id) on delete restrict,
 enabled boolean not null default false,
 lead_minutes integer not null default 60 check(lead_minutes between 0 and 10080),
 horizon_days integer not null default 30 check(horizon_days between 1 and 90),
 change_notice_minutes integer not null default 120 check(change_notice_minutes between 0 and 10080),
 allow_reschedule boolean not null default true,allow_cancel boolean not null default true,
 reminder_lead_minutes integer not null default 1440 check(reminder_lead_minutes between 15 and 10080),
 reminders_enabled boolean not null default false check(not reminders_enabled),
 reminder_channel text check(reminder_channel is null),
 updated_at timestamptz not null default clock_timestamp()
);
create table public.shop_booking_staff (
 public_id uuid primary key default gen_random_uuid(),shop_id uuid not null references public.shops(id),
 membership_id uuid not null,public_name text not null check(length(btrim(public_name)) between 2 and 120 and public_name !~ '[[:cntrl:]]'),
 published boolean not null default false,unique(shop_id,membership_id),
 foreign key(membership_id,shop_id) references public.shop_memberships(id,shop_id)
);
create table public.appointment_booking_references (
 reference uuid primary key default gen_random_uuid(),shop_id uuid not null references public.shops(id),appointment_id uuid not null unique,
 foreign key(appointment_id,shop_id) references public.appointments(id,shop_id)
);
create table public.appointment_booking_commands (
 key_hash bytea primary key check(octet_length(key_hash)=32),shop_id uuid not null references public.shops(id),
 operation text not null check(operation in ('create','reschedule','cancel')),payload_hash bytea not null,
 appointment_id uuid not null,credential_id uuid,guest boolean not null default false,created_at timestamptz not null default clock_timestamp(),
 foreign key(appointment_id,shop_id) references public.appointments(id,shop_id),
 foreign key(credential_id,shop_id) references public.appointment_access_credentials(id,shop_id)
);
create table public.appointment_booking_events (
 id uuid primary key default gen_random_uuid(),shop_id uuid not null references public.shops(id),appointment_id uuid,
 actor_user_id uuid,credential_id uuid,action text not null check(action in ('policy_saved','created','rescheduled','cancelled','session_issued')),
 occurred_at timestamptz not null default clock_timestamp(),
 foreign key(appointment_id,shop_id) references public.appointments(id,shop_id)
);
-- Disabled intents are deliberately not a delivery queue. Future integration
-- requires a reviewed forward migration and an approved channel, never a secret here.
create table public.appointment_reminder_intents (
 id uuid primary key default gen_random_uuid(),shop_id uuid not null references public.shops(id),appointment_id uuid not null,
 appointment_starts_at timestamptz not null,scheduled_for timestamptz not null,
 state text not null default 'disabled' check(state in ('disabled','cancelled')),
 created_at timestamptz not null default clock_timestamp(),constraint booking_reminder_unique unique(appointment_id,appointment_starts_at),
 foreign key(appointment_id,shop_id) references public.appointments(id,shop_id)
);
create index appointment_reminder_intents_shop on public.appointment_reminder_intents(shop_id,appointment_id);
do $$declare t text;begin foreach t in array array['shop_booking_policies','shop_booking_staff','appointment_booking_references','appointment_booking_commands','appointment_booking_events','appointment_reminder_intents'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
end loop;end$$;

-- Public customers are represented honestly, without inventing a staff actor.
alter table public.appointments add column booking_origin text not null default 'staff' check(booking_origin in ('staff','public'));
alter table public.appointments alter column created_by_profile_id drop not null;
alter table public.appointments add constraint appointments_actor_origin check(created_by_profile_id is not null or booking_origin='public');
alter table public.appointment_events add column actor_kind text not null default 'staff' check(actor_kind in ('staff','public_customer'));
alter table public.appointment_events alter column actor_profile_id drop not null;
alter table public.appointment_events add constraint appointment_events_actor_kind check(actor_profile_id is not null or actor_kind='public_customer');
alter table public.appointment_access_credentials add column issuance_origin text not null default 'staff' check(issuance_origin in ('staff','public_booking'));
alter table public.appointment_access_credentials alter column issued_by_profile_id drop not null;
alter table public.appointment_access_credentials add constraint appointment_access_issuer_origin check(issued_by_profile_id is not null or issuance_origin='public_booking');

create or replace function shop_private.validate_location_participants()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_membership_id uuid;
begin
  if tg_table_name = 'appointments' then
    v_membership_id := cast((to_jsonb(new)->>'assigned_membership_id') as uuid);
    if not (new.created_by_profile_id is null and new.booking_origin='public') and not exists (
      select 1 from public.shop_memberships membership
      join public.profiles profile on profile.id = membership.profile_id
      where membership.shop_id = new.shop_id
        and membership.profile_id = cast((to_jsonb(new)->>'created_by_profile_id') as uuid)
        and membership.status = 'active'
        and profile.status = 'active'
        and (coalesce(auth.role(), '') <> 'authenticated' or profile.user_id = auth.uid())
    ) then
      raise exception 'INVALID_APPOINTMENT_ACTOR' using errcode = '23514';
    end if;
  else
    v_membership_id := case when new.status = 'closed'
      then cast((to_jsonb(new)->>'closed_by_membership_id') as uuid) else cast((to_jsonb(new)->>'opened_by_membership_id') as uuid) end;
  end if;
  if v_membership_id is not null and not exists (
    select 1 from public.shop_memberships membership
    where membership.id = v_membership_id and membership.shop_id = new.shop_id
      and membership.status = 'active'
      and (membership.role = 'owner' or exists (
        select 1 from public.membership_location_assignments assignment
        where assignment.shop_id = new.shop_id
          and assignment.membership_id = membership.id
          and assignment.location_id = new.location_id
      ))
  ) then
    raise exception 'STAFF_LOCATION_ASSIGNMENT_REQUIRED' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' and (
    new.shop_id is distinct from old.shop_id
    or new.location_id is distinct from old.location_id
  ) then
    raise exception 'OPERATIONAL_LOCATION_IMMUTABLE' using errcode = '55000';
  end if;
  if tg_op = 'UPDATE' and tg_table_name = 'appointments'
    and cast((to_jsonb(new)->>'created_by_profile_id') as uuid) is distinct from cast((to_jsonb(old)->>'created_by_profile_id') as uuid) then
    raise exception 'APPOINTMENT_ACTOR_IMMUTABLE' using errcode = '55000';
  end if;
  if tg_op = 'UPDATE' and tg_table_name = 'cash_sessions' and (
    cast((to_jsonb(new)->>'opened_by_membership_id') as uuid) is distinct from cast((to_jsonb(old)->>'opened_by_membership_id') as uuid)
    or cast((to_jsonb(new)->>'opening_amount') as numeric(12,2)) is distinct from cast((to_jsonb(old)->>'opening_amount') as numeric(12,2))
    or cast((to_jsonb(new)->>'opened_at') as timestamp with time zone) is distinct from cast((to_jsonb(old)->>'opened_at') as timestamp with time zone)
  ) then
    raise exception 'CASH_SESSION_OPENING_IMMUTABLE' using errcode = '55000';
  end if;
  return new;
end;
$$;

create or replace function shop_private.audit_appointment()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_action text; v_actor uuid;
begin
  select membership.profile_id into v_actor
  from public.shop_memberships membership
  join public.profiles profile on profile.id = membership.profile_id
  where membership.shop_id = new.shop_id and profile.user_id = auth.uid()
    and membership.status = 'active' and profile.status = 'active';
  v_actor := coalesce(v_actor, new.created_by_profile_id);
  if current_setting('shop.public_booking',true)='true' then v_actor:=null;end if;
  v_action := case
    when tg_op = 'INSERT' then 'created'
    when new.sale_id is distinct from old.sale_id then 'sale_linked'
    when new.status is distinct from old.status then 'status_changed'
    when new.starts_at is distinct from old.starts_at
      or new.ends_at is distinct from old.ends_at
      or new.assigned_membership_id is distinct from old.assigned_membership_id then 'rescheduled'
    else 'updated' end;
  insert into public.appointment_events (
    request_id, shop_id, appointment_id, actor_profile_id, actor_kind, action, before_state, after_state
  ) values (
    nullif(current_setting('shop.appointment_request_id', true), '')::uuid,
    new.shop_id, new.id, v_actor, case when v_actor is null then 'public_customer' else 'staff' end, v_action,
    case when tg_op = 'UPDATE' then to_jsonb(old) end, to_jsonb(new)
  );
  return new;
end;
$$;
-- Serialize schedule edits with both staff-managed and public reservations.
alter function shop_private.save_staff_schedule(uuid,uuid,uuid,text,jsonb,jsonb) rename to save_staff_schedule_before_public_booking;
create function shop_private.save_staff_schedule(p_shop_id uuid,p_location_id uuid,p_membership_id uuid,p_timezone text,p_working_hours jsonb,p_blocks jsonb)
returns void language plpgsql security definer set search_path='' as $$begin
 perform shop_private.appointment_actor_profile(p_shop_id,'appointments.schedule.manage');
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_membership_id::text,0));
 perform shop_private.save_staff_schedule_before_public_booking(p_shop_id,p_location_id,p_membership_id,p_timezone,p_working_hours,p_blocks);
end$$;

create function public.shop_booking_settings(p_shop_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;begin
 perform shop_private.website_catalog_owner(p_shop_id);
 select jsonb_build_object('policy',coalesce((select to_jsonb(p)-'shop_id'-'updated_at' from public.shop_booking_policies p where shop_id=p_shop_id),
 '{"enabled":false,"lead_minutes":60,"horizon_days":30,"change_notice_minutes":120,"allow_reschedule":true,"allow_cancel":true,"reminder_lead_minutes":1440,"reminders_enabled":false,"reminder_channel":null}'::jsonb),
 'staff',coalesce((select jsonb_agg(jsonb_build_object('membershipId',m.id,'name',p.display_name,'publicName',coalesce(bs.public_name,''),'published',coalesce(bs.published,false)) order by p.display_name,m.id)
 from public.shop_memberships m join public.profiles p on p.id=m.profile_id left join public.shop_booking_staff bs on bs.shop_id=m.shop_id and bs.membership_id=m.id
 where m.shop_id=p_shop_id and m.status='active' and m.removed_at is null and p.status='active'),'[]'::jsonb)) into result;
 return result;
end$$;
create function public.shop_booking_settings_save(p_shop_id uuid,p_policy jsonb,p_staff jsonb) returns void language plpgsql security definer set search_path='' as $$
declare item jsonb;begin
 perform shop_private.website_catalog_owner(p_shop_id);perform shop_private.assert_shop_write_access(p_shop_id,'settings.manage');
 perform 1 from public.shops where id=p_shop_id for update;
 perform shop_private.website_catalog_owner(p_shop_id);perform shop_private.assert_shop_write_access(p_shop_id,'settings.manage');
 if jsonb_typeof(p_policy)<>'object' or jsonb_typeof(p_staff)<>'array' or jsonb_array_length(p_staff)>200
 or (p_policy-'enabled'-'lead_minutes'-'horizon_days'-'change_notice_minutes'-'allow_reschedule'-'allow_cancel'-'reminder_lead_minutes')<>'{}'::jsonb
 or jsonb_typeof(p_policy->'enabled')<>'boolean' or jsonb_typeof(p_policy->'allow_reschedule')<>'boolean' or jsonb_typeof(p_policy->'allow_cancel')<>'boolean'
 or jsonb_typeof(p_policy->'lead_minutes')<>'number' or jsonb_typeof(p_policy->'horizon_days')<>'number' or jsonb_typeof(p_policy->'change_notice_minutes')<>'number' or jsonb_typeof(p_policy->'reminder_lead_minutes')<>'number'
 or (select count(*) from jsonb_array_elements(p_staff))<>(select count(distinct v->>'membershipId') from jsonb_array_elements(p_staff) v) then raise exception 'INVALID_BOOKING_POLICY';end if;
 update public.shop_booking_staff set published=false where shop_id=p_shop_id;
 for item in select value from jsonb_array_elements(p_staff) loop
  if (item-'membershipId'-'publicName')<>'{}'::jsonb or not exists(select 1 from public.shop_memberships m join public.profiles p on p.id=m.profile_id where m.id=(item->>'membershipId')::uuid and m.shop_id=p_shop_id and m.status='active' and m.removed_at is null and p.status='active') then raise exception 'INVALID_BOOKING_STAFF';end if;
  insert into public.shop_booking_staff(shop_id,membership_id,public_name,published) values(p_shop_id,(item->>'membershipId')::uuid,btrim(item->>'publicName'),true)
  on conflict(shop_id,membership_id) do update set public_name=excluded.public_name,published=true;
 end loop;
 insert into public.shop_booking_policies(shop_id,enabled,lead_minutes,horizon_days,change_notice_minutes,allow_reschedule,allow_cancel,reminder_lead_minutes)
 values(p_shop_id,(p_policy->>'enabled')::boolean,(p_policy->>'lead_minutes')::integer,(p_policy->>'horizon_days')::integer,(p_policy->>'change_notice_minutes')::integer,(p_policy->>'allow_reschedule')::boolean,(p_policy->>'allow_cancel')::boolean,(p_policy->>'reminder_lead_minutes')::integer)
 on conflict(shop_id) do update set enabled=excluded.enabled,lead_minutes=excluded.lead_minutes,horizon_days=excluded.horizon_days,change_notice_minutes=excluded.change_notice_minutes,allow_reschedule=excluded.allow_reschedule,allow_cancel=excluded.allow_cancel,reminder_lead_minutes=excluded.reminder_lead_minutes,updated_at=clock_timestamp();
 insert into public.appointment_booking_events(shop_id,actor_user_id,action) values(p_shop_id,auth.uid(),'policy_saved');
end$$;

-- Only independent published catalogue/profile/staff values leave this boundary.
create function shop_private.booking_combinations(p_shop_id uuid)
returns table(service_ref uuid,location_ref uuid,staff_ref uuid,service_id uuid,membership_id uuid,service_name text,location_name text,address text,staff_name text,duration integer,cleanup integer)
language sql stable set search_path='' as $$
 select c.id,l.id,bs.public_id,s.id,m.id,c.public_name,v->>'publicName',coalesce(v->>'address',''),bs.public_name,s.duration_minutes,s.cleanup_minutes
 from public.shop_website_catalog_entries c join public.services s on s.id=c.service_id and s.shop_id=c.shop_id and s.is_active and s.scheduling_enabled
 join public.service_location_availability sl on sl.service_id=s.id and sl.shop_id=s.shop_id
 join public.shop_locations l on l.id=sl.location_id and l.shop_id=s.shop_id and l.status='active'
 join public.shop_website_profiles wp on wp.shop_id=s.shop_id cross join lateral jsonb_array_elements(wp.published->'locations') v
 join public.service_staff_eligibility se on se.service_id=s.id and se.shop_id=s.shop_id
 join public.shop_memberships m on m.id=se.membership_id and m.shop_id=s.shop_id and m.status='active' and m.removed_at is null
 join public.profiles p on p.id=m.profile_id and p.status='active'
 join public.membership_location_assignments mla on mla.shop_id=s.shop_id and mla.location_id=l.id and mla.membership_id=m.id
 join public.shop_booking_staff bs on bs.shop_id=s.shop_id and bs.membership_id=m.id and bs.published
 where c.shop_id=p_shop_id and c.published and (not c.show_price or (s.base_sale_price is not null and s.base_sale_price>=0 and s.base_sale_price::text not in ('NaN','Infinity','-Infinity'))) and v->>'id'=l.id::text and v->'visible'='true'::jsonb;
$$;
create function shop_private.booking_shop(p_slug text) returns uuid language plpgsql stable set search_path='' as $$
declare shop uuid;begin
 if public.shop_website_public_profile(p_slug) is null then return null;end if;
 select c.shop_id into shop from public.shop_website_slug_claims c join public.shop_booking_policies p on p.shop_id=c.shop_id and p.enabled where c.slug=p_slug;
 return shop;
end$$;
create function public.appointment_booking_options(p_slug text,p_token text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare shop uuid;scope jsonb;result jsonb;begin
 shop:=shop_private.booking_shop(p_slug);if shop is null then return '{"enabled":false}'::jsonb;end if;
 scope:=shop_private.appointment_access_scope(p_slug,p_token);
 select jsonb_build_object('enabled',true,'authenticated',scope is not null,'scope',case when scope is null then 'guest' when scope->>'customerId' is null then 'appointment' else 'customer' end,'expiresAt',scope->'expiresAt',
 'leadMinutes',p.lead_minutes,'horizonDays',p.horizon_days,'changeNoticeMinutes',p.change_notice_minutes,'allowReschedule',p.allow_reschedule,'allowCancel',p.allow_cancel,'remindersEnabled',false,
 'combinations',coalesce((select jsonb_agg(jsonb_build_object('service',service_ref,'location',location_ref,'staff',staff_ref,'serviceName',service_name,'locationName',location_name,'address',address,'staffName',staff_name,'duration',duration+cleanup) order by service_name,location_name,staff_name,staff_ref)
 from (select * from shop_private.booking_combinations(shop) order by service_name,location_name,staff_name,staff_ref limit 500) x),'[]'::jsonb)) into result from public.shop_booking_policies p where p.shop_id=shop;
 return result;
exception when others then return '{"enabled":false}'::jsonb;end$$;

create function shop_private.booking_slot_available(p_shop uuid,p_service uuid,p_location uuid,p_staff uuid,p_start timestamptz,p_exclude uuid default null) returns boolean
language sql volatile set search_path='' as $$
 select exists(select 1 from shop_private.booking_combinations(p_shop) c
 join public.shop_booking_policies policy on policy.shop_id=p_shop and policy.enabled
 join public.appointment_working_hours h on h.shop_id=p_shop and h.location_id=c.location_ref and h.membership_id=c.membership_id
 where c.service_ref=p_service and c.location_ref=p_location and c.staff_ref=p_staff
 and p_start>=clock_timestamp()+make_interval(mins=>policy.lead_minutes) and p_start<=clock_timestamp()+make_interval(days=>policy.horizon_days)
 and extract(dow from p_start at time zone h.timezone)=h.weekday
 and (p_start at time zone h.timezone)::time>=h.starts_local
 and ((p_start+make_interval(mins=>c.duration+c.cleanup)) at time zone h.timezone)::date=(p_start at time zone h.timezone)::date
 and ((p_start+make_interval(mins=>c.duration+c.cleanup)) at time zone h.timezone)::time<=h.ends_local
 and mod(extract(epoch from ((p_start at time zone h.timezone)::time-h.starts_local))::numeric,900)=0
 and not exists(select 1 from public.appointments a where a.assigned_membership_id=c.membership_id and a.id is distinct from p_exclude and a.status in ('booked','arrived','waiting','in_service') and tstzrange(a.starts_at,a.ends_at,'[)')&&tstzrange(p_start,p_start+make_interval(mins=>c.duration+c.cleanup),'[)'))
 and not exists(select 1 from public.appointment_schedule_blocks b where b.shop_id=p_shop and b.location_id=c.location_ref and b.membership_id=c.membership_id and tstzrange(b.starts_at,b.ends_at,'[)')&&tstzrange(p_start,p_start+make_interval(mins=>c.duration+c.cleanup),'[)')));
$$;
create function shop_private.booking_own(p_scope jsonb,p_reference uuid) returns uuid language sql stable set search_path='' as $$
 select a.id from public.appointments a join public.appointment_booking_references r on r.appointment_id=a.id and r.shop_id=a.shop_id
 where r.reference=p_reference and a.shop_id=(p_scope->>'shopId')::uuid
 and ((p_scope->>'customerId' is not null and a.identity_kind='customer' and a.client_id=(p_scope->>'customerId')::uuid)
 or(p_scope->>'customerId' is null and a.identity_kind='walk_in' and a.client_id is null and a.id=(p_scope->>'appointmentId')::uuid));
$$;
create function public.appointment_booking_slots(p_slug text,p_service uuid,p_location uuid,p_staff uuid,p_date date,p_token text default null,p_reference uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare shop uuid;scope jsonb;appointment uuid;result jsonb;begin
 shop:=shop_private.booking_shop(p_slug);if shop is null or p_date is null or p_date<current_date-1 or p_date>current_date+91 then return '{"slots":[]}'::jsonb;end if;
 if p_reference is not null then scope:=shop_private.appointment_access_scope(p_slug,p_token);appointment:=shop_private.booking_own(scope,p_reference);if appointment is null then return '{"slots":[]}'::jsonb;end if;end if;
 select jsonb_build_object('slots',coalesce(jsonb_agg(jsonb_build_object('startsAt',t,'endsAt',t+make_interval(mins=>duration+cleanup),'timeZone',timezone) order by t),'[]'::jsonb)) into result from (
  select distinct local_slot at time zone h.timezone t,h.timezone,c.duration,c.cleanup
  from shop_private.booking_combinations(shop) c join public.appointment_working_hours h on h.shop_id=shop and h.location_id=c.location_ref and h.membership_id=c.membership_id
  cross join lateral generate_series(p_date+h.starts_local,p_date+h.ends_local-make_interval(mins=>c.duration+c.cleanup),interval '15 minutes') local_slot
  where c.service_ref=p_service and c.location_ref=p_location and c.staff_ref=p_staff and h.weekday=extract(dow from p_date)
  and ((local_slot at time zone h.timezone) at time zone h.timezone)=local_slot
  and shop_private.booking_slot_available(shop,p_service,p_location,p_staff,local_slot at time zone h.timezone,appointment) order by t limit 200
 ) slots;
 return result;
exception when others then return '{"slots":[]}'::jsonb;end$$;
create function public.appointment_booking_manage(p_slug text,p_token text,p_page integer default 1) returns jsonb
language plpgsql security definer set search_path='' as $$
declare shop uuid;scope jsonb;result jsonb;begin
 shop:=shop_private.booking_shop(p_slug);scope:=shop_private.appointment_access_scope(p_slug,p_token);
 if shop is null or scope is null or p_page is null or p_page not between 1 and 100000 then return '{"authenticated":false}'::jsonb;end if;
 -- A reference grants no access. It is always combined with the current scope.
 insert into public.appointment_booking_references(shop_id,appointment_id)
 select shop,a.id from public.appointments a where a.shop_id=shop
 and ((scope->>'customerId' is not null and a.identity_kind='customer' and a.client_id=(scope->>'customerId')::uuid)
 or(scope->>'customerId' is null and a.identity_kind='walk_in' and a.id=(scope->>'appointmentId')::uuid))
 and a.status='booked' and a.starts_at>statement_timestamp() order by a.starts_at,a.id limit 20 offset (p_page-1)*20 on conflict(appointment_id) do nothing;
 with own as (
  select a.*,r.reference,policy.allow_cancel,policy.allow_reschedule,policy.change_notice_minutes
  from public.appointments a left join public.appointment_booking_references r on r.appointment_id=a.id and r.shop_id=a.shop_id
  join public.shop_booking_policies policy on policy.shop_id=a.shop_id
  where a.shop_id=shop and ((scope->>'customerId' is not null and a.identity_kind='customer' and a.client_id=(scope->>'customerId')::uuid) or(scope->>'customerId' is null and a.identity_kind='walk_in' and a.id=(scope->>'appointmentId')::uuid)) and a.status='booked' and a.starts_at>statement_timestamp()
 ), paged as(select * from own order by starts_at,id limit 20 offset (p_page-1)*20)
 select jsonb_build_object('authenticated',true,'expiresAt',scope->'expiresAt','scope',case when scope->>'customerId' is null then 'appointment' else 'customer' end,'page',p_page,'total',(select count(*) from own),'items',coalesce((select jsonb_agg(jsonb_build_object(
 'reference',a.reference,'startsAt',a.starts_at,'endsAt',a.ends_at,'service',coalesce(c.service_name,s.name),
 'canCancel',a.allow_cancel and a.starts_at>=statement_timestamp()+make_interval(mins=>a.change_notice_minutes),
 'canReschedule',a.allow_reschedule and a.starts_at>=statement_timestamp()+make_interval(mins=>a.change_notice_minutes) and c.staff_ref is not null,
 'serviceRef',c.service_ref,'locationRef',c.location_ref,'staffRef',c.staff_ref,
 'location',case when c.location_ref is not null then jsonb_build_object('name',c.location_name,'address',c.address) else null end,
 'staff',coalesce(c.staff_name,p.display_name),'timeZone',coalesce((select h.timezone from public.appointment_working_hours h where h.shop_id=shop and h.location_id=a.location_id and h.membership_id=a.assigned_membership_id order by weekday limit 1),'UTC')
 ) order by a.starts_at,a.id) from paged a join public.services s on s.id=a.service_id and s.shop_id=shop
 join public.shop_memberships m on m.id=a.assigned_membership_id and m.shop_id=shop join public.profiles p on p.id=m.profile_id
 left join shop_private.booking_combinations(shop) c on c.service_id=a.service_id and c.location_ref=a.location_id and c.membership_id=a.assigned_membership_id),'[]'::jsonb)) into result;
 return result;
exception when others then return '{"authenticated":false}'::jsonb;end$$;

create function shop_private.booking_reminders() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.booking_origin<>'public' and not exists(select 1 from public.appointment_booking_references r where r.appointment_id=new.id) then return new;end if;
 update public.appointment_reminder_intents set state='cancelled' where appointment_id=new.id and state='disabled';
 if new.status='booked' then
  insert into public.appointment_reminder_intents(shop_id,appointment_id,appointment_starts_at,scheduled_for)
  select new.shop_id,new.id,new.starts_at,new.starts_at-make_interval(mins=>p.reminder_lead_minutes) from public.shop_booking_policies p where p.shop_id=new.shop_id
  on conflict on constraint booking_reminder_unique do update set state='disabled',scheduled_for=excluded.scheduled_for;
 end if;
 return new;
end$$;
create trigger trg_booking_reminders after insert or update of starts_at,status on public.appointments for each row execute function shop_private.booking_reminders();

create function shop_private.booking_session(p_credential uuid,p_shop uuid,p_deadline timestamptz default null) returns jsonb language plpgsql set search_path='' as $$
declare token text:=shop_private.appointment_access_random_token();started timestamptz:=clock_timestamp();expiry timestamptz;begin
 expiry:=least(started+interval '10 minutes',coalesce(p_deadline,started+interval '10 minutes'));
 if expiry<=started then raise exception 'BOOKING_RETRY_WINDOW_ENDED';end if;
 insert into public.appointment_access_sessions(shop_id,credential_id,token_hash,created_at,expires_at) values(p_shop,p_credential,shop_private.appointment_access_hash(token),started,expiry);
 insert into public.appointment_booking_events(shop_id,appointment_id,credential_id,action) select p_shop,appointment_id,p_credential,'session_issued' from public.appointment_access_credentials where id=p_credential and shop_id=p_shop;
 return jsonb_build_object('token',token,'expiresAt',expiry);
end$$;
-- Freeze the identity and capability rows before rechecking after lock waits.
-- Identity triggers use identity -> credential -> session in this same order.
create function shop_private.booking_lock_scope(p_slug text,p_token text,p_scope jsonb) returns jsonb language plpgsql set search_path='' as $$
declare source_appointment uuid;begin
 if p_scope is null then return null;end if;
 if p_scope->>'customerId' is not null then perform 1 from public.clients where id=(p_scope->>'customerId')::uuid and shop_id=(p_scope->>'shopId')::uuid for share;
 end if;
 select appointment_id into source_appointment from public.appointment_access_credentials where id=(p_scope->>'credentialId')::uuid and shop_id=(p_scope->>'shopId')::uuid;
 perform 1 from public.appointments where id=source_appointment and shop_id=(p_scope->>'shopId')::uuid for share;
 perform 1 from public.appointment_access_credentials where id=(p_scope->>'credentialId')::uuid and shop_id=(p_scope->>'shopId')::uuid for share;
 perform 1 from public.appointment_access_sessions where id=(p_scope->>'sessionId')::uuid and shop_id=(p_scope->>'shopId')::uuid for share;
 return shop_private.appointment_access_scope(p_slug,p_token);
end$$;

create function public.appointment_booking_command(p_slug text,p_token text,p_operation text,p_request_key text,p_reference uuid default null,p_service uuid default null,p_location uuid default null,p_staff uuid default null,p_starts_at timestamptz default null,p_name text default null,p_phone text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
<<booking>>
declare shop uuid;scope jsonb;policy public.shop_booking_policies%rowtype;c record;prior public.appointment_booking_commands%rowtype;
 appointment public.appointments%rowtype;appointment_id uuid;reference uuid;credential uuid;code text;phone text;kh bytea;ph bytea;session jsonb;guest boolean;
begin
 shop:=shop_private.booking_shop(p_slug);
 if shop is null or p_operation is null or p_operation not in ('create','reschedule','cancel') or p_request_key is null or p_request_key !~ '^[a-f0-9]{64}$' then return '{"ok":false}'::jsonb;end if;
 scope:=shop_private.appointment_access_scope(p_slug,p_token);
 if p_token is not null and scope is null then return '{"ok":false,"accessEnded":true}'::jsonb;end if;
 if p_operation<>'create' and scope is null then return '{"ok":false,"accessEnded":true}'::jsonb;end if;
 phone:=shop_private.appointment_access_phone(p_phone);
 if p_operation='create' and scope is null and (p_name is null or length(btrim(p_name)) not between 2 and 160 or p_name~'[[:cntrl:]]' or phone is null) then return '{"ok":false}'::jsonb;end if;
 kh:=shop_private.appointment_access_hash(shop::text||':'||p_operation||':'||p_request_key);
 ph:=shop_private.appointment_access_hash(jsonb_build_array(p_operation,p_reference,p_service,p_location,p_staff,p_starts_at,p_name,p_phone)::text);
 -- Authoritative quotas persist even if the inner transactional write conflicts.
 if not shop_private.appointment_access_rate('booking-shop:'||shop::text,100)
 or not shop_private.appointment_access_rate('booking-actor:'||shop::text||':'||coalesce(scope->>'credentialId',phone),20)
 or (p_operation='create' and scope is null and not shop_private.appointment_access_rate('booking-phone:'||shop::text||':'||phone,5)) then return '{"ok":false}'::jsonb;end if;
 begin
  -- Lock order is Shop -> idempotency key -> staff, shared with staff availability.
  perform 1 from public.shops where id=shop and status='active' for update;
  if not found or shop_private.booking_shop(p_slug) is distinct from shop then return '{"ok":false}'::jsonb;end if;
  if p_token is not null then
   scope:=shop_private.booking_lock_scope(p_slug,p_token,scope);
   if scope is null then return '{"ok":false,"accessEnded":true}'::jsonb;end if;
  end if;
  select * into policy from public.shop_booking_policies where shop_id=shop;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(encode(kh,'hex'),1));
  select * into prior from public.appointment_booking_commands where key_hash=kh;
  if prior.key_hash is not null then
   if prior.payload_hash<>ph or prior.shop_id<>shop or prior.operation<>p_operation then return '{"ok":false}'::jsonb;end if;
   select r.reference into reference from public.appointment_booking_references r where r.appointment_id=prior.appointment_id and r.shop_id=shop;
   if prior.guest and p_operation='create' then
    perform 1 from public.appointments where id=prior.appointment_id and shop_id=shop for share;
    perform 1 from public.appointment_access_credentials where id=prior.credential_id and shop_id=shop for share;
    if scope is not null and shop_private.booking_own(scope,reference) is distinct from prior.appointment_id then return '{"ok":false}'::jsonb;end if;
    if not exists(select 1 from public.appointment_access_credentials cr where cr.id=prior.credential_id and cr.shop_id=shop and cr.revoked_at is null and cr.phone_hash=shop_private.appointment_access_hash(shop_private.appointment_access_current_phone(cr.appointment_id,shop,cr.customer_id))) then return '{"ok":false}'::jsonb;end if;
    if prior.created_at+interval '10 minutes'<=clock_timestamp() then return '{"ok":false}'::jsonb;end if;
    session:=shop_private.booking_session(prior.credential_id,shop,prior.created_at+interval '10 minutes');
    return jsonb_build_object('ok',true,'reference',reference,'code',null)||session;
   end if;
   if shop_private.booking_own(scope,reference) is distinct from prior.appointment_id then return '{"ok":false}'::jsonb;end if;
   return jsonb_build_object('ok',true,'reference',reference,'code',null,'expiresAt',scope->'expiresAt');
  end if;
  if p_operation='create' then
   if p_reference is not null or scope is not null and scope->>'customerId' is null then return '{"ok":false}'::jsonb;end if;
   guest:=scope is null;
  else
   appointment_id:=shop_private.booking_own(scope,p_reference);
   select * into appointment from public.appointments where id=appointment_id and shop_id=shop for update;
   if shop_private.appointment_access_scope(p_slug,p_token) is null then return '{"ok":false,"accessEnded":true}'::jsonb;end if;
   if appointment.id is null or shop_private.booking_own(scope,p_reference) is distinct from appointment.id or appointment.status<>'booked' or appointment.starts_at<clock_timestamp()+make_interval(mins=>policy.change_notice_minutes)
   or p_operation='reschedule' and not policy.allow_reschedule or p_operation='cancel' and not policy.allow_cancel then return '{"ok":false}'::jsonb;end if;
  end if;
  if p_operation in ('create','reschedule') then
   select * into c from shop_private.booking_combinations(shop) where service_ref=p_service and location_ref=p_location and staff_ref=p_staff;
   if c.service_ref is null or p_starts_at is null then return '{"ok":false}'::jsonb;end if;
   if p_operation='reschedule' and (appointment.service_id<>c.service_id or appointment.location_id<>c.location_ref or appointment.assigned_membership_id<>c.membership_id) then return '{"ok":false}'::jsonb;end if;
   perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(c.membership_id::text,0));
   if p_token is not null and shop_private.appointment_access_scope(p_slug,p_token) is null then return '{"ok":false,"accessEnded":true}'::jsonb;end if;
   if not shop_private.booking_slot_available(shop,p_service,p_location,p_staff,p_starts_at,appointment_id) then return '{"ok":false}'::jsonb;end if;
   if p_operation='create' then
    perform set_config('shop.public_booking','true',true);
    insert into public.appointments(shop_id,location_id,client_id,service_id,assigned_membership_id,starts_at,ends_at,created_by_profile_id,identity_kind,walk_in_name,walk_in_phone,customer_name_snapshot,customer_phone_snapshot,booking_origin)
    values(shop,c.location_ref,(scope->>'customerId')::uuid,c.service_id,c.membership_id,p_starts_at,p_starts_at+make_interval(mins=>c.duration+c.cleanup),null,
     case when guest then 'walk_in' else 'customer' end::public.appointment_identity_kind,case when guest then btrim(p_name) end,case when guest then phone end,
     case when not guest then (select name from public.clients where id=(scope->>'customerId')::uuid and shop_id=shop and is_active) end,
     case when not guest then (select clients.phone from public.clients where id=(scope->>'customerId')::uuid and shop_id=shop and is_active) end,'public') returning id into appointment_id;
    perform set_config('shop.public_booking','',true);
    insert into public.appointment_booking_references(shop_id,appointment_id) values(shop,appointment_id) returning appointment_booking_references.reference into reference;
    if guest then
     code:=shop_private.appointment_access_random_code();
     insert into public.appointment_access_credentials(shop_id,appointment_id,code_hash,phone_hash,issued_by_profile_id,issuance_origin)
     values(shop,appointment_id,shop_private.appointment_access_hash(code),shop_private.appointment_access_hash(phone),null,'public_booking') returning id into credential;
     insert into public.appointment_access_events(shop_id,appointment_id,credential_id,action) values(shop,appointment_id,credential,'issued');
     session:=shop_private.booking_session(credential,shop);
    end if;
   else
    perform set_config('shop.public_booking','true',true);
    update public.appointments set starts_at=p_starts_at,ends_at=p_starts_at+make_interval(mins=>c.duration+c.cleanup),updated_at=clock_timestamp() where id=appointment_id;
    perform set_config('shop.public_booking','',true);
    reference:=p_reference;
   end if;
  else
   perform set_config('shop.public_booking','true',true);
   update public.appointments set status='cancelled',cancelled_at=clock_timestamp(),cancellation_reason='Customer cancellation',updated_at=clock_timestamp() where id=appointment_id;
   perform set_config('shop.public_booking','',true);
   reference:=p_reference;
  end if;
  insert into public.appointment_booking_commands(key_hash,shop_id,operation,payload_hash,appointment_id,credential_id,guest) values(kh,shop,p_operation,ph,appointment_id,credential,coalesce(guest,false));
  insert into public.appointment_booking_events(shop_id,appointment_id,credential_id,action) values(shop,appointment_id,coalesce(credential,(scope->>'credentialId')::uuid),case p_operation when 'create' then 'created' when 'reschedule' then 'rescheduled' else 'cancelled' end);
  perform set_config('shop.public_booking','',true);
  return jsonb_build_object('ok',true,'reference',reference,'code',code,'expiresAt',scope->'expiresAt')||coalesce(session,'{}'::jsonb);
 exception when others then return '{"ok":false}'::jsonb;end;
exception when others then return '{"ok":false}'::jsonb;end$$;

do $$declare f record;begin
 for f in select p.oid::regprocedure signature,n.nspname,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where (n.nspname='shop_private' and (p.proname like 'booking_%' or p.proname in ('save_staff_schedule','save_staff_schedule_before_public_booking')))
 or(n.nspname='public' and p.proname in ('shop_booking_settings','shop_booking_settings_save','appointment_booking_options','appointment_booking_slots','appointment_booking_manage','appointment_booking_command')) loop
 execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);
 if f.nspname='public' then execute format('grant execute on function %s to %s',f.signature,case when f.proname like 'shop_booking_settings%' then 'authenticated' else 'anon,authenticated' end);end if;
 end loop;
end$$;
notify pgrst,'reload schema';
