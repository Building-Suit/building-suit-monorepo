-- Owner-only preview of the existing secured offer. Redemption stays in its RPC.
create function public.shop_private_offer_read(p_shop_id uuid,p_offer_id uuid,p_offer_version integer,
 p_target_binding_id uuid,p_target_environment_id uuid,p_redemption_token text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare o public.shop_private_offers;s public.shop_private_offer_security;redeemed uuid;
begin
 if auth.role() is distinct from 'authenticated' or auth.uid() is null or not shop_private.is_owner(p_shop_id) then
  raise exception 'SHOP_OWNER_REQUIRED' using errcode='42501';end if;
 select * into o from public.shop_private_offers where id=p_offer_id;
 if o.id is null or o.recipient_user_id<>auth.uid() or o.shop_id<>p_shop_id
 or o.offer_version is distinct from p_offer_version or o.target_binding_id is distinct from p_target_binding_id
 or o.target_environment_id is distinct from p_target_environment_id then
  raise exception 'SHOP_PRIVATE_OFFER_RECIPIENT_MISMATCH' using errcode='42501';end if;
 select * into s from public.shop_private_offer_security where offer_id=o.id;
 if s.offer_id is null or p_redemption_token is null or p_redemption_token !~ '^[A-Za-z0-9_-]{43}$'
 or encode(extensions.digest(p_redemption_token,'sha256'),'hex') is distinct from s.token_digest then
  raise exception 'SHOP_PRIVATE_OFFER_TOKEN_INVALID' using errcode='42501';end if;
 if exists(select 1 from public.shop_private_offer_revocations where offer_id=o.id) then
  raise exception 'SHOP_PRIVATE_OFFER_REVOKED' using errcode='42501';end if;
 select submission_id into redeemed from public.shop_private_offer_redemptions where offer_id=o.id;
 if redeemed is null and o.expires_at<=statement_timestamp() then
  raise exception 'SHOP_PRIVATE_OFFER_EXPIRED' using errcode='22023';end if;
 return jsonb_build_object('offerId',o.id,'offerVersion',o.offer_version,'shopId',o.shop_id,
 'targetBindingId',o.target_binding_id,'targetEnvironmentId',o.target_environment_id,
 'displayName',o.display_name,'priceAmount',o.price_amount,'currency',o.currency,
 'billingInterval',o.billing_interval,'expiresAt',o.expires_at,'resourceLimits',o.resource_limits,
 'entitlements',s.entitlements,'submissionId',redeemed,
 'blockers',shop_private.plan_change_blockers(o.shop_id,o.resource_limits));
end $$;
revoke all on function public.shop_private_offer_read(uuid,uuid,integer,uuid,uuid,text) from public,anon,service_role;
grant execute on function public.shop_private_offer_read(uuid,uuid,integer,uuid,uuid,text) to authenticated;

-- Extend the existing protected review projection with frozen source terms and
-- evidence metadata only. Evidence bytes remain behind their existing access RPC.
create or replace function public.platform_admin_billing_read(
  p_resource text default 'queue', p_status text default null,
  p_page integer default 1, p_page_size integer default 25
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_result jsonb;
begin
  perform shop_private.assert_platform_admin(false);
  if p_resource not in ('queue', 'configuration', 'summary', 'audit')
    or p_page is null or p_page < 1 or p_page > 100000
    or p_page_size is null or p_page_size < 1 or p_page_size > 100
    or nullif(btrim(p_status), '') not in ('submitted', 'under_review', 'approved', 'rejected') then
    raise exception 'PLATFORM_BILLING_READ_INVALID' using errcode = '22023';
  end if;
  if p_resource = 'configuration' then
    select jsonb_build_object(
      'recipientAlias', configuration.recipient_alias,
      'paymentLink', configuration.payment_link,
      'qrImageUrl', configuration.qr_image_url,
      'instructionsEn', configuration.instructions_en,
      'instructionsAr', configuration.instructions_ar,
      'updatedAt', configuration.updated_at
    ) into v_result from public.shop_billing_configuration configuration where configuration.singleton;
  elsif p_resource = 'summary' then
    select jsonb_build_object(
      'open', count(*) filter (where submission.status in ('submitted', 'under_review'))::integer,
      'submitted', count(*) filter (where submission.status = 'submitted')::integer,
      'underReview', count(*) filter (where submission.status = 'under_review')::integer,
      'approved', count(*) filter (where submission.status = 'approved')::integer,
      'rejected', count(*) filter (where submission.status = 'rejected')::integer
    ) into v_result from public.shop_billing_submissions submission;
  elsif p_resource = 'audit' then
    with event_rows as (
      select event.id, event.shop_id as "shopId", shop.name as "shopName",
        event.submission_id as "submissionId", event.action, event.reason,
        event.actor_user_id as "actorUserId", event.parameters,
        event.before_state as "beforeState", event.after_state as "afterState",
        event.occurred_at as "occurredAt"
      from public.platform_billing_events event left join public.shops shop on shop.id = event.shop_id
    ), page_rows as (
      select * from event_rows order by "occurredAt" desc, id
      limit p_page_size offset (p_page - 1) * p_page_size
    ) select jsonb_build_object(
      'items', coalesce((select jsonb_agg(to_jsonb(page_row)) from page_rows page_row), '[]'::jsonb),
      'total', (select count(*)::integer from event_rows), 'page', p_page, 'pageSize', p_page_size
    ) into v_result;
  else
    with queue_rows as (
      select submission.id, submission.shop_id as "shopId", shop.name as "shopName",
        submission.kind, submission.status,
        current_plan.slug as "currentPlanSlug", current_terms.display_name as "currentPlanName",
        submission.plan_slug_snapshot as "requestedPlanSlug",
        submission.plan_name_snapshot as "requestedPlanName",
        submission.billing_interval_snapshot as "billingInterval",
        submission.list_price_amount as "listPriceAmount",
        submission.effective_price_amount as "effectivePriceAmount",
        submission.price_source as "priceSource",
        submission.resource_limits_snapshot as "resourceLimits",
        submitted_terms.private_offer_id as "privateOfferId",
        submission.offer_entitlements as entitlements,
        (select period.id from public.subscription_commercial_periods period where period.billing_submission_id=submission.id) as "commercialPeriodId",
        (select period.subscription_id from public.subscription_commercial_periods period where period.billing_submission_id=submission.id) as "subscriptionId",
        coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'originalFileName',e.original_file_name,
          'mimeType',e.mime_type,'sizeBytes',e.size_bytes,'sha256',e.sha256,'retainedUntil',e.retained_until)
          order by e.created_at,e.id) from public.shop_billing_payment_evidence e where e.submission_id=submission.id),'[]'::jsonb) as evidence,
        shop_private.plan_change_blockers(submission.shop_id, submission.resource_limits_snapshot) as "usageBlockers",
        submission.expected_amount as "expectedAmount", submission.paid_amount as "paidAmount",
        submission.currency, submission.transfer_date as "transferDate",
        submission.transfer_reference as "transferReference",
        submission.review_reason as "reviewReason", submission.received_amount as "receivedAmount",
        submission.received_reference as "receivedReference", submission.received_date as "receivedDate",
        submission.activation_days as "activationDays",
        submission.approved_subscription_end as "approvedSubscriptionEnd",
        submission.submitted_at as "submittedAt", submission.reviewed_at as "reviewedAt"
      from public.shop_billing_submissions submission
      join public.plan_catalog_terms submitted_terms on submitted_terms.id=submission.catalog_terms_id
      join public.shops shop on shop.id = submission.shop_id
      join public.shop_memberships membership on membership.shop_id = submission.shop_id and membership.role = 'owner'
      join public.subscriptions subscription on subscription.profile_id = membership.profile_id
      join public.plans current_plan on current_plan.id = subscription.plan_id
      join public.plan_catalog_terms current_terms on current_terms.id = subscription.catalog_terms_id
      where (nullif(btrim(p_status), '') is null or submission.status = btrim(p_status))
        and membership.id = (select selected.id from public.shop_memberships selected
          where selected.shop_id = submission.shop_id and selected.role = 'owner'
          order by (selected.status = 'active') desc, selected.created_at, selected.id limit 1)
    ), page_rows as (
      select * from queue_rows order by "submittedAt" desc, id
      limit p_page_size offset (p_page - 1) * p_page_size
    ) select jsonb_build_object(
      'items', coalesce((select jsonb_agg(to_jsonb(page_row)) from page_rows page_row), '[]'::jsonb),
      'total', (select count(*)::integer from queue_rows), 'page', p_page, 'pageSize', p_page_size
    ) into v_result;
  end if;
  return v_result;
end;
$$;

