-- LS-MIG-001 / MIG-01..04: evidence-preserving migration staging.
--
-- This domain deliberately stops before accounting. Source upload, mapping and
-- validation never invoke the shared posting engine. The existing Opening Trial Balance
-- batch remains the only GL cutover boundary and may only be linked here.

create type public.migration_source_type as enum (
  'excel_csv', 'other_system_export', 'accountant_paper_workbook'
);
create type public.migration_depth as enum (
  'fast_cutover', 'current_fiscal_year', 'full_history'
);
create type public.migration_project_status as enum (
  'draft', 'source_uploaded', 'mapping', 'validated'
);
create type public.migration_mapping_source_kind as enum (
  'account', 'customer', 'supplier', 'other_counterparty'
);
create type public.migration_mapping_resolution as enum (
  'existing_record', 'reviewed_creation'
);

create table public.migration_projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 1 and 160),
  source_type public.migration_source_type not null,
  cutover_date date not null,
  migration_depth public.migration_depth not null default 'fast_cutover',
  status public.migration_project_status not null default 'draft',
  revision integer not null default 1 check (revision > 0),
  idempotency_key text not null check (char_length(btrim(idempotency_key)) between 1 and 160),
  current_source_revision_id uuid,
  current_mapping_revision_id uuid,
  current_staging_batch_id uuid,
  opening_balance_batch_id uuid,
  validation_result jsonb,
  validated_by uuid references public.profiles(id) on delete restrict,
  validated_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint migration_project_id_org_unique unique(id, organization_id),
  constraint migration_project_idempotency_unique unique(organization_id, idempotency_key),
  constraint migration_project_cutover_finite check (isfinite(cutover_date)),
  constraint migration_project_validation_state check (
    (status = 'validated' and validation_result is not null and validated_by is not null and validated_at is not null)
    or (status <> 'validated' and validated_by is null and validated_at is null)
  ),
  constraint migration_project_opening_batch_same_org
    foreign key (opening_balance_batch_id, organization_id)
    references public.opening_balance_batches(id, organization_id) on delete restrict
);

create table public.migration_source_revisions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  revision integer not null check (revision > 0),
  filename text not null check (char_length(btrim(filename)) between 1 and 255),
  media_type text not null check (char_length(btrim(media_type)) between 1 and 160),
  content_sha256 text not null check (content_sha256 ~ '^[0-9a-f]{64}$'),
  rows_sha256 text not null check (rows_sha256 ~ '^[0-9a-f]{64}$'),
  content_bytes bytea not null check (octet_length(content_bytes) between 1 and 10485760),
  source_identity jsonb not null check (jsonb_typeof(source_identity) = 'object'),
  idempotency_key text not null check (char_length(btrim(idempotency_key)) between 1 and 160),
  uploaded_by uuid not null references public.profiles(id) on delete restrict,
  uploaded_at timestamptz not null default now(),
  constraint migration_source_project_same_org
    foreign key (project_id, organization_id)
    references public.migration_projects(id, organization_id) on delete restrict,
  unique(project_id, revision),
  unique(project_id, content_sha256),
  unique(project_id, idempotency_key),
  constraint migration_source_id_project_org_unique unique(id, project_id, organization_id)
);

create table public.migration_original_rows (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  source_revision_id uuid not null,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  source_row integer not null check (source_row > 0),
  source_sheet text,
  raw_payload jsonb not null check (jsonb_typeof(raw_payload) = 'object'),
  row_sha256 text not null check (row_sha256 ~ '^[0-9a-f]{64}$'),
  captured_at timestamptz not null default now(),
  constraint migration_original_source_same_scope
    foreign key (source_revision_id, project_id, organization_id)
    references public.migration_source_revisions(id, project_id, organization_id) on delete restrict,
  unique(source_revision_id, source_row),
  constraint migration_original_id_source_project_org_unique
    unique(id, source_revision_id, project_id, organization_id)
);

create table public.migration_mapping_revisions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  source_revision_id uuid not null,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  revision integer not null check (revision > 0),
  mapping_sha256 text not null check (mapping_sha256 ~ '^[0-9a-f]{64}$'),
  idempotency_key text not null check (char_length(btrim(idempotency_key)) between 1 and 160),
  review_note text not null check (char_length(btrim(review_note)) between 8 and 1000),
  reviewed_by uuid not null references public.profiles(id) on delete restrict,
  reviewed_at timestamptz not null default now(),
  constraint migration_mapping_source_same_scope
    foreign key (source_revision_id, project_id, organization_id)
    references public.migration_source_revisions(id, project_id, organization_id) on delete restrict,
  unique(project_id, revision),
  unique(project_id, idempotency_key),
  constraint migration_mapping_id_source_project_org_unique
    unique(id, source_revision_id, project_id, organization_id)
);

create table public.migration_mapping_entries (
  id uuid primary key default gen_random_uuid(),
  mapping_revision_id uuid not null,
  source_revision_id uuid not null,
  project_id uuid not null,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  source_kind public.migration_mapping_source_kind not null,
  source_key text not null check (char_length(btrim(source_key)) between 1 and 255),
  source_identity jsonb not null check (jsonb_typeof(source_identity) = 'object'),
  resolution public.migration_mapping_resolution not null,
  target_account_id uuid,
  target_counterparty_id uuid,
  proposed_record jsonb,
  approval_evidence jsonb not null check (jsonb_typeof(approval_evidence) = 'object'),
  constraint migration_mapping_entry_revision_same_scope
    foreign key (mapping_revision_id, source_revision_id, project_id, organization_id)
    references public.migration_mapping_revisions(id, source_revision_id, project_id, organization_id) on delete restrict,
  constraint migration_mapping_target_account_same_org
    foreign key (target_account_id, organization_id)
    references public.accounts(id, organization_id) on delete restrict,
  constraint migration_mapping_target_counterparty_same_org
    foreign key (target_counterparty_id, organization_id)
    references public.counterparties(id, organization_id) on delete restrict,
  constraint migration_mapping_resolution_shape check (
    (resolution = 'existing_record' and proposed_record is null and
      ((source_kind = 'account' and target_account_id is not null and target_counterparty_id is null)
       or (source_kind <> 'account' and target_account_id is null and target_counterparty_id is not null)))
    or
    (resolution = 'reviewed_creation' and target_account_id is null and target_counterparty_id is null
      and proposed_record is not null and jsonb_typeof(proposed_record) = 'object')
  ),
  unique(mapping_revision_id, source_kind, source_key),
  constraint migration_mapping_entry_id_revision_unique unique(id, mapping_revision_id)
);

create table public.migration_staging_batches (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  source_revision_id uuid not null,
  mapping_revision_id uuid not null,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  revision integer not null check (revision > 0),
  rows_sha256 text not null check (rows_sha256 ~ '^[0-9a-f]{64}$'),
  idempotency_key text not null check (char_length(btrim(idempotency_key)) between 1 and 160),
  staged_by uuid not null references public.profiles(id) on delete restrict,
  staged_at timestamptz not null default now(),
  constraint migration_staging_source_same_scope
    foreign key (source_revision_id, project_id, organization_id)
    references public.migration_source_revisions(id, project_id, organization_id) on delete restrict,
  constraint migration_staging_mapping_same_scope
    foreign key (mapping_revision_id, source_revision_id, project_id, organization_id)
    references public.migration_mapping_revisions(id, source_revision_id, project_id, organization_id) on delete restrict,
  unique(project_id, revision),
  unique(project_id, idempotency_key),
  constraint migration_staging_id_source_mapping_project_org_unique
    unique(id, source_revision_id, mapping_revision_id, project_id, organization_id)
);

create table public.migration_normalized_rows (
  id uuid primary key default gen_random_uuid(),
  staging_batch_id uuid not null,
  project_id uuid not null,
  source_revision_id uuid not null,
  mapping_revision_id uuid not null,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  original_row_id uuid not null,
  source_row integer not null check (source_row > 0),
  source_kind public.migration_mapping_source_kind not null,
  source_key text not null check (char_length(btrim(source_key)) between 1 and 255),
  mapping_entry_id uuid,
  normalized_payload jsonb not null check (jsonb_typeof(normalized_payload) = 'object'),
  validation_errors jsonb not null default '[]'::jsonb check (jsonb_typeof(validation_errors) = 'array'),
  constraint migration_normalized_batch_same_scope
    foreign key (staging_batch_id, source_revision_id, mapping_revision_id, project_id, organization_id)
    references public.migration_staging_batches(id, source_revision_id, mapping_revision_id, project_id, organization_id) on delete restrict,
  constraint migration_normalized_original_same_scope
    foreign key (original_row_id, source_revision_id, project_id, organization_id)
    references public.migration_original_rows(id, source_revision_id, project_id, organization_id) on delete restrict,
  constraint migration_normalized_mapping_entry_revision
    foreign key (mapping_entry_id, mapping_revision_id)
    references public.migration_mapping_entries(id, mapping_revision_id) on delete restrict,
  unique(staging_batch_id, source_row)
);

create table public.migration_validation_runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  staging_batch_id uuid not null,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  project_revision integer not null check (project_revision > 0),
  result jsonb not null check (jsonb_typeof(result) = 'object'),
  validated_by uuid not null references public.profiles(id) on delete restrict,
  validated_at timestamptz not null default now(),
  constraint migration_validation_project_same_org
    foreign key (project_id, organization_id)
    references public.migration_projects(id, organization_id) on delete restrict,
  foreign key (staging_batch_id) references public.migration_staging_batches(id) on delete restrict
);

alter table public.migration_projects
  add constraint migration_project_current_source_fk foreign key (current_source_revision_id, id, organization_id)
    references public.migration_source_revisions(id, project_id, organization_id) on delete restrict,
  add constraint migration_project_current_mapping_fk foreign key (current_mapping_revision_id, current_source_revision_id, id, organization_id)
    references public.migration_mapping_revisions(id, source_revision_id, project_id, organization_id) on delete restrict,
  add constraint migration_project_current_staging_fk foreign key (current_staging_batch_id, current_source_revision_id, current_mapping_revision_id, id, organization_id)
    references public.migration_staging_batches(id, source_revision_id, mapping_revision_id, project_id, organization_id) on delete restrict;

create index migration_projects_history_idx on public.migration_projects(organization_id, updated_at desc);
create index migration_source_history_idx on public.migration_source_revisions(project_id, revision desc);
create index migration_original_rows_source_idx on public.migration_original_rows(source_revision_id, source_row);
create index migration_mapping_history_idx on public.migration_mapping_revisions(project_id, revision desc);
create index migration_normalized_rows_batch_idx on public.migration_normalized_rows(staging_batch_id, source_row);
create index migration_validation_history_idx on public.migration_validation_runs(project_id, validated_at desc);

comment on table public.migration_projects is
  'Resumable, tenant-scoped cutover staging. Fast Cutover is the default; this table never posts accounting.';
comment on table public.migration_source_revisions is
  'Private immutable original file evidence with server-verified SHA-256 and source identity.';
comment on table public.migration_original_rows is
  'Immutable rows exactly as extracted from a source revision, before normalization or mapping.';
comment on table public.migration_normalized_rows is
  'Append-only normalized staging, kept separate from immutable original rows and the ledger.';
comment on column public.migration_projects.opening_balance_batch_id is
  'Optional link to the existing Opening Trial Balance workflow, the only authorized GL cutover effect.';

insert into public.capabilities(key, domain, description) values
  ('migrations.read', 'migrations', 'Read migration projects, private evidence, mappings, and validation history'),
  ('migrations.manage', 'migrations', 'Create projects and stage source evidence without ledger effects'),
  ('migrations.review', 'migrations', 'Review explicit mappings, creation proposals, and cutover validation')
on conflict (key) do nothing;

insert into public.role_capabilities(role, capability_key)
select role, capability from (values
  ('owner'::public.organization_role, 'migrations.read'),
  ('owner'::public.organization_role, 'migrations.manage'),
  ('owner'::public.organization_role, 'migrations.review'),
  ('admin'::public.organization_role, 'migrations.read'),
  ('admin'::public.organization_role, 'migrations.manage'),
  ('admin'::public.organization_role, 'migrations.review'),
  ('accountant'::public.organization_role, 'migrations.read'),
  ('accountant'::public.organization_role, 'migrations.manage'),
  ('accountant'::public.organization_role, 'migrations.review')
) defaults(role, capability) on conflict do nothing;

alter table public.migration_projects enable row level security;
alter table public.migration_source_revisions enable row level security;
alter table public.migration_original_rows enable row level security;
alter table public.migration_mapping_revisions enable row level security;
alter table public.migration_mapping_entries enable row level security;
alter table public.migration_staging_batches enable row level security;
alter table public.migration_normalized_rows enable row level security;
alter table public.migration_validation_runs enable row level security;

create policy "migration projects visible to authorized members" on public.migration_projects
  for select to authenticated using (app.has_capability(organization_id, 'migrations.read'));
create policy "migration source evidence visible to authorized members" on public.migration_source_revisions
  for select to authenticated using (app.has_capability(organization_id, 'migrations.read'));
create policy "migration original rows visible to authorized members" on public.migration_original_rows
  for select to authenticated using (app.has_capability(organization_id, 'migrations.read'));
create policy "migration mapping revisions visible to authorized members" on public.migration_mapping_revisions
  for select to authenticated using (app.has_capability(organization_id, 'migrations.read'));
create policy "migration mapping entries visible to authorized members" on public.migration_mapping_entries
  for select to authenticated using (app.has_capability(organization_id, 'migrations.read'));
create policy "migration staging batches visible to authorized members" on public.migration_staging_batches
  for select to authenticated using (app.has_capability(organization_id, 'migrations.read'));
create policy "migration normalized rows visible to authorized members" on public.migration_normalized_rows
  for select to authenticated using (app.has_capability(organization_id, 'migrations.read'));
create policy "migration validation history visible to authorized members" on public.migration_validation_runs
  for select to authenticated using (app.has_capability(organization_id, 'migrations.read'));

grant select on public.migration_projects, public.migration_source_revisions,
  public.migration_original_rows, public.migration_mapping_revisions,
  public.migration_mapping_entries, public.migration_staging_batches,
  public.migration_normalized_rows, public.migration_validation_runs to authenticated;

create or replace function app.reject_migration_evidence_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  raise exception 'MIGRATION_EVIDENCE_IMMUTABLE: append a new revision' using errcode = '55000';
end;
$$;

create trigger migration_source_revisions_immutable before update or delete on public.migration_source_revisions
  for each row execute function app.reject_migration_evidence_change();
create trigger migration_original_rows_immutable before update or delete on public.migration_original_rows
  for each row execute function app.reject_migration_evidence_change();
create trigger migration_mapping_revisions_immutable before update or delete on public.migration_mapping_revisions
  for each row execute function app.reject_migration_evidence_change();
create trigger migration_mapping_entries_immutable before update or delete on public.migration_mapping_entries
  for each row execute function app.reject_migration_evidence_change();
create trigger migration_staging_batches_immutable before update or delete on public.migration_staging_batches
  for each row execute function app.reject_migration_evidence_change();
create trigger migration_normalized_rows_immutable before update or delete on public.migration_normalized_rows
  for each row execute function app.reject_migration_evidence_change();
create trigger migration_validation_runs_immutable before update or delete on public.migration_validation_runs
  for each row execute function app.reject_migration_evidence_change();

create or replace function public.create_migration_project(
  p_organization_id uuid,
  p_name text,
  p_source_type public.migration_source_type,
  p_cutover_date date,
  p_idempotency_key text,
  p_migration_depth public.migration_depth default 'fast_cutover'
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_existing public.migration_projects%rowtype; v_id uuid;
begin
  perform app.require_capability(p_organization_id, 'migrations.manage');
  if nullif(btrim(p_name), '') is null or char_length(btrim(p_name)) > 160
     or p_cutover_date is null or not isfinite(p_cutover_date)
     or nullif(btrim(p_idempotency_key), '') is null then
    raise exception 'MIGRATION_PROJECT_INVALID' using errcode = '22023';
  end if;
  select * into v_existing from public.migration_projects
    where organization_id = p_organization_id and idempotency_key = btrim(p_idempotency_key);
  if found then
    if v_existing.name <> btrim(p_name) or v_existing.source_type <> p_source_type
       or v_existing.cutover_date <> p_cutover_date or v_existing.migration_depth <> p_migration_depth then
      raise exception 'MIGRATION_IDEMPOTENCY_CONFLICT' using errcode = '23505';
    end if;
    return v_existing.id;
  end if;
  insert into public.migration_projects(
    organization_id, name, source_type, cutover_date, migration_depth,
    idempotency_key, created_by, updated_by
  ) values (
    p_organization_id, btrim(p_name), p_source_type, p_cutover_date, p_migration_depth,
    btrim(p_idempotency_key), auth.uid(), auth.uid()
  ) returning id into v_id;
  perform app.write_audit(p_organization_id, 'migration_project.created', 'migration_project', v_id,
    null, jsonb_build_object('source_type', p_source_type, 'cutover_date', p_cutover_date,
      'migration_depth', p_migration_depth));
  return v_id;
end;
$$;

create or replace function public.upload_migration_source(
  p_project_id uuid,
  p_filename text,
  p_media_type text,
  p_content bytea,
  p_declared_sha256 text,
  p_source_identity jsonb,
  p_rows jsonb,
  p_idempotency_key text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_project public.migration_projects%rowtype; v_existing public.migration_source_revisions%rowtype;
  v_id uuid; v_hash text; v_rows_hash text; v_revision integer; v_item record; v_row integer; v_payload jsonb;
begin
  select * into v_project from public.migration_projects where id = p_project_id for update;
  if not found then raise exception 'TENANT_ACCESS_DENIED: migration project not found' using errcode = '42501'; end if;
  perform app.require_capability(v_project.organization_id, 'migrations.manage');
  if nullif(btrim(p_filename), '') is null or char_length(btrim(p_filename)) > 255
     or lower(p_filename) !~ '[.](csv|xlsx|xls)$'
     or nullif(btrim(p_media_type), '') is null
     or p_content is null or octet_length(p_content) not between 1 and 10485760
     or p_source_identity is null or jsonb_typeof(p_source_identity) <> 'object'
     or p_rows is null or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) not between 1 and 50000
     or nullif(btrim(p_idempotency_key), '') is null then
    raise exception 'MIGRATION_SOURCE_INVALID' using errcode = '22023';
  end if;
  v_hash := encode(extensions.digest(p_content, 'sha256'), 'hex');
  v_rows_hash := encode(extensions.digest(convert_to(p_rows::text, 'UTF8'), 'sha256'), 'hex');
  if lower(coalesce(p_declared_sha256, '')) <> v_hash then
    raise exception 'MIGRATION_SOURCE_HASH_MISMATCH' using errcode = '22023';
  end if;
  select * into v_existing from public.migration_source_revisions
    where project_id = p_project_id and idempotency_key = btrim(p_idempotency_key);
  if found then
    if v_existing.content_sha256 <> v_hash or v_existing.rows_sha256 <> v_rows_hash
       or v_existing.filename <> btrim(p_filename)
       or v_existing.source_identity <> p_source_identity then
      raise exception 'MIGRATION_IDEMPOTENCY_CONFLICT' using errcode = '23505';
    end if;
    return v_existing.id;
  end if;
  select * into v_existing from public.migration_source_revisions
    where project_id = p_project_id and content_sha256 = v_hash;
  if found then
    if v_existing.filename <> btrim(p_filename) or v_existing.media_type <> btrim(p_media_type)
       or v_existing.source_identity <> p_source_identity or v_existing.rows_sha256 <> v_rows_hash then
      raise exception 'MIGRATION_DUPLICATE_SOURCE_CONFLICT' using errcode = '23505';
    end if;
    return v_existing.id;
  end if;
  select coalesce(max(revision), 0) + 1 into v_revision
    from public.migration_source_revisions where project_id = p_project_id;
  insert into public.migration_source_revisions(
    project_id, organization_id, revision, filename, media_type, content_sha256, rows_sha256,
    content_bytes, source_identity, idempotency_key, uploaded_by
  ) values (
    p_project_id, v_project.organization_id, v_revision, btrim(p_filename), btrim(p_media_type),
    v_hash, v_rows_hash, p_content, p_source_identity, btrim(p_idempotency_key), auth.uid()
  ) returning id into v_id;
  for v_item in select value, ordinality from jsonb_array_elements(p_rows) with ordinality loop
    v_payload := v_item.value;
    if jsonb_typeof(v_payload) <> 'object' then raise exception 'MIGRATION_SOURCE_ROW_INVALID' using errcode = '22023'; end if;
    begin v_row := coalesce((v_payload->>'source_row')::integer, v_item.ordinality::integer);
    exception when others then raise exception 'MIGRATION_SOURCE_ROW_INVALID' using errcode = '22023'; end;
    insert into public.migration_original_rows(
      project_id, source_revision_id, organization_id, source_row, source_sheet, raw_payload, row_sha256
    ) values (
      p_project_id, v_id, v_project.organization_id, v_row,
      nullif(btrim(v_payload->>'source_sheet'), ''), v_payload,
      encode(extensions.digest(convert_to(v_payload::text, 'UTF8'), 'sha256'), 'hex')
    );
  end loop;
  update public.migration_projects set current_source_revision_id = v_id,
    current_mapping_revision_id = null, current_staging_batch_id = null,
    status = 'source_uploaded', revision = revision + 1, validation_result = null,
    validated_by = null, validated_at = null, updated_by = auth.uid(), updated_at = now()
    where id = p_project_id;
  perform app.write_audit(v_project.organization_id, 'migration_source.uploaded', 'migration_source_revision', v_id,
    null, jsonb_build_object('project_id', p_project_id, 'revision', v_revision,
      'filename', btrim(p_filename), 'content_sha256', v_hash, 'row_count', jsonb_array_length(p_rows)));
  return v_id;
end;
$$;

create or replace function public.create_migration_mapping_revision(
  p_project_id uuid,
  p_source_revision_id uuid,
  p_mappings jsonb,
  p_review_note text,
  p_idempotency_key text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_project public.migration_projects%rowtype; v_existing public.migration_mapping_revisions%rowtype;
  v_id uuid; v_revision integer; v_hash text; v_item jsonb; v_kind public.migration_mapping_source_kind;
  v_resolution public.migration_mapping_resolution; v_source_key text; v_account uuid; v_counterparty uuid;
  v_account_row public.accounts%rowtype; v_counterparty_row public.counterparties%rowtype; v_proposed jsonb;
begin
  select * into v_project from public.migration_projects where id = p_project_id for update;
  if not found then raise exception 'TENANT_ACCESS_DENIED: migration project not found' using errcode = '42501'; end if;
  perform app.require_capability(v_project.organization_id, 'migrations.review');
  if p_source_revision_id is distinct from v_project.current_source_revision_id
     or p_mappings is null or jsonb_typeof(p_mappings) <> 'array' or jsonb_array_length(p_mappings) not between 1 and 10000
     or char_length(btrim(coalesce(p_review_note, ''))) not between 8 and 1000
     or nullif(btrim(p_idempotency_key), '') is null then
    raise exception 'MIGRATION_MAPPING_INVALID' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_mappings) item
    group by item->>'source_kind', btrim(item->>'source_key') having count(*) > 1
  ) then
    raise exception 'MIGRATION_MAPPING_AMBIGUOUS: each source identity requires one explicit reviewed mapping'
      using errcode = '23505';
  end if;
  v_hash := encode(extensions.digest(convert_to(p_mappings::text, 'UTF8'), 'sha256'), 'hex');
  select * into v_existing from public.migration_mapping_revisions
    where project_id = p_project_id and idempotency_key = btrim(p_idempotency_key);
  if found then
    if v_existing.source_revision_id <> p_source_revision_id or v_existing.mapping_sha256 <> v_hash then
      raise exception 'MIGRATION_IDEMPOTENCY_CONFLICT' using errcode = '23505';
    end if;
    return v_existing.id;
  end if;
  select coalesce(max(revision), 0) + 1 into v_revision
    from public.migration_mapping_revisions where project_id = p_project_id;
  insert into public.migration_mapping_revisions(
    project_id, source_revision_id, organization_id, revision, mapping_sha256,
    idempotency_key, review_note, reviewed_by
  ) values (
    p_project_id, p_source_revision_id, v_project.organization_id, v_revision, v_hash,
    btrim(p_idempotency_key), btrim(p_review_note), auth.uid()
  ) returning id into v_id;
  for v_item in select value from jsonb_array_elements(p_mappings) loop
    begin
      v_kind := (v_item->>'source_kind')::public.migration_mapping_source_kind;
      v_resolution := (v_item->>'resolution')::public.migration_mapping_resolution;
      v_account := nullif(v_item->>'target_account_id', '')::uuid;
      v_counterparty := nullif(v_item->>'target_counterparty_id', '')::uuid;
    exception when others then raise exception 'MIGRATION_MAPPING_INVALID' using errcode = '22023'; end;
    v_source_key := nullif(btrim(v_item->>'source_key'), '');
    v_proposed := v_item->'proposed_record';
    if v_source_key is null or jsonb_typeof(coalesce(v_item->'source_identity', '{}'::jsonb)) <> 'object'
       or jsonb_typeof(coalesce(v_item->'approval_evidence', '{}'::jsonb)) <> 'object' then
      raise exception 'MIGRATION_MAPPING_INVALID' using errcode = '22023';
    end if;
    if v_resolution = 'existing_record' and v_kind = 'account' then
      select * into v_account_row from public.accounts where id = v_account and organization_id = v_project.organization_id;
      if not found or v_account_row.is_archived or v_account_row.account_role <> 'posting' then
        raise exception 'MIGRATION_ACCOUNT_TARGET_INELIGIBLE' using errcode = '23514';
      end if;
    elsif v_resolution = 'existing_record' and v_kind <> 'account' then
      select * into v_counterparty_row from public.counterparties where id = v_counterparty and organization_id = v_project.organization_id;
      if not found or v_counterparty_row.is_archived
         or (v_kind = 'customer' and v_counterparty_row.type <> 'customer')
         or (v_kind = 'supplier' and v_counterparty_row.type <> 'vendor') then
        raise exception 'MIGRATION_MASTER_TARGET_INELIGIBLE' using errcode = '23514';
      end if;
    elsif v_resolution = 'reviewed_creation' then
      if v_proposed is null or jsonb_typeof(v_proposed) <> 'object'
         or nullif(btrim(v_proposed->>'name'), '') is null
         or jsonb_typeof(coalesce(v_item->'approval_evidence', '{}'::jsonb)) <> 'object'
         or coalesce(v_item->'approval_evidence', '{}'::jsonb) = '{}'::jsonb then
        raise exception 'MIGRATION_CREATION_REVIEW_REQUIRED' using errcode = '23514';
      end if;
    end if;
    insert into public.migration_mapping_entries(
      mapping_revision_id, source_revision_id, project_id, organization_id,
      source_kind, source_key, source_identity, resolution, target_account_id,
      target_counterparty_id, proposed_record, approval_evidence
    ) values (
      v_id, p_source_revision_id, p_project_id, v_project.organization_id,
      v_kind, v_source_key, coalesce(v_item->'source_identity', '{}'::jsonb), v_resolution,
      v_account, v_counterparty, v_proposed, coalesce(v_item->'approval_evidence', '{}'::jsonb)
    );
  end loop;
  update public.migration_projects set current_mapping_revision_id = v_id,
    current_staging_batch_id = null, status = 'mapping', revision = revision + 1,
    validation_result = null, validated_by = null, validated_at = null,
    updated_by = auth.uid(), updated_at = now() where id = p_project_id;
  perform app.write_audit(v_project.organization_id, 'migration_mapping.reviewed', 'migration_mapping_revision', v_id,
    null, jsonb_build_object('project_id', p_project_id, 'source_revision_id', p_source_revision_id,
      'revision', v_revision, 'mapping_count', jsonb_array_length(p_mappings)));
  return v_id;
end;
$$;

create or replace function public.stage_migration_rows(
  p_project_id uuid,
  p_source_revision_id uuid,
  p_mapping_revision_id uuid,
  p_rows jsonb,
  p_idempotency_key text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_project public.migration_projects%rowtype; v_existing public.migration_staging_batches%rowtype;
  v_id uuid; v_revision integer; v_hash text; v_item jsonb; v_source_row integer;
  v_kind public.migration_mapping_source_kind; v_source_key text; v_original uuid; v_mapping uuid; v_errors jsonb;
begin
  select * into v_project from public.migration_projects where id = p_project_id for update;
  if not found then raise exception 'TENANT_ACCESS_DENIED: migration project not found' using errcode = '42501'; end if;
  perform app.require_capability(v_project.organization_id, 'migrations.manage');
  if p_source_revision_id is distinct from v_project.current_source_revision_id
     or p_mapping_revision_id is distinct from v_project.current_mapping_revision_id
     or p_rows is null or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) not between 1 and 50000
     or nullif(btrim(p_idempotency_key), '') is null then
    raise exception 'MIGRATION_STAGING_INVALID' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_rows) item
    group by item->>'source_row' having count(*) > 1
  ) then
    raise exception 'MIGRATION_STAGING_AMBIGUOUS: each original row may be normalized once per staging revision'
      using errcode = '23505';
  end if;
  v_hash := encode(extensions.digest(convert_to(p_rows::text, 'UTF8'), 'sha256'), 'hex');
  select * into v_existing from public.migration_staging_batches
    where project_id = p_project_id and idempotency_key = btrim(p_idempotency_key);
  if found then
    if v_existing.source_revision_id <> p_source_revision_id
       or v_existing.mapping_revision_id <> p_mapping_revision_id or v_existing.rows_sha256 <> v_hash then
      raise exception 'MIGRATION_IDEMPOTENCY_CONFLICT' using errcode = '23505';
    end if;
    return v_existing.id;
  end if;
  select coalesce(max(revision), 0) + 1 into v_revision
    from public.migration_staging_batches where project_id = p_project_id;
  insert into public.migration_staging_batches(
    project_id, source_revision_id, mapping_revision_id, organization_id,
    revision, rows_sha256, idempotency_key, staged_by
  ) values (
    p_project_id, p_source_revision_id, p_mapping_revision_id, v_project.organization_id,
    v_revision, v_hash, btrim(p_idempotency_key), auth.uid()
  ) returning id into v_id;
  for v_item in select value from jsonb_array_elements(p_rows) loop
    begin
      v_source_row := (v_item->>'source_row')::integer;
      v_kind := (v_item->>'source_kind')::public.migration_mapping_source_kind;
    exception when others then raise exception 'MIGRATION_NORMALIZED_ROW_INVALID' using errcode = '22023'; end;
    v_source_key := nullif(btrim(v_item->>'source_key'), '');
    if v_source_key is null or jsonb_typeof(coalesce(v_item->'normalized_payload', '{}'::jsonb)) <> 'object' then
      raise exception 'MIGRATION_NORMALIZED_ROW_INVALID' using errcode = '22023';
    end if;
    select id into v_original from public.migration_original_rows
      where source_revision_id = p_source_revision_id and source_row = v_source_row;
    if not found then raise exception 'MIGRATION_ORIGINAL_ROW_NOT_FOUND' using errcode = '23514'; end if;
    select id into v_mapping from public.migration_mapping_entries
      where mapping_revision_id = p_mapping_revision_id and source_kind = v_kind and source_key = v_source_key;
    v_errors := case when found then '[]'::jsonb else jsonb_build_array('MIGRATION_MAPPING_REQUIRED') end;
    insert into public.migration_normalized_rows(
      staging_batch_id, project_id, source_revision_id, mapping_revision_id, organization_id,
      original_row_id, source_row, source_kind, source_key, mapping_entry_id,
      normalized_payload, validation_errors
    ) values (
      v_id, p_project_id, p_source_revision_id, p_mapping_revision_id, v_project.organization_id,
      v_original, v_source_row, v_kind, v_source_key, v_mapping,
      coalesce(v_item->'normalized_payload', '{}'::jsonb), v_errors
    );
  end loop;
  update public.migration_projects set current_staging_batch_id = v_id,
    status = 'mapping', revision = revision + 1, validation_result = null,
    validated_by = null, validated_at = null, updated_by = auth.uid(), updated_at = now()
    where id = p_project_id;
  perform app.write_audit(v_project.organization_id, 'migration_rows.staged', 'migration_staging_batch', v_id,
    null, jsonb_build_object('project_id', p_project_id, 'revision', v_revision,
      'row_count', jsonb_array_length(p_rows)));
  return v_id;
end;
$$;

create or replace function public.validate_migration_project(
  p_project_id uuid,
  p_staging_batch_id uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_project public.migration_projects%rowtype; v_result jsonb; v_errors jsonb := '[]'::jsonb;
  v_original_count bigint; v_normalized_count bigint; v_unmapped_count bigint; v_ineligible_count bigint;
begin
  select * into v_project from public.migration_projects where id = p_project_id for update;
  if not found then raise exception 'TENANT_ACCESS_DENIED: migration project not found' using errcode = '42501'; end if;
  perform app.require_capability(v_project.organization_id, 'migrations.review');
  if p_staging_batch_id is distinct from v_project.current_staging_batch_id then
    raise exception 'MIGRATION_STAGING_INVALID' using errcode = '22023';
  end if;
  select count(*) into v_original_count from public.migration_original_rows
    where source_revision_id = v_project.current_source_revision_id;
  select count(*), count(*) filter (where mapping_entry_id is null or jsonb_array_length(validation_errors) > 0)
    into v_normalized_count, v_unmapped_count from public.migration_normalized_rows
    where staging_batch_id = p_staging_batch_id;
  select count(*) into v_ineligible_count
  from public.migration_normalized_rows row
  join public.migration_mapping_entries mapping on mapping.id = row.mapping_entry_id
  left join public.accounts account on account.id = mapping.target_account_id and account.organization_id = mapping.organization_id
  left join public.counterparties counterparty on counterparty.id = mapping.target_counterparty_id and counterparty.organization_id = mapping.organization_id
  where row.staging_batch_id = p_staging_batch_id and mapping.resolution = 'existing_record'
    and ((mapping.source_kind = 'account' and (account.id is null or account.is_archived or account.account_role <> 'posting'))
      or (mapping.source_kind <> 'account' and (counterparty.id is null or counterparty.is_archived)));
  if v_original_count <> v_normalized_count then v_errors := v_errors || jsonb_build_array('MIGRATION_ROW_COVERAGE_INCOMPLETE'); end if;
  if v_unmapped_count > 0 then v_errors := v_errors || jsonb_build_array('MIGRATION_MAPPING_REQUIRED'); end if;
  if v_ineligible_count > 0 then v_errors := v_errors || jsonb_build_array('MIGRATION_TARGET_NO_LONGER_ELIGIBLE'); end if;
  v_result := jsonb_build_object(
    'valid', jsonb_array_length(v_errors) = 0,
    'project_id', p_project_id,
    'source_revision_id', v_project.current_source_revision_id,
    'mapping_revision_id', v_project.current_mapping_revision_id,
    'staging_batch_id', p_staging_batch_id,
    'migration_depth', v_project.migration_depth,
    'cutover_date', v_project.cutover_date,
    'original_row_count', v_original_count,
    'normalized_row_count', v_normalized_count,
    'unmapped_row_count', v_unmapped_count,
    'errors', v_errors,
    'gl_effect', 'none',
    'future_gl_boundary', 'opening_balance_batch'
  );
  update public.migration_projects set status = case
      when jsonb_array_length(v_errors) = 0 then 'validated'::public.migration_project_status
      else 'mapping'::public.migration_project_status
    end,
    revision = revision + 1, validation_result = v_result,
    validated_by = case when jsonb_array_length(v_errors) = 0 then auth.uid() else null end,
    validated_at = case when jsonb_array_length(v_errors) = 0 then now() else null end,
    updated_by = auth.uid(), updated_at = now() where id = p_project_id;
  insert into public.migration_validation_runs(
    project_id, staging_batch_id, organization_id, project_revision, result, validated_by
  ) select id, p_staging_batch_id, organization_id, revision, v_result, auth.uid()
    from public.migration_projects where id = p_project_id;
  perform app.write_audit(v_project.organization_id, 'migration_project.validated', 'migration_project', p_project_id,
    null, v_result);
  return v_result;
end;
$$;

create or replace function public.link_migration_opening_balance_batch(
  p_project_id uuid,
  p_opening_balance_batch_id uuid
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_project public.migration_projects%rowtype; v_batch public.opening_balance_batches%rowtype;
begin
  select * into v_project from public.migration_projects where id = p_project_id for update;
  if not found then raise exception 'TENANT_ACCESS_DENIED: migration project not found' using errcode = '42501'; end if;
  perform app.require_capability(v_project.organization_id, 'migrations.review');
  if v_project.status <> 'validated' then raise exception 'MIGRATION_PROJECT_NOT_VALIDATED' using errcode = '23514'; end if;
  select * into v_batch from public.opening_balance_batches
    where id = p_opening_balance_batch_id and organization_id = v_project.organization_id;
  if not found then raise exception 'MIGRATION_OPENING_BATCH_INVALID' using errcode = '23514'; end if;
  if v_batch.cutoff_date <> v_project.cutover_date then
    raise exception 'MIGRATION_OPENING_CUTOFF_MISMATCH' using errcode = '23514';
  end if;
  if v_project.opening_balance_batch_id is not null and v_project.opening_balance_batch_id <> p_opening_balance_batch_id then
    raise exception 'MIGRATION_OPENING_BATCH_ALREADY_LINKED' using errcode = '55000';
  end if;
  update public.migration_projects set opening_balance_batch_id = p_opening_balance_batch_id,
    revision = revision + case when opening_balance_batch_id is null then 1 else 0 end,
    updated_by = auth.uid(), updated_at = now() where id = p_project_id;
  perform app.write_audit(v_project.organization_id, 'migration_project.opening_batch_linked', 'migration_project', p_project_id,
    null, jsonb_build_object('opening_balance_batch_id', p_opening_balance_batch_id));
  return p_opening_balance_batch_id;
end;
$$;

create or replace function public.read_migration_project(p_project_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_project public.migration_projects%rowtype;
begin
  select * into v_project from public.migration_projects where id = p_project_id;
  if not found then raise exception 'TENANT_ACCESS_DENIED: migration project not found' using errcode = '42501'; end if;
  perform app.require_capability(v_project.organization_id, 'migrations.read');
  return jsonb_build_object(
    'project', to_jsonb(v_project),
    'sources', (select coalesce(jsonb_agg(to_jsonb(source) - 'content_bytes' order by revision), '[]'::jsonb)
      from public.migration_source_revisions source where project_id = p_project_id),
    'mappings', (select coalesce(jsonb_agg(to_jsonb(mapping) order by revision), '[]'::jsonb)
      from public.migration_mapping_revisions mapping where project_id = p_project_id),
    'staging_batches', (select coalesce(jsonb_agg(to_jsonb(staging) order by revision), '[]'::jsonb)
      from public.migration_staging_batches staging where project_id = p_project_id),
    'validation_runs', (select coalesce(jsonb_agg(to_jsonb(validation) order by validated_at), '[]'::jsonb)
      from public.migration_validation_runs validation where project_id = p_project_id)
  );
end;
$$;

create or replace function public.download_migration_source(p_source_revision_id uuid)
returns bytea language plpgsql stable security definer set search_path = '' as $$
declare v_source public.migration_source_revisions%rowtype;
begin
  select * into v_source from public.migration_source_revisions where id = p_source_revision_id;
  if not found then raise exception 'TENANT_ACCESS_DENIED: migration source not found' using errcode = '42501'; end if;
  perform app.require_capability(v_source.organization_id, 'migrations.read');
  return v_source.content_bytes;
end;
$$;

revoke all on function public.create_migration_project(uuid,text,public.migration_source_type,date,text,public.migration_depth),
  public.upload_migration_source(uuid,text,text,bytea,text,jsonb,jsonb,text),
  public.create_migration_mapping_revision(uuid,uuid,jsonb,text,text),
  public.stage_migration_rows(uuid,uuid,uuid,jsonb,text),
  public.validate_migration_project(uuid,uuid),
  public.link_migration_opening_balance_batch(uuid,uuid),
  public.read_migration_project(uuid), public.download_migration_source(uuid) from public, anon;
grant execute on function public.create_migration_project(uuid,text,public.migration_source_type,date,text,public.migration_depth),
  public.upload_migration_source(uuid,text,text,bytea,text,jsonb,jsonb,text),
  public.create_migration_mapping_revision(uuid,uuid,jsonb,text,text),
  public.stage_migration_rows(uuid,uuid,uuid,jsonb,text),
  public.validate_migration_project(uuid,uuid),
  public.link_migration_opening_balance_batch(uuid,uuid),
  public.read_migration_project(uuid), public.download_migration_source(uuid) to authenticated, service_role;
revoke all on function app.reject_migration_evidence_change() from public, anon, authenticated;
