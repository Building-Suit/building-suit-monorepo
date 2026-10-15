-- Runs after shop_eta_submission.sql in the same disposable transaction.
select set_config('request.jwt.claim.sub',owner::text,true) from eta_fixture;
select set_config('shop.location_id',current_setting('eta_test.location'),true);
set local role authenticated;
do $$
declare shop uuid:=current_setting('eta_test.shop')::uuid; config jsonb; product uuid; customer uuid; sale uuid; request uuid:=gen_random_uuid(); job uuid; receiver jsonb;
begin
 config:=public.eta_settings(shop)->'configuration';
 config:=jsonb_set(config,'{branches,0,deviceSerialNumber}','""');
 perform public.save_eta_configuration(gen_random_uuid(),shop,config,'B2B setup without a POS');
 product:=(config->'items'->0->>'sourceId')::uuid;
 select id into customer from public.clients where shop_id=shop limit 1;
 receiver:=jsonb_build_object('type','B','id','987654321','name','Synthetic business receiver','address',jsonb_build_object('country','EG','governate','Cairo','regionCity','Cairo','street','Test','buildingNumber','2'));
 sale:=public.save_sale_draft(gen_random_uuid(),shop,null,customer,null,jsonb_build_array(jsonb_build_object('item_type','product','source_id',product,'quantity',1)));
 perform public.issue_sale(gen_random_uuid(),shop,sale);
 job:=public.queue_eta_invoice(request,shop,sale,receiver,'Confirmed business identity');
 if public.queue_eta_invoice(request,shop,sale,receiver,'Confirmed business identity')<>job then raise exception 'Invoice replay duplicated';end if;
 begin perform public.queue_eta_invoice(request,shop,sale,jsonb_set(receiver,'{name}','"Changed receiver"'),'Confirmed business identity');raise exception 'Invoice replay changed identity';exception when unique_violation then null;end;
 begin perform public.queue_eta_receipt(gen_random_uuid(),shop,sale,'{"type":"P"}','C');raise exception 'Same sale exported in both channels';exception when unique_violation then null;end;
 perform set_config('eta_invoice.job',job::text,true);perform set_config('eta_invoice.sale',sale::text,true);
 -- A B2B-only branch must not invent a POS for receipt export.
 sale:=public.save_sale_draft(gen_random_uuid(),shop,null,customer,null,jsonb_build_array(jsonb_build_object('item_type','product','source_id',product,'quantity',1)));
 perform public.issue_sale(gen_random_uuid(),shop,sale);
 begin perform public.queue_eta_receipt(gen_random_uuid(),shop,sale,'{"type":"P"}','C');raise exception 'Missing receipt POS accepted';exception when invalid_parameter_value then if sqlerrm<>'ETA_RECEIPT_POS_REQUIRED' then raise;end if;end;
end; $$;
reset role;
do $$
declare job jsonb; payload text; body jsonb; id uuid:=current_setting('eta_invoice.job')::uuid; lease uuid; before jsonb;
begin
 if has_function_privilege('authenticated','public.shop_eta_invoice_claim()','EXECUTE') or has_function_privilege('authenticated','public.shop_eta_invoice_prepare(uuid,uuid,text,text)','EXECUTE') then raise exception 'Invoice worker RPC leaked';end if;
 if public.shop_eta_claim() is not null then raise exception 'Receipt worker claimed an invoice';end if;
 job:=public.shop_eta_invoice_claim();lease:=(job->>'lease_id')::uuid;
 if job->>'id'<>id::text or job->>'channel'<>'einvoice' or job->>'device_serial' is not null then raise exception 'Invoice channel/POS isolation failed';end if;
 if public.shop_eta_invoice_claim() is not null then raise exception 'Invoice leased twice';end if;
 body:=jsonb_build_object('issuer',jsonb_build_object('id',job->'source'->'profile'->>'rin'),'receiver',job->'source'->'receiver','documentType','i','documentTypeVersion','1.0','internalId',job->'source'->>'receiptNumber','totalAmount',job->'source'->'tax'->'total5','signatures',jsonb_build_array(jsonb_build_object('signatureType','I','value','synthetic-state-fixture-only')));
 payload:=jsonb_build_object('documents',jsonb_build_array(body))::text;
 begin perform public.shop_eta_invoice_prepare(id,gen_random_uuid(),payload,repeat('a',64));raise exception 'Wrong invoice lease accepted';exception when object_not_in_prerequisite_state then null;end;
 perform public.shop_eta_invoice_prepare(id,lease,payload,repeat('a',64));
 if (select payload_hash from public.eta_outbox where eta_outbox.id=id) is null then raise exception 'Signed wire hash missing';end if;
 begin update public.eta_outbox set payload='{}' where eta_outbox.id=id;raise exception 'Signed body mutable';exception when object_not_in_prerequisite_state then null;end;
 perform public.shop_eta_transition(id,lease,'submitting');
 perform public.shop_eta_invoice_acknowledge(id,lease,'INVOICE-SUBMISSION-1','INVOICE-PROVIDER-ID-1');
 if (select state from public.eta_outbox where eta_outbox.id=id)<>'submitted' then raise exception '202 invoice state lost';end if;
 update public.eta_outbox set next_attempt_at=now()-interval '1 second' where eta_outbox.id=id;
 job:=public.shop_eta_invoice_claim();lease:=(job->>'lease_id')::uuid;
 if job->>'state'<>'submitted' or job->>'document_uuid'<>'INVOICE-PROVIDER-ID-1' then raise exception 'Provider assigned document mapping lost';end if;
 begin perform public.shop_eta_transition(id,lease,'submitting');raise exception 'Accepted invoice allowed another POST';exception when object_not_in_prerequisite_state then null;end;
 perform public.shop_eta_transition(id,lease,'valid','INVOICE-SUBMISSION-1');
 begin update public.eta_outbox set document_uuid='DIFFERENT' where eta_outbox.id=id;raise exception 'Provider document ID mutable';exception when object_not_in_prerequisite_state then null;end;
end; $$;
select set_config('request.jwt.claim.sub',owner::text,true) from eta_fixture;
set local role authenticated;
do $$
declare reference jsonb;
begin
 reference:=public.eta_original_document_reference(current_setting('eta_test.shop')::uuid,current_setting('eta_invoice.sale')::uuid);
 if reference->>'channel'<>'einvoice' or reference->>'documentUUID'<>'INVOICE-PROVIDER-ID-1' or reference->>'status'<>'valid' or reference->>'snapshotId'<>current_setting('eta_invoice.sale') then raise exception 'Original B2B reference contract failed';end if;
end; $$;
reset role;
select set_config('request.jwt.claim.sub',outsider::text,true) from eta_fixture;
set local role authenticated;
do $$ begin
 begin perform public.queue_eta_invoice(gen_random_uuid(),current_setting('eta_test.shop')::uuid,current_setting('eta_test.branch_b_sale')::uuid,'{"type":"B","id":"987654321","name":"Test","address":{"country":"EG","governate":"Cairo","regionCity":"Cairo","street":"Test","buildingNumber":"1"}}','Wrong location test');raise exception 'Scoped manager queued invoice in other location';exception when insufficient_privilege then null;end;
 begin perform public.eta_original_document_reference(current_setting('eta_test.shop')::uuid,current_setting('eta_test.branch_b_sale')::uuid);raise exception 'Scoped user read other location original';exception when insufficient_privilege then null;end;
end; $$;
reset role;
