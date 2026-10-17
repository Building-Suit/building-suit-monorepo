-- DOS-M1-006. Product marker is not authority; protected identity requires a current provider session.
create function public.doctor_runtime_contract() returns jsonb
language sql immutable security invoker set search_path='' as $$
  select jsonb_build_object('product','doctor-suit','version',1,'data_mode','synthetic')
$$;
revoke all on function public.doctor_runtime_contract() from public;
grant execute on function public.doctor_runtime_contract() to anon,authenticated;

create or replace function doctor_private.current_actor() returns uuid
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=auth.uid(); session_text text:=auth.jwt()->>'session_id';
begin
  if actor is null or session_text is null or session_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception using errcode='42501',message='DOCTOR_AUTH_REQUIRED';
  end if;
  if not exists(select 1 from auth.users u where u.id=actor and u.email_confirmed_at is not null
      and not coalesce(u.is_anonymous,false) and (u.banned_until is null or u.banned_until<=now()))
    or not exists(select 1 from auth.sessions s where s.id=session_text::uuid and s.user_id=actor and (s.not_after is null or s.not_after>now())) then
    raise exception using errcode='42501',message='DOCTOR_AUTH_REQUIRED';
  end if;
  return actor;
end $$;

create function doctor_private.session_context() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=doctor_private.current_actor(); owned_practice uuid;
begin
  select id into owned_practice from public.practices where owner_user_id=actor;
  return jsonb_build_object('product','doctor-suit','user_id',actor,'session_id',auth.jwt()->>'session_id','practice_id',owned_practice);
end $$;
revoke all on function doctor_private.session_context() from public,anon;
grant execute on function doctor_private.session_context() to authenticated;
create function public.doctor_session_context() returns jsonb
language sql stable security invoker set search_path='' as $$ select doctor_private.session_context() $$;
revoke all on function public.doctor_session_context() from public,anon;
grant execute on function public.doctor_session_context() to authenticated;
