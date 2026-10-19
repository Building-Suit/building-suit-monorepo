-- A bounded own-counter receipt index. It grants no access to another cashier's sales.
create function public.list_own_pos_receipts(p_shop_id uuid, p_location_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_receipts jsonb;
begin
  perform shop_private.assert_location_access(p_shop_id, p_location_id, false);
  select coalesce(jsonb_agg(recent.item order by recent.created_at desc, recent.invoice_id desc), '[]'::jsonb)
    into v_receipts
  from (
    select receipt.invoice_id, receipt.created_at,
      jsonb_build_object('invoiceId', receipt.invoice_id,
        'invoiceNumber', receipt.snapshot->>'invoiceNumber', 'issuedAt', receipt.snapshot->>'issuedAt',
        'total', receipt.snapshot->'total', 'currency', receipt.snapshot->>'currency') as item
    from public.sale_receipts receipt
    where receipt.shop_id = p_shop_id and receipt.location_id = p_location_id
      and exists (
        select 1 from public.pos_sale_requests request
        join public.profiles actor on actor.id = request.actor_profile_id
        join public.shop_memberships membership on membership.profile_id = actor.id
          and membership.shop_id = request.shop_id and membership.status = 'active'
        where request.invoice_id = receipt.invoice_id and request.shop_id = receipt.shop_id
          and request.operation = 'checkout' and request.completed_at is not null
          and actor.user_id = auth.uid() and actor.status = 'active'
      )
    order by receipt.created_at desc, receipt.invoice_id desc limit 10
  ) recent;
  return v_receipts;
end;
$$;
revoke all on function public.list_own_pos_receipts(uuid,uuid) from public, anon;
grant execute on function public.list_own_pos_receipts(uuid,uuid) to authenticated, service_role;
