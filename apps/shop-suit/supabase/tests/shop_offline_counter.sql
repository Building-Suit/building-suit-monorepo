-- Disposable synthetic fixtures. Runner wraps this file in BEGIN/ROLLBACK.
create temporary table offline_fixture as select gen_random_uuid() owner_id;
grant select on offline_fixture to authenticated;
insert into auth.users(id,email,encrypted_password,aud,role,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select owner_id,'owner@ss-offline.invalid','x','authenticated','authenticated',now(),'{}','{}',now(),now() from offline_fixture;
select set_config('request.jwt.claim.sub',owner_id::text,true),set_config('request.jwt.claim.role','authenticated',true) from offline_fixture;
set local role authenticated;
do $$
declare v_shop uuid; v_location uuid; v_staff uuid; v_product uuid; v_shift uuid;
  v_request uuid:=gen_random_uuid(); v_save uuid:=gen_random_uuid(); v_issue uuid:=gen_random_uuid(); v_payment uuid:=gen_random_uuid();
  v_invoice uuid; v_replay uuid; v_lines jsonb; v_paid timestamptz:=now(); v_count integer;
begin
  v_shop:=public.create_owner_shop('Offline counter fixture','product'::public.business_mode);
  select id into v_location from public.shop_locations where shop_id=v_shop and is_default;
  select id into v_staff from public.shop_memberships where shop_id=v_shop and role='owner';
  v_product:=public.save_product(v_shop,null,'Offline product','OFF-1',null,20);
  perform public.adjust_stock(gen_random_uuid(),v_shop,v_product,5,10,'Offline fixture stock');
  v_shift:=public.open_cash_shift(gen_random_uuid(),v_shop,v_location,'main',100,null);
  v_lines:=jsonb_build_array(jsonb_build_object('item_type','product','source_id',v_product,'quantity',1));
  v_invoice:=public.replay_offline_pos_sale(v_request,v_save,v_issue,v_payment,null,v_shop,v_location,v_shift,v_staff,null,null,null,v_lines,20,v_paid,'cash',null);
  v_replay:=public.replay_offline_pos_sale(v_request,v_save,v_issue,v_payment,null,v_shop,v_location,v_shift,v_staff,null,null,null,v_lines,20,v_paid,'cash',null);
  if v_replay<>v_invoice or (select count(*) from public.payments where invoice_id=v_invoice)<>1
    or (select count(*) from public.inventory_movements where reference_id=v_invoice)<>1
    or (select count(*) from public.cash_drawer_events where session_id=v_shift and event_kind='cash_sale')<>1 then
    raise exception 'offline replay duplicated financial, stock or drawer effects';
  end if;
  begin
    perform public.replay_offline_pos_sale(v_request,v_save,v_issue,v_payment,null,v_shop,v_location,v_shift,v_staff,null,null,null,v_lines,21,v_paid,'cash',null);
    raise exception 'changed envelope accepted';
  exception when unique_violation then
    if sqlerrm<>'POS_REQUEST_CONFLICT' then raise; end if;
  end;
  select count(*) into v_count from public.invoices where shop_id=v_shop;
  begin
    perform public.replay_offline_pos_sale(gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),null,v_shop,v_location,v_shift,v_staff,null,null,null,v_lines,21,v_paid,'cash',null);
    raise exception 'changed price accepted';
  exception when check_violation then
    if sqlerrm<>'POS_CHECKOUT_REQUIRES_FULL_PAYMENT' then raise; end if;
  end;
  if (select count(*) from public.invoices where shop_id=v_shop)<>v_count then raise exception 'rejection left partial draft'; end if;
  perform public.close_cash_shift(gen_random_uuid(),v_shop,v_shift,120,null);
  -- Lost response must still resolve an already completed sale after shift close.
  v_replay:=public.replay_offline_pos_sale(v_request,v_save,v_issue,v_payment,null,v_shop,v_location,v_shift,v_staff,null,null,null,v_lines,20,v_paid,'cash',null);
  if v_replay<>v_invoice then raise exception 'completed replay failed after shift close'; end if;
  perform public.open_cash_shift(gen_random_uuid(),v_shop,v_location,'main',120,null);
  begin
    perform public.replay_offline_pos_sale(gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),null,v_shop,v_location,v_shift,v_staff,null,null,null,v_lines,20,v_paid,'cash',null);
    raise exception 'stale shift accepted';
  exception when check_violation then
    if sqlerrm<>'OFFLINE_SHIFT_CONFLICT' then raise; end if;
  end;
  if (select count(*) from public.invoices where shop_id=v_shop)<>v_count then raise exception 'stale shift left partial draft'; end if;
end;
$$;
reset role;
