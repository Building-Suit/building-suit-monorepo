-- LS-FIX-001 / V2-D03: professional journal numbers are allocated at the
-- shared draft -> posted transition. Existing posted references remain
-- untouched; non-posted UUID bridge references are removed.

drop index if exists public.transactions_journal_reference_key;

alter table public.transactions
  alter column journal_reference drop expression;

update public.transactions
set journal_reference = null
where status not in ('posted', 'reversed');

create unique index transactions_org_journal_reference_key
  on public.transactions (organization_id, journal_reference)
  where journal_reference is not null;

alter table public.transactions
  add constraint transactions_journal_reference_posted_only check (
    (status in ('posted', 'reversed') and journal_reference is not null)
    or (status not in ('posted', 'reversed') and journal_reference is null)
  );

comment on column public.transactions.journal_reference is
  'Immutable accountant-facing identity. Existing posted UUID references are preserved. '
  'New journals receive JRN-{fiscal-year-ending-year}-{six-digit sequence} only when posting succeeds.';

create table app.journal_number_sequences (
  organization_id uuid not null
    references public.organizations (id) on delete cascade,
  fiscal_year_start date not null,
  last_number integer not null check (last_number between 1 and 999999),
  primary key (organization_id, fiscal_year_start)
);

comment on table app.journal_number_sequences is
  'Private organization/fiscal-year counters for V2-D03 journal references. '
  'A scope is exhausted after 999999; numbers are never wrapped or reused.';

revoke all on table app.journal_number_sequences from public, anon, authenticated;

create function app.allocate_journal_reference(
  p_organization_id uuid,
  p_transaction_date date
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_fiscal_year_start date;
  v_fiscal_year_end date;
  v_number integer;
begin
  select bounds.fiscal_year_start, bounds.fiscal_year_end
  into v_fiscal_year_start, v_fiscal_year_end
  from app.fiscal_year_bounds(p_organization_id, p_transaction_date) bounds;

  insert into app.journal_number_sequences (
    organization_id, fiscal_year_start, last_number
  )
  values (p_organization_id, v_fiscal_year_start, 1)
  on conflict (organization_id, fiscal_year_start) do update
    set last_number = app.journal_number_sequences.last_number + 1
    where app.journal_number_sequences.last_number < 999999
  returning last_number into v_number;

  if v_number is null then
    raise exception 'JOURNAL_SEQUENCE_EXHAUSTED: organization % fiscal year % has reached 999999',
      p_organization_id, v_fiscal_year_start
      using errcode = '22003';
  end if;

  return 'JRN-'
    || extract(year from v_fiscal_year_end)::integer::text
    || '-'
    || lpad(v_number::text, 6, '0');
end;
$$;

comment on function app.allocate_journal_reference(uuid, date) is
  'Allocates the next organization/fiscal-year journal reference. FY is the '
  'four-digit calendar year in which the configured fiscal year ends. The '
  'counter is capped at 999999 and never wraps.';

revoke all on function app.allocate_journal_reference(uuid, date)
  from public, anon, authenticated;

create function app.assign_posted_journal_reference()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.journal_reference is not null then
      raise exception 'JOURNAL_REFERENCE_MANAGED: journal references are assigned by posting'
        using errcode = '42501';
    end if;

    if new.status = 'posted' then
      new.journal_reference := app.allocate_journal_reference(
        new.organization_id, new.transaction_date
      );
    end if;
    return new;
  end if;

  if old.journal_reference is not null
     and new.journal_reference is distinct from old.journal_reference then
    raise exception 'JOURNAL_REFERENCE_IMMUTABLE: posted journal references cannot be changed'
      using errcode = '42501';
  end if;

  if old.status <> 'posted' and new.status = 'posted' then
    if old.journal_reference is not null or new.journal_reference is not null then
      raise exception 'JOURNAL_REFERENCE_MANAGED: journal references are assigned by posting'
        using errcode = '42501';
    end if;
    new.journal_reference := app.allocate_journal_reference(
      new.organization_id, new.transaction_date
    );
  elsif old.journal_reference is null and new.journal_reference is not null then
    raise exception 'JOURNAL_REFERENCE_MANAGED: journal references are assigned by posting'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function app.assign_posted_journal_reference()
  from public, anon, authenticated;

create trigger transactions_assign_posted_journal_reference
before insert or update on public.transactions
for each row execute function app.assign_posted_journal_reference();
