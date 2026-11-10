-- Repeated founder checks may share the invitation lock. Keep a conflicting
-- lock against invitation revocation, and retain the exclusive first-bind /
-- missing-membership repair path. This changes no authority, grants or history.
begin;

-- Fail closed rather than creating a new default-PUBLIC helper or overwriting
-- a concurrent authorization change. Hash is the exact reviewed foundation
-- body from 20261104194233_hq_founder_company_plans.sql, not a live guess.
do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_proc p
    join pg_catalog.pg_language l on l.oid = p.prolang
    where p.oid = pg_catalog.to_regprocedure('hq_private.bind_founder()')
      and p.prokind = 'f' and p.pronargs = 0
      and p.prorettype = 'pg_catalog.bool'::pg_catalog.regtype
      and l.lanname = 'plpgsql' and p.prosecdef and p.provolatile = 'v'
      and p.proconfig = array['search_path=""']::text[]
      and pg_catalog.md5(p.prosrc) = '13ab2b821325e38c3a3a8cd3a82cd169'
  ) then
    raise exception 'HQ_FOUNDER_BIND_PREDECESSOR_MISMATCH' using errcode = '55000';
  end if;
end;
$$;

create or replace function hq_private.bind_founder() returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := hq_private.live_auth_uid(); v_email text; v_invite hq_private.founder_invitations;
begin
  if v_uid is null then return false; end if;
  select pg_catalog.lower(pg_catalog.btrim(u.email)) into v_email from auth.users u where u.id = v_uid;

  -- Membership existence is part of the locking query, not a check after it:
  -- two missing-membership repairs must never acquire SHARE then both attempt
  -- to upgrade to UPDATE. Revoked membership still takes this terminal path
  -- and is denied by the fresh founder_uid check; it is never reactivated.
  select i.* into v_invite from hq_private.founder_invitations i
    where i.email = v_email and i.revoked_at is null and i.bound_user_id = v_uid
      and exists (select 1 from public.hq_founders f
        where f.user_id = v_uid and f.invitation_id = i.id)
    for share of i;
  if found then
    -- Always return, including false. Auth/session/email or membership may
    -- have changed while waiting. Never upgrade this shared lock on failure.
    return hq_private.founder_uid() is not null;
  end if;

  select i.* into v_invite from hq_private.founder_invitations i
    where i.email = v_email and i.revoked_at is null for update;
  if not found or (v_invite.bound_user_id is not null and v_invite.bound_user_id <> v_uid) then return false; end if;
  if hq_private.live_auth_uid() is distinct from v_uid then return false; end if;
  if v_invite.bound_user_id is null then
    update hq_private.founder_invitations set bound_user_id = v_uid, bound_at = pg_catalog.clock_timestamp()
      where id = v_invite.id and bound_user_id is null;
  end if;
  insert into public.hq_founders(user_id, invitation_id) values (v_uid, v_invite.id)
    on conflict (user_id) do nothing;
  return hq_private.founder_uid() is not null;
end;
$$;

commit;
