begin;
-- The published RPC is the authority boundary. The private reel adapter remains
-- unexecutable by API roles; each delegated action still authorizes auth.uid(),
-- tenant, location, subscription and product/media ownership in its existing RPC.
do $$begin
 if (select md5(prosrc) from pg_catalog.pg_proc where oid='public.shop_catalog_media(uuid,text,jsonb)'::regprocedure) is distinct from '85d42bb1c499f5ecb7f175dd72b0412d' then
  raise exception 'CATALOG_ENTRYPOINT_REVIEW_REQUIRED' using errcode='55000';
 end if;
end;$$;
alter function public.shop_catalog_media(uuid,text,jsonb) security definer;
alter function public.shop_catalog_media(uuid,text,jsonb) set search_path='';
-- Preserve the existing public-function ACL; do not grant private adapters.
notify pgrst,'reload schema';
commit;
