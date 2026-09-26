-- V2-IMP-013 / V2-D11: bounded Egyptian VAT accounting.
-- This migration intentionally supports only explicitly registered Egyptian
-- organizations and standard domestic taxable supplies. It does not implement
-- registration-liability decisions, exemptions, zero rating, table tax,
-- reverse charge, foreign currency, refunds, filing, e-invoicing or e-receipts.

create type public.vat_direction as enum ('output', 'input');
create type public.vat_document_kind as enum ('invoice', 'credit', 'reversal');

create table public.vat_regulatory_rules (
  id uuid primary key default gen_random_uuid(),
  jurisdiction_code char(2) not null check (jurisdiction_code = 'EG'),
  code text not null check (code = 'EG_STANDARD_DOMESTIC'),
  name_en text not null,
  name_ar text not null,
  rate_basis_points integer not null check (rate_basis_points > 0 and rate_basis_points <= 10000),
  effective_from date not null check (isfinite(effective_from)),
  effective_to date check (effective_to is null or (isfinite(effective_to) and effective_to >= effective_from)),
  evidence_verified_on date not null check (isfinite(evidence_verified_on)),
  evidence_uri text not null check (length(btrim(evidence_uri)) > 0),
  scope_note text not null,
  unique (jurisdiction_code, code, effective_from)
);

insert into public.vat_regulatory_rules (
  jurisdiction_code, code, name_en, name_ar, rate_basis_points,
  effective_from, evidence_verified_on, evidence_uri, scope_note
) values (
  'EG', 'EG_STANDARD_DOMESTIC', 'Egypt standard domestic VAT 14%', 'ضريبة القيمة المضافة المصرية القياسية ١٤٪',
  1400, date '2017-07-01', date '2026-09-25',
  'https://portal.eta.gov.eg/ar/content/qwanyn-aldrybt-ly-alqymt-almdaft',
  'Explicitly VAT-registered organizations; standard domestic taxable supplies only.'
);

create table public.organization_vat_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  jurisdiction_code char(2) not null check (jurisdiction_code = 'EG'),
  registration_number text not null check (length(btrim(registration_number)) between 3 and 64),
  effective_from date not null check (isfinite(effective_from)),
  output_vat_account_id uuid not null,
  input_vat_account_id uuid not null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (id, organization_id),
  unique (organization_id, effective_from),
  foreign key (output_vat_account_id, organization_id) references public.accounts(id, organization_id) on delete restrict,
  foreign key (input_vat_account_id, organization_id) references public.accounts(id, organization_id) on delete restrict,
  check (output_vat_account_id <> input_vat_account_id)
);
comment on table public.organization_vat_profiles is
  'Append-only, effective-dated evidence of an explicitly VAT-registered Egyptian organization and its designated VAT-control GL accounts.';

create table public.vat_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  profile_id uuid not null,
  regulatory_rule_id uuid not null references public.vat_regulatory_rules(id) on delete restrict,
  direction public.vat_direction not null,
  kind public.vat_document_kind not null,
  document_date date not null check (isfinite(document_date)),
  tax_point_date date not null check (isfinite(tax_point_date)),
  reference text not null check (length(btrim(reference)) > 0),
  counterparty_id uuid,
  base_account_id uuid not null,
  gross_account_id uuid not null,
  tax_account_id uuid not null,
  taxable_base_minor bigint not null check (taxable_base_minor > 0),
  tax_minor bigint not null check (tax_minor > 0),
  gross_minor bigint not null check (gross_minor = taxable_base_minor + tax_minor),
  rate_basis_points integer not null check (rate_basis_points > 0),
  input_eligible boolean not null default false,
  reason text,
  adjusts_document_id uuid unique,
  transaction_id uuid not null unique,
  idempotency_key text not null check (length(btrim(idempotency_key)) > 0),
  request_payload jsonb not null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (id, organization_id),
  unique (organization_id, idempotency_key),
  foreign key (profile_id, organization_id) references public.organization_vat_profiles(id, organization_id) on delete restrict,
  foreign key (counterparty_id, organization_id) references public.counterparties(id, organization_id) on delete restrict,
  foreign key (base_account_id, organization_id) references public.accounts(id, organization_id) on delete restrict,
  foreign key (gross_account_id, organization_id) references public.accounts(id, organization_id) on delete restrict,
  foreign key (tax_account_id, organization_id) references public.accounts(id, organization_id) on delete restrict,
  foreign key (adjusts_document_id, organization_id) references public.vat_documents(id, organization_id) on delete restrict,
  foreign key (transaction_id, organization_id) references public.transactions(id, organization_id) on delete restrict,
  check ((kind = 'invoice') = (adjusts_document_id is null)),
  check (kind = 'invoice' or nullif(btrim(reason), '') is not null),
  check ((direction = 'input') = input_eligible)
);
create index vat_documents_report_idx on public.vat_documents(organization_id, tax_point_date, direction);
create index vat_documents_adjustment_idx on public.vat_documents(adjusts_document_id);
comment on table public.vat_documents is
  'Immutable source-to-VAT-to-GL evidence. Rate, accounts and exact rounded amounts are copied at posting and never recalculated.';

insert into public.capabilities(key, domain, description) values
  ('tax.read', 'tax', 'Read scoped VAT configuration, documents and reconciliation'),
  ('tax.configure', 'tax', 'Record effective-dated VAT registration and control-account mappings'),
  ('tax.post', 'tax', 'Post standard domestic output and eligible input VAT documents'),
  ('tax.adjust', 'tax', 'Post linked VAT credit notes'),
  ('tax.reverse', 'tax', 'Reverse VAT documents append-only')
on conflict do nothing;
insert into public.role_capabilities(role, capability_key)
select r.role::public.organization_role, c.key
from (values ('owner'), ('admin'), ('accountant')) r(role)
cross join public.capabilities c
where c.domain = 'tax' and (c.key <> 'tax.configure' or r.role in ('owner', 'admin'))
on conflict do nothing;
insert into public.role_capabilities(role, capability_key) values ('viewer', 'tax.read') on conflict do nothing;

alter table public.vat_regulatory_rules enable row level security;
alter table public.organization_vat_profiles enable row level security;
alter table public.vat_documents enable row level security;
create policy vat_rules_read on public.vat_regulatory_rules for select to authenticated using (true);
create policy vat_profiles_read on public.organization_vat_profiles for select to authenticated
  using (app.has_capability(organization_id, 'tax.read'));
create policy vat_documents_read on public.vat_documents for select to authenticated
  using (app.has_capability(organization_id, 'tax.read'));
revoke all on public.vat_regulatory_rules, public.organization_vat_profiles, public.vat_documents from public, anon, authenticated;
grant select on public.vat_regulatory_rules, public.organization_vat_profiles, public.vat_documents to authenticated;

create function app.reject_vat_evidence_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  raise exception 'IMMUTABLE_VAT_EVIDENCE: VAT configuration and documents are append-only' using errcode = '55000';
end;
$$;
create trigger vat_rules_immutable before update or delete on public.vat_regulatory_rules
  for each row execute function app.reject_vat_evidence_change();
create trigger vat_profiles_immutable before update or delete on public.organization_vat_profiles
  for each row execute function app.reject_vat_evidence_change();
create trigger vat_documents_immutable before update or delete on public.vat_documents
  for each row execute function app.reject_vat_evidence_change();

create function app.round_vat_minor(p_taxable_base_minor bigint, p_rate_basis_points integer)
returns bigint language sql immutable strict set search_path = '' as $$
  select round((p_taxable_base_minor::numeric * p_rate_basis_points::numeric) / 10000)::bigint;
$$;
comment on function app.round_vat_minor(bigint, integer) is
  'Rounds once at the whole-document EGP minor-unit boundary; line-level and intermediate rounding are outside V2-D11 scope.';

create function app.guard_vat_control_entry()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_context text;
begin
  if not exists (
    select 1 from public.organization_vat_profiles p
    where p.organization_id = new.organization_id
      and new.account_id in (p.output_vat_account_id, p.input_vat_account_id)
  ) then return new; end if;
  v_context := current_setting('app.vat_post_context', true);
  if v_context is null or v_context <> new.organization_id::text then
    raise exception 'VAT_CONTROL_ACCOUNT_RESTRICTED: use the VAT document command' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger transaction_entries_guard_vat_control
  before insert or update on public.transaction_entries
  for each row execute function app.guard_vat_control_entry();

create function public.configure_egypt_vat(
  p_organization_id uuid, p_registration_number text, p_effective_from date,
  p_output_vat_account_id uuid, p_input_vat_account_id uuid
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid := gen_random_uuid(); v_output public.accounts%rowtype; v_input public.accounts%rowtype;
begin
  perform app.require_capability(p_organization_id, 'tax.configure');
  if app.org_base_currency(p_organization_id) <> 'EGP' or p_effective_from is null or not isfinite(p_effective_from)
    or nullif(btrim(p_registration_number), '') is null or p_output_vat_account_id = p_input_vat_account_id then
    raise exception 'VAT_SCOPE_INVALID: Egypt/EGP registration and distinct accounts are required' using errcode = '22023';
  end if;
  v_output := app.require_account(p_organization_id, p_output_vat_account_id, array['liability']::public.account_type[]);
  v_input := app.require_account(p_organization_id, p_input_vat_account_id, array['asset']::public.account_type[]);
  if v_output.account_role <> 'posting' or v_output.subtype <> 'taxes_payable' or v_output.currency <> 'EGP'
    or v_input.account_role <> 'posting' or v_input.currency <> 'EGP' then
    raise exception 'VAT_CONTROL_ACCOUNT_INVALID: output must be posting/taxes payable and input must be a posting asset in EGP' using errcode = '23514';
  end if;
  if exists (select 1 from public.transaction_entries e where e.organization_id = p_organization_id
    and e.account_id in (p_output_vat_account_id, p_input_vat_account_id)
    and not exists (select 1 from public.organization_vat_profiles prior where prior.organization_id=p_organization_id
      and e.account_id in (prior.output_vat_account_id,prior.input_vat_account_id))) then
    raise exception 'VAT_CONTROL_ACCOUNT_HAS_HISTORY: designate unused accounts so source and GL can reconcile exactly' using errcode = '23514';
  end if;
  if exists (select 1 from public.organization_vat_profiles p where p.organization_id = p_organization_id
    and p.effective_from >= p_effective_from) then
    raise exception 'VAT_PROFILE_DATE_INVALID: append a later effective profile' using errcode = '23514';
  end if;
  if exists (select 1 from public.organization_vat_profiles p where p.organization_id=p_organization_id
    and (p.output_vat_account_id=p_input_vat_account_id or p.input_vat_account_id=p_output_vat_account_id)) then
    raise exception 'VAT_CONTROL_DIRECTION_IMMUTABLE: an account cannot switch between output and input VAT' using errcode='23514';
  end if;
  insert into public.organization_vat_profiles(id, organization_id, jurisdiction_code, registration_number,
    effective_from, output_vat_account_id, input_vat_account_id, created_by)
  values (v_id, p_organization_id, 'EG', btrim(p_registration_number), p_effective_from,
    p_output_vat_account_id, p_input_vat_account_id, auth.uid());
  perform app.write_audit(p_organization_id, 'vat.profile_configured', 'organization_vat_profile', v_id, null,
    jsonb_build_object('effective_from', p_effective_from, 'jurisdiction', 'EG'));
  return v_id;
end;
$$;

create function public.post_egypt_vat_document(
  p_organization_id uuid, p_direction public.vat_direction, p_kind public.vat_document_kind,
  p_document_date date, p_tax_point_date date, p_reference text,
  p_taxable_base_minor bigint, p_base_account_id uuid, p_gross_account_id uuid,
  p_idempotency_key text, p_counterparty_id uuid default null,
  p_input_eligible boolean default false, p_reason text default null,
  p_adjusts_document_id uuid default null, p_rule_code text default 'EG_STANDARD_DOMESTIC'
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid := gen_random_uuid(); v_existing public.vat_documents%rowtype;
  v_original public.vat_documents%rowtype; v_profile public.organization_vat_profiles%rowtype;
  v_rule public.vat_regulatory_rules%rowtype; v_base public.accounts%rowtype; v_gross public.accounts%rowtype;
  v_tax_account uuid; v_tax bigint; v_gross_minor bigint; v_lines jsonb; v_transaction uuid;
  v_payload jsonb; v_capability text;
begin
  v_capability := case p_kind when 'invoice' then 'tax.post' when 'credit' then 'tax.adjust' when 'reversal' then 'tax.reverse' end;
  perform app.require_capability(p_organization_id, v_capability);
  perform app.require_capability(p_organization_id, 'transactions.post');
  if p_kind = 'reversal' then perform app.require_capability(p_organization_id, 'transactions.reverse');
  else perform app.require_capability(p_organization_id, 'transactions.create'); end if;
  if p_kind = 'credit' then perform app.require_capability(p_organization_id, 'transactions.adjust'); end if;
  if p_document_date is null or not isfinite(p_document_date) or p_tax_point_date is null or not isfinite(p_tax_point_date)
    or p_taxable_base_minor is null or p_taxable_base_minor <= 0 or nullif(btrim(p_reference), '') is null
    or nullif(btrim(p_idempotency_key), '') is null or (p_direction = 'input') <> p_input_eligible
    or (p_kind = 'invoice') <> (p_adjusts_document_id is null)
    or (p_kind <> 'invoice' and nullif(btrim(p_reason), '') is null) then
    raise exception 'VAT_DOCUMENT_INVALID' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('vat:' || p_organization_id::text, 0));
  v_payload := jsonb_build_object('direction', p_direction, 'kind', p_kind, 'document_date', p_document_date,
    'tax_point_date', p_tax_point_date, 'reference', btrim(p_reference), 'base', p_taxable_base_minor::text,
    'base_account', p_base_account_id, 'gross_account', p_gross_account_id, 'counterparty', p_counterparty_id,
    'input_eligible', p_input_eligible, 'reason', nullif(btrim(p_reason), ''), 'adjusts', p_adjusts_document_id, 'rule', p_rule_code);
  select * into v_existing from public.vat_documents
    where organization_id = p_organization_id and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.request_payload <> v_payload then raise exception 'IDEMPOTENCY_CONFLICT: key was already used for a different request' using errcode = '23505'; end if;
    return v_existing.id;
  end if;
  select * into v_profile from public.organization_vat_profiles p
    where p.organization_id = p_organization_id and p.effective_from <= p_tax_point_date
    order by p.effective_from desc limit 1;
  if not found then raise exception 'VAT_REGISTRATION_REQUIRED: no explicit effective registration profile' using errcode = '23514'; end if;
  select * into v_rule from public.vat_regulatory_rules r
    where r.jurisdiction_code = v_profile.jurisdiction_code and r.code = p_rule_code
      and r.effective_from <= p_tax_point_date and (r.effective_to is null or r.effective_to >= p_tax_point_date)
    order by r.effective_from desc limit 1;
  if not found then raise exception 'VAT_RULE_NOT_EFFECTIVE' using errcode = '23514'; end if;
  if app.org_base_currency(p_organization_id) <> 'EGP' then raise exception 'VAT_FOREIGN_CURRENCY_OUT_OF_SCOPE' using errcode = '23514'; end if;
  v_base := app.require_account(p_organization_id, p_base_account_id);
  v_gross := app.require_account(p_organization_id, p_gross_account_id);
  if v_base.account_role <> 'posting' or v_gross.account_role <> 'posting' or v_base.currency <> 'EGP' or v_gross.currency <> 'EGP'
    or (p_direction = 'output' and (v_base.type <> 'revenue' or v_gross.type <> 'asset'))
    or (p_direction = 'input' and (v_base.type not in ('expense', 'asset') or v_gross.type <> 'liability')) then
    raise exception 'VAT_SOURCE_ACCOUNTS_INVALID' using errcode = '23514';
  end if;
  if p_counterparty_id is not null and not exists (select 1 from public.counterparties c
    where c.id = p_counterparty_id and c.organization_id = p_organization_id and not c.is_archived) then
    raise exception 'VAT_COUNTERPARTY_INVALID' using errcode = '23514';
  end if;
  v_tax_account := case p_direction when 'output' then v_profile.output_vat_account_id else v_profile.input_vat_account_id end;
  v_tax := app.round_vat_minor(p_taxable_base_minor, v_rule.rate_basis_points);
  v_gross_minor := p_taxable_base_minor + v_tax;
  if v_tax <= 0 then raise exception 'VAT_AMOUNT_ROUNDS_TO_ZERO' using errcode = '23514'; end if;
  if p_kind <> 'invoice' then
    select * into v_original from public.vat_documents d
      where d.id = p_adjusts_document_id and d.organization_id = p_organization_id for share;
    if not found or v_original.kind <> 'invoice' or exists (select 1 from public.vat_documents d where d.adjusts_document_id = v_original.id)
      or p_tax_point_date < v_original.tax_point_date or p_document_date < v_original.document_date
      or row(p_direction, p_taxable_base_minor, p_base_account_id, p_gross_account_id, v_tax_account)
        is distinct from row(v_original.direction, v_original.taxable_base_minor, v_original.base_account_id, v_original.gross_account_id, v_original.tax_account_id) then
      raise exception 'VAT_ADJUSTMENT_INVALID: only one exact linked credit or reversal is supported' using errcode = '23514';
    end if;
    select * into v_profile from public.organization_vat_profiles where id=v_original.profile_id;
    select * into v_rule from public.vat_regulatory_rules where id=v_original.regulatory_rule_id;
    v_tax_account := v_original.tax_account_id;
    v_tax := v_original.tax_minor; v_gross_minor := v_original.gross_minor;
  end if;
  perform set_config('app.vat_post_context', p_organization_id::text, true);
  if p_kind = 'reversal' then
    v_transaction := public.reverse_transaction(v_original.transaction_id, p_reason, p_tax_point_date);
  else
    if p_direction = 'output' then
      v_lines := jsonb_build_array(
        jsonb_build_object('account_id', p_gross_account_id, 'side', case when p_kind='invoice' then 'debit' else 'credit' end, 'amount_minor', v_gross_minor),
        jsonb_build_object('account_id', p_base_account_id, 'side', case when p_kind='invoice' then 'credit' else 'debit' end, 'amount_minor', p_taxable_base_minor),
        jsonb_build_object('account_id', v_tax_account, 'side', case when p_kind='invoice' then 'credit' else 'debit' end, 'amount_minor', v_tax));
    else
      v_lines := jsonb_build_array(
        jsonb_build_object('account_id', p_base_account_id, 'side', case when p_kind='invoice' then 'debit' else 'credit' end, 'amount_minor', p_taxable_base_minor),
        jsonb_build_object('account_id', v_tax_account, 'side', case when p_kind='invoice' then 'debit' else 'credit' end, 'amount_minor', v_tax),
        jsonb_build_object('account_id', p_gross_account_id, 'side', case when p_kind='invoice' then 'credit' else 'debit' end, 'amount_minor', v_gross_minor));
    end if;
    v_transaction := app.create_and_post(p_organization_id,
      case when p_kind='credit' then 'adjustment'::public.transaction_type
        when p_direction='output' then 'income'::public.transaction_type else 'expense'::public.transaction_type end,
      p_tax_point_date, v_lines, p_currency_code=>'EGP', p_description=>btrim(p_reference),
      p_reference=>btrim(p_reference), p_counterparty_id=>p_counterparty_id, p_adjustment_reason=>p_reason,
      p_source=>'api', p_idempotency_key=>'vat:' || v_id::text,
      p_metadata=>jsonb_build_object('vat_document_id', v_id, 'vat_direction', p_direction, 'vat_kind', p_kind,
        'document_date', p_document_date, 'tax_point_date', p_tax_point_date));
  end if;
  perform set_config('app.vat_post_context', '', true);
  insert into public.vat_documents(id, organization_id, profile_id, regulatory_rule_id, direction, kind,
    document_date, tax_point_date, reference, counterparty_id, base_account_id, gross_account_id, tax_account_id,
    taxable_base_minor, tax_minor, gross_minor, rate_basis_points, input_eligible, reason, adjusts_document_id,
    transaction_id, idempotency_key, request_payload, created_by)
  values (v_id, p_organization_id, v_profile.id, v_rule.id, p_direction, p_kind, p_document_date, p_tax_point_date,
    btrim(p_reference), p_counterparty_id, p_base_account_id, p_gross_account_id, v_tax_account,
    p_taxable_base_minor, v_tax, v_gross_minor, v_rule.rate_basis_points, p_input_eligible,
    nullif(btrim(p_reason), ''), p_adjusts_document_id, v_transaction, p_idempotency_key, v_payload, auth.uid());
  perform app.write_audit(p_organization_id, 'vat.document_posted', 'vat_document', v_id, null,
    jsonb_build_object('direction', p_direction, 'kind', p_kind, 'transaction_id', v_transaction,
      'tax_minor', v_tax::text, 'adjusts', p_adjusts_document_id));
  return v_id;
end;
$$;

create function public.reverse_egypt_vat_document(
  p_organization_id uuid, p_document_id uuid, p_document_date date, p_tax_point_date date,
  p_reason text, p_idempotency_key text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare d public.vat_documents%rowtype;
begin
  perform app.require_capability(p_organization_id, 'tax.reverse');
  select * into d from public.vat_documents where id = p_document_id and organization_id = p_organization_id;
  if not found then raise exception 'VAT_DOCUMENT_NOT_FOUND' using errcode = '42501'; end if;
  return public.post_egypt_vat_document(p_organization_id, d.direction, 'reversal', p_document_date,
    p_tax_point_date, d.reference, d.taxable_base_minor, d.base_account_id, d.gross_account_id,
    p_idempotency_key, d.counterparty_id, d.input_eligible, p_reason, d.id, 'EG_STANDARD_DOMESTIC');
end;
$$;

create function public.read_egypt_vat_report(p_organization_id uuid, p_from_date date, p_to_date date)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb; v_profile public.organization_vat_profiles%rowtype;
begin
  perform app.require_capability(p_organization_id, 'tax.read');
  perform app.require_capability(p_organization_id, 'reports.read');
  if p_from_date is null or p_to_date is null or p_from_date > p_to_date then raise exception 'VAT_REPORT_DATE_INVALID' using errcode='22023'; end if;
  select * into v_profile from public.organization_vat_profiles p where p.organization_id=p_organization_id
    and p.effective_from<=p_to_date order by p.effective_from desc limit 1;
  if not found then raise exception 'VAT_REGISTRATION_REQUIRED' using errcode='23514'; end if;
  with documents as (
    select d.*, case when d.kind='invoice' then 1 else -1 end sign
    from public.vat_documents d where d.organization_id=p_organization_id and d.tax_point_date between p_from_date and p_to_date
  ), source_totals as (
    select coalesce(sum(sign*tax_minor) filter(where direction='output'),0)::bigint output_tax,
      coalesce(sum(sign*tax_minor) filter(where direction='input'),0)::bigint input_tax,
      coalesce(sum(sign*taxable_base_minor) filter(where direction='output'),0)::bigint output_base,
      coalesce(sum(sign*taxable_base_minor) filter(where direction='input'),0)::bigint input_base from documents
  ), gl as (
    select coalesce(sum(case when e.account_id in (select p.output_vat_account_id from public.organization_vat_profiles p where p.organization_id=p_organization_id) then case e.side when 'credit' then e.base_amount_minor else -e.base_amount_minor end else 0 end),0)::bigint output_gl,
      coalesce(sum(case when e.account_id in (select p.input_vat_account_id from public.organization_vat_profiles p where p.organization_id=p_organization_id) then case e.side when 'debit' then e.base_amount_minor else -e.base_amount_minor end else 0 end),0)::bigint input_gl
    from public.transaction_entries e where e.organization_id=p_organization_id and e.posted_at is not null
      and e.entry_date between p_from_date and p_to_date and e.account_id in (
        select p.output_vat_account_id from public.organization_vat_profiles p where p.organization_id=p_organization_id
        union select p.input_vat_account_id from public.organization_vat_profiles p where p.organization_id=p_organization_id)
  )
  select jsonb_build_object('from_date',p_from_date,'to_date',p_to_date,
    'registration_number',v_profile.registration_number,'jurisdiction','EG','currency','EGP',
    'output_tax_minor',s.output_tax::text,'input_tax_minor',s.input_tax::text,
    'net_vat_minor',(s.output_tax-s.input_tax)::text,'output_taxable_base_minor',s.output_base::text,
    'input_taxable_base_minor',s.input_base::text,'output_gl_minor',g.output_gl::text,'input_gl_minor',g.input_gl::text,
    'output_difference_minor',(g.output_gl-s.output_tax)::text,'input_difference_minor',(g.input_gl-s.input_tax)::text,
    'reconciled',(g.output_gl=s.output_tax and g.input_gl=s.input_tax),
    'documents',coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'direction',d.direction,'kind',d.kind,
      'document_date',d.document_date,'tax_point_date',d.tax_point_date,'reference',d.reference,
      'counterparty_id',d.counterparty_id,'base_account_id',d.base_account_id,
      'gross_account_id',d.gross_account_id,'tax_account_id',d.tax_account_id,
      'taxable_base_minor',(d.sign*d.taxable_base_minor)::text,'tax_minor',(d.sign*d.tax_minor)::text,
      'gross_minor',(d.sign*d.gross_minor)::text,'rate_basis_points',d.rate_basis_points,
      'transaction_id',d.transaction_id,'adjusts_document_id',d.adjusts_document_id,'reason',d.reason)
      order by d.tax_point_date,d.created_at) from documents d),'[]'::jsonb)) into result from source_totals s cross join gl g;
  return result;
end;
$$;

create function public.read_egypt_vat_workspace(p_organization_id uuid, p_from_date date, p_to_date date)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  perform app.require_capability(p_organization_id, 'tax.read');
  select jsonb_build_object(
    'profiles',coalesce((select jsonb_agg(to_jsonb(p) order by p.effective_from desc) from public.organization_vat_profiles p where p.organization_id=p_organization_id),'[]'::jsonb),
    'rules',coalesce((select jsonb_agg(to_jsonb(r) order by r.effective_from desc) from public.vat_regulatory_rules r where r.jurisdiction_code='EG'),'[]'::jsonb),
    'accounts',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'code',a.code,'name',a.name,'type',a.type,'subtype',a.subtype,'role',a.account_role,'currency',a.currency,'archived',a.is_archived) order by a.code nulls last,a.name)
      from public.accounts a where a.organization_id=p_organization_id and a.account_role='posting'),'[]'::jsonb),
    'counterparties',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'type',c.type,'archived',c.is_archived) order by c.name) from public.counterparties c where c.organization_id=p_organization_id),'[]'::jsonb),
    'report',case when exists(select 1 from public.organization_vat_profiles p where p.organization_id=p_organization_id)
      then public.read_egypt_vat_report(p_organization_id,p_from_date,p_to_date) else null end) into result;
  return result;
end;
$$;

revoke all on function public.configure_egypt_vat(uuid,text,date,uuid,uuid),
  public.post_egypt_vat_document(uuid,public.vat_direction,public.vat_document_kind,date,date,text,bigint,uuid,uuid,text,uuid,boolean,text,uuid,text),
  public.reverse_egypt_vat_document(uuid,uuid,date,date,text,text),
  public.read_egypt_vat_report(uuid,date,date), public.read_egypt_vat_workspace(uuid,date,date) from public, anon;
grant execute on function public.configure_egypt_vat(uuid,text,date,uuid,uuid),
  public.post_egypt_vat_document(uuid,public.vat_direction,public.vat_document_kind,date,date,text,bigint,uuid,uuid,text,uuid,boolean,text,uuid,text),
  public.reverse_egypt_vat_document(uuid,uuid,date,date,text,text),
  public.read_egypt_vat_report(uuid,date,date), public.read_egypt_vat_workspace(uuid,date,date) to authenticated;
