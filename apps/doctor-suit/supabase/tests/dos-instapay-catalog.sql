begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
set local role authenticated;
select is(public.doctor_saas_plan_catalog()->>'publication_state','approved_prices','owner-authorized prices do not imply configured payment acceptance');
select is(public.doctor_saas_plan_catalog()->>'version','2','new catalogue version is explicit');
select is(public.doctor_saas_plan_catalog()->>'annual_discount_percent','32','annual discount is exactly thirty-two percent');
select is(public.doctor_saas_plan_catalog()->>'currency','EGP','public introductory currency is explicit');
select is(public.doctor_saas_plan_catalog()->>'self_service_setup_fee_minor','0','self-service has no setup fee');
select is(public.doctor_saas_plan_catalog()->>'tax_status','not_determined','no fabricated tax status');
select is(public.doctor_saas_plan_catalog()->>'live_acceptance_enabled','false','pricing does not enable live acceptance');
select is(jsonb_array_length(public.doctor_saas_plan_catalog()->'plans'),3,'all three introductory plans visible');
select is(public.doctor_saas_plan_catalog()#>>'{plans,0,monthly_minor}','29900','Starter quote-facing amount exact');
select is(public.doctor_saas_plan_catalog()#>>'{plans,1,yearly_minor}','488784','Clinic prepaid yearly amount exact');
select is(public.doctor_saas_plan_catalog()#>>'{plans,2,total_named_users}','25','Group includes the owner');
select is(public.doctor_saas_plan_catalog()#>>'{plans,2,staff_limit_excluding_owner}','24','Group server staff quota excludes owner');
select is(public.doctor_saas_plan_catalog()#>>'{plans,0,configured}','false','incomplete lifecycle/legal terms not approved by prices');
select is(public.doctor_saas_plan_catalog()#>'{plans,0,terms}','null'::jsonb,'no guessed trial or legal terms seeded');
reset role;
select is((select count(*)from public.doctor_saas_terms_versions),0::bigint,'commercial catalog does not seed approved subscription terms');
select is((select count(*)from public.doctor_saas_accounts),0::bigint,'pricing creates no entitlements');
select ok(not has_table_privilege(role_name,'public.'||table_name,'select,insert,update,delete,truncate'),'raw '||role_name||' catalog grant denied')
 from unnest(array['anon','authenticated','service_role'])role_name cross join unnest(array['doctor_introductory_plans','doctor_manual_plan_bindings'])table_name;
select is((select yearly_minor from public.doctor_introductory_plans where plan_key='starter'),299000::bigint,'original catalogue retained unchanged');
insert into public.doctor_saas_terms_versions(id,plan_key,version,status,currency,currency_exponent,monthly_minor,yearly_minor,trial_days,staff_limit,staff_unlimited,clinic_limit,clinic_unlimited,over_limit_policy,renewal_policy,grace_days,expiry_policy,cancellation_policy,refund_policy,terms_document_ref,commercial_approval_ref,legal_approval_ref)
 values('ae320000-0000-0000-0000-000000000001','starter',1,'approved','EGP',2,29900,299000,0,4,false,1,false,'block_new_allocation','manual',0,'historical_read_only','period_end','manual_review','synthetic-price-old/v1','SYNTHETIC_ONLY','SYNTHETIC_ONLY'),
 ('ae320000-0000-0000-0000-000000000002','starter',2,'approved','EGP',2,29900,243984,0,4,false,1,false,'block_new_allocation','manual',0,'historical_read_only','period_end','manual_review','synthetic-price-new/v2','SYNTHETIC_ONLY','SYNTHETIC_ONLY');
select throws_ok($$update public.doctor_manual_plan_bindings set enabled=true,terms_version_id='ae320000-0000-0000-0000-000000000001',price_approval_ref='SYNTHETIC_ONLY',revision=revision+1,change_reason='Synthetic superseded price denial'where plan_key='starter'$$,'22023','DOCTOR_MANUAL_PLAN_TERMS_MISMATCH','new binding cannot silently publish old yearly economics');
update public.doctor_manual_plan_bindings set enabled=true,terms_version_id='ae320000-0000-0000-0000-000000000002',price_approval_ref='SYNTHETIC_ONLY',revision=revision+1,change_reason='Synthetic approved exact new price'where plan_key='starter';
set local role authenticated;
select is(public.doctor_saas_plan_catalog()#>>'{plans,0,terms,yearly_minor}','243984','only exact newly approved terms become a configured offer');
select is(public.doctor_saas_plan_catalog()#>>'{plans,0,configured}','true','new annual binding is available in synthetic configuration');
reset role;
select ok(not has_function_privilege(role_name,'doctor_private.saas_new_quote_offer_selected(uuid,integer)','execute'),'private new-quote selector denied for '||role_name)from unnest(array['anon','authenticated','service_role'])role_name;
select ok(not has_table_privilege(role_name,'doctor_private.current_introductory_plans','select'),'private catalogue view denied for '||role_name)from unnest(array['anon','authenticated','service_role'])role_name;
select * from finish();rollback;
