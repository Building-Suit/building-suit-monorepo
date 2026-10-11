begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(1);
create temporary table cash_policy_fixture as select gen_random_uuid() owner_id, gen_random_uuid() other_id;
grant select on cash_policy_fixture to authenticated;
insert into auth.users (id,email,encrypted_password,aud,role,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select owner_id,'cash-policy-owner@example.invalid','x','authenticated','authenticated',now(),'{}'::jsonb,'{}'::jsonb,now(),now() from cash_policy_fixture
union all select other_id,'cash-policy-other@example.invalid','x','authenticated','authenticated',now(),'{}'::jsonb,'{}'::jsonb,now(),now() from cash_policy_fixture;
select set_config('request.jwt.claim.sub',owner_id::text,true),set_config('request.jwt.claim.role','authenticated',true) from cash_policy_fixture;
set local role authenticated;
do $$
declare s uuid; loc uuid; branch uuid; member uuid; customer uuid; service uuid;
 invoice uuid; session uuid; req uuid; issue_req uuid; pay_req uuid; result uuid;
 paid timestamptz := now(); method public.payment_method; stage integer; command integer;
 blocked boolean; must_block boolean; required boolean; payment uuid; allocation uuid;
 refund_req uuid := gen_random_uuid(); dashboard jsonb;
 completed_invoice uuid; completed_req uuid; completed_issue_req uuid; completed_pay_req uuid;
begin
 s := public.create_owner_shop('Cash policy fixture','multi','service');
 select id into loc from public.shop_locations where shop_id=s and is_default;
 branch := public.save_shop_location(s,null,'Other branch','OTHER',null,null);
 select id into member from public.shop_memberships where shop_id=s and role='owner';
 customer := public.save_customer(s,null,'Policy customer',null,null,null,null);
 service := public.save_service(s,null,'Policy service',null,70,'amount',0);
 if public.shop_cash_policy(s) then raise exception 'new Shop policy must default OFF'; end if;
 begin
   update public.shops set require_open_cash_shift=true where id=s;
   raise exception 'direct policy update allowed';
 exception when insufficient_privilege then null; end;
 begin
   perform public.set_shop_cash_policy(s,null);
   raise exception 'null policy allowed';
 exception when invalid_parameter_value then null; end;
 -- Every authoritative path: both methods, OFF/ON, wrong/open/closed location.
 for stage in 0..5 loop
   required := stage between 1 and 4;
   perform public.set_shop_cash_policy(s,required);
   perform public.set_shop_cash_policy(s,required);
   if stage=2 then perform public.open_cash_shift(gen_random_uuid(),s,branch,'main',0,null); end if;
   if stage=3 then session := public.open_cash_shift(gen_random_uuid(),s,loc,'main',100,null); end if;
   if stage=4 then
     dashboard := public.cash_shift_dashboard(s,loc,null,1,20);
     perform public.close_cash_shift(gen_random_uuid(),s,session,(dashboard #>> '{active,expectedCash}')::numeric,null);
     perform public.checkout_pos_sale(completed_req,completed_issue_req,completed_pay_req,null,
       s,loc,completed_invoice,70,paid,'card',null); -- completed retry after close
   end if;
   must_block := stage in (1,2,4);
   foreach method in array array['cash','card']::public.payment_method[] loop
     for command in 0..7 loop
       -- Issue receipt fixtures with policy OFF to isolate the payment guard.
       if command in (6,7) then perform public.set_shop_cash_policy(s,false); end if;
       invoice := public.save_pos_sale_draft(gen_random_uuid(),s,loc,null,member,null,
         case when command in (2,3,5) then null else customer end,null,
         jsonb_build_array(jsonb_build_object('item_type','service','source_id',service,'quantity',1)));
       invoice := public.save_pos_sale_draft(gen_random_uuid(),s,loc,invoice,member,null,
         case when command in (2,3,5) then null else customer end,'Edited draft',
         jsonb_build_array(jsonb_build_object('item_type','service','source_id',service,'quantity',1)));
       if command in (6,7) then
         perform public.issue_location_sale(gen_random_uuid(),s,loc,invoice);
         perform public.set_shop_cash_policy(s,required);
       end if;
       req := gen_random_uuid(); issue_req := gen_random_uuid(); pay_req := gen_random_uuid(); blocked := false;
       begin
         for retry in 1..2 loop
           case command
             when 0 then result := public.issue_sale(req,s,invoice);
             when 1 then result := public.issue_location_sale(req,s,loc,invoice);
             when 2 then result := public.checkout_customerless_sale(req,s,invoice,70,paid,method,null);
             when 3 then result := public.checkout_location_sale(req,s,loc,invoice,70,paid,method,null);
             when 4,5 then result := public.checkout_pos_sale(req,issue_req,pay_req,null,s,loc,invoice,70,paid,method,null);
             when 6 then result := public.record_customer_receipt(req,s,customer,70,paid,method,null,null,
               jsonb_build_array(jsonb_build_object('invoice_id',invoice,'amount',70)));
             when 7 then result := public.record_location_customer_receipt(req,s,loc,customer,70,paid,method,null,null,
               jsonb_build_array(jsonb_build_object('invoice_id',invoice,'amount',70)));
           end case;
         end loop;
       exception when check_violation then
         if sqlerrm <> 'SALE_OPEN_CASH_SHIFT_REQUIRED' then raise; end if;
         blocked := true;
       end;
       if blocked <> must_block then raise exception 'policy mismatch stage %, command %, method %',stage,command,method; end if;
       if blocked and command < 6 and (select status from public.invoices where id=invoice) <> 'draft' then raise exception 'blocked checkout changed draft'; end if;
       if blocked and exists(select 1 from public.payments where invoice_id=invoice) then raise exception 'blocked checkout wrote payment'; end if;
       if stage=3 and command=5 and method='card' then
         completed_invoice := invoice; completed_req := req;
         completed_issue_req := issue_req; completed_pay_req := pay_req;
       end if;
       if stage=3 and command=4 and method='cash' then
         select id into payment from public.payments where invoice_id=invoice and customer_kind='receipt';
         select id into allocation from public.customer_payment_allocations where payment_id=payment;
         for retry in 1..2 loop
           perform public.refund_customer_receipt(refund_req,s,payment,paid,'cash',null,'Policy refund',
             jsonb_build_array(jsonb_build_object('allocation_id',allocation,'amount',20)));
         end loop;
       end if;
     end loop;
   end loop;
   if stage=3 then
     dashboard := public.cash_shift_dashboard(s,loc,null,1,20);
     if (dashboard #>> '{active,expectedCash}')::numeric <> 500
       or (dashboard #>> '{active,cashSales}')::numeric <> 420
       or (dashboard #>> '{active,cashRefunds}')::numeric <> 20
       or jsonb_array_length(dashboard #> '{active,events}') <> 7 then
       raise exception 'drawer exactly-once/non-cash invariant failed: %',dashboard;
     end if;
   end if;
 end loop;
 perform set_config('cash_policy.shop',s::text,true);
end;
$$;
reset role;
do $$
declare s uuid := current_setting('cash_policy.shop')::uuid;
begin
 if exists(select 1 from public.shop_cash_policy_changes where shop_id=s and (previous_required=new_required or changed_by_profile_id is null or changed_at is null))
   or not exists(select 1 from public.shop_cash_policy_changes where shop_id=s and new_required)
   or not exists(select 1 from public.shop_cash_policy_changes where shop_id=s and not new_required) then raise exception 'missing/invalid audit'; end if;
 begin
   update public.shop_cash_policy_changes set changed_at=now() where shop_id=s;
   raise exception 'audit mutable';
 exception when object_not_in_prerequisite_state then
   if sqlerrm <> 'CASH_POLICY_AUDIT_IMMUTABLE' then raise; end if;
 end;
 if has_function_privilege('anon','public.set_shop_cash_policy(uuid,boolean)','execute')
   or has_function_privilege('authenticated','shop_private.assert_sale_cash_shift(uuid,uuid)','execute') then raise exception 'unsafe policy privilege'; end if;
end;
$$;
select set_config('request.jwt.claim.sub',other_id::text,true) from cash_policy_fixture;
set local role authenticated;
do $$
begin
 begin
   perform public.set_shop_cash_policy(current_setting('cash_policy.shop')::uuid,true);
   raise exception 'other tenant changed policy';
 exception when insufficient_privilege then null; end;
 begin
   perform public.shop_cash_policy(current_setting('cash_policy.shop')::uuid);
   raise exception 'other tenant read policy';
 exception when insufficient_privilege then null; end;
 if exists(select 1 from public.shop_cash_policy_changes where shop_id=current_setting('cash_policy.shop')::uuid) then raise exception 'other tenant read audit'; end if;
end;
$$;
reset role;
-- Create an active member without settings permission, then delegate the
-- existing manager role. Fixture administration never represents a browser write.
insert into public.profiles (user_id,portal_id,display_name,email_snapshot)
select fixture.other_id,shop.portal_id,'Policy member','cash-policy-other@example.invalid'
from cash_policy_fixture fixture join public.shops shop on shop.id=current_setting('cash_policy.shop')::uuid;
insert into public.shop_memberships (shop_id,profile_id,role,status)
select current_setting('cash_policy.shop')::uuid,profile.id,'employee','active'
from public.profiles profile join cash_policy_fixture fixture on fixture.other_id=profile.user_id;
insert into public.membership_roles (membership_id,role_id)
select membership.id,role.id from public.shop_memberships membership
join public.profiles profile on profile.id=membership.profile_id
join cash_policy_fixture fixture on fixture.other_id=profile.user_id
join public.roles role on role.shop_id=membership.shop_id and role.key='cashier'
where membership.shop_id=current_setting('cash_policy.shop')::uuid;
set local role authenticated;
do $$
begin
 begin
   perform public.set_shop_cash_policy(current_setting('cash_policy.shop')::uuid,true);
   raise exception 'cashier changed policy';
 exception when insufficient_privilege then null; end;
 if exists(select 1 from public.shop_cash_policy_changes where shop_id=current_setting('cash_policy.shop')::uuid) then
   raise exception 'cashier read settings audit';
 end if;
end;
$$;
reset role;
update public.membership_roles assignment set role_id=role.id
from public.roles role,public.shop_memberships membership,public.profiles profile,cash_policy_fixture fixture
where assignment.membership_id=membership.id and membership.profile_id=profile.id
 and profile.user_id=fixture.other_id and membership.shop_id=current_setting('cash_policy.shop')::uuid
 and role.shop_id=membership.shop_id and role.key='manager';
set local role authenticated;
select public.set_shop_cash_policy(current_setting('cash_policy.shop')::uuid,true);
select public.set_shop_cash_policy(current_setting('cash_policy.shop')::uuid,true);
reset role;
do $$
begin
 if (select count(*) from public.shop_cash_policy_changes change
   join public.profiles profile on profile.id=change.changed_by_profile_id
   join cash_policy_fixture fixture on fixture.other_id=profile.user_id
   where change.shop_id=current_setting('cash_policy.shop')::uuid) <> 1 then
   raise exception 'delegated manager change/retry audit incorrect';
 end if;
end;
$$;
update public.shop_memberships membership set status='suspended'
from public.profiles profile,cash_policy_fixture fixture
where membership.profile_id=profile.id and profile.user_id=fixture.other_id
 and membership.shop_id=current_setting('cash_policy.shop')::uuid;
set local role authenticated;
do $$
begin
 begin
   perform public.set_shop_cash_policy(current_setting('cash_policy.shop')::uuid,false);
   raise exception 'suspended manager changed policy';
 exception when insufficient_privilege then null; end;
end;
$$;
reset role;
select pass('Cash policy command matrix, authorization, compatibility, audit and drawer invariants');
select * from finish();
rollback;
