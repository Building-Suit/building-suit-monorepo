-- Synthetic protocol/approval fixtures. No physical scale or merchant acceptance.
create temporary table scale_actors as select gen_random_uuid() owner,gen_random_uuid() outsider,gen_random_uuid() reader;
grant select on scale_actors to authenticated;
insert into auth.users(id,email,encrypted_password,aud,role,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select id,id::text||'@scale.invalid','x','authenticated','authenticated',now(),'{}','{}',now(),now() from(select owner id from scale_actors union all select outsider from scale_actors union all select reader from scale_actors)i;
select set_config('request.jwt.claim.sub',owner::text,true),set_config('request.jwt.claim.role','authenticated',true) from scale_actors;
set local role authenticated;
do $$declare shop uuid;location uuid;other_location uuid;staff uuid;vendor uuid;customer uuid;cable uuid;copper uuid;piece uuid;device uuid;factor uuid;capture uuid;second_capture uuid;invoice uuid;second_invoice uuid;line uuid;mass_capture uuid;mass_invoice uuid;fine_product uuid;fine_factor uuid;fine_reading jsonb;fine_values jsonb;
 request uuid:=gen_random_uuid();issue_request uuid:=gen_random_uuid();r jsonb;again jsonb;values jsonb;reading jsonb;input jsonb;ctx jsonb;returns jsonb;plan jsonb;begin
 shop:=public.create_owner_shop('Synthetic electrical scale merchant','multi','mixed');select id into location from public.shop_locations where shop_id=shop and is_default;
 other_location:=public.save_shop_location(shop,null,'Other weighing counter','OTHER-SCALE');select id into staff from public.shop_memberships where shop_id=shop and role='owner';
 vendor:=public.save_vendor(shop,null,'Synthetic cable supplier',null,null,null,null,null,null);customer:=public.save_customer(shop,null,'Synthetic scale customer',null,null,null,null);
 cable:=public.save_product(shop,null,'Approved weight-to-length cable','SCALE-CABLE',null,35);perform public.configure_product_measurement(shop,cable,'m','0.001','["m","cm"]','Synthetic approved length stock');
 copper:=public.save_product(shop,null,'Copper by kilogram','SCALE-COPPER',null,120);perform public.configure_product_measurement(shop,copper,'kg','0.001','["kg","g"]','Synthetic approved mass stock');
 piece:=public.save_product(shop,null,'Ordinary switch','SCALE-PIECE',null,5);perform public.configure_product_measurement(shop,piece,'ea','1','["ea"]','Whole switches');
 perform public.create_supplier_purchase(gen_random_uuid(),shop,vendor,'SCALE-CABLE-OPEN',current_date,null,jsonb_build_array(jsonb_build_object('product_id',cable,'quantity','5','unit_cost','20','unit_code','m','measurement_revision',1)));
 perform public.create_supplier_purchase(gen_random_uuid(),shop,vendor,'SCALE-COPPER-OPEN',current_date,null,jsonb_build_array(jsonb_build_object('product_id',copper,'quantity','5','unit_cost','80','unit_code','kg','measurement_revision',1)));
 values:='{"label":"Synthetic counter scale","model":"Protocol fixture, not hardware","serialNumber":"TEST-SCALE-001","serialOptions":{"baudRate":9600,"dataBits":8,"stopBits":1,"parity":"none","flowControl":"none"},"evidenceReference":"Synthetic protocol test only","active":true,"confirmed":true}';
 begin perform public.weighing_setup_command(gen_random_uuid(),shop,location,'device',null,0,values||'{"confirmed":false}','Unconfirmed activation');raise exception 'Unconfirmed scale was activated';exception when invalid_parameter_value then if sqlerrm<>'INVALID_WEIGHING_APPROVAL' then raise;end if;end;
 r:=public.weighing_setup_command(request,shop,location,'device',null,0,values,'Approve synthetic test profile');device:=(r->>'id')::uuid;
 again:=public.weighing_setup_command(request,shop,location,'device',null,0,values,'Approve synthetic test profile');if again is distinct from r then raise exception 'Scale approval retry changed identity';end if;
 begin perform public.weighing_setup_command(request,shop,location,'device',null,0,values,'Another approval reason');raise exception 'Approval identity conflict accepted';exception when unique_violation then if sqlerrm<>'WEIGHING_REQUEST_CONFLICT' then raise;end if;end;
 values:=jsonb_build_object('productId',cable,'measurementRevision',1,'baseUnitCode','m','kgPerBaseUnit','0.2','active',true,'confirmed',true,'evidenceReference','Synthetic product-specific 0.2kg/m fixture');
 r:=public.weighing_setup_command(gen_random_uuid(),shop,location,'factor',null,0,values,'Approve synthetic cable factor');factor:=(r->>'id')::uuid;
 begin perform public.weighing_setup_command(gen_random_uuid(),shop,location,'factor',null,0,values||jsonb_build_object('productId',piece),'Attempt universal mass/piece factor');raise exception 'Mass-to-piece conversion accepted';exception when sqlstate '55000' then if sqlerrm<>'MASS_LENGTH_PRODUCT_UNAVAILABLE' then raise;end if;end;
 ctx:=public.scale_counter_context(shop,location,null,1,cable);
 if ctx#>>'{factor,kgPerBaseUnit}' is distinct from '0.2' or ctx#>>'{selected,measurement,baseUnitCode}' is distinct from 'm' then raise exception 'Approved factor context lost exact units: %',ctx;end if;
 reading:=jsonb_build_object('tareBefore','TA A '||lpad('0.125',10,' ')||' kg'||E'\r\n','stable','S S '||lpad('0.250',10,' ')||' kg'||E'\r\n',
  'tareAfter','TA A '||lpad('0.125000',10,' ')||' kg'||E'\r\n','serial','TEST-SCALE-001','readAt',to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'confirmed',true);
 begin perform public.record_scale_capture(gen_random_uuid(),shop,location,cable,device,1,reading||'{"confirmed":false}',factor,1);raise exception 'Automatic scale capture without staff confirmation accepted';exception when invalid_parameter_value then if sqlerrm<>'INVALID_SCALE_CAPTURE' then raise;end if;end;
 begin perform public.record_scale_capture(gen_random_uuid(),shop,location,cable,device,1,reading||jsonb_build_object('stable','S D '||lpad('0.250',10,' ')||' kg'||E'\r\n'),factor,1);raise exception 'Dynamic scale quantity accepted';exception when invalid_parameter_value then if sqlerrm<>'SCALE_STABLE_READING_REQUIRED' then raise;end if;end;
 begin perform public.record_scale_capture(gen_random_uuid(),shop,location,cable,device,1,reading||jsonb_build_object('tareAfter','TA A '||lpad('0.2',10,' ')||' kg'||E'\r\n'),factor,1);raise exception 'Changing tare accepted';exception when invalid_parameter_value then if sqlerrm<>'SCALE_TARE_OR_UNIT_CHANGED' then raise;end if;end;
 begin perform public.record_scale_capture(gen_random_uuid(),shop,location,cable,device,1,reading||'{"serial":"OTHER-SCALE"}',factor,1);raise exception 'Unapproved device identity accepted';exception when sqlstate '55000' then if sqlerrm<>'SCALE_DEVICE_CONTEXT_CHANGED' then raise;end if;end;
 begin perform public.record_scale_capture(gen_random_uuid(),shop,location,cable,device,1,reading||jsonb_build_object('readAt',to_char((clock_timestamp()-interval '1 minute') at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),factor,1);raise exception 'Stale physical reading accepted';exception when sqlstate '55000' then if sqlerrm<>'SCALE_READING_EXPIRED' then raise;end if;end;
 request:=gen_random_uuid();r:=public.record_scale_capture(request,shop,location,cable,device,1,reading,factor,1);capture:=(r->>'id')::uuid;
 again:=public.record_scale_capture(request,shop,location,cable,device,1,reading,factor,1);if again is distinct from r then raise exception 'Confirmed capture retry changed source/identity';end if;
 if r->>'quantity' is distinct from '1.25' or r#>>'{snapshot,grossQuantity}' is distinct from '0.375' or r#>>'{snapshot,factor,kgPerBaseUnit}' is distinct from '0.2'
  or (select quantity_on_hand from public.product_stock where product_id=cable)<>5 or exists(select 1 from public.invoices where shop_id=shop) then raise exception 'Scale read changed finance/stock or lost exact factor: %',r;end if;
 ctx:=public.get_scale_capture(shop,location,capture);if ctx->>'quantity' is distinct from '1.25' or ctx->>'availableQuantity' is distinct from '5' then raise exception 'Capture resolution lost canonical free stock';end if;
 input:=jsonb_build_object('item_type','product','source_id',cable,'quantity','1.25','unit_code','m','measurement_revision',1,'measurement_capture',jsonb_build_object('kind','scale','id',capture));
 begin perform public.save_pos_sale_draft(gen_random_uuid(),shop,location,null,staff,null,customer,null,jsonb_build_array(input||'{"quantity":"1.5"}'));raise exception 'Changed captured stock quantity accepted';exception when sqlstate '55000' then if sqlerrm<>'SCALE_CAPTURE_QUANTITY_CHANGED' then raise;end if;end;
 begin perform public.save_pos_sale_draft(gen_random_uuid(),shop,location,null,staff,null,customer,null,jsonb_build_array(input,input));raise exception 'Same scale reading used twice';exception when unique_violation then if sqlerrm<>'DUPLICATE_SCALE_CAPTURE' then raise;end if;end;
 invoice:=public.save_pos_sale_draft(gen_random_uuid(),shop,location,null,staff,null,customer,null,jsonb_build_array(input));
 begin perform public.save_pos_sale_draft(gen_random_uuid(),shop,location,null,staff,null,customer,null,jsonb_build_array(input));raise exception 'Scale reading reused for another invoice';exception when sqlstate '55000' then if sqlerrm<>'SCALE_CAPTURE_ALREADY_ASSIGNED' then raise;end if;end;
 begin perform public.trade_quotation_command(gen_random_uuid(),shop,location,'save',null,0,jsonb_build_object('customerId',customer,'validUntil',clock_timestamp()+interval '1 day','lines',jsonb_build_array(input)),'Scale capture is a counter fact');raise exception 'Physical scale fact saved as future quotation';exception when check_violation then if position('scale_capture_counter_sale_only' in sqlerrm)=0 then raise;end if;end;
 perform public.issue_location_sale(issue_request,shop,location,invoice);perform public.issue_location_sale(issue_request,shop,location,invoice);
 if (select quantity_on_hand from public.product_stock where product_id=cable)<>3.75 or (select total_amount from public.invoices where id=invoice)<>43.75
  or (select sum(-quantity_change*unit_cost_snapshot) from public.inventory_movements where reference_id=invoice and movement_type='out')<>25
  or (select measurement_snapshot#>>'{capture,factor,kgPerBaseUnit}' from public.invoice_items where invoice_id=invoice) is distinct from '0.2' then raise exception 'Scale sale lost original FIFO/value/source';end if;
 -- Canonical kg stock and a fine product-specific ratio use the same kernel.
 fine_reading:=reading||jsonb_build_object('tareBefore','TA A '||lpad('125',10,' ')||' g'||E'\r\n','stable','S S '||lpad('250',10,' ')||' g'||E'\r\n','tareAfter','TA A '||lpad('125.0',10,' ')||' g'||E'\r\n');
 r:=public.record_scale_capture(gen_random_uuid(),shop,location,copper,device,1,fine_reading);mass_capture:=(r->>'id')::uuid;
 if r->>'quantity' is distinct from '0.25' or r#>>'{snapshot,unitCode}' is distinct from 'g' or r#>>'{snapshot,grossQuantity}' is distinct from '375' then raise exception 'Mass stock lost actual host unit or exact conversion';end if;
 mass_invoice:=public.save_pos_sale_draft(gen_random_uuid(),shop,location,null,staff,null,customer,null,jsonb_build_array(jsonb_build_object('item_type','product','source_id',copper,'quantity','0.25','unit_code','kg','measurement_revision',1,'measurement_capture',jsonb_build_object('kind','scale','id',mass_capture))));
 perform public.issue_location_sale(gen_random_uuid(),shop,location,mass_invoice);
 if (select quantity_on_hand from public.product_stock where product_id=copper)<>4.75 or (select total_amount from public.invoices where id=mass_invoice)<>30 then raise exception 'Ordinary mass scale sale changed stock/value';end if;
 r:=public.record_scale_capture(gen_random_uuid(),shop,location,copper,device,1,fine_reading);perform set_config('scale_test.unbound_capture',r->>'id',true);
 fine_product:=public.save_product(shop,null,'Fine-ratio cable','SCALE-FINE',null,35);perform public.configure_product_measurement(shop,fine_product,'m','0.001','["m"]','Synthetic fine ratio stock');perform public.adjust_stock(gen_random_uuid(),shop,fine_product,5,20,'Synthetic fine ratio opening stock');
 fine_values:=jsonb_build_object('productId',fine_product,'measurementRevision',1,'baseUnitCode','m','kgPerBaseUnit','0.001234567','active',true,'confirmed',true,'evidenceReference','Synthetic exact fine ratio, not hardware');
 begin perform public.weighing_setup_command(gen_random_uuid(),shop,location,'factor',null,0,fine_values||'{"measurementRevision":2}','Stale product measurement approval');raise exception 'Concurrent stock-unit revision silently accepted';exception when sqlstate '55000' then if sqlerrm<>'MASS_LENGTH_MEASUREMENT_CHANGED' then raise;end if;end;
 r:=public.weighing_setup_command(gen_random_uuid(),shop,location,'factor',null,0,fine_values,'Approve synthetic fine ratio');fine_factor:=(r->>'id')::uuid;
 fine_reading:=reading||jsonb_build_object('tareBefore','TA A '||lpad('0',10,' ')||' g'||E'\r\n','stable','S S '||lpad('1.234567',10,' ')||' g'||E'\r\n','tareAfter','TA A '||lpad('0',10,' ')||' g'||E'\r\n');
 r:=public.record_scale_capture(gen_random_uuid(),shop,location,fine_product,device,1,fine_reading,fine_factor,1);
 if r->>'quantity' is distinct from '1' or r#>>'{snapshot,factor,kgPerBaseUnit}' is distinct from '0.001234567' then raise exception 'Intermediate kilogram rounding corrupted exact length';end if;
 -- A changed approval blocks an unissued capture, while original returns retain
 -- the originally approved quantity/factor/cost after device or factor archival.
 values:=values||'{"kgPerBaseUnit":"0.25"}';perform public.weighing_setup_command(gen_random_uuid(),shop,location,'factor',factor,1,values,'Revise synthetic cable relationship');
 r:=public.record_scale_capture(gen_random_uuid(),shop,location,cable,device,1,reading,factor,2);second_capture:=(r->>'id')::uuid;
 input:=input||jsonb_build_object('quantity','1','measurement_capture',jsonb_build_object('kind','scale','id',second_capture));
 second_invoice:=public.save_pos_sale_draft(gen_random_uuid(),shop,location,null,staff,null,customer,null,jsonb_build_array(input));
 perform public.weighing_setup_command(gen_random_uuid(),shop,location,'factor',factor,2,values||'{"active":false}','Retire synthetic relationship');
 begin perform public.issue_location_sale(gen_random_uuid(),shop,location,second_invoice);raise exception 'Retired factor issued an unconfirmed draft';exception when sqlstate '55000' then if sqlerrm<>'APPROVED_MASS_LENGTH_REQUIRED' then raise;end if;end;
 values:='{"label":"Synthetic counter scale","model":"Protocol fixture, not hardware","serialNumber":"TEST-SCALE-001","serialOptions":{"baudRate":9600,"dataBits":8,"stopBits":1,"parity":"none","flowControl":"none"},"evidenceReference":"Retired synthetic device fixture","active":false,"confirmed":false}';
 perform public.weighing_setup_command(gen_random_uuid(),shop,location,'device',device,1,values,'Retire synthetic counter device');
 select id into line from public.invoice_items where invoice_id=invoice;
 returns:=jsonb_build_array(jsonb_build_object('lineId',line,'quantity',0.5,'disposition','resellable'));plan:=public.preview_sale_return(shop,location,invoice,returns);perform public.create_sale_return(gen_random_uuid(),shop,location,invoice,returns,'Return original approved scale quantity',plan);
 if (select quantity_on_hand from public.product_stock where product_id=cable)<>4.25 or (select measurement_snapshot#>>'{capture,factor,kgPerBaseUnit}' from public.invoice_items where invoice_id=invoice) is distinct from '0.2' then raise exception 'Current setup rewrote original scale return';end if;
 perform set_config('scale_test.shop',shop::text,true);perform set_config('scale_test.location',location::text,true);perform set_config('scale_test.other_location',other_location::text,true);
 perform set_config('scale_test.device',device::text,true);perform set_config('scale_test.cable',cable::text,true);perform set_config('scale_test.copper',copper::text,true);
end;$$;
reset role;
insert into public.profiles(user_id,portal_id,display_name,email_snapshot)
select a.reader,s.portal_id,'Synthetic counter reader',a.reader::text||'@scale.invalid' from scale_actors a join public.shops s on s.id=current_setting('scale_test.shop')::uuid;
set local role authenticated;
do $$declare shop uuid:=current_setting('scale_test.shop')::uuid;location uuid:=current_setting('scale_test.location')::uuid;role text;invitation jsonb;r jsonb;staff uuid;begin
 role:=public.save_shop_team_role(gen_random_uuid(),shop,null,'Scale inventory reader','قراءة مخزون الميزان',array['inventory.view']);
 invitation:=public.invite_shop_member(gen_random_uuid(),shop,(select reader::text||'@scale.invalid' from scale_actors),'Synthetic counter reader',role,array[location]);
 perform set_config('request.jwt.claim.sub',(select reader::text from scale_actors),true);perform public.accept_shop_invitation(gen_random_uuid(),(invitation->>'invitationCode')::uuid);
 begin perform public.scale_counter_context(shop,location);raise exception 'Inventory role opened sales scale context';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claim.sub',(select owner::text from scale_actors),true);perform public.save_shop_team_role(gen_random_uuid(),shop,role,'Scale counter sales','بيع الميزان',array['inventory.view','sales.manage']);
 perform set_config('request.jwt.claim.sub',(select reader::text from scale_actors),true);perform public.scale_counter_context(shop,location);
 begin perform public.scale_counter_context(shop,current_setting('scale_test.other_location')::uuid);raise exception 'Counter read crossed assigned location';exception when insufficient_privilege then null;end;
 begin perform public.weighing_setup_context(shop,location);raise exception 'Counter role read manager approval directory';exception when insufficient_privilege then null;end;
 begin perform public.weighing_setup_command(gen_random_uuid(),shop,location,'device',null,0,'{}','Cashier attempted device approval');raise exception 'Counter role approved a scale';exception when insufficient_privilege then null;end;
 begin perform public.get_scale_capture(shop,location,current_setting('scale_test.unbound_capture')::uuid);raise exception 'Counter read another actor capture';exception when no_data_found then if sqlerrm<>'SCALE_CAPTURE_NOT_FOUND' then raise;end if;end;
 select m.id into staff from public.shop_memberships m join public.profiles p on p.id=m.profile_id where m.shop_id=shop and p.user_id=(select reader from scale_actors);
 begin perform public.save_pos_sale_draft(gen_random_uuid(),shop,location,null,staff,null,null,null,jsonb_build_array(jsonb_build_object('item_type','product','source_id',current_setting('scale_test.copper')::uuid,'quantity','0.25','unit_code','kg','measurement_revision',1,'measurement_capture',jsonb_build_object('kind','scale','id',current_setting('scale_test.unbound_capture')))));raise exception 'Counter stole another actor unbound capture';exception when insufficient_privilege then if sqlerrm<>'SCALE_CAPTURE_ACTOR_CHANGED' then raise;end if;end;
 perform set_config('request.jwt.claim.sub',(select outsider::text from scale_actors),true);
 begin perform public.scale_counter_context(shop,location);raise exception 'Outsider read scale metadata';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claim.sub',(select owner::text from scale_actors),true);
end;$$;
reset role;
update public.subscriptions set trial_end_at=now()-interval '1 second' where profile_id in(select profile_id from public.shop_memberships where shop_id=current_setting('scale_test.shop')::uuid and role='owner');
set local role authenticated;
do $$declare shop uuid:=current_setting('scale_test.shop')::uuid;location uuid:=current_setting('scale_test.location')::uuid;begin
 perform public.scale_counter_context(shop,location);perform public.weighing_setup_context(shop,location);
 begin perform public.record_scale_capture(gen_random_uuid(),shop,location,current_setting('scale_test.copper')::uuid,current_setting('scale_test.device')::uuid,2,'{}');raise exception 'Expired plan recorded a scale capture';exception when insufficient_privilege then if sqlerrm<>'SHOP_SUBSCRIPTION_INACTIVE' then raise;end if;end;
 begin perform public.weighing_setup_command(gen_random_uuid(),shop,location,'device',null,0,'{}','Expired plan attempted approval');raise exception 'Expired plan approved a device';exception when insufficient_privilege then if sqlerrm<>'SHOP_SUBSCRIPTION_INACTIVE' then raise;end if;end;
end;$$;
reset role;
do $$begin
 if has_function_privilege('authenticated','shop_private.parse_sics_weight(text,text)','execute') or has_function_privilege('authenticated','shop_private.resolve_scale_capture(uuid,uuid,jsonb,numeric)','execute')
  or has_table_privilege('authenticated','public.scale_captures','select') or has_table_privilege('authenticated','public.scale_profiles','update') then raise exception 'Raw scale authority exposed';end if;
end;$$;
set constraints all immediate;
