-- Deliberate yes/no email-first UX, matching Shop's restricted architecture.
-- Only the Doctor server may call this; existence is never identity/ownership.
create function doctor_private.auth_email_exists(p_email text)returns boolean
language plpgsql stable security definer set search_path=''as $$
declare normalized text:=lower(btrim(p_email));begin
 if normalized is null or length(normalized)>254 or normalized!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'then
  raise exception using errcode='22023',message='DOCTOR_EMAIL_INVALID';end if;
 return exists(select 1 from auth.users u where lower(u.email)=normalized and u.deleted_at is null);
end $$;
create function public.doctor_auth_email_exists(p_email text)returns boolean
language sql stable security invoker set search_path=''as $$select doctor_private.auth_email_exists(p_email)$$;
revoke all on function doctor_private.auth_email_exists(text),public.doctor_auth_email_exists(text)from public,anon,authenticated,service_role;
grant execute on function doctor_private.auth_email_exists(text),public.doctor_auth_email_exists(text)to service_role;
comment on function public.doctor_auth_email_exists(text)is'Server-only boolean email probe; rate-limit the HTTP adapter; never infer verification, identity or practice ownership.';
