-- ETA is an opt-in export capability; no sale triggers, backfills or credentials.
create table public.eta_profile_versions (
 id uuid primary key default gen_random_uuid(), shop_id uuid not null references public.shops(id), request_id uuid not null,
 configuration jsonb not null, reason text not null, actor_profile_id uuid not null references public.profiles(id),
 created_at timestamptz not null default clock_timestamp(), unique(shop_id,request_id), unique(id,shop_id)
);
create index eta_profile_latest on public.eta_profile_versions(shop_id,created_at desc,id desc);
create trigger eta_profile_immutable before update or delete on public.eta_profile_versions for each row execute function shop_private.tax_immutable();
-- Capture configured export identity/codes at issuance, never at later export time.
-- Missing setup never blocks an operational sale and never creates a backfill.
create table public.eta_sale_sources (
 invoice_id uuid primary key, shop_id uuid not null, location_id uuid not null, profile_version_id uuid not null,
 source jsonb not null, created_at timestamptz not null default clock_timestamp(),
 foreign key(invoice_id,shop_id,location_id) references public.invoices(id,shop_id,location_id),
 foreign key(profile_version_id,shop_id) references public.eta_profile_versions(id,shop_id)
);
create index eta_sale_source_scope on public.eta_sale_sources(shop_id,location_id,invoice_id);
alter table public.eta_sale_sources enable row level security;
revoke all on public.eta_sale_sources from public,anon,authenticated,service_role;
create trigger eta_sale_source_immutable before update or delete on public.eta_sale_sources for each row execute function shop_private.tax_immutable();
create function shop_private.capture_eta_source() returns trigger language plpgsql security definer set search_path='' as $$
declare profile public.eta_profile_versions%rowtype; branch jsonb; tax jsonb;
begin
 if old.status<>'draft' or new.status<>'issued' then return new;end if;
 -- Serialize profile selection with manager changes without altering the sale.
 perform 1 from public.shops where id=new.shop_id for update;
 select * into profile from public.eta_profile_versions where shop_id=new.shop_id order by created_at desc,id desc limit 1;
 select value into branch from jsonb_array_elements(profile.configuration->'branches') where value->>'locationId'=new.location_id::text;
 select snapshot into tax from public.sale_tax_snapshots where invoice_id=new.id and shop_id=new.shop_id;
 if branch is null or tax is null then return new;end if;
 insert into public.eta_sale_sources(invoice_id,shop_id,location_id,profile_version_id,source)
 values(new.id,new.shop_id,new.location_id,profile.id,jsonb_build_object('channel','ereceipt','kind','sale','currency',new.currency,
 'issuedAt',to_char(new.issued_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),'receiptNumber',new.invoice_number,
 'tax',tax,'profile',profile.configuration->'profile','branch',branch-'locationId','items',profile.configuration->'items',
 'names',(select jsonb_object_agg(id::text,item_name) from public.invoice_items where invoice_id=new.id)));
 return new;
end; $$;
revoke all on function shop_private.capture_eta_source() from public,anon,authenticated,service_role;
create trigger zz_eta_capture after update of status on public.invoices for each row execute function shop_private.capture_eta_source();
create table public.eta_pos_chains (
 shop_id uuid not null references public.shops(id), device_serial text not null, last_uuid text not null default '',
 primary key(shop_id,device_serial), check(last_uuid='' or last_uuid ~ '^[a-f0-9]{64}$')
);
create table public.eta_outbox (
 id uuid primary key default gen_random_uuid(), shop_id uuid not null, location_id uuid not null, invoice_id uuid not null,
 profile_version_id uuid not null, request_id uuid not null, device_serial text not null,
 source jsonb not null, adapter_version text not null default 'shop-ereceipt-1.2-v1',
 state text not null default 'queued' check(state in ('queued','prepared','submitting','retry','submitted','valid','invalid','cancelled','uncertain','blocked')),
 payload text, document_uuid text, submission_uuid text, lease_id uuid, lease_until timestamptz,
 attempts integer not null default 0, next_attempt_at timestamptz not null default now(), error_code text,
 created_at timestamptz not null default clock_timestamp(), updated_at timestamptz not null default clock_timestamp(),
 unique(shop_id,request_id), unique(shop_id,invoice_id), unique(shop_id,document_uuid),
 foreign key(invoice_id,shop_id,location_id) references public.invoices(id,shop_id,location_id),
 foreign key(profile_version_id,shop_id) references public.eta_profile_versions(id,shop_id),
 foreign key(shop_id,device_serial) references public.eta_pos_chains(shop_id,device_serial)
);
create index eta_outbox_due on public.eta_outbox(next_attempt_at,created_at,id) where state in ('queued','prepared','retry','submitted','submitting');
create index eta_outbox_pos on public.eta_outbox(shop_id,device_serial,created_at,id);
create table public.eta_audit_events (
 id bigint generated always as identity primary key, outbox_id uuid not null references public.eta_outbox(id),
 from_state text, to_state text not null, error_code text, created_at timestamptz not null default clock_timestamp()
);
create index eta_audit_outbox on public.eta_audit_events(outbox_id,id);
create trigger eta_audit_immutable before update or delete on public.eta_audit_events for each row execute function shop_private.tax_immutable();
alter table public.eta_profile_versions enable row level security;
alter table public.eta_pos_chains enable row level security;
alter table public.eta_outbox enable row level security;
alter table public.eta_audit_events enable row level security;
revoke all on public.eta_profile_versions,public.eta_pos_chains,public.eta_outbox,public.eta_audit_events from public,anon,authenticated;
-- Workers use narrow RPCs; no browser or direct service table mutation grants.
revoke all on public.eta_profile_versions,public.eta_pos_chains,public.eta_outbox,public.eta_audit_events from service_role;

create function shop_private.eta_audit() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='UPDATE' then
  if new.source<>old.source or new.shop_id<>old.shop_id or new.location_id<>old.location_id or new.invoice_id<>old.invoice_id
   or new.profile_version_id<>old.profile_version_id or new.request_id<>old.request_id or new.device_serial<>old.device_serial
   or new.adapter_version<>old.adapter_version or new.created_at<>old.created_at
   or (old.payload is not null and (new.payload is distinct from old.payload or new.document_uuid is distinct from old.document_uuid))
   or (old.submission_uuid is not null and new.submission_uuid is distinct from old.submission_uuid) then
   raise exception 'ETA_DOCUMENT_IMMUTABLE' using errcode='55000'; end if;
 end if;
 if tg_op='INSERT' or new.state is distinct from old.state or new.error_code is distinct from old.error_code then
  insert into public.eta_audit_events(outbox_id,from_state,to_state,error_code)
  values(new.id,case when tg_op='UPDATE' then old.state end,new.state,new.error_code);
 end if;
 return new;
end; $$;
revoke all on function shop_private.eta_audit() from public,anon,authenticated,service_role;
create trigger eta_audit after insert or update on public.eta_outbox for each row execute function shop_private.eta_audit();

create function public.save_eta_configuration(p_request_id uuid,p_shop_id uuid,p_configuration jsonb,p_reason text)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid; existing public.eta_profile_versions%rowtype; entry jsonb; result uuid;
begin
 actor:=shop_private.tax_manager(p_shop_id);
 perform shop_private.assert_location_access(p_shop_id,l.id,true) from public.shop_locations l where l.shop_id=p_shop_id;
 perform 1 from public.shops where id=p_shop_id for update;
 if p_request_id is null or length(btrim(coalesce(p_reason,''))) not between 2 and 1000
 or jsonb_typeof(p_configuration) is distinct from 'object' or (p_configuration-array['profile','branches','items'])<>'{}'::jsonb
 or jsonb_typeof(p_configuration->'profile') is distinct from 'object'
 or ((p_configuration->'profile')-array['legalName','rin','activityCode'])<>'{}'::jsonb
 or length(btrim(coalesce(p_configuration->'profile'->>'legalName',''))) not between 1 and 200
 or coalesce(p_configuration->'profile'->>'rin','') !~ '^[0-9]{9}$'
 or coalesce(p_configuration->'profile'->>'activityCode','') !~ '^[0-9]{4,10}$'
 or jsonb_typeof(p_configuration->'branches') is distinct from 'array' or jsonb_array_length(p_configuration->'branches')>100
 or jsonb_typeof(p_configuration->'items') is distinct from 'array' or jsonb_array_length(p_configuration->'items')>1000 then
 raise exception 'ETA_CONFIGURATION_INVALID' using errcode='22023'; end if;
 select * into existing from public.eta_profile_versions where shop_id=p_shop_id and request_id=p_request_id;
 if found then
 if existing.configuration<>p_configuration or existing.reason<>btrim(p_reason) or existing.actor_profile_id<>actor then raise exception 'ETA_REQUEST_CONFLICT' using errcode='23505'; end if;
 return existing.id; end if;
 if exists(select 1 from jsonb_array_elements(p_configuration->'branches') b group by b->>'locationId' having count(*)>1)
 or exists(select 1 from jsonb_array_elements(p_configuration->'branches') b group by b->>'deviceSerialNumber' having count(*)>1)
 or exists(select 1 from jsonb_array_elements(p_configuration->'items') i group by i->>'sourceType',i->>'sourceId' having count(*)>1) then raise exception 'ETA_DUPLICATE_CONFIGURATION' using errcode='22023'; end if;
 for entry in select value from jsonb_array_elements(p_configuration->'branches') loop
 if (entry-array['locationId','branchCode','deviceSerialNumber','address'])<>'{}'::jsonb
 or not exists(select 1 from public.shop_locations where id=(entry->>'locationId')::uuid and shop_id=p_shop_id)
 or length(btrim(coalesce(entry->>'branchCode',''))) not between 1 and 50
 or length(btrim(coalesce(entry->>'deviceSerialNumber',''))) not between 1 and 100
 or jsonb_typeof(entry->'address') is distinct from 'object'
 or ((entry->'address')-array['country','governate','regionCity','street','buildingNumber'])<>'{}'::jsonb
 or entry->'address'->>'country' is distinct from 'EG'
 or length(btrim(coalesce(entry->'address'->>'governate',''))) not between 1 and 100
 or length(btrim(coalesce(entry->'address'->>'regionCity',''))) not between 1 and 100
 or length(btrim(coalesce(entry->'address'->>'street',''))) not between 1 and 200
 or length(btrim(coalesce(entry->'address'->>'buildingNumber',''))) not between 1 and 100 then raise exception 'ETA_BRANCH_INVALID' using errcode='22023'; end if;
 perform shop_private.assert_location_access(p_shop_id,(entry->>'locationId')::uuid,true);
 -- An existing serial cannot move to another location and silently restart a chain.
 if exists(select 1 from public.eta_profile_versions v cross join lateral jsonb_array_elements(v.configuration->'branches') b
 where v.shop_id=p_shop_id and b->>'deviceSerialNumber'=entry->>'deviceSerialNumber' and b->>'locationId'<>entry->>'locationId') then raise exception 'ETA_POS_LOCATION_CONFLICT' using errcode='22023'; end if;
 end loop;
 for entry in select value from jsonb_array_elements(p_configuration->'items') loop
 if (entry-array['sourceType','sourceId','itemType','itemCode','unitType'])<>'{}'::jsonb
 or coalesce(entry->>'sourceType','') not in('product','service') or coalesce(entry->>'itemType','') not in('GS1','EGS')
 or length(coalesce(entry->>'itemCode','')) not between 1 and 100 or coalesce(entry->>'unitType','') !~ '^[A-Za-z0-9]{1,30}$'
 or (entry->>'itemType'='GS1' and entry->>'itemCode' !~ '^[0-9]{8,14}$')
 or (entry->>'itemType'='EGS' and entry->>'itemCode' !~ ('^EG-'||(p_configuration->'profile'->>'rin')||'-[A-Za-z0-9_-]+$'))
 or not ((entry->>'sourceType'='product' and exists(select 1 from public.products where shop_id=p_shop_id and id=(entry->>'sourceId')::uuid))
 or (entry->>'sourceType'='service' and exists(select 1 from public.services where shop_id=p_shop_id and id=(entry->>'sourceId')::uuid))) then raise exception 'ETA_ITEM_INVALID' using errcode='22023'; end if;
 end loop;
 insert into public.eta_profile_versions(shop_id,request_id,configuration,reason,actor_profile_id) values(p_shop_id,p_request_id,p_configuration,btrim(p_reason),actor) returning id into result;
 return result;
end; $$;
revoke all on function public.save_eta_configuration(uuid,uuid,jsonb,text) from public,anon,service_role;
grant execute on function public.save_eta_configuration(uuid,uuid,jsonb,text) to authenticated;

create function public.eta_settings(p_shop_id uuid,p_offset integer default 0) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 perform shop_private.tax_manager(p_shop_id);
 perform shop_private.assert_location_access(p_shop_id,l.id,true) from public.shop_locations l where l.shop_id=p_shop_id;
 return jsonb_build_object('configuration',(select configuration from public.eta_profile_versions where shop_id=p_shop_id order by created_at desc,id desc limit 1),
 'activation','not_activated','locations',coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'name',l.name)) from public.shop_locations l where l.shop_id=p_shop_id and shop_private.user_can_access_location(p_shop_id,l.id)),'[]'),
 'items',coalesce((select jsonb_agg(i) from (select id,name,'product' as "sourceType" from public.products where shop_id=p_shop_id union all select id,name,'service' from public.services where shop_id=p_shop_id)i),'[]'),
 'sales',coalesce((select jsonb_agg(s) from(select i.id,i.invoice_number as label from public.invoices i join public.eta_sale_sources e on e.invoice_id=i.id and e.shop_id=i.shop_id where i.shop_id=p_shop_id and i.status='issued' and shop_private.user_can_access_location(p_shop_id,i.location_id) and not exists(select 1 from public.eta_outbox o where o.shop_id=p_shop_id and o.invoice_id=i.id) order by i.issued_at desc,i.id desc limit 100)s),'[]'),
 'documents',coalesce((select jsonb_agg(d) from(select id,invoice_id,(select invoice_number from public.invoices i where i.id=o.invoice_id and i.shop_id=p_shop_id) as invoice_number,state,document_uuid,submission_uuid,error_code,created_at from public.eta_outbox o where shop_id=p_shop_id and shop_private.user_can_access_location(p_shop_id,o.location_id) order by created_at desc,id desc limit 50 offset greatest(0,least(coalesce(p_offset,0),100000)))d),'[]'));
end; $$;
revoke all on function public.eta_settings(uuid,integer) from public,anon,service_role;
grant execute on function public.eta_settings(uuid,integer) to authenticated;

create function public.queue_eta_receipt(p_request_id uuid,p_shop_id uuid,p_invoice_id uuid,p_buyer jsonb,p_payment_method text)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid; sale public.invoices%rowtype; profile public.eta_profile_versions%rowtype; branch jsonb; tax jsonb; source jsonb; existing public.eta_outbox%rowtype; result uuid;
begin
 actor:=shop_private.tax_manager(p_shop_id);
 select * into sale from public.invoices where id=p_invoice_id and shop_id=p_shop_id for update;
 if not found then raise exception 'ETA_SALE_NOT_FOUND' using errcode='42501'; end if;
 perform shop_private.assert_location_access(p_shop_id,sale.location_id,true);
 if p_request_id is null or sale.status<>'issued' then raise exception 'ETA_ISSUED_SALE_REQUIRED' using errcode='55000'; end if;
 if sale.currency<>'EGP' then raise exception 'ETA_EXPORT_EGP_ONLY' using errcode='22023'; end if;
 if jsonb_typeof(p_buyer) is distinct from 'object' or (p_buyer-array['type','id','name'])<>'{}'::jsonb
 or coalesce(p_buyer->>'type','') not in('P','F') or coalesce(p_payment_method,'') not in('C','V','CC','VC','VO','O') then raise exception 'ETA_B2C_BUYER_PAYMENT_REQUIRED' using errcode='22023'; end if;
 select * into existing from public.eta_outbox where shop_id=p_shop_id and request_id=p_request_id;
 if not found then select * into existing from public.eta_outbox where shop_id=p_shop_id and invoice_id=sale.id;end if;
 if found then
 if existing.invoice_id<>sale.id or existing.source->'buyer'<>p_buyer or existing.source->>'paymentMethod'<>p_payment_method then raise exception 'ETA_REQUEST_CONFLICT' using errcode='23505'; end if;
 return existing.id; end if;
 select e.source,e.profile_version_id into source,profile.id from public.eta_sale_sources e where e.invoice_id=sale.id and e.shop_id=p_shop_id and e.location_id=sale.location_id;
 if source is null then raise exception 'ETA_LEGACY_SNAPSHOT_UNSUPPORTED' using errcode='22023';end if;
 branch:=source->'branch';tax:=source->'tax';
 if not coalesce((tax->>'calculationEnabled')::boolean,false) then raise exception 'ETA_LEGACY_SNAPSHOT_UNSUPPORTED' using errcode='22023';end if;
 source:=source||jsonb_build_object('buyer',p_buyer,'paymentMethod',p_payment_method);
 insert into public.eta_pos_chains(shop_id,device_serial) values(p_shop_id,branch->>'deviceSerialNumber') on conflict do nothing;
 insert into public.eta_outbox(shop_id,location_id,invoice_id,profile_version_id,request_id,device_serial,source)
 values(p_shop_id,sale.location_id,sale.id,profile.id,p_request_id,branch->>'deviceSerialNumber',source) returning id into result;
 return result;
end; $$;
revoke all on function public.queue_eta_receipt(uuid,uuid,uuid,jsonb,text) from public,anon,service_role;
grant execute on function public.queue_eta_receipt(uuid,uuid,uuid,jsonb,text) to authenticated;

-- A short lease excludes parallel workers. A crashed POST is uncertain, never retried blindly.
create function public.shop_eta_claim() returns jsonb language plpgsql security definer set search_path='' as $$
declare job public.eta_outbox%rowtype; previous text;
begin
 update public.eta_outbox set state='uncertain',error_code='ETA_SUBMISSION_OUTCOME_UNKNOWN',lease_id=null,lease_until=null,updated_at=now()
 where state='submitting' and lease_until<now();
 select o.* into job from public.eta_outbox o
 where o.state in('queued','prepared','retry','submitted') and o.next_attempt_at<=now() and (o.lease_until is null or o.lease_until<now())
 and not exists(select 1 from public.eta_outbox earlier where earlier.shop_id=o.shop_id and earlier.device_serial=o.device_serial
 and (earlier.created_at,earlier.id)<(o.created_at,o.id) and earlier.state not in('valid','invalid','cancelled','blocked'))
 order by o.created_at,o.id for update skip locked limit 1;
 if not found then return null; end if;
 update public.eta_outbox set lease_id=gen_random_uuid(),lease_until=now()+interval '2 minutes',updated_at=now() where id=job.id returning * into job;
 select last_uuid into previous from public.eta_pos_chains where shop_id=job.shop_id and device_serial=job.device_serial;
 return to_jsonb(job)||jsonb_build_object('previous_uuid',previous);
end; $$;

create function public.shop_eta_prepare(p_id uuid,p_lease_id uuid,p_previous_uuid text,p_document_uuid text,p_payload text) returns void
language plpgsql security definer set search_path='' as $$
declare job public.eta_outbox%rowtype; previous text;
begin
 select * into job from public.eta_outbox where id=p_id for update;
 if not found or job.state<>'queued' or job.lease_id is distinct from p_lease_id or job.lease_until<now() then raise exception 'ETA_LEASE_CONFLICT' using errcode='55000'; end if;
 select last_uuid into previous from public.eta_pos_chains where shop_id=job.shop_id and device_serial=job.device_serial for update;
 if previous is distinct from p_previous_uuid or p_document_uuid !~ '^[a-f0-9]{64}$' or p_document_uuid is null
 or octet_length(p_payload)>1500000 or p_payload::jsonb->'receipts'->0->'header'->>'uuid' is distinct from p_document_uuid
 or p_payload::jsonb->'receipts'->0->'header'->>'previousUUID' is distinct from previous then raise exception 'ETA_CHAIN_CONFLICT' using errcode='55000'; end if;
 update public.eta_outbox set payload=p_payload,document_uuid=p_document_uuid,state='prepared',updated_at=now() where id=p_id;
 update public.eta_pos_chains set last_uuid=p_document_uuid where shop_id=job.shop_id and device_serial=job.device_serial;
end; $$;

create function public.shop_eta_transition(p_id uuid,p_lease_id uuid,p_state text,p_submission_uuid text default null,p_error_code text default null,p_retry_seconds integer default 60)
returns void language plpgsql security definer set search_path='' as $$
declare job public.eta_outbox%rowtype;
begin
 select * into job from public.eta_outbox where id=p_id for update;
 if not found or job.lease_id is distinct from p_lease_id or job.lease_until<now() then raise exception 'ETA_LEASE_CONFLICT' using errcode='55000'; end if;
 if p_error_code is not null and p_error_code !~ '^ETA_[A-Z0-9_]{1,100}$' then raise exception 'ETA_UNSAFE_ERROR' using errcode='22023'; end if;
 if not ((job.state in('prepared','retry') and p_state='submitting')
 or (job.state='queued' and p_state='blocked')
 or (job.state in('queued','prepared','retry') and p_state='retry')
 or (job.state='submitting' and p_state in('submitted','retry','invalid','uncertain'))
 or (job.state='submitted' and p_state in('submitted','valid','invalid','cancelled'))) then raise exception 'ETA_STATE_CONFLICT' using errcode='55000'; end if;
 if p_state='submitted' and coalesce(p_submission_uuid,job.submission_uuid) is null then raise exception 'ETA_SUBMISSION_ID_REQUIRED' using errcode='22023'; end if;
 if p_submission_uuid is not null and p_submission_uuid !~ '^[A-Za-z0-9_-]{1,100}$' then raise exception 'ETA_SUBMISSION_ID_INVALID' using errcode='22023'; end if;
 update public.eta_outbox set state=case when p_state='retry' and payload is null then 'queued' else p_state end,submission_uuid=coalesce(p_submission_uuid,submission_uuid),error_code=p_error_code,
 attempts=attempts+case when p_state='submitting' then 1 else 0 end,
 next_attempt_at=now()+make_interval(secs=>greatest(60,least(coalesce(p_retry_seconds,60),86400))),updated_at=now(),
 lease_id=case when p_state='submitting' then lease_id end,lease_until=case when p_state='submitting' then now()+interval '2 minutes' end where id=p_id;
end; $$;
revoke all on function public.shop_eta_claim(),public.shop_eta_prepare(uuid,uuid,text,text,text),public.shop_eta_transition(uuid,uuid,text,text,text,integer) from public,anon,authenticated;
grant execute on function public.shop_eta_claim(),public.shop_eta_prepare(uuid,uuid,text,text,text),public.shop_eta_transition(uuid,uuid,text,text,text,integer) to service_role;

-- Provider evidence must be checked by the server reconciler before invoking.
-- Browser managers cannot assert external success or reset uncertain documents.
create function public.shop_eta_recovery_context(p_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select to_jsonb(o) from public.eta_outbox o where o.id=p_id and o.state='uncertain';
$$;
create function public.shop_eta_link_recovery(p_id uuid,p_submission_uuid text,p_document_uuid text) returns void
language plpgsql security definer set search_path='' as $$
begin
 if p_submission_uuid is null or p_submission_uuid !~ '^[A-Za-z0-9_-]{1,100}$' then raise exception 'ETA_RECOVERY_EVIDENCE_REQUIRED' using errcode='22023'; end if;
 update public.eta_outbox set state='submitted',submission_uuid=p_submission_uuid,error_code='ETA_RECOVERED_FROM_PROVIDER_EVIDENCE',next_attempt_at=now()+interval '1 minute',updated_at=now()
 where id=p_id and state='uncertain' and document_uuid=p_document_uuid and submission_uuid is null;
 if not found then raise exception 'ETA_RECOVERY_CONFLICT' using errcode='55000'; end if;
end; $$;
revoke all on function public.shop_eta_recovery_context(uuid),public.shop_eta_link_recovery(uuid,text,text) from public,anon,authenticated;
grant execute on function public.shop_eta_recovery_context(uuid),public.shop_eta_link_recovery(uuid,text,text) to service_role;
