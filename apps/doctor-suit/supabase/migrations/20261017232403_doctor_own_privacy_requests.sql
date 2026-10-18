-- DOS-AE-007: synthetic own-account review intake only; no fulfillment authority.
create table public.doctor_privacy_requests(
 id uuid primary key default pg_catalog.gen_random_uuid(),
 user_id uuid not null references auth.users(id),session_id uuid not null,
 request_key uuid not null,kind text not null check(kind in('access_review','correction_review','erasure_review','restriction_review')),
 state text not null default 'awaiting_review' check(state='awaiting_review'),
 created_at timestamptz not null default clock_timestamp(),database_actor text not null default session_user,
 unique(user_id,request_key),unique(user_id,kind)
);
alter table public.doctor_privacy_requests enable row level security;
alter table public.doctor_privacy_requests force row level security;
create policy doctor_privacy_requests_database on public.doctor_privacy_requests for all to postgres using(true)with check(true);
create policy doctor_privacy_requests_own on public.doctor_privacy_requests for select to authenticated using(user_id=(select doctor_private.current_actor()));
revoke all on public.doctor_privacy_requests from public,anon,authenticated,service_role;
grant select on public.doctor_privacy_requests to authenticated;
create function doctor_private.privacy_request_immutable()returns trigger
language plpgsql security invoker set search_path=''as $$
begin raise exception using errcode='42501',message='DOCTOR_PRIVACY_REQUEST_IMMUTABLE';end $$;
create trigger doctor_privacy_requests_immutable before update or delete or truncate on public.doctor_privacy_requests
 for each statement execute function doctor_private.privacy_request_immutable();
create function doctor_private.privacy_requests()returns jsonb
language plpgsql stable security definer set search_path=''as $$
declare actor uuid:=doctor_private.current_actor();items jsonb;
begin
 select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'kind',r.kind,'state',r.state,'created_at',r.created_at)order by r.created_at desc,r.id),'[]'::jsonb)
 into items from public.doctor_privacy_requests r where r.user_id=actor;
 return jsonb_build_object('user_id',actor,'scope','own_account','data_mode','synthetic','policy_configured',false,'fulfillment_available',false,'items',items);
end $$;
create function doctor_private.submit_privacy_request(p_kind text,p_key uuid)returns jsonb
language plpgsql security definer set search_path=''as $$
declare actor uuid:=doctor_private.current_actor();item public.doctor_privacy_requests;
begin
 if p_key is null or p_kind is null or p_kind not in('access_review','correction_review','erasure_review','restriction_review')then
 raise exception using errcode='22023',message='DOCTOR_PRIVACY_REQUEST_INVALID';end if;
 perform pg_catalog.pg_advisory_xact_lock(8,pg_catalog.hashtext(actor::text));
 if doctor_private.current_actor()is distinct from actor then raise exception using errcode='42501',message='DOCTOR_AUTH_REQUIRED';end if;
 select * into item from public.doctor_privacy_requests r where r.user_id=actor and r.request_key=p_key;
 if found then
  if item.kind<>p_kind then raise exception using errcode='40001',message='DOCTOR_PRIVACY_REQUEST_CONFLICT';end if;
 else
  -- At most one unresolved request per coded kind; duplicate clicks/new keys cannot grow an unbounded inbox.
  select * into item from public.doctor_privacy_requests r where r.user_id=actor and r.kind=p_kind;
  if not found then
   insert into public.doctor_privacy_requests(user_id,session_id,request_key,kind)
    values(actor,(auth.jwt()->>'session_id')::uuid,p_key,p_kind)returning * into item;
  end if;
 end if;
 return jsonb_build_object('id',item.id,'kind',item.kind,'state',item.state,'created_at',item.created_at);
end $$;
create function public.doctor_privacy_requests()returns jsonb language sql stable security invoker set search_path=''as $$select doctor_private.privacy_requests()$$;
create function public.doctor_submit_privacy_request(p_kind text,p_key uuid)returns jsonb language sql security invoker set search_path=''as $$select doctor_private.submit_privacy_request(p_kind,p_key)$$;
revoke all on function doctor_private.privacy_request_immutable(),doctor_private.privacy_requests(),doctor_private.submit_privacy_request(text,uuid),public.doctor_privacy_requests(),public.doctor_submit_privacy_request(text,uuid)from public,anon,authenticated,service_role;
grant execute on function doctor_private.privacy_requests(),doctor_private.submit_privacy_request(text,uuid),public.doctor_privacy_requests(),public.doctor_submit_privacy_request(text,uuid)to authenticated;
