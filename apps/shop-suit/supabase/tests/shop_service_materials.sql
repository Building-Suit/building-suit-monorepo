-- Synthetic fixture; runner wraps in BEGIN/ROLLBACK. No plan bypass.
create temporary table service_fixture as select gen_random_uuid() owner,gen_random_uuid() outsider;
insert into auth.users(id,email,encrypted_password,aud,role,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
 select id,id::text||'@materials.invalid','x','authenticated','authenticated',now(),'{}','{}',now(),now()
 from(select owner id from service_fixture union all select outsider from service_fixture)u;
grant select on service_fixture to authenticated;
select set_config('request.jwt.claim.sub',owner::text,true),set_config('request.jwt.claim.role','authenticated',true) from service_fixture;
set local role authenticated;
do $$declare shop uuid; loc uuid; member uuid; customer uuid; service uuid; product uuid; sale uuid; line uuid;
 request uuid; completion uuid; recipe uuid; ctx jsonb; ap uuid; other_loc uuid; consumption uuid;
begin
 shop:=public.create_owner_shop('Service materials fixture','mixed'::public.business_mode);
 select id into loc from public.shop_locations where shop_id=shop and is_default;
 select id into member from public.shop_memberships where shop_id=shop and role='owner';
 customer:=public.save_customer(shop,null,'Service customer',null,null,null,null);
 service:=public.save_service(shop,null,'Material service',null,100,'percent',20,true,30,0,array[loc],array[member]);
 product:=public.save_product(shop,null,'Cream in mL',null,null,1);
 perform public.define_service_material_unit(shop,product,'mL');
 -- Optional recipe: ordinary unpaid issued service completes with zero stock writes.
 sale:=public.save_sale_draft(gen_random_uuid(),shop,null,customer,null,jsonb_build_array(jsonb_build_object('item_type','service','source_id',service,'quantity',2)));
 select id into line from public.invoice_items where invoice_id=sale;
 perform public.issue_sale(gen_random_uuid(),shop,sale);
 request:=gen_random_uuid();completion:=public.complete_service(request,shop,loc,line,1);
 if public.complete_service(request,shop,loc,line,1)<>completion then raise exception 'Completion replay mismatch';end if;
 begin perform public.complete_service(request,shop,loc,line,2);raise exception 'Reused key accepted';exception when unique_violation then null;end;
 ctx:=public.service_fulfillment_context(shop,loc,sale);
 if ctx->'lines'->0->>'completedQuantity'<>'1.00' and (ctx->'lines'->0->>'completedQuantity')::numeric<>1 then raise exception 'Optional completion missing';end if;
 begin perform public.complete_service(gen_random_uuid(),shop,loc,line,2);raise exception 'Excess completion accepted';exception when check_violation then null;end;
 -- Manager defines immutable recipe; no conversion between volume and mass.
 begin perform public.save_service_recipe(gen_random_uuid(),shop,service,null,jsonb_build_array(jsonb_build_object('productId',product,'unit','g','quantity',30)),'Wrong dimension');raise exception 'Mass volume conversion accepted';exception when check_violation then null;end;
 recipe:=public.save_service_recipe(gen_random_uuid(),shop,service,null,jsonb_build_array(jsonb_build_object('productId',product,'unit','mL','quantity',30)),'Thirty mL per service');
 perform public.adjust_stock(gen_random_uuid(),shop,product,20,1,'First FIFO layer');
 perform public.adjust_stock(gen_random_uuid(),shop,product,25,2,'Second FIFO layer');
 perform public.save_commission_policy(gen_random_uuid(),shop,jsonb_build_object('enabled',true,'currency','EGP','service',jsonb_build_object('type','percentage','rate',10),'employees',jsonb_build_array(jsonb_build_object('membershipId',member,'enabled',true))),'Enable fulfillment commission');
 sale:=public.save_sale_draft(gen_random_uuid(),shop,null,customer,null,jsonb_build_array(jsonb_build_object('item_type','service','source_id',service,'quantity',1)));
 select id into line from public.invoice_items where invoice_id=sale;
 perform public.assign_sale_commission(shop,line,member,null);
 perform public.issue_sale(gen_random_uuid(),shop,sale);
 completion:=public.complete_service(gen_random_uuid(),shop,loc,line,1);
 ctx:=public.service_fulfillment_context(shop,loc,sale);
 if jsonb_array_length(ctx->'lines'->0->'history'->0->'allocations')<>2 then raise exception 'FIFO layers missing';end if;
 if (public.commission_history(shop,sale)->'lines'->0->>'earned')::numeric<>0 then raise exception 'Unpaid fulfillment earned';end if;
 perform public.record_customer_receipt(gen_random_uuid(),shop,customer,80,now(),'cash',null,null,jsonb_build_array(jsonb_build_object('invoice_id',sale,'amount',80)));
 if (public.commission_history(shop,sale)->'lines'->0->>'earned')::numeric<>8 then raise exception 'Paid fulfilled net commission wrong';end if;
 perform set_config('materials_test.sale',sale::text,true);
 perform set_config('materials_test.completion',completion::text,true);
 perform set_config('materials_test.shop',shop::text,true);
 perform set_config('materials_test.product',product::text,true);
 perform set_config('materials_test.location',loc::text,true);
 perform set_config('materials_test.owner',(select owner from service_fixture)::text,true);
 -- Recipe replacement leaves the prior recipe and actual material snapshot unchanged.
 perform public.save_service_recipe(gen_random_uuid(),shop,service,null,'[]','Disable future consumption');
 if public.service_fulfillment_context(shop,loc,sale)<>ctx then raise exception 'Historical completion repriced';end if;
 -- Restore recipe, then shortage must roll back the entire completion operation.
 perform public.save_service_recipe(gen_random_uuid(),shop,service,null,jsonb_build_array(jsonb_build_object('productId',product,'unit','mL','quantity',30)),'Restore recipe');
 sale:=public.save_sale_draft(gen_random_uuid(),shop,null,customer,null,jsonb_build_array(jsonb_build_object('item_type','service','source_id',service,'quantity',1)));
 select id into line from public.invoice_items where invoice_id=sale;
 perform public.issue_sale(gen_random_uuid(),shop,sale);
 begin perform public.complete_service(gen_random_uuid(),shop,loc,line,1);raise exception 'Shortage accepted';exception when check_violation then null;end;
 if (public.service_fulfillment_context(shop,loc,sale)->'lines'->0->>'completedQuantity')::numeric<>0 then raise exception 'Shortage left fulfillment';end if;
 begin perform public.complete_service(gen_random_uuid(),shop,loc,line,0.001);raise exception 'Unsupported precision rounded';exception when invalid_parameter_value then null;end;
 -- Multi-unit recipe-free service: full-line fulfillment and full payment required.
 perform public.save_service_recipe(gen_random_uuid(),shop,service,null,'[]','Multi-unit without recipe');
 sale:=public.save_sale_draft(gen_random_uuid(),shop,null,customer,null,jsonb_build_array(jsonb_build_object('item_type','service','source_id',service,'quantity',2)));
 select id into line from public.invoice_items where invoice_id=sale;
 perform public.assign_sale_commission(shop,line,member,null);
 perform public.issue_sale(gen_random_uuid(),shop,sale);
 perform public.record_customer_receipt(gen_random_uuid(),shop,customer,160,now(),'cash',null,null,jsonb_build_array(jsonb_build_object('invoice_id',sale,'amount',160)));
 perform public.complete_service(gen_random_uuid(),shop,loc,line,1);
 if (public.commission_history(shop,sale)->'lines'->0->>'earned')::numeric<>0 then raise exception 'Partial fulfillment earned full line';end if;
 perform public.complete_service(gen_random_uuid(),shop,loc,line,1);
 if (public.commission_history(shop,sale)->'lines'->0->>'earned')::numeric<>16 then raise exception 'Multi-unit commission wrong';end if;
 -- Scheduled completion before sale: consume once, link later without reconsumption.
 perform public.save_staff_schedule(shop,loc,member,'Etc/UTC',(select jsonb_agg(jsonb_build_object('weekday',d,'startsLocal','00:00','endsLocal','23:59')) from generate_series(0,6)d),'[]');
 ap:=public.save_appointment(gen_random_uuid(),shop,null,loc,member,service,date_trunc('day',now())+interval '1 day 10 hours','customer',customer,null,null,null);
 perform public.transition_appointment(gen_random_uuid(),shop,ap,'arrived');
 perform public.transition_appointment(gen_random_uuid(),shop,ap,'in_service');
 perform public.transition_appointment(gen_random_uuid(),shop,ap,'completed');
 perform public.transition_appointment(gen_random_uuid(),shop,ap,'completed');
 sale:=public.save_sale_draft(gen_random_uuid(),shop,null,customer,null,jsonb_build_array(jsonb_build_object('item_type','service','source_id',service,'quantity',1)));
 select id into line from public.invoice_items where invoice_id=sale;
 perform public.link_appointment_sale(gen_random_uuid(),shop,ap,sale);
 perform public.issue_sale(gen_random_uuid(),shop,sale);
 if (public.service_fulfillment_context(shop,loc,sale)->'lines'->0->>'completedQuantity')::numeric<>1 then raise exception 'Appointment not linked';end if;
 begin perform public.complete_service(gen_random_uuid(),shop,loc,line,1,ap);raise exception 'Duplicate appointment accepted';exception when check_violation or unique_violation then null;end;
 -- Wrong location is rejected even for a tenant owner.
 other_loc:=public.save_shop_location(shop,null,'Material branch B','MAT-B',null,null);
 begin perform public.complete_service(gen_random_uuid(),shop,other_loc,line,1);raise exception 'Cross-location fulfillment accepted';exception when check_violation then null;end;
 -- Failed queued request can be cancelled atomically; late replay cannot post.
 request:=gen_random_uuid();
 ctx:=public.reconcile_service_completion(shop,jsonb_build_object('p_request_id',request,'p_shop_id',shop,'p_location_id',loc,'p_line_id',line,'p_quantity',1,'p_materials',null,'p_appointment_id',null,'p_reason','Deferred request'),gen_random_uuid(),'Cancel stale request');
 if ctx->>'state'<>'cancelled' then raise exception 'Offline request not cancelled';end if;
 begin perform public.complete_service(request,shop,loc,line,1,null,null,'Deferred request');raise exception 'Cancelled request replay posted';exception when object_not_in_prerequisite_state then null;end;
 -- Full refund reverses commission but does not restore material movement refs.
 perform public.correct_location_sale(gen_random_uuid(),shop,loc,current_setting('materials_test.sale')::uuid,clock_timestamp(),'Performed service refund');
 if (public.commission_history(shop,current_setting('materials_test.sale')::uuid)->'lines'->0->>'adjustments')::numeric<>-8 then raise exception 'Refund failed to reverse earned commission';end if;
 -- Cross tenant and direct-write denials.
 perform set_config('request.jwt.claim.sub',(select outsider from service_fixture)::text,true);
 begin perform public.service_fulfillment_context(shop,loc,sale);raise exception 'Outsider read accepted';exception when insufficient_privilege then null;end;
 begin perform public.complete_service(gen_random_uuid(),shop,loc,line,1);raise exception 'Outsider write accepted';exception when insufficient_privilege then null;end;
 begin perform count(*) from public.service_fulfillments;raise exception 'Direct table read accepted';exception when insufficient_privilege then null;end;
end;$$;
reset role;
do $$declare shop uuid:=current_setting('materials_test.shop')::uuid; product uuid:=current_setting('materials_test.product')::uuid;
 f uuid:=current_setting('materials_test.completion')::uuid;
begin
 if (select sum(remaining_quantity) from public.inventory_batches where product_id=product)<>15 then raise exception 'FIFO or shortage stock incorrect';end if;
 if (select sum(quantity) from public.service_material_consumptions where fulfillment_id=f)<>30 then raise exception 'Consumed amount incorrect';end if;
 if not exists(select 1 from public.service_material_consumptions where fulfillment_id=f and quantity=20)
  or not exists(select 1 from public.service_material_consumptions where fulfillment_id=f and quantity=10) then raise exception 'Not FIFO 20 + 10';end if;
end;$$;

select set_config('request.jwt.claim.sub',current_setting('materials_test.owner'),true);
set local role authenticated;
do $$declare c uuid; req uuid:=gen_random_uuid(); result uuid;
begin
 select (public.service_fulfillment_context(current_setting('materials_test.shop')::uuid,current_setting('materials_test.location')::uuid,current_setting('materials_test.sale')::uuid)->'lines'->0->'history'->0->'allocations'->0->>'id')::uuid into c;
 result:=public.correct_service_material(req,current_setting('materials_test.shop')::uuid,c,1,'Audited unused material correction');
 if public.correct_service_material(req,current_setting('materials_test.shop')::uuid,c,1,'Audited unused material correction')<>result then raise exception 'Correction replay duplicated';end if;
 begin perform public.correct_service_material(gen_random_uuid(),current_setting('materials_test.shop')::uuid,c,100,'Excess correction');raise exception 'Excess correction accepted';exception when check_violation then null;end;
end;$$;
reset role;
