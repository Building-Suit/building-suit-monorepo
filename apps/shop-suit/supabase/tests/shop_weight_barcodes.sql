-- Verified GS1 vectors and an ordinary measured purchase/sale/return journey.
do $$declare parsed jsonb;raw text;expected text[]:=array['250','25','2.5','0.25','0.025','0.0025'];begin
 for n in 0..5 loop
  raw:='0194000000000009310'||n::text||'000250';parsed:=shop_private.parse_gs1_weight_barcode(raw);
  if parsed->>'netQuantity' is distinct from expected[n+1] or parsed->>'gtin' is distinct from '94000000000009' then raise exception 'JS/SQL GS1 vector differs: %',parsed;end if;
  if shop_private.parse_gs1_weight_barcode(']C1'||raw)->>'netQuantity' is distinct from expected[n+1] or shop_private.parse_gs1_weight_barcode('(01)94000000000009(310'||n::text||')000250')->>'netQuantity' is distinct from expected[n+1] then raise exception 'GS1 carrier/HRI decoder differs';end if;
 end loop;
 foreach raw in array array['2712340002252','1234567890123','01940000000000093106000250','0194000000000009310300025017261231','(3103)000250(01)94000000000009','(01)94000000000009(3932)000250',']C1(01)94000000000009(3103)000250'] loop
  if shop_private.parse_gs1_weight_barcode(raw) is not null then raise exception 'Unverified/arbitrary barcode interpreted as weight: %',raw;end if;
 end loop;
 begin perform shop_private.parse_gs1_weight_barcode('(01)94000000000008(3103)000250');raise exception 'Invalid GTIN checksum accepted';exception when invalid_parameter_value then if sqlerrm<>'INVALID_WEIGHT_BARCODE' then raise;end if;end;
 begin perform shop_private.parse_gs1_weight_barcode('(01)94000000000009(3103)000000');raise exception 'Zero label weight accepted';exception when invalid_parameter_value then if sqlerrm<>'INVALID_WEIGHT_BARCODE' then raise;end if;end;
end;$$;
create temporary table weight_barcode_actors as select gen_random_uuid() owner,gen_random_uuid() outsider,gen_random_uuid() reader;
grant select on weight_barcode_actors to authenticated;
insert into auth.users(id,email,encrypted_password,aud,role,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select id,id::text||'@weight-barcode.invalid','x','authenticated','authenticated',now(),'{}','{}',now(),now() from(select owner id from weight_barcode_actors union all select outsider from weight_barcode_actors union all select reader from weight_barcode_actors)i;
select set_config('request.jwt.claim.sub',owner::text,true),set_config('request.jwt.claim.role','authenticated',true) from weight_barcode_actors;
set local role authenticated;
do $$declare shop uuid;location uuid;other_location uuid;staff uuid;vendor uuid;customer uuid;product uuid;grams uuid;piece uuid;legacy uuid;quantum uuid;fixed uuid;invoice uuid;line uuid;draft uuid;capture_id uuid:=gen_random_uuid();issue_request uuid:=gen_random_uuid();input jsonb;r jsonb;plan jsonb;returns jsonb;raw text:='(01)94000000000009(3103)000250';begin
 shop:=public.create_owner_shop('Verified weight barcode merchant','multi','mixed');select id into location from public.shop_locations where shop_id=shop and is_default;
 other_location:=public.save_shop_location(shop,null,'Other weight counter','WEIGHT-OTHER');
 perform set_config('weight_test.shop',shop::text,true);perform set_config('weight_test.location',location::text,true);perform set_config('weight_test.other_location',other_location::text,true);
 select id into staff from public.shop_memberships where shop_id=shop and role='owner';vendor:=public.save_vendor(shop,null,'Copper weight supplier',null,null,null,null,null,null);customer:=public.save_customer(shop,null,'Weight customer',null,null,null,null);
 product:=public.save_product(shop,null,'Measured copper','WEIGHT-KG','94000000000009',120);
 perform public.configure_product_measurement(shop,product,'kg','0.001','["kg","g"]','Exact kilogram stock and gram sales');
 perform public.create_supplier_purchase(gen_random_uuid(),shop,vendor,'WEIGHT-OPEN',current_date,null,jsonb_build_array(jsonb_build_object('product_id',product,'quantity','5','unit_cost','80','unit_code','kg','measurement_revision',1)));
 r:=public.pos_catalog_search(p_shop_id=>shop,p_location_id=>location,p_barcode=>'94000000000009');if r#>>'{items,0,id}'<>product::text then raise exception 'Normal fixed GTIN lookup changed';end if;
 r:=public.resolve_weight_barcode(shop,location,raw);
 if r->>'quantity'<>'0.25' or r->>'unitCode'<>'kg' or r#>>'{item,id}'<>product::text or (select quantity_on_hand from public.product_stock where product_id=product)<>5 or exists(select 1 from public.invoices where shop_id=shop) then raise exception 'Weight read changed inventory/invoices or returned wrong quantity: %',r;end if;
 input:=jsonb_build_object('item_type','product','source_id',product,'quantity','0.25','unit_code','kg','measurement_revision',1,'measurement_capture',jsonb_build_object('kind','gs1','id',capture_id,'raw',raw));
 begin perform public.save_pos_sale_draft(gen_random_uuid(),shop,location,null,staff,null,customer,null,jsonb_build_array(input||'{"quantity":"0.3"}'));raise exception 'Changed captured quantity accepted';exception when sqlstate '55000' then if sqlerrm<>'WEIGHT_CAPTURE_QUANTITY_CHANGED' then raise;end if;end;
 begin perform public.save_pos_sale_draft(gen_random_uuid(),shop,location,null,staff,null,customer,null,jsonb_build_array(input||jsonb_build_object('measurement_capture',jsonb_build_object('kind','gs1','id',capture_id,'raw',raw,'price','1'))));raise exception 'Forged capture commercial fields accepted';exception when invalid_parameter_value then if sqlerrm<>'INVALID_WEIGHT_CAPTURE' then raise;end if;end;
 invoice:=public.save_pos_sale_draft(gen_random_uuid(),shop,location,null,staff,null,customer,null,jsonb_build_array(input));
 if (select measurement_snapshot#>>'{capture,netQuantity}' from public.invoice_items where invoice_id=invoice) is distinct from '0.25' then raise exception 'Draft lost original label evidence';end if;
 perform public.issue_location_sale(issue_request,shop,location,invoice);perform public.issue_location_sale(issue_request,shop,location,invoice);
 if (select quantity_on_hand from public.product_stock where product_id=product)<>4.75 or (select total_amount from public.invoices where id=invoice)<>30 or (select measurement_snapshot#>>'{capture,gtin}' from public.invoice_items where invoice_id=invoice) is distinct from '94000000000009' then raise exception 'Captured250g sale changed original financial/FIFO authority';end if;
 select id into line from public.invoice_items where invoice_id=invoice;
 returns:=jsonb_build_array(jsonb_build_object('lineId',line,'quantity',0.1,'disposition','resellable'));plan:=public.preview_sale_return(shop,location,invoice,returns);perform public.create_sale_return(gen_random_uuid(),shop,location,invoice,returns,'Return part of captured weight',plan);
 if (select quantity_on_hand from public.product_stock where product_id=product)<>4.85 then raise exception 'Original measured return changed under captured weight';end if;
 -- Stock in grams is still canonical; no kilogram quantity is added as grams.
 grams:=public.save_product(shop,null,'Copper in grams','WEIGHT-G','94000000000016',0.12);perform public.configure_product_measurement(shop,grams,'g','0.001','["g"]','Canonical gram stock');perform public.adjust_stock(gen_random_uuid(),shop,grams,1000,0.08,'Gram opening stock');
 perform set_config('weight_test.grams',grams::text,true);
 r:=public.resolve_weight_barcode(shop,location,'(01)94000000000016(3103)000250');if r->>'quantity'<>'250' or r->>'unitCode'<>'g' then raise exception 'Kilogram label did not convert exactly to grams: %',r;end if;
 piece:=public.save_product(shop,null,'Fixed electrical pieces','WEIGHT-PIECE','94000000000023',3);perform public.configure_product_measurement(shop,piece,'ea','1','["ea"]','Whole piece stock');
 begin perform public.resolve_weight_barcode(shop,location,'(01)94000000000023(3103)000250');raise exception 'Mass label converted to pieces';exception when sqlstate '55000' then if sqlerrm<>'WEIGHT_BARCODE_PRODUCT_UNAVAILABLE' then raise;end if;end;
 legacy:=public.save_product(shop,null,'Unconfigured ordinary pieces','WEIGHT-LEGACY','94000000000030',3);
 begin perform public.resolve_weight_barcode(shop,location,'(01)94000000000030(3103)000250');raise exception 'Legacy item inferred to be mass';exception when sqlstate '55000' then if sqlerrm<>'WEIGHT_BARCODE_PRODUCT_UNAVAILABLE' then raise;end if;end;
 quantum:=public.save_product(shop,null,'Coarse kilogram stock','WEIGHT-QUANTUM','94000000000047',120);perform public.configure_product_measurement(shop,quantum,'kg','0.1','["kg"]','Approved coarse stock quantum');
 begin perform public.resolve_weight_barcode(shop,location,'(01)94000000000047(3103)000250');raise exception 'Barcode rounded to approved increment';exception when invalid_parameter_value then if sqlerrm<>'INVALID_MEASUREMENT_INCREMENT' then raise;end if;end;
 fixed:=public.save_product(shop,null,'Literal fixed label','WEIGHT-LITERAL',raw,5);
 r:=public.pos_catalog_search(p_shop_id=>shop,p_location_id=>location,p_barcode=>raw);if r#>>'{items,0,id}'<>fixed::text then raise exception 'Literal fixed barcode changed its product';end if;
 begin perform public.resolve_weight_barcode(shop,location,raw);raise exception 'Literal fixed barcode reinterpreted as weight';exception when sqlstate '55000' then if sqlerrm<>'FIXED_BARCODE_USE_NORMAL_SCAN' then raise;end if;end;
 begin perform public.save_pos_sale_draft(gen_random_uuid(),shop,location,null,staff,null,customer,null,jsonb_build_array(input));raise exception 'Capture bypassed existing literal namespace';exception when sqlstate '55000' then if sqlerrm<>'FIXED_BARCODE_USE_NORMAL_SCAN' then raise;end if;end;
 perform public.archive_product(shop,fixed);
 begin perform public.resolve_weight_barcode(shop,location,raw);raise exception 'Archived literal barcode namespace reinterpreted as weight';exception when sqlstate '55000' then if sqlerrm<>'FIXED_BARCODE_USE_NORMAL_SCAN' then raise;end if;end;
 -- A previously drafted capture must recheck the current product identity.
 input:=input||jsonb_build_object('measurement_capture',jsonb_build_object('kind','gs1','id',gen_random_uuid(),'raw',']C101940000000000093103000250'));
 draft:=public.save_pos_sale_draft(gen_random_uuid(),shop,location,null,staff,null,customer,null,jsonb_build_array(input));
 perform public.save_product(shop,product,'Measured copper renamed','WEIGHT-KG','NEW-COPPER-IDENTITY',120);
 begin perform public.issue_location_sale(gen_random_uuid(),shop,location,draft);raise exception 'Stale label issued against changed product barcode';exception when sqlstate '55000' then if sqlerrm<>'WEIGHT_BARCODE_PRODUCT_UNAVAILABLE' then raise;end if;end;
 if (select status::text from public.invoices where id=draft)<>'draft' or (select quantity_on_hand from public.product_stock where product_id=product)<>4.85 then raise exception 'Rejected stale capture partly issued';end if;
 if (select measurement_snapshot#>>'{capture,gtin}' from public.invoice_items where invoice_id=invoice) is distinct from '94000000000009' then raise exception 'Current barcode edit rewrote issued capture';end if;
 perform set_config('request.jwt.claim.sub',(select outsider::text from weight_barcode_actors),true);
 begin perform public.resolve_weight_barcode(shop,location,']C101940000000000163103000250');raise exception 'Outsider read captured SKU';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claim.sub',(select owner::text from weight_barcode_actors),true);
end;$$;
reset role;
insert into public.profiles(user_id,portal_id,display_name,email_snapshot)
select a.reader,s.portal_id,'Weight reader',a.reader::text||'@weight-barcode.invalid' from weight_barcode_actors a join public.shops s on s.id=current_setting('weight_test.shop')::uuid;
set local role authenticated;
do $$declare shop uuid:=current_setting('weight_test.shop')::uuid;location uuid:=current_setting('weight_test.location')::uuid;role text;invitation jsonb;r jsonb;begin
 role:=public.save_shop_team_role(gen_random_uuid(),shop,null,'Weight catalogue only','قراءة أصناف الوزن',array['inventory.view']);
 invitation:=public.invite_shop_member(gen_random_uuid(),shop,(select reader::text||'@weight-barcode.invalid' from weight_barcode_actors),'Weight reader',role,array[location]);
 perform set_config('request.jwt.claim.sub',(select reader::text from weight_barcode_actors),true);perform public.accept_shop_invitation(gen_random_uuid(),(invitation->>'invitationCode')::uuid);
 begin perform public.resolve_weight_barcode(shop,location,']C101940000000000163103000250');raise exception 'Inventory-only role used sale weight capture';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claim.sub',(select owner::text from weight_barcode_actors),true);
 perform public.save_shop_team_role(gen_random_uuid(),shop,role,'Weight counter sales','بيع أصناف الوزن',array['inventory.view','sales.manage']);
 perform set_config('request.jwt.claim.sub',(select reader::text from weight_barcode_actors),true);
 r:=public.resolve_weight_barcode(shop,location,']C101940000000000163103000250');if r->>'quantity' is distinct from '250' then raise exception 'Authorized counter did not resolve canonical mass';end if;
 begin perform public.resolve_weight_barcode(shop,current_setting('weight_test.other_location')::uuid,']C101940000000000163103000250');raise exception 'Weight capture crossed staff location';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claim.sub',(select owner::text from weight_barcode_actors),true);
end;$$;
reset role;
update public.subscriptions set trial_end_at=now()-interval '1 second' where profile_id in(select profile_id from public.shop_memberships where shop_id=current_setting('weight_test.shop')::uuid and role='owner');
set local role authenticated;
do $$declare shop uuid:=current_setting('weight_test.shop')::uuid;location uuid:=current_setting('weight_test.location')::uuid;staff uuid;r jsonb;begin
 -- Preserve the existing read-only catalogue after expiry; financial writes stop.
 r:=public.resolve_weight_barcode(shop,location,']C101940000000000163103000250');if r->>'quantity' is distinct from '250' then raise exception 'Expired plan lost ordinary historical/catalogue read';end if;
 select id into staff from public.shop_memberships where shop_id=shop and role='owner';
 begin perform public.save_pos_sale_draft(gen_random_uuid(),shop,location,null,staff,null,null,null,jsonb_build_array(jsonb_build_object('item_type','product','source_id',current_setting('weight_test.grams')::uuid,'quantity','250','unit_code','g','measurement_revision',1,'measurement_capture',jsonb_build_object('kind','gs1','id',gen_random_uuid(),'raw',']C101940000000000163103000250'))));raise exception 'Expired plan saved weight sale';exception when insufficient_privilege then if sqlerrm<>'SHOP_SUBSCRIPTION_INACTIVE' then raise;end if;end;
end;$$;
reset role;
do $$begin
 if has_function_privilege('authenticated','shop_private.parse_gs1_weight_barcode(text)','execute') or has_function_privilege('authenticated','shop_private.resolve_weight_capture(uuid,uuid,jsonb,numeric)','execute') then raise exception 'Private weight parser/capture authority exposed';end if;
end;$$;
set constraints all immediate;
