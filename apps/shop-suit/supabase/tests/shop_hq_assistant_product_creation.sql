-- The Shop SQL runner rolls back the synthetic users, jobs and catalogue.
create temporary table hq_product_fixture as
select gen_random_uuid() owner_id, gen_random_uuid() worker_id, gen_random_uuid() other_worker_id;

insert into auth.users (id,email,encrypted_password,aud,role,email_confirmed_at,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select actor,actor::text || '@assistant-product.invalid','x','authenticated','authenticated',now(),'{}','{}',now(),now()
from hq_product_fixture,unnest(array[owner_id,worker_id,other_worker_id]) as person(actor);

insert into shop_private.hq_assistant_workers(auth_user_id,enabled,queue_enabled)
select worker,true,true from hq_product_fixture,unnest(array[worker_id,other_worker_id]) as person(worker);

select set_config('hq_product.owner',owner_id::text,true),set_config('hq_product.worker',worker_id::text,true),
  set_config('hq_product.other_worker',other_worker_id::text,true) from hq_product_fixture;
select set_config('request.jwt.claim.role','authenticated',true),
  set_config('request.jwt.claim.sub',current_setting('hq_product.owner'),true);

set local role authenticated;
do $$
declare
  v_owner text := current_setting('hq_product.owner');
  v_worker text := current_setting('hq_product.worker');
  v_other_worker text := current_setting('hq_product.other_worker');
  v_shop uuid := public.create_owner_shop('Assistant catalogue fixture','service'::public.business_mode);
  v_location uuid := (select id from public.shop_locations where shop_id = v_shop and is_default);
  v_job uuid;
  v_lease uuid;
  v_claim jsonb;
  v_review jsonb;
  v_product uuid;
  v_result jsonb;
  v_intent jsonb := '{
    "kind":"create_product","product":{"name":"Kids Backpack","salePrice":null},
    "customerName":null,"customerPhone":null,"services":[],"paymentMethod":null,
    "paidAmount":null,"paymentReceived":false,"reply":"Unverified model success","links":[]
  }';
begin
  if has_function_privilege('anon','public.shop_hq_assistant_shop_context(uuid,uuid)','EXECUTE')
    or has_function_privilege('service_role','public.shop_hq_assistant_shop_context(uuid,uuid)','EXECUTE') then
    raise exception 'Shop context exposed to a role outside the queue';
  end if;

  perform public.shop_hq_assistant_authorize(v_shop,true);
  v_job := (public.shop_hq_assistant_send(v_shop,v_location,gen_random_uuid(),'Add a Kids Backpack')->>'jobId')::uuid;
  perform set_config('request.jwt.claim.sub',v_worker,true);
  perform public.shop_hq_assistant_dispatch();
  v_claim := public.shop_hq_assistant_claim();
  v_lease := (v_claim->>'leaseToken')::uuid;
  if v_claim->>'jobId' is distinct from v_job::text then raise exception 'Unexpected product lease'; end if;
  if public.shop_hq_assistant_shop_context(v_job,v_lease) is distinct from
    '{"businessMode":"service","businessCurrency":"EGP","productsEnabled":false}'::jsonb then raise exception 'Service-only mode was not returned'; end if;

  perform set_config('request.jwt.claim.sub',v_other_worker,true);
  begin
    perform public.shop_hq_assistant_shop_context(v_job,v_lease);
    raise exception 'Other worker read the shop context';
  exception when insufficient_privilege then null;
  end;
  if public.shop_hq_assistant_finish(v_job,v_lease,v_intent,true) then
    raise exception 'Other worker could write to the catalogue';
  end if;

  perform set_config('request.jwt.claim.sub',v_owner,true);
  begin
    perform public.shop_hq_assistant_shop_context(v_job,v_lease);
    raise exception 'Owner could call the worker context endpoint';
  exception when insufficient_privilege then null;
  end;
  perform set_config('request.jwt.claim.sub',v_worker,true);
  begin
    perform public.shop_hq_assistant_shop_context(v_job,gen_random_uuid());
    raise exception 'Wrong lease could read the shop context';
  exception when insufficient_privilege then null;
  end;
  if not public.shop_hq_assistant_finish(v_job,v_lease,v_intent,true) then
    raise exception 'Service-only job did not close';
  end if;

  perform set_config('request.jwt.claim.sub',v_owner,true);
  v_result := public.shop_hq_assistant_job(v_shop,v_location,v_job);
  if v_result->>'state' is distinct from 'failed' or v_result->'updates' is distinct from '[]'::jsonb
    or exists (select 1 from public.products where shop_id = v_shop) then
    raise exception 'Service-only shop reported or wrote a product';
  end if;
  perform public.set_shop_business_mode(v_shop,'mixed');
  v_job := (public.shop_hq_assistant_send(v_shop,v_location,gen_random_uuid(),'Add a Kids Backpack')->>'jobId')::uuid;
  perform set_config('request.jwt.claim.sub',v_worker,true);
  perform public.shop_hq_assistant_dispatch();
  v_lease := (public.shop_hq_assistant_claim()->>'leaseToken')::uuid;
  if public.shop_hq_assistant_shop_context(v_job,v_lease) is distinct from
    '{"businessMode":"mixed","businessCurrency":"EGP","productsEnabled":true}'::jsonb then raise exception 'Live mode was not returned'; end if;
  if not public.shop_hq_assistant_finish(v_job,v_lease,v_intent,true)
    or not public.shop_hq_assistant_finish(v_job,v_lease,v_intent,true)
    or public.shop_hq_assistant_finish(v_job,v_lease,jsonb_set(v_intent,'{product,salePrice}','20'),true) then
    raise exception 'Finish was not idempotent for the exact result';
  end if;
  if auth.uid()::text is distinct from v_worker then
    raise exception 'Catalogue write leaked the owner claims into the worker session';
  end if;

  v_review := public.shop_hq_assistant_review_claim()->0;
  v_product := (v_review#>>'{outcome,productId}')::uuid;
  if v_product is null or v_review#>>'{outcome,kind}' is distinct from 'product'
    or not public.shop_hq_assistant_review_finish(v_job,(v_review->>'leaseToken')::uuid,false,'Review the product')
  then raise exception 'Supervisor did not receive the committed outcome'; end if;
  v_claim := public.shop_hq_assistant_claim();
  if (v_claim#>>'{outcome,productId}')::uuid is distinct from v_product
    or not public.shop_hq_assistant_finish(v_job,(v_claim->>'leaseToken')::uuid,v_intent,true)
  then raise exception 'Correction could not preserve the committed outcome'; end if;
  v_review := public.shop_hq_assistant_review_claim()->0;
  if not public.shop_hq_assistant_review_finish(v_job,(v_review->>'leaseToken')::uuid,true,null) then
    raise exception 'Supervisor could not close the reviewed product';
  end if;

  perform set_config('request.jwt.claim.sub',v_owner,true);
  if (select count(*) from public.products where shop_id = v_shop) <> 1
    or not exists (select 1 from public.products where id = v_product and shop_id = v_shop
      and name = 'Kids Backpack' and price_pending and sale_price = 0 and sku is null and barcode is null
      and is_active and category_id is null)
    or exists (select 1 from public.inventory_batches where product_id = v_product) then
    raise exception 'Name-only product did not use the expected catalogue and stock defaults';
  end if;
  v_result := public.shop_hq_assistant_history(v_shop,v_location);
  if (select count(*) from jsonb_array_elements(v_result->'messages') message
      where message->>'jobId' = v_job::text and message->>'role' = 'assistant') <> 1
    or not (v_result->'messages' @> jsonb_build_array(jsonb_build_object(
      'jobId',v_job,'kind','product','role','assistant','link',jsonb_build_object(
        'destination','product','productId',v_product,'name','Kids Backpack','pricePending',true)))) then
    raise exception 'History did not contain exactly one committed, linked product response';
  end if;
  if not (public.list_products(v_shop,'Backpack')->'items' @> jsonb_build_array(
    jsonb_build_object('id',v_product,'price_pending',true))) then
    raise exception 'The pending-price product is not editable in the catalogue';
  end if;
  if public.pos_catalog_search(v_shop,v_location,'Backpack')->'items' is distinct from '[]'::jsonb then
    raise exception 'The pending-price product was advertised in checkout';
  end if;
  perform set_config('hq_product.shop',v_shop::text,true);
  perform set_config('hq_product.id',v_product::text,true);
  perform set_config('hq_product.location',v_location::text,true);
end;
$$;
reset role;

do $$
declare
  v_shop uuid := current_setting('hq_product.shop')::uuid;
  v_product uuid := current_setting('hq_product.id')::uuid;
begin
  begin
    perform shop_private.resolve_measured_line(v_shop,v_product,'{}');
    raise exception 'A pending-price product could be quoted';
  exception when check_violation then
    if sqlerrm <> 'PRODUCT_PRICE_REQUIRED' then raise; end if;
  end;
  begin
    insert into public.invoice_items (shop_id,product_id) values (v_shop,v_product);
    raise exception 'A pending-price product could enter an invoice directly';
  exception when check_violation then
    if sqlerrm <> 'PRODUCT_PRICE_REQUIRED' then raise; end if;
  end;
end;
$$;

set local role authenticated;
do $$
declare
  v_shop uuid := current_setting('hq_product.shop')::uuid;
  v_product uuid := current_setting('hq_product.id')::uuid;
  v_location uuid := current_setting('hq_product.location')::uuid;
  v_job uuid;
  v_lease uuid;
  v_intent jsonb := '{
    "kind":"create_product","product":{"name":"حقيبة أطفال","salePrice":350},
    "customerName":null,"customerPhone":null,"services":[],"paymentMethod":null,
    "paidAmount":null,"paymentReceived":false,"reply":"Recorded."
  }';
begin
  perform public.save_product_with_category(v_shop,v_product,'Kids Backpack',null,null,0,null);
  if (select price_pending from public.products where id = v_product)
    or not (public.pos_catalog_search(v_shop,v_location,'Backpack')->'items' @> jsonb_build_array(
      jsonb_build_object('id',v_product,'unitPrice',0))) then
    raise exception 'Explicit zero price did not publish the product';
  end if;

  v_job := (public.shop_hq_assistant_send(v_shop,v_location,gen_random_uuid(),'ضيف منتج حقيبة أطفال بسعر ٣٥٠ جنيه')->>'jobId')::uuid;
  perform set_config('request.jwt.claim.sub',current_setting('hq_product.worker'),true);
  perform public.shop_hq_assistant_dispatch();
  v_lease := (public.shop_hq_assistant_claim()->>'leaseToken')::uuid;
  if not public.shop_hq_assistant_finish(v_job,v_lease,v_intent,true) then
    raise exception 'Could not commit explicitly priced product';
  end if;

  perform set_config('request.jwt.claim.sub',current_setting('hq_product.owner'),true);
  if not exists (select 1 from public.products where shop_id = v_shop and name = 'حقيبة أطفال'
    and sale_price = 350 and not price_pending) then
    raise exception 'Arabic owner price was not saved';
  end if;
  v_job := (public.shop_hq_assistant_send(v_shop,v_location,gen_random_uuid(),'Add a Kids Lunchbox')->>'jobId')::uuid;
  perform set_config('request.jwt.claim.sub',current_setting('hq_product.worker'),true);
  perform public.shop_hq_assistant_dispatch();
  v_lease := (public.shop_hq_assistant_claim()->>'leaseToken')::uuid;
  if not public.shop_hq_assistant_finish(v_job,v_lease,jsonb_set(v_intent,'{product,name}','"Kids Lunchbox"'),true) then
    raise exception 'Could not settle rejected unverified-price attempt';
  end if;

  perform set_config('request.jwt.claim.sub',current_setting('hq_product.owner'),true);
  if exists (select 1 from public.products where shop_id = v_shop and name = 'Kids Lunchbox') then
    raise exception 'Assistant supplied an unverified price must reject the write';
  end if;
  v_job := (public.shop_hq_assistant_send(v_shop,v_location,gen_random_uuid(),'Add a Kids Lunchbox')->>'jobId')::uuid;
  perform set_config('request.jwt.claim.sub',current_setting('hq_product.worker'),true);
  perform public.shop_hq_assistant_dispatch();
  v_lease := (public.shop_hq_assistant_claim()->>'leaseToken')::uuid;
  perform set_config('request.jwt.claim.sub',current_setting('hq_product.owner'),true);
  perform public.shop_hq_assistant_authorize(v_shop,false);
  perform set_config('request.jwt.claim.sub',current_setting('hq_product.worker'),true);
  if public.shop_hq_assistant_finish(v_job,v_lease,v_intent,true) then
    raise exception 'Revoked lease could create a product';
  end if;
  begin
    perform public.shop_hq_assistant_shop_context(v_job,v_lease);
    raise exception 'Revoked lease could read current mode';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;

-- Price-evidence regression matrix. Queue/lease/owner checks are exercised above;
-- this section isolates the private catalogue boundary with the same shop owner.
do $$
declare
  v_job shop_private.hq_assistant_jobs;
  v_case jsonb;
  v_result jsonb;
  v_before bigint;
begin
  v_job.shop_id := current_setting('hq_product.shop')::uuid;
  v_job.actor_id := current_setting('hq_product.owner')::uuid;
  for v_case in select value from jsonb_array_elements('[
    ["سجل منتج اسمه \"شنطة اطفال\" بـ 500 جنيه", "شنطة اطفال", 500, true],
    ["سجل منتج شنطة اطفال ب٥٠٠ جنيه", "شنطة اطفال", 500, true],
    ["سجل منتج شنطة اطفال بسعر ۵۰۰٫۵۰ جنيه", "شنطة اطفال", 500.50, true],
    ["Add product Bag for 500 EGP", "Bag", 500, true],
    ["Add product Bag at 0", "Bag", 0, true],
    ["Add product Bag price: 99.99", "Bag", 99.99, true],
    ["Add product \"Price 500\"", "Price 500", null, true],
    ["Add product Bag", "Bag", null, true],
    ["Add product Bag for 500 USD", "Bag", 500, false],
    ["Add product Bag for 500", "Bag", 5, false],
    ["Add product Bag for -5", "Bag", null, false],
    ["Add product Bag for 500.001", "Bag", null, false],
    ["Add product Bag for 1000000000", "Bag", null, false],
    ["Add product Bag for 500", "Bag", null, false],
    ["Add product Bag", "Bag", 500, false],
    ["Add product Bag price nonsense", "Bag", null, false],
    ["Add product Bag for 500", "Bag", "500", false],
    ["سجل منتج شنطة اطفال بـ 500 جنيه", "شنطة اطفال بـ 500 جنيه", null, false]
  ]'::jsonb) loop
    v_job.owner_message := v_case->>0;
    select count(*) into v_before from public.products where shop_id = v_job.shop_id;
    v_result := shop_private.hq_assistant_create_product(v_job,
      jsonb_build_object('name',v_case->1,'salePrice',v_case->2));
    if (v_result is not null) is distinct from (v_case->>3)::boolean then
      raise exception 'Price evidence regression failed: %',v_case;
    end if;
    if v_result is null then
      if (select count(*) from public.products where shop_id = v_job.shop_id) <> v_before then
        raise exception 'Rejected price wrote a product';
      end if;
    elsif not exists (select 1 from public.products where id = (v_result->>'productId')::uuid
      and shop_id = v_job.shop_id and name = v_case->>1
      and sale_price = coalesce((v_case->>2)::numeric,0)
      and price_pending = (v_case->>2 is null)) then
      raise exception 'Price evidence saved incorrect catalogue values: %',v_case;
    else
      -- Synthetic rows only: keep each independent case below catalogue plan caps
      -- and avoid duplicate-name interactions between price grammar examples.
      delete from public.products where id = (v_result->>'productId')::uuid and shop_id = v_job.shop_id;
    end if;
  end loop;
end;
$$;
