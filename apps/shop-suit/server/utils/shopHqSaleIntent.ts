import { z } from 'zod'
import type { ShopHqSaleSelection } from '../../shared/shopHqSale.ts'
import type { ShopAssistantScope } from './shopAssistantScope.ts'

const intentSchema = z.object({
  customerName: z.string().trim().min(2).max(160),
  services: z.array(z.string().trim().min(2).max(120)).min(1).max(6),
  paymentMethod: z.enum(['cash', 'card', 'transfer']).nullable(),
})

const namedRow = z.object({ id: z.guid(), name: z.string() })
const barberServiceAliases = new Map<string, readonly string[]>([
  ['شعر', ['قص شعر', 'حلاقة شعر']],
  ['دقن', ['قص دقن', 'حلاقة دقن', 'تهذيب دقن']],
])
const posCustomers = z.object({ customers: z.array(namedRow).max(20) })
const posCatalog = z.object({
  items: z.array(namedRow.extend({
    itemType: z.literal('service'),
    unitPrice: z.number().nonnegative(),
    discount: z.number().nonnegative(),
  })).max(20),
  total: z.number().int().nonnegative(),
})

type Unresolved = {
  kind: 'customer_missing' | 'customer_ambiguous' | 'service_missing' | 'service_ambiguous'
  query: string
  options: string[]
}

function normalizeName(value: string) {
  return value.normalize('NFKC').toLowerCase()
    .replace(/\u0640|[\u064B-\u065F]|\u0670/gu, '')
    .replace(/[أإآٱ]/gu, 'ا')
    .replace(/ى/gu, 'ي')
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
}

function serviceName(value: string) {
  return normalizeName(value).split(' ').map(word => word
    .replace(/^ال(?=.{3})/u, '').replace(/ذقن/gu, 'دقن')).join(' ')
}

function searchTerms(value: string) {
  const trimmed = value.replace(/\u0640|[\u064B-\u065F]|\u0670/gu, '').trim()
  const tokens = trimmed.match(/[\p{L}\p{N}]+/gu) ?? []
  // A single plain token can find a record with a different spelling elsewhere
  // in its name. Prefer a longer token without an alef or ya variant.
  const anchor = tokens.slice().reverse().sort((a, b) =>
    Number(/[اىأيإآٱ]/u.test(a)) - Number(/[اىأيإآٱ]/u.test(b)) || b.length - a.length,
  ).find(word => word.length >= 2)
  const plain = trimmed.replace(/[أإآٱ]/gu, 'ا').replace(/ى/gu, 'ي')
  return [...new Set([trimmed, plain, anchor, anchor?.replace(/دقن/gu, 'ذقن')])]
    .filter((term): term is string => Boolean(term && term.length >= 2))
    .map(term => term.replace(/[\\%_]/gu, '\\$&')).filter(term => term.length <= 160)
}

function readResult<T>(schema: z.ZodType<T>, result: { data: unknown; error: { code: string } | null }): T {
  if (result.error?.code === '42501') {
    throw Object.assign(new Error('Sale permission required'), { statusCode: 403 })
  }
  const parsed = schema.safeParse(result.data)
  if (result.error || !parsed.success) {
    throw Object.assign(new Error('Sale lookup unavailable'), { statusCode: 503 })
  }
  return parsed.data
}

function uniqueById<T extends { id: string }>(items: T[]) {
  return [...new Map(items.map(item => [item.id, item])).values()]
}

function unresolved(kind: Unresolved['kind'], query: string, candidates: Array<{ name: string }> = []): Unresolved {
  return { kind, query, options: [...new Set(candidates.map(candidate => candidate.name))].slice(0, 5) }
}

export async function resolveShopHqSaleIntent(
  scope: ShopAssistantScope,
  intent: z.input<typeof intentSchema>,
): Promise<Unresolved | { kind: 'ready'; selection: ShopHqSaleSelection }> {
  const { customerName, services, paymentMethod } = intentSchema.parse(intent)
  const selection = { p_shop_id: scope.shopId, p_location_id: scope.locationId }
  const customerPages = await Promise.all(searchTerms(customerName).map(async search =>
    readResult(posCustomers, await scope.client.rpc('pos_checkout_context', { ...selection, p_customer_search: search })),
  ))
  const customers = uniqueById(customerPages.flatMap(page => page.customers))
  const matchingCustomers = customers.filter(row => normalizeName(row.name) === normalizeName(customerName))
  if (!matchingCustomers.length) return unresolved('customer_missing', customerName, customers)
  if (matchingCustomers.length !== 1 || customerPages.some(page => page.customers.length === 20)) {
    return unresolved('customer_ambiguous', customerName, matchingCustomers)
  }
  const customer = matchingCustomers[0]!
  const selectedServices: ShopHqSaleSelection['services'] = []

  for (const service of services) {
    const pages = await Promise.all(searchTerms(service).map(async search =>
      readResult(posCatalog, await scope.client.rpc('pos_catalog_search_by_category', {
        ...selection, p_search: search, p_item_type: 'service', p_page: 1, p_page_size: 20,
      })),
    ))
    const candidates = uniqueById(pages.flatMap(page => page.items))
    const target = serviceName(service)
    const exact = candidates.filter(row => serviceName(row.name) === target)
    const suggestions = candidates.filter(row => ` ${serviceName(row.name)} `.includes(` ${target} `))
    // Barber shorthand can match an equivalent full label. A generic word
    // match is only a suggestion, for example hair coloring versus a haircut.
    const aliases = barberServiceAliases.get(target)
    const matching = exact.length ? exact : candidates.filter(row => aliases?.includes(serviceName(row.name)))
    if (!matching.length) {
      return unresolved(suggestions.length > 1 ? 'service_ambiguous' : 'service_missing', service, suggestions)
    }
    if (matching.length !== 1 || pages.some(page => page.total > page.items.length)) {
      return unresolved('service_ambiguous', service, matching)
    }
    const { id, name, unitPrice, discount } = matching[0]!
    if (selectedServices.some(row => row.id === id)) {
      return unresolved('service_ambiguous', service, matching)
    }
    selectedServices.push({ id, name, unitPrice, discount })
  }

  return {
    kind: 'ready',
    selection: {
      customer,
      services: selectedServices,
      paymentMethod: paymentMethod === 'transfer' ? 'bank_transfer' : paymentMethod,
    },
  }
}
