// CI-only PostgreSQL upgrade acceptance, called before the annual-price migration.
// Reuse the established financial fixture against the OLD schema, then compare
// complete rows across the forward migration inside one rolled-back transaction.
export function verifyAnnualPricingUpgrade(sql, migration, legacyFixture) {
 const tables = [
  'public.doctor_introductory_plans','public.doctor_manual_plan_bindings',
  'public.doctor_saas_terms_versions','public.doctor_saas_terms_documents',
  'public.doctor_saas_configuration','public.doctor_saas_configuration_events',
  'public.doctor_saas_quotes','public.doctor_saas_payment_intents',
  'public.doctor_saas_accounts','public.doctor_saas_periods','public.doctor_saas_period_events',
  'public.doctor_manual_payment_requests','public.doctor_manual_payment_notices',
  'public.doctor_manual_received_funds','public.doctor_manual_payment_reviews',
  'public.doctor_manual_payment_evidence','public.doctor_manual_payment_evidence_events',
  'public.doctor_saas_synthetic_events','public.doctor_saas_synthetic_deliveries',
  'public.doctor_manual_payment_recipients','public.doctor_manual_payment_configuration',
  'public.doctor_manual_payment_configuration_events','public.doctor_manual_payment_reviewers',
  'public.doctor_manual_payment_reviewer_events','public.audit_events','public.doctor_administration_audit',
  'doctor_private.command_receipts',
 ]
 const snapshot = table => `coalesce((select jsonb_agg(to_jsonb(x)order by to_jsonb(x)::text)from ${table} x),'[]'::jsonb)`
 const fixture = legacyFixture.replace("'synthetic-manual',1,'approved'", "'starter',1,'approved'").replace('select * from finish();rollback;', '')
 if (fixture === legacyFixture || /rollback;\s*$/i.test(fixture)) throw new Error('Legacy pricing fixture boundary changed')
 const before = tables.map(table => `insert into price_upgrade_before values('${table}',${snapshot(table)});`).join('\n')
 const after = tables.map(table => `select is(${snapshot(table)},(select value from price_upgrade_before where name='${table}'),'annual upgrade preserves every ${table} row');`).join('\n')
 const result = sql(`${fixture}
 create temporary table price_upgrade_before(name text primary key,value jsonb);
 ${before}
 select ok(exists(select 1 from public.doctor_manual_payment_notices where status='submitted'),'upgrade fixture contains a pending notice');
 select ok(exists(select 1 from public.doctor_saas_periods where kind='manual_paid'),'upgrade fixture contains paid history');
 select ok(exists(select 1 from public.doctor_saas_quotes where billing_interval='yearly'and amount_minor=299000),'upgrade fixture contains the issued original annual price');
 ${migration}
 ${after}
 select is(public.doctor_saas_plan_catalog()#>>'{plans,0,yearly_minor}','243984','new catalogue changes only future offer price');
 select ok(doctor_private.saas_offer_selected(pg_temp.id(51),2),'original issued offer selection remains valid');
 select ok(not doctor_private.saas_new_quote_offer_selected(pg_temp.id(51),2),'new quote selection rejects superseded launch price');
 set local role authenticated;select pg_temp.claim(1);
 select is(public.doctor_create_saas_quote(pg_temp.id(51),2,0,'monthly','synthetic-manual/v1',pg_temp.id(61)),(select value from results where name='quote-a'),'issued quote retry returns the exact old receipt');
 select throws_ok($$select public.doctor_create_saas_quote(pg_temp.id(51),2,1,'yearly','synthetic-manual/v1',pg_temp.id(119))$$,'40001','DOCTOR_SAAS_TERMS_CONFLICT','fresh quote cannot use superseded launch terms');
 reset role;
 select * from finish();rollback;`)
 const plan=result.match(/^1\.\.(\d+)$/m),passed=result.match(/^ok \d+\b/gm)??[]
 if(!plan||Number(plan[1])!==passed.length||/^not ok\b|^Bail out!/m.test(result))throw new Error(`Annual price upgrade assertions failed\n${result}`)
 console.log(`Annual catalogue upgrade: ${passed.length} assertions passed, including complete immutable financial row snapshots`)
}
