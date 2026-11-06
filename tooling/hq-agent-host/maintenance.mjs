/** Local maintenance barrier. A busy scope includes claims, inference, delivery,
 * journal recovery, roster writes and lesson publication. Never cancels work. */
export function maintenanceGate({ paused = false, uncertain = false, poison = async () => {} } = {}) {
  let busy = 0
  return {
    snapshot: () => ({ paused, busy, uncertain }),
    pause() { paused = true },
    resume() { if (uncertain || busy) throw Error('maintenance-unsettled'); paused = false },
    async run(action) {
      if (paused || uncertain) return false
      busy++
      try { await action(); return true }
      catch (error) { uncertain = true; paused = true; await poison(); throw error }
      finally { busy-- }
    },
  }
}

// This is an API-shape check, not proof of semantic compatibility. The separate
// operator-approved schema contract must remain additive across both releases.
export const REQUIRED_RPCS = {
  hq_worker_release_status: ['p_worker_id'],
  hq_worker_claim: ['p_worker_id', 'p_lease_seconds', 'p_meeting_protocol'],
  hq_worker_finish_v3: ['p_job_id', 'p_lease_token', 'p_worker_id', 'p_reply', 'p_error', 'p_evidence', 'p_model_evidence'],
  hq_worker_heartbeat: ['p_job_id', 'p_lease_token', 'p_worker_id', 'p_status'],
  hq_worker_presence: ['p_worker_id'], hq_worker_skill_context: ['p_job_id', 'p_lease_token', 'p_worker_id', 'p_skill_ids'],
  hq_worker_roster_sources: ['p_worker_id'], hq_worker_sync_roster: ['p_worker_id', 'p_agents'],
  hq_worker_pending_lessons: ['p_worker_id'], hq_worker_publish_lesson: ['p_worker_id', 'p_lesson_id', 'p_reference', 'p_digest'],
}
export function checkApiContract(spec) {
  for (const [name, names] of Object.entries(REQUIRED_RPCS)) {
    const operation = spec?.paths?.['/rpc/' + name]?.post
    const body = operation?.parameters?.find(value => value.in === 'body')?.schema
    const definition = body?.$ref?.startsWith('#/definitions/') ? spec.definitions?.[body.$ref.slice(14)] : body
    if (!definition?.properties || names.some(key => !Object.hasOwn(definition.properties, key))) throw Error('schema-incompatible')
  }
  return 2
}
