import { runShopAssistant } from '../../utils/shopAssistantAgent'
import { tryShopAssistantBranchSales } from '../../utils/shopAssistantBranchSales'
import { signAssistantExpense } from '../../utils/shopAssistantProposal'
import {
  assistantChatRequest,
  limitShopAssistantChat,
  readShopAssistantRequest,
} from '../../utils/shopAssistantRequest'

export default defineEventHandler(async (event) => {
  const { input, scope, config } = await readShopAssistantRequest(event, assistantChatRequest, 150_000)
  limitShopAssistantChat(event, scope.actorId)

  const branchSales = await tryShopAssistantBranchSales(scope, input.messages)
  if (branchSales) return branchSales

  let phase = 'reply'
  try {
    const { text, expense, link } = await runShopAssistant(config.shopAssistantModel, scope, input.messages)
    if (!expense) return { text, link }

    phase = 'expense-proposal'
    const { title, amount, currency, date, category, location } = expense
    const token = signAssistantExpense(scope, expense, config.shopAssistantSigningSecret)
    return { text, link, proposal: { token, title, amount, currency, date, category, location } }
  } catch (error) {
    const status = typeof error === 'object' && error !== null && 'statusCode' in error
      ? error.statusCode
      : undefined
    // Provider error messages may include prompts or data. Log fixed fields only.
    const cause = status === 401 || status === 403 ? 'authentication'
      : status === 402 ? 'credits'
        : status === 429 ? 'rate-limit'
          : typeof status === 'number' && status >= 500 && status <= 599 ? 'upstream'
            : 'unknown'
    console.warn('[shop-assistant] request failed', { phase, cause })
    throw createError({ statusCode: 502, statusMessage: 'Shop Assistant could not reply' })
  }
})
