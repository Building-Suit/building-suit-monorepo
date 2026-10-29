create temporary table order_funding_actors as select gen_random_uuid() owner,gen_random_uuid() outsider;
grant select on order_funding_actors to authenticated;
insert into auth.users(id,email,encrypted_password,aud,role,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select id,id::text||'@order-funding.invalid','x','authenticated','authenticated',now(),'{}','{}',now(),now() from(select owner id from order_funding_actors union all select outsider from order_funding_actors)a;
select set_config('request.jwt.claim.sub',owner::text,true),set_config('request.jwt.claim.role','authenticated',true) from order_funding_actors;
set local role authenticated;
do $$declare shop uuid;location uuid;customer uuid;product uuid;quote jsonb;order_id uuid;allocation uuid;request_id uuid:=gen_random_uuid();at_time timestamptz:=clock_timestamp();shift uuid;cash_allocation uuid;cash_order uuid;cash_line uuid;cash_request uuid;cash_time timestamptz;r jsonb;again jsonb;context jsonb;statement jsonb;begin
 shop:=public.create_owner_shop('Order funding merchant','multi','mixed');
 select id into location from public.shop_locations where shop_id=shop and is_default;
 customer:=public.save_customer(shop,null,'Deposit contractor',null,null,null,null);
 product:=public.save_product(shop,null,'Funded measured cable','FUND-CABLE',null,35);
 perform public.configure_product_measurement(shop,product,'m','0.001','["m"]','Funding agreement unit');
 perform public.adjust_stock(gen_random_uuid(),shop,product,200,20,'Funding opening stock');
 quote:=public.trade_quotation_command(gen_random_uuid(),shop,location,'save',null,0,jsonb_build_object('customerId',customer,'validUntil',at_time+interval '7 days','orderDiscount','0','lines',jsonb_build_array(jsonb_build_object('item_type','product','source_id',product,'quantity','100','unit_code','m','measurement_revision',1))),'Funding offer fixture');
 perform public.trade_quotation_command(gen_random_uuid(),shop,location,'issue',(quote->>'id')::uuid,1,'{}','Issue funding offer');
 perform public.trade_quotation_command(gen_random_uuid(),shop,location,'accept',(quote->>'id')::uuid,2,'{}','Accept funding offer');
 r:=public.create_trade_order(gen_random_uuid(),shop,location,(quote->>'id')::uuid,3,'Create deposit agreement');order_id:=(r->>'id')::uuid;
 r:=public.trade_order_deposit(request_id,shop,location,order_id,1,'receive','1000',at_time,'bank_transfer',null,null,'BANK-DEP-1','Receive contractor advance');allocation:=(r->>'resultId')::uuid;
 again:=public.trade_order_deposit(request_id,shop,location,order_id,1,'receive','1000',at_time,'bank_transfer',null,null,'BANK-DEP-1','Receive contractor advance');
 if again<>r then raise exception 'Deposit retry changed result';end if;
 context:=public.trade_order_funding_context(shop,location,order_id);
 if context->>'unapplied'<>'1000' or context->>'depositsNet'<>'1000' or context->>'depositCapacity'<>'2500' or (context->>'total')::integer<>1 or context#>>'{items,0,available}'<>'1000' then raise exception 'Advance ledger/read mismatch: %',context;end if;
 if exists(select 1 from public.invoices where shop_id=shop) or (select count(*) from public.payments where shop_id=shop)<>1
 or (select sum(remaining_quantity) from public.inventory_batches where product_id=product)<>200 then raise exception 'Deposit issued invoice or moved stock';end if;
 statement:=public.customer_statement(shop,customer);
 if (statement#>>'{items,0,credit}')::numeric<>1000 or (statement#>>'{items,0,running_balance}')::numeric<>-1000 then raise exception 'Advance absent from existing customer statement: %',statement;end if;
 begin perform public.trade_order_deposit(request_id,shop,location,order_id,1,'receive','1001',at_time,'bank_transfer',null,null,'BANK-DEP-1','Receive contractor advance');raise exception 'Conflicting deposit retry accepted';exception when unique_violation then if sqlerrm<>'ORDER_REQUEST_CONFLICT' then raise;end if;end;
 begin perform public.trade_order_deposit(gen_random_uuid(),shop,location,order_id,2,'receive','2600',at_time,'bank_transfer',null,null,null,'Attempt excess advance');raise exception 'Over-funded agreement accepted';exception when check_violation then if sqlerrm<>'ORDER_DEPOSIT_EXCEEDS_AGREEMENT' then raise;end if;end;
 begin perform public.trade_order_deposit(gen_random_uuid(),shop,location,order_id,2,'receive','1.001',at_time,'bank_transfer',null,null,null,'Attempt excessive money precision');raise exception 'Three-place deposit accepted';exception when invalid_parameter_value then null;end;
 r:=public.trade_order_deposit(gen_random_uuid(),shop,location,order_id,2,'refund','200',at_time+interval '1 second','bank_transfer',allocation,null,'BANK-REF-1','Refund unapplied advance');
 if (r->>'revision')::integer<>3 then raise exception 'Refund revision missing';end if;
 context:=public.trade_order_funding_context(shop,location,order_id);
 if context->>'unapplied'<>'800' or context->>'depositsNet'<>'800' or context->>'depositCapacity'<>'2700' or (context->>'historyTotal')::integer<>1 then raise exception 'Advance refund did not reconcile: %',context;end if;
 perform public.trade_order_deposit(gen_random_uuid(),shop,location,order_id,3,'reverse','100',at_time+interval '2 seconds',null,allocation,null,'DEP-CORRECT-1','Correct mistaken advance amount');
 context:=public.trade_order_funding_context(shop,location,order_id);
 if context->>'unapplied'<>'700' or context->>'depositsNet'<>'700' or (context->>'historyTotal')::integer<>2 then raise exception 'Advance reversal did not reconcile: %',context;end if;
 begin perform public.trade_order_deposit(gen_random_uuid(),shop,location,order_id,4,'apply','100',at_time,null,allocation,gen_random_uuid(),null,'Attempt unrelated invoice allocation');raise exception 'Advance applied outside delivery';exception when check_violation then if sqlerrm<>'ADVANCE_INVOICE_NOT_ELIGIBLE' then raise;end if;end;
 perform public.reserve_trade_order(gen_random_uuid(),shop,location,order_id,4,'cancel','[]',null,'Contractor cancels before collection');
 begin perform public.trade_order_deposit(gen_random_uuid(),shop,location,order_id,5,'receive','100',at_time,'bank_transfer',null,null,null,'Attempt cancelled order advance');raise exception 'Cancelled agreement took deposit';exception when sqlstate '55000' then if sqlerrm<>'ORDER_DEPOSIT_STATE_DENIED' then raise;end if;end;
 -- Cancellation does not erase a receipt: refund the remaining advance through
 -- the same immutable payment/adjustment history, including after cancellation.
 perform public.trade_order_deposit(gen_random_uuid(),shop,location,order_id,5,'refund','700',at_time+interval '3 seconds','bank_transfer',allocation,null,'BANK-REF-FINAL','Refund cancelled collection advance');
 context:=public.trade_order_funding_context(shop,location,order_id);
 if context->>'unapplied'<>'0' or context->>'depositsNet'<>'0' or (select count(*) from public.payments where shop_id=shop)<>3 then raise exception 'Cancelled deposit refund duplicated or lost funds';end if;
 if (select amount from public.customer_payment_allocations where id=allocation)<>1000 or (select amount from public.payments where id=(r->>'paymentId')::uuid)<>1000 then raise exception 'Advance original history mutated';end if;
 if has_function_privilege('authenticated','shop_private.order_deposit_capacity(uuid)','execute') or has_table_privilege('authenticated','public.customer_payment_allocations','insert') then raise exception 'Private advance writes exposed';end if;
 -- Cash advances participate in the existing drawer exactly once. Allocation
 -- to a later delivery creates no second cash event; refunds remain cash out.
 quote:=public.trade_quotation_command(gen_random_uuid(),shop,location,'save',null,0,jsonb_build_object('customerId',customer,'validUntil',clock_timestamp()+interval '7 days','orderDiscount','0','lines',jsonb_build_array(jsonb_build_object('item_type','product','source_id',product,'quantity','10','unit_code','m','measurement_revision',1))),'Cash collection offer');
 perform public.trade_quotation_command(gen_random_uuid(),shop,location,'issue',(quote->>'id')::uuid,1,'{}','Issue cash collection offer');
 perform public.trade_quotation_command(gen_random_uuid(),shop,location,'accept',(quote->>'id')::uuid,2,'{}','Accept cash collection offer');
 r:=public.create_trade_order(gen_random_uuid(),shop,location,(quote->>'id')::uuid,3,'Create cash collection agreement');cash_order:=(r->>'id')::uuid;
 cash_line:=(public.trade_order_context(shop,location,cash_order)#>>'{detail,lines,0,id}')::uuid;
 perform public.set_shop_cash_policy(shop,true);
 begin perform public.trade_order_deposit(gen_random_uuid(),shop,location,cash_order,1,'receive','100',clock_timestamp(),'cash',null,null,null,'Cash without required shift');raise exception 'Deposit bypassed required drawer';exception when check_violation then if sqlerrm<>'SALE_OPEN_CASH_SHIFT_REQUIRED' then raise;end if;end;
 shift:=public.open_cash_shift(gen_random_uuid(),shop,location,'main',50,'Cash advance opening float');cash_request:=gen_random_uuid();cash_time:=clock_timestamp();
 r:=public.trade_order_deposit(cash_request,shop,location,cash_order,1,'receive','100',cash_time,'cash',null,null,'CASH-ADVANCE','Cash advance in drawer');cash_allocation:=(r->>'resultId')::uuid;
 perform public.trade_order_deposit(cash_request,shop,location,cash_order,1,'receive','100',cash_time,'cash',null,null,'CASH-ADVANCE','Cash advance in drawer');
 perform public.reserve_trade_order(gen_random_uuid(),shop,location,cash_order,2,'reserve',jsonb_build_array(jsonb_build_object('lineId',cash_line,'quantity','10')),clock_timestamp()+interval '1 day','Hold cash collection goods');
 perform public.fulfill_trade_order(gen_random_uuid(),shop,location,cash_order,3,jsonb_build_array(jsonb_build_object('lineId',cash_line,'quantity','2')),true,'Collect two prepaid meters');
 perform public.trade_order_deposit(gen_random_uuid(),shop,location,cash_order,4,'refund','20',clock_timestamp(),'cash',cash_allocation,null,'CASH-REFUND','Refund unused cash advance');
 context:=public.cash_shift_dashboard(shop,location);
 if jsonb_array_length(context#>'{active,events}')<>2 or (context#>>'{active,cashSales}')::numeric<>100 or (context#>>'{active,cashRefunds}')::numeric<>20
 or (context#>>'{active,expectedCash}')::numeric<>130 then raise exception 'Cash advance allocation duplicated drawer income or lost refund: %',context;end if;
 perform public.close_cash_shift(gen_random_uuid(),shop,shift,130,'Cash advance drawer reconciled');
 if (select expected_amount from public.cash_sessions where id=shift)<>130 or (select variance_amount from public.cash_sessions where id=shift)<>0 then raise exception 'Cash advance drawer reconciliation mismatch';end if;
 perform set_config('request.jwt.claim.sub',(select outsider::text from order_funding_actors),true);
 begin perform public.trade_order_funding_context(shop,location,order_id);raise exception 'Outsider read deposits';exception when insufficient_privilege then null;end;
 begin perform public.trade_order_deposit(gen_random_uuid(),shop,location,order_id,6,'refund','1',at_time,'bank_transfer',allocation,null,null,'Outsider refund');raise exception 'Outsider refunded deposit';exception when insufficient_privilege then null;end;
end;$$;
reset role;
set constraints all immediate;
