begin;
-- Trade metadata extends the existing client/catalogue and invoice ledgers.
create table public.customer_groups (
 id uuid primary key default gen_random_uuid(), shop_id uuid not null references public.shops(id),
 name text not null check(length(btrim(name)) between 2 and 120), active boolean not null default true,
 revision integer not null default 1 check(revision>0), created_by_profile_id uuid not null references public.profiles(id),
 created_at timestamptz not null default clock_timestamp(), updated_at timestamptz not null default clock_timestamp(), unique(id,shop_id)
);
create unique index customer_groups_active_name on public.customer_groups(shop_id,lower(btrim(name))) where active;
create table public.customer_group_assignments (
 customer_id uuid primary key, shop_id uuid not null, group_id uuid,
 revision integer not null default 1 check(revision>0), updated_at timestamptz not null default clock_timestamp(),
 foreign key(customer_id,shop_id) references public.clients(id,shop_id),
 foreign key(group_id,shop_id) references public.customer_groups(id,shop_id)
);
create table public.trade_price_rules (
 id uuid primary key default gen_random_uuid(), shop_id uuid not null, product_id uuid not null,
 customer_id uuid, group_id uuid, product_revision integer not null, stock_unit_code text not null references public.units_of_measure(code), currency_code text not null check(currency_code ~ '^[A-Z]{3}$'), unit_code text references public.units_of_measure(code), package_id uuid references public.product_packagings(id), package_version integer,
 minimum_quantity numeric(18,6) not null check(minimum_quantity>0), unit_price numeric(24,12) not null check(unit_price>=0 and unit_price<=999999999.99),
 starts_at timestamptz not null, ends_at timestamptz, priority integer not null default 0 check(priority between 0 and 1000),
 active boolean not null default true, revision integer not null default 1 check(revision>0),
 created_by_profile_id uuid not null references public.profiles(id), created_at timestamptz not null default clock_timestamp(), updated_at timestamptz not null default clock_timestamp(),
 foreign key(product_id,shop_id) references public.products(id,shop_id), foreign key(customer_id,shop_id) references public.clients(id,shop_id),
 foreign key(group_id,shop_id) references public.customer_groups(id,shop_id),
 check(num_nonnulls(customer_id,group_id)<=1), check(ends_at is null or ends_at>starts_at),
 check((package_id is null and package_version is null and unit_code is not null) or (package_id is not null and package_version>0 and unit_code is null)),
 unique(id,shop_id)
);
create index trade_price_resolution on public.trade_price_rules(shop_id,product_id,active,customer_id,group_id,minimum_quantity);
create table public.trade_configuration_history (
 id uuid primary key default gen_random_uuid(), shop_id uuid not null references public.shops(id), kind text not null,
 record_id uuid not null, revision integer not null, snapshot jsonb not null, reason text not null check(length(btrim(reason)) between 3 and 1000),
 actor_profile_id uuid not null references public.profiles(id), created_at timestamptz not null default clock_timestamp(), unique(shop_id,kind,record_id,revision)
);
create trigger trade_configuration_history_immutable before update or delete on public.trade_configuration_history for each row execute function shop_private.measurement_history_immutable();
create table shop_private.trade_configuration_requests (
 shop_id uuid not null, request_id uuid not null, action text not null, payload jsonb not null, actor_profile_id uuid not null references public.profiles(id),
 result jsonb, primary key(shop_id,request_id)
);
alter table shop_private.trade_configuration_requests enable row level security;
revoke all on shop_private.trade_configuration_requests from public,anon,authenticated,service_role;
alter table public.invoice_items add column trade_pricing_snapshot jsonb;
do $$declare t text;begin
 foreach t in array array['customer_groups','customer_group_assignments','trade_price_rules','trade_configuration_history'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
  execute format('grant select on public.%I to authenticated,service_role',t);
  execute format('create policy trade_configuration_read on public.%I for select to authenticated using(shop_private.has_permission(shop_id,''clients.view'') and shop_private.has_permission(shop_id,''products.manage''))',t);
  execute format('create policy trade_configuration_service_read on public.%I for select to service_role using(true)',t);
 end loop;
end;$$;

create function public.save_trade_configuration(p_request_id uuid,p_shop_id uuid,p_action text,p_payload jsonb,p_reason text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid;existing shop_private.trade_configuration_requests%rowtype;v_id uuid;rev integer;expected integer;v_result jsonb;
 g public.customer_groups%rowtype;assignment public.customer_group_assignments%rowtype;rule public.trade_price_rules%rowtype;
 product public.products%rowtype;package public.product_packagings%rowtype;unit text;minimum numeric;price numeric;begin
 if p_action not in('group','assignment','price') or p_action is null then raise exception 'INVALID_TRADE_ACTION' using errcode='22023';end if;
 actor:=shop_private.assert_shop_write_access(p_shop_id,case when p_action='price' then 'products.manage' else 'clients.manage' end);
 -- Group/price configuration does not post money or lock the business currency.
 -- Actual invoice posting retains its existing period and currency guards.
 if p_request_id is null or p_payload is null or jsonb_typeof(p_payload)<>'object' or p_reason is null or length(btrim(p_reason)) not between 3 and 1000 then raise exception 'INVALID_TRADE_CONFIGURATION' using errcode='22023';end if;
 insert into shop_private.trade_configuration_requests(shop_id,request_id,action,payload,actor_profile_id)
 values(p_shop_id,p_request_id,p_action,jsonb_build_object('value',p_payload,'reason',btrim(p_reason)),actor) on conflict do nothing;
 select * into existing from shop_private.trade_configuration_requests where shop_id=p_shop_id and request_id=p_request_id for update;
 if existing.action<>p_action or existing.payload<>jsonb_build_object('value',p_payload,'reason',btrim(p_reason)) or existing.actor_profile_id<>actor then raise exception 'TRADE_REQUEST_CONFLICT' using errcode='23505';end if;
 if existing.result is not null then return existing.result;end if;
 expected:=(p_payload->>'revision')::integer;
 if expected is null or expected<0 then raise exception 'INVALID_TRADE_REVISION' using errcode='22023';end if;
 if p_action='group' then
  v_id:=coalesce(nullif(p_payload->>'id','')::uuid,gen_random_uuid());
  perform pg_advisory_xact_lock(hashtextextended('shop-customer-groups:'||p_shop_id::text,0));
  select * into g from public.customer_groups where customer_groups.id=v_id and shop_id=p_shop_id for update;
  if expected<>coalesce(g.revision,0) then raise exception 'TRADE_CONTEXT_CHANGED' using errcode='55000';end if;
  if length(btrim(coalesce(p_payload->>'name',''))) not between 2 and 120 or jsonb_typeof(p_payload->'active') is distinct from 'boolean' then raise exception 'INVALID_CUSTOMER_GROUP' using errcode='22023';end if;
  if g.id is null then
   insert into public.customer_groups(id,shop_id,name,active,created_by_profile_id) values(v_id,p_shop_id,btrim(p_payload->>'name'),(p_payload->>'active')::boolean,actor);
  else
   update public.customer_groups set name=btrim(p_payload->>'name'),active=(p_payload->>'active')::boolean,revision=revision+1,updated_at=clock_timestamp() where customer_groups.id=v_id and shop_id=p_shop_id;
  end if;
  select to_jsonb(c),c.revision into v_result,rev from public.customer_groups c where c.id=v_id and c.shop_id=p_shop_id;
 elsif p_action='assignment' then
  v_id:=(p_payload->>'customerId')::uuid;
  perform 1 from public.clients c where c.id=v_id and c.shop_id=p_shop_id and c.is_active for update;
  if not found then raise exception 'CUSTOMER_NOT_FOUND' using errcode='P0002';end if;
  select * into assignment from public.customer_group_assignments a where a.customer_id=v_id and a.shop_id=p_shop_id for update;
  if expected<>coalesce(assignment.revision,0) then raise exception 'TRADE_CONTEXT_CHANGED' using errcode='55000';end if;
  if nullif(p_payload->>'groupId','') is not null and not exists(select 1 from public.customer_groups where customer_groups.id=(p_payload->>'groupId')::uuid and shop_id=p_shop_id and active) then raise exception 'CUSTOMER_GROUP_NOT_FOUND' using errcode='P0002';end if;
  insert into public.customer_group_assignments(customer_id,shop_id,group_id) values(v_id,p_shop_id,nullif(p_payload->>'groupId','')::uuid)
  on conflict(customer_id) do update set group_id=excluded.group_id,revision=customer_group_assignments.revision+1,updated_at=clock_timestamp();
  select to_jsonb(a),a.revision into v_result,rev from public.customer_group_assignments a where a.customer_id=v_id and a.shop_id=p_shop_id;
 else
  v_id:=coalesce(nullif(p_payload->>'id','')::uuid,gen_random_uuid());
  select * into product from public.products p where p.id=(p_payload->>'productId')::uuid and p.shop_id=p_shop_id for update;
  if not found then raise exception 'PRODUCT_NOT_FOUND' using errcode='P0002';end if;
  select * into rule from public.trade_price_rules r where r.id=v_id and r.shop_id=p_shop_id for update;
  if expected<>coalesce(rule.revision,0) then raise exception 'TRADE_CONTEXT_CHANGED' using errcode='55000';end if;
  if rule.id is not null and rule.product_id<>product.id then raise exception 'TRADE_RULE_PRODUCT_IMMUTABLE' using errcode='55000';end if;
  if rule.id is not null and p_payload->'active'='false'::jsonb then
   -- Archival preserves the former definition even after a product or package
   -- is retired/reconfigured. It never attempts to reactivate stale units.
   update public.trade_price_rules set active=false,revision=revision+1,updated_at=clock_timestamp() where trade_price_rules.id=v_id and shop_id=p_shop_id;
   select to_jsonb(r),r.revision into v_result,rev from public.trade_price_rules r where r.id=v_id and r.shop_id=p_shop_id;
   insert into public.trade_configuration_history(shop_id,kind,record_id,revision,snapshot,reason,actor_profile_id) values(p_shop_id,p_action,v_id,rev,v_result,btrim(p_reason),actor);
   update shop_private.trade_configuration_requests set result=v_result||jsonb_build_object('id',v_id) where shop_id=p_shop_id and request_id=p_request_id;
   return v_result||jsonb_build_object('id',v_id);
  end if;
  if not product.is_active then raise exception 'PRODUCT_NOT_FOUND' using errcode='P0002';end if;

  if coalesce(p_payload->>'minimumQuantity','') !~ '^[0-9]{1,12}(\.[0-9]{1,6})?$' or coalesce(p_payload->>'price','') !~ '^[0-9]{1,9}(\.[0-9]{1,12})?$'
   or jsonb_typeof(p_payload->'active') is distinct from 'boolean' then raise exception 'INVALID_TRADE_PRICE' using errcode='22023';end if;
  minimum:=(p_payload->>'minimumQuantity')::numeric;price:=(p_payload->>'price')::numeric;
  if minimum<=0 or minimum>1000000 then raise exception 'INVALID_TRADE_MINIMUM' using errcode='22023';end if;
  if product.measurement_status='prepared' then raise exception 'MEASUREMENT_WORKFLOW_NOT_READY' using errcode='55000';end if;
  if product.measurement_status='active' then perform shop_private.assert_measured_quantity(p_shop_id,product.id,minimum);
  elsif round(minimum,3)<>minimum then raise exception 'INVALID_TRADE_MINIMUM' using errcode='22023';end if;
  if nullif(p_payload->>'customerId','') is not null and not exists(select 1 from public.clients c where c.id=(p_payload->>'customerId')::uuid and c.shop_id=p_shop_id and c.is_active) then raise exception 'CUSTOMER_NOT_FOUND' using errcode='P0002';end if;
  if nullif(p_payload->>'groupId','') is not null and not exists(select 1 from public.customer_groups c where c.id=(p_payload->>'groupId')::uuid and c.shop_id=p_shop_id and c.active) then raise exception 'CUSTOMER_GROUP_NOT_FOUND' using errcode='P0002';end if;
  if nullif(p_payload->>'customerId','') is not null and nullif(p_payload->>'groupId','') is not null then raise exception 'AMBIGUOUS_TRADE_SCOPE' using errcode='22023';end if;
  if nullif(p_payload->>'packageId','') is not null then
   select * into package from public.product_packagings k where k.id=(p_payload->>'packageId')::uuid and k.product_id=product.id and k.shop_id=p_shop_id and k.active and k.can_sell;
   if not found or product.measurement_status<>'active' or p_payload->>'packageVersion' is distinct from package.version::text then raise exception 'PACKAGE_CONTEXT_CHANGED' using errcode='55000';end if;
   unit:=null;
  else
   unit:=coalesce(nullif(p_payload->>'unitCode',''),case when product.measurement_status='legacy' then 'ea' else product.base_unit_code end);
   if product.measurement_status='legacy' then
    if unit<>'ea' then raise exception 'PRODUCT_MEASUREMENT_NOT_CONFIGURED' using errcode='55000';end if;
   elsif not exists(select 1 from public.units_of_measure u join public.units_of_measure b on b.code=product.base_unit_code and b.dimension=u.dimension where u.code=unit and u.dimension not in('package','set')) then raise exception 'MEASUREMENT_DIMENSION_MISMATCH' using errcode='22023';end if;
  end if;
  if (p_payload->>'startsAt')::timestamptz is null or coalesce((p_payload->>'priority')::integer,0) not between 0 and 1000 then raise exception 'INVALID_TRADE_VALIDITY' using errcode='22023';end if;
  insert into public.trade_price_rules(id,shop_id,product_id,customer_id,group_id,product_revision,stock_unit_code,currency_code,unit_code,package_id,package_version,minimum_quantity,unit_price,starts_at,ends_at,priority,active,created_by_profile_id)
  values(v_id,p_shop_id,product.id,nullif(p_payload->>'customerId','')::uuid,nullif(p_payload->>'groupId','')::uuid,product.measurement_revision,case when product.measurement_status='legacy' then 'ea' else product.base_unit_code end,(select business_currency from public.shops where id=p_shop_id),unit,package.id,package.version,minimum,price,(p_payload->>'startsAt')::timestamptz,nullif(p_payload->>'endsAt','')::timestamptz,coalesce((p_payload->>'priority')::integer,0),(p_payload->>'active')::boolean,actor)
  on conflict(id) do update set customer_id=excluded.customer_id,group_id=excluded.group_id,product_revision=excluded.product_revision,stock_unit_code=excluded.stock_unit_code,currency_code=excluded.currency_code,unit_code=excluded.unit_code,package_id=excluded.package_id,package_version=excluded.package_version,
   minimum_quantity=excluded.minimum_quantity,unit_price=excluded.unit_price,starts_at=excluded.starts_at,ends_at=excluded.ends_at,priority=excluded.priority,active=excluded.active,revision=trade_price_rules.revision+1,updated_at=clock_timestamp() where trade_price_rules.shop_id=p_shop_id and trade_price_rules.product_id=product.id;
  select to_jsonb(r),r.revision into v_result,rev from public.trade_price_rules r where r.id=v_id and r.shop_id=p_shop_id;
 end if;
 if v_result is null then raise exception 'TRADE_CONTEXT_CHANGED' using errcode='55000';end if;
 insert into public.trade_configuration_history(shop_id,kind,record_id,revision,snapshot,reason,actor_profile_id) values(p_shop_id,p_action,v_id,rev,v_result,btrim(p_reason),actor);
 update shop_private.trade_configuration_requests set result=v_result||jsonb_build_object('id',v_id) where shop_id=p_shop_id and request_id=p_request_id;
 return v_result||jsonb_build_object('id',v_id);
end;$$;
revoke all on function public.save_trade_configuration(uuid,uuid,text,jsonb,text) from public,anon,authenticated,service_role;
grant execute on function public.save_trade_configuration(uuid,uuid,text,jsonb,text) to authenticated;

create function shop_private.lock_trade_customer(p_shop uuid,p_invoice uuid) returns void
language plpgsql set search_path='' as $$declare customer uuid;begin
 select client_id into customer from public.invoices where id=p_invoice and shop_id=p_shop;
 if customer is null then return;end if;
 -- Issuance already owns sorted product locks. Assignment commands own only
 -- this client row; group edits own only their group row, so neither reverses
 -- the product -> client -> group lock order.
 perform 1 from public.clients where id=customer and shop_id=p_shop for share;
 perform 1 from public.customer_groups g join public.customer_group_assignments a on a.group_id=g.id and a.shop_id=g.shop_id
 where a.customer_id=customer and a.shop_id=p_shop for share of g;
end;$$;
revoke all on function shop_private.lock_trade_customer(uuid,uuid) from public,anon,authenticated,service_role;

-- Quantity breaks use canonical stock quantities. Contract/group precedence is
-- independent of priority; priority and the largest break settle within a scope.
create function shop_private.apply_trade_price(p_shop uuid,p_product uuid,p_customer uuid,p_input jsonb,p_resolved jsonb,p_threshold_quantity numeric default null) returns jsonb
language plpgsql stable set search_path='' as $$
declare product public.products%rowtype;r public.trade_price_rules%rowtype;g uuid;factor numeric;price numeric;entered_price numeric;
 quantity numeric:=(p_resolved->>'baseQuantity')::numeric;measurement jsonb:=p_resolved->'measurement';snapshot jsonb;original numeric:=(p_resolved->>'baseUnitPrice')::numeric;
 override_price text:=p_input->>'override_price';override_reason text:=nullif(btrim(p_input->>'override_reason'),'');begin
 select * into strict product from public.products where id=p_product and shop_id=p_shop;
 if p_customer is not null then
  if not exists(select 1 from public.clients where id=p_customer and shop_id=p_shop and is_active) then raise exception 'CUSTOMER_NOT_FOUND' using errcode='P0002';end if;
  select a.group_id into g from public.customer_group_assignments a join public.customer_groups c on c.id=a.group_id and c.shop_id=a.shop_id and c.active where a.customer_id=p_customer and a.shop_id=p_shop;
 end if;
 if coalesce(measurement->>'priceSource','')<>'reel_remnant' then
  select rule.* into r from public.trade_price_rules rule
  where rule.shop_id=p_shop and rule.product_id=p_product and rule.active and rule.currency_code=(select business_currency from public.shops where id=p_shop) and rule.product_revision=product.measurement_revision and rule.stock_unit_code=case when product.measurement_status='legacy' then 'ea' else product.base_unit_code end and rule.minimum_quantity<=coalesce(p_threshold_quantity,quantity)
   and rule.starts_at<=statement_timestamp() and (rule.ends_at is null or rule.ends_at>statement_timestamp())
   and (rule.customer_id is null or rule.customer_id=p_customer) and (rule.group_id is null or rule.group_id=g)
   and (rule.package_id is null or (rule.package_id=nullif(measurement->>'packageId','')::uuid and rule.package_version=(measurement->>'packageVersion')::integer))
  order by case when rule.customer_id is not null then 0 when rule.group_id is not null then 1 else 2 end,rule.priority desc,rule.minimum_quantity desc,rule.created_at desc,rule.id limit 1;
 end if;
 if r.id is not null then
  if r.package_id is not null then select base_quantity into factor from public.product_packagings where id=r.package_id and shop_id=p_shop and product_id=p_product;
  elsif product.measurement_status='legacy' then factor:=1;
  else select u.canonical_conversion_factor/b.canonical_conversion_factor into factor from public.units_of_measure u cross join public.units_of_measure b where u.code=r.unit_code and b.code=product.base_unit_code;end if;
  price:=round(r.unit_price/factor,12);
  if round(price*factor,8)<>round(r.unit_price,8) then raise exception 'MEASUREMENT_PRICE_PRECISION' using errcode='22023';end if;
  snapshot:=jsonb_build_object('source',case when r.customer_id is not null then 'customer_contract' when r.group_id is not null then 'customer_group' else 'quantity_break' end,
   'ruleId',r.id,'revision',r.revision,'productRevision',r.product_revision,'stockUnitCode',r.stock_unit_code,'currency',r.currency_code,'customerId',p_customer,'groupId',g,'minimumBaseQuantity',trim_scale(r.minimum_quantity)::text,'unitCode',r.unit_code,'packageId',r.package_id,'packageVersion',r.package_version,
   'ruleUnitPrice',trim_scale(r.unit_price)::text,'originalBaseUnitPrice',trim_scale(original)::text,'baseUnitPrice',trim_scale(price)::text,'resolvedAt',statement_timestamp());
 else price:=original;end if;
 if override_price is not null then
  if not shop_private.has_permission(p_shop,'products.manage') then raise exception 'PRICE_OVERRIDE_PERMISSION_DENIED' using errcode='42501';end if;
  if override_price !~ '^[0-9]{1,9}(\.[0-9]{1,12})?$' or override_reason is null or length(override_reason) not between 3 and 1000 then raise exception 'INVALID_PRICE_OVERRIDE' using errcode='22023';end if;
  entered_price:=override_price::numeric;
  factor:=case when measurement is null or measurement='null'::jsonb then 1 else quantity/(measurement->>'enteredQuantity')::numeric end;
  snapshot:=coalesce(snapshot,'{}')||jsonb_build_object('source','staff_override','currency',(select business_currency from public.shops where id=p_shop),'productRevision',product.measurement_revision,'stockUnitCode',case when product.measurement_status='legacy' then 'ea' else product.base_unit_code end,'originalBaseUnitPrice',trim_scale(price)::text,'overrideEnteredUnitPrice',override_price,'reason',override_reason,
   'customerId',p_customer,'actorProfileId',(select p.id from public.profiles p where p.user_id=auth.uid() and p.status='active' and p.portal_id=(select portal_id from public.shops where id=p_shop)), 'resolvedAt',statement_timestamp());
  price:=round(entered_price/factor,12);
  if round(price*factor,8)<>round(entered_price,8) then raise exception 'MEASUREMENT_PRICE_PRECISION' using errcode='22023';end if;
  snapshot:=snapshot||jsonb_build_object('baseUnitPrice',trim_scale(price)::text);
 end if;
 if snapshot is null then return p_resolved||jsonb_build_object('pricing',null);end if;
 if measurement is not null and measurement<>'null'::jsonb then
  entered_price:=price*quantity/(measurement->>'enteredQuantity')::numeric;
  if round(entered_price,12)<>entered_price then raise exception 'MEASUREMENT_PRICE_PRECISION' using errcode='22023';end if;
  measurement:=measurement||jsonb_build_object('enteredUnitPrice',trim_scale(entered_price)::text,'baseUnitPrice',trim_scale(price)::text,'tradePricing',snapshot);
 end if;
 return p_resolved||jsonb_build_object('baseUnitPrice',price,'lineTotal',round(price*quantity,2),'measurement',measurement,'pricing',snapshot);
end;$$;
revoke all on function shop_private.apply_trade_price(uuid,uuid,uuid,jsonb,jsonb,numeric) from public,anon,authenticated,service_role;


-- A cashier can retain a manager approval already stored in the same draft,
-- while the invoice/customer/SKU/quantity/unit/source and approved input match.
-- Both callers supply previous rows read from the database, never browser JSON.
create function shop_private.apply_trade_line_price(p_shop uuid,p_product uuid,p_customer uuid,p_input jsonb,p_resolved jsonb,p_threshold numeric,p_previous jsonb default null,p_previous_customer uuid default null) returns jsonb
language plpgsql stable set search_path='' as $$
declare approval jsonb:=p_previous->'trade_pricing_snapshot';m jsonb:=p_resolved->'measurement';key text;price numeric;begin
 if p_input->>'override_price' is not null and not shop_private.has_permission(p_shop,'products.manage') then
  if approval->>'currency' is distinct from (select business_currency from public.shops where id=p_shop) or p_previous_customer is distinct from p_customer or approval->>'source' is distinct from 'staff_override'
   or approval->>'actorProfileId' is null or p_previous->>'product_id' is distinct from p_product::text
   or (p_previous->>'quantity')::numeric is distinct from (p_resolved->>'baseQuantity')::numeric
   or approval->>'overrideEnteredUnitPrice' is distinct from p_input->>'override_price'
   or approval->>'reason' is distinct from btrim(p_input->>'override_reason') then raise exception 'PRICE_OVERRIDE_PERMISSION_DENIED' using errcode='42501';end if;
  foreach key in array array['baseUnitCode','enteredUnitCode','enteredQuantity','productRevision','packageId','packageVersion','reelId','allowSplit','cuttingLoss'] loop
   if p_previous->'measurement_snapshot'->key is distinct from m->key then raise exception 'PRICE_APPROVAL_CONTEXT_CHANGED' using errcode='55000';end if;
  end loop;
  price:=(p_previous->>'unit_price')::numeric;
  if m is not null and m<>'null'::jsonb then m:=m||jsonb_build_object('tradePricing',approval,'baseUnitPrice',trim_scale(price)::text,
   'enteredUnitPrice',approval->>'overrideEnteredUnitPrice');end if;
  return p_resolved||jsonb_build_object('baseUnitPrice',price,'lineTotal',round(price*(p_resolved->>'baseQuantity')::numeric,2),'measurement',m,'pricing',approval);
 end if;
 return shop_private.apply_trade_price(p_shop,p_product,p_customer,p_input,p_resolved,p_threshold);
end;$$;
revoke all on function shop_private.apply_trade_line_price(uuid,uuid,uuid,jsonb,jsonb,numeric,jsonb,uuid) from public,anon,authenticated,service_role;

create function public.trade_pricing_context(p_shop_id uuid,p_kind text default 'price',p_product_id uuid default null,p_customer_id uuid default null,p_search text default null,p_page integer default 1) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare items jsonb;total bigint;groups jsonb;assignment jsonb;term text:=nullif(btrim(p_search),'');begin
 if not shop_private.has_permission(p_shop_id,'clients.view') then raise exception 'SHOP_PERMISSION_DENIED' using errcode='42501';end if;
 if p_kind not in('price','group','group_options','history') or p_kind is null or p_page is null or p_page<1 or length(coalesce(term,''))>120 then raise exception 'INVALID_TRADE_QUERY' using errcode='22023';end if;
 if p_kind='price' and (not shop_private.has_permission(p_shop_id,'products.manage') or not shop_private.has_permission(p_shop_id,'products.view')) then raise exception 'SHOP_PERMISSION_DENIED' using errcode='42501';end if;
 if p_kind='history' and not shop_private.has_permission(p_shop_id,'products.manage') then raise exception 'SHOP_PERMISSION_DENIED' using errcode='42501';end if;
 if p_customer_id is not null and not exists(select 1 from public.clients c where c.id=p_customer_id and c.shop_id=p_shop_id and c.is_active) then raise exception 'CUSTOMER_NOT_FOUND' using errcode='P0002';end if;
 if p_product_id is not null and not exists(select 1 from public.products c where c.id=p_product_id and c.shop_id=p_shop_id and c.is_active) then raise exception 'PRODUCT_NOT_FOUND' using errcode='P0002';end if;
 if p_kind in('group','group_options') then
  select count(*) into total from public.customer_groups c where c.shop_id=p_shop_id and (p_kind='group' or c.active) and (term is null or c.name ilike '%'||term||'%');
  select coalesce(jsonb_agg(to_jsonb(c) order by c.name,c.id),'[]') into items from (select * from public.customer_groups g where g.shop_id=p_shop_id and (p_kind='group' or g.active) and (term is null or g.name ilike '%'||term||'%') order by g.name,g.id offset (p_page-1)*20 limit 20)c;
 elsif p_kind='history' then
  select count(*) into total from public.trade_configuration_history h where h.shop_id=p_shop_id;
  select coalesce(jsonb_agg(to_jsonb(h) order by h.created_at desc,h.id),'[]') into items from (select h.* from public.trade_configuration_history h where h.shop_id=p_shop_id order by h.created_at desc,h.id offset (p_page-1)*20 limit 20)h;
 else
  select count(*) into total from public.trade_price_rules r join public.products p on p.id=r.product_id and p.shop_id=r.shop_id
   where r.shop_id=p_shop_id and (p_product_id is null or r.product_id=p_product_id) and (p_customer_id is null or r.customer_id=p_customer_id) and (term is null or p.name ilike '%'||term||'%');
  select coalesce(jsonb_agg(to_jsonb(r)||jsonb_build_object('unit_price',trim_scale(r.unit_price)::text,'minimum_quantity',trim_scale(r.minimum_quantity)::text) order by r.product_name,r.priority desc,r.id),'[]') into items from (
   select r.*,p.name product_name,(r.currency_code=(select business_currency from public.shops where id=p_shop_id) and r.product_revision=p.measurement_revision and r.stock_unit_code=case when p.measurement_status='legacy' then 'ea' else p.base_unit_code end) configuration_current,c.name customer_name,g.name group_name,k.name package_name from public.trade_price_rules r
   join public.products p on p.id=r.product_id and p.shop_id=r.shop_id left join public.clients c on c.id=r.customer_id and c.shop_id=r.shop_id
   left join public.customer_groups g on g.id=r.group_id and g.shop_id=r.shop_id left join public.product_packagings k on k.id=r.package_id and k.shop_id=r.shop_id
   where r.shop_id=p_shop_id and (p_product_id is null or r.product_id=p_product_id) and (p_customer_id is null or r.customer_id=p_customer_id) and (term is null or p.name ilike '%'||term||'%')
   order by p.name,r.priority desc,r.id offset (p_page-1)*20 limit 20)r;
 end if;
 select coalesce(jsonb_agg(to_jsonb(g) order by g.name,g.id),'[]') into groups from (select id,name,revision from public.customer_groups g where g.shop_id=p_shop_id and g.active and (term is null or g.name ilike '%'||term||'%') order by g.name,g.id limit 100)g;
 select to_jsonb(a) into assignment from public.customer_group_assignments a where a.shop_id=p_shop_id and a.customer_id=p_customer_id;
 return jsonb_build_object('items',items,'total',total,'page',p_page,'pageSize',20,'groups',groups,'assignment',assignment,
  'canManageGroups',shop_private.has_permission(p_shop_id,'clients.manage'),'canManagePrices',shop_private.has_permission(p_shop_id,'products.manage'));
end;$$;
revoke all on function public.trade_pricing_context(uuid,text,uuid,uuid,text,integer) from public,anon,authenticated,service_role;
grant execute on function public.trade_pricing_context(uuid,text,uuid,uuid,text,integer) to authenticated;

create function shop_private.remove_stacked_trade_offers(p_shop uuid,p_invoice uuid) returns void
language plpgsql set search_path='' as $$begin
 if exists(select 1 from public.invoice_items where shop_id=p_shop and invoice_id=p_invoice and trade_pricing_snapshot is not null) then
  update public.invoices set tax_order_discount=0,offer_snapshot='[]' where id=p_invoice and shop_id=p_shop and status='draft' and jsonb_array_length(offer_snapshot)>0;
 end if;
end;$$;
revoke all on function shop_private.remove_stacked_trade_offers(uuid,uuid) from public,anon,authenticated,service_role;

do $$begin if (select md5(prosrc) from pg_catalog.pg_proc where oid='shop_private.save_sale_draft(uuid,uuid,uuid,uuid,text,jsonb)'::regprocedure) is distinct from 'b664604a109b7568a6bcb839d09317ed' then raise exception 'TRADE_ROUTINE_REVIEW_REQUIRED: shop_private.save_sale_draft' using errcode='55000';end if;end;$$;
CREATE OR REPLACE FUNCTION shop_private.save_sale_draft(p_request_id uuid, p_shop_id uuid, p_invoice_id uuid, p_customer_id uuid, p_notes text, p_lines jsonb) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_profile_id uuid;
  v_invoice_id uuid;
  v_request public.sale_requests%rowtype;
  v_payload_hash text;
  v_mode public.business_mode;
  v_customer_name text;
  v_line record;
  v_product public.products%rowtype;
  v_service public.services%rowtype;
  v_quantity numeric;
  v_unit_discount numeric;
  v_discount numeric;
  v_total numeric;
  v_measurement jsonb;
  v_prior_lines jsonb;v_prior_customer uuid;
begin
  v_profile_id := shop_private.assert_shop_write_access(p_shop_id, 'sales.manage');
  if p_request_id is null or p_lines is null or jsonb_typeof(p_lines) <> 'array'
    or jsonb_array_length(p_lines) < 1 or jsonb_array_length(p_lines) > 100
    or (p_notes is not null and length(btrim(p_notes)) > 2000) then
    raise exception 'INVALID_SALE_DRAFT' using errcode = '22023';
  end if;

  v_payload_hash := md5(jsonb_build_object(
    'invoiceId', p_invoice_id, 'customerId', p_customer_id,
    'notes', nullif(btrim(p_notes), ''), 'lines', p_lines
  )::text);
  insert into public.sale_requests (
    shop_id, operation, request_id, actor_profile_id, payload_hash
  ) values (
    p_shop_id, 'save_draft', p_request_id, v_profile_id, v_payload_hash
  ) on conflict do nothing;
  select * into v_request from public.sale_requests
  where shop_id = p_shop_id and operation = 'save_draft'
    and request_id = p_request_id
  for update;
  if v_request.actor_profile_id <> v_profile_id
    or v_request.payload_hash <> v_payload_hash then
    raise exception 'SALE_REQUEST_CONFLICT' using errcode = '23505';
  end if;
  if v_request.invoice_id is not null then
    return v_request.invoice_id;
  end if;

  select business_mode into v_mode from public.shops where id = p_shop_id for update;
  if p_customer_id is not null then
    select name into v_customer_name from public.clients
    where id = p_customer_id and shop_id = p_shop_id and is_active;
    if v_customer_name is null then raise exception 'CUSTOMER_NOT_FOUND'; end if;
  end if;

  if p_invoice_id is null then
    insert into public.invoices (
      shop_id, created_by_profile_id, invoice_number, status, total_amount,
      discount_amount, notes, client_id, client_name_snapshot
    ) values (
      p_shop_id, v_profile_id, null, 'draft', 0, 0,
      nullif(btrim(p_notes), ''), p_customer_id, v_customer_name
    ) returning id into v_invoice_id;
  else
    select id into v_invoice_id from public.invoices
    where id = p_invoice_id and shop_id = p_shop_id and status = 'draft'
    for update;
    if v_invoice_id is null then raise exception 'SALE_DRAFT_NOT_FOUND'; end if;
    select client_id into v_prior_customer from public.invoices where id=v_invoice_id and shop_id=p_shop_id;
    select jsonb_agg(to_jsonb(i) order by i.line_order) into v_prior_lines from public.invoice_items i where i.invoice_id=v_invoice_id and i.shop_id=p_shop_id;
    update public.invoices set
      client_id = p_customer_id, client_name_snapshot = v_customer_name,
      notes = nullif(btrim(p_notes), ''), updated_at = now()
    where id = v_invoice_id;
    delete from public.invoice_items where invoice_id = v_invoice_id;
  end if;

  for v_line in
    select value as body, ordinality::integer as line_order
    from jsonb_array_elements(p_lines) with ordinality
  loop
    begin
      v_quantity := (v_line.body ->> 'quantity')::numeric;
    exception when others then
      raise exception 'INVALID_SALE_LINE' using errcode = '22023';
    end;
    if v_quantity is null or v_quantity <= 0 or v_quantity > 1000000
      or round(v_quantity,case when v_line.body->>'item_type'='product' then shop_private.quantity_scale(p_shop_id,(v_line.body->>'source_id')::uuid,3) else 3 end) <> v_quantity then
      raise exception 'INVALID_SALE_LINE' using errcode = '22023';
    end if;

    if v_line.body ->> 'item_type' = 'product' then
      if v_mode not in ('product', 'mixed') then
        raise exception 'BUSINESS_MODE_PRODUCT_DISABLED' using errcode = '23514';
      end if;
      select * into v_product from public.products
      where id = (v_line.body ->> 'source_id')::uuid
        and shop_id = p_shop_id and is_active;
      if not found then raise exception 'PRODUCT_NOT_FOUND'; end if;
      v_discount := 0;
      v_measurement:=shop_private.resolve_measured_line(p_shop_id,v_product.id,v_line.body);
      v_measurement:=shop_private.apply_trade_line_price(p_shop_id,v_product.id,p_customer_id,v_line.body,v_measurement,shop_private.trade_cart_quantity(p_shop_id,v_product.id,p_lines),v_prior_lines->(v_line.line_order-1),v_prior_customer);
      v_quantity:=(v_measurement->>'baseQuantity')::numeric;
      v_total := coalesce((v_measurement->>'lineTotal')::numeric,round(v_product.sale_price*v_quantity,2));
      insert into public.invoice_items (
        invoice_id, shop_id, line_order, item_type, item_name, quantity,
        unit_price, discount_amount, total_amount, product_id, measurement_snapshot, trade_pricing_snapshot,
        product_sku_snapshot, product_barcode_snapshot,
        discount_type_snapshot, discount_value_snapshot
      ) values (
        v_invoice_id, p_shop_id, v_line.line_order, 'product', v_product.name,
        v_quantity, (v_measurement->>'baseUnitPrice')::numeric, 0, v_total, v_product.id, nullif(v_measurement->'measurement','null'::jsonb), nullif(v_measurement->'pricing','null'::jsonb),
        v_product.sku, v_product.barcode, null, 0
      );
    elsif v_line.body ->> 'item_type' = 'service' then
      if v_mode not in ('service', 'mixed') then
        raise exception 'BUSINESS_MODE_SERVICE_DISABLED' using errcode = '23514';
      end if;
      select * into v_service from public.services
      where id = (v_line.body ->> 'source_id')::uuid
        and shop_id = p_shop_id and is_active;
      if not found then raise exception 'SERVICE_NOT_FOUND'; end if;
      v_unit_discount := case v_service.default_discount_type
        when 'percent' then round(v_service.base_sale_price * v_service.default_discount_value / 100, 2)
        else v_service.default_discount_value end;
      v_discount := round(v_unit_discount * v_quantity, 2);
      v_total := round(v_service.base_sale_price * v_quantity - v_discount, 2);
      insert into public.invoice_items (
        invoice_id, shop_id, line_order, item_type, item_name, quantity,
        unit_price, discount_amount, total_amount, service_id,
        discount_type_snapshot, discount_value_snapshot
      ) values (
        v_invoice_id, p_shop_id, v_line.line_order, 'service', v_service.name,
        v_quantity, v_service.base_sale_price, v_discount, v_total, v_service.id,
        v_service.default_discount_type, v_service.default_discount_value
      );
    else
      raise exception 'UNSUPPORTED_SALE_LINE_TYPE' using errcode = '22023';
    end if;
  end loop;

  update public.invoices invoice set
    total_amount = totals.total_amount,
    discount_amount = totals.discount_amount,
    updated_at = now()
  from (
    select coalesce(sum(total_amount), 0) as total_amount,
      coalesce(sum(discount_amount), 0) as discount_amount
    from public.invoice_items where invoice_id = v_invoice_id
  ) totals where invoice.id = v_invoice_id;
  update public.sale_requests set invoice_id = v_invoice_id, completed_at = now()
  where shop_id = p_shop_id and operation = 'save_draft'
    and request_id = p_request_id;
  return v_invoice_id;
exception
  when invalid_text_representation then
    raise exception 'INVALID_SALE_LINE' using errcode = '22023';
end;
$$;


do $$begin if (select md5(prosrc) from pg_catalog.pg_proc where oid='shop_private.reprice_measured_invoice_line(uuid)'::regprocedure) is distinct from '3c49cc93a1ec4a6b4f223e64b6711a76' then raise exception 'TRADE_ROUTINE_REVIEW_REQUIRED: shop_private.reprice_measured_invoice_line' using errcode='55000';end if;end;$$;
CREATE OR REPLACE FUNCTION shop_private.reprice_measured_invoice_line(p_line_id uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$declare p_line public.invoice_items%rowtype;m jsonb;r jsonb;customer uuid;input jsonb;frozen jsonb;begin
 select * into strict p_line from public.invoice_items where id=p_line_id;
 m:=p_line.measurement_snapshot;
 select client_id into customer from public.invoices where id=p_line.invoice_id and shop_id=p_line.shop_id;
 if m is null or m='null'::jsonb then
  input:=jsonb_build_object('quantity',trim_scale(p_line.quantity)::text);
 else
  input:=jsonb_strip_nulls(jsonb_build_object('quantity',m->>'enteredQuantity','unit_code',m->>'enteredUnitCode',
   'reel_id',m->'reelId','allow_split',m->'allowSplit','cutting_loss',m->'cuttingLoss','measurement_revision',m->'productRevision','package_id',m->'packageId','package_version',m->'packageVersion'));
 end if;
 r:=shop_private.resolve_measured_line(p_line.shop_id,p_line.product_id,input);
 if (r->>'baseQuantity')::numeric<>p_line.quantity then raise exception 'MEASUREMENT_CONTEXT_CHANGED' using errcode='55000';end if;
 frozen:=p_line.trade_pricing_snapshot;
 if frozen->>'source'='staff_override' then
  if frozen->>'currency' is distinct from (select business_currency from public.shops where id=p_line.shop_id) then raise exception 'PRICE_APPROVAL_CONTEXT_CHANGED' using errcode='55000';end if;
  -- The original manager approval is server-written draft history. Issuing
  -- staff need not reacquire product-management authority to honor that approval.
  if frozen->>'actorProfileId' is null or frozen->>'reason' is null then raise exception 'INVALID_PRICE_APPROVAL' using errcode='23514';end if;
  m:=r->'measurement';
  if m is not null and m<>'null'::jsonb then m:=m||jsonb_build_object('tradePricing',frozen,'baseUnitPrice',trim_scale(p_line.unit_price)::text,
   'enteredUnitPrice',trim_scale(p_line.unit_price*p_line.quantity/(m->>'enteredQuantity')::numeric)::text);end if;
  return r||jsonb_build_object('baseUnitPrice',p_line.unit_price,'lineTotal',round(p_line.quantity*p_line.unit_price,2),'measurement',m,'pricing',frozen);
 end if;
 return shop_private.apply_trade_price(p_line.shop_id,p_line.product_id,customer,input,r,(select sum(quantity) from public.invoice_items where invoice_id=p_line.invoice_id and product_id=p_line.product_id));
end;$$;


do $$begin if (select md5(prosrc) from pg_catalog.pg_proc where oid='shop_private.issue_sale(uuid,uuid,uuid)'::regprocedure) is distinct from '978d855fc7413c9a5e1c3e9f4e4d021a' then raise exception 'TRADE_ROUTINE_REVIEW_REQUIRED: shop_private.issue_sale' using errcode='55000';end if;end;$$;
CREATE OR REPLACE FUNCTION shop_private.issue_sale(p_request_id uuid, p_shop_id uuid, p_invoice_id uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_profile_id uuid;
  v_request public.sale_requests%rowtype;
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
  v_measurement jsonb;
  v_number bigint;
  v_issued_at timestamptz := clock_timestamp();
  v_payload_hash text := md5(coalesce(p_invoice_id::text, ''));
begin
  v_profile_id := shop_private.assert_shop_write_access(p_shop_id, 'sales.issue');
  if p_request_id is null or p_invoice_id is null then
    raise exception 'INVALID_SALE_ISSUE' using errcode = '22023';
  end if;

  insert into public.sale_requests (
    shop_id, operation, request_id, actor_profile_id, payload_hash
  ) values (
    p_shop_id, 'issue', p_request_id, v_profile_id, v_payload_hash
  ) on conflict do nothing;
  select * into v_request from public.sale_requests
  where shop_id = p_shop_id and operation = 'issue' and request_id = p_request_id
  for update;
  if v_request.actor_profile_id <> v_profile_id
    or v_request.payload_hash <> v_payload_hash then
    raise exception 'SALE_REQUEST_CONFLICT' using errcode = '23505';
  end if;
  if v_request.invoice_id is not null then return v_request.invoice_id; end if;

  select * into v_invoice from public.invoices
  where id = p_invoice_id and shop_id = p_shop_id for update;
  if not found then raise exception 'SALE_DRAFT_NOT_FOUND'; end if;
  if v_invoice.status <> 'draft'::public.invoice_status then
    raise exception 'SALE_NOT_DRAFT' using errcode = '23514';
  end if;
  if v_invoice.client_id is null then
    raise exception 'OUTSTANDING_SALE_REQUIRES_CUSTOMER' using errcode = '23514';
  end if;
  if not exists (select 1 from public.invoice_items where invoice_id = p_invoice_id) then
    raise exception 'SALE_REQUIRES_LINES' using errcode = '23514';
  end if;

  -- Product rows are the serialization point shared by supported stock writes.
  -- The stable ordering prevents opposite-order multi-product deadlocks.
  perform product.id
  from public.products product
  join (
    select distinct item.product_id
    from public.invoice_items item
    where item.invoice_id = p_invoice_id and item.item_type = 'product'
  ) requested on requested.product_id = product.id
  order by product.id
  for update of product;

  perform service.id
  from public.services service
  join (
    select distinct item.service_id
    from public.invoice_items item
    where item.invoice_id = p_invoice_id and item.item_type = 'service'
  ) requested on requested.service_id = service.id
  order by service.id
  for update of service;

  update public.invoices invoice set
    client_name_snapshot = client.name,
    client_phone_snapshot = client.phone,
    client_email_snapshot = client.email,
    client_address_snapshot = client.address
  from public.clients client
  where invoice.id = p_invoice_id and client.id = invoice.client_id
    and client.shop_id = p_shop_id and client.is_active;
  if not found then raise exception 'CUSTOMER_NOT_FOUND'; end if;

  perform shop_private.lock_trade_customer(p_shop_id,p_invoice_id);
  -- Re-price every line from the locked active catalog. Draft values are only
  -- a preview and cannot become authoritative through browser input.
  for v_line in
    select * from public.invoice_items
    where invoice_id = p_invoice_id order by line_order, id
  loop
    if v_line.item_type = 'product'::public.invoice_item_type then
      select * into v_product from public.products
      where id = v_line.product_id and shop_id = p_shop_id and is_active;
      if not found then raise exception 'PRODUCT_NOT_FOUND'; end if;
      v_discount := 0;
      v_measurement:=shop_private.reprice_measured_invoice_line(v_line.id);
      v_total:=coalesce((v_measurement->>'lineTotal')::numeric,round(v_product.sale_price*v_line.quantity,2));
      update public.invoice_items set
        item_name = v_product.name, unit_price = coalesce((v_measurement->>'baseUnitPrice')::numeric,v_product.sale_price), measurement_snapshot=nullif(v_measurement->'measurement','null'::jsonb), trade_pricing_snapshot=nullif(v_measurement->'pricing','null'::jsonb),
        discount_amount = 0, total_amount = v_total,
        product_sku_snapshot = v_product.sku,
        product_barcode_snapshot = v_product.barcode,
        discount_type_snapshot = null, discount_value_snapshot = 0
      where id = v_line.id;
    elsif v_line.item_type = 'service'::public.invoice_item_type then
      select * into v_service from public.services
      where id = v_line.service_id and shop_id = p_shop_id and is_active;
      if not found then raise exception 'SERVICE_NOT_FOUND'; end if;
      v_unit_discount := case v_service.default_discount_type
        when 'percent' then round(v_service.base_sale_price * v_service.default_discount_value / 100, 2)
        else v_service.default_discount_value end;
      v_discount := round(v_unit_discount * v_line.quantity, 2);
      v_total := round(v_service.base_sale_price * v_line.quantity - v_discount, 2);
      update public.invoice_items set
        item_name = v_service.name, unit_price = v_service.base_sale_price,
        discount_amount = v_discount, total_amount = v_total,
        discount_type_snapshot = v_service.default_discount_type,
        discount_value_snapshot = v_service.default_discount_value
      where id = v_line.id;
    else
      raise exception 'UNSUPPORTED_SALE_LINE_TYPE' using errcode = '22023';
    end if;
  end loop;

  perform shop_private.remove_stacked_trade_offers(p_shop_id,p_invoice_id);
  -- Aggregate before mutation so duplicate product lines cannot evade the
  -- available-stock check.
  if exists (
    select requested.product_id
    from (
      select product_id, sum(quantity) as quantity
      from public.invoice_items
      where invoice_id = p_invoice_id and item_type = 'product'
      group by product_id
    ) requested
    left join public.inventory_batches batch
      on batch.shop_id = p_shop_id and batch.product_id = requested.product_id
    group by requested.product_id, requested.quantity
    having coalesce(sum(batch.remaining_quantity), 0) < requested.quantity
  ) then
    raise exception 'INSUFFICIENT_STOCK' using errcode = '23514';
  end if;

  perform shop_private.assert_period_is_open(p_shop_id, v_issued_at);
  insert into public.sale_number_counters (shop_id, next_number)
  values (p_shop_id, 2)
  on conflict (shop_id) do update set
    next_number = public.sale_number_counters.next_number + 1,
    updated_at = now()
  returning next_number - 1 into v_number;

  perform shop_private.stage_invoice_reel_plans(p_shop_id,p_invoice_id);
  update public.invoices invoice set
    invoice_number = 'SALE-' || lpad(v_number::text, 6, '0'),
    total_amount = totals.total_amount,
    discount_amount = totals.discount_amount,
    status = 'issued',
    issued_at = v_issued_at,
    issued_by_profile_id = v_profile_id,
    updated_at = v_issued_at
  from (
    select sum(total_amount) as total_amount, sum(discount_amount) as discount_amount
    from public.invoice_items where invoice_id = p_invoice_id
  ) totals where invoice.id = p_invoice_id;

  for v_line in select id from public.invoice_items where invoice_id=p_invoice_id and shop_id=p_shop_id and item_type='product' order by product_id,line_order,id loop
    perform shop_private.consume_product_sale_line(p_shop_id,p_invoice_id,v_line.id,v_profile_id);
  end loop;

  update public.sale_requests set invoice_id = p_invoice_id, completed_at = now()
  where shop_id = p_shop_id and operation = 'issue' and request_id = p_request_id;
  return p_invoice_id;
end;
$$;


do $$begin if (select md5(prosrc) from pg_catalog.pg_proc where oid='shop_private.checkout_customerless_sale(uuid,uuid,uuid,numeric,timestamp with time zone,public.payment_method,text)'::regprocedure) is distinct from '853bdbe89943afc6e9ba899d569510b1' then raise exception 'TRADE_ROUTINE_REVIEW_REQUIRED: shop_private.checkout_customerless_sale' using errcode='55000';end if;end;$$;
CREATE OR REPLACE FUNCTION shop_private.checkout_customerless_sale(p_request_id uuid, p_shop_id uuid, p_invoice_id uuid, p_amount numeric, p_paid_at timestamp with time zone, p_method public.payment_method, p_reference text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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
  v_measurement jsonb;
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
      v_measurement:=shop_private.reprice_measured_invoice_line(v_line.id);
      v_total:=coalesce((v_measurement->>'lineTotal')::numeric,round(v_product.sale_price*v_line.quantity,2));
      update public.invoice_items set item_name = v_product.name,
        unit_price = coalesce((v_measurement->>'baseUnitPrice')::numeric,v_product.sale_price), measurement_snapshot=nullif(v_measurement->'measurement','null'::jsonb), trade_pricing_snapshot=nullif(v_measurement->'pricing','null'::jsonb), discount_amount = 0, total_amount = v_total,
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

  perform shop_private.remove_stacked_trade_offers(p_shop_id,p_invoice_id);
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
  perform shop_private.stage_invoice_reel_plans(p_shop_id,p_invoice_id);
  update public.invoices set invoice_number = 'SALE-' || lpad(v_number::text, 6, '0'),
    total_amount = v_total, discount_amount = v_discount, status = 'issued',
    issued_at = p_paid_at, issued_by_profile_id = v_profile_id, due_date = null,
    updated_at = p_paid_at where id = p_invoice_id;
  select total_amount into v_total from public.invoices where id=p_invoice_id;
  if p_amount<>v_total then raise exception 'TAX_QUOTE_CHANGED' using errcode='23514'; end if;

  for v_line in select id from public.invoice_items where invoice_id=p_invoice_id and shop_id=p_shop_id and item_type='product' order by product_id,line_order,id loop
    perform shop_private.consume_product_sale_line(p_shop_id,p_invoice_id,v_line.id,v_profile_id);
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


do $$begin if (select md5(prosrc) from pg_catalog.pg_proc where oid='shop_private.save_pos_sale_draft(uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,jsonb)'::regprocedure) is distinct from '6bd13988f9cef1857087c8bdde9e8dd3' then raise exception 'TRADE_ROUTINE_REVIEW_REQUIRED: shop_private.save_pos_sale_draft' using errcode='55000';end if;end;$$;
CREATE OR REPLACE FUNCTION shop_private.save_pos_sale_draft(
  p_request_id uuid, p_shop_id uuid, p_location_id uuid, p_invoice_id uuid,
  p_staff_membership_id uuid, p_appointment_id uuid, p_customer_id uuid,
  p_notes text, p_lines jsonb
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_actor uuid; v_hash text; v_request public.pos_sale_requests%rowtype;
  v_invoice uuid; v_staff_name text; v_customer_name text; matched jsonb;
begin
  v_actor := shop_private.assert_shop_write_access(p_shop_id, 'sales.manage');
  perform shop_private.assert_location_access(p_shop_id, p_location_id, true);
  if p_request_id is null or p_staff_membership_id is null then raise exception 'INVALID_POS_CONTEXT'; end if;
  select coalesce(profile.display_name, profile.email_snapshot) into v_staff_name
  from public.shop_memberships member join public.profiles profile on profile.id = member.profile_id
  where member.id = p_staff_membership_id and member.shop_id = p_shop_id
    and member.status = 'active' and member.removed_at is null and profile.status = 'active'
    and (member.role = 'owner' or exists (select 1 from public.membership_location_assignments assignment
      where assignment.membership_id = member.id and assignment.location_id = p_location_id));
  if v_staff_name is null then raise exception 'INVALID_POS_STAFF' using errcode = '23514'; end if;
  if p_customer_id is not null then select name into v_customer_name from public.clients
    where id = p_customer_id and shop_id = p_shop_id and is_active; end if;
  if p_customer_id is not null and v_customer_name is null then raise exception 'CUSTOMER_NOT_FOUND'; end if;
  if p_appointment_id is not null and not shop_private.has_permission(p_shop_id, 'appointments.manage') then
    raise exception 'SHOP_PERMISSION_DENIED' using errcode = '42501';
  end if;
  if p_appointment_id is not null and not exists (select 1 from public.appointments appointment
    where appointment.id = p_appointment_id and appointment.shop_id = p_shop_id
      and appointment.location_id = p_location_id and appointment.assigned_membership_id = p_staff_membership_id
      and appointment.client_id is not distinct from p_customer_id
      and (appointment.sale_id is null or appointment.sale_id = p_invoice_id)
      and appointment.status in ('booked','arrived','waiting','in_service','completed')) then
    raise exception 'INVALID_POS_APPOINTMENT' using errcode = '23514';
  end if;
  v_hash := md5(jsonb_build_object('location', p_location_id, 'invoice', p_invoice_id,
    'staff', p_staff_membership_id, 'appointment', p_appointment_id, 'customer', p_customer_id,
    'notes', nullif(btrim(p_notes), ''), 'lines', p_lines)::text);
  insert into public.pos_sale_requests(request_id, shop_id, operation, payload_hash, actor_profile_id)
    values (p_request_id, p_shop_id, 'save', v_hash, v_actor) on conflict do nothing;
  select * into v_request from public.pos_sale_requests where request_id = p_request_id for update;
  if v_request.shop_id <> p_shop_id or v_request.operation <> 'save' or v_request.payload_hash <> v_hash
    or v_request.actor_profile_id <> v_actor then raise exception 'POS_REQUEST_CONFLICT' using errcode = '23505'; end if;
  if v_request.completed_at is not null then return v_request.invoice_id; end if;
  perform set_config('shop.location_id', p_location_id::text, true);
  v_invoice := shop_private.save_location_sale_draft(p_request_id, p_shop_id, p_location_id,
    p_invoice_id, p_customer_id, null, p_notes, p_lines);
  insert into public.pos_sale_contexts(invoice_id, shop_id, location_id, staff_membership_id,
    appointment_id, customer_name_snapshot, staff_name_snapshot)
  values (v_invoice, p_shop_id, p_location_id, p_staff_membership_id, p_appointment_id,
    v_customer_name, v_staff_name)
  on conflict (invoice_id) do update set staff_membership_id = excluded.staff_membership_id,
    appointment_id = excluded.appointment_id, customer_name_snapshot = excluded.customer_name_snapshot,
    staff_name_snapshot = excluded.staff_name_snapshot, updated_at = clock_timestamp();
  matched:=shop_private.match_catalog_offers(p_shop_id,p_lines);
  update public.invoices set tax_order_discount=(matched->>'discount')::numeric,offer_snapshot=matched->'offers' where id=v_invoice and shop_id=p_shop_id and status='draft';
  perform shop_private.remove_stacked_trade_offers(p_shop_id,v_invoice);
  update public.pos_sale_requests set invoice_id = v_invoice, completed_at = clock_timestamp()
    where request_id = p_request_id;
  return v_invoice;
end;
$$;

create function shop_private.trade_cart_quantity(p_shop uuid,p_product uuid,p_lines jsonb) returns numeric
language plpgsql stable set search_path='' as $$declare item jsonb;total numeric:=0;begin
 for item in select value from jsonb_array_elements(p_lines) loop
  if item->>'item_type'='product' and item->>'source_id'=p_product::text then total:=total+(shop_private.resolve_measured_line(p_shop,p_product,item)->>'baseQuantity')::numeric;end if;
 end loop;
 return total;
end;$$;
revoke all on function shop_private.trade_cart_quantity(uuid,uuid,jsonb) from public,anon,authenticated,service_role;

create function public.quote_customer_sale(p_shop_id uuid,p_location_id uuid,p_customer_id uuid,p_lines jsonb,p_bundles boolean default true,p_invoice_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare policy jsonb;lines jsonb:='[]';item jsonb;price numeric;discount numeric;qty numeric;r jsonb;base jsonb;matched jsonb;trade boolean:=false;prior jsonb;line_index integer:=0;begin
 perform shop_private.assert_sale_read_access(p_shop_id);perform shop_private.assert_location_access(p_shop_id,p_location_id,false);
 if p_bundles is null or jsonb_typeof(p_lines) is distinct from 'array' or jsonb_array_length(p_lines) not between 1 and 100 then raise exception 'INVALID_TAX_INPUT' using errcode='22023';end if;
 if p_customer_id is not null then
  if not exists(select 1 from public.clients where id=p_customer_id and shop_id=p_shop_id and is_active) then raise exception 'CUSTOMER_NOT_FOUND' using errcode='P0002';end if;
 end if;
 if p_invoice_id is not null and not exists(select 1 from public.invoices where id=p_invoice_id and shop_id=p_shop_id and location_id=p_location_id and status='draft' and client_id is not distinct from p_customer_id) then raise exception 'SALE_DRAFT_NOT_FOUND' using errcode='P0002';end if;
 select p.policy into policy from public.tax_policy_versions p where shop_id=p_shop_id and effective_at<=statement_timestamp() order by effective_at desc,created_at desc,id desc limit 1;
 for item in select value from jsonb_array_elements(p_lines) loop
  line_index:=line_index+1;prior:=null;
  if p_invoice_id is not null then select to_jsonb(i) into prior from public.invoice_items i where i.invoice_id=p_invoice_id and i.shop_id=p_shop_id and i.line_order=line_index;end if;
  qty:=(item->>'quantity')::numeric;r:=null;
  if item->>'item_type'='product' then
   r:=shop_private.resolve_measured_line(p_shop_id,(item->>'source_id')::uuid,item);
   r:=shop_private.apply_trade_line_price(p_shop_id,(item->>'source_id')::uuid,p_customer_id,item,r,shop_private.trade_cart_quantity(p_shop_id,(item->>'source_id')::uuid,p_lines),prior,p_customer_id);
   trade:=trade or coalesce(r->'pricing','null'::jsonb)<>'null'::jsonb;
   qty:=(r->>'baseQuantity')::numeric;price:=(r->>'baseUnitPrice')::numeric;discount:=0;
   if shop_private.is_reel_tracked(p_shop_id,(item->>'source_id')::uuid) then perform shop_private.plan_reel_sale(p_shop_id,(item->>'source_id')::uuid,p_location_id,qty,r->'measurement');end if;
  elsif item->>'item_type'='service' then
   select base_sale_price,round((case default_discount_type when 'percent' then round(base_sale_price*default_discount_value/100,2) else default_discount_value end)*qty,2)
   into price,discount from public.services where id=(item->>'source_id')::uuid and shop_id=p_shop_id and is_active;
  else raise exception 'UNSUPPORTED_SALE_LINE_TYPE' using errcode='22023';end if;
  if price is null or qty is null or qty<=0 or qty>1000000 then raise exception 'TAX_ITEM_NOT_FOUND' using errcode='P0002';end if;
  lines:=lines||jsonb_build_array(jsonb_build_object('itemType',item->>'item_type','sourceId',item->>'source_id','quantity',qty,'unitPrice',price,'lineDiscount',discount,'measurement',r->'measurement','pricing',r->'pricing'));
 end loop;
 -- A cart uses either agreed trade/override prices or bundle discounts. Mixing
 -- both would apply an unrelated base-catalog discount to negotiated prices.
 if p_bundles and not trade then matched:=shop_private.match_catalog_offers(p_shop_id,p_lines);else matched:='{"discount":0,"offers":[]}'::jsonb;end if;
 base:=shop_private.calculate_tax(lines,policy,(matched->>'discount')::numeric);
 return base||matched||jsonb_build_object('tradePricingApplied',trade,'tradePricingEnabled',exists(select 1 from public.trade_price_rules where shop_id=p_shop_id and active and starts_at<=statement_timestamp() and (ends_at is null or ends_at>statement_timestamp())));
end;$$;
revoke all on function public.quote_customer_sale(uuid,uuid,uuid,jsonb,boolean,uuid) from public,anon,authenticated,service_role;
grant execute on function public.quote_customer_sale(uuid,uuid,uuid,jsonb,boolean,uuid) to authenticated;

create or replace function public.quote_sale_tax(p_shop_id uuid,p_location_id uuid,p_lines jsonb) returns jsonb
language sql stable security definer set search_path='' as $$select public.quote_customer_sale(p_shop_id,p_location_id,null,p_lines,false);$$;
create or replace function public.quote_pos_sale(p_shop_id uuid,p_location_id uuid,p_lines jsonb) returns jsonb
language sql stable security definer set search_path='' as $$select public.quote_customer_sale(p_shop_id,p_location_id,null,p_lines,true);$$;

create function shop_private.capture_trade_receipt_prices() returns trigger
language plpgsql security definer set search_path='' as $$begin
 new.snapshot:=jsonb_set(new.snapshot,'{lines}',coalesce((select jsonb_agg(line.value||jsonb_build_object('pricing',item.trade_pricing_snapshot) order by line.n)
 from jsonb_array_elements(new.snapshot->'lines') with ordinality line(value,n)
 join public.invoice_items item on item.id=(line.value->>'id')::uuid and item.invoice_id=new.invoice_id and item.shop_id=new.shop_id),'[]'::jsonb));
 return new;
end;$$;
revoke all on function shop_private.capture_trade_receipt_prices() from public,anon,authenticated,service_role;
create trigger capture_trade_receipt_prices before insert on public.sale_receipt_issue_snapshots for each row execute function shop_private.capture_trade_receipt_prices();
create trigger capture_trade_receipt_prices before insert on public.sale_receipts for each row execute function shop_private.capture_trade_receipt_prices();
commit;
