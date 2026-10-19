-- DOS-M1-009. Recipient-bound synthetic invitations; no external delivery or subscription.
alter table public.membership_locations add column capabilities text[] check(capabilities is null or capabilities <@ array[
 'dashboard.read','locations.read','locations.manage','patients.read','patients.write','documents.read','documents.write',
 'availability.manage','appointments.read','appointments.write','queue.manage']::text[]);
alter table public.audit_events add column details jsonb not null default '{}' check(jsonb_typeof(details)='object');
create table public.secretary_invitations(
 id uuid primary key default gen_random_uuid(), practice_id uuid not null references public.practices(id),
 recipient_email text not null check(length(recipient_email) between 3 and 254), token_hash text not null check(token_hash ~ '^[0-9a-f]{64}$'),
 grants jsonb not null check(jsonb_typeof(grants)='array'), created_by uuid not null references auth.users(id),
 expires_at timestamptz not null, status text not null default 'pending' check(status in('pending','accepted','cancelled','expired')),
 accepted_user_id uuid references auth.users(id), accepted_membership_id uuid references public.memberships(id),
 version integer not null default 1 check(version>0), created_at timestamptz not null default now(),
 check((status='accepted')=(accepted_user_id is not null and accepted_membership_id is not null))
);
create unique index secretary_invitation_pending on public.secretary_invitations(practice_id,recipient_email) where status='pending';
create index secretary_invitation_practice_time on public.secretary_invitations(practice_id,created_at desc,id);
alter table public.secretary_invitations enable row level security;
revoke all on public.secretary_invitations from public,anon,authenticated;

-- NULL preserves the earlier migration's explicit legacy membership grants. New
-- invitations always store an exact set per location, including an empty override.
create or replace function doctor_private.has_access(p_practice uuid,p_capability text,p_location uuid default null) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=doctor_private.current_actor();
begin
 if p_practice is null or p_capability is null or not p_capability=any(doctor_private.administrative_capabilities()) then return false; end if;
 if exists(select 1 from public.practices where id=p_practice and owner_user_id=actor) then
  return p_location is null or exists(select 1 from public.locations where id=p_location and practice_id=p_practice);
 end if;
 return exists(select 1 from public.memberships m join public.membership_locations ml on ml.membership_id=m.id and ml.practice_id=m.practice_id
  where m.practice_id=p_practice and m.user_id=actor and m.status='active'
   and p_capability=any(coalesce(ml.capabilities,m.capabilities)) and (p_location is null or ml.location_id=p_location));
end $$;
create or replace function doctor_private.contexts() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=doctor_private.current_actor(); result jsonb;
begin
 select coalesce(jsonb_agg(jsonb_build_object(
  'practice_id',p.id,'practice_name',p.name,'doctor_name',d.display_name,'location_id',l.id,'location_name',l.name,'timezone',l.timezone,
  'portal',case when p.owner_user_id=actor then 'doctor' else 'secretary' end,
  'grants_version',case when p.owner_user_id=actor then p.version else m.version end,'location_version',l.version,
  'capabilities',case when p.owner_user_id=actor then doctor_private.administrative_capabilities() else coalesce(ml.capabilities,m.capabilities) end
 ) order by p.name,p.id,l.name,l.id),'[]'::jsonb) into result
 from public.practices p join public.doctor_profiles d on d.user_id=p.owner_user_id join public.locations l on l.practice_id=p.id and l.archived_at is null
 left join public.memberships m on m.practice_id=p.id and m.user_id=actor and m.status='active'
 left join public.membership_locations ml on ml.practice_id=p.id and ml.membership_id=m.id and ml.location_id=l.id
 where p.owner_user_id=actor or (ml.membership_id is not null and cardinality(coalesce(ml.capabilities,m.capabilities))>0);
 return result;
end $$;

create function doctor_private.validate_grants(p_practice uuid,p_grants jsonb,p_archived boolean default false) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare item jsonb; location uuid; capabilities text[]; result jsonb:='[]'; seen uuid[]:='{}';
begin
 if p_grants is null or jsonb_typeof(p_grants)<>'array' then raise exception using errcode='22023',message='DOCTOR_GRANTS_INVALID'; end if;
 if jsonb_array_length(p_grants) not between 1 and 100 then raise exception using errcode='22023',message='DOCTOR_GRANTS_INVALID'; end if;
 for item in select value from jsonb_array_elements(p_grants) loop
  if jsonb_typeof(item)<>'object' or (select count(*) from jsonb_object_keys(item))<>2
   or not(item ? 'location_id' and item ? 'capabilities') or coalesce(item->>'location_id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
   or jsonb_typeof(item->'capabilities') is distinct from 'array' then raise exception using errcode='22023',message='DOCTOR_GRANTS_INVALID'; end if;
  location:=(item->>'location_id')::uuid;
  if location=any(seen) or not exists(select 1 from public.locations where id=location and practice_id=p_practice and (p_archived or archived_at is null)) then
   raise exception using errcode='22023',message='DOCTOR_GRANTS_INVALID'; end if;
  if jsonb_array_length(item->'capabilities') not between 1 and 11 or exists(select 1 from jsonb_array_elements(item->'capabilities') where jsonb_typeof(value)<>'string') then
   raise exception using errcode='22023',message='DOCTOR_GRANTS_INVALID'; end if;
  select array_agg(distinct value order by value) into capabilities from jsonb_array_elements_text(item->'capabilities');
  if not capabilities <@ doctor_private.administrative_capabilities() then raise exception using errcode='22023',message='DOCTOR_GRANTS_INVALID'; end if;
  seen:=array_append(seen,location); result:=result||jsonb_build_array(jsonb_build_object('location_id',location,'capabilities',capabilities));
 end loop;
 return (select jsonb_agg(value order by value->>'location_id') from jsonb_array_elements(result));
end $$;
create function doctor_private.owner_command(p_practice uuid,p_key uuid,p_request jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=doctor_private.current_actor(); prior doctor_private.command_receipts;
begin
 if p_practice is null or p_key is null then raise exception using errcode='22023',message='DOCTOR_COMMAND_KEY_REQUIRED'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_practice::text,1));
 if not doctor_private.is_owner(p_practice) then raise exception using errcode='42501',message='DOCTOR_ACCESS_DENIED'; end if;
 select * into prior from doctor_private.command_receipts where actor_user_id=actor and command_key=p_key;
 if found then
  if prior.request<>p_request then raise exception using errcode='22023',message='DOCTOR_IDEMPOTENCY_CONFLICT'; end if;
  return prior.result;
 end if;
 return null;
end $$;

create function doctor_private.invite_secretary(p_practice uuid,p_email text,p_token_hash text,p_grants jsonb,p_key uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=doctor_private.current_actor(); request jsonb:=jsonb_build_object('command','secretary.invite','practice',p_practice,'email',lower(btrim(p_email)),'token_hash',p_token_hash,'grants',p_grants);
 result jsonb; grants jsonb; item public.secretary_invitations;
begin
 result:=doctor_private.owner_command(p_practice,p_key,request); if result is not null then return result; end if;
 if p_email is null or length(p_email)>254 or btrim(p_email) !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  or p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then raise exception using errcode='22023',message='DOCTOR_INVITATION_INVALID'; end if;
 if exists(select 1 from auth.users where id=actor and lower(email)=lower(btrim(p_email))) then raise exception using errcode='22023',message='DOCTOR_INVITATION_INVALID'; end if;
 grants:=doctor_private.validate_grants(p_practice,p_grants);
 update public.secretary_invitations set status='expired',version=version+1 where practice_id=p_practice and recipient_email=lower(btrim(p_email)) and status='pending' and expires_at<=clock_timestamp();
 if exists(select 1 from public.secretary_invitations where practice_id=p_practice and recipient_email=lower(btrim(p_email)) and status='pending') then
  raise exception using errcode='23505',message='DOCTOR_INVITATION_EXISTS'; end if;
 insert into public.secretary_invitations(practice_id,recipient_email,token_hash,grants,created_by,expires_at)
  values(p_practice,lower(btrim(p_email)),p_token_hash,grants,actor,clock_timestamp()+interval '48 hours') returning * into item;
 insert into public.audit_events(practice_id,actor_user_id,event_type,entity_id,details)values(p_practice,actor,'secretary.invited',item.id,jsonb_build_object('grants',grants));
 result:=jsonb_build_object('invitation_id',item.id,'expires_at',item.expires_at,'version',item.version);
 insert into doctor_private.command_receipts values(actor,p_key,request,result); return result;
end $$;

-- The credential is never a URL, membership lookup, email-only grant or stored raw receipt.
create function doctor_private.invitation_for_actor(p_invitation uuid,p_token text) returns public.secretary_invitations
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=doctor_private.current_actor(); item public.secretary_invitations;
begin
 if p_token is null or p_token !~ '^[0-9a-f]{64}$' then raise exception using errcode='42501',message='DOCTOR_INVITATION_UNAVAILABLE'; end if;
 select * into item from public.secretary_invitations where id=p_invitation;
 if not found or item.token_hash<>encode(sha256(decode(p_token,'hex')),'hex')
  or not exists(select 1 from auth.users where id=actor and lower(email)=item.recipient_email)
  or (item.status='pending' and item.expires_at<=clock_timestamp()) or item.status not in('pending','accepted')
  or (item.status='accepted' and (item.accepted_user_id<>actor or not exists(select 1 from public.memberships where id=item.accepted_membership_id and user_id=actor and status='active'))) then
  raise exception using errcode='42501',message='DOCTOR_INVITATION_UNAVAILABLE'; end if;
 return item;
end $$;
create function doctor_private.invitation_details(p_invitation uuid,p_token text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare item public.secretary_invitations:=doctor_private.invitation_for_actor(p_invitation,p_token); grants jsonb;
begin
 if item.status='pending' then perform doctor_private.validate_grants(item.practice_id,item.grants); end if;
 select jsonb_agg(g.value||jsonb_build_object('location_name',l.name,'timezone',l.timezone) order by l.name,l.id) into grants
  from jsonb_array_elements(item.grants)g join public.locations l on l.practice_id=item.practice_id and l.id=(g.value->>'location_id')::uuid;
 return jsonb_build_object('invitation_id',item.id,'practice_id',item.practice_id,'practice_name',p.name,'doctor_name',d.display_name,'grants',grants,'expires_at',item.expires_at,'status',item.status)
  from public.practices p join public.doctor_profiles d on d.user_id=p.owner_user_id where p.id=item.practice_id;
end $$;
create function doctor_private.accept_secretary_invitation(p_invitation uuid,p_token text,p_key uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=doctor_private.current_actor(); item public.secretary_invitations; practice uuid; grants jsonb; membership uuid; capabilities text[];
 request jsonb; prior doctor_private.command_receipts; result jsonb;
begin
 if p_key is null then raise exception using errcode='22023',message='DOCTOR_COMMAND_KEY_REQUIRED'; end if;
 -- One order for location/grant changes, then the recipient's enrollment lock.
 select practice_id into practice from public.secretary_invitations where id=p_invitation;
 if practice is null then raise exception using errcode='42501',message='DOCTOR_INVITATION_UNAVAILABLE'; end if;
 perform pg_advisory_xact_lock(hashtextextended(practice::text,1));
 perform pg_advisory_xact_lock(hashtextextended(actor::text,0));
 perform 1 from public.secretary_invitations where id=p_invitation for update;
 item:=doctor_private.invitation_for_actor(p_invitation,p_token);
 request:=jsonb_build_object('command','secretary.accept','invitation',p_invitation,'token_hash',encode(sha256(decode(p_token,'hex')),'hex'));
 select * into prior from doctor_private.command_receipts where actor_user_id=actor and command_key=p_key;
 if found then
  if prior.request<>request then raise exception using errcode='22023',message='DOCTOR_IDEMPOTENCY_CONFLICT'; end if;
  return prior.result;
 end if;
 if item.status<>'pending' or exists(select 1 from public.memberships where practice_id=practice and user_id=actor)
  or exists(select 1 from public.practices where id=practice and owner_user_id=actor) then
  raise exception using errcode='42501',message='DOCTOR_INVITATION_UNAVAILABLE'; end if;
 grants:=doctor_private.validate_grants(practice,item.grants);
 select array_agg(distinct c.value order by c.value) into capabilities from jsonb_array_elements(grants)g cross join lateral jsonb_array_elements_text(g.value->'capabilities')c;
 insert into public.memberships(practice_id,user_id,capabilities)values(practice,actor,capabilities) returning id into membership;
 insert into public.membership_locations(practice_id,membership_id,location_id,capabilities)
  select practice,membership,(g.value->>'location_id')::uuid,array(select jsonb_array_elements_text(g.value->'capabilities')) from jsonb_array_elements(grants)g;
 update public.secretary_invitations set status='accepted',accepted_user_id=actor,accepted_membership_id=membership,version=version+1 where id=item.id;
 insert into public.audit_events(practice_id,actor_user_id,event_type,entity_id,details)values(practice,actor,'secretary.accepted',membership,jsonb_build_object('invitation_id',item.id,'grants',grants));
 result:=jsonb_build_object('membership_id',membership);
 insert into doctor_private.command_receipts values(actor,p_key,request,result); return result;
end $$;

create function doctor_private.team(p_practice uuid,p_page integer,p_size integer,p_search text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare members jsonb; invitations jsonb; locations jsonb; total bigint; invitation_total bigint;
begin
 if not doctor_private.is_owner(p_practice) then raise exception using errcode='42501',message='DOCTOR_ACCESS_DENIED'; end if;
 if p_page is null or p_page<0 or p_size is null or p_size not between 1 and 100 or p_search is null or length(p_search)>160 then
  raise exception using errcode='22023',message='DOCTOR_QUERY_INVALID'; end if;
 select count(*) into total from public.memberships m join auth.users u on u.id=m.user_id where m.practice_id=p_practice and position(lower(p_search) in lower(u.email))>0;
 select coalesce(jsonb_agg(to_jsonb(row) order by row.email,row.id),'[]') into members from(
  select m.id,u.email,m.status,m.version,m.created_at,(select coalesce(jsonb_agg(jsonb_build_object('location_id',l.id,'location_name',l.name,'archived',l.archived_at is not null,'capabilities',coalesce(ml.capabilities,m.capabilities)) order by l.name,l.id),'[]')
   from public.membership_locations ml join public.locations l on l.practice_id=ml.practice_id and l.id=ml.location_id where ml.membership_id=m.id and ml.practice_id=p_practice) as grants
  from public.memberships m join auth.users u on u.id=m.user_id where m.practice_id=p_practice and position(lower(p_search) in lower(u.email))>0
  order by u.email,m.id limit p_size offset p_page::bigint*p_size
 )row;
 select count(*) into invitation_total from public.secretary_invitations where practice_id=p_practice and position(lower(p_search) in recipient_email)>0;
 select coalesce(jsonb_agg(to_jsonb(row) order by row.created_at desc,row.id),'[]') into invitations from(
  select id,recipient_email,case when status='pending' and expires_at<=clock_timestamp() then 'expired' else status end as status,version,expires_at,created_at,grants
  from public.secretary_invitations where practice_id=p_practice and position(lower(p_search) in recipient_email)>0
  order by created_at desc,id limit p_size offset p_page::bigint*p_size
 )row;
 select coalesce(jsonb_agg(to_jsonb(row) order by row.name,row.id),'[]') into locations from(
  select id,name,timezone,archived_at is not null as archived from public.locations where practice_id=p_practice order by name,id limit 100
 )row;
 return jsonb_build_object('practice_id',p_practice,'practice_name',(select name from public.practices where id=p_practice),'members',members,'invitations',invitations,'locations',locations,'member_total',total,'invitation_total',invitation_total,
  'location_total',(select count(*) from public.locations where practice_id=p_practice));
end $$;
create function doctor_private.cancel_secretary_invitation(p_practice uuid,p_invitation uuid,p_version integer,p_key uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=doctor_private.current_actor(); item public.secretary_invitations; request jsonb:=jsonb_build_object('command','secretary.cancel','practice',p_practice,'invitation',p_invitation,'version',p_version); result jsonb;
begin
 result:=doctor_private.owner_command(p_practice,p_key,request); if result is not null then return result; end if;
 select * into item from public.secretary_invitations where id=p_invitation and practice_id=p_practice for update;
 if not found then raise exception using errcode='42501',message='DOCTOR_ACCESS_DENIED'; end if;
 if item.version is distinct from p_version or item.status<>'pending' then raise exception using errcode='40001',message='DOCTOR_INVITATION_CONFLICT'; end if;
 update public.secretary_invitations set status='cancelled',version=version+1 where id=item.id returning version into item.version;
 insert into public.audit_events(practice_id,actor_user_id,event_type,entity_id)values(p_practice,actor,'secretary.invitation_cancelled',item.id);
 result:=jsonb_build_object('invitation_id',item.id,'version',item.version); insert into doctor_private.command_receipts values(actor,p_key,request,result); return result;
end $$;
create function doctor_private.set_membership_status(p_practice uuid,p_membership uuid,p_version integer,p_status text,p_key uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=doctor_private.current_actor(); item public.memberships; request jsonb:=jsonb_build_object('command','membership.status','practice',p_practice,'membership',p_membership,'version',p_version,'status',p_status); result jsonb;
begin
 result:=doctor_private.owner_command(p_practice,p_key,request); if result is not null then return result; end if;
 if p_status is null or p_status not in('active','suspended','revoked') then raise exception using errcode='22023',message='DOCTOR_MEMBERSHIP_INVALID'; end if;
 select * into item from public.memberships where id=p_membership and practice_id=p_practice for update;
 if not found or item.user_id=actor then raise exception using errcode='42501',message='DOCTOR_ACCESS_DENIED'; end if;
 if item.version is distinct from p_version then raise exception using errcode='40001',message='DOCTOR_MEMBERSHIP_CONFLICT'; end if;
 if item.status<>p_status then
  update public.memberships set status=p_status,version=version+1 where id=item.id returning version into item.version;
  insert into public.audit_events(practice_id,actor_user_id,event_type,entity_id,details)values(p_practice,actor,'secretary.status_changed',item.id,jsonb_build_object('from',item.status,'to',p_status));
 end if;
 result:=jsonb_build_object('membership_id',item.id,'version',item.version); insert into doctor_private.command_receipts values(actor,p_key,request,result); return result;
end $$;

create function public.doctor_invite_secretary(p_practice uuid,p_email text,p_token_hash text,p_grants jsonb,p_key uuid) returns jsonb language sql security invoker set search_path='' as $$select doctor_private.invite_secretary(p_practice,p_email,p_token_hash,p_grants,p_key)$$;
create function public.doctor_invitation_details(p_invitation uuid,p_token text) returns jsonb language sql stable security invoker set search_path='' as $$select doctor_private.invitation_details(p_invitation,p_token)$$;
create function public.doctor_accept_secretary_invitation(p_invitation uuid,p_token text,p_key uuid) returns jsonb language sql security invoker set search_path='' as $$select doctor_private.accept_secretary_invitation(p_invitation,p_token,p_key)$$;
create function public.doctor_team(p_practice uuid,p_page integer default 0,p_size integer default 20,p_search text default '') returns jsonb language sql stable security invoker set search_path='' as $$select doctor_private.team(p_practice,p_page,p_size,p_search)$$;
create function public.doctor_cancel_secretary_invitation(p_practice uuid,p_invitation uuid,p_version integer,p_key uuid) returns jsonb language sql security invoker set search_path='' as $$select doctor_private.cancel_secretary_invitation(p_practice,p_invitation,p_version,p_key)$$;
create function public.doctor_set_membership_status(p_practice uuid,p_membership uuid,p_version integer,p_status text,p_key uuid) returns jsonb language sql security invoker set search_path='' as $$select doctor_private.set_membership_status(p_practice,p_membership,p_version,p_status,p_key)$$;

revoke all on function doctor_private.validate_grants(uuid,jsonb,boolean),doctor_private.owner_command(uuid,uuid,jsonb),doctor_private.invitation_for_actor(uuid,text),doctor_private.invite_secretary(uuid,text,text,jsonb,uuid),doctor_private.invitation_details(uuid,text),doctor_private.accept_secretary_invitation(uuid,text,uuid),doctor_private.team(uuid,integer,integer,text),doctor_private.cancel_secretary_invitation(uuid,uuid,integer,uuid),doctor_private.set_membership_status(uuid,uuid,integer,text,uuid) from public,anon,authenticated;
grant execute on function doctor_private.invite_secretary(uuid,text,text,jsonb,uuid),doctor_private.invitation_details(uuid,text),doctor_private.accept_secretary_invitation(uuid,text,uuid),doctor_private.team(uuid,integer,integer,text),doctor_private.cancel_secretary_invitation(uuid,uuid,integer,uuid),doctor_private.set_membership_status(uuid,uuid,integer,text,uuid) to authenticated;
revoke all on function public.doctor_invite_secretary(uuid,text,text,jsonb,uuid),public.doctor_invitation_details(uuid,text),public.doctor_accept_secretary_invitation(uuid,text,uuid),public.doctor_team(uuid,integer,integer,text),public.doctor_cancel_secretary_invitation(uuid,uuid,integer,uuid),public.doctor_set_membership_status(uuid,uuid,integer,text,uuid) from public,anon,authenticated;
grant execute on function public.doctor_invite_secretary(uuid,text,text,jsonb,uuid),public.doctor_invitation_details(uuid,text),public.doctor_accept_secretary_invitation(uuid,text,uuid),public.doctor_team(uuid,integer,integer,text),public.doctor_cancel_secretary_invitation(uuid,uuid,integer,uuid),public.doctor_set_membership_status(uuid,uuid,integer,text,uuid) to authenticated;
