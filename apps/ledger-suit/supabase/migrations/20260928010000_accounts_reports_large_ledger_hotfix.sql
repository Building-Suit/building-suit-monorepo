-- LS-PERF-003: bounded Accounts and financial-report reads for large ledgers.
-- Exact posted-ledger results remain authoritative. This migration does not
-- change statement_timeout, table RLS, financial history, or write contracts.

create index if not exists transaction_entries_org_account_history_idx
  on public.transaction_entries (organization_id, account_id);

-- The Accounts screen needs every account, including zero-balance and archived
-- rows, but it must not expand the generic security-invoker aggregate view.
-- Authorize once, scope both entry aggregates explicitly, and retain the exact
-- account_balances fields consumed by the tree/table/editor UI.
create function public.read_account_balances(p_organization_id uuid)
returns table (
  organization_id uuid,
  account_id uuid,
  code text,
  name text,
  type public.account_type,
  subtype public.account_subtype,
  currency character(3),
  account_role text,
  control_subledger_type public.control_subledger_type,
  control_binding_locked boolean,
  normal_balance public.normal_balance,
  contra_account_id uuid,
  is_system boolean,
  classification_locked boolean,
  net_debit_minor text,
  statement_balance_minor text,
  entry_count bigint,
  is_archived boolean,
  is_liquid boolean,
  parent_account_id uuid
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform app.require_capability(p_organization_id, 'accounts.read');

  return query
  with posted as materialized (
    select
      entry.account_id,
      coalesce(sum(entry.base_amount_minor) filter (where entry.side = 'debit'), 0)::bigint as debit_minor,
      coalesce(sum(entry.base_amount_minor) filter (where entry.side = 'credit'), 0)::bigint as credit_minor,
      count(*)::bigint as entry_count
    from public.transaction_entries entry
    where entry.organization_id = p_organization_id
      and entry.posted_at is not null
    group by entry.account_id
  ), history as materialized (
    select distinct entry.account_id
    from public.transaction_entries entry
    where entry.organization_id = p_organization_id
  )
  select
    account.organization_id,
    account.id,
    account.code,
    account.name,
    account.type,
    account.subtype,
    account.currency,
    account.account_role,
    binding.subledger_type,
    account.account_role = 'control' and history.account_id is not null,
    account.normal_balance,
    account.contra_account_id,
    account.is_system,
    history.account_id is not null,
    (coalesce(posted.debit_minor, 0) - coalesce(posted.credit_minor, 0))::text,
    ((case when account.type in ('asset', 'expense') then 1 else -1 end)
      * (coalesce(posted.debit_minor, 0) - coalesce(posted.credit_minor, 0)))::text,
    coalesce(posted.entry_count, 0),
    account.is_archived,
    account.is_liquid,
    account.parent_account_id
  from public.accounts account
  left join posted on posted.account_id = account.id
  left join history on history.account_id = account.id
  left join public.control_account_bindings binding
    on binding.organization_id = p_organization_id
   and binding.account_id = account.id
  where account.organization_id = p_organization_id
  order by account.code nulls last, account.id;
end;
$$;

alter function public.read_account_balances(uuid) owner to postgres;
revoke all on function public.read_account_balances(uuid) from public, anon;
grant execute on function public.read_account_balances(uuid) to authenticated;
comment on function public.read_account_balances(uuid) is
  'Exact tenant-scoped Accounts UI projection. Aggregates posted entries once and preserves zero-balance account metadata.';

-- Overview previously launched five public report reads, while reconciliation
-- called P&L, Balance Sheet, and Trial Balance repeatedly. Build every visible
-- Overview surface from one materialized, tenant-scoped ledger population.
create function public.report_financial_overview(
  p_organization_id uuid,
  p_from_date date,
  p_to_date date,
  p_as_of_date date default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_as_of date := coalesce(p_as_of_date, p_to_date);
  v_result jsonb;
begin
  perform app.require_capability(p_organization_id, 'reports.read');
  if p_from_date is null or p_to_date is null
     or not isfinite(p_from_date) or not isfinite(p_to_date)
     or p_from_date > p_to_date or not isfinite(v_as_of) then
    raise exception 'INVALID_DATE_RANGE' using errcode = '22023';
  end if;

  with ledger as materialized (
    select
      entry.id as entry_id,
      entry.account_id,
      entry.entry_date,
      entry.created_at,
      entry.side,
      entry.base_amount_minor,
      account.code,
      account.type,
      account.parent_account_id,
      account.account_role,
      account.normal_balance,
      account.contra_account_id,
      transaction.source
    from public.transaction_entries entry
    join public.accounts account
      on account.organization_id = p_organization_id
     and account.id = entry.account_id
    join public.transactions transaction
      on transaction.organization_id = p_organization_id
     and transaction.id = entry.transaction_id
    where entry.organization_id = p_organization_id
      and entry.posted_at is not null
      and entry.entry_date <= greatest(p_to_date, v_as_of)
  ), profit_loss as materialized (
    select
      coalesce(mapping.statement_line, 'unclassified_' || source.type::text) as section,
      source.account_id,
      source.code,
      app.account_label_at_entry(source.account_id, max(source.created_at)) as name,
      sum(case when source.type = 'revenue'
        then case when source.side = 'credit' then source.base_amount_minor else -source.base_amount_minor end
        else case when source.side = 'debit' then source.base_amount_minor else -source.base_amount_minor end
      end)::bigint as amount_minor
    from ledger source
    left join lateral (
      select history.statement_line
      from public.account_financial_mappings history
      where history.organization_id = p_organization_id
        and history.account_id = source.account_id
        and history.dimension = 'profit_loss'
        and history.effective_from <= source.entry_date
      order by history.effective_from desc, history.revision desc
      limit 1
    ) mapping on true
    where source.entry_date between p_from_date and p_to_date
      and source.source <> 'year_end_close'
      and source.type in ('revenue', 'expense')
      and source.account_role in ('posting', 'control')
    group by source.account_id, source.code, source.type, mapping.statement_line
    having sum(case when source.side = 'debit' then source.base_amount_minor else -source.base_amount_minor end) <> 0
  ), balance_accounts as materialized (
    select
      source.account_id,
      source.code,
      app.account_label_at_entry(source.account_id, max(source.created_at)) as name,
      source.type,
      source.account_role,
      (case when source.type in ('asset', 'expense')
        then coalesce(sum(source.base_amount_minor) filter (where source.side = 'debit'), 0)
           - coalesce(sum(source.base_amount_minor) filter (where source.side = 'credit'), 0)
        else coalesce(sum(source.base_amount_minor) filter (where source.side = 'credit'), 0)
           - coalesce(sum(source.base_amount_minor) filter (where source.side = 'debit'), 0)
      end)::bigint as amount_minor
    from ledger source
    where source.entry_date <= v_as_of
    group by source.account_id, source.code, source.type, source.account_role
  ), balance_sheet as materialized (
    select
      balance.type::text as section,
      balance.account_id,
      balance.code,
      balance.name,
      balance.amount_minor
    from balance_accounts balance
    where balance.type in ('asset', 'liability', 'equity')
      and balance.amount_minor <> 0
    union all
    select
      'equity', null::uuid, null::text, 'Net profit for the period',
      coalesce(sum(case when balance.type = 'revenue'
        then balance.amount_minor else -balance.amount_minor end), 0)::bigint
    from balance_accounts balance
    where balance.type in ('revenue', 'expense')
    having coalesce(sum(case when balance.type = 'revenue'
      then balance.amount_minor else -balance.amount_minor end), 0) <> 0
  ), classified_balance_sheet as materialized (
    select
      report.section,
      report.account_id,
      report.code,
      report.name,
      report.amount_minor::text as amount_minor,
      case when report.account_id is null then 'unclosed_profit'
        else coalesce(classification.statement_line, 'unclassified_' || report.section) end as statement_line,
      classification.id as classification_id,
      classification.effective_from,
      v_as_of as report_date
    from balance_sheet report
    left join lateral (
      select history.id, history.statement_line, history.effective_from
      from public.account_statement_classifications history
      where history.organization_id = p_organization_id
        and history.account_id = report.account_id
        and history.effective_from <= v_as_of
      order by history.effective_from desc, history.revision desc
      limit 1
    ) classification on true
  ), trial_source as materialized (
    select
      source.account_id,
      source.code,
      app.account_label_at_entry(source.account_id, max(source.created_at)) as name,
      source.type,
      source.parent_account_id,
      source.account_role,
      source.normal_balance,
      source.contra_account_id,
      coalesce(sum(case when source.entry_date < p_from_date
        then case when source.side = 'debit' then source.base_amount_minor else -source.base_amount_minor end
        else 0 end), 0)::bigint as opening_net,
      coalesce(sum(source.base_amount_minor) filter (
        where source.entry_date between p_from_date and p_to_date and source.side = 'debit'), 0)::bigint as period_debit,
      coalesce(sum(source.base_amount_minor) filter (
        where source.entry_date between p_from_date and p_to_date and source.side = 'credit'), 0)::bigint as period_credit
    from ledger source
    where source.entry_date <= p_to_date
      and source.account_role in ('posting', 'control')
    group by source.account_id, source.code, source.type, source.parent_account_id,
      source.account_role, source.normal_balance, source.contra_account_id
  ), trial_balance as materialized (
    select
      trial.account_id,
      trial.code,
      trial.name,
      trial.type,
      trial.parent_account_id,
      trial.account_role,
      trial.normal_balance,
      trial.contra_account_id,
      greatest(trial.opening_net, 0)::text as opening_debit_minor,
      greatest(-trial.opening_net, 0)::text as opening_credit_minor,
      trial.period_debit::text as period_debit_minor,
      trial.period_credit::text as period_credit_minor,
      greatest(trial.opening_net + trial.period_debit - trial.period_credit, 0)::text as closing_debit_minor,
      greatest(-(trial.opening_net + trial.period_debit - trial.period_credit), 0)::text as closing_credit_minor
    from trial_source trial
  ), profit_loss_ledger as materialized (
    select
      source.account_id,
      sum(case when source.type = 'revenue'
        then case when source.side = 'credit' then source.base_amount_minor else -source.base_amount_minor end
        else case when source.side = 'debit' then -source.base_amount_minor else source.base_amount_minor end
      end)::bigint as amount_minor
    from ledger source
    where source.entry_date between p_from_date and p_to_date
      and source.source <> 'year_end_close'
      and source.type in ('revenue', 'expense')
    group by source.account_id
  ), reconciliation_rows as materialized (
    select
      'profit_loss'::text as statement,
      coalesce(statement.account_id, ledger_row.account_id) as account_id,
      coalesce(statement.amount_minor, 0)::bigint as statement_minor,
      coalesce(ledger_row.amount_minor, 0)::bigint as ledger_minor
    from (
      select account_id,
        sum(case when section in ('operating_revenue', 'other_income', 'unclassified_revenue')
          then amount_minor else -amount_minor end)::bigint as amount_minor
      from profit_loss
      group by account_id
    ) statement
    full join profit_loss_ledger ledger_row using (account_id)
    union all
    select
      'balance_sheet',
      coalesce(statement.account_id, ledger_row.account_id),
      coalesce(statement.amount_minor, 0)::bigint,
      coalesce(ledger_row.amount_minor, 0)::bigint
    from (
      select account_id,
        sum(case when section = 'asset' then amount_minor::bigint else -amount_minor::bigint end)::bigint as amount_minor
      from classified_balance_sheet
      where account_id is not null
      group by account_id
    ) statement
    full join (
      select account_id,
        sum(case when type = 'asset' then amount_minor else -amount_minor end)::bigint as amount_minor
      from balance_accounts
      where type in ('asset', 'liability', 'equity')
        and account_role in ('posting', 'control')
      group by account_id
    ) ledger_row using (account_id)
  ), totals as materialized (
    select
      coalesce((select sum(case when row.section in ('operating_revenue', 'other_income', 'unclassified_revenue')
        then row.amount_minor else -row.amount_minor end) from profit_loss row), 0)::bigint as profit_loss_minor,
      coalesce((select sum(row.amount_minor) from profit_loss_ledger row), 0)::bigint as profit_loss_gl_minor,
      coalesce((select sum(case when row.section = 'asset' then row.amount_minor::bigint else -row.amount_minor::bigint end)
        from classified_balance_sheet row), 0)::bigint as balance_sheet_minor,
      coalesce((select sum(case when row.type in ('asset', 'expense')
        then row.amount_minor else -row.amount_minor end)
        from balance_accounts row
        where row.account_role in ('posting', 'control')), 0)::bigint as trial_balance_minor,
      (select count(*) from profit_loss row where row.section like 'unclassified_%')::bigint as unclassified_profit_loss_rows,
      (select count(*) from classified_balance_sheet row where row.statement_line like 'unclassified_%')::bigint as unclassified_balance_sheet_rows,
      coalesce((select sum(row.amount_minor) from balance_accounts row where row.type = 'asset'), 0)::bigint as assets_minor,
      coalesce((select sum(row.amount_minor) from balance_accounts row where row.type = 'liability'), 0)::bigint as liabilities_minor,
      coalesce((select sum(row.amount_minor) from balance_accounts row where row.type = 'equity'), 0)::bigint as equity_minor,
      coalesce((select sum(case when row.type = 'revenue' then row.amount_minor
        when row.type = 'expense' then -row.amount_minor else 0 end) from balance_accounts row), 0)::bigint as net_income_minor
  )
  select jsonb_build_object(
    'profit_loss', coalesce((select jsonb_agg(to_jsonb(row) order by row.section, row.code nulls last, row.name)
      from profit_loss row), '[]'::jsonb),
    'balance_sheet', coalesce((select jsonb_agg(to_jsonb(row) order by row.section, row.statement_line, row.code nulls last, row.account_id)
      from classified_balance_sheet row), '[]'::jsonb),
    'trial_balance', coalesce((select jsonb_agg(to_jsonb(row) order by row.code nulls last, row.name, row.account_id)
      from trial_balance row), '[]'::jsonb),
    'integrity', jsonb_build_object(
      'as_of', v_as_of,
      'assets_minor', totals.assets_minor,
      'liabilities_minor', totals.liabilities_minor,
      'equity_minor', totals.equity_minor,
      'net_income_minor', totals.net_income_minor,
      'difference_minor', totals.assets_minor - totals.liabilities_minor - totals.equity_minor - totals.net_income_minor,
      'balanced', totals.assets_minor = totals.liabilities_minor + totals.equity_minor + totals.net_income_minor
    ),
    'reconciliation', jsonb_build_object(
      'profit_loss_minor', totals.profit_loss_minor,
      'profit_loss_gl_minor', totals.profit_loss_gl_minor,
      'profit_loss_difference_minor', totals.profit_loss_minor - totals.profit_loss_gl_minor,
      'balance_sheet_equation_minor', totals.balance_sheet_minor,
      'trial_balance_equation_minor', totals.trial_balance_minor,
      'balance_sheet_difference_minor', totals.balance_sheet_minor - totals.trial_balance_minor,
      'unclassified_profit_loss_rows', totals.unclassified_profit_loss_rows,
      'unclassified_balance_sheet_rows', totals.unclassified_balance_sheet_rows,
      'mapping_complete', totals.unclassified_profit_loss_rows = 0 and totals.unclassified_balance_sheet_rows = 0,
      'accounts', coalesce((select jsonb_agg(jsonb_build_object(
        'statement', row.statement,
        'account_id', row.account_id,
        'statement_minor', row.statement_minor,
        'ledger_minor', row.ledger_minor,
        'difference_minor', row.statement_minor - row.ledger_minor
      ) order by row.statement, row.account_id) from reconciliation_rows row), '[]'::jsonb)
    )
  ) into v_result
  from totals;

  return v_result;
end;
$$;

alter function public.report_financial_overview(uuid, date, date, date) owner to postgres;
revoke all on function public.report_financial_overview(uuid, date, date, date) from public, anon;
grant execute on function public.report_financial_overview(uuid, date, date, date) to authenticated;
comment on function public.report_financial_overview(uuid, date, date, date) is
  'Exact active Overview payload derived from one materialized tenant ledger slice.';

-- Preserve the existing reconciliation signature while removing its repeated
-- calls to the same detailed report functions.
create or replace function public.report_statement_reconciliation(
  p_organization_id uuid,
  p_from_date date,
  p_to_date date,
  p_as_of_date date default null
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select public.report_financial_overview(
    p_organization_id, p_from_date, p_to_date, p_as_of_date
  )->'reconciliation';
$$;

-- These established report bodies already perform explicit capability checks
-- and organization/account scoping. Trusted execution avoids re-evaluating
-- capability-bearing RLS policies for every historical entry on large ledgers.
alter function public.report_profit_and_loss(uuid, date, date) security definer;
alter function public.report_balance_sheet(uuid, date) security definer;
alter function public.report_trial_balance(uuid, date, date) security definer;
alter function public.report_classified_balance_sheet(uuid, date) security definer;
alter function public.check_balance_sheet_integrity(uuid, date) security definer;
alter function public.report_cash_flow_detail(uuid, date, date) security definer;
alter function public.report_cash_flow(uuid, date, date) security definer;
alter function public.report_indirect_cash_flow(uuid, date, date) security definer;
alter function public.report_general_ledger(uuid, uuid, date, date) security definer;
alter function public.report_statement_reconciliation(uuid, date, date, date) owner to postgres;
alter function public.report_profit_and_loss(uuid, date, date) owner to postgres;
alter function public.report_balance_sheet(uuid, date) owner to postgres;
alter function public.report_trial_balance(uuid, date, date) owner to postgres;
alter function public.report_classified_balance_sheet(uuid, date) owner to postgres;
alter function public.check_balance_sheet_integrity(uuid, date) owner to postgres;
alter function public.report_cash_flow_detail(uuid, date, date) owner to postgres;
alter function public.report_cash_flow(uuid, date, date) owner to postgres;
alter function public.report_indirect_cash_flow(uuid, date, date) owner to postgres;
alter function public.report_general_ledger(uuid, uuid, date, date) owner to postgres;

revoke all on function public.report_statement_reconciliation(uuid, date, date, date) from public, anon;
revoke all on function public.report_profit_and_loss(uuid, date, date) from public, anon;
revoke all on function public.report_balance_sheet(uuid, date) from public, anon;
revoke all on function public.report_trial_balance(uuid, date, date) from public, anon;
revoke all on function public.report_classified_balance_sheet(uuid, date) from public, anon;
revoke all on function public.check_balance_sheet_integrity(uuid, date) from public, anon;
revoke all on function public.report_cash_flow_detail(uuid, date, date) from public, anon;
revoke all on function public.report_cash_flow(uuid, date, date) from public, anon;
revoke all on function public.report_indirect_cash_flow(uuid, date, date) from public, anon;
revoke all on function public.report_general_ledger(uuid, uuid, date, date) from public, anon;
grant execute on function public.report_statement_reconciliation(uuid, date, date, date) to authenticated;
grant execute on function public.report_profit_and_loss(uuid, date, date) to authenticated;
grant execute on function public.report_balance_sheet(uuid, date) to authenticated;
grant execute on function public.report_trial_balance(uuid, date, date) to authenticated;
grant execute on function public.report_classified_balance_sheet(uuid, date) to authenticated;
grant execute on function public.check_balance_sheet_integrity(uuid, date) to authenticated;
grant execute on function public.report_cash_flow_detail(uuid, date, date) to authenticated;
grant execute on function public.report_cash_flow(uuid, date, date) to authenticated;
grant execute on function public.report_indirect_cash_flow(uuid, date, date) to authenticated;
grant execute on function public.report_general_ledger(uuid, uuid, date, date) to authenticated;
