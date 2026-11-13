import assert from 'node:assert/strict'
import test from 'node:test'
import { MockLanguageModelV4 } from 'ai/test'
import { shopModuleLoader } from '../fixtures/load-shop-module.mjs'

const load = shopModuleLoader({})
const { runShopAssistant } = load('../server/utils/shopAssistantAgent.ts')
const { signAssistantExpense, verifyAssistantExpense } = load('../server/utils/shopAssistantProposal.ts')

const scope = {
  actorId: '10000000-0000-4000-8000-000000000001',
  shopId: '20000000-0000-4000-8000-000000000001',
  locationId: '30000000-0000-4000-8000-000000000001',
  location: 'فرع القاهرة',
  currency: 'EGP',
}
const expense = {
  title: 'مواصلات المخزن', amount: 42.5, date: '2026-11-12',
  categoryId: '40000000-0000-4000-8000-000000000001', category: 'مواصلات',
  location: scope.location, currency: scope.currency,
}
const secret = 'a'.repeat(64)
const now = 1_800_000_000_000

test('expense confirmation binds exact values and the owner, shop and branch across identical retries', () => {
  const token = signAssistantExpense(scope, expense, secret, now)
  const review = verifyAssistantExpense(token, scope, secret, now + 1)
  assert.equal(review.state, 'valid')
  assert.deepEqual(review.proposal.expense, expense)
  assert.deepEqual(verifyAssistantExpense(token, scope, secret, now + 599_999), review)
  assert.equal(verifyAssistantExpense(token, scope, secret, now + 600_000).state, 'expired')
  assert.equal(verifyAssistantExpense(token, scope, 'b'.repeat(64), now).state, 'invalid')
  for (const field of ['actorId', 'shopId', 'locationId']) {
    const changedScope = { ...scope, [field]: '50000000-0000-4000-8000-000000000001' }
    assert.equal(verifyAssistantExpense(token, changedScope, secret, now).state, 'invalid')
  }

  const [payload, signature] = token.split('.')
  const changed = JSON.parse(Buffer.from(payload, 'base64url').toString())
  changed.expense.amount = 999.99
  const forged = Buffer.from(JSON.stringify(changed)).toString('base64url') + '.' + signature
  assert.equal(verifyAssistantExpense(forged, scope, secret, now).state, 'invalid')
})

const usage = {
  inputTokens: { total: 10, noCache: 10 },
  outputTokens: { total: 10, text: 10 },
}
const output = (content, unified = 'stop') => ({ content, finishReason: { unified }, usage, warnings: [] })
const call = (toolCallId, toolName, input) => ({
  type: 'tool-call', toolCallId, toolName, input: JSON.stringify(input),
})

test('mixed-language chat sends Unicode to the model and prepares an expense without a write tool', async () => {
  const toolsRead = []
  const client = {
    from(table) {
      assert.equal(table, 'expense_categories')
      toolsRead.push(table)
      return {
        select() { return this },
        eq() { return this },
        async maybeSingle() { return { data: { name: expense.category }, error: null } },
      }
    },
    rpc() { assert.fail('The agent must not execute an expense write') },
  }
  const content = 'سجل ٤٢٫٥ جنيه مواصلات المخزن aujourd’hui'
  const model = new MockLanguageModelV4({ doGenerate: [
    output([
      call('prepare', 'preparePaidExpense', { title: expense.title, amount: expense.amount, date: expense.date, categoryId: expense.categoryId }),
      call('expenses-link', 'openPage', { destination: 'expenses' }),
    ], 'tool-calls'),
    output([{ type: 'text', text: 'راجع المصروف وأكّد تسجيله.' }]),
  ] })

  const result = await runShopAssistant(model, { ...scope, client }, [{ role: 'user', content }])
  const first = model.doGenerateCalls[0]
  assert.equal(first.prompt.at(-1).content[0].text, content)
  assert.deepEqual(first.tools.map(tool => tool.name).sort(), [
    'listExpenseCategories', 'openPage', 'operatingReport', 'preparePaidExpense', 'searchInventory', 'searchProducts',
  ])
  assert.equal(result.text, 'راجع المصروف وأكّد تسجيله.')
  assert.deepEqual(result.link, { destination: 'expenses' })
  assert.deepEqual(result.expense, expense)
  assert.deepEqual(toolsRead, ['expense_categories'])
})
