import { saveAssistantExpense } from '../../utils/shopAssistantActions'
import { verifyAssistantExpense } from '../../utils/shopAssistantProposal'
import { assistantConfirmRequest, readShopAssistantRequest } from '../../utils/shopAssistantRequest'

export default defineEventHandler(async (event) => {
  const { input, scope, config } = await readShopAssistantRequest(event, assistantConfirmRequest, 9_000)
  const result = verifyAssistantExpense(input.token, scope, config.shopAssistantSigningSecret)
  if (result.state === 'expired') {
    throw createError({
      statusCode: 409,
      statusMessage: 'Expense proposal expired',
      data: { code: 'ASSISTANT_PROPOSAL_EXPIRED' },
    })
  }
  if (result.state === 'invalid') {
    throw createError({ statusCode: 400, statusMessage: 'Invalid expense proposal' })
  }

  const { expense, requestId } = result.proposal
  const expenseId = await saveAssistantExpense(scope, expense, requestId)
  return { expenseId }
})
