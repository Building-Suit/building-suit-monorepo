\set ON_ERROR_STOP on
BEGIN;
DO $$
DECLARE r uuid; i uuid; actor uuid:='a0000000-0000-4000-8000-000000000001'; offer jsonb; reply jsonb; grant_id bigint; token uuid; n int; watermark bigint; event_count int; kinds text[]:=ARRAY['operator_gate_resolved','verification_finished','recovery_budget_extended','incident_extension_authorized','failure_classification_required','task_ready','publication_completed'];
BEGIN
 INSERT INTO control.operator_actors(actor_id,identity_provider) VALUES(actor,'local-n8n');
 SET LOCAL session_replication_role=replica;
 INSERT INTO control.workflow_runs(project_id,suit_slug,workstream_slug,status,max_tasks,current_task_id) SELECT project_id,suit_slug,workstream_slug,'running',4,task_id FROM control.tasks WHERE project_id IS NOT NULL AND workstream_slug IS NOT NULL LIMIT 1 RETURNING run_id INTO r;
 SET LOCAL session_replication_role=origin;
 INSERT INTO control.dot_incidents(run_id,task_id,root_fingerprint,classification,status,evidence) SELECT r,current_task_id,'synthetic-lifecycle-wake','UNKNOWN','operator-gate','{}' FROM control.workflow_runs WHERE run_id=r RETURNING incident_id INTO i;
 INSERT INTO control.dot_recovery_jobs(incident_id,run_id,task_id,root_family,owner,action,status,evidence) SELECT i,r,current_task_id,'unknown-lifecycle','Codex','incident-investigate','human-gate','{"gate_kind":"incident-investigation-extension","reason":"incident_investigation_budget_exhausted"}' FROM control.workflow_runs WHERE run_id=r;
 SELECT coalesce(max(event_id),0) INTO watermark FROM control.dot_wake_events;
 SELECT value INTO offer FROM jsonb_array_elements(control.operator_gate_offers(r)) WHERE value->>'action'='incident-investigation-extension';
 SET LOCAL ROLE bs_control_operator;
 reply:=control.resolve_authenticated_operator_gate(actor,r,offer->>'gate_fingerprint','approve');
 FOR n IN 1..100 LOOP PERFORM control.resolve_authenticated_operator_gate(actor,r,offer->>'gate_fingerprint','approve');END LOOP;
 RESET ROLE;
 SELECT g.grant_id INTO grant_id FROM control.operator_invocation_extensions g WHERE incident_id=i;
 IF (SELECT count(*) FROM control.operator_invocation_extensions WHERE incident_id=i)<>1 THEN RAISE EXCEPTION 'duplicate approval consumed extension';END IF;
 IF (SELECT count(*) FROM control.dot_wake_events WHERE origin='operator_gate_resolved' AND payload->>'run_id'=r::text AND consumed_at IS NULL)<>1 THEN RAISE EXCEPTION 'approval lacks one durable wake';END IF;
 -- Old in-flight scan/debounce may not acknowledge a later approval.
 PERFORM control.record_dot_compact_cycle('[]',watermark);
 IF NOT EXISTS(SELECT 1 FROM control.dot_wake_events WHERE origin='operator_gate_resolved' AND payload->>'run_id'=r::text AND consumed_at IS NULL) THEN RAISE EXCEPTION 'approval racing scan was lost';END IF;
 -- Authoritative event permutations remain durable; derived audit spam does not wake.
 SELECT count(*) INTO event_count FROM control.dot_wake_events;
 FOR n IN 1..100 LOOP
 INSERT INTO control.task_events(task_id,event_type,source,payload) SELECT current_task_id,kinds[1+(n%array_length(kinds,1))],'runner',jsonb_build_object('run_id',r) FROM control.workflow_runs WHERE run_id=r;
 END LOOP;
 IF (SELECT count(*) FROM control.dot_wake_events)<>event_count+100 THEN RAISE EXCEPTION 'authoritative event permutation lost';END IF;
 SELECT count(*) INTO event_count FROM control.dot_wake_events;
 FOR n IN 1..100 LOOP INSERT INTO control.task_events(task_id,event_type,source,payload) SELECT current_task_id,'retry_exhaustion_audited','dot','{}' FROM control.workflow_runs WHERE run_id=r;END LOOP;
 IF (SELECT count(*) FROM control.dot_wake_events)<>event_count THEN RAISE EXCEPTION 'derived self-wake';END IF;
 IF NOT control.dot_watch_ready() THEN RAISE EXCEPTION 'fallback cannot see durable authoritative wake';END IF;
 -- No webhook is delivered. Compact periodic fallback still sees the grant.
 reply:=control.claim_approved_dot_incident(r,i,grant_id);
 IF reply->>'claimed'<>'true' OR reply#>>'{job,incident_id}'<>i::text THEN RAISE EXCEPTION 'exact incident fallback failed: %',reply;END IF;
 token:=(reply#>>'{job,claim_token}')::uuid;
 FOR n IN 1..100 LOOP
 reply:=control.claim_approved_dot_incident(r,i,grant_id);
 IF reply->>'claimed'<>'false' THEN RAISE EXCEPTION 'duplicate owner';END IF;
 END LOOP;
 -- A restarted owner must respect the persisted claim, then resume after expiry.
 UPDATE control.dot_recovery_jobs SET claim_until=now()-interval '1 second',next_check_at=now()-interval '1 second' WHERE incident_id=i;
 reply:=control.claim_approved_dot_incident(r,i,grant_id);
 IF reply->>'claimed'<>'true' THEN RAISE EXCEPTION 'restart cannot resume approved claim';END IF;
 token:=(reply#>>'{job,claim_token}')::uuid;
 reply:=control.reserve_dot_model_invocation(i,token,'synthetic-exact-approved',repeat('a',64));
 -- Force the extension path by adding three finished prior calls without budget writes.
 PERFORM control.finish_dot_model_invocation(i,token,'synthetic-exact-approved',repeat('a',64));
 FOR n IN 1..3 LOOP
 INSERT INTO control.dot_model_invocations(incident_id,receipt_key,claim_token,status,launched_at,finished_at,before_fingerprint,after_fingerprint,progressed) VALUES(i,'prior-'||n,token,'finished',now()-interval '5 minutes',now()-interval '4 minutes',repeat('a',64),repeat('b',64),true);
 END LOOP;
 reply:=control.reserve_dot_model_invocation(i,token,'synthetic-one-extra',repeat('a',64));
 IF reply->>'allowed'<>'true' OR reply->>'operator_grant_id' IS NULL THEN RAISE EXCEPTION 'approved invocation not reserved';END IF;
 PERFORM control.record_dot_model_launch(i,token,'synthetic-one-extra',now());
 IF (SELECT count(*) FROM control.operator_invocation_extensions WHERE incident_id=i AND consumed_at IS NOT NULL)<>1 THEN RAISE EXCEPTION 'one approved launch not consumed';END IF;
 reply:=control.claim_approved_dot_incident(r,i,grant_id);
 IF reply->>'claimed'<>'false' THEN RAISE EXCEPTION 'consumed grant dispatched again';END IF;
END $$;
ROLLBACK;
