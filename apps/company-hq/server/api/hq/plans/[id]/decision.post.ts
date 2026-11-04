import { createError, getHeader, getRouterParam } from 'h3'
import type { H3Event } from 'h3'
import { HQ_PLAN_UUID, parseHqCompanySnapshot } from '../../../../../shared/types/companyPlans'
import { assertHqAccessRequest, hqRpc, requireHqFounder } from '../../../../utils/hqAccess'

function invalidRequest() { return createError({ statusCode: 400, statusMessage: 'Company plan decision unavailable' }) }

async function decisionBody(event: H3Event): Promise<{ revision: number; decision: 'approved' | 'rejected'; requestKey: string }> {
  if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(getHeader(event, 'content-type') ?? '')
    || getHeader(event, 'content-encoding') && getHeader(event, 'content-encoding') !== 'identity') throw invalidRequest()
  const length = getHeader(event, 'content-length')
  if (length && (!/^\d+$/.test(length) || Number(length) > 2_048)) throw invalidRequest()
  const request = event.node.req
  const body = await new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = []
    let count = 0
    const cleanup = () => {
      clearTimeout(timer)
      request.removeListener('data', onData)
      request.removeListener('end', onEnd)
      request.removeListener('error', onError)
      request.removeListener('aborted', onError)
    }
    const onError = () => { cleanup(); reject(invalidRequest()) }
    const onData = (chunk: Buffer | string) => {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      count += bytes.length
      if (count > 2_048) { request.pause(); onError(); return }
      chunks.push(bytes)
    }
    const onEnd = () => { cleanup(); resolve(Buffer.concat(chunks)) }
    const timer = setTimeout(() => { request.pause(); onError() }, 10_000)
    request.on('data', onData)
    request.once('end', onEnd)
    request.once('error', onError)
    request.once('aborted', onError)
  })
  try {
    const value: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(body))
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalidRequest()
    const data = value as Record<string, unknown>
    if (Object.keys(data).length !== 3 || Object.keys(data).some(key => !['revision', 'decision', 'requestKey'].includes(key))
      || typeof data.revision !== 'number' || !Number.isSafeInteger(data.revision) || data.revision < 1
      || data.decision !== 'approved' && data.decision !== 'rejected' || typeof data.requestKey !== 'string' || !HQ_PLAN_UUID.test(data.requestKey)) throw invalidRequest()
    return { revision: data.revision, decision: data.decision, requestKey: data.requestKey.toLowerCase() }
  }
  catch { throw invalidRequest() }
}

export default defineEventHandler(async event => {
  const config = useRuntimeConfig(event)
  assertHqAccessRequest(event, config)
  const id = getRouterParam(event, 'id')
  if (!id || !HQ_PLAN_UUID.test(id)) throw invalidRequest()
  const body = await decisionBody(event)
  const { accessToken } = await requireHqFounder(event, config)
  const result = await hqRpc<unknown>(config, accessToken, 'hq_decide_company_plan', {
    p_plan_id: id.toLowerCase(), p_revision: body.revision, p_decision: body.decision, p_request_key: body.requestKey,
  })
  const snapshot = parseHqCompanySnapshot(result)
  if (!snapshot) throw createError({ statusCode: 503, statusMessage: 'Company plans unavailable' })
  return snapshot
})
