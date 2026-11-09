import { requireHqFounder } from '../../../utils/hqAccess'

export default defineEventHandler(async event => {
  const config = useRuntimeConfig(event)
  await requireHqFounder(event, config)
  const key = config.hqPushVapidPublicKey
  return { publicKey: /^[A-Za-z0-9_-]{87}$/.test(key) ? key : null }
})
