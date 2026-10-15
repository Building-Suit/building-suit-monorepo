-- Disposable synthetic fixtures, transaction rolled back by runner.
create temporary table return_fixture as select gen_random_uuid() owner,gen_random_uuid() outsider,gen_random_uuid() sales_reader,gen_random_uuid() manager;
insert into auth.users(id,email,encrypted_password,aud,role,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select id,id::text||'@returns.invalid','x','authenticated','authenticated',now(),'{}','{}',now(),now() from(select owner id from return_fixture union all select outsider from return_fixture union all select sales_reader from return_fixture union all select manager from return_fixture)u;
grant select on return_fixture to authenticated;
select set_config('request.jwt.claim.sub',owner::text,true),set_config('request.jwt.claim.role','authenticated',true) from return_fixture;
set local role authenticated;
do $$
declare shop uuid; loc uuid; customer uuid; product uuid; service uuid; member uuid; sale uuid; line uuid; ret uuid; request uuid; refund uuid; event uuid; shift uuid;
 lines jsonb; plan jsonb; doc jsonb; ctx jsonb; original jsonb; stock numeric; remaining numeric; paid uuid; comp jsonb; total numeric:=0; net numeric:=0; tax numeric:=0; q numeric; i integer;
begin
 shop:=public.create_owner_shop('Partial return fixture','multi','mixed');
 select id into loc from public.shop_locations where shop_id=shop and is_default;
 select id into member from public.shop_memberships where shop_id=shop and role='owner';
 customer:=public.save_customer(shop,null,'Return customer',null,null,null,null);
 product:=public.save_product(shop,null,'Return product',null,null,10);
 perform public.adjust_stock(gen_random_uuid(),shop,product,10,3,'First original lot');
 perform public.adjust_stock(gen_random_uuid(),shop,product,40,7,'Second original lot');
 perform public.save_tax_policy(gen_random_uuid(),shop,statement_timestamp(),'{"enabled":true,"default":{"treatment":"vat","rate":14,"priceMode":"inclusive","subtype":"V009"},"items":[]}','Original frozen rates');
 perform public.save_commission_policy(gen_random_uuid(),shop,jsonb_build_object('enabled',true,'currency','EGP','product',jsonb_build_object('type','percentage','rate',10),'service',jsonb_build_object('type','percentage','rate',10),'employees',jsonb_build_array(jsonb_build_object('membershipId',member,'enabled',true))),'Original commission rate');
 -- 100 total, 40 paid, 60 due; return eight of ten units = 80, owes refund 20.
 sale:=public.save_sale_draft(gen_random_uuid(),shop,null,customer,null,jsonb_build_array(jsonb_build_object('item_type','product','source_id',product,'quantity',10)));
 select id into line from public.invoice_items where invoice_id=sale;
 perform public.assign_sale_commission(shop,line,member,null);
 perform public.issue_sale(gen_random_uuid(),shop,sale);original:=public.get_sale_tax_snapshot(shop,sale);
 paid:=public.record_customer_receipt(gen_random_uuid(),shop,customer,40,clock_timestamp(),'card','Original card',null,jsonb_build_array(jsonb_build_object('invoice_id',sale,'amount',40)));
 lines:=jsonb_build_array(jsonb_build_object('lineId',line,'quantity',8,'disposition','resellable'));
 plan:=public.preview_sale_return(shop,loc,sale,lines);
 if (plan->>'debtReduction')::numeric<>60 or (plan->>'refundDue')::numeric<>20 or (plan->>'dueAfter')::numeric<>0 then raise exception 'Debt first policy %',plan;end if;
 request:=gen_random_uuid();ret:=public.create_sale_return(request,shop,loc,sale,lines,'Eight items returned',plan);
 if public.create_sale_return(request,shop,loc,sale,lines,'Eight items returned',plan)<>ret then raise exception 'Return replay mismatch';end if;
 begin perform public.create_sale_return(request,shop,loc,sale,lines,'Conflicting reason',plan);raise exception 'Return key reused';exception when unique_violation then null;end;
 doc:=public.get_sale_return(shop,loc,ret);
 if doc->'original_document'->>'invoiceId'<>sale::text or (doc->>'refund_due')::numeric<>20 or doc->'refunds'->0->>'state'<>'pending' then raise exception 'Return document contract %',doc;end if;
 refund:=(doc->'refunds'->0->>'id')::uuid;
 perform set_config('returns.read_return',ret::text,true);
 if public.sale_return_context(shop,loc,sale)->>'due'<>'0' and (public.sale_return_context(shop,loc,sale)->>'due')::numeric<>0 then raise exception 'Debt not closed';end if;
 begin perform public.record_sale_return_refund(gen_random_uuid(),shop,loc,refund,'cash_handover','','No tender conversion');raise exception 'Card converted to cash';exception when check_violation then null;end;
 perform public.record_sale_return_refund(gen_random_uuid(),shop,loc,refund,'failed','Gateway declined','External attempt failed');
 if public.get_sale_return(shop,loc,ret)->'refunds'->0->>'state'<>'failed' then raise exception 'Failure not recorded';end if;
 request:=gen_random_uuid();event:=public.record_sale_return_refund(request,shop,loc,refund,'external_record','BANK-REF-20','Bank confirmed refund');
 if public.record_sale_return_refund(request,shop,loc,refund,'external_record','BANK-REF-20','Bank confirmed refund')<>event then raise exception 'Refund replay mismatch';end if;
 begin perform public.record_sale_return_refund(request,shop,loc,refund,'external_record','OTHER-REF','Bank confirmed refund');raise exception 'Conflicting refund replay';exception when unique_violation then null;end;
 begin perform public.record_sale_return_refund(gen_random_uuid(),shop,loc,refund,'external_record','BANK-REF-20','Duplicate attempt');raise exception 'Duplicate handover';exception when check_violation then null;end;
 if public.get_sale_tax_snapshot(shop,sale)<>original then raise exception 'Original snapshot changed';end if;
 -- No new commission on debt closure alone, until legitimate later settlement;
 -- current original paid 40 < original 100, returns consume 80, remaining earned basis is 20.
 comp:=public.commission_history(shop,sale)->'lines'->0;
 if (comp->>'adjustments')::numeric>0 then raise exception 'Return created positive adjustment';end if;
 -- Remaining two units damaged: no sellable stock restoration, full exact totals.
 select sum(remaining_quantity) into stock from public.inventory_batches where product_id=product;
 lines:=jsonb_build_array(jsonb_build_object('lineId',line,'quantity',2,'disposition','damaged'));
 plan:=public.preview_sale_return(shop,loc,sale,lines);ret:=public.create_sale_return(gen_random_uuid(),shop,loc,sale,lines,'Damaged remainder',plan);
 select sum(remaining_quantity) into remaining from public.inventory_batches where product_id=product;
 if remaining<>stock then raise exception 'Damaged items restored stock';end if;
 comp:=public.commission_history(shop,sale)->'lines'->0;
 if (comp->>'earned')::numeric+(comp->>'adjustments')::numeric<>0 then raise exception 'Full cancellation retained commission %',comp;end if;
 if (public.get_location_sale(shop,loc,sale)->>'amountPaid')::numeric<>20 then raise exception 'Debt reduction was reported as actual payment';end if;
 if (public.customer_statement(shop,customer)->>'outstanding')::numeric<>0 then raise exception 'Statement retained cancelled debt';end if;
 if (public.sale_return_context(shop,loc,sale)->'lines'->0->>'remaining')::numeric<>0 then raise exception 'Remaining quantity wrong';end if;
 begin perform public.preview_sale_return(shop,loc,sale,lines);raise exception 'Over-return accepted';exception when check_violation then null;end;
 begin perform public.correct_location_sale(gen_random_uuid(),shop,loc,sale,clock_timestamp(),'Old full correction');raise exception 'Full correction duplicated partial';exception when check_violation then null;end;
 perform set_config('returns.shop',shop::text,true);perform set_config('returns.loc',loc::text,true);perform set_config('returns.sale',sale::text,true);perform set_config('returns.id',ret::text,true);
 -- Fractional cumulative returns, frozen discount and taxes; full totals conserve.
 sale:=public.save_sale_draft(gen_random_uuid(),shop,null,customer,null,jsonb_build_array(jsonb_build_object('item_type','product','source_id',product,'quantity',1)));
 select id into line from public.invoice_items where invoice_id=sale;
 perform public.set_sale_order_discount(shop,sale,0.03);perform public.issue_sale(gen_random_uuid(),shop,sale);original:=public.get_sale_tax_snapshot(shop,sale);
 perform public.save_tax_policy(gen_random_uuid(),shop,statement_timestamp(),'{"enabled":true,"default":{"treatment":"vat","rate":20,"priceMode":"exclusive","subtype":"V009"},"items":[]}','Change future rate');
 for i in 1..3 loop
  q:=case when i=3 then 0.34 else 0.33 end;
  lines:=jsonb_build_array(jsonb_build_object('lineId',line,'quantity',q,'disposition','resellable'));
  plan:=public.preview_sale_return(shop,loc,sale,lines);
  ret:=public.create_sale_return(gen_random_uuid(),shop,loc,sale,lines,'Fractional cumulative return',plan);
  total:=total+(plan->>'total')::numeric;net:=net+(plan->>'net')::numeric;tax:=tax+(plan->>'tax')::numeric;
 end loop;
 if total<>(original->>'total')::numeric or net<>(original->>'net')::numeric or tax<>(original->>'tax')::numeric then raise exception 'Rounding did not conserve % %',total,original;end if;
 lines:=jsonb_build_array(jsonb_build_object('lineId',line,'quantity',0.001,'disposition','resellable'));
 begin perform public.preview_sale_return(shop,loc,sale,lines);raise exception 'Precision silently rounded';exception when invalid_parameter_value then null;end;
 -- Mixed tenders use deterministic original payment capacity and cash only on handover.
 perform public.save_tax_policy(gen_random_uuid(),shop,statement_timestamp(),'{"enabled":false,"default":{"treatment":"vat","rate":14,"priceMode":"inclusive","subtype":"V009"},"items":[]}','Untaxed future test');
 sale:=public.save_sale_draft(gen_random_uuid(),shop,null,customer,null,jsonb_build_array(jsonb_build_object('item_type','product','source_id',product,'quantity',1)));
 select id into line from public.invoice_items where invoice_id=sale;
 perform public.issue_sale(gen_random_uuid(),shop,sale);
 perform public.record_customer_receipt(gen_random_uuid(),shop,customer,4,clock_timestamp(),'card','card-4',null,jsonb_build_array(jsonb_build_object('invoice_id',sale,'amount',4)));
 perform public.record_customer_receipt(gen_random_uuid(),shop,customer,6,clock_timestamp(),'cash','cash-6',null,jsonb_build_array(jsonb_build_object('invoice_id',sale,'amount',6)));
 lines:=jsonb_build_array(jsonb_build_object('lineId',line,'quantity',1,'disposition','resellable'));
 plan:=public.preview_sale_return(shop,loc,sale,lines);
 if jsonb_array_length(plan->'allocations')<>2 or (plan->'allocations'->0->>'amount')::numeric<>4 then raise exception 'Mixed allocation wrong %',plan;end if;
 ret:=public.create_sale_return(gen_random_uuid(),shop,loc,sale,lines,'Mixed tender full return',plan);
 doc:=public.get_sale_return(shop,loc,ret);
 select (e->>'id')::uuid into refund from jsonb_array_elements(doc->'refunds')e where e->>'method'='cash';
 begin perform public.record_sale_return_refund(gen_random_uuid(),shop,loc,refund,'cash_handover','','Cash handed over');raise exception 'Cash recorded with no shift';exception when check_violation then null;end;
 shift:=public.open_cash_shift(gen_random_uuid(),shop,loc,'main',20,'Refund test float');
 perform public.record_sale_return_refund(gen_random_uuid(),shop,loc,refund,'cash_handover','','Cash handed over');
 -- A performed service with actual FIFO material usage retains that consumption.
 declare material uuid; service_sale uuid; service_line uuid; before_stock numeric;
 begin
 material:=public.save_product(shop,null,'Consumed cream',null,null,1);
 perform public.define_service_material_unit(shop,material,'mL');
 perform public.adjust_stock(gen_random_uuid(),shop,material,50,2,'Material opening');
 service:=public.save_service(shop,null,'Performed service',null,100,'percent',0,true,30,0,array[loc],array[member]);
 perform public.save_service_recipe(gen_random_uuid(),shop,service,null,jsonb_build_array(jsonb_build_object('productId',material,'unit','mL','quantity',30)),'Actual consumed material');
 service_sale:=public.save_sale_draft(gen_random_uuid(),shop,null,customer,null,jsonb_build_array(jsonb_build_object('item_type','service','source_id',service,'quantity',1)));
 select id into service_line from public.invoice_items where invoice_id=service_sale;
 perform public.assign_sale_commission(shop,service_line,member,null);perform public.issue_sale(gen_random_uuid(),shop,service_sale);
 perform public.record_customer_receipt(gen_random_uuid(),shop,customer,100,clock_timestamp(),'card','service-card',null,jsonb_build_array(jsonb_build_object('invoice_id',service_sale,'amount',100)));
 perform public.complete_service(gen_random_uuid(),shop,loc,service_line,1);
 comp:=public.commission_history(shop,service_sale)->'lines'->0;
 if (comp->>'earned')::numeric<>10 then raise exception 'Performed service did not earn original basis';end if;
 select sum(remaining_quantity) into before_stock from public.inventory_batches where product_id=material;
 lines:=jsonb_build_array(jsonb_build_object('lineId',service_line,'quantity',1,'disposition','service'));
 plan:=public.preview_sale_return(shop,loc,service_sale,lines);ret:=public.create_sale_return(gen_random_uuid(),shop,loc,service_sale,lines,'Performed service refunded',plan);
 if (select sum(remaining_quantity) from public.inventory_batches where product_id=material)<>before_stock then raise exception 'Service return restored consumed materials';end if;
 if jsonb_array_length(public.get_sale_return(shop,loc,ret)->'stock')<>0 then raise exception 'Service refund invented stock';end if;
 comp:=public.commission_history(shop,service_sale)->'lines'->0;
 if (comp->>'adjustments')::numeric<>-10 then raise exception 'Service refund did not reverse original earning %',comp;end if;
 end;
 -- Unperformed returned quantities cannot later consume materials.

 service:=public.save_service(shop,null,'Refund service',null,100,'percent',0,true,30,0,array[loc],array[member]);
 perform public.save_service_recipe(gen_random_uuid(),shop,service,null,'[]','No default material');
 sale:=public.save_sale_draft(gen_random_uuid(),shop,null,customer,null,jsonb_build_array(jsonb_build_object('item_type','service','source_id',service,'quantity',2)));
 select id into line from public.invoice_items where invoice_id=sale;perform public.issue_sale(gen_random_uuid(),shop,sale);
 perform public.complete_service(gen_random_uuid(),shop,loc,line,1);
 lines:=jsonb_build_array(jsonb_build_object('lineId',line,'quantity',1,'disposition','service'));
 plan:=public.preview_sale_return(shop,loc,sale,lines);perform public.create_sale_return(gen_random_uuid(),shop,loc,sale,lines,'Unperformed unit cancelled',plan);
 begin perform public.complete_service(gen_random_uuid(),shop,loc,line,1);raise exception 'Returned service fulfilled';exception when check_violation then null;end;
 -- Permissions apply to both context and stable record.
 perform set_config('request.jwt.claim.sub',(select outsider from return_fixture)::text,true);
 begin perform public.sale_return_context(shop,loc,sale);raise exception 'Outsider read';exception when insufficient_privilege then null;end;
 begin perform public.create_sale_return(gen_random_uuid(),shop,loc,sale,lines,'Unauthorized',plan);raise exception 'Outsider write';exception when insufficient_privilege then null;end;
end;$$;
reset role;
do $$declare t text;begin
 foreach t in array array['sale_return_sources','sale_returns','sale_return_lines','sale_return_stock','sale_return_refunds','sale_return_refund_events'] loop
  if has_table_privilege('authenticated','public.'||t,'SELECT') or has_table_privilege('authenticated','public.'||t,'INSERT') or has_table_privilege('service_role','public.'||t,'UPDATE') then raise exception 'Direct return access %',t;end if;
 end loop;
 if exists(select 1 from public.sale_return_stock s join public.inventory_movements original on original.id=s.movement_id join public.inventory_movements restored on restored.id=s.restoration_movement_id where original.batch_id<>restored.batch_id or original.unit_cost_snapshot<>restored.unit_cost_snapshot) then raise exception 'FIFO cost changed';end if;
 if exists(select 1 from public.sale_return_refunds r join public.customer_payment_allocations a on a.id=r.allocation_id group by a.id,a.amount having sum(r.amount)>a.amount) then raise exception 'Refund capacity exceeded';end if;
 if (select count(*) from public.cash_drawer_events e join public.payments p on p.id=e.payment_id where p.sale_return_refund_id is not null)<>1 then raise exception 'Cash outflow missing or duplicated';end if;
 begin update public.sale_returns set reason='Changed' where id=current_setting('returns.id')::uuid;raise exception 'Return mutable';exception when object_not_in_prerequisite_state then null;end;
end;$$;

-- A historical issued row with no original snapshot is explicitly unsupported.
-- Direct synthetic INSERT does not execute the forward issuance capture trigger.
select set_config('request.jwt.claim.sub',owner::text,true) from return_fixture;
do $$declare historical uuid; actor uuid;ctx jsonb;
begin
 select profile_id into actor from public.shop_memberships where shop_id=current_setting('returns.shop')::uuid and role='owner';
 insert into public.invoices(shop_id,location_id,created_by_profile_id,issued_by_profile_id,invoice_number,status,issued_at,total_amount,currency)
 values(current_setting('returns.shop')::uuid,current_setting('returns.loc')::uuid,actor,actor,'HISTORICAL-UNSUPPORTED','issued',clock_timestamp()-interval '1 year',100,'EGP') returning id into historical;
 perform set_config('returns.historical',historical::text,true);
end;$$;
select set_config('request.jwt.claim.sub',owner::text,true) from return_fixture;
set local role authenticated;
do $$declare ctx jsonb;begin
 ctx:=public.sale_return_context(current_setting('returns.shop')::uuid,current_setting('returns.loc')::uuid,current_setting('returns.historical')::uuid);
 if (ctx->>'supported')::boolean or (ctx->>'canReturn')::boolean then raise exception 'Invented historical return basis';end if;
 begin perform public.preview_sale_return(current_setting('returns.shop')::uuid,current_setting('returns.loc')::uuid,current_setting('returns.historical')::uuid,'[]');raise exception 'Historical return accepted';exception when object_not_in_prerequisite_state then null;end;
end;$$;
reset role;

-- Refund details retain the existing payment-view capability boundary even for
-- a valid sales-view member assigned to this sale's location.
do $$declare shop uuid:=current_setting('returns.shop')::uuid; person uuid; member uuid; custom_role uuid;
begin
 insert into public.profiles(user_id,portal_id,display_name,email_snapshot)
 select f.sales_reader,s.portal_id,'Sales-only reader','sales-reader@returns.invalid'
 from return_fixture f join public.shops s on s.id=shop returning id into person;
 insert into public.shop_memberships(shop_id,profile_id,role) values(shop,person,'employee') returning id into member;
 insert into public.roles(shop_id,name) values(shop,'Sales without payment visibility') returning id into custom_role;
 insert into public.role_permissions(role_id,permission_id)
 select custom_role,p.id from public.permissions p join public.shops s on s.portal_id=p.portal_id where s.id=shop and p.key='sales.view';
 insert into public.membership_roles(membership_id,role_id) values(member,custom_role);
 perform set_config('returns.reader_member',member::text,true);
 insert into public.profiles(user_id,portal_id,display_name,email_snapshot)
 select f.manager,s.portal_id,'Authorized return manager','manager@returns.invalid'
 from return_fixture f join public.shops s on s.id=shop returning id into person;
 insert into public.shop_memberships(shop_id,profile_id,role) values(shop,person,'employee') returning id into member;
 insert into public.membership_roles(membership_id,role_id)
 select member,id from public.roles where shop_id=shop and key='manager' and is_system;
 perform set_config('returns.manager_member',member::text,true);
end;$$;
select set_config('request.jwt.claim.sub',owner::text,true) from return_fixture;
set local role authenticated;
do $$declare shop uuid:=current_setting('returns.shop')::uuid;loc uuid:=current_setting('returns.loc')::uuid;other_loc uuid;
begin
 perform public.assign_membership_locations(shop,current_setting('returns.reader_member')::uuid,array[loc]);
 perform public.assign_membership_locations(shop,current_setting('returns.manager_member')::uuid,array[loc]);
 other_loc:=public.save_shop_location(shop,null,'Unassigned return branch','RETURN-OTHER',null,null);
 perform set_config('returns.other_loc',other_loc::text,true);
 -- A correctly authorized owner still cannot substitute another location scope.
 begin perform public.get_sale_return(shop,other_loc,current_setting('returns.read_return')::uuid);raise exception 'Wrong-scope return document read';exception when no_data_found then
  if sqlerrm<>'RETURN_NOT_FOUND' then raise;end if;end;
 begin perform public.sale_return_context(shop,other_loc,current_setting('returns.sale')::uuid);raise exception 'Wrong-scope return context read';exception when no_data_found then
  if sqlerrm<>'SALE_NOT_FOUND' then raise;end if;end;
end;$$;
reset role;
select set_config('request.jwt.claim.sub',sales_reader::text,true) from return_fixture;
set local role authenticated;
do $$declare shop uuid:=current_setting('returns.shop')::uuid;loc uuid:=current_setting('returns.loc')::uuid;sale uuid:=current_setting('returns.sale')::uuid;ordinary jsonb;
begin
 if coalesce((select can_view from public.payment_access(shop)),true) then raise exception 'Sales-only fixture has payment visibility';end if;
 ordinary:=public.get_location_sale(shop,loc,sale);
 if ordinary is null or ordinary->>'id'<>sale::text or ordinary->'payments'<>'[]'::jsonb then raise exception 'Sales-only fixture does not reproduce get_sale payment redaction';end if;
 begin perform public.get_sale_return(shop,loc,current_setting('returns.read_return')::uuid);raise exception 'Sales-only member read refund document';exception when insufficient_privilege then
  if sqlerrm<>'SHOP_PERMISSION_DENIED' then raise;end if;end;
 begin perform public.sale_return_context(shop,loc,sale);raise exception 'Sales-only member read refund context';exception when insufficient_privilege then
  if sqlerrm<>'SHOP_PERMISSION_DENIED' then raise;end if;end;
end;$$;
reset role;
select set_config('request.jwt.claim.sub',manager::text,true) from return_fixture;
set local role authenticated;
do $$declare shop uuid:=current_setting('returns.shop')::uuid;loc uuid:=current_setting('returns.loc')::uuid;sale uuid:=current_setting('returns.sale')::uuid;doc jsonb;ctx jsonb;
begin
 if not coalesce((select can_view from public.payment_access(shop)),false) then raise exception 'Manager fixture lacks payment visibility';end if;
 doc:=public.get_sale_return(shop,loc,current_setting('returns.read_return')::uuid);
 ctx:=public.sale_return_context(shop,loc,sale);
 if doc->>'invoice_id'<>sale::text or doc->'refunds'->0->>'payment_id' is null or doc->'refunds'->0->>'allocation_id' is null
  or (doc->'refunds'->0->>'amount')::numeric<>20 or doc->'refunds'->0->>'method'<>'card' then raise exception 'Authorized manager lost original refund details';end if;
 if not exists(select 1 from jsonb_array_elements(doc->'refunds')r cross join lateral jsonb_array_elements(r->'events')e where e->>'reference'='BANK-REF-20') then raise exception 'Authorized manager lost external refund reference';end if;
 if not (ctx->>'canReturn')::boolean or not exists(select 1 from jsonb_array_elements(ctx->'history')h where h->>'id'=doc->>'id') then raise exception 'Authorized manager lost return context';end if;
 begin perform public.get_sale_return(shop,current_setting('returns.other_loc')::uuid,current_setting('returns.read_return')::uuid);raise exception 'Manager read unassigned-location refund';exception when insufficient_privilege then
  if sqlerrm<>'LOCATION_ACCESS_DENIED' then raise;end if;end;
 begin perform public.sale_return_context(shop,current_setting('returns.other_loc')::uuid,sale);raise exception 'Manager read unassigned-location context';exception when insufficient_privilege then
  if sqlerrm<>'LOCATION_ACCESS_DENIED' then raise;end if;end;
end;$$;
reset role;
