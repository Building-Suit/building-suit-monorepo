-- SS-LAUNCH-D09: draft, issue, payment and receipt commit as one command.
-- Requests are private; callers cannot manufacture a completed replay.
create table shop_private.fast_pay_requests (
  shop_id uuid not null references public.shops(id),
  request_id uuid not null,
  actor_profile_id uuid not null references public.profiles(id),
  payload jsonb not null,
  save_request_id uuid not null default gen_random_uuid(),
  issue_request_id uuid not null default gen_random_uuid(),
  payment_request_id uuid not null default gen_random_uuid(),
  invoice_id uuid,
  created_at timestamptz not null default clock_timestamp(),
  completed_at timestamptz,
  primary key (shop_id, request_id),
  foreign key (invoice_id, shop_id) references public.invoices(id, shop_id)
);
alter table shop_private.fast_pay_requests enable row level security;
revoke all on shop_private.fast_pay_requests from public, anon, authenticated, service_role;

create function shop_private.fast_pay_location_sale(
  p_request_id uuid, p_shop_id uuid, p_location_id uuid, p_invoice_id uuid,
  p_customer_id uuid, p_due_date date, p_notes text, p_lines jsonb,
  p_amount numeric, p_paid_at timestamptz, p_method public.payment_method, p_reference text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid;
  v_payload jsonb;
  v_request shop_private.fast_pay_requests%rowtype;
  v_invoice uuid;
  v_total numeric;
begin
  v_actor := shop_private.assert_shop_write_access(p_shop_id, 'sales.issue');
  perform shop_private.assert_shop_write_access(p_shop_id, 'sales.manage');
  perform shop_private.assert_shop_write_access(p_shop_id, 'payments.receive');
  perform shop_private.assert_location_access(p_shop_id, p_location_id, true);
  if p_request_id is null or p_amount is null or p_amount <= 0
    or round(p_amount, 2) <> p_amount or p_paid_at is null or p_method is null
    or length(coalesce(p_reference, '')) > 200 then
    raise exception 'INVALID_FAST_PAY' using errcode = '22023';
  end if;
  v_payload := jsonb_build_object('location', p_location_id, 'invoice', p_invoice_id,
    'customer', p_customer_id, 'dueDate', p_due_date, 'notes', nullif(btrim(p_notes), ''),
    'lines', p_lines, 'amount', p_amount, 'paidAt', p_paid_at,
    'method', p_method, 'reference', nullif(btrim(p_reference), ''));
  insert into shop_private.fast_pay_requests(shop_id, request_id, actor_profile_id, payload)
    values (p_shop_id, p_request_id, v_actor, v_payload) on conflict do nothing;
  select * into v_request from shop_private.fast_pay_requests
    where shop_id = p_shop_id and request_id = p_request_id for update;
  if v_request.actor_profile_id <> v_actor or v_request.payload <> v_payload then
    raise exception 'FAST_PAY_REQUEST_CONFLICT' using errcode = '23505';
  end if;
  -- Successful retries return before touching the issued sale or current shift.
  if v_request.invoice_id is not null then return v_request.invoice_id; end if;
  v_invoice := shop_private.save_location_sale_draft(v_request.save_request_id,
    p_shop_id, p_location_id, p_invoice_id, p_customer_id, p_due_date, p_notes, p_lines);
  perform set_config('shop.location_id', p_location_id::text, true);
  if p_customer_id is null then
    perform shop_private.checkout_customerless_sale(v_request.payment_request_id,
      p_shop_id, v_invoice, p_amount, p_paid_at, p_method, p_reference);
  else
    perform shop_private.issue_sale(v_request.issue_request_id, p_shop_id, v_invoice);
    select total_amount into v_total from public.invoices where id = v_invoice;
    if v_total <> p_amount then
      raise exception 'FAST_PAY_REQUIRES_FULL_PAYMENT' using errcode = '23514';
    end if;
    perform shop_private.record_customer_receipt(v_request.payment_request_id,
      p_shop_id, p_customer_id, v_total, p_paid_at, p_method, p_reference, null,
      jsonb_build_array(jsonb_build_object('invoice_id', v_invoice, 'amount', v_total)));
  end if;
  update shop_private.fast_pay_requests set invoice_id = v_invoice, completed_at = clock_timestamp()
    where shop_id = p_shop_id and request_id = p_request_id;
  return v_invoice;
end;
$$;

create function public.fast_pay_location_sale(
  p_request_id uuid, p_shop_id uuid, p_location_id uuid, p_invoice_id uuid,
  p_customer_id uuid, p_due_date date, p_notes text, p_lines jsonb,
  p_amount numeric, p_paid_at timestamptz, p_method public.payment_method, p_reference text
) returns uuid language sql security definer set search_path = '' as $$
  select shop_private.fast_pay_location_sale(p_request_id, p_shop_id, p_location_id,
    p_invoice_id, p_customer_id, p_due_date, p_notes, p_lines, p_amount, p_paid_at, p_method, p_reference);
$$;
revoke all on function shop_private.fast_pay_location_sale(uuid,uuid,uuid,uuid,uuid,date,text,jsonb,numeric,timestamptz,public.payment_method,text)
  from public, anon, authenticated, service_role;
revoke all on function public.fast_pay_location_sale(uuid,uuid,uuid,uuid,uuid,date,text,jsonb,numeric,timestamptz,public.payment_method,text)
  from public, anon, authenticated, service_role;
grant execute on function public.fast_pay_location_sale(uuid,uuid,uuid,uuid,uuid,date,text,jsonb,numeric,timestamptz,public.payment_method,text)
  to authenticated;
