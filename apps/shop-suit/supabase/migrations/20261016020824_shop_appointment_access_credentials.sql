-- SS-WEB-APPT-ACCESS-001. Credential/session foundation only: no customer history,
-- public booking, delivery provider, subscription change or existing opt-in.
-- Keep secrets outside appointments: existing audit snapshots must remain secret-free.
create table public.appointment_access_credentials (
 id uuid primary key default gen_random_uuid(),
 shop_id uuid not null references public.shops(id) on delete restrict,
 appointment_id uuid not null,
 customer_id uuid,
 code_hash bytea not null unique check(octet_length(code_hash)=32),
 phone_hash bytea not null check(octet_length(phone_hash)=32),
 issued_by_profile_id uuid not null references public.profiles(id) on delete restrict,
 issued_at timestamptz not null default clock_timestamp(),
 revoked_at timestamptz,
 unique(id,shop_id),
 foreign key(appointment_id,shop_id) references public.appointments(id,shop_id) on delete restrict,
 foreign key(customer_id,shop_id) references public.clients(id,shop_id) on delete restrict
);
create unique index appointment_access_active_credential on public.appointment_access_credentials(appointment_id) where revoked_at is null;
create index appointment_access_shop_appointment on public.appointment_access_credentials(shop_id,appointment_id);
create table public.appointment_access_sessions (
 id uuid primary key default gen_random_uuid(),
 shop_id uuid not null references public.shops(id) on delete restrict,
 credential_id uuid not null,
 token_hash bytea not null unique check(octet_length(token_hash)=32),
 created_at timestamptz not null default clock_timestamp(),
 expires_at timestamptz not null,
 revoked_at timestamptz,
 foreign key(credential_id,shop_id) references public.appointment_access_credentials(id,shop_id) on delete restrict,
 check(expires_at>created_at and expires_at<=created_at+interval '10 minutes')
);
create index appointment_access_sessions_credential on public.appointment_access_sessions(credential_id) where revoked_at is null;
create table public.appointment_access_rate_windows (
 scope_key bytea primary key check(octet_length(scope_key)=32),
 window_started_at timestamptz not null,
 attempts integer not null check(attempts between 1 and 101)
);
create index appointment_access_rates_expiry on public.appointment_access_rate_windows(window_started_at);
create table public.appointment_access_events (
 id uuid primary key default gen_random_uuid(),
 shop_id uuid not null references public.shops(id) on delete restrict,
 appointment_id uuid,
 credential_id uuid,
 actor_profile_id uuid references public.profiles(id) on delete restrict,
 action text not null check(action in ('issued','rotated','revoked','verification_denied','verified','session_rotated','session_revoked')),
 occurred_at timestamptz not null default clock_timestamp(),
 foreign key(appointment_id,shop_id) references public.appointments(id,shop_id) on delete restrict,
 foreign key(credential_id,shop_id) references public.appointment_access_credentials(id,shop_id) on delete restrict
);
create index appointment_access_events_shop on public.appointment_access_events(shop_id,occurred_at desc);
alter table public.appointment_access_credentials enable row level security;
alter table public.appointment_access_sessions enable row level security;
alter table public.appointment_access_rate_windows enable row level security;
alter table public.appointment_access_events enable row level security;
revoke all on public.appointment_access_credentials,public.appointment_access_sessions,public.appointment_access_rate_windows,public.appointment_access_events from public,anon,authenticated,service_role;

create function shop_private.appointment_access_hash(p_value text) returns bytea
language sql immutable strict set search_path='' as $$select extensions.digest(convert_to(p_value,'UTF8'),'sha256')$$;
create function shop_private.appointment_access_phone(p_value text) returns text
language plpgsql immutable set search_path='' as $$
declare raw text:=translate(btrim(p_value),'٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹','01234567890123456789'); digits text;
begin
 if raw is null or length(raw)>40 or raw !~ '^\+?[0-9][0-9 ().-]{5,39}$' then return null;end if;
 digits:=regexp_replace(raw,'[^0-9]','','g');
 if raw like '00%' then digits:=substr(digits,3);end if;
 if length(digits) not between 7 and 15 then return null;end if;
 return digits;
end$$;
create function shop_private.appointment_access_code(p_value text) returns text
language sql immutable set search_path='' as $$
 select case when length(p_value)<=32 and upper(regexp_replace(p_value,'[ -]','','g')) ~ '^[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{12}$'
 then upper(regexp_replace(p_value,'[ -]','','g')) end;
$$;
create function shop_private.appointment_access_random_code() returns text
language plpgsql volatile set search_path='' as $$
declare bytes bytea:=extensions.gen_random_bytes(12); result text:=''; alphabet constant text:='0123456789ABCDEFGHJKMNPQRSTVWXYZ';i integer;
begin
 -- 256 is divisible by 32: twelve independent unbiased symbols = 60 bits.
 for i in 0..11 loop result:=result||substr(alphabet,(get_byte(bytes,i)%32)+1,1);end loop;
 return result;
end$$;
create function shop_private.appointment_access_random_token() returns text
language sql volatile set search_path='' as $$select translate(rtrim(encode(extensions.gen_random_bytes(32),'base64'),'='),'+/','-_')$$;
create function shop_private.appointment_access_current_phone(p_appointment_id uuid,p_shop_id uuid,p_customer_id uuid) returns text
language sql stable set search_path='' as $$
 select shop_private.appointment_access_phone(case when a.identity_kind='customer' then c.phone else a.walk_in_phone end)
 from public.appointments a left join public.clients c on c.id=a.client_id and c.shop_id=a.shop_id and c.is_active
 where a.id=p_appointment_id and a.shop_id=p_shop_id and a.client_id is not distinct from p_customer_id
 and ((a.identity_kind='customer' and c.id is not null) or(a.identity_kind='walk_in' and a.client_id is null));
$$;
create function shop_private.appointment_access_staff(p_shop_id uuid,p_appointment_id uuid) returns uuid
language plpgsql set search_path='' as $$
declare actor uuid;location uuid;
begin
 actor:=shop_private.appointment_actor_profile(p_shop_id,'appointments.manage');
 select a.location_id into location from public.appointments a join public.shops s on s.id=a.shop_id and s.status='active' where a.id=p_appointment_id and a.shop_id=p_shop_id;
 if location is null or not shop_private.user_can_access_location(p_shop_id,location) then raise exception 'SHOP_PERMISSION_DENIED' using errcode='42501';end if;
 return actor;
end$$;
create function public.appointment_access_issue(p_shop_id uuid,p_appointment_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid; customer uuid; phone text; code text; credential uuid; previous boolean; i integer;
begin
 actor:=shop_private.appointment_access_staff(p_shop_id,p_appointment_id);
 perform 1 from public.shops where id=p_shop_id for update;
 actor:=shop_private.appointment_access_staff(p_shop_id,p_appointment_id);
 select client_id into customer from public.appointments where id=p_appointment_id and shop_id=p_shop_id for update;
 if customer is not null then perform 1 from public.clients where id=customer and shop_id=p_shop_id for share;end if;
 phone:=shop_private.appointment_access_current_phone(p_appointment_id,p_shop_id,customer);
 if phone is null then raise exception 'APPOINTMENT_ACCESS_PHONE_REQUIRED' using errcode='22023';end if;
 select exists(select from public.appointment_access_credentials where appointment_id=p_appointment_id and revoked_at is null) into previous;
 update public.appointment_access_sessions set revoked_at=clock_timestamp() where credential_id in(select id from public.appointment_access_credentials where appointment_id=p_appointment_id) and revoked_at is null;
 update public.appointment_access_credentials set revoked_at=clock_timestamp() where appointment_id=p_appointment_id and revoked_at is null;
 for i in 1..5 loop
  code:=shop_private.appointment_access_random_code();
  insert into public.appointment_access_credentials(shop_id,appointment_id,customer_id,code_hash,phone_hash,issued_by_profile_id)
  values(p_shop_id,p_appointment_id,customer,shop_private.appointment_access_hash(code),shop_private.appointment_access_hash(phone),actor)
  on conflict(code_hash) do nothing returning id into credential;
  exit when credential is not null;
 end loop;
 if credential is null then raise exception 'APPOINTMENT_ACCESS_UNAVAILABLE' using errcode='55000';end if;
 insert into public.appointment_access_events(shop_id,appointment_id,credential_id,actor_profile_id,action) values(p_shop_id,p_appointment_id,credential,actor,case when previous then 'rotated' else 'issued' end);
 -- One-time authorized response; plaintext is never persisted or recoverable.
 return jsonb_build_object('code',substr(code,1,4)||'-'||substr(code,5,4)||'-'||substr(code,9,4));
end$$;
create function public.appointment_access_revoke(p_shop_id uuid,p_appointment_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare actor uuid;
begin
 actor:=shop_private.appointment_access_staff(p_shop_id,p_appointment_id);
 perform 1 from public.shops where id=p_shop_id for update;
 actor:=shop_private.appointment_access_staff(p_shop_id,p_appointment_id);
 update public.appointment_access_sessions set revoked_at=clock_timestamp() where credential_id in(select id from public.appointment_access_credentials where appointment_id=p_appointment_id and shop_id=p_shop_id) and revoked_at is null;
 update public.appointment_access_credentials set revoked_at=clock_timestamp() where appointment_id=p_appointment_id and shop_id=p_shop_id and revoked_at is null;
 insert into public.appointment_access_events(shop_id,appointment_id,actor_profile_id,action) values(p_shop_id,p_appointment_id,actor,'revoked');
end$$;
create function shop_private.appointment_access_rate(p_key text,p_limit integer) returns boolean
language plpgsql set search_path='' as $$
declare count integer;
begin
 insert into public.appointment_access_rate_windows(scope_key,window_started_at,attempts) values(shop_private.appointment_access_hash(p_key),clock_timestamp(),1)
 on conflict(scope_key) do update set
 attempts=case when appointment_access_rate_windows.window_started_at+interval '10 minutes'<=clock_timestamp() then 1 else least(appointment_access_rate_windows.attempts+1,p_limit+1) end,
 window_started_at=case when appointment_access_rate_windows.window_started_at+interval '10 minutes'<=clock_timestamp() then clock_timestamp() else appointment_access_rate_windows.window_started_at end
 returning attempts into count;
 return count<=p_limit;
end$$;
create function public.appointment_access_verify(p_slug text,p_code text,p_phone text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare shop uuid; code text:=shop_private.appointment_access_code(p_code); phone text:=shop_private.appointment_access_phone(p_phone);
 credential public.appointment_access_credentials%rowtype; token text; expiry timestamptz; allowed boolean; more boolean;
begin
 select c.shop_id into shop from public.shop_website_slug_claims c where c.slug=p_slug;
 if shop is null then return '{"ok":false}'::jsonb;end if;
 perform 1 from public.shops where id=shop for update;
 if public.shop_website_public_profile(p_slug) is null then return '{"ok":false}'::jsonb;end if;
 delete from public.appointment_access_rate_windows where window_started_at<clock_timestamp()-interval '1 day';
 allowed:=shop_private.appointment_access_rate('shop:'||shop::text,100);
 if not allowed then return '{"ok":false}'::jsonb;end if;
 more:=shop_private.appointment_access_rate('code:'||shop::text||':'||coalesce(code,'invalid'),5);allowed:=allowed and more;
 more:=shop_private.appointment_access_rate('phone:'||shop::text||':'||coalesce(phone,'invalid'),10);allowed:=allowed and more;
 select * into credential from public.appointment_access_credentials c where c.shop_id=shop and c.code_hash=shop_private.appointment_access_hash(code) and c.revoked_at is null;
 if not allowed or credential.id is null or phone is null or credential.phone_hash<>shop_private.appointment_access_hash(phone)
 or credential.phone_hash is distinct from shop_private.appointment_access_hash(shop_private.appointment_access_current_phone(credential.appointment_id,shop,credential.customer_id)) then
  insert into public.appointment_access_events(shop_id,action) values(shop,'verification_denied');
  return '{"ok":false}'::jsonb;
 end if;
 token:=shop_private.appointment_access_random_token();expiry:=clock_timestamp()+interval '10 minutes';
 insert into public.appointment_access_sessions(shop_id,credential_id,token_hash,expires_at) values(shop,credential.id,shop_private.appointment_access_hash(token),expiry);
 insert into public.appointment_access_events(shop_id,appointment_id,credential_id,action) values(shop,credential.appointment_id,credential.id,'verified');
 return jsonb_build_object('ok',true,'token',token,'expiresAt',expiry);
exception when others then return '{"ok":false}'::jsonb;
end$$;
-- Future CUSTOMER-PORTAL projections must call this private boundary inside their
-- own narrowly allowlisted RPC. This task returns no appointment/customer data.
create function shop_private.appointment_access_scope(p_slug text,p_token text) returns jsonb
language plpgsql set search_path='' as $$
declare session public.appointment_access_sessions%rowtype; credential public.appointment_access_credentials%rowtype; shop uuid;
begin
 if p_token is null or length(p_token)<>43 or p_token !~ '^[A-Za-z0-9_-]{43}$' then return null;end if;
 select c.shop_id into shop from public.shop_website_slug_claims c where c.slug=p_slug;
 if shop is null or public.shop_website_public_profile(p_slug) is null then return null;end if;
 select * into session from public.appointment_access_sessions where shop_id=shop and token_hash=shop_private.appointment_access_hash(p_token) and revoked_at is null and expires_at>clock_timestamp();
 if session.id is null then return null;end if;
 select * into credential from public.appointment_access_credentials where id=session.credential_id and shop_id=shop and revoked_at is null;
 if credential.id is null or credential.phone_hash is distinct from shop_private.appointment_access_hash(shop_private.appointment_access_current_phone(credential.appointment_id,shop,credential.customer_id)) then return null;end if;
 return jsonb_build_object('shopId',shop,'customerId',credential.customer_id,'appointmentId',case when credential.customer_id is null then credential.appointment_id end,'credentialId',credential.id,'sessionId',session.id,'expiresAt',session.expires_at);
end$$;
create function public.appointment_access_session_validate(p_slug text,p_token text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare scope jsonb;
begin
 scope:=shop_private.appointment_access_scope(p_slug,p_token);
 if scope is null then return '{"ok":false}'::jsonb;end if;
 return jsonb_build_object('ok',true,'expiresAt',scope->'expiresAt');
exception when others then return '{"ok":false}'::jsonb;
end$$;
create function public.appointment_access_session_rotate(p_slug text,p_token text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare scope jsonb; shop uuid; token text; result jsonb;
begin
 select c.shop_id into shop from public.shop_website_slug_claims c where c.slug=p_slug;
 if shop is null then return '{"ok":false}'::jsonb;end if;
 perform 1 from public.shops where id=shop for update;
 scope:=shop_private.appointment_access_scope(p_slug,p_token);
 if scope is null then return '{"ok":false}'::jsonb;end if;
 token:=shop_private.appointment_access_random_token();
 update public.appointment_access_sessions set token_hash=shop_private.appointment_access_hash(token) where id=(scope->>'sessionId')::uuid and revoked_at is null;
 insert into public.appointment_access_events(shop_id,credential_id,action) values(shop,(scope->>'credentialId')::uuid,'session_rotated');
 return jsonb_build_object('ok',true,'token',token,'expiresAt',scope->'expiresAt');
exception when others then return '{"ok":false}'::jsonb;
end$$;
create function public.appointment_access_session_revoke(p_slug text,p_token text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare shop uuid;credential uuid;
begin
 if p_token is null or p_token !~ '^[A-Za-z0-9_-]{43}$' then return '{"ok":true}'::jsonb;end if;
 select c.shop_id into shop from public.shop_website_slug_claims c where c.slug=p_slug;
 if shop is null then return '{"ok":true}'::jsonb;end if;
 perform 1 from public.shops where id=shop for update;
 -- Possession may revoke even an expired/unpublished session; no read authority
 -- or publication readiness is needed to give up access.
 update public.appointment_access_sessions set revoked_at=clock_timestamp()
 where shop_id=shop and token_hash=shop_private.appointment_access_hash(p_token) and revoked_at is null returning credential_id into credential;
 if credential is not null then insert into public.appointment_access_events(shop_id,credential_id,action) values(shop,credential,'session_revoked');end if;
 return '{"ok":true}'::jsonb;
exception when others then return '{"ok":false}'::jsonb;
end$$;
revoke all on function shop_private.appointment_access_hash(text),shop_private.appointment_access_phone(text),shop_private.appointment_access_code(text),shop_private.appointment_access_random_code(),shop_private.appointment_access_random_token(),shop_private.appointment_access_current_phone(uuid,uuid,uuid),shop_private.appointment_access_staff(uuid,uuid),shop_private.appointment_access_rate(text,integer),shop_private.appointment_access_scope(text,text) from public,anon,authenticated,service_role;
revoke all on function public.appointment_access_issue(uuid,uuid),public.appointment_access_revoke(uuid,uuid),public.appointment_access_verify(text,text,text),public.appointment_access_session_validate(text,text),public.appointment_access_session_rotate(text,text),public.appointment_access_session_revoke(text,text) from public,anon,authenticated,service_role;
grant execute on function public.appointment_access_issue(uuid,uuid),public.appointment_access_revoke(uuid,uuid) to authenticated;
grant execute on function public.appointment_access_verify(text,text,text),public.appointment_access_session_validate(text,text),public.appointment_access_session_rotate(text,text),public.appointment_access_session_revoke(text,text) to anon,authenticated;

-- Identity/phone changes revoke permanently; schedule/notes edits leave codes alone.
create function shop_private.appointment_access_identity_changed() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if tg_table_name='appointments' then
  if (old.client_id,old.identity_kind) is not distinct from (new.client_id,new.identity_kind)
   and shop_private.appointment_access_phone(old.walk_in_phone) is not distinct from shop_private.appointment_access_phone(new.walk_in_phone) then return new;end if;
  with revoked as(update public.appointment_access_credentials set revoked_at=clock_timestamp() where appointment_id=new.id and shop_id=new.shop_id and revoked_at is null returning id,shop_id,appointment_id) insert into public.appointment_access_events(shop_id,appointment_id,credential_id,action) select shop_id,appointment_id,id,'revoked' from revoked;
 else
  if shop_private.appointment_access_phone(old.phone) is not distinct from shop_private.appointment_access_phone(new.phone) and new.is_active then return new;end if;
  with revoked as(update public.appointment_access_credentials set revoked_at=clock_timestamp() where customer_id=new.id and shop_id=new.shop_id and revoked_at is null returning id,shop_id,appointment_id) insert into public.appointment_access_events(shop_id,appointment_id,credential_id,action) select shop_id,appointment_id,id,'revoked' from revoked;
 end if;
 update public.appointment_access_sessions s set revoked_at=clock_timestamp() where s.revoked_at is null and exists(select from public.appointment_access_credentials c where c.id=s.credential_id and c.shop_id=s.shop_id and c.shop_id=new.shop_id and c.revoked_at is not null and ((tg_table_name='appointments' and c.appointment_id=new.id) or (tg_table_name='clients' and c.customer_id=new.id)));
 return new;
end$$;
revoke all on function shop_private.appointment_access_identity_changed() from public,anon,authenticated,service_role;
create trigger appointment_access_appointment_identity after update of client_id,identity_kind,walk_in_phone on public.appointments for each row execute function shop_private.appointment_access_identity_changed();
create trigger appointment_access_customer_identity after update of phone,is_active on public.clients for each row execute function shop_private.appointment_access_identity_changed();
create function public.appointment_access_status(p_shop_id uuid,p_appointment_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare customer uuid;issued timestamptz;
begin
 perform shop_private.appointment_access_staff(p_shop_id,p_appointment_id);
 select client_id into customer from public.appointments where id=p_appointment_id and shop_id=p_shop_id;
 select issued_at into issued from public.appointment_access_credentials where appointment_id=p_appointment_id and shop_id=p_shop_id and revoked_at is null;
 return jsonb_build_object('enabled',issued is not null,'usablePhone',shop_private.appointment_access_current_phone(p_appointment_id,p_shop_id,customer) is not null,'issuedAt',issued);
end$$;
revoke all on function public.appointment_access_status(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.appointment_access_status(uuid,uuid) to authenticated;

notify pgrst,'reload schema';
