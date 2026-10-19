-- DOS-AE-002: trusted effective editor permissions, including owners with no active clinic.
-- Historical grant arrays remain unchanged and are not effective permission claims.
create or replace function doctor_private.team(p_practice uuid,p_page integer,p_size integer,p_search text) returns jsonb
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
 return jsonb_build_object('edition',doctor_private.edition_mode(),'edition_revision',(select revision from public.doctor_edition_policy where singleton),'available_capabilities',doctor_private.edition_capabilities(),'practice_id',p_practice,'practice_name',(select name from public.practices where id=p_practice),'members',members,'invitations',invitations,'locations',locations,'member_total',total,'invitation_total',invitation_total,
  'location_total',(select count(*) from public.locations where practice_id=p_practice));
end $$;
