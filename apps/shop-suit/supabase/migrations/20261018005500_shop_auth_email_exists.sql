-- Shop Suit sign-in email-first step. Deliberately exposes a yes/no lookup,
-- but only to the server's service role. Never grant this RPC to anon/authenticated.
-- Product owner's UX requirement: report unknown email BEFORE password entry.
create or replace function public.shop_auth_email_exists(p_email text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from auth.users as u
     where lower(u.email) = lower(btrim(p_email))
       and u.deleted_at is null
  );
$$;

revoke all on function public.shop_auth_email_exists(text) from public;
revoke all on function public.shop_auth_email_exists(text) from anon;
revoke all on function public.shop_auth_email_exists(text) from authenticated;
grant execute on function public.shop_auth_email_exists(text) to service_role;

comment on function public.shop_auth_email_exists(text) is
  'Restricted sign-in email existence probe. Server-only service-role access; rate-limit HTTP endpoint.';
