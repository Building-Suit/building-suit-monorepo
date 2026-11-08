import { setResponseHeader } from 'h3'
import { hqRpc, requireHqFounder } from '../../../utils/hqAccess'
import { hqRepositoryTrialBody } from '../../../utils/hqAgents'

export default defineEventHandler(async event => {
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  const config = useRuntimeConfig(event)
  const { accessToken } = await requireHqFounder(event, config)
  const body = await hqRepositoryTrialBody(event)
  if (body.action === 'qualify') return hqRpc<unknown>(config, accessToken, 'hq_issue_repository_qualification', { p_trial_id: body.trialId })
  if (body.action === 'start') return hqRpc<unknown>(config, accessToken, 'hq_begin_repository_trial', {
    p_agent_id: body.agentId, p_bundle_id: body.bundleId, p_request_key: body.requestKey,
  })
  return hqRpc<unknown>(config, accessToken, 'hq_freeze_repository_bundle', {
    p_agent_id: body.agentId, p_preset: body.preset, p_mode: body.mode, p_sha: body.sha,
    p_pull_request_number: body.pullRequestNumber, p_predecessor_artifact_id: body.predecessorArtifactId, p_request_key: body.requestKey,
  })
})
