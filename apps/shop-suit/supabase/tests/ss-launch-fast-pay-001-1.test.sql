begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(3);
create temporary table fast_pay_fixture as select gen_random_uuid() owner_id, gen_random_uuid() member_id, gen_random_uuid() stranger_id;
grant select on fast_pay_fixture to authenticated;
insert into auth.users(id,email,encrypted_password,aud,role,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select owner_id,'fast-pay-owner@example.invalid','x','authenticated','authenticated',now(),'{}'::jsonb,'{}'::jsonb,now(),now() from fast_pay_fixture
union all select member_id,'fast-pay-member@example.invalid','x','authenticated','authenticated',now(),'{}'::jsonb,'{}'::jsonb,now(),now() from fast_pay_fixture
union all select stranger_id,'fast-pay-stranger@example.invalid','x','authenticated','authenticated',now(),'{}'::jsonb,'{}'::jsonb,now(),now() from fast_pay_fixture;
select set_config('request.jwt.claim.sub',owner_id::text,true),set_config('request.jwt.claim.role','authenticated',true) from fast_pay_fixture;
set local role authenticated;
do $$
declare s uuid; loc uuid; customer uuid; product uuid; service uuid; invoice uuid; draft uuid;
  req uuid; paid timestamptz := now(); v_method public.payment_method; payload jsonb;
  required boolean; anonymous boolean; shift uuid; result uuid; before_count integer; stage integer;
begin
  s := public.create_owner_shop('Fast Pay fixture','team','mixed');
  select id into loc from public.shop_locations where shop_id=s and is_default;
  customer := public.save_customer(s,null,'Fast Pay customer',null,null,null,null);
  product := public.save_product(s,null,'Fast Pay product','FAST-PAY',null,20);
  service := public.save_service(s,null,'Fast Pay service',null,50,'percent',10);
  perform public.adjust_stock(gen_random_uuid(),s,product,100,7,'Opening stock');
  payload := jsonb_build_array(jsonb_build_object('item_type','product','source_id',product,'quantity',1),
    jsonb_build_object('item_type','service','source_id',service,'quantity',1));
  -- Both customer modes, every payment method, policy OFF and ON.
  foreach required in array array[false,true] loop
    perform public.set_shop_cash_policy(s,required);
    if required then shift := public.open_cash_shift(gen_random_uuid(),s,loc,'main',0,null); end if;
    foreach anonymous in array array[false,true] loop
      foreach v_method in array enum_range(null::public.payment_method) loop
        req := gen_random_uuid();
        -- Exercise updates as well as creation.
        draft := case when anonymous then public.save_location_sale_draft(gen_random_uuid(),s,loc,null,null,null,'Before',payload) else null end;
        invoice := public.fast_pay_location_sale(req,s,loc,draft,case when anonymous then null else customer end,
          null,'Confirmed',payload,65,paid,v_method,'FAST-PAY');
        result := public.fast_pay_location_sale(req,s,loc,draft,case when anonymous then null else customer end,
          null,'Confirmed',payload,65,paid,v_method,'FAST-PAY');
        if result <> invoice or (draft is not null and invoice <> draft)
          or public.get_sale(s,invoice)->>'status' <> 'issued'
          or (public.get_sale(s,invoice)->>'outstanding')::numeric <> 0
          or (select count(*) from public.payments where invoice_id=invoice) <> 1
          or (select count(*) from public.inventory_movements where reference_id=invoice) <> 1
          or public.get_location_sale_receipt(s,loc,invoice) is null then
          raise exception 'Fast Pay/replay invariant failed: %, %, %',required,anonymous,v_method;
        end if;
        if (select payment.method from public.payments payment where invoice_id=invoice) <> v_method then raise exception 'method lost'; end if;
        begin
          perform public.fast_pay_location_sale(req,s,loc,draft,case when anonymous then null else customer end,
            null,'Changed',payload,65,paid,v_method,'FAST-PAY');
          raise exception 'changed replay accepted';
        exception when unique_violation then
          if sqlerrm <> 'FAST_PAY_REQUEST_CONFLICT' then raise; end if;
        end;
      end loop;
    end loop;
    if required then
      perform public.close_cash_shift(gen_random_uuid(),s,shift,
        (public.cash_shift_dashboard(s,loc,null,1,20)#>>'{active,expectedCash}')::numeric,null);
      -- Completed replay is valid even after its shift closes.
      result := public.fast_pay_location_sale(req,s,loc,draft,null,null,'Confirmed',payload,65,paid,v_method,'FAST-PAY');
      if result <> invoice then raise exception 'closed shift broke replay'; end if;
    end if;
  end loop;
  -- No open shift: neither a new invoice nor an edited draft may survive.
  draft := public.save_location_sale_draft(gen_random_uuid(),s,loc,null,customer,null,'Before',payload);
  for stage in 0..1 loop
    select count(*) into before_count from public.invoices where shop_id=s;
    begin
      perform public.fast_pay_location_sale(gen_random_uuid(),s,loc,case when stage=0 then null else draft end,
        customer,null,'Must rollback',payload,65,paid,'card',null);
      raise exception 'closed shift checkout accepted';
    exception when check_violation then
      if sqlerrm <> 'SALE_OPEN_CASH_SHIFT_REQUIRED' then raise; end if;
    end;
    if (select count(*) from public.invoices where shop_id=s) <> before_count
      or (select notes from public.invoices where id=draft) <> 'Before' then raise exception 'shift failure persisted draft'; end if;
  end loop;
  perform public.set_shop_cash_policy(s,false);
  -- Payment-stage failure after customer issuance must roll back FIFO, issue,
  -- receipt snapshot and the draft update. Customerless total validation too.
  foreach anonymous in array array[false,true] loop
    begin
      perform public.fast_pay_location_sale(gen_random_uuid(),s,loc,draft,case when anonymous then null else customer end,
        null,'Must rollback',payload,64,paid,'cash',null);
      raise exception 'underpayment accepted';
    exception when check_violation then
      if sqlerrm not in ('FAST_PAY_REQUIRES_FULL_PAYMENT','CUSTOMERLESS_CHECKOUT_REQUIRES_FULL_PAYMENT') then raise; end if;
    end;
    if public.get_sale(s,draft)->>'status' <> 'draft'
      or (select notes from public.invoices where id=draft) <> 'Before'
      or exists(select 1 from public.payments where invoice_id=draft)
      or exists(select 1 from public.inventory_movements where reference_id=draft)
      or public.get_location_sale_receipt(s,loc,draft) is not null then raise exception 'partial success after payment failure'; end if;
  end loop;
  -- Insufficient stock after draft saving also rolls back creation entirely.
  payload := jsonb_build_array(jsonb_build_object('item_type','product','source_id',product,'quantity',1000));
  select count(*) into before_count from public.invoices where shop_id=s;
  begin
    perform public.fast_pay_location_sale(gen_random_uuid(),s,loc,null,customer,null,null,payload,20000,paid,'cash',null);
    raise exception 'insufficient stock accepted';
  exception when check_violation then
    if sqlerrm not like '%INSUFFICIENT_STOCK%' then raise; end if;
  end;
  if (select count(*) from public.invoices where shop_id=s) <> before_count then raise exception 'stock failure left draft'; end if;
  perform set_config('fast_pay.shop',s::text,true);
  perform set_config('fast_pay.location',loc::text,true);
  perform set_config('fast_pay.service',service::text,true);
  perform set_config('fast_pay.customer',customer::text,true);
end;
$$;
reset role;
select pass('Atomic create/update, customer modes, all methods, stock failure, shift policy and replay');
do $$
declare s uuid := current_setting('fast_pay.shop')::uuid;
begin
  if (select count(*) from public.sale_receipts where shop_id=s) <> 24
    or (select count(*) from public.customer_payment_allocations where shop_id=s) <> 24
    or (select sum(quantity_change) from public.inventory_movements where shop_id=s) <> 76
    or (select sum(remaining_quantity) from public.inventory_batches where shop_id=s) <> 76
    or exists(select 1 from public.inventory_movements where shop_id=s and movement_type='out'
      and (unit_cost_snapshot <> 7 or invoice_item_id is null or batch_id is null))
    or exists(select 1 from shop_private.fast_pay_requests where shop_id=s and invoice_id is null) then
    raise exception 'receipt/allocation/stock/request exactly-once invariant failed';
  end if;
  if has_function_privilege('anon','public.fast_pay_location_sale(uuid,uuid,uuid,uuid,uuid,date,text,jsonb,numeric,timestamptz,public.payment_method,text)','execute')
    or has_function_privilege('authenticated','shop_private.fast_pay_location_sale(uuid,uuid,uuid,uuid,uuid,date,text,jsonb,numeric,timestamptz,public.payment_method,text)','execute')
    or has_table_privilege('authenticated','shop_private.fast_pay_requests','select') then raise exception 'unsafe Fast Pay grants'; end if;
end;
$$;
select pass('Exact receipt/allocation/FIFO effects and private boundary grants');
-- A delegated member has sales.manage and location access; remove each
-- consequential permission independently to establish both server guards.
insert into public.profiles(user_id,portal_id,display_name,email_snapshot)
select member_id,shop.portal_id,'Fast Pay member','fast-pay-member@example.invalid'
from fast_pay_fixture join public.shops shop on shop.id=current_setting('fast_pay.shop')::uuid;
insert into public.shop_memberships(shop_id,profile_id,role,status)
select current_setting('fast_pay.shop')::uuid,p.id,'employee','active' from public.profiles p join fast_pay_fixture f on p.user_id=f.member_id;
insert into public.membership_roles(membership_id,role_id)
select m.id,r.id from public.shop_memberships m join public.profiles p on p.id=m.profile_id
join fast_pay_fixture f on p.user_id=f.member_id join public.roles r on r.shop_id=m.shop_id and r.key='manager';
insert into public.membership_location_assignments(shop_id,membership_id,location_id)
select m.shop_id,m.id,current_setting('fast_pay.location')::uuid from public.shop_memberships m
join public.profiles p on p.id=m.profile_id join fast_pay_fixture f on p.user_id=f.member_id
on conflict (membership_id,location_id) do nothing;
do $$
declare s uuid := current_setting('fast_pay.shop')::uuid; denied text; v_permission_id uuid; v_role_id uuid;
  payload jsonb := jsonb_build_array(jsonb_build_object('item_type','service','source_id',current_setting('fast_pay.service'),'quantity',1));
begin
  select id into v_role_id from public.roles where shop_id=s and key='manager';
  foreach denied in array array['sales.issue','payments.receive'] loop
    select p.id into v_permission_id from public.permissions p join public.shops shop on shop.portal_id=p.portal_id where shop.id=s and p.key=denied;
    delete from public.role_permissions rp where rp.role_id=v_role_id and rp.permission_id=v_permission_id;
    perform set_config('request.jwt.claim.sub',(select member_id::text from fast_pay_fixture),true);
    execute 'set local role authenticated';
    begin
      perform public.fast_pay_location_sale(gen_random_uuid(),s,current_setting('fast_pay.location')::uuid,null,
        current_setting('fast_pay.customer')::uuid,null,null,payload,45,now(),'cash',null);
      raise exception 'missing permission accepted: %',denied;
    exception when insufficient_privilege then null; end;
    execute 'reset role';
    insert into public.role_permissions(role_id,permission_id) values(v_role_id,v_permission_id);
  end loop;
  perform set_config('request.jwt.claim.sub',(select stranger_id::text from fast_pay_fixture),true);
  execute 'set local role authenticated';
  begin
    perform public.fast_pay_location_sale(gen_random_uuid(),s,current_setting('fast_pay.location')::uuid,null,
      null,null,null,payload,45,now(),'cash',null);
    raise exception 'other tenant accepted';
  exception when insufficient_privilege then null; end;
  execute 'reset role';
end;
$$;
select pass('Issue permission, receive permission and other-tenant denials');
select * from finish();
rollback;
