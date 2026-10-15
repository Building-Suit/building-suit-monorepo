-- Synthetic fixtures; disposable database only. Caller wraps in transaction.
create temporary table eta_fixture as select gen_random_uuid() owner,gen_random_uuid() outsider;
insert into auth.users(id,email,encrypted_password,aud,role,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select id,id::text||'@eta.invalid','x','authenticated','authenticated',now(),'{}','{}',now(),now() from(select owner id from eta_fixture union all select outsider from eta_fixture)u;
grant select on eta_fixture to authenticated;
select set_config('request.jwt.claim.sub',owner::text,true),set_config('request.jwt.claim.role','authenticated',true) from eta_fixture;
set local role authenticated;
do $$
declare shop uuid; location uuid; product uuid; customer uuid; legacy uuid; usd_shop uuid; usd_product uuid; usd_sale uuid; sale uuid; req uuid:=gen_random_uuid(); version uuid; job uuid; conf jsonb; before jsonb;
begin
 shop:=public.create_owner_shop('ETA fixture','mixed'::public.business_mode);
 select id into location from public.shop_locations where shop_id=shop and is_default;
 customer:=public.save_customer(shop,null,'Synthetic customer',null,null,null,null);
 product:=public.save_product(shop,null,'ETA item',null,null,100);
 perform public.adjust_stock(gen_random_uuid(),shop,product,20,1,'Synthetic stock');
 legacy:=public.save_sale_draft(gen_random_uuid(),shop,null,customer,null,jsonb_build_array(jsonb_build_object('item_type','product','source_id',product,'quantity',1)));
 perform public.issue_sale(gen_random_uuid(),shop,legacy);
 conf:=jsonb_build_object('profile',jsonb_build_object('legalName','Test merchant','rin','123456789','activityCode','1234'),
 'branches',jsonb_build_array(jsonb_build_object('locationId',location,'branchCode','0','deviceSerialNumber','POS-SYNTHETIC','address',jsonb_build_object('country','EG','governate','Cairo','regionCity','Cairo','street','Test','buildingNumber','1'))),
 'items',jsonb_build_array(jsonb_build_object('sourceType','product','sourceId',product,'itemType','EGS','itemCode','EG-123456789-TEST','unitType','EA')));
 version:=public.save_eta_configuration(req,shop,conf,'Synthetic initial setup');
 if public.save_eta_configuration(req,shop,conf,'Synthetic initial setup')<>version then raise exception 'Configuration replay duplicated'; end if;
 begin perform public.save_eta_configuration(req,shop,conf,'Conflicting reason');raise exception 'Replay conflict accepted';exception when unique_violation then null;end;
 begin perform public.save_eta_configuration(gen_random_uuid(),shop,jsonb_set(conf,'{profile,clientSecret}','"never-store"'),'Unsafe extra field');raise exception 'Credential field accepted';exception when invalid_parameter_value then null;end;
 begin perform public.queue_eta_receipt(gen_random_uuid(),shop,legacy,'{"type":"P"}','C');raise exception 'Legacy source invented';exception when invalid_parameter_value then if sqlerrm<>'ETA_LEGACY_SNAPSHOT_UNSUPPORTED' then raise;end if;end;
 if public.eta_settings(shop)->>'activation'<>'not_activated' then raise exception 'Settings autoactivated'; end if;
 perform public.save_tax_policy(gen_random_uuid(),shop,statement_timestamp()-interval '1 minute','{"enabled":true,"default":{"treatment":"vat","rate":14,"priceMode":"exclusive","subtype":"V009"},"items":[]}','Synthetic tax');
 for idx in 1..2 loop
 sale:=public.save_sale_draft(gen_random_uuid(),shop,null,customer,null,jsonb_build_array(jsonb_build_object('item_type','product','source_id',product,'quantity',1)));
 perform public.issue_sale(gen_random_uuid(),shop,sale);
 job:=public.queue_eta_receipt(gen_random_uuid(),shop,sale,'{"type":"P"}','C');
 if public.queue_eta_receipt(gen_random_uuid(),shop,sale,'{"type":"P"}','C')<>job then raise exception 'Same sale queued twice'; end if;
 if idx=1 then perform set_config('eta_test.first',job::text,true);end if;
 end loop;
 if (select source->'profile'->>'legalName' from public.eta_outbox where id=job)<>'Test merchant' then raise exception 'Original merchant identity changed';end if;
 perform set_config('eta_test.shop',shop::text,true);perform set_config('eta_test.sale',sale::text,true);perform set_config('eta_test.location',location::text,true);
 before:=public.get_sale_tax_snapshot(shop,sale);
 perform public.save_eta_configuration(gen_random_uuid(),shop,jsonb_set(conf,'{profile,legalName}','"Changed merchant"'),'Changed for future only');
 if public.get_sale_tax_snapshot(shop,sale)<>before then raise exception 'ETA setup repriced sale'; end if;
 if (select source->'profile'->>'legalName' from public.eta_outbox where id=job)<>'Test merchant' then raise exception 'Queued merchant identity changed';end if;
 usd_shop:=public.create_owner_shop('Non-EGP ETA fixture','mixed'::public.business_mode);
 perform public.save_business_currency(usd_shop,'USD');
 usd_product:=public.save_product(usd_shop,null,'USD item',null,null,1);
 perform public.adjust_stock(gen_random_uuid(),usd_shop,usd_product,2,1,'Synthetic USD stock');
 customer:=public.save_customer(usd_shop,null,'USD customer',null,null,null,null,null);
 usd_sale:=public.save_sale_draft(gen_random_uuid(),usd_shop,null,customer,null,jsonb_build_array(jsonb_build_object('item_type','product','source_id',usd_product,'quantity',1)));
 perform public.issue_sale(gen_random_uuid(),usd_shop,usd_sale);
 begin perform public.queue_eta_receipt(gen_random_uuid(),usd_shop,usd_sale,'{"type":"P"}','C');raise exception 'Non-EGP export allowed';exception when invalid_parameter_value then if sqlerrm<>'ETA_EXPORT_EGP_ONLY' then raise;end if;end;
end; $$;
reset role;
do $$
declare job jsonb; second jsonb; doc text:=repeat('a',64); payload text; lease uuid;
begin
 if has_table_privilege('authenticated','public.eta_outbox','SELECT') or has_table_privilege('authenticated','public.eta_profile_versions','INSERT') or has_function_privilege('authenticated','public.shop_eta_claim()','EXECUTE') then raise exception 'ETA direct access leaked';end if;
 job:=public.shop_eta_claim();lease:=(job->>'lease_id')::uuid;
 if job->>'id'<>current_setting('eta_test.first') then raise exception 'FIFO claim failed';end if;
 second:=public.shop_eta_claim();if second is not null then raise exception 'Same POS claimed twice';end if;
 payload:=jsonb_build_object('receipts',jsonb_build_array(jsonb_build_object('header',jsonb_build_object('uuid',doc,'previousUUID',''))))::text;
 begin perform public.shop_eta_prepare((job->>'id')::uuid,gen_random_uuid(),'',doc,payload);raise exception 'Wrong lease accepted';exception when object_not_in_prerequisite_state then null;end;
 perform public.shop_eta_prepare((job->>'id')::uuid,lease,'',doc,payload);
 begin perform public.shop_eta_transition((job->>'id')::uuid,lease,'valid');raise exception '202 treated as valid';exception when object_not_in_prerequisite_state then null;end;
 perform public.shop_eta_transition((job->>'id')::uuid,lease,'submitting');
 perform public.shop_eta_transition((job->>'id')::uuid,lease,'submitted','SUBMISSION-SYNTHETIC');
 if (select state from public.eta_outbox where id=(job->>'id')::uuid)<>'submitted' then raise exception 'Submission state lost';end if;
 update public.eta_outbox set next_attempt_at=now()-interval '1 minute' where id=(job->>'id')::uuid;
 job:=public.shop_eta_claim();lease:=(job->>'lease_id')::uuid;
 if job->>'state'<>'submitted' then raise exception 'Successful submission was requeued';end if;
 perform public.shop_eta_transition((job->>'id')::uuid,lease,'valid','SUBMISSION-SYNTHETIC');
 begin update public.eta_outbox set payload='{}' where id=(job->>'id')::uuid;raise exception 'Payload mutable';exception when object_not_in_prerequisite_state then null;end;
 begin update public.eta_profile_versions set reason='Changed' where shop_id=current_setting('eta_test.shop')::uuid;raise exception 'Profile mutable';exception when object_not_in_prerequisite_state then null;end;
 second:=public.shop_eta_claim();if second->>'previous_uuid'<>doc then raise exception 'POS chain lost';end if;
 -- Crash after durable begin is uncertain, not another eligible POST.
 perform public.shop_eta_prepare((second->>'id')::uuid,(second->>'lease_id')::uuid,doc,repeat('b',64),jsonb_build_object('receipts',jsonb_build_array(jsonb_build_object('header',jsonb_build_object('uuid',repeat('b',64),'previousUUID',doc))))::text);
 perform public.shop_eta_transition((second->>'id')::uuid,(second->>'lease_id')::uuid,'submitting');
 update public.eta_outbox set lease_until=now()-interval '1 second' where id=(second->>'id')::uuid;
 if public.shop_eta_claim() is not null then raise exception 'Crashed POST automatically reclaimed';end if;
 if (select state from public.eta_outbox where id=(second->>'id')::uuid)<>'uncertain' then raise exception 'Crash state not audited';end if;
 if (select count(*) from public.eta_audit_events where outbox_id=(second->>'id')::uuid)<4 then raise exception 'Missing audit history';end if;
end; $$;
select set_config('request.jwt.claim.sub',outsider::text,true) from eta_fixture;
set local role authenticated;
do $$ begin
 begin perform public.eta_settings(current_setting('eta_test.shop')::uuid);raise exception 'Outsider read ETA setup';exception when insufficient_privilege then null;end;
 begin perform public.queue_eta_receipt(gen_random_uuid(),current_setting('eta_test.shop')::uuid,current_setting('eta_test.sale')::uuid,'{"type":"P"}','C');raise exception 'Outsider queued';exception when insufficient_privilege then null;end;
end; $$;
reset role;
