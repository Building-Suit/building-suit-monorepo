import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import { z } from 'zod'

const proposalLifetime = 10 * 60_000
const scopeSchema = z.object({
  actorId: z.uuid(),
  shopId: z.uuid(),
  locationId: z.uuid(),
})
type ProposalScope = z.infer<typeof scopeSchema>

const expenseSchema = z.object({
  title: z.string().min(1),
  amount: z.number().positive(),
  date: z.iso.date(),
  categoryId: z.guid(),
  category: z.string().min(1),
  currency: z.string().regex(/^[A-Z]{3}$/),
  location: z.string().min(1),
})
type ReviewedExpense = z.infer<typeof expenseSchema>

const proposalSchema = scopeSchema.extend({
  version: z.literal(1),
  action: z.literal('record-paid-expense'),
  expiresAt: z.number().int(),
  requestId: z.uuid(),
  expense: expenseSchema,
})

function signature(payload: string, secret: string) {
  return createHmac('sha256', Buffer.from(secret, 'hex')).update(payload).digest()
}

export function signAssistantExpense(scope: ProposalScope, expense: ReviewedExpense, secret: string, now = Date.now()) {
  const proposal = proposalSchema.parse({
    version: 1,
    action: 'record-paid-expense',
    actorId: scope.actorId,
    shopId: scope.shopId,
    locationId: scope.locationId,
    expiresAt: now + proposalLifetime,
    requestId: randomUUID(),
    expense,
  })
  const payload = Buffer.from(JSON.stringify(proposal)).toString('base64url')
  return `${payload}.${signature(payload, secret).toString('base64url')}`
}

export function verifyAssistantExpense(token: string, scope: ProposalScope, secret: string, now = Date.now()) {
  const match = /^([a-zA-Z0-9_-]+)\.([a-zA-Z0-9_-]{43})$/.exec(token)
  const payload = match?.[1]
  const signed = match?.[2]
  if (!payload || !signed) return { state: 'invalid' } as const
  if (!timingSafeEqual(signature(payload, secret), Buffer.from(signed, 'base64url'))) {
    return { state: 'invalid' } as const
  }

  let value: unknown
  try {
    value = JSON.parse(Buffer.from(payload, 'base64url').toString())
  } catch {
    return { state: 'invalid' } as const
  }
  const proposal = proposalSchema.safeParse(value)
  if (!proposal.success || proposal.data.actorId !== scope.actorId
    || proposal.data.shopId !== scope.shopId || proposal.data.locationId !== scope.locationId) {
    return { state: 'invalid' } as const
  }
  if (proposal.data.expiresAt <= now) return { state: 'expired' } as const

  return { state: 'valid', proposal: proposal.data } as const
}
