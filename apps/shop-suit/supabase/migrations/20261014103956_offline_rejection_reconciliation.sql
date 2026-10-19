-- Keep immutable server cancellation tombstones: a late replay cannot revive a rejected local sale.
alter table shop_private.offline_pos_requests
  add column resolution_request_id uuid unique,
  add column resolution_reason text,
  add column resolved_at timestamptz,
  add constraint offline_pos_terminal_state check (not (completed_at is not null and resolved_at is not null));

create function shop_private.protect_offline_pos_request()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' or old.completed_at is not null or old.resolved_at is not null
    or new.request_id is distinct from old.request_id or new.shop_id is distinct from old.shop_id
    or new.actor_profile_id is distinct from old.actor_profile_id or new.payload is distinct from old.payload then
    raise exception 'OFFLINE_REQUEST_IMMUTABLE' using errcode='55000';
  end if;
  return new;
end;
$$;
revoke all on function shop_private.protect_offline_pos_request() from public,anon,authenticated,service_role;
create trigger offline_pos_request_immutable before update or delete on shop_private.offline_pos_requests
  for each row execute function shop_private.protect_offline_pos_request();

create or replace function shop_private.replay_offline_pos_sale(
  p_request_id uuid, p_save_request_id uuid, p_issue_request_id uuid, p_payment_request_id uuid,
  p_appointment_request_id uuid, p_shop_id uuid, p_location_id uuid, p_shift_id uuid,
  p_staff_membership_id uuid, p_appointment_id uuid, p_customer_id uuid, p_notes text,
  p_lines jsonb, p_amount numeric, p_paid_at timestamptz, p_method public.payment_method, p_reference text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_actor uuid; v_payload jsonb; v_request shop_private.offline_pos_requests%rowtype;
  v_shift public.cash_sessions%rowtype; v_invoice uuid;
begin
  v_actor := shop_private.assert_shop_write_access(p_shop_id, 'sales.manage');
  perform shop_private.assert_location_access(p_shop_id, p_location_id, true);
  if not shop_private.has_permission(p_shop_id, 'sales.issue')
    or not shop_private.has_permission(p_shop_id, 'payments.receive') then
    raise exception 'SHOP_PERMISSION_DENIED' using errcode = '42501';
  end if;
  if p_request_id is null or p_shift_id is null then
    raise exception 'INVALID_OFFLINE_ENVELOPE' using errcode = '22023';
  end if;
  v_payload := jsonb_build_object('save',p_save_request_id,'issue',p_issue_request_id,
    'payment',p_payment_request_id,'appointmentRequest',p_appointment_request_id,
    'location',p_location_id,'shift',p_shift_id,'staff',p_staff_membership_id,
    'appointment',p_appointment_id,'customer',p_customer_id,'notes',p_notes,
    'lines',p_lines,'amount',p_amount,'paidAt',p_paid_at,'method',p_method,'reference',p_reference);
  insert into shop_private.offline_pos_requests(request_id,shop_id,actor_profile_id,payload)
    values(p_request_id,p_shop_id,v_actor,v_payload) on conflict do nothing;
  select * into v_request from shop_private.offline_pos_requests where request_id=p_request_id for update;
  if v_request.shop_id <> p_shop_id or v_request.actor_profile_id <> v_actor or v_request.payload <> v_payload then
    raise exception 'POS_REQUEST_CONFLICT' using errcode='23505';
  end if;
  -- Replay of a committed envelope succeeds even after its drawer has closed.
  if v_request.completed_at is not null then return v_request.invoice_id; end if;
  if v_request.resolved_at is not null then raise exception 'OFFLINE_SALE_CANCELLED' using errcode='23514'; end if;
  select * into v_shift from public.cash_sessions where id=p_shift_id and shop_id=p_shop_id
    and location_id=p_location_id and register_key='main' for update;
  if v_shift.id is null or v_shift.status <> 'open' then
    raise exception 'OFFLINE_SHIFT_CONFLICT' using errcode='23514';
  end if;
  v_invoice := shop_private.save_pos_sale_draft(p_save_request_id,p_shop_id,p_location_id,null,
    p_staff_membership_id,p_appointment_id,p_customer_id,p_notes,p_lines);
  perform shop_private.checkout_pos_sale(p_request_id,p_issue_request_id,p_payment_request_id,
    p_appointment_request_id,p_shop_id,p_location_id,v_invoice,p_amount,p_paid_at,p_method,p_reference);
  update shop_private.offline_pos_requests set invoice_id=v_invoice,completed_at=clock_timestamp()
    where request_id=p_request_id;
  return v_invoice;
end;
$$;

create function shop_private.reconcile_offline_pos_sale(
  p_request_id uuid,p_shop_id uuid,p_location_id uuid,p_original_args jsonb,
  p_resolution_request_id uuid,p_reason text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid; v_payload jsonb; v_request shop_private.offline_pos_requests%rowtype;
begin
  v_actor:=shop_private.assert_shop_write_access(p_shop_id,'sales.manage');
  perform shop_private.assert_location_access(p_shop_id,p_location_id,true);
  if not shop_private.has_permission(p_shop_id,'sales.issue') or not shop_private.has_permission(p_shop_id,'payments.receive') then
    raise exception 'SHOP_PERMISSION_DENIED' using errcode='42501';
  end if;
  if p_request_id is null or p_resolution_request_id is null or p_reason is null or length(btrim(p_reason)) not between 10 and 2000
    or jsonb_typeof(p_original_args) is distinct from 'object'
    or (select count(*) from jsonb_object_keys(p_original_args))<>17
    or (p_original_args->>'p_request_id')::uuid is distinct from p_request_id
    or (p_original_args->>'p_shop_id')::uuid is distinct from p_shop_id
    or (p_original_args->>'p_location_id')::uuid is distinct from p_location_id then
    raise exception 'INVALID_OFFLINE_RECONCILIATION' using errcode='22023';
  end if;
  -- Same canonical typed payload used by replay; neither the amount nor original IDs can be rewritten.
  v_payload:=jsonb_build_object(
    'save',(p_original_args->>'p_save_request_id')::uuid,'issue',(p_original_args->>'p_issue_request_id')::uuid,
    'payment',(p_original_args->>'p_payment_request_id')::uuid,'appointmentRequest',(p_original_args->>'p_appointment_request_id')::uuid,
    'location',p_location_id,'shift',(p_original_args->>'p_shift_id')::uuid,'staff',(p_original_args->>'p_staff_membership_id')::uuid,
    'appointment',(p_original_args->>'p_appointment_id')::uuid,'customer',(p_original_args->>'p_customer_id')::uuid,
    'notes',p_original_args->>'p_notes','lines',p_original_args->'p_lines','amount',(p_original_args->>'p_amount')::numeric,
    'paidAt',(p_original_args->>'p_paid_at')::timestamptz,'method',(p_original_args->>'p_method')::public.payment_method,
    'reference',p_original_args->>'p_reference');
  insert into shop_private.offline_pos_requests(request_id,shop_id,actor_profile_id,payload)
    values(p_request_id,p_shop_id,v_actor,v_payload) on conflict do nothing;
  select * into v_request from shop_private.offline_pos_requests where request_id=p_request_id for update;
  if v_request.shop_id<>p_shop_id or v_request.actor_profile_id<>v_actor or v_request.payload<>v_payload then
    raise exception 'POS_REQUEST_CONFLICT' using errcode='23505';
  end if;
  if v_request.completed_at is not null then
    return jsonb_build_object('state','synced','invoiceId',v_request.invoice_id);
  end if;
  if v_request.resolved_at is not null then
    if v_request.resolution_request_id<>p_resolution_request_id or v_request.resolution_reason<>btrim(p_reason) then
      raise exception 'OFFLINE_RESOLUTION_CONFLICT' using errcode='23505';
    end if;
  else
    update shop_private.offline_pos_requests set resolution_request_id=p_resolution_request_id,
      resolution_reason=btrim(p_reason),resolved_at=clock_timestamp() where request_id=p_request_id;
  end if;
  return jsonb_build_object('state','cancelled','resolutionRequestId',p_resolution_request_id);
end;
$$;
revoke all on function shop_private.reconcile_offline_pos_sale(uuid,uuid,uuid,jsonb,uuid,text) from public,anon,authenticated;
create function public.reconcile_offline_pos_sale(p_request_id uuid,p_shop_id uuid,p_location_id uuid,
  p_original_args jsonb,p_resolution_request_id uuid,p_reason text)
returns jsonb language sql security definer set search_path='' as $$
  select shop_private.reconcile_offline_pos_sale(p_request_id,p_shop_id,p_location_id,p_original_args,p_resolution_request_id,p_reason);
$$;
revoke all on function public.reconcile_offline_pos_sale(uuid,uuid,uuid,jsonb,uuid,text) from public,anon;
grant execute on function public.reconcile_offline_pos_sale(uuid,uuid,uuid,jsonb,uuid,text) to authenticated;
