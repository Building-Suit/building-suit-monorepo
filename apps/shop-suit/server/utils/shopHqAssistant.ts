import { z } from 'zod'

export const hqAssistantSelection = { shopId: z.uuid(), locationId: z.uuid() }
export const hqAssistantAccess = z.object({ enabled: z.boolean(), agentName: z.string().min(1).max(120) })
export const hqAssistantEnqueue = z.object({ jobId: z.uuid() })
const clarification = z.discriminatedUnion('kind', [
  z.object({ kind: z.enum(['customer_missing', 'customer_ambiguous', 'service_missing', 'service_ambiguous']), query: z.string().max(160) }),
  z.object({ kind: z.enum(['cash_shift_required', 'sale_unavailable', 'sale_details_required']) }),
  z.object({ kind: z.literal('payment_missing'), total: z.number().nonnegative().optional(), currency: z.string().regex(/^[A-Z]{3}$/).optional() }),
  z.object({ kind: z.literal('amount_mismatch'), total: z.number().nonnegative(), currency: z.string().regex(/^[A-Z]{3}$/) }),
])
const update = z.discriminatedUnion('kind', [
  z.object({ sequence: z.int().positive(), kind: z.literal('reply'), text: z.string().min(1).max(2_000) }),
  z.object({ sequence: z.int().positive(), kind: z.literal('receipt'), invoiceId: z.uuid() }),
  z.object({ sequence: z.int().positive(), kind: z.literal('clarification'), outcome: clarification }),
])
export const hqAssistantJob = z.object({
  state: z.enum(['queued', 'working', 'completed', 'failed', 'expired', 'revoked']),
  reviewPending: z.boolean(),
  updates: z.array(update).max(12),
})
export const hqAssistantRecent = z.array(hqAssistantJob.extend({
  jobId: z.uuid(),
  requestId: z.uuid(),
  ownerMessage: z.string().max(2_000).nullable(),
})).max(24)

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
