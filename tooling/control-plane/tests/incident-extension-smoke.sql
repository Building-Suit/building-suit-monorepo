\set ON_ERROR_STOP on
BEGIN;
DO $$
DECLARE r uuid; i uuid; token uuid:=gen_random_uuid(); actor uuid:='a0000000-0000-4000-8000-000000000001'; reply jsonb; offer jsonb; n integer; id bigint;
BEGIN
 INSERT INTO control.operator_actors(actor_id,identity_provider) VALUES(actor,'local-n8n');
 INSERT INTO control.workflow_runs(project_id,suit_slug,workstream_slug,status,max_tasks) SELECT project_id,suit_slug,workstream_slug,'running',4 FROM control.tasks WHERE project_id IS NOT NULL AND workstream_slug IS NOT NULL LIMIT 1 RETURNING run_id INTO r;
 INSERT INTO control.dot_incidents(run_id,root_fingerprint,classification,status,evidence) VALUES(r,'synthetic-extension','UNKNOWN','recovering','{}') RETURNING incident_id INTO i;
 INSERT INTO control.dot_recovery_jobs(incident_id,run_id,root_family,owner,action,status,claim_token,claim_until,evidence) VALUES(i,r,'unknown-lifecycle','Codex','incident-investigate','running',token,now()+interval '5 minutes','{}');
 -- Prelaunch setup failures are retained without consuming an invocation.
 FOR n IN 1..4 LOOP
 reply:=control.reserve_dot_model_invocation(i,token,'aborted-'||n,repeat('a',64));
 IF reply->>'allowed'<>'true' THEN RAISE EXCEPTION 'Setup consumed budget';END IF;
 PERFORM control.finish_dot_model_invocation(i,token,'aborted-'||n,repeat('a',64));
 END LOOP;
 FOR n IN 1..2 LOOP
 reply:=control.reserve_dot_model_invocation(i,token,'launched-'||n,repeat('a',64));
 IF reply->>'allowed'<>'true' THEN RAISE EXCEPTION 'Actual call refused early';END IF;
 PERFORM control.record_dot_model_launch(i,token,'launched-'||n,now());
 PERFORM control.finish_dot_model_invocation(i,token,'launched-'||n,repeat('a',64));
 END LOOP;
 reply:=control.reserve_dot_model_invocation(i,token,'fused',repeat('a',64));
 IF reply->>'allowed'<>'false' OR reply->>'no_progress_streak'<>'2' THEN RAISE EXCEPTION 'No-progress fuse absent: %',reply;END IF;
 SELECT value INTO offer FROM jsonb_array_elements(control.operator_gate_offers(r)) WHERE value->>'action'='incident-investigation-extension';
 IF offer IS NULL OR (SELECT jsonb_array_length(control.operator_gate_offers(r)))<>1 THEN RAISE EXCEPTION 'One exact incident offer required';END IF;
 SET LOCAL ROLE bs_control_operator;
 reply:=control.resolve_authenticated_operator_gate(actor,r,offer->>'gate_fingerprint','approve');
 reply:=control.resolve_authenticated_operator_gate(actor,r,offer->>'gate_fingerprint','approve');
 IF reply->>'replayed'<>'true' THEN RAISE EXCEPTION 'Grant replay duplicated';END IF;
 RESET ROLE;
 IF (SELECT count(*) FROM control.operator_invocation_extensions WHERE incident_id=i)<>1 THEN RAISE EXCEPTION 'More than one grant';END IF;
 UPDATE control.dot_recovery_jobs SET status='running',claim_token=token,claim_until=now()+interval '5 minutes' WHERE incident_id=i;
 reply:=control.reserve_dot_model_invocation(i,token,'extra-aborted',repeat('a',64));
 IF reply->>'allowed'<>'true' OR reply->>'operator_grant_id' IS NULL THEN RAISE EXCEPTION 'Extra reservation unavailable';END IF;
 PERFORM control.finish_dot_model_invocation(i,token,'extra-aborted',repeat('a',64));
 IF EXISTS(SELECT 1 FROM control.operator_invocation_extensions WHERE incident_id=i AND consumed_at IS NOT NULL) THEN RAISE EXCEPTION 'Prelaunch failure consumed grant';END IF;
 reply:=control.reserve_dot_model_invocation(i,token,'extra-launched',repeat('a',64));
 PERFORM control.record_dot_model_launch(i,token,'extra-launched',now());
 PERFORM control.finish_dot_model_invocation(i,token,'extra-launched',repeat('a',64));
 IF NOT EXISTS(SELECT 1 FROM control.operator_invocation_extensions WHERE incident_id=i AND consumed_at IS NOT NULL) THEN RAISE EXCEPTION 'Actual launch did not consume grant';END IF;
 reply:=control.reserve_dot_model_invocation(i,token,'extra-replay',repeat('a',64));
 IF reply->>'allowed'<>'false' THEN RAISE EXCEPTION 'Grant permitted multiple calls';END IF;
 IF (SELECT count(*) FROM control.dot_model_invocations WHERE incident_id=i AND launched_at IS NOT NULL)<>3 THEN RAISE EXCEPTION 'Actual model count differs';END IF;
END $$;
ROLLBACK;
