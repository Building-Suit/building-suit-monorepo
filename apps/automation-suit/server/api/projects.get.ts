import { useControlDb } from '../utils/controlDb'

export default defineEventHandler(async () => {
  const sql = useControlDb()
  const [projects, workstreams] = await Promise.all([
    sql`SELECT project_id,slug,display_name,github_repository,integration_branch,production_branch,local_repository_root,worktree_root,codex_enabled,default_model_profile,retry_policy_id,concurrency_policy,active FROM control.projects ORDER BY display_name`,
    sql`SELECT w.project_id,p.slug project_slug,w.slug,w.display_name,w.stack_key,w.application_path,w.suit_slug,w.retry_policy_id,w.model_profile,w.concurrency_policy,w.active FROM control.workstreams w JOIN control.projects p USING(project_id) ORDER BY p.display_name,w.display_name`,
  ])
  return { projects, workstreams }
})
