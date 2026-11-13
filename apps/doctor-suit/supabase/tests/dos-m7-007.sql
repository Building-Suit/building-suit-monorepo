-- C01 source authorization/unknown-state evidence. Owned synthetic runner only.
-- No schema changes, telemetry sink, incident authority or real delivery.
begin;
\ir fixtures/clinical.sql

select lives_ok($$select public.doctor_contact_command(pg_temp.practice(),pg_temp.location(),pg_temp.patient(),pg_temp.id(17700),0,'create_contact','{"channel":"sms","destination":"+15550007707","recipient_kind":"patient","guardian_id":null}',pg_temp.id(17701))$$,'C01 synthetic contact fixture');
select lives_ok($$select public.doctor_contact_command(pg_temp.practice(),pg_temp.location(),pg_temp.patient(),pg_temp.id(17702),0,'grant_consent',jsonb_build_object('contact_id',pg_temp.id(17700),'contact_version',1,'purpose','appointment_reminder','source_ref','Synthetic C01 consent','source_day',(clock_timestamp()at time zone'Etc/UTC'-interval'1 minute')::date,'source_minute',extract(hour from clock_timestamp()at time zone'Etc/UTC'-interval'1 minute')::integer*60+extract(minute from clock_timestamp()at time zone'Etc/UTC'-interval'1 minute')::integer,'location_version',1),pg_temp.id(17703))$$,'C01 independent synthetic reminder consent');
create function pg_temp.signal_outbox(action text,version integer,k integer,input jsonb default '{}')returns jsonb language sql as $$select public.doctor_outbox_command(pg_temp.practice(),pg_temp.location(),pg_temp.patient(),pg_temp.id(17704),version,action,input,pg_temp.id(k))$$;
select lives_ok($$select pg_temp.signal_outbox('enqueue',0,17705,jsonb_build_object('intent',jsonb_build_object('contact_id',pg_temp.id(17700),'contact_version',1,'purpose','appointment_reminder','consent_version',1,'guardian_version',null),'expires_at',clock_timestamp()+interval'1 day','template','appointment_reminder_v1','parameters','{}'::jsonb))$$,'C01 queued reminder is not delivery');
select lives_ok($$select pg_temp.put('signal_claim',pg_temp.signal_outbox('claim',1,17706))$$,'C01 owned synthetic claim');
select is(pg_temp.signal_outbox('timeout',2,17707,jsonb_build_object('claim_token',pg_temp.v('signal_claim')->>'claim_token'))->>'state','unknown','C01 timeout remains unknown');
select lives_ok($$select pg_temp.put('signal_outbox_read',public.doctor_outbox(pg_temp.practice(),pg_temp.location(),pg_temp.patient(),0))$$,'C01 authorized current read source');
select is(pg_temp.v('signal_outbox_read')#>>'{rows,0,state}','unknown','C01 read preserves unknown rather than sent/delivered');
select is(pg_temp.v('signal_outbox_read')->>'external_delivery','false','C01 no external delivery claim');
select is(pg_temp.v('signal_outbox_read')->>'data_mode','synthetic','C01 synthetic-only source');
select ok(pg_temp.v('signal_outbox_read')::text not like '%15550007707%'and pg_temp.v('signal_outbox_read')::text not like '%claim_token%'and pg_temp.v('signal_outbox_read')::text not like '%receipt%','C01 source excludes destination and transport capabilities');
select throws_ok($$select pg_temp.signal_outbox('claim',3,17708)$$,'40001','DOCTOR_OUTBOX_CONFLICT','C01 observing unknown cannot authorize resend');
select throws_ok($$select * from public.message_outbox$$,'42501',null,'C01 no direct outbox inspection privilege');
select pg_temp.claim(2);
select throws_ok($$select public.doctor_outbox(pg_temp.practice(),pg_temp.location(),pg_temp.patient(),0)$$,'42501','DOCTOR_ACCESS_DENIED','C01 cross-doctor read denied before observation');
select pg_temp.claim(1);
select ok((public.doctor_patient_profile(pg_temp.practice(),pg_temp.location(),pg_temp.patient())->>'documents_read')::boolean,'C01 existing owner document read authority');
select pg_temp.claim(3);
select is(public.doctor_patient_profile(pg_temp.practice(),pg_temp.location(),pg_temp.patient())->>'documents_read','false','C01 patients-only grant cannot authorize storage delivery');

-- Exercise the existing subscriber-only reconciliation signal source with
-- actual persisted synthetic unknown and discrepancy evidence. These fixture
-- terms/approvals are rolled back; they are not commercial/legal decisions.
reset role;
insert into public.doctor_saas_terms_versions(id,plan_key,version,status,currency,currency_exponent,monthly_minor,trial_days,staff_limit,staff_unlimited,clinic_limit,clinic_unlimited,over_limit_policy,renewal_policy,grace_days,expiry_policy,cancellation_policy,refund_policy,terms_document_ref,commercial_approval_ref,legal_approval_ref)values
 (pg_temp.id(17800),'synthetic-c01-signals',1,'approved','USD',2,1234,0,1,false,1,false,'block_new_allocation','manual',0,'historical_read_only','period_end','manual_review','synthetic-c01-signals/v1','SYNTHETIC_COMMERCIAL','SYNTHETIC_LEGAL');
insert into public.doctor_saas_terms_documents(terms_version_id,document_ref,content_en,content_ar)values(pg_temp.id(17800),'synthetic-c01-signals/v1','Synthetic signal fixture only; not legal approval.','وثيقة اختبار اصطناعية فقط دون موافقة قانونية.');
update public.doctor_saas_configuration set terms_version_id=pg_temp.id(17800),revision=revision+1,change_reason='Owned C01 synthetic signals';
create temporary table signal_payments(n integer primary key,quote jsonb,intent jsonb);grant all on signal_payments to authenticated;
select pg_temp.put('signal_configuration_revision',to_jsonb(revision))from public.doctor_saas_configuration;
set local role authenticated;select pg_temp.claim(1);
insert into signal_payments(n,quote)select n,public.doctor_create_saas_quote(pg_temp.id(17800),(pg_temp.v('signal_configuration_revision')#>>'{}')::integer,0,'monthly','synthetic-c01-signals/v1',pg_temp.id(17810+n))from generate_series(1,2)n;
update signal_payments set intent=public.doctor_prepare_saas_payment((quote->>'quote_id')::uuid,pg_temp.id(17820+n));
select pg_temp.claim(2);
insert into signal_payments(n,quote)values(3,public.doctor_create_saas_quote(pg_temp.id(17800),(pg_temp.v('signal_configuration_revision')#>>'{}')::integer,0,'monthly','synthetic-c01-signals/v1',pg_temp.id(17813)));
update signal_payments set intent=public.doctor_prepare_saas_payment((quote->>'quote_id')::uuid,pg_temp.id(17823))where n=3;
reset role;
select lives_ok($$select doctor_private.record_saas_synthetic_evidence((select intent->>'intent_id'from signal_payments where n=1)::uuid,'synthetic-fixture/c01-unknown',1,'unknown',pg_temp.id(1),1234,'USD',pg_temp.id(17831))$$,'C01 persisted uncertain SaaS outcome');
select lives_ok($$select doctor_private.record_saas_synthetic_evidence((select intent->>'intent_id'from signal_payments where n=2)::uuid,'synthetic-fixture/c01-discrepancy',1,'confirmed',pg_temp.id(2),1,'USD',pg_temp.id(17832))$$,'C01 persisted discrepancy does not settle access');
select lives_ok($$select doctor_private.record_saas_synthetic_evidence((select intent->>'intent_id'from signal_payments where n=3)::uuid,'synthetic-fixture/c01-other',1,'unknown',pg_temp.id(2),1234,'USD',pg_temp.id(17833))$$,'C01 independent second subscriber');
set local role authenticated;select pg_temp.claim(1);
select is(public.doctor_operations_status()#>>'{reconciliation,unknown_review}','1','C01 only own uncertain reconciliation is counted');
select is(public.doctor_operations_status()#>>'{reconciliation,discrepancy_review}','1','C01 only own discrepancy is counted');
select is(public.doctor_operations_status()->>'paid_activation_available','false','C01 diagnostics never activate paid access');
select is(public.doctor_operations_status()->>'hosted_telemetry_available','false','C01 default hosted telemetry remains disabled');
select is(public.doctor_operations_status()#>'{recovery,rpo}','null'::jsonb,'C01 no invented recovery point objective');
select is(public.doctor_operations_status()#>'{recovery,rto}','null'::jsonb,'C01 no invented recovery time objective');
select is(public.doctor_operations_status()#>>'{recovery,whole_provider_qualified}','false','C01 synthetic restore is not hosted qualification');
select ok(not(public.doctor_operations_status()?'patient_id')and not(public.doctor_operations_status()?'payload')and not(public.doctor_operations_status()?'endpoint'),'C01 reconciliation source excludes clinical payload/destination');
select pg_temp.claim(2);
select is(public.doctor_operations_status()#>>'{reconciliation,discrepancy_review}','0','C01 second subscriber cannot inherit first subscriber mismatch');
select pg_temp.claim(3);
select throws_ok($$select public.doctor_operations_status()$$,'42501','DOCTOR_OWNER_ENROLLMENT_REQUIRED','C01 delegated clinic grant is not subscriber diagnostics authority');
reset role;
select ok(not has_function_privilege('anon','public.doctor_operations_status()','execute'),'C01 anonymous diagnostics denied');
select ok(not has_function_privilege('service_role','public.doctor_operations_status()','execute'),'C01 ambient service diagnostics denied');
delete from auth.sessions where id=pg_temp.id(11);
set local role authenticated;select pg_temp.claim(1);
select throws_ok($$select public.doctor_operations_status()$$,'42501','DOCTOR_AUTH_REQUIRED','C01 expired SID cannot produce new own-account observations');
reset role;
select * from finish();rollback;
