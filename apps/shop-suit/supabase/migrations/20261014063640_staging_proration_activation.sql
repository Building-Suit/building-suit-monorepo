-- Ordinary feature configuration, delivered by the existing GitHub integration.
-- Identity is the existing protected, target-owned SAS principal metadata:
-- Shop staging jvvelvftpfnlogalgxgv, environment 2d18defd-a91d-4fec-856f-253ad98dfc5e.
-- Production has no matching principal. Never infer identity from test mode alone,
-- a client header/GUC, or a database cluster identifier (shared by physical clones).
-- No secret reads, public setter, grants/RLS/auth changes, provider calls or payments.
do $activation$
begin
 if exists (
   select 1 from public.shop_super_admin_integrations
   where enabled and retired_at is null and valid_from <= clock_timestamp()
     and (valid_until is null or valid_until > clock_timestamp())
     and target_environment_id = '2d18defd-a91d-4fec-856f-253ad98dfc5e'::uuid
     and audience = 'shop-staging:jvvelvftpfnlogalgxgv'
 ) and not exists (
   select 1 from public.shop_super_admin_integrations
   where enabled and retired_at is null
     and (target_environment_id <> '2d18defd-a91d-4fec-856f-253ad98dfc5e'::uuid
       or audience <> 'shop-staging:jvvelvftpfnlogalgxgv')
 ) and exists (
   select 1 from shop_private.xpay_configuration
   where singleton and enabled and mode = 'test'
 ) then
   update shop_private.proration_configuration set enabled = true
   where singleton and not enabled;
 end if;
end
$activation$;
