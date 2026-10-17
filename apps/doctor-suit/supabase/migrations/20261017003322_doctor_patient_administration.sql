-- DOS-M1-011: synthetic administrative records. An identity is neither an Auth
-- account nor a verified person; every new practice relationship gets a new ID.
create table public.patient_identities (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);
create table public.practice_patients (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.practices(id),
  patient_identity_id uuid not null unique references public.patient_identities(id),
  display_name text not null check (length(btrim(display_name)) between 1 and 160),
  recorded_phone text not null default '' check (length(recorded_phone)<=50),
  recorded_email text not null default '' check (length(recorded_email)<=254),
  recorded_date_of_birth date,
  created_location_id uuid not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  version integer not null default 1 check (version>0),
  unique(practice_id,id),
  foreign key(practice_id,created_location_id) references public.locations(practice_id,id)
);
create index practice_patients_created_location on public.practice_patients(practice_id,created_location_id);
create index practice_patients_creator on public.practice_patients(created_by);
create index practice_patients_directory on public.practice_patients(practice_id,display_name,id);
create table public.patient_administrative_activity (
  id bigint generated always as identity primary key,
  practice_id uuid not null,
  patient_id uuid not null,
  location_id uuid not null,
  actor_user_id uuid not null references auth.users(id),
  event_type text not null check(event_type in ('patient.created','patient.corrected','patient.archived')),
  record_version integer not null check(record_version>0),
  happened_at timestamptz not null default now(),
  foreign key(practice_id,patient_id) references public.practice_patients(practice_id,id),
  foreign key(practice_id,location_id) references public.locations(practice_id,id),
  unique(patient_id,record_version)
);
create index patient_activity_location on public.patient_administrative_activity(practice_id,location_id);
create index patient_activity_actor on public.patient_administrative_activity(actor_user_id);
create index patient_activity_record on public.patient_administrative_activity(practice_id,patient_id,id);
alter table public.patient_identities enable row level security;
alter table public.practice_patients enable row level security;
alter table public.patient_administrative_activity enable row level security;
-- No direct discovery or DML, including by an owner. Thin RPCs are the only client surface.
revoke all on public.patient_identities,public.practice_patients,public.patient_administrative_activity from public,anon,authenticated;
revoke all on sequence public.patient_administrative_activity_id_seq from public,anon,authenticated;

create function doctor_private.patient_scope(p_practice uuid,p_location uuid,p_write boolean default false) returns void
language plpgsql stable security definer set search_path='' as $$
begin
  if p_location is null or not exists(select 1 from public.locations where practice_id=p_practice and id=p_location and archived_at is null) then
    raise exception using errcode='42501',message='DOCTOR_ACCESS_DENIED';
  end if;
  perform doctor_private.require_access(p_practice,'patients.read',p_location);
  if p_write then perform doctor_private.require_access(p_practice,'patients.write',p_location); end if;
end $$;
create function doctor_private.patient_phone_key(p_phone text) returns text
language sql immutable security invoker set search_path='' as $$
  select regexp_replace(translate(p_phone,'٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹','01234567890123456789'),'[^0-9]','','g')
$$;
create function doctor_private.patient_input(p_input jsonb,p_location uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare born date; name text; phone text; email text;
begin
  if p_input is null or jsonb_typeof(p_input)<>'object' or not p_input ?& array['name','phone','email','date_of_birth']
    or p_input - array['name','phone','email','date_of_birth']<>'{}'::jsonb
    or jsonb_typeof(p_input->'name')<>'string' or jsonb_typeof(p_input->'phone')<>'string' or jsonb_typeof(p_input->'email')<>'string'
    or jsonb_typeof(p_input->'date_of_birth') not in ('string','null') then
    raise exception using errcode='22023',message='DOCTOR_PATIENT_INVALID';
  end if;
  name:=btrim(p_input->>'name'); phone:=btrim(p_input->>'phone'); email:=btrim(p_input->>'email');
  if length(name) not between 1 and 160 or length(phone)>50 or length(email)>254
    or (email<>'' and email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$') then
    raise exception using errcode='22023',message='DOCTOR_PATIENT_INVALID';
  end if;
  if coalesce(p_input->>'date_of_birth','')<>'' then
    begin
      if (p_input->>'date_of_birth') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise invalid_datetime_format; end if;
      born:=(p_input->>'date_of_birth')::date;
      if to_char(born,'YYYY-MM-DD')<>p_input->>'date_of_birth' or born>(select timezone(timezone,now())::date from public.locations where id=p_location) then
        raise invalid_datetime_format;
      end if;
    exception when invalid_datetime_format or datetime_field_overflow then
      raise exception using errcode='22023',message='DOCTOR_PATIENT_INVALID';
    end;
  end if;
  return jsonb_build_object('name',name,'phone',phone,'email',email,'date_of_birth',born);
end $$;
create function doctor_private.patient_projection(p public.practice_patients) returns jsonb
language sql stable security invoker set search_path='' as $$
  select jsonb_build_object('id',p.id,'practice_id',p.practice_id,'patient_identity_id',p.patient_identity_id,
    'name',p.display_name,'phone',p.recorded_phone,'email',p.recorded_email,'date_of_birth',p.recorded_date_of_birth,
    'created_location_id',p.created_location_id,'created_by',p.created_by,'created_at',p.created_at,'updated_at',p.updated_at,
    'archived_at',p.archived_at,'version',p.version,'provenance','entered_unverified')
$$;
-- Duplicate evidence is bounded and scoped. Its digest binds current candidate
-- IDs/versions, actor/session, record and normalized form; it is not identity proof.
create function doctor_private.patient_duplicate_review(p_practice uuid,p_location uuid,p_input jsonb,p_patient uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare data jsonb; matches jsonb; evidence jsonb; total bigint;
begin
  perform doctor_private.patient_scope(p_practice,p_location,true);
  if p_patient is not null and not exists(select 1 from public.practice_patients where id=p_patient and practice_id=p_practice) then
    raise exception using errcode='42501',message='DOCTOR_ACCESS_DENIED';
  end if;
  data:=doctor_private.patient_input(p_input,p_location);
  select count(*),coalesce(jsonb_agg(jsonb_build_object('id',id,'version',version) order by id),'[]') into total,evidence
    from public.practice_patients where practice_id=p_practice and id is distinct from p_patient and (
      lower(display_name)=lower(data->>'name')
      or (doctor_private.patient_phone_key(data->>'phone')<>'' and doctor_private.patient_phone_key(recorded_phone)=doctor_private.patient_phone_key(data->>'phone'))
      or (data->>'email'<>'' and lower(recorded_email)=lower(data->>'email')));
  select coalesce(jsonb_agg(doctor_private.patient_projection(row) order by row.display_name,row.id),'[]') into matches from (
    select * from public.practice_patients where practice_id=p_practice and id is distinct from p_patient and (
      lower(display_name)=lower(data->>'name')
      or (doctor_private.patient_phone_key(data->>'phone')<>'' and doctor_private.patient_phone_key(recorded_phone)=doctor_private.patient_phone_key(data->>'phone'))
      or (data->>'email'<>'' and lower(recorded_email)=lower(data->>'email')))
    order by display_name,id limit 10
  ) row;
  return jsonb_build_object('rows',matches,'total',total,'review_key',case when total>0 then
    encode(sha256(convert_to(jsonb_build_object('practice',p_practice,'location',p_location,'actor',doctor_private.current_actor(),
      'session',auth.jwt()->>'session_id','patient',p_patient,'form',data,'matches',evidence)::text,'UTF8')),'hex') else null end);
end $$;
create function doctor_private.patient_directory(p_practice uuid,p_location uuid,p_page integer,p_size integer,p_search text,p_status text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare rows jsonb; total bigint; digits text;
begin
  perform doctor_private.patient_scope(p_practice,p_location);
  if p_page is null or p_page not between 0 and 100000 or p_size is null or p_size not between 1 and 100 or p_search is null or length(p_search)>160
    or p_status is null or p_status not in ('active','archived','all') then raise exception using errcode='22023',message='DOCTOR_PATIENT_QUERY_INVALID'; end if;
  digits:=doctor_private.patient_phone_key(p_search);
  select count(*) into total from public.practice_patients p where p.practice_id=p_practice
    and (p_status='all' or (p_status='active' and p.archived_at is null) or (p_status='archived' and p.archived_at is not null))
    and (position(lower(p_search) in lower(p.display_name))>0 or position(lower(p_search) in lower(p.recorded_email))>0 or (digits<>'' and position(digits in doctor_private.patient_phone_key(p.recorded_phone))>0));
  select coalesce(jsonb_agg(doctor_private.patient_projection(row) order by row.display_name,row.id),'[]') into rows from (
    select * from public.practice_patients p where p.practice_id=p_practice
      and (p_status='all' or (p_status='active' and p.archived_at is null) or (p_status='archived' and p.archived_at is not null))
      and (position(lower(p_search) in lower(p.display_name))>0 or position(lower(p_search) in lower(p.recorded_email))>0 or (digits<>'' and position(digits in doctor_private.patient_phone_key(p.recorded_phone))>0))
    order by display_name,id limit p_size offset(p_page::bigint*p_size)
  ) row;
  return jsonb_build_object('rows',rows,'total',total,'can_write',doctor_private.has_access(p_practice,'patients.write',p_location));
end $$;
create function doctor_private.patient_record(p_practice uuid,p_location uuid,p_patient uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare item public.practice_patients; activity jsonb; total bigint;
begin
  perform doctor_private.patient_scope(p_practice,p_location);
  select * into item from public.practice_patients where practice_id=p_practice and id=p_patient;
  if not found then raise exception using errcode='42501',message='DOCTOR_ACCESS_DENIED'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'event_type',a.event_type,'record_version',a.record_version,'actor_user_id',a.actor_user_id,
    'location_id',a.location_id,'location_name',l.name,'happened_at',a.happened_at,'provenance','entered_unverified') order by a.id desc),'[]') into activity
    from (select * from public.patient_administrative_activity where practice_id=p_practice and patient_id=p_patient order by id desc limit 100) a
    join public.locations l on l.id=a.location_id and l.practice_id=a.practice_id;
  select count(*) into total from public.patient_administrative_activity where practice_id=p_practice and patient_id=p_patient;
  return jsonb_build_object('patient',doctor_private.patient_projection(item),'activity',activity,'activity_total',total,'can_write',doctor_private.has_access(p_practice,'patients.write',p_location));
end $$;
create function doctor_private.write_patient(p_practice uuid,p_location uuid,p_input jsonb,p_key uuid,p_patient uuid,p_expected_version integer,p_duplicate_review text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=doctor_private.current_actor(); prior doctor_private.command_receipts; data jsonb; review jsonb;
  item public.practice_patients; identity_id uuid; result jsonb; request jsonb;
begin
  if p_key is null then raise exception using errcode='22023',message='DOCTOR_COMMAND_KEY_REQUIRED'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_practice::text,1));
  perform doctor_private.patient_scope(p_practice,p_location,true);
  data:=doctor_private.patient_input(p_input,p_location);
  request:=jsonb_build_object('command','patient.write','practice',p_practice,'location',p_location,'patient',p_patient,'version',p_expected_version,'form',data,'duplicate_review',p_duplicate_review);
  select * into prior from doctor_private.command_receipts where actor_user_id=actor and command_key=p_key;
  if found then
    if prior.request<>request then raise exception using errcode='22023',message='DOCTOR_IDEMPOTENCY_CONFLICT'; end if;
    return prior.result;
  end if;
  if p_patient is not null then
    select * into item from public.practice_patients where practice_id=p_practice and id=p_patient for update;
    if not found then raise exception using errcode='42501',message='DOCTOR_ACCESS_DENIED'; end if;
    if item.version is distinct from p_expected_version then raise exception using errcode='40001',message='DOCTOR_PATIENT_CONFLICT'; end if;
    if item.archived_at is not null then raise exception using errcode='22023',message='DOCTOR_PATIENT_ARCHIVED'; end if;
  elsif p_expected_version is not null then raise exception using errcode='22023',message='DOCTOR_PATIENT_INVALID'; end if;
  review:=doctor_private.patient_duplicate_review(p_practice,p_location,data,p_patient);
  if (review->>'total')::bigint>0 and (review->>'review_key') is distinct from p_duplicate_review then
    raise exception using errcode='40001',message='DOCTOR_PATIENT_DUPLICATE_REVIEW';
  end if;
  if p_patient is null then
    insert into public.patient_identities default values returning id into identity_id;
    insert into public.practice_patients(practice_id,patient_identity_id,display_name,recorded_phone,recorded_email,recorded_date_of_birth,created_location_id,created_by)
      values(p_practice,identity_id,data->>'name',data->>'phone',data->>'email',(data->>'date_of_birth')::date,p_location,actor) returning * into item;
  else
    update public.practice_patients set display_name=data->>'name',recorded_phone=data->>'phone',recorded_email=data->>'email',recorded_date_of_birth=(data->>'date_of_birth')::date,
      updated_at=now(),version=version+1 where id=item.id returning * into item;
  end if;
  insert into public.patient_administrative_activity(practice_id,patient_id,location_id,actor_user_id,event_type,record_version)
    values(p_practice,item.id,p_location,actor,case when p_patient is null then 'patient.created' else 'patient.corrected' end,item.version);
  insert into public.audit_events(practice_id,actor_user_id,event_type,entity_id,details)
    values(p_practice,actor,case when p_patient is null then 'patient.created' else 'patient.corrected' end,item.id,jsonb_build_object('location_id',p_location,'version',item.version,'duplicate_reviewed',(review->>'total')::bigint>0));
  result:=jsonb_build_object('patient_id',item.id,'version',item.version);
  insert into doctor_private.command_receipts values(actor,p_key,request,result);
  return result;
end $$;
create function doctor_private.archive_patient(p_practice uuid,p_location uuid,p_patient uuid,p_expected_version integer,p_key uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=doctor_private.current_actor(); item public.practice_patients; prior doctor_private.command_receipts; result jsonb;
  request jsonb:=jsonb_build_object('command','patient.archive','practice',p_practice,'location',p_location,'patient',p_patient,'version',p_expected_version);
begin
  if p_key is null then raise exception using errcode='22023',message='DOCTOR_COMMAND_KEY_REQUIRED'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_practice::text,1));
  perform doctor_private.patient_scope(p_practice,p_location,true);
  select * into prior from doctor_private.command_receipts where actor_user_id=actor and command_key=p_key;
  if found then
    if prior.request<>request then raise exception using errcode='22023',message='DOCTOR_IDEMPOTENCY_CONFLICT'; end if;
    return prior.result;
  end if;
  select * into item from public.practice_patients where practice_id=p_practice and id=p_patient for update;
  if not found then raise exception using errcode='42501',message='DOCTOR_ACCESS_DENIED'; end if;
  if item.version is distinct from p_expected_version then raise exception using errcode='40001',message='DOCTOR_PATIENT_CONFLICT'; end if;
  if item.archived_at is not null then raise exception using errcode='22023',message='DOCTOR_PATIENT_ARCHIVED'; end if;
  update public.practice_patients set archived_at=now(),updated_at=now(),version=version+1 where id=item.id returning * into item;
  insert into public.patient_administrative_activity(practice_id,patient_id,location_id,actor_user_id,event_type,record_version)
    values(p_practice,item.id,p_location,actor,'patient.archived',item.version);
  insert into public.audit_events(practice_id,actor_user_id,event_type,entity_id,details)
    values(p_practice,actor,'patient.archived',item.id,jsonb_build_object('location_id',p_location,'version',item.version));
  result:=jsonb_build_object('patient_id',item.id,'version',item.version);
  insert into doctor_private.command_receipts values(actor,p_key,request,result);
  return result;
end $$;

create function public.doctor_patients(p_practice uuid,p_location uuid,p_page integer default 0,p_size integer default 25,p_search text default '',p_status text default 'active') returns jsonb
language sql stable security invoker set search_path='' as $$select doctor_private.patient_directory(p_practice,p_location,p_page,p_size,p_search,p_status)$$;
create function public.doctor_patient(p_practice uuid,p_location uuid,p_patient uuid) returns jsonb
language sql stable security invoker set search_path='' as $$select doctor_private.patient_record(p_practice,p_location,p_patient)$$;
create function public.doctor_patient_duplicate_review(p_practice uuid,p_location uuid,p_input jsonb,p_patient uuid default null) returns jsonb
language sql stable security invoker set search_path='' as $$select doctor_private.patient_duplicate_review(p_practice,p_location,p_input,p_patient)$$;
create function public.doctor_write_patient(p_practice uuid,p_location uuid,p_input jsonb,p_key uuid,p_patient uuid default null,p_expected_version integer default null,p_duplicate_review text default null) returns jsonb
language sql security invoker set search_path='' as $$select doctor_private.write_patient(p_practice,p_location,p_input,p_key,p_patient,p_expected_version,p_duplicate_review)$$;
create function public.doctor_archive_patient(p_practice uuid,p_location uuid,p_patient uuid,p_expected_version integer,p_key uuid) returns jsonb
language sql security invoker set search_path='' as $$select doctor_private.archive_patient(p_practice,p_location,p_patient,p_expected_version,p_key)$$;
revoke all on function doctor_private.patient_scope(uuid,uuid,boolean),doctor_private.patient_phone_key(text),doctor_private.patient_input(jsonb,uuid),doctor_private.patient_projection(public.practice_patients),doctor_private.patient_duplicate_review(uuid,uuid,jsonb,uuid),doctor_private.patient_directory(uuid,uuid,integer,integer,text,text),doctor_private.patient_record(uuid,uuid,uuid),doctor_private.write_patient(uuid,uuid,jsonb,uuid,uuid,integer,text),doctor_private.archive_patient(uuid,uuid,uuid,integer,uuid) from public,anon,authenticated;
grant execute on function doctor_private.patient_duplicate_review(uuid,uuid,jsonb,uuid),doctor_private.patient_directory(uuid,uuid,integer,integer,text,text),doctor_private.patient_record(uuid,uuid,uuid),doctor_private.write_patient(uuid,uuid,jsonb,uuid,uuid,integer,text),doctor_private.archive_patient(uuid,uuid,uuid,integer,uuid) to authenticated;
revoke all on function public.doctor_patients(uuid,uuid,integer,integer,text,text),public.doctor_patient(uuid,uuid,uuid),public.doctor_patient_duplicate_review(uuid,uuid,jsonb,uuid),public.doctor_write_patient(uuid,uuid,jsonb,uuid,uuid,integer,text),public.doctor_archive_patient(uuid,uuid,uuid,integer,uuid) from public,anon,authenticated;
grant execute on function public.doctor_patients(uuid,uuid,integer,integer,text,text),public.doctor_patient(uuid,uuid,uuid),public.doctor_patient_duplicate_review(uuid,uuid,jsonb,uuid),public.doctor_write_patient(uuid,uuid,jsonb,uuid,uuid,integer,text),public.doctor_archive_patient(uuid,uuid,uuid,integer,uuid) to authenticated;
