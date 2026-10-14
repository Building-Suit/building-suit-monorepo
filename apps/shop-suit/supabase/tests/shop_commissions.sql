-- Disposable, deterministic SS-BARBER-COMP-001 regression fixtures. Runner owns BEGIN/ROLLBACK.
create temporary table commission_fixture as select gen_random_uuid() owner,gen_random_uuid() outsider,gen_random_uuid() other_owner;
insert into auth.users(id,email,encrypted_password,aud,role,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select id,id::text||'@commission.invalid','x','authenticated','authenticated',now(),'{}','{}',now(),now()
from(select owner id from commission_fixture union all select outsider from commission_fixture union all select other_owner from commission_fixture)u;
grant select on commission_fixture to authenticated;
select set_config('request.jwt.claim.sub',owner::text,true),set_config('request.jwt.claim.role','authenticated',true) from commission_fixture;
set local role authenticated;
do $$
declare shop uuid; member uuid; customer uuid; service uuid; product uuid; location uuid; sale uuid; line uuid; appointment uuid;
 policy jsonb; snap jsonb; req uuid:=gen_random_uuid(); first_policy uuid; second_policy uuid; receipt uuid;
begin
 shop:=public.create_owner_shop('Commission fixture','mixed'::public.business_mode);
 select id into member from public.shop_memberships where shop_id=shop and role='owner';
 select id into location from public.shop_locations where shop_id=shop and is_default;
 customer:=public.save_customer(shop,null,'Commission customer',null,null,null,null);
 service:=public.save_service(shop,null,'Discounted haircut',null,100,'percent',20,true,30,0,array[location],array[member]);
 product:=public.save_product(shop,null,'Commission product',null,null,10);
 perform public.adjust_stock(gen_random_uuid(),shop,product,10,1,'Commission fixture opening');
 perform public.save_staff_schedule(shop,location,member,'Etc/UTC',
 (select jsonb_agg(jsonb_build_object('weekday',d,'startsLocal','00:00','endsLocal','23:59')) from generate_series(0,6)d),'[]');
 -- Disabled/missing config must not block ordinary checkout or create snapshots.
 sale:=public.save_sale_draft(gen_random_uuid(),shop,null,customer,null,jsonb_build_array(jsonb_build_object('item_type','product','source_id',product,'quantity',1)));
 perform public.issue_sale(gen_random_uuid(),shop,sale);
 if public.commission_history(shop,sale)->'lines'<>'[]'::jsonb then raise exception 'Missing policy earned commission'; end if;
 policy:=jsonb_build_object('enabled',true,'currency','EGP','service',jsonb_build_object('type','percentage','rate',10),
 'product',jsonb_build_object('type','fixed','rate',0.0167),'employees',jsonb_build_array(jsonb_build_object('membershipId',member,'enabled',true,
 'service',jsonb_build_object('type','percentage','rate',12.5))));
 first_policy:=public.save_commission_policy(req,shop,policy,'Initial opt-in');
 if public.save_commission_policy(req,shop,policy,'Initial opt-in')<>first_policy then raise exception 'Policy replay mismatch'; end if;
 begin
  perform public.save_commission_policy(req,shop,jsonb_set(policy,'{enabled}','false'),'Initial opt-in');
  raise exception 'Reused policy request accepted';
 exception when unique_violation then null; end;
 -- Cross-tenant employee IDs must not be accepted by a manager owning both shops.
 declare other_shop uuid; other_member uuid;
 begin
  perform set_config('request.jwt.claim.sub',(select other_owner from commission_fixture)::text,true);
  other_shop:=public.create_owner_shop('Other commission tenant','mixed'::public.business_mode);
  select id into other_member from public.shop_memberships where shop_id=other_shop and role='owner';
  perform set_config('commission_test.other_shop',other_shop::text,true);
  perform set_config('request.jwt.claim.sub',(select owner from commission_fixture)::text,true);
  begin
   perform public.save_commission_policy(gen_random_uuid(),shop,jsonb_set(policy,'{employees,0,membershipId}',to_jsonb(other_member::text)),'Cross tenant employee');
   raise exception 'Cross tenant employee accepted';
  exception when foreign_key_violation then null; end;
 end;
 -- No retroactive backfill of existing sale after enabling.
 if public.commission_history(shop,sale)->'lines'<>'[]'::jsonb then raise exception 'Backfill detected'; end if;
 sale:=public.save_sale_draft(gen_random_uuid(),shop,null,customer,null,jsonb_build_array(jsonb_build_object('item_type','service','source_id',service,'quantity',1)));
 select id into line from public.invoice_items where invoice_id=sale;
 appointment:=public.save_appointment(gen_random_uuid(),shop,null,location,member,service,date_trunc('day',now())+interval '1 day 10 hours','customer',customer,null,null,null);
 perform public.link_appointment_sale(gen_random_uuid(),shop,appointment,sale);
 perform public.assign_sale_commission(shop,line,member,appointment);
 perform public.issue_sale(gen_random_uuid(),shop,sale);
 snap:=public.commission_history(shop,sale)->'lines'->0;
 if (snap->>'netLineAmount')::numeric<>80 or (snap->>'estimate')::numeric<>10 or (snap->>'earned')::numeric<>0 then
  raise exception 'Discounted net basis or staff override incorrect: %',snap; end if;
 -- Finalized net input excludes any separately charged tax, tips or fees; no
 -- current native tax field exists, so no fictional taxed checkout is asserted.
 receipt:=public.record_customer_receipt(gen_random_uuid(),shop,customer,30,now(),'cash',null,null,jsonb_build_array(jsonb_build_object('invoice_id',sale,'amount',30)));
 if (public.commission_history(shop,sale)->'lines'->0->>'earned')::numeric<>0 then raise exception 'Partial payment earned'; end if;
 perform public.record_customer_receipt(gen_random_uuid(),shop,customer,50,now(),'cash',null,null,jsonb_build_array(jsonb_build_object('invoice_id',sale,'amount',50)));
 if (public.commission_history(shop,sale)->'lines'->0->>'earned')::numeric<>0 then raise exception 'Payment invented fulfillment'; end if;
 second_policy:=public.save_commission_policy(gen_random_uuid(),shop,jsonb_set(policy,'{employees,0,service,rate}','99'),'Future rate change');
 perform public.transition_appointment(gen_random_uuid(),shop,appointment,'arrived',null);
 perform public.transition_appointment(gen_random_uuid(),shop,appointment,'in_service',null);
 perform public.transition_appointment(gen_random_uuid(),shop,appointment,'completed',null);
 perform public.transition_appointment(gen_random_uuid(),shop,appointment,'completed',null);
 snap:=public.commission_history(shop,sale)->'lines'->0;
 if (snap->>'earned')::numeric<>10 or snap->>'policyVersionId'<>first_policy::text then raise exception 'Rate repriced or duplicate completion earned twice'; end if;
 perform public.record_commission_adjustment(shop,(snap->>'id')::uuid,req,'exported',0,'Already exported externally');
 perform set_config('commission_test.receipt',receipt::text,true);
 perform set_config('commission_test.shop',shop::text,true);
 perform set_config('commission_test.member',member::text,true);
 perform set_config('commission_test.service_snapshot',snap->>'id',true);
 -- Fixed 0.0167 per unit yields 0.05 over three units; test cumulative hook below.
 sale:=public.save_sale_draft(gen_random_uuid(),shop,null,customer,null,jsonb_build_array(jsonb_build_object('item_type','product','source_id',product,'quantity',3)));
 select id into line from public.invoice_items where invoice_id=sale;
 perform public.assign_sale_commission(shop,line,member,null);
 perform public.issue_sale(gen_random_uuid(),shop,sale);
 req:=gen_random_uuid();
 perform public.record_customer_receipt(req,shop,customer,30,now(),'cash',null,null,jsonb_build_array(jsonb_build_object('invoice_id',sale,'amount',30)));
 perform public.record_customer_receipt(req,shop,customer,30,now(),'cash',null,null,jsonb_build_array(jsonb_build_object('invoice_id',sale,'amount',30)));
 snap:=public.commission_history(shop,sale)->'lines'->0;
 if (snap->>'earned')::numeric<>0.05 then raise exception 'Fixed unit calculation or duplicate receipt failed'; end if;
 perform set_config('commission_test.fixed_snapshot',snap->>'id',true);
 perform set_config('commission_test.fixed_sale',sale::text,true);
 -- Percentage refund rounding, independently of fixed/quantity rounding.
 perform public.save_commission_policy(gen_random_uuid(),shop,jsonb_set(policy,'{product}','{"type":"percentage","rate":0.1667}'),'Percentage rounding fixture');
 sale:=public.save_sale_draft(gen_random_uuid(),shop,null,customer,null,jsonb_build_array(jsonb_build_object('item_type','product','source_id',product,'quantity',3)));
 select id into line from public.invoice_items where invoice_id=sale;
 perform public.assign_sale_commission(shop,line,member,null);
 perform public.issue_sale(gen_random_uuid(),shop,sale);
 perform public.record_customer_receipt(gen_random_uuid(),shop,customer,30,now(),'cash',null,null,jsonb_build_array(jsonb_build_object('invoice_id',sale,'amount',30)));
 snap:=public.commission_history(shop,sale)->'lines'->0;
 if (snap->>'earned')::numeric<>0.05 then raise exception 'Percentage precision failed'; end if;
 perform set_config('commission_test.percentage_snapshot',snap->>'id',true);
 -- Employee disabled overrides shop enabled.
 perform public.save_commission_policy(gen_random_uuid(),shop,jsonb_set(policy,'{employees,0,enabled}','false'),'Employee opted out');
 sale:=public.save_sale_draft(gen_random_uuid(),shop,null,customer,null,jsonb_build_array(jsonb_build_object('item_type','product','source_id',product,'quantity',1)));
 select id into line from public.invoice_items where invoice_id=sale;
 perform public.assign_sale_commission(shop,line,member,null);
 perform public.issue_sale(gen_random_uuid(),shop,sale);
 if public.commission_history(shop,sale)->'lines'<>'[]'::jsonb then raise exception 'Disabled employee snapshot'; end if;
 begin perform public.assign_sale_commission(shop,line,member,null); raise exception 'Issued attribution editable'; exception when object_not_in_prerequisite_state then null; end;
end; $$;
reset role;

select set_config('commission_test.allocation',id::text,true) from public.customer_payment_allocations where payment_id=current_setting('commission_test.receipt')::uuid;
select set_config('request.jwt.claim.sub',owner::text,true) from commission_fixture;
set local role authenticated;
do $$
declare snap jsonb;
begin
 perform public.refund_customer_receipt(gen_random_uuid(),current_setting('commission_test.shop')::uuid,current_setting('commission_test.receipt')::uuid,now(),'cash',null,'Partial financial refund',jsonb_build_array(jsonb_build_object('allocation_id',current_setting('commission_test.allocation')::uuid,'amount',10)));
 snap:=public.commission_history(current_setting('commission_test.shop')::uuid)->'lines';
 if not exists(select 1 from jsonb_array_elements(snap) s where s->>'id'=current_setting('commission_test.service_snapshot') and (s->>'adjustments')::numeric=-1.25 and (s->>'postExportAdjustments')::numeric=-1.25) then raise exception 'Percentage financial return or exported adjustment incorrect'; end if;
end; $$;
reset role;
do $$
declare s uuid:=current_setting('commission_test.fixed_snapshot')::uuid; t uuid:=current_setting('commission_test.service_snapshot')::uuid;
 total numeric; amounts numeric[];
begin
 perform shop_private.adjust_commission_return(s,'qty1',10,1,'One item returned');
 perform shop_private.adjust_commission_return(s,'qty1',10,1,'One item returned');
 perform shop_private.adjust_commission_return(s,'qty2',20,2,'Two items returned');
 perform shop_private.adjust_commission_return(s,'qty3',30,3,'All items returned');
 select array_agg(amount order by created_at,id),sum(amount) into amounts,total from public.commission_events where snapshot_id=s and kind='return';
 if amounts<>array[-0.02,-0.01,-0.02]::numeric[] or total<>-0.05 then raise exception 'Fixed quantity rounding mismatch %',amounts; end if;
 s:=current_setting('commission_test.percentage_snapshot')::uuid;
 perform shop_private.adjust_commission_return(s,'net1',10,0,'One third financial return');
 perform shop_private.adjust_commission_return(s,'net2',20,0,'Two thirds financial return');
 perform shop_private.adjust_commission_return(s,'net3',30,0,'Full financial return');
 select array_agg(amount order by created_at,id),sum(amount) into amounts,total from public.commission_events where snapshot_id=s and kind='return';
 if amounts<>array[-0.02,-0.01,-0.02]::numeric[] or total<>-0.05 then raise exception 'Percentage financial rounding mismatch %',amounts; end if;
 perform shop_private.adjust_commission_return(t,'net-half',40,0,'Cumulative half net returned');
 perform shop_private.adjust_commission_return(t,'net-all',80,0,'Cumulative full net returned');
 if (select sum(amount) from public.commission_events where snapshot_id=t and kind='return')<>-10 then raise exception 'Percentage full return did not absorb rounding'; end if;
 begin update public.commission_snapshots set rate=50 where id=s; raise exception 'History editable'; exception when object_not_in_prerequisite_state then null; end;
 begin delete from public.commission_events where snapshot_id=s; raise exception 'Events deletable'; exception when object_not_in_prerequisite_state then null; end;
 if has_function_privilege('authenticated','shop_private.adjust_commission_return(uuid,text,numeric,numeric,text)','execute')
 or has_table_privilege('authenticated','public.commission_events','insert') then raise exception 'Private mutation exposed'; end if;
end; $$;
do $$
declare profile uuid; member uuid; role_id uuid; shop uuid:=current_setting('commission_test.shop')::uuid;
begin
 insert into public.profiles(user_id,portal_id,display_name,email_snapshot) select f.outsider,s.portal_id,'Unauthorized staff','staff@commission.invalid' from commission_fixture f join public.shops s on s.id=shop returning id into profile;
 insert into public.shop_memberships(shop_id,profile_id,role) values(shop,profile,'employee') returning id into member;
 select id into role_id from public.roles where shop_id=shop and key='staff';
 insert into public.membership_roles(membership_id,role_id) values(member,role_id);
 insert into public.role_permissions(role_id,permission_id) select role_id,p.id from public.permissions p join public.shops s on s.portal_id=p.portal_id where s.id=shop and p.key='team.manage' on conflict do nothing;
end; $$;
select set_config('request.jwt.claim.sub',outsider::text,true) from commission_fixture;
set local role authenticated;
do $$
declare shop uuid:=current_setting('commission_test.shop')::uuid;
begin
 begin perform public.commission_history(shop); raise exception 'Cross tenant history accepted'; exception when insufficient_privilege then null; end;
 begin perform public.save_commission_policy(gen_random_uuid(),shop,'{}','Unauthorized change'); raise exception 'Cross tenant config accepted'; exception when insufficient_privilege then null; end;
 begin perform public.record_commission_adjustment(shop,current_setting('commission_test.fixed_snapshot')::uuid,gen_random_uuid(),'correction',1,'Unauthorized correction'); raise exception 'Cross tenant correction accepted'; exception when insufficient_privilege then null; end;
end; $$;
reset role;
do $$
declare member uuid; manager uuid; shop uuid:=current_setting('commission_test.shop')::uuid;
begin
 select m.id into member from public.shop_memberships m join public.profiles p on p.id=m.profile_id join commission_fixture f on p.user_id=f.outsider where m.shop_id=shop;
 select id into manager from public.roles where shop_id=shop and key='manager' and is_system;
 delete from public.membership_roles where membership_id=member;
 insert into public.membership_roles(membership_id,role_id) values(member,manager);
end; $$;
set local role authenticated;
do $$
declare shop uuid:=current_setting('commission_test.shop')::uuid;
begin
 perform public.save_commission_policy(gen_random_uuid(),shop,'{"enabled":false,"currency":"EGP","employees":[]}','Authorized manager opted out');
 perform public.commission_history(shop);
 begin perform public.commission_history(current_setting('commission_test.other_shop')::uuid); raise exception 'Manager read another tenant'; exception when insufficient_privilege then null; end;
end; $$;
reset role;
\echo commission-regressions-passed
