import { useControlDb } from '../../utils/controlDb'

export default defineEventHandler(async (event) => {
  const id = String(getRouterParam(event, 'id') ?? '')
  if (!/^[A-Z][A-Z0-9-]{2,63}$/.test(id)) throw createError({ statusCode: 400, statusMessage: 'Invalid task ID' })
  const sql = useControlDb()
  const [packetRows, executions, checks, runs, events, failures, prs] = await Promise.all([
    sql`SELECT control.generic_task_packet(${id}) packet`,
    sql`SELECT * FROM control.executions WHERE task_id=${id} ORDER BY attempt`,
    sql`SELECT v.* FROM control.verification_results v JOIN control.executions e USING(execution_id) WHERE e.task_id=${id} ORDER BY v.verification_id`,
    sql`SELECT r.* FROM control.verification_runs r JOIN control.executions e USING(execution_id) WHERE e.task_id=${id} ORDER BY r.verification_run_id`,
    sql`SELECT * FROM control.task_events WHERE task_id=${id} ORDER BY event_id DESC LIMIT 200`,
    sql`SELECT * FROM control.failures WHERE task_id=${id} ORDER BY failure_id DESC`,
    sql`SELECT * FROM control.pull_requests WHERE task_id=${id} ORDER BY pull_request_id DESC`,
  ])
  const packet = packetRows[0]?.packet
  if (!packet) throw createError({ statusCode: 404, statusMessage: 'Task not found' })
  return { packet, executions, verificationRuns: runs, verificationChecks: checks, events, failures, pullRequests: prs }
})
