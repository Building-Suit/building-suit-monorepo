import { useControlDb } from '../utils/controlDb'

export default defineEventHandler(async () => {
  const sql = useControlDb()
  return { failures: await sql`
    SELECT f.*,p.slug project_slug,t.title task_title
    FROM control.failures f
    LEFT JOIN control.projects p USING(project_id)
    LEFT JOIN control.tasks t USING(task_id)
    WHERE f.resolved_at IS NULL
    ORDER BY f.human_intervention_required DESC,f.created_at DESC
    LIMIT 300
  ` }
})
