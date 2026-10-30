-- LS-FIN-PRECISION-001: serialize monetary read fields before JSON reaches JS.
-- Original report functions and their numeric SQL contracts remain intact.
create function app.exact_minor_json(p_value jsonb, p_money boolean default false)
returns jsonb language sql immutable strict security invoker set search_path = '' as $$
  select case jsonb_typeof(p_value)
    when 'object' then coalesce((
      select jsonb_object_agg(item.key, app.exact_minor_json(item.value,
        p_money or right(item.key, 6) = '_minor' or item.key = 'allocations'))
      from jsonb_each(p_value) item
    ), '{}'::jsonb)
    when 'array' then coalesce((
      select jsonb_agg(app.exact_minor_json(item.value, p_money) order by item.ordinality)
      from jsonb_array_elements(p_value) with ordinality item(value, ordinality)
    ), '[]'::jsonb)
    when 'number' then case when p_money then to_jsonb(p_value #>> '{}') else p_value end
    else p_value
  end;
$$;
revoke all on function app.exact_minor_json(jsonb, boolean) from public, anon;
grant execute on function app.exact_minor_json(jsonb, boolean) to authenticated;
comment on function app.exact_minor_json(jsonb, boolean) is
  'Pure private-schema serializer for exact minor-unit fields and monetary allocation maps. No data access or authority elevation.';

create function public.read_exact_financial_report(
  p_report text, p_organization_id uuid,
  p_from_date date default null, p_to_date date default null,
  p_as_of_date date default null, p_entry_id uuid default null
) returns jsonb language plpgsql volatile security invoker set search_path = '' as $$
declare v_result jsonb;
begin
  -- Keep invoker authority: allocation context relies on its original RLS.
  -- These existing providers retain tenant/capability/plan/date authorization.
  case p_report
    when 'overview' then
      v_result := public.report_financial_overview(p_organization_id, p_from_date, p_to_date, p_as_of_date);
    when 'cash_flow' then
      v_result := public.report_indirect_cash_flow(p_organization_id, p_from_date, p_to_date);
    when 'cash_allocation' then
      v_result := public.cash_flow_allocation_context(p_organization_id, p_entry_id);
    else
      raise exception 'FINANCIAL_REPORT_NOT_SUPPORTED' using errcode = '22023';
  end case;
  return app.exact_minor_json(v_result);
end;
$$;
revoke all on function public.read_exact_financial_report(text, uuid, date, date, date, uuid) from public, anon;
grant execute on function public.read_exact_financial_report(text, uuid, date, date, date, uuid) to authenticated;
comment on function public.read_exact_financial_report(text, uuid, date, date, date, uuid) is
  'Exact monetary JSON transport for the existing overview, indirect cash flow and allocation read models. Invoker authority and provider authorization are preserved.';

create function public.classify_cash_flow_entry_exact(
  p_organization_id uuid, p_entry_id uuid, p_allocations jsonb,
  p_reason text, p_request_id uuid, p_expected_decision_id uuid default null
) returns uuid language plpgsql volatile security invoker set search_path = '' as $$
declare v_allocations jsonb := p_allocations;
begin
  perform app.require_capability(p_organization_id, 'accounts.update');
  -- Convert canonical minor-unit strings in PostgreSQL, before the original
  -- payload-bound retry check. Stored allocations are numeric JSON in that API.
  -- Delegate invalid payloads to the existing validator without broadening it.
  if jsonb_typeof(p_allocations) = 'object' then
    if not exists (select 1 from jsonb_each_text(p_allocations) item where item.value !~ '^[1-9][0-9]*$') then
      select coalesce(jsonb_object_agg(item.key, to_jsonb(item.value::bigint)), '{}'::jsonb)
        into v_allocations from jsonb_each_text(p_allocations) item;
    end if;
  end if;
  return public.classify_cash_flow_entry(p_organization_id, p_entry_id, v_allocations,
    p_reason, p_request_id, p_expected_decision_id);
end;
$$;
revoke all on function public.classify_cash_flow_entry_exact(uuid, uuid, jsonb, text, uuid, uuid) from public, anon;
grant execute on function public.classify_cash_flow_entry_exact(uuid, uuid, jsonb, text, uuid, uuid) to authenticated;
comment on function public.classify_cash_flow_entry_exact(uuid, uuid, jsonb, text, uuid, uuid) is
  'Exact string-minor transport into the original authorized, serialized and payload-bound cash-flow classification command.';
