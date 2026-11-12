import type { H3Event } from 'h3'
import { z } from 'zod'
import { createInquiryRateLimit } from './inquiryRateLimit'
import { readBoundedInquiryBody } from './readBoundedInquiryBody'
import { requireShopAssistantScope } from './shopAssistantScope'

const takeChatRequest = createInquiryRateLimit(12, 60_000)
const selection = { shopId: z.uuid(), locationId: z.uuid() }
const chatMessage = z.strictObject({
  role: z.enum(['user', 'assistant']),
  content: z.string().trim().min(1).max(2_000),
})

export const assistantChatRequest = z.strictObject({
  ...selection,
  messages: z.array(chatMessage).min(1).max(12)
    .refine(messages => messages.at(-1)?.role === 'user'),
})
export const assistantConfirmRequest = z.strictObject({
  ...selection,
  token: z.string().min(1).max(8_192),
})

export async function readShopAssistantRequest<T extends { shopId: string, locationId: string }>(
  event: H3Event,
  schema: z.ZodType<T>,
  byteLimit: number,
) {
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  const config = useRuntimeConfig(event)
  if (event.context.websiteHost || String(config.public.shopAssistantEnabled) !== 'true') {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  const site = getHeader(event, 'sec-fetch-site')
  if (site && site !== 'same-origin') {
    throw createError({ statusCode: 403, statusMessage: 'Shop origin required' })
  }
  if (getHeader(event, 'content-type')?.split(';')[0]?.trim().toLowerCase() !== 'application/json') {
    throw createError({ statusCode: 415, statusMessage: 'JSON required' })
  }

  let raw: unknown
  try {
    raw = await readBoundedInquiryBody(event, byteLimit)
  } catch (error) {
    if ((error as { statusCode?: number }).statusCode === 413) {
      throw createError({ statusCode: 413, statusMessage: 'Assistant request too large' })
    }
    throw createError({ statusCode: 400, statusMessage: 'Invalid assistant request' })
  }
  const parsed = schema.safeParse(raw)
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Invalid assistant request' })

  const input = parsed.data
  const scope = await requireShopAssistantScope(event, input.shopId, input.locationId)
  if (!/^[a-f0-9]{64}$/i.test(config.shopAssistantSigningSecret)) {
    throw createError({ statusCode: 503, statusMessage: 'Shop Assistant unavailable' })
  }
  return { input, scope, config }
}

export function limitShopAssistantChat(event: H3Event, actorId: string) {
  if (takeChatRequest(actorId)) return
  setResponseHeader(event, 'Retry-After', 60)
  throw createError({ statusCode: 429, statusMessage: 'Too many assistant requests' })
}
