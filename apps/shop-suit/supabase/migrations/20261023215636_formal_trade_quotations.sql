begin;
-- Formal offers are distinct from sale drafts. They never post inventory,
-- receivables or payments. Every saved price version and transition is retained.
create table public.trade_quotations (
 id uuid primary key default gen_random_uuid(), shop_id uuid not null references public.shops(id),
 location_id uuid not null, customer_id uuid not null, quotation_number text not null,
 status text not null default 'draft' check(status in('draft','issued','accepted','rejected','expired','cancelled')),
 revision integer not null default 1 check(revision>0), version integer not null default 1 check(version>0),
 valid_until timestamptz not null, project_reference text, notes text,
 currency text not null check(currency ~ '^[A-Z]{3}$'), total_amount numeric(18,2) not null check(total_amount>=0),
 created_by_profile_id uuid not null references public.profiles(id), created_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp(),
 foreign key(location_id,shop_id) references public.shop_locations(id,shop_id),
 foreign key(customer_id,shop_id) references public.clients(id,shop_id),
 unique(id,shop_id), unique(shop_id,quotation_number),
 check(length(coalesce(project_reference,''))<=200 and length(coalesce(notes,''))<=2000)
);
create table public.trade_quotation_versions (
 quotation_id uuid not null, shop_id uuid not null, version integer not null check(version>0),
 snapshot jsonb not null check(jsonb_typeof(snapshot)='object'), reason text not null check(length(btrim(reason)) between 3 and 1000),
 actor_profile_id uuid not null references public.profiles(id), created_at timestamptz not null default clock_timestamp(),
 primary key(quotation_id,version), foreign key(quotation_id,shop_id) references public.trade_quotations(id,shop_id)
);
alter table public.trade_quotations add foreign key(id,version) references public.trade_quotation_versions(quotation_id,version) deferrable initially deferred;
create table public.trade_quotation_events (
 id uuid primary key default gen_random_uuid(), shop_id uuid not null, quotation_id uuid not null, revision integer not null,
 version integer not null, action text not null, previous_status text, status text not null,
 reason text not null check(length(btrim(reason)) between 3 and 1000), actor_profile_id uuid not null references public.profiles(id),
 created_at timestamptz not null default clock_timestamp(), unique(quotation_id,revision),
 foreign key(quotation_id,shop_id) references public.trade_quotations(id,shop_id),
 foreign key(quotation_id,version) references public.trade_quotation_versions(quotation_id,version)
);
create index trade_quotations_directory on public.trade_quotations(shop_id,location_id,created_at desc,id);
create table shop_private.trade_quotation_requests (
 shop_id uuid not null,request_id uuid not null,actor_profile_id uuid not null references public.profiles(id),
 payload jsonb not null,result jsonb,primary key(shop_id,request_id)
);
create table shop_private.trade_quotation_counters (shop_id uuid primary key references public.shops(id),next_number bigint not null check(next_number>0));
alter table shop_private.trade_quotation_requests enable row level security;
alter table shop_private.trade_quotation_counters enable row level security;
revoke all on shop_private.trade_quotation_requests,shop_private.trade_quotation_counters from public,anon,authenticated,service_role;
do $$declare t text;begin
 foreach t in array array['trade_quotations','trade_quotation_versions','trade_quotation_events'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
  execute format('grant select on public.%I to authenticated,service_role',t);
  execute format('create policy quotation_service_read on public.%I for select to service_role using(true)',t);
 end loop;
end;$$;
-- All client reads use the location-authorized paged RPC. No unbounded table API.
create trigger trade_quotation_versions_immutable before update or delete on public.trade_quotation_versions for each row execute function shop_private.measurement_history_immutable();
create trigger trade_quotation_events_immutable before update or delete on public.trade_quotation_events for each row execute function shop_private.measurement_history_immutable();

create function shop_private.prepare_trade_quotation(p_shop uuid,p_customer uuid,p_lines jsonb,p_discount numeric,p_previous jsonb default null) returns jsonb
language plpgsql stable set search_path='' as $$
declare input jsonb;resolved jsonb;prior jsonb;prior_row jsonb;line_index integer:=0;lines jsonb:='[]';price numeric;discount numeric;qty numeric;name text;policy jsonb;mode public.business_mode;begin
 if jsonb_typeof(p_lines) is distinct from 'array' or jsonb_array_length(p_lines) not between 1 and 100 then raise exception 'INVALID_QUOTATION_LINES' using errcode='22023';end if;
 select business_mode into mode from public.shops where id=p_shop;
 select p.policy into policy from public.tax_policy_versions p where shop_id=p_shop and effective_at<=statement_timestamp() order by effective_at desc,created_at desc,id desc limit 1;
 for input in select value from jsonb_array_elements(p_lines) loop
  prior:=p_previous->'lines'->line_index;line_index:=line_index+1;
  prior_row:=jsonb_build_object('product_id',prior->>'sourceId','quantity',prior->>'quantity','unit_price',prior->>'unitPrice','measurement_snapshot',prior->'measurement','trade_pricing_snapshot',prior->'pricing');
  qty:=(input->>'quantity')::numeric;resolved:=null;name:=null;discount:=0;
  if input->>'item_type'='product' then
   if mode not in('product','mixed') then raise exception 'BUSINESS_MODE_PRODUCT_DISABLED' using errcode='23514';end if;
   resolved:=shop_private.resolve_measured_line(p_shop,(input->>'source_id')::uuid,input);
   resolved:=shop_private.apply_trade_line_price(p_shop,(input->>'source_id')::uuid,p_customer,input,resolved,shop_private.trade_cart_quantity(p_shop,(input->>'source_id')::uuid,p_lines),prior_row,nullif(p_previous->>'customerId','')::uuid);
   qty:=(resolved->>'baseQuantity')::numeric;price:=(resolved->>'baseUnitPrice')::numeric;
   select p.name into name from public.products p where p.id=(input->>'source_id')::uuid and p.shop_id=p_shop and p.is_active;
  elsif input->>'item_type'='service' then
   if mode not in('service','mixed') then raise exception 'BUSINESS_MODE_SERVICE_DISABLED' using errcode='23514';end if;
   if input ? 'override_price' or input ? 'override_reason' then raise exception 'UNSUPPORTED_SERVICE_PRICE_OVERRIDE' using errcode='22023';end if;
   select s.name,s.base_sale_price,round((case s.default_discount_type when 'percent' then round(s.base_sale_price*s.default_discount_value/100,2) else s.default_discount_value end)*qty,2)
    into name,price,discount from public.services s where s.id=(input->>'source_id')::uuid and s.shop_id=p_shop and s.is_active;
   if qty is null or qty<=0 or qty>1000000 or round(qty,3)<>qty then raise exception 'INVALID_QUOTATION_QUANTITY' using errcode='22023';end if;
  else raise exception 'UNSUPPORTED_SALE_LINE_TYPE' using errcode='22023';end if;
  if name is null then raise exception 'QUOTATION_ITEM_NOT_FOUND' using errcode='P0002';end if;
  -- Exact decimal strings survive editor/print transport. Tax arithmetic casts
  -- them on the server; browser numbers never define commercial amounts.
  lines:=lines||jsonb_build_array(jsonb_build_object('itemType',input->>'item_type','sourceId',input->>'source_id','name',name,
   'quantity',trim_scale(qty)::text,'unitPrice',trim_scale(price)::text,'lineDiscount',trim_scale(discount)::text,
   'measurement',resolved->'measurement','pricing',resolved->'pricing','input',input));
 end loop;
 return shop_private.calculate_tax(lines,policy,p_discount)||jsonb_build_object('taxPolicy',policy);
end;$$;
revoke all on function shop_private.prepare_trade_quotation(uuid,uuid,jsonb,numeric,jsonb) from public,anon,authenticated,service_role;

create function public.trade_quotation_command(p_request_id uuid,p_shop_id uuid,p_location_id uuid,p_action text,p_quotation_id uuid,p_revision integer,p_payload jsonb,p_reason text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid;request shop_private.trade_quotation_requests%rowtype;q public.trade_quotations%rowtype;
 payload jsonb;v_result jsonb;snapshot jsonb;previous_snapshot jsonb;customer uuid;customer_name text;v_valid_until timestamptz;v_currency text;
 old_status text;number bigint;discount numeric;begin
 actor:=shop_private.assert_shop_write_access(p_shop_id,case when p_action in('issue','accept') then 'sales.issue' else 'sales.manage' end);
 perform shop_private.assert_location_access(p_shop_id,p_location_id,true);
 if p_action is null or p_action not in('save','revise','issue','accept','reject','expire','cancel') or p_request_id is null
 or p_revision is null or p_revision<0 or p_payload is null or jsonb_typeof(p_payload)<>'object'
 or p_reason is null or length(btrim(p_reason)) not between 3 and 1000 then raise exception 'INVALID_QUOTATION_COMMAND' using errcode='22023';end if;
 payload:=jsonb_build_object('location',p_location_id,'action',p_action,'quotation',p_quotation_id,'revision',p_revision,'values',p_payload,'reason',btrim(p_reason));
 insert into shop_private.trade_quotation_requests(shop_id,request_id,actor_profile_id,payload) values(p_shop_id,p_request_id,actor,payload) on conflict do nothing;
 select * into request from shop_private.trade_quotation_requests where shop_id=p_shop_id and request_id=p_request_id for update;
 if request.actor_profile_id<>actor or request.payload<>payload then raise exception 'QUOTATION_REQUEST_CONFLICT' using errcode='23505';end if;
 if request.result is not null then return request.result;end if;
 -- Match existing sale lock order: shop, invoice/document, sorted products,
 -- customer/group. Currency/config changes cannot race a commercial snapshot.
 select business_currency into v_currency from public.shops where id=p_shop_id for update;
 if p_quotation_id is not null then
  select * into q from public.trade_quotations where id=p_quotation_id and shop_id=p_shop_id and location_id=p_location_id for update;
  if not found then raise exception 'QUOTATION_NOT_FOUND' using errcode='P0002';end if;
 end if;
 if p_revision<>coalesce(q.revision,0) then raise exception 'QUOTATION_CONTEXT_CHANGED' using errcode='55000';end if;
 old_status:=q.status;
 if p_action in('save','revise') then
  if (p_action='save' and q.id is not null and q.status<>'draft') or (p_action='revise' and (q.id is null or q.status not in('issued','rejected','expired'))) then raise exception 'QUOTATION_TRANSITION_DENIED' using errcode='55000';end if;
  if q.status='issued' and q.valid_until<=clock_timestamp() then old_status:='expired';end if;
  customer:=(p_payload->>'customerId')::uuid;v_valid_until:=(p_payload->>'validUntil')::timestamptz;
  if customer is null or v_valid_until is null or v_valid_until<=clock_timestamp() or v_valid_until>clock_timestamp()+interval '366 days'
   or length(coalesce(p_payload->>'projectReference',''))>200 or length(coalesce(p_payload->>'notes',''))>2000
   or coalesce(p_payload->>'orderDiscount','0') !~ '^[0-9]{1,12}(\.[0-9]{1,2})?$' then raise exception 'INVALID_QUOTATION_DETAILS' using errcode='22023';end if;
  -- Lock all referenced products in the same deterministic order as issuance.
  perform 1 from public.products where shop_id=p_shop_id and id in(select (value->>'source_id')::uuid from jsonb_array_elements(p_payload->'lines') where value->>'item_type'='product') order by id for share;
  select name into customer_name from public.clients where id=customer and shop_id=p_shop_id and is_active for share;
  if not found then raise exception 'CUSTOMER_NOT_FOUND' using errcode='P0002';end if;
  perform 1 from public.customer_groups g join public.customer_group_assignments a on a.group_id=g.id and a.shop_id=g.shop_id where a.customer_id=customer and a.shop_id=p_shop_id for share of g;
  if q.id is not null then select v.snapshot into previous_snapshot from public.trade_quotation_versions v where v.quotation_id=q.id and v.shop_id=p_shop_id and v.version=q.version;end if;
  discount:=coalesce(p_payload->>'orderDiscount','0')::numeric;
  snapshot:=shop_private.prepare_trade_quotation(p_shop_id,customer,p_payload->'lines',discount,previous_snapshot)||jsonb_build_object('currency',v_currency,'customerId',customer,'customerName',customer_name,
   'validUntil',v_valid_until,'projectReference',nullif(btrim(p_payload->>'projectReference'),''),'notes',nullif(btrim(p_payload->>'notes'),''));
  if q.id is null then
   insert into shop_private.trade_quotation_counters(shop_id,next_number) values(p_shop_id,2) on conflict(shop_id) do update set next_number=trade_quotation_counters.next_number+1 returning next_number-1 into number;
   insert into public.trade_quotations(shop_id,location_id,customer_id,quotation_number,valid_until,project_reference,notes,currency,total_amount,created_by_profile_id)
   values(p_shop_id,p_location_id,customer,'Q-'||lpad(number::text,8,'0'),v_valid_until,snapshot->>'projectReference',snapshot->>'notes',v_currency,(snapshot->>'total')::numeric,actor) returning * into q;
  else
   update public.trade_quotations set customer_id=customer,status='draft',revision=revision+1,version=version+1,valid_until=v_valid_until,
    project_reference=snapshot->>'projectReference',notes=snapshot->>'notes',currency=v_currency,total_amount=(snapshot->>'total')::numeric,updated_at=clock_timestamp()
   where id=q.id returning * into q;
  end if;
  snapshot:=snapshot||jsonb_build_object('quotationNumber',q.quotation_number,'version',q.version);
  insert into public.trade_quotation_versions(quotation_id,shop_id,version,snapshot,reason,actor_profile_id) values(q.id,p_shop_id,q.version,snapshot,btrim(p_reason),actor);
 else
  if q.id is null then raise exception 'QUOTATION_NOT_FOUND' using errcode='P0002';end if;
  if p_action='issue' then
   if q.status<>'draft' or q.valid_until<=clock_timestamp() then raise exception 'QUOTATION_TRANSITION_DENIED' using errcode='55000';end if;
   if q.currency<>v_currency then raise exception 'QUOTATION_CURRENCY_CHANGED' using errcode='55000';end if;
   q.status:='issued';
  elsif p_action in('accept','reject') then
   if q.status<>'issued' or q.valid_until<=clock_timestamp() then raise exception 'QUOTATION_EXPIRED_OR_CHANGED' using errcode='55000';end if;
   if q.currency<>v_currency then raise exception 'QUOTATION_CURRENCY_CHANGED' using errcode='55000';end if;
   q.status:=case when p_action='accept' then 'accepted' else 'rejected' end;
  elsif p_action='expire' then
   if q.status<>'issued' or q.valid_until>clock_timestamp() then raise exception 'QUOTATION_TRANSITION_DENIED' using errcode='55000';end if;
   q.status:='expired';
  else
   if q.status not in('draft','issued','accepted') then raise exception 'QUOTATION_TRANSITION_DENIED' using errcode='55000';end if;
   q.status:='cancelled';
  end if;
  update public.trade_quotations set status=q.status,revision=revision+1,updated_at=clock_timestamp() where id=q.id returning * into q;
 end if;
 insert into public.trade_quotation_events(shop_id,quotation_id,revision,version,action,previous_status,status,reason,actor_profile_id)
 values(p_shop_id,q.id,q.revision,q.version,p_action,old_status,q.status,btrim(p_reason),actor);
 v_result:=jsonb_build_object('id',q.id,'revision',q.revision,'version',q.version,'status',q.status);
 update shop_private.trade_quotation_requests set result=v_result where shop_id=p_shop_id and request_id=p_request_id;
 return v_result;
end;$$;
revoke all on function public.trade_quotation_command(uuid,uuid,uuid,text,uuid,integer,jsonb,text) from public,anon,authenticated,service_role;
grant execute on function public.trade_quotation_command(uuid,uuid,uuid,text,uuid,integer,jsonb,text) to authenticated;

create function public.trade_quotation_context(p_shop_id uuid,p_location_id uuid,p_quotation_id uuid default null,p_search text default null,p_page integer default 1,p_history_page integer default 1) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare q public.trade_quotations%rowtype;items jsonb;total bigint;detail jsonb;versions jsonb;events jsonb;term text:=nullif(btrim(p_search),'');begin
 perform shop_private.assert_sale_read_access(p_shop_id);perform shop_private.assert_location_access(p_shop_id,p_location_id,false);
 if p_page is null or p_page<1 or p_history_page is null or p_history_page<1 or length(coalesce(term,''))>120 then raise exception 'INVALID_QUOTATION_QUERY' using errcode='22023';end if;
 if p_quotation_id is not null then
  select * into q from public.trade_quotations where id=p_quotation_id and shop_id=p_shop_id and location_id=p_location_id;
  if not found then raise exception 'QUOTATION_NOT_FOUND' using errcode='P0002';end if;
  select snapshot into detail from public.trade_quotation_versions where quotation_id=q.id and shop_id=p_shop_id and version=q.version;
  select coalesce(jsonb_agg(to_jsonb(v)||jsonb_build_object('actor_name',(select display_name from public.profiles where id=v.actor_profile_id)) order by v.version desc),'[]') into versions from(select version,snapshot,reason,actor_profile_id,created_at from public.trade_quotation_versions where quotation_id=q.id and shop_id=p_shop_id order by version desc offset (p_history_page-1)*10 limit 10)v;
  select coalesce(jsonb_agg(to_jsonb(e)||jsonb_build_object('actor_name',(select display_name from public.profiles where id=e.actor_profile_id)) order by e.revision desc),'[]') into events from(select revision,version,action,previous_status,status,reason,actor_profile_id,created_at from public.trade_quotation_events where quotation_id=q.id and shop_id=p_shop_id order by revision desc offset (p_history_page-1)*10 limit 10)e;
  detail:=jsonb_build_object('record',to_jsonb(q)||jsonb_build_object('effective_status',case when q.status='issued' and q.valid_until<=statement_timestamp() then 'expired' else q.status end),'snapshot',detail,'versions',versions,'events',events,'versionCount',q.version,'eventCount',q.revision,'historyPage',p_history_page);
 end if;
 select count(*) into total from public.trade_quotations doc where doc.shop_id=p_shop_id and doc.location_id=p_location_id and (term is null or doc.quotation_number ilike '%'||term||'%' or doc.project_reference ilike '%'||term||'%');
 select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at desc,r.id),'[]') into items from(
  select doc.*,c.name customer_name,case when doc.status='issued' and doc.valid_until<=statement_timestamp() then 'expired' else doc.status end effective_status
  from public.trade_quotations doc join public.clients c on c.id=doc.customer_id and c.shop_id=doc.shop_id where doc.shop_id=p_shop_id and doc.location_id=p_location_id
   and (term is null or doc.quotation_number ilike '%'||term||'%' or doc.project_reference ilike '%'||term||'%') order by doc.created_at desc,doc.id offset (p_page-1)*20 limit 20)r;
 return jsonb_build_object('items',items,'total',total,'page',p_page,'pageSize',20,'detail',detail,
  'canManage',shop_private.has_permission(p_shop_id,'sales.manage'),'canIssue',shop_private.has_permission(p_shop_id,'sales.issue'));
end;$$;
revoke all on function public.trade_quotation_context(uuid,uuid,uuid,text,integer,integer) from public,anon,authenticated,service_role;
grant execute on function public.trade_quotation_context(uuid,uuid,uuid,text,integer,integer) to authenticated;
commit;
