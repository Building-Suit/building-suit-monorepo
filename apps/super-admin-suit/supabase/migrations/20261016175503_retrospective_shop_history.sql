-- Reviewed retrospective numbering, never a claim that these were original historical tags.
-- Source: tooling/releases/retrospective-shop.json. Import only through authenticated publisher CI.
create table public.release_retrospective_imports (
  plan_id text primary key,
  history jsonb not null,
  digest text not null,
  imported_at timestamptz not null default clock_timestamp()
);
alter table public.release_retrospective_imports enable row level security;
revoke all on public.release_retrospective_imports from public,anon,authenticated,service_role;
create function super_admin_private.retrospective_history_immutable() returns trigger
language plpgsql set search_path='' as $$ begin raise exception 'IMMUTABLE_RELEASE_HISTORY'; end $$;
revoke all on function super_admin_private.retrospective_history_immutable() from public,anon,authenticated,service_role;
create trigger retrospective_history_immutable before update or delete or truncate on public.release_retrospective_imports
  for each statement execute function super_admin_private.retrospective_history_immutable();
create function super_admin_private.retrospective_shop_plan() returns jsonb
language sql immutable set search_path='' as $plan$ select '{"schemaVersion":1,"id":"shop-retrospective-20261016","suit":"shop-suit","numberingOrigin":"retrospective","baselineVersion":"0.4.0","baselineSha":"5fb461fe8d74c8aee6bd1bc37962c05080204034","releases":[{"version":"0.1.0","releasedAt":"2026-09-22T12:29:13.607Z","notes":{"title":{"en":"Product and service catalog","ar":"دليل المنتجات والخدمات"},"summary":{"en":"Organize products and services in your shop workspace.","ar":"نظّم المنتجات والخدمات في مساحة عمل متجرك."},"details":{"en":"Review stock alongside your catalog.","ar":"راجع المخزون إلى جانب الدليل."}},"sourceSha":"7df512f7e008dbf47b19b2c425640248a88506cf","sourceTree":"8bd61d773b0ac322b26f03d0ad4f55f65abd74fd","evidence":[{"path":"apps/shop-suit/app/pages/products/index.vue","contains":"openEdit(product)"},{"path":"apps/shop-suit/app/pages/services/index.vue","contains":"supabase.from(''services'')"},{"path":"apps/shop-suit/app/pages/inventory/index.vue","contains":"quantity_on_hand"}],"deployment":{"id":"dpl_CaC5acSHm3wpT9QaFgqiPfaGafBm","url":"shop-suit-9jcxttfff-building-suit.vercel.app","projectId":"prj_VPY9PDKkvtLJhXJyQk09hoXyfCl0","branch":"main","target":"production","state":"READY","readyAt":"2026-09-22T12:29:13.607Z","githubDeploymentId":6590623724}},{"version":"0.2.0","releasedAt":"2026-09-27T20:54:27.948Z","notes":{"title":{"en":"Sales, customer payments and stock counts","ar":"المبيعات ودفعات العملاء وجرد المخزون"},"summary":{"en":"Issue sales and review customer payments.","ar":"أصدر المبيعات وراجع دفعات العملاء."},"details":{"en":"Record stock counts and follow inventory movements and low-stock thresholds.","ar":"سجّل الجرد وتابع حركات المخزون وحدود التنبيه عند انخفاضه."}},"sourceSha":"ecb546c0ccfb4c6874884cf8fe87eb27c8b0afb4","sourceTree":"890dc4d4b55b9017a663155124447b500c4d08ea","evidence":[{"path":"apps/shop-suit/app/pages/inventory/index.vue","contains":"rpc.rpc(''record_stock_count''"},{"path":"apps/shop-suit/app/pages/sales/index.vue","contains":"shopRpc.rpc(''issue_sale''"},{"path":"apps/shop-suit/app/pages/customers/[id].vue","contains":"shopRpc.rpc(''record_customer_receipt''"}],"deployment":{"id":"dpl_4eo7eX1pDhLGegs724TBB3yJ76Ly","url":"shop-suit-ljsvu4xht-building-suit.vercel.app","projectId":"prj_VPY9PDKkvtLJhXJyQk09hoXyfCl0","branch":"main","target":"production","state":"READY","readyAt":"2026-09-27T20:54:27.948Z","githubDeploymentId":6697760360}},{"version":"0.3.0","releasedAt":"2026-10-04T14:26:40.081Z","notes":{"title":{"en":"Plans, usage and operational reports","ar":"الباقات والاستخدام والتقارير التشغيلية"},"summary":{"en":"Compare plans and review your business resource usage.","ar":"قارن الباقات وراجع استخدام موارد نشاطك."},"details":{"en":"Explore operational reports with location and date filters.","ar":"استعرض التقارير التشغيلية حسب الفرع والفترة الزمنية."}},"sourceSha":"a7a8872ed850ecc0e195498657579611801f2069","sourceTree":"8cc39c02ae637e7ef730d2422c6b66b327fa7e93","evidence":[{"path":"apps/shop-suit/app/pages/billing.vue","contains":"usageResources"},{"path":"apps/shop-suit/app/pages/reports/index.vue","contains":"rpc.rpc(''shop_operational_report''"}],"deployment":{"id":"dpl_AvGAE2rSwRVm3egfzaWS36EHQi7n","url":"shop-suit-e6z8who81-building-suit.vercel.app","projectId":"prj_VPY9PDKkvtLJhXJyQk09hoXyfCl0","branch":"main","target":"production","state":"READY","readyAt":"2026-10-04T14:26:40.081Z","githubDeploymentId":6842221669}},{"version":"0.4.0","releasedAt":"2026-10-14T11:29:16.099Z","notes":{"title":{"en":"Clearer customer and reporting workflows","ar":"تحسين وضوح إجراءات العملاء والتقارير"},"summary":{"en":"See clearer feedback while reviewing customer records and payments.","ar":"اطّلع على رسائل أوضح عند مراجعة سجلات العملاء ودفعاتهم."},"details":{"en":"Report exports respect the selected filters and current loading or error state.","ar":"يراعي تصدير التقارير المرشحات المحددة وحالة التحميل أو الخطأ الحالية."}},"sourceSha":"5fb461fe8d74c8aee6bd1bc37962c05080204034","sourceTree":"2fd81ee4316fd87ec2d0f2c6ffffa4746fa1f40e","evidence":[{"path":"apps/shop-suit/app/pages/reports/index.vue","contains":"accessPending.value || pending.value || accessError.value || error.value"},{"path":"apps/shop-suit/app/pages/customers/[id].vue","contains":"shop-data:customer-outstanding:${currentId.value"}],"deployment":{"id":"dpl_5Cggf24PuKZifm9j35moyEbcnBLf","url":"shop-suit-eyjyw9qnn-building-suit.vercel.app","projectId":"prj_VPY9PDKkvtLJhXJyQk09hoXyfCl0","branch":"main","target":"production","state":"READY","readyAt":"2026-10-14T11:29:16.099Z","githubDeploymentId":7064077577}}]}'::jsonb $plan$;
revoke all on function super_admin_private.retrospective_shop_plan() from public,anon,authenticated,service_role;

create function public.release_history_import(p_history jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare approved jsonb; previous public.release_retrospective_imports; item jsonb; suit uuid; current_version text; imported public.release_retrospective_imports;
begin
  perform super_admin_private.release_context();
  perform pg_advisory_xact_lock(736271901);
  approved:=super_admin_private.retrospective_shop_plan();
  if p_history is distinct from approved then raise exception 'HISTORY_IMPORT_REVIEW_REQUIRED'; end if;
  select * into previous from public.release_retrospective_imports where plan_id=approved->>'id';
  if found then
    if previous.history is distinct from approved then raise exception 'DIGEST_CONFLICT'; end if;
    return jsonb_build_object('id',previous.plan_id,'digest',previous.digest,'importedAt',previous.imported_at);
  end if;
  if super_admin_private.release_context()='staging' and exists(select 1 from public.release_candidate_baseline where production_sha is not null and production_sha<>approved->>'baselineSha')
    and not exists(select 1 from public.release_candidate_promotions) then raise exception 'HISTORICAL_BASELINE_REVIEW_REQUIRED'; end if;
  select id into strict suit from public.suit_registry where stable_key='shop-suit' and status='active';
  for item in select value from jsonb_array_elements(approved->'releases') loop
    if not super_admin_private.release_copy_valid(item->'notes') then raise exception 'INVALID_COPY'; end if;
    if exists(select 1 from public.release_candidate_promotions where manifest#>>'{versions,shop-suit}'=item->>'version')
      or exists(select 1 from public.release_manifests where first_published_at is not null and manifest#>>'{versions,shop-suit}'=item->>'version')
      or exists(select 1 from public.release_retrospective_imports i cross join lateral jsonb_array_elements(i.history->'releases') r where r->>'version'=item->>'version') then
      raise exception 'HISTORICAL_VERSION_COLLISION';
    end if;
  end loop;
  select version into current_version from public.release_candidate_versions where suit_id=suit;
  if current_version is not null and current_version<>'0.0.0'
    and string_to_array(current_version,'.')::bigint[] < string_to_array(approved->>'baselineVersion','.')::bigint[] then
    raise exception 'HISTORICAL_BASELINE_REVIEW_REQUIRED';
  end if;
  -- Correct only the explicitly unversioned origin. Never reset actual production heads or legacy reservations.
  insert into public.release_candidate_versions(suit_id,version,evidence)
    values(suit,approved->>'baselineVersion','Reviewed retrospective production history; numbering assigned retrospectively')
    on conflict(suit_id) do nothing;
  update public.release_candidate_versions set version=approved->>'baselineVersion',evidence='Reviewed retrospective production history; numbering assigned retrospectively'
    where suit_id=suit and version='0.0.0';
  select version into current_version from public.release_candidate_versions where suit_id=suit;
  if current_version is null or string_to_array(current_version,'.')::bigint[] < string_to_array(approved->>'baselineVersion','.')::bigint[] then raise exception 'HISTORICAL_BASELINE_REVIEW_REQUIRED'; end if;
  insert into public.release_retrospective_imports(plan_id,history,digest)
    values(approved->>'id',approved,super_admin_private.release_digest(approved)) returning * into imported;
  if not found then raise exception 'HISTORY_IMPORT_REVIEW_REQUIRED'; end if;
  return jsonb_build_object('id',imported.plan_id,'digest',imported.digest,'importedAt',imported.imported_at);
end $$;
revoke all on function public.release_history_import(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.release_history_import(jsonb) to service_role;

-- Keep the previously verified public-feed implementation, readiness gates and published-preview policy unchanged.
alter function public.release_public_feed() set schema super_admin_private;
alter function super_admin_private.release_public_feed() rename to release_verified_public_feed;
revoke all on function super_admin_private.release_verified_public_feed() from public,anon,authenticated,service_role;
create function public.release_public_feed() returns jsonb
language plpgsql security definer set search_path='' as $$
declare base jsonb; historical jsonb;
begin
  base:=super_admin_private.release_verified_public_feed();
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',i.plan_id||':'||(r->>'version'),'suit',i.history->>'suit','visibility','public','status','released',
    'version',r->>'version','versionOrigin','retrospective','releasedAt',r->>'releasedAt',
    'publishedAt',to_char(i.imported_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'title',r#>'{notes,title}','summary',r#>'{notes,summary}','details',r#>'{notes,details}','links','[]'::jsonb
    ) order by (r->>'releasedAt')::timestamptz desc),'[]'::jsonb) into historical
    from public.release_retrospective_imports i cross join lateral jsonb_array_elements(i.history->'releases') r;
  return jsonb_set(base,'{entries}',(base->'entries')||historical);
end $$;
revoke all on function public.release_public_feed() from public,anon,authenticated,service_role;
grant execute on function public.release_public_feed() to anon,authenticated;
-- Make the new service RPC discoverable through the existing PostgREST schema cache.
notify pgrst, 'reload schema';
