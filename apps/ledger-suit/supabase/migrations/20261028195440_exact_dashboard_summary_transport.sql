-- LS-FIN-PRECISION-002: preserve dashboard money before JavaScript JSON parsing.
-- Keep the existing provider and its authorization/numeric SQL contract intact.
create function public.read_exact_dashboard_summary(p_organization_id uuid)
returns jsonb
language sql volatile security invoker
set search_path = ''
as $$
  select app.exact_minor_json(public.dashboard_summary(p_organization_id));
$$;
revoke all on function public.read_exact_dashboard_summary(uuid) from public, anon;
grant execute on function public.read_exact_dashboard_summary(uuid) to authenticated;
comment on function public.read_exact_dashboard_summary(uuid) is
  'Exact minor-unit JSON transport for the existing authorized dashboard summary. No authority elevation or financial writes.';
