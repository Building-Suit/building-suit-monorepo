-- Synthetic shops and users; the SQL runners roll back the entire fixture.
create temporary table hq_service_fixture as
select gen_random_uuid() owner_id, gen_random_uuid() worker_id, gen_random_uuid() other_worker_id;

insert into auth.users (id, email, encrypted_password, aud, role, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select actor, actor::text || '@hq-sale.invalid', 'x', 'authenticated', 'authenticated', now(), '{}', '{}', now(), now()
from hq_service_fixture, unnest(array[owner_id, worker_id, other_worker_id]) person(actor);

insert into shop_private.hq_assistant_workers(auth_user_id, enabled, queue_enabled)
select actor, true, true from hq_service_fixture, unnest(array[worker_id, other_worker_id]) person(actor);

select set_config('hq_sale.owner', owner_id::text, true), set_config('hq_sale.worker', worker_id::text, true),
  set_config('hq_sale.other_worker', other_worker_id::text, true) from hq_service_fixture;

do $$
begin
  if shop_private.hq_assistant_payment_evidence('paid 300 cash') is distinct from
    '{"amount":300,"method":"cash","currency":null,"standalone":true}'::jsonb
    or shop_private.hq_assistant_payment_evidence('عميل اسمه احمد محمد عمل شعر ودقن ودفع ٣٠٠ كاش') is distinct from
    '{"amount":300,"method":"cash","currency":null,"standalone":false}'::jsonb
    or shop_private.hq_assistant_payment_evidence('دفع ١٥٠٫٥٠ جنيه تحويل بنكي') is distinct from
    '{"amount":150.5,"method":"transfer","currency":"EGP","standalone":true}'::jsonb
    or shop_private.hq_assistant_payment_evidence('If paid 300 cash') is not null
    or shop_private.hq_assistant_payment_evidence('لم يدفع، دفع ٣٠٠ كاش') is not null
    or shop_private.hq_assistant_payment_evidence('paid 300 cash?') is not null
    or shop_private.hq_assistant_payment_evidence('paid 300.123 cash') is not null then
    raise exception 'Owner payment assertion parsing failed';
  end if;
  if has_function_privilege('anon', 'public.shop_hq_assistant_execute_sale(uuid,uuid)', 'execute')
    or has_function_privilege('service_role', 'public.shop_hq_assistant_execute_sale(uuid,uuid)', 'execute')
    or has_function_privilege('authenticated', 'shop_private.hq_assistant_checkout_service_sale(jsonb)', 'execute')
    or has_table_privilege('authenticated', 'shop_private.hq_assistant_sale_quotes', 'select')
    or has_table_privilege('authenticated', 'shop_private.hq_assistant_sale_receipts', 'select') then
    raise exception 'Sale authorization or private storage was exposed';
  end if;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true),
  set_config('request.jwt.claim.sub', current_setting('hq_sale.owner'), true),
  set_config('request.jwt.claims', jsonb_build_object('sub',current_setting('hq_sale.owner'),'role','authenticated')::text,true);

do $$
declare
  v_owner text := current_setting('hq_sale.owner');
  v_worker text := current_setting('hq_sale.worker');
  v_other_worker text := current_setting('hq_sale.other_worker');
  v_shop uuid := public.create_owner_shop('HQ service sale fixture', 'service'::public.business_mode);
  v_location uuid;
  v_customer uuid;
  v_job uuid;
  v_lease uuid;
  v_invoice uuid;
  v_result jsonb;
  v_messages jsonb;
  v_original jsonb := '[{"role":"user","content":"عميل اسمه احمد محمد عمل شعر ودقن"}]';
  v_intent jsonb := '{"kind":"service_sale","customerName":"احمد محمد","customerPhone":null,"services":["شعر","دقن"],"paymentMethod":"cash","paidAmount":300,"paymentReceived":true,"reply":"حاضر، هراجع طلبك."}';
  v_case integer;
  v_expected text;
  v_amount numeric;
begin
  select id into strict v_location from public.shop_locations where shop_id = v_shop and is_default;
  v_customer := public.save_customer(v_shop, null, 'أحمد مُحمد', '01000000000', null, null, null);
  perform public.save_service(v_shop, null, 'قص الشعر', null, 220, 'amount', 20);
  perform public.save_service(v_shop, null, 'تهذيب الذقن', null, 100, 'amount', 0);
  perform public.save_service(v_shop, null, 'صبغة شعر', null, 100, 'amount', 0);
  perform public.shop_hq_assistant_authorize(v_shop, true);
  perform public.set_shop_cash_policy(v_shop, true);

  -- Each real worker job publishes the owner-visible reply, executes the
  -- delegated action, and enters head review independently of owner polling.
  for v_case in 1..7 loop
    v_expected := (array['payment_missing','amount_mismatch','cash_shift_required','receipt','sale_details_required','service_missing','receipt'])[v_case];
    v_amount := case when v_case = 2 then 290 else 300 end;
    v_messages := case v_case
      when 1 then v_original
      when 2 then v_original || '[{"role":"user","content":"دفع ٢٩٠ كاش"}]'::jsonb
      when 3 then v_original || '[{"role":"user","content":"دفع ٣٠٠ كاش"}]'::jsonb
      when 4 then v_original || '[{"role":"user","content":"دفع ٣٠٠ كاش"}]'::jsonb
      when 5 then v_original || '[{"role":"user","content":"دفع ٣٠٠ كاش"}]'::jsonb
      when 6 then '[{"role":"user","content":"عميل اسمه احمد محمد عمل تنظيف بشره ودفع ٣٠٠ كاش"}]'::jsonb
      else '[{"role":"user","content":"عميل اسمه احمد محمد عمل شعر ودقن ودفع ٣٠٠ كاش"}]'::jsonb end;
    if v_case = 4 then perform public.open_cash_shift(gen_random_uuid(), v_shop, v_location, 'main', 0); end if;
    v_job := (public.shop_hq_assistant_enqueue(v_shop, v_location, gen_random_uuid(), v_messages)->>'jobId')::uuid;
    perform set_config('request.jwt.claim.sub', v_worker, true);
    perform set_config('request.jwt.claims', jsonb_build_object('sub',v_worker,'role','authenticated')::text,true);
    if public.shop_hq_assistant_dispatch()->>'jobId' is distinct from v_job::text then raise exception 'Worker did not dispatch correct job'; end if;
    v_lease := (public.shop_hq_assistant_claim()->>'leaseToken')::uuid;
    if not public.shop_hq_assistant_finish(v_job, v_lease, v_intent || jsonb_build_object('paidAmount',v_amount,
      'services',case when v_case = 6 then '["تنظيف بشره"]'::jsonb else v_intent->'services' end), true) then
      raise exception 'Employee finish failed';
    end if;
    if v_case = 4 then
      perform set_config('request.jwt.claim.sub', v_other_worker, true);
      perform set_config('request.jwt.claims', jsonb_build_object('sub',v_other_worker,'role','authenticated')::text,true);
      begin
        perform public.shop_hq_assistant_execute_sale(v_job, v_lease);
        raise exception 'Different worker executed a leased sale';
      exception when insufficient_privilege then null; end;
      perform set_config('request.jwt.claim.sub', v_worker, true);
      perform set_config('request.jwt.claims', jsonb_build_object('sub',v_worker,'role','authenticated')::text,true);
    end if;
    v_result := public.shop_hq_assistant_execute_sale(v_job, v_lease);
    if v_result->>'kind' is distinct from v_expected or auth.uid()::text is distinct from v_worker
      or auth.jwt()->>'sub' is distinct from v_worker then
      raise exception 'Service sale outcome or claim restoration failed, expected %, got %', v_expected, v_result->>'kind';
    end if;
    if v_expected = 'receipt' then
      v_invoice := (v_result->>'invoiceId')::uuid;
      if v_result is distinct from public.shop_hq_assistant_execute_sale(v_job, v_lease) then
        raise exception 'Same-fence retry did not return original receipt';
      end if;
    end if;
    v_lease := (public.shop_hq_assistant_review_claim()->0->>'leaseToken')::uuid;
    if not public.shop_hq_assistant_review_finish(v_job, v_lease, true, null) then raise exception 'Head review failed'; end if;
    perform set_config('request.jwt.claim.sub', v_owner, true);
    perform set_config('request.jwt.claims', jsonb_build_object('sub',v_owner,'role','authenticated')::text,true);
    if v_expected = 'receipt' then
      if not (public.shop_hq_assistant_job(v_shop,v_location,v_job)->'updates' @> jsonb_build_array(v_result)) then
        raise exception 'Owner chat did not retain the receipt';
      end if;
      v_result := public.get_location_sale_receipt(v_shop, v_location, v_invoice);
      if (v_result->>'total')::numeric is distinct from 300::numeric
        or v_result #>> '{payments,0,method}' is distinct from 'cash'
        or jsonb_array_length(v_result->'lines') is distinct from 2 then
        raise exception 'Issued receipt does not contain correct services, price and payment';
      end if;
    end if;
    if (select count(*) from public.invoices where shop_id = v_shop) <> (case when v_case = 7 then 2 when v_case >= 4 then 1 else 0 end)
      or (select count(*) from public.payments where shop_id = v_shop) <> (case when v_case = 7 then 2 when v_case >= 4 then 1 else 0 end) then
      raise exception 'Failed or replayed sale created a draft, invoice or duplicate payment';
    end if;
  end loop;
  if (select invoice.client_id from public.invoices invoice where invoice.id = v_invoice) is distinct from v_customer then
    raise exception 'Issued sale did not use the authorized matching customer';
  end if;
  perform set_config('hq_sale.test_shop', v_shop::text, true);
  perform public.shop_hq_assistant_authorize(v_shop, false);
end;
$$;
reset role;

do $$
declare v_shop uuid := current_setting('hq_sale.test_shop')::uuid;
begin
  if exists (select 1 from shop_private.hq_assistant_jobs job where job.shop_id = v_shop and job.payment_evidence is not null)
    or exists (select 1 from shop_private.hq_assistant_sale_quotes quote
      join shop_private.hq_assistant_jobs job on job.id = quote.job_id where job.shop_id = v_shop) then
    raise exception 'Revocation did not clear payment evidence and temporary quotes';
  end if;
  if (select count(*) from shop_private.hq_assistant_sale_receipts sale
    join public.sale_receipts receipt on receipt.invoice_id = sale.invoice_id where receipt.shop_id = v_shop) <> 2 then
    raise exception 'Revocation changed the audit of successfully issued sales';
  end if;
end;
$$;
