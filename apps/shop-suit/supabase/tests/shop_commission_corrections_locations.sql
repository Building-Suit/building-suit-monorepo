-- Regression boundaries: corrected receivables are not payment, and draft
-- attribution is constrained by the acting user's actual invoice location.
create temporary table commission_boundary_fixture as
select gen_random_uuid() owner_id, gen_random_uuid() staff_id;
grant select on commission_boundary_fixture to authenticated;
insert into auth.users(id,email,encrypted_password,aud,role,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select id,id::text||'@commission-boundary.invalid','x','authenticated','authenticated',now(),'{}','{}',now(),now()
from(select owner_id id from commission_boundary_fixture union all select staff_id from commission_boundary_fixture) users;
select set_config('request.jwt.claim.sub',owner_id::text,true),
 set_config('request.jwt.claim.role','authenticated',true) from commission_boundary_fixture;
set local role authenticated;
do $$
declare shop uuid; a uuid; b uuid; member uuid; customer uuid; service uuid; free_service uuid;
 product uuid; sale uuid; line uuid; appointment uuid; chosen_service uuid; receipt uuid; snap jsonb;
 policy jsonb; correction uuid; request uuid; effective_at timestamptz; n integer;
begin
 shop:=public.create_owner_shop('Commission boundaries','mixed'::public.business_mode);
 select id into a from public.shop_locations where shop_id=shop and is_default;
 b:=public.save_shop_location(shop,null,'Commission branch B','COMP-B',null,null);
 select id into member from public.shop_memberships where shop_id=shop and role='owner';
 customer:=public.save_customer(shop,null,'Boundary customer',null,null,null,null);
 service:=public.save_service(shop,null,'Boundary haircut',null,100,'amount',0,true,30,0,array[a],array[member]);
 free_service:=public.save_service(shop,null,'Zero-price eligible haircut',null,0,'amount',0,true,30,0,array[a],array[member]);
 product:=public.save_product(shop,null,'Draft attribution product',null,null,100);
 perform public.save_staff_schedule(shop,a,member,'Etc/UTC',
  (select jsonb_agg(jsonb_build_object('weekday',d,'startsLocal','00:00','endsLocal','23:59')) from generate_series(0,6)d),'[]');
 for n in 1..4 loop
  policy:=jsonb_build_object('enabled',true,'currency','EGP','service',
   jsonb_build_object('type',case when n=3 then 'fixed' else 'percentage' end,'rate',10),
   'employees',jsonb_build_array(jsonb_build_object('membershipId',member,'enabled',true)));
  perform public.save_commission_policy(gen_random_uuid(),shop,policy,'Boundary regression policy');
  chosen_service:=case when n=3 then free_service else service end;
  sale:=public.save_sale_draft(gen_random_uuid(),shop,null,customer,null,
   jsonb_build_array(jsonb_build_object('item_type','service','source_id',chosen_service,'quantity',1)));
  select id into line from public.invoice_items where invoice_id=sale;
  appointment:=public.save_appointment(gen_random_uuid(),shop,null,a,member,chosen_service,
   date_trunc('day',now())+interval '1 day 10 hours'+make_interval(hours=>n),
   'customer',customer,null,null,null);
  perform public.link_appointment_sale(gen_random_uuid(),shop,appointment,sale);
  perform public.assign_sale_commission(shop,line,member,appointment);
  perform public.issue_sale(gen_random_uuid(),shop,sale);
  perform public.transition_appointment(gen_random_uuid(),shop,appointment,'arrived',null);
  perform public.transition_appointment(gen_random_uuid(),shop,appointment,'in_service',null);
  if n<>2 then perform public.transition_appointment(gen_random_uuid(),shop,appointment,'completed',null); end if;
  if n in(1,4) then
   receipt:=public.record_customer_receipt(gen_random_uuid(),shop,customer,
    case when n=1 then 50 else 100 end,now(),'cash',null,null,
    jsonb_build_array(jsonb_build_object('invoice_id',sale,'amount',case when n=1 then 50 else 100 end)));
  end if;
  snap:=public.commission_history(shop,sale)->'lines'->0;
  if n in(1,2) and (snap->>'earned')::numeric<>0 then raise exception 'Unpaid/partial sale earned before correction'; end if;
  if n=4 then
   if (snap->>'earned')::numeric<>10 then raise exception 'Fully paid fulfilled sale did not earn'; end if;
   perform set_config('commission_boundary.paid_sale',sale::text,true);
   perform set_config('commission_boundary.receipt',receipt::text,true);
   continue;
  end if;
  if n=3 then
   if (snap->>'earned')::numeric<>10 then raise exception 'Fixed commission fixture did not earn'; end if;
   perform public.record_commission_adjustment(shop,(snap->>'id')::uuid,gen_random_uuid(),'exported',0,'Already exported fixture');
  end if;
  request:=gen_random_uuid(); effective_at:=clock_timestamp();
  correction:=public.correct_location_sale(request,shop,a,sale,effective_at,'Full cancellation boundary',null);
  if public.correct_location_sale(request,shop,a,sale,effective_at,'Full cancellation boundary',null)<>correction then
   raise exception 'Correction retry changed identity'; end if;
  if n=2 then
   -- A late explicit completion must not turn a void's zero receivable into pay.
   begin
    perform public.transition_appointment(gen_random_uuid(),shop,appointment,'completed',null);
    raise exception 'Corrected sale accepted new service fulfillment';
   exception when check_violation then null;end;
  end if;
  snap:=public.commission_history(shop,sale)->'lines'->0;
  if n in(1,2) and ((snap->>'earned')::numeric<>0 or (snap->>'adjustments')::numeric<>0) then
   raise exception 'Correction/late completion fabricated earnings for case %: %',n,snap; end if;
  if n=1 and (public.sale_correction_state(shop,a,sale)#>>'{correction,refundAmount}')::numeric<>50 then
   raise exception 'Partial cancellation changed existing refund behavior'; end if;
  if n=3 and ((snap->>'earned')::numeric<>10 or (snap->>'adjustments')::numeric<>-10
    or (snap->>'postExportAdjustments')::numeric<>-10) then
   raise exception 'Zero-money full correction did not reverse full prior fixed earning: %',snap; end if;
 end loop;
 -- Drafts in two branches, with an existing owner assignment in B. These are
 -- deliberately not issued: the access boundary must precede assign AND clear.
 sale:=public.save_pos_sale_draft(gen_random_uuid(),shop,a,null,member,null,customer,null,
  jsonb_build_array(jsonb_build_object('item_type','product','source_id',product,'quantity',1)));
 select id into line from public.invoice_items where invoice_id=sale;
 perform set_config('commission_boundary.sale_a',sale::text,true);
 perform set_config('commission_boundary.line_a',line::text,true);
 sale:=public.save_pos_sale_draft(gen_random_uuid(),shop,b,null,member,null,customer,null,
  jsonb_build_array(jsonb_build_object('item_type','product','source_id',product,'quantity',1)));
 select id into line from public.invoice_items where invoice_id=sale;
 perform public.assign_sale_commission(shop,line,member,null);
 perform set_config('commission_boundary.sale_b',sale::text,true);
 perform set_config('commission_boundary.line_b',line::text,true);
 perform set_config('commission_boundary.shop',shop::text,true);
 perform set_config('commission_boundary.a',a::text,true);
 perform set_config('commission_boundary.owner_member',member::text,true);
end; $$;
reset role;

-- Allocation IDs and protected staff fixture setup are DB-owner-only.
select set_config('commission_boundary.allocation',id::text,true)
from public.customer_payment_allocations where payment_id=current_setting('commission_boundary.receipt')::uuid;
do $$
declare profile uuid; member uuid; role_id uuid; shop uuid:=current_setting('commission_boundary.shop')::uuid;
begin
 insert into public.profiles(user_id,portal_id,display_name,email_snapshot)
 select f.staff_id,s.portal_id,'Location A staff','staff@commission-boundary.invalid'
 from commission_boundary_fixture f join public.shops s on s.id=shop returning id into profile;
 insert into public.shop_memberships(shop_id,profile_id,role) values(shop,profile,'employee') returning id into member;
 select id into role_id from public.roles where shop_id=shop and key='staff';
 insert into public.membership_roles(membership_id,role_id) values(member,role_id);
 insert into public.role_permissions(role_id,permission_id) select role_id,p.id from public.permissions p
 join public.shops s on s.portal_id=p.portal_id where s.id=shop and p.key='sales.manage' on conflict do nothing;
 perform set_config('commission_boundary.staff_member',member::text,true);
end; $$;

select set_config('request.jwt.claim.sub',owner_id::text,true) from commission_boundary_fixture;
set local role authenticated;
do $$
declare shop uuid:=current_setting('commission_boundary.shop')::uuid;
 sale uuid:=current_setting('commission_boundary.paid_sale')::uuid; snap jsonb;
begin
 perform public.refund_customer_receipt(gen_random_uuid(),shop,current_setting('commission_boundary.receipt')::uuid,
  now(),'cash',null,'Half refunded before full correction',
  jsonb_build_array(jsonb_build_object('allocation_id',current_setting('commission_boundary.allocation')::uuid,'amount',50)));
 snap:=public.commission_history(shop,sale)->'lines'->0;
 if (snap->>'earned')::numeric<>10 or (snap->>'adjustments')::numeric<>-5 then
  raise exception 'Partial financial return repriced prior earning'; end if;
 perform public.correct_location_sale(gen_random_uuid(),shop,current_setting('commission_boundary.a')::uuid,sale,
  clock_timestamp(),'Full correction after partial refund',null);
 snap:=public.commission_history(shop,sale)->'lines'->0;
 if (snap->>'earned')::numeric<>10 or (snap->>'adjustments')::numeric<>-10 then
  raise exception 'Full correction did not absorb remaining prior percentage earning'; end if;
end; $$;
reset role;

select set_config('request.jwt.claim.sub',staff_id::text,true) from commission_boundary_fixture;
set local role authenticated;
do $$
declare shop uuid:=current_setting('commission_boundary.shop')::uuid;
 member uuid:=current_setting('commission_boundary.staff_member')::uuid;
 line_b uuid:=current_setting('commission_boundary.line_b')::uuid; context jsonb;
begin
 context:=public.commission_assignment_context(shop,current_setting('commission_boundary.sale_a')::uuid);
 if jsonb_array_length(context->'lines')<>1 then raise exception 'Assigned-location positive context failed'; end if;
 perform public.assign_sale_commission(shop,current_setting('commission_boundary.line_a')::uuid,member,null);
 perform public.assign_sale_commission(shop,current_setting('commission_boundary.line_a')::uuid,null,null);
 begin
  perform public.commission_assignment_context(shop,current_setting('commission_boundary.sale_b')::uuid);
  raise exception 'Location A staff read location B attribution';
 exception when insufficient_privilege then if sqlerrm<>'LOCATION_ACCESS_DENIED' then raise; end if; end;
 begin
  perform public.assign_sale_commission(shop,line_b,current_setting('commission_boundary.owner_member')::uuid,null);
  raise exception 'Location A staff assigned location B attribution';
 exception when insufficient_privilege then if sqlerrm<>'LOCATION_ACCESS_DENIED' then raise; end if; end;
 begin
  perform public.assign_sale_commission(shop,line_b,null,null);
  raise exception 'Location A staff cleared location B attribution';
 exception when insufficient_privilege then if sqlerrm<>'LOCATION_ACCESS_DENIED' then raise; end if; end;
end; $$;
reset role;
do $$
begin
 if not exists(select 1 from public.commission_line_assignments where line_id=current_setting('commission_boundary.line_b')::uuid
  and membership_id=current_setting('commission_boundary.owner_member')::uuid) then
  raise exception 'Denied cross-location action mutated the existing assignment'; end if;
end; $$;
\echo commission-correction-location-regressions-passed
