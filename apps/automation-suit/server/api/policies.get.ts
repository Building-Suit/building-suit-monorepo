import { useControlDb } from '../utils/controlDb'

export default defineEventHandler(async () => {
  const sql = useControlDb()
  return { policies: await sql`SELECT policy_id,display_name,max_attempts,attempt_profiles,active,updated_at FROM control.retry_policies ORDER BY policy_id` }
})
