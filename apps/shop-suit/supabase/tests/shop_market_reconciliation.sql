-- SS-MARKET-VAL-001: one continuous, authenticated source-to-report loop per
-- business mode. The runner supplies BEGIN/ROLLBACK. No seed/customer data used.
create temporary table market_owners as
select gen_random_uuid() id, mode::public.business_mode mode
from unnest(array['product', 'service', 'mixed']) mode;
grant select on market_owners to authenticated;
insert into auth.users (id,email,encrypted_password,aud,role,email_confirmed_at,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select id, id::text || '@ss-market.invalid', 'x', 'authenticated', 'authenticated',
  now(), '{}'::jsonb, '{}'::jsonb, now(), now() from market_owners;

set local role authenticated;
do $$
declare
  fixture record;
  shop uuid; location uuid; staff uuid; customer uuid; product uuid; service uuid;
  vendor uuid; purchase uuid; purchase_item uuid; sale uuid; payment uuid;
  correction uuid; returned uuid; request uuid; result jsonb; lines jsonb;
  receipt jsonb; report jsonb; total numeric; stock numeric; source_amount numeric;
  effective_at timestamptz := now();
begin
  for fixture in select * from market_owners loop
    perform set_config('request.jwt.claim.sub', fixture.id::text, true);
    perform set_config('request.jwt.claim.role', 'authenticated', true);
    shop := public.create_owner_shop('Market ' || fixture.mode, 'team', fixture.mode);
    select id into strict location from public.shop_locations where shop_id = shop and is_default;
    select id into strict staff from public.shop_memberships where shop_id = shop and role = 'owner';
    customer := public.save_customer(shop, null, 'Market customer', null, null, null, null);
    lines := '[]'::jsonb;
    total := 0;
    if fixture.mode <> 'service' then
      product := public.save_product(shop, null, 'Market product', 'MARKET-1', '622100000001', 20);
      vendor := public.save_vendor(shop, null, 'Market supplier', null, null, null, null, null, null);
      request := gen_random_uuid();
      purchase := public.create_supplier_purchase(request, shop, vendor, 'MARKET-PUR',
        current_date, null, jsonb_build_array(jsonb_build_object('product_id', product, 'quantity', 10, 'unit_cost', 10)));
      if public.create_supplier_purchase(request, shop, vendor, 'MARKET-PUR', current_date,
        null, jsonb_build_array(jsonb_build_object('product_id', product, 'quantity', 10, 'unit_cost', 10))) is distinct from purchase then
        raise exception 'purchase replay changed identity';
      end if;
      select id into strict purchase_item from public.vendor_invoice_items where vendor_invoice_id = purchase;
      select quantity_on_hand into strict stock from public.product_stock where product_id = product;
      if stock is distinct from 10::numeric then raise exception 'purchase did not receive exactly ten units'; end if;
      request := gen_random_uuid();
      payment := public.record_supplier_payment(request, shop, vendor, 40, effective_at,
        'bank_transfer', 'MARKET-PAY', null, jsonb_build_array(jsonb_build_object('vendor_invoice_id', purchase, 'amount', 40)));
      if public.record_supplier_payment(request, shop, vendor, 40, effective_at,
        'bank_transfer', 'MARKET-PAY', null, jsonb_build_array(jsonb_build_object('vendor_invoice_id', purchase, 'amount', 40))) is distinct from payment
        or (public.get_purchase(shop, purchase) ->> 'payable')::numeric is distinct from 60::numeric then
        raise exception 'partial supplier payment/replay failed';
      end if;
      lines := lines || jsonb_build_array(jsonb_build_object('item_type', 'product', 'source_id', product, 'quantity', 2));
      total := total + 40;
    end if;
    if fixture.mode <> 'product' then
      service := public.save_service(shop, null, 'Market service', null, 30, 'amount', 0);
      lines := lines || jsonb_build_array(jsonb_build_object('item_type', 'service', 'source_id', service, 'quantity', 1));
      total := total + 30;
    end if;

    request := gen_random_uuid();
    sale := public.save_pos_sale_draft(request, shop, location, null, staff, null, customer, null, lines);
    if public.save_pos_sale_draft(request, shop, location, null, staff, null, customer, null, lines) is distinct from sale then
      raise exception 'draft replay changed identity';
    end if;
    request := gen_random_uuid();
    perform public.issue_location_sale(request, shop, location, sale);
    perform public.issue_location_sale(request, shop, location, sale);
    request := gen_random_uuid();
    payment := public.record_location_customer_receipt(request, shop, location, customer,
      10, effective_at, 'card', 'MARKET-PARTIAL', null,
      jsonb_build_array(jsonb_build_object('invoice_id', sale, 'amount', 10)));
    if public.record_location_customer_receipt(request, shop, location, customer,
      10, effective_at, 'card', 'MARKET-PARTIAL', null,
      jsonb_build_array(jsonb_build_object('invoice_id', sale, 'amount', 10))) is distinct from payment then
      raise exception 'partial customer payment replay changed identity';
    end if;
    if (select count(*) from public.invoice_items where invoice_id = sale) is distinct from jsonb_array_length(lines)::bigint
      or (select total_amount from public.invoices where id = sale) is distinct from total
      or (public.customer_statement(shop, customer, 1, 50) ->> 'outstanding')::numeric is distinct from total - 10 then
      raise exception 'sale lines/partial customer balance did not reconcile for %', fixture.mode;
    end if;
    report := public.shop_operational_report(shop, 'sales');
    select sum(total_amount) into source_amount from public.invoice_items where invoice_id = sale;
    if (report #>> '{summary,sales}')::numeric is distinct from source_amount then
      raise exception 'sales report differs from source lines';
    end if;
    report := public.shop_operational_report(shop, 'receivables');
    if (report #>> '{summary,outstanding}')::numeric is distinct from total - 10 then
      raise exception 'receivables report differs from partial customer balance';
    end if;
    if fixture.mode <> 'service' then
      select quantity_on_hand into strict stock from public.product_stock where product_id = product;
      if stock is distinct from 8::numeric then raise exception 'sale did not consume exactly two units'; end if;
      report := public.shop_operational_report(shop, 'margin');
      if (report #>> '{summary,fifoCost}')::numeric is distinct from 20::numeric
        or (report #>> '{summary,margin}')::numeric is distinct from 20::numeric then
        raise exception 'product FIFO margin does not reconcile';
      end if;
    elsif exists (select 1 from public.inventory_movements where shop_id = shop) then
      raise exception 'service-only loop created stock movements';
    end if;

    receipt := public.get_location_sale_receipt(shop, location, sale);
    if receipt is not null then raise exception 'partial payment incorrectly created a fully-paid receipt'; end if;
    request := gen_random_uuid();
    correction := public.correct_location_sale(request, shop, location, sale, effective_at, 'Market full correction', 'MARKET-CORR');
    if public.correct_location_sale(request, shop, location, sale, effective_at, 'Market full correction', 'MARKET-CORR') is distinct from correction
      or (public.customer_statement(shop, customer, 1, 50) ->> 'outstanding')::numeric is distinct from 0::numeric
      or (select refund_amount from public.sale_corrections where id = correction) is distinct from 10::numeric
      or (select total_amount from public.invoices where id = sale) is distinct from total
      or public.get_location_sale_receipt(shop, location, sale) is distinct from receipt then
      raise exception 'correction duplicated money, left receivable, or changed original sale/receipt availability';
    end if;
    report := public.shop_operational_report(shop, 'sales');
    if (report #>> '{summary,sales}')::numeric is distinct from 0::numeric then raise exception 'corrected sale remains in sales'; end if;
    report := public.shop_operational_report(shop, 'collections');
    select sum(case when payment_direction = 'in' then amount else -amount end)
      into source_amount from public.payments where shop_id = shop and customer_kind is not null and status = 'completed';
    if (report #>> '{summary,collected}')::numeric is distinct from 10::numeric
      or (report #>> '{summary,refunded}')::numeric is distinct from 10::numeric
      or (report #>> '{summary,netCollections}')::numeric is distinct from source_amount
      or source_amount is distinct from 0::numeric then
      raise exception 'correction collections differ from source payments';
    end if;

    if fixture.mode <> 'service' then
      select quantity_on_hand into strict stock from public.product_stock where product_id = product;
      if stock is distinct from 10::numeric then raise exception 'correction did not restore purchased stock'; end if;
      request := gen_random_uuid();
      returned := public.record_purchase_return(request, shop, purchase, effective_at, 'Return two units', 'MARKET-RETURN',
        jsonb_build_array(jsonb_build_object('vendor_invoice_item_id', purchase_item, 'quantity', 2)));
      if public.record_purchase_return(request, shop, purchase, effective_at, 'Return two units', 'MARKET-RETURN',
        jsonb_build_array(jsonb_build_object('vendor_invoice_item_id', purchase_item, 'quantity', 2))) is distinct from returned then
        raise exception 'supplier return replay changed identity';
      end if;
      report := public.shop_operational_report(shop, 'suppliers');
      result := public.get_purchase(shop, purchase);
      if (report #>> '{summary,purchases}')::numeric is distinct from 100::numeric
        or (report #>> '{summary,supplierPayments}')::numeric is distinct from 40::numeric
        or (report #>> '{summary,payable}')::numeric is distinct from 40::numeric
        or (result ->> 'payable')::numeric is distinct from 40::numeric then
        raise exception 'supplier report and purchase detail differ after payment/return';
      end if;
      perform public.archive_product(shop, product);
      report := public.shop_operational_report(shop, 'inventory');
      select sum(quantity_change) into source_amount from public.inventory_movements where product_id = product;
      if source_amount is distinct from 8::numeric
        or (report #>> '{summary,quantityOnHand}')::numeric is distinct from source_amount
        or (report #>> '{summary,inventoryValue}')::numeric is distinct from 80::numeric
        or not exists (select 1 from public.products where id = product and not is_active)
        or (select count(*) from public.invoice_items where invoice_id = sale and product_id = product) <> 1 then
        raise exception 'archival lost remaining stock/value or sale history';
      end if;
      result := public.pos_catalog_search(shop, location, null, null, '622100000001', 1, 2);
      if jsonb_array_length(result -> 'items') is distinct from 0 then raise exception 'archived product still offered in POS'; end if;
    end if;
  end loop;
end;
$$;
reset role;
