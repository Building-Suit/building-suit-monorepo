-- Counter staff may reopen their own completed POS receipts without sales-history access.
-- The payment actor comes from the immutable request log, never a selected staff field.
create index pos_sale_requests_own_receipt_idx
  on public.pos_sale_requests (shop_id, actor_profile_id, invoice_id)
  where operation = 'checkout' and completed_at is not null;

create function public.get_own_pos_receipt(
  p_shop_id uuid, p_location_id uuid, p_invoice_id uuid default null
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_snapshot jsonb;
begin
  perform shop_private.assert_location_access(p_shop_id, p_location_id, false);
  select receipt.snapshot into v_snapshot
  from public.sale_receipts receipt
  where receipt.shop_id = p_shop_id and receipt.location_id = p_location_id
    and (p_invoice_id is null or receipt.invoice_id = p_invoice_id)
    and exists (
      select 1 from public.pos_sale_requests request
      join public.profiles actor on actor.id = request.actor_profile_id
      join public.shop_memberships membership on membership.profile_id = actor.id
        and membership.shop_id = request.shop_id and membership.status = 'active'
      where request.invoice_id = receipt.invoice_id and request.shop_id = receipt.shop_id
        and request.operation = 'checkout' and request.completed_at is not null
        and actor.user_id = auth.uid() and actor.status = 'active'
    )
  order by receipt.created_at desc, receipt.invoice_id desc limit 1;
  return v_snapshot;
end;
$$;
revoke all on function public.get_own_pos_receipt(uuid,uuid,uuid) from public, anon;
grant execute on function public.get_own_pos_receipt(uuid,uuid,uuid) to authenticated, service_role;
