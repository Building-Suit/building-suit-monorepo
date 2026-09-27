import { asOperatorJson, projectSchema } from '../../../utils/operatorValidation'
import { useControlOperatorDb } from '../../../utils/controlOperatorDb'

export default defineEventHandler(async (event) => {
  const result = projectSchema.safeParse(await readBody(event))
  if (!result.success) throw createError({ statusCode: 400, statusMessage: 'Invalid project configuration', data: result.error.flatten() })
  const config = result.data
  const sql = useControlOperatorDb()
  return sql.begin(async transaction => {
    const [project] = await transaction`
      INSERT INTO control.projects(slug,display_name,repository_path,github_repository,integration_branch,production_branch,local_repository_root,worktree_root,application_paths,stack_strategy,allowed_publication_paths,verification_config,local_database_strategy,codex_enabled,default_model_profile,retry_policy_id,concurrency_policy,n8n_metadata,environment_routing,active,metadata)
      VALUES(${config.slug},${config.display_name},${config.repository_path},${config.github_repository},${config.integration_branch},${config.production_branch},${config.local_repository_root},${config.worktree_root},${transaction.json(asOperatorJson(config.application_paths))},${transaction.json(asOperatorJson(config.stack_strategy))},${transaction.json(asOperatorJson(config.allowed_publication_paths))},${transaction.json(asOperatorJson(config.verification_config))},${transaction.json(asOperatorJson(config.local_database_strategy))},${config.codex_enabled},${config.default_model_profile},${config.retry_policy_id ?? null},${transaction.json(asOperatorJson(config.concurrency_policy))},${transaction.json(asOperatorJson(config.n8n_metadata))},${transaction.json(asOperatorJson(config.environment_routing))},${config.active},${transaction.json(asOperatorJson(config.metadata))})
      ON CONFLICT(slug) DO UPDATE SET display_name=EXCLUDED.display_name,repository_path=EXCLUDED.repository_path,github_repository=EXCLUDED.github_repository,integration_branch=EXCLUDED.integration_branch,production_branch=EXCLUDED.production_branch,local_repository_root=EXCLUDED.local_repository_root,worktree_root=EXCLUDED.worktree_root,application_paths=EXCLUDED.application_paths,stack_strategy=EXCLUDED.stack_strategy,allowed_publication_paths=EXCLUDED.allowed_publication_paths,verification_config=EXCLUDED.verification_config,local_database_strategy=EXCLUDED.local_database_strategy,codex_enabled=EXCLUDED.codex_enabled,default_model_profile=EXCLUDED.default_model_profile,retry_policy_id=EXCLUDED.retry_policy_id,concurrency_policy=EXCLUDED.concurrency_policy,n8n_metadata=EXCLUDED.n8n_metadata,environment_routing=EXCLUDED.environment_routing,active=EXCLUDED.active,metadata=EXCLUDED.metadata
      RETURNING *
    `
    if (!project) throw createError({ statusCode: 500, statusMessage: 'Project save returned no row' })
    const workstreams = []
    for (const stream of config.workstreams) {
      const compatibilitySlug = config.slug === 'building-suit' ? stream.slug : `${config.slug}-${stream.slug}`
      await transaction`INSERT INTO control.suits(slug,display_name,stack_key,app_path,status,metadata) VALUES(${compatibilitySlug},${stream.display_name},${stream.stack_key},${stream.application_path},'active',${transaction.json({ compatibility_project: config.slug, compatibility_workstream: stream.slug })}) ON CONFLICT(slug) DO UPDATE SET display_name=EXCLUDED.display_name,stack_key=EXCLUDED.stack_key,app_path=EXCLUDED.app_path`
      const [saved] = await transaction`INSERT INTO control.workstreams(project_id,slug,display_name,stack_key,application_path,suit_slug,retry_policy_id,model_profile,concurrency_policy,verification_config,publication_config,active,metadata) VALUES(${project.project_id},${stream.slug},${stream.display_name},${stream.stack_key},${stream.application_path},${compatibilitySlug},${stream.retry_policy_id ?? null},${stream.model_profile ?? null},${transaction.json(asOperatorJson(stream.concurrency_policy))},${transaction.json(asOperatorJson(stream.verification_config))},${transaction.json(asOperatorJson(stream.publication_config))},${stream.active},${transaction.json(asOperatorJson(stream.metadata))}) ON CONFLICT(project_id,slug) DO UPDATE SET display_name=EXCLUDED.display_name,stack_key=EXCLUDED.stack_key,application_path=EXCLUDED.application_path,retry_policy_id=EXCLUDED.retry_policy_id,model_profile=EXCLUDED.model_profile,concurrency_policy=EXCLUDED.concurrency_policy,verification_config=EXCLUDED.verification_config,publication_config=EXCLUDED.publication_config,active=EXCLUDED.active,metadata=EXCLUDED.metadata RETURNING *`
      if (!saved) throw createError({ statusCode: 500, statusMessage: 'Workstream save returned no row' })
      workstreams.push(saved)
    }
    await transaction`INSERT INTO control.audit_events(project_id,action,source,new_value) VALUES(${project.project_id},'project_saved','dashboard',${transaction.json(asOperatorJson(project))})`
    return { ok: true, project, workstreams }
  })
})
