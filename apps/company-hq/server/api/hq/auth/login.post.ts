import { runtime, mutationOrigin, jsonBody, loginAddress, writeSession, safe } from '../../../utils/hqRuntime'
import { passwordMatches } from '../../../utils/hqAuth'
import { HqProblem } from '../../../utils/hqDomain'
export default defineEventHandler(event => safe(async () => {
  const { config, store } = runtime(event)
  mutationOrigin(event, config.origin)
  const address = loginAddress(event)
  const body = await jsonBody(event)
  await store.consumeLoginAttempt(address)
  if (!passwordMatches(body?.password, config.passwordHash)) { throw new HqProblem(401, 'HQ_UNAUTHORIZED', 'Unable to sign in.') }
  writeSession(event, await store.createSession(), config.origin)
  return { ok: true }
}))
