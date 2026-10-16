SELECT 1 FROM control.workstreams WHERE project_id='f71b3b2b-d56b-4f7e-94f5-0b8c379a1088' AND slug='doctor-suit' FOR SHARE;
SELECT pg_temp.doctor_assert(EXISTS(SELECT 1 FROM control.workstreams w,doctor_import_input i WHERE w.project_id='f71b3b2b-d56b-4f7e-94f5-0b8c379a1088' AND w.slug='doctor-suit' AND w.suit_slug='doctor-suit' AND w.stack_key='doctor-suit' AND w.application_path='apps/doctor-suit' AND w.active AND w.model_profile='deep' AND w.retry_policy_id=i.bindings->>'retry_policy_id' AND w.verification_config=i.doc->'verification_config' AND w.publication_config=i.doc->'publication_config'),'Workstream binding/config drift');
SELECT pg_temp.doctor_assert(EXISTS(SELECT 1 FROM control.suits WHERE slug='doctor-suit' AND stack_key='doctor-suit' AND app_path='apps/doctor-suit' AND status='planning'),'Suit is not storage-only planning');
SELECT pg_temp.doctor_assert((SELECT count(*) FROM control.tasks WHERE suit_slug='doctor-suit')=(SELECT jsonb_array_length(doc->'previous_tasks') FROM doctor_import_input),'Earlier milestone task count differs');
SELECT pg_temp.doctor_assert(NOT EXISTS(SELECT 1 FROM doctor_import_input i,jsonb_array_elements(i.doc->'previous_tasks') a LEFT JOIN control.tasks t ON t.task_id=a->>'task_id' WHERE t.task_id IS NULL OR t.suit_slug<>'doctor-suit' OR t.metadata->>'canonical_task_sha256' IS DISTINCT FROM a->>'canonical_task_sha256'),'Earlier milestone identities/hashes differ');
SELECT pg_temp.doctor_assert(NOT EXISTS(SELECT 1 FROM control.tasks t,doctor_import_input i,jsonb_array_elements(i.doc->'proposal'->'create_task_calls') c WHERE t.task_id=c->'arguments'->>'p_task_id'),'Existing milestone task collision: read back, never overwrite');
SELECT pg_temp.doctor_assert(NOT EXISTS(SELECT 1 FROM control.requirements r,doctor_import_input i,jsonb_array_elements(i.doc->'proposal'->'requirements') x WHERE r.requirement_id=x->>'requirement_id'),'Requirement ID collision');
SELECT pg_temp.doctor_assert(NOT EXISTS(SELECT 1 FROM control.decisions d,doctor_import_input i,jsonb_array_elements(i.doc->'proposal'->'decisions') x WHERE d.decision_id=x->>'decision_id' AND x->>'decision_id'<>i.doc->'proposal'->>'milestone_id'||'-GATE-START'),'Decision ID collision');
INSERT INTO control.requirements(suit_slug,requirement_id,title,summary,status,risk_level,source_path,source_anchor,metadata)
SELECT 'doctor-suit',r->>'requirement_id',r->>'title',r->>'summary',r->>'status',coalesce(r->>'risk_level','normal'),r->>'source_path',r->>'source_anchor',coalesce(r->'metadata','{}')||jsonb_build_object('canonical_requirement_contract',r)
FROM doctor_import_input i,jsonb_array_elements(i.doc->'proposal'->'requirements') r;
INSERT INTO control.decisions(suit_slug,decision_id,title,decision_text,status,source,metadata)
SELECT 'doctor-suit',d->>'decision_id',d->>'title',d->>'decision_text',d->>'status',d->>'source',coalesce(d->'metadata','{}')||jsonb_build_object('canonical_decision_contract',d)
FROM doctor_import_input i,jsonb_array_elements(i.doc->'proposal'->'decisions') d WHERE d->>'decision_id'<>i.doc->'proposal'->>'milestone_id'||'-GATE-START';
DO $$
DECLARE c jsonb; a jsonb; i record;
BEGIN
 SELECT * INTO i FROM doctor_import_input;
 FOR c IN SELECT value FROM jsonb_array_elements(i.doc->'proposal'->'create_task_calls') LOOP
  a:=c->'arguments';
  PERFORM control.create_task_with_publication_contract(
   p_project_slug=>a->>'p_project_slug',p_workstream_slug=>'doctor-suit',p_task_id=>a->>'p_task_id',
   p_sequence=>(a->>'p_sequence')::integer,p_priority=>(a->>'p_priority')::integer,p_title=>a->>'p_title',p_description=>a->>'p_description',
   p_task_type=>a->>'p_task_type',p_risk_level=>a->>'p_risk_level',p_model_profile=>'deep',
   p_acceptance_criteria=>a->'p_acceptance_criteria',p_verification_plan=>a->'p_verification_plan',p_retry_policy_id=>i.bindings->>'retry_policy_id',p_metadata=>a->'p_metadata');
  -- The real OPEN blocking gate is linked immediately in this same transaction.
  INSERT INTO control.task_decisions(task_id,suit_slug,decision_id,blocking)
  VALUES(a->>'p_task_id','doctor-suit',i.doc->'proposal'->>'milestone_id'||'-GATE-START',true);
 END LOOP;
END $$;
INSERT INTO control.task_requirements(task_id,suit_slug,requirement_id)
SELECT x->>'task_id',x->>'suit_slug',x->>'requirement_id' FROM doctor_import_input i,jsonb_array_elements(i.doc->'proposal'->'task_requirements') x;
INSERT INTO control.task_dependencies(task_id,depends_on_task_id,dependency_type)
SELECT x->>'task_id',x->>'depends_on_task_id',x->>'dependency_type' FROM doctor_import_input i,jsonb_array_elements(i.doc->'proposal'->'task_dependencies') x;
INSERT INTO control.task_decisions(task_id,suit_slug,decision_id,blocking)
SELECT x->>'task_id',x->>'suit_slug',x->>'decision_id',(x->>'blocking')::boolean FROM doctor_import_input i,jsonb_array_elements(i.doc->'proposal'->'task_decisions') x
WHERE x->>'decision_id'<>i.doc->'proposal'->>'milestone_id'||'-GATE-START';
SELECT control.refresh_publication_readiness_contract(c->'arguments'->>'p_task_id','doctor-reviewed-milestone-import') FROM doctor_import_input i,jsonb_array_elements(i.doc->'proposal'->'create_task_calls') c;
-- Full canonical metadata and supported top-level fields must round-trip exactly.
SELECT pg_temp.doctor_assert(NOT EXISTS(
 SELECT 1 FROM doctor_import_input i,jsonb_array_elements(i.doc->'proposal'->'create_task_calls') c JOIN control.tasks t ON t.task_id=c->'arguments'->>'p_task_id'
 WHERE t.metadata IS DISTINCT FROM c->'arguments'->'p_metadata'
 OR t.title IS DISTINCT FROM c->'arguments'->>'p_title' OR t.description IS DISTINCT FROM c->'arguments'->>'p_description'
 OR t.sequence IS DISTINCT FROM (c->'arguments'->>'p_sequence')::integer OR t.priority IS DISTINCT FROM (c->'arguments'->>'p_priority')::integer
 OR t.task_type IS DISTINCT FROM c->'arguments'->>'p_task_type' OR t.risk_level IS DISTINCT FROM c->'arguments'->>'p_risk_level'
 OR t.acceptance_criteria IS DISTINCT FROM c->'arguments'->'p_acceptance_criteria' OR t.verification_plan IS DISTINCT FROM c->'arguments'->'p_verification_plan'
 OR t.project_id<>'f71b3b2b-d56b-4f7e-94f5-0b8c379a1088' OR t.workstream_slug<>'doctor-suit' OR t.suit_slug<>'doctor-suit' OR t.model_profile<>'deep' OR t.retry_policy_id IS DISTINCT FROM i.bindings->>'retry_policy_id'
),'Task argument/canonical metadata mismatch');
SELECT pg_temp.doctor_assert((SELECT count(*) FROM control.tasks WHERE suit_slug='doctor-suit')=(SELECT jsonb_array_length(doc->'previous_tasks')+jsonb_array_length(doc->'proposal'->'task_ids') FROM doctor_import_input),'Partial milestone task batch');
DO $$
DECLARE i record; actual jsonb; expected jsonb;
BEGIN
 SELECT * INTO i FROM doctor_import_input;
 SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY to_jsonb(r)::text),'[]') INTO actual FROM (SELECT task_id,suit_slug,requirement_id FROM control.task_requirements WHERE task_id IN(SELECT jsonb_array_elements_text(i.doc->'proposal'->'task_ids'))) r;
 SELECT jsonb_agg(x ORDER BY x::text) INTO expected FROM jsonb_array_elements(i.doc->'proposal'->'task_requirements') x;
 PERFORM pg_temp.doctor_assert(actual=expected,'Requirement links differ');
 SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY to_jsonb(r)::text),'[]') INTO actual FROM (SELECT task_id,depends_on_task_id,dependency_type FROM control.task_dependencies WHERE task_id IN(SELECT jsonb_array_elements_text(i.doc->'proposal'->'task_ids'))) r;
 SELECT coalesce(jsonb_agg(x ORDER BY x::text),'[]') INTO expected FROM jsonb_array_elements(i.doc->'proposal'->'task_dependencies') x;
 PERFORM pg_temp.doctor_assert(actual=expected,'Dependency links differ');
 SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY to_jsonb(r)::text),'[]') INTO actual FROM (SELECT task_id,suit_slug,decision_id,blocking FROM control.task_decisions WHERE task_id IN(SELECT jsonb_array_elements_text(i.doc->'proposal'->'task_ids'))) r;
 SELECT jsonb_agg(x ORDER BY x::text) INTO expected FROM jsonb_array_elements(i.doc->'proposal'->'task_decisions') x;
 PERFORM pg_temp.doctor_assert(actual=expected,'Decision links differ');
 PERFORM pg_temp.doctor_assert(NOT EXISTS(SELECT 1 FROM jsonb_array_elements(i.doc->'proposal'->'requirements') x LEFT JOIN control.requirements r ON r.suit_slug='doctor-suit' AND r.requirement_id=x->>'requirement_id' WHERE r.metadata->'canonical_requirement_contract' IS DISTINCT FROM x OR r.title IS DISTINCT FROM x->>'title' OR r.summary IS DISTINCT FROM x->>'summary' OR r.status IS DISTINCT FROM x->>'status'),'Requirement canonical mismatch');
 PERFORM pg_temp.doctor_assert(NOT EXISTS(SELECT 1 FROM jsonb_array_elements(i.doc->'proposal'->'decisions') x LEFT JOIN control.decisions d ON d.suit_slug='doctor-suit' AND d.decision_id=x->>'decision_id' WHERE d.metadata->'canonical_decision_contract' IS DISTINCT FROM x OR d.title IS DISTINCT FROM x->>'title' OR d.decision_text IS DISTINCT FROM x->>'decision_text' OR d.status IS DISTINCT FROM x->>'status' OR d.source IS DISTINCT FROM x->>'source'),'Decision canonical mismatch');
END $$;
SELECT pg_temp.doctor_assert((SELECT to_jsonb(p)-'created_at'-'updated_at' FROM control.projects p WHERE project_id='f71b3b2b-d56b-4f7e-94f5-0b8c379a1088')=(SELECT doc FROM doctor_project_before),'Shared project changed during milestone import');
