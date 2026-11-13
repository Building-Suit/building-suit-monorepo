import { z } from 'zod'
import type { ShopAssistantScope } from './shopAssistantScope'

const resultLimit = 20
const categoryLimit = 50
const dateSchema = z.iso.date()

const productPage = z.object({
  total: z.number().int().nonnegative(),
  items: z.array(z.object({
    name: z.string(),
    sku: z.string().nullable(),
    category_name: z.string().nullable(),
    sale_price: z.number(),
    base_unit_code: z.string().optional(),
  })),
})

const inventoryPage = z.object({
  items: z.array(z.object({
    name: z.string(),
    sku: z.string().nullable(),
    is_active: z.boolean(),
    is_low_stock: z.boolean(),
    quantity_on_hand: z.number(),
    reorder_threshold: z.number(),
    base_unit_code: z.string().optional(),
  })),
})

const operatingReport = z.object({
  fromDate: dateSchema,
  toDateExclusive: dateSchema,
  sales: z.number(),
  saleCount: z.number().int().nonnegative(),
  paymentsIn: z.number(),
  expenses: z.object({
    amount: z.number().nullable(),
    count: z.number().int().nonnegative().nullable(),
  }),
})

const expenseInput = z.object({
  title: z.string().trim().min(2).max(160),
  amount: z.number().positive().max(999_999_999.99).refine(value => Math.round(value * 100) / 100 === value),
  date: dateSchema,
  categoryId: z.guid(),
})

export type AssistantExpenseInput = z.input<typeof expenseInput>
export type AssistantExpense = AssistantExpenseInput & { category: string; currency: string; location: string }

function actionError(statusCode: number, statusMessage: string) {
  return Object.assign(new Error(statusMessage), { statusCode, statusMessage })
}

function readResult<T>(schema: z.ZodType<T>, result: { data: unknown; error: { code: string } | null }): T {
  if (result.error?.code === '42501') throw actionError(403, 'Shop permission required')
  const parsed = schema.safeParse(result.data)
  if (result.error || !parsed.success) throw actionError(503, 'Shop data unavailable')
  return parsed.data
}

function searchTerm(query: string, limit: number) {
  const term = query.trim()
  if (term.length > limit) throw actionError(400, 'Shop search is too long')
  return term
}

function escapeSearch(term: string) {
  return term.replace(/[\\%_]/g, '\\$&')
}

export async function searchAssistantProducts(scope: ShopAssistantScope, query: string) {
  // The product RPC limits the escaped search to 160 characters.
  const term = searchTerm(escapeSearch(query.trim()), 160)
  const result = readResult(productPage, await scope.client.rpc('list_products', {
    p_shop_id: scope.shopId, p_search: term || null, p_page: 1, p_page_size: resultLimit,
  }))
  const items = result.items.slice(0, resultLimit).map(item => ({
    name: item.name, sku: item.sku, category: item.category_name,
    salePrice: item.sale_price, unit: item.base_unit_code ?? null,
  }))
  return { currency: scope.currency, total: result.total, truncated: result.total > items.length, items }
}

export async function searchAssistantInventory(scope: ShopAssistantScope, { query, lowStockOnly }: { query?: string; lowStockOnly?: boolean }) {
  const term = searchTerm(query ?? '', 160).normalize('NFC').toLowerCase()
  const result = readResult(inventoryPage, await scope.client.rpc('list_inventory', {
    p_shop_id: scope.shopId, p_low_stock_only: lowStockOnly ?? false,
  }))
  const matched = result.items.filter(item => item.is_active && (!lowStockOnly || item.is_low_stock) && (!term ||
    item.name.normalize('NFC').toLowerCase().includes(term) ||
    item.sku?.normalize('NFC').toLowerCase().includes(term)))
  const items = matched.slice(0, resultLimit).map(item => ({
    name: item.name, sku: item.sku, quantityOnHand: item.quantity_on_hand, unit: item.base_unit_code ?? null,
    reorderThreshold: item.reorder_threshold, lowStock: item.is_low_stock,
  }))
  return { scope: 'shop' as const, total: matched.length, truncated: matched.length > items.length, items }
}

export async function getAssistantOperatingReport(scope: ShopAssistantScope, period: 'day' | 'week' | 'month') {
  const report = readResult(operatingReport, await scope.client.rpc('shop_operating_report', {
    p_shop_id: scope.shopId, p_location_id: scope.locationId, p_period: period,
  }))
  return { period, location: scope.location, currency: scope.currency, ...report }
}

export async function listAssistantExpenseCategories(scope: ShopAssistantScope, query?: string) {
  const term = searchTerm(query ?? '', 80)
  const categories = scope.client.from('expense_categories').select('id,name', { count: 'exact' })
    .eq('shop_id', scope.shopId).eq('is_active', true)
  if (term) categories.ilike('name', `%${escapeSearch(term)}%`)
  const { data, error, count } = await categories.order('name').limit(categoryLimit)
  if (error || !data || count === null) throw actionError(503, 'Expense categories unavailable')
  return { items: data, total: count, truncated: count > data.length }
}

export async function prepareAssistantExpense(scope: ShopAssistantScope, input: AssistantExpenseInput): Promise<AssistantExpense> {
  const parsed = expenseInput.safeParse(input)
  if (!parsed.success) throw actionError(400, 'Check the expense title, amount, date and category')
  const { data, error } = await scope.client.from('expense_categories').select('name')
    .eq('shop_id', scope.shopId).eq('id', parsed.data.categoryId).eq('is_active', true).maybeSingle()
  if (error) throw actionError(503, 'Expense category unavailable')
  if (!data) throw actionError(400, 'Choose an active expense category in this shop')
  return { ...parsed.data, category: data.name, currency: scope.currency, location: scope.location }
}

export async function saveAssistantExpense(scope: ShopAssistantScope, expense: AssistantExpense, requestId: string): Promise<string> {
  const { data, error } = await scope.client.rpc('confirm_assistant_expense', {
    p_request_id: requestId,
    p_shop_id: scope.shopId,
    p_location_id: scope.locationId,
    p_category_id: expense.categoryId,
    p_title: expense.title,
    p_amount: expense.amount,
    p_expense_date: expense.date,
    p_expected_category_name: expense.category,
    p_expected_currency: expense.currency,
    p_expected_location_name: expense.location,
  })
  if (error?.message === 'ASSISTANT_EXPENSE_DETAILS_CHANGED') {
    throw Object.assign(actionError(409, 'Expense details changed. Review a new proposal'), {
      data: { code: 'ASSISTANT_PROPOSAL_CHANGED' },
    })
  }
  if (error?.message === 'SHOP_SUBSCRIPTION_INACTIVE') throw actionError(403, 'An active shop subscription is required')
  if (error?.message === 'ACCOUNTING_PERIOD_CLOSED') throw actionError(409, 'The accounting period is closed')
  if (error?.message === 'EXPENSE_REQUEST_CONFLICT') throw actionError(409, 'Expense request already used')
  if (error?.code === '22023') throw actionError(400, 'Check the expense details')
  if (error?.code === '42501') throw actionError(403, 'Expense management permission required')
  if (error || !data) throw actionError(503, 'Expense could not be confirmed')
  return data
}
