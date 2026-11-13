begin;

-- Preserve queue authorization and catalogue writes; only tighten price evidence.
create or replace function shop_private.hq_assistant_create_product(p_job shop_private.hq_assistant_jobs,p_product jsonb)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_name text := btrim(p_product->>'name');
  v_message text := shop_private.hq_sale_name(p_job.owner_message);
  v_claim_sub text := current_setting('request.jwt.claim.sub',true);
  v_claims text := current_setting('request.jwt.claims',true);
  v_product_id uuid;
  v_price numeric;
  v_evidence text[];
  v_price_text text;
  v_mode public.business_mode;
  v_currency text;
begin
  if not coalesce(shop_private.hq_sale_mentions(v_message,
    btrim(regexp_replace(shop_private.hq_sale_name(v_name),'[[:space:][:punct:]،؛؟]+',' ','g'))),false) then
    return null;
  end if;
  -- Do not let a model hide the price suffix inside an unquoted product name.
  -- Quoted literal names (for example "Price 500") remain valid.
  if shop_private.hq_sale_name(v_name) ~
      '(?:^| )(?:sale price|priced at|price|for|at|و?سعر البيع|و?سعر المنتج|و?سعره|و?السعر|بسعر|ب)[ :=]*[٠-٩۰-۹0-9]'
    and position('"' || shop_private.hq_sale_name(v_name) || '"' in v_message) = 0
    and position(chr(39) || shop_private.hq_sale_name(v_name) || chr(39) in v_message) = 0
    and position('“' || shop_private.hq_sale_name(v_name) || '”' in v_message) = 0
    and position('«' || shop_private.hq_sale_name(v_name) || '»' in v_message) = 0 then
    return null;
  end if;
  -- Match the lock used by the regular catalogue write and shop-mode changes.
  select shop.business_mode,shop.business_currency into v_mode,v_currency
  from public.shops shop where shop.id = p_job.shop_id for update;
  if not found or v_mode not in ('product','mixed') then return null; end if;

  -- Strip the evidenced product name before looking for price markers: a
  -- literal name such as "Price 500" must remain a name, not price evidence.
  v_price_text := translate(replace(v_message,shop_private.hq_sale_name(v_name),''),
    '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹٫','01234567890123456789.');
  v_price_text := regexp_replace(btrim(v_price_text),'[.!؟?]+$','');
  v_evidence := regexp_match(v_price_text,
    '(?:^| )(?:sale price|priced at|price|for|at|و?سعر البيع|و?سعر المنتج|و?سعره|و?السعر|بسعر|ب) *[:=]? *([0-9]{1,9}(?:[.][0-9]{1,2})?) *([a-z]{3}|جنيه(?: مصري)?)?$');
  if p_product->>'salePrice' is not null then
    -- No silent downgrade to pending for a hallucinated, malformed, mismatched
    -- or foreign-currency explicit amount. The caller reports a failed write.
    if v_evidence is null or jsonb_typeof(p_product->'salePrice') <> 'number'
      or (v_evidence[1])::numeric is distinct from (p_product->>'salePrice')::numeric
      or not (v_evidence[2] is null or upper(v_evidence[2]) = v_currency
        or (v_currency = 'EGP' and v_evidence[2] in ('جنيه','جنيه مصري'))) then
      return null;
    end if;
    v_price := (v_evidence[1])::numeric;
  elsif v_evidence is not null or v_price_text ~
    '(?:^| )(?:sale price|priced at|price|for|at|و?سعر البيع|و?سعر المنتج|و?سعره|و?السعر|بسعر|ب[-+0-9 ]|ب$)' then
    return null;
  end if;

  begin
    -- The usual catalogue operation enforces the owner's permissions and plan.
    perform set_config('request.jwt.claim.sub',p_job.actor_id::text,true);
    perform set_config('request.jwt.claims',jsonb_build_object(
      'sub',p_job.actor_id,'role','authenticated','is_anonymous',false)::text,true);
    v_product_id := shop_private.save_product_with_category(
      p_job.shop_id,null,v_name,null,null,coalesce(v_price,0),null);
    perform set_config('request.jwt.claim.sub',coalesce(v_claim_sub,''),true);
    perform set_config('request.jwt.claims',coalesce(v_claims,''),true);
  exception when insufficient_privilege then
    return null;
  when check_violation then
    if sqlerrm = 'PRODUCT_LIMIT_REACHED' then return null; end if;
    raise;
  end;

  if v_price is null then
    update public.products set price_pending = true where id = v_product_id and shop_id = p_job.shop_id;
  end if;
  return jsonb_build_object('kind','product','productId',v_product_id,'name',v_name,'pricePending',v_price is null);
end;
$$;

revoke all on function shop_private.hq_assistant_create_product(shop_private.hq_assistant_jobs,jsonb)
  from public,anon,authenticated,service_role;


create or replace function public.shop_hq_assistant_shop_context(p_job_id uuid,p_lease_token uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_worker uuid;
  v_job shop_private.hq_assistant_jobs%rowtype;
  v_mode public.business_mode;
  v_currency text;
begin
  perform shop_private.hq_assistant_queue_lock();
  v_worker := shop_private.hq_assistant_require_queue_worker();
  select * into v_job from shop_private.hq_assistant_jobs where id = p_job_id;
  if not found or p_lease_token is null or v_job.lease_token is distinct from p_lease_token
    or v_job.worker_id is distinct from v_worker or v_job.employee_id is null
    or v_job.stage not in ('employee','reviewing') or v_job.expires_at <= clock_timestamp()
    or v_job.lease_expires_at is null or v_job.lease_expires_at <= clock_timestamp()
    or v_job.transcript_expires_at is null or v_job.transcript_expires_at <= clock_timestamp()
    or not shop_private.hq_assistant_current_consent(v_job) then
    raise exception 'SHOP_HQ_ASSISTANT_CONTEXT_LEASE_REQUIRED' using errcode = '42501';
  end if;
  select shop.business_mode,shop.business_currency into strict v_mode,v_currency from public.shops shop where shop.id = v_job.shop_id;
  return jsonb_build_object('businessMode',v_mode,'businessCurrency',v_currency,'productsEnabled',v_mode in ('product','mixed'));
end;
$$;

revoke all on function public.shop_hq_assistant_shop_context(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.shop_hq_assistant_shop_context(uuid,uuid) to authenticated;


commit;
