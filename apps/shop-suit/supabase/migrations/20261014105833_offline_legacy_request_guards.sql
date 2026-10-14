-- Bridge already-sent online requests and offline replay/reconciliation under the same locks.
create function shop_private.offline_pos_existing_result(p_request_id uuid,p_shop_id uuid,p_actor uuid,p_payload jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_save public.pos_sale_requests%rowtype; v_checkout public.pos_sale_requests%rowtype; v_hash text;
begin
  select * into v_save from public.pos_sale_requests where request_id=(p_payload->>'save')::uuid;
  select * into v_checkout from public.pos_sale_requests where request_id=p_request_id;
  if v_save.request_id is not null then
    v_hash:=md5(jsonb_build_object('location',(p_payload->>'location')::uuid,'invoice',null,
      'staff',(p_payload->>'staff')::uuid,'appointment',(p_payload->>'appointment')::uuid,
      'customer',(p_payload->>'customer')::uuid,'notes',nullif(btrim(p_payload->>'notes'),''),'lines',p_payload->'lines')::text);
    if v_save.shop_id<>p_shop_id or v_save.actor_profile_id<>p_actor or v_save.operation<>'save' or v_save.payload_hash<>v_hash then
      raise exception 'POS_REQUEST_CONFLICT' using errcode='23505';
    end if;
  end if;
  if v_checkout.request_id is null then return null; end if;
  if v_save.request_id is null or v_checkout.shop_id<>p_shop_id or v_checkout.actor_profile_id<>p_actor or v_checkout.operation<>'checkout' then
    raise exception 'POS_REQUEST_CONFLICT' using errcode='23505';
  end if;
  v_hash:=md5(jsonb_build_object('invoice',v_save.invoice_id,'amount',(p_payload->>'amount')::numeric,
    'paidAt',(p_payload->>'paidAt')::timestamptz,'method',p_payload->>'method','reference',nullif(btrim(p_payload->>'reference'),''),
    'issueRequest',(p_payload->>'issue')::uuid,'paymentRequest',(p_payload->>'payment')::uuid,
    'appointmentRequest',(p_payload->>'appointmentRequest')::uuid)::text);
  if v_checkout.invoice_id is distinct from v_save.invoice_id or v_checkout.payload_hash<>v_hash then
    raise exception 'POS_REQUEST_CONFLICT' using errcode='23505';
  end if;
  return case when v_checkout.completed_at is not null then v_checkout.invoice_id else null end;
end;
$$;
revoke all on function shop_private.offline_pos_existing_result(uuid,uuid,uuid,jsonb) from public,anon,authenticated;

create function shop_private.offline_cash_existing_result(p_kind text,p_shop_id uuid,p_args jsonb,p_actor uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_event public.cash_drawer_events%rowtype; v_request public.cash_shift_requests%rowtype;
  v_profile uuid; v_hash text; v_match record;
begin
  if p_kind='movement' then
    select event as event,membership.profile_id into v_match from public.cash_drawer_events event
      join public.shop_memberships membership on membership.id=event.actor_membership_id
      where event.shop_id=p_shop_id and event.request_id=(p_args->>'p_request_id')::uuid;
    if not found then return null; end if;
    v_event:=v_match.event; v_profile:=v_match.profile_id;
    if v_event.session_id<>(p_args->>'p_session_id')::uuid or v_event.event_kind::text<>p_args->>'p_kind'
      or v_event.amount<>(p_args->>'p_amount')::numeric or v_event.reason<>btrim(p_args->>'p_reason')
      or v_event.reference<>btrim(p_args->>'p_reference') or v_profile<>p_actor then
      raise exception 'CASH_MOVEMENT_REQUEST_CONFLICT' using errcode='23505';
    end if;
    return v_event.id;
  end if;
  select * into v_request from public.cash_shift_requests where shop_id=p_shop_id and operation='close'
    and request_id=(p_args->>'p_request_id')::uuid;
  if v_request.request_id is null then return null; end if;
  v_hash:=md5(jsonb_build_object('session',(p_args->>'p_session_id')::uuid,
    'countedAmount',(p_args->>'p_counted_amount')::numeric,'notes',nullif(btrim(p_args->>'p_notes'),''))::text);
  if v_request.actor_profile_id<>p_actor or v_request.payload_hash<>v_hash then
    raise exception 'CASH_SHIFT_REQUEST_CONFLICT' using errcode='23505';
  end if;
  return case when v_request.completed_at is not null then v_request.result_id else null end;
end;
$$;
revoke all on function shop_private.offline_cash_existing_result(text,uuid,jsonb,uuid) from public,anon,authenticated;

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
  if p_amount <> v_invoice.total_amount then raise exception 'POS_CHECKOUT_REQUIRES_FULL_PAYMENT' using errcode = '23514'; end if;
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

create or replace function shop_private.record_cash_movement(
  p_request_id uuid, p_shop_id uuid, p_session_id uuid, p_kind text,
  p_amount numeric, p_reason text, p_reference text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_session public.cash_sessions%rowtype; v_actor record; v_event_id uuid;
begin
  if p_request_id is null or p_kind not in ('pay_in','pay_out')
    or p_amount is null or p_amount <= 0 or round(p_amount, 2) <> p_amount
    or length(btrim(coalesce(p_reason, ''))) < 2 or length(p_reason) > 1000
    or length(btrim(coalesce(p_reference, ''))) < 1 or length(p_reference) > 200 then
    raise exception 'INVALID_CASH_MOVEMENT' using errcode = '22023';
  end if;
  perform shop_private.offline_cash_actor('movement',p_shop_id,jsonb_build_object('p_request_id',p_request_id,'p_shop_id',p_shop_id,'p_session_id',p_session_id,'p_kind',p_kind,'p_amount',p_amount,'p_reason',p_reason,'p_reference',p_reference));
  perform pg_advisory_xact_lock(hashtextextended('offline-cash:'||p_shop_id::text||':'||p_request_id::text,0));
  if exists(select 1 from shop_private.offline_cash_requests where request_id=p_request_id and shop_id=p_shop_id and resolved_at is not null) then
    raise exception 'OFFLINE_CASH_CANCELLED' using errcode='23514';
  end if;
  select * into v_session from public.cash_sessions
  where id = p_session_id and shop_id = p_shop_id for update;
  if not found or v_session.status <> 'open' then
    raise exception 'CASH_SHIFT_NOT_OPEN' using errcode = '55000';
  end if;
  select * into v_actor from shop_private.assert_cash_shift_access(
    p_shop_id, v_session.location_id, 'cash_shifts.adjust');
  insert into public.cash_drawer_events (request_id, shop_id, location_id, session_id,
    event_kind, amount, reason, reference, actor_membership_id)
  values (p_request_id, p_shop_id, v_session.location_id, p_session_id, p_kind,
    p_amount, btrim(p_reason), btrim(p_reference), v_actor.membership_id)
  on conflict (shop_id, request_id) do nothing returning id into v_event_id;
  if v_event_id is null then
    select event.id into v_event_id from public.cash_drawer_events event
    where event.shop_id = p_shop_id and event.request_id = p_request_id
      and event.session_id = p_session_id and event.event_kind = p_kind
      and event.amount = p_amount and event.reason = btrim(p_reason)
      and event.reference = btrim(p_reference)
      and event.actor_membership_id = v_actor.membership_id;
    if v_event_id is null then
      raise exception 'CASH_MOVEMENT_REQUEST_CONFLICT' using errcode = '23505';
    end if;
  end if;
  return v_event_id;
end;
$$;

create or replace function shop_private.close_cash_shift(
  p_request_id uuid, p_shop_id uuid, p_session_id uuid,
  p_counted_amount numeric, p_notes text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_session public.cash_sessions%rowtype; v_actor record;
  v_request public.cash_shift_requests%rowtype; v_totals record; v_hash text;
begin
  if p_request_id is null or p_counted_amount is null or p_counted_amount < 0
    or round(p_counted_amount, 2) <> p_counted_amount
    or (nullif(btrim(p_notes), '') is not null and length(btrim(p_notes)) < 2)
    or length(coalesce(p_notes, '')) > 1000 then
    raise exception 'INVALID_CASH_SHIFT_CLOSE' using errcode = '22023';
  end if;
  perform shop_private.offline_cash_actor('close',p_shop_id,jsonb_build_object('p_request_id',p_request_id,'p_shop_id',p_shop_id,'p_session_id',p_session_id,'p_counted_amount',p_counted_amount,'p_notes',p_notes));
  perform pg_advisory_xact_lock(hashtextextended('offline-cash:'||p_shop_id::text||':'||p_request_id::text,0));
  if exists(select 1 from shop_private.offline_cash_requests where request_id=p_request_id and shop_id=p_shop_id and resolved_at is not null) then
    raise exception 'OFFLINE_CASH_CANCELLED' using errcode='23514';
  end if;
  select * into v_session from public.cash_sessions
  where id = p_session_id and shop_id = p_shop_id for update;
  if not found then raise exception 'CASH_SHIFT_NOT_FOUND' using errcode = 'P0002'; end if;
  select * into v_actor from shop_private.assert_cash_shift_access(
    p_shop_id, v_session.location_id, 'cash_shifts.use');
  if v_session.opened_by_membership_id <> v_actor.membership_id
    and not shop_private.has_permission(p_shop_id, 'cash_shifts.manage') then
    raise exception 'CASH_SHIFT_OWNER_REQUIRED' using errcode = '42501';
  end if;
  v_hash := md5(jsonb_build_object('session', p_session_id,
    'countedAmount', p_counted_amount, 'notes', nullif(btrim(p_notes), ''))::text);
  insert into public.cash_shift_requests
    (shop_id, operation, request_id, actor_profile_id, payload_hash)
  values (p_shop_id, 'close', p_request_id, v_actor.profile_id, v_hash) on conflict do nothing;
  select * into v_request from public.cash_shift_requests
  where shop_id = p_shop_id and operation = 'close' and request_id = p_request_id for update;
  if v_request.actor_profile_id <> v_actor.profile_id or v_request.payload_hash <> v_hash then
    raise exception 'CASH_SHIFT_REQUEST_CONFLICT' using errcode = '23505';
  end if;
  if v_request.completed_at is not null then return v_request.result_id; end if;
  if v_session.status <> 'open' then raise exception 'CASH_SHIFT_NOT_OPEN' using errcode = '55000'; end if;
  select * into v_totals from shop_private.cash_session_totals(p_session_id);
  update public.cash_sessions set status = 'closed', closing_amount = p_counted_amount,
    expected_amount = v_totals.expected_cash,
    variance_amount = p_counted_amount - v_totals.expected_cash,
    closed_by_membership_id = v_actor.membership_id, closed_at = clock_timestamp(),
    closing_notes = nullif(btrim(p_notes), '')
  where id = p_session_id;
  update public.cash_shift_requests set result_id = p_session_id,
    completed_at = clock_timestamp()
  where shop_id = p_shop_id and operation = 'close' and request_id = p_request_id;
  return p_session_id;
end;
$$;

create or replace function shop_private.replay_offline_pos_sale(
  p_request_id uuid, p_save_request_id uuid, p_issue_request_id uuid, p_payment_request_id uuid,
  p_appointment_request_id uuid, p_shop_id uuid, p_location_id uuid, p_shift_id uuid,
  p_staff_membership_id uuid, p_appointment_id uuid, p_customer_id uuid, p_notes text,
  p_lines jsonb, p_amount numeric, p_paid_at timestamptz, p_method public.payment_method, p_reference text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_existing uuid; v_actor uuid; v_payload jsonb; v_request shop_private.offline_pos_requests%rowtype;
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
  perform pg_advisory_xact_lock(hashtextextended('offline-pos:'||p_shop_id::text||':'||p_request_id::text,0));
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
  v_existing:=shop_private.offline_pos_existing_result(p_request_id,p_shop_id,v_actor,v_payload);
  if v_existing is not null then
    update shop_private.offline_pos_requests set invoice_id=v_existing,completed_at=clock_timestamp() where request_id=p_request_id;
    return v_existing;
  end if;
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
create or replace function shop_private.reconcile_offline_pos_sale(
  p_request_id uuid,p_shop_id uuid,p_location_id uuid,p_original_args jsonb,
  p_resolution_request_id uuid,p_reason text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_existing uuid; v_actor uuid; v_payload jsonb; v_request shop_private.offline_pos_requests%rowtype;
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
  perform pg_advisory_xact_lock(hashtextextended('offline-pos:'||p_shop_id::text||':'||p_request_id::text,0));
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
  v_existing:=shop_private.offline_pos_existing_result(p_request_id,p_shop_id,v_actor,v_payload);
  if v_existing is not null then
    update shop_private.offline_pos_requests set invoice_id=v_existing,completed_at=clock_timestamp() where request_id=p_request_id;
    return jsonb_build_object('state','synced','invoiceId',v_existing);
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
create or replace function shop_private.replay_offline_cash_command(p_kind text,p_shop_id uuid,p_args jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_existing uuid; v_actor uuid; v_id uuid:=(p_args->>'p_request_id')::uuid;
  v_payload jsonb; v_request shop_private.offline_cash_requests%rowtype; v_result uuid;
begin
  v_actor:=shop_private.offline_cash_actor(p_kind,p_shop_id,p_args);
  perform pg_advisory_xact_lock(hashtextextended('offline-cash:'||p_shop_id::text||':'||v_id::text,0));
  v_payload:=jsonb_build_object('kind',p_kind,'args',p_args);
  insert into shop_private.offline_cash_requests(request_id,shop_id,actor_profile_id,payload)
    values(v_id,p_shop_id,v_actor,v_payload) on conflict do nothing;
  select * into v_request from shop_private.offline_cash_requests where request_id=v_id for update;
  if v_request.shop_id<>p_shop_id or v_request.actor_profile_id<>v_actor or v_request.payload<>v_payload then
    raise exception 'OFFLINE_CASH_REQUEST_CONFLICT' using errcode='23505';
  end if;
  if v_request.completed_at is not null then return v_request.result_id; end if;
  if v_request.resolved_at is not null then raise exception 'OFFLINE_CASH_CANCELLED' using errcode='23514'; end if;
  v_existing:=shop_private.offline_cash_existing_result(p_kind,p_shop_id,p_args,v_actor);
  if v_existing is not null then
    update shop_private.offline_cash_requests set result_id=v_existing,completed_at=clock_timestamp() where request_id=v_id;
    return v_existing;
  end if;
  if p_kind='movement' then
    v_result:=shop_private.record_cash_movement(v_id,p_shop_id,(p_args->>'p_session_id')::uuid,
      p_args->>'p_kind',(p_args->>'p_amount')::numeric,p_args->>'p_reason',p_args->>'p_reference');
  else
    v_result:=shop_private.close_cash_shift(v_id,p_shop_id,(p_args->>'p_session_id')::uuid,
      (p_args->>'p_counted_amount')::numeric,p_args->>'p_notes');
  end if;
  update shop_private.offline_cash_requests set result_id=v_result,completed_at=clock_timestamp() where request_id=v_id;
  return v_result;
end;
$$;
create or replace function shop_private.reconcile_offline_cash_command(p_kind text,p_shop_id uuid,p_args jsonb,p_resolution_request_id uuid,p_reason text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_existing uuid; v_actor uuid; v_id uuid:=(p_args->>'p_request_id')::uuid;
  v_payload jsonb; v_request shop_private.offline_cash_requests%rowtype;
begin
  v_actor:=shop_private.offline_cash_actor(p_kind,p_shop_id,p_args);
  if p_resolution_request_id is null or p_reason is null or length(btrim(p_reason)) not between 10 and 2000 then
    raise exception 'INVALID_OFFLINE_RECONCILIATION' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('offline-cash:'||p_shop_id::text||':'||v_id::text,0));
  v_payload:=jsonb_build_object('kind',p_kind,'args',p_args);
  insert into shop_private.offline_cash_requests(request_id,shop_id,actor_profile_id,payload)
    values(v_id,p_shop_id,v_actor,v_payload) on conflict do nothing;
  select * into v_request from shop_private.offline_cash_requests where request_id=v_id for update;
  if v_request.shop_id<>p_shop_id or v_request.actor_profile_id<>v_actor or v_request.payload<>v_payload then
    raise exception 'OFFLINE_CASH_REQUEST_CONFLICT' using errcode='23505';
  end if;
  if v_request.completed_at is not null then return jsonb_build_object('state','synced','resultId',v_request.result_id); end if;
  v_existing:=shop_private.offline_cash_existing_result(p_kind,p_shop_id,p_args,v_actor);
  if v_existing is not null then
    update shop_private.offline_cash_requests set result_id=v_existing,completed_at=clock_timestamp() where request_id=v_id;
    return jsonb_build_object('state','synced','resultId',v_existing);
  end if;
  if v_request.resolved_at is not null then
    if v_request.resolution_request_id<>p_resolution_request_id or v_request.resolution_reason<>btrim(p_reason) then
      raise exception 'OFFLINE_RESOLUTION_CONFLICT' using errcode='23505';
    end if;
  else
    update shop_private.offline_cash_requests set resolution_request_id=p_resolution_request_id,
      resolution_reason=btrim(p_reason),resolved_at=clock_timestamp() where request_id=v_id;
  end if;
  return jsonb_build_object('state','cancelled','resolutionRequestId',p_resolution_request_id);
end;
$$;
