-- DOS-M1-012: administrative, unreviewed attachments. No clinical interpretation.
-- Storage bucket configuration uses the supported API/local CLI configuration;
-- do not alter provider table constraints or write object metadata directly.
create policy doctor_documents_bucket_guard on storage.buckets as restrictive for all to anon,authenticated
  using(id<>'doctor-private-documents') with check(id<>'doctor-private-documents');
create policy doctor_documents_object_guard on storage.objects as restrictive for all to anon,authenticated
  using(bucket_id<>'doctor-private-documents') with check(bucket_id<>'doctor-private-documents');

create table public.patient_documents (
  id uuid primary key,
  practice_id uuid not null references public.practices(id),
  patient_id uuid not null,
  current_version_id uuid not null,
  version integer not null default 1 check(version>0),
  created_by uuid not null references auth.users(id),
  created_location_id uuid not null,
  created_at timestamptz not null default now(),
  archived_at timestamptz,
  unique(practice_id,id),unique(practice_id,patient_id,id),
  foreign key(practice_id,patient_id) references public.practice_patients(practice_id,id),
  foreign key(practice_id,created_location_id) references public.locations(practice_id,id)
);
create table public.patient_document_versions (
  id uuid primary key,
  practice_id uuid not null,
  patient_id uuid not null,
  document_id uuid not null,
  revision integer not null check(revision>0),
  filename text not null check(length(filename) between 1 and 160),
  mime_type text not null check(mime_type in ('application/pdf','image/png','image/jpeg')),
  byte_size bigint not null check(byte_size between 1 and 5242880),
  sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'),
  object_path text not null unique,
  uploaded_by uuid not null references auth.users(id),
  uploaded_at timestamptz not null default now(),
  location_id uuid not null,
  location_name text not null,
  timezone text not null,
  provenance text not null default 'uploaded_unreviewed' check(provenance='uploaded_unreviewed'),
  unique(document_id,revision),unique(practice_id,document_id,id),
  foreign key(practice_id,patient_id,document_id) references public.patient_documents(practice_id,patient_id,id),
  foreign key(practice_id,location_id) references public.locations(practice_id,id)
);
alter table public.patient_documents add constraint patient_document_current_version
  foreign key(practice_id,id,current_version_id) references public.patient_document_versions(practice_id,document_id,id) deferrable initially deferred;
create table public.patient_document_events (
  id bigint generated always as identity primary key,
  practice_id uuid not null,
  patient_id uuid not null,
  document_id uuid not null,
  version_id uuid not null,
  event_type text not null check(event_type in ('document.uploaded','document.replaced','document.archived','document.download_requested')),
  actor_user_id uuid not null references auth.users(id),
  location_id uuid not null,
  location_name text not null,
  timezone text not null,
  happened_at timestamptz not null default now(),
  foreign key(practice_id,patient_id,document_id) references public.patient_documents(practice_id,patient_id,id),
  foreign key(practice_id,document_id,version_id) references public.patient_document_versions(practice_id,document_id,id),
  foreign key(practice_id,location_id) references public.locations(practice_id,id)
);
create index patient_documents_patient on public.patient_documents(practice_id,patient_id,id);
create index patient_documents_creator on public.patient_documents(created_by);
create index patient_documents_location on public.patient_documents(practice_id,created_location_id);
create index patient_versions_uploader on public.patient_document_versions(uploaded_by);
create index patient_versions_location on public.patient_document_versions(practice_id,location_id);
create index patient_document_events_record on public.patient_document_events(practice_id,patient_id,document_id,id desc);
create index patient_document_events_version on public.patient_document_events(practice_id,document_id,version_id);
create index patient_document_events_actor on public.patient_document_events(actor_user_id);
create index patient_document_events_location on public.patient_document_events(practice_id,location_id);
alter table public.patient_documents enable row level security;
alter table public.patient_document_versions enable row level security;
alter table public.patient_document_events enable row level security;
revoke all on public.patient_documents,public.patient_document_versions,public.patient_document_events from public,anon,authenticated;
revoke all on sequence public.patient_document_events_id_seq from public,anon,authenticated;
create table doctor_private.document_upload_intents (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references auth.users(id),
  command_key uuid not null,
  practice_id uuid not null references public.practices(id),
  patient_id uuid not null,
  location_id uuid not null,
  document_id uuid not null,
  version_id uuid not null default gen_random_uuid(),
  expected_version integer,
  filename text not null,
  mime_type text not null,
  byte_size bigint not null,
  sha256 text not null,
  object_path text not null unique,
  request jsonb not null,
  state text not null default 'reserved' check(state in ('reserved','committed','abandoned')),
  expires_at timestamptz not null default(now()+interval '24 hours'),
  result jsonb,
  unique(actor_user_id,command_key),
  foreign key(practice_id,patient_id) references public.practice_patients(practice_id,id),
  foreign key(practice_id,location_id) references public.locations(practice_id,id)
);
revoke all on doctor_private.document_upload_intents from public,anon,authenticated;
grant usage on schema doctor_private to service_role;

-- Only service-role RPCs can establish this verified actor context. The Edge
-- Function obtains these IDs from getUser + doctor_session_context, never input.
create function doctor_private.document_actor(p_actor uuid,p_session uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare previous jsonb:=auth.jwt();
begin
  perform set_config('request.jwt.claims',jsonb_build_object('sub',p_actor,'session_id',p_session,'role','authenticated')::text,true);
  perform doctor_private.current_actor();
  return previous;
end $$;
create function doctor_private.document_scope(p_practice uuid,p_location uuid,p_patient uuid,p_write boolean default false) returns void
language plpgsql stable security definer set search_path='' as $$
begin
  perform doctor_private.patient_scope(p_practice,p_location);
  perform doctor_private.require_access(p_practice,'documents.read',p_location);
  if p_write then perform doctor_private.require_access(p_practice,'documents.write',p_location); end if;
  if not exists(select 1 from public.practice_patients where practice_id=p_practice and id=p_patient and (not p_write or archived_at is null)) then
    raise exception using errcode='42501',message='DOCTOR_ACCESS_DENIED';
  end if;
end $$;
create function doctor_private.document_account_label(p_actor uuid) returns text
language sql stable security definer set search_path='' as $$
  select left(coalesce((select display_name from public.doctor_profiles where user_id=p_actor),
    (select nullif(raw_user_meta_data->>'display_name','') from auth.users where id=p_actor),''),160)
$$;
create function doctor_private.document_version_view(p public.patient_document_versions) returns jsonb
language sql stable security invoker set search_path='' as $$
  select jsonb_build_object('id',p.id,'document_id',p.document_id,'revision',p.revision,'filename',p.filename,'mime_type',p.mime_type,
    'byte_size',p.byte_size,'uploaded_by',p.uploaded_by,'uploaded_by_label',doctor_private.document_account_label(p.uploaded_by),'uploaded_at',p.uploaded_at,'location_id',p.location_id,'location_name',p.location_name,
    'timezone',p.timezone,'provenance',p.provenance)
$$;
create function doctor_private.document_directory(p_practice uuid,p_location uuid,p_patient uuid,p_page integer,p_size integer) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare rows jsonb; total bigint;
begin
  perform doctor_private.document_scope(p_practice,p_location,p_patient);
  if p_page is null or p_page not between 0 and 100000 or p_size is null or p_size not between 1 and 50 then
    raise exception using errcode='22023',message='DOCTOR_DOCUMENT_INVALID';
  end if;
  select count(*) into total from public.patient_documents where practice_id=p_practice and patient_id=p_patient;
  select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'practice_id',d.practice_id,'patient_id',d.patient_id,'version',d.version,'created_by',d.created_by,
    'created_location_id',d.created_location_id,'created_at',d.created_at,'archived_at',d.archived_at,'current',doctor_private.document_version_view(v)) order by d.created_at desc,d.id),'[]')
    into rows from (select * from public.patient_documents where practice_id=p_practice and patient_id=p_patient order by created_at desc,id limit p_size offset(p_page::bigint*p_size))d
    join public.patient_document_versions v on v.id=d.current_version_id and v.document_id=d.id and v.practice_id=d.practice_id;
  return jsonb_build_object('rows',rows,'total',total,'can_write',doctor_private.has_access(p_practice,'documents.write',p_location)
    and exists(select 1 from public.practice_patients where id=p_patient and archived_at is null));
end $$;
create function doctor_private.document_history(p_practice uuid,p_location uuid,p_patient uuid,p_document uuid,p_page integer,p_size integer) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare versions jsonb; events jsonb; total bigint;
begin
  perform doctor_private.document_scope(p_practice,p_location,p_patient);
  if not exists(select 1 from public.patient_documents where id=p_document and practice_id=p_practice and patient_id=p_patient) then
    raise exception using errcode='42501',message='DOCTOR_ACCESS_DENIED';
  end if;
  if p_page is null or p_page not between 0 and 100000 or p_size is null or p_size not between 1 and 50 then
    raise exception using errcode='22023',message='DOCTOR_DOCUMENT_INVALID';
  end if;
  select count(*) into total from public.patient_document_versions where document_id=p_document;
  select coalesce(jsonb_agg(doctor_private.document_version_view(v) order by v.revision desc),'[]') into versions from
    (select * from public.patient_document_versions where document_id=p_document and practice_id=p_practice order by revision desc limit p_size offset(p_page::bigint*p_size))v;
  select coalesce(jsonb_agg(to_jsonb(e) order by e.id desc),'[]') into events from
    (select id,event_type,version_id,actor_user_id,doctor_private.document_account_label(actor_user_id) as actor_label,location_id,location_name,timezone,happened_at from public.patient_document_events where document_id=p_document and practice_id=p_practice order by id desc limit 100)e;
  return jsonb_build_object('versions',versions,'total',total,'events',events);
end $$;
create function doctor_private.reserve_document(p_actor uuid,p_session uuid,p_practice uuid,p_location uuid,p_patient uuid,p_filename text,p_mime text,p_size bigint,p_sha text,p_key uuid,p_document uuid,p_expected_version integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare previous jsonb; item public.patient_documents; intent doctor_private.document_upload_intents; request jsonb; object_key text; logical_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_practice::text,1));
  previous:=doctor_private.document_actor(p_actor,p_session);
  perform doctor_private.document_scope(p_practice,p_location,p_patient,true);
  if p_key is null or p_filename is null or length(p_filename) not between 1 and 160 or p_filename ~ '[[:cntrl:]]'
    or position('/' in p_filename)>0 or position(chr(92) in p_filename)>0 or p_mime is null or p_mime not in ('application/pdf','image/png','image/jpeg')
    or (p_mime='application/pdf' and right(lower(p_filename),4)<>'.pdf')
    or (p_mime='image/png' and right(lower(p_filename),4)<>'.png')
    or (p_mime='image/jpeg' and right(lower(p_filename),4)<>'.jpg' and right(lower(p_filename),5)<>'.jpeg')
    or p_size is null or p_size not between 1 and 5242880 or p_sha is null or p_sha !~ '^[a-f0-9]{64}$'
    or (p_document is null and p_expected_version is not null) then raise exception using errcode='22023',message='DOCTOR_DOCUMENT_INVALID'; end if;
  request:=jsonb_build_object('session',p_session,'practice',p_practice,'location',p_location,'patient',p_patient,'document',p_document,'version',p_expected_version,
    'filename',p_filename,'mime',p_mime,'size',p_size,'sha',p_sha);
  select * into intent from doctor_private.document_upload_intents where actor_user_id=p_actor and command_key=p_key;
  if found then
    if intent.request<>request then raise exception using errcode='22023',message='DOCTOR_IDEMPOTENCY_CONFLICT'; end if;
    if intent.state='abandoned' or (intent.state<>'committed' and intent.expires_at<=clock_timestamp()) then raise exception using errcode='22023',message='DOCTOR_DOCUMENT_INTENT_EXPIRED'; end if;
  else
    if exists(select 1 from doctor_private.command_receipts where actor_user_id=p_actor and command_key=p_key) then raise exception using errcode='22023',message='DOCTOR_IDEMPOTENCY_CONFLICT'; end if;
    if p_document is not null then
      select * into item from public.patient_documents where id=p_document and practice_id=p_practice and patient_id=p_patient for update;
      if not found then raise exception using errcode='42501',message='DOCTOR_ACCESS_DENIED'; end if;
      if item.version is distinct from p_expected_version then raise exception using errcode='40001',message='DOCTOR_DOCUMENT_CONFLICT'; end if;
      if item.archived_at is not null then raise exception using errcode='22023',message='DOCTOR_DOCUMENT_ARCHIVED'; end if;
    end if;
    logical_id:=coalesce(p_document,gen_random_uuid());
    object_key:=p_practice::text||'/'||p_patient::text||'/'||logical_id::text||'/'||gen_random_uuid()::text||case p_mime when 'application/pdf' then '.pdf' when 'image/png' then '.png' else '.jpg' end;
    insert into doctor_private.document_upload_intents(actor_user_id,command_key,practice_id,patient_id,location_id,document_id,expected_version,filename,mime_type,byte_size,sha256,object_path,request)
      values(p_actor,p_key,p_practice,p_patient,p_location,logical_id,p_expected_version,p_filename,p_mime,p_size,p_sha,object_key,request) returning * into intent;
  end if;
  perform set_config('request.jwt.claims',previous::text,true);
  return jsonb_build_object('intent_id',intent.id,'document_id',intent.document_id,'version_id',intent.version_id,'object_path',intent.object_path,'mime_type',intent.mime_type,'byte_size',intent.byte_size,'sha256',intent.sha256,'state',intent.state,'result',intent.result);
end $$;
create function doctor_private.finalize_document(p_actor uuid,p_session uuid,p_intent uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare previous jsonb; intent doctor_private.document_upload_intents; item public.patient_documents; place public.locations; outcome jsonb; revision integer; prior doctor_private.command_receipts; receipt_request jsonb;
begin
  select * into intent from doctor_private.document_upload_intents where id=p_intent and actor_user_id=p_actor;
  if not found then raise exception using errcode='42501',message='DOCTOR_ACCESS_DENIED'; end if;
  perform pg_advisory_xact_lock(hashtextextended(intent.practice_id::text,1));
  previous:=doctor_private.document_actor(p_actor,p_session);
  perform doctor_private.document_scope(intent.practice_id,intent.location_id,intent.patient_id,true);
  select * into intent from doctor_private.document_upload_intents where id=p_intent for update;
  if intent.request->>'session'<>p_session::text then raise exception using errcode='42501',message='DOCTOR_ACCESS_DENIED'; end if;
  if intent.state='committed' then perform set_config('request.jwt.claims',previous::text,true); return intent.result; end if;
  if intent.state<>'reserved' or intent.expires_at<=clock_timestamp() then raise exception using errcode='22023',message='DOCTOR_DOCUMENT_INTENT_EXPIRED'; end if;
  receipt_request:=jsonb_build_object('command','document.upload','intent',intent.id,'material',intent.request);
  select * into prior from doctor_private.command_receipts where actor_user_id=p_actor and command_key=intent.command_key;
  if found then raise exception using errcode='22023',message='DOCTOR_IDEMPOTENCY_CONFLICT'; end if;
  select * into place from public.locations where id=intent.location_id and practice_id=intent.practice_id;
  if intent.expected_version is null then
    insert into public.patient_documents(id,practice_id,patient_id,current_version_id,created_by,created_location_id)
      values(intent.document_id,intent.practice_id,intent.patient_id,intent.version_id,p_actor,intent.location_id) returning * into item;
    revision:=1;
  else
    select * into item from public.patient_documents where id=intent.document_id and practice_id=intent.practice_id and patient_id=intent.patient_id for update;
    if not found then raise exception using errcode='42501',message='DOCTOR_ACCESS_DENIED'; end if;
    if item.version is distinct from intent.expected_version then raise exception using errcode='40001',message='DOCTOR_DOCUMENT_CONFLICT'; end if;
    if item.archived_at is not null then raise exception using errcode='22023',message='DOCTOR_DOCUMENT_ARCHIVED'; end if;
    select coalesce(max(v.revision),0)+1 into revision from public.patient_document_versions v where document_id=item.id;
    update public.patient_documents set current_version_id=intent.version_id,version=version+1 where id=item.id returning * into item;
  end if;
  insert into public.patient_document_versions(id,practice_id,patient_id,document_id,revision,filename,mime_type,byte_size,sha256,object_path,uploaded_by,location_id,location_name,timezone)
    values(intent.version_id,intent.practice_id,intent.patient_id,intent.document_id,revision,intent.filename,intent.mime_type,intent.byte_size,intent.sha256,intent.object_path,p_actor,place.id,place.name,place.timezone);
  insert into public.patient_document_events(practice_id,patient_id,document_id,version_id,event_type,actor_user_id,location_id,location_name,timezone)
    values(intent.practice_id,intent.patient_id,item.id,intent.version_id,case when revision=1 then 'document.uploaded' else 'document.replaced' end,p_actor,place.id,place.name,place.timezone);
  insert into public.audit_events(practice_id,actor_user_id,event_type,entity_id,details)
    values(intent.practice_id,p_actor,case when revision=1 then 'document.uploaded' else 'document.replaced' end,item.id,jsonb_build_object('patient_id',intent.patient_id,'location_id',place.id,'document_version',item.version,'file_revision',revision));
  outcome:=jsonb_build_object('document_id',item.id,'version_id',intent.version_id,'version',item.version);
  update doctor_private.document_upload_intents set state='committed',result=outcome where id=p_intent;
  insert into doctor_private.command_receipts values(p_actor,intent.command_key,receipt_request,outcome);
  perform set_config('request.jwt.claims',previous::text,true);
  return outcome;
end $$;
create function doctor_private.document_delivery(p_actor uuid,p_session uuid,p_practice uuid,p_location uuid,p_patient uuid,p_document uuid,p_version uuid,p_key uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare previous jsonb; item public.patient_documents; file public.patient_document_versions; prior doctor_private.command_receipts; place public.locations; request jsonb; result jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_practice::text,1));
  previous:=doctor_private.document_actor(p_actor,p_session);
  perform doctor_private.document_scope(p_practice,p_location,p_patient);
  select * into item from public.patient_documents where id=p_document and practice_id=p_practice and patient_id=p_patient;
  if not found then raise exception using errcode='42501',message='DOCTOR_ACCESS_DENIED'; end if;
  select * into file from public.patient_document_versions where id=coalesce(p_version,item.current_version_id) and document_id=item.id and practice_id=p_practice;
  if not found then raise exception using errcode='42501',message='DOCTOR_ACCESS_DENIED'; end if;
  if p_key is not null then
    request:=jsonb_build_object('command','document.download_requested','practice',p_practice,'location',p_location,'patient',p_patient,'document',p_document,'file_version',file.id);
    select * into prior from doctor_private.command_receipts where actor_user_id=p_actor and command_key=p_key;
    if found and prior.request<>request then raise exception using errcode='22023',message='DOCTOR_IDEMPOTENCY_CONFLICT'; end if;
    if not found then
      select * into place from public.locations where id=p_location;
      insert into public.patient_document_events(practice_id,patient_id,document_id,version_id,event_type,actor_user_id,location_id,location_name,timezone)
        values(p_practice,p_patient,item.id,file.id,'document.download_requested',p_actor,place.id,place.name,place.timezone);
      insert into public.audit_events(practice_id,actor_user_id,event_type,entity_id,details)
        values(p_practice,p_actor,'document.download_requested',item.id,jsonb_build_object('patient_id',p_patient,'location_id',p_location,'file_revision',file.revision));
      insert into doctor_private.command_receipts values(p_actor,p_key,request,jsonb_build_object('document_id',item.id,'version_id',file.id));
    end if;
  end if;
  result:=jsonb_build_object('document_id',item.id,'version_id',file.id,'object_path',file.object_path,'mime_type',file.mime_type,'filename',file.filename,'byte_size',file.byte_size,'sha256',file.sha256);
  perform set_config('request.jwt.claims',previous::text,true);
  return result;
end $$;
create function doctor_private.archive_document(p_practice uuid,p_location uuid,p_patient uuid,p_document uuid,p_expected_version integer,p_key uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=doctor_private.current_actor(); item public.patient_documents; prior doctor_private.command_receipts; place public.locations; result jsonb;
  request jsonb:=jsonb_build_object('command','document.archive','practice',p_practice,'location',p_location,'patient',p_patient,'document',p_document,'version',p_expected_version);
begin
  if p_key is null then raise exception using errcode='22023',message='DOCTOR_COMMAND_KEY_REQUIRED'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_practice::text,1));
  perform doctor_private.document_scope(p_practice,p_location,p_patient,true);
  select * into prior from doctor_private.command_receipts where actor_user_id=actor and command_key=p_key;
  if found then
    if prior.request<>request then raise exception using errcode='22023',message='DOCTOR_IDEMPOTENCY_CONFLICT'; end if;
    return prior.result;
  end if;
  select * into item from public.patient_documents where id=p_document and practice_id=p_practice and patient_id=p_patient for update;
  if not found then raise exception using errcode='42501',message='DOCTOR_ACCESS_DENIED'; end if;
  if item.version is distinct from p_expected_version then raise exception using errcode='40001',message='DOCTOR_DOCUMENT_CONFLICT'; end if;
  if item.archived_at is not null then raise exception using errcode='22023',message='DOCTOR_DOCUMENT_ARCHIVED'; end if;
  update public.patient_documents set archived_at=now(),version=version+1 where id=item.id returning * into item;
  select * into place from public.locations where id=p_location;
  insert into public.patient_document_events(practice_id,patient_id,document_id,version_id,event_type,actor_user_id,location_id,location_name,timezone)
    values(p_practice,p_patient,item.id,item.current_version_id,'document.archived',actor,place.id,place.name,place.timezone);
  insert into public.audit_events(practice_id,actor_user_id,event_type,entity_id,details) values(p_practice,actor,'document.archived',item.id,jsonb_build_object('patient_id',p_patient,'location_id',p_location,'version',item.version));
  result:=jsonb_build_object('document_id',item.id,'version',item.version);
  insert into doctor_private.command_receipts values(actor,p_key,request,result);
  return result;
end $$;

create function public.doctor_patient_documents(p_practice uuid,p_location uuid,p_patient uuid,p_page integer default 0,p_size integer default 20) returns jsonb
language sql stable security invoker set search_path='' as $$select doctor_private.document_directory(p_practice,p_location,p_patient,p_page,p_size)$$;
create function public.doctor_document_history(p_practice uuid,p_location uuid,p_patient uuid,p_document uuid,p_page integer default 0,p_size integer default 20) returns jsonb
language sql stable security invoker set search_path='' as $$select doctor_private.document_history(p_practice,p_location,p_patient,p_document,p_page,p_size)$$;
create function public.doctor_archive_document(p_practice uuid,p_location uuid,p_patient uuid,p_document uuid,p_expected_version integer,p_key uuid) returns jsonb
language sql security invoker set search_path='' as $$select doctor_private.archive_document(p_practice,p_location,p_patient,p_document,p_expected_version,p_key)$$;
create function public.doctor_reserve_document(p_actor uuid,p_session uuid,p_practice uuid,p_location uuid,p_patient uuid,p_filename text,p_mime text,p_size bigint,p_sha text,p_key uuid,p_document uuid default null,p_expected_version integer default null) returns jsonb
language sql security invoker set search_path='' as $$select doctor_private.reserve_document(p_actor,p_session,p_practice,p_location,p_patient,p_filename,p_mime,p_size,p_sha,p_key,p_document,p_expected_version)$$;
create function public.doctor_finalize_document(p_actor uuid,p_session uuid,p_intent uuid) returns jsonb
language sql security invoker set search_path='' as $$select doctor_private.finalize_document(p_actor,p_session,p_intent)$$;
create function public.doctor_document_delivery(p_actor uuid,p_session uuid,p_practice uuid,p_location uuid,p_patient uuid,p_document uuid,p_version uuid default null,p_key uuid default null) returns jsonb
language sql security invoker set search_path='' as $$select doctor_private.document_delivery(p_actor,p_session,p_practice,p_location,p_patient,p_document,p_version,p_key)$$;

revoke all on function doctor_private.document_actor(uuid,uuid),doctor_private.document_scope(uuid,uuid,uuid,boolean),doctor_private.document_version_view(public.patient_document_versions),doctor_private.document_directory(uuid,uuid,uuid,integer,integer),doctor_private.document_history(uuid,uuid,uuid,uuid,integer,integer),doctor_private.reserve_document(uuid,uuid,uuid,uuid,uuid,text,text,bigint,text,uuid,uuid,integer),doctor_private.finalize_document(uuid,uuid,uuid),doctor_private.document_delivery(uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid),doctor_private.archive_document(uuid,uuid,uuid,uuid,integer,uuid) from public,anon,authenticated,service_role;
grant execute on function doctor_private.document_directory(uuid,uuid,uuid,integer,integer),doctor_private.document_history(uuid,uuid,uuid,uuid,integer,integer),doctor_private.archive_document(uuid,uuid,uuid,uuid,integer,uuid) to authenticated;
grant execute on function doctor_private.reserve_document(uuid,uuid,uuid,uuid,uuid,text,text,bigint,text,uuid,uuid,integer),doctor_private.finalize_document(uuid,uuid,uuid),doctor_private.document_delivery(uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid) to service_role;
revoke all on function public.doctor_patient_documents(uuid,uuid,uuid,integer,integer),public.doctor_document_history(uuid,uuid,uuid,uuid,integer,integer),public.doctor_archive_document(uuid,uuid,uuid,uuid,integer,uuid),public.doctor_reserve_document(uuid,uuid,uuid,uuid,uuid,text,text,bigint,text,uuid,uuid,integer),public.doctor_finalize_document(uuid,uuid,uuid),public.doctor_document_delivery(uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.doctor_patient_documents(uuid,uuid,uuid,integer,integer),public.doctor_document_history(uuid,uuid,uuid,uuid,integer,integer),public.doctor_archive_document(uuid,uuid,uuid,uuid,integer,uuid) to authenticated;
grant execute on function public.doctor_reserve_document(uuid,uuid,uuid,uuid,uuid,text,text,bigint,text,uuid,uuid,integer),public.doctor_finalize_document(uuid,uuid,uuid),public.doctor_document_delivery(uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid) to service_role;

create function doctor_private.patient_profile(p_practice uuid,p_location uuid,p_patient uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare data jsonb; place public.locations; events jsonb;
begin
  data:=doctor_private.patient_record(p_practice,p_location,p_patient);
  select * into place from public.locations where id=(data->'patient'->>'created_location_id')::uuid and practice_id=p_practice;
  select coalesce(jsonb_agg(e order by (e->>'id')::bigint desc),'[]') into events from
    (select a||jsonb_build_object('actor_label',doctor_private.document_account_label((a->>'actor_user_id')::uuid)) e from jsonb_array_elements(data->'activity')a) rows;
  return data||jsonb_build_object('activity',events,'source_context',jsonb_build_object('location_id',place.id,'location_name',place.name,
    'actor_label',doctor_private.document_account_label((data->'patient'->>'created_by')::uuid)),
    'documents_read',doctor_private.has_access(p_practice,'documents.read',p_location),
    'documents_write',doctor_private.has_access(p_practice,'documents.read',p_location) and doctor_private.has_access(p_practice,'documents.write',p_location)
      and data->'patient'->>'archived_at' is null);
end $$;
create function public.doctor_patient_profile(p_practice uuid,p_location uuid,p_patient uuid) returns jsonb
language sql stable security invoker set search_path='' as $$select doctor_private.patient_profile(p_practice,p_location,p_patient)$$;
revoke all on function doctor_private.document_account_label(uuid),doctor_private.patient_profile(uuid,uuid,uuid),public.doctor_patient_profile(uuid,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function doctor_private.patient_profile(uuid,uuid,uuid),public.doctor_patient_profile(uuid,uuid,uuid) to authenticated;
