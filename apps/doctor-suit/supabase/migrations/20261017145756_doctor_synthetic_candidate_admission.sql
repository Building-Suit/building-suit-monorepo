-- DOS-AE-002: administrative_candidate is a bounded synthetic test environment.
-- No admissions are seeded. There is no authenticated/service grant or live purpose.
create table public.doctor_candidate_admissions(
 id uuid primary key default pg_catalog.gen_random_uuid(),
 user_id uuid not null references auth.users(id),
 purpose text not null check(purpose='synthetic_fixture'),
 evidence_ref text not null check(length(btrim(evidence_ref)) between 1 and 200),
 issued_at timestamptz not null default clock_timestamp(),
 valid_until timestamptz not null,
 database_actor text not null default session_user,
 check(valid_until>issued_at and valid_until<=issued_at+interval'24 hours')
);
create index doctor_candidate_admissions_actor_idx on public.doctor_candidate_admissions(user_id,valid_until);
create table public.doctor_candidate_revocations(
 admission_id uuid primary key references public.doctor_candidate_admissions(id),
 reason text not null check(reason in('fixture_complete','operator_revoke','incident')),
 revoked_at timestamptz not null default clock_timestamp(),
 database_actor text not null default session_user
);
alter table public.doctor_candidate_admissions enable row level security;
alter table public.doctor_candidate_admissions force row level security;
alter table public.doctor_candidate_revocations enable row level security;
alter table public.doctor_candidate_revocations force row level security;
create policy doctor_candidate_admissions_owner on public.doctor_candidate_admissions for all to postgres using(true)with check(true);
create policy doctor_candidate_revocations_owner on public.doctor_candidate_revocations for all to postgres using(true)with check(true);
revoke all on public.doctor_candidate_admissions,public.doctor_candidate_revocations from public,anon,authenticated,service_role;
create function doctor_private.candidate_evidence_immutable()returns trigger
language plpgsql security invoker set search_path=''as $$
begin raise exception using errcode='42501',message='DOCTOR_CANDIDATE_EVIDENCE_IMMUTABLE';end $$;
create trigger doctor_candidate_admissions_immutable before update or delete or truncate on public.doctor_candidate_admissions
 for each statement execute function doctor_private.candidate_evidence_immutable();
create trigger doctor_candidate_revocations_immutable before update or delete or truncate on public.doctor_candidate_revocations
 for each statement execute function doctor_private.candidate_evidence_immutable();
revoke all on function doctor_private.candidate_evidence_immutable()from public,anon,authenticated,service_role;

-- Fresh authority is needed after transactional lock waits as well as at entry.
-- VOLATILE obtains current provider/admission state on each recheck; static
-- stored-grant CHECK helpers remain immutable and are unchanged.
create or replace function doctor_private.current_actor()returns uuid
language plpgsql volatile security definer set search_path=''as $$
declare actor uuid:=auth.uid();session_text text:=auth.jwt()->>'session_id';
begin
 if actor is null or session_text is null or session_text!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'then
  raise exception using errcode='42501',message='DOCTOR_AUTH_REQUIRED';end if;
 if not exists(select 1 from auth.users u where u.id=actor and u.email_confirmed_at is not null
  and not coalesce(u.is_anonymous,false)and(u.banned_until is null or u.banned_until<=clock_timestamp()))
  or not exists(select 1 from auth.sessions s where s.id=session_text::uuid and s.user_id=actor and(s.not_after is null or s.not_after>clock_timestamp()))then
  raise exception using errcode='42501',message='DOCTOR_AUTH_REQUIRED';end if;
 if doctor_private.edition_mode()='administrative_candidate'and not exists(
  select 1 from public.doctor_candidate_admissions a where a.user_id=actor and a.purpose='synthetic_fixture'
   and a.issued_at<=clock_timestamp()and a.valid_until>clock_timestamp()
   and not exists(select 1 from public.doctor_candidate_revocations r where r.admission_id=a.id)
 )then raise exception using errcode='42501',message='DOCTOR_SYNTHETIC_ADMISSION_REQUIRED';end if;
 return actor;
end $$;
