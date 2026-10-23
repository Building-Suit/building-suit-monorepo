-- DOS-M3-002. Explicit synthetic request permission, no provider transport.
create table public.waitlist_entries(
 id uuid primary key default gen_random_uuid(),practice_id uuid not null,location_id uuid not null,doctor_user_id uuid not null,
 patient_id uuid not null,timezone text not null,location_name text not null,location_version integer not null,requested_type jsonb not null,date_from date not null,date_to date not null,
 minute_start integer not null check(minute_start between 0 and 1439),minute_end integer not null check(minute_end between 1 and 1440),
 contact_permission boolean not null,permission_source text not null check(length(permission_source)<=200),permission_recorded_at timestamptz not null default clock_timestamp(),
 state text not null default 'waiting'check(state in('waiting','offered','accepted','expired','cancelled')),version integer not null default 1 check(version>0),
 created_by uuid not null references auth.users(id),created_at timestamptz not null default clock_timestamp(),updated_at timestamptz not null default clock_timestamp(),
 check(date_to>=date_from and minute_end>minute_start),check(not contact_permission or length(btrim(permission_source))>0),unique(practice_id,id),
 foreign key(practice_id,doctor_user_id)references public.practices(id,owner_user_id),foreign key(practice_id,location_id)references public.locations(practice_id,id),
 foreign key(practice_id,patient_id)references public.practice_patients(practice_id,id)
);
create index waitlist_entries_scope on public.waitlist_entries(practice_id,location_id,created_at desc,id);
create index waitlist_entries_patient on public.waitlist_entries(practice_id,patient_id);
create index waitlist_entries_actor on public.waitlist_entries(created_by);
create table public.waitlist_offers(
 id uuid primary key default gen_random_uuid(),practice_id uuid not null,entry_id uuid not null,location_id uuid not null,doctor_user_id uuid not null,
 day date not null,minute integer not null check(minute between 0 and 1439),schedule_version integer not null,location_version integer not null,
 consultation_snapshot jsonb not null,starts_at timestamptz not null,ends_at timestamptz not null,commitment_start timestamptz not null,commitment_end timestamptz not null,
 expires_at timestamptz not null,state text not null check(state in('offered','accepted','expired','cancelled')),record_version integer not null check(record_version>0),
 appointment_id uuid,created_by uuid not null references auth.users(id),created_at timestamptz not null default clock_timestamp(),
 check(commitment_start<=starts_at and starts_at<ends_at and ends_at<=commitment_end),
 foreign key(practice_id,entry_id)references public.waitlist_entries(practice_id,id),foreign key(practice_id,location_id)references public.locations(practice_id,id),
 foreign key(practice_id,doctor_user_id)references public.practices(id,owner_user_id),foreign key(practice_id,appointment_id)references public.appointments(practice_id,id),unique(practice_id,id)
);
create unique index waitlist_one_offer on public.waitlist_offers(entry_id)where state='offered';
create index waitlist_offers_capacity on public.waitlist_offers(doctor_user_id,state,expires_at);
create index waitlist_offers_commitment on public.waitlist_offers using gist(doctor_user_id extensions.gist_uuid_ops,tstzrange(commitment_start,commitment_end,'[)'))where state='offered';
create index waitlist_offers_record on public.waitlist_offers(practice_id,entry_id,created_at desc);
create index waitlist_offers_actor on public.waitlist_offers(created_by);
create index waitlist_offers_appointment on public.waitlist_offers(practice_id,appointment_id);
create table public.waitlist_events(
 id bigint generated always as identity primary key,practice_id uuid not null,entry_id uuid not null,location_id uuid not null,
 actor_user_id uuid not null references auth.users(id),action text not null,record_version integer not null,
 offer_id uuid,reason text,happened_at timestamptz not null default clock_timestamp(),
 foreign key(practice_id,entry_id)references public.waitlist_entries(practice_id,id),foreign key(practice_id,location_id)references public.locations(practice_id,id),
 foreign key(practice_id,offer_id)references public.waitlist_offers(practice_id,id)
);
create index waitlist_events_record on public.waitlist_events(practice_id,entry_id,id desc);
create index waitlist_events_actor on public.waitlist_events(actor_user_id);
alter table public.waitlist_entries enable row level security;alter table public.waitlist_offers enable row level security;alter table public.waitlist_events enable row level security;
revoke all on public.waitlist_entries,public.waitlist_offers,public.waitlist_events from public,anon,authenticated,service_role;
revoke all on sequence public.waitlist_events_id_seq from public,anon,authenticated,service_role;
create function doctor_private.waitlist_scope(p_practice uuid,p_location uuid,p_write boolean default false)returns void
language plpgsql security definer set search_path='' as $$
begin
 perform doctor_private.operations_scope(p_practice,p_location,'appointments.read');perform doctor_private.require_access(p_practice,'patients.read',p_location);
 if p_write then perform doctor_private.require_access(p_practice,'appointments.write',p_location);end if;
end $$;
create function doctor_private.waitlist_capacity_overlap(p_doctor uuid,p_start timestamptz,p_end timestamptz,p_ignore uuid default null)returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.waitlist_offers o join public.waitlist_entries e on e.practice_id=o.practice_id and e.id=o.entry_id
 join public.practice_patients p on p.practice_id=e.practice_id and p.id=e.patient_id
 where o.doctor_user_id=p_doctor and o.id is distinct from p_ignore and o.state='offered'and o.expires_at>clock_timestamp()
 and e.contact_permission and p.archived_at is null and tstzrange(o.commitment_start,o.commitment_end,'[)')&&tstzrange(p_start,p_end,'[)'))
$$;
create function doctor_private.waitlist_offer_integrity()returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception using errcode='25000',message='DOCTOR_READ_COMMITTED_REQUIRED';end if;
 perform pg_advisory_xact_lock(hashtextextended(new.practice_id::text,1));
 if TG_OP='UPDATE'and(to_jsonb(new)-array['state','appointment_id'])is distinct from(to_jsonb(old)-array['state','appointment_id'])then raise exception using errcode='22023',message='DOCTOR_WAITLIST_OFFER_IMMUTABLE';end if;
 if TG_OP='INSERT'and new.expires_at<=clock_timestamp()then raise exception using errcode='40001',message='DOCTOR_WAITLIST_EXPIRED_OR_CONFLICT';end if;
 if new.state='offered'and new.expires_at>clock_timestamp()then
  if exists(select 1 from public.appointments a where a.doctor_user_id=new.doctor_user_id and a.state not in('cancelled','no_show')
   and tstzrange(a.commitment_start,a.commitment_end,'[)')&&tstzrange(new.commitment_start,new.commitment_end,'[)'))
   or doctor_private.waitlist_capacity_overlap(new.doctor_user_id,new.commitment_start,new.commitment_end,new.id)then
    raise exception using errcode='40001',message='DOCTOR_APPOINTMENT_CONFLICT';end if;
 end if;return new;
end $$;
create trigger waitlist_offer_integrity before insert or update on public.waitlist_offers for each row execute function doctor_private.waitlist_offer_integrity();
create function doctor_private.waitlist_command(p_practice uuid,p_location uuid,p_entry uuid,p_expected_version integer,p_action text,p_input jsonb,p_key uuid)returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid;entry public.waitlist_entries;offer public.waitlist_offers;prior doctor_private.command_receipts;request jsonb;result jsonb;reason text;consultation jsonb;place public.locations;config public.location_schedules;slot jsonb;day date;minute integer;expiry timestamptz;booked jsonb;recorded_action text;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception using errcode='25000',message='DOCTOR_READ_COMMITTED_REQUIRED';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_practice::text,1));perform doctor_private.waitlist_scope(p_practice,p_location,true);actor:=doctor_private.current_actor();
 if p_key is null or p_entry is null or p_action is null or p_action not in('create','offer','accept','cancel','revoke_contact','expire')
 or p_expected_version is null or p_expected_version<0 or jsonb_typeof(p_input)is distinct from'object'then raise exception using errcode='22023',message='DOCTOR_WAITLIST_INVALID';end if;
 if p_action<>'create'then
  select * into entry from public.waitlist_entries where practice_id=p_practice and location_id=p_location and id=p_entry for update;
  if entry.id is null then raise exception using errcode='42501',message='DOCTOR_ACCESS_DENIED';end if;
  if p_action in('offer','accept')and(not entry.contact_permission or not exists(select 1 from public.practice_patients where practice_id=p_practice and id=entry.patient_id and archived_at is null))then raise exception using errcode='42501',message='DOCTOR_WAITLIST_PERMISSION_REQUIRED';end if;
 end if;
 request:=jsonb_build_object('command','waitlist.'||p_action,'session',auth.jwt()->>'session_id','practice',p_practice,'location',p_location,'entry',p_entry,'version',p_expected_version,'input',p_input);
 select * into prior from doctor_private.command_receipts where actor_user_id=actor and command_key=p_key;
 if found then if prior.request<>request then raise exception using errcode='22023',message='DOCTOR_IDEMPOTENCY_CONFLICT';end if;return prior.result;end if;
 select * into place from public.locations where practice_id=p_practice and id=p_location;
 if p_action='create'then
  if p_expected_version<>0 or exists(select 1 from public.waitlist_entries where id=p_entry)then raise exception using errcode='40001',message='DOCTOR_WAITLIST_CONFLICT';end if;
  if not p_input?&array['patient_id','type_id','type_version','date_from','date_to','minute_start','minute_end','contact_permission','permission_source']
  or p_input-array['patient_id','type_id','type_version','date_from','date_to','minute_start','minute_end','contact_permission','permission_source']<>'{}'
  or jsonb_typeof(p_input->'contact_permission')is distinct from'boolean'or jsonb_typeof(p_input->'permission_source')is distinct from'string'
  or length(p_input->>'permission_source')>200 or p_input->>'permission_source'~'[[:cntrl:]]'
  or((p_input->>'contact_permission')::boolean and length(btrim(p_input->>'permission_source'))=0)
  or exists(select 1 from unnest(array['type_version','minute_start','minute_end'])k where jsonb_typeof(p_input->k)is distinct from'number'or(p_input->>k)!~'^[0-9]{1,10}$')
  or jsonb_typeof(p_input->'date_from')is distinct from'string'or jsonb_typeof(p_input->'date_to')is distinct from'string'
  or(p_input->>'date_from')!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}$'or(p_input->>'date_to')!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}$'then raise exception using errcode='22023',message='DOCTOR_WAITLIST_INVALID';end if;
  if not exists(select 1 from public.practice_patients where practice_id=p_practice and id=(p_input->>'patient_id')::uuid and archived_at is null)then raise exception using errcode='42501',message='DOCTOR_ACCESS_DENIED';end if;
  consultation:=doctor_private.consultation_snapshot(p_practice,p_location,(p_input->>'type_id')::uuid);
  if(consultation->>'version')::integer is distinct from(p_input->>'type_version')::integer then raise exception using errcode='40001',message='DOCTOR_AVAILABILITY_CONFLICT';end if;
  if(p_input->>'date_from')::date<(clock_timestamp()at time zone place.timezone)::date or(p_input->>'date_to')::date>(clock_timestamp()at time zone place.timezone)::date+365
  or(p_input->>'date_to')::date<(p_input->>'date_from')::date or(p_input->>'minute_start')::integer not between 0 and 1439 or(p_input->>'minute_end')::integer not between 1 and 1440
  or(p_input->>'minute_end')::integer-(p_input->>'minute_start')::integer<(consultation->>'duration_minutes')::integer then raise exception using errcode='22023',message='DOCTOR_WAITLIST_INVALID';end if;
  insert into public.waitlist_entries(id,practice_id,location_id,doctor_user_id,patient_id,timezone,location_name,location_version,requested_type,date_from,date_to,minute_start,minute_end,contact_permission,permission_source,created_by)
   values(p_entry,p_practice,p_location,(select owner_user_id from public.practices where id=p_practice),(p_input->>'patient_id')::uuid,place.timezone,place.name,place.version,consultation,(p_input->>'date_from')::date,(p_input->>'date_to')::date,
   (p_input->>'minute_start')::integer,(p_input->>'minute_end')::integer,(p_input->>'contact_permission')::boolean,btrim(p_input->>'permission_source'),actor)returning * into entry;
 else
  if entry.version<>p_expected_version then raise exception using errcode='40001',message='DOCTOR_WAITLIST_CONFLICT';end if;
  select * into offer from public.waitlist_offers where practice_id=p_practice and entry_id=entry.id order by created_at desc,id desc limit 1 for update;
  if p_action='offer'then
   if entry.state<>'waiting'then raise exception using errcode='40001',message='DOCTOR_WAITLIST_CONFLICT';end if;
   if not p_input?&array['date','minute','schedule_version','location_version','expires_at']or p_input-array['date','minute','schedule_version','location_version','expires_at']<>'{}'
   or jsonb_typeof(p_input->'date')is distinct from'string'or(p_input->>'date')!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
   or jsonb_typeof(p_input->'expires_at')is distinct from'string'or(p_input->>'expires_at')!~'(Z|[+-][0-9]{2}:[0-9]{2})$'
   or exists(select 1 from unnest(array['minute','schedule_version','location_version'])k where jsonb_typeof(p_input->k)is distinct from'number'or(p_input->>k)!~'^[0-9]{1,10}$')then raise exception using errcode='22023',message='DOCTOR_WAITLIST_INVALID';end if;
   day:=(p_input->>'date')::date;minute:=(p_input->>'minute')::integer;expiry:=(p_input->>'expires_at')::timestamptz;
   if day<entry.date_from or day>entry.date_to or minute<entry.minute_start or minute+(entry.requested_type->>'duration_minutes')::integer>entry.minute_end
    or expiry<=clock_timestamp()or expiry>clock_timestamp()+interval'1 day'then raise exception using errcode='22023',message='DOCTOR_WAITLIST_INVALID';end if;
   consultation:=doctor_private.consultation_snapshot(p_practice,p_location,(entry.requested_type->>'id')::uuid);
   select * into config from public.location_schedules where practice_id=p_practice and location_id=p_location;
   if consultation<>entry.requested_type or entry.timezone<>place.timezone or entry.location_version<>place.version or config.version is distinct from(p_input->>'schedule_version')::integer or place.version is distinct from(p_input->>'location_version')::integer then raise exception using errcode='40001',message='DOCTOR_AVAILABILITY_CONFLICT';end if;
   slot:=doctor_private.consultation_slot(p_practice,p_location,day,minute,consultation);
   if not coalesce((slot->>'available')::boolean,false)then raise exception using errcode='40001',message='DOCTOR_APPOINTMENT_CONFLICT';end if;
   if expiry>=(slot->>'starts_at')::timestamptz then raise exception using errcode='22023',message='DOCTOR_WAITLIST_INVALID';end if;
   insert into public.waitlist_offers(practice_id,entry_id,location_id,doctor_user_id,day,minute,schedule_version,location_version,consultation_snapshot,starts_at,ends_at,commitment_start,commitment_end,expires_at,state,record_version,created_by)
    values(p_practice,entry.id,p_location,entry.doctor_user_id,day,minute,config.version,place.version,consultation,(slot->>'starts_at')::timestamptz,(slot->>'ends_at')::timestamptz,
    (slot->>'starts_at')::timestamptz-make_interval(mins=>(consultation->>'buffer_before')::integer),(slot->>'ends_at')::timestamptz+make_interval(mins=>(consultation->>'buffer_after')::integer),expiry,'offered',entry.version+1,actor)returning * into offer;
   update public.waitlist_entries set state='offered',version=version+1,updated_at=clock_timestamp()where id=entry.id returning * into entry;
  elsif p_action='accept'then
   if p_input-array['reason']<>'{}'or not p_input?'reason'or jsonb_typeof(p_input->'reason')is distinct from'string'then raise exception using errcode='22023',message='DOCTOR_WAITLIST_INVALID';end if;reason:=doctor_private.appointment_reason(p_input->>'reason');
   if entry.state<>'offered'or offer.id is null or offer.state<>'offered'or offer.expires_at<=clock_timestamp()then raise exception using errcode='40001',message='DOCTOR_WAITLIST_EXPIRED_OR_CONFLICT';end if;
   -- Release this reservation within the same transaction before booking; failure rolls everything back.
   update public.waitlist_offers set state='accepted'where id=offer.id;
   booked:=doctor_private.book_consultation(p_practice,p_location,entry.patient_id,offer.day,offer.minute,offer.schedule_version,offer.location_version,gen_random_uuid(),(offer.consultation_snapshot->>'id')::uuid,(offer.consultation_snapshot->>'version')::integer);
   update public.waitlist_offers set appointment_id=(booked->>'appointment_id')::uuid where id=offer.id returning * into offer;
   update public.waitlist_entries set state='accepted',version=version+1,updated_at=clock_timestamp()where id=entry.id returning * into entry;
  elsif p_action='expire'then
   if p_input<>'{}'or entry.state<>'offered'or offer.id is null or offer.state<>'offered'or offer.expires_at>clock_timestamp()then raise exception using errcode='40001',message='DOCTOR_WAITLIST_CONFLICT';end if;
   update public.waitlist_offers set state='expired'where id=offer.id;
   update public.waitlist_entries set state='expired',version=version+1,updated_at=clock_timestamp()where id=entry.id returning * into entry;
  else
   if p_input-array['reason']<>'{}'or not p_input?'reason'or jsonb_typeof(p_input->'reason')is distinct from'string'then raise exception using errcode='22023',message='DOCTOR_WAITLIST_INVALID';end if;reason:=doctor_private.appointment_reason(p_input->>'reason');
   if p_action='cancel'and entry.state not in('waiting','offered')then raise exception using errcode='40001',message='DOCTOR_WAITLIST_CONFLICT';end if;
   if p_action='revoke_contact'and not entry.contact_permission then raise exception using errcode='40001',message='DOCTOR_WAITLIST_CONFLICT';end if;
   if offer.id is not null and offer.state='offered'then update public.waitlist_offers set state='cancelled'where id=offer.id;end if;
   update public.waitlist_entries set state=case when state in('waiting','offered')then'cancelled'else state end,
    contact_permission=case when p_action='revoke_contact'then false else contact_permission end,
    version=version+1,updated_at=clock_timestamp()where id=entry.id returning * into entry;
  end if;
 end if;
 recorded_action:='waitlist.'||p_action;
 insert into public.waitlist_events(practice_id,entry_id,location_id,actor_user_id,action,record_version,offer_id,reason)values(p_practice,entry.id,p_location,actor,recorded_action,entry.version,offer.id,reason);
 insert into public.audit_events(practice_id,actor_user_id,event_type,entity_id,details)values(p_practice,actor,recorded_action,entry.id,jsonb_build_object('location_id',p_location,'version',entry.version,'external_messages','disabled'));
 result:=jsonb_build_object('entry_id',entry.id,'version',entry.version,'state',entry.state,'offer_id',offer.id,'appointment_id',offer.appointment_id,'external_messages','disabled');
 insert into doctor_private.command_receipts values(actor,p_key,request,result);return result;
exception when invalid_text_representation or invalid_datetime_format or datetime_field_overflow or numeric_value_out_of_range then raise exception using errcode='22023',message='DOCTOR_WAITLIST_INVALID';
end $$;
create function doctor_private.read_waitlist(p_practice uuid,p_location uuid,p_page integer,p_state text,p_search text)returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;observed timestamptz:=clock_timestamp();place public.locations;can_write boolean;
begin
 perform doctor_private.waitlist_scope(p_practice,p_location);
 if p_page is null or p_page not between 0 and 100000 or p_state is null or p_state not in('all','waiting','offered','accepted','expired','cancelled')or p_search is null or length(p_search)>100 then raise exception using errcode='22023',message='DOCTOR_WAITLIST_INVALID';end if;
 select * into place from public.locations where practice_id=p_practice and id=p_location;
 can_write:=doctor_private.has_access(p_practice,'appointments.write',p_location);
 with source as materialized(
  select e.*,p.display_name,p.archived_at,case when e.state='offered'and o.expires_at<=observed then'expired'else e.state end effective_state,
   o.id offer_id,o.starts_at,o.ends_at,o.expires_at,o.appointment_id,o.state offer_state,
   case when not e.contact_permission then'contact_permission'
    when p.archived_at is not null then'patient_archived'
    when e.date_to<(observed at time zone e.timezone)::date then'request_window_elapsed'
    when place.version<>e.location_version or place.timezone<>e.timezone then'clinic_changed'
    when t.id is null or not t.active or not p_location=any(t.location_ids)or(to_jsonb(t)-array['actor_user_id','happened_at'])<>e.requested_type then'type_changed'else null end blocked_reason
  from public.waitlist_entries e join public.practice_patients p on p.practice_id=e.practice_id and p.id=e.patient_id
  left join lateral(select * from public.waitlist_offers where practice_id=e.practice_id and entry_id=e.id order by created_at desc,id desc limit 1)o on true
  left join lateral(select * from public.consultation_types where practice_id=e.practice_id and id=(e.requested_type->>'id')::uuid order by version desc limit 1)t on true
  where e.practice_id=p_practice and e.location_id=p_location and(btrim(p_search)=''or position(lower(btrim(p_search))in lower(p.display_name))>0)
 ),cohort as materialized(select * from source where p_state='all'or effective_state=p_state),page_rows as(
  select * from cohort order by created_at desc,id desc limit 20 offset p_page*20
 )select jsonb_build_object('practice_id',p_practice,'location_id',p_location,'timezone',place.timezone,'location_version',place.version,'observed_at',observed,
  'data_mode','synthetic','external_messages','disabled','page',p_page,'total',(select count(*)from cohort),'can_manage',can_write,
  'rows',coalesce((select jsonb_agg(jsonb_build_object('id',id,'patient_id',patient_id,'patient_name',display_name,'requested_type',requested_type,
   'timezone',timezone,'location_name',location_name,'captured_location_version',location_version,'date_from',date_from,'date_to',date_to,'minute_start',minute_start,'minute_end',minute_end,
   'contact_permission',contact_permission,'permission_source',permission_source,'permission_recorded_at',permission_recorded_at,'state',effective_state,'version',version,
   'offer_id',offer_id,'starts_at',starts_at,'ends_at',ends_at,'expires_at',expires_at,'appointment_id',appointment_id,'blocked_reason',blocked_reason,
   'can_offer',can_write and effective_state='waiting'and blocked_reason is null,
   'can_accept',can_write and effective_state='offered'and blocked_reason is null,
   'can_cancel',can_write and effective_state in('waiting','offered'),
   'can_revoke_contact',can_write and contact_permission,'can_expire',can_write and state='offered'and effective_state='expired')order by created_at desc,id desc)from page_rows),'[]'))into result;
 return result;
end $$;
create function doctor_private.read_waitlist_history(p_practice uuid,p_location uuid,p_entry uuid,p_page integer)returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 perform doctor_private.waitlist_scope(p_practice,p_location);
 if p_page is null or p_page not between 0 and 100000 then raise exception using errcode='22023',message='DOCTOR_WAITLIST_INVALID';end if;
 if not exists(select 1 from public.waitlist_entries where practice_id=p_practice and location_id=p_location and id=p_entry)then raise exception using errcode='42501',message='DOCTOR_ACCESS_DENIED';end if;
 with cohort as materialized(select * from public.waitlist_events where practice_id=p_practice and entry_id=p_entry),rows as(select * from cohort order by id desc limit 20 offset p_page*20)
 select jsonb_build_object('practice_id',p_practice,'location_id',p_location,'entry_id',p_entry,'page',p_page,'total',(select count(*)from cohort),'events',coalesce((select jsonb_agg(to_jsonb(rows)||jsonb_build_object('id',id::text)order by id desc)from rows),'[]'))into result;return result;
end $$;

create or replace function doctor_private.appointment_commitment()returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception using errcode='25000',message='DOCTOR_READ_COMMITTED_REQUIRED';end if;
 perform pg_advisory_xact_lock(hashtextextended(new.practice_id::text,1));
 if TG_OP='UPDATE' and new.consultation_snapshot is distinct from old.consultation_snapshot then
  raise exception using errcode='22023',message='DOCTOR_CONSULTATION_SNAPSHOT_IMMUTABLE';end if;
 if new.consultation_snapshot is not null then
  if not exists(select 1 from public.consultation_types t where t.practice_id=new.practice_id
    and t.id=(new.consultation_snapshot->>'id')::uuid and t.version=(new.consultation_snapshot->>'version')::integer
    and new.consultation_snapshot=to_jsonb(t)-array['actor_user_id','happened_at'])
    or new.ends_at-new.starts_at<>make_interval(mins=>(new.consultation_snapshot->>'duration_minutes')::integer)
    or not new.location_id=any(array(select jsonb_array_elements_text(new.consultation_snapshot->'location_ids')::uuid)) then
   raise exception using errcode='22023',message='DOCTOR_CONSULTATION_INVALID';end if;
 end if;
 new.commitment_start:=new.starts_at-make_interval(mins=>coalesce((new.consultation_snapshot->>'buffer_before')::integer,0));
 new.commitment_end:=new.ends_at+make_interval(mins=>coalesce((new.consultation_snapshot->>'buffer_after')::integer,0));
 if new.state not in('cancelled','no_show')and doctor_private.waitlist_capacity_overlap(new.doctor_user_id,new.commitment_start,new.commitment_end)then raise exception using errcode='40001',message='DOCTOR_APPOINTMENT_CONFLICT';end if;
 return new;
end $$;
create or replace function doctor_private.consultation_slot(p_practice uuid,p_location uuid,p_day date,p_minute integer,p_snapshot jsonb,p_ignore uuid default null)returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare config public.location_schedules; place public.locations; doctor uuid; windows jsonb; begins timestamptz; ends timestamptz; buffered_start timestamptz; buffered_end timestamptz; reason text; duration integer; before_minutes integer; after_minutes integer;
begin
 select * into config from public.location_schedules where practice_id=p_practice and location_id=p_location;
 select * into place from public.locations where id=p_location and practice_id=p_practice and archived_at is null;
 if config.location_id is null or place.id is null or p_day is null or p_minute is null then return jsonb_build_object('minute',p_minute,'starts_at',null,'ends_at',null,'available',false,'reason','unconfigured');end if;
 duration:=coalesce((p_snapshot->>'duration_minutes')::integer,config.slot_minutes);before_minutes:=coalesce((p_snapshot->>'buffer_before')::integer,0);after_minutes:=coalesce((p_snapshot->>'buffer_after')::integer,0);
 windows:=doctor_private.schedule_day_windows(config,p_day);
 if not exists(select 1 from jsonb_array_elements(windows)w where p_minute-before_minutes>=(w->>'start')::integer and p_minute+duration+after_minutes<=(w->>'end')::integer
  and(p_minute-(w->>'start')::integer)%config.slot_minutes=0)then return jsonb_build_object('minute',p_minute,'starts_at',null,'ends_at',null,'available',false,'reason','outside_hours');end if;
 begins:=doctor_private.schedule_clock(p_day,p_minute,place.timezone);ends:=doctor_private.schedule_clock(p_day,p_minute+duration,place.timezone);
 buffered_start:=case when before_minutes=0 then begins else doctor_private.schedule_clock(p_day,p_minute-before_minutes,place.timezone)end;buffered_end:=case when after_minutes=0 then ends else doctor_private.schedule_clock(p_day,p_minute+duration+after_minutes,place.timezone)end;
 if begins is null or ends is null or buffered_start is null or buffered_end is null or ends-begins<>make_interval(mins=>duration)
 or begins-buffered_start<>make_interval(mins=>before_minutes)or buffered_end-ends<>make_interval(mins=>after_minutes)then reason:='ambiguous_or_missing_clock';
 elsif buffered_start<=clock_timestamp()then reason:='past';
 else
  select owner_user_id into doctor from public.practices where id=p_practice;
  if exists(select 1 from public.appointments where doctor_user_id=doctor and state not in('cancelled','no_show')and id is distinct from p_ignore
    and tstzrange(commitment_start,commitment_end,'[)')&&tstzrange(buffered_start,buffered_end,'[)'))or doctor_private.waitlist_capacity_overlap(doctor,buffered_start,buffered_end)then reason:='busy';end if;
 end if;
 return jsonb_build_object('minute',p_minute,'starts_at',begins,'ends_at',ends,'available',reason is null,'reason',reason);
end $$;
create function public.doctor_waitlist(p_practice uuid,p_location uuid,p_page integer default 0,p_state text default 'all',p_search text default '')returns jsonb language sql stable security invoker set search_path='' as $$select doctor_private.read_waitlist(p_practice,p_location,p_page,p_state,p_search)$$;
revoke all on function public.doctor_waitlist(uuid,uuid,integer,text,text)from public,anon,authenticated,service_role;
grant execute on function public.doctor_waitlist(uuid,uuid,integer,text,text)to authenticated;
revoke all on function doctor_private.read_waitlist(uuid,uuid,integer,text,text)from public,anon,authenticated,service_role;
grant execute on function doctor_private.read_waitlist(uuid,uuid,integer,text,text)to authenticated;
create function public.doctor_waitlist_history(p_practice uuid,p_location uuid,p_entry uuid,p_page integer default 0)returns jsonb language sql stable security invoker set search_path='' as $$select doctor_private.read_waitlist_history(p_practice,p_location,p_entry,p_page)$$;
revoke all on function public.doctor_waitlist_history(uuid,uuid,uuid,integer)from public,anon,authenticated,service_role;
grant execute on function public.doctor_waitlist_history(uuid,uuid,uuid,integer)to authenticated;
revoke all on function doctor_private.read_waitlist_history(uuid,uuid,uuid,integer)from public,anon,authenticated,service_role;
grant execute on function doctor_private.read_waitlist_history(uuid,uuid,uuid,integer)to authenticated;
create function public.doctor_waitlist_command(p_practice uuid,p_location uuid,p_entry uuid,p_expected_version integer,p_action text,p_input jsonb,p_key uuid)returns jsonb language sql security invoker set search_path='' as $$select doctor_private.waitlist_command(p_practice,p_location,p_entry,p_expected_version,p_action,p_input,p_key)$$;
revoke all on function public.doctor_waitlist_command(uuid,uuid,uuid,integer,text,jsonb,uuid)from public,anon,authenticated,service_role;
grant execute on function public.doctor_waitlist_command(uuid,uuid,uuid,integer,text,jsonb,uuid)to authenticated;
revoke all on function doctor_private.waitlist_command(uuid,uuid,uuid,integer,text,jsonb,uuid)from public,anon,authenticated,service_role;
grant execute on function doctor_private.waitlist_command(uuid,uuid,uuid,integer,text,jsonb,uuid)to authenticated;
revoke all on function doctor_private.waitlist_scope(uuid,uuid,boolean),doctor_private.waitlist_capacity_overlap(uuid,timestamptz,timestamptz,uuid),doctor_private.waitlist_offer_integrity()from public,anon,authenticated,service_role;
create or replace function doctor_private.location_archive_blockers(p_practice uuid,p_location uuid)returns jsonb
language sql stable security invoker set search_path='' as $$
 select(select case when count(*)>0 then jsonb_build_array(jsonb_build_object('kind','upcoming_appointments','count',count(*)))else'[]'::jsonb end from public.appointments
  where practice_id=p_practice and location_id=p_location and(state in('checked_in','in_progress')or(state='booked'and ends_at>clock_timestamp())) )
 ||(select case when count(*)>0 then jsonb_build_array(jsonb_build_object('kind','active_waitlist_offers','count',count(*)))else'[]'::jsonb end
 from public.waitlist_offers o join public.waitlist_entries e on e.practice_id=o.practice_id and e.id=o.entry_id
 join public.practice_patients p on p.practice_id=e.practice_id and p.id=e.patient_id
 where o.practice_id=p_practice and o.location_id=p_location and o.state='offered'and o.expires_at>clock_timestamp()and e.contact_permission and p.archived_at is null)
$$;
