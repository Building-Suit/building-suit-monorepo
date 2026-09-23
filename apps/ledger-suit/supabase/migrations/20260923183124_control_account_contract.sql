-- V2-IMP-005: explicit Control-account and subledger contract.
-- Existing accounts retain their current role. Nothing in this migration
-- infers Control semantics from names, codes, subtypes, balances, hierarchy,
-- or transaction history, and no existing ledger row is changed.

create type public.control_subledger_type as enum ('customer', 'supplier');
create type public.control_reconciliation_status as enum (
  'provider_unavailable', 'reconciled', 'unreconciled', 'explained_variance'
);
create type public.control_reference_kind as enum (
  'reconciliation_case', 'subledger_record'
);

alter table public.accounts drop constraint accounts_role_valid;
alter table public.accounts add constraint accounts_role_valid
  check (account_role in ('posting', 'group', 'control'));
alter table public.accounts drop constraint accounts_group_not_operational;
alter table public.accounts add constraint accounts_group_not_operational check (
  account_role = 'posting'
  or (account_role in ('group', 'control')
      and not is_system and system_key is null and contra_account_id is null)
);
comment on column public.accounts.account_role is
  'Immutable role: group is structural, posting accepts ordinary entries, and control accepts only trusted linked-subledger entries or privileged Control adjustments. Existing roles are never inferred.';

create table public.control_account_bindings (
  account_id uuid primary key,
  organization_id uuid not null,
  subledger_type public.control_subledger_type not null,
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles (id) on delete restrict,
  constraint control_binding_account_same_org
    foreign key (account_id, organization_id)
    references public.accounts (id, organization_id) on delete restrict,
  unique (account_id, organization_id)
);
create index control_account_bindings_org_type_idx
  on public.control_account_bindings (organization_id, subledger_type);
comment on table public.control_account_bindings is
  'One immutable organization-scoped subledger type for each explicit Control account. Multiple Control accounts may share a subledger type; routing is always explicit.';

create table public.control_adjustments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  transaction_id uuid not null,
  control_account_id uuid not null,
  subledger_type public.control_subledger_type not null,
  reason text not null check (char_length(btrim(reason)) > 0),
  reference_kind public.control_reference_kind not null,
  reconciliation_reference text not null check (char_length(btrim(reconciliation_reference)) > 0),
  idempotency_key text not null check (char_length(btrim(idempotency_key)) > 0),
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles (id) on delete restrict,
  constraint control_adjustment_transaction_same_org
    foreign key (transaction_id, organization_id)
    references public.transactions (id, organization_id) on delete restrict,
  constraint control_adjustment_account_same_org
    foreign key (control_account_id, organization_id)
    references public.control_account_bindings (account_id, organization_id) on delete restrict,
  unique (transaction_id),
  unique (organization_id, idempotency_key)
);
create index control_adjustments_account_date_idx
  on public.control_adjustments (organization_id, control_account_id, created_at desc);
comment on table public.control_adjustments is
  'Immutable evidence for the exceptional privileged pathway. Financial effect remains in the linked posted journal.';

create table public.control_variance_explanations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  control_account_id uuid not null,
  as_of_date date not null,
  reason text not null check (char_length(btrim(reason)) > 0),
  reference_kind public.control_reference_kind not null,
  reconciliation_reference text not null check (char_length(btrim(reconciliation_reference)) > 0),
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles (id) on delete restrict,
  constraint control_variance_account_same_org
    foreign key (control_account_id, organization_id)
    references public.control_account_bindings (account_id, organization_id) on delete restrict
);
create index control_variance_explanations_lookup_idx
  on public.control_variance_explanations
  (organization_id, control_account_id, as_of_date, created_at desc);
comment on table public.control_variance_explanations is
  'Append-only evidence explaining, never changing or hiding, a dated GL-to-subledger variance.';

insert into public.capabilities (key, domain, description) values
  ('controls.configure', 'controls', 'Create configured Control accounts and bindings'),
  ('controls.adjust', 'controls', 'Post exceptional reasoned Control adjustments'),
  ('controls.reconcile', 'controls', 'View dated Control reconciliation'),
  ('controls.explain_variance', 'controls', 'Record immutable Control variance explanations')
on conflict (key) do nothing;

insert into public.role_capabilities (role, capability_key)
select role, capability from (values
  ('owner'::public.organization_role, 'controls.configure'),
  ('owner'::public.organization_role, 'controls.adjust'),
  ('owner'::public.organization_role, 'controls.reconcile'),
  ('owner'::public.organization_role, 'controls.explain_variance'),
  ('admin'::public.organization_role, 'controls.configure'),
  ('admin'::public.organization_role, 'controls.adjust'),
  ('admin'::public.organization_role, 'controls.reconcile'),
  ('admin'::public.organization_role, 'controls.explain_variance'),
  ('accountant'::public.organization_role, 'controls.reconcile')
) defaults(role, capability)
on conflict do nothing;

alter table public.control_account_bindings enable row level security;
alter table public.control_adjustments enable row level security;
alter table public.control_variance_explanations enable row level security;

create policy "control bindings are visible with accounts.read"
  on public.control_account_bindings for select to authenticated
  using (app.has_capability(organization_id, 'accounts.read'));
create policy "control adjustments are visible with controls.reconcile"
  on public.control_adjustments for select to authenticated
  using (app.has_capability(organization_id, 'controls.reconcile'));
create policy "control variance explanations are visible with controls.reconcile"
  on public.control_variance_explanations for select to authenticated
  using (app.has_capability(organization_id, 'controls.reconcile'));

grant select on public.control_account_bindings,
  public.control_adjustments, public.control_variance_explanations to authenticated;

create or replace function app.reject_control_evidence_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  raise exception 'IMMUTABLE_CONTROL_EVIDENCE: Control evidence is append-only'
    using errcode = '55000';
end;
$$;
create trigger control_adjustments_immutable
  before update or delete on public.control_adjustments
  for each row execute function app.reject_control_evidence_change();
create trigger control_variance_explanations_immutable
  before update or delete on public.control_variance_explanations
  for each row execute function app.reject_control_evidence_change();
create trigger control_account_bindings_immutable
  before update or delete on public.control_account_bindings
  for each row execute function app.reject_control_evidence_change();

create or replace function app.validate_control_binding()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_account public.accounts%rowtype;
  v_binding public.control_account_bindings%rowtype;
  v_account_id uuid;
begin
  if tg_table_name = 'accounts' then
    v_account_id := coalesce(new.id, old.id);
  else
    v_account_id := coalesce(new.account_id, old.account_id);
  end if;

  select * into v_account from public.accounts where id = v_account_id;
  select * into v_binding from public.control_account_bindings where account_id = v_account_id;

  if v_account.account_role = 'control' and v_binding.account_id is null then
    raise exception 'CONTROL_BINDING_REQUIRED: a Control account requires exactly one subledger binding'
      using errcode = '23514';
  end if;
  if v_account.account_role <> 'control' and v_binding.account_id is not null then
    raise exception 'CONTROL_BINDING_ROLE_INVALID: only a Control account may have a subledger binding'
      using errcode = '23514';
  end if;
  if v_binding.account_id is null then return null; end if;

  if v_account.organization_id <> v_binding.organization_id then
    raise exception 'TENANT_ACCESS_DENIED: Control binding organization mismatch'
      using errcode = '42501';
  end if;
  if v_account.is_system or v_account.contra_account_id is not null then
    raise exception 'CONTROL_ACCOUNT_INCOMPATIBLE: Control account must be non-system and not Contra'
      using errcode = '23514';
  end if;
  if v_binding.subledger_type = 'customer'
     and not (v_account.type = 'asset' and v_account.subtype = 'accounts_receivable'
              and v_account.normal_balance = 'debit') then
    raise exception 'CONTROL_ACCOUNT_INCOMPATIBLE: customer Control requires debit-normal Accounts Receivable asset'
      using errcode = '23514';
  end if;
  if v_binding.subledger_type = 'supplier'
     and not (v_account.type = 'liability' and v_account.subtype = 'accounts_payable'
              and v_account.normal_balance = 'credit') then
    raise exception 'CONTROL_ACCOUNT_INCOMPATIBLE: supplier Control requires credit-normal Accounts Payable liability'
      using errcode = '23514';
  end if;
  return null;
end;
$$;
create constraint trigger accounts_validate_control_binding
  after insert or update on public.accounts deferrable initially deferred
  for each row execute function app.validate_control_binding();
create constraint trigger bindings_validate_control_account
  after insert or update or delete on public.control_account_bindings deferrable initially deferred
  for each row execute function app.validate_control_binding();

create or replace function app.guard_account_role()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_parent public.accounts%rowtype;
begin
  if tg_op = 'UPDATE' then
    if new.account_role is distinct from old.account_role then
      raise exception 'ACCOUNT_ROLE_IMMUTABLE: create a new account instead of changing historical meaning'
        using errcode = '23514';
    end if;
    if row(new.type, new.currency) is distinct from row(old.type, old.currency)
       and exists (select 1 from public.accounts c where c.parent_account_id = old.id) then
      raise exception 'ACCOUNT_PARENT_CLASSIFICATION_LOCKED: child accounts depend on this type and currency'
        using errcode = '23514';
    end if;
  end if;
  if new.contra_account_id is not null and exists (
    select 1 from public.accounts a where a.id = new.contra_account_id
      and a.organization_id = new.organization_id and a.account_role = 'group'
  ) then
    raise exception 'ACCOUNT_GROUP_NOT_POSTABLE: a group cannot be a contra target'
      using errcode = '23514';
  end if;
  if new.contra_account_id is not null and exists (
    select 1 from public.accounts a where a.id = new.contra_account_id
      and a.organization_id = new.organization_id and a.account_role = 'control'
  ) then
    raise exception 'ACCOUNT_CONTROL_NOT_CONTRA_TARGET: a Control account cannot be a Contra target'
      using errcode = '23514';
  end if;
  if new.parent_account_id is not null and (tg_op = 'INSERT'
      or row(new.parent_account_id, new.type, new.currency, new.organization_id)
         is distinct from row(old.parent_account_id, old.type, old.currency, old.organization_id)) then
    select * into v_parent from public.accounts a
      where a.id = new.parent_account_id and a.organization_id = new.organization_id for share;
    if not found or v_parent.is_archived or v_parent.type <> new.type or v_parent.currency <> new.currency then
      raise exception 'INVALID_ACCOUNT_PARENT: parent must be active with the same organization, type and currency'
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create or replace function app.control_posting_context_matches(
  p_organization_id uuid, p_account_id uuid
)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(current_setting('app.control_posting_authorized', true), '') = 'on'
     and nullif(current_setting('app.control_posting_organization', true), '')::uuid = p_organization_id
     and nullif(current_setting('app.control_posting_account', true), '')::uuid = p_account_id
     and nullif(current_setting('app.control_posting_reference', true), '') is not null
     and exists (
       select 1 from public.control_account_bindings binding
       where binding.organization_id = p_organization_id
         and binding.account_id = p_account_id
         and binding.subledger_type::text = current_setting('app.control_posting_subledger', true)
     );
$$;

create or replace function app.require_posting_account_reference()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid := (to_jsonb(new) ->> tg_argv[0])::uuid;
  v_role text;
begin
  if v_id is null then return new; end if;
  select a.account_role into v_role from public.accounts a
    where a.id = v_id and a.organization_id = new.organization_id;
  if not found then return new; end if;
  if v_role = 'group' then
    raise exception 'ACCOUNT_GROUP_NOT_POSTABLE: choose a posting account'
      using errcode = '23514';
  end if;
  if v_role = 'control'
     and not app.control_posting_context_matches(new.organization_id, v_id) then
    raise exception 'ACCOUNT_CONTROL_NOT_DIRECTLY_POSTABLE: use the linked subledger or privileged Control adjustment pathway'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

-- The journal normalizer calls this helper before it inserts entries. Preserve
-- all existing type/archive checks while recognizing the same private context
-- as the final entry trigger; ordinary wrappers still reject Control accounts.
create or replace function app.require_account(
  p_organization_id uuid,
  p_account_id uuid,
  p_expected_types public.account_type[] default null,
  p_label text default 'account'
)
returns public.accounts language plpgsql stable security definer set search_path = '' as $$
declare v_account public.accounts%rowtype;
begin
  if p_account_id is null then
    raise exception 'INVALID_ACCOUNT: % is required', p_label using errcode = '22023';
  end if;
  select * into v_account from public.accounts account where account.id = p_account_id;
  if not found or v_account.organization_id <> p_organization_id then
    raise exception 'TENANT_ACCESS_DENIED: % does not belong to this organization', p_label
      using errcode = '42501';
  end if;
  if v_account.is_archived then
    raise exception 'ACCOUNT_ARCHIVED: % (%) cannot receive postings', v_account.name, p_label
      using errcode = '23514';
  end if;
  if p_expected_types is not null and not (v_account.type = any (p_expected_types)) then
    raise exception 'INVALID_ACCOUNT: % must be one of %, got %',
      p_label, p_expected_types, v_account.type using errcode = '22023';
  end if;
  if v_account.account_role = 'group' then
    raise exception 'ACCOUNT_GROUP_NOT_POSTABLE: choose a posting account' using errcode = '23514';
  end if;
  if v_account.account_role = 'control'
     and not app.control_posting_context_matches(p_organization_id, p_account_id) then
    raise exception 'ACCOUNT_CONTROL_NOT_DIRECTLY_POSTABLE: use the linked subledger or privileged Control adjustment pathway'
      using errcode = '23514';
  end if;
  return v_account;
end;
$$;

create or replace function app.begin_control_posting(
  p_organization_id uuid,
  p_control_account_id uuid,
  p_expected_subledger_type public.control_subledger_type,
  p_reference text,
  p_posting_date date,
  p_mode text
)
returns void language plpgsql volatile security definer set search_path = '' as $$
begin
  if p_mode not in ('subledger', 'adjustment') then
    raise exception 'CONTROL_POSTING_MODE_INVALID' using errcode = '22023';
  end if;
  if nullif(btrim(p_reference), '') is null then
    raise exception 'CONTROL_REFERENCE_REQUIRED' using errcode = '22023';
  end if;
  perform 1 from public.control_account_bindings binding
  join public.accounts account on account.id = binding.account_id
  where binding.account_id = p_control_account_id
    and binding.organization_id = p_organization_id
    and binding.subledger_type = p_expected_subledger_type
    and account.account_role = 'control'
    and not account.is_archived;
  if not found then
    raise exception 'CONTROL_BINDING_MISMATCH: account is not bound to the expected subledger'
      using errcode = '23514';
  end if;
  if p_mode = 'subledger' then
    perform app.assert_accounting_period_allows(
      p_organization_id, p_posting_date, null, 'api', null);
  end if;
  perform set_config('app.control_posting_authorized', 'on', true);
  perform set_config('app.control_posting_organization', p_organization_id::text, true);
  perform set_config('app.control_posting_account', p_control_account_id::text, true);
  perform set_config('app.control_posting_subledger', p_expected_subledger_type::text, true);
  perform set_config('app.control_posting_reference', btrim(p_reference), true);
end;
$$;

create or replace function app.end_control_posting()
returns void language plpgsql volatile security definer set search_path = '' as $$
begin
  perform set_config('app.control_posting_authorized', '', true);
  perform set_config('app.control_posting_organization', '', true);
  perform set_config('app.control_posting_account', '', true);
  perform set_config('app.control_posting_subledger', '', true);
  perform set_config('app.control_posting_reference', '', true);
end;
$$;

-- Private future-subledger boundary: a future AR/AP server RPC must validate
-- this contract, activate the private context, and still use app.create_and_post.
-- No authenticated client receives EXECUTE on these helpers.
comment on function app.begin_control_posting(uuid,uuid,public.control_subledger_type,text,date,text) is
  'Private trusted boundary for future AR/AP posting and the dedicated Control-adjustment RPC. Source labels and client metadata do not authorize Control entries.';

-- Extend the shared period policy narrowly: Control adjustments need their own
-- privilege in addition to both existing Soft-Close adjustment privileges.
create or replace function app.assert_accounting_period_allows(
  p_organization_id uuid,
  p_date date,
  p_type public.transaction_type default null,
  p_source public.transaction_source default 'manual',
  p_reason text default null
)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare v_legacy_lock date; v_status public.accounting_period_status;
begin
  if p_date is null or not isfinite(p_date) then
    raise exception 'INVALID_ACCOUNTING_DATE' using errcode = '22023';
  end if;
  select settings.books_locked_until into v_legacy_lock
  from public.organization_settings settings
  where settings.organization_id = p_organization_id for update;
  if not found then
    raise exception 'TENANT_ACCESS_DENIED: organization settings not found' using errcode = '42501';
  end if;
  if v_legacy_lock is not null and p_date <= v_legacy_lock
     and not app.has_capability(p_organization_id, 'books.override_lock') then
    raise exception 'BOOKS_LOCKED: books are locked through %', v_legacy_lock using errcode = '42501';
  end if;
  select period.status into v_status from public.accounting_periods period
  where period.organization_id = p_organization_id
    and p_date between period.start_date and period.end_date;
  if v_status is null or v_status = 'open' then return; end if;
  if v_status = 'hard_closed' then
    raise exception 'ACCOUNTING_PERIOD_HARD_CLOSED' using errcode = '42501';
  end if;
  if p_source = 'year_end_close' and p_type = 'adjustment'
     and app.has_capability(p_organization_id, 'periods.year_end_close')
     and nullif(btrim(p_reason), '') is not null then return; end if;
  if p_type = 'adjustment' and p_source in ('manual', 'control_adjustment')
     and app.has_capability(p_organization_id, 'transactions.adjust')
     and app.has_capability(p_organization_id, 'periods.adjust_soft_closed')
     and (p_source <> 'control_adjustment'
          or app.has_capability(p_organization_id, 'controls.adjust'))
     and nullif(btrim(p_reason), '') is not null then return; end if;
  raise exception 'ACCOUNTING_PERIOD_SOFT_CLOSED: only authorized reasoned adjustments are allowed'
    using errcode = '42501';
end;
$$;

-- Replace the account-creation RPC with one atomic account-plus-binding command.
drop function public.create_account(
  uuid, text, public.account_type, public.account_subtype, char, text, uuid,
  public.normal_balance, uuid, text
);
create function public.create_account(
  p_organization_id uuid,
  p_name text,
  p_type public.account_type,
  p_subtype public.account_subtype,
  p_currency char(3) default null,
  p_code text default null,
  p_parent_account_id uuid default null,
  p_normal_balance public.normal_balance default null,
  p_contra_account_id uuid default null,
  p_account_role text default 'posting',
  p_control_subledger_type public.control_subledger_type default null
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_system_key text;
begin
  perform app.require_capability(p_organization_id, 'accounts.create');
  if p_account_role not in ('posting', 'group', 'control') then
    raise exception 'INVALID_ACCOUNT_ROLE' using errcode = '22023';
  end if;
  if p_account_role = 'control' then
    perform app.require_capability(p_organization_id, 'controls.configure');
    if p_control_subledger_type is null then
      raise exception 'CONTROL_BINDING_REQUIRED: choose a subledger type'
        using errcode = '22023';
    end if;
    if p_control_subledger_type = 'customer'
       and not (p_type = 'asset' and p_subtype = 'accounts_receivable'
                and coalesce(p_normal_balance, app.normal_balance_for(p_type)) = 'debit') then
      raise exception 'CONTROL_ACCOUNT_INCOMPATIBLE: customer Control requires debit-normal Accounts Receivable asset'
        using errcode = '23514';
    end if;
    if p_control_subledger_type = 'supplier'
       and not (p_type = 'liability' and p_subtype = 'accounts_payable'
                and coalesce(p_normal_balance, app.normal_balance_for(p_type)) = 'credit') then
      raise exception 'CONTROL_ACCOUNT_INCOMPATIBLE: supplier Control requires credit-normal Accounts Payable liability'
        using errcode = '23514';
    end if;
  elsif p_control_subledger_type is not null then
    raise exception 'CONTROL_BINDING_ROLE_INVALID: only a Control account may have a binding'
      using errcode = '22023';
  end if;
  if p_name is null or char_length(trim(p_name)) = 0 then
    raise exception 'INVALID_INPUT: account name is required' using errcode = '22023';
  end if;
  if p_parent_account_id is not null then
    perform 1 from public.accounts a where a.id = p_parent_account_id
      and a.organization_id = p_organization_id and not a.is_archived;
    if not found then
      raise exception 'INVALID_ACCOUNT_PARENT: choose an active parent in this organization'
        using errcode = '23514';
    end if;
  end if;
  if p_account_role = 'posting' and p_subtype::text in (
    'bank_fees', 'interest_expense', 'owner_capital', 'owner_drawings',
    'opening_balance_equity'
  ) and not exists (
    select 1 from public.accounts a where a.organization_id = p_organization_id
      and a.system_key = p_subtype::text
  ) then v_system_key := p_subtype::text; end if;

  insert into public.accounts (
    organization_id, code, name, type, subtype, currency, parent_account_id,
    system_key, created_by, normal_balance, contra_account_id, account_role
  ) values (
    p_organization_id, nullif(trim(p_code), ''), trim(p_name), p_type,
    p_subtype, coalesce(p_currency, app.org_base_currency(p_organization_id)),
    p_parent_account_id, v_system_key, auth.uid(), p_normal_balance,
    case when p_account_role = 'posting' then p_contra_account_id else null end,
    p_account_role
  ) returning id into v_id;

  if p_account_role = 'control' then
    insert into public.control_account_bindings (
      account_id, organization_id, subledger_type, created_by
    ) values (v_id, p_organization_id, p_control_subledger_type, auth.uid());
  end if;
  if p_account_role = 'posting' and p_type in ('revenue', 'expense') then
    insert into public.categories (organization_id, name, kind, default_account_id, created_by)
    values (p_organization_id, trim(p_name),
      case when p_type = 'revenue' then 'income'::public.category_kind else 'expense'::public.category_kind end,
      v_id, auth.uid())
    on conflict (organization_id, lower(name)) do update
      set default_account_id = excluded.default_account_id, kind = excluded.kind, is_active = true;
  end if;
  perform app.write_audit(p_organization_id, 'account.created', 'account', v_id, null,
    jsonb_build_object('name', trim(p_name), 'type', p_type, 'subtype', p_subtype,
      'normal_balance', (select normal_balance from public.accounts where id = v_id),
      'contra_account_id', p_contra_account_id, 'account_role', p_account_role,
      'parent_account_id', p_parent_account_id,
      'control_subledger_type', p_control_subledger_type));
  return v_id;
end;
$$;

create function public.create_control_adjustment(
  p_organization_id uuid,
  p_control_account_id uuid,
  p_transaction_date date,
  p_lines jsonb,
  p_description text,
  p_reason text,
  p_reference_kind public.control_reference_kind,
  p_reconciliation_reference text,
  p_idempotency_key text,
  p_currency_code char(3) default null,
  p_exchange_rate numeric default null
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_binding public.control_account_bindings%rowtype;
  v_transaction_id uuid;
  v_control_line_count int;
  v_recorded boolean := false;
begin
  perform app.require_capability(p_organization_id, 'transactions.adjust');
  perform app.require_capability(p_organization_id, 'controls.adjust');
  if nullif(btrim(p_description), '') is null then
    raise exception 'INVALID_CONTROL_ADJUSTMENT: description is required' using errcode = '22023';
  end if;
  if nullif(btrim(p_reason), '') is null then
    raise exception 'INVALID_CONTROL_ADJUSTMENT: reason is required' using errcode = '22023';
  end if;
  if p_reference_kind is null or nullif(btrim(p_reconciliation_reference), '') is null then
    raise exception 'INVALID_CONTROL_ADJUSTMENT: reconciliation or subledger reference is required'
      using errcode = '22023';
  end if;
  if nullif(btrim(p_idempotency_key), '') is null then
    raise exception 'INVALID_CONTROL_ADJUSTMENT: idempotency key is required' using errcode = '22023';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' then
    raise exception 'INVALID_CONTROL_ADJUSTMENT: balanced lines are required' using errcode = '22023';
  end if;

  select * into v_binding from public.control_account_bindings binding
  where binding.account_id = p_control_account_id
    and binding.organization_id = p_organization_id;
  if not found then
    raise exception 'CONTROL_BINDING_MISMATCH: Control account is not bound in this organization'
      using errcode = '23514';
  end if;
  select count(*) into v_control_line_count
  from jsonb_array_elements(p_lines) line
  join public.accounts account on account.id = (line ->> 'account_id')::uuid
    and account.organization_id = p_organization_id
  where account.account_role = 'control';
  if v_control_line_count <> 1 or not exists (
    select 1 from jsonb_array_elements(p_lines) line
    where (line ->> 'account_id')::uuid = p_control_account_id
  ) then
    raise exception 'INVALID_CONTROL_ADJUSTMENT: exactly one line must use the selected Control account'
      using errcode = '23514';
  end if;

  perform app.begin_control_posting(
    p_organization_id, p_control_account_id, v_binding.subledger_type,
    p_reconciliation_reference, p_transaction_date, 'adjustment');
  begin
    v_transaction_id := app.create_and_post(
      p_organization_id => p_organization_id,
      p_type => 'adjustment', p_transaction_date => p_transaction_date,
      p_lines => p_lines, p_currency_code => p_currency_code,
      p_exchange_rate => p_exchange_rate, p_description => btrim(p_description),
      p_reference => btrim(p_reconciliation_reference),
      p_adjustment_reason => btrim(p_reason), p_source => 'control_adjustment',
      p_idempotency_key => btrim(p_idempotency_key),
      p_metadata => jsonb_build_object(
        'control_account_id', p_control_account_id,
        'control_subledger_type', v_binding.subledger_type,
        'control_reference_kind', p_reference_kind,
        'control_reconciliation_reference', btrim(p_reconciliation_reference)
      )
    );
  exception when others then
    perform app.end_control_posting();
    raise;
  end;
  perform app.end_control_posting();

  insert into public.control_adjustments (
    organization_id, transaction_id, control_account_id, subledger_type,
    reason, reference_kind, reconciliation_reference, idempotency_key, created_by
  ) values (
    p_organization_id, v_transaction_id, p_control_account_id, v_binding.subledger_type,
    btrim(p_reason), p_reference_kind, btrim(p_reconciliation_reference),
    btrim(p_idempotency_key), auth.uid()
  ) on conflict (organization_id, idempotency_key) do nothing
  returning true into v_recorded;

  if coalesce(v_recorded, false) then
    perform app.write_audit(p_organization_id, 'control_adjustment.recorded',
      'transaction', v_transaction_id, null,
      jsonb_build_object('control_account_id', p_control_account_id,
        'subledger_type', v_binding.subledger_type, 'reason', btrim(p_reason),
        'reference_kind', p_reference_kind,
        'reconciliation_reference', btrim(p_reconciliation_reference)));
  end if;
  return v_transaction_id;
end;
$$;

-- Production providers deliberately remain unavailable until the real AR/AP
-- modules own authoritative dated balances. Focused tests may replace this
-- private function inside a rolled-back transaction to verify the calculation.
create function app.control_subledger_balance(
  p_organization_id uuid,
  p_control_account_id uuid,
  p_subledger_type public.control_subledger_type,
  p_as_of_date date
)
returns table (provider_available boolean, balance_minor bigint, provider_reference text)
language sql stable security definer set search_path = '' as $$
  select false, null::bigint, 'not_implemented'::text;
$$;

create function public.reconcile_control_accounts(
  p_organization_id uuid,
  p_as_of_date date
)
returns table (
  control_account_id uuid,
  account_code text,
  account_name text,
  subledger_type public.control_subledger_type,
  as_of_date date,
  gl_balance_minor bigint,
  subledger_balance_minor bigint,
  variance_minor bigint,
  status public.control_reconciliation_status,
  provider_reference text,
  explanation_reason text,
  explanation_reference text,
  explanation_actor_id uuid,
  explanation_created_at timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform app.require_capability(p_organization_id, 'controls.reconcile');
  if p_as_of_date is null or not isfinite(p_as_of_date) then
    raise exception 'INVALID_RECONCILIATION_DATE' using errcode = '22023';
  end if;
  return query
  select account.id, account.code, account.name, binding.subledger_type,
    p_as_of_date,
    gl.balance_minor,
    provider.balance_minor,
    case when provider.provider_available then gl.balance_minor - provider.balance_minor end,
    case
      when not provider.provider_available then 'provider_unavailable'::public.control_reconciliation_status
      when gl.balance_minor = provider.balance_minor then 'reconciled'::public.control_reconciliation_status
      when explanation.id is not null then 'explained_variance'::public.control_reconciliation_status
      else 'unreconciled'::public.control_reconciliation_status
    end,
    provider.provider_reference,
    explanation.reason,
    explanation.reconciliation_reference,
    explanation.created_by,
    explanation.created_at
  from public.control_account_bindings binding
  join public.accounts account on account.id = binding.account_id
  cross join lateral (
    select (case when account.normal_balance = 'debit'
      then coalesce(sum(entry.base_amount_minor) filter (where entry.side = 'debit'), 0)
         - coalesce(sum(entry.base_amount_minor) filter (where entry.side = 'credit'), 0)
      else coalesce(sum(entry.base_amount_minor) filter (where entry.side = 'credit'), 0)
         - coalesce(sum(entry.base_amount_minor) filter (where entry.side = 'debit'), 0)
    end)::bigint as balance_minor
    from public.transaction_entries entry
    where entry.account_id = account.id and entry.posted_at is not null
      and entry.entry_date <= p_as_of_date
  ) gl
  cross join lateral app.control_subledger_balance(
    p_organization_id, account.id, binding.subledger_type, p_as_of_date
  ) provider
  left join lateral (
    select evidence.* from public.control_variance_explanations evidence
    where evidence.organization_id = p_organization_id
      and evidence.control_account_id = account.id
      and evidence.as_of_date = p_as_of_date
    order by evidence.created_at desc, evidence.id desc limit 1
  ) explanation on true
  where binding.organization_id = p_organization_id
  order by account.code nulls last, account.name, account.id;
end;
$$;

create function public.explain_control_variance(
  p_organization_id uuid,
  p_control_account_id uuid,
  p_as_of_date date,
  p_reason text,
  p_reference_kind public.control_reference_kind,
  p_reconciliation_reference text
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_row record; v_id uuid;
begin
  perform app.require_capability(p_organization_id, 'controls.explain_variance');
  if nullif(btrim(p_reason), '') is null
     or p_reference_kind is null
     or nullif(btrim(p_reconciliation_reference), '') is null then
    raise exception 'INVALID_VARIANCE_EXPLANATION: reason and reference are required'
      using errcode = '22023';
  end if;
  select * into v_row from public.reconcile_control_accounts(p_organization_id, p_as_of_date)
  where control_account_id = p_control_account_id;
  if not found then
    raise exception 'TENANT_ACCESS_DENIED: Control account not found' using errcode = '42501';
  end if;
  if v_row.status = 'provider_unavailable' then
    raise exception 'CONTROL_PROVIDER_UNAVAILABLE: no authoritative subledger balance exists'
      using errcode = '55000';
  end if;
  if v_row.variance_minor = 0 then
    raise exception 'CONTROL_VARIANCE_ZERO: no variance requires explanation'
      using errcode = '22023';
  end if;
  insert into public.control_variance_explanations (
    organization_id, control_account_id, as_of_date, reason,
    reference_kind, reconciliation_reference, created_by
  ) values (
    p_organization_id, p_control_account_id, p_as_of_date, btrim(p_reason),
    p_reference_kind, btrim(p_reconciliation_reference), auth.uid()
  ) returning id into v_id;
  perform app.write_audit(p_organization_id, 'control_variance.explained',
    'control_account', p_control_account_id, null,
    jsonb_build_object('as_of_date', p_as_of_date, 'reason', btrim(p_reason),
      'reference_kind', p_reference_kind,
      'reconciliation_reference', btrim(p_reconciliation_reference),
      'variance_minor', v_row.variance_minor));
  return v_id;
end;
$$;

create or replace view public.account_balances
with (security_invoker = true) as
select
  a.organization_id, a.id as account_id, a.code, a.name, a.type, a.subtype,
  a.normal_balance, a.currency, a.is_liquid, a.is_archived, a.parent_account_id,
  coalesce(sum(e.base_amount_minor) filter (where e.side = 'debit'), 0)::bigint as debit_minor,
  coalesce(sum(e.base_amount_minor) filter (where e.side = 'credit'), 0)::bigint as credit_minor,
  (case when a.normal_balance = 'debit'
    then coalesce(sum(e.base_amount_minor) filter (where e.side = 'debit'), 0)
       - coalesce(sum(e.base_amount_minor) filter (where e.side = 'credit'), 0)
    else coalesce(sum(e.base_amount_minor) filter (where e.side = 'credit'), 0)
       - coalesce(sum(e.base_amount_minor) filter (where e.side = 'debit'), 0)
   end)::bigint as balance_minor,
  count(e.id) as entry_count, a.contra_account_id, a.is_system,
  (coalesce(sum(e.base_amount_minor) filter (where e.side = 'debit'), 0)
    - coalesce(sum(e.base_amount_minor) filter (where e.side = 'credit'), 0))::text as net_debit_minor,
  ((case when a.type in ('asset', 'expense') then 1 else -1 end)
    * (coalesce(sum(e.base_amount_minor) filter (where e.side = 'debit'), 0)
       - coalesce(sum(e.base_amount_minor) filter (where e.side = 'credit'), 0)))::text as statement_balance_minor,
  exists (select 1 from public.transaction_entries history where history.account_id = a.id) as classification_locked,
  a.account_role,
  binding.subledger_type as control_subledger_type,
  (a.account_role = 'control' and exists (
    select 1 from public.transaction_entries history where history.account_id = a.id
  )) as control_binding_locked
from public.accounts a
left join public.control_account_bindings binding on binding.account_id = a.id
left join public.transaction_entries e on e.account_id = a.id and e.posted_at is not null
group by a.organization_id, a.id, binding.subledger_type;

create or replace function public.report_trial_balance(
  p_organization_id uuid, p_from_date date, p_to_date date
)
returns table (
  account_id uuid, code text, name text, type public.account_type,
  parent_account_id uuid, account_role text, normal_balance public.normal_balance,
  contra_account_id uuid, opening_debit_minor text, opening_credit_minor text,
  period_debit_minor text, period_credit_minor text,
  closing_debit_minor text, closing_credit_minor text
)
language plpgsql stable set search_path = '' as $$
begin
  perform app.require_capability(p_organization_id, 'reports.read');
  if p_from_date is null or p_to_date is null or not isfinite(p_from_date)
     or not isfinite(p_to_date) or p_from_date > p_to_date then
    raise exception 'INVALID_DATE_RANGE' using errcode = '22023';
  end if;
  return query
  with movements as (
    select a.id, a.code, a.name, a.type, a.parent_account_id, a.account_role,
      a.normal_balance, a.contra_account_id,
      coalesce(sum(case when entry.entry_date < p_from_date
        then case when entry.side = 'debit' then entry.base_amount_minor else -entry.base_amount_minor end
        else 0 end), 0)::bigint as opening_net,
      coalesce(sum(entry.base_amount_minor) filter (
        where entry.entry_date between p_from_date and p_to_date and entry.side = 'debit'), 0)::bigint as period_debit,
      coalesce(sum(entry.base_amount_minor) filter (
        where entry.entry_date between p_from_date and p_to_date and entry.side = 'credit'), 0)::bigint as period_credit,
      count(entry.id) as entry_count
    from public.accounts a
    left join public.transaction_entries entry
      on entry.organization_id = a.organization_id and entry.account_id = a.id
     and entry.posted_at is not null and entry.entry_date <= p_to_date
    where a.organization_id = p_organization_id
      and a.account_role in ('posting', 'control')
    group by a.id
  ), balances as (
    select movement.*,
      (movement.opening_net + movement.period_debit - movement.period_credit)::bigint as closing_net
    from movements movement where movement.entry_count > 0
  )
  select balance.id, balance.code, balance.name, balance.type,
    balance.parent_account_id, balance.account_role, balance.normal_balance,
    balance.contra_account_id, greatest(balance.opening_net, 0)::text,
    greatest(-balance.opening_net, 0)::text, balance.period_debit::text,
    balance.period_credit::text, greatest(balance.closing_net, 0)::text,
    greatest(-balance.closing_net, 0)::text
  from balances balance order by balance.code nulls last, balance.name, balance.id;
end;
$$;
comment on function public.report_trial_balance(uuid,date,date) is
  'Six-column Trial Balance over real Posting and Control GL balances. Structural Group accounts remain excluded so hierarchy totals cannot double count.';

create or replace function public.read_account_activity(
  p_organization_id uuid, p_account_id uuid,
  p_from_date date default null, p_to_date date default null,
  p_offset integer default 0, p_limit integer default 25
) returns jsonb language plpgsql stable set search_path = '' as $$
declare
  v_account public.accounts%rowtype; v_from date; v_to date;
  v_opening numeric; v_debits numeric; v_credits numeric; v_count bigint; v_rows jsonb;
begin
  perform app.require_capability(p_organization_id, 'accounts.read');
  perform app.require_capability(p_organization_id, 'reports.read');
  perform app.require_capability(p_organization_id, 'transactions.read');
  v_to := coalesce(p_to_date, app.org_today(p_organization_id));
  v_from := coalesce(p_from_date, date_trunc('year', v_to)::date);
  if not isfinite(v_from) or not isfinite(v_to) or v_from > v_to then
    raise exception 'INVALID_DATE_RANGE' using errcode = '22023';
  end if;
  if p_offset is null or p_offset < 0 or p_limit is null or p_limit not between 1 and 100 then
    raise exception 'INVALID_INPUT: invalid activity page' using errcode = '22023';
  end if;
  select * into v_account from public.accounts
  where id = p_account_id and organization_id = p_organization_id;
  if not found then raise exception 'TENANT_ACCESS_DENIED' using errcode = '42501'; end if;
  if v_account.account_role = 'group' then
    raise exception 'INVALID_ACCOUNT: group has no direct ledger' using errcode = '22023';
  end if;
  select coalesce(sum(case when entry.side='debit' then entry.base_amount_minor else -entry.base_amount_minor end)
      filter(where entry.entry_date < v_from),0),
    coalesce(sum(entry.base_amount_minor) filter(where entry.entry_date >= v_from and entry.side='debit'),0),
    coalesce(sum(entry.base_amount_minor) filter(where entry.entry_date >= v_from and entry.side='credit'),0),
    count(*) filter(where entry.entry_date >= v_from)
  into v_opening,v_debits,v_credits,v_count
  from public.transaction_entries entry
  where entry.organization_id=p_organization_id and entry.account_id=p_account_id
    and entry.posted_at is not null and entry.entry_date <= v_to;
  select coalesce(jsonb_agg(to_jsonb(page) - 'created_at'
      order by page.entry_date,page.created_at,page.entry_id),'[]'::jsonb)
  into v_rows from (
    select entry.id as entry_id,entry.transaction_id,entry.entry_date,entry.created_at,
      transaction.reference,transaction.description,entry.memo,
      transaction.type as transaction_type,transaction.reverses_transaction_id,
      transaction.reversed_by_transaction_id,
      (case when entry.side='debit' then entry.base_amount_minor else 0 end)::text as debit_minor,
      (case when entry.side='credit' then entry.base_amount_minor else 0 end)::text as credit_minor,
      (v_opening + sum(case when entry.side='debit' then entry.base_amount_minor else -entry.base_amount_minor end)
        over(order by entry.entry_date,entry.created_at,entry.id rows between unbounded preceding and current row))::text as balance_minor
    from public.transaction_entries entry
    join public.transactions transaction on transaction.id=entry.transaction_id
      and transaction.organization_id=entry.organization_id
    where entry.organization_id=p_organization_id and entry.account_id=p_account_id
      and entry.posted_at is not null and entry.entry_date between v_from and v_to
    order by entry.entry_date,entry.created_at,entry.id limit p_limit offset p_offset
  ) page;
  return jsonb_build_object('account',jsonb_build_object('id',v_account.id,'name',v_account.name,
    'code',v_account.code,'type',v_account.type,'normal_balance',v_account.normal_balance,
    'account_role',v_account.account_role,'is_archived',v_account.is_archived),
    'currency',app.org_base_currency(p_organization_id),'from_date',v_from,'to_date',v_to,
    'opening_minor',v_opening::text,'debit_minor',v_debits::text,'credit_minor',v_credits::text,
    'closing_minor',(v_opening+v_debits-v_credits)::text,'total',v_count,'offset',p_offset,
    'limit',p_limit,'rows',v_rows);
end;
$$;

revoke all on table public.control_account_bindings,
  public.control_adjustments, public.control_variance_explanations from anon;
revoke insert, update, delete on table public.control_account_bindings,
  public.control_adjustments, public.control_variance_explanations from authenticated;
revoke all on function app.reject_control_evidence_change(),
  app.validate_control_binding(), app.control_posting_context_matches(uuid,uuid),
  app.begin_control_posting(uuid,uuid,public.control_subledger_type,text,date,text),
  app.end_control_posting(),
  app.control_subledger_balance(uuid,uuid,public.control_subledger_type,date)
from public, anon, authenticated;
revoke all on function public.create_account(
  uuid,text,public.account_type,public.account_subtype,char,text,uuid,
  public.normal_balance,uuid,text,public.control_subledger_type
), public.create_control_adjustment(
  uuid,uuid,date,jsonb,text,text,public.control_reference_kind,text,text,char,numeric
), public.reconcile_control_accounts(uuid,date), public.explain_control_variance(
  uuid,uuid,date,text,public.control_reference_kind,text
) from public, anon;
grant execute on function public.create_account(
  uuid,text,public.account_type,public.account_subtype,char,text,uuid,
  public.normal_balance,uuid,text,public.control_subledger_type
), public.create_control_adjustment(
  uuid,uuid,date,jsonb,text,text,public.control_reference_kind,text,text,char,numeric
), public.reconcile_control_accounts(uuid,date), public.explain_control_variance(
  uuid,uuid,date,text,public.control_reference_kind,text
) to authenticated, service_role;

analyze public.accounts;
analyze public.control_account_bindings;
