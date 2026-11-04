import { createError } from 'h3'
import { parseHqCompanySnapshot } from '../../../shared/types/companyPlans'
import { hqRpc, requireHqFounder } from '../../utils/hqAccess'

export default defineEventHandler(async event => {
  const config = useRuntimeConfig(event)
  const { accessToken } = await requireHqFounder(event, config)
  const snapshot = parseHqCompanySnapshot(await hqRpc<unknown>(config, accessToken, 'hq_company_snapshot'))
  if (!snapshot) throw createError({ statusCode: 503, statusMessage: 'Company plans unavailable' })
  return snapshot
})
