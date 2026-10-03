-- SS-RPT-LITE-001: server-reconciled owner/operator reporting. This is an
-- operational view of Shop Suit source records, not an accounting statement.

create function shop_private.shop_operating_report(
  p_shop_id uuid,
  p_location_id uuid default null,
  p_period text default 'day',
  p_anchor_date date default (now() at time zone 'Africa/Cairo')::date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_from_date date;
  v_to_date date;
  v_from timestamptz;
  v_to timestamptz;
  v_sales numeric := 0;
  v_expenses numeric := 0;
  v_can_view_costs boolean := false;
  v_result jsonb;
begin
  perform shop_private.assert_team_permission(p_shop_id, 'reports.view');
  v_can_view_costs := shop_private.has_permission(p_shop_id, 'reports.cost_profit.view');
  if p_period is null or p_period not in ('day', 'week', 'month') or p_anchor_date is null then
    raise exception 'INVALID_REPORT_PERIOD' using errcode = '22023';
  end if;
  if p_location_id is not null then
    perform shop_private.assert_location_access(p_shop_id, p_location_id, false);
  end if;

  v_from_date := case p_period
    when 'day' then p_anchor_date
    when 'week' then p_anchor_date - extract(isodow from p_anchor_date)::integer + 1
    else date_trunc('month', p_anchor_date)::date
  end;
  v_to_date := case p_period
    when 'day' then v_from_date + 1
    when 'week' then v_from_date + 7
    else (v_from_date + interval '1 month')::date
  end;
  v_from := v_from_date::timestamp at time zone 'Africa/Cairo';
  v_to := v_to_date::timestamp at time zone 'Africa/Cairo';

  select coalesce(sum(invoice.total_amount), 0) into v_sales
  from public.invoices invoice
  where invoice.shop_id = p_shop_id
    and invoice.status in ('issued', 'paid')
    and not exists (select 1 from public.sale_corrections correction
      where correction.invoice_id = invoice.id)
    and (p_location_id is null or invoice.location_id = p_location_id)
    and shop_private.user_can_access_location(p_shop_id, invoice.location_id)
    and coalesce(invoice.issued_at, invoice.created_at) >= v_from
    and coalesce(invoice.issued_at, invoice.created_at) < v_to;

  if v_can_view_costs then
    select coalesce(sum(expense.amount), 0) into v_expenses
    from public.expenses expense
    where expense.shop_id = p_shop_id and expense.status = 'paid'
      and (p_location_id is null or expense.location_id = p_location_id)
      and shop_private.user_can_access_location(p_shop_id, expense.location_id)
      and expense.expense_date >= v_from and expense.expense_date < v_to;
  end if;

  select jsonb_build_object(
    'shopId', p_shop_id,
    'locationId', p_location_id,
    'period', p_period,
    'canViewCosts', v_can_view_costs,
    'fromDate', v_from_date,
    'toDateExclusive', v_to_date,
    'generatedAt', clock_timestamp(),
    'sales', v_sales,
    'saleCount', (select count(*) from public.invoices invoice
      where invoice.shop_id = p_shop_id and invoice.status in ('issued', 'paid')
        and not exists (select 1 from public.sale_corrections correction
          where correction.invoice_id = invoice.id)
        and (p_location_id is null or invoice.location_id = p_location_id)
        and shop_private.user_can_access_location(p_shop_id, invoice.location_id)
        and coalesce(invoice.issued_at, invoice.created_at) >= v_from
        and coalesce(invoice.issued_at, invoice.created_at) < v_to),
    'averageTicket', case when (select count(*) from public.invoices invoice
      where invoice.shop_id = p_shop_id and invoice.status in ('issued', 'paid')
        and not exists (select 1 from public.sale_corrections correction where correction.invoice_id = invoice.id)
        and (p_location_id is null or invoice.location_id = p_location_id)
        and shop_private.user_can_access_location(p_shop_id, invoice.location_id)
        and coalesce(invoice.issued_at, invoice.created_at) >= v_from
        and coalesce(invoice.issued_at, invoice.created_at) < v_to) = 0 then 0
      else round(v_sales / (select count(*) from public.invoices invoice
        where invoice.shop_id = p_shop_id and invoice.status in ('issued', 'paid')
          and not exists (select 1 from public.sale_corrections correction where correction.invoice_id = invoice.id)
          and (p_location_id is null or invoice.location_id = p_location_id)
          and shop_private.user_can_access_location(p_shop_id, invoice.location_id)
          and coalesce(invoice.issued_at, invoice.created_at) >= v_from
          and coalesce(invoice.issued_at, invoice.created_at) < v_to), 2) end,
    'salesMix', (select coalesce(jsonb_agg(jsonb_build_object(
        'type', mix.item_type, 'amount', mix.amount, 'quantity', mix.quantity)
        order by mix.item_type), '[]'::jsonb)
      from (select item.item_type::text item_type, sum(item.total_amount) amount,
          sum(item.quantity) quantity
        from public.invoice_items item
        join public.invoices invoice on invoice.id = item.invoice_id and invoice.shop_id = item.shop_id
        where invoice.shop_id = p_shop_id and invoice.status in ('issued', 'paid')
          and item.item_type in ('product', 'service')
          and not exists (select 1 from public.sale_corrections correction where correction.invoice_id = invoice.id)
          and (p_location_id is null or invoice.location_id = p_location_id)
          and shop_private.user_can_access_location(p_shop_id, invoice.location_id)
          and coalesce(invoice.issued_at, invoice.created_at) >= v_from
          and coalesce(invoice.issued_at, invoice.created_at) < v_to
        group by item.item_type) mix),
    'paymentMix', (select coalesce(jsonb_agg(jsonb_build_object(
        'method', mix.method, 'collected', mix.collected, 'refunded', mix.refunded,
        'net', mix.collected - mix.refunded, 'count', mix.payment_count)
        order by mix.method), '[]'::jsonb)
      from (select payment.method::text method,
          coalesce(sum(payment.amount) filter (where payment.payment_direction = 'in'), 0) collected,
          coalesce(sum(payment.amount) filter (where payment.payment_direction = 'out'), 0) refunded,
          count(*) payment_count
        from public.payments payment
        where payment.shop_id = p_shop_id and payment.status = 'completed'
          and payment.customer_kind is not null
          and (p_location_id is null or payment.location_id = p_location_id)
          and shop_private.user_can_access_location(p_shop_id, payment.location_id)
          and payment.paid_at >= v_from and payment.paid_at < v_to
        group by payment.method) mix),
    'paymentsIn', (select coalesce(sum(payment.amount), 0) from public.payments payment
      where payment.shop_id = p_shop_id and payment.status = 'completed'
        and payment.payment_direction = 'in' and payment.customer_kind is not null
        and (p_location_id is null or payment.location_id = p_location_id)
        and shop_private.user_can_access_location(p_shop_id, payment.location_id)
        and payment.paid_at >= v_from and payment.paid_at < v_to),
    'outstanding', (with customer_balances as (
        select invoice.client_id customer_id,
          coalesce(max(client.name), max(invoice.client_name_snapshot), '—') name,
          sum(invoice.total_amount - coalesce((select sum(shop_private.allocation_remaining(allocation.id))
            from public.customer_payment_allocations allocation where allocation.invoice_id = invoice.id), 0)) amount
        from public.invoices invoice
        left join public.clients client on client.id = invoice.client_id and client.shop_id = invoice.shop_id
        where invoice.shop_id = p_shop_id and invoice.client_id is not null
          and invoice.status in ('issued', 'paid')
          and not exists (select 1 from public.sale_corrections correction where correction.invoice_id = invoice.id)
          and (p_location_id is null or invoice.location_id = p_location_id)
          and shop_private.user_can_access_location(p_shop_id, invoice.location_id)
        group by invoice.client_id
        having sum(invoice.total_amount - coalesce((select sum(shop_private.allocation_remaining(allocation.id))
          from public.customer_payment_allocations allocation where allocation.invoice_id = invoice.id), 0)) > 0
      ) select jsonb_build_object(
        'amount', coalesce((select sum(balance.amount) from customer_balances balance), 0),
        'customerCount', (select count(*) from customer_balances),
        'customers', coalesce((select jsonb_agg(jsonb_build_object(
          'customerId', customer.customer_id, 'name', customer.name, 'amount', customer.amount)
          order by customer.amount desc, customer.name, customer.customer_id)
          from (select * from customer_balances balance
            order by balance.amount desc, balance.name, balance.customer_id limit 10) customer), '[]'::jsonb))),
    'expenses', jsonb_build_object(
      'amount', case when v_can_view_costs then v_expenses else null end,
      'count', case when v_can_view_costs then (select count(*) from public.expenses expense
        where expense.shop_id = p_shop_id and expense.status = 'paid'
          and (p_location_id is null or expense.location_id = p_location_id)
          and shop_private.user_can_access_location(p_shop_id, expense.location_id)
          and expense.expense_date >= v_from and expense.expense_date < v_to) else null end,
      'operatingBalance', case when v_can_view_costs then v_sales - v_expenses else null end),
    'appointments', (select jsonb_build_object(
        'total', count(*),
        'completed', count(*) filter (where appointment.status = 'completed'),
        'cancelled', count(*) filter (where appointment.status = 'cancelled'),
        'noShow', count(*) filter (where appointment.status = 'no_show'),
        'busiestTimes', coalesce((select jsonb_agg(jsonb_build_object(
          'hour', busy.hour_of_day, 'count', busy.appointment_count) order by busy.appointment_count desc, busy.hour_of_day)
          from (select extract(hour from timed.starts_at at time zone 'Africa/Cairo')::integer hour_of_day,
              count(*) appointment_count
            from public.appointments timed
            where timed.shop_id = p_shop_id
              and (p_location_id is null or timed.location_id = p_location_id)
              and shop_private.user_can_access_location(p_shop_id, timed.location_id)
              and timed.starts_at >= v_from and timed.starts_at < v_to
            group by 1 order by appointment_count desc, hour_of_day limit 5) busy), '[]'::jsonb))
      from public.appointments appointment
      where appointment.shop_id = p_shop_id
        and (p_location_id is null or appointment.location_id = p_location_id)
        and shop_private.user_can_access_location(p_shop_id, appointment.location_id)
        and appointment.starts_at >= v_from and appointment.starts_at < v_to),
    'appointmentCount', (select count(*) from public.appointments appointment
      where appointment.shop_id = p_shop_id
        and (p_location_id is null or appointment.location_id = p_location_id)
        and shop_private.user_can_access_location(p_shop_id, appointment.location_id)
        and appointment.starts_at >= v_from and appointment.starts_at < v_to),
    'cash', (select jsonb_build_object(
        'closedShifts', count(*), 'expected', coalesce(sum(session.expected_amount), 0),
        'counted', coalesce(sum(session.closing_amount), 0),
        'variance', coalesce(sum(session.variance_amount), 0))
      from public.cash_sessions session
      where session.shop_id = p_shop_id and session.status = 'closed'
        and (p_location_id is null or session.location_id = p_location_id)
        and shop_private.user_can_access_location(p_shop_id, session.location_id)
        and session.closed_at >= v_from and session.closed_at < v_to),
    'staff', (select coalesce(jsonb_agg(jsonb_build_object(
        'membershipId', staff.membership_id, 'name', staff.name, 'sales', staff.sales,
        'saleCount', staff.sale_count, 'serviceCount', staff.service_count)
        order by staff.sales desc, staff.name, staff.membership_id), '[]'::jsonb)
      from (select context.staff_membership_id membership_id,
          max(context.staff_name_snapshot) name, sum(invoice.total_amount) sales,
          count(distinct invoice.id) sale_count,
          coalesce(sum(item.service_quantity), 0) service_count
        from public.pos_sale_contexts context
        join public.invoices invoice on invoice.id = context.invoice_id and invoice.shop_id = context.shop_id
        left join lateral (select coalesce(sum(line.quantity), 0) service_quantity
          from public.invoice_items line where line.invoice_id = invoice.id
            and line.shop_id = invoice.shop_id and line.item_type = 'service') item on true
        where invoice.shop_id = p_shop_id and invoice.status in ('issued', 'paid')
          and not exists (select 1 from public.sale_corrections correction where correction.invoice_id = invoice.id)
          and (p_location_id is null or invoice.location_id = p_location_id)
          and shop_private.user_can_access_location(p_shop_id, invoice.location_id)
          and coalesce(invoice.issued_at, invoice.created_at) >= v_from
          and coalesce(invoice.issued_at, invoice.created_at) < v_to
        group by context.staff_membership_id) staff),
    'locations', (select coalesce(jsonb_agg(jsonb_build_object(
        'locationId', location.id, 'name', location.name,
        'sales', coalesce((select sum(invoice.total_amount) from public.invoices invoice
          where invoice.shop_id = p_shop_id and invoice.location_id = location.id
            and invoice.status in ('issued', 'paid')
            and not exists (select 1 from public.sale_corrections correction where correction.invoice_id = invoice.id)
            and coalesce(invoice.issued_at, invoice.created_at) >= v_from
            and coalesce(invoice.issued_at, invoice.created_at) < v_to), 0),
        'saleCount', (select count(*) from public.invoices invoice
          where invoice.shop_id = p_shop_id and invoice.location_id = location.id
            and invoice.status in ('issued', 'paid')
            and not exists (select 1 from public.sale_corrections correction where correction.invoice_id = invoice.id)
            and coalesce(invoice.issued_at, invoice.created_at) >= v_from
            and coalesce(invoice.issued_at, invoice.created_at) < v_to),
        'collections', coalesce((select coalesce(sum(payment.amount) filter (where payment.payment_direction = 'in'), 0)
          - coalesce(sum(payment.amount) filter (where payment.payment_direction = 'out'), 0)
          from public.payments payment where payment.shop_id = p_shop_id
            and payment.location_id = location.id and payment.status = 'completed'
            and payment.customer_kind is not null and payment.paid_at >= v_from and payment.paid_at < v_to), 0),
        'expenses', case when v_can_view_costs then coalesce((select sum(expense.amount) from public.expenses expense
          where expense.shop_id = p_shop_id and expense.location_id = location.id
            and expense.status = 'paid' and expense.expense_date >= v_from and expense.expense_date < v_to), 0) else null end,
        'cashVariance', coalesce((select sum(session.variance_amount) from public.cash_sessions session
          where session.shop_id = p_shop_id and session.location_id = location.id
            and session.status = 'closed' and session.closed_at >= v_from and session.closed_at < v_to), 0))
        order by location.is_default desc, location.name, location.id), '[]'::jsonb)
      from public.shop_locations location
      where location.shop_id = p_shop_id
        and (p_location_id is null or location.id = p_location_id)
        and shop_private.user_can_access_location(p_shop_id, location.id))
  ) into v_result;
  return v_result;
end;
$$;

create function public.shop_operating_report(
  p_shop_id uuid,
  p_location_id uuid default null,
  p_period text default 'day',
  p_anchor_date date default (now() at time zone 'Africa/Cairo')::date
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select shop_private.shop_operating_report(p_shop_id, p_location_id, p_period, p_anchor_date);
$$;

revoke all on function shop_private.shop_operating_report(uuid, uuid, text, date)
  from public, anon, authenticated;
grant execute on function shop_private.shop_operating_report(uuid, uuid, text, date)
  to service_role;
revoke all on function public.shop_operating_report(uuid, uuid, text, date)
  from public, anon, authenticated;
grant execute on function public.shop_operating_report(uuid, uuid, text, date)
  to authenticated;

comment on function public.shop_operating_report(uuid, uuid, text, date) is
  'Permission and location scoped operational metrics from complete Shop Suit source history; not a formal accounting statement.';

notify pgrst, 'reload schema';
