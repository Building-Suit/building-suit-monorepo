-- Storage checks the upload before persisting its final size metadata. Accept
-- its contentLength contract and persisted size, requiring every supplied
-- length to equal the immutable reservation. Never widen requester access.
create or replace function shop_private.billing_payment_evidence_upload_allowed(
  p_object_name text, p_metadata jsonb
) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.shop_billing_payment_evidence evidence
    join public.shop_billing_submissions submission on submission.id = evidence.submission_id
    where evidence.object_name = p_object_name
      and evidence.uploaded_by_user_id = auth.uid()
      and submission.status in ('submitted', 'under_review')
      and shop_private.is_billing_payment_requester(
        evidence.submission_id, evidence.shop_id, auth.uid()
      )
      and lower(coalesce(p_metadata ->> 'mimetype', '')) = evidence.mime_type
      and (p_metadata ? 'size' or p_metadata ? 'contentLength')
      and (not (p_metadata ? 'size')
        or p_metadata ->> 'size' = evidence.size_bytes::text)
      and (not (p_metadata ? 'contentLength')
        or p_metadata ->> 'contentLength' = evidence.size_bytes::text)
  );
$$;

revoke all on function shop_private.billing_payment_evidence_upload_allowed(text, jsonb)
  from public, anon;
grant execute on function shop_private.billing_payment_evidence_upload_allowed(text, jsonb)
  to authenticated, service_role;
