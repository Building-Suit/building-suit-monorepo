-- Standalone Company HQ foundation. The historical 20261103194908 migration is
-- retained, unapplied, pending integration review; no retired hq_workspace API
-- is installed or used here. This file does not provision Auth users/sessions.
-- Approval concerns one complete reviewed company plan. Hiring/skill entries
-- are documentary proposals: approving a plan does not execute workforce work.

create schema if not exists hq_private;
revoke all on schema hq_private from public, anon, authenticated, service_role;

create table hq_private.founder_invitations (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  email text not null unique check (email = pg_catalog.lower(pg_catalog.btrim(email))),
  bound_user_id uuid unique,
  bound_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  check ((bound_user_id is null) = (bound_at is null))
);

create table public.hq_founders (
  user_id uuid primary key,
  invitation_id uuid not null unique references hq_private.founder_invitations(id),
  bound_at timestamptz not null default pg_catalog.clock_timestamp(),
  revoked_at timestamptz
);
-- Auth identifiers remain historical references when Auth removes a user.
-- Fresh Auth/session checks below deny removed users; invitations never rebind.

create table public.hq_company_plans (
  id uuid primary key,
  proposal_key text not null unique,
  revision bigint not null check (revision > 0),
  document jsonb not null check (pg_catalog.jsonb_typeof(document) = 'object'),
  status text not null check (status in ('ready', 'approved', 'rejected')),
  legacy boolean not null default false,
  source_evidence jsonb,
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  updated_at timestamptz not null default pg_catalog.clock_timestamp(),
  approved_at timestamptz,
  legacy_approved_on date,
  check (
    (legacy and status = 'approved' and legacy_approved_on is not null and approved_at is null)
    or (not legacy and legacy_approved_on is null and
      ((status = 'approved' and approved_at is not null) or
       (status <> 'approved' and approved_at is null)))
  )
);

create table hq_private.plan_revisions (
  plan_id uuid not null references public.hq_company_plans(id),
  revision bigint not null,
  document jsonb not null,
  recorded_at timestamptz not null default pg_catalog.clock_timestamp(),
  primary key (plan_id, revision)
);

create table public.hq_plan_decisions (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  plan_id uuid not null unique references public.hq_company_plans(id),
  plan_revision bigint not null check (plan_revision > 0),
  decision text not null check (decision in ('approved', 'rejected')),
  actor_user_id uuid not null,
  session_id uuid not null,
  request_key uuid not null,
  document jsonb not null,
  decided_at timestamptz not null default pg_catalog.clock_timestamp(),
  unique (actor_user_id, request_key)
);

create table public.hq_departments (
  id uuid primary key,
  department_key text not null unique,
  name text not null,
  name_ar text,
  plan_id uuid not null references public.hq_company_plans(id),
  approved_at timestamptz,
  legacy_approved_on date,
  check ((approved_at is not null) <> (legacy_approved_on is not null))
);
create unique index hq_departments_name_unique on public.hq_departments(pg_catalog.lower(name));
create unique index hq_departments_name_ar_unique on public.hq_departments(pg_catalog.lower(name_ar)) where name_ar is not null;
create index hq_departments_plan_idx on public.hq_departments(plan_id);
create index hq_company_plans_created_idx on public.hq_company_plans(created_at, id);

alter table hq_private.founder_invitations enable row level security;
alter table hq_private.plan_revisions enable row level security;
alter table public.hq_founders enable row level security;
alter table public.hq_company_plans enable row level security;
alter table public.hq_plan_decisions enable row level security;
alter table public.hq_departments enable row level security;
-- No direct Data API policies/grants: only the guarded RPC projections below.
revoke all on hq_private.founder_invitations, hq_private.plan_revisions,
  public.hq_founders, public.hq_company_plans, public.hq_plan_decisions,
  public.hq_departments from public, anon, authenticated, service_role;

create function hq_private.immutable_record() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  raise exception 'HQ_IMMUTABLE_RECORD' using errcode = '55000';
end;
$$;
create trigger hq_decision_immutable before update or delete on public.hq_plan_decisions
  for each row execute function hq_private.immutable_record();
create trigger hq_revision_immutable before update or delete on hq_private.plan_revisions
  for each row execute function hq_private.immutable_record();
create trigger hq_department_immutable before update or delete on public.hq_departments
  for each row execute function hq_private.immutable_record();

create function hq_private.guard_plan_history() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'HQ_IMMUTABLE_PLAN_HISTORY' using errcode = '55000';
  end if;
  if old.status <> 'ready' or old.legacy or new.legacy is distinct from old.legacy
    or new.id is distinct from old.id or new.proposal_key is distinct from old.proposal_key
    or new.created_at is distinct from old.created_at then
    raise exception 'HQ_PLAN_ALREADY_DECIDED' using errcode = 'PT409';
  end if;
  return new;
end;
$$;
create trigger hq_plan_history_guard before update or delete on public.hq_company_plans
  for each row execute function hq_private.guard_plan_history();

create function hq_private.guard_invitation_binding() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'HQ_INVITATION_HISTORY_REQUIRED' using errcode = '55000';
  end if;
  if old.bound_user_id is not null and
    (new.bound_user_id is distinct from old.bound_user_id or new.email is distinct from old.email
      or new.bound_at is distinct from old.bound_at) then
    raise exception 'HQ_INVITATION_ALREADY_BOUND' using errcode = '55000';
  end if;
  return new;
end;
$$;
create trigger hq_invitation_binding_guard before update or delete on hq_private.founder_invitations
  for each row execute function hq_private.guard_invitation_binding();

create function hq_private.live_auth_uid() returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_session uuid;
begin
  if auth.jwt()->>'role' is distinct from 'authenticated' or v_uid is null then return null; end if;
  begin v_session := (auth.jwt()->>'session_id')::uuid;
  exception when invalid_text_representation then return null; end;
  if v_session is null or not exists (
    select 1 from auth.sessions s join auth.users u on u.id = s.user_id
    where s.id = v_session and s.user_id = v_uid and u.email_confirmed_at is not null
      and u.email is not null and (s.not_after is null or s.not_after > pg_catalog.clock_timestamp())
  ) then return null; end if;
  return v_uid;
end;
$$;

create function hq_private.founder_uid() returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := hq_private.live_auth_uid();
begin
  if v_uid is null or not exists (
    select 1 from public.hq_founders f
    join hq_private.founder_invitations i on i.id = f.invitation_id
    join auth.users u on u.id = f.user_id
    where f.user_id = v_uid and f.revoked_at is null and i.revoked_at is null
      and i.bound_user_id = v_uid and pg_catalog.lower(pg_catalog.btrim(u.email)) = i.email
  ) then return null; end if;
  return v_uid;
end;
$$;

create function hq_private.bind_founder() returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := hq_private.live_auth_uid(); v_email text; v_invite hq_private.founder_invitations;
begin
  if v_uid is null then return false; end if;
  select pg_catalog.lower(pg_catalog.btrim(u.email)) into v_email from auth.users u where u.id = v_uid;
  select i.* into v_invite from hq_private.founder_invitations i
    where i.email = v_email and i.revoked_at is null for update;
  if not found or (v_invite.bound_user_id is not null and v_invite.bound_user_id <> v_uid) then return false; end if;
  -- Recheck after waiting on the invitation lock; metadata never grants authority.
  if hq_private.live_auth_uid() is distinct from v_uid then return false; end if;
  if v_invite.bound_user_id is null then
    update hq_private.founder_invitations set bound_user_id = v_uid, bound_at = pg_catalog.clock_timestamp()
      where id = v_invite.id and bound_user_id is null;
  end if;
  insert into public.hq_founders(user_id, invitation_id) values (v_uid, v_invite.id)
    on conflict (user_id) do nothing;
  return hq_private.founder_uid() is not null;
end;
$$;

create function hq_private.require_shape(p_value jsonb, p_required text[], p_allowed text[]) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if pg_catalog.jsonb_typeof(p_value) is distinct from 'object' then
    raise exception 'HQ_INVALID_DOCUMENT_SHAPE' using errcode = '22023';
  end if;
  if not (p_value ?& p_required) or exists (
    select 1 from pg_catalog.jsonb_object_keys(p_value) as x(key) where not (x.key = any(p_allowed))
  ) then raise exception 'HQ_INVALID_DOCUMENT_SHAPE' using errcode = '22023'; end if;
end;
$$;

create function hq_private.required_text(p_value jsonb, p_max integer) returns text
language plpgsql immutable security invoker set search_path = '' as $$
declare v text;
begin
  if pg_catalog.jsonb_typeof(p_value) is distinct from 'string' then
    raise exception 'HQ_INVALID_TEXT' using errcode = '22023';
  end if;
  v := p_value #>> '{}';
  if pg_catalog.length(pg_catalog.btrim(v)) = 0 or pg_catalog.length(v) > p_max
    or pg_catalog.regexp_replace(v,E'[\t\n\r]','','g') ~ '[[:cntrl:]]' then
    raise exception 'HQ_INVALID_TEXT' using errcode = '22023';
  end if;
  return v;
end;
$$;

create function hq_private.required_uuid(p_value jsonb) returns uuid
language plpgsql immutable security invoker set search_path = '' as $$
declare v text := hq_private.required_text(p_value, 36);
begin
  if v !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
    raise exception 'HQ_INVALID_UUID' using errcode = '22023';
  end if;
  if v::uuid = '00000000-0000-0000-0000-000000000000'::uuid then
    raise exception 'HQ_INVALID_UUID' using errcode = '22023';
  end if;
  return v::uuid;
end;
$$;

create function hq_private.name_key(p_name text) returns text
language sql immutable strict security invoker set search_path = '' as $$
  select pg_catalog.lower(pg_catalog.regexp_replace(
    pg_catalog.btrim(pg_catalog.normalize(p_name,'NFKC')),'[[:space:]]+',' ','g'));
$$;

create function hq_private.normalize_plan(p_document jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  v_id uuid; v_key text; v_item jsonb; v_item_id uuid; v_department uuid;
  v_name text; v_name_ar text; v_employee text; v_reference text; v_summary text;
  v_ids uuid[] := '{}'; v_department_ids uuid[] := '{}';
  v_keys text[] := '{}'; v_names text[] := '{}';
  v_departments jsonb := '[]'; v_hiring jsonb := '[]'; v_skills jsonb := '[]';
  v_reviews jsonb := '{}'; v_array text;
begin
  if p_document is null or pg_catalog.octet_length(p_document::text) > 1048576 then
    raise exception 'HQ_DOCUMENT_TOO_LARGE' using errcode = '22023';
  end if;
  perform hq_private.require_shape(p_document,
    array['id','proposalKey','title','summary','body','departments','hiring','skills','hrReview','ceoReview'],
    array['id','proposalKey','title','summary','body','departments','hiring','skills','hrReview','ceoReview']);
  v_id := hq_private.required_uuid(p_document->'id');
  v_ids := array[v_id];
  v_key := hq_private.required_text(p_document->'proposalKey', 64);
  if v_key !~ '^[a-z][a-z0-9-]{1,63}$' then raise exception 'HQ_INVALID_KEY' using errcode = '22023'; end if;
  foreach v_array in array array['departments','hiring','skills'] loop
    if pg_catalog.jsonb_typeof(p_document->v_array) is distinct from 'array' then
      raise exception 'HQ_INVALID_ARRAY' using errcode = '22023';
    end if;
    if pg_catalog.jsonb_array_length(p_document->v_array) > (case when v_array = 'departments' then 128 else 256 end) then
      raise exception 'HQ_ARRAY_TOO_LARGE' using errcode = '22023';
    end if;
  end loop;
  for v_item in select value from pg_catalog.jsonb_array_elements(p_document->'departments') loop
    perform hq_private.require_shape(v_item, array['id','key','name'], array['id','key','name','nameAr']);
    v_item_id := hq_private.required_uuid(v_item->'id');
    v_name := pg_catalog.btrim(hq_private.required_text(v_item->'name', 200));
    v_reference := hq_private.required_text(v_item->'key', 64);
    v_name_ar := null;
    if v_item ? 'nameAr' and v_item->'nameAr' <> 'null'::jsonb then
      v_name_ar := pg_catalog.btrim(hq_private.required_text(v_item->'nameAr', 200));
    end if;
    if v_reference !~ '^[a-z][a-z0-9-]{1,63}$' or v_item_id = any(v_ids)
      or v_reference = any(v_keys) or hq_private.name_key(v_name) = any(v_names)
      or (v_name_ar is not null and hq_private.name_key(v_name_ar) = any(v_names)) then
      raise exception 'HQ_DUPLICATE_OR_INVALID_DEPARTMENT' using errcode = '22023';
    end if;
    if exists(select 1 from public.hq_departments d where d.id = v_item_id or d.department_key = v_reference
      or hq_private.name_key(d.name) = hq_private.name_key(v_name)
      or hq_private.name_key(d.name_ar) = hq_private.name_key(v_name)
      or (v_name_ar is not null and (hq_private.name_key(d.name) = hq_private.name_key(v_name_ar)
        or hq_private.name_key(d.name_ar) = hq_private.name_key(v_name_ar)))) then
      raise exception 'HQ_DEPARTMENT_ALREADY_EXISTS' using errcode = 'PT409';
    end if;
    v_ids := pg_catalog.array_append(v_ids, v_item_id);
    v_department_ids := pg_catalog.array_append(v_department_ids, v_item_id);
    v_keys := pg_catalog.array_append(v_keys, v_reference);
    v_names := pg_catalog.array_append(v_names, hq_private.name_key(v_name));
    if v_name_ar is not null then v_names := pg_catalog.array_append(v_names, hq_private.name_key(v_name_ar)); end if;
    v_departments := v_departments || pg_catalog.jsonb_build_array(pg_catalog.jsonb_strip_nulls(
      pg_catalog.jsonb_build_object('id',v_item_id,'key',v_reference,'name',v_name,'nameAr',v_name_ar)));
  end loop;
  for v_item in select value from pg_catalog.jsonb_array_elements(p_document->'hiring') loop
    perform hq_private.require_shape(v_item, array['id','role','reason'], array['id','departmentId','role','reason']);
    v_item_id := hq_private.required_uuid(v_item->'id');
    if v_item_id = any(v_ids) then raise exception 'HQ_DUPLICATE_ITEM_ID' using errcode = '22023'; end if;
    v_ids := pg_catalog.array_append(v_ids, v_item_id); v_department := null;
    if v_item ? 'departmentId' and v_item->'departmentId' <> 'null'::jsonb then
      v_department := hq_private.required_uuid(v_item->'departmentId');
      if not (v_department = any(v_department_ids)) and not exists(
        select 1 from public.hq_departments d where d.id = v_department
      ) then raise exception 'HQ_UNKNOWN_HIRING_DEPARTMENT' using errcode = '22023'; end if;
    end if;
    v_hiring := v_hiring || pg_catalog.jsonb_build_array(pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
      'id',v_item_id,'departmentId',v_department,'role',hq_private.required_text(v_item->'role',200),
      'reason',hq_private.required_text(v_item->'reason',4000))));
  end loop;
  for v_item in select value from pg_catalog.jsonb_array_elements(p_document->'skills') loop
    perform hq_private.require_shape(v_item, array['id','employeeId','skill','reason'], array['id','employeeId','skill','reason']);
    v_item_id := hq_private.required_uuid(v_item->'id');
    if v_item_id = any(v_ids) then raise exception 'HQ_DUPLICATE_ITEM_ID' using errcode = '22023'; end if;
    v_ids := pg_catalog.array_append(v_ids, v_item_id);
    v_employee := hq_private.required_text(v_item->'employeeId',80);
    if v_employee !~ '^AG-[A-Z]+-[0-9]{3}$' then raise exception 'HQ_INVALID_EMPLOYEE_ID' using errcode = '22023'; end if;
    -- The trusted publisher checks the actual current Brain roster; a string is
    -- not evidence of an existing/qualified/running employee, nor an execution.
    v_skills := v_skills || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('id',v_item_id,
      'employeeId',v_employee,'skill',hq_private.required_text(v_item->'skill',200),
      'reason',hq_private.required_text(v_item->'reason',4000)));
  end loop;
  foreach v_array in array array['hrReview','ceoReview'] loop
    perform hq_private.require_shape(p_document->v_array,array['reference','summary'],array['reference','summary']);
    v_reference := hq_private.required_text(p_document->v_array->'reference',2000);
    v_summary := hq_private.required_text(p_document->v_array->'summary',4000);
    v_reviews := v_reviews || pg_catalog.jsonb_build_object(v_array,
      pg_catalog.jsonb_build_object('reference',v_reference,'summary',v_summary));
  end loop;
  return pg_catalog.jsonb_build_object('id',v_id,'proposalKey',v_key,
    'title',hq_private.required_text(p_document->'title',200),
    'summary',hq_private.required_text(p_document->'summary',2000),
    'body',hq_private.required_text(p_document->'body',16000),
    'departments',v_departments,'hiring',v_hiring,'skills',v_skills) || v_reviews;
end;
$$;

-- Internal projection has no caller grant; only guarded owner-executing entry
-- points invoke it. Publication validates renderable capacity before committing.
create function hq_private.company_payload() returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare v_plans jsonb; v_departments jsonb; v_snapshot jsonb;
begin
  if (select pg_catalog.count(*) from public.hq_company_plans) > 128
    or (select pg_catalog.count(*) from public.hq_departments) > 128 then
    raise exception 'HQ_SNAPSHOT_CAPACITY_EXCEEDED' using errcode = '54000';
  end if;
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'id',p.id,'title',p.document->>'title','summary',p.document->>'summary','body',p.document->>'body',
    'status',p.status,'revision',p.revision,'departments',p.document->'departments',
    'hiring',p.document->'hiring','skills',p.document->'skills',
    'hrReview',p.document->'hrReview','ceoReview',p.document->'ceoReview',
    'createdAt',p.created_at,'approvedAt',coalesce(pg_catalog.to_jsonb(p.approved_at),pg_catalog.to_jsonb(p.legacy_approved_on)),
    'legacy',p.legacy) order by p.created_at desc,p.id), '[]'::jsonb)
    into v_plans from public.hq_company_plans p;
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
    'id',d.id,'name',d.name,'nameAr',d.name_ar,
    'approvedAt',coalesce(pg_catalog.to_jsonb(d.approved_at),pg_catalog.to_jsonb(d.legacy_approved_on)))
  ) order by d.department_key,d.id),'[]'::jsonb) into v_departments from public.hq_departments d;
  v_snapshot := pg_catalog.jsonb_build_object('plans',v_plans,'departments',v_departments);
  if pg_catalog.octet_length(v_snapshot::text) > 524288 then
    raise exception 'HQ_SNAPSHOT_CAPACITY_EXCEEDED' using errcode = '54000';
  end if;
  return v_snapshot;
end;
$$;

create function hq_private.company_snapshot() returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if hq_private.founder_uid() is null then raise exception 'HQ_FOUNDER_REQUIRED' using errcode = '42501'; end if;
  return hq_private.company_payload();
end;
$$;

create function hq_private.publish_company_plan(p_document jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_document jsonb; v_plan public.hq_company_plans; v_id uuid; v_revision bigint;
begin
  if coalesce(nullif(pg_catalog.current_setting('request.jwt.claim.role',true),''),auth.jwt()->>'role')
    is distinct from 'service_role' then raise exception 'HQ_PUBLISHER_REQUIRED' using errcode = '42501'; end if;
  -- A service-role operator must supply actual reviewed artifacts. Nonempty
  -- references are structurally required; this RPC does not invent/execute HR
  -- or CEO review, approve a plan, hire staff, or upgrade any employee's skills.
  perform pg_catalog.pg_advisory_xact_lock(21128,1);
  v_document := hq_private.normalize_plan(p_document); v_id := (v_document->>'id')::uuid;
  select p.* into v_plan from public.hq_company_plans p where p.id = v_id for update;
  if found then
    if v_plan.status <> 'ready' or v_plan.legacy then raise exception 'HQ_PLAN_ALREADY_DECIDED' using errcode = 'PT409'; end if;
    if v_plan.proposal_key <> v_document->>'proposalKey' then raise exception 'HQ_PLAN_IDENTITY_CHANGED' using errcode = 'PT409'; end if;
    if v_plan.document = v_document then
      return pg_catalog.jsonb_build_object('id',v_plan.id,'revision',v_plan.revision,'status',v_plan.status);
    end if;
    v_revision := v_plan.revision + 1;
    update public.hq_company_plans set document = v_document, revision = v_revision, updated_at = pg_catalog.clock_timestamp()
      where id = v_id and status = 'ready';
  else
    if (select pg_catalog.count(*) from public.hq_company_plans) >= 128 then
      raise exception 'HQ_PLAN_CAPACITY_EXCEEDED' using errcode = '54000';
    end if;
    v_revision := 1;
    insert into public.hq_company_plans(id,proposal_key,revision,document,status)
      values(v_id,v_document->>'proposalKey',v_revision,v_document,'ready');
  end if;
  insert into hq_private.plan_revisions(plan_id,revision,document) values(v_id,v_revision,v_document);
  perform hq_private.company_payload();
  return pg_catalog.jsonb_build_object('id',v_id,'revision',v_revision,'status','ready');
end;
$$;

create function hq_private.decide_company_plan(p_plan_id uuid,p_revision bigint,p_decision text,p_request_key uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid; v_session uuid; v_plan public.hq_company_plans; v_previous public.hq_plan_decisions;
  v_status text; v_now timestamptz; v_item jsonb;
begin
  if p_plan_id is null or p_request_key is null or p_revision is null or p_revision < 1
    or p_decision is null or p_decision not in ('approved','rejected') then
    raise exception 'HQ_INVALID_DECISION' using errcode = '22023';
  end if;
  if hq_private.founder_uid() is null then raise exception 'HQ_FOUNDER_REQUIRED' using errcode = '42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(21128,1);
  v_uid := hq_private.founder_uid();
  if v_uid is null then raise exception 'HQ_FOUNDER_REQUIRED' using errcode = '42501'; end if;
  v_session := (auth.jwt()->>'session_id')::uuid;
  v_status := p_decision;
  select d.* into v_previous from public.hq_plan_decisions d
    where d.actor_user_id = v_uid and d.request_key = p_request_key;
  if found then
    if v_previous.plan_id <> p_plan_id or v_previous.plan_revision <> p_revision or v_previous.decision <> v_status then
      raise exception 'HQ_REQUEST_KEY_REUSED' using errcode = 'PT409';
    end if;
    return hq_private.company_snapshot();
  end if;
  select p.* into v_plan from public.hq_company_plans p where p.id = p_plan_id for update;
  if not found then raise exception 'HQ_PLAN_NOT_FOUND' using errcode = 'P0002'; end if;
  if hq_private.founder_uid() is distinct from v_uid then raise exception 'HQ_FOUNDER_REQUIRED' using errcode = '42501'; end if;
  if v_plan.status <> 'ready' or v_plan.legacy then raise exception 'HQ_PLAN_ALREADY_DECIDED' using errcode = 'PT409'; end if;
  if v_plan.revision <> p_revision then raise exception 'HQ_PLAN_REVISION_CHANGED' using errcode = 'PT409'; end if;
  -- Revalidate an approval after the lock. A proposal whose departments now
  -- conflict can still be rejected; it can never be partially approved.
  if v_status = 'approved' then
    perform hq_private.normalize_plan(v_plan.document);
    if (select pg_catalog.count(*) from public.hq_departments) + pg_catalog.jsonb_array_length(v_plan.document->'departments') > 128 then
      raise exception 'HQ_DEPARTMENT_CAPACITY_EXCEEDED' using errcode = '54000';
    end if;
  end if;
  v_now := pg_catalog.clock_timestamp();
  insert into public.hq_plan_decisions(plan_id,plan_revision,decision,actor_user_id,session_id,request_key,document,decided_at)
    values(v_plan.id,v_plan.revision,v_status,v_uid,v_session,p_request_key,v_plan.document,v_now);
  update public.hq_company_plans set status = v_status, approved_at = case when v_status = 'approved' then v_now else null end,
    updated_at = v_now where id = v_plan.id and status = 'ready' and revision = p_revision;
  if v_status = 'approved' then
    for v_item in select value from pg_catalog.jsonb_array_elements(v_plan.document->'departments')
      order by value->>'key',value->>'id' loop
      insert into public.hq_departments(id,department_key,name,name_ar,plan_id,approved_at)
        values((v_item->>'id')::uuid,v_item->>'key',v_item->>'name',v_item->>'nameAr',v_plan.id,v_now);
    end loop;
  end if;
  return hq_private.company_snapshot();
end;
$$;

-- Exposed RPCs are invokers. The unexposed definers enforce their own trusted
-- actor/session checks; grants permit only these exact entry points.
create function public.hq_founder_access() returns jsonb
language sql security invoker set search_path = '' as $$
  select pg_catalog.jsonb_build_object('isFounder',hq_private.bind_founder());
$$;
create function public.hq_company_snapshot() returns jsonb
language sql security invoker set search_path = '' as $$ select hq_private.company_snapshot(); $$;
create function public.hq_decide_company_plan(p_plan_id uuid,p_revision bigint,p_decision text,p_request_key uuid) returns jsonb
language sql security invoker set search_path = '' as $$
  select hq_private.decide_company_plan(p_plan_id,p_revision,p_decision,p_request_key);
$$;
create function public.hq_publish_company_plan(p_document jsonb) returns jsonb
language sql security invoker set search_path = '' as $$ select hq_private.publish_company_plan(p_document); $$;

revoke all on all functions in schema hq_private from public, anon, authenticated, service_role;
revoke all on function public.hq_founder_access(),public.hq_company_snapshot(),
  public.hq_decide_company_plan(uuid,bigint,text,uuid),public.hq_publish_company_plan(jsonb)
  from public,anon,authenticated,service_role;
grant usage on schema hq_private to authenticated,service_role;
grant execute on function hq_private.bind_founder(),hq_private.company_snapshot(),
  hq_private.decide_company_plan(uuid,bigint,text,uuid) to authenticated;
grant execute on function hq_private.publish_company_plan(jsonb) to service_role;
grant execute on function public.hq_founder_access(),public.hq_company_snapshot(),
  public.hq_decide_company_plan(uuid,bigint,text,uuid) to authenticated;
grant execute on function public.hq_publish_company_plan(jsonb) to service_role;

-- Trusted, single-use invitation: never derived from user_metadata or an email
-- supplied to an RPC. Binding additionally needs confirmed auth.users email and
-- a current matching auth.sessions row. No Auth user is fabricated here.
insert into hq_private.founder_invitations(email) values('ceo@building-suit.com');

-- Narrow historical import only: no invented Auth approver UUID, review event,
-- approval timestamp, employee, or additional department. IDs below are stable
-- migration record IDs derived from source identity, not historical event IDs.
insert into public.hq_company_plans(id,proposal_key,revision,document,status,legacy,legacy_approved_on,source_evidence)
values (
  pg_catalog.md5('hq-legacy-plan:CONV-2026-11-03-007')::uuid,'legacy-hr-initial-2026-11-03',1,
  pg_catalog.jsonb_build_object(
    'title','Initial HR & Agent Development setup',
    'summary','Legacy founder-approved initial HR setup, imported from the maintained Brain.',
    'body','Founder approval recorded on 2026-11-03 under CONV-2026-11-03-007. Date precision only; no original host message ID or Auth approver is asserted. Sources: https://drive.google.com/file/d/1q_wh04uG057bdxoS0C9R47gnUvIV2cRq/view and https://drive.google.com/file/d/1tRzGxRcZZ5IYTD1baa-mWKznrQokI1sq/view. This import configures the existing HR department, not staff execution.',
    'departments',pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'id',pg_catalog.md5('hq-department-source:drive:1tRzGxRcZZ5IYTD1baa-mWKznrQokI1sq')::uuid,
      'key','hr-agent-development','name','HR & Agent Development','nameAr','الموارد البشرية وتطوير الوكلاء')),
    'hiring','[]'::jsonb,'skills','[]'::jsonb,'hrReview',null,'ceoReview',null),
  'approved',true,'2026-11-03'::date,
  pg_catalog.jsonb_build_object('decisionSourceId','CONV-2026-11-03-007',
    'decisionSourceFileId','1q_wh04uG057bdxoS0C9R47gnUvIV2cRq','charterFileId','1tRzGxRcZZ5IYTD1baa-mWKznrQokI1sq',
    'approvalDate','2026-11-03','timePrecision','date','generatedMigrationSource','20261104192502')
);
insert into hq_private.plan_revisions(plan_id,revision,document)
  select p.id,p.revision,p.document from public.hq_company_plans p where p.proposal_key = 'legacy-hr-initial-2026-11-03';
insert into public.hq_departments(id,department_key,name,name_ar,plan_id,legacy_approved_on)
values(pg_catalog.md5('hq-department-source:drive:1tRzGxRcZZ5IYTD1baa-mWKznrQokI1sq')::uuid,
  'hr-agent-development','HR & Agent Development','الموارد البشرية وتطوير الوكلاء',
  pg_catalog.md5('hq-legacy-plan:CONV-2026-11-03-007')::uuid,'2026-11-03'::date);
