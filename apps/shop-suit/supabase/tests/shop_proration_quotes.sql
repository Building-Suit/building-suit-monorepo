-- This suite verifies calculation/privilege policy only, not fulfillment.
DO $$
declare q jsonb; again jsonb; args record; passed integer:=0;
begin
 for args in select * from (values
 ('monthly upgrade','2026-11-11'::timestamptz,'active','paid','2026-11-01'::timestamptz,'2026-12-01'::timestamptz,'2026-11-01'::timestamptz,34900::numeric,'monthly','monthly',69900::bigint,0::bigint,false,23333::bigint,0::bigint,'remaining_period'),
 ('monthly downgrade','2026-11-11','active','paid','2026-11-01','2026-12-01','2026-11-01',69900,'monthly','monthly',34900,0,false,0,23333,'remaining_period'),
 ('monthly leap February','2024-02-15','active','paid','2024-02-01','2024-03-01','2024-02-01',34900,'monthly','monthly',69900,0,false,18103,0,'remaining_period'),
 ('annual leap year','2024-07-02','active','paid','2024-01-01','2025-01-01','2024-01-01',120000,'annual','annual',240000,0,false,60000,0,'remaining_period'),
 ('annual ordinary year','2025-07-02','active','paid','2025-01-01','2026-01-01','2025-01-01',120000,'annual','annual',240000,0,false,60164,0,'remaining_period'),
 ('monthly to annual','2026-11-11','active','paid','2026-11-01','2026-12-01','2026-11-01',34900,'monthly','annual',570384,0,false,547117,0,'new_interval'),
 ('annual to monthly','2024-07-02','active','paid','2024-01-01','2025-01-01','2024-01-01',120000,'annual','monthly',69900,0,false,9900,0,'new_interval'),
 ('trial no prepaid credit','2026-11-11','trialing','trial','2026-11-01','2026-12-01','2026-11-01',34900,'monthly','monthly',69900,0,true,69900,0,'trial_conversion'),
 ('operator grant no invented money','2026-11-11','active','operator_grant','2026-11-01','2026-12-01','2026-11-01',69900,'monthly','monthly',34900,0,false,23267,0,'remaining_period'),
 ('same active terms preserve balance','2026-11-11','active','paid','2026-11-01','2026-12-01','2026-11-01',34900,'monthly','monthly',34900,12345,true,0,12345,'no_change'),
 ('zero net different terms','2026-11-11','active','paid','2026-11-01','2026-12-01','2026-11-01',34900,'monthly','monthly',34900,0,false,0,0,'remaining_period'),
 ('carryforward netting','2026-11-11','active','paid','2026-11-01','2026-12-01','2026-11-01',34900,'monthly','monthly',69900,30000,false,0,6667,'remaining_period'),
 ('subsequent funding allocation','2026-11-21','active','paid','2026-11-01','2026-12-01','2026-11-11',46600,'monthly','monthly',99900,0,false,10000,0,'remaining_period'),
 ('expired money has no unused credit','2026-12-02','expired','paid','2026-11-01','2026-12-01','2026-11-01',34900,'monthly','monthly',69900,0,false,69900,0,'full_term'),
 ('half cent due rounds up','2026-11-02','active','paid','2026-11-01','2026-11-03','2026-11-01',1,'monthly','monthly',2,0,false,1,0,'remaining_period'),
 ('half cent credit rounds up','2026-11-02','active','paid','2026-11-01','2026-11-03','2026-11-01',2,'monthly','monthly',1,0,false,0,1,'remaining_period')
 ) v(name,as_of,status,source,cycle_start,cycle_end,funding_start,prepaid,old_interval,new_interval,new_minor,balance,same_terms,due,credit,mode)
 loop
 q:=shop_private.proration_quote_v1(args.as_of,args.status,args.source,args.cycle_start,args.cycle_end,args.funding_start,args.prepaid,args.old_interval,args.new_interval,args.new_minor,args.balance,args.same_terms);
 if (q->>'amountDueMinor')::bigint<>args.due or (q->>'creditAfterMinor')::bigint<>args.credit or q->>'mode'<>args.mode then
 raise exception 'Proration case %: %',args.name,q; end if;
 if args.mode='remaining_period' and (q->>'periodEnd')::timestamptz<>args.cycle_end then raise exception 'Renewal moved'; end if;
 if args.mode in ('new_interval','trial_conversion','full_term') and (q->>'periodStartPolicy'<>'verified_settlement' or q->>'periodStart' is not null) then raise exception 'Premature term start'; end if;
 if args.mode<>'no_change' and args.due=0 and q->>'transition'<>'explicit_credit_transition' then raise exception 'Fake zero payment'; end if;
 again:=shop_private.proration_quote_v1(args.as_of,args.status,args.source,args.cycle_start,args.cycle_end,args.funding_start,args.prepaid,args.old_interval,args.new_interval,args.new_minor,args.balance,args.same_terms);
 if q<>again then raise exception 'Quote is not deterministic'; end if;
 passed:=passed+1;
 end loop;
 if passed<>16 then raise exception 'Missing cases'; end if;
 if has_function_privilege('anon','shop_private.proration_quote_v1(timestamptz,text,text,timestamptz,timestamptz,timestamptz,numeric,text,text,bigint,bigint,boolean,text)','EXECUTE')
 or has_function_privilege('authenticated','shop_private.proration_quote_v1(timestamptz,text,text,timestamptz,timestamptz,timestamptz,numeric,text,text,bigint,bigint,boolean,text)','EXECUTE')
 or has_function_privilege('service_role','shop_private.proration_quote_v1(timestamptz,text,text,timestamptz,timestamptz,timestamptz,numeric,text,text,bigint,bigint,boolean,text)','EXECUTE') then raise exception 'Quote primitive exposed'; end if;
end $$;
DO $$
declare patch jsonb; x jsonb; invalid integer:=0;
begin
 for patch in select value from jsonb_array_elements('[
 {"status":"suspended"},{"source":"browser_claim"},{"currency":"EUR"},
 {"prepaid":"NaN"},{"prepaid":"Infinity"},{"prepaid":"-1"},
 {"newMinor":0},{"balance":-1},{"newInterval":"weekly"},
 {"oldInterval":"weekly"},{"asOf":"infinity"},{"cycleStart":"2026-12-05"},
 {"fundingStart":"2026-11-15"},{"fundingStart":"2026-10-01"},
 {"same":true,"newInterval":"annual"},{"cycleStart":null}
 ]'::jsonb)
 loop
 x:=jsonb_build_object('status','active','source','paid','currency','EGP','prepaid','34900','newMinor',69900,'balance',0,'newInterval','monthly','oldInterval','monthly','asOf','2026-11-11','cycleStart','2026-11-01','fundingStart','2026-11-01','same',false)||patch;
 begin
 perform shop_private.proration_quote_v1((x->>'asOf')::timestamptz,x->>'status',x->>'source',(x->>'cycleStart')::timestamptz,'2026-12-01',(x->>'fundingStart')::timestamptz,(x->>'prepaid')::numeric,x->>'oldInterval',x->>'newInterval',(x->>'newMinor')::bigint,(x->>'balance')::bigint,(x->>'same')::boolean,x->>'currency');
 raise exception 'Invalid economic inputs accepted: %',patch;
 exception when sqlstate '22023' then invalid:=invalid+1;
 end;
 end loop;
 if invalid<>16 then raise exception 'Missing invalid cases'; end if;
end $$;
