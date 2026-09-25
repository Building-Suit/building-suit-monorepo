import { useControlDb } from '../utils/controlDb'

export default defineEventHandler(async () => {
  const sql = useControlDb()
  const rows = await sql`
    SELECT
      now() AS database_time,
      current_database()::text AS database,
      current_user::text AS database_user,
      to_regclass('control.tasks') IS NOT NULL AS control_schema_ready
  `

  return {
    ok: Boolean(rows[0]?.control_schema_ready),
    ...rows[0],
  }
})
