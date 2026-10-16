SELECT pg_temp.doctor_assert(NOT EXISTS(SELECT 1 FROM control.suits WHERE slug='doctor-suit' OR stack_key='doctor-suit'),'Existing suit collision: read back; never overwrite');
SELECT pg_temp.doctor_assert(NOT EXISTS(SELECT 1 FROM control.workstreams WHERE suit_slug='doctor-suit' OR (project_id='f71b3b2b-d56b-4f7e-94f5-0b8c379a1088' AND (slug='doctor-suit' OR stack_key='doctor-suit'))),'Existing workstream collision');
SELECT pg_temp.doctor_assert(NOT EXISTS(SELECT 1 FROM control.tasks WHERE suit_slug='doctor-suit' OR task_id LIKE 'DOS-%'),'Existing Doctor task/history collision');
SELECT pg_temp.doctor_assert(NOT EXISTS(SELECT 1 FROM control.requirements WHERE suit_slug='doctor-suit' OR requirement_id LIKE 'DOS-%'),'Existing Doctor requirement collision');
SELECT pg_temp.doctor_assert(NOT EXISTS(SELECT 1 FROM control.decisions WHERE suit_slug='doctor-suit' OR decision_id LIKE 'DOS-%'),'Existing Doctor decision collision');
SELECT pg_temp.doctor_assert(NOT EXISTS(SELECT 1 FROM control.projects WHERE project_id='f71b3b2b-d56b-4f7e-94f5-0b8c379a1088' AND application_paths ? 'doctor-suit'),'Existing Doctor application mapping');
INSERT INTO control.suits(slug,display_name,stack_key,app_path,status,metadata)
VALUES('doctor-suit','Doctor Suit','doctor-suit','apps/doctor-suit','planning','{"storage_only":true,"source_head":"7a6dcc2084000b4054010d94a04a85a408282497"}');
INSERT INTO control.decisions(suit_slug,decision_id,title,decision_text,status,source,metadata)
SELECT 'doctor-suit',d->>'decision_id',d->>'title',d->>'decision_text','open',d->>'source',jsonb_build_object('canonical_decision_contract',d)
FROM doctor_import_input i,jsonb_array_elements(i.doc->'all_start_decisions') d;
INSERT INTO control.workstreams(project_id,slug,display_name,stack_key,application_path,suit_slug,retry_policy_id,model_profile,concurrency_policy,verification_config,publication_config,active,metadata)
SELECT 'f71b3b2b-d56b-4f7e-94f5-0b8c379a1088','doctor-suit','Doctor Suit','doctor-suit','apps/doctor-suit','doctor-suit',bindings->>'retry_policy_id','deep','{"serialized":true}',doc->'verification_config',doc->'publication_config',true,
jsonb_build_object('storage_only',true,'source_head',doc->>'source_head','parent_binding_receipt',bindings->>'review_receipt') FROM doctor_import_input;
-- Only this single verified mapping key changes on the shared project.
UPDATE control.projects SET application_paths=application_paths||'{"doctor-suit":"apps/doctor-suit"}'::jsonb WHERE project_id='f71b3b2b-d56b-4f7e-94f5-0b8c379a1088';
SELECT pg_temp.doctor_assert((SELECT to_jsonb(p)-'created_at'-'updated_at'-'application_paths' FROM control.projects p WHERE project_id='f71b3b2b-d56b-4f7e-94f5-0b8c379a1088')=(SELECT doc-'application_paths' FROM doctor_project_before),'Shared project field changed outside mapping');
SELECT pg_temp.doctor_assert((SELECT application_paths FROM control.projects WHERE project_id='f71b3b2b-d56b-4f7e-94f5-0b8c379a1088')=(SELECT doc->'application_paths'||'{"doctor-suit":"apps/doctor-suit"}'::jsonb FROM doctor_project_before),'Unexpected application mapping delta');
