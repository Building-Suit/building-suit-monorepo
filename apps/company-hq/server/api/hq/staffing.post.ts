import { createError, setResponseHeader } from 'h3'
import { hqRpc, requireHqFounder } from '../../utils/hqAccess'
import { hqStaffingDecisionBody } from '../../utils/hqAgents'
import { parseHqStaffingSnapshot } from '#shared/types/staffing'

export default defineEventHandler(async event => {
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  const config = useRuntimeConfig(event)
  const { accessToken } = await requireHqFounder(event, config)
  const body = await hqStaffingDecisionBody(event)
  const snapshot = parseHqStaffingSnapshot(await hqRpc<unknown>(config, accessToken, 'hq_decide_staffing_plan', {
    p_plan_id: body.planId, p_digest: body.digest, p_decision: body.decision,
    p_resume_original: body.resumeOriginal, p_request_key: body.requestKey,
  }))
  if (!snapshot) throw createError({ statusCode: 503, statusMessage: 'HQ staffing decision outcome unavailable' })
  return snapshot
})
