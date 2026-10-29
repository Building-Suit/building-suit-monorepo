create temporary table quotation_actors as select gen_random_uuid() owner,gen_random_uuid() outsider,gen_random_uuid() cashier;
grant select on quotation_actors to authenticated;
insert into auth.users(id,email,encrypted_password,aud,role,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select id,id::text||'@quotation.invalid','x','authenticated','authenticated',now(),'{}','{}',now(),now() from(select owner id from quotation_actors union all select outsider from quotation_actors union all select cashier from quotation_actors)i;
select set_config('request.jwt.claim.sub',owner::text,true),set_config('request.jwt.claim.role','authenticated',true) from quotation_actors;
set local role authenticated;
do $$declare shop uuid;location uuid;customer uuid;product uuid;q uuid;r jsonb;again jsonb;values jsonb;frozen jsonb;context jsonb;op uuid:=gen_random_uuid();begin
 shop:=public.create_owner_shop('Formal quote shop','mixed'::public.business_mode);
 select id into location from public.shop_locations where shop_id=shop and is_default;
 customer:=public.save_customer(shop,null,'Electrical contractor project',null,null,null,null);
 product:=public.save_product(shop,null,'Quotation cable','QUOTE-CABLE',null,35);
 perform public.configure_product_measurement(shop,product,'m','0.001','["m","cm"]','Quote stock unit');
 -- A future-supply quotation needs no receipt, stock batch or sale draft.
 values:=jsonb_build_object('customerId',customer,'validUntil',clock_timestamp()+interval '7 days','projectReference','Site A / first fix',
 'notes','Delivery by agreement','orderDiscount','5','lines',jsonb_build_array(jsonb_build_object('item_type','product','source_id',product,'quantity','100','unit_code','m','measurement_revision',1,'unit_price','0.01')));
 r:=public.trade_quotation_command(op,shop,location,'save',null,0,values,'Create measured material offer');q:=(r->>'id')::uuid;
 again:=public.trade_quotation_command(op,shop,location,'save',null,0,values,'Create measured material offer');
 if again<>r or jsonb_array_length(public.trade_quotation_context(shop,location)->'items')<>1 then raise exception 'Quotation retry duplicated or changed result';end if;
 context:=public.trade_quotation_context(shop,location,q);
 if (context#>>'{detail,snapshot,total}')::numeric is distinct from 3495 then raise exception 'Quote trusted client price or lost discount: %',context;end if;
 if context#>>'{detail,snapshot,lines,0,unitPrice}'<>'35' or context#>>'{detail,snapshot,lines,0,measurement,baseQuantity}'<>'100' then raise exception 'Quote lost exact measurement/price';end if;
 begin perform public.trade_quotation_command(op,shop,location,'save',null,0,values,'Changed retry');raise exception 'Conflicting retry accepted';exception when unique_violation then if sqlerrm<>'QUOTATION_REQUEST_CONFLICT' then raise;end if;end;
 begin perform public.trade_quotation_command(gen_random_uuid(),shop,location,'save',q,0,values,'Stale draft update');raise exception 'Stale draft accepted';exception when sqlstate '55000' then if sqlerrm<>'QUOTATION_CONTEXT_CHANGED' then raise;end if;end;
 -- Every draft save retains the previous exact version, including its reason.
 values:=values||jsonb_build_object('notes','Second commercial draft');
 r:=public.trade_quotation_command(gen_random_uuid(),shop,location,'save',q,1,values,'Revise draft commercial note');
 if r->>'version'<>'2' or r->>'revision'<>'2' then raise exception 'Saved draft version not advanced';end if;
 r:=public.trade_quotation_command(gen_random_uuid(),shop,location,'issue',q,2,'{}','Issue material quotation');
 frozen:=public.trade_quotation_context(shop,location,q)#>'{detail,snapshot}';
 perform public.save_product(shop,product,'Quotation cable renamed','QUOTE-CABLE',null,99);
 if public.trade_quotation_context(shop,location,q)#>'{detail,snapshot}'<>frozen then raise exception 'Issued offer repriced or renamed';end if;
 begin perform public.trade_quotation_command(gen_random_uuid(),shop,location,'save',q,3,values,'Attempt issued edit');raise exception 'Issued offer overwritten';exception when sqlstate '55000' then if sqlerrm<>'QUOTATION_TRANSITION_DENIED' then raise;end if;end;
 r:=public.trade_quotation_command(gen_random_uuid(),shop,location,'accept',q,3,'{}','Customer accepted version two');
 if r->>'status'<>'accepted' or public.trade_quotation_context(shop,location,q)#>'{detail,snapshot}'<>frozen then raise exception 'Acceptance changed agreed version';end if;
 begin perform public.trade_quotation_command(gen_random_uuid(),shop,location,'revise',q,4,values,'Attempt accepted edit');raise exception 'Accepted offer revised';exception when sqlstate '55000' then if sqlerrm<>'QUOTATION_TRANSITION_DENIED' then raise;end if;end;
 if exists(select 1 from public.invoices where shop_id=shop) or exists(select 1 from public.payments where shop_id=shop) or exists(select 1 from public.inventory_batches where shop_id=shop) then raise exception 'Quotation posted financial or inventory ledgers';end if;
 -- A new revision of a rejected offer is explicit; prior issued versions remain.
 r:=public.trade_quotation_command(gen_random_uuid(),shop,location,'save',null,0,values,'Second offer for revision');
 perform set_config('quotation_test.revisable',r->>'id',true);
 r:=public.trade_quotation_command(gen_random_uuid(),shop,location,'issue',(r->>'id')::uuid,1,'{}','Issue second offer');
 r:=public.trade_quotation_command(gen_random_uuid(),shop,location,'reject',(r->>'id')::uuid,2,'{}','Customer requests alternative');
 r:=public.trade_quotation_command(gen_random_uuid(),shop,location,'revise',(r->>'id')::uuid,3,values,'Prepare revised customer proposal');
 context:=public.trade_quotation_context(shop,location,(r->>'id')::uuid);
 if r->>'status'<>'draft' or r->>'version'<>'2' or (context#>>'{detail,snapshot,total}')::numeric<>9895 or (context#>>'{detail,versionCount}')::integer<>2 then raise exception 'Explicit revision did not retain versions or update new draft price';end if;
 begin perform public.trade_quotation_command(gen_random_uuid(),shop,location,'save',null,0,values||jsonb_build_object('validUntil',clock_timestamp()-interval '1 day'),'Expired initial proposal');raise exception 'Already expired draft created';exception when invalid_parameter_value then if sqlerrm<>'INVALID_QUOTATION_DETAILS' then raise;end if;end;
 if has_table_privilege('authenticated','public.trade_quotations','update') or has_function_privilege('authenticated','shop_private.prepare_trade_quotation(uuid,uuid,jsonb,numeric,jsonb)','execute') then raise exception 'Private quotation write authority exposed';end if;
 -- Issued quotations retain the reviewed tax policy and rounded money too.
 perform public.save_tax_policy(gen_random_uuid(),shop,statement_timestamp(),'{"enabled":true,"default":{"treatment":"vat","rate":14,"priceMode":"exclusive","subtype":"V009"},"items":[]}','Quotation VAT fixture');
 r:=public.trade_quotation_command(gen_random_uuid(),shop,location,'save',null,0,values,'Taxed quotation proposal');
 context:=public.trade_quotation_context(shop,location,(r->>'id')::uuid);
 if (context#>>'{detail,snapshot,total}')::numeric<>11280.30 or (context#>>'{detail,snapshot,tax}')::numeric<>1385.30 then raise exception 'Quotation VAT ignored agreed discounted base';end if;
 r:=public.trade_quotation_command(gen_random_uuid(),shop,location,'issue',(r->>'id')::uuid,1,'{}','Issue reviewed VAT offer');
 frozen:=public.trade_quotation_context(shop,location,(r->>'id')::uuid)#>'{detail,snapshot}';
 perform public.save_tax_policy(gen_random_uuid(),shop,statement_timestamp(),'{"enabled":true,"default":{"treatment":"vat","rate":20,"priceMode":"exclusive","subtype":"V009"},"items":[]}','Later tax rate fixture');
 if public.trade_quotation_context(shop,location,(r->>'id')::uuid)#>'{detail,snapshot}'<>frozen then raise exception 'Issued quotation tax policy changed';end if;
 perform public.save_tax_policy(gen_random_uuid(),shop,statement_timestamp(),'{"enabled":false,"default":{"treatment":"vat","rate":14,"priceMode":"exclusive","subtype":"V009"},"items":[]}','Return to untaxed role fixture');
 -- Manager approval is stored with this exact quote/customer/unit/quantity.
 values:=values||jsonb_build_object('lines',jsonb_build_array(jsonb_build_object('item_type','product','source_id',product,'quantity','100','unit_code','m','measurement_revision',1,'override_price','30','override_reason','Manager approved project price')));
 r:=public.trade_quotation_command(gen_random_uuid(),shop,location,'save',null,0,values,'Manager approved quotation draft');
 perform set_config('quotation_test.approved',r->>'id',true);
 perform set_config('quotation_test.shop',shop::text,true);perform set_config('quotation_test.location',location::text,true);perform set_config('quotation_test.id',q::text,true);
end;$$;
reset role;
insert into public.profiles(user_id,portal_id,display_name,email_snapshot)
select a.cashier,s.portal_id,'Quotation counter',a.cashier::text||'@quotation.invalid' from quotation_actors a join public.shops s on s.id=current_setting('quotation_test.shop')::uuid;
set local role authenticated;
do $$declare shop uuid:=current_setting('quotation_test.shop')::uuid;location uuid:=current_setting('quotation_test.location')::uuid;q uuid:=current_setting('quotation_test.approved')::uuid;
 role_key text;invitation jsonb;context jsonb;values jsonb;r jsonb;approver text;begin
 role_key:=public.save_shop_team_role(gen_random_uuid(),shop,null,'Quotation counter','مسؤول عروض الأسعار',array['sales.view','sales.manage','sales.issue','products.view','clients.view']);
 invitation:=public.invite_shop_member(gen_random_uuid(),shop,(select cashier::text||'@quotation.invalid' from quotation_actors),'Quotation counter',role_key,array[location]);
 perform set_config('request.jwt.claim.sub',(select cashier::text from quotation_actors),true);
 perform public.accept_shop_invitation(gen_random_uuid(),(invitation->>'invitationCode')::uuid);
 context:=public.trade_quotation_context(shop,location,q);approver:=context#>>'{detail,snapshot,lines,0,pricing,actorProfileId}';
 values:=jsonb_build_object('customerId',context#>>'{detail,snapshot,customerId}','validUntil',context#>>'{detail,snapshot,validUntil}',
 'projectReference',context#>>'{detail,snapshot,projectReference}','notes','Counter updates delivery instructions','orderDiscount','5',
 'lines',(select jsonb_agg(value->'input') from jsonb_array_elements(context#>'{detail,snapshot,lines}')));
 begin perform public.trade_quotation_command(gen_random_uuid(),shop,location,'save',q,1,jsonb_set(values,'{lines,0,quantity}','"101"'),'Attempt changed approval quantity');raise exception 'Cashier changed approved quantity';exception when insufficient_privilege then if sqlerrm<>'PRICE_OVERRIDE_PERMISSION_DENIED' then raise;end if;end;
 r:=public.trade_quotation_command(gen_random_uuid(),shop,location,'save',q,1,values,'Retain approved price while editing notes');
 context:=public.trade_quotation_context(shop,location,q);
 if context#>>'{detail,snapshot,lines,0,pricing,actorProfileId}' is distinct from approver or (context#>>'{detail,snapshot,total}')::numeric<>2995 then raise exception 'Original quotation approval was lost or repriced';end if;
 if exists(select 1 from public.trade_quotations) then raise exception 'Unbounded quotation table read exposed';end if;
 perform public.trade_quotation_command(gen_random_uuid(),shop,location,'issue',q,2,'{}','Counter issues existing approved offer');
 perform set_config('request.jwt.claim.sub',(select owner::text from quotation_actors),true);
 perform public.trade_quotation_command(gen_random_uuid(),shop,location,'issue',current_setting('quotation_test.revisable')::uuid,4,'{}','Issue revised offer before expiry fixture');
end;$$;
reset role;
-- Time is an explicit fixture boundary, never a hosted business write. Move the
-- issued revised offer into the past to exercise issue/accept expiration guards.
update public.trade_quotations set valid_until=clock_timestamp()-interval '1 day' where id=current_setting('quotation_test.revisable')::uuid;
set local role authenticated;
do $$begin
 begin perform public.trade_quotation_command(gen_random_uuid(),current_setting('quotation_test.shop')::uuid,current_setting('quotation_test.location')::uuid,'issue',current_setting('quotation_test.revisable')::uuid,5,'{}','Attempt expired issue');raise exception 'Expired quote issued';exception when sqlstate '55000' then if sqlerrm<>'QUOTATION_TRANSITION_DENIED' then raise;end if;end;
 begin perform public.trade_quotation_command(gen_random_uuid(),current_setting('quotation_test.shop')::uuid,current_setting('quotation_test.location')::uuid,'accept',current_setting('quotation_test.revisable')::uuid,5,'{}','Attempt expired acceptance');raise exception 'Expired issued quote accepted';exception when sqlstate '55000' then if sqlerrm<>'QUOTATION_EXPIRED_OR_CHANGED' then raise;end if;end;
 if public.trade_quotation_context(current_setting('quotation_test.shop')::uuid,current_setting('quotation_test.location')::uuid,current_setting('quotation_test.revisable')::uuid)#>>'{detail,record,effective_status}'<>'expired' then raise exception 'Effective expiry hidden by stored issued state';end if;
 perform public.trade_quotation_command(gen_random_uuid(),current_setting('quotation_test.shop')::uuid,current_setting('quotation_test.location')::uuid,'expire',current_setting('quotation_test.revisable')::uuid,5,'{}','Record the expired issued offer');
 perform set_config('request.jwt.claim.sub',(select outsider::text from quotation_actors),true);
 begin perform public.trade_quotation_context(current_setting('quotation_test.shop')::uuid,current_setting('quotation_test.location')::uuid);raise exception 'Outsider quotation read';exception when insufficient_privilege then null;end;
 begin perform public.trade_quotation_command(gen_random_uuid(),current_setting('quotation_test.shop')::uuid,current_setting('quotation_test.location')::uuid,'accept',current_setting('quotation_test.id')::uuid,4,'{}','Outsider acceptance');raise exception 'Outsider accepted offer';exception when insufficient_privilege then null;end;
end;$$;
reset role;
do $$begin
 begin update public.trade_quotation_versions set snapshot='{}' where quotation_id=current_setting('quotation_test.id')::uuid;raise exception 'Quote version mutated';exception when sqlstate '55000' then if sqlerrm<>'MEASUREMENT_HISTORY_IMMUTABLE' then raise;end if;end;
 begin delete from public.trade_quotation_events where quotation_id=current_setting('quotation_test.id')::uuid;raise exception 'Quotation history deleted';exception when sqlstate '55000' then if sqlerrm<>'MEASUREMENT_HISTORY_IMMUTABLE' then raise;end if;end;
end;$$;
