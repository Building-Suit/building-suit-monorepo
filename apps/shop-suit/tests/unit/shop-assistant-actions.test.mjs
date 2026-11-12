import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getAssistantOperatingReport,
  prepareAssistantExpense,
  saveAssistantExpense,
  searchAssistantInventory,
  searchAssistantProducts,
} from '../../server/utils/shopAssistantActions.ts'

const categoryId = 'fa1638cb-b1f6-4d21-9159-0b2dbd059d76'
const requestId = '86c3de3b-d072-44f9-80cc-1a86970fbf0c'

function fixture(rpcResult) {
  const rpcCalls = []
  const categoryFilters = []
  let category = { name: 'Supplies' }
  const scope = {
    shopId: 'selected-shop',
    locationId: 'selected-location',
    location: 'Main branch',
    currency: 'EGP',
    client: {
      from(table) {
        assert.equal(table, 'expense_categories')
        const query = {
          select() { return query },
          eq(column, value) { categoryFilters.push([column, value]); return query },
          async maybeSingle() { return { data: category, error: null } },
        }
        return query
      },
      async rpc(name, params) {
        rpcCalls.push([name, params])
        return rpcResult
      },
    },
  }
  return { scope, categoryFilters, rpcCalls, changeCategory: value => { category = value } }
}

test('catalog lookup scopes and bounds the RPC and only returns display fields', async () => {
  const { scope, rpcCalls } = fixture({ data: {
    items: [{ name: 'قهوة', sku: 'coffee', category_name: 'مشروبات', sale_price: 50, base_unit_code: 'kg', internal: 'omitted' }],
    total: 27,
  }, error: null })
  assert.deepEqual(await searchAssistantProducts(scope, ' قهوة_ '), {
    currency: 'EGP', total: 27, truncated: true,
    items: [{ name: 'قهوة', sku: 'coffee', category: 'مشروبات', salePrice: 50, unit: 'kg' }],
  })
  assert.deepEqual(rpcCalls, [['list_products', {
    p_shop_id: 'selected-shop', p_search: 'قهوة\\_', p_page: 1, p_page_size: 20,
  }]])
})

test('inventory searches active products and caps results while keeping the shop-wide match count', async () => {
  const low = {
    name: 'Cafe\u0301', sku: null, quantity_on_hand: 2.25, reorder_threshold: 3,
    base_unit_code: 'kg', is_active: true, is_low_stock: true, inventory_value: 999,
  }
  const { scope, rpcCalls } = fixture({ data: { items: [
    ...Array.from({ length: 21 }, (_, index) => ({ ...low, sku: `SKU-${index}` })),
    { ...low, is_active: false },
    { ...low, is_low_stock: false },
    { ...low, name: 'Tea' },
  ] }, error: null })
  const result = await searchAssistantInventory(scope, { query: 'CAFÉ', lowStockOnly: true })
  assert.equal(result.scope, 'shop')
  assert.equal(result.total, 21)
  assert.equal(result.truncated, true)
  assert.equal(result.items.length, 20)
  assert.deepEqual(result.items[0], {
    name: low.name, sku: 'SKU-0', quantityOnHand: 2.25, unit: 'kg', reorderThreshold: 3, lowStock: true,
  })
  assert.deepEqual(rpcCalls, [['list_inventory', { p_shop_id: 'selected-shop', p_low_stock_only: true }]])
})

test('reports query the selected branch and exclude underlying customer and staff records', async () => {
  const totals = {
    fromDate: '2026-11-09', toDateExclusive: '2026-11-16',
    sales: 500, saleCount: 4, paymentsIn: 450, expenses: { amount: null, count: null },
  }
  const { scope, rpcCalls } = fixture({ data: {
    ...totals,
    outstanding: { customers: [{ name: 'Private customer' }] },
    staff: [{ name: 'Private staff member' }],
  }, error: null })
  assert.deepEqual(await getAssistantOperatingReport(scope, 'week'), {
    ...totals, period: 'week', currency: 'EGP', location: 'Main branch',
  })
  assert.deepEqual(rpcCalls, [['shop_operating_report', {
    p_shop_id: 'selected-shop', p_location_id: 'selected-location', p_period: 'week',
  }]])
})

test('expense approval repeats an exact create-only command with a stable request ID', async () => {
  const { scope, rpcCalls, categoryFilters } = fixture({ data: 'expense-id', error: null })
  const input = { title: '  Delivery boxes ', amount: 12.35, date: '2026-11-12', categoryId }
  const expense = await prepareAssistantExpense(scope, input)
  assert.deepEqual(expense, {
    ...input, title: 'Delivery boxes', category: 'Supplies', currency: 'EGP', location: 'Main branch',
  })
  assert.deepEqual(categoryFilters, [['shop_id', 'selected-shop'], ['id', categoryId], ['is_active', true]])
  assert.equal(await saveAssistantExpense(scope, expense, requestId), 'expense-id')
  assert.equal(await saveAssistantExpense(scope, expense, requestId), 'expense-id')
  assert.deepEqual(rpcCalls[0], ['confirm_assistant_expense', {
    p_request_id: requestId, p_shop_id: 'selected-shop', p_location_id: 'selected-location',
    p_category_id: categoryId, p_title: 'Delivery boxes', p_amount: 12.35,
    p_expense_date: '2026-11-12', p_expected_category_name: 'Supplies',
    p_expected_currency: 'EGP', p_expected_location_name: 'Main branch',
  }])
  assert.deepEqual(rpcCalls[1], rpcCalls[0])
})

test('an invalid date, extra precision or inactive category cannot become a proposal', async () => {
  const { scope, categoryFilters, changeCategory } = fixture(null)
  const input = { title: 'Delivery boxes', amount: 12.35, date: '2026-11-12', categoryId }
  await assert.rejects(prepareAssistantExpense(scope, { ...input, date: '2026-02-29' }), { statusCode: 400 })
  await assert.rejects(prepareAssistantExpense(scope, { ...input, amount: 12.345 }), { statusCode: 400 })
  assert.equal(categoryFilters.length, 0)
  changeCategory(null)
  await assert.rejects(prepareAssistantExpense(scope, input), { statusCode: 400 })
})

test('confirmation translates a stale database snapshot without exposing provider errors', async () => {
  const { scope } = fixture({ data: null, error: { code: '55000', message: 'ASSISTANT_EXPENSE_DETAILS_CHANGED' } })
  const expense = await prepareAssistantExpense(scope, { title: 'Delivery boxes', amount: 12.35, date: '2026-11-12', categoryId })
  await assert.rejects(saveAssistantExpense(scope, expense, requestId), {
    statusCode: 409,
    data: { code: 'ASSISTANT_PROPOSAL_CHANGED' },
  })
})
