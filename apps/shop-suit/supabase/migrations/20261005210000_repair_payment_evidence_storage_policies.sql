-- Forward repair for databases that already applied the evidence migration
-- with direct private-table lookups in the Storage policies. Keep metadata
-- privileges closed; authorize the lookup through bounded definer helpers.

-- Storage policies cannot query the private evidence table as authenticated.
-- Keep that table unexposed and perform the reservation lookup as the function
-- owner while retaining the caller's auth.uid() for the requester check.
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
      and coalesce((p_metadata ->> 'size')::bigint, 0) = evidence.size_bytes
  );
$$;

create or replace function shop_private.billing_payment_evidence_read_allowed(p_object_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.shop_billing_payment_evidence evidence
    where evidence.object_name = p_object_name
      and evidence.uploaded_by_user_id = auth.uid()
      and shop_private.is_billing_payment_requester(
        evidence.submission_id, evidence.shop_id, auth.uid()
      )
  );
$$;

revoke all on function shop_private.billing_payment_evidence_upload_allowed(text, jsonb)
  from public, anon;
revoke all on function shop_private.billing_payment_evidence_read_allowed(text)
  from public, anon;
grant execute on function shop_private.billing_payment_evidence_upload_allowed(text, jsonb)
  to authenticated, service_role;
grant execute on function shop_private.billing_payment_evidence_read_allowed(text)
  to authenticated, service_role;

-- Storage upload/download is available only to the exact Shop owner who made
-- the billing submission and first reserved this immutable server path.
alter policy shop_payment_evidence_owner_insert on storage.objects
to authenticated with check (
  bucket_id = 'shop-payment-evidence'
  and shop_private.billing_payment_evidence_upload_allowed(name, metadata)
);

alter policy shop_payment_evidence_owner_select on storage.objects
to authenticated using (
  bucket_id = 'shop-payment-evidence'
  and shop_private.billing_payment_evidence_read_allowed(name)
);

