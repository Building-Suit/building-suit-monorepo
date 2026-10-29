begin;

-- SS-ELEC-103. Coherent precision upgrade. No operational activation yet.
-- Every quantity is widened without rounding. Financial totals retain currency
-- precision; unit acquisition costs and frozen unit prices use twelve decimals.
-- Reviewed dependent views are rebuilt with identical SQL/security and ACLs.
create temporary table measurement_view_acl on commit drop as
select c.relname, a.grantee, a.privilege_type, a.is_grantable
from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
cross join lateral pg_catalog.aclexplode(coalesce(c.relacl,pg_catalog.acldefault('r',c.relowner))) a
where n.nspname='public' and c.relkind='v' and c.relname=any(array['cash_flow_daily','cash_flow_monthly','client_balances','cogs_movements','invoice_product_cogs','invoice_cogs','invoice_product_revenue','daily_cogs_margin','inventory_stock_batches','product_last_sale','dead_stock','inventory_aging','inventory_aging_value','product_average_inventory','product_sales_90d','inventory_turnover','invoice_paid_amounts','invoice_balances','invoice_gross_margin','product_stock','low_stock_products','monthly_cogs_margin','net_profit','product_profitability','vendor_balances','vendor_invoice_paid_amounts','vendor_invoice_balances']);
do $$begin
 if exists(select 1 from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relkind='v' and c.relname=any(array['cash_flow_daily','cash_flow_monthly','client_balances','cogs_movements','invoice_product_cogs','invoice_cogs','invoice_product_revenue','daily_cogs_margin','inventory_stock_batches','product_last_sale','dead_stock','inventory_aging','inventory_aging_value','product_average_inventory','product_sales_90d','inventory_turnover','invoice_paid_amounts','invoice_balances','invoice_gross_margin','product_stock','low_stock_products','monthly_cogs_margin','net_profit','product_profitability','vendor_balances','vendor_invoice_paid_amounts','vendor_invoice_balances'])
 and pg_catalog.pg_get_userbyid(c.relowner)<>current_user) then
 raise exception 'MEASUREMENT_VIEW_OWNER_REVIEW_REQUIRED' using errcode='55000';end if;
end;$$;


-- Column-specific trigger dependencies are rebuilt unchanged within this transaction.
drop trigger trg_invoice_items_snapshot_service_schedule on public.invoice_items;
drop trigger measurement_threshold_guard on public.products;

drop view public.vendor_invoice_balances;

drop view public.vendor_invoice_paid_amounts;

drop view public.vendor_balances;

drop view public.product_profitability;

drop view public.net_profit;

drop view public.monthly_cogs_margin;

drop view public.low_stock_products;

drop view public.product_stock;

drop view public.invoice_gross_margin;

drop view public.invoice_balances;

drop view public.invoice_paid_amounts;

drop view public.inventory_turnover;

drop view public.product_sales_90d;

drop view public.product_average_inventory;

drop view public.inventory_aging_value;

drop view public.inventory_aging;

drop view public.dead_stock;

drop view public.product_last_sale;

drop view public.inventory_stock_batches;

drop view public.daily_cogs_margin;

drop view public.invoice_product_revenue;

drop view public.invoice_cogs;

drop view public.invoice_product_cogs;

drop view public.cogs_movements;

drop view public.client_balances;

drop view public.cash_flow_monthly;

drop view public.cash_flow_daily;

alter table public.inventory_batches
 alter column quantity_received type numeric(18,6),
 alter column remaining_quantity type numeric(18,6),
 alter column unit_cost type numeric(24,12);

alter table public.inventory_movements
 alter column quantity_change type numeric(18,6),
 alter column unit_cost_snapshot type numeric(24,12);

alter table public.commission_snapshots
 alter column quantity type numeric(18,6);

alter table public.invoice_items
 alter column quantity type numeric(18,6),
 alter column unit_price type numeric(24,12);

alter table public.inventory_threshold_changes
 alter column previous_threshold type numeric(18,6),
 alter column new_threshold type numeric(18,6);

alter table public.products
 alter column sale_price type numeric(18,6),
 alter column reorder_threshold type numeric(18,6);

alter table public.purchase_return_items
 alter column quantity type numeric(18,6),
 alter column unit_cost type numeric(24,12);

alter table public.sale_corrections
 alter column restored_quantity type numeric(18,6);

alter table public.sale_return_lines
 alter column quantity type numeric(18,6);

alter table public.sale_return_stock
 alter column quantity type numeric(18,6);

alter table public.service_fulfillments
 alter column quantity type numeric(18,6);

alter table public.service_material_consumptions
 alter column quantity type numeric(18,6),
 alter column unit_cost type numeric(24,12);

alter table public.service_material_corrections
 alter column quantity type numeric(18,6);

alter table public.stock_adjustment_requests
 alter column unit_cost type numeric(24,12);

alter table public.stock_counts
 alter column expected_quantity type numeric(18,6),
 alter column counted_quantity type numeric(18,6),
 alter column variance_quantity type numeric(18,6),
 alter column positive_variance_unit_cost type numeric(24,12);

alter table public.vendor_invoice_items
 alter column quantity type numeric(18,6),
 alter column unit_cost type numeric(24,12);

CREATE VIEW public.cash_flow_daily WITH (security_invoker='true') AS
 SELECT shop_id,
    day,
    sum(net_amount) AS net_cash_flow
   FROM ( SELECT payments.shop_id,
            date_trunc('day'::text, payments.paid_at) AS day,
                CASE
                    WHEN (payments.payment_direction = 'in'::public.payment_direction) THEN payments.amount
                    ELSE (- payments.amount)
                END AS net_amount
           FROM public.payments
          WHERE (payments.status = 'completed'::public.payment_status)
        UNION ALL
         SELECT expenses.shop_id,
            date_trunc('day'::text, expenses.paid_at) AS day,
            (- expenses.amount) AS net_amount
           FROM public.expenses
          WHERE ((expenses.status = 'paid'::public.expense_status) AND (expenses.paid_at IS NOT NULL))) t
  GROUP BY shop_id, day;

CREATE VIEW public.cash_flow_monthly WITH (security_invoker='true') AS
 SELECT shop_id,
    month,
    sum(net_amount) AS net_cash_flow
   FROM ( SELECT payments.shop_id,
            date_trunc('month'::text, payments.paid_at) AS month,
                CASE
                    WHEN (payments.payment_direction = 'in'::public.payment_direction) THEN payments.amount
                    ELSE (- payments.amount)
                END AS net_amount
           FROM public.payments
          WHERE (payments.status = 'completed'::public.payment_status)
        UNION ALL
         SELECT expenses.shop_id,
            date_trunc('month'::text, expenses.paid_at) AS month,
            (- expenses.amount) AS net_amount
           FROM public.expenses
          WHERE ((expenses.status = 'paid'::public.expense_status) AND (expenses.paid_at IS NOT NULL))) t
  GROUP BY shop_id, month;

CREATE VIEW public.client_balances WITH (security_invoker='true') AS
 SELECT c.id AS client_id,
    c.shop_id,
    (COALESCE(sum(i.total_amount), (0)::numeric) - COALESCE(sum(p.amount), (0)::numeric)) AS balance
   FROM ((public.clients c
     LEFT JOIN public.invoices i ON ((i.client_id = c.id)))
     LEFT JOIN public.payments p ON (((p.client_id = c.id) AND (p.payment_direction = 'in'::public.payment_direction) AND (p.status = 'completed'::public.payment_status))))
  GROUP BY c.id, c.shop_id;

CREATE VIEW public.cogs_movements WITH (security_invoker='true') AS
 SELECT im.shop_id,
    im.reference_id AS invoice_id,
    im.product_id,
    im.batch_id,
    abs(im.quantity_change) AS quantity_sold,
    b.unit_cost,
    abs((im.quantity_change * b.unit_cost)) AS cogs_amount,
    im.created_at
   FROM (public.inventory_movements im
     JOIN public.inventory_batches b ON ((b.id = im.batch_id)))
  WHERE (im.movement_type = 'out'::public.inventory_movement_type);

CREATE VIEW public.invoice_product_cogs WITH (security_invoker='true') AS
 SELECT invoice_id,
    product_id,
    sum(cogs_amount) AS product_cogs
   FROM public.cogs_movements
  GROUP BY invoice_id, product_id;

CREATE VIEW public.invoice_cogs WITH (security_invoker='true') AS
 SELECT invoice_id,
    sum(product_cogs) AS total_cogs
   FROM public.invoice_product_cogs
  GROUP BY invoice_id;

CREATE VIEW public.invoice_product_revenue WITH (security_invoker='true') AS
 SELECT invoice_id,
    sum(((unit_price * quantity) - COALESCE(discount_amount, (0)::numeric))) AS product_revenue
   FROM public.invoice_items ii
  WHERE (item_type = 'product'::public.invoice_item_type)
  GROUP BY invoice_id;

CREATE VIEW public.daily_cogs_margin WITH (security_invoker='true') AS
 SELECT i.shop_id,
    date_trunc('day'::text, i.issued_at) AS day,
    sum(ipr.product_revenue) AS revenue,
    sum(ic.total_cogs) AS cogs,
    (sum(ipr.product_revenue) - sum(ic.total_cogs)) AS gross_profit
   FROM ((public.invoices i
     JOIN public.invoice_product_revenue ipr ON ((ipr.invoice_id = i.id)))
     JOIN public.invoice_cogs ic ON ((ic.invoice_id = i.id)))
  GROUP BY i.shop_id, (date_trunc('day'::text, i.issued_at));

CREATE VIEW public.inventory_stock_batches WITH (security_invoker='true') AS
 SELECT shop_id,
    product_id,
    id AS batch_id,
    received_at,
    unit_cost,
    remaining_quantity,
    (now() - received_at) AS age_interval
   FROM public.inventory_batches
  WHERE (remaining_quantity > (0)::numeric);

CREATE VIEW public.product_last_sale WITH (security_invoker='true') AS
 SELECT shop_id,
    product_id,
    max(created_at) AS last_sold_at
   FROM public.inventory_movements im
  WHERE (movement_type = 'out'::public.inventory_movement_type)
  GROUP BY shop_id, product_id;

CREATE VIEW public.dead_stock WITH (security_invoker='true') AS
 SELECT sb.shop_id,
    sb.product_id,
    sum(sb.remaining_quantity) AS quantity_on_hand,
    max(sb.received_at) AS oldest_batch_date,
    pls.last_sold_at,
    (now() - COALESCE(pls.last_sold_at, min(sb.received_at))) AS days_since_last_sale
   FROM (public.inventory_stock_batches sb
     LEFT JOIN public.product_last_sale pls ON (((pls.shop_id = sb.shop_id) AND (pls.product_id = sb.product_id))))
  GROUP BY sb.shop_id, sb.product_id, pls.last_sold_at
 HAVING ((now() - COALESCE(pls.last_sold_at, min(sb.received_at))) > '90 days'::interval);

CREATE VIEW public.inventory_aging WITH (security_invoker='true') AS
 SELECT shop_id,
    product_id,
    sum(
        CASE
            WHEN (age_interval <= '30 days'::interval) THEN remaining_quantity
            ELSE (0)::numeric
        END) AS qty_0_30,
    sum(
        CASE
            WHEN ((age_interval > '30 days'::interval) AND (age_interval <= '60 days'::interval)) THEN remaining_quantity
            ELSE (0)::numeric
        END) AS qty_31_60,
    sum(
        CASE
            WHEN ((age_interval > '60 days'::interval) AND (age_interval <= '90 days'::interval)) THEN remaining_quantity
            ELSE (0)::numeric
        END) AS qty_61_90,
    sum(
        CASE
            WHEN (age_interval > '90 days'::interval) THEN remaining_quantity
            ELSE (0)::numeric
        END) AS qty_90_plus
   FROM public.inventory_stock_batches
  GROUP BY shop_id, product_id;

CREATE VIEW public.inventory_aging_value WITH (security_invoker='true') AS
 SELECT shop_id,
    product_id,
    sum(
        CASE
            WHEN (age_interval <= '30 days'::interval) THEN (remaining_quantity * unit_cost)
            ELSE (0)::numeric
        END) AS value_0_30,
    sum(
        CASE
            WHEN ((age_interval > '30 days'::interval) AND (age_interval <= '60 days'::interval)) THEN (remaining_quantity * unit_cost)
            ELSE (0)::numeric
        END) AS value_31_60,
    sum(
        CASE
            WHEN ((age_interval > '60 days'::interval) AND (age_interval <= '90 days'::interval)) THEN (remaining_quantity * unit_cost)
            ELSE (0)::numeric
        END) AS value_61_90,
    sum(
        CASE
            WHEN (age_interval > '90 days'::interval) THEN (remaining_quantity * unit_cost)
            ELSE (0)::numeric
        END) AS value_90_plus
   FROM public.inventory_stock_batches
  GROUP BY shop_id, product_id;

CREATE VIEW public.product_average_inventory WITH (security_invoker='true') AS
 SELECT shop_id,
    product_id,
    avg(remaining_quantity) AS avg_quantity_on_hand
   FROM public.inventory_stock_batches
  GROUP BY shop_id, product_id;

CREATE VIEW public.product_sales_90d WITH (security_invoker='true') AS
 SELECT shop_id,
    product_id,
    sum(abs(quantity_change)) AS quantity_sold_90d
   FROM public.inventory_movements im
  WHERE ((movement_type = 'out'::public.inventory_movement_type) AND (created_at >= (now() - '90 days'::interval)))
  GROUP BY shop_id, product_id;

CREATE VIEW public.inventory_turnover WITH (security_invoker='true') AS
 SELECT s.shop_id,
    s.product_id,
    s.quantity_sold_90d,
    COALESCE(ai.avg_quantity_on_hand, (0)::numeric) AS avg_inventory,
        CASE
            WHEN (COALESCE(ai.avg_quantity_on_hand, (0)::numeric) = (0)::numeric) THEN NULL::numeric
            ELSE (s.quantity_sold_90d / ai.avg_quantity_on_hand)
        END AS turnover_ratio
   FROM (public.product_sales_90d s
     LEFT JOIN public.product_average_inventory ai ON (((ai.shop_id = s.shop_id) AND (ai.product_id = s.product_id))));

CREATE VIEW public.invoice_paid_amounts WITH (security_invoker='true') AS
 SELECT i.id AS invoice_id,
    COALESCE(sum(p.amount), (0)::numeric) AS paid_amount
   FROM (public.invoices i
     LEFT JOIN public.payments p ON (((p.invoice_id = i.id) AND (p.payment_direction = 'in'::public.payment_direction) AND (p.status = 'completed'::public.payment_status))))
  GROUP BY i.id;

CREATE VIEW public.invoice_balances WITH (security_invoker='true') AS
 SELECT i.id AS invoice_id,
    i.shop_id,
    i.total_amount,
    COALESCE(pa.paid_amount, (0)::numeric) AS paid_amount,
    (i.total_amount - COALESCE(pa.paid_amount, (0)::numeric)) AS balance_due
   FROM (public.invoices i
     LEFT JOIN public.invoice_paid_amounts pa ON ((pa.invoice_id = i.id)));

CREATE VIEW public.invoice_gross_margin WITH (security_invoker='true') AS
 SELECT i.id AS invoice_id,
    i.shop_id,
    COALESCE(r.product_revenue, (0)::numeric) AS revenue,
    COALESCE(c.total_cogs, (0)::numeric) AS cogs,
    (COALESCE(r.product_revenue, (0)::numeric) - COALESCE(c.total_cogs, (0)::numeric)) AS gross_profit
   FROM ((public.invoices i
     LEFT JOIN public.invoice_product_revenue r ON ((r.invoice_id = i.id)))
     LEFT JOIN public.invoice_cogs c ON ((c.invoice_id = i.id)));

CREATE VIEW public.product_stock WITH (security_invoker='true') AS
 SELECT p.shop_id,
    p.id AS product_id,
    p.name,
    p.sku,
    p.sale_price,
    COALESCE(sum(b.remaining_quantity), (0)::numeric) AS quantity_on_hand,
    p.is_active,
    p.reorder_threshold,
    COALESCE(sum((b.remaining_quantity * b.unit_cost)), (0)::numeric) AS inventory_value
   FROM (public.products p
     LEFT JOIN public.inventory_batches b ON (((b.product_id = p.id) AND (b.shop_id = p.shop_id))))
  GROUP BY p.shop_id, p.id, p.name, p.sku, p.sale_price, p.is_active, p.reorder_threshold;

CREATE VIEW public.low_stock_products WITH (security_invoker='true') AS
 SELECT shop_id,
    product_id,
    name,
    sku,
    sale_price,
    quantity_on_hand,
    reorder_threshold,
    inventory_value
   FROM public.product_stock
  WHERE (is_active AND (reorder_threshold > (0)::numeric) AND (quantity_on_hand <= reorder_threshold));

CREATE VIEW public.monthly_cogs_margin WITH (security_invoker='true') AS
 SELECT i.shop_id,
    date_trunc('month'::text, i.issued_at) AS month,
    sum(ipr.product_revenue) AS revendue,
    sum(ic.total_cogs) AS cogs,
    (sum(ipr.product_revenue) - sum(ic.total_cogs)) AS gross_profit
   FROM ((public.invoices i
     JOIN public.invoice_product_revenue ipr ON ((ipr.invoice_id = i.id)))
     JOIN public.invoice_cogs ic ON ((ic.invoice_id = i.id)))
  GROUP BY i.shop_id, (date_trunc('month'::text, i.issued_at));

CREATE VIEW public.net_profit WITH (security_invoker='true') AS
 SELECT gm.shop_id,
    gm.day,
    (gm.gross_profit - COALESCE(e.total_expenses, (0)::numeric)) AS net_profit
   FROM (public.daily_cogs_margin gm
     LEFT JOIN ( SELECT expenses.shop_id,
            date_trunc('day'::text, expenses.expense_date) AS day,
            sum(expenses.amount) AS total_expenses
           FROM public.expenses
          WHERE (expenses.status = 'paid'::public.expense_status)
          GROUP BY expenses.shop_id, (date_trunc('day'::text, expenses.expense_date))) e ON (((e.shop_id = gm.shop_id) AND (e.day = gm.day))));

CREATE VIEW public.product_profitability WITH (security_invoker='true') AS
 SELECT ii.product_id,
    i.shop_id,
    sum(((ii.unit_price * ii.quantity) - COALESCE(ii.discount_amount, (0)::numeric))) AS revenue,
    sum(cm.cogs_amount) AS cogs,
    (sum(((ii.unit_price * ii.quantity) - COALESCE(ii.discount_amount, (0)::numeric))) - sum(cm.cogs_amount)) AS gross_profit
   FROM ((public.invoice_items ii
     JOIN public.invoices i ON ((i.id = ii.invoice_id)))
     JOIN public.cogs_movements cm ON (((cm.invoice_id = ii.invoice_id) AND (cm.product_id = ii.product_id))))
  WHERE (ii.item_type = 'product'::public.invoice_item_type)
  GROUP BY ii.product_id, i.shop_id;

CREATE VIEW public.vendor_balances WITH (security_invoker='true') AS
 SELECT v.id AS vendor_id,
    v.shop_id,
    (COALESCE(sum(vi.total_amount), (0)::numeric) - COALESCE(sum(p.amount), (0)::numeric)) AS balance
   FROM ((public.vendors v
     LEFT JOIN public.vendor_invoices vi ON ((vi.vendor_id = v.id)))
     LEFT JOIN public.payments p ON (((p.vendor_id = v.id) AND (p.payment_direction = 'out'::public.payment_direction) AND (p.status = 'completed'::public.payment_status))))
  GROUP BY v.id, v.shop_id;

CREATE VIEW public.vendor_invoice_paid_amounts WITH (security_invoker='true') AS
 SELECT vi.id AS vendor_invoice_id,
    COALESCE(sum(p.amount), (0)::numeric) AS paid_amount
   FROM (public.vendor_invoices vi
     LEFT JOIN public.payments p ON (((p.vendor_invoice_id = vi.id) AND (p.payment_direction = 'out'::public.payment_direction) AND (p.status = 'completed'::public.payment_status))))
  GROUP BY vi.id;

CREATE VIEW public.vendor_invoice_balances WITH (security_invoker='true') AS
 SELECT vi.id AS vendor_invoice_id,
    vi.shop_id,
    vi.total_amount,
    COALESCE(pa.paid_amount, (0)::numeric) AS paid_amount,
    (vi.total_amount - COALESCE(pa.paid_amount, (0)::numeric)) AS balance_due
   FROM (public.vendor_invoices vi
     LEFT JOIN public.vendor_invoice_paid_amounts pa ON ((pa.vendor_invoice_id = vi.id)));

do $$declare v record;role_name text;begin
 for v in select distinct relname from measurement_view_acl loop
  execute format('revoke all on public.%I from public,anon,authenticated,service_role',v.relname);
 end loop;
 for v in select * from measurement_view_acl loop
  role_name:=case when v.grantee=0 then 'PUBLIC' else quote_ident(pg_catalog.pg_get_userbyid(v.grantee)) end;
  execute format('grant %s on public.%I to %s%s',v.privilege_type,v.relname,role_name,case when v.is_grantable then ' with grant option' else '' end);
 end loop;
end;$$;
CREATE TRIGGER trg_invoice_items_snapshot_service_schedule BEFORE INSERT OR UPDATE OF service_id, item_name, unit_price, discount_amount, total_amount ON public.invoice_items FOR EACH ROW EXECUTE FUNCTION shop_private.snapshot_invoice_service_schedule();
CREATE TRIGGER measurement_threshold_guard BEFORE UPDATE OF reorder_threshold ON public.products FOR EACH ROW EXECUTE FUNCTION shop_private.guard_prepared_measurement_threshold();

notify pgrst,'reload schema';

commit;
