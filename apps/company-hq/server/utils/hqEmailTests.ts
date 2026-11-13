import { createError, getRouterParam, type H3Event } from 'h3'
import { boundedBody } from './hqAgents'
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const invalid = () => createError({ statusCode: 400, statusMessage: 'HQ email test input invalid' })
function exact(value: unknown, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).length !== keys.length || Object.keys(value).some(key => !keys.includes(key))) throw invalid()
  return value as Record<string, unknown>
}
export function emailTestId(event: H3Event) {
  const id = getRouterParam(event, 'id')
  if (!id || !uuid.test(id)) throw invalid()
  return id
}
export async function emailTestPrepareBody(event: H3Event) {
  const value = exact(await boundedBody(event, 16000), ['recipient', 'subject', 'body', 'requestKey'])
  if (typeof value.recipient !== 'string' || value.recipient.length > 254
    || !/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/.test(value.recipient)
    || typeof value.subject !== 'string' || Buffer.byteLength(value.subject) < 1 || Buffer.byteLength(value.subject) > 200 || /[\r\n]/.test(value.subject)
    || typeof value.body !== 'string' || Buffer.byteLength(value.body) < 1 || Buffer.byteLength(value.body) > 8000
    || typeof value.requestKey !== 'string' || !uuid.test(value.requestKey)) throw invalid()
  return { p_recipient: value.recipient, p_subject: value.subject, p_body: value.body, p_request_key: value.requestKey }
}
export async function emailTestDecisionBody(event: H3Event) {
  const value = exact(await boundedBody(event, 512), ['digest', 'approve'])
  if (typeof value.digest !== 'string' || !/^[a-f0-9]{64}$/.test(value.digest) || typeof value.approve !== 'boolean') throw invalid()
  return { p_id: emailTestId(event), p_digest: value.digest, p_approve: value.approve }
}
