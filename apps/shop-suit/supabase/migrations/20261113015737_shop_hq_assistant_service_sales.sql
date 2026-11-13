begin;

create function shop_private.hq_sale_name(p_value text) returns text
language sql immutable strict set search_path = '' as $$
  select btrim(regexp_replace(translate(lower(normalize(p_value, NFKC)),
    U&'أإآٱى\0640\064B\064C\064D\064E\064F\0650\0651\0652\0653\0654\0655\0656\0657\0658\0659\065A\065B\065C\065D\065E\065F\0670',
    'ااااي'), '[[:space:]]+', ' ', 'g'));
$$;

create function shop_private.hq_sale_service_name(p_value text) returns text
language sql immutable strict set search_path = '' as $$
  select regexp_replace(replace(shop_private.hq_sale_name(p_value), 'ذقن', 'دقن'),
    '(^| )ال([^ ]{3,})', '\1\2', 'g');
$$;

create function shop_private.hq_sale_phone(p_value text) returns text
language sql immutable strict set search_path = '' as $$
  select regexp_replace(translate(p_value, '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹', '01234567890123456789'), '[^0-9]', '', 'g');
$$;

create function shop_private.hq_sale_mentions(p_message text, p_name text) returns boolean
language sql immutable strict set search_path = '' as $$
  select btrim(p_name) <> '' and position((' ' || p_name || ' ') in
    (' ' || regexp_replace(p_message, '[[:space:][:punct:]،؛؟]+', ' ', 'g') || ' ')) > 0;
$$;

-- The current owner-authored message is the source of payment evidence. The
-- model can classify it but cannot originate or substitute financial facts.
create function shop_private.hq_assistant_payment_evidence(p_message text) returns jsonb
language plpgsql immutable strict set search_path = '' as $$
declare
  v_message text := btrim(translate(shop_private.hq_sale_name(p_message),
    '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹٫', '01234567890123456789.'));
  v_payment text[];
  v_method text;
  v_currency text;
begin
  if v_message ~ '(^|[^[:alnum:]])(if|unless|whether|would|could|not|never|لو|اذا|هل|مش|لم|ما دفع)([^[:alnum:]]|$)' then
    return null;
  end if;
  v_payment := regexp_match(v_message,
    '(^|[،,.;؛!][[:space:]]*|[[:space:]]+and[[:space:]]+|[[:space:]]+و)(paid|دفع)[[:space:]]+([0-9]{1,10}([.][0-9]{1,2})?)[[:space:]]+(?:(egp|usd|جنيه|دولار)[[:space:]]+)?(?:in[[:space:]]+)?(cash|card|bank transfer|transfer|كاش|نقدا|نقدي|كارت|بطاقه|بطاقة|فيزا|تحويل بنكي|تحويل)[.!]?$');
  if v_payment is null or v_payment[3]::numeric <= 0 then return null; end if;
  v_method := case
    when v_payment[6] in ('cash','كاش','نقدا','نقدي') then 'cash'
    when v_payment[6] in ('card','كارت','بطاقه','بطاقة','فيزا') then 'card'
    else 'transfer' end;
  v_currency := case
    when v_payment[5] in ('egp','جنيه') then 'EGP'
    when v_payment[5] in ('usd','دولار') then 'USD' end;
  return jsonb_build_object('amount', v_payment[3]::numeric, 'method', v_method,
    'currency', v_currency, 'standalone', v_payment[1] = '');
end;
$$;

alter table shop_private.hq_assistant_jobs add column payment_evidence jsonb;
create function shop_private.hq_assistant_capture_payment() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' and new.messages->-1->>'role' = 'user' then
    new.payment_evidence := shop_private.hq_assistant_payment_evidence(new.messages->-1->>'content');
  elsif tg_op = 'UPDATE' and (new.state in ('revoked','expired','failed') or new.transcript_expires_at is null) then
    new.payment_evidence := null;
    delete from shop_private.hq_assistant_sale_quotes where job_id = new.id;
  end if;
  return new;
end;
$$;

create index clients_hq_sale_name_idx on public.clients (shop_id, shop_private.hq_sale_name(name)) where is_active;
create index services_hq_sale_name_idx on public.services (shop_id, shop_private.hq_sale_service_name(name)) where is_active;

-- A short payment reply can authorize only the preceding unresolved quote for
-- this same owner, shop and branch. Its scope expires with the job transcript.
create table shop_private.hq_assistant_sale_quotes (
  job_id uuid primary key references shop_private.hq_assistant_jobs (id) on delete cascade,
  customer_id uuid not null,
  service_ids uuid[] not null,
  used boolean not null default false
);
alter table shop_private.hq_assistant_sale_quotes enable row level security;
revoke all on table shop_private.hq_assistant_sale_quotes from public, anon, authenticated, service_role;
create trigger hq_assistant_capture_payment before insert or update of state, transcript_expires_at
on shop_private.hq_assistant_jobs for each row execute function shop_private.hq_assistant_capture_payment();

-- Job PII expires with the queue. The immutable invoice keeps its existing
-- audit details, and this provenance only retains the job and employee IDs.
create table shop_private.hq_assistant_sale_receipts (
  job_id uuid primary key,
  invoice_id uuid not null unique references public.sale_receipts (invoice_id) on delete restrict,
  agent_id uuid not null
);
alter table shop_private.hq_assistant_sale_receipts enable row level security;
revoke all on table shop_private.hq_assistant_sale_receipts from public, anon, authenticated, service_role;

-- The worker wrapper validates the lease before setting the owner identity.
-- Existing checkout commands apply the owner's permissions, subscription,
-- location and audit identity to the delegated transaction.
create function shop_private.hq_assistant_checkout_service_sale(p_scope jsonb) returns jsonb
language plpgsql set search_path = '' as $$
declare
  v_job_id uuid := (p_scope->>'jobId')::uuid;
  v_shop uuid := (p_scope->>'shopId')::uuid;
  v_location uuid := (p_scope->>'locationId')::uuid;
  v_intent jsonb := p_scope->'intent';
  v_payment jsonb := p_scope->'payment';
  v_message text := shop_private.hq_sale_name(p_scope->>'ownerMessage');
  v_evidence text;
  v_previous shop_private.hq_assistant_jobs%rowtype;
  v_previous_quote shop_private.hq_assistant_sale_quotes%rowtype;
  v_matches_quote boolean := false;
  v_service_mentioned boolean := true;
  v_staff uuid;
  v_customer_name text := v_intent->>'customerName';
  v_phone text := shop_private.hq_sale_phone(v_intent->>'customerPhone');
  v_currency text;
  v_service_name text;
  v_aliases text[];
  v_matches uuid[];
  v_customer uuid;
  v_services uuid[] := array[]::uuid[];
  v_lines jsonb;
  v_total numeric;
  v_amount numeric;
  v_method public.payment_method;
  v_invoice uuid;
  v_error text;
begin
  perform shop_private.assert_shop_write_access(v_shop, 'sales.manage');
  perform shop_private.assert_location_access(v_shop, v_location, true);
  if not shop_private.has_permission(v_shop, 'sales.issue') or not shop_private.has_permission(v_shop, 'payments.receive') then
    return jsonb_build_object('kind', 'sale_unavailable');
  end if;
  select current_member.membership_id into strict v_staff from shop_private.current_shop_membership(v_shop) current_member;
  select shop.business_currency into strict v_currency from public.shops shop
  where shop.id = v_shop and shop.business_mode in ('service','mixed');

  select prior.* into v_previous from shop_private.hq_assistant_jobs current_job
  join shop_private.hq_assistant_jobs prior on prior.actor_id = current_job.actor_id
    and prior.shop_id = current_job.shop_id and prior.location_id = current_job.location_id
    and prior.consent_generation = current_job.consent_generation and prior.created_at < current_job.created_at
  where current_job.id = v_job_id
  order by prior.created_at desc, prior.id desc limit 1;
  if v_previous.transcript_expires_at > clock_timestamp() then
    select * into v_previous_quote from shop_private.hq_assistant_sale_quotes
    where job_id = v_previous.id and not used;
  end if;

  v_evidence := v_message;
  if v_previous.transcript_expires_at > clock_timestamp() and v_previous.updates @> '[{"kind":"clarification"}]'::jsonb
    and not v_previous.updates @> '[{"kind":"receipt"}]'::jsonb
    and jsonb_typeof(v_payment) is distinct from 'object' then
    v_evidence := v_message || ' ' || shop_private.hq_sale_name(v_previous.owner_message);
  end if;
  -- A model-proposed phone can only narrow the customer lookup when the owner
  -- supplied those digits in the actual request or immediate clarification.
  if v_phone is not null and (length(v_phone) < 7 or not (
    exists (select 1 from regexp_matches(v_evidence, '[+0-9٠-٩۰-۹][0-9٠-٩۰-۹()+ .-]{5,31}[0-9٠-٩۰-۹]', 'g') as phone(parts)
      where shop_private.hq_sale_phone(parts[1]) = v_phone)
  )) then
    v_phone := null;
  end if;

  select array_agg(candidate.id) into v_matches from (
    select customer.id from public.clients customer
    where customer.shop_id = v_shop and customer.is_active
      and shop_private.hq_sale_name(customer.name) = shop_private.hq_sale_name(v_customer_name)
      and (v_phone is null or (length(v_phone) >= 7 and shop_private.hq_sale_phone(customer.phone) = v_phone))
    order by customer.id limit 2 for share
  ) candidate;
  if v_matches is null then
    return jsonb_build_object('kind', 'customer_missing', 'query', v_customer_name);
  elsif cardinality(v_matches) <> 1 then
    return jsonb_build_object('kind', 'customer_ambiguous', 'query', v_customer_name);
  end if;
  v_customer := v_matches[1];

  for v_service_name in select jsonb_array_elements_text(v_intent->'services') loop
    v_aliases := case shop_private.hq_sale_service_name(v_service_name)
      when 'شعر' then array['شعر','قص شعر','حلاقة شعر']
      when 'دقن' then array['دقن','قص دقن','حلاقة دقن','تهذيب دقن']
      else array[shop_private.hq_sale_service_name(v_service_name)] end;
    v_service_mentioned := v_service_mentioned and exists (
      select 1 from unnest(v_aliases) alias(name)
      where shop_private.hq_sale_mentions(shop_private.hq_sale_service_name(v_evidence), alias.name)
        or shop_private.hq_sale_mentions(shop_private.hq_sale_service_name(v_evidence), 'و' || alias.name)
    );
    select array_agg(candidate.id) into v_matches from (
      select service.id from public.services service
      where service.shop_id = v_shop and service.is_active
        and shop_private.hq_sale_service_name(service.name) = any(v_aliases)
      order by service.id limit 2 for share
    ) candidate;
    if v_matches is null then
      return jsonb_build_object('kind', 'service_missing', 'query', v_service_name);
    elsif cardinality(v_matches) <> 1 or v_matches[1] = any(v_services) then
      return jsonb_build_object('kind', 'service_ambiguous', 'query', v_service_name);
    end if;
    v_services := array_append(v_services, v_matches[1]);
  end loop;

  select jsonb_agg(jsonb_build_object('item_type', 'service', 'source_id', service.id, 'quantity', 1) order by service.position)
    into v_lines from unnest(v_services) with ordinality service(id, position);
  v_total := (public.quote_customer_sale(v_shop, v_location, v_customer, v_lines)->>'total')::numeric;
  if v_total is null or v_total <= 0 then return jsonb_build_object('kind', 'sale_unavailable'); end if;

  v_matches_quote := v_previous_quote.job_id is not null and v_previous_quote.customer_id = v_customer
    and v_previous_quote.service_ids @> v_services and v_previous_quote.service_ids <@ v_services;
  if coalesce(v_payment->'standalone', 'false'::jsonb) = 'true'::jsonb then
    if not v_matches_quote then return jsonb_build_object('kind', 'sale_details_required'); end if;
  elsif not coalesce(v_service_mentioned, false)
    or not coalesce(shop_private.hq_sale_mentions(v_evidence, shop_private.hq_sale_name(v_customer_name)), false) then
    return jsonb_build_object('kind', 'sale_details_required');
  end if;

  insert into shop_private.hq_assistant_sale_quotes (job_id, customer_id, service_ids)
  values (v_job_id, v_customer, v_services) on conflict (job_id) do nothing;

  if jsonb_typeof(v_payment) is distinct from 'object'
    or v_intent->'paymentReceived' is distinct from 'true'::jsonb
    or v_intent->'paidAmount' is distinct from v_payment->'amount'
    or v_intent->'paymentMethod' is distinct from v_payment->'method'
    or (v_payment->>'currency' is not null and v_payment->>'currency' <> v_currency) then
    return jsonb_build_object('kind', 'payment_missing', 'total', v_total, 'currency', v_currency);
  end if;
  v_amount := (v_payment->>'amount')::numeric;
  if v_amount <> v_total then
    return jsonb_build_object('kind', 'amount_mismatch', 'total', v_total, 'currency', v_currency);
  end if;
  v_method := (case v_payment->>'method' when 'transfer' then 'bank_transfer' else v_payment->>'method' end)::public.payment_method;

  begin
    perform shop_private.assert_sale_cash_shift(v_shop, v_location);
    v_invoice := shop_private.save_pos_sale_draft(gen_random_uuid(), v_shop, v_location,
      null, v_staff, null, v_customer, null, v_lines);
    perform shop_private.checkout_pos_sale(gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
      null, v_shop, v_location, v_invoice, v_amount, statement_timestamp(), v_method, null);
  exception when check_violation then
    get stacked diagnostics v_error = message_text;
    if v_error = 'SALE_OPEN_CASH_SHIFT_REQUIRED' then return jsonb_build_object('kind', 'cash_shift_required'); end if;
    if v_error = 'POS_CHECKOUT_REQUIRES_FULL_PAYMENT' then return jsonb_build_object('kind', 'sale_unavailable'); end if;
    raise;
  end;
  if not exists (select 1 from public.sale_receipts receipt
    where receipt.invoice_id = v_invoice and receipt.shop_id = v_shop and receipt.location_id = v_location) then
    raise exception 'SHOP_HQ_ASSISTANT_RECEIPT_MISSING';
  end if;
  update shop_private.hq_assistant_sale_quotes set used = true
  where job_id = v_job_id or (v_matches_quote and job_id = v_previous_quote.job_id);
  return jsonb_build_object('kind', 'receipt', 'invoiceId', v_invoice);
exception
  when insufficient_privilege or no_data_found then
    return jsonb_build_object('kind', 'sale_unavailable');
end;
$$;

create function public.shop_hq_assistant_execute_sale(p_job_id uuid, p_lease_token uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_scope jsonb := shop_private.assert_shop_hq_sale_job(p_job_id, p_lease_token);
  v_actor text := v_scope->>'actorId';
  v_previous_sub text := current_setting('request.jwt.claim.sub', true);
  v_previous_claims text := current_setting('request.jwt.claims', true);
  v_invoice uuid;
  v_outcome jsonb;
begin
  if jsonb_typeof(v_scope->'priorOutcome') = 'object' then return v_scope->'priorOutcome'; end if;
  select sale.invoice_id into v_invoice from shop_private.hq_assistant_sale_receipts sale where sale.job_id = p_job_id;
  if found then return jsonb_build_object('kind', 'receipt', 'invoiceId', v_invoice); end if;
  -- Exceptions automatically roll these transaction-local settings back to the
  -- caller identity. On success restore the worker before publishing updates.
  begin
    perform set_config('request.jwt.claim.sub', v_actor, true);
    perform set_config('request.jwt.claims', jsonb_build_object('sub', v_actor, 'role', 'authenticated', 'is_anonymous', false)::text, true);
    v_outcome := shop_private.hq_assistant_checkout_service_sale(v_scope || jsonb_build_object('jobId', p_job_id));
    perform set_config('request.jwt.claim.sub', coalesce(v_previous_sub, ''), true);
    perform set_config('request.jwt.claims', coalesce(v_previous_claims, ''), true);
  exception when others then
    raise;
  end;
  if v_outcome->>'kind' = 'receipt' then
    v_invoice := (v_outcome->>'invoiceId')::uuid;
    insert into shop_private.hq_assistant_sale_receipts (job_id, invoice_id, agent_id)
    values (p_job_id, v_invoice, (v_scope->>'agentId')::uuid);
    perform shop_private.hq_assistant_append_receipt(p_job_id, v_invoice);
  else
    perform shop_private.hq_assistant_close_sale_attempt(p_job_id, v_outcome);
  end if;
  return v_outcome;
end;
$$;

revoke all on function shop_private.hq_sale_name(text), shop_private.hq_sale_service_name(text),
  shop_private.hq_sale_phone(text), shop_private.hq_sale_mentions(text, text), shop_private.hq_assistant_payment_evidence(text),
  shop_private.hq_assistant_capture_payment(), shop_private.hq_assistant_checkout_service_sale(jsonb),
  public.shop_hq_assistant_execute_sale(uuid, uuid) from public, anon, authenticated, service_role;
grant execute on function public.shop_hq_assistant_execute_sale(uuid, uuid) to authenticated;
notify pgrst, 'reload schema';
commit;
