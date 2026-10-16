SELECT pg_temp.doctor_assert(NOT EXISTS(SELECT 1 FROM control.suits WHERE slug='doctor-suit' OR stack_key='doctor-suit'),'Existing suit collision: read back; never overwrite');
SELECT pg_temp.doctor_assert(NOT EXISTS(SELECT 1 FROM control.workstreams WHERE suit_slug='doctor-suit' OR (project_id='f71b3b2b-d56b-4f7e-94f5-0b8c379a1088' AND (slug='doctor-suit' OR stack_key='doctor-suit'))),'Existing workstream collision');
SELECT pg_temp.doctor_assert(NOT EXISTS(SELECT 1 FROM control.tasks WHERE suit_slug='doctor-suit' OR task_id LIKE 'DOS-%'),'Existing Doctor task/history collision');
SELECT pg_temp.doctor_assert(NOT EXISTS(SELECT 1 FROM control.requirements WHERE suit_slug='doctor-suit' OR requirement_id LIKE 'DOS-%'),'Existing Doctor requirement collision');
SELECT pg_temp.doctor_assert(NOT EXISTS(SELECT 1 FROM control.decisions WHERE suit_slug='doctor-suit' OR decision_id LIKE 'DOS-%'),'Existing Doctor decision collision');
SELECT pg_temp.doctor_assert(NOT EXISTS(SELECT 1 FROM control.projects WHERE project_id='f71b3b2b-d56b-4f7e-94f5-0b8c379a1088' AND application_paths ? 'doctor-suit'),'Existing Doctor application mapping');
INSERT INTO control.suits(slug,display_name,stack_key,app_path,status,metadata)
VALUES('doctor-suit','Doctor Suit','doctor-suit',NULL,'planning','{"storage_only":true,"source_head":"7a6dcc2084000b4054010d94a04a85a408282497"}');
INSERT INTO control.decisions(suit_slug,decision_id,title,decision_text,status,source,metadata)
SELECT 'doctor-suit',d->>'decision_id',d->>'title',d->>'decision_text','open',d->>'source',jsonb_build_object('canonical_decision_contract',d)
FROM doctor_import_input i,jsonb_array_elements(i.doc->'all_start_decisions') d;
INSERT INTO control.workstreams(project_id,slug,display_name,stack_key,application_path,suit_slug,retry_policy_id,model_profile,concurrency_policy,verification_config,publication_config,active,metadata)
SELECT 'f71b3b2b-d56b-4f7e-94f5-0b8c379a1088','doctor-suit','Doctor Suit','doctor-suit',NULL,'doctor-suit',NULL,NULL,'{"serialized":true}','{}',doc->'publication_config',false,
jsonb_build_object('storage_only',true,'source_head',doc->>'source_head','parent_binding_receipt',bindings->>'review_receipt','planning_storage',doc->'planning_storage','verification_config_proposal',doc->'verification_config_proposal','model_profile_proposal','deep','retry_policy_proposal',NULL,'application_path_proposal','apps/doctor-suit') FROM doctor_import_input;
-- Storage never modifies the shared project, including its application mapping.
SELECT pg_temp.doctor_assert((SELECT to_jsonb(p)-'created_at'-'updated_at' FROM control.projects p WHERE project_id='f71b3b2b-d56b-4f7e-94f5-0b8c379a1088')=(SELECT doc FROM doctor_project_before),'Shared project changed during planning registration');
