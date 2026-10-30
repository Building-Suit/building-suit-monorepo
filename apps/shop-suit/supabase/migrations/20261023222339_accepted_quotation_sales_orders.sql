begin;

-- Preserve decimal money through JSON and browser formatting without changing
-- any stored agreement or tax history. PostgreSQL JSONB retains exact numerics.
create function shop_private.quotation_money_projection(p_snapshot jsonb) returns jsonb
language plpgsql immutable set search_path='' as $$
declare result jsonb:=p_snapshot;key text;lines jsonb;begin
 if p_snapshot is null then return null;end if;
 foreach key in array array['orderDiscount','discountNet','net','tax','total'] loop
  if p_snapshot ? key then result:=jsonb_set(result,array[key],to_jsonb(trim_scale((p_snapshot->>key)::numeric)::text));end if;
 end loop;
 select coalesce(jsonb_agg(value||jsonb_build_object('net',trim_scale((value->>'net')::numeric)::text,'tax',trim_scale((value->>'tax')::numeric)::text,'total',trim_scale((value->>'total')::numeric)::text) order by n),'[]') into lines
 from jsonb_array_elements(p_snapshot->'lines') with ordinality item(value,n);
 return result||jsonb_build_object('lines',lines);
end;$$;
revoke all on function shop_private.quotation_money_projection(jsonb) from public,anon,authenticated,service_role;
create table public.trade_orders (
 id uuid primary key default gen_random_uuid(),shop_id uuid not null references public.shops(id),location_id uuid not null,customer_id uuid not null,
 quotation_id uuid not null unique,quotation_version integer not null,order_number text not null,
 status text not null default 'open' check(status in('open','partially_fulfilled','fulfilled','cancelled')),
 revision integer not null default 1 check(revision>0),currency text not null,agreed_snapshot jsonb not null,
 total_amount numeric(18,2) not null check(total_amount>=0),created_by_profile_id uuid not null references public.profiles(id),
 created_at timestamptz not null default clock_timestamp(),updated_at timestamptz not null default clock_timestamp(),
 unique(id,shop_id),unique(shop_id,order_number),
 foreign key(location_id,shop_id) references public.shop_locations(id,shop_id),foreign key(customer_id,shop_id) references public.clients(id,shop_id),
 foreign key(quotation_id,shop_id) references public.trade_quotations(id,shop_id),foreign key(quotation_id,quotation_version) references public.trade_quotation_versions(quotation_id,version)
);
create table public.trade_order_lines (
 id uuid primary key default gen_random_uuid(),shop_id uuid not null,order_id uuid not null,line_order integer not null check(line_order between 1 and 100),
 item_type public.invoice_item_type not null,product_id uuid,service_id uuid,item_name text not null,
 quantity numeric(18,6) not null check(quantity>0),unit_price numeric(24,12) not null check(unit_price>=0),
 discount_amount numeric(18,5) not null check(discount_amount>=0),measurement_snapshot jsonb,pricing_snapshot jsonb,tax_snapshot jsonb not null,
 unique(id,shop_id),unique(order_id,line_order),foreign key(order_id,shop_id) references public.trade_orders(id,shop_id),
 foreign key(product_id,shop_id) references public.products(id,shop_id),foreign key(service_id,shop_id) references public.services(id,shop_id),
 check((item_type='product' and product_id is not null and service_id is null) or (item_type='service' and product_id is null and service_id is not null))
);
create table public.trade_order_events (
 id uuid primary key default gen_random_uuid(),shop_id uuid not null,order_id uuid not null,revision integer not null,
 action text not null,previous_status text,status text not null,reason text not null check(length(btrim(reason)) between 3 and 1000),
 actor_profile_id uuid not null references public.profiles(id),created_at timestamptz not null default clock_timestamp(),
 unique(order_id,revision),foreign key(order_id,shop_id) references public.trade_orders(id,shop_id)
);
create table shop_private.trade_order_requests (shop_id uuid not null,request_id uuid not null,actor_profile_id uuid not null references public.profiles(id),payload jsonb not null,result jsonb,primary key(shop_id,request_id));
create table shop_private.trade_order_counters(shop_id uuid primary key references public.shops(id),next_number bigint not null check(next_number>0));
alter table shop_private.trade_order_requests enable row level security;
alter table shop_private.trade_order_counters enable row level security;
revoke all on shop_private.trade_order_requests,shop_private.trade_order_counters from public,anon,authenticated,service_role;
create index trade_orders_location_directory on public.trade_orders(shop_id,location_id,created_at desc,id);
do $$declare t text;begin
 foreach t in array array['trade_orders','trade_order_lines','trade_order_events'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
  execute format('grant select on public.%I to authenticated,service_role',t);
  execute format('create policy trade_order_service_read on public.%I for select to service_role using(true)',t);
 end loop;
end;$$;
create trigger trade_order_lines_immutable before update or delete on public.trade_order_lines for each row execute function shop_private.measurement_history_immutable();
create trigger trade_order_events_immutable before update or delete on public.trade_order_events for each row execute function shop_private.measurement_history_immutable();
create function shop_private.protect_trade_order_agreement() returns trigger language plpgsql set search_path='' as $$begin
 if tg_op='DELETE' or row(new.id,new.shop_id,new.location_id,new.customer_id,new.quotation_id,new.quotation_version,new.order_number,new.currency,new.agreed_snapshot,new.total_amount,new.created_by_profile_id,new.created_at)
  is distinct from row(old.id,old.shop_id,old.location_id,old.customer_id,old.quotation_id,old.quotation_version,old.order_number,old.currency,old.agreed_snapshot,old.total_amount,old.created_by_profile_id,old.created_at) then raise exception 'ORDER_AGREEMENT_IMMUTABLE' using errcode='55000';end if;
 return new;
end;$$;
revoke all on function shop_private.protect_trade_order_agreement() from public,anon,authenticated,service_role;
create trigger protect_trade_order_agreement before update or delete on public.trade_orders for each row execute function shop_private.protect_trade_order_agreement();
create function shop_private.protect_converted_quotation() returns trigger language plpgsql set search_path='' as $$begin
 if (new.status is distinct from old.status or new.version is distinct from old.version) and exists(select 1 from public.trade_orders where quotation_id=old.id and shop_id=old.shop_id) then raise exception 'QUOTATION_ALREADY_CONVERTED' using errcode='55000';end if;
 return new;
end;$$;
revoke all on function shop_private.protect_converted_quotation() from public,anon,authenticated,service_role;
create trigger protect_converted_quotation before update on public.trade_quotations for each row execute function shop_private.protect_converted_quotation();

create function public.create_trade_order(p_request_id uuid,p_shop_id uuid,p_location_id uuid,p_quotation_id uuid,p_revision integer,p_reason text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid;request shop_private.trade_order_requests%rowtype;payload jsonb;v_result jsonb;q public.trade_quotations%rowtype;
 o public.trade_orders%rowtype;snapshot jsonb;line jsonb;p public.products%rowtype;m jsonb;v_currency text;number bigint;position integer:=0;begin
 actor:=shop_private.assert_shop_write_access(p_shop_id,'sales.manage');perform shop_private.assert_location_access(p_shop_id,p_location_id,true);
 if p_request_id is null or p_quotation_id is null or p_revision is null or p_revision<1 or p_reason is null or length(btrim(p_reason)) not between 3 and 1000 then raise exception 'INVALID_ORDER_COMMAND' using errcode='22023';end if;
 payload:=jsonb_build_object('action','convert','location',p_location_id,'quotation',p_quotation_id,'revision',p_revision,'reason',btrim(p_reason));
 insert into shop_private.trade_order_requests(shop_id,request_id,actor_profile_id,payload) values(p_shop_id,p_request_id,actor,payload) on conflict do nothing;
 select * into request from shop_private.trade_order_requests where shop_id=p_shop_id and request_id=p_request_id for update;
 if request.actor_profile_id<>actor or request.payload<>payload then raise exception 'ORDER_REQUEST_CONFLICT' using errcode='23505';end if;
 if request.result is not null then return request.result;end if;
 select business_currency into v_currency from public.shops where id=p_shop_id for update;
 select * into q from public.trade_quotations where id=p_quotation_id and shop_id=p_shop_id and location_id=p_location_id for update;
 if not found then raise exception 'QUOTATION_NOT_FOUND' using errcode='P0002';end if;
 select * into o from public.trade_orders where quotation_id=q.id and shop_id=p_shop_id;
 if o.id is not null then
  -- Independent repeated conversion requests resolve to the same order too.
  v_result:=jsonb_build_object('id',o.id,'revision',o.revision,'status',o.status,'alreadyConverted',true);
 else
  if q.revision<>p_revision then raise exception 'QUOTATION_CONTEXT_CHANGED' using errcode='55000';end if;
  if q.status<>'accepted' then raise exception 'ORDER_REQUIRES_ACCEPTED_QUOTATION' using errcode='55000';end if;
  -- Acceptance within validity creates the agreement. Its offer deadline does
  -- not silently revoke that agreement later; cancellation remains explicit.
  if q.currency<>v_currency then raise exception 'QUOTATION_CURRENCY_CHANGED' using errcode='55000';end if;
  select v.snapshot into strict snapshot from public.trade_quotation_versions v where v.quotation_id=q.id and v.shop_id=p_shop_id and v.version=q.version;
  perform 1 from public.products where shop_id=p_shop_id and id in(select (value->>'sourceId')::uuid from jsonb_array_elements(snapshot->'lines') where value->>'itemType'='product') order by id for update;
  perform 1 from public.clients where id=q.customer_id and shop_id=p_shop_id and is_active for share;
  if not found then raise exception 'CUSTOMER_NOT_FOUND' using errcode='P0002';end if;
  for line in select value from jsonb_array_elements(snapshot->'lines') loop
   if line->>'itemType'='product' then
    select * into p from public.products where id=(line->>'sourceId')::uuid and shop_id=p_shop_id and is_active;
    if not found then raise exception 'PRODUCT_NOT_FOUND' using errcode='P0002';end if;
    m:=nullif(line->'measurement','null'::jsonb);
    if (m is null and p.measurement_status<>'legacy') or (m is not null and (p.measurement_status<>'active' or m->>'baseUnitCode' is distinct from p.base_unit_code or (m->>'productRevision')::integer is distinct from p.measurement_revision)) then raise exception 'ORDER_MEASUREMENT_CONTEXT_CHANGED' using errcode='55000';end if;
   elsif not exists(select 1 from public.services where id=(line->>'sourceId')::uuid and shop_id=p_shop_id and is_active) then raise exception 'SERVICE_NOT_FOUND' using errcode='P0002';end if;
  end loop;
  insert into shop_private.trade_order_counters(shop_id,next_number) values(p_shop_id,2) on conflict(shop_id) do update set next_number=trade_order_counters.next_number+1 returning next_number-1 into number;
  insert into public.trade_orders(shop_id,location_id,customer_id,quotation_id,quotation_version,order_number,currency,agreed_snapshot,total_amount,created_by_profile_id)
  values(p_shop_id,p_location_id,q.customer_id,q.id,q.version,'O-'||lpad(number::text,8,'0'),q.currency,snapshot,(snapshot->>'total')::numeric,actor) returning * into o;
  for line in select value from jsonb_array_elements(snapshot->'lines') loop
   position:=position+1;
   insert into public.trade_order_lines(shop_id,order_id,line_order,item_type,product_id,service_id,item_name,quantity,unit_price,discount_amount,measurement_snapshot,pricing_snapshot,tax_snapshot)
   values(p_shop_id,o.id,position,(line->>'itemType')::public.invoice_item_type,case when line->>'itemType'='product' then (line->>'sourceId')::uuid end,
    case when line->>'itemType'='service' then (line->>'sourceId')::uuid end,line->>'name',(line->>'quantity')::numeric,(line->>'unitPrice')::numeric,(line->>'lineDiscount')::numeric,
    nullif(line->'measurement','null'::jsonb),nullif(line->'pricing','null'::jsonb),line);
  end loop;
  insert into public.trade_order_events(shop_id,order_id,revision,action,status,reason,actor_profile_id) values(p_shop_id,o.id,1,'convert','open',btrim(p_reason),actor);
  update public.trade_quotations set revision=revision+1,updated_at=clock_timestamp() where id=q.id returning * into q;
  insert into public.trade_quotation_events(shop_id,quotation_id,revision,version,action,previous_status,status,reason,actor_profile_id)
  values(p_shop_id,q.id,q.revision,q.version,'convert_to_order','accepted','accepted',btrim(p_reason),actor);
  v_result:=jsonb_build_object('id',o.id,'revision',1,'status','open','alreadyConverted',false);
 end if;
 update shop_private.trade_order_requests set result=v_result where shop_id=p_shop_id and request_id=p_request_id;
 return v_result;
end;$$;
revoke all on function public.create_trade_order(uuid,uuid,uuid,uuid,integer,text) from public,anon,authenticated,service_role;
grant execute on function public.create_trade_order(uuid,uuid,uuid,uuid,integer,text) to authenticated;

create function public.trade_order_context(p_shop_id uuid,p_location_id uuid,p_order_id uuid default null,p_quotation_id uuid default null,p_search text default null,p_page integer default 1,p_history_page integer default 1,p_kind text default 'orders') returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare items jsonb;total bigint;detail jsonb;quote jsonb;lines jsonb;events jsonb;o public.trade_orders%rowtype;term text:=nullif(btrim(p_search),'');begin
 perform shop_private.assert_sale_read_access(p_shop_id);perform shop_private.assert_location_access(p_shop_id,p_location_id,false);
 if p_kind not in('orders','quotations') or p_kind is null or p_page is null or p_page<1 or p_history_page is null or p_history_page<1 or length(coalesce(term,''))>120 then raise exception 'INVALID_ORDER_QUERY' using errcode='22023';end if;
 if p_quotation_id is not null then
  select jsonb_build_object('id',q.id,'number',q.quotation_number,'revision',q.revision,'version',q.version,'status',q.status,'currency',q.currency,'total',trim_scale(q.total_amount)::text,'customerName',v.snapshot->>'customerName','projectReference',q.project_reference,'orderId',(select id from public.trade_orders where quotation_id=q.id and shop_id=p_shop_id)) into quote
  from public.trade_quotations q join public.trade_quotation_versions v on v.quotation_id=q.id and v.version=q.version and v.shop_id=q.shop_id where q.id=p_quotation_id and q.shop_id=p_shop_id and q.location_id=p_location_id;
  if quote is null then raise exception 'QUOTATION_NOT_FOUND' using errcode='P0002';end if;
 end if;
 if p_order_id is not null then
  select * into o from public.trade_orders where id=p_order_id and shop_id=p_shop_id and location_id=p_location_id;
  if not found then raise exception 'ORDER_NOT_FOUND' using errcode='P0002';end if;
  select coalesce(jsonb_agg(to_jsonb(l)||jsonb_build_object('quantity',trim_scale(l.quantity)::text,'unit_price',trim_scale(l.unit_price)::text,'discount_amount',trim_scale(l.discount_amount)::text) order by l.line_order),'[]') into lines from public.trade_order_lines l where l.order_id=o.id and l.shop_id=p_shop_id;
  select coalesce(jsonb_agg(to_jsonb(e)||jsonb_build_object('actor_name',(select display_name from public.profiles where id=e.actor_profile_id)) order by e.revision desc),'[]') into events from(select * from public.trade_order_events where order_id=o.id and shop_id=p_shop_id order by revision desc offset (p_history_page-1)*20 limit 20)e;
  detail:=jsonb_build_object('record',to_jsonb(o)||jsonb_build_object('total_amount',trim_scale(o.total_amount)::text,'agreed_snapshot',shop_private.quotation_money_projection(o.agreed_snapshot)),'lines',lines,'events',events,'eventCount',o.revision,'historyPage',p_history_page);
 end if;
 if p_kind='quotations' then
  select count(*) into total from public.trade_quotations q where q.shop_id=p_shop_id and q.location_id=p_location_id and q.status='accepted' and not exists(select 1 from public.trade_orders d where d.quotation_id=q.id and d.shop_id=q.shop_id) and (term is null or q.quotation_number ilike '%'||term||'%' or q.project_reference ilike '%'||term||'%');
  select coalesce(jsonb_agg(to_jsonb(r)||jsonb_build_object('total_amount',trim_scale(r.total_amount)::text) order by r.created_at desc,r.id),'[]') into items from(select q.id,q.quotation_number name,q.project_reference,q.currency,q.total_amount,q.created_at from public.trade_quotations q where q.shop_id=p_shop_id and q.location_id=p_location_id and q.status='accepted' and not exists(select 1 from public.trade_orders d where d.quotation_id=q.id and d.shop_id=q.shop_id) and (term is null or q.quotation_number ilike '%'||term||'%' or q.project_reference ilike '%'||term||'%') order by q.created_at desc,q.id offset (p_page-1)*20 limit 20)r;
 else
  select count(*) into total from public.trade_orders d where d.shop_id=p_shop_id and d.location_id=p_location_id and (term is null or d.order_number ilike '%'||term||'%' or d.agreed_snapshot->>'projectReference' ilike '%'||term||'%');
  select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at desc,r.id),'[]') into items from(select d.id,d.order_number,d.status,d.currency,trim_scale(d.total_amount)::text total_amount,d.revision,d.quotation_id,d.quotation_version,d.agreed_snapshot->>'customerName' customer_name,d.agreed_snapshot->>'projectReference' project_reference,d.created_at from public.trade_orders d where d.shop_id=p_shop_id and d.location_id=p_location_id and (term is null or d.order_number ilike '%'||term||'%' or d.agreed_snapshot->>'projectReference' ilike '%'||term||'%') order by d.created_at desc,d.id offset (p_page-1)*20 limit 20)r;
 end if;
 return jsonb_build_object('items',items,'total',total,'page',p_page,'pageSize',20,'detail',detail,'quotation',quote,'canManage',shop_private.has_permission(p_shop_id,'sales.manage'));
end;$$;
revoke all on function public.trade_order_context(uuid,uuid,uuid,uuid,text,integer,integer,text) from public,anon,authenticated,service_role;
grant execute on function public.trade_order_context(uuid,uuid,uuid,uuid,text,integer,integer,text) to authenticated;
do $$begin if (select md5(prosrc) from pg_catalog.pg_proc where oid='public.trade_quotation_context(uuid,uuid,uuid,text,integer,integer)'::regprocedure) is distinct from '3f5a2351de51787c032e0f7d85d2949d' then raise exception 'ORDER_ROUTINE_REVIEW_REQUIRED: public.trade_quotation_context' using errcode='55000';end if;end;$$;
create or replace function public.trade_quotation_context(p_shop_id uuid,p_location_id uuid,p_quotation_id uuid default null,p_search text default null,p_page integer default 1,p_history_page integer default 1) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare q public.trade_quotations%rowtype;items jsonb;total bigint;detail jsonb;versions jsonb;events jsonb;term text:=nullif(btrim(p_search),'');begin
 perform shop_private.assert_sale_read_access(p_shop_id);perform shop_private.assert_location_access(p_shop_id,p_location_id,false);
 if p_page is null or p_page<1 or p_history_page is null or p_history_page<1 or length(coalesce(term,''))>120 then raise exception 'INVALID_QUOTATION_QUERY' using errcode='22023';end if;
 if p_quotation_id is not null then
  select * into q from public.trade_quotations where id=p_quotation_id and shop_id=p_shop_id and location_id=p_location_id;
  if not found then raise exception 'QUOTATION_NOT_FOUND' using errcode='P0002';end if;
  select shop_private.quotation_money_projection(snapshot) into detail from public.trade_quotation_versions where quotation_id=q.id and shop_id=p_shop_id and version=q.version;
  select coalesce(jsonb_agg(to_jsonb(v)||jsonb_build_object('snapshot',shop_private.quotation_money_projection(v.snapshot),'actor_name',(select display_name from public.profiles where id=v.actor_profile_id)) order by v.version desc),'[]') into versions from(select version,snapshot,reason,actor_profile_id,created_at from public.trade_quotation_versions where quotation_id=q.id and shop_id=p_shop_id order by version desc offset (p_history_page-1)*10 limit 10)v;
  select coalesce(jsonb_agg(to_jsonb(e)||jsonb_build_object('actor_name',(select display_name from public.profiles where id=e.actor_profile_id)) order by e.revision desc),'[]') into events from(select revision,version,action,previous_status,status,reason,actor_profile_id,created_at from public.trade_quotation_events where quotation_id=q.id and shop_id=p_shop_id order by revision desc offset (p_history_page-1)*10 limit 10)e;
  detail:=jsonb_build_object('record',to_jsonb(q)||jsonb_build_object('total_amount',trim_scale(q.total_amount)::text,'effective_status',case when q.status='issued' and q.valid_until<=statement_timestamp() then 'expired' else q.status end),'snapshot',detail,'versions',versions,'events',events,'versionCount',q.version,'eventCount',q.revision,'historyPage',p_history_page);
 end if;
 select count(*) into total from public.trade_quotations doc where doc.shop_id=p_shop_id and doc.location_id=p_location_id and (term is null or doc.quotation_number ilike '%'||term||'%' or doc.project_reference ilike '%'||term||'%');
 select coalesce(jsonb_agg(to_jsonb(r)||jsonb_build_object('total_amount',trim_scale(r.total_amount)::text) order by r.created_at desc,r.id),'[]') into items from(
  select doc.*,c.name customer_name,case when doc.status='issued' and doc.valid_until<=statement_timestamp() then 'expired' else doc.status end effective_status
  from public.trade_quotations doc join public.clients c on c.id=doc.customer_id and c.shop_id=doc.shop_id where doc.shop_id=p_shop_id and doc.location_id=p_location_id
   and (term is null or doc.quotation_number ilike '%'||term||'%' or doc.project_reference ilike '%'||term||'%') order by doc.created_at desc,doc.id offset (p_page-1)*20 limit 20)r;
 return jsonb_build_object('items',items,'total',total,'page',p_page,'pageSize',20,'detail',detail,
  'canManage',shop_private.has_permission(p_shop_id,'sales.manage'),'canIssue',shop_private.has_permission(p_shop_id,'sales.issue'));
end;$$;

commit;
