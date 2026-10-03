-- SS-RPT-001: full-history operational reports and export source contract.
-- These reports reconcile Shop Suit operational records. They are not a
-- general ledger, profit and loss statement, or other formal accounting output.

create function shop_private.shop_operational_report(
  p_shop_id uuid,
  p_report text,
  p_location_id uuid default null,
  p_from date default null,
  p_to date default null,
  p_page integer default 1,
  p_page_size integer default 20
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_from timestamptz;
  v_to timestamptz;
  v_can_view_costs boolean;
  v_summary jsonb := '{}'::jsonb;
  v_items jsonb := '[]'::jsonb;
  v_total bigint := 0;
begin
  perform shop_private.assert_team_permission(p_shop_id, 'reports.view');
  v_can_view_costs := shop_private.has_permission(p_shop_id, 'reports.cost_profit.view');

  if p_report is null or p_report not in (
    'sales', 'collections', 'receivables', 'suppliers', 'expenses', 'inventory', 'margin', 'activity'
  ) or p_page is null or p_page_size is null or p_page < 1
    or p_page_size < 1 or p_page_size > 500
    or (p_from is not null and p_to is not null and p_from > p_to) then
    raise exception 'INVALID_OPERATIONAL_REPORT_QUERY' using errcode = '22023';
  end if;
  if p_location_id is not null then
    perform shop_private.assert_location_access(p_shop_id, p_location_id, false);
  end if;
  if p_report in ('suppliers', 'expenses', 'inventory', 'margin')
    and not v_can_view_costs then
    raise exception 'REPORT_COST_PERMISSION_DENIED' using errcode = '42501';
  end if;

  v_from := case when p_from is null then null
    else p_from::timestamp at time zone 'Africa/Cairo' end;
  v_to := case when p_to is null then null
    else (p_to + 1)::timestamp at time zone 'Africa/Cairo' end;

  if p_report = 'sales' then
    with rows as (
      select item.id, invoice.id invoice_id, invoice.invoice_number,
        coalesce(invoice.issued_at, invoice.created_at) occurred_at,
        invoice.location_id, location.name location_name,
        item.item_type::text item_type, item.item_name,
        item.product_id, item.service_id, item.quantity,
        item.total_amount amount, invoice.client_id,
        invoice.client_name_snapshot customer_name,
        '/sales/' || invoice.id::text source_path
      from public.invoice_items item
      join public.invoices invoice on invoice.id = item.invoice_id
        and invoice.shop_id = item.shop_id
      join public.shop_locations location on location.id = invoice.location_id
        and location.shop_id = invoice.shop_id
      where invoice.shop_id = p_shop_id and invoice.status in ('issued', 'paid')
        and not exists (select 1 from public.sale_corrections correction
          where correction.invoice_id = invoice.id)
        and (p_location_id is null or invoice.location_id = p_location_id)
        and shop_private.user_can_access_location(p_shop_id, invoice.location_id)
        and (v_from is null or coalesce(invoice.issued_at, invoice.created_at) >= v_from)
        and (v_to is null or coalesce(invoice.issued_at, invoice.created_at) < v_to)
    ), page_rows as (
      select * from rows order by occurred_at desc, id desc
      offset (p_page - 1) * p_page_size limit p_page_size
    )
    select (select count(*) from rows), coalesce((select jsonb_agg(to_jsonb(page_rows)
      order by occurred_at desc, id desc) from page_rows), '[]'::jsonb)
    into v_total, v_items;

    select jsonb_build_object(
      'sales', coalesce(sum(invoice.total_amount), 0),
      'saleCount', count(*),
      'averageTicket', case when count(*) = 0 then 0
        else round(sum(invoice.total_amount) / count(*), 2) end,
      'productSales', coalesce(sum((select sum(item.total_amount)
        from public.invoice_items item where item.invoice_id = invoice.id
          and item.item_type = 'product')), 0),
      'serviceSales', coalesce(sum((select sum(item.total_amount)
        from public.invoice_items item where item.invoice_id = invoice.id
          and item.item_type = 'service')), 0)
    ) into v_summary
    from public.invoices invoice
    where invoice.shop_id = p_shop_id and invoice.status in ('issued', 'paid')
      and not exists (select 1 from public.sale_corrections correction
        where correction.invoice_id = invoice.id)
      and (p_location_id is null or invoice.location_id = p_location_id)
      and shop_private.user_can_access_location(p_shop_id, invoice.location_id)
      and (v_from is null or coalesce(invoice.issued_at, invoice.created_at) >= v_from)
      and (v_to is null or coalesce(invoice.issued_at, invoice.created_at) < v_to);

  elsif p_report = 'collections' then
    with rows as (
      select payment.id, payment.paid_at occurred_at, payment.location_id,
        location.name location_name, payment.client_id customer_id,
        coalesce(client.name, 'Walk-in') customer_name,
        payment.payment_direction::text direction, payment.method::text method,
        payment.amount, payment.reference,
        case when payment.client_id is null then '/sales'
          else '/customers/' || payment.client_id::text end source_path
      from public.payments payment
      join public.shop_locations location on location.id = payment.location_id
        and location.shop_id = payment.shop_id
      left join public.clients client on client.id = payment.client_id
        and client.shop_id = payment.shop_id
      where payment.shop_id = p_shop_id and payment.status = 'completed'
        and payment.customer_kind is not null
        and (p_location_id is null or payment.location_id = p_location_id)
        and shop_private.user_can_access_location(p_shop_id, payment.location_id)
        and (v_from is null or payment.paid_at >= v_from)
        and (v_to is null or payment.paid_at < v_to)
    ), page_rows as (
      select * from rows order by occurred_at desc, id desc
      offset (p_page - 1) * p_page_size limit p_page_size
    )
    select (select count(*) from rows), coalesce((select jsonb_agg(to_jsonb(page_rows)
      order by occurred_at desc, id desc) from page_rows), '[]'::jsonb)
    into v_total, v_items;

    with payment_totals as (
      select coalesce(sum(payment.amount) filter (where payment.payment_direction = 'in'), 0) collected,
        coalesce(sum(payment.amount) filter (where payment.payment_direction = 'out'), 0) refunded
      from public.payments payment
      where payment.shop_id = p_shop_id and payment.status = 'completed'
        and payment.customer_kind is not null
        and (p_location_id is null or payment.location_id = p_location_id)
        and shop_private.user_can_access_location(p_shop_id, payment.location_id)
        and (v_from is null or payment.paid_at >= v_from)
        and (v_to is null or payment.paid_at < v_to)
    ), balances as (
      select invoice.client_id,
        sum(invoice.total_amount - coalesce((select sum(shop_private.allocation_remaining(allocation.id))
          from public.customer_payment_allocations allocation
          where allocation.invoice_id = invoice.id), 0)) amount
      from public.invoices invoice
      where invoice.shop_id = p_shop_id and invoice.client_id is not null
        and invoice.status in ('issued', 'paid')
        and not exists (select 1 from public.sale_corrections correction
          where correction.invoice_id = invoice.id)
        and (p_location_id is null or invoice.location_id = p_location_id)
        and shop_private.user_can_access_location(p_shop_id, invoice.location_id)
      group by invoice.client_id
      having sum(invoice.total_amount - coalesce((select sum(shop_private.allocation_remaining(allocation.id))
        from public.customer_payment_allocations allocation
        where allocation.invoice_id = invoice.id), 0)) > 0
    )
    select jsonb_build_object('collected', totals.collected,
      'refunded', totals.refunded, 'netCollections', totals.collected - totals.refunded,
      'outstanding', coalesce((select sum(amount) from balances), 0),
      'outstandingCustomerCount', (select count(*) from balances))
    into v_summary from payment_totals totals;

  elsif p_report = 'receivables' then
    with rows as (
      select invoice.client_id id, coalesce(max(client.name), max(invoice.client_name_snapshot), '—') customer_name,
        count(*) invoice_count, min(invoice.due_date) oldest_due_date,
        sum(invoice.total_amount - coalesce((select sum(shop_private.allocation_remaining(allocation.id))
          from public.customer_payment_allocations allocation
          where allocation.invoice_id = invoice.id), 0)) outstanding,
        '/customers/' || invoice.client_id::text source_path
      from public.invoices invoice
      left join public.clients client on client.id = invoice.client_id
        and client.shop_id = invoice.shop_id
      where invoice.shop_id = p_shop_id and invoice.client_id is not null
        and invoice.status in ('issued', 'paid')
        and not exists (select 1 from public.sale_corrections correction
          where correction.invoice_id = invoice.id)
        and (p_location_id is null or invoice.location_id = p_location_id)
        and shop_private.user_can_access_location(p_shop_id, invoice.location_id)
      group by invoice.client_id
      having sum(invoice.total_amount - coalesce((select sum(shop_private.allocation_remaining(allocation.id))
        from public.customer_payment_allocations allocation
        where allocation.invoice_id = invoice.id), 0)) > 0
    ), page_rows as (
      select * from rows order by outstanding desc, customer_name, id
      offset (p_page - 1) * p_page_size limit p_page_size
    )
    select (select count(*) from rows), coalesce((select jsonb_agg(to_jsonb(page_rows)
      order by outstanding desc, customer_name, id) from page_rows), '[]'::jsonb)
    into v_total, v_items;
    select jsonb_build_object('outstanding', coalesce(sum(balance.outstanding), 0),
      'outstandingCustomerCount', count(*),
      'overdueCustomerCount', count(*) filter (where balance.oldest_due_date <
        (now() at time zone 'Africa/Cairo')::date))
    into v_summary from (
      select invoice.client_id, min(invoice.due_date) oldest_due_date,
        sum(invoice.total_amount - coalesce((select sum(shop_private.allocation_remaining(allocation.id))
          from public.customer_payment_allocations allocation
          where allocation.invoice_id = invoice.id), 0)) outstanding
      from public.invoices invoice
      where invoice.shop_id = p_shop_id and invoice.client_id is not null
        and invoice.status in ('issued', 'paid')
        and not exists (select 1 from public.sale_corrections correction
          where correction.invoice_id = invoice.id)
        and (p_location_id is null or invoice.location_id = p_location_id)
        and shop_private.user_can_access_location(p_shop_id, invoice.location_id)
      group by invoice.client_id
      having sum(invoice.total_amount - coalesce((select sum(shop_private.allocation_remaining(allocation.id))
        from public.customer_payment_allocations allocation
        where allocation.invoice_id = invoice.id), 0)) > 0
    ) balance;

  elsif p_report = 'suppliers' then
    with rows as (
      select invoice.id, invoice.issued_at occurred_at, invoice.location_id,
        location.name location_name, invoice.vendor_id supplier_id,
        invoice.vendor_name_snapshot supplier_name, invoice.invoice_number,
        invoice.total_amount purchase_amount,
        shop_private.purchase_payable(invoice.id) payable,
        invoice.status::text status,
        '/purchases/' || invoice.id::text source_path
      from public.vendor_invoices invoice
      join public.shop_locations location on location.id = invoice.location_id
        and location.shop_id = invoice.shop_id
      where invoice.shop_id = p_shop_id
        and (p_location_id is null or invoice.location_id = p_location_id)
        and shop_private.user_can_access_location(p_shop_id, invoice.location_id)
        and (v_from is null or invoice.issued_at >= v_from)
        and (v_to is null or invoice.issued_at < v_to)
    ), page_rows as (
      select * from rows order by occurred_at desc nulls last, id desc
      offset (p_page - 1) * p_page_size limit p_page_size
    )
    select (select count(*) from rows), coalesce((select jsonb_agg(to_jsonb(page_rows)
      order by occurred_at desc nulls last, id desc) from page_rows), '[]'::jsonb)
    into v_total, v_items;

    select jsonb_build_object(
      'purchases', coalesce((select sum(invoice.total_amount)
        from public.vendor_invoices invoice where invoice.shop_id = p_shop_id
          and invoice.status = 'posted'
          and (p_location_id is null or invoice.location_id = p_location_id)
          and shop_private.user_can_access_location(p_shop_id, invoice.location_id)
          and (v_from is null or invoice.issued_at >= v_from)
          and (v_to is null or invoice.issued_at < v_to)), 0),
      'supplierPayments', coalesce((select sum(payment.amount)
        from public.payments payment where payment.shop_id = p_shop_id
          and payment.status = 'completed' and payment.supplier_kind = 'payment'
          and (p_location_id is null or payment.location_id = p_location_id)
          and shop_private.user_can_access_location(p_shop_id, payment.location_id)
          and (v_from is null or payment.paid_at >= v_from)
          and (v_to is null or payment.paid_at < v_to)), 0)
        - coalesce((select sum(reversal.amount)
          from public.supplier_payment_reversals reversal
          join public.supplier_payment_allocations allocation
            on allocation.id = reversal.original_allocation_id
          join public.payments payment on payment.id = allocation.payment_id
          where reversal.shop_id = p_shop_id
            and (p_location_id is null or payment.location_id = p_location_id)
            and shop_private.user_can_access_location(p_shop_id, payment.location_id)
            and (v_from is null or reversal.effective_at >= v_from)
            and (v_to is null or reversal.effective_at < v_to)), 0),
      'payable', coalesce((select sum(shop_private.purchase_payable(invoice.id))
        from public.vendor_invoices invoice where invoice.shop_id = p_shop_id
          and (p_location_id is null or invoice.location_id = p_location_id)
          and shop_private.user_can_access_location(p_shop_id, invoice.location_id)), 0),
      'openPurchaseCount', (select count(*) from public.vendor_invoices invoice
        where invoice.shop_id = p_shop_id and shop_private.purchase_payable(invoice.id) > 0
          and (p_location_id is null or invoice.location_id = p_location_id)
          and shop_private.user_can_access_location(p_shop_id, invoice.location_id))
    ) into v_summary;

  elsif p_report = 'expenses' then
    with rows as (
      select expense.id, expense.expense_date occurred_at, expense.location_id,
        location.name location_name, expense.title,
        coalesce(category.name, 'Uncategorised') category_name,
        expense.amount, expense.status::text status, expense.notes,
        '/expenses' source_path
      from public.expenses expense
      join public.shop_locations location on location.id = expense.location_id
        and location.shop_id = expense.shop_id
      left join public.expense_categories category on category.id = expense.category_id
        and category.shop_id = expense.shop_id
      where expense.shop_id = p_shop_id and expense.status = 'paid'
        and (p_location_id is null or expense.location_id = p_location_id)
        and shop_private.user_can_access_location(p_shop_id, expense.location_id)
        and (v_from is null or expense.expense_date >= v_from)
        and (v_to is null or expense.expense_date < v_to)
    ), page_rows as (
      select * from rows order by occurred_at desc, id desc
      offset (p_page - 1) * p_page_size limit p_page_size
    )
    select (select count(*) from rows), coalesce((select jsonb_agg(to_jsonb(page_rows)
      order by occurred_at desc, id desc) from page_rows), '[]'::jsonb)
    into v_total, v_items;

    with expense_totals as (
      select coalesce(sum(expense.amount), 0) expenses, count(*) expense_count,
        count(distinct expense.category_id) category_count
      from public.expenses expense
      where expense.shop_id = p_shop_id and expense.status = 'paid'
        and (p_location_id is null or expense.location_id = p_location_id)
        and shop_private.user_can_access_location(p_shop_id, expense.location_id)
        and (v_from is null or expense.expense_date >= v_from)
        and (v_to is null or expense.expense_date < v_to)
    ), sales_total as (
      select coalesce(sum(invoice.total_amount), 0) sales
      from public.invoices invoice
      where invoice.shop_id = p_shop_id and invoice.status in ('issued', 'paid')
        and not exists (select 1 from public.sale_corrections correction
          where correction.invoice_id = invoice.id)
        and (p_location_id is null or invoice.location_id = p_location_id)
        and shop_private.user_can_access_location(p_shop_id, invoice.location_id)
        and (v_from is null or coalesce(invoice.issued_at, invoice.created_at) >= v_from)
        and (v_to is null or coalesce(invoice.issued_at, invoice.created_at) < v_to)
    )
    select jsonb_build_object('expenses', expenses.expenses,
      'expenseCount', expenses.expense_count, 'categoryCount', expenses.category_count,
      'sales', sales.sales, 'operatingResult', sales.sales - expenses.expenses)
    into v_summary from expense_totals expenses cross join sales_total sales;

  elsif p_report = 'inventory' then
    with rows as (
      select product.id, product.name, product.sku, product.is_active,
        coalesce(sum(batch.remaining_quantity), 0) quantity_on_hand,
        coalesce(sum(batch.remaining_quantity * batch.unit_cost), 0) inventory_value,
        product.reorder_threshold,
        product.is_active and product.reorder_threshold > 0
          and coalesce(sum(batch.remaining_quantity), 0) <= product.reorder_threshold low_stock,
        (select count(*) from public.inventory_movements movement
          where movement.shop_id = p_shop_id and movement.product_id = product.id
            and (p_location_id is null or movement.location_id = p_location_id)
            and shop_private.user_can_access_location(p_shop_id, movement.location_id)
            and (v_from is null or movement.created_at >= v_from)
            and (v_to is null or movement.created_at < v_to)) movement_count,
        (select max(movement.created_at) from public.inventory_movements movement
          where movement.shop_id = p_shop_id and movement.product_id = product.id
            and (p_location_id is null or movement.location_id = p_location_id)
            and shop_private.user_can_access_location(p_shop_id, movement.location_id)) last_movement_at,
        '/inventory?product=' || product.id::text source_path
      from public.products product
      left join public.inventory_batches batch on batch.product_id = product.id
        and batch.shop_id = product.shop_id
        and (p_location_id is null or batch.location_id = p_location_id)
        and shop_private.user_can_access_location(p_shop_id, batch.location_id)
      where product.shop_id = p_shop_id
      group by product.id
    ), page_rows as (
      select * from rows order by low_stock desc, name, id
      offset (p_page - 1) * p_page_size limit p_page_size
    )
    select (select count(*) from rows), coalesce((select jsonb_agg(to_jsonb(page_rows)
      order by low_stock desc, name, id) from page_rows), '[]'::jsonb)
    into v_total, v_items;

    with stock as (
      select product.id, product.is_active, product.reorder_threshold,
        coalesce(sum(batch.remaining_quantity), 0) quantity,
        coalesce(sum(batch.remaining_quantity * batch.unit_cost), 0) value
      from public.products product
      left join public.inventory_batches batch on batch.product_id = product.id
        and batch.shop_id = product.shop_id
        and (p_location_id is null or batch.location_id = p_location_id)
        and shop_private.user_can_access_location(p_shop_id, batch.location_id)
      where product.shop_id = p_shop_id group by product.id
    )
    select jsonb_build_object('quantityOnHand', coalesce(sum(quantity), 0),
      'inventoryValue', coalesce(sum(value), 0), 'productCount', count(*),
      'lowStockCount', count(*) filter (where is_active and reorder_threshold > 0
        and quantity <= reorder_threshold), 'snapshot', true)
    into v_summary from stock;

  elsif p_report = 'margin' then
    with lines as (
      select item.id, invoice.id invoice_id, invoice.invoice_number,
        coalesce(invoice.issued_at, invoice.created_at) occurred_at,
        invoice.location_id, location.name location_name,
        item.product_id, item.item_name, item.quantity,
        item.total_amount revenue,
        coalesce(sum(-movement.quantity_change * movement.unit_cost_snapshot), 0) fifo_cost,
        count(movement.id) > 0
          and bool_and(movement.unit_cost_snapshot is not null)
          and coalesce(sum(-movement.quantity_change), 0) = item.quantity cost_defined,
        '/sales/' || invoice.id::text source_path
      from public.invoice_items item
      join public.invoices invoice on invoice.id = item.invoice_id
        and invoice.shop_id = item.shop_id
      join public.shop_locations location on location.id = invoice.location_id
        and location.shop_id = invoice.shop_id
      left join public.inventory_movements movement on movement.invoice_item_id = item.id
        and movement.shop_id = invoice.shop_id and movement.movement_type = 'out'
      where invoice.shop_id = p_shop_id and invoice.status in ('issued', 'paid')
        and item.item_type = 'product'
        and not exists (select 1 from public.sale_corrections correction
          where correction.invoice_id = invoice.id)
        and (p_location_id is null or invoice.location_id = p_location_id)
        and shop_private.user_can_access_location(p_shop_id, invoice.location_id)
        and (v_from is null or coalesce(invoice.issued_at, invoice.created_at) >= v_from)
        and (v_to is null or coalesce(invoice.issued_at, invoice.created_at) < v_to)
      group by item.id, invoice.id, invoice.invoice_number, invoice.issued_at,
        invoice.created_at, invoice.location_id, location.name
    ), reconciled as (
      select *, revenue - fifo_cost margin,
        case when revenue = 0 then null else round((revenue - fifo_cost) / revenue * 100, 2) end margin_percent
      from lines where cost_defined
    ), page_rows as (
      select * from reconciled order by occurred_at desc, id desc
      offset (p_page - 1) * p_page_size limit p_page_size
    )
    select (select count(*) from reconciled), coalesce((select jsonb_agg(to_jsonb(page_rows)
      order by occurred_at desc, id desc) from page_rows), '[]'::jsonb)
    into v_total, v_items;

    with lines as (
      select item.id, item.quantity, item.total_amount revenue,
        coalesce(sum(-movement.quantity_change * movement.unit_cost_snapshot), 0) fifo_cost,
        count(movement.id) > 0
          and bool_and(movement.unit_cost_snapshot is not null)
          and coalesce(sum(-movement.quantity_change), 0) = item.quantity cost_defined
      from public.invoice_items item
      join public.invoices invoice on invoice.id = item.invoice_id
        and invoice.shop_id = item.shop_id
      left join public.inventory_movements movement on movement.invoice_item_id = item.id
        and movement.shop_id = invoice.shop_id and movement.movement_type = 'out'
      where invoice.shop_id = p_shop_id and invoice.status in ('issued', 'paid')
        and item.item_type = 'product'
        and not exists (select 1 from public.sale_corrections correction
          where correction.invoice_id = invoice.id)
        and (p_location_id is null or invoice.location_id = p_location_id)
        and shop_private.user_can_access_location(p_shop_id, invoice.location_id)
        and (v_from is null or coalesce(invoice.issued_at, invoice.created_at) >= v_from)
        and (v_to is null or coalesce(invoice.issued_at, invoice.created_at) < v_to)
      group by item.id
    )
    select jsonb_build_object(
      'revenue', coalesce(sum(revenue) filter (where cost_defined), 0),
      'fifoCost', coalesce(sum(fifo_cost) filter (where cost_defined), 0),
      'margin', coalesce(sum(revenue - fifo_cost) filter (where cost_defined), 0),
      'marginPercent', case when coalesce(sum(revenue) filter (where cost_defined), 0) = 0 then null
        else round(sum(revenue - fifo_cost) filter (where cost_defined)
          / sum(revenue) filter (where cost_defined) * 100, 2) end,
      'reconciledLineCount', count(*) filter (where cost_defined),
      'excludedLineCount', count(*) filter (where not cost_defined),
      'costBasis', 'FIFO inventory movements; services and unreconciled product lines excluded'
    ) into v_summary from lines;

  else
    with events as (
      select invoice.id, coalesce(invoice.issued_at, invoice.created_at) occurred_at,
        invoice.location_id, location.name location_name, 'sale' event_type,
        coalesce(invoice.invoice_number, invoice.id::text) label,
        invoice.total_amount amount, '/sales/' || invoice.id::text source_path
      from public.invoices invoice join public.shop_locations location
        on location.id = invoice.location_id and location.shop_id = invoice.shop_id
      where invoice.shop_id = p_shop_id and invoice.status in ('issued', 'paid')
        and (p_location_id is null or invoice.location_id = p_location_id)
        and shop_private.user_can_access_location(p_shop_id, invoice.location_id)
      union all
      select payment.id, payment.paid_at, payment.location_id, location.name,
        'customer_payment', coalesce(payment.reference, payment.method::text), payment.amount,
        case when payment.client_id is null then '/sales'
          else '/customers/' || payment.client_id::text end
      from public.payments payment join public.shop_locations location
        on location.id = payment.location_id and location.shop_id = payment.shop_id
      where payment.shop_id = p_shop_id and payment.customer_kind is not null
        and payment.status = 'completed'
        and (p_location_id is null or payment.location_id = p_location_id)
        and shop_private.user_can_access_location(p_shop_id, payment.location_id)
      union all
      select purchase.id, coalesce(purchase.issued_at, purchase.created_at), purchase.location_id,
        location.name, 'purchase', purchase.vendor_name_snapshot,
        case when v_can_view_costs then purchase.total_amount else null end,
        '/purchases/' || purchase.id::text
      from public.vendor_invoices purchase join public.shop_locations location
        on location.id = purchase.location_id and location.shop_id = purchase.shop_id
      where purchase.shop_id = p_shop_id
        and (p_location_id is null or purchase.location_id = p_location_id)
        and shop_private.user_can_access_location(p_shop_id, purchase.location_id)
      union all
      select expense.id, expense.expense_date, expense.location_id, location.name,
        'expense', expense.title, case when v_can_view_costs then expense.amount else null end,
        '/expenses'
      from public.expenses expense join public.shop_locations location
        on location.id = expense.location_id and location.shop_id = expense.shop_id
      where expense.shop_id = p_shop_id
        and (p_location_id is null or expense.location_id = p_location_id)
        and shop_private.user_can_access_location(p_shop_id, expense.location_id)
      union all
      select movement.id, movement.created_at, movement.location_id, location.name,
        'stock_movement', product.name,
        case when v_can_view_costs then movement.quantity_change * movement.unit_cost_snapshot else null end,
        '/inventory?product=' || movement.product_id::text
      from public.inventory_movements movement
      join public.products product on product.id = movement.product_id
        and product.shop_id = movement.shop_id
      join public.shop_locations location on location.id = movement.location_id
        and location.shop_id = movement.shop_id
      where movement.shop_id = p_shop_id
        and (p_location_id is null or movement.location_id = p_location_id)
        and shop_private.user_can_access_location(p_shop_id, movement.location_id)
    ), filtered as (
      select * from events where (v_from is null or occurred_at >= v_from)
        and (v_to is null or occurred_at < v_to)
    ), page_rows as (
      select * from filtered order by occurred_at desc, event_type, id desc
      offset (p_page - 1) * p_page_size limit p_page_size
    )
    select (select count(*) from filtered), coalesce((select jsonb_agg(to_jsonb(page_rows)
      order by occurred_at desc, event_type, id desc) from page_rows), '[]'::jsonb)
    into v_total, v_items;
    v_summary := jsonb_build_object('activityCount', v_total);
  end if;

  return jsonb_build_object(
    'report', p_report, 'locationId', p_location_id, 'fromDate', p_from,
    'toDate', p_to, 'timezone', 'Africa/Cairo', 'canViewCosts', v_can_view_costs,
    'operationalOnly', true, 'summary', coalesce(v_summary, '{}'::jsonb),
    'items', coalesce(v_items, '[]'::jsonb), 'total', v_total,
    'page', p_page, 'pageSize', p_page_size
  );
end;
$$;

create function public.shop_operational_report(
  p_shop_id uuid,
  p_report text,
  p_location_id uuid default null,
  p_from date default null,
  p_to date default null,
  p_page integer default 1,
  p_page_size integer default 20
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select shop_private.shop_operational_report(
    p_shop_id, p_report, p_location_id, p_from, p_to, p_page, p_page_size
  );
$$;

revoke all on function shop_private.shop_operational_report(
  uuid, text, uuid, date, date, integer, integer
) from public, anon, authenticated;
grant execute on function shop_private.shop_operational_report(
  uuid, text, uuid, date, date, integer, integer
) to service_role;
revoke all on function public.shop_operational_report(
  uuid, text, uuid, date, date, integer, integer
) from public, anon, authenticated;
grant execute on function public.shop_operational_report(
  uuid, text, uuid, date, date, integer, integer
) to authenticated;

comment on function public.shop_operational_report(
  uuid, text, uuid, date, date, integer, integer
) is 'Paginated, export-compatible Shop operational reports reconciled from source records; not formal financial statements.';

notify pgrst, 'reload schema';
