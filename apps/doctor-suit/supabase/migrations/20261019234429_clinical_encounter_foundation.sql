-- DOS-M2 synthetic engineering, owner-authorized 2026-10-20.
-- No clinical approval, live data, prescribing authority or admissions are seeded.
create table doctor_private.clinical_fixture_grants (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.practices(id),
  location_id uuid not null,
  user_id uuid not null references auth.users(id),
  capabilities text[] not null check (capabilities <@ array['read','draft','review','sign','release','export']::text[]),
  purpose text not null check (purpose='synthetic_fixture'),
  evidence_ref text not null check (length(btrim(evidence_ref)) between 1 and 200),
  policy_version text not null check (policy_version='synthetic-engineering-v1'),
  issued_at timestamptz not null default clock_timestamp(),
  valid_until timestamptz not null,
  revoked_at timestamptz,
  check (valid_until>issued_at and valid_until<=issued_at+interval '24 hours'),
  foreign key(practice_id,location_id) references public.locations(practice_id,id)
);
create table public.clinical_note_templates (
  template_id text not null,
  version integer not null check(version>0),
  sections jsonb not null,
  data_mode text not null check(data_mode='synthetic'),
  primary key(template_id,version)
);
insert into public.clinical_note_templates values
 ('synthetic-neutral',1,'[{"key":"entered_note","required":true},{"key":"review_notes","required":false}]','synthetic');
create table public.clinical_encounters (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.practices(id),
  patient_id uuid not null,
  location_id uuid not null,
  responsible_doctor uuid not null references public.doctor_profiles(user_id),
  location_name text not null,
  timezone text not null,
  status text not null check(status in('draft','in_progress','finalized','amended','withdrawn')),
  version integer not null default 1 check(version>0),
  active_version_id uuid,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  data_mode text not null default 'synthetic' check(data_mode='synthetic'),
  unique(practice_id,id),
  foreign key(practice_id,patient_id) references public.practice_patients(practice_id,id),
  foreign key(practice_id,location_id) references public.locations(practice_id,id)
);
create index clinical_encounters_scope on public.clinical_encounters(practice_id,location_id,updated_at desc,id);
create table public.clinical_versions (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null,
  encounter_id uuid not null,
  revision integer not null check(revision>0),
  kind text not null check(kind in('draft','in_progress','amended','finalized','withdrawn')),
  source_version_id uuid references public.clinical_versions(id),
  snapshot jsonb not null,
  snapshot_sha256 text not null check(snapshot_sha256~'^[0-9a-f]{64}$'),
  reason text,
  actor_user_id uuid not null references auth.users(id),
  actor_session_id uuid not null,
  happened_at timestamptz not null default clock_timestamp(),
  unique(practice_id,encounter_id,id), unique(encounter_id,revision),
  foreign key(practice_id,encounter_id) references public.clinical_encounters(practice_id,id)
);
alter table public.clinical_encounters add foreign key(practice_id,id,active_version_id)
 references public.clinical_versions(practice_id,encounter_id,id) deferrable initially deferred;
create table public.clinical_events (
  id bigint generated always as identity primary key,
  practice_id uuid not null,
  encounter_id uuid not null,
  version_id uuid not null,
  action text not null check(action in('create','save','start','finalize','amend','withdraw','release','revoke_release','export','download')),
  actor_user_id uuid not null references auth.users(id),
  happened_at timestamptz not null default clock_timestamp(),
  foreign key(practice_id,encounter_id,version_id) references public.clinical_versions(practice_id,encounter_id,id)
);
create table public.clinical_releases (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null,
  encounter_id uuid not null,
  version_id uuid not null,
  recipient_patient_id uuid not null,
  recipient_user_id uuid not null references auth.users(id),
  released_by uuid not null references auth.users(id),
  released_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null,
  foreign key(practice_id,encounter_id,version_id) references public.clinical_versions(practice_id,encounter_id,id),
  foreign key(practice_id,recipient_patient_id) references public.practice_patients(practice_id,id),
  check(expires_at>released_at and expires_at<=released_at+interval '7 days')
);
-- No patient login is inferred from matching contacts. This explicit fixture
-- relationship is separate from chart ownership and contains no caregiver default.
create table doctor_private.clinical_recipient_grants (
  practice_id uuid not null,
  patient_id uuid not null,
  user_id uuid not null references auth.users(id),
  purpose text not null check(purpose='synthetic_fixture'),
  valid_until timestamptz not null,
  revoked_at timestamptz,
  primary key(practice_id,patient_id,user_id),
  foreign key(practice_id,patient_id) references public.practice_patients(practice_id,id)
);
create table public.clinical_release_revocations (
  release_id uuid primary key references public.clinical_releases(id),
  reason text not null check(length(btrim(reason)) between 1 and 500),
  actor_user_id uuid not null references auth.users(id),
  happened_at timestamptz not null default clock_timestamp()
);
create function doctor_private.clinical_immutable() returns trigger
language plpgsql security invoker set search_path='' as $$
begin raise exception using errcode='42501',message='DOCTOR_CLINICAL_IMMUTABLE'; end $$;
create function doctor_private.clinical_shape(p_value jsonb,p_keys text[]) returns void
language plpgsql immutable security invoker set search_path='' as $$
begin
 if p_value is null or jsonb_typeof(p_value)<>'object' or not p_value ?& p_keys
  or exists(select 1 from jsonb_object_keys(p_value) k where not k=any(p_keys)) then
  raise exception using errcode='22023',message='DOCTOR_CLINICAL_INVALID'; end if;
end $$;
create function doctor_private.clinical_text(p_value jsonb,p_max integer,p_empty boolean default false) returns void
language plpgsql immutable security invoker set search_path='' as $$
begin
 if p_value is null or jsonb_typeof(p_value)<>'string' or length(p_value#>>'{}')>p_max
  or (not p_empty and length(btrim(p_value#>>'{}'))=0) or (p_value#>>'{}')~'[\x00-\x08\x0B\x0C\x0E-\x1F]' then
  raise exception using errcode='22023',message='DOCTOR_CLINICAL_INVALID'; end if;
end $$;
create function doctor_private.clinical_scope(p_practice uuid,p_location uuid,p_capability text,p_write boolean default false) returns uuid
language plpgsql volatile security definer set search_path='' as $$
declare actor uuid:=doctor_private.current_actor(); owner_id uuid;
begin
 -- Administrative candidate never acquires clinical capabilities. Neither
 -- ownership, metadata, email verification nor SaaS payment supplies a fixture grant.
 if doctor_private.edition_mode()<>'synthetic_preview'
  or not doctor_private.has_access(p_practice,'patients.read',p_location)
  or not exists(select 1 from doctor_private.clinical_fixture_grants g
    where g.practice_id=p_practice and g.location_id=p_location and g.user_id=actor
     and g.purpose='synthetic_fixture' and g.policy_version='synthetic-engineering-v1'
     and p_capability=any(g.capabilities) and 'read'=any(g.capabilities)
     and g.issued_at<=clock_timestamp() and g.valid_until>clock_timestamp() and g.revoked_at is null) then
  raise exception using errcode='42501',message='DOCTOR_CLINICAL_UNAVAILABLE'; end if;
 select owner_user_id into owner_id from public.practices where id=p_practice;
 if p_capability=any(array['review','sign','release']) and actor<>owner_id then
  raise exception using errcode='42501',message='DOCTOR_CLINICAL_SIGNER_REQUIRED'; end if;
 if p_write and exists(select 1 from public.locations where id=p_location and archived_at is not null) then
  raise exception using errcode='22023',message='DOCTOR_CLINICAL_ARCHIVED'; end if;
 return actor;
end $$;
create or replace function doctor_private.clinical_snapshot(p_value jsonb,p_practice uuid,p_location uuid,p_patient uuid,p_finalize boolean default false) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare item jsonb; segment jsonb; other jsonb; definition jsonb; seen text[]; s date; e date; keys text[];
begin
 perform doctor_private.clinical_shape(p_value,array['intake','note','prescriptions','orders','results']);
 if octet_length(p_value::text)>131072 then raise exception using errcode='22023',message='DOCTOR_CLINICAL_TOO_LARGE';end if;
 foreach keys slice 1 in array array[array['intake'],array['prescriptions'],array['orders'],array['results']] loop
  if jsonb_typeof(p_value->keys[1]) is distinct from 'array' or jsonb_array_length(p_value->keys[1])>100 then
   raise exception using errcode='22023',message='DOCTOR_CLINICAL_INVALID';end if;
  if exists(select 1 from jsonb_array_elements(p_value->keys[1]) x where jsonb_typeof(x)<>'object' or coalesce(x->>'id','')!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
   or (select count(distinct x->>'id') from jsonb_array_elements(p_value->keys[1]) x)<>jsonb_array_length(p_value->keys[1]) then
   raise exception using errcode='22023',message='DOCTOR_CLINICAL_INVALID';end if;
 end loop;
 if p_value->'intake'<>'[]'::jsonb then raise exception using errcode='22023',message='DOCTOR_CLINICAL_FIELD_UNAVAILABLE';end if;
 if p_value->'note' is distinct from '{"template_id":"synthetic-neutral","template_version":1,"sections":[{"key":"entered_note","text":""},{"key":"review_notes","text":""}]}'::jsonb then
 raise exception using errcode='22023',message='DOCTOR_CLINICAL_NOTE_UNAVAILABLE';end if;
 if p_value->'prescriptions'<>'[]'::jsonb then raise exception using errcode='22023',message='DOCTOR_CLINICAL_FIELD_UNAVAILABLE';end if;
 if p_value->'orders'<>'[]'::jsonb then raise exception using errcode='22023',message='DOCTOR_CLINICAL_FIELD_UNAVAILABLE';end if;
 if p_value->'results'<>'[]'::jsonb then raise exception using errcode='22023',message='DOCTOR_CLINICAL_FIELD_UNAVAILABLE';end if;
 return p_value;
end $$;
create or replace function doctor_private.clinical_command(p_practice uuid,p_location uuid,p_encounter uuid,p_expected_version integer,p_action text,p_input jsonb,p_key uuid) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare actor uuid; sid uuid; prior doctor_private.command_receipts; request jsonb; result jsonb;
 encounter public.clinical_encounters; latest public.clinical_versions; written public.clinical_versions;
 place public.locations; patient uuid; snapshot jsonb; reason text; capability text; release public.clinical_releases; old_item jsonb; new_item jsonb; stages text[]:=array['requested','uploaded','received','reviewed','released'];
begin
 if p_key is null or p_input is null or jsonb_typeof(p_input)<>'object' or p_action is null
  or p_action<>all(array['create','save','start']) then
  raise exception using errcode='22023',message='DOCTOR_CLINICAL_INVALID';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_practice::text,1));
 capability:=case when p_action in('finalize','withdraw') then 'sign' when p_action='amend' then 'review'
  when p_action in('release','revoke_release') then 'release' else 'draft' end;
 actor:=doctor_private.clinical_scope(p_practice,p_location,capability,true);sid:=(auth.jwt()->>'session_id')::uuid;
 request:=jsonb_build_object('command','clinical.'||p_action,'practice',p_practice,'location',p_location,'encounter',p_encounter,'version',p_expected_version,'input',p_input,'session',sid);
 if p_action='create' then
  perform doctor_private.clinical_shape(p_input,array['patient_id','snapshot']);
  if p_encounter is not null or p_expected_version is not null or coalesce(p_input->>'patient_id','')!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
   raise exception using errcode='22023',message='DOCTOR_CLINICAL_INVALID';end if;
  patient:=(p_input->>'patient_id')::uuid;
 else
  select * into encounter from public.clinical_encounters where practice_id=p_practice and location_id=p_location and id=p_encounter for update;
  if not found then raise exception using errcode='42501',message='DOCTOR_CLINICAL_UNAVAILABLE';end if;
  patient:=encounter.patient_id;
 end if;
 if not exists(select 1 from public.practice_patients where practice_id=p_practice and id=patient and archived_at is null) then
  raise exception using errcode='42501',message='DOCTOR_CLINICAL_PATIENT_DENIED';end if;
 -- Authority and patient/archive status are checked even on a receipt replay.
 select * into prior from doctor_private.command_receipts where actor_user_id=actor and command_key=p_key;
 if found then
  if prior.request<>request then raise exception using errcode='22023',message='DOCTOR_IDEMPOTENCY_CONFLICT';end if;
  return prior.result;
 end if;
 if p_action<>'create' then
  if encounter.version is distinct from p_expected_version then raise exception using errcode='40001',message='DOCTOR_CLINICAL_CONFLICT';end if;
  select * into latest from public.clinical_versions where encounter_id=encounter.id order by revision desc limit 1;
  snapshot:=latest.snapshot;
 end if;
 if p_action='create' then
  select * into place from public.locations where id=p_location and practice_id=p_practice;
  snapshot:=doctor_private.clinical_snapshot(p_input->'snapshot',p_practice,p_location,patient);
  insert into public.clinical_encounters(practice_id,patient_id,location_id,responsible_doctor,location_name,timezone,status,created_by)
   select p_practice,patient,p_location,p.owner_user_id,place.name,place.timezone,'draft',actor from public.practices p where p.id=p_practice returning * into encounter;
 elsif p_action='save' then
  perform doctor_private.clinical_shape(p_input,array['snapshot']);
  if encounter.status not in('draft','in_progress','amended') then raise exception using errcode='22023',message='DOCTOR_CLINICAL_IMMUTABLE';end if;
  snapshot:=doctor_private.clinical_snapshot(p_input->'snapshot',p_practice,p_location,patient);
  reason:=latest.reason;
 elsif p_action='start' then
  perform doctor_private.clinical_shape(p_input,'{}');
  if encounter.status<>'draft' then raise exception using errcode='22023',message='DOCTOR_CLINICAL_TRANSITION_INVALID';end if;
  encounter.status:='in_progress';
 end if;
 if p_action in('create','save') then
  for new_item in select value from jsonb_array_elements(snapshot->'orders') loop
   select x into old_item from jsonb_array_elements(coalesce(latest.snapshot->'orders','[]')) x where x->>'id'=new_item->>'id';
   if (old_item is null and new_item->>'state'<>'requested') or (old_item->>'state'='cancelled' and new_item->>'state'<>'cancelled') then
    raise exception using errcode='22023',message='DOCTOR_CLINICAL_ORDER_TRANSITION_INVALID';end if;
  end loop;
  for old_item in select value from jsonb_array_elements(coalesce(latest.snapshot->'orders','[]')) loop
   if old_item->>'state'<>'cancelled' and not exists(select 1 from jsonb_array_elements(snapshot->'orders') x where x->>'id'=old_item->>'id') then
    raise exception using errcode='22023',message='DOCTOR_CLINICAL_ORDER_REASON_REQUIRED';end if;
  end loop;
  for new_item in select value from jsonb_array_elements(snapshot->'results') loop
   select x into old_item from jsonb_array_elements(coalesce(latest.snapshot->'results','[]')) x where x->>'id'=new_item->>'id';
   if old_item is null then
    if new_item->>'stage' not in('requested','uploaded') then raise exception using errcode='22023',message='DOCTOR_CLINICAL_RESULT_TRANSITION_INVALID';end if;
   elsif old_item->>'order_id' is distinct from new_item->>'order_id' then
    raise exception using errcode='22023',message='DOCTOR_CLINICAL_RESULT_TRANSITION_INVALID';
   elsif old_item->>'document_version_id' is distinct from new_item->>'document_version_id' then
    if new_item->>'stage'<>'uploaded' then raise exception using errcode='22023',message='DOCTOR_CLINICAL_RESULT_REVIEW_REQUIRED';end if;
   elsif array_position(stages,new_item->>'stage') not in(array_position(stages,old_item->>'stage'),array_position(stages,old_item->>'stage')+1) then
    raise exception using errcode='22023',message='DOCTOR_CLINICAL_RESULT_TRANSITION_INVALID';
   end if;
  end loop;
 end if;
 if p_action not in('release','revoke_release') then
  if p_action<>'create' then encounter.version:=encounter.version+1;end if;
  insert into public.clinical_versions(practice_id,encounter_id,revision,kind,source_version_id,snapshot,snapshot_sha256,reason,actor_user_id,actor_session_id)
   values(p_practice,encounter.id,encounter.version,encounter.status,latest.id,snapshot,encode(sha256(convert_to(snapshot::text,'UTF8')),'hex'),reason,actor,sid) returning * into written;
  if p_action='finalize' then encounter.active_version_id:=written.id;elsif p_action='withdraw' then encounter.active_version_id:=null;end if;
  update public.clinical_encounters set version=encounter.version,status=encounter.status,active_version_id=encounter.active_version_id,updated_at=clock_timestamp() where id=encounter.id;
 else
  written:=latest;
 end if;
 insert into public.clinical_events(practice_id,encounter_id,version_id,action,actor_user_id) values(p_practice,encounter.id,written.id,p_action,actor);
 insert into public.audit_events(practice_id,actor_user_id,event_type,entity_id) values(p_practice,actor,'clinical.'||p_action,encounter.id);
 result:=jsonb_build_object('encounter_id',encounter.id,'version',encounter.version,'version_id',written.id,'status',encounter.status,'release_id',release.id,'data_mode','synthetic','clinical_approval',false,'live_prescribing',false);
 insert into doctor_private.command_receipts(actor_user_id,command_key,request,result) values(actor,p_key,request,result);
 return result;
end $$;
create function doctor_private.clinical_workspace(p_practice uuid,p_location uuid,p_page integer,p_search text) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare actor uuid; rows jsonb; patients jsonb; total bigint; capabilities text[];
begin
 perform doctor_private.current_actor();
 perform pg_advisory_xact_lock_shared(hashtextextended(p_practice::text,1));
 begin actor:=doctor_private.clinical_scope(p_practice,p_location,'read');
 exception when insufficient_privilege then
  return jsonb_build_object('available',false,'data_mode','synthetic','clinical_approval',false,'live_prescribing',false,'rows','[]'::jsonb,'patients','[]'::jsonb,'total',0,'capabilities','[]'::jsonb);
 end;
 if p_page is null or p_page not between 0 and 10000 or p_search is null or length(p_search)>120 then raise exception using errcode='22023',message='DOCTOR_CLINICAL_INVALID';end if;
 select coalesce(array_agg(distinct cap),'{}') into capabilities from doctor_private.clinical_fixture_grants g,unnest(g.capabilities) cap
  where g.practice_id=p_practice and g.location_id=p_location and g.user_id=actor and g.revoked_at is null and g.issued_at<=clock_timestamp() and g.valid_until>clock_timestamp()
   and (cap<>all(array['review','sign','release']) or actor=(select owner_user_id from public.practices where id=p_practice));
 select count(*) into total from public.clinical_encounters e join public.practice_patients p on p.id=e.patient_id and p.practice_id=e.practice_id
  where e.practice_id=p_practice and e.location_id=p_location and position(lower(p_search) in lower(p.display_name))>0;
 select coalesce(jsonb_agg(to_jsonb(r)),'[]') into rows from (
  select e.id,e.patient_id,p.display_name as patient_name,e.status,e.version,e.updated_at,e.location_name,e.timezone
  from public.clinical_encounters e join public.practice_patients p on p.id=e.patient_id and p.practice_id=e.practice_id
  where e.practice_id=p_practice and e.location_id=p_location and position(lower(p_search) in lower(p.display_name))>0
  order by e.updated_at desc,e.id limit 20 offset p_page::bigint*20) r;
 -- Bounded explicit picker, never a full hidden chart dump. Search shares the
 -- same patient name query; no patient account or relationship is created here.
 select coalesce(jsonb_agg(to_jsonb(r)),'[]') into patients from (select id,display_name as name from public.practice_patients
  where practice_id=p_practice and archived_at is null and position(lower(p_search) in lower(display_name))>0 order by display_name,id limit 50) r;
 return jsonb_build_object('available',true,'data_mode','synthetic','clinical_approval',false,'live_prescribing',false,'rows',rows,'patients',patients,'patient_picker_limit',50,'total',total,'capabilities',capabilities);
end $$;
create function doctor_private.clinical_detail(p_practice uuid,p_location uuid,p_encounter uuid,p_page integer) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare encounter public.clinical_encounters; versions jsonb; events jsonb; releases jsonb; recipients jsonb; total bigint; event_total bigint;
begin
 perform pg_advisory_xact_lock_shared(hashtextextended(p_practice::text,1));
 perform doctor_private.clinical_scope(p_practice,p_location,'read');
 if p_page is null or p_page not between 0 and 10000 then raise exception using errcode='22023',message='DOCTOR_CLINICAL_INVALID';end if;
 select * into encounter from public.clinical_encounters where practice_id=p_practice and location_id=p_location and id=p_encounter;
 if not found then raise exception using errcode='42501',message='DOCTOR_CLINICAL_UNAVAILABLE';end if;
 select count(*) into total from public.clinical_versions where encounter_id=encounter.id;
 select coalesce(jsonb_agg(to_jsonb(r)),'[]') into versions from (select id,revision,kind,source_version_id,snapshot,snapshot::text as canonical_snapshot,snapshot_sha256,reason,actor_user_id,happened_at,
  case when id=encounter.active_version_id then 'active' when kind='finalized' then case when encounter.status='withdrawn' then 'withdrawn' else 'superseded' end else 'draft' end as version_status,
  true as synthetic_attestation,false as professional_signature
  from public.clinical_versions where encounter_id=encounter.id order by revision desc limit 20 offset p_page::bigint*20) r;
 select count(*) into event_total from public.clinical_events where encounter_id=encounter.id;
 select coalesce(jsonb_agg(to_jsonb(r)),'[]') into events from (select id,version_id,action,actor_user_id,happened_at from public.clinical_events where encounter_id=encounter.id order by id desc limit 100) r;
 select coalesce(jsonb_agg(to_jsonb(r)),'[]') into releases from (select r.id,r.version_id,r.recipient_user_id,r.released_at,r.expires_at,
  (x.release_id is not null or r.version_id is distinct from encounter.active_version_id or r.expires_at<=clock_timestamp()) as unavailable
  from public.clinical_releases r left join public.clinical_release_revocations x on x.release_id=r.id where r.encounter_id=encounter.id order by r.released_at desc,r.id limit 100) r;
 select coalesce(jsonb_agg(jsonb_build_object('id',g.user_id,'name',p.display_name) order by g.user_id),'[]') into recipients
  from doctor_private.clinical_recipient_grants g join public.practice_patients p on p.practice_id=g.practice_id and p.id=g.patient_id join auth.users u on u.id=g.user_id
  where g.practice_id=p_practice and g.patient_id=encounter.patient_id and g.revoked_at is null and g.valid_until>clock_timestamp()
   and u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false);
 return jsonb_build_object('encounter',to_jsonb(encounter),'versions',versions,'versions_total',total,'events',events,'events_total',event_total,'releases',releases,'recipients',recipients,
  'data_mode','synthetic','clinical_approval',false,'live_prescribing',false);
end $$;
create function public.doctor_clinical_command(p_practice uuid,p_location uuid,p_encounter uuid,p_expected_version integer,p_action text,p_input jsonb,p_key uuid) returns jsonb
language sql volatile security invoker set search_path='' as $$select doctor_private.clinical_command(p_practice,p_location,p_encounter,p_expected_version,p_action,p_input,p_key)$$;
create function public.doctor_clinical_workspace(p_practice uuid,p_location uuid,p_page integer default 0,p_search text default '') returns jsonb
language sql volatile security invoker set search_path='' as $$select doctor_private.clinical_workspace(p_practice,p_location,p_page,p_search)$$;
create function public.doctor_clinical_detail(p_practice uuid,p_location uuid,p_encounter uuid,p_page integer default 0) returns jsonb
language sql volatile security invoker set search_path='' as $$select doctor_private.clinical_detail(p_practice,p_location,p_encounter,p_page)$$;
do $$declare name text;immutable_name text;signature text;
begin
 foreach name in array array['clinical_note_templates','clinical_encounters','clinical_versions','clinical_events','clinical_releases','clinical_release_revocations'] loop
  execute format('alter table public.%I enable row level security',name);
  execute format('alter table public.%I force row level security',name);
  execute format('create policy %I on public.%I for all to postgres using(true) with check(true)',name||'_owner',name);
  execute format('revoke all on public.%I from public,anon,authenticated,service_role',name);
 end loop;
 foreach name in array array['clinical_note_templates','clinical_versions','clinical_events','clinical_releases','clinical_release_revocations'] loop
  immutable_name:=name||'_immutable';
  execute format('create trigger %I before update or delete or truncate on public.%I for each statement execute function doctor_private.clinical_immutable()',immutable_name,name);
 end loop;
 foreach name in array array['clinical_fixture_grants','clinical_recipient_grants'] loop
  execute format('alter table doctor_private.%I enable row level security',name);
  execute format('alter table doctor_private.%I force row level security',name);
  execute format('create policy %I on doctor_private.%I for all to postgres using(true) with check(true)',name||'_owner',name);
  execute format('revoke all on doctor_private.%I from public,anon,authenticated,service_role',name);
 end loop;
 for signature in select p.oid::regprocedure::text from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
  where n.nspname='doctor_private' and p.proname like 'clinical_%' loop
  execute 'revoke all on function '||signature||' from public,anon,authenticated,service_role';
 end loop;
 foreach signature in array array['clinical_command(uuid,uuid,uuid,integer,text,jsonb,uuid)','clinical_workspace(uuid,uuid,integer,text)',
  'clinical_detail(uuid,uuid,uuid,integer)'] loop
  execute 'grant execute on function doctor_private.'||signature||' to authenticated';
  execute 'revoke all on function public.doctor_'||signature||' from public,anon,authenticated,service_role';
  execute 'grant execute on function public.doctor_'||signature||' to authenticated';
 end loop;
end $$;
