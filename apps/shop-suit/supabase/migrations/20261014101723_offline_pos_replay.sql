-- Atomic offline envelope: capture the drawer identity and reuse existing POS idempotency.
create table shop_private.offline_pos_requests (
  request_id uuid primary key,
  shop_id uuid not null references public.shops(id),
  actor_profile_id uuid not null references public.profiles(id),
  payload jsonb not null,
  invoice_id uuid references public.invoices(id),
  completed_at timestamptz
);
revoke all on shop_private.offline_pos_requests from public, anon, authenticated;

create function shop_private.replay_offline_pos_sale(
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
revoke all on function shop_private.replay_offline_pos_sale(uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,jsonb,numeric,timestamptz,public.payment_method,text)
  from public,anon,authenticated;

create function public.replay_offline_pos_sale(
  p_request_id uuid, p_save_request_id uuid, p_issue_request_id uuid, p_payment_request_id uuid,
  p_appointment_request_id uuid, p_shop_id uuid, p_location_id uuid, p_shift_id uuid,
  p_staff_membership_id uuid, p_appointment_id uuid, p_customer_id uuid, p_notes text,
  p_lines jsonb, p_amount numeric, p_paid_at timestamptz, p_method public.payment_method, p_reference text
) returns uuid language sql security definer set search_path = '' as $$
  select shop_private.replay_offline_pos_sale(p_request_id,p_save_request_id,p_issue_request_id,p_payment_request_id,
    p_appointment_request_id,p_shop_id,p_location_id,p_shift_id,p_staff_membership_id,p_appointment_id,p_customer_id,
    p_notes,p_lines,p_amount,p_paid_at,p_method,p_reference);
$$;
revoke all on function public.replay_offline_pos_sale(uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,jsonb,numeric,timestamptz,public.payment_method,text)
  from public,anon;
grant execute on function public.replay_offline_pos_sale(uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,jsonb,numeric,timestamptz,public.payment_method,text)
  to authenticated;
