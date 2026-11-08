import { createError, setResponseHeader } from 'h3'
import { hqRpc, requireHqFounder } from '../../utils/hqAccess'
import { parseHqStaffingSnapshot } from '#shared/types/staffing'

export default defineEventHandler(async event => {
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  const config = useRuntimeConfig(event)
  const { accessToken } = await requireHqFounder(event, config)
  const snapshot = parseHqStaffingSnapshot(await hqRpc<unknown>(config, accessToken, 'hq_staffing_snapshot'))
  if (!snapshot) throw createError({ statusCode: 503, statusMessage: 'HQ staffing unavailable' })
  return snapshot
})
