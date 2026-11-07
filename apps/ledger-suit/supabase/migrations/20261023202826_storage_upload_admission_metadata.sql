-- LS-ATTACH-001: Storage 1.70 checks declared contentLength before writing bytes,
-- then records actual size. Both stages must retain the exact reserved size.
create or replace function app.storage_upload_matches_reservation(
  p_bucket text, p_key text, p_metadata jsonb
)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from app.attachment_storage_reservations r
    where r.storage_bucket = p_bucket and r.storage_key = p_key
      and r.status = 'reserved' and r.expires_at > now()
      and r.reserved_by = auth.uid()
      and r.mime_type = p_metadata ->> 'mimetype'
      and (p_metadata ? 'size' or p_metadata ? 'contentLength')
      and (not (p_metadata ? 'size') or p_metadata ->> 'size' = r.size_bytes::text)
      and (not (p_metadata ? 'contentLength') or p_metadata ->> 'contentLength' = r.size_bytes::text)
      and app.has_capability(r.organization_id, 'attachments.create')
  );
$$;
comment on function app.storage_upload_matches_reservation(text, text, jsonb) is
  'Authorize an exact owned live reservation using provider admission contentLength or final size; if both are supplied, both must match. MIME and capability remain mandatory.';
