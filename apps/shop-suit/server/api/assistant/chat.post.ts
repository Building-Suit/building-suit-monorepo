import { runShopAssistant } from '../../utils/shopAssistantAgent'
import { signAssistantExpense } from '../../utils/shopAssistantProposal'
import {
  assistantChatRequest,
  limitShopAssistantChat,
  readShopAssistantRequest,
} from '../../utils/shopAssistantRequest'

export default defineEventHandler(async (event) => {
  const { input, scope, config } = await readShopAssistantRequest(event, assistantChatRequest, 150_000)
  limitShopAssistantChat(event, scope.actorId)

  try {
    const { text, expense, link } = await runShopAssistant(config.shopAssistantModel, scope, input.messages)
    if (!expense) return { text, link }

    const { title, amount, currency, date, category, location } = expense
    const token = signAssistantExpense(scope, expense, config.shopAssistantSigningSecret)
    return { text, link, proposal: { token, title, amount, currency, date, category, location } }
  } catch {
    throw createError({ statusCode: 502, statusMessage: 'Shop Assistant could not reply' })
  }
})
