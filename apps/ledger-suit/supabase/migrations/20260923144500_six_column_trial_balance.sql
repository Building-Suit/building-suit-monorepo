-- V2-IMP-002 — one posted-ledger source for the six-column period Trial Balance.
-- Replace the cumulative two-column signature instead of leaving ambiguous
-- PostgREST overloads. All application and export callers move together.
drop function if exists public.report_trial_balance(uuid, date);

create or replace function public.report_trial_balance(
  p_organization_id uuid,
  p_from_date date,
  p_to_date date
)
returns table (
  account_id uuid,
  code text,
  name text,
  type public.account_type,
  parent_account_id uuid,
  account_role text,
  normal_balance public.normal_balance,
  contra_account_id uuid,
  opening_debit_minor text,
  opening_credit_minor text,
  period_debit_minor text,
  period_credit_minor text,
  closing_debit_minor text,
  closing_credit_minor text
)
language plpgsql
stable
set search_path = ''
as $$
begin
  perform app.require_capability(p_organization_id, 'reports.read');

  if p_from_date is null or p_to_date is null
     or not isfinite(p_from_date) or not isfinite(p_to_date)
     or p_from_date > p_to_date then
    raise exception 'INVALID_DATE_RANGE' using errcode = '22023';
  end if;

  return query
  with movements as (
    select
      a.id,
      a.code,
      a.name,
      a.type,
      a.parent_account_id,
      a.account_role,
      a.normal_balance,
      a.contra_account_id,
      coalesce(sum(case when e.entry_date < p_from_date
                         then case when e.side = 'debit' then e.base_amount_minor else -e.base_amount_minor end
                         else 0 end), 0)::bigint as opening_net,
      coalesce(sum(e.base_amount_minor) filter (
        where e.entry_date between p_from_date and p_to_date and e.side = 'debit'
      ), 0)::bigint as period_debit,
      coalesce(sum(e.base_amount_minor) filter (
        where e.entry_date between p_from_date and p_to_date and e.side = 'credit'
      ), 0)::bigint as period_credit,
      count(e.id) as entry_count
    from public.accounts a
    left join public.transaction_entries e
      on e.organization_id = a.organization_id
     and e.account_id = a.id
     and e.posted_at is not null
     and e.entry_date <= p_to_date
    where a.organization_id = p_organization_id
      and a.account_role = 'posting'
    group by a.id
  ), balances as (
    select m.*, (m.opening_net + m.period_debit - m.period_credit)::bigint as closing_net
    from movements m
    where m.entry_count > 0
  )
  select
    b.id,
    b.code,
    b.name,
    b.type,
    b.parent_account_id,
    b.account_role,
    b.normal_balance,
    b.contra_account_id,
    greatest(b.opening_net, 0)::text,
    greatest(-b.opening_net, 0)::text,
    b.period_debit::text,
    b.period_credit::text,
    greatest(b.closing_net, 0)::text,
    greatest(-b.closing_net, 0)::text
  from balances b
  order by b.code nulls last, b.name, b.id;
end;
$$;

comment on function public.report_trial_balance(uuid, date, date) is
  'Six-column Trial Balance for an inclusive period. Opening and closing are '
  'net debit/credit positions; period columns are gross posted movements. '
  'Only posting accounts are returned, so hierarchy parents cannot double-count totals.';

revoke all on function public.report_trial_balance(uuid, date, date) from public, anon;
grant execute on function public.report_trial_balance(uuid, date, date) to authenticated;

-- Keep every report export unchanged except Trial Balance, whose rows and totals
-- are both derived from the period RPC above.
create or replace function public.export_financial_report_csv(
  p_organization_id uuid,
  p_report text,
  p_from_date date default null,
  p_to_date date default null,
  p_as_of_date date default null,
  p_account_id uuid default null
)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_header text;
  v_body text;
  v_currency text := app.org_base_currency(p_organization_id)::text;
begin
  perform app.require_capability(p_organization_id, 'reports.export');
  perform app.assert_plan_feature(p_organization_id, 'exports');

  case p_report
    when 'profit_loss' then
      if p_from_date is null or p_to_date is null then
        raise exception 'INVALID_EXPORT_ARGUMENT: profit_loss requires from and to dates'
          using errcode = '22023';
      end if;
      v_header := app.csv_line('section', 'code', 'account', 'amount', 'currency');
      select string_agg(app.csv_line(
        report.section, app.csv_untrusted_text(report.code),
        app.csv_untrusted_text(report.name),
        app.csv_amount(p_organization_id, report.amount_minor), v_currency
      ), E'\n' order by report.section, report.code nulls last, report.name)
      into v_body
      from public.report_profit_and_loss(p_organization_id, p_from_date, p_to_date) report;

    when 'balance_sheet' then
      v_header := app.csv_line('section', 'code', 'account', 'amount', 'currency');
      select string_agg(app.csv_line(
        report.section, app.csv_untrusted_text(report.code),
        app.csv_untrusted_text(report.name),
        app.csv_amount(p_organization_id, report.amount_minor), v_currency
      ), E'\n' order by report.section, report.code nulls last, report.name)
      into v_body
      from public.report_balance_sheet(p_organization_id, p_as_of_date) report;

    when 'trial_balance' then
      if p_from_date is null or p_to_date is null then
        raise exception 'INVALID_EXPORT_ARGUMENT: trial_balance requires from and to dates'
          using errcode = '22023';
      end if;
      v_header := app.csv_line(
        'code', 'account', 'type', 'opening_debit', 'opening_credit',
        'period_debit', 'period_credit', 'closing_debit', 'closing_credit', 'currency'
      );
      with report as materialized (
        select * from public.report_trial_balance(p_organization_id, p_from_date, p_to_date)
      ), lines as (
        select 0 as position, report.code as sort_code, report.name as sort_name,
          app.csv_line(
            app.csv_untrusted_text(report.code), app.csv_untrusted_text(report.name), report.type::text,
            app.csv_amount(p_organization_id, report.opening_debit_minor::bigint),
            app.csv_amount(p_organization_id, report.opening_credit_minor::bigint),
            app.csv_amount(p_organization_id, report.period_debit_minor::bigint),
            app.csv_amount(p_organization_id, report.period_credit_minor::bigint),
            app.csv_amount(p_organization_id, report.closing_debit_minor::bigint),
            app.csv_amount(p_organization_id, report.closing_credit_minor::bigint), v_currency
          ) as line
        from report
        union all
        select 1, null, null, app.csv_line(
          '', 'Total', '',
          app.csv_amount(p_organization_id, coalesce(sum(opening_debit_minor::bigint), 0)::bigint),
          app.csv_amount(p_organization_id, coalesce(sum(opening_credit_minor::bigint), 0)::bigint),
          app.csv_amount(p_organization_id, coalesce(sum(period_debit_minor::bigint), 0)::bigint),
          app.csv_amount(p_organization_id, coalesce(sum(period_credit_minor::bigint), 0)::bigint),
          app.csv_amount(p_organization_id, coalesce(sum(closing_debit_minor::bigint), 0)::bigint),
          app.csv_amount(p_organization_id, coalesce(sum(closing_credit_minor::bigint), 0)::bigint), v_currency
        )
        from report
      )
      select string_agg(line, E'\n' order by position, sort_code nulls last, sort_name)
      into v_body from lines;

    when 'cash_flow' then
      if p_from_date is null or p_to_date is null then
        raise exception 'INVALID_EXPORT_ARGUMENT: cash_flow requires from and to dates'
          using errcode = '22023';
      end if;
      v_header := app.csv_line('activity', 'net_movement', 'currency');
      select string_agg(app.csv_line(
        report.section::text,
        app.csv_amount(p_organization_id, report.amount_minor), v_currency
      ), E'\n' order by report.section)
      into v_body
      from public.report_cash_flow(p_organization_id, p_from_date, p_to_date) report;

    when 'general_ledger' then
      if p_account_id is null or p_from_date is null or p_to_date is null then
        raise exception 'INVALID_EXPORT_ARGUMENT: general_ledger requires an account and date range'
          using errcode = '22023';
      end if;
      v_header := app.csv_line(
        'date', 'reference', 'description', 'memo', 'debit', 'credit',
        'running_balance', 'currency'
      );
      select string_agg(app.csv_line(
        report.entry_date::text,
        app.csv_untrusted_text(report.reference),
        app.csv_untrusted_text(report.description),
        app.csv_untrusted_text(report.memo),
        app.csv_amount(p_organization_id, report.debit_minor),
        app.csv_amount(p_organization_id, report.credit_minor),
        app.csv_amount(p_organization_id, report.running_balance_minor), v_currency
      ), E'\n' order by report.entry_date, report.entry_id)
      into v_body
      from public.report_general_ledger(
        p_organization_id, p_account_id, p_from_date, p_to_date
      ) report;

    else
      raise exception 'INVALID_EXPORT_ARGUMENT: unsupported financial report'
        using errcode = '22023';
  end case;

  return v_header || case when v_body is null then '' else E'\n' || v_body end;
end;
$$;

comment on function public.export_financial_report_csv(uuid, text, date, date, date, uuid) is
  'Exports one of the five financial reports as stable UTF-8 CSV after checking '
  'report-export permission and the exports plan entitlement. Trial Balance uses '
  'the exact six-column period dataset shown by the application.';
