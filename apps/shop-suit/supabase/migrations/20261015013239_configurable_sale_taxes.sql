-- Opt-in ordinary VAT foundation. No historical backfill or ETA connectivity.
create table public.tax_policy_versions (
 id uuid primary key default gen_random_uuid(), shop_id uuid not null references public.shops(id) on delete restrict,
 request_id uuid not null, effective_at timestamptz not null, policy jsonb not null,
 reason text not null check(length(btrim(reason)) between 2 and 1000),
 actor_profile_id uuid not null references public.profiles(id) on delete restrict,
 created_at timestamptz not null default clock_timestamp(), unique(shop_id,request_id), unique(id,shop_id)
);
create index tax_policy_effective on public.tax_policy_versions(shop_id,effective_at desc,created_at desc,id desc);
create table public.sale_tax_snapshots (
 invoice_id uuid primary key, shop_id uuid not null, location_id uuid not null,
 policy_version_id uuid, snapshot jsonb not null check(jsonb_typeof(snapshot)='object'),
 created_at timestamptz not null default clock_timestamp(),
 foreign key(invoice_id,shop_id,location_id) references public.invoices(id,shop_id,location_id) on delete restrict,
 foreign key(policy_version_id,shop_id) references public.tax_policy_versions(id,shop_id) on delete restrict
);
create index sale_tax_shop_location on public.sale_tax_snapshots(shop_id,location_id,invoice_id);
alter table public.invoices add column tax_order_discount numeric(12,2) not null default 0 check(tax_order_discount>=0);
alter table public.tax_policy_versions enable row level security;
alter table public.sale_tax_snapshots enable row level security;
revoke all on public.tax_policy_versions,public.sale_tax_snapshots from public,anon,authenticated;
grant all on public.tax_policy_versions,public.sale_tax_snapshots to service_role;
create function shop_private.tax_immutable() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'TAX_HISTORY_IMMUTABLE' using errcode='55000'; end; $$;
revoke all on function shop_private.tax_immutable() from public,anon,authenticated,service_role;
create trigger tax_policy_immutable before update or delete on public.tax_policy_versions for each row execute function shop_private.tax_immutable();
create trigger tax_snapshot_immutable before update or delete on public.sale_tax_snapshots for each row execute function shop_private.tax_immutable();

create function shop_private.tax_manager(p_shop_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid;
begin
 actor:=shop_private.assert_shop_write_access(p_shop_id,'settings.manage');
 if not exists(select 1 from public.shop_memberships m where m.shop_id=p_shop_id and m.profile_id=actor and m.status='active'
 and (m.role='owner' or exists(select 1 from public.membership_roles mr join public.roles r on r.id=mr.role_id
 where mr.membership_id=m.id and r.shop_id=p_shop_id and r.key='manager' and r.is_system))) then
 raise exception 'TAX_MANAGER_REQUIRED' using errcode='42501'; end if;
 return actor;
end; $$;
revoke all on function shop_private.tax_manager(uuid) from public,anon,authenticated,service_role;

-- A rule is a classification, not an ETA connection or merchant registration.
create function shop_private.validate_tax_rule(rule jsonb) returns void language plpgsql immutable set search_path='' as $$
declare rate numeric; treatment text:=rule->>'treatment'; subtype text:=rule->>'subtype';
begin
 if jsonb_typeof(rule) is distinct from 'object' or coalesce(treatment,'') not in('vat','zero_rated','exempt','non_taxable')
 or coalesce(rule->>'priceMode','') not in('inclusive','exclusive')
 or jsonb_typeof(rule->'rate') is distinct from 'number'
 or coalesce(rule->>'taxType','T1')<>'T1' or rule ?| array['compound','withholding','tableTax'] then
 raise exception 'UNSUPPORTED_TAX_TREATMENT' using errcode='22023'; end if;
 rate:=(rule->>'rate')::numeric;
 if rate<0 or rate>100 or round(rate,5)<>rate or (treatment<>'vat' and rate<>0)
 or (treatment='vat' and (rate=0 or coalesce(subtype,'') not in('V009','V010')))
 or (treatment='zero_rated' and coalesce(subtype,'') not in('V001','V002','V010'))
 or (treatment='exempt' and coalesce(subtype,'') not in('V003','V005','V006','V007','V008'))
 or (treatment='non_taxable' and subtype is distinct from 'V004') then
 raise exception 'INVALID_TAX_RULE' using errcode='22023'; end if;
end; $$;
revoke all on function shop_private.validate_tax_rule(jsonb) from public,anon,authenticated,service_role;

create function public.save_tax_policy(p_request_id uuid,p_shop_id uuid,p_effective_at timestamptz,p_policy jsonb,p_reason text)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid; previous public.tax_policy_versions%rowtype; item jsonb; result uuid;
begin
 actor:=shop_private.tax_manager(p_shop_id);
 perform 1 from public.shops where id=p_shop_id for update;
 if p_request_id is null or p_effective_at is null or not isfinite(p_effective_at)
 or jsonb_typeof(p_policy) is distinct from 'object' or jsonb_typeof(p_policy->'enabled') is distinct from 'boolean'
 or jsonb_typeof(p_policy->'items') is distinct from 'array' or jsonb_array_length(p_policy->'items')>1000
 or length(btrim(coalesce(p_reason,''))) not between 2 and 1000 then
 raise exception 'INVALID_TAX_POLICY' using errcode='22023'; end if;
 select * into previous from public.tax_policy_versions where shop_id=p_shop_id and request_id=p_request_id;
 if found then
 if previous.policy<>p_policy or previous.effective_at<>p_effective_at or previous.reason<>btrim(p_reason) or previous.actor_profile_id<>actor then
 raise exception 'TAX_REQUEST_CONFLICT' using errcode='23505'; end if; return previous.id;
 end if;
 perform shop_private.validate_tax_rule(p_policy->'default');
 if exists(select 1 from jsonb_array_elements(p_policy->'items') e group by e->>'itemType',e->>'sourceId' having count(*)>1) then
 raise exception 'DUPLICATE_TAX_ITEM' using errcode='22023'; end if;
 for item in select value from jsonb_array_elements(p_policy->'items') loop
 perform shop_private.validate_tax_rule(item);
 if coalesce(item->>'itemType','') not in('product','service') or not (
 (item->>'itemType'='product' and exists(select 1 from public.products where shop_id=p_shop_id and id=(item->>'sourceId')::uuid))
 or (item->>'itemType'='service' and exists(select 1 from public.services where shop_id=p_shop_id and id=(item->>'sourceId')::uuid))) then
 raise exception 'INVALID_TAX_ITEM' using errcode='23503'; end if;
 end loop;
 insert into public.tax_policy_versions(shop_id,request_id,effective_at,policy,reason,actor_profile_id)
 values(p_shop_id,p_request_id,p_effective_at,p_policy,btrim(p_reason),actor) returning id into result;
 return result;
end; $$;
revoke all on function public.save_tax_policy(uuid,uuid,timestamptz,jsonb,text) from public,anon;
grant execute on function public.save_tax_policy(uuid,uuid,timestamptz,jsonb,text) to authenticated;

-- Five decimal components; final money retains Shop's existing two-decimal contract.
-- Stable cumulative allocation conserves every order discount and rounding unit.
create function shop_private.calculate_tax(p_lines jsonb,p_policy jsonb,p_order_discount numeric default 0)
returns jsonb language plpgsql immutable set search_path='' as $$
declare line jsonb; rule jsonb; rows jsonb:='[]'; enabled boolean:=coalesce((p_policy->>'enabled')::boolean,false);
 gross numeric; line_discount numeric; available numeric:=0; cumulative numeric:=0; allocated numeric:=0; share numeric;
 net5 numeric; tax5 numeric; total5 numeric; net_sum numeric:=0; tax_sum numeric:=0; total_sum numeric:=0;
 previous_net numeric:=0; previous_tax numeric:=0; previous_total numeric:=0; net_money numeric; tax_money numeric; total_money numeric;
 qty numeric; price numeric; rate numeric; amount numeric;
begin
 if jsonb_typeof(p_lines) is distinct from 'array' or jsonb_array_length(p_lines) not between 1 and 100
 or p_order_discount is null or p_order_discount<0 or round(p_order_discount,2)<>p_order_discount then
 raise exception 'INVALID_TAX_INPUT' using errcode='22023'; end if;
 for line in select value from jsonb_array_elements(p_lines) loop
 qty:=(line->>'quantity')::numeric; price:=(line->>'unitPrice')::numeric; line_discount:=(line->>'lineDiscount')::numeric;
 if qty is null or qty<=0 or round(qty,5)<>qty or price is null or price<0 or round(price,5)<>price
 or line_discount is null or line_discount<0 or round(line_discount,5)<>line_discount then
 raise exception 'INVALID_TAX_INPUT' using errcode='22023'; end if;
 gross:=round(qty*price,case when enabled then 5 else 2 end);
 if line_discount>gross then raise exception 'DISCOUNT_EXCEEDS_SALE' using errcode='22023'; end if;
 available:=available+gross-line_discount;
 end loop;
 if p_order_discount>available then raise exception 'DISCOUNT_EXCEEDS_SALE' using errcode='22023'; end if;
 for line in select value from jsonb_array_elements(p_lines) loop
 qty:=(line->>'quantity')::numeric; price:=(line->>'unitPrice')::numeric;
 gross:=round(qty*price,case when enabled then 5 else 2 end); line_discount:=(line->>'lineDiscount')::numeric;
 cumulative:=cumulative+gross-line_discount;
 share:=case when available=0 then 0 else round(p_order_discount*cumulative/available,5)-allocated end;
 allocated:=allocated+share; amount:=gross-line_discount-share;
 select value into rule from jsonb_array_elements(coalesce(p_policy->'items','[]'))
 where value->>'itemType'=line->>'itemType' and value->>'sourceId'=line->>'sourceId';
 rule:=coalesce(rule,p_policy->'default'); rate:=0;
 if enabled then perform shop_private.validate_tax_rule(rule); rate:=(rule->>'rate')::numeric; end if;
 net5:=case when enabled and rule->>'priceMode'='inclusive' then round(amount/(1+rate/100),5) else amount end;
 tax5:=case when enabled and rule->>'priceMode'='inclusive' then amount-net5 else round(net5*rate/100,5) end;
 total5:=net5+tax5;
 net_sum:=net_sum+net5; tax_sum:=tax_sum+tax5; total_sum:=total_sum+total5;
 -- Currency money rounds per line; document money sums those rounded lines.
 -- Five-decimal ETA components stay separate, including the explicit rounding delta.
 total_money:=round(total5,2); tax_money:=least(total_money,round(tax5,2));
 net_money:=total_money-tax_money;
 previous_total:=previous_total+total_money; previous_tax:=previous_tax+tax_money; previous_net:=previous_net+net_money;
 rows:=rows||jsonb_build_array(line||jsonb_build_object('originalUnitPrice',price,'originalQuantity',qty,
 'gross5',gross,'lineDiscount5',line_discount,'orderDiscount5',share,'net5',net5,'tax5',tax5,'total5',total5,
 'net',net_money,'tax',tax_money,'total',total_money,'calculationEnabled',enabled,
 'rule',case when enabled then rule else null end));
 end loop;
 return jsonb_build_object('version',1,'calculationEnabled',enabled,'minorUnits',2,'componentDecimals',5,
 'orderDiscount',p_order_discount,'net5',net_sum,'tax5',tax_sum,'total5',total_sum,
 'net',previous_net,'tax',previous_tax,'total',previous_total,'moneyRounding5',previous_total-total_sum,'lines',rows);
end; $$;
revoke all on function shop_private.calculate_tax(jsonb,jsonb,numeric) from public,anon,authenticated,service_role;

-- Future partial returns use a difference of cumulative original-snapshot amounts.
create function shop_private.tax_return_components(p_line jsonb,p_cumulative_quantity numeric,p_previous_quantity numeric default 0)
returns jsonb language plpgsql immutable set search_path='' as $$
declare qty numeric:=(p_line->>'originalQuantity')::numeric; result jsonb:='{}'; key text; delta numeric;
begin
 if qty is null or qty<=0 or p_cumulative_quantity is null or p_previous_quantity is null
 or p_previous_quantity<0 or p_cumulative_quantity<p_previous_quantity or p_cumulative_quantity>qty
 or round(p_cumulative_quantity,5)<>p_cumulative_quantity or round(p_previous_quantity,5)<>p_previous_quantity then
 raise exception 'INVALID_CUMULATIVE_TAX_RETURN' using errcode='22023'; end if;
 foreach key in array array['tax','total'] loop
 delta:=round((p_line->>key)::numeric*p_cumulative_quantity/qty,2)-round((p_line->>key)::numeric*p_previous_quantity/qty,2);
 result:=result||jsonb_build_object(key,delta);
 end loop;
 return result||jsonb_build_object('net',(result->>'total')::numeric-(result->>'tax')::numeric);
end; $$;
revoke all on function shop_private.tax_return_components(jsonb,numeric,numeric) from public,anon,authenticated,service_role;

create function public.set_sale_order_discount(p_shop_id uuid,p_invoice_id uuid,p_discount numeric) returns void
language plpgsql security definer set search_path='' as $$
declare sale public.invoices%rowtype;
begin
 perform shop_private.assert_shop_write_access(p_shop_id,'sales.manage');
 select * into sale from public.invoices where id=p_invoice_id and shop_id=p_shop_id for update;
 if not found or sale.status<>'draft' then raise exception 'TAX_DRAFT_REQUIRED' using errcode='55000'; end if;
 perform shop_private.assert_location_access(p_shop_id,sale.location_id,true);
 if p_discount is null or p_discount<0 or round(p_discount,2)<>p_discount then raise exception 'INVALID_TAX_DISCOUNT' using errcode='22023'; end if;
 update public.invoices set tax_order_discount=p_discount where id=sale.id;
 perform shop_private.quote_invoice_tax(sale.id,statement_timestamp());
end; $$;
revoke all on function public.set_sale_order_discount(uuid,uuid,numeric) from public,anon;
grant execute on function public.set_sale_order_discount(uuid,uuid,numeric) to authenticated;

create function shop_private.capture_tax_at_issue() returns trigger language plpgsql security definer set search_path='' as $$
declare policy public.tax_policy_versions%rowtype; snapshot jsonb; line jsonb;
begin
 if old.status<>'draft' or new.status<>'issued' then return new; end if;
 perform shop_private.assert_location_access(new.shop_id,new.location_id,true);
 perform 1 from public.shops where id=new.shop_id for update;
 select * into policy from public.tax_policy_versions where shop_id=new.shop_id and effective_at<=statement_timestamp()
 order by effective_at desc,created_at desc,id desc limit 1;
 -- Unconfigured/disabled shops keep every existing arithmetic path unchanged.
 if not coalesce((policy.policy->>'enabled')::boolean,false) and new.tax_order_discount=0 then return new; end if;
 snapshot:=shop_private.calculate_tax((select jsonb_agg(jsonb_build_object('id',id,'itemType',item_type,
 'sourceId',coalesce(product_id,service_id),'quantity',quantity,'unitPrice',unit_price,'lineDiscount',discount_amount)
 order by line_order,id) from public.invoice_items where invoice_id=new.id),policy.policy,new.tax_order_discount)
 ||jsonb_build_object('currency',new.currency,'policyVersionId',policy.id,'effectiveAt',policy.effective_at);
 for line in select value from jsonb_array_elements(snapshot->'lines') loop
 update public.invoice_items set total_amount=(line->>'total')::numeric where id=(line->>'id')::uuid and invoice_id=new.id;
 end loop;
 new.total_amount:=(snapshot->>'total')::numeric;
 new.discount_amount:=new.discount_amount+new.tax_order_discount;
 insert into public.sale_tax_snapshots(invoice_id,shop_id,location_id,policy_version_id,snapshot)
 values(new.id,new.shop_id,new.location_id,policy.id,snapshot);
 return new;
end; $$;
revoke all on function shop_private.capture_tax_at_issue() from public,anon,authenticated,service_role;
create trigger zy_tax_capture before update of status on public.invoices for each row execute function shop_private.capture_tax_at_issue();

create function public.tax_settings(p_shop_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 perform shop_private.tax_manager(p_shop_id);
 return jsonb_build_object('versions',coalesce((select jsonb_agg(to_jsonb(p) order by p.effective_at desc,p.created_at desc,p.id desc)
 from (select id,effective_at,policy,reason,created_at from public.tax_policy_versions where shop_id=p_shop_id order by effective_at desc,created_at desc,id desc limit 100) p),'[]'::jsonb),
 'items',coalesce((select jsonb_agg(x order by x->>'name',x->>'id') from (
 select jsonb_build_object('id',id,'name',name,'itemType','product') x from public.products where shop_id=p_shop_id and is_active
 union all select jsonb_build_object('id',id,'name',name,'itemType','service') from public.services where shop_id=p_shop_id and is_active) q),'[]'::jsonb));
end; $$;
revoke all on function public.tax_settings(uuid) from public,anon;
grant execute on function public.tax_settings(uuid) to authenticated;
create function public.get_sale_tax_snapshot(p_shop_id uuid,p_invoice_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare location uuid; sale_status text;
begin
 perform shop_private.assert_sale_read_access(p_shop_id);
 select location_id,status::text into location,sale_status from public.invoices where id=p_invoice_id and shop_id=p_shop_id;
 if not found then raise exception 'SALE_NOT_FOUND' using errcode='P0002'; end if;
 perform shop_private.assert_location_access(p_shop_id,location,false);
 if sale_status='draft' then return shop_private.quote_invoice_tax(p_invoice_id,statement_timestamp()); end if;
 return (select snapshot from public.sale_tax_snapshots where invoice_id=p_invoice_id and shop_id=p_shop_id);
end; $$;
revoke all on function public.get_sale_tax_snapshot(uuid,uuid) from public,anon;
grant execute on function public.get_sale_tax_snapshot(uuid,uuid) to authenticated;

-- Compatible forward integration; applied commission migration is unchanged.
create or replace function shop_private.capture_commission() returns trigger language plpgsql security definer set search_path='' as $$
declare policy public.commission_policy_versions%rowtype; line record; employee jsonb; rate jsonb;
begin
 if old.status<>'draft' or new.status<>'issued' then return new; end if;
 select * into policy from public.commission_policy_versions where shop_id=new.shop_id order by created_at desc,id desc limit 1;
 if not found or not (policy.policy->>'enabled')::boolean or policy.policy->>'currency'<>new.currency then return new; end if;
 for line in select i.*,coalesce((select (t->>'net')::numeric from public.sale_tax_snapshots ts cross join lateral jsonb_array_elements(ts.snapshot->'lines') t where ts.invoice_id=new.id and t->>'id'=i.id::text),i.total_amount) commission_net_amount,a.membership_id,a.appointment_id,m.profile_id,coalesce(m.team_full_name,p.display_name,p.email_snapshot) employee_name
  from public.invoice_items i join public.commission_line_assignments a on a.line_id=i.id and a.shop_id=i.shop_id
  join public.shop_memberships m on m.id=a.membership_id and m.shop_id=i.shop_id
  join public.profiles p on p.id=m.profile_id where i.invoice_id=new.id and m.status='active' and p.status='active' order by i.id loop
  select value into employee from jsonb_array_elements(policy.policy->'employees') where value->>'membershipId'=line.membership_id::text;
  if employee is null or not (employee->>'enabled')::boolean then continue; end if;
  rate:=coalesce(nullif(employee->line.item_type::text,'null'::jsonb),nullif(policy.policy->line.item_type::text,'null'::jsonb));
  if rate is null then continue; end if;
  -- Recheck the live fulfillment identity at finalization. Stale attribution
  -- yields no earning and must never fail ordinary checkout.
  if line.item_type='service' and not exists(select 1 from public.appointments a where a.id=line.appointment_id
   and a.shop_id=new.shop_id and a.sale_id=new.id and a.service_id=line.service_id and a.location_id=new.location_id
   and a.assigned_membership_id=line.membership_id and a.status not in('cancelled','no_show') and line.quantity=1) then continue; end if;
  insert into public.commission_snapshots(shop_id,invoice_id,line_id,membership_id,employee_profile_id,employee_name,
   appointment_id,item_type,policy_version_id,rate_type,rate,currency,quantity,net_line_amount,original_commission)
  values(new.shop_id,new.id,line.id,line.membership_id,line.profile_id,line.employee_name,line.appointment_id,line.item_type::text,
   policy.id,rate->>'type',(rate->>'rate')::numeric,new.currency,line.quantity,line.commission_net_amount,
   round(case rate->>'type' when 'percentage' then line.commission_net_amount*(rate->>'rate')::numeric/100 else line.quantity*(rate->>'rate')::numeric end,2));
 end loop;
 perform shop_private.reconcile_commission(new.id);
 return new;
end; $$;
revoke all on function shop_private.capture_commission() from public,anon,authenticated,service_role;

create or replace function shop_private.capture_sale_receipt_at_issue()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_settings public.shop_receipt_settings%rowtype;
  v_shop_name text;
  v_location public.shop_locations%rowtype;
  v_staff_name text;
  v_snapshot jsonb;
begin
  if old.status <> 'draft'::public.invoice_status
    or new.status <> 'issued'::public.invoice_status then return new; end if;
  select shop.name into v_shop_name from public.shops shop where shop.id = new.shop_id;
  select * into v_location from public.shop_locations location
  where location.id = new.location_id and location.shop_id = new.shop_id;
  select * into v_settings from public.shop_receipt_settings settings
  where settings.shop_id = new.shop_id;
  select coalesce(context.staff_name_snapshot, profile.display_name, profile.email_snapshot)
  into v_staff_name
  from public.invoices invoice
  left join public.pos_sale_contexts context on context.invoice_id = invoice.id
  left join public.profiles profile on profile.id = invoice.issued_by_profile_id
  where invoice.id = new.id;

  v_snapshot := jsonb_build_object(
    'version', 1,
    'tax', (select snapshot from public.sale_tax_snapshots where invoice_id=new.id),
    'presentation', jsonb_build_object(
      'documentLabel', v_settings.document_label,
      'referenceLabel', v_settings.reference_label,
      'language', coalesce(v_settings.document_language, 'ar'),
      'direction', coalesce(v_settings.document_direction, 'auto'),
      'showDescriptions', coalesce(v_settings.show_descriptions, true),
      'notes', v_settings.notes,
      'logoDataUrl', v_settings.logo_data_url
    ),
    'invoiceId', new.id,
    'invoiceNumber', new.invoice_number,
    'issuedAt', new.issued_at,
    'currency', new.currency,
    'business', jsonb_build_object(
      'name', coalesce(nullif(btrim(v_settings.display_name), ''), v_shop_name),
      'address', nullif(btrim(v_settings.address), ''),
      'phone', nullif(btrim(v_settings.phone), '')
    ),
    'location', jsonb_build_object(
      'name', v_location.name,
      'code', v_location.code,
      'address', v_location.address,
      'phone', v_location.phone
    ),
    'staffName', v_staff_name,
    'customer', jsonb_build_object(
      'name', new.client_name_snapshot,
      'phone', new.client_phone_snapshot
    ),
    'lines', (select coalesce(jsonb_agg(jsonb_build_object(
      'id', item.id,
      'itemType', item.item_type,
      'name', item.item_name,
      'sku', item.product_sku_snapshot,
      'description', coalesce((select service.description from public.services service where service.id = item.service_id and service.shop_id = new.shop_id), item.product_sku_snapshot),
      'quantity', item.quantity,
      'unitPrice', item.unit_price,
      'discount', coalesce(item.discount_amount, 0),
      'total', item.total_amount
    ) order by item.line_order, item.id), '[]'::jsonb)
      from public.invoice_items item where item.invoice_id = new.id),
    'payments', '[]'::jsonb,
    'subtotal', coalesce((select (snapshot->>'net')::numeric from public.sale_tax_snapshots where invoice_id=new.id),new.total_amount) + coalesce(new.discount_amount, 0),
    'discount', coalesce(new.discount_amount, 0),
    'total', new.total_amount,
    'footer', nullif(btrim(v_settings.footer), ''),
    'paperSize', coalesce(v_settings.paper_size, 'thermal_80')
  );
  insert into public.sale_receipt_issue_snapshots (invoice_id, shop_id, location_id, snapshot)
  values (new.id, new.shop_id, new.location_id, v_snapshot)
  on conflict (invoice_id) do nothing;
  return new;
end;
$$;

notify pgrst, 'reload schema';

create function shop_private.quote_invoice_tax(p_invoice_id uuid,p_at timestamptz) returns jsonb
language sql stable security definer set search_path='' as $$
 select shop_private.calculate_tax((select jsonb_agg(jsonb_build_object('id',l.id,'itemType',l.item_type,'sourceId',coalesce(l.product_id,l.service_id),'quantity',l.quantity,'unitPrice',l.unit_price,'lineDiscount',l.discount_amount) order by l.line_order,l.id) from public.invoice_items l where l.invoice_id=i.id),
 (select policy from public.tax_policy_versions where shop_id=i.shop_id and effective_at<=p_at order by effective_at desc,created_at desc,id desc limit 1),i.tax_order_discount)
 from public.invoices i where i.id=p_invoice_id;
$$;
revoke all on function shop_private.quote_invoice_tax(uuid,timestamptz) from public,anon,authenticated,service_role;

create function public.quote_sale_tax(p_shop_id uuid,p_location_id uuid,p_lines jsonb) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare policy jsonb; lines jsonb:='[]'; item jsonb; price numeric; discount numeric; qty numeric;
begin
 perform shop_private.assert_sale_read_access(p_shop_id);
 perform shop_private.assert_location_access(p_shop_id,p_location_id,false);
 if jsonb_typeof(p_lines) is distinct from 'array' or jsonb_array_length(p_lines) not between 1 and 100 then
 raise exception 'INVALID_TAX_INPUT' using errcode='22023'; end if;
 select p.policy into policy from public.tax_policy_versions p where shop_id=p_shop_id and effective_at<=statement_timestamp()
 order by effective_at desc,created_at desc,id desc limit 1;
 for item in select value from jsonb_array_elements(p_lines) loop
 qty:=(item->>'quantity')::numeric;
 if item->>'item_type'='product' then
 select sale_price,0 into price,discount from public.products where id=(item->>'source_id')::uuid and shop_id=p_shop_id and is_active;
 elsif item->>'item_type'='service' then
 select base_sale_price,round((case default_discount_type when 'percent' then round(base_sale_price*default_discount_value/100,2) else default_discount_value end)*qty,2)
 into price,discount from public.services where id=(item->>'source_id')::uuid and shop_id=p_shop_id and is_active;
 else raise exception 'UNSUPPORTED_SALE_LINE_TYPE' using errcode='22023'; end if;
 if price is null then raise exception 'TAX_ITEM_NOT_FOUND' using errcode='P0002'; end if;
 lines:=lines||jsonb_build_array(jsonb_build_object('itemType',item->>'item_type','sourceId',item->>'source_id','quantity',qty,'unitPrice',price,'lineDiscount',discount));
 end loop;
 return shop_private.calculate_tax(lines,policy,0);
end; $$;
revoke all on function public.quote_sale_tax(uuid,uuid,jsonb) from public,anon;
grant execute on function public.quote_sale_tax(uuid,uuid,jsonb) to authenticated;

create or replace function shop_private.checkout_customerless_sale(
  p_request_id uuid, p_shop_id uuid, p_invoice_id uuid, p_amount numeric,
  p_paid_at timestamptz, p_method public.payment_method, p_reference text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_profile_id uuid;
  v_request public.customer_payment_requests%rowtype;
  v_invoice public.invoices%rowtype;
  v_product public.products%rowtype;
  v_service public.services%rowtype;
  v_line record;
  v_batch record;
  v_remaining numeric;
  v_take numeric;
  v_unit_discount numeric;
  v_discount numeric;
  v_total numeric;
  v_number bigint;
  v_payment_id uuid;
  v_hash text;
begin
  v_profile_id := shop_private.assert_shop_write_access(p_shop_id, 'sales.issue');
  if not shop_private.has_permission(p_shop_id, 'payments.receive') then
    raise exception 'SHOP_PERMISSION_DENIED' using errcode = '42501';
  end if;
  if p_request_id is null or p_invoice_id is null or p_amount is null or p_amount <= 0
    or round(p_amount, 2) <> p_amount or p_paid_at is null or p_method is null
    or length(coalesce(p_reference, '')) > 200 then
    raise exception 'INVALID_CUSTOMERLESS_CHECKOUT' using errcode = '22023';
  end if;
  perform shop_private.assert_period_is_open(p_shop_id, p_paid_at);
  v_hash := md5(jsonb_build_object('invoiceId', p_invoice_id, 'amount', p_amount,
    'paidAt', p_paid_at, 'method', p_method,
    'reference', nullif(btrim(p_reference), ''))::text);
  insert into public.customer_payment_requests
    (shop_id, operation, request_id, actor_profile_id, payload_hash)
  values (p_shop_id, 'checkout', p_request_id, v_profile_id, v_hash) on conflict do nothing;
  select * into v_request from public.customer_payment_requests
  where shop_id = p_shop_id and operation = 'checkout' and request_id = p_request_id for update;
  if v_request.actor_profile_id <> v_profile_id or v_request.payload_hash <> v_hash then
    raise exception 'PAYMENT_REQUEST_CONFLICT' using errcode = '23505';
  end if;
  if v_request.completed_at is not null then return v_request.result_id; end if;

  select * into v_invoice from public.invoices
  where id = p_invoice_id and shop_id = p_shop_id for update;
  if not found then raise exception 'SALE_DRAFT_NOT_FOUND'; end if;
  if v_invoice.status <> 'draft' then raise exception 'SALE_NOT_DRAFT' using errcode = '23514'; end if;
  if v_invoice.client_id is not null then
    raise exception 'CUSTOMERLESS_CHECKOUT_REQUIRES_ANONYMOUS_DRAFT' using errcode = '23514';
  end if;
  if not exists (select 1 from public.invoice_items where invoice_id = p_invoice_id) then
    raise exception 'SALE_REQUIRES_LINES' using errcode = '23514';
  end if;

  perform product.id from public.products product join (
    select distinct item.product_id from public.invoice_items item
    where item.invoice_id = p_invoice_id and item.item_type = 'product'
  ) requested on requested.product_id = product.id order by product.id for update of product;
  perform service.id from public.services service join (
    select distinct item.service_id from public.invoice_items item
    where item.invoice_id = p_invoice_id and item.item_type = 'service'
  ) requested on requested.service_id = service.id order by service.id for update of service;

  for v_line in select * from public.invoice_items
    where invoice_id = p_invoice_id order by line_order, id
  loop
    if v_line.item_type = 'product' then
      select * into v_product from public.products where id = v_line.product_id
        and shop_id = p_shop_id and is_active;
      if not found then raise exception 'PRODUCT_NOT_FOUND'; end if;
      v_total := round(v_product.sale_price * v_line.quantity, 2);
      update public.invoice_items set item_name = v_product.name,
        unit_price = v_product.sale_price, discount_amount = 0, total_amount = v_total,
        product_sku_snapshot = v_product.sku, product_barcode_snapshot = v_product.barcode,
        discount_type_snapshot = null, discount_value_snapshot = 0 where id = v_line.id;
    elsif v_line.item_type = 'service' then
      select * into v_service from public.services where id = v_line.service_id
        and shop_id = p_shop_id and is_active;
      if not found then raise exception 'SERVICE_NOT_FOUND'; end if;
      v_unit_discount := case v_service.default_discount_type when 'percent'
        then round(v_service.base_sale_price * v_service.default_discount_value / 100, 2)
        else v_service.default_discount_value end;
      v_discount := round(v_unit_discount * v_line.quantity, 2);
      v_total := round(v_service.base_sale_price * v_line.quantity - v_discount, 2);
      update public.invoice_items set item_name = v_service.name,
        unit_price = v_service.base_sale_price, discount_amount = v_discount,
        total_amount = v_total, discount_type_snapshot = v_service.default_discount_type,
        discount_value_snapshot = v_service.default_discount_value where id = v_line.id;
    else raise exception 'UNSUPPORTED_SALE_LINE_TYPE' using errcode = '22023';
    end if;
  end loop;

  select sum(total_amount), sum(discount_amount) into v_total, v_discount
  from public.invoice_items where invoice_id = p_invoice_id;
  v_total := (shop_private.quote_invoice_tax(p_invoice_id,clock_timestamp())->>'total')::numeric;
  if p_amount <> v_total then
    raise exception 'CUSTOMERLESS_CHECKOUT_REQUIRES_FULL_PAYMENT' using errcode = '23514';
  end if;
  if exists (
    select requested.product_id from (select product_id, sum(quantity) quantity
      from public.invoice_items where invoice_id = p_invoice_id and item_type = 'product'
      group by product_id) requested
    left join public.inventory_batches batch on batch.shop_id = p_shop_id
      and batch.product_id = requested.product_id
    group by requested.product_id, requested.quantity
    having coalesce(sum(batch.remaining_quantity), 0) < requested.quantity
  ) then raise exception 'INSUFFICIENT_STOCK' using errcode = '23514'; end if;

  insert into public.sale_number_counters (shop_id, next_number) values (p_shop_id, 2)
  on conflict (shop_id) do update set next_number = public.sale_number_counters.next_number + 1,
    updated_at = now() returning next_number - 1 into v_number;
  update public.invoices set invoice_number = 'SALE-' || lpad(v_number::text, 6, '0'),
    total_amount = v_total, discount_amount = v_discount, status = 'issued',
    issued_at = p_paid_at, issued_by_profile_id = v_profile_id, due_date = null,
    updated_at = p_paid_at where id = p_invoice_id;
  select total_amount into v_total from public.invoices where id=p_invoice_id;
  if p_amount<>v_total then raise exception 'TAX_QUOTE_CHANGED' using errcode='23514'; end if;

  for v_line in select item.id, item.product_id, item.quantity
    from public.invoice_items item where item.invoice_id = p_invoice_id
      and item.item_type = 'product' order by item.product_id, item.line_order, item.id
  loop
    v_remaining := v_line.quantity;
    for v_batch in select batch.id, batch.remaining_quantity, batch.unit_cost
      from public.inventory_batches batch where batch.shop_id = p_shop_id
        and batch.product_id = v_line.product_id and batch.remaining_quantity > 0
      order by batch.received_at, batch.id for update
    loop
      v_take := least(v_remaining, v_batch.remaining_quantity);
      update public.inventory_batches set remaining_quantity = remaining_quantity - v_take
      where id = v_batch.id;
      insert into public.inventory_movements (shop_id, product_id, batch_id,
        quantity_change, movement_type, reference_id, created_by_profile_id,
        unit_cost_snapshot, invoice_item_id)
      values (p_shop_id, v_line.product_id, v_batch.id, -v_take, 'out', p_invoice_id,
        v_profile_id, v_batch.unit_cost, v_line.id);
      v_remaining := v_remaining - v_take;
      exit when v_remaining = 0;
    end loop;
    if v_remaining > 0 then raise exception 'INSUFFICIENT_STOCK' using errcode = '23514'; end if;
  end loop;

  insert into public.payments (shop_id, payment_direction, invoice_id, client_id,
    amount, method, status, reference, paid_at, created_by_profile_id, customer_kind)
  values (p_shop_id, 'in', p_invoice_id, null, v_total, p_method, 'completed',
    nullif(btrim(p_reference), ''), p_paid_at, v_profile_id, 'receipt')
  returning id into v_payment_id;
  insert into public.customer_payment_allocations (shop_id, payment_id, invoice_id, amount)
  values (p_shop_id, v_payment_id, p_invoice_id, v_total);
  update public.customer_payment_requests set result_id = p_invoice_id, completed_at = now()
  where shop_id = p_shop_id and operation = 'checkout' and request_id = p_request_id;
  return p_invoice_id;
end;
$$;


create or replace function shop_private.checkout_pos_sale(
  p_request_id uuid, p_issue_request_id uuid, p_payment_request_id uuid,
  p_appointment_request_id uuid, p_shop_id uuid, p_location_id uuid, p_invoice_id uuid,
  p_amount numeric, p_paid_at timestamptz, p_method public.payment_method, p_reference text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_actor uuid; v_hash text; v_request public.pos_sale_requests%rowtype;
  v_invoice public.invoices%rowtype; v_context public.pos_sale_contexts%rowtype;
begin
  v_actor := shop_private.assert_shop_write_access(p_shop_id, 'sales.issue');
  perform shop_private.assert_location_access(p_shop_id, p_location_id, true);
  if not shop_private.has_permission(p_shop_id, 'payments.receive') then
    raise exception 'SHOP_PERMISSION_DENIED' using errcode = '42501';
  end if;
  if p_request_id is null or p_issue_request_id is null or p_payment_request_id is null
    or p_amount is null or p_amount <= 0 or round(p_amount, 2) <> p_amount or p_paid_at is null then
    raise exception 'INVALID_POS_CHECKOUT' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('offline-pos:'||p_shop_id::text||':'||p_request_id::text,0));
  if exists(select 1 from shop_private.offline_pos_requests where request_id=p_request_id and shop_id=p_shop_id and resolved_at is not null) then
    raise exception 'OFFLINE_SALE_CANCELLED' using errcode='23514';
  end if;
  select * into v_invoice from public.invoices where id = p_invoice_id and shop_id = p_shop_id
    and location_id = p_location_id for update;
  select * into v_context from public.pos_sale_contexts where invoice_id = p_invoice_id
    and shop_id = p_shop_id and location_id = p_location_id;
  if v_invoice.id is null or v_context.invoice_id is null then raise exception 'INVALID_POS_CHECKOUT'; end if;
  if p_amount <> (case when v_invoice.status='draft' then (shop_private.quote_invoice_tax(v_invoice.id,statement_timestamp())->>'total')::numeric else v_invoice.total_amount end) then raise exception 'POS_CHECKOUT_REQUIRES_FULL_PAYMENT' using errcode = '23514'; end if;
  if v_context.appointment_id is not null and p_appointment_request_id is null then
    raise exception 'INVALID_POS_APPOINTMENT' using errcode = '22023';
  end if;
  v_hash := md5(jsonb_build_object('invoice', p_invoice_id, 'amount', p_amount,
    'paidAt', p_paid_at, 'method', p_method, 'reference', nullif(btrim(p_reference), ''),
    'issueRequest', p_issue_request_id, 'paymentRequest', p_payment_request_id,
    'appointmentRequest', p_appointment_request_id)::text);
  insert into public.pos_sale_requests(request_id, shop_id, operation, payload_hash, invoice_id, actor_profile_id)
    values (p_request_id, p_shop_id, 'checkout', v_hash, p_invoice_id, v_actor) on conflict do nothing;
  select * into v_request from public.pos_sale_requests where request_id = p_request_id for update;
  if v_request.shop_id <> p_shop_id or v_request.operation <> 'checkout' or v_request.payload_hash <> v_hash
    or v_request.actor_profile_id <> v_actor then raise exception 'POS_REQUEST_CONFLICT' using errcode = '23505'; end if;
  if v_request.completed_at is not null then return v_request.invoice_id; end if;
  perform set_config('shop.location_id', p_location_id::text, true);
  if v_invoice.client_id is null then
    perform shop_private.checkout_customerless_sale(p_payment_request_id, p_shop_id, p_invoice_id,
      p_amount, p_paid_at, p_method, p_reference);
  else
    perform shop_private.issue_sale(p_issue_request_id, p_shop_id, p_invoice_id);
    select * into v_invoice from public.invoices where id = p_invoice_id and shop_id = p_shop_id;
    if p_amount <> v_invoice.total_amount then
      raise exception 'POS_CHECKOUT_REQUIRES_FULL_PAYMENT' using errcode = '23514';
    end if;
    perform shop_private.record_customer_receipt(p_payment_request_id, p_shop_id, v_invoice.client_id,
      p_amount, p_paid_at, p_method, p_reference, 'POS checkout',
      jsonb_build_array(jsonb_build_object('invoice_id', p_invoice_id, 'amount', p_amount)));
  end if;
  if v_context.appointment_id is not null then perform shop_private.link_appointment_sale(
    p_appointment_request_id, p_shop_id, v_context.appointment_id, p_invoice_id); end if;
  update public.pos_sale_requests set completed_at = clock_timestamp() where request_id = p_request_id;
  return p_invoice_id;
end;
$$;
