-- Invoice transport is distinct from receipt/POS transport; never backfill identity.
alter table public.eta_outbox add column channel text not null default 'ereceipt' check(channel in('ereceipt','einvoice'));
alter table public.eta_outbox alter column device_serial drop not null;
alter table public.eta_outbox add constraint eta_channel_pos check((channel='ereceipt' and device_serial is not null) or(channel='einvoice' and device_serial is null));
alter table public.eta_outbox add column payload_hash text;
alter table public.eta_outbox add column signing_certificate_fingerprint text;
alter table public.eta_outbox add column created_by_profile_id uuid references public.profiles(id);
create index eta_invoice_due on public.eta_outbox(next_attempt_at,created_at,id) where channel='einvoice' and state in('queued','prepared','retry','submitted','submitting');
create or replace function shop_private.eta_audit() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='UPDATE' then
  if (new.channel='ereceipt' and old.payload is not null and new.document_uuid is distinct from old.document_uuid)
   or (new.channel='einvoice' and old.document_uuid is null and new.document_uuid is not null and new.state<>'submitted')
   or new.source<>old.source or new.shop_id<>old.shop_id or new.location_id<>old.location_id or new.invoice_id<>old.invoice_id
   or new.profile_version_id<>old.profile_version_id or new.request_id<>old.request_id or new.device_serial<>old.device_serial
   or new.channel<>old.channel or new.created_by_profile_id is distinct from old.created_by_profile_id
   or new.adapter_version<>old.adapter_version or new.created_at<>old.created_at
   or (old.payload is not null and (new.payload is distinct from old.payload or (old.document_uuid is not null and new.document_uuid is distinct from old.document_uuid) or new.payload_hash is distinct from old.payload_hash or new.signing_certificate_fingerprint is distinct from old.signing_certificate_fingerprint))
   or (old.submission_uuid is not null and new.submission_uuid is distinct from old.submission_uuid) then
   raise exception 'ETA_DOCUMENT_IMMUTABLE' using errcode='55000'; end if;
 end if;
 if tg_op='INSERT' or new.state is distinct from old.state or new.error_code is distinct from old.error_code then
  insert into public.eta_audit_events(outbox_id,from_state,to_state,error_code)
  values(new.id,case when tg_op='UPDATE' then old.state end,new.state,new.error_code);
 end if;
 return new;
end; $$;
create or replace function public.save_eta_configuration(p_request_id uuid,p_shop_id uuid,p_configuration jsonb,p_reason text)
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
 or exists(select 1 from jsonb_array_elements(p_configuration->'branches') b where coalesce(b->>'deviceSerialNumber','')<>'' group by b->>'deviceSerialNumber' having count(*)>1)
 or exists(select 1 from jsonb_array_elements(p_configuration->'items') i group by i->>'sourceType',i->>'sourceId' having count(*)>1) then raise exception 'ETA_DUPLICATE_CONFIGURATION' using errcode='22023'; end if;
 for entry in select value from jsonb_array_elements(p_configuration->'branches') loop
 if (entry-array['locationId','branchCode','deviceSerialNumber','address'])<>'{}'::jsonb
 or not exists(select 1 from public.shop_locations where id=(entry->>'locationId')::uuid and shop_id=p_shop_id)
 or length(btrim(coalesce(entry->>'branchCode',''))) not between 1 and 50
 or length(btrim(coalesce(entry->>'deviceSerialNumber',''))) not between 0 and 100
 or jsonb_typeof(entry->'address') is distinct from 'object'
 or ((entry->'address')-array['country','governate','regionCity','street','buildingNumber'])<>'{}'::jsonb
 or entry->'address'->>'country' is distinct from 'EG'
 or length(btrim(coalesce(entry->'address'->>'governate',''))) not between 1 and 100
 or length(btrim(coalesce(entry->'address'->>'regionCity',''))) not between 1 and 100
 or length(btrim(coalesce(entry->'address'->>'street',''))) not between 1 and 200
 or length(btrim(coalesce(entry->'address'->>'buildingNumber',''))) not between 1 and 100 then raise exception 'ETA_BRANCH_INVALID' using errcode='22023'; end if;
 perform shop_private.assert_location_access(p_shop_id,(entry->>'locationId')::uuid,true);
 -- An existing serial cannot move to another location and silently restart a chain.
 if coalesce(entry->>'deviceSerialNumber','')<>'' and exists(select 1 from public.eta_profile_versions v cross join lateral jsonb_array_elements(v.configuration->'branches') b
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
create or replace function public.queue_eta_receipt(p_request_id uuid,p_shop_id uuid,p_invoice_id uuid,p_buyer jsonb,p_payment_method text)
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
 if existing.channel<>'ereceipt' or existing.invoice_id<>sale.id or existing.source->'buyer'<>p_buyer or existing.source->>'paymentMethod'<>p_payment_method then raise exception 'ETA_REQUEST_CONFLICT' using errcode='23505'; end if;
 return existing.id; end if;
 select e.source,e.profile_version_id into source,profile.id from public.eta_sale_sources e where e.invoice_id=sale.id and e.shop_id=p_shop_id and e.location_id=sale.location_id;
 if source is null then raise exception 'ETA_LEGACY_SNAPSHOT_UNSUPPORTED' using errcode='22023';end if;
 branch:=source->'branch';tax:=source->'tax';
 if length(btrim(coalesce(branch->>'deviceSerialNumber',''))) not between 1 and 100 then raise exception 'ETA_RECEIPT_POS_REQUIRED' using errcode='22023';end if;
 if not coalesce((tax->>'calculationEnabled')::boolean,false) then raise exception 'ETA_LEGACY_SNAPSHOT_UNSUPPORTED' using errcode='22023';end if;
 source:=source||jsonb_build_object('buyer',p_buyer,'paymentMethod',p_payment_method);
 insert into public.eta_pos_chains(shop_id,device_serial) values(p_shop_id,branch->>'deviceSerialNumber') on conflict do nothing;
 insert into public.eta_outbox(shop_id,location_id,invoice_id,profile_version_id,request_id,device_serial,source,created_by_profile_id)
 values(p_shop_id,sale.location_id,sale.id,profile.id,p_request_id,branch->>'deviceSerialNumber',source,actor) returning id into result;
 return result;
end; $$;
create or replace function public.shop_eta_claim() returns jsonb language plpgsql security definer set search_path='' as $$
declare job public.eta_outbox%rowtype; previous text;
begin
 update public.eta_outbox set state='uncertain',error_code='ETA_SUBMISSION_OUTCOME_UNKNOWN',lease_id=null,lease_until=null,updated_at=now()
 where channel='ereceipt' and state='submitting' and lease_until<now();
 select o.* into job from public.eta_outbox o
 where o.channel='ereceipt' and o.state in('queued','prepared','retry','submitted') and o.next_attempt_at<=now() and (o.lease_until is null or o.lease_until<now())
 and not exists(select 1 from public.eta_outbox earlier where earlier.shop_id=o.shop_id and earlier.device_serial=o.device_serial
 and (earlier.created_at,earlier.id)<(o.created_at,o.id) and earlier.state not in('valid','invalid','cancelled','blocked'))
 order by o.created_at,o.id for update skip locked limit 1;
 if not found then return null; end if;
 update public.eta_outbox set lease_id=gen_random_uuid(),lease_until=now()+interval '2 minutes',updated_at=now() where id=job.id returning * into job;
 select last_uuid into previous from public.eta_pos_chains where shop_id=job.shop_id and device_serial=job.device_serial;
 return to_jsonb(job)||jsonb_build_object('previous_uuid',previous);
end; $$;

create or replace function public.shop_eta_recovery_context(p_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select to_jsonb(o) from public.eta_outbox o where o.id=p_id and o.channel='ereceipt' and o.state='uncertain';
$$;
create or replace function public.shop_eta_link_recovery(p_id uuid,p_submission_uuid text,p_document_uuid text) returns void
language plpgsql security definer set search_path='' as $$
begin
 if p_submission_uuid is null or p_submission_uuid !~ '^[A-Za-z0-9_-]{1,100}$' then raise exception 'ETA_RECOVERY_EVIDENCE_REQUIRED' using errcode='22023'; end if;
 update public.eta_outbox set state='submitted',submission_uuid=p_submission_uuid,error_code='ETA_RECOVERED_FROM_PROVIDER_EVIDENCE',next_attempt_at=now()+interval '1 minute',updated_at=now()
 where id=p_id and channel='ereceipt' and state='uncertain' and document_uuid=p_document_uuid and submission_uuid is null;
 if not found then raise exception 'ETA_RECOVERY_CONFLICT' using errcode='55000'; end if;
end; $$;

create function public.queue_eta_invoice(p_request_id uuid,p_shop_id uuid,p_invoice_id uuid,p_receiver jsonb,p_reason text)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid; sale public.invoices%rowtype; original public.eta_sale_sources%rowtype; existing public.eta_outbox%rowtype; source jsonb; result uuid; field text;
begin
 actor:=shop_private.tax_manager(p_shop_id);
 select * into sale from public.invoices where id=p_invoice_id and shop_id=p_shop_id for update;
 if not found then raise exception 'ETA_SALE_NOT_FOUND' using errcode='42501';end if;
 perform shop_private.assert_location_access(p_shop_id,sale.location_id,true);
 if p_request_id is null or sale.status<>'issued' then raise exception 'ETA_ISSUED_SALE_REQUIRED' using errcode='55000';end if;
 if sale.currency<>'EGP' then raise exception 'ETA_EXPORT_EGP_ONLY' using errcode='22023';end if;
 if length(btrim(coalesce(p_reason,''))) not between 2 and 1000 or jsonb_typeof(p_receiver) is distinct from 'object'
 or (p_receiver-array['type','id','name','address'])<>'{}'::jsonb or p_receiver->>'type' is distinct from 'B'
 or coalesce(p_receiver->>'id','') !~ '^[0-9]{9}$' or length(btrim(coalesce(p_receiver->>'name',''))) not between 1 and 200
 or jsonb_typeof(p_receiver->'address') is distinct from 'object'
 or ((p_receiver->'address')-array['country','governate','regionCity','street','buildingNumber'])<>'{}'::jsonb
 or p_receiver->'address'->>'country' is distinct from 'EG' then raise exception 'ETA_EINVOICE_RECEIVER_REQUIRED' using errcode='22023';end if;
 foreach field in array array['governate','regionCity','street','buildingNumber'] loop
 if length(btrim(coalesce(p_receiver->'address'->>field,''))) not between 1 and (case when field='street' then 200 else 100 end) then raise exception 'ETA_EINVOICE_RECEIVER_ADDRESS_REQUIRED' using errcode='22023';end if;
 end loop;
 select * into existing from public.eta_outbox where shop_id=p_shop_id and request_id=p_request_id;
 if not found then select * into existing from public.eta_outbox where shop_id=p_shop_id and invoice_id=sale.id;end if;
 if found then
 if existing.channel<>'einvoice' or existing.invoice_id<>sale.id or existing.source->'receiver'<>p_receiver
 or existing.source->'receiverReview'->>'reason'<>btrim(p_reason) then raise exception 'ETA_REQUEST_CONFLICT' using errcode='23505';end if;
 return existing.id;end if;
 select * into original from public.eta_sale_sources where invoice_id=sale.id and shop_id=p_shop_id and location_id=sale.location_id;
 if not found or not coalesce((original.source->'tax'->>'calculationEnabled')::boolean,false) then raise exception 'ETA_LEGACY_SNAPSHOT_UNSUPPORTED' using errcode='22023';end if;
 if p_receiver->>'id'=original.source->'profile'->>'rin' then raise exception 'ETA_EINVOICE_RECEIVER_REQUIRED' using errcode='22023';end if;
 source:=original.source||jsonb_build_object('channel','einvoice','receiver',p_receiver,'receiverReview',jsonb_build_object('reason',btrim(p_reason),'actorProfileId',actor));
 insert into public.eta_outbox(shop_id,location_id,invoice_id,profile_version_id,request_id,device_serial,source,channel,adapter_version,created_by_profile_id)
 values(p_shop_id,sale.location_id,sale.id,original.profile_version_id,p_request_id,null,source,'einvoice','shop-einvoice-1.0-v1',actor) returning id into result;
 return result;
end; $$;
revoke all on function public.queue_eta_invoice(uuid,uuid,uuid,jsonb,text) from public,anon,service_role;
grant execute on function public.queue_eta_invoice(uuid,uuid,uuid,jsonb,text) to authenticated;

create function public.shop_eta_invoice_claim() returns jsonb language plpgsql security definer set search_path='' as $$
declare job public.eta_outbox%rowtype;
begin
 update public.eta_outbox set state='uncertain',error_code='ETA_SUBMISSION_OUTCOME_UNKNOWN',lease_id=null,lease_until=null,updated_at=now()
 where channel='einvoice' and state='submitting' and lease_until<now();
 select * into job from public.eta_outbox where channel='einvoice' and state in('queued','prepared','retry','submitted')
 and next_attempt_at<=now() and (lease_until is null or lease_until<now()) order by created_at,id for update skip locked limit 1;
 if not found then return null;end if;
 update public.eta_outbox set lease_id=gen_random_uuid(),lease_until=now()+interval '2 minutes',updated_at=now() where id=job.id returning * into job;
 return to_jsonb(job);
end; $$;

create function public.shop_eta_invoice_prepare(p_id uuid,p_lease_id uuid,p_payload text,p_certificate_fingerprint text) returns void
language plpgsql security definer set search_path='' as $$
declare job public.eta_outbox%rowtype; document jsonb;
begin
 select * into job from public.eta_outbox where id=p_id and channel='einvoice' for update;
 if not found or job.state<>'queued' or job.lease_id is distinct from p_lease_id or job.lease_until<now() then raise exception 'ETA_LEASE_CONFLICT' using errcode='55000';end if;
 document:=p_payload::jsonb->'documents'->0;
 if p_payload is null or octet_length(p_payload)>1500000 or jsonb_array_length(p_payload::jsonb->'documents')<>1
 or p_certificate_fingerprint is null or p_certificate_fingerprint !~ '^[a-f0-9]{64}$'
 or document->>'documentType' is distinct from 'i' or document->>'documentTypeVersion' is distinct from '1.0'
 or document->>'internalId' is distinct from job.source->>'receiptNumber'
 or document->'issuer'->>'id' is distinct from job.source->'profile'->>'rin'
 or document->'receiver' is distinct from job.source->'receiver'
 or (document->>'totalAmount')::numeric is distinct from (job.source->'tax'->>'total5')::numeric
 or document->'signatures'->0->>'signatureType' is distinct from 'I'
 or length(coalesce(document->'signatures'->0->>'value',''))<1 then raise exception 'ETA_EINVOICE_PAYLOAD_INVALID' using errcode='22023';end if;
 update public.eta_outbox set payload=p_payload,payload_hash=encode(extensions.digest(p_payload,'sha256'),'hex'),
 signing_certificate_fingerprint=p_certificate_fingerprint,state='prepared',updated_at=now() where id=p_id;
end; $$;

create function public.shop_eta_invoice_acknowledge(p_id uuid,p_lease_id uuid,p_submission_uuid text,p_document_uuid text) returns void
language plpgsql security definer set search_path='' as $$
begin
 if p_submission_uuid is null or p_submission_uuid !~ '^[A-Za-z0-9_-]{1,100}$' or p_document_uuid is null or p_document_uuid !~ '^[A-Za-z0-9_-]{1,100}$' then raise exception 'ETA_SUBMISSION_ID_REQUIRED' using errcode='22023';end if;
 update public.eta_outbox set state='submitted',submission_uuid=p_submission_uuid,document_uuid=p_document_uuid,
 lease_id=null,lease_until=null,error_code=null,next_attempt_at=now()+interval '5 minutes',updated_at=now()
 where id=p_id and channel='einvoice' and state='submitting' and lease_id=p_lease_id and lease_until>=now();
 if not found then raise exception 'ETA_LEASE_CONFLICT' using errcode='55000';end if;
end; $$;

create function public.shop_eta_invoice_recovery_context(p_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select to_jsonb(o) from public.eta_outbox o where id=p_id and channel='einvoice' and state='uncertain';
$$;
create function public.shop_eta_invoice_link_recovery(p_id uuid,p_submission_uuid text,p_document_uuid text) returns void
language plpgsql security definer set search_path='' as $$
begin
 if p_submission_uuid is null or p_submission_uuid !~ '^[A-Za-z0-9_-]{1,100}$' or p_document_uuid is null or p_document_uuid !~ '^[A-Za-z0-9_-]{1,100}$' then raise exception 'ETA_RECOVERY_EVIDENCE_REQUIRED' using errcode='22023';end if;
 update public.eta_outbox set state='submitted',submission_uuid=p_submission_uuid,document_uuid=p_document_uuid,
 error_code='ETA_RECOVERED_FROM_PROVIDER_EVIDENCE',next_attempt_at=now()+interval '1 minute',updated_at=now()
 where id=p_id and channel='einvoice' and state='uncertain' and submission_uuid is null;
 if not found then raise exception 'ETA_RECOVERY_CONFLICT' using errcode='55000';end if;
end; $$;
revoke all on function public.shop_eta_invoice_claim(),public.shop_eta_invoice_prepare(uuid,uuid,text,text),public.shop_eta_invoice_acknowledge(uuid,uuid,text,text),public.shop_eta_invoice_recovery_context(uuid),public.shop_eta_invoice_link_recovery(uuid,text,text) from public,anon,authenticated;
grant execute on function public.shop_eta_invoice_claim(),public.shop_eta_invoice_prepare(uuid,uuid,text,text),public.shop_eta_invoice_acknowledge(uuid,uuid,text,text),public.shop_eta_invoice_recovery_context(uuid),public.shop_eta_invoice_link_recovery(uuid,text,text) to service_role;

-- Stable original-document seam for the separate returns owner; no return command.
create function public.eta_original_document_reference(p_shop_id uuid,p_invoice_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb; location uuid;
begin
 perform shop_private.assert_shop_write_access(p_shop_id,'sales.manage');
 select location_id into location from public.invoices where id=p_invoice_id and shop_id=p_shop_id;
 if not found then raise exception 'ETA_SALE_NOT_FOUND' using errcode='42501';end if;
 perform shop_private.assert_location_access(p_shop_id,location,false);
 select jsonb_build_object('version',1,'outboxId',o.id,'invoiceId',o.invoice_id,'snapshotId',s.invoice_id,'channel',o.channel,'adapterVersion',o.adapter_version,
 'documentUUID',o.document_uuid,'submissionUUID',o.submission_uuid,'status',o.state,'currency',s.source->>'currency','issuedAt',s.source->>'issuedAt,'payloadHash',o.payload_hash)
 into result from public.eta_outbox o join public.eta_sale_sources s on s.invoice_id=o.invoice_id and s.shop_id=o.shop_id
 where o.invoice_id=p_invoice_id and o.shop_id=p_shop_id;
 return result;
end; $$;
revoke all on function public.eta_original_document_reference(uuid,uuid) from public,anon,service_role;
grant execute on function public.eta_original_document_reference(uuid,uuid) to authenticated;
create or replace function public.eta_settings(p_shop_id uuid,p_offset integer default 0) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 perform shop_private.tax_manager(p_shop_id);
 perform shop_private.assert_location_access(p_shop_id,l.id,true) from public.shop_locations l where l.shop_id=p_shop_id;
 return jsonb_build_object('configuration',(select configuration from public.eta_profile_versions where shop_id=p_shop_id order by created_at desc,id desc limit 1),
 'activation','not_activated','locations',coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'name',l.name)) from public.shop_locations l where l.shop_id=p_shop_id and shop_private.user_can_access_location(p_shop_id,l.id)),'[]'),
 'items',coalesce((select jsonb_agg(i) from (select id,name,'product' as "sourceType" from public.products where shop_id=p_shop_id union all select id,name,'service' from public.services where shop_id=p_shop_id)i),'[]'),
 'sales',coalesce((select jsonb_agg(s) from(select i.id,i.invoice_number as label from public.invoices i join public.eta_sale_sources e on e.invoice_id=i.id and e.shop_id=i.shop_id where i.shop_id=p_shop_id and i.status='issued' and shop_private.user_can_access_location(p_shop_id,i.location_id) and not exists(select 1 from public.eta_outbox o where o.shop_id=p_shop_id and o.invoice_id=i.id) order by i.issued_at desc,i.id desc limit 100)s),'[]'),
 'documents',coalesce((select jsonb_agg(d) from(select id,channel,invoice_id,(select invoice_number from public.invoices i where i.id=o.invoice_id and i.shop_id=p_shop_id) as invoice_number,state,document_uuid,submission_uuid,error_code,created_at from public.eta_outbox o where shop_id=p_shop_id and shop_private.user_can_access_location(p_shop_id,o.location_id) order by created_at desc,id desc limit 50 offset greatest(0,least(coalesce(p_offset,0),100000)))d),'[]'));
end; $$;
