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
  v_new_shift uuid; v_args jsonb; v_outcome jsonb; v_resolve uuid:=gen_random_uuid(); v_rejected uuid:=gen_random_uuid(); v_movement jsonb; v_close jsonb; v_legacy uuid; v_legacy_save uuid:=gen_random_uuid(); v_legacy_issue uuid:=gen_random_uuid(); v_legacy_payment uuid:=gen_random_uuid(); v_legacy_checkout uuid:=gen_random_uuid(); v_move_id uuid; v_close_id uuid;
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
    or (public.cash_shift_dashboard(v_shop,v_location,null,1,20)->'active'->>'cashSales')::numeric<>20 then
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
  v_new_shift:=public.open_cash_shift(gen_random_uuid(),v_shop,v_location,'main',120,null);
  begin
    perform public.replay_offline_pos_sale(gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),null,v_shop,v_location,v_shift,v_staff,null,null,null,v_lines,20,v_paid,'cash',null);
    raise exception 'stale shift accepted';
  exception when check_violation then
    if sqlerrm<>'OFFLINE_SHIFT_CONFLICT' then raise; end if;
  end;
  if (select count(*) from public.invoices where shop_id=v_shop)<>v_count then raise exception 'stale shift left partial draft'; end if;
  v_args:=jsonb_build_object('p_request_id',v_request,'p_save_request_id',v_save,'p_issue_request_id',v_issue,'p_payment_request_id',v_payment,
    'p_appointment_request_id',null,'p_shop_id',v_shop,'p_location_id',v_location,'p_shift_id',v_shift,'p_staff_membership_id',v_staff,
    'p_appointment_id',null,'p_customer_id',null,'p_notes',null,'p_lines',v_lines,'p_amount',20,'p_paid_at',v_paid,'p_method','cash','p_reference',null);
  v_outcome:=public.reconcile_offline_pos_sale(v_request,v_shop,v_location,v_args,v_resolve,'Operator requested cancellation of unposted offline transaction');
  if v_outcome->>'state'<>'synced' or (v_outcome->>'invoiceId')::uuid<>v_invoice then raise exception 'resolution cancelled an already committed sale'; end if;
  v_args:=v_args||jsonb_build_object('p_request_id',v_rejected,'p_save_request_id',gen_random_uuid(),'p_issue_request_id',gen_random_uuid(),'p_payment_request_id',gen_random_uuid());
  v_outcome:=public.reconcile_offline_pos_sale(v_rejected,v_shop,v_location,v_args,v_resolve,'Operator requested cancellation of unposted offline transaction');
  if v_outcome->>'state'<>'cancelled' then raise exception 'rejected sale cancellation not confirmed'; end if;
  if public.reconcile_offline_pos_sale(v_rejected,v_shop,v_location,v_args,v_resolve,'Operator requested cancellation of unposted offline transaction')<>v_outcome then raise exception 'cancellation replay changed outcome'; end if;
  begin
    perform public.replay_offline_pos_sale(v_rejected,(v_args->>'p_save_request_id')::uuid,(v_args->>'p_issue_request_id')::uuid,(v_args->>'p_payment_request_id')::uuid,null,v_shop,v_location,v_shift,v_staff,null,null,null,v_lines,20,v_paid,'cash',null);
    raise exception 'cancelled sale revived';
  exception when check_violation then if sqlerrm<>'OFFLINE_SALE_CANCELLED' then raise; end if; end;
  begin
    perform public.reconcile_offline_pos_sale(v_rejected,v_shop,v_location,v_args||jsonb_build_object('p_amount',21),v_resolve,'Operator requested cancellation of unposted offline transaction');
    raise exception 'changed cancellation payload accepted';
  exception when unique_violation then if sqlerrm<>'POS_REQUEST_CONFLICT' then raise; end if; end;
  begin
    perform public.reconcile_offline_pos_sale(v_rejected,v_shop,v_location,v_args,gen_random_uuid(),'Changed resolution reason');
    raise exception 'changed resolution accepted';
  exception when unique_violation then if sqlerrm<>'OFFLINE_RESOLUTION_CONFLICT' then raise; end if; end;

  -- Online response lost before local capture: original business requests still identify the result.
  v_legacy:=public.save_pos_sale_draft(v_legacy_save,v_shop,v_location,null,v_staff,null,null,null,v_lines);
  perform public.checkout_pos_sale(v_legacy_checkout,v_legacy_issue,v_legacy_payment,null,v_shop,v_location,v_legacy,20,v_paid,'cash',null);
  v_movement:=jsonb_build_object('p_request_id',gen_random_uuid(),'p_shop_id',v_shop,'p_session_id',v_new_shift,'p_kind','pay_in','p_amount',10,'p_reason','Legacy cash receipt','p_reference','LEGACY-10');
  v_move_id:=public.record_cash_movement((v_movement->>'p_request_id')::uuid,v_shop,v_new_shift,'pay_in',10,'Legacy cash receipt','LEGACY-10');
  v_close:=jsonb_build_object('p_request_id',gen_random_uuid(),'p_shop_id',v_shop,'p_session_id',v_new_shift,'p_counted_amount',150,'p_notes',null);
  v_close_id:=public.close_cash_shift((v_close->>'p_request_id')::uuid,v_shop,v_new_shift,150,null);
  v_args:=v_args||jsonb_build_object('p_request_id',v_legacy_checkout,'p_save_request_id',v_legacy_save,'p_issue_request_id',v_legacy_issue,'p_payment_request_id',v_legacy_payment,'p_shift_id',v_new_shift);
  if public.replay_offline_pos_sale(v_legacy_checkout,v_legacy_save,v_legacy_issue,v_legacy_payment,null,v_shop,v_location,v_new_shift,v_staff,null,null,null,v_lines,20,v_paid,'cash',null)<>v_legacy then raise exception 'legacy committed sale not recovered after drawer close'; end if;
  if public.replay_offline_cash_command('movement',v_shop,v_movement)<>v_move_id or public.replay_offline_cash_command('close',v_shop,v_close)<>v_close_id then raise exception 'legacy committed cash command not recovered'; end if;
  if (select count(*) from public.payments where invoice_id=v_legacy)<>1 or (select count(*) from public.inventory_movements where reference_id=v_legacy)<>1 then raise exception 'legacy recovery duplicated effects'; end if;
  v_outcome:=public.reconcile_offline_cash_command('movement',v_shop,v_movement,gen_random_uuid(),'Operator requested cancellation of unposted offline transaction');
  if v_outcome->>'state'<>'synced' or (v_outcome->>'resultId')::uuid<>v_move_id then raise exception 'resolution cancelled committed cash movement'; end if;

  v_movement:=v_movement||jsonb_build_object('p_request_id',gen_random_uuid(),'p_amount',5);
  begin
    perform public.replay_offline_cash_command('movement',v_shop,v_movement);
    raise exception 'movement on closed drawer accepted';
  exception when object_not_in_prerequisite_state then if sqlerrm<>'CASH_SHIFT_NOT_OPEN' then raise; end if; end;
  v_resolve:=gen_random_uuid();
  v_outcome:=public.reconcile_offline_cash_command('movement',v_shop,v_movement,v_resolve,'Operator requested cancellation of unposted offline transaction');
  if v_outcome->>'state'<>'cancelled' then raise exception 'cash cancellation not confirmed'; end if;
  if public.reconcile_offline_cash_command('movement',v_shop,v_movement,v_resolve,'Operator requested cancellation of unposted offline transaction')<>v_outcome then raise exception 'cash cancellation replay changed outcome'; end if;
  begin
    perform public.record_cash_movement((v_movement->>'p_request_id')::uuid,v_shop,v_new_shift,'pay_in',5,'Legacy cash receipt','LEGACY-10');
    raise exception 'late direct cash request bypassed cancellation';
  exception when check_violation then if sqlerrm<>'OFFLINE_CASH_CANCELLED' then raise; end if; end;
  v_close:=v_close||jsonb_build_object('p_request_id',gen_random_uuid());
  v_outcome:=public.reconcile_offline_cash_command('close',v_shop,v_close,gen_random_uuid(),'Operator requested cancellation of unposted offline transaction');
  if v_outcome->>'state'<>'cancelled' then raise exception 'close cancellation not confirmed'; end if;
  begin
    perform public.close_cash_shift((v_close->>'p_request_id')::uuid,v_shop,v_new_shift,150,null);
    raise exception 'late direct close bypassed cancellation';
  exception when check_violation then if sqlerrm<>'OFFLINE_CASH_CANCELLED' then raise; end if; end;
  if (select (item->>'expectedCash')::numeric from jsonb_array_elements(public.cash_shift_dashboard(v_shop,v_location,null,1,20)->'items') item where (item->>'id')::uuid=v_new_shift)<>150 then raise exception 'reconciliation changed closed drawer history'; end if;
end;
$$;
reset role;
