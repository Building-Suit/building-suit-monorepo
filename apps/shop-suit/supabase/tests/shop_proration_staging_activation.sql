-- Disposable/rollback-only fixture. The runner substitutes the exact reviewed
-- migration at each marker; no hosted fixture or activation RPC is introduced.
create function pg_temp.activation_fixture(p_audience text, p_environment uuid,
 p_mode text default 'test', p_enabled boolean default true, p_expired boolean default false)
returns void language plpgsql as $$
begin
 update public.shop_super_admin_integrations set enabled=false;
 update shop_private.proration_configuration set enabled=false where singleton;
 insert into shop_private.xpay_configuration(singleton,enabled,merchant_id,mode)
 values(true,true,'activation-disposable',p_mode)
 on conflict(singleton) do update set enabled=true,mode=excluded.mode;
 if p_audience is not null then
 insert into public.shop_super_admin_integrations(source_binding_id,target_binding_id,
 target_environment_id,audience,key_id,allowed_operations,max_clock_skew_seconds,
 nonce_retention_seconds,valid_from,valid_until,enabled)
 values(gen_random_uuid(),gen_random_uuid(),p_environment,p_audience,
 'activation-'||gen_random_uuid(),array['adapter.capabilities.read'],60,600,
 clock_timestamp()-interval '2 hours',
 case when p_expired then clock_timestamp()-interval '1 hour' else null end,p_enabled);
 end if;
end $$;
create function pg_temp.activation_expect(p_enabled boolean) returns void language plpgsql as $$
begin
 if (select enabled from shop_private.proration_configuration where singleton) is distinct from p_enabled
 then raise exception 'Unexpected staging activation';end if;
 if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where (n.nspname='shop_private' and c.relname='proration_configuration')
 or (n.nspname='public' and c.relname in('shop_proration_quotes','shop_proration_credit_accounts','shop_proration_credit_ledger','shop_proration_settlements'))
 having bool_or(not c.relrowsecurity or has_table_privilege('anon',c.oid,'SELECT')
 or has_table_privilege('authenticated',c.oid,'SELECT') or has_table_privilege('service_role',c.oid,'UPDATE')))
 then raise exception 'Activation changed protected table boundaries';end if;
 if has_function_privilege('anon','public.shop_xpay_proration_quote(uuid,uuid,uuid,jsonb)','EXECUTE')
 or not has_function_privilege('authenticated','public.shop_xpay_proration_quote(uuid,uuid,uuid,jsonb)','EXECUTE')
 then raise exception 'Activation changed RPC grants';end if;
end $$;

-- Actual staging identity + test provider enables, including idempotent replay.
select pg_temp.activation_fixture('shop-staging:jvvelvftpfnlogalgxgv','2d18defd-a91d-4fec-856f-253ad98dfc5e');
-- APPLY_REVIEWED_ACTIVATION_MIGRATION
select pg_temp.activation_expect(true);
-- APPLY_REVIEWED_ACTIVATION_MIGRATION
select pg_temp.activation_expect(true);

-- Missing, production, wrong environment, live provider, inactive and expired
-- identities all stay OFF, even with the production fixture in test mode.
select pg_temp.activation_fixture(null,null);
-- APPLY_REVIEWED_ACTIVATION_MIGRATION
select pg_temp.activation_expect(false);
select pg_temp.activation_fixture('shop-production:fgdzjnsbcxfbiuogbmom','2d18defd-a91d-4fec-856f-253ad98dfc5e');
-- APPLY_REVIEWED_ACTIVATION_MIGRATION
select pg_temp.activation_expect(false);
select pg_temp.activation_fixture('shop-staging:jvvelvftpfnlogalgxgv',gen_random_uuid());
-- APPLY_REVIEWED_ACTIVATION_MIGRATION
select pg_temp.activation_expect(false);
select pg_temp.activation_fixture('shop-staging:jvvelvftpfnlogalgxgv','2d18defd-a91d-4fec-856f-253ad98dfc5e','live');
-- APPLY_REVIEWED_ACTIVATION_MIGRATION
select pg_temp.activation_expect(false);
select pg_temp.activation_fixture('shop-staging:jvvelvftpfnlogalgxgv','2d18defd-a91d-4fec-856f-253ad98dfc5e','test',false);
-- APPLY_REVIEWED_ACTIVATION_MIGRATION
select pg_temp.activation_expect(false);
select pg_temp.activation_fixture('shop-staging:jvvelvftpfnlogalgxgv','2d18defd-a91d-4fec-856f-253ad98dfc5e','test',true,true);
-- APPLY_REVIEWED_ACTIVATION_MIGRATION
select pg_temp.activation_expect(false);

-- Ambiguous/mixed target metadata cannot enable the feature.
select pg_temp.activation_fixture('shop-production:fgdzjnsbcxfbiuogbmom',gen_random_uuid());
insert into public.shop_super_admin_integrations(source_binding_id,target_binding_id,
 target_environment_id,audience,key_id,allowed_operations,max_clock_skew_seconds,
 nonce_retention_seconds,valid_from,enabled)
values(gen_random_uuid(),gen_random_uuid(),'2d18defd-a91d-4fec-856f-253ad98dfc5e',
 'shop-staging:jvvelvftpfnlogalgxgv','activation-mixed',array['adapter.capabilities.read'],60,600,clock_timestamp()-interval '1 hour',true);
-- APPLY_REVIEWED_ACTIVATION_MIGRATION
select pg_temp.activation_expect(false);
