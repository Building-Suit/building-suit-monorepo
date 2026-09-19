-- Explicit group accounts. Existing accounts, including parents with history,
-- remain posting accounts. No journal or existing account is reclassified.
alter table public.accounts add column account_role text not null default 'posting'
  constraint accounts_role_valid check (account_role in ('posting', 'group'));
alter table public.accounts add constraint accounts_group_not_operational check (
  account_role = 'posting' or (not is_system and system_key is null and contra_account_id is null)
);
comment on column public.accounts.account_role is
  'Immutable role: group organizes the chart and cannot receive entries; existing accounts retain posting role.';

-- PostgreSQL 17 recomputes this stored expression. The result for every existing
-- account is identical because its new role defaults to posting.
alter table public.accounts alter column is_liquid set expression as (
  account_role = 'posting' and subtype in ('cash', 'bank', 'mobile_wallet')
);

create or replace function app.guard_account_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_parent public.accounts%rowtype;
begin
  if tg_op = 'UPDATE' then
    if new.account_role is distinct from old.account_role then
      raise exception 'ACCOUNT_ROLE_IMMUTABLE: create a new account instead of changing historical meaning' using errcode = '23514';
    end if;
    if row(new.type, new.currency) is distinct from row(old.type, old.currency)
       and exists (select 1 from public.accounts c where c.parent_account_id = old.id) then
      raise exception 'ACCOUNT_PARENT_CLASSIFICATION_LOCKED: child accounts depend on this type and currency' using errcode = '23514';
    end if;
  end if;
  if new.contra_account_id is not null and exists (
    select 1 from public.accounts a where a.id = new.contra_account_id
      and a.organization_id = new.organization_id and a.account_role = 'group'
  ) then
    raise exception 'ACCOUNT_GROUP_NOT_POSTABLE: a group cannot be a contra target' using errcode = '23514';
  end if;
  if new.parent_account_id is not null and (tg_op = 'INSERT'
      or row(new.parent_account_id, new.type, new.currency, new.organization_id)
         is distinct from row(old.parent_account_id, old.type, old.currency, old.organization_id)) then
    select * into v_parent from public.accounts a
      where a.id = new.parent_account_id and a.organization_id = new.organization_id for share;
    if not found or v_parent.is_archived or v_parent.type <> new.type or v_parent.currency <> new.currency then
      raise exception 'INVALID_ACCOUNT_PARENT: parent must be active with the same organization, type and currency' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;
create trigger accounts_guard_role before insert or update on public.accounts
  for each row execute function app.guard_account_role();
revoke all on function app.guard_account_role() from public, anon, authenticated;

-- A table trigger covers direct inserts, draft edits and all posting RPCs.
-- Role is immutable, so it cannot race with a first entry or switch after it.
create or replace function app.require_posting_account_reference()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := (to_jsonb(new) ->> tg_argv[0])::uuid;
  v_role text;
begin
  if v_id is null then return new; end if;
  select a.account_role into v_role from public.accounts a
    where a.id = v_id and a.organization_id = new.organization_id;
  -- Preserve the existing composite FK rejection for missing/foreign IDs.
  -- The role check only concerns references within this organization.
  if not found then return new; end if;
  if v_role <> 'posting' then
    raise exception 'ACCOUNT_GROUP_NOT_POSTABLE: choose a posting account' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger transaction_entries_require_posting_account
  before insert or update of account_id, organization_id on public.transaction_entries
  for each row execute function app.require_posting_account_reference('account_id');
create trigger categories_require_posting_account
  before insert or update of default_account_id, organization_id on public.categories
  for each row execute function app.require_posting_account_reference('default_account_id');
revoke all on function app.require_posting_account_reference() from public, anon, authenticated;

-- Replace rather than overload so PostgREST and old named/positional callers
-- keep a single unambiguous RPC. The additional parameter is optional.
drop function public.create_account(uuid, text, public.account_type, public.account_subtype, char, text, uuid, public.normal_balance, uuid);
create or replace function public.create_account(
  p_organization_id uuid,
  p_name text,
  p_type public.account_type,
  p_subtype public.account_subtype,
  p_currency char(3) default null,
  p_code text default null,
  p_parent_account_id uuid default null,
  p_normal_balance public.normal_balance default null,
  p_contra_account_id uuid default null,
  p_account_role text default 'posting'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_system_key text;
begin
  perform app.require_capability(p_organization_id, 'accounts.create');
  if p_name is null or char_length(trim(p_name)) = 0 then
    raise exception 'INVALID_INPUT: account name is required' using errcode = '22023';
  end if;
  if p_parent_account_id is not null then
    perform 1 from public.accounts a where a.id = p_parent_account_id
      and a.organization_id = p_organization_id and not a.is_archived;
    if not found then
      raise exception 'INVALID_ACCOUNT_PARENT: choose an active parent in this organization' using errcode = '23514';
    end if;
  end if;

  if p_account_role = 'posting' and p_subtype::text in (
    'bank_fees', 'interest_expense', 'owner_capital', 'owner_drawings',
    'opening_balance_equity'
  ) and not exists (
    select 1 from public.accounts a
    where a.organization_id = p_organization_id
      and a.system_key = p_subtype::text
  ) then
    v_system_key := p_subtype::text;
  end if;

  insert into public.accounts (
    organization_id, code, name, type, subtype, currency,
    parent_account_id, system_key, created_by, normal_balance, contra_account_id, account_role
  ) values (
    p_organization_id, nullif(trim(p_code), ''), trim(p_name), p_type,
    p_subtype, coalesce(p_currency, app.org_base_currency(p_organization_id)),
    p_parent_account_id, v_system_key, auth.uid(), p_normal_balance, p_contra_account_id, p_account_role
  ) returning id into v_id;

  if p_account_role = 'posting' and p_type in ('revenue', 'expense') then
    insert into public.categories (
      organization_id, name, kind, default_account_id, created_by
    ) values (
      p_organization_id,
      trim(p_name),
      case when p_type = 'revenue'
        then 'income'::public.category_kind
        else 'expense'::public.category_kind
      end,
      v_id,
      auth.uid()
    )
    on conflict (organization_id, lower(name)) do update
      set default_account_id = excluded.default_account_id,
          kind = excluded.kind,
          is_active = true;
  end if;

  perform app.write_audit(p_organization_id, 'account.created', 'account', v_id,
    null, jsonb_build_object('name', trim(p_name), 'type', p_type, 'subtype', p_subtype,
      'normal_balance', (select a.normal_balance from public.accounts a where a.id = v_id),
      'contra_account_id', p_contra_account_id, 'account_role', p_account_role,
      'parent_account_id', p_parent_account_id));
  return v_id;
end;
$$;

create or replace function app.require_account(
  p_organization_id uuid,
  p_account_id      uuid,
  p_expected_types  public.account_type[] default null,
  p_label           text default 'account'
)
returns public.accounts
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_account public.accounts%rowtype;
begin
  if p_account_id is null then
    raise exception 'INVALID_ACCOUNT: % is required', p_label
      using errcode = '22023';
  end if;

  select * into v_account
  from public.accounts a
  where a.id = p_account_id;

  -- Same message whether the account is missing or owned by another tenant, so
  -- the response cannot be used to probe for foreign ids.
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
      p_label, p_expected_types, v_account.type
      using errcode = '22023';
  end if;

  if v_account.account_role <> 'posting' then
    raise exception 'ACCOUNT_GROUP_NOT_POSTABLE: choose a posting account' using errcode = '23514';
  end if;

  return v_account;
end;
$$;


create or replace view public.account_balances
with (security_invoker = true) as
select
  a.organization_id,
  a.id                as account_id,
  a.code,
  a.name,
  a.type,
  a.subtype,
  a.normal_balance,
  a.currency,
  a.is_liquid,
  a.is_archived,
  a.parent_account_id,
  coalesce(sum(e.base_amount_minor) filter (where e.side = 'debit'), 0)::bigint  as debit_minor,
  coalesce(sum(e.base_amount_minor) filter (where e.side = 'credit'), 0)::bigint as credit_minor,
  -- Signed so that a positive number always means "more of what this account
  -- normally holds", which is what a non-accountant expects to see.
  (case when a.normal_balance = 'debit'
        then coalesce(sum(e.base_amount_minor) filter (where e.side = 'debit'), 0)
           - coalesce(sum(e.base_amount_minor) filter (where e.side = 'credit'), 0)
        else coalesce(sum(e.base_amount_minor) filter (where e.side = 'credit'), 0)
           - coalesce(sum(e.base_amount_minor) filter (where e.side = 'debit'), 0)
   end)::bigint as balance_minor,
  count(e.id) as entry_count,
  a.contra_account_id,
  a.is_system,
  (coalesce(sum(e.base_amount_minor) filter (where e.side = 'debit'), 0)
    - coalesce(sum(e.base_amount_minor) filter (where e.side = 'credit'), 0))::text as net_debit_minor,
  ((case when a.type in ('asset', 'expense') then 1 else -1 end)
    * (coalesce(sum(e.base_amount_minor) filter (where e.side = 'debit'), 0)
       - coalesce(sum(e.base_amount_minor) filter (where e.side = 'credit'), 0)))::text as statement_balance_minor,
  exists (select 1 from public.transaction_entries history where history.account_id = a.id) as classification_locked,
  a.account_role
from public.accounts a
left join public.transaction_entries e
  on e.account_id = a.id
 and e.posted_at is not null
group by a.organization_id, a.id;




revoke all on function public.create_account(uuid, text, public.account_type, public.account_subtype, char, text, uuid, public.normal_balance, uuid, text) from public, anon;
grant execute on function public.create_account(uuid, text, public.account_type, public.account_subtype, char, text, uuid, public.normal_balance, uuid, text) to authenticated, service_role;
analyze public.accounts;
