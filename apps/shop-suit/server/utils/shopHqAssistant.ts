import { z } from 'zod'

export const hqAssistantSelection = { shopId: z.uuid(), locationId: z.uuid() }
export const hqAssistantAccess = z.object({ enabled: z.boolean(), agentName: z.string().min(1).max(120) })
export const hqAssistantEnqueue = z.object({ jobId: z.uuid() })
const commonIntent = { reply: z.string().trim().min(1).max(1_000) }
const intentSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    ...commonIntent,
    kind: z.literal('reply'),
    customerName: z.null(),
    services: z.tuple([]),
    paymentMethod: z.null(),
  }),
  z.strictObject({
    ...commonIntent,
    kind: z.literal('service_sale'),
    customerName: z.string().trim().min(2).max(160),
    services: z.array(z.string().trim().min(2).max(120)).min(1).max(6),
    paymentMethod: z.enum(['cash', 'card', 'transfer']).nullable(),
  }),
])
export const hqAssistantJob = z.discriminatedUnion('state', [
  z.object({ state: z.enum(['queued', 'working', 'failed', 'expired', 'revoked']) }),
  z.object({ state: z.literal('completed'), intent: intentSchema }),
])

export function readHqAssistantRpc<T>(
  schema: z.ZodType<T>,
  result: { data: unknown; error: { code: string } | null },
) {
  if (result.error?.code === '42501' || result.error?.code === '28000') {
    throw createError({ statusCode: 403, statusMessage: 'Shop agent access required' })
  }
  if (result.error?.code === '54000') {
    throw createError({ statusCode: 429, statusMessage: 'Shop agent is busy' })
  }
  if (result.error?.code === '23505') {
    throw createError({ statusCode: 409, statusMessage: 'Shop agent request conflict' })
  }
  if (result.error?.code === '22023') {
    throw createError({ statusCode: 400, statusMessage: 'Invalid Shop agent request' })
  }
  const parsed = schema.safeParse(result.data)
  if (result.error || !parsed.success) {
    throw createError({ statusCode: 503, statusMessage: 'Shop agent unavailable' })
  }
  return parsed.data
}
