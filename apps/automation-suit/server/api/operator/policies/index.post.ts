import { asOperatorJson, retryPolicySchema } from '../../../utils/operatorValidation'
import { useControlOperatorDb } from '../../../utils/controlOperatorDb'

export default defineEventHandler(async (event) => {
  const result = retryPolicySchema.safeParse(await readBody(event))
  if (!result.success) throw createError({ statusCode: 400, statusMessage: 'Invalid retry policy', data: result.error.flatten() })
  const policy = result.data
  const sql = useControlOperatorDb()
  const [saved] = await sql`INSERT INTO control.retry_policies(policy_id,display_name,max_attempts,attempt_profiles,active,metadata) VALUES(${policy.policy_id},${policy.display_name},${policy.max_attempts},${sql.json(asOperatorJson(policy.attempt_profiles))},${policy.active},${sql.json(asOperatorJson(policy.metadata))}) ON CONFLICT(policy_id) DO UPDATE SET display_name=EXCLUDED.display_name,max_attempts=EXCLUDED.max_attempts,attempt_profiles=EXCLUDED.attempt_profiles,active=EXCLUDED.active,metadata=EXCLUDED.metadata RETURNING *`
  if (!saved) throw createError({ statusCode: 500, statusMessage: 'Policy save returned no row' })
  await sql`INSERT INTO control.audit_events(action,source,new_value) VALUES('retry_policy_saved','dashboard',${sql.json(asOperatorJson(saved))})`
  return { ok: true, policy: saved }
})
