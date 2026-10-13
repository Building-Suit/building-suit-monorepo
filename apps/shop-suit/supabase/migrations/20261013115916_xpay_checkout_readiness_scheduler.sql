-- Read-only customer capability; never exposes an API key or creates a charge.
create function public.shop_xpay_checkout_status(p_shop_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare c shop_private.xpay_configuration;
begin
 if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) or not shop_private.is_owner(p_shop_id) then
 raise exception 'SHOP_OWNER_REQUIRED' using errcode='42501';end if;
 select * into c from shop_private.xpay_configuration where singleton;
 return jsonb_build_object('enabled',coalesce(c.enabled,false),'merchantId',c.merchant_id,'mode',c.mode);
end $$;
revoke all on function public.shop_xpay_checkout_status(uuid) from public,anon,service_role;
grant execute on function public.shop_xpay_checkout_status(uuid) to authenticated;

-- Recover a persisted quote even when the dispatcher died before preparing its
-- provider body. Revalidate unknown creations before every provider POST.
create or replace function public.shop_xpay_prepare_session(p_order_id uuid,p_body jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare o public.shop_xpay_orders;
begin
 perform shop_private.xpay_server_required();
 select * into o from public.shop_xpay_orders where id=p_order_id for update;
 if o.id is null or jsonb_typeof(p_body) is distinct from 'object' then raise exception 'XPAY_SESSION_INVALID' using errcode='22023';end if;
 if o.state<>'creating' or o.created_at<clock_timestamp()-interval '23 hours' then raise exception 'XPAY_RECONCILIATION_REQUIRED' using errcode='55000';end if;
 if o.private_offer_id is not null and ((o.quote#>>'{offerBinding,expiresAt}')::timestamptz<clock_timestamp()+interval '31 minutes'
 or exists(select 1 from public.shop_private_offer_revocations where offer_id=o.private_offer_id)) then
 raise exception 'XPAY_OFFER_EXPIRING' using errcode='22023';end if;
 if o.session_request is not null then return shop_private.xpay_order_view(o);end if;
 update public.shop_xpay_orders set session_request=p_body,updated_at=clock_timestamp() where id=o.id returning * into o;
 return shop_private.xpay_order_view(o);
end $$;

-- Supported Supabase Cron/pg_net/Vault pattern. Installing this migration does
-- not register a job, create a secret, or call an external endpoint.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
create function shop_private.xpay_scheduled_request() returns bigint
language plpgsql security definer set search_path='' as $$
declare project_url text; server_key text;
begin
 select decrypted_secret into project_url from vault.decrypted_secrets where name='shop_xpay_project_url';
 select decrypted_secret into server_key from vault.decrypted_secrets where name='shop_xpay_server_key';
 if project_url not in ('https://jvvelvftpfnlogalgxgv.supabase.co','https://fgdzjnsbcxfbiuogbmom.supabase.co')
 or project_url is null or server_key is null or length(server_key)<20 then
 raise exception 'XPAY_SCHEDULE_NOT_CONFIGURED' using errcode='55000';end if;
 return net.http_post(url:=project_url||'/functions/v1/shop-xpay-reconcile',
 headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||server_key,'apikey',server_key),
 body:='{}'::jsonb,timeout_milliseconds:=120000);
end $$;
create function public.shop_xpay_schedule_reconciliation(p_enabled boolean,p_project_ref text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare job bigint; project_url text;
begin
 perform shop_private.xpay_server_required();
 if p_enabled is null or p_project_ref not in ('jvvelvftpfnlogalgxgv','fgdzjnsbcxfbiuogbmom') or p_project_ref is null then
 raise exception 'XPAY_ENVIRONMENT_INVALID' using errcode='22023';end if;
 if p_enabled then
 select decrypted_secret into project_url from vault.decrypted_secrets where name='shop_xpay_project_url';
 if project_url is distinct from ('https://'||p_project_ref||'.supabase.co')
 or not exists(select 1 from vault.decrypted_secrets where name='shop_xpay_server_key' and length(decrypted_secret)>=20)
 then raise exception 'XPAY_SCHEDULE_NOT_CONFIGURED' using errcode='55000';end if;
 job:=cron.schedule('shop-xpay-reconcile','*/5 * * * *','select shop_private.xpay_scheduled_request();');
 else
 select jobid into job from cron.job where jobname='shop-xpay-reconcile' and username=current_user;
 if job is not null then perform cron.unschedule(job);end if;
 end if;
 return jsonb_build_object('enabled',p_enabled,'jobId',job);
end $$;
revoke all on function shop_private.xpay_scheduled_request() from public,anon,authenticated,service_role;
revoke all on function public.shop_xpay_schedule_reconciliation(boolean,text) from public,anon,authenticated;
grant execute on function public.shop_xpay_schedule_reconciliation(boolean,text) to service_role;
notify pgrst,'reload schema';
